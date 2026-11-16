// УДАЛЁННЫЙ ОСТРОВ (П.9): что делают на острове и по дороге туда. Сам остров (где что стоит, вулкан, праздник огней,
// цветы) — locations/island.js; он называет действия реестра, а выполняются они здесь:
//   liftman            поговорить с Лифтёром Этажкиным в холле Хомяк-Тауэра (задание «Остров на горизонте» и болтовня)
//   island:spot        нашли далёкий остров в подзорную трубу «море» (interiors/tower.js; шаг задания Этажкина)
//   chief              поговорить с Вождём Кокосом: задание «Праздник огней», лея из цветов, маленький тотем, болтовня
//   islander:<id>      поболтать с островитянами (Барабанщик Бум, Островитянка Лагуна)
//   island:volcano     посмотреть на вулкан (в первый раз — наклейка)
//   island:obsidian    взять кусочек вулканического стекла у подножия (раз в день)
//   island:flower      подобрали цветок для леи (находка pickups; в первый раз — подсказка)
//   island:fire        костёр: вечером на празднике огней — потанцевать (сценка, наклейка); днём — когда праздник
//   island:bowling     мини-игра «Кокосовый боулинг» (minigames/bowling.js): за первые ISLAND.bowling.paid игр в день —
//                      монеты по звёздам
//   island:sleep       хижина для гостей: переночевать на острове (сон — features/sleep.js; утро — тоже на острове)
//   island:home:<id>   домики островитян: хозяин гуляет — подсказка, где его найти
//   faraway:go | back  кораблик: из моря города (отметка «Далеко на юг» — LANDS.island.go) к причалу острова и обратно
//                      к пирсу города; картинка-переезд подольше — открытый океан, дельфины, вдали вулкан
// Находки продаются на рынке (features/market.js, цены — ISLAND). Числа — ISLAND в data/economy.js. Каждое занятие
// шлёт событие island { what } — по нему считают задания. Состояние меняют только действия (core/actions.js);
// «раз в день» — отметки дня (dayFlags.island).
import { setFlag, setDayFlag, addItem, addClothes, award, earn } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { makeCanvas, ell, fillRR, line, poly, star } from '../core/draw.js';
import { on, emit } from '../core/events.js';
import { go, sceneName } from '../core/loop.js';
import { register, run } from '../core/registry.js';
import { G, darkness, count, playerLook, hasClothes } from '../core/state.js';
import { el, esc, pick, fmtMoney } from '../core/util.js';
import { drawHamster } from '../art/hamster.js';
import { NPC_BY_ID, FIND_BY_ID, LEI_IDS, ISLAND, LAND_BY_ID, npcLook } from '../data/index.js';
import { getLocation } from '../engine/topdown/index.js';
import { festNow, placeFlowers, AT } from '../locations/island.js';
import { paintCoconut } from '../locations/island_art.js';
import { drawBoat } from '../locations/sea.js';
import { sea } from '../locations/town.js';
import { dialog } from '../ui/dialog.js';
import { openLayer } from '../ui/modals.js';
import { message } from '../ui/panel.js';
import { toast } from '../ui/toast.js';
import { playMinigame } from './minigames.js';
import { questTalk } from './quests.js';

const S = () => G.state;
const OUT = '#4a3728';
const SI = () => S().dayFlags.island || {};
/** Реплика по времени суток: ночью, вечером или днём (у жителей острова — lines.day / evening / night). */
function timeLine(id) {
  const L = NPC_BY_ID[id].lines,
    m = S().minutes;
  if (darkness() > 0.6 || m >= 22 * 60 || m < 5 * 60) return pick(L.night);
  if (m >= 18 * 60) return pick(L.evening);
  return pick(L.day);
}
const sayAs = (id, text, options, happy = false) => dialog({ look: npcLook(id), name: NPC_BY_ID[id].name, text, options, happy });

