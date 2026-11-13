// Одежда: окно магазина одежды с примеркой и свой шкаф; оценка наряда для показа мод.
import { addClothes, wear } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { emit } from '../core/events.js';
import { register } from '../core/registry.js';
import { G, cal, hasClothes } from '../core/state.js';
import { el } from '../core/util.js';
import { blinkAt } from '../art/hamster.js';
import { CLOTHES, CLOTHES_BY_ID, SLOTS, vendorLook, resolveLook } from '../data/index.js';
import { clothesIcon, hamsterStage } from '../ui/icons.js';
import { openPanel } from '../ui/panel.js';
import { price, buy } from './purchase.js';

const S = () => G.state;

/**
 * Окно с одеждой. mode: 'shop' (покупка + примерка) или 'wardrobe' (свои вещи).
 * opts: { title, portrait, shops:[...], foot, onClose, sticky, hint }
 */
export function clothesPanel(mode, opts = {}) {
  const st = hamsterStage(150, 168, 1.6);
  let tryOn = {}; // примерка в магазине: slot → id
  const lookNow = () => {
    const l = S().look;
    return resolveLook({ ...l, outfit: { ...l.outfit, ...tryOn } });
  };
  let raf = 0;
  const t0 = performance.now();
  const loop = () => {
    st.redraw(lookNow(), { time: (performance.now() - t0) / 1000, blink: blinkAt((performance.now() - t0) / 1000) });
    raf = requestAnimationFrame(loop);
  };
  loop();
  const season = cal().season;
  return openPanel({
    title: opts.title || 'Шкаф',
    icon: opts.icon || '👗',
    portrait: opts.portrait,
    money: mode === 'shop',
    cls: 'wide',
    sticky: opts.sticky,
    tabs: SLOTS.map((s) => ({ id: s.id, name: `${s.icon} ${s.name}` })),
    foot: opts.foot,
    onClose: () => {
      cancelAnimationFrame(raf);
      if (opts.onClose) opts.onClose();
    },
    render(body, tab, panel) {
      const split = el('div', 'split');
      const side = el('div', 'side');
      side.appendChild(st.canvas);
      if (opts.hint) side.appendChild(el('div', 'muted center', opts.hint));
      if (mode === 'shop') side.appendChild(el('div', 'muted center', 'Нажми на вещь,<br>чтобы примерить'));
      split.appendChild(side);
      const main = el('div', 'main');
      const grid = el('div', 'grid');
      let items = CLOTHES.filter((c) => c.slot === tab);
      if (mode === 'shop') {
        items = items.filter((c) => opts.shops.includes(c.shop));
        items.sort(
          (a, b) => (b.season === season) - (a.season === season) || b.tags.includes(season) - a.tags.includes(season),
        );
      } else items = items.filter((c) => hasClothes(c.id));
      if (!items.length)
        main.appendChild(
          el(
            'p',
            'muted center',
            mode === 'shop' ? 'В этом отделе пока пусто.' : 'Здесь пока ничего нет. Загляни в магазины!',
          ),
        );
      for (const it of items) {
        const owned = hasClothes(it.id),
          worn = S().look.outfit[it.slot] === it.id,
          trying = tryOn[it.slot] === it.id;
        const card = el('div', 'card tap' + (worn || trying ? ' sel' : ''));
        card.appendChild(clothesIcon(it, 84));
        card.appendChild(el('div', 'nm', it.name));
        if (mode === 'shop' && it.season === season) card.appendChild(el('span', 'badge season', 'Сезон!'));
        if (mode === 'shop') {
          if (owned) {
            card.appendChild(el('span', 'badge', 'Есть ✓'));
            card.appendChild(el('div', 'muted', worn ? 'Надето' : 'В шкафу'));
          } else {
            card.appendChild(el('div', 'pr', price(it.price)));
            const b = el('button', 'btn small green', 'Купить');
            b.onclick = (e) => {
              e.stopPropagation();
              if (!buy(it.price, it.name)) return;
              addClothes(it.id);
              wear(it.slot, it.id);
              delete tryOn[it.slot];
              emit('buy', { cat: 'clothes', id: it.id });
              panel.refresh();
            };
            card.appendChild(b);
          }
          card.onclick = () => {
            sfx('pop');
            if (owned) {
              wear(it.slot, worn ? null : it.id);
              delete tryOn[it.slot];
            } else if (trying) delete tryOn[it.slot];
            else tryOn[it.slot] = it.id;
            panel.refresh();
          };
        } else {
          if (worn) card.appendChild(el('span', 'badge', 'Надето'));
          card.onclick = () => {
            sfx('pop');
            wear(it.slot, worn ? null : it.id);
            panel.refresh();
          };
        }
        grid.appendChild(card);
      }
      main.appendChild(grid);
      split.appendChild(main);
      body.appendChild(split);
    },
  });
}

export function openWardrobe() {
  clothesPanel('wardrobe', { title: 'Мой шкаф', icon: '🚪' });
}

register(
  'clothes-shop',
  (p, ctx) =>
    clothesPanel('shop', {
      title: p.title || ctx.building.name,
      portrait: vendorLook(p.vendor),
      shops: p.shops,
    }),
  'магазин одежды: { vendor, shops: [...], title? }',
);

/** Оценка наряда по теме: 0..10 */
export function scoreOutfit(theme) {
  const o = S().look.outfit;
  let score = 0;
  const body = o.body && CLOTHES_BY_ID[o.body];
  const fullBody = body && ['dress', 'princess', 'swim', 'pajama', 'robe'].includes(body.kind);
  for (const slot of ['head', 'body', 'legs', 'feet', 'acc']) {
    let it = o[slot] && CLOTHES_BY_ID[o[slot]];
    if (slot === 'legs' && !it && fullBody) it = body;
    if (!it) continue;
    score += it.tags.some((t) => theme.tags.includes(t)) ? 2 : 0.6;
  }
  return Math.min(10, score);
}

register('wardrobe', () => openWardrobe(), 'шкаф с одеждой');
