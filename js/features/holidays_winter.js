// ПРАЗДНИКИ (П.13), часть 1: ЗИМНИЕ ПРАЗДНИКИ — что делают на Новый год, Рождество, Китайский Новый год и Масленицу.
// Общий механизм (какой праздник, шаги, подарок раз в год, журнал, звёздочка) — features/holidays.js; таблица —
// data/holidays.js; украшения и места в городе — locations/holidays.js. Здесь — сами занятия:
//   holiday:tree       большая ёлка на площади: нарядить — мини-игра «Нарядим ёлку!» (minigames/tree.js) — Новый год
//   (разговор)         подарить другу новогодний подарок (talkHooks через holidayTalk)              — Новый год
//   holiday:crib       домик-вертеп со звездой: посмотреть                                          — Рождество
//   (дверь домика)     колядки вечером (HOLIDAY.carols): спеть у двери (сценка) — хозяин угощает (holidayDoor) — Рождество
//   holiday:lanterns   столик с небесными фонариками: запустить три фонарика (сценка)               — Китайский Новый год
//   holiday:envelope   красный конверт на улице (находка дня): монетки на удачу                      — Китайский Новый год
//   holiday:dragon     дракон на площади: потанцевать с ним                                         — Китайский Новый год
//   holiday:carousel   карусель: прокатиться (сценка)                                               — Масленица
//   holiday:effigy     соломенное чучело: «Прощай, зима!»                                           — Масленица
//   holiday:blini      прилавок «Блины»: набор для блинов (раз в день)                              — Масленица
//   holiday:tug        канат: мини-игра «Перетягивание каната» (minigames/tug.js), монеты по звёздам — Масленица;
//                      в команде — трое друзей с самыми большими сердечками дружбы (Пр12): чем их больше, тем легче
// Испечь блины и угостить ими друзей — обычная готовка и «🎁 Угостить»: шаги считаются по событиям cook и gift
// (поля on/if в data/holidays.js). Каждое занятие шлёт событие holiday { id, what }. Сценки, обход домиков и призовая
// мини-игра — общие приёмы из features/holidays_scenes.js.
import { addItem, setDayFlag, earn, learnRecipe, award } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { ell, fillRR, line, poly, star } from '../core/draw.js';
import { emit } from '../core/events.js';
import { G, playerLook, friendHearts } from '../core/state.js';
import { pick, TAU } from '../core/util.js';
import { drawHamster } from '../art/hamster.js';
import { HOLIDAY, holidayOffset, HOLIDAY_BY_ID, BLINI, DISH_BY_ID, NPCS, npcLook } from '../data/index.js';
import { teamHelp } from '../minigames/tug.js';
import { skyLantern, lantern } from '../locations/holidays_art.js';
import { message } from '../ui/panel.js';
import { toast } from '../ui/toast.js';
import { addPts } from './friends.js';
import { openCooking } from './cooking.js';
import { playMinigame } from './minigames.js';
import { holidayActs, holidayTalk, holidayStep, stepDoneFor, stepWanted } from './holidays.js';
import { tapScene, playScene, nightSky, doorRound, prizeGame, holidaySay as say } from './holidays_scenes.js';

const S = () => G.state;
const OUT = '#4a3728';
const HF = () => S().dayFlags.holiday || {};
/** Сколько дней от праздника id (−1 — канун, 0 — праздник, 1 — наутро). */
const offset = (id) => holidayOffset(HOLIDAY_BY_ID[id], S().day);

// ==================== НОВЫЙ ГОД ====================
/**
 * Нарядить ёлку (Пр8): мини-игра «Нарядим ёлку!» (minigames/tree.js) — игрушки и места выбираешь сама, в конце —
 * звезда на макушку. Шаг праздника засчитывается за любую наряженную ёлку, ⭐⭐⭐ «за красоту» — наклейка x_tree.
 */
