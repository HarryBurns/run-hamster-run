// Хранилище игры: G (всё, что живёт, пока открыта страница; G.state — то, что уходит в сохранение), новая игра,
// запись и чтение сохранения, защита от второй вкладки и от старой страницы. Миграции и починка — core/repair.js.
// МЕНЯТЬ состояние во время игры можно только через функции из core/actions.js.
import { emit } from './events.js';
import { MIGRATIONS, saveVersion, repair, newLedger } from './repair.js';
import {
  START_MONEY,
  START_DAY,
  START_CLOTHES,
  START_OUTFIT,
  START_RECIPES,
  NPCS,
  HEALTH,
  defaultLook,
  BUILD,
  VILLA_UP_NEW,
  GARDEN_SIZE,
} from '../data/index.js';

// Ключ хранилища («v1» в имени — исторически; версия сохранения лежит в поле v). Здесь всегда лежит ТА ИГРА,
// В КОТОРУЮ ИГРАЮТ СЕЙЧАС; остальные игры (профили) и их список хранит core/games.js.
export const KEY = 'rhr-save-v1';
export const BACKUP_KEY = 'rhr-save-backup'; // копия сохранения: перед миграцией и когда его не удалось прочитать

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

// Мебель маленького домика, с которого начинается новая игра («Вилла растёт»): душ, шкаф, кровать, стул и стол.
// floor — этаж, x — центр, y — высота над полом (для настенных). Комнаты домика — interiors/villa.js, ступень 0.
const START_VILLA = [
  ['shower', 0, 66],
  ['wardrobe', 0, 402],
  ['bed_pink', 0, 578],
  ['chair', 0, 712],
  ['table', 0, 790],
];
/**
 * Мебель, с которой игра начиналась до «Вилла растёт» (полная вилла в три этажа). Нужна автотесту: __dev.villaFull()
 * ставит её, чтобы прежние шаги работали на той же вилле (js/devhooks.js).
 */
