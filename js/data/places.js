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
//                Лес готов → впиши scene: 'forest', entry: '<вход>' — тропа из города поведёт туда сама
//                (выход forest в locations/town.js и действие way:forest берут сцену отсюда).
//   ready        что сказать у открытого входа, пока сцены нет
export const LANDS = [
  {
    id: 'forest', name: 'Лес', icon: '🌲', npc: 'myata', who: 'Мята из парка', quest: 'herbarium',
    door: 'Тропа в лес заросла.', from: 'world', at: 'за виллой, на северо-западе города',
    scene: null, entry: null,
    ready: 'Лес открыт! Лесник Шишкин ещё готовит домик к гостям — загляни чуть позже 🌲',
  },
  {
    id: 'desert', name: 'Пустыня', icon: '🐫', npc: 'busya', who: 'Буся из ТЦ «Модный»', quest: null,
    door: 'Автобус к барханам пока не ходит.', from: 'world', at: 'на восточной окраине, у остановки каравана', scene: null, entry: null,
  },
  { id: 'mountain', name: 'Гора', icon: '⛰️', npc: 'senya', who: 'Сеня из бассейна', quest: null, door: null, from: 'forest', scene: null, entry: null },
  { id: 'caves', name: 'Пещеры', icon: '💎', npc: 'prof', who: 'Профессор Орешкин из школы', quest: null, door: null, from: 'mountain', scene: null, entry: null },
  { id: 'jungle', name: 'Джунгли', icon: '🦜', npc: 'bob', who: 'Капитан Боб с пирса', quest: null, door: null, from: 'sea', scene: null, entry: null },
  { id: 'cove', name: 'Секретный пляж', icon: '🐢', npc: 'zefirka', who: 'Зефирка с пляжа', quest: null, door: null, from: 'sea', scene: null, entry: null },
  { id: 'island', name: 'Удалённый остров', icon: '🌋', npc: null, who: 'Лифтёр Этажкин из Хомяк-Тауэра', quest: null, door: null, from: 'sea', scene: null, entry: null },
];
export const LAND_BY_ID = Object.fromEntries(LANDS.map((l) => [l.id, l]));
