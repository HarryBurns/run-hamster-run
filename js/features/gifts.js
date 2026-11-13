// Сюрпризы и подарки: что дарим и окно с подарком.
import { earn, addItem, addClothes, learnRecipe, setFlag } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { register } from '../core/registry.js';
import { G, hasClothes } from '../core/state.js';
import { el, pick } from '../core/util.js';
import { CLOTHES, FURNITURE, DISH_BY_ID, SECRET_RECIPES } from '../data/index.js';
import { clothesIcon, furnIcon } from '../ui/icons.js';
import { enqueue } from '../ui/modals.js';
import { openPanel } from '../ui/panel.js';

const S = () => G.state;

function giftPool() {
  const s = S(),
    pool = [];
  for (const c of CLOTHES)
    if (c.shop === 'gift' && c.id !== 'medal' && !hasClothes(c.id)) pool.push({ kind: 'clothes', def: c });
  for (const f of FURNITURE) if (f.shop === 'gift' && !s.flags['gift_' + f.id]) pool.push({ kind: 'furn', def: f });
  for (const r of SECRET_RECIPES) if (!s.recipes.includes(r)) pool.push({ kind: 'recipe', def: DISH_BY_ID[r] });
  return pool;
}

/**
 * Сюрприз. Сам подарок выдаётся сразу (так он не потеряется, если вкладку закроют), а окно с ним
 * показывается через delay мс и только когда на экране ничего не открыто.
 */
export function giveSurprise(title, delay = 0) {
  const gift = grantSurprise();
  enqueue(() => showSurprise(title, gift), { delay });
}

export function grantSurprise() {
  const s = S(),
    pool = giftPool();
  let html,
    icon = null;
  if (!pool.length) {
    earn(100000);
    html = '<div class="big-emoji">💰</div><p>Мешочек монет: +100 000!</p>';
  } else {
    const g = pick(pool);
    if (g.kind === 'clothes') {
      addClothes(g.def.id);
      icon = clothesIcon(g.def, 110);
      html = `<p><b>${g.def.name}</b><br>Ищи в своём шкафу!</p>`;
    } else if (g.kind === 'furn') {
      addItem('storage', g.def.id, 1);
      setFlag('gift_' + g.def.id, true);
      icon = furnIcon(g.def, 110);
      html = `<p><b>${g.def.name}</b><br>Лежит в кладовке — поставь дома через 🔨!</p>`;
    } else {
      learnRecipe(g.def.id);
      html = `<div class="big-emoji">${g.def.e}</div><p>Секретный рецепт: <b>${g.def.name}</b>!</p>`;
    }
  }
  return { html, icon };
}

export function showSurprise(title, { html, icon }) {
  sfx('magic');
  openPanel({
    title: title || 'Сюрприз!',
    icon: '🎁',
    cls: 'narrow',
    render(body) {
      body.classList.add('center');
      if (icon) {
        icon.style.margin = '0 auto';
        body.appendChild(icon);
      }
      body.appendChild(el('div', '', html));
    },
    foot: [{ text: 'Ура!', cls: 'green', fn: (p) => p.close() }],
  });
}

register('surprise', (p) => giveSurprise(p.title, p.delay || 0), 'сюрприз: { title, delay? }');
