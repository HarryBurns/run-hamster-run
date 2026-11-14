// Рамка для мини-игр: заставка с правилами → игра → экран со звёздами.
//
// Каждая мини-игра — модуль с `export default { id, title, icon, howTo, start(host) }`.
// start(host) строит игру внутри host.root и возвращает { stop() } — остановить таймеры/анимации.
// Когда игра закончена, она вызывает host.finish({ stars: 1..3, text: 'итог', extra: {...} }).
import { drawHamster } from '../art/hamster.js';
import { sfx } from '../core/audio.js';
import { el } from '../core/util.js';

const LOADERS = {
  swim: () => import('./swim.js'),
  fishing: () => import('./fishing.js'),
  teacher: () => import('./teacher.js'),
  doctor: () => import('./doctor.js'),
  chef: () => import('./chef.js'),
  fashion: () => import('./fashion.js'),
  barista: () => import('./barista.js'),
  stylist: () => import('./stylist.js'),
  window: () => import('./window.js'),
};
/** Есть ли такая мини-игра. */
export const hasMinigame = (id) => !!LOADERS[id];

/** Подгрузить модули мини-игр заранее: тогда пропавшая сеть не помешает их открыть. */
export function preloadMinigames() {
  for (const load of Object.values(LOADERS))
    load().catch(() => {
      /* попробуем ещё раз при открытии */
    });
}

/**
 * @param id    id мини-игры
 * @param info  { look, name, friends:[{name, look}], season, level, ...что угодно для игры }
 *              introNote — HTML под правилами на заставке (например, сколько заплатят за работу);
 *              resultNote(stars) — HTML под итогом на экране результата (сколько заработано)
 * @returns Promise<{stars, text, extra} | null>  (null — игрок закрыл игру)
 */
export async function runMinigame(id, info) {
  const mod = (await LOADERS[id]()).default;
  return new Promise((resolve) => {
    const wrap = el('div');
    wrap.id = 'mg';
    const head = el('div', 'mg-head', `<span>${mod.icon || '🎮'}</span><span class="title">${mod.title}</span>`);
    const close = el('button', 'xbtn', '✕');
    head.appendChild(close);
    const root = el('div', 'mg-root');
    wrap.append(head, root);
    document.body.appendChild(wrap);

    let game = null,
      ended = false,
      result = null; // итог игры: есть с момента, когда показан экран со звёздами
    const cleanup = () => {
      try {
        game && game.stop && game.stop();
      } catch (e) {
        console.error(e);
      }
      game = null;
    };
    const end = (res) => {
      if (ended) return;
      ended = true;
      cleanup();
      wrap.remove();
      resolve(res);
    };
    close.onclick = () => {
      sfx('tap');
      end(result); // крестик на экране со звёздами — то же, что «Ура!»: результат (и зарплата) не пропадают
    };

    const card = (html, btnText, onBtn) => {
      const c = el('div', 'mg-card');
      const p = el('div', 'panel narrow', html);
      const b = el('button', 'btn big green', btnText);
      b.onclick = () => {
        sfx('tap');
        c.remove();
        onBtn();
      };
      p.appendChild(b);
      c.appendChild(p);
      root.appendChild(c);
    };

    const host = {
      root,
      look: info.look,
      name: info.name || 'Хомячок',
      friends: info.friends || [],
      season: info.season || 'summer',
      level: info.level || 0,
      info,
      drawHamster,
      sfx,
      /** Canvas на весь root, сам подстраивается под размер. draw-код работает в CSS-пикселях: cv.w × cv.h */
      canvas() {
        const canvas = document.createElement('canvas');
        canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;touch-action:none';
        root.appendChild(canvas);
        const cv = { canvas, ctx: canvas.getContext('2d'), w: 0, h: 0, dpr: 1 };
        const fit = () => {
          const r = root.getBoundingClientRect();
          cv.dpr = Math.min(window.devicePixelRatio || 1, 2);
          cv.w = Math.max(1, r.width);
          cv.h = Math.max(1, r.height);
          canvas.width = Math.round(cv.w * cv.dpr);
          canvas.height = Math.round(cv.h * cv.dpr);
          cv.ctx.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0);
        };
        fit();
        const ro = new ResizeObserver(fit);
        ro.observe(root);
        cv.destroy = () => ro.disconnect();
        return cv;
      },
      finish(res) {
        if (ended) return;
        cleanup();
        const stars = Math.max(1, Math.min(3, Math.round(res.stars || 1)));
        sfx(stars === 3 ? 'win' : 'ok');
        const st = [1, 2, 3].map((i) => `<span class="${i <= stars ? '' : 'off'}">⭐</span>`).join('');
        const head2 = ['', 'Хорошо!', 'Здорово!', 'Великолепно!'][stars];
        result = { ...res, stars };
        const note = info.resultNote ? info.resultNote(stars) || '' : '';
        card(
          `<div class="stars">${st}</div><h2 style="margin:4px 0">${head2}</h2><p>${res.text || ''}</p>${note}`,
          'Ура!',
          () => end(result),
        );
      },
    };

    card(
      `<div class="big-emoji">${mod.icon || '🎮'}</div><h2 style="margin:4px 0">${mod.title}</h2><p>${mod.howTo || ''}</p>${info.introNote || ''}`,
      'Начать!',
      () => {
        try {
          game = mod.start(host) || null;
        } catch (e) {
          console.error(e);
          end(null);
        }
      },
    );
  });
}
