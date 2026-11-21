// ДВИЖОК ПОВЕДЕНИЯ ЖИТЕЛЕЙ, слой сцены: КАК ЖИТЕЛЬ ПРИХОДИТ И УХОДИТ. Один автомат для вида сверху
// (engine/topdown/actors.js) и вида сбоку (engine/side/actors.js):
//
//     нет его ──(пора быть здесь)──▶ пришёл: появился у точки входа (дверь) и идёт к своему месту ──▶ здесь
//     здесь ──(пора уходить)──▶ уходит: идёт к точке выхода (его дверь, дверь отеля, выход из дома) ──▶ нет его
//
// ГДЕ жителю пора быть — решает не сцена, а core/npc.js (npcDue: расписание, состояние, удержания). Сцена даёт
// автомату только «как»: поставить сразу, поставить у входа, проложить путь к выходу, дошёл ли, в кадре ли.
// Правила:
//   • хомячок только что вошла в сцену — все стоят по местам сразу (без прогулок);
//   • житель вне кадра — переставляется сразу (игрок не видит);
//   • в кадре житель НИКОГДА не пропадает и не появляется «щелчком»: уходит ногами до выхода; пути нет или шёл
//     слишком долго — плавно тает (FADE секунд); приходит — от двери, а если двери нет — плавно проявляется;
//   • пока он идёт к выходу, он считается «ещё здесь» (удержание 'leaving' в core/npc.js): звёздочка задания
//     и подсказки не прыгают, в другой сцене он не появится раньше, чем уйдёт из этой.
// МЕНЯТЬ «виден / не виден» у жителя имеет право только этот автомат (поля a.state и a.fade; n.hidden в виде
// сверху выводится из них).
import { G } from '../core/save.js';
import { npcNow, holdNpc, releaseNpc } from '../core/npc.js';

/** За сколько секунд житель тает или проявляется, если уйти или прийти ногами нельзя. */
export const FADE = 0.4;
/** Сколько секунд житель идёт к выходу, прежде чем сдаться (застрял, обходит далеко). */
export const LEAVE_MAX = 30;

/** Виден ли житель (или его часть — тает). */
export const shown = (a) => a.state === 'present' || a.state === 'leaving';

function gone(a, due) {
  a.state = 'absent';
  a.fade = 1;
  a.away = due;
  a.place = null;
  releaseNpc(a.id, 'leaving');
}

/**
 * Шаг автомата для жителя a (объект жителя сцены: { id, state, fade, place, away }).
 *   due   — где ему пора быть (npcDue; у жителя без расписания — null);
 *   here  — пора ли ему быть в этой сцене в этой точке (и видимым);
 *   env   — что умеет сцена:
 *     snap(a, due)          поставить сразу на место (хомячок только вошла);
 *     enter(a, due, from)   поставить у точки входа (from — где он был до этого: Place или null); false — входа нет;
 *     exit(a, due)          проложить путь к точке выхода (due — куда он уходит); false — пути нет;
 *     arrived(a)            дошёл ли до точки выхода;
 *     inView(a)             в кадре ли он сейчас;
 *     back(a)               передумал уходить — снова гуляет (сбросить путь);
 *   dt    — секунды кадра.
 */
