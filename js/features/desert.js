// ПУСТЫНЯ (П.9): что делают в пустыне и по дороге туда. Сама локация (где что стоит, верблюд, мираж) —
// locations/desert.js; она называет действия реестра, а выполняются они здесь:
//   nomad             поговорить с кочевником Барханом (житель пустыни у шатра в оазисе): задание, «Раскопки»,
//                     катание на верблюде, коллекция окаменелостей, болтовня
//   desert:dig        мини-игра «Раскопки» (minigames/dig.js): за первые DESERT.dig.paid игр в день — монеты по
//                     звёздам и окаменелость (виды по кругу — FOSSIL_IDS); дальше — для удовольствия
//   desert:pairs      пирамида: загадка «Пары» (minigames/pairs.js) — приз раз в день, в первый раз наклейка
//   desert:camel      сесть на верблюда Финика: круг по верблюжьей тропе (locations/desert.js) — наклейка
//   desert:stars      Звёздный бархан: ночью — окно со звездопадом, загадать желание (наклейка); днём — подсказка
//   desert:oasis      попить воды из оазиса (и в жару сразу легче)
//   desert:well       старый колодец: эхо
//   desert:bell       нашли бубенчик Финика (задание «Бубенчик верблюда», data/quests.js)
//   caravan:go | back  караван-автобус: из города в пустыню (вход way:desert и выезд за шлагбаум — LANDS.desert.go)
//                     и обратно с остановки в пустыне; короткая картинка-переезд
// Ещё: мираж (событие desert { what: 'mirage' } из локации) — в первый раз наклейка; днём без шляпы — добрая
// подсказка про солнце (крюк hot локации, раз в день); окаменелости продаются на рынке (features/market.js, цены —
// DESERT.fossils). Числа — DESERT в data/economy.js. Каждое занятие шлёт событие desert { what } — по нему считают
// задания. Состояние меняют только действия (core/actions.js); «раз в день» — отметки дня (dayFlags.desert).
// Разговор, коллекция, «нашлось», действие места, подсказка входа, караван — набор тайных мест (features/land_kit.js).
import { setDayFlag, addItem, award } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { makeCanvas } from '../core/draw.js';
import { on, emit } from '../core/events.js';
import { go, scene, sceneName } from '../core/loop.js';
import { G, darkness, playerLook } from '../core/state.js';
import { el, esc, fmtMoney } from '../core/util.js';
import { FIND_BY_ID, FOSSIL_IDS, DESERT, LAND_BY_ID, CLOTHES_BY_ID, isSunHat } from '../data/index.js';
import { getLocation } from '../engine/topdown/index.js';
import { startCamelRide, CAMEL_GOALS, inShade } from '../locations/desert.js';
import { smooth } from '../ui/fade.js';
import { openPanel } from '../ui/panel.js';
import { toast, hintToday } from '../ui/toast.js';
import { prizeGame, prizeLeft } from './minigames.js';
import { paintStarSky } from './pictures_art.js';
import { paintCaravan } from './trips_art.js';
import { dayFlags, npcLine, landNpc, craftSet, sellTalk, landFind, landActs, landHint, landRide } from './land_kit.js';

const S = () => G.state;
const SD = dayFlags('desert');