async function trimTree() {
  const k = offset('newyear');
  if (k < 0) return void toast('🎄 Ёлку на площади уже поставили! Нарядим её завтра, в Новый год.');
  if (k > 0 || stepDoneFor('newyear', 'tree')) {
    sfx('magic');
    return void toast(pick(['🎄 Какая красивая ёлка! Вечером над площадью — фейерверк 🎆', '🎄 Ёлка сверкает огоньками. С Новым годом!']), 'good');
  }
  const res = await playMinigame('tree', {
    introNote: '<div class="pay-note">🎄 Ёлку на площади увидит весь город! Самой нарядной — ⭐⭐⭐ и наклейка.</div>',
  });
  if (!res) return;
  // игрушки остаются на большой ёлке до конца праздника (этап 15): наряд — строкой в отметках дня
  if (res.extra && res.extra.layout) setDayFlag('treeToys', res.extra.layout, 'holiday');
  holidayStep('newyear', 'tree');
  if (res.stars === 3) award('x_tree', { delay: 1400 });
  emit('hud');
}
holidayTalk('newyear', async (npc, text) => {
  if (!stepWanted('newyear', 'gifts') || stepDoneFor('newyear', 'gifts', npc) || !S().friends[npc]) return null;
  const i = await say(npc, text, [{ text: '🎁 Подарить новогодний подарок', cls: 'green' }, { text: '💬 Поболтать', cls: 'blue' }, { text: 'Пока!' }]);
  if (i === 2) return { end: true };
  if (i === 1) return { text: 'С Новым годом! О чём поболтаем?' };
  holidayStep('newyear', 'gifts', npc);
  addPts(npc, 2);
  sfx('magic');
  await say(
    npc,
    pick([
      `Ой! Это мне?! Спасибо-спасибо! Я так люблю подарки в блестящей бумаге! С Новым годом!`,
      `Какой подарок! Я положу его под ёлку и открою вечером, когда начнётся фейерверк! С Новым годом!`,
      `Ура! А у меня для тебя — тёплое «спасибо» и самые добрые пожелания на весь год!`,
    ]),
    [{ text: 'С Новым годом! 🎄', cls: 'green' }],
    true,
  );
  return { end: true };
});

/** Каток на замёрзшем пруду в парке (этап 15): хомячок и друзья в колпаках катаются по кругу. */
function paintRink(ctx, w, h, k, look, t) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#a5d8ff');
  g.addColorStop(0.45, '#e7f5ff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // деревья в снегу и гирлянда
  for (let i = 0; i < 7; i++) {
    const x = (i / 6) * w,
      y = h * 0.4;
    poly(ctx, [x - 22, y, x, y - 56, x + 22, y], '#2b8a3e', OUT, 1.6);
    poly(ctx, [x - 12, y - 30, x, y - 56, x + 12, y - 30], '#fff', OUT, 1.2);
  }
  ctx.strokeStyle = 'rgba(74,55,40,.6)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.1);
  ctx.quadraticCurveTo(w / 2, h * 0.24, w, h * 0.1);
  ctx.stroke();
  for (let i = 1; i < 12; i++) {
    const q = i / 12,
      on = Math.floor(t * 3 + i) % 2 === 0;
    ell(ctx, q * w, h * 0.1 + Math.sin(q * Math.PI) * h * 0.08 + 5, 4, 5, on ? ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7'][i % 4] : '#ced4da', OUT, 1);
  }
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, h * 0.4, w, h * 0.6);
  // лёд и следы коньков
  ell(ctx, w / 2, h * 0.72, w * 0.46, h * 0.24, '#d0ebff', '#74c0fc', 2.4);
  ctx.strokeStyle = 'rgba(255,255,255,.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(w / 2, h * 0.72, w * 0.3, h * 0.13, 0, 0, TAU);
  ctx.stroke();
  // катаются по кругу: хомячок впереди, друзья за ней
  const s = Math.min(w / 520, h / 300),
    team = [look, ...NPCS.slice(0, 3).map((q) => npcLook(q.id, 'newyear'))],
    list = team.map((lk, i) => {
      const a = t * 1.3 - i * 0.7;
      return { lk, i, x: w / 2 + Math.cos(a) * w * 0.3, y: h * 0.74 + Math.sin(a) * h * 0.12, dir: -Math.sin(a) >= 0 ? 1 : -1 };
    });
  list.sort((p, q) => p.y - q.y);
  for (const p of list) drawHamster(ctx, p.x, p.y, 0.62 * s, p.lk, { time: t + p.i, dir: p.dir, happy: true, armsUp: p.i === 0 && Math.sin(t * 2) > 0.6 });
  for (let i = 0; i < 18; i++) ell(ctx, ((i * 0.377 + Math.sin(t * 0.5 + i) * 0.01) % 1) * w, ((i * 0.613 + t * 0.05) % 1) * h, 1.8, 1.8, 'rgba(255,255,255,.9)');
}
async function rink() {
  if (offset('newyear') < 0) return void toast('⛸️ Пруд в парке уже замёрз — каток к Новому году готов! Кататься будем завтра.');
  sfx('magic');
  await playScene('⛸️ Ж-ж-жух! Катаемся по кругу на коньках!', paintRink, 3200);
  emit('holiday', { id: 'newyear', what: 'rink' });
  toast(pick(['⛸️ Как здорово кататься с друзьями! Щёчки румяные!', '⛸️ Ух! Ни разу не упала! С Новым годом!']), 'good');
}

