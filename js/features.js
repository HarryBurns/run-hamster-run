// Всё, чем можно заняться: магазины, гардероб, салон, готовка, гости, почта, сад, рыбалка, сон.
import {
  el,
  esc,
  fmtMoney,
  pick,
  rnd,
  shuffle,
  plural,
  makeCanvas,
  ell,
  fillRR,
  poly,
  mix,
  star,
  text as ctext,
  emoji,
  clamp,
} from './util.js';
import {
  CLOTHES,
  CLOTHES_BY_ID,
  SLOTS,
  BEAUTY,
  FURNITURE,
  FURN_BY_ID,
  FURN_CATS,
  INGREDIENTS,
  ING_BY_ID,
  SEEDS,
  SEED_BY_ID,
  DISHES,
  DISH_BY_ID,
  SECRET_RECIPES,
  NPCS,
  NPC_BY_ID,
  npcLook,
  vendorLook,
  VENDORS,
  TASKS,
  TASK_BY_ID,
  EXTRA_STICKERS,
  SEASON_LINES,
  OUTFIT_LINES,
  PLACES,
  SEASONS,
  FASHION_THEMES,
  resolveLook,
} from './data.js';
import {
  G,
  cal,
  save,
  spend,
  hasClothes,
  addClothes,
  addTo,
  count,
  canCook,
  friendHearts,
  addSticker,
  playerLook,
  outfitTags,
  rollDay,
  darkness,
} from './game.js';
import {
  toast,
  openPanel,
  message,
  confirmBox,
  dialog,
  clothesIcon,
  furnIcon,
  hamsterStage,
  fadeTo,
  whenFree,
} from './ui.js';
import { drawPortrait, drawHamster, blinkAt } from './hamster.js';
import { sfx } from './audio.js';
import { runMinigame } from './minigames/host.js';
import * as World from './world.js';
import * as Villa from './villa.js';

const price = (n) => `🪙 ${fmtMoney(n)}`;
const S = () => G.state;

function buy(cost, what) {
  if (!spend(cost)) {
    toast('Не хватает монет… (как так?!)');
    return false;
  }
  sfx('coin');
  if (S().spent >= 1_000_000 && addSticker('x_rich'))
    setTimeout(() => toast('Новая наклейка: 💰 Потратила миллион!', 'good'), 800);
  if (what) toast(`Куплено: ${what}`, 'good');
  save();
  return true;
}

// =====================================================================
//                         ОДЕЖДА: магазин и шкаф
// =====================================================================
/**
 * Окно с одеждой. mode: 'shop' (покупка + примерка) или 'wardrobe' (свои вещи).
 * opts: { title, portrait, shops:[...], foot, onClose, sticky, hint }
 */
export function clothesPanel(mode, opts = {}) {
  const st = hamsterStage(150, 168, 1.6);
  let tryOn = {}; // примерка в магазине: slot → id
  const lookNow = () => {
    const l = S().look;
    return resolveLook({ ...l, outfit: { ...l.outfit, ...tryOn } });
  };
  let raf = 0;
  const t0 = performance.now();
  const loop = () => {
    st.redraw(lookNow(), { time: (performance.now() - t0) / 1000, blink: blinkAt((performance.now() - t0) / 1000) });
    raf = requestAnimationFrame(loop);
  };
  loop();
  const season = cal().season;
  return openPanel({
    title: opts.title || 'Шкаф',
    icon: opts.icon || '👗',
    portrait: opts.portrait,
    money: mode === 'shop',
    cls: 'wide',
    sticky: opts.sticky,
    tabs: SLOTS.map((s) => ({ id: s.id, name: `${s.icon} ${s.name}` })),
    foot: opts.foot,
    onClose: () => {
      cancelAnimationFrame(raf);
      if (opts.onClose) opts.onClose();
    },
    render(body, tab, panel) {
      const split = el('div', 'split');
      const side = el('div', 'side');
      side.appendChild(st.canvas);
      if (opts.hint) side.appendChild(el('div', 'muted center', opts.hint));
      if (mode === 'shop') side.appendChild(el('div', 'muted center', 'Нажми на вещь,<br>чтобы примерить'));
      split.appendChild(side);
      const main = el('div', 'main');
      const grid = el('div', 'grid');
      let items = CLOTHES.filter((c) => c.slot === tab);
      if (mode === 'shop') {
        items = items.filter((c) => opts.shops.includes(c.shop));
        items.sort(
          (a, b) => (b.season === season) - (a.season === season) || b.tags.includes(season) - a.tags.includes(season),
        );
      } else items = items.filter((c) => hasClothes(c.id));
      if (!items.length)
        main.appendChild(
          el(
            'p',
            'muted center',
            mode === 'shop' ? 'В этом отделе пока пусто.' : 'Здесь пока ничего нет. Загляни в магазины!',
          ),
        );
      for (const it of items) {
        const owned = hasClothes(it.id),
          worn = S().look.outfit[it.slot] === it.id,
          trying = tryOn[it.slot] === it.id;
        const card = el('div', 'card tap' + (worn || trying ? ' sel' : ''));
        card.appendChild(clothesIcon(it, 84));
        card.appendChild(el('div', 'nm', it.name));
        if (mode === 'shop' && it.season === season) card.appendChild(el('span', 'badge season', 'Сезон!'));
        if (mode === 'shop') {
          if (owned) {
            card.appendChild(el('span', 'badge', 'Есть ✓'));
            card.appendChild(el('div', 'muted', worn ? 'Надето' : 'В шкафу'));
          } else {
            card.appendChild(el('div', 'pr', price(it.price)));
            const b = el('button', 'btn small green', 'Купить');
            b.onclick = (e) => {
              e.stopPropagation();
              if (!buy(it.price, it.name)) return;
              addClothes(it.id);
              S().look.outfit[it.slot] = it.id;
              delete tryOn[it.slot];
              G.emit('buy', { cat: 'clothes', id: it.id });
              G.emit('look');
              panel.refresh();
            };
            card.appendChild(b);
          }
          card.onclick = () => {
            sfx('pop');
            if (owned) {
              S().look.outfit[it.slot] = worn ? null : it.id;
              delete tryOn[it.slot];
              G.emit('look');
            } else if (trying) delete tryOn[it.slot];
            else tryOn[it.slot] = it.id;
            panel.refresh();
          };
        } else {
          if (worn) card.appendChild(el('span', 'badge', 'Надето'));
          card.onclick = () => {
            sfx('pop');
            S().look.outfit[it.slot] = worn ? null : it.id;
            G.emit('look');
            save();
            panel.refresh();
          };
        }
        grid.appendChild(card);
      }
      main.appendChild(grid);
      split.appendChild(main);
      body.appendChild(split);
    },
  });
}
export function openWardrobe() {
  clothesPanel('wardrobe', { title: 'Мой шкаф', icon: '🚪' });
}

