// ВВОДНАЯ ЦЕПОЧКА ЗАДАНИЙ НОВОЙ ИГРЫ (этап 10): четыре соседа по очереди заходят в гости на виллу, что-то приносят
// и рассказывают — так хомячок знакомится с рюкзаком, магазином, огородом, кухней, работой, рынком, телефоном, морем
// и с жителями Ореховой Гавани. Сами задания — обычные задания журнала (data/quests.js, поле intro): ход считает
// features/quests.js, сдают их жителю в городе. Здесь — только «сценка в гостях»:
//   хомячок на вилле, окон нет, день (7:00–21:00), следующее вводное задание можно взять → житель входит в дверь
//   (как гость: его можно угостить, вечером он уйдёт), несёт в лапках коробочку или рассаду (carry — engine/side/
//   actors.js), подходит, вручает — и рассказывает. Хомячок на другом этаже (новая игра начинается в спальне на
//   втором) — сосед идёт к лифту, едет (его не видно, g.hide) и выходит на её этаже. Задание попадает в журнал,
//   звёздочка ведёт к первому шагу.
// Следующий сосед приходит, когда прошлое задание сдано. Ничего не блокируется: задания можно не делать, а на первой
// встрече сказать «Я уже всё умею» — тогда цепочка выключается (flags.intro = 2). У старых игр отметки flags.intro
// нет — к ним никто не приходит.
import { addItem, inviteGuest, meetFriend, setFlag } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { on } from '../core/events.js';
import { scene } from '../core/loop.js';
import { G, questNow } from '../core/state.js';
import { QUESTS, NPC_BY_ID, npcLook } from '../data/index.js';
import { dialog } from '../ui/dialog.js';
import { toast } from '../ui/toast.js';
import { startQuest } from './quests.js';

const S = () => G.state;
const INTRO = QUESTS.filter((q) => q.intro);
const WAIT = 1.6, // сколько секунд хомячок должна побыть дома, прежде чем постучат
  GIVE_AFTER = 30, // гость так и не дошёл (хомячок всё время ездит на лифте) — рассказывает и так, через столько секунд
  GIVE_TIME = 0.7, // сколько секунд летит коробочка
  LIFT_SPEED = 280, // как быстро сосед идёт к лифту и от лифта (пикселей в секунду; гуляют гости медленнее — 120)
  LIFT_RIDE = 1.2; // сколько секунд сосед едет в лифте
const HOURS = [7 * 60, 21 * 60]; // в гости заходят днём

/** Идёт ли вводная цепочка (новая игра и не сказано «Я уже всё умею»). */
export const introOn = () => !!S() && S().flags.intro === 1;
/** Вводное задание, с которым сейчас может прийти сосед (или null). */
const nextIntro = () => (introOn() ? INTRO.find((q) => questNow(q.id).status === 'ready') || null : null);

let home = 0, // сколько секунд подряд хомячок дома и ничего не происходит
  visit = null; // идёт сценка: { q, t, talking }

/** Хомячок на вилле, и дом может принять гостя. */
const atVilla = (sc) => !!sc && sc.houseKey === 'villa' && !!sc.canHostGuests && sc.canHostGuests();
const actorOf = (sc, id) => sc.actors.find((g) => g.guest && g.id === id);

/** Сосед входит в дверь с гостинцем в лапках. */
function knock(sc, q) {
  const npc = NPC_BY_ID[q.npc];
  // пришёл сам — уйдёт вместе с хомячком (features/guests.js); уже в гостях или дом полон — расскажет и так
  inviteGuest(q.npc, 'villa', 'self');
  const g = actorOf(sc, q.npc),
    c = q.visit && q.visit.carry;
  if (g && c) g.carry = { ...c, give: null };
  visit = { q, t: 0, talking: false };
  sfx('bell');
  toast(`Тук-тук! ${npc.name} заглянул${npc.fem ? 'а' : ''} в гости 🚪`, 'good');
}
/** Сосед рассказывает: гостинец — в рюкзак, задание — в журнал. */
async function talk(q) {
  const npc = NPC_BY_ID[q.npc],
    fr = S().friends[q.npc],
    first = q === INTRO[0];
  if (fr && !fr.met) meetFriend(q.npc);
  for (const [bag, id, n = 1] of (q.visit && q.visit.give) || []) addItem(bag, id, n);
  const say = (text, options, happy) => dialog({ look: npcLook(q.npc), name: npc.name, text, options, happy });
  const thanks = { text: q.lines.thanks || `${q.icon} Спасибо!`, cls: 'green' };
  const i = await say(q.lines.offer, first ? [thanks, { text: 'Я уже всё умею' }] : [thanks], true);
  if (first && i === 1) {
    // опытный игрок: подсказки не нужны — цепочка выключается, сосед остаётся в гостях
    setFlag('intro', 2);
    await say(
      'Ой, так ты уже всё знаешь! Тогда просто живи и радуйся. А если что — журнал 📖 всегда в альбоме.',
      [{ text: 'Хорошо!', cls: 'green' }],
      true,
    );
    return;
  }
  // ещё реплики (Плюша: снимок для каталога) — мягко, по одной, прежде чем задание попадёт в журнал
  for (const [text, btn] of q.lines.more || []) await say(text, [{ text: btn, cls: 'green' }], true);
  if (!startQuest(q.id)) return;
  sfx('bell');
  await say(q.lines.accept, [{ text: 'Хорошо!', cls: 'green' }], true);
  toast(`📖 Новое задание в журнале: ${q.icon} ${q.title}`, 'good');
}
/** Сценка кончилась (или хомячок ушла из дома): коробочку убрать. */
function endVisit() {
  const sc = scene(),
    g = visit && sc && sc.actors ? actorOf(sc, visit.q.npc) : null;
  if (g) {
    g.carry = null;
    if (g.hide) {
      g.hide = false;
      g.ride = 0;
      g.f = sc.p.f;
    }
  }
  visit = null;
  home = 0;
}

