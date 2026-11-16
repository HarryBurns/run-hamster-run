// КУРОРТНЫЙ ОТЕЛЬ «Морская звезда» (П.17) — ОПИСАНИЕ для «движка домов» (engine/side): три этажа и лифт справа.
//   1-й этаж: холл с ресепшеном (Администратор Звёздочка: снять номер на ночь, люкс, про отель) и носильщиком
//             Тележкиным с тележкой (работа носильщицей), шведский стол, спа (Мастер Пенка: массаж и маска; джакузи);
//   2-й этаж: коридор номеров (двери 201–205 — гости отдыхают; золотая дверь «Люкс» — свой номер-люкс, если куплен)
//             и номер 207 — его снимают на ночь: кровать (зона «лечь спать»), окно на море;
//   3-й этаж: открытая терраса на крыше — бассейн (плавать, как дома), водная горка (мини-игра «Горка»), шезлонги
//             (через день кто-то из друзей отдыхает здесь днём), аниматор Хлопушка по расписанию (зарядка утром,
//             дискотека вечером) и доска с расписанием.
// Дом сам ничего не делает: зоны и работники называют действия реестра hotel:* (features/hotel.js). Рисунок стоек,
// дверей, горки и шезлонгов — крюки art (back — позади всех, mid — стойки перед работниками, но позади хомячка).
// Своя позиция в сохранении (persist): уснула в номере — утро в отеле, и после перезагрузки тоже.
import { G, ownsHome, hotelPoolGuest } from '../core/state.js';
import { ell, fillRR, line, poly, star, shade, emoji } from '../core/draw.js';
import { TAU } from '../core/util.js';
import { HOTEL_DOORS, HOTEL_ROOM, POOL_GUESTS, animatorNow } from '../data/index.js';

const OUT = '#4a3728';
const W = 2000;
// где что стоит (x; этажи 0–2)
export const HX = {
  door: 100,
  desk: 420,
  cart: 735,
  buffet: 1050,
  massage: 1440,
  jacuzzi: 1780,
  doors: [150, 360, 570, 780, 990],
  suite: 1190,
  bed: 1640,
  pool: 640,
  slide: 1170,
  loungers: [1380, 1530],
  stage: 1730,
  board: 1900,
};
const HF = () => (G.state && G.state.dayFlags.hotel) || {};
/** Снят ли номер 207 на эту ночь. */
export const roomRented = () => !!HF().room;
const evening = () => G.state && animatorNow(G.state.minutes) === 'evening';

