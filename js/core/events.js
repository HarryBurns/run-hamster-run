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
  estate: 'куплено жильё или заведение, сменился основной дом, изменились настройки заведения',
  // --- то, что считают ежедневные задания (features/mail.js) и будущий журнал заданий ---
  minigame: 'сыграна мини-игра { id, stars }',
  buy: 'покупка { cat, id }',
  sell: 'продано на рынке { id, n, sum }',
  cook: 'приготовлено блюдо { dish, perfect }',
  eat: 'хомячок что-то съел',
  treat: 'гостя угостили дома { id }',
  gift: 'жителя угостили в городе { id }',
  talk: 'поговорили с жителем { id }',
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
  feed: 'покормили рыбок',
  coconut: 'стрясли кокос',
  pearl: 'найдена жемчужина',
  dive: 'нырнули под воду',
  boat: 'сели на кораблик',
  piano: 'сыграли песенку на пианино',
  thing: 'потрогали особую вещь в доме { id, owner } — штурвал, глобус, лейку, штангу…',
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
