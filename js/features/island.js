// УДАЛЁННЫЙ ОСТРОВ (П.9): что делают на острове и по дороге туда. Сам остров (где что стоит, вулкан, праздник огней,
// цветы) — locations/island.js; он называет действия реестра, а выполняются они здесь:
//   liftman            поговорить с Лифтёром Этажкиным в холле Хомяк-Тауэра (задание «Остров на горизонте» и болтовня)
//   island:spot        нашли далёкий остров в подзорную трубу «море» (interiors/tower.js; шаг задания Этажкина)
//   chief              поговорить с Вождём Кокосом: задание «Праздник огней», лея из цветов, маленький тотем, болтовня
//   islander:<id>      поболтать с островитянами (Барабанщик Бум, Островитянка Лагуна)
//   island:volcano     посмотреть на вулкан (в первый раз — наклейка)
//   island:obsidian    взять кусочек вулканического стекла у подножия (раз в день)
//   island:flower      подобрали цветок для леи (находка pickups; в первый раз — подсказка)
//   island:fire        костёр: вечером на празднике огней — «Танец у костра» (minigames/drum.js, О8); днём — когда праздник
//   island:bowling     мини-игра «Кокосовый боулинг» (minigames/bowling.js): за первые ISLAND.bowling.paid игр в день —
//                      монеты по звёздам
//   island:sleep       хижина для гостей: переночевать на острове (сон — features/sleep.js; утро — тоже на острове)
//   island:home:<id>   домики островитян: хозяин гуляет — подсказка, где его найти (с этапа 13 двери ведут внутрь —
//                      interiors/island_huts.js, там записка; действие осталось для старых ссылок)
//   faraway:go | back  кораблик: из моря города (отметка «Далеко на юг» — LANDS.island.go) к причалу острова и обратно
//                      к пирсу города; картинка-переезд подольше — открытый океан, дельфины, вдали вулкан
// Находки продаются на рынке (features/market.js, цены — ISLAND). Числа — ISLAND в data/economy.js. Каждое занятие
// шлёт событие island { what } — по нему считают задания. Состояние меняют только действия (core/actions.js);
// «раз в день» — отметки дня (dayFlags.island).
// Разговоры, лея и тотем, действие места, подсказка входа, плавание — набор тайных мест (features/land_kit.js).
import { setDayFlag, addItem, award } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { on, emit } from '../core/events.js';
import { go, sceneName } from '../core/loop.js';
import { register, run } from '../core/registry.js';
import { G, darkness, hasClothes } from '../core/state.js';
import { pick } from '../core/util.js';
import { NPC_BY_ID, FIND_BY_ID, LEI_IDS, ISLAND, LAND_BY_ID, npcLook } from '../data/index.js';
import { getLocation } from '../engine/topdown/index.js';
import { festNow, placeFlowers, AT } from '../locations/island.js';
import { sea } from '../locations/town.js';
import { smooth } from '../ui/fade.js';
import { toast, hintOnce } from '../ui/toast.js';
import { playMinigame, prizeGame } from './minigames.js';
import { questTalk } from './quests.js';
import { paintFaraway } from './trips_art.js';
import {
  dayFlags,
  npcLine,
  sayAs,
  landNpc,
  craftSet,
  craftCount,
  sellTalk,
  landFind,
  landActs,
  landHint,
  landRide,
} from './land_kit.js';

const S = () => G.state;
const SI = dayFlags('island');
/** Реплика по времени суток: ночью, вечером или днём (у жителей острова — lines.day / evening / night). */
const timeLine = (id) => npcLine(id, { day: (L) => L.day })();

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
    const i = await sayAs('etazhkin', text, [
      { text: '💬 Поболтать', cls: 'blue' },
      { text: 'Спасибо!', cls: 'green' },
    ]);
    if (i !== 0) return;
    text = landIsOpen()
      ? pick(['Ну как там остров? Расскажешь мне потом про вулкан?', ...NPC_BY_ID.etazhkin.lines.day])
      : timeLine('etazhkin');
  }
}
const landIsOpen = () => Number.isFinite(S().lands.island);
register(
  'liftman',
  () => talkLiftman(),
  'лифтёр Этажкин в холле Хомяк-Тауэра: задание «Остров на горизонте» и болтовня',
);

