// ЖУРНАЛ (вкладка альбома): ОДИН список квестов — задания жителей, праздник сегодня, письмо дня (features/goals.js).
// Сверху — активный квест («⭐ Звёздочка ведёт сюда»), дальше остальные по общему порядку (data/goals.js); у каждого —
// кнопка «⭐ Веди меня» (leadTo): квест становится активным, окно карты показывает, куда идти. Ниже — «Выполнено».
// Карточки рисуют сами занятия (поле card квеста), здесь — только список и кнопка.
import { sfx } from '../core/audio.js';
import { register } from '../core/registry.js';
import { el } from '../core/util.js';
import { currentLocation } from '../engine/topdown/index.js';
import { toast } from '../ui/toast.js';
import { goalList, goalNow, findGoal, chooseGoal, settleGoal, starFor, goalSources, LOC_WORDS } from './goals.js';
import { openMap, routeText } from './map.js';

/**
 * «⭐ Веди меня»: квест id — активный (выбор игрока), и показать, куда идти: цель в другом месте — подсказка с дорогой
 * («карта мира») и окно карты; здесь — окно карты со звёздочкой. false — карту не открыли: у шага нет места или
 * показать сейчас нечего (квест всё равно активный — он на плашке, а что делать, написано в журнале).
 */
export function leadTo(id) {
  const g = findGoal(id);
  if (!g || !chooseGoal(id)) return false;
  sfx('ok');
  const pl = g.place && g.place(),
    here = currentLocation();
  if (pl && pl.scene !== here.name) {
    const way = routeText(here.name, pl.scene),
      there = LOC_WORDS[pl.scene] || 'в другом месте';
    toast(
      way
        ? `${g.icon} ${g.far || g.title} — ${there}. Звёздочка ⭐ покажет дорогу — ${way}.`
        : `${g.icon} ${g.far || g.title} — ${there}. Туда пока нет дороги.`,
    );
    openMap();
    return true;
  }
  if (!pl || !starFor(here)) {
    toast(g.nowhere || `${g.icon} Сейчас это место на карте не показать — что делать, написано в журнале 📖`);
    return false;
  }
  openMap();
  return true;
}
register('lead', (p) => leadTo(p.arg), 'звёздочка: lead:<квест> — «⭐ Веди меня» (quest:<id>, holiday, mail)');

/** Кнопка «⭐ Веди меня» для квеста g, а у активного — пометка «⭐ Звёздочка ведёт сюда». panel — закрыть, когда идём к карте. */
export function leadRow(g, panel) {
  if (goalNow() === g) return el('div', 'q-lead', '⭐ Звёздочка ведёт сюда');
  const b = el('button', 'btn small green lead q-lead-btn', '⭐ Веди меня');
  b.onclick = () => {
    if (leadTo(g.id)) panel.close();
    else panel.refresh();
  };
  return b;
}

/** Нарисовать журнал в тело окна альбома. panel — окно. */
export function renderJournal(body, panel) {
  settleGoal();
  for (const src of goalSources()) if (src.note) src.note(body);
  const list = goalList(),
    now = goalNow();
  if (!list.length)
    body.appendChild(
      el(
        'p',
        'muted center',
        'Сейчас дел нет. Новое письмо придёт утром, а жители города иногда просят о помощи: у кого над головой «!», у того есть задание.',
      ),
    );
  // активный квест — первым, остальные — по общему порядку
  for (const g of now ? [now, ...list.filter((q) => q !== now)] : list) {
    const card = g.card(panel);
    if (g === now) card.classList.add('lead');
    card.dataset.goal = g.id;
    card.appendChild(leadRow(g, panel));
    body.appendChild(card);
  }
  const done = el('div', 'q-done-list');
  for (const src of goalSources()) if (src.done) src.done(done);
  if (done.children.length) {
    body.appendChild(el('h4', 'q-done-h', '✅ Выполнено'));
    body.appendChild(done);
  }
}