// ---------- кочевник Бархан ----------
/** Что сказать под настроение: ночью — про звёзды, вечером — про закат, днём — про сезон. */
export const barkhanLine = npcLine('barkhan');
/** Разговор с кочевником: сначала задание из журнала, потом — раскопки, верблюд, коллекция и болтовня. */
const barkhan = landNpc({
  id: 'barkhan',
  act: 'nomad',
  desc: 'кочевник Бархан: разговор (житель пустыни у шатра в оазисе)',
  met: 'metBarkhan',
  hello: (name) =>
    `Добро пожаловать в пески, ${name}! Я кочевник Бархан, а это мой верблюд Финик. Буся писала, что приедет звезда подиума! Здесь есть оазис, пирамида с загадкой, раскопки древних окаменелостей, а ночью — звездопад. Только днём надевай шляпу: солнце у нас горячее!`,
  greet: (name) => [
    `Привет, ${name}!`,
    'О, гостья из города! Садись, выпей чаю с финиками.',
    'Здравствуй-здравствуй! Финик тебе рад — слышишь, фыркает?',
  ],
  line: barkhanLine,
  top: [
    { text: '🦴 Раскопки', cls: 'yellow', fn: async () => (await digGame(), null) },
    { text: '🐫 Покататься на Финике', cls: 'yellow', fn: async () => (rideCamel(), null) },
  ],
  more: [
    // коллекция окаменелостей — по одной каждого вида
    craftSet({
      ids: FOSSIL_IDS,
      title: '🦴 Коллекция окаменелостей',
      lack: (have) =>
        `Для коллекции нужна одна окаменелость каждого вида: ${have}. Копай на раскопе — каждый раз попадается что-то новое!`,
      give: ['storage', 'fossil_box'],
      sticker: 'x_fossils',
      event: ['desert', 'fossils'],
      done: 'Готово: аммонит, отпечаток листа, зуб ящера и косточка динозавра — в витрине под стеклом! Настоящий музей 🦴 Коллекция уже в кладовке: дома нажми 🔨.',
    }),
    // куда деть окаменелости
    sellTalk({
      ids: FOSSIL_IDS,
      ask: 'окаменелости',
      say: () =>
        `Конечно! Торговец Грошик на рынке в городе берёт окаменелости: аммонит — ${DESERT.fossils.fossil_shell}, отпечаток листа — ${DESERT.fossils.fossil_leaf}, зуб — ${DESERT.fossils.fossil_tooth}, косточка — ${DESERT.fossils.fossil_bone} монет. А можно собрать по одной каждого вида — я сделаю витрину-коллекцию!`,
    }),
  ],
});
export const talkBarkhan = barkhan.talk;

// ---------- «Раскопки» ----------
/** Покопать: за первые игры дня — монеты по звёздам и окаменелость (виды — по кругу, от номера дня: за два дня — все). */
export function digGame() {
  const c = DESERT.dig.coins,
    left = prizeLeft('desert', 'digs', DESERT.dig.paid),
    fossil = left
      ? FOSSIL_IDS[(S().day * 2 + (SD().digs || 0)) % FOSSIL_IDS.length]
      : FOSSIL_IDS[(S().day + 1) % FOSSIL_IDS.length],
    f = FIND_BY_ID[fossil];
  return prizeGame('dig', {
    group: 'desert',
    flag: 'digs',
    ...DESERT.dig,
    info: { fossil },
    label: '🦴 <b>Приз Бархана:</b>',
    more: ' — и находка остаётся у тебя!',
    words: ['раскопка', 'раскопки'],
    done: '💛 Сегодня раскоп уже поделился находками. Покопать можно для удовольствия — завтра находки снова!',
    sum: (stars) => `🪙 +${fmtMoney(c[stars - 1])} и ${f.e} ${f.name}`,
    fun: '💛 Эта раскопка была для удовольствия.',
    reward: () => addItem('finds', fossil, 1),
    thanks: (stars) => `Бархан: «Вот это находка!» 🪙 +${fmtMoney(c[stars - 1])} и ${f.e} ${f.name}`,
  });
}

// ---------- загадка пирамиды «Пары» ----------
/** Решить загадку пирамиды: приз — раз в день (по звёздам), в первый раз — наклейка. */
export function pairsGame() {
  sfx('door');
  return prizeGame('pairs', {
    group: 'desert',
    flag: 'pairs',
    paid: 1,
    coins: DESERT.pairs.coins,
    label: '🔺 <b>Сокровище пирамиды:</b>',
    tail: ' — раз в день.',
    done: '💛 Сегодня пирамида уже открыла тебе сокровище. Решить загадку можно для удовольствия — завтра снова!',
    sum: (stars) => `🪙 Сокровище: +${fmtMoney(DESERT.pairs.coins[stars - 1])}`,
    fun: '💛 Эта загадка была для удовольствия.',
    sticker: 'x_pyramid',
    thanks: '🔺 Тайна пирамиды разгадана!',
  });
}

// ---------- верблюд Финик ----------
/**
 * Покататься на верблюде (из разговора с Барханом или у привязи): сначала — куда ехать (Д10): по кругу по верблюжьей
 * тропе или к одному из мест пустыни (Финик довезёт быстрее, чем пешком, и сам вернётся к шатру). p.to — сразу
 * поехать: 'ring' — по кругу, иначе id места из CAMEL_GOALS (для тестов и кнопок).
 */
