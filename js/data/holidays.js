// ПРАЗДНИКИ (П.13): таблица праздников и чистые функции «какой праздник сегодня / завтра / когда украшен город».
// Что происходит на празднике (объявление утром, журнал, подарок раз в год, занятия) — features/holidays.js,
// features/holidays_winter.js, holidays_summer.js (1 Мая, Иван Купала, Хеллоуин) и holidays_bday.js («Год в городе»); украшения города — locations/holidays.js. Числа баланса (монеты за праздник,
// конверты, «Перетягивание каната») — HOLIDAY в economy.js. Как добавить праздник — docs/ARCHITECTURE.md, «Праздники».
//
// Календарь: 12 месяцев по 3 дня, 36 дней в году (data/calendar.js); день года 0 — 1 января (новая игра начинается
// 1 июня — START_DAY, день 15). Праздник длится один
// игровой день. Город украшен с decor[0] по decor[1] день от праздника: −1 — накануне, 1 — и на следующее утро.
//
// Поля праздника:
//   id                 ключ: попадает в сохранение (flags['hol:<id>'] — в каком году подарок уже вручён) — не менять
//   name, icon, short  название, значок (в HUD, журнале, на карте), короткое имя для плашки на телефоне
//   month, dom         месяц (0 — январь) и день месяца (1–3); since — через сколько дней от начала игры празднуют
//                      впервые («Год в городе» — через год: игра началась 1 июня, первый праздник — 1 июня
//                      следующего года; у игр до этапа 10 день начала — 1 января, им считаем так же: с 36-го дня)
//   decor              [с какого, по какой день от праздника город украшен]
//   steps              праздничные занятия — шаги «праздничного задания» в журнале. Ход шага лежит в отметках дня
//                      (dayFlags.holiday[id] — сколько; у шагов «разные» — список, кто уже), поэтому сам сбрасывается
//                      утром. Поля шага: id, text, n (сколько раз, по умолчанию 1), hint (где и как), where — куда ведёт
//                      звёздочка: имя места города ('place:<id>'), 'friend' — ближайший друг, которому ещё не…,
//                      'door' — ближайший домик, где ещё не пели, 'envelope' — ближайший конверт, 'villa' — дом (плита);
//                      on, if, distinct — шаг считается сам по событию (core/events.js): on — имя события, if — какие
//                      поля должны совпасть, distinct — по какому полю считать «разных» (id друга)
//   gift               подарок раз в год: { clothes | recipe | furn: id } — вещь из таблиц одежды, еды или мебели (их
//                      shop: 'holiday' — только в подарок, без цены); clothes может быть списком (шляпа и мантия на
//                      Хеллоуин). Это подарок первого раза; more — подарки следующих лет (этап 10, Пр6): каждый год
//                      дарят первую вещь из списка [gift, ...more], которой ещё нет; всё собрано — HOLIDAY.again
//                      монет. presents — что ещё дарят друзья («Год в городе»), giftText — как это назвать в окнах
//   sticker            наклейка за праздник (EXTRA_STICKERS в data/tasks.js)
//   story              пара строк для журнала и утреннего окна
//   lines              что говорят жители: eve (накануне), day (в праздник), after (на следующий день)
import { BLINI } from './food.js';

