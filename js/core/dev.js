// Отладочный режим: игра открыта на своём компьютере (localhost) или с ?dev в адресе. Только тогда ставятся
// отладочные хуки — window.__dev (js/devhooks.js), крючки мини-игр для автотеста (canvas.__x) и пробные сцены
// (demo_meadow, demo_house). В выложенной игре их нет.
const loc = typeof location !== 'undefined' ? location : null;
export const DEV =
  !!loc && (['localhost', '127.0.0.1', '[::1]'].includes(loc.hostname) || new URLSearchParams(loc.search).has('dev'));
/**
 * Только для автотеста (__dev.fastGames, js/devhooks.js): во сколько раз быстрее идёт время мини-игр. 1 — как обычно;
 * больше — цикл кадра мини-игры (minigames/kit.js: loop) делает за кадр столько шагов обычной длины, поэтому игра
 * та же самая (те же шаги, столкновения и звёзды), только короче по настоящему времени. Вне DEV не читается.
 */
export const devGames = { speed: 1 };
/**
 * Подсказки вверху (ui/toast.js) для автотеста: fast — как раньше, 2,6 с на любую и сквозь них можно нажимать, чтобы
 * шаги не ждали долгого показа и нажатия по канве под подсказкой доходили. dev/smoke.js включает до загрузки страницы
 * (window.__fastToasts); __dev.fastToasts(false) — как у игрока: по длине текста. Вне DEV не читается.
 */
export const devToasts = { fast: DEV && !!globalThis.__fastToasts };
