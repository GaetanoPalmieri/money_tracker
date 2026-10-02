'use strict';
const GKEY = 'rc_gym_v2',
  main = document.getElementById('main'),
  catalogId = (name) =>
    'ex-' +
    [...name.toLowerCase()]
      .reduce((n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) | 0, 0)
      .toString(36)
      .replace('-', 'n');
const defaultProgram = () =>
  DAYS.map((d) => ({
    ...d,
    exercises: d.exercises.map((e) => ({
      ...e,
      id: catalogId(e.name),
      unit: e.move === 'cardio' ? 'min' : 'reps',
    })),
  }));
const MEAL_SCHEDULE = [
  '08:00 · Colazione',
  '11:30 · Spuntino',
  '13:00 · Pranzo',
  '16:30 · Spuntino',
  '21:00 · Cena',
  '23:00 · Pre nanna',
];
const TAB_ORDER = ['workout', 'food', 'stats', 'more'];
const MAX_WEEKS = BLOCK_WEEKS,
  LEGACY_MAX_WEEKS = 16,
  WEEK_WINDOW = 4;
const EXERCISE_ALTERNATIVES = {
  'Panca piana con bilanciere': ['Distensioni su panca piana con manubri', 'Chest press machine'],
  'Panca inclinata con manubri (30°)': [
    'Chest press inclinata alla macchina',
    'Panca inclinata con bilanciere',
  ],
  'Lento avanti con manubri, seduto': ['Shoulder press alla macchina', 'Military press con manubri in piedi'],
  'Alzate laterali con manubri': [
    'Alzate laterali ai cavi, un braccio alla volta',
    'Alzate laterali alla macchina',
  ],
  'Croci ai cavi (cable fly)': ['Pec deck / butterfly machine', 'Croci con manubri su panca piana'],
  'Push down tricipiti ai cavi': ['Push down con corda', 'Estensioni tricipiti con elastico'],
  'French press con manubrio': [
    'Estensioni tricipiti sopra la testa al cavo con corda',
    'French press con bilanciere EZ',
  ],
  'Stacco rumeno con bilanciere': ['Stacco rumeno con manubri', 'Pull-through al cavo'],
  'Lat machine presa larga': ['Lat machine presa neutra', 'Trazioni assistite alla macchina'],
  'Rematore con manubrio monolaterale': [
    'Rematore chest-supported con manubri',
    'Rematore alla macchina convergente',
  ],
  'Pulley basso (seated row)': [
    'Rematore alla macchina con appoggio al petto',
    'Rematore al cavo con presa neutra',
  ],
  'Face pull ai cavi': ['Reverse pec deck', 'Alzate posteriori ai cavi'],
  'Curl bicipiti con bilanciere': ['Curl con bilanciere EZ', 'Curl ai cavi con barra'],
  'Curl a martello con manubri': ['Curl a martello con corda al cavo', 'Curl alternato con presa neutra'],
  'Affondi bulgari con manubri': ['Affondi indietro con manubri', 'Step-up su box con manubri'],
  'Leg extension': ['Leg extension unilaterale', 'Sissy squat assistito a corpo libero'],
  'Leg curl sdraiato/seduto': ['Leg curl nella variante opposta: seduto o sdraiato', 'Leg curl con fitball'],
  'Hip thrust con bilanciere': ['Glute bridge con bilanciere', 'Hip thrust alla macchina'],
  'Calf raise in piedi': ['Calf raise seduto', 'Calf raise alla leg press'],
  'Military press con bilanciere in piedi': [
    'Shoulder press alla macchina',
    'Lento avanti con manubri seduto',
  ],
  'Trazioni alla sbarra (o lat machine presa neutra)': ['Trazioni assistite', 'Lat machine presa neutra'],
  'Arnold press con manubri': ['Shoulder press con manubri', 'Shoulder press alla macchina'],
  'Alzate laterali ai cavi (unilaterale)': ['Alzate laterali con manubri', 'Alzate laterali alla macchina'],
  'Alzate posteriori (rear delt fly) su panca inclinata': ['Reverse pec deck', 'Alzate posteriori ai cavi'],
  'Dip alle parallele (busto verticale)': ['Dip assistite alla macchina', 'Panca presa stretta'],
  'Curl bicipiti ai cavi con bilanciere EZ': ['Curl con bilanciere EZ', 'Preacher curl alla macchina'],
  'Curl 21 (bicipiti, manubri leggeri)': ['Curl alternato con manubri', 'Curl ai cavi con barra'],
  'Crunch ai cavi in ginocchio': ['Crunch alla macchina', 'Crunch a terra controllato'],
  'Pallof press ai cavi': ['Pallof press con elastico', 'Plank con shoulder tap'],
  'Knee raise alla captain chair': ['Reverse crunch', 'Leg raise da sdraiato'],
  'Dead bug controllato': ['Bird dog controllato', 'Hollow hold breve'],
  'Ab wheel rollout': ['Body saw plank', 'Stability ball rollout'],
  'Side plank': ['Side plank con ginocchia appoggiate', 'Suitcase hold statico'],
  'Crunch a terra (o ai cavi)': ['Crunch alla macchina', 'Dead bug controllato'],
  'Sollevamento gambe da sdraiato (leg raise)': ['Knee raise alla captain chair', 'Reverse crunch'],
  'Tapis roulant — camminata in pendenza': ['Cyclette a ritmo moderato', 'Ellittica a ritmo moderato'],
  'Esercizi di Kegel (pavimento pelvico)': [
    'Kegel da sdraiato',
    'Kegel in piedi con contrazioni controllate',
  ],
};
function exerciseAlternatives(e) {
  return EXERCISE_ALTERNATIVES[e?.name] || [];
}
function showExerciseAlternatives(e) {
  const alts = exerciseAlternatives(e);
  if (!alts.length) {
    U.toast('Nessuna variante disponibile per questo esercizio.');
    return;
  }
  U.modal(
    U.head('Versioni alternative') +
      `<p class="muted">Alternative per <b>${U.esc(e.name)}</b>. Mantieni serie e ripetizioni della scheda, adattando il carico alla variante scelta.</p><div class="alternative-exercise-list">${alts.map((x) => `<div class="alternative-exercise-row">↔ <span>${U.esc(x)}</span></div>`).join('')}</div>`,
  );
}
function exerciseExpandKey(e, i) {
  return `${gym.cycle || 1}:${gym.week}:${context()}:${e.id}:${i}`;
}
function compactExerciseSummary(e) {
  const entered = e.rows
    .map((r, j) => ({ r, j }))
    .filter(({ r }) => r.done || r.weight != null || r.reps != null || r.speed != null || r.incline != null);
  if (!entered.length) return '<span class="compact-empty">Nessuna serie registrata</span>';
  return entered
    .map(
      ({ r, j }) =>
        `<span class="compact-set ${r.done ? 'is-done' : ''}"><b>${j + 1}</b> ${U.esc(rowText(e, r))}${r.done ? ' ✓' : ''}</span>`,
    )
    .join('');
}
const defaultGym = () => ({
  version: 2,
  cycle: 1,
  week: 1,
  dayIdx: 0,
  tab: 'workout',
  foodTab: 'd1',
  program: defaultProgram(),
  sessions: [],
  rest: null,
  foods: U.clone(FOOD_CATALOG),
  meals: Object.fromEntries(
    Object.entries(MEALS).map(([k, d]) => [
      k,
      {
        label: d.label,
        items: d.items.map((m, i) => ({
          time: m.t,
          original: m.txt,
          ingredients: Object.entries(FOOD_PORTIONS[k][i]).map(([food, qty]) => ({ food, qty })),
        })),
      },
    ]),
  ),
  settings: {
    lastExport: null,
    scheduleV137: true,
    weightUnit: 'kg',
    absRoutineV156: true,
    fullBodyV112: true,
    loadV1121: true,
    massV1122: true,
    leanBulkV1123: true,
    profile: { age: 30, heightCm: 186, startKg: 86, sex: 'M' },
    block: 1,
    blockStart: mondayISO(new Date()),
    blockDone: false,
    weightSkips: {},
    lastHeartbeat: null,
    lastBackgroundAt: null,
  },
  notes: {},
  bodyWeights: [],
  checks: [],
  mealLogs: {},
});
function sessionDayIndex(s, program = gym.program) {
  return Math.max(
    0,
    program.findIndex((d) => s?.context?.endsWith('_' + d.key) || s?.day === d.short),
  );
}
function advanceWorkoutPosition(state, week = state.week, dayIdx = state.dayIdx) {
  state.dayIdx = dayIdx + 1;
  if (state.dayIdx >= state.program.length) {
    state.dayIdx = 0;
    if (week < MAX_WEEKS) state.week = week + 1;
    else {
      // Fine del blocco di 8 settimane: il successivo si genera solo dopo il check fisico.
      state.week = MAX_WEEKS;
      state.settings ??= {};
      state.settings.blockDone = true;
    }
  } else state.week = week;
}

