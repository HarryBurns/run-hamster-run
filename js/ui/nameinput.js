// Поле имени героя: одно и то же на экране новой игры (features/title.js) и в меню ⚙️ (features/settings.js).
// Имя правится на лету (typeName в data/looks.js: только буквы — русские и латинские, пробел и дефис; слова и части
// через дефис — с заглавной; не больше трёх слов), курсор остаётся там, где печатали; стирание и вставка работают как
// обычно. Пока клавиатура телефона «составляет» слово (Android), поле не трогаем — правим, когда слово готово.
// Лишнее просто не вводится, а под полем появляется мягкая подсказка.
import { el } from '../core/util.js';
import { typeName, cleanName, nameProblem } from '../data/index.js';

/**
 * nameInput({ value, onLayout }) → { inp, hint, say(text), clean() }.
 * inp — поле; hint — строка подсказки под ним (скрыта, пока пуста); say — показать свою подсказку; clean() — привести
 * имя к готовому виду (без пробела и дефиса по краям) и вернуть его (пустая строка — имени нет).
 * onLayout — подсказка появилась или пропала (высота формы изменилась).
 */
export function nameInput({ value = '', onLayout = null } = {}) {
  const inp = el('input');
  inp.type = 'text';
  inp.value = cleanName(value);
  inp.placeholder = 'Хомка';
  inp.setAttribute('aria-label', 'Имя');
  inp.autocomplete = 'off';
  inp.spellcheck = false;
  inp.setAttribute('autocapitalize', 'words');
  inp.setAttribute('autocorrect', 'off');
  inp.setAttribute('enterkeyhint', 'done');
  const hint = el('div', 'name-hint');
  hint.setAttribute('aria-live', 'polite');
  hint.hidden = true;
  let hintT = 0;
  const say = (text) => {
    clearTimeout(hintT);
    hint.textContent = text;
    hint.hidden = !text;
    if (onLayout) onLayout();
    if (text) hintT = setTimeout(() => say(''), 6000);
  };
  const WHY = {
    chars: 'В имени — только буквы. Можно ещё пробел и дефис 🙂',
    words: 'В имени не больше трёх слов 🙂',
    long: 'Имя получилось длинное — давай чуть короче 🙂',
  };
  let composing = false;
  const fix = () => {
    const raw = inp.value,
      clean = typeName(raw);
    const why = nameProblem(raw);
    if (clean !== raw) {
      const at = inp.selectionStart == null ? raw.length : inp.selectionStart;
      const pos = Math.min(typeName(raw.slice(0, at)).length, clean.length);
      inp.value = clean;
      try {
        inp.setSelectionRange(pos, pos);
      } catch (e) {
        /* поле не в фокусе — курсор ставить некуда */
      }
    }
    if (why) say(WHY[why]);
    else if (WHY_TEXTS.includes(hint.textContent)) say('');
  };
  const WHY_TEXTS = Object.values(WHY);
  inp.addEventListener('compositionstart', () => (composing = true));
  inp.addEventListener('compositionend', () => {
    composing = false;
    fix();
  });
  inp.addEventListener('input', (e) => {
    if (!composing && !e.isComposing) fix();
  });
  inp.addEventListener('blur', () => {
    composing = false;
    fix();
    inp.value = cleanName(inp.value);
  });
  const clean = () => (inp.value = cleanName(inp.value));
  return { inp, hint, say, clean };
}