// =====================================================================
//                             САЛОН КРАСОТЫ
// =====================================================================
function openSalon() {
  const st = hamsterStage(150, 168, 1.6);
  let raf = 0;
  const t0 = performance.now();
  const loop = () => {
    st.redraw(playerLook(), { time: (performance.now() - t0) / 1000 });
    raf = requestAnimationFrame(loop);
  };
  loop();
  openPanel({
    title: 'Салон красоты',
    portrait: vendorLook('salon'),
    money: true,
    cls: 'wide',
    onClose: () => cancelAnimationFrame(raf),
    render(body, tab, panel) {
      const split = el('div', 'split');
      const side = el('div', 'side');
      side.appendChild(st.canvas);
      split.appendChild(side);
      const main = el('div', 'main');
      const b = S().look.beauty;
      for (const [key, cat] of Object.entries(BEAUTY)) {
        main.appendChild(el('h4', '', `${cat.icon} ${cat.name} <span class="muted">— ${price(cat.price)}</span>`));
        const row = el('div', 'opt-row');
        for (const o of cat.options) {
          const cur =
            (b[key] === undefined ? null : b[key]) === o.v ||
            (key === 'tuft' && (b.tuft || 0) === o.v) ||
            (key === 'lashes' && !!b.lashes === o.v);
          const btn = el(
            'button',
            'opt' + (cur ? ' sel' : ''),
            (o.c ? `<span class="dotc" style="background:${o.c}"></span>` : '') + o.name,
          );
          btn.onclick = () => {
            if (cur) return;
            if (!buy(cat.price)) return;
            b[key] = o.v;
            sfx('magic');
            G.emit('salon');
            G.emit('look');
            save();
            panel.refresh();
          };
          row.appendChild(btn);
        }
        main.appendChild(row);
      }
      split.appendChild(main);
      body.appendChild(split);
    },
  });
}

// =====================================================================
//                       МАГАЗИНЫ: мебель, продукты, кафе
// =====================================================================
function ownedFurn(id) {
  return (S().storage[id] || 0) + S().villa.filter((i) => i.id === id).length;
}
function openHomeMall() {
  openPanel({
    title: 'ТЦ «Уютный дом»',
    portrait: vendorLook('home'),
    money: true,
    cls: 'wide',
    tabs: [...FURN_CATS.map((c) => ({ id: c.id, name: `${c.icon} ${c.name}` })), { id: 'seeds', name: '🌱 Семена' }],
    render(body, tab, panel) {
      const grid = el('div', 'grid');
      if (tab === 'seeds') {
        for (const sd of SEEDS) {
          const ing = ING_BY_ID[sd.crop];
          const card = el('div', 'card');
          card.appendChild(el('div', 'e', ing.e));
          card.appendChild(el('div', 'nm', sd.name));
          card.appendChild(el('div', 'muted', `растёт ${sd.days} ${plural(sd.days, 'день', 'дня', 'дней')}`));
          card.appendChild(el('div', 'pr', price(sd.price)));
          if (count('seeds', sd.id)) card.appendChild(el('span', 'cnt', '×' + count('seeds', sd.id)));
          const b = el('button', 'btn small green', 'Купить');
          b.onclick = () => {
            if (buy(sd.price)) {
              addTo('seeds', sd.id, 1);
              G.emit('buy', { cat: 'seeds' });
              panel.refresh();
            }
          };
          card.appendChild(b);
          grid.appendChild(card);
        }
        body.appendChild(el('p', 'muted', 'Семена сажают на грядках во дворе виллы.'));
      } else {
        for (const f of FURNITURE.filter((q) => q.cat === tab && q.shop === 'home')) {
          const card = el('div', 'card');
          card.appendChild(furnIcon(f, 112));
          card.appendChild(el('div', 'nm', f.name));
          card.appendChild(el('div', 'pr', price(f.price)));
          if (ownedFurn(f.id)) card.appendChild(el('span', 'cnt', '×' + ownedFurn(f.id)));
          const b = el('button', 'btn small green', 'Купить');
          b.onclick = () => {
            if (!buy(f.price)) return;
            addTo('storage', f.id, 1);
            G.emit('buy', { cat: 'furniture', id: f.id });
            toast(`${f.name} — в кладовке. Дома нажми 🔨, чтобы поставить!`, 'good');
            panel.refresh();
          };
          card.appendChild(b);
          grid.appendChild(card);
        }
      }
      body.appendChild(grid);
    },
  });
}
function openFoodMall() {
  openPanel({
    title: 'ТЦ «Вкусный»',
    portrait: vendorLook('food'),
    money: true,
    cls: 'wide',
    render(body, tab, panel) {
      body.appendChild(
        el(
          'p',
          'muted',
          'Морковку, клубнику, помидоры, тыкву и семечки вырасти на грядках, рыбку поймай сама. А кокосы можно стрясти с любой пальмы — бесплатно!',
        ),
      );
      const grid = el('div', 'grid');
      for (const ing of INGREDIENTS.filter((i) => i.src === 'shop')) {
        const card = el('div', 'card');
        card.appendChild(el('div', 'e', ing.e));
        card.appendChild(el('div', 'nm', ing.name));
        card.appendChild(el('div', 'pr', price(ing.price)));
        if (count('ing', ing.id)) card.appendChild(el('span', 'cnt', '×' + count('ing', ing.id)));
        const row = el('div', 'row');
        for (const n of [1, 5]) {
          const b = el('button', 'btn small ' + (n === 1 ? 'green' : 'blue'), '+' + n);
          b.onclick = () => {
            if (buy(ing.price * n)) {
              addTo('ing', ing.id, n);
              G.emit('buy', { cat: 'food' });
              panel.refresh();
            }
          };
          row.appendChild(b);
        }
        card.appendChild(row);
        grid.appendChild(card);
      }
      body.appendChild(grid);
    },
  });
}
function openCafe(kind, title) {
  openPanel({
    title,
    portrait: vendorLook(kind),
    money: true,
    render(body, tab, panel) {
      const grid = el('div', 'grid');
      for (const d of DISHES.filter((q) => q.cafe === kind)) {
        const card = el('div', 'card');
        card.appendChild(el('div', 'e', d.e));
        card.appendChild(el('div', 'nm', d.name));
        card.appendChild(el('div', 'pr', price(d.price)));
        if (count('dishes', d.id)) card.appendChild(el('span', 'cnt', '×' + count('dishes', d.id)));
        const b = el('button', 'btn small green', 'Купить');
        b.onclick = () => {
          if (buy(d.price, d.name)) {
            addTo('dishes', d.id, 1);
            G.emit('buy', { cat: 'dish', id: d.id });
            panel.refresh();
          }
        };
        const b2 = el('button', 'btn small yellow', 'Съесть тут');
        b2.onclick = () => {
          if (buy(d.price)) {
            sfx('eat');
            toast(`Ням-ням! ${d.e} ${d.name}`, 'good');
            G.emit('buy', { cat: 'dish', id: d.id });
            G.emit('eat');
            panel.refresh();
          }
        };
        card.append(b, b2);
        grid.appendChild(card);
      }
      body.appendChild(grid);
    },
  });
}

