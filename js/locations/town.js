// ГОРОД, двор виллы и пляж — ОПИСАНИЕ ЛОКАЦИИ для «движка локаций» (engine/topdown/scene.js).
// Море с корабликом и островами — часть этой же карты, оно описано в sea.js.
//
// Здесь только то, что есть именно в городе: размер карты и правила её постройки, здания и что происходит
// у их дверей, особые места (почтовый ящик, грядки, пруд, пирс), жители и их места, зоны для предметов
// заданий, точки входа и выхода — и свои виды клеток и предметов (грядка, почтовый ящик, лунка, табличка).
import { clamp, seeded } from '../core/util.js';
import { ell, fillRR, line, poly, rr, emoji } from '../core/draw.js';
import { NPCS, ING_BY_ID, SEED_BY_ID, TASK_BY_ID } from '../data/index.js';
import { G, cal } from '../core/state.js';
import { T, OUT, SP, put, defineTiles, defineObjects } from '../engine/topdown/kinds.js';
import { createTopDownScene } from '../engine/topdown/scene.js';
import './common/index.js';
import { createSea, WORLD_SEA } from './sea.js';

const MW = 72,
  MH = 106;

// ---------- здания ----------
// x, y, w, h — «пятно» здания в клетках; дверь — снизу по центру.
const B = (id, kind, x, y, w, h, o = {}) => ({ id, kind, x, y, w, h, ...o });
export const BUILDINGS = [
  B('villa', 'villa', 8, 2, 10, 5, { name: 'Моя вилла', wall: '#fff3d6', roof: '#f76e5c' }),
  B('salon', 'shop', 26, 8, 4, 4, { name: 'Салон красоты', icon: '💇', wall: '#ffc9de', roof: '#e64980' }),
  B('boutique', 'shop', 30, 8, 4, 4, { name: 'Бутик «Бантик»', icon: '🎀', wall: '#e5dbff', roof: '#845ef7' }),
  B('mall_fashion', 'mall', 36, 6, 7, 6, { name: 'ТЦ «Модный»', icon: '👗', wall: '#ffe066', roof: '#f59f00' }),
  B('mall_home', 'mall', 44, 6, 7, 6, { name: 'ТЦ «Уютный дом»', icon: '🛋️', wall: '#a5d8ff', roof: '#1c7ed6' }),
  B('fashion', 'tower', 55, 8, 4, 4, { name: 'Дом моды', icon: '👠', wall: '#f783ac', floors: 8 }),
  B('tower', 'tower', 60, 8, 4, 4, { name: 'Хомяк-Тауэр', icon: '🔭', wall: '#74c0fc', floors: 11 }),
  B('bank', 'tower', 65, 8, 4, 4, { name: 'Хомяк-Банк', icon: '💰', wall: '#ffd43b', floors: 7 }),
  B('mall_food', 'mall', 26, 18, 7, 6, { name: 'ТЦ «Вкусный»', icon: '🛒', wall: '#b2f2bb', roof: '#2f9e44' }),
  B('hospital', 'mall', 36, 18, 7, 6, { name: 'Больница', icon: '🏥', wall: '#ffffff', roof: '#fa5252' }),
  B('school', 'mall', 44, 18, 7, 6, { name: 'Школа', icon: '🔔', wall: '#ffd8a8', roof: '#e8590c' }),
  B('pool', 'shop', 54, 19, 5, 5, { name: 'Бассейн', icon: '🏊', wall: '#99e9f2', roof: '#0c8599' }),
  B('rest', 'shop', 26, 30, 7, 5, { name: '«Золотой орешек»', icon: '🍽️', wall: '#ffec99', roof: '#c92a2a' }),
  B('cafe', 'shop', 37, 31, 4, 4, { name: 'Кафе «Семечка»', icon: '☕', wall: '#ffdeeb', roof: '#d6336c' }),
  B('beachcafe', 'shop', 55, 31, 4, 4, { name: 'Пляжное кафе', icon: '🍹', wall: '#c3fae8', roof: '#12b886' }),
  B('house0', 'house', 3, 31, 4, 4, { wall: '#ffe8cc', roof: '#e8590c', npc: 'plusha' }),
  B('house1', 'house', 42, 31, 4, 4, { wall: '#d0ebff', roof: '#1971c2', npc: 'ponchik' }),
  B('house2', 'house', 60, 31, 4, 4, { wall: '#e9ecef', roof: '#495057', npc: 'senya' }),
  B('house3', 'house', 47, 31, 4, 4, { wall: '#ffdeeb', roof: '#c2255c', npc: 'busya' }),
  B('house4', 'house', 14, 31, 4, 4, { wall: '#f1e0c5', roof: '#8d5524', npc: 'prof' }),
  B('house5', 'house', 8, 31, 4, 4, { wall: '#d3f9d8', roof: '#2f9e44', npc: 'myata' }),
  B('house6', 'house', 65, 31, 4, 4, { wall: '#c5f6fa', roof: '#0b7285', npc: 'bob' }),
  B('house7', 'house', 19, 31, 4, 4, { wall: '#fff0f6', roof: '#f06595', npc: 'zefirka' }),
];
// Что происходит на входе в здание: записи для реестра действий (core/registry.js). Сам город про магазины,
// мини-игры и диалоги ничего не знает. У домиков жителей действие одно: 'home-of:<житель>'.
const ask = (vendor, text, options) => ({ do: 'ask', vendor, text, options });
const BUILDING_ACTS = {
  villa: 'scene:villa',
  salon: 'salon',
  boutique: { do: 'clothes-shop', vendor: 'boutique', shops: ['boutique'] },
  mall_fashion: { do: 'clothes-shop', vendor: 'mall', shops: ['mall'] },
  mall_home: 'home-mall',
  mall_food: 'food-mall',
  cafe: { do: 'cafe', kind: 'cafe' },
  tower: 'scene:tower',
  bank: 'bank',
  fashion: ask('fashion', 'Дорогая! Подиум ждёт. Выйдешь на показ мод?', [
    { text: '👠 На подиум!', cls: 'green', do: 'minigame:fashion' },
    { text: 'Не сейчас' },
  ]),
  hospital: ask('hospital', 'Ой, как хорошо, что ты пришла! Пациентов много. Поможешь их вылечить?', [
    { text: '🩺 Лечить', cls: 'green', do: 'minigame:doctor' },
    { text: 'Не сейчас' },
  ]),
  school: ask('school', 'Здравствуй! Детям как раз нужна учительница. Проведёшь урок?', [
    { text: '👩‍🏫 Провести урок', cls: 'green', do: 'minigame:teacher' },
    { text: 'Не сейчас' },
  ]),
  pool: ask('pool', 'На старт, внимание… Хочешь поучаствовать в заплыве?', [
    { text: '🏊 Плыть!', cls: 'green', do: 'minigame:swim' },
    { text: 'Не сейчас' },
  ]),
  rest: ask('rest', 'Добро пожаловать в «Золотой орешек»! Желаете поужинать — или поможете мне на кухне?', [
    { text: '👩‍🍳 Помочь на кухне', cls: 'green', do: 'minigame:chef' },
    { text: '🍽️ Меню', do: { do: 'cafe', kind: 'rest', title: 'Ресторан «Золотой орешек»' } },
    { text: 'Пока!' },
  ]),
  beachcafe: ask('beach', 'Привет! У нас холодный лимонад и всё для пляжа. Что тебе показать?', [
    { text: '🍹 Вкусняшки', cls: 'green', do: { do: 'cafe', kind: 'beach', title: 'Пляжное кафе' } },
    {
      text: '🩱 Пляжные вещи',
      do: { do: 'clothes-shop', vendor: 'beach', shops: ['beach'], title: 'Пляжный магазинчик' },
    },
    { text: 'Пока!' },
  ]),
};
for (const b of BUILDINGS) b.act = BUILDING_ACTS[b.id] || (b.npc ? 'home-of:' + b.npc : null);

