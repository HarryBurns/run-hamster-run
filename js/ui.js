// Интерфейс поверх игры: подсказки, окна, диалоги, значки вещей.
import { el, makeCanvas, fmtMoney } from './util.js';
import { drawHamster, drawPortrait, defaultLook } from './hamster.js';
import { drawFurn } from './props.js';
import { sfx } from './audio.js';
import { G, playerLook } from './game.js';

// ---------- подсказки ----------
let toastBox = null;
export function toast(msg, kind = '') {
  if (!toastBox) { toastBox = el('div'); toastBox.id = 'toasts'; document.body.appendChild(toastBox); }
  const t = el('div', 'toast ' + kind, msg);
  toastBox.appendChild(t);
  while (toastBox.children.length > 3) toastBox.firstChild.remove();
  setTimeout(() => t.classList.add('out'), 2600);
  setTimeout(() => t.remove(), 3100);
}

// ---------- окна ----------
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
  let moneyEl = null;
  if (o.money) { moneyEl = el('span', 'money'); head.appendChild(moneyEl); }
  const x = el('button', 'xbtn', '✕');
  head.appendChild(x);
  p.appendChild(head);
  let tabsEl = null;
  if (o.tabs && o.tabs.length) { tabsEl = el('div', 'tabs'); p.appendChild(tabsEl); }
  const body = el('div', 'panel-body');
  p.appendChild(body);
  let foot = null;
  if (o.foot) { foot = el('div', 'panel-foot'); p.appendChild(foot); }
  ov.appendChild(p);
  document.body.appendChild(ov);
  G.modal++;

  const api = {
    body, tab: o.tab || (o.tabs && o.tabs[0].id) || null, closed: false,
    close() {
      if (api.closed) return;
      api.closed = true; ov.remove(); G.modal--;
      if (o.onClose) o.onClose();
    },
    refresh() {
      if (api.closed) return;
      if (moneyEl) moneyEl.textContent = '🪙 ' + fmtMoney(G.state.money);
      if (tabsEl) {
        tabsEl.innerHTML = '';
        for (const t of o.tabs) {
          const b = el('button', 'tab' + (t.id === api.tab ? ' on' : ''), t.name);
          b.onclick = () => { sfx('tap'); api.setTab(t.id); };
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
          b.onclick = () => { sfx('tap'); f.fn(api); };
          foot.appendChild(b);
        }
      }
    },
    setTab(id) { api.tab = id; body.scrollTop = 0; api.refresh(); },
  };
  x.onclick = () => { sfx('tap'); api.close(); };
  ov.addEventListener('pointerdown', (e) => { if (e.target === ov && !o.sticky) api.close(); });
  api.refresh();
  return api;
}

/** Простое сообщение с кнопками. Возвращает Promise с индексом кнопки (-1 — закрыли). */
export function message({ title = '', icon = '', html = '', buttons = [{ text: 'Хорошо' }], cls = 'narrow', sticky = false }) {
  return new Promise((resolve) => {
    let done = false;
    const fin = (i) => { if (!done) { done = true; resolve(i); } };
    openPanel({
      title, icon, cls, sticky,
      render: (b) => { b.innerHTML = html; },
      foot: buttons.map((bt, i) => ({ text: bt.text, cls: bt.cls || (i === 0 ? 'green' : 'ghost'), fn: (p) => { fin(i); p.close(); } })),
      onClose: () => fin(-1),
    });
  });
}
export async function confirmBox(title, html, yes = 'Да', no = 'Нет') {
  return (await message({ title, html, buttons: [{ text: yes }, { text: no }] })) === 0;
}

/**
 * Реплика персонажа с вариантами ответа.
 * dialog({ look, name, text, options:[{text, cls}] }) → Promise<index> (-1 — закрыто)
 */
