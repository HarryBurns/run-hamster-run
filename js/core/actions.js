// Действия — единственное место, где во время игры меняется состояние (G.state): деньги, предметы, наклейки,
// друзья, мебель, время. Остальной код состояние только читает.
//
// Зачем: чтобы у денег и предметов была одна дверь (экономику можно проверить и поменять в одном месте),
// чтобы сохранение помечалось «изменённым» само (запись — раз в кадр, см. flush() в core/state.js)
// и чтобы подсказка «Новая наклейка: …» бралась из таблицы наклеек, а не набиралась руками.
//
// Правила:
//  - действие — маленькая функция: поменяла состояние, сообщила событием, если это кому-то важно;
//  - окна и подсказки действия не показывают (это ui/ и features/): они слушают события;
//  - новое изменение состояния = новая функция здесь (обёрнутая в act), а не правка G.state «по месту».
// Автотест (dev/smoke.js, шаг «состояние меняют только действия») ловит записи в состояние мимо этого файла.
import { G, touch, cal, hasClothes, houseItems, friendHearts } from './state.js';
import { emit } from './events.js';
import {
  NPCS,
  FURN_BY_ID,
  HOME_BY_ID,
  BIZ_BY_ID,
  BIZ_RULES,
  DISH_BY_ID,
  SECRET_RECIPES,
  HEALTH,
  PARROT_WORD_BY_ID,
  PARROT_MEMORY,
  PET,
  PET_BY_ID,
  RIDE_BY_ID,
  YARD_BY_ID,
  VILLA_UP_BY_ID,
  weatherPart,
  cleanName,
} from '../data/index.js';

let depth = 0;
/** Идёт ли сейчас действие (для проверки в тестах). */
export const inAction = () => depth > 0;
/**
 * Обернуть функцию-действие: пока она работает, запись в состояние разрешена. Сохранение «изменённым» помечает
 * само действие — touch(), и только если правда что-то поменяло (award() зовут и каждый кадр «на всякий случай»).
 */
function act(fn) {
  return (...a) => {
    depth++;
    try {
      return fn(...a);
    } finally {
      depth--;
    }
  };
}
/** Редкий случай: поменять состояние функцией «на месте» (починка сохранения, отладка). Обычный код так не делает. */
export const mutate = act((fn) => {
  touch();
  return fn(G.state);
});

const S = () => G.state;

// ---------- деньги ----------
// Все монеты идут через spend() и earn(): здесь же ведётся учёт для Хомяк-Банка — сколько заработано и потрачено
// за всё время (earned, spent) и за сегодня и вчера (ledger). Событие money несёт delta — на сколько изменился счёт.
/** Потратить n монет. false — не хватает (ничего не меняется). */
export const spend = act((n) => {
  const s = S();
  if (s.money < n) return false;
  s.money -= n;
  s.spent += n;
  s.ledger.today.out += n;
  touch();
  emit('money', { delta: -n });
  return true;
});
/**
 * Получить n монет. source — откуда: work (работа), market (рынок), task (задание), gift (подарок), other;
 * полный список с названиями для банка — INCOME_SOURCES в data/economy.js.
 */
export const earn = act((n, source = 'other') => {
  const s = S(),
    day = s.ledger.today.in;
  s.money += n;
  s.earned += n;
  day[source] = (day[source] || 0) + n;
  touch();
  emit('money', { delta: n, source });
});

// ---------- предметы ----------
/** Положить n штук в «сумку» (ing — продукты, dishes — блюда, seeds — семена, storage — кладовка); n < 0 — забрать. */
export const addItem = act((bag, id, n = 1) => {
  const b = S()[bag];
  b[id] = (b[id] || 0) + n;
  if (b[id] <= 0) delete b[id];
  touch();
});
/** Добавить вещь в шкаф. true — её раньше не было. */
export const addClothes = act((id) => {
  if (hasClothes(id)) return false;
  S().clothes.push(id);
  touch();
  return true;
});
/** Выучить рецепт. */
export const learnRecipe = act((id) => {
  if (S().recipes.includes(id)) return;
  S().recipes.push(id);
  touch();
});
/** Добавить жемчужины; возвращает, сколько их стало. */
export const addPearls = act((n) => {
  const s = S();
  s.pearls = (s.pearls || 0) + n;
  touch();
  emit('pearl');
  return s.pearls;
});
/** Продать n жемчужин: pearls — сколько найдено за всё время, pearlsSold — сколько из них уже продано. */
export const sellPearls = act((n) => {
  const s = S();
  s.pearlsSold = Math.min(s.pearls || 0, (s.pearlsSold || 0) + n);
  touch();
});

