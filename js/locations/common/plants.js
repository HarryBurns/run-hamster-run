// РАСТЕНИЯ С ПЛОДАМИ — общие виды предметов для любых локаций «вид сверху» (город, а дальше лес).
//
//   cocoPalm     кокосовая пальма: в сезон под листьями видны орехи — можно стрясти кокос
//   bananaPalm   банановая пальма: в сезон висит гроздь бананов
//   mangoTree    манговое дерево: в сезон на ветках оранжевые плоды
//   berryBush    куст черники (пройти сквозь него можно, но медленно): в сезон на нём синие ягоды
//   mushrooms    грибы: в свой сезон выросли, вне сезона их нет совсем (и нажать не на что)
//
// Правила одни для всех:
//  - плод есть только в сезон продукта — месяцы берутся из общей таблицы data/seasons.js;
//  - с одного растения собирают раз в день (отметка дня dayFlags.plants), наутро плод вырастает снова;
//    сколько плодов за раз — GATHER в data/economy.js;
//  - с плодами и без плодов растение выглядит по-разному (разные спрайты в кэше);
//  - нажали в сезон — хомячок подходит и собирает; рядом с растением, где есть что собрать, появляется
//    подпись «Сорвать банан 🍌» и кнопка в HUD (и работает клавиша E). Нажали не в сезон — добрая подсказка,
//    когда поспеет.
// Локация ставит растения обычным m.add('bananaPalm', x, y) и подключает часть: parts: [createPlants()] —
// она даёт подпись, кнопку и клавишу. Обычные деревья, пальмы и кусты (без плодов) — objects.js.
import { G } from '../../core/state.js';
import { addItem, award, setDayFlag, setFlag } from '../../core/actions.js';
import { emit } from '../../core/events.js';
import { TAU, dist } from '../../core/util.js';
import { ell, line, shade } from '../../core/draw.js';
import { sfx } from '../../core/audio.js';
import { toast } from '../../ui/toast.js';
import { ING_BY_ID, GATHER, SEASONS, DAYS_PER_MONTH, ripeIn, seasonsOf, whenRipe } from '../../data/index.js';
import { T, OUT, SP, ART, put, label, defineObjects } from '../../engine/topdown/kinds.js';
import { shadow, leafTones, flower } from './paint.js';
import { crown, paintPalmTop, PALM_STEP, treeDot } from './objects.js';

// ---------- что на чём растёт ----------
// gives — продукт (data/food.js); verb — подпись действия; btn — она же коротко, для кнопки HUD;
// many — как назвать плоды, когда их дали несколько («+2 🍌 Бананы»);
// wait — начало подсказки не в сезон («Бананы поспеют» + «весной»); empty — когда сегодня уже собрано;
// drop — плод падает с дерева значком; top — на какой высоте над клеткой висит подпись.
export const PLANTS = {
  cocoPalm: {
    gives: 'coconut',
    verb: 'Стрясти кокос',
    btn: 'Стрясти',
    wait: 'Кокосы поспеют',
    empty: 'На этой пальме кокосы на сегодня закончились. Завтра созреют новые! 🌴',
    got: 'Бум!',
    drop: [6, -58],
    top: 132,
  },
  bananaPalm: {
    gives: 'banana',
    verb: 'Сорвать бананы',
    btn: 'Сорвать',
    many: 'Бананы',
    wait: 'Бананы поспеют',
    empty: 'С этой пальмы бананы уже сорваны. Завтра поспеют новые! 🌴',
    drop: [12, -40],
    top: 112,
  },
  mangoTree: {
    gives: 'mango',
    verb: 'Сорвать манго',
    btn: 'Сорвать',
    wait: 'Манго поспеет',
    empty: 'Спелые манго с этого дерева уже сорваны. Завтра поспеют новые! 🌳',
    drop: [-8, -34],
    top: 104,
  },
  berryBush: {
    gives: 'blueberry',
    verb: 'Собрать чернику',
    btn: 'Собрать',
    wait: 'Черника поспеет',
    empty: 'С этого куста ягоды уже собраны. Завтра поспеют новые! 🌿',
    top: 46,
  },
  mushrooms: {
    gives: 'mushroom',
    verb: 'Сорвать гриб',
    btn: 'Сорвать',
    wait: 'Грибы вырастут',
    empty: 'Здесь грибы уже собраны. Завтра вырастут новые! 🍂',
    top: 44,
  },
};
const monthNow = () => Math.floor(G.state.day / DAYS_PER_MONTH) % 12;
const keyOf = (o) => o.tx + '_' + o.ty;
/** Сезон ли сейчас у растения. */
export const plantInSeason = (o) => ripeIn(PLANTS[o.type].gives, monthNow());
/** Есть ли на растении плоды прямо сейчас: сезон, и сегодня с него ещё не собирали. */
export const hasFruit = (o) => plantInSeason(o) && !(G.state.dayFlags.plants || {})[keyOf(o)];

