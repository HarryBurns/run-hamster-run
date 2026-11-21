// ДВИЖОК ПОВЕДЕНИЯ ЖИТЕЛЕЙ, слой состояния: ГДЕ ЖИТЕЛЬ СЕЙЧАС. Читает состояние игры и ничего в нём не меняет.
// Таблицы (расписания, уточнения, условия) и чистый расчёт — data/schedule.js; как житель выглядит в сцене
// (пришёл, идёт к выходу, ушёл) — engine/presence.js.
//
//   npcPlan(id)   где он должен быть по расписанию и состоянию (гости, «позвал к себе», праздник, погода, отель);
//   npcNow(id)    где он СЕЙЧАС — то же, но с удержаниями (договаривает с хомячком, она у него дома, сидит с ней на
//                 скамейке, ещё идёт к выходу). ЭТО И ЕСТЬ ОТВЕТ ДЛЯ ВСЕХ: сцен, подсказок, звёздочки, заданий;
//   npcsIn(scene) кто сейчас в этой сцене — единственный источник «кто тут» для сцен.
// Ответ — Place (data/schedule.js: makePlace): ровно одно место (scene + spot), занятие act, как дойти (outdoor).
// У КАЖДОГО ЖИТЕЛЯ В КАЖДЫЙ МОМЕНТ РОВНО ОДНО МЕСТО: сцена показывает жителя тогда и только тогда, когда
// npcNow(id).scene — она сама.
//
// УДЕРЖАНИЯ (только в памяти, в сохранение не идут): житель остаётся там, где его видит хомячок.
//   holdNpc(id, why, { until, place })   why: 'talk' — разговор и немного после; 'host' — хомячок у него в доме или
//                                        в номере; 'sit' — сидит с ней рядом; 'leaving' — уже пора, но он ещё идёт
//                                        к выходу (ставит engine/presence.js);
//   releaseNpc(id, why)                  снять;  releaseHolds() — снять все (хомячок ушла в другую сцену).
// «В гостях у хомячка» — состояние, а не удержание: гость важнее разговора и «хомячок у него».
import { G, stateStamp } from './save.js';
import { questBadge, guestsWaiting, weatherNow } from './queries.js';
import { NPC_HOME, LAND_HOME, NPC_IDS, resolveNpc, makePlace, npcUntil, npcDay, weatherPart } from '../data/index.js';

let ctxState = null,
  ctxKey = '',
  ctx = null,
  planCache = {},
  nowCache = {},
  holdVer = 0;
/** Собрать ctx для resolveNpc из состояния игры (кэш — до следующего изменения состояния, минуты, погоды, удержаний). */
function context() {
  const s = G.state,
    key = `${stateStamp()}|${Math.floor(s.minutes)}|${s.day}|${s.weather}${s.wxStrong}|${holdVer}`;
  if (ctxState === s && ctxKey === key) return ctx;
  ctxState = s;
  ctxKey = key;
  planCache = {};
  nowCache = {};
  const invited = { ...(s.dayFlags.invited || {}) },
    badges = {};
  for (const id of guestsWaiting()) invited[id] = true;
  for (const id of NPC_IDS) if (questBadge(id)) badges[id] = true;
  ctx = {
    day: s.day,
    minutes: s.minutes,
    startDay: s.startDay || 0,
    weather: weatherNow(s),
    guests: s.guests,
    guestsAt: s.guestsAt,
    invited,
    badges,
  };
  return ctx;
}
/** ctx движка сейчас (для отладки и проверок: __dev.npc). */
export const npcContext = () => (G.state ? context() : null);

/** Где житель должен быть по расписанию и состоянию — без удержаний. null — игры нет или житель неизвестен. */
export function npcPlan(id) {
  if (!G.state) return null;
  const c = context();
  if (!(id in planCache)) planCache[id] = NPC_IDS.includes(id) ? resolveNpc(id, c) : null;
  return planCache[id];
}

// ---------- удержания ----------
const holds = () => G.npcHold || (G.npcHold = {});
/** Действующее удержание жителя: { place, day, why: { причина: до какой минуты } } или null (истёкшие — убираются). */
function heldOf(id) {
  const h = holds()[id],
    s = G.state;
  if (!h) return null;
  let live = false;
  if (h.day === s.day) for (const k in h.why) if (s.minutes < h.why[k]) live = true;
  if (!live) {
    delete holds()[id];
    return null;
  }
  return h;
}
/** Причины удержаний по убыванию важности ('put' — отладочное: __dev.npc.put). */
const HOLDS = ['leaving', 'put', 'host', 'sit', 'talk'];
const active = (h, why) => !!h && h.why[why] != null && G.state.minutes < h.why[why];
/**
 * Удержать жителя там, где он сейчас (или в месте place): why — причина, until — до какой минуты игры (нет — пока
 * не снимут). Место запоминается при первом удержании: следующие причины его не меняют.
 */
