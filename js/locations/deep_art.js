// НИЖНИЙ ЯРУС ПЕЩЕР (П4, этап 17в): рисунки клеток и предметов подземной реки. Где что стоит — locations/deep.js.
// Стиль — как у пещер (caves_art.js): контур OUT, 2–3 тона, свет слева сверху; камень, пол, кристаллы, грибы — общие
// с пещерами (caves_art.js). Шевелится (течение реки, лодочка) — линиями поверх, каждый кадр.
//
// Клетки:  deepRiver — подземная река: тёмно-бирюзовая вода, течёт слева направо (крюк live — струйки по течению).
// Предметы: ropeHole — люк с верёвочной лестницей вниз в полу шахты Камушкина (open() — открыт ли нижний ярус: нет —
//          лестница свёрнута и привязана, табличка с замочком), ropeLadder — та же лестница снизу: свисает из дыры
//          в своде, сверху падает свет; deepPier — дощатые мостки над водой (v: 0 — западные, 1 — восточные).
// drawRowboat — лодочка с фонарём на носу (герой в ней — ride.draw; пустая у причала — крюк things).
import { TAU } from '../core/util.js';
import { ell, fillRR, line } from '../core/draw.js';
import { drawHamster, blinkAt } from '../art/hamster.js';
import { T, OUT, put, hash, defineTiles, defineObjects } from '../engine/topdown/index.js';
import { shadow, WOOD, WOOD_D, WOOD_L } from './common/paint.js';
import './caves_art.js';

const WATER = '#164a5c';

// ---------- клетки ----------
/** Река: тёмная вода, у берегов светлее, редкие пузырьки и отражённые искорки кристаллов. */
function riverDeco(ctx, x, y, tx, ty, env, r) {
  const m = env.map;
  if (r(1) < 0.5) ell(ctx, x + r(2) * T, y + r(3) * T, 16 + r(4) * 10, 3, 'rgba(160,240,255,.07)');
  if (r(5) < 0.12) {
    ctx.fillStyle = 'rgba(190,240,255,.5)';
    ctx.fillRect(x + r(6) * T, y + r(7) * T, 2, 2);
  }
  if (m && m.at(tx, ty - 1) !== 'deepRiver') {
    // у северного берега — отражения сталактитов
    ctx.fillStyle = 'rgba(5,20,30,.45)';
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const cx = x + 6 + i * 15 + r(8 + i) * 6,
        l = 8 + r(11 + i) * 16;
      ctx.moveTo(cx - 5, y + 2);
      ctx.lineTo(cx, y + 2 + l);
      ctx.lineTo(cx + 5, y + 2);
    }
    ctx.fill();
  }
}
/** Течение: светлые струйки плывут слева направо (один путь на весь экран). */
function riverLive(ctx, cells, n, env) {
  const t = env.t;
  ctx.strokeStyle = 'rgba(150,235,250,.35)';
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < n; i += 2) {
    const x = cells[i] * T,
      y = cells[i + 1] * T,
      h = hash(cells[i], cells[i + 1]);
    for (let k = 0; k < 2; k++) {
      const ph = (t * 0.45 + h * 3 + k * 0.5) % 1,
        bx = x + ph * T - 6,
        by = y + 12 + k * 20 + h * 6 + Math.sin(t * 1.7 + h * 9 + k) * 1.5,
        w = 6 + Math.sin(ph * Math.PI) * 10;
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + w / 2, by - 2, bx + w, by);
    }
  }
  ctx.stroke();
}
defineTiles({
  deepRiver: {
    map: '#2c7a8c',
    walk: false,
    wet: true,
    z: 0.6,
    fill: WATER,
    edge: { wob: 9, in: [['rgba(110,220,240,.28)', 6]] },
    deco: riverDeco,
    live: riverLive,
  },
});

