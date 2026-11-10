// suite-ai — l'unico punto in cui le app parlano con il modello.
//
// Perché sta qui e non nelle app: la chiave dell'API non può stare dentro una pagina web,
// chiunque la leggerebbe guardando il codice sorgente. Qui invece vive nei Secrets di
// Supabase e non esce mai dal server.
//
// La chiamano tutte e cinque le app (stesso progetto Supabase), con il token della
// persona collegata alla sincronizzazione: senza quello la funzione non risponde.
//
// Segreti da impostare in Supabase (Edge Functions › Secrets):
//   ANTHROPIC_API_KEY   la chiave presa da platform.claude.com
//   SUITE_AI_MODEL      facoltativo, modello per i compiti di testo (default: claude-haiku-5-5)
//   SUITE_AI_MODEL_FOTO facoltativo, modello per le foto (default: claude-sonnet-5-5)
//   SUITE_AI_EMAILS     facoltativo, elenco di email separate da virgola ammesse a usarla
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY ci sono già.
//
// Pubblicala con "Verify JWT" attivo: così Supabase scarta da sola le chiamate senza token.
//
// v2 (ottobre 2026) — PERCHÉ PRIMA NON ANDAVA
//   I modelli 5.5 "pensano" prima di rispondere (thinking adattivo, acceso di default) e quei
//   pensieri contano dentro max_tokens. Con limiti piccoli (120-400) il modello finiva i token
//   mentre pensava e non scriveva mai il JSON: la funzione rispondeva "risposta non leggibile"
//   e le app mostravano "non ho capito l'importo".
//   Ora: sforzo basso ("effort: low"), margine di token molto più ampio, si legge solo il
//   blocco di testo, il JSON viene estratto anche se c'è testo intorno, e ogni errore
//   torna all'app con un motivo leggibile.

import { createClient } from "npm:@supabase/supabase-js@2";

const env = (k: string) => Deno.env.get(k) ?? "";
const MODEL = env("SUITE_AI_MODEL") || "claude-haiku-5-5";
/* Le foto (scontrini, etichette, capi) chiedono piu' attenzione: di norma usano un
   modello piu' bravo a guardare. Con SUITE_AI_MODEL_FOTO puoi cambiarlo o riportarlo
   a quello piccolo se vuoi spendere meno. */
const MODEL_FOTO = env("SUITE_AI_MODEL_FOTO") || "claude-sonnet-5-5";
/* Margine di token per il ragionamento del modello, oltre a quelli della risposta. */
const MARGINE = 3000;
const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });

/* I compiti sono dichiarati qui: l'app può chiedere solo questi, non scrivere un prompt
   qualsiasi. Ogni compito dice al modello cosa deve tornare, e torna SOLO JSON. */
const SOLO_JSON =
  "Rispondi subito e SOLO con un oggetto JSON valido: niente testo prima o dopo, niente blocchi di codice. " +
  "I numeri sono numeri JSON (35.5), non testo ('35,50').";

