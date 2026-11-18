// Состояние игры: что лежит в сохранении, как оно читается, чинится и переносится между версиями; календарь.
// Здесь состояние только создаётся, читается и сохраняется. МЕНЯТЬ его во время игры можно только через
// функции из core/actions.js — так все деньги, предметы и наклейки проходят через одно место.
import { emit } from './events.js';
import {
  START_MONEY,
  MIGRATED_MONEY,
  MONTHS,
  SEASON_OF_MONTH,
  SEASONS,
  DAYS_PER_MONTH,
  START_DAY,
  START_CLOTHES,
  START_OUTFIT,
  START_RECIPES,
  CLOTHES,
  CLOTHES_BY_ID,
  NPCS,
  NPC_BY_ID,
  FURN_BY_ID,
  ING_BY_ID,
  DISH_BY_ID,
  SEED_BY_ID,
  TASK_BY_ID,
  guestHosts,
  poolGuestOn,
  poolGuestsOn,
  roomGuestOn,
  HOME_BY_ID,
  BIZ_BY_ID,
  VISIT,
  HEALTH,
  FIND_BY_ID,
  QUESTS,
  QUEST_BY_ID,
  LAND_BY_ID,
  DRESS,
  resolveLook,
  defaultLook,
  PARROT_WORD_BY_ID,
  PARROT_MEMORY,
  PET,
  PET_BY_ID,
  RIDE_BY_ID,
  YARD_BY_ID,
  YARD_BY_ID_HOME,
  HOLIDAY_DRESS,
  holidayOn,
  npcLook,
} from '../data/index.js';

// Ключ хранилища («v1» в имени — исторически; версия сохранения лежит в поле v). Здесь всегда лежит ТА ИГРА,
// В КОТОРУЮ ИГРАЮТ СЕЙЧАС; остальные игры (профили) и их список хранит core/games.js.
export const KEY = 'rhr-save-v1';
export const BACKUP_KEY ='rhr-save-backup'; // копия сохранения: перед миграцией и когда его не удалось прочитать

/**
 * Миграции сохранения. MIGRATIONS[n](s) переводит сохранение версии n в версию n + 1 (меняет s на месте).
 * Версия игры считается сама: 1 + число миграций. Чтобы изменить формат — добавить функцию под следующим
 * номером. Перед миграцией исходная строка копируется в BACKUP_KEY; после неё repair() дополняет и чистит
 * состояние. Миграция видит сохранение как есть, до repair(): полей может не хватать.
 */
export const MIGRATIONS = {
  // v1 → v2, новая экономика: миллиарда больше нет. Вещи, мебель, друзья и наклейки остаются как были,
  // на счету — MIGRATED_MONEY, учёт «заработано / потрачено» начинается заново (новые поля создаст repair()).
  // Отметка bankLetter = 1 — при первом входе показать письмо банка (features/bank.js), один раз.
  1: (s) => {
    s.money = MIGRATED_MONEY;
    s.spent = 0;
    s.earned = 0;
    if (!s.flags || typeof s.flags !== 'object' || Array.isArray(s.flags)) s.flags = {};
    s.flags.bankLetter = 1;
  },
  // v2 → v3, жильё и свой бизнес: купленных домов и заведений пока нет, основной дом — вилла, гости приходят
  // на виллу. Остальное не трогается. (Эти же поля для любого сохранения дополнит repair().)
  2: (s) => {
    s.homesOwned = [];
    s.homeMain = 'villa';
    s.guestsAt = 'villa';
    s.biz = {};
    s.visits = {};
  },
  // v3 → v4, болезнь (Ф1): здорова; чтобы простуда не застала врасплох в первую же ночь после обновления игры,
  // первые HEALTH.grace дня (как в новой игре) не болеет. Остальное не трогается.
  3: (s) => {
    s.sick = null;
    s.immuneUntil = (Number.isFinite(s.day) ? s.day : 0) + HEALTH.grace;
  },
  // v4 → v5, журнал сюжетных заданий (этап 5): заданий ещё не брали, новые места закрыты, находок нет.
  // Отметка questsEarly — задания, которые в новой игре дают не в первый день (Мята), доступны сразу.
  4: (s) => {
    s.quests = {};
    s.lands = {};
    s.finds = {};
    if (!s.flags || typeof s.flags !== 'object' || Array.isArray(s.flags)) s.flags = {};
    s.flags.questsEarly = 1;
  },
};
export const saveVersion = () => 1 + Object.keys(MIGRATIONS).length;

/** Всё, что живёт, пока открыта страница. G.state — то, что уходит в сохранение. */
export const G = {
  state: null,
  time: 0, // секунды с запуска (для анимаций)
  modal: 0, // сколько окон открыто (пока > 0 — мир на паузе); считает ui/modals.js
  cover: 0, // сколько открыто того, что закрывает сцену целиком (мини-игра, пианино, затемнение сна): сцену не рисуем
  dim: 0, // сколько открыто окон с затемнением: сцену под ними рисуем через кадр-другой
  view: { w: 0, h: 0, dpr: 1 }, // размер экрана в CSS-пикселях и сколько пикселей канвы в одном CSS-пикселе
  photo: false, // открыт фото-режим (features/photo.js): подсказки на канве (стрелка к цели у края, звёздочка) не рисуем
  sneezeAt: null, // когда простуженная хомячок последний раз чихнула (по G.time; features/health.js)
};