export const HOLIDAYS = [
  {
    id: 'newyear',
    name: 'Новый год',
    short: 'Новый год',
    icon: '🎄',
    month: 11,
    dom: 3,
    decor: [-1, 1], // декабрь 2 — ёлку уже поставили; январь 1 — утро нового года, ёлка ещё стоит
    story: 'На площади — большая ёлка, на улицах — гирлянды и снеговики, а пруд в парке замёрз — там каток! Вечером все водят хоровод у ёлки, а потом — фейерверк! Наряди ёлку и подари друзьям подарки.',
    steps: [
      { id: 'tree', text: 'Наряди большую ёлку на площади', hint: 'Ёлка — на рыночной площади, слева от фонтана', where: 'place:nytree' },
      { id: 'gifts', text: 'Подари новогодние подарки трём друзьям', n: 3, hint: 'Поговори с друзьями в городе — у каждого для тебя есть минутка', where: 'friend' },
    ],
    gift: { clothes: 'hat_santa' },
    more: [{ clothes: 'sw_snow' }, { clothes: 'earmuffs_snow' }],
    sticker: 'x_hol_newyear',
    lines: {
      eve: ['Завтра Новый год! Ты уже видела ёлку на площади?', 'Я уже приготовил{а} подарки. Тс-с, это секрет!', 'Говорят, завтра вечером будет фейерверк!'],
      day: ['С Новым годом, {name}! Пусть всё-всё сбудется!', 'Сегодня вечером — фейерверк над площадью! Не проспи!', 'Ёлка на площади такая красивая! Поможешь её нарядить?'],
      after: ['С Новым годом! Вчерашний фейерверк был лучше всех!', 'Новый год — новые приключения! Куда пойдём?'],
    },
  },
  {
    id: 'xmas',
    name: 'Рождество',
    short: 'Рождество',
    icon: '🌟',
    month: 0,
    dom: 2,
    decor: [-1, 0],
    story: 'В окнах горят свечи, на дверях — венки, на площади — домик-вертеп со звездой. Вечером — колядки: обойди три домика жителей и спой у дверей — хозяева угостят!',
    steps: [
      { id: 'crib', text: 'Посмотри на домик-вертеп на площади', hint: 'Домик со звездой — справа от фонтана', where: 'place:crib' },
      { id: 'carols', text: 'Колядки: вечером спой у дверей трёх домиков жителей', n: 3, hint: 'Колядуют вечером, с 16:00 до 22:00: хозяева ждут у своих дверей — подойди к двери или к хозяину', where: 'door' },
    ],
    gift: { recipe: 'gingerbread' },
    more: [{ clothes: 'wings_angel' }, { clothes: 'starband_gold' }],
    sticker: 'x_hol_xmas',
    lines: {
      eve: ['Завтра Рождество! Я поставил{а} свечку на окно.', 'Ты знаешь колядки? Завтра пойдём петь по домам!', 'Видела домик со звездой на площади? Это вертеп!'],
      day: ['С Рождеством, {name}! Пахнет пряниками и хвоей.', 'Колядуешь сегодня? Загляни и ко мне — у меня есть угощение!', 'Свечи в окнах — чтобы всем было светло и тепло.'],
      after: ['Вчера было так уютно! Свечи горели всю ночь.'],
    },
  },
  {
    id: 'cny',
    name: 'Китайский Новый год',
    short: 'Кит. Новый год',
    icon: '🏮',
    month: 1,
    dom: 1,
    decor: [-1, 0],
    story: 'Город в красных фонариках, на площади танцует дракон — и все танцуют с ним! Запусти с пляжа небесные фонарики над морем и найди в городе красные конверты с монетками — на удачу.',
    steps: [
      { id: 'lanterns', text: 'Запусти небесные фонарики над морем', hint: 'Столик с фонариками — на пляже, у воды', where: 'place:skylanterns' },
      { id: 'envelopes', text: 'Найди красные конверты с монетками', n: 5, hint: 'Конверты 🧧 спрятаны на улицах города', where: 'envelope' },
    ],
    gift: { clothes: 'dress_qipao' },
    more: [{ clothes: 'fan_red' }, { clothes: 'hat_dragon' }],
    sticker: 'x_hol_cny',
    lines: {
      eve: ['Завтра Китайский Новый год! На улицах уже висят красные фонарики.', 'Говорят, завтра на площадь придёт дракон!'],
      day: ['С Новым годом по лунному календарю! Красный цвет — на удачу!', 'Ты нашла красный конверт? В них монетки на счастье!', 'Видела дракона на площади? Он добрый и танцует!'],
      after: ['Вчерашние фонарики улетели к самым звёздам!'],
    },
  },
  {
    id: 'maslenitsa',
    name: 'Масленица',
    short: 'Масленица',
    icon: '🥞',
    month: 1,
    dom: 3,
    decor: [-1, 0],
    story: 'На площади — ярмарка, карусель и соломенное чучело. Испеки блины, угости друзей и поиграй в «Перетягивание каната»!',
    steps: [
      { id: 'cook', text: 'Испеки блины — дома или на ярмарке', hint: 'У прилавка «Блины» на площади дают набор для блинов, рассказывают масленичные рецепты — и там же можно печь', where: 'place:blini', on: 'cook', if: { dish: BLINI } },
      { id: 'treat', text: 'Угости блинами трёх друзей', n: 3, hint: 'Поговори с другом и нажми «🎁 Угостить» — выбери блины (любые: простые, с вареньем, с мёдом)', where: 'friend', on: 'gift', if: { dish: BLINI }, distinct: 'id' },
      { id: 'tug', text: 'Сыграй в «Перетягивание каната» на ярмарке', hint: 'Канат лежит на площади, под фонтаном', where: 'place:tug', on: 'minigame', if: { id: 'tug' } },
    ],
    gift: { furn: 'samovar' },
    more: [{ clothes: 'kokoshnik_red' }, { clothes: 'shawl_rose' }],
    sticker: 'x_hol_maslenitsa',
    lines: {
      eve: ['Завтра Масленица! Я уже купил{а} муку для блинов.', 'Видела карусель на площади? Завтра ярмарка!'],
      day: ['С Масленицей, {name}! Блины — это маленькие солнышки!', 'Пойдём перетягивать канат? Я — за твою команду!', 'Прощай, зима! Скоро весна!'],
      after: ['Вчера я съел{а} столько блинов! Весна уже близко.'],
    },
  },
  // ---- часть 2 П.13: занятия — features/holidays_summer.js (1 Мая, Иван Купала, Хеллоуин) и features/holidays_bday.js
  {
    id: 'mayday',
    name: '1 Мая',
    short: '1 Мая',
    icon: '🎈',
    month: 4,
    dom: 1,
    decor: [-1, 0],
    story: 'Праздник весны и труда! Город в флажках, шариках и цветах. Субботник: посади цветы на трёх пустых клумбах — они будут цвести всё лето, а потом — весёлый парад с шариками через парк!',
    steps: [
      { id: 'plant', text: 'Субботник: посади цветы на трёх клумбах', n: 3, hint: 'Пустые клумбы с табличкой «Субботник» — на площади и в парке', where: 'maybed' },
      { id: 'parade', text: 'Пройди парадом с шариками через парк', hint: 'Тележка с шариками — в парке, у входа с площади', where: 'place:balloons' },
    ],
    gift: { clothes: 'wreath_may' },
    more: [{ clothes: 'dress_may' }, { clothes: 'balloon_red' }],
    sticker: 'x_hol_mayday',
    lines: {
      eve: ['Завтра — 1 Мая! Будет субботник, а потом парад с шариками!', 'Я уже надул{а} три шарика. Хочешь один?', 'Видела, сколько флажков на улицах? Завтра праздник!'],
      day: ['С праздником весны, {name}! Пойдём сажать цветы?', 'Мир, труд, май! А потом — шарики!', 'После субботника город станет ещё красивее!'],
      after: ['Вчерашние цветы на клумбах уже распустились!'],
    },
  },
  {
    id: 'kupala',
    name: 'Иван Купала',
    short: 'Купала',
    icon: '🌿',
    month: 6,
    dom: 1,
    decor: [-1, 0],
    story: 'Самый длинный летний день! На пляже — купальский костёр, на дверях — цветочные венки. Сплети венок и пусти его по воде, а потом — весёлая «Водяная битва»!',
    steps: [
      { id: 'wreath', text: 'Сплети венок и пусти его по воде', hint: 'Корзинка с цветами — на пляже, у самой воды', where: 'place:wreathfloat' },
      { id: 'splash', text: 'Сыграй в «Водяную битву» на пляже', hint: 'Вёдра и водяные пистолеты — на пляже, у костра', where: 'place:splash', on: 'minigame', if: { id: 'splash' } },
    ],
    gift: { clothes: 'water_pistol' },
    more: [{ clothes: 'wreath_fern' }, { clothes: 'dress_linen' }],
    sticker: 'x_hol_kupala',
    lines: {
      eve: ['Завтра Иван Купала! Я уже собрал{а} цветы для венка.', 'Говорят, на пляже сложат большой костёр!', 'Завтра всех обольют водой — так полагается! Ха-ха!'],
      day: ['С Иваном Купалой, {name}! Пускай твой венок уплывёт далеко-далеко!', 'Осторожно, обрызгаю! Сегодня можно!', 'Вечером костёр на пляже будет светить до самой ночи!'],
      after: ['Мой венок вчера уплыл к самому горизонту!', 'Вчера все-все были мокрые после водяной битвы! Ха-ха!'],
    },
  },
  {
    id: 'halloween',
    name: 'Хеллоуин',
    short: 'Хеллоуин',
    icon: '🎃',
    month: 9,
    dom: 3,
    decor: [-1, 0],
    story: 'Город в тыквах-фонариках и паутинках, жители в костюмах, а в парке живут добрые привидения из простыней! Вырежи тыкву-фонарик в парке, а вечером обойди домики: «Сладость или гадость?» — хозяева в костюмах ждут у дверей с конфетами.',
    steps: [
      { id: 'carve', text: 'Вырежи тыкву-фонарик', hint: 'Столик с тыквами — в парке, у входа с площади', where: 'place:pumpkins' },
      { id: 'treats', text: 'Вечером: «Сладость или гадость?» у трёх домиков', n: 3, hint: 'Вечером, с 16:00 до 22:00, хозяева в костюмах ждут у своих дверей — подойди к двери или к хозяину', where: 'door' },
    ],
    gift: { clothes: ['hat_witch', 'cape_violet'] },
    more: [{ clothes: 'hat_pumpkin' }, { clothes: 'wings_bat' }],
    sticker: 'x_hol_halloween',
    lines: {
      eve: ['Завтра Хеллоуин! Я буду нарядной тыковкой!', 'Видела привидений в парке? Они из простыней и совсем не страшные!', 'Завтра вечером приходи ко мне — у меня есть конфеты!'],
      day: ['Сладость или гадость? Шучу — держи улыбку, {name}!', 'Какая у тебя будет тыква? Весёлая или хитрая?', 'Вечером загляни ко мне — угощу конфетами!'],
      after: ['Вчера я съел{а} столько конфет! Ням!', 'Тыквы-фонарики светили всю ночь. Красота!'],
    },
  },
  {
    // «Год в городе» (этап 10, Пр14; раньше здесь был день рождения хомячка — id остался: он лежит в сохранениях).
    // Новая игра начинается 1 июня — в этот день хомячок приехала в Ореховую Гавань. Праздник — годовщина приезда:
    // 1 июня, впервые — через игровой год (since), дальше каждый год. Празднуют в основном доме (туда ведёт «Домой»).
    // Игры до этапа 10 начинались 1 января: им праздник тоже приходит 1 июня, когда игре исполнился год.
    id: 'birthday',
    name: 'Год в городе',
    short: 'Год в городе',
    icon: '🎉',
    month: 5,
    dom: 1,
    since: 36,
    decor: [0, 0],
    story:
      'Ровно год назад ты приехала в Ореховую Гавань с одним чемоданом! Дома — шарики, а друзья придут в гости сами, с подарками. Будь дома, встречай гостей и задуй свечи на торте!',
    steps: [
      { id: 'guests', text: 'Встреть гостей у себя дома', n: 3, hint: 'Будь дома (кнопка «Домой»): с 11:00 друзья придут сами, с подарками', where: 'home' },
      { id: 'cake', text: 'Задуй свечи на праздничном торте', hint: 'Когда гости соберутся — торт на столе! Или поговори с гостем', where: 'home' },
    ],
    gift: { clothes: 'badge_nut' },
    more: [{ clothes: 'hat_acorn' }, { clothes: 'scarf_harbor' }],
    giftText: 'подарки от друзей',
    sticker: 'x_hol_birthday',
    // что дарят друзья, когда приходят (несут в лапках коробочку): блюдо, продукт или семена — в рюкзак,
    // money — монеты (HOLIDAY.bday.money); box — цвет коробочки и ленты
    presents: {
      plusha: { dish: 'pancakes', n: 2, say: 'Я испекла тебе блинчики — целую стопку!', box: ['#ff8fab', '#fff'] },
      ponchik: { dish: 'donut', n: 2, say: 'Пончики! Самые пышные — для самой лучшей соседки!', box: ['#ffd43b', '#e8590c'] },
      senya: { money: true, say: 'Держи монетки — купи себе что-нибудь весёлое!', box: ['#74c0fc', '#ffd43b'] },
      busya: { dish: 'icecream', n: 1, say: 'Мороженое с бантиком! Ну, почти с бантиком.', box: ['#da77f2', '#fff'] },
      prof: { ing: 'nuts', n: 3, say: 'Орешки! Научный факт: в Ореховой Гавани это лучший подарок.', box: ['#b08968', '#ffe8cc'] },
      myata: { seed: 'seed_strawberry', n: 3, say: 'Рассада клубники — посади, и будет сладкое лето!', box: ['#69db7c', '#fff'] },
      bob: { money: true, say: 'Монетка из дальних морей, юнга! На счастье!', box: ['#4dabf7', '#fff'] },
      zefirka: { dish: 'coco_candy', n: 2, say: 'Кокосовые конфетки! Я их сама заворачивала!', box: ['#ffc9de', '#ff6b9d'] },
    },
    lines: {
      eve: [],
      day: [
        'С праздником, {name}! Целый год ты с нами в Ореховой Гавани!',
        'Я уже приготовил{а} тебе подарок! Скоро приду в гости!',
        'Помнишь, как ты приехала с одним чемоданом? А теперь ты — наша!',
      ],
      after: ['Вчера был такой весёлый праздник! Ещё год вместе — ура!'],
    },
  },
];
export const HOLIDAY_BY_ID = Object.fromEntries(HOLIDAYS.map((h) => [h.id, h]));

