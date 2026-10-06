// Bilancio — notifiche push "Scadenze di domani" (Supabase Edge Function).
//
// Chi la chiama:
//  - il cron di Supabase ogni ora (intestazione x-cron-secret): per ogni telefono iscritto, se nel suo
//    fuso orario è arrivata l'ora scelta e oggi non ha ancora ricevuto l'avviso, calcola le ricorrenti
//    e le pianificate di domani e invia la notifica (solo se ce n'è almeno una);
//  - l'app, con il pulsante "Invia una prova" (token dell'utente collegato): invia subito l'anteprima
//    ai telefoni di quell'utente.
//
// Segreti da impostare in Supabase (Edge Functions › Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:tua@email), CRON_SECRET
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sono già disponibili.
// In Supabase la funzione va pubblicata con "Verify JWT" disattivato: i controlli sono qui sotto.

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const APP = "bilancio";
const env = (k: string) => Deno.env.get(k) ?? "";
const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});
webpush.setVapidDetails(
  env("VAPID_SUBJECT") || "mailto:bilancio@example.com",
  env("VAPID_PUBLIC_KEY"),
  env("VAPID_PRIVATE_KEY"),
);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

/* ---------- Date (stessa logica dell'app) ---------- */
const pad2 = (n: number) => String(n).padStart(2, "0");
const isoUTC = (d: Date) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
const parseISO = (iso: string) => new Date(iso + "T00:00:00Z");

function stepDateISO(iso: string, freq: string, anchorISO = iso): string {
  const d = parseISO(iso);
  if (freq === "weekly") {
    d.setUTCDate(d.getUTCDate() + 7);
    return isoUTC(d);
  }
  const months = freq === "yearly" ? 12 : freq === "bimonthly" ? 2 : freq === "quarterly" ? 3 : freq === "semiannual" ? 6 : 1;
  const anchor = parseISO(anchorISO);
  const anchorDay = anchor.getUTCDate();
  const anchorLast = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0)).getUTCDate();
  const endOfMonth = anchorDay === anchorLast;
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + months;
  const targetLast = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return isoUTC(new Date(Date.UTC(y, m, endOfMonth ? targetLast : Math.min(anchorDay, targetLast))));
}

// Il ricorrente cade proprio in quella data (rispettando attivo, data di fine e numero di rate)?
function recurringOn(r: any, iso: string): boolean {
  if (!r || r.active === false || !r.startDate || iso < r.startDate) return false;
  if (r.endDate && iso > r.endDate) return false;
  let d = r.startDate, index = 1, safety = 0;
  while (d < iso && safety < 3000) { d = stepDateISO(d, r.freq, r.startDate); index++; safety++; }
  if (d !== iso) return false;
  const max = Number(r.maxOccurrences) || 0;
  return !(max > 0 && index > max);
}

// Data e ora locali nel fuso del telefono.
function localNow(tz: string) {
  let zone = tz || "Europe/Rome";
  try { new Intl.DateTimeFormat("en-CA", { timeZone: zone }); } catch { zone = "Europe/Rome"; }
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date()).map((p) => [p.type, p.value]),
  );
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  const t = parseISO(today); t.setUTCDate(t.getUTCDate() + 1);
  return { today, tomorrow: isoUTC(t), hour: Number(parts.hour) };
}

/* ---------- Contenuto della notifica ---------- */
const fmt = (n: number) => {
  const v = Math.round((n || 0) * 100) / 100;
  return "€" + v.toLocaleString("it-IT", { minimumFractionDigits: v % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 });
};

function itemsFor(data: any, iso: string) {
  const cats = new Map((data?.categories || []).map((c: any) => [c.id, c]));
  const label = (x: any) => x.name || (cats.get(x.categoryId) as any)?.name || (x.type === "income" ? "Entrata" : "Uscita");
  const out: { name: string; amount: number; type: string }[] = [];
  (data?.recurring || []).forEach((r: any) => {
    if (recurringOn(r, iso)) out.push({ name: label(r), amount: Number(r.amount) || 0, type: r.type });
  });
  (data?.planned || []).forEach((p: any) => {
    if (p.date === iso) out.push({ name: label(p), amount: Number(p.amount) || 0, type: p.type });
  });
  // prima le uscite, poi per importo
  return out.sort((a, b) => (a.type === b.type ? b.amount - a.amount : a.type === "expense" ? -1 : 1));
}

