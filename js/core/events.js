// События игры. Один модуль сообщает «случилось то-то», другие на это подписаны и друг о друге не знают.
//
//   const off = on('money', () => …);   // подписаться; off() — отписаться
//   emit('buy', { cat: 'food' });       // сообщить
//   const sub = scope(); sub.on('guests', …); … sub.off();   // пачка подписок, которую снимают разом
//
// Сцена подписывается в enter() и отписывается в leave() (удобнее всего через scope()).
// Все имена событий перечислены в EVENTS: опечатка в имени — сразу ошибка, а не тихо не работающая подписка.

export const EVENTS = {
  // --- интерфейс и цикл ---
  hud: 'пора обновить HUD (плашки и кнопки)',
  money: 'изменилось число монет { delta, source } — delta > 0 заработано, < 0 потрачено',
  look: 'изменилась внешность или наряд хомячка',
  sticker: 'получена наклейка { id, isNew, delay, quiet }',
  scene: 'сменилась сцена { name, from }',
  step: 'шаг логики, мир не на паузе { dt }',
  // --- дом ---
  guests: 'изменился список гостей',
  guestHappy: 'гостя угостили { id }',
  happy: 'хомячок радуется (вкусно поела и т. п.)',
  wake: 'наступило утро: хомячок просыпается в своей кровати',
  place: 'мебель поставили из кладовки { id }',
  friend: 'выросли сердечки дружбы { id, before, after } (core/actions.js, addFriendPts) — награды выдаёт features/friends.js',
  estate: 'куплено жильё или заведение, сменился основной дом, изменились настройки заведения',
  health: 'хомячок простыла или выздоровела { sick, cause, how } (features/health.js)',
  // --- сюжетные задания (features/quests.js) ---
  quest: 'задание из журнала взяли, оно продвинулось или выполнено { id, done }',
  land: 'открылось новое место { id } (data/places.js, LANDS)',
  tale: 'хомячок рассказала жителю о том, что видела { id, npc } (features/tales.js)',
  // --- то, что считают ежедневные задания (features/mail.js) и сюжетные задания (features/quests.js) ---
  minigame: 'сыграна мини-игра { id, stars }',
  relax: 'хомячок присела отдохнуть на скамейку, лежак, качели… { how: sit | lie | swing | hammock | slide, type } (features/relax.js)',
  buy: 'покупка { cat, id }',
  sell: 'продано на рынке { id, n, sum }',
  cook: 'приготовлено блюдо { dish, perfect }',
  eat: 'хомячок что-то съела { id } — блюдо (у сырого продукта — ing)',
  treat: 'гостя угостили дома { id }',
  gift: 'жителя угостили в городе { id, dish }',
  talk: 'поговорили с жителем { id }',
  invite: 'позвали жителя в гости по телефону { id }',
  plant: 'посажены семена',
  harvest: 'собран урожай',
  salon: 'сделали что-то в салоне красоты',
  visit: 'побывали в особом месте { place } — tower; в гостях: home, home_<житель>, tea (чай), stars (телескоп)',
  wheel: 'побегали в колесе',
  skate: 'покатались на льду',
  swim: 'зашли в воду { where: pool | sea }',
  homeswim: 'поплавали в домашнем бассейне',
  spa: 'ванна, сауна или джакузи { what }',
  collect: 'подобран предмет задания',
  find: 'подобрана находка в локации { loc, id }',
  feed: 'покормили рыбок',
  coconut: 'стрясли кокос',
  gather: 'собрали плоды с дерева или куста, нашли гриб { id, n }',
  pearl: 'найдена жемчужина',
  dive: 'нырнули под воду',
  boat: 'сели на кораблик',
  piano: 'сыграли песенку на пианино',
  thing: 'потрогали особую вещь в доме { id, owner } — штурвал, глобус, лейку, штангу…',
  wear: 'надели или сняли вещь { slot, id } (id = null — сняли)',
  herb: 'сорвали находку для гербария { id } (locations/common/herbs.js)',
  mountain:
    'занятие на горе { what } — spring (горячий источник), edelweiss (сорвали эдельвейс), summit (смотровая площадка), snowman (слепили снеговика), frame (эдельвейс в рамке), mitten (нашли варежку) — features/mountain.js',
  caves:
    'занятие в пещерах { what } — shroom (сорвали светящийся гриб), paint (древние рисунки), bats (вспугнули летучих мышей), lake (подземное озеро), pick (нашли кирку Камушкина), geode (шкатулка самоцветов), lamp (грибной ночник) — features/caves.js',
  deep:
    'нижний ярус пещер { what } — ride (проплыли вниз по подземной реке), back (вернулись на лодочке обратно) — locations/deep.js (этап 17в)',
  desert:
    'занятие в пустыне { what } — ride (прокатились на верблюде), mirage (подошли к миражу), wish (загадали желание), bell (нашли бубенчик), fossils (коллекция окаменелостей), oasis (оазис) — features/desert.js',
  jungle:
    'занятие в джунглях { what } — fall (искупались под водопадом), parrot (попугай заговорил), feather (попугай уронил перо), teach (попугая научили слову { i, id }), bridge (перешли подвесной мост), notebook (нашли дневник Лианы), frame (перья в рамке), canoe (доплыли на лодочке-пироге до водопада) — features/jungle.js, locations/jungle.js',
  cove:
    'секретный пляж { what } — piece (нашли кусочек карты Зефирки, поле id: tower | ship | isle), turtles (черепашата доплыли до моря), glow (ночью вошла в светящуюся воду), shell (подобрали ракушку), frame (ракушки в рамке), treasure (выкопали клад) — features/cove.js, locations/cove.js',
  island:
    'удалённый остров { what } — spot (нашли остров в подзорную трубу), volcano (посмотрела на вулкан), obsidian (взяла вулканическое стекло), flower (подобрала цветок для леи), dance (потанцевала на празднике огней), lei (Вождь сплёл лею), totem (Вождь вырезал тотем), lagoon (зашла в тёплую лагуну), erupt (увидела «доброе извержение») — features/island.js, locations/island.js',
  hotel:
    'курортный отель «Морская звезда» { what } — room (сняла номер), night (проснулась в номере), buffet (поела у шведского стола), spa (массаж или маска), dance (зарядка или дискотека с аниматором; поле kind: morning | evening), slide (скатилась с горки), doorman (поздоровалась со швейцаром) — features/hotel.js',
  holiday:
    'праздник (П.13) { id, what } — what: шаг праздника (tree, gifts, crib, carols, lanterns, envelopes, cook, treat, tug), done (все занятия дня сделаны), dragon, carousel, effigy, blini — features/holidays.js, features/holidays_winter.js',
  warmup: 'хомячок согрелась (горячий источник на горе): мороза за день как не бывало — features/health.js',
  pet: 'питомец (этап 17б) { what } — adopt (взяли из приюта, поле kind), name (дали имя), pet / feed / play (погладили, покормили, поиграли; gain — очки дружбы), good (купили корм или мячик), stay (ждёт дома или гуляет)',
  wheels: 'транспорт (этап 17б) { what, id } — buy (купили), use (выбрали, на чём ездить), on / off (сели, слезли)',
  yard: 'двор (этап 17б) { what, yard, id } — buy (купили предмет), place / move / stash (поставили, переставили, убрали в сарайчик)',
  forest: 'занятие в лесу { what } — hive (мёд), squirrel (обмен у белки), fire (жарили зефир), treehouse (домик на дереве), wreath (венок), kit (нашли бельчонка), kitHome (отнесли маме) — features/forest.js',
};

const listeners = new Map(); // имя → Set функций

function check(ev) {
  if (!(ev in EVENTS)) throw new Error(`Неизвестное событие «${ev}» — добавь его в EVENTS (js/core/events.js)`);
}

/** Подписаться на событие. Возвращает функцию отписки. */
export function on(ev, fn) {
  check(ev);
  let set = listeners.get(ev);
  if (!set) listeners.set(ev, (set = new Set()));
  set.add(fn);
  return () => set.delete(fn);
}

/** Сообщить о событии. Ошибка в одном подписчике не мешает остальным. */
export function emit(ev, data) {
  check(ev);
  const set = listeners.get(ev);
  if (!set) return;
  for (const fn of [...set]) {
    try {
      fn(data || {});
    } catch (e) {
      console.error(e);
    }
  }
}

/** Пачка подписок с общей отпиской: sub.on(…) сколько угодно раз, потом sub.off(). */
export function scope() {
  const offs = [];
  return {
    on(ev, fn) {
      offs.push(on(ev, fn));
    },
    off() {
      while (offs.length) offs.pop()();
    },
  };
}

/** Для тестов: сколько подписчиков у события. */
export const listenerCount = (ev) => (listeners.get(ev) ? listeners.get(ev).size : 0);
