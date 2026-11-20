// ОБЩИЕ ПРЕДМЕТЫ ГОРОДА И ДВОРОВ — уличная мебель и украшения для любых локаций «вид сверху».
//
//   lamp           фонарь (ночью горит и освещает землю)        bin, planter   урна; кадка с деревцем (v)
//   flowerbed      клумба в каменном бортике (v — цвета)        hedge          живая изгородь
//   signpost       указатель: text, text2 — надписи на досках   postbox        почтовый ящик дома (v — цвет)
//   clothesline    бельё на верёвке (2 клетки)                  hammock        гамак (2 клетки)
//   swing, slide, sandbox, toys, ball   детская площадка        cafeTable      столик с зонтиком (v)
//   на гамаке, качелях, горке и полотенце можно отдохнуть — поле seat (common/seats.js, этап 17а)
//   crate, barrel  ящик с товаром (v — что в нём), бочка        picnicTable, bbq   стол для пикника, мангал
//   ambulance      машина скорой (2 клетки)                     busstop        остановка с навесом (2 клетки)
//   gate, barrier  ворота поперёк тропы (2 клетки вширь) и шлагбаум поперёк дороги (2 клетки вниз):
//                  поле open() — функция «открыто ли»
//   anchor, rowboat, greenhouse (2 клетки), hoop, dumbbells, mannequin, globe   — для дворов жителей
//   reeds, rock    камыши, камень                               towel, sandcastle, net (2 клетки), lifeguard — пляж
//   statue         памятник Золотой семечке
//
// Всё неподвижное — спрайты (art); сезон, вариант и «горит свет» — параметры put().
import { TAU } from '../../core/util.js';
import { ell, fillRR, line, poly, shade, emoji } from '../../core/draw.js';
import { OUT, put, defineObjects } from '../../engine/topdown/kinds.js';
import { seat } from './seats.js';
import {
  shadow,
  box,
  snowCap,
  signBoard,
  flower,
  leafTones,
  puff,
  WOOD,
  WOOD_D,
  WOOD_L,
  STONE,
  STONE_D,
  LIT,
} from './paint.js';

const FLOWER_SETS = [
  ['#ff6b9d', '#ffd43b', '#fff'],
  ['#b197fc', '#fff', '#ff8fab'],
  ['#ff922b', '#ffd43b', '#fa5252'],
  ['#74c0fc', '#fff', '#b197fc'],
];
const CLOTH = ['#ff8fab', '#74c0fc', '#ffd43b', '#b2f2bb', '#fff', '#b197fc'];
/**
 * Места за столиком кафе: [где нарисован, где стоит] — 0: спереди слева, спиной к нам (хомячок); 1: напротив, справа
 * за столиком, лицом к нам (житель). Стулья столика стоят ровно там же (cafeChair). Где стоят (ax ±12) — внутри
 * клетки под столиком и над ним, не задевая соседних (canStand: ±11): соседняя бочка или пальма места не закрывает.
 */
const CAFE_SPOTS = [
  [-26, 20, -12, 33],
  [24, -8, 12, -31, 'npc'],
];
/**
 * Белый стульчик кафе под сидящего хомячка: (x, y) — где сидит хомячок. back — спинкой к нам (передний стул: спинка
 * впереди сиденья); иначе лицом к нам (спинка позади). Тот же стульчик рисует кадр отдыха (relax_art.js, cafeStool).
 */
export function cafeChair(ctx, x, y, back) {
  ctx.save();
  ctx.translate(x, y);
  if (!back) {
    for (const sx of [-1, 1]) fillRR(ctx, sx * 10 - 1.5, -22, 3, 20, 1.5, '#fff', OUT, 1.3);
    fillRR(ctx, -12, -24, 24, 5, 2, '#fff', OUT, 1.4);
  }
  line(ctx, -9, 0, -10, 14, OUT, 2);
  line(ctx, 9, 0, 10, 14, OUT, 2);
  fillRR(ctx, -12, -3, 24, 5, 2, '#fff', OUT, 1.4);
  if (back) {
    for (const sx of [-1, 1]) fillRR(ctx, sx * 10 - 1.5, -17, 3, 17, 1.5, '#fff', OUT, 1.3);
    fillRR(ctx, -12, -18, 24, 5, 2, '#fff', OUT, 1.4);
  }
  ctx.restore();
}
const isWinter = (env) => env.season === 'winter';
const W = (sea) => (sea === 'winter' ? 1 : 0);

// простая запись предмета-спрайта: draw ставит один рисунок с параметрами (сезон, вариант)
const simple = (name, o = {}) => ({
  ...o,
  draw(ctx, ob, env) {
    put(name, ob.x, ob.y, o.seasonal ? env.season : W(env.season), ob.v || 0);
  },
});

// ---------- указатели: доски «куда» и таблички «здесь» ----------
// Доска «куда» — всегда без текстовых стрелок, направление показывает сама доска:
//   'l', 'r' — доска-стрелка со срезом на конце, в ту сторону от столба;
//   'u', 'd' — «дальше по дороге» / «ближе к нам»: прямоугольная доска посередине столба и нарисованные краской
//              треугольники по обоим краям — остриём вверх или вниз;
//   ''       — простая доска без стрелки (пояснение к верхней: «🔒 Спроси Бусю»).
// Табличка «здесь» (поле here) — название места, где стоишь: прямоугольная доска на двух столбиках, без стрелок.
/** Буквы-стрелки, которых не должно быть на табличках (направление рисует доска). */
export const TEXT_ARROWS = /[←→↑↓↖↗↘↙⇐⇒⇑⇓⬅➡⬆⬇]/u;
const SIGN_FONT = 'ui-rounded, "Trebuchet MS", sans-serif',
  SIGN_INK = '#5b3413';
/**
 * Контур доски указателя: dir — куда показывает, x0 — левый край прямоугольной части, w — её ширина, y — середина.
 * Плоский список точек для poly; у доски-стрелки 5 точек (срез на конце), у прямоугольной — 4.
 */
export function signOutline(dir, x0, w, y) {
  if (dir === 'r') return [x0, y - 9, x0 + w, y - 9, x0 + w + 9, y, x0 + w, y + 9, x0, y + 9];
  if (dir === 'l') return [x0 + w, y - 9, x0, y - 9, x0 - 9, y, x0, y + 9, x0 + w, y + 9];
  return [x0, y - 9, x0 + w, y - 9, x0 + w, y + 9, x0, y + 9];
}
/** Треугольник-указатель краской: остриём вверх (up) или вниз, середина (cx, cy). */
function inkTriangle(ctx, cx, cy, up) {
  const k = up ? 1 : -1;
  poly(ctx, [cx, cy - 4.5 * k, cx + 5.5, cy + 3.5 * k, cx - 5.5, cy + 3.5 * k], SIGN_INK, SIGN_INK, 1.4);
}
/** Надпись на доске: ужать, если не влезает в maxW. */
function signText(ctx, str, cx, cy, maxW, size = 12) {
  ctx.font = `900 ${size}px ${SIGN_FONT}`;
  const tw = ctx.measureText(str).width;
  if (tw > maxW) ctx.font = `900 ${(size * maxW) / tw}px ${SIGN_FONT}`;
  ctx.fillStyle = SIGN_INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(str, cx, cy + 1);
}
/**
 * Как ляжет доска указателя: spec — «куда|надпись» ('r|🏨 Отель'). { dir, str, x0, w — прямоугольная часть доски,
 * cx — середина надписи, maxW — место под надпись, fit — во сколько раз ужмётся надпись (1 — не ужмётся) }.
 */
