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
import { emit } from '../core/events.js';
import { G, friendHearts } from '../core/state.js';
import { pick } from '../core/util.js';
import { HOLIDAY, holidayOffset, HOLIDAY_BY_ID, BLINI, DISH_BY_ID, NPCS, npcLook, LANTERNS } from '../data/index.js';
import { teamHelp } from '../minigames/tug.js';
import { message } from '../ui/panel.js';
import { toast } from '../ui/toast.js';
import { addPts } from './friends.js';
import { openCooking } from './cooking.js';
import { playMinigame } from './minigames.js';
import { holidayActs, holidayTalk, holidayStep, stepDoneFor, stepWanted } from './holidays.js';
import { tapScene, playScene, doorRound, holidayPrize, holidaySay as say } from './holidays_scenes.js';
import { paintRink, paintCarol, paintLanterns, paintCarousel } from './holidays_scenes_art.js';

const S = () => G.state;
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
  return holidayPrize('tug', {
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
