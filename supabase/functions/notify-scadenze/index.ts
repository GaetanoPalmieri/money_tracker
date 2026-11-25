// Bilancio — notifiche push "Scadenze di domani" + "Tappe del Piano" (1.95.0) + "Riepilogo mensile" + "Ritmo di spesa" (Supabase Edge Function).
// v1.86.0: avviso quando una stima o un budget passa l'80% prima del 20 del mese (vedi paceAlerts).
// v1.94.0: facoltativi, spenti di base (campi in data.settings): riga "⚠ conto andrà a −12 €" (notifyRed) e promemoria
//          settimanale "segna il saldo vero" (realBalanceDay), il 1° gennaio "il tuo anno" (yearRecapPush).
//          Senza quei campi la funzione fa esattamente come la 1.93.
//
// v1.21.0: il giorno 1 di ogni mese, alla stessa ora scelta per le scadenze, manda anche il
// riepilogo del mese appena chiuso (entrate, uscite, saldo, categorie principali, confronto
// col mese prima). Si disattiva per telefono dall'app (colonna monthly_summary).
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
  // formato unico della suite: 1.234,56 € (come nelle app)
  const [i, d] = Math.abs(v).toFixed(2).split(".");
  return (v <= -0.005 ? "−" : "") + i.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "," + d + "\u00a0€";
};

function itemsFor(data: any, iso: string) {
  const cats = new Map((data?.categories || []).map((c: any) => [c.id, c]));
  const label = (x: any) => x.name || (cats.get(x.categoryId) as any)?.name || (x.type === "income" ? "Entrata" : "Uscita");
  const out: { name: string; amount: number; type: string; accountId?: string }[] = [];
  const tx = Array.isArray(data?.transactions) ? data.transactions : [];
  (data?.recurring || []).forEach((r: any) => {
    // Bilancio 1.93.0 — come nell'app: niente avviso per una rata già pagata in anticipo (movimento con earlyFor = quella
    // data, o già registrata quel giorno) o già superata da nextDate (rata saltata/pagata).
    if (r && r.nextDate && r.nextDate > iso) return;
    if (r && tx.some((t: any) => t && t.recurringId === r.id && (t.earlyFor === iso || t.date === iso))) return;
    if (recurringOn(r, iso)) out.push({ name: label(r), amount: Number(r.amount) || 0, type: r.type, accountId: r.accountId });
  });
  (data?.planned || []).forEach((p: any) => {
    if (p.date === iso) out.push({ name: label(p), amount: Number(p.amount) || 0, type: p.type, accountId: p.accountId });
  });
  // prima le uscite, poi per importo
  return out.sort((a, b) => (a.type === b.type ? b.amount - a.amount : a.type === "expense" ? -1 : 1));
}

// Notifica schematica: una scadenza per riga, 🔻 uscita / 🔺 entrata.
function message(items: ReturnType<typeof itemsFor>, showAmounts: boolean, iso: string) {
  const n = items.length;
  let title = `📅 Domani · ${n} ${n === 1 ? "scadenza" : "scadenze"}`;
  if (showAmounts && n > 1) {
    const net = items.reduce((s, i) => s + (i.type === "income" ? i.amount : -i.amount), 0);
    title += ` · ${net >= 0 ? "+" : "−"}${fmt(Math.abs(net))}`;
  }
  const lines = items.slice(0, 4).map((i) => `${i.type === "income" ? "🔺" : "🔻"} ${i.name}${showAmounts ? " · " + fmt(i.amount) : ""}`);
  if (n > 4) lines.push(`➕ altre ${n - 4}`);
  return { title, body: lines.join("\n"), tag: `scadenze-${iso}`, url: "./?view=recurring" };
}

/* ---------- Bilancio 1.94.0 — F5 "un conto va in rosso" (facoltativo: settings.notifyRed === true nei dati) ----------
   Saldo come nell'app (saldo di partenza + tutti i movimenti), poi le scadenze di oggi non ancora registrate e quelle di
   domani. Se dopo le scadenze di domani un conto (non prestiti, non archiviato) è sotto zero e domani ha un'uscita su quel
   conto, alla notifica "Domani" si aggiunge la riga "⚠ BBVA andrà a −12,00 €". Spento o campo assente: niente cambia. */
