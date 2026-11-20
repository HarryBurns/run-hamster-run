// ПАУЗА, КОГДА РЕБЁНОК ОТВЛЁКСЯ (баги заказчика 20 ноября).
//
// Пауза. Время игры стоит (как под окном или в диалоге: слой с паузой — ui/modals.js, openLayer), музыка тише
// (setMusicDuck, core/audio.js), если:
//   — вкладку или приложение спрятали (visibilitychange; звук браузер и так глушит — core/audio.js);
//   — окно браузера потеряло фокус (blur: переключились в другое окно);
//   — IDLE_PAUSE секунд не было ни касаний, ни мыши, ни клавиш (мягкая пауза).
// Наверху — маленькая плашка «⏸️ Пауза — нажми, чтобы продолжить» (без затемнения). Первое нажатие или клавиша
// только снимают паузу (до сцены и кнопок они не доходят). Пауза ставится, только когда мир идёт: окна, диалога,
// мини-игры, пианино, заставки и вступления на экране нет — под ними время и так стоит (а мини-игры на скрытой
// вкладке стоят сами — minigames/kit.js). Автотест (navigator.webdriver) паузу сам не ставит: окна браузера там
// часто без фокуса; включить — __dev.F.pauseAuto(true).
import { G } from '../core/state.js';
import { scene, every } from '../core/loop.js';
import { setMusicDuck, sfx } from '../core/audio.js';
import { el } from '../core/util.js';
import { openLayer } from '../ui/modals.js';

/** Через сколько секунд без касаний, мыши и клавиш — мягкая пауза. */
export const IDLE_PAUSE = 150;
/** Через сколько мс после снятия паузы нажатие снова доходит до игры (тот же «клик» не нажмёт кнопку под пальцем). */
const RESUME_GUARD = 450;

let auto = typeof navigator === 'undefined' || !navigator.webdriver, // ставить паузу самой (в автотесте — нет)
  close = null, // снять слой паузы
  why = '', // hidden | blur | idle
  chip = null,
  lastInput = performance.now(),
  resumedAt = -1e9; // когда сняли паузу (performance.now)

/** Что-то своё на экране (мини-игра, пианино, заставка, вступление): там пауза не ставится. */
const busy = () => !!document.querySelector('#mg, #piano, #title, #intro');
/** Мир идёт: игра открыта, окон нет. */
const worldRuns = () => !!G.state && !!scene() && G.modal === 0 && !busy();

function pauseNow(reason) {
  if (close || !auto || !worldRuns()) return false;
  close = openLayer({ pause: true });
  why = reason;
  setMusicDuck(true);
  chip = el('button', 'pause-chip', '⏸️ Пауза — нажми, чтобы продолжить');
  chip.dataset.act = 'resume';
  document.body.appendChild(chip);
  return true;
}
function resume() {
  if (!close) return false;
  close();
  close = null;
  why = '';
  setMusicDuck(false);
  if (chip) chip.remove();
  chip = null;
  lastInput = performance.now();
  resumedAt = lastInput;
  return true;
}

// касание, клик, клавиша: игрок здесь; на паузе — только снять паузу (нажатие дальше не идёт)
function onInput(e) {
  lastInput = performance.now();
  if (close) {
    resume();
    sfx('tap');
    e.preventDefault();
    e.stopPropagation();
  }
}
for (const t of ['pointerdown', 'keydown']) window.addEventListener(t, onInput, true);
// тот же нажим «отпускается» кликом — его тоже гасим, чтобы не нажать кнопку под пальцем
window.addEventListener(
  'click',
  (e) => {
    if (performance.now() - resumedAt < RESUME_GUARD) {
      e.preventDefault();
      e.stopPropagation();
    }
  },
  true,
);
for (const t of ['pointermove', 'wheel', 'touchstart'])
  window.addEventListener(t, () => (lastInput = performance.now()), { capture: true, passive: true });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseNow('hidden');
});
window.addEventListener('blur', () => pauseNow('blur'));
every(1, () => {
  // пока открыто окно или идёт мини-игра — ребёнок читает или играет: счёт «без касаний» не копится
  if (!worldRuns()) lastInput = Math.max(lastInput, performance.now() - 1000);
  else if (performance.now() - lastInput > IDLE_PAUSE * 1000) pauseNow('idle');
});

/** Для автотеста и консоли: что с паузой. */
export const pauseInfo = () => ({ on: !!close, why, auto, idle: (performance.now() - lastInput) / 1000 });
/** Для автотеста: включить или выключить паузу «сама» (в автотесте выключена). */
export function pauseAuto(on) {
  auto = !!on;
  if (!auto) resume();
}
/** Для автотеста: «прошло столько секунд без касаний». */
export function pauseIdleFor(sec) {
  lastInput = performance.now() - sec * 1000;
}
