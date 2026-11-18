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
//   npc          житель, который открывает место (id из data/npcs.js; лифтёр Этажкин — тоже там, в LAND_NPCS)
//   who          кто знает дорогу — словами, для подсказки («Мята из парка»)
//   quest        задание-открытие (id из data/quests.js) — обязательно: окно закрытого входа говорит по нему
//   door         первая фраза у закрытого входа («Тропа в лес заросла.»); у мест без входа из города — null
//   from         откуда туда попадают: 'world' (из города), 'forest', 'mountain', 'sea' — для подсказок
//   at           где вход — словами (для окна «Место открыто!»)
//   scene, entry СЦЕНА МЕСТА И ТОЧКА ВХОДА (обязательно).
//                Как у леса: scene: 'forest', entry: 'gate' — тропа из города ведёт туда сама (выход forest
//                в locations/town.js и действие way:forest берут сцену отсюда). Гора будет так же: вход — станция
//                канатной дороги в лесу (действие way:mountain), впиши scene и entry — и она повезёт на гору.
//                Пещеры — так же: вход — скала у вершины горы (место caves, way:caves), сцена caves.
//   opened       «открыт» в нужном роде для окна «Задание выполнено!» («Гора открыта!», «Пещеры открыты!»)
//   go           своё действие вместо простого перехода (гора: 'cableway:up' — вагончик едет вверх, features/mountain.js;
//                пустыня: 'caravan:go' — караван-автобус едет в пески, features/desert.js; джунгли: 'voyage:go' —
//                кораблик плывёт к причалу в джунглях, features/jungle.js; секретный пляж: 'grotto:go' — заплыв через
//                подводный грот, features/cove.js; удалённый остров: 'faraway:go' — долгое плавание на юг, features/island.js)
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
  // нижний ярус пещер (П4, этап 17в): верёвочная лестница в люке шахты Камушкина (место ladder в locations/caves.js,
  // действие way:deep) ведёт к подземной реке; открывает задание Камушкина «Счастливая кирка»
  {
    id: 'deep', name: 'Подземная река', icon: '🛶', npc: 'kamushkin', who: 'Шахтёр Камушкин', quest: 'lucky_pick', opened: 'открыта',
    door: 'Под люком в полу шахты шумит вода. Верёвочная лестница свёрнута и привязана — без разрешения шахтёра вниз не спуститься.',
    from: 'caves', at: 'в пещерах, в шахте Камушкина: люк с верёвочной лестницей вниз',
    scene: 'deep', entry: 'ladder', // сцена — locations/deep.js, вход ladder — под лестницей
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
  // секретный пляж: подводный грот в скалах на востоке моря (отметка — буёк-ракушка и круги на воде, WORLD_SEA.grotto
  // в locations/sea.js); нырнула там — картинка-переезд (go: grotto:go — features/cove.js) через грот на пляж в бухте;
  // обратно — нырнуть в гроте на пляже, всплываешь у буйка
  {
    id: 'cove', name: 'Секретный пляж', icon: '🐢', opened: 'открыт', npc: 'zefirka', who: 'Зефирка с пляжа', quest: 'treasure_map',
    door: 'Под водой у скал темнеет проход в подводный грот — но без карты в нём легко заплутать.', from: 'sea',
    at: 'в море, у скал с буйком-ракушкой на востоке: подплыви к кругам на воде и нырни',
    scene: 'cove', entry: 'grotto', go: 'grotto:go', // сцена — locations/cove.js, вход grotto — у грота на пляже
  },
  // удалённый остров: далеко на юге моря, за последними буйками, — отметка «🧭 Далеко на юг» (WORLD_SEA.far
  // в locations/sea.js); кораблик подплыл к ней — картинка-переезд подольше (go: faraway:go — features/island.js)
  // привозит к причалу острова; обратно — с причала на острове к пирсу города
  {
    id: 'island', name: 'Удалённый остров', icon: '🌋', opened: 'открыт', npc: 'etazhkin', who: 'Лифтёр Этажкин из Хомяк-Тауэра', quest: 'far_island',
    door: 'Дальше — только открытый океан. Без компаса в нём не найти дорогу.', from: 'sea',
    at: 'далеко на юге моря: плыви на кораблике за последние буйки, к отметке «🧭 Далеко на юг»',
    scene: 'island', entry: 'pier', go: 'faraway:go', // сцена — locations/island.js, вход pier — у причала на острове
  },
];
export const LAND_BY_ID = Object.fromEntries(LANDS.map((l) => [l.id, l]));

