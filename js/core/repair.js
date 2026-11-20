// Перенос сохранения между версиями (MIGRATIONS) и починка (repair): самое рискованное место сохранений, поэтому
// отдельно. Здесь только чистые функции над объектом сохранения — без G и без хранилища (их держит core/save.js).
// Проверка без браузера — node dev/test_saves.js.
import {
  MIGRATED_MONEY,
  START_RECIPES,
  CLOTHES_BY_ID,
  NPCS,
  NPC_BY_ID,
  FURN_BY_ID,
  ING_BY_ID,
  DISH_BY_ID,
  SEED_BY_ID,
  TASK_BY_ID,
  HOME_BY_ID,
  BIZ_BY_ID,
  HEALTH,
  FIND_BY_ID,
  QUEST_BY_ID,
  LAND_BY_ID,
  defaultLook,
  PARROT_WORD_BY_ID,
  PARROT_MEMORY,
  PET,
  NAME_MAX,
  BIZ_TITLE_MAX,
  PET_BY_ID,
  RIDE_BY_ID,
  YARD_BY_ID,
  YARD_BY_ID_HOME,
  VILLA_UP_OLD,
  VILLA_UP_MAX,
  VILLA_UP_BY_ID,
  GARDEN_SIZE,
  BUILD,
} from '../data/index.js';

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

/**
 * Часы виллы в старых играх. Раньше часы в начале игры висели в гостиной на x 660 (высота 185) — на раме окна
 * (x 640); в новой игре они над телевизором (x 800, высота 190; START_VILLA в core/save.js). Здесь — то же для уже
 * начатых игр: часы, которые так и висят на старом месте (игрок их не трогал — после перетаскивания координаты
 * дробные), переезжают на новое место, а если оно занято другим настенным предметом — на ближайшее свободное место
 * стены первого этажа без окна. Окна и перегородки первого этажа — как в interiors/villa.js (сюда, в core, описание
 * дома не попадает); рама окна — x ± 52, от 104 до 208 над полом (engine/side/rooms.js, windowAt).
 */
const VILLA_CLOCK = { floor: 0, old: [660, 185], spot: [800, 190], wins: [640, 1500], walls: [220, 920], w: 1600 };
function moveVillaClock(villa) {
  const c = VILLA_CLOCK,
    clock = villa.find((i) => i.id === 'clock' && i.floor === c.floor && i.x === c.old[0] && i.y === c.old[1]);
  if (!clock) return;
  const d = FURN_BY_ID.clock,
    y = c.spot[1];
  const free = (x) =>
    x - d.w / 2 >= 6 &&
    x + d.w / 2 <= c.w - 6 &&
    c.wins.every((wx) => Math.abs(x - wx) >= d.w / 2 + 52 || y - d.h / 2 >= 208 || y + d.h / 2 <= 104) &&
    c.walls.every((wx) => Math.abs(x - wx) >= d.w / 2 + 12) &&
    villa.every(
      (o) =>
        o === clock ||
        o.floor !== c.floor ||
        !FURN_BY_ID[o.id].wall ||
        Math.abs(o.x - x) >= (FURN_BY_ID[o.id].w + d.w) / 2 ||
        Math.abs(o.y - y) >= (FURN_BY_ID[o.id].h + d.h) / 2,
    );
  for (let k = 0; k <= c.w; k += 10)
    for (const x of [c.spot[0] - k, c.spot[0] + k])
      if (free(x)) {
        clock.x = x;
        clock.y = y;
        return;
      }
}

/** Учёт денег за два дня: in — доход по источникам (work, market, task…), out — траты. */
export const newLedger = () => ({ today: { in: {}, out: 0 }, yesterday: { in: {}, out: 0 } });

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
    s.parrots[k] = Array.isArray(s.parrots[k])
      ? s.parrots[k].filter((id) => PARROT_WORD_BY_ID[id]).slice(-PARROT_MEMORY)
      : [];
  for (const k of Object.keys(s.visited)) obj(s.visited, k);
  // питомец, транспорт, двор (этап 17б): в старом сохранении полей нет — питомца нет, транспорта нет, двор как был
  {
    const pt = s.pet;
    if (!pt || typeof pt !== 'object' || !PET_BY_ID[pt.kind]) s.pet = null;
    else {
      // имя — без пробелов по краям и не длиннее поля ввода (как бы ни попало в сохранение: файл, старая игра)
      pt.name = (typeof pt.name === 'string' && pt.name.trim().slice(0, PET.nameMax)) || PET_BY_ID[pt.kind].names[0];
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
    s.mayBeds.b = [...new Set(Array.isArray(s.mayBeds.b) ? s.mayBeds.b : [])].filter(
      (i) => Number.isInteger(i) && i >= 0 && i < 8,
    );
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
    // своё название на вывеске — строка не длиннее поля «Вывеска»; пустое — название по умолчанию
    if ('title' in b) {
      const t = typeof b.title === 'string' ? b.title.trim().slice(0, BIZ_TITLE_MAX) : '';
      if (t) b.title = t;
      else delete b.title;
    }
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
  s.name = (typeof s.name === 'string' && s.name.trim().slice(0, NAME_MAX)) || 'Хомка';
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
  moveVillaClock(s.villa);
  for (const k of Object.keys(s.homes)) s.homes[k] = fixItems(s.homes[k]);
  s.uid = Math.max(
    Number.isFinite(s.uid) ? s.uid : 1,
    ...[s.villa, ...Object.values(s.homes)].flat().map((i) => (i.uid || 0) + 1),
  );
  // «Вилла растёт»: у игры, начатой раньше (поля нет), построено всё, что было на вилле, — ничего не отбираем
  {
    const u = s.villaUp && typeof s.villaUp === 'object' && !Array.isArray(s.villaUp) ? s.villaUp : null,
      up = { ...VILLA_UP_OLD };
    if (u)
      for (const k of Object.keys(VILLA_UP_MAX))
        up[k] = Number.isInteger(u[k]) ? Math.max(0, Math.min(VILLA_UP_MAX[k], u[k])) : 0;
    // заказ строителям: известная ступень, следующая по порядку, день заказа — число
    const b = u && u.build && typeof u.build === 'object' ? u.build : null,
      def = b ? VILLA_UP_BY_ID[b.id] : null;
    up.build = def && up[def.kind] === def.level - 1 && Number.isFinite(b.day) ? { id: def.id, day: b.day } : null;
    s.villaUp = up;
  }
  // грядки: всегда GARDEN_SIZE мест (какие из них куплены — bedsOf(villaUp), data/estate.js), семена — только известные
  s.garden = Array.from({ length: GARDEN_SIZE }, (_, i) => {
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
  s.build = BUILD; // сохранение теперь пишет этот код (data/build.js); более новое сюда не доходит — см. checkSave
  return s;
}
