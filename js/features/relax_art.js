// РИСУНКИ ОТДЫХА (features/relax.js) — без логики: хомячок или житель на скамейке, лежаке, в гамаке, на качелях
// и горке (кадры из кэша спрайтов SP), солнышко над лежаком, «z-z-z», облачко с репликой. Кто где сидит и сколько
// уже отдыхает, решает relax.js. Лежит в features/, а не в art/: кадры кладутся в кэш спрайтов движка локаций.
import { TAU } from '../core/util.js';
import { line, fillRR, emoji } from '../core/draw.js';
import { drawHamster, blinkAt } from '../art/hamster.js';
import { RELAX } from '../data/index.js';
import { PS, SP, OUT } from '../engine/topdown/kinds.js';

const HB = [-46, -100, 46, 12]; // рамка кадра хомячка (единицы мира)
const TOWELS = ['#ff8fab', '#74c0fc', '#ffd43b', '#63e6be', '#b197fc']; // цвета пляжных полотенец (common/props.js)
/** Кадр хомячка из кэша: key — что в нём меняется, pose — поза drawHamster, k — размер (1 — как на ходу), rot — наклон. */
function frame(key, look, pose, k = 1, rot = 0) {
  return SP.get(key, HB, (c) => {
    if (rot) c.rotate(rot);
    drawHamster(c, 0, 0, PS * k, look, pose);
  });
}
const shutAt = (t, ph) => (blinkAt(t, ph) > 0.5 ? 1 : 0);
const bez = (u, a, b, c, d) => {
  const v = 1 - u;
  return [0, 1].map((i) => v * v * v * a[i] + 3 * v * v * u * b[i] + 3 * v * u * u * c[i] + u * u * u * d[i]);
};

/**
 * Нарисовать отдыхающего (хомячка или жителя): how, точка сиденья x, y, фаза t, ключ внешности lk, предмет o и место
 * spot на нём, dir — куда смотрит. ct — сколько секунд отдыхает хомячок (задремала ли на лежаке, где она на горке).
 */
export function drawSitter(ctx, how, look, lk, x, y, t, ph, o, spot, dir, ct) {
  const shut = shutAt(t, ph);
  if (how === 'sit') {
    const fr = Math.floor(((t * 0.9 + ph) % 1) * 8),
      kick = o.type === 'bench' || o.type === 'log' || o.type === 'fountain';
    const s = frame(`rx:${lk}:sit:${kick ? fr : 0}:${shut}:${dir}`, look, {
      sit: true,
      shadow: false,
      kick: kick ? (fr + 0.5) / 8 : undefined,
      blink: shut,
      dir,
    });
    SP.draw(s, x, y);
    return;
  }
  if (how === 'lie') {
    // лежак (полотенце) сверху: хомячок на спинке, головой к изголовью, ноги укрыты краем полотенца того же цвета;
    // задремал — глазки закрыты
    const doze = ct > RELAX.dozeAfter ? 1 : 0;
    const br = Math.floor(((Math.sin(t * 1.6 + ph) + 1) / 2) * 3.99);
    const cov = o.type === 'towel' ? TOWELS[(o.v === undefined ? o.tx : o.v) % 5] : '#ff8fab';
    const s = SP.get(`rx:${lk}:lie:${cov}:${doze}:${br}:${doze ? 1 : shut}`, HB, (c) => {
      c.save();
      c.scale(1, 0.84);
      drawHamster(c, 0, 0, PS * 0.74, look, {
        sit: true,
        shadow: false,
        sleep: !!doze,
        happy: !doze,
        blink: doze ? 1 : shut,
        time: br * 0.3,
      });
      c.restore();
      const top = -15 - br * 0.4;
      fillRR(c, -13, top, 26, 17 + br * 0.4, 4, '#fff8ec', OUT, 1.6);
      c.fillStyle = cov;
      for (let i = 0; i < 2; i++) c.fillRect(-11, top + 3 + i * 7, 22, 4);
    });
    SP.draw(s, x, y);
    return;
  }
  if (how === 'hammock') {
    // в гамаке: лежит на боку головой к подушке, снизу — край ткани гамака (цвет — как у гамака, поле v)
    const br = Math.floor(((Math.sin(t * 1.6 + ph) + 1) / 2) * 3.99),
      col = ['#ff8fab', '#74c0fc', '#ffd43b'][(o.v || 0) % 3];
    const s = SP.get(`rx:${lk}:ham:${col}:${br}`, [-60, -50, 60, 30], (c) => {
      c.save();
      c.translate(30, -3 - br * 0.3);
      c.rotate(-1.45);
      drawHamster(c, 0, 0, PS, look, { sit: true, shadow: false, sleep: true, time: br * 0.3 });
      c.restore();
      c.beginPath();
      c.moveTo(-37, -20);
      c.quadraticCurveTo(0, 23, 37, -20);
      c.quadraticCurveTo(0, 10, -37, -20);
      c.closePath();
      c.fillStyle = col;
      c.fill();
      c.save();
      c.clip();
      c.fillStyle = 'rgba(255,255,255,.55)';
      for (let i = 0; i < 6; i++) c.fillRect(-31 + i * 12, -24, 5, 50);
      c.restore();
      c.strokeStyle = OUT;
      c.lineWidth = 2;
      c.stroke();
    });
    SP.draw(s, x, y);
    return;
  }
  if (how === 'swing') {
    // качели: сиденье ходит вперёд-назад, на краях поднимается выше
    const a = Math.sin(t * 2.3 + ph) * 0.55,
      fr = Math.round((a / 0.55) * 6), // −6..6
      aa = (fr / 6) * 0.55;
    const sx = x,
      sy = y - (1 - Math.cos(aa)) * 60 + Math.sin(aa) * 12;
    const s = SP.get(`rx:${lk}:swing:${spot}:${fr}:${shut}`, [-46, -100, 46, 14], (c) => {
      drawHamster(c, 0, 0, PS * 0.8, look, { sit: true, shadow: false, happy: Math.abs(fr) > 3, blink: shut });
      fillRR(c, -9, -4, 18, 6, 2, spot ? '#51cf66' : '#4dabf7', OUT, 1.5);
    });
    SP.draw(s, sx, sy);
    // цепочки — от перекладины к сиденью, впереди: хомячок держится за них лапками
    SP.world();
    const top = o.y - 78;
    line(ctx, x - 11, top, sx - 10, sy - 2, '#8a8f98', 1.6);
    line(ctx, x + 11, top, sx + 10, sy - 2, '#8a8f98', 1.6);
    return;
  }
  if (how === 'slide') {
    // горка: с площадки по жёлобу вниз за RELAX.slide секунд (кривая как в рисунке горки, common/props.js)
    const u = Math.min(1, ct / RELAX.slide),
      q = u * u * (3 - 2 * u),
      b = bez(q, [-10, -50], [14, -44], [24, -2], [38, 10]);
    const s = frame(`rx:${lk}:slide:${q > 0.15 && q < 0.95 ? 1 : 0}`, look, {
      sit: true,
      shadow: false,
      happy: true,
      armsUp: q > 0.15 && q < 0.95,
    });
    SP.draw(s, o.x + b[0], o.y + b[1]);
  }
}

