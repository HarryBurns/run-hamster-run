// Окна: панель с заголовком, вкладками и кнопками; простое сообщение; вопрос «да/нет».
import { el, fmtMoney } from '../core/util.js';
import { makeCanvas } from '../core/draw.js';
import { drawPortrait } from '../art/hamster.js';
import { sfx } from '../core/audio.js';
import { G } from '../core/state.js';
import { openLayer, TAP_GUARD } from './modals.js';
import { moneyAnchor } from './coins.js';
import { placeToasts } from './toast.js';

// Пока открыто хоть одно окно, у body есть класс win-open: подсказки (ui/toast.js) тогда встают под шапку окна,
// компактнее, чтобы не ложиться на заголовок и ✕ окна (Ф2).
let openPanels = 0;
const markOpen = (d) => {
  openPanels += d;
  document.body.classList.toggle('win-open', openPanels > 0);
  placeToasts();
};
// Важное окно (quiet: «Игра открыта дважды», «Что-то сломалось»): пока оно на экране, подсказок не видно совсем —
// они не ложатся на его текст (класс win-quiet у body).
let quietPanels = 0;
const markQuiet = (d) => {
  quietPanels += d;
  document.body.classList.toggle('win-quiet', quietPanels > 0);
};

/**
 * openPanel({ title, icon, cls, money, tabs:[{id,name}], tab, render(body, tabId, panel), foot:[{text, cls, fn, act}], onClose,
 *   sticky, quiet })
 * act — метка кнопки для автотеста (data-act), на вид и поведение не влияет. sticky — не закрывается нажатием мимо окна;
 * quiet — важное окно: пока открыто, подсказки (ui/toast.js) спрятаны.
 * Возвращает { close(), refresh(), setTab(id), body, tab }
 */
export function openPanel(o) {
  const ov = el('div', 'overlay');
  const p = el('div', 'panel ' + (o.cls || ''));
  const head = el('div', 'panel-head');
  if (o.portrait) {
    const { canvas, ctx } = makeCanvas(44, 44);
    canvas.style.cssText += ';border-radius:50%;background:#fff;flex:none';
    try {
      drawPortrait(ctx, 22, 22, 44, o.portrait);
    } catch (e) {
      console.error(e); // без портрета окно всё равно откроется
    }
    head.appendChild(canvas);
  } else if (o.icon) head.appendChild(el('span', '', o.icon));
  const titleEl = el('span', 'title');
  titleEl.textContent = o.title || ''; // заголовок — простой текст (в нём бывают имя питомца, название заведения, подпись снимка)
  head.appendChild(titleEl);
  let moneyEl = null,
    dropAnchor = null;
  if (o.money) {
    moneyEl = el('span', 'money');
    head.appendChild(moneyEl);
    dropAnchor = moneyAnchor(moneyEl); // «+350» и «−120» всплывают у числа монет этого окна (ui/coins.js)
  }
  const x = el('button', 'xbtn', '✕');
  x.dataset.act = 'close'; // метки data-act — для автотеста: текст кнопок меняют ради ребёнка, тесты падать не должны
  head.appendChild(x);
  p.appendChild(head);
  let tabsEl = null;
  if (o.tabs && o.tabs.length) {
    tabsEl = el('div', 'tabs');
    p.appendChild(tabsEl);
    p.classList.add('tabbed'); // окно с вкладками — одной высоты на всех вкладках (css: .panel.tabbed)
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
      if (tabsEl) removeEventListener('resize', fitTabs);
      markOpen(-1);
      if (o.quiet) markQuiet(-1);
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
          const b = tabButton(t.name, t.id === api.tab);
          b.onclick = () => {
            sfx('tap');
            api.setTab(t.id);
          };
          tabsEl.appendChild(b);
        }
        fitTabs();
      }
      const st = body.scrollTop;
      body.innerHTML = '';
      try {
        o.render(body, api.tab, api);
      } catch (e) {
        // окно остаётся на экране и закрывается ✕ — игра не застревает
        console.error(e);
        body.innerHTML = '<p class="center">Ой, это окно не получилось показать. Закрой его и попробуй ещё раз.</p>';
      }
      body.scrollTop = st;
      if (foot) {
        foot.innerHTML = '';
        const list = typeof o.foot === 'function' ? o.foot(api) : o.foot;
        for (const f of list) {
          const b = el('button', 'btn ' + (f.cls || ''), f.text);
          if (f.act) b.dataset.act = f.act;
          b.onclick = () => {
            sfx('tap');
            f.fn(api);
          };
          foot.appendChild(b);
        }
      }
      if (openPanels) placeToasts(); // окно могло стать выше или ниже — подсказки за его шапкой
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
  // Вкладки переносятся на новые строки (css: .tabs). Строк больше трёх (на низком экране — больше двух): сначала
  // плотнее (dense — мельче буквы), а если и так не влезли — компактно (compact — сеткой, значок над словами).
  // Несколько строк — ровняем (even): вкладки делятся по строкам поровну (4-4-3, а не 5-5-1), строки одной ширины
  // посередине. Решаем один раз на размер экрана: заново — при повороте и смене размера окна.
  function fitTabs() {
    if (!tabsEl || api.closed) return;
    const key = innerWidth + 'x' + innerHeight;
    if (tabsEl.dataset.fit === key) return;
    tabsEl.dataset.fit = key;
    const max = innerHeight <= 520 ? 2 : 3;
    tabsEl.classList.remove('dense', 'compact', 'even');
    tabsEl.style.paddingLeft = tabsEl.style.paddingRight = '';
    let rows = tabRows(tabsEl);
    if (rows > max) {
      tabsEl.classList.add('dense');
      rows = tabRows(tabsEl);
      if (rows > max) return void tabsEl.classList.replace('dense', 'compact');
    }
    if (rows < 2) return;
    // поля слева и справа поровну: из нескольких ширин строк — та, где вкладок по строкам поровнее (4-4-3, а не
    // 5-5-1), при равенстве — самая широкая; число строк при этом не растёт
    tabsEl.classList.add('even');
    const base = parseFloat(getComputedStyle(tabsEl).paddingLeft) || 0;
    const pad = (x) => (tabsEl.style.paddingLeft = tabsEl.style.paddingRight = base + x + 'px');
    const room = Math.max(0, (tabsEl.clientWidth - 2 * base) * 0.25);
    let best = null;
    for (let i = 0; i <= 12; i++) {
      const x = Math.floor((room * i) / 12);
      pad(x);
      const n = rowCounts(tabsEl);
      if (n.length !== rows) continue;
      const spread = Math.max(...n) - Math.min(...n);
      if (!best || spread < best.spread) best = { x, spread, last: n[n.length - 1], most: Math.max(...n) };
    }
    pad(best ? best.x : 0);
    // последняя строка заметно короче (2-2-1) — её не растягиваем: вкладки в ней своей ширины, слева
    if (!best || best.last < best.most - 1 || best.last < 2) tabsEl.classList.remove('even');
  }
  if (tabsEl) addEventListener('resize', fitTabs);
  const born = performance.now();
  ov.addEventListener('pointerdown', (e) => {
    if (e.target === ov && !o.sticky && performance.now() - born > TAP_GUARD) api.close();
  });
  markOpen(1); // до refresh(): закрытие окна всегда снимает ровно одну отметку «открыто»
  if (o.quiet) markQuiet(1);
  api.refresh();
  return api;
}