// ==================== РОЖДЕСТВО ====================
function crib() {
  const k = offset('xmas');
  sfx('magic');
  if (k < 0) return void toast('🌟 Домик-вертеп поставили к Рождеству: ягнёнок и ослик уже ждут. Рождество — завтра!');
  holidayStep('xmas', 'crib');
  message({
    title: 'Домик-вертеп',
    icon: '🌟',
    html: '<div class="center big-emoji">🌟</div><p class="center">Маленький деревянный домик со звездой на крыше. Внутри — ясли с сеном, сонный ягнёнок и ослик. Над домиком горит Рождественская звезда — чтобы всем было светло и тепло.</p>',
    buttons: [{ text: 'Как красиво!' }],
  });
}
function paintCarol(ctx, w, h, k, look, t) {
  nightSky(ctx, w, h, t);
  ctx.fillStyle = '#eef6ff';
  ctx.fillRect(0, h * 0.78, w, h * 0.22);
  // домик с дверью, венком и свечами
  const hx = w * 0.62,
    hy = h * 0.78;
  fillRR(ctx, hx - 90, hy - 120, 180, 120, 4, '#ffe8cc', OUT, 2);
  poly(ctx, [hx - 104, hy - 116, hx, hy - 176, hx + 104, hy - 116], '#c92a2a', OUT, 2);
  for (const x of [hx - 60, hx + 60]) {
    fillRR(ctx, x - 20, hy - 96, 40, 36, 4, '#ffe48a', OUT, 1.8);
    fillRR(ctx, x - 3, hy - 76, 6, 12, 2, '#fff', OUT, 1);
    ell(ctx, x, hy - 80 + Math.sin(t * 9 + x) * 0.6, 2.4, 4, '#ffa94d');
  }
  const open = Math.min(1, Math.max(0, (k - 0.55) * 4));
  fillRR(ctx, hx - 20, hy - 70, 40, 70, 6, '#ffd43b', OUT, 1.8);
  fillRR(ctx, hx - 20 + open * 26, hy - 70, 40 - open * 26, 70, 6, '#8d5524', OUT, 1.8);
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#2b8a3e';
  ctx.beginPath();
  ctx.arc(hx + open * 13, hy - 54, 9, 0, TAU);
  ctx.stroke();
  // хомячок с колядной звездой на палочке и ноты
  const s = Math.min(w / 520, h / 300),
    x = w * 0.26,
    y = h * 0.95,
    bob = Math.abs(Math.sin(t * 5)) * 5 * s;
  line(ctx, x + 22 * s, y - 50 * s - bob, x + 30 * s, y - 120 * s - bob, OUT, 3);
  star(ctx, x + 30 * s, y - 128 * s - bob, 16 * s, '#ffd43b', OUT, 2);
  ctx.save();
  ctx.translate(x + 30 * s, y - 128 * s - bob);
  ctx.rotate(t * 2);
  for (let i = 0; i < 5; i++) line(ctx, Math.cos((i / 5) * TAU) * 18 * s, Math.sin((i / 5) * TAU) * 18 * s, Math.cos((i / 5) * TAU) * 24 * s, Math.sin((i / 5) * TAU) * 24 * s, '#fff3bf', 2);
  ctx.restore();
  drawHamster(ctx, x, y - bob, 1.05 * s, look, { time: t, dir: 1, happy: true, armsUp: Math.sin(t * 5) > 0.3 });
  ctx.font = `${Math.round(22 * s + 6)}px sans-serif`;
  ctx.textAlign = 'center';
  for (let i = 0; i < 3; i++) {
    const ph = (t * 0.6 + i / 3) % 1;
    ctx.globalAlpha = 1 - ph;
    ctx.fillText(['🎵', '🎶', '🎵'][i], x + 40 * s + ph * w * 0.25, y - 90 * s - ph * h * 0.35);
  }
  ctx.globalAlpha = 1;
}
doorRound({
  holiday: 'xmas',
  step: 'carols',
  title: 'Колядки',
  icon: '🎶',
  ask: (name) => `<div class="center big-emoji">🌟🎶</div><p class="center">Это домик, где живёт <b>${name}</b>. Споём колядку у двери? Хозяева на Рождество всегда угощают колядующих!</p>`,
  go: '🎶 Колядовать!',
  scene: ['🎶 «Коляда-коляда, отворяй ворота!»', paintCarol],
  treats: HOLIDAY.carolTreats,
  thanks: (npc, d) => `Ой, колядки! Какие звонкие! А я как раз жду колядующих у двери! С Рождеством! Держи угощение: ${d.e} ${d.name}!`,
  ok: 'Спасибо! С Рождеством! 🌟',
  talkBtn: '🎶 Колядовать!',
  hourHint: `🎶 Колядки — вечером, с ${HOLIDAY.carols[0]}:00. Приходи петь к этой двери!`,
});

