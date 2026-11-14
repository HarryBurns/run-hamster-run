// ОБЩИЕ ВИДЫ ПРЕДМЕТОВ — для любых локаций «вид сверху» (как описывать вид — engine/topdown/kinds.js).
//
//   tree, pine, palm   деревья: на клетку не встать; palm можно потрясти — упадёт кокос (раз в день с пальмы)
//   bush               куст: пройти можно, но медленно;   flowers — цветы (просто украшение)
//   fenceH, fenceV     забор вдоль и поперёк;             bench — скамейка;   fountain — фонтан (две клетки)
//   lounger, umbrella  лежак и зонтик (поле beach: true — пляжный, с ковриком; зимой убран)
//   starfish, crab, chest, flag   пляжные мелочи: морская звезда, крабик, сундук, флажок
//
// Поле v у предмета — вариант рисунка (цвет листвы, цветов). Свой предмет локация добавляет у себя:
// defineObjects({ имя: { art: { … }, draw(ctx, o, env) { put('…', o.x, o.y) }, solid: true } }).
import { G } from '../../core/state.js';
import { addItem, setDayFlag } from '../../core/actions.js';
import { emit } from '../../core/events.js';
import { TAU } from '../../core/util.js';
import { ell, fillRR, line, poly, shade, star } from '../../core/draw.js';
import { shadow, leafTones, flower } from './paint.js';
import { sfx } from '../../core/audio.js';
import { toast } from '../../ui/toast.js';
import { T, OUT, SP, ART, put, defineArt, defineObjects } from '../../engine/topdown/kinds.js';

/** Цвет листвы по сезону; v — вариант. */
export function leafCol(sea, v) {
  return leafTones(sea, v)[1];
}
/**
 * Крона из «клубков» с общим контуром и объёмом: puffs — [[x, y, rx, ry], …] от дальних к ближним,
 * tones — [тёмный, основной, светлый] (leafTones). Так же рисуются кусты и снежные шапки.
 */
