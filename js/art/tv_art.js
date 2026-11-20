// Телевизор: рисунки передач. Один и тот же кадр рисуется и на большом экране окна «Телевизор» (features/tv.js),
// и на экранчике мебели в доме (art/furniture.js, small: без ведущих и надписей — только узнаваемая картинка).
//
// Кадр — в своих единицах TV_W × TV_H (16:9); paintTV вписывает его в любой прямоугольник «с обрезкой краёв»
// (экран мебели шире — срезаются верх и низ). Неподвижный фон канала на большом экране рисуется один раз в кадр-кэш
// (opt.cache — Map окна: закрыли окно — кэш ушёл), поверх каждый кадр — только то, что движется.
//
// info — что показывать (готовит features/tv.js):
//   weather: { today, tomorrow } — прогнозы (forecast(day)), now — { kind, force } погода сейчас
//   cook:    { on — выпуск сегодня, dish: { e, name }, ings: [эмодзи], prog — 0..1 (сколько досмотрено), next — текст }
//   animals: { a — кто (ANIMAL_NAMES в data/tv.js) }
//   news:    { items: [{ icon, text }] }
//   toons:   {}
// Экран мебели получает { ch, wx, force, cook } (engine/side/items.js).
import { TAU } from '../core/util.js';
import { ell, fillRR, line, poly, star, heart, text, emoji, shade, rr } from '../core/draw.js';
import { drawHamster, blinkAt } from './hamster.js';

const OUT = '#4a3728';
export const TV_W = 320,
  TV_H = 180;
const wob = (t, f = 1, a = 1) => Math.sin(t * f) * a;

// ---------- значки погоды ----------
function cloud(c, x, y, r, fill = '#fff', stroke = '#7a8ba0') {
  c.beginPath();
  c.arc(x - r * 0.55, y + r * 0.1, r * 0.5, Math.PI * 0.5, Math.PI * 1.5);
  c.arc(x - r * 0.1, y - r * 0.3, r * 0.6, Math.PI * 1.05, Math.PI * 1.85);
  c.arc(x + r * 0.5, y - r * 0.05, r * 0.5, Math.PI * 1.3, Math.PI * 0.5);
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = Math.max(1, r * 0.08);
    c.stroke();
  }
}
function sun(c, x, y, r, t, face = false) {
  c.save();
  c.translate(x, y);
  c.rotate(t * 0.4);
  c.strokeStyle = '#ffb703';
  c.lineWidth = Math.max(1.2, r * 0.16);
  c.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const a = (i * TAU) / 8;
    c.beginPath();
    c.moveTo(Math.cos(a) * r * 1.2, Math.sin(a) * r * 1.2);
    c.lineTo(Math.cos(a) * r * 1.55, Math.sin(a) * r * 1.55);
    c.stroke();
  }
  c.restore();
  ell(c, x, y, r, r, '#ffd43b', '#f59f00', Math.max(1, r * 0.1));
  if (face) {
    ell(c, x - r * 0.33, y - r * 0.1, r * 0.1, r * 0.13, OUT);
    ell(c, x + r * 0.33, y - r * 0.1, r * 0.1, r * 0.13, OUT);
    c.beginPath();
    c.arc(x, y + r * 0.12, r * 0.35, 0.15 * Math.PI, 0.85 * Math.PI);
    c.strokeStyle = OUT;
    c.lineWidth = Math.max(1, r * 0.09);
    c.stroke();
  }
}
/** Значок погоды (вид и сила, как в data/weather.js), центр x, y, размер r; t — время (капли, снежинки, вспышка). */
export function paintWx(c, kind, force, x, y, r, t = 0) {
  const fall = (n, col, speed, len, flake) => {
    for (let i = 0; i < n; i++) {
      const px = x - r * 0.75 + ((i * 0.37 + 0.11) % 1) * r * 1.5,
        ph = (t * speed + i * 0.29) % 1,
        py = y + r * 0.35 + ph * r * 0.9;
      c.globalAlpha = 1 - ph * 0.6;
      if (flake) ell(c, px + wob(t * 2 + i, 1, r * 0.08), py, r * 0.09, r * 0.09, col);
      else line(c, px, py, px - r * 0.08, py + len, col, Math.max(1, r * 0.08));
    }
    c.globalAlpha = 1;
  };
  if (kind === 'rain') {
    const storm = force >= 3,
      dark = force >= 2;
    if (storm && t % 3 < 0.25) {
      c.fillStyle = 'rgba(255,255,200,.5)';
      c.fillRect(x - r * 1.3, y - r * 1.1, r * 2.6, r * 2.4);
    }
    cloud(c, x, y, r, dark ? '#adb5bd' : '#fff', dark ? '#5c677d' : '#7a8ba0');
    if (!dark) sun(c, x + r * 0.75, y - r * 0.55, r * 0.32, t);
    if (!dark) cloud(c, x, y, r, '#fff', '#7a8ba0');
    fall(dark ? 7 : 4, '#4dabf7', 1.4, r * 0.28);
    if (storm)
      poly(
        c,
        [
          x + r * 0.05,
          y + r * 0.15,
          x - r * 0.25,
          y + r * 0.7,
          x,
          y + r * 0.62,
          x - r * 0.15,
          y + r * 1.05,
          x + r * 0.32,
          y + r * 0.45,
          x + r * 0.06,
          y + r * 0.5,
        ],
        '#ffd43b',
        '#e8a400',
        1,
      );
  } else if (kind === 'snow') {
    cloud(c, x, y, r, '#f1f3f5', '#7a8ba0');
    fall(force >= 2 ? 9 : 5, '#fff', 0.5, 0, true);
    if (force >= 2)
      for (let i = 0; i < 2; i++)
        line(
          c,
          x - r * 1.1,
          y + r * (0.5 + i * 0.3),
          x - r * 0.6,
          y + r * (0.45 + i * 0.3),
          '#a5d8ff',
          Math.max(1, r * 0.07),
        );
  } else if (kind === 'cloudy') {
    cloud(c, x - r * 0.2, y - r * 0.15, r * 0.75, '#dee2e6', '#7a8ba0');
    cloud(c, x + r * 0.15, y + r * 0.1, r, '#f1f3f5', '#7a8ba0');
  } else if (kind === 'dust') {
    sun(c, x, y, r * 0.6, t);
    for (let i = 0; i < 3; i++)
      line(
        c,
        x - r,
        y + r * (0.2 + i * 0.25),
        x + r * (0.4 + i * 0.2),
        y + r * (0.2 + i * 0.25),
        '#e0b070',
        Math.max(1, r * 0.1),
      );
  } else {
    sun(c, x, y, r * 0.72, t, true);
    if (kind === 'petals' || kind === 'leaves')
      for (let i = 0; i < 3; i++) {
        const ph = (t * 0.3 + i / 3) % 1,
          px = x - r + ph * r * 2,
          py = y + r * 0.6 + wob(t * 3 + i, 1, r * 0.2);
        ell(c, px, py, r * 0.15, r * 0.09, kind === 'petals' ? '#ffadd2' : '#f08c00', null, 1, t * 2 + i);
      }
  }
}

