// Диалог: реплика персонажа с портретом и вариантами ответа.
import { el } from '../core/util.js';
import { makeCanvas } from '../core/draw.js';
import { drawPortrait, blinkAt } from '../art/hamster.js';
import { sfx } from '../core/audio.js';
import { openLayer, TAP_GUARD } from './modals.js';

/**
 * Реплика персонажа с вариантами ответа.
 * dialog({ look, name, text, options:[{text, cls}] }) → Promise<index> (-1 — закрыто)
 */
export function dialog({ look, name, text, options = [{ text: 'Пока!' }], happy = false }) {
  return new Promise((resolve) => {
    const closeLayer = openLayer();
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
    const loop = () => {
      const t = (performance.now() - t0) / 1000;
      ctx.clearRect(0, 0, 72, 72);
      drawPortrait(ctx, 36, 36, 72, look, { time: t, talk: t < 1.6, happy, blink: blinkAt(t) });
      raf = requestAnimationFrame(loop);
    };
    loop();
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
    document.body.append(shade, d);
    // у каждого хомячка свой голосок
    let hsh = 0;
    for (const ch of String(name)) hsh = (hsh * 31 + ch.charCodeAt(0)) % 997;
    sfx('squeak', 0.8 + (hsh % 6) * 0.11);
  });
}
