// ГОРА (П.9): что делают на горе и по дороге туда. Сама локация (где что стоит) — locations/mountain.js; она называет
// действия реестра, а выполняются они здесь:
//   задание Сени «На вершину!» (data/quests.js, summit) — своё «как дела» (hintWarm): нет тёплых вещей — где купить,
//                        а если и назавтра нет — Сеня дарит свою шапку (так задание выполнимо в любой сезон)
//   cableway:up | down   канатная дорога: вагончик едет на гору из леса (вход way:mountain у станции в лесу —
//                        LANDS.mountain.go) и обратно в лес (станция на горе); короткая картинка-переезд
// Числа — MOUNTAIN в data/economy.js. Каждое занятие шлёт событие mountain { what } — по нему считают задания.
// Состояние меняют только действия (core/actions.js); «раз в день» — отметки дня (dayFlags.mountain).
import { setFlag, addClothes } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { makeCanvas, ell, fillRR, line, poly } from '../core/draw.js';
import { go } from '../core/loop.js';
import { register } from '../core/registry.js';
import { G, cal, hasClothes, playerLook } from '../core/state.js';
import { el } from '../core/util.js';
import { drawHamster } from '../art/hamster.js';
import { CLOTHES, CLOTHES_BY_ID, LAND_BY_ID, isWarmItem } from '../data/index.js';
import { openLayer } from '../ui/modals.js';
import { toast } from '../ui/toast.js';
import { setWaitHook } from './quests.js';

const S = () => G.state;

// ---------- задание Сени: тёплые вещи ----------
/** Шапка, которую Сеня дарит, если у хомячка совсем нет тёплых вещей. */
export const SENYA_HAT = 'beanie_blue';
/** Есть ли в шкафу хоть одна тёплая вещь (шапка, куртка, кофта, шарф…). */
export const ownsWarm = () => CLOTHES.some((c) => isWarmItem(c) && hasClothes(c.id));
/**
 * «Как дела?» у Сени на шаге «оденься тепло»: тёплое в шкафу есть — надень; нет — где купить (отметка дня
 * flags.senyaNoWarm); пришла назавтра и всё ещё нет — Сеня дарит свою шапку.
 */
export function hintWarm(w) {
  if (w.i !== 1) return null;
  const s = S();
  if (ownsWarm())
    return 'Плаваешь ты как чемпион! Теперь оденься потеплее: у тебя в шкафу есть тёплые вещи — надень шапку, куртку, кофту или шарф (шкаф — дома 🏡) и приходи!';
  const asked = s.flags.senyaNoWarm;
  if (Number.isFinite(asked) && s.day > asked && !hasClothes(SENYA_HAT)) {
    addClothes(SENYA_HAT);
    sfx('win');
    toast(`🎁 Подарок от Сени: ${CLOTHES_BY_ID[SENYA_HAT].name} — уже в шкафу!`, 'good');
    return `Не нашла тёплых вещей? Ничего! Держи мою запасную шапку — ${CLOTHES_BY_ID[SENYA_HAT].name.toLowerCase()}. Она уже у тебя в шкафу: надень её дома и приходи!`;
  }
  if (!Number.isFinite(asked)) setFlag('senyaNoWarm', s.day);
  return 'Ой, а у тебя совсем нет тёплых вещей? Кофты продаются в ТЦ «Модный» каждый день, а шапки, куртки и шарфы — осенью и зимой. Не найдёшь — загляни ко мне завтра, что-нибудь придумаем!';
}
setWaitHook('summit', hintWarm);

