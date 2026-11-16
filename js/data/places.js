// Места города: названия для писем и карты.
export const PLACES = {
  mall_fashion: 'ТЦ «Модный»', mall_home: 'ТЦ «Уютный дом»', mall_food: 'ТЦ «Вкусный»',
  boutique: 'Бутик «Бантик»', salon: 'Салон красоты', pool: 'Городской бассейн', school: 'Школа',
  hospital: 'Больница', rest: 'Ресторан «Золотой орешек»', cafe: 'Кафе «Семечка»', beachcafe: 'Пляжное кафе',
  fashion: 'Дом моды', tower: 'Хомяк-Тауэр', bank: 'Хомяк-Банк', pier: 'Пирс', villa: 'Вилла',
  market: 'Рынок на площади', park: 'Парк', hotel: 'Отель «Морская звезда»', realtor: 'Агентство «Свой домик»',
  home_apartment: 'Жилой дом (квартира)', home_bungalow: 'Пляжное бунгало',
  // домики жителей (id зданий в городе)
  house0: 'Домик Плюши', house1: 'Домик Пончика', house2: 'Домик Сени', house3: 'Домик Буси',
  house4: 'Домик Профессора Орешкина', house5: 'Домик Мяты', house6: 'Домик Капитана Боба', house7: 'Домик Зефирки',
  homes: 'Домики друзей',
};

// ---------- новые места (этап 5, П.9): кто их открывает ----------
// Каждое место закрыто, пока не сделано его задание-открытие (data/quests.js, награда open). Открыто ли место,
// лежит в сохранении (state.lands: id → день открытия; читать — landOpen(id) в core/state.js, открывает действие
// openLand). Вход в место из города — действие 'way:<id>' (features/quests.js): закрыто — доброе окно с
// подсказкой, кто знает дорогу; открыто — переход в сцену места.
//   name, icon   как место называется и его значок (на карте — силуэт с замочком, пока закрыто)
//   npc          житель, который открывает место (id из data/npcs.js; лифтёр — не житель, у него null)
//   who          кто знает дорогу — словами, для подсказки («Мята из парка»)
//   quest        задание-открытие (id из data/quests.js) или null — задание ещё не придумано
//   door         первая фраза у закрытого входа («Тропа в лес заросла.»); у мест без входа из города — null
//   from         откуда туда попадают: 'world' (из города), 'forest', 'mountain', 'sea' — для подсказок
//   at           где вход — словами (для окна «Место открыто!»)
//   scene, entry СЦЕНА МЕСТА И ТОЧКА ВХОДА. Пока сцены нет (null), у открытого места окно ready.
//                Как у леса: scene: 'forest', entry: 'gate' — тропа из города ведёт туда сама (выход forest
//                в locations/town.js и действие way:forest берут сцену отсюда). Гора будет так же: вход — станция
//                канатной дороги в лесу (действие way:mountain), впиши scene и entry — и она повезёт на гору.
//                Пещеры — так же: вход — скала у вершины горы (место caves, way:caves), сцена caves.
//   ready        что сказать у открытого входа, пока сцены нет
//   opened       «открыт» в нужном роде для окна «Задание выполнено!» («Гора открыта!», «Пещеры открыты!»)
//   go           своё действие вместо простого перехода (гора: 'cableway:up' — вагончик едет вверх, features/mountain.js;
//                пустыня: 'caravan:go' — караван-автобус едет в пески, features/desert.js; джунгли: 'voyage:go' —
//                кораблик плывёт к причалу в джунглях, features/jungle.js)
export const LANDS = [
  {
    id: 'forest', name: 'Лес', icon: '🌲', npc: 'myata', who: 'Мята из парка', quest: 'herbarium',
    door: 'Тропа в лес заросла.', from: 'world', at: 'за виллой, на северо-западе города',
    scene: 'forest', entry: 'gate', // сцена — locations/forest.js, вход gate — у ворот на южной опушке
  },
  // пустыня: остановка каравана на восточной окраине (особое место desert и выход за шлагбаум в locations/town.js);
  // караван-автобус везёт туда картинкой (go: caravan:go — features/desert.js), обратно — с остановки в пустыне
  {
    id: 'desert', name: 'Пустыня', icon: '🐫', opened: 'открыта', npc: 'busya', who: 'Буся из ТЦ «Модный»', quest: 'runway_star',
    door: 'Караван-автобус к барханам пока не ходит.', from: 'world', at: 'на восточной окраине, у остановки каравана',
    scene: 'desert', entry: 'stop', go: 'caravan:go', // сцена — locations/desert.js, вход stop — у остановки в пустыне
  },
  // вход на гору — из леса, станция канатной дороги (здание station в locations/forest.js, действие way:mountain)
  {
    id: 'mountain', name: 'Гора', icon: '⛰️', npc: 'senya', who: 'Сеня из бассейна', quest: 'summit',
    door: 'Канатная дорога на гору пока не работает.', from: 'forest', at: 'в лесу, у станции канатной дороги',
    scene: 'mountain', entry: 'station', go: 'cableway:up', opened: 'открыта', // сцена — locations/mountain.js, вход — у верхней станции
  },
  // вход в пещеры — на горе: тёмный проход в скале (особое место caves в locations/mountain.js, действие way:caves)
  {
    id: 'caves', name: 'Пещеры', icon: '💎', npc: 'prof', who: 'Профессор Орешкин из школы', quest: 'cave_light',
    door: 'Тёмный проход в скале заколочен досками.', from: 'mountain', at: 'на горе, в скале у вершины', opened: 'открыты',
    scene: 'caves', entry: 'gate', // сцена — locations/caves.js, вход gate — у выхода к свету
  },
  // джунгли: причал за буйками на юге моря (остров с причалом — WORLD_SEA.port в locations/sea.js); кораблик подходит
  // к причалу — и картинка-переезд (go: voyage:go — features/jungle.js) привозит к причалу в джунглях; обратно —
  // с причала в джунглях к пирсу города
  {
    id: 'jungle', name: 'Джунгли', icon: '🦜', opened: 'открыты', npc: 'bob', who: 'Капитан Боб с пирса', quest: 'cabin_boy',
    door: 'У причала за буйками висит табличка: «Без капитана не швартоваться!»', from: 'sea',
    at: 'за буйками, на юге моря: доплыви на кораблике от пирса до причала с пальмами',
    scene: 'jungle', entry: 'pier', go: 'voyage:go', // сцена — locations/jungle.js, вход pier — у причала в джунглях
  },
  { id: 'cove', name: 'Секретный пляж', icon: '🐢', npc: 'zefirka', who: 'Зефирка с пляжа', quest: null, door: null, from: 'sea', scene: null, entry: null },
  { id: 'island', name: 'Удалённый остров', icon: '🌋', npc: null, who: 'Лифтёр Этажкин из Хомяк-Тауэра', quest: null, door: null, from: 'sea', scene: null, entry: null },
];
export const LAND_BY_ID = Object.fromEntries(LANDS.map((l) => [l.id, l]));
