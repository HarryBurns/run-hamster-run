// КУРОРТНЫЙ ОТЕЛЬ «Морская звезда» (П.17): что делают в отеле. Сам отель (этажи, стойки, двери, горка, кто где
// стоит) — interiors/hotel.js; он называет действия реестра hotel:*, а выполняются они здесь:
//   hotel:reception    Администратор Звёздочка: снять номер на ночь — эконом 201, стандарт 207 или с балконом 202
//                      (HOTEL_ROOMS, цены — HOTEL.room и HOTEL.rooms; От2), про люкс, что есть в отеле
//   hotel:bed[:класс]  кровать номера (207 — стандарт; :eco, :balcony — в номерах 201, 202): снят этот номер — лечь
//                      спать (сон — features/sleep.js; утро — в номере), нет — подсказка
//   hotel:knock:<n>    двери номеров 201–205: снятый номер (201, 202) — войти (interiors/hotel_rooms.js); в номере 203
//                      гостит житель (roomGuestOn, От1) — «Заходи!», в гости; остальные — «Тук-тук!», там отдыхают гости
//   hotel:suite        золотая дверь «Люкс»: свой номер-люкс — войти (home:suite), не куплен — окно риелтора
//   hotel:buffet       шведский стол: съесть блюдо; раз в день — за полцены (HOTEL.buffet), после ночи в отеле — даром
//   hotel:spa          Мастер Пенка: массаж лапок или маска из огурчиков (HOTEL.spa) — короткая сценка, наклейка
//   hotel:animator     Аниматор Хлопушка: утром зарядка, вечером дискотека (часы — HOTEL.animator) — мини-игра
//                      «Повтори движение» (minigames/mimic.js, От9), наклейка; ⭐⭐⭐ — наклейка «Повтори за мной»
//   hotel:schedule     доска с расписанием аниматора у бассейна
//   hotel:slide        мини-игра «Горка» (minigames/slide.js): за первые HOTEL.slide.paid игр в день — монеты по звёздам
//   hotel:porter       Носильщик Тележкин: работа носильщицей — мини-игра «Носильщица» (minigames/porter.js),
//                      зарплата — JOBS.porter (features/minigames.js платит сама, как за другие работы)
// Каждое занятие шлёт событие hotel { what }. Состояние меняют только действия (core/actions.js); «раз в день» —
// отметки дня dayFlags.hotel (room — номер снят, ate — поела со скидкой, slept — ночевала в отеле, slides — игр
// в «Горку» с призом). Сохранение не менялось.
import { setFlag, setDayFlag, award, spendMinutes } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { on, emit } from '../core/events.js';
import { sceneName } from '../core/loop.js';
import { register, run } from '../core/registry.js';
import { G, darkness, ownsHome, canSwim, isSick, hotelRoomGuest } from '../core/state.js';
import { el, esc, pick, fmtMoney } from '../core/util.js';
import {
  NPC_BY_ID,
  DISH_BY_ID,
  HOTEL,
  HOTEL_ROOMS,
  GUEST_ROOM,
  BUFFET,
  HOME_BY_ID,
  SICK_TEXT,
  animatorNow,
  npcLook,
} from '../data/index.js';
import { HX, rentedRoom } from '../interiors/hotel.js';
import { DOORMAN } from '../locations/town_buildings.js';
import { go } from '../core/loop.js';
import { dialog } from '../ui/dialog.js';
import { fadeScene } from '../ui/fade.js';
import { openPanel } from '../ui/panel.js';
import { toast, hintOnce } from '../ui/toast.js';
import { buy, priceTag, buyBtn } from './purchase.js';
import { playMinigame, prizeGame } from './minigames.js';
import { paintSpa } from './pictures_art.js';

const S = () => G.state;
const HF = () => S().dayFlags.hotel || {};
const ROOM_BY = Object.fromEntries(HOTEL_ROOMS.map((r) => [r.id, r]));
/** Где номер: подсказка гостье. */
const whereRoom = (r) =>
  r.id === 'std' ? 'второй этаж, комната в самом конце коридора' : `второй этаж, дверь ${r.no} в коридоре`;