/**
 * Праздничные наряды жителей города (этап 15, Пр4, Пр20): в сам праздник жители весь день ходят в них — поверх своей
 * одежды: { житель: { слот: id вещи | null — снять } }. Рисуются так же, как одежда хомячка (art/hamster.js), кадры —
 * в кэше спрайтов (ключ кадра знает праздник). Внешность в наряде — npcLook(id, праздник) в data/looks.js; какой наряд
 * сегодня — npcDress() в core/state.js. Вещи берутся из каталога одежды (data/clothes.js) — новых рисунков не нужно.
 */
export const HOLIDAY_DRESS = {
  // колпаки и тёплые шарфы
  newyear: {
    plusha: { head: 'hat_santa', acc: 'scarf_pink' },
    ponchik: { head: 'hat_santa' },
    senya: { head: 'beanie_red', acc: 'scarf_yellow' },
    busya: { head: 'earmuffs_snow', acc: 'scarf_pink' },
    prof: { head: 'hat_santa' },
    myata: { head: 'hat_santa', body: 'sw_snow' },
    bob: { head: 'hat_santa' },
    zefirka: { head: 'hat_santa', acc: 'scarf_yellow' },
  },
  // звёздочки на ободках и крылья ангела
  xmas: {
    plusha: { head: 'starband_gold' },
    ponchik: { head: 'beanie_red', acc: 'scarf_yellow' },
    senya: { head: 'beanie_blue' },
    busya: { head: 'starband_gold', acc: 'wings_angel' },
    prof: { acc: 'scarf_blue' },
    myata: { head: 'starband_gold' },
    bob: { acc: 'scarf_yellow' },
    zefirka: { head: 'starband_gold', acc: 'wings_angel' },
  },
  // красное — на удачу
  cny: {
    plusha: { body: 'dress_qipao', acc: 'fan_red' },
    ponchik: { body: 'overall_red', head: 'hat_dragon' },
    senya: { body: 'overall_red' },
    busya: { body: 'dress_qipao', head: null, acc: 'fan_red' },
    prof: { head: 'beret_red', acc: 'tie_red' },
    myata: { body: 'dress_red', head: 'hair_flower' },
    bob: { head: 'cap_red', acc: 'tie_red' },
    zefirka: { body: 'dress_qipao', head: 'hat_dragon' },
  },
  // кокошники и расписные платки
  maslenitsa: {
    plusha: { head: 'kokoshnik_red', acc: 'shawl_rose' },
    ponchik: { head: 'beanie_red', acc: 'scarf_yellow' },
    senya: { acc: 'scarf_pink' },
    busya: { head: 'kokoshnik_red', acc: 'shawl_rose' },
    prof: { acc: 'scarf_yellow' },
    myata: { head: 'kokoshnik_red' },
    bob: { acc: 'scarf_yellow' },
    zefirka: { head: 'kokoshnik_red', acc: 'shawl_rose' },
  },
  // майские венки, колпачки и шарики
  mayday: {
    plusha: { head: 'wreath_may', acc: 'balloon_red' },
    ponchik: { head: 'hat_party', acc: 'balloon_red' },
    senya: { head: 'hat_party' },
    busya: { head: 'wreath_may' },
    prof: { acc: 'balloon_red' },
    myata: { head: 'wreath_may', body: 'dress_may' },
    bob: { head: 'hat_party' },
    zefirka: { head: 'wreath_may', acc: 'balloon_red' },
  },
  // венки из цветов и вышитые сарафаны
  kupala: {
    plusha: { head: 'wreath_fern', body: 'dress_linen' },
    ponchik: { head: 'wreath' },
    senya: { head: 'wreath_fern' },
    busya: { head: 'wreath', body: 'dress_flowers' },
    prof: { head: 'wreath' },
    myata: { head: 'wreath_fern', body: 'dress_linen' },
    bob: { head: 'wreath' },
    zefirka: { head: 'wreath', body: 'dress_daisy' },
  },
  // костюмы: волшебница, тыковка, супергерой, фея, кошечка, пират, летучая мышка
  halloween: {
    plusha: { head: 'hat_witch', acc: 'cape_violet' },
    ponchik: { head: 'hat_pumpkin' },
    senya: { acc: 'cape_red', head: 'cap_red' },
    busya: { head: 'crown', body: 'princess_fairy', acc: 'wings' },
    prof: { head: 'hat_witch', acc: 'cape_violet' },
    myata: { head: 'catears', acc: null },
    bob: { head: 'hat_pirate' },
    zefirka: { head: 'catears', acc: 'wings_bat' },
  },
  // «Год в городе»: праздничные колпачки
  birthday: {
    plusha: { head: 'hat_party' },
    ponchik: { head: 'hat_party' },
    senya: { head: 'hat_party' },
    busya: { head: 'hat_party' },
    prof: { head: 'hat_party' },
    myata: { head: 'hat_party' },
    bob: { head: 'hat_party' },
    zefirka: { head: 'hat_party' },
  },
};
/**
 * Праздничная полка в ТЦ «Уютный дом» (этап 15, Пр13): за FEST_SHELF[0] дней до праздника и по FEST_SHELF[1] — украшения
 * к нему (мебель с shop: 'fest' и полем fest — data/furniture.js). festShelfOn(день, начало игры) — id праздника или null.
 */