// ---------- Лифтёр Этажкин (Хомяк-Тауэр) ----------
/** Разговор с лифтёром: сначала задание из журнала, потом — как обычно. */
export async function talkLiftman() {
  emit('talk', { id: 'etazhkin' });
  sfx('tap');
  const qt = await questTalk('etazhkin');
  if (qt && qt.end) return;
  let text =
    (qt && qt.text) ||
    'Добро пожаловать в Хомяк-Тауэр! Лифт справа: заходи — и вжух на 101-й этаж. Наверху смотровая площадка, подзорные трубы и бумажные самолётики!';
  for (;;) {
    const i = await sayAs('etazhkin', text, [{ text: '💬 Поболтать', cls: 'blue' }, { text: 'Спасибо!', cls: 'green' }]);
    if (i !== 0) return;
    text = landIsOpen() ? pick(['Ну как там остров? Расскажешь мне потом про вулкан?', ...NPC_BY_ID.etazhkin.lines.day]) : timeLine('etazhkin');
  }
}
const landIsOpen = () => Number.isFinite(S().lands.island);
register('liftman', () => talkLiftman(), 'лифтёр Этажкин в холле Хомяк-Тауэра: задание «Остров на горизонте» и болтовня');

/** Нашли остров в подзорную трубу (шаг задания «Остров на горизонте»). */
export async function spotIsland() {
  emit('island', { what: 'spot' });
  sfx('magic');
  await message({
    title: 'Остров на горизонте!',
    icon: '🌋',
    html: `<p class="center big-emoji">🔭🌋</p><p class="center">Вот он! Далеко-далеко на юге, у самой линии горизонта, — остров, а над ним поднимается дымок. Настоящий вулкан! Без компаса туда не доплыть… Компас есть у <b>Капитана Боба</b> на пирсе!</p>`,
    buttons: [{ text: 'Ух ты!' }],
  });
}
register('island', (p, ctx) => islandAct(p, ctx), 'удалённый остров: island:spot | volcano | obsidian | flower | fire | dance | bowling | sleep | home:<id>');

