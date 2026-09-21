/* =========================================================
   Bilancio — logica app
   Stato persistito in localStorage, nessuna dipendenza esterna.
   ========================================================= */

const STORAGE_KEY = "bilancio_v1";
const THEME_KEY = "bilancio_theme";
const MESI = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
const MESI_BREVI = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];
const FREQ_LABEL = { weekly: "Ogni settimana", monthly: "Ogni mese", yearly: "Ogni anno" };

const PALETTE = ["#1F5D4C","#3AA684","#D4A83A","#A8322D","#6B7FD7","#C25B9E","#4FA8C9","#8A6A16","#5B7553","#946638"];
const EMOJIS = ["🛒","🚗","💡","🏠","💊","🎬","👕","✈️","📚","🐾","☕","🍽️","🎁","💰","➕","📱","🏋️","🧾","🎓","🐶"];

/* ---------------- Utilities ---------------- */
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
function pad2(n){ return String(n).padStart(2,"0"); }
function todayISO(){ const d=new Date(); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
function fmt(n){
  const v = Math.round((n||0)*100)/100;
  return "€" + v.toLocaleString("it-IT", { minimumFractionDigits: v % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 });
}
function fmtSigned(n){ return (n>=0?"+":"−") + fmt(Math.abs(n)).slice(1); }
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
function stepDateISO(iso, freq){
  const d = new Date(iso+"T00:00:00");
  if(freq==="weekly") d.setDate(d.getDate()+7);
  else if(freq==="yearly") d.setFullYear(d.getFullYear()+1);
  else d.setMonth(d.getMonth()+1);
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
      { id: macroId.giornaliere, name: "Spese giornaliere", emoji: "🛒", color: PALETTE[1], budget: 400 },
      { id: macroId.casa, name: "Casa e utenze", emoji: "🏠", color: PALETTE[4], budget: null },
      { id: macroId.trasporti, name: "Trasporti", emoji: "🚗", color: PALETTE[2], budget: null },
      { id: macroId.salute, name: "Salute e benessere", emoji: "💊", color: PALETTE[5], budget: null },
      { id: macroId.entrate, name: "Entrate", emoji: "💰", color: PALETTE[0], budget: null },
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
  };
}

/* ---------------- State load/save ---------------- */
let state = load();
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
  parsed.macroCategories.forEach(m=>{ if(m.budget===undefined) m.budget = null; });
  parsed.categories.forEach(c=>{ if(c.macroCategoryId===undefined) c.macroCategoryId = null; });
  if(!Array.isArray(parsed.recurring)) parsed.recurring = [];
  if(!Array.isArray(parsed.planned)) parsed.planned = [];
  // I modelli rapidi sono stati sostituiti da categorie/macrocategorie: rimuovi eventuali residui.
  delete parsed.templates;
  return parsed;
}
function persist(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

/* ---------------- Tema (chiaro/scuro/sistema) ---------------- */
const systemDarkMQ = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
function effectiveTheme(mode){
  if(mode==="system") return (systemDarkMQ && systemDarkMQ.matches) ? "dark" : "light";
  return mode;
}
function applyTheme(mode){
  document.documentElement.setAttribute("data-theme", effectiveTheme(mode));
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
let viewDay = now.getDate();
const periodModes = {home:"month", recurring:"month", stats:"month", transactions:"month"};
function selectedDate(){return `${viewYear}-${pad2(viewMonth+1)}-${pad2(viewDay)}`;}
function periodTx(view){return monthTx().filter(t=>periodModes[view]!=="day" || t.date===selectedDate());}
function sumTransactions(tx){
  const income=tx.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0);
  const expense=tx.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);
  return {income,expense,net:income-expense};
}
function moneyColor(value){return value>0?"var(--emerald)":value<0?"var(--rust)":"#fff";}

let txType = "expense";
let selectedCategoryId = null;
let selectedAccountId = null;
let statsGroupMode = "category";

/* ---------------- Helpers on state ---------------- */
function accountsById(){ return Object.fromEntries(state.accounts.map(a=>[a.id,a])); }
function categoriesById(){ return Object.fromEntries(state.categories.map(c=>[c.id,c])); }
function macroCategoriesById(){ return Object.fromEntries(state.macroCategories.map(m=>[m.id,m])); }

