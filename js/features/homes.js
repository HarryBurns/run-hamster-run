// Своё жильё: риелтор и окно «Недвижимость», «Мои дома», основной дом и кнопка «Домой», двери своих домов.
//
// Жильё — таблица HOMES (data/estate.js), сцены — interiors/<id>.js. Куплено ли — state.homesOwned.
// Действия реестра:
//   'realtor'            окно риелтора: купить жильё и «Мои дома» — дверь агентства «Свой домик» в городе;
//   'realtor:mine'       только список «Мои дома» и выбор основного дома — кнопка в ⚙️ меню (купить там нельзя)
//   'home:<id>'          дверь своего жилья: куплено — войти (ctx.back — место у двери), нет — окно риелтора
//   'home-exit'          дверь изнутри (поле exit в описании дома): туда, откуда пришли
// В дом входят через дверь его здания (locations/town.js: квартира — 'home_apartment', бунгало — 'home_bungalow';
// пентхаус — из лифта Хомяк-Тауэра; лесной домик — здание 'cabin' в лесу, locations/forest.js, поле loc в HOMES;
// номер-люкс — золотая дверь в коридоре отеля «Морская звезда», features/hotel.js). Мгновенного перехода «в любой дом» нет; кнопка «Домой»
// ведёт в основной дом, а его дверь выводит к двери здания (поле building в HOMES, data/estate.js).
import { addHome, award, setMainHome } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { makeCanvas, fillRR, line, poly, ell, shade } from '../core/draw.js';
import { emit } from '../core/events.js';
import { go, scene, sceneName, scenes } from '../core/loop.js';
import { register } from '../core/registry.js';
import { G, ownsHome, ownedHomes, landOpen } from '../core/state.js';
import { el, fmtMoney } from '../core/util.js';
import { HOMES, HOME_BY_ID, VENDORS, vendorLook } from '../data/index.js';
import { currentLocation, homeLocation, getLocation } from '../engine/topdown/index.js';
import { HOUSE_BY_ID } from '../interiors/houses.js';
import { openPanel, message, confirmBox } from '../ui/panel.js';
import { toast } from '../ui/toast.js';
import { buy, priceTag, buyBtn, lacking } from './purchase.js';

const S = () => G.state;
/** «Скоро»: подпись, пока жильё не продаётся (лесной домик — пока лес не открыт), или null — уже продаётся. */
const soonNote = (h) => (h.soon && !(h.land && landOpen(h.land)) ? h.soon : null);
/** Что уже продаётся (без заготовок «скоро»). */
const onSale = () => HOMES.filter((h) => h.id !== 'villa' && !soonNote(h));
/** Локация, где стоит дверь жилья (поле loc в HOMES; без него — город). */
const homeLoc = (h) => (h && h.loc && getLocation(h.loc)) || homeLocation();

// ---------- переходы ----------
/** Место у двери здания, где это жильё (для дома, в который пришли не через дверь, а кнопкой «Домой»). */
function doorOutside(id) {
  const h = HOME_BY_ID[id],
    loc = homeLoc(h),
    d = h && h.building ? loc.spot(h.building) : null;
  return d ? { scene: loc.name, x: d.x, y: d.y } : { scene: loc.name };
}
/** Перейти в свой дом. back — куда выведет его дверь (по умолчанию — к двери его здания в городе). */
export function goToHome(id, back) {
  if (!ownsHome(id) || !scenes[id]) return false;
  const sc = scene();
  if (sc && sc.name === id) {
    toast('Ты уже здесь 🏡');
    return false;
  }
  sfx('door');
  go(id, id === 'villa' ? {} : { back: back || doorOutside(id) });
  return true;
}
/** Дверь своего дома изнутри: туда, откуда пришли; если неизвестно — в город. */
function leaveHome(sc) {
  const b = sc && sc.back;
  if (b && typeof b.scene === 'string' && scenes[b.scene] && b.scene !== sc.name) go(b.scene, { pos: b });
  else go('world');
}

