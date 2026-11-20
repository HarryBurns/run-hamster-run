// КАРТИНКИ ПРАЗДНИЧНЫХ СЦЕНОК — что видно в окне сценки (features/holidays_scenes.js: tapScene, playScene):
// торт со свечами на день рождения (holidays_bday.js); рассада, парад, венок, тыквы и «сладость или гадость»
// (holidays_summer.js); каток, колядки, небесные фонарики и карусель (holidays_winter.js). Здесь только рисование;
// когда и что показывать, решают сами праздники. Сколько шагов у сценок (CANDLES, BLOWS, FLOWERS, CARVE, LANTERNS) —
// в data/holidays.js: это нужно и рисунку, и правилам.
import { ell, fillRR, line, star, poly } from '../core/draw.js';
import { G, playerLook } from '../core/state.js';
import { drawHamster } from '../art/hamster.js';
import { NPCS, npcLook, CANDLES, BLOWS, FLOWERS, CARVE, LANTERNS } from '../data/index.js';
import { balloon, paintMayBed, jackFace, wreathRing, skyLantern, lantern } from '../locations/holidays_art.js';
import { nightSky } from './holidays_scenes.js';
import { TAU } from '../core/util.js';

const OUT = '#4a3728';
const S = () => G.state;

// ════════ из holidays_bday.js ════════
// ---------- торт ----------
/**
 * Праздничный торт на столе дома в «Год в городе» (holidays_bday.js): cx — середина, y — столешница, s — масштаб;
 * lit — свечки горят (пока их не задули), t — время для огоньков. Тот же торт, что в сценке, только маленький.
 */