// =====================================================================
//                    ЗДАНИЯ ГОРОДА: что происходит на входе
// =====================================================================
export async function enterBuilding(id) {
  const v = (k) => ({ look: vendorLook(k), name: VENDORS[k].name });
  switch (id) {
    case 'villa':
      G.go('villa', 'world');
      break;
    case 'mall_fashion':
      clothesPanel('shop', { title: 'ТЦ «Модный»', portrait: vendorLook('mall'), shops: ['mall'] });
      break;
    case 'boutique':
      clothesPanel('shop', { title: 'Бутик «Бантик»', portrait: vendorLook('boutique'), shops: ['boutique'] });
      break;
    case 'mall_home':
      openHomeMall();
      break;
    case 'mall_food':
      openFoodMall();
      break;
    case 'salon':
      openSalon();
      break;
    case 'cafe':
      openCafe('cafe', 'Кафе «Семечка»');
      break;
    case 'rest': {
      const i = await dialog({
        ...v('rest'),
        text: 'Добро пожаловать в «Золотой орешек»! Желаете поужинать — или поможете мне на кухне?',
        options: [{ text: '👩‍🍳 Помочь на кухне', cls: 'green' }, { text: '🍽️ Меню' }, { text: 'Пока!' }],
      });
      if (i === 0) playMinigame('chef');
      else if (i === 1) openCafe('rest', 'Ресторан «Золотой орешек»');
      break;
    }
    case 'beachcafe': {
      const i = await dialog({
        ...v('beach'),
        text: 'Привет! У нас холодный лимонад и всё для пляжа. Что тебе показать?',
        options: [{ text: '🍹 Вкусняшки', cls: 'green' }, { text: '🩱 Пляжные вещи' }, { text: 'Пока!' }],
      });
      if (i === 0) openCafe('beach', 'Пляжное кафе');
      else if (i === 1)
        clothesPanel('shop', { title: 'Пляжный магазинчик', portrait: vendorLook('beach'), shops: ['beach'] });
      break;
    }
    case 'pool': {
      const i = await dialog({
        ...v('pool'),
        text: 'На старт, внимание… Хочешь поучаствовать в заплыве?',
        options: [{ text: '🏊 Плыть!', cls: 'green' }, { text: 'Не сейчас' }],
      });
      if (i === 0) playMinigame('swim');
      break;
    }
    case 'school': {
      const i = await dialog({
        ...v('school'),
        text: 'Здравствуй! Детям как раз нужна учительница. Проведёшь урок?',
        options: [{ text: '👩‍🏫 Провести урок', cls: 'green' }, { text: 'Не сейчас' }],
      });
      if (i === 0) playMinigame('teacher');
      break;
    }
    case 'hospital': {
      const i = await dialog({
        ...v('hospital'),
        text: 'Ой, как хорошо, что ты пришла! Пациентов много. Поможешь их вылечить?',
        options: [{ text: '🩺 Лечить', cls: 'green' }, { text: 'Не сейчас' }],
      });
      if (i === 0) playMinigame('doctor');
      break;
    }
    case 'fashion': {
      const i = await dialog({
        ...v('fashion'),
        text: 'Дорогая! Подиум ждёт. Выйдешь на показ мод?',
        options: [{ text: '👠 На подиум!', cls: 'green' }, { text: 'Не сейчас' }],
      });
      if (i === 0) playMinigame('fashion');
      break;
    }
    case 'tower':
      G.go('tower', 'world');
      break;
    case 'bank':
      openBank();
      break;
    default: {
      const b = World.BUILDINGS.find((q) => q.id === id);
      if (b && b.npc) {
        const n = NPC_BY_ID[b.npc];
        toast(
          `Здесь живёт ${n.name}. ${S().guests.includes(n.id) ? 'Сейчас у тебя в гостях!' : S().minutes >= 22 * 60 ? 'Тс-с, уже спит!' : 'Сейчас гуляет в городе.'}`,
        );
      }
    }
  }
}
export function goOutside() {
  G.go('world', 'villa');
}

/** Карта города: нажми на место — хомячок сам туда дойдёт. */
export function openMap() {
  let raf = 0;
  const go = (id, name, panel) => {
    if (G.sceneName !== 'world') G.go('world', G.sceneName);
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
        if (b) go(b.id, b.npc ? `домик (${NPC_BY_ID[b.npc].name})` : b.name, panel);
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
        bt.onclick = () => go(id, name, panel);
        row.appendChild(bt);
      }
      body.appendChild(row);
    },
  });
}

export function openPanorama() {
  openPanel({
    title: 'Подзорная труба: город',
    icon: '🔭',
    cls: 'wide',
    render(body) {
      const w = 900,
        h = 480;
      const { canvas, ctx } = makeCanvas(w, h);
      canvas.className = 'pano';
      canvas.style.width = '100%';
      canvas.style.height = 'auto';
      const c = cal(),
        d = darkness();
      const g = ctx.createLinearGradient(0, 0, 0, h * 0.6);
      g.addColorStop(0, mix('#58b9ff', '#151540', d));
      g.addColorStop(1, mix('#ffe8c2', '#4a3a78', d));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      if (d > 0.5) {
        ell(ctx, 720, 90, 40, 40, '#fff3bf');
        for (let i = 0; i < 50; i++) ell(ctx, (i * 173) % w, (i * 71) % 220, 1.5, 1.5, '#fff');
      } else {
        ell(ctx, 720, 110, 46, 46, '#ffe066');
        for (const [x, y] of [
          [150, 80],
          [420, 130],
          [600, 60],
        ]) {
          ell(ctx, x, y, 50, 18, '#fff');
          ell(ctx, x + 30, y - 12, 34, 16, '#fff');
        }
      }
      ctx.fillStyle = mix('#3fb0ea', '#1c2f6b', d);
      ctx.fillRect(0, 250, w, 90);
      for (let i = 0; i < 30; i++) ell(ctx, (i * 97) % w, 262 + ((i * 31) % 70), 16, 2, 'rgba(255,255,255,.5)');
      ctx.fillStyle = c.season === 'winter' ? '#f3ead2' : '#ffe9a8';
      ctx.fillRect(0, 330, w, 30);
      const grass = { winter: '#f6fbff', spring: '#a8e67a', summer: '#86db5c', autumn: '#cdd36a' }[c.season];
      ctx.fillStyle = grass;
      ctx.fillRect(0, 356, w, 130);
      const cols = ['#f783ac', '#74c0fc', '#ffd43b', '#b2f2bb', '#ffc9de', '#a5d8ff', '#ffe066', '#e5dbff'];
      for (let i = 0; i < 12; i++) {
        const bw = 44 + ((i * 13) % 30),
          bh = 50 + ((i * 37) % 90),
          bx = 40 + i * 72,
          by = 430 - (i % 3) * 12;
        fillRR(ctx, bx, by - bh, bw, bh, 5, cols[i % cols.length], '#4a3728', 2);
        for (let yy = by - bh + 10; yy < by - 12; yy += 16)
          for (let xx = bx + 8; xx < bx + bw - 10; xx += 14) fillRR(ctx, xx, yy, 8, 9, 2, d > 0.4 ? '#ffe066' : '#fff');
        if (i % 2)
          poly(
            ctx,
            [bx - 4, by - bh, bx + bw / 2, by - bh - 22, bx + bw + 4, by - bh],
            c.season === 'winter' ? '#fff' : '#f76e5c',
            '#4a3728',
            2,
          );
      }
      for (let i = 0; i < 9; i++) {
        const px = 30 + i * 105;
        fillRR(ctx, px - 3, 322, 6, 40, 2, '#c98b5a');
        for (let k = 0; k < 5; k++)
          ell(
            ctx,
            px + Math.cos(-0.2 - k * 0.7) * 16,
            322 + Math.sin(-0.2 - k * 0.7) * 10,
            16,
            5,
            c.season === 'winter' ? '#fff' : '#40c057',
            null,
            1,
            -0.2 - k * 0.7,
          );
      }
      fillRR(ctx, 0, h - 26, w, 26, 0, '#868e96');
      for (let x = 10; x < w; x += 40) fillRR(ctx, x, h - 70, 6, 50, 2, '#adb5bd');
      fillRR(ctx, 0, h - 76, w, 10, 4, '#dee2e6', '#4a3728', 2);
      drawHamster(ctx, 130, h - 22, 1.5, playerLook(), { happy: true, armsUp: true });
      body.appendChild(canvas);
      body.appendChild(el('p', 'center', `Ух ты! Отсюда видно весь город, пляж и даже твою виллу. ${c.seasonIcon}`));
    },
  });
}
function openBank() {
  openPanel({
    title: 'Хомяк-Банк',
    portrait: vendorLook('bank'),
    cls: 'narrow',
    render(body) {
      const { canvas, ctx } = makeCanvas(300, 170);
      canvas.style.cssText += ';display:block;margin:0 auto';
      fillRR(ctx, 10, 10, 280, 150, 18, '#868e96', '#4a3728', 3);
      fillRR(ctx, 24, 24, 252, 122, 10, '#495057');
      for (let r = 0; r < 5; r++)
        for (let i = 0; i < 9 - r; i++) {
          const x = 52 + i * 24 + r * 12,
            y = 130 - r * 16;
          ell(ctx, x, y, 13, 6, '#ffd43b', '#e0a800', 2);
        }
      star(ctx, 150, 46, 14, '#ffd43b', '#e0a800', 2);
      body.appendChild(canvas);
      body.appendChild(
        el('p', 'center', `В хранилище лежит:<br><b style="font-size:24px">🪙 ${fmtMoney(S().money)}</b>`),
      );
      body.appendChild(
        el(
          'p',
          'center muted',
          `Потрачено за всё время: ${fmtMoney(S().spent)} монет.<br>Банкир Монеткин говорит: «Хватит ещё на миллион лет!»`,
        ),
      );
    },
  });
}

