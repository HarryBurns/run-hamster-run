// Транспорт хомячка (этап 17б): самокат, велосипед, машинка-кабриолет.
//
// Покупают в ТЦ «Уютный дом» (вкладка «Колёса»: renderWheelsShop — её зовёт features/shops.js). Купленное лежит
// в state.wheels: own — что есть, use — на чём ездит. В городе в HUD появляется кнопка «Сесть» / «Слезть».
//
// Как устроено. Транспорт — «способ передвижения» героя (sc.p.ride, как кораблик): правило прохода — суша (в воду
// нельзя), скорость — как пешком, а на дорогах (ROAD_TILES: мостовая, площадь, дорожки, плитка, пирс) — быстрее
// в RIDES[id].speed раз. Хомячок на транспорте рисуется кадрами из кэша спрайтов (SP): ключ — вид, внешность,
// сторона, кадр колёс, моргание. Общая часть всех локаций (addWorldPart) даёт кнопку и следит за нажатиями:
//   - ездить можно только в городе (локация с home: true); в лесу, на горе и в других местах без дорог кнопки нет;
//   - нажали на воду (или с клавиатуры упёрлись в воду — ride.bump, с подсказкой) — хомячок слезает сам и идёт
//     пешком (дальше — как обычно: купаться, на кораблик);
//   - вошла в здание или ушла в другое место — слезает сама (ride снимается при смене сцены); вернулась в город —
//     снова едет (транспорт «ждал у двери»), пока сама не нажала «Слезть»;
//   - села на скамейку или кораблик (другой ride) — транспорт убран.
// Питомец едет вместе с хомячком — в корзинке (features/pet.js, petInBasket), слезла — спрыгивает и идёт следом.
// Быстрый переход по карте (sc.skipAlong) и звёздочка задания от транспорта не зависят: путь прокладывает движок
// по правилу прохода текущего ride.
import { G, walkK } from '../core/state.js';
import { addWheels, useWheels, award } from '../core/actions.js';
import { on, emit } from '../core/events.js';
import { scene } from '../core/loop.js';
import { sfx } from '../core/audio.js';
import { el } from '../core/util.js';
import { blinkAt } from '../art/hamster.js';
import { WHEELS_ART, rideIcon, paintRider } from '../art/wheels.js';
import { RIDES, RIDE_BY_ID, ROAD_TILES } from '../data/index.js';
import { PS, SP, TILES, addWorldPart } from '../engine/topdown/index.js';
import { toast } from '../ui/toast.js';
import { buy, priceTag, buyBtn } from './purchase.js';
import { petInBasket } from './pet.js';

const S = () => G.state;
/** Сейчас едем: { sc, id, ride, lk, look } или null. */
let cur = null;
/** Хотим ехать: слезли не сами (вошли в здание) — вернёмся в город и поедем дальше. */
let want = false;

/** Можно ли здесь ездить: только в городе (локация с home: true или wheels: true в описании). */
const roadsHere = (sc) => !!(sc && sc.desc && (sc.desc.home || sc.desc.wheels));
const isRoad = (surf) => ROAD_TILES.includes(surf) || ROAD_TILES.includes((TILES[surf] || {}).like);
/** Едет ли хомячок сейчас на транспорте (id вида или ''). */
export const ridingWheels = () => (cur && cur.sc.p.ride === cur.ride ? cur.id : '');

