// «Вилла растёт» (docs/DESIGN.md): дом и двор достраивают за монеты. Ступени — VILLA_UPS (data/estate.js), что
// построено — state.villaUp; дом по ступеням — interiors/villa.js, двор — locations/town_yard.js.
//
// Заказывают в агентстве «Свой домик» — вкладка «🔨 Стройка» окна риелтора (features/homes.js, addRealtorTab):
// сверху следующая ступень дома с планом, ниже — двор (грядки, пруд, бассейн, теплица). Строители берут один заказ
// за раз: купили — сценка «строители за работой», а готово к утру (finishVillaUp в nextDay, core/actions.js) —
// утром окно «Готово!». Мебель, которая мешала новой сантехнике, строители унесли в кладовку (подсказка).
// Действие реестра: 'villa-up' — открыть вкладку «Стройка».
import { orderVillaUp } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { ell, fillRR, line, poly } from '../core/draw.js';
import { emit, on } from '../core/events.js';
import { register } from '../core/registry.js';
import { G, villaStage, villaUpState, villaBuilding } from '../core/state.js';
import { el, fmtMoney } from '../core/util.js';
import { VILLA_UPS, VILLA_UP_BY_ID, FURN_BY_ID, VENDORS, vendorLook, npcLook } from '../data/index.js';
import { drawHamster } from '../art/hamster.js';
import { VILLA_STAGES } from '../interiors/villa.js';
import { fadeScene } from '../ui/fade.js';
import { enqueue } from '../ui/modals.js';
import { message, confirmBox } from '../ui/panel.js';
import { addRealtorTab, openRealtor, planCanvas } from './homes.js';
import { buy, priceTag, buyBtn, lacking } from './purchase.js';

const S = () => G.state;
const HOUSE_NAMES = [
  'Домик',
  'Дом с пристройкой',
  'Дом в два этажа',
  'Вилла в три этажа',
  'Вилла с мансардой и террасой',
];
/** Как дом называется сейчас: «домик», «вилла»… */
export const houseName = () => HOUSE_NAMES[villaStage()] || HOUSE_NAMES[3];

