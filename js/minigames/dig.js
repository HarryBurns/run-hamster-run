// Мини-игра «Раскопки» (пустыня, П.9; запускает кочевник Бархан или раскоп — features/desert.js).
// Посередине — каменная плита, засыпанная песком. Води пальцем или мышкой (с зажатой кнопкой) — кисточка счищает
// песок, под ним проступает окаменелость: ракушка-аммонит, отпечаток листа, зуб древнего ящера или косточка
// динозавра (какую — говорит занятие: host.info.fossil). Кусочек торчит из песка с самого начала — с него и начинай.
// Когда окаменелость расчищена почти целиком — «Нашла!». Звёзды — по времени: быстрее — больше; через TIME секунд
// Бархан помогает докопать (находка всё равно твоя). Проигрыша нет. Монеты и находку выдаёт занятие.
import { el, clamp } from '../core/util.js';
import { ell, poly, fillRR, line } from '../core/draw.js';
import { pic as kitPic } from './kit.js';
import { DEV } from '../core/dev.js';

const OUT = '#4a3728';
const TIME = 30; // секунд на раскопку, потом Бархан помогает
/** За сколько секунд нужно расчистить на 3★ и 2★. */
export const DIG_STARS = [12, 20];
const DONE = 0.9; // какую долю окаменелости расчистить, чтобы «нашла»
const GX = 48,
  GY = 30; // сетка, по которой считается, что уже расчищено
export const FOSSIL_NAMES = {
  fossil_shell: 'ракушку-аммонит',
  fossil_leaf: 'отпечаток листа',
  fossil_tooth: 'зуб древнего ящера',
  fossil_bone: 'косточку динозавра',
};

// ---------- рисунки окаменелостей: (cx, cy) — середина, r — размер ----------
const BONE = '#f3e3c3',
  BONE_D = '#c9a97a';