// ---------- жители ----------
// Где кто гуляет днём (клетка); вечером каждый идёт к своему домику.
const HANG = {
  plusha: [30, 5],
  ponchik: [39, 35],
  senya: [56, 24],
  busya: [41, 12],
  prof: [47, 24],
  myata: [15, 27],
  bob: [50, 44],
  zefirka: [42, 39],
};
const ACTORS = NPCS.map((n) => ({ npc: n.id, at: HANG[n.id], home: BUILDINGS.find((b) => b.npc === n.id).id }));

// ---------- особые места ----------
const BEDS = { x: 17, n: 4, rows: [8, 10] }; // грядки: два ряда по четыре, слева направо
const bedIndex = (tx, ty) => (ty === BEDS.rows[0] ? 0 : BEDS.n) + (tx - BEDS.x);
const notWinter = () => cal().season !== 'winter',
  winter = () => cal().season === 'winter';
const PLACES = [
  // почтовый ящик у двери виллы
  {
    id: 'mailbox',
    at: [15, 7],
    hit: { dx: 34, up: 64, down: 30 },
    stand: [15.5, 8.5],
    mark: [15.5, 7.5],
    act: 'mailbox',
  },
  // зимняя лунка на пруду
  { id: 'icehole', at: [19, 17], hit: { r: 30 }, stand: [20.5, 17.5], when: winter, act: 'fish:pond', key: false },
  // грядки: встаём под грядкой
  ...Array.from({ length: BEDS.n * BEDS.rows.length }, (_, i) => {
    const x = BEDS.x + (i % BEDS.n),
      y = BEDS.rows[Math.floor(i / BEDS.n)];
    return { id: 'bed' + i, cell: [x, y], stand: [x + 0.5, y + 1.5], act: 'garden:' + i, shy: 0.6 };
  }),
  // пруд (пока не замёрз): рыбалка с берега
  { id: 'pond', tile: 'd', when: notWinter, act: 'fish:pond' },
  // конец пирса: рыбалка
  {
    id: 'pier',
    area: [50, 45, 51, 47],
    stand: [50.5, 46.5],
    mark: [51, 46.5],
    reach: 1.5,
    act: 'fish:pier',
    map: { icon: '🎣', at: [51, 46], label: '🎣 Пирс' },
  },
];
const POOLS = [
  [3, 14, 8, 7],
  [60, 16, 9, 6],
]; // бассейны: клетка, ширина, высота
const YARD = [1, 1, 24, 22]; // двор виллы: по этим клеткам идёт забор

