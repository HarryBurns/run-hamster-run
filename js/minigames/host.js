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
};

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
      ended = false;
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
      end(null);
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
        card(
          `<div class="stars">${st}</div><h2 style="margin:4px 0">${head2}</h2><p>${res.text || ''}</p>`,
          'Ура!',
          () => end({ ...res, stars }),
        );
      },
    };

    card(
      `<div class="big-emoji">${mod.icon || '🎮'}</div><h2 style="margin:4px 0">${mod.title}</h2><p>${mod.howTo || ''}</p>`,
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