/** Кнопка «Домой»: в основной дом. Если домов несколько — можно выбрать другой. */
export async function askGoHome() {
  const main = HOME_BY_ID[S().homeMain] || HOME_BY_ID.villa,
    many = ownedHomes().length > 1;
  const i = await message({
    title: 'Домой?',
    html: `<p class="center big-emoji">${main.icon}</p><p class="center">Вернуться домой прямо сейчас?<br><b>${main.name}</b>${many ? ' — твой основной дом.' : ''}</p>`,
    buttons: [
      { text: 'Да, домой 🏡' },
      ...(many ? [{ text: '⭐ Выбрать основной дом', cls: 'blue' }] : []),
      { text: 'Нет', cls: 'ghost' },
    ],
  });
  if (i === 0) goToHome(main.id);
  else if (many && i === 1) openRealtor('mine');
}

// ---------- картинка-план ----------
/** Маленький план дома по его описанию: комнаты цветом обоев, дверь, окна, лифт, крыша. */
export function planCanvas(desc, w = 150, h = 96) {
  const { canvas, ctx } = makeCanvas(w, h);
  canvas.className = 'home-plan';
  const floors = desc.floors || 1,
    WT = desc.width + (desc.lift ? 120 : 0);
  const k = Math.min((w - 16) / WT, (h - 30) / (floors * 276)),
    x0 = (w - WT * k) / 2,
    yb = h - 7,
    sh = { wall: '#fff3d6', roof: '#f76e5c', ...desc.shell },
    OUT = '#4a3728';
  const X = (x) => x0 + x * k,
    Y = (f, up = 0) => yb - (f * 276 + up) * k;
  const top = Y(floors - 1, 250);
  ctx.lineJoin = 'round';
  if (sh.flat) fillRR(ctx, X(-30), top - 7, (WT + 60) * k, 7, 2, sh.roof, OUT, 1.5);
  else poly(ctx, [X(-50), top, X(WT / 2), top - 20, X(WT + 50), top], sh.roof, OUT, 1.5);
  fillRR(ctx, X(-12), top, (WT + 24) * k, yb - top + 3, 2, sh.wall, OUT, 1.5);
  for (const r of desc.rooms) {
    const y = Y(r.f, 250),
      rw = (r.x1 - r.x0) * k,
      rh = 250 * k;
    ctx.fillStyle = r.paper === 'open' ? '#bfe6ff' : r.wall;
    ctx.fillRect(X(r.x0), y, rw, rh);
    ctx.fillStyle = r.floor === 'wood' ? '#c98b5a' : r.floor === 'deck' ? '#e8c9a0' : '#dfe9ee';
    ctx.fillRect(X(r.x0), y + rh, rw, 26 * k);
    for (const wx of r.win ? [].concat(r.win) : []) {
      const hw = ((r.winW || 88) / 2) * k;
      fillRR(ctx, X(wx) - hw, Y(r.f, 205), hw * 2, 95 * k, 1.5, r.view === 'sea' ? '#74c0fc' : '#d0ebff', '#fff', 1.5);
    }
    if (r.x0 > 0) line(ctx, X(r.x0), y, X(r.x0), y + rh * 0.35, OUT, 1.5);
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 1;
    ctx.strokeRect(X(r.x0), y, rw, rh + 26 * k);
  }
  if (desc.lift) {
    ctx.fillStyle = '#dee2e6';
    ctx.fillRect(X(desc.width), top, 120 * k, yb - top);
    fillRR(ctx, X(desc.width + 20), Y(0, 160), 80 * k, 160 * k, 2, '#ffd43b', OUT, 1);
    ctx.strokeStyle = OUT;
    ctx.strokeRect(X(desc.width), top, 120 * k, yb - top);
  }
  const d = desc.door || { f: 0, x: 100 };
  fillRR(ctx, X(d.x - 44), Y(d.f, 170), 88 * k, 170 * k, 2, shade(sh.roof, -0.1), OUT, 1);
  // кровать в «своей спальне» — чтобы было видно, где спать
  const bed = desc.rooms.find((r) => r.main);
  if (bed) {
    const bx = X((bed.x0 + bed.x1) / 2),
      by = Y(bed.f, 0);
    fillRR(ctx, bx - 100 * k, by - 50 * k, 200 * k, 50 * k, 2, '#ff8fab', OUT, 1);
    ell(ctx, bx - 70 * k, by - 54 * k, 24 * k, 12 * k, '#fff', OUT, 1);
  }
  return canvas;
}