// ---------- Вождь Кокос ----------
const CHIEF = 'kokos';
/** Сколько разных цветов для леи в рюкзаке. */
export const leiKinds = () => LEI_IDS.filter((id) => count('finds', id) > 0).length;
const leiLine = () => LEI_IDS.map((id) => `${FIND_BY_ID[id].e} ${count('finds', id) ? '✓' : '—'}`).join(' · ');
/** Разговор с Вождём: сначала задание из журнала, потом — лея, тотем и болтовня. */
export async function talkChief() {
  const s = S();
  let text;
  if (!s.flags.metKokos) {
    setFlag('metKokos');
    text = `Алоха, ${esc(s.name)}! Добро пожаловать на наш остров! Я — Вождь Кокос. Видишь вулкан? Он у нас добрый, только иногда ворчит. Каждый вечер у костра — праздник огней, а на востоке, у тотемов, играют в кокосовый боулинг!`;
  } else text = pick([`Алоха, ${esc(s.name)}!`, 'О, гостья из далёкого города! Как тебе наш остров?', 'Алоха! Вулкан сегодня в хорошем настроении — видишь, какой ровный дымок?']);
  emit('talk', { id: CHIEF });
  sfx('tap');
  const qt = await questTalk(CHIEF);
  if (qt && qt.end) return;
  if (qt && qt.text) text = qt.text;
  for (;;) {
    const opts = [{ text: '🥥 Сыграть в кокосовый боулинг', cls: 'yellow', fn: async () => (await bowlingGame(), null) }];
    for (const o of MORE_TALK) {
      const x = o(S());
      if (x) opts.push(x);
    }
    opts.push({ text: '💬 Поболтать', cls: 'blue', go: 'chat' }, { text: 'Пока!', go: 'bye' });
    const i = await sayAs(CHIEF, text, opts);
    const o = opts[i] || {};
    if (o.go === 'chat') text = timeLine(CHIEF);
    else if (o.fn) {
      const r = await o.fn();
      if (!r) return;
      text = r;
    } else return;
  }
}
/** Дополнительные ответы Вождя: (s) → { text, cls, fn: async () => следующая реплика | null } или ничего. */
const MORE_TALK = [
  // лея из трёх разных цветов (одна на всю игру — это вещь в шкафу)
  () =>
    LEI_IDS.some((id) => count('finds', id) > 0) &&
    !hasClothes('lei_island') && {
      text: `🌺 Сплети лею (${leiKinds()} из ${LEI_IDS.length})`,
      cls: 'green',
      fn: async () => {
        if (leiKinds() < ISLAND.lei) return `Для леи нужны три разных цветка: ${leiLine()}. Каждое утро на острове распускается новый — ищи у цветущих кустов!`;
        for (const id of LEI_IDS) addItem('finds', id, -1);
        addClothes('lei_island');
        sfx('win');
        award('x_lei', { delay: 1200 });
        emit('island', { what: 'lei' });
        return 'Плюмерия, гибискус и орхидея — вот и лея! Носи её на шее — и ты настоящая островитянка 🌺 Она уже в шкафу.';
      },
    },
  // маленький тотем из трёх кусочков вулканического стекла (можно много — это украшение для дома)
  () =>
    count('finds', 'obsidian') > 0 && {
      text: `🗿 Вырежи маленький тотем (${Math.min(count('finds', 'obsidian'), ISLAND.totem)} из ${ISLAND.totem})`,
      cls: 'green',
      fn: async () => {
        const n = count('finds', 'obsidian');
        if (n < ISLAND.totem) return `Для тотема нужно три кусочка вулканического стекла — у тебя ${n}. Каждый день у подножия вулкана лежит новый кусочек!`;
        addItem('finds', 'obsidian', -ISLAND.totem);
        addItem('storage', 'mini_totem', 1);
        sfx('win');
        award('x_totem', { delay: 1200 });
        emit('island', { what: 'totem' });
        return 'Тук-тук-тук… Готово! Маленький тотем из вулканического стекла — он охраняет хорошее настроение 🗿 Тотем уже в кладовке: дома нажми 🔨.';
      },
    },
  // куда деть находки
  () =>
    (count('finds', 'obsidian') > 0 || LEI_IDS.some((id) => count('finds', id) > 0)) && {
      text: '🪙 А находки можно продать?',
      fn: async () =>
        `Конечно! Торговец Грошик на рынке в городе берёт вулканическое стекло — ${ISLAND.obsidian} монет за кусочек, а цветы — по ${Math.min(...Object.values(ISLAND.flowers))}–${Math.max(...Object.values(ISLAND.flowers))}. А из трёх разных цветов я сплету лею, из трёх кусочков стекла — вырежу тотем!`,
    },
];
register('chief', () => talkChief(), 'Вождь Кокос: разговор (житель удалённого острова у костра)');

// ---------- островитяне ----------
async function talkIslander(id) {
  if (!NPC_BY_ID[id]) return;
  emit('talk', { id });
  sfx('tap');
  const qt = await questTalk(id);
  if (qt && qt.end) return;
  let text = (qt && qt.text) || timeLine(id);
  for (;;) {
    const opts = [];
    if (id === 'bum') opts.push({ text: '🥁 Постучать в барабан', cls: 'yellow', drum: true });
    opts.push({ text: '💬 Ещё!', cls: 'blue', chat: true }, { text: 'Пока!' });
    const i = await sayAs(id, text, opts);
    const o = opts[i] || {};
    if (o.drum) {
      for (let k = 0; k < 4; k++) setTimeout(() => sfx('thud'), k * 180);
      text = pick(['Бум-бум-тук-тук! Отлично получается! Ты почти как я!', 'Тук-тук-БУМ! Слышишь, как вулкан подпевает?', 'Вот это ритм! Приходи вечером на праздник — постучим вместе!']);
    } else if (o.chat) text = timeLine(id);
    else return;
  }
}
register('islander', (p) => talkIslander(p.arg), 'островитяне удалённого острова: islander:<bum | laguna> — поболтать');