// =====================================================================
//                               МИНИ-ИГРЫ
// =====================================================================
const MG_NAMES = {
  swim: '🏊 Плавание',
  teacher: '👩‍🏫 Учительница',
  doctor: '🩺 Доктор',
  chef: '👩‍🍳 Шеф-повар',
  fishing: '🎣 Рыбалка',
  fashion: '👠 Показ мод',
};
export async function playMinigame(id, extra = {}) {
  const s = S();
  const plays = s.plays[id] || 0;
  G.modal++;
  G.cover++; // мини-игра закрывает весь экран: город под ней не рисуем
  let res = null;
  try {
    res = await runMinigame(id, {
      look: playerLook(),
      name: s.name,
      season: cal().season,
      level: Math.min(4, Math.floor(plays / 2)),
      friends: shuffle(NPCS).map((n) => ({ id: n.id, name: n.name, look: npcLook(n.id), small: n.small })),
      ...extra,
    });
  } catch (e) {
    console.error(e);
    toast('Не получилось открыть игру. Попробуй ещё раз!');
  }
  G.modal--;
  G.cover--;
  if (!res) return null;
  s.plays[id] = plays + 1;
  s.best[id] = Math.max(s.best[id] || 0, res.stars);
  s.minutes = Math.min(23 * 60 + 30, s.minutes + 40);
  if (id === 'fishing' && res.extra && res.extra.fish) {
    addTo('ing', 'fish', res.extra.fish);
    toast(`В рюкзаке +${res.extra.fish} 🐟`, 'good');
  }
  if (res.stars === 3 && addSticker('x_3stars')) toast('Новая наклейка: 🌟 Три звезды!', 'good');
  if (id === 'swim' && res.stars === 3 && !hasClothes('medal')) {
    addClothes('medal');
    toast('Тебе вручили золотую медаль! Она в шкафу 🥇', 'good');
  }
  G.emit('minigame', { id, stars: res.stars });
  G.emit('hud');
  save();
  return res;
}
export function goFishing(spot) {
  playMinigame('fishing', { spot });
}

// =====================================================================
//                         ГОТОВКА И ХОЛОДИЛЬНИК
// =====================================================================
function needsHtml(d) {
  return Object.entries(d.needs)
    .map(([id, n]) => {
      const have = count('ing', id),
        ing = ING_BY_ID[id];
      return `<span class="need ${have >= n ? '' : 'no'}" title="${ing.name}">${ing.e} ${ing.name} ${have}/${n}</span>`;
    })
    .join('');
}
export function openCooking() {
  openPanel({
    title: 'Плита',
    icon: '🍳',
    cls: '',
    render(body, tab, panel) {
      body.appendChild(el('p', 'muted', 'Выбери рецепт. Продукты — в ТЦ «Вкусный», на грядках и на рыбалке.'));
      const known = DISHES.filter((d) => d.needs && S().recipes.includes(d.id));
      known.sort((a, b) => canCook(b) - canCook(a));
      for (const d of known) {
        const ok = canCook(d);
        const li = el('div', 'list-item');
        li.appendChild(el('div', 'e', `<span style="font-size:38px">${d.e}</span>`));
        li.appendChild(el('div', 'grow', `<div class="ttl">${d.name}</div><div>${needsHtml(d)}</div>`));
        const b = el('button', 'btn small ' + (ok ? 'green' : 'ghost'), 'Готовить');
        b.disabled = !ok;
        b.onclick = () => {
          sfx('tap');
          cookStep(d, panel);
        };
        li.appendChild(b);
        body.appendChild(li);
      }
      const secret = SECRET_RECIPES.filter((id) => !S().recipes.includes(id)).length;
      if (secret)
        body.appendChild(
          el(
            'p',
            'muted center',
            `❓ Ещё ${secret} ${plural(secret, 'секретный рецепт', 'секретных рецепта', 'секретных рецептов')} знают твои друзья. Подружись с ними!`,
          ),
        );
    },
  });
}
function cookStep(d, parent) {
  let pos = 0,
    dir = 1,
    raf = 0,
    last = performance.now(),
    done = false;
  const speed = 0.9 + Math.random() * 0.3;
  const p = openPanel({
    title: `Готовим: ${d.name}`,
    icon: d.e,
    cls: 'narrow',
    sticky: true,
    render(body) {
      body.innerHTML = `<div class="center big-emoji">${d.e}</div><p class="center">Сними с плиты, когда стрелка в <b style="color:#2f9e44">зелёной</b> зоне!</p>
        <div class="cookbar"><div class="zone" style="left:34%;width:32%"></div><div class="zone best" style="left:44%;width:12%"></div><div class="mark"></div></div>`;
      const mark = body.querySelector('.mark');
      const loop = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        pos += dir * speed * dt;
        if (pos > 1) {
          pos = 1;
          dir = -1;
        }
        if (pos < 0) {
          pos = 0;
          dir = 1;
        }
        mark.style.left = pos * 100 + '%';
        if (!done) raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    },
    foot: [
      {
        text: '🔥 Снять с плиты!',
        cls: 'big green',
        fn: (pp) => {
          if (done) return;
          done = true;
          cancelAnimationFrame(raf);
          for (const [id, n] of Object.entries(d.needs)) addTo('ing', id, -n);
          const perfect = pos >= 0.44 && pos <= 0.56,
            good = pos >= 0.34 && pos <= 0.66;
          const n = perfect ? 3 : good ? 2 : 1;
          addTo('dishes', d.id, n);
          sfx(perfect ? 'win' : 'ok');
          G.emit('cook', { dish: d.id, perfect });
          if (perfect && addSticker('x_master'))
            setTimeout(() => toast('Новая наклейка: 🏅 Шедевр на кухне!', 'good'), 600);
          save();
          pp.close();
          message({
            title: perfect ? 'Шедевр!' : good ? 'Очень вкусно!' : 'Готово!',
            icon: d.e,
            html: `<div class="center big-emoji">${d.e}</div><p class="center">${perfect ? 'Идеально! Получилось целых 3 порции.' : good ? 'Отлично получилось — 2 порции.' : 'Чуть-чуть подгорело, но одна порция вышла что надо.'}<br>Блюдо лежит в холодильнике.</p>`,
          }).then(() => parent.refresh());
        },
      },
    ],
    onClose: () => {
      done = true;
      cancelAnimationFrame(raf);
    },
  });
  return p;
}
function eat(id) {
  const d = DISH_BY_ID[id];
  addTo('dishes', id, -1);
  sfx('eat');
  toast(`Ням-ням! ${d.e} ${d.name}`, 'good');
  if (G.scene === G.scenes.villa) Villa.playerHappy();
  G.emit('eat');
  save();
}
function dishGrid(body, panel, onPick, btnText = 'Съесть') {
  const ids = Object.keys(S().dishes);
  if (!ids.length) {
    body.appendChild(el('p', 'muted center', 'Пока пусто. Приготовь что-нибудь на плите или купи в кафе!'));
    return;
  }
  const grid = el('div', 'grid');
  for (const id of ids) {
    const d = DISH_BY_ID[id];
    if (!d) continue;
    const card = el('div', 'card');
    card.appendChild(el('div', 'e', d.e));
    card.appendChild(el('div', 'nm', d.name));
    card.appendChild(el('span', 'cnt', '×' + S().dishes[id]));
    const b = el('button', 'btn small green', btnText);
    b.onclick = () => {
      onPick(id);
      if (panel && !panel.closed) panel.refresh();
    };
    card.appendChild(b);
    grid.appendChild(card);
  }
  body.appendChild(grid);
}
function ingGrid(body) {
  const ids = Object.keys(S().ing);
  if (!ids.length) {
    body.appendChild(el('p', 'muted center', 'Продуктов нет. Загляни в ТЦ «Вкусный»!'));
    return;
  }
  const grid = el('div', 'grid small');
  for (const id of ids) {
    const i = ING_BY_ID[id];
    if (!i) continue;
    const card = el('div', 'card');
    card.appendChild(el('div', 'e', i.e));
    card.appendChild(el('div', '', i.name));
    card.appendChild(el('span', 'cnt', '×' + S().ing[id]));
    grid.appendChild(card);
  }
  body.appendChild(grid);
}
export function openFridge() {
  openPanel({
    title: 'Холодильник',
    icon: '🧊',
    tabs: [
      { id: 'dishes', name: '🍰 Блюда' },
      { id: 'ing', name: '🥕 Продукты' },
    ],
    render(body, tab, panel) {
      if (tab === 'dishes') dishGrid(body, panel, eat);
      else ingGrid(body);
    },
  });
}
function pickDish(title) {
  return new Promise((resolve) => {
    let chosen = null;
    openPanel({
      title,
      icon: '🍽️',
      render(body, tab, panel) {
        dishGrid(
          body,
          panel,
          (id) => {
            chosen = id;
            panel.close();
          },
          'Выбрать',
        );
      },
      onClose: () => resolve(chosen),
    });
  });
}

