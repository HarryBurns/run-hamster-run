// Сюрпризы и подарки: что дарим и окно с подарком.
import { earn, addItem, addClothes, learnRecipe, setFlag } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { register } from '../core/registry.js';
import { G, cal, hasClothes } from '../core/state.js';
import { el, fmtMoney, pick } from '../core/util.js';
import { CLOTHES, FURNITURE, DISH_BY_ID, QUESTS, SECRET_RECIPES, SURPRISE_COINS, wareSeason } from '../data/index.js';
import { clothesIcon, furnIcon } from '../ui/icons.js';
import { enqueue } from '../ui/modals.js';
import { openPanel } from '../ui/panel.js';

const S = () => G.state;

// Подарки, которые получают в своём месте, сюрпризом не дарят: награды заданий (шляпа исследовательницы, каска,
// треуголка…) и вещи с пометкой surprise: false (медаль за заплыв, лея и венок Вождя).
const QUEST_PRIZES = new Set(QUESTS.map((q) => q.reward && q.reward.clothes).filter(Boolean));

/**
 * Из чего выбирать сюрприз. why — за что он: 'small' (обычное задание, письмо, дружба) — уместные мелочи: цветы,
 * игрушки, рецепты; 'win' (победа в соревновании) — сначала кубок; 'treasure' (клад, сокровище) — сначала золотой
 * хомяк и трон. Вещи «за победу» и «из клада» (surprise в data/furniture.js) за обычное задание не дарят; когда они
 * уже подарены, за победу и клад — мелочи, как обычно.
 */
function giftPool(why = 'small') {
  const s = S(),
    small = [],
    special = [],
    // праздничные подарки-сюрпризы (шляпа волшебницы) дарят только около своего праздника; подарки самих праздников
    // (shop: 'holiday' — колпак, красный наряд, самовар) сюрпризом не дарят: их дарит праздник (features/holidays.js)
    timely = (def) => wareSeason(def, cal().month) !== 'off',
    put = (def, g) => {
      if (def.surprise === undefined) small.push(g);
      else if (def.surprise === why) special.push(g);
    };
  for (const c of CLOTHES)
    if (c.shop === 'gift' && !QUEST_PRIZES.has(c.id) && !hasClothes(c.id) && timely(c))
      put(c, { kind: 'clothes', def: c });
  for (const f of FURNITURE)
    if (f.shop === 'gift' && !s.flags['gift_' + f.id] && timely(f)) put(f, { kind: 'furn', def: f });
  for (const r of SECRET_RECIPES) if (!s.recipes.includes(r)) small.push({ kind: 'recipe', def: DISH_BY_ID[r] });
  return special.length ? special : small;
}
/** Для тестов: id того, что сейчас может выпасть сюрпризом за why. */
export const surprisePool = (why) => giftPool(why).map((g) => g.def.id);

/**
 * Сюрприз. Сам подарок выдаётся сразу (так он не потеряется, если вкладку закроют), а окно с ним
 * показывается через delay мс и только когда на экране ничего не открыто. why — за что (giftPool).
 */
export function giveSurprise(title, delay = 0, why = 'small') {
  const gift = grantSurprise(why);
  enqueue(() => showSurprise(title, gift), { delay });
}

export function grantSurprise(why = 'small') {
  const pool = giftPool(why);
  let html,
    icon = null;
  if (!pool.length) {
    earn(SURPRISE_COINS, 'gift');
    html = `<div class="big-emoji">💰</div><p>Мешочек монет: +${fmtMoney(SURPRISE_COINS)}!</p>`;
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
    foot: [{ text: 'Ура!', cls: 'green', act: 'ok', fn: (p) => p.close() }],
  });
}

register('surprise', (p) => giveSurprise(p.title, p.delay || 0, p.why), 'сюрприз: { title, delay?, why? }');
