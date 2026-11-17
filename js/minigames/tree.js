// Мини-игра «Нарядим ёлку» (Новый год, П.13 и Пр8; запускает ёлка на площади — features/holidays_winter.js).
// Большая ёлка с местами для игрушек (кружочки на ветках). Внизу — коробка с игрушками: шар, звёздочка, сосулька,
// бантик, колокольчик, леденец, гирлянда. Выбери игрушку и нажми на место на ветке (или перетащи игрушку пальцем
// прямо на ветку) — она повиснет там. Нажала на занятое место — игрушка поменяется на выбранную. Шары каждый раз
// другого цвета. Когда повешено MIN игрушек — можно надеть звезду на макушку (кнопка «⭐ Звезда» или нажать на макушку),
// и ёлка готова. Проигрыша нет: наряжать можно как хочется. Звёзды — «за красоту»: сколько разных игрушек и сколько
// мест занято (STARS). Награду (шаг праздника, наклейку за ⭐⭐⭐) даёт занятие.
// Управление: мышь и касание; клавиатура — 1–7 выбрать игрушку, стрелки — место, Enter/пробел — повесить, З/S — звезда.
import { el, clamp, TAU } from '../core/util.js';
import { ell, fillRR, line, poly, star } from '../core/draw.js';

const OUT = '#4a3728';
/** Сколько игрушек повесить, чтобы можно было надеть звезду. */
export const MIN = 6;
/** «За красоту»: ⭐⭐ — kinds разных игрушек и n повешено, ⭐⭐⭐ — то же побольше. */
export const STARS = [
  { kinds: 3, n: 8 },
  { kinds: 5, n: 11 },
];
/** Игрушки в коробке. */
export const KINDS = [
  { id: 'ball', name: 'Шар', key: '1' },
  { id: 'star', name: 'Звёздочка', key: '2' },
  { id: 'icicle', name: 'Сосулька', key: '3' },
  { id: 'bow', name: 'Бантик', key: '4' },
  { id: 'bell', name: 'Колокольчик', key: '5' },
  { id: 'candy', name: 'Леденец', key: '6' },
  { id: 'garland', name: 'Гирлянда', key: '7' },
];
const BALLS = ['#e03131', '#1c7ed6', '#f59f00', '#e64980', '#2f9e44', '#7048e8'];
const BULBS = ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#da77f2'];
// места на ветках: v — высота (0 — макушка, 1 — низ кроны), u — от −1 (левый край ветки) до 1 (правый)
const SPOTS = [
  [0.3, -0.45],
  [0.3, 0.45],
  [0.46, -0.66],
  [0.46, 0],
  [0.46, 0.66],
  [0.62, -0.74],
  [0.62, -0.25],
  [0.62, 0.25],
  [0.62, 0.74],
  [0.8, -0.8],
  [0.8, -0.4],
  [0.8, 0],
  [0.8, 0.4],
  [0.8, 0.8],
];
/** Полуширина кроны на высоте v (доля высоты ёлки). */
const halfW = (v) => 0.07 + 0.4 * v;

