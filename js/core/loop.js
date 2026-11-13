// Цикл игры и сцены.
//
// СЦЕНА — объект с методами (обязательны только update и draw):
//   enter(from, params)   вошли в сцену. from — имя сцены, из которой пришли ('' — игра только что запущена).
//                         params — что передал вызвавший go(); цикл добавляет туда back — позицию в прежней
//                         сцене (её savePos()), чтобы «внутренняя» сцена знала, куда вернуться.
//                         Если в params есть pos (загрузка сохранения, возврат) — сцена сама зовёт restorePos(pos).
//   leave()               уходим из сцены: снять подписки, убрать свои элементы со страницы.
//   update(dt)            шаг логики, dt ≤ 0,05 с. Не вызывается, пока открыто окно (мир на паузе).
//   draw(ctx)             нарисовать кадр; канва в CSS-пикселях (0…G.view.w × 0…G.view.h).
//   pointerDown(sx, sy), pointerMove(sx, sy), pointerUp(sx, sy)   палец или мышь, CSS-пиксели экрана.
//   interact()            клавиша E / Enter / пробел: «потрогать то, что рядом».
//   savePos()             позиция для сохранения: объект с полем scene — именем сцены, в которой игра откроется
//                         после перезагрузки (сцена без своего сохранения возвращает позицию «снаружи» — back).
//   restorePos(pos)       поставить героя в сохранённую позицию; false — позиция не годится (остаёмся у входа).
//   hud()                 что показать в HUD: { main: { icon, label, on, fn }, buttons: [{ id, icon, label, fn }],
//                         noMap, cls } — всё необязательно (см. ui/hud.js).
//   sound()               что должно звучать: { force, day, sea, rain, birds, crickets } (см. features/soundscape.js).
//
// СМЕНА СЦЕНЫ — go(name, params). Если go() вызван из update() (дошли до двери и т. п.), переход выполняется
// после этого шага логики, между кадрами: старая сцена спокойно дорабатывает свой update. Вне кадра
// (нажали кнопку в окне) — сразу.
import { G, save, flush } from './state.js';
import { setPos } from './actions.js';
import { emit } from './events.js';
import { initInput } from './input.js';

// ---------- сцены ----------
/** Все сцены игры: имя → сцена. */
export const scenes = {};
let cur = null,
  curName = '',
  pending = null, // запрошенный переход, который ждёт конца шага логики
  inStep = false;

export function registerScene(name, sc) {
  scenes[name] = sc;
  return sc;
}
/** Текущая сцена (или null, пока игра не началась). */
export const scene = () => cur;
export const sceneName = () => curName;

/** Перейти в сцену name. params получит её enter(); см. описание в начале файла. */
export function go(name, params = {}) {
  if (!scenes[name]) throw new Error(`Нет сцены «${name}»`);
  if (inStep) pending = { name, params };
  else switchTo(name, params);
}
function switchTo(name, params) {
  const from = curName;
  let back = null;
  if (cur) {
    back = cur.savePos ? cur.savePos() : null;
    if (cur.leave) cur.leave();
  }
  cur = scenes[name];
  curName = name;
  cur.enter(from, { back, ...params });
  storePos(); // позиция в сохранении — сразу целиком и от новой сцены (иначе там остаётся чужая)
  redraw = true;
  emit('scene', { name, from });
  emit('hud');
  save();
}
/** Забыть текущую сцену, не вызывая её leave() (когда сцена сломалась и её методы звать нельзя). */
export function dropScene() {
  cur = null;
  curName = '';
  pending = null;
}
function storePos() {
  if (G.state && cur && cur.savePos) setPos(cur.savePos());
}
/** Записать сохранение вместе с текущей позицией (автосохранение, уход со страницы). */
export function persist() {
  if (!G.state || !cur) return;
  storePos();
  save();
}

// ---------- экран ----------
let canvas = null,
  ctx = null,
  dpr = 1,
  redraw = true; // нарисовать сцену в ближайшем кадре, даже если она под окном
// Больше пикселей на канве — дороже каждый кадр. 4 млн: телефоны и окно 1280×720 при плотности 2 остаются чёткими,
// а большие планшеты и мониторы с плотностью 2 рисуются чуть мягче (ревью советует 2,5–3 млн — можно ужать).
const MAX_CANVAS_PX = 4e6;
function resize() {
  const w = window.innerWidth,
    h = window.innerHeight,
    real = window.devicePixelRatio || 1;
  // плотность канвы: не больше 2 и не больше MAX_CANVAS_PX пикселей всего, но и не грубее экрана с плотностью 1
  dpr = Math.max(Math.min(1, real), Math.min(real, 2, Math.sqrt(MAX_CANVAS_PX / Math.max(1, w * h))));
  G.view.w = w;
  G.view.h = h;
  G.view.dpr = dpr;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  redraw = true; // смена размера стирает канву
}