// ---------- занятия острова ----------
const islandScene = (ctx) => (ctx && ctx.scene) || (sceneName() === 'island' ? getLocation('island') : null);
function islandAct(p, ctx) {
  const a = p.arg || '';
  if (a.startsWith('home:')) return homeTap(a.slice(5));
  const fn = ACTS[a];
  return fn ? fn(ctx) : false;
}
function homeTap(id) {
  sfx('tap');
  const n = NPC_BY_ID[id];
  if (!n) return;
  toast(id === 'bum' ? `🛖 Это домик ${n.name.split(' ')[1]}а. Дома никого — Бум стучит на барабане у костра! 🥁` : `🛖 Это домик ${n.name.split(' ')[1]}ы. Она гуляет у пляжа — плетёт гирлянды из цветов 🌺`);
}
/** Посмотреть на вулкан. */
function volcanoLook() {
  sfx('magic');
  if (award('x_volcano', { delay: 900 })) toast('🌋 Ух, какой большой! Из кратера поднимается дымок — вулкан дышит. Вождь Кокос говорит, он добрый.', 'good');
  else toast(darkness() > 0.5 ? '🌋 Ночью в кратере светится лава — как огромный ночник!' : '🌋 Вулкан тихонько дымит. У подножия блестит чёрное стекло.');
  emit('island', { what: 'volcano' });
  return true;
}
/** Взять кусочек вулканического стекла (раз в день). */
function takeObsidian() {
  if (SI().obsidian) {
    toast('🪨 Сегодня кусочек стекла ты уже взяла. Завтра вулкан приготовит новый!');
    return true;
  }
  setDayFlag('obsidian', 1, 'island');
  addItem('finds', 'obsidian', 1);
  sfx('pop');
  const f = FIND_BY_ID.obsidian;
  toast(`${f.e} Чёрное блестящее стекло — его сделал сам вулкан! +1 ${f.name}`, 'good');
  emit('island', { what: 'obsidian' });
  return true;
}
/** Подобрали цветок для леи (pickups). */
function flowerFound() {
  emit('island', { what: 'flower' });
  if (!S().flags.leiHint) {
    setFlag('leiHint');
    setTimeout(() => toast('🌺 Каждое утро на острове распускается новый цветок. Из трёх разных Вождь Кокос сплетёт лею!', 'good'), 900);
  }
  return true;
}
/** Костёр: на празднике — потанцевать; днём — когда праздник. */
function fireTap() {
  if (festNow()) return void dance();
  sfx('tap');
  const m = S().minutes;
  toast(m >= ISLAND.fest.to * 60 || m < 5 * 60 ? '🔥 Праздник огней уже закончился — все пошли спать. Приходи завтра вечером!' : `🔥 Праздник огней — каждый вечер у костра, с ${ISLAND.fest.from}:00 до ${ISLAND.fest.to}:00. Приходи танцевать!`);
}