/** Хомячок подошёл к растению: собрать плоды — или подсказать, когда они будут. */
export function gather(sc, o) {
  const pl = PLANTS[o.type],
    id = pl.gives,
    ing = ING_BY_ID[id];
  o.shake = G.time + 0.8;
  sfx('paper');
  if (!plantInSeason(o)) {
    toast(`${pl.wait} ${whenRipe(id)} ${SEASONS[seasonsOf(id)[0]].icon}`);
    return false;
  }
  if (!hasFruit(o)) {
    toast(pl.empty);
    return false;
  }
  const n = GATHER[id].n;
  setDayFlag(keyOf(o), 1, 'plants');
  addItem('ing', id, n);
  if (pl.drop)
    for (let i = 0; i < n; i++) sc.drops.push({ x: o.x + pl.drop[0] + i * 11, y: o.y + pl.drop[1] - i * 7, t: 0, e: ing.e });
  setTimeout(() => {
    sfx('pop');
    toast(`${pl.got ? pl.got + ' ' : ''}+${n} ${ing.e} ${(n > 1 && pl.many) || ing.name}`, 'good');
  }, 450);
  // наклейки: первый плод и «собрала всё, что растёт» (что уже собирала — отметки в flags)
  award('x_gather', { delay: 1400 });
  if (!G.state.flags['gather:' + id]) setFlag('gather:' + id);
  if (Object.keys(GATHER).every((q) => G.state.flags['gather:' + q])) award('x_gather_all', { delay: 2600 });
  if (id === 'coconut') emit('coconut');
  emit('gather', { id, n });
  emit('hud');
  return true;
}