/** Нашли остров в подзорную трубу (шаг задания «Остров на горизонте»). */
export const spotIsland = landFind('island', 'spot', {
  title: 'Остров на горизонте!',
  icon: '🌋',
  pic: '🔭🌋',
  text: 'Вот он! Далеко-далеко на юге, у самой линии горизонта, — остров, а над ним поднимается дымок. Настоящий вулкан! Без компаса туда не доплыть… Компас есть у <b>Капитана Боба</b> на пирсе!',
  btn: 'Ух ты!',
  sound: 'magic',
});

// ---------- Вождь Кокос ----------
const flowers = { ids: LEI_IDS, sep: ' · ' };
/** Разговор с Вождём: сначала задание из журнала, потом — лея, тотем и болтовня. */
export const { talk: talkChief } = landNpc({
  id: 'kokos',
  act: 'chief',
  desc: 'Вождь Кокос: разговор (житель удалённого острова у костра)',
  met: 'metKokos',
  hello: (name) =>
    `Алоха, ${name}! Добро пожаловать на наш остров! Я — Вождь Кокос. Видишь вулкан? Он у нас добрый, только иногда ворчит. Каждый вечер у костра — праздник огней, а на востоке, у тотемов, играют в кокосовый боулинг!`,
  greet: (name) => [
    `Алоха, ${name}!`,
    'О, гостья из далёкого города! Как тебе наш остров?',
    'Алоха! Вулкан сегодня в хорошем настроении — видишь, какой ровный дымок?',
  ],
  line: () => timeLine('kokos'),
  top: [{ text: '🥥 Сыграть в кокосовый боулинг', cls: 'yellow', fn: async () => (await bowlingGame(), null) }],
  more: [
    // лея из трёх разных цветов (одна на всю игру — это вещь в шкафу)
    craftSet({
      ...flowers,
      need: ISLAND.lei,
      title: '🌺 Сплети лею',
      when: () => !hasClothes('lei_island'),
      lack: (have) =>
        `Для леи нужны три разных цветка: ${have}. Каждое утро на острове распускается новый — ищи у цветущих кустов!`,
      give: ['clothes', 'lei_island'],
      sticker: 'x_lei',
      event: ['island', 'lei'],
      done: 'Плюмерия, гибискус и орхидея — вот и лея! Носи её на шее — и ты настоящая островитянка 🌺 Она уже в шкафу.',
    }),
    // венок и гирлянда (этап 12, О11): когда лея уже есть, цветы годятся не только для рынка
    craftSet({
      ...flowers,
      need: ISLAND.wreath,
      title: '🌸 Сплети венок',
      when: () => hasClothes('lei_island') && !hasClothes('wreath_lei'),
      lack: (have) => `Для венка тоже нужны три разных цветка: ${have}. Каждое утро на острове распускается новый!`,
      give: ['clothes', 'wreath_lei'],
      sticker: 'x_wreath_isle',
      event: ['island', 'wreath'],
      done: 'Раз цветок, два цветок… Готово! Венок из цветов острова — к твоей лее в самый раз 🌸 Он уже в шкафу.',
    }),
    craftSet({
      ...flowers,
      need: ISLAND.garland,
      title: '🌼 Сплети гирлянду для дома',
      when: () => hasClothes('lei_island'),
      lack: (have) => `Для гирлянды нужны три разных цветка: ${have}. Приходи, когда соберёшь все!`,
      give: ['storage', 'flower_garland'],
      sticker: 'x_garland',
      event: ['island', 'garland'],
      done: 'Вот и гирлянда из цветов! Повесь её дома на стену — и будет пахнуть нашим островом 🌺 Она уже в кладовке: дома нажми «Обустроить».',
    }),
    // маленький тотем из трёх кусочков вулканического стекла (можно много — это украшение для дома)
    craftCount({
      id: 'obsidian',
      need: ISLAND.totem,
      cap: true,
      title: '🗿 Вырежи маленький тотем',
      lack: (n) =>
        `Для тотема нужно три кусочка вулканического стекла — у тебя ${n}. Каждый день у подножия вулкана лежит новый кусочек!`,
      give: ['storage', 'mini_totem'],
      sticker: 'x_totem',
      event: ['island', 'totem'],
      done: 'Тук-тук-тук… Готово! Маленький тотем из вулканического стекла — он охраняет хорошее настроение 🗿 Тотем уже в кладовке: дома нажми 🔨.',
    }),
    // куда деть находки
    sellTalk({
      ids: ['obsidian', ...LEI_IDS],
      ask: 'находки',
      say: () =>
        `Конечно! Торговец Грошик на рынке в городе берёт вулканическое стекло — ${ISLAND.obsidian} монет за кусочек, а цветы — по ${Math.min(...Object.values(ISLAND.flowers))}–${Math.max(...Object.values(ISLAND.flowers))}. А из трёх разных цветов я сплету лею, из трёх кусочков стекла — вырежу тотем!`,
    }),
  ],
});

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
      text = pick([
        'Бум-бум-тук-тук! Отлично получается! Ты почти как я!',
        'Тук-тук-БУМ! Слышишь, как вулкан подпевает?',
        'Вот это ритм! Приходи вечером на праздник — постучим вместе!',
      ]);
    } else if (o.chat) text = timeLine(id);
    else return;
  }
}
register('islander', (p) => talkIslander(p.arg), 'островитяне удалённого острова: islander:<bum | laguna> — поболтать');