export function tableCake(ctx, cx, y, s, lit, t) {
  fillRR(ctx, cx - 70 * s, y - 6 * s, 140 * s, 8 * s, 4 * s, '#fff', OUT, 1.4); // тарелка
  fillRR(ctx, cx - 58 * s, y - 44 * s, 116 * s, 40 * s, 10 * s, '#ffc9de', OUT, 1.8);
  fillRR(ctx, cx - 40 * s, y - 76 * s, 80 * s, 34 * s, 10 * s, '#fff', OUT, 1.8);
  for (let i = 0; i < 7; i++) ell(ctx, cx - 50 * s + i * 16.6 * s, y - 44 * s, 7 * s, 5 * s, '#fff', OUT, 1);
  for (let i = 0; i < 3; i++) ell(ctx, cx - 20 * s + i * 20 * s, y - 82 * s, 5 * s, 5 * s, '#e03131', OUT, 1);
  const cols = ['#74c0fc', '#ffd43b', '#b197fc', '#69db7c', '#ff8fab', '#ffa94d'];
  for (let i = 0; i < 4; i++) {
    const x = cx - 30 * s + i * 20 * s,
      top = y - 76 * s - 24 * s;
    fillRR(ctx, x - 3.5 * s, top, 7 * s, 24 * s, 2 * s, cols[i % cols.length], OUT, 1);
    if (lit) {
      const fl = Math.sin(t * 12 + i) * 1.5 * s;
      ell(ctx, x, top - 8 * s, 7 * s, 12 * s, 'rgba(255,212,59,.35)');
      ell(ctx, x + fl * 0.3, top - 8 * s, 4 * s, 8 * s, '#ffd43b', '#e8590c', 1);
    }
  }
}
export function paintCake(ctx, w, h, n, a, t) {
  // комната: обои в горошек, гирлянда, стол
  ctx.fillStyle = '#ffe3ec';
  ctx.fillRect(0, 0, w, h);
  for (let y = 12; y < h * 0.7; y += 26)
    for (let x = (y / 26) % 2 ? 14 : 0; x < w; x += 28) ell(ctx, x, y, 3, 3, '#ffc9de');
  ctx.strokeStyle = 'rgba(74,55,40,.6)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.06);
  ctx.quadraticCurveTo(w / 2, h * 0.2, w, h * 0.06);
  ctx.stroke();
  for (let i = 1; i < 10; i++) {
    const q = i / 10;
    balloon(
      ctx,
      q * w,
      h * 0.06 + Math.sin(q * Math.PI) * h * 0.07 + 14 + Math.sin(t * 2 + i) * 2,
      8,
      ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#da77f2'][i % 5],
    );
  }
  fillRR(ctx, w * 0.08, h * 0.72, w * 0.84, 14, 5, '#f783ac', '#4a3728', 1.6);
  ctx.fillStyle = '#fff0f6';
  ctx.fillRect(w * 0.1, h * 0.72 + 14, w * 0.8, h);
  const s = Math.min(w / 380, h / 330);
  // гости за столом — машут и поют
  const looks = (S().guests.length ? S().guests : NPCS.slice(0, 3).map((q) => q.id))
    .slice(0, 3)
    .map((id) => npcLook(id));
  looks.forEach((lk, i) => {
    const x = w * (0.14 + i * 0.12) + (i === 2 ? w * 0.52 : 0);
    drawHamster(ctx, x, h * 0.72, 0.62 * s, lk, {
      time: t + i,
      dir: i === 2 ? -1 : 1,
      happy: true,
      armsUp: n >= BLOWS || Math.sin(t * 4 + i) > 0.6,
    });
  });
  // торт: два яруса, крем, вишенки, свечки
  const cx = w * 0.5,
    cy = h * 0.72;
  fillRR(ctx, cx - 70 * s, cy - 6 * s, 140 * s, 8 * s, 4, '#fff', '#4a3728', 1.4); // тарелка
  fillRR(ctx, cx - 58 * s, cy - 44 * s, 116 * s, 40 * s, 10 * s, '#ffc9de', '#4a3728', 1.8);
  fillRR(ctx, cx - 40 * s, cy - 76 * s, 80 * s, 34 * s, 10 * s, '#fff', '#4a3728', 1.8);
  for (let i = 0; i < 7; i++) ell(ctx, cx - 50 * s + i * 16.6 * s, cy - 44 * s, 7 * s, 5 * s, '#fff', '#4a3728', 1);
  for (let i = 0; i < 5; i++) ell(ctx, cx - 30 * s + i * 15 * s, cy - 76 * s, 5 * s, 4 * s, '#f783ac', '#4a3728', 1);
  for (let i = 0; i < 3; i++) ell(ctx, cx - 20 * s + i * 20 * s, cy - 82 * s, 4 * s, 4 * s, '#e03131', '#4a3728', 1);
  const out = Math.min(CANDLES, n * (CANDLES / BLOWS)); // сколько свечек уже задуто
  for (let i = 0; i < CANDLES; i++) {
    const x = cx - 32 * s + i * 12.8 * s,
      y = cy - 80 * s;
    fillRR(
      ctx,
      x - 3 * s,
      y - 22 * s,
      6 * s,
      22 * s,
      2,
      ['#74c0fc', '#ffd43b', '#b197fc', '#69db7c', '#ff8fab', '#ffa94d'][i],
      '#4a3728',
      1,
    );
    if (i >= out) {
      const fl = Math.sin(t * 12 + i) * 1.2 * s;
      ell(ctx, x, y - 28 * s, 5 * s, 9 * s, 'rgba(255,212,59,.35)');
      ell(ctx, x + fl * 0.3, y - 28 * s, 3 * s, 6 * s, '#ffd43b', '#e8590c', 1);
    } else if (i >= out - CANDLES / BLOWS && a < 1) {
      // дымок от только что задутых
      ell(
        ctx,
        x + a * 6,
        y - 30 * s - a * 26 * s,
        (3 + a * 5) * s,
        (3 + a * 5) * s,
        `rgba(173,181,189,${0.6 * (1 - a)})`,
      );
    }
  }
  // хомячок дует
  drawHamster(ctx, w * 0.5, h * 0.99, 0.82 * s, playerLook(), {
    time: t,
    dir: 0,
    happy: n >= BLOWS,
    armsUp: n >= BLOWS,
  });
  if (n > 0 && n < BLOWS && a < 1)
    for (let i = 0; i < 4; i++)
      line(
        ctx,
        w * 0.5 - 12 + i * 8,
        h * 0.82 - a * 30,
        w * 0.5 - 14 + i * 9,
        h * 0.78 - a * 46,
        `rgba(165,216,255,${1 - a})`,
        2,
      );
  if (n >= BLOWS)
    for (let i = 0; i < 26; i++) {
      const x = ((i * 0.377 + t * 0.02) % 1) * w,
        y = ((i * 0.613 + t * 0.16 * (1 + (i % 3) * 0.2)) % 1) * h * 0.7;
      if (i % 4 === 0) star(ctx, x, y, 4, '#ffd43b');
      else {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t * 3 + i);
        ctx.fillStyle = ['#ff6b6b', '#69db7c', '#4dabf7', '#da77f2'][i % 4];
        ctx.fillRect(-3, -2, 6, 4);
        ctx.restore();
      }
    }
}

