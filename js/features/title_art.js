// РИСОВАНИЕ живой заставки (features/title_scene.js): небо, море и песок (кэш bg), волны, облака, пальмы, кораблик,
// дельфин, рыбки, самолётик, русалочка, крабик, чайка, ракушка, снеговик, воздушный змей, рисунок на песке, хомячок,
// бабочка и светлячки, погода, ночное небо. Здесь только рисование: что где находится и что происходит, решает title_scene.js
// (layout, update, down) — оттуда приходит S, состояние заставки. Порядок слоёв кадра — frame() там же.
import { TAU, clamp, lerp, seeded } from '../core/util.js';
import { mix, shade } from '../core/draw.js';
import { drawHamster, blinkAt } from '../art/hamster.js';
import { paintDolphin } from '../locations/cove_art.js';
import { SpriteSet } from '../core/sprites.js';
import { npcLook } from '../data/index.js';

const OUT = '#4a3728',
  PLANE_U = 1.15; // размер самолётика от общего масштаба заставки
// кадры самолётика и русалочки рисуются один раз и потом только копируются (ключ — направление, поза, масштаб);
// набор один на все заставки: сменился масштаб экрана — он сбрасывается сам. Память — в общем учёте кэшей картинок
// (core/pixcache.js); заставку закрыли — releaseTitleArt() отпускает все кадры (в игре они не нужны)
const SP = new SpriteSet();
/** Заставка закрыта: отпустить кадры из кэша спрайтов заставки. */
export const releaseTitleArt = () => SP.clear();
/** Для автотеста и замеров: сколько пикселей сейчас в кэше спрайтов заставки. */
export const titleArtPixels = () => SP.pixels;

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
 * snowman, star, stars, drops, jumps, rings, strokes, feathers, plane, mer), погода и время суток (rain, snow, windy,
 * winter, night, dk, dusk), внешность хомячка look и общие расчёты (shoreY, sway, crown, hamTop, kitePos, planeOn,
 * planePos, planeSpan, merS, merUp).
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
        c.ellipse(
          rs() * S.W,
          S.sy + (0.25 + rs() * 0.75) * (S.H - S.sy),
          (40 + rs() * 60) * S.k,
          (7 + rs() * 8) * S.k,
          0,
          0,
          TAU,
        );
        c.fill();
      }
    }
    paintFar(low);
    // норка краба
    c.fillStyle = 'rgba(120,80,40,.55)';
    c.beginPath();
    c.ellipse(S.crab.hx, S.crab.hy, 17 * S.k, 7 * S.k, 0, 0, TAU);
    c.fill();
  }
  // ---------- вдали: остров с вулканом и маяк ----------
  // Рисуются один раз в свою полоску у горизонта (S.far) и в кадре идут поверх облаков (drawFar): низкие облака
  // проплывают позади острова и маяка, а не закрывают их (и не забирают нажатие — см. down в title_scene.js).
  // haze — цвет дымки у горизонта: чем дальше, тем больше в неё уходят цвета
  const HAZE = 0.42;
  function paintFar(haze) {
    const top = Math.floor(S.hy - 62 * Math.max(S.isle.s, S.tower.s) - 2),
      h = Math.ceil(S.hy + 8 * Math.max(S.isle.s, S.tower.s) + 4) - top;
    const far = document.createElement('canvas');
    far.width = Math.max(1, Math.round(S.W * S.dpr));
    far.height = Math.max(1, Math.round(h * S.dpr));
    const c = far.getContext('2d');
    c.setTransform(S.dpr, 0, 0, S.dpr, 0, -top * S.dpr);
    paintIsle(c, haze);
    paintTower(c, haze);
    S.far = { canvas: far, y: top, h };
  }
  /** Остров и маяк — поверх облаков, под дымком вулкана и кораблями на горизонте. */
  function drawFar() {
    const f = S.far;
    if (f) S.ctx.drawImage(f.canvas, 0, f.y, S.W, f.h);
  }
  function paintIsle(c, haze) {
    const z = (col) => mix(col, haze, HAZE),
      s = S.isle.s;
    c.save();
    c.translate(S.isle.x, S.hy);
    c.scale(s, s);
    c.lineCap = 'round';
    const blob = (col, pts) => {
      c.fillStyle = z(col);
      c.beginPath();
      pts();
      c.closePath();
      c.fill();
    };
    blob('#f3d9a0', () => c.ellipse(4, 0.5, 124, 4.5, 0, 0, TAU)); // песок у воды
    blob('#5fae4a', () => {
      c.moveTo(-120, 0);
      c.quadraticCurveTo(-104, -12, -80, -10);
      c.quadraticCurveTo(0, -16, 84, -9);
      c.quadraticCurveTo(108, -8, 122, 0);
    });
    // вулкан: наверху пепел, ниже зелёные склоны
    const g = c.createLinearGradient(0, -57, 0, -4);
    g.addColorStop(0, z('#8d7b6e'));
    g.addColorStop(0.5, z('#8d7b6e'));
    g.addColorStop(0.8, z('#5fae4a'));
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(-74, -6);
    c.quadraticCurveTo(-46, -20, -30, -54);
    c.lineTo(-25, -57);
    c.lineTo(-9, -57);
    c.lineTo(-4, -54);
    c.quadraticCurveTo(12, -22, 42, -7);
    c.closePath();
    c.fill();
    blob('#5a4a42', () => c.ellipse(-17, -56.6, 8, 1.8, 0, 0, TAU));
    c.strokeStyle = z('#ff8a3d');
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(-15, -55);
    c.quadraticCurveTo(-11, -45, -16, -36);
    c.stroke();
    // пальмы
    for (const [px, py, lean] of [
      [-102, -5, -1],
      [-88, -8, 1],
      [52, -9, -1],
      [100, -6, 1],
    ]) {
      // prettier-ignore
      const tx = px + lean * 4,
        ty = py - 17;
      c.strokeStyle = z('#7a5a3a');
      c.lineWidth = 1.7;
      c.beginPath();
      c.moveTo(px, py);
      c.quadraticCurveTo(px + lean * 1, py - 9, tx, ty);
      c.stroke();
      c.strokeStyle = z('#2f8f3a');
      c.lineWidth = 2.4;
      c.beginPath();
      for (const a of [-2.7, -2.1, -1.57, -1.05, -0.45]) {
        c.moveTo(tx, ty);
        c.quadraticCurveTo(
          tx + Math.cos(a) * 6,
          ty + Math.sin(a) * 6 - 1,
          tx + Math.cos(a) * 10,
          ty + Math.sin(a) * 6 + 4,
        );
      }
      c.stroke();
    }
    // хижины на сваях под пальмовыми крышами
    for (const [hx, hy2] of [
      [66, -6],
      [80, -5],
    ]) {
      // prettier-ignore
      c.strokeStyle = z('#7a5a3a');
      c.lineWidth = 1.1;
      c.beginPath();
      for (const dx of [-3, 3]) {
        c.moveTo(hx + dx, hy2);
        c.lineTo(hx + dx, hy2 + 4);
      }
      c.stroke();
      blob('#c08a4e', () => c.rect(hx - 4.5, hy2 - 5, 9, 5));
      blob('#d9b36b', () => {
        c.moveTo(hx - 7, hy2 - 4.5);
        c.lineTo(hx, hy2 - 11);
        c.lineTo(hx + 7, hy2 - 4.5);
      });
      blob('#5a3d26', () => c.rect(hx - 1, hy2 - 3.6, 2, 3.6));
    }
    // причал
    c.strokeStyle = z('#a0784e');
    c.lineWidth = 1.8;
    c.beginPath();
    c.moveTo(104, -1);
    c.lineTo(130, 1);
    c.stroke();
    c.lineWidth = 1;
    c.beginPath();
    for (const px of [110, 118, 126]) {
      c.moveTo(px, -0.5);
      c.lineTo(px, 3);
    }
    c.stroke();
    blob('#9a9086', () => c.ellipse(22, -6.5, 4, 1.2, 0, 0, TAU)); // круг камней у костра
    c.restore();
  }
  function paintTower(c, haze) {
    const z = (col) => mix(col, haze, HAZE),
      s = S.tower.s;
    c.save();
    c.translate(S.tower.x, S.hy);
    c.scale(s, s);
    const blob = (col, pts) => {
      c.fillStyle = z(col);
      c.beginPath();
      pts();
      c.closePath();
      c.fill();
    };
    blob('#7d8a96', () => {
      c.moveTo(-28, 1);
      c.quadraticCurveTo(-24, -10, -11, -13);
      c.lineTo(9, -14);
      c.quadraticCurveTo(22, -9, 28, 1);
    });
    blob('#66717c', () => c.ellipse(8, -1, 18, 3, 0, 0, TAU));
    blob('#ffffff', () => {
      c.moveTo(-6, -12);
      c.lineTo(6, -12);
      c.lineTo(4, -44);
      c.lineTo(-4, -44);
    });
    for (const y0 of [-21, -33])
      blob('#e03131', () => {
        c.moveTo(-5.4 + (y0 + 12) * -0.0625, y0);
        c.lineTo(5.4 - (y0 + 12) * -0.0625, y0);
        c.lineTo(5.0 - (y0 + 7 + 12) * -0.0625, y0 - 5);
        c.lineTo(-5.0 + (y0 + 7 + 12) * -0.0625, y0 - 5);
      });
    blob('#495057', () => c.rect(-6, -46, 12, 2.2));
    blob('#ffe8a3', () => c.rect(-3.5, -52, 7, 6));
    blob('#c92a2a', () => {
      c.moveTo(-5, -52);
      c.lineTo(5, -52);
      c.lineTo(0, -58);
    });
    c.restore();
  }
  // дымок над вулканом: четыре облачка поднимаются по очереди; нажали — «пых!» побольше
  function drawIsleSmoke() {
    const I = S.isle,
      s = I.s,
      drift = S.windy ? 2 : 1;
    const puff = (ph, big) => {
      const a = clamp(ph * 5, 0, 1) * (1 - ph) * (big ? 0.8 : 0.5);
      circle(I.x + (-17 + ph * 26 * drift + Math.sin(ph * 6) * 3) * s, S.hy + (-60 - ph * (big ? 60 : 38)) * s, (3 + ph * (big ? 13 : 7)) * s, `rgba(236,236,240,${a.toFixed(3)})`); // prettier-ignore
    };
    for (let i = 0; i < 4; i++) puff((S.T * 0.11 + i / 4) % 1, false);
    const q = (S.T - I.puff) / 2.5;
    if (q >= 0 && q < 1) for (let i = 0; i < 3; i++) puff(clamp(q * 1.3 - i * 0.12, 0, 0.999), true);
  }
  /** Ночью (поверх затемнения): окошки хижин, костёр, жерло вулкана и вспышки маяка. */
  function drawIsleLights() {
    const I = S.isle,
      s = I.s,
      a = clamp((S.dk - 0.25) / 0.4, 0, 1);
    if (a <= 0) return;
    const glow = (x, y, r, col, al) => {
      const g = S.ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${col},${(al * a).toFixed(3)})`);
      g.addColorStop(1, `rgba(${col},0)`);
      S.ctx.fillStyle = g;
      S.ctx.fillRect(x - r, y - r, r * 2, r * 2);
    };
    const fl = 0.75 + 0.25 * Math.sin(S.T * 9) * Math.sin(S.T * 5.3);
    glow(I.x - 17 * s, S.hy - 57 * s, 16 * s, '255,120,50', 0.55); // жерло
    glow(I.x + 22 * s, S.hy - 8 * s, 10 * s * fl, '255,170,60', 0.85); // костёр
    circle(I.x + 22 * s, S.hy - 8 * s, 1.5 * s, `rgba(255,220,130,${(a * fl).toFixed(3)})`);
    for (const [hx, hy2] of [
      [66, -8.5],
      [80, -7.5],
    ]) {
      // prettier-ignore
      glow(I.x + hx * s, S.hy + hy2 * s, 7 * s, '255,210,120', 0.6);
      circle(I.x + hx * s, S.hy + hy2 * s, 1.1 * s, `rgba(255,225,150,${a.toFixed(3)})`);
    }
    // маяк мигает: две вспышки, пауза
    const ph = S.T % 2.8,
      on = ph < 0.3 || (ph > 0.55 && ph < 0.85);
    const tx = S.tower.x,
      ty = S.towerTop();
    glow(tx, ty, (on ? 34 : 10) * S.tower.s, '255,240,180', on ? 0.9 : 0.4);
    if (on) circle(tx, ty, 2.6 * S.tower.s, `rgba(255,250,220,${a.toFixed(3)})`);
  }
  /** Нажали на маяк: по морю проходит луч света — слева направо к берегу. */
  function drawBeam() {
    const q = (S.T - S.tower.beam) / 2;
    if (q < 0 || q >= 1) return;
    const tx = S.tower.x,
      ty = S.towerTop(),
      ang = lerp(Math.PI * 0.93, Math.PI * 0.07, ease(q)),
      L = Math.hypot(S.W, S.H),
      w = 0.06;
    const al = bell(q) * (S.night ? 0.9 : 0.4); // ночью ярче: поверх ляжет затемнение
    S.ctx.save();
    S.ctx.beginPath();
    S.ctx.rect(S.F.x, ty - 20 * S.tower.s, S.F.w, S.sy - ty + 20 * S.tower.s); // небо у горизонта и море
    S.ctx.clip();
    if (S.night) S.ctx.globalCompositeOperation = 'lighter';
    const g = S.ctx.createRadialGradient(tx, ty, 0, tx, ty, (S.sy - S.hy) * 3);
    g.addColorStop(0, `rgba(255,248,210,${al.toFixed(3)})`);
    g.addColorStop(1, 'rgba(255,248,210,0)');
    S.ctx.fillStyle = g;
    S.ctx.beginPath();
    S.ctx.moveTo(tx, ty);
    S.ctx.lineTo(tx + Math.cos(ang - w) * L, ty + Math.sin(ang - w) * L * 0.35);
    S.ctx.lineTo(tx + Math.cos(ang + w) * L, ty + Math.sin(ang + w) * L * 0.35);
    S.ctx.closePath();
    S.ctx.fill();
    S.ctx.restore();
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
  // ---------- корабли: рисунок каждого вида — один раз в кэш, поверх — дымок, кильватер, флажки, чайки ----------
  // единицы рисунка: нос — вправо (+x), ватерлиния — y = 0; dir −1 — зеркально
  const SHIP_ART = {
    boat: {
      flags: [[24, -9], [0, -31], [-22, -9]], // prettier-ignore
      paint(c, f) {
        f('#e8590c', () => {
          c.moveTo(-22, -9);
          c.lineTo(24, -9);
          c.lineTo(17, 1);
          c.lineTo(-17, 1);
        });
        f('#fff', () => c.rect(-11, -19, 19, 10));
        f('#343a40', () => c.rect(-4, -31, 7, 12));
        f('#ffd43b', () => c.rect(-4, -27, 7, 3), true);
        for (const wx of [-8, -2, 4]) f('#4dabf7', () => c.rect(wx, -16, 3, 3), true);
      },
    },
    liner: {
      flags: [[48, -10], [30, -42], [-46, -10]], // prettier-ignore
      paint(c, f) {
        f('#fff', () => {
          c.moveTo(-46, -10);
          c.lineTo(49, -10);
          c.lineTo(41, 2);
          c.lineTo(-42, 2);
          c.quadraticCurveTo(-47, -3, -46, -10);
        });
        f(
          '#264b8c',
          () => {
            c.moveTo(-44, -3);
            c.lineTo(45, -3);
            c.lineTo(41, 2);
            c.lineTo(-42, 2);
          },
          true,
        );
        f('#fff', () => c.rect(-36, -18, 66, 8));
        f('#fff', () => c.rect(-28, -25, 48, 7));
        f('#fff', () => c.rect(14, -31, 12, 6));
        c.fillStyle = '#4dabf7';
        for (let x = -33; x < 28; x += 5) c.fillRect(x, -15.5, 2.6, 2.4);
        for (let x = -25; x < 18; x += 5) c.fillRect(x, -22.5, 2.6, 2.4);
        for (let x = -42; x < 44; x += 5) c.fillRect(x, -7.5, 2, 2);
        for (const fx of [-20, -8]) {
          f('#e03131', () => c.rect(fx, -38, 8, 13));
          f('#212529', () => c.rect(fx, -38, 8, 3), true);
        }
        c.beginPath();
        c.moveTo(30, -25);
        c.lineTo(30, -42);
        c.stroke();
      },
    },
    trawler: {
      flags: [[30, -10], [-12, -40], [-28, -8]], // prettier-ignore
      paint(c, f) {
        // сеть на стреле: висит у кормы
        c.strokeStyle = 'rgba(80,60,40,.8)';
        c.lineWidth = 1.2;
        c.beginPath();
        c.moveTo(-12, -36);
        c.lineTo(-34, -16);
        c.stroke();
        c.lineWidth = 0.8;
        c.beginPath();
        for (let i = 0; i <= 4; i++) {
          c.moveTo(-34 + i * 2, -16 + i * 0.5);
          c.lineTo(-30 + i * 3, -2);
          c.moveTo(-34, -16 + i * 3.4);
          c.lineTo(-22, -14 + i * 3);
        }
        c.stroke();
        c.lineWidth = 1.4;
        c.strokeStyle = OUT;
        f('#1971c2', () => {
          c.moveTo(-28, -8);
          c.lineTo(30, -11);
          c.lineTo(23, 2);
          c.lineTo(-25, 2);
        });
        f(
          '#e03131',
          () => {
            c.moveTo(-26, -1);
            c.lineTo(26, -2);
            c.lineTo(23, 2);
            c.lineTo(-25, 2);
          },
          true,
        );
        f('#fff', () => c.rect(0, -22, 15, 12));
        f('#74c0fc', () => c.rect(8, -19, 5, 4), true);
        f('#f08c00', () => c.rect(2, -26, 9, 4));
        c.beginPath();
        c.moveTo(-12, -9);
        c.lineTo(-12, -40);
        c.stroke();
        for (const bx of [-20, -4, 20]) f('#ff922b', () => c.arc(bx, -10, 2, 0, TAU));
      },
    },
    yacht: {
      flags: [[25, -6], [0, -55], [-21, -5]], // prettier-ignore
      paint(c, f) {
        f('#fff', () => {
          c.moveTo(1, -52);
          c.lineTo(1, -9);
          c.lineTo(-19, -9);
        });
        f(
          '#ff6b6b',
          () => {
            c.moveTo(1, -24);
            c.lineTo(1, -17);
            c.lineTo(-12, -17);
            c.lineTo(-8, -24);
          },
          true,
        );
        f('#ffe066', () => {
          c.moveTo(3, -48);
          c.lineTo(3, -9);
          c.lineTo(20, -9);
        });
        c.beginPath();
        c.moveTo(0, -6);
        c.lineTo(0, -55);
        c.stroke();
        f('#fff', () => {
          c.moveTo(-21, -6);
          c.lineTo(25, -7);
          c.quadraticCurveTo(19, 2, 10, 2);
          c.lineTo(-17, 2);
        });
        c.strokeStyle = '#1c7ed6';
        c.lineWidth = 1.6;
        c.beginPath();
        c.moveTo(-19, -2);
        c.lineTo(21, -3);
        c.stroke();
      },
    },
  };
  function paintShip(c, type, u, dir) {
    c.scale(dir * u, u);
    c.lineWidth = 1.4;
    c.strokeStyle = OUT;
    c.lineJoin = 'round';
    const f = (col, pts, noStroke) => {
      c.fillStyle = col;
      c.beginPath();
      pts();
      c.closePath();
      c.fill();
      if (!noStroke) c.stroke();
    };
    SHIP_ART[type].paint(c, f);
  }
  const FLAG_COLS = ['#e03131', '#ffd43b', '#1c7ed6', '#2f9e44', '#fff', '#f76707'];
  function drawShip(sh) {
    const sp = S.SHIPS[sh.type],
      u = S.k * S.LANE_U[sh.lane],
      d = sh.dir,
      x = sh.x,
      y = S.shipY(sh.lane) + Math.sin(S.T * 1.2 + sh.id) * 1.2 * u,
      ctx = S.ctx;
    for (const p of sh.puffs) circle(p.x - p.t * 9 * S.k * d, p.y - p.t * 16 * S.k, (4 + p.t * 5) * S.k, `rgba(255,255,255,${(0.7 * (1 - p.t / 2)).toFixed(3)})`); // prettier-ignore
    // кильватер: белые чёрточки за кормой
    ctx.strokeStyle = 'rgba(255,255,255,.75)';
    ctx.lineWidth = 1.6 * u;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const q = (S.T * 0.6 + i / 3) % 1,
        wx = x - d * (sp.len * 0.5 + 4 + q * 26) * u;
      ctx.moveTo(wx, y + (1 + q * 2) * u);
      ctx.lineTo(wx - d * 8 * u * (1 - q), y + (1 + q * 2) * u);
    }
    ctx.stroke();
    SP.setScale(S.dpr);
    blit(SP.get(`ship:${sh.type}:${d}:${Math.round(u * 100)}`, [-(sp.len * 0.5 + 16) * u, -(sp.top + 8) * u, (sp.len * 0.5 + 16) * u, 6 * u], (c) => paintShip(c, sh.type, u, d)), x, y); // prettier-ignore
    if (sh.type === 'trawler' && !S.rain && !S.night) {
      // чайки кружат над рыбаками
      ctx.strokeStyle = 'rgba(70,80,100,.8)';
      ctx.lineWidth = 1.4 * u;
      ctx.beginPath();
      for (let i = 0; i < 2; i++) {
        const gx = x + Math.cos(S.T * 1.1 + i * 3) * 22 * u - d * 10 * u,
          gy = y - (48 + Math.sin(S.T * 1.7 + i) * 5) * u,
          fl = Math.sin(S.T * 6 + i) * 2.5 * u;
        ctx.moveTo(gx - 6 * u, gy - fl);
        ctx.quadraticCurveTo(gx - 2.5 * u, gy - 3.5 * u, gx, gy);
        ctx.quadraticCurveTo(gx + 2.5 * u, gy - 3.5 * u, gx + 6 * u, gy - fl);
      }
      ctx.stroke();
    }
    // сигнальные флажки: гирлянда от носа через мачту к корме поднимается и держится пять секунд
    const q = (S.T - sh.flags) / 5;
    if (q >= 0 && q < 1) {
      const up = ease(clamp(q * 5, 0, 1)) * clamp((1 - q) * 6, 0, 1),
        [a, m, b] = SHIP_ART[sh.type].flags.map(([fx, fy]) => [x + fx * d * u, y + fy * u]),
        top = [m[0], lerp(y - 4 * u, m[1], up)];
      ctx.strokeStyle = 'rgba(60,50,40,.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(...a);
      ctx.lineTo(...top);
      ctx.lineTo(...b);
      ctx.stroke();
      let n = 0;
      for (const [p0, p1] of [[a, top], [top, b]]) // prettier-ignore
        for (let i = 1; i < 6; i++) {
          const fx = lerp(p0[0], p1[0], i / 6),
            fy = lerp(p0[1], p1[1], i / 6),
            wv = Math.sin(S.T * 8 + n) * 1.2 * u;
          ctx.fillStyle = FLAG_COLS[n++ % FLAG_COLS.length];
          ctx.beginPath();
          ctx.moveTo(fx - 2.6 * u, fy);
          ctx.lineTo(fx + 2.6 * u, fy);
          ctx.lineTo(fx + wv, fy + 6 * u);
          ctx.closePath();
          ctx.fill();
        }
    }
  }
  /** Ночью у кораблей светятся окошки и огонёк на мачте (поверх затемнения). */
  function drawShipLights() {
    const a = clamp((S.dk - 0.25) / 0.4, 0, 1);
    if (a <= 0) return;
    for (const sh of S.fleet) {
      const u = S.k * S.LANE_U[sh.lane],
        d = sh.dir,
        y = S.shipY(sh.lane) + Math.sin(S.T * 1.2 + sh.id) * 1.2 * u;
      S.ctx.fillStyle = `rgba(255,225,140,${(0.9 * a).toFixed(3)})`;
      const win = { liner: [[-33, 28, -15.5], [-25, 18, -22.5]], boat: [[-8, 6, -16]], trawler: [[8, 9, -19]], yacht: [] }[sh.type]; // prettier-ignore
      for (const [x0, x1, wy] of win)
        for (let wx = x0; wx < x1; wx += 5) S.ctx.fillRect(sh.x + (d > 0 ? wx : -wx - 2.6) * u, y + wy * u, 2.6 * u, 2.4 * u); // prettier-ignore
      const [mx, my] = SHIP_ART[sh.type].flags[1];
      circle(sh.x + mx * d * u, y + my * u, 1.6 * u, `rgba(255,255,230,${a.toFixed(3)})`);
    }
  }
  // батискаф: жёлтый, с круглым окошком и перископом; поднимается из воды (видно только то, что над водой)
  function paintSub(c, u) {
    c.scale(u, u);
    c.lineWidth = 1.5;
    c.strokeStyle = OUT;
    const f = (col, pts) => {
      c.fillStyle = col;
      c.beginPath();
      pts();
      c.closePath();
      c.fill();
      c.stroke();
    };
    f('#868e96', () => c.ellipse(-24, -9, 3, 6, 0, 0, TAU)); // винт
    f('#ffd43b', () => c.ellipse(0, -9, 23, 12, 0, 0, TAU));
    f('#ffd43b', () => c.rect(-7, -27, 12, 9));
    f('#ffe066', () => c.ellipse(-1, -27, 6, 1.8, 0, 0, TAU));
    f('#d0ebff', () => c.arc(9, -10, 5.5, 0, TAU));
    c.fillStyle = 'rgba(255,255,255,.8)';
    c.beginPath();
    c.arc(7.5, -11.5, 1.6, 0, TAU);
    c.fill();
    for (const rx of [-12, -4]) f('#fab005', () => c.arc(rx, -6, 1.6, 0, TAU));
  }
  function drawSub() {
    const B = S.sub;
    if (B.t < 0) return;
    const up = S.subUp(),
      u = S.k * 1.1,
      wy = S.shipY('near'),
      ctx = S.ctx,
      x = B.x,
      y = wy + (1 - up) * 44 * u + Math.sin(S.T * 1.5) * 1 * u;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, S.W, wy + 1); // над водой
    ctx.clip();
    // перископ: смотрит то вправо, то влево; нажали — крутится
    const spin = S.T - B.hi < 1.2,
      pd = spin ? (Math.sin(S.T * 18) > 0 ? 1 : -1) : Math.sin(S.T * 0.8) > 0 ? 1 : -1;
    ctx.strokeStyle = '#495057';
    ctx.lineWidth = 2 * u;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 2 * u, y - 27 * u);
    ctx.lineTo(x - 2 * u, y - 38 * u);
    ctx.lineTo(x + (-2 + pd * 5) * u, y - 38 * u);
    ctx.stroke();
    SP.setScale(S.dpr);
    blit(
      SP.get(`sub:${Math.round(u * 100)}`, [-30 * u, -32 * u, 26 * u, 6 * u], (c) => paintSub(c, u)),
      x,
      y,
    );
    ctx.restore();
    // пузыри
    for (let i = 0; i < 5; i++) {
      const q = (S.T * (spin ? 1.6 : 0.7) + i / 5) % 1;
      circle(x + Math.sin(i * 2.3 + S.T) * 18 * u, wy - q * 26 * u * (0.4 + up), (1.4 + q * 1.8) * u, `rgba(255,255,255,${(0.75 * (1 - q)).toFixed(3)})`); // prettier-ignore
    }
    if (up > 0.05) {
      ctx.strokeStyle = `rgba(255,255,255,${(0.85 * up).toFixed(3)})`;
      ctx.lineWidth = 2 * S.k;
      ctx.beginPath();
      ctx.ellipse(x, wy, 26 * u, 5 * u, 0, 0, Math.PI);
      ctx.stroke();
    }
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
  // рисунок на песке лежит в своём кэше: перерисовываем его, только когда он поменялся (S.inkV)
  let ink = null,
    inkV = -1;
  function drawStrokes() {
    if (!S.strokes.length) return;
    if (!ink || ink.width !== S.canvas.width || ink.height !== S.canvas.height) {
      ink = document.createElement('canvas');
      ink.width = S.canvas.width;
      ink.height = S.canvas.height;
      inkV = -1;
    }
    if (inkV !== S.inkV) {
      inkV = S.inkV;
      const c = ink.getContext('2d');
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, ink.width, ink.height);
      c.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
      c.lineCap = 'round';
      c.lineJoin = 'round';
      for (const [col, lw, dy] of [
        ['rgba(255,255,255,.55)', 7, 2],
        ['rgba(150,100,45,.6)', 6, 0],
      ]) {
        c.strokeStyle = col;
        c.lineWidth = lw * Math.max(S.k, 0.7);
        c.beginPath();
        for (const st of S.strokes)
          for (let i = 0; i < st.length; i++) {
            const q = st[i];
            if (q.j || !i) {
              // линия начинается заново (с песка уходили или волна смыла кусок); одна точка — тоже видна
              c.moveTo(q.x, q.y + dy);
              if (!st[i + 1] || st[i + 1].j) c.lineTo(q.x + 0.1, q.y + dy);
            } else c.lineTo(q.x, q.y + dy);
          }
        c.stroke();
      }
    }
    S.ctx.save();
    S.ctx.setTransform(1, 0, 0, 1, 0, 0);
    S.ctx.drawImage(ink, 0, 0);
    S.ctx.restore();
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
    } else if (S.ham.st === 'busy') {
      // сам по себе: лепит (хлопает лапками в сторону куличика), смотрит на море, дремлет, перебирает лапками
      const a = S.ham.act,
        c = S.castles[S.castles.length - 1];
      if (a === 'castle' || a === 'snowball')
        pose = { ...pose, happy: true, dir: c ? c.side : 1, armsUp: Math.sin(t * 6) > 0.3, lean: false };
      else if (a === 'sea') pose = { ...pose, sit: true, blink: blinkAt(S.T * 0.6) };
      else if (a === 'doze') {
        pose = { ...pose, sleep: true, blink: 1, sit: true };
        y += Math.sin(S.T * 1.6) * 1.2 * s;
      } else if (a === 'paws') pose = { ...pose, walk: (t * 1.4) % 1, lean: false };
    }
    // тень остаётся на песке, когда хомячок в прыжке
    S.ctx.fillStyle = 'rgba(0,0,0,.16)';
    S.ctx.beginPath();
    S.ctx.ellipse(x, S.ham.y + (S.ham.st === 'hop' ? bell(t / 1.5) * 12 * s : 0) + s, 24 * s, 6 * s, 0, 0, TAU);
    S.ctx.fill();
    drawHamster(S.ctx, x, y, s, lk, { ...pose, shadow: false });
    S.ham.px = x;
    S.ham.py = y;
    if (S.ham.st === 'busy' && S.ham.act === 'doze')
      for (let i = 0; i < 3; i++) {
        const q = (S.T * 0.4 + i / 3) % 1;
        S.ctx.globalAlpha = clamp(q * 4, 0, 1) * (1 - q);
        S.ctx.font = `900 ${Math.round((14 + q * 10) * S.ham.s * 0.5)}px Nunito, sans-serif`;
        S.ctx.lineWidth = 3;
        S.ctx.strokeStyle = '#fff';
        S.ctx.strokeText('z', x + (20 + q * 22) * s, S.hamTop() - q * 30 * s + 10 * s);
        S.ctx.fillStyle = '#4dabf7';
        S.ctx.fillText('z', x + (20 + q * 22) * s, S.hamTop() - q * 30 * s + 10 * s);
      }
    S.ctx.globalAlpha = 1;
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
  // ---------- морская звезда и черепашка ----------
  function drawStarfish() {
    const F0 = S.starfish,
      ctx = S.ctx,
      k = S.k;
    // вынесло волной: проявляется, когда вода отступила
    const a = F0.st === 'sand' ? clamp((S.T - F0.born - 1.2) / 0.5, 0, 1) : 1;
    if (a <= 0) return;
    const flip = F0.st === 'tickle' ? Math.cos(F0.t * TAU) : 1, // переворачивается от щекотки
      wig = F0.st === 'crawl' ? Math.sin(S.T * 8) * 0.08 : 0;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(F0.x, F0.y);
    ctx.fillStyle = 'rgba(0,0,0,.12)';
    ctx.beginPath();
    ctx.ellipse(0, 3 * k, 19 * k, 5 * k, 0, 0, TAU);
    ctx.fill();
    ctx.scale(flip * k * 1.3, k * 0.8); // лежит на песке — сплюснута
    ctx.rotate(0.3 + wig);
    ctx.fillStyle = flip > 0 ? '#ff8c69' : '#ffc9a8';
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 1.4;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const an = -Math.PI / 2 + (i * Math.PI) / 5,
        r = i % 2 ? 6 : 15 + (F0.st === 'crawl' ? Math.sin(S.T * 8 + i) * 1.5 : 0);
      ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (flip > 0) {
      ctx.fillStyle = '#fff3e6';
      for (let i = 0; i < 5; i++) {
        const an = -Math.PI / 2 + (i * TAU) / 5;
        for (const r of [5, 9]) {
          ctx.beginPath();
          ctx.arc(Math.cos(an) * r, Math.sin(an) * r, 1.2, 0, TAU);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }
  // черепашка сбоку: панцирь — из кэша, ножки и голова шевелятся поверх; спряталась — только панцирь
  function paintShell(c, u) {
    c.scale(u, u);
    c.lineWidth = 1.5;
    c.strokeStyle = OUT;
    c.fillStyle = '#2f9e44';
    c.beginPath();
    c.moveTo(-16, -4);
    c.quadraticCurveTo(-15, -20, 0, -20);
    c.quadraticCurveTo(15, -20, 16, -4);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = '#69db7c';
    for (const [x, y, r] of [
      [-7, -10, 4],
      [3, -13, 4.5],
      [10, -7, 3],
      [-12, -6, 2.5],
    ]) {
      // prettier-ignore
      c.beginPath();
      c.arc(x, y, r, 0, TAU);
      c.fill();
    }
    c.fillStyle = '#c3fae8';
    c.beginPath();
    c.rect(-17, -5, 34, 3);
    c.fill();
    c.stroke();
  }
  function drawTurtle() {
    const Q = S.turtle,
      ctx = S.ctx,
      u = S.k * 1.35,
      d = Q.dir;
    const hide = Q.st === 'hide' ? clamp(Math.min(Q.t / 0.25, (2.6 - Q.t) / 0.4), 0, 1) : 0,
      fade = Q.st === 'swim' ? clamp(1 - Q.t / 1.2, 0, 1) : 1,
      walk = Q.st === 'walk';
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.fillStyle = 'rgba(0,0,0,.14)';
    ctx.beginPath();
    ctx.ellipse(Q.x, Q.y + u, 18 * u, 4 * u, 0, 0, TAU);
    ctx.fill();
    const x = Q.x,
      y = Q.y - (walk ? Math.abs(Math.sin(Q.step * 7)) * 1.2 * u : 0) + hide * 2 * u;
    // ножки и голова (втягиваются, когда прячется)
    const out = 1 - hide;
    ctx.fillStyle = '#8ce99a';
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 1.3;
    for (const [lx, ph] of [
      [-10, 0],
      [-4, Math.PI],
      [5, 0],
      [11, Math.PI],
    ]) {
      // prettier-ignore
      const sw = walk ? Math.sin(Q.step * 7 + ph) * 2.5 : 0;
      ctx.beginPath();
      ctx.ellipse(x + (lx + sw) * d * u, y - 2 * u * out, 3 * u, 4.5 * u * out + 0.01, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    if (out > 0.05) {
      const hx = x + (17 + 4 * out) * d * u - 4 * d * u * (1 - out),
        hy = y - (9 + (walk ? Math.sin(Q.step * 3.5) : 0)) * u;
      ctx.beginPath();
      ctx.ellipse(hx, hy, 6 * u * out, 5 * u * out, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      circle(hx + 2.5 * d * u * out, hy - 1.2 * u, 1.3 * u * out, '#222');
      circle(hx + 3 * d * u * out, hy + 1.6 * u, 1.1 * u * out, 'rgba(255,130,160,.6)');
    }
    SP.setScale(S.dpr);
    blit(SP.get(`turtle:${Math.round(u * 100)}`, [-20 * u, -24 * u, 20 * u, 2 * u], (c) => paintShell(c, u)), x, y, hide ? Math.sin(S.T * 20) * 0.04 * hide : 0); // prettier-ignore
    ctx.restore();
  }
  // куличик из песка (зимой — снежок): растёт, пока хомячок лепит; смыло волной — тает
  function drawCastle(c) {
    const ctx = S.ctx,
      u = S.k * 1.15,
      g = ease(c.g),
      a = c.gone === null ? 1 : clamp(1 - (S.T - c.gone) / 1.2, 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(c.x, c.y);
    ctx.fillStyle = 'rgba(0,0,0,.12)';
    ctx.beginPath();
    ctx.ellipse(0, 1 * u, 18 * u, 4 * u, 0, 0, TAU);
    ctx.fill();
    ctx.scale(u, u * g);
    ctx.strokeStyle = 'rgba(120,80,40,.6)';
    ctx.lineWidth = 1.2;
    if (c.kind === 'snowball') {
      ctx.scale(1, 1 / Math.max(g, 0.01)); // снежок растёт целиком, а не по высоте
      for (const [by, r] of [
        [-9 * g, 9 * g],
        [-21 * g, 6 * g],
      ]) {
        // prettier-ignore
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, by, Math.max(r, 0.1), 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#cfe0ee';
        ctx.stroke();
      }
    } else {
      const sand = S.winter ? '#f3deb4' : '#f4c97c';
      ctx.fillStyle = sand;
      ctx.beginPath();
      ctx.moveTo(-15, 0);
      ctx.lineTo(-12, -16);
      for (let i = 0; i < 4; i++) {
        ctx.lineTo(-12 + i * 6, -20);
        ctx.lineTo(-9 + i * 6, -20);
        ctx.lineTo(-9 + i * 6, -16);
        ctx.lineTo(-6 + i * 6, -16);
      }
      ctx.lineTo(12, -16);
      ctx.lineTo(15, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(120,80,40,.45)';
      ctx.fillRect(-2.5, -8, 5, 8);
      if (c.g > 0.95) {
        ctx.strokeStyle = '#7a4a21';
        ctx.beginPath();
        ctx.moveTo(0, -20);
        ctx.lineTo(0, -31);
        ctx.stroke();
        ctx.fillStyle = '#ff6b9d';
        ctx.beginPath();
        ctx.moveTo(0, -31);
        ctx.lineTo(8, -28);
        ctx.lineTo(0, -25);
        ctx.fill();
      }
    }
    ctx.restore();
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
  // ---------- самолётик ----------
  /** Скопировать кадр s из кэша так, чтобы его точка (0, 0) попала в (x, y); rot — поворот (тогда чуть мягче). */
  function blit(s, x, y, rot = 0) {
    if (!s.c) return;
    const d = S.dpr;
    S.ctx.save();
    if (rot) {
      S.ctx.translate(x, y);
      S.ctx.rotate(rot);
      S.ctx.drawImage(s.c, -s.ax / d, -s.ay / d, s.w / d, s.h / d);
    } else {
      S.ctx.setTransform(1, 0, 0, 1, 0, 0);
      S.ctx.drawImage(s.c, Math.round(x * d) - s.ax, Math.round(y * d) - s.ay);
    }
    S.ctx.restore();
  }
  // винтовой самолётик сбоку, нос — вправо (dir −1 — зеркально); в кабине — хомячок-лётчик в очках
  function paintPlane(c, u, dir) {
    c.scale(dir * u, u);
    c.lineWidth = 1.6;
    c.strokeStyle = OUT;
    const shape = (fill, pts) => {
      c.fillStyle = fill;
      c.beginPath();
      pts();
      c.closePath();
      c.fill();
      c.stroke();
    };
    const dot = (x, y, r, col) => {
      c.fillStyle = col;
      c.beginPath();
      c.arc(x, y, r, 0, TAU);
      c.fill();
    };
    // киль
    shape('#ffd43b', () => {
      c.moveTo(-21, -5);
      c.lineTo(-29, -19);
      c.quadraticCurveTo(-25, -22, -22, -18);
      c.lineTo(-13, -6);
    });
    // лётчик — хомячок той же масти, что на берегу: голова над бортом, ушки, очки на лбу
    const fur = (S.look && S.look.fur) || '#f4b88a';
    for (const [ex, ey] of [[-8, -17], [1, -18]]) shape(fur, () => c.arc(ex, ey, 2.8, 0, TAU)); // prettier-ignore
    shape(fur, () => c.arc(-3, -11, 6.8, 0, TAU));
    c.fillStyle = '#4dabf7';
    c.fillRect(-9.5, -16, 13, 2.4);
    shape('#d0ebff', () => c.arc(2.5, -15, 2.6, 0, TAU));
    dot(3, -10.5, 1.3, '#222');
    dot(1.2, -7.6, 1.8, 'rgba(255,130,160,.55)');
    // корпус с белой полоской
    shape('#ff6b6b', () => {
      c.moveTo(15, -6);
      c.quadraticCurveTo(22, -5, 22, 0);
      c.quadraticCurveTo(22, 6, 14, 7);
      c.lineTo(-6, 7);
      c.quadraticCurveTo(-22, 5, -31, -2);
      c.quadraticCurveTo(-31, -6, -25, -6);
    });
    c.fillStyle = 'rgba(255,255,255,.9)';
    c.beginPath();
    c.moveTo(-25, -1.5);
    c.quadraticCurveTo(-6, 0.5, 19, -1);
    c.lineTo(19, 1.6);
    c.quadraticCurveTo(-6, 3.6, -23, 1.2);
    c.closePath();
    c.fill();
    shape('#ffd43b', () => c.ellipse(-25, -2, 6.5, 2.2, 0, 0, TAU)); // хвостовое крылышко
    shape('#fff3bf', () => c.ellipse(-1, 4, 15, 3.6, -0.05, 0, TAU)); // крыло
    c.beginPath();
    c.moveTo(2, 7);
    c.lineTo(5, 13);
    c.stroke();
    shape('#495057', () => c.arc(5, 13.5, 3, 0, TAU)); // колесо
    shape('#ffd43b', () => c.arc(21, 0, 4.5, 0, TAU)); // нос
  }
  /** Только в свободной части экрана: самолётик не залетает под кнопки сбоку и под заголовок. */
  function clipFree() {
    const [x0, x1] = S.planeSpan();
    S.ctx.beginPath();
    S.ctx.rect(x0, S.F.y, x1 - x0, S.H - S.F.y);
    S.ctx.clip();
  }
  function drawPlane() {
    SP.setScale(S.dpr);
    SP.tick();
    const P = S.plane;
    if (!S.planeOn() && !P.hearts.length) return;
    const ctx = S.ctx,
      k = S.k,
      u = k * PLANE_U;
    ctx.save();
    clipFree();
    // сердечки из дыма: облачка одно за другим по контуру сердца, потом тают
    for (const h of P.hearts) {
      const grow = clamp(h.t / 0.9, 0, 1),
        a = clamp((4.5 - h.t) / 1.6, 0, 1) * 0.85,
        R = 16 * k * (0.7 + 0.3 * grow),
        n = 18;
      ctx.fillStyle = `rgba(255,240,246,${a.toFixed(3)})`;
      ctx.beginPath();
      for (let i = 0; i < n * grow; i++) {
        const th = (i / n) * TAU,
          hx = 16 * Math.sin(th) ** 3,
          hy = -(13 * Math.cos(th) - 5 * Math.cos(2 * th) - 2 * Math.cos(3 * th) - Math.cos(4 * th)),
          x = h.x + (hx / 16) * R,
          y = h.y + (hy / 16) * R,
          r = (2.8 + h.t * 0.5) * k;
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, TAU);
      }
      ctx.fill();
    }
    if (S.planeOn()) {
      const [x, y, rot] = S.planePos(),
        d = P.dir;
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.save();
      ctx.scale(d * u, u);
      // ленточка-флажок на верёвочке: развевается волной
      const wv = (i) => Math.sin(S.T * 7 - i * 0.9) * 2.4 * Math.min(1, i / 2 + 0.2);
      ctx.strokeStyle = 'rgba(90,70,60,.75)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(-30, -2);
      ctx.lineTo(-44, wv(0) - 0.5);
      ctx.stroke();
      for (const [col, h0] of [
        ['#ff8fab', 6],
        ['#ffe066', 2],
      ]) {
        ctx.fillStyle = col;
        ctx.beginPath();
        for (let i = 0; i <= 5; i++) ctx.lineTo(-44 - i * 8, wv(i) - h0 + i * h0 * 0.08);
        for (let i = 5; i >= 0; i--) ctx.lineTo(-44 - i * 8, wv(i) + h0 - i * h0 * 0.08);
        ctx.closePath();
        ctx.fill();
        if (h0 > 2) {
          ctx.strokeStyle = OUT;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }
      ctx.restore();
      const s = SP.get(`plane:${d}:${Math.round(u * 100)}`, [-36 * u, -26 * u, 36 * u, 19 * u], (c) => paintPlane(c, u, d)); // prettier-ignore
      if (s.c) ctx.drawImage(s.c, -s.ax / S.dpr, -s.ay / S.dpr, s.w / S.dpr, s.h / S.dpr);
      // пропеллер крутится
      ctx.scale(d * u, u);
      ctx.fillStyle = 'rgba(255,255,255,.4)';
      ctx.beginPath();
      ctx.ellipse(25.5, 0, 2.2, 11, 0, 0, TAU);
      ctx.fill();
      const b = Math.sin(S.T * 31) * 10;
      ctx.strokeStyle = '#6b4a35';
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(25.5, -b);
      ctx.lineTo(25.5, b);
      ctx.stroke();
    }
    ctx.restore();
  }
  /** Ночью — огоньки на крыле и на хвосте (поверх затемнения). Летит вправо — видно левое крыло, красный огонёк. */
  function drawPlaneLights() {
    if (!S.planeOn() || S.dk < 0.25) return;
    const [x, y, rot] = S.planePos(),
      d = S.plane.dir,
      u = S.k * PLANE_U,
      cs = Math.cos(rot),
      sn = Math.sin(rot);
    const at = (px, py) => [x + px * d * u * cs - py * u * sn, y + px * d * u * sn + py * u * cs];
    S.ctx.save();
    clipFree();
    for (const [px, py, col, a] of [
      [-14, 5, d > 0 ? '255,96,96' : '110,255,150', 1],
      [-29, -19, '255,255,235', Math.sin(S.T * 5) > 0.3 ? 1 : 0.2],
    ]) {
      const [lx, ly] = at(px, py),
        r = 11 * S.k,
        al = a * S.dk;
      const g = S.ctx.createRadialGradient(lx, ly, 0, lx, ly, r);
      g.addColorStop(0, `rgba(${col},${(0.8 * al).toFixed(3)})`);
      g.addColorStop(1, `rgba(${col},0)`);
      S.ctx.fillStyle = g;
      S.ctx.fillRect(lx - r, ly - r, r * 2, r * 2);
      circle(lx, ly, 2.1 * S.k, `rgba(${col},${al.toFixed(3)})`);
    }
    S.ctx.restore();
  }
  // ---------- русалочка ----------
  // Жемчужинка из бухты (тот же рисунок, что в locations/cove.js): по пояс в воде, хвост мелькает за ней
  function merPose() {
    const M = S.mer,
      t = M.t;
    if (M.st === 'wave') return { dir: 0, arms: Math.sin(t * 14) > 0 ? 1 : 0 };
    if (M.st !== 'look') return { dir: 0, arms: 0 };
    const wave = t > M.look * 0.45 && t < M.look * 0.45 + 1.1; // сама машет
    return { dir: wave ? 0 : [0, -1, 0, 1][Math.floor(t / 1.3) % 4], arms: wave && Math.sin(t * 12) > 0 ? 1 : 0 };
  }
  function paintTail(c, ms) {
    c.scale(ms, ms);
    c.fillStyle = '#38d9a9';
    c.strokeStyle = OUT;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, 16);
    c.lineTo(-4, -4);
    c.quadraticCurveTo(-18, -16, -22, -6);
    c.quadraticCurveTo(-8, -6, 0, 2);
    c.quadraticCurveTo(8, -6, 22, -6);
    c.quadraticCurveTo(18, -16, 4, -4);
    c.closePath();
    c.fill();
    c.stroke();
    c.strokeStyle = '#96f2d7';
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(-1, 10);
    c.lineTo(-2, 0);
    c.moveTo(1, 10);
    c.lineTo(2, 0);
    c.stroke();
  }
  function drawMermaid() {
    const M = S.mer;
    if (M.st === 'off') return;
    SP.setScale(S.dpr);
    const ctx = S.ctx,
      ms = S.merS(),
      up = S.merUp(),
      x = M.x,
      wy = M.y,
      sk = Math.round(ms * 100);
    // хвост: мелькает за спиной, пока она оглядывается, и уходит под воду последним, когда ныряет
    let tail = null;
    if (M.st === 'look')
      for (const t0 of [1, M.look - 2.3]) {
        const q = (M.t - t0) / 0.9;
        if (q > 0 && q < 1) tail = [x + M.side * 30 * ms, Math.sin(q * Math.PI), M.side * (0.25 - q * 0.5)];
      }
    if (M.st === 'dive') {
      const q = (M.t - 0.4) / 0.9;
      if (q > 0 && q < 1) tail = [x + M.side * 6 * ms, Math.sin(q * Math.PI) * 1.25, M.side * (q - 0.5) * 0.8];
    }
    // светлая вода вокруг
    if (up > 0.02) {
      ctx.fillStyle = `rgba(255,255,255,${(0.35 * up).toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(x, wy, 30 * ms, 7.5 * ms, 0, 0, TAU);
      ctx.fill();
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, S.W, wy + 1.5 * ms); // только то, что над водой
    ctx.clip();
    if (tail) blit(SP.get(`mertail:${sk}`, [-26 * ms, -20 * ms, 26 * ms, 20 * ms], (c) => paintTail(c, ms)), tail[0], wy + 14 * ms - tail[1] * 24 * ms, tail[2]); // prettier-ignore
    if (up > 0) {
      const p = merPose(),
        b = blinkAt(S.T + 1.7, 3) > 0.4 ? 1 : 0;
      const s = SP.get(
        `mer:${p.dir}:${p.arms}:${b}:${sk}`,
        [-72 * ms, -140 * ms, 72 * ms, -18 * ms],
        (c) =>
        drawHamster(c, 0, 0, ms, npcLook('pearl'), { dir: p.dir, clipBelow: -22, happy: true, armsUp: !!p.arms, blink: b, shadow: false }), // prettier-ignore
      );
      blit(s, x, wy + 22 * ms + (1 - up) * 76 * ms);
    }
    ctx.restore();
    if (up > 0.02) {
      // пена у пояса — спереди
      ctx.strokeStyle = `rgba(255,255,255,${(0.9 * up).toFixed(3)})`;
      ctx.lineWidth = 2.4 * S.k;
      ctx.beginPath();
      ctx.ellipse(x, wy, (24 + Math.sin(S.T * 3) * 2.5) * ms, 6.5 * ms, 0, 0, Math.PI);
      ctx.stroke();
    }
  }
  /** Ночью русалочка чуть светится (поверх затемнения): мягкий голубой ореол и искорки. */
  function drawMermaidGlow() {
    const M = S.mer;
    if (M.st === 'off' || S.dk < 0.25) return;
    const ms = S.merS(),
      up = S.merUp(),
      x = M.x,
      y = M.y - 26 * ms + (1 - up) * 40 * ms,
      r = 74 * ms,
      a = 0.3 * up * S.dk;
    const g = S.ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(160,235,255,${a.toFixed(3)})`);
    g.addColorStop(1, 'rgba(160,235,255,0)');
    S.ctx.fillStyle = g;
    S.ctx.fillRect(x - r, y - r, r * 2, r * 2);
    for (let i = 0; i < 5; i++) {
      const tw = 0.5 + 0.5 * Math.sin(S.T * 3 + i * 1.7);
      circle(x + Math.sin(i * 2.4 + S.T * 0.6) * 40 * ms, y + Math.cos(i * 1.9 + S.T * 0.5) * 30 * ms, 1.8 * S.k, `rgba(220,250,255,${(tw * up * S.dk).toFixed(3)})`); // prettier-ignore
    }
  }
  return {
    paintBg,
    drawFar,
    label,
    drawSea,
    drawFish,
    drawShip,
    drawShipLights,
    drawSub,
    drawCloud,
    drawPalm,
    drawNut,
    drawCrab,
    drawGull,
    drawShell,
    drawSnowman,
    drawCastle,
    drawStarfish,
    drawTurtle,
    drawKite,
    drawStrokes,
    drawHam,
    drawFly,
    drawWeather,
    drawNightSky,
    drawPlane,
    drawPlaneLights,
    drawMermaid,
    drawMermaidGlow,
    drawIsleSmoke,
    drawIsleLights,
    drawBeam,
  };
}