/** Реплика работника отеля по времени суток (lines.day / evening / night). */
function timeLine(id) {
  const L = NPC_BY_ID[id].lines,
    m = S().minutes;
  if (darkness() > 0.6 || m >= 22 * 60 || m < 5 * 60) return pick(L.night);
  if (m >= 18 * 60) return pick(L.evening);
  return pick(L.day);
}
const sayAs = (id, text, options, happy = false) =>
  dialog({ look: npcLook(id), name: NPC_BY_ID[id].name, text, options, happy });
const coinsText = (n) => `🪙 ${fmtMoney(n)}`;

// ---------- ресепшен: Администратор Звёздочка ----------
const ABOUT =
  'У нас всё для отдыха! Здесь, на первом этаже, — шведский стол и спа. На втором — номера: можно снять номер на ночь (ключ — хоть с утра, а спать — вечером). А на крыше — бассейн с водной горкой и аниматор: утром зарядка, вечером дискотека. Лифт — справа!';
async function reception() {
  const s = S();
  let text;
  if (!s.flags.metZvezdochka) {
    setFlag('metZvezdochka');
    text = `Добро пожаловать в отель «Морская звезда», ${esc(s.name)}! Я — администратор Звёздочка. ${ABOUT}`;
  } else text = pick([`Здравствуй, ${esc(s.name)}! Рада тебя видеть!`, timeLine('zvezdochka')]);
  emit('talk', { id: 'zvezdochka' });
  sfx('bell');
  for (;;) {
    const rented = rentedRoom() && ROOM_BY[rentedRoom()],
      suite = HOME_BY_ID.suite;
    const opts = [
      rented
        ? { text: `🔑 Мой номер ${rented.no}`, cls: 'green', go: 'room' }
        : {
            text: `🛏️ Снять номер на ночь — от ${coinsText(Math.min(...HOTEL_ROOMS.map((r) => r.price)))}`,
            cls: 'green',
            go: 'rent',
          },
      {
        text: ownsHome('suite') ? '🏨 Мой люкс' : `🏨 Номер-люкс — ${coinsText(suite.price)}`,
        cls: 'yellow',
        go: 'suite',
      },
      { text: '💬 Что есть в отеле?', cls: 'blue', go: 'about' },
      { text: 'Пока!', go: 'bye' },
    ];
    const i = await sayAs('zvezdochka', text, opts);
    const o = opts[i] || {};
    if (o.go === 'rent') {
      // номера разных классов (От2): дешевле — окно во двор, дороже — свой балкон над морем
      const ro = [
        ...HOTEL_ROOMS.map((r) => ({
          text: `${r.icon} ${r.name} · ${r.no} — ${r.view} — ${coinsText(r.price)}`,
          cls: r.id === 'std' ? 'green' : 'blue',
          room: r,
        })),
        { text: 'Подумаю' },
      ];
      const j = await sayAs(
        'zvezdochka',
        'Какой номер хочешь? Эконом — уютный, окошко во двор. Стандарт — с окном на море. А с балконом — свой балкон над морем и большая кровать!',
        ro,
      );
      const r = (ro[j] || {}).room;
      if (!r) {
        text = 'Конечно, подумай! Номера ждут до самой ночи.';
        continue;
      }
      if (!buy(r.price)) return;
      setDayFlag('room', r.id === 'std' ? 1 : r.id, 'hotel'); // стандарт — 1, как в старых сохранениях
      emit('hotel', { what: 'room', room: r.id });
      sfx('ok');
      text = `Вот твой ключ — номер ${r.no}, «${r.name}»! Лифт справа, ${whereRoom(r)}. Ложись вечером, после 19:00: утром проснёшься ${r.id === 'eco' ? 'под чириканье воробьёв во дворе' : 'под шум моря'}. А завтрак у нас — даром!`;
    } else if (o.go === 'room')
      text = `Номер ${rented.no} ждёт тебя до утра: ${whereRoom(rented)}. На подушке — шоколадка! 🍫`;
    else if (o.go === 'suite')
      text = ownsHome('suite')
        ? 'Твой люкс — на втором этаже, золотая дверь с надписью «Люкс». Там гостиная с видом на море и спальня с джакузи!'
        : `Номер-люкс — на втором этаже, за золотой дверью: гостиная с видом на море и спальня с джакузи. Его можно купить насовсем — за ${coinsText(suite.price)} в агентстве «Свой домик» у Ключика, на Северной улице. Тогда это будет твой дом!`;
    else if (o.go === 'about') text = ABOUT;
    else return;
  }
}

