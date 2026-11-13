// Под водой: хомячок ныряет в глубоком море и свободно плавает во все стороны.
// Вид сбоку. Положение по горизонтали совпадает с местом на карте, где нырнули.
import { clamp, lerp, rnd, seeded, TAU, dist } from '../core/util.js';
import { ell, fillRR, line, poly, mix, star } from '../core/draw.js';
import { drawHamster, blinkAt } from '../art/hamster.js';
import { G, playerLook, darkness } from '../core/state.js';
import * as A from '../core/actions.js';
import { emit } from '../core/events.js';
import { run } from '../core/registry.js';
import { go } from '../core/loop.js';
import { axisX, axisY } from '../core/input.js';
import { Camera } from '../core/camera.js';
import { sfx } from '../core/audio.js';
import { toast } from '../ui/toast.js';

const OUT = '#4a3728',
  HS = 1.15;
let DW = 72 * 48; // ширина подводного мира — как у карты наверху (её сообщает сцена, из которой нырнули)
const DEPTH = 1500; // глубина
const bedY = (x) => 1385 + Math.sin(x / 260) * 40 + Math.sin(x / 97 + 1) * 22; // дно с барханами
const SHIP_X = 1700,
  OCTO_X = 820;

const D = {
  cam: new Camera(),
  back: null, // позиция на поверхности, где нырнули: туда всплываем, её же кладём в сохранение
  p: { x: 0, y: 150, vx: 0, vy: 0, dir: 1, tx: null, ty: null, swimT: 0, happy: 0 },
  entry: { x: 0, y: 0 },
  built: false,
  hold: false,
  decor: [],
  clams: [],
  fish: [],
  jelly: [],
  turtles: [],
  sharks: [],
  crabs: [],
  bubbles: [],
  sparks: [],
  crumbs: null,
  whaleT: 0,
  octoT: 0,
  chestT: 0,
  bubT: 0,
};

function build() {
  const r = seeded(9001);
  // кораллы, водоросли, камни — вдоль всего дна
  for (let x = 40; x < DW - 20; x += 46 + r() * 70) {
    if (Math.abs(x - SHIP_X) < 240 || Math.abs(x - OCTO_X) < 70) continue;
    const k = r();
    D.decor.push({
      x,
      type: k < 0.3 ? 'weed' : k < 0.55 ? 'coral' : k < 0.7 ? 'fan' : k < 0.82 ? 'rock' : k < 0.92 ? 'anemone' : 'star',
      v: Math.floor(r() * 4),
      s: 0.8 + r() * 0.7,
    });
  }
  for (let i = 0; i < 9; i++) D.clams.push({ x: 180 + i * 370 + r() * 160, open: 0 });
  const cols = ['#ff922b', '#ffd43b', '#f783ac', '#63e6be', '#74c0fc', '#b197fc', '#ff6b6b'];
  for (let g = 0; g < 9; g++) {
    const cx = r() * DW,
      cy = 200 + r() * 950,
      col = cols[g % cols.length],
      n = 4 + Math.floor(r() * 4),
      dir = r() < 0.5 ? 1 : -1;
    for (let i = 0; i < n; i++)
      D.fish.push({
        g,
        x: cx + r() * 120,
        y: cy + r() * 80,
        hy: cy + r() * 80,
        dir,
        sp: 50 + r() * 30,
        col,
        s: 0.8 + r() * 0.6,
        ph: r() * 6,
        v: g % 3,
      });
  }
  for (let i = 0; i < 7; i++)
    D.jelly.push({
      x: 200 + r() * (DW - 400),
      y: 300 + r() * 800,
      ph: r() * 6,
      col: ['#f783ac', '#b197fc', '#74c0fc'][i % 3],
    });
  for (let i = 0; i < 2; i++) D.turtles.push({ x: r() * DW, y: 350 + i * 420, dir: i ? 1 : -1, ph: r() * 6 });
  for (let i = 0; i < 2; i++) D.sharks.push({ x: r() * DW, y: 600 + i * 380, dir: i ? -1 : 1, ph: r() * 6 });
  for (let i = 0; i < 5; i++) D.crabs.push({ x: 300 + r() * (DW - 600), ph: r() * 6 });
  D.built = true;
}

