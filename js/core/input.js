// Ввод: указатель (палец или мышь) и клавиатура → вызовы методов «получателя» (его даёт цикл игры, core/loop.js).
// Сцены сами слушателей не вешают: они получают pointerDown/Move/Up(sx, sy) в CSS-пикселях экрана и interact().

/** Нажатые сейчас клавиши (коды: 'ArrowLeft', 'KeyA', …). */
export const keys = new Set();

const has = (a, b) => (keys.has(a) || keys.has(b) ? 1 : 0);
/** Стрелки и WASD по горизонтали: −1, 0 или 1. */
export const axisX = () => has('ArrowRight', 'KeyD') - has('ArrowLeft', 'KeyA');
/** Стрелки и WASD по вертикали: −1 (вверх), 0 или 1 (вниз). */
export const axisY = () => has('ArrowDown', 'KeyS') - has('ArrowUp', 'KeyW');

/**
 * Подключить ввод.
 * target: { active(): можно ли сейчас управлять сценой, pointerDown(x, y), pointerMove(x, y), pointerUp(x, y), interact() }
 * onGesture — вызывается на любое действие игрока (нужно, чтобы браузер разрешил звук).
 */
export function initInput(canvas, target, onGesture = () => {}) {
  let activePointer = null; // следим за одним пальцем: второй палец игнорируем
  canvas.addEventListener('pointerdown', (e) => {
    onGesture();
    if (!target.active() || activePointer !== null) return;
    activePointer = e.pointerId;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (err) {
      /* не критично */
    }
    target.pointerDown(e.clientX, e.clientY);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId === activePointer && target.active()) target.pointerMove(e.clientX, e.clientY);
  });
  const up = (e) => {
    if (e.pointerId !== activePointer) return;
    activePointer = null;
    if (target.active()) target.pointerUp(e.clientX, e.clientY);
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT') return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!target.active()) return;
    keys.add(e.code);
    if ((e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') && !e.repeat) target.interact();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
  document.addEventListener('pointerdown', onGesture, { passive: true });
  document.addEventListener('keydown', onGesture);
}
