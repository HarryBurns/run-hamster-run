// Карта города: нажми на место — хомячок сама туда дойдёт.
import { sfx } from '../core/audio.js';
import { makeCanvas } from '../core/draw.js';
import { go, sceneName } from '../core/loop.js';
import { el } from '../core/util.js';
import { NPC_BY_ID } from '../data/index.js';
import * as World from '../locations/town.js';
import { openPanel } from '../ui/panel.js';
import { toast } from '../ui/toast.js';

/** Карта города: нажми на место — хомячок сам туда дойдёт. */
export function openMap() {
  let raf = 0;
  const walkTo = (id, name, panel) => {
    if (sceneName() !== 'world') go('world');
    if (World.walkToPlace(id)) {
      sfx('ok');
      toast(`Идём: ${name} 🐾`);
      panel.close();
    } else toast('Туда сейчас не пройти');
  };
  openPanel({
    title: 'Карта города',
    icon: '🗺️',
    cls: 'wide',
    onClose: () => cancelAnimationFrame(raf),
    render(body, tab, panel) {
      const k = Math.max(4, Math.min(11, Math.floor(((Math.min(window.innerWidth, 980) - 60) / World.MW) * 2) / 2));
      const { canvas, ctx } = makeCanvas(World.MW * k, World.MH * k);
      canvas.style.cssText +=
        ';display:block;margin:0 auto;border-radius:14px;max-width:100%;height:auto;touch-action:manipulation';
      // Карта неподвижна (мир на паузе): рисуем её один раз в отдельную канву, а в каждом кадре
      // обновляем только квадратик вокруг мигающей точки игрока.
      const base = makeCanvas(World.MW * k, World.MH * k);
      World.drawMiniMapBase(base.ctx, k);
      const r = canvas.width / (World.MW * k),
        p = World.playerPos(),
        R = k * 0.9 + 10; // r — пикселей канвы в CSS-пикселе
      const bx = Math.max(0, Math.floor(((p.x / World.T) * k - R) * r)),
        by = Math.max(0, Math.floor(((p.y / World.T) * k - R) * r)),
        bs = Math.ceil(2 * R * r);
      let first = true;
      const loop = () => {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        if (first) {
          ctx.drawImage(base.canvas, 0, 0);
          first = false;
        } else ctx.drawImage(base.canvas, bx, by, bs, bs, bx, by, bs, bs);
        ctx.restore();
        World.drawMiniMapPlayer(ctx, k);
        raf = requestAnimationFrame(loop);
      };
      cancelAnimationFrame(raf);
      loop();
      canvas.onclick = (e) => {
        const r = canvas.getBoundingClientRect();
        const b = World.mapHit(
          ((e.clientX - r.left) / r.width) * World.MW,
          ((e.clientY - r.top) / r.height) * World.MH,
        );
        if (b) walkTo(b.id, b.npc ? `домик (${NPC_BY_ID[b.npc].name})` : b.name, panel);
      };
      body.appendChild(canvas);
      body.appendChild(
        el(
          'p',
          'muted center',
          'Розовая точка — это ты. Нажми на место на карте или на кнопку — и хомячок сама туда дойдёт.',
        ),
      );
      const row = el('div', 'opt-row');
      row.style.justifyContent = 'center';
      const places = [
        ...World.BUILDINGS.filter((b) => !b.npc).map((b) => [b.id, `${b.kind === 'villa' ? '🏡' : b.icon} ${b.name}`]),
        ['beach', '🏖️ Пляж'],
        ['pier', '🎣 Пирс'],
      ];
      for (const [id, name] of places) {
        const bt = el('button', 'opt', name);
        bt.onclick = () => walkTo(id, name, panel);
        row.appendChild(bt);
      }
      body.appendChild(row);
    },
  });
}