export const OLD_START_VILLA = [
  ['lamp', 0, 372],
  ['rug_pink', 0, 540],
  ['sofa_mint', 0, 500],
  ['coffee_table', 0, 668],
  ['tv', 0, 800],
  ['pic_sea', 0, 500, 172],
  ['clock', 0, 800, 190], // над телевизором: не на окне гостиной (x 640)
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

/** Во сколько начинается первый день новой игры (минуты от полуночи). */
export const START_MINUTES = 7 * 60 + 30;

export function newGame(name) {
  let uid = 1;
  const look = defaultLook();
  look.outfit = { ...START_OUTFIT };
  G.state = {
    v: saveVersion(),
    build: BUILD, // номер сборки кода, который писал сохранение (data/build.js)
    name: name || 'Хомка',
    money: START_MONEY,
    spent: 0, // потрачено за всё время
    earned: 0, // заработано за всё время
    ledger: newLedger(), // доход по источникам и траты за сегодня и за вчера (для Хомяк-Банка)
    day: START_DAY, // новая игра начинается 1 июня (data/calendar.js); день считается от 1 января
    startDay: START_DAY, // с какого дня началась игра: от него — «Год в городе», первые письма, вводные задания
    minutes: START_MINUTES,
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
    garden: Array.from({ length: GARDEN_SIZE }, () => ({ seed: null, age: 0 })),
    // «Вилла растёт»: что построено (data/estate.js). Новая игра — маленький домик и 6 грядок; у сохранений без
    // этого поля (игры, начатые раньше) построено всё, что было, — см. repair
    villaUp: { ...VILLA_UP_NEW },
    friends: Object.fromEntries(NPCS.map((n) => [n.id, { pts: 0, chat: -1, gift: -1, met: false }])),
    guests: [],
    mail: null,
    lastTasks: [],
    tasksDone: 0,
    stickers: [],
    best: {},
    plays: {},
    pos: { scene: 'villa', floor: 0, x: 608 },
    // intro: 1 — идёт вводная цепочка заданий новой игры (features/welcome.js); begun: 1 — игра дошла до самой игры
    // (после вступительной сценки, main.js: startGame): без неё и без перемен это «пустая» игра (core/games.js: blankGame)
    flags: { intro: 1 },
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
  !!e &&
  (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014);
// ---------- чьё живое сохранение: вторая вкладка и старая страница ----------
// В ключе OWNER_KEY лежит «вкладка:сборка:время» — кто сейчас играет и пишет живое сохранение. Вкладка записывает себя,
// когда начинает играть (claimSave), и перед каждой записью сохранения смотрит, она ли там ещё. Там другая вкладка —
// значит, игру открыли ещё раз (или её открыла страница с более новым кодом): эта вкладка перестаёт сохраняться
// насовсем (до перезагрузки) и шлёт событие saveLost { why: 'tab' | 'newer' } — main.js показывает окно.
// Так две вкладки не затирают друг друга молча: пишет всегда та, что открыла игру последней.
export const OWNER_KEY = 'rhr-owner';
const TAB = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
let owned = false,
  lostWhy = null;
/** Эта вкладка начинает играть: теперь живое сохранение пишет она. */
export function claimSave() {
  if (lostWhy) return false;
  owned = true;
  try {
    localStorage.setItem(OWNER_KEY, `${TAB}:${BUILD}:${Date.now()}`);
  } catch (e) {
    /* хранилище недоступно — защищать нечего */
  }
  return true;
}
/** Почему эта вкладка больше не сохраняет: null | 'tab' (игру открыли в другой вкладке) | 'newer' (там код новее). */
export const saveLost = () => lostWhy;
function ownerSeen(value) {
  if (lostWhy || !owned || !value || String(value).startsWith(TAB + ':')) return;
  const build = +String(value).split(':')[1];
  lostWhy = build > BUILD ? 'newer' : 'tab';
  dirty = false;
  console.warn('Игру открыли в другой вкладке — здесь она больше не сохраняется.');
  emit('saveLost', { why: lostWhy });
}
/** Можно ли писать живое сохранение (и заодно — не увели ли его только что). */
function mayWrite() {
  if (lostWhy) return false;
  let cur = null;
  try {
    cur = localStorage.getItem(OWNER_KEY);
  } catch (e) {
    return true; // хранилище недоступно: запись ниже сама скажет об этом
  }
  if (!owned || !cur)
    claimSave(); // игру начали не с заставки (тесты) или ключ стёрли
  else ownerSeen(cur);
  return !lostWhy;
}
// другая вкладка записала себя — узнаём сразу, не дожидаясь своей следующей записи
if (typeof window !== 'undefined' && window.addEventListener)
  window.addEventListener('storage', (e) => {
    if (e.key === OWNER_KEY) ownerSeen(e.newValue);
  });

// Пока открыта заставка, игра ещё не началась: живое сохранение не пишется совсем (что бы ни позвало save() —
// уход со страницы, автосохранение). Новую игру записывает core/games.js: createGame — по кнопке «Играть!».
let held = false;
/** Заставка открыта (true) или игра началась (false): пока true, save() ничего не пишет. */
export function holdSave(on) {
  held = !!on;
}

/**
 * Записать сохранение прямо сейчас. Возвращает true, если записалось. Первая неудача после удачной записи
 * сообщает событием saveFail { quota } — игра показывает об этом окно (main.js). Если игру увела другая вкладка
 * (см. выше) — не пишет ничего и возвращает false.
 */
export function save() {
  if (!G.state || held) {
    dirty = false;
    return true;
  }
  if (!mayWrite()) {
    dirty = false;
    return false;
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
/**
 * Проверить разобранное сохранение s (объект) и привести его к нынешнему виду: миграции и repair() — на месте.
 * Возвращает null (всё хорошо) или причину: 'broken' — не сохранение или не чинится, 'newer' — от более новой игры.
 * onMigrate() зовётся перед миграцией (load() откладывает копию). Хранилище не трогает — годится и для файла.
 */
export function checkSave(s, onMigrate) {
  if (!s || typeof s !== 'object' || Array.isArray(s) || !Number.isInteger(s.v) || s.v < 1) return 'broken';
  // сохранение новее кода (в кэше браузера осталась старая страница): не трогаем и не перезаписываем
  if (s.v > saveVersion() || (Number.isFinite(s.build) && s.build > BUILD)) return 'newer';
  try {
    if (s.v < saveVersion()) {
      if (onMigrate) onMigrate();
      while (s.v < saveVersion()) {
        MIGRATIONS[s.v](s);
        s.v++;
      }
    }
    repair(s);
  } catch (e) {
    console.warn('Сохранение не прочитано:', e);
    return 'broken';
  }
  return null;
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
  loadProblem = checkSave(s, () => backup(raw));
  if (loadProblem) {
    if (loadProblem === 'broken') backup(raw);
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

/** Забыть загруженную игру (перед «Новой игрой» на заставке). */
export function unload() {
  G.state = null;
}
/** Номер изменения состояния: растёт при каждом touch() — по нему читатели держат кэш (questBadge в core/queries.js). */
export const stateStamp = () => stamp;
