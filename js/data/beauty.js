// Салон красоты: что можно поменять во внешности. Цены — PRICES.beauty (economy.js).
import { PRICES } from './economy.js';

const P = PRICES.beauty;
export const BEAUTY = {
  tuft: { name: 'Причёска', icon: '💇', price: P.tuft, options: [
    { v: 0, name: 'Гладкая' }, { v: 1, name: 'Хохолок' }, { v: 2, name: 'Чёлка' },
    { v: 3, name: 'Кудряшки' }, { v: 4, name: 'Хвостики' }, { v: 5, name: 'Ирокез' }] },
  hair: { name: 'Цвет причёски', icon: '🎨', price: P.hair, options: [
    { v: null, name: 'Свой', c: '#2f2a2a' }, { v: '#ff6b9d', name: 'Розовый', c: '#ff6b9d' }, { v: '#845ef7', name: 'Фиолетовый', c: '#845ef7' },
    { v: '#4dabf7', name: 'Голубой', c: '#4dabf7' }, { v: '#ffd43b', name: 'Золотой', c: '#ffd43b' }, { v: '#ff922b', name: 'Рыжий', c: '#ff922b' },
    { v: '#20c997', name: 'Бирюзовый', c: '#20c997' }] },
  lashes: { name: 'Реснички', icon: '👁️', price: P.lashes, options: [{ v: false, name: 'Без ресничек' }, { v: true, name: 'Пушистые' }] },
  blush: { name: 'Румянец', icon: '☺️', price: P.blush, options: [
    { v: '#ffb0bd', name: 'Нежный', c: '#ffb0bd' }, { v: '#ff6b9d', name: 'Яркий', c: '#ff6b9d' },
    { v: '#ffa94d', name: 'Персик', c: '#ffa94d' }, { v: null, name: 'Без румянца', c: '#eee' }] },
  nails: { name: 'Маникюр', icon: '💅', price: P.nails, options: [
    { v: null, name: 'Без лака', c: '#eee' }, { v: '#e64980', name: 'Малина', c: '#e64980' }, { v: '#845ef7', name: 'Сирень', c: '#845ef7' },
    { v: '#ffd43b', name: 'Золото', c: '#ffd43b' }, { v: '#20c997', name: 'Мята', c: '#20c997' }, { v: '#f03e3e', name: 'Красный', c: '#f03e3e' }] },
  bow: { name: 'Бантик', icon: '🎀', price: P.bow, options: [
    { v: null, name: 'Без бантика', c: '#eee' }, { v: '#ff5c8a', name: 'Розовый', c: '#ff5c8a' }, { v: '#4dabf7', name: 'Голубой', c: '#4dabf7' },
    { v: '#ffd43b', name: 'Жёлтый', c: '#ffd43b' }, { v: '#b197fc', name: 'Сиреневый', c: '#b197fc' }, { v: '#f03e3e', name: 'Красный', c: '#f03e3e' }] },
};
