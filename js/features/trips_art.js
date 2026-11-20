// КАРТИНКИ ПОЕЗДОК — рисунок в окне «едем…», пока поездка идёт (features/places.js: rideScene). Каждая получает
// долю пути k (0…1), направление (туда / обратно), вид хомячка и время t. Здесь только рисование; когда и куда
// едем — в занятиях: караван в пустыню (desert.js), лодка через грот в бухту (cove.js), кораблик к дальнему острову
// (island.js), плавание к джунглям и обратно (jungle.js), канатная дорога на гору (mountain.js). Лежит в features/,
// а не в art/: берёт рисунки зверей, лодок и пальм из locations/*_art.js.
import { ell, poly, fillRR, line } from '../core/draw.js';
import { drawHamster } from '../art/hamster.js';
import { SHELL_COLORS, paintDolphin } from '../locations/cove_art.js';
import { paintBus, paintCamel } from '../locations/desert_art.js';
import { paintCoconut } from '../locations/island_art.js';
import { drawBoat } from '../locations/sea.js';
import { paintParrot } from '../locations/jungle_art.js';

const OUT = '#4a3728';

// ════════ из cove.js ════════
// ---------- заплыв через подводный грот ----------
/**
 * Картинка переезда: подводный грот — тёмные своды, лучи света, хомячок плывёт (k — 0..1 пути). dolphin — простуженную
 * хомячку везёт дельфин Жемчужинки (В20): она сидит у него на спинке и держится за плавник.
 */
export function paintGrotto(ctx, w, h, k, toCove, look, t, dolphin = false) {
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, toCove ? '#1c6fc4' : '#3fd0d4');
  g.addColorStop(0.5, '#124a66');
  g.addColorStop(1, toCove ? '#3fd0d4' : '#1c6fc4');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // лучи света из выхода
  const ex = toCove ? w : 0;
  ctx.fillStyle = 'rgba(200,255,250,.12)';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(ex, h * (0.3 + i * 0.12));
    ctx.lineTo(w / 2 + (toCove ? -1 : 1) * (40 + i * 30), h * (0.15 + i * 0.22));
    ctx.lineTo(w / 2 + (toCove ? -1 : 1) * (10 + i * 30), h * (0.2 + i * 0.22));
    ctx.closePath();
    ctx.fill();
  }
  // своды грота: сверху сталактиты, снизу камни, ракушки и водоросли
  ctx.fillStyle = '#2d2733';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  for (let x = 0; x <= w; x += w / 10) ctx.lineTo(x, h * (0.12 + (((x / w) * 7) % 1) * 0.08) + Math.sin(x * 0.05) * 6);
  ctx.lineTo(w, 0);
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < 9; i++) {
    const x = (i + 0.5) * (w / 9);
    poly(ctx, [x - 8, h * 0.14, x, h * (0.24 + (i % 3) * 0.04), x + 8, h * 0.14], '#3d3545');
  }
  ctx.fillStyle = '#3a3240';
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += w / 9) ctx.lineTo(x, h * (0.84 + (((x / w) * 5) % 1) * 0.06) + Math.cos(x * 0.04) * 6);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < 7; i++) {
    const x = (i + 0.3) * (w / 7);
    ctx.save();
    ctx.translate(x, h * 0.9);
    ctx.rotate(Math.sin(t * 2 + i) * 0.15);
    ell(ctx, 0, -14, 4, 15, '#2f9e44', OUT, 1);
    ctx.restore();
    if (i % 2) {
      const [c] = SHELL_COLORS[i % 3];
      ell(ctx, x + 18, h * 0.88, 6, 4, c, OUT, 1);
    }
  }
  // светлячки воды (огоньки) и рыбки
  for (let i = 0; i < 14; i++) {
    const x = ((i * 0.37 + t * 0.05) % 1) * w,
      y = h * (0.3 + ((i * 0.61) % 0.5));
    ell(ctx, x, y, 2, 2, `rgba(150,255,240,${0.4 + 0.4 * Math.sin(t * 3 + i)})`);
  }
  for (let i = 0; i < 3; i++) {
    const fx = ((t * 0.12 + i * 0.33) % 1) * (w + 60) - 30,
      fy = h * (0.4 + i * 0.14);
    poly(ctx, [fx - 10, fy, fx - 18, fy - 6, fx - 18, fy + 6], ['#ff922b', '#ffd43b', '#f783ac'][i], OUT, 1);
    ell(ctx, fx, fy, 10, 6, ['#ff922b', '#ffd43b', '#f783ac'][i], OUT, 1.2);
  }
  // хомячок плывёт (лёжа, как под водой)
  const z = w / 560,
    dir = toCove ? 1 : -1,
    hx = toCove ? -40 * z + k * (w + 80 * z) : w + 40 * z - k * (w + 80 * z),
    hy = h * 0.55 + Math.sin(t * 4) * 6;
  if (dolphin) {
    // дельфин плывёт носом вперёд, чуть покачиваясь; хомячок — у него на спинке, за плавником
    const S = 1.35 * z;
    ctx.save();
    ctx.translate(hx, hy + 22 * z);
    ctx.scale(S, S);
    paintDolphin(ctx, 3 + Math.sin(t * 3) * 0.35, dir < 0 ? 1 : 0);
    ctx.restore();
    drawHamster(ctx, hx - dir * 14 * z, hy + 6 * z + Math.sin(t * 3) * 2 * z, 0.62 * z, look, {
      dir,
      sit: true,
      happy: true,
      time: t,
      shadow: false,
    });
  } else {
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(dir * 1.25);
    drawHamster(ctx, 0, 30 * z, 0.95 * z, look, { dir: 0, happy: true, armsUp: true, time: t, shadow: false });
    ctx.restore();
  }
  // пузырьки за хомячком
  for (let i = 0; i < 6; i++) {
    const ph = (t * 1.5 + i / 6) % 1;
    ell(
      ctx,
      hx - dir * (20 + i * 10) * z,
      hy - 20 * z - ph * 60 * z,
      (3 + (i % 3)) * z,
      (3 + (i % 3)) * z,
      null,
      'rgba(255,255,255,.8)',
      1.5,
    );
  }
}