// ---------- номер на ночь ----------
let nightInHotel = false;
function bed(cls = 'std') {
  const mine = rentedRoom();
  if (mine !== cls) {
    const r = ROOM_BY[cls] || ROOM_BY.std;
    sfx('tap');
    toast(
      mine
        ? `🛏️ Твой номер сегодня — ${ROOM_BY[mine].no}, «${ROOM_BY[mine].name}». А этот свободен.`
        : `🛏️ Номер ${r.no} свободен. Ключ — на ресепшене у Звёздочки (${coinsText(r.price)}): тогда здесь можно переночевать.`,
    );
    return false;
  }
  nightInHotel = true;
  // передумала спать («Ещё погуляю») — ночёвку не считаем; уснула — флаг снимет утро (wake)
  Promise.resolve(run('sleep')).then((slept) => {
    if (!slept) nightInHotel = false;
  });
  return true;
}
// утро после ночи в номере: хомячок уже у кровати (движок домов ставит её у кровати в «своей спальне» — номере 207)
on('wake', () => {
  if (!S() || !/^hotel/.test(sceneName()) || !nightInHotel) return;
  nightInHotel = false;
  const eco = sceneName() === 'hotel_201';
  setDayFlag('slept', 1, 'hotel'); // отметка нового дня: завтрак за счёт отеля
  emit('hotel', { what: 'night' });
  award('x_hotel_night', { delay: 2600 });
  setTimeout(
    () =>
      toast(
        `🌅 Доброе утро в отеле! ${eco ? 'Во дворе чирикают воробьи' : 'За окном шумит море'}. Завтрак на первом этаже — для гостей отеля даром!`,
        'good',
      ),
    1400,
  );
});

// ---------- двери номеров и люкс ----------
const KNOCK = [
  'Тук-тук! «Кто там? Мы отдыхаем после пляжа!» 😴',
  'Тук-тук! Из-за двери: «Мы уже на горке, приходи туда!» 🌀',
  'Тук-тук! Тишина… Гости, наверное, на шведском столе 🥐',
  'Тук-тук! «Ой, мы примеряем панамки! Заходи попозже» 👒',
];
/** Дверь номера n в коридоре: свой снятый номер — войти, в 203 гостит житель — в гости, иначе — «тук-тук». */
function knock(n) {
  const no = +n,
    i = HX.doors.findIndex((_, k) => 201 + k === no),
    back = { scene: 'hotel', floor: 1, x: HX.doors[Math.max(0, i)] },
    mine = rentedRoom() && ROOM_BY[rentedRoom()];
  if (mine && mine.no === no && mine.id !== 'std') {
    sfx('door');
    go('hotel_' + no, { back });
    toast(
      `🔑 Номер ${no}, «${mine.name}». ${mine.id === 'balcony' ? 'Балкон — справа!' : 'Уютно!'} Кровать уже застелена.`,
    );
    return true;
  }
  const who = no === GUEST_ROOM && hotelRoomGuest();
  if (who) {
    sfx('tap');
    setTimeout(() => sfx('door'), 260);
    go('hotel_' + no, { back });
    emit('visit', { place: 'hotel_room', npc: who });
    toast(`🚪 ${no}: Тук-тук! «Это ты? Заходи! Я тут гощу до обеда — ${NPC_BY_ID[who].name} 🧳»`);
    return true;
  }
  sfx('tap');
  setTimeout(() => sfx('tap'), 160);
  toast(`🚪 ${n}: ${pick(KNOCK)}`);
  return true;
}
/** Золотая дверь «Люкс»: свой — войти (дверь люкса выведет обратно в коридор), нет — окно риелтора. */
function suiteDoor() {
  return run('home:suite', { back: { scene: 'hotel', floor: 1, x: HX.suite } });
}

