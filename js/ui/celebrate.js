// Праздничное окно «Ура!» — задание выполнено (журнал, письмо), все занятия праздника сделаны: фанфары, конфетти,
// наклейка, строка-заголовок и строки о наградах. Окно встаёт в очередь (ui/modals.js) и откроется, когда экран свободен.
import { sfx } from '../core/audio.js';
import { enqueue } from './modals.js';
import { message } from './panel.js';

const COLORS = ['#ff6b9d', '#ffd43b', '#69db7c', '#74c0fc', '#b197fc', '#ffa94d'];
/** Конфетти: 28 разноцветных кусочков, падают с разной задержкой (css: .confetti). */
const confetti = () =>
  `<div class="confetti">${Array.from(
    { length: 28 },
    (_, i) =>
      `<i style="left:${(i * 37) % 100}%;background:${COLORS[i % 6]};animation-delay:${((i * 0.13) % 1.4).toFixed(2)}s;animation-duration:${(2.2 + ((i * 0.31) % 1.2)).toFixed(2)}s"></i>`,
  ).join('')}</div>`;

/**
 * Окно «Ура!»: title, icon — заголовок окна; sticker — картинка наклейки (или ничего); head — жирная строка;
 * lines — HTML строк о наградах; button — кнопка; delay — не раньше, чем через столько мс; party — конфетти (класс
 * quest-done), иначе просто по центру; after() — когда окно закроют.
 */
export function celebrate({ title, icon, sticker, head, lines, button = 'Ура!', delay = 500, party = true, after }) {
  enqueue(
    () => {
      sfx('fanfare');
      const box = party ? `<div class="quest-done center">${confetti()}` : '<div class="center">';
      return message({
        title,
        icon,
        html: `${box}${sticker ? `<div class="sticker got">${sticker}</div>` : ''}<p><b>${head}</b></p>${lines}</div>`,
        buttons: [{ text: button }],
      }).then(after);
    },
    { delay },
  );
}
