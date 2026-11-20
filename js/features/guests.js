// КОГДА ГОСТИ УХОДЯТ (баги заказчика 20 ноября: гости сидели в доме до ночи, даже когда хомячка нет дома).
// Как гость пришёл — inviteGuest(id, дом, how) в core/actions.js, отметка дня dayFlags.guestHow:
//   'self'  — пришёл сам («тук-тук» — features/friends.js; сосед вводной цепочки — features/welcome.js): поговорил,
//             подарил — и уходит, когда хомячок выходит из дома. Выходит вместе с ней (встаёт рядом у двери) и идёт
//             по своим делам: если у него взятое задание — к месту из задания (Плюша — к ТЦ «Модный»: можно идти
//             за ней), иначе — как обычно (днём к своему месту, вечером домой).
//             Хомячок ушла не на улицу у дома (карта мира, такси…) — гость просто ушёл.
//   'call'  — позвали (телефон, разговор; и все без отметки), 'party' — гость праздника (день рождения): ждут
//             хомячка, но не вечно — её нет дома GUESTS_WAIT игровых минут (dayFlags.guestsAway — с какой минуты) —
//             расходятся по домам.
// Всех: в VISIT.sleep (22:00) — «уже поздно», и когда хомячок ложится спать (features/sleep.js — guestsGoToBed).
// Где житель после этого — по общему правилу npcPlace (core/queries.js): он больше не гость.
import { sendGuestsHome, setDayFlag } from '../core/actions.js';
import { on } from '../core/events.js';
import { scene, scenes, every } from '../core/loop.js';
import { G, questNow } from '../core/state.js';
import { NPC_BY_ID, QUESTS, VISIT } from '../data/index.js';
import { walkOutWith } from '../engine/topdown/index.js';
import { toast } from '../ui/toast.js';

const S = () => G.state;
/** Сколько игровых минут позванные гости ждут хомячка в пустом доме. */
export const GUESTS_WAIT = 120;

/** Как пришёл гость: 'self' | 'call' | 'party'. */
export const guestHow = (id) => (S().dayFlags.guestHow || {})[id] || 'call';
/** Сцена sc — тот свой дом, где сейчас гости. */
const guestHouse = (sc) => !!sc && !!sc.owned && sc.houseKey === (S().guestsAt || 'villa');
/** Кто: «Плюша», «Плюша и Мята», «Плюша, Мята и Сеня». */
const names = (ids) => {
  const n = ids.map((id) => NPC_BY_ID[id].name);
  return n.length > 1 ? `${n.slice(0, -1).join(', ')} и ${n[n.length - 1]}` : n[0] || '';
};

/** Куда идёт гость, вышедший от хомячка: точка места из его взятого задания в этой локации (или null). */
function errand(sc, id) {
  for (const q of QUESTS) {
    if (q.npc !== id || (q.loc && q.loc !== sc.name)) continue;
    const w = questNow(q.id);
    if (w.status !== 'active') continue;
    const step = q.steps.find((st, i) => !w.steps[i].ok && st.where && !st.where.startsWith('npc:'));
    const pt = step && sc.whereIs ? sc.whereIs(step.where) : null;
    if (pt) return pt;
  }
  return null;
}

on('scene', ({ from }) => {
  const s = S();
  if (!s) return;
  const sc = scene(),
    home = guestHouse(sc);
  // ждут ли гости в пустом доме: с какой минуты (вернулась — не ждут)
  if (home || !s.guests.length) {
    if (s.dayFlags.guestsAway != null) setDayFlag('guestsAway', null);
  } else if (s.dayFlags.guestsAway == null) setDayFlag('guestsAway', s.minutes);
  // вышла из дома с гостями: кто пришёл сам — уходит вместе с ней
  if (home || !guestHouse(scenes[from])) return;
  const self = s.guests.filter((id) => guestHow(id) === 'self');
  if (!self.length) return;
  sendGuestsHome(self);
  if (sc && sc.npcs) for (const id of self) walkOutWith(sc, id, errand(sc, id));
});

/** «пошла» / «пошёл» / «пошли» — по тому, кто ушёл. */
const went = (ids) => (ids.length > 1 ? 'пошли' : NPC_BY_ID[ids[0]].fem ? 'пошла' : 'пошёл');
/** «не дождалась» / «не дождался» / «не дождались». */
const waited = (ids) => 'не дождал' + (ids.length > 1 ? 'ись' : NPC_BY_ID[ids[0]].fem ? 'ась' : 'ся');

// позванные не ждут вечно; поздно вечером расходятся все
every(1, () => {
  const s = S();
  if (!s || !s.guests.length) return;
  const ids = s.guests.slice(),
    away = s.dayFlags.guestsAway;
  if (s.minutes >= VISIT.sleep) {
    sendGuestsHome();
    if (guestHouse(scene())) toast(`Уже поздно — ${names(ids)} ${went(ids)} по домам 🌙`);
  } else if (away != null && s.minutes - away >= GUESTS_WAIT) {
    sendGuestsHome();
    setDayFlag('guestsAway', null);
    toast(`Тебя долго не было дома: ${names(ids)} ${waited(ids)} и ${went(ids)} по домам`);
  }
});

/** Хомячок ложится спать: гости прощаются и расходятся (features/sleep.js — до затемнения «Спокойной ночи»). */
export function guestsGoToBed() {
  const ids = S().guests.slice();
  if (!ids.length) return;
  sendGuestsHome();
  toast(`${names(ids)} ${went(ids)} по домам. Спокойной ночи! 👋`);
}
