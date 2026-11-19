// Транспорт хомячка (этап 17б): самокат, велосипед и машинка-кабриолет — рисунки кодом, вид сбоку.
//
// У каждого вида: back(ctx, d, fr) — то, что позади хомячка; front(ctx, d, fr) — то, что перед ним (руль, корзинка,
// дверца); seat — где и как сидит или стоит хомячок: { x, y, pose }. (0, 0) — точка на земле под серединой;
// d — куда едет (1 — вправо, -1 — влево); fr — кадр колёс 0..3 (спицы повёрнуты). Размер — под хомячка на карте
// «вид сверху» (PS = 0,78). Значок для магазина — rideIcon(id, размер).
import { TAU } from '../core/util.js';
import { ell, fillRR, line, poly, shade, makeCanvas } from '../core/draw.js';
import { drawHamster } from './hamster.js';

const OUT = '#4a3728';

/** Колесо: шина, обод, спицы (кадр fr поворачивает их). */
function wheel(c, x, y, r, fr, hub = '#ffd43b') {
  ell(c, x, y, r, r, '#5b6676', OUT, 2);
  ell(c, x, y, r * 0.66, r * 0.66, '#f1f3f5', OUT, 1.2);
  const a0 = (fr / 4) * (TAU / 3);
  for (let i = 0; i < 3; i++) {
    const a = a0 + (i * TAU) / 3;
    line(c, x - Math.cos(a) * r * 0.62, y - Math.sin(a) * r * 0.62, x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, '#adb5bd', 1.2);
  }
  ell(c, x, y, r * 0.24, r * 0.24, hub, OUT, 1);
}
const shadow = (c, rx) => ell(c, 0, 1, rx, 5, 'rgba(52,38,70,.17)');
/** Толстая цветная трубка с контуром. */
function tube(c, x1, y1, x2, y2, col, w = 4) {
  line(c, x1, y1, x2, y2, OUT, w + 2.6);
  line(c, x1, y1, x2, y2, col, w);
}

