// РИСОВАНИЕ живой заставки (features/title_scene.js): небо, море и песок (кэш bg), волны, облака, пальмы, кораблик,
// дельфин, рыбки, крабик, чайка, ракушка, снеговик, воздушный змей, рисунок на песке, хомячок, бабочка и светлячки,
// погода, ночное небо. Здесь только рисование: что где находится и что происходит, решает title_scene.js
// (layout, update, down) — оттуда приходит S, состояние заставки. Порядок слоёв кадра — frame() там же.
import { TAU, clamp, lerp, seeded } from '../core/util.js';
import { mix, shade } from '../core/draw.js';
import { drawHamster, blinkAt } from '../art/hamster.js';
import { paintDolphin } from '../locations/cove_art.js';

// Облако — восемь «комков»; фигуры (зайчик, рыбка, хомячок) — те же восемь комков на других местах
const CLOUD_SHAPES = {
  cloud: { puffs: [[-1.4, 0.2, 0.7], [-0.6, -0.2, 0.9], [0.3, -0.35, 1], [1.1, 0, 0.8], [1.7, 0.3, 0.55], [0, 0.3, 0.9], [-0.9, 0.35, 0.7], [0.8, 0.35, 0.7]], eyes: [] }, // prettier-ignore
  bunny: { puffs: [[0.2, 0.3, 1], [-1, -0.3, 0.7], [-1.25, -1.2, 0.32], [-1.2, -1.7, 0.28], [-0.8, -1.25, 0.3], [-0.68, -1.75, 0.27], [1.3, 0.3, 0.42], [-0.5, 0.9, 0.42]], eyes: [[-1.2, -0.4]] }, // prettier-ignore
  fish: { puffs: [[-0.5, 0, 0.9], [0.3, 0, 0.85], [-1.2, 0, 0.55], [0.95, 0, 0.5], [1.65, -0.5, 0.5], [1.65, 0.5, 0.5], [-0.2, -0.85, 0.4], [1.3, 0, 0.3]], eyes: [[-1.25, -0.12]] }, // prettier-ignore
  hamster: { puffs: [[0, 0.5, 1.05], [0, -0.6, 0.85], [-0.65, -1.3, 0.35], [0.65, -1.3, 0.35], [-0.75, -0.35, 0.5], [0.75, -0.35, 0.5], [-0.8, 1.2, 0.35], [0.8, 1.2, 0.35]], eyes: [[-0.3, -0.75], [0.3, -0.75]] }, // prettier-ignore
};
export const CLOUD_ORDER = ['cloud', 'bunny', 'fish', 'hamster'];
export const ease = (t) => t * t * (3 - 2 * t);
const bell = (t) => Math.sin(clamp(t, 0, 1) * Math.PI);

/**
 * Функции рисования заставки. S — состояние заставки из createTitleScene: размеры экрана и кадра (W, H, F, hy, sy,
 * bot, k, dpr), время T, кэш неба и моря bg, кто где сейчас (ham, crab, gull, shell, ship, dolphin, fly, kite,
 * snowman, star, stars, drops, jumps, rings, strokes, feathers), погода и время суток (rain, snow, windy, winter,
 * night, dk, dusk), внешность хомячка look и общие расчёты (shoreY, sway, crown, hamTop, kitePos).
 */