// ==================== КИТАЙСКИЙ НОВЫЙ ГОД ====================
const LANTERNS = 3;
function paintLanterns(ctx, w, h, n, a, t) {
  nightSky(ctx, w, h, t, '#1a1440', '#7a3a5a');
  // море и луна
  ell(ctx, w * 0.8, h * 0.16, 18, 18, '#fff3bf');
  ctx.fillStyle = '#2b3f7a';
  ctx.fillRect(0, h * 0.62, w, h * 0.38);
  for (let i = 0; i < 6; i++) line(ctx, w * (0.1 + i * 0.15), h * (0.66 + (i % 3) * 0.08), w * (0.18 + i * 0.15), h * (0.66 + (i % 3) * 0.08), 'rgba(255,255,255,.25)', 2);
  ctx.fillStyle = '#e9c48e';
  ctx.fillRect(0, h * 0.82, w, h * 0.18);
  // красные фонарики на верёвке сверху
  ctx.strokeStyle = 'rgba(255,255,255,.4)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.06);
  ctx.quadraticCurveTo(w / 2, h * 0.2, w, h * 0.06);
  ctx.stroke();
  for (let i = 1; i < 6; i++) lantern(ctx, (i / 6) * w, h * 0.06 + Math.sin((i / 6) * Math.PI) * h * 0.07, 0.8, i);
  const s = Math.min(w / 380, h / 330);
  for (let i = 0; i < LANTERNS; i++) {
    const bx = w * (0.18 + i * 0.2),
      by = h * 0.86;
    if (i < n) {
      const q = i === n - 1 ? a : 1,
        up = (i === n - 1 ? a * 0.6 : 0.6 + ((t * 0.04 + i * 0.1) % 0.3)) * h,
        x = bx + Math.sin(t * 1.3 + i) * 10 * q;
      skyLantern(ctx, x, by - 26 * s - up, 1.9 * s, true);
    } else skyLantern(ctx, bx, by - 26 * s, 1.9 * s, false);
  }
  drawHamster(ctx, w * 0.82, h * 0.97, 0.8 * s, playerLook(), { time: t, dir: -1, happy: n > 0, armsUp: a < 0.5 && n > 0 });
}
async function skyLanterns() {
  const k = offset('cny');
  if (k < 0) return void toast('🏮 Небесные фонарики запускают в праздник — приходи завтра, в Китайский Новый год!');
  if (stepDoneFor('cny', 'lanterns')) return void toast('🏮 Твои фонарики уже летят к звёздам! Вечером посмотри на небо ✨', 'good');
  const ok = await tapScene({
    title: 'Небесные фонарики',
    icon: '🏮',
    steps: LANTERNS,
    btn: '🏮 Зажечь и отпустить',
    hint: 'Нажимай — фонарики будут подниматься в небо. Загадай желание!',
    doneText: '✨ Все три фонарика летят к звёздам! Желание обязательно сбудется.',
    paint: paintLanterns,
  });
  if (ok) holidayStep('cny', 'lanterns');
}
function envelope(p, ctx) {
  const pk = ctx && ctx.pickup;
  earn(HOLIDAY.envelope, 'gift');
  if (pk) holidayStep('cny', 'envelopes', pk.id);
}
function dragon() {
  sfx('fanfare');
  emit('holiday', { id: 'cny', what: 'dragon' });
  toast(
    pick([
      '🐉 Дракон кружится и машет хвостом! Говорят, он приносит удачу на весь год.',
      '🐉 Бум-бум! Дракон танцует под барабан — и ты танцуешь вместе с ним!',
      '🐉 Дракон подмигнул тебе большим добрым глазом. С Новым годом!',
    ]),
    'good',
  );
}

