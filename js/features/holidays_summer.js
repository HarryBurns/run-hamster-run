// ПРАЗДНИКИ (П.13), часть 2: 1 МАЯ, ИВАН КУПАЛА, ХЕЛЛОУИН — что делают на празднике. Общий механизм (какой праздник,
// шаги, подарок раз в год, журнал, звёздочка) — features/holidays.js; таблица — data/holidays.js; украшения и места
// в городе — locations/holidays.js; сценки, обход домиков и призовая мини-игра — features/holidays_scenes.js.
//   holiday:plant      пустая клумба «Субботник» (три штуки): вскопать, посадить, полить (сценка)       — 1 Мая
//   holiday:parade     тележка с шариками на площади: парад с шариками (сценка)                       — 1 Мая
//   holiday:wreath     корзинка с цветами у воды: сплести венок и пустить его по воде (сценка)       — Иван Купала
//   holiday:splash     вёдра и пистолеты на пляже: мини-игра «Водяная битва» (minigames/splash.js)    — Иван Купала
//   holiday:bonfire    купальский костёр на пляже: погреться (вечером он светит — locations/holidays.js) — Иван Купала
//   holiday:pumpkins   столик с тыквами на площади: вырезать тыкву-фонарик (сценка)                   — Хеллоуин
//   (дверь домика)     вечером «Сладость или гадость?» (doorRound, как колядки): хозяин угощает       — Хеллоуин
//   holiday:ghost      привидение из простыни в парке: «Бу!» — и подмигивает                          — Хеллоуин
// Каждое занятие шлёт событие holiday { id, what }.
import { sfx } from '../core/audio.js';
import { ell, fillRR, line, poly, star } from '../core/draw.js';
import { emit } from '../core/events.js';
import { G, darkness, playerLook } from '../core/state.js';
import { pick, TAU } from '../core/util.js';
import { drawHamster } from '../art/hamster.js';
import { HOLIDAY, NPCS, npcLook, holidayOffset, HOLIDAY_BY_ID } from '../data/index.js';
import { MAY_BEDS, paintMayBed, balloon, jackFace, wreathRing } from '../locations/holidays_art.js';
import { toast } from '../ui/toast.js';
import { holidayActs, holidayStep, holidayWhere, stepDoneFor } from './holidays.js';
import { tapScene, playScene, nightSky, doorRound, prizeGame } from './holidays_scenes.js';

const S = () => G.state;
const OUT = '#4a3728';
/** Сколько дней от праздника id (−1 — канун, 0 — праздник). */
const offset = (id) => holidayOffset(HOLIDAY_BY_ID[id], S().day);
/** Немного друзей для сценок (первые трое знакомых, а не знакомых — тоже можно: праздник для всех). */
const pals = (n = 3) => NPCS.slice(0, 8).filter((q) => S().friends[q.id] && S().friends[q.id].met).concat(NPCS.slice(0, 8)).slice(0, n).map((q) => npcLook(q.id));
/** Солнечное небо с травой (фон дневных сценок). */
function daySky(ctx, w, h, ground = '#8ce99a', hy = 0.62) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#74c0fc');
  g.addColorStop(hy, '#d0ebff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ell(ctx, w * 0.84, h * 0.13, 22, 22, '#ffe066', '#fab005', 2);
  ctx.fillStyle = ground;
  ctx.fillRect(0, h * hy, w, h * (1 - hy));
}

