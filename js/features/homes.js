// Своё жильё: риелтор и окно «Недвижимость», «Мои дома», основной дом и кнопка «Домой», двери своих домов.
//
// Жильё — таблица HOMES (data/estate.js), сцены — interiors/<id>.js. Куплено ли — state.homesOwned.
// Действия реестра:
//   'realtor'            окно риелтора: купить жильё;  'realtor:mine' («Мои дома»),  'realtor:<id>' — показать этот дом
//   'home:<id>'          дверь своего жилья: куплено — войти (ctx.back — место у двери), нет — окно риелтора
//   'home-exit'          дверь изнутри (поле exit в описании дома): туда, откуда пришли
// Своих зданий в городе у жилья и у риелтора пока нет (город перестраивают): временные входы — кнопка
// «Недвижимость» в Хомяк-Банке и «Мои дома» в меню; пентхаус — ещё и из лифта Хомяк-Тауэра.
// Когда появятся здания, им достаточно написать act: 'realtor' и act: 'home:flat' (и т. д.).
import { addHome, award, setMainHome } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { makeCanvas, fillRR, line, poly, ell, shade } from '../core/draw.js';
import { emit } from '../core/events.js';
import { go, scene, scenes } from '../core/loop.js';
import { register } from '../core/registry.js';
import { G, ownsHome, ownedHomes } from '../core/state.js';
import { el, fmtMoney } from '../core/util.js';
import { HOMES, HOME_BY_ID, VENDORS, vendorLook } from '../data/index.js';
import { HOUSE_BY_ID } from '../interiors/houses.js';
import { openPanel, message, confirmBox } from '../ui/panel.js';
import { toast } from '../ui/toast.js';
import { buy, priceTag, buyBtn, lacking } from './purchase.js';

const S = () => G.state;
/** Что уже продаётся (без заготовок «скоро»). */
const onSale = () => HOMES.filter((h) => h.id !== 'villa' && !h.soon);

// ---------- переходы ----------
/** Место «снаружи» для двери дома, в который переходим не через дверь (из окна «Мои дома», кнопкой «Домой»). */
function outside() {
  const sc = scene();
  let pos = null;
  if (sc) pos = sc.owned && sc.desc.persist ? sc.back : sc.savePos ? sc.savePos() : null; // из своего дома — его «снаружи»
  return pos && typeof pos.scene === 'string' && scenes[pos.scene] ? pos : { scene: 'world' };
}
/** Перейти в свой дом. back — куда выведет его дверь (по умолчанию — туда, где героиня сейчас). */
export function goToHome(id, back) {
  if (!ownsHome(id) || !scenes[id]) return false;
  const sc = scene();
  if (sc && sc.name === id) {
    toast('Ты уже здесь 🏡');
    return false;
  }
  sfx('door');
  go(id, id === 'villa' ? {} : { back: back || outside() });
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
      ...(many ? [{ text: '🔑 В другой дом', cls: 'blue' }] : []),
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
  if (!ok || !buy(h.price)) return;
  const n = addHome(h.id);
  emit('buy', { cat: 'home', id: h.id });
  award('x_home2', { delay: 1500 });
  if (onSale().every((q) => ownsHome(q.id))) award('x_homes_all', { delay: 2600 });
  sfx('fanfare');
  if (panel && !panel.closed) panel.close();
  const i = await message({
    title: 'С новосельем!',
    icon: '🔑',
    html: `<p class="center big-emoji">${h.icon}🎉</p><p class="center"><b>${h.name}</b> — теперь твой дом${n > 1 ? ' (уже ' + (n + 1) + '-й!)' : ''}.<br>Там уже стоят кровать и шкаф, а остальное расставь сама: кнопка 🔨 «Обустроить».</p>
      <p class="muted center">Все свои дома — в ⚙️ меню, «Мои дома». Там же выбирают основной дом для кнопки «Домой».</p>`,
    buttons: [{ text: 'Перейти домой 🏡' }, { text: 'Потом', cls: 'ghost' }],
  });
  if (i === 0) goToHome(h.id);
}

function homeCard(h, panel, mine) {
  const owned = ownsHome(h.id),
    here = scene() && scene().name === h.id;
  const li = el('div', 'list-item home-card' + (h.soon ? ' soon' : ''));
  if (HOUSE_BY_ID[h.id]) li.appendChild(planCanvas(HOUSE_BY_ID[h.id]));
  const main = S().homeMain === h.id;
  const info = el(
    'div',
    'grow',
    `<div class="ttl">${h.icon} ${h.name}${owned && main ? ' <span class="tag">⭐ основной</span>' : ''}</div>
     <div class="sub">${h.about}</div>
     <div class="perks">${h.perks.map((p) => `<span>${p}</span>`).join('')}</div>`,
  );
  li.appendChild(info);
  const side = el('div', 'side');
  if (owned) {
    if (!mine) side.appendChild(el('div', 'own', '✓ Твой дом'));
    const b = el('button', 'btn small ' + (here ? 'ghost' : 'green'), here ? 'Ты здесь' : 'Перейти домой');
    b.disabled = here;
    b.onclick = () => {
      panel.close();
      goToHome(h.id);
    };
    side.appendChild(b);
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
  } else if (h.soon) {
    side.appendChild(el('div', 'pr far', `🪙 ${fmtMoney(h.price)}`));
    side.appendChild(el('div', 'soon-note', h.soon));
  } else {
    const pr = el('div', 'card-pr');
    pr.appendChild(priceTag(h.price));
    side.appendChild(pr);
    side.appendChild(buyBtn('Купить 🔑', h.price, () => buyHome(h, panel)));
  }
  li.appendChild(side);
  return li;
}

/** Окно риелтора. tab: 'buy' — купить жильё, 'mine' — мои дома; id жилья — открыть «Купить» (для двери этого дома). */
export function openRealtor(tab = 'buy') {
  const start = tab === 'mine' ? 'mine' : 'buy';
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
      } else {
        const list = ownedHomes().map((id) => HOME_BY_ID[id]);
        for (const h of list) body.appendChild(homeCard(h, panel, true));
        body.appendChild(
          el(
            'p',
            'muted center',
            list.length > 1
              ? 'Кнопка «Домой» ведёт в основной дом ⭐. Спать можно в любом — проснёшься там, где уснула.'
              : 'Пока у тебя один дом — вилла. Купить ещё можно на вкладке «Купить жильё».',
          ),
        );
      }
    },
  });
}

register('realtor', (p) => openRealtor(p.arg), 'риелтор: realtor (купить жильё), realtor:mine (мои дома)');
register(
  'home',
  (p, ctx) => (ownsHome(p.arg) ? goToHome(p.arg, ctx.back) : openRealtor('buy')),
  'дверь своего жилья: home:<id> — куплено: войти (ctx.back — место у двери), нет — окно риелтора',
);
register('home-exit', (p, ctx) => leaveHome(ctx.scene), 'дверь своего дома изнутри: туда, откуда пришли');