// ---------- покупка ----------
async function buyHome(h, panel) {
  if (ownsHome(h.id)) return;
  if (lacking(h.price)) {
    buy(h.price); // подскажет, сколько не хватает
    return;
  }
  const ok = await confirmBox(
    'Покупаем?',
    `<p class="center big-emoji">${h.icon}</p><p class="center"><b>${h.name}</b> за <b>🪙 ${fmtMoney(h.price)}</b>.<br>Это большая покупка! Берём?</p>`,
    'Да, покупаю! 🔑',
    'Ещё подумаю',
  );
  // пока окно было открыто, дом могли уже купить (второе нажатие) — деньги второй раз не списываем
  if (!ok || ownsHome(h.id) || !buy(h.price)) return;
  const n = addHome(h.id);
  emit('buy', { cat: 'home', id: h.id });
  award('x_home2', { delay: 1500 });
  if (onSale().every((q) => ownsHome(q.id))) award('x_homes_all', { delay: 2600 });
  sfx('fanfare');
  if (panel && !panel.closed) panel.close();
  // в дом входят через дверь: предлагаем дойти до неё (как кнопка на карте), если мы в городе
  const loc = currentLocation(),
    canWalk = !!h.building && sceneName() === loc.name && loc === homeLoc(h);
  const i = await message({
    title: 'С новосельем!',
    icon: '🔑',
    html: `<p class="center big-emoji">${h.icon}🎉</p><p class="center"><b>${h.name}</b> — теперь твой дом${n > 1 ? ' (уже ' + (n + 1) + '-й!)' : ''}.<br>Он ${h.where}. Там уже стоят кровать и шкаф, а остальное расставь сама: кнопка 🔨 «Обустроить».</p>
      <p class="muted center">Все свои дома — в ⚙️ меню, «Мои дома». Там же выбирают основной дом для кнопки «Домой».</p>`,
    buttons: canWalk ? [{ text: 'Идём туда! 🐾' }, { text: 'Потом', cls: 'ghost' }] : [{ text: 'Ура!' }],
  });
  if (canWalk && i === 0 && loc.walkToPlace(h.building)) toast(`Идём: ${h.name} 🐾`);
}

function homeCard(h, panel, mine) {
  const owned = ownsHome(h.id),
    here = scene() && scene().name === h.id;
  const soon = soonNote(h);
  const li = el('div', 'list-item home-card' + (soon ? ' soon' : ''));
  if (HOUSE_BY_ID[h.id]) li.appendChild(planCanvas(HOUSE_BY_ID[h.id]));
  const main = S().homeMain === h.id;
  const info = el(
    'div',
    'grow',
    `<div class="ttl">${h.icon} ${h.name}${owned && main ? ' <span class="tag">⭐ основной</span>' : ''}</div>
     <div class="sub">${h.about}</div>
     <div class="sub">📍 ${here ? 'Ты сейчас здесь' : 'Где: ' + h.where}</div>
     <div class="perks">${h.perks.map((p) => `<span>${p}</span>`).join('')}</div>`,
  );
  li.appendChild(info);
  const side = el('div', 'side');
  if (owned) {
    // в дом входят через дверь его здания: отсюда туда не переносят
    side.appendChild(el('div', 'own', '✓ Твой дом'));
    if (mine && !main) {
      const m = el('button', 'btn small blue', '⭐ Сделать основным');
      m.onclick = () => {
        sfx('ok');
        setMainHome(h.id);
        toast(`Теперь кнопка «Домой» ведёт сюда: ${h.name} ${h.icon}`, 'good');
        panel.refresh();
      };
      side.appendChild(m);
    }
  } else if (soon) {
    side.appendChild(el('div', 'pr far', `🪙 ${fmtMoney(h.price)}`));
    side.appendChild(el('div', 'soon-note', soon));
  } else {
    const pr = el('div', 'card-pr');
    pr.appendChild(priceTag(h.price));
    side.appendChild(pr);
    side.appendChild(buyBtn('Купить 🔑', h.price, () => buyHome(h, panel)));
  }
  li.appendChild(side);
  return li;
}