// ---------- рисунки ----------
const BANANA_LEAVES = [
  // угол (радианы, 0 — вправо, −π/2 — вверх), длина, ширина; от дальних к ближним
  [-1.57, 46, 17],
  [-2.2, 48, 17],
  [-0.95, 48, 17],
  [-2.8, 46, 16],
  [-0.35, 46, 16],
  [-3.4, 40, 15],
  [0.25, 40, 15],
];
/** Лист банана: широкая «лопасть» с прожилкой и надрывами по краю; snow — с какой стороны листа лежит снег (−1, 1). */
function bananaLeaf(ctx, len, wid, col, dark, rib, snow) {
  const blade = new Path2D();
  blade.moveTo(0, 0);
  blade.bezierCurveTo(len * 0.12, -wid, len * 0.82, -wid * 0.95, len, 0);
  blade.bezierCurveTo(len * 0.82, wid * 0.8, len * 0.12, wid * 0.8, 0, 0);
  blade.closePath();
  ctx.fillStyle = col;
  ctx.fill(blade);
  ctx.save();
  ctx.clip(blade);
  // нижняя половина темнее
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -1.5, len, 0);
  ctx.lineTo(len, wid);
  ctx.lineTo(0, wid);
  ctx.closePath();
  ctx.fill();
  // надрывы — тонкие тёмные чёрточки от прожилки к краю
  ctx.strokeStyle = 'rgba(30,70,20,.28)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 1; i < 7; i++) {
    const x = (len * i) / 7.4;
    ctx.moveTo(x, -1);
    ctx.lineTo(x + 3, -wid);
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 3, wid);
  }
  ctx.stroke();
  if (snow) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(len * 0.55, wid * 0.52 * snow, len * 0.3, wid * 0.24, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 1.8;
  ctx.stroke(blade);
  ctx.strokeStyle = rib;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(3, -0.5);
  ctx.quadraticCurveTo(len * 0.5, -2.5, len - 4, -0.5);
  ctx.stroke();
}
/** Один банан: жёлтый полумесяц с тёмным кончиком; (x, y) — верх, a — наклон. */
function bananaFruit(ctx, x, y, a, len = 13) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.beginPath();
  ctx.moveTo(-2.4, 0);
  ctx.quadraticCurveTo(-5.6, len * 0.55, -0.6, len);
  ctx.quadraticCurveTo(1.6, len + 0.6, 2, len - 1.4);
  ctx.quadraticCurveTo(-0.4, len * 0.5, 2.4, 0);
  ctx.closePath();
  ctx.fillStyle = '#ffd43b';
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.65)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-1.6, 2);
  ctx.quadraticCurveTo(-3.2, len * 0.5, -1.2, len - 3);
  ctx.stroke();
  ell(ctx, 0.6, len - 0.4, 1.3, 1.1, '#7a4a1e');
  ctx.restore();
}
function paintBananaTop(ctx, sea, fruit) {
  const col = sea === 'autumn' ? '#a5c93f' : sea === 'winter' ? '#62b874' : sea === 'spring' ? '#6fd45c' : '#52c24a',
    dark = shade(col, -0.16),
    rib = shade(col, 0.42);
  BANANA_LEAVES.forEach(([a, len, wid], i) => {
    ctx.save();
    ctx.translate(Math.cos(a) * 3, -46 + Math.sin(a) * 3);
    ctx.rotate(a);
    // снег — на той стороне листа, что смотрит вверх
    bananaLeaf(ctx, len, wid, i % 2 ? shade(col, 0.08) : col, i % 2 ? col : dark, rib, sea !== 'winter' ? 0 : Math.cos(a) >= 0 ? -1 : 1);
    ctx.restore();
  });
  // молодой лист-свёрток в середине
  ell(ctx, 0, -50, 4, 7, shade(col, 0.3), OUT, 1.4);
  if (!fruit) return;
  // гроздь: стебель дугой вниз, два яруса бананов и лиловый бутон на конце
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(4, -44);
  ctx.quadraticCurveTo(15, -42, 14, -26);
  ctx.stroke();
  ctx.strokeStyle = '#7fa046';
  ctx.lineWidth = 2.6;
  ctx.stroke();
  for (const [dx, dy, a] of [
    [7, -33, 0.75],
    [10.5, -34, 0.38],
    [14, -34.5, 0],
    [17.5, -34, -0.38],
    [21, -33, -0.75],
  ])
    bananaFruit(ctx, dx, dy, a);
  for (const [dx, dy, a] of [
    [9, -25, 0.6],
    [12.4, -26, 0.22],
    [15.8, -26, -0.22],
    [19, -25, -0.6],
  ])
    bananaFruit(ctx, dx, dy, a, 12);
  ell(ctx, 14, -9.5, 3.4, 4.6, '#9c36b5', OUT, 1.2);
  ell(ctx, 13, -11, 1.1, 1.6, 'rgba(255,255,255,.4)');
}

