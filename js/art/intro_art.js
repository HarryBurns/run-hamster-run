// РИСУНКИ ВСТУПИТЕЛЬНОЙ СЦЕНКИ (features/intro.js): четыре кадра — город под дождём, поезд к морю, панорама
// Ореховой Гавани, новый дом (вилла). Рисунки считают от размера экрана (w, h) и «единицы» u — так кадр хорош и лёжа
// (компьютер, iPad), и стоя (телефон). Подписи кадров и показ сценки — в features/intro.js.
import { ell, fillRR, line, poly, star, shade, mix } from '../core/draw.js';
import { TAU, clamp } from '../core/util.js';
import { npcLook } from '../data/index.js';
import { drawHamster, drawPortrait } from './hamster.js';

const OUT = '#4a3728';
const NUT = { base: '#c98a4b', light: '#e9b97f', mid: '#b97a40', dark: '#99602f', vein: '#8a5428' };

/** Постоянное «случайное» число 0..1 по номеру (чтобы окна и деревья не прыгали от кадра к кадру). */
const h01 = (i) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * «Единица» рисунка: 1 — на экране компьютера. fh — высота свободного места над подписью: главное в кадре (хомячок,
 * поезд, площадь) стоит над ней, а земля и море уходят под подпись до самого низа экрана.
 */
const unit = (w, fh) => Math.min(w * (w < fh ? 1.4 : 1), fh * 1.3) / 600; // стоя (телефон) — крупнее: места ввысь много

// ---------- общие детали ----------
function sky(ctx, w, h, top, bot) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top);
  g.addColorStop(1, bot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function cloud(ctx, x, y, s, col = '#fff') {
  ctx.fillStyle = col;
  ctx.beginPath();
  for (const [dx, dy, r] of [
    [-1.3, 0.2, 0.7],
    [-0.5, -0.25, 0.95],
    [0.4, -0.35, 1],
    [1.2, 0.05, 0.75],
    [0, 0.3, 0.9],
  ]) {
    ctx.moveTo(x + dx * s + r * s, y + dy * s);
    ctx.arc(x + dx * s, y + dy * s, r * s, 0, TAU);
  }
  ctx.fill();
}

/** Чемодан: центр низа (x, y), размер k. */
function suitcase(ctx, x, y, k) {
  ctx.lineJoin = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 3 * k;
  ctx.beginPath();
  ctx.moveTo(x - 9 * k, y - 34 * k);
  ctx.lineTo(x - 9 * k, y - 42 * k);
  ctx.lineTo(x + 9 * k, y - 42 * k);
  ctx.lineTo(x + 9 * k, y - 34 * k);
  ctx.stroke();
  fillRR(ctx, x - 24 * k, y - 35 * k, 48 * k, 35 * k, 6 * k, '#c9783c', OUT, 2.2 * k);
  ctx.fillStyle = '#8f4f22';
  ctx.fillRect(x - 24 * k, y - 22 * k, 48 * k, 4 * k);
  fillRR(ctx, x - 4 * k, y - 25 * k, 8 * k, 9 * k, 2 * k, '#ffd43b', OUT, 1.4 * k);
  // наклейки из путешествий
  ell(ctx, x - 13 * k, y - 10 * k, 5 * k, 5 * k, '#ff8fab', OUT, 1.2 * k);
  star(ctx, x + 13 * k, y - 10 * k, 5 * k, '#74c0fc', OUT, 1.2 * k);
}

/** Ореховая скала: низ по центру (x, y), ширина ww, высота hh; flip — зеркально. */
function nutCliff(ctx, x, y, ww, hh, flip) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale((flip ? -1 : 1) * (ww / 150), hh / 140);
  ctx.lineJoin = 'round';
  poly(
    ctx,
    [-75, 0, -77, -46, -67, -86, -51, -118, -31, -131, -9, -117, 7, -138, 32, -130, 50, -106, 68, -78, 75, -38, 75, 0],
    NUT.base,
    OUT,
    2.4,
  );
  poly(ctx, [-67, -86, -51, -118, -31, -131, -9, -117, -18, -98, -42, -92], NUT.light);
  poly(ctx, [-9, -117, 7, -138, 32, -130, 50, -106, 26, -100, 4, -108], NUT.light);
  poly(ctx, [50, -106, 68, -78, 75, -38, 75, 0, 44, 0, 48, -44, 40, -76, 26, -100], NUT.dark);
  poly(ctx, [-18, -98, 4, -108, 26, -100, 40, -76, 12, -70, -12, -74], NUT.mid);
  ctx.strokeStyle = NUT.vein;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-70, -34);
  ctx.quadraticCurveTo(-38, -44, -8, -36);
  ctx.quadraticCurveTo(22, -28, 46, -38);
  ctx.moveTo(-66, -14);
  ctx.quadraticCurveTo(-28, -24, 4, -16);
  ctx.quadraticCurveTo(32, -10, 62, -18);
  ctx.moveTo(-44, -60);
  ctx.quadraticCurveTo(-20, -66, 2, -58);
  ctx.stroke();
  ell(ctx, -42, -120, 16, 6, '#74b85a', OUT, 1.6);
  ell(ctx, 18, -132, 18, 6.5, '#74b85a', OUT, 1.6);
  ell(ctx, 26, -140, 9, 7, '#51a34a', OUT, 1.6);
  ctx.restore();
}

