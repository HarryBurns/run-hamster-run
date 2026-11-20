// ЖИВОЙ ШВЕЙЦАР у входа в курортный отель «Морская звезда» (этап 16, От3) — «часть» локации города (parts).
// Раньше швейцар был нарисован прямо на здании и не шевелился. Теперь он стоит у двери отдельно: дышит и моргает
// (готовые кадры из кэша спрайтов — кадр не дорожает), подошла — машет лапкой и кланяется, над ним облачко
// «Добро пожаловать!»; нажатие или клавиша E рядом — поздороваться (действие hotel:doorman, features/hotel.js).
// Он не житель города (в счёт жителей «ночью на улице» и «день гостей» не входит) — у него нет дома и дружбы.
import { G, darkness } from '../core/state.js';
import { run } from '../core/registry.js';
import { sfx } from '../core/audio.js';
import { dist, readSec } from '../core/util.js';
import { drawHamster, blinkAt } from '../art/hamster.js';
import { T, put, label, defineArt } from '../engine/topdown/index.js';
import { DOORMAN } from './town_buildings.js';

/** Кадры швейцара: 0 — стоит, 1 — моргнул, 2 — поклон, 3 — машет лапкой. */
defineArt({
  doorman: [
    [-44, -78, 44, 10],
    (ctx, f) => {
      if (f === 2) ctx.rotate(0.14);
      drawHamster(ctx, 0, 0, 0.56, DOORMAN, {
        dir: f === 3 ? 0 : 1,
        time: 0.4,
        blink: f === 1 ? 1 : 0,
        happy: f >= 2,
        armsUp: f === 3,
      });
    },
  ],
});
const HELLO = ['Добро пожаловать в «Морскую звезду»!', 'Рады вас видеть!', 'Прошу, проходите!'];

/**
 * Швейцар у двери здания bid: слева от входа, у столбика навеса — между кадкой и красной дорожкой, чтобы кадка
 * его не закрывала (В16; раньше стоял на 82 точки левее середины — наполовину за кадкой). Здороваться к нему подходят
 * спереди-слева (STAND), там свободная плитка.
 */
const DX = -52,
  STAND = [-14, 44];
export function createDoorman(bid = 'hotel') {
  let pos = null,
    greetT = -99,
    near = false,
    hello = HELLO[0];
  const say = () => (darkness() > 0.5 ? 'Доброй ночи! Тсс… гости спят 🌙' : hello);
  return {
    built(sc) {
      const b = sc.map.bById[bid];
      if (b) pos = { x: (b.x + b.w / 2) * T + DX, y: (b.y + b.h) * T + 2 };
    },
    /** Подошла — машет и кланяется (один раз, пока не отойдёт подальше). */
    update(sc) {
      if (!pos) return;
      const d = dist(sc.p.x, sc.p.y, pos.x, pos.y);
      if (d < T * 2.6 && !near) {
        near = true;
        greetT = G.time;
        hello = HELLO[Math.floor(G.time) % HELLO.length];
      } else if (d > T * 4) near = false;
    },
    things(sc, add, v) {
      if (!pos || pos.x < v.x0 - 60 || pos.x > v.x1 + 60 || pos.y < v.y0 || pos.y > v.y1 + 90) return;
      add(pos.y, (ctx, _v, t) => {
        const k = t - greetT,
          f = k < 1.6 ? 3 : k < 2.6 ? 2 : blinkAt(t, 2) > 0.4 ? 1 : 0,
          breath = f < 2 && Math.sin(t * 2.2) > 0.3 ? -1 : 0; // дышит: шаг спрайта в пиксель
        put('doorman', pos.x, pos.y + breath, f);
      });
    },
    over(ctx, sc, t) {
      if (pos && t - greetT < readSec(say())) label(ctx, say(), pos.x, pos.y - 70, 240, 13, '#fffbe6');
    },
    /** Нажали на швейцара — подойти и поздороваться. */
    tap(sc, w) {
      if (!pos || dist(w.x, w.y, pos.x, pos.y - 28) > 32) return false;
      sc.goNear(pos.x + STAND[0], pos.y + STAND[1], { fn: () => run('hotel:doorman') });
      sfx('tap');
      return true;
    },
    /** Клавиша E рядом со швейцаром. */
    near(sc) {
      if (!pos) return null;
      const d = dist(sc.p.x, sc.p.y, pos.x + STAND[0], pos.y + STAND[1]);
      return d < T * 1.2 ? { d, pending: { fn: () => run('hotel:doorman') } } : null;
    },
    /** Для тестов: где швейцар и когда он здоровался. */
    debugDoorman: () => (pos ? { ...pos, greetT, waving: G.time - greetT < 1.6 } : null),
  };
}
