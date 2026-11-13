// Все таблицы игры одним импортом: import { CLOTHES, NPCS, … } from '../data/index.js'.
// Правило: файлы в data/ — только таблицы (и крошечные чистые функции над ними в looks.js);
// они не импортируют ничего, кроме друг друга. Имена (id) не переименовывать: на них ссылаются сохранения.
export * from './calendar.js';
export * from './economy.js';
export * from './clothes.js';
export * from './beauty.js';
export * from './furniture.js';
export * from './food.js';
export * from './npcs.js';
export * from './places.js';
export * from './tasks.js';
export * from './fashion.js';
export * from './looks.js';