// ---------- свои виды клеток и предметов ----------
defineTiles({
  // грядка: что на ней растёт, записано в сохранении (state.garden)
  b: { map: '#8d5a3a', block: true, draw: drawBed },
});
function drawBed(ctx, x, y, tx, ty, env) {
  const sea = env.season;
  ctx.fillStyle = sea === 'winter' ? '#f6fbff' : '#a8e67a';
  ctx.fillRect(x, y, T + 1, T + 1);
  fillRR(ctx, x + 3, y + 5, T - 6, T - 9, 8, '#8d5a3a', OUT, 2);
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.fillRect(x + 8, y + 17, T - 16, 3);
  ctx.fillRect(x + 8, y + 29, T - 16, 3);
  const i = bedIndex(tx, ty),
    bed = G.state.garden[i];
  if (bed && bed.seed) {
    const sd = SEED_BY_ID[bed.seed],
      ripe = sd && bed.age >= sd.days,
      k = sd ? Math.min(1, bed.age / sd.days) : 0;
    if (ripe) {
      emoji(ctx, ING_BY_ID[sd.crop].e, x + T / 2, y + T / 2 - 4 + Math.sin(G.time * 3 + i) * 2, 28);
    } else {
      const hgt = 8 + k * 14;
      line(ctx, x + T / 2, y + 30, x + T / 2, y + 30 - hgt, '#2f9e44', 3);
      ell(ctx, x + T / 2 - 6, y + 30 - hgt, 6, 3.5, '#51cf66', '#2f9e44', 1, -0.5);
      ell(ctx, x + T / 2 + 6, y + 30 - hgt, 6, 3.5, '#51cf66', '#2f9e44', 1, 0.5);
    }
  }
  if (sea === 'winter') {
    ctx.beginPath();
    ctx.ellipse(x + T / 2, y + T - 6, T / 2 - 4, T - 14, 0, Math.PI, 0);
    ctx.closePath();
    ctx.fillStyle = 'rgba(210,240,255,.4)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}
defineObjects({
  mailbox: {
    solid: true,
    art: {
      mailbox: [
        [-26, -58, 40, 24],
        (ctx, has) => {
          ell(ctx, 0, 14, 14, 5, 'rgba(0,0,0,.14)');
          fillRR(ctx, -4, -14, 8, 30, 2, '#8d5524', OUT, 2);
          fillRR(ctx, -20, -40, 40, 28, 12, '#fa5252', OUT, 2.5);
          fillRR(ctx, -12, -30, 24, 4, 2, '#7a1f1f');
          if (has) {
            line(ctx, 20, -28, 20, -52, OUT, 3);
            poly(ctx, [20, -52, 34, -47, 20, -42], '#ffd43b', OUT, 1.5);
          }
        },
      ],
    },
    draw(ctx, o, env) {
      const m = G.state.mail,
        has = m && !m.read;
      put('mailbox', o.x, o.y, has ? 1 : 0);
      if (has) {
        SP.world();
        emoji(ctx, '✉️', o.x, o.y - 64 + Math.sin(env.t * 5) * 5, 26);
      }
    },
  },
  icehole: {
    flat: true,
    art: {
      icehole: [
        [-22, -28, 36, 16],
        (ctx) => {
          ell(ctx, 0, 0, 15, 10, '#3fa9e6', '#fff', 3);
          line(ctx, 18, 6, 30, -22, '#8d5524', 3);
          line(ctx, 30, -22, 4, -2, '#868e96', 1);
        },
      ],
    },
    draw(ctx, o, env) {
      if (env.season === 'winter') put('icehole', o.x, o.y);
    },
  },
  fishsign: {
    art: {
      fishsign: [
        [-26, -52, 26, 16],
        (ctx) => {
          fillRR(ctx, -3, -20, 6, 30, 2, '#8d5524', OUT, 1.5);
          fillRR(ctx, -20, -46, 40, 28, 6, '#fff3bf', OUT, 2);
          emoji(ctx, '🎣', 0, -32, 20);
        },
      ],
    },
    draw(ctx, o) {
      put('fishsign', o.x, o.y);
    },
  },
});

// ---------- построение карты ----------
const sea = createSea(WORLD_SEA);
function build(m) {
  const g = m.ground,
    solid = m.solid,
    fill = m.fill,
    add = m.add;
  fill(0, 37, 71, 41, 's');
  sea.buildGround(m);
  fill(25, 12, 71, 13, 'r');
  fill(0, 24, 71, 25, 'r');
  fill(34, 0, 35, 36, 'r');
  fill(52, 0, 53, 36, 'r');
  fill(0, 35, 71, 36, 'r');
  fill(36, 14, 51, 16, 'r'); // площадь с фонтаном
  fill(50, 37, 51, 47, 'i');
  // двор виллы
  fill(12, 7, 13, 23, 'y');
  fill(12, 12, 24, 13, 'y');
  fill(2, 13, 11, 21, 'p');
  fill(3, 14, 10, 20, 'o');
  for (let y = 14; y <= 20; y++)
    for (let x = 16; x <= 23; x++) {
      if (((x + 0.5 - 19.5) / 3.2) ** 2 + ((y + 0.5 - 17.5) / 2.6) ** 2 <= 1) g[y][x] = 'd';
    }
  for (const y of BEDS.rows) for (let x = BEDS.x; x < BEDS.x + BEDS.n; x++) g[y][x] = 'b';
  // городской бассейн
  fill(59, 15, 69, 22, 'p');
  fill(60, 16, 68, 21, 'o');

  // забор вокруг виллы (ворота: на восток и на юг)
  const [fx0, fy0, fx1, fy1] = YARD;
  for (let x = fx0; x <= fx1; x++)
    for (const y of [fy0, fy1]) {
      if (y === fy1 && (x === 12 || x === 13)) continue;
      add('fenceH', x, y);
    }
  for (let y = fy0 + 1; y <= fy1 - 1; y++)
    for (const x of [fx0, fx1]) {
      if (x === fx1 && (y === 12 || y === 13)) continue;
      add('fenceV', x, y);
    }
  // почтовый ящик, особые предметы
  add('mailbox', 15, 7);
  add('icehole', 19, 17);
  add('fountain', 43, 15, { big: true });
  add('fishsign', 51, 47);
  sea.buildObjects(m);
  for (const [x, y] of [
    [4, 12],
    [6, 12],
    [8, 12],
  ])
    add('lounger', x, y);
  add('umbrella', 10, 12, { solid: true });
  for (const [x, y] of [
    [38, 15],
    [48, 15],
    [28, 14],
    [31, 14],
    [57, 14],
    [63, 14],
  ])
    add('bench', x, y);
  for (const [x, y] of [
    [8, 39],
    [20, 38],
    [30, 40],
    [40, 38],
    [60, 39],
    [67, 40],
  ])
    add('umbrella', x, y, { beach: true });
  // пальмы вдоль набережной
  for (let x = 2; x < 72; x += 4) {
    if (x >= 49 && x <= 52) continue;
    if (g[37][x] === 's') add('palm', x, 37);
  }
  // деревья, кусты, цветы
  const rng = seeded(20261112);
  const nearDoor = (x, y) =>
    BUILDINGS.some((b) => x >= b.x - 1 && x <= b.x + b.w && y >= b.y + b.h && y <= b.y + b.h + 1);
  const taken = new Set(m.objs.map((o) => o.tx + ',' + o.ty)); // где уже что-то стоит (лежаки, зонтики…) — зелень не сажаем
  const isG = (x, y) => g[y] && g[y][x] === 'g' && !solid[y][x] && !taken.has(x + ',' + y);
  for (let y = 0; y < 37; y++)
    for (let x = 0; x < MW; x++) {
      if (!isG(x, y) || nearDoor(x, y)) continue;
      const yard = x > 1 && x < 24 && y > 1 && y < 22;
      let lonely = true;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const c = g[y + dy] && g[y + dy][x + dx];
        if (c && c !== 'g') lonely = false;
      }
      const r = rng();
      if (yard) {
        if (y >= 2 && y <= 7 && x >= 7 && x <= 18) continue; // перед виллой чисто
        if (r < 0.07 && lonely) add(rng() < 0.5 ? 'palm' : 'tree', x, y, { v: Math.floor(rng() * 3) });
        else if (r < 0.16) add('bush', x, y, { v: Math.floor(rng() * 3) });
        else if (r < 0.34) add('flowers', x, y, { v: Math.floor(rng() * 4) });
      } else {
        if (r < 0.2 && lonely)
          add(y >= 27 ? (rng() < 0.75 ? 'palm' : 'tree') : rng() < 0.3 ? 'pine' : 'tree', x, y, {
            v: Math.floor(rng() * 3),
          });
        else if (r < 0.26) add('bush', x, y, { v: Math.floor(rng() * 3) });
        else if (r < 0.36) add('flowers', x, y, { v: Math.floor(rng() * 4) });
      }
    }
}

/** Куда идти по заданию из письма (единицы мира) или null. */
function target(sc) {
  const m = G.state.mail;
  if (!m) return null;
  if (!m.read) return { ...sc.spot('mailbox'), icon: '✉️' };
  if (m.done) return null;
  const t = TASK_BY_ID[m.task];
  if (!t) return null;
  if (t.type === 'collect' && m.items) {
    const it = m.items.find((i) => !i.got && sc.itemHere(i));
    return it ? { x: (it.x + 0.5) * T, y: (it.y + 0.5) * T, icon: t.sticker } : null;
  }
  const wh = t.where;
  if (wh === 'town') return null;
  const b = sc.map.bById[wh];
  if (b) {
    const d = sc.map.doorPx(b);
    return { x: d.x, y: d.y - T, icon: '⭐' };
  }
  const s = sc.spot(wh); // пирс, пляж
  return s ? { ...s, icon: '⭐' } : null;
}

const town = createTopDownScene({
  id: 'world', // имя сцены лежит в сохранениях: { scene: 'world', x, y } — не менять
  title: 'Карта города',
  home: true,
  w: MW,
  h: MH,
  build,
  water: { shoreY: WORLD_SEA.seaY, foamY: WORLD_SEA.shallowY },
  buildings: BUILDINGS,
  places: PLACES,
  spots: { beach: { at: [40.5, 39.5], mark: [40, 42.5], label: '🏖️ Пляж' } },
  actors: ACTORS,
  // кто вышел из виллы — стоит у её двери
  entries: { villa: { building: 'villa', from: 'villa' }, demo: { at: [34.5, 2.5] } },
  start: 'villa',
  // выход в пробную локацию (demo_meadow.js) закрыт: в игре его нет, открывает только автотест
  exits: [{ id: 'demo', area: [34, 0, 35, 0], to: 'demo_meadow', entry: 'gate', off: true }],
  // где разбрасывать предметы заданий: на пляже и в городе (не во дворе виллы и только там, куда можно дойти с улицы)
  zones: {
    beach: { y: [37, 41], tiles: ['s'] },
    town: { y: [0, 36], tiles: ['r', 'g'], avoid: [[0, 0, 24, 22]], reach: { from: [12, 24], tiles: ['g'] } },
  },
  parts: [sea],
  target,
  enter(sc, from) {
    if (from === 'villa') sea.boatHome(); // кораблик возвращается к пирсу
  },
  /** Бортики бассейнов и дорожки для плавания. */
  ground(ctx) {
    for (const [px, py, pw, ph] of POOLS) {
      rr(ctx, px * T - 3, py * T - 3, pw * T + 6, ph * T + 6, 10);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 6;
      ctx.stroke();
      rr(ctx, px * T - 6, py * T - 6, pw * T + 12, ph * T + 12, 12);
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    for (let i = 1; i < 6; i++) {
      ctx.setLineDash([10, 8]);
      line(ctx, 60 * T + 6, (16 + i) * T, 69 * T - 6, (16 + i) * T, 'rgba(255,255,255,.85)', 3);
      ctx.setLineDash([]);
    }
  },
  /** На мини-карте: забор двора. */
  miniMap(ctx, sc, k) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect((YARD[0] + 0.5) * k, (YARD[1] + 0.5) * k, (YARD[2] - YARD[0]) * k, (YARD[3] - YARD[1]) * k);
  },
  /** Что слышно в городе: дневная музыка города, море (чем ближе к пляжу — тем громче), птицы, сверчки. */
  sound: (sc) => ({ day: 'town', sea: clamp((sc.p.y / T - 29) / 11, 0, 1), rain: 1, birds: true, crickets: true }),
});
export default town;
/** Море города: кораблик, острова, ныряние (для отладки и тестов). */
export { sea };