// ---------- карта мира (этап 11): как места соединены между собой ----------
// ROUTES — граф переходов: место (имя сцены) → { соседнее место: «через что» }. «Через что» — имя точки для
// sc.whereIs / sc.walkToPlace в ЭТОМ месте: особое место или здание (звёздочка встаёт у его двери — где дверь,
// знает само здание), 'exit:<выход>' — выход из локации (поле exits), 'sea:<место>' — морской путь (его знает
// море, locations/sea.js: пока хомячок на берегу — к кораблику, на кораблике — к причалу, буйку или отметке).
// По графу строится дорога из любого места в любое (routeTo): звёздочка задания, праздника и письма в месте,
// где цели нет, показывает на выход в нужную сторону (sc.wayTo, engine/topdown/scene.js), окно «Карта» — в каком
// месте цель. Новое место — строка в LANDS и две строчки здесь (туда и обратно).
export const HOME_SCENE = 'world'; // город: отсюда начинаются все дороги
export const HOME_LAND = { id: HOME_SCENE, name: 'Город', icon: '🏡' };
export const ROUTES = {
  world: { forest: 'forest', desert: 'desert', jungle: 'sea:jungle', cove: 'sea:cove', island: 'sea:island' },
  forest: { world: 'exit:town', mountain: 'station' },
  mountain: { forest: 'station', caves: 'caves' },
  caves: { mountain: 'exit:mountain', deep: 'ladder' },
  deep: { caves: 'ladder' },
  desert: { world: 'stop' },
  jungle: { world: 'dock' },
  cove: { world: 'grotto' },
  island: { world: 'dock' },
};
// как называется дорога — для подсказок («Дорога — по канатной дороге»): место → соседнее → слова
export const ROUTE_WORDS = {
  world: {
    forest: 'по тропе в лес',
    desert: 'на караване-автобусе',
    jungle: 'на кораблике от пирса — к причалу с пальмами за буйками',
    cove: 'на кораблике от пирса — к буйку-ракушке на востоке моря',
    island: 'на кораблике от пирса — далеко на юг, к отметке 🧭',
  },
  forest: { world: 'по тропе в город', mountain: 'по канатной дороге' },
  mountain: { forest: 'по канатной дороге вниз', caves: 'через тёмный проход в скале' },
  caves: { mountain: 'к выходу на гору', deep: 'по верёвочной лестнице в люке шахты Камушкина' },
  deep: { caves: 'по верёвочной лестнице наверх, в шахту' },
  desert: { world: 'на караване-автобусе' },
  jungle: { world: 'на кораблике от причала' },
  cove: { world: 'через подводный грот' },
  island: { world: 'на кораблике от причала' },
};
/** Место по имени сцены: запись из LANDS или город. */
export const landOf = (scene) => (scene === HOME_SCENE ? HOME_LAND : LAND_BY_ID[scene] || null);
/**
 * Дорога из места from в место to (имена сцен) по графу ROUTES. open(id) — открыто ли тайное место (в закрытое
 * дорога не ведёт). Вернёт { next, via, path } — следующее место, через что туда идти отсюда и весь путь
 * [from, …, to]; null — уже на месте или дороги нет.
 */
export function routeTo(from, to, open = () => true) {
  if (from === to || !ROUTES[from] || !ROUTES[to]) return null;
  const prev = { [from]: null },
    queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    if (cur === to) break;
    for (const nx of Object.keys(ROUTES[cur])) {
      if (nx in prev || (nx !== HOME_SCENE && !open(nx))) continue;
      prev[nx] = cur;
      queue.push(nx);
    }
  }
  if (!(to in prev)) return null;
  const path = [to];
  while (prev[path[0]]) path.unshift(prev[path[0]]);
  return { next: path[1], via: ROUTES[from][path[1]], path };
}