export function createTitleArt(S) {
  // ---------- то, что не движется: небо, море, песок ----------
  function paintBg() {
    S.bg = document.createElement('canvas');
    S.bg.width = S.canvas.width;
    S.bg.height = S.canvas.height;
    const c = S.bg.getContext('2d');
    c.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    const grey = S.rain ? 0.55 : S.snow ? 0.35 : 0;
    const top = mix(mix('#4fb4ff', '#5a78c8', S.dusk * 0.8), '#8fa0b4', grey),
      low = mix(mix('#cdeeff', '#ffb27a', S.dusk), '#c9d3de', grey);
    let g = c.createLinearGradient(0, 0, 0, S.hy);
    g.addColorStop(0, top);
    g.addColorStop(1, low);
    c.fillStyle = g;
    c.fillRect(0, 0, S.W, S.hy + 1);
    // солнце (ночью луну рисуем поверх затемнения — см. frame)
    if (S.dk < 0.45 && !S.rain && !S.snow) {
      const sx = S.F.x + S.F.w * 0.66,
        syy = lerp(S.F.y + 34 * S.k, S.hy - 26 * S.k, S.dusk);
      const gl = c.createRadialGradient(sx, syy, 4, sx, syy, 110 * S.k);
      gl.addColorStop(0, 'rgba(255,244,200,.85)');
      gl.addColorStop(1, 'rgba(255,244,200,0)');
      c.fillStyle = gl;
      c.fillRect(sx - 120 * S.k, syy - 120 * S.k, 240 * S.k, 240 * S.k);
      c.fillStyle = mix('#fff3b0', '#ff9d5c', S.dusk);
      c.beginPath();
      c.arc(sx, syy, 26 * S.k, 0, TAU);
      c.fill();
    }
    // далёкий остров на горизонте
    c.fillStyle = mix(mix('#7fb7c9', '#8d7fb0', S.dusk), '#9aa6b5', grey);
    c.beginPath();
    c.moveTo(S.F.x + S.F.w * 0.02, S.hy + 1);
    c.quadraticCurveTo(S.F.x + S.F.w * 0.1, S.hy - 30 * S.k, S.F.x + S.F.w * 0.19, S.hy - 10 * S.k);
    c.quadraticCurveTo(S.F.x + S.F.w * 0.25, S.hy - 22 * S.k, S.F.x + S.F.w * 0.33, S.hy + 1);
    c.fill();
    // море
    g = c.createLinearGradient(0, S.hy, 0, S.sy + 30 * S.k);
    g.addColorStop(0, mix(mix('#2f8fd8', '#4a6fb5', S.dusk * 0.7), '#6c8296', grey));
    g.addColorStop(1, mix(mix('#7fe3e2', '#f3b89a', S.dusk * 0.5), '#a9bcc4', grey));
    c.fillStyle = g;
    c.fillRect(0, S.hy, S.W, S.sy + 40 * S.k - S.hy);
    // песок (верхний край закрывает волна, поэтому начинаем чуть выше кромки)
    g = c.createLinearGradient(0, S.sy - 20 * S.k, 0, S.H);
    const s0 = mix(S.winter ? '#fff1cf' : '#ffe6a8', '#e9dcc3', grey * 0.6),
      s1 = mix(S.winter ? '#f3deb4' : '#f4c97c', '#d9c8a8', grey * 0.6);
    g.addColorStop(0, s0);
    g.addColorStop(1, s1);
    c.fillStyle = g;
    c.fillRect(0, S.sy - 20 * S.k, S.W, S.H - S.sy + 20 * S.k);
    const rs = seeded(11);
    for (let i = 0; i < (S.W * (S.H - S.sy)) / 900; i++) {
      c.fillStyle = rs() < 0.5 ? 'rgba(255,255,255,.35)' : 'rgba(190,140,70,.25)';
      c.fillRect(rs() * S.W, S.sy + 8 * S.k + rs() * (S.H - S.sy), 2, 2);
    }
    if (S.winter) {
      // зимой на песке лежит снежок
      c.fillStyle = 'rgba(255,255,255,.75)';
      for (let i = 0; i < 9; i++) {
        c.beginPath();
        c.ellipse(rs() * S.W, S.sy + (0.25 + rs() * 0.75) * (S.H - S.sy), (40 + rs() * 60) * S.k, (7 + rs() * 8) * S.k, 0, 0, TAU);
        c.fill();
      }
    }
    // норка краба
    c.fillStyle = 'rgba(120,80,40,.55)';
    c.beginPath();
    c.ellipse(S.crab.hx, S.crab.hy, 17 * S.k, 7 * S.k, 0, 0, TAU);
    c.fill();
  }
  // ---------- рисование ----------
  const circle = (x, y, r, fill) => {
    S.ctx.fillStyle = fill;
    S.ctx.beginPath();
    S.ctx.arc(x, y, r, 0, TAU);
    S.ctx.fill();
  };
  function label(x, y, str, size, alpha = 1) {
    S.ctx.save();
    S.ctx.globalAlpha = alpha;
    S.ctx.font = `900 ${size}px Nunito, "Trebuchet MS", sans-serif`;
    const w = S.ctx.measureText(str).width + size * 1.1,
      h = size * 1.7;
    x = clamp(x, w / 2 + 6, S.W - w / 2 - 6);
    S.ctx.fillStyle = 'rgba(255,255,255,.94)';
    S.ctx.beginPath();
    S.ctx.roundRect ? S.ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2) : S.ctx.rect(x - w / 2, y - h / 2, w, h);
    S.ctx.fill();
    S.ctx.fillStyle = '#5b3a29';
    S.ctx.textAlign = 'center';
    S.ctx.textBaseline = 'middle';
    S.ctx.fillText(str, x, y + 1);
    S.ctx.restore();
  }
  function drawSea(sg) {
    // блики-волны на воде: ближе к берегу крупнее
    S.ctx.lineCap = 'round';
    for (let r = 0; r < 6; r++) {
      const q = (r + 0.5) / 6,
        y = lerp(S.hy + 6 * S.k, S.sy - 14 * S.k, q * q * 0.6 + q * 0.4),
        len = lerp(14, 60, q) * S.k;
      S.ctx.strokeStyle = `rgba(255,255,255,${lerp(0.25, 0.5, q)})`;
      S.ctx.lineWidth = lerp(1.2, 3, q) * S.k;
      S.ctx.beginPath();
      const step = lerp(70, 190, q) * S.k,
        off = ((S.T * lerp(4, 16, q) * (r % 2 ? 1 : -1) * S.k) % step) + r * 37;
      for (let x = -step + (off % step); x < S.W + step; x += step) {
        const yy = y + Math.sin(S.T * 1.4 + x * 0.02 + r) * 2.5 * S.k;
        S.ctx.moveTo(x, yy);
        S.ctx.quadraticCurveTo(x + len / 2, yy - 4 * S.k * q, x + len, yy);
      }
      S.ctx.stroke();
    }
    // круги от рыбок
    for (const g of S.rings) {
      const q = g.t / 1.6,
        sc = clamp((g.y - S.hy) / (S.sy - S.hy), 0.3, 1);
      S.ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - q)})`;
      S.ctx.lineWidth = 2 * S.k;
      for (const m2 of [1, 0.55]) {
        S.ctx.beginPath();
        S.ctx.ellipse(g.x, g.y, (8 + q * 46) * S.k * sc * m2, (3 + q * 13) * S.k * sc * m2, 0, 0, TAU);
        S.ctx.stroke();
      }
    }
    // мокрый песок и пена
    const step = 16;
    const path = (dy) => {
      S.ctx.beginPath();
      S.ctx.moveTo(-10, S.sy - 30 * S.k);
      for (let x = -10; x <= S.W + step; x += step) S.ctx.lineTo(x, S.shoreY(x, sg) + dy);
      S.ctx.lineTo(S.W + 10, S.sy - 30 * S.k);
      S.ctx.closePath();
    };
    path(13 * S.k + sg * 0.12);
    S.ctx.fillStyle = 'rgba(176,128,70,.28)';
    S.ctx.fill();
    path(5 * S.k);
    S.ctx.fillStyle = 'rgba(255,255,255,.92)';
    S.ctx.fill();
    path(0);
    const g = S.ctx.createLinearGradient(0, S.sy - 30 * S.k, 0, S.sy + 20 * S.k + sg);
    g.addColorStop(0, 'rgba(120,222,226,0)');
    g.addColorStop(0.35, S.rain || S.snow ? '#a9c3cb' : S.dusk > 0.4 ? '#f0c3a6' : '#8fe6e4');
    g.addColorStop(1, S.rain || S.snow ? '#bcd2d8' : '#b5f1ee');
    S.ctx.fillStyle = g;
    S.ctx.fill();
  }
  function drawFish() {
    for (const j of S.jumps) {
      const q = j.t / 0.9,
        sc = S.k * j.s,
        x = j.x + j.dir * 46 * sc * q,
        y = j.y - Math.sin(q * Math.PI) * 54 * sc;
      S.ctx.save();
      S.ctx.translate(x, y);
      S.ctx.rotate(j.dir * lerp(-0.9, 0.9, q));
      S.ctx.scale(j.dir * sc, sc);
      S.ctx.fillStyle = '#ff9f43';
      S.ctx.beginPath();
      S.ctx.ellipse(0, 0, 13, 7, 0, 0, TAU);
      S.ctx.fill();
      S.ctx.beginPath();
      S.ctx.moveTo(-11, 0);
      S.ctx.lineTo(-21, -7);
      S.ctx.lineTo(-21, 7);
      S.ctx.fill();
      S.ctx.fillStyle = '#fff';
      S.ctx.fillRect(-1, -6, 3, 12);
      circle(7, -2, 1.6, '#333');
      S.ctx.restore();
    }
    if (S.dolphin.t >= 0) {
      const q = S.dolphin.t / 1.5,
        x = S.dolphin.x + q * 50 * S.k,
        y = S.hy + 16 * S.k - Math.sin(q * Math.PI) * 30 * S.k;
      S.ctx.save();
      S.ctx.beginPath();
      S.ctx.rect(0, 0, S.W, S.hy + 17 * S.k);
      S.ctx.clip();
      S.ctx.translate(x, y);
      S.ctx.scale(S.k * 0.55, S.k * 0.55);
      paintDolphin(S.ctx, 3 + lerp(-0.8, 0.8, q) / 0.3, 0); // добрый дельфин, как в море (В1)
      S.ctx.restore();
    }
  }
  function drawShip() {
    const x = S.ship.x,
      y = S.hy + Math.sin(S.T * 1.2) * 1.2 * S.k,
      u = S.k * 0.9;
    for (const p of S.ship.puffs) circle(p.x - p.t * 9 * S.k, p.y - p.t * 16 * S.k, (4 + p.t * 5) * S.k, `rgba(255,255,255,${0.7 * (1 - p.t / 2)})`); // prettier-ignore
    S.ctx.save();
    S.ctx.translate(x, y);
    S.ctx.scale(u, u);
    S.ctx.fillStyle = '#e8590c';
    S.ctx.beginPath();
    S.ctx.moveTo(-22, -9);
    S.ctx.lineTo(24, -9);
    S.ctx.lineTo(17, 1);
    S.ctx.lineTo(-17, 1);
    S.ctx.fill();
    S.ctx.fillStyle = '#fff';
    S.ctx.fillRect(-11, -19, 19, 10);
    S.ctx.fillStyle = '#343a40';
    S.ctx.fillRect(-4, -31, 7, 12);
    S.ctx.fillStyle = '#ffd43b';
    S.ctx.fillRect(-4, -27, 7, 3);
    S.ctx.fillStyle = '#4dabf7';
    for (const wx of [-8, -2, 4]) S.ctx.fillRect(wx, -16, 3, 3);
    S.ctx.restore();
  }
  function drawCloud(c) {
    const a = CLOUD_SHAPES[CLOUD_ORDER[c.from]],
      b = CLOUD_SHAPES[CLOUD_ORDER[c.shape]],
      q = ease(c.t),
      u = 34 * S.k * c.size;
    const col = S.rain ? '#8d99a8' : S.snow ? '#e3e9f0' : mix('#ffffff', '#ffd9c2', S.dusk * 0.6);
    S.ctx.fillStyle = col;
    S.ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const x = c.x + lerp(a.puffs[i][0], b.puffs[i][0], q) * u,
        y = c.y + lerp(a.puffs[i][1], b.puffs[i][1], q) * u,
        r = lerp(a.puffs[i][2], b.puffs[i][2], q) * u;
      S.ctx.moveTo(x + r, y);
      S.ctx.arc(x, y, r, 0, TAU);
    }
    S.ctx.fill();
    if (c.t > 0.7) for (const e of b.eyes) circle(c.x + e[0] * u, c.y + e[1] * u, 0.09 * u, shade(col, -0.35));
  }
  function drawPalm(p) {
    const [cx, cy] = S.crown(p);
    const b = p.bend + S.sway(p);
    // ствол
    S.ctx.lineCap = 'round';
    const mx = lerp(p.x, cx, 0.35) - b * p.h * 0.1,
      my = p.y - p.h * 0.55;
    for (const [col, lw] of [
      ['#8a5a2b', 20],
      ['#b07a3f', 13],
    ]) {
      // prettier-ignore
      S.ctx.strokeStyle = col;
      S.ctx.lineWidth = lw * S.k * p.size;
      S.ctx.beginPath();
      S.ctx.moveTo(p.x, p.y);
      S.ctx.quadraticCurveTo(mx, my, cx, cy);
      S.ctx.stroke();
    }
    S.ctx.strokeStyle = 'rgba(90,55,20,.5)';
    S.ctx.lineWidth = 2 * S.k;
    for (let i = 1; i < 8; i++) {
      const q = i / 8,
        x = (1 - q) * (1 - q) * p.x + 2 * q * (1 - q) * mx + q * q * cx,
        y = (1 - q) * (1 - q) * p.y + 2 * q * (1 - q) * my + q * q * cy;
      S.ctx.beginPath();
      S.ctx.moveTo(x - 8 * S.k * p.size, y + 2 * S.k);
      S.ctx.lineTo(x + 8 * S.k * p.size, y - 2 * S.k);
      S.ctx.stroke();
    }
    // листья
    const L = p.h * 0.42;
    for (let i = 0; i < 7; i++) {
      const base = -Math.PI / 2 + (i - 3) * 0.62,
        a = base + b * 0.9 + Math.sin(S.T * (S.windy ? 3 : 1.4) + i * 1.3 + p.fx * 5) * (S.windy ? 0.12 : 0.04),
        droop = 0.5 + Math.abs(i - 3) * 0.16;
      const ex = cx + Math.cos(a) * L,
        ey = cy + Math.sin(a) * L + droop * L * 0.5,
        qx = cx + Math.cos(a) * L * 0.6,
        qy = cy + Math.sin(a) * L * 0.6 - L * 0.12;
      S.ctx.fillStyle = i % 2 ? '#2f9e44' : '#40c057';
      S.ctx.beginPath();
      S.ctx.moveTo(cx, cy);
      S.ctx.quadraticCurveTo(qx - Math.sin(a) * L * 0.2, qy + Math.cos(a) * L * 0.2, ex, ey);
      S.ctx.quadraticCurveTo(qx + Math.sin(a) * L * 0.16, qy - Math.cos(a) * L * 0.16, cx, cy);
      S.ctx.fill();
    }
    if (S.winter) {
      S.ctx.fillStyle = 'rgba(255,255,255,.85)';
      S.ctx.beginPath();
      S.ctx.ellipse(cx, cy - L * 0.16, L * 0.42, L * 0.1, 0, 0, TAU);
      S.ctx.fill();
    }
    // кокосы
    p.nuts.forEach((n, i) => {
      if (n) circle(cx + (i - 1) * 12 * S.k, cy + 9 * S.k + (i === 1 ? 5 * S.k : 0), 8.5 * S.k, '#6b4423');
    });
  }
  function drawNut(n) {
    S.ctx.save();
    S.ctx.translate(n.x, n.y - 9 * S.k);
    S.ctx.fillStyle = 'rgba(0,0,0,.14)';
    S.ctx.beginPath();
    S.ctx.ellipse(0, n.floor - n.y + 9 * S.k, 10 * S.k, 3 * S.k, 0, 0, TAU);
    S.ctx.fill();
    S.ctx.rotate(n.rot);
    circle(0, 0, 9.5 * S.k, '#6b4423');
    for (const [dx, dy] of [[-3, -2], [3, -2], [0, 3]]) circle(dx * S.k, dy * S.k, 1.5 * S.k, '#3b2412'); // prettier-ignore
    S.ctx.restore();
  }
  function drawCrab() {
    if (S.crab.st === 'in') {
      // выглядывает из норки: сначала никого, потом два глаза
      const q = clamp((S.crab.t - 2.2) / 0.6, 0, 1);
      if (q > 0)
        for (const dx of [-5, 5]) {
          S.ctx.strokeStyle = '#e03131';
          S.ctx.lineWidth = 2.4 * S.k;
          S.ctx.beginPath();
          S.ctx.moveTo(S.crab.hx + dx * S.k, S.crab.hy);
          S.ctx.lineTo(S.crab.hx + dx * S.k, S.crab.hy - 11 * S.k * q);
          S.ctx.stroke();
          circle(S.crab.hx + dx * S.k, S.crab.hy - 12 * S.k * q, 3.2 * S.k, '#fff');
          circle(S.crab.hx + dx * S.k + Math.sin(S.T * 2) * S.k, S.crab.hy - 12 * S.k * q, 1.5 * S.k, '#222');
        }
      return;
    }
    const run = S.crab.st === 'flee',
      w = Math.sin(S.T * (run ? 30 : 9));
    const moving = run || S.crab.t > 1.2;
    S.ctx.save();
    S.ctx.translate(S.crab.x, S.crab.y - 8 * S.k);
    S.ctx.scale(S.k, S.k);
    S.ctx.fillStyle = 'rgba(0,0,0,.13)';
    S.ctx.beginPath();
    S.ctx.ellipse(0, 9, 17, 4, 0, 0, TAU);
    S.ctx.fill();
    S.ctx.strokeStyle = '#c92a2a';
    S.ctx.lineWidth = 2.6;
    S.ctx.lineCap = 'round';
    for (const sd of [-1, 1])
      for (let i = 0; i < 3; i++) {
        const lift = moving ? Math.sin(S.T * (run ? 30 : 9) + i * 2 + sd) * 2.5 : 0;
        S.ctx.beginPath();
        S.ctx.moveTo(sd * 9, 2 + i * 1.5);
        S.ctx.lineTo(sd * (17 + i), 7 + lift);
        S.ctx.stroke();
      }
    S.ctx.fillStyle = '#f03e3e';
    S.ctx.beginPath();
    S.ctx.ellipse(0, 0, 13, 9, 0, 0, TAU);
    S.ctx.fill();
    for (const sd of [-1, 1]) {
      S.ctx.beginPath();
      S.ctx.ellipse(sd * 16, -7 + (moving ? w * sd : 0), 5.5, 4, sd * 0.5, 0, TAU);
      S.ctx.fill();
      S.ctx.strokeStyle = '#f03e3e';
      S.ctx.beginPath();
      S.ctx.moveTo(sd * 4, -7);
      S.ctx.lineTo(sd * 4.5, -13);
      S.ctx.stroke();
      circle(sd * 4.5, -14, 3, '#fff');
      circle(sd * 4.5 + S.crab.dir * 0.8, -14, 1.4, '#222');
    }
    S.ctx.restore();
  }
  function drawGull() {
    const flying = S.gull.st !== 'stand';
    S.ctx.save();
    S.ctx.translate(S.gull.x, S.gull.y);
    S.ctx.scale(S.k, S.k);
    if (!flying) {
      S.ctx.fillStyle = 'rgba(0,0,0,.13)';
      S.ctx.beginPath();
      S.ctx.ellipse(0, 1, 13, 3.5, 0, 0, TAU);
      S.ctx.fill();
      S.ctx.strokeStyle = '#f08c00';
      S.ctx.lineWidth = 2;
      for (const dx of [-3, 3]) {
        S.ctx.beginPath();
        S.ctx.moveTo(dx, -8);
        S.ctx.lineTo(dx, 0);
        S.ctx.stroke();
      }
    }
    const bob = flying ? 0 : Math.sin(S.T * 2.2) * 0.8;
    S.ctx.translate(0, -17 + bob);
    S.ctx.fillStyle = '#fff';
    S.ctx.beginPath();
    S.ctx.ellipse(0, 0, 13, 9, -0.15, 0, TAU);
    S.ctx.fill();
    circle(10, -9, 6.5, '#fff');
    S.ctx.fillStyle = '#f08c00';
    S.ctx.beginPath();
    S.ctx.moveTo(15, -10);
    S.ctx.lineTo(24, -7.5);
    S.ctx.lineTo(15, -6);
    S.ctx.fill();
    circle(11.5, -10.5, 1.3, '#222');
    S.ctx.fillStyle = '#adb5bd';
    if (flying) {
      const fl = Math.sin(S.T * 14) * 12;
      S.ctx.beginPath();
      S.ctx.moveTo(-6, -2);
      S.ctx.quadraticCurveTo(-10, -18 - fl, -26, -12 - fl * 1.5);
      S.ctx.quadraticCurveTo(-12, -4, 4, -1);
      S.ctx.fill();
    } else {
      S.ctx.beginPath();
      S.ctx.ellipse(-3, 0, 10, 5.5, -0.25, 0, TAU);
      S.ctx.fill();
    }
    S.ctx.restore();
    for (const f of S.feathers) {
      S.ctx.save();
      S.ctx.globalAlpha = clamp(10 - f.t, 0, 1);
      S.ctx.translate(f.x, f.y);
      S.ctx.rotate(f.y < f.floor ? Math.sin(f.t * 3) * 0.7 : 0.3);
      S.ctx.fillStyle = '#fff';
      S.ctx.strokeStyle = '#ced4da';
      S.ctx.lineWidth = 1;
      S.ctx.beginPath();
      S.ctx.ellipse(0, 0, 9 * S.k, 3 * S.k, 0, 0, TAU);
      S.ctx.fill();
      S.ctx.stroke();
      S.ctx.restore();
    }
  }
  function shellAt() {
    const ear = [S.ham.x - 25 * S.ham.s, S.ham.y - 52 * S.ham.s];
    const band = S.bot - S.sy,
      home = [S.F.x + S.F.w * 0.27, S.sy + band * 0.84];
    if (S.shell.st === 'go') return [lerp(home[0], ear[0], ease(S.shell.t / 0.5)), lerp(home[1], ear[1], ease(S.shell.t / 0.5)) - bell(S.shell.t / 0.5) * 40 * S.k]; // prettier-ignore
    if (S.shell.st === 'ear') return ear;
    if (S.shell.st === 'back') return [lerp(ear[0], home[0], ease(S.shell.t / 0.5)), lerp(ear[1], home[1], ease(S.shell.t / 0.5)) - bell(S.shell.t / 0.5) * 40 * S.k]; // prettier-ignore
    return home;
  }
  function drawShell() {
    const [x, y] = shellAt();
    S.shell.x = x;
    S.shell.y = y;
    S.ctx.save();
    S.ctx.translate(x, y - 7 * S.k);
    S.ctx.scale(S.k, S.k);
    S.ctx.fillStyle = '#ffd8e4';
    S.ctx.strokeStyle = '#e599b0';
    S.ctx.lineWidth = 1.6;
    S.ctx.beginPath();
    S.ctx.moveTo(0, 8);
    S.ctx.bezierCurveTo(-17, 6, -15, -12, 0, -12);
    S.ctx.bezierCurveTo(15, -12, 17, 6, 0, 8);
    S.ctx.fill();
    S.ctx.stroke();
    for (const a of [-0.7, -0.35, 0, 0.35, 0.7]) {
      S.ctx.beginPath();
      S.ctx.moveTo(0, 7);
      S.ctx.lineTo(Math.sin(a) * 15, 7 - Math.cos(a) * 18);
      S.ctx.stroke();
    }
    S.ctx.restore();
    if (S.shell.st === 'ear') {
      // «шум моря»: волнистые чёрточки у уха
      S.ctx.strokeStyle = 'rgba(77,171,247,.9)';
      S.ctx.lineWidth = 2.5 * S.k;
      for (let i = 0; i < 3; i++) {
        const q = (S.shell.t * 0.9 + i / 3) % 1;
        S.ctx.globalAlpha = 1 - q;
        S.ctx.beginPath();
        S.ctx.arc(x - 6 * S.k, y - 8 * S.k, (10 + q * 26) * S.k, Math.PI * 0.75, Math.PI * 1.25);
        S.ctx.stroke();
      }
      S.ctx.globalAlpha = 1;
    }
  }
  function drawSnowman() {
    const q = clamp((S.T - S.snowman.t) / 1.2, 0, 1),
      wob = Math.sin(q * TAU * 2) * (1 - q) * 0.16;
    S.ctx.save();
    S.ctx.translate(S.snowman.x, S.snowman.y);
    S.ctx.fillStyle = 'rgba(0,0,0,.12)';
    S.ctx.beginPath();
    S.ctx.ellipse(0, 0, 26 * S.k, 6 * S.k, 0, 0, TAU);
    S.ctx.fill();
    S.ctx.scale(S.k, S.k);
    S.ctx.rotate(wob);
    for (const [y, r] of [
      [-18, 20],
      [-47, 15],
      [-70, 11],
    ]) {
      // prettier-ignore
      circle(0, y, r, '#fff');
      S.ctx.strokeStyle = '#cfe0ee';
      S.ctx.lineWidth = 1.5;
      S.ctx.stroke();
    }
    circle(-4, -73, 1.6, '#333');
    circle(4, -73, 1.6, '#333');
    S.ctx.fillStyle = '#ff922b';
    S.ctx.beginPath();
    S.ctx.moveTo(0, -70);
    S.ctx.lineTo(11, -68);
    S.ctx.lineTo(0, -66.5);
    S.ctx.fill();
    S.ctx.fillStyle = '#e03131'; // ведёрко
    S.ctx.beginPath();
    S.ctx.moveTo(-8, -79);
    S.ctx.lineTo(8, -79);
    S.ctx.lineTo(6, -92);
    S.ctx.lineTo(-6, -92);
    S.ctx.fill();
    S.ctx.strokeStyle = '#7a4a21';
    S.ctx.lineWidth = 2.4;
    S.ctx.beginPath();
    S.ctx.moveTo(-13, -50);
    S.ctx.lineTo(-30, -60 - bell(q) * 14);
    S.ctx.moveTo(13, -50);
    S.ctx.lineTo(30, -60 - bell(q) * 14);
    S.ctx.stroke();
    S.ctx.restore();
  }
  function drawKite() {
    const [x, y] = S.kitePos();
    const hx = S.ham.x + 22 * S.ham.s,
      hy2 = S.ham.y - 30 * S.ham.s;
    S.ctx.strokeStyle = 'rgba(255,255,255,.8)';
    S.ctx.lineWidth = 1.3;
    S.ctx.beginPath();
    S.ctx.moveTo(hx, hy2);
    S.ctx.quadraticCurveTo(lerp(hx, x, 0.5), lerp(hy2, y, 0.5) + 50 * S.k, x, y);
    S.ctx.stroke();
    S.ctx.save();
    S.ctx.translate(x, y);
    S.ctx.rotate(-0.5 + Math.sin(S.T * 1.7) * 0.15 + clamp((S.T - S.kite.loop) / 1.2, 0, 1) * TAU);
    S.ctx.scale(S.k, S.k);
    const cols = ['#ff6b9d', '#ffd43b', '#4dabf7', '#51cf66'];
    [
      [0, -26, 16, 0],
      [16, 0, 0, 30],
      [0, 30, -16, 0],
      [-16, 0, 0, -26],
    ].forEach(([x1, y1, x2, y2], i) => {
      // prettier-ignore
      S.ctx.fillStyle = cols[i];
      S.ctx.beginPath();
      S.ctx.moveTo(0, 0);
      S.ctx.lineTo(x1, y1);
      S.ctx.lineTo(x2, y2);
      S.ctx.fill();
    });
    S.ctx.strokeStyle = '#ff6b9d';
    S.ctx.lineWidth = 2;
    S.ctx.beginPath();
    S.ctx.moveTo(0, 30);
    for (let i = 1; i <= 6; i++) S.ctx.lineTo(Math.sin(S.T * 5 + i) * 6, 30 + i * 8);
    S.ctx.stroke();
    S.ctx.restore();
  }
  function drawStrokes() {
    S.ctx.lineCap = 'round';
    S.ctx.lineJoin = 'round';
    for (const [col, lw, dy] of [
      ['rgba(255,255,255,.55)', 7, 2],
      ['rgba(150,100,45,.6)', 6, 0],
    ]) {
      // prettier-ignore
      S.ctx.strokeStyle = col;
      S.ctx.lineWidth = lw * Math.max(S.k, 0.7);
      for (const st of S.strokes) {
        if (!st.length) continue;
        S.ctx.beginPath();
        S.ctx.moveTo(st[0].x, st[0].y + dy);
        for (let i = 1; i < st.length; i++) {
          // точку смыло — дальше новая чёрточка
          if (Math.hypot(st[i].x - st[i - 1].x, st[i].y - st[i - 1].y) > 30) S.ctx.moveTo(st[i].x, st[i].y + dy);
          else S.ctx.lineTo(st[i].x, st[i].y + dy);
        }
        if (st.length === 1) S.ctx.lineTo(st[0].x + 0.1, st[0].y + dy);
        S.ctx.stroke();
      }
    }
  }
  function drawHam() {
    const s = S.ham.s,
      t = S.ham.t;
    let x = S.ham.x,
      y = S.ham.y,
      pose = { time: S.T, blink: blinkAt(S.T) },
      lk = S.look;
    if (S.ham.st === 'idle') {
      const c = S.T % 7;
      if (c > 6 && !S.rain) pose = { ...pose, happy: true, armsUp: Math.sin(S.T * 10) > 0 }; // сам машет время от времени
    } else if (S.ham.st === 'jump') {
      y -= Math.abs(Math.sin(t * 5.7)) * 34 * s * (1 - t / 1.3);
      pose = { ...pose, happy: true, armsUp: Math.sin(t * 16) > 0 };
    } else if (S.ham.st === 'dance') {
      const beat = t * 5;
      x += Math.sin(beat) * 12 * s;
      y -= Math.abs(Math.sin(beat * 2)) * 9 * s;
      pose = { ...pose, happy: true, armsUp: Math.sin(beat * 2) > 0, dir: Math.sin(beat) > 0 ? 1 : -1, lean: false };
    } else if (S.ham.st === 'sneeze') {
      lk = { ...S.look, sick: true };
      pose = { ...pose, sneeze: clamp(t / 1.2, 0, 0.99) };
    } else if (S.ham.st === 'yawn') {
      pose = { ...pose, blink: 1, talk: true, armsUp: t > 0.3 && t < 1.4 };
      y -= bell(t / 1.8) * 3 * s;
    } else if (S.ham.st === 'hop') {
      y += bell(t / 1.5) * 24 * s * 0.5 - Math.abs(Math.sin(t * 6.3)) * 22 * s * (1 - t / 1.5);
      pose = { ...pose, armsUp: t < 0.8 };
    } else if (S.ham.st === 'listen') {
      pose = { ...pose, happy: true, dir: -1 };
    }
    // тень остаётся на песке, когда хомячок в прыжке
    S.ctx.fillStyle = 'rgba(0,0,0,.16)';
    S.ctx.beginPath();
    S.ctx.ellipse(x, S.ham.y + (S.ham.st === 'hop' ? bell(t / 1.5) * 12 * s : 0) + s, 24 * s, 6 * s, 0, 0, TAU);
    S.ctx.fill();
    drawHamster(S.ctx, x, y, s, lk, { ...pose, shadow: false });
    S.ham.px = x;
    S.ham.py = y;
    if (S.rain) {
      // зонтик
      const top = S.hamTop() - 26 * s + (y - S.ham.y),
        hx = x + 22 * s;
      S.ctx.strokeStyle = '#7a4a21';
      S.ctx.lineWidth = 3 * s;
      S.ctx.lineCap = 'round';
      S.ctx.beginPath();
      S.ctx.moveTo(hx, y - 26 * s);
      S.ctx.lineTo(hx - 14 * s, top + 4 * s);
      S.ctx.stroke();
      const ux = x + 6 * s,
        R = 52 * s;
      S.ctx.fillStyle = '#ff6b9d';
      S.ctx.beginPath();
      S.ctx.moveTo(ux - R, top + 12 * s);
      S.ctx.quadraticCurveTo(ux, top - R * 0.9, ux + R, top + 12 * s);
      for (let i = 3; i >= 0; i--)
        S.ctx.quadraticCurveTo(ux - R + (i + 0.5) * (R / 2), top + 2 * s, ux - R + i * (R / 2), top + 12 * s);
      S.ctx.fill();
      S.ctx.fillStyle = '#ffd43b';
      S.ctx.beginPath();
      S.ctx.moveTo(ux - R / 2, top + 12 * s);
      S.ctx.quadraticCurveTo(ux - R * 0.3, top - R * 0.5, ux, top - R * 0.44);
      S.ctx.quadraticCurveTo(ux + R * 0.3, top - R * 0.5, ux + R / 2, top + 12 * s);
      S.ctx.quadraticCurveTo(ux + R / 4, top + 2 * s, ux, top + 12 * s);
      S.ctx.quadraticCurveTo(ux - R / 4, top + 2 * s, ux - R / 2, top + 12 * s);
      S.ctx.fill();
    }
  }
  function drawFly(lit) {
    if (S.night) {
      // светлячки: пять огоньков вокруг одной точки
      if (!lit) return;
      for (let i = 0; i < 5; i++) {
        const sp = S.fly.st === 'sit' ? 15 : 34,
          x = S.fly.x + Math.sin(S.T * 1.3 + i * 2.1) * sp * S.k,
          y = S.fly.y + Math.cos(S.T * 1.7 + i * 1.4) * sp * 0.6 * S.k - (S.fly.st === 'sit' ? 8 * S.k : 0),
          a = 0.55 + 0.45 * Math.sin(S.T * 4 + i * 1.9);
        const g = S.ctx.createRadialGradient(x, y, 0, x, y, 12 * S.k);
        g.addColorStop(0, `rgba(230,255,120,${0.75 * a})`);
        g.addColorStop(1, 'rgba(230,255,120,0)');
        S.ctx.fillStyle = g;
        S.ctx.fillRect(x - 12 * S.k, y - 12 * S.k, 24 * S.k, 24 * S.k);
        circle(x, y, 2.2 * S.k, `rgba(250,255,190,${a})`);
      }
      return;
    }
    if (lit || S.rain || S.snow) return; // в дождь и снег бабочка прячется
    const fl = S.fly.st === 'sit' ? Math.abs(Math.sin(S.T * 3)) * 0.5 + 0.5 : Math.abs(Math.sin(S.T * 13));
    S.ctx.save();
    S.ctx.translate(S.fly.x, S.fly.y + (S.fly.st === 'sit' ? 0 : Math.sin(S.T * 9) * 4 * S.k));
    S.ctx.scale(S.k * 1.15, S.k * 1.15);
    for (const sd of [-1, 1]) {
      S.ctx.fillStyle = '#b197fc';
      S.ctx.beginPath();
      S.ctx.ellipse(sd * 7 * fl, -4, 8 * fl + 1, 8, sd * 0.4, 0, TAU);
      S.ctx.fill();
      S.ctx.fillStyle = '#ffa8d0';
      S.ctx.beginPath();
      S.ctx.ellipse(sd * 5 * fl, 5, 5 * fl + 1, 5, -sd * 0.4, 0, TAU);
      S.ctx.fill();
    }
    S.ctx.fillStyle = '#5b3a29';
    S.ctx.fillRect(-1.2, -8, 2.4, 15);
    S.ctx.restore();
  }
  function drawWeather() {
    if (S.rain) {
      S.ctx.strokeStyle = 'rgba(220,235,255,.6)';
      S.ctx.lineWidth = 1.4;
      S.ctx.beginPath();
      for (const d of S.drops) {
        S.ctx.moveTo(d.x, d.y);
        S.ctx.lineTo(d.x - 3 * d.z, d.y + 15 * d.z);
      }
      S.ctx.stroke();
    } else if (S.snow) {
      S.ctx.fillStyle = 'rgba(255,255,255,.92)';
      S.ctx.beginPath();
      for (const d of S.drops) {
        S.ctx.moveTo(d.x + 2.6 * d.z, d.y);
        S.ctx.arc(d.x, d.y, 2.6 * d.z, 0, TAU);
      }
      S.ctx.fill();
    } else if (S.windy) {
      for (const d of S.drops) {
        S.ctx.save();
        S.ctx.translate(d.x, d.y);
        S.ctx.rotate(S.T * 3 + d.ph);
        S.ctx.fillStyle = d.c;
        S.ctx.beginPath();
        S.ctx.ellipse(0, 0, 5.5 * d.z, 2.8 * d.z, 0, 0, TAU);
        S.ctx.fill();
        S.ctx.restore();
      }
    }
  }
  function drawNightSky() {
    for (const s of S.stars) {
      S.ctx.globalAlpha = S.dk * (0.55 + 0.45 * Math.sin(S.T * 1.6 + s.ph));
      circle(s.x, s.y, s.r, '#fff');
    }
    S.ctx.globalAlpha = clamp((S.dk - 0.3) / 0.4, 0, 1); // луна выходит, когда солнце село
    if (!S.rain && !S.snow) {
      const mx = S.F.x + S.F.w * 0.66,
        my = S.F.y + 38 * S.k;
      const g = S.ctx.createRadialGradient(mx, my, 4, mx, my, 90 * S.k);
      g.addColorStop(0, 'rgba(230,235,255,.5)');
      g.addColorStop(1, 'rgba(230,235,255,0)');
      S.ctx.fillStyle = g;
      S.ctx.fillRect(mx - 95 * S.k, my - 95 * S.k, 190 * S.k, 190 * S.k);
      circle(mx, my, 24 * S.k, '#fdf6d8');
      circle(mx - 8 * S.k, my - 5 * S.k, 5 * S.k, '#eee3b5');
      circle(mx + 7 * S.k, my + 8 * S.k, 3.5 * S.k, '#eee3b5');
      // лунная дорожка
      S.ctx.fillStyle = 'rgba(253,246,216,.28)';
      for (let i = 0; i < 6; i++) {
        const y = lerp(S.hy + 6 * S.k, S.sy - 16 * S.k, i / 6),
          w = lerp(14, 60, i / 6) * S.k * (0.8 + 0.2 * Math.sin(S.T * 2 + i));
        S.ctx.fillRect(mx - w / 2, y, w, 3 * S.k);
      }
    }
    S.ctx.globalAlpha = 1;
    // падающая звезда
    const q = (S.T - S.star.t) / 1.3;
    if (q >= 0 && q < 1) {
      const x = S.star.x + lerp(-140, 140, q) * S.k,
        y = S.star.y + lerp(-50, 50, q) * S.k;
      const g = S.ctx.createLinearGradient(x - 80 * S.k, y - 28 * S.k, x, y);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(1, 'rgba(255,255,255,.95)');
      S.ctx.strokeStyle = g;
      S.ctx.lineWidth = 3 * S.k;
      S.ctx.lineCap = 'round';
      S.ctx.beginPath();
      S.ctx.moveTo(x - 80 * S.k, y - 28 * S.k);
      S.ctx.lineTo(x, y);
      S.ctx.stroke();
      circle(x, y, 4 * S.k, '#fffbe0');
    }
    if (q >= 0.3 && q < 3.6) label(S.star.x, S.star.y + 70 * S.k, '🌠 Загадай желание!', 19 * Math.max(S.k, 0.75), clamp((3.6 - q) * 2, 0, 1) * clamp((q - 0.3) * 4, 0, 1)); // prettier-ignore
  }
  return { paintBg, label, drawSea, drawFish, drawShip, drawCloud, drawPalm, drawNut, drawCrab, drawGull, drawShell, drawSnowman, drawKite, drawStrokes, drawHam, drawFly, drawWeather, drawNightSky };
}