export const WHEELS_ART = {
  // ---------- самокат: хомячок стоит на деке и держится за руль ----------
  scooter: {
    box: [-58, -112, 58, 16],
    seat: (d) => ({ x: -5 * d, y: -9, pose: { dir: d, shadow: false } }),
    back(c, d, fr) {
      shadow(c, 34);
      wheel(c, -25 * d, -7, 7, fr, '#ff8fab');
      // дека
      tube(c, -25 * d, -8, 16 * d, -8, '#63e6be', 5);
      tube(c, -25 * d, -8, -31 * d, -15, '#63e6be', 3); // крылышко над задним колесом
    },
    front(c, d, fr) {
      wheel(c, 25 * d, -7, 7, fr, '#ff8fab');
      // стойка руля и ручки
      tube(c, 24 * d, -9, 17 * d, -52, '#ff8fab', 3.4);
      tube(c, 11 * d, -53, 23 * d, -51, '#4b5563', 4);
      ell(c, 11 * d, -53, 3, 3, '#ffd43b', OUT, 1.4);
    },
  },
  // ---------- велосипед: сидит на седле, впереди корзинка с цветком ----------
  bike: {
    box: [-64, -116, 66, 16],
    seat: (d) => ({ x: -9 * d, y: -27, pose: { dir: d, shadow: false, sit: true } }),
    back(c, d, fr) {
      shadow(c, 44);
      wheel(c, -29 * d, -14, 14, fr);
      wheel(c, 29 * d, -14, 14, fr);
      const col = '#74c0fc';
      tube(c, -29 * d, -14, -8 * d, -15, col, 3); // к каретке
      tube(c, -29 * d, -14, -13 * d, -36, col, 3);
      tube(c, -8 * d, -15, -13 * d, -40, col, 3.4); // подседельная труба
      tube(c, -8 * d, -15, 17 * d, -38, col, 3.4);
      tube(c, -13 * d, -36, 17 * d, -38, col, 3.4);
      // педали
      ell(c, -8 * d, -15, 4, 4, '#ffd43b', OUT, 1.4);
      const a = (fr / 4) * TAU;
      line(c, -8 * d, -15, -8 * d + Math.cos(a) * 7, -15 + Math.sin(a) * 7, OUT, 2.4);
      fillRR(c, -8 * d + Math.cos(a) * 7 - 4, -15 + Math.sin(a) * 7 - 1.5, 8, 3, 1.5, '#495057');
      // седло
      fillRR(c, -13 * d - 9, -45, 18, 6, 3, '#e8590c', OUT, 1.6);
    },
    front(c, d) {
      const col = '#74c0fc';
      tube(c, 29 * d, -14, 17 * d, -40, col, 3.4); // вилка
      tube(c, 17 * d, -38, 15 * d, -52, col, 3);
      tube(c, 9 * d, -54, 21 * d, -52, '#4b5563', 4); // руль
      ell(c, 9 * d, -54, 3, 3, '#ff8fab', OUT, 1.4);
      // корзинка
      poly(c, [22 * d, -46, 40 * d, -46, 37 * d, -31, 25 * d, -31], '#f0c987', OUT, 1.8);
      for (const k of [0.33, 0.66]) line(c, (22 + 18 * k) * d, -46, (25 + 12 * k) * d, -31, 'rgba(74,55,40,.4)', 1);
      line(c, 23.5 * d, -39, 38.5 * d, -39, 'rgba(74,55,40,.4)', 1);
      line(c, 31 * d, -46, 31 * d, -54, '#2f9e44', 1.6);
      for (let i = 0; i < 5; i++) ell(c, 31 * d + Math.cos((i * TAU) / 5) * 3.4, -56 + Math.sin((i * TAU) / 5) * 3.4, 2.4, 2.4, '#ff8fab');
      ell(c, 31 * d, -56, 2, 2, '#ffd43b');
    },
  },
  // ---------- кабриолет: сидит за рулём, видно по плечи ----------
  car: {
    box: [-78, -112, 78, 16],
    seat: (d) => ({ x: -7 * d, y: -19, pose: { dir: d, shadow: false, sit: true } }),
    back(c, d) {
      shadow(c, 60);
      // дальний борт и спинка сиденья
      fillRR(c, -52, -44, 84, 16, 7, shade('#ff8fab', -0.18), OUT, 2);
      fillRR(c, -26 * d - 9, -58, 18, 24, 6, '#fff3d6', OUT, 1.8);
      // ветровое стекло
      poly(c, [14 * d, -40, 24 * d, -62, 28 * d, -62, 22 * d, -40], 'rgba(214,240,255,.75)', OUT, 1.6);
    },
    front(c, d, fr) {
      const body = '#ff8fab';
      // кузов: капот впереди, багажник сзади
      c.beginPath();
      c.moveTo(-62 * d, -16);
      c.lineTo(-62 * d, -32);
      c.quadraticCurveTo(-60 * d, -40, -46 * d, -40);
      c.lineTo(22 * d, -40);
      c.quadraticCurveTo(52 * d, -39, 62 * d, -30);
      c.quadraticCurveTo(66 * d, -24, 64 * d, -14);
      c.lineTo(-62 * d, -14);
      c.closePath();
      c.fillStyle = body;
      c.fill();
      c.strokeStyle = OUT;
      c.lineWidth = 2.2;
      c.stroke();
      // блик и дверца
      line(c, -44 * d, -35, 18 * d, -35, 'rgba(255,255,255,.55)', 2.4);
      fillRR(c, Math.min(-22 * d, 12 * d), -33, 34, 17, 5, shade(body, 0.08), 'rgba(74,55,40,.45)', 1.4);
      ell(c, 6 * d, -27, 2.6, 1.4, '#fff');
      // фара, фонарик, бампер
      ell(c, 60 * d, -26, 4, 5, '#fff3bf', OUT, 1.6);
      ell(c, -61 * d, -27, 2.4, 4, '#fa5252', OUT, 1.2);
      fillRR(c, -66, -17, 132, 6, 3, '#f1f3f5', OUT, 1.6);
      // руль
      ell(c, 12 * d, -45, 2.2, 6.5, '#495057', OUT, 1.2, d * 0.35);
      // колёса и крылья
      for (const x of [-38, 38]) {
        ell(c, x, -15, 14, 9, shade(body, -0.14));
        wheel(c, x, -10, 10, fr, '#ffd43b');
      }
    },
  },
};

/** Значок транспорта для карточки магазина. */
export function rideIcon(id, size = 112) {
  const h = Math.round(size * 0.7),
    { canvas, ctx: c } = makeCanvas(size, h),
    art = WHEELS_ART[id],
    k = size / 150;
  c.translate(size / 2, h * 0.9);
  c.scale(k, k);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  art.back(c, 1, 0);
  art.front(c, 1, 0);
  return canvas;
}

/**
 * Хомячок (look) на транспорте id — кадр для кэша спрайтов (features/wheels.js): d — куда едет, fr — кадр колёс,
 * shut — глазки закрыты (1), ps — размер хомячка (PS движка локаций).
 */
export function paintRider(g, id, d, fr, look, shut, ps) {
  const art = WHEELS_ART[id];
  g.lineCap = 'round';
  art.back(g, d, fr);
  const st = art.seat(d);
  drawHamster(g, st.x, st.y, ps, look, { ...st.pose, blink: shut, time: 0 });
  art.front(g, d, fr);
  g.lineCap = 'butt';
}