// Мебель, которая стоит на вилле в начале игры. floor: 0..2, x — центр, y — высота над полом (для настенных)
const START_VILLA = [
  ['lamp', 0, 372],
  ['rug_pink', 0, 540],
  ['sofa_mint', 0, 500],
  ['coffee_table', 0, 668],
  ['tv', 0, 800],
  ['pic_sea', 0, 500, 172],
  ['clock', 0, 660, 185],
  ['plant_ficus', 0, 888],
  ['fridge', 0, 978],
  ['chair', 0, 1425],
  ['table', 0, 1500],
  ['plant_flowers', 0, 1440, 0, 'table'],
  ['wardrobe', 1, 82],
  ['rug_blue', 1, 270],
  ['bed_pink', 1, 270],
  ['nightstand', 1, 412],
  ['mirror', 1, 470, 150],
  ['pic_hamster', 1, 180, 180],
  ['bed_blue', 1, 660],
  ['wheel', 1, 838],
  ['pic_sun', 1, 660, 180],
  ['bed_green', 1, 1060],
  ['bookshelf', 1, 1240],
  ['teddy', 1, 1150],
  ['pic_flowers', 1, 1060, 180],
  ['plant_palm', 2, 700],
  ['plant_palm', 2, 1565],
];

/** Учёт денег за два дня: in — доход по источникам (work, market, task…), out — траты. */
const newLedger = () => ({ today: { in: {}, out: 0 }, yesterday: { in: {}, out: 0 } });

export function newGame(name) {
  let uid = 1;
  const look = defaultLook();
  look.outfit = { ...START_OUTFIT };
  G.state = {
    v: saveVersion(),
    name: name || 'Хомка',
    money: START_MONEY,
    spent: 0, // потрачено за всё время
    earned: 0, // заработано за всё время
    ledger: newLedger(), // доход по источникам и траты за сегодня и за вчера (для Хомяк-Банка)
    day: START_DAY, // новая игра начинается 1 июня (data/calendar.js); день считается от 1 января
    startDay: START_DAY, // с какого дня началась игра: от него — «Год в городе», первые письма, вводные задания
    minutes: 7 * 60 + 30,
    look,
    clothes: [...START_CLOTHES],
    storage: {}, // мебель в кладовке: id → количество
    villa: START_VILLA.filter((r) => r[4] !== 'table').map(([id, floor, x, y]) => ({
      uid: uid++,
      id,
      floor,
      x,
      y: y || 0,
    })),
    uid,
    ing: {
      flour: 2,
      egg: 2,
      milk: 2,
      sugar: 1,
      carrot: 2,
      strawberry: 2,
      tomato: 1,
      apple: 1,
      banana: 1,
      cheese: 1,
      fish: 1,
    },
    dishes: { cookies: 2, cocoa: 1 },
    seeds: { seed_carrot: 2 }, // игра начинается в июне: морковка вырастает за ночь
    recipes: [...START_RECIPES],
    garden: Array.from({ length: 8 }, () => ({ seed: null, age: 0 })),
    friends: Object.fromEntries(NPCS.map((n) => [n.id, { pts: 0, chat: -1, gift: -1, met: false }])),
    guests: [],
    mail: null,
    lastTasks: [],
    tasksDone: 0,
    stickers: [],
    best: {},
    plays: {},
    pos: { scene: 'villa', floor: 1, x: 270 },
    flags: { intro: 1 }, // intro: 1 — идёт вводная цепочка заданий новой игры (features/welcome.js)
    homes: {}, // мебель в других домах (купленное жильё): ключ дома → список предметов, как в villa
    homesOwned: [], // купленное жильё: id из HOMES (вилла своя всегда и сюда не входит)
    homeMain: 'villa', // основной дом: туда ведёт кнопка «Домой»
    guestsAt: 'villa', // в каком доме сейчас гости
    biz: {}, // свои заведения: id → { day: когда куплено, till: в кассе, total: получено всего, last, special… }
    visits: {}, // в гостях у жителей: житель → сколько раз была
    sick: null, // простыла (Ф1): { since: день, когда заболела, cause: 'cold' | 'sea' | 'rain' | 'none' } или null
    immuneUntil: START_DAY + HEALTH.grace, // с какого дня снова можно заболеть (в новой игре — не в первые дни)
    quests: {}, // сюжетные задания (журнал): id → { day: когда взято, n: { шаг: сколько }, got: { шаг: [что] }, done: день | null }
    lands: {}, // открытые новые места (лес, гора…): id → день, когда открылось
    finds: {}, // находки (не еда): id → сколько (data/finds.js)
    parrots: {}, // чему научили попугаев в джунглях (Дж6): номер попугая → [id слов из PARROT_WORDS], до PARROT_MEMORY
    visited: {}, // где хомячок уже побывала — к таким местам карта переносит быстро (Ф4): локация → { место: 1 }
    // этап 17б: питомец ({ kind, name, love, fed — день последней еды; feedDay, pet, play — дни, за которые уже даны
    // очки дружбы (еда, ласка, игра); food — корма в запасе;
    // ball — есть мячик; stay — ждёт дома } или null), транспорт (own — что куплено, use — на чём ездит) и двор
    // (store — купленное, но не поставленное: id → сколько; at — что где стоит: двор → [{ id, x, y }])
    pet: null,
    wheels: { own: [], use: '' },
    yard: { store: {}, at: {} },
    // этап 15 (Пр17): клумбы субботника, на которых хомячок посадила цветы на 1 Мая — они цветут до конца лета этого
    // года: y — год (holidayYear), b — номера клумб (MAY_BEDS в locations/holidays_art.js)
    mayBeds: { y: 0, b: [] },
    // первый день
    weather: 'sun',
    visitor: null,
    dayFlags: {},
  };
  return G.state;
}

