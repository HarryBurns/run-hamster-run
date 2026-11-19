// Карта локации, где сейчас хомячок (пока он в доме — той, что снаружи): нажми на место — он сам туда дойдёт.
// Быстрый переход (Ф4): к месту, где хомячок уже побывала (state.visited — дошла и зашла / сделала там что-то),
// дальняя дорога — коротким затемнением «🐾 …», и хомячок уже в двух шагах от цели; эти шаги — пешком, так что
// всё, что ждёт «дошла» (вход в здание, место, выход в другую локацию, задания), срабатывает как обычно.
// Где ещё не была — идёт пешком, как раньше: город надо сначала обойти самой.
// Под картой города — «Тайные места» (LANDS в data/places.js): закрытые — серым силуэтом с замочком; нажми —
// подсказка, кто знает дорогу (действие way, features/quests.js).
import { sfx } from '../core/audio.js';
import { makeCanvas } from '../core/draw.js';
import { go, sceneName } from '../core/loop.js';
import { run } from '../core/registry.js';
import { landOpen, wasAt } from '../core/state.js';
import { el } from '../core/util.js';
import { NPC_BY_ID, LANDS, HOME_LAND, ROUTE_WORDS, routeTo, landOf } from '../data/index.js';
import { T, currentLocation, homeLocation } from '../engine/topdown/index.js';
import { fadeTo } from '../ui/fade.js';
import { openPanel } from '../ui/panel.js';
import { toast } from '../ui/toast.js';

// «Карта мира» (этап 11): в каком месте сейчас цель звёздочки — говорит журнал (features/quests.js, starScene)
let mapGoal = () => null;
/** Кто знает, в каком месте (имя сцены) цель звёздочки: fn() → имя сцены | null. */
export function setMapGoal(fn) {
  mapGoal = fn;
}
/** Как пройти из места from в место to — словами: «🌲 Лес → ⛰️ Гора: сначала по тропе в лес». '' — дороги нет. */
export function routeText(from, to) {
  const r = routeTo(from, to, landOpen);
  if (!r) return '';
  const names = r.path
    .slice(1)
    .map((id) => `${landOf(id).icon} ${landOf(id).name}`)
    .join(' → ');
  return `${names}: ${r.path.length > 2 ? 'сначала ' : ''}${ROUTE_WORDS[from][r.next]}`;
}

const FAST_FROM = 8; // быстрый переход — если идти дальше стольких клеток
const FAST_MS = 650; // сколько длится затемнение быстрого перехода (мс)

/** Карта текущей локации: нажми на место — хомячок сам туда дойдёт. */
export function openMap() {
  let raf = 0;
  const loc = currentLocation(); // сцена-локация (engine/topdown/scene.js)
  const walkTo = (id, name, panel, been = wasAt(loc.name, id)) => {
    if (sceneName() !== loc.name) go(loc.name);
    if (!loc.walkToPlace(id)) {
      toast('Туда сейчас не пройти');
      return;
    }
    sfx('ok');
    panel.close();
    if (been && loc.pathLength() > FAST_FROM * T) {
      // уже была здесь — быстро: затемнение, и хомячок почти у цели (последние шаги — пешком)
      fadeTo(`🐾 ${name}`, FAST_MS).then((uncover) => {
        loc.skipAlong();
        uncover();
      });
      return;
    }
    toast(`Идём: ${name} 🐾`);
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
          'Розовая точка — это ты. Нажми на место на карте или на кнопку — и хомячок сама туда дойдёт. Где ты уже была (⚡) — доберёшься быстро.',
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
        const been = wasAt(loc.name, id),
          bt = el('button', 'opt' + (been ? ' been' : ''), been ? `${name} ⚡` : name);
        bt.onclick = () => walkTo(id, name, panel);
        row.appendChild(bt);
      }
      body.appendChild(row);
      body.appendChild(landsRow(panel, loc, (id, name, been) => walkTo(id, name, panel, been)));
    },
  });
}

/**
 * «Карта мира» под картой места: город и тайные места (LANDS). Закрытое место — силуэт с замочком; нажми — подсказка,
 * кто знает дорогу. Открытое — хомячок сама идёт к выходу или транспорту, который ведёт в ту сторону (граф ROUTES
 * в data/places.js; где уже была — быстрый переход), морской путь — к кораблику, а на нём — по морю. ⭐ — в этом месте цель
 * звёздочки (задание журнала, праздник, письмо), 📍 — здесь хомячок сейчас.
 */
function landsRow(panel, loc, walk) {
  const box = el('div', 'lands'),
    home = loc === homeLocation(),
    goal = mapGoal();
  box.appendChild(el('div', 'lands-h', home ? '🗝️ Тайные места' : '🗺️ Карта мира'));
  if (goal && goal !== loc.name && landOf(goal)) {
    const way = routeText(loc.name, goal);
    if (way) box.appendChild(el('p', 'muted center lands-goal', `⭐ Звёздочка ведёт в другое место: ${way}.`));
  }
  const row = el('div', 'lands-row');
  /** Идти в открытое место land (не то, где хомячок сейчас). */
  const travel = (land) => {
    const r = routeTo(loc.name, land.id, landOpen);
    if (!r) return void toast(`${land.icon} ${land.name}: отсюда туда пока нет дороги.`);
    const far = r.path.length > 2 ? ` Дорога: ${routeText(loc.name, land.id)}.` : '';
    if (r.via.startsWith('sea:')) {
      // морской путь (В14): хомячок идёт к кораблику, садится и плывёт к причалу, буйку или отметке; у кораблика
      // уже была — быстрый переход (⚡)
      walk(r.via, `${land.icon} ${land.name}`, wasAt(loc.name, 'boat') || wasAt(loc.name, 'pier'));
      toast(`⛵ ${land.name}: ${ROUTE_WORDS[loc.name][r.next]}.`);
      return;
    }
    // к выходу, через который сюда пришли, — быстро: хомячок там уже была
    walk(r.via, `${land.icon} ${land.name}`, r.via.startsWith('exit:') || wasAt(loc.name, r.via));
    if (far) toast(far.trim());
  };
  const add = (land, cls, inner, title, fn) => {
    const b = el('button', cls, inner);
    b.title = title;
    b.onclick = () => {
      sfx('tap');
      fn();
    };
    row.appendChild(b);
  };
  const star = (id) => (goal === id && id !== loc.name ? '<span class="st">⭐</span>' : '');
  if (!home)
    add(
      HOME_LAND,
      'land-town open' + (goal === HOME_LAND.id ? ' goal' : ''),
      `<span class="ic">${HOME_LAND.icon}</span><span class="nm">${HOME_LAND.name}</span>${star(HOME_LAND.id)}`,
      'Город — дорога домой',
      () => travel(HOME_LAND),
    );
  for (const land of LANDS) {
    const open = landOpen(land.id),
      here = land.id === loc.name;
    add(
      land,
      'land' + (open ? ' open' : '') + (here ? ' here' : '') + (goal === land.id && !here ? ' goal' : ''),
      `<span class="ic">${land.icon}</span>${open ? '' : '<span class="lk">🔒</span>'}<span class="nm">${land.name}</span>${here ? '<span class="st">📍</span>' : star(land.id)}`,
      here
        ? `${land.name} — ты здесь`
        : open
          ? `${land.name} — открыто!`
          : `${land.name} — закрыто. Кто знает дорогу: ${land.who}`,
      () => {
        if (here) return void toast(`${land.icon} ${land.name} — ты уже здесь!`);
        if (open && land.scene) return void travel(land);
        panel.close();
        run('way:' + land.id);
      },
    );
  }
  box.appendChild(row);
  return box;
}