// =====================================================================
//                            ДРУЗЬЯ И ГОСТИ
// =====================================================================
function addPts(id, n) {
  const before = friendHearts(id);
  S().friends[id].pts += n;
  const after = friendHearts(id),
    npc = NPC_BY_ID[id];
  if (after > before) {
    toast(`${npc.name}: дружба выросла! ${'❤️'.repeat(after)}`, 'good');
    sfx('heart');
    if (after >= 2 && before < 2) {
      const unknown = SECRET_RECIPES.filter((r) => !S().recipes.includes(r));
      const rec = unknown.includes(npc.fav) ? npc.fav : pick(unknown);
      if (rec) {
        S().recipes.push(rec);
        const d = DISH_BY_ID[rec];
        whenFree(
          () =>
            message({
              title: 'Секретный рецепт!',
              icon: '📜',
              html: `<div class="center big-emoji">${d.e}</div><p class="center"><b>${npc.name}</b> ${npc.fem ? 'рассказала' : 'рассказал'} тебе секретный рецепт:<br><b>${d.name}</b>!</p>`,
            }),
          500,
        );
      }
    }
    if (after >= 5 && before < 5) {
      if (addSticker('x_friend')) setTimeout(() => toast('Новая наклейка: 💖 Лучшие друзья!', 'good'), 900);
      giveSurprise(`${npc.name} дарит тебе подарок в знак дружбы!`, 1200);
    }
  }
}
function chatLine(npc) {
  const tags = outfitTags(),
    sea = cal().season,
    r = Math.random();
  const body = S().look.outfit.body,
    kind = body && CLOTHES_BY_ID[body] ? CLOTHES_BY_ID[body].kind : null;
  if (r < 0.35) {
    if (kind === 'swim' && sea === 'winter') return pick(OUTFIT_LINES.cold);
    if (kind === 'swim') return pick(OUTFIT_LINES.swim);
    if (sea === 'winter' && !tags.has('warm')) return pick(OUTFIT_LINES.cold);
    if (sea === 'summer' && kind && kind.startsWith('jacket')) return pick(OUTFIT_LINES.hot);
    if (tags.has('fancy')) return pick(OUTFIT_LINES.fancy);
  }
  if (r < 0.55) return pick(SEASON_LINES[sea]);
  return pick(npc.lines);
}
export async function npcDialog(id) {
  const npc = NPC_BY_ID[id],
    fr = S().friends[id],
    look = npcLook(id);
  let text;
  if (!fr.met) {
    fr.met = true;
    text = `Привет! Я ${npc.name}. А ты, наверное, ${esc(S().name)} с большой виллы? Будем дружить!`;
    addPts(id, 1);
    fr.chat = S().day;
    G.emit('talk', { id });
  } else
    text = pick([`Привет, ${esc(S().name)}!`, 'О, привет!', `${esc(S().name)}! Рад${npc.fem ? 'а' : ''} тебя видеть!`]);
  for (;;) {
    const i = await dialog({
      look,
      name: npc.name,
      text,
      options: [
        { text: '💬 Поболтать', cls: 'blue' },
        { text: '🏡 Позвать в гости', cls: 'green' },
        { text: '🎁 Угостить', cls: 'yellow' },
        { text: 'Пока!' },
      ],
    });
    if (i === 0) {
      text = chatLine(npc);
      if (fr.chat !== S().day) {
        fr.chat = S().day;
        addPts(id, 1);
      }
      G.emit('talk', { id });
    } else if (i === 1) {
      if (S().guests.length >= 3) text = 'У тебя уже полный дом гостей! Позови меня в другой раз.';
      else {
        invite(id);
        await dialog({
          look,
          name: npc.name,
          happy: true,
          text: 'Ура! Уже бегу к тебе на виллу. Встретимся там!',
          options: [{ text: 'До встречи!', cls: 'green' }],
        });
        return;
      }
    } else if (i === 2) {
      const dish = await pickDish(`Чем угостить? (${npc.name})`);
      if (!dish) {
        text = 'Ничего страшного, в другой раз!';
        continue;
      }
      addTo('dishes', dish, -1);
      sfx('eat');
      const fav = dish === npc.fav;
      if (fr.gift !== S().day) {
        fr.gift = S().day;
        addPts(id, fav ? 4 : 2);
      }
      G.emit('gift', { id });
      text = fav
        ? `${DISH_BY_ID[dish].e} Это же моё любимое блюдо! Спасибо-спасибо-спасибо!`
        : `${DISH_BY_ID[dish].e} Ой, как вкусно! Спасибо тебе большое!`;
      save();
    } else return;
  }
}
function invite(id) {
  if (S().guests.includes(id) || S().guests.length >= 3) return false;
  S().guests.push(id);
  Villa.syncGuests();
  save();
  return true;
}
export async function guestDialog(id) {
  const npc = NPC_BY_ID[id],
    fr = S().friends[id],
    look = npcLook(id);
  let text = pick([
    'Какая у тебя красивая вилла!',
    'А можно мне потом в бассейн?',
    'У тебя так уютно!',
    'Чем это так вкусно пахнет?',
  ]);
  for (;;) {
    const i = await dialog({
      look,
      name: npc.name,
      text,
      options: [
        { text: '🍰 Угостить', cls: 'green' },
        { text: '💬 Поболтать', cls: 'blue' },
        { text: '👋 Проводить домой', cls: 'yellow' },
        { text: 'Закрыть' },
      ],
    });
    if (i === 0) {
      const dish = await pickDish(`Чем угостить? (${npc.name})`);
      if (!dish) {
        text = 'Я подожду, не торопись!';
        continue;
      }
      addTo('dishes', dish, -1);
      sfx('eat');
      const fav = dish === npc.fav;
      if (fr.treat !== S().day) {
        fr.treat = S().day;
        addPts(id, fav ? 5 : 3);
      }
      Villa.guestHappy(id);
      G.emit('treat', { id });
      save();
      text = fav
        ? `${DISH_BY_ID[dish].e} ${DISH_BY_ID[dish].name}?! Моё самое любимое! Ты лучшая хозяйка на свете!`
        : `${DISH_BY_ID[dish].e} М-м-м, объедение! Спасибо за угощение!`;
    } else if (i === 1) {
      text = pick(npc.lines);
      if (fr.chat !== S().day) {
        fr.chat = S().day;
        addPts(id, 1);
      }
      G.emit('talk', { id });
    } else if (i === 2) {
      S().guests = S().guests.filter((g) => g !== id);
      Villa.syncGuests();
      save();
      toast(`${npc.name}: «Спасибо, было здорово! Пока!»`);
      return;
    } else return;
  }
}
export function openPhone() {
  openPanel({
    title: 'Телефон: позвать в гости',
    icon: '📱',
    render(body, tab, panel) {
      const night = S().minutes >= 22 * 60;
      for (const n of NPCS) {
        const fr = S().friends[n.id],
          here = S().guests.includes(n.id);
        const li = el('div', 'list-item');
        const { canvas, ctx } = makeCanvas(52, 52);
        canvas.style.cssText += ';border-radius:16px;background:#ffe3ec;flex:none';
        drawPortrait(ctx, 26, 26, 52, npcLook(n.id));
        li.appendChild(canvas);
        const h = friendHearts(n.id);
        li.appendChild(
          el(
            'div',
            'grow',
            `<div class="ttl">${fr.met ? n.name : '???'}</div><div class="sub">${fr.met ? `<span class="hearts">${'❤️'.repeat(h)}${'🤍'.repeat(5 - h)}</span>` : 'Вы ещё не знакомы — найди в городе'}</div>`,
          ),
        );
        if (fr.met) {
          const b = el(
            'button',
            'btn small ' + (here ? 'ghost' : 'green'),
            here ? 'В гостях' : night ? 'Спит' : 'Позвать',
          );
          b.disabled = here || night || S().guests.length >= 3;
          b.onclick = () => {
            if (invite(n.id)) {
              sfx('bell');
              toast(`${n.name} уже бежит к тебе на виллу! 🏡`, 'good');
              panel.refresh();
            }
          };
          li.appendChild(b);
        }
        body.appendChild(li);
      }
      body.appendChild(el('p', 'muted center', 'В гости можно позвать до трёх друзей сразу.'));
    },
  });
}