// ---------- вход / выход ----------
export function enter(from, params = {}) {
  if (!D.built) {
    if (params.width) DW = params.width;
    build();
  }
  const wp = params.back || { scene: 'world', x: DW / 2, y: 0 },
    p = D.p;
  D.back = wp;
  D.entry = { x: wp.x, y: wp.y };
  p.x = clamp(wp.x, 60, DW - 60);
  p.y = 130;
  p.vx = 0;
  p.vy = 60;
  p.tx = null;
  p.happy = 0;
  D.bubbles = [];
  D.sparks = [];
  D.crumbs = null;
  D.hold = false;
  for (let i = 0; i < 14; i++)
    D.bubbles.push({ x: p.x + rnd(-40, 40), y: p.y + rnd(-60, 40), r: rnd(3, 9), vy: rnd(60, 130) });
  D.cam.setBounds(0, -140, DW, DEPTH, { smallY: 'start' });
  layout();
  D.cam.snap(p.x, p.y);
  sfx('splash');
  if (!A.award('x_dive') && !D.hint) toast('Нажимай, куда плыть. Чтобы всплыть — плыви вверх или жми ⬆️');
  D.hint = true;
  emit('dive');
}
export function leave() {}
/** Сохранение запоминает место на поверхности, где нырнули. */
export function savePos() {
  return D.back;
}
/** Всплыть: наверху хомячок окажется над тем местом, куда доплыл (а если нырял с кораблика — у кораблика). */
export function surface() {
  sfx('splash');
  go(D.back.scene, { pos: D.back, surface: { x: D.p.x, y: D.entry.y } });
}

function layout() {
  const { w, h } = G.view;
  D.cam.setZoom(clamp(Math.min(w, h) / 540, 0.6, 1));
}
const toWorld = (sx, sy) => D.cam.toWorld(sx, sy);

// ---------- ввод ----------
export function pointerDown(sx, sy) {
  const w = toWorld(sx, sy),
    p = D.p;
  D.hold = true;
  // рыбка под пальцем — покормить
  for (const f of D.fish)
    if (dist(w.x, w.y, f.x, f.y) < 46) {
      feed(f);
      return;
    }
  p.tx = w.x;
  p.ty = w.y;
}
export function pointerMove(sx, sy) {
  if (D.hold) {
    const w = toWorld(sx, sy);
    D.p.tx = w.x;
    D.p.ty = w.y;
  }
}
export function pointerUp() {
  D.hold = false;
}
export function interact() {
  const f = D.fish.reduce((b, q) => (dist(q.x, q.y, D.p.x, D.p.y) < dist(b.x, b.y, D.p.x, D.p.y) ? q : b), D.fish[0]);
  if (f && dist(f.x, f.y, D.p.x, D.p.y) < 400) feed(f);
}

function feed(f) {
  const p = D.p;
  D.crumbs = { x: p.x + p.dir * 60, y: p.y - 10, until: G.time + 7 };
  for (const q of D.fish) if (dist(q.x, q.y, p.x, p.y) < 700) q.feed = G.time + 7;
  p.dir = f.x >= p.x ? 1 : -1;
  p.happy = 1.2;
  p.tx = null;
  sfx('bubble');
  sfx('heart');
  if (!D.fedHint) {
    D.fedHint = true;
    toast('Рыбки плывут на угощение! 🐠');
  }
  A.award('x_feed');
  emit('feed');
}
function addPearls(n, x, y) {
  for (let i = 0; i < 8; i++) D.sparks.push({ x, y, vx: rnd(-80, 80), vy: rnd(-120, -20), t: 0 });
  sfx('coin');
  const total = A.addPearls(n);
  if (total >= 10 && A.award('x_pearl', { delay: 800 })) {
    if (A.addClothes('neck_pearl'))
      setTimeout(() => toast('Из жемчужин получились бусы! Они уже в шкафу 📿', 'good'), 1800);
  }
}