/**
 * Мелочи над отдыхающей хомячком (x, y — точка сиденья): на лежаке на солнце (sunny) — солнышко, задремала — «z-z-z»
 * (в гамаке — всегда), say — облачко с репликой. ct — сколько секунд отдыхает, t — время кадра.
 */
export function drawRestExtras(ctx, how, x, y, t, ct, sunny, say) {
  if (how === 'lie' && sunny) {
    // загорает: солнышко над лежаком тихонько пульсирует
    const k = 1 + Math.sin(t * 2) * 0.08;
    emoji(ctx, '☀️', x + 24, y - 58, 18 * k);
  }
  if (how === 'lie' && ct > RELAX.dozeAfter) zzz(ctx, x - 22, y - 50, ct);
  if (how === 'hammock') zzz(ctx, x - 30, y - 34, ct);
  if (say) bubble(ctx, say, x, y - 92);
}

/** «z-z-z» — дремлет. */
function zzz(ctx, x, y, t) {
  ctx.fillStyle = OUT;
  ctx.textAlign = 'center';
  for (let i = 0; i < 3; i++) {
    const ph = (t * 0.45 + i / 3) % 1;
    ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.85;
    ctx.font = `900 ${10 + ph * 8}px ui-rounded, "Trebuchet MS", sans-serif`;
    ctx.fillText('z', x - ph * 12 + Math.sin(ph * TAU) * 3, y - ph * 26);
  }
  ctx.globalAlpha = 1;
}

/** Облачко с репликой (две строки, если длинная); (x, y) — кончик хвостика. */
export function bubble(ctx, text, x, y) {
  const size = 12;
  ctx.font = `800 ${size}px ui-rounded, "Trebuchet MS", sans-serif`;
  let lines = [text];
  if (ctx.measureText(text).width > 170) {
    const words = text.split(' ');
    let a = '',
      i = 0;
    while (i < words.length && ctx.measureText(a + words[i]).width < Math.max(90, ctx.measureText(text).width / 2))
      a += words[i++] + ' ';
    lines = [a.trim(), words.slice(i).join(' ')];
  }
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 18,
    h = lines.length * (size + 3) + 10;
  fillRR(ctx, x - w / 2, y - h, w, h, 9, 'rgba(255,255,255,.96)', OUT, 2);
  ctx.beginPath();
  ctx.moveTo(x - 6, y - 1);
  ctx.lineTo(x, y + 8);
  ctx.lineTo(x + 6, y - 1);
  ctx.fillStyle = 'rgba(255,255,255,.96)';
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 6, y);
  ctx.lineTo(x, y + 8);
  ctx.lineTo(x + 6, y);
  ctx.stroke();
  ctx.fillStyle = OUT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, x, y - h + 5 + (size + 3) * (i + 0.5)));
  ctx.textBaseline = 'alphabetic';
}