let dirty = false,
  stamp = 0; // растёт при каждом изменении состояния: по нему читатели держат кэш (questBadge)
/** Пометить, что состояние изменилось: оно запишется в конце кадра (flush). Зовут действия из core/actions.js. */
export function touch() {
  dirty = true;
  stamp++;
}
// Запись не удалась (хранилище переполнено снимками и играми или недоступно): изменения не теряем — dirty остаётся,
// и запись повторяется, но не чаще раза в RETRY_MS (а не в каждом кадре).
const RETRY_MS = 5000;
let failedAt = 0,
  failing = false;
/** Записать сохранение, если с прошлой записи что-то изменилось. Цикл игры зовёт это раз в кадр. */
export function flush() {
  if (dirty && (!failing || performance.now() - failedAt > RETRY_MS)) save();
}
/** Хранилище переполнено (а не просто недоступно)? Имена и коды ошибки — у разных браузеров свои. */
const isQuota = (e) =>
  !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014);
/**
 * Записать сохранение прямо сейчас. Возвращает true, если записалось. Первая неудача после удачной записи
 * сообщает событием saveFail { quota } — игра показывает об этом окно (main.js).
 */
export function save() {
  if (!G.state) {
    dirty = false;
    return true;
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(G.state));
    dirty = false;
    failing = false;
    return true;
  } catch (e) {
    dirty = true;
    failedAt = performance.now();
    if (!failing) {
      failing = true;
      console.warn('Сохранение не записано:', e);
      emit('saveFail', { quota: isQuota(e) });
    }
    return false;
  }
}
/** Почему не удалась последняя load(): 'broken' — сохранение не прочитать, 'newer' — оно от более новой версии игры. */
export let loadProblem = null;
export function load() {
  loadProblem = null;
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch (e) {
    return false;
  }
  if (!raw) return false;
  let s = null;
  try {
    s = JSON.parse(raw);
  } catch (e) {
    /* разберёмся ниже */
  }
  if (!s || typeof s !== 'object' || !Number.isInteger(s.v) || s.v < 1) {
    backup(raw);
    loadProblem = 'broken';
    return false;
  }
  // сохранение новее кода (в кэше браузера остался старый game.js): не трогаем и не перезаписываем
  if (s.v > saveVersion()) {
    loadProblem = 'newer';
    return false;
  }
  try {
    if (s.v < saveVersion()) {
      backup(raw);
      while (s.v < saveVersion()) {
        MIGRATIONS[s.v](s);
        s.v++;
      }
    }
    repair(s);
  } catch (e) {
    console.warn('Сохранение не прочитано:', e);
    backup(raw);
    loadProblem = 'broken';
    return false;
  }
  G.state = s;
  return true;
}
function backup(raw) {
  try {
    localStorage.setItem(BACKUP_KEY, raw);
  } catch (e) {
    /* хранилище недоступно */
  }
}

/**
 * Привести сохранение в порядок: дополнить недостающие поля и выбросить всё, чего игра не знает.
 * Сохранение ссылается на id из data.js (задание, семена, мебель, одежда, жители). Если id исчез
 * (старое сохранение после обновления игры, испорченные данные), рисование и логика падали бы в каждом
 * кадре. Правило для data.js: id не переименовывать; если предмет удалён — здесь он тихо пропадёт.
 */