// ════════ из holidays_summer.js ════════
/** Немного друзей для сценок (первые трое знакомых, а не знакомых — тоже можно: праздник для всех). */
const pals = (n = 3) =>
  NPCS.slice(0, 8)
    .filter((q) => S().friends[q.id] && S().friends[q.id].met)
    .concat(NPCS.slice(0, 8))
    .slice(0, n)
    .map((q) => npcLook(q.id));

/** Солнечное небо с травой (фон дневных сценок). */
function daySky(ctx, w, h, ground = '#8ce99a', hy = 0.62) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#74c0fc');
  g.addColorStop(hy, '#d0ebff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ell(ctx, w * 0.84, h * 0.13, 22, 22, '#ffe066', '#fab005', 2);
  ctx.fillStyle = ground;
  ctx.fillRect(0, h * hy, w, h * (1 - hy));
}

// ==================== 1 МАЯ ====================
/** Сценка «Субботник»: вскопать, посадить, полить. */
export function paintPlant(ctx, w, h, n, a, t) {
  daySky(ctx, w, h, '#8ce99a', 0.5);
  // флажки над сценкой
  ctx.strokeStyle = 'rgba(74,55,40,.6)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.08);
  ctx.quadraticCurveTo(w / 2, h * 0.2, w, h * 0.08);
  ctx.stroke();
  for (let i = 1; i < 10; i++) {
    const q = i / 10,
      x = q * w,
      y = h * 0.08 + Math.sin(q * Math.PI) * h * 0.06;
    poly(ctx, [x - 7, y, x + 7, y, x, y + 14], ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#da77f2'][i % 5], OUT, 1);
  }
  const s = Math.min(w / 220, h / 200);
  ctx.save();
  ctx.translate(w * 0.42, h * 0.74);
  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // клумба: 0 — утоптанная земля, 1 — вскопана, 2 — посажены цветы, 3 — полита (цветы распустились)
  paintMayBed(ctx, Math.min(2, n), false, n >= 3 ? 0.4 + Math.min(1, a) * 0.6 : 0.3);
  if (n === 1 && a < 1)
    for (let i = 0; i < 5; i++) ell(ctx, -30 + i * 15, -10 - Math.sin(a * Math.PI) * (16 + i * 3), 3, 2.4, '#8d5a3a');
  if (n >= 3 && a < 1)
    for (let i = 0; i < 6; i++) ell(ctx, -26 + i * 11, -40 + a * 34 + (i % 2) * 6, 2.4, 3.4, '#74c0fc');
  ctx.restore();
  // хомячок с лопаткой или лейкой
  const hx = w * 0.82,
    hy = h * 0.92;
  drawHamster(ctx, hx, hy, 0.7 * s, playerLook(), { time: t, dir: -1, happy: n >= 3, armsUp: a < 0.5 && n > 0 });
  if (n < 2) {
    line(ctx, hx - 30 * s, hy - 26 * s, hx - 46 * s, hy + 2 * s, '#8d5524', 3);
    poly(ctx, [hx - 52 * s, hy, hx - 40 * s, hy, hx - 44 * s, hy + 12 * s], '#adb5bd', OUT, 1.2);
  } else {
    fillRR(ctx, hx - 50 * s, hy - 38 * s, 22 * s, 16 * s, 4, '#4dabf7', OUT, 1.4);
    line(ctx, hx - 50 * s, hy - 32 * s, hx - 64 * s, hy - 40 * s, OUT, 3);
  }
}

/** Сценка парада: хомячок и друзья с шариками идут по площади под флажками. */
export function paintParade(ctx, w, h, k, look, t) {
  daySky(ctx, w, h, '#e9ddc9', 0.66);
  // дома-силуэты и флажки
  for (let i = 0; i < 6; i++) {
    const x = (i / 6) * w + 10;
    fillRR(
      ctx,
      x,
      h * 0.36 - (i % 3) * 14,
      w / 6 - 14,
      h * 0.3 + (i % 3) * 14,
      4,
      ['#ffe3e3', '#d0ebff', '#fff3bf', '#e5dbff', '#d3f9d8', '#ffe8cc'][i],
      OUT,
      1.4,
    );
    for (let j = 0; j < 2; j++)
      fillRR(ctx, x + 8 + j * (w / 12 - 4), h * 0.44 - (i % 3) * 14, 12, 14, 2, '#a5d8ff', OUT, 1);
  }
  ctx.strokeStyle = 'rgba(74,55,40,.6)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.1);
  ctx.quadraticCurveTo(w / 2, h * 0.24, w, h * 0.1);
  ctx.stroke();
  for (let i = 1; i < 14; i++) {
    const q = i / 14,
      x = q * w,
      y = h * 0.1 + Math.sin(q * Math.PI) * h * 0.07;
    poly(ctx, [x - 7, y, x + 7, y, x, y + 14], i % 2 ? '#e03131' : ['#ffd43b', '#69db7c', '#4dabf7'][i % 3], OUT, 1);
  }
  // идём слева направо: впереди хомячок, за ней друзья, у каждого — шарик
  const s = Math.min(w / 520, h / 300),
    base = h * 0.95,
    lead = -w * 0.15 + k * w * 1.05;
  const team = [look, ...pals(3)];
  team.forEach((lk, i) => {
    const x = lead - i * 74 * s,
      bob = Math.abs(Math.sin(t * 6 + i)) * 4 * s;
    if (x < -60 || x > w + 60) return;
    const bx = x + 16 * s,
      by = base - 150 * s + Math.sin(t * 2 + i) * 4;
    line(ctx, x + 18 * s, base - 50 * s - bob, bx, by + 22 * s, 'rgba(74,55,40,.7)', 1.4);
    balloon(ctx, bx, by, 18 * s, ['#ff6b6b', '#4dabf7', '#ffd43b', '#da77f2'][i % 4]);
    drawHamster(ctx, x, base - bob, 0.85 * s, lk, { time: t, walk: t * 1.6 + i * 0.3, dir: 1, happy: true });
  });
  // конфетти
  for (let i = 0; i < 24; i++) {
    const x = ((i * 0.377 + t * 0.03) % 1) * w,
      y = ((i * 0.613 + t * 0.12 * (1 + (i % 3) * 0.2)) % 1) * h * 0.7;
    ctx.fillStyle = ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#da77f2'][i % 5];
    ctx.fillRect(x, y, 5, 3);
  }
}

// ==================== ИВАН КУПАЛА ====================
export function paintWreath(ctx, w, h, n, a, t) {
  // вечереет: розовое небо, море, песок
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#ffc9c9');
  g.addColorStop(0.45, '#ffe8cc');
  g.addColorStop(0.46, '#4dabf7');
  g.addColorStop(0.72, '#99e9f2');
  g.addColorStop(0.73, '#ffe8a3');
  g.addColorStop(1, '#f6d58e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ell(ctx, w * 0.5, h * 0.44, 30, 14, '#ffd43b');
  for (let i = 0; i < 8; i++) {
    const y = h * (0.5 + (i % 4) * 0.05),
      x = ((i * 0.31 + t * 0.02) % 1) * w;
    line(ctx, x, y, x + 24, y, 'rgba(255,255,255,.5)', 2);
  }
  const s = Math.min(w / 380, h / 330);
  const fl = Math.min(n, FLOWERS);
  if (n <= FLOWERS) {
    // венок на песке: вплетённые цветы, последний — летит из корзинки
    wreathRing(ctx, w * 0.42, h * 0.84, 46 * s, fl, fl === n && a < 1 ? a : 1, false);
    // корзинка с цветами
    fillRR(ctx, w * 0.76, h * 0.8, 56 * s, 30 * s, 8, '#d9a066', OUT, 1.6);
    for (let i = 0; i < FLOWERS - fl; i++)
      ell(
        ctx,
        w * 0.76 + (10 + (i % 3) * 16) * s,
        h * 0.8 - (2 + Math.floor(i / 3) * 6) * s,
        7 * s,
        7 * s,
        ['#ff8fab', '#ffd43b', '#fff', '#b197fc'][i % 4],
        OUT,
        1,
      );
  } else {
    // пустили по воде: венок со свечкой уплывает к закату
    if (paintWreath.t0 == null) paintWreath.t0 = t;
    const q = Math.min(1, (t - paintWreath.t0) / 4);
    wreathRing(
      ctx,
      w * 0.42 + w * 0.08 * q,
      h * 0.8 - h * 0.26 * q + Math.sin(t * 2) * 2,
      46 * s * (1 - 0.55 * q),
      FLOWERS,
      1,
      true,
    );
  }
  drawHamster(ctx, w * 0.2, h * 0.98, 0.75 * s, playerLook(), {
    time: t,
    dir: 1,
    happy: n > FLOWERS,
    armsUp: a < 0.5 && n > 0,
  });
}

// ==================== ХЕЛЛОУИН ====================
export function paintCarve(ctx, w, h, n, a, t) {
  nightSky(ctx, w, h, t, '#2b1d4a', '#6a3d8a', false);
  ell(ctx, w * 0.16, h * 0.14, 20, 20, '#fff3bf');
  ell(ctx, w * 0.16 + 8, h * 0.12, 17, 17, '#2f2050'); // месяц
  fillRR(ctx, w * 0.06, h * 0.78, w * 0.88, 12, 4, '#8d5524', OUT, 1.6); // стол
  ctx.fillStyle = '#5c3d2e';
  ctx.fillRect(0, h * 0.78 + 12, w, h);
  const s = Math.min(w / 380, h / 330),
    lit = n >= CARVE.length;
  // большая тыква
  ctx.save();
  ctx.translate(w * 0.45, h * 0.78);
  ctx.scale(s * 1.6, s * 1.6);
  ctx.lineJoin = 'round';
  jackFace(ctx, n, lit ? 1 : 0, Math.floor(t * 6) % 2);
  ctx.restore();
  if (lit && a < 1)
    for (let i = 0; i < 8; i++)
      star(
        ctx,
        w * 0.45 + Math.cos(i) * (60 + a * 40) * s,
        h * 0.58 + Math.sin(i * 1.3) * (40 + a * 30) * s,
        4,
        '#ffd43b',
      );
  drawHamster(ctx, w * 0.85, h * 0.97, 0.7 * s, playerLook(), {
    time: t,
    dir: -1,
    happy: lit,
    armsUp: a < 0.5 && n > 0,
  });
}

/** Сценка «Сладость или гадость?»: хомячок с ведёрком-тыквой у двери, хозяин открывает и сыплет конфеты. */
export function paintTrick(ctx, w, h, k, look, t) {
  nightSky(ctx, w, h, t, '#2b1d4a', '#7048a8', false);
  ctx.fillStyle = '#3b2a5a';
  ctx.fillRect(0, h * 0.8, w, h * 0.2);
  const hx = w * 0.64,
    hy = h * 0.8;
  fillRR(ctx, hx - 90, hy - 120, 180, 120, 4, '#ffe8cc', OUT, 2);
  poly(ctx, [hx - 104, hy - 116, hx, hy - 176, hx + 104, hy - 116], '#5f3dc4', OUT, 2);
  for (const x of [hx - 60, hx + 60]) fillRR(ctx, x - 20, hy - 96, 40, 36, 4, '#ffd43b', OUT, 1.8);
  const open = Math.min(1, Math.max(0, (k - 0.45) * 4));
  fillRR(ctx, hx - 20, hy - 70, 40, 70, 6, '#ffd43b', OUT, 1.8);
  fillRR(ctx, hx - 20 + open * 26, hy - 70, 40 - open * 26, 70, 6, '#8d5524', OUT, 1.8);
  // тыква-фонарик у двери и паутинка в углу
  ctx.save();
  ctx.translate(hx + 48, hy);
  ctx.scale(0.6, 0.6);
  jackFace(ctx, CARVE.length, 1, Math.floor(t * 6) % 2);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,.6)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(hx - 90, hy - 120);
    ctx.lineTo(hx - 90 + Math.cos((i / 4) * Math.PI * 0.5) * 34, hy - 120 + Math.sin((i / 4) * Math.PI * 0.5) * 34);
    ctx.stroke();
  }
  for (const r of [12, 22, 32]) {
    ctx.beginPath();
    ctx.arc(hx - 90, hy - 120, r, 0, Math.PI / 2);
    ctx.stroke();
  }
  // хомячок с ведёрком-тыквой
  const s = Math.min(w / 520, h / 300),
    x = w * 0.26,
    y = h * 0.95,
    bob = Math.abs(Math.sin(t * 5)) * 4 * s;
  drawHamster(ctx, x, y - bob, 1.05 * s, look, { time: t, dir: 1, happy: true, armsUp: k > 0.6 });
  ctx.save();
  ctx.translate(x + 36 * s, y - 24 * s - bob);
  ctx.scale(0.42 * s, 0.42 * s);
  jackFace(ctx, CARVE.length, 0, 0);
  line(ctx, -26, -54, 26, -54, OUT, 3);
  ctx.restore();
  // конфеты летят из двери в ведёрко
  if (k > 0.55)
    for (let i = 0; i < 5; i++) {
      const q = (t * 0.9 + i / 5) % 1,
        cx = hx + (x + 36 * s - hx) * q,
        cy = hy - 50 - Math.sin(q * Math.PI) * 60;
      ell(ctx, cx, cy, 6, 4, ['#ff6b9d', '#ffd43b', '#69db7c', '#4dabf7', '#ff922b'][i], OUT, 1);
    }
}

