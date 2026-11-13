// Жители: друзья-хомячки, их реплики, продавцы.
const lk = (fur, o = {}) => ({ fur, spots: null, ear: '#ffb3c1', outfit: {}, beauty: { blush: '#ffb0bd' }, ...o });
export const NPCS = [
  {
    id: 'plusha', name: 'Плюша', fem: true, fav: 'pancakes', house: 0, hang: 'park',
    about: 'Добрая и мечтательная. Обожает блинчики.',
    look: lk('#f2b34c', { belly: '#fff3d6', mask: '#fff3d6', outfit: { body: 'dress_mint' }, beauty: { blush: '#ffb0bd', bow: '#ff5c8a', lashes: true } }),
    lines: ['Какие сегодня красивые облака! Вон то похоже на семечку.', 'Я вчера испекла сто блинчиков. И все съела. Ой.', 'Заходи ко мне в гости… хотя нет, лучше я к тебе, у тебя же бассейн!', 'Знаешь, о чём я мечтаю? О блинчике размером с луну.'],
  },
  {
    id: 'ponchik', name: 'Пончик', fem: false, fav: 'pizza', house: 1, hang: 'cafe',
    about: 'Главный обжора города. За пиццу готов на всё.',
    look: lk('#e88b3a', { belly: '#ffe8cc', outfit: { body: 'tee_stripe', head: 'cap_blue' } }),
    lines: ['Я не толстый, я пушистый. И немножко пицца.', 'В кафе «Семечка» новые пончики. Я проверил шесть раз.', 'Говорят, у тебя на кухне огромная плита? Уважаю.', 'Мой рекорд — тридцать семечек за одну щёку!'],
  },
  {
    id: 'senya', name: 'Сеня', fem: false, fav: 'fish_soup', house: 2, hang: 'pool',
    about: 'Чемпион по плаванию. Любит уху и соревнования.',
    look: lk('#b9bcc6', { belly: '#f1f3f5', outfit: { body: 'tee_star', legs: 'shorts_red', acc: 'medal' }, beauty: { tuft: 1, hair: '#868e96', blush: '#ffb0bd' } }),
    lines: ['Раз-два, раз-два! Тренируюсь даже во сне.', 'Приходи в бассейн, посмотрим, кто быстрее!', 'Секрет чемпиона: много спать и много плавать.', 'Я переплыл бы море, но мама зовёт обедать.'],
  },
  {
    id: 'busya', name: 'Буся', fem: true, fav: 'icecream', house: 3, hang: 'mall',
    about: 'Модница. Знает всё о нарядах и обожает мороженое.',
    look: lk('#f6dfb8', { belly: '#fffaf0', outfit: { body: 'dress_stars', head: 'sunhat', acc: 'bag_pink', feet: 'sand_pink' }, beauty: { lashes: true, blush: '#ff6b9d', nails: '#e64980' } }),
    lines: ['Шляпа — это не просто шляпа. Это настроение!', 'В Доме моды сегодня показ. Ты ведь придёшь?', 'Розовый с жёлтым? Смело. Мне нравится!', 'У меня сорок платьев. Нужно ещё хотя бы одно.'],
  },
  {
    id: 'prof', name: 'Профессор Орешкин', fem: false, fav: 'cookies', house: 4, hang: 'school',
    about: 'Учитель. Знает ответ на любой вопрос, кроме «где мои очки».',
    look: lk('#a8703f', { belly: '#f6dfb8', mask: '#f6dfb8', outfit: { body: 'sw_cream', acc: 'glasses_black', head: 'tophat' } }),
    lines: ['А ты знала, что хомяки могут бежать всю ночь? Я вот не могу.', 'Дважды два — четыре. А дважды орешек — два орешка!', 'Детям в школе очень нужна хорошая учительница.', 'Где же мои очки?.. Ах, на носу.'],
  },
  {
    id: 'myata', name: 'Мята', fem: true, fav: 'carrot_cake', house: 5, hang: 'park',
    about: 'Садовница. Разговаривает с цветами, и они ей отвечают.',
    look: lk('#d8d2c4', { belly: '#fff', outfit: { body: 'sw_green', head: 'wreath' }, beauty: { blush: '#ffa94d', lashes: true } }),
    lines: ['Морковка любит, когда ей поют. Проверено!', 'Посади что-нибудь на своих грядках — и через пару дней будет урожай.', 'Клубника растёт два дня, тыква — целых три.', 'Тс-с… слышишь? Это ромашки шепчутся.'],
  },
  {
    id: 'bob', name: 'Капитан Боб', fem: false, fav: 'sushi', house: 6, hang: 'pier',
    about: 'Старый моряк. Рыбачит на пирсе и рассказывает истории.',
    look: lk('#7a5230', { belly: '#e6c9a8', mask: '#e6c9a8', outfit: { body: 'tee_stripe', head: 'cap_red', acc: 'scarf_blue' } }),
    lines: ['Однажды я поймал рыбу размером с небоскрёб. Честное моряцкое!', 'Рыба лучше всего клюёт с конца пирса. И в твоём пруду тоже.', 'Йо-хо-хо и корзинка семечек!', 'Море сегодня доброе. Как я после обеда.'],
  },
  {
    id: 'zefirka', name: 'Зефирка', fem: true, fav: 'choco_cake', house: 7, hang: 'beach',
    about: 'Самая маленькая в городе. Всё время задаёт вопросы.',
    look: lk('#fff0f6', { belly: '#fff', outfit: { body: 'tee_dots', legs: 'skirt_blue' }, beauty: { blush: '#ff6b9d', bow: '#b197fc', tuft: 4, hair: '#faa2c1' } }),
    small: true,
    lines: ['А почему море солёное? А небо синее? А ты пятнистая?', 'Когда я вырасту, у меня тоже будет вилла! И пони!', 'Я умею считать до ста. Один, два, сто!', 'А правда, что у тебя миллиард? А это больше, чем сто?'],
  },
];
export const NPC_BY_ID = Object.fromEntries(NPCS.map((n) => [n.id, n]));