// ==================== МАСЛЕНИЦА ====================
function paintCarousel(ctx, w, h, k, look, t) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#a5d8ff');
  g.addColorStop(1, '#e7f5ff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, h * 0.78, w, h * 0.22);
  const cx = w / 2,
    cy = h * 0.74,
    R = w * 0.32,
    s = Math.min(w / 520, h / 300);
  // крыша
  for (let i = 0; i < 10; i++) {
    const a0 = Math.PI + (i / 10) * Math.PI,
      a1 = Math.PI + ((i + 1) / 10) * Math.PI;
    poly(ctx, [cx, h * 0.06, cx + Math.cos(a0) * R * 1.1, h * 0.3, cx + Math.cos(a1) * R * 1.1, h * 0.3], i % 2 ? '#fff' : '#e03131', OUT, 1.6);
  }
  line(ctx, cx, h * 0.3, cx, cy, OUT, 6);
  line(ctx, cx, h * 0.3, cx, cy, '#ffd43b', 3);
  ell(ctx, cx, cy, R * 1.1, 16 * s + 6, '#e9c48e', OUT, 2);
  // лошадки и хомячок на одной из них
  const list = [0, 1, 2, 3, 4].map((i) => {
    const a = (i / 5) * TAU + t * 1.6;
    return { i, x: cx + Math.cos(a) * R, y: cy - 30 * s + Math.sin(a) * 12 * s, d: Math.sin(a) };
  });
  list.sort((p, q) => p.d - q.d);
  for (const p of list) {
    const up = Math.sin(t * 4 + p.i) * 6 * s;
    line(ctx, p.x, h * 0.3, p.x, p.y + up, '#adb5bd', 2);
    // лошадка: туловище, шея с головой и ушками, ножки
    const col = ['#fff', '#ffc9de', '#a5d8ff', '#ffe066', '#d3f9d8'][p.i],
      hd = p.d > 0 ? 1 : -1,
      by = p.y + up;
    for (const lx of [-14, 14]) line(ctx, p.x + lx * s, by + 6 * s, p.x + (lx - 4) * s, by + 18 * s, OUT, 2.4);
    fillRR(ctx, p.x - 22 * s, by - 8 * s, 44 * s, 18 * s, 8 * s, col, OUT, 1.6);
    fillRR(ctx, p.x + hd * 14 * s - 5 * s, by - 26 * s, 10 * s, 22 * s, 4 * s, col, OUT, 1.4);
    ell(ctx, p.x + hd * 22 * s, by - 24 * s, 10 * s, 6 * s, col, OUT, 1.4);
    poly(ctx, [p.x + hd * 12 * s, by - 30 * s, p.x + hd * 15 * s, by - 38 * s, p.x + hd * 18 * s, by - 29 * s], col, OUT, 1.1);
    ell(ctx, p.x + hd * 24 * s, by - 26 * s, 1.4 * s, 1.4 * s, OUT);
    fillRR(ctx, p.x + hd * 6 * s - 7 * s, by - 14 * s, 6 * s, 14 * s, 2 * s, '#e03131', OUT, 1); // грива
    if (p.i === 0) drawHamster(ctx, p.x, p.y - 2 * s + up, 0.7 * s, look, { time: t, dir: 1, happy: true, armsUp: true });
  }
}
async function carousel() {
  const k = offset('maslenitsa');
  if (k < 0) return void toast('🎠 Карусель уже собрали! Кататься будем завтра, на Масленицу.');
  await playScene('🎠 Уи-и-и! Карусель кружится!', paintCarousel, 3000);
  emit('holiday', { id: 'maslenitsa', what: 'carousel' });
  toast('🎠 Как весело! Голова чуть-чуть кружится 😄', 'good');
}
function effigy() {
  sfx('pop');
  emit('holiday', { id: 'maslenitsa', what: 'effigy' });
  toast(offset('maslenitsa') < 0 ? '🌾 Соломенное чучело Масленицы. Завтра — проводы зимы!' : '🌾 Чучело Масленицы машет ленточками: «Прощай, зима! Здравствуй, весна!»', 'good');
}
function blini() {
  const k = offset('maslenitsa');
  sfx('tap');
  if (k < 0) return void toast('🥞 Прилавок «Блины» откроется завтра, на Масленицу!');
  // второй раз за день — ярмарочная печка: блины можно испечь прямо тут (Пр9)
  if (HF().kit) return void bakeAtFair();
  for (const [id, n] of Object.entries(HOLIDAY.bliniKit)) addItem('ing', id, n);
  setDayFlag('kit', 1, 'holiday');
  emit('holiday', { id: 'maslenitsa', what: 'blini' });
  sfx('coin');
  // масленичные рецепты рассказывают здесь же — один раз и навсегда
  const fresh = BLINI.filter((id) => DISH_BY_ID[id].holiday === 'maslenitsa' && !S().recipes.includes(id));
  fresh.forEach((id) => learnRecipe(id));
  toast('🥞 «С Масленицей! Держи набор для блинов!» +🌾 мука, +🥚 яйца, +🥛 молоко', 'good');
  return message({
    title: 'Прилавок «Блины»',
    icon: '🥞',
    cls: 'narrow',
    html: `<p class="center big-emoji">${DISH_BY_ID.blini_jam.e}${DISH_BY_ID.blini_honey.e}</p><p class="center">«С Масленицей! Вот тебе набор для блинов.${
      fresh.length ? ' А ещё запомни наши масленичные рецепты: <b>блины с вареньем</b> и <b>блины с мёдом и маслом</b> — теперь ты умеешь их печь!' : ''
    }»</p><p class="center muted">Печь можно дома на кухне — или прямо тут, на ярмарочной печке.</p>`,
    buttons: [
      { text: '🔥 Печь тут', cls: 'green' },
      { text: 'Потом', cls: 'ghost' },
    ],
  }).then((i) => (i === 0 ? bakeAtFair() : null));
}
/** Ярмарочная печка у прилавка «Блины»: та же готовка, но только блины. */
function bakeAtFair() {
  openCooking({
    title: 'Ярмарочная печка',
    icon: '🥞',
    only: BLINI,
    note: 'На Масленицу пекут блины! Выбери, какие: простые, с вареньем или с мёдом. Продукты — из рюкзака; чего не хватает — написано под рецептом.',
  });
}
/**
 * Команда у каната (Пр12): трое друзей, с кем больше всего сердечек дружбы (знакомые; не хватает — жители без
 * сердечек). Каждое сердечко делает рывок команды сильнее (minigames/tug.js — teamHelp).
 */