export function stepPresence(a, due, here, env, dt) {
  if (a.state === undefined) {
    // первая расстановка после входа хомячка в сцену
    a.fade = 1;
    a.state = here ? 'present' : 'absent';
    a.place = here ? due : null;
    a.away = here ? null : due;
    if (here) env.snap(a, due);
    return;
  }
  if (a.state === 'absent') {
    if (!here) {
      a.away = due;
      return;
    }
    a.fade = env.enter(a, due, a.away) || !env.inView(a) ? 1 : 0;
    a.state = 'present';
    a.place = due;
    a.away = null;
    return;
  }
  if (a.state === 'present') {
    if (a.fade < 1) a.fade = Math.min(1, a.fade + dt / FADE);
    if (here) {
      a.place = due;
      return;
    }
    if (!env.inView(a)) return gone(a, due);
    // пора уходить: он ещё здесь, пока не дойдёт до выхода
    if (a.place) holdNpc(a.id, 'leaving', { place: a.place });
    a.state = 'leaving';
    a.leaveT = 0;
    a.walks = env.exit(a, due);
    return;
  }
  // уходит
  if (here) {
    releaseNpc(a.id, 'leaving');
    a.state = 'present';
    a.place = due;
    env.back(a);
    return;
  }
  if (G.modal) return; // мир на паузе — стоит и ждёт
  a.leaveT += dt;
  if (a.walks && env.arrived(a)) return gone(a, due);
  if (a.walks && a.leaveT < LEAVE_MAX) return;
  if (!env.inView(a)) return gone(a, due);
  a.fade -= dt / FADE;
  if (a.fade <= 0) gone(a, due);
}
/** Забыть расстановку (хомячок ушла из сцены): в следующий раз все встанут по местам сразу. */
export function resetPresence(list) {
  for (const a of list) {
    a.state = undefined;
    a.fade = 1;
    a.place = a.away = null;
  }
}

// ---------- сторожа (для автотеста и отладки: __dev.npc.audit(), __dev.npc.pops) ----------
/** Замеченные «щелчки»: житель в кадре пропал, появился или перепрыгнул не у двери и не плавно. */
export const pops = [];
let lastScene = null,
  lastSeen = new Map(),
  graceT = 0;
/**
 * Сторож «никто не исчез на глазах». Сцена зовёт его каждый кадр со списком своих жителей:
 * [{ key, id, x, y, shown, alpha, inView, atDoor }] (x, y — в единицах сцены; jump — сколько единиц за кадр считать
 * прыжком). Сравнивает с прошлым кадром той же сцены; первые кадры после входа в сцену не в счёт.
 */
export function watchPresence(scene, list, dt, jump = 150) {
  if (scene !== lastScene) {
    lastScene = scene;
    lastSeen = new Map();
    graceT = 0.25;
  }
  graceT -= dt;
  const next = new Map();
  for (const q of list) {
    next.set(q.key, q);
    const p = lastSeen.get(q.key);
    if (!p || graceT > 0 || G.modal) continue;
    const solid = (r) => r.shown && r.alpha > 0.5 && r.inView;
    let kind = null;
    if (solid(p) && !q.shown && !p.atDoor) kind = 'исчез';
    else if (!p.shown && solid(q) && !q.atDoor) kind = 'появился';
    else if (solid(p) && solid(q) && Math.hypot(q.x - p.x, q.y - p.y) > jump) kind = 'перепрыгнул';
    if (kind && pops.length < 50)
      pops.push({
        id: q.id,
        kind,
        scene,
        x: Math.round(p.shown ? p.x : q.x),
        y: Math.round(p.shown ? p.y : q.y),
        minutes: Math.floor(G.state.minutes),
      });
  }
  lastSeen = next;
}
/**
 * Сторож «ровно одно место»: кого сцена scene сейчас показывает (ids), а кого должна (по npcNow). Возвращает
 * расхождения: [{ id, why }] — показан, а по правилу он в другом месте; или по правилу здесь и виден, а не показан.
 * expected — кого сцена умеет показывать (её жильцы и жители).
 */
export function auditPresence(scene, shownIds, expected) {
  const bad = [];
  for (const id of expected) {
    const p = npcNow(id);
    if (!p) continue;
    const here = p.scene === scene && p.visible,
      on = shownIds.includes(id);
    if (on && !here) bad.push({ id, why: `показан в «${scene}», а по правилу он в «${p.scene} · ${p.spot}»` });
    if (!on && here) bad.push({ id, why: `по правилу он в «${scene} · ${p.spot}», а сцена его не показывает` });
  }
  return bad;
}