export function signBoardLayout(ctx, spec) {
  const cut = spec.indexOf('|'),
    dir = cut < 0 ? 'r' : spec.slice(0, cut),
    str = cut < 0 ? spec : spec.slice(cut + 1);
  ctx.font = `900 12px ${SIGN_FONT}`;
  const tw = ctx.measureText(str).width;
  let w, x0, cx, maxW;
  if (dir === 'l' || dir === 'r') {
    // доска-стрелка в сторону от столба
    w = Math.min(104, Math.max(46, tw + 22));
    x0 = dir === 'r' ? -12 : 12 - w;
    cx = x0 + w / 2;
    maxW = w - 12;
  } else {
    // прямоугольная доска посередине столба; «вверх/вниз» — с местом под треугольники по краям
    const pad = dir === 'u' || dir === 'd' ? 15 : 0;
    w = Math.min(116, Math.max(46, tw + 22 + pad * 2));
    x0 = -w / 2;
    cx = 0;
    maxW = w - 12 - pad * 2;
  }
  return { dir, str, x0, w, cx, maxW, fit: Math.min(1, maxW / tw) };
}
/** Одна доска указателя: spec — «куда|надпись», y — середина доски. */
function signBoard1(ctx, spec, y) {
  const { dir, str, x0, w, cx, maxW } = signBoardLayout(ctx, spec);
  poly(ctx, signOutline(dir, x0, w, y), WOOD_L, OUT, 1.8);
  if (dir === 'u' || dir === 'd') for (const tx of [x0 + 10, x0 + w - 10]) inkTriangle(ctx, tx, y, dir === 'u');
  signText(ctx, str, cx, y, maxW);
}
/** Указатель: столб и до двух досок (a — верхняя, b — нижняя; «куда|надпись»). */
export function paintSignpost(ctx, a, b) {
  shadow(ctx, 0, 13, 10, 3.5);
  fillRR(ctx, -3, -70, 6, 84, 2, WOOD_D, OUT, 1.8);
  ell(ctx, 0, -72, 4, 3, WOOD, OUT, 1.5);
  if (a) signBoard1(ctx, a, -58);
  if (b) signBoard1(ctx, b, -36);
}
/** Ширина таблички «здесь» w и во сколько раз ужмётся самая широкая строка (fit, 1 — не ужмётся). */
export function nameplateLayout(ctx, name, sub) {
  ctx.font = `900 13px ${SIGN_FONT}`;
  let tw = ctx.measureText(name).width;
  if (sub) {
    ctx.font = `900 10.5px ${SIGN_FONT}`;
    tw = Math.max(tw, ctx.measureText(sub).width);
  }
  const w = Math.min(136, Math.max(64, tw + 26));
  return { w, fit: Math.min(1, (w - 16) / tw) };
}
/** Табличка «здесь» — название места на прямоугольной доске на двух столбиках: name и (мельче) вторая строка sub. */
export function paintNameplate(ctx, name, sub) {
  const { w } = nameplateLayout(ctx, name, sub),
    h = sub ? 36 : 24,
    top = -30 - h,
    px = w / 2 - 12;
  shadow(ctx, 0, 12, w / 2 - 4, 3.5);
  for (const x of [-px, px]) {
    shadow(ctx, x, 12, 5, 2);
    fillRR(ctx, x - 3, top + 6, 6, 18 - top - 6, 2, WOOD_D, OUT, 1.7);
  }
  fillRR(ctx, -w / 2, top + 2, w, h, 5, 'rgba(0,0,0,.16)');
  fillRR(ctx, -w / 2, top, w, h, 5, WOOD_L, OUT, 2);
  ctx.fillStyle = 'rgba(120,70,30,.18)';
  ctx.fillRect(-w / 2 + 4, top + h - 6, w - 8, 1.5);
  for (const x of [-w / 2 + 5, w / 2 - 5]) ell(ctx, x, top + 5, 1.6, 1.6, '#7a4a22');
  if (sub) {
    signText(ctx, name, 0, top + 12, w - 16, 13);
    signText(ctx, sub, 0, top + 25.5, w - 16, 10.5);
  } else signText(ctx, name, 0, top + h / 2, w - 16, 13);
}