function fossil(ctx, id, cx, cy, r) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (id === 'fossil_shell') {
    ell(ctx, 0, 0, r * 0.92, r * 0.86, '#d8c3a0', OUT, 3);
    ctx.strokeStyle = '#8d6b45';
    ctx.lineWidth = Math.max(2, r * 0.06);
    ctx.beginPath();
    for (let a = 0; a < 15.5; a += 0.12) {
      const q = r * 0.06 + a * r * 0.052;
      ctx.lineTo(Math.cos(a) * q, Math.sin(a) * q * 0.94);
    }
    ctx.stroke();
    ctx.lineWidth = Math.max(1, r * 0.025);
    ctx.beginPath();
    for (let a = 2; a < 15.5; a += 0.42) {
      const q = r * 0.06 + a * r * 0.052,
        q2 = r * 0.06 + (a + 6.28) * r * 0.052;
      ctx.moveTo(Math.cos(a) * q, Math.sin(a) * q * 0.94);
      ctx.lineTo(Math.cos(a) * Math.min(q2, r * 0.9), Math.sin(a) * Math.min(q2, r * 0.9) * 0.94);
    }
    ctx.stroke();
    ell(ctx, -r * 0.3, -r * 0.35, r * 0.2, r * 0.1, 'rgba(255,255,255,.35)', null, 1, -0.6);
  } else if (id === 'fossil_leaf') {
    ctx.rotate(-0.5);
    ctx.beginPath();
    ctx.moveTo(0, r * 0.95);
    ctx.quadraticCurveTo(r * 0.75, r * 0.2, 0, -r * 0.95);
    ctx.quadraticCurveTo(-r * 0.75, r * 0.2, 0, r * 0.95);
    ctx.fillStyle = '#b5a27f';
    ctx.fill();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = '#6f5d3e';
    ctx.lineWidth = Math.max(1.5, r * 0.04);
    ctx.beginPath();
    ctx.moveTo(0, r * 1.15);
    ctx.lineTo(0, -r * 0.85);
    for (let i = 0; i < 6; i++) {
      const y = r * (0.65 - i * 0.26);
      ctx.moveTo(0, y);
      ctx.lineTo(r * 0.42 * (1 - Math.abs(i - 2) * 0.12), y - r * 0.2);
      ctx.moveTo(0, y);
      ctx.lineTo(-r * 0.42 * (1 - Math.abs(i - 2) * 0.12), y - r * 0.2);
    }
    ctx.stroke();
  } else if (id === 'fossil_tooth') {
    ctx.rotate(0.25);
    const pts = [-r * 0.55, r * 0.7, -r * 0.4, -r * 0.1, -r * 0.05, -r * 0.95, r * 0.35, -r * 0.2, r * 0.55, r * 0.7];
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    ctx.quadraticCurveTo(-r * 0.6, r * 0.1, pts[4], pts[5]);
    ctx.quadraticCurveTo(r * 0.5, r * 0.1, pts[8], pts[9]);
    ctx.quadraticCurveTo(0, r * 0.95, pts[0], pts[1]);
    ctx.fillStyle = '#f8f0dc';
    ctx.fill();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 3;
    ctx.stroke();
    // зазубринки по краю
    ctx.strokeStyle = '#a8916a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 1; i < 8; i++) {
      const k = i / 8;
      ctx.moveTo(r * 0.45 - k * r * 0.45, r * 0.5 - k * r * 1.3);
      ctx.lineTo(r * 0.36 - k * r * 0.4, r * 0.5 - k * r * 1.3);
    }
    ctx.stroke();
    ell(ctx, -r * 0.18, -r * 0.1, r * 0.08, r * 0.34, 'rgba(255,255,255,.7)', null, 1, 0.2);
    fillRR(ctx, -r * 0.55, r * 0.62, r * 1.1, r * 0.3, r * 0.12, '#c9a97a', OUT, 2.5);
  } else {
    // косточка динозавра: длинная, с шишечками на концах
    ctx.rotate(-0.55);
    line(ctx, -r * 0.7, 0, r * 0.7, 0, OUT, r * 0.42);
    line(ctx, -r * 0.7, 0, r * 0.7, 0, BONE, r * 0.34);
    for (const sx of [-1, 1])
      for (const sy of [-1, 1]) ell(ctx, sx * r * 0.78, sy * r * 0.17, r * 0.2, r * 0.2, BONE, OUT, 3);
    line(ctx, -r * 0.7, 0, r * 0.7, 0, BONE, r * 0.3);
    line(ctx, -r * 0.5, -r * 0.06, r * 0.5, -r * 0.06, 'rgba(255,255,255,.6)', r * 0.06);
    line(ctx, -r * 0.3, r * 0.08, r * 0.3, r * 0.08, BONE_D, r * 0.04);
  }
  ctx.restore();
}
/** Плита: светлый камень с трещинками (на ней лежит окаменелость). */
function slabArt(ctx, w, h) {
  fillRR(ctx, 0, 0, w, h, 18, '#cdb799', OUT, 3);
  ctx.strokeStyle = 'rgba(90,70,45,.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const x = w * (0.12 + i * 0.2),
      y = h * (0.2 + ((i * 37) % 60) / 100);
    ctx.moveTo(x, y);
    ctx.lineTo(x + w * 0.06, y + h * 0.08);
    ctx.lineTo(x + w * 0.04, y + h * 0.18);
  }
  ctx.stroke();
  for (let i = 0; i < 30; i++) ell(ctx, ((i * 0.618) % 1) * w, ((i * 0.377) % 1) * h, 2, 1.4, 'rgba(255,255,255,.25)');
}
/** Песок сверху: тёплая заливка с рябью и крупинками. */
function sandArt(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#f6dba6');
  g.addColorStop(1, '#e8c286');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(0, 0, w, h, 18) : ctx.rect(0, 0, w, h);
  ctx.fill();
  ctx.strokeStyle = 'rgba(190,140,70,.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let y = 14; y < h; y += 18)
    for (let x = ((y * 7) % 40) - 20; x < w; x += 60) {
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 20, y - 6, x + 40, y);
    }
  ctx.stroke();
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = i % 3 ? 'rgba(170,120,60,.35)' : 'rgba(255,250,230,.6)';
    ctx.fillRect(((i * 0.618) % 1) * w, ((i * 0.377 + i * 0.01) % 1) * h, 2, 2);
  }
}
/** Кисточка: (x, y) — кончик щетины. */
function brush(ctx, x, y, s, a = -0.7) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.scale(s, s);
  line(ctx, 0, -14, 0, -56, OUT, 7);
  line(ctx, 0, -14, 0, -56, '#ff922b', 4.4);
  fillRR(ctx, -6, -18, 12, 8, 2, '#adb5bd', OUT, 1.6);
  poly(ctx, [-7, -11, 7, -11, 9, 2, -9, 2], '#f1e0c5', OUT, 1.6);
  for (let i = -6; i <= 6; i += 3) line(ctx, i, -8, i * 1.15, 1, 'rgba(120,80,40,.45)', 1);
  ctx.restore();
}

