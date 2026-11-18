// ЛЕС (П.9): что делают в лесу. Сама локация (где что стоит) — locations/forest.js; она называет действия реестра,
// а выполняются они здесь:
//   forester            поговорить с лесником Шишкиным (житель леса и дверь его избушки); у него же — еловый венок
//   forest:hive         улей: летом и осенью — баночка мёда раз в день; весной и зимой пчёлы не дают мёда
//   forest:squirrel     белка на дубе: 3 орешка → золотая шишка (украшение для дома, раз в день); 4 шишки → орешек
//   forest:fire         костёр: вечером и ночью — пожарить зефир (зефир — в ТЦ «Вкусный»)
//   forest:treehouse    домик на дереве: забраться и посмотреть на лес сверху (окно с видом)
//   forest:hunt         мини-игра «Грибная охота» (minigames/mushrooms.js) — её предлагает Шишкин: за первые
//                       FOREST.hunt.paid игр в день он платит монетами и даёт корзинку грибов по звёздам
// Числа — FOREST в data/economy.js, сезоны — WILD_MONTHS в data/seasons.js. Каждое занятие шлёт событие forest
// { what } — по нему считают задания. Состояние меняют только действия (core/actions.js); «раз в день» — отметки
// дня (dayFlags.forest), утром сбрасываются сами. Разговор, венок, «нашлось» и действие места — набор тайных мест
// (features/land_kit.js).
import { setDayFlag, addItem, award } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { emit } from '../core/events.js';
import { G, cal, darkness, count, questNow } from '../core/state.js';
import { fmtMoney } from '../core/util.js';
import { FOREST, ING_BY_ID, DISH_BY_ID, FIND_BY_ID, QUEST_BY_ID, wildIn, DAYS_PER_MONTH } from '../data/index.js';
import { message } from '../ui/panel.js';
import { toast } from '../ui/toast.js';
import { eat } from './cooking.js';
import { prizeGame } from './minigames.js';
import { paintTreeView } from './pictures_art.js';
import { dayFlags, npcLine, landNpc, craftCount, landFind, landView, landActs } from './land_kit.js';

const S = () => G.state;

/** Что сказать лесу под настроение: ночью — про ночь, вечером — про костёр, днём — про сезон. */
export const shishkinLine = npcLine('shishkin');

/** Разговор с лесником: сначала задание из журнала (взять, как дела, сдать), потом — болтовня. */
export const { talk: talkShishkin } = landNpc({
  id: 'shishkin',
  act: 'forester',
  desc: 'лесник Шишкин: разговор (житель леса и дверь его избушки)',
  met: 'metShishkin',
  hello: (name) =>
    `Здравствуй, ${name}! Я лесник Шишкин. Мята писала, что ты придёшь! В лесу растут грибы и ягоды, у ручья — улей, на старом дубе живёт белка, а вечером у костра можно пожарить зефир. Будь как дома!`,
  greet: (name) => [`Привет, ${name}!`, 'А, это ты! Здравствуй!', 'Доброго дня, путешественница!'],
  line: shishkinLine,
  top: [{ text: '🍄 Грибная охота', cls: 'yellow', fn: async () => (await mushroomHunt(), null) }],
  after: [
    // еловый венок из веточек
    craftCount({
      id: 'fir_twig',
      need: FOREST.wreath,
      title: '🎄 Сплести венок',
      unit: 'веточек ',
      lack: (n) => `Для венка нужно ${FOREST.wreath} еловые веточки, а у тебя ${n}. Поищи ещё под ёлками — зимой они там лежат!`,
      give: ['storage', 'fir_wreath'],
      event: ['forest', 'wreath'],
      done: 'Вот, держи еловый венок! Повесь дома на стену — будет пахнуть лесом и Новым годом 🎄 Он уже в кладовке: дома нажми 🔨.',
    }),
  ],
});

