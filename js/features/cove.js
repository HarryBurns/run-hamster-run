// СЕКРЕТНЫЙ ПЛЯЖ (П.9): что делают на секретном пляже и по дороге туда. Сама бухта (где что стоит, черепашата,
// светящаяся вода, клад) — locations/cove.js; она называет действия реестра, а выполняются они здесь:
//   mermaid           поговорить с русалочкой Жемчужинкой (жительница бухты на камне в воде): задание, «Замок из песка»,
//                     «Ракушки в рамке», куда деть ракушки, болтовня по времени суток
//   cove:castle       мини-игра «Замок из песка» (minigames/sandcastle.js): за первые COVE.castle.paid игр в день —
//                     монеты по звёздам; дальше — для удовольствия; в первый раз — наклейка
//   cove:nest         гнездо черепашат: вечером они вылупляются и ползут за хомячком к морю (локация); доплыли —
//                     событие cove { what: 'turtles' } → наклейка (раз в день)
//   cove:dig          клад под крестиком с карты Зефирки: раз за игру — монеты и «Сундучок с сокровищами»
//   cove:shell        подобрали ракушку (находка у кромки воды; локация кладёт их каждый день по жребию)
//   cove:piece:<id>   кусочек карты Зефирки (задание «Карта сокровищ Зефирки», data/quests.js): tower — у чайки в подзорной
//                     трубе на башне (interiors/tower.js), ship — в сундучке у затонувшего корабля (interiors/dive.js),
//                     isle — в бутылке под пальмой на Звёздном острове (locations/town.js); показывает карту
//   grotto:go | back  заплыв через подводный грот: из моря города (у буйка-ракушки — LANDS.cove.go) на пляж и обратно;
//                     короткая картинка-переезд
// Ещё: ночью вошла в воду — вода светится (наклейка), первый вход — подсказка; ракушки продаются на рынке
// (features/market.js, цены — COVE.shells.sell). Числа — COVE в data/economy.js. Каждое занятие шлёт событие cove { what } —
// по нему считают задания. Состояние меняют только действия (core/actions.js); «раз в день» — отметки дня (dayFlags.cove).
// Разговор, рамка, действие места, подсказка входа и заплыв — общий набор тайных мест (features/land_kit.js).
import { setFlag, setDayFlag, addItem, award, earn } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { makeCanvas } from '../core/draw.js';
import { on, emit } from '../core/events.js';
import { go } from '../core/loop.js';
import { G, questNow, canSwim } from '../core/state.js';
import { fmtMoney } from '../core/util.js';
import { FIND_BY_ID, SHELL_IDS, COVE, LAND_BY_ID, SICK_TEXT, PIECES } from '../data/index.js';
import { startHatch, turtlesOut, hatchTime, turtlesToday, treasureDug } from '../locations/cove.js';
import { sea } from '../locations/town.js';
import { smooth } from '../ui/fade.js';
import { message } from '../ui/panel.js';
import { toast, hintOnce } from '../ui/toast.js';
import { prizeGame } from './minigames.js';
import { paintTreasureMap } from './pictures_art.js';
import { paintGrotto } from './trips_art.js';
import { dayFlags, npcLine, landNpc, craftSet, sellTalk, landActs, landHint, landRide } from './land_kit.js';

const S = () => G.state;
const SC = dayFlags('cove');

// ---------- русалочка Жемчужинка ----------
/** Что сказать под настроение: ночью — про светящееся море, вечером — про черепашат, днём — про ракушки по сезону. */
export const pearlLine = npcLine('pearl', {
  evening: 17,
  first: () => {
    const own = S().flags.coveCastle;
    if (own && S().day - own.day <= 1 && Math.random() < 0.5)
      return 'Твой замок так и стоит на песке — я любуюсь им с камня! Особенно башенками 🏰✨';
  },
});
/** Разговор с Жемчужинкой: сначала задание из журнала, потом — замок, ракушки и болтовня. */
export const { talk: talkPearl } = landNpc({
  id: 'pearl',
  act: 'mermaid',
  desc: 'русалочка Жемчужинка: разговор (жительница секретного пляжа на камне в воде)',
  met: 'metPearl',
  hello: (name) =>
    `Ой! Привет-привет, ${name}! Ты приплыла через грот? Значит, Зефиркина карта нашлась! Я русалочка Жемчужинка. Здесь, в бухте, живут черепашата, море выносит редкие ракушки, а ночью вода светится, как звёздное небо!`,
  greet: (name) => [
    `Привет, ${name}! Плюх-плюх!`,
    'О, это ты! Я как раз пела песенку дельфинам.',
    'Здравствуй! Смотри, какая сегодня бирюзовая вода!',
  ],
  line: pearlLine,
  top: [{ text: '🏰 Построить замок из песка', cls: 'yellow', fn: async () => (await castleGame(), null) }],
  more: [
    // ракушки в рамке — по одной каждого вида
    craftSet({
      ids: SHELL_IDS,
      title: '🐚 Ракушки в рамке',
      mark: (id) => FIND_BY_ID[id].name,
      sep: ' · ',
      lack: (have) =>
        `Для рамки нужно по одной ракушке каждого вида: ${have}. Море выносит их на песок у самой воды — по одной-две в день!`,
      give: ['storage', 'shell_frame'],
      sticker: 'x_shells',
      event: ['cove', 'frame'],
      done: 'Готово: розовая, витая и ракушка-солнышко — в рамке из маленьких ракушек! Если прислушаться, слышно море 🐚 Рамка уже в кладовке: дома нажми 🔨.',
    }),
    // куда деть ракушки
    sellTalk({
      ids: SHELL_IDS,
      ask: 'ракушки',
      say: () =>
        `Конечно! Торговец Грошик на рынке в городе берёт ракушки: розовую — за ${COVE.shells.sell.shell_pink}, витую — за ${COVE.shells.sell.shell_spiral}, ракушку-солнышко — за ${COVE.shells.sell.shell_sun} монет. А можно собрать все три вида — я сделаю красивую рамку!`,
    }),
  ],
});

