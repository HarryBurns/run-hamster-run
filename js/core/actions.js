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
import { G, touch, cal, hasClothes, houseItems } from './state.js';
import { emit } from './events.js';
import { NPCS, FURN_BY_ID } from '../data/index.js';

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
/** Прибавить очки дружбы. */
export const addFriendPts = act((id, n) => {
  S().friends[id].pts += n;
  touch();
});
/** Запомнить, что сегодня уже болтали / дарили / угощали (kind: chat | gift | treat). */
export const markFriendToday = act((id, kind) => {
  S().friends[id][kind] = S().day;
  touch();
});
/** Сколько гостей может быть дома сразу. */
export const MAX_GUESTS = 3;
/** Позвать жителя в гости. false — уже в гостях или дом полон. */
export const inviteGuest = act((id) => {
  const s = S();
  if (s.guests.includes(id) || s.guests.length >= MAX_GUESTS) return false;
  s.guests.push(id);
  touch();
  emit('guests');
  return true;
});
/** Проводить гостя домой. */
export const removeGuest = act((id) => {
  const s = S();
  s.guests = s.guests.filter((g) => g !== id);
  touch();
  emit('guests');
});
/** Гость, который сегодня собирался прийти сам: забрать его из «планов» (вернёт id или null). */
export const takeVisitor = act(() => {
  const id = S().visitor;
  S().visitor = null;
  touch();
  return id;
});

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
  const s = S();
  if (s.minutes < DAY_END) s.minutes = Math.min(DAY_END, s.minutes + dt / 0.6);
});
/** Занятие отняло n игровых минут (но не позже cap). */
export const spendMinutes = act((n, cap = DAY_END) => {
  const s = S();
  s.minutes = Math.min(cap, s.minutes + n);
  touch();
});
// Погода на день: sun | rain | snow | petals | leaves
function rollWeather() {
  const s = cal().season,
    r = Math.random();
  if (s === 'winter') return r < 0.65 ? 'snow' : 'sun';
  if (s === 'spring') return r < 0.25 ? 'rain' : r < 0.75 ? 'petals' : 'sun';
  if (s === 'summer') return r < 0.1 ? 'rain' : 'sun';
  return r < 0.3 ? 'rain' : 'leaves';
}
/** Наступил следующий день: утро, грядки подросли, новая погода, гости разошлись. */
export const nextDay = act(() => {
  const s = S();
  s.day++;
  s.minutes = 7 * 60 + 30;
  for (const b of s.garden) if (b.seed) b.age++;
  s.weather = rollWeather();
  s.guests = [];
  s.visitor = Math.random() < 0.35 ? NPCS[Math.floor(Math.random() * NPCS.length)].id : null;
  s.dayFlags = {}; // вместе с отметками дня обнуляются оплаченные смены (shifts) и кошелёк торговца (marketPaid)
  s.ledger = { today: { in: {}, out: 0 }, yesterday: s.ledger.today };
  touch();
  emit('guests');
});

// ---------- отметки ----------
/** Отметка навсегда (flags) — «подсказку уже показывали», «сундук уже открывали». */
export const setFlag = act((name, value = 1) => {
  S().flags[name] = value;
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