// ---------- предметы ----------
/** Люк в полу шахты: деревянная рамка, в темноте — перекладины лестницы. open — лестница спущена. */
function paintHole(ctx, open, snow) {
  ell(ctx, 0, 4, 30, 18, 'rgba(10,6,16,.35)');
  ell(ctx, 0, 2, 26, 15, '#0d0a14', OUT, 2);
  // рамка из брёвнышек
  for (const [x0, y0, x1, y1] of [
    [-28, -10, 28, -10],
    [-28, 14, 28, 14],
  ]) {
    line(ctx, x0, y0, x1, y1, OUT, 7);
    line(ctx, x0, y0, x1, y1, WOOD, 4.4);
  }
  for (const sx of [-1, 1]) {
    line(ctx, sx * 24, -16, sx * 24, 8, OUT, 4);
    line(ctx, sx * 24, -16, sx * 24, 8, WOOD_D, 2);
  }
  if (open) {
    // верёвки и перекладины уходят вниз, в темноту
    for (const sx of [-1, 1]) line(ctx, sx * 9, -12, sx * 7, 12, '#d9b77a', 2);
    for (let i = 0; i < 4; i++) {
      const y = -6 + i * 6;
      ctx.globalAlpha = 1 - i * 0.22;
      line(ctx, -8 + i * 0.4, y, 8 - i * 0.4, y, '#c99a5b', 2.6);
    }
    ctx.globalAlpha = 1;
  } else {
    // лестница свёрнута и привязана, табличка
    ell(ctx, 18, -18, 9, 6, '#d9b77a', OUT, 1.6);
    ell(ctx, 18, -18, 4, 3, '#b08a52', null);
    fillRR(ctx, -22, -32, 24, 14, 3, '#fff3bf', OUT, 1.4);
    line(ctx, -10, -18, -10, -10, OUT, 1.6);
  }
}
/** Лестница снизу: свисает из дыры в своде; луч света сверху. */
function paintLadder(ctx) {
  shadow(ctx, 0, 14, 22, 5);
  // луч
  const g = ctx.createLinearGradient(0, -150, 0, 16);
  g.addColorStop(0, 'rgba(255,240,200,.32)');
  g.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-16, -150);
  ctx.lineTo(16, -150);
  ctx.lineTo(34, 16);
  ctx.lineTo(-34, 16);
  ctx.closePath();
  ctx.fill();
  for (const sx of [-1, 1]) {
    line(ctx, sx * 11, -150, sx * 12, 10, OUT, 3.6);
    line(ctx, sx * 11, -150, sx * 12, 10, '#d9b77a', 2);
  }
  for (let y = -140; y <= 4; y += 16) {
    line(ctx, -12, y, 12, y + 1, OUT, 5);
    line(ctx, -12, y, 12, y + 1, '#c99a5b', 3);
  }
  // моток верёвки внизу
  ell(ctx, 10, 12, 10, 4, '#d9b77a', OUT, 1.4);
}
/** Мостки над водой: доски и сваи. */
function paintPier(ctx, v) {
  for (const sx of [-1, 1]) {
    line(ctx, sx * 20, 6, sx * 20, 26, OUT, 6);
    line(ctx, sx * 20, 6, sx * 20, 26, WOOD_D, 3.4);
  }
  ell(ctx, 0, 28, 30, 5, 'rgba(160,235,250,.25)');
  fillRR(ctx, -26, -20, 52, 30, 3, WOOD, OUT, 2);
  ctx.strokeStyle = WOOD_D;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (const yy of [-10, 0]) {
    ctx.moveTo(-25, yy);
    ctx.lineTo(25, yy);
  }
  ctx.stroke();
  line(ctx, -24, -18, 24, -18, WOOD_L, 1.6);
  // столбик с кольцом для верёвки лодочки
  fillRR(ctx, v ? -24 : 16, -30, 8, 16, 2, WOOD_D, OUT, 1.6);
  ell(ctx, v ? -20 : 20, -26, 4, 3, null, '#adb5bd', 1.6);
}
defineObjects({
  ropeHole: {
    solid: true,
    art: { ropeHole: [[-34, -36, 34, 26], paintHole] },
    draw: (ctx, o) => put('ropeHole', o.x, o.y, o.open && o.open() ? 1 : 0),
  },
  ropeLadder: {
    solid: true,
    light: [0, -40, 120],
    art: { ropeLadder: [[-38, -156, 38, 22], paintLadder] },
    draw: (ctx, o) => put('ropeLadder', o.x, o.y),
  },
  deepPier: {
    flat: true,
    art: { deepPier: [[-32, -36, 32, 36], paintPier] },
    draw: (ctx, o) => put('deepPier', o.x, o.y, o.v || 0),
  },
});

// ---------- лодочка ----------
/**
 * Лодочка с фонарём на носу. (x, y) — середина лодки на воде, dir — куда нос (1 — вправо), look — кто сидит (null —
 * пустая), moving — плывёт (вода расходится за кормой).
 */
export function drawRowboat(ctx, x, y, dir, t, look, moving) {
  const bob = Math.sin(t * 2.4 + x * 0.013) * 2;
  ell(ctx, x, y + 12, 50, 9, 'rgba(160,235,250,.25)');
  if (moving) {
    ctx.strokeStyle = 'rgba(190,245,255,.6)';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const k = (t * 1.3 + i / 3) % 1;
      ctx.globalAlpha = 1 - k;
      ctx.beginPath();
      ctx.ellipse(x - dir * (40 + k * 40), y + 12, 8 + k * 14, 3 + k * 4, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.scale(dir, 1);
  // шест с фонарём на носу — позади хомячка
  line(ctx, 30, -8, 36, -58, OUT, 4);
  line(ctx, 30, -8, 36, -58, WOOD_D, 2);
  line(ctx, 36, -58, 46, -56, OUT, 2);
  fillRR(ctx, 40, -56, 12, 14, 3, '#ffe066', OUT, 1.6);
  ell(ctx, 46, -49, 3.5, 4, '#fff9db', null);
  ctx.restore();
  if (look)
    drawHamster(ctx, x - dir * 4, y + 6 + bob, 0.82, look, { dir, time: t, clipBelow: -22, shadow: false, blink: blinkAt(t), happy: true });
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.scale(dir, 1);
  // борт — перед хомячком
  ctx.beginPath();
  ctx.moveTo(-44, -10);
  ctx.lineTo(46, -10);
  ctx.quadraticCurveTo(40, 12, 22, 16);
  ctx.lineTo(-28, 16);
  ctx.quadraticCurveTo(-42, 12, -44, -10);
  ctx.closePath();
  ctx.fillStyle = '#2b8a3e';
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.4;
  ctx.stroke();
  fillRR(ctx, -46, -14, 94, 8, 4, WOOD_L, OUT, 1.8);
  line(ctx, -30, 4, 30, 4, 'rgba(255,255,255,.18)', 2);
  // вёсла
  for (const s of [-1, 1]) {
    line(ctx, -4, -8, -16 + s * 4, 22, OUT, 3.6);
    line(ctx, -4, -8, -16 + s * 4, 22, WOOD, 2);
  }
  ctx.restore();
}
/** Свет фонаря лодочки — точка мира для крюка gloom. */
export const boatLampAt = (x, y, dir) => ({ x: x + dir * 46, y: y - 49 });
