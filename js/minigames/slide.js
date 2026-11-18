// Мини-игра «Горка» (курортный отель, П.17; запускается с водной горки на крыше — features/hotel.js).
// Вид сверху: хомячок на надувном круге несётся по извилистой трубе водной горки (труба бежит навстречу). Рули —
// пальцем или мышью (круг едет туда, где палец), или стрелками ← →: на поворотах «наклоняйся» внутрь, чтобы не
// вылететь к бортику. Собирай пузыри и звёздочки. Проигрыша нет: задела бортик — «плюх!», брызги, круг на миг
// притормозит. 40 секунд; в конце — в бассейн с брызгами. Звёзды — по тому, сколько собрано. Приз даёт занятие.
// Горок четыре (От5, TRACKS): после «Начать!» выбираешь трассу — у каждой свой рисунок поворотов, ширина и скорость.
import { el, clamp, plural } from '../core/util.js';
import { ell, fillRR, line, star } from '../core/draw.js';
import { pic as kitPic } from './kit.js';

const TIME = 40;
const OUT = '#4a3728';
/** Сколько очков на 2★ и 3★ (пузырь — 1, звёздочка — 3). */
export const SLIDE_STARS = [24, 44];
const KINDS = { bubble: { pts: 1, r: 14 }, star: { pts: 3, r: 16 } };
/**
 * Трассы (От5): c(u) — центр трубы (доля ширины полосы) на расстоянии u (в экранах) от старта; half — полуширина
 * трубы; speed — множитель скорости; rim/water — цвета бортика и воды. Центр всегда в 0.25…0.75 — труба на экране.
 */
export const TRACKS = [
  {
    id: 'kid',
    name: 'Детская',
    icon: '🐣',
    say: 'широкая и спокойная',
    half: 0.2,
    speed: 0.88,
    rim: '#8ce99a',
    water: '#74c0fc',
    c: (u) => 0.5 + 0.13 * Math.sin(u * 1.25) + 0.04 * Math.sin(u * 2.7 + 0.5),
  },
  {
    id: 'snake',
    name: 'Змейка',
    icon: '🐍',
    say: 'плавные повороты',
    half: 0.17,
    speed: 1,
    rim: '#ffd43b',
    water: '#74c0fc',
    c: (u) => 0.5 + 0.2 * Math.sin(u * 1.9) + 0.09 * Math.sin(u * 4.3 + 1.2),
  },
  {
    id: 'zigzag',
    name: 'Зигзаг',
    icon: '⚡',
    say: 'прямо — и резко вбок!',
    half: 0.18,
    speed: 0.95,
    rim: '#ff8787',
    water: '#66d9e8',
    c: (u) => 0.5 + (0.23 * Math.tanh(3 * Math.sin(u * 1.5))) / Math.tanh(3),
  },
  {
    id: 'typhoon',
    name: 'Тайфун',
    icon: '🌪️',
    say: 'чем дальше, тем круче',
    half: 0.16,
    speed: 1.05,
    rim: '#b197fc',
    water: '#4dabf7',
    c: (u) => 0.5 + (0.09 + 0.15 * Math.min(1, u / 12)) * Math.sin(u * 1.5 + u * u * 0.035),
  },
];
export const TRACK_BY_ID = Object.fromEntries(TRACKS.map((q) => [q.id, q]));
/** Картинка трассы для выбора: труба сверху вниз (u от 0 до len). */
function trackPic(tr, w = 84, h = 104, len = 9) {
  const c = document.createElement('canvas');
  c.width = w * 2;
  c.height = h * 2;
  const x = c.getContext('2d');
  x.scale(2, 2);
  x.lineJoin = 'round';
  x.lineCap = 'round';
  x.fillStyle = '#fff4e6';
  x.fillRect(0, 0, w, h);
  const path = () => {
    x.beginPath();
    for (let i = 0; i <= 60; i++) {
      const u = (i / 60) * len,
        px = 6 + tr.c(u) * (w - 12),
        py = h - 4 - (i / 60) * (h - 8);
      if (i) x.lineTo(px, py);
      else x.moveTo(px, py);
    }
  };
  for (const [lw, col] of [
    [tr.half * w * 1.3 + 5, OUT],
    [tr.half * w * 1.3 + 2, tr.rim],
    [tr.half * w * 1.3 - 3, tr.water],
  ]) {
    path();
    x.strokeStyle = col;
    x.lineWidth = lw;
    x.stroke();
  }
  return `<img src="${c.toDataURL()}" width="${w}" height="${h}" alt="">`;
}