/* ---------- 1.12.0: date del blocco, migrazione alla scheda full body ---------- */
function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function mondayISO(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return ymd(x);
}
function nextMondayISO(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const add = (8 - x.getDay()) % 7 || 7;
  if (x.getDay() !== 1) x.setDate(x.getDate() + add);
  return ymd(x);
}
function localDay(iso) {
  return ymd(new Date(iso));
}
function weekDates(week = gym.week) {
  const start = new Date((gym.settings.blockStart || mondayISO(new Date())) + 'T00:00:00');
  start.setDate(start.getDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const f = (d, m) => d.toLocaleDateString('it-IT', m ? { day: 'numeric', month: 'short' } : { day: 'numeric' });
  return start.getMonth() === end.getMonth() ? `${f(start)}–${f(end, true)}` : `${f(start, true)} – ${f(end, true)}`;
}
const OLD_D4_PORTIONS = '[{"food":"beef","qty":200},{"food":"couscous","qty":90},{"food":"veg","qty":200},{"food":"oil","qty":10}]';
function migrateFullBodyV112(state) {
  state.settings ??= {};
  if (state.settings.fullBodyV112) return;
  const now = Date.now();
  // Chiude le sessioni lasciate aperte della vecchia scheda conservando serie, pesi e durata.
  (state.sessions || []).forEach((x) => {
    if (x.legacy || x.ended) return;
    if (x.runningSince) x.elapsed = (x.elapsed || 0) + Math.max(0, now - x.runningSince);
    x.runningSince = null;
    const end = x.started ? new Date(x.started).getTime() + (x.elapsed || 0) : now;
    x.ended = new Date(Math.min(end, now)).toISOString();
    if ((x.exercises || []).some((e) => !e.stopped && e.rows?.some((r) => !r.done))) x.archivedIncomplete = true;
  });
  state.rest = null;
  // Nuova scheda: stessi nomi = stesso id, quindi pesi, note personali e storico restano collegati.
  const oldNotes = new Map();
  (state.program || []).forEach((d) => d.exercises?.forEach((e) => e.note && oldNotes.set(e.id, e.note)));
  state.program = defaultProgram().map((d) => ({
    ...d,
    exercises: d.exercises.map((e) => ({ ...e, note: oldNotes.get(e.id) || e.note })),
  }));
  state.cycle = (Number(state.cycle) || 1) + 1;
  state.week = 1;
  state.dayIdx = 0;
  state.settings.block = 1;
  state.settings.blockStart = nextMondayISO(new Date());
  state.settings.blockDone = false;
  // Nutrizione: nuove etichette dei giorni; il giorno 4 (richiamo) ha meno carboidrati se non modificato.
  const labels = {
    d1: 'Giorno 1 · Full body A — Allenamento',
    d2: 'Giorno 2 · Full body B — Allenamento',
    d3: 'Giorno 3 · Full body C — Allenamento',
    d4: 'Giorno 4 · Richiamo/aerobico (opzionale)',
  };
  Object.entries(labels).forEach(([k, l]) => state.meals?.[k] && (state.meals[k].label = l));
  const d4 = state.meals?.d4?.items;
  if (d4 && JSON.stringify(d4[2]?.ingredients) === OLD_D4_PORTIONS) {
    const set = (i, food, qty) => {
      const ing = d4[i]?.ingredients?.find((x) => x.food === food);
      if (ing) ing.qty = qty;
    };
    set(2, 'couscous', 60);
    set(3, 'cakes', 20);
    set(3, 'honey', 10);
    set(4, 'potato', 250);
    if (d4[2]) d4[2].original = String(d4[2].original || '').replace('90g couscous', '60g couscous');
    if (d4[3]) d4[3].original = '20g gallette di riso con 10g miele + 1 mela';
    if (d4[4]) d4[4].original = String(d4[4].original || '').replace('300g patate', '250g patate');
  }
  state.settings.fullBodyV112 = true;
}
// 1.12.1 — recuperi, serie e range di ripetizioni rivisti per un livello intermedio.
function migrateLoadV1121(state) {
  if (state.settings.loadV1121) return;
  const defs = new Map(defaultProgram().map((d) => [d.key, new Map(d.exercises.map((e) => [e.id, e]))]));
  (state.program || []).forEach((d) =>
    d.exercises?.forEach((e) => {
      const def = defs.get(d.key)?.get(e.id);
      if (!def) return;
      e.sets = def.sets;
      e.reps = def.reps;
      e.rest = def.rest;
      e.compound = !!def.compound;
      delete e.baseReps;
      delete e.baseRest;
    }),
  );
  state.settings.loadV1121 = true;
}
const LEAN_BULK_MEAL_CHANGES = [["d1", 2, "rice", 90, 110, "90g riso basmati", "110g riso basmati"], ["d1", 3, "cakes", 40, 50, "40g gallette di riso", "50g gallette di riso"], ["d2", 2, "pasta", 90, 120, "90g pasta integrale", "120g pasta integrale"], ["d2", 3, "cakes", 30, 40, "30g gallette di riso", "40g gallette di riso"], ["d2", 3, "honey", 15, 20, "15g miele", "20g miele"], ["d2", 4, "potato", 250, 300, "250g patate", "300g patate"], ["d4", 3, "cakes", 20, 40, "20g gallette di riso", "40g gallette di riso"], ["d4", 3, "honey", 10, 20, "10g miele", "20g miele"], ["r1", 0, "oats", 60, 80, "60g fiocchi d'avena", "80g fiocchi d'avena"], ["r1", 2, "rice", 70, 90, "70g riso basmati", "90g riso basmati"], ["r1", 3, "walnuts", 15, 20, "15g noci", "20g noci"], ["r1", 4, "potato", 200, 250, "200g patate", "250g patate"], ["r2", 2, "rice", 60, 80, "60g riso basmati", "80g riso basmati"], ["r2", 4, "potato", 200, 250, "200g patate", "250g patate"], ["r3", 2, "quinoa", 70, 80, "70g quinoa", "80g quinoa"], ["r3", 4, "potato", 200, 250, "200g patate", "250g patate"]];
const LEGACY_AB_NAMES = new Set(['Crunch a terra (o ai cavi)', 'Sollevamento gambe da sdraiato (leg raise)']);
function migrateAbsRoutineV156(state) {
  state.settings ??= {};
  if (state.settings.absRoutineV156) return;
  for (const day of state.program || []) {
    const newNames = new Set(
      Object.values(ABS_ROUTINE)
        .flat()
        .map((e) => e.name),
    );
    day.exercises = (day.exercises || []).filter(
      (e) => !LEGACY_AB_NAMES.has(e.name) && !newNames.has(e.name),
    );
    const fresh = (ABS_ROUTINE[day.key] || []).map((e) => ({ ...e, id: catalogId(e.name), unit: 'reps' }));
    const insertAt = day.exercises.findIndex((e) => e.move === 'cardio' || /tapis roulant/i.test(e.name));
    day.exercises.splice(insertAt < 0 ? day.exercises.length : insertAt, 0, ...fresh);
  }
  state.settings.absRoutineV156 = true;
}
let coldLaunch = true;
try {
  coldLaunch = sessionStorage.getItem('recompapp-live-instance') !== '1';
  sessionStorage.setItem('recompapp-live-instance', '1');
} catch (e) {}
function pauseRunningOnColdLaunch(state) {
  if (!coldLaunch) return;
  const cutoff = Math.max(
    Number(state.settings?.lastHeartbeat) || 0,
    Number(state.settings?.lastBackgroundAt) || 0,
  );
  for (const s of state.sessions || []) {
    if (!s.legacy && !s.ended && s.runningSince) {
      const stopAt = cutoff && cutoff >= s.runningSince ? cutoff : Date.now();
      s.elapsed = (s.elapsed || 0) + Math.max(0, stopAt - s.runningSince);
      s.runningSince = null;
      if (state.rest?.sessionId === s.id) {
        state.rest.remaining = Math.max(0, (state.rest.end || stopAt) - stopAt);
        state.rest.end = stopAt + state.rest.remaining;
      }
    }
  }
}
function saveLifecycleStamp(kind = 'heartbeat') {
  const s = active?.();
  if (!s?.runningSince) return;
  const now = Date.now();
  gym.settings ??= {};
  gym.settings.lastHeartbeat = now;
  if (kind === 'hidden') gym.settings.lastBackgroundAt = now;
  try {
    localStorage.setItem(GKEY, JSON.stringify(gym));
  } catch (e) {}
}
function normalizeStateOnOpen(state) {
  state.settings ??= {};
  state.settings.weightUnit = ['kg', 'lb'].includes(state.settings.weightUnit)
    ? state.settings.weightUnit
    : 'kg';
  delete state.settings.reminderEnabled;
  delete state.settings.reminderTime;
  delete state.settings.lastReminderDate;
  state.bodyWeights = Array.isArray(state.bodyWeights) ? state.bodyWeights : [];
  state.mealLogs = state.mealLogs && typeof state.mealLogs === 'object' ? state.mealLogs : {};
  if (!state.settings.scheduleV137) {
    Object.values(state.meals || {}).forEach((day) =>
      day.items?.forEach((m, i) => {
        if (MEAL_SCHEDULE[i]) m.time = MEAL_SCHEDULE[i];
      }),
    );
    state.settings.scheduleV137 = true;
  }
  migrateAbsRoutineV156(state);
  migrateFullBodyV112(state);
  migrateLoadV1121(state);
  if (!state.settings.leanBulkV1123) {
    // 1.12.3 — profilo (30 anni, 186 cm, 86 kg) e calorie per la massa pulita:
    // media settimanale ~2.750 kcal (fabbisogno stimato ~2.650-2.700), proteine invariate (~2,1-2,4 g/kg).
    state.settings.profile = { age: 30, heightCm: 186, startKg: 86, sex: 'M', ...(state.settings.profile || {}) };
    const changes = LEAN_BULK_MEAL_CHANGES;
    changes.forEach(([day, idx, food, from, to, textFrom, textTo]) => {
      const item = state.meals?.[day]?.items?.[idx];
      const ing = item?.ingredients?.find((x) => x.food === food);
      if (!ing || ing.qty !== from) return; // pasto modificato a mano: non lo tocco
      ing.qty = to;
      if (typeof item.original === 'string') item.original = item.original.replace(textFrom, textTo);
    });
    state.settings.leanBulkV1123 = true;
  }
  if (!state.settings.massV1122) {
    // 1.12.2 — massa pulita: il richiamo aerobico scende a 25-30 minuti.
    (state.program || []).forEach((d) =>
      d.exercises?.forEach((e) => {
        if (d.optional && isCardio(e) && /35-40/.test(e.reps)) e.reps = '25-30 min';
      }),
    );
    state.settings.massV1122 = true;
  }
  state.checks = Array.isArray(state.checks) ? state.checks : [];
  state.settings.weightSkips =
    state.settings.weightSkips && typeof state.settings.weightSkips === 'object' ? state.settings.weightSkips : {};
  state.settings.block = Number(state.settings.block) || 1;
  state.settings.blockStart = U.validDate(state.settings.blockStart) ? state.settings.blockStart : mondayISO(new Date());
  if (state.week > MAX_WEEKS) state.week = MAX_WEEKS;
  const open = (state.sessions || [])
    .filter((x) => !x.legacy && !x.ended)
    .sort((a, b) => new Date(b.started || 0) - new Date(a.started || 0))[0];
  if (open) {
    state.cycle = Number(open.cycle) || state.cycle || 1;
    state.week = Math.min(MAX_WEEKS, Math.max(1, Number(open.week) || state.week || 1));
    state.dayIdx = sessionDayIndex(open, state.program);
    return;
  }
  const cycle = state.cycle || 1,
    last = (state.sessions || [])
      .filter((x) => !x.legacy && x.ended && (x.cycle || 1) === cycle)
      .sort((a, b) => new Date(b.ended || 0) - new Date(a.ended || 0))[0];
  if (last)
    advanceWorkoutPosition(
      state,
      Math.min(MAX_WEEKS, Math.max(1, Number(last.week) || state.week || 1)),
      sessionDayIndex(last, state.program),
    );
}

const APP_VERSION = '1.12.3';
let gym = defaultGym(),
  storageError = '',
  wakeWarned = false,
  month = U.local().slice(0, 7),
  selectedDay = '',
  selectedExercise = '',
  metric = 'weight',
  chartPoints = [],
  wakeLock = null,
  statsView = 'exercises',
  expandedExerciseKeys = new Set();
function isNum(n) {
  return U.finite(n) && n >= 0;
}
function validGym(d) {
  try {
    return (
      d.version === 2 &&
      Number.isInteger(d.cycle) &&
      d.cycle > 0 &&
      Number.isInteger(d.week) &&
      d.week >= 1 &&
      d.week <= LEGACY_MAX_WEEKS &&
      Number.isInteger(d.dayIdx) &&
      Array.isArray(d.program) &&
      d.program.length > 0 &&
      d.dayIdx >= 0 &&
      d.dayIdx < d.program.length &&
      d.program.every(
        (p) =>
          typeof p.key === 'string' &&
          typeof p.short === 'string' &&
          Array.isArray(p.exercises) &&
          p.exercises.every(
            (e) =>
              typeof e.id === 'string' &&
              typeof e.name === 'string' &&
              Number.isInteger(e.sets) &&
              e.sets > 0 &&
              e.sets <= 30 &&
              isNum(e.rest) &&
              typeof e.reps === 'string',
          ),
      ) &&
      Array.isArray(d.sessions) &&
      new Set(d.sessions.map((s) => s.id)).size === d.sessions.length &&
      d.sessions.every(
        (s) =>
          typeof s.id === 'string' &&
          (s.started == null || U.validDate(s.started)) &&
          (s.ended == null || U.validDate(s.ended)) &&
          isNum(s.elapsed) &&
          (s.runningSince == null || isNum(s.runningSince)) &&
          Array.isArray(s.exercises) &&
          s.exercises.every(
            (e) =>
              typeof e.id === 'string' &&
              typeof e.name === 'string' &&
              Array.isArray(e.rows) &&
              e.rows.every(
                (r) =>
                  typeof r.done === 'boolean' &&
                  (r.weight == null || isNum(r.weight)) &&
                  (r.reps == null || isNum(r.reps)) &&
                  (r.speed == null || isNum(r.speed)) &&
                  (r.incline == null || isNum(r.incline)),
              ),
          ),
      ) &&
      d.foods &&
      Object.values(d.foods).every(
        (f) =>
          typeof f.name === 'string' &&
          ['g', 'ml'].includes(f.unit) &&
          Array.isArray(f.v) &&
          f.v.length === 4 &&
          f.v.every(isNum),
      ) &&
      d.meals &&
      Object.values(d.meals).every(
        (day) =>
          typeof day.label === 'string' &&
          Array.isArray(day.items) &&
          day.items.every(
            (m) =>
              typeof m.time === 'string' &&
              Array.isArray(m.ingredients) &&
              m.ingredients.every((i) => Object.hasOwn(d.foods, i.food) && isNum(i.qty)),
          ),
      ) &&
      (!d.rest || (isNum(d.rest.end) && typeof d.rest.name === 'string')) &&
      (!d.exerciseValues ||
        (typeof d.exerciseValues === 'object' &&
          Object.values(d.exerciseValues).every(
            (rows) =>
              Array.isArray(rows) &&
              rows.every(
                (r) =>
                  r == null ||
                  (typeof r === 'object' && Object.values(r).every((v) => v == null || isNum(v))),
              ),
          ))) &&
      d.settings &&
      d.notes &&
      typeof d.notes === 'object' &&
      (!d.bodyWeights ||
        (Array.isArray(d.bodyWeights) &&
          d.bodyWeights.every((x) => x && typeof x.id === 'string' && U.validDate(x.date) && isNum(x.kg)))) &&
      (!d.mealLogs || typeof d.mealLogs === 'object')
    );
  } catch (e) {
    return false;
  }
}
function readLegacy(key, fallback) {
  const v = localStorage.getItem(key);
  return v ? JSON.parse(v) : fallback;
}
function migrate() {
  const n = defaultGym(),
    old = readLegacy('rc_state', {});
  n.week = Math.min(MAX_WEEKS, Math.max(1, Number(old.week) || 1));
  n.dayIdx = Math.min(n.program.length - 1, Math.max(0, Number(old.dayIdx) || 0));
  n.foodTab = Object.hasOwn(n.meals, old.foodTab) ? old.foodTab : 'd1';
  const sessions = readLegacy('rc_sessions_v1', []);
  if (!Array.isArray(sessions)) throw Error();
  n.sessions = sessions.map((s) => ({
    ...s,
    cycle: 1,
    elapsed: s.elapsed || 0,
    context: s.context,
    day: s.day || 'Allenamento',
    runningSince: s.runningSince || null,
    exercises: s.exercises.map((e) => ({
      ...e,
      id: catalogId(e.name),
      unit: /tapis roulant/i.test(e.name) ? 'min' : 'reps',
      target: e.reps || '',
      rest: 0,
      stopped: !!e.skipped,
      rows: Array.from({ length: e.total || 1 }, (_, i) => ({
        weight: e.weight ?? null,
        reps: null,
        done: i < (e.done || 0),
        legacy: true,
      })),
    })),
  }));
  if (!sessions.length) {
    for (let w = 1; w <= 8; w++)
      for (const d of n.program) {
        const checked = readLegacy(`rc_checked_w${w}_${d.key}`, {}),
          skipped = readLegacy(`rc_skipped_${w}_${d.key}`, {});
        const ex = d.exercises.map((e, i) => {
          const raw = localStorage.getItem(`rc_weight_w${w}_${d.key}_e${i}`),
            weight = raw !== null && raw !== '' && isNum(Number(raw)) ? Number(raw) : null;
          return {
            ...e,
            target: e.reps,
            stopped: !!skipped[i],
            rows: Array.from({ length: effectiveSets(e, w) }, (_, j) => ({
              weight,
              reps: null,
              done: !!checked[`e${i}_s${j}`],
              legacy: true,
            })),
          };
        });
        if (ex.some((e) => e.stopped || e.rows.some((r) => r.done || r.weight != null)))
          n.sessions.push({
            id: `legacy-${w}-${d.key}`,
            legacy: true,
            cycle: 1,
            week: w,
            context: `${w}_${d.key}`,
            day: d.short,
            elapsed: 0,
            started: null,
            ended: null,
            runningSince: null,
            exercises: ex,
          });
      }
  }
  for (const d of n.program)
    d.exercises.forEach((e, i) => {
      const note = localStorage.getItem(`rc_note_${d.key}_e${i}`);
      if (note) n.notes[e.id] = U.cleanText(note, 2000);
    });
  return n;
}
try {
  const raw = localStorage.getItem(GKEY);
  gym = raw ? JSON.parse(raw) : migrate();
  pauseRunningOnColdLaunch(gym);
  normalizeStateOnOpen(gym);
  if (!validGym(gym)) throw Error('invalid-data');
  localStorage.setItem(GKEY, JSON.stringify(gym));
} catch (e) {
  gym = defaultGym();
  storageError =
    e?.name === 'QuotaExceededError' || e?.name === 'SecurityError'
      ? 'Storage locale non disponibile o spazio esaurito. Le modifiche non saranno salvate: esporta/ripristina un backup quando possibile.'
      : 'Dati non leggibili. Apri Altro e ripristina un backup. Gli originali non saranno sovrascritti.';
}
let reopenIds = new Set(gym.sessions.filter((s) => s.runningSince && !s.ended).map((s) => s.id));
function commit(n, { restore = false } = {}) {
  if (storageError && !restore) {
    U.toast('Ripristina prima un backup valido in Altro.');
    return false;
  }
  try {
    if (!validGym(n)) throw Error('Invalid');
    localStorage.setItem(GKEY, JSON.stringify(n));
    gym = n;
    storageError = '';
    return true;
  } catch (e) {
    storageError =
      'Salvataggio locale non disponibile o spazio esaurito. Esporta un backup: le modifiche non verranno applicate finché lo storage non torna disponibile.';
    const banner = document.getElementById('gym-storage');
    if (banner) {
      banner.hidden = false;
      banner.textContent = storageError;
    }
    U.toast('Salvataggio non riuscito. Modifica non applicata.');
    return false;
  }
}
function mutate(fn) {
  const n = U.clone(gym);
  fn(n);
  return commit(n);
}
function effectiveSets(e, w = gym.week) {
  // Livello intermedio: un solo scarico, nella settimana 8 del blocco (con il check fisico).
  return e.sets - (w === MAX_WEEKS && e.compound && e.sets > 1 ? 1 : 0);
}
function fmtRest(sec) {
  const v = Math.max(0, Math.round(Number(sec) || 0));
  if (v < 60) return `${v}s`;
  const m = Math.floor(v / 60),
    r = v % 60;
  return r ? `${m}:${String(r).padStart(2, '0')} min` : `${m} min`;
}
function context() {
  return `${gym.week}_${gym.program[gym.dayIdx].key}`;
}
function active() {
  return gym.sessions.find(
    (s) => !s.legacy && !s.ended && (s.cycle || 1) === gym.cycle && s.context === context(),
  );
}
function closedCurrent() {
  return (
    gym.sessions
      .filter((s) => !s.legacy && s.ended && (s.cycle || 1) === gym.cycle && s.context === context())
      .sort((a, b) => new Date(b.ended || 0) - new Date(a.ended || 0))[0] || null
  );
}
function sessionHasIncomplete(s) {
  return !!s?.exercises?.some((e) => e.rows.some((r) => !r.done));
}
function sessionAllDone(s) {
  return !!s?.exercises?.length && !sessionHasIncomplete(s) && !s.skippedSession;
}
function elapsed(s, at = Date.now()) {
  return s ? s.elapsed + (s.runningSince ? Math.max(0, at - s.runningSince) : 0) : 0;
}
function totals(e) {
  const done = e.rows.filter((r) => r.done),
    weights = done.filter((r) => r.weight != null).map((r) => r.weight),
    measured = done.filter((r) => r.reps != null),
    knownVolume = done.filter((r) => r.reps != null && r.weight != null && e.unit !== 'min' && !isCardio(e));
  return {
    speed: done.some((r) => r.speed != null) ? Math.max(...done.map((r) => r.speed ?? 0)) : null,
    incline: done.some((r) => r.incline != null) ? Math.max(...done.map((r) => r.incline ?? 0)) : null,
    done: done.length,
    weight: weights.length ? Math.max(...weights) : null,
    reps: measured.length ? measured.reduce((n, r) => n + r.reps, 0) : null,
    volume: knownVolume.length ? knownVolume.reduce((n, r) => n + r.weight * r.reps, 0) : null,
    partialVolume: knownVolume.length < done.length,
  };
}
function exStatus(e) {
  const d = totals(e).done;
  if (d === e.rows.length) return 'Completato';
  if (e.stopped) return d ? 'Interrotto' : 'Non Effettuato';
  return d ? 'In corso' : 'Da iniziare';
}
function previous(exId, exclude) {
  return gym.sessions
    .filter((s) => s.id !== exclude && s.ended && s.exercises.some((e) => e.id === exId && totals(e).done))
    .sort((a, b) => new Date(b.started || 0) - new Date(a.started || 0))
    .map((s) => ({ s, e: s.exercises.find((e) => e.id === exId) }))[0];
}
function isCardio(e) {
  return e.move === 'cardio' || /tapis|corsa|camminata|treadmill/i.test(e.name);
}
function rememberedRows(e) {
  const cache = gym.exerciseValues?.[e.id];
  if (cache) return cache;
  const past = gym.sessions
    .slice()
    .reverse()
    .flatMap((s) => s.exercises.filter((x) => x.id === e.id));
  const fields = isCardio(e) ? ['speed', 'incline', 'reps'] : ['weight', 'reps'];
  return Array.from({ length: Math.max(e.sets, ...past.map((x) => x.rows.length)) }, (_, j) =>
    Object.fromEntries(
      fields.map((f) => {
        const row = past.map((x) => x.rows[j]).find((r) => r && r[f] != null);
        return [f, row?.[f] ?? null];
      }),
    ),
  );
}
function suggestedReps(e) {
  const m = String(e?.reps || e?.target || '').match(/\d+(?:[.,]\d+)?/);
  return m ? Number(m[0].replace(',', '.')) : null;
}
function blankSeriesRow(e) {
  return { weight: null, reps: suggestedReps(e), speed: null, incline: null, done: false, legacy: false };
}
function seriesRowHasData(r) {
  return !!r && (r.done || r.weight != null || r.reps != null || r.speed != null || r.incline != null);
}
function hasRememberedExerciseData(rows) {
  return (
    Array.isArray(rows) &&
    rows.some((r) => r && ['reps', 'speed', 'incline', 'weight'].some((k) => r[k] != null))
  );
}
function freshExercisesFor(dayIdx = gym.dayIdx, week = gym.week) {
  return gym.program[dayIdx].exercises.map((e) => {
    const remembered = rememberedRows(e),
      hasSaved = hasRememberedExerciseData(remembered),
      targetReps = suggestedReps(e);
    return {
      ...e,
      target: e.reps,
      instructions: e.note || '',
      stopped: false,
      note: gym.notes[e.id] || '',
      rows: Array.from({ length: effectiveSets(e, week) }, (_, j) => {
        const saved = remembered[j] || remembered[remembered.length - 1] || {};
        return {
          weight: null,
          reps: hasSaved ? (saved.reps ?? null) : targetReps,
          speed: hasSaved ? (saved.speed ?? null) : null,
          incline: hasSaved ? (saved.incline ?? null) : null,
          done: false,
          legacy: false,
        };
      }),
    };
  });
}
function freshExercises() {
  return freshExercisesFor(gym.dayIdx, gym.week);
}

function weightUnit() {
  return gym.settings?.weightUnit === 'lb' ? 'lb' : 'kg';
}
function weightToDisplay(kg) {
  return kg == null ? '' : U.round(weightUnit() === 'lb' ? kg * 2.2046226218 : kg);
}
function weightFromDisplay(v) {
  return v == null ? null : weightUnit() === 'lb' ? v / 2.2046226218 : v;
}
function weightLabel() {
  return weightUnit() === 'lb' ? 'lb' : 'kg';
}
function mealLogKey(dayKey, index, date = U.local().slice(0, 10)) {
  return `${date}|${dayKey}|${index}`;
}

function parseGymNumber(value) {
  if (value == null || value === '') return null;
  const normalized = String(value).trim().replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}
function saveRow(i, j, field, value) {
  const session = ensureSession();
  if (!session) return false;
  let val = parseGymNumber(value);
  if (field === 'weight' && val !== null && !Number.isNaN(val)) val = weightFromDisplay(val);
  if (Number.isNaN(val)) {
    U.toast('Valore non valido. Usa un numero, con punto o virgola per i decimali.');
    return false;
  }
  return mutate((n) => {
    const s = n.sessions.find((x) => x.id === session.id);
    if (!s || !s.exercises[i] || !s.exercises[i].rows[j]) return;
    const e = s.exercises[i],
      row = e.rows[j];
    row[field] = val;
    row.legacy = false;
    n.exerciseValues ??= {};
    n.exerciseValues[e.id] ??= U.clone(rememberedRows(e));
    n.exerciseValues[e.id][j] ??= {};
    n.exerciseValues[e.id][j][field] = val;
  });
}

function openSessionOtherThanCurrent() {
  return (
    gym.sessions
      .filter((s) => !s.legacy && !s.ended)
      .sort((a, b) => new Date(b.started || 0) - new Date(a.started || 0))[0] || null
  );
}
function goToOpenSession(s, { resume = true } = {}) {
  if (!s || s.ended) return false;
  const now = Date.now();
  return mutate((n) => {
    n.cycle = s.cycle || n.cycle;
    n.week = Math.min(MAX_WEEKS, Math.max(1, Number(s.week) || n.week || 1));
    n.dayIdx = sessionDayIndex(s, n.program);
    n.sessions.forEach((x) => {
      if (x.id !== s.id && x.runningSince && !x.ended) {
        x.elapsed = elapsed(x, now);
        x.runningSince = null;
      }
    });
    const x = n.sessions.find((x) => x.id === s.id);
    if (resume && x && !x.runningSince) x.runningSince = now;
  });
}
function endOpenAndStart(openId, target) {
  const source = gym.sessions.find((s) => s.id === openId);
  if (!source || source.ended) return;
  const invalid = source.exercises.filter((e) =>
    e.rows.some((r) => r.done && !r.legacy && (r.reps == null || !isNum(r.reps))),
  );
  if (invalid.length) {
    if (goToOpenSession(source, { resume: false })) {
      render();
      U.toast('La sessione in corso ha serie senza ripetizioni/minuti. Correggile prima di concluderla.');
    }
    return;
  }
  const nowMs = Date.now(),
    nowIso = new Date(nowMs).toISOString(),
    targetDay = gym.program[target.dayIdx],
    newSession = {
      id: U.uid(),
      cycle: target.cycle,
      week: target.week,
      context: `${target.week}_${targetDay.key}`,
      day: targetDay.short,
      started: nowIso,
      ended: null,
      elapsed: 0,
      runningSince: nowMs,
      exercises: freshExercisesFor(target.dayIdx, target.week),
    };
  if (
    mutate((n) => {
      const x = n.sessions.find((s) => s.id === openId);
      if (!x) return;
      x.elapsed = elapsed(x, nowMs);
      x.runningSince = null;
      x.ended = nowIso;
      x.exercises.forEach((e) => {
        if (e.rows.some((r) => !r.done)) e.stopped = true;
      });
      if (n.rest?.sessionId === x.id) n.rest = null;
      n.cycle = target.cycle;
      n.week = target.week;
      n.dayIdx = target.dayIdx;
      n.sessions.push(newSession);
    })
  ) {
    reopenIds.delete(openId);
    render();
    U.toast('Sessione precedente conclusa. Nuova sessione avviata.');
  }
}
function showSessionConflict(open, target) {
  const d = U.modal(
    U.head('Sessione già in corso') +
      `<p>Hai già una sessione aperta: <b>${U.esc(open.day)}</b> · Sett. ${open.week}.</p><p class="muted">Non puoi avviare due sessioni contemporaneamente.</p><div class="session-conflict-actions"><button id="conflict-resume" class="primary">▶ Riprendi sessione in corso</button><button id="conflict-finish" class="danger">■ Concludi e avvia questa</button></div>`,
  );
  d.querySelector('#conflict-resume').onclick = () => {
    d.close();
    if (goToOpenSession(open, { resume: true })) {
      render();
      U.toast('Sessione in corso ripristinata.');
    }
  };
  d.querySelector('#conflict-finish').onclick = () => {
    d.close();
    endOpenAndStart(open.id, target);
  };
}
function ensureSession() {
  const old = active();
  if (old) return old;
  const closed = closedCurrent();
  if (closed) {
    U.toast(
      closed.skippedSession
        ? 'Questa sessione è stata saltata. Ripristinala dal banner.'
        : 'Questa sessione è già conclusa. Usa il banner per modificarla.',
    );
    return null;
  }
  if (!gym.program[gym.dayIdx].exercises.length) {
    U.toast('Aggiungi prima un esercizio alla scheda.');
    return null;
  }
  const other = openSessionOtherThanCurrent();
  if (other) {
    showSessionConflict(other, { cycle: gym.cycle, week: gym.week, dayIdx: gym.dayIdx });
    return null;
  }
  const now = Date.now(),
    s = {
      id: U.uid(),
      cycle: gym.cycle,
      week: gym.week,
      context: context(),
      day: gym.program[gym.dayIdx].short,
      started: new Date(now).toISOString(),
      ended: null,
      elapsed: 0,
      runningSince: now,
      exercises: freshExercises(),
    };
  if (!mutate((n) => n.sessions.push(s))) return null;
  return active();
}
function sessionAction(type) {
  let s = active();
  if (!s) {
    ensureSession();
    render();
    return;
  }
  if (type === 'end') {
    finishSession(s.id);
    return;
  }
  const pausing = !!s.runningSince;
  if (
    mutate((n) => {
      const x = n.sessions.find((x) => x.id === s.id);
      if (pausing) {
        x.elapsed = elapsed(x);
        x.runningSince = null;
        if (n.rest?.sessionId === x.id) n.rest.remaining = Math.max(0, n.rest.end - Date.now());
      } else {
        n.sessions.forEach((y) => {
          if (y.runningSince) {
            y.elapsed = elapsed(y);
            y.runningSince = null;
          }
        });
        x.runningSince = Date.now();
        if (n.rest?.sessionId === x.id && n.rest.remaining != null) {
          n.rest.end = Date.now() + n.rest.remaining;
          delete n.rest.remaining;
        }
      }
    })
  ) {
    reopenIds.delete(s.id);
    render();
    if (pausing) pausePanel(s.id);
  }
}
function pausePanel(id) {
  const s = gym.sessions.find((x) => x.id === id);
  if (!s || s.ended) return;
  const d = U.modal(
    U.head('Sessione in pausa') +
      `<div class="pause-panel"><span class="pause-symbol">Ⅱ</span><p>${U.esc(s.day)}</p><strong>${U.duration(elapsed(s))}</strong><p class="muted">Il tempo è fermo.</p><div class="pause-actions"><button class="primary" id="pause-resume">▶ Riprendi sessione</button><button class="danger" id="pause-finish">■ Termina e salva</button></div></div>`,
  );
  d.querySelector('#pause-resume').onclick = () => {
    d.close();
    sessionAction('toggle');
  };
  d.querySelector('#pause-finish').onclick = () => finishSession(id);
}

function finalizeSession(id) {
  const s = gym.sessions.find((s) => s.id === id);
  if (!s || s.ended) return;
  const now = new Date().toISOString();
  if (
    mutate((n) => {
      const x = n.sessions.find((x) => x.id === id);
      x.elapsed = elapsed(x);
      x.runningSince = null;
      x.ended = now;
      x.exercises.forEach((e) => {
        if (e.rows.some((r) => !r.done)) e.stopped = true;
      });
      n.rest = null;
      advanceWorkoutPosition(n, x.week || n.week, sessionDayIndex(x, n.program));
    })
  ) {
    reopenIds.delete(id);
    document.getElementById('editor')?.close();
    render();
    summary(id);
  }
}
function finishSession(id) {
  const s = gym.sessions.find((s) => s.id === id);
  if (!s || s.ended) return;
  const invalid = s.exercises.filter((e) =>
    e.rows.some((r) => r.done && !r.legacy && (r.reps == null || !isNum(r.reps))),
  );
  if (invalid.length) {
    const d = U.modal(
      U.head('Controlla le serie') +
        `<p>Mancano ripetizioni o minuti nelle serie segnate come fatte:</p><p>${invalid.map((e) => U.esc(e.name)).join('<br>')}</p><button class="primary" id="fix-session">Correggi esercizi</button>`,
    );
    d.querySelector('#fix-session').onclick = () => editSession(id);
    return;
  }
  if (sessionHasIncomplete(s)) {
    const c = sessionCounts(s),
      d = U.modal(
        U.head('Sessione non completa') +
          `<p>Hai completato <b>${c.sets}/${c.total} serie</b>. Puoi modificare i risultati, continuare la sessione oppure chiuderla comunque mantenendo gli esercizi mancanti come non completati.</p><div class="partial-finish-actions"><button id="partial-edit">Modifica risultati</button><button id="partial-continue" class="primary">Completa sessione</button><button id="partial-close" class="danger">Chiudi comunque</button></div>`,
      );
    d.querySelector('#partial-edit').onclick = () => {
      d.close();
      editSession(id);
    };
    d.querySelector('#partial-continue').onclick = () => {
      d.close();
      if (!s.runningSince) sessionAction('toggle');
    };
    d.querySelector('#partial-close').onclick = () => {
      d.close();
      finalizeSession(id);
    };
    return;
  }
  finalizeSession(id);
}
async function skipSession() {
  const current = active(),
    label = gym.program[gym.dayIdx]?.short || 'questa sessione';
  if (!(await U.ask(`Saltare ${label} e passare alla sessione successiva?`, { ok: 'Salta sessione' })))
    return;
  const now = new Date().toISOString(),
    currentId = current?.id || null;
  if (
    mutate((n) => {
      let x = currentId ? n.sessions.find((s) => s.id === currentId) : null;
      if (!x) {
        x = {
          id: U.uid(),
          cycle: n.cycle,
          week: n.week,
          context: `${n.week}_${n.program[n.dayIdx].key}`,
          day: n.program[n.dayIdx].short,
          started: now,
          ended: now,
          elapsed: 0,
          runningSince: null,
          skippedSession: true,
          exercises: freshExercises().map((e) => ({ ...e, stopped: true })),
        };
        n.sessions.push(x);
      } else {
        x.elapsed = elapsed(current);
        x.runningSince = null;
        x.ended = now;
        x.skippedSession = true;
        x.exercises.forEach((e) => (e.stopped = true));
      }
      n.rest = null;
      advanceWorkoutPosition(n, x.week || n.week, sessionDayIndex(x, n.program));
    })
  ) {
    if (currentId) reopenIds.delete(currentId);
    render();
    U.toast('Sessione saltata. Aperta la successiva.');
  }
}

function sessionCounts(s) {
  return {
    done: s.exercises.filter((e) => exStatus(e) === 'Completato').length,
    partial: s.exercises.filter((e) => totals(e).done > 0 && exStatus(e) !== 'Completato').length,
    skipped: s.exercises.filter((e) => !totals(e).done).length,
    sets: s.exercises.reduce((n, e) => n + totals(e).done, 0),
    total: s.exercises.reduce((n, e) => n + e.rows.length, 0),
  };
}

function summary(id) {
  const s = gym.sessions.find((s) => s.id === id);
  if (!s) return;
  const c = sessionCounts(s),
    detailLabel = s.ended
      ? s.skippedSession
        ? 'Ripristina sessione'
        : s.archivedIncomplete
          ? 'Modifica dati'
          : sessionHasIncomplete(s)
            ? 'Riprendi sessione'
            : 'Modifica dati'
      : 'Correggi esercizi';
  const d = U.modal(
    U.head('Riepilogo allenamento') +
      `<div class="summary-hero"><span class="saved-check">✓</span><h3>${U.esc(s.day)}</h3><p class="muted">${s.skippedSession ? 'Sessione saltata' : s.ended ? 'Salvato automaticamente' : 'Sessione in corso'} · ${U.date(s.started)}</p><strong>${U.duration(elapsed(s))}</strong><span class="muted">Tempo effettivo · pause escluse</span></div><div class="summary-counts"><div><b>${c.done}</b><span>Completati</span></div><div><b>${c.partial}</b><span>Parziali</span></div><div><b>${c.skipped}</b><span>${s.ended ? 'Saltati' : 'Da svolgere'}</span></div></div><div class="session-progress"><i style="width:${c.total ? (100 * c.sets) / c.total : 0}%"></i></div><p class="muted">${c.sets} serie fatte su ${c.total}</p><details class="session-details"><summary>Vedi esercizi</summary>${s.exercises.map((e) => `<div class="summary-ex"><span>${U.esc(e.name)}</span><small>${totals(e).done}/${e.rows.length} · ${exStatus(e)}</small></div>`).join('')}</details><div class="summary-actions"><button id="detail-session">${detailLabel}</button><button class="primary" id="summary-close">Fatto</button></div>`,
  );
  d.querySelector('#detail-session').onclick = () => {
    d.close();
    if (!s.ended) editSession(id);
    else if (s.archivedIncomplete) editClosedSession(id, true);
    else if (s.skippedSession || sessionHasIncomplete(s)) reopenClosedSession(id);
    else editClosedSession(id, false);
  };
  d.querySelector('#summary-close').onclick = () => d.close();
}

function weekWindowStart(week = gym.week) {
  const w = Math.min(MAX_WEEKS, Math.max(1, Number(week) || 1));
  return Math.floor((w - 1) / WEEK_WINDOW) * WEEK_WINDOW + 1;
}
function selectWeek(week) {
  const w = Math.min(MAX_WEEKS, Math.max(1, Number(week) || 1));
  if (mutate((n) => (n.week = w))) render();
}
function showWeekPicker() {
  const d = U.modal(
    U.head('Seleziona settimana') +
      `<p class="muted week-picker-help">Blocco ${gym.settings.block || 1}: scegli una delle ${MAX_WEEKS} settimane (2 mesi).</p><div class="week-picker-grid">${Array.from(
        { length: MAX_WEEKS },
        (_, i) => {
          const w = i + 1;
          return `<button type="button" data-pick-week="${w}" class="${gym.week === w ? 'active' : ''}">Sett. ${w}<small class="week-pick-date">${U.esc(weekDates(w))}</small></button>`;
        },
      ).join('')}</div>`,
  );
  d.querySelectorAll('[data-pick-week]').forEach(
    (b) =>
      (b.onclick = () => {
        const w = Number(b.dataset.pickWeek);
        d.close();
        selectWeek(w);
      }),
  );
}
function bindWeekGesture(button) {
  let timer = null,
    held = false,
    x = 0,
    y = 0;
  const cancel = () => {
    clearTimeout(timer);
    timer = null;
    button.classList.remove('holding');
  };
  button.title = 'Tocca per selezionare. Tieni premuto per vedere tutte le settimane.';
  button.setAttribute('aria-label', button.textContent + '. Tieni premuto per vedere tutte le settimane.');
  button.onpointerdown = (e) => {
    if (e.button !== 0) return;
    held = false;
    x = e.clientX;
    y = e.clientY;
    button.classList.add('holding');
    timer = setTimeout(() => {
      cancel();
      held = true;
      showWeekPicker();
    }, 600);
  };
  button.onpointermove = (e) => {
    if (Math.hypot(e.clientX - x, e.clientY - y) > 10) cancel();
  };
  button.onpointerup = cancel;
  button.onpointercancel = cancel;
  button.onpointerleave = cancel;
  button.oncontextmenu = (e) => e.preventDefault();
  button.onkeydown = (e) => {
    if ((e.altKey && e.key === 'Enter') || e.key === 'F2') {
      e.preventDefault();
      showWeekPicker();
    }
  };
  button.onclick = (e) => {
    if (held) {
      e.preventDefault();
      held = false;
      return;
    }
    selectWeek(Number(button.dataset.week));
  };
}
const TAB_ICONS = {
  workout:
    '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
  food: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M7 3v8M5 3v5a2 2 0 004 0V3M7 11v10M16 21V3c-2.2 1.2-3 3.6-3 6.5V13h3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  stats:
    '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 20V10M11 20V4M18 20v-7" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
  more: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/></svg>',
};
function header() {
  const tabLabels = { workout: 'Allenamento', food: 'Nutrizione', stats: 'Statistiche', more: 'Altro' };
  document.getElementById('pagetitle').textContent = tabLabels[gym.tab] || 'Allenamento';
  const pageNav = document.getElementById('page-nav');
  if (pageNav) {
    pageNav.innerHTML = TAB_ORDER.map(
      (tab) =>
        `<button type="button" data-page-tab="${tab}" class="tab ${gym.tab === tab ? 'active' : ''}" aria-current="${gym.tab === tab ? 'page' : 'false'}">${TAB_ICONS[tab] || ''}<span>${tabLabels[tab]}</span></button>`,
    ).join('');
    pageNav
      .querySelectorAll('[data-page-tab]')
      .forEach((button) => button.addEventListener('click', () => switchPageTab(button.dataset.pageTab)));
  }
  const holder = document.getElementById('header-session'),
    s = active(),
    closed = !s ? closedCurrent() : null;
  const startRow = document.getElementById('workout-start-row');
  holder.innerHTML =
    gym.tab === 'workout'
      ? `<div class="session-inline">${closed ? `<span class="session-closed-chip ${closed.skippedSession ? 'is-skipped' : 'is-complete'}">${closed.skippedSession ? '↷ Saltata' : '✓ Conclusa'}</span>` : ''}</div>`
      : '';
  if (startRow) {
    startRow.hidden = true;
    startRow.innerHTML = '';
  }
  const wb = document.getElementById('weekbar'),
    day = document.getElementById('daybar'),
    windowStart = weekWindowStart();
  wb.style.display = gym.tab === 'workout' ? 'block' : 'none';
  wb.className = 'week-bar';
  wb.innerHTML = `<div class="week-stepper" role="group" aria-label="Settimana"><button type="button" class="week-step" data-week-step="-1" aria-label="Settimana precedente" ${gym.week <= 1 ? 'disabled' : ''}>‹</button><button type="button" class="week-current" id="week-current" aria-label="Settimana ${gym.week} di ${MAX_WEEKS}. Tocca per scegliere">Settimana ${gym.week} <small>di ${MAX_WEEKS} · ${U.esc(weekDates(gym.week))}</small><span class="week-caret" aria-hidden="true">▾</span></button><button type="button" class="week-step" data-week-step="1" aria-label="Settimana successiva" ${gym.week >= MAX_WEEKS ? 'disabled' : ''}>›</button></div>`;
  day.style.display = gym.tab === 'workout' ? 'grid' : 'none';
  day.innerHTML = gym.program
    .map(
      (d, i) =>
        `<button data-dayidx="${i}" class="${gym.dayIdx === i ? 'active' : ''}">${U.esc(d.short)}</button>`,
    )
    .join('');
  wb.querySelectorAll('[data-week]').forEach(bindWeekGesture);
  wb.querySelectorAll('[data-week-step]').forEach(
    (b) => (b.onclick = () => selectWeek(gym.week + Number(b.dataset.weekStep))),
  );
  const wc = wb.querySelector('#week-current');
  if (wc) wc.onclick = showWeekPicker;
  day.querySelectorAll('button').forEach(bindDayGesture);
}
function bindDayGesture(b) {
  let timer = null,
    held = false,
    x = 0,
    y = 0;
  const cancel = () => {
    clearTimeout(timer);
    timer = null;
    b.classList.remove('holding');
  };
  const edit = () => {
    cancel();
    held = true;
    if (mutate((n) => (n.dayIdx = Number(b.dataset.dayidx)))) {
      render();
      programEditor();
    }
  };
  b.setAttribute('aria-label', b.textContent + '. Tieni premuto per modificare; da tastiera Alt+Invio.');
  b.onpointerdown = (e) => {
    if (e.button !== 0) return;
    held = false;
    x = e.clientX;
    y = e.clientY;
    b.classList.add('holding');
    timer = setTimeout(edit, 600);
  };
  b.onpointermove = (e) => {
    if (Math.hypot(e.clientX - x, e.clientY - y) > 10) cancel();
  };
  b.onpointerup = cancel;
  b.onpointercancel = cancel;
  b.onpointerleave = cancel;
  b.oncontextmenu = (e) => e.preventDefault();
  b.onkeydown = (e) => {
    if (e.altKey && e.key === 'Enter') {
      e.preventDefault();
      edit();
    }
  };
  b.onclick = (e) => {
    if (held) {
      e.preventDefault();
      held = false;
      return;
    }
    if (mutate((n) => (n.dayIdx = Number(b.dataset.dayidx)))) render();
  };
}

function rowText(e, r) {
  return isCardio(e)
    ? `${r.reps ?? '—'} min · ${r.speed ?? '—'} km/h · ${r.incline ?? '—'}% pendenza`
    : `${r.weight == null ? '—' : weightToDisplay(r.weight)} ${weightLabel()} × ${r.reps ?? '—'} ${e.unit === 'min' ? 'min' : 'rip.'}`;
}
function seriesInputs(e, i, editing = false) {
  const cardio = isCardio(e),
    prefix = editing ? 'data-edit-row' : 'data-row';
  const input = (r, j, f, label, step) => {
    const value = f === 'weight' ? weightToDisplay(r[f]) : (r[f] ?? '');
    return `<input ${prefix}="${i}:${j}:${f}" aria-label="${label}, serie ${j + 1}" type="number" min="0" step="${step}" inputmode="decimal" placeholder="${label}" value="${value}">`;
  };
  const doneHead = editing
    ? '<span>Fatta</span>'
    : `<button type="button" class="complete-all-series series-all" data-complete-all="${i}" aria-label="Completa tutte le serie">✓ Tutte</button>`;
  const controls = editing
    ? `<div class="series-count-actions"><button type="button" data-edit-series-remove="${i}">− Serie</button><button type="button" data-edit-series-add="${i}">＋ Serie</button></div>`
    : `<div class="series-count-actions"><button type="button" data-series-remove="${i}">− Serie</button><button type="button" data-series-add="${i}">＋ Serie</button></div>`;
  return `<div class="series-head ${cardio ? 'cardio-row' : ''}"><span>#</span>${cardio ? '<span>km/h</span><span>Pend. %</span><span>Min.</span>' : `<span>${weightLabel()}</span><span>${e.unit === 'min' ? 'Minuti' : 'Rip.'}</span>`}${doneHead}</div>${e.rows.map((r, j) => `<div class="series-row ${cardio ? 'cardio-row' : ''}"><span>${j + 1}</span>${cardio ? input(r, j, 'speed', 'Velocità km/h', 0.1) + input(r, j, 'incline', 'Pendenza %', 0.5) : input(r, j, 'weight', `Carico ${weightLabel()}`, 0.5)}${input(r, j, 'reps', e.unit === 'min' || cardio ? 'Minuti' : 'Ripetizioni', e.unit === 'min' || cardio ? 0.1 : 1)}${editing ? `<input type="checkbox" aria-label="Serie ${j + 1} completata" data-edit-done="${i}:${j}" ${r.done ? 'checked' : ''}>` : `<button class="series-done-btn ${r.done ? 'good' : ''}" data-complete="${i}:${j}" aria-pressed="${r.done}" aria-label="Completa serie ${j + 1}">${r.done ? '✓' : '○'}</button>`}</div>`).join('')}${controls}`;
}
function exerciseCard(e, i, s, next) {
  const status = exStatus(e),
    done = status === 'Completato' || e.stopped,
    prev = previous(e.id, s?.id),
    alts = exerciseAlternatives(e),
    key = exerciseExpandKey(e, i),
    expanded = expandedExerciseKeys.has(key),
    progress = totals(e).done;
  return `<div class="card exercise-card ${done ? 'exercise-complete' : next ? 'exercise-next' : ''} ${expanded ? 'exercise-expanded' : 'exercise-compact'}"><div class="exercise-header-row"><div class="exercise-title-block exercise-title-toggle" data-exercise-toggle="${i}" role="button" tabindex="0" aria-expanded="${expanded}" aria-label="${expanded ? 'Riduci' : 'Apri'} ${U.esc(e.name)}"><div class="exercise-name-line"><h3>${U.esc(e.name)}</h3><span class="exercise-title-chevron" aria-hidden="true">${expanded ? '▴' : '▾'}</span></div><p class="equipment-label">${U.esc(equipment(e))}</p><p class="exercise-meta muted">${e.rows.length} serie · Obiettivo ${U.esc(e.target)} · Recupero ${fmtRest(e.rest)}</p></div>${status !== 'Completato' ? `<button data-skip="${i}" class="skip-exercise">${e.stopped ? 'Ripristina' : 'Salta esercizio'}</button>` : ''}</div><div class="compact-progress"><span>${progress}/${e.rows.length} serie</span><i><b style="width:${e.rows.length ? Math.round((progress / e.rows.length) * 100) : 0}%"></b></i></div><div class="compact-series-summary" style="--cols:${e.rows.length === 4 ? 2 : Math.max(1, Math.min(e.rows.length, 3))}">${compactExerciseSummary(e)}</div>${
    expanded
      ? `<div class="exercise-expanded-body">${
          prev
            ? `<p class="muted previous-session">Ultima sessione ${U.date(prev.s.started)}: ${prev.e.rows
                .filter((r) => r.done)
                .map((r) => rowText(prev.e, r))
                .join(' · ')}</p>`
            : ''
        }${seriesInputs(e, i)}<div class="exercise-expanded-actions">${alts.length ? `<button data-alt="${i}" class="alt-exercise" aria-label="Versioni alternative per ${U.esc(e.name)}">↔ Variante</button>` : ''}<button data-info="${i}" class="strong-icon-action" aria-label="Informazioni esercizio">ⓘ</button><button data-note="${i}" class="strong-icon-action" aria-label="Modifica note esercizio">✎</button></div>${e.note ? `<p class="exercise-note">${U.esc(e.note)}</p>` : ''}</div>`
      : `${e.note ? `<p class="exercise-note compact-note">${U.esc(e.note)}</p>` : ''}`
  }</div>`;
}
function closedExerciseSummary(e) {
  const t = totals(e),
    sets = e.rows
      .filter((r) => r.done)
      .map((r, j) => `<span class="closed-summary-set"><b>${j + 1}</b> ${U.esc(rowText(e, r))}</span>`)
      .join('');
  return `<article class="closed-summary-exercise"><div class="closed-summary-exercise-head"><div><h3>${U.esc(e.name)}</h3><small>${U.esc(equipment(e))}</small></div><span class="closed-summary-status ${t.done === e.rows.length ? 'done' : 'partial'}">${t.done}/${e.rows.length} serie</span></div><div class="closed-summary-sets">${sets || '<span class="muted">Nessuna serie registrata</span>'}</div>${e.note ? `<p class="closed-summary-note">✎ ${U.esc(e.note)}</p>` : ''}</article>`;
}
function closedSessionSummary(s) {
  const c = sessionCounts(s),
    complete = !sessionHasIncomplete(s) && !s.skippedSession;
  return `<section class="closed-session-summary ${complete ? 'all-done' : 'has-missing'}"><div class="closed-summary-hero"><span class="closed-summary-icon">${complete ? '✓' : '◐'}</span><div><span class="eyebrow">${complete ? 'Allenamento completato' : 'Allenamento concluso'}</span><h2>${U.esc(s.day)}</h2><p class="muted">${U.date(s.started)} · Settimana ${s.week} · Ciclo ${s.cycle || 1}</p></div></div><div class="closed-summary-kpis"><div><b>${U.duration(elapsed(s))}</b><span>Durata</span></div><div><b>${c.sets}/${c.total}</b><span>Serie</span></div><div><b>${c.done}/${s.exercises.length}</b><span>Esercizi</span></div></div><div class="closed-summary-list">${s.exercises.map(closedExerciseSummary).join('')}</div></section>`;
}
function closedSessionPanel(s) {
  if (s.skippedSession)
    return `<section class="closed-session-banner skipped"><strong>↷ Sessione saltata</strong><p>Questa sessione è stata saltata. Puoi ripristinarla per svolgerla normalmente.</p><button id="restore-skipped-session" class="primary">Ripristina sessione</button></section>${closedSessionSummary(s)}`;
  const incomplete = sessionHasIncomplete(s);
  if (incomplete && s.archivedIncomplete)
    return `<section class="closed-session-complete-head archived-incomplete"><div><span class="eyebrow">Sessione archiviata</span><strong>◐ Conclusa parzialmente</strong><p>La giornata è stata archiviata, ma nel riepilogo restano evidenziati gli esercizi e le serie non terminati.</p></div><button id="edit-closed-session">Modifica risultati</button></section>${closedSessionSummary(s)}`;
  if (incomplete)
    return `<section class="closed-session-banner incomplete"><strong>◐ Sessione conclusa parzialmente</strong><p>Ci sono esercizi o serie non completati. Puoi correggere i dati, riaprire la sessione oppure archiviarla definitivamente così com’è.</p><div class="closed-session-actions three-actions"><button id="edit-closed-session">Modifica risultati</button><button id="complete-closed-session" class="primary">Completa sessione</button><button id="archive-closed-session" class="archive-action">Archivia</button></div></section>${closedSessionSummary(s)}`;
  return `<section class="closed-session-complete-head"><div><span class="eyebrow">Giornata completata</span><strong>✓ Tutto completato</strong><p>La sessione è chiusa. Qui trovi solo il riepilogo dei risultati registrati.</p></div><button id="edit-closed-session">Modifica risultati</button></section>${closedSessionSummary(s)}`;
}
function archiveIncompleteSession(id) {
  const s = gym.sessions.find((s) => s.id === id);
  if (!s || !s.ended || !sessionHasIncomplete(s)) return;
  if (
    mutate((n) => {
      const x = n.sessions.find((s) => s.id === id);
      if (x) x.archivedIncomplete = true;
    })
  ) {
    render();
    U.toast('Sessione archiviata con esercizi non completati.');
  }
}
function reopenClosedSession(id) {
  const source = gym.sessions.find((s) => s.id === id);
  if (!source || !source.ended) return;
  const doneSets = source.exercises.reduce((n, e) => n + e.rows.filter((r) => r.done).length, 0),
    now = Date.now();
  if (
    mutate((n) => {
      n.sessions.forEach((s) => {
        if (s.id !== id && s.runningSince && !s.ended) {
          s.elapsed = elapsed(s, now);
          s.runningSince = null;
        }
      });
      const x = n.sessions.find((s) => s.id === id);
      if (!x) return;
      if (doneSets === 0) {
        x.started = new Date(now).toISOString();
        x.elapsed = 0;
        x.exercises.forEach((e) => {
          e.stopped = false;
          e.rows.forEach((r) => {
            r.done = false;
            r.legacy = false;
          });
        });
      } else {
        x.exercises.forEach((e) => {
          if (e.rows.some((r) => !r.done)) e.stopped = false;
        });
      }
      x.ended = null;
      x.runningSince = now;
      x.skippedSession = false;
      n.cycle = x.cycle || n.cycle;
      n.week = Math.min(MAX_WEEKS, Math.max(1, Number(x.week) || n.week || 1));
      n.dayIdx = sessionDayIndex(x, n.program);
      n.rest = null;
    })
  ) {
    reopenIds.delete(id);
    render();
    U.toast(
      doneSets === 0
        ? 'Sessione ripristinata. Puoi iniziare da zero.'
        : 'Sessione riaperta. Riprendi dagli esercizi mancanti.',
    );
  }
}
function restoreSkippedSession(id) {
  reopenClosedSession(id);
}
function closedSeriesInputs(e, i, allowCompletion) {
  const cardio = isCardio(e),
    input = (r, j, f, label, step) => {
      const value = f === 'weight' ? weightToDisplay(r[f]) : (r[f] ?? '');
      return `<input data-closed-row="${i}:${j}:${f}" aria-label="${label}, serie ${j + 1}" type="number" min="0" step="${step}" inputmode="decimal" placeholder="${label}" value="${value}">`;
    };
  return `<div class="series-head ${cardio ? 'cardio-row' : ''}"><span>#</span>${cardio ? '<span>km/h</span><span>Pend. %</span><span>Min.</span>' : `<span>${weightLabel()}</span><span>${e.unit === 'min' ? 'Minuti' : 'Rip.'}</span>`}<span>Fatta</span></div>${e.rows.map((r, j) => `<div class="series-row ${cardio ? 'cardio-row' : ''}"><span>${j + 1}</span>${cardio ? input(r, j, 'speed', 'Velocità km/h', 0.1) + input(r, j, 'incline', 'Pendenza %', 0.5) : input(r, j, 'weight', `Carico ${weightLabel()}`, 0.5)}${input(r, j, 'reps', e.unit === 'min' || cardio ? 'Minuti' : 'Ripetizioni', e.unit === 'min' || cardio ? 0.1 : 1)}<input class="closed-complete-check" type="checkbox" aria-label="Serie ${j + 1} completata" data-closed-done="${i}:${j}" ${r.done ? 'checked' : ''}></div>`).join('')}<div class="series-count-actions"><button type="button" data-closed-series-remove="${i}">− Serie</button><button type="button" data-closed-series-add="${i}">＋ Serie</button></div>`;
}
function editClosedSession(id, allowCompletion = false) {
  const source = gym.sessions.find((s) => s.id === id);
  if (!source || !source.ended || source.skippedSession) return;
  const visible = source.exercises.map((e, i) => ({ e, i }));
  const d = U.modal(
    U.head(allowCompletion ? 'Completa o modifica sessione' : 'Modifica dati sessione') +
      `<form class="closed-session-editor"><p class="muted">Puoi correggere carichi, ripetizioni e note e anche aggiungere o rimuovere serie da ogni esercizio. Lo stato completato di ogni serie può essere modificato.</p>${visible.map(({ e, i }) => `<details class="card" ${e.rows.some((r) => !r.done) ? 'open' : ''}><summary>${U.esc(e.name)} · ${totals(e).done}/${e.rows.length}</summary>${closedSeriesInputs(e, i, true)}<label>Note esercizio</label><textarea rows="3" data-closed-note="${i}">${U.esc(e.note || gym.notes[e.id] || '')}</textarea></details>`).join('')}<p class="error" id="closed-session-error"></p><button class="primary closed-save">Salva modifiche</button></form>`,
  );
  const readDraft = () => {
    const n = U.clone(source),
      error = d.querySelector('#closed-session-error');
    error.textContent = '';
    d.querySelectorAll('[data-closed-row]').forEach((inp) => {
      const [i, j, key] = inp.dataset.closedRow.split(':');
      let val = parseGymNumber(inp.value);
      if (key === 'weight' && val !== null && !Number.isNaN(val)) val = weightFromDisplay(val);
      if (val !== null && !isNum(val)) error.textContent = 'Controlla i valori inseriti.';
      else n.exercises[Number(i)].rows[Number(j)][key] = val;
    });
    d.querySelectorAll('[data-closed-done]').forEach((inp) => {
      const [i, j] = inp.dataset.closedDone.split(':').map(Number),
        row = n.exercises[i].rows[j];
      row.done = inp.checked;
      row.legacy = false;
    });
    d.querySelectorAll('[data-closed-note]').forEach((inp) => {
      n.exercises[Number(inp.dataset.closedNote)].note = U.cleanText(inp.value, 2000);
    });
    n.exercises.forEach((e) => (e.stopped = e.rows.some((r) => !r.done)));
    return { n, error };
  };
  const saveDraft = (n) =>
    mutate((g) => {
      g.sessions = g.sessions.map((s) => (s.id === id ? n : s));
      if (!sessionHasIncomplete(n)) n.archivedIncomplete = false;
      n.exercises.forEach((e, i) => {
        g.notes[e.id] = e.note || '';
        e.rows.forEach((r, j) =>
          ['weight', 'reps', 'speed', 'incline'].forEach((key) => {
            const before = source.exercises[i]?.rows[j]?.[key];
            if (r[key] !== before) {
              g.exerciseValues ??= {};
              g.exerciseValues[e.id] ??= U.clone(rememberedRows(e));
              g.exerciseValues[e.id][j] ??= {};
              g.exerciseValues[e.id][j][key] = r[key];
            }
          }),
        );
      });
    });
  d.querySelectorAll('[data-closed-series-add]').forEach(
    (b) =>
      (b.onclick = () => {
        const { n, error } = readDraft();
        if (error.textContent) return;
        const i = Number(b.dataset.closedSeriesAdd),
          e = n.exercises[i];
        e.rows.push(blankSeriesRow(e));
        if (saveDraft(n)) {
          d.close();
          render();
          editClosedSession(id, true);
        }
      }),
  );
  d.querySelectorAll('[data-closed-series-remove]').forEach(
    (b) =>
      (b.onclick = async () => {
        const { n, error } = readDraft();
        if (error.textContent) return;
        const i = Number(b.dataset.closedSeriesRemove),
          e = n.exercises[i];
        if (e.rows.length <= 1) {
          U.toast('Ogni esercizio deve avere almeno una serie.');
          return;
        }
        const last = e.rows.at(-1);
        if (
          seriesRowHasData(last) &&
          !(await U.ask('L’ultima serie contiene dati. Vuoi eliminarla?', { ok: 'Elimina serie' }))
        )
          return;
        e.rows.pop();
        if (saveDraft(n)) {
          d.close();
          render();
          editClosedSession(id, true);
        }
      }),
  );
  d.querySelector('form').onsubmit = (event) => {
    event.preventDefault();
    const { n, error } = readDraft();
    if (error.textContent) return;
    if (n.exercises.some((e) => e.rows.some((r) => r.done && r.reps == null))) {
      error.textContent = 'Inserisci ripetizioni o minuti nelle serie segnate come completate.';
      return;
    }
    if (saveDraft(n)) {
      d.close();
      render();
      U.toast('Dati della sessione aggiornati.');
    }
  };
}
function weightOn(day) {
  return (gym.bodyWeights || []).find((x) => localDay(x.date) === day) || null;
}
function missingWeightDays(n = 7) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const day = ymd(d);
    if (!weightOn(day)) out.push(day);
  }
  return out;
}
function dayLabel(day) {
  const today = ymd(new Date()),
    y = new Date();
  y.setDate(y.getDate() - 1);
  if (day === today) return 'Oggi';
  if (day === ymd(y)) return 'Ieri';
  return new Date(day + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
}
function saveWeightForDay(n, day, kg) {
  n.bodyWeights ??= [];
  const existing = n.bodyWeights.find((x) => localDay(x.date) === day);
  if (existing) existing.kg = kg;
  else {
    const isToday = day === ymd(new Date());
    n.bodyWeights.push({ id: U.uid(), date: isToday ? new Date().toISOString() : new Date(day + 'T08:00:00').toISOString(), kg });
  }
  if (n.settings.weightSkips) delete n.settings.weightSkips[day];
}
function openWeightEntry(day = ymd(new Date())) {
  const today = ymd(new Date()),
    cur = weightOn(day);
  const d = U.modal(
    U.head('Registra peso') +
      `<form id="weight-entry-form" class="check-form"><label>Giorno<input name="day" type="date" max="${today}" value="${day}" required></label><label>Peso (${weightLabel()})<input name="weight" type="number" min="0" step="0.1" inputmode="decimal" value="${cur ? U.round(weightToDisplay(cur.kg)) : ''}" required></label><p class="muted">Se quel giorno hai già un peso registrato, viene sostituito.</p><button class="primary">Salva peso</button></form>`,
  );
  d.querySelector('#weight-entry-form').onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target),
      dd = String(fd.get('day') || ''),
      val = parseGymNumber(fd.get('weight'));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dd) || dd > today) {
      U.toast('Scegli un giorno valido.');
      return;
    }
    if (val == null || Number.isNaN(val) || val <= 0) {
      U.toast('Inserisci un peso valido.');
      return;
    }
    if (mutate((n) => saveWeightForDay(n, dd, weightFromDisplay(val)))) {
      d.close();
      render();
      U.toast(`Peso di ${dayLabel(dd).toLowerCase()} salvato.`);
    }
  };
}
function weightReminder() {
  const today = ymd(new Date());
  if (weightOn(today)) return '';
  if (gym.settings.weightSkips?.[today]) return '';
  return `<div class="card weigh-reminder" role="region" aria-label="Peso di oggi"><span class="weigh-icon" aria-hidden="true">⚖️</span><form id="weigh-today-form" class="weigh-form"><input name="weight" type="number" min="0" step="0.1" inputmode="decimal" placeholder="Peso di oggi (${weightLabel()})" aria-label="Peso di oggi in ${weightLabel()}" required><button class="primary">Salva</button></form><button type="button" id="weigh-skip" class="weigh-skip" aria-label="Salta il peso di oggi, potrai registrarlo dopo">Dopo</button></div>`;
}
function weekWeightAvg(offsetWeeks = 0) {
  const end = new Date();
  end.setDate(end.getDate() - offsetWeeks * 7);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  const a = ymd(start),
    b = ymd(end);
  const v = (gym.bodyWeights || []).filter((x) => {
    const d = localDay(x.date);
    return d >= a && d <= b;
  });
  return v.length ? v.reduce((t, x) => t + x.kg, 0) / v.length : null;
}
function nutritionTargets() {
  const pr = gym.settings.profile || { age: 30, heightCm: 186, startKg: 86, sex: 'M' },
    last = (gym.bodyWeights || []).slice().sort((a, b) => new Date(b.date) - new Date(a.date))[0],
    kg = last?.kg || pr.startKg || 86;
  // Mifflin-St Jeor × 1,4 (lavoro sedentario + 3-4 allenamenti + passi).
  const bmr = 10 * kg + 6.25 * pr.heightCm - 5 * pr.age + (pr.sex === 'F' ? -161 : 5),
    tdee = Math.round((bmr * 1.4) / 10) * 10,
    target = tdee + 150,
    goalLo = U.round(kg + 0.25),
    goalHi = U.round(kg + 0.5);
  const f = (n) => n.toLocaleString('it-IT');
  return `<p class="muted">Massa pulita: fabbisogno stimato ~${f(tdee)} kcal, obiettivo ~${f(target)} kcal di media (circa 3.000 nei giorni pieni, 2.700 nel richiamo, 2.450-2.550 a riposo). Proteine ${Math.round(kg * 1.8)}-${Math.round(kg * 2.2)} g. Fra un mese il peso dovrebbe essere ${String(goalLo).replace('.', ',')}-${String(goalHi).replace('.', ',')} ${weightLabel()} con la vita stabile.</p>`;
}
function planTab() {
  const w = gym.week,
    day = gym.program[gym.dayIdx],
    missing = missingWeightDays(7).filter((d) => d !== ymd(new Date()) || gym.settings.weightSkips?.[d]),
    dot = w === MAX_WEEKS || day?.optional || missing.length;
  return `<button type="button" class="plan-tab" id="plan-tab" aria-label="Piano della settimana: blocco ${gym.settings.block || 1}, settimana ${w}"><span class="plan-tab-icon" aria-hidden="true">ⓘ</span><span class="plan-tab-week">S${w}</span>${dot ? '<i class="plan-tab-dot" aria-hidden="true"></i>' : ''}</button>`;
}
function openPlanPanel() {
  const w = gym.week,
    day = gym.program[gym.dayIdx],
    missing = missingWeightDays(7).filter((d) => d !== ymd(new Date()) || gym.settings.weightSkips?.[d]);
  const avg = weekWeightAvg(0),
    prevAvg = weekWeightAvg(1),
    dAvg = avg != null && prevAvg != null ? avg - prevAvg : null;
  const d = U.modal(
    U.head(`Blocco ${gym.settings.block || 1} · Settimana ${w}`) +
      `<p class="plan-dates">${U.esc(weekDates(w))} · ${MAX_WEEKS - w} ${MAX_WEEKS - w === 1 ? 'settimana' : 'settimane'} al check</p>${
        day?.optional
          ? `<div class="plan-box plan-optional"><b>${U.esc(day.short)} è opzionale</b><p>Richiamo leggero e aerobico. Se questa settimana non riesci, tocca “Salta sessione”: il programma non cambia.</p></div>`
          : ''
      }<div class="plan-box"><b>Questa settimana</b><p>${U.esc(PROGRESSION_TEXT[w] || '')}</p>${w === MAX_WEEKS ? '<button type="button" class="primary" data-plan-check>Fai il check fisico</button>' : ''}</div><div class="plan-box"><b>Peso</b><p>Media ultimi 7 giorni: ${avg != null ? `${String(U.round(weightToDisplay(avg))).replace('.', ',')} ${weightLabel()}` : '—'}${dAvg != null ? ` (${dAvg > 0 ? '+' : ''}${String(U.round(weightToDisplay(dAvg))).replace('.', ',')} sulla settimana prima)` : ''}.</p>${nutritionTargets()}${
        missing.length
          ? `<div class="plan-missing">${missing.map((x) => `<button type="button" data-weigh-day="${x}">＋ ${U.esc(dayLabel(x))}</button>`).join('')}</div>`
          : '<p class="muted">Nessun giorno mancante negli ultimi 7.</p>'
      }<button type="button" data-weigh-day="">Registra un altro giorno</button></div><details class="plan-box"><summary><b>Come funziona la scheda</b></summary><p>Ogni giorno: cardio di riscaldamento → Kegel → addominali → pesi. Tre giorni completi a settimana, il quarto è un richiamo opzionale.</p><p>Recuperi: multiarticolari pesanti 2:30 min, secondari 1:30-2 min, complementari 1-1:15 min, addominali 45-75 s. Negli esercizi a un lato il recupero parte dopo entrambi i lati.</p><p>Fuori dalla palestra punta a 8.000-10.000 passi al giorno.</p></details>`,
  );
  d.querySelectorAll('[data-weigh-day]').forEach(
    (b) =>
      (b.onclick = () => {
        d.close();
        openWeightEntry(b.dataset.weighDay || ymd(new Date()));
      }),
  );
  d.querySelector('[data-plan-check]')?.addEventListener('click', () => {
    d.close();
    openCheckForm();
  });
}
function blockCard() {
  const day = gym.program[gym.dayIdx],
    w = gym.week;
  const checkCta =
    w === MAX_WEEKS
      ? `<button type="button" class="primary" data-open-check>Fai il check fisico</button>`
      : '';
  return `<details class="card block-card"><summary><span class="block-title">Blocco ${gym.settings.block || 1} · Settimana ${w} di ${MAX_WEEKS}</span><span class="block-dates">${U.esc(weekDates(w))}</span></summary><p>${U.esc(PROGRESSION_TEXT[w] || '')}</p><p class="muted">Ogni giorno: cardio di riscaldamento → Kegel → addominali → pesi. Tre giorni completi a settimana; il quarto è un richiamo opzionale.</p><p class="muted">Recuperi: multiarticolari pesanti 2:30 min, multiarticolari secondari 1:30-2 min, complementari 1-1:15 min, addominali 45-75 s. Negli esercizi a un lato il recupero parte dopo aver fatto entrambi i lati.</p><p class="muted">Vita sedentaria: fuori dalla palestra punta a 8.000-10.000 passi al giorno, aiuta la ricomposizione più di altro cardio.</p>${checkCta}</details>${
    day?.optional
      ? `<div class="card optional-day-note"><b>Giorno opzionale</b><p class="muted">Richiamo leggero e aerobico. Se questa settimana non riesci, tocca “Salta sessione”: non cambia nulla per il programma.</p></div>`
      : ''
  }`;
}
function blockDonePanel() {
  const lastCheck = (gym.checks || []).at(-1),
    recent = lastCheck && Date.now() - new Date(lastCheck.date).getTime() < 14 * 864e5;
  return `<div class="card block-done"><span class="eyebrow">Blocco ${gym.settings.block || 1} completato</span><h2>🎯 Hai chiuso le 8 settimane</h2><p>Per generare i prossimi 2 mesi serve il check fisico: peso, misure e come ti senti. In base ai dati l'app prepara il nuovo blocco.</p>${
    recent
      ? `<p class="muted">Ultimo check: ${U.date(lastCheck.date)}.</p><div class="actions"><button type="button" class="primary" data-generate-block>Genera i prossimi 2 mesi</button><button type="button" data-open-check>Nuovo check</button></div>`
      : `<button type="button" class="primary" data-open-check>Fai il check fisico</button>`
  }</div>`;
}
const closedGroups = new Set();
const GROUP_ICONS = { Addominali: '🔥', Spalle: '🏋️', Braccia: '💪', Gambe: '🦵', Petto: '🫁', Schiena: '🔙', Glutei: '🍑', Cardio: '🏃' };
function muscleGroup(e) {
  const n = (e?.name || '').toLowerCase();
  if (e?.move === 'kegel') return '';
  if (e?.move === 'core') return 'Addominali';
  if (isCardio(e)) return 'Cardio';
  if (/alzate|lento|arnold|military|face pull/.test(n)) return 'Spalle';
  if (/curl(?! sdraiato)|push down|french|tricipiti|bicipiti|dip/.test(n) && !/leg curl/.test(n)) return 'Braccia';
  if (/leg press|affondi|leg extension|leg curl|squat|calf/.test(n)) return 'Gambe';
  if (/hip thrust|stacco/.test(n)) return 'Glutei';
  if (/panca|croci|chest/.test(n)) return 'Petto';
  if (/lat machine|rematore|pulley|trazioni/.test(n)) return 'Schiena';
  return '';
}
function workout() {
  const s = active(),
    closed = !s ? closedCurrent() : null;
  const top = `${weightReminder()}`;
  if (!s && gym.settings.blockDone)
    return `<div class="scroll-collapse-sentinel" data-collapse-sentinel aria-hidden="true"></div>${weightReminder()}${blockDonePanel()}`;
  if (closed)
    return `<div class="scroll-collapse-sentinel" data-collapse-sentinel aria-hidden="true"></div>${top}${closedSessionPanel(closed)}`;
  if (s && sessionAllDone(s))
    return `<div class="scroll-collapse-sentinel" data-collapse-sentinel aria-hidden="true"></div><section class="closed-session-complete-head active-complete-head"><div><span class="eyebrow">Giornata completata</span><strong>✓ Tutto completato</strong><p>Hai completato tutti gli esercizi. Controlla il riepilogo e salva la sessione.</p></div><div class="closed-session-actions active-complete-actions"><button id="finish-active-complete" class="primary">■ Termina e salva</button></div></section>${closedSessionSummary(s)}`;
  const ex = s ? s.exercises : freshExercises(),
    next = ex.findIndex((e) => exStatus(e) !== 'Completato' && !e.stopped),
    current = [],
    completed = [],
    skipped = [];
  const currentItems = [];
  ex.forEach((e, i) => {
    if (exStatus(e) === 'Completato') completed.push(exerciseCard(e, i, s, i === next));
    else if (e.stopped) skipped.push(exerciseCard(e, i, s, i === next));
    else currentItems.push({ i, e, html: exerciseCard(e, i, s, i === next) });
  });
  // Esercizi consecutivi dello stesso gruppo muscolare (es. due di addominali) in un unico pannello richiudibile.
  for (let k = 0; k < currentItems.length; ) {
    const g = muscleGroup(currentItems[k].e);
    let j = k + 1;
    while (j < currentItems.length && g && muscleGroup(currentItems[j].e) === g && currentItems[j].i === currentItems[j - 1].i + 1) j++;
    if (g && j - k >= 2) {
      const items = currentItems.slice(k, j),
        key = `${context()}|${items[0].i}`,
        doneSets = items.reduce((t, x) => t + totals(x.e).done, 0),
        allSets = items.reduce((t, x) => t + x.e.rows.length, 0),
        open = !closedGroups.has(key);
      current.push(
        `<details class="card ex-group" data-group-key="${U.esc(key)}" ${open ? 'open' : ''}><summary><span class="ex-group-icon" aria-hidden="true">${GROUP_ICONS[g] || '•'}</span><span class="ex-group-title"><b>${U.esc(g)}</b><small>${items.length} esercizi · ${doneSets}/${allSets} serie</small></span><span class="ex-group-chev" aria-hidden="true">▾</span></summary><div class="ex-group-body">${items.map((x) => x.html).join('')}</div></details>`,
      );
    } else current.push(...currentItems.slice(k, j).map((x) => x.html));
    k = j;
  }
  const topActions = !s
    ? `<div class="workout-top-actions session-action-row"><button id="start-session-inline" class="start-session-inline">▶ Avvia sessione</button><button id="skip-session" class="skip-session-page">↷ Salta sessione</button></div>`
    : `<div class="workout-top-actions session-action-row active-session-actions"><span id="session-clock" class="inline-session-clock" aria-label="Tempo totale sessione">${U.duration(elapsed(s))}</span><button id="pause-session-inline" class="pause-session-inline">${s.runningSince ? 'Ⅱ Pausa' : '▶ Riprendi'}</button><button id="finish-session-inline" class="finish-session-inline">■ Termina</button></div>`;
  return `<div class="scroll-collapse-sentinel" data-collapse-sentinel aria-hidden="true"></div>${top}${topActions}${current.join('')}${completed.length ? `<details class="card completed-section" open><summary>✓ Completati · ${completed.length}</summary>${completed.join('')}</details>` : ''}${skipped.length ? `<details class="card skipped-section" open><summary>↷ Saltati / interrotti · ${skipped.length}</summary>${skipped.join('')}</details>` : ''}${!ex.length ? '<div class="card empty">Scheda vuota: aggiungi un esercizio dalla modifica scheda.</div>' : ''}`;
}
function bindWorkout() {
  main.querySelectorAll('[data-exercise-toggle]').forEach((b) => {
    const toggle = () => {
      const i = Number(b.dataset.exerciseToggle),
        e = (active()?.exercises || freshExercises())[i];
      if (!e) return;
      const key = exerciseExpandKey(e, i);
      if (expandedExerciseKeys.has(key)) expandedExerciseKeys.delete(key);
      else expandedExerciseKeys.add(key);
      render();
    };
    b.onclick = toggle;
    b.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    };
  });
  document
    .getElementById('restore-skipped-session')
    ?.addEventListener('click', () => restoreSkippedSession(closedCurrent()?.id));
  document.getElementById('edit-closed-session')?.addEventListener('click', () => {
    const s = closedCurrent();
    if (s) editClosedSession(s.id, sessionHasIncomplete(s) || !!s.archivedIncomplete);
  });
  document.getElementById('complete-closed-session')?.addEventListener('click', () => {
    const s = closedCurrent();
    if (s) reopenClosedSession(s.id);
  });
  document.getElementById('archive-closed-session')?.addEventListener('click', () => {
    const s = closedCurrent();
    if (s) archiveIncompleteSession(s.id);
  });
  document.getElementById('finish-active-complete')?.addEventListener('click', () => {
    const s = active();
    if (s) finishSession(s.id);
  });
  document.getElementById('start-session-inline')?.addEventListener('click', () => sessionAction('toggle'));
  document.getElementById('pause-session-inline')?.addEventListener('click', () => sessionAction('toggle'));
  document.getElementById('finish-session-inline')?.addEventListener('click', () => sessionAction('end'));
  document.getElementById('skip-session')?.addEventListener('click', skipSession);
  document.getElementById('resume-open')?.addEventListener('click', () => {
    const s = active();
    reopenIds.delete(s.id);
    render();
  });
  main.querySelectorAll('[data-row]').forEach((inp) => {
    const persist = () => {
      const [i, j, f] = inp.dataset.row.split(':');
      if (!saveRow(Number(i), Number(j), f, inp.value)) render();
      else header();
    };
    inp.onchange = persist;
    inp.onblur = persist;
  });
  main.querySelectorAll('[data-complete]').forEach(
    (b) =>
      (b.onclick = async () => {
        const [i, j] = b.dataset.complete.split(':').map(Number),
          s = ensureSession();
        if (!s) return;
        const e = s.exercises[i],
          row = e.rows[j];
        if (!row.done && row.reps == null) {
          U.toast('Inserisci le ripetizioni effettive (o i minuti) prima di completare la serie.');
          return;
        }
        const done = !row.done;
        if (
          mutate((n) => {
            const x = n.sessions.find((x) => x.id === s.id).exercises[i];
            x.rows[j].done = done;
            x.rows[j].legacy = false;
            x.stopped = false;
            if (done && x.rest > 0)
              n.rest = { end: Date.now() + x.rest * 1000, name: x.name, sessionId: s.id };
          })
        ) {
          render();
          updateRest();
        }
      }),
  );
  main.querySelectorAll('[data-complete-all]').forEach(
    (b) =>
      (b.onclick = () => {
        const i = Number(b.dataset.completeAll),
          s = ensureSession();
        if (!s) return;
        const e = s.exercises[i],
          missing = e.rows.filter((r) => r.reps == null);
        if (missing.length) {
          U.toast('Inserisci ripetizioni o minuti mancanti prima di completare tutte le serie.');
          return;
        }
        if (e.rows.every((r) => r.done)) {
          U.toast('Tutte le serie sono già completate.');
          return;
        }
        if (
          mutate((n) => {
            const x = n.sessions.find((x) => x.id === s.id).exercises[i];
            x.rows.forEach((r) => {
              r.done = true;
              r.legacy = false;
            });
            x.stopped = false;
            if (x.rest > 0) n.rest = { end: Date.now() + x.rest * 1000, name: x.name, sessionId: s.id };
          })
        ) {
          render();
          updateRest();
        }
      }),
  );
  main.querySelectorAll('[data-series-add]').forEach(
    (b) =>
      (b.onclick = () => {
        const s = ensureSession();
        if (!s) return;
        const i = Number(b.dataset.seriesAdd);
        if (
          mutate((n) => {
            const e = n.sessions.find((x) => x.id === s.id).exercises[i];
            e.rows.push(blankSeriesRow(e));
            e.stopped = false;
          })
        ) {
          render();
          U.toast('Serie aggiunta.');
        }
      }),
  );
  main.querySelectorAll('[data-series-remove]').forEach(
    (b) =>
      (b.onclick = async () => {
        const s = active();
        if (!s) return;
        const i = Number(b.dataset.seriesRemove),
          e = s.exercises[i];
        if (e.rows.length <= 1) {
          U.toast('Ogni esercizio deve avere almeno una serie.');
          return;
        }
        const last = e.rows.at(-1);
        if (
          seriesRowHasData(last) &&
          !(await U.ask('L’ultima serie contiene dati. Vuoi eliminarla?', { ok: 'Elimina serie' }))
        )
          return;
        if (
          mutate((n) => {
            const x = n.sessions.find((x) => x.id === s.id).exercises[i];
            x.rows.pop();
            x.stopped = x.rows.some((r) => !r.done) && x.stopped;
          })
        ) {
          render();
          U.toast('Serie rimossa.');
        }
      }),
  );
  main.querySelectorAll('[data-skip]').forEach(
    (b) =>
      (b.onclick = () => {
        const s = ensureSession();
        if (
          s &&
          mutate((n) => {
            const e = n.sessions.find((x) => x.id === s.id).exercises[Number(b.dataset.skip)];
            e.stopped = !e.stopped;
          })
        )
          render();
      }),
  );
  main.querySelectorAll('[data-info]').forEach(
    (b) =>
      (b.onclick = () => {
        const e = (active()?.exercises || freshExercises())[Number(b.dataset.info)];
        showExerciseInfo(e);
      }),
  );
  main.querySelectorAll('[data-alt]').forEach(
    (b) =>
      (b.onclick = () => {
        const e = (active()?.exercises || freshExercises())[Number(b.dataset.alt)];
        showExerciseAlternatives(e);
      }),
  );
  main.querySelectorAll('[data-note]').forEach(
    (b) =>
      (b.onclick = () => {
        const i = Number(b.dataset.note),
          e = (active()?.exercises || freshExercises())[i],
          d = U.modal(
            U.head('Note esercizio') +
              `<form class="note-form"><label for="exercise-note">Le tue note</label><textarea id="exercise-note" name="note" rows="5">${U.esc(e.note || gym.notes[e.id] || '')}</textarea><button class="primary">Salva</button></form>`,
          );
        d.querySelector('form').onsubmit = (event) => {
          event.preventDefault();
          const note = U.cleanText(new FormData(event.target).get('note'), 2000);
          if (
            mutate((n) => {
              n.notes[e.id] = note;
              const x = n.sessions.find((x) => x.id === active()?.id);
              if (x) x.exercises[i].note = note;
            })
          ) {
            d.close();
            render();
          }
        };
      }),
  );
}
function restSave(change) {
  if (mutate((n) => change(n))) {
    updateRest();
    return true;
  }
  return false;
}
function updateRest() {
  const bar = document.getElementById('rest-bar'),
    r = gym.rest;
  if (!r) {
    bar.hidden = true;
    return;
  }
  const paused = r.remaining != null,
    remain = Math.max(0, Math.ceil((paused ? r.remaining : r.end - Date.now()) / 1000));
  bar.hidden = false;
  bar.innerHTML = `<div class="row"><span><b>${paused ? 'In pausa · ' : ''}${remain ? (remain >= 60 ? `${Math.floor(remain / 60)}:${String(remain % 60).padStart(2, '0')}` : remain + 's') : 'Recupero terminato'}</b><small style="display:block">${U.esc(r.name)}</small></span><div class="actions"><button data-rest-adjust="-15">−15s</button><button data-rest-adjust="15">+15s</button><button id="rest-close">${remain ? 'Salta' : 'Chiudi'}</button></div></div>`;
  bar.querySelectorAll('[data-rest-adjust]').forEach(
    (b) =>
      (b.onclick = () =>
        restSave((n) => {
          const delta = Number(b.dataset.restAdjust) * 1000;
          if (n.rest.remaining != null) n.rest.remaining = Math.max(0, n.rest.remaining + delta);
          else n.rest.end = Math.max(Date.now(), n.rest.end + delta);
          n.rest.notified = false;
        })),
  );
  bar.querySelector('#rest-close').onclick = () => restSave((n) => (n.rest = null));
  if (paused) return;
  if (remain === 0 && !r.notified)
    mutate((n) => {
      if (n.rest) n.rest.notified = true;
    });
}
function editSession(id) {
  const source = gym.sessions.find((s) => s.id === id);
  if (!source) return;
  const d = U.modal(
    U.head('Correggi sessione') +
      `<form><details class="time-correction"><summary>Orari registrati automaticamente · modifica facoltativa</summary><label>Inizio</label><input name="start" type="datetime-local" ${source.started ? 'required' : ''} value="${source.started ? U.local(new Date(source.started)) : ''}"><label>Fine (vuoto = sessione in pausa)</label><input name="end" type="datetime-local" value="${source.ended ? U.local(new Date(source.ended)) : ''}"><label>Durata effettiva in minuti, escluse pause</label><input name="duration" type="number" min="0" step="0.01" value="${U.round(elapsed(source) / 60000)}" required><p class="muted">Modificando gli orari la durata si aggiorna; puoi correggerla per escludere le pause. I dati storici senza ripetizioni restano vuoti.</p></details>${source.exercises.map((e, i) => `<details class="card"><summary>${U.esc(e.name)}</summary><label>Interrotto / saltato</label><select data-stopped="${i}"><option value="false">No</option><option value="true" ${e.stopped ? 'selected' : ''}>Sì</option></select>${seriesInputs(e, i, true)}</details>`).join('')}<p class="error" id="error"></p><div class="actions"><button class="primary">Salva correzioni</button><button type="button" class="danger" id="delete-session">Elimina sessione</button></div></form>`,
  );
  const f = d.querySelector('form');
  const dates = () => {
    if (f.elements.start.value && f.elements.end.value)
      f.elements.duration.value = Math.max(
        0,
        U.round((new Date(f.elements.end.value) - new Date(f.elements.start.value)) / 60000),
      );
  };
  f.elements.start.onchange = dates;
  f.elements.end.onchange = dates;
  f.onsubmit = (event) => {
    event.preventDefault();
    const n = U.clone(source),
      start = f.elements.start.value,
      end = f.elements.end.value;
    n.started =
      start === (source.started ? U.local(new Date(source.started)) : '')
        ? source.started
        : start
          ? new Date(start).toISOString()
          : null;
    n.ended =
      end === (source.ended ? U.local(new Date(source.ended)) : '')
        ? source.ended
        : end
          ? new Date(end).toISOString()
          : null;
    n.elapsed =
      f.elements.duration.value === String(U.round(elapsed(source) / 60000))
        ? elapsed(source)
        : Number(f.elements.duration.value) * 60000;
    n.runningSince = null;
    if (n.ended && (!n.started || new Date(n.ended) < new Date(n.started)))
      return (d.querySelector('#error').textContent = 'Controlla gli orari.');
    if (n.ended && n.elapsed > new Date(n.ended) - new Date(n.started) + 1000)
      return (d.querySelector('#error').textContent =
        'La durata effettiva supera l’intervallo tra inizio e fine.');
    d.querySelectorAll('[data-edit-row]').forEach((inp) => {
      const [i, j, key] = inp.dataset.editRow.split(':');
      let val = parseGymNumber(inp.value);
      if (key === 'weight' && val !== null && !Number.isNaN(val)) val = weightFromDisplay(val);
      n.exercises[i].rows[j][key] = val;
    });
    d.querySelectorAll('[data-edit-done]').forEach((inp) => {
      const [i, j] = inp.dataset.editDone.split(':');
      n.exercises[i].rows[j].done = inp.checked;
    });
    d.querySelectorAll('[data-stopped]').forEach(
      (inp) => (n.exercises[Number(inp.dataset.stopped)].stopped = inp.value === 'true'),
    );
    if (
      mutate((g) => {
        g.sessions = g.sessions.map((s) => (s.id === id ? n : s));
        n.exercises.forEach((e, i) =>
          e.rows.forEach((r, j) =>
            ['weight', 'reps', 'speed', 'incline'].forEach((key) => {
              if (r[key] !== source.exercises[i].rows[j][key]) {
                g.exerciseValues ??= {};
                g.exerciseValues[e.id] ??= U.clone(rememberedRows(e));
                g.exerciseValues[e.id][j] ??= {};
                g.exerciseValues[e.id][j][key] = r[key];
              }
            }),
          ),
        );
        if (g.rest?.sessionId === id) g.rest = null;
        if (!source.ended && n.ended)
          advanceWorkoutPosition(g, n.week || g.week, sessionDayIndex(n, g.program));
      })
    ) {
      reopenIds.delete(id);
      d.close();
      render();
    }
  };
  d.querySelector('#delete-session').onclick = async () => {
    if (
      (await U.ask('Eliminare definitivamente questa sessione?', { ok: 'Elimina' })) &&
      mutate((n) => {
        n.sessions = n.sessions.filter((s) => s.id !== id);
        if (n.rest?.sessionId === id) n.rest = null;
      })
    ) {
      d.close();
      render();
    }
  };
}
function programEditor() {
  if (active()) {
    U.toast('Termina la sessione prima di modificare la scheda.');
    return;
  }
  let draft = U.clone(gym.program[gym.dayIdx]);
  const draw = () => {
    const d = U.modal(
      U.head('Modifica scheda') +
        `<p class="muted">Le modifiche si applicano a tutte le settimane e ai prossimi cicli. Lo storico resta invariato. Sostituisci crea un nuovo esercizio; Modifica mantiene carichi e identità.</p>${draft.exercises.map((e, i) => `<div class="card"><b>${U.esc(e.name)}</b><div class="actions"><button data-up="${i}" ${i === 0 ? 'disabled' : ''}>↑</button><button data-down="${i}" ${i === draft.exercises.length - 1 ? 'disabled' : ''}>↓</button><button data-ex-edit="${i}">Modifica</button><button data-replace="${i}">Sostituisci</button><button class="danger" data-ex-delete="${i}">Rimuovi</button></div></div>`).join('')}<div class="actions"><button id="add-ex">＋ Esercizio</button><button class="primary" id="save-program">Salva scheda</button></div>`,
    );
    d.querySelectorAll('[data-up],[data-down]').forEach(
      (b) =>
        (b.onclick = () => {
          const i = Number(b.dataset.up ?? b.dataset.down),
            j = i + (b.dataset.up !== undefined ? -1 : 1);
          [draft.exercises[i], draft.exercises[j]] = [draft.exercises[j], draft.exercises[i]];
          draw();
        }),
    );
    d.querySelectorAll('[data-ex-delete]').forEach(
      (b) =>
        (b.onclick = () => {
          draft.exercises.splice(Number(b.dataset.exDelete), 1);
          draw();
        }),
    );
    d.querySelectorAll('[data-ex-edit],[data-replace]').forEach(
      (b) =>
        (b.onclick = () =>
          form(Number(b.dataset.exEdit ?? b.dataset.replace), b.dataset.replace !== undefined)),
    );
    d.querySelector('#add-ex').onclick = () => form(-1, false);
    d.querySelector('#save-program').onclick = () => {
      if (mutate((n) => (n.program[n.dayIdx] = draft))) {
        d.close();
        render();
      }
    };
  };
  const form = (i, replace) => {
    const e =
      i >= 0 && !replace
        ? draft.exercises[i]
        : { id: U.uid(), name: '', sets: 3, reps: '10', rest: 60, unit: 'reps', move: '', note: '' };
    const d = U.modal(
      U.head(replace ? 'Sostituisci esercizio' : 'Esercizio') +
        `<form><label>Nome</label><input name="name" required maxlength="160" value="${U.esc(e.name)}"><div class="grid"><div><label>Serie</label><input name="sets" type="number" min="1" max="30" required value="${e.sets}"></div><div><label>Obiettivo ripetizioni / minuti</label><input name="reps" required value="${U.esc(e.reps)}"></div></div><label>Misura</label><select name="unit"><option value="reps">Ripetizioni</option><option value="min" ${e.unit === 'min' ? 'selected' : ''}>Minuti</option></select><label>Recupero (secondi)</label><input name="rest" type="number" min="0" max="1800" required value="${e.rest}"><label>Una serie in meno nella settimana di scarico (settimana 8)</label><select name="compound"><option value="false">No</option><option value="true" ${e.compound ? 'selected' : ''}>Sì</option></select><label>Attrezzatura / impugnatura</label><input name="equipment" value="${U.esc(equipment(e))}"><label>Istruzioni</label><textarea name="note">${U.esc(e.note || '')}</textarea><div class="actions"><button class="primary">Conferma</button><button type="button" id="cancel-ex">Indietro</button></div></form>`,
    );
    d.querySelector('#cancel-ex').onclick = draw;
    d.querySelector('form').onsubmit = (event) => {
      event.preventDefault();
      const f = new FormData(event.target),
        obj = {
          ...e,
          name: U.cleanText(f.get('name'), 160).trim(),
          sets: Number(f.get('sets')),
          reps: U.cleanText(f.get('reps'), 80),
          rest: Number(f.get('rest')),
          unit: f.get('unit'),
          compound: f.get('compound') === 'true',
          note: U.cleanText(f.get('note'), 2000),
          equipment: U.cleanText(f.get('equipment'), 200),
        };
      if (!obj.name) return;
      if (i < 0) draft.exercises.push(obj);
      else draft.exercises[i] = obj;
      draw();
    };
  };
  draw();
}
function trendChart(points, label, unit = '') {
  if (!points.length) return '<div class="empty">Nessun dato disponibile.</div>';
  const values = points.map((p) => Number(p.value)).filter(Number.isFinite);
  if (!values.length) return '<div class="empty">Nessun dato disponibile.</div>';
  let lo = Math.min(...values),
    hi = Math.max(...values);
  const span = Math.max(hi - lo, Math.max(Math.abs(hi) * 0.03, 1)),
    pad = span * 0.18;
  lo -= pad;
  hi += pad;
  const first = Date.parse(points[0].date),
    last = Date.parse(points.at(-1).date),
    pos = points.map((p) => ({
      x: last === first ? 190 : 48 + ((Date.parse(p.date) - first) / (last - first)) * 290,
      y: 150 - ((p.value - lo) / (hi - lo)) * 120,
    }));
  return `<div class="trend-chart-wrap"><h3>${U.esc(label)}</h3><svg class="touch-chart trend-chart" viewBox="0 0 380 190" role="img" aria-label="${U.esc(label)}"><path d="M48 20V150H350" fill="none" stroke="#52616c"/><text x="2" y="30">${U.round(hi)}${unit ? ' ' + U.esc(unit) : ''}</text><text x="2" y="153">${U.round(lo)}${unit ? ' ' + U.esc(unit) : ''}</text><polyline points="${pos.map((p) => p.x + ',' + p.y).join(' ')}" fill="none" stroke="#55c3a7" stroke-width="3"/>${pos.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="5" fill="#e8a33d"/>`).join('')}<text x="48" y="180">${new Date(points[0].date).toLocaleDateString('it-IT')}</text><text x="350" y="180" text-anchor="end">${new Date(points.at(-1).date).toLocaleDateString('it-IT')}</text></svg></div>`;
}
function bodyWeightPage() {
  const rows = (gym.bodyWeights || []).slice().sort((a, b) => new Date(a.date) - new Date(b.date));
  chartPoints = rows.map((x) => ({
    date: x.date,
    value: weightUnit() === 'lb' ? x.kg * 2.2046226218 : x.kg,
    detail: `${U.date(x.date)} · ${U.round(weightUnit() === 'lb' ? x.kg * 2.2046226218 : x.kg)} ${weightLabel()}`,
  }));
  const first = chartPoints[0]?.value,
    last = chartPoints.at(-1)?.value,
    delta = first != null && last != null ? last - first : null;
  return `${statsTabs()}<div class="card body-weight-entry"><h2>Peso</h2><form id="body-weight-form"><label>Giorno</label><input name="day" type="date" max="${ymd(new Date())}" value="${ymd(new Date())}" required><label>Peso (${weightLabel()})</label><input name="weight" type="number" min="0" step="0.1" inputmode="decimal" required><button class="primary weight-save">Salva peso</button></form></div><div class="card weight-chart-card"><div class="stats-section-head"><h2>Evoluzione del peso</h2>${delta != null && chartPoints.length > 1 ? `<span class="weight-delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}">${delta > 0 ? '+' : ''}${U.round(delta)} ${weightLabel()}</span>` : ''}</div>${trendChart(chartPoints, 'Peso nel tempo', weightLabel())}</div>${
    rows
      .slice()
      .reverse()
      .map(
        (x) =>
          `<div class="card row"><span>${U.date(x.date)}</span><b>${U.round(weightUnit() === 'lb' ? x.kg * 2.2046226218 : x.kg)} ${weightLabel()}</b><button class="danger" data-weight-delete="${U.esc(x.id)}" aria-label="Elimina peso del ${U.date(x.date)}">Elimina</button></div>`,
      )
      .join('') || '<div class="card empty">Nessun peso registrato.</div>'
  }`;
}
function stats() {
  if (statsView === 'sessions') return sessionsPage();
  if (statsView === 'weight') return bodyWeightPage();
  const names = new Map(gym.program.flatMap((d) => d.exercises).map((e) => [e.id, e.name]));
  gym.sessions.forEach((s) => s.exercises.forEach((e) => names.set(e.id, e.name)));
  if (!names.has(selectedExercise)) selectedExercise = names.keys().next().value || '';
  const selectedModel =
    gym.program.flatMap((d) => d.exercises).find((e) => e.id === selectedExercise) ||
    gym.sessions.flatMap((s) => s.exercises).find((e) => e.id === selectedExercise);
  const cardio = selectedModel && isCardio(selectedModel);
  if (cardio && ['weight', 'volume'].includes(metric)) metric = 'speed';
  if (!cardio && ['speed', 'incline'].includes(metric)) metric = 'weight';
  const shown = gym.sessions.filter(
    (s) => !selectedDay || (s.started && U.local(new Date(s.started)).slice(0, 10) === selectedDay),
  );
  const rows = shown
    .flatMap((s) => s.exercises.filter((e) => e.id === selectedExercise).map((e) => ({ s, e })))
    .sort((a, b) => new Date(a.s.started || 0) - new Date(b.s.started || 0));
  chartPoints = rows
    .filter(({ s, e }) => s.started && totals(e).done > 0)
    .map(({ s, e }) => {
      const t = totals(e),
        value = metric === 'frequency' ? 1 : metric === 'done' ? t.done : t[metric];
      if (metric === 'weight' && value != null && weightUnit() === 'lb') value *= 2.2046226218;
      if (metric === 'volume' && value != null && weightUnit() === 'lb') value *= 2.2046226218;
      return {
        date: s.started,
        value,
        detail: `${U.date(s.started)} · ${e.name} · ${value == null ? 'Non rilevato' : U.round(value)} ${metric === 'speed' ? 'km/h' : metric === 'incline' ? '%' : metric === 'weight' ? weightLabel() : metric === 'volume' ? weightLabel() + ' × rip.' : metric === 'reps' ? (e.unit === 'min' || isCardio(e) ? 'min' : 'rip.') : metric === 'frequency' ? 'sessione' : 'serie'}${metric === 'volume' && t.partialVolume ? ' (solo serie con dati completi)' : ''}`,
      };
    })
    .filter((p) => p.value !== null);
  if (metric === 'frequency') {
    const grouped = new Map();
    chartPoints.forEach((p) => {
      const key = U.local(new Date(p.date)).slice(0, 10);
      grouped.set(key, (grouped.get(key) || 0) + 1);
    });
    chartPoints = [...grouped].map(([day, value]) => ({
      date: day + 'T12:00:00',
      value,
      detail: `${day}: ${value} sessioni con questo esercizio`,
    }));
  }
  const closed = gym.sessions.filter((s) => s.ended),
    last30 = closed.filter((s) => s.started && Date.now() - new Date(s.started).getTime() <= 30 * 86400000),
    setCount = last30.reduce((n, s) => n + sessionCounts(s).sets, 0),
    minutes = Math.round(last30.reduce((n, s) => n + elapsed(s), 0) / 60000),
    recent = closed
      .slice()
      .sort((a, b) => new Date(b.started || 0) - new Date(a.started || 0))
      .slice(0, 4);
  return `${statsTabs()}<section class="stats-overview"><p class="stats-kpi-caption">Ultimi 30 giorni</p><div class="stats-kpi"><b>${last30.length}</b><small>Allenamenti</small></div><div class="stats-kpi"><b>${setCount}</b><small>Serie svolte</small></div><div class="stats-kpi"><b>${minutes}</b><small>Minuti</small></div></section><div class="card stats-focus"><div class="row"><div><h2>Progressi esercizio</h2><p class="muted">Scegli un esercizio e guarda un solo indicatore alla volta.</p></div></div><label>Esercizio</label><select id="stats-exercise">${[...names].map(([id, name]) => `<option value="${U.esc(id)}" ${id === selectedExercise ? 'selected' : ''}>${U.esc(name)}</option>`).join('')}</select><label>Indicatore</label><select id="stats-metric">${[
    ...(cardio
      ? [
          ['speed', 'Velocità massima (km/h)'],
          ['incline', 'Pendenza massima (%)'],
        ]
      : [
          ['weight', `Carico massimo (${weightLabel()})`],
          ['volume', `Volume (${weightLabel()} × ripetizioni)`],
        ]),
    ['reps', cardio ? 'Minuti effettivi' : 'Ripetizioni effettive'],
    ['done', 'Serie svolte'],
    ['frequency', 'Frequenza'],
  ]
    .map(([v, l]) => `<option value="${v}" ${metric === v ? 'selected' : ''}>${l}</option>`)
    .join(
      '',
    )}</select>${U.chart(chartPoints, 'Andamento esercizio')}</div><details class="card stats-filter"><summary>Filtra per data ${selectedDay ? '· ' + selectedDay : ''}</summary><label for="session-day">Mostra una data specifica</label><input id="session-day" type="date" value="${selectedDay}"><button id="all-days">Mostra tutto lo storico</button></details><div class="stats-section-head"><h2>Ultime sessioni</h2><button data-stats-view="sessions">Vedi tutte</button></div>${
    recent
      .map((s) => {
        const c = sessionCounts(s);
        return `<article class="card stats-session"><div><b>${U.esc(s.day)}</b><small>${U.date(s.started)}</small></div><div class="stats-session-meta"><span>${c.sets}/${c.total} serie</span><span>${U.duration(elapsed(s))}</span></div><button data-session-summary="${U.esc(s.id)}">Riepilogo</button></article>`;
      })
      .join('') ||
    '<div class="card empty">Completa il primo allenamento per vedere qui le statistiche.</div>'
  }<details class="card stats-history"><summary>Storico di ${U.esc(names.get(selectedExercise) || 'questo esercizio')}</summary>${
    rows
      .slice()
      .reverse()
      .map(
        ({ s, e }) =>
          `<div class="stats-history-row"><div><b>${U.date(s.started)}</b><small>Ciclo ${s.cycle || 1} · Sett. ${s.week}</small></div><span>${totals(e).done}/${e.rows.length} serie</span><button data-session-edit="${U.esc(s.id)}">Dettaglio</button></div>`,
      )
      .join('') || '<p class="muted">Nessun dato ancora disponibile.</p>'
  }</details>`;
}
function mealValues(meal) {
  return [0, 1, 2, 3].map((j) =>
    meal.ingredients.reduce((n, i) => n + (gym.foods[i.food].v[j] * i.qty) / 100, 0),
  );
}
/* 1.10.0 — quantità leggibili: intere da 10 in su, una decimale (con virgola) sotto. */
function fmtQty(q) {
  const n = Number(q) || 0;
  return n >= 10 ? String(Math.round(n)) : String(Math.round(n * 10) / 10).replace('.', ',');
}
function formatMacros(vals) {
  return `${Math.round(vals[0])} kcal · P ${Math.round(vals[1])} g · C ${Math.round(vals[2])} g · G ${Math.round(vals[3])} g`;
}
function supplementTiming(icon, time, title, txt) {
  return `<div class="supplement-timing"><span class="supplement-timing-icon">${icon}</span><div><b>${U.esc(time)} · ${U.esc(title)}</b><small>${U.esc(txt)}</small></div></div>`;
}
function nutrition() {
  const key = Object.hasOwn(gym.meals, gym.foodTab) ? gym.foodTab : 'd1',
    d = gym.meals[key],
    sum = d.items.reduce((n, m) => n.map((v, j) => v + mealValues(m)[j]), [0, 0, 0, 0]),
    trainingDay = /^d[1-4]$/.test(key);
  return `<div class="scroll-collapse-sentinel" data-collapse-sentinel aria-hidden="true"></div>${weightReminder()}<div class="daytabs foodtabs">${Object.entries(
    gym.meals,
  )
    .map(([k, v], idx, all) => {
      const rest = /^r/.test(k),
        firstRest = rest && !all.slice(0, idx).some(([x]) => /^r/.test(x));
      const label = FOOD_TABS.find((t) => t.key === k)?.short || v.label;
      return `${firstRest ? '<span class="foodtabs-label" aria-hidden="true">Riposo</span>' : ''}<button data-foodtab="${k}" class="${key === k ? 'active' : ''}" aria-label="${U.esc(label)}">${U.esc(rest ? label.replace(/^Riposo\s+/, '') : label)}</button>`;
    })
    .join(
      '',
    )}</div><section class="nutrition-head"><div><span class="eyebrow">Piano del giorno${d.label.includes(' — ') ? ' · ' + U.esc(d.label.split(' — ').slice(1).join(' — ')) : ''}</span><h2>${U.esc(d.label.split(' — ')[0])}</h2><p>${formatMacros(sum)}</p></div><div class="nutrition-actions"><button id="plan-edit" class="icon-action" aria-label="Modifica piano" title="Modifica piano">✎</button><button id="shopping" class="icon-action" aria-label="Lista della spesa" title="Lista della spesa">🛒</button></div></section><div class="meal-list">${d.items
    .map((m, i) => {
      const vals = mealValues(m),
        preWorkout =
          trainingDay && i === 4
            ? supplementTiming('⚡', '18:30', 'Pre workout', 'BCAA · dose secondo etichetta')
            : '',
        workoutMarker =
          trainingDay && i === 4
            ? '<div class="workout-time-marker"><span>🏋️</span><b>19:00 · Workout</b></div>'
            : '',
        postWorkout =
          trainingDay && i === 4
            ? supplementTiming(
                '🥤',
                'Post workout',
                'Maltodestrine',
                'Quantità da definire in base al fabbisogno di carboidrati',
              )
            : '',
        omega =
          i === 5
            ? supplementTiming(
                '🐟',
                '23:00',
                'Pre nanna · Omega-3',
                'Dose secondo etichetta, considerando il contenuto di EPA + DHA',
              )
            : '',
        meal = `<details class="meal-smart"><summary class="meal-smart-head"><div><span class="meal-time">${U.esc(m.time)}</span><b>${Math.round(vals[0])} kcal</b></div><span class="meal-macros">P ${Math.round(vals[1])} · C ${Math.round(vals[2])} · G ${Math.round(vals[3])}</span></summary><div class="meal-smart-body"><div class="meal-foods">${m.ingredients.map((v) => `<span><b>${fmtQty(v.qty)} ${gym.foods[v.food].unit}</b> ${U.esc(gym.foods[v.food].name)}</span>`).join('')}</div><div class="meal-actions"><button class="meal-alternatives" data-meal-alt="${i}">↔ Alternative equivalenti</button></div></div></details>`;
      return `${i === 5 ? omega : ''}${preWorkout}${workoutMarker}${postWorkout}${meal}${i === 0 ? supplementTiming('⚡', '08:00', 'Colazione · Creatina monoidrato', '5 g ogni giorno, anche nei giorni di riposo') : ''}`;
    })
    .join(
      '',
    )}</div><details class="card nutrition-note"><summary>Note sulle quantità</summary><p class="muted">Le quantità alimentari sono espresse in grammi o millilitri. Gli integratori mostrati nel programma non sono inclusi nel calcolo dei macro.</p></details>`;
}
function foodRole(food) {
  const [, p, c, f] = food.v,
    total = p + c + f || 1;
  if (p / total >= 0.45) return 'Proteine';
  if (c / total >= 0.5) return 'Carboidrati';
  if (f / total >= 0.45) return 'Grassi';
  return 'Alternativa';
}
function mealAlternatives(index) {
  const meal = gym.meals[gym.foodTab].items[index],
    rows = meal.ingredients
      .map((ing) => {
        const src = gym.foods[ing.food],
          role = foodRole(src),
          targetKcal = (src.v[0] * ing.qty) / 100,
          candidates = Object.entries(gym.foods)
            .filter(([id, f]) => id !== ing.food && foodRole(f) === role && f.v[0] > 0)
            .map(([id, f]) => ({
              id,
              f,
              qty: (targetKcal / f.v[0]) * 100,
              diff: Math.abs(f.v[1] + f.v[2] + f.v[3] - (src.v[1] + src.v[2] + src.v[3])),
            }))
            .sort((a, b) => a.diff - b.diff)
            .slice(0, 3);
        return `<div class="alt-group"><div class="alt-source"><span>${role}</span><b>${fmtQty(ing.qty)} ${src.unit} ${U.esc(src.name)}</b></div>${candidates.length ? candidates.map((x) => `<div class="alt-row"><span>${U.esc(x.f.name)}</span><b>${Math.max(1, Math.round(x.qty / 5) * 5)} ${x.f.unit}</b></div>`).join('') : '<p class="muted">Nessuna alternativa compatibile nel catalogo.</p>'}</div>`;
      })
      .join('');
  U.modal(
    U.head('Alternative del pasto') +
      `<p class="muted">Quantità indicative calcolate per mantenere circa le stesse kcal dell’alimento sostituito. Verifica sempre il piano con il professionista che ti segue.</p>${rows}`,
  );
}
function planEditor() {
  const key = gym.foodTab,
    day = gym.meals[key],
    row = (v, mi) =>
      `<div class="ingredient" data-plan-ingredient><select class="ingredient-food">${foodOptions(v.food)}</select><div class="row"><input class="ingredient-qty" aria-label="Quantità" type="number" min="0" step="0.1" required value="${v.qty}"><button type="button" class="danger" data-plan-remove>✕</button></div></div>`;
  const d = U.modal(
    U.head('Modifica piano del giorno') +
      `<p class="muted">Modifica tutti i pasti da un’unica schermata e salva una sola volta.</p><form id="day-plan-form">${day.items.map((m, i) => `<section class="plan-meal" data-plan-meal="${i}"><label>Orario / nome pasto</label><input class="plan-time" required value="${U.esc(m.time)}"><label>Alimenti e quantità</label><div class="plan-ingredients">${m.ingredients.map((v) => row(v, i)).join('')}</div><button type="button" data-plan-add="${i}">＋ Ingrediente</button></section>`).join('')}<div class="save-center"><button class="primary">Salva piano</button></div></form>`,
  );
  const bind = () => {
    d.querySelectorAll('[data-plan-remove]').forEach(
      (b) => (b.onclick = () => b.closest('[data-plan-ingredient]').remove()),
    );
    d.querySelectorAll('[data-plan-add]').forEach(
      (b) =>
        (b.onclick = () => {
          b.parentElement
            .querySelector('.plan-ingredients')
            .insertAdjacentHTML('beforeend', row({ food: Object.keys(gym.foods)[0], qty: 100 }));
          bind();
        }),
    );
  };
  bind();
  d.querySelector('#day-plan-form').onsubmit = (e) => {
    e.preventDefault();
    const next = [...d.querySelectorAll('[data-plan-meal]')].map((section, i) => ({
      ...day.items[i],
      time: section.querySelector('.plan-time').value,
      ingredients: [...section.querySelectorAll('[data-plan-ingredient]')].map((c) => ({
        food: c.querySelector('.ingredient-food').value,
        qty: Number(c.querySelector('.ingredient-qty').value),
      })),
    }));
    if (next.some((m) => !m.ingredients.length)) {
      U.toast('Ogni pasto deve avere almeno un alimento.');
      return;
    }
    if (mutate((n) => (n.meals[key].items = next))) {
      d.close();
      render();
    }
  };
}
function foodOptions(value) {
  return Object.entries(gym.foods)
    .map(
      ([id, f]) =>
        `<option value="${U.esc(id)}" ${id === value ? 'selected' : ''}>${U.esc(f.name)} (${f.unit})</option>`,
    )
    .join('');
}
function mealEditor(index) {
  const key = gym.foodTab,
    original = gym.meals[key].items[index],
    row = (v) =>
      `<div class="ingredient"><select class="ingredient-food">${foodOptions(v.food)}</select><div class="row"><input class="ingredient-qty" aria-label="Quantità in grammi o millilitri" type="number" min="0" step="0.1" required value="${v.qty}"><button type="button" class="danger" data-remove-ingredient>✕</button></div></div>`;
  const d = U.modal(
    U.head('Modifica pasto') +
      `<form><label>Orario / nome pasto</label><input name="time" required value="${U.esc(original.time)}"><label>Ingredienti e quantità (g / ml)</label><div id="ingredients">${original.ingredients.map(row).join('')}</div><button type="button" id="add-ingredient">＋ Ingrediente</button><p id="meal-preview" class="muted"></p><div class="save-center"><button class="primary">Salva pasto</button></div></form>`,
  );
  const read = () =>
    [...d.querySelectorAll('.ingredient')].map((c) => ({
      food: c.querySelector('.ingredient-food').value,
      qty: Number(c.querySelector('.ingredient-qty').value),
    }));
  const bind = () => {
    d.querySelectorAll('[data-remove-ingredient]').forEach(
      (b) =>
        (b.onclick = () => {
          b.closest('.ingredient').remove();
          bind();
        }),
    );
    d.querySelector('#meal-preview').textContent = formatMacros(mealValues({ ingredients: read() }));
  };
  d.querySelector('#add-ingredient').onclick = () => {
    d.querySelector('#ingredients').insertAdjacentHTML(
      'beforeend',
      row({ food: Object.keys(gym.foods)[0], qty: 100 }),
    );
    bind();
  };
  d.querySelector('form').oninput = bind;
  bind();
  d.querySelector('form').onsubmit = (e) => {
    e.preventDefault();
    const next = { ...original, time: new FormData(e.target).get('time'), ingredients: read() };
    if (mutate((n) => (n.meals[key].items[index] = next))) {
      d.close();
      render();
    }
  };
}
function catalogEditor() {
  const d = U.modal(
    U.head('Alimenti e valori') +
      `<p class="muted">Valori per 100 g o 100 ml. Modificandoli aggiorni tutti i pasti che usano questo alimento.</p><select id="food-select">${foodOptions('')}</select><div class="actions"><button id="food-edit">Modifica valori</button><button id="food-add">Nuovo alimento</button></div>`,
  );
  d.querySelector('#food-edit').onclick = () => foodForm(d.querySelector('#food-select').value);
  d.querySelector('#food-add').onclick = () => foodForm(null);
}
function foodForm(id) {
  const food = gym.foods[id] || { name: '', unit: 'g', v: [0, 0, 0, 0] },
    d = U.modal(
      U.head(id ? 'Modifica alimento' : 'Nuovo alimento') +
        `<form><label>Nome</label><input name="name" required value="${U.esc(food.name)}"><label>Unità quantità</label><select name="unit"><option value="g">Grammi</option><option value="ml" ${food.unit === 'ml' ? 'selected' : ''}>Millilitri</option></select>${['kcal', 'Proteine', 'Carboidrati', 'Grassi'].map((x, i) => `<label>${x} per 100 g / ml</label><input name="v${i}" type="number" min="0" step="0.1" required value="${food.v[i]}">`).join('')}<div class="save-center"><button class="primary">Salva alimento</button></div></form>`,
    );
  d.querySelector('form').onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    if (
      mutate(
        (n) =>
          (n.foods[id || U.uid()] = {
            name: f.get('name'),
            unit: f.get('unit'),
            v: [0, 1, 2, 3].map((i) => Number(f.get('v' + i))),
          }),
      )
    ) {
      d.close();
      render();
    }
  };
}
function shopping() {
  const d = U.modal(
    U.head('Lista della spesa') +
      `<p class="muted">Seleziona le giornate da sommare. Ogni giornata selezionata conta una volta.</p>${Object.entries(
        gym.meals,
      )
        .map(
          ([k, m]) =>
            `<label class="row"><span>${U.esc(m.label)}</span><input style="width:auto" type="checkbox" data-shop="${k}" ${k === gym.foodTab ? 'checked' : ''}></label>`,
        )
        .join('')}<div id="shopping-list"></div>`,
  );
  const update = () => {
    const sum = {};
    d.querySelectorAll('[data-shop]:checked').forEach((c) =>
      gym.meals[c.dataset.shop].items.forEach((m) =>
        m.ingredients.forEach((i) => (sum[i.food] = (sum[i.food] || 0) + i.qty)),
      ),
    );
    d.querySelector('#shopping-list').innerHTML =
      '<hr>' +
      Object.entries(sum)
        .sort((a, b) => gym.foods[a[0]].name.localeCompare(gym.foods[b[0]].name))
        .map(
          ([k, q]) =>
            `<label class="row"><span>${U.esc(gym.foods[k].name)} · ${fmtQty(q)} ${gym.foods[k].unit}</span><input type="checkbox" style="width:auto" aria-label="Acquistato"></label>`,
        )
        .join('');
  };
  d.querySelectorAll('[data-shop]').forEach((c) => (c.onchange = update));
  update();
}
/* ---------- 1.12.0: check fisico e generazione del blocco successivo ---------- */
const CHECK_FIELDS = [
  ['kg', 'Peso', 'kg', 'A digiuno, al mattino'],
  ['waist', 'Vita', 'cm', "All'altezza dell'ombelico, a fine espirazione"],
  ['hips', 'Fianchi', 'cm', 'Nel punto più largo dei glutei'],
  ['chest', 'Petto', 'cm', "All'altezza dei capezzoli, braccia rilassate"],
  ['arm', 'Braccio', 'cm', 'Destro, rilassato, a metà tra spalla e gomito'],
  ['thigh', 'Coscia', 'cm', 'Destra, a metà tra anca e ginocchio'],
];
function checksCard() {
  const list = (gym.checks || []).slice().reverse();
  const row = (c, prev) =>
    `<div class="check-row"><b>${U.date(c.date)}</b><span>${CHECK_FIELDS.filter(([k]) => c[k] != null)
      .map(([k, l, u]) => {
        const d = prev && prev[k] != null ? U.round(c[k] - prev[k]) : null;
        return `${l} ${String(U.round(c[k])).replace('.', ',')} ${u}${d ? ` <small class="${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : ''}${String(d).replace('.', ',')}</small>` : ''}`;
      })
      .join(' · ')}</span></div>`;
  return `<div class="card check-card"><h2>Check fisico</h2><p class="muted">Blocco ${gym.settings.block || 1} · iniziato il ${new Date(gym.settings.blockStart + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}. Alla fine delle 8 settimane il check fisico sblocca i 2 mesi successivi.</p>${list.map((c, i) => row(c, list[i + 1])).join('') || '<p class="muted">Nessun check registrato.</p>'}<button type="button" data-open-check>Nuovo check fisico</button></div>`;
}
function openCheckForm() {
  const today = ymd(new Date()),
    w = (gym.bodyWeights || []).find((x) => localDay(x.date) === today);
  const d = U.modal(
    U.head('Check fisico') +
      `<p class="muted">Misura sempre nello stesso modo: al mattino, a digiuno, metro aderente ma non stretto. Scatta anche 3 foto (fronte, lato, schiena) con la stessa luce.</p><form id="check-form" class="check-form">${CHECK_FIELDS.map(
        ([k, l, u, h]) =>
          `<label>${l} (${u})<input name="${k}" type="number" min="0" step="0.1" inputmode="decimal" ${k === 'kg' && w ? `value="${U.round(w.kg)}"` : ''} ${k === 'kg' ? 'required' : ''}><small class="muted">${U.esc(h)}</small></label>`,
      ).join(
        '',
      )}<label>Energia in allenamento<select name="energy"><option value="3">Normale</option><option value="5">Ottima</option><option value="4">Buona</option><option value="2">Bassa</option><option value="1">Molto bassa</option></select></label><label>Ginocchio<select name="knee"><option value="ok">Nessun fastidio</option><option value="lieve">Lieve fastidio</option><option value="dolore">Dolore</option></select></label><label>Note<textarea name="notes" rows="3" placeholder="Sonno, fame, esercizi che non ti trovi bene…"></textarea></label><button class="primary">Salva check</button></form>`,
  );
  d.querySelector('#check-form').onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target),
      c = { id: U.uid(), date: new Date().toISOString(), block: gym.settings.block || 1 };
    for (const [k] of CHECK_FIELDS) {
      const v = parseGymNumber(fd.get(k));
      if (v != null && !Number.isNaN(v) && v > 0) c[k] = k === 'kg' ? weightFromDisplay(v) : v;
    }
    if (c.kg == null) {
      U.toast('Inserisci almeno il peso.');
      return;
    }
    c.energy = Number(fd.get('energy')) || 3;
    c.knee = String(fd.get('knee') || 'ok');
    c.notes = U.cleanText(fd.get('notes') || '', 1000);
    const done = gym.settings.blockDone;
    if (
      mutate((n) => {
        n.checks ??= [];
        n.checks.push(c);
        n.bodyWeights ??= [];
        if (!n.bodyWeights.some((x) => localDay(x.date) === ymd(new Date())))
          n.bodyWeights.push({ id: U.uid(), date: c.date, kg: c.kg });
      })
    ) {
      d.close();
      render();
      if (done) generateNextBlock();
      else U.toast('Check salvato. A fine settimana 8 potrai generare il nuovo blocco.');
    }
  };
}
function generateNextBlock() {
  const checks = gym.checks || [],
    last = checks.at(-1),
    prev = checks.at(-2);
  if (!last) {
    openCheckForm();
    return;
  }
  const nextBlock = (gym.settings.block || 1) + 1,
    strength = nextBlock % 2 === 0,
    changes = [];
  // Obiettivo massa pulita: peso +0,25-0,5 kg al mese con la vita stabile.
  // Peso e vita in salita insieme = troppo surplus; peso fermo o in calo con vita stabile = serve più cibo.
  const months = prev ? Math.max(0.5, (new Date(last.date) - new Date(prev.date)) / (30.4 * 864e5)) : null,
    kgMonth = prev && last.kg != null && prev.kg != null ? (last.kg - prev.kg) / months : null,
    waistDelta = prev && last.waist != null && prev.waist != null ? last.waist - prev.waist : null,
    tooFast = kgMonth != null && (kgMonth > 0.8 || (waistDelta != null && waistDelta > 1.5)),
    tooSlow = kgMonth != null && kgMonth < 0.2 && !(waistDelta != null && waistDelta > 1),
    moreCardio = tooFast,
    knee = last.knee || 'ok';
  changes.push(
    strength
      ? 'Multiarticolari a 5-7 ripetizioni (fase forza): carichi più alti e 30 secondi di recupero in più.'
      : 'Multiarticolari di nuovo ai range di ipertrofia del primo blocco, con i recuperi originali.',
  );
  if (kgMonth == null) changes.push('Primo check: servirà il prossimo per confrontare peso e vita. Intanto dieta invariata.');
  else if (tooFast)
    changes.push(
      `Peso ${kgMonth > 0 ? '+' : ''}${String(U.round(kgMonth)).replace('.', ',')} kg/mese${waistDelta != null ? ` e vita ${waistDelta > 0 ? '+' : ''}${String(U.round(waistDelta)).replace('.', ',')} cm` : ''}: troppo surplus. Cardio di riscaldamento a 20 minuti e circa 150 kcal in meno nei giorni di riposo (togli 20 g di pane o gallette e 10 g di frutta secca).`,
    );
  else if (tooSlow)
    changes.push(
      `Peso ${kgMonth > 0 ? '+' : ''}${String(U.round(kgMonth)).replace('.', ',')} kg/mese con vita stabile: per mettere massa pulita aggiungi circa 150-200 kcal nei giorni di allenamento (+30 g di riso o pasta a pranzo e +1 banana nello spuntino).`,
    );
  else changes.push(`Peso ${kgMonth > 0 ? '+' : ''}${String(U.round(kgMonth)).replace('.', ',')} kg/mese: ritmo giusto per la massa pulita, dieta invariata.`);
  if (knee !== 'ok') changes.push('Ginocchio: affondi bulgari sostituiti da leg press a piedi alti e leg extension più leggera.');
  if (
    !mutate((n) => {
      n.settings.block = nextBlock;
      n.settings.blockStart = nextMondayISO(new Date());
      n.settings.blockDone = false;
      n.cycle = (n.cycle || 1) + 1;
      n.week = 1;
      n.dayIdx = 0;
      n.program.forEach((d) =>
        d.exercises.forEach((e) => {
          e.baseReps ??= e.reps;
          e.baseRest ??= e.rest;
          if (e.compound) {
            e.reps = strength ? BLOCK_REP_SCHEMES.strength.compound : e.baseReps;
            e.rest = strength ? e.baseRest + 30 : e.baseRest;
          }
          if (isCardio(e) && !d.optional) e.reps = moreCardio ? '20 min' : '15 min';
          if (knee !== 'ok' && /affondi bulgari/i.test(e.name)) {
            e.name = 'Leg press a piedi alti';
            e.id = catalogId(e.name);
            e.reps = '12';
            e.note = 'Variante prudente per il ginocchio: piedi alti sulla pedana, scendi solo fin dove non senti fastidio.';
          }
          if (knee === 'dolore' && /leg extension/i.test(e.name)) e.reps = '15 (carico leggero)';
        }),
      );
    })
  )
    return;
  render();
  U.modal(
    U.head(`Blocco ${nextBlock} pronto`) +
      `<p>Inizia lunedì ${new Date(gym.settings.blockStart + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })} e dura 8 settimane.</p><ul class="block-changes">${changes.map((c) => `<li>${U.esc(c)}</li>`).join('')}</ul><p class="muted">Per una revisione completa della scheda esporta il backup e condividilo.</p>`,
  );
}
function more() {
  return `<div class="card app-version-card"><h2>Versione app</h2><p class="muted">RecompApp ${APP_VERSION} · gli aggiornamenti vengono controllati automaticamente.</p><button id="check-app-update">Controlla aggiornamenti</button></div>${checksCard()}<div class="card"><h2>Le tue sessioni</h2><p class="muted">Durata, serie completate ed esercizi saltati.</p><button id="open-sessions">Riepilogo sessioni</button></div><div class="card"><h2>Backup e ripristino</h2><p class="muted">Dati salvati solo in questo browser. Ultima esportazione richiesta: ${gym.settings.lastExport ? U.date(gym.settings.lastExport) : 'mai'}.</p><div class="actions"><button id="export-gym">Esporta JSON</button><button id="import-gym">Importa backup</button></div><input type="file" accept=".json,application/json" hidden id="import-file"></div><div class="card"><h2>Unità di misura</h2><label for="weight-unit">Carichi e peso corporeo</label><select id="weight-unit"><option value="kg" ${weightUnit() === 'kg' ? 'selected' : ''}>kg</option><option value="lb" ${weightUnit() === 'lb' ? 'selected' : ''}>lb</option></select></div><div class="card"><h2>Storage locale</h2><p class="muted">${storageError ? U.esc(storageError) : 'Salvataggio locale disponibile. Le modifiche vengono confermate solo dopo la scrittura riuscita.'}</p></div><div class="card danger-zone"><h2>Reset dati</h2><p class="muted">Cancella allenamenti, note, peso e modifiche al piano da questo dispositivo.</p><button id="reset-data" class="danger">Azzera tutti i dati</button></div><div class="card"><h2>Integrazione</h2><details><summary>Indicazioni presenti nel piano</summary>${SUPPLEMENTS.map((s) => `<h3>${U.esc(s.title)}</h3><p class="muted">${U.esc(s.txt)}</p>`).join('')}</details></div><div class="card"><h2>Sessioni aperte</h2>${
    gym.sessions
      .filter((s) => !s.legacy && !s.ended)
      .map(
        (s) =>
          `<p>${U.esc(s.day)} · ${U.date(s.started)}</p><button data-session-edit="${U.esc(s.id)}">Correggi / termina</button>`,
      )
      .join('') || '<p class="muted">Nessuna sessione aperta.</p>'
  }</div>`;
}

function exportGym() {
  const n = U.clone(gym);
  const snapshot = U.clone(gym);
  snapshot.sessions.forEach((s) => {
    if (s.runningSince) {
      s.elapsed = elapsed(s);
      s.runningSince = null;
    }
  });
  n.settings.lastExport = new Date().toISOString();
  snapshot.settings.lastExport = n.settings.lastExport;
  U.download('gym-backup-' + U.local().slice(0, 10) + '.json', snapshot);
  if (!storageError) {
    commit(n);
    render();
  }
}
async function importGym(event) {
  const f = event.target.files[0];
  if (!f) return;
  try {
    const n = JSON.parse(await f.text());
    normalizeStateOnOpen(n);
    if (!validGym(n)) throw Error();
    const d = U.modal(
      U.head('Ripristina backup') +
        `<p>${n.sessions.length} sessioni · ${n.program.length} schede · ciclo ${n.cycle}</p><p>Il ripristino sostituisce i dati attuali. Le sessioni in corso nel backup verranno aperte in pausa.</p><div class="actions"><button id="backup-before">Esporta dati attuali</button><button id="restore-confirm" class="primary">Ripristina</button></div>`,
    );
    d.querySelector('#backup-before').onclick = exportGym;
    d.querySelector('#restore-confirm').onclick = () => {
      n.sessions.forEach((s) => {
        if (s.runningSince) {
          s.elapsed = elapsed(s);
          s.runningSince = null;
        }
      });
      n.rest = null;
      if (commit(n, { restore: true })) {
        reopenIds = new Set();
        d.close();
        render();
        U.toast('Backup ripristinato');
      }
    };
  } catch (e) {
    U.toast('Backup non valido. Nessun dato modificato.');
  } finally {
    event.target.value = '';
  }
}
function render() {
  header();
  const error = document.getElementById('gym-storage');
  error.hidden = !storageError;
  error.textContent = storageError;
  chartPoints = [];
  main.innerHTML =
    gym.tab === 'workout'
      ? workout()
      : gym.tab === 'food'
        ? nutrition()
        : gym.tab === 'stats'
          ? stats()
          : more();
  if (gym.tab === 'workout') bindWorkout();
  document.getElementById('weigh-today-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = parseGymNumber(new FormData(e.target).get('weight'));
    if (val == null || Number.isNaN(val) || val <= 0) {
      U.toast('Inserisci un peso valido.');
      return;
    }
    const kg = weightFromDisplay(val);
    if (
      mutate((n) => saveWeightForDay(n, ymd(new Date()), kg))
    ) {
      render();
      U.toast('Peso di oggi salvato.');
    }
  });
  document.getElementById('weigh-skip')?.addEventListener('click', () => {
    const today = ymd(new Date());
    if (
      mutate((n) => {
        n.settings.weightSkips ??= {};
        n.settings.weightSkips[today] = true;
        // Conserva solo gli ultimi 60 giorni saltati.
        const keys = Object.keys(n.settings.weightSkips).sort();
        keys.slice(0, Math.max(0, keys.length - 60)).forEach((k) => delete n.settings.weightSkips[k]);
      })
    ) {
      render();
      U.toast('Ok: potrai registrarlo dopo da ⓘ o da Statistiche → Peso.');
    }
  });
  main.querySelectorAll('[data-open-check]').forEach((b) => (b.onclick = openCheckForm));
  // Linguetta del piano fissata al bordo destro (fuori da main, così resta sempre ferma).
  document.getElementById('plan-tab')?.remove();
  if (gym.tab === 'workout') {
    document.body.insertAdjacentHTML('beforeend', planTab());
    document.getElementById('plan-tab')?.addEventListener('click', openPlanPanel);
  }
  main.querySelectorAll('details.ex-group').forEach((g) =>
    g.addEventListener('toggle', () => {
      if (g.open) closedGroups.delete(g.dataset.groupKey);
      else closedGroups.add(g.dataset.groupKey);
    }),
  );
  main.querySelectorAll('[data-generate-block]').forEach((b) => (b.onclick = generateNextBlock));
  document.querySelectorAll('[data-stats-view]').forEach(
    (b) =>
      (b.onclick = () => {
        statsView = b.dataset.statsView;
        render();
      }),
  );
  document.getElementById('open-sessions')?.addEventListener('click', () => {
    statsView = 'sessions';
    if (mutate((n) => (n.tab = 'stats'))) render();
  });
  document.getElementById('check-app-update')?.addEventListener('click', () => {
    checkForAppUpdate();
    U.toast('Controllo aggiornamenti avviato.');
  });
  main
    .querySelectorAll('[data-session-summary]')
    .forEach((b) => (b.onclick = () => summary(b.dataset.sessionSummary)));
  main.querySelectorAll('[data-session-edit]').forEach(
    (b) =>
      (b.onclick = () => {
        const s = gym.sessions.find((x) => x.id === b.dataset.sessionEdit);
        if (s?.ended) {
          if (s.skippedSession) summary(s.id);
          else editClosedSession(s.id, sessionHasIncomplete(s));
        } else editSession(b.dataset.sessionEdit);
      }),
  );
  main.querySelectorAll('[data-month]').forEach(
    (b) =>
      (b.onclick = () => {
        month = U.shiftMonth(month, Number(b.dataset.month));
        render();
      }),
  );
  main.querySelectorAll('[data-day]').forEach(
    (b) =>
      (b.onclick = () => {
        selectedDay = b.dataset.day;
        render();
      }),
  );
  document.getElementById('session-day')?.addEventListener('change', (e) => {
    selectedDay = e.target.value;
    render();
  });
  document.getElementById('sessions-all')?.addEventListener('click', () => {
    selectedDay = '';
    render();
  });
  document.getElementById('all-days')?.addEventListener('click', () => {
    selectedDay = '';
    render();
  });
  document.getElementById('stats-exercise')?.addEventListener('change', (e) => {
    selectedExercise = e.target.value;
    render();
  });
  document.getElementById('stats-metric')?.addEventListener('change', (e) => {
    metric = e.target.value;
    render();
  });
  document.getElementById('body-weight-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target),
      val = parseGymNumber(fd.get('weight')),
      day = String(fd.get('day') || ymd(new Date()));
    if (val == null || Number.isNaN(val) || val <= 0 || day > ymd(new Date())) {
      U.toast('Inserisci un peso e un giorno validi.');
      return;
    }
    if (mutate((n) => saveWeightForDay(n, day, weightFromDisplay(val)))) {
      render();
      U.toast('Peso salvato.');
    }
  });
  main.querySelectorAll('[data-weight-delete]').forEach(
    (b) =>
      (b.onclick = async () => {
        if (
          (await U.ask('Eliminare questa rilevazione?', { ok: 'Elimina' })) &&
          mutate((n) => (n.bodyWeights = n.bodyWeights.filter((x) => x.id !== b.dataset.weightDelete)))
        )
          render();
      }),
  );
  U.bindChart(main, chartPoints);
  main.querySelectorAll('[data-foodtab]').forEach(
    (b) =>
      (b.onclick = () => {
        if (mutate((n) => (n.foodTab = b.dataset.foodtab))) render();
      }),
  );
  document.getElementById('plan-edit')?.addEventListener('click', planEditor);
  main
    .querySelectorAll('[data-meal-alt]')
    .forEach((b) => (b.onclick = () => mealAlternatives(Number(b.dataset.mealAlt))));
  document.getElementById('shopping')?.addEventListener('click', shopping);
  document.getElementById('export-gym')?.addEventListener('click', exportGym);
  document
    .getElementById('import-gym')
    ?.addEventListener('click', () => document.getElementById('import-file').click());
  document.getElementById('import-file')?.addEventListener('change', importGym);
  document.getElementById('weight-unit')?.addEventListener('change', (e) => {
    if (mutate((n) => (n.settings.weightUnit = e.target.value))) render();
  });
  document.getElementById('reset-data')?.addEventListener('click', async () => {
    if (
      (await U.ask('Azzera definitivamente tutti i dati di RecompApp su questo dispositivo?', {
        ok: 'Continua',
      })) &&
      (await U.ask('Conferma reset: questa operazione non è annullabile.', { ok: 'Azzera tutto' }))
    ) {
      try {
        localStorage.removeItem(GKEY);
      } catch (e) {}
      gym = defaultGym();
      storageError = '';
      reopenIds = new Set();
      render();
      U.toast('Dati azzerati.');
    }
  });
  document.getElementById('new-cycle')?.addEventListener('click', async () => {
    if (gym.sessions.some((s) => !s.legacy && !s.ended)) {
      U.toast('Termina o correggi prima le sessioni aperte.');
      return;
    }
    if (
      (await U.ask('Iniziare un nuovo ciclo? Lo storico sarà conservato.', {
        ok: 'Nuovo ciclo',
        danger: false,
      })) &&
      mutate((n) => {
        n.cycle++;
        n.week = 1;
        n.dayIdx = 0;
      })
    ) {
      render();
      U.toast('Nuovo ciclo avviato');
    }
  });
  updateRest();
  setupAdaptiveChrome();
  syncWakeLock();
}
function equipment(e) {
  if (e.equipment) return e.equipment;
  const n = e.name.toLowerCase();
  if (/push down|face pull/.test(n)) return 'Cavo alto · corda a due estremità';
  if (/pulley/.test(n)) return 'Cavo basso · triangolo, presa neutra';
  if (/croci ai cavi/.test(n)) return 'Due cavi · maniglie singole';
  if (/laterali ai cavi/.test(n)) return 'Cavo basso · maniglia singola';
  if (/cavi.*ez/.test(n)) return 'Cavo basso · barra EZ';
  if (/trazioni/.test(n)) return 'Sbarra · alternativa: lat machine con presa neutra';
  if (/lat machine/.test(n)) return 'Lat machine · barra lunga, presa larga';
  if (/dip/.test(n)) return 'Parallele · corpo libero o macchina assistita';
  if (/rear delt/.test(n)) return 'Due manubri · panca inclinata';
  if (/calf/.test(n)) return 'Calf machine in piedi · appoggio stabile';
  if (/leg press/.test(n)) return 'Pressa a 45°';
  if (/leg extension/.test(n)) return 'Macchina leg extension · rullo sopra le caviglie';
  if (/leg curl/.test(n)) return 'Macchina leg curl · versione seduta o sdraiata';
  if (/hip thrust/.test(n)) return 'Bilanciere con imbottitura · panca stabile';
  if (/bilanciere/.test(n)) return /panca/.test(n) ? 'Bilanciere · panca piana' : 'Bilanciere';
  if (/french press/.test(n)) return 'Manubrio singolo · impugnato con due mani';
  if (/manubri|manubrio/.test(n))
    return /bulgari/.test(n)
      ? 'Due manubri · panca per il piede posteriore'
      : /seduto|inclinata/.test(n)
        ? 'Manubri · panca regolabile'
        : 'Manubri';
  if (isCardio(e))
    return /tapis/.test(n)
      ? 'Tapis roulant · velocità e pendenza regolabili'
      : 'Corsa / camminata · velocità e pendenza';
  if (/crunch ai cavi/.test(n)) return 'Cavo alto · corda a due estremità';
  if (/crunch inverso/.test(n)) return 'Panca piana';
  if (/plank/.test(n)) return 'Tappetino · corpo libero';
  if (/ab wheel/.test(n)) return 'Ruota per addominali · tappetino';
  if (/dead bug/.test(n)) return 'Tappetino · corpo libero';
  if (/captain/.test(n)) return 'Captain chair (sedia per addominali)';
  if (/pallof/.test(n)) return 'Cavo all’altezza del petto · maniglia singola';
  if (/crunch/.test(n)) return 'Tappetino · alternativa: cavo alto con corda';
  if (/gambe da sdraiato/.test(n)) return 'Tappetino · corpo libero';
  if (/kegel/.test(n)) return 'Nessuna attrezzatura';
  return 'Attrezzatura da specificare nella scheda';
}
function howToHtml(name) {
  const h = HOWTO[name];
  if (!h) return '';
  const list = (a, tag = 'ul') => `<${tag}>${a.map((x) => `<li>${U.esc(x)}</li>`).join('')}</${tag}>`;
  return `<div class="howto"><h3 class="howto-h">Come si esegue</h3><h4>Posizione di partenza</h4>${list(h.p)}<h4>Esecuzione</h4>${list(h.s, 'ol')}${h.r ? `<h4>Respirazione</h4><p>${U.esc(h.r)}</p>` : ''}${h.e?.length ? `<h4>Errori da evitare</h4>${list(h.e)}` : ''}</div>`;
}
function showExerciseInfo(e) {
  const template = gym.program.flatMap((d) => d.exercises).find((x) => x.id === e.id);
  const instructions =
    template?.note ||
    e.instructions ||
    e.noteInfo ||
    'Aggiungi le istruzioni tenendo premuto il nome del giorno.';
  const move = e.move || template?.move;
  const svg = ANIM_SVG[move] || '';
  const d = U.modal(
    U.head(e.name) +
      `<p class="equipment-label">${U.esc(equipment(template || e))}</p>${svg ? `<div class="anim-box">${svg}</div><p class="anim-caption">Schema del movimento · segui le istruzioni per la variante indicata</p><button id="animation-toggle">Ⅱ Pausa animazione</button>` : '<p class="muted">Animazione non disponibile per questo esercizio personalizzato.</p>'}${howToHtml(e.name)}<h3 class="howto-h">Indicazioni per te</h3><p class="exercise-instructions">${U.esc(instructions)}</p>`,
  );
  if (svg) animateExercise(d);
}
function animateExercise(d) {
  const svg = d.querySelector('.anim-box svg'),
    tracks = [];
  svg.querySelectorAll('animateTransform,animate').forEach((a) => {
    const node = a.parentElement,
      kind = a.getAttribute('type'),
      attr = a.getAttribute('attributeName'),
      values = a
        .getAttribute('values')
        .split(';')
        .map((v) => v.trim()),
      duration = parseFloat(a.getAttribute('dur')) * 1000;
    if (attr === 'transform' || attr === 'r')
      tracks.push({ node, kind, attr, values: values.map((v) => v.split(/\s+/).map(Number)), duration });
    a.remove();
  });
  let elapsedMs = 0,
    last = null,
    playing = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const toggle = d.querySelector('#animation-toggle');
  const label = () => {
    toggle.textContent = playing ? 'Ⅱ Pausa animazione' : '▶ Riproduci animazione';
  };
  label();
  toggle.onclick = () => {
    playing = !playing;
    label();
  };
  let frame;
  const draw = (t) => {
    if (!d.open || !svg.isConnected) {
      cancelAnimationFrame(frame);
      return;
    }
    if (last !== null && playing) elapsedMs += Math.min(t - last, 100);
    last = t;
    for (const tr of tracks) {
      const position = ((elapsedMs % tr.duration) / tr.duration) * (tr.values.length - 1),
        i = Math.floor(position),
        mix = position - i,
        values = tr.values[i].map((v, j) => v + (tr.values[i + 1][j] - v) * mix);
      tr.node.setAttribute(
        tr.attr,
        tr.attr === 'transform' ? `${tr.kind}(${values.join(' ')})` : String(values[0]),
      );
    }
    frame = requestAnimationFrame(draw);
  };
  frame = requestAnimationFrame(draw);
  d.addEventListener('close', () => cancelAnimationFrame(frame), { once: true });
}
function buttonFeedback(event) {
  const b = event.target.closest?.('button');
  if (!b || b.disabled) return;
  b.classList.remove('button-tap');
  void b.offsetWidth;
  b.classList.add('button-tap');
  const rect = b.getBoundingClientRect(),
    pulse = document.createElement('span');
  pulse.className = 'tap-feedback';
  Object.assign(pulse.style, {
    left: rect.left + 'px',
    top: rect.top + 'px',
    width: rect.width + 'px',
    height: rect.height + 'px',
    borderRadius: getComputedStyle(b).borderRadius,
  });
  document.body.append(pulse);
  setTimeout(() => {
    b.classList.remove('button-tap');
    pulse.remove();
  }, 260);
  const complete = b.dataset.complete;
  if (complete)
    queueMicrotask(() => {
      const next = [...document.querySelectorAll('[data-complete]')].find(
        (x) => x.dataset.complete === complete,
      );
      next?.classList.add('button-tap');
      setTimeout(() => next?.classList.remove('button-tap'), 260);
    });
}
function statsTabs() {
  return `<div class="stats-tabs"><button data-stats-view="exercises" class="${statsView === 'exercises' ? 'active' : ''}">Grafici</button><button data-stats-view="sessions" class="${statsView === 'sessions' ? 'active' : ''}">Sessioni</button><button data-stats-view="weight" class="${statsView === 'weight' ? 'active' : ''}">Peso</button></div>`;
}
function sessionsPage() {
  const rows = gym.sessions
    .filter((s) => !selectedDay || (s.started && U.local(new Date(s.started)).slice(0, 10) === selectedDay))
    .slice()
    .sort((a, b) => new Date(b.started || 0) - new Date(a.started || 0));
  const closed = rows.filter((s) => s.ended),
    chron = closed.slice().sort((a, b) => new Date(a.started || 0) - new Date(b.started || 0));
  const aggregate = closed.reduce(
    (a, s) => {
      const c = sessionCounts(s);
      a.time += elapsed(s);
      a.done += c.done;
      a.skipped += c.skipped;
      return a;
    },
    { time: 0, done: 0, skipped: 0 },
  );
  const durationPoints = chron
    .filter((s) => s.started)
    .map((s) => ({ date: s.started, value: Math.round((elapsed(s) / 60000) * 10) / 10 }));
  const completionPoints = chron
    .filter((s) => s.started)
    .map((s) => {
      const c = sessionCounts(s);
      return { date: s.started, value: c.total ? Math.round((c.sets / c.total) * 100) : 0 };
    });
  return `${statsTabs()}<div class="card"><label for="session-day">Giorno</label><div class="row wrap"><input id="session-day" type="date" value="${selectedDay}"><button id="sessions-all">Tutte le date</button></div></div><div class="summary-counts card"><div><b>${closed.length}</b><span>Sessioni finite</span></div><div><b>${aggregate.done}</b><span>Completati</span></div><div><b>${aggregate.skipped}</b><span>Saltati</span></div></div><div class="session-charts"><div class="card">${trendChart(durationPoints, 'Durata sessioni', 'min')}</div><div class="card">${trendChart(completionPoints, 'Completamento serie', '%')}</div></div><p class="muted">Tempo totale effettivo: ${U.duration(aggregate.time)}</p>${
    rows
      .map((s) => {
        const c = sessionCounts(s);
        return `<article class="card"><div class="row"><h3>${U.esc(s.day)}</h3><span class="session-state">${s.ended ? 'Salvata' : s.runningSince ? 'In corso' : 'In pausa'}</span></div><p class="muted">${U.date(s.started)} · Sett. ${s.week} · Ciclo ${s.cycle || 1}</p><div class="row"><b>${U.duration(elapsed(s))}</b><span>${c.sets}/${c.total} serie</span></div><p class="session-count-labels"><span>✓ ${c.done} completati</span><span>◐ ${c.partial} parziali</span><span>↷ ${c.skipped} ${s.ended ? 'saltati' : 'da svolgere'}</span></p>${
          c.skipped || c.partial
            ? `<details><summary>${s.ended ? 'Saltati e interrotti' : 'Esercizi da terminare'}</summary>${s.exercises
                .filter((e) => exStatus(e) !== 'Completato')
                .map(
                  (e) => `<p class="muted">${U.esc(e.name)} · ${totals(e).done}/${e.rows.length} serie</p>`,
                )
                .join('')}</details>`
            : ''
        }<button data-session-summary="${U.esc(s.id)}">Apri riepilogo</button></article>`;
      })
      .join('') || '<div class="card empty">Nessuna sessione per questa data.</div>'
  }`;
}
let swRegistrationPromise = null,
  swRefreshPending = false;
function showUpdateBanner(reg) {
  let bar = document.getElementById('app-update-banner');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'app-update-banner';
    bar.className = 'app-update-banner';
    bar.innerHTML = `<div><strong>Nuova versione disponibile</strong><small>È disponibile un aggiornamento di RecompApp.</small></div><button type="button" id="apply-app-update">Aggiorna ora</button>`;
    document.body.append(bar);
  }
  bar.hidden = false;
  bar.querySelector('#apply-app-update').onclick = () => {
    const waiting = reg?.waiting;
    if (waiting) {
      swRefreshPending = true;
      waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
      location.reload();
    }
  };
}
function watchServiceWorkerRegistration(reg) {
  if (!reg) return reg;
  if (reg.waiting && navigator.serviceWorker.controller) showUpdateBanner(reg);
  reg.addEventListener('updatefound', () => {
    const worker = reg.installing;
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdateBanner(reg);
    });
  });
  return reg;
}
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return Promise.resolve(null);
  if (!swRegistrationPromise)
    swRegistrationPromise = navigator.serviceWorker
      .register('./sw.js', { scope: './' })
      .then((reg) => {
        watchServiceWorkerRegistration(reg);
        return reg;
      })
      .catch(() => null);
  return swRegistrationPromise;
}
function checkForAppUpdate() {
  registerServiceWorker().then((reg) => reg?.update?.().catch(() => {}));
}
navigator.serviceWorker?.addEventListener('controllerchange', () => {
  if (swRefreshPending) {
    swRefreshPending = false;
    location.reload();
  }
});
function nextWorkoutCue(session, exerciseIndex, rowIndex) {
  if (!session) return '';
  const current = session.exercises[exerciseIndex];
  if (current && !current.stopped) {
    for (let j = rowIndex + 1; j < current.rows.length; j++)
      if (!current.rows[j].done) return `Serie ${j + 1} · ${current.name}`;
  }
  for (let i = exerciseIndex + 1; i < session.exercises.length; i++) {
    const e = session.exercises[i];
    if (!e.stopped && e.rows.some((r) => !r.done)) return `Prossimo esercizio: ${e.name}`;
  }
  return 'Ultima serie della sessione';
}
let wakeLockStatus = 'idle';
async function requestWakeLock() {
  if (!('wakeLock' in navigator)) {
    wakeLockStatus = 'unsupported';
    return false;
  }
  if (wakeLock) return true;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLockStatus = 'active';
    wakeLock.addEventListener?.('release', () => {
      wakeLock = null;
      if (wakeLockStatus !== 'unsupported') wakeLockStatus = 'idle';
    });
    return true;
  } catch (e) {
    wakeLock = null;
    wakeLockStatus = 'blocked';
    return false;
  }
}
async function releaseWakeLock() {
  try {
    await wakeLock?.release();
  } catch (e) {}
  wakeLock = null;
  if (wakeLockStatus !== 'unsupported') wakeLockStatus = 'idle';
}
function syncWakeLock() {
  if (document.visibilityState === 'visible' && active()?.runningSince) requestWakeLock();
  else releaseWakeLock();
}

let adaptiveChromeObserver = null,
  adaptiveChromeFrame = 0;
function setAdaptiveChrome(collapsed) {
  const enabled = gym.tab === 'workout' || gym.tab === 'food';
  const value = enabled && !!collapsed;
  document.body.dataset.activeTab = gym.tab;
  document.body.classList.toggle('controls-scrolled', value);
  document.querySelector('header.top')?.classList.toggle('controls-scrolled', value);
}
function measureAdaptiveChrome() {
  const sentinel = document.querySelector('[data-collapse-sentinel]');
  if (!sentinel || !(gym.tab === 'workout' || gym.tab === 'food')) {
    setAdaptiveChrome(false);
    return;
  }
  // Compare against the sticky title row rather than window.scrollY. This works in Safari,
  // standalone iOS PWAs and nested/native scrolling contexts.
  const header = document.querySelector('header.top');
  const titleBottom = header?.querySelector('.title-row')?.getBoundingClientRect().bottom || 0;
  const sentinelTop = sentinel.getBoundingClientRect().top;
  const wasCollapsed = document.body.classList.contains('controls-scrolled');
  const limit = titleBottom + (wasCollapsed ? 4 : 22);
  setAdaptiveChrome(sentinelTop < limit);
}
function scheduleAdaptiveChrome() {
  if (adaptiveChromeFrame) return;
  adaptiveChromeFrame = requestAnimationFrame(() => {
    adaptiveChromeFrame = 0;
    measureAdaptiveChrome();
  });
}
function setupAdaptiveChrome() {
  adaptiveChromeObserver?.disconnect();
  adaptiveChromeObserver = null;
  setAdaptiveChrome(false);
  const sentinel = document.querySelector('[data-collapse-sentinel]');
  if (!sentinel || !(gym.tab === 'workout' || gym.tab === 'food')) return;
  if ('IntersectionObserver' in window) {
    adaptiveChromeObserver = new IntersectionObserver(() => scheduleAdaptiveChrome(), {
      root: null,
      threshold: [0, 1],
    });
    adaptiveChromeObserver.observe(sentinel);
  }
  // Capture scroll from any actual scrolling ancestor; pointer/touch is only a scheduling fallback.
  window.addEventListener('scroll', scheduleAdaptiveChrome, { passive: true });
  document.addEventListener('scroll', scheduleAdaptiveChrome, { passive: true, capture: true });
  window.visualViewport?.addEventListener('scroll', scheduleAdaptiveChrome, { passive: true });
  requestAnimationFrame(measureAdaptiveChrome);
}
let swipeStart = null,
  swipeAnimating = false;
function switchPageTab(target) {
  if (!TAB_ORDER.includes(target) || target === gym.tab) return;
  if (!mutate((n) => (n.tab = target))) return;
  setAdaptiveChrome(false);
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  document.body.scrollTop = 0;
  document.documentElement.scrollTop = 0;
  render();
}
async function switchTabBySwipe(direction) {
  if (swipeAnimating) return;
  const current = Math.max(0, TAB_ORDER.indexOf(gym.tab)),
    next = (current + direction + TAB_ORDER.length) % TAB_ORDER.length,
    reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  swipeAnimating = true;
  try {
    if (!reduce && main.animate) {
      const out = main.animate(
        [
          { transform: 'translateX(0)', opacity: 1 },
          { transform: `translateX(${direction > 0 ? '-18%' : '18%'})`, opacity: 0.15 },
        ],
        { duration: 135, easing: 'ease-in', fill: 'forwards' },
      );
      try {
        await out.finished;
      } catch (e) {}
      if (!mutate((n) => (n.tab = TAB_ORDER[next]))) {
        out.cancel();
        return;
      }
      setAdaptiveChrome(false);
      window.scrollTo(0, 0);
      render();
      out.cancel();
      const incoming = main.animate(
        [
          { transform: `translateX(${direction > 0 ? '18%' : '-18%'})`, opacity: 0.15 },
          { transform: 'translateX(0)', opacity: 1 },
        ],
        { duration: 190, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'both' },
      );
      try {
        await incoming.finished;
      } catch (e) {}
      incoming.cancel();
    } else if (mutate((n) => (n.tab = TAB_ORDER[next]))) {
      setAdaptiveChrome(false);
      window.scrollTo(0, 0);
      render();
    }
  } finally {
    swipeAnimating = false;
  }
}
function bindSwipeNavigation() {
  main.addEventListener(
    'touchstart',
    (e) => {
      if (
        e.touches.length !== 1 ||
        e.target.closest('button,input,select,textarea,dialog,.daytabs,.weekgrid,.page-nav')
      ) {
        swipeStart = null;
        return;
      }
      const t = e.touches[0];
      swipeStart = { x: t.clientX, y: t.clientY };
    },
    { passive: true },
  );
  main.addEventListener(
    'touchend',
    (e) => {
      if (!swipeStart || !e.changedTouches.length) return;
      const t = e.changedTouches[0],
        dx = t.clientX - swipeStart.x,
        dy = t.clientY - swipeStart.y;
      swipeStart = null;
      if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.35) return;
      if (dx < 0) switchTabBySwipe(1);
      else switchTabBySwipe(-1);
    },
    { passive: true },
  );
}
function repairAfterIOSResume() {
  if (document.visibilityState !== 'visible') return;
  const app = document.getElementById('app');
  // iOS Home Screen can restore a stale compositor surface after lock/unlock.
  // Force a real viewport repaint without leaving the user's scroll position changed.
  document.documentElement.classList.add('ios-resume-repaint');
  if (app) {
    app.style.willChange = 'transform';
    app.getBoundingClientRect();
  }
  requestAnimationFrame(() => {
    const y = window.scrollY || document.documentElement.scrollTop || 0;
    window.scrollTo(0, y + 1);
    requestAnimationFrame(() => {
      window.scrollTo(0, y);
      if (app) app.style.willChange = '';
      document.documentElement.classList.remove('ios-resume-repaint');
      scheduleAdaptiveChrome();
    });
  });
  if (gym.rest) updateRest();
  checkForAppUpdate();
}

function showStartupError(err) {
  console.error('RecompApp startup error', err);
  const splash = document.getElementById('launch-screen');
  if (!splash) return;
  const msg = String(err?.message || err || 'Errore sconosciuto');
  splash.innerHTML =
    '<div class="launch-logo" aria-hidden="true">RC</div><p class="launch-title">RecompApp</p><p class="launch-caption">Errore di avvio</p><p class="launch-caption" style="max-width:300px;text-align:center">Ricarica la pagina. Se il problema persiste, usa il messaggio tecnico qui sotto.</p>';
  const detail = document.createElement('p');
  detail.className = 'launch-caption';
  detail.style.cssText = 'max-width:320px;text-align:center;font-size:12px;opacity:.75;word-break:break-word';
  detail.textContent = msg;
  splash.append(detail);
}
try {
  document.addEventListener('click', buttonFeedback, true);
  registerServiceWorker()
    .then(() => checkForAppUpdate())
    .catch(() => {});
  bindSwipeNavigation();
  setInterval(() => {
    const c = document.getElementById('session-clock');
    if (c) c.textContent = U.duration(elapsed(active()));
    if (gym.rest) updateRest();
  }, 1000);
  setInterval(() => {
    if (document.visibilityState === 'visible') saveLifecycleStamp('heartbeat');
  }, 10000);
  setInterval(() => {
    if (document.visibilityState === 'visible') checkForAppUpdate();
  }, 300000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveLifecycleStamp('hidden');
    else repairAfterIOSResume();
    syncWakeLock();
  });
  window.addEventListener('pageshow', repairAfterIOSResume);
  window.addEventListener('focus', () => {
    if (document.visibilityState === 'visible') repairAfterIOSResume();
  });
  render();
  document.body.classList.remove('launching');
  requestAnimationFrame(() => {
    const splash = document.getElementById('launch-screen');
    if (splash) {
      splash.classList.add('leaving');
      setTimeout(() => splash.remove(), 400);
    }
  });
} catch (err) {
  showStartupError(err);
}

/* Pannelli (dialog): si chiudono con uno swipe verso il basso o verso destra.
   Il pannello segue il dito; sotto la soglia torna al suo posto. */
(function () {
  let g = null;
  const SKIP = 'input,textarea,select,[contenteditable="true"],canvas,svg,.no-swipe';
  function scroller(d, t) {
    for (let n = t; n && n !== d.parentElement; n = n.parentElement) {
      if (n.scrollHeight > n.clientHeight + 2) {
        const oy = getComputedStyle(n).overflowY;
        if (oy === 'auto' || oy === 'scroll') return n;
      }
    }
    return null;
  }
  function canScrollLeft(d, t) {
    for (let n = t; n && n !== d.parentElement; n = n.parentElement) {
      if (n.scrollWidth > n.clientWidth + 2 && n.scrollLeft > 0) {
        const ox = getComputedStyle(n).overflowX;
        if (ox === 'auto' || ox === 'scroll') return true;
      }
    }
    return false;
  }
  document.addEventListener('touchstart', (e) => {
    g = null;
    const d = e.target.closest && e.target.closest('dialog[open]');
    if (!d || e.touches.length !== 1) return;
    const t = e.touches[0];
    const sc = scroller(d, e.target);
    g = { d, x: t.clientX, y: t.clientY, lx: t.clientX, ly: t.clientY, lt: performance.now(), v: 0, axis: null, dead: false,
      top: !sc || sc.scrollTop <= 1, canX: !e.target.closest(SKIP) && !canScrollLeft(d, e.target) };
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (!g || g.dead) return;
    const t = e.touches[0], dx = t.clientX - g.x, dy = t.clientY - g.y;
    if (!g.axis) {
      if (g.canX && dx > 12 && dx > Math.abs(dy) * 1.3) g.axis = 'x';
      else if (g.top && dy > 10 && dy > Math.abs(dx) * 1.2) g.axis = 'y';
      else if (Math.abs(dx) > 12 || Math.abs(dy) > 12) { g.dead = true; return; }
      else return;
      g.d.style.transition = 'none';
    }
    e.preventDefault();
    const now = performance.now();
    g.v = (g.axis === 'x' ? t.clientX - g.lx : t.clientY - g.ly) / Math.max(1, now - g.lt);
    g.lx = t.clientX; g.ly = t.clientY; g.lt = now;
    const d = Math.max(0, g.axis === 'x' ? dx : dy);
    g.d.style.transform = g.axis === 'x' ? `translateX(${d}px)` : `translateY(${d}px)`;
    g.d.style.opacity = String(1 - Math.min(d, 400) / 900);
  }, { passive: false });
  function end(e) {
    if (!g) return;
    const s = g; g = null;
    if (!s.axis) return;
    const t = e.changedTouches && e.changedTouches[0];
    const d = t ? (s.axis === 'x' ? t.clientX - s.x : t.clientY - s.y) : 0;
    s.d.style.transition = 'transform .2s cubic-bezier(.2,.8,.2,1), opacity .2s ease';
    const stop = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
    document.addEventListener('click', stop, true);
    setTimeout(() => document.removeEventListener('click', stop, true), 350);
    if (d > 90 || (s.v > 0.5 && d > 36)) {
      s.d.style.transform = s.axis === 'x' ? 'translateX(110%)' : 'translateY(110%)';
      s.d.style.opacity = '0';
      setTimeout(() => {
        document.removeEventListener('click', stop, true);
        // Usa lo stesso percorso di chiusura del pulsante ✕, se c'è.
        const btn = s.d.querySelector('[data-close], .ask-cancel');
        if (btn) btn.click(); else s.d.close();
        if (s.d.open) s.d.close();
        s.d.style.transition = ''; s.d.style.transform = ''; s.d.style.opacity = '';
      }, 190);
    } else {
      s.d.style.transform = ''; s.d.style.opacity = '';
      setTimeout(() => { s.d.style.transition = ''; }, 220);
    }
  }
  document.addEventListener('touchend', end, { passive: true });
  document.addEventListener('touchcancel', end, { passive: true });
})();

/* La copertura della barra di stato appare solo quando si scorre (niente stacco in cima). */
(function () {
  // Lo scorrimento può avvenire sulla finestra o sul body (html/body con overflow-x nascosto).
  const upd = () => {
    const y = Math.max(window.scrollY || 0, document.body ? document.body.scrollTop : 0, document.documentElement.scrollTop || 0);
    document.documentElement.classList.toggle('is-scrolled', y > 4);
  };
  document.addEventListener('scroll', upd, { passive: true, capture: true });
  upd();
})();