// ════════ из desert.js ════════
// ---------- караван-автобус ----------
/** Картинка переезда: город вдали, барханы и кактусы, по дороге едет караван-автобус (k — 0..1 пути). */
export function paintCaravan(ctx, w, h, k, toDesert, look, t) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#74c0fc');
  sky.addColorStop(1, '#fff3d6');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  ell(ctx, w * 0.84, h * 0.2, 26, 26, '#ffe066');
  ell(ctx, w * 0.84, h * 0.2, 36, 36, 'rgba(255,224,102,.3)');
  // город — у левого края, пирамида — у правого
  ctx.fillStyle = '#a5b4cf';
  for (const [x, bw, bh] of [
    [0.02, 0.05, 0.32],
    [0.07, 0.04, 0.22],
    [0.11, 0.06, 0.4],
    [0.17, 0.04, 0.18],
  ])
    ctx.fillRect(w * x, h * (0.62 - bh), w * bw, h * bh);
  poly(ctx, [w * 0.68, h * 0.62, w * 0.78, h * 0.4, w * 0.88, h * 0.62], '#e8b974', OUT, 1.6);
  // барханы
  poly(
    ctx,
    [0, h, 0, h * 0.62, w * 0.3, h * 0.58, w * 0.55, h * 0.64, w * 0.8, h * 0.56, w, h * 0.62, w, h],
    '#f2d39a',
    OUT,
    2,
  );
  poly(ctx, [0, h, 0, h * 0.86, w * 0.35, h * 0.8, w * 0.7, h * 0.88, w, h * 0.82, w, h], '#e6c288');
  // кактусы и пальма
  for (const x of [0.28, 0.58, 0.9]) {
    fillRR(ctx, w * x - 5, h * 0.6, 10, 28, 5, '#4f9a3a', OUT, 1.6);
    fillRR(ctx, w * x + 4, h * 0.62, 7, 12, 3, '#4f9a3a', OUT, 1.2);
  }
  // дорога
  fillRR(ctx, -10, h * 0.7, w + 20, 22, 8, '#d9b06c', OUT, 1.6);
  for (let x = ((t * 120) % 40) - 40; x < w; x += 40) fillRR(ctx, x, h * 0.7 + 10, 18, 3, 1.5, '#fff3d6');
  // автобус: едет вправо (в пустыню) или влево (в город)
  const dir = toDesert ? 1 : -1,
    z = w / 560, // масштаб картинки
    bx = toDesert ? -150 * z + k * (w + 120 * z) : w + 30 * z - k * (w + 180 * z),
    by = h * 0.74 + Math.sin(t * 18) * 1.2;
  ctx.save();
  ctx.translate(bx, by);
  ctx.scale(0.95 * z, 0.95 * z);
  paintBus(ctx, dir);
  // хомячок в окошке
  ctx.save();
  ctx.beginPath();
  ctx.rect(dir > 0 ? 44 : 22, -52, 24, 22);
  ctx.clip();
  drawHamster(ctx, dir > 0 ? 56 : 34, -16, 0.42, look, { time: t, dir, happy: true, shadow: false });
  ctx.restore();
  ctx.restore();
  // пыль из-под колёс
  for (let i = 0; i < 4; i++) {
    const ph = (t * 2 + i / 4) % 1;
    ctx.globalAlpha = 0.5 * (1 - ph);
    ell(
      ctx,
      bx + (toDesert ? -30 * z - ph * 50 * z : 120 * z + ph * 50 * z),
      by + 4 - ph * 12,
      (8 + ph * 12) * z,
      (5 + ph * 7) * z,
      '#e6c288',
    );
  }
  ctx.globalAlpha = 1;
  // верблюд идёт рядом (караван!)
  ctx.save();
  ctx.translate(toDesert ? bx - 95 * z : bx + 215 * z, h * 0.69);
  ctx.scale(0.6 * z, 0.6 * z);
  paintCamel(ctx, dir, 1 + (Math.floor(t * 6) % 2));
  ctx.restore();
}

