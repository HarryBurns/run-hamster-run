// Общий ход мини-игр «бегун по полосе»: «Спуск с горы» (sled.js) и «Горка» (slide.js).
// Вид сверху, герой едет внизу экрана по полосе посередине, навстречу бежит трасса. Игрок только рулит влево-вправо:
// пальцем или мышью (герой едет туда, где палец) или стрелками ← → (A, D). Проигрыша нет — игра идёт cfg.time секунд.
//
// Общее здесь: выбор карточками после «Начать!», руль, геометрия полосы, табло (время, собрано, столкновения),
// звёзды по очкам, dev-хуки для автотеста. Своё у каждой игры — движение и рисунок (крюки update и draw).
//
// Игра зовёт runnerGame(host, cfg). cfg:
//   p            приставка классов CSS ('sl', 'sd') — стиль даёт runnerCss(p), свои отличия игра дописывает сама
//   id           имя dev-хуков: canvas.__<id>() — состояние, canvas.__<id>Skip(sec) — «до финиша осталось sec секунд»
//   time         сколько секунд идёт игра
//   lim          [от, до] — куда можно рулить (доля ширины полосы);  keySpeed — скорость руля стрелками (доля в секунду)
//   icons        [собрано, столкновения] — значки на табло;  lead() — (необязательно) текст первой плашки табло
//   pick         выбор после «Начать!»: { title, attr, cards: [{ id, name, img, say }], preset, sfx, on(id) }
//                attr — имя data-атрибута кнопки (для автотеста); preset — уже выбрано заранее (тогда карточек нет)
//   update(dt, r)   шаг игры (не зовётся, пока идёт выбор и после финиша); время r.t и руль r.pos.to уже сдвинуты
//   draw(r)         кадр
//   debug(r)        (необязательно) что добавить в dev-хук
// r — общее состояние: cv, ctx, level, t, got, bumps, pos { x, to }, pops, picking, LW(), X0(), PX(fx), S(), Y(),
//   stars([на 2★, на 3★]), finish(итог).
import { el, clamp } from '../core/util.js';
import { pic } from './kit.js';
import { DEV } from '../core/dev.js';

/** Общий стиль бегунов с приставкой p: колонки правил, табло, окно выбора. Размеры карточек выбора — у игры. */
export const runnerCss = (p) => `
.${p}-rules{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:8px 0 2px}
.${p}-col{background:#fff;border-radius:14px;padding:4px 10px;border:3px solid #8ce99a;text-align:center}
.${p}-col.how{border-color:#74c0fc}
.${p}-col b{display:block;font-size:16px}
.${p}-col .row{display:flex;gap:4px;justify-content:center;align-items:center;font-size:26px;font-weight:900}
.${p}-col small{display:block;font-size:12px;opacity:.75;line-height:1.2}
.${p}-pick{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px;z-index:3}
.${p}-pick h3{margin:0;font-size:20px}
.${p}-pick .cards{display:flex;flex-wrap:wrap;justify-content:center}
.${p}-pick button{background:#fff;border:3px solid #74c0fc;font:inherit;cursor:pointer;display:flex;flex-direction:column;align-items:center;touch-action:manipulation}
.${p}-pick button:hover,.${p}-pick button:focus-visible{border-color:#ff6b9d;transform:translateY(-2px)}
.${p}-top{position:absolute;left:0;right:0;top:0;display:flex;gap:8px;justify-content:center;padding:8px;pointer-events:none;z-index:2}
.${p}-chip{background:rgba(255,255,255,.92);border-radius:12px;padding:4px 12px;font-weight:900;font-size:16px;box-shadow:0 2px 0 rgba(74,55,40,.15)}
`;

/** Маленькая картинка для колонки правил: draw(ctx, x, y, s) — середина по ширине, y — на dy выше низа. */
export const rulePic = (draw, dy, size = 46) => pic((x) => draw(x, size / 2, size - dy, size / 50), size, size);
/** Картинка для карточки выбора: фон bg, круглые концы линий. */
export const cardPic = (draw, w, h, bg) =>
  pic(
    (x) => {
      x.fillStyle = bg;
      x.fillRect(0, 0, w, h);
      draw(x);
    },
    w,
    h,
    { cap: true },
  );