// ---------- шведский стол ----------
/** Цена блюда у шведского стола сегодня: первое за день — за полцены, после ночи в отеле — даром. */
export function buffetPrice(id) {
  const full = DISH_BY_ID[id].price;
  if (HF().ate) return full;
  return HF().slept ? 0 : Math.round(full * HOTEL.buffet);
}
export function openBuffet() {
  emit('visit', { place: 'hotel' });
  return openPanel({
    title: 'Шведский стол',
    icon: '🍽️',
    money: true,
    render(body, tab, panel) {
      const h = HF();
      body.appendChild(
        el(
          'p',
          'muted center',
          h.ate
            ? 'Сегодняшняя скидка уже была — завтра снова! А пока всё по обычной цене.'
            : h.slept
              ? '🌅 Ты ночевала в отеле — <b>завтрак за счёт отеля</b>: одно любое блюдо даром!'
              : `Сегодня <b>одно любое блюдо — за полцены</b>! А для тех, кто ночевал в отеле, завтрак даром.`,
        ),
      );
      const grid = el('div', 'grid');
      for (const id of BUFFET) {
        const d = DISH_BY_ID[id],
          price = buffetPrice(id);
        const card = el('div', 'card');
        card.appendChild(el('div', 'e', d.e));
        card.appendChild(el('div', 'nm', d.name));
        card.appendChild(price ? priceTag(price) : el('div', 'pr', '🎁 даром'));
        if (price < d.price) card.appendChild(el('span', 'badge treat', price ? '−50%' : 'Завтрак'));
        card.appendChild(
          buyBtn('Съесть 😋', price, () => {
            if (price && !buy(price)) return;
            if (!HF().ate) setDayFlag('ate', 1, 'hotel');
            sfx('eat');
            toast(`Ням-ням! ${d.e} ${d.name}${price ? '' : ' — за счёт отеля!'}`, 'good');
            emit('buy', { cat: 'dish', id });
            emit('eat', { id });
            emit('hotel', { what: 'buffet' });
            award('x_buffet', { delay: 900 });
            spendMinutes(15);
            panel.refresh();
          }),
        );
        grid.appendChild(card);
      }
      body.appendChild(grid);
    },
  });
}

// ---------- сценки: спа и танцы ----------
// ---------- спа: Мастер Пенка ----------
let busy = false;
async function spa() {
  if (busy) return;
  emit('talk', { id: 'penka' });
  sfx('tap');
  let text = timeLine('penka');
  if (isSick())
    text =
      'Ой, у тебя насморк… Спа простуду не лечит — к доктору Витаминкину в больницу! Но маска из огурчиков поднимет настроение — хочешь?';
  const opts = [
    { text: `💆 Массаж лапок — ${coinsText(HOTEL.spa)}`, cls: 'green', what: 'massage' },
    { text: `🥒 Маска из огурчиков — ${coinsText(HOTEL.spa)}`, cls: 'yellow', what: 'mask' },
    { text: 'Пока!' },
  ];
  const o = opts[await sayAs('penka', text, opts)] || {};
  if (!o.what || !buy(HOTEL.spa)) return;
  busy = true;
  sfx('bubble');
  await fadeScene({
    cls: 'spa-scene',
    text: o.what === 'mask' ? '🥒 Маска из огурчиков…' : '💆 Массаж лапок…',
    paint: paintSpa(o.what),
    ms: 3600,
    ratio: 0.58,
  });
  busy = false;
  spendMinutes(30);
  emit('spa', { what: o.what });
  emit('hotel', { what: 'spa' });
  setFlag('spaBoost', S().day); // бодрость (От7): к оплате следующей смены — приятная прибавка, сегодня и завтра
  emit('happy');
  sfx('magic');
  award('x_spa', { delay: 600 });
  toast(
    isSick()
      ? '✨ Как приятно! Носик ещё шмыгает — простуду вылечит доктор или тёплый чай, а настроение уже отличное!'
      : o.what === 'mask'
        ? '✨ Шёрстка мягкая и блестит, как жемчуг! Ты отдохнула.'
        : '✨ Лапки отдохнули — можно снова бегать весь день!',
    'good',
  );
  toast(
    `💆 Бодрость! Следующая смена на работе (сегодня или завтра) — на ${Math.round(HOTEL.spaBoost * 100)}% дороже. Значок 💆 — рядом с датой.`,
    'good',
  );
}