// =====================================================================
//                                 САД
// =====================================================================
export function gardenBed(i) {
  const bed = S().garden[i];
  if (bed.seed) {
    const sd = SEED_BY_ID[bed.seed],
      ing = ING_BY_ID[sd.crop];
    if (bed.age >= sd.days) {
      addTo('ing', sd.crop, sd.n);
      bed.seed = null;
      bed.age = 0;
      sfx('pop');
      toast(`Урожай! +${sd.n} ${ing.e} ${ing.name}`, 'good');
      G.emit('harvest');
      save();
    } else {
      const left = sd.days - bed.age;
      toast(`${ing.e} Растёт… Ещё ${left} ${plural(left, 'ночь', 'ночи', 'ночей')}.`);
    }
    return;
  }
  const have = SEEDS.filter((s) => count('seeds', s.id) > 0);
  if (!have.length) {
    toast('Нет семян. Они продаются в ТЦ «Уютный дом» 🌱');
    return;
  }
  openPanel({
    title: 'Что посадим?',
    icon: '🌱',
    cls: 'narrow',
    render(body, tab, panel) {
      const grid = el('div', 'grid');
      for (const sd of have) {
        const ing = ING_BY_ID[sd.crop];
        const card = el('div', 'card tap');
        card.appendChild(el('div', 'e', ing.e));
        card.appendChild(el('div', 'nm', sd.name));
        card.appendChild(el('span', 'cnt', '×' + count('seeds', sd.id)));
        card.appendChild(el('div', 'muted', `${sd.days} ${plural(sd.days, 'ночь', 'ночи', 'ночей')}`));
        card.onclick = () => {
          addTo('seeds', sd.id, -1);
          bed.seed = sd.id;
          bed.age = 0;
          sfx('dig');
          toast(`Посажено: ${sd.name} 🌱`, 'good');
          G.emit('plant');
          save();
          panel.close();
        };
        grid.appendChild(card);
      }
      body.appendChild(grid);
    },
  });
}

// =====================================================================
//                         ПОЧТА, ЗАДАНИЯ, НАГРАДЫ
// =====================================================================
const FIRST_TASKS = ['buy_clothes', 'swim', 'treat'];
export function newDayMail() {
  const s = S(),
    sea = cal().season;
  let id;
  if (s.day < FIRST_TASKS.length) id = FIRST_TASKS[s.day];
  else {
    const ripe = s.garden.some((b) => b.seed && b.age >= SEED_BY_ID[b.seed].days);
    const hasWheel = s.villa.some((i) => i.id === 'wheel'),
      hasPiano = s.villa.some((i) => i.id === 'piano');
    let pool = TASKS.filter(
      (t) =>
        (!t.seasons || t.seasons.includes(sea)) &&
        !s.lastTasks.includes(t.id) &&
        (!t.needsCrop || ripe) &&
        (t.type !== 'wheel' || hasWheel) &&
        (t.type !== 'piano' || hasPiano),
    );
    if (!pool.length) pool = TASKS.filter((t) => !t.seasons || t.seasons.includes(sea));
    id = pick(pool).id;
  }
  s.lastTasks = [id, ...s.lastTasks].slice(0, 6);
  s.mail = { task: id, read: false, done: false, n: 0, got: {}, items: null };
}
function taskProgress() {
  const m = S().mail,
    t = TASK_BY_ID[m.task];
  if (t.type === 'collect' || t.type === 'talk') return ` (${m.n}/${t.n})`;
  if (t.type === 'spa') return ` (${Object.keys(m.got).length}/3)`;
  return '';
}
export function taskChip() {
  const m = S().mail;
  if (!m) return { text: '📭 Писем нет', cls: '' };
  if (!m.read) return { text: '✉️ В почтовом ящике письмо!', cls: '' };
  const t = TASK_BY_ID[m.task];
  if (!t) return { text: '📭 Писем нет', cls: '' };
  if (m.done) return { text: `✅ ${t.title}`, cls: 'done' };
  return { text: `${t.sticker} ${t.title}${taskProgress()}`, cls: '' };
}
function letterHtml() {
  const m = S().mail,
    t = TASK_BY_ID[m.task],
    c = cal();
  const where = PLACES[t.where] || (t.where === 'beach' ? 'Пляж' : t.where === 'town' ? 'Город' : '');
  return `<div class="letter"><h3>${t.sticker} ${t.title}</h3><p>Дорогая ${esc(S().name)}!</p><p>${t.text}</p>
    <p class="muted">${c.seasonIcon} ${c.monthName}, день ${c.dom}${where ? ` · Куда идти: <b>${where}</b>` : ''}</p></div>
    <p class="center">${m.done ? '✅ <b>Задание выполнено!</b>' : `Награда: наклейка ${t.sticker} и, может быть, сюрприз 🎁${taskProgress() ? '<br>Сделано' + taskProgress() : ''}`}</p>`;
}
export function openMailbox() {
  const m = S().mail;
  if (!m) {
    toast('Ящик пуст. Новое письмо придёт завтра утром 📭');
    return;
  }
  if (!m.read) {
    m.read = true;
    sfx('mail');
    const t = TASK_BY_ID[m.task];
    if (t.type === 'collect')
      m.items = World.randomSpots(t.where === 'beach' ? 'beach' : 'town', t.n + 2, 1000 + S().day * 7);
    G.emit('hud');
    save();
  }
  showLetter();
}
export function showLetter() {
  const m = S().mail;
  if (!m) {
    toast('Сегодня писем нет 📭');
    return;
  }
  if (!m.read) {
    toast('Письмо ждёт в почтовом ящике у двери виллы ✉️');
    return;
  }
  sfx('paper');
  message({
    title: 'Письмо',
    icon: '✉️',
    cls: '',
    html: letterHtml(),
    buttons: [{ text: m.done ? 'Отлично!' : 'Вперёд!' }],
  });
}