// Манговое дерево: густая тёмная крона; зимой листья остаются, на них лежит снег
const MANGO_CROWN = [
  [-21, -37, 19, 16],
  [21, -37, 19, 16],
  [-10, -57, 20, 18],
  [12, -59, 20, 18],
  [0, -41, 23, 16],
];
const MANGO_AT = [
  [-25, -27, -0.3],
  [-9, -23, 0.15],
  [8, -24, -0.1],
  [25, -28, 0.3],
  [-2, -46, 0.2],
  [17, -44, -0.25],
];
const MANGO_TONES = {
  spring: ['#2f9e44', '#40c057', '#8ce99a'],
  summer: ['#23803a', '#2f9e44', '#69db7c'],
  autumn: ['#5c8a2a', '#82a83a', '#c0d860'],
  winter: ['#2c7a4b', '#3f9a62', '#8fd0a4'],
};
/** Плод манго: оранжевый с красным бочком, висит на коротком черешке. */
function mangoFruit(ctx, x, y, a) {
  line(ctx, x, y - 9, x, y - 5, OUT, 1.6);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.beginPath();
  ctx.ellipse(0, 0, 5.4, 7, 0, 0, TAU);
  ctx.fillStyle = '#ffa033';
  ctx.fill();
  ctx.save();
  ctx.clip();
  ell(ctx, 3.4, -2.5, 4.6, 6, '#f4502e');
  ell(ctx, -1.8, 3.6, 4, 3.4, '#ffd43b');
  ell(ctx, -2.2, -3, 1.5, 2.2, 'rgba(255,255,255,.6)');
  ctx.restore();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 1.3;
  ctx.stroke();
  ctx.restore();
}
function paintMangoCrown(ctx, sea, fruit) {
  const tones = MANGO_TONES[sea] || MANGO_TONES.summer;
  crown(ctx, MANGO_CROWN, tones);
  // узкие листья «ёлочкой» — так крону не спутать с обычным деревом
  MANGO_CROWN.forEach(([x, y, rx, ry], i) => {
    for (let k = 0; k < 4; k++) {
      const a = i * 1.9 + k * 1.57 + 0.4,
        lx = x + Math.cos(a) * rx * 0.48,
        ly = y + Math.sin(a) * ry * 0.44;
      ell(ctx, lx, ly, 5.2, 1.8, k % 2 ? tones[0] : tones[2], null, 1, 0.5 + (k % 2 ? 0.9 : -0.5));
    }
  });
  if (sea === 'spring')
    // цветёт: кремовые метёлочки
    for (const [x, y] of [
      [-18, -44],
      [6, -66],
      [22, -46],
      [-4, -38],
    ]) {
      ell(ctx, x, y, 2.6, 5, '#fff3bf', 'rgba(74,55,40,.35)', 0.8, 0.3);
      ell(ctx, x + 1, y - 3, 1.6, 2.6, '#ffe8a1');
    }
  if (sea === 'autumn')
    MANGO_CROWN.forEach(([x, y, rx, ry], i) => {
      for (let k = 0; k < 2; k++) {
        const a = i * 1.7 + k * 2.6;
        ell(ctx, x + Math.cos(a) * rx * 0.55, y + Math.sin(a) * ry * 0.5, 3.4, 1.9, k ? '#fcc419' : '#e8900c', null, 1, a);
      }
    });
  if (fruit) for (const [x, y, a] of MANGO_AT) mangoFruit(ctx, x, y, a);
  if (sea === 'winter')
    crown(
      ctx,
      [
        [-22, -47, 13, 6],
        [22, -47, 13, 6],
        [-10, -69, 14, 7],
        [13, -71, 14, 7],
      ],
      ['#cfe3f0', '#ffffff', '#ffffff'],
      1.4,
    );
}