export const FEST_SHELF = [-2, 0];
export function festShelfOn(day, start = 0) {
  const h = HOLIDAYS.find((q) => {
    const k = holidayOffset(q, day);
    return k >= FEST_SHELF[0] && k <= FEST_SHELF[1] && holidayLive(q, day - k, start) && HOLIDAY_DRESS[q.id] && q.id !== 'birthday';
  });
  return h ? h.id : null;
}
/** Праздничный наряд жителя id в праздник hid: { слот: вещь } или null (наряда нет). */
export const holidayDress = (hid, id) => (hid && HOLIDAY_DRESS[hid] && HOLIDAY_DRESS[hid][id]) || null;

/** Дней в году (36: 12 месяцев по 3 дня). */
export const YEAR_DAYS = 36;
/** Год игры (с 1) по номеру дня. */
export const yearOfDay = (day) => Math.floor(day / YEAR_DAYS) + 1;
/** День года праздника (0 — 1 января). */
export const holidayDoy = (h) => h.month * 3 + h.dom - 1;
const doyOf = (day) => ((day % YEAR_DAYS) + YEAR_DAYS) % YEAR_DAYS;
/**
 * Празднуют ли h в день day. start — с какого дня началась игра (state.startDay): праздник с полем since приходит,
 * только когда игре уже столько дней («Год в городе» — через год после приезда).
 */