function accountBalanceOf(data: any, accId: string): number {
  const acc = (data?.accounts || []).find((a: any) => a && a.id === accId);
  let v = Number(acc?.balance) || 0;
  (data?.transactions || []).forEach((t: any) => {
    if (!t) return;
    const a = Number(t.amount) || 0;
    if (t.type === "transfer") { if (t.accountId === accId) v -= a; else if (t.toAccountId === accId) v += a; return; }
    if (t.accountId !== accId) return;
    v += t.type === "income" ? a : -a;
  });
  return Math.round(v * 100) / 100;
}
function redAlerts(data: any, today: string, tomorrow: string) {
  if (!data || !data.settings || data.settings.notifyRed !== true) return [];
  const accs = (data.accounts || []).filter((a: any) => a && !a.receivable && !a.payable && !a.archived);
  const due = [...(today < tomorrow ? itemsFor(data, today) : []), ...itemsFor(data, tomorrow)];
  const tmr = itemsFor(data, tomorrow);
  const out: any[] = [];
  accs.forEach((a: any) => {
    if (!tmr.some((i: any) => i.accountId === a.id && i.type === "expense")) return;
    const after = Math.round(due.filter((i: any) => i.accountId === a.id).reduce((v: number, i: any) => v + (i.type === "income" ? i.amount : -i.amount), accountBalanceOf(data, a.id)) * 100) / 100;
    if (after < -0.005) out.push({ name: a.name || "Conto", balance: after });
  });
  return out.sort((x: any, y: any) => x.balance - y.balance);
}
function withRedLines(msg: any, data: any, today: string, tomorrow: string, showAmounts: boolean) {
  const red = redAlerts(data, today, tomorrow);
  if (!red.length) return msg;
  const lines = red.slice(0, 3).map((r: any) => showAmounts ? `⚠ ${r.name} andrà a ${fmt(r.balance)}` : `⚠ ${r.name} andrà sotto zero`);
  return { ...msg, body: [msg.body, ...lines].filter(Boolean).join("\n") };
}

/* ---------- Bilancio 1.94.0 — F6 promemoria "segna il saldo vero" (facoltativo: settings.realBalanceDay 0-6 nei dati) ----------
   Una volta a settimana, il giorno scelto (0 = domenica … 6 = sabato), nello stesso giro dell'avviso "Domani". Solo i conti
   (non prestiti, non archiviati, usati negli ultimi 90 giorni) mai verificati (nessuna rettifica "saldo vero") o con
   rettifiche frequenti (almeno 2 negli ultimi 60 giorni). Spento o campo assente: niente cambia. */
function isRealAdj(t: any): boolean {
  return !!(t && t.isBalanceAdjustment && !t.loanKind && !t.loanWriteOff && !t.loanOld && (t.setsRealBalance || /^Saldo aggiornato manualmente/.test(t.note || "")));
}
function balanceReminder(data: any, today: string) {
  const day = data?.settings?.realBalanceDay;
  if (!Number.isInteger(day) || day < 0 || day > 6) return null;
  if (parseISO(today).getUTCDay() !== day) return null;
  const back = (n: number) => { const d = parseISO(today); d.setUTCDate(d.getUTCDate() - n); return isoUTC(d); };
  const d60 = back(60), d90 = back(90);
  const tx: any[] = (data.transactions || []).filter((t: any) => t && typeof t.date === "string");
  const names: any[] = [];
  (data.accounts || []).filter((a: any) => a && !a.receivable && !a.payable && !a.archived).forEach((a: any) => {
    const mine = tx.filter((t: any) => t.accountId === a.id || t.toAccountId === a.id);
    if (!mine.some((t: any) => t.date >= d90 && t.date <= today)) return;
    const adj = mine.filter((t: any) => t.accountId === a.id && isRealAdj(t));
    if (!adj.length || adj.filter((t: any) => t.date >= d60 && t.date <= today).length >= 2) names.push(a.name || "Conto");
  });
  if (!names.length) return null;
  return { title: "🧾 Segna il saldo vero", body: `Controlla in banca e scrivi il saldo di: ${names.slice(0, 5).join(", ")}${names.length > 5 ? ` e altri ${names.length - 5}` : ""}`, tag: `saldo-${today}`, url: "./?view=accounts" };
}

/* ---------- Riepilogo mensile (stessa regola delle Statistiche dell'app) ---------- */
// Conta entrate e uscite del mese, esclude giroconti (type "transfer"), rettifiche di saldo e prestiti vecchi (loanOld,
// Bilancio 1.93.0: come sumTransactions dell'app).
const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
function monthBefore(key: string) {
  const [y, m] = key.split("-").map(Number); // m = 1..12
  return m === 1 ? `${y - 1}-12` : `${y}-${pad2(m - 1)}`;
}
const monthName = (key: string) => MESI[Number(key.slice(5, 7)) - 1] || key;
// "a settembre" ma "ad agosto / ad aprile / ad ottobre"
const aMese = (key: string) => (/^[aeiou]/.test(monthName(key)) ? "ad " : "a ") + monthName(key);