// ---------- наклейки ----------
/**
 * Выдать наклейку. Возвращает true, если она новая. Подсказку «Новая наклейка: …» показывает features/album.js
 * по событию sticker: delay — через сколько мс, quiet — не показывать (когда о наклейке говорит своё окно).
 */
export const award = act((id, { delay = 0, quiet = false } = {}) => {
  if (S().stickers.includes(id)) return false;
  S().stickers.push(id);
  touch();
  emit('sticker', { id, delay, quiet });
  return true;
});

// ---------- внешность ----------
/** Надеть вещь в слот (или снять: id = null). */
export const wear = act((slot, id) => {
  S().look.outfit[slot] = id;
  touch();
  emit('look');
  emit('wear', { slot, id });
});
/** Изменить причёску, цвет коготков и прочее из салона красоты. */
export const setBeauty = act((key, value) => {
  S().look.beauty[key] = value;
  touch();
  emit('look');
});

// ---------- друзья и гости ----------
/** Отметить, что с жителем познакомились. */
export const meetFriend = act((id) => {
  S().friends[id].met = true;
  touch();
});
/**
 * Прибавить очки дружбы. Выросли сердечки — событие friend { id, before, after }: награды за сердечки (тост,
 * секретный рецепт, подарок) выдаёт features/friends.js, откуда бы ни пришли очки (разговор, скамейка, рассказ…).
 */
export const addFriendPts = act((id, n) => {
  const before = friendHearts(id);
  S().friends[id].pts += n;
  touch();
  const after = friendHearts(id);
  if (after > before) emit('friend', { id, before, after });
});
/** Запомнить, что сегодня уже болтали / дарили / угощали (kind: chat | gift | treat). */
export const markFriendToday = act((id, kind) => {
  S().friends[id][kind] = S().day;
  touch();
});
/** Сколько гостей может быть дома сразу. */
export const MAX_GUESTS = 3;
/**
 * Позвать жителя в гости. home — в какой из своих домов (ключ дома); если гости уже сидят в другом доме, они
 * перебегают вместе с новым гостем. Без home — туда, где гости сейчас. false — уже в гостях или дом полон.
 * how — как гость пришёл (когда уйдёт — features/guests.js): 'call' — позвали (по телефону, в разговоре), 'self' —
 * сам («тук-тук»; уходит, когда хомячок выходит из дома), 'party' — гость праздника (день рождения). Лежит в отметке
 * дня dayFlags.guestHow (без отметки — 'call'; сосед вводной цепочки — 'self', features/welcome.js); гости
 * и отметки дня обнуляются вместе в nextDay.
 */
export const inviteGuest = act((id, home, how = null) => {
  const s = S();
  if (s.guests.includes(id) || s.guests.length >= MAX_GUESTS) return false;
  s.guests.push(id);
  if (home) s.guestsAt = home;
  if (how) (s.dayFlags.guestHow = s.dayFlags.guestHow || {})[id] = how;
  touch();
  emit('guests');
  return true;
});
/** Проводить гостя домой. */
export const removeGuest = act((id) => {
  const s = S();
  s.guests = s.guests.filter((g) => g !== id);
  if (s.dayFlags.guestHow) delete s.dayFlags.guestHow[id];
  touch();
  emit('guests');
});
/** Гости расходятся по домам: ids — кто (по умолчанию все). Возвращает, сколько ушло. */
export const sendGuestsHome = act((ids = null) => {
  const s = S(),
    go = s.guests.filter((g) => !ids || ids.includes(g));
  if (!go.length) return 0;
  s.guests = s.guests.filter((g) => !go.includes(g));
  if (s.dayFlags.guestHow) for (const g of go) delete s.dayFlags.guestHow[g];
  touch();
  emit('guests');
  return go.length;
});
/** Гость, который сегодня собирался прийти сам: забрать его из «планов» (вернёт id или null). */
export const takeVisitor = act(() => {
  const id = S().visitor;
  S().visitor = null;
  touch();
  return id;
});