// ---------- занятия острова ----------
function homeTap(id) {
  sfx('tap');
  const n = NPC_BY_ID[id];
  if (!n) return;
  toast(
    id === 'bum'
      ? `🛖 Это домик ${n.name.split(' ')[1]}а. Дома никого — Бум стучит на барабане у костра! 🥁`
      : `🛖 Это домик ${n.name.split(' ')[1]}ы. Она гуляет у пляжа — плетёт гирлянды из цветов 🌺`,
  );
}
/** Посмотреть на вулкан. */
function volcanoLook() {
  sfx('magic');
  if (award('x_volcano', { delay: 900 }))
    toast('🌋 Ух, какой большой! Из кратера поднимается дымок — вулкан дышит. Вождь Кокос говорит, он добрый.', 'good');
  else
    toast(
      darkness() > 0.5
        ? '🌋 Ночью в кратере светится лава — как огромный ночник!'
        : '🌋 Вулкан тихонько дымит. У подножия блестит чёрное стекло.',
    );
  emit('island', { what: 'volcano' });
  return true;
}
/** Взять кусочек вулканического стекла (раз в день). */
function takeObsidian() {
  if (SI().obsidian) {
    toast(FIND_BY_ID.obsidian.e + ' Сегодня кусочек стекла ты уже взяла. Завтра вулкан приготовит новый!');
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
  hintOnce(
    'leiHint',
    '🌺 Каждое утро на острове распускается новый цветок. Из трёх разных Вождь Кокос сплетёт лею!',
    'good',
    900,
  );
  return true;
}
/** Костёр: на празднике — потанцевать; днём — когда праздник. */
function fireTap() {
  if (festNow()) return void dance();
  sfx('tap');
  const m = S().minutes;
  toast(
    m >= ISLAND.fest.to * 60 || m < 5 * 60
      ? '🔥 Праздник огней уже закончился — все пошли спать. Приходи завтра вечером!'
      : `🔥 Праздник огней — каждый вечер у костра, с ${ISLAND.fest.from}:00 до ${ISLAND.fest.to}:00. Приходи танцевать!`,
  );
}

// ---------- праздник огней: «Танец у костра» — ритм-игра под барабан Бума (О8) ----------
let dancing = false;
/**
 * Потанцевать на празднике огней: мини-игра «Танец у костра» (minigames/drum.js) — Бум стучит, кокосы-«шаги» летят
 * к кругу. Сыграла до конца — событие (шаг задания Вождя) и наклейка праздника, ⭐⭐⭐ — ещё наклейка «В ритме барабана».
 */
export function dance() {
  if (dancing) return false;
  dancing = true;
  sfx('fanfare');
  playMinigame('drum', {
    drummer: npcLook('bum'),
    dancers: ['laguna', 'kokos'].map((id) => npcLook(id)),
    introNote: '<div class="pay-note">🔥 Праздник огней! Бум уже стучит — островитяне ждут тебя в круг.</div>',
  })
    .then((res) => {
      dancing = false;
      if (!res) return;
      emit('island', { what: 'dance' });
      if (res.stars === 3) award('x_drum', { delay: 2600 });
      if (award('x_fest', { delay: 400 }))
        toast('🔥 Вот это праздник! Островитяне хлопают: «Ты танцуешь, как настоящая островитянка!»', 'good');
      else toast('🔥 Танцы у костра — самое весёлое на острове! Приходи завтра вечером снова.', 'good');
    })
    .catch(() => (dancing = false));
  return true;
}

// ---------- «Кокосовый боулинг» ----------
/** Сыграть в кокосовый боулинг: за первые игры дня — монеты по звёздам. */
export const bowlingGame = () =>
  prizeGame('bowling', {
    group: 'island',
    flag: 'bowls',
    ...ISLAND.bowling,
    label: '🌴 <b>Приз Вождя:</b>',
    done: '💛 Сегодня призы за боулинг уже получены. Играть можно для удовольствия — завтра призы снова!',
    fun: '💛 Эта игра была для удовольствия.',
    sticker: 'x_bowling',
    thanks: 'Вождь Кокос: «Страйк-кокос!»',
  });

// ---------- хижина для гостей: ночёвка на острове ----------
let nightOnIsland = false;
/** Переночевать в хижине для гостей: обычный сон (features/sleep.js), утро — тоже на острове, у хижины. */
function sleepHut() {
  nightOnIsland = true;
  hintOnce(
    'hutHint',
    '🛏️ В хижине для гостей постелена мягкая циновка. Вечером, после 19:00, можно переночевать — утро тоже будет на острове!',
  );
  // передумала спать («Ещё погуляю») — ночёвку не считаем; уснула — флаг снимет утро (wake)
  Promise.resolve(run('sleep')).then((slept) => {
    if (!slept) nightOnIsland = false;
  });
  return true;
}
on('wake', () => {
  // спят теперь внутри хижины для гостей (interiors/island_huts.js, этап 13) — утро там же, у циновки
  const inHut = sceneName() === 'hut_guest';
  if (!S() || (sceneName() !== 'island' && !inHut)) return;
  const sc = getLocation('island');
  placeFlowers(sc); // новый день — новый цветок
  if (!inHut) {
    // проснулась на острове (старая ночёвка снаружи) — у двери хижины для гостей
    const b = sc.map.bById.guest,
      d = sc.map.doorPx(b);
    sc.p.x = d.x;
    sc.p.y = d.y;
    sc.p.path = [];
    sc.p.pending = null;
  }
  if (nightOnIsland && award('x_island_night', { delay: 2600 }))
    setTimeout(
      () => toast('🛖 Доброе утро на острове! Волны шумят, вулкан дымит, а Бум уже стучит в барабан.', 'good'),
      1400,
    );
  nightOnIsland = false;
});

landActs(
  'island',
  {
    spot: spotIsland,
    volcano: volcanoLook,
    obsidian: takeObsidian,
    flower: flowerFound,
    fire: fireTap,
    dance,
    bowling: bowlingGame,
    sleep: sleepHut,
    home: (ctx, p, id) => homeTap(id),
  },
  'удалённый остров: island:spot | volcano | obsidian | flower | fire | dance | bowling | sleep | home:<id>',
);

// ---------- подсказки ----------
landHint(
  'island',
  'islandHint',
  '🌋 Вот он — удалённый остров! Деревня островитян — прямо по тропинке на север. Вождь Кокос ждёт у костра!',
);

// ---------- кораблик: долгое плавание на юг и обратно ----------
/** Долгое плавание: toIsland — от отметки «Далеко на юг» к причалу острова, иначе — обратно к пирсу города. */
export const rideFaraway = landRide({
  act: 'faraway',
  desc: 'кораблик на удалённый остров: faraway:go (от отметки «Далеко на юг») | faraway:back',
  sound: 'splash',
  cls: 'faraway-ride',
  text: ['🧭 Плывём далеко на юг, к острову с вулканом!', '⛵ Плывём домой, в город!'],
  ms: 5200,
  paint: (toIsland) => (ctx, w, h, p, look, t) => paintFaraway(ctx, w, h, smooth(p), toIsland, look, t),
  to: (toIsland) => {
    const land = LAND_BY_ID.island;
    sea.boatHome(); // кораблик ждёт у пирса города (на острове — свой, у причала)
    if (toIsland) go(land.scene, { at: land.entry });
    else go('world', { at: 'pier' });
  },
  done: (toIsland) => toIsland && award('x_far_voyage', { delay: 600 }),
});
export { AT as ISLAND_AT };
