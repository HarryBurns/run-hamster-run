// Файлы: отдать игроку текст файлом и попросить выбрать файл. Нужны «Моим играм» (выгрузка и загрузка игры,
// features/title.js); сами про игру ничего не знают.
import { el } from '../core/util.js';

/** Скачать текст файлом name. На iPad Safari спросит «Загрузить?» и положит файл в «Файлы → Загрузки». */
export function downloadText(name, text, type = 'application/json') {
  try {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = el('a');
    a.href = url;
    a.download = name;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000); // не сразу: Safari читает ссылку после нажатия
    return true;
  } catch (e) {
    return false;
  }
}

const MAX_BYTES = 16e6;
/**
 * Попросить выбрать файл и прочитать его как текст. Возвращает { name, text } или { name, error: 'big' | 'read' };
 * если выбор отменили — null (в браузерах без события cancel обещание просто не завершится — это не мешает).
 */
export function pickTextFile(accept = '.json,application/json,text/plain') {
  return new Promise((done) => {
    const inp = el('input');
    inp.type = 'file';
    inp.accept = accept;
    inp.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    const end = (v) => {
      inp.remove();
      done(v);
    };
    inp.addEventListener('cancel', () => end(null));
    inp.addEventListener('change', () => {
      const f = inp.files && inp.files[0];
      if (!f) return end(null);
      if (f.size > MAX_BYTES) return end({ name: f.name, error: 'big' });
      const r = new FileReader();
      r.onload = () => end({ name: f.name, text: String(r.result || '') });
      r.onerror = () => end({ name: f.name, error: 'read' });
      r.readAsText(f);
    });
    document.body.appendChild(inp); // Safari на iPad шлёт change только полю, которое есть на странице
    inp.click();
  });
}