// ════════ из holidays_winter.js ════════
/** Каток на замёрзшем пруду в парке (этап 15): хомячок и друзья в колпаках катаются по кругу. */
export function paintRink(ctx, w, h, k, look, t) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#a5d8ff');
  g.addColorStop(0.45, '#e7f5ff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // деревья в снегу и гирлянда
  for (let i = 0; i < 7; i++) {
    const x = (i / 6) * w,
      y = h * 0.4;
    poly(ctx, [x - 22, y, x, y - 56, x + 22, y], '#2b8a3e', OUT, 1.6);
    poly(ctx, [x - 12, y - 30, x, y - 56, x + 12, y - 30], '#fff', OUT, 1.2);
  }
  ctx.strokeStyle = 'rgba(74,55,40,.6)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.1);
  ctx.quadraticCurveTo(w / 2, h * 0.24, w, h * 0.1);
  ctx.stroke();
  for (let i = 1; i < 12; i++) {
    const q = i / 12,
      on = Math.floor(t * 3 + i) % 2 === 0;
    ell(
      ctx,
      q * w,
      h * 0.1 + Math.sin(q * Math.PI) * h * 0.08 + 5,
      4,
      5,
      on ? ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7'][i % 4] : '#ced4da',
      OUT,
      1,
    );
  }
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, h * 0.4, w, h * 0.6);
  // лёд и следы коньков
  ell(ctx, w / 2, h * 0.72, w * 0.46, h * 0.24, '#d0ebff', '#74c0fc', 2.4);
  ctx.strokeStyle = 'rgba(255,255,255,.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(w / 2, h * 0.72, w * 0.3, h * 0.13, 0, 0, TAU);
  ctx.stroke();
  // катаются по кругу: хомячок впереди, друзья за ней
  const s = Math.min(w / 520, h / 300),
    team = [look, ...NPCS.slice(0, 3).map((q) => npcLook(q.id, 'newyear'))],
    list = team.map((lk, i) => {
      const a = t * 1.3 - i * 0.7;
      return {
        lk,
        i,
        x: w / 2 + Math.cos(a) * w * 0.3,
        y: h * 0.74 + Math.sin(a) * h * 0.12,
        dir: -Math.sin(a) >= 0 ? 1 : -1,
      };
    });
  list.sort((p, q) => p.y - q.y);
  for (const p of list)
    drawHamster(ctx, p.x, p.y, 0.62 * s, p.lk, {
      time: t + p.i,
      dir: p.dir,
      happy: true,
      armsUp: p.i === 0 && Math.sin(t * 2) > 0.6,
    });
  for (let i = 0; i < 18; i++)
    ell(
      ctx,
      ((i * 0.377 + Math.sin(t * 0.5 + i) * 0.01) % 1) * w,
      ((i * 0.613 + t * 0.05) % 1) * h,
      1.8,
      1.8,
      'rgba(255,255,255,.9)',
    );
}