export function dialog({ look, name, text, options = [{ text: 'Пока!' }], happy = false }) {
  return new Promise((resolve) => {
    const shade = el('div', 'dialog-shade');
    const d = el('div', 'dialog');
    const who = el('div', 'who');
    const { canvas, ctx } = makeCanvas(72, 72);
    who.appendChild(canvas);
    const right = el('div');
    right.appendChild(el('div', 'name', name));
    right.appendChild(el('div', 'say', text));
    who.appendChild(right);
    d.appendChild(who);
    const opts = el('div', 'opts');
    d.appendChild(opts);
    let raf = 0, closed = false;
    const t0 = performance.now();
    const loop = () => {
      const t = (performance.now() - t0) / 1000;
      ctx.clearRect(0, 0, 72, 72);
      drawPortrait(ctx, 36, 36, 72, look, { time: t, talk: t < 1.6, happy, blink: t % 3.2 > 3.05 });
      raf = requestAnimationFrame(loop);
    };
    loop();
    const fin = (i) => {
      if (closed) return; closed = true;
      cancelAnimationFrame(raf); d.remove(); shade.remove(); G.modal--; resolve(i);
    };
    options.forEach((o, i) => {
      const b = el('button', 'btn ' + (o.cls || (i === options.length - 1 ? 'ghost' : '')), o.text);
      b.onclick = () => { sfx('tap'); fin(i); };
      opts.appendChild(b);
    });
    shade.addEventListener('pointerdown', () => fin(-1));
    document.body.append(shade, d);
    G.modal++;
    sfx('pop');
  });
}

// ---------- значки ----------
const MANNEQUIN = { ...defaultLook(), fur: '#f3ede4', spots: null, ear: '#e6d5c3', beauty: { blush: null } };
/** Canvas со значком одежды: манекен-хомячок в этой вещи. */
export function clothesIcon(item, size = 84) {
  const { canvas, ctx } = makeCanvas(size, size);
  const look = { ...MANNEQUIN, outfit: { [item.slot]: item } };
  let s = size / 100, dy = 0;
  if (item.slot === 'head') { s = size / 62; dy = 46 * s; }
  else if (item.slot === 'feet') { s = size / 56; dy = -22 * s; }
  else if (item.slot === 'acc' && !['wings', 'backpack', 'bag'].includes(item.kind)) { s = size / 62; dy = 28 * s; }
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, size, size); ctx.clip();
  drawHamster(ctx, size / 2, size * 0.93 + dy, s, look, { shadow: false });
  ctx.restore();
  return canvas;
}
export function furnIcon(def, size = 84) {
  const { canvas, ctx } = makeCanvas(size, size);
  const k = Math.min((size - 8) / def.w, (size - 8) / Math.max(def.h, 30));
  ctx.save();
  ctx.translate(size / 2, def.wall ? size / 2 : size / 2 + (Math.max(def.h, 30) * k) / 2);
  ctx.scale(k, k);
  drawFurn(ctx, def, 0, 0, { t: 0.4, on: def.kind === 'lamp' || def.kind === 'fireplace', icon: true });
  ctx.restore();
  return canvas;
}
/** Canvas с хомячком в полный рост (для примерочной и т. п.). Возвращает { canvas, redraw(look, pose) } */
export function hamsterStage(w = 170, h = 190, scale = 1.75) {
  const { canvas, ctx } = makeCanvas(w, h);
  canvas.className = 'stage';
  const redraw = (look = playerLook(), pose = {}) => {
    ctx.clearRect(0, 0, w, h);
    drawHamster(ctx, w / 2, h - 18, scale, look, pose);
  };
  redraw();
  return { canvas, redraw };
}

export function fadeTo(msg, ms = 1500) {
  return new Promise((resolve) => {
    const f = el('div', 'fade', `<div class="msg">${msg}</div>`);
    document.body.appendChild(f);
    G.modal++;
    requestAnimationFrame(() => f.classList.add('on'));
    setTimeout(() => {
      resolve(() => {
        f.classList.remove('on');
        setTimeout(() => { f.remove(); G.modal--; }, 380);
      });
    }, ms);
  });
}
