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