function giftPool() {
  const s = S(),
    pool = [];
  for (const c of CLOTHES)
    if (c.shop === 'gift' && c.id !== 'medal' && !hasClothes(c.id)) pool.push({ kind: 'clothes', def: c });
  for (const f of FURNITURE) if (f.shop === 'gift' && !s.flags['gift_' + f.id]) pool.push({ kind: 'furn', def: f });
  for (const r of SECRET_RECIPES) if (!s.recipes.includes(r)) pool.push({ kind: 'recipe', def: DISH_BY_ID[r] });
  return pool;
}
/**
 * Сюрприз. Сам подарок выдаётся сразу (так он не потеряется, если вкладку закроют), а окно с ним
 * показывается через delay мс и только когда на экране ничего не открыто.
 */
export function giveSurprise(title, delay = 0) {
  const gift = grantSurprise();
  whenFree(() => showSurprise(title, gift), delay);
}
function grantSurprise() {
  const s = S(),
    pool = giftPool();
  let html,
    icon = null;
  if (!pool.length) {
    s.money += 100000;
    html = '<div class="big-emoji">💰</div><p>Мешочек монет: +100 000!</p>';
  } else {
    const g = pick(pool);
    if (g.kind === 'clothes') {
      addClothes(g.def.id);
      icon = clothesIcon(g.def, 110);
      html = `<p><b>${g.def.name}</b><br>Ищи в своём шкафу!</p>`;
    } else if (g.kind === 'furn') {
      addTo('storage', g.def.id, 1);
      s.flags['gift_' + g.def.id] = true;
      icon = furnIcon(g.def, 110);
      html = `<p><b>${g.def.name}</b><br>Лежит в кладовке — поставь дома через 🔨!</p>`;
    } else {
      s.recipes.push(g.def.id);
      html = `<div class="big-emoji">${g.def.e}</div><p>Секретный рецепт: <b>${g.def.name}</b>!</p>`;
    }
  }
  save();
  return { html, icon };
}
function showSurprise(title, { html, icon }) {
  sfx('magic');
  openPanel({
    title: title || 'Сюрприз!',
    icon: '🎁',
    cls: 'narrow',
    render(body) {
      body.classList.add('center');
      if (icon) {
        icon.style.margin = '0 auto';
        body.appendChild(icon);
      }
      body.appendChild(el('div', '', html));
    },
    foot: [{ text: 'Ура!', cls: 'green', fn: (p) => p.close() }],
  });
}
function completeTask() {
  const s = S(),
    m = s.mail,
    t = TASK_BY_ID[m.task];
  if (m.done) return;
  m.done = true;
  s.tasksDone++;
  const isNew = addSticker(t.id);
  const surprise = s.tasksDone <= 2 || Math.random() < 0.5;
  const gift = surprise ? grantSurprise() : null; // подарок выдаём сразу, окно — когда освободится экран
  G.emit('hud');
  save();
  whenFree(() => {
    sfx('fanfare');
    message({
      title: 'Задание выполнено!',
      icon: '🎉',
      html: `<div class="center"><div class="sticker got">${t.sticker}</div><p><b>${t.title}</b></p><p>${isNew ? 'Новая наклейка в альбоме!' : 'Такая наклейка у тебя уже есть — молодец!'}</p>${surprise ? '<p>И это ещё не всё… 🎁</p>' : ''}</div>`,
      buttons: [{ text: surprise ? 'Открыть сюрприз!' : 'Ура!' }],
    }).then(() => {
      if (gift) showSurprise(null, gift);
    });
  }, 700);
}
function onEvent(type, d = {}) {
  const m = S() && S().mail;
  if (!m || !m.read || m.done) return;
  const t = TASK_BY_ID[m.task];
  if (!t) return;
  let ok = false;
  switch (t.type) {
    case 'minigame':
      ok = type === 'minigame' && d.id === t.game;
      break;
    case 'buy':
      ok = type === 'buy' && d.cat === t.cat;
      break;
    case 'cook':
      ok = type === 'cook';
      break;
    case 'treat':
      ok = type === 'treat';
      break;
    case 'gift':
      ok = type === 'gift' || type === 'treat';
      break;
    case 'plant':
      ok = type === 'plant';
      break;
    case 'harvest':
      ok = type === 'harvest';
      break;
    case 'salon':
      ok = type === 'salon';
      break;
    case 'place':
      ok = type === 'place';
      break;
    case 'visit':
      ok = type === 'visit' && d.place === t.place;
      break;
    case 'wheel':
      ok = type === 'wheel';
      break;
    case 'skate':
      ok = type === 'skate';
      break;
    case 'feed':
      ok = type === 'feed';
      break;
    case 'coconut':
      ok = type === 'coconut';
      break;
    case 'pearl':
      ok = type === 'pearl';
      break;
    case 'boat':
      ok = type === 'boat';
      break;
    case 'piano':
      ok = type === 'piano';
      break;
    case 'swim':
      if (type === 'swim' && d.where === 'sea') {
        const b = S().look.outfit.body;
        if (b && CLOTHES_BY_ID[b] && CLOTHES_BY_ID[b].kind === 'swim') ok = true;
        else toast('Для задания нужен купальник! Переоденься дома в шкафу 🩱');
      }
      break;
    case 'collect':
      if (type === 'collect') {
        m.n++;
        G.emit('hud');
        ok = m.n >= t.n;
        if (!ok) toast(`${t.sticker} ${m.n} из ${t.n}`);
      }
      break;
    case 'talk':
      if (type === 'talk' && !m.got[d.id]) {
        m.got[d.id] = 1;
        m.n++;
        G.emit('hud');
        ok = m.n >= t.n;
      }
      break;
    case 'spa':
      if (type === 'spa') {
        m.got[d.what] = 1;
        G.emit('hud');
        ok = Object.keys(m.got).length >= 3;
      }
      break;
    default:
      break;
  }
  if (ok) completeTask();
}
export function initEvents() {
  for (const ev of [
    'minigame',
    'buy',
    'cook',
    'treat',
    'gift',
    'plant',
    'harvest',
    'salon',
    'place',
    'visit',
    'wheel',
    'skate',
    'swim',
    'collect',
    'talk',
    'spa',
    'feed',
    'coconut',
    'pearl',
    'piano',
    'boat',
  ])
    G.on(ev, (d) => onEvent(ev, d));
}