/** Домик с крышей: низ по центру (x, y). */
function house(ctx, x, y, ww, hh, wall, roof, lit) {
  fillRR(ctx, x - ww / 2, y - hh, ww, hh, 3, wall, OUT, 2);
  poly(ctx, [x - ww / 2 - 6, y - hh, x, y - hh - ww * 0.45, x + ww / 2 + 6, y - hh], roof, OUT, 2);
  const win = lit ? '#ffe066' : '#a5d8ff';
  fillRR(ctx, x - ww * 0.3, y - hh * 0.78, ww * 0.22, hh * 0.3, 2, win, OUT, 1.5);
  fillRR(ctx, x + ww * 0.08, y - hh * 0.78, ww * 0.22, hh * 0.3, 2, win, OUT, 1.5);
  fillRR(ctx, x - ww * 0.09, y - hh * 0.42, ww * 0.18, hh * 0.42, 2, shade(roof, -0.2), OUT, 1.5);
}

function palm(ctx, x, y, k, t) {
  const sw = Math.sin(t * 1.1 + x) * 0.05;
  ctx.save();
  ctx.translate(x, y);
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 11 * k;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(8 * k, -44 * k, 3 * k, -88 * k);
  ctx.stroke();
  ctx.strokeStyle = '#b9824f';
  ctx.lineWidth = 7.5 * k;
  ctx.stroke();
  ctx.translate(3 * k, -88 * k);
  ctx.rotate(sw);
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI * (0.02 + (i / 6) * 0.96);
    ctx.save();
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(26 * k, -11 * k, 52 * k, 4 * k);
    ctx.quadraticCurveTo(26 * k, 5 * k, 0, 0);
    ctx.fillStyle = i % 2 ? '#37b24d' : '#51cf66';
    ctx.fill();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 1.6 * k;
    ctx.stroke();
    ctx.restore();
  }
  ell(ctx, 0, 0, 5 * k, 5 * k, '#8d5a2b', OUT, 1.5 * k);
  ctx.restore();
}

function waves(ctx, w, y0, y1, t, u) {
  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.lineWidth = 2.4 * u;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const rows = Math.max(2, Math.round((y1 - y0) / (26 * u)));
  for (let r = 0; r < rows; r++) {
    const y = y0 + ((r + 0.5) / rows) * (y1 - y0);
    for (let i = 0; i < 9; i++) {
      const x = ((h01(r * 17 + i) * w + t * (10 + r * 4) * u) % (w + 60 * u)) - 30 * u;
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 9 * u, y - 5 * u, x + 18 * u, y);
    }
  }
  ctx.stroke();
}

