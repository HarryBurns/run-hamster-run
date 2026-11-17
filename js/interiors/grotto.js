// Подводный грот на секретном пляже изнутри (С4): пещерка со сталактитами, светящимися ракушками на стенах и озерцом
// светящейся воды; сундучок с ракушками. Дом «тайного места»: вход — вода у арки грота на пляже
// ('inside:grotto_cave', locations/cove.js), выход на пляж — светлый проход в скале; нырнуть в озерцо — заплыв
// в море города, как раньше ('grotto:back', features/cove.js). Хозяина нет, тут всегда полутемно (dim).
import { ell, fillRR, line, poly, star } from '../core/draw.js';
import { wob, glowWater } from './inside_art.js';

const OUT = '#4a3728';

/** Сталактиты с потолка; с кончиков капает. */
function stalactites(ctx, x0, x1, y, t) {
  for (let i = 0, xx = x0 + 30; xx < x1; xx += 74, i++) {
    const h = 40 + ((i * 37) % 50);
    poly(ctx, [xx - 16, y - 250, xx, y - 250 + h, xx + 16, y - 250], i % 2 ? '#5c6070' : '#6c7080', OUT, 1.5);
    const k = (t * 0.7 + i * 0.37) % 1;
    if (i % 3 === 0) ell(ctx, xx, y - 250 + h + k * 160, 2.5, 4, 'rgba(165,216,255,.8)');
  }
}
/** Светящиеся ракушки и звёздочки на стенах. */
function wallGlow(ctx, x0, x1, y, t) {
  for (let i = 0; i < (x1 - x0) / 90; i++) {
    const xx = x0 + 40 + ((i * 173) % (x1 - x0 - 80)),
      yy = y - 80 - ((i * 61) % 120),
      a = 0.5 + Math.sin(t * 1.8 + i * 2.1) * 0.35;
    ctx.globalAlpha = a;
    ell(ctx, xx, yy, 14, 10, 'rgba(150,242,215,.35)');
    ctx.globalAlpha = 1;
    if (i % 2) ell(ctx, xx, yy, 7, 6, '#96f2d7', OUT, 1);
    else star(ctx, xx, yy, 6, '#ffd8a8', OUT, 1);
  }
}
/** Озерцо светящейся воды у дальней стены: отсюда — нырнуть и проплыть в море города. */
function pool(ctx, x, y, t, k) {
  glowWater(ctx, x - 150, x + 150, y + 4, 22, t);
  // свод подводного прохода
  ctx.beginPath();
  ctx.moveTo(x + 40, y);
  ctx.quadraticCurveTo(x + 100, y - 150, x + 160, y);
  ctx.closePath();
  ctx.fillStyle = '#0b3d5c';
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2;
  ctx.stroke();
  for (let i = 0; i < 3; i++) {
    const kk = (t * 0.5 + i / 3) % 1;
    ctx.globalAlpha = 1 - kk;
    ell(ctx, x + 100 + Math.sin(t + i) * 10, y - 20 - kk * 90, 4 + kk * 3, 4 + kk * 3, null, '#c5f6fa', 1.5);
    ctx.globalAlpha = 1;
  }
  if (k > 0) for (let i = 0; i < 4; i++) ell(ctx, x - 60 + i * 40, y - 4 - k * 20, 6, 3, '#c5f6fa');
  ctx.font = '800 18px ui-rounded, "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#c5f6fa';
  ctx.fillText('🌊 в город', x - 40, y - 50);
}
/** Сундучок с ракушками; потрогали — крышка приоткрывается. */
function chest(ctx, x, y, t, k) {
  for (let i = 0; i < 6; i++) ell(ctx, x - 60 + i * 24, y - 6, 9, 6, ['#ffc9c9', '#fff3bf', '#d0ebff'][i % 3], OUT, 1);
  fillRR(ctx, x - 44, y - 54, 88, 48, 6, '#a8703f', OUT, 2);
  ctx.save();
  ctx.translate(x - 44, y - 54);
  ctx.rotate(-0.5 * k - (Math.sin(t * 1.2) > 0.95 ? 0.08 : 0));
  fillRR(ctx, 0, -20, 88, 22, 10, '#c98b5a', OUT, 2);
  ctx.restore();
  fillRR(ctx, x - 8, y - 46, 16, 14, 3, '#ffd43b', OUT, 1.5);
  if (k > 0) star(ctx, x, y - 84 - k * 10, 9, '#fff9db', OUT, 1);
}
/** Рисунок пещеры позади всех: сталактиты и огоньки. */
const caveArt = (ctx, x, y, t, k, sc) => {
  stalactites(ctx, 0, sc.geo.W, y, t);
  wallGlow(ctx, 0, sc.geo.W, y, t);
};
/** Камни-ступеньки и морская звезда. */
function starfish(ctx, x, y, t, k) {
  ctx.save();
  wob(ctx, x, y - 20, t, k);
  star(ctx, x, y - 20, 22, '#ff8787', OUT, 2);
  ell(ctx, x, y - 20, 6, 6, '#ffc9c9');
  ctx.restore();
  ell(ctx, x + 60, y - 14, 30, 14, '#6c7080', OUT, 2);
  ell(ctx, x - 64, y - 10, 22, 10, '#5c6070', OUT, 2);
}

export default {
  id: 'grotto_cave',
  name: 'Подводный грот',
  hello: '🌊 Подводный грот! Вода светится, на стенах мерцают ракушки. Нырни в озерцо — и доплывёшь до моря города.',
  floors: 1,
  width: 1150,
  maxZoom: 1.1,
  music: 'cove',
  ambience: { drips: 0.6, sea: 0.3 },
  dim: 0.5,
  door: { f: 0, x: 110 },
  shell: { shape: 'cave', wall: '#5c6070', moss: '#2b8a3e', ground: 'sand', bushes: false },
  rooms: [{ id: 'cave', f: 0, x0: 0, x1: 1150, name: 'Грот', wall: '#4f5566', paper: 'rock', floor: 'rock', win: null, lamp: false }],
  lamps: [
    { f: 0, x: 900, h: 30, r: 330, c: '60,180,180' },
    { f: 0, x: 430, h: 120, r: 220, c: '80,160,150' },
  ],
  built: [
    { id: 'door', type: 'door', f: 0, x: 110, look: 'cave', c: '#6c7080', sky: '#fff3bf', ground: '#ffe8a1' },
    { id: 'cave', type: 'prop', f: 0, x: 0, draw: caveArt },
    {
      id: 'chest',
      type: 'prop',
      f: 0,
      x: 420,
      w: 140,
      h: 100,
      draw: chest,
      fx: 'spark',
      fxN: 7,
      sfx: 'coin',
      say: [
        'Сундучок Жемчужинки! Внутри — самые красивые ракушки, она собирает их с детства 🐚',
        'В сундучке ещё и жемчужинка. Жемчужинка хранит жемчужинку — смешно!',
      ],
    },
    {
      id: 'starfish',
      type: 'prop',
      f: 0,
      x: 620,
      w: 110,
      h: 70,
      draw: starfish,
      fx: 'heart',
      say: ['Морская звёздочка дремлет на камне. Тс-с! ⭐', 'Звёздочка шевельнула лучиком — кажется, она улыбается!'],
    },
    { id: 'pool', type: 'prop', f: 0, x: 900, w: 300, h: 120, draw: pool, sfx: 'splash', run: 'grotto:back' },
  ],
  furniture: { fixed: [] },
};