// ---------- в гостях у жителей ----------
/** Житель позвал в гости: сегодня он весь день дома, дверь открыта. */
export const inviteHome = act((id) => {
  const d = S().dayFlags;
  (d.invited = d.invited || {})[id] = 1;
  touch();
});
/** Героиня зашла в гости к жителю. Возвращает { first: первый ли раз у него, homes: у скольких жителей уже была }. */
export const countVisit = act((id) => {
  const v = S().visits;
  const first = !v[id];
  v[id] = (v[id] || 0) + 1;
  touch();
  return { first, homes: Object.keys(v).length };
});

// ---------- жильё и свой бизнес ----------
/** Жильё куплено (монеты списывает покупка — features/homes.js). Возвращает, сколько домов куплено всего. */
export const addHome = act((id) => {
  const s = S();
  if (!HOME_BY_ID[id] || id === 'villa' || s.homesOwned.includes(id)) return s.homesOwned.length;
  s.homesOwned.push(id);
  touch();
  emit('estate');
  return s.homesOwned.length;
});
/** Выбрать основной дом: туда ведёт кнопка «Домой». */
export const setMainHome = act((id) => {
  const s = S();
  if (id !== 'villa' && !s.homesOwned.includes(id)) return;
  s.homeMain = id;
  touch();
  emit('estate');
});
/** Заведение куплено. Возвращает, сколько заведений у хозяйки всего. */
export const addBiz = act((id) => {
  const s = S();
  if (BIZ_BY_ID[id] && !s.biz[id]) {
    s.biz[id] = { day: s.day, till: 0, total: 0, last: 0 };
    touch();
    emit('estate');
  }
  return Object.keys(s.biz).length;
});
/** Забрать выручку из кассы заведения. Возвращает, сколько забрали. */
export const collectBiz = act((id) => {
  const b = S().biz[id];
  if (!b || !(b.till > 0)) return 0;
  const n = b.till;
  b.till = 0;
  b.total += n;
  earn(n, 'business');
  return n;
});
/** Хозяйка сама поработала в своём заведении сегодня (stars — как сыграла): выручка этого дня будет больше. */
export const markBizWorked = act((id, stars) => {
  const s = S();
  if (!s.biz[id]) return;
  const w = (s.dayFlags.bizWork = s.dayFlags.bizWork || {});
  w[id] = Math.max(w[id] || 0, stars);
  touch();
});
/** Настройка своего заведения: special — «блюдо дня», sign — цвет вывески, title — своё название. */
export const setBizOpt = act((id, key, value) => {
  const b = S().biz[id];
  if (!b) return;
  if (value === null || value === undefined || value === '') delete b[key];
  else b[key] = value;
  touch();
  emit('estate');
});
/**
 * Сколько заведение заработает за сегодняшний день: выручка из таблицы, плюс прибавка, если хозяйка сегодня
 * сама там поработала, плюс «блюдо дня». Возвращает { sum, base, work, special }.
 */
export function bizDayIncome(id) {
  const s = S(),
    def = BIZ_BY_ID[id],
    b = s.biz[id];
  if (!def || !b) return { sum: 0, base: 0, work: 0, special: 0 };
  const stars = (s.dayFlags.bizWork || {})[id] || 0;
  const work = stars ? Math.round(def.income * BIZ_RULES.workBonus[stars - 1]) : 0;
  const dish = b.special && DISH_BY_ID[b.special];
  const special = dish
    ? Math.round(def.income * (SECRET_RECIPES.includes(dish.id) ? BIZ_RULES.specialSecret : BIZ_RULES.special))
    : 0;
  return { sum: def.income + work + special, base: def.income, work, special };
}
/** Сколько помещается в кассе заведения. */
export const bizTillCap = (id) => (BIZ_BY_ID[id] ? BIZ_BY_ID[id].income * BIZ_RULES.tillDays : 0);

