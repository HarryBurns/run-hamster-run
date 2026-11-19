// Салон красоты. Как в магазине одежды: нажатие на вариант — бесплатная примерка (видно на хомячке слева),
// а сделать по-настоящему — отдельной кнопкой «Сделать за 🪙 N». Закрыла окно без покупки — всё как было.
import { setBeauty } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { emit } from '../core/events.js';
import { register, run } from '../core/registry.js';
import { G, playerLook } from '../core/state.js';
import { el, fmtMoney } from '../core/util.js';
import { blinkAt } from '../art/hamster.js';
import { BEAUTY, vendorLook } from '../data/index.js';
import { hamsterStage } from '../ui/icons.js';
import { openPanel } from '../ui/panel.js';
import { price, buy, buyBtn, lacking } from './purchase.js';
import { bizByVendor, bizFoot, bizSign } from './business.js';

const S = () => G.state;

/** Что сейчас сделано в салоне по пункту key (без «пусто»: хохолок 0, реснички false, остальное null). */
function current(key) {
  const b = S().look.beauty;
  if (key === 'tuft') return b.tuft || 0;
  if (key === 'lashes') return !!b.lashes;
  return b[key] === undefined ? null : b[key];
}

function openSalon() {
  const st = hamsterStage(150, 168, 1.6);
  const tryOn = {}; // примерка: пункт → вариант (только то, что отличается от сделанного)
  let lookBase = null,
    lookTry = null,
    lookKey = '';
  const lookNow = () => {
    const base = playerLook(),
      key = JSON.stringify(tryOn);
    if (base !== lookBase || key !== lookKey) {
      lookBase = base;
      lookKey = key;
      lookTry = Object.keys(tryOn).length ? { ...base, beauty: { ...base.beauty, ...tryOn } } : base;
    }
    return lookTry;
  };
  let raf = 0;
  const t0 = performance.now();
  const loop = () => {
    const t = (performance.now() - t0) / 1000;
    st.redraw(lookNow(), { time: t, blink: blinkAt(t) });
    raf = requestAnimationFrame(loop);
  };
  loop();
  openPanel({
    title: 'Салон красоты',
    portrait: vendorLook('salon'),
    money: true,
    cls: 'wide',
    onClose: () => cancelAnimationFrame(raf),
    // работа «Парикмахер» (этап 17в) — для всех; салон можно купить: «Купить заведение» или «Моё заведение»
    foot: () => [
      {
        text: '✂️ Поработать парикмахером',
        cls: 'green',
        fn: (panel) => {
          panel.close();
          run('minigame:hairdresser');
        },
      },
      ...bizFoot(bizByVendor('salon')),
    ],
    render(body, tab, panel) {
      const sign = bizSign(bizByVendor('salon'));
      if (sign) body.appendChild(sign);
      const split = el('div', 'split');
      const side = el('div', 'side');
      side.appendChild(st.canvas);
      const tried = Object.keys(tryOn);
      side.appendChild(
        el(
          'div',
          'muted center',
          tried.length ? 'Это примерка — она бесплатная' : 'Нажми на вариант,<br>чтобы примерить',
        ),
      );
      if (tried.length) {
        const back = el('button', 'btn small ghost salon-back', '↩️ Как было');
        back.onclick = () => {
          sfx('pop');
          for (const k of tried) delete tryOn[k];
          panel.refresh();
        };
        side.appendChild(back);
      }
      split.appendChild(side);
      const main = el('div', 'main');
      for (const [key, cat] of Object.entries(BEAUTY)) {
        main.appendChild(el('h4', '', `${cat.icon} ${cat.name} <span class="muted">— ${price(cat.price)}</span>`));
        const row = el('div', 'opt-row');
        const done = current(key),
          shown = key in tryOn ? tryOn[key] : done;
        for (const o of cat.options) {
          const btn = el(
            'button',
            'opt' + (o.v === shown ? ' sel' : '') + (o.v === done ? ' done' : ''),
            (o.c ? `<span class="dotc" style="background:${o.c}"></span>` : '') + o.name,
          );
          btn.onclick = () => {
            if (o.v === shown) return;
            sfx('pop');
            if (o.v === done) delete tryOn[key];
            else tryOn[key] = o.v;
            panel.refresh();
          };
          row.appendChild(btn);
        }
        main.appendChild(row);
        if (key in tryOn) {
          // примерили — под вариантами кнопка «Сделать»; монет не хватает — кнопка бледная (нажать можно — подскажет,
          // сколько не хватает), а рядом написано, сколько ещё накопить
          const pay = el('div', 'salon-pay');
          pay.appendChild(
            buyBtn(`Сделать за ${price(cat.price)}`, cat.price, () => {
              if (!buy(cat.price)) return;
              setBeauty(key, tryOn[key]);
              delete tryOn[key];
              sfx('magic');
              emit('salon');
              panel.refresh();
            }),
          );
          if (lacking(cat.price))
            pay.appendChild(el('span', 'lack-line', `накопить ещё ${fmtMoney(lacking(cat.price))}`));
          main.appendChild(pay);
        }
      }
      split.appendChild(main);
      body.appendChild(split);
    },
  });
}

register('salon', () => openSalon(), 'салон красоты');