/** Маленькая картинка для правил (data: URL). */
const pic = (draw, w = 120, h = 56) => kitPic(draw, w, h);

const CSS = `
.dg-rules{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:8px 0 2px}
.dg-col{background:#fff;border-radius:14px;padding:4px 10px;border:3px solid #ffc078;text-align:center;flex:1 1 110px;max-width:150px}
.dg-col img{max-width:100%;height:auto}
.dg-col.find{border-color:#8ce99a}
.dg-col.time{border-color:#74c0fc}
.dg-col b{display:block;font-size:15px}
.dg-col small{display:block;font-size:12px;opacity:.75;line-height:1.2}
.dg-top{position:absolute;left:0;right:0;top:0;display:flex;gap:8px;justify-content:center;padding:8px;pointer-events:none;z-index:2}
.dg-chip{background:rgba(255,255,255,.92);border-radius:12px;padding:4px 12px;font-weight:900;font-size:16px;box-shadow:0 2px 0 rgba(74,55,40,.15)}
`;

export default {
  id: 'dig',
  title: 'Раскопки',
  icon: '🦴',
  css: CSS,
  get howTo() {
    return `Под песком спряталась древняя окаменелость. <b>Води пальцем — счищай песок кисточкой!</b>
      <div class="dg-rules">
        <div class="dg-col"><b>👆 Води</b>${pic((c, w, h) => {
          sandArt(c, w, h);
          c.globalCompositeOperation = 'destination-out';
          line(c, 14, 40, 70, 18, '#000', 16);
          c.globalCompositeOperation = 'source-over';
          brush(c, 74, 16, 0.55, 0.9);
        })}<small>пальцем или мышкой<br>с зажатой кнопкой</small></div>
        <div class="dg-col find"><b>🦴 Найди</b>${pic((c, w, h) => {
          slabArt(c, w, h);
          fossil(c, 'fossil_shell', w / 2, h / 2, 22);
        })}<small>кусочек торчит из песка —<br>начни с него!</small></div>
        <div class="dg-col time"><b>⏱ Быстрее</b>${pic((c, w, h) => {
          for (let i = 0; i < 3; i++) {
            const x = 24 + i * 36,
              pts = [];
            for (let k = 0; k < 10; k++) {
              const a = -Math.PI / 2 + (k * Math.PI) / 5,
                r = k % 2 ? 6 : 14;
              pts.push(x + Math.cos(a) * r, 28 + Math.sin(a) * r);
            }
            poly(c, pts, '#ffd43b', OUT, 2);
          }
        })}<small>быстрее нашла —<br>больше звёзд</small></div>
      </div>
      Торопиться не страшно: если не успеешь, Бархан поможет докопать!`;
  },
  start(host) {
    const top = el('div', 'dg-top');
    const tTime = el('div', 'dg-chip'),
      tGot = el('div', 'dg-chip');
    top.append(tTime, tGot);
    host.add(top);
    const cv = host.canvas();
    const ctx = cv.ctx;
    const id = FOSSIL_NAMES[host.info.fossil] ? host.info.fossil : 'fossil_shell';
    // на раскопе хомячок в шлеме исследователя (только на время игры — наряд не меняется)
    const look = { ...host.look, outfit: { ...host.look.outfit, head: { kind: 'pith', c: '#f1e0c5', c2: '#d9a066' } } };
    let t = 0,
      over = false,
      found = 0, // > 0 — нашла: время находки
      foundT = 0,
      helped = false,
      drawing = false,
      px = -1,
      py = -1,
      hover = false;
    // плита и песок: свои картинки в размер плиты (пересоздаются, если поменялся размер экрана)
    let box = null,
      sand = null,
      sandCtx = null,
      slab = null;
    const cleared = new Uint8Array(GX * GY);
    let mask = null, // какие клетки сетки — окаменелость
      maskN = 1,
      got = 0;
    const R = () => Math.min(box.w, box.h) * 0.36; // размер окаменелости
    const BR = () => Math.max(16, Math.min(box.w, box.h) * 0.085); // радиус кисточки
    function layout() {
      const w = Math.min(cv.w * 0.84, 560, cv.h * 0.95),
        h = Math.min(w * 0.68, cv.h * 0.6);
      const nb = { x: (cv.w - w) / 2, y: Math.max(56, cv.h * 0.42 - h / 2), w, h };
      if (box && Math.abs(nb.w - box.w) < 1 && Math.abs(nb.h - box.h) < 1) {
        box.x = nb.x;
        box.y = nb.y;
        return;
      }
      const first = !box;
      box = nb;
      const dpr = cv.dpr || 1;
      slab = document.createElement('canvas');
      slab.width = Math.round(w * dpr);
      slab.height = Math.round(h * dpr);
      const sc = slab.getContext('2d');
      sc.scale(dpr, dpr);
      slabArt(sc, w, h);
      fossil(sc, id, w / 2, h / 2, R());
      sand = document.createElement('canvas');
      sand.width = slab.width;
      sand.height = slab.height;
      sandCtx = sand.getContext('2d');
      sandCtx.scale(dpr, dpr);
      sandArt(sandCtx, w, h);
      // маска окаменелости по сетке: рисуем её одну в маленькую картинку и смотрим, где не пусто (один раз)
      const mc = document.createElement('canvas');
      mc.width = GX;
      mc.height = GY;
      const mx = mc.getContext('2d');
      mx.scale(GX / w, GY / h);
      fossil(mx, id, w / 2, h / 2, R());
      const data = mx.getImageData(0, 0, GX, GY).data;
      mask = new Uint8Array(GX * GY);
      maskN = 0;
      for (let i = 0; i < GX * GY; i++)
        if (data[i * 4 + 3] > 60) {
          mask[i] = 1;
          maskN++;
        }
      maskN = Math.max(1, maskN);
      // уже расчищенное (экран повернули посреди игры) — счистить снова
      for (let i = 0; i < GX * GY; i++)
        if (cleared[i]) erase(((i % GX) + 0.5) * (w / GX), (Math.floor(i / GX) + 0.5) * (h / GY), w / GX);
      if (first) {
        // кусочек торчит из песка: самая левая клетка окаменелости
        let best = -1;
        for (let i = 0; i < GX * GY; i++) if (mask[i] && (best < 0 || i % GX < best % GX)) best = i;
        if (best >= 0) brushAt(((best % GX) + 1.5) * (w / GX), (Math.floor(best / GX) + 0.5) * (h / GY), BR() * 0.8);
      }
    }
    function erase(x, y, r) {
      const g = sandCtx.createRadialGradient(x, y, r * 0.2, x, y, r);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.7, 'rgba(0,0,0,.85)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      sandCtx.globalCompositeOperation = 'destination-out';
      sandCtx.fillStyle = g;
      sandCtx.beginPath();
      sandCtx.arc(x, y, r, 0, Math.PI * 2);
      sandCtx.fill();
      sandCtx.globalCompositeOperation = 'source-over';
    }
    /** Провести кисточкой в точке плиты (x, y): стереть песок и отметить клетки сетки. */
    function brushAt(x, y, r = BR()) {
      erase(x, y, r);
      const cw = box.w / GX,
        ch = box.h / GY,
        rr = r * 0.75;
      for (let gy = Math.max(0, Math.floor((y - rr) / ch)); gy <= Math.min(GY - 1, Math.floor((y + rr) / ch)); gy++)
        for (let gx = Math.max(0, Math.floor((x - rr) / cw)); gx <= Math.min(GX - 1, Math.floor((x + rr) / cw)); gx++) {
          const i = gy * GX + gx;
          if (cleared[i] || Math.hypot((gx + 0.5) * cw - x, (gy + 0.5) * ch - y) > rr) continue;
          cleared[i] = 1;
          if (mask && mask[i]) got++;
        }
    }
    function stroke(x0, y0, x1, y1) {
      const d = Math.hypot(x1 - x0, y1 - y0),
        n = Math.max(1, Math.ceil(d / (BR() * 0.4)));
      for (let k = 1; k <= n; k++) brushAt(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n);
      if (d > 2 && Math.random() < 0.5) host.sfx('paper');
    }
    const progress = () => Math.min(1, got / maskN);

    // ---------- управление ----------
    const local = (e) => {
      const r = cv.canvas.getBoundingClientRect();
      return { x: e.clientX - r.left - box.x, y: e.clientY - r.top - box.y };
    };
    const down = (e) => {
      e.preventDefault();
      if (over || found) return;
      drawing = true;
      const p = local(e);
      px = p.x;
      py = p.y;
      brushAt(p.x, p.y);
      try {
        cv.canvas.setPointerCapture(e.pointerId);
      } catch (err) {
        /* не страшно */
      }
    };
    const move = (e) => {
      const p = local(e);
      hover = true;
      if (drawing && !over && !found) stroke(px, py, p.x, p.y);
      px = p.x;
      py = p.y;
    };
    const up = () => {
      drawing = false;
    };
    const leave = () => {
      hover = false;
      drawing = false;
    };
    host.on(cv.canvas, 'pointerdown', down);
    host.on(cv.canvas, 'pointermove', move);
    host.on(window, 'pointerup', up);
    host.on(cv.canvas, 'pointerleave', leave);
    // для автотеста (dev/smoke_desert.js): где плита (CSS-пиксели канвы), где окаменелость, сколько расчищено
    if (DEV)
      cv.canvas.__dig = () => ({
        box: { ...box },
        cells: mask
          ? [...mask]
              .map((v, i) =>
                v ? [box.x + ((i % GX) + 0.5) * (box.w / GX), box.y + (Math.floor(i / GX) + 0.5) * (box.h / GY)] : null,
              )
              .filter(Boolean)
          : [],
        progress: progress(),
        left: Math.max(0, TIME - t),
        found: !!found,
        fossil: id,
      });

    function update(dt) {
      t += dt;
      if (!found && (progress() >= DONE || t >= TIME)) {
        helped = progress() < DONE;
        found = t;
        foundT = 0;
        host.sfx('win');
        host.later(finish, 1500);
      }
      if (found) foundT += dt;
    }

    function draw() {
      layout();
      const W = cv.w,
        H = cv.h,
        s = clamp(Math.min(W, H * 1.2) / 520, 0.7, 1.3);
      // раскоп: песок, колышки и верёвка по краям
      ctx.fillStyle = '#e6c288';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(190,140,70,.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let y = 20; y < H; y += 26)
        for (let x = ((y * 5) % 50) - 30; x < W; x += 80) {
          ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + 25, y - 7, x + 50, y);
        }
      ctx.stroke();
      const b = box;
      line(ctx, b.x - 16, b.y - 14, b.x + b.w + 16, b.y - 14, '#c92a2a', 2);
      line(ctx, b.x - 16, b.y + b.h + 14, b.x + b.w + 16, b.y + b.h + 14, '#c92a2a', 2);
      for (const x of [b.x - 16, b.x + b.w + 16])
        for (const y of [b.y - 14, b.y + b.h + 14]) fillRR(ctx, x - 3, y - 12, 6, 18, 2, '#a8703f', OUT, 1.4);
      // плита и песок поверх
      ctx.drawImage(slab, b.x, b.y, b.w, b.h);
      if (found) ctx.globalAlpha = Math.max(0, 1 - foundT * 2.5); // нашла — остатки песка сдувает
      ctx.drawImage(sand, b.x, b.y, b.w, b.h);
      ctx.globalAlpha = 1;
      if (found) {
        // окаменелость сияет и чуть подпрыгивает
        const k = Math.min(1, foundT * 2);
        ctx.save();
        ctx.globalAlpha = 0.55 * k;
        ell(ctx, b.x + b.w / 2, b.y + b.h / 2, R() * 1.4, R() * 1.2, '#fff9db');
        ctx.restore();
        fossil(
          ctx,
          id,
          b.x + b.w / 2,
          b.y + b.h / 2 - Math.sin(Math.min(1, foundT) * Math.PI) * 12,
          R() * (1 + 0.1 * k),
        );
        for (let i = 0; i < 8; i++) {
          const a = i * 0.785 + foundT * 2,
            rr = R() * (1.2 + foundT * 0.4);
          ctx.globalAlpha = Math.max(0, 1 - foundT * 0.7);
          ell(
            ctx,
            b.x + b.w / 2 + Math.cos(a) * rr,
            b.y + b.h / 2 + Math.sin(a) * rr * 0.8,
            4 * s,
            4 * s,
            '#ffd43b',
            OUT,
            1,
          );
        }
        ctx.globalAlpha = 1;
        ctx.textAlign = 'center';
        ctx.font = `900 ${Math.round(26 * s)}px ui-rounded, "Trebuchet MS", sans-serif`;
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#fff';
        const msg = helped ? 'Бархан помог докопать!' : 'Нашла!';
        ctx.strokeText(msg, W / 2, b.y - 26);
        ctx.fillStyle = '#e8590c';
        ctx.fillText(msg, W / 2, b.y - 26);
      }
      // хомячок-археолог с кисточкой — сбоку снизу
      const hx = Math.max(60 * s, b.x - 50 * s),
        hy = Math.min(H - 12, b.y + b.h + 90 * s);
      if (W > 360 || hy < H - 20)
        host.drawHamster(ctx, hx, hy, 0.75 * s, look, { time: t, dir: 1, happy: !!found, blink: t % 3.1 < 0.12 });
      // кисточка у пальца (или над плитой — подсказкой)
      if (!found) {
        if (hover && px > -40 && px < b.w + 40 && py > -40 && py < b.h + 40)
          brush(ctx, b.x + px, b.y + py, s * 0.9, drawing ? -0.4 + Math.sin(t * 20) * 0.25 : -0.7);
        else if (t < 3) brush(ctx, b.x + b.w * 0.25 + Math.sin(t * 3) * 30, b.y + b.h * 0.5, s * 0.9);
      }
    }

    host.loop((dt) => {
      if (!over) update(dt);
      tTime.textContent = `⏱ ${Math.ceil(Math.max(0, TIME - (found || t)))}`;
      tGot.textContent = `🦴 ${Math.round(progress() * 100)}%`;
      draw();
    });
    function finish() {
      if (over) return;
      over = true;
      const sec = found,
        stars = helped ? 1 : sec <= DIG_STARS[0] ? 3 : sec <= DIG_STARS[1] ? 2 : 1;
      host.finish({
        stars,
        text: helped
          ? `Песок был упрямый — Бархан помог докопать. Ты нашла ${FOSSIL_NAMES[id]}! В следующий раз води кисточкой там, где торчит кусочек.`
          : `Ты нашла ${FOSSIL_NAMES[id]} за ${Math.round(sec)} с!${stars === 3 ? ' Настоящий палеонтолог!' : ' Ей миллионы лет!'}`,
        extra: { fossil: id, sec: Math.round(sec), helped },
      });
    }
  },
};
