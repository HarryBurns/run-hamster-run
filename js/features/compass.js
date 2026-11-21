// Компас Капитана Боба (О5): после задания Лифтёра Этажкина он лежит в рюкзаке (находки). Нажала на него — окно
// со стрелкой к цели активного квеста (features/goals.js — та же, что у звёздочки). Цель в этом месте — «Цель —
// на северо-востоке, в лесу»; в другом месте — куда идти
// к дороге туда («карта мира»: sc.wayTo, routeTo — data/places.js). На кораблике без цели — «на юг, к острову»
// (так говорил Боб), на суше без цели — компас просто смотрит на север. Север — вверх карты.
// Состояние не меняет: только смотрит. Какой квест активен, решает игрок в журнале («⭐ Веди меня»).
import { sfx } from '../core/audio.js';
import { ell, line, poly, star } from '../core/draw.js';
import { ROUTE_WORDS } from '../data/index.js';
import { T, currentLocation } from '../engine/topdown/index.js';
import { message } from '../ui/panel.js';
import { goalNow, goalPlace, LOC_WORDS } from './goals.js';

const OUT = '#4a3728';
/** Восемь сторон света (по часовой от севера) — «на севере», «на северо-востоке»… */
const SIDES = [
  'на севере',
  'на северо-востоке',
  'на востоке',
  'на юго-востоке',
  'на юге',
  'на юго-западе',
  'на западе',
  'на северо-западе',
];
/** Угол стрелки (рад, по часовой от севера = вверх) из сдвига dx, dy (y вниз — на юг). */
const angleOf = (dx, dy) => Math.atan2(dx, -dy);
const sideOf = (a) => SIDES[(Math.round(a / (Math.PI / 4)) + 8) % 8];

/** Картинка компаса со стрелкой под углом a (data: URL); a = null — стрелка дрожит у севера (цели нет). */
export function compassImage(a, s = 180) {
  const c = document.createElement('canvas');
  c.width = c.height = s * 2;
  const x = c.getContext('2d');
  x.scale(2, 2);
  x.lineJoin = x.lineCap = 'round';
  const m = s / 2,
    r = s * 0.44;
  // корпус: медь и стекло
  ell(x, m, m + 3, r + 6, r + 6, 'rgba(74,55,40,.25)');
  ell(x, m, m, r + 6, r + 6, '#e8a33d', OUT, 3);
  ell(x, m, m, r, r, '#fff9db', OUT, 2);
  // деления и буквы сторон света
  for (let i = 0; i < 16; i++) {
    const t = (i / 16) * Math.PI * 2,
      big = i % 4 === 0,
      r1 = r - (big ? 12 : 7);
    line(
      x,
      m + Math.sin(t) * r1,
      m - Math.cos(t) * r1,
      m + Math.sin(t) * (r - 3),
      m - Math.cos(t) * (r - 3),
      OUT,
      big ? 2.5 : 1.5,
    );
  }
  x.font = `900 ${Math.round(s * 0.1)}px ui-rounded, "Trebuchet MS", sans-serif`;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  for (const [ch, t, col] of [
    ['С', 0, '#e03131'],
    ['В', Math.PI / 2, OUT],
    ['Ю', Math.PI, OUT],
    ['З', -Math.PI / 2, OUT],
  ]) {
    x.fillStyle = col;
    x.fillText(ch, m + Math.sin(t) * (r - 24), m - Math.cos(t) * (r - 24));
  }
  // стрелка: красный конец — куда идти, синий — обратно
  const ang = a == null ? 0 : a;
  x.save();
  x.translate(m, m);
  x.rotate(ang);
  const L = r - 30,
    W = s * 0.07;
  poly(x, [0, -L, W, 0, -W, 0], '#ff6b6b', OUT, 2.5);
  poly(x, [0, L * 0.8, W, 0, -W, 0], '#74c0fc', OUT, 2.5);
  x.restore();
  ell(x, m, m, s * 0.05, s * 0.05, '#ffd43b', OUT, 2);
  if (a != null) star(x, m + Math.sin(ang) * (r + 1), m - Math.cos(ang) * (r + 1), s * 0.065, '#ffd43b', OUT, 1.5);
  return c.toDataURL();
}

/**
 * Куда смотрит компас сейчас: { a — угол стрелки (null — цели нет, просто на север), text — что сказать, title — над
 * текстом (активный квест) }. Только читает: место, где хомячок (в доме — то, что снаружи), и звёздочку этого места.
 */
export function compassRead() {
  const loc = currentLocation(),
    g = goalNow(),
    pl = goalPlace(),
    scene = pl ? pl.scene : null,
    p = loc.p,
    boat = !!(p.ride && p.ride.id === 'boat'),
    tg = loc.target(),
    title = g ? `${g.icon} ${g.title}` : '';
  if (!tg) {
    if (scene && scene !== loc.name)
      return { a: null, title, text: `Цель — ${LOC_WORDS[scene] || 'в другом месте'}, но туда пока нет дороги.` };
    if (boat)
      return {
        a: Math.PI,
        title,
        text: 'Стрелка показывает <b>на юг — к острову</b> с вулканом 🌋 Капитан Боб говорил: «Держи курс на юг и не спорь с компасом!»',
      };
    return {
      a: null,
      title,
      text: g
        ? 'У этого дела нет одного места на карте — и компас просто <b>смотрит на север</b> 🧭 Что делать, написано в журнале 📖'
        : 'Заданий сейчас нет — и компас просто <b>смотрит на север</b>, как и положено честному компасу 🧭 Загляни в журнал 📖, когда появится новое дело!',
    };
  }
  const dx = tg.x - p.x,
    dy = tg.y - p.y,
    d = Math.hypot(dx, dy) / T,
    a = angleOf(dx, dy),
    side = sideOf(a);
  if (tg.next) {
    // цель в другом месте — стрелка к дороге туда (выход, канатка, кораблик…)
    const there = LOC_WORDS[scene] || 'в другом месте',
      how = (ROUTE_WORDS[loc.name] || {})[tg.next],
      far = scene && scene !== tg.next;
    return {
      a,
      title,
      text: `Цель — <b>${there}</b>. Дорога туда — <b>${side}</b>${how ? `: ${far ? 'сначала ' : ''}${how}` : ''}. Иди за звёздочкой ⭐`,
    };
  }
  if (d < 2.5) return { a, title, text: 'Цель <b>совсем рядом</b> — оглянись, там звёздочка ⭐' };
  const here = LOC_WORDS[loc.name] ? `, ${LOC_WORDS[loc.name]}` : '';
  return {
    a,
    title,
    text: `Цель — <b>${side}</b>${here}${d > 25 ? ', идти ещё далеко' : d < 10 ? ', уже недалеко' : ''}. Иди за звёздочкой ⭐`,
  };
}

/** Нажали на компас в рюкзаке: окно со стрелкой. */
export function useCompass() {
  const r = compassRead();
  sfx('paper');
  return message({
    title: 'Компас',
    icon: '🧭',
    html: `<p class="center"><img class="compass-face" src="${compassImage(r.a)}" alt="Компас" style="width:180px;height:180px"></p>${
      r.title ? `<p class="center"><b>${r.title}</b></p>` : ''
    }<p class="center compass-text">${r.text}</p>`,
    buttons: [{ text: 'Понятно' }],
  });
}