/** Хомячок на круге (вид сверху-сзади). */
function drawRing(ctx, x, y, s, tilt) {
  ell(ctx, x + 3 * s, y + 8 * s, 30 * s, 10 * s, 'rgba(20,60,120,.18)');
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ell(ctx, 0, 0, 30 * s, 16 * s, '#ff6b9d', OUT, 2);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + 0.4;
    ell(ctx, Math.cos(a) * 24 * s, Math.sin(a) * 12 * s, 6 * s, 4 * s, '#fff', null, 0, a);
  }
  ell(ctx, 0, 0, 16 * s, 7 * s, '#74c0fc', OUT, 1.5);
  ctx.restore();
}
function drawBubble(ctx, x, y, s, t) {
  const r = (11 + Math.sin(t * 4 + x) * 1.2) * s;
  ell(ctx, x, y, r, r, 'rgba(231,245,255,.75)', '#4dabf7', 2);
  ell(ctx, x - r * 0.35, y - r * 0.35, r * 0.28, r * 0.2, '#fff');
}
function drawStar(ctx, x, y, s, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 3 + x) * 0.3);
  star(ctx, 0, 0, 14 * s, '#ffd43b', OUT, 2);
  ctx.restore();
}

/** Маленькая картинка для правил. */
const pic = (draw, size = 46) => kitPic((x) => draw(x, size / 2, size / 2, size / 50), size, size);
/** Картинка «наклоняйся на повороте»: кусок трубы с поворотом и стрелка внутрь. */
function turnPic(x, cx, cy, s) {
  x.lineCap = 'round';
  const path = () => {
    x.beginPath();
    x.moveTo(cx - 8 * s, cy + 19 * s);
    x.quadraticCurveTo(cx - 10 * s, cy - 12 * s, cx + 18 * s, cy - 13 * s);
  };
  for (const [w, col] of [
    [22, OUT],
    [18, '#ffd43b'],
    [10, '#74c0fc'],
  ]) {
    path();
    x.strokeStyle = col;
    x.lineWidth = w * s;
    x.stroke();
  }
  x.lineCap = 'butt';
  // стрелка «рули внутрь поворота»
  line(x, cx + 14 * s, cy + 12 * s, cx + 3 * s, cy + 1 * s, '#e64980', 3 * s);
  line(x, cx + 3 * s, cy + 1 * s, cx + 10 * s, cy + 0.5 * s, '#e64980', 3 * s);
  line(x, cx + 3 * s, cy + 1 * s, cx + 3.5 * s, cy + 8 * s, '#e64980', 3 * s);
}