// ---------- обновление ----------
export function update(dt) {
  const p = D.p,
    s = G.state,
    t = G.time;
  layout();
  const kx = axisX(),
    ky = axisY();
  let ax = 0,
    ay = 0;
  if (kx || ky) {
    p.tx = null;
    const l = Math.hypot(kx, ky);
    ax = kx / l;
    ay = ky / l;
  } else if (p.tx !== null) {
    const dx = p.tx - p.x,
      dy = p.ty - p.y,
      l = Math.hypot(dx, dy);
    if (l < 14) p.tx = null;
    else {
      ax = dx / l;
      ay = dy / l;
    }
  }
  const SP = 240;
  p.vx = lerp(p.vx, ax * SP, Math.min(1, dt * 4));
  p.vy = lerp(p.vy, ay * SP + (ax || ay ? 0 : Math.sin(t * 2) * 8), Math.min(1, dt * 4));
  p.x = clamp(p.x + p.vx * dt, 50, DW - 50);
  p.y = clamp(p.y + p.vy * dt, -4, bedY(p.x) - 62);
  if (Math.abs(p.vx) > 20) p.dir = p.vx > 0 ? 1 : -1;
  const moving = Math.hypot(p.vx, p.vy) > 40;
  p.swimT += dt * (moving ? 2.2 : 0.7);
  if (p.happy > 0) p.happy -= dt;
  if (p.y <= 2) {
    surface();
    return;
  }
  // пузырьки
  D.bubT -= dt;
  if (D.bubT <= 0) {
    D.bubT = moving ? 0.35 : 0.9;
    D.bubbles.push({ x: p.x + p.dir * 14, y: p.y - 48, r: rnd(3, 7), vy: rnd(70, 120) });
    if (Math.random() < 0.25) sfx('bubble');
  }
  for (const b of D.bubbles) {
    b.y -= b.vy * dt;
    b.x += Math.sin(t * 4 + b.y * 0.05) * 14 * dt;
  }
  D.bubbles = D.bubbles.filter((b) => b.y > -6 && b.y > D.cam.y - 900);
  for (const q of D.sparks) {
    q.t += dt;
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    q.vy += 90 * dt;
  }
  D.sparks = D.sparks.filter((q) => q.t < 1.1);

  // раковины с жемчугом: открываются, когда подплываешь
  const taken = s.dayFlags.clams || {};
  D.clams.forEach((c, i) => {
    const cy = bedY(c.x) - 14,
      near = dist(p.x, p.y, c.x, cy - 40) < 110;
    c.open = lerp(c.open, near ? 1 : 0, Math.min(1, dt * 5));
    if (near && c.open > 0.8 && !taken[i]) {
      A.setDayFlag(i, 1, 'clams');
      addPearls(1, c.x, cy - 20);
      toast(`Жемчужина! ⚪ Всего: ${s.pearls}`, 'good');
    }
  });
  // сундук на затонувшем корабле
  const cx = SHIP_X + 40,
    cyy = bedY(cx) - 40;
  if (dist(p.x, p.y, cx, cyy - 30) < 110 && !s.dayFlags.shipChest) {
    A.setDayFlag('shipChest');
    D.chestT = t;
    sfx('magic');
    if (!s.flags.shipChest) {
      A.setFlag('shipChest');
      A.award('x_treasure', { quiet: true });
      run({ do: 'surprise', title: 'Сокровище затонувшего корабля!' });
    } else {
      addPearls(2, cx, cyy - 30);
      toast(`В сундуке нашлись 2 жемчужины! ⚪ Всего: ${s.pearls}`, 'good');
    }
  }
  // осьминог машет щупальцем
  if (dist(p.x, p.y, OCTO_X, bedY(OCTO_X) - 110) < 150 && t - D.octoT > 8) {
    D.octoT = t;
    sfx('pop');
    toast('Осьминог машет тебе щупальцем! 🐙');
  }

  // жители моря
  for (const f of D.fish) {
    if (f.feed && D.crumbs && t < f.feed) {
      const dx = D.crumbs.x - f.x + Math.cos(f.ph * 3 + t) * 50,
        dy = D.crumbs.y - f.y + Math.sin(f.ph * 2 + t * 1.3) * 30,
        l = Math.hypot(dx, dy) || 1;
      f.x += (dx / l) * Math.min(l, 150 * dt);
      f.y += (dy / l) * Math.min(l, 150 * dt);
      if (Math.abs(dx) > 6) f.dir = dx > 0 ? 1 : -1;
      continue;
    }
    const scare = dist(f.x, f.y, p.x, p.y) < 90 ? 2.2 : 1;
    f.x += f.dir * f.sp * scare * dt;
    f.y = lerp(f.y, f.hy + Math.sin(t * 1.3 + f.ph) * 16, Math.min(1, dt * 2));
    if (f.x > DW + 80) f.x = -80;
    if (f.x < -80) f.x = DW + 80;
  }
  for (const j of D.jelly) {
    j.y += Math.sin(t * 0.8 + j.ph) * 26 * dt;
    j.x += Math.cos(t * 0.3 + j.ph) * 8 * dt;
  }
  for (const q of D.turtles) {
    q.x += q.dir * 42 * dt;
    if (q.x > DW + 120) q.x = -120;
    if (q.x < -120) q.x = DW + 120;
  }
  for (const q of D.sharks) {
    q.x += q.dir * 74 * dt;
    if (q.x > DW + 200) q.x = -200;
    if (q.x < -200) q.x = DW + 200;
    if (dist(q.x, q.y, p.x, p.y) < 170 && !s.dayFlags.shark) {
      A.setDayFlag('shark');
      toast('Акула улыбнулась тебе и поплыла дальше 🦈');
    }
  }
  D.whaleT += dt;
  if (D.whaleT % 46 > 8 && D.whaleT % 46 < 8 + dt * 1.5) sfx('spout');
  if (D.whaleT % 46 > 6 && D.whaleT % 46 < 30) A.award('x_whale');
  D.cam.follow(p.x, p.y, dt, 5);
}