export function paintCarol(ctx, w, h, k, look, t) {
  nightSky(ctx, w, h, t);
  ctx.fillStyle = '#eef6ff';
  ctx.fillRect(0, h * 0.78, w, h * 0.22);
  // домик с дверью, венком и свечами
  const hx = w * 0.62,
    hy = h * 0.78;
  fillRR(ctx, hx - 90, hy - 120, 180, 120, 4, '#ffe8cc', OUT, 2);
  poly(ctx, [hx - 104, hy - 116, hx, hy - 176, hx + 104, hy - 116], '#c92a2a', OUT, 2);
  for (const x of [hx - 60, hx + 60]) {
    fillRR(ctx, x - 20, hy - 96, 40, 36, 4, '#ffe48a', OUT, 1.8);
    fillRR(ctx, x - 3, hy - 76, 6, 12, 2, '#fff', OUT, 1);
    ell(ctx, x, hy - 80 + Math.sin(t * 9 + x) * 0.6, 2.4, 4, '#ffa94d');
  }
  const open = Math.min(1, Math.max(0, (k - 0.55) * 4));
  fillRR(ctx, hx - 20, hy - 70, 40, 70, 6, '#ffd43b', OUT, 1.8);
  fillRR(ctx, hx - 20 + open * 26, hy - 70, 40 - open * 26, 70, 6, '#8d5524', OUT, 1.8);
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#2b8a3e';
  ctx.beginPath();
  ctx.arc(hx + open * 13, hy - 54, 9, 0, TAU);
  ctx.stroke();
  // хомячок с колядной звездой на палочке и ноты
  const s = Math.min(w / 520, h / 300),
    x = w * 0.26,
    y = h * 0.95,
    bob = Math.abs(Math.sin(t * 5)) * 5 * s;
  line(ctx, x + 22 * s, y - 50 * s - bob, x + 30 * s, y - 120 * s - bob, OUT, 3);
  star(ctx, x + 30 * s, y - 128 * s - bob, 16 * s, '#ffd43b', OUT, 2);
  ctx.save();
  ctx.translate(x + 30 * s, y - 128 * s - bob);
  ctx.rotate(t * 2);
  for (let i = 0; i < 5; i++)
    line(
      ctx,
      Math.cos((i / 5) * TAU) * 18 * s,
      Math.sin((i / 5) * TAU) * 18 * s,
      Math.cos((i / 5) * TAU) * 24 * s,
      Math.sin((i / 5) * TAU) * 24 * s,
      '#fff3bf',
      2,
    );
  ctx.restore();
  drawHamster(ctx, x, y - bob, 1.05 * s, look, { time: t, dir: 1, happy: true, armsUp: Math.sin(t * 5) > 0.3 });
  ctx.font = `${Math.round(22 * s + 6)}px sans-serif`;
  ctx.textAlign = 'center';
  for (let i = 0; i < 3; i++) {
    const ph = (t * 0.6 + i / 3) % 1;
    ctx.globalAlpha = 1 - ph;
    ctx.fillText(['🎵', '🎶', '🎵'][i], x + 40 * s + ph * w * 0.25, y - 90 * s - ph * h * 0.35);
  }
  ctx.globalAlpha = 1;
}