// ---------- животные (каждое — около начала координат, примерно ±45 по ширине, лапки на y = 34) ----------
const eye = (c, x, y, r = 3) => {
  ell(c, x, y, r, r, '#fff', OUT, 1);
  ell(c, x + r * 0.2, y, r * 0.55, r * 0.6, '#212529');
  ell(c, x + r * 0.4, y - r * 0.35, r * 0.2, r * 0.2, '#fff');
};
const smile = (c, x, y, r = 4) => {
  c.beginPath();
  c.arc(x, y, r, 0.15 * Math.PI, 0.85 * Math.PI);
  c.strokeStyle = OUT;
  c.lineWidth = 1.5;
  c.stroke();
};
const ANIMALS = {
  hamster(c, t) {
    ell(c, 0, 10, 34, 25, '#f2b34c', OUT, 2);
    ell(c, 0, 16, 22, 16, '#fff3d6');
    ell(c, -22, -12, 8, 8, '#f2b34c', OUT, 2);
    ell(c, 22, -12, 8, 8, '#f2b34c', OUT, 2);
    ell(c, -22, -12, 4, 4, '#ffb3c1');
    ell(c, 22, -12, 4, 4, '#ffb3c1');
    ell(c, 0, -2, 26, 20, '#f2b34c', OUT, 2);
    // щёчки с запасом еды
    const puff = 1 + Math.abs(Math.sin(t * 1.5)) * 0.12;
    ell(c, -17, 6, 9 * puff, 8 * puff, '#fff3d6', OUT, 1.5);
    ell(c, 17, 6, 9 * puff, 8 * puff, '#fff3d6', OUT, 1.5);
    eye(c, -9, -6, 3.4);
    eye(c, 9, -6, 3.4);
    ell(c, 0, 2, 3, 2.2, '#ff8fab', OUT, 1);
    smile(c, 0, 4, 3);
    ell(c, -10, 33, 7, 4, '#ffb3c1', OUT, 1.5);
    ell(c, 10, 33, 7, 4, '#ffb3c1', OUT, 1.5);
    ell(c, 0, 24 + wob(t, 3, 1), 6, 5, '#d9480f', OUT, 1); // семечка в лапках
  },
  starfish(c, t) {
    c.save();
    c.rotate(wob(t, 1.2, 0.08));
    star(c, 0, 2, 38, '#ff922b', OUT, 2.5);
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * TAU) / 5;
      for (let k = 1; k < 4; k++) ell(c, Math.cos(a) * k * 8, 2 + Math.sin(a) * k * 8, 2, 2, '#ffd8a8');
    }
    eye(c, -6, -2, 3);
    eye(c, 6, -2, 3);
    smile(c, 0, 4, 4);
    c.restore();
  },
  dolphin(c, t) {
    c.save();
    c.translate(0, wob(t, 2, 4));
    c.rotate(wob(t, 2, 0.12) - 0.15);
    c.beginPath();
    c.moveTo(-44, 6);
    c.quadraticCurveTo(-20, -30, 22, -12);
    c.quadraticCurveTo(40, -6, 46, 2);
    c.quadraticCurveTo(36, 6, 24, 6);
    c.quadraticCurveTo(0, 22, -36, 12);
    c.closePath();
    c.fillStyle = '#74c0fc';
    c.fill();
    c.strokeStyle = OUT;
    c.lineWidth = 2;
    c.stroke();
    c.beginPath();
    c.moveTo(-20, 10);
    c.quadraticCurveTo(0, 18, 24, 6);
    c.quadraticCurveTo(0, 10, -20, 10);
    c.fillStyle = '#e7f5ff';
    c.fill();
    poly(c, [-4, -18, 4, -34, 10, -15], '#4dabf7', OUT, 2);
    poly(c, [-40, 8, -54, -4, -50, 14, -56, 22, -36, 14], '#4dabf7', OUT, 2);
    poly(c, [4, 10, -6, 24, 12, 12], '#4dabf7', OUT, 1.5);
    eye(c, 26, -6, 3);
    smile(c, 36, 0, 4);
    c.restore();
  },
  turtle(c, t) {
    const sw = wob(t, 3, 0.25);
    for (const [x, y, s] of [
      [-26, 20, 1],
      [26, 20, -1],
      [-22, -8, 1],
      [22, -8, -1],
    ]) {
      c.save();
      c.translate(x, y);
      c.rotate(s * sw);
      ell(c, 0, 0, 12, 6, '#8ce99a', OUT, 1.5);
      c.restore();
    }
    ell(c, 40 + wob(t, 1.5, 2), 4, 12, 10, '#8ce99a', OUT, 2);
    eye(c, 44, 1, 2.8);
    smile(c, 46, 6, 3);
    ell(c, 0, 6, 32, 24, '#2f9e44', OUT, 2);
    for (const [x, y] of [
      [0, -2],
      [-15, 8],
      [15, 8],
      [-8, 18],
      [8, 18],
      [-15, -8],
      [15, -8],
    ])
      ell(c, x, y, 6, 5, '#69db7c', shade('#2f9e44', -0.2), 1);
  },
  parrot(c, t) {
    line(c, -44, 30, 44, 30, '#8d5524', 6);
    c.save();
    c.translate(0, 0);
    c.rotate(wob(t, 2.4, 0.06));
    poly(c, [-6, 18, -16, 46, 0, 40, 6, 18], '#1c7ed6', OUT, 1.5);
    ell(c, 0, 4, 18, 26, '#e03131', OUT, 2);
    ell(c, -6, 10, 10, 18, '#ffd43b', OUT, 1.5, 0.3);
    ell(c, -9, 14, 7, 12, '#1c7ed6', null, 1, 0.3);
    ell(c, 2, -22, 15, 14, '#e03131', OUT, 2);
    ell(c, 6, -24, 6, 5, '#fff', OUT, 1);
    ell(c, 7, -24, 2.4, 2.6, '#212529');
    poly(c, [13, -24, 24, -18, 14, -12], '#343a40', OUT, 1.5);
    c.restore();
    ell(c, -6, 28, 4, 3, '#868e96', OUT, 1);
    ell(c, 6, 28, 4, 3, '#868e96', OUT, 1);
  },
  camel(c, t) {
    const st = wob(t, 2.5, 3);
    for (const x of [-22, -12, 14, 24])
      fillRR(c, x - 4, 6, 8, 28 + (x < 0 ? st * 0.3 : -st * 0.3), 4, '#d9a066', OUT, 1.5);
    ell(c, 0, 0, 32, 16, '#e0b070', OUT, 2);
    ell(c, -10, -16, 11, 12, '#e0b070', OUT, 2);
    ell(c, 10, -16, 11, 12, '#e0b070', OUT, 2);
    ell(c, 0, 0, 30, 14, '#e0b070');
    c.beginPath();
    c.moveTo(26, -4);
    c.quadraticCurveTo(40, -10, 38, -26);
    c.lineWidth = 10;
    c.strokeStyle = OUT;
    c.lineCap = 'round';
    c.stroke();
    c.lineWidth = 7;
    c.strokeStyle = '#e0b070';
    c.stroke();
    ell(c, 44, -30, 12, 8, '#e0b070', OUT, 2);
    eye(c, 44, -33, 2.6);
    // длинные ресницы
    for (let i = 0; i < 3; i++) line(c, 42 + i * 2, -36, 41 + i * 3, -40, OUT, 1);
    smile(c, 50, -28, 2.5);
  },
  penguin(c, t) {
    c.save();
    c.rotate(wob(t, 3, 0.1));
    ell(c, 0, 0, 26, 34, '#343a40', OUT, 2);
    ell(c, 0, 6, 18, 26, '#fff');
    ell(c, 0, -20, 18, 14, '#343a40');
    ell(c, -6, -22, 6, 6, '#fff');
    ell(c, 6, -22, 6, 6, '#fff');
    ell(c, -5, -22, 2.4, 2.6, '#212529');
    ell(c, 7, -22, 2.4, 2.6, '#212529');
    poly(c, [-5, -15, 5, -15, 0, -9], '#ff922b', OUT, 1);
    for (const s of [-1, 1]) {
      c.save();
      c.translate(s * 24, -4);
      c.rotate(s * (0.4 + Math.abs(wob(t, 5, 0.3))));
      ell(c, 0, 10, 6, 14, '#343a40', OUT, 1.5);
      c.restore();
    }
    ell(c, -10, 33, 9, 4, '#ff922b', OUT, 1.5);
    ell(c, 10, 33, 9, 4, '#ff922b', OUT, 1.5);
    c.restore();
  },
  octopus(c, t) {
    const col = ['#e64980', '#be4bdb', '#f76707'][Math.floor(t / 3) % 3];
    for (let i = 0; i < 6; i++) {
      const x0 = -20 + i * 8;
      c.beginPath();
      c.moveTo(x0, 4);
      c.quadraticCurveTo(x0 - 10 + wob(t * 3 + i, 1, 8), 22, x0 + (i - 2.5) * 6, 34);
      c.lineWidth = 9;
      c.strokeStyle = OUT;
      c.lineCap = 'round';
      c.stroke();
      c.lineWidth = 6;
      c.strokeStyle = col;
      c.stroke();
    }
    ell(c, 0, -10, 26, 24, col, OUT, 2);
    eye(c, -9, -8, 4);
    eye(c, 9, -8, 4);
    smile(c, 0, 0, 5);
    ell(c, -16, 2, 4, 2.5, 'rgba(255,255,255,.4)');
    ell(c, 16, 2, 4, 2.5, 'rgba(255,255,255,.4)');
  },
  elephant(c, t) {
    for (const x of [-24, -10, 10, 22]) fillRR(c, x - 6, 8, 12, 26, 4, '#adb5bd', OUT, 1.5);
    ell(c, -4, 0, 34, 22, '#adb5bd', OUT, 2);
    ell(c, 26, -14, 18, 18, '#adb5bd', OUT, 2);
    ell(c, 14, -14, 13, 16, '#ced4da', OUT, 2, wob(t, 2, 0.15));
    eye(c, 32, -18, 2.6);
    c.beginPath();
    c.moveTo(40, -8);
    c.quadraticCurveTo(52, 4, 46 + wob(t, 1.6, 4), 22);
    c.lineWidth = 9;
    c.strokeStyle = OUT;
    c.lineCap = 'round';
    c.stroke();
    c.lineWidth = 6;
    c.strokeStyle = '#adb5bd';
    c.stroke();
    line(c, -36, -4, -42, 8, OUT, 2);
  },
  bee(c, t) {
    c.save();
    c.translate(wob(t, 1.3, 10), wob(t, 2.6, 5));
    const fl = Math.abs(Math.sin(t * 24));
    ell(c, -6, -18, 12, 14 * (0.6 + fl * 0.4), 'rgba(231,245,255,.85)', '#74c0fc', 1.5, -0.4);
    ell(c, 8, -18, 12, 14 * (0.6 + fl * 0.4), 'rgba(231,245,255,.85)', '#74c0fc', 1.5, 0.4);
    ell(c, 0, 0, 26, 18, '#ffd43b', OUT, 2);
    c.save();
    c.beginPath();
    c.ellipse(0, 0, 26, 18, 0, 0, TAU);
    c.clip();
    c.fillStyle = '#343a40';
    for (const x of [-10, 2, 14]) c.fillRect(x - 2, -20, 6, 40);
    c.restore();
    poly(c, [-26, -2, -34, 0, -26, 3], '#343a40');
    ell(c, 22, -4, 12, 12, '#ffd43b', OUT, 2);
    eye(c, 26, -6, 2.6);
    smile(c, 27, 0, 3);
    line(c, 22, -15, 18, -26, OUT, 1.5);
    line(c, 27, -15, 30, -26, OUT, 1.5);
    c.restore();
    for (let i = 0; i < 3; i++) {
      const x = -40 + i * 40;
      ell(c, x, 30, 6, 6, ['#ff8fab', '#b197fc', '#ffd43b'][i], OUT, 1);
      ell(c, x, 30, 2.4, 2.4, '#fff3bf');
    }
  },
  owl(c, t) {
    line(c, -44, 32, 44, 32, '#8d5524', 6);
    const turn = wob(t, 0.8, 1);
    ell(c, 0, 4, 26, 30, '#a0662d', OUT, 2);
    ell(c, 0, 12, 16, 20, '#f6dfb8');
    for (let i = 0; i < 3; i++)
      for (let k = 0; k < 2; k++)
        poly(c, [-8 + k * 16 - 3, 6 + i * 8, -8 + k * 16, 10 + i * 8, -8 + k * 16 + 3, 6 + i * 8], null, '#c98b5a', 1);
    poly(c, [-20, -20, -14, -34, -8, -22], '#a0662d', OUT, 1.5);
    poly(c, [20, -20, 14, -34, 8, -22], '#a0662d', OUT, 1.5);
    const blink = t % 4 > 3.8;
    for (const s of [-1, 1]) {
      ell(c, s * 9, -12, 9, 9, '#fff', OUT, 1.5);
      if (blink) line(c, s * 9 - 6, -12, s * 9 + 6, -12, OUT, 2);
      else {
        ell(c, s * 9 + turn * 2, -12, 5, 5, '#ffd43b');
        ell(c, s * 9 + turn * 2, -12, 2.6, 2.6, '#212529');
      }
    }
    poly(c, [-3, -6, 3, -6, 0, 0], '#ff922b', OUT, 1);
    ell(c, -8, 32, 5, 3, '#ffa94d', OUT, 1);
    ell(c, 8, 32, 5, 3, '#ffa94d', OUT, 1);
  },
  squirrel(c, t) {
    c.save();
    c.translate(16, 4);
    c.rotate(wob(t, 1.5, 0.08));
    ell(c, 0, -12, 18, 30, '#e8590c', OUT, 2, 0.3);
    ell(c, 2, -12, 10, 20, '#ff922b', null, 1, 0.3);
    c.restore();
    ell(c, -6, 12, 18, 22, '#e8590c', OUT, 2);
    ell(c, -6, 16, 11, 14, '#ffe8cc');
    ell(c, -10, -14, 15, 14, '#e8590c', OUT, 2);
    poly(c, [-20, -22, -22, -36, -14, -26], '#e8590c', OUT, 1.5);
    poly(c, [-4, -24, -2, -38, 2, -26], '#e8590c', OUT, 1.5);
    eye(c, -14, -16, 2.8);
    eye(c, -4, -16, 2.8);
    ell(c, -9, -9, 2.2, 1.8, OUT);
    ell(c, -8, 12 + wob(t, 3, 1), 7, 8, '#a0662d', OUT, 1.5); // орешек
    fillRR(c, -12, 4 + wob(t, 3, 1), 8, 4, 2, '#6b4423');
    ell(c, -14, 33, 7, 3.5, '#e8590c', OUT, 1.5);
    ell(c, 2, 33, 7, 3.5, '#e8590c', OUT, 1.5);
  },
  seahorse(c, t) {
    c.save();
    c.translate(0, wob(t, 1.6, 4));
    c.beginPath();
    c.moveTo(4, -30);
    c.quadraticCurveTo(20, -10, 6, 8);
    c.quadraticCurveTo(-6, 22, 6, 30);
    c.quadraticCurveTo(14, 36, 8, 40);
    c.lineWidth = 18;
    c.strokeStyle = OUT;
    c.lineCap = 'round';
    c.stroke();
    c.lineWidth = 14;
    c.strokeStyle = '#ffa94d';
    c.stroke();
    ell(c, 0, -32, 12, 10, '#ffa94d', OUT, 2);
    fillRR(c, -22, -36, 16, 7, 3, '#ffa94d', OUT, 1.5);
    poly(c, [8, -40, 14, -46, 12, -36], '#ff922b', OUT, 1);
    eye(c, 0, -34, 2.8);
    for (let i = 0; i < 4; i++) line(c, 12 + (i % 2) * 2, -20 + i * 10, 18, -22 + i * 10, '#e8590c', 2);
    ell(c, -10, -6, 6, 9, 'rgba(255,255,255,.6)', '#ffc078', 1, wob(t, 8, 0.4));
    c.restore();
  },
  giraffe(c, t) {
    for (const x of [-16, -6, 12, 20]) fillRR(c, x - 3, 14, 6, 22, 3, '#ffd43b', OUT, 1.5);
    ell(c, 2, 8, 24, 12, '#ffd43b', OUT, 2);
    c.save();
    c.translate(18, 4);
    c.rotate(-0.35 + wob(t, 1, 0.05));
    fillRR(c, -5, -52, 10, 54, 5, '#ffd43b', OUT, 1.5);
    for (let i = 0; i < 4; i++) ell(c, (i % 2) * 2 - 1, -44 + i * 12, 3, 3.5, '#e8a400');
    ell(c, 4, -56, 13, 8, '#ffd43b', OUT, 2);
    line(c, -2, -62, -4, -70, OUT, 2);
    line(c, 4, -62, 4, -70, OUT, 2);
    ell(c, -4, -71, 2.4, 2.4, '#a0662d');
    ell(c, 4, -71, 2.4, 2.4, '#a0662d');
    eye(c, 4, -58, 2.4);
    if (Math.sin(t * 1.3) > 0.6) ell(c, 18, -52, 5, 2.5, '#862e9c', OUT, 1); // язык
    c.restore();
    for (const [x, y] of [
      [-10, 6],
      [4, 4],
      [14, 10],
      [-4, 12],
    ])
      ell(c, x, y, 4, 3, '#e8a400');
  },
};
/** Где живёт зверь (фон «В мире животных»). */
export const ANIMAL_HOME = {
  hamster: 'meadow',
  bee: 'meadow',
  squirrel: 'forest',
  owl: 'night',
  starfish: 'sea',
  dolphin: 'sea',
  turtle: 'sea',
  octopus: 'sea',
  seahorse: 'sea',
  penguin: 'ice',
  camel: 'desert',
  parrot: 'jungle',
  elephant: 'savanna',
  giraffe: 'savanna',
};
/** Нарисовать зверя a: центр x, y, масштаб s, t — время. */
export function paintAnimal(c, a, x, y, s, t) {
  const f = ANIMALS[a] || ANIMALS.hamster;
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.lineJoin = 'round';
  f(c, t);
  c.restore();
}
/** Звери по очереди — для экранчика мебели. */
const ROUND = Object.keys(ANIMALS);