// ════════ из island.js ════════
// ---------- кораблик: долгое плавание на юг и обратно ----------
/** Картинка долгого плавания: открытый океан, дельфины, вдали вулкан (k — 0..1 пути). */
export function paintFaraway(ctx, w, h, k, toIsland, look, t) {
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.55);
  sky.addColorStop(0, '#339af0');
  sky.addColorStop(1, '#d0ebff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  ell(ctx, w * 0.84, h * 0.16, 22, 22, '#ffe066');
  ell(ctx, w * 0.84, h * 0.16, 32, 32, 'rgba(255,224,102,.3)');
  for (const [x, y, sc] of [
    [0.2, 0.12, 1],
    [0.55, 0.2, 0.7],
  ]) {
    const cx = ((x + t * 0.012) % 1.2) * w;
    ell(ctx, cx, h * y, 30 * sc, 10 * sc, '#fff');
    ell(ctx, cx + 18 * sc, h * y - 6 * sc, 18 * sc, 10 * sc, '#fff');
  }
  // вдали: туда — вулкан растёт по мере пути, обратно — тает, а из-за горизонта встают башни города
  const near = toIsland ? k : 1 - k,
    vs = 0.35 + near * 0.9,
    vx = toIsland ? w * 0.72 : w * 0.24,
    hz = h * 0.55;
  poly(
    ctx,
    [vx - 70 * vs, hz, vx - 14 * vs, hz - 70 * vs, vx + 14 * vs, hz - 70 * vs, vx + 70 * vs, hz],
    '#8a7568',
    OUT,
    2,
  );
  poly(
    ctx,
    [vx - 14 * vs, hz - 70 * vs, vx - 8 * vs, hz - 62 * vs, vx + 8 * vs, hz - 64 * vs, vx + 14 * vs, hz - 70 * vs],
    '#ff6b35',
  );
  for (let i = 0; i < 6; i++)
    ell(ctx, vx - 66 * vs + i * 26 * vs, hz - 4 * vs, 18 * vs, 9 * vs, i % 2 ? '#37b24d' : '#2b8a3e', OUT, 1.2);
  for (let i = 0; i < 3; i++) {
    const ph = (t * 0.3 + i / 3) % 1;
    ell(
      ctx,
      vx + ph * 30 * vs,
      hz - (78 + ph * 60) * vs,
      (6 + ph * 14) * vs,
      (5 + ph * 9) * vs,
      `rgba(240,240,245,${(0.75 * (1 - ph)).toFixed(2)})`,
    );
  }
  if (!toIsland) {
    ctx.fillStyle = '#b6c6dd';
    for (const [x, bw, bh] of [
      [0.78, 0.03, 0.12],
      [0.82, 0.02, 0.08],
      [0.86, 0.035, 0.2],
      [0.91, 0.025, 0.1],
    ])
      ctx.fillRect(w * x, hz - h * bh * k, w * bw, h * bh * k);
  }
  // открытый океан с волнами
  const seaG = ctx.createLinearGradient(0, hz, 0, h);
  seaG.addColorStop(0, '#1c7ed6');
  seaG.addColorStop(1, '#0b4f9c');
  ctx.fillStyle = seaG;
  ctx.fillRect(0, hz, w, h - hz);
  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let r = 0; r < 5; r++) {
    const y = h * (0.6 + r * 0.085);
    for (let x = ((t * (36 + r * 14)) % 70) - 70; x < w; x += 70) {
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 12, y - 5, x + 24, y);
    }
  }
  ctx.stroke();
  // дельфины выпрыгивают по очереди
  for (let i = 0; i < 3; i++) {
    const ph = (t * 0.45 + i * 0.37) % 1;
    if (ph > 0.6) continue;
    const q = ph / 0.6,
      dx = w * (0.18 + i * 0.27) + q * 60,
      dy = h * (0.72 + (i % 2) * 0.08) - Math.sin(q * Math.PI) * h * 0.14;
    ctx.save();
    ctx.translate(dx, dy);
    ctx.scale(0.62, 0.62);
    paintDolphin(ctx, 3 - Math.cos(q * Math.PI) * 2.7, 0); // нос вверх → нос вниз
    ctx.restore();
    if (q > 0.85) ell(ctx, dx + 10, h * (0.72 + (i % 2) * 0.08), 16, 4, 'rgba(255,255,255,.7)');
  }
  // кораблик с хомячком
  const z = w / 560,
    dir = toIsland ? 1 : -1,
    bx = toIsland ? -60 * z + k * (w * 0.56 + 40 * z) : w * 0.62 - k * (w * 0.62 + 90 * z),
    by = h * 0.84 + Math.sin(t * 2) * 3 * z;
  ctx.save();
  ctx.translate(bx, by);
  ctx.scale(0.9 * z, 0.9 * z);
  drawBoat(ctx, 0, 0, dir, t, look, true);
  ctx.restore();
  // кокос плывёт мимо — на счастье
  ctx.save();
  ctx.translate(((1 - k) * 1.3 - 0.15) * w, h * 0.93 + Math.sin(t * 3) * 2);
  paintCoconut(ctx, 7 * z + 3);
  ctx.restore();
}