/* Picker categoria a due passi: prima si sceglie la macrocategoria, poi solo le
   categorie di quella macro vengono proposte. `container` mantiene lo stato
   (macro attiva) tra i re-render tramite una proprietà JS sull'elemento. */
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
  if(!activeMacro || !groups.has(activeMacro)) activeMacro = macroOrder[0] || null;
  container._activeMacro = activeMacro;

  container.innerHTML = "";
  const showMacroRow = macroOrder.length>1 || (macroOrder.length===1 && macroOrder[0]!=="none");

  if(showMacroRow){
    const macroWrap = document.createElement("div");
    macroWrap.className = "chip-group";
    macroWrap.innerHTML = `<p class="chip-group-title">Macrocategoria</p>`;
    const macroRow = document.createElement("div");
    macroRow.className = "chip-row";
    macroOrder.forEach(key=>{
      const chip = document.createElement("button");
      chip.className = "chip" + (activeMacro===key ? " active":"");
      chip.innerHTML = key==="none" ? `<span class="em">🏷️</span>Altre` : `<span class="em">${macros[key].emoji}</span>${macros[key].name}`;
      chip.addEventListener("click", ()=>{
        container._activeMacro = key;
        const list = groups.get(key) || [];
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
  if(container.id!=="categoryChipsGrouped") catWrap.innerHTML = `<p class="chip-group-title">Categoria</p>`;
  const catRow = document.createElement("div");
  catRow.className = "chip-row";
  const currentList = groups.get(activeMacro) || [];
  currentList.forEach(c=>{
    const chip = document.createElement("button");
    chip.className = "chip" + (getSelected()===c.id ? " active":"");
    chip.innerHTML = `<span class="em">${c.emoji}</span>${c.name}`;
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
  tx.forEach(t=> t.type==="income" ? income+=t.amount : expense+=t.amount);
  return { income, expense, net: income-expense };
}
function accountBalance(accId){
  const start = state.accounts.find(a=>a.id===accId)?.balance || 0;
  const delta = state.transactions.reduce((sum,t)=>{
    if(t.accountId!==accId) return sum;
    return sum + (t.type==="income" ? t.amount : -t.amount);
  },0);
  return start + delta;
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
    if(t.accountId!==accId || t.date>cutoff) return sum;
    return sum + (t.type==="income" ? t.amount : -t.amount);
  },0);
  return acc.balance + delta;
}
function accountBalanceAtDate(accId, iso){
  // Saldo del conto al termine della giornata iso (incluso).
  const acc = state.accounts.find(a=>a.id===accId);
  if(!acc) return 0;
  const delta = state.transactions.reduce((sum,t)=>{
    if(t.accountId!==accId || t.date>iso) return sum;
    return sum + (t.type==="income" ? t.amount : -t.amount);
  },0);
  return acc.balance + delta;
}

/* ---------------- Movimenti ricorrenti ---------------- */
function generateRecurringTransactions(){
  const todayStr = todayISO();
  let changed = false;
  state.recurring.forEach(r=>{
    if(!r.nextDate) r.nextDate = r.startDate;
    let safety = 0;
    while(r.nextDate <= todayStr && safety < 1000){
      state.transactions.push({
        id: uid(),
        date: r.nextDate,
        amount: r.amount,
        type: r.type,
        categoryId: r.categoryId,
        accountId: r.accountId,
        note: r.note || "",
        recurringId: r.id,
      });
      r.nextDate = stepDateISO(r.nextDate, r.freq);
      changed = true;
      safety++;
    }
  });
  if(changed) persist();
}

/* ---------------- Spese pianificate (una tantum + proiezione ricorrenti future) ---------------- */
function generatePlannedTransactions(){
  // Converte in movimenti reali le spese "una tantum" pianificate la cui data è arrivata.
  const todayStr = todayISO();
  let changed = false;
  state.planned = state.planned.filter(p=>{
    if(p.date <= todayStr){
      state.transactions.push({
        id: uid(), date: p.date, amount: p.amount, type: p.type,
        categoryId: p.categoryId, accountId: p.accountId, note: p.note || "",
        plannedId: p.id,
      });
      changed = true;
      return false;
    }
    return true;
  });
  if(changed) persist();
}
function recurringOccurrencesInMonth(r, y, m){
  // Date (future, non ancora generate) in cui un ricorrente cadrà nel mese y-m.
  const monthStart = `${y}-${pad2(m+1)}-01`;
  const monthEnd = `${y}-${pad2(m+1)}-31`;
  const dates = [];
  let d = r.nextDate;
  let safety = 0;
  while(d && d<=monthEnd && safety<500){
    if(d>=monthStart) dates.push(d);
    d = stepDateISO(d, r.freq);
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
    categoryId: p.categoryId, accountId: p.accountId, note: p.note || "", planned: true,
  }));
  const recurringOcc = [];
  state.recurring.forEach(r=>{
    recurringOccurrencesInMonth(r,y,m).forEach(date=>{
      recurringOcc.push({
        id: "rec_"+r.id+"_"+date, recurringId: r.id, date, amount: r.amount, type: r.type,
        categoryId: r.categoryId, accountId: r.accountId, note: r.note || "", planned: true,
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
  document.getElementById("monthLabel").textContent = `${daily?viewDay+" ":""}${MESI[viewMonth]} ${viewYear} ▾`;
  document.getElementById("periodDate").value=selectedDate();
  document.getElementById("periodReturn").hidden=!daily || !["home","recurring","stats","transactions"].includes(activeView);
  document.getElementById("dayControl").hidden=!daily;
  document.getElementById("prevMonth").setAttribute("aria-label",daily?"Giorno precedente":"Mese precedente");
  document.getElementById("nextMonth").setAttribute("aria-label",daily?"Giorno successivo":"Mese successivo");
  document.querySelectorAll("[data-period]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.period===periodModes[activeView])));
}

/* ---------------- Rendering: Home ---------------- */
function renderHome(){
  const { income, expense, net } = sumTransactions(periodTx("home"));
  document.getElementById("netAmount").textContent = fmt(net);
  document.getElementById("netAmount").style.color = moneyColor(net);
  document.getElementById("incomeAmount").textContent = fmt(income);
  document.getElementById("expenseAmount").textContent = fmt(expense);

  document.querySelector("#view-home .hero-label").textContent=periodModes.home==="day"?"Saldo netto del giorno":"Saldo netto del mese";
  renderUnifiedBudgets();

  // Recent tx
  const recent = periodTx("home").slice().sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id)).slice(0,5);
  renderTxRows(document.getElementById("recentTx"), recent);
  document.getElementById("txEmptyHint").hidden = recent.length>0;
  document.getElementById("txEmptyHint").textContent=periodModes.home==="day"?"Nessun movimento in questo giorno.":"Nessun movimento questo mese.";

  // Spese pianificate del mese visualizzato (non incidono sul saldo)
  const planned = plannedItemsForMonth(viewYear, viewMonth).filter(t=>periodModes.home!=="day" || t.date===selectedDate()).sort((a,b)=> a.date.localeCompare(b.date));
  const homePlannedWrap = document.getElementById("homePlannedWrap");
  homePlannedWrap.querySelector("h2").textContent=periodModes.home==="day"?"Pianificati per questo giorno":"In arrivo questo mese";
  if(planned.length){
    homePlannedWrap.hidden = false;
    renderTxRows(document.getElementById("homePlannedList"), planned);
  } else {
    homePlannedWrap.hidden = true;
  }
}

function renderUnifiedBudgets(){
  const tx=periodTx("home").filter(t=>t.type==="expense");
  const cats=state.categories.filter(c=>c.kind==="expense");
  const groups=state.macroCategories.map(m=>({...m,cats:cats.filter(c=>c.macroCategoryId===m.id)}));
  const orphan=cats.filter(c=>!state.macroCategories.some(m=>m.id===c.macroCategoryId));
  if(orphan.length) groups.push({name:"Senza macrocategoria",emoji:"🏷️",cats:orphan});
  const list=document.getElementById("budgetList");list.innerHTML="";
  const spentFor=c=>tx.filter(t=>t.categoryId===c.id).reduce((s,t)=>s+t.amount,0);
  function budgetRow(name,emoji,spent,budget,child){
    const limit=Number(budget)>0?Number(budget):0;
    return `<div class="${child?"budget-child":"budget-parent"}"><div class="budget-item-top"><span class="budget-item-name">${emoji||""} ${escapeHtml(name)}</span><span class="budget-item-amounts">${fmt(spent)}${limit?` / ${fmt(limit)}`:" spesi"}</span></div>${limit?`<div class="budget-bar-track"><div class="budget-bar-fill" style="width:${Math.min(100,spent/limit*100)}%;background:${spent>limit?"var(--rust)":"var(--emerald)"}"></div></div>`:""}</div>`;
  }
  groups.filter(g=>g.cats.length || g.budget>0).forEach(g=>{
    const spent=g.cats.reduce((s,c)=>s+spentFor(c),0);
    const item=document.createElement("div");item.className="budget-item";
    item.innerHTML=budgetRow(g.name,g.emoji,spent,g.budget,false)+g.cats.map(c=>budgetRow(c.name,c.emoji,spentFor(c),c.budget,true)).join("");
    list.appendChild(item);
  });
  document.getElementById("budgetEmptyHint").hidden=list.children.length>0;
  document.getElementById("budgetPeriodHint").textContent=periodModes.home==="day"?"Spese del giorno selezionato · limiti di budget mensili":"Spese e budget del mese selezionato";
}

function renderTxRows(container, list){
  const cats = categoriesById();
  const accs = accountsById();
  container.innerHTML = "";
  list.forEach(t=>{
    const cat = cats[t.categoryId] || { name:"Categoria eliminata", emoji:"❔", color:"#999" };
    const acc = accs[t.accountId] || { name:"Conto eliminato" };
    const row = document.createElement("button");
    row.className = "tx-row" + (t.planned ? " planned" : "");
    row.dataset.id = t.id;
    const d = new Date(t.date+"T00:00:00");
    const plannedBadge = t.planned ? ` · 🗓️ ${t.recurringId?"Ricorrente pianificata":"Una tantum pianificata"}` : (t.recurringId ? " · 🔁" : "");
    row.innerHTML = `
      <span class="tx-icon" style="background:${cat.color}22;">${cat.emoji}</span>
      <span class="tx-mid">
        <p class="tx-cat">${cat.name}${t.note?` · ${escapeHtml(t.note)}`:""}${plannedBadge}</p>
        <p class="tx-sub">${acc.name} · ${d.getDate()} ${MESI_BREVI[d.getMonth()]}</p>
      </span>
      <span class="tx-amount ${t.type}">${t.type==="income"?"+":"−"}${fmt(t.amount)}</span>
    `;
    row.addEventListener("click", ()=>{
      if(t.planned){
        if(t.recurringId) openRecurringForm(t.recurringId);
        else openPlannedForm(t.plannedId);
      } else {
        openTxDetail(t.id);
      }
    });
    container.appendChild(row);
  });
}

function escapeHtml(str){
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

/* ---------------- Rendering: Transactions (full) ---------------- */
function renderTransactionsView(){
  document.getElementById("txMonthLabel").textContent = `${periodModes.transactions==="day"?viewDay+" ":""}${MESI[viewMonth]} ${viewYear}`;
  const all = periodTx("transactions").slice().sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
  renderTxRows(document.getElementById("allTx"), all);
  document.getElementById("allTxEmptyHint").hidden = all.length>0;
  document.getElementById("allTxEmptyHint").textContent=periodModes.transactions==="day"?"Nessun movimento in questo giorno.":"Nessun movimento questo mese.";

  const planned = plannedItemsForMonth(viewYear, viewMonth).filter(t=>periodModes.transactions!=="day" || t.date===selectedDate()).sort((a,b)=> a.date.localeCompare(b.date));
  const plannedWrap = document.getElementById("allTxPlannedWrap");
  if(planned.length){
    plannedWrap.hidden = false;
    renderTxRows(document.getElementById("allTxPlanned"), planned);
  } else {
    plannedWrap.hidden = true;
  }
}

/* ---------------- Rendering: Ricorrenti ---------------- */
function renderRecurringList(){
  const container = document.getElementById("recurringList");
  const cats = categoriesById();
  container.innerHTML = "";
  const visible=state.recurring.filter(r=>{
    const dates=recurringOccurrencesInMonth(r,viewYear,viewMonth);
    const real=state.transactions.filter(t=>t.recurringId===r.id && t.date.startsWith(`${viewYear}-${pad2(viewMonth+1)}`));
    return periodModes.recurring==="day" ? dates.includes(selectedDate()) || real.some(t=>t.date===selectedDate()) : dates.length>0 || real.length>0;
  });
  visible.forEach(r=>{
    const cat = cats[r.categoryId] || {};
    const row = document.createElement("button");
    row.className = "template-manage-row";
    row.innerHTML = `
      <span class="ic" style="background:${cat.color?cat.color+"22":"#eee"};">${cat.emoji||"🔁"}</span>
      <span class="info">
        <p class="nm">${r.name}</p>
        <p class="sub"><span class="amt ${r.type}">${r.type==="income"?"+":"−"}${fmt(r.amount)}</span> · ${FREQ_LABEL[r.freq]||""} · ${cat.name||""}</p>
      </span>
      <span class="chev">›</span>
    `;
    row.addEventListener("click", ()=> openRecurringForm(r.id));
    container.appendChild(row);
  });
  document.getElementById("recurringEmptyHint").hidden = visible.length>0;
  document.getElementById("recurringEmptyHint").textContent="Nessun movimento ricorrente nel periodo selezionato.";
}

/* ---------------- Rendering: Spese pianificate ---------------- */
function renderPlannedList(){
  const container = document.getElementById("plannedList");
  if(!container) return;
  const cats = categoriesById();
  const items = [];
  state.planned.forEach(p=>{
    const cat = cats[p.categoryId] || {};
    items.push({
      key: "once_"+p.id, date: p.date, kind: "once", id: p.id,
      label: cat.name || "Una tantum", emoji: cat.emoji || "🗓️", color: cat.color || "#999",
      amount: p.amount, type: p.type,
    });
  });
  state.recurring.forEach(r=>{
    const cat = cats[r.categoryId] || {};
    items.push({
      key: "rec_"+r.id, date: r.nextDate, kind: "recurring", id: r.id,
      label: r.name, emoji: cat.emoji || "🔁", color: cat.color || "#999",
      amount: r.amount, type: r.type, freq: r.freq,
    });
  });
  items.sort((a,b)=> (a.date||"").localeCompare(b.date||""));
  container.innerHTML = "";
  items.forEach(it=>{
    const row = document.createElement("button");
    row.className = "template-manage-row planned-row";
    const d = it.date ? new Date(it.date+"T00:00:00") : null;
    const whenLabel = d ? `${d.getDate()} ${MESI_BREVI[d.getMonth()]} ${d.getFullYear()}` : "—";
    row.innerHTML = `
      <span class="ic" style="background:${it.color}22;">${it.emoji}</span>
      <span class="info">
        <p class="nm">${it.label}</p>
        <p class="sub"><span class="amt ${it.type}">${it.type==="income"?"+":"−"}${fmt(it.amount)}</span> · ${it.kind==="recurring"?`${FREQ_LABEL[it.freq]||""} · prossima: `:"prevista: "}${whenLabel}</p>
      </span>
      <span class="planned-badge">${it.kind==="recurring"?"Ricorrente":"Una tantum"}</span>
      <span class="chev">›</span>
    `;
    row.addEventListener("click", ()=>{
      if(it.kind==="recurring") openRecurringForm(it.id);
      else openPlannedForm(it.id);
    });
    container.appendChild(row);
  });
  const hint = document.getElementById("plannedEmptyHint");
  if(hint) hint.hidden = items.length>0;
}

/* ---------------- Rendering: Stats ---------------- */
let statsTrendRange = "1m";
function renderStats(){
  renderPie();
  renderTrendSection();
  renderAccountBreakdown();
}

function renderPie(){
  const tx = periodTx("stats").filter(t=>t.type==="expense");
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
    wrap.innerHTML = `<svg width="180" height="180" viewBox="0 0 180 180" role="img" aria-label="Nessuna spesa nel periodo selezionato">
      <circle cx="90" cy="90" r="70" fill="none" stroke="var(--line)" stroke-width="26"/>
      <text x="90" y="86" text-anchor="middle" font-weight="700" font-size="20" fill="var(--ink)">${fmt(0)}</text>
      <text x="90" y="108" text-anchor="middle" font-size="11" fill="var(--ink-soft)">Nessuna spesa</text>
    </svg>`;
    return;
  }

  const size=180, r=70, cx=size/2, cy=size/2, circumference = 2*Math.PI*r;
  let offset = 0;
  let circles = "";
  entries.forEach(([key,val])=>{
    let info;
    if(statsGroupMode==="macro"){
      info = key==="none" ? {color:"#999",name:"Senza macrocategoria",emoji:"❔"} : macros[key];
    } else {
      info = cats[key] || {color:"#999",name:"Altro",emoji:"❔"};
    }
    const frac = val/total;
    const len = frac*circumference;
    circles += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${info.color}" stroke-width="26"
      stroke-dasharray="${len} ${circumference-len}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})"/>`;
    offset += len;

    const legItem = document.createElement("div");
    legItem.className = "pie-legend-item";
    legItem.innerHTML = `<span class="sw" style="background:${info.color}"></span><span class="lbl">${info.emoji} ${info.name}</span><span class="val">${fmt(val)} · ${Math.round(frac*100)}%</span>`;
    legend.appendChild(legItem);
  });

  wrap.innerHTML = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      ${circles}
      <text x="${cx}" y="${cy-4}" text-anchor="middle" font-family="Space Grotesk" font-weight="700" font-size="20" fill="var(--ink)">${fmt(total)}</text>
      <text x="${cx}" y="${cy+16}" text-anchor="middle" font-family="Inter" font-size="10.5" fill="#4B5450">uscite totali</text>
    </svg>`;
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
    chart+=`<line x1="${left}" y1="${y}" x2="${w-right}" y2="${y}" stroke="var(--line)" stroke-dasharray="3 3"/>
      <text x="${left-6}" y="${y+3}" text-anchor="end" font-size="10" fill="var(--ink-soft)">${label}</text>`;
  }
  chart+=`<text x="${left-6}" y="10" text-anchor="end" font-size="10" fill="var(--ink-soft)">€</text>`;
  data.forEach((d,i)=>{
    const x=left+i*slot+slot*0.08;
    const incH=d.income>0?Math.max(1.5,d.income/max*plotH):0;
    const expH=d.expense>0?Math.max(1.5,d.expense/max*plotH):0;
    chart+=`<rect x="${x}" y="${baseline-incH}" width="${barW}" height="${incH}" rx="1" fill="var(--emerald-soft)"><title>${d.label}: entrate ${fmt(d.income)}</title></rect>
      <rect x="${x+slot*0.44}" y="${baseline-expH}" width="${barW}" height="${expH}" rx="1" fill="var(--rust)"><title>${d.label}: uscite ${fmt(d.expense)}</title></rect>`;
    if(i%labelStep===0 || i===data.length-1){
      // Avoid crowding the last two labels in months with 31 days.
      if(i!==data.length-1 && data.length-1-i<labelStep*0.6) return;
      chart+=`<text x="${left+(i+0.5)*slot}" y="${h-10}" text-anchor="middle" font-size="10" fill="var(--ink-soft)">${d.label}</text>`;
    }
  });
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Andamento delle entrate e delle uscite">${chart}</svg>`;
}

/* ---------------- Andamento (Statistiche) ---------------- */
function computeTrendData(range){
  if(range==="1m"){
    const y=viewYear, m=viewMonth;
    const daysInMonth = new Date(y, m+1, 0).getDate();
    const data = [];
    for(let d=1; d<=daysInMonth; d++){
      const iso = `${y}-${pad2(m+1)}-${pad2(d)}`;
      let income=0, expense=0;
      state.transactions.filter(t=>t.date===iso).forEach(t=>{ t.type==="income" ? income+=t.amount : expense+=t.amount; });
      data.push({ label:String(d), income, expense });
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
      state.transactions.filter(t=>t.date===iso).forEach(t=>{ t.type==="income" ? income+=t.amount : expense+=t.amount; });
      data.push({ label: `${d.getDate()}/${d.getMonth()+1}`, income, expense });
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
  return months.map(({y,m})=>({ ...monthTotals(y,m), label: MESI_BREVI[m] }));
}

function renderTrendSection(){
  const daily=periodModes.stats==="day";
  const data = daily?[{label:`${viewDay}/${viewMonth+1}`,...sumTransactions(periodTx("stats"))}]:computeTrendData(statsTrendRange);
  document.querySelector(".trend-filter").hidden=daily;
  document.getElementById("barWrap").innerHTML = buildBarsSVG(data);
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
document.getElementById("trendRangeSelect").addEventListener("change", event=>{
  statsTrendRange=event.target.value;
  renderTrendSection();
});

function renderAccountBreakdown(){
  const tx = periodTx("stats");
  const container = document.getElementById("accountBreakdown");
  container.className = "stat-card-grid";
  container.innerHTML = "";
  state.accounts.forEach(a=>{
    const net = tx.filter(t=>t.accountId===a.id).reduce((s,t)=> s + (t.type==="income"?t.amount:-t.amount), 0);
    const card = document.createElement("div");
    card.className = "stat-card";
    card.innerHTML = `
      <p class="stat-card-label"><span class="sw" style="background:${a.color}"></span>${a.name}</p>
      <p class="stat-card-value ${net<0?"neg":net>0?"pos":"zero"}">${fmtSigned(net)}</p>
    `;
    container.appendChild(card);
  });
}

/* ---------------- Rendering: Accounts ---------------- */
function renderAccounts(){
  const totalEl = document.getElementById("totalBalanceAmount");
  const total = totalBalance();
  totalEl.textContent = fmt(total);
  totalEl.style.color = moneyColor(total);

  const container = document.getElementById("accountsList");
  container.innerHTML = "";
  state.accounts.forEach(a=>{
    const bal = accountBalance(a.id);
    const card = document.createElement("button");
    card.className = "account-card";
    card.innerHTML = `
      <span class="account-swatch" style="background:${a.color}"></span>
      <span class="account-info">
        <p class="account-name">${a.name}</p>
        <p class="account-type">Saldo attuale</p>
      </span>
      <span class="account-balance" style="color:${moneyColor(bal)}">${fmt(bal)}</span>
    `;
    card.addEventListener("click", ()=> openAccountEvolution(a.id));
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
      <span class="ic" style="background:${a.color}22;">●</span>
      <span class="info">
        <p class="nm">${a.name}</p>
        <p class="sub">Saldo attuale: <span class="amt">${fmt(bal)}</span></p>
      </span>
      <span class="chev">›</span>
    `;
    row.querySelector(".ic").style.color = a.color;
    row.addEventListener("click", ()=> openAccountForm(a.id));
    container.appendChild(row);
  });
}

/* ---------------- Rendering: More (macrocategorie, categorie, grafo, dati) ---------------- */
function renderCategories(){
  const container = document.getElementById("categoriesList");
  if(!container) return;
  const macros = macroCategoriesById();
  container.innerHTML = "";

  function buildRow(c){
    const row = document.createElement("button");
    row.className = "category-row";
    row.innerHTML = `
      <span class="ic" style="background:${c.color}22;">${c.emoji}</span>
      <span class="info">
        <p class="nm">${c.name}</p>
        <p class="sub">${c.kind==="income"?"Entrata":"Uscita"}${c.budget?` · budget <span class="amt">${fmt(c.budget)}</span>`:""}</p>
      </span>
      <span class="chev">›</span>
    `;
    row.addEventListener("click", ()=> openCategoryForm(c.id));
    return row;
  }

  // Raggruppa le categorie per macrocategoria
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
    group.innerHTML = `<p class="category-group-title"><span>${m.emoji}</span>${m.name}</p>`;
    groups.get(m.id).forEach(c=> group.appendChild(buildRow(c)));
    container.appendChild(group);
  });

  if(groups.has("none")){
    const group = document.createElement("div");
    group.className = "category-group";
    group.innerHTML = `<p class="category-group-title">Senza macrocategoria</p>`;
    groups.get("none").forEach(c=> group.appendChild(buildRow(c)));
    container.appendChild(group);
  }
}

function renderMacroCategories(){
  const container = document.getElementById("macroCategoriesList");
  if(!container) return;
  container.innerHTML = "";
  state.macroCategories.forEach(m=>{
    const count = state.categories.filter(c=>c.macroCategoryId===m.id).length;
    const row = document.createElement("button");
    row.className = "category-row";
    row.innerHTML = `
      <span class="ic" style="background:${m.color}22;">${m.emoji}</span>
      <span class="info">
        <p class="nm">${m.name}</p>
        <p class="sub">${count} categori${count===1?"a":"e"} associat${count===1?"a":"e"}${m.budget?` · budget <span class="amt">${fmt(m.budget)}</span>`:""}</p>
      </span>
      <span class="chev">›</span>
    `;
    row.addEventListener("click", ()=> openMacroForm(m.id));
    container.appendChild(row);
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
    macroNode.innerHTML = `<div class="graph-macro-node" style="border-color:${color}"><span class="em">${emoji}</span>${title}</div>`;
    if(children.length){
      const branch = document.createElement("div");
      branch.className = "graph-branch";
      children.forEach(c=>{
        const node = document.createElement("div");
        node.className = "graph-cat-node";
        node.innerHTML = `<span class="em">${c.emoji}</span>${c.name}`;
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
}

/* ---------------- Navigation ---------------- */
function updateMonthNavVisibility(){
  // Il mese governa solo Home, Ricorrenti e Statistiche. In Altro, Conti e Pianificate va nascosto.
  const hideMonth = activeView==="accounts" || activeView==="more" || activeView==="planned";
  ["prevMonth","monthLabel","nextMonth"].forEach(id=>{
    document.getElementById(id).style.display = hideMonth ? "none" : "";
  });
  document.querySelector(".topbar").style.display = hideMonth ? "none" : "";
  // Il FAB "+" ha senso solo dove si vedono/aggiungono movimenti reali (Home, Movimenti).
  const showFab = activeView==="home" || activeView==="transactions";
  document.getElementById("fabAdd").style.display = showFab ? "" : "none";
}
function switchView(view){
  closeDatePicker();
  closePeriodMenu();
  activeView = view;
  document.querySelectorAll(".view").forEach(v=> v.classList.toggle("active", v.dataset.view===view));
  document.querySelectorAll(".tab").forEach(t=> t.classList.toggle("active", t.dataset.view===(view==="planned"?"home":view)));
  updateMonthNavVisibility();
  renderAll();
  window.scrollTo(0,0);
}
document.querySelectorAll(".tab").forEach(tab=>{
  tab.addEventListener("click", ()=> switchView(tab.dataset.view));
});
document.getElementById("seeAllTx").addEventListener("click", ()=> {periodModes.transactions=periodModes.home;switchView("transactions");});

function closePeriodMenu(){document.getElementById("periodMenu").hidden=true;document.getElementById("monthLabel").setAttribute("aria-expanded","false");}
document.getElementById("monthLabel").addEventListener("click",()=>{
  const menu=document.getElementById("periodMenu");menu.hidden=!menu.hidden;
  document.getElementById("monthLabel").setAttribute("aria-expanded",String(!menu.hidden));
});
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
document.getElementById("periodPlanned").addEventListener("click",()=>switchView("planned"));
document.getElementById("backFromPlanned").addEventListener("click",()=>switchView("home"));
function movePeriod(delta){
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
    localStorage.setItem(THEME_KEY, currentThemeMode);
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

  function close(){
    node.classList.remove("show");
    backdrop.classList.remove("show");
    setTimeout(()=>{
      backdrop.remove(); node.remove();
      overlayRoot.style.pointerEvents = overlayRoot.querySelector(".sheet") ? "auto" : "none";
      if(!overlayRoot.querySelector(".sheet")) document.documentElement.classList.remove("sheet-open");
    }, 240);
  }
  backdrop.addEventListener("click", close);
  node.querySelectorAll("[data-close]").forEach(b=> b.addEventListener("click", close));

  // Su iPhone il pannello si può trascinare verso il basso dalla maniglia o
  // dall'intestazione. I movimenti laterali non trascinano la pagina dietro.
  let touchStart=null;
  const dragZone=node.querySelector(".sheet-handle");
  const beginDrag=e=>{
    const t=e.touches[0];
    touchStart={x:t.clientX,y:t.clientY};
  };
  const moveDrag=e=>{
    if(!touchStart) return;
    const t=e.touches[0], dx=t.clientX-touchStart.x, dy=t.clientY-touchStart.y;
    if(Math.abs(dx)>Math.abs(dy)){ e.preventDefault(); return; }
    if(dy>0){
      e.preventDefault();
      node.style.transform=`translateY(${Math.min(dy, 220)}px)`;
    }
  };
  const endDrag=e=>{
    if(!touchStart) return;
    const t=e.changedTouches[0], dy=t.clientY-touchStart.y;
    touchStart=null;
    node.style.transform="";
    if(dy>90) close();
  };
  // Qualsiasi scorrimento laterale nel pannello viene bloccato per evitare il
  // trascinamento della pagina web su Safari.
  node.addEventListener("touchmove", e=>{
    if(!touchStart || Math.abs(e.touches[0].clientX-touchStart.x)>Math.abs(e.touches[0].clientY-touchStart.y)) e.preventDefault();
  }, {passive:false});
  node.addEventListener("touchstart", e=>{
    const t=e.touches[0];
    touchStart={x:t.clientX,y:t.clientY};
  }, {passive:true});
  dragZone.addEventListener("touchstart", beginDrag, {passive:true});
  dragZone.addEventListener("touchmove", moveDrag, {passive:false});
  dragZone.addEventListener("touchend", endDrag, {passive:true});

  requestAnimationFrame(()=>{
    backdrop.classList.add("show");
    node.classList.add("show");
  });

  setup(node, close);
  return { node, close };
}

/* ---------------- Add Transaction sheet ---------------- */
function openAddTransaction(){
  txType = "expense";
  selectedCategoryId = null;
  selectedAccountId = null;

  openSheet("tpl-add-transaction", (node, close)=>{
    const amountInput = node.querySelector("#amountInput");
    autoGrowAmountInput(amountInput);
    const dateInput = node.querySelector("#dateInput");
    const noteInput = node.querySelector("#noteInput");
    const catChipsGrouped = node.querySelector("#categoryChipsGrouped");
    const accChips = node.querySelector("#accountChips");
    const typeToggle = node.querySelector("#typeToggle");

    const today = new Date();
    const inViewedMonth = today.getFullYear()===viewYear && today.getMonth()===viewMonth;
    dateInput.value = periodModes.home==="day" ? selectedDate() : inViewedMonth ? todayISO() : `${viewYear}-${pad2(viewMonth+1)}-01`;

    function renderCatChips(){
      renderCategoryPicker(catChipsGrouped, txType, ()=>selectedCategoryId, id=>{ selectedCategoryId=id; });
    }
    function renderAccChips(){
      accChips.innerHTML = "";
      state.accounts.forEach(a=>{
        const chip = document.createElement("button");
        chip.className = "chip" + (selectedAccountId===a.id ? " active":"");
        chip.innerHTML = `<span class="em">●</span>${a.name}`;
        chip.querySelector(".em").style.color = a.color;
        chip.addEventListener("click", ()=>{ selectedAccountId=a.id; renderAccChips(); });
        accChips.appendChild(chip);
      });
      if(!selectedAccountId) selectedAccountId = state.accounts[0]?.id || null;
    }

    typeToggle.querySelectorAll(".type-opt").forEach(opt=>{
      opt.addEventListener("click", ()=>{
        typeToggle.querySelectorAll(".type-opt").forEach(o=>o.classList.remove("active"));
        opt.classList.add("active");
        txType = opt.dataset.type;
        selectedCategoryId = null;
        catChipsGrouped._activeMacro = null;
        renderCatChips();
      });
    });

    renderCatChips();
    renderAccChips();

    node.querySelector("#saveTxBtn").addEventListener("click", ()=>{
      const amount = parseAmount(amountInput.value);
      if(amount<=0){ amountInput.focus(); return; }
      if(!selectedCategoryId || !selectedAccountId) return;

      const t = {
        id: uid(),
        date: dateInput.value || todayISO(),
        amount, type: txType,
        categoryId: selectedCategoryId,
        accountId: selectedAccountId,
        note: noteInput.value.trim(),
      };
      state.transactions.push(t);
      persist();
      const d = new Date(t.date+"T00:00:00");
      viewYear = d.getFullYear(); viewMonth = d.getMonth();
      renderAll();
      close();
    });
  });
}
document.getElementById("fabAdd").addEventListener("click", openAddTransaction);

/* ---------------- Transaction detail sheet ---------------- */
function openTxDetail(txId){
  const t = state.transactions.find(x=>x.id===txId);
  if(!t) return;
  openSheet("tpl-tx-detail", (node, close)=>{
    const cat = categoriesById()[t.categoryId] || { name:"Categoria eliminata", emoji:"❔" };
    const acc = accountsById()[t.accountId] || { name:"Conto eliminato" };
    node.querySelector("#txDetailBody").innerHTML = `
      <div class="tx-detail-row"><span class="k">Importo</span><span class="v ${t.type}">${t.type==="income"?"+":"−"}${fmt(t.amount)}</span></div>
      <div class="tx-detail-row"><span class="k">Categoria</span><span class="v">${cat.emoji} ${cat.name}</span></div>
      <div class="tx-detail-row"><span class="k">Conto</span><span class="v">${acc.name}</span></div>
      <div class="tx-detail-row"><span class="k">Data</span><span class="v">${t.date.split("-").reverse().join("/")}</span></div>
      ${t.recurringId?`<div class="tx-detail-row"><span class="k">Origine</span><span class="v">Movimento ricorrente</span></div>`:""}
      ${t.note?`<div class="tx-detail-row"><span class="k">Nota</span><span class="v">${escapeHtml(t.note)}</span></div>`:""}
    `;
    node.querySelector("#deleteTxBtn").addEventListener("click", ()=>{
      if(!confirm("Eliminare questo movimento?")) return;
      state.transactions = state.transactions.filter(x=>x.id!==txId);
      persist(); renderAll(); close();
    });
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
      labels += `<text x="${points[i].x.toFixed(1)}" y="${h-6}" text-anchor="middle" font-size="9" fill="#4B5450" font-family="Inter">${d.label}</text>`;
    }
  });
  const dots = points.map(p=>`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.6" fill="${color}"/>`).join("");
  const zeroY = (padT + (h-padT-padB) - ((0-min)/range)*(h-padT-padB)).toFixed(1);
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <line x1="${padL}" y1="${zeroY}" x2="${w-padL}" y2="${zeroY}" stroke="var(--line)" stroke-width="1" stroke-dasharray="3 3"/>
    <polyline points="${path}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}${labels}
  </svg>`;
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
  node.querySelector("#accountEvolutionChartWrap").innerHTML = buildLineSVG(data, acc.color);
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
    balInput.value = acc ? String(acc.balance).replace(".",",") : "";

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
    deleteBtn.addEventListener("click", ()=>{
      const hasTx = state.transactions.some(t=>t.accountId===accountId);
      const msg = hasTx
        ? "Questo conto ha movimenti associati. Eliminandolo verranno eliminati anche i suoi movimenti. Continuare?"
        : "Eliminare questo conto?";
      if(!confirm(msg)) return;
      state.accounts = state.accounts.filter(a=>a.id!==accountId);
      state.transactions = state.transactions.filter(t=>t.accountId!==accountId);
      persist(); renderAll(); close();
    });

    node.querySelector("#saveAccountBtn").addEventListener("click", ()=>{
      const name = nameInput.value.trim();
      if(!name) { nameInput.focus(); return; }
      const balance = parseAmount(balInput.value) * (balInput.value.trim().startsWith("-") ? -1 : 1);
      if(editing){
        acc.name = name; acc.balance = balance; acc.color = chosenColor;
      } else {
        state.accounts.push({ id: uid(), name, balance, color: chosenColor });
      }
      persist(); renderAll(); close();
    });
  });
}
/* ---------------- Pannelli di gestione (Altro) ---------------- */
function openAccountsPanel(){
  openSheet("tpl-accounts-panel", (node)=>{
    renderAccountsManageList();
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
document.getElementById("openMacroPanelBtn").addEventListener("click", openMacroPanel);

function openCategoriesPanel(){
  openSheet("tpl-categories-panel", (node)=>{
    renderCategories();
    node.querySelector("#addCategoryBtn").addEventListener("click", ()=> openCategoryForm(null));
  });
}
document.getElementById("openCategoriesPanelBtn").addEventListener("click", openCategoriesPanel);

function openGraphPanel(){
  openSheet("tpl-graph-panel", (node)=>{
    renderCategoryGraph();
  });
}
document.getElementById("openGraphPanelBtn").addEventListener("click", openGraphPanel);

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
      state.macroCategories.forEach(m=>{
        const chip = document.createElement("button");
        chip.className = "chip" + (chosenMacroId===m.id ? " active":"");
        chip.innerHTML = `<span class="em">${m.emoji}</span>${m.name}`;
        chip.addEventListener("click", ()=>{ chosenMacroId=m.id; renderMacroChips(); });
        macroChips.appendChild(chip);
      });
    }
    renderMacroChips();

    kindToggle.querySelectorAll(".type-opt").forEach(opt=>{
      opt.classList.toggle("active", opt.dataset.kind===chosenKind);
      opt.addEventListener("click", ()=>{
        chosenKind = opt.dataset.kind;
        kindToggle.querySelectorAll(".type-opt").forEach(o=>o.classList.remove("active"));
        opt.classList.add("active");
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
    deleteBtn.addEventListener("click", ()=>{
      if(!confirm("Eliminare questa categoria? I movimenti collegati resteranno ma senza categoria.")) return;
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

    let chosenEmoji = macro?.emoji || EMOJIS[0];
    let chosenColor = macro?.color || PALETTE[0];

    nameInput.value = macro?.name || "";
    budgetInput.value = macro?.budget ? String(macro.budget).replace(".",",") : "";

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
    deleteBtn.addEventListener("click", ()=>{
      const hasCats = state.categories.some(c=>c.macroCategoryId===macroId);
      const msg = hasCats
        ? "Le categorie associate resteranno, ma senza macrocategoria. Continuare?"
        : "Eliminare questa macrocategoria?";
      if(!confirm(msg)) return;
      state.macroCategories = state.macroCategories.filter(m=>m.id!==macroId);
      state.categories.forEach(c=>{ if(c.macroCategoryId===macroId) c.macroCategoryId=null; });
      persist(); renderAll(); close();
    });

    node.querySelector("#saveMacroBtn").addEventListener("click", ()=>{
      const name = nameInput.value.trim();
      if(!name){ nameInput.focus(); return; }
      const budget = budgetInput.value.trim() ? parseAmount(budgetInput.value) : null;
      if(editing){
        macro.name=name; macro.emoji=chosenEmoji; macro.color=chosenColor; macro.budget=budget;
      } else {
        state.macroCategories.push({ id: uid(), name, emoji: chosenEmoji, color: chosenColor, budget });
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
    const freqToggle = node.querySelector("#recurringFreqToggle");
    const catChips = node.querySelector("#recurringCategoryChips");
    const accChips = node.querySelector("#recurringAccountChips");
    const deleteBtn = node.querySelector("#deleteRecurringBtn");

    nameInput.value = rec?.name || "";
    amountInput.value = rec ? String(rec.amount).replace(".",",") : "";
    noteInput.value = rec?.note || "";
    dateInput.value = rec?.startDate || todayISO();

    function renderCatChips(){
      renderCategoryPicker(catChips, rType, ()=>rCat, id=>{ rCat=id; });
    }
    function renderAccChips(){
      accChips.innerHTML = "";
      state.accounts.forEach(a=>{
        const chip = document.createElement("button");
        chip.className = "chip" + (rAcc===a.id?" active":"");
        chip.innerHTML = `<span class="em">●</span>${a.name}`;
        chip.querySelector(".em").style.color = a.color;
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
    freqToggle.querySelectorAll(".type-opt").forEach(opt=>{
      opt.classList.toggle("active", opt.dataset.freq===rFreq);
      opt.addEventListener("click", ()=>{
        freqToggle.querySelectorAll(".type-opt").forEach(o=>o.classList.remove("active"));
        opt.classList.add("active");
        rFreq = opt.dataset.freq;
      });
    });

    renderCatChips();
    renderAccChips();

    if(editing) deleteBtn.hidden = false;
    deleteBtn.addEventListener("click", ()=>{
      if(!confirm("Eliminare questo movimento ricorrente? I movimenti già generati resteranno.")) return;
      state.recurring = state.recurring.filter(r=>r.id!==recurringId);
      persist(); renderAll(); close();
    });

    node.querySelector("#saveRecurringBtn").addEventListener("click", ()=>{
      const name = nameInput.value.trim();
      const amount = parseAmount(amountInput.value);
      const startDate = dateInput.value || todayISO();
      if(!name || amount<=0 || !rCat || !rAcc) return;
      if(editing){
        rec.name=name; rec.amount=amount; rec.type=rType; rec.categoryId=rCat; rec.accountId=rAcc;
        rec.freq=rFreq; rec.startDate=startDate; rec.note=noteInput.value.trim();
      } else {
        state.recurring.push({
          id: uid(), name, amount, type: rType, categoryId: rCat, accountId: rAcc,
          freq: rFreq, startDate, note: noteInput.value.trim(), nextDate: startDate,
        });
      }
      generateRecurringTransactions();
      persist(); renderAll(); close();
    });
  });
}
document.getElementById("addRecurringBtn").addEventListener("click", ()=> openRecurringForm(null));

/* ---------------- Spese pianificate: form una tantum ---------------- */
let plannedTxType = "expense", plannedSelectedCategoryId = null, plannedSelectedAccountId = null;
function openPlannedForm(plannedId){
  const editing = !!plannedId;
  const p = editing ? state.planned.find(x=>x.id===plannedId) : null;
  plannedTxType = p?.type || "expense";
  plannedSelectedCategoryId = p?.categoryId || null;
  plannedSelectedAccountId = p?.accountId || null;

  openSheet("tpl-planned-form", (node, close)=>{
    node.querySelector("#plannedFormTitle").textContent = editing ? "Modifica spesa pianificata" : "Nuova spesa una tantum";
    const amountInput = node.querySelector("#plannedAmountInput");
    const dateInput = node.querySelector("#plannedDateInput");
    const noteInput = node.querySelector("#plannedNoteInput");
    const catChipsGrouped = node.querySelector("#plannedCategoryChipsGrouped");
    const accChips = node.querySelector("#plannedAccountChips");
    const typeToggle = node.querySelector("#plannedTypeToggle");
    const deleteBtn = node.querySelector("#deletePlannedBtn");

    amountInput.value = p ? String(p.amount).replace(".",",") : "";
    autoGrowAmountInput(amountInput);
    noteInput.value = p?.note || "";
    if(p?.date){
      dateInput.value = p.date;
    } else {
      const d = new Date(); d.setMonth(d.getMonth()+1);
      dateInput.value = `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
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
        chip.innerHTML = `<span class="em">●</span>${a.name}`;
        chip.querySelector(".em").style.color = a.color;
        chip.addEventListener("click", ()=>{ plannedSelectedAccountId=a.id; renderAccChips(); });
        accChips.appendChild(chip);
      });
      if(!plannedSelectedAccountId) plannedSelectedAccountId = state.accounts[0]?.id || null;
    }
    renderCatChips();
    renderAccChips();

    if(editing) deleteBtn.hidden = false;
    deleteBtn.addEventListener("click", ()=>{
      if(!confirm("Eliminare questa spesa pianificata?")) return;
      state.planned = state.planned.filter(x=>x.id!==plannedId);
      persist(); renderAll(); close();
    });

    node.querySelector("#savePlannedBtn").addEventListener("click", ()=>{
      const amount = parseAmount(amountInput.value);
      if(amount<=0){ amountInput.focus(); return; }
      if(!plannedSelectedCategoryId || !plannedSelectedAccountId) return;
      const date = dateInput.value || todayISO();
      if(editing){
        p.amount=amount; p.type=plannedTxType; p.categoryId=plannedSelectedCategoryId;
        p.accountId=plannedSelectedAccountId; p.date=date; p.note=noteInput.value.trim();
      } else {
        state.planned.push({
          id: uid(), amount, type: plannedTxType, categoryId: plannedSelectedCategoryId,
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
    info[iso] = { income:false, expense:false, planned:false };
  }
  state.transactions.forEach(t=>{
    if(info[t.date]){
      if(t.type==="income") info[t.date].income = true;
      else info[t.date].expense = true;
    }
  });
  state.planned.forEach(p=>{
    if(info[p.date]) info[p.date].planned = true;
  });
  state.recurring.forEach(r=>{
    recurringOccurrencesInMonth(r,y,m).forEach(date=>{
      if(info[date]) info[date].planned = true;
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
    cell.className = "calendar-cell" + (iso===todayStr ? " today" : "");
    const dayInfo = info[iso];
    let dots = "";
    if(dayInfo.income) dots += `<span class="cal-dot income"></span>`;
    if(dayInfo.expense) dots += `<span class="cal-dot expense"></span>`;
    if(dayInfo.planned) dots += `<span class="cal-dot planned"></span>`;
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
document.getElementById("exportBtn").addEventListener("click", ()=>{
  const blob = new Blob([JSON.stringify(state,null,2)], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const d = new Date();
  a.href = url;
  a.download = `bilancio-backup-${d.getFullYear()}${pad2(d.getMonth()+1)}${pad2(d.getDate())}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
});

document.getElementById("importBtn").addEventListener("click", ()=> document.getElementById("importFile").click());
document.getElementById("importFile").addEventListener("change", (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const parsed = JSON.parse(reader.result);
      if(!parsed.accounts || !parsed.categories || !parsed.transactions) throw new Error("formato non valido");
      if(!confirm("Importare questo backup sovrascriverà tutti i dati attuali. Continuare?")) return;
      state = migrate(parsed);
      persist(); renderAll();
      alert("Backup importato correttamente.");
    }catch(err){
      alert("File non valido. Assicurati di selezionare un backup esportato da Bilancio.");
    }
    e.target.value = "";
  };
  reader.readAsText(file);
});

document.getElementById("resetBtn").addEventListener("click", ()=>{
  if(!confirm("Questa azione elimina definitivamente tutti i conti, categorie, movimenti e ricorrenti. Continuare?")) return;
  if(!confirm("Sei davvero sicuro? L'operazione non è reversibile.")) return;
  state = seedState();
  persist(); renderAll();
});

/* ---------------- Service worker ---------------- */
if("serviceWorker" in navigator){
  window.addEventListener("load", ()=>{
    navigator.serviceWorker.register("sw.js", {updateViaCache:"none"}).then(registration=>registration.update()).catch(()=>{});
  });
}

/* ---------------- Init ---------------- */
generateRecurringTransactions();
generatePlannedTransactions();
renderAll();