const CSS = `
.sd-rules{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:8px 0 2px}
.sd-col{background:#fff;border-radius:14px;padding:4px 10px;border:3px solid #8ce99a;text-align:center}
.sd-col.how{border-color:#74c0fc}
.sd-col.turn{border-color:#ffd43b}
.sd-col b{display:block;font-size:16px}
.sd-col .row{display:flex;gap:4px;justify-content:center;align-items:center;font-size:26px;font-weight:900}
.sd-col small{display:block;font-size:12px;opacity:.75;line-height:1.2}
.sd-top{position:absolute;left:0;right:0;top:0;display:flex;gap:8px;justify-content:center;padding:8px;pointer-events:none;z-index:2}
.sd-pick{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:12px;z-index:3;background:rgba(231,245,255,.92);overflow:auto}
.sd-pick h3{margin:0;font-size:20px}
.sd-pick .cards{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;max-width:720px}
.sd-pick button{background:#fff;border:3px solid #74c0fc;border-radius:16px;padding:6px 8px;font:inherit;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;width:146px;touch-action:manipulation}
.sd-pick button:hover,.sd-pick button:focus-visible{border-color:#ff6b9d;transform:translateY(-2px)}
.sd-pick button b{font-size:16px;white-space:nowrap}
.sd-pick button small{font-size:12px;opacity:.75;line-height:1.2}
.sd-pick img{border-radius:10px}
@media (max-width:420px){.sd-pick button{width:136px}}
@media (max-height:460px){.sd-pick button{width:112px}.sd-pick img{height:60px;width:auto}}
.sd-chip{background:rgba(255,255,255,.92);border-radius:12px;padding:4px 12px;font-weight:900;font-size:16px;box-shadow:0 2px 0 rgba(74,55,40,.15)}
`;