// ---------- мебель в домах ----------
/** Завести список мебели для дома (купленное жильё): start — [[id, этаж, x, y?], …]. Если список уже есть — не трогает. */
export const initHouse = act((key, start = []) => {
  const s = S();
  if (key === 'villa' || s.homes[key]) return;
  s.homes[key] = start.map(([id, floor, x, y]) => ({ uid: s.uid++, id, floor, x, y: y || 0 }));
  touch();
});
/** Достать предмет из кладовки и поставить в дом. Возвращает предмет. */
export const placeFurn = act((key, id, floor, x, y) => {
  const s = S();
  const it = { uid: s.uid++, id, floor, x, y };
  if (key !== 'villa' && !s.homes[key]) s.homes[key] = [];
  houseItems(key).push(it);
  addItem('storage', id, -1);
  emit('place', { id });
  return it;
});
/** Убрать предмет из дома в кладовку. */
export const stashFurn = act((key, uid) => {
  const list = houseItems(key),
    i = list.findIndex((q) => q.uid === uid);
  if (i < 0) return;
  const [it] = list.splice(i, 1);
  addItem('storage', it.id, 1);
});
/** Передвинуть предмет. Сохранение не помечает (предмет тащат каждый кадр) — в конце перетаскивания зовут touchState(). */
export const moveFurn = act((it, x, floor, y) => {
  it.x = x;
  it.floor = floor;
  if (y !== undefined) it.y = y;
});
/** Включить или выключить предмет (телевизор, лампа, музыка, камин). */
export const setFurnOn = act((it, on) => {
  it.on = on;
  touch();
});
// ---------- телевизор (features/tv.js) ----------
/** Сколько новостей помнит телевизор (последние — первыми). */
export const TV_NEWS_MAX = 6;
/** Переключить канал (один на все телевизоры: что включила, то и показывают дома). */
export const setTvChannel = act((ch) => {
  if (S().tv.ch === ch) return;
  S().tv.ch = ch;
  touch();
});
/** Новость для «Новостей Ореховой Гавани»: k — что случилось, id — что именно. Одна и та же — не повторяется. */
export const addTvNews = act((k, id = '') => {
  const t = S().tv,
    s = S();
  if (t.news.some((n) => n.k === k && n.id === id)) return false;
  t.news.unshift({ k, id, d: s.day });
  if (t.news.length > TV_NEWS_MAX) t.news.length = TV_NEWS_MAX;
  touch();
  return true;
});
/** Выпуск «У плиты» сегодня: какое блюдо (запоминается на весь день) и досмотрен ли до конца. */
export const setTvShow = act((day, dish, done = false) => {
  const t = S().tv;
  if (t.show && t.show.day === day && t.show.dish === dish && t.show.done === done) return;
  t.show = { day, dish, done };
  touch();
});
/** Есть ли у предмета тип «кровать» и т. п. — помощник для правил вроде «последнюю кровать не убирать». */
export const countFurnAct = (key, actName) =>
  houseItems(key).filter((i) => FURN_BY_ID[i.id] && FURN_BY_ID[i.id].act === actName).length;

// ---------- сад ----------
/** Посадить семена на грядку i. */
export const plantSeed = act((i, seedId) => {
  addItem('seeds', seedId, -1);
  const bed = S().garden[i];
  bed.seed = seedId;
  bed.age = 0;
  touch();
});
/** Собрать урожай с грядки i: crop — что выросло, n — сколько. */
export const harvestBed = act((i, crop, n) => {
  addItem('ing', crop, n);
  const bed = S().garden[i];
  bed.seed = null;
  bed.age = 0;
  touch();
});

// ---------- почта и задание дня ----------
/** Положить в ящик новое письмо с заданием. */
export const setMail = act((taskId) => {
  const s = S();
  s.lastTasks = [taskId, ...s.lastTasks].slice(0, 6);
  s.mail = { task: taskId, read: false, done: false, n: 0, got: {}, items: null };
  touch();
});
/** Письмо прочитано; items — предметы, которые надо собрать (или null). */
export const readMail = act((items = null) => {
  const m = S().mail;
  m.read = true;
  if (items) m.items = items;
  touch();
});
/** Счётчик задания +1; возвращает новое значение. */
export const mailCount = act(() => {
  touch();
  return ++S().mail.n;
});
/** Отметить часть задания (с кем поговорили, где побывали); возвращает, сколько частей отмечено. */
export const mailGot = act((key) => {
  const m = S().mail;
  m.got[key] = 1;
  touch();
  return Object.keys(m.got).length;
});
/** Предмет задания подобран. */
export const collectMailItem = act((it) => {
  it.got = true;
  touch();
});
/** Задание выполнено; возвращает, сколько заданий выполнено всего. */
export const finishTask = act(() => {
  const s = S();
  s.mail.done = true;
  touch();
  return ++s.tasksDone;
});

