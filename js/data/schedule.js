// ДВИЖОК ПОВЕДЕНИЯ ЖИТЕЛЕЙ, слой данных: ЧТО житель делает и ГДЕ он — расписания, уточнения с приоритетом, условия.
// Чистые таблицы и чистые функции (годятся для Node: dev/npc_check.js). Состояние игры читает core/npc.js
// (npcPlan / npcNow), как житель выглядит в сцене (пришёл, идёт к выходу, ушёл) — engine/presence.js.
//
// Как устроено:
//   1. ОБЫЧНЫЙ ДЕНЬ жителя — NPC_ROUTINE[id].blocks: блоки без дыр от 0:00 до 24:00 ({ to, place, act, spot }),
//      сверху — правки variants ([{ if, blocks: [{ from, to, … }] }] — по сезону, по жребию дня).
//   2. УТОЧНЕНИЯ — один список NPC_RULES на всю игру, у каждого приоритет числом (больше — важнее): гости, сон,
//      «позвал к себе», праздник, гроза, отель. Побеждает первое по приоритету, чьё условие выполнено; ни одно —
//      обычный день.
//   3. УСЛОВИЯ — закрытый словарь COND (одно слово — одна функция от (значение, id, ctx)). Новое условие — новая
//      строка словаря, а не ветка в коде.
//   4. ОТВЕТ — resolveNpc(id, ctx) → Place: ровно одно место (сцена + имя точки в ней) и занятие.
// Поменять поведение = поправить строку в таблице. Проверка таблиц и полного года — node dev/npc_check.js.
import { HOTEL } from './economy.js';
import { dayRoll } from './stock.js';
import { SEASON_OF_MONTH, monthOfDay } from './calendar.js';
import { BAD_FORCE } from './weather.js';
import { NPCS, LAND_NPCS, NPC_BY_ID } from './npcs.js';
import { HOME_SCENE } from './places.js';
import { HOME_BY_ID } from './estate.js';
import { NPC_HOME, LAND_HOME } from './visits.js';
import { holidayOn, gatherOn } from './holidays.js';
import { poolGuestsOn, roomGuestOn, POOL_GUESTS, ROOM_GUESTS, GUEST_ROOM } from './hotel.js';

/** 'H:MM' → минуты от полуночи (число — как есть). */
export const hm = (t) => {
  if (typeof t === 'number') return t;
  const [h, m] = String(t).split(':').map(Number);
  return h * 60 + (m || 0);
};

/** Все жители с местом: жители города, хозяева тайных мест, работники. */
export const NPC_IDS = [...NPCS, ...LAND_NPCS].map((n) => n.id);
/** Сцена отеля и сцена номера, где гостит житель. */
export const HOTEL_SCENE = 'hotel';
export const GUEST_ROOM_SCENE = 'hotel_' + GUEST_ROOM;

/**
 * ТОЧКИ. Место = сцена + имя точки. Имена точек одни на всю игру; координаты — в описании сцены (жилец с полем
 * spot — interiors/, житель локации — locations/). Здесь — какие имена бывают (проверяет dev/npc_check.js):
 *   улица (город, тайное место):  post — у своего места (at), door — у своей двери, fest — на празднике;
 *                                 зимние и другие места — свои имена (spots жителя в описании локации);
 *   дом жителя (home_<id>, дом тайного места): in — внутри, bed — спит (не виден);
 *   свой дом хомячка: guest;   отель: pool, lobby, stage, hall, desk, cart, spa, off;   номер 203: room;
 *   башня: lift.
 */
export const NPC_SPOTS = {
  street: ['post', 'door', 'fest', 'winter'],
  house: ['in', 'bed'],
  own: ['guest'],
  [HOTEL_SCENE]: ['pool', 'lobby', 'stage', 'hall', 'desk', 'cart', 'spa', 'off'],
  [GUEST_ROOM_SCENE]: ['room'],
  tower: ['lift'],
};