export async function rideCamel(ctx, p = {}) {
  const sc = (ctx && ctx.scene) || (sceneName() === 'desert' ? getLocation('desert') : null);
  if (!sc) return false;
  let to = p.to;
  if (!to) {
    const opts = [
      { text: '🔄 По кругу, по верблюжьей тропе', cls: 'yellow', to: 'ring' },
      ...CAMEL_GOALS.map((g) => ({
        text: `${g.icon} ${g.name[0].toUpperCase()}${g.name.slice(1)}`,
        cls: 'blue',
        to: g.id,
      })),
      { text: 'Не сейчас' },
    ];
    const i = await barkhan.say('Куда поедем? Финик знает в пустыне все тропинки — скажи, куда, и он довезёт!', opts);
    to = (opts[i] || {}).to;
    if (!to) return false;
  }
  if (!startCamelRide(sc, to === 'ring' ? null : to)) return false;
  sfx('pop');
  const g = CAMEL_GOALS.find((q) => q.id === to);
  toast(
    g
      ? `🐫 Держись крепче! Финик везёт тебя ${g.name} — цок-цок по песку…`
      : '🐫 Держись крепче! Финик идёт по кругу — цок-цок по песку…',
    'good',
  );
  return true;
}
on('desert', ({ what, to }) => {
  if (!S()) return;
  if (what === 'ride' && to) {
    // приехали «куда сказала» (Д10)
    const g = CAMEL_GOALS.find((q) => q.id === to);
    sfx('win');
    award('x_camel', { delay: 900 });
    toast(`🐫 Приехали${g ? ' ' + g.name : ''}! Финик фыркнул «до встречи» и сам пошёл домой, к шатру.`, 'good');
  } else if (what === 'ride') {
    sfx('win');
    if (award('x_camel', { delay: 900 })) toast('🐫 Вот это прогулка! Финик доволен и фыркает от радости.', 'good');
    else toast('🐫 Финик довёз тебя обратно к шатру. Прокатимся ещё?', 'good');
  } else if (what === 'mirage') {
    // мираж — один раз за день (Д8): отошла и вернулась — он снова виден вдали, но «Это мираж!» уже не повторяется
    if (SD().mirage) return;
    setDayFlag('mirage', 1, 'desert');
    sfx('magic');
    toast('🏝️ Ой! Озеро с пальмами… исчезло! Это был мираж: в жару воздух дрожит и «рисует» воду вдали.', 'good');
    award('x_mirage', { delay: 1800 });
  }
});