export function holdNpc(id, why, { until = Infinity, place = null } = {}) {
  if (!G.state) return;
  const h = heldOf(id);
  if (h) h.why[why] = until;
  else {
    const p = place || npcNow(id);
    if (!p) return;
    holds()[id] = { place: p, day: G.state.day, why: { [why]: until } };
  }
  holdVer++;
}
/** Снять удержание жителя по причине why (остальные причины остаются). */
export function releaseNpc(id, why) {
  const h = holds()[id];
  if (!h || !(why in h.why)) return;
  delete h.why[why];
  if (!Object.keys(h.why).length) delete holds()[id];
  holdVer++;
}
/** Снять все удержания (хомячок ушла в другую сцену — держать некого). */
export function releaseHolds() {
  G.npcHold = {};
  holdVer++;
}
/** Почему житель удержан сейчас: 'talk' | 'host' | 'sit' | 'leaving' или null. */
export function npcHeld(id) {
  const h = G.state ? heldOf(id) : null;
  return h ? HOLDS.find((w) => active(h, w)) || null : null;
}

/**
 * ГДЕ ЖИТЕЛЬ СЕЙЧАС (Place — data/schedule.js). Порядок: ещё идёт к выходу (его видно — он здесь) → в гостях
 * у хомячка → удержан (разговор, она у него, сидит рядом) → по расписанию (npcPlan).
 */
export function npcNow(id) {
  const plan = npcPlan(id);
  if (!plan) return null;
  if (id in nowCache) return nowCache[id];
  const h = heldOf(id);
  return (nowCache[id] = h && (active(h, 'leaving') || plan.rule !== 'guest') ? h.place : plan);
}
/**
 * Где жителю ПОРА быть: как npcNow, но «ещё идёт к выходу» не в счёт. По нему сцена решает, уходить ему или
 * возвращаться (engine/presence.js); всем остальным нужен npcNow.
 */
export function npcDue(id) {
  const plan = npcPlan(id);
  if (!plan) return null;
  const h = heldOf(id);
  if (!h || plan.rule === 'guest') return plan;
  return HOLDS.some((w) => w !== 'leaving' && active(h, w)) ? h.place : plan;
}
/** Место жителя вида kind («как будто он дома»: 'home') по сегодняшнему состоянию — для удержаний. */
export const npcPlaceAs = (id, kind, o = {}) => makePlace(id, context(), o.rule || kind, kind, o);

/** Кто сейчас в сцене scene (имя сцены): [Place]. Спящих и тех, кого не видно, — тоже (visible: false). */
export function npcsIn(scene) {
  if (!G.state) return [];
  const out = [];
  for (const id of NPC_IDS) {
    const p = npcNow(id);
    if (p.scene === scene) out.push(p);
  }
  return out;
}
/** До какой минуты житель останется там, где сейчас (по расписанию; удержания не в счёт). */
export const npcStays = (id) => npcUntil(id, context());
/** День жителя отрезками [{ from, to, place }] — с погодой по часам (для отладки: __dev.npc.table). */
export function npcToday(id, from = 0) {
  const s = G.state,
    c = context();
  return npcDay(id, c, from, (m) => {
    const w = weatherPart(s.day, m, s.startDay || 0);
    return { kind: w.kind, force: w.force };
  });
}

// ---------- старые имена (features/quests.js и другие: короткий ответ { at, scene, where, home, house, fest }) ----------
/**
 * Где житель — коротко, как раньше: at — 'guest' | 'pool' | 'room' | 'fest' | 'door' | 'home' | 'asleep' | 'out';
 * scene и where — уличная локация и точка для sc.whereIs (npcNow(id).outdoor); home — дом хомячка, где он в гостях;
 * house — сцена его дома; fest — слова праздника. null — житель без дома (работники, Камушкин, Жемчужинка).
 * Новому коду — npcNow.
 */
export function npcPlace(id) {
  if (!G.state || !(NPC_HOME[id] || LAND_HOME[id])) return null;
  const p = npcNow(id);
  return (
    p.short ||
    (p.short = { at: p.at, scene: p.outdoor.scene, where: p.outdoor.where, home: p.home, house: p.house, fest: p.fest })
  );
}
export const npcSpot = npcPlace;
/** Дома ли житель и рад гостям: 'home' или праздничное «у своей двери». */
export function npcAtHome(id) {
  const p = npcPlace(id);
  return !!p && (p.at === 'home' || p.at === 'door');
}
/** Коротко для двери домика и разговоров: 'guest' | 'asleep' | 'home' (и «у своей двери») | 'out'. */
export function npcWhere(id) {
  const p = npcPlace(id),
    at = p ? p.at : 'out';
  return at === 'door' ? 'home' : at === 'guest' || at === 'asleep' || at === 'home' ? at : 'out';
}
/** Кто из жителей сейчас у бассейна отеля: [id]. */
export const hotelPoolGuests = () =>
  npcsIn('hotel')
    .filter((p) => p.spot === 'pool')
    .map((p) => p.id);
/** Кто из жителей сейчас гостит в номере 203 отеля — id или null. */
export const hotelRoomGuest = () => (npcsIn('hotel_203')[0] || {}).id || null;