/** Игрушка kind в точке (x, y) — точка подвеса; s — масштаб; col — цвет шара; t — время (гирлянда мигает). */
export function toyArt(ctx, kind, x, y, s, col = BALLS[0], t = 0) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (kind === 'ball') {
    line(ctx, x, y - 4 * s, x, y + 2 * s, OUT, 1.2);
    fillRR(ctx, x - 3 * s, y + 1 * s, 6 * s, 4 * s, 1.5 * s, '#ffd43b', OUT, 1);
    ell(ctx, x, y + 13 * s, 10 * s, 10 * s, col, OUT, 1.6);
    ell(ctx, x - 3.5 * s, y + 9.5 * s, 3 * s, 2.2 * s, 'rgba(255,255,255,.7)', null, 0, -0.6);
  } else if (kind === 'star') {
    line(ctx, x, y - 4 * s, x, y + 2 * s, OUT, 1.2);
    star(ctx, x, y + 11 * s, 10 * s, '#ffd43b', OUT, 1.6);
    star(ctx, x - 1.5 * s, y + 9.5 * s, 3.5 * s, '#fff3bf');
  } else if (kind === 'icicle') {
    line(ctx, x, y - 4 * s, x, y + 1 * s, OUT, 1.2);
    poly(ctx, [x - 6 * s, y + 1 * s, x + 6 * s, y + 1 * s, x + 1 * s, y + 26 * s, x - 1 * s, y + 26 * s], '#d0ebff', OUT, 1.4);
    line(ctx, x - 2 * s, y + 4 * s, x - 0.5 * s, y + 18 * s, 'rgba(255,255,255,.9)', 1.6 * s);
  } else if (kind === 'bow') {
    ell(ctx, x - 7 * s, y + 4 * s, 7 * s, 5 * s, '#e03131', OUT, 1.4, -0.35);
    ell(ctx, x + 7 * s, y + 4 * s, 7 * s, 5 * s, '#e03131', OUT, 1.4, 0.35);
    poly(ctx, [x - 2 * s, y + 6 * s, x - 7 * s, y + 18 * s, x - 2 * s, y + 15 * s], '#c92a2a', OUT, 1.2);
    poly(ctx, [x + 2 * s, y + 6 * s, x + 7 * s, y + 18 * s, x + 2 * s, y + 15 * s], '#c92a2a', OUT, 1.2);
    ell(ctx, x, y + 4 * s, 3.4 * s, 3.4 * s, '#fa5252', OUT, 1.2);
  } else if (kind === 'bell') {
    line(ctx, x, y - 4 * s, x, y + 2 * s, OUT, 1.2);
    ctx.beginPath();
    ctx.moveTo(x - 9 * s, y + 18 * s);
    ctx.quadraticCurveTo(x - 8 * s, y + 3 * s, x, y + 2 * s);
    ctx.quadraticCurveTo(x + 8 * s, y + 3 * s, x + 9 * s, y + 18 * s);
    ctx.closePath();
    ctx.fillStyle = '#fcc419';
    ctx.fill();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ell(ctx, x, y + 19 * s, 3 * s, 3 * s, '#e8590c', OUT, 1.1);
    line(ctx, x - 4 * s, y + 8 * s, x - 5 * s, y + 15 * s, 'rgba(255,255,255,.7)', 1.6 * s);
  } else if (kind === 'candy') {
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(x + 2 * s, y + 24 * s);
      ctx.lineTo(x + 2 * s, y + 6 * s);
      ctx.arc(x - 3 * s, y + 6 * s, 5 * s, 0, Math.PI, true);
    };
    path();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 7 * s;
    ctx.stroke();
    path();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4.6 * s;
    ctx.stroke();
    path();
    ctx.setLineDash([3 * s, 3 * s]);
    ctx.strokeStyle = '#e03131';
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (kind === 'garland') {
    // провисшая нитка огоньков (мигают по очереди)
    const w = 26 * s;
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.quadraticCurveTo(x, y + 16 * s, x + w, y);
    ctx.strokeStyle = '#2b3a2b';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const q = (i + 0.5) / 5,
        bx = x - w + q * 2 * w,
        by = y + 2 * (1 - q) * q * 16 * s + 2 * s,
        on = Math.floor(t * 3 + i) % 2 === 0;
      ell(ctx, bx, by + 2 * s, 2.6 * s, 3.6 * s, on ? BULBS[i % BULBS.length] : '#868e96', OUT, 1);
      if (on) ell(ctx, bx, by + 2 * s, 5 * s, 5 * s, 'rgba(255,240,180,.25)');
    }
  }
  ctx.restore();
}
/** Картинка игрушки для кнопки в коробке. */
function toyPic(kind, size = 44) {
  const c = document.createElement('canvas');
  c.width = c.height = size * 2;
  const x = c.getContext('2d');
  x.scale(2, 2);
  const s = size / 46;
  toyArt(x, kind, size / 2 + (kind === 'candy' ? 1 : 0), kind === 'garland' ? size * 0.35 : size * 0.18, kind === 'garland' ? s * 0.78 : s * 1.15, BALLS[0], 0);
  return `<img src="${c.toDataURL()}" width="${size}" height="${size}" alt="">`;
}