export function repair(s) {
  const arr = (k) => {
    if (!Array.isArray(s[k])) s[k] = [];
  };
  const obj = (o, k) => {
    if (!o[k] || typeof o[k] !== 'object' || Array.isArray(o[k])) o[k] = {};
  };
  const num = (k, def) => {
    if (!Number.isFinite(s[k])) s[k] = def;
  };
  for (const k of ['clothes', 'villa', 'recipes', 'guests', 'lastTasks', 'stickers', 'garden']) arr(k);
  for (const k of ['storage', 'ing', 'dishes', 'seeds', 'friends', 'best', 'plays', 'flags', 'dayFlags', 'homes'])
    obj(s, k);
  // сюжетные задания, новые места, находки: только известные id
  for (const k of ['quests', 'lands', 'finds']) obj(s, k);
  for (const id of Object.keys(s.quests)) {
    const q = s.quests[id];
    if (!QUEST_BY_ID[id] || !q || typeof q !== 'object' || Array.isArray(q)) {
      delete s.quests[id];
      continue;
    }
    if (!Number.isFinite(q.day)) q.day = 0;
    obj(q, 'n');
    obj(q, 'got');
    for (const i of Object.keys(q.n)) if (!Number.isFinite(q.n[i]) || q.n[i] < 0) delete q.n[i];
    for (const i of Object.keys(q.got)) if (!Array.isArray(q.got[i])) delete q.got[i];
    if (!Number.isFinite(q.done)) q.done = null;
  }
  for (const id of Object.keys(s.lands)) if (!LAND_BY_ID[id] || !Number.isFinite(s.lands[id])) delete s.lands[id];
  // место, которое открывает уже сданное задание, открыто — даже если награду добавили позже (нижний ярус пещер
  // за «Счастливую кирку», этап 17в)
  for (const [id, q] of Object.entries(s.quests)) {
    const open = QUEST_BY_ID[id].reward && QUEST_BY_ID[id].reward.open;
    if (open && q.done !== null && LAND_BY_ID[open] && !Number.isFinite(s.lands[open])) s.lands[open] = q.done;
  }
  // где уже побывала (быстрый переход по карте, Ф4): в старом сохранении поля нет — пока нигде
  obj(s, 'visited');
  // слова попугаев (этап 11): в старом сохранении поля нет — попугаи пока ничего не выучили
  obj(s, 'parrots');
  for (const k of Object.keys(s.parrots))
    s.parrots[k] = Array.isArray(s.parrots[k]) ? s.parrots[k].filter((id) => PARROT_WORD_BY_ID[id]).slice(-PARROT_MEMORY) : [];
  for (const k of Object.keys(s.visited)) obj(s.visited, k);
  // питомец, транспорт, двор (этап 17б): в старом сохранении полей нет — питомца нет, транспорта нет, двор как был
  {
    const pt = s.pet;
    if (!pt || typeof pt !== 'object' || !PET_BY_ID[pt.kind]) s.pet = null;
    else {
      if (typeof pt.name !== 'string' || !pt.name.trim()) pt.name = PET_BY_ID[pt.kind].names[0];
      pt.name = pt.name.slice(0, PET.nameMax);
      for (const k of ['love', 'food']) if (!Number.isFinite(pt[k]) || pt[k] < 0) pt[k] = 0;
      pt.love = Math.min(pt.love, PET.heart * PET.hearts);
      for (const k of ['fed', 'feedDay', 'pet', 'play']) if (!Number.isFinite(pt[k])) pt[k] = -1;
      pt.ball = !!pt.ball;
      pt.stay = !!pt.stay;
    }
    if (!s.wheels || typeof s.wheels !== 'object' || Array.isArray(s.wheels)) s.wheels = { own: [], use: '' };
    s.wheels.own = [...new Set(Array.isArray(s.wheels.own) ? s.wheels.own : [])].filter((id) => RIDE_BY_ID[id]);
    if (!s.wheels.own.includes(s.wheels.use)) s.wheels.use = s.wheels.own[s.wheels.own.length - 1] || '';
    if (!s.mayBeds || typeof s.mayBeds !== 'object' || Array.isArray(s.mayBeds)) s.mayBeds = { y: 0, b: [] };
    if (!Number.isInteger(s.mayBeds.y)) s.mayBeds.y = 0;
    s.mayBeds.b = [...new Set(Array.isArray(s.mayBeds.b) ? s.mayBeds.b : [])].filter((i) => Number.isInteger(i) && i >= 0 && i < 8);
    if (!s.yard || typeof s.yard !== 'object' || Array.isArray(s.yard)) s.yard = { store: {}, at: {} };
    obj(s.yard, 'store');
    obj(s.yard, 'at');
    for (const id of Object.keys(s.yard.store)) if (!YARD_BY_ID[id] || !(s.yard.store[id] > 0)) delete s.yard.store[id];
    for (const k of Object.keys(s.yard.at)) {
      const yd = YARD_BY_ID_HOME[k];
      if (!yd) {
        delete s.yard.at[k];
        continue;
      }
      s.yard.at[k] = (Array.isArray(s.yard.at[k]) ? s.yard.at[k] : []).filter(
        (i) => i && YARD_BY_ID[i.id] && Number.isInteger(i.x) && Number.isInteger(i.y),
      );
    }
  }
  // жильё и заведения: только известные id; основной дом и дом с гостями — вилла или купленное жильё
  arr('homesOwned');
  s.homesOwned = [...new Set(s.homesOwned)].filter((id) => id !== 'villa' && HOME_BY_ID[id]);
  const isHome = (id) => id === 'villa' || s.homesOwned.includes(id);
  if (!isHome(s.homeMain)) s.homeMain = 'villa';
  if (typeof s.guestsAt !== 'string' || !s.guestsAt) s.guestsAt = 'villa';
  obj(s, 'biz');
  for (const id of Object.keys(s.biz)) {
    const b = s.biz[id];
    if (!BIZ_BY_ID[id] || !b || typeof b !== 'object') {
      delete s.biz[id];
      continue;
    }
    for (const k of ['day', 'till', 'total', 'last']) if (!Number.isFinite(b[k]) || b[k] < 0) b[k] = 0;
    if (b.special && !DISH_BY_ID[b.special]) delete b.special;
  }
  obj(s, 'visits');
  for (const id of Object.keys(s.visits)) if (!NPC_BY_ID[id] || !(s.visits[id] > 0)) delete s.visits[id];
  num('money', 0);
  num('spent', 0);
  num('earned', 0);
  num('pearlsSold', 0);
  // болезнь: { since, cause } или null; заболеть «в будущем» нельзя
  num('immuneUntil', 0);
  const sk = s.sick;
  if (!sk || typeof sk !== 'object' || !Number.isFinite(sk.since) || typeof sk.cause !== 'string') s.sick = null;
  else if (Number.isFinite(s.day) && sk.since > s.day) sk.since = s.day;
  // учёт денег за сегодня и вчера
  if (!s.ledger || typeof s.ledger !== 'object') s.ledger = newLedger();
  for (const k of ['today', 'yesterday']) {
    const d = s.ledger[k];
    if (!d || typeof d !== 'object') s.ledger[k] = { in: {}, out: 0 };
    else {
      obj(d, 'in');
      if (!Number.isFinite(d.out)) d.out = 0;
      for (const src of Object.keys(d.in)) if (!Number.isFinite(d.in[src])) delete d.in[src];
    }
  }
  num('day', 0);
  // с какого дня началась игра: у игр до этапа 10 такого поля нет — они начинались 1 января (день 0)
  if (!Number.isFinite(s.startDay) || s.startDay < 0 || s.startDay > s.day) s.startDay = 0;
  num('minutes', 7 * 60 + 30);
  num('tasksDone', 0);
  num('pearls', 0);
  s.pearlsSold = Math.max(0, Math.min(s.pearlsSold, s.pearls)); // продано не больше, чем найдено
  if (typeof s.name !== 'string' || !s.name) s.name = 'Хомка';
  // внешность
  if (!s.look || typeof s.look !== 'object') s.look = defaultLook();
  obj(s.look, 'outfit');
  obj(s.look, 'beauty');
  s.clothes = s.clothes.filter((id) => CLOTHES_BY_ID[id]);
  for (const k of Object.keys(s.look.outfit))
    if (s.look.outfit[k] && !CLOTHES_BY_ID[s.look.outfit[k]]) s.look.outfit[k] = null;
  // рецепты, продукты, семена, кладовка
  s.recipes = s.recipes.filter((id) => DISH_BY_ID[id]);
  for (const r of START_RECIPES) if (!s.recipes.includes(r)) s.recipes.push(r);
  for (const [bag, known] of [
    ['ing', ING_BY_ID],
    ['dishes', DISH_BY_ID],
    ['seeds', SEED_BY_ID],
    ['storage', FURN_BY_ID],
    ['finds', FIND_BY_ID],
  ]) {
    for (const id of Object.keys(s[bag])) if (!known[id] || !(s[bag][id] > 0)) delete s[bag][id];
  }
  // мебель: на вилле и в других своих домах
  const fixItems = (list) => {
    const out = (Array.isArray(list) ? list : []).filter(
      (i) => i && FURN_BY_ID[i.id] && Number.isFinite(i.x) && Number.isFinite(i.floor),
    );
    for (const i of out) {
      if (!Number.isFinite(i.y)) i.y = 0;
      // «включено» у колеса, игрушек и растений раньше попадало в сохранение; теперь это состояние сцены
      if (['wheel', 'plant', 'toy'].includes(FURN_BY_ID[i.id].act)) {
        delete i.on;
        delete i.onT;
      }
    }
    return out;
  };
  s.villa = fixItems(s.villa);
  for (const k of Object.keys(s.homes)) s.homes[k] = fixItems(s.homes[k]);
  s.uid = Math.max(
    Number.isFinite(s.uid) ? s.uid : 1,
    ...[s.villa, ...Object.values(s.homes)].flat().map((i) => (i.uid || 0) + 1),
  );
  // грядки: всегда восемь, семена — только известные
  s.garden = Array.from({ length: 8 }, (_, i) => {
    const b = s.garden[i];
    return b && b.seed && SEED_BY_ID[b.seed]
      ? { seed: b.seed, age: Number.isFinite(b.age) ? b.age : 0 }
      : { seed: null, age: 0 };
  });
  // друзья и гости
  for (const n of NPCS) {
    const f = s.friends[n.id];
    if (!f || typeof f !== 'object' || !Number.isFinite(f.pts))
      s.friends[n.id] = { pts: 0, chat: -1, gift: -1, met: false };
  }
  s.guests = s.guests.filter((id) => NPC_BY_ID[id]);
  if (s.visitor && !NPC_BY_ID[s.visitor]) s.visitor = null;
  // письмо: неизвестное задание — выбрасываем, при старте придёт новое
  s.lastTasks = s.lastTasks.filter((id) => TASK_BY_ID[id]);
  if (s.mail && (typeof s.mail !== 'object' || !TASK_BY_ID[s.mail.task])) s.mail = null;
  if (s.mail) {
    const m = s.mail;
    if (!Number.isFinite(m.n)) m.n = 0;
    obj(m, 'got');
    if (m.items && !Array.isArray(m.items)) m.items = null;
  }
  if (typeof s.weather !== 'string') s.weather = 'sun';
  // позиция: имя сцены и конечные числа, иначе — у двери виллы (изнутри). Годится ли позиция самой сцене
  // (этаж, проходимая клетка), проверяет её restorePos().
  const p = s.pos,
    fin = Number.isFinite;
  const okPos =
    p && typeof p === 'object' && typeof p.scene === 'string' && fin(p.x) && (p.scene !== 'world' || fin(p.y));
  if (!okPos) s.pos = { scene: 'villa', floor: 0, x: 290 };
  // gid — чья это игра в списке игр (core/games.js); старое сохранение без него — «активная игра»
  if (s.gid !== undefined && (typeof s.gid !== 'string' || !/^[\w-]{1,24}$/.test(s.gid))) delete s.gid;
  return s;
}
/** Забыть загруженную игру (перед «Новой игрой» на заставке). */
export function unload() {
  G.state = null;
}