// ════════ из jungle.js ════════
// ---------- кораблик: из моря города к причалу в джунглях и обратно ----------
/** Картинка переезда: море, буйки, остров с пальмами; кораблик плывёт (k — 0..1 пути). */
export function paintVoyage(ctx, w, h, k, toJungle, look, t) {
  if (!toJungle) return paintVoyageHome(ctx, w, h, k, look, t);
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.55);
  sky.addColorStop(0, '#4dabf7');
  sky.addColorStop(1, '#d0ebff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  ell(ctx, w * 0.16, h * 0.18, 24, 24, '#ffe066');
  ell(ctx, w * 0.16, h * 0.18, 34, 34, 'rgba(255,224,102,.3)');
  for (const [x, y, s] of [
    [0.4, 0.12, 1],
    [0.7, 0.2, 0.8],
  ]) {
    const cx = ((x + t * 0.01) % 1.2) * w;
    ell(ctx, cx, h * y, 30 * s, 10 * s, '#fff');
    ell(ctx, cx + 18 * s, h * y - 6 * s, 18 * s, 10 * s, '#fff');
  }
  // остров джунглей справа: горы в зелени, пальмы, причал; город — маленький слева
  const sx = w * 0.62;
  poly(
    ctx,
    [
      sx,
      h * 0.56,
      sx + w * 0.1,
      h * 0.3,
      sx + w * 0.22,
      h * 0.36,
      sx + w * 0.3,
      h * 0.26,
      w + 10,
      h * 0.4,
      w + 10,
      h * 0.56,
    ],
    '#2f9e44',
    OUT,
    2,
  );
  poly(ctx, [sx + w * 0.1, h * 0.3, sx + w * 0.16, h * 0.4, sx + w * 0.22, h * 0.36], 'rgba(0,0,0,.12)');
  for (let i = 0; i < 7; i++)
    ell(
      ctx,
      sx + w * 0.03 + i * w * 0.055,
      h * 0.47 - (i % 2) * h * 0.04,
      w * 0.04,
      h * 0.05,
      i % 2 ? '#37b24d' : '#2b8a3e',
      OUT,
      1.4,
    );
  // водопад на горе
  fillRR(ctx, sx + w * 0.235, h * 0.3, w * 0.02, h * 0.18, 3, '#a5d8ff', OUT, 1.2);
  for (const x of [0.05, 0.3]) {
    line(ctx, sx + w * x, h * 0.56, sx + w * x + 6, h * 0.36, OUT, 4);
    line(ctx, sx + w * x, h * 0.56, sx + w * x + 6, h * 0.36, '#a8703f', 2.4);
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.6;
      ell(ctx, sx + w * x + 6 + Math.cos(a) * 14, h * 0.36 + Math.sin(a) * 6 + 4, 14, 4, '#40c057', OUT, 1, a);
    }
  }
  ctx.fillStyle = '#b6c6dd';
  for (const [x, bw, bh] of [
    [0.02, 0.03, 0.12],
    [0.05, 0.02, 0.08],
    [0.075, 0.035, 0.16],
  ])
    ctx.fillRect(w * x, h * (0.56 - bh), w * bw, h * bh);
  // море с волнами
  const seaG = ctx.createLinearGradient(0, h * 0.55, 0, h);
  seaG.addColorStop(0, '#3bc9db');
  seaG.addColorStop(1, '#1971c2');
  ctx.fillStyle = seaG;
  ctx.fillRect(0, h * 0.55, w, h * 0.45);
  ctx.strokeStyle = 'rgba(255,255,255,.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let r = 0; r < 4; r++) {
    const y = h * (0.62 + r * 0.09);
    for (let x = ((t * (30 + r * 12)) % 60) - 60; x < w; x += 60) {
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 10, y - 4, x + 20, y);
    }
  }
  ctx.stroke();
  // буйки
  for (let i = 0; i < 5; i++) {
    const bx = w * (0.08 + i * 0.22),
      by = h * 0.66 + Math.sin(t * 2 + i) * 2;
    ell(ctx, bx, by, 7, 7, '#fa5252', OUT, 1.4);
    ctx.fillStyle = '#fff';
    ctx.fillRect(bx - 6, by - 1.5, 12, 3);
  }
  // кораблик с хомячком
  const z = w / 560,
    dir = toJungle ? 1 : -1,
    bx = toJungle ? -60 * z + k * (w * 0.62 + 40 * z) : w * 0.58 - k * (w * 0.58 + 90 * z),
    by = h * 0.8;
  ctx.save();
  ctx.translate(bx, by);
  ctx.scale(0.9 * z, 0.9 * z);
  drawBoat(ctx, 0, 0, dir, t, look, true);
  ctx.restore();
  // попугай летит рядом
  ctx.save();
  ctx.translate(bx + dir * 70 * z, by - 120 * z + Math.sin(t * 6) * 6);
  ctx.scale(dir * 0.9 * z, 0.9 * z);
  paintParrot(ctx, 0, Math.floor(t * 8) % 2);
  ctx.restore();
}

