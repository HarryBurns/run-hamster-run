// Чтение состояния (ничего не меняет): внешность игрока, болезнь, что есть у игрока, жильё и гости, отель,
// праздничные наряды жителей, сюжетные задания. Сцены и окна спрашивают это каждый кадр — дорогое кэшируется.
import { G, stateStamp } from './save.js';
import {
  CLOTHES,
  CLOTHES_BY_ID,
  TASK_BY_ID,
  guestHosts,
  poolGuestsOn,
  roomGuestOn,
  VISIT,
  HEALTH,
  FIND_BY_ID,
  QUESTS,
  QUEST_BY_ID,
  DRESS,
  resolveLook,
  HOLIDAY_DRESS,
  holidayOn,
  npcLook,
  HOME_BY_ID,
  HOME_SCENE,
  VILLA_UPS,
  VILLA_UP_BY_ID,
  bedsOf,
} from '../data/index.js';

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
 * Где житель города на самом деле — куда вести звёздочку задания «поговори с …» (features/quests.js) и что сказать
 * в журнале. { at, scene, where, home }:
 *   at    — 'guest' (в гостях у хомячка — в доме state.guestsAt), 'pool' (у бассейна отеля), 'room' (в номере 203),
 *           иначе npcWhere: 'home' / 'asleep' / 'out';
 *   scene — локация, где его искать (имя сцены: город или место, где стоит дом, — лесной домик в лесу);
 *   where — точка для sc.whereIs в этой локации: здание дома, где он в гостях (вилла, квартира, бунгало…), отель или
 *           сам житель 'npc:<id>' (на улице — где он сейчас идёт; зашёл к себе — у двери его домика);
 *   home  — id своего дома, где он в гостях (HOME_BY_ID), иначе null.
 * null — не житель города (жители тайных мест всегда в своей локации).
 */
export function npcSpot(id) {
  const s = G.state;
  if (!s || !s.friends[id]) return null;
  if (s.guests.includes(id)) {
    const h = HOME_BY_ID[s.guestsAt] || HOME_BY_ID.villa;
    return { at: 'guest', scene: h.loc || HOME_SCENE, where: h.building, home: h.id };
  }
  if (hotelPoolGuests().includes(id)) return { at: 'pool', scene: HOME_SCENE, where: 'hotel', home: null };
  if (hotelRoomGuest() === id) return { at: 'room', scene: HOME_SCENE, where: 'hotel', home: null };
  return { at: npcWhere(id), scene: HOME_SCENE, where: 'npc:' + id, home: null };
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
  return poolGuestsOn(s.day, s.minutes).filter(
    (id) => !(s.guests.includes(id) || invitedToday(id) || guestsWaiting().includes(id) || questBadge(id)),
  );
}

/** Кто из жителей сейчас гостит в номере 203 отеля (От1) — с теми же оговорками, что и у бассейна. */
export function hotelRoomGuest() {
  const s = G.state;
  if (!s) return null;
  const id = roomGuestOn(s.day, s.minutes);
  if (!id || s.guests.includes(id) || invitedToday(id) || guestsWaiting().includes(id) || questBadge(id)) return null;
  return id;
}

// ---------- «Вилла растёт» (data/estate.js; только чтение) ----------
/** Ступень дома: 0 — маленький домик, 1 — с пристройкой, 2 — два этажа, 3 — три, 4 — с мансардой и террасой. */
export const villaStage = () => (G.state && G.state.villaUp ? G.state.villaUp.house : 3);
/** Построено ли во дворе: 'pond' | 'pool' | 'green'. */
export const yardHas = (k) => !!(G.state && G.state.villaUp && G.state.villaUp[k]);
/** Номера купленных грядок (в state.garden), вместе с местами в теплице. */
export const gardenBeds = () => bedsOf(G.state.villaUp);
export const bedOwned = (i) => gardenBeds().includes(i);
/** Что строители сейчас строят (описание ступени) или null. */
export const villaBuilding = () => {
  const b = G.state && G.state.villaUp && G.state.villaUp.build;
  return (b && VILLA_UP_BY_ID[b.id]) || null;
};
/** Что можно заказать: 'ok' | 'done' (уже есть) | 'later' (сначала прошлая ступень или needs) | 'busy' (строители заняты). */
export function villaUpState(id) {
  const u = G.state.villaUp,
    d = VILLA_UP_BY_ID[id];
  if (!d) return 'later';
  if (u[d.kind] >= d.level) return 'done';
  if (u.build) return u.build.id === id ? 'building' : u[d.kind] === d.level - 1 ? 'busy' : 'later';
  return u[d.kind] === d.level - 1 ? 'ok' : 'later';
}
/** Следующая ступень каждого вида, которую ещё не построили (по порядку таблицы). */
export const villaUpsLeft = () => VILLA_UPS.filter((d) => G.state.villaUp[d.kind] < d.level);

/** Мебель дома по его ключу в сохранении: 'villa' — вилла, остальные лежат в state.homes. */
export function houseItems(key) {
  const s = G.state;
  return key === 'villa' ? s.villa : s.homes[key] || [];
}
/** В каких своих домах стоит вещь id (колесо, пианино) — не в кладовке; по порядку ownedHomes. */
export const homesWith = (id) => ownedHomes().filter((h) => houseItems(h).some((i) => i.id === id));

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
  const stamp = stateStamp();
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