// ---------- фоны каналов ----------
function sky(c, top, bottom, h = TV_H) {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  c.fillStyle = g;
  c.fillRect(0, 0, TV_W, h);
}
/** Логотип канала в углу: плашка с надписью. */
function logo(c, str, col) {
  c.font = '900 9px Nunito, "Trebuchet MS", sans-serif';
  const w = c.measureText(str).width + 14;
  fillRR(c, 6, 6, w, 15, 7, col, 'rgba(255,255,255,.8)', 1.2);
  text(c, str, 6 + w / 2, 14, 9, '#fff', 'center', 900);
}
function townMap(c, x, y, w, h) {
  fillRR(c, x, y, w, h, 8, '#fff8e1', OUT, 2);
  c.save();
  rr(c, x + 4, y + 4, w - 8, h - 8, 6);
  c.clip();
  c.fillStyle = '#a5d8ff';
  c.fillRect(x, y, w, h);
  // суша Ореховой Гавани: город, лес на северо-западе, пляж на юге
  c.beginPath();
  c.moveTo(x + 4, y + 4);
  c.lineTo(x + w - 4, y + 4);
  c.lineTo(x + w - 4, y + h * 0.55);
  c.quadraticCurveTo(x + w * 0.7, y + h * 0.78, x + w * 0.45, y + h * 0.68);
  c.quadraticCurveTo(x + w * 0.2, y + h * 0.82, x + 4, y + h * 0.7);
  c.closePath();
  c.fillStyle = '#b2f2bb';
  c.fill();
  c.strokeStyle = '#f6dfb8';
  c.lineWidth = 4;
  c.stroke();
  for (const [px, py] of [
    [0.12, 0.15],
    [0.2, 0.1],
    [0.08, 0.3],
    [0.18, 0.26],
  ])
    ell(c, x + w * px, y + h * py, 5, 5, '#51cf66', '#2f9e44', 1);
  for (const [px, py, col] of [
    [0.4, 0.3, '#ff8fab'],
    [0.55, 0.22, '#ffd43b'],
    [0.48, 0.45, '#74c0fc'],
    [0.66, 0.4, '#b197fc'],
    [0.34, 0.5, '#ffa94d'],
  ]) {
    fillRR(c, x + w * px - 5, y + h * py - 3, 10, 8, 1, col, OUT, 1);
    poly(
      c,
      [x + w * px - 6, y + h * py - 3, x + w * px, y + h * py - 8, x + w * px + 6, y + h * py - 3],
      '#e03131',
      OUT,
      1,
    );
  }
  fillRR(c, x + w * 0.78, y + h * 0.12, 7, 22, 2, '#dee2e6', OUT, 1); // Хомяк-Тауэр
  line(c, x + w * 0.3, y + h * 0.6, x + w * 0.8, y + h * 0.2, 'rgba(173,120,60,.5)', 2);
  c.restore();
  text(c, 'Ореховая Гавань', x + w / 2, y + h - 9, 8, '#1864ab', 'center', 900);
}
function kitchen(c) {
  c.fillStyle = '#fff4e6';
  c.fillRect(0, 0, TV_W, TV_H);
  c.fillStyle = '#ffe8cc';
  for (let x = 0; x < TV_W; x += 20) for (let y = 0; y < 120; y += 20) if (((x + y) / 20) % 2) c.fillRect(x, y, 20, 20);
  // окно и полка с баночками
  fillRR(c, 222, 22, 76, 50, 6, '#a5d8ff', OUT, 2);
  line(c, 260, 22, 260, 72, OUT, 2);
  fillRR(c, 18, 52, 80, 6, 2, '#b9834f', OUT, 1.5);
  for (let i = 0; i < 4; i++)
    fillRR(c, 24 + i * 18, 36, 12, 16, 3, ['#ffc9c9', '#d3f9d8', '#fff3bf', '#e5dbff'][i], OUT, 1.2);
  // вывеска шоу
  fillRR(c, 112, 8, 96, 24, 10, '#e8590c', OUT, 2);
  text(c, 'У плиты', 160, 21, 13, '#fff', 'center', 900);
}
/** Стол и плита студии «У плиты» — перед поваром (рисуются после него). */
function counter(c) {
  fillRR(c, -10, 128, TV_W + 20, 70, 0, '#d9a066', OUT, 2);
  fillRR(c, -10, 124, TV_W + 20, 10, 2, '#f1e0c5', OUT, 2);
  fillRR(c, 226, 100, 70, 26, 4, '#dee2e6', OUT, 2);
  ell(c, 245, 104, 10, 3, '#495057');
  ell(c, 277, 104, 10, 3, '#495057');
}
const HOMES_BG = {
  meadow(c) {
    sky(c, '#8fd3ff', '#d0ebff');
    c.fillStyle = '#8ce99a';
    c.beginPath();
    c.moveTo(0, 120);
    c.quadraticCurveTo(110, 96, 200, 118);
    c.quadraticCurveTo(270, 130, 320, 110);
    c.lineTo(320, 180);
    c.lineTo(0, 180);
    c.fill();
    for (let i = 0; i < 9; i++) ell(c, 20 + i * 36, 150 + (i % 3) * 8, 3, 3, ['#ff8fab', '#ffd43b', '#fff'][i % 3]);
  },
  forest(c) {
    sky(c, '#c3fae8', '#e6fcf5');
    for (let i = 0; i < 6; i++) {
      const x = 20 + i * 56;
      fillRR(c, x - 4, 80, 8, 60, 2, '#8d5524');
      poly(c, [x - 26, 96, x, 30 + (i % 2) * 12, x + 26, 96], '#2f9e44');
    }
    c.fillStyle = '#69db7c';
    c.fillRect(0, 136, TV_W, 44);
  },
  night(c) {
    sky(c, '#1c2b5a', '#364fc7');
    ell(c, 268, 36, 16, 16, '#fff3bf');
    for (let i = 0; i < 14; i++) ell(c, (i * 73) % 320, 12 + ((i * 37) % 70), 1.2, 1.2, '#fff');
    c.fillStyle = '#2b3a67';
    c.fillRect(0, 140, TV_W, 40);
  },
  sea(c) {
    sky(c, '#4dabf7', '#1864ab');
    for (let i = 0; i < 6; i++) ell(c, 30 + i * 52, 50 + (i % 3) * 30, 3, 3, 'rgba(255,255,255,.35)');
    c.fillStyle = '#f6dfb8';
    c.beginPath();
    c.moveTo(0, 156);
    c.quadraticCurveTo(160, 140, 320, 160);
    c.lineTo(320, 180);
    c.lineTo(0, 180);
    c.fill();
    for (const x of [30, 290]) {
      line(c, x, 160, x - 6, 120, '#2f9e44', 4);
      line(c, x + 8, 162, x + 12, 130, '#40c057', 4);
    }
  },
  ice(c) {
    sky(c, '#d0ebff', '#e7f5ff');
    poly(c, [0, 90, 60, 60, 110, 92, 170, 54, 240, 96, 320, 70, 320, 130, 0, 130], '#f8f9fa', '#a5d8ff', 2);
    c.fillStyle = '#fff';
    c.fillRect(0, 130, TV_W, 50);
    c.fillStyle = '#74c0fc';
    c.fillRect(0, 166, TV_W, 14);
  },
  desert(c) {
    sky(c, '#ffe8a3', '#fff3bf');
    ell(c, 270, 34, 16, 16, '#ffd43b');
    c.fillStyle = '#f4c27a';
    c.beginPath();
    c.moveTo(0, 130);
    c.quadraticCurveTo(80, 100, 170, 128);
    c.quadraticCurveTo(250, 110, 320, 124);
    c.lineTo(320, 180);
    c.lineTo(0, 180);
    c.fill();
    fillRR(c, 36, 104, 6, 26, 3, '#40c057', OUT, 1);
  },
  jungle(c) {
    sky(c, '#96f2d7', '#c3fae8');
    for (let i = 0; i < 7; i++) {
      ell(c, i * 52, 20 + (i % 2) * 14, 34, 22, i % 2 ? '#2b8a3e' : '#37b24d');
      line(c, i * 52 + 20, 0, i * 52 + 26, 90, '#2f9e44', 2);
    }
    c.fillStyle = '#51cf66';
    c.fillRect(0, 140, TV_W, 40);
  },
  savanna(c) {
    sky(c, '#ffd8a8', '#fff4e6');
    ell(c, 60, 40, 18, 18, '#ffa94d');
    c.fillStyle = '#e9c46a';
    c.fillRect(0, 128, TV_W, 52);
    fillRR(c, 262, 80, 6, 50, 2, '#8d5524');
    ell(c, 265, 78, 34, 10, '#5c940d');
  },
};
function studio(c) {
  sky(c, '#1971c2', '#4dabf7');
  c.strokeStyle = 'rgba(255,255,255,.15)';
  c.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    c.beginPath();
    c.arc(240, 70, 14 + i * 12, 0, TAU);
    c.stroke();
  }
  // экран за диктором
  fillRR(c, 196, 26, 108, 70, 8, '#e7f5ff', '#fff', 3);
}
/** Стол диктора — перед ним (рисуется после). */
function newsDesk(c) {
  poly(c, [10, 128, 180, 128, 196, 180, -6, 180], '#343a40', '#212529', 2);
  fillRR(c, 4, 122, 182, 10, 3, '#495057', '#212529', 1.5);
  text(c, 'НОВОСТИ', 92, 146, 12, '#ffd43b', 'center', 900);
  text(c, 'Ореховой Гавани', 92, 159, 8, '#fff', 'center', 800);
}
function hills(c) {
  sky(c, '#ffdeeb', '#e5dbff');
  const cols = ['#ff8787', '#ffd43b', '#69db7c', '#4dabf7', '#b197fc'];
  for (let i = 0; i < 5; i++) {
    c.beginPath();
    c.arc(160, 210, 170 - i * 14, Math.PI, TAU);
    c.lineWidth = 12;
    c.strokeStyle = cols[i];
    c.stroke();
  }
  c.fillStyle = '#8ce99a';
  c.beginPath();
  c.moveTo(0, 140);
  c.quadraticCurveTo(80, 118, 160, 138);
  c.quadraticCurveTo(240, 156, 320, 130);
  c.lineTo(320, 180);
  c.lineTo(0, 180);
  c.fill();
}