// ---------- обычный день ----------
/** День жителя города: дома до out, на улице до back, дома до sleep, потом спит. */
const townDay = (out, back, sleep) => [
  { to: out, place: 'home' },
  { to: back, place: 'post', act: 'walk' },
  { to: sleep, place: 'home' },
  { to: '24:00', place: 'home', act: 'sleep' },
];
/**
 * День хозяина тайного места: дома до 9:00 и с back; ночью не спит (решение заказчика: в дальние места хомячок часто
 * попадает к полуночи — хозяин дома, пьёт чай и рад гостям). Иногда обедает дома (жребий дня).
 */
const landDay = (back) => ({
  blocks: [
    { to: '9:00', place: 'home' },
    { to: back, place: 'post', act: 'work' },
    { to: '24:00', place: 'home' },
  ],
  variants: [{ if: { roll: ['lunch', 0.35] }, blocks: [{ from: '13:00', to: '14:00', place: 'home', act: 'lunch' }] }],
});
/** Всегда на посту (работники, жители без дома): scene — сцена, где он стоит (нет — его локация), spot — точка. */
const onPost = (scene, spot = 'post', where = null) => ({
  scene,
  where,
  blocks: [{ to: '24:00', place: 'post', spot, act: 'work' }],
});

/**
 * РАСПИСАНИЯ. blocks — обычный день; variants — правки; talk — действие разговора на улице (у хозяев мест своё);
 * scene / where — у кого место не на улице своей локации: сцена и точка для звёздочки снаружи.
 */
export const NPC_ROUTINE = {
  plusha: { blocks: townDay('9:00', '19:00', '22:00') },
  ponchik: { blocks: townDay('9:00', '19:00', '22:00') },
  senya: { blocks: townDay('9:00', '19:00', '22:00') },
  busya: { blocks: townDay('9:00', '19:00', '22:00') },
  prof: { blocks: townDay('9:00', '19:00', '22:00') },
  myata: { blocks: townDay('9:00', '19:00', '22:00') },
  bob: { blocks: townDay('9:00', '19:00', '22:00') },
  zefirka: { blocks: townDay('9:00', '19:00', '22:00') },
  shishkin: { ...landDay('19:00'), talk: 'forester' },
  vershinkin: { ...landDay('19:00'), talk: 'instructor' },
  barkhan: { ...landDay('19:00'), talk: 'nomad' },
  liana: { ...landDay('19:00'), talk: 'explorer' },
  // на острове вечером (19–22) — праздник огней у костра: островитяне там, домой — после
  kokos: { ...landDay('22:00'), talk: 'chief' },
  bum: { ...landDay('22:00'), talk: 'islander:bum' },
  laguna: { ...landDay('22:00'), talk: 'islander:laguna' },
  kamushkin: { ...onPost(null), talk: 'miner' },
  pearl: { ...onPost(null), talk: 'mermaid' },
  etazhkin: onPost('tower', 'lift', 'tower'),
  zvezdochka: onPost(HOTEL_SCENE, 'desk', 'hotel'),
  telezhkin: onPost(HOTEL_SCENE, 'cart', 'hotel'),
  penka: onPost(HOTEL_SCENE, 'spa', 'hotel'),
  // аниматор: в свои часы — у сцены на террасе или в холле (уточнения ниже), остальное время отдыхает (её не видно)
  hlopushka: { scene: HOTEL_SCENE, where: 'hotel', blocks: [{ to: '24:00', place: 'post', spot: 'off', act: 'rest', hidden: true }] },
};

// ---------- уточнения ----------
const TOWN = NPCS.map((n) => n.id);
const hours = (a) => [a.morning, a.evening];
/**
 * УТОЧНЕНИЯ к обычному дню: prio — важность (больше — важнее), who — кому ('town' — жители города, список id),
 * if — условие (слова COND), place — вид места (PLACE ниже), act — занятие, free — можно ли его в это время
 * позвать в гости и может ли он прийти сам (npcFree в core/npc.js).
 */