// =====================================================================
//                              РИСОВАНИЕ
// =====================================================================
function fish(ctx, x, y, s, col, dir, t, v = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir * s, s);
  const tw = Math.sin(t * 9) * 4;
  poly(ctx, [-12, 0, -24, -9 + tw, -24, 9 + tw], col, OUT, 1.6);
  if (v === 1) {
    poly(ctx, [-6, -9, 4, -19, 8, -9], col, OUT, 1.4);
    poly(ctx, [-6, 9, 4, 19, 8, 9], col, OUT, 1.4);
  }
  ell(ctx, 0, 0, v === 2 ? 20 : 16, v === 1 ? 12 : 9, col, OUT, 1.8);
  if (v !== 2) {
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.fillRect(-4, -8, 4, 16);
    if (v === 0) ctx.fillRect(4, -7, 3, 14);
  }
  ell(ctx, 9, -2, 2.6, 2.6, '#fff');
  ell(ctx, 9.6, -2, 1.3, 1.3, '#1d1b1b');
  ctx.restore();
}
function drawShark(ctx, x, y, dir, t) {
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 1.5) * 8);
  ctx.scale(dir, 1);
  const tw = Math.sin(t * 4) * 8;
  poly(ctx, [-70, 0, -112, -34 + tw, -98, 0, -108, 26 + tw], '#748ba0', OUT, 2.5);
  poly(ctx, [-12, -24, 6, -62, 26, -22], '#748ba0', OUT, 2.5);
  poly(ctx, [0, 18, -14, 44, 22, 20], '#748ba0', OUT, 2.5);
  ctx.beginPath();
  ctx.moveTo(-76, 0);
  ctx.quadraticCurveTo(-20, -40, 60, -16);
  ctx.quadraticCurveTo(92, -6, 104, 4);
  ctx.quadraticCurveTo(60, 34, -10, 28);
  ctx.quadraticCurveTo(-56, 20, -76, 0);
  ctx.closePath();
  ctx.fillStyle = '#748ba0';
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-50, 14);
  ctx.quadraticCurveTo(20, 16, 98, 6);
  ctx.quadraticCurveTo(60, 32, -10, 27);
  ctx.quadraticCurveTo(-36, 24, -50, 14);
  ctx.closePath();
  ctx.fillStyle = '#f1f3f5';
  ctx.fill();
  ell(ctx, 66, -6, 4, 4.5, '#1d1b1b');
  ell(ctx, 65, -7, 1.4, 1.4, '#fff');
  ctx.beginPath();
  ctx.arc(72, 6, 18, 0.15 * Math.PI, 0.75 * Math.PI);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2;
  ctx.stroke();
  for (let i = 0; i < 4; i++)
    poly(ctx, [60 + i * 7, 20 - i * 1.5, 63 + i * 7, 26 - i * 2, 66 + i * 7, 19 - i * 1.6], '#fff', OUT, 1);
  for (let i = 0; i < 3; i++) line(ctx, 30 + i * 7, -2, 28 + i * 7, 10, 'rgba(0,0,0,.25)', 2);
  ctx.restore();
}
function drawTurtle(ctx, x, y, dir, t) {
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 1.2) * 10);
  ctx.scale(dir, 1);
  const fl = Math.sin(t * 3) * 0.5;
  for (const [fx, fy, a] of [
    [18, 10, 0.6 + fl],
    [-22, 12, 2.2 - fl],
  ]) {
    ctx.save();
    ctx.translate(fx, fy);
    ctx.rotate(a);
    ell(ctx, 16, 0, 20, 7, '#69db7c', OUT, 2);
    ctx.restore();
  }
  ell(ctx, 42, -4, 15, 11, '#8ce99a', OUT, 2);
  ell(ctx, 48, -7, 2.2, 2.6, '#1d1b1b');
  ctx.beginPath();
  ctx.ellipse(0, 4, 40, 28, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fillStyle = '#2f9e44';
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  for (const [hx, hy] of [
    [-16, -6],
    [6, -12],
    [22, -2],
    [-4, -18],
  ])
    ell(ctx, hx, hy, 8, 6, '#51cf66', OUT, 1.2);
  fillRR(ctx, -38, 2, 76, 8, 4, '#d8f5a2', OUT, 2);
  ctx.restore();
}
function drawJelly(ctx, x, y, col, t, ph) {
  const k = 1 + Math.sin(t * 3 + ph) * 0.12;
  ctx.globalAlpha = 0.8;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(x + i * 8, y + 4);
    for (let s = 1; s <= 6; s++) ctx.lineTo(x + i * 8 + Math.sin(t * 3 + s * 0.9 + i + ph) * 5, y + 4 + s * 9);
    ctx.strokeStyle = col;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(x, y + 4, 26 * k, 24 / k, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fillStyle = col;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.8)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ell(ctx, x - 8, y - 6, 3, 3.5, '#1d1b1b');
  ell(ctx, x + 8, y - 6, 3, 3.5, '#1d1b1b');
  ctx.globalAlpha = 1;
}
function drawWhale(ctx, x, y, t) {
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 0.7) * 16);
  ctx.globalAlpha = 0.62;
  const tw = Math.sin(t * 1.6) * 16;
  poly(ctx, [-250, -10, -330, -70 + tw, -306, -8, -334, 40 + tw], '#34558f', OUT, 3);
  ctx.beginPath();
  ctx.moveTo(-262, -6);
  ctx.quadraticCurveTo(-120, -120, 150, -80);
  ctx.quadraticCurveTo(262, -56, 270, 6);
  ctx.quadraticCurveTo(200, 86, 0, 70);
  ctx.quadraticCurveTo(-160, 60, -262, -6);
  ctx.closePath();
  ctx.fillStyle = '#34558f';
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-120, 44);
  ctx.quadraticCurveTo(80, 60, 262, 18);
  ctx.quadraticCurveTo(200, 84, 0, 69);
  ctx.quadraticCurveTo(-70, 64, -120, 44);
  ctx.closePath();
  ctx.fillStyle = '#c5d8f5';
  ctx.fill();
  for (let i = 0; i < 6; i++) line(ctx, 40 + i * 30, 52 - i * 4, 60 + i * 30, 62 - i * 6, 'rgba(52,85,143,.6)', 2.5);
  ell(ctx, 196, -12, 7, 8, '#1d1b1b');
  ell(ctx, 194, -14, 2.4, 2.4, '#fff');
  ctx.beginPath();
  ctx.arc(214, 6, 30, 0.2 * Math.PI, 0.7 * Math.PI);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.save();
  ctx.translate(60, 54);
  ctx.rotate(0.5 + Math.sin(t * 1.4) * 0.2);
  ell(ctx, -30, 16, 46, 14, '#2b477a', OUT, 2.5);
  ctx.restore();
  ctx.restore();
}
function drawDecor(ctx, o, t) {
  const x = o.x,
    y = bedY(o.x) + 4,
    s = o.s;
  if (o.type === 'weed') {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * 12, y);
      for (let k = 1; k <= 7; k++)
        ctx.lineTo(x + i * 12 + Math.sin(t * 1.6 + k * 0.7 + i + x) * (4 + k * 1.6), y - k * (18 + i * 5) * s);
      ctx.strokeStyle = ['#2f9e44', '#37b24d', '#74b816'][(o.v + i) % 3];
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  } else if (o.type === 'coral') {
    const col = ['#ff6b9d', '#ff922b', '#b197fc', '#ff8787'][o.v];
    const br = (bx, by, len, a, d) => {
      const ex = bx + Math.cos(a) * len,
        ey = by + Math.sin(a) * len;
      line(ctx, bx, by, ex, ey, OUT, 9 * s - d * 1.5 + 3);
      line(ctx, bx, by, ex, ey, col, 9 * s - d * 1.5);
      if (d < 3) {
        br(ex, ey, len * 0.72, a - 0.5, d + 1);
        br(ex, ey, len * 0.72, a + 0.45, d + 1);
      } else ell(ctx, ex, ey, 5 * s, 5 * s, col, OUT, 1.5);
    };
    br(x, y, 34 * s, -Math.PI / 2, 0);
  } else if (o.type === 'fan') {
    const col = ['#f783ac', '#ffd43b', '#ff922b', '#da77f2'][o.v];
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, 62 * s, Math.PI * 1.15, Math.PI * 1.85);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2;
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI * (1.2 + i * 0.12);
      line(ctx, x, y, x + Math.cos(a) * 58 * s, y + Math.sin(a) * 58 * s, 'rgba(0,0,0,.2)', 2);
    }
  } else if (o.type === 'rock') {
    ell(ctx, x, y - 14 * s, 44 * s, 26 * s, '#868e96', OUT, 2.5);
    ell(ctx, x - 30 * s, y - 6 * s, 22 * s, 14 * s, '#adb5bd', OUT, 2);
    ell(ctx, x - 8 * s, y - 24 * s, 12 * s, 5 * s, 'rgba(255,255,255,.3)');
  } else if (o.type === 'anemone') {
    const col = ['#ff8787', '#ffa8d9', '#ffd43b', '#b197fc'][o.v];
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * (1.08 + i * 0.105) + Math.sin(t * 2 + i) * 0.08;
      line(ctx, x, y - 6, x + Math.cos(a) * 36 * s, y - 6 + Math.sin(a) * 36 * s, OUT, 9);
      line(ctx, x, y - 6, x + Math.cos(a) * 36 * s, y - 6 + Math.sin(a) * 36 * s, col, 6);
    }
    ell(ctx, x, y - 4, 18 * s, 12 * s, col, OUT, 2);
  } else {
    ctx.save();
    ctx.translate(x, y - 8);
    ctx.rotate(o.x);
    star(ctx, 0, 0, 16 * s, ['#ff922b', '#f783ac', '#ffd43b', '#ff6b6b'][o.v], OUT, 2);
    ctx.restore();
  }
}
function drawShip(ctx, t) {
  const x = SHIP_X,
    y = bedY(x) + 8;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.13);
  line(ctx, -40, -100, -52, -330, OUT, 14);
  line(ctx, -40, -100, -52, -330, '#8d5524', 10);
  poly(ctx, [-48, -320, 60, -250, 40, -170, -44, -190], '#f1e0c5', OUT, 2.5);
  poly(ctx, [10, -240, 34, -226, 22, -196], '#3b6fb0');
  line(ctx, -120, -250, -52, -300, '#8d5524', 4);
  ctx.beginPath();
  ctx.moveTo(-250, -110);
  ctx.lineTo(240, -120);
  ctx.quadraticCurveTo(210, 10, 110, 14);
  ctx.lineTo(-150, 14);
  ctx.quadraticCurveTo(-230, -10, -250, -110);
  ctx.closePath();
  ctx.fillStyle = '#8d5524';
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 3;
  ctx.stroke();
  for (let i = 0; i < 4; i++) line(ctx, -236 + i * 8, -84 + i * 24, 226 - i * 22, -92 + i * 24, 'rgba(0,0,0,.22)', 3);
  for (const hx of [-150, -60, 130]) {
    ell(ctx, hx, -56, 18, 18, '#3b2a1e', OUT, 2.5);
    ell(ctx, hx, -56, 12, 12, '#16325c');
  }
  poly(ctx, [10, -118, 60, -119, 74, -40, 40, -16, 6, -44], '#16325c', OUT, 2.5); // пробоина
  fillRR(ctx, -256, -124, 500, 14, 5, '#a8703f', OUT, 2.5);
  ctx.restore();
  // сундук
  const cx = SHIP_X + 40,
    cy = bedY(cx) - 6,
    opened = G.state.dayFlags.shipChest;
  if (!opened) {
    ctx.globalAlpha = 0.35 + Math.sin(t * 3) * 0.15;
    ell(ctx, cx, cy - 26, 60, 46, '#ffe066');
    ctx.globalAlpha = 1;
  }
  fillRR(ctx, cx - 32, cy - 40, 64, 40, 6, '#a8703f', OUT, 2.5);
  ctx.save();
  ctx.translate(cx - 32, cy - 40);
  ctx.rotate(opened ? -0.9 : 0);
  fillRR(ctx, 0, -20, 66, 22, 9, '#c98b5a', OUT, 2.5);
  ctx.restore();
  ctx.fillStyle = '#ffd43b';
  ctx.fillRect(cx - 32, cy - 24, 64, 5);
  fillRR(ctx, cx - 7, cy - 34, 14, 16, 3, '#ffd43b', OUT, 2);
  if (opened)
    for (let i = 0; i < 4; i++)
      ell(ctx, cx - 18 + i * 12, cy - 42 - (i % 2) * 4, 6, 6, i % 2 ? '#fff' : '#ffd43b', OUT, 1.5);
}
function drawOcto(ctx, t) {
  const x = OCTO_X,
    y = bedY(x) + 4,
    wave = t - D.octoT < 2.5;
  ell(ctx, x, y - 34, 56, 44, '#c98b5a', OUT, 3);
  ell(ctx, x, y - 76, 30, 10, '#3b2a1e', OUT, 3);
  fillRR(ctx, x - 34, y - 86, 68, 12, 5, '#d9a066', OUT, 2.5); // амфора
  const hy = y - 96 - (wave ? 26 : 8 + Math.sin(t * 1.5) * 6);
  for (let i = -2; i <= 2; i++) {
    if (!i) continue;
    ctx.beginPath();
    ctx.moveTo(x + i * 10, y - 80);
    for (let s = 1; s <= 5; s++)
      ctx.lineTo(
        x + i * (10 + s * 9) + Math.sin(t * (wave ? 9 : 2.5) + s + i) * 6,
        y - 80 - Math.sin(s * 0.7) * (wave && i === 2 ? 70 : 22) + s * 4,
      );
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.strokeStyle = '#b197fc';
    ctx.lineWidth = 8;
    ctx.stroke();
  }
  ell(ctx, x, hy, 30, 26, '#b197fc', OUT, 2.5);
  ell(ctx, x - 10, hy - 2, 6, 7, '#fff', OUT, 1.5);
  ell(ctx, x + 10, hy - 2, 6, 7, '#fff', OUT, 1.5);
  ell(ctx, x - 9, hy - 1, 2.6, 3, '#1d1b1b');
  ell(ctx, x + 11, hy - 1, 2.6, 3, '#1d1b1b');
  ctx.beginPath();
  ctx.arc(x, hy + 9, 6, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2;
  ctx.stroke();
}

export function draw(ctx) {
  const { w, h } = G.view,
    t = G.time,
    z = D.cam.zoom,
    p = D.p,
    dk = darkness();
  const vh = h / z,
    topD = clamp((D.cam.y - vh / 2) / DEPTH, 0, 1),
    botD = clamp((D.cam.y + vh / 2) / DEPTH, 0, 1);
  const shallow = mix('#63d2f7', '#16325c', dk * 0.6),
    deep = mix('#0d3f86', '#061633', dk * 0.6);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, mix(shallow, deep, topD));
  g.addColorStop(1, mix(shallow, deep, botD));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  D.cam.apply(ctx);
  ctx.lineJoin = 'round';
  const x0 = D.cam.x - w / 2 / z - 200,
    x1 = D.cam.x + w / 2 / z + 200,
    y0 = D.cam.y - vh / 2 - 200,
    y1 = D.cam.y + vh / 2 + 200;
  const vis = (x, y) => x > x0 && x < x1 && y > y0 && y < y1;
  // небо над водой и поверхность
  if (y0 < 0) {
    ctx.fillStyle = mix('#bfe9ff', '#1b1b4a', dk * 0.9);
    ctx.fillRect(x0, -900, x1 - x0, 900);
    ctx.beginPath();
    ctx.moveTo(x0, 0);
    for (let x = x0; x <= x1; x += 24) ctx.lineTo(x, Math.sin(x * 0.03 + t * 2) * 5);
    ctx.lineTo(x1, 40);
    ctx.lineTo(x0, 40);
    ctx.closePath();
    ctx.fillStyle = mix('#8fe3fb', '#16325c', dk * 0.6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.85)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let x = x0; x <= x1; x += 24) ctx.lineTo(x, Math.sin(x * 0.03 + t * 2) * 5);
    ctx.stroke();
  }
  // лучи света
  for (let i = Math.floor(x0 / 260); i < x1 / 260; i++) {
    const rx = i * 260 + Math.sin(t * 0.4 + i) * 40;
    ctx.globalAlpha = 0.07 * (1 - dk);
    poly(ctx, [rx, 0, rx + 90, 0, rx - 120, 900, rx - 320, 900], '#fff');
  }
  ctx.globalAlpha = 1;
  // кит вдалеке
  const wk = D.whaleT % 46;
  if (wk < 34) {
    const wx = D.cam.x + (wk / 34 - 0.5) * (w / z + 900),
      wy = clamp(D.cam.y - 60, 320, 900);
    drawWhale(ctx, wx, wy, t);
  }
  // дальние скалы
  ctx.fillStyle = 'rgba(8,40,90,.45)';
  ctx.beginPath();
  ctx.moveTo(x0, DEPTH + 60);
  for (let x = Math.floor(x0 / 80) * 80; x <= x1 + 80; x += 80)
    ctx.lineTo(x, 1300 - Math.abs(Math.sin(x * 0.004)) * 220 - Math.sin(x * 0.021) * 40);
  ctx.lineTo(x1 + 80, DEPTH + 60);
  ctx.closePath();
  ctx.fill();
  // дно
  ctx.beginPath();
  ctx.moveTo(x0, DEPTH + 200);
  for (let x = x0; x <= x1 + 30; x += 30) ctx.lineTo(x, bedY(x));
  ctx.lineTo(x1 + 30, DEPTH + 200);
  ctx.closePath();
  ctx.fillStyle = mix('#f2dfa6', '#3b4a6b', 0.25 + dk * 0.3);
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 3;
  ctx.stroke();
  for (let x = Math.floor(x0 / 70) * 70; x < x1; x += 70)
    ell(ctx, x + 20, bedY(x + 20) + 26 + ((x * 7) % 30), 14, 4, 'rgba(0,0,0,.08)');
  if (vis(SHIP_X, 1250) || Math.abs(SHIP_X - D.cam.x) < w / z) drawShip(ctx, t);
  if (Math.abs(OCTO_X - D.cam.x) < w / z) drawOcto(ctx, t);
  for (const o of D.decor) if (o.x > x0 && o.x < x1 && y1 > 1200) drawDecor(ctx, o, t);
  // раковины
  D.clams.forEach((c, i) => {
    if (c.x < x0 || c.x > x1) return;
    const y = bedY(c.x) - 2,
      got = G.state.dayFlags.clams && G.state.dayFlags.clams[i];
    ctx.beginPath();
    ctx.ellipse(c.x, y - 6, 30, 16, 0, 0, Math.PI);
    ctx.closePath();
    ctx.fillStyle = '#ffc9de';
    ctx.fill();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    if (c.open > 0.1 && !got) {
      ell(ctx, c.x, y - 12, 9, 9, '#fff', OUT, 2);
      ell(ctx, c.x - 3, y - 15, 3, 3, 'rgba(180,220,255,.9)');
    }
    ctx.save();
    ctx.translate(c.x - 30, y - 6);
    ctx.rotate(-c.open * 0.9);
    ctx.beginPath();
    ctx.ellipse(30, 0, 30, 18, 0, Math.PI, 0);
    ctx.closePath();
    ctx.fillStyle = '#faa2c1';
    ctx.fill();
    ctx.stroke();
    for (let k = 1; k < 5; k++)
      line(
        ctx,
        30,
        0,
        30 + Math.cos(Math.PI + k * 0.63) * 26,
        Math.sin(Math.PI + k * 0.63) * 15,
        'rgba(0,0,0,.18)',
        1.5,
      );
    ctx.restore();
    if (!got && c.open < 0.3) star(ctx, c.x + 22, y - 34 + Math.sin(t * 4 + i) * 4, 6, '#fff3bf');
  });
  for (const c of D.crabs) {
    const cx = c.x + Math.sin(t * 0.9 + c.ph) * 60,
      cy = bedY(cx) - 8;
    if (cx < x0 || cx > x1) continue;
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 3; i++)
        line(
          ctx,
          cx + sx * 8,
          cy + 2,
          cx + sx * (17 + i * 3),
          cy + 7 + (i - 1) * 5 + Math.sin(t * 12 + i) * 2,
          '#c92a2a',
          2.5,
        );
      ell(ctx, cx + sx * 16, cy - 10, 6, 4.5, '#fa5252', OUT, 1.5);
    }
    ell(ctx, cx, cy, 14, 9, '#fa5252', OUT, 2);
    ell(ctx, cx - 5, cy - 8, 2.5, 3, '#fff', OUT, 1);
    ell(ctx, cx + 5, cy - 8, 2.5, 3, '#fff', OUT, 1);
  }
  // жители
  for (const q of D.turtles) if (vis(q.x, q.y)) drawTurtle(ctx, q.x, q.y, q.dir, t + q.ph);
  for (const q of D.sharks) if (vis(q.x, q.y)) drawShark(ctx, q.x, q.y, q.dir, t + q.ph);
  for (const j of D.jelly) if (vis(j.x, j.y)) drawJelly(ctx, j.x, j.y, j.col, t, j.ph);
  for (const f of D.fish) if (vis(f.x, f.y)) fish(ctx, f.x, f.y, f.s, f.col, f.dir, t + f.ph, f.v);
  if (D.crumbs && t < D.crumbs.until) {
    ctx.globalAlpha = Math.min(1, (D.crumbs.until - t) / 2);
    for (let i = 0; i < 9; i++)
      ell(
        ctx,
        D.crumbs.x + Math.cos(i * 2.4 + t * 0.4) * (10 + (i % 3) * 12),
        D.crumbs.y + Math.sin(i * 1.7) * 14 + ((t * 8 + i * 5) % 20),
        3,
        2.5,
        '#c98b5a',
      );
    ctx.globalAlpha = 1;
  }
  // хомячок в маске
  const sp = Math.hypot(p.vx, p.vy),
    tilt = clamp(p.vy / 240, -1, 1) * 0.35 * p.dir + (sp > 40 ? 0.18 * p.dir : 0);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(tilt);
  drawHamster(ctx, 0, 34, HS, playerLook(), {
    time: t,
    dir: p.dir,
    walk: p.swimT,
    shadow: false,
    happy: p.happy > 0,
    armsUp: p.happy > 0 || (sp > 40 && Math.sin(p.swimT * TAU) > 0.3),
    blink: blinkAt(t),
  });
  ctx.scale(HS * p.dir, HS);
  line(ctx, -27, -26, -27, -62, OUT, 7);
  line(ctx, -27, -26, -27, -62, '#ffd43b', 4);
  fillRR(ctx, -32, -70, 10, 12, 3, '#ff922b', OUT, 1.5); // трубка
  line(ctx, -27, -26, -24, -19, '#343a40', 3);
  fillRR(ctx, -23, -40, 46, 22, 10, 'rgba(170,235,255,.42)', '#ff5c8a', 3.5);
  line(ctx, -12, -36, -4, -36, 'rgba(255,255,255,.9)', 2.5);
  ctx.restore();
  for (const b of D.bubbles) ell(ctx, b.x, b.y, b.r, b.r, 'rgba(255,255,255,.25)', 'rgba(255,255,255,.85)', 1.6);
  for (const q of D.sparks) {
    ctx.globalAlpha = 1 - q.t / 1.1;
    star(ctx, q.x, q.y, 7, '#fff3bf');
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  // чем глубже — тем темнее по краям
  const depth = clamp(p.y / DEPTH, 0, 1);
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.75);
  vg.addColorStop(0, 'rgba(4,16,50,0)');
  vg.addColorStop(1, `rgba(4,16,50,${0.15 + depth * 0.45 + dk * 0.2})`);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
  // табличка: глубина и жемчуг
  const label = `🤿 ${Math.round(p.y / 22)} м   ⚪ ${G.state.pearls || 0}`;
  ctx.font = '900 16px ui-rounded, "Trebuchet MS", sans-serif';
  const tw = ctx.measureText(label).width + 28;
  fillRR(ctx, w / 2 - tw / 2, h - 46, tw, 32, 16, 'rgba(255,250,240,.92)');
  ctx.fillStyle = OUT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, w / 2, h - 29);
}

/** HUD под водой: вместо «Домой» — «Всплыть», карты нет. */
function hud() {
  return { main: { icon: '⬆️', label: 'Всплыть', fn: surface }, noMap: true };
}
function sound() {
  return { force: 'underwater', day: 'villa', sea: 0, rain: 0.3 };
}
export default { enter, leave, update, draw, pointerDown, pointerMove, pointerUp, interact, savePos, hud, sound };