// ---------- сценка «строители за работой» ----------
/** Каска строителя над головой хомячка (x, y — пол под ним). */
function helmet(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y - 92 * s);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.ellipse(0, 0, 30, 22, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fillStyle = '#ffd43b';
  ctx.fill();
  ctx.strokeStyle = '#4a3728';
  ctx.lineWidth = 3;
  ctx.stroke();
  fillRR(ctx, -36, -4, 72, 8, 4, '#fab005', '#4a3728', 2.5);
  ctx.restore();
}
/** Кадр сценки: дом в лесах растёт, два строителя стучат молотками. kind — что строят (дом или двор). */
function paintBuilders(def) {
  const builders = [vendorLook('realtor'), npcLook('bob')];
  return (ctx, w, h, p, look, t) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#9bd8ff');
    g.addColorStop(1, '#e3f6ff');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 3; i++) {
      const cx = ((i * 190 + t * 14) % (w + 160)) - 80;
      ell(ctx, cx, 34 + i * 22, 44, 14, 'rgba(255,255,255,.9)');
      ell(ctx, cx + 26, 24 + i * 22, 26, 13, 'rgba(255,255,255,.9)');
    }
    const gy = h - 44;
    ctx.fillStyle = '#8ad26b';
    ctx.fillRect(0, gy, w, h - gy);
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.fillRect(0, gy, w, 5);
    const cx = w / 2,
      k = Math.min(1, p * 1.25);
    if (def.kind === 'house') {
      // дом: готовая часть и новая, которая «вырастает» — этаж сверху или пристройка сбоку
      const bw = 190,
        fh = 46,
        floors = Math.min(def.level, 3),
        side = def.level === 1;
      const x0 = cx - bw / 2 - (side ? 40 : 0);
      const done = side ? 1 : floors - (def.level === 4 ? 0 : 1);
      fillRR(ctx, x0, gy - done * fh, side ? bw * 0.55 : bw, done * fh, 6, '#fff3d6', '#4a3728', 3);
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.65 * k;
      if (side) fillRR(ctx, x0 + bw * 0.55, gy - fh * k, bw * 0.6, fh * k, 6, '#fff3d6', '#4a3728', 3);
      else
        fillRR(ctx, x0, gy - done * fh - fh * k, bw, fh * k, 6, def.level === 4 ? '#c9ecff' : '#fff3d6', '#4a3728', 3);
      ctx.restore();
      const top = gy - (side ? fh : done * fh + fh * k),
        rw = side ? bw * 1.15 : bw;
      poly(ctx, [x0 - 18, top, x0 + rw / 2, top - 38, x0 + rw + 18, top], '#f76e5c', '#4a3728', 3);
      fillRR(ctx, x0 + 30, gy - 34, 22, 34, 4, '#e8590c', '#4a3728', 2);
      fillRR(ctx, x0 + 70, gy - 34, 24, 20, 4, '#d0ebff', '#fff', 2.5);
      // леса
      const sx = x0 + rw + 26;
      for (const dx of [0, 34]) line(ctx, sx + dx, gy, sx + dx, top - 12, '#b9834f', 4);
      for (let y = gy - 30; y > top - 10; y -= 34) line(ctx, sx - 6, y, sx + 40, y, '#d9a066', 5);
    } else {
      // двор: яма пруда или бассейна, грядки, теплица
      const c = { pond: '#74c0fc', pool: '#4dabf7', beds: '#8d5a3a', green: 'rgba(208,240,255,.75)' }[def.kind];
      if (def.kind === 'green') {
        ctx.save();
        ctx.globalAlpha = 0.3 + 0.7 * k;
        fillRR(ctx, cx - 90, gy - 60 * k, 180, 60 * k, 4, c, '#fff', 4);
        poly(
          ctx,
          [cx - 96, gy - 60 * k, cx - 60, gy - 60 * k - 30, cx + 60, gy - 60 * k - 30, cx + 96, gy - 60 * k],
          c,
          '#fff',
          4,
        );
        ctx.restore();
      } else {
        ell(ctx, cx, gy + 14, 110 * (0.4 + 0.6 * k), 16, def.kind === 'beds' ? c : '#c8a070', '#4a3728', 3);
        if (def.kind !== 'beds') ell(ctx, cx, gy + 15, 96 * k, 11 * k, c);
        else
          for (let i = -2; i <= 2; i++)
            line(ctx, cx + i * 34 * k, gy + 6, cx + i * 34 * k, gy + 22, 'rgba(0,0,0,.25)', 3);
      }
    }
    // строители: стучат молотками по очереди, пыль и звёздочки
    builders.forEach((lk, i) => {
      const x = i ? w - 86 : 86,
        hit = Math.sin(t * 9 + i * Math.PI) > 0.2;
      drawHamster(ctx, x, gy + 22, 0.62, lk, { dir: i ? -1 : 1, time: t, armsUp: hit, happy: true });
      helmet(ctx, x, gy + 22, 0.62);
      const hx = x + (i ? -34 : 34),
        hy = gy - 26 - (hit ? 16 : 0);
      line(ctx, hx, hy + 20, hx + (i ? -8 : 8), hy, '#8d5524', 4);
      fillRR(ctx, hx + (i ? -20 : -4), hy - 8, 24, 11, 3, '#868e96', '#4a3728', 2);
      if (!hit) ell(ctx, hx + (i ? -18 : 18), gy + 4, 9, 5, 'rgba(255,255,255,.7)');
    });
  };
}

// ---------- покупка ----------
const STATE_NOTE = {
  done: '✓ Построено',
  building: '🔨 Строится — к утру будет готово',
  busy: 'Строители заняты — сначала закончат прошлый заказ',
  later: 'Сначала — прошлая ступень',
};
async function order(def, panel) {
  if (villaUpState(def.id) !== 'ok') return;
  if (lacking(def.price)) {
    buy(def.price); // подскажет, сколько не хватает
    return;
  }
  const ok = await confirmBox(
    'Строим?',
    `<p class="center big-emoji">${def.icon}🔨</p><p class="center"><b>${def.name}</b> за <b>🪙 ${fmtMoney(def.price)}</b>.<br>${def.about}<br>Строители придут сегодня, а к утру всё будет готово.</p>`,
    'Да, строим! 🔨',
    'Ещё подумаю',
  );
  // пока окно было открыто, заказ могли уже сделать (второе нажатие) — деньги второй раз не списываем
  if (!ok || villaUpState(def.id) !== 'ok' || !buy(def.price)) return;
  orderVillaUp(def.id);
  emit('buy', { cat: 'villa', id: def.id });
  if (panel && !panel.closed) panel.close();
  sfx('fanfare');
  await fadeScene({
    cls: 'hol-fade',
    text: `Тук-тук-тук! Строители взялись за работу: ${def.name.toLowerCase()} 🔨`,
    paint: paintBuilders(def),
    ms: 3400,
    w: 520,
    ratio: 0.58,
  });
  message({
    title: 'Стройка началась!',
    icon: '🔨',
    html: `<p class="center big-emoji">👷${def.icon}</p><p class="center">Строители работают быстро: <b>к утру всё будет готово</b>.<br>Вечером ложись спать — а утром посмотри, что получилось!</p>`,
    buttons: [{ text: 'Жду утра! 🌙' }],
  });
}

