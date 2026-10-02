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
function fmt(n){
  const v = Math.round((n||0)*100)/100;
  return "€" + v.toLocaleString("it-IT", { minimumFractionDigits: v % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 });
}
function fmtSigned(n){ return (n>=0?"+":"−") + fmt(Math.abs(n)); }
function parseAmount(str){
  if(!str) return 0;
  const cleaned = String(str).replace(/[€\s]/g,"").replace(",",".");
  const v = parseFloat(cleaned);
  return isNaN(v) ? 0 : Math.abs(v);
}
function autoGrowAmountInput(el){
  const grow = ()=>{ el.style.width = Math.max(2, el.value.length + 1) + "ch"; };
  el.addEventListener("input", grow);
  grow();
}
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
let balancesHidden = localStorage.getItem("bilancio_hide_balances") !== "0";
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
  if(!Array.isArray(parsed.recurring)) parsed.recurring = [];
  parsed.recurring.forEach(r=>{
    if(r.active===undefined) r.active=true;
    if(r.endDate===undefined) r.endDate="";
    if(r.maxOccurrences===undefined) r.maxOccurrences=null;
  });
  if(!Array.isArray(parsed.planned)) parsed.planned = [];
  if(!Array.isArray(parsed.trash)) parsed.trash = [];
  if(parsed.mainAccountId===undefined) parsed.mainAccountId = null;
  if(parsed.mainAccountId && !parsed.accounts.some(a=>String(a.id)===String(parsed.mainAccountId))) parsed.mainAccountId = null;
  parsed.trash = pruneTrashArray(parsed.trash);
  sanitizeLoadedState(parsed);
  // I modelli rapidi sono stati sostituiti da categorie/macrocategorie: rimuovi eventuali residui.
  delete parsed.templates;
  return parsed;
}
function sanitizeLoadedState(data){
  const text=(value,max=240)=>String(value ?? "").slice(0,max);
  const id=value=>text(value,120);
  const date=(value,fallback="")=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||""))?String(value):fallback;
  const amount=value=>{const n=Number(value);return Number.isFinite(n)?Math.abs(n):0;};
  const signed=value=>{const n=Number(value);return Number.isFinite(n)?n:0;};
  data.accounts=(Array.isArray(data.accounts)?data.accounts:[]).map(a=>({...a,id:id(a.id),name:text(a.name,120),balance:signed(a.balance),color:safeColor(a.color,PALETTE[0])}));
  data.mainAccountId=data.mainAccountId==null?null:id(data.mainAccountId);
  if(data.mainAccountId && !data.accounts.some(a=>a.id===data.mainAccountId)) data.mainAccountId=null;
  data.macroCategories=(Array.isArray(data.macroCategories)?data.macroCategories:[]).map(m=>({...m,id:id(m.id),name:text(m.name,120),emoji:text(m.emoji,12),color:safeColor(m.color,PALETTE[0]),kind:m.kind==="income"?"income":"expense",budget:m.budget==null?null:amount(m.budget)}));
  data.categories=(Array.isArray(data.categories)?data.categories:[]).map(c=>({...c,id:id(c.id),name:text(c.name,120),emoji:text(c.emoji,12),color:safeColor(c.color,PALETTE[0]),kind:c.kind==="income"?"income":"expense",budget:c.budget==null?null:amount(c.budget),macroCategoryId:c.macroCategoryId==null?null:id(c.macroCategoryId)}));
  data.transactions=(Array.isArray(data.transactions)?data.transactions:[]).map(t=>({...t,id:id(t.id),date:date(t.date,todayISO()),amount:amount(t.amount),type:["income","expense","transfer"].includes(t.type)?t.type:"expense",name:text(t.name,160),note:text(t.note,500),categoryId:t.categoryId==null?null:id(t.categoryId),accountId:t.accountId==null?null:id(t.accountId),toAccountId:t.toAccountId==null?null:id(t.toAccountId),recurringId:t.recurringId==null?undefined:id(t.recurringId),plannedId:t.plannedId==null?undefined:id(t.plannedId)}));
  const freqs=new Set(["weekly","monthly","bimonthly","quarterly","semiannual","yearly"]);
  data.recurring=(Array.isArray(data.recurring)?data.recurring:[]).map(r=>({...r,id:id(r.id),name:text(r.name,160),note:text(r.note,500),amount:amount(r.amount),type:r.type==="income"?"income":"expense",categoryId:r.categoryId==null?null:id(r.categoryId),accountId:r.accountId==null?null:id(r.accountId),freq:freqs.has(r.freq)?r.freq:"monthly",startDate:date(r.startDate,todayISO()),nextDate:date(r.nextDate,date(r.startDate,todayISO())),endDate:date(r.endDate,""),active:r.active!==false,maxOccurrences:Number.isFinite(Number(r.maxOccurrences))&&Number(r.maxOccurrences)>0?Math.floor(Number(r.maxOccurrences)):null}));
  data.planned=(Array.isArray(data.planned)?data.planned:[]).map(p=>({...p,id:id(p.id),name:text(p.name,160),note:text(p.note,500),amount:amount(p.amount),type:p.type==="income"?"income":"expense",categoryId:p.categoryId==null?null:id(p.categoryId),accountId:p.accountId==null?null:id(p.accountId),date:date(p.date,todayISO()),recurringId:p.recurringId==null?undefined:id(p.recurringId)}));
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
  balanceCache.clear();
  state.trash = pruneTrashArray(state.trash);
  return safeSetLocalStorage(STORAGE_KEY, JSON.stringify(state));
}
function toggleBalances(){balancesHidden=!balancesHidden;safeSetLocalStorage("bilancio_hide_balances",balancesHidden?"1":"0",{notify:false});renderAll();}
function moveToTrash(kind, item){
  if(!Array.isArray(state.trash)) state.trash=[];
  state.trash.unshift({id:uid(),kind,data:JSON.parse(JSON.stringify(item)),deletedAt:todayISO()});
  state.trash=pruneTrashArray(state.trash);
}
function restoreTrashItem(trashId){
  const entry=state.trash.find(x=>x.id===trashId); if(!entry) return;
  if(entry.kind==="transaction") state.transactions.push(entry.data);
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
const TX_PAGE_SIZE=50;
let txVisibleLimit=TX_PAGE_SIZE;
let txSearchTimer=null;
let rpMode = "total";
let viewDay = now.getDate();
const periodModes = {home:"month", recurring:"month", stats:"month", transactions:"month"};
function selectedDate(){return `${viewYear}-${pad2(viewMonth+1)}-${pad2(viewDay)}`;}
function periodTx(view){return monthTx().filter(t=>periodModes[view]!=="day" || t.date===selectedDate());}
function sumTransactions(tx){
  const income=tx.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0);
  const expense=tx.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);
  return {income,expense,net:income-expense};
}
function moneyColor(value){return value>0?"var(--emerald)":value<0?"var(--rust)":"var(--ink)";}

let txType = "expense";
let selectedCategoryId = null;
let selectedAccountId = null;
let statsGroupMode = "category", statsNature="expense";

/* ---------------- Helpers on state ---------------- */
function accountsById(){ return Object.fromEntries(state.accounts.map(a=>[a.id,a])); }
function categoriesById(){ return Object.fromEntries(state.categories.map(c=>[c.id,c])); }
function macroCategoriesById(){ return Object.fromEntries(state.macroCategories.map(m=>[m.id,m])); }

/* Picker categoria: la macrocategoria è un filtro, ma all'apertura vengono
   mostrate tutte le categorie. Così una categoria appena creata è sempre
   disponibile subito nel nuovo movimento. */