/** Кнопка вкладки: «🛋️ Диваны и кресла» → значок и слова отдельно (в компактных вкладках значок встаёт над словами). */
function tabButton(name, on) {
  const b = el('button', 'tab' + (on ? ' on' : ''));
  const m = /^(\S+)\s+(.+)$/su.exec(name);
  if (m && !/[\p{L}\p{N}]/u.test(m[1])) {
    b.appendChild(el('span', 'ti')).textContent = m[1];
    b.append(' '); // текст кнопки — как прежде: «🛋️ Диваны и кресла»
    b.appendChild(el('span', 'tn')).textContent = m[2];
  } else b.appendChild(el('span', 'tn')).textContent = name;
  return b;
}
/** Сколько вкладок в каждой строке (строки — по верхнему краю кнопок). */
function rowCounts(bar) {
  const rows = new Map();
  for (const b of bar.children) rows.set(b.offsetTop, (rows.get(b.offsetTop) || 0) + 1);
  return [...rows.values()];
}
const tabRows = (bar) => rowCounts(bar).length;

/**
 * Простое сообщение с кнопками. Возвращает Promise с индексом кнопки (-1 — закрыли).
 * Метки для автотеста: первая кнопка — data-act="ok", последняя из нескольких — "no" (или своя: { text, act }).
 */
export function message({
  title = '',
  icon = '',
  html = '',
  buttons = [{ text: 'Хорошо' }],
  cls = 'narrow',
  sticky = false,
  quiet = false,
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
      quiet,
      render: (b) => {
        b.innerHTML = html;
      },
      foot: buttons.map((bt, i) => ({
        text: bt.text,
        cls: bt.cls || (i === 0 ? 'green' : 'ghost'),
        act: bt.act || (i === 0 ? 'ok' : i === buttons.length - 1 ? 'no' : ''),
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