// ---------- праздник огней: танец у костра (короткая сценка) ----------
const DANCE_LOOKS = ['kokos', 'bum', 'laguna'];
/** Картинка сценки: ночное небо, костёр, огоньки, хомячок и островитяне танцуют (k — 0..1 сценки). */
export function paintDance(ctx, w, h, k, look, t) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#1b1f4a');
  sky.addColorStop(0.7, '#5b3a6e');
  sky.addColorStop(1, '#a8543a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 30; i++) star(ctx, ((i * 0.37) % 1) * w, ((i * 0.61) % 0.5) * h, 1.2 + (i % 3) * 0.6, `rgba(255,255,255,${0.4 + 0.4 * Math.sin(t * 2 + i)})`);
  // вулкан вдали со светящимся кратером
  poly(ctx, [w * 0.55, h * 0.62, w * 0.7, h * 0.3, w * 0.76, h * 0.3, w * 0.92, h * 0.62], '#3a2b3a', OUT, 2);
  ell(ctx, w * 0.73, h * 0.3, w * 0.03, h * 0.015, '#ff6b35');
  for (let i = 0; i < 3; i++) {
    const ph = (t * 0.2 + i / 3) % 1;
    ell(ctx, w * 0.74 + ph * 20, h * 0.27 - ph * 50, 6 + ph * 14, 5 + ph * 8, `rgba(200,170,190,${(0.5 * (1 - ph)).toFixed(2)})`);
  }
  // земля и гирлянда
  ctx.fillStyle = '#6b4a2e';
  ctx.fillRect(0, h * 0.62, w, h * 0.38);
  ctx.strokeStyle = 'rgba(255,255,255,.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.12);
  ctx.quadraticCurveTo(w / 2, h * 0.3, w, h * 0.12);
  ctx.stroke();
  for (let i = 1; i < 14; i++) {
    const q = i / 14,
      x = q * w,
      y = h * 0.12 + Math.sin(q * Math.PI) * h * 0.09;
    ell(ctx, x, y + 4, 4, 5, ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#da77f2'][i % 5], OUT, 1);
  }
  // костёр
  const cx = w / 2,
    cy = h * 0.8;
  const g = ctx.createRadialGradient(cx, cy - 20, 0, cx, cy - 20, h * 0.5);
  g.addColorStop(0, 'rgba(255,190,90,.55)');
  g.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  for (const a of [-0.5, 0.5]) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    fillRR(ctx, -26, -5, 52, 10, 5, '#8d5524', OUT, 1.6);
    ctx.restore();
  }
  for (let i = 0; i < 3; i++) {
    const f = Math.sin(t * 9 + i * 2) * 4;
    poly(ctx, [cx - 18 + i * 10, cy - 4, cx - 10 + i * 10 + f, cy - 40 - (i % 2) * 14, cx - 2 + i * 10, cy - 4], ['#ff922b', '#ffd43b', '#ff6b35'][i], OUT, 1.2);
  }
  for (let i = 0; i < 6; i++) {
    const ph = (t * 0.8 + i / 6) % 1;
    ell(ctx, cx + Math.sin(i * 2.4 + t) * 22, cy - 40 - ph * h * 0.35, 1.8, 1.8, `rgba(255,220,120,${(1 - ph).toFixed(2)})`);
  }
  // танцоры по кругу: хомячок впереди, островитяне вокруг
  const s = Math.min(w / 560, h / 320);
  const dancers = DANCE_LOOKS.map((id) => npcLook(id));
  const ring = [
    [cx - w * 0.3, h * 0.78, dancers[0]],
    [cx + w * 0.3, h * 0.78, dancers[1]],
    [cx - w * 0.17, h * 0.68, dancers[2]],
  ];
  for (const [x, y, lk] of ring) {
    const b = Math.abs(Math.sin(t * 6 + x)) * 8 * s;
    drawHamster(ctx, x, y - b, 0.9 * s, lk, { time: t, dir: Math.sin(t * 3 + x) > 0 ? 1 : -1, happy: true, armsUp: Math.sin(t * 6 + x) > 0 });
  }
  const hb = Math.abs(Math.sin(t * 6)) * 10 * s;
  drawHamster(ctx, cx + w * 0.16, h * 0.95 - hb, 1.1 * s, look, { time: t, dir: Math.sin(t * 3) > 0 ? 1 : -1, happy: true, armsUp: Math.sin(t * 6) > 0 });
  // ноты
  ctx.font = `${Math.round(22 * s)}px sans-serif`;
  ctx.textAlign = 'center';
  for (let i = 0; i < 3; i++) {
    const ph = (t * 0.5 + i / 3) % 1;
    ctx.globalAlpha = 1 - ph;
    ctx.fillText(['🎵', '🥁', '🎶'][i], w * (0.2 + i * 0.3), h * 0.55 - ph * h * 0.3);
  }
  ctx.globalAlpha = Math.min(1, k * 4);
}
let dancing = false;
/** Потанцевать на празднике огней: короткая сценка, потом наклейка и событие (шаг задания Вождя). */
export function dance() {
  if (dancing) return false;
  dancing = true;
  sfx('fanfare');
  const W = Math.min(560, window.innerWidth - 32),
    H = Math.round(W * 0.58);
  const f = el('div', 'fade cable-ride dance-fest', `<div class="msg"><div><div class="ride-pic"></div><p>🔥 Танцуем у костра!</p></div></div>`);
  const { canvas, ctx } = makeCanvas(W, H);
  canvas.style.borderRadius = '18px';
  f.querySelector('.ride-pic').appendChild(canvas);
  document.body.appendChild(f);
  const closeLayer = openLayer();
  let raf = 0;
  const t0 = performance.now(),
    look = playerLook(),
    DUR = 4200;
  const loop = (now) => {
    const t = (now - t0) / 1000,
      p = Math.min(1, (now - t0) / DUR);
    paintDance(ctx, W, H, p, look, t);
    ctx.globalAlpha = 1;
    if (p < 1) raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  requestAnimationFrame(() => f.classList.add('on'));
  for (let k = 0; k < 6; k++) setTimeout(() => sfx('thud'), 300 + k * 520);
  setTimeout(() => {
    cancelAnimationFrame(raf);
    f.classList.remove('on');
    setTimeout(() => {
      f.remove();
      closeLayer();
      dancing = false;
      emit('island', { what: 'dance' });
      if (award('x_fest', { delay: 400 })) toast('🔥 Вот это праздник! Островитяне хлопают: «Ты танцуешь, как настоящая островитянка!»', 'good');
      else toast('🔥 Танцы у костра — самое весёлое на острове! Приходи завтра вечером снова.', 'good');
    }, 380);
  }, DUR);
  return true;
}

// ---------- «Кокосовый боулинг» ----------
/** Сколько игр сегодня ещё с призом. */
export const bowlingLeft = () => Math.max(0, ISLAND.bowling.paid - (SI().bowls || 0));
/** Сыграть в кокосовый боулинг: за первые игры дня — монеты по звёздам. */
export async function bowlingGame() {
  const left = bowlingLeft(),
    c = ISLAND.bowling.coins,
    note = (html) => `<div class="pay-note${left ? '' : ' off'}">${html}</div>`;
  const res = await playMinigame('bowling', {
    introNote: left
      ? note(`🌴 <b>Приз Вождя:</b> ⭐ 🪙 ${c[0]} · ⭐⭐ 🪙 ${c[1]} · ⭐⭐⭐ 🪙 ${c[2]}. Сегодня ещё ${left} ${left === 1 ? 'игра' : 'игры'} с призом.`)
      : note('💛 Сегодня призы за боулинг уже получены. Играть можно для удовольствия — завтра призы снова!'),
    resultNote: (stars) => (left ? note(`<span class="sum">🪙 +${fmtMoney(c[stars - 1])}</span>`) : note('💛 Эта игра была для удовольствия.')),
  });
  if (!res) return res;
  award('x_bowling', { delay: 1200 });
  if (!left) return res;
  setDayFlag('bowls', (SI().bowls || 0) + 1, 'island');
  earn(c[res.stars - 1], 'work');
  sfx('coin');
  toast(`Вождь Кокос: «Страйк-кокос!» 🪙 +${fmtMoney(c[res.stars - 1])}`, 'good');
  return res;
}

// ---------- хижина для гостей: ночёвка на острове ----------
let nightOnIsland = false;
/** Переночевать в хижине для гостей: обычный сон (features/sleep.js), утро — тоже на острове, у хижины. */
function sleepHut() {
  nightOnIsland = true;
  if (!S().flags.hutHint) {
    setFlag('hutHint');
    toast('🛏️ В хижине для гостей постелена мягкая циновка. Можно переночевать — утро тоже будет на острове!');
  }
  run('sleep');
  setTimeout(() => (nightOnIsland = false), 6000); // передумала спать — не считаем ночёвку
  return true;
}
on('wake', () => {
  if (!S() || sceneName() !== 'island') return;
  const sc = getLocation('island');
  placeFlowers(sc); // новый день — новый цветок
  // хомячок просыпается у двери хижины для гостей
  const b = sc.map.bById.guest,
    d = sc.map.doorPx(b);
  sc.p.x = d.x;
  sc.p.y = d.y;
  sc.p.path = [];
  sc.p.pending = null;
  if (nightOnIsland && award('x_island_night', { delay: 2600 }))
    setTimeout(() => toast('🛖 Доброе утро на острове! Волны шумят, вулкан дымит, а Бум уже стучит в барабан.', 'good'), 1400);
  nightOnIsland = false;
});

const ACTS = {
  spot: spotIsland,
  volcano: volcanoLook,
  obsidian: takeObsidian,
  flower: flowerFound,
  fire: fireTap,
  dance,
  bowling: bowlingGame,
  sleep: sleepHut,
};

// ---------- подсказки ----------
on('scene', ({ name }) => {
  if (name !== 'island' || !S() || S().flags.islandHint) return;
  setFlag('islandHint');
  toast('🌋 Вот он — удалённый остров! Деревня островитян — прямо по тропинке на север. Вождь Кокос ждёт у костра!', 'good');
});

// ---------- кораблик: долгое плавание на юг и обратно ----------
/** Картинка долгого плавания: открытый океан, дельфины, вдали вулкан (k — 0..1 пути). */
export function paintFaraway(ctx, w, h, k, toIsland, look, t) {
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.55);
  sky.addColorStop(0, '#339af0');
  sky.addColorStop(1, '#d0ebff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  ell(ctx, w * 0.84, h * 0.16, 22, 22, '#ffe066');
  ell(ctx, w * 0.84, h * 0.16, 32, 32, 'rgba(255,224,102,.3)');
  for (const [x, y, sc] of [
    [0.2, 0.12, 1],
    [0.55, 0.2, 0.7],
  ]) {
    const cx = ((x + t * 0.012) % 1.2) * w;
    ell(ctx, cx, h * y, 30 * sc, 10 * sc, '#fff');
    ell(ctx, cx + 18 * sc, h * y - 6 * sc, 18 * sc, 10 * sc, '#fff');
  }
  // вдали: туда — вулкан растёт по мере пути, обратно — тает, а из-за горизонта встают башни города
  const near = toIsland ? k : 1 - k,
    vs = 0.35 + near * 0.9,
    vx = toIsland ? w * 0.72 : w * 0.24,
    hz = h * 0.55;
  poly(ctx, [vx - 70 * vs, hz, vx - 14 * vs, hz - 70 * vs, vx + 14 * vs, hz - 70 * vs, vx + 70 * vs, hz], '#8a7568', OUT, 2);
  poly(ctx, [vx - 14 * vs, hz - 70 * vs, vx - 8 * vs, hz - 62 * vs, vx + 8 * vs, hz - 64 * vs, vx + 14 * vs, hz - 70 * vs], '#ff6b35');
  for (let i = 0; i < 6; i++) ell(ctx, vx - 66 * vs + i * 26 * vs, hz - 4 * vs, 18 * vs, 9 * vs, i % 2 ? '#37b24d' : '#2b8a3e', OUT, 1.2);
  for (let i = 0; i < 3; i++) {
    const ph = (t * 0.3 + i / 3) % 1;
    ell(ctx, vx + ph * 30 * vs, hz - (78 + ph * 60) * vs, (6 + ph * 14) * vs, (5 + ph * 9) * vs, `rgba(240,240,245,${(0.75 * (1 - ph)).toFixed(2)})`);
  }
  if (!toIsland) {
    ctx.fillStyle = '#b6c6dd';
    for (const [x, bw, bh] of [
      [0.78, 0.03, 0.12],
      [0.82, 0.02, 0.08],
      [0.86, 0.035, 0.2],
      [0.91, 0.025, 0.1],
    ])
      ctx.fillRect(w * x, hz - h * bh * k, w * bw, h * bh * k);
  }
  // открытый океан с волнами
  const seaG = ctx.createLinearGradient(0, hz, 0, h);
  seaG.addColorStop(0, '#1c7ed6');
  seaG.addColorStop(1, '#0b4f9c');
  ctx.fillStyle = seaG;
  ctx.fillRect(0, hz, w, h - hz);
  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let r = 0; r < 5; r++) {
    const y = h * (0.6 + r * 0.085);
    for (let x = ((t * (36 + r * 14)) % 70) - 70; x < w; x += 70) {
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 12, y - 5, x + 24, y);
    }
  }
  ctx.stroke();
  // дельфины выпрыгивают по очереди
  for (let i = 0; i < 3; i++) {
    const ph = (t * 0.45 + i * 0.37) % 1;
    if (ph > 0.6) continue;
    const q = ph / 0.6,
      dx = w * (0.18 + i * 0.27) + q * 60,
      dy = h * (0.72 + (i % 2) * 0.08) - Math.sin(q * Math.PI) * h * 0.14;
    ctx.save();
    ctx.translate(dx, dy);
    ctx.rotate(-Math.cos(q * Math.PI) * 0.8);
    ell(ctx, 0, 0, 22, 8, '#748ba0', OUT, 1.8);
    ell(ctx, -2, 3, 14, 4, '#c5d3df');
    poly(ctx, [-4, -7, 4, -16, 6, -6], '#748ba0', OUT, 1.4);
    poly(ctx, [-20, 0, -30, -7, -28, 7], '#748ba0', OUT, 1.4);
    ell(ctx, 14, -2, 1.6, 1.6, OUT);
    ctx.restore();
    if (q > 0.85) ell(ctx, dx + 10, h * (0.72 + (i % 2) * 0.08), 16, 4, 'rgba(255,255,255,.7)');
  }
  // кораблик с хомячком
  const z = w / 560,
    dir = toIsland ? 1 : -1,
    bx = toIsland ? -60 * z + k * (w * 0.56 + 40 * z) : w * 0.62 - k * (w * 0.62 + 90 * z),
    by = h * 0.84 + Math.sin(t * 2) * 3 * z;
  ctx.save();
  ctx.translate(bx, by);
  ctx.scale(0.9 * z, 0.9 * z);
  drawBoat(ctx, 0, 0, dir, t, look, true);
  ctx.restore();
  // кокос плывёт мимо — на счастье
  ctx.save();
  ctx.translate(((1 - k) * 1.3 - 0.15) * w, h * 0.93 + Math.sin(t * 3) * 2);
  paintCoconut(ctx, 7 * z + 3);
  ctx.restore();
}
let sailing = false;
/** Долгое плавание: toIsland — от отметки «Далеко на юг» к причалу острова, иначе — обратно к пирсу города. */
export function rideFaraway(toIsland) {
  if (sailing) return false;
  const land = LAND_BY_ID.island;
  sailing = true;
  sfx('splash');
  const W = Math.min(560, window.innerWidth - 32),
    H = Math.round(W * 0.56);
  const f = el(
    'div',
    'fade cable-ride faraway-ride',
    `<div class="msg"><div><div class="ride-pic"></div><p>${toIsland ? '🧭 Плывём далеко на юг, к острову с вулканом!' : '⛵ Плывём домой, в город!'}</p></div></div>`,
  );
  const { canvas, ctx } = makeCanvas(W, H);
  canvas.style.borderRadius = '18px';
  f.querySelector('.ride-pic').appendChild(canvas);
  document.body.appendChild(f);
  const closeLayer = openLayer();
  let cover = null,
    raf = 0;
  const t0 = performance.now(),
    look = playerLook(),
    DUR = 5200;
  const loop = (now) => {
    const t = (now - t0) / 1000,
      p = Math.min(1, (now - t0) / DUR),
      e = p * p * (3 - 2 * p);
    paintFaraway(ctx, W, H, e, toIsland, look, t);
    if (p < 1) raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  requestAnimationFrame(() => f.classList.add('on'));
  setTimeout(() => {
    cover = openLayer({ pause: false, cover: true }); // экран уже тёмный — сцену под ним не рисуем
  }, 400);
  setTimeout(() => {
    sea.boatHome(); // кораблик ждёт у пирса города (на острове — свой, у причала)
    if (toIsland) go(land.scene, { at: land.entry });
    else go('world', { at: 'pier' });
  }, DUR - 300);
  setTimeout(() => {
    cancelAnimationFrame(raf);
    if (cover) cover();
    f.classList.remove('on');
    setTimeout(() => {
      f.remove();
      closeLayer();
      sailing = false;
      sfx('ding');
      if (toIsland) award('x_far_voyage', { delay: 600 });
    }, 380);
  }, DUR + 150);
  return true;
}
register('faraway', (p) => rideFaraway(p.arg !== 'back'), 'кораблик на удалённый остров: faraway:go (от отметки «Далеко на юг») | faraway:back');
export { AT as ISLAND_AT };