function tick({ dt = 0 } = {}) {
  const s = S(),
    sc = scene();
  if (!s || !atVilla(sc)) {
    if (visit && !visit.talking) endVisit();
    home = 0;
    return;
  }
  if (!visit) {
    const q = s.minutes >= HOURS[0] && s.minutes < HOURS[1] ? nextIntro() : null;
    home = q ? home + dt : 0;
    if (q && home >= WAIT) knock(sc, q);
    return;
  }
  if (visit.talking) return;
  visit.t += dt;
  const g = actorOf(sc, visit.q.npc),
    same = !!g && sc.p.f === g.f,
    dx = g ? sc.p.x - g.x : 0;
  const begin = () => {
    visit.talking = true;
    const q = visit.q;
    talk(q).finally(endVisit);
  };
  if (!g) return void (visit.t > 0.6 && begin());
  if (g.carry && g.carry.give) {
    g.carry.give.a += dt / GIVE_TIME;
    g.carry.give.x = sc.p.x;
    if (g.carry.give.a >= 1) {
      g.carry = null;
      sc.burst(sc.p.x, sc.geo.fy(sc.p.f) - 110, 'heart', 4);
      begin();
    }
  } else if (!same && visit.t <= GIVE_AFTER && sc.geo.lift) {
    rideLift(sc, g, dt);
  } else if ((same && Math.abs(dx) < 110) || visit.t > GIVE_AFTER) {
    g.dir = Math.sign(dx) || 1;
    g.wait = 2.5;
    g.moving = false;
    g.tx = g.x;
    if (g.carry) g.carry.give = { x: sc.p.x, y: sc.geo.fy(sc.p.f) - 60, a: 0 };
    else begin();
  } else if (same) {
    const lo = g.roam ? Math.min(g.roam[0], g.x) : g.x,
      hi = g.roam ? Math.max(g.roam[1], g.x) : g.x;
    walkTo(g, Math.max(lo, Math.min(hi, sc.p.x - Math.sign(dx) * 80)), dt);
  }
}
/** Сосед сам идёт к точке x (быстрее, чем гуляют гости; обычная прогулка в это время стоит — g.wait). */
function walkTo(g, x, dt) {
  const d = x - g.x,
    step = LIFT_SPEED * dt;
  g.tx = x;
  g.wait = 0.5;
  if (Math.abs(d) <= step) {
    g.x = x;
    g.moving = false;
    return true;
  }
  g.x += Math.sign(d) * step;
  g.dir = Math.sign(d);
  g.walkT += dt * 2.5;
  g.moving = true;
  return false;
}
/** Хомячок на другом этаже: сосед доходит до лифта, едет (его не видно) и выходит на этаже хомячка. */
function rideLift(sc, g, dt) {
  const at = sc.geo.W - 50; // у дверей лифта
  if (g.ride > 0) {
    g.ride -= dt;
    if (g.ride <= 0 && !sc.p.lift) {
      g.f = sc.p.f; // приехал на этаж хомячка
      g.hide = false;
      g.ride = 0;
      sfx('lift');
    }
    return;
  }
  if (walkTo(g, at, dt) && !sc.p.lift) {
    g.ride = LIFT_RIDE;
    g.hide = true;
    sfx('lift');
  }
}
on('step', tick);

/** Для тестов и отладки: что с вводной цепочкой сейчас. */
export function debugWelcome() {
  return {
    on: introOn(),
    flag: S() ? S().flags.intro || 0 : 0,
    next: nextIntro() ? nextIntro().id : null,
    visit: visit ? { id: visit.q.id, talking: visit.talking } : null,
    quests: S() ? INTRO.map((q) => `${q.id}:${questNow(q.id).status}:${questNow(q.id).i}`) : [],
  };
}