/**
 * Картинка «домой» (Дж12) — не зеркало дороги туда: тёплый вечерний свет, остров джунглей уходит назад, налево
 * (на берегу на пальме сидит попугай и машет крылом вслед), а впереди, справа, растёт городок у моря — домики,
 * маяк и пирс. Кораблик плывёт слева направо, как и туда, — хомячок и попугай не отражаются зеркально.
 */
function paintVoyageHome(ctx, w, h, k, look, t) {
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.55);
  sky.addColorStop(0, '#74c0fc');
  sky.addColorStop(1, '#ffe8cc');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  ell(ctx, w * 0.84, h * 0.24, 26, 26, '#ffc078');
  ell(ctx, w * 0.84, h * 0.24, 38, 38, 'rgba(255,192,120,.3)');
  for (const [x, y, s2] of [
    [0.3, 0.14, 0.9],
    [0.62, 0.1, 0.7],
  ]) {
    const cx = ((x + t * 0.008) % 1.2) * w;
    ell(ctx, cx, h * y, 30 * s2, 10 * s2, '#fff4e6');
    ell(ctx, cx + 18 * s2, h * y - 6 * s2, 18 * s2, 10 * s2, '#fff4e6');
  }
  // остров джунглей позади, слева: уходит, становится меньше
  const back = 1 - k * 0.25,
    ix = -w * 0.06 - k * w * 0.05;
  ctx.save();
  ctx.translate(ix, h * 0.56);
  ctx.scale(back, back);
  poly(ctx, [0, 0, w * 0.06, -h * 0.3, w * 0.14, -h * 0.22, w * 0.24, -h * 0.28, w * 0.36, 0], '#2f9e44', OUT, 2);
  for (let i = 0; i < 6; i++)
    ell(
      ctx,
      w * 0.03 + i * w * 0.055,
      -h * 0.08 - (i % 2) * h * 0.04,
      w * 0.04,
      h * 0.05,
      i % 2 ? '#37b24d' : '#2b8a3e',
      OUT,
      1.4,
    );
  fillRR(ctx, w * 0.12, -h * 0.25, w * 0.02, h * 0.17, 3, '#a5d8ff', OUT, 1.2); // водопад
  // пальма на берегу — на ней попугай машет вслед
  const px = w * 0.3;
  line(ctx, px, 0, px + 6, -h * 0.22, OUT, 4);
  line(ctx, px, 0, px + 6, -h * 0.22, '#a8703f', 2.4);
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.6;
    ell(ctx, px + 6 + Math.cos(a) * 14, -h * 0.22 + Math.sin(a) * 6 + 4, 14, 4, '#40c057', OUT, 1, a);
  }
  ctx.translate(px + 8, -h * 0.22 - 4 + Math.sin(t * 5) * 1.5);
  ctx.scale(0.8, 0.8);
  paintParrot(ctx, 0, Math.floor(t * 6) % 2);
  ctx.restore();
  // городок впереди, справа: растёт, пока подплываем — домики с крышами, маяк, пирс
  const near = 0.7 + k * 0.45,
    tx = w * 0.98;
  ctx.save();
  ctx.translate(tx, h * 0.56);
  ctx.scale(near, near);
  poly(ctx, [-w * 0.42, 0, -w * 0.38, -h * 0.05, 40, -h * 0.07, 40, 0], '#e6c98f', OUT, 1.6); // берег
  const HOUSES = [
    [-0.38, 0.1, '#ffd8a8', '#e8590c'],
    [-0.3, 0.13, '#d0ebff', '#1971c2'],
    [-0.22, 0.09, '#ffdeeb', '#c2255c'],
    [-0.14, 0.12, '#fff3bf', '#2f9e44'],
  ];
  for (const [x, hh, wall, roof] of HOUSES) {
    const X = w * x,
      bw = w * 0.07,
      top = -h * 0.05 - h * hh;
    fillRR(ctx, X, top, bw, h * hh, 2, wall, OUT, 1.4);
    poly(ctx, [X - 4, top, X + bw / 2, top - h * 0.06, X + bw + 4, top], roof, OUT, 1.4);
    ctx.fillStyle = '#74c0fc';
    ctx.fillRect(X + bw * 0.25, top + h * hh * 0.25, bw * 0.2, h * hh * 0.25);
    ctx.fillRect(X + bw * 0.6, top + h * hh * 0.25, bw * 0.2, h * hh * 0.25);
  }
  // маяк
  const LX = -w * 0.04;
  poly(ctx, [LX - 9, -h * 0.05, LX - 6, -h * 0.34, LX + 6, -h * 0.34, LX + 9, -h * 0.05], '#fff', OUT, 1.6);
  ctx.fillStyle = '#fa5252';
  ctx.fillRect(LX - 8, -h * 0.25, 16, h * 0.05);
  ctx.fillRect(LX - 7, -h * 0.15, 14, h * 0.05);
  fillRR(ctx, LX - 7, -h * 0.4, 14, h * 0.06, 2, '#ffe066', OUT, 1.4);
  poly(ctx, [LX - 9, -h * 0.4, LX, -h * 0.45, LX + 9, -h * 0.4], '#fa5252', OUT, 1.4);
  // пирс
  fillRR(ctx, -w * 0.12, -h * 0.02, w * 0.1, h * 0.03, 2, '#c98b5a', OUT, 1.2);
  ctx.restore();
  // море с волнами
  const seaG = ctx.createLinearGradient(0, h * 0.55, 0, h);
  seaG.addColorStop(0, '#66d9e8');
  seaG.addColorStop(1, '#1c7ed6');
  ctx.fillStyle = seaG;
  ctx.fillRect(0, h * 0.55, w, h * 0.45);
  ctx.strokeStyle = 'rgba(255,255,255,.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let r = 0; r < 4; r++) {
    const y = h * (0.62 + r * 0.09);
    for (let x = ((t * (30 + r * 12)) % 60) - 60; x < w; x += 60) {
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 10, y - 4, x + 20, y);
    }
  }
  ctx.stroke();
  // солнечная дорожка
  ctx.fillStyle = 'rgba(255,212,140,.45)';
  for (let i = 0; i < 6; i++)
    ctx.fillRect(w * 0.8 + Math.sin(t * 3 + i) * 8 - 14 + i * 2, h * (0.58 + i * 0.06), 28 - i * 3, 3);
  // кораблик с хомячком — слева направо, к городу
  const z = w / 560,
    bx = w * 0.06 + k * w * 0.62,
    by = h * 0.8;
  ctx.save();
  ctx.translate(bx, by);
  ctx.scale(0.9 * z, 0.9 * z);
  drawBoat(ctx, 0, 0, 1, t, look, true);
  ctx.restore();
}