export const holidayLive = (h, day, start = 0) => !h.since || day - start >= h.since;

/** Праздник в этот день (или null). start — день начала игры. */
export function holidayOn(day, start = 0) {
  const d = doyOf(day);
  return HOLIDAYS.find((h) => holidayDoy(h) === d && holidayLive(h, day, start)) || null;
}
/**
 * Сколько дней от праздника h до дня day: 0 — праздник, −1 — накануне, 1 — на следующий день. Считается по кругу года
 * (новогодняя ёлка 1 января — это «+1» от 3 декабря прошлого года). Возвращает число от −18 до 17.
 */
export function holidayOffset(h, day) {
  let k = doyOf(day) - holidayDoy(h);
  if (k > YEAR_DAYS / 2 - 1) k -= YEAR_DAYS;
  if (k < -YEAR_DAYS / 2) k += YEAR_DAYS;
  return k;
}
/** Украшен ли город к празднику h в этот день. */
export const decorOn = (h, day, start = 0) => {
  const k = holidayOffset(h, day);
  return k >= h.decor[0] && k <= h.decor[1] && holidayLive(h, day - k, start);
};
/** Какие праздники украшают город в этот день: [{ h, k }] — k — день от праздника (−1 накануне, 0 — праздник). */
export const decorsOn = (day, start = 0) => HOLIDAYS.filter((h) => decorOn(h, day, start)).map((h) => ({ h, k: holidayOffset(h, day) }));
/** Через сколько дней (с сегодняшнего, сегодня — 0) праздник h будет в следующий раз. */
export function daysToHoliday(h, day, start = 0) {
  let days = (holidayDoy(h) - doyOf(day) + YEAR_DAYS) % YEAR_DAYS;
  while (!holidayLive(h, day + days, start)) days += YEAR_DAYS; // «Год в городе» в первый год ещё не празднуют
  return days;
}
/** Ближайший праздник с сегодняшнего дня (сегодня — тоже): { h, days } — через сколько дней. */
export function nextHoliday(day, start = 0) {
  let best = null;
  for (const h of HOLIDAYS) {
    const days = daysToHoliday(h, day, start);
    if (!best || days < best.days) best = { h, days };
  }
  return best;
}
/** Год, к которому относится праздник в этот день (новогодняя ночь 3 декабря — год, который заканчивается). */
export const holidayYear = (day) => yearOfDay(day);
/** Подарки праздника по порядку: первого раза и следующих лет (каждый год — первая вещь, которой ещё нет). */
export const holidayGifts = (h) => [h.gift, ...(h.more || [])].filter(Boolean);
/** Подставить имя хомячка в реплику и «-а» для жительниц: «купил{а}». */
export const holidayLine = (text, name, fem) => text.replace(/\{name\}/g, name).replace(/\{а\}/g, fem ? 'а' : '');