// ---------- кадры ----------
/** 1. Большой шумный город: серые дома, дождь, все спешат; хомячок под зонтиком. */
export function paintCity(ctx, w, h, t, look, fh) {
  const u = unit(w, fh),
    ground = fh - 64 * u;
  sky(ctx, w, h, '#7d8a9c', '#b4bdc8');
  cloud(ctx, w * 0.2 + Math.sin(t * 0.2) * 20 * u, fh * 0.12, 46 * u, '#98a3b1');
  cloud(ctx, w * 0.72 - Math.sin(t * 0.17) * 24 * u, fh * 0.08, 56 * u, '#8f9aa9');
  cloud(ctx, w * 0.46, fh * 0.2, 38 * u, '#a3adb9');
  // дальние и ближние дома
  for (let row = 0; row < 2; row++) {
    const bw = (row ? 96 : 70) * u,
      n = Math.ceil(w / bw) + 1;
    for (let i = 0; i < n; i++) {
      const x = i * bw - (row ? 20 : 46) * u,
        bh = (row ? 170 + h01(i * 3 + 1) * 190 : 250 + h01(i * 7) * 170) * u * (h / w > 1.2 ? 1.25 : 1),
        col = row ? ['#77818f', '#6d7785', '#828c99'][i % 3] : ['#99a2ae', '#a4acb7'][i % 2];
      fillRR(ctx, x, ground - bh, bw - 6 * u, bh + 4, 2, col, row ? OUT : 'rgba(74,55,40,.45)', (row ? 2 : 1.4) * u);
      if (!row) continue;
      const cols = 3,
        rows = Math.floor(bh / (30 * u));
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const lit = h01(i * 31 + r * 7 + c * 13) > 0.62;
          ctx.fillStyle = lit ? '#ffe9a8' : '#59626f';
          ctx.fillRect(x + (10 + c * 25) * u, ground - bh + (12 + r * 30) * u, 14 * u, 16 * u);
        }
    }
  }
  // дорога и лужи
  ctx.fillStyle = '#5c6470';
  ctx.fillRect(0, ground, w, h - ground);
  ctx.fillStyle = '#737c88';
  ctx.fillRect(0, ground, w, 12 * u);
  for (let i = 0; i < 5; i++)
    ell(ctx, w * (0.12 + i * 0.2), ground + (60 + (i % 2) * 44) * u, 46 * u, 9 * u, 'rgba(160,180,200,.5)');
  ctx.strokeStyle = 'rgba(255,255,255,.45)';
  ctx.lineWidth = 4 * u;
  ctx.setLineDash([26 * u, 22 * u]);
  line(ctx, 0, ground + 84 * u, w, ground + 84 * u, 'rgba(255,255,255,.4)', 4 * u);
  ctx.setLineDash([]);
  // машины едут в обе стороны
  for (const [sp, yk, col, ph] of [
    [130, 22, '#8996a6', 0],
    [-170, 150, '#6f7c8c', 0.5],
  ]) {
    const span = w + 320 * u,
      x = ((((t * sp * u + ph * span) % span) + span) % span) - 160 * u,
      y = ground + yk * u,
      d = sp > 0 ? 1 : -1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(d * u, u);
    fillRR(ctx, -64, -40, 128, 30, 10, col, OUT, 2.4);
    fillRR(ctx, -38, -64, 70, 28, 10, col, OUT, 2.4);
    fillRR(ctx, -30, -58, 26, 18, 4, '#cfe3f0', OUT, 1.6);
    fillRR(ctx, 2, -58, 24, 18, 4, '#cfe3f0', OUT, 1.6);
    ell(ctx, 58, -28, 5, 4, '#ffe9a8', OUT, 1.4);
    for (const wx of [-36, 36]) {
      ell(ctx, wx, -10, 13, 13, '#3c424b', OUT, 2.4);
      ell(ctx, wx, -10, 5, 5, '#aab2bd');
    }
    ctx.restore();
  }
  // прохожие спешат (серые силуэты)
  for (let i = 0; i < 4; i++) {
    const sp = (i % 2 ? -1 : 1) * (60 + i * 14),
      span = w + 200 * u,
      x = ((((t * sp * u + h01(i) * span) % span) + span) % span) - 100 * u,
      y = ground + (10 + (i % 2) * 6) * u,
      b = Math.abs(Math.sin(t * 7 + i)) * 4 * u;
    ell(ctx, x, y - 26 * u - b, 17 * u, 24 * u, '#687280', 'rgba(60,66,75,.8)', 2 * u);
    ell(ctx, x - 10 * u, y - 50 * u - b, 6 * u, 6 * u, '#687280', 'rgba(60,66,75,.8)', 2 * u);
    ell(ctx, x + 10 * u, y - 50 * u - b, 6 * u, 6 * u, '#687280', 'rgba(60,66,75,.8)', 2 * u);
  }
  // хомячок под зонтиком с чемоданом
  const hx = w * 0.5,
    hy = ground + 44 * u,
    hs = 1.9 * u;
  suitcase(ctx, hx + 74 * u, hy + 2 * u, 1.25 * u);
  drawHamster(ctx, hx, hy, hs, look, { time: t, dir: 0 });
  line(ctx, hx + 26 * hs, hy - 20 * hs, hx + 26 * hs, hy - 104 * hs, OUT, 3.4 * u);
  ctx.beginPath();
  ctx.moveTo(hx - 34 * hs, hy - 100 * hs);
  ctx.quadraticCurveTo(hx + 26 * hs, hy - 162 * hs, hx + 86 * hs, hy - 100 * hs);
  for (let i = 3; i >= 0; i--)
    ctx.quadraticCurveTo(hx - 34 * hs + (i + 0.5) * 30 * hs, hy - 112 * hs, hx - 34 * hs + i * 30 * hs, hy - 100 * hs);
  ctx.closePath();
  ctx.fillStyle = '#ff8fab';
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.6 * u;
  ctx.stroke();
  // дождь
  ctx.strokeStyle = 'rgba(225,238,250,.6)';
  ctx.lineWidth = 2 * u;
  ctx.beginPath();
  for (let i = 0; i < 110; i++) {
    const x = ((h01(i) * (w + 200 * u) + t * 90 * u) % (w + 200 * u)) - 100 * u,
      y = (h01(i + 500) * h + t * (520 + h01(i + 9) * 240) * u) % h;
    ctx.moveTo(x, y);
    ctx.lineTo(x - 7 * u, y + 22 * u);
  }
  ctx.stroke();
}