defineObjects({
  lamp: {
    solid: true,
    light: [0, -30, 120], // ночью: пятно света вокруг фонаря (сдвиг и радиус в единицах мира)
    art: {
      lamp: [
        [-18, -104, 18, 22],
        (ctx, lit, snow) => {
          shadow(ctx, 0, 14, 11, 4);
          fillRR(ctx, -6, 6, 12, 9, 3, '#4b5563', OUT, 2);
          fillRR(ctx, -2.6, -62, 5.2, 70, 2, '#5b6676', OUT, 1.8);
          ctx.fillStyle = 'rgba(255,255,255,.25)';
          ctx.fillRect(-1.6, -60, 1.6, 64);
          fillRR(ctx, -7, -66, 14, 5, 2, '#4b5563', OUT, 1.6);
          // фонарь: стеклянный колпак
          if (lit) ell(ctx, 0, -76, 15, 15, 'rgba(255,228,138,.35)');
          poly(ctx, [-8, -66, -10, -84, 10, -84, 8, -66], lit ? LIT : '#e7f5ff', OUT, 1.8);
          if (lit) ell(ctx, 0, -75, 4, 6, '#fff8dc');
          line(ctx, 0, -66, 0, -84, 'rgba(74,55,40,.5)', 1);
          poly(ctx, [-12, -84, 0, -93, 12, -84], '#4b5563', OUT, 1.8);
          ell(ctx, 0, -94, 2.2, 2.2, '#4b5563', OUT, 1.2);
          if (snow) snowCap(ctx, 0, -88, 20, 5);
        },
      ],
    },
    draw(ctx, o, env) {
      put('lamp', o.x, o.y, env.dark > 0.3 ? 1 : 0, W(env.season));
    },
  },
  bin: simple('bin', {
    solid: true,
    art: {
      bin: [
        [-15, -30, 15, 19],
        (ctx, snow) => {
          shadow(ctx, 0, 13, 10, 3.5);
          poly(ctx, [-8, 13, -10, -14, 10, -14, 8, 13], '#51a36a', OUT, 2);
          for (const dx of [-4, 0, 4]) line(ctx, dx, -10, dx * 0.85, 10, 'rgba(0,0,0,.18)', 1.4);
          fillRR(ctx, -12, -19, 24, 6, 3, '#3f8f58', OUT, 1.8);
          if (snow) snowCap(ctx, 0, -19, 22, 5);
        },
      ],
    },
  }),
  planter: {
    solid: true,
    art: {
      planter: [
        [-18, -58, 18, 20],
        (ctx, sea, v) => {
          const t = leafTones(sea, v);
          shadow(ctx, 0, 13, 13, 4);
          poly(ctx, [-10, 13, -13, -8, 13, -8, 10, 13], '#d9825b', OUT, 2);
          fillRR(ctx, -15, -13, 30, 7, 3, '#e8946b', OUT, 1.8);
          line(ctx, 0, -12, 0, -26, WOOD_D, 3);
          if (sea === 'winter') {
            for (const [dx, dy] of [
              [-7, -34],
              [6, -38],
              [0, -46],
            ])
              ell(ctx, dx, dy, 8, 6, '#fff', '#cfe3f0', 1.3);
          } else {
            puff(ctx, -7, -30, 9, 8, t, 1.8);
            puff(ctx, 7, -31, 9, 8, t, 1.8);
            puff(ctx, 0, -41, 11, 10, t, 1.8);
            if (sea === 'spring' || (sea === 'summer' && v === 1))
              for (const [dx, dy] of [
                [-6, -32],
                [5, -40],
                [8, -28],
              ])
                flower(ctx, dx, dy, 2.2, v ? '#ff8fab' : '#fff');
          }
        },
      ],
    },
    draw(ctx, o, env) {
      put('planter', o.x, o.y, env.season, o.v || 0);
    },
  },
  flowerbed: {
    solid: true,
    art: {
      flowerbed: [
        [-27, -28, 28, 23],
        (ctx, sea, v) => {
          shadow(ctx, 0, 12, 22, 7);
          ell(ctx, 0, 4, 22, 13, STONE, OUT, 2);
          ell(ctx, 0, 2, 18, 10, sea === 'winter' ? '#f4faff' : '#8d5a3a');
          // камни бортика
          ctx.strokeStyle = 'rgba(74,55,40,.35)';
          ctx.lineWidth = 1.2;
          for (let i = 0; i < 10; i++) {
            const a = (i * TAU) / 10;
            line(
              ctx,
              Math.cos(a) * 18,
              2 + Math.sin(a) * 10,
              Math.cos(a) * 22,
              4 + Math.sin(a) * 13,
              'rgba(74,55,40,.35)',
              1.2,
            );
          }
          if (sea === 'winter') {
            ell(ctx, -4, -1, 12, 6, '#fff', '#d6e8f5', 1.2);
            ell(ctx, 7, 3, 8, 4, '#fff', '#d6e8f5', 1.2);
            return;
          }
          const set = FLOWER_SETS[v % 4],
            leaf = sea === 'autumn' ? '#a9b84a' : '#51b85c';
          const pts = [
            [-11, 3, 0],
            [-4, -3, 1],
            [4, 4, 2],
            [10, -1, 0],
            [0, 8, 1],
            [-8, -6, 2],
            [7, -8, 1],
          ];
          for (const [dx, dy] of pts) ell(ctx, dx, dy + 3, 4.5, 3, leaf);
          for (const [dx, dy, k] of pts) {
            line(ctx, dx, dy + 3, dx, dy - 5, '#2f9e44', 1.6);
            if (sea === 'autumn') ell(ctx, dx, dy - 6, 3, 3, ['#e8590c', '#fcc419', '#c2255c'][k]);
            else flower(ctx, dx, dy - 7, 2.7, set[k]);
          }
        },
      ],
    },
    draw(ctx, o, env) {
      put('flowerbed', o.x, o.y, env.season, o.v || 0);
    },
  },
  hedge: {
    solid: true,
    map: (env) => (env.season === 'winter' ? '#cfe3f0' : '#3fae5a'),
    art: {
      hedge: [
        [-28, -36, 30, 19],
        (ctx, sea, v) => {
          const t = leafTones(sea, 1);
          shadow(ctx, 0, 12, 24, 5);
          fillRR(ctx, -25, -22, 50, 34, 9, t[1], OUT, 2);
          ctx.save();
          ctx.beginPath();
          ctx.rect(-24, -21, 48, 32);
          ctx.clip();
          fillRR(ctx, -25, 0, 50, 14, 6, t[0]);
          for (let i = 0; i < 6; i++) ell(ctx, -20 + i * 8 + ((i * 5) % 3), -16 + ((i * 7) % 5), 7, 4, t[2]);
          for (let i = 0; i < 7; i++) ell(ctx, -22 + i * 7.3, -2 + ((i * 3) % 4), 2, 1.4, t[0]);
          ctx.restore();
          if (sea === 'winter') snowCap(ctx, 0, -20, 46, 6);
          else if (sea !== 'autumn' && v)
            for (const dx of [-14, 2, 15]) flower(ctx, dx, -10 + (dx % 3), 2.2, v === 1 ? '#ff8fab' : '#fff');
        },
      ],
    },
    draw(ctx, o, env) {
      put('hedge', o.x, o.y, env.season, o.v || 0);
    },
  },
  signpost: {
    solid: true,
    art: {
      signpost: [[-110, -88, 110, 20], (ctx, a, b) => paintSignpost(ctx, a, b)],
      signHere: [[-72, -92, 72, 20], (ctx, a, b) => paintNameplate(ctx, a, b)],
    },
    // text, text2 — строка или функция () => строка (табличка, которая меняется в игре: «🔒 Спроси Бусю» → «🚌 Караван»);
    // dir, dir2 — куда показывает доска ('l', 'r', 'u', 'd'; по умолчанию верхняя — 'r', нижняя — 'l'; '' — простая
    // доска без стрелки, пояснение к верхней); here — табличка-название места, где стоишь (две строки на одной доске)
    draw(ctx, o) {
      const tx = (v) => (typeof v === 'function' ? v() : v) || '';
      if (o.here) put('signHere', o.x, o.y, tx(o.text), tx(o.text2));
      else {
        const t1 = tx(o.text),
          t2 = tx(o.text2);
        put('signpost', o.x, o.y, t1 && `${o.dir ?? 'r'}|${t1}`, t2 && `${o.dir2 ?? 'l'}|${t2}`);
      }
    },
  },
  postbox: {
    solid: true,
    art: {
      postbox: [
        [-15, -44, 17, 19],
        (ctx, v, snow) => {
          const col = ['#fa5252', '#4dabf7', '#51cf66', '#ffd43b', '#f783ac', '#845ef7'][v % 6];
          shadow(ctx, 0, 13, 9, 3);
          fillRR(ctx, -2.5, -16, 5, 30, 2, WOOD_D, OUT, 1.6);
          fillRR(ctx, -12, -36, 24, 20, 8, col, OUT, 2);
          ctx.fillStyle = 'rgba(255,255,255,.3)';
          ctx.fillRect(-9, -33, 18, 3);
          fillRR(ctx, -7, -27, 14, 3, 1.5, shade(col, -0.45));
          line(ctx, 12, -30, 12, -38, OUT, 2);
          poly(ctx, [12, -40, 16, -38, 12, -35], '#fff', OUT, 1);
          if (snow) snowCap(ctx, 0, -35, 22, 5);
        },
      ],
    },
    draw(ctx, o, env) {
      put('postbox', o.x, o.y, o.v || 0, W(env.season));
    },
  },
  clothesline: {
    solid: [
      [0, 0],
      [1, 0],
    ],
    art: {
      clothesline: [
        [-26, -66, 76, 20],
        (ctx, v, snow) => {
          for (const x of [-16, 64]) {
            shadow(ctx, x, 13, 8, 3);
            fillRR(ctx, x - 2.5, -56, 5, 70, 2, WOOD_D, OUT, 1.6);
            line(ctx, x - 7, -54, x + 7, -54, OUT, 3);
            line(ctx, x - 7, -54, x + 7, -54, WOOD, 1.6);
          }
          ctx.strokeStyle = '#8a8f98';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(-16, -54);
          ctx.quadraticCurveTo(24, -47, 64, -54);
          ctx.stroke();
          if (snow) return;
          // бельё: майка, полотенце, носки, платье
          const items = [
            [-6, 14, 18, 0],
            [12, 16, 22, 1],
            [32, 6, 10, 2],
            [41, 6, 10, 3],
            [50, 10, 16, 4],
          ];
          for (const [x, w, h, k] of items) {
            const y = -52 + Math.sin(((x + 16) / 80) * Math.PI) * 5;
            fillRR(ctx, x, y, w, h, 2, CLOTH[(k + v) % 6], OUT, 1.4);
            ctx.fillStyle = 'rgba(0,0,0,.08)';
            ctx.fillRect(x + w * 0.55, y + 1, w * 0.4, h - 2);
            ell(ctx, x + 2, y, 1.4, 1.8, WOOD_L, OUT, 0.8);
            ell(ctx, x + w - 2, y, 1.4, 1.8, WOOD_L, OUT, 0.8);
          }
        },
      ],
    },
    draw(ctx, o, env) {
      put('clothesline', o.x, o.y, o.v || 0, W(env.season));
    },
  },
  hammock: {
    solid: [
      [0, 0],
      [1, 0],
    ],
    ...seat('hammock', [[24, -16, 24, 31]], { ox: 24, dx: 42, up: 52, down: 20 }, { summer: true }),
    art: {
      hammock: [
        [-24, -52, 76, 22],
        // busy — в гамаке лежат: ткань с хомячком рисует features/relax_art.js (провисает глубже), здесь — столбики
        (ctx, v, busy) => {
          shadow(ctx, 24, 14, 34, 5);
          for (const x of [-14, 62]) {
            fillRR(ctx, x - 3, -44, 6, 58, 2, WOOD_D, OUT, 1.8);
            ell(ctx, x, -45, 4, 3, WOOD, OUT, 1.4);
          }
          if (busy) return;
          const col = ['#ff8fab', '#74c0fc', '#ffd43b'][v % 3];
          ctx.beginPath();
          ctx.moveTo(-12, -36);
          ctx.quadraticCurveTo(24, 6, 60, -36);
          ctx.quadraticCurveTo(24, -14, -12, -36);
          ctx.closePath();
          ctx.fillStyle = col;
          ctx.fill();
          ctx.strokeStyle = OUT;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.save();
          ctx.clip();
          ctx.fillStyle = 'rgba(255,255,255,.55)';
          for (let i = 0; i < 6; i++) ctx.fillRect(-6 + i * 12, -40, 5, 50);
          ctx.restore();
          ell(ctx, 6, -24, 7, 5, '#fff', OUT, 1.4, -0.5); // подушка
        },
      ],
    },
    draw(ctx, o, env) {
      if (!isWinter(env)) put('hammock', o.x, o.y, o.v || 0, o.busy ? 1 : 0);
    },
  },
  swing: {
    solid: true,
    ...seat(
      'swing',
      [
        [-13, -2, -13, 31],
        [13, -2, 13, 31],
      ],
      { dx: 36, up: 90, down: 20 },
    ),
    art: {
      // busy — на каком сиденье сейчас качаются (1 — левое, 2 — правое, 3 — оба): его рисует features/relax.js
      // (качели повыше хомячка: на сиденье он помещается под перекладину)
      swing: [
        [-40, -92, 40, 22],
        (ctx, snow, busy) => {
          shadow(ctx, 0, 14, 32, 5);
          // рама
          for (const sx of [-1, 1]) {
            line(ctx, sx * 33, 14, sx * 26, -80, OUT, 6);
            line(ctx, sx * 33, 14, sx * 26, -80, '#fa5252', 3.4);
          }
          line(ctx, -28, -80, 28, -80, OUT, 7);
          line(ctx, -28, -80, 28, -80, '#ffd43b', 4);
          // два сиденья на цепочках
          for (const [dx, col, i] of [
            [-13, '#4dabf7', 1],
            [13, '#51cf66', 2],
          ]) {
            if (busy === i || busy === 3) continue; // 3 — заняты оба
            line(ctx, dx - 5, -78, dx - 5, -6, '#8a8f98', 1.3);
            line(ctx, dx + 5, -78, dx + 5, -6, '#8a8f98', 1.3);
            fillRR(ctx, dx - 8, -8, 16, 5, 2, col, OUT, 1.5);
          }
          if (snow) snowCap(ctx, 0, -83, 54, 5);
        },
      ],
    },
    draw(ctx, o, env) {
      put('swing', o.x, o.y, W(env.season), o.busy || 0);
    },
  },
  slide: simple('slide', {
    solid: true,
    ...seat('slide', [[-13, -46, 42, 31]], { ox: 4, dx: 38, up: 62, down: 20 }),
    art: {
      slide: [
        [-32, -66, 40, 22],
        (ctx, snow) => {
          shadow(ctx, 4, 14, 30, 5);
          // лесенка
          line(ctx, -22, 12, -16, -40, OUT, 4.5);
          line(ctx, -22, 12, -16, -40, '#4dabf7', 2.5);
          line(ctx, -10, 12, -8, -40, OUT, 4.5);
          line(ctx, -10, 12, -8, -40, '#4dabf7', 2.5);
          for (let i = 0; i < 4; i++) line(ctx, -20 + i * 1.3, 2 - i * 11, -10 + i * 0.5, 2 - i * 11, OUT, 2);
          // площадка и горка
          fillRR(ctx, -22, -46, 18, 7, 2, '#ffd43b', OUT, 1.8);
          ctx.beginPath();
          ctx.moveTo(-6, -46);
          ctx.quadraticCurveTo(14, -40, 22, -4);
          ctx.quadraticCurveTo(26, 10, 36, 10);
          ctx.lineTo(36, 16);
          ctx.quadraticCurveTo(18, 18, 12, 0);
          ctx.quadraticCurveTo(6, -30, -6, -38);
          ctx.closePath();
          ctx.fillStyle = '#fa5252';
          ctx.fill();
          ctx.strokeStyle = OUT;
          ctx.lineWidth = 2;
          ctx.stroke();
          line(ctx, -3, -42, 18, -8, 'rgba(255,255,255,.45)', 2);
          line(ctx, -20, -46, -20, -58, OUT, 2);
          line(ctx, -6, -46, -6, -58, OUT, 2);
          line(ctx, -20, -58, -6, -58, OUT, 2);
          if (snow) snowCap(ctx, -13, -58, 18, 4);
        },
      ],
    },
  }),
  sandbox: simple('sandbox', {
    flat: true,
    art: {
      sandbox: [
        [-25, -22, 25, 24],
        (ctx, snow) => {
          fillRR(ctx, -22, -16, 44, 36, 5, WOOD, OUT, 2);
          fillRR(ctx, -17, -11, 34, 26, 3, snow ? '#f4faff' : '#ffe9a8', 'rgba(74,55,40,.4)', 1);
          if (snow) return;
          ell(ctx, -6, 4, 7, 4, '#f5d98a');
          poly(ctx, [-10, 2, -6, -7, -2, 2], '#f5d98a', 'rgba(150,110,40,.6)', 1);
          // ведёрко и совок
          poly(ctx, [6, 8, 5, -2, 14, -2, 13, 8], '#fa5252', OUT, 1.4);
          ctx.beginPath();
          ctx.arc(9.5, -2, 4.5, Math.PI, 0);
          ctx.strokeStyle = OUT;
          ctx.lineWidth = 1.2;
          ctx.stroke();
          line(ctx, -12, 10, -4, 12, '#4dabf7', 2.5);
        },
      ],
    },
  }),
  toys: simple('toys', {
    flat: true,
    art: {
      toys: [
        [-20, -14, 20, 20],
        (ctx, snow) => {
          if (snow) return;
          // мячик, кубики, пирамидка
          ell(ctx, -10, 8, 7, 7, '#ff8fab', OUT, 1.5);
          ctx.beginPath();
          ctx.arc(-10, 8, 7, -0.6, 1.2);
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.stroke();
          fillRR(ctx, 0, 4, 9, 9, 1.5, '#4dabf7', OUT, 1.4);
          fillRR(ctx, 7, -4, 9, 9, 1.5, '#ffd43b', OUT, 1.4);
          for (let i = 0; i < 3; i++)
            ell(ctx, -2, -2 - i * 4, 6 - i * 1.6, 2.4, ['#fa5252', '#51cf66', '#ffd43b'][i], OUT, 1.1);
        },
      ],
    },
  }),
  ball: {
    flat: true,
    art: {
      ball: [
        [-11, -4, 12, 18],
        (ctx, v) => {
          shadow(ctx, 0, 14, 8, 2.5);
          const c = [
            ['#fa5252', '#fff'],
            ['#fff', '#343a40'],
            ['#ff922b', '#343a40'],
            ['#ffd43b', '#4dabf7'],
          ][v % 4];
          ell(ctx, 0, 6, 8, 8, c[0], OUT, 1.6);
          ctx.save();
          ctx.beginPath();
          ctx.arc(0, 6, 7.2, 0, TAU);
          ctx.clip();
          ctx.fillStyle = c[1];
          if (v % 4 === 1)
            for (const [dx, dy] of [
              [0, 6],
              [-7, 1],
              [7, 2],
              [-3, 13],
              [5, 12],
            ])
              ell(ctx, dx, dy, 2.6, 2.6, c[1]);
          else if (v % 4 === 2) {
            line(ctx, -8, 6, 8, 6, c[1], 1.2);
            line(ctx, 0, -2, 0, 14, c[1], 1.2);
          } else {
            ctx.fillRect(-9, 3, 18, 3);
            ctx.fillRect(-2, -3, 4, 18);
          }
          ctx.restore();
          ell(ctx, -3, 3, 2, 1.5, 'rgba(255,255,255,.7)');
        },
      ],
    },
    draw(ctx, o, env) {
      if (!isWinter(env) || !o.summer) put('ball', o.x, o.y, o.v || 0);
    },
  },
  cafeTable: {
    solid: true,
    // присесть за столик (пачка 20 ноября): хомячок — спереди слева, спиной к нам, на стульчике; житель — напротив,
    // справа за столиком, лицом к нам. Столик и стулья — под рост хомячка (столешница шире его плеч); занятый стул
    // (o.busy: 1 — передний, 2 — задний) рисует кадр отдыха вместе с хомячком (features/relax_art.js)
    ...seat('table', CAFE_SPOTS, { dx: 30, up: 44, down: 26 }),
    art: {
      cafeTable: [
        [-58, -150, 58, 42],
        (ctx, a, snow) => {
          const v = a % 10,
            busy = Math.floor(a / 10),
            col = ['#fa5252', '#4dabf7', '#12b886', '#f59f00', '#e64980'][v % 5],
            [bx, by] = CAFE_SPOTS[1],
            [fx, fy] = CAFE_SPOTS[0];
          shadow(ctx, 0, 16, 40, 8);
          // задний стул (лицом к нам): спинка позади сиденья
          if (!(busy & 2)) cafeChair(ctx, bx, by, false);
          // столик: ножка-стойка, круглая столешница
          line(ctx, 0, -12, 0, 15, OUT, 5);
          line(ctx, 0, -12, 0, 15, '#adb5bd', 2.6);
          ell(ctx, 0, 15, 11, 3.6, '#adb5bd', OUT, 1.5);
          ell(ctx, 0, -16, 27, 10.5, '#fff', OUT, 2);
          ell(ctx, 3, -14, 20, 6.5, 'rgba(0,0,0,.05)');
          if (!snow) {
            // чашка с блюдцем и пирожное на тарелочке
            ell(ctx, -9, -16, 7, 2.6, '#fff', OUT, 1.1);
            fillRR(ctx, -13, -23, 8, 7, 2.5, '#ffd8a8', OUT, 1.2);
            ell(ctx, -9, -23, 4, 1.4, '#a0522d');
            ell(ctx, 10, -16, 7.5, 2.8, '#fff', OUT, 1.1);
            fillRR(ctx, 6, -22, 9, 6, 2, col, OUT, 1.2);
            ell(ctx, 10.5, -23, 1.8, 1.8, '#fa5252', OUT, 0.8);
          }
          // передний стул (спинкой к нам)
          if (!(busy & 1)) cafeChair(ctx, fx, fy, true);
          // зонтик: стойка из-под столешницы, купол над головой того, кто сидит напротив
          line(ctx, 0, -16, 0, -112, OUT, 3.6);
          line(ctx, 0, -16, 0, -112, '#e9ecef', 1.8);
          if (snow) {
            // зимой зонт сложен
            poly(ctx, [-6, -60, 0, -114, 6, -60], col, OUT, 1.8);
            snowCap(ctx, 0, -112, 12, 5);
            return;
          }
          // купол зонта дольками, с фестонами и тенью справа
          const R = 46,
            cy = -94;
          for (let i = 0; i < 6; i++) {
            ctx.beginPath();
            ctx.moveTo(0, cy - 18);
            ctx.arc(0, cy, R, Math.PI + (i * Math.PI) / 6, Math.PI + ((i + 1) * Math.PI) / 6);
            ctx.closePath();
            ctx.fillStyle = i % 2 ? '#fff' : col;
            ctx.fill();
          }
          ctx.save();
          ctx.beginPath();
          ctx.arc(0, cy, R, Math.PI, 0);
          ctx.closePath();
          ctx.clip();
          ctx.fillStyle = 'rgba(0,0,0,.1)';
          ctx.fillRect(12, cy - R - 2, R, R + 4);
          ctx.restore();
          ctx.beginPath();
          ctx.arc(0, cy, R, Math.PI, 0);
          for (let i = 5; i >= 0; i--) ctx.arc(-R + (i + 0.5) * ((2 * R) / 6), cy, R / 6, 0, Math.PI, true);
          ctx.closePath();
          ctx.strokeStyle = OUT;
          ctx.lineWidth = 2.2;
          ctx.stroke();
          ell(ctx, 0, cy - R - 1, 3, 3, col, OUT, 1.3);
        },
      ],
    },
    draw(ctx, o, env) {
      put('cafeTable', o.x, o.y, (o.v || 0) + 10 * (o.busy || 0), W(env.season));
    },
  },
  crate: {
    solid: true,
    art: {
      crate: [
        [-21, -30, 22, 19],
        (ctx, v) => {
          shadow(ctx, 0, 13, 18, 4.5);
          fillRR(ctx, -17, -8, 34, 21, 2, WOOD, OUT, 2);
          line(ctx, -17, -1, 17, -1, 'rgba(0,0,0,.2)', 1.2);
          line(ctx, -17, 6, 17, 6, 'rgba(0,0,0,.2)', 1.2);
          fillRR(ctx, -17, -8, 5, 21, 1, WOOD_D, OUT, 1.2);
          fillRR(ctx, 12, -8, 5, 21, 1, WOOD_D, OUT, 1.2);
          // товар горкой
          const goods = [
            ['#fa5252', '#ff8787'], // яблоки
            ['#ff922b', '#51cf66'], // морковка / апельсины
            ['#51cf66', '#94d82d'], // зелень, арбузы
            ['#ffd43b', '#fff3bf'], // лимоны, дыни
            ['#b197fc', '#e599f7'], // сливы, виноград
          ][v % 5];
          for (const [dx, dy, r, k] of [
            [-9, -10, 6, 0],
            [1, -11, 6.5, 1],
            [10, -10, 5.5, 0],
            [-4, -17, 5.5, 1],
            [6, -17, 5.5, 0],
          ]) {
            ell(ctx, dx, dy, r, r * 0.92, goods[k], OUT, 1.3);
            ell(ctx, dx - r * 0.3, dy - r * 0.35, r * 0.3, r * 0.22, 'rgba(255,255,255,.6)');
          }
        },
      ],
    },
    draw(ctx, o) {
      put('crate', o.x, o.y, o.v || 0);
    },
  },
  barrel: simple('barrel', {
    solid: true,
    art: {
      barrel: [
        [-15, -32, 16, 19],
        (ctx, snow) => {
          shadow(ctx, 0, 13, 12, 4);
          fillRR(ctx, -11, -24, 22, 38, 7, WOOD, OUT, 2);
          ctx.fillStyle = 'rgba(0,0,0,.1)';
          ctx.fillRect(3, -22, 6, 34);
          for (const dy of [-16, 4]) fillRR(ctx, -12, dy, 24, 4, 1.5, '#868e96', OUT, 1.2);
          ell(ctx, 0, -24, 10, 3.5, snow ? '#fff' : WOOD_L, OUT, 1.6);
        },
      ],
    },
  }),
  picnicTable: simple('picnicTable', {
    solid: true,
    // посидеть на лавке спиной к нам (пачка 20 ноября); житель — напротив, за столом
    ...seat(
      'table',
      [
        [-11, 2, -11, 31],
        [12, -9, 12, -31, 'npc'],
      ],
      { dx: 30, up: 34, down: 20 },
    ),
    art: {
      picnicTable: [
        [-34, -36, 36, 22],
        (ctx, snow) => {
          shadow(ctx, 0, 14, 28, 5);
          for (const sx of [-1, 1]) {
            line(ctx, sx * 16, -8, sx * 20, 12, OUT, 4);
            line(ctx, sx * 16, -8, sx * 20, 12, WOOD_D, 2);
          }
          fillRR(ctx, -27, 0, 54, 6, 2, WOOD, OUT, 1.8); // лавка
          fillRR(ctx, -24, -18, 48, 10, 2, WOOD_L, OUT, 2); // стол
          line(ctx, -22, -13, 22, -13, 'rgba(0,0,0,.15)', 1);
          if (snow) {
            snowCap(ctx, 0, -18, 44, 5);
            return;
          }
          // скатерть-салфетка и корзинка
          fillRR(ctx, -8, -20, 16, 8, 1, '#fff', OUT, 1.2);
          ctx.fillStyle = '#fa5252';
          for (let i = 0; i < 4; i++) ctx.fillRect(-7 + i * 4, -19, 2, 6);
          fillRR(ctx, 10, -26, 12, 8, 2, '#e0ac78', OUT, 1.3);
          ctx.beginPath();
          ctx.arc(16, -26, 5, Math.PI, 0);
          ctx.strokeStyle = OUT;
          ctx.lineWidth = 1.3;
          ctx.stroke();
        },
      ],
    },
  }),
  bbq: simple('bbq', {
    solid: true,
    art: {
      bbq: [
        [-17, -40, 17, 19],
        (ctx, snow) => {
          shadow(ctx, 0, 13, 13, 4);
          for (const sx of [-1, 1]) line(ctx, sx * 4, -10, sx * 10, 13, OUT, 2.4);
          ctx.beginPath();
          ctx.arc(0, -16, 14, 0, Math.PI);
          ctx.closePath();
          ctx.fillStyle = '#495057';
          ctx.fill();
          ctx.strokeStyle = OUT;
          ctx.lineWidth = 2;
          ctx.stroke();
          fillRR(ctx, -15, -19, 30, 4, 2, '#868e96', OUT, 1.4);
          if (snow) {
            snowCap(ctx, 0, -19, 28, 5);
            return;
          }
          for (const dx of [-8, 0, 8]) {
            fillRR(ctx, dx - 3, -24, 6, 4, 2, '#c0703a', OUT, 1);
          }
          ctx.strokeStyle = 'rgba(255,255,255,.75)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-4, -28);
          ctx.quadraticCurveTo(-8, -33, -3, -37);
          ctx.moveTo(5, -28);
          ctx.quadraticCurveTo(1, -32, 6, -36);
          ctx.stroke();
        },
      ],
    },
  }),
  ambulance: simple('ambulance', {
    solid: [
      [0, 0],
      [1, 0],
    ],
    art: {
      ambulance: [
        [-24, -54, 78, 22],
        (ctx, snow) => {
          shadow(ctx, 26, 14, 46, 6);
          box(ctx, -18, -34, 78, 40, 8, '#fff', 2.2);
          // кабина
          poly(ctx, [60, -22, 70, -18, 73, -2, 73, 6, 60, 6], '#fff', OUT, 2.2);
          poly(ctx, [61, -19, 68, -16, 70, -4, 61, -4], '#a5d8ff', OUT, 1.5);
          fillRR(ctx, 30, -28, 24, 18, 3, '#a5d8ff', OUT, 1.6);
          line(ctx, 34, -26, 40, -12, 'rgba(255,255,255,.7)', 2);
          // красная полоса и крест
          ctx.fillStyle = '#fa5252';
          ctx.fillRect(-17, -6, 77, 5);
          fillRR(ctx, -8, -29, 26, 20, 4, '#fff', '#fa5252', 1.6);
          ctx.fillRect(2, -27, 6, 16);
          ctx.fillRect(-3, -22, 16, 6);
          // мигалка
          fillRR(ctx, 14, -41, 14, 8, 3, '#4dabf7', OUT, 1.6);
          ell(ctx, 18, -39, 2, 1.5, 'rgba(255,255,255,.8)');
          // колёса
          for (const x of [0, 50]) {
            ell(ctx, x, 8, 9, 9, '#343a40', OUT, 2);
            ell(ctx, x, 8, 4, 4, '#ced4da');
          }
          fillRR(ctx, 70, 0, 5, 5, 2, '#ffd43b', OUT, 1.2);
          if (snow) snowCap(ctx, 20, -34, 70, 6);
        },
      ],
    },
  }),
  busstop: simple('busstop', {
    solid: [
      [0, 0],
      [1, 0],
    ],
    art: {
      busstop: [
        [-34, -88, 84, 22],
        (ctx, snow) => {
          shadow(ctx, 24, 14, 46, 6);
          // задняя стенка из стекла
          fillRR(ctx, -16, -52, 80, 56, 3, 'rgba(190,230,255,.75)', OUT, 2);
          line(ctx, 24, -52, 24, 4, OUT, 1.5);
          line(ctx, -8, -44, 6, -20, 'rgba(255,255,255,.8)', 3);
          line(ctx, 34, -44, 44, -26, 'rgba(255,255,255,.8)', 3);
          // расписание
          fillRR(ctx, 30, -44, 22, 26, 2, '#fff', OUT, 1.4);
          emoji(ctx, '🐫', 41, -37, 12);
          for (let i = 0; i < 3; i++) line(ctx, 33, -28 + i * 3.5, 49, -28 + i * 3.5, '#adb5bd', 1.2);
          // стойки и лавка
          for (const x of [-16, 64]) fillRR(ctx, x - 3, -56, 6, 70, 2, '#5b6676', OUT, 1.8);
          fillRR(ctx, -10, -8, 68, 7, 2, WOOD, OUT, 1.8);
          line(ctx, -4, -1, -4, 12, OUT, 2.5);
          line(ctx, 52, -1, 52, 12, OUT, 2.5);
          // крыша
          poly(ctx, [-24, -54, -18, -68, 66, -68, 72, -54], '#f59f00', OUT, 2.2);
          ctx.fillStyle = 'rgba(255,255,255,.3)';
          ctx.fillRect(-16, -66, 80, 3);
          // значок автобуса
          ell(ctx, 24, -70, 11, 11, '#1c7ed6', OUT, 2);
          emoji(ctx, '🚌', 24, -70, 13);
          if (snow) snowCap(ctx, 24, -68, 84, 6);
        },
      ],
    },
  }),
  // ворота поперёк тропы: клетка предмета — левая из двух
  gate: {
    art: {
      gate: [
        [-34, -66, 82, 20],
        (ctx, open, text) => {
          for (const x of [-22, 70]) {
            shadow(ctx, x, 13, 9, 3.5);
            fillRR(ctx, x - 5, -46, 10, 60, 3, WOOD_D, OUT, 2);
            ell(ctx, x, -47, 6, 3.5, WOOD, OUT, 1.6);
          }
          const leaf = (x0, x1) => {
            const w = x1 - x0;
            fillRR(ctx, x0, -30, w, 5, 2, WOOD_L, OUT, 1.6);
            fillRR(ctx, x0, -8, w, 5, 2, WOOD_L, OUT, 1.6);
            const n = Math.max(2, Math.round(Math.abs(w) / 9));
            for (let i = 0; i < n; i++) {
              const x = x0 + ((i + 0.5) * w) / n;
              poly(ctx, [x - 3, 6, x - 3, -36, x, -41, x + 3, -36, x + 3, 6], WOOD, OUT, 1.5);
            }
            line(ctx, x0, -6, x1, -27, 'rgba(74,55,40,.45)', 2.2);
          };
          if (open) {
            leaf(-17, -5);
            leaf(65, 53);
          } else {
            leaf(-17, 23);
            leaf(65, 25);
            // табличка «закрыто» и замок
            fillRR(ctx, 16, -24, 16, 13, 3, '#ffd43b', OUT, 1.6);
            ctx.beginPath();
            ctx.arc(24, -24, 5, Math.PI, 0);
            ctx.strokeStyle = OUT;
            ctx.lineWidth = 2;
            ctx.stroke();
            ell(ctx, 24, -18, 1.8, 2.4, OUT);
          }
          if (text) signBoard(ctx, text, 24, -56, 62, 17, 'wood');
        },
      ],
    },
    draw(ctx, o) {
      put('gate', o.x, o.y, o.open && o.open() ? 1 : 0, o.text || '');
    },
  },
  // шлагбаум поперёк дороги: клетка предмета — верхняя из двух
  barrier: {
    art: {
      barrier: [
        [-20, -92, 64, 88], // открытая стрела поднята вверх-вправо
        (ctx, open) => {
          shadow(ctx, 0, 14, 12, 4);
          fillRR(ctx, -8, -22, 16, 36, 3, '#ffd43b', OUT, 2);
          ctx.fillStyle = '#343a40';
          ctx.fillRect(-7, -6, 14, 5);
          ctx.fillRect(-7, 5, 14, 5);
          ell(ctx, 0, -22, 6, 6, '#fa5252', OUT, 1.8);
          // стрела: закрыта — лежит поперёк дороги (вниз по экрану), открыта — поднята
          ctx.save();
          ctx.translate(0, -8);
          if (open) ctx.rotate(-2.5);
          fillRR(ctx, -4, 0, 8, 88, 3, '#fff', OUT, 1.8);
          ctx.fillStyle = '#fa5252';
          for (let i = 0; i < 5; i++) ctx.fillRect(-3, 8 + i * 17, 6, 8);
          ctx.restore();
          if (!open) {
            shadow(ctx, 0, 84, 7, 3);
            fillRR(ctx, -3.5, 66, 7, 18, 2, '#868e96', OUT, 1.5);
          }
        },
      ],
    },
    draw(ctx, o) {
      put('barrier', o.x, o.y, o.open && o.open() ? 1 : 0);
    },
  },
  anchor: simple('anchor', {
    solid: true,
    art: {
      anchor: [
        [-24, -50, 24, 19],
        (ctx, snow) => {
          shadow(ctx, 0, 13, 18, 4.5);
          ctx.save();
          ctx.rotate(0.14);
          ctx.strokeStyle = OUT;
          ctx.lineCap = 'round';
          for (const [lw, col] of [
            [8, OUT],
            [4.6, '#5b6676'],
          ]) {
            ctx.strokeStyle = col;
            ctx.lineWidth = lw;
            ctx.beginPath();
            ctx.moveTo(0, -34);
            ctx.lineTo(0, 8);
            ctx.moveTo(-10, -24);
            ctx.lineTo(10, -24);
            ctx.moveTo(-17, -6);
            ctx.quadraticCurveTo(-15, 10, 0, 9);
            ctx.quadraticCurveTo(15, 10, 17, -6);
            ctx.stroke();
          }
          ell(ctx, 0, -39, 5.5, 5.5, null, OUT, 5);
          ell(ctx, 0, -39, 5.5, 5.5, null, '#5b6676', 2.4);
          poly(ctx, [-21, -4, -17, -12, -12, -4], '#5b6676', OUT, 1.5);
          poly(ctx, [21, -4, 17, -12, 12, -4], '#5b6676', OUT, 1.5);
          ctx.restore();
          if (snow) snowCap(ctx, 0, -25, 22, 4);
        },
      ],
    },
  }),
  rowboat: simple('rowboat', {
    solid: true,
    art: {
      rowboat: [
        [-34, -28, 36, 20],
        (ctx, snow) => {
          shadow(ctx, 0, 13, 28, 5);
          ctx.beginPath();
          ctx.moveTo(-28, -12);
          ctx.lineTo(28, -12);
          ctx.quadraticCurveTo(24, 10, 12, 12);
          ctx.lineTo(-14, 12);
          ctx.quadraticCurveTo(-26, 10, -28, -12);
          ctx.closePath();
          ctx.fillStyle = '#4dabf7';
          ctx.fill();
          ctx.strokeStyle = OUT;
          ctx.lineWidth = 2;
          ctx.stroke();
          fillRR(ctx, -30, -16, 60, 6, 3, '#fff', OUT, 1.8);
          line(ctx, -22, 0, 22, 0, 'rgba(255,255,255,.6)', 2);
          if (snow) snowCap(ctx, 0, -15, 52, 5);
          else {
            line(ctx, -6, -18, 20, -4, OUT, 3.5); // весло
            line(ctx, -6, -18, 20, -4, WOOD_L, 1.8);
            ell(ctx, 22, -3, 5, 3, WOOD_L, OUT, 1.3, 0.5);
          }
        },
      ],
    },
  }),
  greenhouse: {
    solid: [
      [0, 0],
      [1, 0],
    ],
    art: {
      greenhouse: [
        [-28, -68, 78, 22],
        (ctx, sea) => {
          shadow(ctx, 24, 14, 46, 6);
          fillRR(ctx, -20, -6, 88, 18, 2, '#e8d9c0', OUT, 2); // цоколь
          // растения внутри
          for (let i = 0; i < 6; i++) {
            const x = -12 + i * 14;
            ell(ctx, x, -8, 6, 8, i % 2 ? '#51cf66' : '#37b24d');
            ell(ctx, x + 2, -14, 2.6, 2.6, ['#fa5252', '#ffd43b', '#ff8fab'][i % 3]);
          }
          // стекло
          ctx.beginPath();
          ctx.moveTo(-20, -6);
          ctx.lineTo(-20, -30);
          ctx.quadraticCurveTo(-20, -58, 24, -60);
          ctx.quadraticCurveTo(68, -58, 68, -30);
          ctx.lineTo(68, -6);
          ctx.closePath();
          ctx.fillStyle = 'rgba(205,240,255,.55)';
          ctx.fill();
          ctx.strokeStyle = OUT;
          ctx.lineWidth = 2.2;
          ctx.stroke();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          for (const x of [2, 24, 46]) {
            ctx.beginPath();
            ctx.moveTo(x, -6);
            ctx.lineTo(x, x === 24 ? -60 : -55);
            ctx.stroke();
          }
          ctx.beginPath();
          ctx.moveTo(-20, -30);
          ctx.lineTo(68, -30);
          ctx.stroke();
          line(ctx, -10, -40, 0, -52, 'rgba(255,255,255,.9)', 3);
          if (sea === 'winter') snowCap(ctx, 24, -58, 60, 7);
        },
      ],
    },
    draw(ctx, o, env) {
      put('greenhouse', o.x, o.y, env.season);
    },
  },
  hoop: simple('hoop', {
    solid: true,
    art: {
      hoop: [
        [-20, -100, 24, 19], // снежная шапка на щите выше щита
        (ctx, snow) => {
          shadow(ctx, 0, 13, 11, 4);
          fillRR(ctx, -7, 6, 14, 8, 3, '#495057', OUT, 1.8);
          fillRR(ctx, -2.5, -70, 5, 78, 2, '#868e96', OUT, 1.8);
          fillRR(ctx, -16, -88, 32, 24, 3, '#fff', OUT, 2);
          fillRR(ctx, -7, -80, 14, 11, 1, null, '#fa5252', 1.8);
          ell(ctx, 0, -62, 10, 3.5, null, OUT, 4);
          ell(ctx, 0, -62, 10, 3.5, null, '#ff922b', 2.2);
          for (const dx of [-7, -2.5, 2.5, 7]) line(ctx, dx, -60, dx * 0.6, -48, 'rgba(255,255,255,.9)', 1.1);
          if (snow) snowCap(ctx, 0, -88, 30, 5);
        },
      ],
    },
  }),
  dumbbells: simple('dumbbells', {
    flat: true,
    art: {
      dumbbells: [
        [-20, -6, 20, 18],
        (ctx, snow) => {
          if (snow) return;
          for (const [x, y, c] of [
            [-8, 2, '#4dabf7'],
            [6, 9, '#fa5252'],
          ]) {
            line(ctx, x - 6, y, x + 6, y, OUT, 4);
            line(ctx, x - 6, y, x + 6, y, '#ced4da', 2);
            fillRR(ctx, x - 10, y - 5, 5, 10, 2, c, OUT, 1.4);
            fillRR(ctx, x + 5, y - 5, 5, 10, 2, c, OUT, 1.4);
          }
        },
      ],
    },
  }),
  mannequin: {
    solid: true,
    art: {
      mannequin: [
        [-17, -62, 17, 19],
        (ctx, v, snow) => {
          const col = ['#ff8fab', '#b197fc', '#ffd43b', '#63e6be'][v % 4];
          shadow(ctx, 0, 13, 11, 4);
          ell(ctx, 0, 12, 9, 3, '#868e96', OUT, 1.5);
          line(ctx, 0, 12, 0, -20, OUT, 3.4);
          line(ctx, 0, 12, 0, -20, '#ced4da', 1.6);
          // платье на манекене
          poly(ctx, [-7, -44, 7, -44, 9, -30, 14, -6, -14, -6, -9, -30], col, OUT, 1.8);
          ctx.fillStyle = 'rgba(255,255,255,.35)';
          ctx.fillRect(-13, -12, 26, 3);
          fillRR(ctx, -9, -33, 18, 4, 2, shade(col, -0.25));
          ell(ctx, 0, -31, 2.4, 2.4, '#fff');
          line(ctx, -7, -44, -11, -38, OUT, 2.2);
          line(ctx, 7, -44, 11, -38, OUT, 2.2);
          ell(ctx, 0, -50, 4.5, 5.5, '#f1e0c5', OUT, 1.6);
          if (snow) snowCap(ctx, 0, -55, 10, 3);
        },
      ],
    },
    draw(ctx, o, env) {
      put('mannequin', o.x, o.y, o.v || 0, W(env.season));
    },
  },
  globe: simple('globe', {
    solid: true,
    art: {
      globe: [
        [-20, -52, 20, 19], // дуга подставки — радиус 17 и толщина 2,4: на чётких экранах касалась края рамки
        (ctx, snow) => {
          shadow(ctx, 0, 13, 11, 4);
          poly(ctx, [-9, 13, -5, 2, 5, 2, 9, 13], WOOD_D, OUT, 1.8);
          line(ctx, 0, 2, 0, -8, OUT, 3);
          ell(ctx, 0, -24, 14, 14, '#4dabf7', OUT, 2);
          ctx.save();
          ctx.beginPath();
          ctx.arc(0, -24, 13, 0, TAU);
          ctx.clip();
          ell(ctx, -5, -28, 6, 5, '#69db7c');
          ell(ctx, 6, -20, 5, 7, '#69db7c');
          ell(ctx, -8, -15, 4, 3, '#69db7c');
          ell(ctx, -6, -30, 4, 3, 'rgba(255,255,255,.5)');
          ctx.restore();
          ctx.beginPath();
          ctx.arc(0, -24, 17, -1.1, 1.3);
          ctx.strokeStyle = '#f59f00';
          ctx.lineWidth = 2.4;
          ctx.stroke();
          if (snow) snowCap(ctx, 0, -37, 16, 4);
        },
      ],
    },
  }),
  reeds: {
    art: {
      reeds: [
        [-22, -60, 22, 16],
        (ctx, sea, v) => {
          const col = sea === 'winter' ? '#c9b98f' : sea === 'autumn' ? '#b5a542' : '#5aa84f';
          const st = [
            [-10, -30, -0.15],
            [-3, -42, 0.05],
            [4, -34, 0.12],
            [10, -24, 0.3],
            [-6, -20, -0.35],
          ];
          for (let i = 0; i < st.length - (v % 2); i++) {
            const [x, top, lean] = st[i];
            ctx.strokeStyle = shade(col, -0.25);
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x, 10);
            ctx.quadraticCurveTo(x + lean * 10, (top + 10) / 2, x + lean * 26, top);
            ctx.stroke();
            if (i < 3) {
              fillRR(ctx, x + lean * 26 - 2.6, top - 2, 5.2, 13, 2.6, '#7a4a22', OUT, 1);
              if (sea === 'winter') ell(ctx, x + lean * 26, top - 2, 3, 2, '#fff');
            } else ell(ctx, x + lean * 26, top, 2.4, 6, col, null, 1, lean);
          }
          ell(ctx, -5, 8, 6, 2.5, col);
          ell(ctx, 6, 9, 5, 2, col);
        },
      ],
    },
    draw(ctx, o, env) {
      put('reeds', o.x + Math.sin(env.t * 1.3 + o.x) * 1, o.y, env.season, o.v || 0);
    },
  },
  rock: {
    solid: true,
    art: {
      rock: [
        [-23, -26, 24, 19],
        (ctx, v, snow) => {
          shadow(ctx, 0, 12, 19, 5);
          if (v % 2) {
            poly(ctx, [-18, 12, -15, -6, -4, -16, 9, -13, 18, -1, 17, 12], STONE, OUT, 2);
            poly(ctx, [-4, -16, 9, -13, 4, -3, -6, -2], '#e3e7ec');
            poly(ctx, [4, -3, 9, -13, 18, -1, 17, 12, 6, 12], STONE_D);
          } else {
            poly(ctx, [-20, 12, -17, -2, -8, -10, 2, -6, 6, 12], STONE, OUT, 2);
            poly(ctx, [2, 12, 4, -2, 12, -8, 20, 2, 19, 12], STONE_D, OUT, 2);
            poly(ctx, [-8, -10, 2, -6, -2, 0, -11, -1], '#e3e7ec');
          }
          if (snow) snowCap(ctx, -2, -10, 26, 5);
          else {
            ell(ctx, -12, 10, 4, 2, '#74b85a');
            ell(ctx, 12, 11, 3, 1.6, '#74b85a');
          }
        },
      ],
    },
    draw(ctx, o, env) {
      put('rock', o.x, o.y, o.v || 0, W(env.season));
    },
  },
  towel: {
    flat: true,
    ...seat('lie', [[0, 19, 0, 8]], { dx: 15, up: 22, down: 24 }, { summer: true }),
    art: {
      towel: [
        [-16, -24, 16, 24],
        (ctx, v) => {
          const col = ['#ff8fab', '#74c0fc', '#ffd43b', '#63e6be', '#b197fc'][v % 5];
          fillRR(ctx, -13, -20, 26, 42, 4, col, OUT, 1.5);
          ctx.fillStyle = 'rgba(255,255,255,.65)';
          for (let i = 0; i < 4; i++) ctx.fillRect(-12, -14 + i * 10, 24, 4);
          fillRR(ctx, -13, -20, 26, 42, 4, null, OUT, 1.5);
        },
      ],
    },
    draw(ctx, o, env) {
      if (!isWinter(env)) put('towel', o.x, o.y, o.v === undefined ? o.tx : o.v);
    },
  },
  sandcastle: {
    art: {
      sandcastle: [
        [-22, -34, 22, 18],
        (ctx) => {
          shadow(ctx, 0, 12, 19, 4.5);
          const c = '#f2d48a',
            o2 = 'rgba(150,105,40,.7)';
          fillRR(ctx, -16, -8, 32, 20, 3, c, o2, 1.6);
          for (const dx of [-14, 8]) {
            fillRR(ctx, dx, -20, 7, 16, 1.5, c, o2, 1.6);
            for (let i = 0; i < 2; i++) ctx.fillRect(dx + i * 4, -22, 3, 3);
          }
          fillRR(ctx, -5, -16, 10, 12, 1.5, c, o2, 1.6);
          line(ctx, 0, -16, 0, -30, OUT, 1.6);
          poly(ctx, [0, -30, 9, -27, 0, -23], '#fa5252', OUT, 1.1);
          ctx.beginPath();
          ctx.arc(0, 12, 5, Math.PI, 0);
          ctx.fillStyle = 'rgba(150,105,40,.55)';
          ctx.fill();
        },
      ],
    },
    draw(ctx, o, env) {
      if (!isWinter(env)) put('sandcastle', o.x, o.y);
    },
  },
  net: {
    solid: [
      [0, 0],
      [1, 0],
    ],
    art: {
      net: [
        [-24, -60, 74, 19],
        (ctx) => {
          for (const x of [-16, 64]) {
            shadow(ctx, x, 13, 7, 3);
            fillRR(ctx, x - 2.5, -52, 5, 66, 2, '#fff', OUT, 1.6);
          }
          ctx.fillStyle = 'rgba(255,255,255,.35)';
          ctx.fillRect(-14, -48, 76, 22);
          ctx.strokeStyle = 'rgba(74,55,40,.45)';
          ctx.lineWidth = 0.9;
          ctx.beginPath();
          for (let x = -10; x < 62; x += 6) {
            ctx.moveTo(x, -48);
            ctx.lineTo(x, -26);
          }
          for (let y = -43; y < -26; y += 5.5) {
            ctx.moveTo(-14, y);
            ctx.lineTo(62, y);
          }
          ctx.stroke();
          line(ctx, -14, -48, 62, -48, '#fa5252', 3);
          line(ctx, -14, -26, 62, -26, '#fff', 2);
        },
      ],
    },
    draw(ctx, o, env) {
      if (!isWinter(env)) put('net', o.x, o.y);
    },
  },
  lifeguard: simple('lifeguard', {
    solid: true,
    art: {
      lifeguard: [
        [-32, -98, 34, 22],
        (ctx, snow) => {
          shadow(ctx, 0, 14, 26, 6);
          for (const sx of [-1, 1]) {
            line(ctx, sx * 20, 14, sx * 13, -34, OUT, 5);
            line(ctx, sx * 20, 14, sx * 13, -34, '#fff', 2.8);
          }
          line(ctx, -17, -6, 17, -6, OUT, 3);
          line(ctx, -18, 4, 15, -22, 'rgba(74,55,40,.5)', 2);
          fillRR(ctx, -20, -40, 40, 8, 2, WOOD_L, OUT, 2); // площадка
          fillRR(ctx, -15, -66, 30, 28, 2, '#fff', OUT, 2); // будка
          ctx.fillStyle = '#fa5252';
          ctx.fillRect(-14, -56, 28, 6);
          fillRR(ctx, -8, -62, 16, 12, 2, '#a5d8ff', OUT, 1.4);
          poly(ctx, [-22, -66, 0, -82, 22, -66], '#fa5252', OUT, 2);
          line(ctx, 0, -82, 0, -92, OUT, 2);
          poly(ctx, [0, -93, 10, -89, 0, -85], '#ffd43b', OUT, 1.2);
          // спасательный круг
          ell(ctx, 16, -30, 6.5, 6.5, '#fff', OUT, 1.6);
          ell(ctx, 16, -30, 2.5, 2.5, WOOD_L, OUT, 1.2);
          ctx.fillStyle = '#fa5252';
          ctx.fillRect(14.5, -37, 3, 4);
          ctx.fillRect(14.5, -27, 3, 4);
          if (snow) snowCap(ctx, 0, -76, 30, 5);
        },
      ],
    },
  }),
  statue: simple('statue', {
    solid: true,
    art: {
      statue: [
        [-24, -84, 24, 22],
        (ctx, snow) => {
          shadow(ctx, 0, 14, 20, 5.5);
          box(ctx, -18, -4, 36, 18, 3, STONE, 2);
          box(ctx, -13, -18, 26, 16, 3, '#e3e7ec', 2);
          fillRR(ctx, -8, -13, 16, 6, 2, '#ffd43b', OUT, 1);
          // золотая семечка
          ctx.beginPath();
          ctx.moveTo(0, -74);
          ctx.bezierCurveTo(18, -56, 16, -28, 0, -20);
          ctx.bezierCurveTo(-16, -28, -18, -56, 0, -74);
          ctx.closePath();
          ctx.fillStyle = '#ffd43b';
          ctx.fill();
          ctx.strokeStyle = OUT;
          ctx.lineWidth = 2.2;
          ctx.stroke();
          ctx.save();
          ctx.clip();
          ell(ctx, 8, -38, 12, 22, '#f59f00');
          ell(ctx, -2, -46, 10, 24, '#ffd43b');
          ell(ctx, -6, -54, 3, 9, '#fff3bf', null, 1, 0.2);
          ctx.restore();
          line(ctx, 0, -66, 0, -30, 'rgba(180,110,0,.5)', 1.6);
          if (snow) snowCap(ctx, 0, -70, 14, 4);
        },
      ],
    },
  }),
});
