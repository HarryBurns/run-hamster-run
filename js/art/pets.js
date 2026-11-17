// Питомцы хомячка (этап 17б): котёнок, щенок, крольчонок, ёжик — рисунки кодом в стиле игры.
//
//   drawPet(ctx, kind, pose)   рисует вокруг точки (0, 0) — земля под лапками; смотрит вправо (влево — scale(-1, 1)
//                              у вызывающего: у зверят нет «своей» стороны). Рост — около 34 единиц (под хомячка
//                              на карте «вид сверху»; в доме вызывающий увеличивает).
//   pose: { walk: фаза 0..1 | null, blink: 0 | 1, mood: 'ok' | 'happy' | 'sad', wag: 0..1 (фаза хвоста),
//           eat: 0..1 (наклон головы к миске) }
//   petIcon(kind, размер)      значок для окон.
import { TAU } from '../core/util.js';
import { ell, line, poly, makeCanvas } from '../core/draw.js';

const OUT = '#4a3728';
/** Рамка кадра питомца для кэша спрайтов (единицы рисунка). */
export const PET_BOX = [-30, -52, 30, 10];

const COL = {
  kitten: { body: '#ffa94d', belly: '#fff3d6', dark: '#e8730c', ear: '#ffc9c9' },
  puppy: { body: '#f0c987', belly: '#fff8ec', dark: '#a8703f', ear: '#a8703f' },
  bunny: { body: '#ffffff', belly: '#fff', dark: '#ced4da', ear: '#ffc9de' },
  hedgehog: { body: '#f6dfb8', belly: '#fff3d6', dark: '#8d5a3a', ear: '#f6dfb8' },
};