// ---------- «Замок из песка» ----------
/** Построить замок из песка: за первые игры дня — монеты по звёздам. */
export const castleGame = () =>
  prizeGame('sandcastle', {
    group: 'cove',
    flag: 'castles',
    ...COVE.castle,
    label: '🧜‍♀️ <b>Приз Жемчужинки:</b>',
    words: ['замок', 'замка'],
    done: '💛 Сегодня призы за замки уже получены. Строить можно для удовольствия — завтра призы снова!',
    fun: '💛 Этот замок был для удовольствия.',
    sticker: 'x_castle',
    // свой замок (третий, «как хочется») остаётся на пляже до завтра — Жемчужинка любуется им с камня (С7)
    after: (res) => {
      const cells = res.extra && res.extra.cells;
      if (Array.isArray(cells) && cells.some(Boolean))
        setFlag('coveCastle', { day: S().day, cells: cells.map((x) => x || null) });
    },
    thanks: 'Жемчужинка: «Какой красивый замок!»',
  });

// ---------- черепашата, клад, ракушки ----------
/** Гнездо черепашат: вечером — вылупиться и ползти за хомячком; днём и после — добрая подсказка. */
export function nestTap() {
  if (turtlesOut()) return void toast('🐢 Черепашата ползут за тобой — веди их прямо в воду!');
  if (SC().turtles) return void toast('🐢 Сегодня черепашата уже плавают в море. Завтра вечером вылупятся новые!');
  if (!hatchTime()) {
    sfx('tap');
    toast(`🥚 Тс-с… Черепашата ещё спят в яйцах. Они вылупляются вечером, после ${COVE.turtles.from}:00!`);
    return;
  }
  startHatch();
  toast(`🐢 Тук-тук… Вылупились ${turtlesToday()} черепашат! Иди к воде — они поползут за тобой.`, 'good');
}
/** Выкопать клад под крестиком (раз за игру): монеты и «Сундучок с сокровищами». */
export async function digTreasure() {
  if (treasureDug()) return;
  setFlag('coveTreasure');
  earn(COVE.treasure.coins, 'gift');
  addItem('storage', 'treasure_chest', 1);
  sfx('dig');
  emit('cove', { what: 'treasure' });
  award('x_cove_treasure', { quiet: true });
  sfx('fanfare');
  await message({
    title: 'Клад секретного пляжа!',
    icon: '💰',
    html: `<p class="center big-emoji">🧰✨</p><p class="center">Копаем… копаем… Дзынь! Лопатка стукнулась о крышку — это сундучок! Внутри — золотые монетки, жемчуг и бусы. Карта Зефирки не обманула!</p><p class="reward center">🪙 +${fmtMoney(COVE.treasure.coins)} монет</p><p class="center">🎁 <b>Сундучок с сокровищами</b> — уже в кладовке: дома нажми 🔨.</p><p class="center muted">Наклейка «Клад секретного пляжа» 💰 — в альбоме!</p>`,
    buttons: [{ text: 'Ура!' }],
  });
}
landActs(
  'cove',
  {
    castle: castleGame,
    nest: nestTap,
    dig: digTreasure,
    shell: () => emit('cove', { what: 'shell' }),
    piece: (ctx, p, id) => findPiece(id),
  },
  'секретный пляж: cove:castle | nest | dig | shell | piece:<tower|ship|isle> (кусочек карты Зефирки)',
);