/** 2. Поезд к морю: тучи остаются позади, впереди — солнце и синяя полоска моря. */
export function paintTrain(ctx, w, h, t, look, fh) {
  const u = unit(w, fh),
    a = clamp(t / 7, 0, 1), // сколько уже проехали: небо светлеет
    rail = fh - 62 * u;
  sky(ctx, w, h, mix('#8e9bab', '#5cc0ff', a), mix('#c3ccd6', '#d6f1ff', a));
  // солнце впереди
  const sx = w * 0.82,
    sy = fh * 0.2;
  ell(ctx, sx, sy, 78 * u, 78 * u, `rgba(255,236,150,${0.28 * a})`);
  ell(ctx, sx, sy, 46 * u, 46 * u, mix('#dfe3e8', '#ffe066', a), OUT, 2.4 * u);
  for (let i = 0; i < 3; i++)
    cloud(
      ctx,
      ((((w * (0.9 - i * 0.36) - t * (14 + i * 5) * u) % (w + 300 * u)) + w + 300 * u) % (w + 300 * u)) - 150 * u,
      fh * (0.13 + i * 0.07),
      (44 - i * 6) * u,
      mix('#a3adb9', '#ffffff', a),
    );
  // море вдали — показывается всё больше
  const seaY = rail - 150 * u;
  ctx.fillStyle = mix('#9fb0bf', '#3fb2ee', a);
  ctx.fillRect(w * (1 - 0.75 * a), seaY, w, rail - seaY);
  if (a > 0.5) waves(ctx, w, seaY + 6 * u, seaY + 70 * u, t, u * 0.8);
  // холмы едут мимо
  for (let layer = 0; layer < 2; layer++) {
    ctx.fillStyle = layer ? mix('#6f8f6a', '#69c06b', a) : mix('#8ea694', '#9ad88f', a);
    ctx.beginPath();
    ctx.moveTo(0, rail + 4);
    const sp = (layer ? 90 : 46) * u,
      amp = (layer ? 42 : 70) * u,
      base = rail - (layer ? 36 : 80) * u;
    for (let x = 0; x <= w + 20; x += 20)
      ctx.lineTo(x, base - Math.sin((x + t * sp) / (layer ? 150 : 230) / u) * amp * 0.5 - amp * 0.5);
    ctx.lineTo(w, rail + 4);
    ctx.closePath();
    ctx.fill();
  }
  // деревья у дороги
  for (let i = 0; i < 7; i++) {
    const span = w + 240 * u,
      x = (((((i * span) / 7 - t * 170 * u) % span) + span) % span) - 120 * u,
      y = rail - 4 * u,
      s = (0.8 + h01(i) * 0.5) * u;
    fillRR(ctx, x - 5 * s, y - 40 * s, 10 * s, 42 * s, 3, '#9a6a3c', OUT, 2 * u);
    ell(ctx, x, y - 62 * s, 30 * s, 34 * s, mix('#5f8f5a', i % 2 ? '#37b24d' : '#51cf66', a), OUT, 2.2 * u);
  }
  // насыпь и рельсы
  ctx.fillStyle = mix('#8a8f86', '#c9b58f', a);
  ctx.fillRect(0, rail, w, h - rail);
  ctx.fillStyle = mix('#6f8f6a', '#7ccf72', a);
  ctx.fillRect(0, rail + 46 * u, w, h);
  for (let x = -((t * 420 * u) % (34 * u)); x < w; x += 34 * u)
    fillRR(ctx, x, rail + 16 * u, 16 * u, 22 * u, 2, '#8d6b4a', OUT, 1.5 * u);
  line(ctx, 0, rail + 18 * u, w, rail + 18 * u, '#59606b', 5 * u);
  line(ctx, 0, rail + 34 * u, w, rail + 34 * u, '#59606b', 5 * u);
  // поезд: паровозик и два вагона, покачивается
  const k = Math.min(u * 1.15, w / (w < h * 0.8 ? 480 : 640)), // стоя — крупнее, хвост вагона может уйти за край
    tx = w * 0.5 + 150 * k,
    ty = rail + 18 * u + Math.sin(t * 9) * 1.4 * u;
  ctx.save();
  ctx.translate(tx, ty);
  ctx.scale(k, k);
  ctx.lineJoin = 'round';
  const wheel = (x, r) => {
    ell(ctx, x, -r, r, r, '#3c424b', OUT, 2.6);
    ell(ctx, x, -r, r * 0.42, r * 0.42, '#ffd43b', OUT, 1.6);
    line(ctx, x, -r, x + Math.cos(t * 10) * r * 0.8, -r + Math.sin(t * 10) * r * 0.8, '#aab2bd', 2.4);
  };
  // вагоны
  for (let i = 0; i < 2; i++) {
    const x = -150 - i * 172;
    fillRR(ctx, x - 80, -112, 160, 92, 12, i ? '#74c0fc' : '#ffd43b', OUT, 3);
    fillRR(ctx, x - 86, -120, 172, 14, 7, i ? '#1c7ed6' : '#f59f00', OUT, 2.6);
    for (let j = 0; j < 3; j++) fillRR(ctx, x - 64 + j * 46, -96, 36, 36, 6, '#e7f5ff', OUT, 2.2);
    line(ctx, x + 80, -40, x + 92, -40, OUT, 5);
    wheel(x - 48, 17);
    wheel(x + 48, 17);
    if (!i) {
      // хомячок смотрит в окно
      ctx.save();
      ctx.beginPath();
      ctx.rect(x - 16, -94, 32, 32);
      ctx.clip();
      drawPortrait(ctx, x, -76, 40, look, { time: t, dir: 1, happy: a > 0.6 });
      ctx.restore();
      fillRR(ctx, x - 18, -96, 36, 36, 6, null, OUT, 2.2);
    }
  }
  // паровозик
  fillRR(ctx, -60, -92, 132, 72, 12, '#fa5252', OUT, 3);
  fillRR(ctx, -66, -134, 70, 60, 10, '#fa5252', OUT, 3);
  fillRR(ctx, -72, -142, 82, 14, 7, '#c92a2a', OUT, 2.6);
  fillRR(ctx, -52, -122, 40, 30, 6, '#e7f5ff', OUT, 2.2);
  fillRR(ctx, 30, -122, 22, 34, 4, '#495057', OUT, 2.6);
  fillRR(ctx, 24, -130, 34, 12, 5, '#343a40', OUT, 2.4);
  ell(ctx, 74, -56, 12, 22, '#ffd43b', OUT, 2.6);
  poly(ctx, [66, -24, 96, -14, 66, -10], '#868e96', OUT, 2.4);
  wheel(-30, 22);
  wheel(34, 17);
  ctx.restore();
  // дым колечками — улетает назад
  for (let i = 0; i < 5; i++) {
    const q = (t * 0.55 + i / 5) % 1;
    ell(
      ctx,
      tx + (41 - q * 230) * k,
      ty - (140 + q * 90) * k,
      (10 + q * 22) * k,
      (9 + q * 18) * k,
      `rgba(255,255,255,${0.85 * (1 - q)})`,
    );
  }
  // чайки встречают
  if (a > 0.45) {
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2.4 * u;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const gx = w * (0.62 + i * 0.1) + Math.sin(t * 0.8 + i) * 16 * u,
        gy = fh * (0.3 + i * 0.045) + Math.cos(t * 1.1 + i) * 6 * u,
        fl = Math.sin(t * 6 + i) * 5 * u;
      ctx.beginPath();
      ctx.moveTo(gx - 13 * u, gy - fl);
      ctx.quadraticCurveTo(gx - 6 * u, gy - 8 * u, gx, gy);
      ctx.quadraticCurveTo(gx + 6 * u, gy - 8 * u, gx + 13 * u, gy - fl);
      ctx.stroke();
    }
  }
}

