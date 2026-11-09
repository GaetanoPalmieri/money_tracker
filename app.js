/* =========================================================
   Bilancio — logica app
   Stato persistito in localStorage, nessuna dipendenza esterna.
   ========================================================= */

const STORAGE_KEY = "bilancio_v1";
const THEME_KEY = "bilancio_theme";
const MESI = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
const MESI_BREVI = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];
const FREQ_LABEL = { weekly: "Ogni settimana", monthly: "Ogni mese", bimonthly:"Ogni 2 mesi", quarterly:"Ogni 3 mesi", semiannual:"Ogni 6 mesi", yearly: "Ogni anno" };

const PALETTE = ["#1F5D4C","#3AA684","#D4A83A","#A8322D","#6B7FD7","#C25B9E","#4FA8C9","#8A6A16","#5B7553","#946638","#E67E5F","#7A5CFA","#D84C7F","#159C9C","#B06428","#546E7A"];
const EMOJIS = ["🛒","🚗","💡","🏠","💊","🎬","👕","✈️","📚","🐾","☕","🍽️","🎁","💰","➕","📱","🏋️","🧾","🎓","🐶","🍔","🍕","🚌","🚆","⛽","🧾","💻","🎮","🎵","🎓","🏥","🧑‍💼","🏦","💳","🎯","🪙","📦","🔧","🌱","🎁","👶","🐱"];

/* ---------------- Utilities ---------------- */
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
function pad2(n){ return String(n).padStart(2,"0"); }
function todayISO(){ const d=new Date(); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
/* Formato importi unico della suite (suite.js): 1.234,56 € */
function fmt(n){
  if(window.SuiteFmt) return SuiteFmt.money(n);
  const v = Math.round((n||0)*100)/100;
  return v.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "\u00a0€";
}
function fmtSigned(n){ return (n>=0?"+":"−") + fmt(Math.abs(n)); }
/* v1.10.9 — Con il saldo nascosto le cifre dei grafici diventano pallini (non spariscono). */
function maskAmt(text,dots="••••"){ return balancesHidden ? dots : text; }
function parseAmount(str){
  if(!str) return 0;
  // legge anche "1.234,56" (punto delle migliaia) senza scambiarlo per 1,234
  const v = window.SuiteFmt ? SuiteFmt.parse(str) : parseFloat(String(str).replace(/[€\s]/g,"").replace(",","."));
  return isNaN(v) ? 0 : Math.abs(v);
}
/* v1.39.0 — La casella dell'importo è larga esattamente quanto la cifra (misurata col font vero),
   così cifra e simbolo € restano uniti e centrati. */
let _amtCanvas=null;
function fitAmountInput(el){
  if(!el) return;
  try{
    const cs=getComputedStyle(el);
    _amtCanvas=_amtCanvas||document.createElement("canvas");
    const ctx=_amtCanvas.getContext("2d");
    ctx.font=`${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const txt=el.value||el.placeholder||"0";
    const ls=parseFloat(cs.letterSpacing)||0;
    const w=Math.ceil(ctx.measureText(txt).width+ls*txt.length)+6;
    el.style.width=Math.max(w,Math.ceil(ctx.measureText("00").width))+"px";
  }catch(e){ el.style.width=Math.max(2,el.value.length+1)+"ch"; }
}
function autoGrowAmountInput(el){
  const grow = ()=>fitAmountInput(el);
  el.addEventListener("input", grow);
  grow(); requestAnimationFrame(grow);
}
document.addEventListener("input",e=>{ if(e.target?.matches?.(".amount-field input")) fitAmountInput(e.target); },true);
function stepDateISO(iso, freq, anchorISO=iso){
  const d = new Date(iso+"T00:00:00");
  const anchor = new Date(anchorISO+"T00:00:00");
  if(freq==="weekly"){
    d.setDate(d.getDate()+7);
  } else {
    const months = freq==="yearly" ? 12 : freq==="bimonthly" ? 2 : freq==="quarterly" ? 3 : freq==="semiannual" ? 6 : 1;
    const anchorDay = anchor.getDate();
    const anchorLastDay = new Date(anchor.getFullYear(), anchor.getMonth()+1, 0).getDate();
    const anchorIsEndOfMonth = anchorDay===anchorLastDay;
    const target = new Date(d.getFullYear(), d.getMonth()+months, 1);
    const targetLastDay = new Date(target.getFullYear(), target.getMonth()+1, 0).getDate();
    target.setDate(anchorIsEndOfMonth ? targetLastDay : Math.min(anchorDay, targetLastDay));
    d.setTime(target.getTime());
  }
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}

/* ---------------- Default seed data ---------------- */
function seedState(){
  const accId = { cash: uid(), bbva: uid(), fineco: uid(), ca: uid() };
  const macroId = { giornaliere: uid(), casa: uid(), trasporti: uid(), salute: uid(), entrate: uid() };
  const catId = { spesa: uid(), trasporti: uid(), bollette: uid(), casa: uid(), salute: uid(), svago: uid(), stipendio: uid(), altreEntrate: uid() };
  return {
    accounts: [
      { id: accId.cash, name: "Contanti", balance: 0, color: PALETTE[7] },
      { id: accId.bbva, name: "BBVA", balance: 0, color: PALETTE[0] },
      { id: accId.fineco, name: "Fineco", balance: 0, color: PALETTE[6] },
      { id: accId.ca, name: "Credit Agricole", balance: 0, color: PALETTE[3] },
    ],
    macroCategories: [
      { id: macroId.giornaliere, name: "Spese giornaliere", emoji: "🛒", color: PALETTE[1], budget: 400, kind:"expense" },
      { id: macroId.casa, name: "Casa e utenze", emoji: "🏠", color: PALETTE[4], budget: null, kind:"expense" },
      { id: macroId.trasporti, name: "Trasporti", emoji: "🚗", color: PALETTE[2], budget: null, kind:"expense" },
      { id: macroId.salute, name: "Salute e benessere", emoji: "💊", color: PALETTE[5], budget: null, kind:"expense" },
      { id: macroId.entrate, name: "Entrate", emoji: "💰", color: PALETTE[0], budget: null, kind:"income" },
    ],
    categories: [
      { id: catId.spesa, name: "Spesa", emoji: "🛒", color: PALETTE[1], kind: "expense", budget: 300, macroCategoryId: macroId.giornaliere },
      { id: catId.trasporti, name: "Trasporti", emoji: "🚗", color: PALETTE[2], kind: "expense", budget: 100, macroCategoryId: macroId.trasporti },
      { id: catId.bollette, name: "Bollette", emoji: "💡", color: PALETTE[3], kind: "expense", budget: 150, macroCategoryId: macroId.casa },
      { id: catId.casa, name: "Casa", emoji: "🏠", color: PALETTE[4], kind: "expense", budget: null, macroCategoryId: macroId.casa },
      { id: catId.salute, name: "Salute", emoji: "💊", color: PALETTE[5], kind: "expense", budget: null, macroCategoryId: macroId.salute },
      { id: catId.svago, name: "Svago", emoji: "🎬", color: PALETTE[6], kind: "expense", budget: 80, macroCategoryId: macroId.giornaliere },
      { id: catId.stipendio, name: "Stipendio", emoji: "💰", color: PALETTE[0], kind: "income", budget: null, macroCategoryId: macroId.entrate },
      { id: catId.altreEntrate, name: "Altre entrate", emoji: "➕", color: PALETTE[7], kind: "income", budget: null, macroCategoryId: macroId.entrate },
    ],
    recurring: [],
    transactions: [],
    planned: [],
    estimates: [],
    salaryPlans: [],
    loanRates: [],
    trash: [],
    mainAccountId: null,
  };
}

/* ---------------- State load/save ---------------- */
const TRASH_MAX_ITEMS = 100;
const TRASH_RETENTION_DAYS = 90;
const BACKUP_WARNING_DAYS = 30;
let balanceCache = new Map();
let state = load();
let balancesHidden = false; // v1.56.0: all'apertura le cifre sono visibili (l'occhio le nasconde finché resta aperta l'app)
function load(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return seedState();
    const parsed = JSON.parse(raw);
    if(!parsed.accounts || !parsed.categories) return seedState();
    return migrate(parsed);
  }catch(e){ return seedState(); }
}
function migrate(parsed){
  // Aggiunge le macrocategorie a stati salvati prima della loro introduzione.
  if(!Array.isArray(parsed.macroCategories)) parsed.macroCategories = [];
  parsed.macroCategories.forEach(m=>{
    if(m.budget===undefined) m.budget = null;
    if(!m.kind){
      const linked=parsed.categories.find(c=>c.macroCategoryId===m.id);
      m.kind=linked?.kind || (/entrate|stipendio/i.test(m.name)?"income":"expense");
    }
  });
  parsed.categories.forEach(c=>{ if(c.macroCategoryId===undefined) c.macroCategoryId = null; });
  // v1.37.0 — sottocategorie: un solo livello, e ereditano tipo e macro dalla madre.
  {
    const byId = Object.fromEntries((parsed.categories||[]).map(c=>[c.id,c]));
    (parsed.categories||[]).forEach(c=>{
      if(c.parentCategoryId===undefined) c.parentCategoryId = null;
      const p = c.parentCategoryId ? byId[c.parentCategoryId] : null;
      if(!p || p.id===c.id || p.parentCategoryId){ c.parentCategoryId = null; return; }
      c.kind = p.kind;
      c.macroCategoryId = p.macroCategoryId || null;
    });
  }
  // v1.25.1: la categoria automatica "Pagate da altri" non serve più; se non è mai stata usata la tolgo.
  { const used=new Set([...(parsed.transactions||[]),...(parsed.recurring||[]),...(parsed.planned||[]),...(parsed.trash||[]).map(x=>x&&(x.item||x.tx||x))].map(x=>x&&x.categoryId).filter(Boolean));
    parsed.categories=parsed.categories.filter(c=>!(c.otherPaidDefault&&!used.has(c.id)));
    parsed.categories.forEach(c=>{ if(c.otherPaidDefault) delete c.otherPaidDefault; }); }
  if(!Array.isArray(parsed.recurring)) parsed.recurring = [];
  parsed.recurring.forEach(r=>{
    if(r.active===undefined) r.active=true;
    if(r.endDate===undefined) r.endDate="";
    if(r.maxOccurrences===undefined) r.maxOccurrences=null;
  });
  if(!Array.isArray(parsed.planned)) parsed.planned = [];
  if(!Array.isArray(parsed.loanRates)) parsed.loanRates = [];
  if(!Array.isArray(parsed.estimates)) parsed.estimates = [];
  if(!Array.isArray(parsed.salaryPlans)) parsed.salaryPlans = [];
  if(!Array.isArray(parsed.trash)) parsed.trash = [];
  if(parsed.mainAccountId===undefined) parsed.mainAccountId = null;
  if(parsed.savingsAccountId===undefined) parsed.savingsAccountId = null;
  if(parsed.savingsTarget===undefined) parsed.savingsTarget = null;
  if(parsed.betAccountId===undefined) parsed.betAccountId = null; /* v1.69.0 — conto Scommesse */
  if(parsed.mainAccountId && !parsed.accounts.some(a=>String(a.id)===String(parsed.mainAccountId))) parsed.mainAccountId = null;
  parsed.trash = pruneTrashArray(parsed.trash);
  sanitizeLoadedState(parsed);
  fixData168(parsed);
  fixData169(parsed);
  // I modelli rapidi sono stati sostituiti da categorie/macrocategorie: rimuovi eventuali residui.
  delete parsed.templates;
  return parsed;
}
/* v1.68.0 — CORREZIONI DEI DATI UNA TANTUM (ok di Gaetano del 2/11; analisi/analisi-dati-2026-11-02.md §5).
   1) Le 4 entrate "Stipendio" senza nome del 21-22/09 erano i soldi già presenti sui conti quando hai cominciato a usare
      l'app: diventano "Rettifica saldo", come i due "Fondi già presenti" del 23/09. I saldi non cambiano; le entrate di
      settembre scendono di 753,65 € (Statistiche, Analisi, R&P).
   2) "Accantonamento su TR": il budget da 500 € di una categoria mai usata gonfiava i budget della Home. Ora il risparmio
      sono i depositi contrassegnati (1.67.0): budget tolto (la categoria resta).
   Ogni movimento si riconosce dall'id E da data, importo, conto e categoria: se non corrisponde (già cambiato da te o
   backup di un altro telefono) non si tocca. Una sola volta: il segno resta nei dati (dataFixes, viaggia con backup e
   sincronizzazione). NON fatto in automatico: JetCredit su Credit Agricole (devi confermare da che conto esce), affitto
   del 2/11 su Fineco o BBVA, stipendio di novembre, saldo Poste (servono i dati della banca). */
/* NB: load() gira prima che il resto del file sia letto: qui niente const/let esterni (sarebbero ancora "non pronti"),
   i dati stanno dentro la funzione e il risultato in una var. */
var fix168Result; /* senza "=null": questa riga arriva dopo load() e cancellerebbe il risultato */
function fixData168(data){
  const FIX168_STIPENDIO_CAT="mubfc571r9yyb1";
  const FIX168_ADJ=[
    {id:"mubgmxpgw8rr62",date:"2026-09-21",amount:116.5,accountId:"mubfc571hagnau"}, /* BBVA */
    {id:"mubgn5on429wyf",date:"2026-09-21",amount:400,accountId:"mubfefpcrqqape"},   /* TR */
    {id:"mubu6jzr203ikb",date:"2026-09-22",amount:207.15,accountId:"mubfeppcniffk9"}, /* Wise */
    {id:"muce52at4z0q9r",date:"2026-09-22",amount:30,accountId:"mubfc5712o0610"},     /* Contanti */
  ];
  const FIX168_BUDGET_CAT={id:"mvtq0twrfjbde9",name:"Accantonamento su TR",budget:500};
  if(!data || typeof data!=="object") return null;
  if(!data.dataFixes || typeof data.dataFixes!=="object" || Array.isArray(data.dataFixes)) data.dataFixes={};
  if(data.dataFixes["1.68.0"]) return null;
  const done={adj:[],adjTotal:0,budget:false};
  const tx=Array.isArray(data.transactions)?data.transactions:[];
  FIX168_ADJ.forEach(f=>{
    const t=tx.find(x=>x&&x.id===f.id);
    if(!t) return;
    const same=t.type==="income" && !t.isBalanceAdjustment && t.categoryId===FIX168_STIPENDIO_CAT && t.date===f.date &&
      Math.abs(Number(t.amount)-f.amount)<0.005 && t.accountId===f.accountId && !String(t.name||"").trim() && !t.recurringId && !t.plannedId;
    if(!same) return;
    t.name="Rettifica saldo";
    t.categoryId=null;
    t.isBalanceAdjustment=true;
    t.note='Soldi già presenti sul conto (prima registrati come entrata "Stipendio")';
    done.adj.push(f.id); done.adjTotal+=f.amount;
  });
  const c=(Array.isArray(data.categories)?data.categories:[]).find(x=>x&&x.id===FIX168_BUDGET_CAT.id);
  if(c && c.name===FIX168_BUDGET_CAT.name && Math.abs(Number(c.budget)-FIX168_BUDGET_CAT.budget)<0.005){
    const used=[...(data.transactions||[]),...(data.recurring||[]),...(data.planned||[]),...(data.estimates||[])].some(x=>x&&x.categoryId===c.id);
    if(!used){ c.budget=null; done.budget=true; }
  }
  data.dataFixes["1.68.0"]=new Date().toISOString().slice(0,10);
  if(done.adj.length||done.budget){ fix168Result=done; return done; }
  return null;
}
/* v1.69.0 — CONTO SCOMMESSE (analisi 2/11 §1.4, ok di Gaetano del 3/11: "un conto Scommesse, sarebbe Revolut").
   Revolut diventa il conto "Scommesse" (etichetta "Revolut"): i soldi del gioco stanno lì, così il saldo torna senza
   rettifiche e le statistiche mostrano il risultato vero del gioco.
     · ricarica del conto gioco = trasferimento dal conto da cui paghi (es. BBVA) → Scommesse;
     · vincita / prelievo dal gioco = entrata "Bet" sul conto Scommesse;
     · soldi che porti in banca = trasferimento Scommesse → banca.
   Solo nome, etichetta e colore (TR e Revolut avevano lo stesso colore): saldo e movimenti non cambiano. Se Revolut non
   c'è si crea un conto Scommesse vuoto. Una volta sola (dataFixes["1.69.0"], viaggia con backup e sincronizzazione). */
var fix169Result;
function fixData169(data){
  if(!data || typeof data!=="object" || !Array.isArray(data.accounts)) return null;
  if(!data.dataFixes || typeof data.dataFixes!=="object" || Array.isArray(data.dataFixes)) data.dataFixes={};
  if(data.dataFixes["1.69.0"]) return null;
  const liquid=data.accounts.filter(a=>a && !a.receivable && !a.payable && !a.archived);
  let acc=liquid.find(a=>/^\s*revolut\b/i.test(String(a.name||""))) || liquid.find(a=>/revolut/i.test(String(a.name||"")+" "+String(a.label||"")));
  const already=liquid.find(a=>/^\s*scommesse\s*$/i.test(String(a.name||"")));
  let created=false, renamed=false, recolored=false;
  if(already && !acc) acc=already;
  if(!acc){
    acc={id:uid(),name:"Scommesse",label:"Revolut",balance:0,color:"#7A5CFA"};
    data.accounts.push(acc); created=true;
  } else if(!/^\s*scommesse\s*$/i.test(String(acc.name||""))){
    if(!String(acc.label||"").trim()) acc.label=String(acc.name||"Revolut").trim().slice(0,40);
    acc.name="Scommesse"; renamed=true;
  }
  /* colore diverso da tutti gli altri conti (prima Revolut e TR erano uguali) */
  const used=new Set(data.accounts.filter(a=>a!==acc).map(a=>String(a.color||"").toLowerCase()));
  if(used.has(String(acc.color||"").toLowerCase())){
    const pick=["#7A5CFA","#D84C7F","#E67E5F","#159C9C","#C25B9E","#B06428"].find(c=>!used.has(c.toLowerCase()));
    if(pick){ acc.color=pick; recolored=true; }
  }
  data.betAccountId=acc.id;
  data.dataFixes["1.69.0"]=new Date().toISOString().slice(0,10);
  fix169Result={created,renamed,recolored,label:acc.label||""};
  return fix169Result;
}
function fix169Notice(){
  const r=fix169Result; if(!r) return;
  fix169Result=null;
  persist();
  let seen=false; try{ seen=localStorage.getItem("bilancio_fix169_toast")==="1"; }catch(_){}
  if(seen) return;
  try{ localStorage.setItem("bilancio_fix169_toast","1"); }catch(_){}
  setTimeout(()=>showToastLong(r.created?"Nuovo conto Scommesse: ricariche = trasferimento verso Scommesse, vincite = entrata \"Bet\" su Scommesse.":`${r.label||"Revolut"} ora è il conto Scommesse: ricariche = trasferimento verso Scommesse, vincite = entrata "Bet" su Scommesse. Saldo invariato.`),1200);
}
/* v1.69.0 — categorie del gioco (Scommesse, Bet...): il conto proposto è il conto Scommesse */
function isBetCategory(catId){
  const c=categoriesById()[rollUpCategoryId(catId)]||categoriesById()[catId];
  return !!(c && /scommess|^\s*bet\b|gioco|vincit/i.test(String(c.name||"")));
}
function betAccount(){ return state.accounts.find(a=>a.id===state.betAccountId&&!isLoanAccount(a))||null; }
function fix168Notice(){
  /* un solo avviso per telefono, appena l'app è pronta; il salvataggio porta la correzione anche agli altri telefoni */
  const r=fix168Result; if(!r) return;
  fix168Result=null;
  persist();
  let seen=false; try{ seen=localStorage.getItem("bilancio_fix168_toast")==="1"; }catch(_){}
  if(seen) return;
  try{ localStorage.setItem("bilancio_fix168_toast","1"); }catch(_){}
  const parts=[];
  if(r.adj.length) parts.push(`${r.adj.length} entrate "Stipendio" del 21-22/09 (${fmt(r.adjTotal)}) ora sono Rettifica saldo`);
  if(r.budget) parts.push(`tolto il budget di "Accantonamento su TR"`);
  setTimeout(()=>showToastLong(`Dati sistemati: ${parts.join("; ")}. Saldi invariati.`),900);
}
function showToastLong(message){
  showToast(message);
  const toast=document.getElementById("appToast");
  if(toast){ clearTimeout(toast._timer); toast._timer=setTimeout(()=>toast.classList.remove("show"),6500); }
}
function sanitizeLoadedState(data){
  const text=(value,max=240)=>String(value ?? "").slice(0,max);
  const id=value=>text(value,120);
  const date=(value,fallback="")=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||""))?String(value):fallback;
  const amount=value=>{const n=Number(value);return Number.isFinite(n)?Math.abs(n):0;};
  const signed=value=>{const n=Number(value);return Number.isFinite(n)?n:0;};
  data.accounts=(Array.isArray(data.accounts)?data.accounts:[]).map(a=>({...a,id:id(a.id),name:text(a.name,120),label:text(a.label,40).trim(),balance:signed(a.balance),color:safeColor(a.color,PALETTE[0])}));
  data.mainAccountId=data.mainAccountId==null?null:id(data.mainAccountId);
  if(data.mainAccountId && !data.accounts.some(a=>a.id===data.mainAccountId)) data.mainAccountId=null;
  // v1.46.0 — conto risparmio e quanto metterci ogni mese
  data.savingsAccountId=data.savingsAccountId==null?null:id(data.savingsAccountId);
  if(data.savingsAccountId && !data.accounts.some(a=>a.id===data.savingsAccountId)) data.savingsAccountId=null;
  data.savingsTarget=data.savingsTarget==null||!(Number(data.savingsTarget)>0)?null:amount(data.savingsTarget);
  data.betAccountId=data.betAccountId==null?null:id(data.betAccountId);
  if(data.betAccountId && !data.accounts.some(a=>a.id===data.betAccountId)) data.betAccountId=null;
  data.macroCategories=(Array.isArray(data.macroCategories)?data.macroCategories:[]).map(m=>({...m,id:id(m.id),name:text(m.name,120),emoji:text(m.emoji,12),color:safeColor(m.color,PALETTE[0]),kind:m.kind==="income"?"income":"expense",budget:m.budget==null?null:amount(m.budget)}));
  data.categories=(Array.isArray(data.categories)?data.categories:[]).map(c=>({...c,id:id(c.id),name:text(c.name,120),emoji:text(c.emoji,12),color:safeColor(c.color,PALETTE[0]),kind:c.kind==="income"?"income":"expense",budget:c.budget==null?null:amount(c.budget),macroCategoryId:c.macroCategoryId==null?null:id(c.macroCategoryId),parentCategoryId:c.parentCategoryId==null?null:id(c.parentCategoryId)}));
  data.transactions=(Array.isArray(data.transactions)?data.transactions:[]).map(t=>({...t,id:id(t.id),date:date(t.date,todayISO()),amount:amount(t.amount),type:["income","expense","transfer"].includes(t.type)?t.type:"expense",name:text(t.name,160),note:text(t.note,500),categoryId:t.categoryId==null?null:id(t.categoryId),accountId:t.accountId==null?null:id(t.accountId),toAccountId:t.toAccountId==null?null:id(t.toAccountId),recurringId:t.recurringId==null?undefined:id(t.recurringId),plannedId:t.plannedId==null?undefined:id(t.plannedId)}));
  // v1.67.0 — "Deposito di risparmio": solo true e solo sui trasferimenti
  data.transactions.forEach(t=>{ if(t.savingsDeposit!==true||t.type!=="transfer") delete t.savingsDeposit; });
  // v1.70.0 — stima collegata a mano: solo sulle uscite
  data.transactions.forEach(t=>{ if(t.estimateId!=null&&t.estimateId!==""&&t.type==="expense") t.estimateId=id(t.estimateId); else delete t.estimateId; });
  const freqs=new Set(["weekly","monthly","bimonthly","quarterly","semiannual","yearly"]);
  data.recurring=(Array.isArray(data.recurring)?data.recurring:[]).map(r=>({...r,id:id(r.id),name:text(r.name,160),note:text(r.note,500),amount:amount(r.amount),type:r.type==="income"?"income":"expense",categoryId:r.categoryId==null?null:id(r.categoryId),accountId:r.accountId==null?null:id(r.accountId),freq:freqs.has(r.freq)?r.freq:"monthly",startDate:date(r.startDate,todayISO()),nextDate:date(r.nextDate,date(r.startDate,todayISO())),endDate:date(r.endDate,""),active:r.active!==false,maxOccurrences:Number.isFinite(Number(r.maxOccurrences))&&Number(r.maxOccurrences)>0?Math.floor(Number(r.maxOccurrences)):null}));
  data.loanRates=(Array.isArray(data.loanRates)?data.loanRates:[]).filter(r=>r&&r.accId).map(r=>({id:id(r.id||uid()),accId:id(r.accId),date:date(r.date,todayISO()),amount:amount(r.amount),n:Number(r.n)||1,of:Number(r.of)||0}));
  data.planned=(Array.isArray(data.planned)?data.planned:[]).map(p=>({...p,id:id(p.id),name:text(p.name,160),note:text(p.note,500),amount:amount(p.amount),type:p.type==="income"?"income":"expense",categoryId:p.categoryId==null?null:id(p.categoryId),accountId:p.accountId==null?null:id(p.accountId),date:date(p.date,todayISO()),recurringId:p.recurringId==null?undefined:id(p.recurringId)}));
  // v1.51.0 — stime mensili
  data.estimates=(Array.isArray(data.estimates)?data.estimates:[]).filter(e=>e&&/^\d{4}-\d{2}$/.test(String(e.month||""))).map(e=>({id:id(e.id||uid()),month:String(e.month),name:text(e.name,160),amount:amount(e.amount),categoryId:e.categoryId==null||e.categoryId===""?null:id(e.categoryId),note:text(e.note,500)}));
  data.salaryPlans=(Array.isArray(data.salaryPlans)?data.salaryPlans:[]).filter(p=>p&&/^\d{4}-\d{2}$/.test(String(p.month||""))).map(p=>({month:String(p.month),salary:p.salary==null||p.salary===""?null:amount(p.salary),items:(Array.isArray(p.items)?p.items:[]).filter(i=>i&&i.macroId!=null&&amount(i.amount)>0).map(i=>({macroId:id(i.macroId),amount:amount(i.amount)}))}));
}
function pruneTrashArray(items){
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate()-TRASH_RETENTION_DAYS);
  const cutoffISO = `${cutoff.getFullYear()}-${pad2(cutoff.getMonth()+1)}-${pad2(cutoff.getDate())}`;
  return (Array.isArray(items)?items:[])
    .filter(entry=>!entry.deletedAt || String(entry.deletedAt).slice(0,10)>=cutoffISO)
    .slice(0,TRASH_MAX_ITEMS);
}
function safeSetLocalStorage(key,value,{notify=true}={}){
  try{
    localStorage.setItem(key,value);
    return true;
  }catch(err){
    console.error("Impossibile salvare in localStorage",err);
    if(notify) showToast("Spazio di archiviazione esaurito: esporta un backup e libera spazio");
    return false;
  }
}
function persist(){
  pruneSplitOrphans();
  balanceCache.clear();
  state.trash = pruneTrashArray(state.trash);
  state.updatedAt = new Date().toISOString();
  const ok = safeSetLocalStorage(STORAGE_KEY, JSON.stringify(state));
  if(ok && window.syncBilancio) syncBilancio.changed();
  return ok;
}
function toggleBalances(){balancesHidden=!balancesHidden;safeSetLocalStorage("bilancio_hide_balances",balancesHidden?"1":"0",{notify:false});renderAll();}
function moveToTrash(kind, item, companions=[]){
  if(!Array.isArray(state.trash)) state.trash=[];
  const entry={id:uid(),kind,data:JSON.parse(JSON.stringify(item)),deletedAt:todayISO()};
  if(companions.length) entry.companions=JSON.parse(JSON.stringify(companions));
  state.trash.unshift(entry);
  state.trash=pruneTrashArray(state.trash);
}
function restoreTrashItem(trashId){
  const entry=state.trash.find(x=>x.id===trashId); if(!entry) return;
  if(entry.kind==="transaction"){ state.transactions.push(entry.data); (entry.companions||[]).forEach(c=>{ if(!state.transactions.some(x=>x.id===c.id)) state.transactions.push(c); }); }
  if(entry.kind==="planned") state.planned.push(entry.data);
  if(entry.kind==="recurring") state.recurring.push(entry.data);
  state.trash=state.trash.filter(x=>x.id!==trashId);
  sanitizeLoadedState(state);
  if(entry.kind==="recurring") refreshRecurringTransactions(String(entry.data.id));
  if(entry.kind==="planned") generatePlannedTransactions();
  persist();renderAll();
}

/* ---------------- Tema (chiaro/scuro/sistema) ---------------- */
const systemDarkMQ = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
function effectiveTheme(mode){
  if(mode==="system") return (systemDarkMQ && systemDarkMQ.matches) ? "dark" : "light";
  return mode;
}
function applyTheme(mode){
  const theme = effectiveTheme(mode);
  document.documentElement.setAttribute("data-theme", theme);
  const themeMeta=document.querySelector('meta[name="theme-color"]');
  if(themeMeta) themeMeta.setAttribute("content", theme==="dark" ? "#12181F" : "#F1F2ED");
  document.querySelectorAll("#themeModeToggle .type-opt").forEach(opt=>{
    opt.classList.toggle("active", opt.dataset.themeMode===mode);
  });
}
let currentThemeMode = localStorage.getItem(THEME_KEY) || "system";
applyTheme(currentThemeMode);
if(systemDarkMQ){
  systemDarkMQ.addEventListener("change", ()=>{
    if(currentThemeMode==="system") applyTheme(currentThemeMode);
  });
}

/* ---------------- View / month state ---------------- */
const now = new Date();
let viewYear = now.getFullYear();
let viewMonth = now.getMonth(); // 0-indexed
let activeView = "home";
let txFilter = "all";
let txSearchQuery="", txDateFrom="", txDateTo="";
let txCatFilter="", txAccFilter=""; /* v1.65.0 — filtri veloci dei Movimenti */
let anlMonth=null, anlMode="tot"; /* v1.66.0 — Analisi a bolle */
const TX_PAGE_SIZE=50;
let txVisibleLimit=TX_PAGE_SIZE;
let txSearchTimer=null;
let rpMode = "total";
let viewDay = now.getDate();
const periodModes = {home:"month", recurring:"month", estimates:"month", stats:"month", transactions:"month", rpall:"month"};
let rpAllKind="total", rpAllQuery="";
function selectedDate(){return `${viewYear}-${pad2(viewMonth+1)}-${pad2(viewDay)}`;}
/* v1.7.0 — Periodo: mese intero, singolo giorno oppure intervallo di giorni (anche tra mesi diversi). */
let periodRange={from:null,to:null};
function periodBounds(view){
  const mode=periodModes[view]||"month";
  if(mode==="day"){const d=selectedDate();return {from:d,to:d};}
  if(mode==="range" && periodRange.from && periodRange.to) return {from:periodRange.from,to:periodRange.to};
  return {from:`${viewYear}-${pad2(viewMonth+1)}-01`,to:`${viewYear}-${pad2(viewMonth+1)}-${pad2(new Date(viewYear,viewMonth+1,0).getDate())}`};
}
function inPeriod(view,iso){ if(!iso) return false; const b=periodBounds(view); return iso>=b.from && iso<=b.to; }
function shortDate(iso,withYear=false){const d=new Date(iso+"T00:00:00");return `${d.getDate()} ${MESI_BREVI[d.getMonth()].toLowerCase()}${withYear?" "+d.getFullYear():""}`;}
function periodLabel(view){
  const mode=periodModes[view]||"month";
  if(mode==="day"){const d=new Date(selectedDate()+"T00:00:00");const wd=["Dom","Lun","Mar","Mer","Gio","Ven","Sab"][d.getDay()];return `${wd} ${d.getDate()} ${MESI[d.getMonth()].toLowerCase()} ${d.getFullYear()}`;}
  if(mode==="range" && periodRange.from){
    const a=new Date(periodRange.from+"T00:00:00"), b=new Date(periodRange.to+"T00:00:00");
    if(a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth()) return `${a.getDate()}–${b.getDate()} ${MESI[a.getMonth()].toLowerCase()} ${a.getFullYear()}`;
    return `${shortDate(periodRange.from,a.getFullYear()!==b.getFullYear())} – ${shortDate(periodRange.to,true)}`;
  }
  return `${MESI[viewMonth]} ${viewYear}`;
}
function periodSubLabel(view){const m=periodModes[view]||"month";return m==="day"?"Solo questo giorno":m==="range"?"Periodo scelto":"Tutto il mese";}
function monthsInPeriod(view){
  const b=periodBounds(view); const out=[];
  let d=new Date(b.from+"T00:00:00"); d=new Date(d.getFullYear(),d.getMonth(),1);
  const end=new Date(b.to+"T00:00:00");
  while(d<=end && out.length<36){out.push([d.getFullYear(),d.getMonth()]);d=new Date(d.getFullYear(),d.getMonth()+1,1);}
  return out;
}
function plannedItemsInPeriod(view){
  return monthsInPeriod(view).flatMap(([y,m])=>plannedItemsForMonth(y,m)).filter(t=>inPeriod(view,t.date));
}
function periodTx(view){
  if((periodModes[view]||"month")==="month") return monthTx();
  return state.transactions.filter(t=>inPeriod(view,t.date));
}
function sumTransactions(tx){
  // v1.12.5: rettifiche di saldo e prestiti vecchi (fuori saldo) non sono entrate né uscite del periodo.
  const real=tx.filter(t=>!t.isBalanceAdjustment&&!t.loanOld);
  const income=real.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0);
  const expense=real.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);
  return {income,expense,net:income-expense};
}
/* Colore delle cifre: verde se positiva, rosso se negativa, grigio scuro sullo zero
   (le cifre neutre non azzerate restano sul grigio chiaro definito nel CSS). */
function moneyColor(value){return value>0?"var(--emerald)":value<0?"var(--rust)":"var(--num-zero)";}

let txType = "expense";
let selectedCategoryId = null;
let selectedAccountId = null;
let statsGroupMode = "category", statsNature="expense";

/* ---------------- Helpers on state ---------------- */
function accountsById(){ return Object.fromEntries(state.accounts.map(a=>[a.id,a])); }
function categoriesById(){ return Object.fromEntries(state.categories.map(c=>[c.id,c])); }
function macroCategoriesById(){ return Object.fromEntries(state.macroCategories.map(m=>[m.id,m])); }

/* ===================== v1.37.0 — Sottocategorie =====================
   Tre livelli: macrocategoria › categoria › sottocategoria.
   Esempio: Tempo libero › Viaggi › Mangiare fuori.
   Una sottocategoria è una categoria con parentCategoryId valorizzato: eredita
   tipo e macrocategoria dalla madre, e si ferma lì (niente quarto livello).
   I movimenti puntano alla sottocategoria, ma nelle somme contano nella madre. */
function isSubCategory(c){ return !!(c && c.parentCategoryId); }
function subCategoriesOf(catId){ return state.categories.filter(c=>c.parentCategoryId===catId); }
function topCategories(kind){ return state.categories.filter(c=>c.kind===kind && !c.parentCategoryId); }
/* La categoria "di conto": per una sottocategoria è la madre, per le altre è se stessa. */
function rollUpCategoryId(catId){
  const c=categoriesById()[catId];
  return c && c.parentCategoryId ? c.parentCategoryId : (catId||null);
}
/* Tutti gli id che contano in una categoria: lei più le sue sottocategorie. */
function categoryIdsWithin(catId){ return [catId, ...subCategoriesOf(catId).map(c=>c.id)]; }
/* Catena completa, dal più grande al più piccolo. */
function categoryChain(catId){
  const cats=categoriesById(), macros=macroCategoriesById();
  const c=cats[catId]; if(!c) return [];
  const parent=c.parentCategoryId?cats[c.parentCategoryId]:null;
  const macro=macros[(parent||c).macroCategoryId]||null;
  return [macro, parent, c].filter(Boolean);
}
/* Nomi che compaiono più di una volta fra macro, categorie e sottocategorie dello
   stesso tipo: solo per questi serve mostrare il percorso. */
function ambiguousCategoryNames(){
  const norm=n=>String(n||"").trim().toLocaleLowerCase("it");
  const count=new Map();
  const bump=(n,kind)=>{ const k=kind+"|"+norm(n); count.set(k,(count.get(k)||0)+1); };
  state.macroCategories.forEach(m=>bump(m.name,m.kind||"expense"));
  state.categories.forEach(c=>bump(c.name,c.kind||"expense"));
  const out=new Set();
  count.forEach((v,k)=>{ if(v>1) out.add(k); });
  return out;
}
/* Etichetta da mostrare: solo il nome, oppure "Madre › Nome" quando quel nome
   esiste anche altrove. Così chi non ha doppioni non vede mai percorsi lunghi. */
function categoryLabel(catId,opts){
  const o=opts||{};
  const cats=categoriesById(), c=cats[catId];
  if(!c) return "";
  if(!c.parentCategoryId && !o.sempre) return c.name;
  const amb=o.ambigue||ambiguousCategoryNames();
  const chiave=(c.kind||"expense")+"|"+String(c.name).trim().toLocaleLowerCase("it");
  const parent=c.parentCategoryId?cats[c.parentCategoryId]:null;
  if(!parent) return c.name;
  return (o.sempre||amb.has(chiave)) ? `${parent.name} › ${c.name}` : c.name;
}
/* Vero se questo nome, con questa madre, creerebbe un doppione poco chiaro. */
function categoryNameClash(name,kind,ignoreId){
  const norm=n=>String(n||"").trim().toLocaleLowerCase("it");
  const n=norm(name);
  if(!n) return null;
  const m=state.macroCategories.find(x=>(x.kind||"expense")===kind && norm(x.name)===n);
  if(m) return {tipo:"macro",nome:m.name};
  const c=state.categories.find(x=>x.id!==ignoreId && (x.kind||"expense")===kind && norm(x.name)===n);
  if(c) return {tipo:c.parentCategoryId?"sotto":"categoria",nome:c.name};
  return null;
}

/* v1.43.0 — Pulsante di scelta: mostra la scelta attuale e apre un menu piccolo (SuitePop). */
function pickButton({label,emoji="",value="",empty="Scegli",onOpen}){
  const b=document.createElement("button");
  b.type="button"; b.className="pick-btn";
  b.innerHTML=`<span class="pb-em" aria-hidden="true">${escapeHtml(emoji||"")}</span><span class="pb-tx"><small>${escapeHtml(label)}</small><b class="${value?"":"pb-empty"}">${escapeHtml(value||empty)}</b></span><span class="pb-chev" aria-hidden="true">▾</span>`;
  if(!emoji) b.querySelector(".pb-em").remove();
  b.setAttribute("aria-label",`${label}: ${value||empty}`);
  b.addEventListener("click",()=>onOpen&&onOpen(b));
  return b;
}
/* v1.44.0 — Conti a menu in tutti i pannelli: le chip dei conti restano (nascoste) e fanno
   da "motore"; sopra compare un pulsante di scelta che apre il menu piccolo. Così ogni
   pannello che già disegnava le chip dei conti funziona senza riscrivere la sua logica. */
const ACC_CHIP_IDS=["accountChips","destinationAccountChips","transferFromChips","transferToChips","loanAccounts","atmFromChips","atmToChips","recurringAccountChips","plannedAccountChips"];
function syncAccPicker(cont){
  if(!cont||!cont.isConnected) return;
  const chips=[...cont.children].filter(c=>c.classList&&c.classList.contains("chip"));
  const row=cont.closest(".field-row");
  const lab=row?row.querySelector(":scope > label"):null;
  const label=(lab?lab.textContent.trim():"")||"Conto";
  if(row && !row.classList.contains("acc-pick-row")) row.classList.add("acc-pick-row");
  if(!cont.classList.contains("acc-chips-engine")) cont.classList.add("acc-chips-engine");
  let holder=cont._accHolder;
  if(!holder){ holder=document.createElement("div"); holder.className="acc-pick"; cont.before(holder); cont._accHolder=holder; }
  const info=c=>{ const em=c.querySelector(".em"); return {name:c.textContent.replace(/^\s*●\s*/,"").trim(),color:em?em.style.color:""}; };
  const act=chips.find(c=>c.classList.contains("active"));
  const ai=act?info(act):null;
  holder.innerHTML="";
  if(!chips.length){ holder.hidden=true; return; }
  holder.hidden=false;
  const btn=pickButton({label,emoji:ai?"●":"",value:ai?ai.name:"",empty:"Scegli il conto",onOpen:b=>openPick(b,label,
    chips.map((c,i)=>{ const x=info(c); return {key:i,emoji:"●",color:x.color,label:x.name,active:c===act}; }),
    i=>{ const c=chips[i]; if(c&&c.isConnected) c.click(); else { const now=[...cont.children].filter(x=>x.classList.contains("chip")); now[i]?.click(); } })});
  if(ai&&ai.color){ const e=btn.querySelector(".pb-em"); if(e) e.style.color=ai.color; }
  holder.appendChild(btn);
}
(function watchAccountChips(){
  const root=document.getElementById("overlayRoot"); if(!root) return;
  const hook=()=>{ ACC_CHIP_IDS.forEach(id=>{ root.querySelectorAll("#"+id).forEach(cont=>{
    if(cont._accObs) return;
    cont._accObs=new MutationObserver(()=>syncAccPicker(cont));
    cont._accObs.observe(cont,{childList:true,subtree:true,attributes:true,attributeFilter:["class"]});
    syncAccPicker(cont);
  }); }); };
  new MutationObserver(hook).observe(root,{childList:true});
})();
function openPick(anchor,title,items,onPick){
  if(window.SuitePop) return SuitePop.open(anchor,{title,items,onPick});
}
/* v1.43.0 — Categoria con pulsanti: Macrocategoria · Categoria · Sottocategoria.
   Ogni pulsante apre un menu piccolo; prima erano tre righe di chip sparse nel pannello.
   onSelect(id,{user:true}) quando la scelta la fai tu. */
/* v1.69.0 — SCELTA DELLA CATEGORIA RIFATTA, uguale in Movimento, Ricorrente e Pianificato (entrata e uscita).
   Prima: nel Movimento 8 icone + un pulsante "Altre" che a volte si chiamava "Altre" e a volte prendeva il nome della
   categoria scelta (che spesso l'app aveva scelto da sola: la prima della lista), poi due tendine Macro/Categoria; in
   Ricorrente e Pianificato solo le due tendine. Ora:
     · in alto quale categoria hai scelto (con la macrocategoria), oppure "da scegliere": niente più scelte automatiche;
     · le 8 che usi di più come icone, un tocco;
     · "Tutte le categorie" apre l'elenco completo diviso per macrocategoria, con la ricerca; il pulsante si chiama
       sempre così (o "Chiudi l'elenco");
     · se la categoria ha sottocategorie, sotto compaiono le sue (Nessuna o una sottocategoria). */
function catFrequentIds(kind,n){
  const cats=categoriesById(), since=new Date(Date.now()-120*86400000).toISOString().slice(0,10), cnt=new Map();
  const bump=(id,w)=>{ const top=rollUpCategoryId(id), c=cats[top]; if(c&&c.kind===kind) cnt.set(top,(cnt.get(top)||0)+w); };
  state.transactions.forEach(t=>{ if(t.type===kind&&!t.isBalanceAdjustment&&t.date>=since&&t.categoryId) bump(t.categoryId,1); });
  (state.recurring||[]).forEach(r=>{ if(r.type===kind&&r.active!==false&&r.categoryId) bump(r.categoryId,1); });
  (state.planned||[]).forEach(p=>{ if(p.type===kind&&p.categoryId) bump(p.categoryId,1); });
  const ids=[...cnt.entries()].sort((a,b)=>b[1]-a[1]).map(x=>x[0]).slice(0,n);
  topCategories(kind).forEach(c=>{ if(ids.length<n&&!ids.includes(c.id)) ids.push(c.id); });
  return ids;
}
function renderCategoryPicker(container, kind, getSelected, onSelect){
  const cats=categoriesById(), macros=macroCategoriesById();
  const selId=getSelected(), sel=cats[selId]&&cats[selId].kind===kind?cats[selId]:null;
  const top=sel?(sel.parentCategoryId?cats[sel.parentCategoryId]:sel):null;
  const macro=top&&top.macroCategoryId?macros[top.macroCategoryId]:null;
  const freq=catFrequentIds(kind,8), open=!!container._open;
  const rer=()=>renderCategoryPicker(container,kind,getSelected,onSelect);
  const tile=(c,on,cls)=>`<button type="button" class="mcat-t${cls?" "+cls:""}${on?" on":""}" data-mcat="${escapeHtml(c.id)}" data-no-icon style="--c:${safeColor(c.color)}" aria-pressed="${on}"><span class="mcat-ic">${emojiIconHtml(c.emoji||"•")}</span><span class="mcat-nm">${escapeHtml(c.name)}</span></button>`;
  container.classList.add("mcat");
  container.classList.remove("cat-pick");
  let html=`<div class="mcat-h"><span class="mcat-lab">Categoria</span>`+
    (sel?`<span class="mcat-sel" style="--c:${safeColor((top||sel).color)}"><span class="mcat-ic">${emojiIconHtml(sel.emoji||(top&&top.emoji)||"•")}</span><span class="mcat-st"><b>${escapeHtml(categoryLabel(sel.id,{sempre:!!sel.parentCategoryId}))}</b>${macro?`<small>${escapeHtml(macro.emoji||"")} ${escapeHtml(macro.name)}</small>`:""}</span></span>`
      :`<span class="mcat-none">da scegliere</span>`)+`</div>`;
  html+=`<div class="mcat-grid">`+freq.map(id=>tile(cats[id],!!top&&top.id===id)).join("")+`</div>`;
  const subs=top?subCategoriesOf(top.id):[];
  if(top&&subs.length){
    html+=`<div class="mcat-subs"><span class="mcat-subs-l">Dentro ${escapeHtml(top.name)}</span><div class="mcat-subs-r">`+
      `<button type="button" class="mcat-sub${sel&&!sel.parentCategoryId?" on":""}" data-mcat-sub="${escapeHtml(top.id)}" data-no-icon>Nessuna</button>`+
      subs.map(s=>`<button type="button" class="mcat-sub${sel&&sel.id===s.id?" on":""}" data-mcat-sub="${escapeHtml(s.id)}" data-no-icon>${escapeHtml((s.emoji?s.emoji+" ":"")+s.name)}</button>`).join("")+`</div></div>`;
  }
  html+=`<button type="button" class="mcat-more${open?" on":""}" data-mcat-more data-no-icon aria-expanded="${open}">${open?"Chiudi l’elenco":"Tutte le categorie"}<span aria-hidden="true">${open?"▴":"▾"}</span></button>`;
  if(open) html+=`<div class="mcat-all"><label class="mcat-q"><span aria-hidden="true">🔎</span><input type="search" placeholder="Cerca una categoria" autocomplete="off" data-mcat-q value="${escapeHtml(container._q||"")}"></label><div class="mcat-list" data-mcat-list></div></div>`;
  container.innerHTML=html;
  const paintList=()=>{
    const box=container.querySelector("[data-mcat-list]"); if(!box) return;
    const q=String(container._q||"").trim().toLocaleLowerCase("it");
    const list=topCategories(kind);
    const groups=new Map();
    list.forEach(c=>{
      const m=c.macroCategoryId&&macros[c.macroCategoryId]?c.macroCategoryId:"none";
      const hay=(c.name+" "+(m!=="none"?macros[m].name:"")+" "+subCategoriesOf(c.id).map(s=>s.name).join(" ")).toLocaleLowerCase("it");
      if(q&&!hay.includes(q)) return;
      if(!groups.has(m)) groups.set(m,[]); groups.get(m).push(c);
    });
    const order=state.macroCategories.map(m=>m.id).filter(id=>groups.has(id)); if(groups.has("none")) order.push("none");
    box.innerHTML=order.length?order.map(m=>{ const mm=m==="none"?{emoji:"🏷️",name:"Senza macrocategoria"}:macros[m];
      return `<div class="mcat-g"><p class="mcat-gh">${escapeHtml(mm.emoji||"")} ${escapeHtml(mm.name)}</p><div class="mcat-gl">${groups.get(m).map(c=>tile(c,!!top&&top.id===c.id,"sm")).join("")}</div></div>`; }).join("")
      :`<p class="mcat-empty">Nessuna categoria con “${escapeHtml(container._q||"")}”</p>`;
  };
  paintList();
  container.onclick=e=>{
    const t=e.target.closest("[data-mcat],[data-mcat-sub],[data-mcat-more]"); if(!t||!container.contains(t)) return;
    if(t.hasAttribute("data-mcat-more")){ container._open=!open; container._q=""; rer(); if(!open){ const qi=container.querySelector("[data-mcat-q]"); if(qi) setTimeout(()=>{ try{ qi.focus({preventScroll:true}); }catch(_){ } },60); } return; }
    const id=t.getAttribute("data-mcat")||t.getAttribute("data-mcat-sub");
    if(t.hasAttribute("data-mcat")) container._open=false;
    onSelect(id,{user:true}); rer();
  };
  const qi=container.querySelector("[data-mcat-q]");
  if(qi) qi.addEventListener("input",()=>{ container._q=qi.value; paintList(); });
}
function monthTx(y=viewYear, m=viewMonth){
  const prefix = `${y}-${pad2(m+1)}`;
  return state.transactions.filter(t=>t.date.startsWith(prefix));
}
function accountBalance(accId){
  if(balanceCache.has(accId)) return balanceCache.get(accId);
  const start = state.accounts.find(a=>a.id===accId)?.balance || 0;
  const delta = state.transactions.reduce((sum,t)=>{
    if(t.type==="transfer") return sum + (t.accountId===accId ? -t.amount : t.toAccountId===accId ? t.amount : 0);
    if(t.accountId!==accId) return sum;
    return sum + (t.type==="income" ? t.amount : -t.amount);
  },0);
  const value=start+delta;
  balanceCache.set(accId,value);
  return value;
}
function totalBalance(){
  return state.accounts.reduce((sum,a)=> sum + accountBalance(a.id), 0);
}
/* v1.11.1 — Totale attuale = soldi sui conti; crediti = conti "Da ricevere"; effettivo = attuale + crediti. */
function receivableTotal(){ return state.accounts.filter(a=>a.receivable).reduce((s,a)=>s+accountBalance(a.id),0); }
function liquidBalance(){ return state.accounts.filter(a=>!a.receivable&&!a.payable).reduce((s,a)=>s+accountBalance(a.id),0); }
function accountBalanceAtDate(accId, iso){
  // Saldo del conto al termine della giornata iso (incluso).
  const acc = state.accounts.find(a=>a.id===accId);
  if(!acc) return 0;
  const delta = state.transactions.reduce((sum,t)=>{
    if(t.date>iso) return sum;
    if(t.type==="transfer") return sum + (t.accountId===accId ? -t.amount : t.toAccountId===accId ? t.amount : 0);
    if(t.accountId!==accId) return sum;
    return sum + (t.type==="income" ? t.amount : -t.amount);
  },0);
  return acc.balance + delta;
}
function totalBalanceAtDate(iso){return state.accounts.reduce((sum,a)=>sum+accountBalanceAtDate(a.id,iso),0);}
function previousISO(iso){const d=new Date(iso+"T00:00:00");d.setDate(d.getDate()-1);return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;}

function recurringOccurrenceIndex(r,date){
  if(!r?.startDate || !date) return null;
  let d=r.startDate, index=1, safety=0;
  while(d<date && safety<2000){ d=stepDateISO(d,r.freq,r.startDate); index++; safety++; }
  return d===date ? index : null;
}
function recurringDateWithinLimits(r,date){
  if(!date) return false;
  if(r.endDate && date>r.endDate) return false;
  const max=Number(r.maxOccurrences)||0;
  if(max>0){
    const index=recurringOccurrenceIndex(r,date);
    if(!index || index>max) return false;
  }
  return true;
}
function recurringDurationLabel(r){
  const max=Number(r?.maxOccurrences)||0;
  if(max>0) return `${max} ${max===1?"rata":"rate"}`;
  if(r?.endDate) return `Fino al ${r.endDate.split("-").reverse().join("/")}`;
  return "Senza scadenza";
}

/* ---------------- Movimenti ricorrenti ---------------- */
/* v1.43.0 — Pagare (estinguere) prima della data.
   Ricorrente: la rata in arrivo si registra oggi (con earlyFor = la sua data) e il ricorrente
   resta com'è, dalla rata successiva. Pianificato: si registra oggi e sparisce. */
function recurringPrepaid(r,date){ return state.transactions.some(t=>t.recurringId===r.id && t.earlyFor===date); }
function recurringNextDue(r){
  if(!r || r.active===false) return null;
  let d=r.nextDate||r.startDate, safety=0;
  while(d && recurringPrepaid(r,d) && safety<60){ d=stepDateISO(d,r.freq,r.startDate); safety++; }
  if(!d || d<=todayISO() || !recurringDateWithinLimits(r,d)) return null;
  return d;
}
async function payRecurringNow(id){
  const r=state.recurring.find(x=>x.id===id); if(!r) return;
  const due=recurringNextDue(r);
  if(!due){ showToast("Nessuna rata futura da pagare"); return; }
  if(!await askConfirm(`Pagare oggi la rata del ${shortDate(due)} di “${r.name||"ricorrente"}” (${fmt(r.amount)})? Il ricorrente resta attivo dalle rate successive.`,{ok:"Paga ora",danger:false})) return;
  const prevNext=r.nextDate;
  const tx=pushScheduledTx(r,{id:uid(),date:todayISO(),amount:r.amount,type:r.type,categoryId:r.categoryId,accountId:r.accountId,name:r.name||"",note:r.note||"",recurringId:r.id,earlyFor:due});
  if(r.nextDate===due || (r.nextDate||"")<=due) r.nextDate=stepDateISO(due,r.freq,r.startDate);
  persist(); renderAll();
  showActionToastOrUndo(`Rata del ${shortDate(due)} pagata oggi`,()=>{ state.transactions=state.transactions.filter(t=>t.id!==tx.id); r.nextDate=prevNext; persist(); renderAll(); });
}
/* v1.44.0 — Annullare un pagamento anticipato (tieni premuto sul movimento pagato oggi):
   il movimento sparisce e la rata torna al suo posto, alla data originale. */
async function undoEarlyPayment(txId){
  const t=state.transactions.find(x=>x.id===txId); if(!t||!t.earlyFor) return;
  const r=t.recurringId?state.recurring.find(x=>x.id===t.recurringId):null;
  if(!await askConfirm(`Annullare il pagamento di oggi? “${t.name||"Movimento"}” torna ${r?"ricorrente":"pianificato"} per il ${shortDate(t.earlyFor)}.`,{ok:"Annulla pagamento",danger:false})) return;
  const before=JSON.parse(JSON.stringify({tx:t,next:r?r.nextDate:null,linked:t.splitGroup?linkedTx(t):[]}));
  state.transactions=state.transactions.filter(x=>x.id!==txId&&!(t.splitGroup&&x.splitGroup===t.splitGroup));
  let plannedBack=null;
  if(r){
    if(!r.nextDate || t.earlyFor<r.nextDate) r.nextDate=t.earlyFor;
  } else {
    const snap=t.plannedSnapshot||{};
    plannedBack={...snap,id:t.plannedId||snap.id||uid(),name:t.name,amount:snap.amount??t.amount,type:t.type,categoryId:t.categoryId,accountId:t.accountId,note:t.note||"",date:t.earlyFor};
    if(!state.planned.some(p=>p.id===plannedBack.id)) state.planned.push(plannedBack);
  }
  generateRecurringTransactions(); generatePlannedTransactions();
  persist(); renderAll();
  showActionToastOrUndo(`Pagamento annullato: di nuovo in programma il ${shortDate(t.earlyFor)}`,()=>{
    if(plannedBack) state.planned=state.planned.filter(p=>p.id!==plannedBack.id);
    if(r) r.nextDate=before.next;
    state.transactions=state.transactions.filter(x=>!(x.recurringId&&r&&x.recurringId===r.id&&x.date===before.tx.earlyFor));
    state.transactions.push(before.tx,...before.linked); persist(); renderAll();
  });
}
/* v1.45.0 — Spostare una pianificata già diventata movimento (la sua data è arrivata):
   si apre il pannello della pianificata con i suoi dati; salvando con la nuova data il movimento
   sparisce dai recenti e la pianificata torna in programma. "Annulla" nel messaggio rimette tutto. */
function moveRealizedPlanned(txId){
  const t=state.transactions.find(x=>x.id===txId); if(!t||!t.plannedId) return;
  const snap=t.plannedSnapshot||{};
  const tomorrow=(()=>{const d=new Date(todayISO()+"T12:00:00");d.setDate(d.getDate()+1);return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;})();
  const base={...snap,id:t.plannedId,name:t.name||snap.name||"",amount:snap.amount??(t.splitGroup?groupTotal(groupParts(t.splitGroup)):t.amount),type:t.type,categoryId:t.categoryId,accountId:t.accountId,note:t.note||"",date:t.date>todayISO()?t.date:tomorrow};
  openPlannedForm(null,base,{moveTxId:t.id});
}
async function payPlannedNow(id){
  const p=state.planned.find(x=>x.id===id); if(!p) return;
  if(!await askConfirm(`Pagare oggi “${p.name||"pianificata"}” (${fmt(p.amount)}) previsto il ${shortDate(p.date)}? Viene registrato oggi e non resta più in programma.`,{ok:"Paga ora",danger:false})) return;
  const copy={...p};
  const tx=pushScheduledTx(p,{id:uid(),date:todayISO(),amount:p.amount,type:p.type,categoryId:p.categoryId,accountId:p.accountId,name:p.name||"",note:p.note||"",plannedId:p.id,earlyFor:p.date,plannedSnapshot:copy});
  state.planned=state.planned.filter(x=>x.id!==id);
  persist(); renderAll();
  showActionToastOrUndo(`“${p.name||"Pianificata"}” pagata ed estinta`,()=>{ state.transactions=state.transactions.filter(t=>t.id!==tx.id); state.planned.push(copy); persist(); renderAll(); });
}
function generateRecurringTransactions(askConfirmation=false){
  const todayStr = todayISO();
  const due=state.recurring.filter(r=>{const next=r.nextDate||r.startDate;return r.active!==false && next && next<=todayStr && recurringDateWithinLimits(r,next);});
  if(askConfirmation && due.length && !confirm(`Oggi verranno registrati: ${due.slice(0,4).map(r=>r.name||"Ricorrente").join(", ")}${due.length>4?" e altri":""}. Confermi?`)) return;
  let changed = false;
  state.recurring.forEach(r=>{
    if(!r.nextDate) r.nextDate = r.startDate;
    let safety = 0;
    while(r.active!==false && r.nextDate <= todayStr && recurringDateWithinLimits(r,r.nextDate) && safety < 1000){
      if(!state.transactions.some(t=>t.recurringId===r.id && (t.date===r.nextDate || t.earlyFor===r.nextDate))){
        pushScheduledTx(r,{
          id: uid(), date: r.nextDate, amount: r.amount, type: r.type,
          categoryId: r.categoryId, accountId: r.accountId, name:r.name || "", note: r.note || "", recurringId: r.id,
        });
      }
      r.nextDate = stepDateISO(r.nextDate, r.freq, r.startDate);
      changed = true;
      safety++;
    }
  });
  if(changed) persist();
}
function refreshRecurringTransactions(recurringId){
  const rec = state.recurring.find(r=>r.id===recurringId);
  if(!rec) return;
  const today = todayISO();
  // Lo storico già contabilizzato è immutabile: una modifica alla ricorrenza
  // cambia solo l'occorrenza odierna (se ancora dovuta) e quelle future.
  state.transactions = state.transactions.filter(t=>t.recurringId!==recurringId || t.date<today || t.earlyFor);
  rec.nextDate = rec.startDate;
  let safety=0;
  while(rec.nextDate && rec.nextDate<today && safety<2000){
    rec.nextDate = stepDateISO(rec.nextDate, rec.freq, rec.startDate);
    safety++;
  }
  generateRecurringTransactions();
}
function removeRecurring(recurringId){
  const today=todayISO();
  state.recurring = state.recurring.filter(r=>r.id!==recurringId);
  state.planned = state.planned.filter(p=>p.recurringId!==recurringId);
  // Eliminare la regola non deve cancellare la contabilità storica già registrata.
  state.transactions = state.transactions.filter(t=>t.recurringId!==recurringId || t.date<today);
}

/* ---------------- Spese pianificate (una tantum + proiezione ricorrenti future) ---------------- */
function generatePlannedTransactions(){
  // Quando arriva la data prevista (compreso oggi), la pianificata diventa un movimento reale.
  // Il plannedId resta sul movimento per poterla mostrare nello storico "Pagati nel mese".
  const todayStr = todayISO();
  let changed = false;
  state.planned = state.planned.filter(p=>{
    if(p.date <= todayStr){
      if(!state.transactions.some(t=>t.plannedId===p.id && t.date===p.date)){
        pushScheduledTx(p,{
          id: uid(), date: p.date, amount: p.amount, type: p.type,
          categoryId: p.categoryId, accountId: p.accountId, name:p.name || "", note: p.note || "",
          plannedId: p.id, plannedSnapshot: {...p},
        });
      }
      changed = true;
      return false;
    }
    return true;
  });
  if(changed) persist();
}
function recurringOccurrencesInMonth(r, y, m){
  if(r.active===false) return [];
  // Date (future, non ancora generate) in cui un ricorrente cadrà nel mese y-m.
  const monthStart = `${y}-${pad2(m+1)}-01`;
  const monthEnd = `${y}-${pad2(m+1)}-31`;
  const dates = [];
  let d = r.nextDate;
  let safety = 0;
  while(d && d<=monthEnd && safety<500){
    if(!recurringDateWithinLimits(r,d)) break;
    if(d>=monthStart && !recurringPrepaid(r,d)) dates.push(d);
    d = stepDateISO(d, r.freq, r.startDate);
    safety++;
  }
  return dates;
}
function plannedItemsForMonth(y=viewYear, m=viewMonth){
  // Elenco "virtuale" (non incide sul saldo) delle spese pianificate visibili nel mese y-m:
  // una tantum con data in quel mese + prossime occorrenze dei ricorrenti che cadono in quel mese.
  const prefix = `${y}-${pad2(m+1)}`;
  const once = state.planned.filter(p=>p.date.startsWith(prefix)).map(p=>({
    id: "planned_"+p.id, plannedId: p.id, date: p.date, amount: myAmount(p), fullAmount: p.amount, type: p.type,
    categoryId: p.categoryId, accountId: p.accountId, name:p.name || "", note: p.note || "", planned: true,
  }));
  const recurringOcc = [];
  state.recurring.forEach(r=>{
    recurringOccurrencesInMonth(r,y,m).forEach(date=>{
      recurringOcc.push({
        id: "rec_"+r.id+"_"+date, recurringId: r.id, date, amount: myAmount(r), fullAmount: r.amount, type: r.type,
        categoryId: r.categoryId, accountId: r.accountId, name:r.name || "", note: r.note || "", planned: true,
      });
    });
  });
  return [...once, ...recurringOcc];
}
// v1.17.0: tutte le pianificate e le ricorrenti ancora da registrare da oggi fino a endISO,
// anche se cadono in mesi diversi (serve al saldo previsto dei mesi futuri).
function pendingPlannedUntil(endISO){
  const today=todayISO();
  if(!endISO || endISO<today) return [];
  let y=Number(today.slice(0,4)), m=Number(today.slice(5,7))-1;
  const ey=Number(endISO.slice(0,4)), em=Number(endISO.slice(5,7))-1;
  const out=[]; let safety=0;
  while((y<ey || (y===ey && m<=em)) && safety<240){
    out.push(...plannedItemsForMonth(y,m));
    m++; if(m>11){m=0;y++;} safety++;
  }
  return out.filter(t=>t.date>=today && t.date<=endISO);
}
function plannedItemsForDate(iso){
  const y = parseInt(iso.slice(0,4),10), m = parseInt(iso.slice(5,7),10)-1;
  return plannedItemsForMonth(y,m).filter(t=>t.date===iso);
}

/* ---------------- Rendering: header ---------------- */
function renderHeader(){
  const daily=periodModes[activeView]==="day";
  {const lbl=document.getElementById("monthLabel");
  lbl.innerHTML=`<span class="pl-main">${periodLabel(activeView)}</span><span class="pl-sub">${periodSubLabel(activeView)} ▾</span>`;
  lbl.classList.toggle("is-day",periodModes[activeView]!=="month");}
  document.getElementById("monthLabel").setAttribute("aria-label",(daily?"Stai vedendo un solo giorno":"Stai vedendo tutto il mese")+". Tocca per cambiare");
  document.getElementById("periodDate").value=selectedDate();
  document.getElementById("periodReturn").hidden=true;
  document.getElementById("periodX").hidden=true;
  document.getElementById("dayControl").hidden=!daily;
  document.getElementById("prevMonth").setAttribute("aria-label",daily?"Giorno precedente":"Mese precedente");
  document.getElementById("nextMonth").setAttribute("aria-label",daily?"Giorno successivo":"Mese successivo");
  document.querySelectorAll("[data-period]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.period===periodModes[activeView])));
  const today=new Date();
  const isCurrentMonth=viewYear===today.getFullYear()&&viewMonth===today.getMonth();
  const showBackToCurrent=(activeView==="home"||activeView==="recurring"||activeView==="estimates")&&!isCurrentMonth;
  document.getElementById("backToCurrentMonth").hidden=!showBackToCurrent;
}

function isStandalonePWA(){
  return Boolean(window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone===true);
}
function renderMainAccountSetupNotice(){
  const notice=document.getElementById("mainAccountSetupNotice");
  if(!notice) return;
  const missing=!state.mainAccountId || !state.accounts.some(a=>a.id===state.mainAccountId);
  notice.hidden=!(missing && isStandalonePWA() && state.accounts.length>0);
}

/* Icona occhio per mostra/nascondi importi (v1.3.21). */
function setEyeIcon(btn,hidden,showLabel,hideLabel){
  if(!btn) return;
  const open='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const closed='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.9 17.9A10.4 10.4 0 0 1 12 19C5.6 19 2 12 2 12a18.6 18.6 0 0 1 5.1-5.9"/><path d="M9.9 5.2A9.6 9.6 0 0 1 12 5c6.4 0 10 7 10 7a18.7 18.7 0 0 1-2.2 3.2"/><path d="M14.1 14.2a3 3 0 1 1-4.2-4.2"/><path d="M2 2l20 20"/></svg>';
  btn.innerHTML=hidden?closed:open;
  btn.setAttribute("aria-label",hidden?(showLabel||"Mostra importi"):(hideLabel||"Nascondi importi"));
  /* L'occhio fisso in alto a destra segue sempre lo stesso stato. */
  const fixed=document.getElementById("toggleBalanceFixed");
  if(fixed && btn!==fixed) setEyeIcon(fixed,hidden);
}

/* v1.46.0 — Etichette dei conti e conto risparmio. */
const ACCOUNT_LABELS=["Spese quotidiane","Stipendio","Risparmio","Investimenti","Carta di credito","Contanti","Bollette"];
function accountBadges(a){
  return (a.id===state.mainAccountId?` <span class="main-account-badge">Principale</span>`:"")+
    (a.id===state.savingsAccountId?` <span class="main-account-badge savings-badge">Risparmio</span>`:"")+
    (a.id===state.betAccountId&&!/scommess/i.test(String(a.name||""))?` <span class="main-account-badge bet-badge">Scommesse</span>`:""); /* v1.69.0 */
}
/* v1.67.0 — RISPARMIO SOLO SE CONTRASSEGNATO. Prima il risparmio del mese era la somma di tutti i bonifici verso il
   conto risparmio (meno quelli in uscita): anche i soldi spostati lì solo di passaggio diventavano "risparmio".
   Ora conta SOLO un trasferimento che contrassegni tu come "Deposito di risparmio" (interruttore nel modulo del
   trasferimento, campo savingsDeposit sul movimento: viaggia con backup e sincronizzazione). Senza contrassegno → niente.
   I prelievi dal conto risparmio non tolgono nulla: decidi tu cosa è un deposito. */
function isSavingsDeposit(t){ return !!(t && t.type==="transfer" && t.savingsDeposit===true && !t.loanOld && !t.planned); }
function monthRangeISO(y,m){ return {from:`${y}-${pad2(m+1)}-01`, to:`${y}-${pad2(m+1)}-31`}; }
function savingsDepositsInMonth(y,m){
  const {from,to}=monthRangeISO(y,m);
  return state.transactions.filter(t=>isSavingsDeposit(t)&&t.date>=from&&t.date<=to);
}
function savingsInMonth(y,m){
  return savingsDepositsInMonth(y,m).reduce((s,t)=>s+t.amount,0);
}
/* trasferimenti verso il conto risparmio NON contrassegnati (per ricordarti che non contano) */
function savingsUnflaggedInMonth(y,m){
  const sid=state.savingsAccountId; if(!sid) return [];
  const {from,to}=monthRangeISO(y,m);
  return state.transactions.filter(t=>t.type==="transfer"&&t.toAccountId===sid&&t.accountId!==sid&&!t.savingsDeposit&&!t.loanOld&&t.date>=from&&t.date<=to);
}
function renderSavingsBlock(){
  const block=document.getElementById("savingsBlock"); if(!block) return;
  const acc=state.accounts.find(a=>a.id===state.savingsAccountId);
  block.hidden=!acc;
  if(!acc) return;
  const deps=savingsDepositsInMonth(viewYear,viewMonth), unflag=savingsUnflaggedInMonth(viewYear,viewMonth);
  const saved=Math.round(savingsInMonth(viewYear,viewMonth)*100)/100, target=Number(state.savingsTarget)||0;
  const left=target?Math.max(0,Math.round((target-saved)*100)/100):0, done=target?saved>=target-0.004:saved>0.004;
  const pct=target?Math.max(0,Math.min(100,Math.round(saved/target*100))):(saved>0?100:0);
  const show=v=>balancesHidden?"••••":fmt(v);
  document.getElementById("savingsTitle").textContent=`Risparmio di ${MESI[viewMonth].toLowerCase()}`;
  const status=done?`<span class="sv-status ok">✓ Fatto</span>`:`<span class="sv-status todo">Da fare</span>`;
  document.getElementById("savingsCard").innerHTML=`
    <div class="sv-top"><span class="sv-ic" style="--c:${safeColor(acc.color)}" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 11a7 6 0 0 1 13-2h1.5a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H18a7 6 0 0 1-3 2.6V19h-3v-1.2a8 8 0 0 1-2 0V19H7v-2a6 6 0 0 1-2-6z"/><circle cx="15" cy="10" r=".6"/></svg></span>
      <div class="sv-main"><b>${escapeHtml(acc.name)}</b><small>${acc.label?escapeHtml(acc.label)+" · ":""}saldo ${show(accountBalance(acc.id))}</small></div>${status}</div>
    <div class="sv-nums"><button type="button" class="sv-num-btn" data-sv-list="deps"><small>Messi da parte</small><strong class="${saved>0?"pos":""}">${show(saved)}</strong><em>${deps.length?`${deps.length} ${deps.length===1?"deposito":"depositi"} ›`:"nessun deposito"}</em></button>${target?`<div><small>Obiettivo</small><strong>${show(target)}</strong></div><div><small>Mancano</small><strong>${show(left)}</strong></div>`:`<div class="sv-hint"><small>Imposta quanto mettere da parte ogni mese in Conti › Conto risparmio.</small></div>`}</div>
    ${target?`<div class="sv-bar" aria-hidden="true"><i style="width:${pct}%"></i></div>`:""}
    <p class="sv-rule">🐷 Conta solo i trasferimenti contrassegnati come <b>Deposito di risparmio</b>.</p>
    ${unflag.length?`<button type="button" class="sv-unflag" data-sv-list="unflag">${unflag.length} ${unflag.length===1?"trasferimento":"trasferimenti"} verso ${escapeHtml(acc.name)} non ${unflag.length===1?"contato":"contati"} (${show(unflag.reduce((s,t)=>s+t.amount,0))}) ›</button>`:""}`;
  const card=document.getElementById("savingsCard");
  card.onclick=e=>{
    const b=e.target.closest("[data-sv-list]"); if(!b) return;
    const mo=`${MESI[viewMonth]} ${viewYear}`;
    if(b.dataset.svList==="deps") openMovementsSheet("🐷 Depositi di risparmio",mo,deps);
    else openMovementsSheet(`Verso ${acc.name} · non contati`,`${mo} · per contarli: tieni premuto › Modifica › Deposito di risparmio`,unflag);
  };
  const go=document.getElementById("savingsGoBtn");
  go.hidden=!!(target&&done);
  go.onclick=()=>{
    const from=state.accounts.find(a=>a.id===state.mainAccountId&&a.id!==acc.id&&!isLoanAccount(a))||state.accounts.find(a=>a.id!==acc.id&&!isLoanAccount(a));
    if(!from){ showToast("Serve un altro conto da cui spostare i soldi"); return; }
    openTransferForm(null,{fromId:from.id,toId:acc.id,amount:left,title:`Risparmio ${MESI[viewMonth].toLowerCase()}`,savingsDeposit:true});
  };
}
/* ---------------- Rendering: Home ---------------- */
/* v1.52.0 — Home: se il mese ha delle stime, un riquadro con speso / stimato che porta a R&P › Stime. */
function renderHomeEstimate(){
  const panel=document.getElementById("forecastPanel"); if(!panel) return;
  let card=document.getElementById("homeEstimateCard");
  if(!card){
    card=document.createElement("button"); card.type="button"; card.id="homeEstimateCard"; card.className="home-est-card";
    card.addEventListener("click",()=>{ switchView("estimates"); window.scrollTo({top:0}); });
    panel.after(card);
  }
  const list=estimatesOf(viewYear,viewMonth);
  card.hidden=!list.length || periodModes.home==="range";
  if(card.hidden) return;
  const show=v=>balancesHidden?"••••":fmt(v);
  const tot=list.reduce((t,e)=>t+e.amount,0), spent=estMonthLinked(viewYear,viewMonth), diff=tot-spent; /* v1.70.0 — solo i collegati */
  const now=new Date(), fut=estMonthKey(viewYear,viewMonth)>estMonthKey(now.getFullYear(),now.getMonth());
  const pct=tot>0?Math.min(100,spent/tot*100):0;
  card.innerHTML=`<span class="he-top"><b>Stima di ${MESI[viewMonth].toLowerCase()}</b><span class="he-go">Stime ›</span></span>
    <span class="he-nums"><strong>${show(spent)}</strong><span>spesi di ${show(tot)}</span></span>
    <span class="he-bar ${diff<0?"over":""}"><i style="width:${fut?0:pct}%"></i></span>
    <span class="he-status ${fut?"":diff>=0?"ok":"over"}">${fut?"Mese non ancora iniziato":diff>=0?`Restano ${show(diff)} dentro la stima`:`Oltre la stima di ${show(-diff)}`}</span>`;
}
function renderHome(){
  renderSavingsBlock();
  renderHomeEstimate();
  const { income, expense, net } = sumTransactions(periodTx("home"));
  document.getElementById("netAmount").textContent = balancesHidden ? "••••" : fmt(net);
  document.getElementById("netAmount").style.color = moneyColor(net);
  document.getElementById("incomeAmount").textContent = balancesHidden ? "••••" : fmt(income);
  document.getElementById("expenseAmount").textContent = balancesHidden ? "••••" : fmt(expense);
  setEyeIcon(document.getElementById("toggleHomeBalance"),balancesHidden);
  const mainAccount=state.accounts.find(a=>a.id===state.mainAccountId) || null;
  const mainBalance=mainAccount?accountBalance(mainAccount.id):null;
  const allAccountsBalance=liquidBalance();
  {
    // v1.12.0: il riquadro compare solo se c'è davvero qualcosa da ricevere o da pagare.
    const card=document.getElementById("homeEffectiveCard"), recv=receivableTotal(), pay=payableTotal();
    const hasRecv=Math.abs(recv)>=0.005, hasPay=Math.abs(pay)>=0.005;
    if(card){
      card.hidden=!(hasRecv||hasPay);
      if(hasRecv||hasPay){
        const eff=allAccountsBalance+recv-pay, show=v=>balancesHidden?"••••":fmt(v);
        const effEl=document.getElementById("homeEffectiveBalance");
        effEl.textContent=show(eff); effEl.style.color=moneyColor(eff);
        document.getElementById("homeRecvChip").hidden=!hasRecv; document.getElementById("homeRecvAmount").textContent=`+${show(recv)}`;
        document.getElementById("homePayChip").hidden=!hasPay; document.getElementById("homePayAmount").textContent=`−${show(pay)}`;
        card.querySelector(".eff-label").textContent="Totale effettivo"; // v1.26.0: corto, niente "…"
      }
    }
  }
  const mainName=document.getElementById("homeMainAccountName");
  const mainAmount=document.getElementById("homeMainAccountBalance");
  const allAmount=document.getElementById("homeAllAccountsBalance");
  if(mainName) mainName.textContent=mainAccount?mainAccount.name:"Scegli il conto principale"; // v1.52.0: "conto principale" è già scritto sotto
  if(mainAmount){mainAmount.textContent=mainAccount?(balancesHidden?"••••":fmt(mainBalance)):"›";mainAmount.style.color=mainAccount?moneyColor(mainBalance):"";}
  // v1.23.0 — senza conto principale resta solo un avviso su una riga (prima occupava mezza scheda).
  document.getElementById("homeMainAccountCard")?.classList.toggle("mt-unset",!mainAccount);
  if(allAmount){allAmount.textContent=balancesHidden?"••••":fmt(allAccountsBalance);allAmount.style.color=moneyColor(allAccountsBalance);}
  renderMainAccountSetupNotice();

  {const c=document.getElementById("seeAllTxCount"); if(c) c.textContent=periodTx("home").filter(t=>!t.isBalanceAdjustment).length;}
  { const hl=document.querySelector("#view-home > .hero > .hero-label"); if(hl) hl.textContent="Liquidità"; } /* v1.68.0 — il netto del periodo è nella pastiglia della carta */
  const today=todayISO();
  const lastDay=`${viewYear}-${pad2(viewMonth+1)}-${pad2(new Date(viewYear,viewMonth+1,0).getDate())}`;
  // Lista "Prossime scadenze": solo il mese visualizzato.
  const future=plannedItemsForMonth(viewYear,viewMonth).filter(t=>t.date>=today && t.date<=lastDay);
  // v1.17.0: il saldo previsto di un mese futuro tiene conto di tutto ciò che arriva da oggi
  // a fine mese visualizzato (entrate e uscite, ricorrenti e pianificate, anche dei mesi in mezzo).
  const pending=pendingPlannedUntil(lastDay);
  const parts={recIn:0,recOut:0,planIn:0,planOut:0};
  pending.forEach(t=>{
    const planned=!!t.plannedId, inc=t.type==="income";
    parts[(planned?"plan":"rec")+(inc?"In":"Out")]+=t.amount;
  });
  const futureNet=parts.recIn+parts.planIn-parts.recOut-parts.planOut;
  const current=liquidBalance(), forecast=current+futureNet;
  const show=v=>balancesHidden?"••••":fmt(v);
  const signed=v=>balancesHidden?"••••":Math.abs(v)<0.005?fmt(0):`${v>0?"+":"−"}${fmt(Math.abs(v))}`;
  document.getElementById("forecastBalanceAmount").textContent=show(forecast);
  try{ renderHomeHero({income,expense,net,forecast,mainAccount,mainBalance}); }catch(e){ console.error("carta saldo",e); } /* v1.68.0 */
  document.getElementById("upcomingImpactAmount").textContent=signed(futureNet);
  document.getElementById("forecastTile")?.classList.toggle("neg",forecast<0);
  document.getElementById("forecastTile")?.classList.toggle("zero",Math.abs(forecast)<0.005);
  {const t=document.getElementById("upcomingTile"); if(t){ t.classList.toggle("neg",futureNet<0); t.classList.toggle("zero",Math.abs(futureNet)<0.005); }}
  {
    const isPast=lastDay<today;
    const rng=document.getElementById("upcomingRangeLabel");
    if(rng) rng.textContent=isPast?"Mese passato: nulla in arrivo":`Da oggi a fine ${MESI[viewMonth].toLowerCase()}${viewYear!==Number(today.slice(0,4))?" "+viewYear:""}`;
    const setPart=id=>v=>{
      const el=document.getElementById(id); if(!el) return;
      el.textContent=balancesHidden?"••••":fmt(v);
      el.closest(".fc-part").classList.toggle("zero",Math.abs(v)<0.005);
    };
    setPart("upRecIn")(parts.recIn); setPart("upPlanIn")(parts.planIn);
    setPart("upRecOut")(parts.recOut); setPart("upPlanOut")(parts.planOut);
    const tile=(dir,rec,plan,sign)=>{
      const tot=rec+plan, zero=tot<0.005;
      const t=document.getElementById(`up${dir}Total`);
      if(t) t.textContent=balancesHidden?"••••":zero?fmt(0):`${sign}${fmt(tot)}`;
      const r=document.getElementById(`up${dir}BarRec`), p=document.getElementById(`up${dir}BarPlan`);
      if(r) r.style.width=zero?"0%":`${(rec/tot*100).toFixed(1)}%`;
      if(p) p.style.width=zero?"0%":`${(plan/tot*100).toFixed(1)}%`;
      t?.closest(".fc-tile")?.classList.toggle("zero",zero);
    };
    tile("In",parts.recIn,parts.planIn,"+"); tile("Out",parts.recOut,parts.planOut,"−");
  }
  // v1.14.0: saldo previsto con le rate attese entro fine mese (anche quelle in ritardo).
  {
    const due=allPendingRates().filter(r=>r.date<=lastDay);
    const ratesNet=due.reduce((s,r)=>s+(loanAccount(r.accId)?.receivable?r.amount:-r.amount),0);
    const card=document.getElementById("ratesForecastCard");
    if(card){
      card.hidden=!due.length;
      document.getElementById("ratesForecastLabel").textContent=`Previsto con ${due.length===1?"la rata attesa":`le ${due.length} rate attese`} (${ratesNet>=0?"+":"−"}${balancesHidden?"••••":fmt(Math.abs(ratesNet))})`;
      const v=forecast+ratesNet, el=document.getElementById("ratesForecastAmount");
      el.textContent=show(v); el.style.color=moneyColor(v);
    }
  }
  renderUnifiedBudgets();

  // Recent tx
  const recent = periodTx("home").filter(t=>!t.isBalanceAdjustment).slice().sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id)).slice(0,5);
  renderTxRows(document.getElementById("recentTx"), recent);
  document.getElementById("txEmptyHint").hidden = recent.length>0;
  document.getElementById("txEmptyHint").textContent=periodModes.home==="day"?"Nessun movimento in questo giorno.":periodModes.home==="range"?"Nessun movimento nel periodo.":"Nessun movimento questo mese.";
  const upcoming=future.sort((a,b)=>a.date.localeCompare(b.date)).slice(0,3);
  renderTxRows(document.getElementById("upcomingHomeList"),upcoming);
  document.getElementById("upcomingHomeEmpty").hidden=upcoming.length>0;
  renderHomeLoanRates();
  renderLateRatesBadge();
}

/* v1.68.0 — CARTA DEL SALDO COME IN BET TRACKER (riquadro in cima alla Home).
   Liquidità grande (somma dei conti, senza crediti e debiti) con i centesimi più piccoli; pastiglie: netto del periodo
   scelto in alto (entrate − uscite) e liquidità degli ultimi 7 giorni; sotto l'andamento della liquidità negli ultimi
   30 giorni; caselle Entrate · Uscite · A fine mese (saldo previsto); pulsanti conto principale e totale effettivo
   (aprono quello che aprivano prima). Chip in alto a destra se un conto è in rosso. */
function liquidSeries(days){
  const liq=new Set(state.accounts.filter(a=>!isLoanAccount(a)).map(a=>a.id)), byDay=new Map();
  state.transactions.forEach(t=>{
    let d=0;
    if(t.type==="transfer") d=(liq.has(t.toAccountId)?t.amount:0)-(liq.has(t.accountId)?t.amount:0);
    else if(liq.has(t.accountId)) d=t.type==="income"?t.amount:-t.amount;
    if(d) byDay.set(t.date,(byDay.get(t.date)||0)+d);
  });
  const now=liquidBalance(), today=todayISO(), out=[];
  const after=iso=>{ let s=0; byDay.forEach((v,k)=>{ if(k>iso) s+=v; }); return s; };
  for(let i=days-1;i>=0;i--){ const d=new Date(today+"T12:00:00"); d.setDate(d.getDate()-i); const iso=`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; out.push({date:iso,v:now-after(iso)}); }
  return out;
}
function heroSparkSvg(vals,gid){
  if(!vals || vals.length<2) return "";
  const W=300,H=56,lo=Math.min(...vals),hi=Math.max(...vals),rg=hi-lo||1;
  if(hi-lo<0.005) return ""; /* niente movimenti in 30 giorni: niente riga piatta */
  const xy=vals.map((v,i)=>[Math.round(i/(vals.length-1)*W*10)/10,Math.round((H-6-(v-lo)/rg*(H-14))*10)/10]);
  const line=xy.map((q,i)=>(i?"L":"M")+q[0]+" "+q[1]).join(" "), last=xy[xy.length-1];
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".32"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>`+
    `<path d="${line} L${W} ${H} L0 ${H} Z" fill="url(#${gid})"/><path d="${line}" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${last[0]}" cy="${last[1]}" r="3.2" fill="#fff"/></svg>`;
}
function heroMoneyBig(n,hidden){
  if(hidden) return `<span class="bh-int">••••</span>`;
  const t=fmt(n).replace(/^-/,"−"), m=/^(.*?)([,.]\d{2})(\s*€.*)$/.exec(t);
  return m?`<span class="bh-int">${escapeHtml(m[1])}</span><span class="bh-dec">${escapeHtml(m[2]+m[3])}</span>`:`<span class="bh-int">${escapeHtml(t)}</span>`;
}
function renderHomeHero(o){
  const el=id=>document.getElementById(id); if(!el("bhBig")) return;
  const H=balancesHidden, show=v=>H?"••••":fmt(v);
  const liquid=liquidBalance(), ser=liquidSeries(30);
  el("bhBig").innerHTML=heroMoneyBig(liquid,H);
  el("bhBig").classList.toggle("neg",liquid<-0.004);
  /* pastiglie */
  const pill=(v,label)=>{ const c=v>0.004?"pos":v<-0.004?"neg":"zero"; return `<span class="bh-pill ${c}"><i aria-hidden="true">${c==="pos"?"▲":c==="neg"?"▼":"●"}</i><b>${H?"••••":fmt(Math.abs(v))}</b><small>${label}</small></span>`; };
  const pm=periodModes.home, netLab=pm==="day"?"netto del giorno":pm==="range"?"netto del periodo":`netto di ${MESI[viewMonth].toLowerCase()}`;
  const w7=ser.length>7?ser[ser.length-1].v-ser[ser.length-8].v:null;
  el("bhPills").innerHTML=pill(o.net,netLab)+(w7!=null&&Math.abs(w7)>=0.005?pill(w7,"7 giorni"):"");
  el("bhSpark").innerHTML=heroSparkSvg(ser.map(x=>x.v),"bhSparkG");
  /* caselle */
  el("bhIn").textContent=show(o.income); el("bhOut").textContent=show(o.expense);
  el("bhFc").textContent=show(o.forecast); el("bhFc").classList.toggle("neg",o.forecast<-0.004);
  { const lab=el("bhTileFc")?.querySelector("small"); if(lab) lab.lastChild.textContent=`Fine ${MESI_BREVI[viewMonth].toLowerCase()}`; }
  /* conto principale */
  const ma=o.mainAccount;
  el("bhMainName").textContent=ma?ma.name:"Scegli il conto principale";
  el("bhMainSub").textContent=ma?"conto principale":"serve per il saldo di riferimento";
  el("bhMainVal").textContent=ma?show(o.mainBalance):"›";
  el("bhMainVal").classList.toggle("neg",!!ma&&o.mainBalance<-0.004);
  /* totale effettivo (solo se ci sono crediti o debiti) */
  const recv=receivableTotal(), pay=payableTotal(), hasR=Math.abs(recv)>=0.005, hasP=Math.abs(pay)>=0.005;
  el("bhEff").hidden=!(hasR||hasP);
  if(hasR||hasP){
    const eff=liquid+recv-pay;
    el("bhEffVal").textContent=show(eff); el("bhEffVal").classList.toggle("neg",eff<-0.004);
    el("bhEffSub").textContent=[hasR?`+${show(recv)} da ricevere`:"",hasP?`−${show(pay)} da pagare`:""].filter(Boolean).join(" · ");
  }
  el("homeHeroCard")?.classList.toggle("one-act",!(hasR||hasP));
  /* chip: conti in rosso */
  const red=state.accounts.filter(a=>!isLoanAccount(a)&&!a.archived&&accountBalance(a.id)<-0.004);
  const chip=el("bhChip");
  chip.hidden=!red.length;
  if(red.length) chip.innerHTML=`<i aria-hidden="true">⚠</i>${red.length===1?escapeHtml(red[0].name)+" in rosso":red.length+" conti in rosso"}`;
}
document.getElementById("bhMain")?.addEventListener("click",()=>{ if(state.mainAccountId) openAccountEvolution(state.mainAccountId); else switchView("accounts"); });
document.getElementById("bhEff")?.addEventListener("click",()=>{ switchView("accounts"); setAccountsMode("loans"); });
document.getElementById("bhChip")?.addEventListener("click",()=>switchView("accounts"));

const budgetExpanded = {};
/* v1.45.0 — Azzera budget: toglie tutti i budget (categorie, sottocategorie e macrocategorie).
   Le spese restano: nella sezione si vedono solo gli importi spesi per categoria. */
function hasAnyBudget(){ return [...state.categories,...state.macroCategories].some(x=>Number(x.budget)>0); }
async function resetAllBudgets(){
  const items=[...state.categories,...state.macroCategories].filter(x=>Number(x.budget)>0);
  if(!items.length){ showToast("Nessun budget impostato"); return; }
  if(!await askConfirm(`Azzerare tutti i budget (${items.length})? Le spese restano, spariscono solo i limiti mensili.`,{ok:"Azzera",danger:true})) return;
  const before=items.map(x=>[x,x.budget]);
  items.forEach(x=>{ x.budget=null; });
  persist(); renderAll();
  showActionToastOrUndo("Budget azzerati",()=>{ before.forEach(([x,b])=>{ x.budget=b; }); persist(); renderAll(); });
}
document.getElementById("resetBudgetsBtn")?.addEventListener("click",resetAllBudgets);
/* =====================================================================
   v1.49.0 — Budget: sezione in Home rifatta e gestione dedicata
   - Home: riepilogo del mese (anello, quanto resta, quanto al giorno, ritmo di spesa) e una
     scheda per macrocategoria con barra, segno del "punto atteso" del mese e categorie dentro.
   - "Budget" apre la gestione: tutti i budget in un posto, con la media degli ultimi 3 mesi
     e il suggerimento pronto da applicare (anche a tutte con un tocco).
   ===================================================================== */
function budgetScopes(){
  // Il budget di una macro vale per tutte le sue categorie; se la macro non ce l'ha, contano quelli
  // delle singole categorie di primo livello (che includono le loro sottocategorie).
  const out=[];
  const cats=state.categories.filter(c=>c.kind==="expense"&&!c.parentCategoryId);
  state.macroCategories.filter(m=>m.kind!=="income").forEach(m=>{
    const mc=cats.filter(c=>c.macroCategoryId===m.id);
    if(Number(m.budget)>0) out.push({budget:Number(m.budget),ids:new Set(mc.flatMap(c=>categoryIdsWithin(c.id)))});
    else mc.filter(c=>Number(c.budget)>0).forEach(c=>out.push({budget:Number(c.budget),ids:new Set(categoryIdsWithin(c.id))}));
  });
  cats.filter(c=>!state.macroCategories.some(m=>m.id===c.macroCategoryId)&&Number(c.budget)>0).forEach(c=>out.push({budget:Number(c.budget),ids:new Set(categoryIdsWithin(c.id))}));
  return out;
}
function monthSpentByCategory(y,m){
  const pre=`${y}-${pad2(m+1)}`, by={};
  state.transactions.forEach(t=>{ if(t.type==="expense"&&!t.isBalanceAdjustment&&t.date.startsWith(pre)) by[t.categoryId]=(by[t.categoryId]||0)+t.amount; });
  return by;
}
/* Media mensile degli ultimi 3 mesi completi, per insieme di categorie */
function avgLast3(ids){
  const now=new Date(); let sum=0;
  for(let k=1;k<=3;k++){ const d=new Date(now.getFullYear(),now.getMonth()-k,1); const by=monthSpentByCategory(d.getFullYear(),d.getMonth()); ids.forEach(id=>{ sum+=by[id]||0; }); }
  return round2(sum/3);
}
const suggestBudget=v=>v>0?Math.ceil(v/5)*5:0;
function budgetPace(){
  const now=new Date(), cur=now.getFullYear()===viewYear&&now.getMonth()===viewMonth;
  const days=new Date(viewYear,viewMonth+1,0).getDate();
  const isPast=new Date(viewYear,viewMonth+1,0)<new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const day=cur?now.getDate():isPast?days:0;
  return {cur,days,day,frac:day/days,left:cur?days-day+1:0};
}
function openMovementsSheet(title,sub,list){
  const total=list.reduce((s,t)=>s+t.amount,0);
  openSheet("tpl-day-detail",(node)=>{
    node.classList.add("stats-cat-sheet");
    node.querySelector("#dayDetailTitle").textContent=title;
    const p=document.createElement("p");p.className="stats-cat-sub";
    p.innerHTML=`<span>${escapeHtml(sub)} · ${list.length} moviment${list.length===1?"o":"i"}</span><b>${maskAmt(fmt(total))}</b>`;
    node.querySelector(".sheet-head").after(p);
    renderTxRows(node.querySelector("#dayDetailList"),list.slice().sort((a,b)=>b.date.localeCompare(a.date)));
    const empty=node.querySelector("#dayDetailEmptyHint"); empty.textContent="Nessun movimento nel periodo."; empty.hidden=list.length>0;
  });
}
function renderUnifiedBudgets(){
  const list=document.getElementById("budgetList"); if(!list) return; list.innerHTML="";
  const tx=periodTx("home").filter(t=>!t.isBalanceAdjustment);
  const show=v=>balancesHidden?"••••":fmt(v);
  const pace=budgetPace(), monthMode=periodModes.home==="month"||!periodModes.home;
  const spentIn=(ids,kind="expense")=>{ const set=ids instanceof Set?ids:new Set(ids); return tx.filter(t=>t.type===kind&&set.has(t.categoryId)).reduce((s,t)=>s+t.amount,0); };
  const tone=(spent,limit)=>{ if(!limit) return "free"; const p=spent/limit; if(p>=1) return "over"; if(monthMode&&pace.cur&&pace.frac>0&&p>pace.frac+0.1&&p>=0.5) return "warn"; if(p>=0.85) return "warn"; return "ok"; };
  const pctTxt=(spent,limit)=>limit?Math.round(spent/limit*100)+"%":"";

  /* --- riepilogo --- */
  const scopes=budgetScopes();
  const totBudget=round2(scopes.reduce((s,x)=>s+x.budget,0));
  const totSpentBudgeted=round2(scopes.reduce((s,x)=>s+spentIn(x.ids),0));
  const totSpent=round2(tx.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0));
  let summary="";
  if(totBudget>0){
    const left=round2(totBudget-totSpentBudgeted), p=Math.min(1,totSpentBudgeted/totBudget), st=tone(totSpentBudgeted,totBudget);
    const R=34,C=2*Math.PI*R;
    const perDay=monthMode&&pace.cur&&pace.left>0&&left>0?round2(left/pace.left):null;
    const proj=monthMode&&pace.cur&&pace.day>2?round2(totSpentBudgeted/pace.day*pace.days):null;
    summary=`<div class="bd-summary ${st}">
      <svg class="bd-ring" viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="${R}" class="bd-ring-track"/><circle cx="40" cy="40" r="${R}" class="bd-ring-fill" stroke-dasharray="${(C*p).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 40 40)"/>${monthMode&&pace.cur?`<line class="bd-ring-pace" x1="40" y1="2" x2="40" y2="10" transform="rotate(${(pace.frac*360).toFixed(1)} 40 40)"/>`:""}<text x="40" y="44" text-anchor="middle">${Math.round(totSpentBudgeted/totBudget*100)}%</text></svg>
      <div class="bd-sum-main">
        <small>Speso su budget</small>
        <b>${show(totSpentBudgeted)} <span>di ${show(totBudget)}</span></b>
        <p class="bd-sum-line ${left<0?"neg":""}">${left>=0?`Restano <strong>${show(left)}</strong>`:`Sforato di <strong>${show(-left)}</strong>`}${perDay?` · ${show(perDay)} al giorno`:""}</p>
        ${proj!=null?`<p class="bd-sum-pace ${proj>totBudget?"neg":""}">A questo ritmo: ${show(proj)} a fine mese</p>`:""}
      </div></div>`;
  } else {
    summary=`<button type="button" class="bd-empty-cta" data-bd-manage><span class="bd-empty-ic" aria-hidden="true">◎</span><span><b>Imposta i budget del mese</b><small>Ti suggerisco gli importi in base alle tue spese degli ultimi 3 mesi.</small></span><span aria-hidden="true">›</span></button>`;
  }

  /* --- macrocategorie di spesa --- */
  const cats=state.categories.filter(c=>c.kind==="expense"&&!c.parentCategoryId);
  const groups=state.macroCategories.filter(m=>m.kind!=="income").map(m=>({...m,cats:cats.filter(c=>c.macroCategoryId===m.id)}));
  const orphan=cats.filter(c=>!state.macroCategories.some(m=>m.id===c.macroCategoryId));
  if(orphan.length) groups.push({id:"none-expense",name:"Senza macrocategoria",emoji:"🏷️",cats:orphan,budget:null});
  const rows=groups.filter(g=>g.cats.length).map(g=>{
    const ids=new Set(g.cats.flatMap(c=>categoryIdsWithin(c.id)));
    const spent=spentIn(ids);
    const limit=Number(g.budget)>0?Number(g.budget):round2(g.cats.reduce((s,c)=>s+(Number(c.budget)>0?Number(c.budget):0),0));
    return {g,ids,spent,limit};
  }).filter(r=>r.spent>0||r.limit>0).sort((a,b)=>(b.limit>0)-(a.limit>0)||b.spent-a.spent);
  const maxFree=Math.max(1,...rows.filter(r=>!r.limit).map(r=>r.spent));
  const bar=(spent,limit)=>{
    const st=tone(spent,limit);
    const w=limit?Math.min(100,spent/limit*100):Math.max(3,spent/maxFree*100);
    return `<div class="bd-bar ${st}"><i style="width:${w.toFixed(1)}%"></i>${limit&&monthMode&&pace.cur?`<em style="left:${(pace.frac*100).toFixed(1)}%" aria-hidden="true"></em>`:""}</div>`;
  };
  const cards=rows.map(r=>{
    const key=`expense-${r.g.id}`, open=!!budgetExpanded[key], st=tone(r.spent,r.limit), left=round2(r.limit-r.spent);
    const children=r.g.cats.map(c=>{
      const cids=categoryIdsWithin(c.id), sp=spentIn(cids), lim=Number(c.budget)>0?Number(c.budget):0;
      if(!(sp>0||lim>0)) return "";
      return `<button type="button" class="bd-cat ${tone(sp,lim)}" data-bd-cat="${escapeHtml(c.id)}"><span class="bd-cat-top"><span class="bd-cat-name">${emojiIconHtml(c.emoji)} ${escapeHtml(c.name)}</span><span class="bd-cat-amt">${show(sp)}${lim?`<small> / ${show(lim)}</small>`:""}</span></span>${lim?bar(sp,lim):""}</button>`;
    }).join("");
    return `<div class="bd-card ${st}${open?" open":""}">
      <button type="button" class="bd-card-head" data-bd-toggle="${escapeHtml(key)}" aria-expanded="${open}">
        <span class="bd-ic">${emojiIconHtml(r.g.emoji)}</span>
        <span class="bd-main"><span class="bd-name">${escapeHtml(r.g.name)}</span><span class="bd-sub">${r.limit?(left>=0?`restano ${show(left)}`:`sforato di ${show(-left)}`):"senza budget"}</span></span>
        <span class="bd-amt"><b>${show(r.spent)}</b>${r.limit?`<small>${pctTxt(r.spent,r.limit)} di ${show(r.limit)}</small>`:""}</span>
        <span class="bd-chev" aria-hidden="true">▾</span>
      </button>
      ${bar(r.spent,r.limit)}
      <div class="bd-cats"${open?"":" hidden"}>${children||'<p class="bd-none">Nessuna spesa nelle categorie.</p>'}</div>
    </div>`;
  }).join("");

  /* --- entrate, compatte --- */
  const inCats=state.categories.filter(c=>c.kind==="income"&&!c.parentCategoryId);
  const inRows=inCats.map(c=>({c,v:spentIn(categoryIdsWithin(c.id),"income")})).filter(x=>x.v>0).sort((a,b)=>b.v-a.v);
  const income=inRows.length?`<div class="bd-income"><h3>↑ Entrate</h3>${inRows.map(x=>`<button type="button" class="bd-in-row" data-bd-in="${escapeHtml(x.c.id)}"><span>${emojiIconHtml(x.c.emoji)} ${escapeHtml(x.c.name)}</span><b>${show(x.v)}</b></button>`).join("")}</div>`:"";

  list.innerHTML=summary+(cards?`<div class="bd-list"><h3>↓ Uscite per macrocategoria${totSpent?` · <span>${show(totSpent)}</span>`:""}</h3>${cards}</div>`:"")+income;
  document.getElementById("budgetEmptyHint").hidden=!!(cards||income||totBudget);
  document.getElementById("budgetPeriodHint").textContent=periodModes.home==="range"?"Spese del periodo selezionato · budget mensili":periodModes.home==="day"?"Spese del giorno selezionato · budget mensili":`${MESI[viewMonth]} ${viewYear}${pace.cur?` · giorno ${pace.day} di ${pace.days}`:""}`;

  list.querySelectorAll("[data-bd-toggle]").forEach(b=>{
    b.addEventListener("click",()=>{ budgetExpanded[b.dataset.bdToggle]=!budgetExpanded[b.dataset.bdToggle]; renderUnifiedBudgets(); });
    const g=rows.find(r=>`expense-${r.g.id}`===b.dataset.bdToggle);
    if(g) bindLongPress(b,()=>openMovementsSheet(`${g.g.emoji||""} ${g.g.name}`.trim(),periodLabel("home"),tx.filter(t=>t.type==="expense"&&g.ids.has(t.categoryId))));
  });
  list.querySelectorAll("[data-bd-cat]").forEach(b=>b.addEventListener("click",()=>{
    const c=categoriesById()[b.dataset.bdCat]; const set=new Set(categoryIdsWithin(b.dataset.bdCat));
    openMovementsSheet(`${c?.emoji||""} ${c?.name||"Categoria"}`.trim(),periodLabel("home"),tx.filter(t=>t.type==="expense"&&set.has(t.categoryId)));
  }));
  list.querySelectorAll("[data-bd-in]").forEach(b=>b.addEventListener("click",()=>{
    const c=categoriesById()[b.dataset.bdIn]; const set=new Set(categoryIdsWithin(b.dataset.bdIn));
    openMovementsSheet(`${c?.emoji||""} ${c?.name||"Entrate"}`.trim(),periodLabel("home"),tx.filter(t=>t.type==="income"&&set.has(t.categoryId)));
  }));
  list.querySelectorAll("[data-bd-manage]").forEach(b=>b.addEventListener("click",openBudgetManager));
}
document.getElementById("budgetManageBtn")?.addEventListener("click",()=>openBudgetManager());

function openBudgetManager(){
  const cats=state.categories.filter(c=>c.kind==="expense"&&!c.parentCategoryId);
  const groups=state.macroCategories.filter(m=>m.kind!=="income").map(m=>({m,cats:cats.filter(c=>c.macroCategoryId===m.id)})).filter(g=>g.cats.length);
  const orphan=cats.filter(c=>!state.macroCategories.some(m=>m.id===c.macroCategoryId));
  if(orphan.length) groups.push({m:null,cats:orphan});
  const now=new Date(), by=monthSpentByCategory(now.getFullYear(),now.getMonth());
  const val=v=>Number(v)>0?String(v).replace(".",","):"";
  openSheet("tpl-budget-manager",(node,close)=>{
    const body=node.querySelector("#budgetManagerBody");
    const icon=e=>`<span class="bm-ic" aria-hidden="true">${escapeHtml(firstGlyph(e||"•"))}</span>`;
    const input=(name,budget)=>`<span class="bm-input"><span class="bm-cur">€</span><input type="text" inputmode="decimal" placeholder="—" value="${val(budget)}" aria-label="Budget ${escapeHtml(name)}"></span>`;
    const catRow=c=>{
      const cids=categoryIdsWithin(c.id), avg=avgLast3(cids), spent=round2(cids.reduce((s,i)=>s+(by[i]||0),0)), sg=suggestBudget(avg);
      const cls=spent>avg*1.05&&avg>0?"up":spent>0?"ok":"zero";
      const sh=x=>fmt(x).replace(/,00(?=[\s\u00a0\u202f])/,"");
      const stat=(l,v,c)=>`<span class="bm-st ${c}"><i>${l}</i><b>${v}</b></span>`;
      return `<div class="bm-row" data-kind="cat" data-id="${escapeHtml(c.id)}"><span class="bm-name">${icon(c.emoji)}<span><b>${escapeHtml(c.name)}</b><span class="bm-stats">${stat("Media",sh(avg),"avg")}${stat("Mese",sh(spent),cls)}${sg>0?`<button type="button" class="bm-sugg" data-sugg="${sg}">Imposta ${sh(sg)}</button>`:""}</span></span></span>${input(c.name,c.budget)}</div>`;
    };
    const chev='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5"/></svg>';
    const groupHtml=(g,gi)=>{
      const open=!g.m||Number(g.m.budget)>0||g.cats.some(c=>Number(c.budget)>0);
      return `<div class="bm-group${open?" open":""}" data-g="${gi}">
        ${g.m?`<div class="bm-row bm-macro" data-kind="macro" data-id="${escapeHtml(g.m.id)}"><button type="button" class="bm-toggle" aria-expanded="${open}" aria-label="Mostra le categorie di ${escapeHtml(g.m.name)}">${chev}</button><span class="bm-name">${icon(g.m.emoji)}<span><b>${escapeHtml(g.m.name)}</b><span class="bm-msub"></span></span></span>${input(g.m.name,g.m.budget)}</div>`:'<p class="bm-orphan">Senza macrocategoria</p>'}
        <div class="bm-subs">${g.cats.map(catRow).join("")}</div></div>`;
    };
    body.innerHTML=`<div class="bm-summary"><div class="bm-total"><small>Totale budget</small><b id="bmTotal">—</b><span id="bmAvg"></span></div></div>
      <div class="bm-actions"><button type="button" class="pill-btn" id="bmSuggestAll">✨ Suggerisci tutti</button><button type="button" class="pill-btn bm-reset" id="bmReset">Azzera tutti</button></div>
      ${groups.map(groupHtml).join("")}`;
    const rowsAll=()=>[...body.querySelectorAll(".bm-row")];
    const refresh=()=>{
      let tot=0, avgTot=0;
      groups.forEach((g,gi)=>{
        const mRow=g.m?body.querySelector(`.bm-row[data-kind="macro"][data-id="${CSS.escape(g.m.id)}"]`):null;
        const mv=mRow?parseAmount(mRow.querySelector("input").value):0;
        const catRows=g.cats.map(c=>body.querySelector(`.bm-row[data-kind="cat"][data-id="${CSS.escape(c.id)}"]`));
        catRows.forEach(r=>{ r.classList.toggle("bm-covered",mv>0); r.querySelector("input").disabled=mv>0; });
        const sub=catRows.reduce((s,r)=>s+parseAmount(r.querySelector("input").value),0);
        tot+=mv>0?mv:sub;
        avgTot+=avgLast3(g.cats.flatMap(c=>categoryIdsWithin(c.id)));
        const ms=mRow?.querySelector(".bm-msub");
        if(ms) ms.innerHTML=mv>0?`<span class="bm-st ok"><i>Budget unico</i></span>`:sub>0?`<span class="bm-st avg"><i>Somma</i><b>${fmt(round2(sub)).replace(/,00(?=[\s\u00a0\u202f])/,"")}</b></span>`:`<span class="bm-st zero"><i>${g.cats.length} ${g.cats.length===1?"categoria":"categorie"}</i></span>`;
      });
      body.querySelector("#bmTotal").textContent=tot>0?fmt(round2(tot)):"nessuno";
      body.querySelector("#bmAvg").textContent=`spesa media mensile ${fmt(round2(avgTot))}`;
    };
    body.addEventListener("input",refresh);
    body.addEventListener("click",e=>{
      const t=e.target.closest(".bm-toggle, .bm-macro .bm-name"); if(!t) return;
      const grp=t.closest(".bm-group"), open=!grp.classList.contains("open");
      grp.classList.toggle("open",open); grp.querySelector(".bm-toggle")?.setAttribute("aria-expanded",String(open));
    });
    body.querySelectorAll(".bm-sugg").forEach(b=>b.addEventListener("click",()=>{ b.closest(".bm-row").querySelector("input").value=String(b.dataset.sugg); refresh(); }));
    body.querySelector("#bmSuggestAll").addEventListener("click",()=>{
      let n=0; body.querySelectorAll(".bm-row[data-kind=cat]").forEach(r=>{ const s=r.querySelector(".bm-sugg"); if(s && !r.classList.contains("bm-covered")){ r.querySelector("input").value=s.dataset.sugg; n++; } });
      body.querySelectorAll(".bm-group").forEach(gr=>{ if(gr.querySelector(".bm-sugg")){ gr.classList.add("open"); gr.querySelector(".bm-toggle")?.setAttribute("aria-expanded","true"); } });
      refresh(); showToast(n?`Suggeriti ${n} budget: controlla e salva`:"Servono spese nei mesi scorsi per suggerire");
    });
    body.querySelector("#bmReset").addEventListener("click",()=>{ rowsAll().forEach(r=>{ r.querySelector("input").value=""; }); refresh(); });
    refresh();
    node.querySelector("#saveBudgetsBtn").addEventListener("click",()=>{
      const before=[...state.categories,...state.macroCategories].map(x=>[x,x.budget]);
      rowsAll().forEach(r=>{
        const v=parseAmount(r.querySelector("input").value);
        const list=r.dataset.kind==="macro"?state.macroCategories:state.categories;
        const x=list.find(y=>String(y.id)===r.dataset.id); if(x) x.budget=v>0?round2(v):null;
      });
      persist(); renderAll(); close();
      showActionToastOrUndo("Budget salvati",()=>{ before.forEach(([x,b])=>{ x.budget=b; }); persist(); renderAll(); });
    });
  });
}

/* v1.4.0 — Conferma in-app al posto del confirm() del browser. */
function askConfirm(message,{ok="Conferma",cancel="Annulla",danger=null}={}){
  return new Promise(resolve=>{
    const isDanger=danger??/elimin|azzera|sovrascriv|irreversib|non è reversibile/i.test(message);
    let d=document.getElementById("askDialog");
    if(!d){d=document.createElement("dialog");d.id="askDialog";d.className="ask-dialog";document.body.appendChild(d);}
    if(d.open) d.close();
    d.innerHTML=`<p class="ask-msg"></p><div class="ask-actions"><button type="button" class="ask-cancel"></button><button type="button" class="ask-ok"></button></div>`;
    d.querySelector(".ask-msg").textContent=message;
    const okBtn=d.querySelector(".ask-ok"),noBtn=d.querySelector(".ask-cancel");
    okBtn.textContent=isDanger&&ok==="Conferma"?"Elimina":ok; noBtn.textContent=cancel;
    okBtn.classList.toggle("danger",!!isDanger);
    let settled=false;
    const done=v=>{if(settled)return;settled=true;d.close();resolve(v);};
    okBtn.onclick=()=>done(true); noBtn.onclick=()=>done(false);
    d.oncancel=e=>{e.preventDefault();done(false);};
    d.onclick=e=>{if(e.target===d)done(false);};
    d.showModal(); noBtn.focus();
  });
}

function showToast(message){
  let toast=document.getElementById("appToast");
  if(!toast){toast=document.createElement("div");toast.id="appToast";document.body.appendChild(toast);}
  toast.textContent=message;toast.classList.add("show");clearTimeout(toast._timer);toast._timer=setTimeout(()=>toast.classList.remove("show"),2000);
}
function showUndo(message, trashId){
  let toast=document.getElementById("appToast");
  if(!toast){toast=document.createElement("div");toast.id="appToast";document.body.appendChild(toast);}
  toast.innerHTML=`<span>${escapeHtml(message)}</span><button type="button">Annulla</button>`;
  toast.classList.add("show");clearTimeout(toast._timer);
  toast.querySelector("button").addEventListener("click",()=>{restoreTrashItem(trashId);toast.classList.remove("show");});
  toast._timer=setTimeout(()=>toast.classList.remove("show"),5000);
}
function openMovementActionMenu({title="Movimento",onEdit,onDelete,onDuplicate,onRecurring,onPlanned,onPayNow,payLabel,onMove}){
  document.getElementById("movementActionOverlay")?.remove();
  const overlay=document.createElement("div");
  overlay.id="movementActionOverlay";
  overlay.className="movement-action-overlay";
  overlay.innerHTML=`
    <div class="movement-action-menu" role="dialog" aria-modal="true" aria-label="Azioni movimento">
      <div class="movement-action-handle" aria-hidden="true"></div>
      <p class="movement-action-title">${escapeHtml(title)}</p>
      <div class="movement-action-buttons"></div>
      <button type="button" class="movement-action-cancel">Annulla</button>
    </div>`;
  const actions=overlay.querySelector(".movement-action-buttons");
  const addAction=(label,cls,fn)=>{
    if(!fn) return;
    const icons={
      edit:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l11-11-4-4L4 16v4Zm12.5-16.5 4 4 1.2-1.2a1.4 1.4 0 0 0 0-2l-2-2a1.4 1.4 0 0 0-2 0L16.5 3.5Z"/></svg>`,
      duplicate:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8h11v11H8V8Zm-3 8H3V3h13v2H5v11Z"/></svg>`,
      recurring:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 3l4 4-4 4V8H8a3 3 0 0 0-3 3v1H3v-1a5 5 0 0 1 5-5h9V3Zm-10 18l-4-4 4-4v3h9a3 3 0 0 0 3-3v-1h2v1a5 5 0 0 1-5 5H7v3Z"/></svg>`,
      move:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2h2v2h6V2h2v2h2a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2V2Zm12 8H5v9h14v-9ZM5 8h14V6H5v2Zm8 3 4 3.5-4 3.5v-2.5H8v-2h5V11Z"/></svg>`,
      planned:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm1 3v5.2l3.6 2.1-1 1.7L11 13.3V7h2Z"/></svg>`,
      paynow:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18v12H3V6Zm2 2v8h14V8H5Zm7 1.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM6 10h2v4H6v-4Zm10 0h2v4h-2v-4Z"/></svg>`,
      delete:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 20a2 2 0 0 1-2-2V7h14v11a2 2 0 0 1-2 2H7Zm1-10v7h2v-7H8Zm6 0v7h2v-7h-2ZM4 6V4h5l1-1h4l1 1h5v2H4Z"/></svg>`
    };
    const btn=document.createElement("button");
    btn.type="button";btn.className=`movement-action-btn ${cls}`;
    btn.innerHTML=`<span class="movement-action-icon">${icons[cls]||""}</span><span>${label}</span>`;
    btn.addEventListener("click",()=>{overlay.remove();fn();});
    actions.appendChild(btn);
  };
  addAction(payLabel||"Paga ora","paynow",onPayNow);
  addAction("Modifica","edit",onEdit);
  addAction("Duplica","duplicate",onDuplicate);
  addAction("Rendi ricorrente","recurring",onRecurring);
  addAction("Sposta data","move",onMove);
  addAction("Pianifica di nuovo","planned",onPlanned);
  addAction("Elimina","delete",onDelete);
  overlay.querySelector(".movement-action-cancel").addEventListener("click",()=>overlay.remove());
  overlay.addEventListener("click",e=>{if(e.target===overlay) overlay.remove();});
  document.body.appendChild(overlay);
  bindOverlaySwipeDismiss(overlay);
  requestAnimationFrame(()=>overlay.classList.add("show"));
}
function enableLongPressActions(row,{title,onEdit,onDelete,onDuplicate,onRecurring,onPlanned,onPayNow,payLabel,onMove}){
  row.classList.add("longpress-actionable");
  let timer=null,startX=0,startY=0,longPressed=false;
  const cancel=()=>{if(timer){clearTimeout(timer);timer=null;}};
  row.addEventListener("touchstart",e=>{
    if(e.touches.length!==1) return;
    const t=e.touches[0];startX=t.clientX;startY=t.clientY;longPressed=false;
    cancel();
    timer=setTimeout(()=>{
      timer=null;longPressed=true;row._skipClick=true;
      if(navigator.vibrate) navigator.vibrate(18);
      openMovementActionMenu({title,onEdit,onDelete,onDuplicate,onRecurring,onPlanned,onPayNow,payLabel,onMove});
      setTimeout(()=>row._skipClick=false,450);
    },520);
  },{passive:true});
  row.addEventListener("touchmove",e=>{
    if(!timer || !e.touches.length) return;
    const t=e.touches[0];
    if(Math.hypot(t.clientX-startX,t.clientY-startY)>9) cancel();
  },{passive:true});
  row.addEventListener("touchend",()=>{cancel();if(longPressed){row._skipClick=true;setTimeout(()=>row._skipClick=false,250);}}, {passive:true});
  row.addEventListener("touchcancel",cancel,{passive:true});
  row.addEventListener("contextmenu",e=>{e.preventDefault();row._skipClick=true;openMovementActionMenu({title,onEdit,onDelete,onDuplicate,onRecurring,onPlanned,onPayNow,payLabel,onMove});setTimeout(()=>row._skipClick=false,250);});
}
/* v1.40.0 — Duplica anche in R&P: la copia nasce uguale, si apre subito per cambiare
   quello che serve (nome, importo, data). "Annulla" nel messaggio la toglie. */
function duplicateRP(kind,id){
  const listName=kind==="recurring"?"recurring":"planned";
  const src=state[listName].find(x=>x.id===id); if(!src) return;
  const copy=JSON.parse(JSON.stringify(src)); copy.id=uid();
  if(kind==="planned"){ delete copy.paidTxId; delete copy.done; }
  state[listName].push(copy);
  persist(); renderAll();
  showActionToastOrUndo(`${kind==="recurring"?"Ricorrente":"Pianificata"} duplicata`,()=>{ state[listName]=state[listName].filter(x=>x.id!==copy.id); persist(); renderAll(); });
  setTimeout(()=>{ if(kind==="recurring") openRecurringForm(copy.id); else openPlannedForm(copy.id); },120);
}
function showActionToastOrUndo(message,undo){
  let toast=document.getElementById("appToast");
  if(!toast){toast=document.createElement("div");toast.id="appToast";document.body.appendChild(toast);}
  toast.innerHTML=`<span>${escapeHtml(message)}</span><button type="button">Annulla</button>`;
  toast.classList.add("show");clearTimeout(toast._timer);
  toast.querySelector("button").addEventListener("click",()=>{undo();toast.classList.remove("show");});
  toast._timer=setTimeout(()=>toast.classList.remove("show"),5000);
}
function duplicateTransaction(t){
  if(!t || t.planned || t.isBalanceAdjustment) return null;
  const copy={...t,id:uid(),date:todayISO(),planned:false};
  delete copy.recurringId;
  delete copy.plannedId;
  delete copy.estimateId; /* v1.70.0 — nelle stime solo se lo scegli tu */
  state.transactions.push(copy);
  if(t.splitGroup){ const group=uid(); copy.splitGroup=group; state.transactions.filter(x=>x.splitGroup===t.splitGroup&&x.id!==t.id&&x.id!==copy.id).forEach(partner=>state.transactions.push({...partner,id:uid(),date:copy.date,splitGroup:group,fromSched:undefined})); }
  persist();
  renderAll();
  showToast("Movimento duplicato con la data di oggi");
  return copy;
}
/* v1.7.0 — Evidenzia nei risultati il testo cercato (nome, categoria, conto). */
let HL="";
function hlText(str){
  const e=escapeHtml(str);
  const q=String(HL||"").trim();
  if(!q) return e;
  const needle=escapeHtml(q).replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  return e.replace(new RegExp(needle,"gi"),m=>`<mark class="hl">${m}</mark>`);
}
function withHighlight(q,fn){const prev=HL;HL=q||"";try{return fn();}finally{HL=prev;}}
/* v1.6.3 — Riga movimento unica per Home e R&P:
   riga 1: icona · nome · importo   —   riga 2: etichetta · categoria · conto · data (pastiglia). */
const KIND_ICONS={
  recurring:'<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M4 12a8 8 0 0113.6-5.7M20 12a8 8 0 01-13.6 5.7M17 3v4h-4M7 21v-4h4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  planned:'<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M4 10h16M9 3v4M15 3v4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  paid:'<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};
function datePillHtml(iso,{relative=true,kind=null,paid=false}={}){
  if(!iso) return "";
  const d=new Date(iso+"T00:00:00");
  const days=Math.round((d-new Date(todayISO()+"T00:00:00"))/86400000);
  const rel=!relative?"":days===0?"oggi":days===1?"domani":days>1?`tra ${days} gg`:"";
  const label=kind==="recurring"?"Ricorrente":kind==="planned"?"Pianificata":"";
  const icon=paid?KIND_ICONS.paid:(kind?KIND_ICONS[kind]:"");
  const cls=`mv-date${kind?" kind-"+kind:""}${paid?" is-paid":""}${days===0?" is-today":days>0&&relative?" is-future":""}`;
  return `<span class="${cls}"${label?` title="${label}${paid?" · registrato":""}" aria-label="${label}${paid?" registrato":""}, ${d.getDate()} ${MESI[d.getMonth()]}"`:""}>${icon}${d.getDate()} ${MESI_BREVI[d.getMonth()].toLowerCase()}${rel?` · ${rel}`:""}</span>`;
}
/* v1.10.6 — Icona libera: si scrive con la tastiera emoji dell'iPhone, anche più di una.
   I suggerimenti sotto si aggiungono al campo; ✕ lo svuota. */
function emojiGraphemes(str){
  const t=String(str||"");
  try{ if(typeof Intl!=="undefined" && Intl.Segmenter) return [...new Intl.Segmenter("it",{granularity:"grapheme"}).segment(t)].map(x=>x.segment); }catch(e){}
  return Array.from(t);
}
function cleanEmoji(str,max=2){
  const isEmoji=g=>/\p{Extended_Pictographic}|\p{Regional_Indicator}|[\u20E3\uFE0F]/u.test(g);
  return emojiGraphemes(str).filter(g=>g.trim() && isEmoji(g)).slice(0,max).join("");
}
function emojiIconHtml(emoji){
  const grs=emojiGraphemes(emoji).slice(0,2);
  return (grs.length?grs:[emoji]).map(g=>`<span class="mv-ic-item">${escapeHtml(g)}</span>`).join("");
}
function buildEmojiField(row, initial, onChange){
  row.innerHTML="";row.classList.add("emoji-field");
  const wrap=document.createElement("div");wrap.className="emoji-input-wrap";
  const input=document.createElement("input");
  input.type="text";input.className="text-input emoji-input";input.value=cleanEmoji(initial)||"";
  input.setAttribute("aria-label","Icona: scrivi una o più emoji");input.placeholder="Tocca e usa la tastiera 😀";
  input.autocomplete="off";input.setAttribute("autocorrect","off");input.setAttribute("autocapitalize","off");input.spellcheck=false;
  const clear=document.createElement("button");clear.type="button";clear.className="emoji-clear";clear.textContent="✕";clear.setAttribute("aria-label","Svuota icona");
  wrap.append(input,clear);
  // v1.12.1: niente icone suggerite, solo la tastiera emoji dell'iPhone.
  const hint=document.createElement("p");hint.className="field-hint emoji-hint";hint.textContent="Tocca il campo e sulla tastiera premi 😀 (o 🌐) per scegliere l'emoji. Puoi metterne fino a 2.";
  const commit=()=>{const v=cleanEmoji(input.value);onChange(v||EMOJIS[0]);};
  input.addEventListener("input",()=>{const v=cleanEmoji(input.value);if(v!==input.value&&!input.value.endsWith("\u200D"))input.value=v;commit();});
  input.addEventListener("blur",()=>{input.value=cleanEmoji(input.value);commit();});
  clear.addEventListener("click",()=>{input.value="";input.focus();onChange(EMOJIS[0]);});
  row.append(wrap,hint);
  commit();
}
function movementRowHtml({emoji,color,title,badges="",meta="",amountHtml,type,date,relative=true,kind=null,paid=false}){
  const nEm=Math.min(2,emojiGraphemes(emoji).length||1);
  return `<span class="mv-ic${nEm>1?` mv-ic-n${nEm}`:""}" style="--c:${safeColor(color||"#8a9590")}">${emojiIconHtml(emoji)}</span>
    <span class="mv-title"><span class="mv-name">${hlText(title)}</span></span>
    <span class="mv-amt ${type}">${amountHtml}</span>
    <span class="mv-meta"><span class="mv-meta-text">${meta}</span></span>
    ${datePillHtml(date,{relative:false,kind,paid})}`;
}
function nextMonthSameDay(iso){
  const d=new Date(iso+"T12:00:00"), day=d.getDate();
  const n=new Date(d.getFullYear(),d.getMonth()+1,1);
  n.setDate(Math.min(day,new Date(n.getFullYear(),n.getMonth()+1,0).getDate()));
  let out=`${n.getFullYear()}-${pad2(n.getMonth()+1)}-${pad2(n.getDate())}`;
  while(out<=todayISO()){const m=new Date(out+"T12:00:00");const k=new Date(m.getFullYear(),m.getMonth()+1,1);k.setDate(Math.min(day,new Date(k.getFullYear(),k.getMonth()+1,0).getDate()));out=`${k.getFullYear()}-${pad2(k.getMonth()+1)}-${pad2(k.getDate())}`;}
  return out;
}
function futureFromTx(t){
  const d=nextMonthSameDay(t.date);
  return {name:t.name||"",amount:t.amount,type:t.type,categoryId:t.categoryId,accountId:t.accountId,note:t.note||"",freq:"monthly",startDate:d,date:d,active:true};
}
function transferName(fromId,toId){
  const accs=accountsById();
  return `${accs[fromId]?.name||"Conto"} → ${accs[toId]?.name||"Conto"}`;
}
/* v1.58.0 — "Paga" visibile nella riga (prima si trovava solo con la pressione lunga). */
function addPayChip(row,fn,label){
  const nameEl=row.querySelector(".mv-name"); if(!nameEl||!fn) return;
  const chip=document.createElement("button");
  chip.type="button"; chip.className="mv-pay-chip"; chip.textContent="Paga"; chip.setAttribute("aria-label",label||"Paga ora");
  ["pointerdown","touchstart","mousedown"].forEach(ev=>chip.addEventListener(ev,e=>e.stopPropagation(),{passive:true}));
  chip.addEventListener("click",e=>{ e.stopPropagation(); e.preventDefault(); row._skipClick=true; setTimeout(()=>{row._skipClick=false;},400); fn(); });
  nameEl.after(chip);
}
function renderTxRows(container, list, {paidLabel=false,compact=false}={}){
  const cats = categoriesById(), accs = accountsById(), macros = macroCategoriesById();
  const ambigue = ambiguousCategoryNames();   /* v1.37.0: percorso solo sui nomi doppi */
  container.innerHTML = "";
  list.forEach(t=>{
    const isTransfer=t.type==="transfer";
    const loanInfo = (isTransfer||t.loanOld||t.loanWriteOff) ? loanRowInfo(t) : null;
    const cat = loanInfo ? {name:loanInfo.label,emoji:loanInfo.emoji,color:loanInfo.color,macroCategoryId:null} : isTransfer ? ({name:t.atm?"Prelievo ATM":"Trasferimento",emoji:t.atm?"🏧":"↔",color:"#E8A33D",macroCategoryId:null}) : (t.isBalanceAdjustment ? {name:"Rettifica saldo",emoji:"⚖️",color:"#7BAE9D",macroCategoryId:null} : (cats[t.categoryId] ? {...cats[t.categoryId], name: categoryLabel(t.categoryId,{ambigue})} : { name:"Categoria eliminata", emoji:"❔", color:"#999" }));
    const acc = accs[t.accountId] || { name:"Conto eliminato" };
    const destination=accs[t.toAccountId] || {name:"Conto eliminato"};
    const row = document.createElement("div");
    row.setAttribute("role","button"); row.tabIndex=0;
    row.className = "tx-row mv-row" + (t.planned ? " planned mv-kind-"+(t.recurringId?"recurring":"planned") : " mv-kind-past") + (compact ? " mv-compact" : "");
    row.dataset.id = t.id;
    const d = new Date(t.date+"T00:00:00");
    const originKind=t.recurringId?"recurring":(t.plannedId?"planned":null);
    const originLabel=originKind==="recurring"?"Ricorrente":originKind==="planned"?"Pianificata":"";
    const statusBadge = t.planned
      ? `<span class="status-badge ${t.recurringId?"recurring":"planned"}">${t.recurringId?"Ricorrente":"Pianificata"}</span>`
      : originKind
        ? `<span class="status-badge ${originKind}">${originLabel}</span>${paidLabel?`<span class="status-badge paid">Pagato</span>`:""}`
        : "";
    const sharePerson = t.splitGroup ? sharePersonOf(t) : "";
    const title = loanInfo ? loanInfo.title : isTransfer ? `${acc.name} → ${destination.name}` : (t.name || t.note || cat.name);
    const metaParts=loanInfo
      ? `<span class="mv-loan">${loanInfo.label}</span>${loanInfo.meta?`<span class="mv-sep" aria-hidden="true">·</span><span>${hlText(loanInfo.meta)}</span>`:""}`
      : isTransfer
      ? (isSavingsDeposit(t)?`<span class="mv-sav">🐷 Deposito di risparmio</span>`:`<span>${t.atm?"Prelievo ATM":"Trasferimento"}</span>`) /* v1.67.0 */
      : `<span>${hlText(cat.name)}</span><span class="mv-sep" aria-hidden="true">·</span><span class="mv-acc">${hlText(acc.name)}</span>${sharePerson?`<span class="mv-sep" aria-hidden="true">·</span><span class="mv-shared">divisa con ${escapeHtml(sharePerson)}</span>`:""}${(()=>{ const es=t.estimateId&&!t.planned?txEstimate(t):null; return es?`<span class="mv-sep" aria-hidden="true">·</span><span class="mv-est" title="Conta nella stima">🎯 ${escapeHtml(es.name)}</span>`:""; })()}`;
    row.innerHTML = movementRowHtml({emoji:cat.emoji,color:cat.color,title,badges:statusBadge,meta:metaParts,
      amountHtml:`${isTransfer||t.loanOld||t.loanWriteOff?"↔":t.type==="income"?"+":"−"}${fmt(t.amount)}`,type:(t.loanOld||t.loanWriteOff)?"transfer":t.type,date:compact?null:t.date,relative:!!t.planned,
      kind:t.recurringId?"recurring":(t.plannedId?"planned":null),paid:!t.planned&&paidLabel});
    const openRow=()=>{
      if(row._skipClick) return;
      if(t.planned) openScheduledDetail(t.recurringId ? "recurring" : "planned", t.recurringId || t.plannedId, t.date);
      else openTxDetail(t.id);
    };
    row.addEventListener("click", openRow);
    activateRowFromKeyboard(row,openRow);
    const canDuplicate=!t.planned && !t.isBalanceAdjustment;
    // v1.44.0 — pagato in anticipo: si può annullare; in programma: si può pagare ora.
    let payFn=null, payTxt="";
    if(!t.planned && t.earlyFor){ payFn=()=>undoEarlyPayment(t.id); payTxt=`Annulla pagamento (torna al ${shortDate(t.earlyFor)})`; }
    else if(t.planned && t.recurringId){ const rr=state.recurring.find(x=>x.id===t.recurringId); const due=recurringNextDue(rr); if(due&&due===t.date){ payFn=()=>payRecurringNow(rr.id); payTxt=`Paga ora la rata del ${shortDate(due)}`; } }
    else if(t.planned && t.plannedId && t.date>todayISO()){ payFn=()=>payPlannedNow(t.plannedId); payTxt="Paga ora ed estingui"; }
    if(payFn && t.planned) addPayChip(row,payFn,payTxt);
    // v1.45.0 — era una pianificata arrivata a scadenza: si può spostare la data (torna pianificata).
    const canMove=!t.planned && t.plannedId && !t.earlyFor && !isTransfer;
    const doDelete=()=>{
        let deleted;
        if(t.planned){const p=state.planned.find(x=>x.id===t.plannedId);if(p){moveToTrash("planned",p);deleted=state.trash[0]?.id;}state.planned=state.planned.filter(p=>p.id!==t.plannedId);}
        else {
          const linked=linkedTx(t);
          moveToTrash("transaction",t,linked);deleted=state.trash[0]?.id;
          const ids=new Set([t.id,...linked.map(x=>x.id)]);
          state.transactions=state.transactions.filter(x=>!ids.has(x.id));
        }
        persist();renderAll();if(deleted) showUndo("Elemento eliminato",deleted);
    };
    // v1.65.0 — scorri la riga: ← elimina (con Annulla), → duplica
    if(!t.planned && !t.isBalanceAdjustment) enableRowSwipe(row,{onLeft:doDelete,onRight:canDuplicate?()=>duplicateTransaction(t):null});
    enableLongPressActions(row,{
      title:title,
      onPayNow:payFn,payLabel:payTxt,
      onMove:canMove?()=>moveRealizedPlanned(t.id):null,
      onDuplicate:canDuplicate?()=>duplicateTransaction(t):null,
      // v1.10.7: un movimento registrato può diventare ricorrente o essere pianificato di nuovo.
      onRecurring:canDuplicate&&!isTransfer&&!t.recurringId?()=>openRecurringForm(null,futureFromTx(t)):null,
      onPlanned:canDuplicate&&!isTransfer&&!canMove?()=>openPlannedForm(null,futureFromTx(t)):null,
      onEdit:()=>{
        if(t.recurringId && state.recurring.some(r=>r.id===t.recurringId)) openRecurringForm(t.recurringId);
        else if(t.planned) openPlannedForm(t.plannedId);
        else openAddTransaction(t.id);
      },
      onDelete:doDelete
    });
    container.appendChild(row);
  });
}

function escapeHtml(str){
  const d = document.createElement("div");
  d.textContent = String(str ?? "");
  return d.innerHTML;
}
function safeColor(value,fallback="#999999"){
  const v=String(value||"");
  return /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;
}
function activateRowFromKeyboard(row,callback){
  row.addEventListener("keydown",e=>{
    if(e.target!==row || (e.key!=="Enter" && e.key!==" ")) return;
    e.preventDefault();callback();
  });
}

/* ---------------- Rendering: Transactions (full) ---------------- */
/* v1.61.0 — Riepilogo entrate/uscite sotto la scelta della data (Vedi tutti: movimenti e R&P). */
function periodSumHtml(income,expense,net,caption){
  const s=v=>balancesHidden?"••••":fmt(v);
  return `<div class="ps-tiles"><div class="ps-tile in"><span>Entrate</span><b>${income>0.004?"+":""}${s(income)}</b></div><div class="ps-tile out"><span>Uscite</span><b>${expense>0.004?"−":""}${s(expense)}</b></div></div><p class="ps-note">${caption}${Math.abs(net)>0.004?` · netto ${net>=0?"+":"−"}${s(Math.abs(net))}`:""}</p>`;
}
function renderTransactionsView(){
  document.getElementById("txMonthLabel").textContent = periodLabel("transactions");
  const pbtn=document.getElementById("txPeriodBtn"); if(pbtn) pbtn.innerHTML=`<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 10h16M9 3v4M15 3v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span>${periodLabel("transactions")}</span>`;
  const cats=categoriesById(), accounts=accountsById();
  const matches=(t,noChips)=>{
    if(txFilter!=="all"&&t.type!==txFilter) return false;
    if(!noChips&&txCatFilter){ const c=cats[t.categoryId]; const k=c?(c.parentCategoryId&&cats[c.parentCategoryId]?c.parentCategoryId:c.id):null; if(k!==txCatFilter) return false; }
    if(!noChips&&txAccFilter&&t.accountId!==txAccFilter&&t.toAccountId!==txAccFilter) return false;
    if(txDateFrom&&t.date<txDateFrom) return false;if(txDateTo&&t.date>txDateTo) return false;
    const q=txSearchQuery.toLocaleLowerCase("it"); if(!q) return true;
    const hay=[t.name,t.note,cats[t.categoryId]?.name,cats[cats[t.categoryId]?.parentCategoryId]?.name,accounts[t.accountId]?.name,accounts[t.toAccountId]?.name,t.type].filter(Boolean).join(" ").toLocaleLowerCase("it");
    return hay.includes(q);
  };
  const base=periodTx("transactions").filter(t=>!t.isBalanceAdjustment);
  const all = base.filter(t=>matches(t)).slice().sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
  const visibleAll=all.slice(0,txVisibleLimit);
  /* v1.52.0 — In cima: quanti movimenti e totali di quello che vedi (utile con la ricerca).
     Movimenti divisi per giorno, con il netto della giornata. */
  {
    const listEl=document.getElementById("allTx");
    let sum=document.getElementById("allTxSummary");
    if(!sum){ sum=document.createElement("div"); sum.id="allTxSummary"; sum.className="period-sum"; document.getElementById("txCustomRange").after(sum); }
    const show=v=>balancesHidden?"••••":fmt(v);
    const {income,expense,net}=sumTransactions(all);
    const fName=txCatFilter?categoriesById()[txCatFilter]?.name:txAccFilter?accounts[txAccFilter]?.name:"";
    sum.innerHTML=periodSumHtml(income,expense,net,`${all.length} ${all.length===1?"movimento":"movimenti"}${txSearchQuery?` per “${escapeHtml(txSearchQuery)}”`:""}${fName?` · ${escapeHtml(fName)}`:""}`);
    let chipsEl=document.getElementById("txChips");
    if(!chipsEl){ chipsEl=document.createElement("div"); chipsEl.id="txChips"; sum.after(chipsEl); }
    const sl=chipsEl.querySelector(".mchips")?.scrollLeft||0;
    chipsEl.innerHTML=mtChipsHtml(base.filter(t=>matches(t,true)));
    const nr=chipsEl.querySelector(".mchips"); if(nr) nr.scrollLeft=sl;
    withHighlight(txSearchQuery,()=>{
      listEl.innerHTML="";
      const groups=[];
      visibleAll.forEach(t=>{ const g=groups[groups.length-1]; if(g&&g.date===t.date) g.items.push(t); else groups.push({date:t.date,items:[t]}); });
      const today=todayISO(), yest=previousISO(today);
      groups.forEach(g=>{
        const d=new Date(g.date+"T12:00:00");
        const label=g.date===today?"Oggi":g.date===yest?"Ieri":d.toLocaleDateString("it-IT",{weekday:"long",day:"numeric",month:"long"});
        const n=sumTransactions(g.items).net;
        const h=document.createElement("div"); h.className="tx-day-head";
        h.innerHTML=`<span>${escapeHtml(label.charAt(0).toUpperCase()+label.slice(1))}</span>${Math.abs(n)>0.004?`<b class="${n>0?"pos":"neg"}">${n>0?"+":"−"}${show(Math.abs(n))}</b>`:""}`;
        listEl.appendChild(h);
        const box=document.createElement("div"); box.className="tx-day-group";
        renderTxRows(box,g.items,{compact:true});
        listEl.appendChild(box);
      });
    });
  }
  const loadMore=document.getElementById("loadMoreTxBtn");
  if(loadMore){loadMore.hidden=visibleAll.length>=all.length;loadMore.textContent=`Carica altri (${all.length-visibleAll.length})`;}
  document.getElementById("allTxEmptyHint").hidden = all.length>0;
  document.getElementById("allTxEmptyHint").textContent=periodModes.transactions==="day"?"Nessun movimento in questo giorno.":periodModes.transactions==="range"?"Nessun movimento nel periodo.":"Nessun movimento questo mese.";

  const planned = plannedItemsInPeriod("transactions").filter(t=>matches(t)).sort((a,b)=> a.date.localeCompare(b.date));
  const plannedWrap = document.getElementById("allTxPlannedWrap");
  const ph=plannedWrap.querySelector("h2"); if(ph) ph.textContent=periodModes.transactions==="month"?"In arrivo questo mese":periodModes.transactions==="day"?"In arrivo in questo giorno":"In arrivo nel periodo";
  if(planned.length){
    plannedWrap.hidden = false;
    withHighlight(txSearchQuery,()=>renderTxRows(document.getElementById("allTxPlanned"), planned));
  } else {
    plannedWrap.hidden = true;
  }
}

function rpEstimatesForMonth(y=viewYear,m=viewMonth){
  const prefix=`${y}-${pad2(m+1)}`;
  const future=plannedItemsForMonth(y,m);
  const itemsForOrigin=(origin)=>[
    ...state.transactions.filter(t=>t[origin] && t.date.startsWith(prefix)),
    ...future.filter(t=>t[origin])
  ];
  const summarize=(items)=>{
    const income=items.filter(t=>t.type==="income").reduce((sum,t)=>sum+t.amount,0);
    const expense=items.filter(t=>t.type==="expense").reduce((sum,t)=>sum+t.amount,0);
    const byAccount={};
    items.forEach(t=>{
      if(!t.accountId || !["income","expense"].includes(t.type)) return;
      if(!byAccount[t.accountId]) byAccount[t.accountId]={income:0,expense:0,net:0};
      byAccount[t.accountId][t.type]+=t.amount;
      byAccount[t.accountId].net += t.type==="income"?t.amount:-t.amount;
    });
    return {income,expense,net:income-expense,byAccount};
  };
  // v1.6.0: i contatori principali mostrano solo ciò che è ANCORA da registrare;
  // quando una voce diventa movimento esce dal contatore. Il totale del mese resta come riferimento.
  const pending=(origin)=>future.filter(t=>t[origin]);
  const recurring=summarize(pending("recurringId"));
  const planned=summarize(pending("plannedId"));
  const total=summarize([...pending("recurringId"),...pending("plannedId")]);
  recurring.month=summarize(itemsForOrigin("recurringId"));
  planned.month=summarize(itemsForOrigin("plannedId"));
  total.month=summarize([...itemsForOrigin("recurringId"),...itemsForOrigin("plannedId")]);
  return {recurring,planned,total,monthItems:{recurring:itemsForOrigin("recurringId"),planned:itemsForOrigin("plannedId")}};
}
/* v1.63.0 — R&P: uscite del mese per macrocategoria, divise tra ricorrenti e pianificate. */
function renderRPMacroSummary(){
  const block=document.getElementById("rpMacroBlock"), box=document.getElementById("rpMacroList"); if(!block||!box) return;
  const est=rpEstimatesForMonth(), cats=categoriesById(), show=v=>balancesHidden?"••••":fmt(v);
  const macros={}; (state.macroCategories||[]).forEach(m=>{macros[m.id]=m;});
  const macroOf=t=>{ const c=cats[t.categoryId]; return (c&&(c.macroCategoryId||cats[c.parentCategoryId]?.macroCategoryId))||"_none"; };
  const acc={};
  const add=(items,key)=>items.filter(t=>t.type==="expense"&&!t.isBalanceAdjustment).forEach(t=>{ const k=macroOf(t); (acc[k]=acc[k]||{rec:0,pl:0})[key]+=t.amount; });
  if(rpMode!=="planned") add(est.monthItems.recurring,"rec");
  if(rpMode!=="recurring") add(est.monthItems.planned,"pl");
  const rows=Object.entries(acc).map(([k,v])=>({k,rec:v.rec,pl:v.pl,tot:v.rec+v.pl})).filter(r=>r.tot>0.004).sort((a,b)=>b.tot-a.tot);
  block.hidden=!rows.length; if(!rows.length){ box.innerHTML=""; return; }
  const grand=rows.reduce((s,r)=>s+r.tot,0), both=rpMode==="total";
  document.getElementById("rpMacroHint").textContent=(rpMode==="total"?"Ricorrenti e pianificate insieme":rpMode==="recurring"?"Solo ricorrenti":"Solo pianificate")+` · ${MESI[viewMonth].toLowerCase()}, già registrate e in arrivo · totale ${show(grand)}`;
  box.innerHTML=rows.map(r=>{
    const mc=macros[r.k]||{name:r.k==="_none"?"Senza categoria":"Macro categoria eliminata",emoji:"•",color:"#999999"};
    const col=safeColor(mc.color), pct=r.tot/grand*100, share=Math.round(pct);
    const rw=both?r.rec/grand*100:(rpMode==="recurring"?pct:0), pw=both?r.pl/grand*100:(rpMode==="planned"?pct:0);
    const sub=both?`${r.rec>0.004?`↻ ${show(r.rec)}`:""}${r.rec>0.004&&r.pl>0.004?" · ":""}${r.pl>0.004?`◷ ${show(r.pl)}`:""}`:"";
    return `<div class="plan-row"><span class="plan-ic" aria-hidden="true">${escapeHtml(mc.emoji||"•")}</span><span class="plan-name">${escapeHtml(mc.name)}</span><span class="plan-amt"><b>${show(r.tot)}</b><small class="plan-delta">${share}%</small></span><span class="plan-bar split" aria-hidden="true"><i style="width:${rw.toFixed(1)}%;background:${col}"></i><i style="width:${pw.toFixed(1)}%;background:${col};opacity:.5"></i></span>${sub?`<span class="plan-sub">${sub}</span>`:""}</div>`;
  }).join("");
}
/* v1.71.0 — riga "Resta da pagare" per R&P (schede e Vedi tutti) */
function rpLeftHtml(leftExp,totExp,leftInc,when){
  const show=v=>balancesHidden?"••••":fmt(v), paid=Math.max(0,totExp-leftExp);
  const main=totExp<0.005&&leftExp<0.005
    ? `<div class="rp-left-row"><span>Resta da pagare ${when}</span><b class="zero">${show(0)}</b></div>`
    : leftExp<0.005
      ? `<div class="rp-left-row done"><span>Resta da pagare ${when}</span><b class="zero">Tutto pagato ✓</b></div>`
      : `<div class="rp-left-row"><span>Resta da pagare ${when}</span><b class="neg">−${show(leftExp)}</b></div>`;
  const sub=totExp>0.004?`<small>Pagati ${show(paid)} su ${show(totExp)}${leftInc>0.004?` · da incassare +${show(leftInc)}`:""}</small>`:leftInc>0.004?`<small>Da incassare +${show(leftInc)}</small>`:"";
  return main+sub;
}
function updateRPEstimates(){
  renderRPMacroSummary();
  const estimates=rpEstimatesForMonth();
  const setMoney=(id,value,{signed=false}={})=>{
    const el=document.getElementById(id); if(!el) return;
    el.textContent=balancesHidden?"••••":(signed?fmtSigned(value):fmt(value));
    if(signed) el.className=`rp-estimate-value ${value<0?"neg":value>0?"pos":"zero"}`;
  };
  const renderAccounts=(id,summary)=>{
    const el=document.getElementById(id); if(!el) return;
    const rows=state.accounts
      .map(a=>({account:a,values:summary.byAccount[a.id]}))
      .filter(x=>x.values && (x.values.income || x.values.expense))
      .sort((a,b)=>Math.abs(b.values.net)-Math.abs(a.values.net));
    el.innerHTML=rows.length
      ? `<div class="rp-account-title">Per conto/carta</div>${rows.map(({account,values})=>`<div class="rp-account-row"><span>${escapeHtml(account.name)}</span><b class="${values.net<0?"neg":values.net>0?"pos":""}">${balancesHidden?"••••":fmtSigned(values.net)}</b></div>`).join("")}`
      : `<div class="rp-account-empty">Nessun importo per conto/carta</div>`;
  };
  const setLabel=(sel,title,summary)=>{
    const el=document.querySelector(sel); if(!el) return;
    const m=summary.month;
    const done=m.net-summary.net;
    el.innerHTML=title;
  };
  setMoney("recurringEstimate",estimates.recurring.net,{signed:true});
  // v1.6.5: Entrate/Uscite = totale del mese; il numero grande e "per conto/carta" = ancora da registrare.
  setMoney("plannedEstimate",estimates.planned.net,{signed:true});
  setMoney("rpCombinedEstimate",estimates.total.net,{signed:true});
  // v1.19.0: riquadri Entrate / Uscite: totale del mese, barra di quanto è già registrato e quanto manca.
  const setTiles=(pre,summary)=>{
    [["Income","income","+"],["Expense","expense","−"]].forEach(([K,k,sign])=>{
      const tot=summary.month[k]||0, pend=Math.min(summary[k]||0,tot), done=Math.max(0,tot-pend), zero=tot<0.005;
      const amt=document.getElementById(`${pre}${K}Estimate`), bar=document.getElementById(`${pre}${K}Bar`), note=document.getElementById(`${pre}${K}Note`);
      if(amt) amt.textContent=balancesHidden?"••••":zero?fmt(0):`${sign}${fmt(tot)}`;
      if(bar) bar.style.width=zero?"0%":`${(done/tot*100).toFixed(1)}%`;
      if(note) note.textContent=zero?"Niente nel mese":pend<0.005?"Tutto registrato":`${balancesHidden?"••••":fmt(pend)} da registrare`;
      amt?.closest(".fc-tile")?.classList.toggle("zero",zero);
    });
  };
  setTiles("recurring",estimates.recurring); setTiles("planned",estimates.planned); setTiles("rpCombined",estimates.total);
  try{ renderRPDash(); }catch(e){ console.error(e); }
  /* v1.71.0 — RESTA DA PAGARE NEL MESE, ben visibile in ogni scheda (anche in Totali, dove le note dei riquadri sono
     nascoste): uscite ancora da registrare, quanto è già pagato e su quanto; sotto, se ci sono, le entrate da incassare. */
  const setLeft=(cardId,summary)=>{
    const card=document.getElementById(cardId); if(!card) return;
    let el=card.querySelector(".rp-left");
    if(!el){ el=document.createElement("div"); el.className="rp-left"; const tiles=card.querySelector(".rp-est-tiles"); (tiles||card.lastElementChild).after(el); }
    el.innerHTML=rpLeftHtml(summary.expense||0,summary.month.expense||0,summary.income||0,"nel mese");
  };
  setLeft("recurringEstimateCard",estimates.recurring); setLeft("plannedEstimateCard",estimates.planned); setLeft("rpTotalEstimateCard",estimates.total);
  renderAccounts("recurringAccountBreakdown",estimates.recurring);
  renderAccounts("plannedAccountBreakdown",estimates.planned);
  renderAccounts("rpCombinedAccountBreakdown",estimates.total);
  const toggle=document.getElementById("toggleRPBalance");
  if(toggle){setEyeIcon(toggle,balancesHidden,"Mostra importi R&P","Nascondi importi R&P");}
}


function recurringDatesForMonth(r,y=viewYear,m=viewMonth){
  const prefix=`${y}-${pad2(m+1)}`;
  const actual=state.transactions.filter(t=>t.recurringId===r.id && t.date.startsWith(prefix)).map(t=>t.date);
  const projected=recurringOccurrencesInMonth(r,y,m);
  return [...new Set([...actual,...projected])].sort();
}
function rpDateMatchesPeriod(iso){
  return inPeriod("recurring",iso);
}
function recurringProjectedDatesForPeriod(r){
  return monthsInPeriod("recurring").flatMap(([y,m])=>recurringOccurrencesInMonth(r,y,m)).filter(iso=>inPeriod("recurring",iso));
}
function paidScheduledTransactionsForPeriod(kind,y=viewYear,m=viewMonth){
  const key=kind==="recurring"?"recurringId":"plannedId";
  return state.transactions
    .filter(t=>t[key] && rpDateMatchesPeriod(t.date,y,m))
    .slice()
    .sort((a,b)=>b.date.localeCompare(a.date)||String(b.id).localeCompare(String(a.id)));
}
function plannedForRPMonth(){
  return state.planned.filter(p=>p.date && inPeriod("recurring",p.date));
}
function renderRPPaidSection({sectionId,noticeId,countId,listId,paid,hasUpcoming}){
  const section=document.getElementById(sectionId);
  const notice=document.getElementById(noticeId);
  const count=document.getElementById(countId);
  const list=document.getElementById(listId);
  if(!section || !list) return;
  section.hidden=paid.length===0;
  if(notice) notice.hidden=paid.length===0 || hasUpcoming;
  if(count) count.textContent=paid.length ? `${paid.length}` : "";
  if(paid.length){const lim=rpLimited(listId,paid);withHighlight(rpSearchQuery,()=>renderTxRows(list,lim.shown,{paidLabel:true}));rpAppendMore(list,listId,lim.hidden);}
  else list.innerHTML="";
}

/* v1.7.0 — R&P: ricerca e liste brevi (prossimi 5 / ultimi 5 pagati, con "Mostra tutti"). */
let rpSearchQuery="";
const rpShowAll={};
const RP_LIMIT=5;
function rpMatches(name,categoryId,accountId){
  const q=rpSearchQuery.trim().toLocaleLowerCase("it"); if(!q) return true;
  const cats=categoriesById(), accs=accountsById();
  return [name,cats[categoryId]?.name,cats[cats[categoryId]?.parentCategoryId]?.name,accs[accountId]?.name].filter(Boolean).join(" ").toLocaleLowerCase("it").includes(q);
}
function rpLimited(listId,items){
  const searching=!!rpSearchQuery.trim(), total=items.length;
  // v1.7.1: pulsante "Vedi tutti ›" nell'intestazione della lista, come in Home.
  const pill=document.querySelector(`[data-see-all="${listId}"]`);
  if(pill){
    pill.hidden=total===0;
    pill.innerHTML=`<span class="sa-label">Vedi tutti</span><span class="count-badge">${total}</span><span class="chev">›</span>`;
  }
  if(total<=RP_LIMIT) return {shown:items,hidden:0};
  return {shown:items.slice(0,RP_LIMIT),hidden:total-RP_LIMIT};
}
function rpAppendMore(){}
document.querySelectorAll("[data-see-all]").forEach(b=>b.addEventListener("click",()=>{
  // v1.8.0: "Vedi tutti" in R&P apre un pannello dedicato, come in Home.
  const id=b.dataset.seeAll;
  rpAllKind=/recurring/i.test(id)?"recurring":/planned/i.test(id)?"planned":"total";
  periodModes.rpall=periodModes.recurring; rpAllQuery=""; const inp=document.getElementById("rpAllSearchInput"); if(inp) inp.value="";
  openSubView("rpall");
}));
/* ---------------- Rendering: Ricorrenti ---------------- */
function renderRecurringList(){
  const container = document.getElementById("recurringList");
  container.innerHTML = "";
  const upcoming=state.recurring
    .map(r=>({r,dates:recurringProjectedDatesForPeriod(r)}))
    .filter(x=>x.dates.length>0 && rpMatches(x.r.name,x.r.categoryId,x.r.accountId))
    .sort((a,b)=>a.dates[0].localeCompare(b.dates[0]));
  const lim=rpLimited("recurringList",upcoming);
  withHighlight(rpSearchQuery,()=>lim.shown.forEach(({r,dates})=>container.appendChild(recurringRowElement(r,{dates}))));
  rpAppendMore(container,"recurringList",lim.hidden);

  const paid=paidScheduledTransactionsForPeriod("recurring").filter(t=>rpMatches(t.name,t.categoryId,t.accountId));
  const empty=document.getElementById("recurringEmptyHint");
  if(empty){
    empty.hidden=upcoming.length>0 || paid.length>0;
    empty.textContent=periodModes.recurring==="range"?"Nessun movimento ricorrente nel periodo.":periodModes.recurring==="day"?"Nessun movimento ricorrente nel giorno selezionato.":"Nessun movimento ricorrente nel mese selezionato.";
  }
  renderRPPaidSection({
    sectionId:"recurringPaidSection",noticeId:"recurringAllPaidNotice",countId:"recurringPaidCount",listId:"recurringPaidList",
    paid,hasUpcoming:upcoming.length>0
  });
  updateRPEstimates();
}

/* ---------------- Rendering: Spese pianificate ---------------- */
function plannedRowElement(p,{compact=true}={}){
  const cats=categoriesById(), accs=accountsById();
  const cat=cats[p.categoryId]?{...cats[p.categoryId],name:categoryLabel(p.categoryId)}:{};
  const acc=accs[p.accountId]||{name:"Conto eliminato"};
  const d=p.date?new Date(p.date+"T00:00:00"):null;
  const whenLabel=d?`${d.getDate()} ${MESI_BREVI[d.getMonth()]} ${d.getFullYear()}`:"—";
  const days=d?Math.ceil((d-new Date(todayISO()+"T00:00:00"))/86400000):null;
  const relative=days===0?"oggi":days===1?"domani":days>1?`tra ${days} giorni`:"";
  const row=document.createElement("div");
  row.setAttribute("role","button");row.tabIndex=0;
  row.className="template-manage-row planned-row mv-row mv-kind-planned";
  row.dataset.sortDate=p.date||"";
  row.innerHTML=movementRowHtml({emoji:cat.emoji||"📌",color:cat.color,title:p.name||cat.name||"Pianificata",
    badges:`<span class="status-badge planned">Pianificata</span>`,
    meta:`<span>${hlText(cat.name||"Senza categoria")}</span><span class="mv-sep" aria-hidden="true">·</span><span class="mv-acc">${hlText(acc.name)}</span>${splitLabel(p)}`,
    amountHtml:`${p.type==="income"?"+":"−"}${fmt(myAmount(p))}${myAmount(p)!==p.amount?`<small class="mv-of-total">su ${fmt(p.amount)}</small>`:""}`,type:p.type,date:p.date,kind:"planned"});
  const openRow=()=>{if(!row._skipClick) openScheduledDetail("planned",p.id);};
  row.addEventListener("click",openRow);activateRowFromKeyboard(row,openRow);
  enableLongPressActions(row,{title:p.name||cat.name||"Pianificata",onEdit:()=>openPlannedForm(p.id),onDuplicate:()=>duplicateRP("planned",p.id),
    onPayNow:p.date>todayISO()?()=>payPlannedNow(p.id):null,payLabel:"Paga ora ed estingui",onDelete:()=>{const item=state.planned.find(x=>x.id===p.id);if(item)moveToTrash("planned",item);const deleted=state.trash[0]?.id;state.planned=state.planned.filter(x=>x.id!==p.id);persist();renderAll();if(deleted)showUndo("Pianificata eliminata",deleted);}});
  if(p.date>todayISO()) addPayChip(row,()=>payPlannedNow(p.id),"Paga ora ed estingui");
  return row;
}
function recurringRowElement(r,{dates=null}={}){
  const cats=categoriesById(),accs=accountsById();
  const cat=cats[r.categoryId]?{...cats[r.categoryId],name:categoryLabel(r.categoryId)}:{},acc=accs[r.accountId]||{name:"Conto eliminato"};
  const row=document.createElement("div");
  row.setAttribute("role","button");row.tabIndex=0;row.className="template-manage-row mv-row mv-kind-recurring";
  const displayDates=dates || recurringDatesForMonth(r,viewYear,viewMonth);
  row.dataset.sortDate=displayDates[0]||"";
  const extra=displayDates.length>1?`<span class="mv-sep" aria-hidden="true">·</span><span>anche ${displayDates.slice(1).map(x=>parseInt(x.slice(8,10),10)).join(", ")}</span>`:"";
  row.innerHTML=movementRowHtml({emoji:cat.emoji||"🔁",color:cat.color,title:r.name,
    badges:`<span class="status-badge recurring">Ricorrente</span>`,
    meta:`<span>${hlText(cat.name||"Senza categoria")}</span><span class="mv-sep" aria-hidden="true">·</span><span class="mv-acc">${hlText(acc.name)}</span>${splitLabel(r)}${extra}`,
    amountHtml:`${r.type==="income"?"+":"−"}${fmt(myAmount(r))}${myAmount(r)!==r.amount?`<small class="mv-of-total">su ${fmt(r.amount)}</small>`:""}`,type:r.type,date:displayDates[0],kind:"recurring"});
  const openRow=()=>{if(!row._skipClick)openScheduledDetail("recurring",r.id,displayDates[0]);};
  row.addEventListener("click",openRow);activateRowFromKeyboard(row,openRow);
  enableLongPressActions(row,{title:r.name,onEdit:()=>openRecurringForm(r.id),onDuplicate:()=>duplicateRP("recurring",r.id),
    onPayNow:recurringNextDue(r)?()=>payRecurringNow(r.id):null,payLabel:recurringNextDue(r)?`Paga ora la rata del ${shortDate(recurringNextDue(r))}`:"",onDelete:()=>{moveToTrash("recurring",r);const deleted=state.trash[0]?.id;removeRecurring(r.id);persist();renderAll();if(deleted)showUndo("Ricorrente eliminato",deleted);}});
  { const due=recurringNextDue(r); if(due && displayDates[0]===due) addPayChip(row,()=>payRecurringNow(r.id),`Paga ora la rata del ${shortDate(due)}`); }
  return row;
}
function renderPlannedList(){
  const allContainer=document.getElementById("plannedList");
  const rpContainer=document.getElementById("plannedListRP");
  const allItems=state.planned.slice().sort((a,b)=>(a.date||"").localeCompare(b.date||""));
  const rpItems=plannedForRPMonth().filter(p=>rpMatches(p.name,p.categoryId,p.accountId)).slice().sort((a,b)=>(a.date||"").localeCompare(b.date||""));
  if(allContainer){allContainer.innerHTML="";allItems.forEach(p=>allContainer.appendChild(plannedRowElement(p)));}
  if(rpContainer){rpContainer.innerHTML="";const lim=rpLimited("plannedListRP",rpItems);withHighlight(rpSearchQuery,()=>lim.shown.forEach(p=>rpContainer.appendChild(plannedRowElement(p))));rpAppendMore(rpContainer,"plannedListRP",lim.hidden);}
  const allHint=document.getElementById("plannedEmptyHint");if(allHint)allHint.hidden=allItems.length>0;

  const paid=paidScheduledTransactionsForPeriod("planned").filter(t=>rpMatches(t.name,t.categoryId,t.accountId));
  const rpHint=document.getElementById("plannedEmptyHintRP");
  if(rpHint){
    rpHint.hidden=rpItems.length>0 || paid.length>0;
    rpHint.textContent=periodModes.recurring==="range"?"Nessun movimento pianificato nel periodo.":periodModes.recurring==="day"?"Nessun movimento pianificato nel giorno selezionato.":"Nessun movimento pianificato nel mese selezionato.";
  }
  renderRPPaidSection({
    sectionId:"plannedPaidSection",noticeId:"plannedAllPaidNotice",countId:"plannedPaidCount",listId:"plannedPaidList",
    paid,hasUpcoming:rpItems.length>0
  });
  renderRPTotalList();
  updateRPEstimates();
}
function renderRPTotalList(){
  const container=document.getElementById("rpTotalList");if(!container)return;
  container.innerHTML="";
  const recs=state.recurring
    .map(r=>({r,dates:recurringProjectedDatesForPeriod(r)}))
    .filter(x=>x.dates.length>0 && rpMatches(x.r.name,x.r.categoryId,x.r.accountId));
  const planned=plannedForRPMonth().filter(p=>rpMatches(p.name,p.categoryId,p.accountId));
  const rows=withHighlight(rpSearchQuery,()=>[...recs.map(({r,dates})=>recurringRowElement(r,{dates})),...planned.map(p=>plannedRowElement(p))])
    .sort((a,b)=>(a.dataset.sortDate||"").localeCompare(b.dataset.sortDate||""));
  const lim=rpLimited("rpTotalList",rows);
  lim.shown.forEach(row=>container.appendChild(row));
  rpAppendMore(container,"rpTotalList",lim.hidden);

  const paid=[...paidScheduledTransactionsForPeriod("recurring"),...paidScheduledTransactionsForPeriod("planned")].filter(t=>rpMatches(t.name,t.categoryId,t.accountId))
    .sort((a,b)=>b.date.localeCompare(a.date)||String(b.id).localeCompare(String(a.id)));
  const hint=document.getElementById("rpTotalEmptyHint");
  if(hint){
    hint.hidden=rows.length>0 || paid.length>0;
    hint.textContent=periodModes.recurring==="range"?"Nessun movimento R&P nel periodo.":periodModes.recurring==="day"?"Nessun movimento R&P nel giorno selezionato.":"Nessun movimento R&P nel mese selezionato.";
  }
  renderRPPaidSection({
    sectionId:"rpTotalPaidSection",noticeId:"rpTotalAllPaidNotice",countId:"rpTotalPaidCount",listId:"rpTotalPaidList",
    paid,hasUpcoming:rows.length>0
  });
}

/* ---------------- Rendering: Stats ---------------- */
let statsTrendRange = "1m", trendMode="flow";
function statsTransactions(withAdjustments=false){
  const end = new Date(viewYear,viewMonth+1,0);
  const start = new Date(end);
  if(statsTrendRange==="1w") start.setDate(end.getDate()-6);
  else if(statsTrendRange==="2w") start.setDate(end.getDate()-13);
  else if(statsTrendRange==="1m") start.setDate(1);
  else {
    const months={"2m":2,"3m":3,"6m":6,"1y":12}[statsTrendRange] || 1;
    start.setMonth(end.getMonth()-(months-1),1);
  }
  const from=`${start.getFullYear()}-${pad2(start.getMonth()+1)}-${pad2(start.getDate())}`;
  const to=`${end.getFullYear()}-${pad2(end.getMonth()+1)}-${pad2(end.getDate())}`;
  return state.transactions.filter(t=>(withAdjustments||!t.isBalanceAdjustment) && t.date>=from && t.date<=to);
}
/* v1.45.0 — Periodo della scheda Statistiche scritto per esteso (titolo del popup categoria). */
function statsPeriodLabel(){
  const end=new Date(viewYear,viewMonth+1,0), start=new Date(end);
  if(statsTrendRange==="1w") start.setDate(end.getDate()-6);
  else if(statsTrendRange==="2w") start.setDate(end.getDate()-13);
  else if(statsTrendRange==="1m") return `${MESI[viewMonth]} ${viewYear}`;
  else start.setMonth(end.getMonth()-(({"2m":2,"3m":3,"6m":6,"1y":12}[statsTrendRange]||1)-1),1);
  const f=d=>`${d.getDate()} ${MESI_BREVI[d.getMonth()].toLowerCase()}${d.getFullYear()!==end.getFullYear()?" "+d.getFullYear():""}`;
  return `${f(start)} – ${f(end)} ${end.getFullYear()}`;
}
/* v1.45.0 — Statistiche: tocca una categoria (o macrocategoria) della ripartizione e vedi
   tutti i suoi movimenti del periodo scelto nella scheda. */
function openStatsCategoryMovements(key,info){
  const cats=categoriesById();
  const list=statsTransactions().filter(t=>t.type===statsNature).filter(t=>{
    if(statsGroupMode==="macro"){ const c=cats[t.categoryId]; const m=(c&&c.macroCategoryId&&macroCategoriesById()[c.macroCategoryId])?c.macroCategoryId:"none"; return m===key; }
    return String(rollUpCategoryId(t.categoryId))===String(key);
  }).sort((a,b)=>b.date.localeCompare(a.date));
  const total=list.reduce((s,t)=>s+t.amount,0);
  openSheet("tpl-day-detail",(node)=>{
    node.classList.add("stats-cat-sheet");
    node.querySelector("#dayDetailTitle").textContent=`${info.emoji||""} ${info.name}`.trim();
    const sub=document.createElement("p");sub.className="stats-cat-sub";
    sub.innerHTML=`<span>${escapeHtml(statsPeriodLabel())} · ${list.length} moviment${list.length===1?"o":"i"}</span><b>${maskAmt(fmt(total))}</b>`;
    node.querySelector(".sheet-head").after(sub);
    renderTxRows(node.querySelector("#dayDetailList"),list);
    const empty=node.querySelector("#dayDetailEmptyHint"); empty.textContent="Nessun movimento nel periodo."; empty.hidden=list.length>0;
  });
}
function renderTopCategoriesChart(entries,cats){
  if(!entries.length) return `<div class="top-categories-empty">Nessuna spesa nel periodo selezionato.</div>`;
  const max=Math.max(...entries.map(([,v])=>v),1);
  return `<div class="top-categories-chart" role="img" aria-label="Top 5 categorie di spesa">${entries.map(([id,value],index)=>{
    const cat=cats[id]||{};
    const pct=Math.max(4,(value/max)*100);
    const macro=(state.macroCategories||[]).find(m=>m.id===cat.macroCategoryId);
    const color=safeColor(cat.color||macro?.color,PALETTE[index%PALETTE.length]);
    return `<div class="top-category-row">
      <div class="top-category-meta"><span class="top-category-name"><span class="top-category-emoji">${escapeHtml(cat.emoji||"•")}</span>${escapeHtml(cat.name||"Altro")}</span><strong>${fmt(value)}</strong></div>
      <div class="top-category-track" aria-hidden="true"><span class="top-category-bar" style="width:${pct.toFixed(1)}%;background:${color}"></span></div>
    </div>`;
  }).join("")}</div>`;
}
/* v1.23.0 — Confronto con lo stesso mese dell'anno scorso: totale spese e categorie che cambiano di più. */
function renderYearOverYear(){
  const host=document.getElementById("statsInsights"); if(!host) return;
  let box=document.getElementById("statsYoY");
  if(!box){ box=document.createElement("div"); box.id="statsYoY"; box.className="stat-card wide-stat yoy-card"; host.after(box); }
  const ym=(y,m)=>`${y}-${pad2(m+1)}`, cur=ym(viewYear,viewMonth), prev=ym(viewYear-1,viewMonth);
  const sum=(pfx)=>{ const by={}; let tot=0; state.transactions.forEach(t=>{ if(t.type!=="expense"||t.isBalanceAdjustment||!String(t.date).startsWith(pfx)) return; tot+=t.amount; by[t.categoryId]=(by[t.categoryId]||0)+t.amount; }); return {tot,by}; };
  const A=sum(cur), B=sum(prev), cats=categoriesById();
  const amt=v=>balancesHidden?"••••":fmt(v);
  const title=`${MESI[viewMonth]} ${viewYear} e ${MESI[viewMonth].toLowerCase()} ${viewYear-1}`;
  box.style.display="";
  if(!B.tot){ box.innerHTML=""; box.style.display="none"; return; }
  if(false){ box.innerHTML=`<p class="stat-card-label">Rispetto all'anno scorso</p><p class="yoy-empty">Nessuna spesa registrata a ${MESI[viewMonth].toLowerCase()} ${viewYear-1}: il confronto comparirà quando ci saranno dati di un anno fa.</p>`; return; }
  const diff=A.tot-B.tot, pct=Math.round(diff/B.tot*100);
  const ids=[...new Set([...Object.keys(A.by),...Object.keys(B.by)])].map(id=>({id,a:A.by[id]||0,b:B.by[id]||0})).map(x=>({...x,d:x.a-x.b})).sort((x,y)=>Math.abs(y.d)-Math.abs(x.d)).slice(0,4);
  box.innerHTML=`<p class="stat-card-label">Rispetto all'anno scorso · ${escapeHtml(title)}</p>
    <div class="yoy-head"><div><small>${MESI_BREVI[viewMonth]} ${viewYear}</small><b>${amt(A.tot)}</b></div><div><small>${MESI_BREVI[viewMonth]} ${viewYear-1}</small><b>${amt(B.tot)}</b></div><div class="yoy-delta ${diff>0?"up":"down"}"><small>Differenza</small><b>${diff>0?"▲":"▼"} ${Math.abs(pct)}%</b></div></div>
    <div class="yoy-rows">${ids.map(x=>{ const c=cats[x.id]||{name:"Altro",emoji:"❔"}; return `<div class="yoy-row"><span>${escapeHtml(c.emoji||"")} ${escapeHtml(c.name)}</span><span class="yoy-vals">${amt(x.b)} → ${amt(x.a)}</span><b class="${x.d>0?"up":"down"}">${x.d>0?"+":"−"}${balancesHidden?"••":fmt(Math.abs(x.d))}</b></div>`; }).join("")}</div>`;
}
function renderStats(){
  renderStatsBubbles();
  const tx=statsTransactions(), income=tx.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0), expense=tx.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);
  const days=Math.max(1,Math.ceil((new Date(viewYear,viewMonth+1,0)-new Date(viewYear,viewMonth,1))/86400000)+1);
  const cats=categoriesById(), byCat={};tx.filter(t=>t.type==="expense").forEach(t=>{byCat[t.categoryId]=(byCat[t.categoryId]||0)+t.amount;});
  const topEntries=Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,5);
  document.getElementById("statsInsights").innerHTML=`<div class="stat-card stat-row"><p class="stat-card-label">Media spese/giorno</p><p class="stat-card-value neg">${fmt(expense/days)}</p></div><div class="stat-card stat-row"><p class="stat-card-label">Saldo periodo</p><p class="stat-card-value ${income-expense<0?"neg":"pos"}">${fmtSigned(income-expense)}</p></div>`; void topEntries; void cats; /* v1.65.0 — la Top 5 ripeteva "Spese per categoria": tolta */
  renderYearOverYear();
  renderPie();
  renderTrendSection();
  renderAccountBreakdown();
  renderLoanStats();
}

function renderPie(){
  const tx = statsTransactions().filter(t=>t.type===statsNature);
  const cats = categoriesById();
  const macros = macroCategoriesById();
  const totals = {};
  tx.forEach(t=>{
    let key;
    if(statsGroupMode==="macro"){
      const cat = cats[t.categoryId];
      key = (cat && cat.macroCategoryId && macros[cat.macroCategoryId]) ? cat.macroCategoryId : "none";
    } else {
      key = rollUpCategoryId(t.categoryId);   /* v1.37.0: la sottocategoria conta nella madre */
    }
    totals[key] = (totals[key]||0) + t.amount;
  });
  const entries = Object.entries(totals).sort((a,b)=>b[1]-a[1]);
  const total = entries.reduce((s,[,v])=>s+v,0);
  const wrap = document.getElementById("pieWrap");
  const legend = document.getElementById("pieLegend");
  legend.innerHTML = "";

  if(total===0){
    wrap.innerHTML = `<svg class="chart money-donut" width="180" height="180" viewBox="0 0 180 180" role="img" aria-label="Nessuna spesa nel periodo selezionato">
      <circle cx="90" cy="90" r="70" fill="none" stroke="var(--line)" stroke-width="26"/>
      <text x="90" y="86" text-anchor="middle" font-weight="700" font-size="20" fill="var(--ink)">${maskAmt(fmt(0))}</text>
      <text x="90" y="108" text-anchor="middle" font-size="11" fill="var(--ink-soft)">Nessun dato</text>
    </svg>`;
    makeChartExpandable(wrap,"Ripartizione per categoria","Mostra la distribuzione del periodo selezionato.");
    return;
  }

  const size=180, r=70, cx=size/2, cy=size/2, circumference = 2*Math.PI*r;
  let offset = 0;
  let circles = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--line)" stroke-width="26"/>`;
  /* v1.65.0 — ogni fetta ha il colore della sua categoria (come nelle barre e nei Movimenti); se due si somigliano, la seconda prende un colore della tavolozza */
  const usedCol=new Set();
  const sliceColor=(info,i)=>{ let c=safeColor(info&&info.color,""); if(!c||usedCol.has(c.toLowerCase())){ c=PALETTE.find(p=>!usedCol.has(p.toLowerCase()))||PALETTE[i%PALETTE.length]; } usedCol.add(c.toLowerCase()); return c; };
  entries.forEach(([key,val],sliceIndex)=>{
    let info;
    if(statsGroupMode==="macro"){
      info = key==="none" ? {color:"#999",name:"Senza macrocategoria",emoji:"❔"} : macros[key];
    } else {
      info = cats[key] || {color:"#999",name:"Altro",emoji:"❔"};
    }
    const frac = val/total;
    const len = frac*circumference;
    const col = sliceColor(info,sliceIndex);
    circles += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${col}" stroke-width="26"
      stroke-dasharray="${len} ${circumference-len}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})"/>`;
    offset += len;

    const legItem = document.createElement("button");
    legItem.type = "button";
    legItem.className = "pie-legend-item pie-legend-tap";
    legItem.setAttribute("aria-label",`${info.name}: ${maskAmt(fmt(val))}, ${Math.round(frac*100)}%. Vedi i movimenti`);
    legItem.innerHTML = `<span class="sw" style="background:${col}"></span><span class="lbl">${escapeHtml(info.emoji)} ${escapeHtml(info.name)}</span><span class="val"><b>${fmt(val)}</b><small>${Math.round(frac*100)}%</small></span><span class="pie-chev" aria-hidden="true">›</span>`;
    legItem.addEventListener("click",()=>openStatsCategoryMovements(key,info));
    legend.appendChild(legItem);
  });

  wrap.innerHTML = `
    <svg class="chart money-donut" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      ${circles}
      <text x="${cx}" y="${cy-4}" text-anchor="middle" font-weight="700" font-size="20" fill="var(--ink)">${maskAmt(fmt(total))}</text>
      <text x="${cx}" y="${cy+16}" text-anchor="middle" font-size="10.5" fill="var(--ink-soft)">${statsNature==="income"?"entrate":"uscite"} totali</text>
    </svg>`;
  makeChartExpandable(wrap,"Ripartizione per categoria","Mostra la distribuzione del periodo selezionato.");
}

function buildBarsSVG(data,{expOnly=false}={}){
  const w=360, h=190, left=42, right=8, top=16, bottom=30;
  const plotW=w-left-right, plotH=h-top-bottom, baseline=h-bottom;
  /* v1.65.0 — giorno per giorno solo le uscite: lo stipendio (un solo giorno) schiacciava tutte le spese */
  const max=Math.max(1, ...data.map(d=>expOnly?d.expense:Math.max(d.income,d.expense)));
  const slot=plotW/Math.max(1,data.length), barW=expOnly?slot*0.62:slot*0.36;
  const labelStep=Math.max(1,Math.ceil(data.length/7));
  let chart="";
  for(let i=0;i<=3;i++){
    const y=baseline-plotH*i/3;
    const value=max*i/3;
    const label=new Intl.NumberFormat("it-IT", {notation:"compact",maximumFractionDigits:1}).format(value);
    chart+=`<line x1="${left}" y1="${y}" x2="${w-right}" y2="${y}" stroke="var(--line)" stroke-dasharray="3 5"/>
      <text x="${left-7}" y="${y+3}" text-anchor="end" font-size="10" fill="var(--ink-soft)">${maskAmt(label,"•••")}</text>`;
  }
  chart+=`<text x="${left-7}" y="10" text-anchor="end" font-size="10" fill="var(--ink-soft)">€</text>`;
  data.forEach((d,i)=>{
    const x=left+i*slot+slot*0.08;
    const incH=d.income>0?Math.max(1.5,d.income/max*plotH):0;
    const expH=d.expense>0?Math.max(1.5,d.expense/max*plotH):0;
    if(expOnly) chart+=`<rect x="${left+i*slot+slot*0.19}" y="${baseline-expH}" width="${barW}" height="${expH}" rx="3" fill="var(--rust)"><title>${d.label}: uscite ${maskAmt(fmt(d.expense))}</title></rect>`;
    else chart+=`<rect x="${x}" y="${baseline-incH}" width="${barW}" height="${incH}" rx="3" fill="var(--emerald)"><title>${d.label}: entrate ${maskAmt(fmt(d.income))}</title></rect>
      <rect x="${x+slot*0.44}" y="${baseline-expH}" width="${barW}" height="${expH}" rx="3" fill="var(--rust)"><title>${d.label}: uscite ${maskAmt(fmt(d.expense))}</title></rect>`;
    if(i%labelStep===0 || i===data.length-1){
      // Avoid crowding the last two labels in months with 31 days.
      if(i!==data.length-1 && data.length-1-i<labelStep*0.6) return;
      chart+=`<text x="${left+(i+0.5)*slot}" y="${h-10}" text-anchor="middle" font-size="10" fill="var(--ink-soft)">${d.label}</text>`;
    }
  });
  return `<svg class="chart money-bars" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Andamento delle entrate e delle uscite">${chart}</svg>`;
}

/* ---------------- Andamento (Statistiche) ---------------- */
function statsMonthTotals(y=viewYear,m=viewMonth){
  const prefix=`${y}-${pad2(m+1)}`;
  let income=0,expense=0;
  state.transactions.filter(t=>!t.isBalanceAdjustment && t.date.startsWith(prefix)).forEach(t=>{
    if(t.type==="income") income+=t.amount; else if(t.type==="expense") expense+=t.amount;
  });
  return {income,expense,net:income-expense};
}

function computeTrendData(range){
  if(range==="1m"){
    const y=viewYear, m=viewMonth;
    const daysInMonth = new Date(y, m+1, 0).getDate();
    const data = [];
    for(let d=1; d<=daysInMonth; d++){
      const iso = `${y}-${pad2(m+1)}-${pad2(d)}`;
      let income=0, expense=0;
      state.transactions.filter(t=>!t.isBalanceAdjustment && t.date===iso).forEach(t=>{ t.type==="income" ? income+=t.amount : expense+=t.amount; });
      data.push({ label:String(d), date:iso, income, expense });
    }
    return data;
  }
  if(range==="1w" || range==="2w"){
    const days = range==="1w" ? 7 : 14;
    const data = [];
    for(let i=days-1;i>=0;i--){
      const today = new Date();
      const inViewedMonth=today.getFullYear()===viewYear && today.getMonth()===viewMonth;
      const d = inViewedMonth ? new Date(viewYear,viewMonth,today.getDate()) : new Date(viewYear,viewMonth+1,0);
      d.setDate(d.getDate()-i);
      const iso = `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
      let income=0, expense=0;
      state.transactions.filter(t=>!t.isBalanceAdjustment && t.date===iso).forEach(t=>{ t.type==="income" ? income+=t.amount : expense+=t.amount; });
      data.push({ label: `${d.getDate()}/${d.getMonth()+1}`, date:iso, income, expense });
    }
    return data;
  }
  const monthsMap = { "2m":2, "3m":3, "6m":6, "1y":12 };
  const n = monthsMap[range] || 6;
  const months = [];
  for(let i=n-1;i>=0;i--){
    let m = viewMonth - i, y = viewYear;
    while(m<0){ m+=12; y-=1; }
    months.push({y,m});
  }
  return months.map(({y,m})=>({ ...statsMonthTotals(y,m), label: MESI_BREVI[m], date:`${y}-${pad2(m+1)}-${pad2(new Date(y,m+1,0).getDate())}` }));
}

function renderTrendSection(){
  const data = trendMode==="compare" ? computeTrendData("2m") : computeTrendData(statsTrendRange);
  if(trendMode==="balance"){
    let running=data.length?totalBalanceAtDate(previousISO(data[0].date)):totalBalance();
    const points=data.map(d=>{running+=d.income-d.expense;return {...d,balance:running};});
    const wrap=document.getElementById("barWrap");
    wrap.innerHTML=buildLineSVG(points,"var(--ink)");
    const bn=document.getElementById("barNote"); if(bn) bn.hidden=true;
    setupLineChart(wrap,points);
  }else {
    const daily=trendMode!=="compare"&&["1m","1w","2w"].includes(statsTrendRange);
    const wrap=document.getElementById("barWrap");wrap.innerHTML = buildBarsSVG(data,{expOnly:daily});
    let note=document.getElementById("barNote"); if(!note){ note=document.createElement("p"); note.id="barNote"; note.className="mt-chart-note"; note.textContent="Giorno per giorno: solo le uscite. Le entrate sono nel totale qui sotto."; wrap.after(note); }
    note.hidden=!daily;
    makeChartExpandable(wrap,trendMode==="compare"?"Confronto mensile":"Entrate e uscite","Confronta entrate e uscite nel periodo selezionato.");
  }
  const totalIncome = data.reduce((s,d)=>s+d.income,0);
  const totalExpense = data.reduce((s,d)=>s+d.expense,0);
  const net = totalIncome - totalExpense;
  document.getElementById("trendLegend").innerHTML = `
    <div class="stat-cards-row">
      <div class="stat-card">
        <p class="stat-card-label"><span class="sw" style="background:var(--emerald-soft)"></span>Entrate</p>
        <p class="stat-card-value" style="color:var(--emerald)">${fmt(totalIncome)}</p>
      </div>
      <div class="stat-card">
        <p class="stat-card-label"><span class="sw" style="background:var(--rust)"></span>Uscite</p>
        <p class="stat-card-value" style="color:var(--rust)">${fmt(totalExpense)}</p>
      </div>
      <div class="stat-card">
        <p class="stat-card-label"><span class="sw" style="background:${net<0?"var(--rust)":"var(--emerald)"}"></span>Netto</p>
        <p class="stat-card-value ${net<0?"neg":net>0?"pos":"zero"}">${fmtSigned(net)}</p>
      </div>
    </div>
  `;
}
document.getElementById("statsRangeSelect").addEventListener("change", event=>{
  statsTrendRange=event.target.value;
  renderStats();
});
document.querySelectorAll("#trendModeToggle [data-trend-mode]").forEach(btn=>btn.addEventListener("click",()=>{trendMode=btn.dataset.trendMode;document.querySelectorAll("#trendModeToggle .type-opt").forEach(x=>x.classList.toggle("active",x===btn));renderTrendSection();}));

function renderAccountBreakdown(){
  const tx = statsTransactions();
  const container = document.getElementById("accountBreakdown");
  container.className = "stat-card-grid";
  container.innerHTML = "";
  state.accounts.filter(a=>!isLoanAccount(a)).forEach(a=>{
    const net = tx.reduce((s,t)=>s+(t.type==="transfer"?(t.accountId===a.id?-t.amount:t.toAccountId===a.id?t.amount:0):(t.accountId===a.id?(t.type==="income"?t.amount:-t.amount):0)),0);
    const card = document.createElement("div");
    card.className = "stat-card";
    card.innerHTML = `
      <p class="stat-card-label"><span class="sw" style="background:${safeColor(a.color)}"></span>${escapeHtml(a.name)}</p>
      <p class="stat-card-value ${net<0?"neg":net>0?"pos":"zero"}">${fmtSigned(net)}</p>
    `;
    container.appendChild(card);
  });
}

/* ---------------- Rendering: Accounts ---------------- */
function renderAccounts(){
  const totalEl = document.getElementById("totalBalanceAmount");
  const total = liquidBalance();
  totalEl.textContent = balancesHidden ? "••••" : fmt(total);
  setEyeIcon(document.getElementById("toggleAccountsBalance"),balancesHidden);
  totalEl.style.color = moneyColor(total);
  {
    const recv=receivableTotal(), pay=payableTotal(), hasRecv=Math.abs(recv)>=0.005, hasPay=Math.abs(pay)>=0.005, rows=document.getElementById("accountsEffectiveRows");
    document.getElementById("totalBalanceLabel").textContent="Liquidità su tutti i conti"; /* v1.67.0 */
    if(rows){
      rows.hidden=!(hasRecv||hasPay);
      if(hasRecv||hasPay){
        const eff=total+recv-pay, show=v=>balancesHidden?"••••":fmt(v);
        document.getElementById("accountsReceivableRow").hidden=!hasRecv; document.getElementById("accountsReceivable").textContent=`+${show(recv)}`;
        document.getElementById("accountsPayableRow").hidden=!hasPay; document.getElementById("accountsPayable").textContent=`−${show(pay)}`;
        const e=document.getElementById("accountsEffective"); e.textContent=show(eff); e.style.color=moneyColor(eff);
      }
    }
    renderLoans();
  }
  const mainSelect=document.getElementById("mainAccountSelect");
  if(mainSelect){
    mainSelect.innerHTML=`<option value="">Seleziona il conto principale</option>`+state.accounts.filter(a=>!isLoanAccount(a)).map(a=>`<option value="${escapeHtml(a.id)}">${escapeHtml(a.name)}</option>`).join("");
    mainSelect.value=state.accounts.some(a=>a.id===state.mainAccountId)?state.mainAccountId:"";
    mainSelect.onchange=()=>{
      state.mainAccountId=mainSelect.value || null;
      persist();renderAll();
      showToast(state.mainAccountId?"Conto principale impostato":"Conto principale rimosso");
    };
  }

  const savSelect=document.getElementById("savingsAccountSelect");
  if(savSelect){
    savSelect.innerHTML=`<option value="">Nessun conto risparmio</option>`+state.accounts.filter(a=>!isLoanAccount(a)).map(a=>`<option value="${escapeHtml(a.id)}">${escapeHtml(a.name)}${a.label?` · ${escapeHtml(a.label)}`:""}</option>`).join("");
    savSelect.value=state.accounts.some(a=>a.id===state.savingsAccountId)?state.savingsAccountId:"";
    savSelect.onchange=()=>{
      state.savingsAccountId=savSelect.value || null;
      persist();renderAll();
      showToast(state.savingsAccountId?"Conto risparmio impostato":"Conto risparmio rimosso");
    };
    const row=document.getElementById("savingsTargetRow"), inp=document.getElementById("savingsTargetInput");
    if(row) row.hidden=!state.savingsAccountId;
    if(inp && document.activeElement!==inp){
      inp.value=state.savingsTarget?String(state.savingsTarget).replace(".",","):"";
      inp.onchange=()=>{ const v=parseAmount(inp.value); state.savingsTarget=v>0?Math.round(v*100)/100:null; persist(); renderAll(); showToast(state.savingsTarget?`Obiettivo: ${fmt(state.savingsTarget)} al mese`:"Obiettivo mensile tolto"); };
    }
  }

  /* v1.67.0 — CONTI RIFATTI: un solo elenco compatto, saldo grande allineato a destra (si confrontano a colpo d'occhio),
     quota del totale e variazione da inizio mese sotto; i conti a zero in una riga di chip; crediti e debiti in breve.
     Un tocco apre la scheda del conto (saldo, entrate/uscite del mese, andamento, ultimi movimenti, azioni). */
  const container = document.getElementById("accountsList");
  container.innerHTML = "";
  const nowD=new Date(), monthStartPrev=previousISO(`${nowD.getFullYear()}-${pad2(nowD.getMonth()+1)}-01`);
  const monthShort=MESI_BREVI[nowD.getMonth()].toLowerCase();
  const liquid=state.accounts.filter(a=>!isLoanAccount(a));
  const z=n=>Math.abs(n)<0.005?0:n; /* niente "-0,00" rosso per i resti di arrotondamento */
  const rows=liquid.map(a=>{ const v=z(accountBalance(a.id)); return {a,v,d:z(v-accountBalanceAtDate(a.id,monthStartPrev))}; });
  const posSum=rows.filter(x=>x.v>0.004).reduce((t,x)=>t+x.v,0);
  const show=v=>balancesHidden?"••••":fmt(v);
  /* variazione del totale da inizio mese, sotto la cifra grande */
  { const md=document.getElementById("accountsMonthDelta"), dd=rows.reduce((t,x)=>t+x.d,0);
    if(md){ md.hidden=balancesHidden||Math.abs(dd)<0.005; if(!md.hidden) md.innerHTML=`<span class="${dd>0?"pos":"neg"}">${dd>0?"▲ +":"▼ −"}${fmt(Math.abs(dd))}</span> da inizio ${MESI[nowD.getMonth()].toLowerCase()}`; } }
  const share=document.getElementById("accountsShare");
  if(share){
    const pos=rows.filter(x=>x.v>0.004).sort((x,y)=>y.v-x.v);
    share.hidden=balancesHidden||pos.length<2||!(posSum>0);
    share.innerHTML=share.hidden?"":`<div class="acc-share-bar">${pos.map(x=>`<i style="width:${(x.v/posSum*100).toFixed(2)}%;background:${safeColor(x.a.color)}"></i>`).join("")}</div>`;
  }
  const initialOf=a=>escapeHtml((String(a.name||"?").trim().match(/[\p{L}\p{N}]/u)||["?"])[0].toUpperCase());
  const live=rows.filter(x=>Math.abs(x.v)>=0.005||Math.abs(x.d)>=0.005).sort((x,y)=>y.v-x.v);
  const zero=rows.filter(x=>!live.includes(x));
  live.forEach(({a,v,d})=>{
    const pct=v>0.004&&posSum>0?v/posSum*100:0;
    const card=document.createElement("button");
    card.type="button"; card.className="acx-row"+(v<-0.004?" neg":""); card.setAttribute("role","listitem"); card.dataset.acc=a.id;
    card.style.setProperty("--acc",safeColor(a.color));
    const sub=[a.label?escapeHtml(a.label):"", !balancesHidden&&pct>0?`${pct<1?"<1":Math.round(pct)}% del totale`:"", v<-0.004?"⚠ in rosso":""].filter(Boolean).join(" · ");
    card.innerHTML=`<span class="acx-av" aria-hidden="true">${initialOf(a)}</span>
      <span class="acx-main"><span class="acx-name">${escapeHtml(a.name)}${accountBadges(a)}</span>${sub?`<span class="acx-sub">${sub}</span>`:""}</span>
      <span class="acx-right"><span class="acx-bal" style="color:${balancesHidden?"var(--num-plain)":moneyColor(v)}">${show(v)}</span>${!balancesHidden&&Math.abs(d)>=0.005?`<span class="acx-delta ${d>0?"pos":"neg"}">${d>0?"+":"−"}${fmt(Math.abs(d))} a ${monthShort}</span>`:""}</span>
      <span class="acx-chev" aria-hidden="true">›</span>
      ${pct>0?`<i class="acx-bar" style="width:${pct.toFixed(1)}%" aria-hidden="true"></i>`:""}`;
    card.setAttribute("aria-label",`${a.name}: ${balancesHidden?"importo nascosto":fmt(v)}`);
    card.addEventListener("click",()=>openAccountDetail(a.id));
    container.appendChild(card);
  });
  const zeroBox=document.getElementById("accountsZero");
  if(zeroBox){
    zeroBox.hidden=!zero.length;
    zeroBox.innerHTML=zero.length?`<span class="acx-zero-lab">A zero</span>${zero.map(({a})=>`<button type="button" class="acx-zchip" data-acc="${escapeHtml(a.id)}" style="--acc:${safeColor(a.color)}"><i aria-hidden="true"></i>${escapeHtml(a.name)}</button>`).join("")}`:"";
    zeroBox.onclick=e=>{ const b=e.target.closest("[data-acc]"); if(b) openAccountDetail(b.dataset.acc); };
  }
  /* crediti e debiti aperti, in breve (il dettaglio resta in 🤝 Prestiti) */
  const loansBox=document.getElementById("accountsLoansMini");
  if(loansBox){
    const open=[...receivableAccounts(),...payableAccounts()].map(a=>({a,v:accountBalance(a.id)})).filter(x=>Math.abs(x.v)>=0.005);
    loansBox.hidden=!open.length;
    loansBox.innerHTML=open.length?`<p class="acx-loans-h"><span>Crediti e debiti</span><button type="button" class="acx-link" data-acx-loans>Prestiti ›</button></p>`+open.map(({a,v})=>{ const owed=a.receivable?v:-v;
      return `<button type="button" class="acx-lrow ${a.receivable?"in":"out"}" data-loan="${escapeHtml(a.id)}"><span class="acx-ldot" aria-hidden="true">${a.receivable?"↑":"↓"}</span><span class="acx-lname">${escapeHtml(a.person||a.name)}<small>${a.receivable?(owed>=0?"ti deve":"gli devi"):(owed>=0?"devi":"ti deve")}</small></span><b>${show(Math.abs(owed))}</b></button>`; }).join(""):"";
    loansBox.onclick=e=>{ const l=e.target.closest("[data-loan]"); if(l){ openLoanPerson(l.dataset.loan); return; } if(e.target.closest("[data-acx-loans]")) setAccountsMode("loans"); };
  }
  renderAccountsBubbles();
}

function renderAccountsManageList(){
  const container = document.getElementById("accountsManageList");
  if(!container) return;
  container.innerHTML = "";
  state.accounts.forEach(a=>{
    const bal = accountBalance(a.id);
    const row = document.createElement("button");
    row.className = "category-row";
    row.innerHTML = `
      <span class="ic" style="background:${safeColor(a.color)}22;">●</span>
      <span class="info">
        <p class="nm">${escapeHtml(a.name)}${accountBadges(a)}</p>
        <p class="sub">${a.label?`${escapeHtml(a.label)} · `:""}Saldo attuale: <span class="amt">${fmt(bal)}</span></p>
      </span>
      <span class="chev">›</span>
    `;
    row.querySelector(".ic").style.color = safeColor(a.color);
    row.addEventListener("click", ()=> openAccountForm(a.id));
    container.appendChild(row);
  });
}

function renderBalanceAdjustmentHistory(){
  const container=document.getElementById("balanceAdjustmentsList");
  const empty=document.getElementById("balanceAdjustmentsEmpty");
  if(!container) return;
  const accs=accountsById();
  const items=state.transactions.filter(t=>t.isBalanceAdjustment&&!t.loanOld&&!t.loanWriteOff).slice().sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
  container.innerHTML="";
  items.forEach(t=>{
    const row=document.createElement("div");
    row.className="balance-adjustment-row";
    const d=new Date(t.date+"T00:00:00");
    const sign=t.type==="income"?"+":"−";
    row.innerHTML=`
      <span class="balance-adjustment-icon">⚖️</span>
      <span class="balance-adjustment-info">
        <strong>${escapeHtml(accs[t.accountId]?.name||"Conto eliminato")}</strong>
        <small>${d.getDate()} ${MESI_BREVI[d.getMonth()]} ${d.getFullYear()}${t.note?` · ${escapeHtml(t.note)}`:""}</small>
      </span>
      <span class="balance-adjustment-amount ${t.type}">${sign}${fmt(t.amount)}</span>`;
    container.appendChild(row);
  });
  if(empty) empty.hidden=items.length>0;
}

/* ---------------- Rendering: More (macrocategorie, categorie, grafo, dati) ---------------- */
function moveCategory(id,delta){
  const index=state.categories.findIndex(c=>c.id===id); if(index<0) return;
  const groupKey=c=>(c.macroCategoryId||"none");
  const key=groupKey(state.categories[index]);
  const peerIndexes=state.categories.map((c,i)=>groupKey(c)===key?i:-1).filter(i=>i>=0);
  const pos=peerIndexes.indexOf(index), targetPos=pos+delta;
  if(targetPos<0 || targetPos>=peerIndexes.length) return;
  const targetIndex=peerIndexes[targetPos];
  [state.categories[index],state.categories[targetIndex]]=[state.categories[targetIndex],state.categories[index]];
  persist();renderAll();
}
function moveMacroCategory(id,delta){
  const index=state.macroCategories.findIndex(m=>m.id===id), target=index+delta;
  if(index<0 || target<0 || target>=state.macroCategories.length) return;
  [state.macroCategories[index],state.macroCategories[target]]=[state.macroCategories[target],state.macroCategories[index]];
  persist();renderAll();
}
function reorderControls(label,onUp,onDown,canUp,canDown){
  const controls=document.createElement("span");controls.className="reorder-actions";
  const up=document.createElement("button");up.type="button";up.className="reorder-btn";up.textContent="↑";up.setAttribute("aria-label",`Sposta ${label} su`);up.disabled=!canUp;up.addEventListener("click",e=>{e.stopPropagation();onUp();});
  const down=document.createElement("button");down.type="button";down.className="reorder-btn";down.textContent="↓";down.setAttribute("aria-label",`Sposta ${label} giù`);down.disabled=!canDown;down.addEventListener("click",e=>{e.stopPropagation();onDown();});
  controls.append(up,down);return controls;
}
function renderCategories(){
  const container = document.getElementById("categoriesList");
  if(!container) return;
  const macros = macroCategoriesById();
  container.innerHTML = "";

  function buildRow(c,position,total,sotto){
    const wrap=document.createElement("div");wrap.className="category-manage-row"+(sotto?" is-sub":"");
    const row = document.createElement("button");
    row.className = "category-row"+(sotto?" sub-row":"");
    const figlie = sotto?0:subCategoriesOf(c.id).length;
    const madre = sotto ? state.categories.find(x=>x.id===c.parentCategoryId) : null;
    row.innerHTML = `
      <span class="ic">${emojiIconHtml(c.emoji)}</span>
      <span class="info">
        <p class="nm">${sotto?`<span class="sub-arrow" aria-hidden="true">└</span>`:""}${escapeHtml(c.name)}</p>
        <p class="sub">${sotto?`sottocategoria di ${escapeHtml(madre?madre.name:"")}`:(c.kind==="income"?"Entrata":"Uscita")}${figlie?` · ${figlie} ${figlie===1?"sottocategoria":"sottocategorie"}`:""}${c.budget?` · budget <span class="amt">${fmt(c.budget)}</span>`:""}</p>
      </span>
      <span class="chev">›</span>`;
    row.addEventListener("click", ()=> openCategoryForm(c.id));
    wrap.appendChild(row);
    wrap.appendChild(reorderControls(`categoria ${c.name}`,()=>moveCategory(c.id,-1),()=>moveCategory(c.id,1),position>0,position<total-1));
    return wrap;
  }

  /* v1.37.0 — l'elenco mostra le categorie principali e, rientrate sotto, le loro
     sottocategorie. Le frecce di riordino restano solo sulle principali. */
  const groups = new Map();
  state.categories.filter(c=>!c.parentCategoryId).forEach(c=>{
    const key = c.macroCategoryId && macros[c.macroCategoryId] ? c.macroCategoryId : "none";
    if(!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  });
  function appendCat(group,c,i,n){
    group.appendChild(buildRow(c,i,n,false));
    subCategoriesOf(c.id).forEach(sc=>group.appendChild(buildRow(sc,0,1,true)));
  }

  state.macroCategories.forEach(m=>{
    if(!groups.has(m.id)) return;
    const group = document.createElement("div");
    group.className = "category-group";
    group.innerHTML = `<p class="category-group-title"><span>${escapeHtml(m.emoji)}</span>${escapeHtml(m.name)}</p>`;
    const items=groups.get(m.id);items.forEach((c,i)=> appendCat(group,c,i,items.length));
    container.appendChild(group);
  });

  if(groups.has("none")){
    const group = document.createElement("div");
    group.className = "category-group";
    group.innerHTML = `<p class="category-group-title">Senza macrocategoria</p>`;
    const items=groups.get("none");items.forEach((c,i)=> appendCat(group,c,i,items.length));
    container.appendChild(group);
  }
}

function renderMacroCategories(){
  const container = document.getElementById("macroCategoriesList");
  if(!container) return;
  container.innerHTML = "";
  state.macroCategories.forEach((m,index)=>{
    const count = state.categories.filter(c=>c.macroCategoryId===m.id).length;
    const wrap=document.createElement("div");wrap.className="category-manage-row";
    const row = document.createElement("button");
    row.className = "category-row";
    row.innerHTML = `
      <span class="ic">${emojiIconHtml(m.emoji)}</span>
      <span class="info">
        <p class="nm">${escapeHtml(m.name)}</p>
        <p class="sub">${count} categori${count===1?"a":"e"} associat${count===1?"a":"e"}${m.budget?` · budget <span class="amt">${fmt(m.budget)}</span>`:""}</p>
      </span>
      <span class="chev">›</span>`;
    row.addEventListener("click", ()=> openMacroForm(m.id));
    wrap.appendChild(row);
    wrap.appendChild(reorderControls(`macrocategoria ${m.name}`,()=>moveMacroCategory(m.id,-1),()=>moveMacroCategory(m.id,1),index>0,index<state.macroCategories.length-1));
    container.appendChild(wrap);
  });
  const hint = document.getElementById("macroEmptyHint");
  if(hint) hint.hidden = state.macroCategories.length>0;
}

function renderCategoryGraph(){
  const container = document.getElementById("categoryGraph");
  if(!container) return;
  container.innerHTML = "";

  function buildMacroNode(title, emoji, color, children){
    const macroNode = document.createElement("div");
    macroNode.className = "graph-macro";
    macroNode.innerHTML = `<div class="graph-macro-node" style="border-color:${safeColor(color,"#999999")}"><span class="em">${escapeHtml(emoji)}</span>${escapeHtml(title)}</div>`;
    if(children.length){
      const branch = document.createElement("div");
      branch.className = "graph-branch";
      children.forEach(c=>{
        const node = document.createElement("div");
        node.className = "graph-cat-node";
        node.innerHTML = `<span class="em">${escapeHtml(c.emoji)}</span>${escapeHtml(c.name)}`;
        branch.appendChild(node);
      });
      macroNode.appendChild(branch);
    }
    return macroNode;
  }

  state.macroCategories.forEach(m=>{
    const children = state.categories.filter(c=>c.macroCategoryId===m.id);
    container.appendChild(buildMacroNode(m.name, m.emoji, m.color, children));
  });

  const orphan = state.categories.filter(c=> !c.macroCategoryId || !state.macroCategories.find(m=>m.id===c.macroCategoryId));
  if(orphan.length){
    container.appendChild(buildMacroNode("Senza macrocategoria", "❔", "var(--line)", orphan));
  }

  if(!state.macroCategories.length && !orphan.length){
    container.innerHTML = `<p class="empty-hint">Crea categorie e macrocategorie per vedere la struttura.</p>`;
  }
}

/* ---------------- Master render ---------------- */
function renderAll(){
  // v1.10.4: con il saldo nascosto si nascondono tutti gli importi dell'app (movimenti, budget, statistiche).
  document.documentElement.classList.toggle("amounts-hidden",!!balancesHidden);
  // Mantiene coerente lo stato anche se l'app resta aperta o torna in primo piano
  // dopo la data di scadenza: ciò che è dovuto entra subito nei Movimenti.
  generatePlannedTransactions();
  generateRecurringTransactions(false);
  renderHeader();
  renderHome();
  renderTransactionsView();
  renderRecurringList();
  renderPlannedList();
  renderStats();
  renderAccounts();
  renderAccountsManageList();
  renderMacroCategories();
  renderCategories();
  renderCategoryGraph();
  setRPMode(rpMode);
  renderEstimates();
  renderRPAllView();
  renderBackupStatus();
  setupCollapsibles();
  try{ applyHomeLayout(); }catch(_){ /* all'avvio la funzione arriva dopo */ }
}
/* v1.49.0 — Ogni riquadro di Home e R&P si chiude con la freccetta nella sua intestazione.
   Lo stato resta salvato sul telefono. */
const COLLAPSE_KEY="bilancio_closed_boxes";
function setupCollapsibles(){
  let closed={}; try{ closed=JSON.parse(localStorage.getItem(COLLAPSE_KEY)||"{}")||{}; }catch(e){}
  const boxes=document.querySelectorAll("#view-home > .hero, #view-home > .home-panel, #view-home > .section-block, #view-recurring .rp-estimate-card, #view-recurring .section-block");
  boxes.forEach(box=>{
    const head=box.matches(".hero")?box.querySelector(":scope > .hero-label"):box.querySelector(":scope > .section-head, :scope > .rp-paid-head, :scope > .rp-est-head, :scope > .box-eyebrow");
    if(!head) return;
    let btn=head.querySelector(":scope > .box-collapse");
    if(!btn){
      const label=(head.querySelector("h2,.rp-est-name")?.textContent||head.textContent||"").trim().slice(0,32);
      btn=document.createElement("button"); btn.type="button"; btn.className="box-collapse"; btn.dataset.noIcon="";
      btn.dataset.key=box.id||`${box.closest("[id]")?.id||"box"}:${label}`;
      btn.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
      head.appendChild(btn); head.classList.add("box-head"); box.classList.add("box-collapsible");
      btn.addEventListener("pointerdown",e=>e.stopPropagation());
      btn.addEventListener("click",e=>{
        e.stopPropagation(); e.preventDefault();
        let c={}; try{ c=JSON.parse(localStorage.getItem(COLLAPSE_KEY)||"{}")||{}; }catch(_){}
        const now=!box.classList.contains("box-closed");
        if(now) c[btn.dataset.key]=1; else delete c[btn.dataset.key];
        try{ localStorage.setItem(COLLAPSE_KEY,JSON.stringify(c)); }catch(_){}
        box.classList.toggle("box-closed",now); btn.setAttribute("aria-expanded",String(!now)); btn.setAttribute("aria-label",now?"Apri riquadro":"Chiudi riquadro");
      });
    }
    const isClosed=!!closed[btn.dataset.key];
    box.classList.toggle("box-closed",isClosed);
    btn.setAttribute("aria-expanded",String(!isClosed)); btn.setAttribute("aria-label",isClosed?"Apri riquadro":"Chiudi riquadro");
  });
}
function renderBackupStatus(){
  const backup=document.getElementById("backupStatus");
  if(!backup) return;
  const last=localStorage.getItem("bilancio_last_backup");
  backup.classList.remove("warning");
  if(!last){
    backup.textContent="Backup consigliato: non risulta ancora alcuna esportazione su questo dispositivo.";
    backup.classList.add("warning");
    return;
  }
  const lastDate=new Date(last);
  const days=Math.floor((Date.now()-lastDate.getTime())/86400000);
  if(!Number.isFinite(days) || days>=BACKUP_WARNING_DAYS){
    backup.textContent=`Backup consigliato: l'ultimo risale a ${Number.isFinite(days)?days+" giorni fa":"una data non valida"}.`;
    backup.classList.add("warning");
  }else{
    backup.textContent=`Ultimo backup esportato: ${lastDate.toLocaleDateString("it-IT")}`;
  }
}

/* ---------------- Navigation ---------------- */
function updateMonthNavVisibility(){
  document.documentElement.classList.toggle("view-more",activeView==="more");
  // Il mese si sceglie solo in Home e R&P; nelle altre schede la barra è nascosta.
  const hideMonth = !(activeView==="home" || activeView==="recurring" || activeView==="estimates"); // v1.5.1: barra del mese solo in Home e R&P
  ["prevMonth","monthLabel","nextMonth"].forEach(id=>{
    document.getElementById(id).style.display = hideMonth ? "none" : "";
  });
  document.querySelector(".topbar").style.display = hideMonth ? "none" : "";
  // v1.5.0: la barra del mese sta sotto il titolo della scheda, così il titolo non cambia posizione.
  const section=document.getElementById("view-"+activeView);
  const bar=document.querySelector(".topbar"),ret=document.getElementById("periodReturn");
  if(section && !hideMonth){
    const anchor=section.querySelector(":scope > .rp-title-row, :scope > .view-title");
    if(anchor){ if(anchor.nextElementSibling!==bar) anchor.after(bar,ret); }
    else if(section.firstElementChild!==bar) section.prepend(bar,ret);
  }
  // Il FAB "+" ha senso solo dove si vedono/aggiungono movimenti reali (Home, Movimenti).
  const showFab = activeView!=="more";
  document.getElementById("fabAdd").classList.toggle("is-hidden",!showFab);
}
function switchView(view,{animate=false,direction=0,nav=null,restore=null}={}){
  closeDatePicker();
  closePeriodMenu();
  // v1.9.0: cambiando sezione dalla barra in basso si abbandona la sotto-pagina.
  if(!nav && subNav && !isSubView(view)){
    subNav=null;
    if(history.state && history.state.mtSub){ignoreNextPop=true;try{history.back();}catch(e){ignoreNextPop=false;}}
  }
  const prevView = activeView;
  activeView = view;
  const PAIR=["home","recurring","estimates"];
  if(restore){
    viewYear=restore.year;viewMonth=restore.month;viewDay=restore.day;
    if(restore.mode) periodModes[view]=restore.mode;
    if(restore.range) periodRange={...restore.range};
  }else if(PAIR.includes(view) && (PAIR.includes(prevView) || (isSubView(prevView) && PAIR.includes(SUBVIEW_PARENT[prevView])))){
    // v1.10.3: Home e R&P mostrano sempre lo stesso mese/periodo.
    const other=PAIR.includes(prevView)?prevView:SUBVIEW_PARENT[prevView]==="home"?"home":"recurring";
    if(other!==view) periodModes[view]=(periodModes[other]==="day"||periodModes[other]==="range")&&(view==="recurring"||view==="estimates")?"month":periodModes[other];
  }else if(["home","recurring","estimates","stats"].includes(view)){
    const today=new Date();
    viewYear=today.getFullYear();viewMonth=today.getMonth();viewDay=today.getDate();
    periodModes[view]="month";
    if(PAIR.includes(view)){periodModes.home="month";periodModes.recurring="month";periodModes.estimates="month";}
  }
  document.querySelectorAll(".view").forEach(v=>{
    v.classList.remove("view-swipe-next","view-swipe-prev");
    v.classList.toggle("active", v.dataset.view===view);
  });
  document.querySelectorAll(".tab").forEach(t=> t.classList.toggle("active", t.dataset.view===((view==="planned"||view==="transactions")?"home":view==="rpall"?"recurring":view==="more"?"accounts":view)));
  updateMonthNavVisibility();
  renderAll();
  const active=document.querySelector(`.view[data-view="${view}"]`);
  if(animate && active){
    void active.offsetWidth;
    active.classList.add(direction>0?"view-swipe-next":"view-swipe-prev");
    active.addEventListener("animationend",()=>active.classList.remove("view-swipe-next","view-swipe-prev"),{once:true});
  }
  if(nav && active){
    const cls=nav==="push"?"view-push":"view-pop";
    active.classList.remove("view-push","view-pop");
    void active.offsetWidth;
    active.classList.add(cls);
    active.addEventListener("animationend",()=>active.classList.remove(cls),{once:true});
  }
  window.scrollTo(0,restore?restore.scrollY||0:0);
  if(restore) requestAnimationFrame(()=>window.scrollTo(0,restore.scrollY||0));
}
/* ---------------- v1.9.0 — Sotto-pagine e ritorno indietro ----------------
   "Vedi tutti" apre una sotto-pagina; si torna alla sezione da cui è stata
   aperta con il pulsante ‹, con uno swipe verso destra o con il tasto
   Indietro di Android. Periodo e posizione di scorrimento vengono ripristinati. */
const SUBVIEW_PARENT={transactions:"home",rpall:"recurring",planned:"home"};
var subNav=null, ignoreNextPop=false;
try{if("scrollRestoration" in history) history.scrollRestoration="manual";}catch(e){}
function isSubView(v){return Object.prototype.hasOwnProperty.call(SUBVIEW_PARENT,v);}
function openSubView(view){
  subNav={from:activeView,scrollY:window.scrollY,year:viewYear,month:viewMonth,day:viewDay,mode:periodModes[activeView],range:periodRange?{...periodRange}:null};
  switchView(view,{nav:"push"});
  try{history.pushState({mtSub:view},"");}catch(e){}
}
function performBack(){
  const n=subNav; subNav=null;
  if(n){
    switchView(n.from,{nav:"pop",restore:n});
    const y=n.scrollY||0;
    setTimeout(()=>{if(activeView===n.from && Math.abs(window.scrollY-y)>40) window.scrollTo(0,y);},320);
  }
  else if(isSubView(activeView)) switchView(SUBVIEW_PARENT[activeView],{nav:"pop"});
}
function goBack(){
  if(subNav && history.state && history.state.mtSub){try{history.back();return;}catch(e){}}
  performBack();
}
window.addEventListener("popstate",()=>{
  if(ignoreNextPop){ignoreNextPop=false;return;}
  // Con un pannello aperto, "Indietro" chiude prima il pannello.
  const sheets=[...overlayRoot.querySelectorAll(".sheet")];
  const top=sheets[sheets.length-1];
  if(top && typeof top._close==="function"){
    top._close();
    if(subNav && isSubView(activeView)){try{history.pushState({mtSub:activeView},"");}catch(e){}}
    return;
  }
  if(subNav || isSubView(activeView)) performBack();
});
document.querySelectorAll("[data-nav-back]").forEach(b=>b.addEventListener("click",goBack));
function setRPMode(mode){
  rpMode=mode;
  const rpView=document.getElementById("view-recurring");
  if(rpView){
    rpView.classList.remove("rp-mode-total","rp-mode-recurring","rp-mode-planned");
    rpView.classList.add(`rp-mode-${mode}`);
  }
  const total=document.getElementById("rpTotalSection"), recurring=document.getElementById("rpRecurringSection"), planned=document.getElementById("rpPlannedSection");
  if(total) total.hidden=mode!=="total";
  if(recurring) recurring.hidden=mode!=="recurring";
  if(planned) planned.hidden=mode!=="planned";
  const recurringCard=document.getElementById("recurringEstimateCard"),plannedCard=document.getElementById("plannedEstimateCard"),combined=document.getElementById("rpTotalEstimateCard"),grid=document.getElementById("rpEstimatesGrid");
  if(recurringCard) recurringCard.hidden=mode==="planned";
  if(plannedCard) plannedCard.hidden=mode==="recurring";
  if(combined) combined.hidden=mode!=="total";
  if(grid) grid.classList.toggle("single",mode!=="total");
  document.querySelectorAll("#rpModeToggle [data-rp-mode]").forEach(btn=>btn.classList.toggle("active",btn.dataset.rpMode===mode));
  renderRPMacroSummary();
  try{ renderRPDash(); }catch(e){ console.error(e); }
}
document.querySelectorAll("#rpModeToggle [data-rp-mode]").forEach(btn=>btn.addEventListener("click",()=>setRPMode(btn.dataset.rpMode)));
/* =========================================================
   v1.51.0 — Stime (R&P › Stime)
   Per ogni mese annoti le spese che pensi di avere (nome, importo, categoria facoltativa).
   Si confrontano con le uscite vere del mese; il riepilogo mostra mese per mese
   stimato e speso. state.estimates: {id, month:"AAAA-MM", name, amount, categoryId, note}
   ========================================================= */
function estMonthKey(y,m){ return `${y}-${pad2(m+1)}`; }
function estimatesOf(y,m){ const k=estMonthKey(y,m); return (state.estimates||[]).filter(e=>e.month===k); }
function estMonthExpense(y,m){ return sumTransactions(monthTx(y,m)).expense; }
/* v1.70.0 — STIME COLLEGATE A MANO. Prima ogni uscita del mese "riempiva" la stima della sua categoria (e il riquadro
   del mese confrontava la stima con TUTTE le uscite). Ora un movimento conta in una stima solo se lo colleghi tu:
     · tocca il movimento › 🎯 scegli la stima del suo mese (o "Nessuna");
     · nel modulo del movimento, la riga "🎯 Conta nella stima";
     · dalla stima: "Movimenti nella stima", con le uscite della stessa categoria proposte (anche "Aggiungi tutte").
   Il collegamento è t.estimateId (solo uscite, solo nel mese della stima). */
function estById(id){ return id?(state.estimates||[]).find(e=>e.id===id)||null:null; }
function estCanLink(t){ return !!t && t.type==="expense" && !t.isBalanceAdjustment && !t.loanOld && !t.loanWriteOff && !t.planned; }
function txEstimate(t){ const e=t&&t.estimateId?estById(t.estimateId):null; return e&&estCanLink(t)&&String(t.date).startsWith(e.month)?e:null; }
function estLinkedTx(e){ return e?state.transactions.filter(t=>t.estimateId===e.id&&estCanLink(t)&&String(t.date).startsWith(e.month)):[]; }
function estSpent(e){ return Math.round(estLinkedTx(e).reduce((s,t)=>s+t.amount,0)*100)/100; }
function estMonthLinked(y,m){ return Math.round(estimatesOf(y,m).reduce((s,e)=>s+estSpent(e),0)*100)/100; }
function estCatMatch(e,catId){ if(!e||!e.categoryId||!catId) return false; const r=rollUpCategoryId(catId)||catId; return e.categoryId===r||e.categoryId===catId||(rollUpCategoryId(e.categoryId)||e.categoryId)===r; }
function estOptionsFor(monthKey,catId){
  return (state.estimates||[]).filter(e=>e.month===monthKey).map(e=>({e,match:estCatMatch(e,catId)}))
    .sort((a,b)=>(b.match-a.match)||(b.e.amount-a.e.amount)||String(a.e.name).localeCompare(String(b.e.name)));
}
function estMonthName(key){ const m=Number(String(key).slice(5,7)); return m>=1&&m<=12?MESI[m-1].toLowerCase():""; }
function estChipsHtml(monthKey,catId,selId){
  const opts=estOptionsFor(monthKey,catId); if(!opts.length) return "";
  const show=v=>balancesHidden?"••••":fmt(v), cats=categoriesById();
  return `<button type="button" class="est-chip est-chip-none${selId?"":" on"}" data-est-link="" data-no-icon aria-pressed="${!selId}"><span class="ec-ic">∅</span><span class="ec-t"><b>Nessuna</b><small>resta fuori</small></span></button>`+
    opts.map(({e,match})=>{
      const c=e.categoryId?cats[e.categoryId]:null, left=e.amount-estSpent(e), on=e.id===selId;
      return `<button type="button" class="est-chip${on?" on":""}${match?" match":""}" data-est-link="${escapeHtml(e.id)}" data-no-icon aria-pressed="${on}"><span class="ec-ic">${c&&c.emoji?escapeHtml(firstGlyph(c.emoji)):"📝"}</span><span class="ec-t"><b>${escapeHtml(e.name||(c&&c.name)||"Stima")}</b><small>${match?"stessa categoria · ":""}${left>=-0.004?`restano ${show(Math.max(0,left))}`:`oltre di ${show(-left)}`}</small></span></button>`;
    }).join("");
}
/* Riquadro 🎯 nel dettaglio del movimento: un tocco lo mette in una stima (o lo toglie) */
function mountTxEstimateBox(host,t){
  if(!host||!estCanLink(t)) return;
  const key=String(t.date).slice(0,7);
  const paint=()=>{
    const opts=estOptionsFor(key,t.categoryId);
    let box=host.querySelector(".tx-est-box");
    if(!opts.length){ if(box) box.remove(); return; }
    if(!box){ box=document.createElement("div"); box.className="tx-est-box"; host.appendChild(box); }
    const cur=txEstimate(t);
    box.innerHTML=`<p class="tx-est-h"><b>🎯 Stima di ${estMonthName(key)}</b><small>${cur?`conta in “${escapeHtml(cur.name)}”`:"fuori dalle stime"}</small></p><div class="est-chips">${estChipsHtml(key,t.categoryId,cur?cur.id:null)}</div>`;
  };
  host.addEventListener("click",ev=>{
    const b=ev.target.closest("[data-est-link]"); if(!b||!host.contains(b)) return;
    const id=b.dataset.estLink||null, cur=txEstimate(t);
    if((cur?cur.id:null)===id) return;
    if(id) t.estimateId=id; else delete t.estimateId;
    persist(); renderAll(); paint();
    const e=estById(id);
    showToast(e?`Conta nella stima “${e.name}”`:"Tolto dalle stime");
  });
  paint();
}
function estMonthLabel(key){ const [y,m]=key.split("-").map(Number); return `${MESI[m-1]} ${y}`; }
function estGoToMonth(y,m){
  viewYear=y; viewMonth=m; viewDay=Math.min(viewDay||1,new Date(y,m+1,0).getDate());
  periodModes.recurring="month"; renderAll();
  window.scrollTo({top:0,behavior:"smooth"});
}
function firstGlyph(s){ try{ if(window.Intl&&Intl.Segmenter){ const it=new Intl.Segmenter(undefined,{granularity:"grapheme"}).segment(String(s))[Symbol.iterator]().next(); return it.value?it.value.segment:String(s); } }catch(e){} return Array.from(String(s))[0]||""; }
function renderEstimates(){
  const sec=document.getElementById("rpEstimatesSection"); if(!sec) return;
  const y=viewYear, m=viewMonth, key=estMonthKey(y,m);
  const show=v=>balancesHidden?"••••":fmt(v);
  const now=new Date(), curKey=estMonthKey(now.getFullYear(),now.getMonth());
  const isFuture=key>curKey, isPast=key<curKey, isCurrent=key===curKey;
  const list=estimatesOf(y,m).slice().sort((a,b)=>b.amount-a.amount||a.name.localeCompare(b.name));
  const tot=list.reduce((s,e)=>s+e.amount,0);
  const spent=estMonthLinked(y,m); /* v1.70.0 — solo i movimenti collegati */
  const monthOut=estMonthExpense(y,m);
  const diff=tot-spent;
  const cats=categoriesById();

  /* ---- Riquadro del mese ---- */
  const card=document.getElementById("estMonthCard");
  let status="", cls="";
  if(!list.length){ status="Nessuna stima: aggiungi le spese che pensi di avere questo mese."; cls="none"; }
  else if(isFuture){ status=`Mese non ancora iniziato · ${list.length} ${list.length===1?"voce stimata":"voci stimate"}`; cls="future"; }
  else if(diff>=0){ status=isPast?`Sei rimasto sotto la stima di ${show(diff)}`:`Restano ${show(diff)} prima di superare la stima`; cls="ok"; }
  else { status=`Oltre la stima di ${show(-diff)}`; cls="over"; }
  let pace="";
  if(isCurrent && list.length){
    const days=new Date(y,m+1,0).getDate(), day=now.getDate();
    const proj=day>0?spent/day*days:spent;
    pace=`<p class="est-pace ${proj>tot?"over":"ok"}">A questo ritmo a fine mese: <b>${show(proj)}</b> ${proj>tot?`(${show(proj-tot)} oltre la stima)`:"(dentro la stima)"}</p>`;
  }
  const pct=tot>0?Math.min(100,spent/tot*100):0;
  card.className=`est-month-card ${cls}`;
  card.innerHTML=`
    <div class="est-head"><p class="est-eyebrow">Stima di ${MESI[m].toLowerCase()} ${y}</p><p class="est-total">${list.length?show(tot):"—"}</p></div>
    <div class="est-nums">
      <div><small>${isFuture?"Uscite collegate":"Speso nelle stime"}</small><strong>${show(spent)}</strong></div>
      <div><small>${diff>=0?"Margine":"Sforamento"}</small><strong class="${!list.length||isFuture?"":diff>=0?"pos":"neg"}">${list.length&&!isFuture?(diff>=0?"":"−")+show(Math.abs(diff)):"—"}</strong></div>
    </div>
    ${list.length&&!isFuture?`<div class="est-bar ${diff<0?"over":""}" aria-hidden="true"><i style="width:${pct}%"></i></div>`:""}
    <p class="est-status">${escapeHtml(status)}</p>${pace}
    ${list.length&&!isFuture?`<p class="est-out">Uscite di ${MESI[m].toLowerCase()}: <b>${show(monthOut)}</b> · fuori dalle stime <b>${show(Math.max(0,monthOut-spent))}</b><small>Conta solo quello che colleghi: tocca un movimento › 🎯, oppure apri una stima.</small></p>`:""}`;

  /* ---- Voci del mese ---- */
  document.getElementById("estListTitle").textContent=`Spese stimate · ${MESI[m].toLowerCase()}`;
  const box=document.getElementById("estList"); box.innerHTML="";
  document.getElementById("estEmptyHint").hidden=!!list.length;
  list.forEach(e=>{
    const c=e.categoryId?cats[e.categoryId]:null;
    const sp=isFuture?null:estSpent(e), nLinked=isFuture?0:estLinkedTx(e).length; /* v1.70.0 — solo i collegati, anche senza categoria */
    const row=document.createElement("button"); row.type="button"; row.className="est-row";
    let prog="";
    if(sp!=null && !isFuture){
      const p=e.amount>0?Math.min(100,sp/e.amount*100):0, over=sp>e.amount+0.004;
      prog=`<span class="est-row-prog ${over?"over":""}"><i style="width:${p}%"></i></span><span class="est-row-spent ${over?"over":""}${nLinked?"":" none"}">${nLinked?`speso ${show(sp)} · ${nLinked} ${nLinked===1?"movimento":"movimenti"}${over?` · +${show(sp-e.amount)}`:` · restano ${show(e.amount-sp)}`}`:"nessun movimento collegato · tocca per sceglierli"}</span>`;
    }
    row.innerHTML=`<span class="est-row-ic" aria-hidden="true">${c?.emoji?escapeHtml(firstGlyph(c.emoji)):"📝"}</span>
      <span class="est-row-main"><span class="est-row-name">${escapeHtml(e.name||c?.name||"Stima")}</span><span class="est-row-sub">${c?escapeHtml(categoryLabel(c.id)||c.name):"senza categoria"}${e.note?` · ${escapeHtml(e.note)}`:""}</span>${prog}</span>
      <span class="est-row-amt">${show(e.amount)}</span>`;
    row.addEventListener("click",()=>openEstimateForm(e.id));
    box.appendChild(row);
  });

  /* ---- Azioni rapide ---- */
  const act=document.getElementById("estActions"); act.innerHTML="";
  const pd=new Date(y,m-1,1), prevList=estimatesOf(pd.getFullYear(),pd.getMonth());
  if(prevList.length){
    const names=new Set(list.map(e=>(e.name||"").trim().toLowerCase()));
    const missing=prevList.filter(e=>!names.has((e.name||"").trim().toLowerCase()));
    if(missing.length){
      const b=document.createElement("button"); b.type="button"; b.className="pill-btn est-action";
      b.textContent=`⧉ Copia da ${MESI[pd.getMonth()].toLowerCase()} (${missing.length})`;
      b.addEventListener("click",()=>{
        missing.forEach(e=>state.estimates.push({id:uid(),month:key,name:e.name,amount:e.amount,categoryId:e.categoryId||null,note:e.note||""}));
        persist(); renderAll(); showToast(`${missing.length} ${missing.length===1?"stima copiata":"stime copiate"} da ${MESI[pd.getMonth()].toLowerCase()}`);
      });
      act.appendChild(b);
    }
  }
  if(!list.length){
    const sugg=estSuggestFromHistory(y,m);
    if(sugg.length){
      const b=document.createElement("button"); b.type="button"; b.className="pill-btn est-action";
      b.textContent="✨ Proponi dalla media degli ultimi 3 mesi";
      b.addEventListener("click",async()=>{
        const totS=sugg.reduce((s,x)=>s+x.amount,0);
        const ok=await askConfirm(`Aggiungo ${sugg.length} stime per categoria (totale ${fmt(totS)}) calcolate dalle tue uscite medie degli ultimi 3 mesi. Poi puoi modificarle.`,{ok:"Aggiungi"});
        if(!ok) return;
        sugg.forEach(x=>state.estimates.push({id:uid(),month:key,name:x.name,amount:x.amount,categoryId:x.categoryId,note:"media ultimi 3 mesi"}));
        persist(); renderAll(); showToast("Stime proposte aggiunte: controllale e modificale");
      });
      act.appendChild(b);
    }
  }
  act.hidden=!act.children.length;

  /* ---- Riepilogo per mese (anno scelto) ---- */
  document.getElementById("estYearTitle").textContent=`Riepilogo stime ${y}`;
  const yearBox=document.getElementById("estYearSummary");
  let tEst=0,tSpent=0,tCmp=0;
  const rows=[];
  for(let i=0;i<12;i++){
    const k=estMonthKey(y,i), its=estimatesOf(y,i), est=its.reduce((s,e)=>s+e.amount,0);
    if(!its.length && i!==m) continue; // solo i mesi con una stima (più quello aperto)
    const fut=k>curKey, sp=fut||!its.length?null:estMonthLinked(y,i); /* v1.70.0 — speso = movimenti collegati */
    tEst+=est;
    if(its.length && !fut){ tSpent+=sp; tCmp+=est; }
    let badge="";
    if(its.length && !fut){
      const d=est-sp;
      badge=`<span class="est-y-diff ${d>=0?"ok":"over"}">${show(Math.abs(d))} ${d>=0?"sotto":"sopra"}</span>`;
    } else if(its.length && fut) badge=`<span class="est-y-diff future">da venire</span>`;
    const w=est>0&&sp!=null?Math.min(100,sp/est*100):0;
    rows.push(`<button type="button" class="est-y-row${i===m?" active":""}${!its.length?" empty":""}" data-m="${i}">
      <span class="est-y-month">${MESI[i]}</span>
      <span class="est-y-vals"><span><small>stimato</small><b>${its.length?show(est):"—"}</b></span><span><small>speso</small><b>${sp==null?"—":show(sp)}</b></span></span>
      ${badge}
      ${its.length&&sp!=null?`<span class="est-y-bar ${sp>est?"over":""}"><i style="width:${w}%"></i></span>`:""}
    </button>`);
  }
  const totDiff=tCmp-tSpent;
  yearBox.innerHTML=rows.join("")+`<div class="est-y-total"><span>Totale stimato ${y}</span><b>${show(tEst)}</b>${tCmp>0?`<small>Fino a oggi, nei mesi con una stima: stimato ${show(tCmp)}, speso ${show(tSpent)} → ${totDiff>=0?`${show(totDiff)} sotto`:`${show(-totDiff)} sopra`} la stima</small>`:""}</div>`;
  yearBox.querySelectorAll("[data-m]").forEach(b=>b.addEventListener("click",()=>estGoToMonth(y,Number(b.dataset.m))));
  renderPlanning();
}
/* Uscite medie per categoria (categoria madre) nei 3 mesi prima di quello scelto,
   arrotondate per eccesso a 5 €; comprese ricorrenti e pianificate, così la stima copre tutto il mese. */
function estSuggestFromHistory(y,m){
  const sums={};
  let monthsWithData=0;
  for(let i=1;i<=3;i++){
    const d=new Date(y,m-i,1), tx=monthTx(d.getFullYear(),d.getMonth()).filter(t=>t.type==="expense"&&!t.isBalanceAdjustment&&!t.loanOld);
    if(tx.length) monthsWithData++;
    tx.forEach(t=>{ const k=t.categoryId?(rollUpCategoryId(t.categoryId)||t.categoryId):"_"; sums[k]=(sums[k]||0)+t.amount; });
  }
  if(!monthsWithData) return [];
  const cats=categoriesById();
  return Object.entries(sums).map(([k,v])=>{
    const avg=Math.ceil(v/monthsWithData/5)*5, c=cats[k];
    return {categoryId:c?k:null,name:c?c.name:"Altre spese",amount:avg};
  }).filter(x=>x.amount>=5).sort((a,b)=>b.amount-a.amount).slice(0,12);
}
function openEstimateForm(estId,preset=null){
  const existing=estId?(state.estimates||[]).find(e=>e.id===estId):null;
  if(estId && !existing) return;
  openSheet("tpl-estimate-form",(node,close)=>{
    const amountInput=node.querySelector("#estAmountInput"), nameInput=node.querySelector("#estNameInput"),
      monthInput=node.querySelector("#estMonthInput"), catSel=node.querySelector("#estCategorySelect"), noteInput=node.querySelector("#estNoteInput");
    node.querySelector("#estFormTitle").textContent=existing?"Modifica stima":"Nuova stima";
    amountInput.value=existing?String(existing.amount).replace(".",","):"";
    autoGrowAmountInput(amountInput);
    nameInput.value=existing?.name||"";
    monthInput.value=existing?.month||preset?.month||estMonthKey(viewYear,viewMonth);
    noteInput.value=existing?.note||"";
    const expCats=state.categories.filter(c=>c.kind==="expense"&&!c.archived&&!c.parentCategoryId);
    catSel.innerHTML=`<option value="">Senza categoria</option>`+expCats.map(c=>`<option value="${escapeHtml(c.id)}">${escapeHtml((c.emoji?c.emoji+" ":"")+c.name)}</option>`).join("");
    const curCat=existing?.categoryId?(rollUpCategoryId(existing.categoryId)||existing.categoryId):"";
    catSel.value=expCats.some(c=>c.id===curCat)?curCat:"";
    // Categoria suggerita dal nome, finché non la scegli tu
    let catTouched=!!existing?.categoryId;
    catSel.addEventListener("change",()=>{catTouched=true;});
    nameInput.addEventListener("input",()=>{
      if(catTouched) return;
      const id=suggestCategoryFor(nameInput.value,"expense"); if(!id) return;
      const root=rollUpCategoryId(id)||id; if(expCats.some(c=>c.id===root)&&catSel.value!==root){ catSel.value=root; renderLinks(); }
    });
    /* v1.70.0 — MOVIMENTI NELLA STIMA: contano solo quelli che scegli qui (o dal movimento, 🎯).
       In cima i collegati, poi le uscite del mese della stessa categoria, poi (a richiesta) tutte le altre. */
    const showM=v=>balancesHidden?"••••":fmt(v);
    let links=new Set(existing?estLinkedTx(existing).map(t=>t.id):[]), showAll=false;
    const linkBox=document.createElement("div"); linkBox.className="field-row est-links";
    node.querySelector("#estRegisterBtn").before(linkBox);
    function renderLinks(){
      const key=/^\d{4}-\d{2}$/.test(monthInput.value)?monthInput.value:null;
      if(!key){ linkBox.hidden=true; return; }
      linkBox.hidden=false;
      const nowKey=estMonthKey(new Date().getFullYear(),new Date().getMonth()), mese=estMonthName(key);
      const all=state.transactions.filter(t=>estCanLink(t)&&String(t.date).startsWith(key)).sort((a,b)=>b.date.localeCompare(a.date)||b.amount-a.amount);
      const ids=new Set(all.map(t=>t.id)); links=new Set([...links].filter(id=>ids.has(id)));
      if(!all.length){
        linkBox.innerHTML=`<div class="el-head"><label>🎯 Movimenti nella stima</label></div><p class="field-hint">${key>nowKey?`Il mese non è ancora iniziato: quando registri le uscite di ${mese} le colleghi da qui o dal movimento.`:`Nessuna uscita registrata a ${mese}.`}</p>`;
        return;
      }
      const cats=categoriesById(), root=catSel.value||null, isMatch=t=>!!root&&!!t.categoryId&&(t.categoryId===root||rollUpCategoryId(t.categoryId)===root);
      const linked=all.filter(t=>links.has(t.id)), cand=all.filter(t=>!links.has(t.id)&&isMatch(t)), others=all.filter(t=>!links.has(t.id)&&!isMatch(t));
      linkBox._cand=cand.map(t=>t.id);
      const sum=linked.reduce((s,t)=>s+t.amount,0), amt=parseAmount(amountInput.value);
      const row=t=>{
        const c=cats[t.categoryId], on=links.has(t.id), other=!on&&t.estimateId&&(!existing||t.estimateId!==existing.id)?txEstimate(t):null;
        return `<button type="button" class="el-row${on?" on":""}" data-el="${escapeHtml(t.id)}" data-no-icon aria-pressed="${on}"><span class="el-ck" aria-hidden="true">${on?"✓":""}</span><span class="el-main"><b>${escapeHtml(t.name||(c&&c.name)||"Uscita")}</b><small>${shortDate(t.date)} · ${escapeHtml(c?c.name:"senza categoria")}${other?` · ora in “${escapeHtml(other.name)}”`:""}</small></span><span class="el-amt">${showM(t.amount)}</span></button>`;
      };
      const over=amt>0&&sum>amt+0.004;
      let h=`<div class="el-head"><label>🎯 Movimenti nella stima</label><span class="el-sum${over?" over":""}">${linked.length?`${linked.length} · ${showM(sum)}${amt>0?` di ${showM(amt)}`:""}`:"nessuno"}</span></div>`;
      h+=linked.length?`<div class="el-list">${linked.map(row).join("")}</div>`:`<p class="field-hint">Tocca le uscite di ${mese} che rientrano in questa stima: le altre restano fuori.</p>`;
      if(cand.length) h+=`<div class="el-sub"><span>Stessa categoria · ${escapeHtml((cats[root]&&cats[root].name)||"")}</span>${cand.length>1?`<button type="button" class="el-all" data-el-all data-no-icon>Aggiungi tutte (${cand.length})</button>`:""}</div><div class="el-list">${cand.map(row).join("")}</div>`;
      if(others.length) h+=showAll?`<div class="el-sub"><span>Altre uscite di ${mese}</span></div><div class="el-list">${others.map(row).join("")}</div>`
        :`<button type="button" class="el-more" data-el-more data-no-icon>${cand.length||linked.length?"Altre uscite":"Uscite"} di ${mese} (${others.length}) ▾</button>`;
      linkBox.innerHTML=h;
    }
    linkBox.addEventListener("click",ev=>{
      const r=ev.target.closest("[data-el]");
      if(r){ const id=r.dataset.el; if(links.has(id)) links.delete(id); else links.add(id); renderLinks(); return; }
      if(ev.target.closest("[data-el-all]")){ (linkBox._cand||[]).forEach(id=>links.add(id)); renderLinks(); return; }
      if(ev.target.closest("[data-el-more]")){ showAll=true; renderLinks(); }
    });
    monthInput.addEventListener("change",renderLinks);
    catSel.addEventListener("change",renderLinks);
    amountInput.addEventListener("input",renderLinks);
    renderLinks();
    const reg=node.querySelector("#estRegisterBtn");
    if(existing && existing.month<=estMonthKey(new Date().getFullYear(),new Date().getMonth())){
      reg.hidden=false;
      reg.addEventListener("click",()=>{
        const today=todayISO(), [yy,mm]=existing.month.split("-").map(Number);
        const last=`${existing.month}-${pad2(new Date(yy,mm,0).getDate())}`;
        close();
        setTimeout(()=>openAddTransaction(null,{carry:{type:"expense",amount:existing.amount,name:existing.name,categoryId:existing.categoryId||null,accountId:null,note:existing.note||"",date:today.startsWith(existing.month)?today:last,estimateId:existing.id}}),300); /* v1.70.0 — nasce già nella stima */
      });
    }
    const del=node.querySelector("#deleteEstBtn");
    if(existing){
      del.hidden=false;
      del.addEventListener("click",async()=>{
        if(!await askConfirm(`Eliminare la stima "${existing.name}"?`,{ok:"Elimina"})) return;
        state.estimates=state.estimates.filter(e=>e.id!==existing.id);
        state.transactions.forEach(t=>{ if(t.estimateId===existing.id) delete t.estimateId; }); /* v1.70.0 */
        persist(); close(); renderAll(); showToast("Stima eliminata");
      });
    }
    node.querySelector("#saveEstBtn").addEventListener("click",()=>{
      const amount=parseAmount(amountInput.value);
      const catId=catSel.value||null;
      const name=nameInput.value.trim()||(catId?categoriesById()[catId]?.name:"")||"";
      const month=/^\d{4}-\d{2}$/.test(monthInput.value)?monthInput.value:estMonthKey(viewYear,viewMonth);
      if(!(amount>0)){ showToast("Inserisci l'importo stimato"); amountInput.focus(); return; }
      if(!name){ showToast("Scrivi cosa stimi o scegli una categoria"); nameInput.focus(); return; }
      if(!Array.isArray(state.estimates)) state.estimates=[];
      const item={id:existing?.id||uid(),month,name:name.slice(0,160),amount:Math.round(amount*100)/100,categoryId:catId,note:noteInput.value.trim().slice(0,500)};
      if(existing) state.estimates=state.estimates.map(e=>e.id===existing.id?item:e);
      else state.estimates.push(item);
      /* v1.70.0 — collegamenti scelti qui: solo uscite del mese della stima */
      if(month!==monthInput.value) links=new Set();
      state.transactions.forEach(t=>{
        if(links.has(t.id)&&estCanLink(t)&&String(t.date).startsWith(month)) t.estimateId=item.id;
        else if(t.estimateId===item.id) delete t.estimateId;
      });
      persist(); close(); renderAll();
      showToast(existing?"Stima aggiornata":`Stima aggiunta a ${estMonthLabel(month).toLowerCase()}`);
    });
    if(!existing) setTimeout(()=>amountInput.focus(),250);
  });
}
document.getElementById("estAddBtn")?.addEventListener("click",()=>openEstimateForm(null));

/* =========================================================
   v1.62.0 — Planning stipendio (Stime)
   Per ogni mese si divide lo stipendio tra le macro categorie di spesa.
   state.salaryPlans: {month:"AAAA-MM", salary:numero|null, items:[{macroId, amount}]}
   Il riepilogo accorpa i mesi con la stessa suddivisione e mette in evidenza quelli diversi.
   ========================================================= */
function planOf(key){ return (state.salaryPlans||[]).find(p=>p.month===key)||null; }
function planTotal(p){ return (p?.items||[]).reduce((s,i)=>s+i.amount,0); }
function planSignature(p){ return (p.items||[]).filter(i=>i.amount>0).map(i=>`${i.macroId}:${Math.round(i.amount*100)}`).sort().join("|"); }
function planMacroList(){ return (state.macroCategories||[]).filter(m=>m.kind==="expense"&&!m.archived); }
function planMonthsLabel(keys){
  const idx=k=>{const [y,m]=k.split("-").map(Number);return y*12+m-1;};
  const sh=k=>{const [y,m]=k.split("-").map(Number);return {m:MESI[m-1].slice(0,3),y};};
  const parts=[]; let start=null,prev=null;
  const flush=()=>{ if(!start) return; const a=sh(start),b=sh(prev);
    parts.push(start===prev?`${a.m} ${a.y}`:a.y===b.y?`${a.m}–${b.m} ${b.y}`:`${a.m} ${a.y}–${b.m} ${b.y}`); };
  keys.forEach(k=>{ if(prev&&idx(k)===idx(prev)+1) prev=k; else { flush(); start=k; prev=k; } });
  flush(); return parts.join(", ");
}
function planRowsHtml(items,base,macros,show,deltaOf){
  const sorted=items.slice().sort((a,b)=>b.amount-a.amount);
  return sorted.map(it=>{
    const mc=macros[it.macroId]||{name:"Macro categoria eliminata",emoji:"•",color:"#999999"};
    const pct=base>0?Math.min(100,it.amount/base*100):0;
    const d=deltaOf?deltaOf(it):0;
    const dl=Math.abs(d)>0.004?`<small class="plan-delta ${d>0?"up":"down"}">${d>0?"+":"−"}${show(Math.abs(d))}</small>`:"";
    return `<div class="plan-row"><span class="plan-ic" aria-hidden="true">${escapeHtml(mc.emoji||"•")}</span><span class="plan-name">${escapeHtml(mc.name)}</span><span class="plan-amt"><b>${show(it.amount)}</b>${dl}</span><span class="plan-bar" aria-hidden="true"><i style="width:${pct.toFixed(1)}%;background:${safeColor(mc.color)}"></i></span></div>`;
  }).join("");
}
function renderPlanning(){
  const box=document.getElementById("planMonth"); if(!box) return;
  const y=viewYear,m=viewMonth,key=estMonthKey(y,m);
  const show=v=>balancesHidden?"••••":fmt(v);
  const macros={}; (state.macroCategories||[]).forEach(x=>{macros[x.id]=x;});
  document.getElementById("planTitle").textContent=`Planning stipendio · ${MESI[m].toLowerCase()}`;
  const p=planOf(key);
  document.getElementById("planEditBtn").textContent=p?"Modifica":"＋ Imposta";
  if(!p){
    box.innerHTML=`<p class="empty-hint plan-empty">Nessuna suddivisione per ${MESI[m].toLowerCase()}. Dividi lo stipendio tra le macro categorie e stima quanto spendere in ciascuna.</p>`;
  } else {
    const tot=planTotal(p), base=p.salary>0?p.salary:tot;
    let foot=`<div class="plan-foot"><span>Totale diviso</span><b>${show(tot)}</b></div>`;
    if(p.salary>0){
      const left=p.salary-tot;
      foot=`<div class="plan-foot"><span>Stipendio</span><b>${show(p.salary)}</b></div>`+foot+`<div class="plan-foot ${left>=0?"ok":"over"}"><span>${left>=0?"Ancora da assegnare":"Oltre lo stipendio"}</span><b>${show(Math.abs(left))}</b></div>`;
    }
    box.innerHTML=`<div class="plan-rows">${planRowsHtml(p.items,base,macros,show)}</div>${foot}`;
  }
  // ---- Riepilogo: mesi con la stessa suddivisione accorpati ----
  const blk=document.getElementById("planSummaryBlock"), sum=document.getElementById("planSummary"), hint=document.getElementById("planSummaryHint");
  const plans=(state.salaryPlans||[]).filter(x=>x.items&&x.items.length).slice().sort((a,b)=>a.month.localeCompare(b.month));
  blk.hidden=!plans.length; if(!plans.length){ sum.innerHTML=""; return; }
  const groups=[]; const bySig={};
  plans.forEach(pl=>{ const s=planSignature(pl); if(!bySig[s]){ bySig[s]={sig:s,plan:pl,months:[]}; groups.push(bySig[s]); } bySig[s].months.push(pl.month); });
  const std=groups.slice().sort((a,b)=>b.months.length-a.months.length||a.months[0].localeCompare(b.months[0]))[0];
  const stdAmt={}; std.plan.items.forEach(i=>{stdAmt[i.macroId]=i.amount;});
  hint.textContent=groups.length===1?"Tutti i mesi impostati hanno la stessa suddivisione.":`${groups.length} suddivisioni diverse: i mesi uguali sono accorpati e le differenze sono rispetto alla più usata.`;
  sum.innerHTML=groups.slice().sort((a,b)=>a.months[0].localeCompare(b.months[0])).map((g,gi)=>{
    const isStd=g===std, multi=groups.length>1;
    const tot=planTotal(g.plan);
    const items=g.plan.items.slice();
    if(!isStd) Object.keys(stdAmt).forEach(id=>{ if(!items.some(i=>String(i.macroId)===String(id))) items.push({macroId:id,amount:0}); });
    const delta=isStd?null:(it=>it.amount-(stdAmt[it.macroId]||0));
    const chips=g.months.map(k=>`<button type="button" class="plan-chip${k===key?" active":""}" data-pm="${k}">${escapeHtml(MESI[Number(k.slice(5))-1].slice(0,3))} ${k.slice(0,4)}</button>`).join("");
    return `<div class="plan-group${multi&&!isStd?" diff":""}">
      <div class="plan-group-head"><b>${escapeHtml(planMonthsLabel(g.months))}</b><span>${g.months.length} ${g.months.length===1?"mese":"mesi"}</span>${multi?`<em class="${isStd?"std":"diff"}">${isStd?"La più usata":"Diversa"}</em>`:""}</div>
      <div class="plan-rows">${planRowsHtml(items.filter(i=>i.amount>0||!isStd),tot,macros,show,delta)}</div>
      <div class="plan-foot"><span>Totale diviso</span><b>${show(tot)}</b></div>
      <div class="plan-chips">${chips}</div>
    </div>`;
  }).join("");
  sum.querySelectorAll("[data-pm]").forEach(b=>b.addEventListener("click",()=>{ const [yy,mm]=b.dataset.pm.split("-").map(Number); estGoToMonth(yy,mm-1); window.scrollTo({top:0,behavior:"smooth"}); }));
}
function macroIdOfCategory(catId){ const cats=categoriesById(), c=cats[catId]; return (c&&(c.macroCategoryId||cats[c.parentCategoryId]?.macroCategoryId))||"_none"; }
/* Media mensile (ultimi 3 mesi prima di quello scelto) per macro categoria */
function macroAvgSpend(y,m){
  const out={};
  for(let k=1;k<=3;k++){ const d=new Date(y,m-k,1), by=monthSpentByCategory(d.getFullYear(),d.getMonth()); Object.entries(by).forEach(([cid,v])=>{ const mid=macroIdOfCategory(cid); out[mid]=(out[mid]||0)+v; }); }
  Object.keys(out).forEach(k=>{ out[k]=round2(out[k]/3); });
  return out;
}
function openPlanForm(){
  openSheet("tpl-plan-form",(node,close)=>{
    const $=s=>node.querySelector(s);
    const macros=planMacroList(), salaryIn=$("#planSalaryInput");
    let key=estMonthKey(viewYear,viewMonth), avg={}, dirty=false;
    const rowsEl=$("#planFormRows");
    rowsEl.innerHTML=macros.length?macros.map(mc=>`<div class="bm-row" data-macro="${escapeHtml(mc.id)}"><span class="bm-name"><span class="bm-ic" aria-hidden="true">${escapeHtml(firstGlyph(mc.emoji||"•"))}</span><span><b>${escapeHtml(mc.name)}</b><small class="pf-info"></small><button type="button" class="bm-sugg" hidden></button></span></span><span class="bm-input"><span class="bm-cur">€</span><input type="text" inputmode="decimal" placeholder="—" autocomplete="off" aria-label="Importo per ${escapeHtml(mc.name)}"></span></div>`).join(""):`<p class="empty-hint">Non ci sono macro categorie di spesa: creale da Altro.</p>`;
    const rows=[...rowsEl.querySelectorAll("[data-macro]")];
    const inp=r=>r.querySelector("input"), val=r=>{ const v=parseAmount(inp(r).value); return v>0?v:0; };
    const setVal=(r,v)=>{ inp(r).value=v>0?String(v).replace(".",","):""; };
    const upd=()=>{
      const tot=rows.reduce((s,r)=>s+val(r),0), sal=parseAmount(salaryIn.value)||0, base=sal>0?sal:tot, left=sal-tot;
      $("#pfDiv").textContent=fmt(round2(tot));
      const lb=$("#pfLeftLbl"), lv=$("#pfLeft");
      if(sal>0){ lb.textContent=left>=0?"Da assegnare":"Oltre lo stipendio"; lv.textContent=fmt(Math.abs(round2(left))); lv.className=left>=0?"ok":"over"; }
      else { lb.textContent="Stipendio"; lv.textContent="non indicato"; lv.className=""; }
      const bar=$("#pfBar"); bar.style.width=(base>0?Math.min(100,tot/base*100):0).toFixed(1)+"%"; bar.classList.toggle("over",sal>0&&tot>sal+0.004);
      rows.forEach(r=>{ const id=r.dataset.macro, v=val(r); r.querySelector(".pf-info").textContent=`media ${fmt(avg[id]||0)}`+(v>0&&base>0?` · ${Math.round(v/base*100)}% del ${sal>0?"stipendio":"totale"}`:""); });
    };
    const fill=k=>{
      key=k; dirty=false;
      const [yy,mm]=k.split("-").map(Number), p=planOf(k);
      avg=macroAvgSpend(yy,mm-1);
      salaryIn.value=p&&p.salary>0?String(p.salary).replace(".",","):"";
      rows.forEach(r=>{ const id=r.dataset.macro, it=p?.items.find(i=>String(i.macroId)===id); setVal(r,it?it.amount:0);
        const sg=suggestBudget(avg[id]||0), chip=r.querySelector(".bm-sugg"); chip.hidden=!(sg>0); if(sg>0){ chip.dataset.sugg=String(sg); chip.textContent=`usa ${fmt(sg)}`; } });
      $("#pfMonth").textContent=estMonthLabel(k).toLowerCase();
      $("#deletePlanBtn").hidden=!p;
      const prev=(state.salaryPlans||[]).filter(x=>x.month<k&&x.items.length).sort((a,b)=>b.month.localeCompare(a.month))[0];
      const copy=$("#pfCopy"); copy.hidden=!prev; copy._src=prev||null; if(prev) copy.textContent=`Copia da ${estMonthLabel(prev.month).toLowerCase()}`;
      upd();
    };
    const go=async d=>{
      if(dirty && !await askConfirm("Cambiando mese perdi le modifiche non salvate. Continuare?",{ok:"Continua",danger:false})) return;
      const [yy,mm]=key.split("-").map(Number), dt=new Date(yy,mm-1+d,1); fill(estMonthKey(dt.getFullYear(),dt.getMonth()));
    };
    $("#pfPrev").addEventListener("click",()=>go(-1)); $("#pfNext").addEventListener("click",()=>go(1));
    node.addEventListener("input",()=>{ dirty=true; upd(); });
    rowsEl.addEventListener("click",e=>{ const b=e.target.closest(".bm-sugg"); if(!b) return; setVal(b.closest("[data-macro]"),Number(b.dataset.sugg)); dirty=true; upd(); });
    $("#pfSuggest").addEventListener("click",()=>{
      let n=0; rows.forEach(r=>{ const sg=suggestBudget(avg[r.dataset.macro]||0); if(sg>0){ setVal(r,sg); n++; } });
      dirty=true; upd(); showToast(n?`Suggeriti ${n} importi: controlla e salva`:"Servono spese nei mesi scorsi per suggerire");
    });
    $("#pfCopy").addEventListener("click",()=>{ const src=$("#pfCopy")._src; if(!src) return;
      salaryIn.value=src.salary>0?String(src.salary).replace(".",","):""; rows.forEach(r=>{ const it=src.items.find(i=>String(i.macroId)===r.dataset.macro); setVal(r,it?it.amount:0); }); dirty=true; upd(); });
    $("#pfReset").addEventListener("click",()=>{ rows.forEach(r=>setVal(r,0)); dirty=true; upd(); });
    $("#deletePlanBtn").addEventListener("click",async()=>{
      if(!await askConfirm(`Eliminare il planning di ${estMonthLabel(key).toLowerCase()}?`,{ok:"Elimina"})) return;
      state.salaryPlans=(state.salaryPlans||[]).filter(p=>p.month!==key);
      persist(); close(); renderAll(); showToast("Planning eliminato");
    });
    $("#savePlanBtn").addEventListener("click",()=>{
      const items=rows.map(r=>({macroId:r.dataset.macro,amount:round2(val(r))})).filter(i=>i.amount>0);
      if(!items.length){ showToast("Inserisci almeno un importo"); return; }
      const sal=parseAmount(salaryIn.value);
      state.salaryPlans=(state.salaryPlans||[]).filter(p=>p.month!==key).concat([{month:key,salary:sal>0?round2(sal):null,items}]);
      persist(); close();
      if(key!==estMonthKey(viewYear,viewMonth)){ const [yy,mm]=key.split("-").map(Number); viewYear=yy; viewMonth=mm-1; }
      renderAll(); showToast(`Planning salvato per ${estMonthLabel(key).toLowerCase()}`);
    });
    fill(key);
  });
}
document.getElementById("planEditBtn")?.addEventListener("click",openPlanForm);
document.querySelectorAll(".tab").forEach(tab=>{
  tab.addEventListener("click", ()=> switchView(tab.dataset.view));
  if(tab.dataset.view==="accounts") bindLongPress(tab,()=>showAccountsMenu(tab));
});

// Swipe orizzontale: attivo solo in Home. In R&P è disabilitato.
// Direzione: swipe verso destra = mese precedente; swipe verso sinistra = mese successivo.
const MONTH_SWIPE_VIEWS=["home"];
const viewsRoot=document.getElementById("views");
let monthSwipeStartX=0,monthSwipeStartY=0,monthSwipeBlocked=false;
function moveMonthFromSwipe(delta){
  txVisibleLimit=TX_PAGE_SIZE;
  const d=new Date(viewYear,viewMonth+delta,1);
  viewYear=d.getFullYear();
  viewMonth=d.getMonth();
  viewDay=Math.min(viewDay,new Date(viewYear,viewMonth+1,0).getDate());
  closePeriodMenu();
  renderAll();
}
viewsRoot.addEventListener("touchstart",e=>{
  if(e.touches.length!==1 || !MONTH_SWIPE_VIEWS.includes(activeView)){monthSwipeBlocked=true;return;}
  const target=e.target;
  monthSwipeBlocked=Boolean(target.closest("input,textarea,select,button,a,[contenteditable='true'],.chart-wrap,.sheet,.movement-action-overlay"))
    || insideHScroller(target,viewsRoot);
  if(monthSwipeBlocked) return;
  const t=e.touches[0];monthSwipeStartX=t.clientX;monthSwipeStartY=t.clientY;
},{passive:true});
viewsRoot.addEventListener("touchend",e=>{
  if(monthSwipeBlocked || !MONTH_SWIPE_VIEWS.includes(activeView) || !e.changedTouches.length){monthSwipeBlocked=false;return;}
  const t=e.changedTouches[0],dx=t.clientX-monthSwipeStartX,dy=t.clientY-monthSwipeStartY;
  monthSwipeBlocked=false;
  if(Math.abs(dx)<58 || Math.abs(dx)<=Math.abs(dy)*1.25) return;
  moveMonthFromSwipe(dx>0 ? -1 : 1);
},{passive:true});
// v1.9.0 — Swipe verso destra nelle sotto-pagine: la pagina segue il dito
// e, superata la soglia, si torna alla sezione di origine (Home o R&P).
(function(){
  let g=null;
  const html=document.documentElement;
  const blocked=t=>t.closest("input,textarea,select,[contenteditable='true'],.chart-wrap,.sheet,.movement-action-overlay,.lp-popup,#overlayRoot,dialog");
  document.addEventListener("touchstart",e=>{
    g=null;
    if(!isSubView(activeView) || e.touches.length!==1 || overlayRoot.querySelector(".sheet")) return;
    if(blocked(e.target) || canScrollLeftWithin(e.target,document.body)) return;
    const t=e.touches[0];
    g={x:t.clientX,y:t.clientY,lastX:t.clientX,lastT:performance.now(),v:0,active:false,dead:false,view:document.querySelector(`.view[data-view="${activeView}"]`)};
  },{passive:true});
  document.addEventListener("touchmove",e=>{
    if(!g || g.dead || !g.view) return;
    const t=e.touches[0],dx=t.clientX-g.x,dy=t.clientY-g.y;
    if(!g.active){
      if(Math.abs(dy)>10 && Math.abs(dy)>=Math.abs(dx)){g.dead=true;return;}
      if(dx<-10){g.dead=true;return;}
      if(dx<12 || dx<Math.abs(dy)*1.3) return;
      g.active=true; g.view.classList.add("view-dragging"); html.classList.add("back-swiping");
    }
    e.preventDefault();
    const now=performance.now();
    g.v=(t.clientX-g.lastX)/Math.max(1,now-g.lastT); g.lastX=t.clientX; g.lastT=now;
    const x=Math.max(0,dx);
    g.view.style.transform=`translateX(${x}px)`;
    g.view.style.opacity=String(1-Math.min(x,420)/1000);
  },{passive:false});
  function end(e){
    if(!g) return;
    const s=g; g=null;
    if(!s.active) return;
    const endX=e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : s.lastX;
    const dx=endX-s.x;
    s.view.classList.remove("view-dragging");
    // Evita che il rilascio del dito apra la riga sotto.
    const stop=ev=>{ev.stopPropagation();ev.preventDefault();};
    document.addEventListener("click",stop,true);
    setTimeout(()=>document.removeEventListener("click",stop,true),350);
    const commit=dx>window.innerWidth*0.3 || (s.v>0.45 && dx>40);
    s.view.style.transition="transform .2s cubic-bezier(.2,.8,.2,1), opacity .2s ease";
    if(commit){
      s.view.style.transform="translateX(100%)"; s.view.style.opacity="0";
      setTimeout(()=>{s.view.style.transition="";s.view.style.transform="";s.view.style.opacity="";html.classList.remove("back-swiping");goBack();},200);
    }else{
      s.view.style.transform=""; s.view.style.opacity="";
      setTimeout(()=>{s.view.style.transition="";html.classList.remove("back-swiping");},220);
    }
  }
  document.addEventListener("touchend",end,{passive:true});
  document.addEventListener("touchcancel",end,{passive:true});
})();
// v1.9.0 — Menu azioni e scelta R/P: si chiudono anche con swipe in basso o a destra.
function bindOverlaySwipeDismiss(overlay){
  const menu=overlay.querySelector(".movement-action-menu"); if(!menu) return;
  let st=null;
  menu.addEventListener("touchstart",e=>{if(e.touches.length===1){const t=e.touches[0];st={x:t.clientX,y:t.clientY,axis:null};}},{passive:true});
  menu.addEventListener("touchmove",e=>{
    if(!st) return; const t=e.touches[0],dx=t.clientX-st.x,dy=t.clientY-st.y;
    if(!st.axis){ if(dy>10&&dy>Math.abs(dx)) st.axis="y"; else if(dx>10&&dx>Math.abs(dy)) st.axis="x"; else if(Math.abs(dx)>10||dy<-10){st=null;return;} else return; menu.style.transition="none"; }
    e.preventDefault();
    menu.style.transform=st.axis==="y"?`translateY(${Math.max(0,dy)}px)`:`translateX(${Math.max(0,dx)}px)`;
  },{passive:false});
  menu.addEventListener("touchend",e=>{
    if(!st||!st.axis){st=null;return;} const t=e.changedTouches[0],d=st.axis==="y"?t.clientY-st.y:t.clientX-st.x,ax=st.axis; st=null;
    menu.style.transition="transform .2s ease";
    if(d>80){menu.style.transform=ax==="y"?"translateY(110%)":"translateX(110%)";overlay.classList.remove("show");setTimeout(()=>overlay.remove(),200);}
    else menu.style.transform="";
  },{passive:true});
}
document.querySelectorAll("#txTypeToggle [data-tx-type]").forEach(btn=>btn.addEventListener("click",()=>{txFilter=btn.dataset.txType;txVisibleLimit=TX_PAGE_SIZE;document.querySelectorAll("#txTypeToggle .type-opt").forEach(x=>x.classList.toggle("active",x===btn));renderTransactionsView();}));
document.getElementById("txSearchInput").addEventListener("input",e=>{
  const value=e.target.value.trim();
  clearTimeout(txSearchTimer);
  txSearchTimer=setTimeout(()=>{txSearchQuery=value;txVisibleLimit=TX_PAGE_SIZE;renderTransactionsView();},180);
});
document.getElementById("loadMoreTxBtn")?.addEventListener("click",()=>{txVisibleLimit+=TX_PAGE_SIZE;renderTransactionsView();});
document.getElementById("toggleCustomRange").addEventListener("click",()=>{const el=document.getElementById("txCustomRange");el.hidden=!el.hidden;});
document.getElementById("txDateFrom").addEventListener("change",e=>{txDateFrom=e.target.value;txVisibleLimit=TX_PAGE_SIZE;renderTransactionsView();});
document.getElementById("txDateTo").addEventListener("change",e=>{txDateTo=e.target.value;txVisibleLimit=TX_PAGE_SIZE;renderTransactionsView();});
document.getElementById("clearCustomRange").addEventListener("click",()=>{txDateFrom="";txDateTo="";txVisibleLimit=TX_PAGE_SIZE;document.getElementById("txDateFrom").value="";document.getElementById("txDateTo").value="";renderTransactionsView();});
document.getElementById("backToHomeTx").addEventListener("click",()=>switchView("home"));
document.getElementById("seeAllTx").addEventListener("click", ()=> {periodModes.transactions=periodModes.home;openSubView("transactions");});
document.getElementById("txPeriodBtn")?.addEventListener("click",()=>openPeriodPicker("transactions"));
document.getElementById("openRPFromHome").addEventListener("click",()=>switchView("recurring"));

function closePeriodMenu(){document.getElementById("periodMenu").hidden=true;document.getElementById("monthLabel").setAttribute("aria-expanded","false");}
document.getElementById("monthLabel").addEventListener("click",()=>{
  // Stime ragiona solo per mese: niente giorno/periodo, basta il selettore del mese.
  if(activeView==="estimates") showMonthQuickPicker(document.getElementById("monthLabel"));
  else openPeriodPicker();
});
bindLongPress(document.getElementById("monthLabel"),()=>showMonthQuickPicker(document.getElementById("monthLabel")));
/* v1.61.0 — Tenendo premuto su Conti si sceglie tra Conti e Altro. */
function showAccountsMenu(anchor){
  closeLongPressPopup();
  const pop=document.createElement("div");
  pop.className="lp-popup mp-popup";pop.id="lpPopup";pop.setAttribute("role","menu");pop.setAttribute("aria-label","Conti o Altro");
  const cur=activeView==="more"?"more":"accounts";
  pop.innerHTML=`<div class="mp-list"><button type="button" class="mp-row${cur==="accounts"?" active":""}" data-go="accounts"><b>Conti</b></button><button type="button" class="mp-row${cur==="more"?" active":""}" data-go="more"><b>Altro</b></button></div>`;
  document.body.appendChild(pop);
  pop.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>{closeLongPressPopup();switchView(b.dataset.go);}));
  const r=anchor.getBoundingClientRect(), vw=window.innerWidth;
  const w=Math.min(170,vw-24); pop.style.width=w+"px";
  const left=Math.min(Math.max(12,r.left+r.width/2-w/2),vw-w-12);
  const ph=pop.offsetHeight;
  pop.style.left=left+"px"; pop.style.top=Math.max(12,r.top-ph-10)+"px";
  requestAnimationFrame(()=>pop.classList.add("show"));
  setTimeout(()=>{ document.addEventListener("pointerdown",lpOutside,true); window.addEventListener("scroll",closeLongPressPopup,{once:true,capture:true}); },0);
}
function showMonthQuickPicker(anchor){
  /* v1.69.0 — al posto del menu a tendina: lo stesso calendario, solo con i mesi */
  closeLongPressPopup(); openPeriodPicker(activeView,{monthOnly:true}); return;
  const pop=document.createElement("div");
  pop.className="lp-popup mp-popup";pop.id="lpPopup";pop.setAttribute("role","dialog");pop.setAttribute("aria-label","Scegli il mese");
  const items=[];
  for(let i=-3;i<=3;i++){
    const d=new Date(viewYear,viewMonth+i,1);
    items.push({y:d.getFullYear(),m:d.getMonth(),cur:i===0});
  }
  const rows=items.map(it=>`<button type="button" class="mp-row${it.cur?" active":""}" data-y="${it.y}" data-m="${it.m}"><b>${MESI[it.m]}</b><small>${it.y}</small></button>`).join("");
  pop.innerHTML=`<div class="lp-head">Scegli il mese</div><div class="mp-list">${rows}</div>`;
  document.body.appendChild(pop);
  pop.querySelectorAll("[data-m]").forEach(b=>b.addEventListener("click",()=>{
    viewYear=Number(b.dataset.y);viewMonth=Number(b.dataset.m);
    viewDay=Math.min(viewDay||1,new Date(viewYear,viewMonth+1,0).getDate());
    periodModes[activeView]="month";txVisibleLimit=TX_PAGE_SIZE;closeLongPressPopup();renderAll();
  }));
  const r=anchor.getBoundingClientRect(), vw=window.innerWidth, vh=window.innerHeight;
  const w=Math.min(220,vw-24); pop.style.width=w+"px";
  let left=Math.min(Math.max(12,r.left+r.width/2-w/2),vw-w-12);
  const ph=pop.offsetHeight;
  let top=r.bottom+8;
  if(top+ph>vh-90) top=Math.max(12,r.top-ph-8);
  pop.style.left=left+"px"; pop.style.top=top+"px";
  requestAnimationFrame(()=>pop.classList.add("show"));
  setTimeout(()=>{
    document.addEventListener("pointerdown",lpOutside,true);
    window.addEventListener("scroll",closeLongPressPopup,{once:true,capture:true});
  },0);
}
document.getElementById("periodX").addEventListener("click",()=>setPeriodMode("month"));
/* v1.7.0 — Selettore del periodo (Home, R&P, Tutti i movimenti):
   - tocca il titolo del mese per vedere i 12 mesi e cambiare mese/anno;
   - "Tutto il mese" mostra il mese intero;
   - tocca un giorno = solo quel giorno; tocca un secondo giorno = periodo dal primo al secondo; poi "Mostra". */
function renderMonthsGrid(container,year,currentY,currentM,onPick){
  container.innerHTML=MESI_BREVI.map((m,i)=>`<button type="button" class="pp-month${year===currentY&&i===currentM?" selected":""}${year===new Date().getFullYear()&&i===new Date().getMonth()?" today":""}" data-m="${i}">${m}</button>`).join("");
  container.querySelectorAll("[data-m]").forEach(b=>b.addEventListener("click",()=>onPick(Number(b.dataset.m))));
}
function yearsRange(){
  const now=new Date().getFullYear();
  const years=[...state.transactions.map(t=>t.date),...state.planned.map(p=>p.date),...state.recurring.map(r=>r.startDate)].filter(Boolean).map(d=>parseInt(d.slice(0,4),10)).filter(Number.isFinite);
  const min=Math.min(now-5,...years), max=Math.max(now+5,...years);
  const out=[];for(let y=min;y<=max;y++)out.push(y);return out;
}
function renderYearsGrid(container,currentY,onPick){
  const nowY=new Date().getFullYear();
  container.innerHTML=yearsRange().map(y=>`<button type="button" class="pp-month pp-year${y===currentY?" selected":""}${y===nowY?" today":""}" data-y="${y}">${y}</button>`).join("");
  container.querySelectorAll("[data-y]").forEach(b=>b.addEventListener("click",()=>onPick(Number(b.dataset.y))));
  const sel=container.querySelector(".selected"); if(sel) sel.scrollIntoView({block:"center"});
}
/* Calendario sempre di 6 settimane (42 caselle): stessa altezza per mesi di 28, 29, 30 o 31 giorni. */
function padCalendarGrid(grid,lead,days){
  // v1.9.1: completa solo l'ultima settimana (niente riga vuota in fondo).
  const total=Math.ceil((lead+days)/7)*7;
  for(let i=lead+days;i<total;i++){const b=document.createElement("div");b.className="calendar-cell empty";grid.appendChild(b);}
}
/* v1.69.0 — CALENDARIO NELLO STILE DI BET TRACKER (Cosa vuoi vedere? · Home, R&P, Tutti i movimenti, Statistiche):
   - in alto i mesi in una striscia, ognuno con il suo netto (entrate − uscite, senza giroconti e rettifiche): un tocco e
     ci sei, il mese scelto resta in vista. Niente più tocco sul titolo per passare a mesi e anni;
   - frecce ‹ › grandi ai lati del nome del mese (sotto: netto e quanti movimenti); sul calendario scorri col dito a
     sinistra o a destra per cambiare mese;
   - ogni giorno con movimenti è colorato (verde se hai incassato più di quanto hai speso, rosso il contrario, più
     intenso quanto più grande) e mostra il suo netto; i pallini restano per una tantum (giallo) e ricorrenti (viola);
   - tocca un giorno = solo quel giorno; tocca un secondo giorno = periodo; "Tutto <mese>" e "Mostra" come prima.
   Tenendo premuto il mese in alto (e in Stime) si apre lo stesso calendario solo con i mesi. */
function ppShort(n){
  const a=Math.abs(n), s=n<0?"−":n>0?"+":"";
  if(a>=10000) return s+Math.round(a/1000)+"k";
  if(a>=1000) return s+(a/1000).toLocaleString("it-IT",{maximumFractionDigits:1})+"k";
  return s+Math.round(a).toLocaleString("it-IT");
}
function ppMonthNet(y,m){
  const pre=`${y}-${pad2(m+1)}`; let net=0,n=0;
  state.transactions.forEach(t=>{ if(!String(t.date).startsWith(pre)||t.type==="transfer"||t.isBalanceAdjustment) return; n++; net+=t.type==="income"?t.amount:-t.amount; });
  return {net:Math.round(net*100)/100,n};
}
function ppMonthsList(){
  const now=new Date(), cur=now.getFullYear()*12+now.getMonth();
  const dates=state.transactions.map(t=>t.date).filter(Boolean).sort();
  let first=cur-6;
  if(dates.length){ const d=new Date(dates[0]+"T00:00:00"); first=Math.min(first,d.getFullYear()*12+d.getMonth()); }
  const last=cur+6, out=[];
  for(let k=Math.max(first,last-71);k<=last;k++) out.push({y:Math.floor(k/12),m:k%12});
  return out;
}
function openPeriodPicker(view=activeView,opts=null){
  const target=view;
  const monthOnly=!!(opts&&opts.monthOnly);
  if(monthOnly) opts=null;
  let pYear=viewYear,pMonth=viewMonth;
  const mode=opts?"range":(periodModes[target]||"month");
  let selStart=monthOnly?null:opts?opts.from:mode==="day"?selectedDate():mode==="range"?periodRange.from:null;
  let selEnd=monthOnly?null:opts?(opts.to!==opts.from?opts.to:null):mode==="range"?periodRange.to:null;
  if(opts && opts.to){const d=new Date(opts.to+"T00:00:00");pYear=d.getFullYear();pMonth=d.getMonth();}
  else if(mode==="range" && periodRange.from && !monthOnly){const d=new Date(periodRange.from+"T00:00:00");pYear=d.getFullYear();pMonth=d.getMonth();}
  openSheet("tpl-period-picker",(node)=>{
    const closeBtn=node.querySelector("[data-close]");
    const title=node.querySelector("#ppTitle"), days=node.querySelector("#ppDays"), strip=node.querySelector("#ppStrip");
    const hint=node.querySelector("#ppHint"), apply=node.querySelector("#ppApply"), whole=node.querySelector("#ppWholeMonth");
    const head=node.querySelector("#ppHead"), prevB=node.querySelector("#ppPrev"), nextB=node.querySelector("#ppNext");
    const months=ppMonthsList(), nowD=new Date(), nowK=nowD.getFullYear()*12+nowD.getMonth();
    node.classList.toggle("pp-monthonly",monthOnly);
    if(monthOnly && head) head.textContent="Scegli il mese";
    const goMonth=(y,m)=>{
      viewYear=y;viewMonth=m;viewDay=Math.min(viewDay||1,new Date(y,m+1,0).getDate());
      periodModes[target]="month";txVisibleLimit=TX_PAGE_SIZE;closeBtn.click();renderAll();
    };
    function paintStrip(){
      strip.innerHTML=months.map(({y,m})=>{
        const k=y*12+m, on=y===pYear&&m===pMonth, r=k<=nowK?ppMonthNet(y,m):null;
        const name=MESI_BREVI[m]+(y!==nowD.getFullYear()?" "+String(y).slice(2):"");
        const cls=r&&r.n?(r.net>0.004?"pos":r.net<-0.004?"neg":""):"";
        return `<button type="button" role="tab" aria-selected="${on}" class="mc2-m${on?" on":""}${k===nowK?" now":""}${k>nowK?" fut":""}" data-pp-m="${y}-${m}" data-no-icon><b>${name}</b><small class="${cls}">${r&&r.n?(balancesHidden?"••":ppShort(r.net)):"—"}</small></button>`;
      }).join("");
      const sel=strip.querySelector(".mc2-m.on");
      if(sel) requestAnimationFrame(()=>{ strip.scrollLeft=Math.max(0,sel.offsetLeft-strip.clientWidth/2+sel.offsetWidth/2); });
    }
    function paint(){
      const r=ppMonthNet(pYear,pMonth), k=pYear*12+pMonth;
      title.innerHTML=`<b>${MESI[pMonth]} ${pYear}</b><small class="${r.n?(r.net>0.004?"pos":r.net<-0.004?"neg":""):""}">${k>nowK?"mese futuro":r.n?`${balancesHidden?"••••":fmtSigned(r.net)} · ${r.n} ${r.n===1?"movimento":"movimenti"}`:"nessun movimento"}</small>`;
      prevB.disabled=k<=months[0].y*12+months[0].m; nextB.disabled=k>=months[months.length-1].y*12+months[months.length-1].m;
      paintStrip();
      whole.textContent=`Tutto ${MESI[pMonth].toLowerCase()}`;
      whole.classList.toggle("active",!opts && mode==="month" && !selStart && pYear===viewYear && pMonth===viewMonth);
      if(monthOnly){ apply.disabled=false; apply.textContent=`Vai a ${MESI[pMonth].toLowerCase()} ${pYear}`; return; }
      const grid=node.querySelector("#ppGrid");grid.innerHTML="";
      const lead=(new Date(pYear,pMonth,1).getDay()+6)%7, n=new Date(pYear,pMonth+1,0).getDate();
      const info=buildCalendarDayInfo(pYear,pMonth), todayStr=todayISO(), pre=`${pYear}-${pad2(pMonth+1)}`;
      const net={};
      state.transactions.forEach(t=>{ if(!String(t.date).startsWith(pre)||t.type==="transfer"||t.isBalanceAdjustment) return; net[t.date]=(net[t.date]||0)+(t.type==="income"?t.amount:-t.amount); });
      const maxAbs=Math.max(1,...Object.values(net).map(v=>Math.abs(v)));
      for(let i=0;i<lead;i++){const b=document.createElement("span");b.className="mc2-d empty";grid.appendChild(b);}
      for(let d=1;d<=n;d++){
        const iso=`${pre}-${pad2(d)}`, v=net[iso], di=info[iso]||{};
        const isStart=iso===selStart, isEnd=iso===selEnd, inside=selStart&&selEnd&&iso>selStart&&iso<selEnd;
        const tone=v==null?"":v>0.004?"up":v<-0.004?"down":"flat", a=v==null?0:Math.round(16+50*Math.min(1,Math.abs(v)/maxAbs));
        const cell=document.createElement("button");cell.type="button";cell.setAttribute("data-no-icon","");
        cell.className="mc2-d"+(tone?" "+tone:"")+(iso===todayStr?" today":"")+(iso>todayStr?" future":"")+(isStart||isEnd?" sel":"")+(inside?" in-range":"")+(isStart&&selEnd?" range-start":"")+(isEnd?" range-end":"");
        cell.style.setProperty("--a",a+"%");
        const dots=(di.planned?'<i class="dp"></i>':"")+(di.recurring?'<i class="dr"></i>':"");
        cell.innerHTML=`<b>${d}</b><span>${v==null?"":balancesHidden?"••":ppShort(v)}</span>${dots?`<em class="mc2-dots">${dots}</em>`:""}`;
        cell.setAttribute("aria-label",`${d} ${MESI[pMonth]} ${pYear}${v!=null?", netto "+fmtSigned(v):""}${di.planned?", una tantum":""}${di.recurring?", ricorrente":""}`);
        cell.addEventListener("click",()=>{
          if(Date.now()-swiped<400) return;
          if(!selStart || selEnd){selStart=iso;selEnd=null;}
          else if(iso===selStart){selEnd=null;}
          else if(iso<selStart){selEnd=selStart;selStart=iso;}
          else selEnd=iso;
          paint();
        });
        grid.appendChild(cell);
      }
      const total=Math.ceil((lead+n)/7)*7; for(let i=lead+n;i<total;i++){const b=document.createElement("span");b.className="mc2-d empty";grid.appendChild(b);}
      if(!selStart){hint.textContent="Tocca un giorno, oppure due giorni per un periodo.";apply.disabled=true;apply.textContent="Mostra";}
      else if(!selEnd){hint.textContent=`${shortDate(selStart,true)} · tocca un altro giorno per scegliere un periodo`;apply.disabled=false;apply.textContent="Mostra giorno";}
      else{hint.textContent=`Dal ${shortDate(selStart)} al ${shortDate(selEnd,true)}`;apply.disabled=false;apply.textContent="Mostra periodo";}
    }
    const step=dir=>{ pMonth+=dir; if(pMonth<0){pMonth=11;pYear--;} if(pMonth>11){pMonth=0;pYear++;} paint(); };
    prevB.addEventListener("click",()=>step(-1));
    nextB.addEventListener("click",()=>step(1));
    strip.addEventListener("click",e=>{
      const b=e.target.closest("[data-pp-m]"); if(!b) return;
      const [y,m]=b.dataset.ppM.split("-").map(Number);
      if(monthOnly){ goMonth(y,m); return; }
      pYear=y;pMonth=m;paint();
    });
    /* scorri col dito sul calendario per cambiare mese */
    let sx=null,sy=0,swiped=0;
    days.addEventListener("touchstart",e=>{ if(e.touches.length===1){ sx=e.touches[0].clientX; sy=e.touches[0].clientY; } },{passive:true});
    days.addEventListener("touchend",e=>{
      if(sx==null) return; const t=e.changedTouches[0], dx=t.clientX-sx, dy=t.clientY-sy; sx=null;
      if(Math.abs(dx)<50||Math.abs(dx)<Math.abs(dy)*1.5) return;
      if(dx<0 && nextB.disabled) return; if(dx>0 && prevB.disabled) return;
      swiped=Date.now(); step(dx<0?1:-1);
    },{passive:true});
    whole.addEventListener("click",()=>{
      if(opts){const last=new Date(pYear,pMonth+1,0).getDate();closeBtn.click();opts.onApply({from:`${pYear}-${pad2(pMonth+1)}-01`,to:`${pYear}-${pad2(pMonth+1)}-${pad2(last)}`});return;}
      goMonth(pYear,pMonth);
    });
    apply.addEventListener("click",()=>{
      if(monthOnly){ goMonth(pYear,pMonth); return; }
      if(!selStart) return;
      if(opts){const r={from:selStart,to:selEnd||selStart};closeBtn.click();opts.onApply(r);return;}
      const d=new Date(selStart+"T00:00:00");viewYear=d.getFullYear();viewMonth=d.getMonth();viewDay=d.getDate();
      if(selEnd){periodRange={from:selStart,to:selEnd};periodModes[target]="range";}
      else periodModes[target]="day";
      txVisibleLimit=TX_PAGE_SIZE;closeBtn.click();renderAll();
    });
    paint();
  });
}
function setPeriodMode(mode){
  if(mode===periodModes[activeView]) return;
  if(mode==="day"){
    const today=new Date();
    if(viewYear===today.getFullYear()&&viewMonth===today.getMonth()) viewDay=today.getDate();
    else viewDay=Math.min(viewDay||1,new Date(viewYear,viewMonth+1,0).getDate());
  }
  periodModes[activeView]=mode;txVisibleLimit=TX_PAGE_SIZE;closeDatePicker();renderAll();
}
document.querySelectorAll("[data-period-set]").forEach(b=>b.addEventListener("click",()=>{
  const mode=b.dataset.periodSet;
  if(mode===periodModes[activeView]) return;
  if(mode==="day"){
    const today=new Date();
    if(viewYear===today.getFullYear()&&viewMonth===today.getMonth()) viewDay=today.getDate();
    else viewDay=Math.min(viewDay||1,new Date(viewYear,viewMonth+1,0).getDate());
  }
  periodModes[activeView]=mode;txVisibleLimit=TX_PAGE_SIZE;closeDatePicker();renderAll();
}));
document.addEventListener("click",e=>{if(!e.target.closest(".period-picker"))closePeriodMenu();});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closePeriodMenu();});
document.querySelectorAll("[data-period]").forEach(b=>b.addEventListener("click",()=>{
  const today=new Date();
  viewYear=today.getFullYear();viewMonth=today.getMonth();viewDay=today.getDate();
  periodModes[activeView]="day";closeDatePicker();closePeriodMenu();renderAll();
}));
function closeDatePicker(){
  document.getElementById("dateField").hidden=true;
  document.getElementById("chooseDay").setAttribute("aria-expanded","false");
}
document.getElementById("chooseDay").addEventListener("click",()=>{
  const field=document.getElementById("dateField");field.hidden=!field.hidden;
  document.getElementById("chooseDay").setAttribute("aria-expanded",String(!field.hidden));
  if(!field.hidden){
    const input=document.getElementById("periodDate");input.focus();
    if(input.showPicker){try{input.showPicker();}catch(e){/* The visible date field remains usable. */}}
  }
});
document.getElementById("backToMonth").addEventListener("click",()=>{
  periodModes[activeView]="month";closeDatePicker();closePeriodMenu();renderAll();
});
document.getElementById("backToCurrentMonth").addEventListener("click",()=>{
  const today=new Date();
  viewYear=today.getFullYear();viewMonth=today.getMonth();viewDay=today.getDate();
  periodModes.home="month";periodModes.recurring="month";periodModes.estimates="month";
  txVisibleLimit=TX_PAGE_SIZE;closeDatePicker();closePeriodMenu();renderAll();
});
document.getElementById("periodDate").addEventListener("change",e=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(e.target.value))return;
  const [y,m,d]=e.target.value.split("-").map(Number);viewYear=y;viewMonth=m-1;viewDay=d;
  periodModes[activeView]="day";closeDatePicker();renderAll();
});
document.getElementById("backFromPlanned").addEventListener("click",()=>switchView("home"));
function movePeriod(delta){
  txVisibleLimit=TX_PAGE_SIZE;
  if(periodModes[activeView]==="day"){
    const d=new Date(viewYear,viewMonth,viewDay+delta);viewYear=d.getFullYear();viewMonth=d.getMonth();viewDay=d.getDate();
  }else{
    const d=new Date(viewYear,viewMonth+delta,1);viewYear=d.getFullYear();viewMonth=d.getMonth();viewDay=Math.min(viewDay,new Date(viewYear,viewMonth+1,0).getDate());
  }
  closePeriodMenu();renderAll();
}
document.getElementById("prevMonth").addEventListener("click",()=>movePeriod(-1));
document.getElementById("nextMonth").addEventListener("click",()=>movePeriod(1));

/* ---------------- Tema chiaro/scuro/sistema ---------------- */
document.querySelectorAll("#themeModeToggle .type-opt").forEach(opt=>{
  opt.addEventListener("click", ()=>{
    currentThemeMode = opt.dataset.themeMode;
    safeSetLocalStorage(THEME_KEY, currentThemeMode,{notify:false});
    applyTheme(currentThemeMode);
  });
});

/* ---------------- Statistiche: toggle categoria/macrocategoria ---------------- */
document.querySelectorAll("#statsGroupToggle .type-opt").forEach(opt=>{
  opt.addEventListener("click", ()=>{
    document.querySelectorAll("#statsGroupToggle .type-opt").forEach(o=>o.classList.remove("active"));
    opt.classList.add("active");
    statsGroupMode = opt.dataset.group;
    renderPie();
  });
});
document.querySelectorAll("#statsNatureToggle .type-opt").forEach(opt=>opt.addEventListener("click",()=>{statsNature=opt.dataset.statsNature;document.querySelectorAll("#statsNatureToggle .type-opt").forEach(x=>x.classList.toggle("active",x===opt));document.querySelector("#view-stats .section-head h2").textContent=statsNature==="income"?"Entrate per categoria":"Spese per categoria";renderPie();}));
document.querySelectorAll("[data-chart-info]").forEach(btn=>btn.addEventListener("click",()=>openChartInfo(btn.dataset.chartInfo)));

/* ---------------- Sheet / overlay system ---------------- */
const overlayRoot = document.getElementById("overlayRoot");
function canScrollLeftWithin(el,root){
  for(let n=el;n && n!==root && n!==document.body;n=n.parentElement){
    if(n.scrollWidth>n.clientWidth+2 && n.scrollLeft>0){
      const ox=getComputedStyle(n).overflowX;
      if(ox==="auto"||ox==="scroll") return true;
    }
  }
  return false;
}
/* Il dito è partito dentro una striscia che scorre di lato? Allora quel movimento è suo:
   niente cambio mese. */
function insideHScroller(el,root){
  for(let n=el;n && n!==root && n!==document.body;n=n.parentElement){
    if(n.scrollWidth>n.clientWidth+2){
      const ox=getComputedStyle(n).overflowX;
      if(ox==="auto"||ox==="scroll") return true;
    }
  }
  return false;
}
function openSheet(templateId, setup){
  const tpl = document.getElementById(templateId);
  const backdrop = document.createElement("div");
  backdrop.className = "overlay-backdrop";
  const node = tpl.content.firstElementChild.cloneNode(true);
  overlayRoot.appendChild(backdrop);
  overlayRoot.appendChild(node);
  overlayRoot.style.pointerEvents = "auto";
  document.documentElement.classList.add("sheet-open");
  requestAnimationFrame(()=>node.querySelectorAll(".amount-field input").forEach(fitAmountInput));

  let closing=false;
  function finishClose(){
    backdrop.remove();
    node.remove();
    overlayRoot.style.pointerEvents = overlayRoot.querySelector(".sheet") ? "auto" : "none";
    if(!overlayRoot.querySelector(".sheet")) document.documentElement.classList.remove("sheet-open");
  }
  function close(fromSwipe=false,speed=0){
    if(closing) return;
    closing=true;
    node.classList.remove("dragging");
    node.style.transition="";
    backdrop.style.transition="";
    backdrop.style.opacity="";
    let wait=280;
    if(fromSwipe){
      /* v1.29.0 — Chiusura col dito: il pannello continua alla velocità del gesto e finisce
         in fretta (prima ripartiva con la curva lenta da 0,28 s e sembrava al rallentatore).
         Durante l'uscita si spegne la sfocatura, che su iPhone appesantisce l'animazione. */
      const horiz=fromSwipe==="x";
      const m=/translate[XY]\((-?[\d.]+)px\)/.exec(node.style.transform||"");
      const done=m?Math.max(0,parseFloat(m[1])):0;
      const total=horiz?node.offsetWidth:node.offsetHeight;
      const rest=Math.max(0,total+24-done);
      const v=Math.max(1.4,Math.abs(speed)||0);                 // px per millisecondo
      wait=Math.round(Math.min(240,Math.max(120,rest/v)));
      node.classList.add("sheet-leaving");
      node.style.transition=`transform ${wait}ms cubic-bezier(.3,.6,.55,1)`;
      backdrop.style.transition=`opacity ${wait}ms linear`;
      node.style.transform=horiz?`translateX(${total+24}px)`:`translateY(${total+24}px)`;
      backdrop.classList.remove("show");
      backdrop.style.opacity="0";
    }else{
      node.style.transform="";
      node.classList.remove("show");
      backdrop.classList.remove("show");
    }
    setTimeout(finishClose, wait+20);
  }
  node._close=()=>close(false);
  node._closeNow=()=>{ if(closing) return; closing=true; finishClose(); };
  backdrop.addEventListener("click", ()=>close(false));
  node.querySelectorAll("[data-close]").forEach(b=> b.addEventListener("click", ()=>close(false)));

  // Bottom-sheet gesture: quando il pannello è già in cima, uno swipe verso il
  // basso può iniziare dalla maniglia, dall'intestazione o dalla parte visibile
  // del contenuto. Il foglio segue il dito e si chiude per distanza o velocità.
  let touch=null;
  const resetDrag=()=>{
    touch=null;
    node.classList.remove("dragging");
    node.style.transform="";
    backdrop.style.opacity="";
  };
  node.addEventListener("touchstart", e=>{
    if(closing || e.touches.length!==1) return;
    const t=e.touches[0];
    touch={
      x:t.clientX,
      y:t.clientY,
      lastY:t.clientY,
      lastTime:performance.now(),
      velocityY:0,
      active:false,
      cancelled:false,
      canPull:node.scrollTop<=1 || Boolean(e.target.closest(".sheet-handle, .sheet-head")),
      canX:!e.target.closest("input,textarea,select,[contenteditable='true'],.chart-wrap,.donut-wrap,svg") && !canScrollLeftWithin(e.target,node),
      axis:null,lastX:t.clientX,velocityX:0
    };
  }, {passive:true});
  node.addEventListener("touchmove", e=>{
    if(!touch || touch.cancelled || e.touches.length!==1) return;
    const t=e.touches[0];
    const dx=t.clientX-touch.x;
    const dy=t.clientY-touch.y;

    // Lascia funzionare normalmente scroll verso l'alto e gesti orizzontali.
    if(!touch.active && touch.canX && dx>12 && dx>Math.abs(dy)*1.3){
      touch.active=true; touch.axis="x";
      node.classList.add("dragging");
    }
    if(touch.axis==="x"){
      e.preventDefault();
      const nowX=performance.now();
      touch.velocityX=(t.clientX-touch.lastX)/Math.max(1,nowX-touch.lastTime);
      touch.lastX=t.clientX; touch.lastTime=nowX;
      const x=Math.max(0,dx);
      node.style.transform=`translateX(${x}px)`;
      backdrop.style.opacity=String(Math.max(0.12,1-Math.min(x,420)/520));
      return;
    }
    if(!touch.active){
      if(Math.abs(dx)>Math.abs(dy)+4){ if(dx<0||!touch.canX) touch.cancelled=true; return; }
      if(dy<0){ touch.cancelled=true; return; }
      if(dy<7) return;
      if(!(touch.canPull && node.scrollTop<=1)){ touch.cancelled=true; return; }
      touch.active=true;
      node.classList.add("dragging");
    }

    e.preventDefault();
    const distance=Math.max(0,dy);
    const now=performance.now();
    const dt=Math.max(1,now-touch.lastTime);
    touch.velocityY=(t.clientY-touch.lastY)/dt;
    touch.lastY=t.clientY;
    touch.lastTime=now;

    // Una lieve resistenza rende naturale il trascinamento oltre ~300 px.
    const translated=distance<=300 ? distance : 300+(distance-300)*0.35;
    node.style.transform=`translateY(${translated}px)`;
    backdrop.style.opacity=String(Math.max(0.12,1-Math.min(distance,420)/520));
  }, {passive:false});
  node.addEventListener("touchend", e=>{
    if(!touch) return;
    const t=e.changedTouches[0];
    if(touch.axis==="x"){
      const dxEnd=t.clientX-touch.x, flickX=touch.velocityX>0.5 && dxEnd>36, touch0vx=touch.velocityX;
      touch=null;
      if(dxEnd>100 || flickX){ close("x",touch0vx); return; }
      node.classList.remove("dragging");
      node.style.transform="";
      backdrop.style.opacity="";
      return;
    }
    const dy=t.clientY-touch.y;
    const fastFlick=touch.velocityY>0.55 && dy>32;
    const shouldClose=touch.active && (dy>92 || fastFlick);
    const wasActive=touch.active, vy=touch.velocityY;
    touch=null;

    if(shouldClose){
      close(true,vy);
      return;
    }
    if(wasActive){
      node.classList.remove("dragging");
      node.style.transform="";
      backdrop.style.opacity="";
    }
  }, {passive:true});
  node.addEventListener("touchcancel", resetDrag, {passive:true});

  requestAnimationFrame(()=>{
    backdrop.classList.add("show");
    node.classList.add("show");
  });

  if(typeof setup === "function") setup(node, close);
  return { node, close };
}

/* ---------------- v1.12.0 — Prestiti: da ricevere e da pagare, per persona ----------------
   Ogni persona (o ente) ha un conto prestito nascosto dalla lista dei conti:
   - "Da ricevere · Nome" (receivable): sale quando presto o pago la sua parte di una spesa, scende quando mi restituisce;
   - "Da pagare · Nome" (payable): scende sotto zero quando ricevo un prestito, risale quando restituisco o pago una rata.
   I movimenti sono trasferimenti: il saldo dei conti resta corretto e le spese contano solo la mia parte.
   "Spesa divisa" nel nuovo movimento: Metà, Percentuale o Tutto a lui/lei (= prestito intero). */
function isLoanAccount(a){ return !!(a && (a.receivable || a.payable)); }
function loanAccount(id){ const a=state.accounts.find(x=>x.id===id); return isLoanAccount(a)?a:null; }
// v1.25.0: una persona eliminata resta come conto "archiviato" (saldo zero, storico intatto) e non compare più.
function receivableAccounts(){ return state.accounts.filter(a=>a.receivable&&!a.archived); }
function payableAccounts(){ return state.accounts.filter(a=>a.payable&&!a.archived); }
function payableTotal(){ return -payableAccounts().reduce((s,a)=>s+accountBalance(a.id),0); } // positivo = quanto devo
function ensureLoanAccount(person,kind){
  const name=String(person||"").trim().slice(0,30);
  const flag=kind==="pay"?"payable":"receivable";
  let acc=state.accounts.find(a=>a[flag] && String(a.person||"").toLowerCase()===name.toLowerCase());
  if(acc && acc.archived) delete acc.archived; // la persona torna se la si usa di nuovo
  if(!acc){
    acc={id:uid(),name:`${kind==="pay"?"Da pagare":"Da ricevere"} · ${name}`,balance:0,color:kind==="pay"?"#C9785C":"#8E7CC3",person:name};
    acc[flag]=true;
    state.accounts.push(acc);
  }
  return acc;
}
/* v1.47.0 — una spesa può essere divisa con più persone: un gruppo ha la mia riga di spesa
   (main) e una riga "da ricevere" per ogni persona (shares). */
function groupParts(gid){ const parts=state.transactions.filter(x=>x.splitGroup===gid); const shares=parts.filter(x=>x.splitShare); return {id:gid,main:parts.find(x=>x.type==="expense")||null,shares,share:shares[0]||null}; }
function groupTotal(g){ return round2(Number(g?.main?.amount||0)+(g?.shares||[]).reduce((n,x)=>n+Number(x.amount||0),0)); }
function splitPartner(t){ return t?.splitGroup ? state.transactions.find(x=>x.splitGroup===t.splitGroup && x.id!==t.id) : null; }
function sharePersonOf(t){
  if(!t?.splitGroup) return "";
  return state.transactions.filter(x=>x.splitGroup===t.splitGroup&&x.splitShare).map(x=>loanAccount(x.toAccountId)?.person).filter(Boolean).join(", ");
}
/* Quota mia in percentuale per una divisione salvata su ricorrente / pianificata. */
function splitMyPct(sp){ const n=(sp?.persons||[]).length; if(!n) return 100; return sp.mode==="all"?0:sp.mode==="pct"?Number(sp.pct)||50:100/(n+1); }
/* Crea il movimento di una ricorrente / pianificata: se è divisa, crea anche le quote "da ricevere". */
/* v1.49.0 — Ricorrenti e pianificate divise: nei totali e nelle previsioni conta solo la mia parte. */
function myAmount(item){
  const ps=item?.split?.persons||[];
  if(item?.type!=="expense" || !ps.length) return Number(item?.amount)||0;
  return round2((Number(item.amount)||0)*splitMyPct(item.split)/100);
}
function splitLabel(item){
  const ps=item?.split?.persons||[]; if(!ps.length || item.type!=="expense") return "";
  return `<span class="mv-sep" aria-hidden="true">·</span><span class="mv-shared">divisa con ${escapeHtml(ps.join(", "))}</span>`;
}
function pushScheduledTx(item, base){
  const sp=item?.split;
  if(base.type!=="expense" || !sp || !(sp.persons||[]).length){ state.transactions.push(base); return base; }
  const first=saveSharedGroup({group:null,total:base.amount,shared:{on:true,persons:sp.persons,pct:splitMyPct(sp)},fields:{date:base.date,name:base.name||"",categoryId:base.categoryId,accountId:base.accountId,note:base.note||""}});
  const g=groupParts(first.splitGroup), primary=g.main||g.shares[0];
  ["recurringId","plannedId","earlyFor","plannedSnapshot"].forEach(k=>{ if(base[k]!==undefined) primary[k]=base[k]; });
  primary.id=base.id||primary.id;
  g.shares.forEach(x=>{ if(x!==primary) x.fromSched=true; });
  return primary;
}
/* Quote nate da una ricorrente / pianificata rimaste senza la loro spesa (annullata o rigenerata). */
function pruneSplitOrphans(){
  const groups=new Set(state.transactions.filter(t=>!t.fromSched&&t.splitGroup).map(t=>t.splitGroup));
  const before=state.transactions.length;
  state.transactions=state.transactions.filter(t=>!(t.fromSched&&t.splitShare&&!groups.has(t.splitGroup)));
  return before!==state.transactions.length;
}
/* Titolo e descrizione delle righe che toccano un conto prestito. */
function linkedTx(t){
  return state.transactions.filter(x=>x.id!==t.id&&((t.splitGroup&&x.splitGroup===t.splitGroup)||(t.settleGroup&&x.settleGroup===t.settleGroup)));
}
function loanRowInfo(t){
  if(t.loanOffset){
    const a=loanAccount(t.accountId); if(!a) return null;
    return {title:`Compensazione con ${a.person}`,label:a.receivable?"Credito compensato":"Debito compensato",meta:"crediti e debiti si annullano",emoji:"⚖️",color:"#7BAE9D"};
  }
  if(t.loanWriteOff){
    const a=loanAccount(t.accountId); if(!a) return null;
    return a.receivable
      ? {title:`Abbuono a ${a.person}`,label:"Rimborso chiuso",meta:"differenza non restituita",emoji:"✅",color:"#3AA684"}
      : {title:`Abbuono da ${a.person}`,label:"Debito chiuso",meta:"differenza non pagata",emoji:"✅",color:"#3AA684"};
  }
  if(t.loanOld){
    const a=loanAccount(t.accountId); if(!a) return null;
    return a.receivable
      ? {title:`Prestito a ${a.person}`,label:"Prestito vecchio",meta:t.note||"fuori saldo",emoji:"🤝",color:"#8E7CC3"}
      : {title:`Debito con ${a.person}`,label:"Debito vecchio",meta:t.note||"fuori saldo",emoji:"🏦",color:"#C9785C"};
  }
  if(t.type!=="transfer") return null;
  const from=loanAccount(t.accountId), to=loanAccount(t.toAccountId);
  const accName=id=>state.accounts.find(a=>a.id===id)?.name||"conto";
  if(to?.receivable){
    const quota=t.splitShare && state.transactions.some(x=>x.splitGroup===t.splitGroup && x.type==="expense");
    return {title:`${quota?"Quota di":"Prestito a"} ${to.person}`,label:"Da ricevere",meta:t.note||accName(t.accountId),emoji:"🤝",color:"#8E7CC3"};
  }
  if(from?.receivable) return {title:`${from.person} ti ha restituito`,label:t.rateInfo?"Rata":"Restituzione",meta:t.rateInfo?`${rateInfoLabel(t.rateInfo)} · su ${accName(t.toAccountId)}`:`su ${accName(t.toAccountId)}`,emoji:"↩️",color:"#3AA684"};
  if(from?.payable) return {title:`Prestito da ${from.person}`,label:"Da pagare",meta:t.note||`su ${accName(t.toAccountId)}`,emoji:"🏦",color:"#C9785C"};
  if(to?.payable) return {title:`Restituito a ${to.person}`,label:"Rata / restituzione",meta:t.rateInfo?`${rateInfoLabel(t.rateInfo)} · da ${accName(t.accountId)}`:(t.note||`da ${accName(t.accountId)}`),emoji:"💸",color:"#C9785C"};
  return null;
}
function mountSharedExpense(node, afterRow, {type, amount, group, split}){
  /* v1.47.0 — più persone: tocca i nomi per aggiungerli o toglierli. "Parti uguali" divide il totale
     fra te e loro; "Percentuale" fissa la tua quota e il resto si divide fra loro; "Tutto loro" è un prestito. */
  let on=false, persons=[], mode="half", pctVal=50;
  if(group?.shares?.length){
    on=true; persons=group.shares.map(x=>loanAccount(x.toAccountId)?.person).filter(Boolean);
    const total=groupTotal(group), n=persons.length;
    if(!group.main) mode="all";
    else { const myP=Number(group.main.amount)/total*100; if(Math.abs(Number(group.main.amount)-total/(n+1))<0.02) mode="half"; else { mode="pct"; pctVal=Math.round(myP); } }
  } else if(split?.persons?.length){
    on=true; persons=split.persons.slice(); mode=split.mode==="all"?"all":split.mode==="pct"?"pct":"half"; pctVal=Number(split.pct)||50;
  } else {
    const last=(state.lastSharePersons&&state.lastSharePersons.length)?state.lastSharePersons:[state.lastSharePerson||receivableAccounts()[0]?.person||""];
    persons=last.filter(Boolean).slice(0,1);
  }
  const row=document.createElement("div");
  row.className="field-row shared-field";
  row.innerHTML=`<button type="button" class="shared-switch" aria-pressed="false"><span class="shared-knob" aria-hidden="true"></span><span class="shared-switch-text"><strong>Spesa divisa o prestito</strong><small>Pago io: una parte o tutto me lo devono, anche più persone</small></span></button>
    <div class="shared-box" hidden>
      <label>Con chi la dividi <small class="shared-count"></small></label>
      <div class="chip-row shared-people"></div>
      <div class="shared-add"><input type="text" class="text-input shared-new" maxlength="30" placeholder="Aggiungi persona, es. Ilaria" autocomplete="off" enterkeyhint="done"><button type="button" class="pill-btn mini-btn shared-add-btn" aria-label="Aggiungi persona">+</button></div>
      <label class="shared-lbl">Quanto è tuo</label>
      <div class="type-toggle three shared-mode"><button type="button" class="type-opt" data-m="half">Metà</button><button type="button" class="type-opt" data-m="pct">Percentuale</button><button type="button" class="type-opt" data-m="all">Tutto suo</button></div>
      <div class="split-custom" hidden><span class="sc-me"></span><input type="range" min="5" max="95" step="5" aria-label="La tua quota in percentuale"><span class="sc-other"></span></div>
      <p class="field-hint shared-hint"></p>
    </div>`;
  afterRow.after(row);
  const sw=row.querySelector(".shared-switch"), box=row.querySelector(".shared-box"), people=row.querySelector(".shared-people"), newInput=row.querySelector(".shared-new");
  const range=row.querySelector("input[type=range]"), custom=row.querySelector(".split-custom"), hint=row.querySelector(".shared-hint");
  range.value=String(Math.min(95,Math.max(5,pctVal)));
  const has=n=>persons.some(x=>x.toLowerCase()===String(n).toLowerCase());
  const sharePct=()=>{ const n=Math.max(1,persons.length); return mode==="all"?0:mode==="pct"?Number(range.value):100/(n+1); };
  const addPending=()=>{ const v=newInput.value.trim(); if(v && !has(v)) persons.push(v.slice(0,30)); newInput.value=""; };
  function refresh(){
    row.hidden=type()!=="expense";
    sw.classList.toggle("on",on); sw.setAttribute("aria-pressed",String(on)); box.hidden=!on;
    if(!on) return;
    const names=[...new Set(receivableAccounts().map(a=>a.person).filter(Boolean))];
    persons.forEach(p=>{ if(!names.some(n=>n.toLowerCase()===p.toLowerCase())) names.push(p); });
    people.innerHTML=names.map(n=>`<button type="button" class="chip${has(n)?" active":""}" data-person="${escapeHtml(n)}">${has(n)?"✓ ":""}${escapeHtml(n)}</button>`).join("");
    people.querySelectorAll("[data-person]").forEach(b=>b.addEventListener("click",e=>{ e.stopPropagation(); const n=b.dataset.person; persons=has(n)?persons.filter(x=>x.toLowerCase()!==n.toLowerCase()):[...persons,n]; refresh(); }));
    const n=persons.length, many=n>1;
    row.querySelector(".shared-count").textContent=n?`· ${n+1} persone con te`:"";
    const who=n?persons.join(", "):"l'altra persona";
    row.querySelectorAll(".shared-mode .type-opt").forEach(b=>{ b.classList.toggle("active",b.dataset.m===mode);
      if(b.dataset.m==="half") b.textContent=many?"Parti uguali":"Metà";
      if(b.dataset.m==="all") b.textContent=n===1?`Tutto a ${persons[0]}`:many?"Tutto loro":"Tutto suo"; });
    custom.hidden=mode!=="pct";
    const p=sharePct();
    row.querySelector(".sc-me").textContent=`Tu ${Math.round(p)}%`;
    row.querySelector(".sc-other").textContent=`${100-Math.round(p)}% ${many?"loro":who}`;
    const amt=amount();
    if(!n) hint.textContent="Tocca un nome o scrivine uno nuovo.";
    else if(!(amt>0)) hint.textContent="Inserisci l'importo totale che hai pagato.";
    else {
      const mine=round2(amt*p/100), parts=splitParts(round2(amt-mine),n);
      const each=persons.map((x,i)=>`${x} ${fmt(parts[i])}`).join(" · ");
      hint.textContent=mode==="all"?`Prestito, non è tua spesa: da ricevere ${each}.`:`Spesa tua: ${fmt(mine)} · da ricevere: ${each}`;
    }
  }
  sw.addEventListener("click",e=>{ e.stopPropagation(); on=!on; refresh(); if(on&&!persons.length) newInput.focus(); });
  newInput.addEventListener("keydown",e=>{ if(e.key==="Enter"){ e.preventDefault(); addPending(); refresh(); } });
  newInput.addEventListener("change",()=>{ addPending(); refresh(); });
  row.querySelector(".shared-add-btn").addEventListener("click",e=>{ e.stopPropagation(); addPending(); refresh(); });
  row.querySelectorAll(".shared-mode .type-opt").forEach(b=>b.addEventListener("click",e=>{e.stopPropagation();mode=b.dataset.m;refresh();}));
  range.addEventListener("input",refresh);
  node.addEventListener("input",e=>{ if(!row.contains(e.target)) refresh(); });
  node.addEventListener("click",e=>{ if(!row.contains(e.target)) setTimeout(refresh,0); });
  refresh();
  const get=()=>{ addPending(); const list=persons.map(x=>x.trim()).filter(Boolean); return {on:on&&type()==="expense"&&list.length>0,want:on&&type()==="expense",persons:list,person:list[0]||"",pct:sharePct(),mode:mode==="half"?"equal":mode}; };
  return {get,refresh,setOff:()=>{ if(on){ on=false; refresh(); } }};
}
/* Divide un importo in n parti al centesimo (i centesimi avanzati vanno ai primi). */
function splitParts(total,n){
  if(!(n>0)) return [];
  const cents=Math.round(total*100), base=Math.floor(cents/n), extra=cents-base*n;
  return Array.from({length:n},(_,i)=>(base+(i<extra?1:0))/100);
}
/* v1.25.0 — Spesa pagata da un'altra persona: non esce dai miei conti, la mia parte diventa un debito
   verso di lei ("Da pagare · Nome"). Conta come mia spesa (con la categoria) e pesa solo sul
   "Totale effettivo con crediti e debiti", non sul totale dei conti. */
function mountOtherPaid(node, afterRow, {type, amount, existing, preset, onChange}){
  const op=existing?.otherPaid||null;
  let on=!!op||!!preset?.otherPaid;
  let person=op?.person||preset?.person||state.lastOtherPayer||payableAccounts()[0]?.person||"";
  let mode=op?(op.pct===100?"all":op.pct===50?"half":"pct"):"all", pctVal=op?.pct||50;
  const row=document.createElement("div");
  row.className="field-row shared-field other-paid-field";
  row.innerHTML=`<button type="button" class="shared-switch" aria-pressed="false"><span class="shared-knob" aria-hidden="true"></span><span class="shared-switch-text"><strong>Pagata da un'altra persona</strong><small>Non esce dai tuoi conti: la tua parte la devi a lui/lei</small></span></button>
    <div class="shared-box" hidden>
      <label>Chi ha pagato</label>
      <div class="chip-row other-people"></div>
      <input type="text" class="text-input other-new" maxlength="30" placeholder="Nuova persona, es. Marco" autocomplete="off">
      <label class="shared-lbl">Quanto è tuo</label>
      <div class="type-toggle three other-mode"><button type="button" class="type-opt" data-m="all">Tutto mio</button><button type="button" class="type-opt" data-m="half">Metà</button><button type="button" class="type-opt" data-m="pct">Percentuale</button></div>
      <div class="split-custom" hidden><span class="sc-me"></span><input type="range" min="5" max="95" step="5" aria-label="La tua quota in percentuale"><span class="sc-other"></span></div>
      <p class="field-hint other-hint"></p>
    </div>`;
  afterRow.after(row);
  const sw=row.querySelector(".shared-switch"), box=row.querySelector(".shared-box"), people=row.querySelector(".other-people"), newInput=row.querySelector(".other-new");
  const range=row.querySelector("input[type=range]"), custom=row.querySelector(".split-custom"), hint=row.querySelector(".other-hint");
  range.value=String(Math.min(95,Math.max(5,pctVal)));
  const myPct=()=>mode==="all"?100:mode==="half"?50:Number(range.value);
  const info=()=>({on:on&&type()==="expense",person:String(person||"").trim(),pct:myPct()});
  function refresh(silent){
    row.hidden=type()!=="expense";
    sw.classList.toggle("on",on); sw.setAttribute("aria-pressed",String(on)); box.hidden=!on;
    if(on){
      const names=[...new Set([...payableAccounts(),...receivableAccounts()].map(a=>a.person).filter(Boolean))];
      if(person && !names.some(n=>n.toLowerCase()===person.toLowerCase())) names.push(person);
      people.innerHTML=names.map(n=>`<button type="button" class="chip${n.toLowerCase()===String(person).toLowerCase()?" active":""}" data-person="${escapeHtml(n)}">${escapeHtml(n)}</button>`).join("");
      people.querySelectorAll("[data-person]").forEach(b=>b.addEventListener("click",e=>{e.stopPropagation();person=b.dataset.person;newInput.value="";refresh();}));
      row.querySelectorAll(".other-mode .type-opt").forEach(b=>b.classList.toggle("active",b.dataset.m===mode));
      custom.hidden=mode!=="pct";
      const p=myPct(), other=person||"l'altra persona";
      row.querySelector(".sc-me").textContent=`Tu ${p}%`; row.querySelector(".sc-other").textContent=`${100-p}% ${other}`;
      const amt=amount();
      if(!(amt>0)) hint.textContent=`Inserisci l'importo totale pagato da ${other}.`;
      else { const mine=Math.round(amt*p)/100; hint.textContent=`Tua spesa: ${fmt(mine)} · la devi a ${other} (da pagare). I tuoi conti non cambiano.`; }
    }
    if(!silent) onChange&&onChange(info());
  }
  sw.addEventListener("click",e=>{ e.stopPropagation(); on=!on; refresh(); if(on&&!person) newInput.focus(); });
  newInput.addEventListener("input",()=>{ const v=newInput.value.trim(); if(v) person=v; refresh(); newInput.focus(); });
  row.querySelectorAll(".other-mode .type-opt").forEach(b=>b.addEventListener("click",e=>{e.stopPropagation();mode=b.dataset.m;refresh();}));
  range.addEventListener("input",()=>refresh());
  node.addEventListener("input",e=>{ if(!row.contains(e.target)) refresh(true); });
  node.addEventListener("click",e=>{ if(!row.contains(e.target)) setTimeout(()=>refresh(true),0); });
  refresh();
  return {get:info,refresh,setOff:()=>{ if(on){ on=false; refresh(); } }};
}
/* Salva una spesa divisa / prestito: crea o aggiorna la riga di spesa (mia quota) e una riga
   "da ricevere" per ogni persona. */
function saveSharedGroup({group,total,shared,fields}){
  const gid=group?.id||uid();
  let main=group?.main||null;
  const shares=(group?.shares||[]).slice();
  const drop=x=>{ if(x) state.transactions=state.transactions.filter(y=>y.id!==x.id); };
  const persons=(shared.persons&&shared.persons.length?shared.persons:[shared.person]).map(x=>String(x||"").trim()).filter(Boolean);
  if(!shared.on || !persons.length){
    if(!main){ main={id:uid()}; state.transactions.push(main); }
    Object.assign(main,{...fields,type:"expense",amount:total,toAccountId:null}); delete main.splitGroup;
    shares.forEach(drop); return main;
  }
  const mine=round2(total*shared.pct/100), parts=splitParts(round2(total-mine),persons.length);
  if(mine>0){ if(!main){ main={id:uid()}; state.transactions.push(main); } Object.assign(main,{...fields,type:"expense",amount:mine,toAccountId:null,splitGroup:gid}); }
  else { drop(main); main=null; }
  const keep=new Set(); let first=null;
  persons.forEach((name,i)=>{
    const acc=ensureLoanAccount(name,"recv");
    let sh=shares.find(x=>x.toAccountId===acc.id&&!keep.has(x.id));
    if(!sh){ sh={id:uid()}; state.transactions.push(sh); }
    keep.add(sh.id); if(!first) first=sh;
    Object.assign(sh,{date:fields.date,amount:parts[i],type:"transfer",name:`${mine>0?"Quota di":"Prestito a"} ${acc.person}`,categoryId:null,loanCategoryId:fields.categoryId||null,accountId:fields.accountId,toAccountId:acc.id,note:fields.name||"",splitGroup:gid,splitShare:true,loanKind:"lend"});
  });
  shares.filter(x=>!keep.has(x.id)).forEach(drop);
  state.lastSharePerson=persons[0]; state.lastSharePersons=persons.slice(0,6);
  return main||first;
}
/* ---------------- v1.13.0 — Rimborsi a rate e rimborso che chiude il prestito ----------------
   state.loanRates: rate ancora da ricevere/pagare, una riga per rata: {id,accId,date,amount,n,of}.
   - Le rate non toccano il saldo: si confermano con "Ricevuta"/"Pagata", che apre la restituzione già compilata.
   - Ogni restituzione registrata scala le rate in ordine di data (una rata pagata in parte resta con il residuo).
   - Quando il prestito arriva a zero (anche con un abbuono) le rate rimaste spariscono da sole.
   Abbuono: rimborso parziale che vale come totale. È una riga sul conto prestito (loanWriteOff) che
   azzera il residuo; non tocca i conti veri e non conta in Entrate/Uscite. */
const round2=v=>Math.round((Number(v)||0)*100)/100;
function isoAddDays(iso,days){ const d=new Date(iso+"T00:00:00"); d.setDate(d.getDate()+days); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
function isoAddMonths(iso,months){
  const d=new Date(iso+"T00:00:00"), day=d.getDate();
  const t=new Date(d.getFullYear(),d.getMonth()+months,1);
  const last=new Date(t.getFullYear(),t.getMonth()+1,0).getDate();
  t.setDate(Math.min(day,last));
  return `${t.getFullYear()}-${pad2(t.getMonth()+1)}-${pad2(t.getDate())}`;
}
function shortDate(iso){ const [y,m,d]=iso.split("-"); return `${d}/${m}${y!==String(new Date().getFullYear())?"/"+y.slice(2):""}`; }
function daysFromToday(iso){ return Math.round((new Date(iso+"T00:00:00")-new Date(todayISO()+"T00:00:00"))/86400000); }
function rateWhen(iso){
  const n=daysFromToday(iso);
  if(n<0) return {text:`in ritardo di ${-n} ${-n===1?"giorno":"giorni"}`,late:true};
  if(n===0) return {text:"oggi",today:true};
  if(n===1) return {text:"domani"};
  if(n<=30) return {text:`fra ${n} giorni`};
  return {text:shortDate(iso)};
}
function loanOwed(acc){ if(!acc) return 0; const b=accountBalance(acc.id); return acc.receivable?b:-b; }
function ratesOf(accId){ return (state.loanRates||[]).filter(r=>r.accId===accId).sort((a,b)=>a.date.localeCompare(b.date)||(a.n||0)-(b.n||0)); }
function allPendingRates(){ return (state.loanRates||[]).filter(r=>loanAccount(r.accId)).sort((a,b)=>a.date.localeCompare(b.date)); }
/* Scala un pagamento dalle rate: prima quella scelta, poi in ordine di data. */
function allocateToRates(accId,amount,firstRateId){
  let rest=round2(amount); const covered=[];
  const list=ratesOf(accId);
  if(firstRateId){ const i=list.findIndex(r=>r.id===firstRateId); if(i>0) list.unshift(list.splice(i,1)[0]); }
  for(const r of list){
    if(rest<=0.004) break;
    if(rest>=r.amount-0.004){ covered.push({n:r.n||1,of:r.of||0,date:r.date,full:true}); rest=round2(rest-r.amount); state.loanRates=state.loanRates.filter(x=>x.id!==r.id); }
    else { covered.push({n:r.n||1,of:r.of||0,date:r.date,full:false}); r.amount=round2(r.amount-rest); rest=0; }
  }
  return covered;
}
function rateInfoLabel(info){
  if(!Array.isArray(info)||!info.length) return "";
  const lab=x=>`${x.full?"":"parte della "}rata ${x.n}${x.of?` di ${x.of}`:""}`;
  const t=info.map(lab).join(" + ");
  return t.charAt(0).toUpperCase()+t.slice(1);
}
/* Rate di prestiti chiusi o eliminati: si tolgono da sole. */
function pruneLoanRates(){
  if(!Array.isArray(state.loanRates)) state.loanRates=[];
  state.loanRates=state.loanRates.filter(r=>{ const a=loanAccount(r.accId); return a && loanOwed(a)>0.004 && r.amount>0.004; });
}
function rateRowEl(r,{showPerson=false,onPay}={}){
  const a=loanAccount(r.accId), w=rateWhen(r.date), recv=!!a?.receivable;
  const row=document.createElement("div");
  row.className="loan-rate-row"+(w.late?" late":"")+(w.today?" today":"");
  row.innerHTML=`<span class="loan-rate-dot" aria-hidden="true">${recv?"↩️":"💸"}</span>
    <span class="loan-rate-text"><strong>${showPerson?`${escapeHtml(a?.person||"")} · `:""}Rata ${r.n||1}${r.of?` di ${r.of}`:""}</strong><span>${escapeHtml(shortDate(r.date))} · ${escapeHtml(w.text)}</span></span>
    <span class="loan-rate-amt">${balancesHidden?"••••":fmt(r.amount)}</span>
    <button type="button" class="loan-rate-pay">${recv?"Ricevuta":"Pagata"}</button>`;
  row.querySelector(".loan-rate-pay").addEventListener("click",e=>{ e.stopPropagation(); onPay?onPay(r):payRate(r); });
  return row;
}
function payRate(r){
  const a=loanAccount(r.accId); if(!a) return;
  openLoanForm(null,{mode:a.receivable?"repayIn":"repayOut",person:a.person,rateId:r.id,amount:r.amount});
}
/* Editor delle rate: numero, frequenza, date e importi; l'ultima rata assorbe le differenze. */
function mountRatesEditor(box,{total,existing=null,kind="recv"}){
  let n=existing?.length||2, freq=existing?.length?"free":"monthly";
  let rows=existing?.length?existing.map(r=>({date:r.date,amount:r.amount})):[];
  let first=rows[0]?.date||isoAddDays(todayISO(),1);
  let touched=new Set();
  box.innerHTML=`<div class="rate-head">
      <div><label>Numero di rate</label><div class="rate-count"><button type="button" data-d="-1" aria-label="Una rata in meno">−</button><strong class="rate-n-val">2</strong><button type="button" data-d="1" aria-label="Una rata in più">+</button></div></div>
    </div>
    <div class="type-toggle three rate-freq"><button type="button" class="type-opt" data-f="weekly">Ogni settimana</button><button type="button" class="type-opt" data-f="monthly">Ogni mese</button><button type="button" class="type-opt" data-f="free">Date libere</button></div>
    <div class="rate-rows"></div>
    <p class="field-hint rate-sum"></p>`;
  const rowsBox=box.querySelector(".rate-rows"), sumEl=box.querySelector(".rate-sum");
  function regenDates(){
    if(freq==="free"){ while(rows.length<n) rows.push({date:isoAddMonths(rows[rows.length-1]?.date||first,rows.length?1:0),amount:0}); rows.length=n; return; }
    rows=Array.from({length:n},(_,i)=>({date:freq==="weekly"?isoAddDays(first,7*i):isoAddMonths(first,i),amount:rows[i]?.amount||0}));
  }
  function rebalance(){
    const tot=round2(total());
    if(!touched.size){ const base=Math.floor(tot/n*100)/100; rows.forEach((r,i)=>r.amount=i<n-1?base:round2(tot-base*(n-1))); return; }
    const lastFree=[...rows.keys()].reverse().find(i=>!touched.has(i));
    if(lastFree==null) return;
    const others=rows.reduce((s,r,i)=>i===lastFree?s:s+r.amount,0);
    rows[lastFree].amount=Math.max(0,round2(tot-others));
  }
  function paintSum(){
    const tot=round2(total()), sum=round2(rows.reduce((s,r)=>s+r.amount,0));
    sumEl.classList.toggle("warn",Math.abs(sum-tot)>0.004);
    sumEl.textContent=!(tot>0)?"Inserisci l'importo.":Math.abs(sum-tot)<=0.004?`${n} rate da ${kind==="recv"?"ricevere":"pagare"} · totale ${fmt(sum)} ✓`:sum<tot?`Le rate coprono ${fmt(sum)}: mancano ${fmt(round2(tot-sum))}.`:`Le rate superano l'importo di ${fmt(round2(sum-tot))}.`;
  }
  function paint(){
    box.querySelector(".rate-n-val").textContent=String(n);
    box.querySelectorAll(".rate-freq .type-opt").forEach(b=>b.classList.toggle("active",b.dataset.f===freq));
    rowsBox.innerHTML="";
    rows.forEach((r,i)=>{
      const el=document.createElement("div"); el.className="rate-row";
      el.innerHTML=`<span class="rate-idx">${i+1}ª</span><input type="date" class="text-input" value="${r.date}" aria-label="Data rata ${i+1}"><span class="rate-cur">€</span><input type="text" inputmode="decimal" class="text-input rate-amt" value="${String(r.amount.toFixed(2)).replace(".",",")}" aria-label="Importo rata ${i+1}">`;
      const [d,a]=el.querySelectorAll("input");
      d.addEventListener("change",()=>{ if(!d.value) return; r.date=d.value; if(i===0&&freq!=="free"){ first=d.value; regenDates(); } else if(i>0) freq="free"; paint(); });
      a.addEventListener("change",()=>{ r.amount=Math.max(0,round2(parseAmount(a.value))); touched.add(i); if(touched.size>=n) touched.delete(n-1===i?n-2:n-1); rebalance(); paint(); });
      rowsBox.appendChild(el);
    });
    paintSum();
  }
  box.querySelectorAll(".rate-count [data-d]").forEach(b=>b.addEventListener("click",()=>{ n=Math.max(1,Math.min(36,n+Number(b.dataset.d))); touched=new Set([...touched].filter(i=>i<n-1)); regenDates(); rebalance(); paint(); }));
  box.querySelectorAll(".rate-freq .type-opt").forEach(b=>b.addEventListener("click",()=>{ freq=b.dataset.f; if(freq!=="free"){ first=rows[0]?.date||first; regenDates(); } paint(); }));
  if(!rows.length) regenDates();
  if(!existing?.length) rebalance();
  paint();
  return {
    refresh(){ rebalance(); paint(); },
    get(){ return rows.map((r,i)=>({date:r.date,amount:round2(r.amount),n:i+1,of:rows.length})); },
    check(){ const tot=round2(total()), sum=round2(rows.reduce((s,r)=>s+r.amount,0)); if(rows.some(r=>!r.date||!(r.amount>0))) return "Ogni rata deve avere data e importo"; if(Math.abs(sum-tot)>0.004) return "Il totale delle rate deve essere uguale all'importo"; return ""; }
  };
}
function saveRatesFor(accId,list,{replace=false}={}){
  if(!Array.isArray(state.loanRates)) state.loanRates=[];
  if(replace) state.loanRates=state.loanRates.filter(r=>r.accId!==accId);
  list.forEach(r=>state.loanRates.push({id:uid(),accId,date:r.date,amount:r.amount,n:r.n,of:r.of}));
}
function openLoanPlan(accId){
  const a=loanAccount(accId); if(!a) return;
  openSheet("tpl-loan-plan",(node,close)=>{
    const owed=round2(loanOwed(a)), existing=ratesOf(accId);
    node.querySelector("#loanPlanTitle").textContent=`📅 Rate · ${a.person}`;
    node.querySelector("#loanPlanIntro").textContent=owed>0
      ?`${a.receivable?`${a.person} ti deve`:`Devi a ${a.person}`} ${fmt(owed)}. Dividi il residuo in rate: le confermi tu quando arrivano, e il saldo si aggiorna da solo.`
      :"Il prestito è già chiuso: non ci sono rate da pianificare.";
    const ed=mountRatesEditor(node.querySelector("#loanPlanBox"),{total:()=>owed,existing,kind:a.receivable?"recv":"pay"});
    const del=node.querySelector("#deleteLoanPlanBtn");
    del.hidden=!existing.length;
    del.addEventListener("click",()=>{ state.loanRates=state.loanRates.filter(r=>r.accId!==accId); persist(); renderAll(); close(); showToast("Rate tolte"); });
    node.querySelector("#saveLoanPlanBtn").addEventListener("click",()=>{
      if(!(owed>0)){ close(); return; }
      const err=ed.check(); if(err){ showToast(err); return; }
      saveRatesFor(accId,ed.get(),{replace:true}); persist(); renderAll(); close(); showToast("Rate salvate");
    });
  });
}
/* v1.14.0 — Pallino sulla scheda Conti quando una rata è in ritardo da più di 3 giorni. */
function renderLateRatesBadge(){
  const tab=document.querySelector('.tabbar .tab[data-view="accounts"]'); if(!tab) return;
  const late=allPendingRates().filter(r=>daysFromToday(r.date)< -3).length;
  let dot=tab.querySelector(".tab-late-badge");
  if(!late){ dot?.remove(); tab.removeAttribute("data-late"); return; }
  if(!dot){ dot=document.createElement("span"); dot.className="tab-late-badge"; tab.appendChild(dot); }
  dot.textContent=String(late); tab.setAttribute("data-late",String(late));
  dot.setAttribute("aria-label",`${late} ${late===1?"rata in ritardo":"rate in ritardo"}`);
}
function renderLoanUpcoming(){
  const wrap=document.getElementById("loanUpcomingWrap"), box=document.getElementById("loanUpcomingList");
  if(!wrap||!box) return;
  const list=allPendingRates().slice(0,6);
  wrap.hidden=!list.length; box.innerHTML="";
  list.forEach(r=>{ const row=rateRowEl(r,{showPerson:true}); row.addEventListener("click",()=>openLoanPerson(r.accId)); box.appendChild(row); });
}
function renderHomeLoanRates(){
  const box=document.getElementById("upcomingHomeList"); if(!box) return;
  const limit=isoAddDays(todayISO(),30);
  const list=allPendingRates().filter(r=>r.date<=limit).slice(0,3);
  list.forEach(r=>{ const row=rateRowEl(r,{showPerson:true}); row.classList.add("home-rate"); row.addEventListener("click",()=>{ switchView("accounts"); setAccountsMode("loans"); openLoanPerson(r.accId); }); box.appendChild(row); });
  const empty=document.getElementById("upcomingHomeEmpty"); if(empty&&list.length) empty.hidden=true;
}

const LOAN_MODES={
  lend:{title:"Ho prestato",kind:"recv",person:"A chi hai prestato",account:"Dal conto"},
  repayIn:{title:"Mi hanno restituito",kind:"recv",person:"Chi ti ha restituito",account:"Sul conto"},
  borrow:{title:"Ho ricevuto un prestito",kind:"pay",person:"Da chi (persona, banca o finanziaria)",account:"Sul conto"},
  repayOut:{title:"Ho restituito / rata",kind:"pay",person:"A chi",account:"Dal conto"},
};
function loanModeOf(t){
  if(t.loanOld) return t.loanKind==="borrow"?"borrow":"lend";
  const from=loanAccount(t.accountId), to=loanAccount(t.toAccountId);
  return to?.receivable?"lend":from?.receivable?"repayIn":from?.payable?"borrow":to?.payable?"repayOut":null;
}
function openLoanForm(txId=null,preset={}){
  const existing=txId?state.transactions.find(t=>t.id===txId):null;
  if(existing?.splitGroup) return openAddTransaction(existing.id);
  let mode=existing?loanModeOf(existing):(preset.mode||"lend");
  let old=!!existing?.loanOld;
  let person=existing?(loanAccount(existing.accountId)||loanAccount(existing.toAccountId))?.person:(preset.person||"");
  let accId=existing?(loanAccount(existing.accountId)?existing.toAccountId:existing.accountId):(state.accounts.find(a=>a.id===state.mainAccountId&&!isLoanAccount(a))?.id||state.accounts.find(a=>!isLoanAccount(a))?.id||null);
  // v1.13.0: rimborso che vale come totale (abbuono) e piano a rate.
  const existingWO=existing?.settleGroup?state.transactions.find(x=>x.settleGroup===existing.settleGroup&&x.loanWriteOff):null;
  let closeOn=!!existingWO, ratesOn=false, ratesEd=null;
  const presetRate=preset.rateId?(state.loanRates||[]).find(r=>r.id===preset.rateId):null;
  openSheet("tpl-loan",(node,close)=>{
    const amountInput=node.querySelector("#loanAmountInput"), dateInput=node.querySelector("#loanDateInput"), noteInput=node.querySelector("#loanNoteInput");
    const peopleBox=node.querySelector("#loanPeople"), newPerson=node.querySelector("#loanNewPerson"), accBox=node.querySelector("#loanAccounts"), hint=node.querySelector("#loanHint");
    dateInput.value=existing?.date||todayISO(); dateInput.max=todayISO();
    if(existing){ amountInput.value=String(existing.amount).replace(".",","); noteInput.value=existing.note||""; }
    let amountTouched=!!existing;
    amountInput.addEventListener("input",()=>{ amountTouched=true; paint(); });
    autoGrowAmountInput(amountInput);
    function owedBy(p,kind){ const a=(kind==="pay"?payableAccounts():receivableAccounts()).find(x=>x.person.toLowerCase()===String(p).toLowerCase()); if(!a) return 0; const b=accountBalance(a.id); return kind==="pay"?-b:b; }
    // Quanto era dovuto prima di questo movimento (in modifica tolgo il movimento stesso e il suo abbuono).
    function owedBefore(p,kind){
      let o=owedBy(p,kind);
      if(existing&&(mode==="repayIn"||mode==="repayOut")&&!existing.loanOld){ const a=loanAccount(existing.accountId)||loanAccount(existing.toAccountId); if(a&&a.person.toLowerCase()===String(p).toLowerCase()) o+=Number(existing.amount||0)+Number(existingWO?.amount||0); }
      return round2(o);
    }
    const closeSw=node.querySelector("#loanCloseSwitch"), ratesSw=node.querySelector("#loanRatesSwitch"), ratesBox=node.querySelector("#loanRatesBox");
    closeSw.addEventListener("click",()=>{ closeOn=!closeOn; paint(); });
    // v1.26.0: cifra inferiore al dovuto → scegli se il resto resta aperto o è abbuonato
    node.querySelectorAll("#loanRest [data-r]").forEach(b=>b.addEventListener("click",()=>{ closeOn=b.dataset.r==="close"; paint(); }));
    ratesSw.addEventListener("click",()=>{ ratesOn=!ratesOn; if(ratesOn&&!ratesEd) ratesEd=mountRatesEditor(ratesBox,{total:()=>parseAmount(amountInput.value),kind:LOAN_MODES[mode].kind}); paint(); });
    amountInput.addEventListener("change",()=>{ if(ratesEd) ratesEd.refresh(); });
    function paint(){
      const m=LOAN_MODES[mode];
      node.querySelector("#loanTitle").textContent=m.kind==="pay"?"Debito":"Prestito";
      node.querySelectorAll("#loanModes [data-mode]").forEach(b=>{ b.classList.toggle("active",b.dataset.mode===mode); b.disabled=!!existing&&b.dataset.mode!==mode&&LOAN_MODES[b.dataset.mode].kind!==m.kind; });
      node.querySelector("#loanPersonLabel").textContent=m.person;
      node.querySelector("#loanAccountLabel").textContent=m.account;
      // Prestito vecchio: solo per "Ho prestato" e "Ho ricevuto un prestito"; niente conto.
      const oldSw=node.querySelector("#loanOldSwitch"), canOld=mode==="lend"||mode==="borrow";
      if(!canOld) old=false;
      oldSw.hidden=!canOld; oldSw.classList.toggle("on",old); oldSw.setAttribute("aria-pressed",String(old));
      oldSw.querySelector("strong").textContent=mode==="borrow"?"Debito vecchio, fuori saldo":"Prestito vecchio, fuori saldo";
      oldSw.querySelector("small").textContent=mode==="borrow"?"Lo segno solo come debito: non aggiunge soldi ai conti di oggi":"Lo segno solo come credito: non toglie soldi dai conti di oggi";
      accBox.closest(".field-row").hidden=old;
      const list=(m.kind==="pay"?payableAccounts():receivableAccounts()).map(a=>({p:a.person,owed:owedBy(a.person,m.kind)}));
      if(person && !list.some(x=>x.p.toLowerCase()===person.toLowerCase())) list.push({p:person,owed:0});
      peopleBox.innerHTML=list.map(x=>`<button type="button" class="chip${x.p.toLowerCase()===String(person).toLowerCase()?" active":""}" data-p="${escapeHtml(x.p)}">${escapeHtml(x.p)}${Math.abs(x.owed)>=0.005?`<span class="chip-amt">${balancesHidden?"••••":fmt(x.owed)}</span>`:""}</button>`).join("");
      peopleBox.querySelectorAll("[data-p]").forEach(b=>b.addEventListener("click",()=>{ person=b.dataset.p; newPerson.value=""; autoAmount(); paint(); }));
      accBox.innerHTML="";
      state.accounts.filter(a=>!isLoanAccount(a)).forEach(a=>{
        const c=document.createElement("button"); c.type="button"; c.className="chip"+(a.id===accId?" active":"");
        c.innerHTML=`<span class="em">●</span>${escapeHtml(a.name)}`; c.querySelector(".em").style.color=safeColor(a.color);
        c.addEventListener("click",()=>{ accId=a.id; paint(); }); accBox.appendChild(c);
      });
      const amt=parseAmount(amountInput.value), owed=person?owedBefore(person,m.kind):0;
      const isRepay=mode==="repayIn"||mode==="repayOut";
      const residual=round2(owed-amt), canClose=isRepay&&!old&&!!person&&amt>0&&residual>0.004;
      closeSw.hidden=true;
      { const rr=node.querySelector("#loanRestRow"); rr.hidden=!canClose;
        if(canClose){ const sh=fmt(Math.max(residual,0));
          node.querySelector("#loanRestLabel").textContent=m.kind==="recv"?`Hai ricevuto meno di quanto ti deve: la differenza di ${sh}`:`Paghi meno di quanto devi: la differenza di ${sh}`;
          rr.querySelector('[data-r="keep"] b').textContent=m.kind==="recv"?"Resta da ricevere":"Resta da pagare";
          rr.querySelector('[data-r="close"] b').textContent=m.kind==="recv"?"Ci rinuncio":"Me la abbuona";
          node.querySelector("#loanRestKeepAmt").textContent=m.kind==="recv"?`${person} ti dovrà ${sh}`:`dovrai ancora ${sh}`;
          node.querySelector("#loanRestCloseAmt").textContent="abbuono, si chiude";
          rr.querySelectorAll("[data-r]").forEach(b=>b.classList.toggle("active",(b.dataset.r==="close")===!!closeOn)); } }
      const closing=canClose&&closeOn;
      closeSw.classList.toggle("on",closing); closeSw.setAttribute("aria-pressed",String(closing));
      closeSw.querySelector("strong").textContent=m.kind==="recv"?"Vale come rimborso totale":"Vale come pagamento totale";
      closeSw.querySelector("small").textContent=m.kind==="recv"?`Chiude il prestito: abbuoni ${fmt(Math.max(residual,0))}`:`Chiude il debito: ti abbuonano ${fmt(Math.max(residual,0))}`;
      const canRates=(mode==="lend"||mode==="borrow")&&!existing;
      if(!canRates) ratesOn=false;
      ratesSw.hidden=!canRates; ratesSw.classList.toggle("on",ratesOn); ratesSw.setAttribute("aria-pressed",String(ratesOn));
      ratesSw.querySelector("small").textContent=m.kind==="recv"?"Pianifica quando e quanto ti restituiranno":"Pianifica quando e quanto restituirai";
      ratesBox.hidden=!ratesOn;
      const after=mode==="lend"||mode==="borrow"?owed+amt:closing?0:residual;
      const rateNote=presetRate&&isRepay?`Rata ${presetRate.n||1}${presetRate.of?` di ${presetRate.of}`:""} prevista il ${shortDate(presetRate.date)}. `:"";
      if(!person) hint.textContent="Scegli o scrivi la persona.";
      else if(closing) hint.textContent=m.kind==="recv"?`${rateNote}Ricevi ${fmt(amt)}, abbuoni ${fmt(residual)}: il prestito con ${person} si chiude.`:`${rateNote}Paghi ${fmt(amt)}, ti abbuonano ${fmt(residual)}: il debito con ${person} si chiude.`;
      else if(isRepay&&amt>0&&residual>0.004) hint.textContent=m.kind==="recv"?`${rateNote}Rimborso parziale: ${person} ti dovrà ancora ${fmt(residual)}.`:`${rateNote}Pagamento parziale: dovrai ancora ${fmt(residual)} a ${person}.`;
      else hint.textContent=m.kind==="recv"?`${rateNote}Dopo questo movimento ${person} ti deve ${fmt(Math.max(after,0))}${after<-0.004?` (ti ha dato ${fmt(-after)} in più)`:""}.`:`${rateNote}Dopo questo movimento devi a ${person} ${fmt(Math.max(after,0))}.`;
    }
    function autoAmount(){
      if(amountTouched||existing) return;
      if(presetRate&&(mode==="repayIn"||mode==="repayOut")&&person===preset.person){ amountInput.value=String(round2(presetRate.amount)).replace(".",","); return; }
      if(mode==="repayIn"||mode==="repayOut"){ const o=person?owedBy(person,LOAN_MODES[mode].kind):0; amountInput.value=o>0?String(Math.round(o*100)/100).replace(".",","):""; }
    }
    newPerson.addEventListener("input",()=>{ const v=newPerson.value.trim(); if(v){ person=v; } paint(); newPerson.focus(); });
    node.querySelectorAll("#loanModes [data-mode]").forEach(b=>b.addEventListener("click",()=>{ if(b.disabled) return; const k=LOAN_MODES[mode].kind; mode=b.dataset.mode; if(LOAN_MODES[mode].kind!==k&&!existing) person=""; autoAmount(); paint(); }));
    node.querySelector("#loanOldSwitch").addEventListener("click",()=>{ old=!old; paint(); });
    const regrow=()=>fitAmountInput(amountInput);
    const autoAmount0=autoAmount; autoAmount=function(){ autoAmount0(); regrow(); };
    autoAmount(); paint();
    const del=node.querySelector("#deleteLoanBtn");
    if(existing){
      del.hidden=false;
      del.addEventListener("click",async()=>{
        if(!await askConfirm("Eliminare questo movimento del prestito?",{ok:"Elimina",danger:true})) return;
        const linked=linkedTx(existing);
        moveToTrash("transaction",existing,linked); const trashId=state.trash[0]?.id;
        const ids=new Set([existing.id,...linked.map(x=>x.id)]);
        state.transactions=state.transactions.filter(x=>!ids.has(x.id));
        pruneLoanRates();
        persist(); renderAll(); close(); if(trashId) showUndo("Movimento eliminato",trashId);
      });
    }
    node.querySelector("#saveLoanBtn").addEventListener("click",()=>{
      const amount=parseAmount(amountInput.value);
      const missing=[]; if(!(amount>0)) missing.push("importo"); if(!person) missing.push("persona"); if(!accId&&!old) missing.push("conto");
      if(missing.length){ showToast("Inserisci: "+missing.join(", ")); return; }
      if(dateInput.value>todayISO()){ showToast("Il movimento non può avere una data futura"); return; }
      if(ratesOn&&ratesEd){ const err=ratesEd.check(); if(err){ showToast(err); return; } }
      const isRepay=mode==="repayIn"||mode==="repayOut";
      const owedPrev=person?owedBefore(person,LOAN_MODES[mode].kind):0;
      const m=LOAN_MODES[mode], la=ensureLoanAccount(person,m.kind);
      const out=mode==="lend"||mode==="repayOut";
      const t=existing||{id:uid()};
      if(old){
        // Fuori saldo: rettifica sul conto prestito, i conti veri non cambiano e non entra nelle statistiche.
        Object.assign(t,{date:dateInput.value||todayISO(),amount,type:mode==="lend"?"income":"expense",categoryId:null,accountId:la.id,toAccountId:null,note:noteInput.value.trim(),loanKind:mode,loanOld:true,isBalanceAdjustment:true,
          name:mode==="lend"?`Prestito a ${la.person} (vecchio)`:`Debito con ${la.person} (vecchio)`});
      } else {
        Object.assign(t,{date:dateInput.value||todayISO(),amount,type:"transfer",categoryId:null,accountId:out?accId:la.id,toAccountId:out?la.id:accId,note:noteInput.value.trim(),loanKind:mode});
        delete t.loanOld; delete t.isBalanceAdjustment;
        t.name=transferName(t.accountId,t.toAccountId);
      }
      if(!existing) state.transactions.push(t);
      // Abbuono: il rimborso parziale vale come totale e azzera il residuo.
      let wo=t.settleGroup?state.transactions.find(x=>x.settleGroup===t.settleGroup&&x.loanWriteOff):null;
      const residual=round2(owedPrev-amount);
      if(isRepay&&!old&&closeOn&&residual>0.004){
        const gid=t.settleGroup||uid(); t.settleGroup=gid;
        if(!wo){ wo={id:uid()}; state.transactions.push(wo); }
        Object.assign(wo,{date:t.date,amount:residual,type:m.kind==="recv"?"expense":"income",categoryId:null,accountId:la.id,toAccountId:null,note:"",
          isBalanceAdjustment:true,loanWriteOff:true,settleGroup:gid,loanKind:m.kind==="recv"?"writeOffIn":"writeOffOut",name:m.kind==="recv"?`Abbuono a ${la.person}`:`Abbuono da ${la.person}`});
      } else {
        if(wo) state.transactions=state.transactions.filter(x=>x.id!==wo.id);
        delete t.settleGroup;
      }
      balanceCache.clear();
      // Rate: un nuovo prestito con piano; una restituzione scala le rate in ordine.
      if(ratesOn&&ratesEd&&!existing) saveRatesFor(la.id,ratesEd.get());
      if(isRepay&&!existing){ const cov=allocateToRates(la.id,amount,preset.rateId); if(cov.length) t.rateInfo=cov; }
      if(isRepay&&closeOn) state.loanRates=(state.loanRates||[]).filter(r=>r.accId!==la.id);
      pruneLoanRates();
      // v1.25.0: arrivato da "Elimina persona" → se ora il saldo è zero la persona sparisce.
      let archived=false;
      if(preset.archiveAfter){ const ax=state.accounts.find(x=>x.id===preset.archiveAfter); if(ax&&Math.abs(accountBalance(ax.id))<0.005){ archiveLoanAccount(ax); archived=true; } }
      persist(); renderAll(); close();
      showToast(archived?`Saldo registrato: ${la.person} eliminato`:existing?"Movimento aggiornato":isRepay&&closeOn&&residual>0.004?"Registrato: prestito chiuso":ratesOn?"Registrato con le rate":"Registrato");
    });
  });
}
function openLoanPerson(accId){
  openSheet("tpl-loan-person",(node,close)=>{
    function paint(){
      if(!node.isConnected) return;
      const a=state.accounts.find(x=>x.id===accId); if(!a){ close(); return; }
      const recv=!!a.receivable, bal=accountBalance(a.id), owed=recv?bal:-bal;
      node.querySelector("#loanPersonTitle").textContent=`${recv?"🤝":"🏦"} ${a.person}`;
      node.querySelector("#loanPersonWho").textContent=Math.abs(owed)<0.005?"Siete in pari":recv?(owed>0?`${a.person} ti deve`:`Hai ricevuto in più da ${a.person}`):(owed>0?`Devi a ${a.person}`:`${a.person} ti deve restituire`);
      const amt=node.querySelector("#loanPersonAmount"); amt.textContent=balancesHidden?"••••":fmt(Math.abs(owed)); amt.style.color=Math.abs(owed)<0.005?"var(--ink)":recv?"#8E7CC3":"#C9785C";
      const p=node.querySelector("#loanPersonPrimary"), s=node.querySelector("#loanPersonSecondary");
      p.textContent=recv?"↩️ Registra restituzione":"💸 Paga / restituisci"; s.textContent=recv?"＋ Prestito":"＋ Debito";
      const list=state.transactions.filter(t=>t.accountId===a.id||t.toAccountId===a.id).sort((x,y)=>y.date.localeCompare(x.date)||String(y.id).localeCompare(String(x.id)));
      renderTxRows(node.querySelector("#loanPersonTx"),list);
      const paid=list.filter(t=>Array.isArray(t.rateInfo)&&t.rateInfo.length).sort((x,y)=>x.date.localeCompare(y.date));
      const pbox=node.querySelector("#loanPersonPaid");
      node.querySelector("#loanPersonPaidWrap").hidden=!paid.length;
      pbox.innerHTML=paid.map(t=>`<div class="loan-rate-row paid"><span class="loan-rate-dot" aria-hidden="true">✅</span><span class="loan-rate-text"><strong>${escapeHtml(rateInfoLabel(t.rateInfo))}</strong><span>${recv?"ricevuta":"pagata"} il ${escapeHtml(shortDate(t.date))}${t.rateInfo[0]?.date&&t.rateInfo[0].date<t.date?` · prevista il ${escapeHtml(shortDate(t.rateInfo[0].date))}`:""}</span></span><span class="loan-rate-amt">${balancesHidden?"••••":fmt(t.amount)}</span></div>`).join("");
      const rates=ratesOf(a.id), rbox=node.querySelector("#loanPersonRates");
      node.querySelector("#loanPersonRatesWrap").hidden=!rates.length;
      rbox.innerHTML=""; rates.forEach(r=>rbox.appendChild(rateRowEl(r,{onPay:r=>{ close(); payRate(r); }})));
      const planBtn=node.querySelector("#loanPersonPlan");
      planBtn.hidden=Math.abs(owed)<0.005&&!rates.length;
      planBtn.textContent="📅 Rate"; planBtn.setAttribute("aria-label",rates.length?"Modifica rate":"Rate");
      // v1.26.0: l'altra parte (se con la stessa persona ci sono sia crediti che debiti) e il netto
      const pp=personPosition(a.person), oth=node.querySelector(".loan-person-other"), sb=node.querySelector(".loan-person-settle");
      if(sb) sb.hidden=Math.abs(pp.credit)<0.005&&Math.abs(pp.debt)<0.005;
      if(oth){
        const both=Math.abs(pp.credit)>=0.005&&Math.abs(pp.debt)>=0.005;
        oth.hidden=!both;
        if(both){ const sh=v=>balancesHidden?"••••":fmt(v);
          oth.innerHTML=`<span>${recv?"Inoltre gli devi":"Inoltre ti deve"} <b>${sh(recv?pp.debt:pp.credit)}</b></span><span>Netto: <b>${Math.abs(pp.net)<0.005?"siete in pari":pp.net>0?`ti deve ${sh(pp.net)}`:`gli devi ${sh(-pp.net)}`}</b></span>`; }
      }
    }
    node.querySelector("#loanPersonPrimary").addEventListener("click",()=>{ const a=state.accounts.find(x=>x.id===accId); close(); openLoanForm(null,{mode:a.receivable?"repayIn":"repayOut",person:a.person}); });
    node.querySelector("#loanPersonSecondary").addEventListener("click",()=>{ const a=state.accounts.find(x=>x.id===accId); close(); openLoanForm(null,{mode:a.receivable?"lend":"borrow",person:a.person}); });
    node.querySelector("#loanPersonPlan").addEventListener("click",()=>{ close(); openLoanPlan(accId); });
    // v1.25.0 — spesa pagata da questa persona ed eliminazione della persona
    {
      const a0=state.accounts.find(x=>x.id===accId);
      const row=node.querySelector(".loan-person-actions-row");
      // v1.26.0: pareggia in un colpo crediti e debiti con questa persona
      const ob=document.createElement("button"); ob.type="button"; ob.className="pill-btn loan-person-settle"; ob.textContent="⚖️ Pareggia"; ob.setAttribute("aria-label","Pareggia i conti");
      ob.addEventListener("click",()=>settlePerson(a0?.person,close));
      row?.appendChild(ob);
      const other=document.createElement("p"); other.className="loan-person-other"; other.hidden=true;
      node.querySelector("#loanPersonAmount")?.after(other);
      const del=document.createElement("button"); del.type="button"; del.className="text-danger-btn loan-person-delete"; del.textContent="Elimina persona";
      del.addEventListener("click",()=>deleteLoanPerson(accId,close));
      node.querySelector(".sheet")?.appendChild(del) || node.appendChild(del);
    }
    loanPersonRefresh=paint;
    paint();
  });
}
var loanPersonRefresh=null;
/* v1.25.0 — Eliminare una persona.
   - In pari (saldo 0): si elimina subito; i movimenti passati restano nello storico (il conto viene archiviato).
   - Con un saldo aperto si sceglie come chiuderlo prima:
       💶 "Registra il saldo": apre la restituzione già compilata; a salvataggio fatto la persona sparisce;
       ✅ "Abbuona": il residuo viene azzerato senza muovere soldi (riga "Abbuono"), poi la persona sparisce. */
function archiveLoanAccount(a){
  a.archived=true;
  state.loanRates=(state.loanRates||[]).filter(r=>r.accId!==a.id);
}
function chooseAction(title,text,options){
  return new Promise(resolve=>{
    document.getElementById("movementActionOverlay")?.remove();
    const overlay=document.createElement("div");
    overlay.id="movementActionOverlay"; overlay.className="movement-action-overlay";
    overlay.innerHTML=`<div class="movement-action-menu choose-menu" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}"><div class="movement-action-handle" aria-hidden="true"></div>
      <div class="movement-action-title">${escapeHtml(title)}</div><p class="choose-text">${escapeHtml(text)}</p>
      <div class="choose-list">${options.map((o,i)=>`<button type="button" class="choose-opt${o.danger?" danger":""}" data-i="${i}"><span class="choose-ic" aria-hidden="true">${o.icon||""}</span><span class="choose-tx"><b>${escapeHtml(o.label)}</b>${o.hint?`<small>${escapeHtml(o.hint)}</small>`:""}</span></button>`).join("")}</div>
      <button type="button" class="movement-action-cancel">Annulla</button></div>`;
    const done=v=>{ overlay.remove(); resolve(v); };
    overlay.querySelectorAll("[data-i]").forEach(b=>b.addEventListener("click",()=>done(options[Number(b.dataset.i)].value)));
    overlay.querySelector(".movement-action-cancel").addEventListener("click",()=>done(null));
    overlay.addEventListener("click",e=>{ if(e.target===overlay) done(null); });
    document.body.appendChild(overlay);
    requestAnimationFrame(()=>overlay.classList.add("show"));
  });
}
async function deleteLoanPerson(accId,closeSheet){
  const a=state.accounts.find(x=>x.id===accId); if(!a) return;
  const recv=!!a.receivable, bal=round2(accountBalance(a.id)), owed=recv?bal:-bal;
  const show=v=>balancesHidden?"••••":fmt(v);
  if(Math.abs(bal)<0.005){
    if(!await askConfirm(`Eliminare ${a.person}? Siete in pari: i movimenti passati restano nello storico.`,{ok:"Elimina",danger:true})) return;
    archiveLoanAccount(a); balanceCache.clear(); persist(); renderAll(); closeSheet&&closeSheet();
    showToast(`${a.person} eliminato`); return;
  }
  const opts=[];
  if(owed>0) opts.push({value:"settle",icon:"💶",label:recv?`Mi ha restituito ${show(owed)}`:`Gli ho dato ${show(owed)}`,hint:recv?"Registra l'entrata sul conto che scegli, poi elimina":"Registra l'uscita dal conto che scegli, poi elimina"});
  opts.push({value:"writeoff",icon:"✅",label:recv?(owed>0?`Rinuncio a ${show(owed)}`:`Tengo i ${show(-owed)} in più`):(owed>0?`Me li abbuona (${show(owed)})`:`Rinuncio ai ${show(-owed)} in più`),hint:"Azzera il saldo senza muovere soldi dai conti, poi elimina"});
  const who=recv?(owed>0?`${a.person} ti deve ${show(owed)}`:`Hai ricevuto ${show(-owed)} in più da ${a.person}`):(owed>0?`Devi ${show(owed)} a ${a.person}`:`${a.person} ti deve restituire ${show(-owed)}`);
  const choice=await chooseAction(`Eliminare ${a.person}?`,`${who}. Come vuoi chiudere il saldo prima di eliminarlo?`,opts);
  if(!choice) return;
  if(choice==="settle"){
    closeSheet&&closeSheet();
    setTimeout(()=>openLoanForm(null,{mode:recv?"repayIn":"repayOut",person:a.person,archiveAfter:a.id}),250);
    return;
  }
  // Abbuono: riga fuori saldo sul conto prestito che porta il saldo a zero.
  state.transactions.push({id:uid(),date:todayISO(),amount:Math.abs(bal),type:bal>0?"expense":"income",categoryId:null,accountId:a.id,toAccountId:null,note:"Persona eliminata",
    isBalanceAdjustment:true,loanWriteOff:true,loanKind:recv?"writeOffIn":"writeOffOut",name:recv?`Abbuono a ${a.person}`:`Abbuono da ${a.person}`});
  archiveLoanAccount(a); balanceCache.clear(); persist(); renderAll(); closeSheet&&closeSheet();
  showToast(`Saldo chiuso con un abbuono: ${a.person} eliminato`);
}
/* v1.26.0 — Pareggiare i conti con una persona, tutto insieme.
   Una persona può avere sia un credito (Da ricevere) sia un debito (Da pagare).
   - ⚖️ Compensa: crediti e debiti si annullano tra loro fino alla cifra più piccola; nessun soldo si muove
     e il totale effettivo non cambia.
   - 💶 Salda il netto: compensa e apre il movimento per la differenza sul conto che scegli
     (con una cifra inferiore scegli se il resto resta aperto o è abbuonato).
   - 🧾 Fuori dai conti: azzera tutto con un abbuono; crediti e debiti escono dal totale effettivo. */
function personPosition(name){
  const n=String(name||"").toLowerCase();
  const recv=receivableAccounts().find(a=>String(a.person).toLowerCase()===n)||null;
  const pay=payableAccounts().find(a=>String(a.person).toLowerCase()===n)||null;
  const credit=recv?round2(accountBalance(recv.id)):0, debt=pay?round2(-accountBalance(pay.id)):0;
  return {recv,pay,credit,debt,net:round2(credit-debt)};
}
function loanAdjRow(acc,amount,gid,extra){
  // amount>0 riduce quanto è dovuto su quel conto prestito
  const recv=!!acc.receivable;
  const r={id:uid(),date:todayISO(),amount:round2(Math.abs(amount)),type:(recv?amount>0:amount<0)?"expense":"income",categoryId:null,accountId:acc.id,toAccountId:null,note:"",
    isBalanceAdjustment:true,loanWriteOff:true,settleGroup:gid,loanKind:recv?"writeOffIn":"writeOffOut",name:recv?`Abbuono a ${acc.person}`:`Abbuono da ${acc.person}`,...extra};
  state.transactions.push(r); return r;
}
function compensatePerson(pp){
  const m=round2(Math.min(pp.credit,pp.debt));
  if(!(m>0.004)||!pp.recv||!pp.pay) return 0;
  const gid=uid();
  loanAdjRow(pp.recv,m,gid,{loanOffset:true,loanKind:"offset",name:`Compensazione con ${pp.recv.person}`});
  loanAdjRow(pp.pay,m,gid,{loanOffset:true,loanKind:"offset",name:`Compensazione con ${pp.pay.person}`});
  balanceCache.clear();
  return m;
}
async function settlePerson(name,closeSheet){
  const pp=personPosition(name); if(!pp.recv&&!pp.pay) return;
  const sh=v=>balancesHidden?"••••":fmt(v), person=(pp.recv||pp.pay).person;
  const both=pp.credit>0.004&&pp.debt>0.004, m=round2(Math.min(pp.credit,pp.debt));
  const netTxt=Math.abs(pp.net)<0.005?"siete in pari":pp.net>0?`${person} ti deve ${sh(pp.net)}`:`devi ${sh(-pp.net)} a ${person}`;
  const parts=[]; if(Math.abs(pp.credit)>=0.005) parts.push(`ti deve ${sh(pp.credit)}`); if(Math.abs(pp.debt)>=0.005) parts.push(`gli devi ${sh(pp.debt)}`);
  const opts=[];
  if(both) opts.push({value:"offset",icon:"⚖️",label:`Compensa ${sh(m)}`,hint:`Crediti e debiti si annullano: poi ${netTxt}. Nessun soldo si muove.`});
  if(Math.abs(pp.net)>=0.005) opts.push({value:"pay",icon:"💶",label:pp.net>0?`Mi dà la differenza (${sh(pp.net)})`:`Gli do la differenza (${sh(-pp.net)})`,hint:`${both?"Compensa e registra":"Registra"} il movimento sul conto che scegli; se è una cifra inferiore decidi se il resto resta o è abbuonato.`});
  opts.push({value:"out",icon:"🧾",label:"Chiudi tutto fuori dai conti",hint:"Azzera crediti e debiti con un abbuono, senza muovere soldi: escono dal totale effettivo."});
  const choice=await chooseAction(`Pareggia con ${person}`,`${person}: ${parts.join(" e ")||"siete in pari"}. Netto: ${netTxt}.`,opts);
  if(!choice) return;
  if(choice==="offset"){
    compensatePerson(pp); persist(); renderAll();
    const after=personPosition(person);
    showToast(Math.abs(after.net)<0.005?`Compensato: con ${person} siete in pari`:`Compensato ${fmt(m)}: ${after.net>0?`ti deve ${fmt(after.net)}`:`gli devi ${fmt(-after.net)}`}`);
    return;
  }
  if(choice==="pay"){
    if(both){ compensatePerson(pp); persist(); renderAll(); }
    closeSheet&&closeSheet();
    setTimeout(()=>openLoanForm(null,{mode:pp.net>0?"repayIn":"repayOut",person}),250);
    return;
  }
  const gid=uid();
  if(Math.abs(pp.credit)>=0.005) loanAdjRow(pp.recv,pp.credit,gid,{note:"Pareggio fuori dai conti"});
  if(Math.abs(pp.debt)>=0.005) loanAdjRow(pp.pay,pp.debt,gid,{note:"Pareggio fuori dai conti"});
  state.loanRates=(state.loanRates||[]).filter(r=>r.accId!==pp.recv?.id&&r.accId!==pp.pay?.id);
  balanceCache.clear(); persist(); renderAll();
  showToast(`Chiuso fuori dai conti: con ${person} siete in pari`);
}
async function undoLoanSettle(t){
  const what=t.loanOffset?"questa compensazione":"questo abbuono";
  if(!await askConfirm(`Annullare ${what}? Il credito o il debito torna com'era.`,{ok:"Sì, annulla",cancel:"No",danger:true})) return;
  const linked=linkedTx(t).filter(x=>x.loanWriteOff);
  moveToTrash("transaction",t,linked); const trashId=state.trash[0]?.id;
  const ids=new Set([t.id,...linked.map(x=>x.id)]);
  const accs=new Set([t.accountId,...linked.map(x=>x.accountId)]);
  state.transactions=state.transactions.filter(x=>!ids.has(x.id));
  balanceCache.clear();
  accs.forEach(id=>{ const a=state.accounts.find(x=>x.id===id); if(a?.archived&&Math.abs(accountBalance(a.id))>=0.005) delete a.archived; });
  persist(); renderAll(); if(trashId) showUndo("Annullato",trashId);
}
let accountsMode="accounts";
function setAccountsMode(mode){
  accountsMode=mode==="loans"?"loans":"accounts";
  const ap=document.getElementById("accountsPane"), lp=document.getElementById("loansPane");
  if(ap) ap.hidden=accountsMode!=="accounts";
  if(lp) lp.hidden=accountsMode!=="loans";
  document.querySelectorAll("#accountsModeToggle [data-acc-mode]").forEach(b=>b.classList.toggle("active",b.dataset.accMode===accountsMode));
  renderLoans();
}
function renderLoans(){
  pruneLoanRates();
  const show=v=>balancesHidden?"••••":fmt(v);
  const inT=receivableTotal(), outT=payableTotal();
  const el=id=>document.getElementById(id);
  if(!el("loanSumIn")) return;
  el("loanSumIn").textContent=show(inT); el("loanSumOut").textContent=show(outT);
  const net=inT-outT; el("loanSumNet").textContent=balancesHidden?"••••":`${net>=0?"+":"−"}${fmt(Math.abs(net))}`; el("loanSumNet").style.color=moneyColor(net);
  const card=a=>{
    const bal=accountBalance(a.id), owed=a.receivable?bal:-bal;
    const last=state.transactions.filter(t=>t.accountId===a.id||t.toAccountId===a.id).reduce((m,t)=>t.date>m?t.date:m,"");
    const next=ratesOf(a.id)[0], nw=next?rateWhen(next.date):null;
    const b=document.createElement("button"); b.type="button"; b.className="loan-person"+(Math.abs(owed)<0.005?" settled":"");
    b.innerHTML=`<span class="loan-av" style="background:${a.receivable?"#8E7CC3":"#C9785C"}">${escapeHtml((a.person||"?").trim()[0]||"?").toUpperCase()}</span>
      <span class="loan-person-text"><strong>${escapeHtml(a.person)}</strong><span>${Math.abs(owed)<0.005?"In pari":a.receivable?"ti deve":"devi"}${next?` · <em class="${nw.late?"late":""}">rata ${nw.late?nw.text:shortDate(next.date)}</em>`:last?` · ultimo ${last.split("-").reverse().slice(0,2).join("/")}`:""}</span></span>
      <span class="loan-person-amt">${Math.abs(owed)<0.005?fmt(0):show(Math.abs(owed))}</span><span class="chev" aria-hidden="true">›</span>`;
    b.addEventListener("click",()=>openLoanPerson(a.id));
    return b;
  };
  const sortBy=(arr,sign)=>arr.slice().sort((x,y)=>sign*accountBalance(y.id)-sign*accountBalance(x.id));
  const rl=el("loanRecvList"), pl=el("loanPayList");
  rl.innerHTML=""; sortBy(receivableAccounts(),1).forEach(a=>rl.appendChild(card(a)));
  pl.innerHTML=""; sortBy(payableAccounts(),-1).forEach(a=>pl.appendChild(card(a)));
  el("loanRecvEmpty").hidden=receivableAccounts().length>0;
  el("loanPayEmpty").hidden=payableAccounts().length>0;
  renderLoanUpcoming();
  renderLateRatesBadge();
  if(loanPersonRefresh) loanPersonRefresh();
}
function renderLoanStats(){
  const block=document.getElementById("loanStatsBlock"), box=document.getElementById("loanStats");
  if(!block||!box) return;
  const tx=statsTransactions().filter(t=>t.type==="transfer");
  const sum=mode=>tx.filter(t=>loanModeOf(t)===mode).reduce((s,t)=>s+t.amount,0);
  const lent=sum("lend"), back=sum("repayIn"), borrowed=sum("borrow"), repaid=sum("repayOut");
  const woAll=statsTransactions(true).filter(t=>t.loanWriteOff&&!t.loanOffset);
  const woIn=woAll.filter(t=>t.loanKind==="writeOffIn").reduce((s,t)=>s+t.amount,0), woOut=woAll.filter(t=>t.loanKind==="writeOffOut").reduce((s,t)=>s+t.amount,0);
  const hasAny=state.accounts.some(isLoanAccount);
  block.hidden=!hasAny;
  if(!hasAny) return;
  const show=v=>balancesHidden?"••••":fmt(v);
  const people=[...receivableAccounts().map(a=>({a,v:accountBalance(a.id),c:"#8E7CC3"})),...payableAccounts().map(a=>({a,v:-accountBalance(a.id),c:"#C9785C"}))].filter(x=>Math.abs(x.v)>=0.005);
  const max=Math.max(1,...people.map(x=>Math.abs(x.v)));
  box.innerHTML=`<div class="stat-card-grid loan-stat-grid">
      <div class="stat-card"><p class="stat-card-label">Prestato nel periodo</p><p class="stat-card-value" style="color:#8E7CC3">${show(lent)}</p></div>
      <div class="stat-card"><p class="stat-card-label">Restituito a te</p><p class="stat-card-value pos">${show(back)}</p></div>
      <div class="stat-card"><p class="stat-card-label">Preso in prestito</p><p class="stat-card-value" style="color:#C9785C">${show(borrowed)}</p></div>
      <div class="stat-card"><p class="stat-card-label">Rate e restituzioni</p><p class="stat-card-value neg">${show(repaid)}</p></div>
      ${woIn>0.004?`<div class="stat-card"><p class="stat-card-label">Abbuonato da te</p><p class="stat-card-value">${show(woIn)}</p></div>`:""}
      ${woOut>0.004?`<div class="stat-card"><p class="stat-card-label">Abbuonato a te</p><p class="stat-card-value pos">${show(woOut)}</p></div>`:""}
    </div>
    ${people.length?`<div class="loan-bars"><p class="stat-card-label">Situazione attuale per persona</p>${people.map(x=>`<div class="cs-row"><div class="cs-lbl"><span>${escapeHtml(x.a.person)} · ${x.a.receivable?"ti deve":"devi"}</span><strong>${show(Math.abs(x.v))}</strong></div><div class="cs-bar"><i style="width:${(Math.abs(x.v)/max*100).toFixed(1)}%;background:${x.c}"></i></div></div>`).join("")}</div>`:""}`;
}
document.querySelectorAll("#accountsModeToggle [data-acc-mode]").forEach(b=>b.addEventListener("click",()=>setAccountsMode(b.dataset.accMode)));
/* v1.67.0 — Conti: "＋ Conto" subito sopra l'elenco; Da ricevere / Da pagare nel totale portano a 🤝 Prestiti */
document.getElementById("accountsAddBtn")?.addEventListener("click",()=>openAccountForm(null));
document.getElementById("accountsEffectiveRows")?.addEventListener("click",e=>{ if(e.target.closest("[data-acx-loans]")) setAccountsMode("loans"); });
document.getElementById("addLendBtn")?.addEventListener("click",()=>openLoanForm(null,{mode:"lend"}));
document.getElementById("addBorrowBtn")?.addEventListener("click",()=>openLoanForm(null,{mode:"borrow"}));
document.getElementById("homeEffectiveCard")?.addEventListener("click",()=>{ switchView("accounts"); setAccountsMode("loans"); });
/* ---------------- Add Transaction sheet ---------------- */
/* v1.41.0 — Un solo "Movimento" nel "+": in cima al pannello si sceglie se è un movimento,
   un ricorrente o un pianificato. Cambiando tipo quello che hai già scritto (importo, nome,
   uscita/entrata, categoria, conto, nota, data) passa al nuovo pannello. */
function mountKindSwitch(node,current,collect){
  const head=node.querySelector(".add-kind-slot")||node.querySelector(".sheet-head"); if(!head) return;
  const bar=document.createElement("div");
  bar.className="type-toggle three kind-switch";
  bar.setAttribute("role","tablist");
  bar.innerHTML=[["tx","Movimento"],["recurring","↻ Ricorrente"],["planned","◷ Pianificato"]]
    .map(([k,l])=>`<button type="button" class="type-opt${k===current?" active":""}" data-kind="${k}" role="tab" aria-selected="${k===current}">${l}</button>`).join("");
  if(head.classList.contains("add-kind-slot")) head.appendChild(bar); else head.after(bar);
  bar.querySelectorAll("[data-kind]").forEach(b=>b.addEventListener("click",()=>{
    const k=b.dataset.kind; if(k===current) return;
    const d=collect()||{};
    const base={name:d.name||"",amount:d.amount>0?Number(d.amount).toFixed(2):"",type:d.type==="income"?"income":"expense",categoryId:d.categoryId||null,accountId:d.accountId||null,note:d.note||""};
    const today=todayISO(), when=d.date||today;
    if(typeof node._closeNow==="function") node._closeNow();
    if(k==="tx") openAddTransaction(null,{carry:{...base,date:when>today?today:when}});
    else if(k==="recurring") openRecurringForm(null,{...base,startDate:when});
    else openPlannedForm(null,{...base,date:when<today?today:when});
  }));
}
/* v1.50.0 — Movimenti ricorrenti "a mano" (stesso nome) degli ultimi 120 giorni,
   ordinati per quante volte li hai registrati; importo, categoria e conto dell'ultima volta. */
function frequentMovements(type,limit=6){
  const since=new Date(); since.setDate(since.getDate()-120);
  const sinceISO=`${since.getFullYear()}-${pad2(since.getMonth()+1)}-${pad2(since.getDate())}`;
  const groups=new Map();
  state.transactions.forEach(t=>{
    if(t.type!==type||t.date<sinceISO||t.isBalanceAdjustment||t.splitGroup||t.loanOld||t.loanWriteOff||t.otherPaid||t.recurringId||t.plannedId) return;
    const name=(t.name||"").trim(); if(!name) return;
    const k=name.toLowerCase();
    const g=groups.get(k)||{count:0,last:null};
    g.count++; if(!g.last||t.date>g.last.date) g.last=t;
    groups.set(k,g);
  });
  const all=[...groups.values()];
  const often=all.filter(g=>g.count>=2).sort((a,b)=>b.count-a.count||b.last.date.localeCompare(a.last.date));
  const recent=all.filter(g=>g.count<2).sort((a,b)=>b.last.date.localeCompare(a.last.date));
  return [...often,...recent].slice(0,limit).map(g=>({name:g.last.name.trim(),amount:g.last.amount,categoryId:g.last.categoryId,accountId:g.last.accountId}));
}
function openAddTransaction(txId,preset=null){
  const editing=!!txId;
  const existing=editing ? state.transactions.find(t=>t.id===txId) : null;
  if(editing && !existing) return;
  // v1.10.8: trasferimenti e prelievi hanno il proprio pannello, anche in modifica.
  // v1.12.0: una spesa divisa / prestito si modifica sempre dal modulo spesa, con il totale.
  if(existing?.loanOld) return openLoanForm(txId);
  if(existing?.loanWriteOff){ const rep=linkedTx(existing).find(x=>x.type==="transfer"); return rep?openLoanForm(rep.id):undoLoanSettle(existing); }
  const group=existing?.splitGroup?groupParts(existing.splitGroup):null;
  if(!group && existing?.type==="transfer" && (loanAccount(existing.accountId)||loanAccount(existing.toAccountId))) return openLoanForm(txId);
  if(!group && existing?.type==="transfer") return existing.atm ? openAtmWithdrawal(txId) : openTransferForm(txId);
  let view=group?{type:"expense",amount:groupTotal(group),name:group.main?.name||group.share?.note||"",categoryId:group.main?.categoryId||group.share?.loanCategoryId||null,accountId:(group.main||group.share).accountId,toAccountId:null,date:(group.main||group.share).date,note:group.main?.note||"",estimateId:group.main?.estimateId||null}:existing;
  // v1.41.0 — passando da Ricorrente/Pianificato a Movimento i dati scritti restano.
  if(!view && preset?.carry) view=preset.carry;
  txType = view?.type || (preset&&["expense","income"].includes(preset.type)?preset.type:"") || "expense"; /* v1.69.0 — dal "+": Uscita o Entrata */
  selectedCategoryId = view?.categoryId || null;
  selectedAccountId = view?.accountId || null;
  let destinationAccountId = view?.toAccountId || null;

  openSheet("tpl-add-transaction", (node, close)=>{
    const amountInput = node.querySelector("#amountInput");
    const nameInput=node.querySelector("#txNameInput");
    amountInput.value = view ? String(view.amount).replace(".",",") : "";
    nameInput.value=view?.name || "";
    autoGrowAmountInput(amountInput);
    const dateInput = node.querySelector("#dateInput");
    const noteInput = node.querySelector("#noteInput");
    const catChipsGrouped = node.querySelector("#categoryChipsGrouped");
    const accChips = node.querySelector("#accountChips");
    const destinationChips = node.querySelector("#destinationAccountChips");
    const typeToggle = node.querySelector("#typeToggle");
    const categoryRow=node.querySelector("#txCategoryRow"), destinationRow=node.querySelector("#destinationAccountRow");

    const today = new Date();
    const inViewedMonth = today.getFullYear()===viewYear && today.getMonth()===viewMonth;
    dateInput.value = view?.date || (periodModes.home==="day" ? selectedDate() : inViewedMonth ? todayISO() : `${viewYear}-${pad2(viewMonth+1)}-01`);
    // I movimenti reali non possono avere una data futura: per quelli si usa Pianificato.
    dateInput.max = todayISO();
    noteInput.value = view?.note || "";

    // v1.23.0 — categoria suggerita dal nome finché non la scegli tu.
    let catManual=!!view?.categoryId;
    let accManual=!!view?.accountId;
    /* v1.70.0 — 🎯 CONTA NELLA STIMA: solo se scegli tu una stima del mese (di partenza "Nessuna") */
    let selEst=(view&&view.estimateId)||null;
    const estRow=document.createElement("div"); estRow.className="field-row est-link-row"; estRow.hidden=true;
    categoryRow.after(estRow);
    function renderEstRow(){
      const key=String(dateInput.value||"").slice(0,7);
      const opts=txType==="expense"&&/^\d{4}-\d{2}$/.test(key)?estOptionsFor(key,selectedCategoryId):[];
      if(selEst&&!opts.some(o=>o.e.id===selEst)) selEst=null;
      estRow.hidden=!opts.length;
      estRow.innerHTML=opts.length?`<label>🎯 Conta nella stima di ${estMonthName(key)}</label><div class="est-chips">${estChipsHtml(key,selectedCategoryId,selEst)}</div>`:"";
    }
    estRow.addEventListener("click",ev=>{ const b=ev.target.closest("[data-est-link]"); if(!b) return; selEst=b.dataset.estLink||null; renderEstRow(); });
    function renderCatChips(){
      /* v1.69.0 — scelta della categoria unica (renderCategoryPicker); categorie del gioco → conto Scommesse */
      renderCategoryPicker(catChipsGrouped, txType, ()=>selectedCategoryId, (id,info)=>{
        selectedCategoryId=id;
        if(!catAuto&&info&&info.user){ catManual=true; showCatHint(null); }
        const ba=betAccount(); if(ba&&!accManual&&!existing&&isBetCategory(id)&&selectedAccountId!==ba.id){ selectedAccountId=ba.id; renderAccChips(); }
        renderEstRow();
      });
      renderEstRow();
    }
    /* v1.65.0 — data con un tocco: Oggi, Ieri (la casella resta per un altro giorno) */
    const dq=document.createElement("div"); dq.className="mt-dq";
    dq.innerHTML=`<button type="button" data-dq="0">Oggi</button><button type="button" data-dq="1">Ieri</button><span class="mt-dq-x">o un altro giorno ›</span>`;
    node.querySelector(".add-amount-row")?.after(dq);
    const syncDq=()=>{ const v=dateInput.value, t=todayISO(), y=previousISO(t); dq.querySelector('[data-dq="0"]').classList.toggle("on",v===t); dq.querySelector('[data-dq="1"]').classList.toggle("on",v===y); };
    dq.addEventListener("click",e=>{ const b=e.target.closest("[data-dq]"); if(b){ dateInput.value=b.dataset.dq==="0"?todayISO():previousISO(todayISO()); syncDq(); } else if(e.target.closest(".mt-dq-x")){ try{ dateInput.showPicker(); }catch(_){ dateInput.focus(); } } });
    dateInput.addEventListener("change",syncDq); dateInput.addEventListener("input",syncDq); syncDq();
    let catAuto=false;
    let catHint=null;
    function showCatHint(cat){
      if(!catHint){ catHint=document.createElement("p"); catHint.className="field-hint mt-cat-hint"; nameInput.closest(".field-row")?.appendChild(catHint); }
      catHint.hidden=!cat; if(cat) catHint.textContent=`💡 Categoria suggerita: ${cat.emoji||""} ${cat.name} (puoi cambiarla sotto)`;
    }
    let sugTimer=null;
    nameInput.addEventListener("input",()=>{ clearTimeout(sugTimer); sugTimer=setTimeout(()=>{
      if(catManual||txType==="transfer"||existing) return;
      const id=suggestCategoryFor(nameInput.value,txType);
      if(id){ if(id!==selectedCategoryId){ selectedCategoryId=id; catAuto=true; try{ renderCatChips(); } finally { catAuto=false; } } showCatHint(categoriesById()[id]); }
      else if(!id){ showCatHint(null); }
    },250); });
    function renderAccChips(){
      accChips.innerHTML = "";
      // v1.44.0 — il conto di partenza è il conto principale (si vede subito nel pulsante)
      if(!selectedAccountId) selectedAccountId = (state.accounts.find(a=>a.id===state.mainAccountId&&!isLoanAccount(a))||state.accounts.find(a=>!isLoanAccount(a))||state.accounts[0])?.id || null;
      state.accounts.filter(a=>!isLoanAccount(a)||a.id===selectedAccountId).forEach(a=>{
        const chip = document.createElement("button");
        chip.className = "chip" + (selectedAccountId===a.id ? " active":"");
        chip.innerHTML = `<span class="em">●</span>${escapeHtml(a.name)}`;
        chip.querySelector(".em").style.color = safeColor(a.color);
        chip.addEventListener("click", ()=>{ selectedAccountId=a.id; accManual=true; renderAccChips(); if(txType==="transfer") renderDestinationChips(); });
        accChips.appendChild(chip);
      });
    }
    function renderDestinationChips(){
      destinationChips.innerHTML="";
      state.accounts.filter(a=>a.id!==selectedAccountId).forEach(a=>{
        const chip=document.createElement("button");chip.className="chip"+(destinationAccountId===a.id?" active":"");
        chip.innerHTML=`<span class="em">●</span>${escapeHtml(a.name)}`;chip.querySelector(".em").style.color=safeColor(a.color);
        chip.addEventListener("click",()=>{destinationAccountId=a.id;renderDestinationChips();});destinationChips.appendChild(chip);
      });
      if(destinationAccountId===selectedAccountId) destinationAccountId=null;
    }
    function renderTypeFields(){
      const transfer=txType==="transfer";
      categoryRow.hidden=transfer; destinationRow.hidden=!transfer;
      // v1.10.5: un trasferimento non ha un nome: si chiama con i due conti coinvolti.
      const nameRow=nameInput.closest(".field-row"); if(nameRow) nameRow.hidden=transfer;
      if(!transfer) renderCatChips(); else {selectedCategoryId=null;renderDestinationChips();renderEstRow();}
    }
    dateInput.addEventListener("change",renderEstRow); /* v1.70.0 — le stime sono del mese della data */
    dq.addEventListener("click",()=>setTimeout(renderEstRow,0));

    typeToggle.querySelectorAll(".type-opt").forEach(opt=>{
      opt.classList.toggle("active",opt.dataset.type===txType);
      opt.addEventListener("click", ()=>{
        typeToggle.querySelectorAll(".type-opt").forEach(o=>o.classList.remove("active"));
        opt.classList.add("active");
        txType = opt.dataset.type;
        selectedCategoryId = null;
        catChipsGrouped._activeMacro = null; catChipsGrouped._open = false; catChipsGrouped._q = "";
        renderTypeFields();
      });
    });

    /* v1.50.0 — "Frequenti": i movimenti che registri più spesso (ultimi 4 mesi).
       Un tocco compila nome, importo, categoria e conto; poi controlli e salvi. */
    const quickRow=node.querySelector("#quickFillRow"), quickChips=node.querySelector("#quickFillChips");
    function renderQuickFill(){
      if(!quickRow) return;
      const list=(existing||group||preset?.carry||txType==="transfer")?[]:frequentMovements(txType,6);
      quickRow.hidden=!list.length;
      quickChips.innerHTML="";
      list.forEach(f=>{
        const chip=document.createElement("button"); chip.type="button"; chip.className="chip quick-chip";
        const cat=f.categoryId?categoriesById()[f.categoryId]:null;
        chip.innerHTML=`<span class="qc-em">${cat?.emoji?escapeHtml(cat.emoji):"•"}</span><span class="qc-name">${escapeHtml(f.name)}</span><span class="qc-amt">${fmt(f.amount)}</span>`;
        chip.addEventListener("click",()=>{
          nameInput.value=f.name;
          amountInput.value=(Math.round(f.amount*100)/100).toFixed(2).replace(".",","); autoGrowAmountInput(amountInput);
          if(f.categoryId && categoriesById()[f.categoryId]){ selectedCategoryId=f.categoryId; catManual=true; renderCatChips(); showCatHint(null); }
          if(f.accountId && state.accounts.some(a=>a.id===f.accountId)){ selectedAccountId=f.accountId; renderAccChips(); }
          quickChips.querySelectorAll(".quick-chip").forEach(c=>c.classList.toggle("active",c===chip));
          showToast(`Compilato come "${f.name}": controlla e salva`);
        });
        quickChips.appendChild(chip);
      });
    }
    typeToggle.querySelectorAll(".type-opt").forEach(opt=>opt.addEventListener("click",renderQuickFill));
    // Nome già usato in passato → stesso conto dell'ultima volta (se non l'hai scelto tu)
    nameInput.addEventListener("change",()=>{
      if(existing||accManual||txType==="transfer") return;
      const k=nameInput.value.trim().toLowerCase(); if(!k) return;
      const last=state.transactions.filter(t=>t.type===txType&&!t.isBalanceAdjustment&&(t.name||"").trim().toLowerCase()===k&&t.accountId&&state.accounts.some(a=>a.id===t.accountId&&!isLoanAccount(a))).sort((a,b)=>b.date.localeCompare(a.date))[0];
      if(last && last.accountId!==selectedAccountId){ selectedAccountId=last.accountId; renderAccChips(); }
    });
    renderQuickFill();
    renderAccChips();
    renderTypeFields();
    { const tt=node.querySelector("#txFormTitle"); if(tt) tt.textContent=(existing||group)?"Modifica movimento":"Nuovo movimento"; }
    if(!existing && !group) mountKindSwitch(node,"tx",()=>({name:nameInput.value.trim(),amount:parseAmount(amountInput.value),type:txType,categoryId:txType==="transfer"?null:selectedCategoryId,accountId:loanAccount(selectedAccountId)?null:selectedAccountId,note:noteInput.value.trim(),date:dateInput.value}));
    const shared=mountSharedExpense(node, accChips.closest(".field-row"), {type:()=>txType, amount:()=>parseAmount(amountInput.value), group});
    // v1.25.0 — "Pagata da un'altra persona" (esclude "Spesa divisa o prestito")
    const accRow=accChips.closest(".field-row");
    if(existing?.otherPaid){ amountInput.value=String(existing.otherPaid.total||existing.amount).replace(".",","); autoGrowAmountInput(amountInput); }
    const other=mountOtherPaid(node, shared && node.querySelector(".shared-field") || accRow, {type:()=>txType, amount:()=>parseAmount(amountInput.value), existing, preset,
      onChange:inf=>{
        accRow.hidden=inf.on;
        if(inf.on){ shared.setOff(); node.querySelector(".shared-field:not(.other-paid-field)")?.setAttribute("hidden",""); }
        else { node.querySelector(".shared-field:not(.other-paid-field)")?.removeAttribute("hidden"); shared.refresh(); }
        // v1.25.1: categoria e macrocategoria restano libere (chi ha pagato è solo contabilità)
      }});

    node.querySelector("#saveTxBtn").addEventListener("click", ()=>{
      const amount = parseAmount(amountInput.value);
      const sharedInfo=shared.get();
      if(sharedInfo.want && !sharedInfo.persons.length){ showToast("Scegli o scrivi con chi dividi la spesa"); return; }
      const transfer=txType==="transfer";
      const otherInfo=other.get();
      if(otherInfo.on && !otherInfo.person){ showToast("Scrivi chi ha pagato"); return; }
      const missing=[]; if(!transfer&&!nameInput.value.trim()) missing.push("nome"); if(amount<=0) missing.push("importo"); if(!transfer&&!selectedCategoryId&&!(sharedInfo.on&&sharedInfo.pct===0)) missing.push("categoria"); if((!selectedAccountId||loanAccount(selectedAccountId))&&!otherInfo.on&&!sharedInfo.on&&!group) missing.push("conto"); if(transfer&&!destinationAccountId) missing.push("conto destinazione"); if(!dateInput.value) missing.push("data");
      if(missing.length){showToast("Inserisci: "+missing.join(", "));if(amount<=0) amountInput.focus();return;}
      if(dateInput.value > todayISO()){
        showToast("Per una data futura usa un movimento Pianificato");
        dateInput.focus();
        return;
      }
      /* v1.70.0 — stima scelta (solo uscite, solo una stima del mese della data) */
      const estPickObj=txType==="expense"&&selEst?estById(selEst):null;
      const estPick=estPickObj&&estPickObj.month===String(dateInput.value).slice(0,7)?estPickObj.id:null;
      const setEst=x=>{ if(!x) return; if(estPick&&x.type==="expense") x.estimateId=estPick; else delete x.estimateId; };

      if(!transfer && txType==="expense" && otherInfo.on && !group){
        // Spesa pagata da un altro: la mia parte esce dal suo conto "Da pagare" (debito), non dai miei conti.
        const la=ensureLoanAccount(otherInfo.person,"pay");
        const mine=round2(amount*otherInfo.pct/100);
        const t=existing||{id:uid()};
        Object.assign(t,{date:dateInput.value,amount:mine,type:"expense",name:nameInput.value.trim(),categoryId:selectedCategoryId,accountId:la.id,toAccountId:null,note:noteInput.value.trim(),otherPaid:{person:la.person,total:amount,pct:otherInfo.pct}});
        setEst(t);
        if(!editing) state.transactions.push(t);
        state.lastOtherPayer=la.person;
        balanceCache.clear(); persist();
        const d=new Date(t.date+"T00:00:00"); viewYear=d.getFullYear(); viewMonth=d.getMonth();
        renderAll(); close();
        showToast(`Spesa registrata: devi ${balancesHidden?"••••":fmt(mine)} a ${la.person}`);
        setTimeout(()=>budgetAlertFor(t),1800);
        return;
      }
      if(existing?.otherPaid && !otherInfo.on){ delete existing.otherPaid; }
      if(!transfer && txType==="expense" && (group || sharedInfo.on)){
        const saved=saveSharedGroup({group,total:amount,shared:sharedInfo,fields:{date:dateInput.value,name:nameInput.value.trim(),categoryId:selectedCategoryId,accountId:selectedAccountId,note:noteInput.value.trim()}});
        if(saved&&saved.type==="expense") setEst(saved); /* v1.70.0 — la mia parte */
        persist();
        const sd=new Date(saved.date+"T00:00:00"); viewYear=sd.getFullYear(); viewMonth=sd.getMonth();
        renderAll(); close(); return;
      }
      const t = existing || {id:uid()};
      t.date=dateInput.value; t.amount=amount; t.type=txType;
      t.name=transfer?transferName(selectedAccountId,destinationAccountId):nameInput.value.trim(); t.categoryId=transfer?null:selectedCategoryId; t.accountId=selectedAccountId; t.toAccountId=transfer?destinationAccountId:null; t.note=noteInput.value.trim();
      setEst(t);
      if(!editing) state.transactions.push(t);
      persist();
      const d = new Date(t.date+"T00:00:00");
      viewYear = d.getFullYear(); viewMonth = d.getMonth();
      renderAll();
      close();
      if(t.type==="expense") setTimeout(()=>budgetAlertFor(t),350);
    });
  });
}
/* v1.23.0 — Categoria suggerita dal nome: prima i tuoi movimenti con lo stesso nome (o la stessa
   prima parola), poi parole note (Esselunga → Spesa, Enel → Bollette…) abbinate alle tue categorie. */
const CAT_KEYWORDS=[
  [/esselunga|coop\b|conad|lidl|carrefour|eurospin|pam\b|aldi|penny|supermerc|iper\b|naturasi|spesa/i,["spesa","alimentari","supermercato"]],
  [/eni\b|q8|ip\b|tamoil|esso|benzina|carburante|diesel|autostrad|telepass|atm\b|trenitalia|italo|treno|metro|taxi|uber|parcheggio|bollo auto/i,["trasporti","auto","carburante","benzina"]],
  [/enel|a2a|edison|iren|hera|luce|gas\b|acqua|bolletta|fastweb|tim\b|vodafone|iliad|windtre|internet|fibra/i,["bollette","utenze","casa"]],
  [/farmacia|medic|dentist|visita|ticket|ospedal|analisi|ottico/i,["salute","farmacia","medico"]],
  [/netflix|spotify|disney|prime video|dazn|cinema|teatro|concerto|ristorant|pizzeria|bar\b|pub\b|aperitivo|sushi|cena|pranzo/i,["svago","ristoranti","tempo libero","abbonamenti"]],
  [/affitto|condominio|mutuo|ikea|leroy|brico|arredo/i,["casa","affitto","affitto / mutuo"]],
  [/stipendio|busta paga|salario/i,["stipendio"]],
  [/zara|h&m|decathlon|scarpe|abbigliamento|vestit/i,["abbigliamento","shopping"]],
];
function suggestCategoryFor(name,kind){
  const raw=String(name||"").trim().toLowerCase(); if(raw.length<3) return null;
  const cats=state.categories.filter(c=>c.kind===kind), ok=new Set(cats.map(c=>c.id));
  const count=filter=>{ const m=new Map(); state.transactions.forEach(t=>{ if(t.type!==kind||!ok.has(t.categoryId)||!filter(String(t.name||"").trim().toLowerCase())) return; m.set(t.categoryId,(m.get(t.categoryId)||0)+1); }); let best=null,n=0; m.forEach((v,k)=>{ if(v>n){n=v;best=k;} }); return best; };
  const exact=count(n=>n===raw); if(exact) return exact;
  const first=raw.split(/\s+/)[0];
  if(first.length>=4){ const byWord=count(n=>n.split(/\s+/)[0]===first); if(byWord) return byWord; }
  for(const [re,names] of CAT_KEYWORDS){ if(!re.test(raw)) continue; for(const nm of names){ const c=cats.find(c=>c.name.toLowerCase()===nm)||cats.find(c=>c.name.toLowerCase().includes(nm)); if(c) return c.id; } }
  return null;
}
/* v1.23.0 — Avviso budget: dopo una spesa, se la sua categoria arriva all'80% o supera il budget del mese. */
function budgetAlertFor(t){
  const c=categoriesById()[t.categoryId]; if(!c||!(Number(c.budget)>0)) return;
  const ym=String(t.date).slice(0,7);
  const spent=state.transactions.filter(x=>x.type==="expense"&&x.categoryId===c.id&&String(x.date).startsWith(ym)&&!x.isBalanceAdjustment).reduce((s,x)=>s+x.amount,0);
  const before=spent-t.amount, b=Number(c.budget), pct=Math.round(spent/b*100);
  const amt=v=>balancesHidden?"••••":fmt(v);
  if(spent>b && before<=b) showToast(`⚠️ Budget ${c.emoji||""} ${c.name} superato: ${amt(spent)} su ${amt(b)} (${pct}%)`);
  else if(spent>b) showToast(`⚠️ ${c.emoji||""} ${c.name}: ${amt(spent)} su ${amt(b)} di budget (${pct}%)`);
  else if(spent>=b*0.8 && before<b*0.8) showToast(`🟡 ${c.emoji||""} ${c.name} all'${pct}% del budget: restano ${amt(b-spent)}`);
}
/* v1.10.7 — Il "+" apre sempre la stessa scelta, in tutte le sezioni tranne Altro. */
function openAddChoice(){
  /* v1.69.0 — PANNELLO DEL "+" RIFATTO: in alto le due cose che fai di più, Uscita ed Entrata (aprono il Movimento già
     sul tipo giusto); sotto un elenco ordinato, una riga per cosa, con icona e due parole: Trasferimento, Ricorrente o
     pianificato, Prelievo ATM, Prestito o restituzione, Stima del mese. Si chiude con ✕, toccando fuori o trascinando giù. */
  // Nella scheda Stime il "+" aggiunge direttamente una stima.
  if(activeView==="estimates"){ openEstimateForm(null); return; }
  document.getElementById("movementActionOverlay")?.remove();
  const overlay=document.createElement("div");
  overlay.id="movementActionOverlay";
  overlay.className="movement-action-overlay add2-overlay";
  const row=(kind,ic,title,sub,cls)=>`<button type="button" class="add2-row ${cls||""}" data-add-kind="${kind}" data-no-icon><span class="add2-ric" aria-hidden="true">${ic}</span><span class="add2-rt"><b>${title}</b><small>${sub}</small></span><span class="add2-chev" aria-hidden="true">›</span></button>`;
  overlay.innerHTML=`
    <div class="movement-action-menu add2" role="dialog" aria-modal="true" aria-label="Cosa vuoi aggiungere">
      <div class="movement-action-handle" aria-hidden="true"></div>
      <div class="add2-head"><p class="add2-title">Aggiungi</p><button type="button" class="add2-x" data-add-close data-no-icon aria-label="Chiudi">✕</button></div>
      <div class="add2-main">
        <button type="button" class="add2-big out" data-add-kind="out" data-no-icon><span class="add2-bi" aria-hidden="true">−</span><b>Uscita</b><small>una spesa</small></button>
        <button type="button" class="add2-big in" data-add-kind="in" data-no-icon><span class="add2-bi" aria-hidden="true">+</span><b>Entrata</b><small>soldi in arrivo</small></button>
      </div>
      <div class="add2-list">
        ${row("transfer","↔","Trasferimento","tra i tuoi conti","tr")}
        ${row("rec","🔁","Ricorrente o pianificato","si ripete, o arriverà più avanti","rc")}
        ${row("atm","🏧","Prelievo ATM","dalla carta ai contanti","atm")}
        ${row("repay","🤝","Prestito o restituzione","soldi prestati, debiti, rimborsi","lo")}
        ${row("estimate","🎯","Stima del mese","quanto pensi di spendere","es")}
      </div>
    </div>`;
  const close=()=>overlay.remove();
  const go=fn=>()=>{overlay.remove();fn();};
  overlay.querySelector('[data-add-kind="out"]').addEventListener("click",go(()=>openAddTransaction(null,{type:"expense"})));
  overlay.querySelector('[data-add-kind="in"]').addEventListener("click",go(()=>openAddTransaction(null,{type:"income"})));
  overlay.querySelector('[data-add-kind="transfer"]').addEventListener("click",go(()=>openTransferForm()));
  overlay.querySelector('[data-add-kind="rec"]').addEventListener("click",go(()=>openRecurringForm(null)));
  overlay.querySelector('[data-add-kind="atm"]').addEventListener("click",go(()=>openAtmWithdrawal()));
  overlay.querySelector('[data-add-kind="repay"]').addEventListener("click",go(()=>openLoanForm(null,{mode:"lend"})));
  overlay.querySelector('[data-add-kind="estimate"]').addEventListener("click",go(()=>openEstimateForm(null)));
  overlay.querySelector("[data-add-close]").addEventListener("click",close);
  overlay.addEventListener("click",e=>{if(e.target===overlay) close();});
  document.body.appendChild(overlay);
  bindOverlaySwipeDismiss(overlay);
  requestAnimationFrame(()=>overlay.classList.add("show"));
}
/* v1.10.7 — Prelievo ATM: trasferimento da una carta/conto ai contanti, con commissione facoltativa
   registrata come uscita sulla carta (categoria "Costi bancari"/"Commissioni", creata se manca). */
function feeCategoryId(){
  let c=state.categories.find(c=>c.kind==="expense"&&/costi bancari|commission/i.test(c.name));
  if(!c){c={id:uid(),name:"Commissioni bancarie",emoji:"🏧",color:"#4FA8C9",kind:"expense",budget:null,macroCategoryId:(state.macroCategories.find(m=>/abbonament|banc/i.test(m.name)&&m.kind!=="income")||{}).id||null};state.categories.push(c);}
  return c.id;
}
/* v1.10.8 — Il prelievo si può anche modificare: si apre con i dati salvati (commissione compresa). */
function openAtmWithdrawal(txId=null){
  const existing=txId?state.transactions.find(t=>t.id===txId&&t.type==="transfer"):null;
  const existingFee=existing?.atmGroup?state.transactions.find(t=>t.atmGroup===existing.atmGroup&&t.type==="expense"):null;
  const cash=state.accounts.find(a=>/contant|cash/i.test(a.name));
  let fromId=existing?.accountId||state.accounts.find(a=>a.id===state.mainAccountId&&a.id!==cash?.id)?.id||state.accounts.find(a=>a.id!==cash?.id)?.id||null;
  let toId=existing?.toAccountId||cash?.id||null;
  openSheet("tpl-atm-withdrawal",(node,close)=>{
    const amountInput=node.querySelector("#atmAmountInput"), feeInput=node.querySelector("#atmFeeInput"), dateInput=node.querySelector("#atmDateInput"), noteInput=node.querySelector("#atmNoteInput");
    const fromChips=node.querySelector("#atmFromChips"), toChips=node.querySelector("#atmToChips"), total=node.querySelector("#atmTotal");
    dateInput.value=existing?.date||todayISO();
    dateInput.max=todayISO();
    if(existing){
      
      amountInput.value=String(existing.amount).replace(".",",");
      feeInput.value=existingFee?String(existingFee.amount).replace(".",","):"";
      noteInput.value=existing.note&&existing.note!=="Prelievo ATM"?existing.note:"";
    }
    if(typeof autoGrowAmountInput==="function") autoGrowAmountInput(amountInput);
    const chips=(wrap,getSel,setSel,exclude)=>{
      wrap.innerHTML="";
      state.accounts.filter(a=>a.id!==exclude&&!isLoanAccount(a)).forEach(a=>{
        const b=document.createElement("button");b.type="button";b.className="chip"+(getSel()===a.id?" active":"");
        b.innerHTML=`<span class="em">●</span>${escapeHtml(a.name)}`;b.querySelector(".em").style.color=safeColor(a.color);
        b.addEventListener("click",()=>{setSel(a.id);paint();});wrap.appendChild(b);
      });
    };
    const paint=()=>{
      if(toId===fromId) toId=state.accounts.find(a=>a.id!==fromId&&/contant|cash/i.test(a.name))?.id||null;
      chips(fromChips,()=>fromId,v=>{fromId=v;},null);
      chips(toChips,()=>toId,v=>{toId=v;},fromId);
      const amt=parseAmount(amountInput.value), fee=parseAmount(feeInput.value);
      total.textContent=amt>0?`Dalla carta escono ${fmt(amt+fee)}${fee>0?` (${fmt(amt)} prelievo + ${fmt(fee)} commissione)`:""}`:"";
    };
    amountInput.addEventListener("input",paint);feeInput.addEventListener("input",paint);
    node.querySelector("#saveAtmBtn").addEventListener("click",()=>{
      const amt=parseAmount(amountInput.value), fee=parseAmount(feeInput.value);
      if(!(amt>0)){showToast("Inserisci l'importo prelevato");amountInput.focus();return;}
      if(!fromId||!toId||fromId===toId){showToast("Scegli la carta e il conto contanti");return;}
      const date=dateInput.value||todayISO();
      if(date>todayISO()){showToast("Un prelievo non può avere una data futura");dateInput.focus();return;}
      const group=existing?.atmGroup||uid();
      const t=existing||{id:uid()};
      Object.assign(t,{date,amount:amt,type:"transfer",name:transferName(fromId,toId),categoryId:null,accountId:fromId,toAccountId:toId,note:noteInput.value.trim()||"Prelievo ATM",atm:true,atmGroup:group});
      if(!existing) state.transactions.push(t);
      if(fee>0){
        if(existingFee) Object.assign(existingFee,{date,amount:fee,accountId:fromId});
        else state.transactions.push({id:uid(),date,amount:fee,type:"expense",name:"Commissione prelievo ATM",categoryId:feeCategoryId(),accountId:fromId,toAccountId:null,note:"",atmGroup:group});
      } else if(existingFee){
        state.transactions=state.transactions.filter(x=>x.id!==existingFee.id);
      }
      persist();renderAll();close();
      showToast(existing?"Prelievo aggiornato":fee>0?`Prelievo di ${fmt(amt)} + commissione ${fmt(fee)} registrati`:`Prelievo di ${fmt(amt)} registrato`);
    });
    paint();
  });
}
/* v1.10.8 — Trasferimento come sezione a sé dal "+": stesso stile del Prelievo ATM.
   Resta un movimento reale di tipo "transfer" (compare nei Movimenti recenti). */
function openTransferForm(txId=null,preset=null){
  const existing=txId?state.transactions.find(t=>t.id===txId&&t.type==="transfer"):null;
  let fromId=existing?.accountId||preset?.fromId||state.accounts.find(a=>a.id===state.mainAccountId)?.id||state.accounts[0]?.id||null;
  let toId=existing?.toAccountId||preset?.toId||null;
  openSheet("tpl-transfer",(node,close)=>{
    const amountInput=node.querySelector("#transferAmountInput"), dateInput=node.querySelector("#transferDateInput"), noteInput=node.querySelector("#transferNoteInput");
    const fromChips=node.querySelector("#transferFromChips"), toChips=node.querySelector("#transferToChips"), summary=node.querySelector("#transferSummary");
    const today=new Date(), inViewedMonth=today.getFullYear()===viewYear&&today.getMonth()===viewMonth;
    dateInput.value=existing?.date||(periodModes.home==="day"?selectedDate():inViewedMonth?todayISO():`${viewYear}-${pad2(viewMonth+1)}-01`);
    dateInput.max=todayISO();
    if(existing){
      
      amountInput.value=String(existing.amount).replace(".",",");
      noteInput.value=existing.note||"";
    } else if(preset){
      if(preset.amount>0) amountInput.value=String(Math.round(preset.amount*100)/100).replace(".",",");
      if(preset.title){ node.querySelector("#transferFormTitle").textContent=preset.title; noteInput.value=preset.title; dateInput.value=todayISO(); }
    }
    autoGrowAmountInput(amountInput);
    const chips=(wrap,getSel,setSel,exclude)=>{
      wrap.innerHTML="";
      state.accounts.filter(a=>a.id!==exclude&&!isLoanAccount(a)).forEach(a=>{
        const b=document.createElement("button");b.type="button";b.className="chip"+(getSel()===a.id?" active":"");
        b.innerHTML=`<span class="em">●</span>${escapeHtml(a.name)}`;b.querySelector(".em").style.color=safeColor(a.color);
        b.addEventListener("click",()=>{setSel(a.id);paint();});wrap.appendChild(b);
      });
    };
    /* v1.67.0 — interruttore "Deposito di risparmio": compare quando il conto di arrivo è il conto risparmio
       (o con nessun conto risparmio impostato, o se il movimento era già contrassegnato). Di base è SPENTO. */
    let savingsOn=existing?existing.savingsDeposit===true:!!preset?.savingsDeposit;
    const svSw=node.querySelector("#transferSavingsSwitch");
    const paintSavings=()=>{
      if(!svSw) return;
      const sid=state.savingsAccountId;
      svSw.hidden=!(toId&&(savingsOn||!sid||toId===sid));
      svSw.classList.toggle("on",savingsOn); svSw.setAttribute("aria-pressed",String(savingsOn));
      svSw.querySelector("small").textContent=savingsOn?"Acceso: conta nel risparmio del mese":"Spento: è solo un giroconto, non conta nel risparmio del mese";
    };
    svSw?.addEventListener("click",()=>{ savingsOn=!savingsOn; paintSavings(); });
    const paint=()=>{
      if(toId===fromId) toId=null;
      chips(fromChips,()=>fromId,v=>{fromId=v;},null);
      chips(toChips,()=>toId,v=>{toId=v;},fromId);
      const amt=parseAmount(amountInput.value);
      summary.textContent=amt>0&&fromId&&toId?`${transferName(fromId,toId)} · ${fmt(amt)}`:"";
      paintSavings();
    };
    amountInput.addEventListener("input",paint);
    const del=node.querySelector("#deleteTransferBtn");
    if(existing){
      del.hidden=false;
      del.addEventListener("click",async()=>{
        if(!await askConfirm("Eliminare questo trasferimento?",{ok:"Elimina",danger:true})) return;
        moveToTrash("transaction",existing); const deleted=state.trash[0]?.id;
        state.transactions=state.transactions.filter(x=>x.id!==existing.id);
        persist();renderAll();close();if(deleted) showUndo("Trasferimento eliminato",deleted);
      });
    }
    node.querySelector("#saveTransferBtn").addEventListener("click",()=>{
      const amount=parseAmount(amountInput.value);
      const missing=[]; if(amount<=0) missing.push("importo"); if(!fromId) missing.push("conto di partenza"); if(!toId) missing.push("conto destinazione"); if(!dateInput.value) missing.push("data");
      if(missing.length){showToast("Inserisci: "+missing.join(", "));if(amount<=0) amountInput.focus();return;}
      if(dateInput.value>todayISO()){showToast("Un trasferimento non può avere una data futura");dateInput.focus();return;}
      const t=existing||{id:uid()};
      Object.assign(t,{date:dateInput.value,amount,type:"transfer",name:transferName(fromId,toId),categoryId:null,accountId:fromId,toAccountId:toId,note:noteInput.value.trim()});
      if(savingsOn) t.savingsDeposit=true; else delete t.savingsDeposit; /* v1.67.0 */
      if(!existing) state.transactions.push(t);
      persist();
      const d=new Date(t.date+"T00:00:00"); viewYear=d.getFullYear(); viewMonth=d.getMonth();
      renderAll();close();
      showToast(savingsOn?(existing?"Deposito di risparmio aggiornato":"Deposito di risparmio registrato"):existing?"Trasferimento aggiornato":"Trasferimento registrato");
    });
    paint();
  });
}
/* v1.58.0 — il "+" si nasconde mentre scorri verso il basso e torna quando risali. */
(function(){
  const fab=document.getElementById("fabAdd"); if(!fab) return;
  let last=window.scrollY||0, busy=false;
  window.addEventListener("scroll",()=>{
    if(busy) return; busy=true;
    requestAnimationFrame(()=>{
      const y=window.scrollY||0, d=y-last;
      if(Math.abs(d)>6){ fab.classList.toggle("is-tucked", d>0 && y>120); last=y; }
      busy=false;
    });
  },{passive:true});
})();
document.getElementById("fabAdd").addEventListener("click", e=>{
  e.preventDefault();e.stopPropagation();
  openAddChoice();
});
document.getElementById("toggleHomeBalance").addEventListener("click",toggleBalances);
document.getElementById("toggleAccountsBalance").addEventListener("click",toggleBalances);
document.getElementById("toggleRPBalance")?.addEventListener("click",toggleBalances);
/* v1.29.0 — Un solo occhio, fermo in alto a destra in tutte le schede. Quelli dentro le
   schede restano nel codice (li usano altre funzioni) ma non si vedono più. */
document.getElementById("toggleBalanceFixed")?.addEventListener("click",toggleBalances);

function openTrash(){
  openSheet("tpl-trash", (node)=>{
    const list=node.querySelector("#trashList"), empty=node.querySelector("#trashEmptyHint");
    const labels={transaction:"Movimento",recurring:"Ricorrente",planned:"Pianificata"};
    (state.trash||[]).forEach(entry=>{
      const d=entry.data, row=document.createElement("div"); row.className="template-manage-row";
      row.innerHTML=`<span class="ic">🗑️</span><span class="info"><p class="nm">${labels[entry.kind]}</p><p class="sub">${escapeHtml(d.name || categoriesById()[d.categoryId]?.name || "Elemento eliminato")}</p></span><button class="pill-btn trash-restore">Ripristina</button>`;
      row.querySelector(".trash-restore").addEventListener("click",()=>restoreTrashItem(entry.id)); list.appendChild(row);
    });
    empty.hidden=list.children.length>0;
  });
}
document.getElementById("openTrashBtn").addEventListener("click",openTrash);

/* ---------------- Transaction detail sheet ---------------- */
function openTxDetail(txId){
  const t = state.transactions.find(x=>x.id===txId);
  if(!t) return;
  openSheet("tpl-tx-detail", (node, close)=>{
    const transfer=t.type==="transfer";
    const cat = transfer ? {name:"Trasferimento",emoji:"↔"} : (t.loanOffset ? {name:"Compensazione crediti/debiti",emoji:"⚖️"} : t.loanWriteOff ? {name:"Abbuono (prestito chiuso)",emoji:"✅"} : t.loanOld ? {name:loanAccount(t.accountId)?.receivable?"Prestito vecchio (fuori saldo)":"Debito vecchio (fuori saldo)",emoji:"🤝"} : t.isBalanceAdjustment ? {name:"Rettifica saldo",emoji:"⚖️"} : (categoriesById()[t.categoryId] || { name:"Categoria eliminata", emoji:"❔" }));
    const acc = accountsById()[t.accountId] || { name:"Conto eliminato" };
    const destination=accountsById()[t.toAccountId] || {name:"Conto eliminato"};
    node.querySelector("#txDetailBody").innerHTML = `
      <div class="tx-detail-row"><span class="k">Importo</span><span class="v ${t.type}">${transfer?"↔":t.type==="income"?"+":"−"}${fmt(t.amount)}</span></div>
      ${transfer?`<div class="tx-detail-row"><span class="k">Da conto</span><span class="v">${escapeHtml(acc.name)}</span></div><div class="tx-detail-row"><span class="k">A conto</span><span class="v">${escapeHtml(destination.name)}</span></div>${loanAccount(t.accountId)||loanAccount(t.toAccountId)||t.atm?"":`<div class="tx-detail-row"><span class="k">Risparmio</span><span class="v">${isSavingsDeposit(t)?"🐷 Deposito di risparmio (conta nel mese)":"No · solo giroconto"}</span></div>`}`:`<div class="tx-detail-row"><span class="k">Categoria</span><span class="v">${escapeHtml(cat.emoji)} ${escapeHtml(cat.name)}</span></div><div class="tx-detail-row"><span class="k">Conto</span><span class="v">${escapeHtml(acc.name)}</span></div>`}
      <div class="tx-detail-row"><span class="k">Data</span><span class="v">${t.date.split("-").reverse().join("/")}</span></div>
      ${t.recurringId?`<div class="tx-detail-row"><span class="k">Origine</span><span class="v">Movimento ricorrente</span></div>`:t.plannedId?`<div class="tx-detail-row"><span class="k">Origine</span><span class="v">Movimento pianificato</span></div>`:""}
      ${t.note?`<div class="tx-detail-row"><span class="k">Nota</span><span class="v">${escapeHtml(t.note)}</span></div>`:""}
    `;
    // Il tap singolo mostra solo il riepilogo. Modifica/Duplica/Elimina restano nel menu da pressione prolungata.
    node.querySelector(".detail-actions")?.remove();
    node.querySelector("#deleteTxBtn")?.remove();
    mountTxEstimateBox(node.querySelector("#txDetailBody"),t); /* v1.70.0 — 🎯 un tocco: dentro o fuori da una stima */
  });
}

function openScheduledDetail(kind, id, occurrenceDate){
  const item = kind==="recurring" ? state.recurring.find(x=>x.id===id) : state.planned.find(x=>x.id===id);
  if(!item) return;
  openSheet("tpl-scheduled-detail", (node, close)=>{
    const cat = categoriesById()[item.categoryId] || { name:"Categoria eliminata", emoji:"❔" };
    const acc = accountsById()[item.accountId] || { name:"Conto eliminato" };
    const date = occurrenceDate || item.nextDate || item.date;
    node.querySelector("#scheduledDetailTitle").textContent = kind==="recurring" ? "Dettaglio ricorrente" : "Dettaglio pianificata";
    node.querySelector("#scheduledDetailBody").innerHTML = `
      <div class="tx-detail-row"><span class="k">Stato</span><span class="v"><span class="status-badge ${kind}">${kind==="recurring"?(item.active===false?"Sospesa":"Ricorrente attiva"):"Pianificata"}</span></span></div>
      <div class="tx-detail-row"><span class="k">${myAmount(item)!==item.amount?"Totale":"Importo"}</span><span class="v ${item.type}">${item.type==="income"?"+":"−"}${fmt(item.amount)}</span></div>
      ${myAmount(item)!==item.amount?`<div class="tx-detail-row"><span class="k">La tua parte</span><span class="v ${item.type}">−${fmt(myAmount(item))}</span></div><div class="tx-detail-row"><span class="k">Divisa con</span><span class="v">${escapeHtml((item.split.persons||[]).join(", "))}</span></div>`:""}
      <div class="tx-detail-row"><span class="k">Categoria</span><span class="v">${escapeHtml(cat.emoji)} ${escapeHtml(cat.name)}</span></div>
      <div class="tx-detail-row"><span class="k">Carta destinataria</span><span class="v">${escapeHtml(acc.name)}</span></div>
      <div class="tx-detail-row"><span class="k">${kind==="recurring"?"Prossima data":"Data"}</span><span class="v">${date ? date.split("-").reverse().join("/") : "—"}</span></div>
      ${kind==="recurring"?`<div class="tx-detail-row"><span class="k">Frequenza</span><span class="v">${FREQ_LABEL[item.freq]||"—"}</span></div><div class="tx-detail-row"><span class="k">Durata</span><span class="v">${recurringDurationLabel(item)}</span></div>`:""}
      ${item.note?`<div class="tx-detail-row"><span class="k">Nota</span><span class="v">${escapeHtml(item.note)}</span></div>`:""}
    `;
    // Il tap singolo mostra solo il riepilogo. Le azioni sono disponibili con pressione prolungata.
    node.querySelector(".detail-actions")?.remove();
    node.querySelector("#deleteScheduledBtn")?.remove();
  });
}

/* ---------------- Evoluzione saldo conto ---------------- */
function buildLineSVG(data, color){
  const w=320, h=150, padL=6, padB=22, padT=14;
  const vals = data.map(d=>d.balance);
  const min = Math.min(0, ...vals);
  const max = Math.max(1, ...vals);
  const range = (max-min) || 1;
  const stepX = data.length>1 ? (w-padL*2)/(data.length-1) : 0;
  const points = data.map((d,i)=>{
    const x = padL + i*stepX;
    const y = padT + (h-padT-padB) - ((d.balance-min)/range)*(h-padT-padB);
    return {x,y};
  });
  const path = points.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const step = Math.max(1, Math.ceil(data.length/6));
  let labels = "";
  data.forEach((d,i)=>{
    if(i%step===0 || i===data.length-1){
      labels += `<text x="${points[i].x.toFixed(1)}" y="${h-6}" text-anchor="middle" font-size="9" fill="var(--ink-soft)" font-family="system-ui">${d.label}</text>`;
    }
  });
  const dots = points.map((p,i)=>`<circle class="chart-point" data-point-index="${i}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.2" fill="#E8A33D" stroke="var(--paper)" stroke-width="1.5"><title>${data[i].label}: ${maskAmt(fmt(data[i].balance))}</title></circle>`).join("");
  const zeroY = (padT + (h-padT-padB) - ((0-min)/range)*(h-padT-padB)).toFixed(1);
  return `<svg class="chart money-line" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <line x1="${padL}" y1="${zeroY}" x2="${w-padL}" y2="${zeroY}" stroke="var(--line)" stroke-width="1" stroke-dasharray="3 5"/>
    <polyline points="${path}" fill="none" stroke="${color || "var(--ink)"}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}${labels}
  </svg>`;
}

function pointDetail(d){
  const day=d.date?d.date.split("-").reverse().join("/"):d.label;
  const delta=(d.income||0)-(d.expense||0);
  if(balancesHidden) return `<strong>${day}</strong><span>Saldo: ••••</span><span>Variazione: ••••</span>`;
  return `<strong>${day}</strong><span>Saldo: ${fmt(d.balance)}</span><span class="${delta<0?"neg":"pos"}">${delta===0?"Nessuna variazione":`${delta>0?"+":"−"}${fmt(Math.abs(delta))} nel giorno`}</span>`;
}
function setupLineChart(wrap,data){
  if(!wrap) return;
  wrap._chartData=data;
  let tip=wrap.querySelector(".chart-tooltip");
  if(!tip){tip=document.createElement("div");tip.className="chart-tooltip";wrap.appendChild(tip);}
  const show=i=>{const d=data[i];if(!d)return;tip.innerHTML=pointDetail(d);tip.classList.add("show");};
  wrap.querySelectorAll(".chart-point").forEach(p=>{
    const i=Number(p.dataset.pointIndex);
    p.addEventListener("pointerdown",e=>{e.stopPropagation();show(i);p.setPointerCapture?.(e.pointerId);});
    p.addEventListener("pointerenter",()=>show(i));
  });
  wrap.onpointermove=e=>{if(!e.buttons)return;const points=[...wrap.querySelectorAll(".chart-point")];if(!points.length)return;let best=0,bestDist=Infinity;points.forEach((p,i)=>{const r=p.getBoundingClientRect(),d=Math.abs(e.clientX-(r.left+r.width/2));if(d<bestDist){best=i;bestDist=d;}});show(best);};
  wrap._chartHelp="Tieni premuto un punto: vedi saldo e variazione della giornata.";
  makeChartExpandable(wrap,"Saldo cumulato",wrap._chartHelp,data);
}
function makeChartExpandable(wrap,title,help,data){
  if(!wrap)return;
  wrap.tabIndex=0;wrap.setAttribute("role","button");wrap.setAttribute("aria-label",`Ingrandisci ${title}`);
  wrap.onclick=e=>{if(e.target.closest(".chart-point"))return;openChartFullscreen(title,help,wrap.querySelector("svg"),data);};
  wrap.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openChartFullscreen(title,help,wrap.querySelector("svg"),data);}};
}
function openChartFullscreen(title,help,svg,data){
  if(!svg)return;
  openSheet("tpl-chart-fullscreen",node=>{
    node.querySelector("#chartFullscreenTitle").textContent=title;
    node.querySelector("#chartFullscreenHelp").textContent=help||"Tocca il grafico per il dettaglio.";
    const body=node.querySelector("#chartFullscreenBody"), clone=svg.cloneNode(true);body.appendChild(clone);
    if(data) setupLineChart(body,data);
  });
}
function openChartInfo(kind){
  const text={
    ripartizione:"Mostra come entrate o uscite del periodo selezionato sono distribuite fra categorie o macrocategorie. Non considera i trasferimenti fra conti.",
    andamento:"Entrate/Uscite mostra i flussi del periodo. Saldo cumulato mostra il saldo reale, partendo dal saldo presente prima dell’inizio del periodo. Tieni premuto un punto per leggere il giorno.",
    conti:"Mostra la variazione netta di ciascun conto nel periodo scelto. I trasferimenti compaiono come uscita nel conto di origine e entrata in quello di destinazione."
  }[kind]||"";
  openSheet("tpl-chart-fullscreen",node=>{node.querySelector("#chartFullscreenTitle").textContent="Come leggere il grafico";node.querySelector("#chartFullscreenHelp").hidden=true;node.querySelector("#chartFullscreenBody").innerHTML=`<div class="chart-info-card">${escapeHtml(text)}</div>`;});
}

function isoAddDays(iso,n){const d=new Date(iso+"T12:00:00");d.setDate(d.getDate()+n);return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;}
function isoDiffDays(a,b){return Math.round((new Date(b+"T12:00:00")-new Date(a+"T12:00:00"))/864e5);}
function evolutionRangeDates(range,custom){
  // v1.10.2: "ultimi N mesi" finiscono oggi; "Periodo" usa le date scelte nel calendario.
  const today=todayISO();
  if(range==="custom"&&custom) return {from:custom.from,to:custom.to};
  const n={"1m":1,"2m":2,"3m":3,"6":6,"12":12,"24":24}[range]||12;
  const d=new Date(today+"T12:00:00");d.setMonth(d.getMonth()-n);
  return {from:isoAddDays(`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`,1),to:today};
}
function evolutionSeries(accountId,from,to){
  const days=Math.max(0,isoDiffDays(from,to));
  const step=days<=92?1:days<=430?7:15;
  const out=[];
  const point=iso=>{const d=new Date(iso+"T12:00:00");const m=d.getMonth();
    return {date:iso,label:days>430?`${MESI_BREVI[m]} ${String(d.getFullYear()).slice(2)}`:`${d.getDate()} ${MESI_BREVI[m].toLowerCase()}`,full:`${d.getDate()} ${MESI[m].toLowerCase()} ${d.getFullYear()}`,balance:accountBalanceAtDate(accountId,iso)};};
  for(let i=0;i<=days;i+=step) out.push(point(isoAddDays(from,i)));
  if(!out.length||out[out.length-1].date!==to) out.push(point(to));
  return out;
}
function renderAccountEvolution(node, accountId, range, custom){
  const acc = state.accounts.find(a=>a.id===accountId);
  if(!acc) return;
  const {from,to}=evolutionRangeDates(range,custom);
  const data=evolutionSeries(accountId,from,to);
  const wrap=node.querySelector("#accountEvolutionChartWrap");
  // v1.10.1: la variazione parte da quando hai registrato il saldo reale del conto (prima rettifica manuale del saldo),
  // non dallo zero precedente. Se quella data è prima dell'inizio del periodo, si parte dall'inizio del periodo.
  const anchorDay = realBalanceDate(accountId);
  const startDay = data[0].date;
  let base = data[0].balance, sinceText = null, anchorIndex = -1;
  if(anchorDay && anchorDay > startDay){
    base = accountBalanceAtDate(accountId, anchorDay);
    anchorIndex = data.findIndex(d=>d.date>=anchorDay);
    const dt=new Date(anchorDay+"T12:00:00");
    sinceText = `dal ${dt.getDate()} ${MESI_BREVI[dt.getMonth()].toLowerCase()}${dt.getFullYear()!==new Date().getFullYear()?" "+dt.getFullYear():""}, quando hai registrato il saldo reale`;
  }
  buildAreaChart(wrap, data, {anchorIndex});
  const current = data[data.length-1].balance;
  const diff = current-base;
  const pct = base>0 ? Math.round((diff/base)*100) : null;
  const periodText = sinceText || (range==="custom" ? (evolutionRangeLabel({from,to}).includes("–")||from===to ? `dal ${shortDate(from)} al ${shortDate(to,true)}` : `in ${evolutionRangeLabel({from,to}).toLowerCase()}`) : ({"1m":"nell'ultimo mese","2m":"negli ultimi 2 mesi","3m":"negli ultimi 3 mesi","6":"negli ultimi 6 mesi","12":"nell'ultimo anno","24":"negli ultimi 2 anni"}[range]||"nel periodo"));
  node.querySelector("#accountEvolutionLegend").innerHTML = `
    <p class="evo-kicker">${to===todayISO()?"Saldo attuale":`Saldo al ${shortDate(to,true)}`}</p>
    <p class="evo-hero">${balancesHidden?"••••":fmt(current)}</p>
    <p class="evo-delta ${diff<0?"down":diff>0?"up":"flat"}"><span class="evo-delta-pill">${diff===0?"Nessuna variazione":`${diff>0?"▲":"▼"} ${balancesHidden?(pct!==null?`${pct>0?"+":""}${pct}%`:"••••"):`${fmtSigned(diff)}${pct!==null?` · ${pct>0?"+":""}${pct}%`:""}`}`}</span> ${periodText}</p>`;
}

/* v1.10.0 — Grafico ad area moderno: linea morbida, sfumatura, griglia leggera,
   mirino con fumetto al tocco. Un solo colore (il saldo), testi con i colori del tema. */
function realBalanceDate(accountId){
  const adj=state.transactions.filter(t=>t.isBalanceAdjustment && t.accountId===accountId && (t.setsRealBalance || /^Saldo aggiornato manualmente/.test(t.note||"")));
  if(!adj.length) return null;
  return adj.map(t=>t.date).sort()[0];
}
function niceStep(range,count){
  const raw=range/Math.max(1,count), mag=Math.pow(10,Math.floor(Math.log10(raw||1))), n=raw/mag;
  return (n<=1?1:n<=2?2:n<=2.5?2.5:n<=5?5:10)*mag;
}
function compactEuro(v,step=1000){
  const a=Math.abs(v), s=v<0?"−":"";
  // Etichette sempre distinte: in "k" solo se il passo della griglia è di almeno 500 €.
  if(a>=1000 && step>=500){const dec=step>=1000&&(a>=10000||step%1000===0)?0:1;return `${s}${(a/1000).toFixed(dec).replace(".",",").replace(/,0$/,"")}k\u00a0€`;}
  return `${s}${Math.round(a).toLocaleString("it-IT")}\u00a0€`;
}
function monotonePath(pts){
  const n=pts.length; if(n<2) return n?`M${pts[0].x},${pts[0].y}`:"";
  const dx=[],dy=[],m=[],t=[];
  for(let i=0;i<n-1;i++){dx[i]=pts[i+1].x-pts[i].x;dy[i]=pts[i+1].y-pts[i].y;m[i]=dy[i]/(dx[i]||1);}
  t[0]=m[0];t[n-1]=m[n-2];
  for(let i=1;i<n-1;i++) t[i]=(m[i-1]*m[i]<=0)?0:(3*(dx[i-1]+dx[i]))/((2*dx[i]+dx[i-1])/m[i-1]+(dx[i]+2*dx[i-1])/m[i]);
  let d=`M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for(let i=0;i<n-1;i++){
    const c1x=pts[i].x+dx[i]/3,c1y=pts[i].y+t[i]*dx[i]/3,c2x=pts[i+1].x-dx[i]/3,c2y=pts[i+1].y-t[i+1]*dx[i]/3;
    d+=`C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${pts[i+1].x.toFixed(1)},${pts[i+1].y.toFixed(1)}`;
  }
  return d;
}
function buildAreaChart(wrap,data,opts={}){
  if(!wrap||!data.length) return;
  const w=Math.max(280,Math.round(wrap.clientWidth||320)), h=200, padL=8, padR=12, padT=22, padB=26;
  const vals=data.map(d=>d.balance);
  let lo=Math.min(...vals), hi=Math.max(...vals);
  if(lo===hi){lo-=Math.max(1,Math.abs(lo)*0.1);hi+=Math.max(1,Math.abs(hi)*0.1);}
  const step=niceStep(hi-lo,3);
  lo=Math.floor(lo/step)*step; hi=Math.ceil(hi/step)*step;
  const X=i=>padL+(data.length>1?i*(w-padL-padR)/(data.length-1):(w-padL-padR)/2);
  const Y=v=>padT+(h-padT-padB)*(1-(v-lo)/((hi-lo)||1));
  const pts=data.map((d,i)=>({x:X(i),y:Y(d.balance)}));
  const line=monotonePath(pts);
  const base=Y(lo);
  const area=`${line}L${pts[pts.length-1].x.toFixed(1)},${base.toFixed(1)}L${pts[0].x.toFixed(1)},${base.toFixed(1)}Z`;
  let grid="";
  for(let v=lo; v<=hi+step/2; v+=step){
    const y=Y(v).toFixed(1), zero=Math.abs(v)<step/1000;
    grid+=`<line x1="${padL}" x2="${w-padR}" y1="${y}" y2="${y}" class="${zero?"evo-zero":"evo-grid"}"/><text x="${padL}" y="${(Y(v)-5).toFixed(1)}" class="evo-ylab">${balancesHidden?"•••":compactEuro(v,step)}</text>`;
  }
  const k=Math.min(data.length,5); let xl="";
  const used=new Set();
  for(let j=0;j<k;j++){
    const i=k===1?0:Math.round(j*(data.length-1)/(k-1)); if(used.has(i)) continue; used.add(i);
    const anchor=j===0?"start":j===k-1?"end":"middle";
    xl+=`<text x="${pts[i].x.toFixed(1)}" y="${h-7}" text-anchor="${anchor}" class="evo-xlab">${escapeHtml(data[i].label)}</text>`;
  }
  const last=pts[pts.length-1], gid="evoGrad"+Math.random().toString(36).slice(2,7);
  wrap.innerHTML=`<svg class="evo-svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Andamento del saldo">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" class="evo-stop-a"/><stop offset="100%" class="evo-stop-b"/></linearGradient></defs>
    ${grid}
    <path d="${area}" fill="url(#${gid})"/>
    <path d="${line}" class="evo-line"/>
    ${opts.anchorIndex>=0&&pts[opts.anchorIndex]?`<line class="evo-anchor" x1="${pts[opts.anchorIndex].x.toFixed(1)}" x2="${pts[opts.anchorIndex].x.toFixed(1)}" y1="${padT-4}" y2="${h-padB}"/><text class="evo-anchor-lab" x="${(pts[opts.anchorIndex].x+(pts[opts.anchorIndex].x>w*0.7?-4:4)).toFixed(1)}" y="${padT-8}" text-anchor="${pts[opts.anchorIndex].x>w*0.7?"end":"start"}">Saldo reale</text>`:""}
    <line class="evo-cross" x1="0" x2="0" y1="${padT-6}" y2="${h-padB}" opacity="0"/>
    <circle class="evo-last" cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="5"/>
    <circle class="evo-hover" cx="0" cy="0" r="5" opacity="0"/>
    ${xl}
    <rect class="evo-hit" x="0" y="0" width="${w}" height="${h}" fill="transparent"/>
  </svg><div class="evo-tip" hidden></div>`;
  const svg=wrap.querySelector("svg"), tip=wrap.querySelector(".evo-tip"), cross=svg.querySelector(".evo-cross"), dot=svg.querySelector(".evo-hover");
  const show=e=>{
    const r=svg.getBoundingClientRect(), x=(e.clientX-r.left)*(w/r.width);
    let i=0,best=Infinity; pts.forEach((p,j)=>{const d=Math.abs(p.x-x); if(d<best){best=d;i=j;}});
    const p=pts[i], d=data[i], prev=data[i-1];
    cross.setAttribute("x1",p.x);cross.setAttribute("x2",p.x);cross.setAttribute("opacity","1");
    dot.setAttribute("cx",p.x);dot.setAttribute("cy",p.y);dot.setAttribute("opacity","1");
    const delta=prev?d.balance-prev.balance:null;
    tip.innerHTML=`<b>${escapeHtml(d.full||d.label)}</b><span class="evo-tip-val">${balancesHidden?"••••":fmt(d.balance)}</span>${delta!==null&&!balancesHidden?`<span class="evo-tip-delta ${delta<0?"down":delta>0?"up":""}">${delta===0?"Invariato":`${delta>0?"▲":"▼"} ${fmtSigned(delta)}`}</span>`:""}`;
    tip.hidden=false;
    const px=p.x*(r.width/w), tw=tip.offsetWidth;
    tip.style.left=Math.max(0,Math.min(r.width-tw,px-tw/2))+"px";
  };
  const hide=()=>{tip.hidden=true;cross.setAttribute("opacity","0");dot.setAttribute("opacity","0");};
  svg.addEventListener("pointerdown",e=>{show(e);});
  svg.addEventListener("pointermove",e=>{if(e.pointerType==="mouse"||e.buttons) show(e);});
  svg.addEventListener("pointerleave",e=>{if(e.pointerType==="mouse") hide();});
  wrap.addEventListener("pointerup",e=>{if(e.pointerType!=="mouse") setTimeout(hide,1800);});
}

function evolutionDefaultRange(){
  // Default: il mese (o il periodo) selezionato in Home / R&P. Il mese in corso arriva fino a oggi.
  const today=todayISO();
  if(periodModes.home==="range"&&periodRange.from) return {from:periodRange.from,to:periodRange.to>today?today:periodRange.to};
  const from=`${viewYear}-${pad2(viewMonth+1)}-01`, last=`${viewYear}-${pad2(viewMonth+1)}-${pad2(new Date(viewYear,viewMonth+1,0).getDate())}`;
  return {from, to: from<=today&&last>today?today:last};
}
function evolutionRangeLabel(r){
  const a=new Date(r.from+"T12:00:00"), b=new Date(r.to+"T12:00:00");
  const lastDay=new Date(b.getFullYear(),b.getMonth()+1,0).getDate();
  if(a.getDate()===1 && a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && (b.getDate()===lastDay || r.to===todayISO())) return `${MESI[a.getMonth()]} ${a.getFullYear()}`;
  if(r.from===r.to) return shortDate(r.from,true);
  return `${shortDate(r.from,a.getFullYear()!==b.getFullYear())} – ${shortDate(r.to,true)}`;
}
/* v1.67.0 — SCHEDA DEL CONTO: un tocco su un conto mostra tutto in un posto solo: saldo, entrate e uscite del mese
   (trasferimenti compresi), andamento con periodo a scelta (di base gli ultimi 3 mesi), ultimi movimenti e le azioni
   Modifica · Rettifica · Trasferisci. Sostituisce il vecchio pannello "Evoluzione" (stesso grafico). */
function accountMovements(accountId){
  return state.transactions.filter(t=>!t.planned&&(t.accountId===accountId||(t.type==="transfer"&&t.toAccountId===accountId)))
    .slice().sort((a,b)=>b.date.localeCompare(a.date)||String(b.id).localeCompare(String(a.id)));
}
function accountMonthFlows(accountId,y,m){
  const pre=`${y}-${pad2(m+1)}`; let inc=0, out=0, n=0;
  state.transactions.forEach(t=>{
    if(t.planned||t.isBalanceAdjustment||!String(t.date).startsWith(pre)) return;
    if(t.type==="transfer"){ if(t.toAccountId===accountId&&t.accountId!==accountId){ inc+=t.amount; n++; } else if(t.accountId===accountId&&t.toAccountId!==accountId){ out+=t.amount; n++; } return; }
    if(t.accountId!==accountId) return;
    if(t.type==="income") inc+=t.amount; else out+=t.amount; n++;
  });
  return {inc,out,n};
}
function openAccountDetail(accountId){
  const acc=state.accounts.find(a=>a.id===accountId); if(!acc) return;
  if(isLoanAccount(acc)&&typeof openLoanPerson==="function") return openLoanPerson(acc.id);
  if(!document.getElementById("tpl-account-detail")){
    const t=document.createElement("template"); t.id="tpl-account-detail";
    t.innerHTML=`<div class="sheet acx-sheet" id="sheetAccountDetail"><div class="sheet-handle"></div>
      <div class="sheet-head"><h3 id="acxTitle">Conto</h3><button class="sheet-close" data-close aria-label="Chiudi pannello">✕</button></div>
      <div class="acx-d-hero" id="acxHero"></div>
      <div class="acx-d-actions" id="acxActions"></div>
      <section class="acx-d-sec"><div class="acx-d-sec-h"><h4>Andamento</h4><button type="button" class="period-chip evo-period" id="evolutionPeriodBtn" aria-label="Scegli il periodo del grafico"></button></div>
        <div id="accountEvolutionLegend" class="evo-summary acx-evo-legend"></div><div class="evo-chart" id="accountEvolutionChartWrap"></div></section>
      <section class="acx-d-sec"><div class="acx-d-sec-h"><h4>Ultimi movimenti</h4><button type="button" class="pill-btn mini-btn" id="acxAllBtn" hidden>Tutti ›</button></div>
        <div id="acxRecent"></div><p class="empty-hint" id="acxRecentEmpty" hidden>Nessun movimento su questo conto.</p></section>
    </div>`;
    document.body.appendChild(t);
  }
  openSheet("tpl-account-detail",(node,close)=>{
    const show=v=>balancesHidden?"••••":fmt(v);
    const bal0=accountBalance(acc.id), bal=Math.abs(bal0)<0.005?0:bal0, nowD=new Date(), F=accountMonthFlows(acc.id,nowD.getFullYear(),nowD.getMonth());
    const mov=accountMovements(acc.id), last=mov[0];
    const initial=escapeHtml((String(acc.name||"?").trim().match(/[\p{L}\p{N}]/u)||["?"])[0].toUpperCase());
    node.querySelector("#acxTitle").textContent=acc.name;
    node.style.setProperty("--acc",safeColor(acc.color));
    node.querySelector("#acxHero").innerHTML=`
      <div class="acx-d-top"><span class="acx-av" aria-hidden="true">${initial}</span><span class="acx-d-name"><b>${escapeHtml(acc.name)}${accountBadges(acc)}</b><small>${acc.label?escapeHtml(acc.label)+" · ":""}${last?`ultimo movimento ${shortDate(last.date)}`:"nessun movimento"}</small></span></div>
      <p class="acx-d-bal" style="color:${balancesHidden?"var(--num-plain)":moneyColor(bal)}">${show(bal)}</p>
      ${bal<-0.004?`<p class="acx-d-warn">⚠ Saldo negativo: controlla i movimenti o registra il saldo reale con Rettifica.</p>`:""}
      <div class="acx-d-flows"><div class="in"><small>Entrate di ${MESI[nowD.getMonth()].toLowerCase()}</small><b>${F.inc>0.004?"+":""}${show(F.inc)}</b></div><div class="out"><small>Uscite di ${MESI[nowD.getMonth()].toLowerCase()}</small><b>${F.out>0.004?"−":""}${show(F.out)}</b></div><div><small>Netto</small><b style="color:${balancesHidden?"var(--num-plain)":moneyColor(F.inc-F.out)}">${F.inc-F.out>0.004?"+":F.inc-F.out<-0.004?"−":""}${show(Math.abs(F.inc-F.out))}</b></div></div>
      <p class="acx-d-note">Entrate e uscite comprendono i trasferimenti da e verso altri conti.</p>`;
    const act=node.querySelector("#acxActions");
    act.innerHTML=`<button type="button" data-acx="edit"><span aria-hidden="true">✎</span>Modifica</button><button type="button" data-acx="adj"><span aria-hidden="true">⚖️</span>Rettifica</button><button type="button" data-acx="move"><span aria-hidden="true">↔</span>Trasferisci</button>`;
    act.addEventListener("click",e=>{ const b=e.target.closest("[data-acx]"); if(!b) return; const k=b.dataset.acx; close();
      setTimeout(()=>{ if(k==="edit") openAccountForm(acc.id); else if(k==="adj") openBalanceReconcileForm(acc.id); else openTransferForm(null,{fromId:acc.id}); },60); });
    /* andamento: di base gli ultimi 3 mesi fino a oggi */
    const today=todayISO(); let custom={from:isoAddDays(today,-90),to:today};
    const btn=node.querySelector("#evolutionPeriodBtn");
    const paint=()=>{
      btn.innerHTML=`<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M4 10h16M9 3v4M15 3v4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg><span>${escapeHtml(evolutionRangeLabel(custom))}</span>`;
      renderAccountEvolution(node, acc.id, "custom", custom);
    };
    btn.addEventListener("click",()=>openPeriodPicker(null,{from:custom.from,to:custom.to,onApply:(r)=>{ const td=todayISO(); custom={from:r.from>td?td:r.from,to:r.to>td?td:r.to}; paint(); }}));
    requestAnimationFrame(paint);
    /* ultimi movimenti (8), "Tutti" apre l'elenco completo del conto */
    renderTxRows(node.querySelector("#acxRecent"),mov.slice(0,8));
    node.querySelector("#acxRecentEmpty").hidden=mov.length>0;
    const all=node.querySelector("#acxAllBtn"); all.hidden=mov.length<=8; all.textContent=`Tutti (${mov.length}) ›`;
    all.addEventListener("click",()=>openMovementsSheet(acc.name,"Tutti i movimenti del conto",mov));
  });
}
function openAccountEvolution(accountId){ return openAccountDetail(accountId); } /* v1.67.0 — ora apre la scheda del conto */
function openAccountEvolutionLegacy(accountId){
  const acc = state.accounts.find(a=>a.id===accountId);
  if(!acc) return;
  openSheet("tpl-account-evolution", (node)=>{
    node.querySelector("#accountEvolutionTitle").textContent = `Evoluzione — ${acc.name}`;
    let custom = evolutionDefaultRange();
    const btn=node.querySelector("#evolutionPeriodBtn");
    const paint=()=>{
      btn.innerHTML=`<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M4 10h16M9 3v4M15 3v4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg><span>${escapeHtml(evolutionRangeLabel(custom))}</span>`;
      renderAccountEvolution(node, accountId, "custom", custom);
    };
    btn.addEventListener("click",()=>openPeriodPicker(null,{from:custom.from,to:custom.to,onApply:(r)=>{
      const today=todayISO();
      custom={from:r.from>today?today:r.from,to:r.to>today?today:r.to};
      paint();
    }}));
    paint();
  });
}

function openBalanceReconcileForm(accountId){
  const acc=state.accounts.find(a=>a.id===accountId); if(!acc) return;
  openSheet("tpl-balance-reconcile", (node, close)=>{
    let kind="income";
    const amountInput=node.querySelector("#reconcileAmountInput");
    const dateInput=node.querySelector("#reconcileDateInput");
    const noteInput=node.querySelector("#reconcileNoteInput");
    dateInput.value=todayISO();
    node.querySelectorAll("#reconcileTypeToggle .type-opt").forEach(btn=>btn.addEventListener("click",()=>{
      node.querySelectorAll("#reconcileTypeToggle .type-opt").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active"); kind=btn.dataset.type;
    }));
    node.querySelector("#saveBalanceReconcileBtn").addEventListener("click",()=>{
      const amount=parseAmount(amountInput.value); if(amount<=0){showToast("Inserisci un importo valido");amountInput.focus();return;}
      const signed=kind==="income"?amount:-amount;
      // Sposta la variazione dal saldo-base allo storico senza cambiare il saldo attuale del conto.
      acc.balance = Math.round((acc.balance - signed)*100)/100;
      state.transactions.push({
        id:uid(), date:dateInput.value||todayISO(), amount, type:kind, name:"Rettifica saldo",
        categoryId:null, accountId:acc.id, toAccountId:null,
        note:noteInput.value.trim() || "Variazione di saldo registrata successivamente",
        isBalanceAdjustment:true
      });
      persist();renderAll();renderBalanceAdjustmentHistory();close();showToast("Rettifica registrata senza modificare il saldo attuale");
    });
  });
}

/* ---------------- Account form ---------------- */
function openAccountForm(accountId){
  const editing = !!accountId;
  const acc = editing ? state.accounts.find(a=>a.id===accountId) : null;

  openSheet("tpl-account-form", (node, close)=>{
    node.querySelector("#accountFormTitle").textContent = editing ? "Modifica conto" : "Nuovo conto";
    const nameInput = node.querySelector("#accountNameInput");
    const balInput = node.querySelector("#accountBalanceInput");
    const colorRow = node.querySelector("#accountColorRow");
    const deleteBtn = node.querySelector("#deleteAccountBtn");
    const labelInput = node.querySelector("#accountLabelInput"), labelChips = node.querySelector("#accountLabelChips");
    let chosenColor = acc?.color || PALETTE[0];

    nameInput.value = acc?.name || "";
    // v1.46.0 — etichetta del conto (a cosa serve)
    labelInput.value = acc?.label || "";
    const paintLabels=()=>{
      labelChips.innerHTML=ACCOUNT_LABELS.map(l=>`<button type="button" class="chip${labelInput.value.trim().toLowerCase()===l.toLowerCase()?" active":""}" data-label="${escapeHtml(l)}">${escapeHtml(l)}</button>`).join("");
      labelChips.querySelectorAll("[data-label]").forEach(b=>b.addEventListener("click",()=>{ labelInput.value=labelInput.value.trim().toLowerCase()===b.dataset.label.toLowerCase()?"":b.dataset.label; paintLabels(); }));
    };
    paintLabels();
    labelInput.addEventListener("input",paintLabels);
    if(editing){
      node.querySelector("#accountBalanceLabel").textContent = "Saldo attuale";
      node.querySelector("#accountBalanceHint").textContent = "Se cambi questo valore, l’app registra automaticamente la differenza come Rettifica saldo.";
      balInput.value = String(accountBalance(acc.id)).replace(".",",");
      node.querySelector("#reconcileAccountBtn").hidden = false;
    } else {
      balInput.value = "";
    }

    PALETTE.forEach(color=>{
      const sw = document.createElement("button");
      sw.className = "color-swatch" + (color===chosenColor?" active":"");
      sw.style.background = color;
      sw.addEventListener("click", ()=>{
        chosenColor = color;
        colorRow.querySelectorAll(".color-swatch").forEach(s=>s.classList.remove("active"));
        sw.classList.add("active");
      });
      colorRow.appendChild(sw);
    });

    if(editing) deleteBtn.hidden = false;
    deleteBtn.addEventListener("click", async ()=>{
      const hasTx = state.transactions.some(t=>t.accountId===accountId);
      const msg = hasTx
        ? "Questo conto ha movimenti associati. Eliminandolo verranno eliminati anche i suoi movimenti. Continuare?"
        : "Eliminare questo conto?";
      if(!await askConfirm(msg)) return;
      state.accounts = state.accounts.filter(a=>a.id!==accountId);
      if(state.mainAccountId===accountId) state.mainAccountId=null;
      if(state.savingsAccountId===accountId) state.savingsAccountId=null;
      if(state.betAccountId===accountId) state.betAccountId=null;
      state.transactions = state.transactions.filter(t=>t.accountId!==accountId);
      persist(); renderAll(); close();
    });

    node.querySelector("#reconcileAccountBtn").addEventListener("click", ()=>{
      if(!editing) return;
      close();
      openBalanceReconcileForm(accountId);
    });

    node.querySelector("#saveAccountBtn").addEventListener("click", ()=>{
      const name = nameInput.value.trim();
      if(!name) { nameInput.focus(); return; }
      const balance = parseAmount(balInput.value) * (balInput.value.trim().startsWith("-") ? -1 : 1);
      if(editing){
        const before = accountBalance(acc.id);
        const delta = Math.round((balance - before) * 100) / 100;
        acc.name = name; acc.color = chosenColor; acc.label = labelInput.value.trim().slice(0,40);
        if(Math.abs(delta) >= 0.01){
          state.transactions.push({
            id:uid(), date:todayISO(), amount:Math.abs(delta),
            type:delta>0?"income":"expense", name:"Rettifica saldo",
            categoryId:null, accountId:acc.id, toAccountId:null,
            note:`Saldo aggiornato manualmente da ${fmt(before)} a ${fmt(balance)}`,
            isBalanceAdjustment:true, setsRealBalance:true
          });
        }
      } else {
        state.accounts.push({ id: uid(), name, label: labelInput.value.trim().slice(0,40), balance, color: chosenColor });
      }
      persist(); renderAll(); renderBalanceAdjustmentHistory(); close();
    });
  });
}
/* ---------------- Pannelli di gestione (Altro) ---------------- */
function openAccountsPanel(){
  openSheet("tpl-accounts-panel", (node)=>{
    renderAccountsManageList();
    renderBalanceAdjustmentHistory();
    node.querySelector("#addAccountBtn").addEventListener("click", ()=> openAccountForm(null));
  });
}
document.getElementById("openAccountsPanelBtn").addEventListener("click", openAccountsPanel);

/* v1.4.0 — Un'unica sezione per categorie, macrocategorie e struttura. */
function openCategoriesHub(startMode){
  openSheet("tpl-categories-hub", (node)=>{
    let mode=startMode||"categories";
    const addBtn=node.querySelector("#hubAddBtn");
    const labels={categories:"Aggiungi categoria",macro:"Aggiungi macrocategoria"};
    function setMode(m){
      mode=m;
      node.querySelectorAll("[data-hub]").forEach(b=>{const on=b.dataset.hub===m;b.classList.toggle("active",on);b.setAttribute("aria-selected",on?"true":"false");});
      node.querySelectorAll("[data-hub-pane]").forEach(p=>p.hidden=p.dataset.hubPane!==m);
      addBtn.hidden=(m==="graph");
      if(labels[m]) addBtn.setAttribute("aria-label",labels[m]);
      if(m==="categories") renderCategories();
      else if(m==="macro") renderMacroCategories();
      else renderCategoryGraph();
    }
    node.querySelectorAll("[data-hub]").forEach(b=>b.addEventListener("click",()=>setMode(b.dataset.hub)));
    addBtn.addEventListener("click",()=>{ if(mode==="macro") openMacroForm(null); else openCategoryForm(null); });
    /* v1.54.0 — Le frecce di riordino compaiono solo dopo "Riordina" (prima erano su ogni riga). */
    const reBtn=node.querySelector("#hubReorderBtn"), reHint=node.querySelector("#hubReorderHint");
    function setReorder(on){
      node.classList.toggle("reordering",on);
      reBtn.textContent=on?"Fine":"↕ Riordina"; reBtn.setAttribute("aria-pressed",on?"true":"false");
      reBtn.classList.toggle("active",on); reHint.hidden=!on||mode==="graph";
    }
    reBtn.addEventListener("click",()=>setReorder(!node.classList.contains("reordering")));
    node.querySelectorAll("[data-hub]").forEach(b=>b.addEventListener("click",()=>{ reBtn.hidden=(b.dataset.hub==="graph"); if(b.dataset.hub==="graph") setReorder(false); else reHint.hidden=!node.classList.contains("reordering"); }));
    setMode(mode);
    reBtn.hidden=(mode==="graph");
  });
}
document.getElementById("openCategoriesHubBtn").addEventListener("click",()=>openCategoriesHub("categories"));

/* ---------------- Category form ---------------- */
function openCategoryForm(categoryId){
  const editing = !!categoryId;
  const cat = editing ? state.categories.find(c=>c.id===categoryId) : null;

  openSheet("tpl-category-form", (node, close)=>{
    node.querySelector("#categoryFormTitle").textContent = editing ? "Modifica categoria" : "Nuova categoria";
    const nameInput = node.querySelector("#categoryNameInput");
    const budgetInput = node.querySelector("#categoryBudgetInput");
    const emojiRow = node.querySelector("#categoryEmojiRow");
    const colorRow = node.querySelector("#categoryColorRow");
    const kindToggle = node.querySelector("#categoryKindToggle");
    const macroChips = node.querySelector("#categoryMacroChips");
    const deleteBtn = node.querySelector("#deleteCategoryBtn");

    const parentChips = node.querySelector("#categoryParentChips");
    const macroRow = node.querySelector("#categoryMacroRow");
    const clashHint = node.querySelector("#categoryClashHint");

    let chosenEmoji = cat?.emoji || EMOJIS[0];
    let chosenColor = cat?.color || PALETTE[0];
    let chosenKind = cat?.kind || "expense";
    let chosenMacroId = cat?.macroCategoryId || null;
    let chosenParentId = cat?.parentCategoryId || null;

    nameInput.value = cat?.name || "";
    budgetInput.value = cat?.budget ? String(cat.budget).replace(".",",") : "";

    /* v1.37.0 — "Dentro quale categoria": scegliendo una madre questa diventa una
       sottocategoria. Una categoria che ha già figlie non può diventarlo a sua volta:
       i livelli restano tre. */
    const haFiglie = editing && subCategoriesOf(categoryId).length > 0;
    /* v1.43.0 — "Dentro quale categoria" e "Macrocategoria" sono pulsanti con menu piccolo. */
    function renderParentChips(){
      parentChips.innerHTML = "";
      if(haFiglie){
        const nota=document.createElement("p");
        nota.className="field-hint";
        nota.textContent="Questa categoria ha già delle sottocategorie, quindi resta principale.";
        parentChips.appendChild(nota);
        chosenParentId=null;
        macroRow.hidden=false;
        return;
      }
      const madre=chosenParentId?state.categories.find(c=>c.id===chosenParentId):null;
      const opts=topCategories(chosenKind).filter(c=>c.id!==categoryId);
      parentChips.appendChild(pickButton({label:"Dentro la categoria",emoji:madre?.emoji||"🗂️",value:madre?madre.name:"Categoria principale",onOpen:b=>openPick(b,"Dentro quale categoria",
        [{key:"",emoji:"🗂️",label:"Categoria principale",sub:"non è una sottocategoria",active:!madre},...opts.map(c=>({key:c.id,emoji:c.emoji,label:c.name,active:madre&&madre.id===c.id}))],
        id=>{ if(id){ const c=state.categories.find(x=>x.id===id); chosenParentId=id; chosenMacroId=c?.macroCategoryId||null; } else chosenParentId=null; renderParentChips(); renderMacroChips(); paintClash(); })}));
      /* La macrocategoria la decide la madre: niente doppia scelta. */
      macroRow.hidden = !!chosenParentId;
    }
    /* Se il nome esiste già altrove, lo diciamo subito e spieghiamo come si distinguerà. */
    function paintClash(){
      const n=nameInput.value.trim();
      const clash=n?categoryNameClash(n,chosenKind,categoryId):null;
      if(!clash){ clashHint.hidden=true; return; }
      const madre=chosenParentId?state.categories.find(c=>c.id===chosenParentId):null;
      const cosa=clash.tipo==="macro"?"una macrocategoria":clash.tipo==="sotto"?"un'altra sottocategoria":"un'altra categoria";
      clashHint.hidden=false;
      clashHint.textContent=madre
        ? `Esiste già ${cosa} “${clash.nome}”: questa comparirà come “${madre.name} › ${n}”.`
        : `Esiste già ${cosa} “${clash.nome}”: scegli un nome diverso o mettila dentro una categoria madre.`;
    }
    nameInput.addEventListener("input", paintClash);

    function renderMacroChips(){
      macroChips.innerHTML = "";
      const m=chosenMacroId?state.macroCategories.find(x=>x.id===chosenMacroId):null;
      macroChips.appendChild(pickButton({label:"Macrocategoria",emoji:m?.emoji||"🏷️",value:m?m.name:"Nessuna",onOpen:b=>openPick(b,"Macrocategoria",
        [{key:"",emoji:"🏷️",label:"Nessuna",active:!m},...state.macroCategories.filter(x=>x.kind===chosenKind).map(x=>({key:x.id,emoji:x.emoji,label:x.name,active:m&&m.id===x.id}))],
        id=>{ chosenMacroId=id||null; renderMacroChips(); })}));
    }
    renderMacroChips();
    renderParentChips();
    paintClash();

    kindToggle.querySelectorAll(".type-opt").forEach(opt=>{
      opt.classList.toggle("active", opt.dataset.kind===chosenKind);
      opt.addEventListener("click", ()=>{
        chosenKind = opt.dataset.kind;
        if(chosenMacroId && state.macroCategories.find(m=>m.id===chosenMacroId)?.kind!==chosenKind) chosenMacroId=null;
        if(chosenParentId && state.categories.find(c=>c.id===chosenParentId)?.kind!==chosenKind) chosenParentId=null;
        kindToggle.querySelectorAll(".type-opt").forEach(o=>o.classList.remove("active"));
        opt.classList.add("active");
        renderMacroChips();
        renderParentChips();
        paintClash();
      });
    });

    buildEmojiField(emojiRow, chosenEmoji, v=>{ chosenEmoji=v; });

    PALETTE.forEach(color=>{
      const sw = document.createElement("button");
      sw.className = "color-swatch" + (color===chosenColor?" active":"");
      sw.style.background = color;
      sw.addEventListener("click", ()=>{
        chosenColor = color;
        colorRow.querySelectorAll(".color-swatch").forEach(s=>s.classList.remove("active"));
        sw.classList.add("active");
      });
      colorRow.appendChild(sw);
    });

    if(editing) deleteBtn.hidden = false;
    deleteBtn.addEventListener("click", async ()=>{
      const figlie=subCategoriesOf(categoryId);
      const msg=figlie.length
        ? `Eliminare questa categoria? Le sue ${figlie.length} sottocategorie diventano categorie principali e i movimenti collegati restano senza categoria.`
        : "Eliminare questa categoria? I movimenti collegati resteranno ma senza categoria.";
      if(!await askConfirm(msg)) return;
      figlie.forEach(sc=>{ sc.parentCategoryId=null; });
      state.categories = state.categories.filter(c=>c.id!==categoryId);
      persist(); renderAll(); close();
    });

    node.querySelector("#saveCategoryBtn").addEventListener("click", ()=>{
      const name = nameInput.value.trim();
      if(!name){ nameInput.focus(); return; }
      const budget = budgetInput.value.trim() ? parseAmount(budgetInput.value) : null;
      /* Una sottocategoria eredita sempre tipo e macrocategoria dalla madre. */
      const madre = chosenParentId ? state.categories.find(c=>c.id===chosenParentId) : null;
      const kindFinale = madre ? madre.kind : chosenKind;
      const macroFinale = madre ? (madre.macroCategoryId||null) : chosenMacroId;
      if(editing){
        cat.name=name; cat.emoji=chosenEmoji; cat.color=chosenColor; cat.kind=kindFinale; cat.budget=budget;
        cat.macroCategoryId=macroFinale; cat.parentCategoryId=madre?madre.id:null;
        /* Se è passata sotto una madre, le sue eventuali figlie salgono di livello. */
        if(madre) subCategoriesOf(cat.id).forEach(sc=>{ sc.parentCategoryId=null; });
      } else {
        state.categories.push({ id: uid(), name, emoji: chosenEmoji, color: chosenColor, kind: kindFinale, budget,
          macroCategoryId: macroFinale, parentCategoryId: madre?madre.id:null });
      }
      persist(); renderAll(); close();
    });
  });
}
/* ---------------- Macro category form ---------------- */
function openMacroForm(macroId){
  const editing = !!macroId;
  const macro = editing ? state.macroCategories.find(m=>m.id===macroId) : null;

  openSheet("tpl-macro-form", (node, close)=>{
    node.querySelector("#macroFormTitle").textContent = editing ? "Modifica macrocategoria" : "Nuova macrocategoria";
    const nameInput = node.querySelector("#macroNameInput");
    const emojiRow = node.querySelector("#macroEmojiRow");
    const colorRow = node.querySelector("#macroColorRow");
    const budgetInput = node.querySelector("#macroBudgetInput");
    const deleteBtn = node.querySelector("#deleteMacroBtn");
    const kindToggle = node.querySelector("#macroKindToggle");

    let chosenEmoji = macro?.emoji || EMOJIS[0];
    let chosenColor = macro?.color || PALETTE[0];
    let chosenKind = macro?.kind || "expense";

    nameInput.value = macro?.name || "";
    budgetInput.value = macro?.budget ? String(macro.budget).replace(".",",") : "";

    kindToggle.querySelectorAll(".type-opt").forEach(opt=>{
      opt.classList.toggle("active",opt.dataset.kind===chosenKind);
      opt.addEventListener("click",()=>{
        chosenKind=opt.dataset.kind;
        kindToggle.querySelectorAll(".type-opt").forEach(o=>o.classList.toggle("active",o===opt));
      });
    });

    buildEmojiField(emojiRow, chosenEmoji, v=>{ chosenEmoji=v; });

    PALETTE.forEach(color=>{
      const sw = document.createElement("button");
      sw.className = "color-swatch" + (color===chosenColor?" active":"");
      sw.style.background = color;
      sw.addEventListener("click", ()=>{
        chosenColor = color;
        colorRow.querySelectorAll(".color-swatch").forEach(s=>s.classList.remove("active"));
        sw.classList.add("active");
      });
      colorRow.appendChild(sw);
    });

    if(editing) deleteBtn.hidden = false;
    deleteBtn.addEventListener("click", async ()=>{
      const hasCats = state.categories.some(c=>c.macroCategoryId===macroId);
      const msg = hasCats
        ? "Le categorie associate resteranno, ma senza macrocategoria. Continuare?"
        : "Eliminare questa macrocategoria?";
      if(!await askConfirm(msg)) return;
      state.macroCategories = state.macroCategories.filter(m=>m.id!==macroId);
      state.categories.forEach(c=>{ if(c.macroCategoryId===macroId) c.macroCategoryId=null; });
      persist(); renderAll(); close();
    });

    node.querySelector("#saveMacroBtn").addEventListener("click", ()=>{
      const name = nameInput.value.trim();
      if(!name){ nameInput.focus(); return; }
      const budget = budgetInput.value.trim() ? parseAmount(budgetInput.value) : null;
      if(editing){
        macro.name=name; macro.emoji=chosenEmoji; macro.color=chosenColor; macro.budget=budget; macro.kind=chosenKind;
      } else {
        state.macroCategories.push({ id: uid(), name, emoji: chosenEmoji, color: chosenColor, budget, kind:chosenKind });
      }
      persist(); renderAll(); close();
    });
  });
}
/* ---------------- Recurring form ---------------- */
function openRecurringForm(recurringId,prefill=null){
  const editing = !!recurringId;
  const rec = editing ? state.recurring.find(r=>r.id===recurringId) : (prefill||null);
  let rType = rec?.type || "expense";
  let rCat = rec?.categoryId || null;
  let rAcc = rec?.accountId || null;
  let rFreq = rec?.freq || "monthly";

  openSheet("tpl-recurring-form", (node, close)=>{
    node.querySelector("#recurringFormTitle").textContent = editing ? "Modifica ricorrente" : "Nuovo ricorrente";
    const nameInput = node.querySelector("#recurringNameInput");
    const amountInput = node.querySelector("#recurringAmountInput");
    const dateInput = node.querySelector("#recurringDateInput");
    const noteInput = node.querySelector("#recurringNoteInput");
    const typeToggle = node.querySelector("#recurringTypeToggle");
    const freqSelect = node.querySelector("#recurringFreqSelect");
    const catChips = node.querySelector("#recurringCategoryChips");
    const accChips = node.querySelector("#recurringAccountChips");
    const deleteBtn = node.querySelector("#deleteRecurringBtn");
    const activeInput=node.querySelector("#recurringActiveInput"), endDateInput=node.querySelector("#recurringEndDateInput");
    const durationMode=node.querySelector("#recurringDurationMode"), occurrencesWrap=node.querySelector("#recurringOccurrencesWrap"), occurrencesInput=node.querySelector("#recurringOccurrencesInput"), endDateWrap=node.querySelector("#recurringEndDateWrap");

    nameInput.value = rec?.name || "";
    amountInput.value = rec ? String(rec.amount).replace(".",",") : "";
    autoGrowAmountInput(amountInput);
    noteInput.value = rec?.note || "";
    dateInput.value = rec?.startDate || todayISO();
    freqSelect.value = rFreq;
    activeInput.checked=rec?.active!==false;
    // v1.41.0 — "Ricorrenza attiva" è un interruttore grande (la casella resta nascosta sotto).
    { const sw=node.querySelector("#recurringActiveSwitch");
      if(sw){ const paint=()=>{ sw.classList.toggle("on",activeInput.checked); sw.setAttribute("aria-pressed",String(activeInput.checked)); sw.querySelector("small").textContent=activeInput.checked?"Spegnila per metterla in pausa senza eliminarla":"In pausa: non genera movimenti finché non la riaccendi"; };
        sw.addEventListener("click",()=>{ activeInput.checked=!activeInput.checked; paint(); }); paint(); } }
    endDateInput.value=rec?.endDate || "";
    occurrencesInput.value=rec?.maxOccurrences ? String(rec.maxOccurrences) : "";
    durationMode.value=rec?.maxOccurrences ? "count" : (rec?.endDate ? "date" : "unlimited");
    function renderDurationFields(){
      occurrencesWrap.hidden=durationMode.value!=="count";
      endDateWrap.hidden=durationMode.value!=="date";
    }
    durationMode.addEventListener("change",renderDurationFields);
    renderDurationFields();

    function renderCatChips(){
      renderCategoryPicker(catChips, rType, ()=>rCat, id=>{ rCat=id; });
    }
    function renderAccChips(){
      accChips.innerHTML = "";
      // v1.44.0 — il conto di partenza è il conto principale (si vede subito nel pulsante)
      if(!rAcc) rAcc = (state.accounts.find(a=>a.id===state.mainAccountId&&!isLoanAccount(a))||state.accounts.find(a=>!isLoanAccount(a))||state.accounts[0])?.id || null;
      state.accounts.forEach(a=>{
        const chip = document.createElement("button");
        chip.className = "chip" + (rAcc===a.id?" active":"");
        chip.innerHTML = `<span class="em">●</span>${escapeHtml(a.name)}`;
        chip.querySelector(".em").style.color = safeColor(a.color);
        chip.addEventListener("click", ()=>{ rAcc=a.id; renderAccChips(); });
        accChips.appendChild(chip);
      });
    }

    typeToggle.querySelectorAll(".type-opt").forEach(opt=>{
      opt.classList.toggle("active", opt.dataset.type===rType);
      opt.addEventListener("click", ()=>{
        typeToggle.querySelectorAll(".type-opt").forEach(o=>o.classList.remove("active"));
        opt.classList.add("active");
        rType = opt.dataset.type; rCat=null;
        catChips._activeMacro = null; catChips._open = false; catChips._q = "";
        renderCatChips();
      });
    });
    freqSelect.addEventListener("change", ()=>{ rFreq=freqSelect.value; });

    renderCatChips();
    renderAccChips();
    if(!editing) mountKindSwitch(node,"recurring",()=>({name:nameInput.value.trim(),amount:parseAmount(amountInput.value),type:rType,categoryId:rCat,accountId:rAcc,note:noteInput.value.trim(),date:dateInput.value}));

    if(editing) deleteBtn.hidden = false;
    deleteBtn.addEventListener("click", async ()=>{
      if(!await askConfirm("Eliminare questo movimento ricorrente? Sarà rimosso anche dalle prossime pianificate.")) return;
      moveToTrash("recurring",rec); const deleted=state.trash[0]?.id; removeRecurring(recurringId);
      persist(); renderAll(); close(); if(deleted) showUndo("Ricorrente eliminato",deleted);
    });

    // v1.47.0 — anche un ricorrente può essere una spesa divisa (metà o fra più persone)
    const shared=mountSharedExpense(node, accChips.closest(".field-row"), {type:()=>rType, amount:()=>parseAmount(amountInput.value), split:rec?.split});
    node.querySelector("#saveRecurringBtn").addEventListener("click", ()=>{
      const sharedInfo=shared.get();
      if(sharedInfo.want && !sharedInfo.persons.length){ showToast("Scegli o scrivi con chi dividi la spesa"); return; }
      const split=sharedInfo.on?{persons:sharedInfo.persons,mode:sharedInfo.mode,pct:Math.round(sharedInfo.pct)}:null;
      const name = nameInput.value.trim();
      const amount = parseAmount(amountInput.value);
      const startDate = dateInput.value || todayISO();
      const duration=durationMode.value;
      const parsedOccurrences=parseInt(occurrencesInput.value||"",10);
      const maxOccurrences=duration==="count" && Number.isFinite(parsedOccurrences) && parsedOccurrences>0 ? parsedOccurrences : null;
      const endDate=duration==="date" ? (endDateInput.value||"") : "";
      const missing=[];if(!name) missing.push("nome");if(amount<=0) missing.push("importo");if(!rCat) missing.push("categoria");if(!rAcc) missing.push("conto");if(!dateInput.value) missing.push("data");if(duration==="count"&&!maxOccurrences) missing.push("numero rate");if(duration==="date"&&!endDate) missing.push("data fine");
      if(missing.length){showToast("Inserisci: "+missing.join(", "));return;}
      if(endDate && endDate<startDate){showToast("La data di fine deve essere successiva alla prima data");return;}
      if(editing){
        rec.name=name; rec.amount=amount; rec.type=rType; rec.categoryId=rCat; rec.accountId=rAcc;
        rec.freq=rFreq; rec.startDate=startDate; rec.note=noteInput.value.trim(); rec.active=activeInput.checked; rec.endDate=endDate; rec.maxOccurrences=maxOccurrences;
        if(split) rec.split=split; else delete rec.split;
        refreshRecurringTransactions(rec.id);
      } else {
        state.recurring.push({
          id: uid(), name, amount, type: rType, categoryId: rCat, accountId: rAcc,
          freq: rFreq, startDate, note: noteInput.value.trim(), nextDate: startDate, active:activeInput.checked, endDate, maxOccurrences,
          ...(split?{split}:{}),
        });
      }
      if(!editing) generateRecurringTransactions(false);
      persist(); renderAll(); close();
      if(!editing && activeInput.checked && startDate===todayISO()) showToast("Ricorrente registrato anche nei Movimenti di oggi");
    });
  });
}

/* ---------------- Spese pianificate: form una tantum ---------------- */
let plannedTxType = "expense", plannedSelectedCategoryId = null, plannedSelectedAccountId = null;
function openPlannedForm(plannedId,prefill=null,opts={}){
  const editing = !!plannedId;
  const moveTx = opts.moveTxId ? state.transactions.find(x=>x.id===opts.moveTxId) : null;
  const p = editing ? state.planned.find(x=>x.id===plannedId) : (prefill||null);
  plannedTxType = p?.type || "expense";
  plannedSelectedCategoryId = p?.categoryId || null;
  plannedSelectedAccountId = p?.accountId || null;

  openSheet("tpl-planned-form", (node, close)=>{
    node.querySelector("#plannedFormTitle").textContent = moveTx ? "Sposta pianificato" : editing ? "Modifica pianificato" : "Nuovo pianificato";
    const amountInput = node.querySelector("#plannedAmountInput");
    const nameInput = node.querySelector("#plannedNameInput");
    const dateInput = node.querySelector("#plannedDateInput");
    const noteInput = node.querySelector("#plannedNoteInput");
    const catChipsGrouped = node.querySelector("#plannedCategoryChipsGrouped");
    const accChips = node.querySelector("#plannedAccountChips");
    const typeToggle = node.querySelector("#plannedTypeToggle");
    const deleteBtn = node.querySelector("#deletePlannedBtn");

    amountInput.value = p ? String(p.amount).replace(".",",") : "";
    nameInput.value=p?.name || "";
    autoGrowAmountInput(amountInput);
    noteInput.value = p?.note || "";
    if(p?.date){
      dateInput.value = p.date;
    } else {
      dateInput.value = todayISO();
    }

    typeToggle.querySelectorAll(".type-opt").forEach(opt=>{
      opt.classList.toggle("active", opt.dataset.type===plannedTxType);
      opt.addEventListener("click", ()=>{
        typeToggle.querySelectorAll(".type-opt").forEach(o=>o.classList.remove("active"));
        opt.classList.add("active");
        plannedTxType = opt.dataset.type;
        plannedSelectedCategoryId = null;
        catChipsGrouped._activeMacro = null; catChipsGrouped._open = false; catChipsGrouped._q = "";
        renderCatChips();
      });
    });

    function renderCatChips(){
      renderCategoryPicker(catChipsGrouped, plannedTxType, ()=>plannedSelectedCategoryId, id=>{ plannedSelectedCategoryId=id; });
    }
    function renderAccChips(){
      accChips.innerHTML = "";
      // v1.44.0 — il conto di partenza è il conto principale (si vede subito nel pulsante)
      if(!plannedSelectedAccountId) plannedSelectedAccountId = (state.accounts.find(a=>a.id===state.mainAccountId&&!isLoanAccount(a))||state.accounts.find(a=>!isLoanAccount(a))||state.accounts[0])?.id || null;
      state.accounts.forEach(a=>{
        const chip = document.createElement("button");
        chip.className = "chip" + (plannedSelectedAccountId===a.id ? " active":"");
        chip.innerHTML = `<span class="em">●</span>${escapeHtml(a.name)}`;
        chip.querySelector(".em").style.color = safeColor(a.color);
        chip.addEventListener("click", ()=>{ plannedSelectedAccountId=a.id; renderAccChips(); });
        accChips.appendChild(chip);
      });
    }
    renderCatChips();
    renderAccChips();
    if(!editing && !moveTx) mountKindSwitch(node,"planned",()=>({name:nameInput.value.trim(),amount:parseAmount(amountInput.value),type:plannedTxType,categoryId:plannedSelectedCategoryId,accountId:plannedSelectedAccountId,note:noteInput.value.trim(),date:dateInput.value}));

    if(editing) deleteBtn.hidden = false;
    deleteBtn.addEventListener("click", async ()=>{
      if(!await askConfirm("Eliminare questa spesa pianificata?")) return;
      moveToTrash("planned",p); const deleted=state.trash[0]?.id; state.planned = state.planned.filter(x=>x.id!==plannedId);
      persist(); renderAll(); close(); if(deleted) showUndo("Pianificata eliminata",deleted);
    });

    // v1.47.0 — anche una pianificata può essere una spesa divisa (metà o fra più persone)
    const shared=mountSharedExpense(node, accChips.closest(".field-row"), {type:()=>plannedTxType, amount:()=>parseAmount(amountInput.value), split:p?.split});
    node.querySelector("#savePlannedBtn").addEventListener("click", ()=>{
      const sharedInfo=shared.get();
      if(sharedInfo.want && !sharedInfo.persons.length){ showToast("Scegli o scrivi con chi dividi la spesa"); return; }
      const split=sharedInfo.on?{persons:sharedInfo.persons,mode:sharedInfo.mode,pct:Math.round(sharedInfo.pct)}:null;
      const amount = parseAmount(amountInput.value);
      const missing=[];if(!nameInput.value.trim()) missing.push("nome");if(amount<=0) missing.push("importo");if(!plannedSelectedCategoryId) missing.push("categoria");if(!plannedSelectedAccountId) missing.push("conto");if(!dateInput.value) missing.push("data");
      if(missing.length){showToast("Inserisci: "+missing.join(", "));if(amount<=0) amountInput.focus();return;}
      const date = dateInput.value;
      if(moveTx){
        if(date===moveTx.date){ showToast("Scegli una data diversa"); dateInput.focus(); return; }
        const before=JSON.parse(JSON.stringify(moveTx)), beforeLinked=JSON.parse(JSON.stringify(moveTx.splitGroup?linkedTx(moveTx):[]));
        const back={...p,name:nameInput.value.trim(),amount,type:plannedTxType,categoryId:plannedSelectedCategoryId,accountId:plannedSelectedAccountId,date,note:noteInput.value.trim()};
        delete back.plannedSnapshot;
        if(split) back.split=split; else delete back.split;
        state.transactions=state.transactions.filter(x=>x.id!==moveTx.id);
        state.planned=state.planned.filter(x=>x.id!==back.id);
        state.planned.push(back);
        generatePlannedTransactions();
        persist(); renderAll(); close();
        showActionToastOrUndo(`Spostato al ${shortDate(date)}`,()=>{
          state.planned=state.planned.filter(x=>x.id!==back.id);
          state.transactions=state.transactions.filter(x=>!(x.plannedId===back.id));
          state.transactions.push(before,...beforeLinked); persist(); renderAll();
        });
        return;
      }
      if(editing){
        p.name=nameInput.value.trim(); p.amount=amount; p.type=plannedTxType; p.categoryId=plannedSelectedCategoryId;
        p.accountId=plannedSelectedAccountId; p.date=date; p.note=noteInput.value.trim();
        if(split) p.split=split; else delete p.split;
      } else {
        state.planned.push({
          id: uid(), name:nameInput.value.trim(), amount, type: plannedTxType, categoryId: plannedSelectedCategoryId,
          accountId: plannedSelectedAccountId, date, note: noteInput.value.trim(), ...(split?{split}:{}),
        });
      }
      generatePlannedTransactions();
      persist(); renderAll(); close();
    });
  });
}
document.getElementById("addPlannedBtn").addEventListener("click", ()=> openPlannedForm(null));

/* ---------------- Calendario spese ---------------- */
let calYear, calMonth;
function buildCalendarDayInfo(y,m){
  const daysInMonth = new Date(y,m+1,0).getDate();
  const info = {};
  for(let d=1; d<=daysInMonth; d++){
    const iso = `${y}-${pad2(m+1)}-${pad2(d)}`;
    info[iso] = { real:false, planned:false, recurring:false };
  }
  state.transactions.forEach(t=>{
    if(info[t.date]){
      info[t.date].real = true;
    }
  });
  state.planned.forEach(p=>{
    if(info[p.date]) info[p.date].planned = true;
  });
  state.recurring.forEach(r=>{
    recurringOccurrencesInMonth(r,y,m).forEach(date=>{
      if(info[date]) info[date].recurring = true;
    });
  });
  return info;
}
function renderCalendarGrid(node){
  node.querySelector("#calMonthLabel").textContent = `${MESI[calMonth]} ${calYear}`;
  const grid = node.querySelector("#calendarGrid");
  grid.innerHTML = "";
  const firstDay = new Date(calYear, calMonth, 1).getDay(); // 0=Dom
  const leadBlanks = (firstDay+6)%7; // Lun=0
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
  const info = buildCalendarDayInfo(calYear, calMonth);
  const todayStr = todayISO();

  for(let i=0;i<leadBlanks;i++){
    const blank = document.createElement("div");
    blank.className = "calendar-cell empty";
    grid.appendChild(blank);
  }
  for(let d=1; d<=daysInMonth; d++){
    const iso = `${calYear}-${pad2(calMonth+1)}-${pad2(d)}`;
    const cell = document.createElement("button");
    const dayInfo = info[iso];
    cell.className = "calendar-cell" + (iso===todayStr ? " today" : "") + (dayInfo.real ? " has-real":"") + (dayInfo.planned ? " has-planned":"") + (dayInfo.recurring ? " has-recurring":"");
    let dots = "";
    if(dayInfo.real) dots += `<span class="cal-dot real"></span>`;
    if(dayInfo.planned) dots += `<span class="cal-dot planned"></span>`;
    if(dayInfo.recurring) dots += `<span class="cal-dot recurring"></span>`;
    cell.innerHTML = `<span class="cal-day-num">${d}</span><span class="cal-dots">${dots}</span>`;
    cell.addEventListener("click", ()=> openDayDetail(iso));
    grid.appendChild(cell);
  }
  padCalendarGrid(grid,leadBlanks,daysInMonth);
}
function openCalendar(){
  calYear = viewYear; calMonth = viewMonth;
  let level="days";
  openSheet("tpl-calendar", (node)=>{
    const label=node.querySelector("#calMonthLabel"), months=node.querySelector("#calMonths");
    const grid=node.querySelector("#calendarGrid"), weekdays=node.querySelector(".calendar-weekdays");
    // v1.7.0: toccando il mese si vedono i 12 mesi per spostarsi velocemente; toccando un giorno se ne vedono i movimenti.
    function paint(){
      if(level!=="days"){
        label.innerHTML=level==="months"?`${calYear} <span class="pp-caret">▾</span>`:`Scegli l'anno`;
        grid.hidden=true; if(weekdays) weekdays.hidden=true; months.hidden=false; months.classList.toggle("is-years",level==="years");
        if(level==="months") renderMonthsGrid(months,calYear,calYear,calMonth,(m)=>{calMonth=m;level="days";paint();});
        else renderYearsGrid(months,calYear,(y)=>{calYear=y;level="months";paint();});
      }else{
        grid.hidden=false; if(weekdays) weekdays.hidden=false; months.hidden=true;
        renderCalendarGrid(node);
        label.innerHTML=`${MESI[calMonth]} ${calYear} <span class="pp-caret">▾</span>`;
        node.style.setProperty("--pp-h",Math.round(grid.getBoundingClientRect().bottom-(weekdays||grid).getBoundingClientRect().top)+"px");
      }
    }
    label.addEventListener("click",()=>{level=level==="days"?"months":level==="months"?"years":"months";paint();});
    node.querySelector("#calPrevMonth").addEventListener("click", ()=>{
      if(level!=="days") calYear--; else { calMonth--; if(calMonth<0){ calMonth=11; calYear--; } }
      paint();
    });
    node.querySelector("#calNextMonth").addEventListener("click", ()=>{
      if(level!=="days") calYear++; else { calMonth++; if(calMonth>11){ calMonth=0; calYear++; } }
      paint();
    });
    paint();
  });
}
/* v1.7.0 — Il pulsante calendario sta nella barra del periodo della Home (vista generale di tutti i movimenti). */
/* v1.22.0 — Un solo calendario: quello che si apre toccando il titolo del periodo (con i pallini e la legenda).
   Il pulsante 📅 in alto a destra non c'è più. */
(function hideCalendarBtn(){ const b=document.getElementById("openCalendarBtn"); if(b){ b.hidden=true; b.style.setProperty("display","none","important"); } })();
(function moveCalendarBtn(){
  return;
  const btn=document.getElementById("openCalendarBtn"), bar=document.querySelector(".topbar");
  if(btn && bar){ bar.appendChild(btn); btn.classList.add("topbar-cal-btn"); btn.setAttribute("aria-label","Calendario dei movimenti"); btn.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M4 10h16M9 3v4M15 3v4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><circle cx="9" cy="14.5" r="1.2" fill="currentColor"/><circle cx="15" cy="14.5" r="1.2" fill="currentColor"/></svg>'; }
})();
document.getElementById("openCalendarBtn").addEventListener("click", openCalendar);

function openDayDetail(iso){
  const d = new Date(iso+"T00:00:00");
  openSheet("tpl-day-detail", (node)=>{
    node.querySelector("#dayDetailTitle").textContent = `Movimenti — ${d.getDate()} ${MESI[d.getMonth()]} ${d.getFullYear()}`;
    const real = state.transactions.filter(t=>t.date===iso);
    const planned = plannedItemsForDate(iso);
    const all = [...real, ...planned].sort((a,b)=> a.date.localeCompare(b.date));
    renderTxRows(node.querySelector("#dayDetailList"), all);
    node.querySelector("#dayDetailEmptyHint").hidden = all.length>0;
  });
}

/* ---------------- Backup / export / import / reset ---------------- */
function csvCell(value){
  const text=String(value ?? "");
  return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g,'""')}"` : text;
}
function exportTransactionsCsv(){
  const cats=categoriesById(), macros=macroCategoriesById(), accs=accountsById();
  const rows=[["Data","Tipo","Nome","Categoria","Macrocategoria","Conto","Conto destinazione","Importo","Nota","Origine","Deposito risparmio"]]; /* v1.67.0 — ultima colonna */
  state.transactions.slice().sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id)).forEach(t=>{
    const cat=cats[t.categoryId], macro=cat?macros[cat.macroCategoryId]:null;
    rows.push([
      t.date,
      t.type==="income"?"Entrata":t.type==="expense"?"Uscita":"Trasferimento",
      t.name||"",
      cat?.name||"",
      macro?.name||"",
      accs[t.accountId]?.name||"",
      accs[t.toAccountId]?.name||"",
      Number(t.amount||0).toFixed(2).replace(".",","),
      t.note||"",
      t.recurringId?"Ricorrente":t.plannedId?"Pianificata":t.isBalanceAdjustment?"Rettifica saldo":"Manuale",
      isSavingsDeposit(t)?"Sì":""
    ]);
  });
  const csv="\ufeff"+rows.map(row=>row.map(csvCell).join(";")).join("\r\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob),a=document.createElement("a"),d=new Date();
  a.href=url;a.download=`bilancio-movimenti-${d.getFullYear()}${pad2(d.getMonth()+1)}${pad2(d.getDate())}.csv`;
  document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  showToast("CSV esportato correttamente");
}
document.getElementById("exportCsvBtn")?.addEventListener("click",exportTransactionsCsv);
document.getElementById("exportBtn").addEventListener("click", ()=>{
  const blob = new Blob([JSON.stringify(state,null,2)], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const d = new Date();
  a.href = url;
  a.download = `bilancio-backup-${d.getFullYear()}${pad2(d.getMonth()+1)}${pad2(d.getDate())}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  safeSetLocalStorage("bilancio_last_backup",new Date().toISOString(),{notify:false});
  renderAll(); showToast("Backup esportato correttamente");
});

document.getElementById("importBtn").addEventListener("click", ()=> document.getElementById("importFile").click());
document.getElementById("importFile").addEventListener("change", (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = async ()=>{
    try{
      const parsed = JSON.parse(reader.result);
      if(!parsed.accounts || !parsed.categories || !parsed.transactions) throw new Error("formato non valido");
      if(!await askConfirm("Importare questo backup sovrascriverà tutti i dati attuali. Continuare?",{ok:"Importa",danger:true})) return;
      const previousState=state;
      state = migrate(parsed);
      if(!persist()){
        state=previousState;
        showToast("Backup valido, ma non è stato possibile salvarlo: spazio locale insufficiente.");
        return;
      }
      renderAll();
      showToast("Backup importato correttamente.");
    }catch(err){
      showToast("File non valido. Assicurati di selezionare un backup esportato da Bilancio.");
    }
    e.target.value = "";
  };
  reader.readAsText(file);
});

document.getElementById("resetBtn").addEventListener("click", async ()=>{
  if(!await askConfirm("Questa azione elimina definitivamente tutti i conti, categorie, movimenti e ricorrenti. Continuare?",{ok:"Continua"})) return;
  if(!await askConfirm("Sei davvero sicuro? L'operazione non è reversibile.",{ok:"Azzera tutto"})) return;
  state = seedState();
  persist(); renderAll();
});

document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState!=="visible") return;
  // v1.56.0: le cifre restano visibili di default; non si nascondono più da sole al ritorno sull'app
  generatePlannedTransactions();
  generateRecurringTransactions(false);
  renderAll();
});

/* ---------------- Service worker / aggiornamenti PWA ---------------- */
function showAppUpdatePrompt(registration){
  // Popup al centro: chiede se aggiornare subito. "Più tardi" lo ripropone alla prossima apertura.
  let panel=document.getElementById("appUpdatePrompt");
  if(!panel){
    panel=document.createElement("div");
    panel.id="appUpdatePrompt";
    panel.className="app-update-modal";
    panel.setAttribute("role","dialog");
    panel.setAttribute("aria-modal","true");
    panel.setAttribute("aria-labelledby","appUpdateTitle");
    panel.innerHTML=`
      <div class="app-update-card">
        <div class="app-update-icon" aria-hidden="true">↻</div>
        <h3 id="appUpdateTitle">Nuova versione disponibile</h3>
        <p>Vuoi aggiornare Bilancio adesso? I tuoi dati restano salvati sul telefono.</p>
        <div class="app-update-actions">
          <button type="button" class="app-update-later">Più tardi</button>
          <button type="button" class="app-update-now">Aggiorna</button>
        </div>
      </div>`;
    document.body.appendChild(panel);
  }
  requestAnimationFrame(()=>panel.classList.add("show"));
  const later=panel.querySelector(".app-update-later"), now=panel.querySelector(".app-update-now");
  later.onclick=()=>panel.classList.remove("show");
  now.disabled=false; now.textContent="Aggiorna";
  now.onclick=()=>{
    const waiting=registration.waiting;
    if(!waiting){ window.location.reload(); return; }
    now.disabled=true; now.textContent="Aggiorno…";
    waiting.postMessage({type:"SKIP_WAITING"});
    setTimeout(()=>window.location.reload(),4000);
  };
  setTimeout(()=>now.focus(),200);
}

if("serviceWorker" in navigator){
  let reloadingForUpdate=false;
  navigator.serviceWorker.addEventListener("controllerchange",()=>{
    if(reloadingForUpdate) return;
    reloadingForUpdate=true;
    window.location.reload();
  });

  window.addEventListener("load", async ()=>{
    try{
      const registration=await navigator.serviceWorker.register("sw.js", {updateViaCache:"none"});

      // Se un update era già stato scaricato mentre l'app era chiusa.
      if(registration.waiting && navigator.serviceWorker.controller){
        showAppUpdatePrompt(registration);
      }

      registration.addEventListener("updatefound",()=>{
        const worker=registration.installing;
        if(!worker) return;
        worker.addEventListener("statechange",()=>{
          if(worker.state==="installed" && navigator.serviceWorker.controller){
            showAppUpdatePrompt(registration);
          }
        });
      });

      // Controllo immediato e poi periodico mentre la PWA resta aperta.
      registration.update().catch(()=>{});
      setInterval(()=>registration.update().catch(()=>{}), 60*60*1000);

      // Al ritorno in primo piano controlliamo subito se esiste una nuova versione.
      document.addEventListener("visibilitychange",()=>{
        if(document.visibilityState==="visible") registration.update().catch(()=>{});
      });
    }catch(error){
      console.warn("Service worker non disponibile", error);
    }
  });
}

/* ---------------- Init ---------------- */
const appLoader=document.createElement("div");
appLoader.className="app-loader";
appLoader.innerHTML='<div class="loader-content" role="status" aria-label="Caricamento Money Tracker"><div class="loader-money" aria-hidden="true">€</div><p>Money Tracker</p><i></i></div>';
document.body.appendChild(appLoader);

document.getElementById("goSetMainAccountBtn")?.addEventListener("click",()=>switchView("accounts"));
/* v1.23.0 — Home più ordinata: il dettaglio "Da oggi a fine mese" si apre toccando Saldo previsto o
   Pagamenti in arrivo (la scelta resta ricordata su questo telefono). */
(function foldForecast(){
  const g=document.querySelector("#view-home .forecast-grid"); if(!g) return;
  let open=false; try{ open=localStorage.getItem("bilancio_fc_open")==="1"; }catch(e){}
  const tiles=["forecastTile","upcomingTile"].map(id=>document.getElementById(id)).filter(Boolean);
  const paint=()=>{ g.classList.toggle("fc-collapsed",!open); tiles.forEach(t=>t.setAttribute("aria-expanded",String(open))); };
  tiles.forEach(t=>{
    t.setAttribute("role","button"); t.tabIndex=0; t.classList.add("fc-toggle");
    const go=()=>{ open=!open; try{ localStorage.setItem("bilancio_fc_open",open?"1":"0"); }catch(e){} paint(); };
    t.addEventListener("click",go);
    t.addEventListener("keydown",e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); go(); } });
  });
  paint();
})();
document.getElementById("homeMainAccountCard")?.addEventListener("click",()=>{
  if(state.mainAccountId) openAccountEvolution(state.mainAccountId); else switchView("accounts");
});
activeView="home";
generatePlannedTransactions();
generateRecurringTransactions(false);
try{ fix168Notice(); }catch(_){ /* v1.68.0 — correzioni dei dati: avviso una volta sola */ }
try{ fix169Notice(); }catch(_){ /* v1.69.0 — conto Scommesse: avviso una volta sola */ }
try{ /* v1.70.0 — stime collegate a mano: avviso una volta sola, solo a chi usa le stime */
  let seen=false; try{ seen=localStorage.getItem("bilancio_est170_toast")==="1"; }catch(_){ }
  if(!seen && (state.estimates||[]).length){
    try{ localStorage.setItem("bilancio_est170_toast","1"); }catch(_){ }
    setTimeout(()=>showToastLong("Stime: ora contano solo i movimenti che colleghi tu. Tocca un movimento › 🎯, oppure apri una stima e scegli le uscite."),8500);
  }
}catch(_){ }
// La Home è già attiva nel markup: forziamo inoltre la sua visibilità sia
// prima sia dopo il primo frame, evitando una Home bianca al rientro dallo splash.
function ensureInitialHome(){
  activeView="home";
  document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.dataset.view==="home"));
  document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t.dataset.view==="home"));
  updateMonthNavVisibility();
  renderHeader();
  renderHome();
}
ensureInitialHome();
requestAnimationFrame(()=>{
  ensureInitialHome();
  renderAll();
});
setTimeout(()=>{
  ensureInitialHome();
  appLoader.style.opacity="0";
  setTimeout(()=>{appLoader.remove();renderAll();},300);
},650);

/* =========================================================
   v1.6.0 — Tieni premuto su un saldo: mini popup con gli ultimi 5 movimenti
   (Home) o i prossimi 5 in arrivo (R&P e previsioni).
   ========================================================= */
function lpCategory(t){return state.categories.find(c=>c.id===t.categoryId)||null;}
function lpLastMovements(filter){
  const today=todayISO();
  return state.transactions
    .filter(t=>t.date<=today && t.type!=="transfer" && (!filter || filter(t)))
    .slice()
    .sort((a,b)=>b.date.localeCompare(a.date)||String(b.id).localeCompare(String(a.id)))
    .slice(0,5);
}
function lpNextScheduled(filter){
  const today=todayISO();
  const out=[];
  const now=new Date();
  for(let k=0;k<13 && out.length<5;k++){
    const d=new Date(now.getFullYear(),now.getMonth()+k,1);
    plannedItemsForMonth(d.getFullYear(),d.getMonth())
      .filter(t=>t.date>=today && (!filter || filter(t)))
      .sort((a,b)=>a.date.localeCompare(b.date))
      .forEach(t=>{ if(out.length<5) out.push(t); });
  }
  return out;
}
function showLongPressPopup(anchor,title,items,{emptyText="Niente da mostrare.",future=false}={}){
  closeLongPressPopup();
  const pop=document.createElement("div");
  pop.className="lp-popup";pop.id="lpPopup";pop.setAttribute("role","dialog");pop.setAttribute("aria-label",title);
  const rows=items.map(t=>{
    const c=lpCategory(t);
    const name=t.name || c?.name || (t.type==="income"?"Entrata":"Uscita");
    const d=new Date(t.date+"T00:00:00");
    const when=`${d.getDate()} ${MESI_BREVI[d.getMonth()]}`;
    const kind=t.recurringId?"Ricorrente":t.plannedId?"Pianificata":"";
    const amount=balancesHidden?"••••":(t.type==="income"?"+":"−")+fmt(t.amount);
    const lpKind=future?(t.recurringId?"recurring":"planned"):"past";
    return `<div class="lp-row lp-kind-${lpKind}"><span class="lp-ic">${emojiIconHtml(c?.emoji||(t.type==="income"?"↑":"↓"))}</span><span class="lp-main"><b>${escapeHtml(name)}</b><small>${when}${future&&kind?` · ${kind}`:""}</small></span><span class="lp-amt ${t.type}">${amount}</span></div>`;
  }).join("");
  pop.innerHTML=`<div class="lp-head">${escapeHtml(title)}</div>${rows||`<p class="lp-empty">${escapeHtml(emptyText)}</p>`}`;
  document.body.appendChild(pop);
  const r=anchor.getBoundingClientRect(), vw=window.innerWidth, vh=window.innerHeight;
  const w=Math.min(330,vw-24); pop.style.width=w+"px";
  let left=Math.min(Math.max(12,r.left+r.width/2-w/2),vw-w-12);
  const ph=pop.offsetHeight;
  let top=r.bottom+8;
  if(top+ph>vh-90) top=Math.max(12,r.top-ph-8);
  pop.style.left=left+"px"; pop.style.top=top+"px";
  requestAnimationFrame(()=>pop.classList.add("show"));
  setTimeout(()=>{
    document.addEventListener("pointerdown",lpOutside,true);
    window.addEventListener("scroll",closeLongPressPopup,{once:true,capture:true});
  },0);
}
/* lpOutside, closeLongPressPopup e bindLongPress ora sono in suite.js (comuni a Bilancio e Noi Due). */
function setupLongPressTargets(){
  const byId=id=>document.getElementById(id);
  // Home — ultimi 5 movimenti
  bindLongPress(byId("netAmount"),()=>showLongPressPopup(byId("netAmount"),"Ultimi 5 movimenti",lpLastMovements(),{emptyText:"Nessun movimento registrato."}));
  /* v1.68.0 — carta del saldo nuova: stesse pressioni lunghe sulle sue parti */
  bindLongPress(byId("bhBig"),()=>showLongPressPopup(byId("bhBig"),"Ultimi 5 movimenti",lpLastMovements(),{emptyText:"Nessun movimento registrato."}));
  bindLongPress(byId("bhTileIn"),()=>showLongPressPopup(byId("bhTileIn"),"Ultime 5 entrate",lpLastMovements(t=>t.type==="income"),{emptyText:"Nessuna entrata registrata."}));
  bindLongPress(byId("bhTileOut"),()=>showLongPressPopup(byId("bhTileOut"),"Ultime 5 uscite",lpLastMovements(t=>t.type==="expense"),{emptyText:"Nessuna uscita registrata."}));
  bindLongPress(byId("bhTileFc"),()=>showLongPressPopup(byId("bhTileFc"),"Prossimi 5 in arrivo",lpNextScheduled(),{future:true,emptyText:"Nessuna voce in arrivo."}));
  bindLongPress(byId("bhMain"),()=>{
    const acc=state.accounts.find(a=>a.id===state.mainAccountId);
    showLongPressPopup(byId("bhMain"),acc?`Ultimi 5 · ${acc.name}`:"Ultimi 5 movimenti",lpLastMovements(acc?(t=>t.accountId===acc.id||t.toAccountId===acc.id):null));
  });
  bindLongPress(document.querySelector("#view-home .hero-split-item.income"),e=>showLongPressPopup(e.currentTarget||document.querySelector("#view-home .hero-split-item.income"),"Ultime 5 entrate",lpLastMovements(t=>t.type==="income"),{emptyText:"Nessuna entrata registrata."}));
  bindLongPress(document.querySelector("#view-home .hero-split-item.expense"),()=>showLongPressPopup(document.querySelector("#view-home .hero-split-item.expense"),"Ultime 5 uscite",lpLastMovements(t=>t.type==="expense"),{emptyText:"Nessuna uscita registrata."}));
  bindLongPress(byId("homeMainAccountCard"),()=>{
    const acc=state.accounts.find(a=>a.id===state.mainAccountId);
    showLongPressPopup(byId("homeMainAccountCard"),acc?`Ultimi 5 · ${acc.name}`:"Ultimi 5 movimenti",lpLastMovements(acc?(t=>t.accountId===acc.id||t.toAccountId===acc.id):null));
  });
  bindLongPress(document.querySelector("#view-home .hero-liquidity-item.all"),()=>showLongPressPopup(document.querySelector("#view-home .hero-liquidity-item.all"),"Ultimi 5 movimenti",lpLastMovements()));
  const fc=document.querySelectorAll("#view-home .forecast-grid > .fc-tile.solo, #view-home .forecast-card.rates-forecast");
  if(fc[0]) bindLongPress(fc[0],()=>showLongPressPopup(fc[0],"Ultimi 5 movimenti",lpLastMovements()));
  if(fc[1]) bindLongPress(fc[1],()=>showLongPressPopup(fc[1],"Prossimi 5 in arrivo",lpNextScheduled(),{future:true,emptyText:"Nessuna voce in arrivo."}));
  if(fc[2]) bindLongPress(fc[2],()=>showLongPressPopup(fc[2],"Prossimi 5 in arrivo",lpNextScheduled(),{future:true,emptyText:"Nessuna voce in arrivo."}));
  // R&P — prossimi 5 (mix, solo ricorrenti, solo pianificate)
  const rp=[["recurringEstimateCard","Prossimi 5 ricorrenti",t=>!!t.recurringId],["plannedEstimateCard","Prossime 5 pianificate",t=>!!t.plannedId],["rpTotalEstimateCard","Prossimi 5 · ricorrenti e pianificate",null]];
  rp.forEach(([id,title,f])=>{
    const card=byId(id); if(!card) return;
    bindLongPress(card,e=>{
      const chip=e.target.closest?.(".fc-tile");
      let filter=f, t=title;
      if(chip){
        const income=chip.classList.contains("in");
        filter=x=>(!f||f(x)) && x.type===(income?"income":"expense");
        t=title+(income?" · entrate":" · uscite");
      }
      showLongPressPopup(chip||card,t,lpNextScheduled(filter),{future:true,emptyText:"Nessuna voce in arrivo."});
    });
  });
}
setupLongPressTargets();

/* v1.6.1 — Il pulsante "nascondi importi" di R&P sta accanto al periodo (mese/giorno). */
(function moveRPEye(){
  // v1.6.2: l'occhio di R&P sta a destra della riga Totali / Ricorrenti / Pianificate.
  const eye=document.getElementById("toggleRPBalance"), toggle=document.getElementById("rpModeToggle");
  if(!eye || !toggle) return;
  const row=document.createElement("div"); row.className="rp-mode-row";
  toggle.parentNode.insertBefore(row,toggle); row.appendChild(toggle); row.appendChild(eye);
})();

/* v1.7.0 — Campo di ricerca in R&P (vale per Totali, Ricorrenti e Pianificate). */
(function setupRPSearch(){
  return; // v1.8.0: la ricerca è nel pannello "Vedi tutti" di R&P.
  const row=document.querySelector("#view-recurring .rp-mode-row")||document.getElementById("rpModeToggle");
  if(!row || document.getElementById("rpSearchInput")) return;
  const wrap=document.createElement("div");wrap.className="rp-search";
  wrap.innerHTML='<input id="rpSearchInput" class="text-input" type="search" placeholder="Cerca nome, categoria o conto" autocomplete="off">';
  row.after(wrap);
  let t=null;
  wrap.querySelector("input").addEventListener("input",e=>{clearTimeout(t);const v=e.target.value;t=setTimeout(()=>{rpSearchQuery=v;renderAll();},180);});
})();

/* =========================================================
   v1.8.0 — Pannello "Vedi tutti" di R&P (come "Vedi tutti" della Home):
   scelta Totali / Ricorrenti / Pianificate, ricerca con evidenziazione, pulsante periodo.
   ========================================================= */
function rpAllMatches(name,categoryId,accountId){
  const q=rpAllQuery.trim().toLocaleLowerCase("it"); if(!q) return true;
  const cats=categoriesById(), accs=accountsById();
  return [name,cats[categoryId]?.name,accs[accountId]?.name].filter(Boolean).join(" ").toLocaleLowerCase("it").includes(q);
}
/* =========================================================
   v1.72.0 — R&P RIFATTA: un cruscotto chiaro per il periodo scelto (di base il mese).
   In cima quanto resta da pagare e quante rate mancano, con pagato / da pagare / totale;
   poi le rate da pagare una per una (divise per settimana, con "rata 21 di 36"),
   le pagate, le rate in corso dei finanziamenti (quante ne restano e quanto manca in tutto)
   e quanto serve su ogni conto. La stessa vista sta in "Vedi tutti", con ricerca e periodo.
   "Pagata" = già registrata (le ricorrenti e le pianificate si registrano da sole il loro giorno
   o prima con "Paga"); "da pagare" = ancora in arrivo.
   ========================================================= */
let rpdPaidOpen=false, rpdAllPaidOpen=true;
function rpdD(iso,withYear){ const d=new Date(iso+"T12:00:00"); return `${d.getDate()} ${MESI_BREVI[d.getMonth()].toLowerCase()}${withYear?" "+d.getFullYear():""}`; }
function rpdRules(){ const o={}; (state.recurring||[]).forEach(r=>{o[r.id]=r;}); return o; }
/* rate totali di un ricorrente con fine (numero rate o data di fine); 0 = senza fine */
function rpdTotalRates(r){
  if(!r) return 0;
  const max=Number(r.maxOccurrences)||0;
  if(max>0) return max;
  if(!r.endDate||!r.startDate) return 0;
  let d=r.startDate,i=0,s=0;
  while(d && d<=r.endDate && s<2000){ i++; d=stepDateISO(d,r.freq,r.startDate); s++; }
  return i;
}
function rpdDateOfRate(r,n){ let d=r.startDate,i=1,s=0; while(d && i<n && s<2000){ d=stepDateISO(d,r.freq,r.startDate); i++; s++; } return d; }
function rpdRateLabel(t,rules){
  if(!t.recurringId) return "";
  const r=rules[t.recurringId]; if(!r) return "";
  const N=rpdTotalRates(r); if(!N) return "";
  const idx=recurringOccurrenceIndex(r,t.earlyFor||t.date);
  return idx?`${idx}/${N}`:"";
}
function rpdLoans(kind){
  if(kind==="planned") return [];
  return (state.recurring||[]).filter(r=>r.active!==false && r.type==="expense").map(r=>{
    const N=rpdTotalRates(r); if(!N) return null;
    let d=r.nextDate||r.startDate, s=0;
    while(d && recurringPrepaid(r,d) && s<400){ d=stepDateISO(d,r.freq,r.startDate); s++; }
    const nextIdx=d&&recurringDateWithinLimits(r,d)?recurringOccurrenceIndex(r,d):null;
    if(!nextIdx) return null;
    const left=Math.max(0,N-nextIdx+1), done=N-left;
    return {r,N,left,done,next:d,last:rpdDateOfRate(r,N),rest:round2(left*myAmount(r)),each:myAmount(r)};
  }).filter(Boolean).sort((a,b)=>a.last.localeCompare(b.last));
}
function rpdCollect(view,kind,match){
  const okKind=t=>kind==="total"||(kind==="recurring"?!!t.recurringId:!!t.plannedId);
  const pending=plannedItemsInPeriod(view).filter(t=>okKind(t)&&match(t)).sort((a,b)=>a.date.localeCompare(b.date)||String(a.name).localeCompare(String(b.name)));
  const paid=state.transactions.filter(t=>(t.recurringId||t.plannedId)&&!t.isBalanceAdjustment&&inPeriod(view,t.date)&&okKind(t)&&match(t))
    .sort((a,b)=>b.date.localeCompare(a.date)||String(b.id).localeCompare(String(a.id)));
  const sum=(L,type)=>round2(L.filter(t=>t.type===type).reduce((s,t)=>s+(Number(t.amount)||0),0));
  const cnt=(L,type)=>L.filter(t=>t.type===type).length;
  return {pending,paid,
    leftExp:sum(pending,"expense"),leftN:cnt(pending,"expense"),paidExp:sum(paid,"expense"),paidN:cnt(paid,"expense"),
    leftInc:sum(pending,"income"),leftIncN:cnt(pending,"income"),paidInc:sum(paid,"income"),paidIncN:cnt(paid,"income")};
}
function rpdMoney(v,sign){ return balancesHidden?"••••":`${sign||""}${fmt(v)}`; }
function rpdRel(iso){
  const days=Math.round((new Date(iso+"T00:00:00")-new Date(todayISO()+"T00:00:00"))/86400000);
  return days===0?"oggi":days===1?"domani":days>1&&days<7?`tra ${days} giorni`:`il ${rpdD(iso)}`;
}
/* v1.72.1 — meno testo: anello pagate/totale, cifre al posto delle frasi */
function rpdShort(v){ if(balancesHidden) return "••••"; const a=Math.abs(v); return a>=1000?fmt(v).replace(/,\d\d\s?€$/," €"):fmt(v); }
function rpdHeroHtml(D,{label,kind}){
  const totExp=round2(D.leftExp+D.paidExp), totN=D.leftN+D.paidN, pct=totN?Math.round(D.paidN/totN*100):0;
  const nextExp=D.pending.find(t=>t.type==="expense");
  const big=totN===0?`<div class="rpd-big zero">—</div>`:D.leftN===0?`<div class="rpd-big ok">Tutto pagato</div>`:`<div class="rpd-big neg">${rpdMoney(D.leftExp,"−")}</div>`;
  const ring=`<div class="rpd-ring${D.leftN===0&&totN?" done":""}" style="--p:${pct}"><div><b>${D.paidN}<i>/${totN}</i></b><small>pagate</small></div></div>`;
  const next=nextExp?`<div class="rpd-next"><span class="rpd-next-k">Prossima</span><span class="rpd-next-n">${escapeHtml(nextExp.name||"—")}</span><span class="rpd-next-d">${rpdRel(nextExp.date)}</span><b>${rpdMoney(nextExp.amount,"−")}</b></div>`:"";
  return `<section class="rpd-card rpd-hero">
    <div class="rpd-hero-row"><div class="rpd-hero-main"><div class="rpd-eyebrow">Da pagare · ${escapeHtml(label)}</div>${big}
      <div class="rpd-pills"><span class="p-left">${D.leftN} ${D.leftN===1?"rata":"rate"}</span><span class="p-ok">✓ ${rpdMoney(D.paidExp)}</span><span class="p-tot">Σ ${rpdMoney(totExp)}</span></div>
    </div>${ring}</div>
    ${next}${D.leftIncN?`<div class="rpd-inc">↑ ${rpdMoney(D.leftInc,"+")} <span>in arrivo</span></div>`:""}
  </section>`;
}
function rpdAccountsHtml(D){
  const accs=accountsById(), by={};
  D.pending.filter(t=>t.type==="expense").forEach(t=>{ const k=t.accountId||"_"; by[k]=round2((by[k]||0)+t.amount); });
  const rows=Object.entries(by).sort((a,b)=>b[1]-a[1]);
  if(!rows.length) return "";
  return `<section class="rpd-card rpd-accs"><div class="rpd-mini-h">Serve sui conti</div><div class="rpd-chips">${rows.map(([k,v])=>`<span><i>${escapeHtml(accs[k]?.name||"Conto eliminato")}</i><b>${rpdMoney(v)}</b></span>`).join("")}</div></section>`;
}
function rpdWeekKey(iso){
  const d=new Date(iso+"T12:00:00"), wd=(d.getDay()+6)%7; d.setDate(d.getDate()-wd);
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}
function rpdWeekLabel(mon){
  const cur=rpdWeekKey(todayISO());
  const nx=new Date(cur+"T12:00:00"); nx.setDate(nx.getDate()+7);
  const next=`${nx.getFullYear()}-${pad2(nx.getMonth()+1)}-${pad2(nx.getDate())}`;
  const e=new Date(mon+"T12:00:00"); e.setDate(e.getDate()+6);
  const a=new Date(mon+"T12:00:00");
  const range=a.getMonth()===e.getMonth()?`${a.getDate()}–${e.getDate()} ${MESI_BREVI[e.getMonth()].toLowerCase()}`:`${a.getDate()} ${MESI_BREVI[a.getMonth()].toLowerCase()} – ${e.getDate()} ${MESI_BREVI[e.getMonth()].toLowerCase()}`;
  return mon===cur?"Questa settimana":mon===next?"Prossima settimana":range;
}
function rpdPendingRow(t,rules,payable){
  const cats=categoriesById(), accs=accountsById();
  const cat=cats[t.categoryId]?{...cats[t.categoryId],name:categoryLabel(t.categoryId)}:{name:"Senza categoria",emoji:t.recurringId?"🔁":"📌"};
  const kind=t.recurringId?"recurring":"planned", rate=rpdRateLabel(t,rules);
  const row=document.createElement("div");
  row.setAttribute("role","button"); row.tabIndex=0;
  row.className=`template-manage-row mv-row rpd-row mv-kind-${kind}`;
  row.innerHTML=movementRowHtml({emoji:cat.emoji||"•",color:cat.color,title:t.name||cat.name,
    meta:`${rate?`<span class="rpd-rate">${rate}</span>`:""}<span class="mv-acc">${hlText(accs[t.accountId]?.name||"Conto eliminato")}</span>`,
    amountHtml:`${t.type==="income"?"+":"−"}${fmt(t.amount)}`,type:t.type,date:t.date,kind});
  const open=()=>{ if(!row._skipClick) openScheduledDetail(kind,t.recurringId||t.plannedId,t.date); };
  row.addEventListener("click",open); activateRowFromKeyboard(row,open);
  if(payable){
    if(kind==="recurring") addPayChip(row,()=>payRecurringNow(t.recurringId),`Paga ora la rata del ${rpdD(t.date)}`);
    else addPayChip(row,()=>payPlannedNow(t.plannedId),"Paga ora ed estingui");
  }
  return row;
}
function rpdRenderPending(box,D,q,onSearch){
  const rules=rpdRules(), seenRule={};
  const exp=D.pending.filter(t=>t.type==="expense"), inc=D.pending.filter(t=>t.type==="income");
  const head=document.createElement("div"); head.className="rpd-h";
  head.innerHTML=`<h2>Da pagare</h2><span class="rpd-count">${exp.length}</span>${onSearch?`<button type="button" class="rpd-search" aria-label="Vedi tutti e cerca"><svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M16 16l4.5 4.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button>`:""}`;
  if(onSearch) head.querySelector(".rpd-search").addEventListener("click",onSearch);
  box.appendChild(head);
  if(!exp.length){ const p=document.createElement("p"); p.className="rpd-empty"; p.textContent=D.paidN?"✓ Niente altro":"—"; box.appendChild(p); }
  const groups=[];
  exp.forEach(t=>{ const k=rpdWeekKey(t.date), g=groups[groups.length-1]; if(g&&g.k===k) g.items.push(t); else groups.push({k,items:[t]}); });
  const today=todayISO();
  withHighlight(q||"",()=>{
    groups.forEach(g=>{
      const gh=document.createElement("div"); gh.className="rpd-week";
      const s=round2(g.items.reduce((a,t)=>a+t.amount,0));
      gh.innerHTML=`<span>${rpdWeekLabel(g.k)}</span><b>${rpdMoney(s,"−")}</b>`;
      box.appendChild(gh);
      g.items.forEach(t=>{
        let payable=false;
        if(t.date>today){ if(t.recurringId){ if(!seenRule[t.recurringId]){ seenRule[t.recurringId]=1; payable=recurringNextDue(rules[t.recurringId])===t.date; } } else payable=true; }
        box.appendChild(rpdPendingRow(t,rules,payable));
      });
    });
    if(inc.length){
      const gh=document.createElement("div"); gh.className="rpd-week rpd-week-inc";
      gh.innerHTML=`<span>↑ In arrivo</span><b>${rpdMoney(D.leftInc,"+")}</b>`;
      box.appendChild(gh);
      inc.forEach(t=>box.appendChild(rpdPendingRow(t,rules,false)));
    }
  });
}
function rpdRenderPaid(box,D,q,open,onToggle){
  if(!D.paid.length) return;
  const head=document.createElement("button"); head.type="button"; head.className=`rpd-paid-h${open?" open":""}`;
  head.innerHTML=`<span class="rpd-count ok">✓ ${D.paid.length}</span><span>Pagate</span><b>${rpdMoney(D.paidExp,"−")}</b><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  head.addEventListener("click",onToggle);
  box.appendChild(head);
  if(!open) return;
  const list=document.createElement("div"); list.className="tx-list rp-paid-list rpd-paid-list";
  withHighlight(q||"",()=>renderTxRows(list,D.paid,{paidLabel:true}));
  const rules=rpdRules();
  D.paid.forEach((t,i)=>{ const lbl=rpdRateLabel(t,rules), row=list.children[i]; if(lbl&&row){ const m=row.querySelector(".mv-meta-text"); if(m) m.insertAdjacentHTML("afterbegin",`<span class="rpd-rate">${lbl}</span>`); } });
  box.appendChild(list);
}
function rpdLoansHtml(kind){
  const L=rpdLoans(kind); if(!L.length) return "";
  const totRest=round2(L.reduce((s,x)=>s+x.rest,0)), cats=categoriesById();
  return `<section class="rpd-card rpd-loans"><div class="rpd-h"><h2>Rate in corso</h2><span class="rpd-count">${L.length}</span><b class="rpd-h-amt">${rpdMoney(totRest)}</b></div>
    ${L.map(x=>{ const c=cats[x.r.categoryId]||{}, pct=Math.round(x.done/x.N*100), lastD=new Date(x.last+"T12:00:00");
      return `<div class="rpd-loan" data-rpd-loan="${escapeHtml(x.r.id)}" role="button" tabindex="0">
        <span class="rpd-loan-ic">${emojiIconHtml(c.emoji||"🔁")}</span>
        <div class="rpd-loan-body"><div class="rpd-loan-top"><span class="rpd-loan-name">${escapeHtml(x.r.name||"Ricorrente")}</span><b>${rpdMoney(x.rest)}</b></div>
          <div class="rpd-loan-bar"><div class="rpd-bar sm" aria-hidden="true"><i style="width:${pct}%"></i></div><span>${x.done}/${x.N}</span></div>
          <div class="rpd-loan-sub"><span>mancano <b>${x.left}</b></span><span>fine ${MESI_BREVI[lastD.getMonth()].toLowerCase()} ${String(lastD.getFullYear()).slice(2)}</span></div></div>
      </div>`; }).join("")}
  </section>`;
}
function renderRPDash(){
  const view=document.getElementById("view-recurring"); if(!view) return;
  let box=document.getElementById("rpDash");
  if(!box){ box=document.createElement("div"); box.id="rpDash"; }
  const anchorEl=view.querySelector(".rp-mode-row")||document.getElementById("rpModeToggle")||view.firstElementChild;
  if(box.previousElementSibling!==anchorEl) anchorEl.after(box);
  view.classList.add("rpd-on");
  const D=rpdCollect("recurring",rpMode,()=>true);
  const pm=periodModes.recurring||"month";
  const label=pm==="month"?MESI[viewMonth].toLowerCase():periodLabel("recurring").toLowerCase();
  box.innerHTML=rpdHeroHtml(D,{label,kind:rpMode});
  const lists=document.createElement("section"); lists.className="rpd-card rpd-lists";
  rpdRenderPending(lists,D,"",()=>{ rpAllKind=rpMode; periodModes.rpall=periodModes.recurring; rpAllQuery=""; const inp=document.getElementById("rpAllSearchInput"); if(inp) inp.value=""; openSubView("rpall"); });
  rpdRenderPaid(lists,D,"",rpdPaidOpen,()=>{ rpdPaidOpen=!rpdPaidOpen; renderRPDash(); });
  box.appendChild(lists);
  box.insertAdjacentHTML("beforeend",rpdLoansHtml(rpMode)+rpdAccountsHtml(D));
  box.querySelectorAll("[data-rpd-loan]").forEach(el=>{ const o=()=>openScheduledDetail("recurring",el.dataset.rpdLoan); el.addEventListener("click",o); activateRowFromKeyboard(el,o); });
}
function renderRPAllView(){
  /* v1.72.0 — "Vedi tutti" di R&P con lo stesso cruscotto: resta da pagare, rate una per una, pagate. */
  const view=document.getElementById("view-rpall"); if(!view) return;
  document.querySelectorAll("[data-rpall-kind]").forEach(b=>b.classList.toggle("active",b.dataset.rpallKind===rpAllKind));
  const pbtn=document.getElementById("rpAllPeriodBtn");
  if(pbtn) pbtn.innerHTML=`<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 10h16M9 3v4M15 3v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span>${periodLabel("rpall")}</span>`;
  ["rpAllUpcoming","rpAllUpcomingEmpty","rpAllPaid","rpAllPaidEmpty","rpAllSummary"].forEach(id=>{ const el=document.getElementById(id); if(el) el.hidden=true; });
  view.querySelectorAll(":scope > .rp-list-head").forEach(h=>{ h.hidden=true; });
  let box=document.getElementById("rpAllDash");
  if(!box){ box=document.createElement("div"); box.id="rpAllDash"; (view.querySelector(".tx-search-filter")||view.firstElementChild).after(box); }
  const D=rpdCollect("rpall",rpAllKind,t=>rpAllMatches(t.name,t.categoryId,t.accountId));
  const pm=periodModes.rpall||"month";
  const label=(pm==="month"?MESI[viewMonth]:periodLabel("rpall")).toLowerCase()+(rpAllQuery.trim()?` · “${rpAllQuery.trim()}”`:"");
  box.innerHTML=rpdHeroHtml(D,{label,kind:rpAllKind});
  const lists=document.createElement("section"); lists.className="rpd-card rpd-lists";
  rpdRenderPending(lists,D,rpAllQuery,null);
  rpdRenderPaid(lists,D,rpAllQuery,rpdAllPaidOpen,()=>{ rpdAllPaidOpen=!rpdAllPaidOpen; renderRPAllView(); });
  box.appendChild(lists);
  if(!rpAllQuery.trim()) box.insertAdjacentHTML("beforeend",rpdAccountsHtml(D));
}
document.querySelectorAll("[data-rpall-kind]").forEach(b=>b.addEventListener("click",()=>{rpAllKind=b.dataset.rpallKind;renderRPAllView();}));
document.getElementById("rpAllPeriodBtn")?.addEventListener("click",()=>openPeriodPicker("rpall"));
(function(){let t=null;document.getElementById("rpAllSearchInput")?.addEventListener("input",e=>{clearTimeout(t);const v=e.target.value;t=setTimeout(()=>{rpAllQuery=v;renderRPAllView();},180);});})();

// v1.9.2 — La copertura della barra di stato appare solo quando si scorre.
(function(){
  const upd=()=>document.documentElement.classList.toggle("is-scrolled",window.scrollY>4);
  window.addEventListener("scroll",upd,{passive:true}); upd();
})();

/* Promemoria backup comune alle 4 app (30 giorni, al massimo una volta a settimana). */
setTimeout(()=>{ if(window.SuiteBackup) SuiteBackup.maybe({app:"Bilancio",key:"bilancio",last:localStorage.getItem("bilancio_last_backup"),hasData:state.transactions.length>0,onExport:()=>document.getElementById("exportBtn").click()}); },3000);

/* v1.15.0 — Sincronizzazione online (Supabase), tabella app_data, app "bilancio". */
var syncBilancio = window.SuiteSync ? SuiteSync.register({
  app:"bilancio", name:"Bilancio", scope:"personal",
  getLocal:()=>state,
  hasLocalData:()=>state.transactions.length>0||state.recurring.length>0||state.planned.length>0,
  // Unione: conti e categorie con lo stesso nome diventano uno solo (i dati iniziali di un telefono nuovo non si duplicano).
  merge:(local,remote,remoteNewer)=>{
    const newer=JSON.parse(JSON.stringify(remoteNewer?remote:local)), older=JSON.parse(JSON.stringify(remoteNewer?local:remote));
    const norm=v=>String(v||"").trim().toLowerCase(), map={};
    [["accounts",x=>norm(x.name)],["macroCategories",x=>x.kind+"|"+norm(x.name)],["categories",x=>x.kind+"|"+norm(x.name)]].forEach(([k,key])=>{
      const ids=new Set((newer[k]||[]).map(x=>x.id));
      (older[k]||[]).forEach(x=>{ if(ids.has(x.id)) return; const twin=(newer[k]||[]).find(y=>key(y)===key(x)); if(twin) map[x.id]=twin.id; else (newer[k]=newer[k]||[]).push(x); });
    });
    const m=id=>id!=null&&map[id]?map[id]:id;
    (newer.categories||[]).forEach(c=>{ c.macroCategoryId=m(c.macroCategoryId); });
    ["transactions","recurring","planned","loanRates","trash"].forEach(k=>{
      const ids=new Set((newer[k]||[]).map(x=>x.id));
      (older[k]||[]).forEach(x=>{ if(ids.has(x.id)) return; ["accountId","toAccountId","categoryId","accId"].forEach(f=>{ if(x[f]!=null) x[f]=m(x[f]); }); (newer[k]=newer[k]||[]).push(x); });
    });
    // un elemento eliminato su un telefono (finito nel cestino) non deve tornare dall'altro
    const trashed=new Set((newer.trash||[]).map(e=>e?.data?.id).filter(Boolean));
    ["transactions","recurring","planned"].forEach(k=>{ newer[k]=(newer[k]||[]).filter(x=>!trashed.has(x.id)); });
    if(!newer.mainAccountId) newer.mainAccountId=m(older.mainAccountId)||null;
    if(!newer.savingsAccountId) newer.savingsAccountId=m(older.savingsAccountId)||null;
    if(!newer.betAccountId) newer.betAccountId=m(older.betAccountId)||null;
    if(newer.savingsTarget==null && older.savingsTarget!=null) newer.savingsTarget=older.savingsTarget;
    return newer;
  },
  localUpdatedAt:()=>state.updatedAt||null,
  onStatus:()=>{ if(typeof pushOnSyncStatus==="function") pushOnSyncStatus(); },
  setLocal:(data)=>{ state=migrate(JSON.parse(JSON.stringify(data))); balanceCache.clear(); safeSetLocalStorage(STORAGE_KEY, JSON.stringify(state)); renderAll(); },
}) : null;
(function(){ const slot=document.getElementById("suiteSyncSlot"); if(slot&&window.SuiteSync) slot.innerHTML=SuiteSync.cardHtml("bilancio",{cls:"section-block suite-sync-block",h:"h2"}); })();


/* ---------------- v1.18.0 — Notifiche push "Scadenze di domani" ----------------
   Il telefono si iscrive (permesso + indirizzo push salvato in Supabase, tabella push_subscriptions).
   Ogni ora la funzione notify-scadenze su Supabase controlla a chi tocca e, all'ora scelta, invia
   le ricorrenti e le pianificate del giorno dopo. Guida completa: GUIDA_NOTIFICHE.txt */
const PUSH_VAPID_PUBLIC="BFlNut-5sgpCsMd-xNtXEczfzjT9AoOyxgyGHJSn6t8QTnT1ygdRc_OT9-GNFnoWJrP1YpuCh8yhbwEa1dBDSsY";
const PUSH_FN="/functions/v1/notify-scadenze";
let pushState={sub:null,row:null,busy:false,msg:"",err:false,loaded:false};
function pushSupported(){ return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window; }
function pushIsIOS(){ return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform==="MacIntel" && navigator.maxTouchPoints>1); }
function pushStandalone(){ return window.navigator.standalone===true || (window.matchMedia && matchMedia("(display-mode: standalone)").matches); }
function b64uToUint8(str){
  const pad="=".repeat((4-str.length%4)%4), b=atob((str+pad).replace(/-/g,"+").replace(/_/g,"/"));
  return Uint8Array.from(b,c=>c.charCodeAt(0));
}
function pushErrText(e){
  const t=String(e&&e.message||e||"");
  if(/monthly_summary|last_monthly_sent/.test(t)) return "Su Supabase manca il riepilogo mensile: esegui supabase/riepilogo_mensile.sql (vedi GUIDA_NOTIFICHE).";
  if(/push_subscriptions/.test(t) && /(does not exist|42P01|PGRST205|schema cache)/.test(t)) return "Su Supabase manca la tabella delle notifiche: esegui il passo 2 della guida.";
  if(/notify-scadenze|404/.test(t) && /function|not found|NOT_FOUND/i.test(t)) return "Su Supabase manca la funzione notify-scadenze: esegui il passo 4 della guida.";
  if(e&&e.auth) return "Rifai l'accesso alla sincronizzazione qui sopra.";
  return t.replace(/^Errore \d+:\s*/,"").slice(0,160) || "Qualcosa non ha funzionato.";
}
async function pushRegistration(){
  if(!("serviceWorker" in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration()) || null;
}
async function refreshPushState(){
  if(!pushSupported()){ pushState.loaded=true; renderPushCard(); return; }
  try{
    const reg=await pushRegistration();
    pushState.sub=reg?await reg.pushManager.getSubscription():null;
    pushState.row=null;
    if(pushState.sub && window.SuiteSync && SuiteSync.signedIn){
      // select=* : se la colonna del riepilogo mensile non esiste ancora, semplicemente non arriva
      const rows=await SuiteSync.api(`/rest/v1/push_subscriptions?select=*&endpoint=eq.${encodeURIComponent(pushState.sub.endpoint)}`);
      pushState.row=rows[0]||null;
    }
  }catch(e){ pushState.msg=pushErrText(e); pushState.err=true; }
  pushState.loaded=true;
  renderPushCard();
}
function pushHourOptions(sel){
  let h="";
  for(let i=6;i<=22;i++) h+=`<option value="${i}"${i===sel?" selected":""}>${pad2(i)}:00</option>`;
  return h;
}
function renderPushCard(){
  const card=document.getElementById("pushCard"); if(!card) return;
  if(card.contains(document.activeElement) && document.activeElement.tagName==="SELECT") return;
  const on=!!(pushState.sub && pushState.row && pushState.row.enabled!==false);
  let dot="off", status, inner="";
  if(!pushSupported()){
    status=pushIsIOS() && !pushStandalone()
      ? "Per ricevere le notifiche apri Bilancio dall'icona sulla schermata Home (iPhone con iOS 16.4 o successivo)."
      : "Questo browser non supporta le notifiche push.";
  } else if(!(window.SuiteSync && SuiteSync.signedIn)){
    status="Collega prima la sincronizzazione qui sopra: le notifiche partono dal server.";
  } else if(!pushState.loaded){
    status="Controllo…"; dot="busy";
  } else if(on){
    dot="on";
    const hour=Number(pushState.row.notify_hour??8);
    status=`Attive su questo telefono: ogni giorno alle ${pad2(hour)}:00 ti avviso delle ricorrenti e pianificate del giorno dopo.`;
    inner=`<div class="push-settings">
        <label class="push-line"><span>Ora dell'avviso</span><select id="pushHourSelect" class="text-input" aria-label="Ora dell'avviso">${pushHourOptions(hour)}</select></label>
        <label class="toggle-line push-line"><input type="checkbox" id="pushAmountsInput"${pushState.row.show_amounts?" checked":""}> Mostra gli importi nella notifica</label>
        ${"monthly_summary" in pushState.row
          ? `<label class="toggle-line push-line"><input type="checkbox" id="pushMonthlyInput"${pushState.row.monthly_summary!==false?" checked":""}> Riepilogo mensile (il giorno 1, alla stessa ora)</label>`
          : `<p class="push-msg">Riepilogo mensile: per attivarlo esegui su Supabase il file supabase/riepilogo_mensile.sql (vedi GUIDA_NOTIFICHE).</p>`}
      </div>
      <div class="suite-sync-actions"><button type="button" class="suite-sync-primary primary" id="pushTestBtn"${pushState.busy?" disabled":""}>Invia una prova</button>${"monthly_summary" in pushState.row?`<button type="button" id="pushTestMonthlyBtn"${pushState.busy?" disabled":""}>Prova riepilogo</button>`:""}<button type="button" id="pushOffBtn"${pushState.busy?" disabled":""}>Disattiva</button></div>`;
  } else {
    status=Notification.permission==="denied"
      ? "Notifiche bloccate per Bilancio: riattivale in Impostazioni › Notifiche › Bilancio, poi torna qui."
      : "Ricevi la sera prima un avviso con le ricorrenti e le pianificate in scadenza il giorno dopo.";
    inner=`<button type="button" class="suite-sync-primary primary push-on-btn" id="pushOnBtn"${pushState.busy||Notification.permission==="denied"?" disabled":""}>🔔 Attiva notifiche</button>`;
  }
  const msg=pushState.msg?`<p class="push-msg${pushState.err?" err":""}">${escapeHtml(pushState.msg)}</p>`:"";
  card.innerHTML=`<h2>Notifiche</h2><p class="suite-sync-status"><span class="suite-sync-dot ${dot}" aria-hidden="true"></span>${escapeHtml(status)}</p>${inner}${msg}`;
}
let pushLastSigned=null;
function pushOnSyncStatus(){
  const signed=!!(window.SuiteSync && SuiteSync.signedIn);
  if(signed!==pushLastSigned){ pushLastSigned=signed; refreshPushState(); } else renderPushCard();
}
function pushSay(text,err=false){ pushState.msg=text; pushState.err=err; renderPushCard(); }
async function pushSaveRow(extra){
  const j=pushState.sub.toJSON();
  await SuiteSync.api("/rest/v1/push_subscriptions?on_conflict=endpoint",{method:"POST",
    headers:{Prefer:"resolution=merge-duplicates,return=minimal"},
    json:Object.assign({user_id:SuiteSync.userId,app:"bilancio",endpoint:j.endpoint,p256dh:j.keys.p256dh,auth:j.keys.auth,
      tz:(Intl.DateTimeFormat().resolvedOptions().timeZone||"Europe/Rome"),device:navigator.userAgent.slice(0,120),
      enabled:true,updated_at:new Date().toISOString()},extra||{})});
}
async function pushEnable(){
  if(pushState.busy) return;
  pushState.busy=true; pushSay("");
  try{
    // Il permesso va chiesto subito dopo il tocco (regola di iOS).
    const perm=await Notification.requestPermission();
    if(perm!=="granted"){ pushState.busy=false; pushSay(perm==="denied"?"Permesso negato. Puoi riattivarlo in Impostazioni › Notifiche › Bilancio.":"Permesso non concesso.",true); return; }
    const reg=await pushRegistration();
    if(!reg) throw new Error("Service worker non attivo: riapri l'app e riprova.");
    pushState.sub=(await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64uToUint8(PUSH_VAPID_PUBLIC)}));
    await pushSaveRow({notify_hour:pushState.row?.notify_hour??20,show_amounts:pushState.row?.show_amounts??false});
    pushState.row={notify_hour:pushState.row?.notify_hour??20,show_amounts:pushState.row?.show_amounts??false,enabled:true};
    pushState.busy=false; pushSay("Fatto. Tocca \"Invia una prova\" per controllare che arrivino.");
  }catch(e){ pushState.busy=false; pushSay(pushErrText(e),true); }
}
async function pushDisable(){
  if(pushState.busy||!pushState.sub) return;
  pushState.busy=true; renderPushCard();
  const endpoint=pushState.sub.endpoint;
  try{ await SuiteSync.api(`/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`,{method:"DELETE"}); }catch(e){}
  try{ await pushState.sub.unsubscribe(); }catch(e){}
  pushState.sub=null; pushState.row=null; pushState.busy=false;
  pushSay("Notifiche disattivate su questo telefono.");
}
async function pushUpdate(patch){
  if(!pushState.sub) return;
  const prev=Object.assign({},pushState.row);
  Object.assign(pushState.row,patch); pushState.msg=""; renderPushCard();
  try{
    await SuiteSync.api(`/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(pushState.sub.endpoint)}`,{method:"PATCH",
      headers:{Prefer:"return=minimal"},json:Object.assign({updated_at:new Date().toISOString()},patch)});
  }catch(e){ pushState.row=prev; pushSay(pushErrText(e),true); }
}
async function pushTest(kind){
  if(pushState.busy) return;
  const monthly=kind==="monthly";
  pushState.busy=true; pushSay(monthly?"Invio il riepilogo del mese scorso…":"Invio la prova…");
  try{
    if(syncBilancio) await syncBilancio.sync("push-test"); // la funzione legge i dati online: prima li aggiorno
    const r=await SuiteSync.api(PUSH_FN,{method:"POST",json:{test:monthly?"monthly":true}});
    pushState.busy=false;
    pushSay(r&&r.sent?"Prova inviata: dovrebbe arrivare tra pochi secondi.":"La prova non è partita: disattiva e riattiva le notifiche.",!(r&&r.sent));
  }catch(e){ pushState.busy=false; pushSay(pushErrText(e),true); }
}
document.getElementById("pushCard")?.addEventListener("click",e=>{
  const id=e.target.closest("button")?.id;
  if(id==="pushOnBtn") pushEnable();
  else if(id==="pushOffBtn") pushDisable();
  else if(id==="pushTestBtn") pushTest();
  else if(id==="pushTestMonthlyBtn") pushTest("monthly");
});
document.getElementById("pushCard")?.addEventListener("change",e=>{
  if(e.target.id==="pushHourSelect") pushUpdate({notify_hour:Number(e.target.value)});
  else if(e.target.id==="pushAmountsInput") pushUpdate({show_amounts:e.target.checked});
  else if(e.target.id==="pushMonthlyInput") pushUpdate({monthly_summary:e.target.checked});
});
renderPushCard();
setTimeout(refreshPushState,1500);
document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="visible") refreshPushState(); });

/* Aperta da una notifica: va su R&P (?view=recurring) o sulle Statistiche di un mese
   (?view=stats&month=2026-09, dal riepilogo mensile), anche via messaggio dal service worker. */
(function(){
  const go=(v,month)=>{
    try{
      if(v==="recurring") switchView("recurring");
      else if(v==="stats"){
        const m=/^(\d{4})-(\d{2})$/.exec(month||"");
        if(m){ viewYear=Number(m[1]); viewMonth=Number(m[2])-1; statsTrendRange="1m"; }
        switchView("stats");
      }
    }catch(e){}
  };
  try{ const q=new URLSearchParams(location.search), v=q.get("view"); if(v){ go(v,q.get("month")); history.replaceState(null,"",location.pathname); } }catch(e){}
  if("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message",e=>{ if(e.data&&e.data.type==="open-view") go(e.data.view,e.data.month); });
})();

/* =========================================================
   v1.65.0 — CONSULTAZIONI E INSERIMENTI PIÙ VELOCI
   ========================================================= */
/* Filtri veloci dei Movimenti (categoria e conto) e menu a tendina: tieni premuto un filtro (o tocca "Tutti" se è già
   acceso) e si apre l'elenco completo, con importo e numero di movimenti. Stesso comportamento delle altre app. */
function mtChipsHtml(pool){
  const cats=categoriesById(), accs=accountsById(), byCat=new Map(), byAcc=new Map();
  pool.forEach(t=>{
    if(t.type!=="transfer" && t.categoryId){ const c=cats[t.categoryId]; const k=c?(c.parentCategoryId&&cats[c.parentCategoryId]?c.parentCategoryId:c.id):null; if(k){ const g=byCat.get(k)||{n:0,s:0}; g.n++; g.s+=t.amount; byCat.set(k,g); } }
    [t.accountId,t.toAccountId].filter(Boolean).forEach(a=>{ if(!accs[a]) return; const g=byAcc.get(a)||{n:0}; g.n++; byAcc.set(a,g); });
  });
  const money=v=>balancesHidden?"••":new Intl.NumberFormat("it-IT",{maximumFractionDigits:0}).format(v)+" €";
  const on0=!txCatFilter&&!txAccFilter;
  let h=`<div class="mchips" role="toolbar" aria-label="Filtri veloci" data-mchipmenu="Filtra i movimenti"><span class="mc-sep" data-t="Categoria" hidden></span>`;
  h+=`<button type="button" class="mchip${on0?" on":""}" data-mtf="all" data-chip-radio data-ic="☰"><span data-lab>Tutti</span>${on0?'<span class="mc-chev">▾</span>':""}<i>${pool.length}</i></button>`;
  [...byCat.entries()].sort((a,b)=>b[1].s-a[1].s).forEach(([id,g])=>{
    const c=cats[id]; const on=txCatFilter===id;
    h+=`<button type="button" class="mchip${on?" on":""}" data-mtf="cat:${escapeHtml(id)}" style="--c:${safeColor(c.color)}" data-ic="${escapeHtml(c.emoji||"•")}"><span class="mc-em">${escapeHtml(c.emoji||"•")}</span><span data-lab>${escapeHtml(c.name)}</span><b${c.kind==="income"?' class="in"':""}>${money(g.s)}</b><i>${g.n}</i></button>`;
  });
  if(byAcc.size>1){
    h+=`<span class="mc-sep" data-t="Conto"></span>`;
    [...byAcc.entries()].sort((a,b)=>b[1].n-a[1].n).forEach(([id,g])=>{
      const a=accs[id]; const on=txAccFilter===id;
      h+=`<button type="button" class="mchip${on?" on":""}" data-mtf="acc:${escapeHtml(id)}" style="--c:${safeColor(a.color)}" data-dot><span class="mc-dot"></span><span data-lab>${escapeHtml(a.name)}</span><i>${g.n}</i></button>`;
    });
  }
  return h+`</div>`;
}
document.addEventListener("click",e=>{
  const b=e.target.closest&&e.target.closest("[data-mtf]"); if(!b) return;
  const v=b.dataset.mtf;
  if(v==="all"){ txCatFilter=""; txAccFilter=""; }
  else if(v.startsWith("cat:")){ const id=v.slice(4); txCatFilter=txCatFilter===id?"":id; }
  else if(v.startsWith("acc:")){ const id=v.slice(4); txAccFilter=txAccFilter===id?"":id; }
  txVisibleLimit=TX_PAGE_SIZE;
  renderTransactionsView();
  setTimeout(()=>{ const c=document.querySelector(".mchips .mchip.on"); if(c&&c.scrollIntoView) c.scrollIntoView({inline:"center",block:"nearest"}); },30);
});
/* Menu a tendina (vetro) ancorato al filtro */
let mtMenuIgnore=0, mtLpChip=null;
function mtMenuClose(){ document.querySelector(".mt-ddov")?.remove(); if(mtLpChip){ mtLpChip._lpAt=0; mtLpChip=null; } }
function mtMenuShow(anchor,title,inner,at){
  mtMenuClose();
  const ov=document.createElement("div"); ov.className="mt-ddov";
  ov.innerHTML=`<div class="mt-dd" role="menu">${title?`<div class="mt-dd-t">${escapeHtml(title)}</div>`:""}${inner}</div>`;
  document.body.appendChild(ov);
  const m=ov.firstChild, r=anchor.getBoundingClientRect(), vw=innerWidth, vh=innerHeight, h=m.offsetHeight, w=m.offsetWidth;
  let top=(at?at.y:r.bottom)+6; const left=at?at.x-w/2:r.left;
  if(top+h>vh-10) top=(at?at.y:r.top)-6-h;
  if(top<10){ top=10; m.style.maxHeight=(vh-20)+"px"; }
  m.style.top=top+"px"; m.style.left=Math.max(10,Math.min(left,vw-w-10))+"px";
  ov.addEventListener("click",ev=>{ if(ev.target===ov && Date.now()>=mtMenuIgnore) mtMenuClose(); });
  try{ navigator.vibrate?.(15); }catch(_){}
}
function mtChipMenuOpen(b){
  const row=b.closest("[data-mchipmenu]"); if(!row) return;
  let html="";
  [...row.children].forEach(c=>{
    if(c.classList.contains("mc-sep")){ const t=c.dataset.t; if(t) html+=`<div class="mt-dd-t sub">${escapeHtml(t)}</div>`; return; }
    if(c.tagName!=="BUTTON") return;
    const on=c.classList.contains("on");
    const attrs=[...c.attributes].filter(a=>/^data-/.test(a.name)&&!["data-chip-radio","data-ic","data-dot"].includes(a.name)).map(a=>` ${a.name}="${escapeHtml(a.value)}"`).join("");
    const st=c.getAttribute("style"), lab=c.querySelector("[data-lab]")?.textContent||c.textContent, pc=c.querySelector("b"), n=c.querySelector("i");
    const ic=c.hasAttribute("data-dot")?'<span class="mc-dot"></span>':escapeHtml(c.dataset.ic||"");
    html+=`<button type="button" class="mt-dd-o${on?" on":""}"${attrs}${st?` style="${escapeHtml(st)}"`:""}><span class="mt-dd-ic">${ic}</span><span class="mt-dd-l">${escapeHtml(lab)}</span>${pc?`<b class="${pc.className}">${escapeHtml(pc.textContent)}</b>`:"<b></b>"}${n?`<i>${escapeHtml(n.textContent)}</i>`:""}<em>${on?"✓":""}</em></button>`;
  });
  mtMenuShow(b,row.dataset.mchipmenu||"Filtri",html);
}
(function(){
  let timer=null,x0=0,y0=0,chip=null;
  const stop=()=>{ clearTimeout(timer); timer=null; chip?.classList.remove("mc-lp"); chip=null; };
  document.addEventListener("pointerdown",e=>{
    const b=e.target.closest&&e.target.closest("[data-mchipmenu] > button"); if(!b) return;
    stop(); chip=b; x0=e.clientX; y0=e.clientY; b.classList.add("mc-lp");
    timer=setTimeout(()=>{ timer=null; b.classList.remove("mc-lp"); b._lpAt=Date.now(); mtMenuIgnore=Infinity; mtChipMenuOpen(b); mtLpChip=b; },450);
  });
  document.addEventListener("pointermove",e=>{ if(timer&&(Math.abs(e.clientX-x0)>8||Math.abs(e.clientY-y0)>8)) stop(); },true);
  ["pointercancel","scroll"].forEach(n=>document.addEventListener(n,stop,true));
  document.addEventListener("pointerup",()=>{ if(mtMenuIgnore===Infinity) mtMenuIgnore=Date.now()+350; stop(); },true);
  document.addEventListener("contextmenu",e=>{ if(e.target.closest&&e.target.closest("[data-mchipmenu] > button")) e.preventDefault(); });
  document.addEventListener("keydown",e=>{ if(e.key==="Escape") mtMenuClose(); });
  document.addEventListener("click",e=>{
    const eat=()=>{ e.stopPropagation(); e.preventDefault(); };
    const o=e.target.closest&&e.target.closest(".mt-dd .mt-dd-o");
    if(o){ if(Date.now()<mtMenuIgnore){ eat(); return; } if(o.classList.contains("on")){ eat(); mtMenuClose(); return; } mtMenuClose(); return; }
    const b=e.target.closest&&e.target.closest("[data-mchipmenu] > button"); if(!b) return;
    if(b._lpAt&&Date.now()-b._lpAt<1500){ b._lpAt=0; eat(); return; }
    if(b.classList.contains("on")&&b.hasAttribute("data-chip-radio")){ eat(); mtMenuIgnore=Date.now()+100; mtChipMenuOpen(b); }
  },true);
})();

/* Scorri una riga col dito: verso sinistra = elimina (con Annulla), verso destra = duplica con la data di oggi.
   Dal bordo sinistro dello schermo resta il gesto "indietro". */
function enableRowSwipe(row,{onLeft,onRight}){
  let x0=0,y0=0,dx=0,on=false,dead=true,bg=null;
  const TH=90;
  row.addEventListener("touchstart",e=>{ if(e.touches.length!==1){dead=true;return;} const t=e.touches[0]; x0=t.clientX; y0=t.clientY; dx=0; on=false; dead=x0<28; },{passive:true});
  row.addEventListener("touchmove",e=>{
    if(dead) return;
    const t=e.touches[0], ddx=t.clientX-x0, ddy=t.clientY-y0;
    if(!on){
      if(Math.abs(ddy)>10&&Math.abs(ddy)>=Math.abs(ddx)){ dead=true; return; }
      if(Math.abs(ddx)<12||Math.abs(ddx)<Math.abs(ddy)*1.3) return;
      if((ddx>0&&!onRight)||(ddx<0&&!onLeft)){ dead=true; return; }
      on=true; row._skipClick=true; row.classList.add("sw-on");
      const host=row.parentElement; if(host&&getComputedStyle(host).position==="static") host.style.position="relative";
      bg=document.createElement("div"); bg.className="sw-bg"; bg.style.top=row.offsetTop+"px"; bg.style.height=row.offsetHeight+"px"; bg.style.left=row.offsetLeft+"px"; bg.style.width=row.offsetWidth+"px";
      bg.innerHTML='<span class="sw-dup">⧉ Duplica</span><span class="sw-del">Elimina 🗑</span>';
      row.before(bg);
    }
    e.preventDefault(); e.stopPropagation();
    dx=ddx; row.style.transform=`translateX(${dx}px)`;
    bg.classList.toggle("left",dx<0); bg.classList.toggle("right",dx>0); bg.classList.toggle("armed",Math.abs(dx)>=TH);
  },{passive:false});
  const end=e=>{
    if(!on) return;
    e.stopPropagation();
    on=false; dead=true;
    const armed=Math.abs(dx)>=TH, left=dx<0;
    row.style.transition="transform .18s ease";
    row.style.transform=armed&&left?"translateX(-110%)":"";
    setTimeout(()=>{ row.style.transition=""; row.classList.remove("sw-on"); bg?.remove(); bg=null; setTimeout(()=>row._skipClick=false,60);
      if(armed){ try{ navigator.vibrate?.(12); }catch(_){} if(left) onLeft(); else { row.style.transform=""; onRight(); } } },190);
  };
  row.addEventListener("touchend",end);
  row.addEventListener("touchcancel",end);
}

/* Home a modo tuo: ordine e riquadri visibili (Altro › Gestione › Riquadri della Home). Salvato su questo telefono. */
const HOME_LAYOUT_KEY="bilancio_home_layout";
const HOME_BOXES=[
  ["saldo","Saldo del mese e liquidità",()=>document.querySelector("#view-home > .hero")],
  ["previsioni","Previsioni del mese",()=>document.getElementById("forecastPanel")],
  ["risparmio","Risparmio del mese",()=>document.getElementById("savingsBlock")],
  ["movimenti","Movimenti recenti",()=>document.getElementById("recentTx")?.closest(".section-block")],
  ["scadenze","Prossime scadenze",()=>document.getElementById("upcomingHomeBlock")],
  ["budget","Budget e spese",()=>document.getElementById("budgetList")?.closest(".section-block")],
];
function homeLayout(){
  let L=null; try{ L=JSON.parse(localStorage.getItem(HOME_LAYOUT_KEY)||"null"); }catch(_){}
  const keys=HOME_BOXES.map(b=>b[0]);
  const order=(L&&Array.isArray(L.order)?L.order.filter(k=>keys.includes(k)):[]);
  keys.forEach(k=>{ if(!order.includes(k)) order.push(k); });
  return {order,off:(L&&L.off)||{}};
}
function applyHomeLayout(){
  const home=document.getElementById("view-home"); if(!home) return;
  const L=homeLayout(), notice=document.getElementById("mainAccountSetupNotice");
  const anchor=[...home.children].find(el=>HOME_BOXES.some(b=>b[2]()===el))||null;
  const els=L.order.map(k=>[k,HOME_BOXES.find(b=>b[0]===k)[2]()]).filter(x=>x[1]);
  if(!els.length) return;
  const marker=document.createComment("home"); home.insertBefore(marker,anchor);
  els.forEach(([k,el])=>{ home.insertBefore(el,marker); el.classList.toggle("home-off",!!L.off[k]); if(k==="saldo"&&notice) home.insertBefore(notice,marker); });
  marker.remove();
}
function openHomeLayout(){
  if(!document.getElementById("tpl-home-layout")){
    const t=document.createElement("template"); t.id="tpl-home-layout";
    t.innerHTML=`<div class="sheet" id="sheetHomeLayout"><div class="sheet-handle"></div><div class="sheet-head"><h3>Riquadri della Home</h3><button class="primary-btn" id="homeLayoutDone">Fatto</button></div><p class="field-hint">Spegni quelli che non ti servono e sposta in alto quelli che guardi di più.</p><div class="hl-list" id="homeLayoutList"></div><button type="button" class="pill-btn hl-reset" id="homeLayoutReset">Ripristina l'ordine iniziale</button></div>`;
    document.body.appendChild(t);
  }
  openSheet("tpl-home-layout",(node,close)=>{
    const list=node.querySelector("#homeLayoutList");
    const save=L=>{ try{ localStorage.setItem(HOME_LAYOUT_KEY,JSON.stringify(L)); }catch(_){} applyHomeLayout(); };
    const draw=()=>{
      const L=homeLayout();
      list.innerHTML=L.order.map((k,i)=>{ const b=HOME_BOXES.find(x=>x[0]===k); const on=!L.off[k];
        return `<div class="hl-row${on?"":" off"}"><button type="button" class="hl-sw${on?" on":""}" data-hl-sw="${k}" role="switch" aria-checked="${on}" aria-label="Mostra ${escapeHtml(b[1])}"><span></span></button><span class="hl-name">${escapeHtml(b[1])}</span><button type="button" class="hl-mv" data-hl-mv="${k}:-1" ${i===0?"disabled":""} aria-label="Sposta su">↑</button><button type="button" class="hl-mv" data-hl-mv="${k}:1" ${i===L.order.length-1?"disabled":""} aria-label="Sposta giù">↓</button></div>`; }).join("");
    };
    list.addEventListener("click",e=>{
      const L=homeLayout(), sw=e.target.closest("[data-hl-sw]"), mv=e.target.closest("[data-hl-mv]");
      if(sw){ const k=sw.dataset.hlSw; if(L.off[k]) delete L.off[k]; else { if(L.order.filter(x=>!L.off[x]).length<=1){ showToast("Lascia almeno un riquadro"); return; } L.off[k]=1; } save(L); draw(); }
      else if(mv){ const [k,d]=mv.dataset.hlMv.split(":"); const i=L.order.indexOf(k), j=i+Number(d); if(j<0||j>=L.order.length) return; L.order.splice(i,1); L.order.splice(j,0,k); save(L); draw(); }
    });
    node.querySelector("#homeLayoutReset").addEventListener("click",()=>{ try{ localStorage.removeItem(HOME_LAYOUT_KEY); }catch(_){} applyHomeLayout(); draw(); showToast("Home come all'inizio"); });
    node.querySelector("#homeLayoutDone").addEventListener("click",()=>close());
    draw();
  });
}
document.getElementById("openHomeLayoutBtn")?.addEventListener("click",openHomeLayout);
applyHomeLayout();
/* ===== BOLLE "ANALISI" (comuni alle app) =====
   Cerchi con l'area proporzionale al valore, impaccati attorno al centro (stile app della banca): il più grande al
   centro, gli altri appoggiati vicino. Un valore a zero resta una bolla piccola e spenta. Senza librerie. */
function bubPack(items, W, H) {
  var vals = items.map(function (it) { return Math.max(0, Number(it.value) || 0); });
  var max = Math.max.apply(null, vals.concat([0]));
  var R = Math.min(W, H) * 0.34, Rmin = R * 0.36, gap = Math.min(W, H) * 0.025;
  var C = items.map(function (it, i) { return { i: i, r: vals[i] > 0 && max > 0 ? Math.max(Rmin, R * Math.sqrt(vals[i] / max)) : Rmin * 0.92 }; });
  var order = C.slice().sort(function (a, b) { return b.r - a.r; }), placed = [];
  order.forEach(function (c, n) {
    if (!n) { c.x = 0; c.y = 0; placed.push(c); return; }
    var best = null, A = 0, gx = 0, gy = 0;
    placed.forEach(function (q) { var w = q.r * q.r; A += w; gx += q.x * w; gy += q.y * w; });
    gx /= A; gy /= A;
    placed.forEach(function (p) {
      for (var k = 0; k < 72; k++) {
        var a = (k / 72) * Math.PI * 2, d = p.r + c.r + gap, x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
        var ok = placed.every(function (q) { return Math.hypot(q.x - x, q.y - y) >= q.r + c.r + gap - 0.01; });
        if (!ok) continue;
        /* vicino al baricentro (gruppo compatto); la seconda va in alto a destra come nella banca */
        var score = Math.hypot((x - gx) * (H / W), (y - gy)) + (n === 1 ? Math.abs(Math.atan2(y, x) + 0.55) * 4 : 0);
        if (!best || score < best.s) best = { x: x, y: y, s: score };
      }
    });
    c.x = best ? best.x : 0; c.y = best ? best.y : 0; placed.push(c);
  });
  var x0 = Math.min.apply(null, C.map(function (c) { return c.x - c.r; })), x1 = Math.max.apply(null, C.map(function (c) { return c.x + c.r; }));
  var y0 = Math.min.apply(null, C.map(function (c) { return c.y - c.r; })), y1 = Math.max.apply(null, C.map(function (c) { return c.y + c.r; }));
  var pad = Math.min(W, H) * 0.04, s = Math.min((W - 2 * pad) / (x1 - x0), (H - 2 * pad) / (y1 - y0), 1.25);
  var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return C.map(function (c) { return { x: W / 2 + (c.x - cx) * s, y: H / 2 + (c.y - cy) * s, r: c.r * s }; });
}
/* items: [{key, label, value, text (cifra già scritta), color, ink?}] → bolle; attr(it) = attributo per il tocco */
function bubChartHtml(items, o) {
  o = o || {};
  var W = 340, H = o.h || 260, P = bubPack(items, W, H), esc = o.esc || function (s) { return String(s); };
  return '<div class="bub-wrap" style="aspect-ratio:' + W + '/' + H + '">' + items.map(function (it, i) {
    var p = P[i], zero = !(Number(it.value) > 0), d = p.r * 2, fs = Math.max(11, Math.min(26, p.r * 0.3)), ls = Math.max(9, Math.min(14, p.r * 0.15));
    var small = p.r < 34;
    return '<button type="button" class="bub' + (zero ? ' zero' : '') + (it.on ? ' on' : '') + '" ' + (o.attr ? o.attr(it) : '') +
      ' style="left:' + ((p.x - p.r) / W * 100).toFixed(2) + '%;top:' + ((p.y - p.r) / H * 100).toFixed(2) + '%;width:' + (d / W * 100).toFixed(2) + '%;--bc:' + (zero ? 'var(--bub-zero)' : it.color) + ';--bi:' + (it.ink || (zero ? 'var(--bub-zero-ink)' : '#0b0d0c')) + ';animation-delay:' + (i * 60) + 'ms" aria-label="' + esc(it.label + ': ' + it.text) + '">' +
      '<b style="font-size:' + fs.toFixed(1) + 'px">' + esc(it.text) + '</b>' + (small ? '' : '<small style="font-size:' + ls.toFixed(1) + 'px">' + esc(it.label) + '</small>') + '</button>';
  }).join('') + '</div>';
}
/* legenda come nella banca: pallino, nome, cifra sotto */
function bubLegendHtml(items, o) {
  o = o || {};
  var esc = o.esc || function (s) { return String(s); };
  return '<div class="bub-leg">' + (o.title ? '<p class="bub-leg-t">' + esc(o.title) + '</p>' : '') + items.map(function (it) {
    var zero = !(Number(it.value) > 0);
    return '<' + (o.attr ? 'button type="button" ' + o.attr(it) : 'div') + ' class="bub-li' + (o.attr ? ' tap' : '') + '"><i style="--bc:' + (zero ? 'var(--bub-zero)' : it.color) + '"></i><span><b>' + esc(it.label) + '</b><small>' + esc(it.sub || it.text) + '</small></span>' + (it.side ? '<em>' + esc(it.side) + '</em>' : '') + (o.attr ? '<u aria-hidden="true">›</u>' : '') + '</' + (o.attr ? 'button' : 'div') + '>';
  }).join('') + '</div>';
}
/* mesi in alto (set · ott · nov): months = [{key, label}] */
function bubMonthsHtml(months, sel, attrName) {
  return '<div class="bub-months" role="tablist">' + months.map(function (m) {
    return '<button type="button" role="tab" aria-selected="' + (m.key === sel) + '" class="' + (m.key === sel ? 'on' : '') + '" ' + attrName + '="' + m.key + '">' + m.label + '</button>';
  }).join('') + '</div>';
}
function bubLastMonths(n, endIso) {
  var MS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'], d = endIso ? new Date(endIso + '-01T12:00:00') : new Date(), out = [];
  for (var i = n - 1; i >= 0; i--) { var x = new Date(d.getFullYear(), d.getMonth() - i, 1); out.push({ key: x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'), label: MS[x.getMonth()], long: x.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }) }); }
  return out;
}

/* =========================================================
   v1.66.0 — ANALISI A BOLLE (stile app della banca)
   Statistiche: mesi in alto (set · ott · nov), bolle Entrate / Uscite / Risparmio oppure le macrocategorie,
   elenco sotto; un tocco su bolla o riga apre i movimenti. Conti: una bolla per conto (dove sono i soldi).
   ========================================================= */
function anlMoney(v){ return balancesHidden?"••••":new Intl.NumberFormat("it-IT",{maximumFractionDigits:0}).format(Math.round(v))+" €"; }
function anlData(ym){
  const tx=state.transactions.filter(t=>!t.isBalanceAdjustment&&String(t.date).startsWith(ym));
  const inc=tx.filter(t=>t.type==="income"), exp=tx.filter(t=>t.type==="expense");
  const sum=a=>a.reduce((s,t)=>s+t.amount,0);
  /* v1.67.0 — Risparmio = solo i trasferimenti contrassegnati "Deposito di risparmio" (niente più somma automatica
     dei bonifici verso il conto risparmio, niente più "entrate − uscite"). */
  const sav=tx.filter(isSavingsDeposit);
  const I=sum(inc), O=sum(exp), R=sum(sav);
  const tot=[
    {key:"in",label:"Entrate",value:I,text:anlMoney(I),sub:fmt(I),color:"var(--bub-in)",list:inc},
    {key:"out",label:"Uscite",value:O,text:anlMoney(O),sub:fmt(O),color:"var(--bub-out)",list:exp},
    {key:"sav",label:"Risparmio",value:R,text:anlMoney(R),sub:sav.length?`${fmt(R)} · ${sav.length} ${sav.length===1?"deposito":"depositi"} di risparmio`:"nessun deposito di risparmio",color:"var(--bub-save)",list:sav},
  ];
  const cats=categoriesById(), macros=macroCategoriesById(), by=new Map();
  exp.forEach(t=>{ const c=cats[t.categoryId]; const m=c&&c.macroCategoryId&&macros[c.macroCategoryId]?macros[c.macroCategoryId]:null; const k=m?m.id:"none";
    const g=by.get(k)||{key:k,label:m?m.name:"Senza macrocategoria",emoji:m?.emoji||"",color:safeColor(m?.color,"#8a9590"),value:0,list:[]}; g.value+=t.amount; g.list.push(t); by.set(k,g); });
  let cat=[...by.values()].sort((a,b)=>b.value-a.value);
  if(cat.length>6){ const rest=cat.slice(5); cat=cat.slice(0,5).concat([{key:"rest",label:"Altro",emoji:"",color:"#8a9590",value:rest.reduce((s,g)=>s+g.value,0),list:[].concat(...rest.map(g=>g.list))}]); }
  cat.forEach(g=>{ g.text=anlMoney(g.value); g.sub=fmt(g.value); g.side=O>0?Math.round(g.value/O*100)+"%":""; });
  return {tot,cat};
}
function renderStatsBubbles(){
  const view=document.getElementById("view-stats"); if(!view) return;
  let box=document.getElementById("statsBubbles");
  if(!box){ box=document.createElement("div"); box.id="statsBubbles"; box.className="stat-card wide-stat bub-card"; view.insertBefore(box,view.firstElementChild); }
  const months=bubLastMonths(3);
  if(!anlMonth||!months.some(m=>m.key===anlMonth)) anlMonth=months[months.length-1].key;
  const D=anlData(anlMonth), items=anlMode==="cat"?D.cat:D.tot, mo=months.find(m=>m.key===anlMonth);
  const esc=escapeHtml;
  box.innerHTML=`<div class="bub-head"><div><h2>Analisi</h2><p>${anlMode==="cat"?"Dove sono andate le uscite":"Entrate, uscite e risparmio"} · ${esc(mo.long)}</p></div></div>`+
    `<div class="bub-row">${bubMonthsHtml(months,anlMonth,"data-bubm")}<div class="bub-seg" role="tablist"><button type="button" class="${anlMode==="tot"?"on":""}" data-bubmode="tot">Totali</button><button type="button" class="${anlMode==="cat"?"on":""}" data-bubmode="cat">Categorie</button></div></div>`+
    (items.length&&items.some(i=>i.value>0)?bubChartHtml(items,{esc,attr:it=>`data-bubk="${esc(it.key)}"`})+bubLegendHtml(items,{esc,title:anlMode==="cat"?"Categorie":"Riepilogo",attr:it=>`data-bubk="${esc(it.key)}"`}):`<p class="bub-empty">Nessun movimento a ${esc(mo.long)}.</p>`);
}
document.addEventListener("click",e=>{
  const box=e.target.closest&&e.target.closest("#statsBubbles"); if(!box) return;
  const m=e.target.closest("[data-bubm]"), md=e.target.closest("[data-bubmode]"), k=e.target.closest("[data-bubk]");
  if(m){ anlMonth=m.dataset.bubm; renderStatsBubbles(); return; }
  if(md){ anlMode=md.dataset.bubmode; renderStatsBubbles(); return; }
  if(k){ const D=anlData(anlMonth), it=(anlMode==="cat"?D.cat:D.tot).find(x=>x.key===k.dataset.bubk); const mo=bubLastMonths(3).find(x=>x.key===anlMonth);
    if(it) openMovementsSheet(`${it.emoji?it.emoji+" ":""}${it.label}`,mo?mo.long:"",it.list); }
});
function renderAccountsBubbles(){
  /* v1.67.0 — la bolla per conto sta in fondo, nella tendina "Dove sono i soldi" (chiusa di base): l'elenco dei conti viene prima */
  const slot=document.getElementById("accountsBubblesSlot"), fold=document.getElementById("accountsBubblesFold");
  const pane=document.getElementById("accountsPane"), hero=pane?.querySelector(".total-balance-card"); if(!slot&&!hero) return;
  let box=document.getElementById("accountsBubbles");
  if(!box){ box=document.createElement("div"); box.id="accountsBubbles"; box.className="stat-card wide-stat bub-card acc-bub-card"; if(slot) slot.appendChild(box); else hero.after(box); }
  const accs=state.accounts.filter(a=>!isLoanAccount(a)).map(a=>({a,v:accountBalance(a.id)})).filter(x=>x.v>0.004).sort((x,y)=>y.v-x.v);
  if(accs.length<2){ box.hidden=true; if(fold) fold.hidden=true; return; }
  box.hidden=false; if(fold) fold.hidden=false;
  const tot=accs.reduce((s,x)=>s+x.v,0);
  const items=accs.map(x=>({key:x.a.id,label:x.a.name,value:x.v,text:anlMoney(x.v),sub:fmt(x.v)+(x.a.label?` · ${x.a.label}`:""),side:Math.round(x.v/tot*100)+"%",color:safeColor(x.a.color,"#2f9e8f"),ink:"#fff"}));
  const esc=escapeHtml;
  box.innerHTML=(slot?"":`<div class="bub-head"><div><h3>Dove sono i soldi</h3><p>Una bolla per conto, grande quanto il saldo</p></div></div>`)+bubChartHtml(items,{esc,h:230,attr:it=>`data-bubacc="${esc(it.key)}"`})+bubLegendHtml(items,{esc,attr:it=>`data-bubacc="${esc(it.key)}"`});
}
document.addEventListener("click",e=>{ const b=e.target.closest&&e.target.closest("[data-bubacc]"); if(b) openAccountEvolution(b.dataset.bubacc); });
