// Окна: панель с заголовком, вкладками и кнопками; простое сообщение; вопрос «да/нет».
import { el, fmtMoney } from '../core/util.js';
import { makeCanvas } from '../core/draw.js';
import { drawPortrait } from '../art/hamster.js';
import { sfx } from '../core/audio.js';
import { G } from '../core/state.js';
import { openLayer, TAP_GUARD } from './modals.js';
import { moneyAnchor } from './coins.js';

/**
 * openPanel({ title, icon, cls, money, tabs:[{id,name}], tab, render(body, tabId, panel), foot:[{text, cls, fn}], onClose })
 * Возвращает { close(), refresh(), setTab(id), body, tab }
 */
export function openPanel(o) {
  const ov = el('div', 'overlay');
  const p = el('div', 'panel ' + (o.cls || ''));
  const head = el('div', 'panel-head');
  if (o.portrait) {
    const { canvas, ctx } = makeCanvas(44, 44);
    canvas.style.cssText += ';border-radius:50%;background:#fff;flex:none';
    drawPortrait(ctx, 22, 22, 44, o.portrait);
    head.appendChild(canvas);
  } else if (o.icon) head.appendChild(el('span', '', o.icon));
  head.appendChild(el('span', 'title', o.title || ''));
  let moneyEl = null,
    dropAnchor = null;
  if (o.money) {
    moneyEl = el('span', 'money');
    head.appendChild(moneyEl);
    dropAnchor = moneyAnchor(moneyEl); // «+350» и «−120» всплывают у числа монет этого окна (ui/coins.js)
  }
  const x = el('button', 'xbtn', '✕');
  head.appendChild(x);
  p.appendChild(head);
  let tabsEl = null;
  if (o.tabs && o.tabs.length) {
    tabsEl = el('div', 'tabs');
    p.appendChild(tabsEl);
  }
  const body = el('div', 'panel-body');
  p.appendChild(body);
  let foot = null;
  if (o.foot) {
    foot = el('div', 'panel-foot');
    p.appendChild(foot);
  }
  ov.appendChild(p);
  document.body.appendChild(ov);
  const closeLayer = openLayer({ dim: true });

  const api = {
    body,
    tab: o.tab || (o.tabs && o.tabs[0].id) || null,
    closed: false,
    close() {
      if (api.closed) return;
      api.closed = true;
      ov.remove();
      if (dropAnchor) dropAnchor();
      closeLayer();
      if (o.onClose) o.onClose();
    },
    refresh() {
      if (api.closed) return;
      if (moneyEl) moneyEl.textContent = '🪙 ' + fmtMoney(G.state.money);
      if (tabsEl) {
        tabsEl.innerHTML = '';
        for (const t of o.tabs) {
          const b = el('button', 'tab' + (t.id === api.tab ? ' on' : ''), t.name);
          b.onclick = () => {
            sfx('tap');
            api.setTab(t.id);
          };
          tabsEl.appendChild(b);
        }
      }
      const st = body.scrollTop;
      body.innerHTML = '';
      o.render(body, api.tab, api);
      body.scrollTop = st;
      if (foot) {
        foot.innerHTML = '';
        const list = typeof o.foot === 'function' ? o.foot(api) : o.foot;
        for (const f of list) {
          const b = el('button', 'btn ' + (f.cls || ''), f.text);
          b.onclick = () => {
            sfx('tap');
            f.fn(api);
          };
          foot.appendChild(b);
        }
      }
    },
    setTab(id) {
      api.tab = id;
      body.scrollTop = 0;
      api.refresh();
    },
  };
  x.onclick = () => {
    sfx('tap');
    api.close();
  };
  const born = performance.now();
  ov.addEventListener('pointerdown', (e) => {
    if (e.target === ov && !o.sticky && performance.now() - born > TAP_GUARD) api.close();
  });
  api.refresh();
  return api;
}

/** Простое сообщение с кнопками. Возвращает Promise с индексом кнопки (-1 — закрыли). */
export function message({
  title = '',
  icon = '',
  html = '',
  buttons = [{ text: 'Хорошо' }],
  cls = 'narrow',
  sticky = false,
}) {
  return new Promise((resolve) => {
    let done = false;
    const fin = (i) => {
      if (!done) {
        done = true;
        resolve(i);
      }
    };
    openPanel({
      title,
      icon,
      cls,
      sticky,
      render: (b) => {
        b.innerHTML = html;
      },
      foot: buttons.map((bt, i) => ({
        text: bt.text,
        cls: bt.cls || (i === 0 ? 'green' : 'ghost'),
        fn: (p) => {
          fin(i);
          p.close();
        },
      })),
      onClose: () => fin(-1),
    });
  });
}
export async function confirmBox(title, html, yes = 'Да', no = 'Нет') {
  return (await message({ title, html, buttons: [{ text: yes }, { text: no }] })) === 0;
}