const TASKS: Record<string, { system: string; max: number }> = {
  movimento: {
    max: 400,
    system: [
      "Trasformi una frase in italiano in un movimento di cassa.",
      SOLO_JSON,
      "Campi: tipo ('expense' per una spesa, 'income' per un'entrata),",
      "importo (numero positivo in euro, punto come separatore decimale),",
      "data (AAAA-MM-GG; se la frase non la dice usa la data 'oggi' del contesto; 'ieri' = il giorno prima),",
      "descrizione (poche parole, senza l'importo),",
      "categoria (una sola fra quelle elencate nel contesto, con la sua chiave esatta; null se nessuna calza),",
      "conto (la chiave esatta di un conto elencato, null se la frase non lo dice),",
      "sicurezza (da 0 a 1: quanto sei sicuro di aver capito).",
      "Se nella frase non c'è un importo riconoscibile metti importo null e sicurezza 0.",
    ].join(" "),
  },
  categoria: {
    max: 120,
    system: [
      "Scegli la categoria giusta per una spesa o un'entrata.",
      SOLO_JSON,
      "Forma: {\"chiave\": \"...\", \"sicurezza\": 0-1}.",
      "La chiave deve essere una di quelle elencate nel messaggio, copiata esatta.",
      "Se nessuna calza davvero, metti chiave null.",
    ].join(" "),
  },
  reparto: {
    max: 120,
    system: [
      "Scegli il reparto del supermercato (o del negozio) giusto per un prodotto.",
      SOLO_JSON,
      "Forma: {\"chiave\": \"...\", \"sicurezza\": 0-1}.",
      "La chiave deve essere una di quelle elencate nel messaggio, copiata esatta.",
      "Se nessuna calza davvero, metti chiave null.",
    ].join(" "),
  },

  /* ---------- testo libero che diventa dati ---------- */
  lista: {
    max: 1200,
    system: [
      "Trasformi una frase in italiano nell'elenco della spesa.",
      SOLO_JSON,
      "Forma: {\"articoli\": [{\"nome\": \"...\", \"quantita\": 1, \"reparto\": \"chiave\"}]}.",
      "Il nome e' il prodotto senza la quantita' e senza l'unita' di misura.",
      "quantita' e' un numero intero, 1 se la frase non lo dice; \"due pacchi\" vale 2.",
      "reparto e' una delle chiavi elencate nel messaggio, copiata esatta, oppure null.",
      "Non inventare prodotti che la frase non nomina. Al massimo 40 articoli.",
    ].join(" "),
  },
  ricorrente: {
    max: 400,
    system: [
      "Trasformi una frase in italiano in una spesa o entrata che si ripete.",
      SOLO_JSON,
      "Campi: tipo ('expense' o 'income'), importo (numero positivo),",
      "nome (poche parole), frequenza ('monthly', 'weekly', 'yearly' o 'daily'),",
      "giorno (numero del mese 1-31 se la frase lo dice, altrimenti null),",
      "inizio (AAAA-MM-GG, la prima scadenza; usa il contesto per sapere che giorno e' oggi),",
      "categoria (chiave esatta fra quelle elencate, null se nessuna calza),",
      "conto (chiave esatta fra quelli elencati, null se non detto),",
      "sicurezza (0-1).",
      "Se non c'e' un importo riconoscibile metti importo null e sicurezza 0.",
    ].join(" "),
  },
  allenamento: {
    max: 1200,
    system: [
      "Trasformi una frase in italiano in un elenco di esercizi con le loro serie.",
      SOLO_JSON,
      "Forma: {\"esercizi\": [{\"nome\": \"...\", \"serie\": 4, \"ripetizioni\": 8, \"carico\": 60, \"unita\": \"kg\", \"note\": \"\"}]}.",
      "\"panca 4x8 a 60\" significa serie 4, ripetizioni 8, carico 60.",
      "Se un dato manca mettilo a null, non inventarlo. unita' e' 'kg' o 'lb', di norma 'kg'.",
      "Se nel messaggio c'e' un elenco di esercizi conosciuti, usa i loro nomi esatti quando combaciano.",
    ].join(" "),
  },

  /* ---------- foto che diventano dati ---------- */
  scontrino: {
    max: 1600,
    system: [
      "Leggi lo scontrino nella foto.",
      SOLO_JSON,
      "Campi: negozio (nome del negozio, stringa vuota se illeggibile),",
      "data (AAAA-MM-GG, null se non si legge), totale (numero: il TOTALE pagato in fondo allo scontrino), valuta ('EUR' di norma),",
      "voci (elenco di {\"nome\": \"...\", \"quantita\": 1, \"prezzo\": numero del totale di quella riga}),",
      "categoria (chiave esatta fra quelle elencate nel messaggio, null se nessuna calza),",
      "reparto (chiave esatta fra quelle elencate, null) per ogni voce se le chiavi ci sono,",
      "sicurezza (0-1).",
      "Non inventare righe che non si leggono: meglio poche voci giuste che molte inventate.",
      "Se la foto non e' uno scontrino metti totale null e sicurezza 0.",
    ].join(" "),
  },
  capo: {
    max: 500,
    system: [
      "Guardi la foto di un capo di abbigliamento o di un accessorio.",
      SOLO_JSON,
      "Campi: nome (poche parole, es. 'Camicia di lino azzurra'),",
      "tipo (una parola: camicia, pantaloni, scarpe, giacca, borsa...),",
      "colore (il colore principale in italiano), materiale (se riconoscibile, altrimenti null),",
      "stagione ('primavera', 'estate', 'autunno', 'inverno' o 'tutto l'anno'),",
      "tag (fino a 5 parole chiave), sicurezza (0-1).",
      "Se nella foto non c'e' un capo, metti nome null e sicurezza 0.",
    ].join(" "),
  },
  etichetta: {
    max: 600,
    system: [
      "Leggi la tabella nutrizionale nella foto.",
      SOLO_JSON,
      "Campi: nome (il prodotto, stringa vuota se non si legge), per (sempre 100, i valori sono per 100 g o 100 ml),",
      "unita ('g' o 'ml'), kcal, proteine, carboidrati, zuccheri, grassi, grassiSaturi, fibre, sale.",
      "Tutti numeri, null quando il valore non c'e' sull'etichetta.",
      "Se i valori sono dati per porzione, riportali comunque a 100 e dillo in nota.",
      "Aggiungi nota (stringa, vuota se non serve) e sicurezza (0-1).",
    ].join(" "),
  },

  /* ---------- spiegare i numeri ---------- */
  riepilogo: {
    max: 700,
    system: [
      "Spieghi a voce semplice i numeri di chi ti scrive. Parli italiano, dai del tu.",
      SOLO_JSON,
      "Forma: {\"testo\": \"...\", \"punti\": [\"...\"]}.",
      "testo: un paragrafo di 2-4 frasi, concreto, con i numeri veri presi dal contesto.",
      "punti: da 2 a 4 righe brevi su cio' che merita attenzione (sforamenti, cose in arrivo, cambi rispetto ai mesi scorsi).",
      "Usa solo i dati del contesto: non inventare cifre e non fare previsioni presentate come certezze.",
      "Niente consigli di investimento. Se i dati sono pochi, dillo invece di riempire.",
    ].join(" "),
  },

  /* ---------- prova di collegamento (Altro › AI › Prova) ---------- */
  ping: {
    max: 40,
    system: SOLO_JSON + " Forma: {\"ok\": true}.",
  },
};