// ==================== КИТАЙСКИЙ НОВЫЙ ГОД ====================
export function paintLanterns(ctx, w, h, n, a, t) {
  nightSky(ctx, w, h, t, '#1a1440', '#7a3a5a');
  // море и луна
  ell(ctx, w * 0.8, h * 0.16, 18, 18, '#fff3bf');
  ctx.fillStyle = '#2b3f7a';
  ctx.fillRect(0, h * 0.62, w, h * 0.38);
  for (let i = 0; i < 6; i++)
    line(
      ctx,
      w * (0.1 + i * 0.15),
      h * (0.66 + (i % 3) * 0.08),
      w * (0.18 + i * 0.15),
      h * (0.66 + (i % 3) * 0.08),
      'rgba(255,255,255,.25)',
      2,
    );
  ctx.fillStyle = '#e9c48e';
  ctx.fillRect(0, h * 0.82, w, h * 0.18);
  // красные фонарики на верёвке сверху
  ctx.strokeStyle = 'rgba(255,255,255,.4)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.06);
  ctx.quadraticCurveTo(w / 2, h * 0.2, w, h * 0.06);
  ctx.stroke();
  for (let i = 1; i < 6; i++) lantern(ctx, (i / 6) * w, h * 0.06 + Math.sin((i / 6) * Math.PI) * h * 0.07, 0.8, i);
  const s = Math.min(w / 380, h / 330);
  for (let i = 0; i < LANTERNS; i++) {
    const bx = w * (0.18 + i * 0.2),
      by = h * 0.86;
    if (i < n) {
      const q = i === n - 1 ? a : 1,
        up = (i === n - 1 ? a * 0.6 : 0.6 + ((t * 0.04 + i * 0.1) % 0.3)) * h,
        x = bx + Math.sin(t * 1.3 + i) * 10 * q;
      skyLantern(ctx, x, by - 26 * s - up, 1.9 * s, true);
    } else skyLantern(ctx, bx, by - 26 * s, 1.9 * s, false);
  }
  drawHamster(ctx, w * 0.82, h * 0.97, 0.8 * s, playerLook(), {
    time: t,
    dir: -1,
    happy: n > 0,
    armsUp: a < 0.5 && n > 0,
  });
}