// ---------- календарь ----------
export function cal(s = G.state) {
  const month = Math.floor(s.day / DAYS_PER_MONTH) % 12;
  const season = SEASON_OF_MONTH[month];
  const m = s.minutes;
  const phase = m < 11 * 60 ? 'Утро' : m < 17 * 60 ? 'День' : m < 21 * 60 ? 'Вечер' : 'Ночь';
  const phaseIcon = m < 11 * 60 ? '🌅' : m < 17 * 60 ? '☀️' : m < 21 * 60 ? '🌇' : '🌙';
  return {
    month,
    monthName: MONTHS[month],
    dom: (s.day % DAYS_PER_MONTH) + 1,
    year: Math.floor(s.day / (DAYS_PER_MONTH * 12)) + 1,
    season,
    seasonName: SEASONS[season].name,
    seasonIcon: SEASONS[season].icon,
    phase,
    phaseIcon,
    time: `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`,
  };
}
export const season = () => cal().season;
/** 0 — день, 1 — глубокая ночь */
export function darkness() {
  const m = G.state.minutes;
  if (m < 18 * 60) return 0;
  return Math.min(1, (m - 18 * 60) / (3.5 * 60));
}

// ---------- внешность игрока ----------
let lookCache = null,
  lookKey = '';
export function playerLook() {
  const s = G.state;
  const key = JSON.stringify(s.look) + (s.sick ? '+sick' : '');
  if (key !== lookKey) {
    lookKey = key;
    // простуженная (Ф1) — с красным носиком, румянцем и градусником: это видно во всех сценах (art/hamster.js)
    lookCache = s.sick ? { ...resolveLook(s.look), sick: true } : resolveLook(s.look);
  }
  return lookCache;
}