const CSS = `
.tr-rules{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin:8px 0 4px}
.tr-rules img{background:#fff;border-radius:12px;border:2px solid #ffd43b}
.tr-top{position:absolute;left:0;right:0;top:0;display:flex;gap:6px;justify-content:center;flex-wrap:wrap;padding:8px;pointer-events:none;z-index:2}
.tr-chip{background:rgba(255,255,255,.92);border-radius:12px;padding:4px 10px;font-weight:900;font-size:15px;box-shadow:0 2px 0 rgba(74,55,40,.15)}
.tr-tray{position:absolute;left:0;right:0;bottom:0;display:flex;gap:6px;justify-content:center;align-items:stretch;flex-wrap:wrap;padding:8px 8px calc(8px + env(safe-area-inset-bottom));background:linear-gradient(#c92a2a,#a61e1e);border-top:4px solid #ffd43b;z-index:2}
.tr-tray button{background:#fff8e7;border:3px solid #e9c48e;border-radius:14px;padding:2px 4px 3px;font:inherit;font-size:11px;font-weight:800;color:#4a3728;cursor:pointer;display:flex;flex-direction:column;align-items:center;min-width:58px;touch-action:none;user-select:none;-webkit-user-select:none}
.tr-tray button img{pointer-events:none;-webkit-user-drag:none}
.tr-tray button.on{border-color:#1c7ed6;background:#e7f5ff;transform:translateY(-3px);box-shadow:0 3px 0 rgba(0,0,0,.2)}
.tr-tray button.top{background:#fff3bf;border-color:#f59f00;font-size:13px;min-width:84px;justify-content:center}
.tr-tray button.top:disabled{opacity:.45;cursor:default}
.tr-tray button.top.ready{animation:trPulse 1s ease-in-out infinite}
@keyframes trPulse{50%{box-shadow:0 0 0 6px rgba(255,212,59,.75),0 0 18px 6px rgba(255,230,140,.8)}}
@media (max-width:520px){.tr-tray{gap:4px;padding:6px 4px calc(6px + env(safe-area-inset-bottom))}.tr-tray button{min-width:44px;font-size:10px}.tr-tray button img{width:34px;height:34px}.tr-tray button.top{min-width:64px}}
@media (max-height:460px){.tr-tray button img{width:30px;height:30px}.tr-tray button span{display:none}}
`;

