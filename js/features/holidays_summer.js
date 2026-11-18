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
import { plantMayBed, setDayFlag } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { emit } from '../core/events.js';
import { G, darkness } from '../core/state.js';
import { pick } from '../core/util.js';
import { HOLIDAY, holidayOffset, holidayYear, HOLIDAY_BY_ID } from '../data/index.js';
import { MAY_BEDS } from '../locations/holidays_art.js';
import { T, getLocation } from '../engine/topdown/index.js';
import { toast } from '../ui/toast.js';
import { holidayActs, holidayStep, holidayWhere, stepDoneFor } from './holidays.js';
import { tapScene, playScene, doorRound, holidayPrize } from './holidays_scenes.js';
import { paintPlant, paintParade, FLOWERS, paintWreath, CARVE, paintCarve, paintTrick } from './holidays_scenes_art.js';

const S = () => G.state;
/** Сколько дней от праздника id (−1 — канун, 0 — праздник). */
const offset = (id) => holidayOffset(HOLIDAY_BY_ID[id], S().day);

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
    plantMayBed(holidayYear(S().day), bed); // цветы остаются до конца лета (Пр17)
    holidayStep('mayday', 'plant', bed);
    emit('holiday', { id: 'mayday', what: 'plant', bed });
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
async function splash() {
  if (offset('kupala') < 0) return void toast('💦 Вёдра и водяные пистолеты уже на пляже! Водяная битва — завтра, на Ивана Купалу.');
  const res = await holidayPrize('splash', { flag: 'splashes', cfg: HOLIDAY.splash, label: '🌿 <b>Приз Купалы</b>', sticker: 'x_splash' });
  if (res) soak();
  return res;
}
/**
 * После «Водяной битвы» (Пр18) хомячок и жители, что были на пляже, мокрые — с них капает, у вёдер лужицы. Сохнут
 * за HOLIDAY.wet минут игрового времени (locations/holidays.js рисует капельки и лужицы). Отметка дня — когда облились.
 */
function soak() {
  const town = getLocation('world'),
    who = town ? town.npcs.filter((n) => !n.hidden && n.y > 48 * T).map((n) => n.id) : [];
  setDayFlag('wet', S().minutes, 'holiday');
  setDayFlag('wetWho', who, 'holiday');
  toast('💦 Все мокрые-премокрые! На солнышке быстро высохнем 😄', 'good');
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
doorRound({
  holiday: 'halloween',
  step: 'treats',
  title: 'Сладость или гадость?',
  icon: '🎃',
  ask: (name) => `<div class="center big-emoji">🎃🍬</div><p class="center">Это домик, где живёт <b>${name}</b>. Постучим и скажем: «Сладость или гадость?» На Хеллоуин хозяева всегда угощают!</p>`,
  go: '🎃 Сладость или гадость!',
  scene: ['🎃 «Сладость или гадость?» — «Конечно, сладость!»', paintTrick],
  treats: HOLIDAY.treats,
  thanks: (npc, d) => `Ой, какой нарядный гость! Совсем не страшный, а очень милый! Я как раз жду у двери с конфетами! С Хеллоуином! Держи сладость: ${d.e} ${d.name}!`,
  ok: 'Спасибо! С Хеллоуином! 🎃',
  talkBtn: '🎃 Сладость или гадость!',
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
