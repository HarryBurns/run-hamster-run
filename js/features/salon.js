// Салон красоты.
import { setBeauty } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { emit } from '../core/events.js';
import { register } from '../core/registry.js';
import { G, playerLook } from '../core/state.js';
import { el } from '../core/util.js';
import { BEAUTY, vendorLook } from '../data/index.js';
import { hamsterStage } from '../ui/icons.js';
import { openPanel } from '../ui/panel.js';
import { price, buy, lacking, lackText } from './purchase.js';
import { bizByVendor, bizFoot, bizSign } from './business.js';

const S = () => G.state;

function openSalon() {
  const st = hamsterStage(150, 168, 1.6);
  let raf = 0;
  const t0 = performance.now();
  const loop = () => {
    st.redraw(playerLook(), { time: (performance.now() - t0) / 1000 });
    raf = requestAnimationFrame(loop);
  };
  loop();
  openPanel({
    title: 'Салон красоты',
    portrait: vendorLook('salon'),
    money: true,
    cls: 'wide',
    onClose: () => cancelAnimationFrame(raf),
    foot: () => bizFoot(bizByVendor('salon')), // салон можно купить: «Купить заведение» или «Моё заведение»
    render(body, tab, panel) {
      const sign = bizSign(bizByVendor('salon'));
      if (sign) body.appendChild(sign);
      const split = el('div', 'split');
      const side = el('div', 'side');
      side.appendChild(st.canvas);
      split.appendChild(side);
      const main = el('div', 'main');
      const b = S().look.beauty;
      for (const [key, cat] of Object.entries(BEAUTY)) {
        main.appendChild(
          el(
            'h4',
            '',
            `${cat.icon} ${cat.name} <span class="muted">— ${price(cat.price)}${lacking(cat.price) ? ` · ${lackText(cat.price)}` : ''}</span>`,
          ),
        );
        const row = el('div', 'opt-row');
        for (const o of cat.options) {
          const cur =
            (b[key] === undefined ? null : b[key]) === o.v ||
            (key === 'tuft' && (b.tuft || 0) === o.v) ||
            (key === 'lashes' && !!b.lashes === o.v);
          const btn = el(
            'button',
            'opt' + (cur ? ' sel' : ''),
            (o.c ? `<span class="dotc" style="background:${o.c}"></span>` : '') + o.name,
          );
          btn.onclick = () => {
            if (cur) return;
            if (!buy(cat.price)) return;
            setBeauty(key, o.v);
            sfx('magic');
            emit('salon');
            panel.refresh();
          };
          row.appendChild(btn);
        }
        main.appendChild(row);
      }
      split.appendChild(main);
      body.appendChild(split);
    },
  });
}

register('salon', () => openSalon(), 'салон красоты');
