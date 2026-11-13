// Окна поверх игры: счёт открытых «слоёв» и очередь окон.
//
// СЛОИ. Всё, что открывается поверх сцены (окно, диалог, мини-игра, пианино, затемнение сна), берёт слой:
//   const close = openLayer({ dim: true });   …   close();
// Пока открыт хоть один слой с pause — мир на паузе (сцена не получает update и нажатий). dim — под окном
// затемнение, сцену можно рисовать реже; cover — сцену не видно совсем, её не рисуют. Счётчики лежат в G
// (G.modal, G.dim, G.cover) — их читает цикл игры; менять их можно только отсюда.
//
// ОЧЕРЕДЬ. Окно, которое появляется «само» (подарок, новый рецепт, «задание выполнено», смена сезона, клад),
// нельзя открывать сразу: оно окажется под диалогом жителя или поверх магазина. Такое окно ставят в очередь:
//   enqueue(() => message({ … }), { delay: 700 });
// Очередь показывает окна по одному и только когда на экране ничего не открыто: после закрытия последнего окна
// выжидает SETTLE мс (цепочка диалогов может тут же открыть следующее) и не раньше, чем через delay мс.
// Следующее окно из очереди ждёт, пока закроют предыдущее.
import { G } from '../core/state.js';

// Первые мгновения после появления окна нажатия мимо него не считаются: ребёнок продолжает нажимать
// на экран, пока хомячок идёт, и окно закрывалось, не успев показаться.
export const TAP_GUARD = 350; // мс

const SETTLE = 250; // мс: сколько экран должен быть свободен перед показом окна из очереди
const queue = []; // { fn, at } — в порядке постановки
let timer = 0,
  freeSince = 0; // когда экран освободился (performance.now())

/** Открыть слой. Возвращает функцию, которая его закрывает (второй вызов ничего не делает). */
export function openLayer({ pause = true, dim = false, cover = false } = {}) {
  if (pause) G.modal++;
  if (dim) G.dim++;
  if (cover) G.cover++;
  let open = true;
  return () => {
    if (!open) return;
    open = false;
    if (pause) G.modal--;
    if (dim) G.dim--;
    if (cover) G.cover--;
    if (G.modal === 0) {
      freeSince = performance.now();
      schedule();
    }
  };
}
/** Открыто ли сейчас что-нибудь поверх игры. */
export const anyOpen = () => G.modal > 0;

/** Показать окно, когда экран свободен: fn открывает окно. delay — не раньше чем через столько мс. */
export function enqueue(fn, { delay = 0 } = {}) {
  const now = performance.now();
  if (!queue.length && G.modal === 0) freeSince = Math.max(freeSince, now); // маленькая пауза и перед первым окном
  queue.push({ fn, at: now + delay });
  schedule();
}
/** Сколько окон ждёт в очереди (для тестов). */
export const queued = () => queue.length;

function schedule() {
  clearTimeout(timer);
  timer = 0;
  if (!queue.length || G.modal > 0) return; // пока что-то открыто — ждём: закрытие слоя позовёт schedule()
  const due = Math.max(Math.min(...queue.map((q) => q.at)), freeSince + SETTLE);
  timer = setTimeout(pump, Math.max(0, due - performance.now()));
}
function pump() {
  timer = 0;
  const now = performance.now();
  if (G.modal > 0) return;
  const i = queue.findIndex((q) => q.at <= now);
  if (i < 0 || now - freeSince < SETTLE) {
    schedule();
    return;
  }
  const q = queue.splice(i, 1)[0];
  freeSince = now; // если окно так и не открылось, следующее всё равно подождёт SETTLE
  try {
    q.fn();
  } catch (e) {
    console.error(e);
  }
  schedule();
}