// ---------- что движется ----------
function host(c, look, x, y, s, t, pose = {}) {
  drawHamster(c, x, y, s, look, { time: t, blink: blinkAt(t), shadow: false, ...pose });
}
const PARTS = (f) => f.parts.map((p) => p);
const hhmm = (m) => String(Math.floor(m / 60)) + ':00';
function wxCard(c, x, y, w, title, f, t) {
  fillRR(c, x, y, w, 50, 8, 'rgba(255,255,255,.92)', '#1c7ed6', 2);
  text(c, title, x + w / 2, y + 9, 8, '#1864ab', 'center', 900);
  const ps = PARTS(f),
    n = ps.length,
    cw = (w - 8) / n;
  ps.forEach((p, i) => {
    const cx = x + 4 + cw * (i + 0.5);
    paintWx(c, p.kind, p.force, cx, y + 27, 9, t + i);
    const lab =
      n === 1
        ? 'весь день'
        : i === 0
          ? 'до ' + hhmm(p.to)
          : i === n - 1
            ? 'с ' + hhmm(p.from)
            : hhmm(p.from) + '–' + hhmm(p.to);
    text(c, lab, cx, y + 44, 6.5, '#495057', 'center', 800);
  });
}
const FG = {
  weather(c, t, info, small, look) {
    if (small) {
      paintWx(c, info.wx || 'sun', info.force || 0, 220, 70, 34, t);
      return;
    }
    const today = info.today,
      tomorrow = info.tomorrow,
      now = info.now || today;
    // значок над картой — погода сейчас
    paintWx(c, now.kind, now.force, 232, 58, 20, t);
    if (look) host(c, look, 62, 150, 0.95, t, { talk: true, armsUp: Math.sin(t * 0.8) > 0.6, dir: 1 });
    if (today) wxCard(c, 140, 118, 84, 'Сегодня', today, t);
    if (tomorrow) wxCard(c, 230, 118, 84, 'Завтра', tomorrow, t + 0.5);
  },
  cook(c, t, info, small, look) {
    const on = info.on,
      p = info.prog || 0;
    if (look && !small) host(c, look, 82, 150, 1, t, { talk: true, happy: p >= 1, armsUp: on && p > 0.88 });
    counter(c);
    // кастрюлька на плите и пар
    fillRR(c, 230, 84, 32, 18, 5, '#ff8787', OUT, 1.5);
    line(c, 226, 88, 232, 88, OUT, 2);
    line(c, 260, 88, 266, 88, OUT, 2);
    for (let i = 0; i < 3; i++) {
      const ph = (t * 0.6 + i / 3) % 1;
      c.globalAlpha = 1 - ph;
      ell(c, 240 + i * 6 + wob(t * 3 + i, 1, 3), 80 - ph * 26, 4 + ph * 4, 3 + ph * 3, '#fff');
    }
    c.globalAlpha = 1;
    if (small) {
      ell(c, 120, 112, 30, 12, '#f1f3f5', OUT, 2);
      emoji(c, '🥧', 120, 104, 22);
      return;
    }
    if (!on) {
      fillRR(c, 130, 50, 92, 44, 8, 'rgba(255,255,255,.94)', '#e8590c', 2);
      text(c, 'Следующий', 176, 63, 8, '#e8590c', 'center', 900);
      text(c, 'выпуск', 176, 74, 8, '#e8590c', 'center', 900);
      text(c, info.next || '', 176, 86, 8, OUT, 'center', 900);
      emoji(c, '📅', 160, 112, 18);
      return;
    }
    // миска и продукты: падают по очереди
    const ings = info.ings || [],
      n = ings.length;
    ell(c, 160, 122, 30, 10, '#fff', OUT, 2);
    c.beginPath();
    c.ellipse(160, 122, 30, 18, 0, 0, Math.PI);
    c.fillStyle = '#74c0fc';
    c.fill();
    c.strokeStyle = OUT;
    c.lineWidth = 2;
    c.stroke();
    const k0 = 0.12,
      k1 = 0.6;
    ings.forEach((e, i) => {
      const at = k0 + ((k1 - k0) * i) / Math.max(1, n),
        dur = (k1 - k0) / Math.max(1, n),
        q = Math.min(1, Math.max(0, (p - at) / dur));
      if (q <= 0) {
        emoji(c, e, 120 + i * 22, 100, 14); // ждёт на столе
        return;
      }
      if (q >= 1) return; // уже в миске
      emoji(c, e, 120 + i * 22 + (160 - 120 - i * 22) * q, 100 - Math.sin(q * Math.PI) * 30 + q * 14, 16);
    });
    if (p > k1 && p < 0.88) {
      // перемешивает: ложка по кругу
      const a = t * 6;
      line(c, 160 + Math.cos(a) * 12, 116 + Math.sin(a) * 3, 172 + Math.cos(a) * 6, 90, '#b9834f', 3);
      for (let i = 0; i < 3; i++) star(c, 140 + i * 20, 100 + wob(t * 4 + i, 1, 4), 3, '#fff3bf');
    }
    if (p >= 0.88) {
      // готово: блюдо на тарелке и звёздочки
      ell(c, 160, 104, 26, 8, '#f8f9fa', OUT, 2);
      emoji(c, info.dish ? info.dish.e : '🍽️', 160, 92, 26);
      for (let i = 0; i < 5; i++) {
        const a = (i * TAU) / 5 + t;
        star(c, 160 + Math.cos(a) * 34, 92 + Math.sin(a) * 18, 4, '#ffd43b', '#f59f00', 1);
      }
    }
    // полоска «сколько досмотрено»
    fillRR(c, 110, 166, 100, 8, 4, 'rgba(255,255,255,.8)', OUT, 1);
    if (p > 0) fillRR(c, 110, 166, 100 * Math.min(1, p), 8, 4, '#ff922b');
  },
  animals(c, t, info, small) {
    const a = small ? ROUND[Math.floor(t / 4) % ROUND.length] : info.a;
    paintAnimal(c, a, 160, small ? 96 : 100, small ? 1.3 : 1.35, t);
  },
  news(c, t, info, small, look) {
    const items = info.items || [];
    if (small) {
      // диктор-хомячок: ушки, глазки, бабочка
      ell(c, 76, 88, 8, 8, '#b9bcc6', OUT, 1.5);
      ell(c, 108, 88, 8, 8, '#b9bcc6', OUT, 1.5);
      ell(c, 92, 104, 20, 18, '#b9bcc6', OUT, 2);
      ell(c, 85, 101, 2.5, 3, OUT);
      ell(c, 99, 101, 2.5, 3, OUT);
      ell(c, 92, 108, 3, 2 + Math.abs(Math.sin(t * 8)) * 2, '#c9485b');
      newsDesk(c);
      fillRR(c, 0, 146, TV_W, 18, 0, '#e03131');
      for (let i = 0; i < 7; i++) fillRR(c, ((i * 50 + t * 40) % 360) - 30, 151, 30, 8, 3, '#fff');
      return;
    }
    if (look) host(c, look, 92, 140, 1, t, { talk: true });
    newsDesk(c);
    const i = items.length ? Math.floor(t / 7) % items.length : 0,
      it = items[i];
    if (it) emoji(c, it.icon, 250, 61, 34);
    // бегущая строка
    fillRR(c, 0, 168, TV_W, 12, 0, '#e03131');
    if (it) {
      c.save();
      c.beginPath();
      c.rect(0, 168, TV_W, 12);
      c.clip();
      c.font = '800 8px Nunito, "Trebuchet MS", sans-serif';
      const w = c.measureText(it.text).width,
        x = TV_W - ((t * 40) % (w + TV_W));
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.fillStyle = '#fff';
      c.fillText(it.text, x, 174.5);
      c.restore();
    }
  },
  toons(c, t, info, small, look) {
    const sx = small ? 1 : 1;
    sun(c, 270, 34, 16, t, true);
    // мячик скачет по холмам, за ним — хомячок
    const bx = ((t * 50) % 380) - 30,
      by = 128 - Math.abs(Math.sin(t * 4)) * 40;
    ell(c, bx, by, 12 * sx, 12 * sx, '#ff6b6b', OUT, 2);
    line(c, bx - 12, by, bx + 12, by, '#fff', 3);
    if (look && !small)
      host(c, look, bx - 60, 142 - Math.abs(Math.sin(t * 4 + 1)) * 10, 0.7, t, { walk: t * 1.6, dir: 1, happy: true });
    else ell(c, bx - 40, 128 - Math.abs(Math.sin(t * 4 + 1)) * 12, 12, 10, '#fff', OUT, 1.5);
    for (let i = 0; i < 3; i++) {
      const ph = (t * 0.4 + i / 3) % 1;
      c.globalAlpha = 1 - ph;
      text(c, i % 2 ? '♪' : '♫', 40 + i * 90, 90 - ph * 60, 16, ['#e64980', '#7048e8', '#f08c00'][i], 'center', 900);
    }
    c.globalAlpha = 1;
    heart(c, 160 + wob(t, 2, 40), 40 + wob(t, 3, 6), 6, '#ff8fab');
  },
};
const BG = {
  weather(c, info, small) {
    sky(c, '#74c0fc', '#d0ebff');
    if (small) {
      c.fillStyle = '#8ce99a';
      c.fillRect(0, 120, TV_W, 60);
      townMap(c, 40, 46, 120, 90);
      return;
    }
    townMap(c, 150, 12, 164, 100);
    logo(c, '🌦 ПОГОДА', '#1c7ed6');
  },
  cook(c) {
    kitchen(c);
  },
  animals(c, info, small) {
    const a = small ? 'hamster' : info.a;
    (HOMES_BG[ANIMAL_HOME[a]] || HOMES_BG.meadow)(c);
    if (!small) logo(c, '🐾 В МИРЕ ЖИВОТНЫХ', '#2f9e44');
  },
  news(c) {
    studio(c);
  },
  toons(c) {
    hills(c);
  },
};
// у экранчика мебели «В мире животных» фон под зверя меняется вместе со зверем
const bgSmall = (ch, t) =>
  ch === 'animals'
    ? (c) => (HOMES_BG[ANIMAL_HOME[ROUND[Math.floor(t / 4) % ROUND.length]]] || HOMES_BG.meadow)(c)
    : null;