// ---------- время ----------
const DAY_END = 23 * 60 + 59;
/** Игровое время идёт: dt — секунды настоящего времени (0,6 с = 1 игровая минута). Сохранение не помечает. */
export const passTime = act((dt) => {
  const s = S(),
    was = s.minutes;
  if (s.minutes < DAY_END) s.minutes = Math.min(DAY_END, s.minutes + dt / 0.6);
  weatherTurn(was);
});
/** Занятие отняло n игровых минут (но не позже cap). */
export const spendMinutes = act((n, cap = DAY_END) => {
  const s = S(),
    was = s.minutes;
  s.minutes = Math.min(cap, s.minutes + n);
  weatherTurn(was);
  touch();
});
// Погода — одна на мир и известна заранее: расчёт от номера дня — weatherOfDay (data/weather.js). В состоянии лежит
// погода города «сейчас»: weather (sun | rain | snow | petals | leaves) и wxStrong — сильная ли она ('' — лёгкая,
// 'rain2' — ливень, 'rain3' — гроза, 'snow2' — метель; читать — weatherNow() в core/queries.js). Она меняется, когда
// время переходит границу частей дня (гроза начинается после обеда).
const strongOf = (kind, force) =>
  force >= 2 && (kind === 'rain' || kind === 'snow') ? kind + Math.min(force, kind === 'rain' ? 3 : 2) : '';
function putWeather(kind, force) {
  const s = S(),
    strong = strongOf(kind, force);
  if (s.weather === kind && s.wxStrong === strong) return;
  s.weather = kind;
  s.wxStrong = strong;
  emit('weather');
}
/** Время шло с минуты was: если началась другая часть погоды дня — погода меняется. */
function weatherTurn(was) {
  const s = S(),
    st = s.startDay || 0,
    p = weatherPart(s.day, s.minutes, st);
  if (weatherPart(s.day, was, st) !== p) putWeather(p.kind, p.force);
}
/** Погода по расписанию дня — сейчас (в автотесте после смены дня и часа через __dev). */
export const syncWeather = act(() => {
  const s = S(),
    p = weatherPart(s.day, s.minutes, s.startDay || 0);
  putWeather(p.kind, p.force);
  touch();
});
/** Для автотеста и снимков: погода города прямо сейчас (до следующей смены по расписанию дня). */
export const forceWeather = act((kind, force = 1) => {
  putWeather(kind, force);
  touch();
});
/** Наступил следующий день: утро, грядки подросли, новая погода, гости разошлись. */
export const nextDay = act(() => {
  const s = S();
  // свои заведения: выручка прошедшего дня ложится в кассу (в кассе помещается выручка за BIZ_RULES.tillDays дней)
  for (const id of Object.keys(s.biz)) {
    const b = s.biz[id],
      inc = bizDayIncome(id).sum;
    b.last = Math.max(0, Math.min(inc, bizTillCap(id) - b.till));
    b.till += b.last;
  }
  s.day++;
  s.minutes = 7 * 60 + 30;
  for (const b of s.garden) if (b.seed) b.age++;
  finishVillaUp(); // «Вилла растёт»: строители закончили к утру
  const wp = weatherPart(s.day, s.minutes, s.startDay || 0);
  putWeather(wp.kind, wp.force);
  s.guests = [];
  s.visitor = Math.random() < 0.35 ? NPCS[Math.floor(Math.random() * NPCS.length)].id : null;
  s.dayFlags = {}; // вместе с отметками дня обнуляются оплаченные смены (shifts) и кошелёк торговца (marketPaid)
  s.ledger = { today: { in: {}, out: 0 }, yesterday: s.ledger.today };
  touch();
  emit('guests');
});

// ---------- «Вилла растёт» (data/estate.js) ----------
/** Заказать строителям ступень дома или двора (деньги списывает занятие — features/villa_up.js). false — нельзя. */
export const orderVillaUp = act((id) => {
  const s = S(),
    u = s.villaUp,
    d = VILLA_UP_BY_ID[id];
  if (!d || u.build || u[d.kind] !== d.level - 1) return false;
  u.build = { id, day: s.day };
  touch();
  emit('villaUp', { what: 'order', id });
  return true;
});
/**
 * Строители закончили (наступило утро после заказа; now — сразу, для отладки): ступень построена. Мебель, которая
 * стоит там, куда встают новые встроенные предметы (clear у ступени), уходит в кладовку — кроме последней кровати.
 * Возвращает id ступени или null. Событие villaUp { what: 'done', id, moved: [id мебели] }.
 */