export const NPC_RULES = [
  { id: 'guest', prio: 100, who: 'town', if: { guest: true }, place: 'playerHome', act: 'guest' },
  { id: 'sleep', prio: 80, who: 'town', if: { routine: 'sleep' }, place: 'bed', act: 'sleep' },
  { id: 'invited', prio: 70, who: 'town', if: { invited: true }, place: 'home', act: 'host' },
  { id: 'pool', prio: 65, who: [...POOL_GUESTS, ...ROOM_GUESTS], if: { slot: 'hotel:pool', not: { any: [{ weather: 'roofWet' }, { badge: true }] } }, place: 'pool', act: 'swim', free: true },
  { id: 'room203', prio: 64, who: ROOM_GUESTS, if: { slot: 'hotel:room', not: { badge: true } }, place: 'room', act: 'rest', free: true },
  { id: 'fest', prio: 60, who: 'town', if: { gather: ['ring', 'skate', 'crowd', 'dance', 'parade'] }, place: 'fest', act: 'fest' },
  { id: 'doors', prio: 60, who: 'town', if: { gather: ['doors'] }, place: 'door', act: 'greet' },
  { id: 'storm', prio: 50, who: 'town', if: { weather: 'bad' }, place: 'home', act: 'home' },
  { id: 'animator-roof', prio: 40, who: ['hlopushka'], if: { hours: hours(HOTEL.animator), not: { weather: 'roofWet' } }, place: 'stage', act: 'show' },
  { id: 'animator-hall', prio: 39, who: ['hlopushka'], if: { hours: hours(HOTEL.animator) }, place: 'hall', act: 'show' },
];

// ---------- условия ----------
const seasonOf = (day) => SEASON_OF_MONTH[monthOfDay(day)];
/**
 * СЛОВАРЬ УСЛОВИЙ: слово → (значение из таблицы, id жителя, ctx) → да / нет. В объекте условия все слова должны
 * выполниться разом. ctx — см. resolveNpc.
 */
export const COND = {
  /** С этой минуты и до конца дня: from: '22:00'. */
  from: (v, id, c) => c.minutes >= hm(v),
  /** До этой минуты: to: '9:00'. */
  to: (v, id, c) => c.minutes < hm(v),
  /** В одном из промежутков, часы: hours: [[8, 10], [19, 21.5]]. */
  hours: (v, id, c) => v.some(([a, b]) => c.minutes >= a * 60 && c.minutes < b * 60),
  /** Сезон: 'winter' или список. */
  season: (v, id, c) => [].concat(v).includes(seasonOf(c.day)),
  /** Праздничное сборище сейчас (HOLIDAY_GATHER) — одного из этих видов. */
  gather: (v, id, c) => {
    const g = gatherNow(c);
    return !!g && v.includes(g.kind);
  },
  /** Погода: 'bad' — ливень, гроза, метель; 'wet' — любой дождь; 'roofWet' — на открытой террасе отеля мокро. */
  weather: (v, id, c) => WEATHER[v](c),
  /** Жребий дня (перезагрузка его не меняет): roll: ['lunch', 0.35] — доля дней, у каждого жителя свои. */
  roll: ([key, p], id, c) => dayRoll(c.day, key + ':' + id) < p,
  /** Его смена по расписанию отеля: 'hotel:pool' — у бассейна, 'hotel:room' — гостит в номере 203. */
  slot: (v, id, c) => SLOT[v](id, c),
  /** Он в гостях у хомячка (state.guests). */
  guest: (v, id, c) => c.guests.includes(id) === v,
  /** Сегодня позвал к себе (сказал «Заходи!» или хозяин «дня гостей» из прочитанного письма). */
  invited: (v, id, c) => !!c.invited[id] === v,
  /** У него дело по журналу заданий («!» или «?»). */
  badge: (v, id, c) => !!(c.badges && c.badges[id]) === v,
  /** Занятие по обычному дню сейчас: routine: 'sleep'. */
  routine: (v, id, c) => routineBlock(id, c).act === v,
  not: (v, id, c) => !test(v, id, c),
  any: (v, id, c) => v.some((q) => test(q, id, c)),
};
const WEATHER = {
  bad: (c) => c.weather.force >= BAD_FORCE,
  wet: (c) => c.weather.kind === 'rain',
  roofWet: (c) => c.weather.force >= BAD_FORCE || c.weather.kind === 'rain',
};
const SLOT = {
  'hotel:pool': (id, c) => poolGuestsOn(c.day, c.minutes).includes(id),
  'hotel:room': (id, c) => roomGuestOn(c.day, c.minutes) === id,
};
/** Выполнено ли условие cond для жителя id. Пустое условие — да. */
export function test(cond, id, ctx) {
  if (!cond) return true;
  for (const k in cond) if (!COND[k](cond[k], id, ctx)) return false;
  return true;
}
/** Праздничное сборище сейчас: строка HOLIDAY_GATHER или null. */
function gatherNow(c) {
  const hol = holidayOn(c.day, c.startDay || 0);
  return hol ? gatherOn(hol.id, c.minutes) : null;
}