// ---------- болезнь (Ф1; только чтение) ----------
/** Простыла ли хомячок. */
export const isSick = () => !!(G.state && G.state.sick);
/** Можно ли купаться и нырять (простуженной — нельзя). */
export const canSwim = () => !isSick();
/** Во сколько раз медленнее ходит: простуженная — HEALTH.slow, но тёплое питьё сегодня возвращает обычный шаг. */
export const walkK = () => (isSick() && !G.state.dayFlags.sickTea ? HEALTH.slow : 1);
/**
 * Чих: 0…1 — как далеко зашёл (0–0,55 «а-а-а…», дальше «апчхи!»), null — сейчас не чихает. Когда чихнуть, решает
 * features/health.js (G.sneezeAt — время по G.time, не сохраняется); сцены передают это в позу (pose.sneeze).
 */
export function sneezePhase() {
  if (G.sneezeAt == null || !isSick()) return null;
  const k = (G.time - G.sneezeAt) / 1.1;
  return k >= 0 && k < 1 ? k : null;
}
let beachBase = null,
  beachFlip = null,
  beachCache = null;
/**
 * Хомячок на пляже (У2): на ногах — шлёпанцы, если они есть в шкафу (первая пара по порядку шкафа). Если шлёпанцы
 * уже надеты или их нет — обычный вид. Это только картинка: наряд в сохранении не меняется, ушла с пляжа —
 * снова своя обувь. Где пляж и когда холодно (зимой шлёпанцы не надеваются) — решает сцена: heroLook()
 * в engine/topdown/scene.js по клеткам с beach: true.
 */
