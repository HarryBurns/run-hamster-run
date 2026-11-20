// ПАУЗА, КОГДА РЕБЁНОК ОТВЛЁКСЯ, и КЛАВИША Esc (баги заказчика 20 ноября; тихая пауза — правка заказчика 21 ноября).
//
// Пауза тихая: ни плашки, ни сообщения, музыка не меняется, первое нажатие доходит до игры как обычно.
//   — IDLE_PAUSE секунд не было ни касаний, ни мыши, ни клавиш: стоят только часы игры (G.still — features/sleep.js
//     не двигает время, features/health.js не копит холод и дождь). Мир идёт: жители ходят, вода плещется.
//   — вкладку или приложение спрятали (visibilitychange) или окно браузера потеряло фокус (blur): стоят и часы, и мир
//     (слой с паузой, как под окном — ui/modals.js, openLayer; без затемнения). Звук на скрытой вкладке браузер и так
//     глушит (core/audio.js).
// Любой ввод (касание, мышь, колёсико, клавиша) или вернувшийся фокус окна — часы и мир идут дальше. Пауза ставится,
// только когда мир идёт: окна, диалога, мини-игры, пианино, заставки и вступления на экране нет — под ними время и
// так стоит (а мини-игры на скрытой вкладке стоят сами — minigames/kit.js). Автотест (navigator.webdriver) паузу сам
// не ставит: окна браузера там часто без фокуса, а шаги, которые ждут игрового времени, застряли бы на стоящих
// часах; включить — __dev.F.pauseAuto(true).
//
// Esc. Открыто окно — Esc закрывает верхнее, как ✕; ещё раз — открывает ⚙️ меню (openSettings). Мини-игра, пианино,
// вступление, заставка, диалог жителя — Esc не трогаем (у них свои клавиши или выбор ответа). На верблюде и в заводи
// (способ передвижения героя sc.p.ride, кроме «отдыхает» — relax) Esc — «слезть», это делает сама локация.
import { G } from '../core/state.js';
import { scene, every } from '../core/loop.js';
import { sfx } from '../core/audio.js';
import { openLayer } from '../ui/modals.js';
import { openSettings } from './settings.js';

/** Через сколько секунд без касаний, мыши и клавиш — часы игры стоят. */
export const IDLE_PAUSE = 30;

let auto = typeof navigator === 'undefined' || !navigator.webdriver, // ставить паузу самой (в автотесте — нет)
  close = null, // снять слой паузы (вкладка спрятана, окно без фокуса)
  why = '', // hidden | blur | idle
  lastInput = performance.now();

/** Что-то своё на экране (мини-игра, пианино, заставка, вступление): там пауза не ставится. */
const busy = () => !!document.querySelector('#mg, #piano, #title, #intro');
/** Мир идёт: игра открыта, окон нет. */
const worldRuns = () => !!G.state && !!scene() && G.modal === 0 && !busy();

/** Давно без касаний: стоят только часы. */
function stillNow() {
  if (G.still || close || !auto || !worldRuns()) return false;
  G.still = true;
  why = 'idle';
  return true;
}
/** Вкладка спрятана или окно без фокуса: стоят часы и мир (слой с паузой). */
function pauseNow(reason) {
  if (close || !auto || !worldRuns()) return false;
  close = openLayer({ pause: true });
  G.still = true;
  why = reason;
  return true;
}
function resume() {
  lastInput = performance.now();
  if (!close && !G.still) return false;
  if (close) close();
  close = null;
  G.still = false;
  why = '';
  return true;
}

// любой ввод: игрок здесь — часы и мир идут (нажатие идёт дальше как обычно: слой снят раньше, чем нажатие дойдёт
// до сцены — слушаем на window в фазе захвата)
for (const t of ['pointerdown', 'keydown', 'pointermove', 'wheel', 'touchstart'])
  window.addEventListener(t, resume, { capture: true, passive: true });
window.addEventListener('focus', resume);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseNow('hidden');
});
window.addEventListener('blur', () => pauseNow('blur'));
every(1, () => {
  // пока открыто окно или идёт мини-игра — ребёнок читает или играет: счёт «без касаний» не копится
  if (!worldRuns()) lastInput = Math.max(lastInput, performance.now() - 1000);
  else if (performance.now() - lastInput > IDLE_PAUSE * 1000) stillNow();
});

// ---------- Esc ----------
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Escape' || e.repeat || e.defaultPrevented) return;
  if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  // верхнее окно с ✕ (окна поверх мини-игры — тоже)
  const wins = [...document.querySelectorAll('.overlay')];
  const top = wins.length ? wins[wins.length - 1].querySelector('.panel-head .xbtn') : null;
  if (top) {
    e.preventDefault();
    top.click();
    return;
  }
  if (busy() || document.querySelector('.dialog')) return;
  if (!G.state || !scene() || G.modal > 0) return;
  const sc = scene();
  if (sc.p && sc.p.ride && !sc.p.ride.relax) return; // верблюд, заводь: Esc — «слезть» (локация)
  e.preventDefault();
  sfx('tap');
  openSettings();
});

/** Для автотеста и консоли: что с паузой. */
export const pauseInfo = () => ({
  on: !!close || G.still, // часы стоят
  world: !!close, // и мир стоит
  why,
  auto,
  idle: (performance.now() - lastInput) / 1000,
});
/** Для автотеста: включить или выключить паузу «сама» (в автотесте выключена). */
export function pauseAuto(on) {
  auto = !!on;
  if (!auto) resume();
}
/** Для автотеста: «прошло столько секунд без касаний». */
export function pauseIdleFor(sec) {
  lastInput = performance.now() - sec * 1000;
}