// ---------- обычный день: блок сейчас ----------
// блоки с готовыми минутами (считаются один раз)
const READY = {};
for (const id of NPC_IDS) {
  const r = NPC_ROUTINE[id];
  if (!r) continue;
  READY[id] = {
    blocks: r.blocks.map((b) => ({ ...b, m1: hm(b.to) })),
    variants: (r.variants || []).map((v) => ({
      if: v.if,
      blocks: v.blocks.map((b) => ({ ...b, m0: hm(b.from), m1: hm(b.to) })),
    })),
  };
}
/** Блок обычного дня жителя сейчас (с правками variants). */
export function routineBlock(id, ctx) {
  const r = READY[id],
    m = ctx.minutes;
  for (const v of r.variants) {
    const b = v.blocks.find((q) => m >= q.m0 && m < q.m1);
    if (b && test(v.if, id, ctx)) return b;
  }
  return r.blocks.find((b) => m < b.m1) || r.blocks[r.blocks.length - 1];
}

// ---------- место ----------
// уточнения каждого жителя по убыванию важности (считаются один раз)
const RULES_OF = {};
for (const id of NPC_IDS)
  RULES_OF[id] = NPC_RULES.filter((r) => (r.who === 'town' ? TOWN.includes(id) : r.who.includes(id))).sort(
    (a, b) => b.prio - a.prio,
  );
/** Уточнения жителя id по убыванию важности. */
export const rulesOf = (id) => RULES_OF[id] || [];

/**
 * ВИДЫ МЕСТ: вид → поля ответа. b — основа ответа (id, rule, act, свой дом house, локация land), o — блок или
 * уточнение (spot, act), ctx — как у resolveNpc.
 *   at — короткое имя для старого кода (npcPlace): out | home | asleep | door | fest | guest | pool | room.
 */
const PLACE = {
  /** У себя дома, рад гостям. */
  home: (b) => ({ scene: b.house, spot: 'in', at: 'home', talk: NPC_HOME[b.id] ? 'host:' + b.id : b.talk }),
  /** Дома и спит: внутри его не видно. */
  bed: (b) => ({ scene: b.house, spot: 'bed', at: 'asleep', visible: false }),
  /** На улице своей локации у своего места (или в своей сцене на посту — работники). */
  post: (b, o) => ({ scene: b.post || b.land, spot: o.spot || 'post', at: 'out', visible: !o.hidden }),
  /** Праздник: у своей двери встречает гостей (дверь открыта). */
  door: (b, o, c) => ({ scene: b.land, spot: 'door', at: 'door', fest: (gatherNow(c) || {}).where || null }),
  /** Праздник: на сборище в городе. */
  fest: (b, o, c) => ({ scene: b.land, spot: 'fest', at: 'fest', fest: (gatherNow(c) || {}).where || null }),
  /** В гостях у хомячка — в том её доме, куда позвали. */
  playerHome: (b, o, c) => {
    const h = HOME_BY_ID[c.guestsAt] || HOME_BY_ID.villa;
    return { scene: h.id, spot: 'guest', at: 'guest', home: h.id, talk: 'guest:' + b.id, outdoor: { scene: h.loc || HOME_SCENE, where: h.building } };
  },
  pool: () => ({ scene: HOTEL_SCENE, spot: 'pool', at: 'pool', outdoor: { scene: HOME_SCENE, where: 'hotel' } }),
  room: () => ({ scene: GUEST_ROOM_SCENE, spot: 'room', at: 'room', outdoor: { scene: HOME_SCENE, where: 'hotel' } }),
  stage: () => ({ scene: HOTEL_SCENE, spot: 'stage', at: 'out' }),
  hall: () => ({ scene: HOTEL_SCENE, spot: 'hall', at: 'out' }),
};
/** Какие виды мест бывают (для проверки таблиц). */
export const PLACE_KINDS = Object.keys(PLACE);