export default {
  id: 'tree',
  title: 'Нарядим ёлку!',
  icon: '🎄',
  get howTo() {
    return `<style>${CSS}</style>Ёлку наряжаешь ты сама! <b>Выбери игрушку</b> в коробке и <b>нажми на ветку</b> — туда, где
      светится кружочек (или перетащи игрушку пальцем).
      <div class="tr-rules">${KINDS.map((k) => toyPic(k.id, 40)).join('')}</div>
      Повесь хотя бы ${MIN} игрушек — и надень <b>звезду на макушку</b>! Чем больше разных игрушек, тем наряднее ёлка ✨`;
  },
  start(host) {
    const root = host.root;
    const style = el('style', '', CSS);
    const top = el('div', 'tr-top');
    const tCount = el('div', 'tr-chip'),
      tSay = el('div', 'tr-chip');
    top.append(tCount, tSay);
    const tray = el('div', 'tr-tray');
    root.append(style, top, tray);
    const cv = host.canvas();
    cv.canvas.classList.add('tr-canvas');
    const ctx = cv.ctx;
    let t = 0,
      last = performance.now(),
      raf = 0,
      stopped = false,
      over = false,
      sel = 'ball',
      cursor = 3, // выбор места клавиатурой
      balls = 0, // сколько шаров повешено (цвет следующего)
      topOn = 0, // > 0 — звезда надета (секунды)
      drag = null, // { kind, x, y, moved } — тащим игрушку из коробки
      flash = null; // { i, t } — только что повешено
    const placed = SPOTS.map(() => null); // { kind, col, t }
    const pops = [];

    // ---------- коробка ----------
    const btns = {};
    for (const k of KINDS) {
      const b = el('button', '', `${toyPic(k.id)}<span>${k.name}</span>`);
      b.dataset.kind = k.id;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        choose(k.id);
        drag = { kind: k.id, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false };
      });
      tray.appendChild(b);
      btns[k.id] = b;
    }
    const topBtn = el('button', 'top', '⭐<span>Звезда!</span>');
    topBtn.dataset.kind = 'top';
    topBtn.onclick = () => putTop();
    tray.appendChild(topBtn);
    function choose(id) {
      if (over) return;
      sel = id;
      for (const k in btns) btns[k].classList.toggle('on', k === id);
      host.sfx('tap');
    }
    choose('ball');

    // ---------- раскладка: ёлка над коробкой ----------
    const L = () => {
      const W = cv.w,
        H = cv.h,
        trayH = tray.getBoundingClientRect().height || 70,
        topH = 44,
        avail = H - trayH - topH - 16,
        th = clamp(Math.min(avail * 0.96, W * 1.05), 140, 900), // высота ёлки (крона + ствол)
        tall = H > W * 1.1,
        cx = tall ? W * 0.5 : W * 0.46,
        base = topH + 8 + avail * 0.98, // низ горшка
        crownTop = base - th * 0.97,
        crownH = th * 0.82; // крона: от макушки до низа ветвей
      return { W, H, trayH, th, cx, base, crownTop, crownH, tall };
    };
    const spotXY = (i, g = L()) => {
      const [v, u] = SPOTS[i];
      return { x: g.cx + u * halfW(v) * g.crownH * 0.92, y: g.crownTop + v * g.crownH };
    };
    const topXY = (g = L()) => ({ x: g.cx, y: g.crownTop - 4 });
    const count = () => placed.filter(Boolean).length;
    const kindsUsed = () => new Set(placed.filter(Boolean).map((q) => q.kind)).size;
    const starReady = () => count() >= MIN && !topOn;

    function place(i, kind = sel) {
      if (over || topOn || i < 0) return;
      const was = placed[i];
      if (was && was.kind === kind && kind !== 'ball') return;
      const col = BALLS[balls % BALLS.length];
      if (kind === 'ball') balls++;
      placed[i] = { kind, col, t };
      flash = { i, t: 0 };
      host.sfx(kind === 'bell' ? 'bell' : kind === 'garland' ? 'magic' : 'pop');
      const p = spotXY(i);
      pops.push({ text: was ? '🔄' : ['✨', '💫', '🌟'][count() % 3], x: p.x, y: p.y - 10, t: 0 });
      if (count() === MIN) host.sfx('ding');
    }
    function putTop() {
      if (over || topOn) return;
      if (!starReady()) {
        host.sfx('tap');
        sayFor(`Сначала повесь ещё ${MIN - count()} — и тогда звезду! 🙂`);
        return;
      }
      topOn = 0.001;
      host.sfx('fanfare');
      setTimeout(finish, 1700);
    }
    let say = '',
      sayT = 0;
    function sayFor(text, d = 1.8) {
      say = text;
      sayT = d;
    }
    /** Какое место под точкой (CSS-пиксели канвы); −2 — макушка; −1 — мимо. */
    function spotAt(px, py) {
      const g = L(),
        r = clamp(g.crownH * 0.06, 18, 34),
        tp = topXY(g);
      if (Math.hypot(px - tp.x, py - tp.y) < r * 1.4) return -2;
      let best = -1,
        bd = r * 1.25;
      SPOTS.forEach((_, i) => {
        const p = spotXY(i, g),
          d = Math.hypot(px - p.x, py - (p.y + 8));
        if (d < bd) {
          bd = d;
          best = i;
        }
      });
      return best;
    }
    const local = (e) => {
      const r = cv.canvas.getBoundingClientRect();
      return [((e.clientX - r.left) / r.width) * cv.w, ((e.clientY - r.top) / r.height) * cv.h];
    };
    const tapAt = (px, py) => {
      const i = spotAt(px, py);
      if (i === -2) putTop();
      else if (i >= 0) place(i);
    };
    const down = (e) => {
      e.preventDefault();
      const [x, y] = local(e);
      tapAt(x, y);
    };
    cv.canvas.addEventListener('pointerdown', down);
    const pmove = (e) => {
      if (!drag) return;
      drag.x = e.clientX;
      drag.y = e.clientY;
      if (Math.hypot(drag.x - drag.sx, drag.y - drag.sy) > 12) drag.moved = true;
    };
    const pup = (e) => {
      if (!drag) return;
      const d = drag;
      drag = null;
      if (!d.moved) return;
      const [x, y] = local(e);
      const i = spotAt(x, y);
      if (i >= 0) place(i, d.kind);
    };
    window.addEventListener('pointermove', pmove);
    window.addEventListener('pointerup', pup);
    window.addEventListener('pointercancel', pup);
    // клавиатура
    const nearest = (dx, dy) => {
      const g = L(),
        a = spotXY(cursor, g);
      let best = cursor,
        bd = 1e9;
      SPOTS.forEach((_, i) => {
        if (i === cursor) return;
        const p = spotXY(i, g),
          ex = p.x - a.x,
          ey = p.y - a.y;
        if ((dx && Math.sign(ex) !== dx) || (dy && Math.sign(ey) !== dy) || (dx && Math.abs(ex) < 4) || (dy && Math.abs(ey) < 4)) return;
        const d = Math.abs(ex) + Math.abs(ey) * (dx ? 3 : 1) + Math.abs(ex) * (dy ? 2 : 0);
        if (d < bd) {
          bd = d;
          best = i;
        }
      });
      return best;
    };
    const kd = (e) => {
      const k = KINDS.find((q) => e.code === 'Digit' + q.key || e.code === 'Numpad' + q.key);
      if (k) choose(k.id);
      else if (e.code === 'ArrowLeft') cursor = nearest(-1, 0);
      else if (e.code === 'ArrowRight') cursor = nearest(1, 0);
      else if (e.code === 'ArrowUp') cursor = nearest(0, -1);
      else if (e.code === 'ArrowDown') cursor = nearest(0, 1);
      else if (e.code === 'Enter' || e.code === 'Space') place(cursor);
      else if (e.code === 'KeyS') putTop();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', kd);
    // для автотеста (dev/smoke_games.js): места (CSS-пиксели канвы), что где висит, можно ли звезду
    cv.canvas.__tree = () => {
      const g = L();
      return {
        w: cv.w,
        h: cv.h,
        sel,
        spots: SPOTS.map((_, i) => ({ ...spotXY(i, g), kind: placed[i] ? placed[i].kind : null })),
        top: topXY(g),
        placed: count(),
        kinds: kindsUsed(),
        ready: starReady(),
        starOn: !!topOn,
        over,
      };
    };

    // ---------- рисование ----------
    function tree(g) {
      const { cx, base, crownTop, crownH, th } = g,
        k = crownH / 300;
      // горшок и ствол
      fillRR(ctx, cx - 10 * k, base - th * 0.2, 20 * k, th * 0.12, 3, '#8d5524', OUT, 2);
      fillRR(ctx, cx - 34 * k, base - th * 0.1, 68 * k, th * 0.1, 6 * k, '#e03131', OUT, 2.4);
      fillRR(ctx, cx - 34 * k, base - th * 0.1, 68 * k, th * 0.025, 4 * k, '#fa5252');
      line(ctx, cx, base - th * 0.1, cx, base, '#ffd43b', 5 * k);
      // крона: четыре яруса, снизу вверх
      const tiers = [
        [0.62, 1.0],
        [0.42, 0.8],
        [0.2, 0.58],
        [0, 0.34],
      ];
      tiers.forEach(([v0, v1], j) => {
        const y0 = crownTop + v0 * crownH,
          y1 = crownTop + v1 * crownH,
          w = halfW(v1) * crownH * 1.02,
          tip = j === 3 ? y0 - 6 : y0;
        ctx.beginPath();
        ctx.moveTo(cx, tip);
        ctx.quadraticCurveTo(cx - w * 0.5, (tip + y1) / 2, cx - w, y1);
        // фестоны снизу яруса
        const n = 5;
        for (let i = 0; i < n; i++) {
          const xa = cx - w + (i * 2 * w) / n,
            xb = cx - w + ((i + 1) * 2 * w) / n;
          ctx.quadraticCurveTo((xa + xb) / 2, y1 + 9 * k, xb, y1);
        }
        ctx.quadraticCurveTo(cx + w * 0.5, (tip + y1) / 2, cx, tip);
        ctx.closePath();
        const gr = ctx.createLinearGradient(cx - w, 0, cx + w, 0);
        gr.addColorStop(0, '#2b8a3e');
        gr.addColorStop(0.55, '#37b24d');
        gr.addColorStop(1, '#2b8a3e');
        ctx.fillStyle = gr;
        ctx.fill();
        ctx.strokeStyle = OUT;
        ctx.lineWidth = 2.4;
        ctx.stroke();
        // снег на ветках
        for (let i = 0; i < 4; i++) {
          const xx = cx - w * 0.75 + (i * w * 1.5) / 3;
          ell(ctx, xx, y1 - 2 * k, 9 * k, 3 * k, 'rgba(255,255,255,.9)');
        }
      });
    }
    function draw() {
      const g = L(),
        { W, H } = g,
        k = g.crownH / 300;
      // вечерняя площадь: небо, снежинки, огоньки домов вдали
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#22306a');
      sky.addColorStop(0.75, '#5b6bb0');
      sky.addColorStop(1, '#7c8cc8');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 40; i++) {
        const x = ((i * 0.377 + Math.sin(t * 0.4 + i) * 0.01) % 1) * W,
          y = ((i * 0.613 + t * 0.04 * (1 + (i % 3) * 0.3)) % 1) * H,
          r = 1.5 + (i % 3) * 0.6;
        ell(ctx, x, y, r, r, 'rgba(255,255,255,.7)');
      }
      // дома вдали с окошками
      const gy = g.base - g.th * 0.05;
      for (let i = 0; i < 9; i++) {
        const hx = (i / 8) * W - 30,
          hh = 60 + ((i * 37) % 50),
          hw = 70;
        fillRR(ctx, hx, gy - hh, hw, hh + 10, 4, '#3b4a8a', null);
        for (let r = 0; r < 2; r++)
          for (let c = 0; c < 2; c++) fillRR(ctx, hx + 12 + c * 30, gy - hh + 14 + r * 24, 14, 12, 2, (i + r + c) % 3 ? '#ffe066' : '#5c6bc0');
      }
      ctx.fillStyle = '#eef6ff';
      ctx.fillRect(0, gy, W, H - gy);
      // тёплое сияние, когда звезда надета
      if (topOn) {
        const gl = ctx.createRadialGradient(g.cx, g.crownTop + g.crownH * 0.5, 0, g.cx, g.crownTop + g.crownH * 0.5, g.crownH);
        gl.addColorStop(0, 'rgba(255,230,140,.45)');
        gl.addColorStop(1, 'rgba(255,230,140,0)');
        ctx.fillStyle = gl;
        ctx.fillRect(0, 0, W, H);
      }
      tree(g);
      // места и игрушки
      const s = clamp(k * 1.1, 0.7, 1.9);
      SPOTS.forEach((_, i) => {
        const p = spotXY(i, g),
          q = placed[i];
        if (!q) {
          const pulse = 0.5 + 0.5 * Math.sin(t * 4 + i);
          ell(ctx, p.x, p.y + 8 * s, 9 * s, 9 * s, `rgba(255,255,255,${(0.25 + 0.3 * pulse).toFixed(2)})`, 'rgba(255,255,255,.85)', 1.6);
        } else {
          const f = flash && flash.i === i ? Math.max(0, 1 - flash.t * 3) : 0,
            sw = Math.sin(t * 2.2 + i) * 0.06;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(sw);
          ctx.scale(1 + f * 0.4, 1 + f * 0.4);
          toyArt(ctx, q.kind, 0, 0, s, q.col, t + i);
          ctx.restore();
        }
        if (i === cursor && !topOn) {
          ctx.strokeStyle = 'rgba(255,255,255,.75)';
          ctx.setLineDash([5, 4]);
          ctx.lineWidth = 2;
          ctx.strokeRect(p.x - 18 * s, p.y - 8 * s, 36 * s, 40 * s);
          ctx.setLineDash([]);
        }
      });
      // макушка: пустая; когда можно — светится; надета — звезда с лучами
      const tp = topXY(g);
      if (topOn) {
        const q = Math.min(1, topOn * 2.5),
          y = tp.y - (1 - q) * g.crownH * 0.5,
          r = 20 * s + (q < 1 ? 0 : Math.sin(t * 6) * 1.5);
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * TAU + t * 0.8;
          line(ctx, tp.x + Math.cos(a) * r * 1.3, y + Math.sin(a) * r * 1.3, tp.x + Math.cos(a) * r * 1.9, y + Math.sin(a) * r * 1.9, 'rgba(255,212,59,.85)', 2.5);
        }
        star(ctx, tp.x, y, r, '#ffd43b', OUT, 2.6);
        star(ctx, tp.x - r * 0.2, y - r * 0.2, r * 0.32, '#fff3bf');
      } else if (starReady()) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 5);
        ell(ctx, tp.x, tp.y, 22 * s, 22 * s, `rgba(255,212,59,${(0.25 + 0.35 * pulse).toFixed(2)})`, '#ffd43b', 2);
        ctx.font = `${Math.round(18 * s)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⭐', tp.x, tp.y + 1);
      }
      // хомячок рядом: радуется каждой игрушке
      const hs = clamp(k * 0.9, 0.55, 1.4),
        hx = g.tall ? g.cx + halfW(1) * g.crownH * 0.75 : g.cx + halfW(1) * g.crownH + 70 * hs,
        jump = flash && flash.t < 0.4 ? Math.sin((flash.t / 0.4) * Math.PI) * 14 * hs : 0;
      host.drawHamster(ctx, Math.min(W - 40 * hs, hx), g.base - 4 - jump, hs, host.look, { time: t, dir: -1, happy: true, armsUp: !!topOn || jump > 2 });
      // тащим игрушку пальцем
      if (drag && drag.moved) {
        const r = cv.canvas.getBoundingClientRect();
        toyArt(ctx, drag.kind, ((drag.x - r.left) / r.width) * cv.w, ((drag.y - r.top) / r.height) * cv.h - 12, s * 1.1, BALLS[balls % BALLS.length], t);
      }
      ctx.textAlign = 'center';
      ctx.font = '900 20px ui-rounded, "Trebuchet MS", sans-serif';
      for (const p of pops) {
        ctx.globalAlpha = Math.max(0, 1 - p.t);
        ctx.fillText(p.text, p.x, p.y - p.t * 30);
      }
      ctx.globalAlpha = 1;
    }
    function update(dt) {
      t += dt;
      if (topOn) topOn += dt;
      if (flash) flash.t += dt;
      if (sayT > 0) {
        sayT -= dt;
        if (sayT <= 0) say = '';
      }
      for (const p of pops) p.t += dt;
      for (let i = pops.length - 1; i >= 0; i--) if (pops[i].t > 1) pops.splice(i, 1);
      const n = count();
      tCount.textContent = `🎁 ${n} из ${SPOTS.length} · разных ${kindsUsed()} из ${KINDS.length}`;
      tSay.textContent =
        say ||
        (topOn ? '🎄 Ёлка наряжена!' : n === 0 ? '👇 Выбери игрушку и нажми на ветку' : n < MIN ? `Ещё ${MIN - n} — и можно звезду!` : '⭐ Можно надеть звезду — или вешай ещё!');
      topBtn.disabled = !starReady();
      topBtn.classList.toggle('ready', starReady());
    }
    const frame = (now) => {
      if (stopped) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      update(dt);
      draw();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    function finish() {
      if (over || stopped) return;
      over = true;
      const n = count(),
        kinds = kindsUsed();
      const stars = kinds >= STARS[1].kinds && n >= STARS[1].n ? 3 : kinds >= STARS[0].kinds && n >= STARS[0].n ? 2 : 1;
      host.finish({
        stars,
        text: `Ёлка наряжена, звезда сияет! Игрушек — <b>${n}</b>, разных — <b>${kinds}</b> из ${KINDS.length}. ${
          stars === 3
            ? 'Самая нарядная ёлка в городе!'
            : stars === 2
              ? 'Очень красиво! В следующий раз попробуй ещё больше разных игрушек.'
              : 'Ёлка рада! А если повесить побольше разных игрушек, будет ещё наряднее.'
        }`,
        extra: { n, kinds },
      });
    }
    return {
      stop() {
        stopped = true;
        cancelAnimationFrame(raf);
        cv.canvas.removeEventListener('pointerdown', down);
        window.removeEventListener('pointermove', pmove);
        window.removeEventListener('pointerup', pup);
        window.removeEventListener('pointercancel', pup);
        window.removeEventListener('keydown', kd);
        if (cv.destroy) cv.destroy();
        style.remove();
        top.remove();
        tray.remove();
      },
    };
  },
};