export function crown(ctx, puffs, tones, lw = 2.2) {
  ctx.fillStyle = OUT;
  for (const [x, y, rx, ry] of puffs) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx + lw, ry + lw, 0, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = tones[1];
  for (const [x, y, rx, ry] of puffs) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    ctx.fill();
  }
  for (const [x, y, rx, ry] of puffs) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    ctx.clip();
    // тень снизу справа, свет сверху слева
    ctx.fillStyle = tones[0];
    ctx.beginPath();
    ctx.ellipse(x + rx * 0.3, y + ry * 0.62, rx * 1.05, ry * 0.62, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = tones[1];
    ctx.beginPath();
    ctx.ellipse(x - rx * 0.08, y - ry * 0.16, rx * 0.95, ry * 0.86, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = tones[2];
    ctx.beginPath();
    ctx.ellipse(x - rx * 0.3, y - ry * 0.4, rx * 0.46, ry * 0.32, -0.4, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}
/** Ствол с тенью справа и бликом слева. */
function trunk(ctx, x, top, w, bot, col = '#a8703f') {
  fillRR(ctx, x - w / 2, top, w, bot - top, w * 0.35, col, OUT, 2);
  ctx.fillStyle = 'rgba(0,0,0,.16)';
  ctx.fillRect(x + w * 0.12, top + 2, w * 0.3, bot - top - 4);
  ctx.fillStyle = 'rgba(255,255,255,.22)';
  ctx.fillRect(x - w * 0.36, top + 3, w * 0.2, bot - top - 6);
}
// Силуэты крон: 0 — круглая, 1 — высокая, 2 — раскидистая
const CROWNS = [
  [
    [-17, -38, 19, 17],
    [17, -38, 19, 17],
    [0, -58, 23, 21],
    [0, -40, 20, 15],
  ],
  [
    [-12, -34, 16, 15],
    [13, -36, 16, 15],
    [-6, -54, 18, 17],
    [8, -62, 17, 17],
    [0, -74, 14, 13],
  ],
  [
    [-24, -40, 17, 14],
    [24, -40, 17, 14],
    [-10, -52, 19, 16],
    [12, -54, 19, 16],
    [0, -38, 21, 14],
  ],
];
const BLOSSOM = ['#fff0f6', '#ffd6e7', '#ffffff'];
// Листья пальмы и два кокоса; sw — наклон листьев (радианы).
function paintPalmTop(ctx, sea, sw) {
  const col = sea === 'autumn' ? '#94c93d' : sea === 'winter' ? '#58b56b' : '#40c057',
    dark = shade(col, -0.16),
    lite = shade(col, 0.22);
  // сначала дальние листья, потом ближние
  for (const i of [0, 5, 1, 4, 2, 3]) {
    const a = -Math.PI * (0.02 + i * 0.192) + sw;
    ctx.save();
    ctx.translate(6, -62);
    ctx.rotate(a);
    // лист: заострённый, с прожилкой
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(22, -11, 52, 0);
    ctx.quadraticCurveTo(22, 9, 0, 0);
    ctx.closePath();
    ctx.fillStyle = i % 2 ? col : dark;
    ctx.fill();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 1.7;
    ctx.stroke();
    ctx.strokeStyle = i % 2 ? lite : col;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(5, -0.5);
    ctx.quadraticCurveTo(24, -3, 44, -0.5);
    ctx.stroke();
    if (sea === 'winter') {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(26, -4, 15, 3, -0.05, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
  for (const [dx, dy] of [
    [2, -57],
    [11, -55],
    [7, -51],
  ]) {
    ell(ctx, dx, dy, 5, 5, '#8d5524', OUT, 1.3);
    ell(ctx, dx - 1.5, dy - 1.5, 1.6, 1.3, 'rgba(255,255,255,.35)');
  }
}
const PALM_STEP = 0.015; // листья пальмы качаются готовыми кадрами: шаг наклона, радианы
const FLOWER_COLS = ['#ff6b9d', '#ffd43b', '#fff', '#b197fc'],
  FLOWER_AT = [
    [-10, 5, 0],
    [7, -4, 1],
    [1, 11, 2],
    [-3, -7, 3],
    [12, 8, 0],
  ];
const FENCE = [
  ['#fff', '#cdbfae', '#e9e2d8'],
  ['#e0ac78', OUT, '#c98b5a'],
];

// Рисунки для кэша спрайтов: неподвижные части предметов (см. defineArt в engine/topdown/kinds.js).
defineArt({
  treeBase: [
    [-32, -30, 36, 26],
    (ctx, sea) => {
      shadow(ctx, 0, 14, 25, 8);
      // корни
      poly(ctx, [-9, 15, -6, 6, 6, 6, 9, 15], '#a8703f', OUT, 2);
      trunk(ctx, 0, -26, 12, 12);
      if (sea === 'autumn')
        for (const [dx, dy, c] of [
          [-18, 14, '#e8590c'],
          [15, 17, '#f59f00'],
          [22, 11, '#c2410c'],
          [-24, 9, '#fcc419'],
        ])
          ell(ctx, dx, dy, 3.6, 2, c, null, 1, dx);
    },
  ],
  treeCrown: [
    [-48, -94, 48, -14],
    (ctx, sea, v) => {
      const tones = sea === 'spring' && v === 2 ? ['#f7a8c4', '#ffc9de', '#fff0f6'] : leafTones(sea, v);
      crown(ctx, CROWNS[v % 3], tones);
      const pts = CROWNS[v % 3];
      if (sea === 'spring')
        // весной — цветение
        pts.forEach(([x, y, rx, ry], i) => {
          for (let k = 0; k < 3; k++) {
            const a = i * 2.3 + k * 2.1;
            flower(ctx, x + Math.cos(a) * rx * 0.55, y + Math.sin(a) * ry * 0.5, 2.6, BLOSSOM[(i + k) % 3], '#ffd43b');
          }
        });
      if (sea === 'summer' && v === 0)
        for (const [dx, dy] of [
          [-14, -40],
          [12, -56],
          [5, -34],
          [-4, -64],
        ]) {
          ell(ctx, dx, dy, 4.2, 4.2, '#fa5252', OUT, 1.1);
          ell(ctx, dx - 1.3, dy - 1.4, 1.3, 1, 'rgba(255,255,255,.7)');
        }
      if (sea === 'summer' && v === 2)
        for (const [dx, dy] of [
          [-20, -42],
          [16, -50],
          [2, -36],
        ]) {
          ell(ctx, dx, dy, 3.6, 4.4, '#ffd43b', OUT, 1.1);
        }
      if (sea === 'autumn')
        // редкие листья другого цвета — крона пёстрая
        pts.forEach(([x, y, rx, ry], i) => {
          for (let k = 0; k < 3; k++) {
            const a = i * 1.7 + k * 2.3;
            ell(
              ctx,
              x + Math.cos(a) * rx * 0.55,
              y + Math.sin(a) * ry * 0.5,
              3.2,
              2,
              ['#c2410c', '#fcc419', '#e8590c'][(i + k + v) % 3],
              null,
              1,
              a,
            );
          }
        });
    },
  ],
  treeWinter: [
    [-40, -86, 40, 26],
    (ctx, v) => {
      shadow(ctx, 0, 14, 23, 7);
      poly(ctx, [-9, 15, -6, 6, 6, 6, 9, 15], '#a8703f', OUT, 2);
      const br = [
        [0, -20, -18, -46],
        [0, -22, 17, -50],
        [0, -24, 0, -62],
        [-9, -33, -24, -34],
        [8, -36, 24, -38],
      ];
      for (const [ax, ay, bx, by] of br) line(ctx, ax, ay, bx, by, OUT, 7.5);
      trunk(ctx, 0, -26, 12, 12);
      for (const [ax, ay, bx, by] of br) line(ctx, ax, ay, bx, by, '#a8703f', 4.4);
      // снежные шапки на ветках
      const sn = ['#cfe3f0', '#ffffff', '#ffffff'];
      crown(
        ctx,
        v % 2
          ? [
              [-19, -49, 11, 7],
              [18, -53, 11, 7],
              [0, -65, 12, 8],
              [-25, -36, 7, 5],
            ]
          : [
              [-18, -48, 12, 8],
              [17, -52, 12, 8],
              [0, -64, 13, 9],
              [25, -40, 7, 5],
            ],
        sn,
        1.5,
      );
    },
  ],
  pine: [
    [-36, -100, 38, 26],
    (ctx, sea, v) => {
      const tiers = v === 1 ? 4 : 3,
        sc = v === 2 ? 0.86 : 1;
      shadow(ctx, 0, 14, 21 * sc, 7);
      trunk(ctx, 0, -6, 10, 15, '#8d5524');
      const base = sea === 'spring' ? '#37a34a' : sea === 'autumn' ? '#2b8a3e' : '#2f9e44',
        dark = shade(base, -0.2),
        lite = shade(base, 0.2);
      for (let i = 0; i < tiers; i++) {
        const w2 = (28 - i * (v === 1 ? 5 : 6.5)) * sc,
          yy = -6 - i * 19 * sc,
          hgt = 32 * sc;
        // ярус: скруглённый треугольник с зубчиками понизу
        const tier = new Path2D();
        tier.moveTo(0, yy - hgt);
        tier.quadraticCurveTo(w2 * 0.5, yy - hgt * 0.35, w2, yy);
        tier.quadraticCurveTo(w2 * 0.72, yy + 5, w2 * 0.5, yy - 1);
        tier.quadraticCurveTo(w2 * 0.25, yy + 6, 0, yy);
        tier.quadraticCurveTo(-w2 * 0.25, yy + 6, -w2 * 0.5, yy - 1);
        tier.quadraticCurveTo(-w2 * 0.72, yy + 5, -w2, yy);
        tier.quadraticCurveTo(-w2 * 0.5, yy - hgt * 0.35, 0, yy - hgt);
        tier.closePath();
        ctx.fillStyle = base;
        ctx.fill(tier);
        ctx.save();
        ctx.clip(tier);
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.moveTo(0, yy - hgt);
        ctx.lineTo(w2 + 4, yy + 8);
        ctx.lineTo(w2 * 0.25, yy + 8);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = lite;
        ctx.beginPath();
        ctx.ellipse(-w2 * 0.38, yy - hgt * 0.3, w2 * 0.16, hgt * 0.26, 0.5, 0, TAU);
        ctx.fill();
        if (sea === 'winter') {
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.moveTo(0, yy - hgt - 2);
          ctx.lineTo(w2 * 0.62, yy - hgt * 0.36);
          ctx.quadraticCurveTo(w2 * 0.3, yy - hgt * 0.3, w2 * 0.2, yy - hgt * 0.44);
          ctx.quadraticCurveTo(0, yy - hgt * 0.26, -w2 * 0.22, yy - hgt * 0.44);
          ctx.quadraticCurveTo(-w2 * 0.34, yy - hgt * 0.3, -w2 * 0.62, yy - hgt * 0.36);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
        ctx.strokeStyle = OUT;
        ctx.lineWidth = 2.1;
        ctx.stroke(tier);
      }
      if (sea === 'spring')
        for (const [dx, dy] of [
          [-10, -16],
          [8, -34],
          [-3, -52],
        ])
          ell(ctx, dx * sc, dy * sc, 2.2, 3.4, '#b2f2bb');
    },
  ],
  palmBase: [
    [-26, -68, 28, 26],
    (ctx) => {
      shadow(ctx, 0, 14, 20, 7);
      ctx.beginPath();
      ctx.moveTo(-7, 14);
      ctx.quadraticCurveTo(-10, -30, 2, -62);
      ctx.lineTo(10, -60);
      ctx.quadraticCurveTo(2, -28, 8, 14);
      ctx.closePath();
      ctx.fillStyle = '#c98b5a';
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = 'rgba(0,0,0,.14)';
      ctx.fillRect(2, -64, 12, 80);
      ctx.fillStyle = 'rgba(255,255,255,.2)';
      ctx.fillRect(-8, -64, 4, 80);
      ctx.strokeStyle = 'rgba(90,50,20,.45)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(-10, 6 - i * 11);
        ctx.quadraticCurveTo(0, 10 - i * 11, 12, 4 - i * 11);
        ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 2;
      ctx.stroke();
    },
  ],
  palmTop: [[-62, -128, 72, -30], (ctx, sea, q) => paintPalmTop(ctx, sea, q * PALM_STEP)],
  bush: [
    [-30, -28, 32, 22],
    (ctx, sea, v) => {
      const snow = sea === 'winter',
        tones = snow ? ['#cfe3f0', '#ffffff', '#ffffff'] : leafTones(sea, v + 1);
      shadow(ctx, 0, 12, 20, 5.5);
      crown(
        ctx,
        [
          [-10, 2, 12, 10],
          [10, 2, 12, 10],
          [0, -7, 13, 11],
          [0, 4, 10, 7],
        ],
        tones,
        2,
      );
      if (sea === 'summer' || sea === 'spring') {
        const c = [null, '#ff6b9d', '#fff'][v % 3];
        if (c)
          for (const [dx, dy] of [
            [-9, -2],
            [7, 3],
            [1, -9],
            [-2, 5],
          ])
            flower(ctx, dx, dy, 2.2, c, '#ffd43b');
        else
          for (const [dx, dy] of [
            [-8, 0],
            [6, 4],
            [2, -8],
          ])
            ell(ctx, dx, dy, 2.3, 2.3, '#e03131', OUT, 0.8);
      } else if (sea === 'autumn')
        for (const [dx, dy] of [
          [-8, 0],
          [6, 4],
          [2, -8],
        ])
          ell(ctx, dx, dy, 2.3, 2.3, '#c2255c', OUT, 0.8);
    },
  ],
  flowers: [
    [-22, -18, 22, 24],
    (ctx, sea, v) => {
      if (sea === 'winter') {
        ell(ctx, 1, 8.5, 13, 6, '#cfe3f0');
        ell(ctx, 0, 6, 13, 7, '#fff');
        ell(ctx, -4, 3, 5, 2.4, '#fff');
        return;
      }
      if (sea === 'autumn') {
        if (v % 2) {
          // грибы
          for (const [dx, dy, s] of [
            [-5, 6, 1],
            [7, 9, 0.75],
          ]) {
            fillRR(ctx, dx - 2.5 * s, dy - 6 * s, 5 * s, 9 * s, 2, '#fff8ec', OUT, 1.1);
            ctx.beginPath();
            ctx.ellipse(dx, dy - 6 * s, 8 * s, 6 * s, 0, Math.PI, 0);
            ctx.closePath();
            ctx.fillStyle = '#c2410c';
            ctx.fill();
            ctx.strokeStyle = OUT;
            ctx.lineWidth = 1.2;
            ctx.stroke();
            ell(ctx, dx - 3 * s, dy - 9 * s, 1.4, 1.1, '#fff');
          }
        }
        for (const [dx, dy, c, r] of [
          [-8, 2, '#e8590c', 0.5],
          [8, -3, '#fcc419', -0.4],
          [0, 12, '#c2410c', 1.2],
          [-13, 10, '#f59f00', 2],
        ])
          ell(ctx, dx, dy, 5, 3, c, null, 1, r);
        return;
      }
      // пучок зелени, потом цветы на стебельках
      for (const [dx, dy] of FLOWER_AT) ell(ctx, dx, dy + 6, 5, 3, '#4fb85a');
      FLOWER_AT.forEach(([dx, dy, k], i) => {
        if (sea === 'spring' && v % 2) {
          // весной — тюльпаны
          line(ctx, dx, dy + 7, dx, dy - 2, '#2f9e44', 1.8);
          const c = FLOWER_COLS[(v + k) % 4];
          ctx.beginPath();
          ctx.moveTo(dx - 3.4, dy - 2);
          ctx.quadraticCurveTo(dx - 4.4, dy - 8, dx - 2.2, dy - 9);
          ctx.lineTo(dx, dy - 6.4);
          ctx.lineTo(dx + 2.2, dy - 9);
          ctx.quadraticCurveTo(dx + 4.4, dy - 8, dx + 3.4, dy - 2);
          ctx.closePath();
          ctx.fillStyle = c === '#fff' ? '#ff8fab' : c;
          ctx.fill();
          ctx.strokeStyle = 'rgba(74,55,40,.55)';
          ctx.lineWidth = 0.9;
          ctx.stroke();
        } else {
          line(ctx, dx, dy, dx, dy + 7, '#2f9e44', 1.8);
          flower(ctx, dx, dy, i < 3 ? 3.5 : 2.8, FLOWER_COLS[(v + k) % 4]);
        }
      });
    },
  ],
  fenceH: [
    [-28, -30, 28, 14],
    (ctx, v, snow) => {
      const [c, o, d] = FENCE[v % 2];
      fillRR(ctx, -T / 2, -14, T, 5, 2, c, o, 1.5);
      fillRR(ctx, -T / 2, -2, T, 5, 2, d, o, 1.5);
      for (const dx of [-16, 0, 16]) {
        poly(ctx, [dx - 4.5, 9, dx - 4.5, -19, dx, -24, dx + 4.5, -19, dx + 4.5, 9], c, o, 1.5);
        ctx.fillStyle = 'rgba(0,0,0,.08)';
        ctx.fillRect(dx + 1.5, -18, 2.5, 26);
        if (snow) ell(ctx, dx, -22, 5, 3, '#fff', '#cfe3f0', 1);
      }
    },
  ],
  fenceV: [
    [-10, -46, 10, 14],
    (ctx, v, snow) => {
      const [c, o, d] = FENCE[v % 2];
      fillRR(ctx, -3, -T / 2 - 14, 6, T, 2, d, o, 1.5);
      poly(ctx, [-5, 9, -5, -20, 0, -25, 5, -20, 5, 9], c, o, 1.5);
      ctx.fillStyle = 'rgba(0,0,0,.08)';
      ctx.fillRect(1.5, -19, 2.5, 27);
      if (snow) ell(ctx, 0, -23, 5.5, 3, '#fff', '#cfe3f0', 1);
    },
  ],
  starfish: [
    [-22, -8, 22, 24],
    (ctx, tx) => {
      ctx.translate(((tx * 7) % 11) - 5, 8);
      ctx.rotate(tx);
      const c = ['#ff922b', '#f783ac', '#ffd43b'][tx % 3];
      star(ctx, 0, 0, 10, c, OUT, 1.6);
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * TAU) / 5;
        ell(ctx, Math.cos(a) * 5, Math.sin(a) * 5, 1, 1, 'rgba(255,255,255,.75)');
      }
      ell(ctx, 0, 0, 1.4, 1.4, 'rgba(255,255,255,.75)');
    },
  ],
  chest: [
    [-24, -26, 26, 22],
    (ctx) => {
      shadow(ctx, 0, 12, 19, 5);
      fillRR(ctx, -16, -10, 32, 22, 4, '#a8703f', OUT, 2);
      ctx.fillStyle = 'rgba(0,0,0,.13)';
      ctx.fillRect(4, -8, 11, 18);
      fillRR(ctx, -17, -19, 34, 13, 6, '#c98b5a', OUT, 2);
      ctx.fillStyle = 'rgba(255,255,255,.25)';
      ctx.fillRect(-14, -17, 28, 3);
      ctx.fillStyle = '#ffd43b';
      ctx.fillRect(-16, -4, 32, 3);
      ctx.fillRect(-10, -18, 3, 28);
      ctx.fillRect(7, -18, 3, 28);
      fillRR(ctx, -4, -9, 8, 9, 2, '#ffd43b', OUT, 1.5);
      ell(ctx, 0, -5, 1.4, 1.8, OUT);
    },
  ],
  fountain: [
    [-36, -58, 86, 46],
    (ctx, winter) => {
      const cx = T / 2;
      shadow(ctx, cx, 12, 54, 30);
      // чаша: каменный бортик, вода
      ell(ctx, cx, 8, 52, 31, '#dfe4ea', OUT, 2.5);
      ell(ctx, cx, 12, 52, 28, '#c5ccd6');
      ell(ctx, cx, 7, 52, 29, '#e9edf2');
      ell(ctx, cx, 6, 43, 23, winter ? '#dff2fd' : '#6cc4f5', OUT, 2);
      ell(ctx, cx - 6, 10, 30, 12, winter ? '#eef8ff' : '#8ad3fa');
      ctx.strokeStyle = 'rgba(255,255,255,.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, 12, 22, 8, 0, 0.2, 2.6);
      ctx.stroke();
      // камни бортика
      ctx.strokeStyle = 'rgba(74,55,40,.3)';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 14; i++) {
        const a = (i * TAU) / 14;
        line(
          ctx,
          cx + Math.cos(a) * 44,
          6.5 + Math.sin(a) * 24,
          cx + Math.cos(a) * 51,
          7.5 + Math.sin(a) * 30,
          'rgba(74,55,40,.3)',
          1.2,
        );
      }
      // ножка и две чаши
      fillRR(ctx, cx - 7, -22, 14, 30, 4, '#dfe4ea', OUT, 2);
      ctx.fillStyle = 'rgba(0,0,0,.1)';
      ctx.fillRect(cx + 1, -20, 4, 26);
      ell(ctx, cx, -22, 22, 8, '#e9edf2', OUT, 2);
      ell(ctx, cx, -24, 16, 5, winter ? '#dff2fd' : '#8ad3fa', OUT, 1.5);
      fillRR(ctx, cx - 4, -42, 8, 20, 3, '#dfe4ea', OUT, 2);
      ell(ctx, cx, -42, 11, 4.5, '#e9edf2', OUT, 2);
      if (winter) {
        ell(ctx, cx, -45, 9, 4, '#fff', '#cfe3f0', 1.2);
        ell(ctx, cx - 30, -4, 12, 5, '#fff', '#cfe3f0', 1.2);
        ell(ctx, cx + 30, -2, 12, 5, '#fff', '#cfe3f0', 1.2);
      }
    },
  ],
  bench: [
    [-28, -30, 30, 18],
    (ctx, snow) => {
      shadow(ctx, 0, 13, 23, 4.5);
      for (const dx of [-17, 17]) {
        line(ctx, dx, -2, dx, 13, OUT, 4.5);
        line(ctx, dx, -2, dx, 13, '#5b6676', 2.2);
        line(ctx, dx, -22, dx, -4, OUT, 4.5);
        line(ctx, dx, -22, dx, -4, '#5b6676', 2.2);
      }
      // спинка из двух досок и сиденье
      fillRR(ctx, -22, -24, 44, 7, 2.5, '#e0ac78', OUT, 1.8);
      fillRR(ctx, -22, -15, 44, 7, 2.5, '#d59c66', OUT, 1.8);
      fillRR(ctx, -24, -5, 48, 9, 3, '#c98b5a', OUT, 2);
      ctx.fillStyle = 'rgba(255,255,255,.25)';
      ctx.fillRect(-21, -4, 42, 2);
      if (snow) {
        ell(ctx, -6, -6, 15, 4, '#fff', '#cfe3f0', 1.2);
        ell(ctx, 10, -25, 10, 3, '#fff', '#cfe3f0', 1.2);
      }
    },
  ],
  lounger: [
    [-18, -24, 20, 30],
    (ctx) => {
      shadow(ctx, 0, 24, 14, 4);
      fillRR(ctx, -13, -18, 26, 44, 6, '#fff8ec', OUT, 2);
      fillRR(ctx, -13, -20, 26, 16, 6, '#ffd43b', OUT, 2);
      ctx.fillStyle = 'rgba(255,255,255,.4)';
      ctx.fillRect(-10, -17, 20, 3);
      ctx.fillStyle = '#ff8fab';
      for (const dy of [2, 11, 20]) ctx.fillRect(-11, dy, 22, 4);
      fillRR(ctx, -13, -18, 26, 44, 6, null, OUT, 2);
    },
  ],
  umbrella: [
    [-40, -72, 40, 48],
    (ctx, beach, ci) => {
      if (beach) {
        const c = ['#ff8fab', '#74c0fc', '#ffd43b'][ci];
        fillRR(ctx, -27, 3, 27, 40, 5, c, OUT, 1.5);
        ctx.fillStyle = 'rgba(255,255,255,.6)';
        for (let i = 0; i < 4; i++) ctx.fillRect(-26, 8 + i * 9, 25, 3.5);
        fillRR(ctx, -27, 3, 27, 40, 5, null, OUT, 1.5);
      }
      shadow(ctx, 0, 15, 22, 6);
      line(ctx, 0, 14, 0, -44, OUT, 4);
      line(ctx, 0, 14, 0, -44, '#e9ecef', 1.8);
      const cols = beach ? ['#fa5252', '#fff'] : ci ? ['#12b886', '#fff'] : ['#4dabf7', '#fff'];
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(0, -48);
        ctx.arc(0, -30, 34, Math.PI + (i * Math.PI) / 6, Math.PI + ((i + 1) * Math.PI) / 6);
        ctx.closePath();
        ctx.fillStyle = cols[i % 2];
        ctx.fill();
      }
      // тень на правой половине купола, фестоны понизу
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, -30, 34, Math.PI, 0);
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = 'rgba(0,0,0,.1)';
      ctx.fillRect(8, -70, 30, 44);
      ctx.fillStyle = 'rgba(255,255,255,.3)';
      ctx.beginPath();
      ctx.ellipse(-14, -50, 10, 5, -0.6, 0, TAU);
      ctx.fill();
      ctx.restore();
      ctx.beginPath();
      ctx.arc(0, -30, 34, Math.PI, 0);
      for (let i = 5; i >= 0; i--) ctx.arc(-34 + (i + 0.5) * (68 / 6), -30, 68 / 12, 0, Math.PI, true);
      ctx.closePath();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 2;
      ctx.stroke();
      ell(ctx, 0, -65, 2.6, 2.6, cols[0], OUT, 1.3);
    },
  ],
});

/** Потрясти пальму: раз в день с каждой падает кокос. */
function shakePalm(sc, o) {
  const key = o.tx + '_' + o.ty,
    shaken = G.state.dayFlags.palms || {};
  o.shake = G.time + 0.8;
  sfx('paper');
  if (shaken[key]) {
    toast('На этой пальме кокосы на сегодня закончились. Попробуй другую! 🌴');
    return;
  }
  setDayFlag(key, 1, 'palms');
  addItem('ing', 'coconut', 1);
  sc.drops.push({ x: o.x + 6, y: o.y - 58, t: 0, e: '🥥' });
  setTimeout(() => {
    sfx('pop');
    toast('Бум! +1 🥥 Кокос', 'good');
  }, 450);
  emit('coconut');
}
const treeDot = (env) => (env.season === 'winter' ? '#cfe3f0' : env.season === 'autumn' ? '#f08c00' : '#40c057');

// Предмет на земле: неподвижное — спрайтами из кэша (put), подвижное — линиями поверх (перед этим SP.world()).
defineObjects({
  tree: {
    solid: true,
    map: treeDot,
    draw(ctx, o, env) {
      if (env.season === 'winter') {
        put('treeWinter', o.x, o.y, (o.v || 0) % 2);
        return;
      }
      put('treeBase', o.x, o.y, env.season === 'autumn' ? 'autumn' : '');
      // крона покачивается целиком, шагами в пиксель
      put('treeCrown', o.x + Math.sin(env.t * 1.2 + o.x) * 1.5, o.y, env.season, o.v || 0);
    },
  },
  pine: {
    solid: true,
    map: treeDot,
    draw(ctx, o, env) {
      put('pine', o.x, o.y, env.season, (o.v || 0) % 3);
    },
  },
  palm: {
    solid: true,
    map: treeDot,
    tap: { dx: 34, up: 78, down: 18, ox: 4 },
    use: shakePalm,
    draw(ctx, o, env) {
      const t = env.t,
        x = o.x,
        y = o.y,
        sw = Math.sin(t * 1.4 + x * 0.1) * 0.06;
      if (o.shake > t) {
        // пальму трясут: это редко и недолго — рисуем линиями
        SP.world();
        ctx.save();
        ctx.translate(x, y);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ART.palmBase[1](ctx);
        paintPalmTop(ctx, env.season, sw + Math.sin(t * 34) * 0.16);
        ctx.restore();
        return;
      }
      put('palmBase', x, y);
      put('palmTop', x, y, env.season, Math.round(sw / PALM_STEP));
    },
  },
  bush: {
    slow: 0.5,
    rustle: 'paper',
    draw(ctx, o, env) {
      // шуршит, когда сквозь него идут
      const x = o.x,
        y = o.y,
        h = env.hero;
      put(
        'bush',
        Math.abs(h.x - x) < 26 && Math.abs(h.y - y) < 26 ? x + Math.sin(env.t * 22) * 1.8 : x,
        y,
        env.season,
        o.v || 0,
      );
    },
  },
  flowers: {
    flat: true,
    draw(ctx, o, env) {
      const sea = env.season,
        v = o.v || 0;
      if (sea === 'winter' && v !== 0) return;
      put('flowers', o.x, o.y, sea, sea === 'winter' || sea === 'autumn' ? 0 : v);
    },
  },
  fenceH: {
    solid: true,
    draw(ctx, o, env) {
      put('fenceH', o.x, o.y, o.v || 0, env.season === 'winter' ? 1 : 0);
    },
  },
  fenceV: {
    solid: true,
    draw(ctx, o, env) {
      put('fenceV', o.x, o.y, o.v || 0, env.season === 'winter' ? 1 : 0);
    },
  },
  bench: {
    solid: true,
    draw(ctx, o, env) {
      put('bench', o.x, o.y, env.season === 'winter' ? 1 : 0);
    },
  },
  lounger: {
    flat: true,
    draw(ctx, o) {
      put('lounger', o.x, o.y);
    },
  },
  umbrella: {
    draw(ctx, o, env) {
      if (env.season === 'winter' && o.beach) return;
      put('umbrella', o.x, o.y, o.beach ? 1 : 0, o.beach ? o.tx % 3 : o.v ? 1 : 0);
    },
  },
  fountain: {
    solid: [
      [0, 0],
      [1, 0],
    ],
    draw(ctx, o, env) {
      const x = o.x,
        y = o.y,
        t = env.t;
      put('fountain', x, y, env.season === 'winter' ? 1 : 0);
      if (env.season !== 'winter') {
        // струи: из верхней чаши дугами в нижнюю
        const cx = x + T / 2;
        SP.world();
        ctx.fillStyle = 'rgba(255,255,255,.9)';
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const ph = (t * 0.9 + i / 6) % 1,
            a = -Math.PI / 2 + (i - 2.5) * 0.3;
          const px = cx + Math.cos(a) * ph * 30,
            py = y - 46 + Math.sin(a) * ph * 30 + ph * ph * 50;
          ctx.moveTo(px + 3.2, py);
          ctx.arc(px, py, 3.2, 0, TAU);
        }
        ctx.fill();
      }
    },
  },
  starfish: {
    draw(ctx, o) {
      put('starfish', o.x, o.y, o.tx);
    },
  },
  crab: {
    draw(ctx, o, env) {
      const t = env.t,
        cx = o.x + Math.sin(t * 1.3 + o.tx * 2) * 14,
        cy = o.y + 6;
      SP.world();
      for (const sx of [-1, 1]) {
        for (let i = 0; i < 3; i++)
          line(
            ctx,
            cx + sx * 6,
            cy + 2,
            cx + sx * (13 + i * 2),
            cy + 5 + (i - 1) * 4 + Math.sin(t * 12 + i) * 1.5,
            '#c92a2a',
            2,
          );
        ell(ctx, cx + sx * 12, cy - 7, 4.5, 3.5, '#fa5252', OUT, 1.2);
      }
      ell(ctx, cx, cy, 10, 7, '#fa5252', OUT, 1.6);
      ell(ctx, cx - 3.5, cy - 6, 2, 2.5, '#fff', OUT, 1);
      ell(ctx, cx + 3.5, cy - 6, 2, 2.5, '#fff', OUT, 1);
    },
  },
  flag: {
    draw(ctx, o, env) {
      const x = o.x,
        y = o.y;
      SP.world();
      line(ctx, x, y + 12, x, y - 44, OUT, 3);
      poly(ctx, [x, y - 44, x + 26, y - 37 + Math.sin(env.t * 4) * 2, x, y - 28], '#fa5252', OUT, 1.8);
    },
  },
  chest: {
    draw(ctx, o, env) {
      put('chest', o.x, o.y);
      SP.world();
      star(ctx, o.x + 12, o.y - 24 + Math.sin(env.t * 4) * 2, 4, '#fff3bf');
    },
  },
});