function legs(ctx, c, walk, xs, y = -3) {
  xs.forEach((x, i) => {
    const sw = walk === null ? 0 : Math.sin(walk * TAU + (i % 2 ? Math.PI : 0)) * 3.2;
    ell(ctx, x + sw, y - Math.max(0, sw * 0.3), 3.6, 4.2, c.body, OUT, 1.6);
  });
}
function face(ctx, x, y, pose, o = {}) {
  const sad = pose.mood === 'sad',
    happy = pose.mood === 'happy',
    ex = o.ex || 4,
    ey = y - 1;
  for (const dx of [-ex + 1.5, ex + 1.5]) {
    if (pose.blink || happy) {
      // закрытые глазки-дужки: «^ ^» у довольного, «– –» у моргающего
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (happy) ctx.arc(x + dx, ey + 1, 2.2, Math.PI, TAU);
      else {
        ctx.moveTo(x + dx - 2, ey);
        ctx.lineTo(x + dx + 2, ey);
      }
      ctx.stroke();
    } else {
      ell(ctx, x + dx, ey, 1.9, 2.3, OUT);
      ell(ctx, x + dx + 0.6, ey - 0.8, 0.7, 0.7, '#fff');
    }
    // бровки домиком
    if (sad) line(ctx, x + dx - 2.6, ey - 3.2 - (dx < 2 ? 0 : 1.6), x + dx + 2.6, ey - 3.2 - (dx < 2 ? 1.6 : 0), OUT, 1.2);
  }
  // нос и рот
  ell(ctx, x + 2.5 + (o.nx || 0), y + 3, o.nose || 1.7, (o.nose || 1.7) * 0.8, o.noseCol || '#ff8fab', OUT, 0.9);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  if (sad) ctx.arc(x + 2.5 + (o.nx || 0), y + 7.6, 2, Math.PI * 1.15, Math.PI * 1.85);
  else ctx.arc(x + 2.5 + (o.nx || 0), y + 4.2, 2, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
  if (!sad) {
    ell(ctx, x - 5, y + 3.5, 2.2, 1.4, 'rgba(255,143,171,.55)');
    ell(ctx, x + 9, y + 3.5, 1.8, 1.4, 'rgba(255,143,171,.55)');
  }
}

const KINDS = {
  kitten(ctx, c, pose, hy) {
    const wag = Math.sin((pose.wag || 0) * TAU) * 0.35;
    // хвост трубой
    ctx.lineCap = 'round';
    for (const [col, lw] of [
      [OUT, 6.6],
      [c.body, 3.8],
    ]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(-12, -12);
      ctx.quadraticCurveTo(-22 - wag * 6, -18, -17 + wag * 10, -30);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
    legs(ctx, c, pose.walk, [-9, -3, 4, 9]);
    ell(ctx, -2, -11, 13, 8.5, c.body, OUT, 2);
    for (const x of [-8, -3, 2]) line(ctx, x, -18.5, x - 1, -14, c.dark, 1.8); // полоски
    ell(ctx, 1, -7.5, 7, 3.4, c.belly);
    // голова, ушки-треугольники
    for (const sx of [-1, 1]) {
      poly(ctx, [9 + sx * 8.5, hy - 5, 9 + sx * 7, hy - 15, 9 + sx * 1.5, hy - 8], c.body, OUT, 1.8);
      poly(ctx, [9 + sx * 7, hy - 7, 9 + sx * 6.4, hy - 12, 9 + sx * 3.4, hy - 8.4], c.ear);
    }
    ell(ctx, 9, hy, 10, 9, c.body, OUT, 2);
    ell(ctx, 11, hy + 4, 5.5, 3.6, c.belly);
    for (const dx of [-2, 2]) line(ctx, 9 + dx, hy - 8.5, 9 + dx * 0.8, hy - 5.5, c.dark, 1.4);
    face(ctx, 9, hy, pose);
    for (const s of [-1, 1]) {
      line(ctx, 15, hy + 3 + s, 21, hy + 2 + s * 2.4, 'rgba(74,55,40,.6)', 0.8);
      line(ctx, 3, hy + 3 + s, -2.5, hy + 2 + s * 2.4, 'rgba(74,55,40,.6)', 0.8);
    }
  },
  puppy(ctx, c, pose, hy) {
    const wag = Math.sin((pose.wag || 0) * TAU) * 7;
    line(ctx, -13, -14, -19 + wag * 0.4, -24 - Math.abs(wag) * 0.2, OUT, 6);
    line(ctx, -13, -14, -19 + wag * 0.4, -24 - Math.abs(wag) * 0.2, c.body, 3.4);
    legs(ctx, c, pose.walk, [-9, -3, 4, 9]);
    ell(ctx, -2, -11.5, 13.5, 9, c.body, OUT, 2);
    ell(ctx, -7, -14, 5, 4, c.dark); // пятно на спинке
    ell(ctx, 1, -7.5, 7, 3.4, c.belly);
    ell(ctx, 9, hy, 10.5, 9.5, c.body, OUT, 2);
    ell(ctx, 6, hy - 2, 4.6, 5, c.dark); // пятно у глаза
    ell(ctx, 12, hy + 4.5, 6, 4.2, c.belly, OUT, 1.2);
    // висячие уши
    const drop = pose.mood === 'sad' ? 3 : 0;
    ell(ctx, 0.5, hy - 1 + drop, 3.8, 7.5, c.ear, OUT, 1.8, 0.35);
    ell(ctx, 17.5, hy - 1 + drop, 3.8, 7.5, c.ear, OUT, 1.8, -0.35);
    face(ctx, 9, hy, pose, { nose: 2.4, noseCol: '#4a3728', nx: 0.5 });
    if (pose.mood === 'happy') ell(ctx, 12, hy + 8.4, 2, 2.6, '#ff8fab', OUT, 0.9); // язычок
  },
  bunny(ctx, c, pose, hy) {
    ell(ctx, -14, -11, 4.6, 4.6, '#fff', OUT, 1.6); // хвостик-помпон
    legs(ctx, c, pose.walk, [-8, 5]);
    ell(ctx, -9, -3, 6.5, 3.6, c.body, OUT, 1.6); // длинная задняя лапка
    ell(ctx, -2, -11.5, 12.5, 9.5, c.body, OUT, 2);
    ell(ctx, 1, -7.5, 6.5, 3.4, c.dark, null, 0, 0);
    ell(ctx, 1, -8, 6.5, 3.2, '#fff');
    // длинные уши: у грустного опущены
    const sad = pose.mood === 'sad',
      tw = Math.sin((pose.wag || 0) * TAU) * 0.08;
    for (const [dx, rot] of [
      [4, sad ? -1.25 : -0.16 + tw],
      [12, sad ? 1.25 : 0.2 - tw],
    ]) {
      ctx.save();
      ctx.translate(9 + (dx - 8), hy - 6);
      ctx.rotate(rot);
      ell(ctx, 0, -10, 3.6, 11, c.body, OUT, 1.8);
      ell(ctx, 0, -10, 1.7, 8, c.ear);
      ctx.restore();
    }
    ell(ctx, 9, hy, 10, 9, c.body, OUT, 2);
    face(ctx, 9, hy, pose);
    line(ctx, 11.5, hy + 5.4, 11.5, hy + 7.4, OUT, 1); // зубик
  },
  hedgehog(ctx, c, pose, hy) {
    legs(ctx, c, pose.walk, [-8, -2, 5, 10], -2.5);
    // колючая спинка
    const pts = [];
    const n = 11;
    for (let i = 0; i <= n; i++) {
      const a = Math.PI * (1.02 - (i / n) * 1.0),
        r = 15;
      pts.push(-4 + Math.cos(a) * (r + 3.5), -9 - Math.sin(a) * (r - 1.5));
      if (i < n) {
        const a2 = Math.PI * (1.02 - ((i + 0.5) / n) * 1.0);
        pts.push(-4 + Math.cos(a2) * (r - 1), -9 - Math.sin(a2) * (r - 5));
      }
    }
    pts.push(11, -5, -19, -5);
    poly(ctx, pts, c.dark, OUT, 1.8);
    for (const [x, y] of [
      [-12, -14],
      [-6, -18],
      [0, -19],
      [-9, -9],
      [-2, -12],
      [5, -15],
    ])
      line(ctx, x, y, x - 1.5, y - 3, '#6b4028', 1.3);
    // мордочка острым носиком вперёд
    ell(ctx, 10, hy + 5, 9.5, 7.5, c.body, OUT, 2);
    poly(ctx, [15, hy + 1, 24, hy + 6.5, 15, hy + 9.5], c.body, OUT, 1.8);
    ell(ctx, 14, hy + 5.5, 4, 4, c.body);
    ell(ctx, 4.5, hy - 0.5, 2.8, 2.8, c.ear, OUT, 1.4);
    const ey = hy + 3;
    if (pose.blink || pose.mood === 'happy') {
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (pose.mood === 'happy') ctx.arc(11, ey + 1, 2.1, Math.PI, TAU);
      else {
        ctx.moveTo(9, ey);
        ctx.lineTo(13, ey);
      }
      ctx.stroke();
    } else {
      ell(ctx, 11, ey, 1.8, 2.1, OUT);
      ell(ctx, 11.6, ey - 0.7, 0.6, 0.6, '#fff');
    }
    if (pose.mood === 'sad') line(ctx, 8.4, ey - 4.6, 13.4, ey - 3, OUT, 1.2);
    ell(ctx, 24, hy + 6.5, 2, 1.8, OUT);
    if (pose.mood !== 'sad') ell(ctx, 8, hy + 8, 2.2, 1.4, 'rgba(255,143,171,.55)');
  },
};

export function drawPet(ctx, kind, pose = {}) {
  const c = COL[kind] || COL.kitten,
    paint = KINDS[kind] || KINDS.kitten;
  const bob = pose.walk === null || pose.walk === undefined ? 0 : Math.abs(Math.sin(pose.walk * TAU)) * (kind === 'bunny' ? 5 : 1.4);
  const hy = (kind === 'hedgehog' ? -15 : -22) + (pose.eat ? pose.eat * 9 : 0) + (pose.mood === 'sad' ? 2 : 0);
  ctx.save();
  ctx.lineJoin = 'round';
  ell(ctx, -1, 0.5, 15, 3.6, 'rgba(52,38,70,.17)');
  ctx.translate(0, -bob);
  paint(ctx, c, { ...pose, walk: pose.walk === undefined ? null : pose.walk }, hy);
  ctx.restore();
}

/** Значок питомца (портрет в рост) для окон. */
export function petIcon(kind, size = 96, mood = 'ok') {
  const { canvas, ctx } = makeCanvas(size, size),
    k = size / 62;
  ctx.translate(size / 2 - 2 * k, size * 0.86);
  ctx.scale(k, k);
  drawPet(ctx, kind, { mood, wag: 0.2 });
  return canvas;
}
