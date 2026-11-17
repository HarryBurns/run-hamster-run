// Календарь: месяцы, сезоны, длина месяца. Когда что поспевает — data/seasons.js.
export const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
export const SEASON_OF_MONTH = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'];
export const SEASONS = {
  winter: { name: 'Зима', icon: '❄️', when: 'зимой' },
  spring: { name: 'Весна', icon: '🌸', when: 'весной' },
  summer: { name: 'Лето', icon: '☀️', when: 'летом' },
  autumn: { name: 'Осень', icon: '🍂', when: 'осенью' },
};
export const DAYS_PER_MONTH = 3;
/**
 * День, с которого начинается новая игра: 1 июня (этап 10) — лето, море тёплое, всё цветёт. День игры считается
 * от 1 января (день 0), поэтому в сохранении лежит startDay — с какого дня началась эта игра (у старых игр — 0).
 */
export const START_DAY = 5 * DAYS_PER_MONTH;
/** Месяц (0–11) по номеру игрового дня. */
export const monthOfDay = (day) => Math.floor(day / DAYS_PER_MONTH) % 12;