/** 3. Панорама Ореховой Гавани: бухта, ореховые скалы, домики, площадь с флажками, жители машут. */
const TOWN_FOLK = ['plusha', 'ponchik', 'myata', 'bob', 'zefirka'];

export function paintTown(ctx, w, h, t, look, fh) {
  const u = unit(w, fh),
    tall = fh > w * 1.15,
    shore = fh - 150 * u, // линия набережной
    hill = shore - (tall ? 170 : 150) * u;
  sky(ctx, w, h, '#4bb9ff', '#d9f3ff');
  ell(ctx, w * 0.84, fh * 0.13, 70 * u, 70 * u, 'rgba(255,236,150,.35)');
  ell(ctx, w * 0.84, fh * 0.13, 40 * u, 40 * u, '#ffe066', OUT, 2.4 * u);
  cloud(ctx, w * 0.2 + Math.sin(t * 0.15) * 18 * u, fh * 0.12, 40 * u);
  cloud(ctx, w * 0.58 + Math.cos(t * 0.12) * 22 * u, fh * 0.08, 30 * u);
  // зелёные холмы за городом
  ctx.fillStyle = '#8fd88a';
  ctx.beginPath();
  ctx.moveTo(0, shore);
  for (let x = 0; x <= w + 20; x += 20)
    ctx.lineTo(x, hill - 30 * u - Math.sin(x / (170 * u) + 1) * 34 * u - Math.sin(x / (71 * u)) * 10 * u);
  ctx.lineTo(w, shore);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#6cc76a';
  ctx.beginPath();
  ctx.moveTo(0, shore);
  for (let x = 0; x <= w + 20; x += 20) ctx.lineTo(x, hill + 26 * u - Math.sin(x / (120 * u) + 2.4) * 22 * u);
  ctx.lineTo(w, shore);
  ctx.closePath();
  ctx.fill();
  // домики в два ряда
  const WALLS = ['#fff3d6', '#ffc9de', '#d0ebff', '#d3f9d8', '#ffe8cc', '#e5dbff', '#fff0f6'],
    ROOFS = ['#f76e5c', '#e64980', '#1c7ed6', '#2f9e44', '#e8590c', '#845ef7', '#f06595'];
  const span = w * 0.62,
    x0 = w * 0.19;
  for (let row = 0; row < 2; row++) {
    const n = row ? 6 : 7;
    for (let i = 0; i < n; i++) {
      const x = x0 + ((i + (row ? 0.5 : 0)) / (row ? n : n - 1)) * span,
        y = shore - (row ? 22 : 74) * u,
        s = (row ? 1 : 0.78) * u,
        k = (i * 3 + row * 2) % 7;
      if (!row && i === 5) {
        // Хомяк-Тауэр выглядывает из-за крыш
        fillRR(ctx, x - 17 * u, y - 150 * u, 34 * u, 150 * u, 4, '#74c0fc', OUT, 2 * u);
        ctx.fillStyle = '#e7f5ff';
        for (let r = 0; r < 7; r++) ctx.fillRect(x - 11 * u, y - (140 - r * 19) * u, 22 * u, 8 * u);
        poly(ctx, [x - 17 * u, y - 150 * u, x, y - 176 * u, x + 17 * u, y - 150 * u], '#1c7ed6', OUT, 2 * u);
        continue;
      }
      house(ctx, x, y, 62 * s, 50 * s, WALLS[k], ROOFS[k]);
    }
  }
  // площадь с фонтаном и гирляндой флажков (в городке часто праздники!)
  const cx = w * 0.5,
    py = shore - 4 * u;
  ell(ctx, cx, py, 118 * u, 20 * u, '#f3dfc8', OUT, 2 * u);
  fillRR(ctx, cx - 26 * u, py - 20 * u, 52 * u, 16 * u, 6, '#a5d8ff', OUT, 2 * u);
  fillRR(ctx, cx - 5 * u, py - 40 * u, 10 * u, 24 * u, 3, '#dee2e6', OUT, 2 * u);
  for (let i = -2; i <= 2; i++) {
    const q = (t * 0.9 + i * 0.2 + 1) % 1;
    ell(ctx, cx + i * 9 * u * q * 2, py - (40 + Math.sin(q * Math.PI) * 26) * u, 3 * u, 3 * u, 'rgba(255,255,255,.9)');
  }
  const gx0 = cx - 150 * u,
    gx1 = cx + 150 * u,
    gy = shore - 96 * u;
  for (const gx of [gx0, gx1]) line(ctx, gx, shore - 6 * u, gx, gy - 6 * u, '#a8703f', 5 * u);
  ctx.strokeStyle = 'rgba(74,55,40,.7)';
  ctx.lineWidth = 1.8 * u;
  ctx.beginPath();
  ctx.moveTo(gx0, gy);
  ctx.quadraticCurveTo(cx, gy + 50 * u, gx1, gy);
  ctx.stroke();
  for (let i = 1; i < 12; i++) {
    const q = i / 12,
      fx = gx0 + (gx1 - gx0) * q,
      fy = gy + Math.sin(q * Math.PI) * 25 * u + Math.sin(t * 3 + i) * 1.5 * u;
    poly(
      ctx,
      [fx - 9 * u, fy, fx + 9 * u, fy, fx, fy + 19 * u],
      ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#da77f2'][i % 5],
      OUT,
      1.4 * u,
    );
  }
  palm(ctx, w * 0.27, shore - 2 * u, 0.82 * u, t);
  palm(ctx, w * 0.73, shore - 2 * u, 0.82 * u, t + 2);
  // набережная и пляж
  ctx.fillStyle = '#f1e2cf';
  ctx.fillRect(0, shore - 4 * u, w, 22 * u);
  line(ctx, 0, shore - 4 * u, w, shore - 4 * u, 'rgba(74,55,40,.5)', 2 * u);
  ctx.fillStyle = '#ffe3a3';
  ctx.fillRect(0, shore + 16 * u, w, 44 * u);
  // море и пирс
  const seaY = shore + 54 * u;
  const g = ctx.createLinearGradient(0, seaY, 0, h);
  g.addColorStop(0, '#7fdcf5');
  g.addColorStop(1, '#2f9be0');
  ctx.fillStyle = g;
  ctx.fillRect(0, seaY, w, h - seaY);
  ctx.fillStyle = 'rgba(255,255,255,.8)';
  ctx.beginPath();
  ctx.moveTo(0, seaY + 5 * u);
  for (let x = 0; x <= w + 16; x += 16) ctx.lineTo(x, seaY + (3 + Math.sin(x / (40 * u) + t * 1.5) * 4) * u);
  ctx.lineTo(w, seaY - 3 * u);
  ctx.lineTo(0, seaY - 3 * u);
  ctx.closePath();
  ctx.fill();
  waves(ctx, w, seaY + 20 * u, h - 8 * u, t, u);
  fillRR(ctx, cx + 150 * u, shore + 10 * u, 26 * u, 112 * u, 3, '#c98b5a', OUT, 2 * u);
  // кораблик
  const bx = w * 0.32 + Math.sin(t * 0.5) * 12 * u,
    by = seaY + 62 * u + Math.sin(t * 1.6) * 3 * u;
  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate(Math.sin(t * 1.6) * 0.04);
  poly(ctx, [-38 * u, -10 * u, 38 * u, -10 * u, 26 * u, 10 * u, -26 * u, 10 * u], '#fa5252', OUT, 2.2 * u);
  line(ctx, 0, -10 * u, 0, -66 * u, OUT, 3 * u);
  poly(ctx, [3 * u, -62 * u, 34 * u, -18 * u, 3 * u, -18 * u], '#fff', OUT, 2 * u);
  poly(ctx, [-3 * u, -54 * u, -24 * u, -18 * u, -3 * u, -18 * u], '#ffe066', OUT, 2 * u);
  ctx.restore();
  // ореховые скалы по краям бухты — по ним городок и назван
  const cw = Math.max(110 * u, w * 0.2),
    ch = (tall ? 250 : 230) * u;
  nutCliff(ctx, cw * 0.42, seaY + 26 * u, cw, ch, false);
  nutCliff(ctx, w - cw * 0.42, seaY + 26 * u, cw, ch, true);
  nutCliff(ctx, cw * 0.95, seaY + 40 * u, cw * 0.42, ch * 0.3, true);
  nutCliff(ctx, w - cw * 0.98, seaY + 44 * u, cw * 0.36, ch * 0.26, false);
  // жители машут с набережной
  const n = TOWN_FOLK.length,
    fw = Math.min(w * 0.5, 430 * u);
  TOWN_FOLK.forEach((id, i) => {
    const x = cx - fw / 2 + (i / (n - 1)) * fw,
      wave = Math.sin(t * 5 + i * 1.3) > 0;
    drawHamster(ctx, x, shore + 30 * u + (i % 2) * 8 * u, 0.86 * u, npcLook(id), {
      time: t + i,
      dir: 0,
      happy: true,
      armsUp: wave,
    });
  });
}