// ---------- карта сокровищ Зефирки ----------
const PIECE_TEXT = {
  tower: 'Чайка испугалась, хлопнула крыльями — и кусочек карты, кружась, упал прямо на смотровую площадку!',
  ship: 'Сундучок скрипнул и открылся: внутри, в непромокаемом мешочке, — кусочек старой карты!',
  isle: 'Под пальмой в песке — бутылка! А в ней свёрнутый в трубочку кусочек старой карты.',
};
/** Какие кусочки уже найдены (по шагам задания). */
export function piecesFound() {
  const w = questNow('treasure_map');
  if (w.status === 'done') return PIECES.slice();
  if (w.status !== 'active') return [];
  return PIECES.filter((_, i) => w.steps[i] && w.steps[i].ok);
}
/** Кусочек id сейчас можно найти: задание взято, а этого кусочка ещё нет. */
export const pieceWanted = (id) => questNow('treasure_map').status === 'active' && !piecesFound().includes(id);
/** Нашли кусочек карты: событие (шаг задания) и окно с картой — какие кусочки уже есть. */
export async function findPiece(id) {
  if (!PIECES.includes(id) || !pieceWanted(id)) return false;
  emit('cove', { what: 'piece', id });
  sfx('magic');
  const have = piecesFound(),
    all = have.length === PIECES.length;
  await message({
    title: all ? 'Карта сложилась!' : 'Кусочек карты!',
    icon: '🗺️',
    cls: 'narrow',
    html: `<p class="center">${PIECE_TEXT[id]}</p><p class="center"><img class="treasure-map" src="${treasureMapImage(have)}" alt="Карта сокровищ" style="width:100%;max-width:340px;height:auto;border-radius:12px"></p><p class="center">${
      all
        ? '<b>Все три кусочка!</b> Скалы на востоке моря, буёк-ракушка, подводный грот… а крестик — на секретном пляже! Скорее к Зефирке!'
        : `Кусочков: <b>${have.length} из ${PIECES.length}</b>. Остальные — в журнале 📖`
    }</p>`,
    buttons: [{ text: all ? 'К Зефирке!' : 'Ура!' }],
  });
  return true;
}
/** Картинка карты (data: URL) — для окна. */
export function treasureMapImage(have) {
  const { canvas, ctx } = makeCanvas(340, 230);
  paintTreasureMap(ctx, 340, 230, have);
  return canvas.toDataURL();
}

// ---------- наклейки и подсказки по событиям места ----------
on('cove', ({ what }) => {
  if (!S()) return;
  if (what === 'turtles') {
    setDayFlag('turtles', 1, 'cove');
    sfx('win');
    if (award('x_turtles', { delay: 1400 }))
      toast('🐢 Все черепашата доплыли до моря! Плывите, малыши! Жемчужинка машет им хвостом.', 'good');
    else toast('🐢 Черепашата уплыли в море — счастливого пути!', 'good');
  } else if (what === 'glow' && award('x_glow', { delay: 900 }))
    toast('✨ Ого, вода светится! Это крошечные морские огоньки — они загораются, когда плывёшь.', 'good');
  else if (what === 'shell')
    hintOnce(
      'shellHint',
      '🐚 Редкая ракушка! Собери все три вида — Жемчужинка сделает рамку. А ещё их берёт рынок.',
      'good',
      900,
    );
});
landHint(
  'cove',
  'coveHint',
  '🐢 Секретный пляж! Жемчужинка сидит на камне у воды — поздоровайся. А крестик с карты — где-то на песке!',
);

// ---------- заплыв через подводный грот ----------
/** Для автотеста: был ли на картинке последнего заплыва дельфин (простуженную везёт он, В20). */
const lastGrotto = { dolphin: false };
export const debugGrottoRide = () => ({ ...lastGrotto });
/** Проплыть через подводный грот: toCove — из моря города на секретный пляж, иначе — обратно к буйку. */
export const rideGrotto = landRide({
  act: 'grotto',
  desc: 'подводный грот: grotto:go (из моря города на секретный пляж) | grotto:back',
  sound: 'splash',
  check: (toCove) => {
    if (toCove && !canSwim()) {
      toast(SICK_TEXT.water); // простуженной нырять нельзя (Ф1)
      return false;
    }
    if (!toCove && !canSwim()) toast('🐬 Жемчужинка позвала дельфина — он довезёт тебя через грот, чтобы не мёрзнуть!');
  },
  cls: 'grotto-ride',
  text: ['🤿 Плывём через подводный грот!', '🤿 Плывём обратно, в море города!'],
  ms: 2600,
  paint: (toCove) => {
    const dolphin = (lastGrotto.dolphin = !toCove && !canSwim()); // простуженную везёт дельфин (В20)
    return (ctx, w, h, p, look, t) => paintGrotto(ctx, w, h, smooth(p), toCove, look, t, dolphin);
  },
  to: (toCove) => {
    const land = LAND_BY_ID.cove;
    if (toCove) {
      sea.parkBoat(); // приплыла на кораблике — он ждёт у буйка
      go(land.scene, { at: land.entry });
    } else go('world', { at: 'grotto' });
  },
  done: (toCove) => toCove && award('x_grotto', { delay: 600 }),
});