// ==================== МАСЛЕНИЦА ====================
export function paintCarousel(ctx, w, h, k, look, t) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#a5d8ff');
  g.addColorStop(1, '#e7f5ff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, h * 0.78, w, h * 0.22);
  const cx = w / 2,
    cy = h * 0.74,
    R = w * 0.32,
    s = Math.min(w / 520, h / 300);
  // крыша
  for (let i = 0; i < 10; i++) {
    const a0 = Math.PI + (i / 10) * Math.PI,
      a1 = Math.PI + ((i + 1) / 10) * Math.PI;
    poly(
      ctx,
      [cx, h * 0.06, cx + Math.cos(a0) * R * 1.1, h * 0.3, cx + Math.cos(a1) * R * 1.1, h * 0.3],
      i % 2 ? '#fff' : '#e03131',
      OUT,
      1.6,
    );
  }
  line(ctx, cx, h * 0.3, cx, cy, OUT, 6);
  line(ctx, cx, h * 0.3, cx, cy, '#ffd43b', 3);
  ell(ctx, cx, cy, R * 1.1, 16 * s + 6, '#e9c48e', OUT, 2);
  // лошадки и хомячок на одной из них
  const list = [0, 1, 2, 3, 4].map((i) => {
    const a = (i / 5) * TAU + t * 1.6;
    return { i, x: cx + Math.cos(a) * R, y: cy - 30 * s + Math.sin(a) * 12 * s, d: Math.sin(a) };
  });
  list.sort((p, q) => p.d - q.d);
  for (const p of list) {
    const up = Math.sin(t * 4 + p.i) * 6 * s;
    line(ctx, p.x, h * 0.3, p.x, p.y + up, '#adb5bd', 2);
    // лошадка: туловище, шея с головой и ушками, ножки
    const col = ['#fff', '#ffc9de', '#a5d8ff', '#ffe066', '#d3f9d8'][p.i],
      hd = p.d > 0 ? 1 : -1,
      by = p.y + up;
    for (const lx of [-14, 14]) line(ctx, p.x + lx * s, by + 6 * s, p.x + (lx - 4) * s, by + 18 * s, OUT, 2.4);
    fillRR(ctx, p.x - 22 * s, by - 8 * s, 44 * s, 18 * s, 8 * s, col, OUT, 1.6);
    fillRR(ctx, p.x + hd * 14 * s - 5 * s, by - 26 * s, 10 * s, 22 * s, 4 * s, col, OUT, 1.4);
    ell(ctx, p.x + hd * 22 * s, by - 24 * s, 10 * s, 6 * s, col, OUT, 1.4);
    poly(
      ctx,
      [p.x + hd * 12 * s, by - 30 * s, p.x + hd * 15 * s, by - 38 * s, p.x + hd * 18 * s, by - 29 * s],
      col,
      OUT,
      1.1,
    );
    ell(ctx, p.x + hd * 24 * s, by - 26 * s, 1.4 * s, 1.4 * s, OUT);
    fillRR(ctx, p.x + hd * 6 * s - 7 * s, by - 14 * s, 6 * s, 14 * s, 2 * s, '#e03131', OUT, 1); // грива
    if (p.i === 0)
      drawHamster(ctx, p.x, p.y - 2 * s + up, 0.7 * s, look, { time: t, dir: 1, happy: true, armsUp: true });
  }
}