export function beachLook() {
  const base = playerLook(),
    feet = base.outfit.feet;
  if (feet && feet.kind === 'flipflops') return base;
  const flip = CLOTHES.find((c) => c.kind === 'flipflops' && hasClothes(c.id));
  if (!flip) return base;
  if (base !== beachBase || flip !== beachFlip) {
    beachBase = base;
    beachFlip = flip;
    beachCache = { ...base, outfit: { ...base.outfit, feet: flip } };
  }
  return beachCache;
}
export function outfitTags() {
  const tags = new Set();
  for (const id of Object.values(G.state.look.outfit))
    if (id && CLOTHES_BY_ID[id]) CLOTHES_BY_ID[id].tags.forEach((t) => tags.add(t));
  return tags;
}

// ---------- что есть у игрока (только чтение) ----------
export const hasClothes = (id) => G.state.clothes.includes(id);
export const count = (bag, id) => G.state[bag][id] || 0;
export function canCook(dish) {
  return Object.entries(dish.needs).every(([id, n]) => count('ing', id) >= n);
}
export function friendHearts(id) {
  return Math.min(5, Math.floor(G.state.friends[id].pts / 4));
}

// ---------- жильё, заведения, гости (только чтение) ----------
/** Свой ли это дом: вилла — всегда, остальное жильё — если куплено. */
export const ownsHome = (id) => id === 'villa' || G.state.homesOwned.includes(id);
/** Все свои дома по порядку: вилла и купленное жильё. */
export const ownedHomes = () => ['villa', ...G.state.homesOwned];
/** Куплено ли заведение. */
export const ownsBiz = (id) => !!G.state.biz[id];
/**
 * Звал ли житель сегодня в гости: сказал «Заходи ко мне сегодня!» (отметка дня invited) или он — хозяин из
 * прочитанного письма «день гостей» (задание с openHouse: host или hosts жителей дня — guestHosts в data/tasks.js).
 * Пока письмо не прочитано, все гуляют как обычно.
 */
export function invitedToday(id) {
  const s = G.state;
  if ((s.dayFlags.invited || {})[id]) return true;
  return guestsWaiting().includes(id);
}
/** Кто сегодня ждёт в гости по прочитанному письму «день гостей» (пусто — письмо другое или не прочитано). */
export function guestsWaiting() {
  const m = G.state.mail;
  return m && m.read ? guestHosts(TASK_BY_ID[m.task], G.state.day) : [];
}
/**
 * Где сейчас житель: 'guest' — в гостях у героини, 'asleep' — спит (поздно), 'home' — дома и рад гостям
 * (утро, вечер или сам позвал), 'out' — гуляет в городе. Часы — VISIT в data/visits.js.
 */
export function npcWhere(id) {
  const s = G.state,
    m = s.minutes;
  if (s.guests.includes(id)) return 'guest';
  if (m >= VISIT.sleep) return 'asleep';
  if (invitedToday(id)) return 'home';
  return m < VISIT.morningEnd || m >= VISIT.eveningStart ? 'home' : 'out';
}

/**
 * В чей праздничный наряд жители города одеты сегодня (этап 15, Пр4): id праздника или null. Наряды — HOLIDAY_DRESS
 * (data/holidays.js), только в сам праздник; внешность — npcLook(id, npcDress()).
 */
export function npcDress() {
  const s = G.state;
  if (!s) return null;
  const h = holidayOn(s.day, s.startDay || 0);
  return h && HOLIDAY_DRESS[h.id] ? h.id : null;
}
/** Внешность жителя сейчас — в праздник в праздничном наряде (для разговоров и сцен). */
export const npcLookNow = (id) => npcLook(id, npcDress());

/**
 * Кто из жителей сейчас отдыхает у бассейна курортного отеля (П.17) — id или null. Расписание — poolGuestOn
 * (data/hotel.js); кого ждут в гостях, кто сам позвал к себе или у кого есть дело по журналу заданий («!» / «?»), —
 * тот остаётся в городе. Пока житель у бассейна, в городе его не видно (locations/town.js, поле away).
 */
export function hotelPoolGuest() {
  return hotelPoolGuests()[0] || null;
}
/**
 * Бодрость после спа (От7): день спа — в flags.spaBoost; действует в этот день и весь следующий, пока не потрачена на
 * смену работы (+HOTEL.spaBoost к оплате). Без штрафов: бодрость только добавляет.
 */
export function spaBoostOn() {
  const s = G.state,
    d = s && s.flags.spaBoost;
  return typeof d === 'number' && s.day >= d && s.day - d <= 1;
}
/** Все жители, что сейчас отдыхают у бассейна отеля (От4: несколько, в разное время) — с теми же оговорками. */
export function hotelPoolGuests() {
  const s = G.state;
  if (!s) return [];
  return poolGuestsOn(s.day, s.minutes).filter((id) => !(s.guests.includes(id) || invitedToday(id) || guestsWaiting().includes(id) || questBadge(id)));
}