// ==================== 1 МАЯ ====================
/** Сценка «Субботник»: вскопать, посадить, полить. */
function paintPlant(ctx, w, h, n, a, t) {
  daySky(ctx, w, h, '#8ce99a', 0.5);
  // флажки над сценкой
  ctx.strokeStyle = 'rgba(74,55,40,.6)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.08);
  ctx.quadraticCurveTo(w / 2, h * 0.2, w, h * 0.08);
  ctx.stroke();
  for (let i = 1; i < 10; i++) {
    const q = i / 10,
      x = q * w,
      y = h * 0.08 + Math.sin(q * Math.PI) * h * 0.06;
    poly(ctx, [x - 7, y, x + 7, y, x, y + 14], ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#da77f2'][i % 5], OUT, 1);
  }
  const s = Math.min(w / 220, h / 200);
  ctx.save();
  ctx.translate(w * 0.42, h * 0.74);
  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // клумба: 0 — утоптанная земля, 1 — вскопана, 2 — посажены цветы, 3 — полита (цветы распустились)
  paintMayBed(ctx, Math.min(2, n), false, n >= 3 ? 0.4 + Math.min(1, a) * 0.6 : 0.3);
  if (n === 1 && a < 1) for (let i = 0; i < 5; i++) ell(ctx, -30 + i * 15, -10 - Math.sin(a * Math.PI) * (16 + i * 3), 3, 2.4, '#8d5a3a');
  if (n >= 3 && a < 1) for (let i = 0; i < 6; i++) ell(ctx, -26 + i * 11, -40 + a * 34 + (i % 2) * 6, 2.4, 3.4, '#74c0fc');
  ctx.restore();
  // хомячок с лопаткой или лейкой
  const hx = w * 0.82,
    hy = h * 0.92;
  drawHamster(ctx, hx, hy, 0.7 * s, playerLook(), { time: t, dir: -1, happy: n >= 3, armsUp: a < 0.5 && n > 0 });
  if (n < 2) {
    line(ctx, hx - 30 * s, hy - 26 * s, hx - 46 * s, hy + 2 * s, '#8d5524', 3);
    poly(ctx, [hx - 52 * s, hy, hx - 40 * s, hy, hx - 44 * s, hy + 12 * s], '#adb5bd', OUT, 1.2);
  } else {
    fillRR(ctx, hx - 50 * s, hy - 38 * s, 22 * s, 16 * s, 4, '#4dabf7', OUT, 1.4);
    line(ctx, hx - 50 * s, hy - 32 * s, hx - 64 * s, hy - 40 * s, OUT, 3);
  }
}
async function plant(p) {
  const bed = +p.bed || 0;
  if (offset('mayday') < 0) return void toast('🌷 Клумбы уже готовят к субботнику! Сажать цветы будем завтра, 1 Мая.');
  if (stepDoneFor('mayday', 'plant', bed)) return void toast('🌷 Здесь уже растут твои цветы — красота!', 'good');
  const ok = await tapScene({
    title: 'Субботник',
    icon: '🌷',
    steps: 3,
    btn: '🪏 Вскопать',
    btns: ['🪏 Вскопать', '🌷 Посадить цветы', '💧 Полить'],
    hint: 'Сначала вскопай землю лопаткой — нажимай на картинку или на кнопку!',
    hints: [null, 'Земля мягкая! Теперь посади цветы.', 'Осталось полить — и цветы распустятся!'],
    doneText: '🌷 Клумба в цветах! Город стал ещё красивее.',
    paint: paintPlant,
  });
  if (ok) {
    holidayStep('mayday', 'plant', bed);
    emit('holiday', { id: 'mayday', what: 'plant', bed });
  }
}
/** Сценка парада: хомячок и друзья с шариками идут по площади под флажками. */
function paintParade(ctx, w, h, k, look, t) {
  daySky(ctx, w, h, '#e9ddc9', 0.66);
  // дома-силуэты и флажки
  for (let i = 0; i < 6; i++) {
    const x = (i / 6) * w + 10;
    fillRR(ctx, x, h * 0.36 - (i % 3) * 14, w / 6 - 14, h * 0.3 + (i % 3) * 14, 4, ['#ffe3e3', '#d0ebff', '#fff3bf', '#e5dbff', '#d3f9d8', '#ffe8cc'][i], OUT, 1.4);
    for (let j = 0; j < 2; j++) fillRR(ctx, x + 8 + j * (w / 12 - 4), h * 0.44 - (i % 3) * 14, 12, 14, 2, '#a5d8ff', OUT, 1);
  }
  ctx.strokeStyle = 'rgba(74,55,40,.6)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.1);
  ctx.quadraticCurveTo(w / 2, h * 0.24, w, h * 0.1);
  ctx.stroke();
  for (let i = 1; i < 14; i++) {
    const q = i / 14,
      x = q * w,
      y = h * 0.1 + Math.sin(q * Math.PI) * h * 0.07;
    poly(ctx, [x - 7, y, x + 7, y, x, y + 14], i % 2 ? '#e03131' : ['#ffd43b', '#69db7c', '#4dabf7'][i % 3], OUT, 1);
  }
  // идём слева направо: впереди хомячок, за ней друзья, у каждого — шарик
  const s = Math.min(w / 520, h / 300),
    base = h * 0.95,
    lead = -w * 0.15 + k * w * 1.05;
  const team = [look, ...pals(3)];
  team.forEach((lk, i) => {
    const x = lead - i * 74 * s,
      bob = Math.abs(Math.sin(t * 6 + i)) * 4 * s;
    if (x < -60 || x > w + 60) return;
    const bx = x + 16 * s,
      by = base - 150 * s + Math.sin(t * 2 + i) * 4;
    line(ctx, x + 18 * s, base - 50 * s - bob, bx, by + 22 * s, 'rgba(74,55,40,.7)', 1.4);
    balloon(ctx, bx, by, 18 * s, ['#ff6b6b', '#4dabf7', '#ffd43b', '#da77f2'][i % 4]);
    drawHamster(ctx, x, base - bob, 0.85 * s, lk, { time: t, walk: t * 1.6 + i * 0.3, dir: 1, happy: true });
  });
  // конфетти
  for (let i = 0; i < 24; i++) {
    const x = ((i * 0.377 + t * 0.03) % 1) * w,
      y = ((i * 0.613 + t * 0.12 * (1 + (i % 3) * 0.2)) % 1) * h * 0.7;
    ctx.fillStyle = ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#da77f2'][i % 5];
    ctx.fillRect(x, y, 5, 3);
  }
}
async function parade() {
  if (offset('mayday') < 0) return void toast('🎈 Шарики уже надули! Парад — завтра, 1 Мая.');
  sfx('fanfare');
  await playScene('🎈 Парад! Шарики, флажки и музыка!', paintParade, 3200);
  holidayStep('mayday', 'parade');
  emit('holiday', { id: 'mayday', what: 'parade' });
  toast(pick(['🎈 Какой весёлый парад! Все машут тебе флажками!', '🎈 Мир! Труд! Май! Шарики летят к самым облакам!']), 'good');
}
// звёздочка «Субботника» — к ближайшей ещё пустой клумбе
holidayWhere('maybed', (sc, h, x) => {
  const done = (S().dayFlags.holiday || {})[x.step.id] || [];
  let best = null,
    bd = Infinity;
  MAY_BEDS.forEach((b, i) => {
    if (done.includes(i)) return;
    const p = sc.whereIs('maybed' + i);
    const d = p ? Math.hypot(p.x - sc.p.x, p.y - sc.p.y) : Infinity;
    if (d < bd) {
      bd = d;
      best = p;
    }
  });
  return best;
});

// ==================== ИВАН КУПАЛА ====================
const FLOWERS = 6; // столько цветов вплести, потом — пустить по воде
function paintWreath(ctx, w, h, n, a, t) {
  // вечереет: розовое небо, море, песок
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#ffc9c9');
  g.addColorStop(0.45, '#ffe8cc');
  g.addColorStop(0.46, '#4dabf7');
  g.addColorStop(0.72, '#99e9f2');
  g.addColorStop(0.73, '#ffe8a3');
  g.addColorStop(1, '#f6d58e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ell(ctx, w * 0.5, h * 0.44, 30, 14, '#ffd43b');
  for (let i = 0; i < 8; i++) {
    const y = h * (0.5 + (i % 4) * 0.05),
      x = ((i * 0.31 + t * 0.02) % 1) * w;
    line(ctx, x, y, x + 24, y, 'rgba(255,255,255,.5)', 2);
  }
  const s = Math.min(w / 380, h / 330);
  const fl = Math.min(n, FLOWERS);
  if (n <= FLOWERS) {
    // венок на песке: вплетённые цветы, последний — летит из корзинки
    wreathRing(ctx, w * 0.42, h * 0.84, 46 * s, fl, fl === n && a < 1 ? a : 1, false);
    // корзинка с цветами
    fillRR(ctx, w * 0.76, h * 0.8, 56 * s, 30 * s, 8, '#d9a066', OUT, 1.6);
    for (let i = 0; i < FLOWERS - fl; i++) ell(ctx, w * 0.76 + (10 + (i % 3) * 16) * s, h * 0.8 - (2 + Math.floor(i / 3) * 6) * s, 7 * s, 7 * s, ['#ff8fab', '#ffd43b', '#fff', '#b197fc'][i % 4], OUT, 1);
  } else {
    // пустили по воде: венок со свечкой уплывает к закату
    if (paintWreath.t0 == null) paintWreath.t0 = t;
    const q = Math.min(1, (t - paintWreath.t0) / 4);
    wreathRing(ctx, w * 0.42 + w * 0.08 * q, h * 0.8 - h * 0.26 * q + Math.sin(t * 2) * 2, 46 * s * (1 - 0.55 * q), FLOWERS, 1, true);
  }
  drawHamster(ctx, w * 0.2, h * 0.98, 0.75 * s, playerLook(), { time: t, dir: 1, happy: n > FLOWERS, armsUp: a < 0.5 && n > 0 });
}
async function wreath() {
  if (offset('kupala') < 0) return void toast('🌼 Цветы для венков уже собрали! Пускать венки по воде будем завтра, на Ивана Купалу.');
  if (stepDoneFor('kupala', 'wreath')) return void toast('🌼 Твой венок уже уплыл далеко-далеко, к самому закату 🌊', 'good');
  paintWreath.t0 = null;
  const ok = await tapScene({
    title: 'Купальский венок',
    icon: '🌼',
    steps: FLOWERS + 1,
    btn: '🌼 Вплести цветок',
    lastBtn: '🌊 Пустить по воде!',
    hint: 'Нажимай — цветы сами вплетутся в венок. А потом пусти его по воде и загадай желание!',
    doneText: '🌊 Венок со свечкой плывёт по волнам! Желание обязательно сбудется.',
    paint: paintWreath,
  });
  if (ok) holidayStep('kupala', 'wreath');
}
function bonfire() {
  sfx('magic');
  emit('holiday', { id: 'kupala', what: 'bonfire' });
  if (offset('kupala') < 0) return void toast('🔥 Купальский костёр уже сложили! Зажгут его завтра, на Ивана Купалу.');
  toast(
    darkness() > 0.2
      ? pick(['🔥 Костёр трещит и светит до самого моря. Тепло и уютно!', '🔥 Искорки летят к звёздам. Самая короткая ночь в году!'])
      : pick(['🔥 Купальский костёр! Вечером он будет светить на весь пляж.', '🔥 Как тепло у костра! Пахнет дымком и луговыми цветами.']),
    'good',
  );
}
/** «Водяная битва» на пляже: за первые HOLIDAY.splash.paid игр — монеты по звёздам. */
function splash() {
  if (offset('kupala') < 0) return void toast('💦 Вёдра и водяные пистолеты уже на пляже! Водяная битва — завтра, на Ивана Купалу.');
  return prizeGame('splash', { flag: 'splashes', cfg: HOLIDAY.splash, label: '🌿 <b>Приз Купалы</b>', sticker: 'x_splash' });
}

// ==================== ХЕЛЛОУИН ====================
const CARVE = ['👀 Вырезать глазик', '👀 И второй глазик', '🔺 Носик', '😁 Весёлая улыбка', '🕯️ Зажечь свечку'];
function paintCarve(ctx, w, h, n, a, t) {
  nightSky(ctx, w, h, t, '#2b1d4a', '#6a3d8a', false);
  ell(ctx, w * 0.16, h * 0.14, 20, 20, '#fff3bf');
  ell(ctx, w * 0.16 + 8, h * 0.12, 17, 17, '#2f2050'); // месяц
  fillRR(ctx, w * 0.06, h * 0.78, w * 0.88, 12, 4, '#8d5524', OUT, 1.6); // стол
  ctx.fillStyle = '#5c3d2e';
  ctx.fillRect(0, h * 0.78 + 12, w, h);
  const s = Math.min(w / 380, h / 330),
    lit = n >= CARVE.length;
  // большая тыква
  ctx.save();
  ctx.translate(w * 0.45, h * 0.78);
  ctx.scale(s * 1.6, s * 1.6);
  ctx.lineJoin = 'round';
  jackFace(ctx, n, lit ? 1 : 0, Math.floor(t * 6) % 2);
  ctx.restore();
  if (lit && a < 1) for (let i = 0; i < 8; i++) star(ctx, w * 0.45 + Math.cos(i) * (60 + a * 40) * s, h * 0.58 + Math.sin(i * 1.3) * (40 + a * 30) * s, 4, '#ffd43b');
  drawHamster(ctx, w * 0.85, h * 0.97, 0.7 * s, playerLook(), { time: t, dir: -1, happy: lit, armsUp: a < 0.5 && n > 0 });
}
async function pumpkins() {
  if (offset('halloween') < 0) return void toast('🎃 Тыквы уже привезли на площадь! Вырезать фонарики будем завтра, на Хеллоуин.');
  if (stepDoneFor('halloween', 'carve')) return void toast('🎃 Твоя тыква-фонарик улыбается всем на площади!', 'good');
  const ok = await tapScene({
    title: 'Тыква-фонарик',
    icon: '🎃',
    steps: CARVE.length,
    btn: CARVE[0],
    btns: CARVE,
    hint: 'Нажимай — ложечка сама вырежет глазки, носик и улыбку. Тыква будет весёлой!',
    doneText: '🎃 Тыква светится и улыбается! Самый добрый фонарик в городе.',
    paint: paintCarve,
  });
  if (ok) holidayStep('halloween', 'carve');
}
/** Сценка «Сладость или гадость?»: хомячок с ведёрком-тыквой у двери, хозяин открывает и сыплет конфеты. */
function paintTrick(ctx, w, h, k, look, t) {
  nightSky(ctx, w, h, t, '#2b1d4a', '#7048a8', false);
  ctx.fillStyle = '#3b2a5a';
  ctx.fillRect(0, h * 0.8, w, h * 0.2);
  const hx = w * 0.64,
    hy = h * 0.8;
  fillRR(ctx, hx - 90, hy - 120, 180, 120, 4, '#ffe8cc', OUT, 2);
  poly(ctx, [hx - 104, hy - 116, hx, hy - 176, hx + 104, hy - 116], '#5f3dc4', OUT, 2);
  for (const x of [hx - 60, hx + 60]) fillRR(ctx, x - 20, hy - 96, 40, 36, 4, '#ffd43b', OUT, 1.8);
  const open = Math.min(1, Math.max(0, (k - 0.45) * 4));
  fillRR(ctx, hx - 20, hy - 70, 40, 70, 6, '#ffd43b', OUT, 1.8);
  fillRR(ctx, hx - 20 + open * 26, hy - 70, 40 - open * 26, 70, 6, '#8d5524', OUT, 1.8);
  // тыква-фонарик у двери и паутинка в углу
  ctx.save();
  ctx.translate(hx + 48, hy);
  ctx.scale(0.6, 0.6);
  jackFace(ctx, CARVE.length, 1, Math.floor(t * 6) % 2);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,.6)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(hx - 90, hy - 120);
    ctx.lineTo(hx - 90 + Math.cos((i / 4) * Math.PI * 0.5) * 34, hy - 120 + Math.sin((i / 4) * Math.PI * 0.5) * 34);
    ctx.stroke();
  }
  for (const r of [12, 22, 32]) {
    ctx.beginPath();
    ctx.arc(hx - 90, hy - 120, r, 0, Math.PI / 2);
    ctx.stroke();
  }
  // хомячок с ведёрком-тыквой
  const s = Math.min(w / 520, h / 300),
    x = w * 0.26,
    y = h * 0.95,
    bob = Math.abs(Math.sin(t * 5)) * 4 * s;
  drawHamster(ctx, x, y - bob, 1.05 * s, look, { time: t, dir: 1, happy: true, armsUp: k > 0.6 });
  ctx.save();
  ctx.translate(x + 36 * s, y - 24 * s - bob);
  ctx.scale(0.42 * s, 0.42 * s);
  jackFace(ctx, CARVE.length, 0, 0);
  line(ctx, -26, -54, 26, -54, OUT, 3);
  ctx.restore();
  // конфеты летят из двери в ведёрко
  if (k > 0.55)
    for (let i = 0; i < 5; i++) {
      const q = ((t * 0.9 + i / 5) % 1),
        cx = hx + (x + 36 * s - hx) * q,
        cy = hy - 50 - Math.sin(q * Math.PI) * 60;
      ell(ctx, cx, cy, 6, 4, ['#ff6b9d', '#ffd43b', '#69db7c', '#4dabf7', '#ff922b'][i], OUT, 1);
    }
}
doorRound({
  holiday: 'halloween',
  step: 'treats',
  title: 'Сладость или гадость?',
  icon: '🎃',
  ask: (name) => `<div class="center big-emoji">🎃🍬</div><p class="center">Это домик, где живёт <b>${name}</b>. Постучим и скажем: «Сладость или гадость?» На Хеллоуин хозяева всегда угощают!</p>`,
  go: '🎃 Сладость или гадость!',
  scene: ['🎃 «Сладость или гадость?» — «Конечно, сладость!»', paintTrick],
  treats: HOLIDAY.treats,
  thanks: (npc, d, late) => `Ой, какой нарядный гость! Совсем не страшный, а очень милый!${late} С Хеллоуином! Держи сладость: ${d.e} ${d.name}!`,
  ok: 'Спасибо! С Хеллоуином! 🎃',
  hourHint: `🎃 «Сладость или гадость» — вечером, с ${HOLIDAY.carols[0]}:00. Приходи к этой двери!`,
});
function ghost() {
  sfx('magic');
  emit('holiday', { id: 'halloween', what: 'ghost' });
  toast(
    pick([
      '👻 «Бу-у!» …Ой, это же просто простынка с глазками! Привидение подмигнуло тебе.',
      '👻 Доброе привидение машет краешком простынки: «С Хеллоуином!»',
      '👻 «У-у-у!» — сказало привидение и захихикало. Совсем не страшно!',
    ]),
    'good',
  );
}

holidayActs({
  plant: (p) => plant(p),
  parade: () => parade(),
  wreath: () => wreath(),
  bonfire: () => bonfire(),
  splash: () => splash(),
  pumpkins: () => pumpkins(),
  ghost: () => ghost(),
});