/**
 * Окно риелтора (дверь агентства): вкладки «Купить жильё» и «Мои дома». tab: 'buy' | 'mine' — какую открыть.
 * only — только список «Мои дома» с выбором основного дома (кнопка в меню): купить отсюда нельзя.
 */
export function openRealtor(tab = 'buy', only = false) {
  const start = tab === 'mine' ? 'mine' : 'buy';
  const mineList = (body, panel) => {
    const list = ownedHomes().map((id) => HOME_BY_ID[id]);
    for (const h of list) body.appendChild(homeCard(h, panel, true));
    body.appendChild(
      el(
        'p',
        'muted center',
        list.length > 1
          ? 'Кнопка «Домой» ведёт в основной дом ⭐. В каждый дом входят через его дверь в городе. Спать можно в любом — проснёшься там, где уснула.'
          : 'Пока у тебя один дом — вилла. Ещё один можно купить в агентстве «Свой домик» — оно на Северной улице, рядом с Хомяк-Банком.',
      ),
    );
  };
  if (only)
    return openPanel({ title: 'Мои дома', icon: '🔑', cls: 'wide', render: (body, t, panel) => mineList(body, panel) });
  return openPanel({
    title: 'Недвижимость',
    portrait: vendorLook('realtor'),
    money: true,
    cls: 'wide',
    tab: start,
    tabs: [
      { id: 'buy', name: '🏘️ Купить жильё' },
      { id: 'mine', name: '🔑 Мои дома' },
    ],
    render(body, t, panel) {
      if (t === 'buy') {
        body.appendChild(
          el(
            'p',
            'muted',
            `<b>${VENDORS.realtor.name}:</b> «Второй дом — это как вторая норка: лишним не бывает! В каждом — своя кровать, шкаф и кладовка общая с виллой».`,
          ),
        );
        for (const h of HOMES.filter((q) => q.id !== 'villa')) body.appendChild(homeCard(h, panel, false));
      } else mineList(body, panel);
    },
  });
}

/** Дверь жилья в городе: своё — войти; не куплено — к риелтору (он покажет, что продаётся). */
function homeDoor(id, ctx) {
  if (ownsHome(id)) return goToHome(id, ctx.back);
  const h = HOME_BY_ID[id];
  if (h) toast(`${h.icon} ${h.name} продаётся! Вот что говорит ${VENDORS.realtor.name} 🔑`);
  return openRealtor('buy');
}

register(
  'realtor',
  (p) => openRealtor(p.arg, p.arg === 'mine'),
  'риелтор: realtor (агентство: купить жильё и мои дома), realtor:mine (меню: только список «Мои дома»)',
);
register(
  'home',
  (p, ctx) => homeDoor(p.arg, ctx),
  'дверь своего жилья: home:<id> — куплено: войти (ctx.back — место у двери), нет — окно риелтора',
);
register('home-exit', (p, ctx) => leaveHome(ctx.scene), 'дверь своего дома изнутри: туда, откуда пришли');