export function tugTeam() {
  const fr = S().friends,
    hearts = (id) => (fr[id] && fr[id].met ? friendHearts(id) : 0);
  const town = (n) => (!n.land || n.land === 'world' ? 0 : 1); // без сердечек — сначала горожане
  return NPCS.filter((n) => fr[n.id])
    .map((n, i) => ({ id: n.id, name: n.name, look: npcLook(n.id), hearts: hearts(n.id), k: town(n) * 100 + ((i + S().day) % 7) }))
    .sort((a, b) => b.hearts - a.hearts || a.k - b.k)
    .slice(0, 3)
    .map(({ k, ...f }) => f);
}
/** «Перетягивание каната» у ярмарки: за первые HOLIDAY.tug.paid игр — монеты по звёздам. */
function tug() {
  if (offset('maslenitsa') < 0) return void toast('🪢 Канат уже лежит на площади! Соревнования — завтра, на Масленицу.');
  const team = tugTeam(),
    help = teamHelp(team),
    names = team.map((f) => `<b>${f.name}</b>${f.hearts ? ` ${'❤️'.repeat(f.hearts)}` : ''}`).join(', ');
  return prizeGame('tug', {
    flag: 'tugs',
    cfg: HOLIDAY.tug,
    label: '🥞 <b>Приз ярмарки</b>',
    sticker: 'x_tug',
    info: { team },
    intro: `<div class="pay-note">💞 В твоей команде: ${names}.<br>${
      help > 0 ? `Друзья с сердечками помогают — рывок сильнее на <b>${Math.round(help * 100)}%</b>!` : 'Подружись с ними покрепче — с друзьями тянуть легче!'
    }</div>`,
  });
}

holidayActs({
  tree: () => trimTree(),
  rink: () => rink(),
  crib: () => crib(),
  lanterns: () => skyLanterns(),
  envelope: (p, ctx) => envelope(p, ctx),
  dragon: () => dragon(),
  carousel: () => carousel(),
  effigy: () => effigy(),
  blini: () => blini(),
  tug: () => tug(),
});