// Куст черники: приземистый, листва с синевой; осенью краснеет, зимой — под снегом, торчат веточки
const BERRY_PUFFS = [
  [-12, 3, 12, 9],
  [12, 3, 12, 9],
  [-5, -7, 12, 10],
  [7, -8, 11, 9],
  [0, 5, 12, 7],
];
const BERRY_TONES = {
  spring: ['#3f9f6b', '#5cc08a', '#a5e8c4'],
  summer: ['#23795a', '#2f9e77', '#74d6ae'],
  autumn: ['#b8322a', '#e0503a', '#ff9a76'],
  winter: ['#cfe3f0', '#ffffff', '#ffffff'],
};
const BERRY_AT = [
  [-14, 2],
  [-3, -9],
  [9, -6],
  [14, 5],
  [-1, 5],
];
function paintBerryBush(ctx, sea, fruit) {
  const tones = BERRY_TONES[sea] || BERRY_TONES.summer;
  shadow(ctx, 0, 12, 22, 5.5);
  if (sea === 'winter')
    // голые веточки над сугробом
    for (const [ax, ay, bx, by] of [
      [-6, 2, -13, -17],
      [-2, 0, -1, -21],
      [4, 2, 12, -16],
      [-10, -9, -16, -11],
      [8, -9, 15, -9],
    ]) {
      line(ctx, ax, ay, bx, by, OUT, 3.6);
      line(ctx, ax, ay, bx, by, '#a8703f', 1.8);
    }
  crown(ctx, sea === 'winter' ? BERRY_PUFFS.map(([x, y, rx, ry]) => [x, y + 3, rx, ry * 0.72]) : BERRY_PUFFS, tones, 2);
  if (sea === 'winter') return;
  // мелкие листочки
  BERRY_PUFFS.forEach(([x, y, rx, ry], i) => {
    for (let k = 0; k < 3; k++) {
      const a = i * 2.1 + k * 2.2;
      ell(ctx, x + Math.cos(a) * rx * 0.5, y + Math.sin(a) * ry * 0.45, 2.6, 1.5, k % 2 ? tones[0] : tones[2], null, 1, a);
    }
  });
  if (sea === 'spring')
    // цветёт: белые колокольчики
    for (const [x, y] of BERRY_AT) flower(ctx, x, y, 2, '#fff', '#ffc9de');
  if (!fruit) return;
  // ягоды гроздьями по три: тёмно-синие с сизым налётом
  for (const [x, y] of BERRY_AT)
    for (const [dx, dy] of [
      [0, -2.6],
      [-3.2, 2],
      [3.2, 2],
    ]) {
      ell(ctx, x + dx, y + dy, 3.3, 3.3, '#3b4cc0', OUT, 1);
      ell(ctx, x + dx + 0.6, y + dy + 0.8, 2, 1.8, '#5c7cfa');
      ell(ctx, x + dx - 1, y + dy - 1.1, 1.1, 0.9, 'rgba(255,255,255,.8)');
    }
}

// Грибы: семейка боровиков в траве — большой, поменьше и малыш
function boletus(ctx, x, y, s, cap) {
  // ножка-бочонок
  ctx.beginPath();
  ctx.moveTo(x - 3.2 * s, y - 8 * s);
  ctx.quadraticCurveTo(x - 6.4 * s, y + 1.5 * s, x - 3.6 * s, y + 3 * s);
  ctx.lineTo(x + 3.6 * s, y + 3 * s);
  ctx.quadraticCurveTo(x + 6.4 * s, y + 1.5 * s, x + 3.2 * s, y - 8 * s);
  ctx.closePath();
  ctx.fillStyle = '#fff4de';
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ell(ctx, x + 2.4 * s, y - 1.5 * s, 1.8 * s, 4 * s, 'rgba(160,110,60,.25)');
  // шляпка
  ctx.beginPath();
  ctx.moveTo(x - 10 * s, y - 7.5 * s);
  ctx.bezierCurveTo(x - 10 * s, y - 19 * s, x + 10 * s, y - 19 * s, x + 10 * s, y - 7.5 * s);
  ctx.quadraticCurveTo(x, y - 4.5 * s, x - 10 * s, y - 7.5 * s);
  ctx.closePath();
  ctx.fillStyle = cap;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ell(ctx, x + 4 * s, y - 8 * s, 9 * s, 4 * s, shade(cap, -0.2));
  ell(ctx, x - 3.5 * s, y - 14 * s, 4.2 * s, 2.2 * s, 'rgba(255,255,255,.4)', null, 1, -0.3);
  ctx.restore();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 1.6;
  ctx.stroke();
}
function paintMushrooms(ctx, v) {
  shadow(ctx, 0, 11, 17, 4.5);
  // травинки и опавший лист
  for (const [x, a] of [
    [-16, -0.4],
    [-12, 0.1],
    [14, 0.35],
    [17, -0.1],
  ]) {
    ctx.save();
    ctx.translate(x, 11);
    ctx.rotate(a);
    ell(ctx, 0, -4, 1.6, 5, '#5da83a');
    ctx.restore();
  }
  ell(ctx, 12, 10, 5, 2.8, v % 2 ? '#e8590c' : '#fcc419', 'rgba(74,55,40,.4)', 0.8, 0.5);
  const caps = v % 2 ? ['#a0522d', '#b96a34', '#8d4a26'] : ['#8d4a26', '#a0522d', '#b96a34'];
  boletus(ctx, 9, 5, 0.9, caps[1]);
  boletus(ctx, -6, 7, 1.25, caps[0]);
  boletus(ctx, 3, 11, 0.62, caps[2]);
}

