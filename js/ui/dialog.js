// Диалог: реплика персонажа с портретом и вариантами ответа.
import { el } from '../core/util.js';
import { makeCanvas } from '../core/draw.js';
import { drawPortrait, blinkAt } from '../art/hamster.js';
import { sfx } from '../core/audio.js';
import { defaultLook } from '../data/index.js';
import { openLayer, TAP_GUARD } from './modals.js';

/**
 * Реплика персонажа с вариантами ответа.
 * dialog({ look, name, text, options:[{text, cls}] }) → Promise<index> (-1 — закрыто)
 */
export function dialog({ look, name, text, options = [{ text: 'Пока!' }], happy = false }) {
  return new Promise((resolve) => {
    // Сначала собираем окно и только потом берём слой паузы: ошибка при сборке не оставит игру на паузе без окна.
    const shade = el('div', 'dialog-shade');
    const d = el('div', 'dialog');
    const who = el('div', 'who');
    const { canvas, ctx } = makeCanvas(72, 72);
    who.appendChild(canvas);
    const right = el('div');
    right.appendChild(el('div', 'name', name));
    right.appendChild(el('div', 'say', text));
    who.appendChild(right);
    d.appendChild(who);
    const opts = el('div', 'opts');
    d.appendChild(opts);
    let raf = 0,
      closed = false;
    const t0 = performance.now(),
      ready = () => performance.now() - t0 > TAP_GUARD;
    // Портрет не нарисовался (испорченная внешность) — рисуем хомячка по умолчанию, а если и он не вышел —
    // оставляем пустую рамку: диалог важнее картинки.
    let face = look;
    const loop = () => {
      const t = (performance.now() - t0) / 1000;
      ctx.clearRect(0, 0, 72, 72);
      try {
        drawPortrait(ctx, 36, 36, 72, face, { time: t, talk: t < 1.6, happy, blink: blinkAt(t) });
      } catch (e) {
        if (face === look) {
          console.error(e);
          face = defaultLook();
        } else return; // и хомячок по умолчанию не нарисовался — дальше без анимации
      }
      raf = requestAnimationFrame(loop);
    };
    const fin = (i) => {
      if (closed) return;
      closed = true;
      cancelAnimationFrame(raf);
      d.remove();
      shade.remove();
      closeLayer();
      resolve(i);
    };
    options.forEach((o, i) => {
      const b = el('button', 'btn ' + (o.cls || (i === options.length - 1 ? 'ghost' : '')), o.text);
      b.onclick = () => {
        if (!ready()) return;
        sfx('tap');
        fin(i);
      };
      opts.appendChild(b);
    });
    // диалог с выбором закрывается только кнопкой; с одной кнопкой — ещё и нажатием мимо
    shade.addEventListener('pointerdown', () => {
      if (options.length <= 1 && ready()) fin(-1);
    });
    const closeLayer = openLayer();
    document.body.append(shade, d);
    loop();
    // у каждого хомячка свой голосок
    let hsh = 0;
    for (const ch of String(name)) hsh = (hsh * 31 + ch.charCodeAt(0)) % 997;
    sfx('squeak', 0.8 + (hsh % 6) * 0.11);
  });
}
