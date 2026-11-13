// HUD: плашки сверху (дата, монеты, задание) и круглые кнопки по бокам.
//
// Кнопки справа и плашку задания задаёт main.js (ui/ не знает про занятия из features/).
// Левый столбик зависит от сцены. Сцена сама говорит, что показать, — метод hud():
//   { buttons: [{ id, icon, label, on, fn }],   // её кнопки (сойти с кораблика, нырнуть…) — над «Картой»
//     main: { icon, label, on, fn },            // главная кнопка вместо «Домой» («Обустроить», «Всплыть»)
//     noMap: true,                              // спрятать «Карту»
//     cls: 'decor' }                            // класс на весь HUD (в режиме обустройства кнопки прячутся)
import { G, cal } from '../core/state.js';
import { on } from '../core/events.js';
import { scene, sceneName } from '../core/loop.js';
import { el, fmtMoney } from '../core/util.js';
import { sfx, unlockAudio } from '../core/audio.js';

let root = null,
  cfg = null;
let chipDate, chipMoney, chipTask, leftBox;
let leftSig = ''; // что сейчас показано в левом столбике (чтобы не пересобирать его зря)

function rbtn(icon, label, fn) {
  const b = el('button', 'rbtn', `${icon}<span class="lbl">${label}</span>`);
  b.onclick = () => {
    unlockAudio();
    sfx('tap');
    fn();
  };
  return b;
}

/**
 * Подключить HUD. config:
 *   right: [{ icon, label, fn }]      кнопки справа (рюкзак, альбом, …)
 *   task: { info(), fn }              плашка задания: info() → { text, cls }, fn — по нажатию
 *   map: { icon, label, fn }          кнопка «Карта»
 *   home: { icon, label, fn }         главная кнопка по умолчанию — «Домой»
 */
export function initHud(rootEl, config) {
  root = rootEl;
  cfg = config;
  on('hud', updateHud);
  on('money', updateHud);
}

/** Собрать HUD заново (в начале игры). */
export function buildHud() {
  root.innerHTML = '';
  const top = el('div', 'hud-top');
  chipDate = el('div', 'chip');
  chipMoney = el('div', 'chip');
  chipTask = el('div', 'chip task');
  chipTask.onclick = () => {
    sfx('tap');
    cfg.task.fn();
  };
  top.append(chipDate, chipMoney, chipTask);
  const right = el('div', 'hud-btns');
  right.append(...cfg.right.map((b) => rbtn(b.icon, b.label, b.fn)));
  leftBox = el('div', 'hud-btns left');
  leftSig = '';
  root.append(top, right, leftBox);
}

export function updateHud() {
  if (!G.state || !chipDate) return;
  const c = cal();
  chipDate.innerHTML = `${c.seasonIcon} <b>${c.monthName}</b>, день ${c.dom} · ${c.phaseIcon} ${c.time}`;
  chipMoney.innerHTML = `🪙 <b>${fmtMoney(G.state.money)}</b>`;
  const t = cfg.task.info();
  chipTask.textContent = t.text;
  chipTask.className = 'chip task ' + t.cls;
  // левый столбик: кнопки сцены, карта, главная кнопка
  const sc = scene(),
    h = (sc && sc.hud && sc.hud()) || {};
  const list = [...(h.buttons || [])];
  if (!h.noMap) list.push({ id: 'map', ...cfg.map });
  list.push({ id: 'main', ...(h.main || cfg.home) });
  const sig = sceneName() + ':' + list.map((b) => `${b.id}|${b.icon}|${b.label}|${b.on ? 1 : 0}`).join(';');
  if (sig !== leftSig) {
    leftSig = sig;
    leftBox.innerHTML = '';
    for (const b of list) {
      const e = rbtn(b.icon, b.label, b.fn);
      if (b.on) e.classList.add('on');
      leftBox.appendChild(e);
    }
  }
  root.classList.toggle('decor', h.cls === 'decor');
}