function message(items: ReturnType<typeof itemsFor>, showAmounts: boolean, iso: string) {
  const line = (i: { name: string; amount: number; type: string }) =>
    showAmounts ? `${i.name} ${i.type === "income" ? "+" : "−"}${fmt(i.amount)}` : i.name;
  const title = items.length === 1 ? "Domani: 1 scadenza" : `Domani: ${items.length} scadenze`;
  const shown = items.slice(0, 4).map(line).join(" · ");
  const more = items.length > 4 ? ` e altre ${items.length - 4}` : "";
  let body = shown + more;
  if (showAmounts && items.length > 1) {
    const net = items.reduce((s, i) => s + (i.type === "income" ? i.amount : -i.amount), 0);
    body += `\nTotale ${net >= 0 ? "+" : "−"}${fmt(Math.abs(net))}`;
  }
  return { title, body, tag: `scadenze-${iso}`, url: "./?view=recurring" };
}

async function send(sub: any, payload: unknown) {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 12, urgency: "normal" },
    );
    return "ok";
  } catch (e: any) {
    // 404/410: il telefono ha tolto il permesso o l'app: l'iscrizione non serve più.
    if (e?.statusCode === 404 || e?.statusCode === 410) {
      await admin.from("push_subscriptions").delete().eq("id", sub.id);
      return "gone";
    }
    console.error("push", e?.statusCode, e?.body || e?.message);
    return "error";
  }
}

async function loadData(userId: string) {
  const { data } = await admin.from("app_data").select("data").eq("app", APP).eq("user_id", userId).maybeSingle();
  return data?.data ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Usa POST" }, 405);

  const cron = req.headers.get("x-cron-secret");
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");

  /* ---- Prova dall'app ---- */
  if (!cron) {
    const { data: u, error } = await admin.auth.getUser(bearer);
    if (error || !u?.user) return json({ error: "Accesso non valido: rifai l'accesso alla sincronizzazione." }, 401);
    const { data: subs } = await admin.from("push_subscriptions").select("*").eq("app", APP).eq("user_id", u.user.id).eq("enabled", true);
    if (!subs?.length) return json({ error: "Nessun telefono iscritto: attiva prima le notifiche." }, 404);
    const appData = await loadData(u.user.id);
    const results: string[] = [];
    for (const s of subs) {
      const { tomorrow } = localNow(s.tz);
      const items = itemsFor(appData, tomorrow);
      const payload = items.length
        ? message(items, s.show_amounts, tomorrow)
        : { title: "Notifiche attive", body: "Domani non ci sono scadenze. Ti avviso quando ce ne saranno.", tag: "prova", url: "./" };
      results.push(await send(s, payload));
    }
    return json({ sent: results.filter((r) => r === "ok").length, results });
  }

  /* ---- Giro orario dal cron ---- */
  if (!env("CRON_SECRET") || cron !== env("CRON_SECRET")) return json({ error: "Segreto non valido" }, 401);
  const { data: subs, error } = await admin.from("push_subscriptions").select("*").eq("app", APP).eq("enabled", true);
  if (error) return json({ error: error.message }, 500);

  const cache = new Map<string, any>();
  let sent = 0, skipped = 0;
  for (const s of subs || []) {
    const { today, tomorrow, hour } = localNow(s.tz);
    if (hour < (s.notify_hour ?? 20) || s.last_sent_day === today) { skipped++; continue; }
    if (!cache.has(s.user_id)) cache.set(s.user_id, await loadData(s.user_id));
    const items = itemsFor(cache.get(s.user_id), tomorrow);
    const r = items.length ? await send(s, message(items, s.show_amounts, tomorrow)) : "nothing";
    if (r === "ok") sent++;
    // Segna il giorno solo se è andata (o non c'era niente): se l'invio fallisce si riprova l'ora dopo.
    if (r === "ok" || r === "nothing") await admin.from("push_subscriptions").update({ last_sent_day: today }).eq("id", s.id);
  }
  return json({ sent, skipped, total: subs?.length || 0 });
});