// ---------- канатная дорога ----------
const OUT = '#4a3728';
/** Картинка переезда: лес внизу слева, гора со снежной шапкой справа, по тросу едет вагончик (k — 0..1 пути). */
export function paintRide(ctx, w, h, k, season, look, t) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, season === 'winter' ? '#a9d4f2' : '#7cc8f8');
  sky.addColorStop(1, '#e7f6ff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  // гора
  const mx = w * 0.72;
  poly(ctx, [mx - w * 0.5, h, mx, h * 0.12, mx + w * 0.5, h], '#9aa9c9', OUT, 2.5);
  poly(ctx, [mx, h * 0.12, mx + w * 0.5, h, mx + w * 0.12, h], '#7d8db0');
  poly(ctx, [mx - 52, h * 0.12 + 62, mx, h * 0.12, mx + 56, h * 0.12 + 66, mx + 26, h * 0.12 + 52, mx + 6, h * 0.12 + 70, mx - 22, h * 0.12 + 54], '#ffffff', OUT, 2);
  // облака ниже вершины
  for (let i = 0; i < 4; i++) {
    const cx = ((i * 0.31 + t * 0.03) % 1.3) * w - w * 0.15,
      cy = h * (0.36 + (i % 2) * 0.08);
    ctx.globalAlpha = 0.85;
    for (const [dx, dy, r] of [
      [0, 0, 30],
      [26, -8, 24],
      [50, 2, 26],
    ])
      ell(ctx, cx + dx, cy + dy, r, r * 0.6, '#ffffff');
    ctx.globalAlpha = 1;
  }
  // лес внизу
  const fir = season === 'winter' ? '#cfe3f0' : '#2b8a3e';
  for (let i = 0; i < 16; i++) {
    const x = (i / 15) * w * 0.75 - 10,
      y = h - 8 - ((i * 37) % 23);
    poly(ctx, [x - 20, y + 20, x, y - 38, x + 20, y + 20], fir, OUT, 1.6);
  }
  // трос и вагончик
  const ax = w * 0.06,
    ay = h * 0.82,
    bx = mx - 8,
    by = h * 0.2;
  line(ctx, ax, ay, bx, by, OUT, 2.2);
  const x = ax + (bx - ax) * k,
    y = ay + (by - ay) * k,
    sway = Math.sin(t * 3) * 0.06;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(sway);
  line(ctx, 0, 0, 0, 22, OUT, 2.4);
  fillRR(ctx, -34, 22, 68, 56, 14, '#fa5252', OUT, 2.5);
  fillRR(ctx, -26, 30, 52, 28, 6, '#cfeaff', OUT, 2);
  ctx.save();
  ctx.beginPath();
  ctx.rect(-26, 30, 52, 28);
  ctx.clip();
  drawHamster(ctx, 0, 80, 0.5, look, { time: t, shadow: false, happy: true });
  ctx.restore();
  ctx.fillStyle = 'rgba(0,0,0,.14)';
  ctx.fillRect(18, 24, 12, 52);
  ctx.restore();
}
let riding = false;
/** Проехать на канатной дороге: up — из леса на гору, иначе — с горы в лес. */
export function rideCableway(up) {
  if (riding) return false;
  const land = LAND_BY_ID.mountain;
  riding = true;
  sfx('lift');
  const W = Math.min(560, window.innerWidth - 32),
    H = Math.round(W * 0.62);
  const f = el('div', 'fade cable-ride', `<div class="msg"><div><div class="ride-pic"></div><p>${up ? '🚡 Едем на гору!' : '🚡 Едем вниз, в лес!'}</p></div></div>`);
  const { canvas, ctx } = makeCanvas(W, H);
  canvas.style.borderRadius = '18px';
  f.querySelector('.ride-pic').appendChild(canvas);
  document.body.appendChild(f);
  const closeLayer = openLayer();
  let cover = null,
    raf = 0;
  const t0 = performance.now(),
    look = playerLook(),
    season = cal().season,
    DUR = 2300;
  const loop = (now) => {
    const t = (now - t0) / 1000,
      p = Math.min(1, (now - t0) / DUR),
      e = p * p * (3 - 2 * p);
    paintRide(ctx, W, H, up ? 0.08 + e * 0.84 : 0.92 - e * 0.84, season, look, t);
    if (p < 1) raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  requestAnimationFrame(() => f.classList.add('on'));
  setTimeout(() => {
    cover = openLayer({ pause: false, cover: true }); // экран уже тёмный — сцену под ним не рисуем
  }, 400);
  setTimeout(() => {
    if (up) go(land.scene, { at: land.entry });
    else go(land.from, { at: 'station' });
  }, DUR - 300);
  setTimeout(() => {
    cancelAnimationFrame(raf);
    if (cover) cover();
    f.classList.remove('on');
    setTimeout(() => {
      f.remove();
      closeLayer();
      riding = false;
      sfx('ding');
    }, 380);
  }, DUR + 150);
  return true;
}
register('cableway', (p) => rideCableway(p.arg !== 'down'), 'канатная дорога: cableway:up (из леса на гору) | cableway:down');
