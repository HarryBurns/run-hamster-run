// Альбом: наклейки, друзья, рекорды. Здесь же — подсказка о новой наклейке.
import { makeCanvas, text as ctext } from '../core/draw.js';
import { on } from '../core/events.js';
import { G, friendHearts } from '../core/state.js';
import { el } from '../core/util.js';
import { drawPortrait } from '../art/hamster.js';
import { DISH_BY_ID, NPCS, npcLook, TASKS, EXTRA_STICKERS } from '../data/index.js';
import { openPanel } from '../ui/panel.js';
import { toast } from '../ui/toast.js';
import { MG_NAMES } from './minigames.js';

const S = () => G.state;

export function openAlbum() {
  openPanel({
    title: 'Альбом',
    icon: '📖',
    tabs: [
      { id: 'st', name: '⭐ Наклейки' },
      { id: 'fr', name: '💖 Друзья' },
      { id: 'rec', name: '🏆 Рекорды' },
    ],
    render(body, tab) {
      const s = S();
      if (tab === 'st') {
        const all = [...TASKS.map((t) => ({ id: t.id, sticker: t.sticker, title: t.title })), ...EXTRA_STICKERS];
        body.appendChild(el('p', 'center', `Собрано <b>${s.stickers.length}</b> из ${all.length}`));
        const grid = el('div', 'grid small');
        for (const a of all) {
          const got = s.stickers.includes(a.id);
          const card = el('div', 'card');
          card.appendChild(el('div', 'sticker' + (got ? ' got' : ''), got ? a.sticker : '❔'));
          card.appendChild(el('div', got ? '' : 'muted', got ? a.title : '???'));
          grid.appendChild(card);
        }
        body.appendChild(grid);
      } else if (tab === 'fr') {
        for (const n of NPCS) {
          const fr = s.friends[n.id],
            h = friendHearts(n.id);
          const li = el('div', 'list-item');
          const { canvas, ctx } = makeCanvas(60, 60);
          canvas.style.cssText += ';border-radius:18px;background:#ffe3ec;flex:none';
          if (fr.met) drawPortrait(ctx, 30, 30, 60, npcLook(n.id));
          else ctext(ctx, '?', 30, 32, 34, '#d9487a');
          li.appendChild(canvas);
          const fav = DISH_BY_ID[n.fav];
          li.appendChild(
            el(
              'div',
              'grow',
              fr.met
                ? `<div class="ttl">${n.name} <span class="hearts">${'❤️'.repeat(h)}${'🤍'.repeat(5 - h)}</span></div><div class="sub">${n.about}</div><div class="sub">Любимое блюдо: ${h >= 1 ? `${fav.e} ${fav.name}` : '❓ (подружись, чтобы узнать)'}</div>`
                : '<div class="ttl">???</div><div class="sub">Вы ещё не знакомы. Найди этого хомячка в городе!</div>',
            ),
          );
          body.appendChild(li);
        }
      } else {
        for (const [id, name] of Object.entries(MG_NAMES)) {
          const b = s.best[id] || 0;
          const li = el('div', 'list-item');
          li.appendChild(
            el('div', 'grow', `<div class="ttl">${name}</div><div class="sub">Сыграно раз: ${s.plays[id] || 0}</div>`),
          );
          li.appendChild(
            el(
              'div',
              '',
              `<span style="font-size:22px">${'⭐'.repeat(b)}<span style="opacity:.25">${'⭐'.repeat(3 - b)}</span></span>`,
            ),
          );
          body.appendChild(li);
        }
        body.appendChild(
          el('p', 'muted center', `Выполнено заданий: ${s.tasksDone} · Найдено жемчужин: ⚪ ${s.pearls || 0}`),
        );
      }
    },
  });
}

// Подсказка о новой наклейке: название берётся из таблицы наклеек, а не набирается руками в каждом месте.
const STICKERS = Object.fromEntries(
  [...TASKS.map((t) => ({ id: t.id, sticker: t.sticker, title: t.title })), ...EXTRA_STICKERS].map((q) => [q.id, q]),
);

on('sticker', ({ id, delay, quiet }) => {
  const st = STICKERS[id];
  if (quiet || !st) return;
  const show = () => toast(`Новая наклейка: ${st.sticker} ${st.title}${st.title.endsWith('!') ? '' : '!'}`, 'good');
  if (delay) setTimeout(show, delay);
  else show();
});
