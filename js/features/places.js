// Входы в здания: переход в сцену и вопрос продавца с вариантами.
import { go } from '../core/loop.js';
import { register, run } from '../core/registry.js';
import { vendorLook, VENDORS } from '../data/index.js';
import { dialog } from '../ui/dialog.js';
import { jobNote } from './minigames.js';

// Что происходит на входе в здание, записано в описании здания (поле act) и выполняется реестром действий
// (core/registry.js). Здесь — сами действия.
register(
  'scene',
  (p, ctx) => go(p.arg, ctx.back ? { back: ctx.back } : {}),
  'перейти в сцену: scene:<имя>; ctx.back — куда вернуться',
);

register(
  'ask',
  async (p, ctx) => {
    // продавец спрашивает, чего мы хотим; у каждого ответа может быть своё действие (do).
    // Если среди ответов есть работа (мини-игра с зарплатой), сразу говорим, сколько заплатят
    // и сколько оплачиваемых смен осталось на сегодня.
    const notes = p.options
      .map((o) => (typeof o.do === 'string' && o.do.startsWith('minigame:') ? jobNote(o.do.slice(9)) : ''))
      .join('');
    const i = await dialog({
      look: vendorLook(p.vendor),
      name: VENDORS[p.vendor].name,
      text: p.text + notes,
      options: p.options,
    });
    const o = p.options[i];
    return o && o.do ? run(o.do, ctx) : undefined;
  },
  'вопрос продавца с вариантами: { vendor, text, options: [{ text, cls, do }] }',
);