/**
 * Собрать ответ: житель id в месте вида kind по правилу rule (o — блок расписания или уточнение).
 * Place = {
 *   id, rule        кто и какое правило победило ('guest', 'sleep', 'pool'…, 'routine' — обычный день);
 *   scene, spot     РОВНО ОДНО МЕСТО: сцена, где его показывают, и имя точки в ней;
 *   act             занятие: walk | work | home | host | lunch | sleep | guest | swim | rest | fest | greet | show;
 *   visible         false — он там, но его не видно (спит у себя; аниматор не на смене);
 *   outdoor         { scene, where } — как дойти: уличная локация и точка для sc.whereIs (звёздочка, подсказки);
 *   talk            действие разговора с ним здесь;
 *   free            можно ли его сейчас позвать в гости;
 *   at, home, house, fest — для старого кода (npcPlace): короткое имя места, дом хомячка, его дом, слова праздника.
 * }
 */
export function makePlace(id, ctx, rule, kind, o = {}) {
  const R = NPC_ROUTINE[id],
    L = LAND_HOME[id],
    land = NPC_BY_ID[id].land || HOME_SCENE,
    b = {
      id,
      land,
      post: R.scene || null,
      house: NPC_HOME[id] ? 'home_' + id : L ? L.house : null,
      talk: R.talk || 'npc:' + id,
    };
  return {
    id,
    rule,
    act: o.act || (kind === 'home' ? 'home' : 'walk'),
    visible: true,
    outdoor: { scene: land, where: R.where || 'npc:' + id },
    talk: b.talk,
    free: rule === 'routine' || !!o.free,
    home: null,
    house: b.house,
    fest: null,
    ...PLACE[kind](b, o, ctx),
  };
}

/**
 * ГДЕ ЖИТЕЛЬ И ЧТО ДЕЛАЕТ — по расписанию и состоянию (без удержаний — их добавляет core/npc.js).
 * ctx = { day, minutes, startDay, weather: { kind, force }, guests: [id], guestsAt, invited: { id: true },
 *         badges: { id: true } }. Чистая функция: один и тот же ctx — один и тот же ответ.
 */
export function resolveNpc(id, ctx) {
  for (const r of RULES_OF[id]) if (test(r.if, id, ctx)) return makePlace(id, ctx, r.id, r.place, r);
  const b = routineBlock(id, ctx);
  return makePlace(id, ctx, 'routine', b.place, b);
}

/** Одно ли это место и занятие (для «сменил место» и для счёта отрезков дня). */
export const samePlace = (a, b) => !!a && !!b && a.scene === b.scene && a.spot === b.spot && a.act === b.act && a.rule === b.rule;

/**
 * До какой минуты ответ не изменится (при том же состоянии и погоде): минута, когда житель окажется в другом месте
 * или займётся другим; 24 * 60 — до конца дня.
 */
export function npcUntil(id, ctx) {
  const now = resolveNpc(id, ctx);
  for (let m = Math.floor(ctx.minutes) + 1; m < 1440; m++)
    if (!samePlace(now, resolveNpc(id, { ...ctx, minutes: m }))) return m;
  return 1440;
}

/**
 * День жителя отрезками: [{ from, to, place }] — для проверки и показа (dev/npc_check.js --who …, __dev.npc.table).
 * weatherAt(minutes) → { kind, force } — погода по часам (нет — та, что в ctx).
 */
export function npcDay(id, ctx, from = 0, weatherAt = null) {
  const out = [];
  let cur = null;
  for (let m = from; m < 1440; m++) {
    const p = resolveNpc(id, { ...ctx, minutes: m, weather: weatherAt ? weatherAt(m) : ctx.weather });
    if (cur && samePlace(cur.place, p)) continue;
    if (cur) cur.to = m;
    cur = { from: m, to: 1440, place: p };
    out.push(cur);
  }
  return out;
}