// ---------- праздничные сценки: сколько шагов (правила — features/holidays_*.js, рисунок — holidays_scenes_art.js) ----------
/** Торт на день рождения: столько свечек, задуть за BLOWS раз (по две свечки). */
export const CANDLES = 6,
  BLOWS = 3;
/** Иван Купала: столько цветов вплести в венок, потом — пустить его по воде. */
export const FLOWERS = 6;
/** Хеллоуин: шаги вырезания тыквы — по кнопке на шаг. */
export const CARVE = ['👀 Вырезать глазик', '👀 И второй глазик', '🔺 Носик', '😁 Весёлая улыбка', '🕯️ Зажечь свечку'];
/** Китайский Новый год: столько небесных фонариков запустить. */
export const LANTERNS = 3;

/**
 * Праздники шире площади (этап 15, Пр4): где и когда жители города празднуют вместе — locations/holidays_crowd.js
 * (клетки города; часы — с from до to; kind и поля — там же, в начале файла). В эти часы житель — на празднике
 * (npcPlace в core/queries.js: дома его нет), а при kind 'doors' — у своей двери (встречает гостей).
 */
export const HOLIDAY_GATHER = {
  newyear: [
    { from: 11, to: 16, kind: 'skate', c: [40.5, 38.6], r: [3.1, 1.25], speed: 0.42, where: 'каток в парке' },
    { from: 17, to: 22, kind: 'ring', c: [44.5, 23.15], r: [2.45, 1.15], speed: 0.3, where: 'хоровод у ёлки' },
  ],
  xmas: [
    {
      from: 11,
      to: 15,
      kind: 'crowd',
      c: [54, 23],
      spots: [
        [52.4, 24.6],
        [55.6, 24.2],
        [53.3, 25.5],
        [54.8, 25.7],
        [51.3, 23.9],
        [56.8, 23.6],
        [51.9, 25.8],
        [56.6, 25.4],
      ],
      where: 'у вертепа',
    },
    { from: 16, to: 22, kind: 'doors', where: 'у своих дверей' },
  ],
  cny: [
    {
      from: 11,
      to: 18,
      kind: 'dance',
      c: [45.5, 23.3],
      spots: [
        [42.9, 25.3],
        [44.3, 25.7],
        [47.6, 25.6],
        [49.1, 25.2],
        [50.3, 24.4],
        [41.7, 24.5],
        [48.6, 21.6],
        [42.5, 21.5],
      ],
      where: 'танцуют у дракона',
    },
  ],
  maslenitsa: [
    {
      from: 11,
      to: 17,
      kind: 'crowd',
      c: [50, 24],
      spots: [
        [42.6, 24.6],
        [47.4, 24.4],
        [57.8, 26.1],
        [61.7, 26.4],
        [49.6, 25.7],
        [53.6, 25.9],
        [56.3, 24.1],
        [47.2, 22.3],
      ],
      where: 'на ярмарке',
    },
  ],
  mayday: [{ from: 10, to: 14, kind: 'parade', c: [40.5, 38.5], r: [6, 5], speed: 0.16, where: 'парад вокруг пруда' }],
  kupala: [{ from: 18, to: 22, kind: 'ring', c: [49.5, 53.3], r: [2.7, 1.3], speed: 0.34, where: 'хоровод у костра' }],
  halloween: [{ from: 16, to: 22, kind: 'doors', where: 'у своих дверей' }],
};
/** Что сейчас по таблице HOLIDAY_GATHER для праздника hid в minutes (минуты от полуночи) — строка или null. */
export function gatherOn(hid, minutes) {
  const h = minutes / 60;
  return (hid && (HOLIDAY_GATHER[hid] || []).find((g) => h >= g.from && h < g.to)) || null;
}