function monthStats(data: any, key: string) {
  const tx = (data?.transactions || []).filter((t: any) =>
    t && typeof t.date === "string" && t.date.startsWith(key) && !t.isBalanceAdjustment && !t.loanOld && (t.type === "income" || t.type === "expense"));
  let income = 0, expense = 0;
  const byCat = new Map<string, number>();
  tx.forEach((t: any) => {
    const a = Number(t.amount) || 0;
    if (t.type === "income") income += a;
    else { expense += a; byCat.set(String(t.categoryId ?? ""), (byCat.get(String(t.categoryId ?? "")) || 0) + a); }
  });
  const cats = new Map((data?.categories || []).map((c: any) => [String(c.id), c]));
  const top = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, v]) => {
    const c: any = cats.get(id) || {};
    return { emoji: c.emoji || "", name: c.name || "Altro", amount: v };
  });
  return { count: tx.length, income, expense, top };
}

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
const euro0 = (n: number) => Math.round(n).toLocaleString("it-IT") + "\u00a0€";

// Notifica schematica: un dato per riga.
function monthlyMessage(data: any, key: string, showAmounts: boolean) {
  const st = monthStats(data, key);
  if (!st.count) return null;
  const prevKey = monthBefore(key), prev = monthStats(data, prevKey);
  const net = st.income - st.expense;
  const lines: string[] = [];
  if (showAmounts) {
    lines.push(`🔻 Uscite ${fmt(st.expense)}`);
    lines.push(`🔺 Entrate ${fmt(st.income)}`);
    lines.push(`🟰 Saldo ${net >= 0 ? "+" : "−"}${fmt(Math.abs(net))}`);
    if (st.top.length) lines.push(st.top.map((t) => `${t.emoji || "•"} ${euro0(t.amount)}`).join(" · "));
  } else {
    lines.push(`🧾 ${st.count} ${st.count === 1 ? "movimento" : "movimenti"}`);
    lines.push(net >= 0 ? "🟢 Saldo positivo" : "🔴 Saldo negativo");
    if (st.top.length) lines.push(st.top.map((t) => `${t.emoji || "•"} ${t.name}`).join(" · "));
  }
  if (prev.expense > 0 && st.expense > 0) {
    const pct = Math.round(((st.expense - prev.expense) / prev.expense) * 100);
    lines.push(pct === 0 ? `➖ Spese stabili vs ${monthName(prevKey)}` : `${pct > 0 ? "📈 +" : "📉 −"}${Math.abs(pct)}% spese vs ${monthName(prevKey)}`);
  }
  return { title: `📊 ${cap(monthName(key))}`, body: lines.join("\n"), tag: `riepilogo-${key}`, url: `./?view=stats&month=${key}` };
}

/* ---------- Bilancio 1.94.0 — F9 "il tuo anno" il 1° gennaio (facoltativo: settings.yearRecapPush === true nei dati) ----------
   Stessa regola dell'app (Statistiche › Il tuo anno): entrate, uscite, risparmio, scommesse (categorie "Scommesse",
   entrate "Bet"), mese migliore. Parte nel giro dell'avviso "Domani" del 1° gennaio (una volta al giorno). Campo assente
   o false: niente cambia. */