/** Растение, с которого только что собирали или которое потрогали, недолго дрожит (готовым спрайтом). */
const wobble = (o, t) => (o.shake > t ? Math.sin(t * 34) * 2 : 0);

defineObjects({
  cocoPalm: {
    solid: true,
    map: treeDot,
    tap: { dx: 34, up: 78, down: 18, ox: 4 },
    use: gather,
    draw(ctx, o, env) {
      const t = env.t,
        x = o.x,
        y = o.y,
        nuts = hasFruit(o),
        sw = Math.sin(t * 1.4 + x * 0.1) * 0.06;
      if (o.shake > t) {
        // пальму трясут: это редко и недолго — рисуем линиями
        SP.world();
        ctx.save();
        ctx.translate(x, y);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ART.palmBase[1](ctx);
        paintPalmTop(ctx, env.season, sw + Math.sin(t * 34) * 0.16, nuts);
        ctx.restore();
        return;
      }
      put('palmBase', x, y);
      put(nuts ? 'palmTopNuts' : 'palmTop', x, y, env.season, Math.round(sw / PALM_STEP));
    },
  },
  bananaPalm: {
    solid: true,
    map: treeDot,
    tap: { dx: 34, up: 86, down: 18 },
    use: gather,
    art: {
      bananaBase: [
        [-26, -52, 28, 26],
        (ctx) => {
          shadow(ctx, 0, 14, 21, 7);
          // ствол из старых листьев: толстый у земли, зеленоватый, в кольцах
          ctx.beginPath();
          ctx.moveTo(-9, 14);
          ctx.quadraticCurveTo(-8, -20, -4.5, -46);
          ctx.lineTo(4.5, -46);
          ctx.quadraticCurveTo(8, -20, 9, 14);
          ctx.quadraticCurveTo(0, 17, -9, 14);
          ctx.closePath();
          ctx.fillStyle = '#b9c46a';
          ctx.fill();
          ctx.save();
          ctx.clip();
          ctx.fillStyle = 'rgba(0,0,0,.13)';
          ctx.fillRect(2, -50, 12, 70);
          ctx.fillStyle = 'rgba(255,255,255,.25)';
          ctx.fillRect(-8, -50, 3.5, 70);
          ctx.strokeStyle = 'rgba(110,90,30,.5)';
          ctx.lineWidth = 1.4;
          for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.moveTo(-11, 7 - i * 11);
            ctx.quadraticCurveTo(0, 2 - i * 11, 11, 7 - i * 11);
            ctx.stroke();
          }
          ctx.restore();
          ctx.strokeStyle = OUT;
          ctx.lineWidth = 2;
          ctx.stroke();
        },
      ],
      bananaTop: [[-56, -100, 56, 0], paintBananaTop],
    },
    draw(ctx, o, env) {
      put('bananaBase', o.x, o.y);
      // листья покачиваются целиком, шагами в пиксель
      put(
        'bananaTop',
        o.x + Math.sin(env.t * 1.3 + o.x * 0.1) * 1.5 + wobble(o, env.t),
        o.y,
        env.season,
        hasFruit(o) ? 1 : 0,
      );
    },
  },
  mangoTree: {
    solid: true,
    map: treeDot,
    tap: { dx: 40, up: 84, down: 18 },
    use: gather,
    art: { mangoCrown: [[-50, -96, 50, -12], paintMangoCrown] },
    draw(ctx, o, env) {
      put('treeBase', o.x, o.y, env.season === 'autumn' ? 'autumn' : '');
      put(
        'mangoCrown',
        o.x + Math.sin(env.t * 1.2 + o.x) * 1.5 + wobble(o, env.t),
        o.y,
        env.season,
        hasFruit(o) ? 1 : 0,
      );
    },
  },
  berryBush: {
    slow: 0.5,
    rustle: 'paper',
    tap: { dx: 26, up: 26, down: 18 },
    use: gather,
    art: { berryBush: [[-32, -28, 34, 22], paintBerryBush] },
    draw(ctx, o, env) {
      // шуршит, когда сквозь него идут
      const h = env.hero,
        inside = Math.abs(h.x - o.x) < 26 && Math.abs(h.y - o.y) < 26;
      put(
        'berryBush',
        o.x + (inside ? Math.sin(env.t * 22) * 1.8 : wobble(o, env.t)),
        o.y,
        env.season,
        hasFruit(o) ? 1 : 0,
      );
    },
  },
  mushrooms: {
    tap: { dx: 24, up: 28, down: 18 },
    tapIf: hasFruit, // вне сезона и после сбора грибов нет — и нажимать не на что
    use: gather,
    art: { mushrooms: [[-26, -28, 28, 20], paintMushrooms] },
    draw(ctx, o) {
      if (hasFruit(o)) put('mushrooms', o.x, o.y, (o.v || 0) % 2);
    },
  },
});