export function runnerGame(host, cfg) {
  const p = cfg.p;
  const chip = () => el('div', `${p}-chip`);
  const tLead = cfg.lead ? chip() : null,
    tTime = chip(),
    tGot = chip(),
    tBump = chip();
  if (tLead) tLead.textContent = cfg.lead();
  const top = el('div', `${p}-top`);
  top.append(...(tLead ? [tLead] : []), tTime, tGot, tBump);
  host.add(top);
  const cv = host.canvas();
  const [lo, hi] = cfg.lim;
  let over = false,
    pickEl = null;
  // трасса — полоса посередине (на широком экране по бокам — обочина): LW — её ширина, X0 — левый край
  const LW = () => Math.min(cv.w, Math.max(320, cv.h * 0.85), 640),
    X0 = () => (cv.w - LW()) / 2;
  const r = {
    cv,
    ctx: cv.ctx,
    level: host.level || 0,
    t: 0,
    got: 0,
    bumps: 0,
    pos: { x: 0.5, to: 0.5 },
    pops: host.pops(),
    get picking() {
      return !!pickEl;
    },
    LW,
    X0,
    PX: (fx) => X0() + fx * LW(), // доля ширины трассы → пиксели
    S: () => clamp(LW() / 400, 0.85, 1.45), // масштаб рисунков
    Y: () => cv.h * 0.72, // где едет герой
    stars: (th) => (r.got >= th[1] ? 3 : r.got >= th[0] ? 2 : 1),
    finish(res) {
      if (over) return;
      over = true;
      host.finish(res);
    },
  };

  // ---------- выбор карточками ----------
  const pk = cfg.pick;
  let chosen = pk.preset != null;
  const choose = (id) => {
    if (chosen && !pickEl) return;
    chosen = true;
    pk.on(id);
    if (tLead) tLead.textContent = cfg.lead();
    if (pickEl) pickEl.remove();
    pickEl = null;
    host.sfx(pk.sfx);
  };
  if (!chosen) {
    pickEl = el('div', `${p}-pick`, `<h3>${pk.title}</h3>`);
    const cards = el('div', 'cards');
    for (const q of pk.cards) {
      const b = el('button', '', `<b>${q.name}</b>${q.img()}<small>${q.say}</small>`);
      b.dataset[pk.attr] = q.id;
      b.onclick = () => choose(q.id);
      cards.appendChild(b);
    }
    pickEl.appendChild(cards);
    host.add(pickEl);
  }

  // ---------- управление ----------
  const toX = (e) => {
    const b = cv.canvas.getBoundingClientRect();
    r.pos.to = clamp((((e.clientX - b.left) / b.width) * cv.w - X0()) / LW(), lo, hi);
  };
  let pressed = false;
  host.on(cv.canvas, 'pointerdown', (e) => {
    pressed = true;
    toX(e);
  });
  host.on(cv.canvas, 'pointermove', (e) => {
    if (pressed || e.pointerType === 'mouse') toX(e);
  });
  host.on(window, 'pointerup', () => (pressed = false));
  const keys = new Set();
  host.on(window, 'keydown', (e) => {
    if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(e.code)) {
      keys.add(e.code);
      e.preventDefault();
    }
  });
  host.on(window, 'keyup', (e) => keys.delete(e.code));

  // для автотеста: где герой и что впереди (x — доля ширины полосы, y — пиксели)
  if (DEV) {
    cv.canvas['__' + cfg.id] = () => ({
      x: r.pos.x,
      y: r.Y(),
      w: cv.w,
      x0: X0(),
      lw: LW(),
      picking: !!pickEl,
      t: r.t,
      got: r.got,
      ...(cfg.debug ? cfg.debug(r) : null),
    });
    cv.canvas['__' + cfg.id + 'Skip'] = (sec) => (r.t = Math.max(r.t, cfg.time - sec));
  }

  host.loop((dt) => {
    if (!over && chosen && !pickEl) {
      r.t += dt;
      // руль: стрелки двигают цель, герой сам плавно едет к ней (как — решает игра)
      const kx = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
      if (kx) r.pos.to = clamp(r.pos.to + kx * dt * cfg.keySpeed, lo, hi);
      cfg.update(dt, r);
    }
    tTime.textContent = `⏱️ ${Math.max(0, Math.ceil(cfg.time - r.t))}`;
    tGot.textContent = `${cfg.icons[0]} ${r.got}`;
    tBump.textContent = `${cfg.icons[1]} ${r.bumps}`;
    cfg.draw(r);
  });
  return r;
}