function yearMessage(data: any, year: number, showAmounts: boolean) {
  if (!data || !data.settings || data.settings.yearRecapPush !== true) return null;
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${pad2(i + 1)}`).map((k) => ({ k, ...monthStats(data, k) }));
  const income = months.reduce((s, x) => s + x.income, 0), expense = months.reduce((s, x) => s + x.expense, 0);
  const count = months.reduce((s, x) => s + x.count, 0);
  if (!count) return null;
  const saved = income - expense;
  const betCats = new Set((data.categories || []).filter((c: any) => /scommess/i.test(String(c?.name || ""))).map((c: any) => c.id));
  let betOut = 0, betIn = 0;
  (data.transactions || []).forEach((t: any) => {
    if (!t || typeof t.date !== "string" || !t.date.startsWith(String(year)) || t.isBalanceAdjustment) return;
    if (t.type === "expense" && betCats.has(t.categoryId)) betOut += Number(t.amount) || 0;
    else if (t.type === "income" && (betCats.has(t.categoryId) || /^\s*bet\b/i.test(String(t.name || "")))) betIn += Number(t.amount) || 0;
  });
  const used = months.filter((x) => x.count > 0).sort((a, b) => (b.income - b.expense) - (a.income - a.expense));
  const lines: string[] = [];
  if (showAmounts) {
    lines.push(`🔺 Entrate ${fmt(income)}`);
    lines.push(`🔻 Uscite ${fmt(expense)}`);
    lines.push(`🟰 Risparmiato ${saved >= 0 ? "+" : "−"}${fmt(Math.abs(saved))}`);
    if (betOut || betIn) lines.push(`🎲 Scommesse ${betIn - betOut >= 0 ? "+" : "−"}${fmt(Math.abs(betIn - betOut))}`);
  } else {
    lines.push(`🧾 ${count} movimenti`);
    lines.push(saved >= 0 ? "🟢 Anno in positivo" : "🔴 Anno in negativo");
  }
  if (used.length >= 2) lines.push(`🏆 Mese migliore: ${monthName(used[0].k)}`);
  return { title: `✨ Il tuo ${year}`, body: lines.join("\n"), tag: `anno-${year}`, url: `./?view=stats&month=${year}-12` };
}
function yearRecapFor(data: any, today: string, showAmounts: boolean) {
  if (!today.endsWith("-01-01")) return null;
  return yearMessage(data, Number(today.slice(0, 4)) - 1, showAmounts);
}

/* ---------- v1.86.0 — AVVISI DI RITMO: una stima o un budget che passa l'80% prima del 20 del mese ----------
   Stessa regola dell'app (Home, sotto "Puoi spendere"). Parte una volta sola, il giorno in cui la soglia viene
   superata: si confronta lo speso di adesso con lo speso senza i movimenti creati nelle ultime 24 ore (l'ora di
   creazione è scritta nell'id del movimento; se non si legge vale la data di oggi). Si spegne dall'app
   (pacePush = false nei dati). Nessuna colonna nuova: viaggia insieme all'avviso delle scadenze. */
function txCreatedMs(t: any): number | null {
  const id = String(t?.id || "");
  if (id.length < 12) return null;
  const ms = parseInt(id.slice(0, -6), 36);
  return Number.isFinite(ms) && ms > 1.5e12 && ms < 4e12 ? ms : null;
}
function paceAlerts(data: any, today: string) {
  if (!data || data.pacePush === false || Number(today.slice(8, 10)) > 20) return [];
  const key = today.slice(0, 7), since = Date.now() - 24 * 3600e3;
  const isNew = (t: any) => { const ms = txCreatedMs(t); return ms != null ? ms >= since : t.date === today; };
  const tx = (data.transactions || []).filter((t: any) => t && t.type === "expense" && !t.isBalanceAdjustment && typeof t.date === "string" && t.date.startsWith(key));
  const out: { name: string; pct: number; kind: string }[] = [];
  const check = (name: string, limit: number, list: any[], kind: string) => {
    if (!(limit > 0)) return;
    const now = list.reduce((a, t) => a + (Number(t.amount) || 0), 0), before = list.filter((t) => !isNew(t)).reduce((a, t) => a + (Number(t.amount) || 0), 0);
    if (now / limit >= 0.8 && before / limit < 0.8) out.push({ name, pct: Math.round(now / limit * 100), kind });
  };
  const cats: any[] = data.categories || [], catById = new Map(cats.map((c: any) => [c.id, c]));
  (data.estimates || []).filter((e: any) => e && e.month === key).forEach((e: any) =>
    check(e.name || (catById.get(e.categoryId) as any)?.name || "Stima", Number(e.amount) || 0,
      tx.filter((t: any) => t.estimateId === e.id && !t.loanOld && !t.loanWriteOff && !t.planned), "della stima"));
  const within = (id: string) => [id, ...cats.filter((c: any) => c.parentCategoryId === id).map((c: any) => c.id)];
  const top = cats.filter((c: any) => c.kind === "expense" && !c.parentCategoryId), macros: any[] = (data.macroCategories || []).filter((m: any) => m.kind !== "income");
  const of = (ids: string[]) => tx.filter((t: any) => ids.includes(t.categoryId));
  macros.forEach((m: any) => {
    const mc = top.filter((c: any) => c.macroCategoryId === m.id);
    if (Number(m.budget) > 0) check(m.name, Number(m.budget), of(mc.flatMap((c: any) => within(c.id))), "del budget");
    else mc.forEach((c: any) => check(c.name, Number(c.budget) || 0, of(within(c.id)), "del budget"));
  });
  top.filter((c: any) => !macros.some((m: any) => m.id === c.macroCategoryId)).forEach((c: any) => check(c.name, Number(c.budget) || 0, of(within(c.id)), "del budget"));
  return out.sort((a, b) => b.pct - a.pct);
}
function paceMessage(list: ReturnType<typeof paceAlerts>, today: string) {
  const day = Number(today.slice(8, 10));
  return { title: `⚠️ Ritmo di spesa · giorno ${day}`, body: list.slice(0, 4).map((a) => `🟠 ${a.name} · ${a.pct}% ${a.kind}`).join("\n"), tag: `ritmo-${today}`, url: "./" };
}

/* ---------- Bilancio 1.95.0 — MF1 tappe del Piano (settings.notifyPlan: assente = acceso, false = spento) ----------
   Il giorno prima di una tappa con il giorno (step.day) e, il 1° del mese, le tappe del mese senza giorno. Solo non fatte. */
function planReminder(data: any, today: string, tomorrow: string) {
  if (!data || (data.settings && data.settings.notifyPlan === false)) return null;
  const P = data.plan; if (!P || !Array.isArray(P.steps)) return null;
  const open = P.steps.filter((s: any) => s && !s.done && s.title);
  const tmr = open.filter((s: any) => s.day === tomorrow);
  if (tmr.length) {
    const d = tomorrow.split("-"); return { title: `📌 Domani nel piano (${Number(d[2])}/${Number(d[1])})`, body: tmr.slice(0, 3).map((s: any) => `• ${s.title}${s.detail ? "\n" + String(s.detail).slice(0, 140) : ""}`).join("\n"), tag: `piano-${tomorrow}`, url: "./?view=recurring" };
  }
  if (today.endsWith("-01")) {
    const mk = today.slice(0, 7), mon = open.filter((s: any) => s.month === mk && !s.day);
    if (mon.length) return { title: `📌 Questo mese nel piano`, body: mon.slice(0, 5).map((s: any) => `• ${s.title}`).join("\n") + (mon.length > 5 ? `\n➕ altre ${mon.length - 5}` : ""), tag: `piano-${mk}`, url: "./?view=recurring" };
  }
  return null;
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

  const reqBody: any = await req.json().catch(() => ({}));

  /* ---- Prova dall'app ---- */
  if (!cron) {
    const { data: u, error } = await admin.auth.getUser(bearer);
    if (error || !u?.user) return json({ error: "Accesso non valido: rifai l'accesso alla sincronizzazione." }, 401);
    const { data: subs } = await admin.from("push_subscriptions").select("*").eq("app", APP).eq("user_id", u.user.id).eq("enabled", true);
    if (!subs?.length) return json({ error: "Nessun telefono iscritto: attiva prima le notifiche." }, 404);
    const appData = await loadData(u.user.id);
    const results: string[] = [];
    if (reqBody?.test === "pace") { /* v1.86.0 — prova dell'avviso di ritmo */
      for (const s of subs) results.push(await send(s, { title: "⚠️ Ritmo di spesa · prova", body: "🟠 Spesa all'82% della stima\n🟠 Bollette all'85% del budget", tag: "ritmo-prova", url: "./" }));
      return json({ sent: results.filter((r) => r === "ok").length, results });
    }
    if (reqBody?.test === "saldo") { /* v1.94.0 — prova del promemoria "segna il saldo vero" */
      for (const s of subs) {
        const { today } = localNow(s.tz);
        const day = parseISO(today).getUTCDay();
        const msg = balanceReminder({ ...(appData || {}), settings: { ...((appData && appData.settings) || {}), realBalanceDay: day } }, today)
          || { title: "🧾 Segna il saldo vero · prova", body: "Nessun conto da controllare adesso", tag: "saldo-prova", url: "./?view=accounts" };
        results.push(await send(s, msg));
      }
      return json({ sent: results.filter((r) => r === "ok").length, results });
    }
    if (reqBody?.test === "monthly") {
      for (const s of subs) {
        const key = monthBefore(localNow(s.tz).today.slice(0, 7));
        const msg = monthlyMessage(appData, key, s.show_amounts)
          || { title: `📊 ${cap(monthName(key))}`, body: "🧾 Nessun movimento\n📅 Il riepilogo arriva il giorno 1 di ogni mese", tag: "riepilogo-prova", url: "./?view=stats" };
        results.push(await send(s, msg));
      }
      return json({ sent: results.filter((r) => r === "ok").length, results });
    }
    for (const s of subs) {
      const { today, tomorrow } = localNow(s.tz);
      const items = itemsFor(appData, tomorrow);
      const payload = items.length
        ? withRedLines(message(items, s.show_amounts, tomorrow), appData, today, tomorrow, s.show_amounts)
        : { title: "✅ Notifiche attive", body: "📅 Domani nessuna scadenza", tag: "prova", url: "./" };
      results.push(await send(s, payload));
    }
    return json({ sent: results.filter((r) => r === "ok").length, results });
  }

  /* ---- Giro orario dal cron ---- */
  if (!env("CRON_SECRET") || cron !== env("CRON_SECRET")) return json({ error: "Segreto non valido" }, 401);
  const { data: subs, error } = await admin.from("push_subscriptions").select("*").eq("app", APP).eq("enabled", true);
  if (error) return json({ error: error.message }, 500);

  const cache = new Map<string, any>();
  let sent = 0, skipped = 0, monthly = 0, pace = 0, reminders = 0;
  const dataOf = async (uid: string) => {
    if (!cache.has(uid)) cache.set(uid, await loadData(uid));
    return cache.get(uid);
  };
  for (const s of subs || []) {
    const { today, tomorrow, hour } = localNow(s.tz);
    if (hour < (s.notify_hour ?? 20)) { skipped++; continue; }

    // Scadenze di domani (al massimo una volta al giorno)
    if (s.last_sent_day !== today) {
      const items = itemsFor(await dataOf(s.user_id), tomorrow);
      const r = items.length ? await send(s, withRedLines(message(items, s.show_amounts, tomorrow), await dataOf(s.user_id), today, tomorrow, s.show_amounts)) : "nothing";
      if (r === "ok") sent++;
      // Segna il giorno solo se è andata (o non c'era niente): se l'invio fallisce si riprova l'ora dopo.
      if (r === "ok" || r === "nothing") await admin.from("push_subscriptions").update({ last_sent_day: today }).eq("id", s.id);
      if (r === "gone") continue;
      /* v1.86.0 — avvisi di ritmo (stesso giro, una volta al giorno) */
      try { const pa = paceAlerts(await dataOf(s.user_id), today); if (pa.length && (await send(s, paceMessage(pa, today))) === "ok") pace++; } catch (e) { console.error("ritmo", (e as Error).message); }
      /* v1.94.0 — promemoria settimanale "segna il saldo vero" (solo se acceso nei dati) */
      try { const br = balanceReminder(await dataOf(s.user_id), today); if (br && (await send(s, br)) === "ok") reminders++; } catch (e) { console.error("saldo", (e as Error).message); }
      /* v1.94.0 — il 1° gennaio il riepilogo dell'anno appena chiuso (solo se acceso nei dati) */
      try { const yr = yearRecapFor(await dataOf(s.user_id), today, s.show_amounts); if (yr && (await send(s, yr)) === "ok") reminders++; } catch (e) { console.error("anno", (e as Error).message); }
      /* v1.95.0 — tappe del Piano: il giorno prima e il 1° del mese */
      try { const pr = planReminder(await dataOf(s.user_id), today, tomorrow); if (pr && (await send(s, pr)) === "ok") reminders++; } catch (e) { console.error("piano", (e as Error).message); }
    } else skipped++;

    // Riepilogo mensile: il giorno 1, una volta per mese. Solo se la colonna esiste
    // (cioè se è stato eseguito riepilogo_mensile.sql), altrimenti non si potrebbe
    // ricordare di averlo già mandato e partirebbe ogni ora.
    if (today.endsWith("-01") && "last_monthly_sent" in s && s.monthly_summary !== false) {
      const key = monthBefore(today.slice(0, 7));
      if (s.last_monthly_sent !== key) {
        const msg = monthlyMessage(await dataOf(s.user_id), key, s.show_amounts);
        const r = msg ? await send(s, msg) : "nothing";
        if (r === "ok") monthly++;
        if (r === "ok" || r === "nothing") await admin.from("push_subscriptions").update({ last_monthly_sent: key }).eq("id", s.id);
      }
    }
  }
  return json({ sent, monthly, pace, reminders, skipped, total: subs?.length || 0 });
});