// ---------- рисунки ----------
function label(ctx, str, x, y, size = 15, col = OUT) {
  ctx.font = `800 ${size}px ui-rounded, "Trebuchet MS", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = col;
  ctx.fillText(str, x, y);
}
function plate(ctx, str, x, y, w, col = '#1098ad', size = 15) {
  fillRR(ctx, x - w / 2, y - 14, w, 28, 9, '#fff', OUT, 2);
  fillRR(ctx, x - w / 2 + 3, y - 11, w - 6, 22, 7, col);
  label(ctx, str, x, y + 1, size, '#fff');
}
function suitcase(ctx, x, y, w, h, col) {
  fillRR(ctx, x - w / 2, y - h, w, h, 5, col, OUT, 2);
  fillRR(ctx, x - 7, y - h - 7, 14, 8, 3, null, OUT, 2);
  line(ctx, x - w / 2 + 6, y - h / 2, x + w / 2 - 6, y - h / 2, 'rgba(0,0,0,.2)', 2);
  fillRR(ctx, x + w / 2 - 12, y - h + 4, 9, 13, 2, '#fff', OUT, 1); // бирка
}
function plantPot(ctx, x, y, s = 1) {
  fillRR(ctx, x - 16 * s, y - 30 * s, 32 * s, 30 * s, 5, '#e8590c', OUT, 2);
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.5;
    ell(ctx, x + Math.cos(a) * 22 * s, y - 40 * s + Math.sin(a) * 22 * s, 16 * s, 7 * s, i % 2 ? '#40c057' : '#2f9e44', OUT, 1.5, a);
  }
}
function lounger(ctx, x, y, col) {
  // шезлонг: спинка слева, полоски
  poly(ctx, [x - 70, y - 30, x + 60, y - 30, x + 66, y - 22, x - 66, y - 22], '#fff', OUT, 2);
  poly(ctx, [x - 70, y - 30, x - 92, y - 72, x - 80, y - 76, x - 58, y - 30], col, OUT, 2);
  for (let i = 0; i < 5; i++) ctx.fillRect(x - 56 + i * 24, y - 30, 10, 8);
  for (const dx of [-60, 56]) line(ctx, x + dx, y - 22, x + dx, y - 2, OUT, 3);
  fillRR(ctx, x + 10, y - 40, 40, 12, 5, '#ffd8a8', OUT, 1.5); // полотенце
}

/** Холл: люстра, ключи на стене, логотип, диванчик, растения, тележка с чемоданами. */
function drawLobby(ctx, t) {
  const y = 0;
  // люстра
  line(ctx, 260, y - 250, 260, y - 220, OUT, 2);
  for (let i = -2; i <= 2; i++) ell(ctx, 260 + i * 14, y - 212 + Math.abs(i) * 3, 5, 8, '#fff3bf', OUT, 1.2);
  fillRR(ctx, 228, y - 224, 64, 8, 4, '#ffd43b', OUT, 1.5);
  // логотип и стена с ключами за стойкой
  fillRR(ctx, HX.desk - 120, y - 228, 240, 64, 12, '#e3fafc', OUT, 2);
  star(ctx, HX.desk - 92, y - 196, 16, '#ffd43b', OUT, 1.6);
  label(ctx, 'Морская звезда', HX.desk + 12, y - 205, 20, '#0b7285');
  label(ctx, 'ресепшен · 24 часа', HX.desk + 12, y - 182, 12, '#1098ad');
  fillRR(ctx, HX.desk - 96, y - 150, 192, 46, 6, '#c98b5a', OUT, 2);
  for (let i = 0; i < 8; i++) {
    const kx = HX.desk - 82 + i * 23;
    ell(ctx, kx, y - 138, 3, 3, '#ffd43b', OUT, 1);
    line(ctx, kx, y - 135, kx, y - 118, '#ffd43b', 2);
    fillRR(ctx, kx - 6, y - 120, 12, 10, 2, ['#ff8fab', '#74c0fc', '#8ce99a', '#ffd43b'][i % 4], OUT, 1);
  }
  // колокольчик на стойке рисуется в mid; здесь — табличка «Добро пожаловать» у двери
  plate(ctx, 'Добро пожаловать!', 250, y - 128, 150, '#e64980', 12);
  // диванчик ожидания и кадки
  fillRR(ctx, 200, y - 56, 120, 30, 10, '#63e6be', OUT, 2);
  fillRR(ctx, 196, y - 84, 128, 34, 12, '#96f2d7', OUT, 2);
  for (const dx of [204, 316]) line(ctx, dx, y - 26, dx, y - 2, OUT, 3);
  plantPot(ctx, 168, y, 1.1);
  plantPot(ctx, 580, y, 1);
  // тележка носильщика с чемоданами (золотая)
  const cx = HX.cart;
  line(ctx, cx - 50, y - 150, cx - 50, y - 18, '#f59f00', 5);
  line(ctx, cx + 50, y - 150, cx + 50, y - 18, '#f59f00', 5);
  ctx.beginPath();
  ctx.arc(cx, y - 150, 50, Math.PI, 0);
  ctx.strokeStyle = '#f59f00';
  ctx.lineWidth = 5;
  ctx.stroke();
  fillRR(ctx, cx - 60, y - 24, 120, 10, 4, '#ffd43b', OUT, 2);
  for (const dx of [-42, 42]) ell(ctx, cx + dx, y - 8, 9, 9, '#495057', OUT, 2);
  suitcase(ctx, cx - 22, y - 24, 44, 50, '#ff8fab');
  suitcase(ctx, cx + 22, y - 24, 36, 40, '#74c0fc');
  suitcase(ctx, cx - 4, y - 74, 52, 34, '#ffd43b');
  suitcase(ctx, cx + 4, y - 108, 34, 30, '#b197fc');
}

/** Шведский стол: длинная стойка с блюдами, вывеска, столики. */
function drawBuffetBack(ctx) {
  const y = 0,
    x = HX.buffet;
  plate(ctx, '🍽️ Шведский стол', x, y - 222, 210, '#f08c00', 15);
  // столики у окна
  for (const tx of [840, 1260]) {
    fillRR(ctx, tx - 34, y - 64, 68, 8, 3, '#fff', OUT, 2);
    line(ctx, tx, y - 56, tx, y - 4, OUT, 3);
    fillRR(ctx, tx - 16, y - 6, 32, 6, 3, '#adb5bd', OUT, 1.5);
    ell(ctx, tx - 10, y - 70, 8, 4, '#fff', OUT, 1.2);
    line(ctx, tx + 12, y - 64, tx + 12, y - 82, '#ff8fab', 3);
    ell(ctx, tx + 12, y - 86, 5, 5, '#ff6b9d', OUT, 1);
  }
}
const DISH_ROW = ['🥐', '🍪', '🍉', '🍕', '🍝', '🍋', '🧁'];
/** Стойка шведского стола (перед поваром нет — просто стойка, рисуется в mid, чтобы хомячок шёл перед ней). */
function drawBuffetCounter(ctx) {
  const y = 0,
    x = HX.buffet;
  fillRR(ctx, x - 170, y - 74, 340, 74, 8, '#ffe8cc', OUT, 2);
  fillRR(ctx, x - 178, y - 86, 356, 16, 6, '#fff', OUT, 2);
  for (let i = 0; i < 4; i++) fillRR(ctx, x - 150 + i * 80, y - 62, 60, 46, 6, '#ffd8a8', OUT, 1.5);
  DISH_ROW.forEach((e, i) => {
    const dx = x - 150 + i * 50;
    ell(ctx, dx, y - 88, 20, 6, '#fff', OUT, 1.5);
    emoji(ctx, e, dx, y - 102, 22);
  });
}

/** Спа: массажный стол, полка с полотенцами, свечи, вывеска. */
function drawSpaBack(ctx, t) {
  const y = 0,
    x = HX.massage;
  plate(ctx, '🧖 Спа «Пенка»', 1600, y - 222, 190, '#12b886', 15);
  // полка с полотенцами и свечи
  fillRR(ctx, 1380, y - 186, 120, 10, 3, '#c98b5a', OUT, 1.5);
  for (let i = 0; i < 3; i++) fillRR(ctx, 1388 + i * 36, y - 210, 30, 24, 6, ['#ffd8e4', '#c3fae8', '#fff3bf'][i], OUT, 1.5);
  for (const cx of [1530, 1556]) {
    fillRR(ctx, cx - 5, y - 134, 10, 18, 2, '#fff', OUT, 1.2);
    const f = Math.sin(t * 6 + cx) * 1.5;
    poly(ctx, [cx - 3, y - 134, cx + f, y - 146, cx + 3, y - 134], '#ffa94d');
  }
  fillRR(ctx, 1516, y - 118, 56, 8, 3, '#c98b5a', OUT, 1.5);
  // массажный стол с подушкой-валиком и огуречными масками в мисочке
  fillRR(ctx, x - 80, y - 58, 160, 16, 7, '#fff', OUT, 2);
  fillRR(ctx, x - 76, y - 66, 34, 12, 6, '#ffd8e4', OUT, 1.5);
  for (const dx of [-66, 66]) line(ctx, x + dx, y - 42, x + dx, y - 2, OUT, 4);
  ell(ctx, x + 50, y - 72, 14, 5, '#e6fcf5', OUT, 1.2);
  for (let i = 0; i < 3; i++) ell(ctx, x + 42 + i * 8, y - 76, 4, 4, '#8ce99a', '#2f9e44', 1);
}

/** Коридор номеров: ковровая дорожка, двери с номерами, бра, золотая дверь «Люкс». */
function drawCorridor(ctx) {
  const y = -276;
  fillRR(ctx, 20, y - 6, 1240, 8, 3, '#e64980');
  for (const [i, x] of HX.doors.entries()) {
    fillRR(ctx, x - 44, y - 186, 88, 186, 6, '#8d5524', OUT, 2);
    fillRR(ctx, x - 38, y - 180, 76, 180, 4, ['#ffd8a8', '#c5f6fa', '#d0bfff', '#b2f2bb', '#ffc9c9'][i], OUT, 1.5);
    fillRR(ctx, x - 22, y - 168, 44, 22, 6, '#fff', OUT, 1.5);
    label(ctx, String(HOTEL_DOORS[i]), x, y - 156, 15);
    ell(ctx, x + 26, y - 88, 4, 4, '#ffd43b', OUT, 1.2);
    // бра между дверями
    const lx = x + 105;
    fillRR(ctx, lx - 3, y - 196, 6, 12, 2, '#ffd43b', OUT, 1);
    poly(ctx, [lx - 10, y - 184, lx + 10, y - 184, lx + 6, y - 170, lx - 6, y - 170], '#fff3bf', OUT, 1.2);
  }
  // золотая дверь «Люкс»
  const x = HX.suite,
    mine = ownsHome('suite');
  fillRR(ctx, x - 50, y - 200, 100, 200, 8, '#f59f00', OUT, 2.5);
  fillRR(ctx, x - 42, y - 192, 84, 192, 6, '#ffe066', OUT, 1.5);
  for (const dy of [-150, -80]) fillRR(ctx, x - 30, y + dy, 60, 50, 6, null, 'rgba(160,100,0,.5)', 2);
  star(ctx, x, y - 214, 12, '#ffd43b', OUT, 1.5);
  plate(ctx, mine ? '🔑 Мой люкс' : 'Люкс', x, y - 172, mine ? 116 : 80, '#e8590c', 14);
  ell(ctx, x + 30, y - 96, 5, 5, '#fff', OUT, 1.2);
}

/** Номер 207: табличка с номером; пока номер не снят — на кровати карточка «Свободно». */
function drawRoom(ctx) {
  const y = -276;
  plate(ctx, `Номер ${HOTEL_ROOM}`, 1340 + 70, y - 222, 120, '#1971c2', 14);
  if (!roomRented()) {
    fillRR(ctx, HX.bed - 52, y - 116, 104, 34, 8, '#fff', OUT, 2);
    label(ctx, 'Свободно', HX.bed, y - 104, 14, '#2f9e44');
    label(ctx, 'ключ — на ресепшене', HX.bed, y - 89, 9, '#495057');
  } else {
    // шоколадка на подушке — номер ждёт гостью
    fillRR(ctx, HX.bed - 82, y - 104, 22, 12, 3, '#8d5524', OUT, 1.2);
  }
}

/** Водная горка: вышка с лесенкой и труба-спираль в бассейн. */
function drawSlide(ctx) {
  const y = -552,
    x = HX.slide;
  // вышка
  for (const dx of [20, 80]) line(ctx, x + dx, y - 200, x + dx, y - 2, '#adb5bd', 6);
  for (let i = 0; i < 8; i++) line(ctx, x + 20, y - 20 - i * 24, x + 80, y - 20 - i * 24, '#adb5bd', 4);
  fillRR(ctx, x + 6, y - 214, 90, 14, 4, '#ffd43b', OUT, 2);
  plate(ctx, '🌀 Горка', x + 50, y - 236, 100, '#e64980', 14);
  // труба: с вышки влево, петля, спуск в правый край бассейна
  const pts = [];
  for (let k = 0; k <= 40; k++) {
    const q = k / 40,
      a = q * TAU * 0.9;
    pts.push([x + 10 - q * 150 + Math.sin(a) * 30, y - 205 + q * 150 + (1 - Math.cos(a)) * 14]);
  }
  pts.push([HX.pool + 380, y - 58]);
  const tube = (w, col) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.stroke();
  };
  tube(30, OUT);
  tube(25, '#ffd43b');
  tube(10, '#ff922b');
  ctx.setLineDash([4, 12]);
  tube(4, 'rgba(255,255,255,.8)');
  ctx.setLineDash([]);
  ctx.lineCap = 'butt';
}

/** Терраса: шезлонги, сцена аниматора (вечером — диско-шар и огоньки), доска с расписанием. */
function drawTerrace(ctx, t) {
  const y = -552;
  lounger(ctx, HX.loungers[0], y, '#ff8fab');
  lounger(ctx, HX.loungers[1], y, '#63e6be');
  // зонтик между шезлонгами
  const ux = (HX.loungers[0] + HX.loungers[1]) / 2;
  line(ctx, ux, y - 4, ux, y - 150, OUT, 3);
  ctx.beginPath();
  ctx.moveTo(ux - 70, y - 130);
  ctx.quadraticCurveTo(ux, y - 190, ux + 70, y - 130);
  ctx.closePath();
  ctx.fillStyle = '#ffd43b';
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2;
  ctx.stroke();
  // сцена аниматора: помост и колонки
  const sx = HX.stage;
  fillRR(ctx, sx - 110, y - 16, 220, 16, 4, '#b197fc', OUT, 2);
  for (const dx of [-92, 92]) {
    fillRR(ctx, sx + dx - 16, y - 76, 32, 60, 5, '#343a40', OUT, 2);
    ell(ctx, sx + dx, y - 60, 9, 9, '#868e96', OUT, 1.5);
    ell(ctx, sx + dx, y - 32, 6, 6, '#868e96', OUT, 1.5);
  }
  if (evening()) {
    // диско-шар и цветные лучи
    line(ctx, sx, y - 250, sx, y - 210, OUT, 2);
    ell(ctx, sx, y - 196, 16, 16, '#dee2e6', OUT, 2);
    for (let i = 0; i < 5; i++) {
      const a = t * 1.5 + (i * TAU) / 5;
      ctx.globalAlpha = 0.18;
      poly(ctx, [sx, y - 196, sx + Math.cos(a) * 220 - 20, y - 10, sx + Math.cos(a) * 220 + 20, y - 10], ['#ff6b9d', '#ffd43b', '#63e6be', '#74c0fc', '#b197fc'][i]);
      ctx.globalAlpha = 1;
    }
  }
  // доска с расписанием
  const bx = HX.board;
  line(ctx, bx, y - 4, bx, y - 90, OUT, 4);
  fillRR(ctx, bx - 44, y - 180, 88, 96, 8, '#fff9db', OUT, 2);
  label(ctx, 'Аниматор', bx, y - 164, 12, '#e64980');
  label(ctx, '🤸 8:00', bx, y - 140, 13);
  label(ctx, 'зарядка', bx, y - 124, 10, '#495057');
  label(ctx, '🪩 19:00', bx, y - 104, 13);
  label(ctx, 'дискотека', bx, y - 90, 10, '#495057');
}

/** Стойка ресепшена (перед администратором, позади хомячка). */
function drawDesk(ctx) {
  const y = 0,
    x = HX.desk;
  fillRR(ctx, x - 110, y - 62, 220, 62, 8, '#1098ad', OUT, 2.2);
  fillRR(ctx, x - 118, y - 74, 236, 16, 6, '#fff8ec', OUT, 2);
  for (let i = 0; i < 3; i++) fillRR(ctx, x - 92 + i * 64, y - 50, 56, 40, 6, shade('#1098ad', 0.25), OUT, 1.4);
  star(ctx, x, y - 30, 12, '#ffd43b', OUT, 1.5);
  // звонок и книга гостей
  ell(ctx, x + 80, y - 80, 12, 8, '#ffd43b', OUT, 1.5);
  ell(ctx, x + 80, y - 90, 3, 3, '#ffd43b', OUT, 1);
  fillRR(ctx, x - 96, y - 82, 40, 8, 2, '#e64980', OUT, 1.2);
}

export default {
  id: 'hotel',
  name: 'Отель «Морская звезда»',
  floors: 3,
  width: W,
  lift: true,
  persist: true,
  exit: 'home-exit',
  music: 'town',
  door: { f: 0, x: 170 },
  shell: { wall: '#fff4e6', roof: '#1098ad', flat: true, chimneyX: null, bushes: true, trees: 'palm', ground: 'sand' },
  rooms: [
    { id: 'lobby', f: 0, x0: 0, x1: 780, name: 'Холл', wall: '#fff3bf', paper: 'diamonds', floor: 'check', win: null },
    { id: 'buffet', f: 0, x0: 780, x1: 1340, name: 'Шведский стол', wall: '#ffe8cc', paper: 'stripes', floor: 'wood', win: 1050, winW: 200, view: 'sea' },
    { id: 'spa', f: 0, x0: 1340, x1: W, name: 'Спа', wall: '#e6fcf5', paper: 'waves', floor: 'tile', win: null },
    { id: 'hall', f: 1, x0: 0, x1: 1300, name: 'Коридор номеров', wall: '#fff0f6', paper: 'stripes', floor: 'wood', win: null },
    { id: 'room', f: 1, x0: 1300, x1: W, name: `Номер ${HOTEL_ROOM}`, wall: '#e7f5ff', paper: 'dots', floor: 'wood', win: 1460, winW: 160, view: 'sea', main: true },
    { id: 'roof', f: 2, x0: 0, x1: W, name: 'Бассейн на крыше', wall: '#c9ecff', paper: 'open', floor: 'deck', win: null },
  ],
  built: [
    { id: 'door', type: 'door', f: 0, x: HX.door, c: '#1098ad' },
    { id: 'desk', type: 'zone', f: 0, x: HX.desk, w: 240, h: 150, act: 'hotel:reception' },
    { id: 'cart', type: 'zone', f: 0, x: HX.cart, w: 130, h: 170, act: 'hotel:porter' },
    { id: 'buffet', type: 'zone', f: 0, x: HX.buffet, w: 360, h: 140, act: 'hotel:buffet' },
    { id: 'massage', type: 'zone', f: 0, x: HX.massage, w: 180, h: 120, act: 'hotel:spa' },
    { id: 'jacuzzi', type: 'jacuzzi', f: 0, x: HX.jacuzzi },
    ...HX.doors.map((x, i) => ({ id: 'door' + HOTEL_DOORS[i], type: 'zone', f: 1, x, w: 90, h: 186, act: 'hotel:knock:' + HOTEL_DOORS[i] })),
    { id: 'suite', type: 'zone', f: 1, x: HX.suite, w: 104, h: 200, act: 'hotel:suite' },
    { id: 'bed', type: 'zone', f: 1, x: HX.bed, w: 220, h: 120, act: 'hotel:bed' },
    { id: 'pool', type: 'pool', f: 2, x: HX.pool },
    { id: 'slide', type: 'zone', f: 2, x: HX.slide + 40, w: 140, h: 250, act: 'hotel:slide' },
    { id: 'board', type: 'zone', f: 2, x: HX.board, w: 96, h: 190, act: 'hotel:schedule' },
  ],
  furniture: {
    fixed: [
      ['rug_blue', 1, HX.bed],
      ['bed_blue', 1, HX.bed],
      ['nightstand', 1, HX.bed + 150],
      ['lamp_pink', 1, HX.bed + 220],
      ['armchair_blue', 1, 1370],
      ['pic_sea', 1, HX.bed, 190],
      ['plant_palm', 1, 1940],
      ['clock', 0, 640, 200],
      ['plant_ficus', 2, 1290],
    ],
  },
  actors: [
    { npc: 'zvezdochka', f: 0, x: HX.desk, act: 'hotel:reception' },
    { npc: 'telezhkin', f: 0, x: HX.cart - 100, roam: [600, 660], act: 'hotel:porter' },
    { npc: 'penka', f: 0, x: 1560, act: 'hotel:spa' },
    { npc: 'hlopushka', f: 2, x: HX.stage, roam: [HX.stage - 70, HX.stage + 70], act: 'hotel:animator', when: () => !!G.state && !!animatorNow(G.state.minutes) },
    ...POOL_GUESTS.map((id) => ({ npc: id, f: 2, x: HX.loungers[1] - 60, roam: [1380, 1560], act: 'npc:' + id, when: () => hotelPoolGuest() === id })),
  ],
  art: {
    back(ctx, sc, t) {
      drawLobby(ctx, t);
      drawBuffetBack(ctx);
      drawSpaBack(ctx, t);
      drawCorridor(ctx);
      drawRoom(ctx);
      drawSlide(ctx);
      drawTerrace(ctx, t);
    },
    mid(ctx) {
      drawDesk(ctx);
      drawBuffetCounter(ctx);
    },
  },
};