function upCard(def, panel) {
  const st = villaUpState(def.id);
  const li = el('div', 'list-item home-card' + (st === 'later' || st === 'done' ? ' soon' : ''));
  if (def.kind === 'house') li.appendChild(planCanvas(VILLA_STAGES[def.level]));
  else li.appendChild(el('div', 'home-plan up-icon', def.icon));
  li.appendChild(
    el(
      'div',
      'grow',
      `<div class="ttl">${def.icon} ${def.name}</div><div class="sub">${def.about}</div>
       <div class="perks">${def.perks.map((p) => `<span>${p}</span>`).join('')}</div>`,
    ),
  );
  const side = el('div', 'side');
  if (st === 'ok') {
    const pr = el('div', 'card-pr');
    pr.appendChild(priceTag(def.price));
    side.appendChild(pr);
    side.appendChild(buyBtn('Построить 🔨', def.price, () => order(def, panel)));
  } else {
    if (st !== 'done' && st !== 'building') side.appendChild(el('div', 'pr far', `🪙 ${fmtMoney(def.price)}`));
    side.appendChild(el('div', st === 'done' || st === 'building' ? 'own' : 'soon-note', STATE_NOTE[st]));
  }
  li.appendChild(side);
  return li;
}

/** Вкладка «Стройка» окна риелтора: дом (следующая ступень и дальше) и двор. */
function renderBuild(body, panel) {
  const b = villaBuilding();
  body.appendChild(
    el(
      'p',
      'muted',
      `<b>${VENDORS.realtor.name}:</b> «Дом растёт вместе с хозяйкой! Сейчас у тебя <b>${houseName().toLowerCase()}</b>. ${b ? `Строители уже работают: ${b.name.toLowerCase()} — к утру закончат.` : 'Скажи, что построить, — мои строители управятся за одну ночь.'}»`,
    ),
  );
  const house = VILLA_UPS.filter((d) => d.kind === 'house' && villaUpState(d.id) !== 'done'),
    yard = VILLA_UPS.filter((d) => d.kind !== 'house');
  body.appendChild(el('h3', 'up-h', '🏠 Дом'));
  if (house.length) for (const d of house) body.appendChild(upCard(d, panel));
  else body.appendChild(el('p', 'muted center', 'Дом достроен целиком: от кухни до террасы под крышей! 🎉'));
  body.appendChild(el('h3', 'up-h', '🌳 Двор'));
  // сначала то, что можно построить, в конце — построенное
  for (const d of [...yard].sort((x, y) => (villaUpState(x.id) === 'done') - (villaUpState(y.id) === 'done')))
    body.appendChild(upCard(d, panel));
}
addRealtorTab({ id: 'build', name: '🔨 Стройка', render: renderBuild });

// ---------- утро: готово ----------
on('villaUp', ({ what, id, moved = [] }) => {
  if (what !== 'done') return;
  const def = VILLA_UP_BY_ID[id];
  if (!def) return;
  const names = [...new Set(moved)].map((m) => (FURN_BY_ID[m] ? FURN_BY_ID[m].name.toLowerCase() : m));
  enqueue(
    () => {
      sfx('fanfare');
      return message({
        title: 'Строители закончили!',
        icon: '🔨',
        html: `<p class="center big-emoji">${def.icon}🎉</p><p class="center">${def.done}</p>${names.length ? `<p class="muted center">На новом месте мешала мебель (${names.join(', ')}) — строители убрали её в кладовку. Поставь, где нравится: 🔨 «Обустроить».</p>` : ''}`,
        buttons: [{ text: 'Ура!' }],
      });
    },
    { delay: 1800 },
  );
});

register('villa-up', () => openRealtor('build'), 'стройка виллы: вкладка «Стройка» в агентстве «Свой домик»');

/** Для тестов и отладки: что построено и что можно заказать. */
export const debugVillaUp = () => ({
  ...S().villaUp,
  name: houseName(),
  states: Object.fromEntries(VILLA_UPS.map((d) => [d.id, villaUpState(d.id)])),
});