export default {
  id: 'slide',
  title: 'Горка',
  icon: '🌀',
  css: CSS,
  get howTo() {
    return `Ух! Водная горка! <b>Рули влево и вправо</b> — пальцем, мышкой или стрелками.
      <div class="sd-rules">
        <div class="sd-col how"><b>🛟 Рули</b><div class="row">◀ ${pic((c, x, y, s) => drawRing(c, x, y + 6, s * 1.1, 0))} ▶</div><small>пальцем, мышкой<br>или стрелками ← →</small></div>
        <div class="sd-col turn"><b>↪ Поворот</b><div class="row">${pic((c, x, y, s) => turnPic(c, x, y, s))}</div><small>на повороте рули внутрь —<br>не задевай бортик</small></div>
        <div class="sd-col"><b>✅ Собирай</b><div class="row">${pic((c, x, y, s) => drawBubble(c, x, y, s * 1.4, 0))}${pic((c, x, y, s) => drawStar(c, x, y, s * 1.3, 0))}</div><small>пузыри и звёздочки<br>(звёздочка — за три!)</small></div>
      </div>
      За ${TIME} секунд собери побольше! Задела бортик — «плюх!», и катишься дальше.
      Горок — ${TRACKS.length}: ${TRACKS.map((q) => `${q.icon} ${q.name}`).join(', ')}. Выбирай любую!`;
  },
  start(host) {
    const top = el('div', 'sd-top');
    const tTime = el('div', 'sd-chip'),
      tGot = el('div', 'sd-chip'),
      tBump = el('div', 'sd-chip');
    top.append(tTime, tGot, tBump);
    host.add(top);
    const cv = host.canvas();
    const ctx = cv.ctx;
    const level = host.level || 0;
    let track = TRACK_BY_ID[host.info && host.info.track] || null; // трасса: выбирают после «Начать!» (или задана заранее)
    const center = (u) => (track || TRACKS[1]).c(u);
    let t = 0,
      over = false,
      got = 0,
      bumps = 0,
      dist = 0, // сколько проехали (пиксели экрана)
      spawn = 0.4,
      slow = 1,
      splash = 0, // > 0 — брызги от бортика
      end = 0; // > 0 — финиш: плюх в бассейн
    const items = []; // { kind, d (пиксели от старта), off (−1..1 поперёк трубы), hit }
    const drops = [];
    const pops = host.pops();
    const ring = { x: 0.5, to: 0.5, vx: 0 };
    const LW = () => Math.min(cv.w, Math.max(320, cv.h * 0.85), 640),
      X0 = () => (cv.w - LW()) / 2,
      PX = (fx) => X0() + fx * LW();
    const S = () => clamp(LW() / 400, 0.85, 1.45);
    const ringY = () => cv.h * 0.72;
    const U = (d) => d / Math.max(300, cv.h); // расстояние в «экранах»
    const speed = () => cv.h * (0.5 + Math.min(t / TIME, 1) * 0.25 + level * 0.02) * slow * (track ? track.speed : 1);
    const halfW = () => (track || TRACKS[1]).half;
    // ---------- выбор трассы ----------
    let pick = null;
    const choose = (id) => {
      if (track && !pick) return;
      track = TRACK_BY_ID[id] || TRACKS[0];
      if (pick) pick.remove();
      pick = null;
      host.sfx('splash');
    };
    if (!track) {
      pick = el('div', 'sd-pick', '<h3>Какую горку выберешь?</h3>');
      const cards = el('div', 'cards');
      for (const q of TRACKS) {
        const b = el('button', '', `<b>${q.icon} ${q.name}</b>${trackPic(q)}<small>${q.say}</small>`);
        b.dataset.track = q.id;
        b.onclick = () => choose(q.id);
        cards.appendChild(b);
      }
      pick.appendChild(cards);
      host.add(pick);
    }

    // ---------- управление ----------
    const toX = (e) => {
      const r = cv.canvas.getBoundingClientRect();
      ring.to = clamp((((e.clientX - r.left) / r.width) * cv.w - X0()) / LW(), 0.05, 0.95);
    };
    let pressed = false;
    const down = (e) => {
      pressed = true;
      toX(e);
    };
    const move = (e) => {
      if (pressed || e.pointerType === 'mouse') toX(e);
    };
    const up = () => (pressed = false);
    host.on(cv.canvas, 'pointerdown', down);
    host.on(cv.canvas, 'pointermove', move);
    host.on(window, 'pointerup', up);
    const keys = new Set();
    const kd = (e) => {
      if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(e.code)) {
        keys.add(e.code);
        e.preventDefault();
      }
    };
    const ku = (e) => keys.delete(e.code);
    host.on(window, 'keydown', kd);
    host.on(window, 'keyup', ku);
    // для автотеста (dev/smoke_hotel.js): где круг, где центр трубы и что впереди (x — доля ширины, y — пиксели)
    cv.canvas.__slide = () => ({
      x: ring.x,
      y: ringY(),
      w: cv.w,
      x0: X0(),
      lw: LW(),
      tube: center(U(dist)),
      track: track ? track.id : null,
      picking: !!pick,
      half: halfW(),
      t,
      items: items.filter((q) => !q.hit).map((q) => ({ kind: q.kind, x: center(U(q.d)) + q.off * halfW() * 0.8, y: ringY() - (q.d - dist) })),
    });

    cv.canvas.__slideSkip = (sec) => (t = Math.max(t, TIME - sec)); // автотест: «до финиша осталось sec секунд»
    function update(dt) {
      if (!track || pick) return; // ждём выбора трассы
      t += dt;
      if (end > 0) {
        end += dt;
        if (end > 1.3) finish();
        return;
      }
      const kx = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
      if (kx) ring.to = clamp(ring.to + kx * dt * 1.1, 0.05, 0.95);
      const v = speed();
      dist += v * dt;
      // круг едет к пальцу; на повороте вода сносит его наружу — надо рулить внутрь
      const u = U(dist),
        c = center(u),
        curve = (center(u + 0.04) - 2 * c + center(u - 0.04)) / 0.0016; // кривизна трубы (куда она загибает)
      const was = ring.x;
      ring.x += (ring.to - ring.x) * Math.min(1, dt * 6);
      ring.x -= clamp(curve, -3, 3) * 0.02 * dt; // на повороте вода сносит наружу
      ring.vx = (ring.x - was) / Math.max(dt, 0.001);
      slow = Math.min(1, slow + dt * 0.6);
      if (splash > 0) splash -= dt;
      // бортик: «плюх!», брызги, круг отталкивает к середине
      const lim = halfW() - 0.035;
      if (Math.abs(ring.x - c) > lim) {
        ring.x = c + Math.sign(ring.x - c) * (lim - 0.03);
        if (splash <= 0) {
          bumps++;
          splash = 0.7;
          slow = 0.5;
          host.sfx('splash');
          pops.add('Плюх!', PX(ring.x), ringY() - 60 * S(), '#1c7ed6');
          for (let i = 0; i < 10; i++)
            drops.push({ x: PX(ring.x), y: ringY(), vx: (Math.random() - 0.5) * 200, vy: -Math.random() * 180, t: 0 });
        }
      }
      // пузыри и звёздочки впереди — внутри трубы
      spawn -= dt;
      if (spawn <= 0) {
        spawn = 0.42 + Math.random() * 0.25;
        const kind = Math.random() < 0.22 ? 'star' : 'bubble';
        items.push({ kind, d: dist + cv.h * 0.95, off: (Math.random() * 2 - 1) * 0.75, hit: false });
      }
      const ry = ringY(),
        s = S();
      for (const q of items) {
        if (q.hit) continue;
        const qy = ry - (q.d - dist),
          qx = (center(U(q.d)) + q.off * halfW() * 0.8 - ring.x) * LW();
        const r = (KINDS[q.kind].r + 22) * s;
        if (qx * qx + (qy - ry) * (qy - ry) > r * r) continue;
        q.hit = true;
        got += KINDS[q.kind].pts;
        host.sfx(q.kind === 'star' ? 'magic' : 'pop');
        pops.add('+' + KINDS[q.kind].pts, PX(ring.x), qy - 30, q.kind === 'star' ? '#f59f00' : '#1c7ed6');
      }
      for (let i = items.length - 1; i >= 0; i--) if (ry - (items[i].d - dist) > cv.h + 40) items.splice(i, 1);
      pops.step(dt);
      for (const p of drops) {
        p.t += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 380 * dt;
      }
      for (let i = drops.length - 1; i >= 0; i--) if (drops[i].t > 0.8) drops.splice(i, 1);
      if (t >= TIME) {
        end = 0.001;
        host.sfx('splash');
        for (let i = 0; i < 24; i++)
          drops.push({ x: PX(ring.x), y: ringY(), vx: (Math.random() - 0.5) * 320, vy: -Math.random() * 300, t: 0 });
      }
    }

    function draw() {
      const W = cv.w,
        H = cv.h,
        s = S(),
        ry = ringY(),
        HALF = halfW(),
        tr = track || TRACKS[1];
      // палуба у бассейна: плитка бежит навстречу, по краям — пальмы и шезлонги
      ctx.fillStyle = '#fff4e6';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(214,180,140,.35)';
      ctx.lineWidth = 2;
      const tile = 46 * s,
        off = dist % tile;
      ctx.beginPath();
      for (let y = off - tile; y < H; y += tile) {
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
      }
      for (let x = 0; x < W; x += tile) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
      }
      ctx.stroke();
      const x0 = X0(),
        lw = LW();
      for (let i = 0; i < 6; i++) {
        const y = ((i * (H / 5) + dist * 0.9) % (H + 160)) - 80;
        for (const px of [x0 - 30 * s, x0 + lw + 30 * s]) {
          ell(ctx, px + 6, y + 6, 30 * s, 26 * s, 'rgba(60,40,30,.12)');
          for (let k = 0; k < 6; k++) {
            const a = (k * Math.PI) / 3 + i;
            ell(ctx, px + Math.cos(a) * 18 * s, y + Math.sin(a) * 18 * s, 18 * s, 7 * s, k % 2 ? '#40c057' : '#2f9e44', OUT, 1.2, a);
          }
          ell(ctx, px, y, 6 * s, 6 * s, '#8d5524', OUT, 1.2);
        }
      }
      // труба: бортик и вода — одним многоугольником на экран
      const edge = (side, w) => {
        const pts = [];
        for (let y = -20; y <= H + 20; y += 10) {
          const u = U(dist + (ry - y));
          pts.push([PX(center(u) + side * w), y]);
        }
        return pts;
      };
      const band = (w, fill, stroke) => {
        const L = edge(-1, w),
          R = edge(1, w);
        ctx.beginPath();
        L.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        if (stroke) {
          ctx.strokeStyle = stroke;
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }
      };
      band(HALF + 0.035, tr.rim, OUT);
      band(HALF, tr.water, null);
      band(HALF * 0.55, 'rgba(165,216,255,.6)', null);
      // струйки воды бегут вниз
      ctx.strokeStyle = 'rgba(255,255,255,.75)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let k = -1; k <= 1; k += 2)
        for (let y = -40 + ((dist * 1.4) % 60); y < H + 20; y += 60) {
          const u = U(dist + (ry - y)),
            x = PX(center(u) + k * HALF * 0.5);
          ctx.moveTo(x, y);
          ctx.lineTo(PX(center(U(dist + (ry - y - 18))) + k * HALF * 0.5), y + 18);
        }
      ctx.stroke();
      // полоски на бортике
      ctx.fillStyle = '#ff922b';
      for (let y = -20 + ((dist * 1) % 50); y < H + 20; y += 50) {
        const c = center(U(dist + (ry - y)));
        for (const k of [-1, 1]) ell(ctx, PX(c + k * (HALF + 0.018)), y, 5 * s, 8 * s, '#ff922b');
      }
      // финиш: бассейн внизу экрана
      if (end > 0) {
        ctx.globalAlpha = Math.min(1, end * 2);
        fillRR(ctx, 0, ry - 30, W, H, 0, '#4dabf7');
        ctx.globalAlpha = 1;
      }
      // пузыри и звёздочки
      for (const q of items) {
        if (q.hit) continue;
        const y = ry - (q.d - dist),
          x = PX(center(U(q.d)) + q.off * HALF * 0.8);
        if (q.kind === 'star') drawStar(ctx, x, y, s, t);
        else drawBubble(ctx, x, y, s, t);
      }
      // хомячок на круге: наклоняется в сторону поворота
      const x = PX(ring.x),
        tilt = clamp(ring.vx * 0.9, -0.5, 0.5);
      drawRing(ctx, x, ry, s, tilt);
      ctx.save();
      ctx.translate(x, ry);
      ctx.rotate(tilt);
      host.drawHamster(ctx, 0, 2 * s, 0.62 * s, host.look, { time: t, clipBelow: -18, happy: splash <= 0, armsUp: end > 0 || Math.abs(tilt) > 0.3, blink: t % 3.1 < 0.12 });
      ctx.restore();
      for (const p of drops) {
        ctx.globalAlpha = 1 - p.t / 0.8;
        ell(ctx, p.x, p.y, 5, 6, '#a5d8ff', '#4dabf7', 1);
      }
      ctx.globalAlpha = 1;
      pops.draw(ctx);
    }

    host.loop((dt) => {
      if (!over) update(dt);
      tTime.textContent = `⏱️ ${Math.max(0, Math.ceil(TIME - t))}`;
      tGot.textContent = `🫧 ${got}`;
      tBump.textContent = `💦 ${bumps}`;
      draw();
    });
    function finish() {
      if (over) return;
      over = true;
      const stars = got >= SLIDE_STARS[1] ? 3 : got >= SLIDE_STARS[0] ? 2 : 1;
      host.finish({
        stars,
        text: `${track.icon} «${track.name}» — плюх, и в бассейн! На счету ${got} 🫧 — пузыри и звёздочки${bumps ? `, задела бортик ${bumps} ${plural(bumps, 'раз', 'раза', 'раз')}.` : ', и ни разу не задела бортик!'}${stars === 3 ? ' Королева водной горки!' : ''}`,
        extra: { got, bumps, track: track.id },
      });
    }
  },
};
