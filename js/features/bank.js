// Хомяк-Банк: счёт, откуда пришли монеты сегодня и вчера, наклейки за заработок, письмо банка после
// переноса старого сохранения (миллиард → 20 000).
import { award, setFlag } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { on } from '../core/events.js';
import { register } from '../core/registry.js';
import { G } from '../core/state.js';
import { el, esc, fmtMoney } from '../core/util.js';
import { INCOME_SOURCES, MONEY_STICKERS, MIGRATED_MONEY, PAID_SHIFTS, vendorLook } from '../data/index.js';
import { enqueue } from '../ui/modals.js';
import { openPanel, message } from '../ui/panel.js';

const S = () => G.state;
const sum = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);

function dayCard(title, d, emptyText) {
  const box = el('div', 'bank-day');
  const total = sum(d.in);
  box.appendChild(el('div', 'ttl', `${title} <b>+${fmtMoney(total)}</b>`));
  const rows = INCOME_SOURCES.filter((src) => d.in[src.id] > 0);
  if (!rows.length) box.appendChild(el('div', 'muted', emptyText));
  for (const src of rows) {
    const row = el('div', 'row');
    row.appendChild(el('span', '', `${src.icon} ${src.name}`));
    const bar = el('span', 'bar');
    bar.appendChild(el('i'));
    bar.firstChild.style.width = Math.max(6, Math.round((d.in[src.id] / total) * 100)) + '%';
    row.appendChild(bar);
    row.appendChild(el('b', '', '+' + fmtMoney(d.in[src.id])));
    box.appendChild(row);
  }
  box.appendChild(el('div', 'out', `Потрачено: 🪙 ${fmtMoney(d.out || 0)}`));
  return box;
}

export function openBank() {
  openPanel({
    title: 'Хомяк-Банк',
    portrait: vendorLook('bank'),
    cls: '',
    render(body) {
      const s = S(),
        L = s.ledger;
      body.appendChild(
        el('div', 'bank-acc', `<div class="muted">На твоём счету</div><div class="big">🪙 ${fmtMoney(s.money)}</div>`),
      );
      const days = el('div', 'bank-days');
      days.appendChild(dayCard('Сегодня', L.today, 'Пока ничего. День только начался!'));
      days.appendChild(dayCard('Вчера', L.yesterday, 'Вчера заработка не было.'));
      body.appendChild(days);
      body.appendChild(
        el(
          'p',
          'center',
          `За всё время заработано: <b>🪙 ${fmtMoney(s.earned)}</b> · потрачено: <b>🪙 ${fmtMoney(s.spent)}</b>`,
        ),
      );
      body.appendChild(
        el(
          'div',
          'bank-tips',
          `<b>Банкир Монеткин советует, как заработать:</b>
          <ul><li>💼 <b>Работа.</b> Школа, больница, ресторан, Дом моды и заплыв в бассейне. Чем больше звёзд, тем больше монет. В каждом месте платят за ${PAID_SHIFTS} смены в день.</li>
          <li>✉️ <b>Задания</b> из почтового ящика — за каждое дают монеты.</li>
          <li>🧺 <b>Рынок.</b> Продавай урожай с грядок, рыбу, кокосы, жемчуг и то, что приготовила сама.</li></ul>`,
        ),
      );
    },
  });
}

register('bank', () => openBank(), 'Хомяк-Банк: счёт и доход по источникам');

// Наклейки за заработок: считаем на каждое изменение монет.
on('money', () => {
  const s = S();
  if (!s) return;
  if (s.earned >= MONEY_STICKERS.earned) award('x_10k', { delay: 1200 });
  if (s.money >= MONEY_STICKERS.saved) award('x_50k', { delay: 1200 });
});

/**
 * Письмо банка после переноса старого сохранения: показывается один раз, при первом входе в игру.
 * Миграция (core/state.js) ставит отметку flags.bankLetter = 1; когда письмо открылось — 2.
 */
export function showBankLetter() {
  if (S().flags.bankLetter !== 1) return;
  enqueue(
    () => {
      if (S().flags.bankLetter !== 1) return;
      setFlag('bankLetter', 2);
      sfx('mail');
      message({
        title: 'Письмо из Хомяк-Банка',
        icon: '🏦',
        cls: '',
        sticky: true,
        html: `<div class="letter"><h3>🏗️ Большая стройка!</h3><p>Дорогая ${esc(S().name)}!</p>
          <p>Пока тебя не было, вокруг города началась большая стройка. Скоро здесь появятся новые места: <b>лес, горы, курортный отель</b> и ещё много интересного. Строят их на твой миллиард — так что ты теперь главная помощница города. Спасибо тебе!</p>
          <p>На твоём счету мы оставили <b>🪙 ${fmtMoney(MIGRATED_MONEY)} монет</b>. Все твои наряды, мебель, друзья и наклейки — на месте.</p>
          <p>А монеты теперь можно зарабатывать самой: <b>работай</b> в школе, больнице, ресторане и Доме моды, выполняй <b>задания</b> из писем и продавай на <b>рынке</b> урожай, рыбу и свои вкусняшки.</p>
          <p class="muted">Твой банкир Монеткин 🐹</p></div>`,
        buttons: [{ text: 'Понятно!' }],
      });
    },
    { delay: 900 },
  );
}