// ---------- дела «раз в N секунд» ----------
const chores = [];
/** Выполнять fn раз в sec секунд настоящего времени. needScene — только когда идёт игра (есть сцена). */
export function every(sec, fn, { needScene = true } = {}) {
  chores.push({ sec, fn, needScene, t: 0 });
}

// ---------- кадр ----------
let last = 0,
  frameNo = 0,
  failStreak = 0, // сколько кадров подряд закончились ошибкой
  onBroken = null;
const FAIL_LIMIT = 30;
const MAX_FRAME = 0.1,
  MAX_STEP = 0.05; // секунды

/** Выполнить часть кадра так, чтобы её ошибка не остановила игру. Возвращает false, если была ошибка. */
function guard(fn) {
  try {
    fn();
    return true;
  } catch (e) {
    if (failStreak < 3) console.error(e); // не засыпаем консоль одной и той же ошибкой 60 раз в секунду
    return false;
  }
}
/** То же для кода снаружи цикла (окно «что-то сломалось»): выполнить, ошибку записать в консоль. */
export function safely(fn) {
  return guard(fn);
}
function step(dt) {
  inStep = true;
  try {
    emit('step', { dt });
    cur.update(dt);
  } finally {
    inStep = false;
    // переход, запрошенный во время шага, — между шагами: старая сцена свой update уже закончила
    if (pending) {
      const p = pending;
      pending = null;
      switchTo(p.name, p.params);
    }
  }
}
function render() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cur.draw(ctx);
}
function frame(now) {
  requestAnimationFrame(frame); // первым делом: что бы ни случилось ниже, следующий кадр уже заказан
  // Кадр длиннее 100 мс обрезаем (вкладка вернулась из фона), а длинный делим на шаги логики не больше 50 мс:
  // на слабом устройстве игра идёт с той же скоростью, только реже рисуется.
  const dtFrame = Math.min(MAX_FRAME, Math.max(0, (now - last) / 1000));
  last = now;
  const steps = Math.max(1, Math.ceil(dtFrame / MAX_STEP - 1e-6)),
    dt = dtFrame / steps;
  let ok = true,
    drew = false;
  for (let i = 0; i < steps; i++) {
    G.time += dt;
    if (G.state && cur && !G.modal) ok = guard(() => step(dt)) && ok;
  }
  const playing = !!(G.state && cur);
  if (playing) {
    // Под мини-игрой, пианино и затемнением сна сцену не видно — не рисуем вовсе.
    // Под окном с затемнением хватает каждого третьего кадра: мир на паузе, шевелятся только вода и дыхание.
    frameNo++;
    if (!G.cover && (redraw || !G.dim || frameNo % 3 === 0)) {
      redraw = false;
      drew = true;
      if (!guard(render)) {
        ok = false;
        canvas.width = canvas.width; // сброс канвы: после ошибки на ней могли остаться clip и недозакрытые save()
      }
    }
  }
  for (const c of chores) {
    if (c.needScene && !playing) continue;
    c.t += dtFrame;
    if (c.t > c.sec) {
      c.t = 0;
      ok = guard(c.fn) && ok;
    }
  }
  if (playing) guard(flush); // запись сохранения — раз в кадр, если действия что-то поменяли
  // кадр, в котором сцену не рисовали (она под окном), ничего не доказывает — счёт сбоев не сбрасываем
  if (!ok) {
    if (++failStreak === FAIL_LIMIT && onBroken) onBroken();
  } else if (drew || !cur) failStreak = 0;
}
/** Сбросить счёт сбойных кадров (после того как игроку показали окно «что-то сломалось»). */
export function resetFailures() {
  failStreak = 0;
}

/**
 * Запустить цикл. opts.onBroken — что делать, если кадры ломаются подряд (показать окно);
 * opts.onGesture — вызывается на любое действие игрока (разрешение звука).
 */
export function startLoop(cv, opts = {}) {
  canvas = cv;
  ctx = canvas.getContext('2d');
  onBroken = opts.onBroken || null;
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));
  resize();
  initInput(
    canvas,
    {
      active: () => !G.modal && !!cur,
      pointerDown: (x, y) => cur.pointerDown && cur.pointerDown(x, y),
      pointerMove: (x, y) => cur.pointerMove && cur.pointerMove(x, y),
      pointerUp: (x, y) => cur.pointerUp && cur.pointerUp(x, y),
      interact: () => cur.interact && cur.interact(),
    },
    opts.onGesture,
  );
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) persist();
  });
  window.addEventListener('pagehide', persist);
  last = performance.now();
  requestAnimationFrame(frame);
}