/** Ключ неподвижного фона канала (для кэша кадров). */
const bgKey = (ch, info) => ch + '|' + (ch === 'animals' ? ANIMAL_HOME[info.a] || '' : '');

/**
 * Нарисовать кадр канала ch в прямоугольнике x, y, w, h (кадр TV_W × TV_H вписан с обрезкой краёв).
 * opt: { small — экран мебели, cache — Map для кадра фона (большой экран), dpr — плотность пикселей канвы,
 *        looks — { weather, cook, news, toons } внешности ведущих }.
 */
export function paintTV(c, ch, x, y, w, h, t, info = {}, opt = {}) {
  const fg = FG[ch] || FG.toons,
    bg = BG[ch] || BG.toons,
    s = Math.max(w / TV_W, h / TV_H),
    ox = x + (w - TV_W * s) / 2,
    oy = y + (h - TV_H * s) / 2;
  c.save();
  c.beginPath();
  c.rect(x, y, w, h);
  c.clip();
  if (opt.cache) {
    const dpr = opt.dpr || 1,
      key = bgKey(ch, info) + '|' + Math.round(w * dpr) + 'x' + Math.round(h * dpr);
    let img = opt.cache.get(key);
    if (!img) {
      img = document.createElement('canvas');
      img.width = Math.max(1, Math.round(w * dpr));
      img.height = Math.max(1, Math.round(h * dpr));
      const g = img.getContext('2d');
      g.setTransform(dpr * s, 0, 0, dpr * s, dpr * (ox - x), dpr * (oy - y));
      g.lineJoin = 'round';
      bg(g, info, false);
      if (opt.cache.size > 8) opt.cache.clear();
      opt.cache.set(key, img);
    }
    c.drawImage(img, x, y, w, h);
  }
  c.translate(ox, oy);
  c.scale(s, s);
  c.lineJoin = 'round';
  if (!opt.cache) (bgSmall(ch, t) || bg)(c, info, !!opt.small);
  fg(c, t, info, !!opt.small, opt.looks && opt.looks[ch]);
  c.restore();
}