function lookKey(look) {
  const str = JSON.stringify(look);
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Сесть на транспорт (id — какой; без него — тот, что выбран). quiet — без звука и подсказок. */
export function mountWheels(sc = scene(), id = S().wheels.use, quiet = false) {
  const def = RIDE_BY_ID[id];
  if (!def || !S().wheels.own.includes(id) || !roadsHere(sc) || sc.mode) return false;
  const p = sc.p;
  if (p.ride && !p.ride.relax) return false; // на кораблике
  if (p.ride && p.ride.drop) p.ride.drop(sc); // сидела на скамейке — встала
  const k = TILES[p.surf];
  if (k && k.swim) {
    if (!quiet) toast('В воде не поедешь — сначала выйди на берег.');
    return false;
  }
  const m = sc.map,
    look = sc.heroLook();
  const ride = {
    wheels: id,
    // по дороге — быстрее, по траве и песку — как пешком
    get speed() {
      const base = ((TILES[p.surf] && TILES[p.surf].speed) || 225) * walkK();
      return isRoad(p.surf) ? base * def.speed : base;
    },
    pass: (tx, ty) => m.noSwim(tx, ty),
    step: { sfx: 'wheel', pause: 0 },
    draw: (ctx, _sc, ent, t, lk) => drawRider(ctx, ent, t, lk),
    drop: () => {
      if (cur && cur.ride === ride) cur = null;
    },
    // с клавиатуры упёрлись в воду — слезаем сами, как при нажатии на воду (В7); дальше — пешком или вплавь
    bump: (_sc, tx, ty) => {
      const w = TILES[m.at(tx, ty)];
      if (!w || !w.swim || !cur || cur.ride !== ride) return;
      dismountWheels();
      sfx('tap');
      toast(`${def.icon} Дальше вода — {хомячок слез|хомяшка слезла} и идёт пешком. Снова поехать — кнопка «Поехали!» слева.`);
    },
  };
  p.ride = ride;
  cur = { sc, id, ride, lk: lookKey(look), look };
  want = true;
  if (!quiet) {
    sfx('pop');
    if (award('x_wheels', { delay: 600 }))
      toast(`${def.icon} Поехали! По дорогам — быстрее. В дом и в воду {хомячок|хомяшка} пойдёт пешком.`, 'good');
  }
  emit('hud');
  emit('wheels', { what: 'on', id });
  return true;
}
/** Слезть. keep — «слезла не сама» (вошла в здание): в городе поедем дальше. */
export function dismountWheels(keep = false) {
  const c = cur;
  if (!c) return false;
  cur = null;
  if (c.sc.p.ride === c.ride) c.sc.p.ride = null;
  if (!keep) want = false;
  emit('hud');
  emit('wheels', { what: 'off', id: c.id });
  return true;
}

on('step', () => {
  const c = cur;
  if (!c) return;
  // пересела на кораблик или скамейку — транспорт убран
  if (scene() === c.sc && c.sc.p.ride !== c.ride) {
    cur = null;
    want = false;
    emit('hud');
  }
});
// ушли в другую сцену (дом, магазин, другое место) — слезли; вернёмся в город — поедем дальше
on('scene', () => {
  if (cur && scene() !== cur.sc) dismountWheels(true);
});

// ---------- рисунок (хомячок на транспорте — paintRider в art/wheels.js) ----------
const FRAMES = 4;
/** Хомячок на транспорте: кадр из кэша спрайтов. Внешность меняется (шлёпанцы на пляже) — ключ считаем заново. */
function drawRider(ctx, ent, t, look) {
  const c = cur;
  if (!c) return;
  if (look !== c.look) {
    c.look = look;
    c.lk = lookKey(look);
  }
  const id = c.id,
    rider = c.look,
    d = ent.dir >= 0 ? 1 : -1,
    fr = ent.moving ? Math.floor(((ent.walkT * 1.6) % 1) * FRAMES) % FRAMES : 0,
    shut = blinkAt(t, 0) > 0.5 ? 1 : 0,
    pk = petInBasket(); // питомец едет в корзинке (или на сиденье кабриолета)
  const s = SP.get(`wh:${id}:${c.lk}:${d}:${fr}:${shut}:${pk}`, WHEELS_ART[id].box, (g) =>
    paintRider(g, id, d, fr, rider, shut, PS, pk),
  );
  SP.draw(s, ent.x, ent.y + 10);
}

// ---------- общая часть локаций: кнопка, вода, возвращение в город ----------
addWorldPart({
  enter(sc) {
    // вернулись в город, а слезали не сами — едем дальше
    if (want && !cur && roadsHere(sc) && S().wheels.use) mountWheels(sc, S().wheels.use, true);
  },
  /** Нажали на воду — слезаем: дальше хомячок идёт (и плывёт) как обычно. */
  tap(sc, w, tx, ty) {
    if (!cur || cur.sc !== sc || sc.p.ride !== cur.ride) return false;
    const k = TILES[sc.map.at(tx, ty)];
    if (k && k.swim) dismountWheels();
    return false;
  },
  buttons(sc) {
    const w = S().wheels;
    if (!w || !w.use || !roadsHere(sc) || sc.mode) return [];
    const def = RIDE_BY_ID[w.use],
      riding = !!cur && sc.p.ride === cur.ride;
    if (!riding && sc.p.ride && !sc.p.ride.relax) return []; // на кораблике кнопки нет
    return [
      {
        id: 'wheels',
        icon: def.icon,
        label: riding ? 'Слезть' : 'Поехали!',
        on: riding,
        fn: () => {
          if (riding) {
            dismountWheels();
            sfx('tap');
          } else mountWheels(sc);
        },
      },
    ];
  },
});
on('wheels', () => emit('hud'));

// ---------- магазин: вкладка «Колёса» в ТЦ «Уютный дом» ----------
export function renderWheelsShop(body, panel) {
  const w = S().wheels;
  body.appendChild(
    el(
      'p',
      'muted',
      'На колёсах по городу быстрее! Садись и слезай кнопкой слева. В дома, в воду и туда, где нет дорог, {хомячок|хомяшка} идёт пешком.',
    ),
  );
  const grid = el('div', 'grid');
  for (const r of RIDES) {
    const card = el('div', 'card ride-' + r.id),
      have = w.own.includes(r.id);
    card.appendChild(rideIcon(r.id, 112));
    card.appendChild(el('div', 'nm', r.name));
    card.appendChild(el('div', 'muted', r.about));
    if (!have) {
      card.appendChild(priceTag(r.price));
      card.appendChild(
        buyBtn('Купить', r.price, () => {
          if (!buy(r.price, r.name)) return;
          addWheels(r.id);
          emit('buy', { cat: 'wheels', id: r.id });
          toast(`${r.icon} ${r.name} — твой! На улице нажми кнопку «Поехали!».`, 'good');
          panel.refresh();
        }),
      );
    } else if (w.use === r.id) {
      card.appendChild(el('span', 'cnt', '✓'));
      card.appendChild(el('div', 'muted', '<b>На этом ты ездишь.</b>'));
    } else {
      card.appendChild(el('span', 'cnt', '✓'));
      const b = el('button', 'btn small blue', 'Ездить на этом');
      b.onclick = () => {
        sfx('tap');
        const was = ridingWheels();
        if (was) dismountWheels();
        useWheels(r.id);
        panel.refresh();
      };
      card.appendChild(b);
    }
    grid.appendChild(card);
  }
  body.appendChild(grid);
}

/** Для тестов: на чём едем, хотим ли ехать дальше, скорость сейчас. */
export const wheelsDebug = () => ({ riding: ridingWheels(), want, speed: cur ? cur.ride.speed : 0 });