// ---------- улей ----------
const S2 = dayFlags('forest');
const monthNow = () => Math.floor(S().day / DAYS_PER_MONTH) % 12;
const done = (what) => !!S2()[what];
/** Улей: раз в день баночка мёда — летом и осенью и только днём. */
export function visitHive() {
  const sea = cal().season;
  sfx('tap');
  if (!wildIn('bees', monthNow())) {
    toast(
      sea === 'winter'
        ? '🐝 Зимой пчёлы спят в тёплом улье. Тсс! Мёд будет летом.'
        : '🐝 Пчёлы только проснулись и собирают первый нектар. Мёд будет летом!',
    );
    return false;
  }
  if (darkness() > 0.6) {
    toast('🐝 Ночью пчёлы спят. Приходи утром!');
    return false;
  }
  if (done('hive')) {
    toast('🍯 Сегодня мёд уже собран. Завтра пчёлки наберут ещё!');
    return false;
  }
  setDayFlag('hive', 1, 'forest');
  addItem('ing', 'honey', FOREST.honey);
  sfx('coin');
  toast(`🐝 Жу-жу! Пчёлы поделились: +${FOREST.honey} ${ING_BY_ID.honey.e} ${ING_BY_ID.honey.name}`, 'good');
  emit('forest', { what: 'hive' });
  emit('gather', { id: 'honey', n: FOREST.honey });
  return true;
}
// ---------- белка ----------
/** Бельчонок из задания Шишкина найден и ещё не дома. */
const kitCarried = () => {
  if (!QUEST_BY_ID.squirrel_kit) return false;
  const w = questNow('squirrel_kit');
  return w.status === 'active' && w.i === 1;
};
/** Белка на дубе: обменять орешки на золотую шишку (раз в день) или шишки на орешек. */
export async function visitSquirrel() {
  const sq = FOREST.squirrel;
  for (;;) {
    const nuts = count('ing', 'nuts'),
      cones = count('finds', 'cone'),
      gold = !done('squirrel');
    const opts = [];
    if (kitCarried()) opts.push({ text: '🐿️ Вернуть бельчонка маме', cls: 'yellow', go: 'kit' });
    opts.push({
      text: `${ING_BY_ID.nuts.e}×${sq.nuts} → ✨ Золотая шишка`,
      cls: gold && nuts >= sq.nuts ? 'green' : 'ghost',
      go: 'gold',
    });
    opts.push({
      text: `${FIND_BY_ID.cone.e}×${sq.cones} → ${ING_BY_ID.nuts.e} Орешек`,
      cls: cones >= sq.cones ? 'blue' : 'ghost',
      go: 'nut',
    });
    opts.push({ text: 'Пока!', cls: 'ghost', go: 'bye' });
    const i = await message({
      title: 'Белка Рыжик',
      icon: '🐿️',
      html: `<p class="center big-emoji">🐿️</p><p class="center">Цок-цок! Я белка Рыжик. Обожаю орешки и меняюсь честно:<br><b>${sq.nuts} орешка</b> — на <b>золотую шишку</b> (одну в день — её можно поставить дома!),<br><b>${sq.cones} шишки</b> — на <b>орешек</b>.</p><p class="center muted">У тебя: ${ING_BY_ID.nuts.e} ${nuts} · ${FIND_BY_ID.cone.e} ${cones}</p>`,
      buttons: opts,
    });
    const go = (opts[i] || {}).go;
    if (go === 'kit') {
      emit('forest', { what: 'kitHome' });
      sfx('win');
      await message({
        title: 'Бельчонок дома!',
        icon: '🐿️',
        html: '<p class="center big-emoji">🐿️💛🐿️</p><p class="center">«Мой малыш! Спасибо-спасибо! Он опять убежал за грибами…» — мама-белка обнимает бельчонка хвостом. Расскажи Шишкину, что всё хорошо!</p>',
        buttons: [{ text: 'Ура!' }],
      });
      continue;
    }
    if (go === 'gold') {
      if (!gold) toast('🐿️ Золотую шишку я уже подарила сегодня. Приходи завтра!');
      else if (nuts < sq.nuts)
        toast(
          `🐿️ Нужно ${sq.nuts} орешка, а у тебя ${nuts}. Орешки растут на лещине осенью и продаются в ТЦ «Вкусный».`,
        );
      else {
        addItem('ing', 'nuts', -sq.nuts);
        addItem('storage', 'golden_cone', 1);
        setDayFlag('squirrel', 1, 'forest');
        sfx('win');
        toast(`✨ Золотая шишка — в кладовке! Дома нажми 🔨 и поставь её.`, 'good');
        award('x_squirrel', { delay: 1200 });
        emit('forest', { what: 'squirrel' });
      }
      continue;
    }
    if (go === 'nut') {
      if (cones < sq.cones) toast(`🐿️ Нужно ${sq.cones} шишки, а у тебя ${cones}. Шишки лежат под ёлками у тропинок.`);
      else {
        addItem('finds', 'cone', -sq.cones);
        addItem('ing', 'nuts', 1);
        sfx('coin');
        toast(`🐿️ Держи орешек! +1 ${ING_BY_ID.nuts.e}`, 'good');
        emit('forest', { what: 'trade' });
      }
      continue;
    }
    return;
  }
}