// ---------- швейцар у входа (От3): с ним можно поздороваться ----------
const DOORMAN_LINES = {
  day: [
    'Добрый день! Добро пожаловать в «Морскую звезду» — бассейн на крыше уже ждёт!',
    'Здравствуйте! Сегодня у нас чудесная погода для горки 🌊',
    'Рад вас видеть! Чемоданы? Ах, вы налегке — тем лучше!',
    'Привет-привет! Мастер Пенка в спа сегодня в прекрасном настроении 💆',
  ],
  night: [
    'Доброй ночи! Тсс… гости уже спят. Если нужен номер — Звёздочка на ресепшене не спит 🌙',
    'Поздно уже! Звёзды над морем сегодня яркие — загляните на террасу ✨',
  ],
};
async function doorman() {
  sfx('tap');
  const lines = darkness() > 0.5 ? DOORMAN_LINES.night : DOORMAN_LINES.day;
  const opts = [{ text: '👋 Здравствуйте!', cls: 'yellow' }, { text: 'Пока!' }];
  const i = await dialog({ look: DOORMAN, name: 'Швейцар Пуговкин', text: pick(lines), options: opts });
  if (i !== 0) return;
  sfx('heart');
  emit('hotel', { what: 'doorman' });
  await dialog({
    look: DOORMAN,
    name: 'Швейцар Пуговкин',
    text: pick([
      'И вам здравствуйте! *приподнимает фуражку* 🎩',
      'Как вежливо! Заходите — двери всегда открыты!',
      'Здравствуйте, здравствуйте! Хорошего дня!',
    ]),
    options: [{ text: 'Спасибо!' }],
    happy: true,
  });
}

/** Нажали на значок 💆 у даты: что такое бодрость после спа (От7). */
export function showBoostHelp() {
  toast(
    `💆 Бодрость после спа! Следующая смена на работе — на ${Math.round(HOTEL.spaBoost * 100)}% дороже. Действует сегодня и завтра — до первой смены.`,
    'good',
  );
}

// ---------- аниматор Хлопушка ----------
async function animator() {
  const now = animatorNow(S().minutes);
  emit('talk', { id: 'hlopushka' });
  sfx('tap');
  if (!now) {
    toast('🪩 Аниматор Хлопушка приходит к бассейну утром (зарядка в 8:00) и вечером (дискотека в 19:00).');
    return;
  }
  const morning = now === 'morning';
  const text = morning
    ? 'Доброе утро! Зарядка у бассейна! Лапки вверх, хвостик вбок — повторяй за мной!'
    : 'Дискотека у бассейна! Музыка, огоньки — танцуют все! Покажешь свой лучший танец?';
  const i = await sayAs(
    'hlopushka',
    text,
    [{ text: morning ? '🤸 Делать зарядку!' : '🪩 Танцевать!', cls: 'green' }, { text: 'Потом' }],
    true,
  );
  if (i !== 0 || busy) return;
  // «Повтори движение» (От9): Хлопушка показывает танец, хомячок повторяет кнопками
  busy = true;
  sfx(morning ? 'whistle' : 'fanfare');
  const res = await playMinigame('mimic', {
    kind: now,
    animator: npcLook('hlopushka'),
    introNote: `<div class="pay-note">${morning ? '🤸 Зарядка у бассейна: повторяй за Хлопушкой — и бодрость на весь день!' : '🪩 Дискотека у бассейна: повтори танец Хлопушки!'}</div>`,
  });
  busy = false;
  if (!res) return;
  if (res.stars === 3) award('x_mimic', { delay: 2600 });
  emit('hotel', { what: 'dance', kind: now });
  emit('happy');
  const got = award(morning ? 'x_zaryadka' : 'x_disco', { delay: 400 });
  toast(
    morning
      ? got
        ? '🤸 Отличная зарядка! Хлопушка хлопает: «Ты самая бодрая!»'
        : '🤸 Раз-два! Бодрость на весь день!'
      : got
        ? '🪩 Вот это танец! Все у бассейна аплодируют!'
        : '🪩 Танцы — это весело! Приходи завтра вечером снова.',
    'good',
  );
}
function schedule() {
  const now = animatorNow(S().minutes);
  sfx('pop');
  toast(
    now === 'morning'
      ? '🤸 Сейчас зарядка! Аниматор Хлопушка — у сцены справа.'
      : now === 'evening'
        ? '🪩 Сейчас дискотека! Аниматор Хлопушка — у сцены справа.'
        : `🪩 Расписание: зарядка — с ${HOTEL.animator.morning[0]}:00 до ${HOTEL.animator.morning[1]}:00, дискотека — с ${HOTEL.animator.evening[0]}:00 до ${Math.floor(HOTEL.animator.evening[1])}:30.`,
  );
}

