// ВСТУПИТЕЛЬНАЯ СЦЕНКА НОВОЙ ИГРЫ (этап 10): как хомячок переехала из большого шумного города в Ореховую Гавань.
// Четыре кадра-картинки с подписями: город под дождём → поезд к морю → панорама Ореховой Гавани (ореховые скалы,
// площадь, жители машут) → новый дом, вилла. Кадры рисуются кодом и плавно сменяют друг друга; листать — кнопкой
// «Дальше», нажатием на картинку, пробелом или Enter; сами листаются через FRAME_TIME секунд; «Пропустить» — сразу
// в игру. Показывается один раз — после ввода имени (main.js: playIntro → начало игры). Тайных мест в ней нет.
//
// Рисунки кадров — art/intro_art.js; здесь подписи, смена кадров и кнопки.
import { sfx } from '../core/audio.js';
import { playerLook } from '../core/state.js';
import { el, esc } from '../core/util.js';
import { paintCity, paintTrain, paintTown, paintVilla } from '../art/intro_art.js';

const FRAME_TIME = 11, // сколько секунд кадр стоит сам, если не листать
  FADE = 0.7; // плавный переход между кадрами, секунды

const ease = (t) => t * t * (3 - 2 * t);

/** Кадры сценки: рисунок и подпись (name — имя хомячка). */
const FRAMES = [
  { id: 'city', paint: paintCity, text: (name) => `Жила-была хомячка <b>${name}</b> в большом шумном городе. Серые дома, дождь, все куда-то спешат…` },
  { id: 'train', paint: paintTrain, text: () => 'И однажды она собрала чемодан и села на поезд — туда, где море и солнце!' },
  {
    id: 'town',
    paint: paintTown,
    text: () => 'А вот и <b>Ореховая Гавань</b>! Видишь скалы у моря? Они цвета лесного ореха — отсюда и название. Жители уже машут!',
  },
  { id: 'villa', paint: paintVilla, text: (name) => `Вот и новый дом — вилла у самого моря. Добро пожаловать, <b>${name}</b>! Всё только начинается!` },
];

let current = null; // открытая сценка — для автотеста (introDebug)

/** Для тестов: какой кадр сейчас на экране ({ i, id, n }) или null — сценка не идёт. */
export const introDebug = () => (current ? { i: current.i(), id: FRAMES[current.i()].id, n: FRAMES.length } : null);

/**
 * Показать вступительную сценку. name — имя хомячка, look — её вид (по умолчанию — из сохранения), frameTime —
 * сколько секунд кадр стоит сам (для тестов).
 * Возвращает Promise: досмотрели или пропустили — дальше начинается игра.
 */
export function playIntro({ name = 'Хомка', look = playerLook(), frameTime = FRAME_TIME } = {}) {
  return new Promise((resolve) => {
    const box = el('div');
    box.id = 'intro';
    const cv = el('canvas', 'i-scene');
    const skip = el('button', 'btn small ghost i-skip', 'Пропустить ⏭');
    skip.dataset.act = 'skip'; // метки data-act — для автотеста (dev/lib.js)
    const cap = el('div', 'i-cap');
    const text = el('p', 'i-text');
    const row = el('div', 'i-row');
    const dots = el('div', 'i-dots');
    const next = el('button', 'btn big green i-next', 'Дальше ▶');
    next.dataset.act = 'next';
    row.append(dots, next);
    cap.append(text, row);
    box.append(cv, skip, cap);
    document.body.appendChild(box);
    const ctx = cv.getContext('2d');
    const buf = document.createElement('canvas'), // прошлый кадр — для плавного перехода
      bctx = buf.getContext('2d');

    let i = 0,
      t0 = performance.now(), // когда начался текущий кадр
      fadeFrom = -1, // с какого кадра идёт переход (−1 — перехода нет)
      raf = 0,
      done = false,
      W = 0,
      H = 0,
      FH = 0,
      dpr = 1;
    const size = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = box.clientWidth;
      H = box.clientHeight;
      for (const c of [cv, buf]) {
        c.width = Math.round(W * dpr);
        c.height = Math.round(H * dpr);
      }
      free();
    };
    /** Свободное место над подписью (подпись бывает в две-три строки — пересчитать, когда текст сменился). */
    const free = () => {
      FH = Math.max(H * 0.45, cap.getBoundingClientRect().top - box.getBoundingClientRect().top - 6);
    };
    const caption = () => {
      text.innerHTML = FRAMES[i].text(esc(name));
      dots.innerHTML = FRAMES.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('');
      next.textContent = i === FRAMES.length - 1 ? 'Приехали! 🏡' : 'Дальше ▶';
      free();
    };
    const paint = (c, k, t) => {
      c.save();
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.lineJoin = 'round';
      c.lineCap = 'round';
      FRAMES[k].paint(c, W, H, t, look, FH);
      c.restore();
    };
    const frame = (now) => {
      if (done) return;
      const t = (now - t0) / 1000;
      if (fadeFrom < 0 && t > frameTime) return void go(); // сам листается дальше (после последнего — в игру)
      paint(ctx, i, t);
      if (fadeFrom >= 0) {
        const a = t / FADE;
        if (a >= 1) fadeFrom = -1;
        else {
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.globalAlpha = 1 - ease(a);
          ctx.drawImage(buf, 0, 0);
          ctx.restore();
        }
      }
      raf = requestAnimationFrame(frame);
    };
    function finish() {
      if (done) return;
      done = true;
      current = null;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', size);
      window.removeEventListener('keydown', key);
      box.classList.add('out');
      setTimeout(() => box.remove(), 450);
      resolve();
    }
    function go() {
      if (done) return;
      if (i >= FRAMES.length - 1) return finish();
      // прошлый кадр — в запас, чтобы новый проявился поверх него
      bctx.setTransform(1, 0, 0, 1, 0, 0);
      bctx.drawImage(cv, 0, 0);
      fadeFrom = i;
      i++;
      t0 = performance.now();
      sfx(i === FRAMES.length - 1 ? 'magic' : 'pop');
      caption();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    }
    function key(e) {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowRight') {
        e.preventDefault();
        go();
      } else if (e.code === 'Escape') finish();
    }
    next.onclick = () => go();
    cv.onpointerdown = (e) => {
      e.preventDefault();
      go();
    };
    skip.onclick = () => {
      sfx('tap');
      finish();
    };
    window.addEventListener('resize', size);
    window.addEventListener('keydown', key);
    current = { i: () => i, next: go, skip: finish };
    caption();
    size();
    raf = requestAnimationFrame(frame);
  });
}
