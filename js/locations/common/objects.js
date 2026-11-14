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
import { sfx } from '../../core/audio.js';
import { toast } from '../../ui/toast.js';
import { T, OUT, SP, ART, put, defineArt, defineObjects } from '../../engine/topdown/kinds.js';

/** Цвет листвы по сезону; v — вариант. */
export function leafCol(sea, v) {
  if (sea === 'winter') return '#eef7fd';
  if (sea === 'autumn') return ['#f08c00', '#e8590c', '#fcc419'][v % 3];
  if (sea === 'spring') return ['#8ce99a', '#69db7c', '#ffc9de'][v % 3];
  return ['#40c057', '#2f9e44', '#51cf66'][v % 3];
}
// Листья пальмы и два кокоса; sw — наклон листьев (радианы).
function paintPalmTop(ctx, sea, sw) {
  const col = sea === 'autumn' ? '#94d82d' : '#40c057',
    dark = shade(col, -0.12);
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI * (0.02 + i * 0.192) + sw;
    ctx.save();
    ctx.translate(6, -62);
    ctx.rotate(a);
    ell(ctx, 24, 0, 26, 7.5, i % 2 ? col : dark, OUT, 1.6);
    if (sea === 'winter') ell(ctx, 24, -3, 18, 4, '#fff');
    ctx.restore();
  }
  ell(ctx, 2, -58, 5, 5, '#8d5524', OUT, 1.2);
  ell(ctx, 10, -56, 5, 5, '#8d5524', OUT, 1.2);
}
const PALM_STEP = 0.015; // листья пальмы качаются готовыми кадрами: шаг наклона, радианы
const FLOWER_COLS = ['#ff6b9d', '#ffd43b', '#fff', '#b197fc'],
  FLOWER_AT = [
    [-9, 4, 0],
    [7, -4, 1],
    [2, 10, 2],
  ];