// ---------- «Горка» ----------
export async function slideGame() {
  if (!canSwim()) {
    toast(SICK_TEXT.water);
    return null;
  }
  return prizeGame('slide', {
    group: 'hotel',
    flag: 'slides',
    ...HOTEL.slide,
    label: '🌀 <b>Приз отеля:</b>',
    words: ['спуск', 'спуска'],
    done: '💛 Сегодня призы за горку уже получены. Кататься можно для удовольствия — завтра призы снова!',
    fun: '💛 Этот спуск был для удовольствия.',
    after: () => emit('hotel', { what: 'slide' }),
    sticker: 'x_slide',
    thanks: 'Звёздочка с ресепшена: «Какой спуск!»',
  });
}

// ---------- носильщица: Тележкин ----------
async function porter() {
  emit('talk', { id: 'telezhkin' });
  sfx('tap');
  let text = S().flags.metTelezhkin
    ? timeLine('telezhkin')
    : 'Здравствуйте! Я — носильщик Тележкин. Гостей сегодня — целый корабль! Поможешь развезти чемоданы по номерам? Смотри на бирку — там номер комнаты.';
  setFlag('metTelezhkin');
  for (;;) {
    const i = await sayAs('telezhkin', text, [
      { text: '🧳 Развезти чемоданы', cls: 'green' },
      { text: '💬 Поболтать', cls: 'blue' },
      { text: 'Пока!' },
    ]);
    if (i === 1) {
      text = timeLine('telezhkin');
      continue;
    }
    if (i !== 0) return;
    const res = await playMinigame('porter');
    if (res) award('x_porter', { delay: 1800 });
    return;
  }
}

// ---------- реестр ----------
const ACTS = {
  reception,
  bed,
  suite: suiteDoor,
  buffet: openBuffet,
  spa,
  doorman,
  animator,
  schedule,
  slide: slideGame,
  porter,
};
register(
  'hotel',
  (p) => {
    const [what, arg] = String(p.arg || '').split(':');
    if (what === 'knock') return knock(arg);
    if (what === 'bed') return bed(arg || 'std');
    const fn = ACTS[what];
    if (!fn) {
      console.error('hotel: неизвестное занятие ' + p.arg);
      return null;
    }
    return fn();
  },
  'курортный отель: hotel:reception | bed[:eco|balcony] | knock:<номер> | suite | buffet | spa | doorman | animator | schedule | slide | porter',
);

// первый вход в отель: наклейка и подсказка, куда идти
on('scene', ({ name }) => {
  if (
    name === 'hotel' &&
    hintOnce(
      'hotelHint',
      '🏨 Добро пожаловать в отель «Морская звезда»! Ресепшен — прямо по курсу. Лифт справа: 2-й этаж — номера, 3-й — бассейн с горками.',
      'good',
    )
  )
    award('x_hotel', { delay: 900 });
});