// ---------- костёр ----------
const fireOn = () => {
  const m = S().minutes;
  return m >= FOREST.fire[0] || m < FOREST.fire[1];
};
/** Костёр: вечером и ночью пожарить зефир (нужен зефир из ТЦ «Вкусный»). */
export async function visitFire() {
  const z = ING_BY_ID.marshmallow,
    dish = DISH_BY_ID.toasted_marshmallow;
  if (!fireOn()) {
    sfx('tap');
    toast('🔥 Шишкин зажигает костёр вечером, в 6 часов. Приходи вечером с зефиром — пожарим!');
    return false;
  }
  if (!count('ing', 'marshmallow')) {
    sfx('tap');
    toast(`🔥 Костёр горит! А зефира нет 🙁 ${z.e} Зефир продаётся в ТЦ «Вкусный».`);
    return false;
  }
  addItem('ing', 'marshmallow', -1);
  addItem('dishes', dish.id, 1);
  sfx('pop');
  emit('forest', { what: 'fire' });
  award('x_marshmallow', { delay: 1600 });
  const i = await message({
    title: 'Зефир у костра',
    icon: '🔥',
    html: `<p class="center big-emoji">🔥${dish.e}</p><p class="center">Зефир на палочке зарумянился — снаружи хрустит, внутри тянется! Получилось: <b>${dish.name}</b>.</p>`,
    buttons: [{ text: '😋 Съесть сейчас', cls: 'green' }, { text: '🎒 В рюкзак' }],
  });
  if (i === 0) eat(dish.id);
  else toast(`${dish.e} ${dish.name} — в рюкзаке`, 'good');
  return true;
}

// ---------- домик на дереве ----------
/** Забраться в домик на дереве: окно с видом сверху на лес. */
export function climbTreehouse() {
  sfx('door');
  emit('forest', { what: 'treehouse' });
  emit('visit', { place: 'treehouse' });
  award('x_treehouse', { delay: 1400 });
  const season = cal().season,
    dark = darkness();
  return landView({
    title: 'Домик на дереве',
    icon: '🏡',
    ratio: 0.56,
    paint: (ctx, W, H) => paintTreeView(ctx, W, H, season, dark),
    text: 'Ты забралась в домик на дереве! Отсюда виден весь лес, ручей и далёкая гора. К горе тянется канатная дорога — но она пока закрыта 🔒',
    btn: 'Спуститься 🪜',
  });
}

// ---------- «Грибная охота» ----------
/** Награда за охоту на stars звёзд: монеты и грибы (пополам белые и обычные). */
export const huntReward = (stars) => {
  const n = FOREST.hunt.items[stars - 1],
    porcini = Math.floor(n / 2);
  return { coins: FOREST.hunt.coins[stars - 1], porcini, mushroom: n - porcini };
};
const rewardText = (r) =>
  `🪙 ${fmtMoney(r.coins)} и ${ING_BY_ID.mushroom.e}×${r.mushroom} ${ING_BY_ID.porcini.e}×${r.porcini}`;
/** Сыграть в «Грибную охоту»: за первые игры дня — монеты и грибы в рюкзак. */
export const mushroomHunt = () =>
  prizeGame('mushrooms', {
    group: 'forest',
    flag: 'hunts',
    ...FOREST.hunt,
    label: '🧺 <b>Награда Шишкина:</b>',
    more: ' — и грибы в корзинку.',
    words: ['охота', 'охоты'],
    what: 'с наградой',
    done: '💛 Сегодня Шишкин уже наградил тебя. Сыграть можно для удовольствия — завтра награда снова!',
    sum: (stars) => `🧺 Награда: ${rewardText(huntReward(stars))}`,
    fun: '💛 Эта охота была для удовольствия.',
    reward: (stars) => {
      const r = huntReward(stars);
      addItem('ing', 'mushroom', r.mushroom);
      addItem('ing', 'porcini', r.porcini);
      return r;
    },
    thanks: (stars, r) => `Шишкин: «Вот это грибник!» ${rewardText(r)} — в рюкзаке`,
  });

// ---------- бельчонок (задание «Потерянный бельчонок», data/quests.js) ----------
/** Нашли бельчонка на грибной поляне (место kit видно, пока задание на первом шаге). */
export const findKit = landFind('forest', 'kit', {
  title: 'Бельчонок нашёлся!',
  icon: '🐿️',
  pic: '🐿️🍄',
  text: 'Вот он, малыш! Сидит под грибом и пищит. Бельчонок запрыгнул к тебе в корзинку — неси его маме на старый дуб за мостиком!',
  btn: 'Идём к маме!',
});

landActs(
  'forest',
  {
    kit: findKit,
    hunt: mushroomHunt,
    hive: visitHive,
    squirrel: visitSquirrel,
    fire: visitFire,
    treehouse: climbTreehouse,
  },
  'лес: forest:hive | squirrel | fire | treehouse | kit',
);