// Рисунки для кэша спрайтов: неподвижные части предметов (см. defineArt в engine/topdown/kinds.js).
defineArt({
  treeBase: [
    [-28, -30, 28, 26],
    (ctx) => {
      ell(ctx, 0, 14, 20, 7, 'rgba(0,0,0,.14)');
      fillRR(ctx, -6, -24, 12, 40, 4, '#a8703f', OUT, 2);
    },
  ],
  treeCrown: [
    [-44, -86, 44, -14],
    (ctx, sea, v) => {
      const c = leafCol(sea, v);
      ell(ctx, -16, -38, 20, 18, c, OUT);
      ell(ctx, 16, -38, 20, 18, c, OUT);
      ell(ctx, 0, -56, 24, 22, c, OUT);
      ell(ctx, 0, -38, 20, 16, c);
      if (sea === 'spring')
        for (const [dx, dy] of [
          [-14, -44],
          [10, -60],
          [16, -36],
          [-2, -48],
        ])
          ell(ctx, dx, dy, 3.5, 3.5, '#fff0f6');
      if (sea === 'summer' && v === 0)
        for (const [dx, dy] of [
          [-12, -40],
          [12, -54],
          [4, -34],
        ])
          ell(ctx, dx, dy, 4, 4, '#fa5252', OUT, 1);
    },
  ],
  treeWinter: [
    [-34, -76, 34, 26],
    (ctx) => {
      ell(ctx, 0, 14, 20, 7, 'rgba(0,0,0,.14)');
      fillRR(ctx, -6, -24, 12, 40, 4, '#a8703f', OUT, 2);
      line(ctx, 0, -20, -16, -44, '#a8703f', 5);
      line(ctx, 0, -22, 15, -48, '#a8703f', 5);
      line(ctx, 0, -24, 0, -58, '#a8703f', 5);
      ell(ctx, -15, -46, 12, 8, '#fff', '#cfe3f0', 1.5);
      ell(ctx, 14, -50, 12, 8, '#fff', '#cfe3f0', 1.5);
      ell(ctx, 0, -60, 13, 9, '#fff', '#cfe3f0', 1.5);
    },
  ],
  pine: [
    [-32, -84, 32, 26],
    (ctx, sea) => {
      ell(ctx, 0, 14, 18, 6, 'rgba(0,0,0,.14)');
      fillRR(ctx, -5, -4, 10, 20, 3, '#8d5524', OUT, 2);
      for (let i = 0; i < 3; i++) {
        const w2 = 26 - i * 6,
          yy = -6 - i * 20;
        poly(ctx, [-w2, yy, 0, yy - 32, w2, yy], sea === 'autumn' ? '#2b8a3e' : '#2f9e44', OUT);
        if (sea === 'winter')
          poly(
            ctx,
            [-w2 * 0.5, yy - 14, 0, yy - 32, w2 * 0.5, yy - 14, w2 * 0.2, yy - 18, 0, yy - 13, -w2 * 0.25, yy - 18],
            '#fff',
          );
      }
    },
  ],
  palmBase: [
    [-24, -68, 24, 26],
    (ctx) => {
      ell(ctx, 0, 14, 18, 6, 'rgba(0,0,0,.14)');
      ctx.beginPath();
      ctx.moveTo(-6, 14);
      ctx.quadraticCurveTo(-10, -30, 2, -62);
      ctx.lineTo(10, -60);
      ctx.quadraticCurveTo(2, -28, 7, 14);
      ctx.closePath();
      ctx.fillStyle = '#c98b5a';
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 2;
      ctx.stroke();
      for (let i = 0; i < 4; i++) line(ctx, -6 + i, 2 - i * 14, 5 + i, -i * 14, 'rgba(0,0,0,.2)', 1.5);
    },
  ],
  palmTop: [[-58, -124, 68, -34], (ctx, sea, q) => paintPalmTop(ctx, sea, q * PALM_STEP)],
  bush: [
    [-26, -24, 26, 22],
    (ctx, sea, v) => {
      const c = leafCol(sea, v + 1);
      ell(ctx, 0, 12, 18, 5, 'rgba(0,0,0,.12)');
      ell(ctx, -9, 2, 12, 11, c, OUT);
      ell(ctx, 9, 2, 12, 11, c, OUT);
      ell(ctx, 0, -6, 13, 12, c, OUT);
      ell(ctx, 0, 3, 10, 8, c);
      if (sea === 'summer' || sea === 'spring') {
        ell(ctx, -6, -4, 2.5, 2.5, v ? '#ff6b9d' : '#fff');
        ell(ctx, 7, 2, 2.5, 2.5, v ? '#ff6b9d' : '#fff');
      }
    },
  ],
  flowers: [
    [-20, -14, 20, 24],
    (ctx, sea, v) => {
      if (sea === 'winter') {
        ell(ctx, 0, 6, 12, 7, '#fff', '#cfe3f0', 1.5);
        return;
      }
      if (sea === 'autumn') {
        ell(ctx, -6, 4, 6, 3.5, '#e8590c', null, 1, 0.5);
        ell(ctx, 7, -3, 6, 3.5, '#fcc419', null, 1, -0.4);
        return;
      }
      for (const [dx, dy, k] of FLOWER_AT) {
        line(ctx, dx, dy, dx, dy + 7, '#2f9e44', 2);
        for (let i = 0; i < 5; i++)
          ell(
            ctx,
            dx + Math.cos((i * TAU) / 5) * 3.5,
            dy + Math.sin((i * TAU) / 5) * 3.5,
            2.6,
            2.6,
            FLOWER_COLS[(v + k) % 4],
          );
        ell(ctx, dx, dy, 1.8, 1.8, '#ffa94d');
      }
    },
  ],
  fenceH: [
    [-28, -24, 28, 12],
    (ctx) => {
      fillRR(ctx, -T / 2, -6, T, 6, 2, '#fff', '#cdbfae', 1.5);
      for (const dx of [-16, 0, 16]) fillRR(ctx, dx - 4, -20, 8, 28, 3, '#fff', '#cdbfae', 1.5);
    },
  ],
  fenceV: [
    [-10, -42, 10, 14],
    (ctx) => {
      fillRR(ctx, -3, -T / 2 - 14, 6, T, 2, '#fff', '#cdbfae', 1.5);
      fillRR(ctx, -5, -22, 10, 30, 3, '#fff', '#cdbfae', 1.5);
    },
  ],
  starfish: [
    [-22, -8, 22, 24],
    (ctx, tx) => {
      ctx.translate(((tx * 7) % 11) - 5, 8);
      ctx.rotate(tx);
      star(ctx, 0, 0, 10, ['#ff922b', '#f783ac', '#ffd43b'][tx % 3], OUT, 1.6);
    },
  ],
  chest: [
    [-22, -24, 22, 22],
    (ctx) => {
      ell(ctx, 0, 12, 18, 5, 'rgba(0,0,0,.14)');
      fillRR(ctx, -16, -10, 32, 22, 4, '#a8703f', OUT, 2);
      fillRR(ctx, -17, -18, 34, 12, 6, '#c98b5a', OUT, 2);
      ctx.fillStyle = '#ffd43b';
      ctx.fillRect(-16, -3, 32, 3);
      fillRR(ctx, -4, -9, 8, 9, 2, '#ffd43b', OUT, 1.5);
    },
  ],
  fountain: [
    [-32, -40, 80, 44],
    (ctx, winter) => {
      const cx = T / 2;
      ell(ctx, cx, 8, 50, 30, '#dee2e6', OUT, 2.5);
      ell(ctx, cx, 5, 42, 24, winter ? '#d9f1ff' : '#74c0fc', OUT, 2);
      fillRR(ctx, cx - 8, -26, 16, 34, 5, '#dee2e6', OUT, 2);
      ell(ctx, cx, -26, 18, 8, '#dee2e6', OUT, 2);
    },
  ],
  bench: [
    [-24, -22, 24, 16],
    (ctx) => {
      fillRR(ctx, -20, -4, 40, 8, 3, '#c98b5a', OUT, 2);
      fillRR(ctx, -20, -18, 40, 10, 3, '#d9a066', OUT, 2);
      line(ctx, -15, 4, -15, 12, OUT, 3);
      line(ctx, 15, 4, 15, 12, OUT, 3);
    },
  ],
  lounger: [
    [-16, -20, 16, 28],
    (ctx) => {
      fillRR(ctx, -12, -16, 24, 40, 6, '#fff', OUT, 2);
      fillRR(ctx, -12, -16, 24, 14, 6, '#ffd43b', OUT, 2);
      ctx.fillStyle = '#ff8fab';
      ctx.fillRect(-10, 4, 20, 5);
      ctx.fillRect(-10, 14, 20, 5);
    },
  ],
  umbrella: [
    [-36, -66, 36, 46],
    (ctx, beach, ci) => {
      if (beach) fillRR(ctx, -26, 2, 26, 40, 5, ['#ff8fab', '#74c0fc', '#ffd43b'][ci], OUT, 1.5);
      line(ctx, 0, 14, 0, -40, OUT, 3);
      const cols = beach ? ['#fa5252', '#fff'] : ['#4dabf7', '#fff'];
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(0, -44);
        ctx.arc(0, -30, 32, Math.PI + (i * Math.PI) / 6, Math.PI + ((i + 1) * Math.PI) / 6);
        ctx.closePath();
        ctx.fillStyle = cols[i % 2];
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(0, -30, 32, Math.PI, 0);
      ctx.closePath();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 2;
      ctx.stroke();
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
        put('treeWinter', o.x, o.y);
        return;
      }
      put('treeBase', o.x, o.y);
      // крона покачивается целиком, шагами в пиксель
      put('treeCrown', o.x + Math.sin(env.t * 1.2 + o.x) * 1.5, o.y, env.season, o.v || 0);
    },
  },
  pine: {
    solid: true,
    map: treeDot,
    draw(ctx, o, env) {
      put('pine', o.x, o.y, env.season);
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
    draw(ctx, o) {
      put('fenceH', o.x, o.y);
    },
  },
  fenceV: {
    solid: true,
    draw(ctx, o) {
      put('fenceV', o.x, o.y);
    },
  },
  bench: {
    solid: true,
    draw(ctx, o) {
      put('bench', o.x, o.y);
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
      put('umbrella', o.x, o.y, o.beach ? 1 : 0, o.beach ? o.tx % 3 : 0);
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
        // струи
        const cx = x + T / 2;
        SP.world();
        for (let i = 0; i < 5; i++) {
          const ph = (t * 0.9 + i / 5) % 1,
            a = -Math.PI / 2 + (i - 2) * 0.35;
          ell(
            ctx,
            cx + Math.cos(a) * ph * 34,
            y - 30 + Math.sin(a) * ph * 40 + ph * ph * 44,
            3.5,
            3.5,
            'rgba(255,255,255,.9)',
          );
        }
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
