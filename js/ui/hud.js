// HUD: плашки сверху (дата, монеты, активный квест) и круглые кнопки по бокам.
//
// Кнопки справа и плашку квеста задаёт main.js (ui/ не знает про занятия из features/).
// Левый столбик зависит от сцены. Сцена сама говорит, что показать, — метод hud():
//   { buttons: [{ id, icon, label, on, fn }],   // её кнопки (сойти с кораблика, нырнуть…) — над «Картой»
//     main: { icon, label, on, fn },            // главная кнопка вместо «Домой» («Обустроить», «Всплыть»)
//     noMap: true,                              // спрятать «Карту»
//     cls: 'decor' }                            // класс на весь HUD (в режиме обустройства кнопки прячутся)
// Рядом с датой — значок 🤒, пока хомячок простыла (Ф1); по нажатию — config.sick.fn.
// ОДНА плашка дела — активный квест, к которому ведёт звёздочка (config.quest; на телефоне — коротко: значок
// и «3/5»), рядом кружок «+3» — сколько ещё квестов ждёт в журнале (с ✉️ — среди них непрочитанное письмо).
// На плашке даты — значок праздника, когда он сегодня или завтра (config.date.badge(); П.13); по нажатию на дату —
// config.date.fn (праздничный календарь).
import { G, cal, spaBoostOn } from '../core/state.js';
import { on } from '../core/events.js';
import { scene, sceneName } from '../core/loop.js';
import { el, fmtMoney } from '../core/util.js';
import { sfx, unlockAudio } from '../core/audio.js';
import { moneyAnchor } from './coins.js';

let root = null,
  cfg = null;
let chipDate, chipSick, chipBoost, chipMoney, chipQuest, chipMore, leftBox;
let leftSig = ''; // что сейчас показано в левом столбике (чтобы не пересобирать его зря)
let dropAnchor = null; // плашка монет — место, где всплывает «+350» (ui/coins.js)

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
 *   map: { icon, label, fn }          кнопка «Карта»
 *   home: { icon, label, fn }         главная кнопка по умолчанию — «Домой»
 *   sick: { fn }                      значок 🤒 «простыла» рядом с датой — по нажатию
 *   boost: { fn }                     значок 💆 «бодрость после спа» (От7) рядом с датой — по нажатию
 *   quest: { info(), fn }             плашка активного квеста: info() → { text, short, cls, more, mail } или null
 *                                     (не показывать); more — сколько ещё квестов (кружок «+3»), mail — среди них
 *                                     непрочитанное письмо; fn — по нажатию на плашку или кружок
 *   date: { badge(), fn }             плашка даты: badge() → HTML значка праздника ('' — нет), fn — по нажатию
 */
export function initHud(rootEl, config) {
  root = rootEl;
  cfg = config;
  on('hud', updateHud);
  on('money', updateHud);
  on('health', updateHud);
}

/** Собрать HUD заново (в начале игры). */
export function buildHud() {
  root.innerHTML = '';
  const top = el('div', 'hud-top');
  chipDate = el('div', 'chip date');
  chipDate.onclick = () => {
    sfx('tap');
    if (cfg.date) cfg.date.fn();
  };
  chipSick = el('div', 'chip sick', '🤒');
  chipSick.title = 'Простыл{|а} — что делать?';
  chipSick.hidden = true;
  chipSick.onclick = () => {
    sfx('tap');
    if (cfg.sick) cfg.sick.fn();
  };
  chipBoost = el('div', 'chip boost', '💆');
  chipBoost.title = 'Бодрость после спа';
  chipBoost.hidden = true;
  chipBoost.onclick = () => {
    sfx('tap');
    if (cfg.boost) cfg.boost.fn();
  };
  chipMoney = el('div', 'chip money');
  if (dropAnchor) dropAnchor();
  dropAnchor = moneyAnchor(chipMoney);
  chipQuest = el('div', 'chip quest');
  chipQuest.hidden = true;
  chipMore = el('div', 'chip more');
  chipMore.hidden = true;
  chipMore.title = 'Другие дела — в журнале';
  chipQuest.onclick = chipMore.onclick = () => {
    sfx('tap');
    if (cfg.quest) cfg.quest.fn();
  };
  top.append(chipDate, chipSick, chipBoost, chipMoney, chipQuest, chipMore);
  const right = el('div', 'hud-btns');
  right.append(...cfg.right.map((b) => rbtn(b.icon, b.label, b.fn)));
  leftBox = el('div', 'hud-btns left');
  leftSig = '';
  root.append(top, right, leftBox);
}

export function updateHud() {
  if (!G.state || !chipDate) return;
  const c = cal();
  const hol = cfg.date && cfg.date.badge ? cfg.date.badge() : '';
  const dateHtml = `${c.seasonIcon} <b>${c.monthName}</b>, день ${c.dom}${hol} · ${c.phaseIcon} ${c.time}`;
  if (chipDate.innerHTML !== dateHtml) chipDate.innerHTML = dateHtml;
  chipSick.hidden = !G.state.sick;
  chipBoost.hidden = !spaBoostOn();
  chipMoney.innerHTML = `🪙 <b>${fmtMoney(G.state.money)}</b>`;
  const q = cfg.quest && cfg.quest.info();
  chipQuest.hidden = !q;
  chipMore.hidden = !q || !q.more;
  if (q) {
    const html = `<span class="long">${q.text}</span><span class="short">${q.short}</span>`;
    if (chipQuest.innerHTML !== html) chipQuest.innerHTML = html;
    chipQuest.className = 'chip quest ' + (q.cls || '');
    const more = `${q.mail ? '✉️' : ''}+${q.more}`;
    if (chipMore.textContent !== more) chipMore.textContent = more;
  }
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
