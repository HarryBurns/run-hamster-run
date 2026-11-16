// Карта локации, где сейчас хомячок (пока он в доме — той, что снаружи): нажми на место — он сам туда дойдёт.
// Под картой города — «Тайные места» (LANDS в data/places.js): закрытые — серым силуэтом с замочком; нажми —
// подсказка, кто знает дорогу (действие way, features/quests.js).
import { sfx } from '../core/audio.js';
import { makeCanvas } from '../core/draw.js';
import { go, sceneName } from '../core/loop.js';
import { run } from '../core/registry.js';
import { landOpen } from '../core/state.js';
import { el } from '../core/util.js';
import { NPC_BY_ID, LANDS } from '../data/index.js';
import { T, currentLocation, homeLocation } from '../engine/topdown/index.js';
import { openPanel } from '../ui/panel.js';
import { toast } from '../ui/toast.js';

/** Карта текущей локации: нажми на место — хомячок сам туда дойдёт. */
export function openMap() {
  let raf = 0;
  const loc = currentLocation(); // сцена-локация (engine/topdown/scene.js)
  const walkTo = (id, name, panel) => {
    if (sceneName() !== loc.name) go(loc.name);
    if (loc.walkToPlace(id)) {
      sfx('ok');
      toast(`Идём: ${name} 🐾`);
      panel.close();
    } else toast('Туда сейчас не пройти');
  };
  openPanel({
    title: loc.desc.title || 'Карта',
    icon: '🗺️',
    cls: 'wide',
    onClose: () => cancelAnimationFrame(raf),
    render(body, tab, panel) {
      const k = Math.max(4, Math.min(11, Math.floor(((Math.min(window.innerWidth, 980) - 60) / loc.w) * 2) / 2));
      const { canvas, ctx } = makeCanvas(loc.w * k, loc.h * k);
      canvas.style.cssText +=
        ';display:block;margin:0 auto;border-radius:14px;max-width:100%;height:auto;touch-action:manipulation';
      // Карта неподвижна (мир на паузе): рисуем её один раз в отдельную канву, а в каждом кадре
      // обновляем только квадратик вокруг мигающей точки игрока.
      const base = makeCanvas(loc.w * k, loc.h * k);
      loc.drawMiniMapBase(base.ctx, k);
      const r = canvas.width / (loc.w * k),
        p = loc.playerPos(),
        R = k * 0.9 + 10; // r — пикселей канвы в CSS-пикселе
      const bx = Math.max(0, Math.floor(((p.x / T) * k - R) * r)),
        by = Math.max(0, Math.floor(((p.y / T) * k - R) * r)),
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
        loc.drawMiniMapPlayer(ctx, k);
        raf = requestAnimationFrame(loop);
      };
      cancelAnimationFrame(raf);
      loop();
      canvas.onclick = (e) => {
        const r = canvas.getBoundingClientRect();
        const b = loc.mapHit(((e.clientX - r.left) / r.width) * loc.w, ((e.clientY - r.top) / r.height) * loc.h);
        if (b) walkTo(b.id, b.npc ? `домик (${NPC_BY_ID[b.npc].name})` : b.mapName || b.name, panel);
      };
      body.appendChild(canvas);
      body.appendChild(
        el(
          'p',
          'muted center',
          'Розовая точка — это ты. Нажми на место на карте или на кнопку — и хомячок сама туда дойдёт.',
        ),
      );
      // что сейчас растёт: значки плодовых растений на карте (common/plants.js) — подпись, что они значат
      const fruit = (loc.desc.parts || []).find((p) => p.ripeIcons);
      const icons = fruit ? fruit.ripeIcons() : [];
      if (icons.length)
        body.appendChild(
          el(
            'p',
            'muted center map-fruit',
            `${icons.join(' ')} — здесь сейчас можно собрать урожай. Бледный значок — сегодня уже собрано, завтра поспеет снова.`,
          ),
        );
      const row = el('div', 'opt-row');
      row.style.justifyContent = 'center';
      for (const [id, name] of loc.mapPlaces()) {
        const bt = el('button', 'opt', name);
        bt.onclick = () => walkTo(id, name, panel);
        row.appendChild(bt);
      }
      body.appendChild(row);
      if (loc === homeLocation()) body.appendChild(landsRow(panel, (id, name) => walkTo(id, name, panel)));
    },
  });
}

/**
 * «Тайные места»: силуэт с замочком, пока место закрыто; нажми — подсказка. Открытое место со сценой и входом
 * в городе (лес — ворота на тропе) — хомячок сама идёт к входу (walk), как по кнопке «дойти».
 */
function landsRow(panel, walk) {
  const box = el('div', 'lands');
  box.appendChild(el('div', 'lands-h', '🗝️ Тайные места'));
  const row = el('div', 'lands-row');
  for (const land of LANDS) {
    const open = landOpen(land.id);
    const b = el(
      'button',
      'land' + (open ? ' open' : ''),
      `<span class="ic">${land.icon}</span>${open ? '' : '<span class="lk">🔒</span>'}<span class="nm">${land.name}</span>`,
    );
    b.title = open ? `${land.name} — открыто!` : `${land.name} — закрыто. Кто знает дорогу: ${land.who}`;
    b.onclick = () => {
      sfx('tap');
      if (open && land.scene && land.from === 'world' && homeLocation().spot(land.id)) {
        walk(land.id, `${land.icon} ${land.name}`);
        return;
      }
      // открытое место, вход в которое не из города (гора — из леса): подсказать, где вход
      if (open && land.scene && land.from !== 'world') {
        toast(`${land.icon} ${land.name} ${land.opened || 'открыт'}! Вход — ${land.at}.`);
        return;
      }
      panel.close();
      run('way:' + land.id);
    };
    row.appendChild(b);
  }
  box.appendChild(row);
  return box;
}