/* I compiti che guardano una foto. */
const CON_FOTO = new Set(["scontrino", "capo", "etichetta"]);

/* Prende l'oggetto JSON anche se il modello ci ha messo testo intorno o un blocco ```json. */
function estraiJson(raw: string): unknown {
  const t = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try { return JSON.parse(t); } catch { /* proviamo a ritagliarlo */ }
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) {
    try { return JSON.parse(t.slice(a, b + 1)); } catch { /* niente */ }
  }
  return null;
}

/* Una chiamata al modello. Con "sforzo" basso il modello pensa poco (o niente) e risponde subito.
   Se il modello scelto non accetta il parametro (modelli vecchi), si riprova senza. */
async function chiama(key: string, model: string, max: number, system: string, contenuto: unknown[], conSforzo = true) {
  const body: Record<string, unknown> = {
    model,
    max_tokens: max + MARGINE,
    system,
    messages: [{ role: "user", content: contenuto }],
  };
  if (conSforzo) body.output_config = { effort: "low" };
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok && conSforzo && r.status === 400) {
    const t = await r.clone().text();
    if (/output_config|effort/i.test(t)) return chiama(key, model, max, system, contenuto, false);
  }
  return r;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "metodo non previsto" }, 405);

  const key = env("ANTHROPIC_API_KEY");
  if (!key) return json({ ok: false, error: "manca ANTHROPIC_API_KEY nei Secrets di Supabase" }, 500);

  // Solo chi è collegato alla sincronizzazione può usarla.
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ ok: false, error: "serve l'accesso alla sincronizzazione" }, 401);
  const { data: who, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !who?.user) return json({ ok: false, error: "accesso non valido: rientra in Sincronizzazione" }, 401);
  const ammessi = env("SUITE_AI_EMAILS").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (ammessi.length && !ammessi.includes((who.user.email || "").toLowerCase())) {
    return json({ ok: false, error: "questa email non è in SUITE_AI_EMAILS" }, 403);
  }

  let body: { task?: string; testo?: string; opzioni?: unknown; contesto?: unknown; immagine?: { tipo?: string; dati?: string } };
  try { body = await req.json(); } catch { return json({ ok: false, error: "richiesta illeggibile" }, 400); }

  const nomeTask = String(body.task || "");
  const task = TASKS[nomeTask];
  if (!task) return json({ ok: false, error: "compito sconosciuto: " + nomeTask.slice(0, 30) }, 400);

  const conFoto = CON_FOTO.has(nomeTask);
  const img = body.immagine;
  if (conFoto && !(img && img.dati)) return json({ ok: false, error: "serve una foto" }, 400);
  if (img && img.dati) {
    const tipi = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!tipi.includes(String(img.tipo || ""))) return json({ ok: false, error: "formato foto non previsto" }, 400);
    // ~4,6 MB in base64 = ~3,5 MB di foto: oltre non serve e costa.
    if (img.dati.length > 4_600_000) return json({ ok: false, error: "foto troppo grande" }, 413);
  }

  const testo = String(body.testo || "").slice(0, 4000);
  if (!testo.trim() && !conFoto && nomeTask !== "riepilogo" && nomeTask !== "ping") {
    return json({ ok: false, error: "testo vuoto" }, 400);
  }
  const contesto = JSON.stringify(body.contesto ?? {}).slice(0, 12000);
  const opzioni = JSON.stringify(body.opzioni ?? []).slice(0, 8000);

  const userMsg =
    (testo.trim() ? `Frase: ${testo}\n` : "") +
    (opzioni !== "[]" ? `Scelte possibili (chiave: nome): ${opzioni}\n` : "") +
    (contesto !== "{}" ? `Contesto: ${contesto}\n` : "") +
    (conFoto ? "Guarda la foto qui sopra e rispondi su quella.\n" : "");

  const contenuto: unknown[] = [];
  if (img && img.dati) {
    contenuto.push({ type: "image", source: { type: "base64", media_type: img.tipo, data: img.dati } });
  }
  contenuto.push({ type: "text", text: userMsg || "Rispondi secondo le istruzioni." });

  const modello = conFoto ? MODEL_FOTO : MODEL;
  let r: Response;
  try {
    r = await chiama(key, modello, task.max, task.system, contenuto);
  } catch (e) {
    return json({ ok: false, error: "non riesco a raggiungere il modello", dettaglio: String(e) }, 502);
  }

  if (!r.ok) {
    const t = await r.text();
    let motivo = "";
    try { motivo = JSON.parse(t)?.error?.message || ""; } catch { /* testo semplice */ }
    const breve =
      r.status === 401 ? "chiave ANTHROPIC_API_KEY non valida" :
      r.status === 404 ? `modello "${modello}" non trovato (controlla SUITE_AI_MODEL)` :
      r.status === 429 ? "troppe richieste o credito esaurito" :
      r.status === 529 ? "modello sovraccarico, riprova tra poco" :
      `il modello ha rifiutato la richiesta (${r.status})`;
    return json({ ok: false, error: breve, stato: r.status, dettaglio: (motivo || t).slice(0, 300) }, 502);
  }

  const out = await r.json();
  // Si legge solo il testo: i blocchi di ragionamento ("thinking") non contengono la risposta.
  const raw = (out?.content || [])
    .filter((c: { type?: string }) => c.type === "text")
    .map((c: { text?: string }) => c.text || "")
    .join("")
    .trim();
  if (!raw) {
    const perche = out?.stop_reason === "max_tokens" ? "il modello ha finito lo spazio prima di rispondere" : "risposta vuota";
    return json({ ok: false, error: perche, stop: out?.stop_reason || null }, 502);
  }
  const dati = estraiJson(raw);
  if (dati === null || typeof dati !== "object") {
    return json({ ok: false, error: "risposta non leggibile", grezzo: raw.slice(0, 300) }, 502);
  }

  return json({ ok: true, dati, modello });
});