// ════════ из mountain.js ════════
/** Картинка переезда: лес внизу слева, гора со снежной шапкой справа, по тросу едет вагончик (k — 0..1 пути). */
export function paintRide(ctx, w, h, k, season, look, t) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, season === 'winter' ? '#a9d4f2' : '#7cc8f8');
  sky.addColorStop(1, '#e7f6ff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  // гора
  const mx = w * 0.72;
  poly(ctx, [mx - w * 0.5, h, mx, h * 0.12, mx + w * 0.5, h], '#9aa9c9', OUT, 2.5);
  poly(ctx, [mx, h * 0.12, mx + w * 0.5, h, mx + w * 0.12, h], '#7d8db0');
  poly(
    ctx,
    [
      mx - 52,
      h * 0.12 + 62,
      mx,
      h * 0.12,
      mx + 56,
      h * 0.12 + 66,
      mx + 26,
      h * 0.12 + 52,
      mx + 6,
      h * 0.12 + 70,
      mx - 22,
      h * 0.12 + 54,
    ],
    '#ffffff',
    OUT,
    2,
  );
  // облака ниже вершины
  for (let i = 0; i < 4; i++) {
    const cx = ((i * 0.31 + t * 0.03) % 1.3) * w - w * 0.15,
      cy = h * (0.36 + (i % 2) * 0.08);
    ctx.globalAlpha = 0.85;
    for (const [dx, dy, r] of [
      [0, 0, 30],
      [26, -8, 24],
      [50, 2, 26],
    ])
      ell(ctx, cx + dx, cy + dy, r, r * 0.6, '#ffffff');
    ctx.globalAlpha = 1;
  }
  // лес внизу
  const fir = season === 'winter' ? '#cfe3f0' : '#2b8a3e';
  for (let i = 0; i < 16; i++) {
    const x = (i / 15) * w * 0.75 - 10,
      y = h - 8 - ((i * 37) % 23);
    poly(ctx, [x - 20, y + 20, x, y - 38, x + 20, y + 20], fir, OUT, 1.6);
  }
  // трос и вагончик
  const ax = w * 0.06,
    ay = h * 0.82,
    bx = mx - 8,
    by = h * 0.2;
  line(ctx, ax, ay, bx, by, OUT, 2.2);
  const x = ax + (bx - ax) * k,
    y = ay + (by - ay) * k,
    sway = Math.sin(t * 3) * 0.06;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(sway);
  line(ctx, 0, 0, 0, 22, OUT, 2.4);
  fillRR(ctx, -34, 22, 68, 56, 14, '#fa5252', OUT, 2.5);
  fillRR(ctx, -26, 30, 52, 28, 6, '#cfeaff', OUT, 2);
  ctx.save();
  ctx.beginPath();
  ctx.rect(-26, 30, 52, 28);
  ctx.clip();
  drawHamster(ctx, 0, 80, 0.5, look, { time: t, shadow: false, happy: true });
  ctx.restore();
  ctx.fillStyle = 'rgba(0,0,0,.14)';
  ctx.fillRect(18, 24, 12, 52);
  ctx.restore();
}
