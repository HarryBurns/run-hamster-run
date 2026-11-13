// Покупка: списать монеты, показать подсказку.
import { spend, award } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { G } from '../core/state.js';
import { fmtMoney } from '../core/util.js';
import { toast } from '../ui/toast.js';

const S = () => G.state;

export const price = (n) => `🪙 ${fmtMoney(n)}`;

export function buy(cost, what) {
  if (!spend(cost)) {
    toast('Не хватает монет… (как так?!)');
    return false;
  }
  sfx('coin');
  if (S().spent >= 1_000_000) award('x_rich', { delay: 800 });
  if (what) toast(`Куплено: ${what}`, 'good');
  return true;
}
