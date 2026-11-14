// Покупка: списать монеты, показать подсказку; ценник и кнопка «Купить», по которым видно, хватает ли монет.
import { spend } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { G } from '../core/state.js';
import { el, fmtMoney, plural } from '../core/util.js';
import { toast } from '../ui/toast.js';

const S = () => G.state;

export const price = (n) => `🪙 ${fmtMoney(n)}`;

/** Сколько монет не хватает на покупку (0 — хватает). */
export const lacking = (cost) => Math.max(0, cost - S().money);
/** «не хватает 120 монет» */
export const lackText = (cost) => {
  const n = lacking(cost);
  return `не хватает ${fmtMoney(n)} ${plural(n, 'монеты', 'монет', 'монет')}`;
};

/** Купить за cost монет. false — монет не хватает (и подсказка, сколько именно). */
export function buy(cost, what) {
  if (!spend(cost)) {
    sfx('pop');
    toast(`Пока ${lackText(cost)} 🪙 Их можно заработать: работа, задания из писем, рынок.`);
    return false;
  }
  sfx('coin');
  if (what) toast(`Куплено: ${what}`, 'good');
  return true;
}

/**
 * Ценник для карточки товара. Если монет не хватает, он бледнее и под ним написано, сколько ещё нужно:
 * товар виден, его можно примерить и рассмотреть, просто пока рано.
 */
export function priceTag(cost) {
  const box = el('div', 'pr' + (lacking(cost) ? ' far' : ''), price(cost));
  if (lacking(cost)) box.appendChild(el('div', 'lack', `накопить ещё ${fmtMoney(lacking(cost))}`));
  return box;
}

/** Кнопка покупки: зелёная, если монет хватает, и белая, если нет (нажать можно — подскажет, сколько не хватает). */
export function buyBtn(text, cost, onClick, cls = 'green') {
  const b = el('button', 'btn small ' + (lacking(cost) ? 'ghost' : cls), text);
  b.onclick = onClick;
  return b;
}