/** Кто из жителей сейчас гостит в номере 203 отеля (От1) — с теми же оговорками, что и у бассейна. */
export function hotelRoomGuest() {
  const s = G.state;
  if (!s) return null;
  const id = roomGuestOn(s.day, s.minutes);
  if (!id || s.guests.includes(id) || invitedToday(id) || guestsWaiting().includes(id) || questBadge(id)) return null;
  return id;
}

/** Мебель дома по его ключу в сохранении: 'villa' — вилла, остальные лежат в state.homes. */
export function houseItems(key) {
  const s = G.state;
  return key === 'villa' ? s.villa : s.homes[key] || [];
}

// ---------- сюжетные задания и новые места (этап 5; только чтение) ----------
// Описания — data/quests.js, места — LANDS в data/places.js; ход задания по событиям считает features/quests.js.
/** Побывала ли хомячок у места id локации loc (дошла и зашла / сделала там что-то) — для быстрого перехода (Ф4). */
export const wasAt = (loc, id) => !!(G.state && G.state.visited && G.state.visited[loc] && G.state.visited[loc][id]);
/** Открыто ли новое место (лес, пустыня…). */
export const landOpen = (id) => !!G.state && Number.isFinite(G.state.lands[id]);
/** Сколько в рюкзаке того, что просит шаг «принести»: штук (или разных находок, если distinct). */
function bringHave(b) {
  const bag = G.state[b.bag] || {};
  let n = 0;
  for (const id of Object.keys(bag)) {
    if (!(bag[id] > 0)) continue;
    if (b.id ? id !== b.id : !FIND_BY_ID[id] || FIND_BY_ID[id].kind !== b.kind) continue;
    n += b.distinct ? 1 : bag[id];
  }
  return n;
}
/**
 * Где задание сейчас: { q, status, i, steps } — status: 'locked' (рано), 'ready' (можно взять), 'active', 'done';
 * i — текущий шаг (первый несделанный; у выполненного — steps.length); steps — [{ have, need, ok }] по шагам.
 */
export function questNow(id) {
  const q = QUEST_BY_ID[id],
    s = G.state,
    st = s.quests[id];
  const status = st ? (st.done !== null ? 'done' : 'active') : !q.when || q.when(s) ? 'ready' : 'locked';
  const steps = q.steps.map((step, i) => {
    const need = step.n || 1;
    let have = 0;
    if (status === 'done') have = need;
    else if (st)
      have = step.bring
        ? bringHave(step.bring)
        : step.dress // «приди в тёплом»: смотрит на наряд прямо сейчас (снимешь — шаг снова не сделан)
          ? +DRESS[step.dress](playerLook().outfit)
          : st.n[i] || 0;
    return { have: Math.min(have, need), need, ok: have >= need };
  });
  let i = steps.findIndex((x) => !x.ok);
  if (i < 0) i = steps.length;
  return { q, status, i, steps };
}
/**
 * Шаг «сделать» задания qid, у которого поля if совпадают с fields ({ what: 'piece', id: 'ship' }), ещё ждёт: задание
 * взято, а шаг не сделан. Так сцены узнают, показывать ли предмет задания (кусочек карты Зефирки на дне и т. п.).
 */
export function stepWaits(qid, fields) {
  const q = QUEST_BY_ID[qid];
  if (!q || !G.state) return false;
  const i = q.steps.findIndex((st) => st.if && Object.keys(fields).every((k) => st.if[k] === fields[k]));
  if (i < 0) return false;
  const w = questNow(qid);
  return w.status === 'active' && !w.steps[i].ok;
}
let cacheStamp = -1,
  cacheState = null,
  badges = {},
  wanted = {};
/** Значки над жителями и нужные находки — пересчитать, если состояние изменилось (сцены спрашивают каждый кадр). */
function questCache() {
  if (cacheStamp === stamp && cacheState === G.state) return;
  cacheStamp = stamp;
  cacheState = G.state;
  badges = {};
  wanted = {};
  for (const q of QUESTS) {
    const w = questNow(q.id);
    if (w.status === 'ready' && !q.intro && !badges[q.npc]) badges[q.npc] = '!'; // вводное задание житель приносит сам
    if (w.status !== 'active') continue;
    const cur = q.steps[w.i];
    if (cur && cur.talk) badges[cur.talk] = '?';
    q.steps.forEach((step, i) => {
      if (step.bring && step.bring.kind && !w.steps[i].ok) wanted[step.bring.kind] = true;
    });
  }
}
/**
 * Значок над жителем: '!' — у него можно взять задание, '?' — пора к нему с заданием (сдать или продолжить),
 * null — ничего. Ответ кэшируется до следующего изменения состояния.
 */
export function questBadge(npc) {
  if (!G.state) return null;
  questCache();
  return badges[npc] || null;
}
/** Нужны ли сейчас находки этого вида (kind: 'herb'): какое-то взятое задание просит их и ещё не набрано. */
export function findsWanted(kind) {
  if (!G.state) return false;
  questCache();
  return !!wanted[kind];
}