export const finishVillaUp = act((now = false) => {
  const s = S(),
    u = s.villaUp,
    b = u && u.build,
    d = b && VILLA_UP_BY_ID[b.id];
  if (!b || (!now && s.day <= b.day)) return null;
  u.build = null;
  touch();
  if (!d) return null;
  u[d.kind] = Math.max(u[d.kind], d.level);
  const moved = [];
  for (const [f, x0, x1] of d.clear || [])
    for (const it of [...s.villa]) {
      const def = FURN_BY_ID[it.id];
      if (!def || def.wall || def.layer === 0 || it.floor !== f) continue;
      if (it.x + def.w / 2 <= x0 || it.x - def.w / 2 >= x1) continue;
      if (def.act === 'sleep' && countFurnAct('villa', 'sleep') <= 1) continue;
      stashFurn('villa', it.uid);
      moved.push(it.id);
    }
  emit('villaUp', { what: 'done', id: d.id, moved });
  return d.id;
});

// ---------- болезнь (Ф1) ----------
// Заболеть или выздороветь решает features/health.js (при смене дня — по таблицам data/health.js, у доктора — сразу).
/** Хомячок простыла сегодня утром; cause — из-за чего ('cold', 'sea', 'rain', 'none'). */
export const fallSick = act((cause = 'none') => {
  const s = S();
  s.sick = { since: s.day, cause };
  touch();
  emit('health', { sick: true, cause });
  emit('look');
});
/** Выздоровела (how: 'doctor' — у доктора, 'self' — сама): следующие HEALTH.immune дней не болеет. */
export const recoverSick = act((how = 'self') => {
  const s = S();
  if (!s.sick) return false;
  s.sick = null;
  s.immuneUntil = s.day + HEALTH.immune;
  touch();
  emit('health', { sick: false, how });
  emit('look');
  return true;
});

// ---------- сюжетные задания и новые места (этап 5) ----------
// Что считать и когда — решает features/quests.js (по событиям); описания заданий — data/quests.js.
/** Взять задание из журнала. false — оно уже взято. */
export const takeQuest = act((id) => {
  const s = S();
  if (s.quests[id]) return false;
  s.quests[id] = { day: s.day, n: {}, got: {}, done: null };
  touch();
  emit('quest', { id });
  return true;
});
/**
 * Шаг i задания сделан ещё раз. value — что именно (для шагов «разные»: id жителя и т. п.): одно и то же значение
 * второй раз не считается. Возвращает, сколько теперь на шаге.
 */
export const questCount = act((id, i, value) => {
  const q = S().quests[id];
  if (!q || q.done !== null) return 0;
  if (value !== undefined) {
    const got = (q.got[i] = q.got[i] || []);
    if (got.includes(value)) return q.n[i] || 0;
    got.push(value);
  }
  q.n[i] = (q.n[i] || 0) + 1;
  touch();
  emit('quest', { id });
  return q.n[i];
});
/** Задание выполнено (награду выдаёт features/quests.js другими действиями). */
export const finishQuest = act((id) => {
  const s = S(),
    q = s.quests[id];
  if (!q || q.done !== null) return false;
  q.done = s.day;
  touch();
  emit('quest', { id, done: true });
  return true;
});
/** Открылось новое место (лес, пустыня…): с этой минуты туда можно пройти. */
export const openLand = act((id) => {
  const s = S();
  if (Number.isFinite(s.lands[id])) return false;
  s.lands[id] = s.day;
  touch();
  emit('land', { id });
  return true;
});

// ---------- отметки ----------
/** Отметка навсегда (flags) — «подсказку уже показывали», «сундук уже открывали». */
export const setFlag = act((name, value = 1) => {
  S().flags[name] = value;
  touch();
});
/**
 * Клумба субботника засажена (этап 15, Пр17): номер клумбы bed в году year — цветы на ней остаются до конца лета
 * (locations/holidays.js). Новый год субботника — список клумб заново.
 */