// =====================================================================
//                              СОН И НОВЫЙ ДЕНЬ
// =====================================================================
export async function askSleep() {
  const early = S().minutes < 18 * 60;
  const ok = await confirmBox(
    'Пора спать?',
    `<div class="center big-emoji">🛏️</div><p class="center">${early ? 'Ещё светло, но можно и вздремнуть до завтра.' : 'День был длинный!'} Лечь спать? Наступит следующий день.</p>`,
    'Спать 😴',
    'Ещё погуляю',
  );
  if (!ok) return;
  const before = cal();
  sfx('sleep');
  const release = await fadeTo('Спокойной ночи… 💤', 1700);
  const s = S();
  s.day++;
  s.minutes = 7 * 60 + 30;
  for (const b of s.garden) if (b.seed) b.age++;
  rollDay();
  newDayMail();
  const c = cal();
  if (s.day > 0 && s.day % 36 === 0 && addSticker('x_year'))
    setTimeout(() => toast('Новая наклейка: 🎆 Целый год!', 'good'), 2500);
  Villa.enter('wake');
  G.emit('hud');
  save();
  release();
  setTimeout(() => {
    sfx(c.season !== before.season ? 'fanfare' : 'morning');
    if (c.season !== before.season)
      whenFree(() =>
        message({
          title: `${c.seasonName}!`,
          icon: c.seasonIcon,
          html: `<div class="center big-emoji">${c.seasonIcon}</div><p class="center">Наступил${c.season === 'winter' || c.season === 'spring' ? 'а' : c.season === 'summer' ? 'о' : 'а'} ${c.seasonName.toLowerCase()}! Сегодня ${c.monthName.toLowerCase()}, день ${c.dom}.<br>${{ winter: 'Доставай тёплую куртку и шапку!', spring: 'Пора сажать грядки и гулять в лёгкой курточке.', summer: 'Купальник, панамка — и на пляж!', autumn: 'Самое время для дождевика и резиновых сапожек.' }[c.season]}</p>`,
        }),
      );
    else toast(`Доброе утро! ${c.seasonIcon} ${c.monthName}, день ${c.dom}. В ящике новое письмо ✉️`);
  }, 600);
}

// =====================================================================
//                       РЮКЗАК, АЛЬБОМ, НАСТРОЙКИ
// =====================================================================
export function openBackpack() {
  openPanel({
    title: 'Рюкзак',
    icon: '🎒',
    tabs: [
      { id: 'dishes', name: '🍰 Вкусняшки' },
      { id: 'ing', name: '🥕 Продукты' },
      { id: 'seeds', name: '🌱 Семена' },
      { id: 'furn', name: '📦 Кладовка' },
    ],
    render(body, tab, panel) {
      if (tab === 'dishes') dishGrid(body, panel, eat);
      else if (tab === 'ing') ingGrid(body);
      else if (tab === 'seeds') {
        const ids = Object.keys(S().seeds);
        if (!ids.length) {
          body.appendChild(el('p', 'muted center', 'Семян нет. Они продаются в ТЦ «Уютный дом».'));
          return;
        }
        const grid = el('div', 'grid small');
        for (const id of ids) {
          const sd = SEED_BY_ID[id];
          const card = el('div', 'card');
          card.appendChild(el('div', 'e', ING_BY_ID[sd.crop].e));
          card.appendChild(el('div', '', sd.name));
          card.appendChild(el('span', 'cnt', '×' + S().seeds[id]));
          grid.appendChild(card);
        }
        body.appendChild(grid);
        body.appendChild(el('p', 'muted center', 'Сажай на грядках во дворе виллы.'));
      } else {
        const ids = Object.keys(S().storage);
        if (!ids.length) {
          body.appendChild(el('p', 'muted center', 'Кладовка пуста. Мебель продаётся в ТЦ «Уютный дом».'));
          return;
        }
        const grid = el('div', 'grid small');
        for (const id of ids) {
          const f = FURN_BY_ID[id];
          if (!f) continue;
          const card = el('div', 'card');
          card.appendChild(furnIcon(f, 70));
          card.appendChild(el('div', '', f.name));
          card.appendChild(el('span', 'cnt', '×' + S().storage[id]));
          grid.appendChild(card);
        }
        body.appendChild(grid);
        body.appendChild(el('p', 'muted center', 'Чтобы поставить мебель, нажми 🔨 на вилле.'));
      }
    },
  });
}
export function openAlbum() {
  openPanel({
    title: 'Альбом',
    icon: '📖',
    tabs: [
      { id: 'st', name: '⭐ Наклейки' },
      { id: 'fr', name: '💖 Друзья' },
      { id: 'rec', name: '🏆 Рекорды' },
    ],
    render(body, tab) {
      const s = S();
      if (tab === 'st') {
        const all = [...TASKS.map((t) => ({ id: t.id, sticker: t.sticker, title: t.title })), ...EXTRA_STICKERS];
        body.appendChild(el('p', 'center', `Собрано <b>${s.stickers.length}</b> из ${all.length}`));
        const grid = el('div', 'grid small');
        for (const a of all) {
          const got = s.stickers.includes(a.id);
          const card = el('div', 'card');
          card.appendChild(el('div', 'sticker' + (got ? ' got' : ''), got ? a.sticker : '❔'));
          card.appendChild(el('div', got ? '' : 'muted', got ? a.title : '???'));
          grid.appendChild(card);
        }
        body.appendChild(grid);
      } else if (tab === 'fr') {
        for (const n of NPCS) {
          const fr = s.friends[n.id],
            h = friendHearts(n.id);
          const li = el('div', 'list-item');
          const { canvas, ctx } = makeCanvas(60, 60);
          canvas.style.cssText += ';border-radius:18px;background:#ffe3ec;flex:none';
          if (fr.met) drawPortrait(ctx, 30, 30, 60, npcLook(n.id));
          else ctext(ctx, '?', 30, 32, 34, '#d9487a');
          li.appendChild(canvas);
          const fav = DISH_BY_ID[n.fav];
          li.appendChild(
            el(
              'div',
              'grow',
              fr.met
                ? `<div class="ttl">${n.name} <span class="hearts">${'❤️'.repeat(h)}${'🤍'.repeat(5 - h)}</span></div><div class="sub">${n.about}</div><div class="sub">Любимое блюдо: ${h >= 1 ? `${fav.e} ${fav.name}` : '❓ (подружись, чтобы узнать)'}</div>`
                : '<div class="ttl">???</div><div class="sub">Вы ещё не знакомы. Найди этого хомячка в городе!</div>',
            ),
          );
          body.appendChild(li);
        }
      } else {
        for (const [id, name] of Object.entries(MG_NAMES)) {
          const b = s.best[id] || 0;
          const li = el('div', 'list-item');
          li.appendChild(
            el('div', 'grow', `<div class="ttl">${name}</div><div class="sub">Сыграно раз: ${s.plays[id] || 0}</div>`),
          );
          li.appendChild(
            el(
              'div',
              '',
              `<span style="font-size:22px">${'⭐'.repeat(b)}<span style="opacity:.25">${'⭐'.repeat(3 - b)}</span></span>`,
            ),
          );
          body.appendChild(li);
        }
        body.appendChild(
          el('p', 'muted center', `Выполнено заданий: ${s.tasksDone} · Найдено жемчужин: ⚪ ${s.pearls || 0}`),
        );
      }
    },
  });
}

// =====================================================================
//                               ПОКАЗ МОД
// =====================================================================
/** Оценка наряда по теме: 0..10 */
export function scoreOutfit(theme) {
  const o = S().look.outfit;
  let score = 0;
  const body = o.body && CLOTHES_BY_ID[o.body];
  const fullBody = body && ['dress', 'princess', 'swim', 'pajama', 'robe'].includes(body.kind);
  for (const slot of ['head', 'body', 'legs', 'feet', 'acc']) {
    let it = o[slot] && CLOTHES_BY_ID[o[slot]];
    if (slot === 'legs' && !it && fullBody) it = body;
    if (!it) continue;
    score += it.tags.some((t) => theme.tags.includes(t)) ? 2 : 0.6;
  }
  return Math.min(10, score);
}
export { FASHION_THEMES };