// Что говорят друзья про погоду и одежду
export const SEASON_LINES = {
  winter: ['Бр-р, ну и морозец! Зато снежок хрустит.', 'Пруд у тебя во дворе замёрз? По нему можно кататься!'],
  spring: ['Весна! Всё цветёт, даже мой хвостик.', 'Слышишь? Птички вернулись.'],
  summer: ['Жарко! Самое время купаться в море.', 'Летом мороженое тает быстрее, чем я его ем.'],
  autumn: ['Листья шуршат — обожаю осень!', 'Осенью главное — резиновые сапожки и лужи.'],
};
export const OUTFIT_LINES = {
  cold: ['Ты не замёрзла? Зима же! Надень куртку и шапку.', 'Бр-р! В таком наряде зимой? Смелая!'],
  hot: ['Тебе не жарко в куртке? Лето на дворе!', 'Ух, в такой одежде летом можно растаять!'],
  swim: ['Ого, прямо в купальнике по городу? Стильно!'],
  fancy: ['Какой наряд! Ты сегодня просто звезда!', 'Вот это красота! Можно с тобой сфотографироваться?'],
};

// Продавцы (внешность)
export const VENDORS = {
  mall: { name: 'Продавщица Лапка', look: lk('#f6dfb8', { belly: '#fff', outfit: { body: 'dress_red', acc: 'neck_pearl' }, beauty: { lashes: true, blush: '#ff6b9d', tuft: 2, hair: '#a8703f' } }) },
  home: { name: 'Мастер Винтик', look: lk('#b9bcc6', { belly: '#f1f3f5', outfit: { body: 'sw_orange', head: 'cap_yellow' } }) },
  food: { name: 'Тётушка Крупа', look: lk('#e88b3a', { belly: '#ffe8cc', outfit: { body: 'dress_check' }, beauty: { blush: '#ff6b9d', tuft: 3, hair: '#f6dfb8' } }) },
  boutique: { name: 'Мадам Жужу', look: lk('#fff', { spots: '#b197fc', outfit: { body: 'dress_evening', head: 'tophat', acc: 'neck_heart' }, beauty: { lashes: true, blush: '#ff6b9d', nails: '#e64980' } }) },
  salon: { name: 'Стилист Кудряш', look: lk('#f2b34c', { belly: '#fff3d6', outfit: { body: 'js_lilac', acc: 'glasses_red' }, beauty: { tuft: 3, hair: '#ff6b9d', blush: '#ffb0bd' } }) },
  cafe: { name: 'Бариста Зёрнышко', look: lk('#a8703f', { belly: '#f6dfb8', outfit: { body: 'tee_orange', acc: 'bowtie' } }) },
  rest: { name: 'Шеф Трюфель', look: lk('#f6dfb8', { belly: '#fff', outfit: { body: 'robe' }, beauty: { blush: '#ffa94d' } }) },
  beach: { name: 'Спасатель Волна', look: lk('#e88b3a', { belly: '#ffe8cc', outfit: { body: 'swim_blue', acc: 'sung_yellow', head: 'panama_white' } }) },
  pool: { name: 'Тренер Брызг', look: lk('#b9bcc6', { belly: '#f1f3f5', outfit: { body: 'tee_sun', legs: 'shorts_red', head: 'cap_red' } }) },
  school: { name: 'Директор Буковка', look: lk('#f6dfb8', { belly: '#fff', outfit: { body: 'sw_pink', acc: 'glasses_red' }, beauty: { blush: '#ffb0bd', tuft: 3, hair: '#868e96', lashes: true } }) },
  hospital: { name: 'Медсестра Ромашка', look: lk('#fff', { outfit: { body: 'robe', head: 'panama_white' }, beauty: { blush: '#ffb0bd', lashes: true } }) },
  fashion: { name: 'Модельер Пуговка', look: lk('#e88b3a', { belly: '#ffe8cc', outfit: { body: 'dress_evening', acc: 'sung_pink', head: 'sunhat' }, beauty: { blush: '#ff6b9d', lashes: true, nails: '#845ef7' } }) },
  tower: { name: 'Лифтёр Этажкин', look: lk('#a8703f', { belly: '#f6dfb8', outfit: { body: 'ja_wine', head: 'cap_blue' } }) },
  bank: { name: 'Банкир Монеткин', look: lk('#b9bcc6', { belly: '#f1f3f5', outfit: { body: 'pajama', acc: 'bowtie', head: 'tophat' } }) },
};