export const plantMayBed = act((year, bed) => {
  const s = S();
  if (s.mayBeds.y !== year) s.mayBeds = { y: year, b: [] };
  if (!s.mayBeds.b.includes(bed)) s.mayBeds.b.push(bed);
  touch();
});
/** Счётчик в flags +1; возвращает новое значение. */
export const bumpFlag = act((name) => {
  const f = S().flags;
  f[name] = (f[name] || 0) + 1;
  touch();
  return f[name];
});
/** Отметка на сегодня (dayFlags) — сбрасывается утром. group — подгруппа (например, раковины с жемчугом). */
export const setDayFlag = act((name, value = 1, group = null) => {
  const d = S().dayFlags;
  if (group) (d[group] = d[group] || {})[name] = value;
  else d[name] = value;
  touch();
});

// ---------- мини-игры ----------
/** Записать результат мини-игры: сыграно раз и лучший счёт в звёздах. */
export const recordPlay = act((id, stars) => {
  const s = S();
  s.plays[id] = (s.plays[id] || 0) + 1;
  s.best[id] = Math.max(s.best[id] || 0, stars);
  touch();
});

// ---------- позиция и то, что сцены держат в сохранении ----------
/** Где сейчас хомячок (кладёт цикл игры при смене сцены и автосохранении). */
export const setPos = act((pos) => {
  S().pos = pos;
});
/** Хомячок дошла до места id локации loc (здание, особое место, точка с карты) — к нему потом можно быстро (Ф4). */
export const markVisited = act((loc, id) => {
  const v = S().visited || (S().visited = {});
  if (v[loc] && v[loc][id]) return;
  (v[loc] || (v[loc] = {}))[id] = 1;
  touch();
});
/**
 * Научить попугая i слову id (PARROT_WORDS в data/tales.js): он помнит PARROT_MEMORY последних слов. false — такого
 * слова нет.
 */
export const teachParrot = act((i, id) => {
  if (!PARROT_WORD_BY_ID[id]) return false;
  const all = S().parrots || (S().parrots = {});
  all[i] = [...(all[i] || []).filter((w) => w !== id), id].slice(-PARROT_MEMORY);
  touch();
  return true;
});
/**
 * Кусочек сохранения, которым владеет одна сцена (например, кораблик в городе): завести, если его ещё нет,
 * и/или поменять поля. Сохранение не помечает (кораблик двигается каждый кадр) — когда надо, зовут touchState().
 */
export const patchState = act((key, patch, init) => {
  const s = S();
  if (!s[key]) s[key] = { ...init };
  if (patch) Object.assign(s[key], patch);
  return s[key];
});
/** Пометить сохранение изменённым (после серии «тихих» действий, например в конце перетаскивания мебели). */
export const touchState = () => touch();

// ---------- питомец (этап 17б) ----------
// Питомец — один: state.pet. Очки дружбы (love) только растут; за что сегодня уже дали очки — дни feedDay, pet, play;
// fed — день последней еды (по нему питомец «голоден»; в день, когда взяли из приюта, он сыт).
/** Взять питомца из приюта: вид и имя. false — питомец уже есть или вида такого нет. */
export const adoptPet = act((kind, name) => {
  const s = S();
  if (s.pet || !PET_BY_ID[kind]) return false;
  const nm =
    String(name || '')
      .trim()
      .slice(0, PET.nameMax) || PET_BY_ID[kind].names[0];
  s.pet = { kind, name: nm, love: 0, fed: s.day, feedDay: -1, pet: -1, play: -1, food: 2, ball: false, stay: false };
  touch();
  emit('pet', { what: 'adopt', kind });
  return true;
});
/** Дать герою другое имя (правила — cleanName в data/looks.js). Пустое имя не ставится. Меню ⚙️. */
export const setName = act((name) => {
  const nm = cleanName(name);
  if (!nm || S().name === nm) return false;
  S().name = nm;
  touch();
  emit('name', { name: nm });
  return true;
});
/** Сменить пол героя ('m' — хомячок, 'f' — хомячка): от него род во всех текстах (core/gender.js). Меню ⚙️. */
export const setGender = act((gender) => {
  const g = gender === 'm' ? 'm' : 'f';
  if (S().gender === g) return false;
  S().gender = g;
  touch();
  emit('gender', { gender: g });
  return true;
});
/** Дать питомцу другое имя. */
export const renamePet = act((name) => {
  const pt = S().pet,
    nm = String(name || '')
      .trim()
      .slice(0, PET.nameMax);
  if (!pt || !nm) return false;
  pt.name = nm;
  touch();
  emit('pet', { what: 'name' });
  return true;
});
/**
 * Позаботиться о питомце: what — 'pet' (погладить), 'feed' (покормить: тратит корм), 'play' (поиграть: нужен мячик).
 * Возвращает, сколько очков дружбы прибавилось (первое за день — PET[what], потом 0), или false — нельзя (нет корма,
 * нет мячика, нет питомца). Очки не убывают никогда.
 */
