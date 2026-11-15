// Мини-игра «Бариста»: гость заказывает напиток с добавками и десерт — собери поднос, пока он ждёт.
// Ход игры общий с «Стилистом» и «Витриной» — orders.js; здесь только меню.
// Меню зависит от кафе: host.info.biz === 'beachcafe' — пляжное (лимонад, мороженое), иначе — кафе «Семечка».
import { shuffle, pick } from '../core/util.js';
import { orderGame, ORDERS } from './orders.js';

const MENUS = {
  cafe: {
    drink: [
      { k: 'coffee', e: '☕', name: 'Кофе' },
      { k: 'cocoa', e: '🍫', name: 'Какао' },
      { k: 'tea', e: '🍵', name: 'Чай' },
      { k: 'milk', e: '🥛', name: 'Молоко' },
    ],
    add: [
      { k: 'cream', e: '🍦', name: 'Сливки' },
      { k: 'honey', e: '🍯', name: 'Мёд' },
      { k: 'berry', e: '🍓', name: 'Клубника' },
      { k: 'nut', e: '🌰', name: 'Орешки' },
    ],
    sweet: [
      { k: 'donut', e: '🍩', name: 'Пончик' },
      { k: 'croissant', e: '🥐', name: 'Круассан' },
      { k: 'cookie', e: '🍪', name: 'Печенье' },
      { k: 'cake', e: '🍰', name: 'Тортик' },
    ],
    bg: 'linear-gradient(#fff0f6 0,#fff0f6 56%,#e8b98a 56%,#d9a066 100%)',
  },
  beachcafe: {
    drink: [
      { k: 'lemonade', e: '🍹', name: 'Лимонад' },
      { k: 'shake', e: '🥤', name: 'Коктейль' },
      { k: 'juice', e: '🧃', name: 'Сок' },
      { k: 'coco', e: '🥥', name: 'Кокос' },
    ],
    add: [
      { k: 'ice', e: '🧊', name: 'Лёд' },
      { k: 'lemon', e: '🍋', name: 'Лимон' },
      { k: 'berry', e: '🍓', name: 'Клубника' },
      { k: 'cherry', e: '🍒', name: 'Вишенка' },
    ],
    sweet: [
      { k: 'icecream', e: '🍨', name: 'Мороженое' },
      { k: 'melon', e: '🍉', name: 'Арбуз' },
      { k: 'sorbet', e: '🍧', name: 'Сорбет' },
      { k: 'candy', e: '🍡', name: 'Конфеты' },
    ],
    bg: 'linear-gradient(#e3fafc 0,#e3fafc 56%,#ffe8a1 56%,#ffd97a 100%)',
  },
};

export default {
  id: 'barista',
  title: 'Бариста',
  icon: '☕',
  howTo:
    'Гость показывает заказ: <b>напиток</b>, <b>добавки</b> и <b>десерт</b>. Нажимай на полках то, что он просит, — и поднос соберётся. Успей, пока у гостя не кончилось терпение (розовая полоска)!',

  start(host) {
    const menu = MENUS[host.info && host.info.biz === 'beachcafe' ? 'beachcafe' : 'cafe'];
    /** Сколько добавок в заказе: сначала одна, дальше — две (на высоком уровне — сразу две). */
    const addsIn = (i, level) => (level >= 2 || i >= 3 ? 2 : i >= 1 || level >= 1 ? 1 + (i % 2) : 1);
    return orderGame(host, {
      bg: menu.bg,
      shelves: [
        { id: 'drink', label: 'Напиток', items: menu.drink },
        { id: 'add', label: 'Добавка', items: menu.add },
        { id: 'sweet', label: 'Десерт', items: menu.sweet },
      ],
      order: (i, level) => [
        pick(menu.drink).k,
        ...shuffle(menu.add)
          .slice(0, addsIn(i, level))
          .map((q) => q.k),
        pick(menu.sweet).k,
      ],
      ask: ['«Мне, пожалуйста, вот это!»', '«Можно мне такое?»', '«Хочу вот так!»', '«Как обычно, пожалуйста!»'],
      serve: 'Собери заказ на поднос!',
      doneAll: 'Все заказы — быстро и без единой ошибки! Лучшая бариста в городе!',
      doneSome: (n) => `Все ${ORDERS} гостей довольны! Быстро и без ошибок: ${n}.`,
    });
  },
};