function renderCategoryPicker(container, kind, getSelected, onSelect){
  const macros = macroCategoriesById();
  const cats = state.categories.filter(c=>c.kind===kind);
  const groups = new Map();
  cats.forEach(c=>{
    const key = c.macroCategoryId && macros[c.macroCategoryId] ? c.macroCategoryId : "none";
    if(!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  });
  const macroOrder = state.macroCategories.filter(m=>groups.has(m.id)).map(m=>m.id);
  if(groups.has("none")) macroOrder.push("none");

  const selId = getSelected();
  const selCat = cats.find(c=>c.id===selId);
  let activeMacro = container._activeMacro;
  if(selCat) activeMacro = selCat.macroCategoryId && macros[selCat.macroCategoryId] ? selCat.macroCategoryId : "none";
  if(!activeMacro || (activeMacro!=="all" && !groups.has(activeMacro))) activeMacro = "all";
  container._activeMacro = activeMacro;

  container.innerHTML = "";
  const showMacroRow = macroOrder.length>1 || (macroOrder.length===1 && macroOrder[0]!=="none");

  if(showMacroRow){
    const macroWrap = document.createElement("div");
    macroWrap.className = "chip-group";
    macroWrap.innerHTML = `<p class="chip-group-title">Macrocategoria</p>`;
    const macroRow = document.createElement("div");
    macroRow.className = "chip-row";
    ["all", ...macroOrder].forEach(key=>{
      const chip = document.createElement("button");
      chip.className = "chip" + (activeMacro===key ? " active":"");
      chip.innerHTML = key==="all" ? `Tutte` : key==="none" ? `<span class="em">🏷️</span>Altre` : `<span class="em">${escapeHtml(macros[key].emoji)}</span>${escapeHtml(macros[key].name)}`;
      chip.addEventListener("click", ()=>{
        container._activeMacro = key;
        const list = key==="all" ? cats : (groups.get(key) || []);
        if(!list.find(c=>c.id===getSelected())) onSelect(list[0]?.id || null);
        renderCategoryPicker(container, kind, getSelected, onSelect);
      });
      macroRow.appendChild(chip);
    });
    macroWrap.appendChild(macroRow);
    container.appendChild(macroWrap);
  }

  const catWrap = document.createElement("div");
  catWrap.className = "chip-group";
  catWrap.innerHTML = `<p class="chip-group-title">Categoria</p>`;
  const catRow = document.createElement("div");
  catRow.className = "chip-row";
  const currentList = activeMacro==="all" ? cats : (groups.get(activeMacro) || []);
  currentList.forEach(c=>{
    const chip = document.createElement("button");
    chip.className = "chip" + (getSelected()===c.id ? " active":"");
    chip.innerHTML = `<span class="em">${escapeHtml(c.emoji)}</span>${escapeHtml(c.name)}`;
    chip.addEventListener("click", ()=>{
      onSelect(c.id);
      renderCategoryPicker(container, kind, getSelected, onSelect);
    });
    catRow.appendChild(chip);
  });
  catWrap.appendChild(catRow);
  container.appendChild(catWrap);

  if(!currentList.find(c=>c.id===getSelected())) onSelect(currentList[0]?.id || null);
}
function monthTx(y=viewYear, m=viewMonth){
  const prefix = `${y}-${pad2(m+1)}`;
  return state.transactions.filter(t=>t.date.startsWith(prefix));
}
function sortedMonthTx(y=viewYear,m=viewMonth){
  return monthTx(y,m).slice().sort((a,b)=> b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}
function monthTotals(y=viewYear,m=viewMonth){
  const tx = monthTx(y,m);
  let income=0, expense=0;
  tx.forEach(t=>{ if(t.type==="income") income+=t.amount; else if(t.type==="expense") expense+=t.amount; });
  return { income, expense, net: income-expense };
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
function accountBalanceAt(accId, y, m){
  // Saldo del conto al termine del mese y-m (incluso).
  const acc = state.accounts.find(a=>a.id===accId);
  if(!acc) return 0;
  const cutoff = `${y}-${pad2(m+1)}-31`;
  const delta = state.transactions.reduce((sum,t)=>{
    if(t.date>cutoff) return sum;
    if(t.type==="transfer") return sum + (t.accountId===accId ? -t.amount : t.toAccountId===accId ? t.amount : 0);
    if(t.accountId!==accId) return sum;
    return sum + (t.type==="income" ? t.amount : -t.amount);
  },0);
  return acc.balance + delta;
}
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
function generateRecurringTransactions(askConfirmation=false){
  const todayStr = todayISO();
  const due=state.recurring.filter(r=>{const next=r.nextDate||r.startDate;return r.active!==false && next && next<=todayStr && recurringDateWithinLimits(r,next);});
  if(askConfirmation && due.length && !confirm(`Oggi verranno registrati: ${due.slice(0,4).map(r=>r.name||"Ricorrente").join(", ")}${due.length>4?" e altri":""}. Confermi?`)) return;
  let changed = false;
  state.recurring.forEach(r=>{
    if(!r.nextDate) r.nextDate = r.startDate;
    let safety = 0;
    while(r.active!==false && r.nextDate <= todayStr && recurringDateWithinLimits(r,r.nextDate) && safety < 1000){
      if(!state.transactions.some(t=>t.recurringId===r.id && t.date===r.nextDate)){
        state.transactions.push({
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
  state.transactions = state.transactions.filter(t=>t.recurringId!==recurringId || t.date<today);
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
        state.transactions.push({
          id: uid(), date: p.date, amount: p.amount, type: p.type,
          categoryId: p.categoryId, accountId: p.accountId, name:p.name || "", note: p.note || "",
          plannedId: p.id,
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
    if(d>=monthStart) dates.push(d);
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
    id: "planned_"+p.id, plannedId: p.id, date: p.date, amount: p.amount, type: p.type,
    categoryId: p.categoryId, accountId: p.accountId, name:p.name || "", note: p.note || "", planned: true,
  }));
  const recurringOcc = [];
  state.recurring.forEach(r=>{
    recurringOccurrencesInMonth(r,y,m).forEach(date=>{
      recurringOcc.push({
        id: "rec_"+r.id+"_"+date, recurringId: r.id, date, amount: r.amount, type: r.type,
        categoryId: r.categoryId, accountId: r.accountId, name:r.name || "", note: r.note || "", planned: true,
      });
    });
  });
  return [...once, ...recurringOcc];
}
function plannedItemsForDate(iso){
  const y = parseInt(iso.slice(0,4),10), m = parseInt(iso.slice(5,7),10)-1;
  return plannedItemsForMonth(y,m).filter(t=>t.date===iso);
}

/* ---------------- Rendering: header ---------------- */
function renderHeader(){
  const daily=periodModes[activeView]==="day";
  {const lbl=document.getElementById("monthLabel");
  if(daily){const wd=["Dom","Lun","Mar","Mer","Gio","Ven","Sab"][new Date(viewYear,viewMonth,viewDay).getDay()];
    lbl.innerHTML=`<span class="pl-main">${wd} ${viewDay} ${MESI[viewMonth].toLowerCase()} ${viewYear}</span><span class="pl-sub">Solo questo giorno ▾</span>`;}
  else lbl.innerHTML=`<span class="pl-main">${MESI[viewMonth]} ${viewYear}</span><span class="pl-sub">Tutto il mese ▾</span>`;
  lbl.classList.toggle("is-day",daily);}
  document.getElementById("monthLabel").setAttribute("aria-label",(daily?"Stai vedendo un solo giorno":"Stai vedendo tutto il mese")+". Tocca per cambiare");
  document.getElementById("periodDate").value=selectedDate();
  document.getElementById("periodReturn").hidden=true;
  document.getElementById("periodX").hidden=true;
  document.getElementById("dayControl").hidden=!daily;
  document.getElementById("prevMonth").setAttribute("aria-label",daily?"Giorno precedente":"Mese precedente");
  document.getElementById("nextMonth").setAttribute("aria-label",daily?"Giorno successivo":"Mese successivo");
  document.querySelectorAll("[data-period]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.period===periodModes[activeView])));
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
}

/* ---------------- Rendering: Home ---------------- */
function renderHome(){
  const { income, expense, net } = sumTransactions(periodTx("home"));
  document.getElementById("netAmount").textContent = balancesHidden ? "••••" : fmt(net);
  document.getElementById("netAmount").style.color = moneyColor(net);
  document.getElementById("incomeAmount").textContent = balancesHidden ? "••••" : fmt(income);
  document.getElementById("expenseAmount").textContent = balancesHidden ? "••••" : fmt(expense);
  setEyeIcon(document.getElementById("toggleHomeBalance"),balancesHidden);
  const mainAccount=state.accounts.find(a=>a.id===state.mainAccountId) || null;
  const mainBalance=mainAccount?accountBalance(mainAccount.id):null;
  const allAccountsBalance=totalBalance();
  const mainName=document.getElementById("homeMainAccountName");
  const mainAmount=document.getElementById("homeMainAccountBalance");
  const allAmount=document.getElementById("homeAllAccountsBalance");
  if(mainName) mainName.textContent=mainAccount?`Conto principale · ${mainAccount.name}`:"Conto principale non impostato";
  if(mainAmount){mainAmount.textContent=mainAccount?(balancesHidden?"••••":fmt(mainBalance)):"Imposta";mainAmount.style.color=mainAccount?moneyColor(mainBalance):"";}
  if(allAmount){allAmount.textContent=balancesHidden?"••••":fmt(allAccountsBalance);allAmount.style.color=moneyColor(allAccountsBalance);}
  renderMainAccountSetupNotice();

  document.querySelector("#view-home .hero-label").textContent=periodModes.home==="day"?"Saldo netto del giorno":"Saldo netto del mese";
  const today=todayISO(), monthEnd=`${viewYear}-${pad2(viewMonth+1)}-31`;
  const future=plannedItemsForMonth(viewYear,viewMonth).filter(t=>t.date>=today && t.date<=monthEnd);
  const futureNet=future.reduce((s,t)=>s+(t.type==="income"?t.amount:-t.amount),0);
  const current=totalBalance(), forecast=current+futureNet;
  const show=v=>balancesHidden?"••••":fmt(v);
  document.getElementById("currentBalanceAmount").textContent=show(current);
  document.getElementById("forecastBalanceAmount").textContent=show(forecast);
  document.getElementById("upcomingImpactAmount").textContent=balancesHidden?"••••":`${futureNet>=0?"+":"−"}${fmt(Math.abs(futureNet))}`;
  document.getElementById("forecastBalanceAmount").style.color=moneyColor(forecast);
  document.getElementById("upcomingImpactAmount").style.color=moneyColor(futureNet);
  renderUnifiedBudgets();

  // Recent tx
  const recent = periodTx("home").filter(t=>!t.isBalanceAdjustment).slice().sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id)).slice(0,5);
  renderTxRows(document.getElementById("recentTx"), recent);
  document.getElementById("txEmptyHint").hidden = recent.length>0;
  document.getElementById("txEmptyHint").textContent=periodModes.home==="day"?"Nessun movimento in questo giorno.":"Nessun movimento questo mese.";
  const upcoming=future.sort((a,b)=>a.date.localeCompare(b.date)).slice(0,3);
  renderTxRows(document.getElementById("upcomingHomeList"),upcoming);
  document.getElementById("upcomingHomeEmpty").hidden=upcoming.length>0;
}

const budgetExpanded = {};
function renderUnifiedBudgets(){
  const list=document.getElementById("budgetList");list.innerHTML="";
  const tx=periodTx("home");
  function renderKind(kind,title,icon){
    const cats=state.categories.filter(c=>c.kind===kind);
    const groups=state.macroCategories
      .filter(m=>m.kind===kind || cats.some(c=>c.macroCategoryId===m.id))
      .map(m=>({...m,cats:cats.filter(c=>c.macroCategoryId===m.id)}));
    const orphan=cats.filter(c=>!state.macroCategories.some(m=>m.id===c.macroCategoryId));
    if(orphan.length) groups.push({id:`none-${kind}`,name:"Senza macrocategoria",emoji:"🏷️",cats:orphan,budget:null});
    if(!groups.some(g=>g.cats.length || g.budget>0)) return false;
    const section=document.createElement("section");section.className=`budget-kind ${kind}`;
    section.innerHTML=`<h3>${icon} ${title}</h3>`;
    const spentFor=c=>tx.filter(t=>t.type===kind && t.categoryId===c.id).reduce((s,t)=>s+t.amount,0);
    const row=(name,emoji,total,budget,child)=>{
      const limit=kind==="expense" && Number(budget)>0?Number(budget):0;
      const totalClass=kind==="income"?"budget-earned":"budget-spent";
      const word=kind==="income"?"entrate":"spesi";
      const pct=limit?Math.round(total/limit*100):0, tone=pct>=100?"var(--rust)":pct>=80?"#E8A33D":"var(--emerald)";
      return `<div class="${child?"budget-child":"budget-parent"}"><div class="budget-item-top"><span class="budget-item-name">${escapeHtml(emoji||"")} ${escapeHtml(name)}</span><span class="budget-item-amounts"><span class="${totalClass}">${fmt(total)}</span>${limit?` <span class="budget-limit">/ ${fmt(limit)} · ${pct}%</span>`:` <span class="budget-word">${word}</span>`}</span></div>${limit?`<div class="budget-bar-track"><div class="budget-bar-fill" style="width:${Math.min(100,pct)}%;background:${tone}"></div></div>`:""}</div>`;
    };
    groups.filter(g=>g.cats.length || g.budget>0).forEach(g=>{
      const total=g.cats.reduce((s,c)=>s+spentFor(c),0), key=`${kind}-${g.id||g.name}`;
      const item=document.createElement("div");item.className="budget-item";
      item.innerHTML=`<button type="button" class="budget-macro-toggle" aria-expanded="${Boolean(budgetExpanded[key])}">${row(g.name,g.emoji,total,g.budget,false)}<span class="budget-chevron" aria-hidden="true">${budgetExpanded[key]?"▴":"▾"}</span></button><div class="budget-children" ${budgetExpanded[key]?"":"hidden"}>${g.cats.map(c=>row(c.name,c.emoji,spentFor(c),c.budget,true)).join("")}</div>`;
      item.querySelector(".budget-macro-toggle").addEventListener("click",()=>{budgetExpanded[key]=!budgetExpanded[key];renderUnifiedBudgets();});
      section.appendChild(item);
    });
    list.appendChild(section);return true;
  }
  const expenses=renderKind("expense","Uscite per macrocategoria","↓");
  const income=renderKind("income","Entrate per macrocategoria","↑");
  document.getElementById("budgetEmptyHint").hidden=expenses||income;
  document.getElementById("budgetPeriodHint").textContent=periodModes.home==="day"?"Totali del giorno selezionato · budget mensili":"Totali e budget del mese selezionato";
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
function openMovementActionMenu({title="Movimento",onEdit,onDelete,onDuplicate}){
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
      delete:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 20a2 2 0 0 1-2-2V7h14v11a2 2 0 0 1-2 2H7Zm1-10v7h2v-7H8Zm6 0v7h2v-7h-2ZM4 6V4h5l1-1h4l1 1h5v2H4Z"/></svg>`
    };
    const btn=document.createElement("button");
    btn.type="button";btn.className=`movement-action-btn ${cls}`;
    btn.innerHTML=`<span class="movement-action-icon">${icons[cls]||""}</span><span>${label}</span>`;
    btn.addEventListener("click",()=>{overlay.remove();fn();});
    actions.appendChild(btn);
  };
  addAction("Modifica","edit",onEdit);
  addAction("Duplica","duplicate",onDuplicate);
  addAction("Elimina","delete",onDelete);
  overlay.querySelector(".movement-action-cancel").addEventListener("click",()=>overlay.remove());
  overlay.addEventListener("click",e=>{if(e.target===overlay) overlay.remove();});
  document.body.appendChild(overlay);
  requestAnimationFrame(()=>overlay.classList.add("show"));
}
function enableLongPressActions(row,{title,onEdit,onDelete,onDuplicate}){
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
      openMovementActionMenu({title,onEdit,onDelete,onDuplicate});
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
  row.addEventListener("contextmenu",e=>{e.preventDefault();row._skipClick=true;openMovementActionMenu({title,onEdit,onDelete,onDuplicate});setTimeout(()=>row._skipClick=false,250);});
}
function duplicateTransaction(t){
  if(!t || t.planned || t.isBalanceAdjustment) return null;
  const copy={...t,id:uid(),date:todayISO(),planned:false};
  delete copy.recurringId;
  delete copy.plannedId;
  state.transactions.push(copy);
  persist();
  renderAll();
  showToast("Movimento duplicato con la data di oggi");
  return copy;
}
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
function movementRowHtml({emoji,color,title,badges="",meta="",amountHtml,type,date,relative=true,kind=null,paid=false}){
  return `<span class="mv-ic" style="background:${safeColor(color,"#999999")}22;">${escapeHtml(emoji)}</span>
    <span class="mv-title"><span class="mv-name">${escapeHtml(title)}</span></span>
    <span class="mv-amt ${type}">${amountHtml}</span>
    <span class="mv-meta"><span class="mv-meta-text">${meta}</span>${datePillHtml(date,{relative:false,kind,paid})}</span>`;
}
function renderTxRows(container, list, {paidLabel=false}={}){
  const cats = categoriesById(), accs = accountsById(), macros = macroCategoriesById();
  container.innerHTML = "";
  list.forEach(t=>{
    const isTransfer=t.type==="transfer";
    const cat = isTransfer ? {name:"Trasferimento",emoji:"↔",color:"#E8A33D",macroCategoryId:null} : (t.isBalanceAdjustment ? {name:"Rettifica saldo",emoji:"⚖️",color:"#7BAE9D",macroCategoryId:null} : (cats[t.categoryId] || { name:"Categoria eliminata", emoji:"❔", color:"#999" }));
    const acc = accs[t.accountId] || { name:"Conto eliminato" };
    const destination=accs[t.toAccountId] || {name:"Conto eliminato"};
    const row = document.createElement("div");
    row.setAttribute("role","button"); row.tabIndex=0;
    row.className = "tx-row mv-row" + (t.planned ? " planned" : "");
    row.dataset.id = t.id;
    const d = new Date(t.date+"T00:00:00");
    const originKind=t.recurringId?"recurring":(t.plannedId?"planned":null);
    const originLabel=originKind==="recurring"?"Ricorrente":originKind==="planned"?"Pianificata":"";
    const statusBadge = t.planned
      ? `<span class="status-badge ${t.recurringId?"recurring":"planned"}">${t.recurringId?"Ricorrente":"Pianificata"}</span>`
      : originKind
        ? `<span class="status-badge ${originKind}">${originLabel}</span>${paidLabel?`<span class="status-badge paid">Pagato</span>`:""}`
        : "";
    const title = t.name || t.note || cat.name;
    const metaParts=isTransfer
      ? `<span>Da ${escapeHtml(acc.name)} → ${escapeHtml(destination.name)}</span>`
      : `<span>${escapeHtml(cat.name)}</span><span class="mv-acc">${escapeHtml(acc.name)}</span>`;
    row.innerHTML = movementRowHtml({emoji:cat.emoji,color:cat.color,title,badges:statusBadge,meta:metaParts,
      amountHtml:`${isTransfer?"↔":t.type==="income"?"+":"−"}${fmt(t.amount)}`,type:t.type,date:t.date,relative:!!t.planned,
      kind:t.recurringId?"recurring":(t.plannedId?"planned":null),paid:!t.planned&&paidLabel});
    const openRow=()=>{
      if(row._skipClick) return;
      if(t.planned) openScheduledDetail(t.recurringId ? "recurring" : "planned", t.recurringId || t.plannedId, t.date);
      else openTxDetail(t.id);
    };
    row.addEventListener("click", openRow);
    activateRowFromKeyboard(row,openRow);
    const canDuplicate=!t.planned && !t.isBalanceAdjustment;
    enableLongPressActions(row,{
      title:title,
      onDuplicate:canDuplicate?()=>duplicateTransaction(t):null,
      onEdit:()=>{
        if(t.recurringId && state.recurring.some(r=>r.id===t.recurringId)) openRecurringForm(t.recurringId);
        else if(t.planned) openPlannedForm(t.plannedId);
        else openAddTransaction(t.id);
      },
      onDelete:()=>{
        let deleted;
        if(t.planned){const p=state.planned.find(x=>x.id===t.plannedId);if(p){moveToTrash("planned",p);deleted=state.trash[0]?.id;}state.planned=state.planned.filter(p=>p.id!==t.plannedId);}
        else {moveToTrash("transaction",t);deleted=state.trash[0]?.id;state.transactions=state.transactions.filter(x=>x.id!==t.id);}
        persist();renderAll();if(deleted) showUndo("Elemento eliminato",deleted);
      }
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
function renderTransactionsView(){
  document.getElementById("txMonthLabel").textContent = `${periodModes.transactions==="day"?viewDay+" ":""}${MESI[viewMonth]} ${viewYear}`;
  const cats=categoriesById(), accounts=accountsById();
  const matches=t=>{
    if(txFilter!=="all"&&t.type!==txFilter) return false;
    if(txDateFrom&&t.date<txDateFrom) return false;if(txDateTo&&t.date>txDateTo) return false;
    const q=txSearchQuery.toLocaleLowerCase("it"); if(!q) return true;
    const hay=[t.name,t.note,cats[t.categoryId]?.name,accounts[t.accountId]?.name,accounts[t.toAccountId]?.name,t.type].filter(Boolean).join(" ").toLocaleLowerCase("it");
    return hay.includes(q);
  };
  const base=((txDateFrom||txDateTo)?state.transactions:periodTx("transactions")).filter(t=>!t.isBalanceAdjustment);
  const all = base.filter(matches).slice().sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
  const visibleAll=all.slice(0,txVisibleLimit);
  renderTxRows(document.getElementById("allTx"), visibleAll);
  const loadMore=document.getElementById("loadMoreTxBtn");
  if(loadMore){loadMore.hidden=visibleAll.length>=all.length;loadMore.textContent=`Carica altri (${all.length-visibleAll.length})`;}
  document.getElementById("allTxEmptyHint").hidden = all.length>0;
  document.getElementById("allTxEmptyHint").textContent=periodModes.transactions==="day"?"Nessun movimento in questo giorno.":"Nessun movimento questo mese.";

  const planned = plannedItemsForMonth(viewYear, viewMonth).filter(t=>(periodModes.transactions!=="day" || t.date===selectedDate()) && matches(t)).sort((a,b)=> a.date.localeCompare(b.date));
  const plannedWrap = document.getElementById("allTxPlannedWrap");
  if(planned.length){
    plannedWrap.hidden = false;
    renderTxRows(document.getElementById("allTxPlanned"), planned);
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
  return {recurring,planned,total};
}
function updateRPEstimates(){
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
  setLabel("#recurringEstimateCard .rp-estimate-label","Ricorrenti · da registrare",estimates.recurring);
  setLabel("#plannedEstimateCard .rp-estimate-label","Pianificate · da registrare",estimates.planned);
  setLabel("#rpCombinedEstimateCard > div:first-child > span","Totale R&amp;P · da registrare",estimates.total);
  setMoney("recurringEstimate",estimates.recurring.net,{signed:true});
  // v1.6.5: Entrate/Uscite = totale del mese; il numero grande e "per conto/carta" = ancora da registrare.
  setMoney("recurringIncomeEstimate",estimates.recurring.month.income);
  setMoney("recurringExpenseEstimate",estimates.recurring.month.expense);
  setMoney("plannedEstimate",estimates.planned.net,{signed:true});
  setMoney("plannedIncomeEstimate",estimates.planned.month.income);
  setMoney("plannedExpenseEstimate",estimates.planned.month.expense);
  setMoney("rpCombinedEstimate",estimates.total.net,{signed:true});
  setMoney("rpCombinedIncomeEstimate",estimates.total.month.income);
  setMoney("rpCombinedExpenseEstimate",estimates.total.month.expense);
  renderAccounts("recurringAccountBreakdown",estimates.recurring);
  renderAccounts("plannedAccountBreakdown",estimates.planned);
  renderAccounts("rpCombinedAccountBreakdown",estimates.total);
  const toggle=document.getElementById("toggleRPBalance");
  if(toggle){setEyeIcon(toggle,balancesHidden,"Mostra importi R&P","Nascondi importi R&P");}
}


function formatRPDate(iso){
  const d=new Date(iso+"T00:00:00");
  return `${d.getDate()} ${MESI_BREVI[d.getMonth()]} ${d.getFullYear()}`;
}
function recurringDatesForMonth(r,y=viewYear,m=viewMonth){
  const prefix=`${y}-${pad2(m+1)}`;
  const actual=state.transactions.filter(t=>t.recurringId===r.id && t.date.startsWith(prefix)).map(t=>t.date);
  const projected=recurringOccurrencesInMonth(r,y,m);
  return [...new Set([...actual,...projected])].sort();
}
function rpDateMatchesPeriod(iso,y=viewYear,m=viewMonth){
  if(!iso) return false;
  if(periodModes.recurring==="day") return iso===selectedDate();
  return iso.startsWith(`${y}-${pad2(m+1)}`);
}
function recurringProjectedDatesForPeriod(r,y=viewYear,m=viewMonth){
  return recurringOccurrencesInMonth(r,y,m).filter(iso=>rpDateMatchesPeriod(iso,y,m));
}
function paidScheduledTransactionsForPeriod(kind,y=viewYear,m=viewMonth){
  const key=kind==="recurring"?"recurringId":"plannedId";
  return state.transactions
    .filter(t=>t[key] && rpDateMatchesPeriod(t.date,y,m))
    .slice()
    .sort((a,b)=>b.date.localeCompare(a.date)||String(b.id).localeCompare(String(a.id)));
}
function formatRecurringDatesLabel(dates,m=viewMonth){
  if(!dates.length) return "";
  if(dates.length===1) return formatRPDate(dates[0]);
  const days=dates.map(iso=>parseInt(iso.slice(8,10),10)).join(", ");
  return `${days} ${MESI_BREVI[m]} ${dates[0].slice(0,4)}`;
}
function recurringDateLabel(r,y=viewYear,m=viewMonth,datesOverride=null){
  const dates=datesOverride || recurringDatesForMonth(r,y,m);
  return formatRecurringDatesLabel(dates,m);
}
function plannedForRPMonth(y=viewYear,m=viewMonth){
  const prefix=`${y}-${pad2(m+1)}`;
  return state.planned.filter(p=>p.date && p.date.startsWith(prefix) && rpDateMatchesPeriod(p.date,y,m));
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
  if(paid.length) renderTxRows(list,paid,{paidLabel:true});
  else list.innerHTML="";
}

/* ---------------- Rendering: Ricorrenti ---------------- */
function renderRecurringList(){
  const container = document.getElementById("recurringList");
  container.innerHTML = "";
  const upcoming=state.recurring
    .map(r=>({r,dates:recurringProjectedDatesForPeriod(r)}))
    .filter(x=>x.dates.length>0)
    .sort((a,b)=>a.dates[0].localeCompare(b.dates[0]));
  upcoming.forEach(({r,dates})=>container.appendChild(recurringRowElement(r,{dates})));

  const paid=paidScheduledTransactionsForPeriod("recurring");
  const empty=document.getElementById("recurringEmptyHint");
  if(empty){
    empty.hidden=upcoming.length>0 || paid.length>0;
    empty.textContent=periodModes.recurring==="day"?"Nessun movimento ricorrente nel giorno selezionato.":"Nessun movimento ricorrente nel mese selezionato.";
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
  const cat=cats[p.categoryId]||{};
  const acc=accs[p.accountId]||{name:"Conto eliminato"};
  const d=p.date?new Date(p.date+"T00:00:00"):null;
  const whenLabel=d?`${d.getDate()} ${MESI_BREVI[d.getMonth()]} ${d.getFullYear()}`:"—";
  const days=d?Math.ceil((d-new Date(todayISO()+"T00:00:00"))/86400000):null;
  const relative=days===0?"oggi":days===1?"domani":days>1?`tra ${days} giorni`:"";
  const row=document.createElement("div");
  row.setAttribute("role","button");row.tabIndex=0;
  row.className="template-manage-row planned-row mv-row";
  row.dataset.sortDate=p.date||"";
  row.innerHTML=movementRowHtml({emoji:cat.emoji||"📌",color:cat.color,title:p.name||cat.name||"Pianificata",
    badges:`<span class="status-badge planned">Pianificata</span>`,
    meta:`<span>${escapeHtml(cat.name||"Senza categoria")}</span><span class="mv-acc">${escapeHtml(acc.name)}</span>`,
    amountHtml:`${p.type==="income"?"+":"−"}${fmt(p.amount)}`,type:p.type,date:p.date,kind:"planned"});
  const openRow=()=>{if(!row._skipClick) openScheduledDetail("planned",p.id);};
  row.addEventListener("click",openRow);activateRowFromKeyboard(row,openRow);
  enableLongPressActions(row,{title:p.name||cat.name||"Pianificata",onEdit:()=>openPlannedForm(p.id),onDelete:()=>{const item=state.planned.find(x=>x.id===p.id);if(item)moveToTrash("planned",item);const deleted=state.trash[0]?.id;state.planned=state.planned.filter(x=>x.id!==p.id);persist();renderAll();if(deleted)showUndo("Pianificata eliminata",deleted);}});
  return row;
}
function recurringRowElement(r,{dates=null}={}){
  const cats=categoriesById(),accs=accountsById();
  const cat=cats[r.categoryId]||{},acc=accs[r.accountId]||{name:"Conto eliminato"};
  const row=document.createElement("div");
  row.setAttribute("role","button");row.tabIndex=0;row.className="template-manage-row mv-row";
  const displayDates=dates || recurringDatesForMonth(r,viewYear,viewMonth);
  row.dataset.sortDate=displayDates[0]||"";
  const extra=displayDates.length>1?`<span>anche ${displayDates.slice(1).map(x=>parseInt(x.slice(8,10),10)).join(", ")}</span>`:"";
  row.innerHTML=movementRowHtml({emoji:cat.emoji||"🔁",color:cat.color,title:r.name,
    badges:`<span class="status-badge recurring">Ricorrente</span>`,
    meta:`<span>${escapeHtml(cat.name||"Senza categoria")}</span><span class="mv-acc">${escapeHtml(acc.name)}</span>${extra}`,
    amountHtml:`${r.type==="income"?"+":"−"}${fmt(r.amount)}`,type:r.type,date:displayDates[0],kind:"recurring"});
  const openRow=()=>{if(!row._skipClick)openScheduledDetail("recurring",r.id,displayDates[0]);};
  row.addEventListener("click",openRow);activateRowFromKeyboard(row,openRow);
  enableLongPressActions(row,{title:r.name,onEdit:()=>openRecurringForm(r.id),onDelete:()=>{moveToTrash("recurring",r);const deleted=state.trash[0]?.id;removeRecurring(r.id);persist();renderAll();if(deleted)showUndo("Ricorrente eliminato",deleted);}});
  return row;
}
function renderPlannedList(){
  const allContainer=document.getElementById("plannedList");
  const rpContainer=document.getElementById("plannedListRP");
  const allItems=state.planned.slice().sort((a,b)=>(a.date||"").localeCompare(b.date||""));
  const rpItems=plannedForRPMonth().slice().sort((a,b)=>(a.date||"").localeCompare(b.date||""));
  if(allContainer){allContainer.innerHTML="";allItems.forEach(p=>allContainer.appendChild(plannedRowElement(p)));}
  if(rpContainer){rpContainer.innerHTML="";rpItems.forEach(p=>rpContainer.appendChild(plannedRowElement(p)));}
  const allHint=document.getElementById("plannedEmptyHint");if(allHint)allHint.hidden=allItems.length>0;

  const paid=paidScheduledTransactionsForPeriod("planned");
  const rpHint=document.getElementById("plannedEmptyHintRP");
  if(rpHint){
    rpHint.hidden=rpItems.length>0 || paid.length>0;
    rpHint.textContent=periodModes.recurring==="day"?"Nessun movimento pianificato nel giorno selezionato.":"Nessun movimento pianificato nel mese selezionato.";
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
    .filter(x=>x.dates.length>0);
  const planned=plannedForRPMonth();
  const rows=[...recs.map(({r,dates})=>recurringRowElement(r,{dates})),...planned.map(p=>plannedRowElement(p))]
    .sort((a,b)=>(a.dataset.sortDate||"").localeCompare(b.dataset.sortDate||""));
  rows.forEach(row=>container.appendChild(row));

  const paid=[...paidScheduledTransactionsForPeriod("recurring"),...paidScheduledTransactionsForPeriod("planned")]
    .sort((a,b)=>b.date.localeCompare(a.date)||String(b.id).localeCompare(String(a.id)));
  const hint=document.getElementById("rpTotalEmptyHint");
  if(hint){
    hint.hidden=rows.length>0 || paid.length>0;
    hint.textContent=periodModes.recurring==="day"?"Nessun movimento R&P nel giorno selezionato.":"Nessun movimento R&P nel mese selezionato.";
  }
  renderRPPaidSection({
    sectionId:"rpTotalPaidSection",noticeId:"rpTotalAllPaidNotice",countId:"rpTotalPaidCount",listId:"rpTotalPaidList",
    paid,hasUpcoming:rows.length>0
  });
}

/* ---------------- Rendering: Stats ---------------- */
let statsTrendRange = "1m", trendMode="flow";
function statsTransactions(){
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
  return state.transactions.filter(t=>!t.isBalanceAdjustment && t.date>=from && t.date<=to);
}
function renderTopCategoriesChart(entries,cats){
  if(!entries.length) return `<div class="top-categories-empty">Nessuna spesa nel periodo selezionato.</div>`;
  const max=Math.max(...entries.map(([,v])=>v),1);
  return `<div class="top-categories-chart" role="img" aria-label="Top 5 categorie di spesa">${entries.map(([id,value],index)=>{
    const cat=cats[id]||{};
    const pct=Math.max(4,(value/max)*100);
    const color=safeColor(cat.color,PALETTE[index%PALETTE.length]);
    return `<div class="top-category-row">
      <div class="top-category-meta"><span class="top-category-name"><span class="top-category-emoji">${escapeHtml(cat.emoji||"•")}</span>${escapeHtml(cat.name||"Altro")}</span><strong>${fmt(value)}</strong></div>
      <div class="top-category-track" aria-hidden="true"><span class="top-category-bar" style="width:${pct.toFixed(1)}%;background:${color}"></span></div>
    </div>`;
  }).join("")}</div>`;
}
function renderStats(){
  const tx=statsTransactions(), income=tx.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0), expense=tx.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);
  const days=Math.max(1,Math.ceil((new Date(viewYear,viewMonth+1,0)-new Date(viewYear,viewMonth,1))/86400000)+1);
  const cats=categoriesById(), byCat={};tx.filter(t=>t.type==="expense").forEach(t=>{byCat[t.categoryId]=(byCat[t.categoryId]||0)+t.amount;});
  const topEntries=Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,5);
  document.getElementById("statsInsights").innerHTML=`<div class="stat-card"><p class="stat-card-label">Media spese/giorno</p><p class="stat-card-value neg">${fmt(expense/days)}</p></div><div class="stat-card"><p class="stat-card-label">Saldo periodo</p><p class="stat-card-value ${income-expense<0?"neg":"pos"}">${fmtSigned(income-expense)}</p></div><div class="stat-card wide-stat top-categories-card"><p class="stat-card-label">Top 5 categorie</p>${renderTopCategoriesChart(topEntries,cats)}</div>`;
  renderPie();
  renderTrendSection();
  renderAccountBreakdown();
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
      key = t.categoryId;
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
      <text x="90" y="86" text-anchor="middle" font-weight="700" font-size="20" fill="var(--ink)">${fmt(0)}</text>
      <text x="90" y="108" text-anchor="middle" font-size="11" fill="var(--ink-soft)">Nessun dato</text>
    </svg>`;
    makeChartExpandable(wrap,"Ripartizione per categoria","Mostra la distribuzione del periodo selezionato.");
    return;
  }

  const size=180, r=70, cx=size/2, cy=size/2, circumference = 2*Math.PI*r;
  let offset = 0;
  let circles = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--line)" stroke-width="26"/>`;
  entries.forEach(([key,val])=>{
    let info;
    if(statsGroupMode==="macro"){
      info = key==="none" ? {color:"#999",name:"Senza macrocategoria",emoji:"❔"} : macros[key];
    } else {
      info = cats[key] || {color:"#999",name:"Altro",emoji:"❔"};
    }
    const frac = val/total;
    const len = frac*circumference;
    circles += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${safeColor(info.color)}" stroke-width="26"
      stroke-dasharray="${len} ${circumference-len}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})"/>`;
    offset += len;

    const legItem = document.createElement("div");
    legItem.className = "pie-legend-item";
    legItem.innerHTML = `<span class="sw" style="background:${safeColor(info.color)}"></span><span class="lbl">${escapeHtml(info.emoji)} ${escapeHtml(info.name)}</span><span class="val">${fmt(val)} · ${Math.round(frac*100)}%</span>`;
    legend.appendChild(legItem);
  });

  wrap.innerHTML = `
    <svg class="chart money-donut" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      ${circles}
      <text x="${cx}" y="${cy-4}" text-anchor="middle" font-weight="700" font-size="20" fill="var(--ink)">${fmt(total)}</text>
      <text x="${cx}" y="${cy+16}" text-anchor="middle" font-size="10.5" fill="var(--ink-soft)">${statsNature==="income"?"entrate":"uscite"} totali</text>
    </svg>`;
  makeChartExpandable(wrap,"Ripartizione per categoria","Mostra la distribuzione del periodo selezionato.");
}

function buildBarsSVG(data){
  const w=360, h=190, left=42, right=8, top=16, bottom=30;
  const plotW=w-left-right, plotH=h-top-bottom, baseline=h-bottom;
  const max=Math.max(1, ...data.map(d=>Math.max(d.income,d.expense)));
  const slot=plotW/Math.max(1,data.length), barW=slot*0.36;
  const labelStep=Math.max(1,Math.ceil(data.length/7));
  let chart="";
  for(let i=0;i<=3;i++){
    const y=baseline-plotH*i/3;
    const value=max*i/3;
    const label=new Intl.NumberFormat("it-IT", {notation:"compact",maximumFractionDigits:1}).format(value);
    chart+=`<line x1="${left}" y1="${y}" x2="${w-right}" y2="${y}" stroke="var(--line)" stroke-dasharray="3 5"/>
      <text x="${left-7}" y="${y+3}" text-anchor="end" font-size="10" fill="var(--ink-soft)">${label}</text>`;
  }
  chart+=`<text x="${left-7}" y="10" text-anchor="end" font-size="10" fill="var(--ink-soft)">€</text>`;
  data.forEach((d,i)=>{
    const x=left+i*slot+slot*0.08;
    const incH=d.income>0?Math.max(1.5,d.income/max*plotH):0;
    const expH=d.expense>0?Math.max(1.5,d.expense/max*plotH):0;
    chart+=`<rect x="${x}" y="${baseline-incH}" width="${barW}" height="${incH}" rx="3" fill="var(--emerald)"><title>${d.label}: entrate ${fmt(d.income)}</title></rect>
      <rect x="${x+slot*0.44}" y="${baseline-expH}" width="${barW}" height="${expH}" rx="3" fill="var(--rust)"><title>${d.label}: uscite ${fmt(d.expense)}</title></rect>`;
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
    setupLineChart(wrap,points);
  }else {
    const wrap=document.getElementById("barWrap");wrap.innerHTML = buildBarsSVG(data);
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
  state.accounts.forEach(a=>{
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
  const total = totalBalance();
  totalEl.textContent = balancesHidden ? "••••" : fmt(total);
  setEyeIcon(document.getElementById("toggleAccountsBalance"),balancesHidden);
  totalEl.style.color = moneyColor(total);
  const mainSelect=document.getElementById("mainAccountSelect");
  if(mainSelect){
    mainSelect.innerHTML=`<option value="">Seleziona il conto principale</option>`+state.accounts.map(a=>`<option value="${escapeHtml(a.id)}">${escapeHtml(a.name)}</option>`).join("");
    mainSelect.value=state.accounts.some(a=>a.id===state.mainAccountId)?state.mainAccountId:"";
    mainSelect.onchange=()=>{
      state.mainAccountId=mainSelect.value || null;
      persist();renderAll();
      showToast(state.mainAccountId?"Conto principale impostato":"Conto principale rimosso");
    };
  }

  const container = document.getElementById("accountsList");
  container.innerHTML = "";
  state.accounts.forEach(a=>{
    const bal = accountBalance(a.id);
    const card = document.createElement("button");
    card.className = "account-card";
    card.innerHTML = `
      <span class="account-swatch" style="background:${safeColor(a.color)}"></span>
      <span class="account-info">
        <p class="account-name">${escapeHtml(a.name)}${a.id===state.mainAccountId?` <span class="main-account-badge">Principale</span>`:""}</p>
        <p class="account-type">Saldo attuale</p>
      </span>
      <span class="account-balance" style="color:${moneyColor(bal)}">${fmt(bal)}</span>
      <span class="account-edit" role="button" tabindex="0" aria-label="Modifica ${escapeHtml(a.name)}">✎</span>
    `;
    card.addEventListener("click", (e)=>{
      if(e.target.closest(".account-edit")){ e.stopPropagation(); openAccountForm(a.id); return; }
      openAccountEvolution(a.id);
    });
    card.querySelector(".account-edit").addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();e.stopPropagation();openAccountForm(a.id);}});
    container.appendChild(card);
  });
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
        <p class="nm">${escapeHtml(a.name)}${a.id===state.mainAccountId?` <span class="main-account-badge">Principale</span>`:""}</p>
        <p class="sub">Saldo attuale: <span class="amt">${fmt(bal)}</span></p>
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
  const items=state.transactions.filter(t=>t.isBalanceAdjustment).slice().sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
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

  function buildRow(c,position,total){
    const wrap=document.createElement("div");wrap.className="category-manage-row";
    const row = document.createElement("button");
    row.className = "category-row";
    row.innerHTML = `
      <span class="ic" style="background:${safeColor(c.color)}22;">${escapeHtml(c.emoji)}</span>
      <span class="info">
        <p class="nm">${escapeHtml(c.name)}</p>
        <p class="sub">${c.kind==="income"?"Entrata":"Uscita"}${c.budget?` · budget <span class="amt">${fmt(c.budget)}</span>`:""}</p>
      </span>
      <span class="chev">›</span>`;
    row.addEventListener("click", ()=> openCategoryForm(c.id));
    wrap.appendChild(row);
    wrap.appendChild(reorderControls(`categoria ${c.name}`,()=>moveCategory(c.id,-1),()=>moveCategory(c.id,1),position>0,position<total-1));
    return wrap;
  }

  const groups = new Map();
  state.categories.forEach(c=>{
    const key = c.macroCategoryId && macros[c.macroCategoryId] ? c.macroCategoryId : "none";
    if(!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  });

  state.macroCategories.forEach(m=>{
    if(!groups.has(m.id)) return;
    const group = document.createElement("div");
    group.className = "category-group";
    group.innerHTML = `<p class="category-group-title"><span>${escapeHtml(m.emoji)}</span>${escapeHtml(m.name)}</p>`;
    const items=groups.get(m.id);items.forEach((c,i)=> group.appendChild(buildRow(c,i,items.length)));
    container.appendChild(group);
  });

  if(groups.has("none")){
    const group = document.createElement("div");
    group.className = "category-group";
    group.innerHTML = `<p class="category-group-title">Senza macrocategoria</p>`;
    const items=groups.get("none");items.forEach((c,i)=> group.appendChild(buildRow(c,i,items.length)));
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
      <span class="ic" style="background:${safeColor(m.color)}22;">${escapeHtml(m.emoji)}</span>
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
  renderBackupStatus();
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
  // Il mese si sceglie solo in Home e R&P; nelle altre schede la barra è nascosta.
  const hideMonth = !(activeView==="home" || activeView==="recurring"); // v1.5.1: barra del mese solo in Home e R&P
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
  const showFab = activeView==="home" || activeView==="transactions" || activeView==="recurring";
  document.getElementById("fabAdd").style.display = showFab ? "" : "none";
}
function switchView(view,{animate=false,direction=0}={}){
  closeDatePicker();
  closePeriodMenu();
  activeView = view;
  if(["home","recurring","stats"].includes(view)){
    const today=new Date();
    viewYear=today.getFullYear();viewMonth=today.getMonth();viewDay=today.getDate();
    periodModes[view]="month";
  }
  document.querySelectorAll(".view").forEach(v=>{
    v.classList.remove("view-swipe-next","view-swipe-prev");
    v.classList.toggle("active", v.dataset.view===view);
  });
  document.querySelectorAll(".tab").forEach(t=> t.classList.toggle("active", t.dataset.view===(view==="planned"?"home":view)));
  updateMonthNavVisibility();
  renderAll();
  const active=document.querySelector(`.view[data-view="${view}"]`);
  if(animate && active){
    void active.offsetWidth;
    active.classList.add(direction>0?"view-swipe-next":"view-swipe-prev");
    active.addEventListener("animationend",()=>active.classList.remove("view-swipe-next","view-swipe-prev"),{once:true});
  }
  window.scrollTo(0,0);
}
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
  const recurringCard=document.getElementById("recurringEstimateCard"),plannedCard=document.getElementById("plannedEstimateCard"),combined=document.getElementById("rpCombinedEstimateCard"),grid=document.getElementById("rpEstimatesGrid");
  if(recurringCard) recurringCard.hidden=mode==="planned";
  if(plannedCard) plannedCard.hidden=mode==="recurring";
  if(combined) combined.hidden=mode!=="total";
  if(grid) grid.classList.toggle("single",mode!=="total");
  document.querySelectorAll("#rpModeToggle [data-rp-mode]").forEach(btn=>btn.classList.toggle("active",btn.dataset.rpMode===mode));
}
document.querySelectorAll("#rpModeToggle [data-rp-mode]").forEach(btn=>btn.addEventListener("click",()=>setRPMode(btn.dataset.rpMode)));
document.querySelectorAll(".tab").forEach(tab=>{
  tab.addEventListener("click", ()=> switchView(tab.dataset.view));
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
  monthSwipeBlocked=Boolean(target.closest("input,textarea,select,button,a,[contenteditable='true'],.chart-wrap,.sheet,.movement-action-overlay"));
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
document.getElementById("seeAllTx").addEventListener("click", ()=> {periodModes.transactions=periodModes.home;switchView("transactions");});
document.getElementById("openRPFromHome").addEventListener("click",()=>switchView("recurring"));

function closePeriodMenu(){document.getElementById("periodMenu").hidden=true;document.getElementById("monthLabel").setAttribute("aria-expanded","false");}
document.getElementById("monthLabel").addEventListener("click",()=>{
  openPeriodPicker();
});
document.getElementById("periodX").addEventListener("click",()=>setPeriodMode("month"));
/* v1.5.3 — Scelta del periodo: un pannello chiaro con "Tutto il mese" oppure un giorno del calendario. */
function openPeriodPicker(){
  let pYear=viewYear,pMonth=viewMonth;
  openSheet("tpl-period-picker",(node)=>{
    const closeBtn=node.querySelector("[data-close]");
    const isDay=periodModes[activeView]==="day";
    function paint(){
      node.querySelector("#ppMonthLabel").textContent=`${MESI[pMonth]} ${pYear}`;
      node.querySelector("#ppWholeMonthSub").textContent=`${MESI[pMonth]} ${pYear}`;
      const whole=node.querySelector("#ppWholeMonth");
      whole.classList.toggle("active",!isDay && pYear===viewYear && pMonth===viewMonth);
      const grid=node.querySelector("#ppGrid");grid.innerHTML="";
      const lead=(new Date(pYear,pMonth,1).getDay()+6)%7, days=new Date(pYear,pMonth+1,0).getDate();
      const info=buildCalendarDayInfo(pYear,pMonth), todayStr=todayISO();
      for(let i=0;i<lead;i++){const b=document.createElement("div");b.className="calendar-cell empty";grid.appendChild(b);}
      for(let d=1;d<=days;d++){
        const iso=`${pYear}-${pad2(pMonth+1)}-${pad2(d)}`;
        const selected=isDay && pYear===viewYear && pMonth===viewMonth && d===viewDay;
        const cell=document.createElement("button");cell.type="button";
        cell.className="calendar-cell"+(iso===todayStr?" today":"")+(selected?" selected":"");
        cell.innerHTML=`<span class="cal-day-num">${d}</span><span class="cal-dots">${info[iso]?.real?'<span class="cal-dot real"></span>':""}</span>`;
        cell.setAttribute("aria-label",`${d} ${MESI[pMonth]} ${pYear}`);
        cell.addEventListener("click",()=>{viewYear=pYear;viewMonth=pMonth;viewDay=d;periodModes[activeView]="day";txVisibleLimit=TX_PAGE_SIZE;closeBtn.click();renderAll();});
        grid.appendChild(cell);
      }
    }
    node.querySelector("#ppWholeMonth").addEventListener("click",()=>{viewYear=pYear;viewMonth=pMonth;viewDay=Math.min(viewDay||1,new Date(pYear,pMonth+1,0).getDate());periodModes[activeView]="month";txVisibleLimit=TX_PAGE_SIZE;closeBtn.click();renderAll();});
    node.querySelector("#ppPrev").addEventListener("click",()=>{pMonth--;if(pMonth<0){pMonth=11;pYear--;}paint();});
    node.querySelector("#ppNext").addEventListener("click",()=>{pMonth++;if(pMonth>11){pMonth=0;pYear++;}paint();});
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
function openSheet(templateId, setup){
  const tpl = document.getElementById(templateId);
  const backdrop = document.createElement("div");
  backdrop.className = "overlay-backdrop";
  const node = tpl.content.firstElementChild.cloneNode(true);
  overlayRoot.appendChild(backdrop);
  overlayRoot.appendChild(node);
  overlayRoot.style.pointerEvents = "auto";
  document.documentElement.classList.add("sheet-open");

  let closing=false;
  function finishClose(){
    backdrop.remove();
    node.remove();
    overlayRoot.style.pointerEvents = overlayRoot.querySelector(".sheet") ? "auto" : "none";
    if(!overlayRoot.querySelector(".sheet")) document.documentElement.classList.remove("sheet-open");
  }
  function close(fromSwipe=false){
    if(closing) return;
    closing=true;
    node.classList.remove("dragging");
    node.style.transition="";
    backdrop.style.transition="";
    backdrop.style.opacity="";
    if(fromSwipe){
      // Mantiene il pannello sotto al dito e completa l'uscita verso il basso.
      node.style.transform="translateY(105%)";
      backdrop.classList.remove("show");
    }else{
      node.style.transform="";
      node.classList.remove("show");
      backdrop.classList.remove("show");
    }
    setTimeout(finishClose, 280);
  }
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
      canPull:node.scrollTop<=1 || Boolean(e.target.closest(".sheet-handle, .sheet-head"))
    };
  }, {passive:true});
  node.addEventListener("touchmove", e=>{
    if(!touch || touch.cancelled || e.touches.length!==1) return;
    const t=e.touches[0];
    const dx=t.clientX-touch.x;
    const dy=t.clientY-touch.y;

    // Lascia funzionare normalmente scroll verso l'alto e gesti orizzontali.
    if(!touch.active){
      if(Math.abs(dx)>Math.abs(dy)+4){ touch.cancelled=true; return; }
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
    const dy=t.clientY-touch.y;
    const fastFlick=touch.velocityY>0.55 && dy>32;
    const shouldClose=touch.active && (dy>92 || fastFlick);
    const wasActive=touch.active;
    touch=null;

    if(shouldClose){
      close(true);
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

/* ---------------- Add Transaction sheet ---------------- */
function openAddTransaction(txId){
  const editing=!!txId;
  const existing=editing ? state.transactions.find(t=>t.id===txId) : null;
  if(editing && !existing) return;
  txType = existing?.type || "expense";
  selectedCategoryId = existing?.categoryId || null;
  selectedAccountId = existing?.accountId || null;
  let destinationAccountId = existing?.toAccountId || null;

  openSheet("tpl-add-transaction", (node, close)=>{
    const amountInput = node.querySelector("#amountInput");
    const nameInput=node.querySelector("#txNameInput");
    amountInput.value = existing ? String(existing.amount).replace(".",",") : "";
    nameInput.value=existing?.name || "";
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
    dateInput.value = existing?.date || (periodModes.home==="day" ? selectedDate() : inViewedMonth ? todayISO() : `${viewYear}-${pad2(viewMonth+1)}-01`);
    // I movimenti reali non possono avere una data futura: per quelli si usa Pianificato.
    dateInput.max = todayISO();
    noteInput.value = existing?.note || "";

    function renderCatChips(){
      renderCategoryPicker(catChipsGrouped, txType, ()=>selectedCategoryId, id=>{ selectedCategoryId=id; });
    }
    function renderAccChips(){
      accChips.innerHTML = "";
      state.accounts.forEach(a=>{
        const chip = document.createElement("button");
        chip.className = "chip" + (selectedAccountId===a.id ? " active":"");
        chip.innerHTML = `<span class="em">●</span>${escapeHtml(a.name)}`;
        chip.querySelector(".em").style.color = safeColor(a.color);
        chip.addEventListener("click", ()=>{ selectedAccountId=a.id; renderAccChips(); if(txType==="transfer") renderDestinationChips(); });
        accChips.appendChild(chip);
      });
      if(!selectedAccountId) selectedAccountId = state.accounts[0]?.id || null;
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
      if(!transfer) renderCatChips(); else {selectedCategoryId=null;renderDestinationChips();}
    }

    typeToggle.querySelectorAll(".type-opt").forEach(opt=>{
      opt.classList.toggle("active",opt.dataset.type===txType);
      opt.addEventListener("click", ()=>{
        typeToggle.querySelectorAll(".type-opt").forEach(o=>o.classList.remove("active"));
        opt.classList.add("active");
        txType = opt.dataset.type;
        selectedCategoryId = null;
        catChipsGrouped._activeMacro = null;
        renderTypeFields();
      });
    });

    renderAccChips();
    renderTypeFields();

    node.querySelector("#saveTxBtn").addEventListener("click", ()=>{
      const amount = parseAmount(amountInput.value);
      const transfer=txType==="transfer";
      const missing=[]; if(!nameInput.value.trim()) missing.push("nome"); if(amount<=0) missing.push("importo"); if(!transfer&&!selectedCategoryId) missing.push("categoria"); if(!selectedAccountId) missing.push("conto"); if(transfer&&!destinationAccountId) missing.push("conto destinazione"); if(!dateInput.value) missing.push("data");
      if(missing.length){showToast("Inserisci: "+missing.join(", "));if(amount<=0) amountInput.focus();return;}
      if(dateInput.value > todayISO()){
        showToast("Per una data futura usa un movimento Pianificato");
        dateInput.focus();
        return;
      }

      const t = existing || {id:uid()};
      t.date=dateInput.value; t.amount=amount; t.type=txType;
      t.name=nameInput.value.trim(); t.categoryId=transfer?null:selectedCategoryId; t.accountId=selectedAccountId; t.toAccountId=transfer?destinationAccountId:null; t.note=noteInput.value.trim();
      if(!editing) state.transactions.push(t);
      persist();
      const d = new Date(t.date+"T00:00:00");
      viewYear = d.getFullYear(); viewMonth = d.getMonth();
      renderAll();
      close();
    });
  });
}
function openRPAddChoice(){
  document.getElementById("movementActionOverlay")?.remove();
  const overlay=document.createElement("div");
  overlay.id="movementActionOverlay";
  overlay.className="movement-action-overlay";
  overlay.innerHTML=`
    <div class="movement-action-menu" role="dialog" aria-modal="true" aria-label="Scegli cosa aggiungere">
      <div class="movement-action-handle" aria-hidden="true"></div>
      <p class="movement-action-title">Cosa vuoi aggiungere?</p>
      <div class="movement-action-buttons">
        <button type="button" class="movement-action-btn edit" data-add-kind="recurring"><span class="movement-action-icon" aria-hidden="true">↻</span><span>Movimento ricorrente</span></button>
        <button type="button" class="movement-action-btn duplicate" data-add-kind="planned"><span class="movement-action-icon" aria-hidden="true">◷</span><span>Movimento pianificato</span></button>
      </div>
      <button type="button" class="movement-action-cancel">Annulla</button>
    </div>`;
  overlay.querySelector('[data-add-kind="recurring"]').addEventListener("click",()=>{overlay.remove();openRecurringForm(null);});
  overlay.querySelector('[data-add-kind="planned"]').addEventListener("click",()=>{overlay.remove();openPlannedForm(null);});
  overlay.querySelector(".movement-action-cancel").addEventListener("click",()=>overlay.remove());
  overlay.addEventListener("click",e=>{if(e.target===overlay) overlay.remove();});
  document.body.appendChild(overlay);
  requestAnimationFrame(()=>overlay.classList.add("show"));
}
document.getElementById("fabAdd").addEventListener("click", e=>{
  e.preventDefault();e.stopPropagation();
  if(activeView==="recurring"){
    if(rpMode==="recurring") openRecurringForm(null);
    else if(rpMode==="planned") openPlannedForm(null);
    else openRPAddChoice();
  }else openAddTransaction();
});
document.getElementById("toggleHomeBalance").addEventListener("click",toggleBalances);
document.getElementById("toggleAccountsBalance").addEventListener("click",toggleBalances);
document.getElementById("toggleRPBalance")?.addEventListener("click",toggleBalances);

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
    const cat = transfer ? {name:"Trasferimento",emoji:"↔"} : (t.isBalanceAdjustment ? {name:"Rettifica saldo",emoji:"⚖️"} : (categoriesById()[t.categoryId] || { name:"Categoria eliminata", emoji:"❔" }));
    const acc = accountsById()[t.accountId] || { name:"Conto eliminato" };
    const destination=accountsById()[t.toAccountId] || {name:"Conto eliminato"};
    node.querySelector("#txDetailBody").innerHTML = `
      <div class="tx-detail-row"><span class="k">Importo</span><span class="v ${t.type}">${transfer?"↔":t.type==="income"?"+":"−"}${fmt(t.amount)}</span></div>
      ${transfer?`<div class="tx-detail-row"><span class="k">Da conto</span><span class="v">${escapeHtml(acc.name)}</span></div><div class="tx-detail-row"><span class="k">A conto</span><span class="v">${escapeHtml(destination.name)}</span></div>`:`<div class="tx-detail-row"><span class="k">Categoria</span><span class="v">${escapeHtml(cat.emoji)} ${escapeHtml(cat.name)}</span></div><div class="tx-detail-row"><span class="k">Conto</span><span class="v">${escapeHtml(acc.name)}</span></div>`}
      <div class="tx-detail-row"><span class="k">Data</span><span class="v">${t.date.split("-").reverse().join("/")}</span></div>
      ${t.recurringId?`<div class="tx-detail-row"><span class="k">Origine</span><span class="v">Movimento ricorrente</span></div>`:t.plannedId?`<div class="tx-detail-row"><span class="k">Origine</span><span class="v">Movimento pianificato</span></div>`:""}
      ${t.note?`<div class="tx-detail-row"><span class="k">Nota</span><span class="v">${escapeHtml(t.note)}</span></div>`:""}
    `;
    // Il tap singolo mostra solo il riepilogo. Modifica/Duplica/Elimina restano nel menu da pressione prolungata.
    node.querySelector(".detail-actions")?.remove();
    node.querySelector("#deleteTxBtn")?.remove();
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
      <div class="tx-detail-row"><span class="k">Importo</span><span class="v ${item.type}">${item.type==="income"?"+":"−"}${fmt(item.amount)}</span></div>
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
  const dots = points.map((p,i)=>`<circle class="chart-point" data-point-index="${i}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.2" fill="#E8A33D" stroke="var(--paper)" stroke-width="1.5"><title>${data[i].label}: ${fmt(data[i].balance)}</title></circle>`).join("");
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

function renderAccountEvolution(node, accountId, range){
  const acc = state.accounts.find(a=>a.id===accountId);
  if(!acc) return;
  let data;
  if(range==="1m"){
    const y=viewYear, m=viewMonth;
    const daysInMonth = new Date(y, m+1, 0).getDate();
    data = [];
    for(let d=1; d<=daysInMonth; d++){
      const iso = `${y}-${pad2(m+1)}-${pad2(d)}`;
      data.push({ label:String(d), balance: accountBalanceAtDate(accountId, iso) });
    }
  } else {
    const monthsN = parseInt(range,10);
    const months = [];
    for(let i=monthsN-1;i>=0;i--){
      let m = viewMonth - i, y = viewYear;
      while(m<0){ m+=12; y-=1; }
      months.push({y,m});
    }
    data = months.map(({y,m})=>({ label: `${MESI_BREVI[m]} ${String(y).slice(2)}`, balance: accountBalanceAt(accountId,y,m) }));
  }
  node.querySelector("#accountEvolutionChartWrap").innerHTML = buildLineSVG(data, safeColor(acc.color));
  const current = data[data.length-1].balance;
  const first = data[0].balance;
  const diff = current-first;
  node.querySelector("#accountEvolutionLegend").innerHTML = `
    <div class="evo-stats-row">
      <div class="evo-stat-card">
        <p class="evo-stat-label">Saldo attuale</p>
        <p class="evo-stat-value ${current===0?"zero":""}" style="color:${moneyColor(current)}">${fmt(current)}</p>
      </div>
      <div class="evo-stat-card">
        <p class="evo-stat-label">Variazione nel periodo</p>
        <p class="evo-stat-value ${diff<0?"neg":diff>0?"pos":"zero"}">${fmtSigned(diff)}</p>
      </div>
    </div>
  `;
}

function openAccountEvolution(accountId){
  const acc = state.accounts.find(a=>a.id===accountId);
  if(!acc) return;
  openSheet("tpl-account-evolution", (node, close)=>{
    node.querySelector("#accountEvolutionTitle").textContent = `Evoluzione — ${acc.name}`;
    let range = "12";
    renderAccountEvolution(node, accountId, range);
    node.querySelectorAll("#evolutionRangeChips .chip").forEach(chip=>{
      chip.addEventListener("click", ()=>{
        node.querySelectorAll("#evolutionRangeChips .chip").forEach(c=>c.classList.remove("active"));
        chip.classList.add("active");
        range = chip.dataset.range;
        renderAccountEvolution(node, accountId, range);
      });
    });
    node.querySelector("#editAccountFromEvolutionBtn").addEventListener("click", ()=>{
      close();
      switchView("more");
      openAccountForm(accountId);
    });
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
    let chosenColor = acc?.color || PALETTE[0];

    nameInput.value = acc?.name || "";
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
        acc.name = name; acc.color = chosenColor;
        if(Math.abs(delta) >= 0.01){
          state.transactions.push({
            id:uid(), date:todayISO(), amount:Math.abs(delta),
            type:delta>0?"income":"expense", name:"Rettifica saldo",
            categoryId:null, accountId:acc.id, toAccountId:null,
            note:`Saldo aggiornato manualmente da ${fmt(before)} a ${fmt(balance)}`,
            isBalanceAdjustment:true
          });
        }
      } else {
        state.accounts.push({ id: uid(), name, balance, color: chosenColor });
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

function openMacroPanel(){
  openSheet("tpl-macro-panel", (node)=>{
    renderMacroCategories();
    node.querySelector("#addMacroCategoryBtn").addEventListener("click", ()=> openMacroForm(null));
  });
}


function openCategoriesPanel(){
  openSheet("tpl-categories-panel", (node)=>{
    renderCategories();
    node.querySelector("#addCategoryBtn").addEventListener("click", ()=> openCategoryForm(null));
  });
}


function openGraphPanel(){
  openSheet("tpl-graph-panel", (node)=>{
    renderCategoryGraph();
  });
}
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
    setMode(mode);
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

    let chosenEmoji = cat?.emoji || EMOJIS[0];
    let chosenColor = cat?.color || PALETTE[0];
    let chosenKind = cat?.kind || "expense";
    let chosenMacroId = cat?.macroCategoryId || null;

    nameInput.value = cat?.name || "";
    budgetInput.value = cat?.budget ? String(cat.budget).replace(".",",") : "";

    function renderMacroChips(){
      macroChips.innerHTML = "";
      const noneChip = document.createElement("button");
      noneChip.className = "chip" + (!chosenMacroId ? " active":"");
      noneChip.textContent = "Nessuna";
      noneChip.addEventListener("click", ()=>{ chosenMacroId=null; renderMacroChips(); });
      macroChips.appendChild(noneChip);
      state.macroCategories.filter(m=>m.kind===chosenKind).forEach(m=>{
        const chip = document.createElement("button");
        chip.className = "chip" + (chosenMacroId===m.id ? " active":"");
        chip.innerHTML = `<span class="em">${escapeHtml(m.emoji)}</span>${escapeHtml(m.name)}`;
        chip.addEventListener("click", ()=>{ chosenMacroId=m.id; renderMacroChips(); });
        macroChips.appendChild(chip);
      });
    }
    renderMacroChips();

    kindToggle.querySelectorAll(".type-opt").forEach(opt=>{
      opt.classList.toggle("active", opt.dataset.kind===chosenKind);
      opt.addEventListener("click", ()=>{
        chosenKind = opt.dataset.kind;
        if(chosenMacroId && state.macroCategories.find(m=>m.id===chosenMacroId)?.kind!==chosenKind) chosenMacroId=null;
        kindToggle.querySelectorAll(".type-opt").forEach(o=>o.classList.remove("active"));
        opt.classList.add("active");
        renderMacroChips();
      });
    });

    EMOJIS.forEach(em=>{
      const b = document.createElement("button");
      b.className = "emoji-opt" + (em===chosenEmoji?" active":"");
      b.textContent = em;
      b.addEventListener("click", ()=>{
        chosenEmoji = em;
        emojiRow.querySelectorAll(".emoji-opt").forEach(x=>x.classList.remove("active"));
        b.classList.add("active");
      });
      emojiRow.appendChild(b);
    });

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
      if(!await askConfirm("Eliminare questa categoria? I movimenti collegati resteranno ma senza categoria.")) return;
      state.categories = state.categories.filter(c=>c.id!==categoryId);
      persist(); renderAll(); close();
    });

    node.querySelector("#saveCategoryBtn").addEventListener("click", ()=>{
      const name = nameInput.value.trim();
      if(!name){ nameInput.focus(); return; }
      const budget = budgetInput.value.trim() ? parseAmount(budgetInput.value) : null;
      if(editing){
        cat.name=name; cat.emoji=chosenEmoji; cat.color=chosenColor; cat.kind=chosenKind; cat.budget=budget; cat.macroCategoryId=chosenMacroId;
      } else {
        state.categories.push({ id: uid(), name, emoji: chosenEmoji, color: chosenColor, kind: chosenKind, budget, macroCategoryId: chosenMacroId });
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

    EMOJIS.forEach(em=>{
      const b = document.createElement("button");
      b.className = "emoji-opt" + (em===chosenEmoji?" active":"");
      b.textContent = em;
      b.addEventListener("click", ()=>{
        chosenEmoji = em;
        emojiRow.querySelectorAll(".emoji-opt").forEach(x=>x.classList.remove("active"));
        b.classList.add("active");
      });
      emojiRow.appendChild(b);
    });

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
function openRecurringForm(recurringId){
  const editing = !!recurringId;
  const rec = editing ? state.recurring.find(r=>r.id===recurringId) : null;
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
      state.accounts.forEach(a=>{
        const chip = document.createElement("button");
        chip.className = "chip" + (rAcc===a.id?" active":"");
        chip.innerHTML = `<span class="em">●</span>${escapeHtml(a.name)}`;
        chip.querySelector(".em").style.color = safeColor(a.color);
        chip.addEventListener("click", ()=>{ rAcc=a.id; renderAccChips(); });
        accChips.appendChild(chip);
      });
      if(!rAcc) rAcc = state.accounts[0]?.id || null;
    }

    typeToggle.querySelectorAll(".type-opt").forEach(opt=>{
      opt.classList.toggle("active", opt.dataset.type===rType);
      opt.addEventListener("click", ()=>{
        typeToggle.querySelectorAll(".type-opt").forEach(o=>o.classList.remove("active"));
        opt.classList.add("active");
        rType = opt.dataset.type; rCat=null;
        catChips._activeMacro = null;
        renderCatChips();
      });
    });
    freqSelect.addEventListener("change", ()=>{ rFreq=freqSelect.value; });

    renderCatChips();
    renderAccChips();

    if(editing) deleteBtn.hidden = false;
    deleteBtn.addEventListener("click", async ()=>{
      if(!await askConfirm("Eliminare questo movimento ricorrente? Sarà rimosso anche dalle prossime pianificate.")) return;
      moveToTrash("recurring",rec); const deleted=state.trash[0]?.id; removeRecurring(recurringId);
      persist(); renderAll(); close(); if(deleted) showUndo("Ricorrente eliminato",deleted);
    });

    node.querySelector("#saveRecurringBtn").addEventListener("click", ()=>{
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
        refreshRecurringTransactions(rec.id);
      } else {
        state.recurring.push({
          id: uid(), name, amount, type: rType, categoryId: rCat, accountId: rAcc,
          freq: rFreq, startDate, note: noteInput.value.trim(), nextDate: startDate, active:activeInput.checked, endDate, maxOccurrences,
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
function openPlannedForm(plannedId){
  const editing = !!plannedId;
  const p = editing ? state.planned.find(x=>x.id===plannedId) : null;
  plannedTxType = p?.type || "expense";
  plannedSelectedCategoryId = p?.categoryId || null;
  plannedSelectedAccountId = p?.accountId || null;

  openSheet("tpl-planned-form", (node, close)=>{
    node.querySelector("#plannedFormTitle").textContent = editing ? "Modifica pianificata" : "Nuova pianificata";
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
        catChipsGrouped._activeMacro = null;
        renderCatChips();
      });
    });

    function renderCatChips(){
      renderCategoryPicker(catChipsGrouped, plannedTxType, ()=>plannedSelectedCategoryId, id=>{ plannedSelectedCategoryId=id; });
    }
    function renderAccChips(){
      accChips.innerHTML = "";
      state.accounts.forEach(a=>{
        const chip = document.createElement("button");
        chip.className = "chip" + (plannedSelectedAccountId===a.id ? " active":"");
        chip.innerHTML = `<span class="em">●</span>${escapeHtml(a.name)}`;
        chip.querySelector(".em").style.color = safeColor(a.color);
        chip.addEventListener("click", ()=>{ plannedSelectedAccountId=a.id; renderAccChips(); });
        accChips.appendChild(chip);
      });
      if(!plannedSelectedAccountId) plannedSelectedAccountId = state.accounts[0]?.id || null;
    }
    renderCatChips();
    renderAccChips();

    if(editing) deleteBtn.hidden = false;
    deleteBtn.addEventListener("click", async ()=>{
      if(!await askConfirm("Eliminare questa spesa pianificata?")) return;
      moveToTrash("planned",p); const deleted=state.trash[0]?.id; state.planned = state.planned.filter(x=>x.id!==plannedId);
      persist(); renderAll(); close(); if(deleted) showUndo("Pianificata eliminata",deleted);
    });

    node.querySelector("#savePlannedBtn").addEventListener("click", ()=>{
      const amount = parseAmount(amountInput.value);
      const missing=[];if(!nameInput.value.trim()) missing.push("nome");if(amount<=0) missing.push("importo");if(!plannedSelectedCategoryId) missing.push("categoria");if(!plannedSelectedAccountId) missing.push("conto");if(!dateInput.value) missing.push("data");
      if(missing.length){showToast("Inserisci: "+missing.join(", "));if(amount<=0) amountInput.focus();return;}
      const date = dateInput.value;
      if(editing){
        p.name=nameInput.value.trim(); p.amount=amount; p.type=plannedTxType; p.categoryId=plannedSelectedCategoryId;
        p.accountId=plannedSelectedAccountId; p.date=date; p.note=noteInput.value.trim();
      } else {
        state.planned.push({
          id: uid(), name:nameInput.value.trim(), amount, type: plannedTxType, categoryId: plannedSelectedCategoryId,
          accountId: plannedSelectedAccountId, date, note: noteInput.value.trim(),
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
}
function openCalendar(){
  calYear = viewYear; calMonth = viewMonth;
  openSheet("tpl-calendar", (node)=>{
    renderCalendarGrid(node);
    node.querySelector("#calPrevMonth").addEventListener("click", ()=>{
      calMonth--; if(calMonth<0){ calMonth=11; calYear--; }
      renderCalendarGrid(node);
    });
    node.querySelector("#calNextMonth").addEventListener("click", ()=>{
      calMonth++; if(calMonth>11){ calMonth=0; calYear++; }
      renderCalendarGrid(node);
    });
  });
}
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
  const rows=[["Data","Tipo","Nome","Categoria","Macrocategoria","Conto","Conto destinazione","Importo","Nota","Origine"]];
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
      t.recurringId?"Ricorrente":t.plannedId?"Pianificata":t.isBalanceAdjustment?"Rettifica saldo":"Manuale"
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
  balancesHidden=true;
  safeSetLocalStorage("bilancio_hide_balances","1",{notify:false});
  generatePlannedTransactions();
  generateRecurringTransactions(false);
  renderAll();
});

/* ---------------- Service worker / aggiornamenti PWA ---------------- */
function showAppUpdatePrompt(registration){
  let panel=document.getElementById("appUpdatePrompt");
  if(!panel){
    panel=document.createElement("div");
    panel.id="appUpdatePrompt";
    panel.className="app-update-prompt";
    panel.setAttribute("role","dialog");
    panel.setAttribute("aria-live","polite");
    panel.setAttribute("aria-label","Aggiornamento disponibile");
    panel.innerHTML=`
      <div class="app-update-icon" aria-hidden="true">↻</div>
      <div class="app-update-copy">
        <strong>Nuova versione disponibile</strong>
        <span>È disponibile un aggiornamento di Money Tracker.</span>
      </div>
      <div class="app-update-actions">
        <button type="button" class="app-update-later">Più tardi</button>
        <button type="button" class="app-update-now">Aggiorna ora</button>
      </div>`;
    document.body.appendChild(panel);
  }

  panel.classList.add("show");
  panel.querySelector(".app-update-later").onclick=()=>panel.classList.remove("show");
  panel.querySelector(".app-update-now").onclick=()=>{
    const waiting=registration.waiting;
    if(!waiting) return;
    panel.querySelector(".app-update-now").disabled=true;
    panel.querySelector(".app-update-now").textContent="Aggiornamento…";
    waiting.postMessage({type:"SKIP_WAITING"});
  };
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
document.getElementById("homeMainAccountCard")?.addEventListener("click",()=>{
  if(state.mainAccountId) openAccountEvolution(state.mainAccountId); else switchView("accounts");
});
activeView="home";
generatePlannedTransactions();
generateRecurringTransactions(false);
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
    return `<div class="lp-row"><span class="lp-ic">${escapeHtml(c?.emoji||(t.type==="income"?"↑":"↓"))}</span><span class="lp-main"><b>${escapeHtml(name)}</b><small>${when}${future&&kind?` · ${kind}`:""}</small></span><span class="lp-amt ${t.type}">${amount}</span></div>`;
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
function lpOutside(e){ if(!e.target.closest("#lpPopup")) closeLongPressPopup(); }
function closeLongPressPopup(){
  document.getElementById("lpPopup")?.remove();
  document.removeEventListener("pointerdown",lpOutside,true);
}
let lpSuppressClick=false;
document.addEventListener("click",e=>{ if(lpSuppressClick){ e.preventDefault(); e.stopPropagation(); lpSuppressClick=false; } },true);
function bindLongPress(el,handler){
  if(!el || el.dataset.lpBound) return;
  el.dataset.lpBound="1"; el.classList.add("lp-target");
  let timer=null,x=0,y=0;
  const cancel=()=>{clearTimeout(timer);timer=null;el.classList.remove("lp-pressing");};
  el.addEventListener("pointerdown",e=>{
    if(e.button!==undefined && e.button!==0) return;
    x=e.clientX;y=e.clientY;el.classList.add("lp-pressing");
    timer=setTimeout(()=>{timer=null;el.classList.remove("lp-pressing");lpSuppressClick=true;setTimeout(()=>{lpSuppressClick=false;},700);try{navigator.vibrate?.(12);}catch(_){};handler(e);},480);
  });
  el.addEventListener("pointermove",e=>{if(timer && Math.hypot(e.clientX-x,e.clientY-y)>10) cancel();});
  ["pointerup","pointercancel","pointerleave"].forEach(ev=>el.addEventListener(ev,cancel));
  el.addEventListener("contextmenu",e=>e.preventDefault());
}
function setupLongPressTargets(){
  const byId=id=>document.getElementById(id);
  // Home — ultimi 5 movimenti
  bindLongPress(byId("netAmount"),()=>showLongPressPopup(byId("netAmount"),"Ultimi 5 movimenti",lpLastMovements(),{emptyText:"Nessun movimento registrato."}));
  bindLongPress(document.querySelector("#view-home .hero-split-item.income"),e=>showLongPressPopup(e.currentTarget||document.querySelector("#view-home .hero-split-item.income"),"Ultime 5 entrate",lpLastMovements(t=>t.type==="income"),{emptyText:"Nessuna entrata registrata."}));
  bindLongPress(document.querySelector("#view-home .hero-split-item.expense"),()=>showLongPressPopup(document.querySelector("#view-home .hero-split-item.expense"),"Ultime 5 uscite",lpLastMovements(t=>t.type==="expense"),{emptyText:"Nessuna uscita registrata."}));
  bindLongPress(byId("homeMainAccountCard"),()=>{
    const acc=state.accounts.find(a=>a.id===state.mainAccountId);
    showLongPressPopup(byId("homeMainAccountCard"),acc?`Ultimi 5 · ${acc.name}`:"Ultimi 5 movimenti",lpLastMovements(acc?(t=>t.accountId===acc.id||t.toAccountId===acc.id):null));
  });
  bindLongPress(document.querySelector("#view-home .hero-liquidity-item.all"),()=>showLongPressPopup(document.querySelector("#view-home .hero-liquidity-item.all"),"Ultimi 5 movimenti",lpLastMovements()));
  const fc=document.querySelectorAll("#view-home .forecast-card");
  if(fc[0]) bindLongPress(fc[0],()=>showLongPressPopup(fc[0],"Ultimi 5 movimenti",lpLastMovements()));
  if(fc[1]) bindLongPress(fc[1],()=>showLongPressPopup(fc[1],"Prossimi 5 in arrivo",lpNextScheduled(),{future:true,emptyText:"Nessuna voce in arrivo."}));
  if(fc[2]) bindLongPress(fc[2],()=>showLongPressPopup(fc[2],"Prossimi 5 in arrivo",lpNextScheduled(),{future:true,emptyText:"Nessuna voce in arrivo."}));
  // R&P — prossimi 5 (mix, solo ricorrenti, solo pianificate)
  const rp=[["recurringEstimateCard","Prossimi 5 ricorrenti",t=>!!t.recurringId],["plannedEstimateCard","Prossime 5 pianificate",t=>!!t.plannedId],["rpCombinedEstimateCard","Prossimi 5 · ricorrenti e pianificate",null]];
  rp.forEach(([id,title,f])=>{
    const card=byId(id); if(!card) return;
    bindLongPress(card,e=>{
      const chip=e.target.closest?.(".rp-estimate-breakdown span, .rp-combined-breakdown span");
      let filter=f, t=title;
      if(chip){
        const income=/Entrate/.test(chip.textContent);
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