export const petCare = act((what) => {
  const s = S(),
    pt = s.pet;
  if (!pt || !['pet', 'feed', 'play'].includes(what)) return false;
  if (what === 'feed' && !(pt.food > 0)) return false;
  if (what === 'play' && !pt.ball) return false;
  const key = what === 'feed' ? 'feedDay' : what, // fed — когда ел (для «голоден»), feedDay — день очков за еду
    first = pt[key] !== s.day,
    max = PET.heart * PET.hearts,
    was = pt.love;
  if (what === 'feed') {
    pt.food--;
    pt.fed = s.day;
  }
  pt[key] = s.day;
  if (first) pt.love = Math.min(max, pt.love + PET[what]);
  touch();
  emit('pet', { what, gain: pt.love - was });
  return pt.love - was;
});
/** Купили для питомца: 'food' — корм (n штук), 'ball' — мячик. */
export const addPetGood = act((id, n = 1) => {
  const pt = S().pet;
  if (!pt) return false;
  if (id === 'food') pt.food += n;
  else if (id === 'ball') pt.ball = true;
  else return false;
  touch();
  emit('pet', { what: 'good', id });
  return true;
});
/** Питомец ждёт дома (true) или гуляет вместе с хомячком (false). */
export const setPetStay = act((stay) => {
  const pt = S().pet;
  if (!pt) return;
  pt.stay = !!stay;
  touch();
  emit('pet', { what: 'stay' });
});

// ---------- транспорт (этап 17б) ----------
/** Купили самокат, велосипед или машинку: он сразу становится «тем, на чём езжу». */
export const addWheels = act((id) => {
  const w = S().wheels;
  if (!RIDE_BY_ID[id] || w.own.includes(id)) return false;
  w.own.push(id);
  w.use = id;
  touch();
  emit('wheels', { what: 'buy', id });
  return true;
});
/** Выбрать, на чём ездить (из купленного). */
export const useWheels = act((id) => {
  const w = S().wheels;
  if (!w.own.includes(id) || w.use === id) return false;
  w.use = id;
  touch();
  emit('wheels', { what: 'use', id });
  return true;
});

// ---------- двор (этап 17б) ----------
// state.yard.store — купленные, но не поставленные предметы (id → сколько); state.yard.at[двор] — что где стоит.
/** Купили предмет для двора — он ложится в «садовый сарайчик» (store). */
export const addYardItem = act((id, n = 1) => {
  if (!YARD_BY_ID[id]) return false;
  const st = S().yard.store;
  st[id] = (st[id] || 0) + n;
  touch();
  emit('yard', { what: 'buy', id });
  return true;
});
/** Поставить предмет из сарайчика на клетку двора; возвращает запись { id, x, y } или null. */
export const placeYard = act((yard, id, x, y) => {
  const yd = S().yard;
  if (!(yd.store[id] > 0)) return null;
  if (--yd.store[id] <= 0) delete yd.store[id];
  const it = { id, x, y };
  (yd.at[yard] || (yd.at[yard] = [])).push(it);
  touch();
  emit('yard', { what: 'place', yard, id });
  return it;
});
/** Переставить предмет двора на другую клетку. */
export const moveYard = act((yard, it, x, y) => {
  if (it.x === x && it.y === y) return;
  it.x = x;
  it.y = y;
  touch();
  emit('yard', { what: 'move', yard });
});
/** Убрать предмет двора обратно в сарайчик. */
export const stashYard = act((yard, it) => {
  const yd = S().yard,
    list = yd.at[yard] || [],
    i = list.findIndex((q) => q === it || (q.id === it.id && q.x === it.x && q.y === it.y));
  if (i < 0) return false;
  list.splice(i, 1);
  yd.store[it.id] = (yd.store[it.id] || 0) + 1;
  touch();
  emit('yard', { what: 'stash', yard, id: it.id });
  return true;
});