/**
 * Часть локации (parts): подпись «Сорвать…» над растением, рядом с которым стоит хомячок и на котором есть
 * плоды, кнопка в HUD и клавиша E. Нажатие на само растение работает и без неё (tap + use у вида).
 */
export function createPlants() {
  let list = [],
    near = null; // растение с плодами, до которого можно дотянуться
  const REACH = T * 1.75;
  function find(sc) {
    const p = sc.p;
    if (p.ride) return null;
    let best = null,
      bd = REACH;
    for (const o of list) {
      const d = dist(p.x, p.y, o.x, o.y);
      if (d < bd && hasFruit(o)) {
        bd = d;
        best = o;
      }
    }
    return best;
  }
  return {
    built(sc) {
      list = sc.map.objs.filter((o) => PLANTS[o.type]);
    },
    enter() {
      near = null;
    },
    update(sc) {
      const o = find(sc);
      if (o !== near) {
        near = o;
        emit('hud');
      }
    },
    /** Клавиша E: рядом растение с плодами. */
    near: (sc) => (near ? { d: dist(sc.p.x, sc.p.y, near.x, near.y) * 0.8, pending: { obj: near } } : null),
    buttons(sc) {
      if (!near) return [];
      const pl = PLANTS[near.type],
        o = near;
      return [{ id: 'gather', icon: ING_BY_ID[pl.gives].e, label: pl.btn, on: true, fn: () => gather(sc, o) }];
    },
    over(ctx, sc, t) {
      if (!near || near.shake > t) return;
      const pl = PLANTS[near.type];
      label(
        ctx,
        `${pl.verb} ${ING_BY_ID[pl.gives].e}`,
        near.x,
        near.y - pl.top + Math.sin(t * 3) * 2,
        190,
        13,
        '#fffbe6',
      );
    },
    /** Все плодовые растения локации (для заданий и тестов). */
    plants: () => list,
  };
}