/** 4. Новый дом: домик у моря («Вилла растёт»: игра начинается в маленьком домике), хомячок с чемоданом у дорожки. */
export function paintVilla(ctx, w, h, t, look, fh) {
  const u = unit(w, fh),
    tall = fh > w * 1.15,
    ground = fh - 128 * u;
  sky(ctx, w, h, '#4bb9ff', '#dff5ff');
  ell(ctx, w * 0.14, fh * 0.14, 38 * u, 38 * u, '#ffe066', OUT, 2.4 * u);
  cloud(ctx, w * 0.62 + Math.sin(t * 0.14) * 20 * u, fh * 0.1, 40 * u);
  cloud(ctx, w * 0.3 + Math.cos(t * 0.1) * 16 * u, fh * 0.2, 26 * u);
  // море и ореховая скала вдали справа
  ctx.fillStyle = '#48b6f0';
  ctx.fillRect(w * 0.6, ground - 70 * u, w * 0.4, 80 * u);
  waves(ctx, w, ground - 62 * u, ground - 12 * u, t, u * 0.7);
  nutCliff(ctx, w - 50 * u, ground + 2 * u, 150 * u, 150 * u, true);
  // лужайка
  ctx.fillStyle = '#8fd88a';
  ctx.beginPath();
  ctx.moveTo(0, ground - 14 * u);
  ctx.quadraticCurveTo(w * 0.5, ground - 44 * u, w, ground - 6 * u);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#7ccf72';
  ctx.fillRect(0, ground + 60 * u, w, h);
  // домик: один этаж, двускатная красная крыша с круглым окошком, труба
  const k = Math.min(u * (tall ? 1.05 : 1.2), w / 520, (ground - 16 * u) / 250), // домик целиком: от трубы до крыльца
    vx = w * (tall ? 0.5 : 0.42),
    vy = ground + 6 * u;
  ctx.save();
  ctx.translate(vx, vy);
  ctx.scale(k, k);
  ctx.lineJoin = 'round';
  ell(ctx, 0, 4, 170, 16, 'rgba(60,90,60,.25)');
  fillRR(ctx, 50, -232, 30, 70, 4, '#e8d9c0', OUT, 2.6);
  fillRR(ctx, -150, -128, 300, 128, 8, '#fff3d6', OUT, 3.2);
  poly(ctx, [-172, -118, 0, -236, 172, -118], '#f76e5c', OUT, 3.2);
  ell(ctx, 0, -160, 20, 20, '#fff8ec', OUT, 2.6);
  ell(ctx, 0, -160, 14, 14, '#a5d8ff', OUT, 2);
  line(ctx, -14, -160, 14, -160, OUT, 1.6);
  line(ctx, 0, -174, 0, -146, OUT, 1.6);
  for (const x of [-132, 4, 82]) {
    const y = -98;
    fillRR(ctx, x, y, 44, 44, 6, '#a5d8ff', OUT, 2.4);
    line(ctx, x + 22, y, x + 22, y + 44, OUT, 1.6);
    line(ctx, x, y + 22, x + 44, y + 22, OUT, 1.6);
    fillRR(ctx, x - 4, y + 42, 52, 8, 3, '#ff8fab', OUT, 1.8);
    for (let j = 0; j < 4; j++) ell(ctx, x + 4 + j * 12, y + 40, 4, 4, ['#ff6b9d', '#ffd43b', '#fff'][j % 3]);
  }
  fillRR(ctx, -70, -74, 52, 74, 8, '#c9783c', OUT, 2.8);
  ell(ctx, -28, -36, 3.4, 3.4, '#ffd43b', OUT, 1.2);
  fillRR(ctx, -84, -6, 80, 8, 3, '#e8d9c0', OUT, 2);
  // почтовый ящик
  fillRR(ctx, 196, -34, 7, 36, 2, '#8d5524', OUT, 2);
  fillRR(ctx, 180, -58, 40, 28, 12, '#fa5252', OUT, 2.4);
  poly(ctx, [220, -70, 234, -65, 220, -60], '#ffd43b', OUT, 1.5);
  line(ctx, 220, -46, 220, -70, OUT, 2.6);
  ctx.restore();
  // дорожка от двери
  ctx.fillStyle = '#f1e2cf';
  ctx.beginPath();
  ctx.moveTo(vx - 66 * k, vy);
  ctx.lineTo(vx - 22 * k, vy);
  ctx.quadraticCurveTo(vx + 20 * k, vy + 60 * u, vx + 120 * k, h);
  ctx.lineTo(vx - 40 * k, h);
  ctx.quadraticCurveTo(vx - 40 * k, vy + 60 * u, vx - 66 * k, vy);
  ctx.closePath();
  ctx.fill();
  palm(ctx, vx - 230 * k, vy + 10 * u, 1.3 * u, t);
  palm(ctx, vx + 292 * k, vy + 16 * u, 1.1 * u, t + 1.7);
  // цветы на лужайке
  for (let i = 0; i < 14; i++) {
    const x = h01(i + 40) * w,
      y = ground + (24 + (h01(i + 80) * 0.9 * (h - ground - 30 * u)) / u) * u;
    if (Math.abs(x - (vx + 20 * k)) < 90 * k) continue;
    for (let j = 0; j < 5; j++)
      ell(
        ctx,
        x + Math.cos(j * 1.257) * 5 * u,
        y + Math.sin(j * 1.257) * 5 * u,
        3.4 * u,
        3.4 * u,
        ['#ff8fab', '#fff', '#ffd43b', '#b197fc'][i % 4],
      );
    ell(ctx, x, y, 2.6 * u, 2.6 * u, '#ffa94d');
  }
  // бабочки
  for (let i = 0; i < 3; i++) {
    const x = w * (0.2 + i * 0.3) + Math.sin(t * 0.9 + i * 2) * 40 * u,
      y = ground - 20 * u + Math.cos(t * 1.3 + i) * 26 * u,
      fl = Math.abs(Math.sin(t * 9 + i)) * 6 * u;
    ell(ctx, x - fl * 0.6, y, fl, 6 * u, ['#ff8fab', '#ffd43b', '#b197fc'][i], OUT, 1.2 * u);
    ell(ctx, x + fl * 0.6, y, fl, 6 * u, ['#ff8fab', '#ffd43b', '#b197fc'][i], OUT, 1.2 * u);
  }
  // хомячок приехала: чемодан рядом, лапки вверх
  const hx = vx + 20 * k,
    hy = Math.min(fh - 8 * u, vy + 104 * u),
    hs = 1.95 * u;
  suitcase(ctx, hx + 74 * u, hy + 2 * u, 1.3 * u);
  drawHamster(ctx, hx, hy, hs, look, { time: t, dir: 0, happy: true, armsUp: Math.sin(t * 4) > -0.2 });
  for (let i = 0; i < 3; i++) {
    const q = (t * 0.5 + i / 3) % 1;
    ctx.globalAlpha = 1 - q;
    star(ctx, hx + (i - 1) * 46 * u, hy - (150 + q * 50) * u, (5 + q * 3) * u, '#ffd43b', OUT, 1.2 * u);
    ctx.globalAlpha = 1;
  }
}