// ---------- Звёздный бархан: звездопад и желание ----------
const WISHES = [
  '🐹 Чтобы все друзья были счастливы',
  '🏰 Свой замок до самых облаков',
  '🌈 Чтобы завтра светило солнышко',
  '🦄 Встретить настоящего единорога',
];
/** Загадать желание на Звёздном бархане: ночью — окно со звездопадом; днём — когда приходить. */
export function makeWish() {
  if (darkness() < 0.5) {
    toast('🌠 Днём звёзд не видно. Приходи на Звёздный бархан ночью — когда стемнеет, здесь падают звёзды!');
    return false;
  }
  sfx('magic');
  let wished = null,
    raf = 0;
  const look = playerLook();
  return openPanel({
    title: 'Звездопад',
    icon: '🌠',
    cls: 'wide',
    render(body, tab, api) {
      cancelAnimationFrame(raf);
      const W = Math.min(520, window.innerWidth - 60),
        H = Math.round(W * 0.5);
      const { canvas, ctx } = makeCanvas(W, H);
      canvas.style.cssText += ';display:block;margin:0 auto;border-radius:14px;max-width:100%;height:auto';
      body.appendChild(canvas);
      const t0 = performance.now();
      const loop = (now) => {
        if (api.closed) return;
        paintStarSky(ctx, W, H, (now - t0) / 1000, look);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      if (wished) {
        body.appendChild(
          el(
            'p',
            'center',
            `Желание загадано: «${esc(wished.replace(/^\S+\s/, ''))}». Тс-с — никому не говори, и оно обязательно сбудется! ✨`,
          ),
        );
        return;
      }
      body.appendChild(el('p', 'center', 'Смотри — падают звёзды! Скорее загадай желание:'));
      const box = el('div', 'wish-list');
      box.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:6px';
      for (const w of WISHES) {
        const b = el('button', 'btn blue wish', esc(w));
        b.onclick = () => {
          wished = w;
          sfx('win');
          award('x_wish', { delay: 900 });
          emit('desert', { what: 'wish' });
          api.refresh();
        };
        box.appendChild(b);
      }
      body.appendChild(box);
    },
    onClose: () => cancelAnimationFrame(raf),
    foot: [{ text: 'Спокойной ночи, звёзды! 🌙', cls: 'green', fn: (api) => api.close() }],
  });
}

// ---------- оазис, колодец, бубенчик ----------
let heatMin = 0,
  heatDay = -1;
export function drinkOasis() {
  sfx('splash');
  heatMin = 0;
  emit('desert', { what: 'oasis' });
  toast('🌴 Прохладная вода оазиса! Ты умылась и попила — сразу легче. Вокруг шелестят пальмы.', 'good');
  return true;
}
export function lookWell() {
  sfx('bubble');
  toast(
    '🪣 Старый колодец. Крикни в него: «Ау-у!» — и колодец ответит эхом: «у-у-у…» Воды в нём давно нет — вся вода в оазисе.',
  );
  return true;
}
/** Нашли бубенчик Финика (место bell видно, пока задание на первом шаге). */
export const findBell = landFind('desert', 'bell', {
  title: 'Бубенчик нашёлся!',
  icon: '🔔',
  pic: '🔔✨',
  text: 'Дзынь-дзынь! Вот он — золотой, на красной ленточке, у самого колодца. Теперь отнеси его Финику и прокатись на нём — пусть звенит!',
});

landActs(
  'desert',
  {
    dig: digGame,
    pairs: pairsGame,
    camel: rideCamel,
    stars: makeWish,
    oasis: drinkOasis,
    well: lookWell,
    bell: findBell,
  },
  'пустыня: desert:dig | pairs | camel | stars | oasis | well | bell',
);

// ---------- жара: днём без шляпы — добрая подсказка (раз в день) ----------
on('step', ({ dt }) => {
  const s = S();
  if (!s || sceneName() !== 'desert') return;
  if (s.day !== heatDay) {
    heatDay = s.day;
    heatMin = 0;
  }
  const sc = scene();
  if (!sc.hot || !sc.hot()) return;
  // в тени пальм и в траве у оазиса прохладно (Д7): жара не копится, а первый раз за день — подсказка
  if (inShade(sc)) {
    heatMin = Math.max(0, heatMin - dt / 0.3);
    hintToday('shade', '🌴 В тени пальм прохладно — хорошо! Здесь можно передохнуть от солнышка.', 'good', 'desert');
    return;
  }
  if (SD().heat) return;
  const head = playerLook().outfit.head;
  if (isSunHat(typeof head === 'string' ? CLOTHES_BY_ID[head] : head)) return;
  heatMin += dt / 0.6;
  if (heatMin < DESERT.heat) return;
  setDayFlag('heat', 1, 'desert');
  toast(
    '☀️ Ух, как печёт солнышко! Надень шляпу от солнца или панамку — в пустыне без неё жарко. И попей водички в оазисе 🌴',
  );
});
landHint(
  'desert',
  'desertHint',
  '🐫 Вот она — пустыня! Барханы, пальмы и жаркое солнце. Кочевник Бархан — у шатра в оазисе, прямо по тропе на север.',
);

// ---------- караван-автобус ----------
/** Проехать на караван-автобусе: toDesert — из города в пустыню, иначе — обратно в город. */
export const rideCaravan = landRide({
  act: 'caravan',
  desc: 'караван-автобус: caravan:go (из города в пустыню) | caravan:back',
  sound: 'door',
  cls: 'caravan-ride',
  text: ['🚌 Едем в пустыню!', '🚌 Едем домой, в город!'],
  ms: 2400,
  paint: (toDesert) => (ctx, w, h, p, look, t) => paintCaravan(ctx, w, h, smooth(p), toDesert, look, t),
  to: (toDesert) => {
    const land = LAND_BY_ID.desert;
    if (toDesert) go(land.scene, { at: land.entry });
    else go(land.from, { at: 'bus' });
  },
});
