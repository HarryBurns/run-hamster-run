// Отладочный режим: игра открыта на своём компьютере (localhost) или с ?dev в адресе. Только тогда ставятся
// отладочные хуки — window.__dev (js/devhooks.js), крючки мини-игр для автотеста (canvas.__x) и пробные сцены
// (demo_meadow, demo_house). В выложенной игре их нет.
const loc = typeof location !== 'undefined' ? location : null;
export const DEV =
  !!loc && (['localhost', '127.0.0.1', '[::1]'].includes(loc.hostname) || new URLSearchParams(loc.search).has('dev'));
