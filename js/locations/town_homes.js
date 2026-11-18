// Жильё в городе: вилла, жилой дом, бунгало на пляже и дома жителей — общий вид house с дорисовкой по характеру
// хозяина: HOUSE_ART[житель] (якорь Боба, теплица и вьюнок Мяты, телескоп Профессора…) и HOUSE_STYLE[житель]
// (цвет ставней, дымок из трубы).
import { TAU } from '../core/util.js';
import { ell, fillRR, line, poly, shade, emoji } from '../core/draw.js';
import { OUT } from '../engine/topdown/kinds.js';
import { geom, baseShadow, wall, roof, gable, win, door, steps, chimney, glow, wallLamp } from './common/buildings.js';
import { signBoard, awning, flower, fitText, WOOD, WOOD_D, WOOD_L, LIT, GOLD } from './common/paint.js';
import { title, bunting, ivy, bow, thatch, bamboo, surfboard, balcony, star5 } from './town_details.js';

// ================= ВИЛЛА =================
export function paintVilla(ctx, b, snow, lit) {
  const g = geom(b),
    { X, Y, W, H, bot, cx } = g;
  baseShadow(ctx, g, 10);
  chimney(ctx, X + 70, Y - 44, 22, 46, snow);
  chimney(ctx, X + W - 92, Y - 44, 22, 46, snow);
  // стены: два этажа
  wall(ctx, X + 6, Y + 34, W - 12, H - 34, b.wall, { eave: 16, r: 6, lw: 3 });
  // пояс между этажами
  ctx.fillStyle = '#fff8ec';
  ctx.fillRect(X + 8, Y + 126, W - 16, 7);
  line(ctx, X + 8, Y + 126, X + W - 8, Y + 126, 'rgba(74,55,40,.5)', 1.3);
  line(ctx, X + 8, Y + 133, X + W - 8, Y + 133, 'rgba(74,55,40,.5)', 1.3);
  // крыша: вальмовая, с черепицей
  roof(ctx, [X - 16, Y + 44, X + 52, Y - 40, X + W - 52, Y - 40, X + W + 16, Y + 44], b.roof, snow, { lw: 3 });
  // слуховые окна на крыше
  for (const dx of [-150, 150]) {
    gable(ctx, cx + dx - 26, cx + dx + 26, Y + 14, Y - 14, b.roof, snow, { rows: 8 });
    fillRR(ctx, cx + dx - 16, Y + 12, 32, 22, 3, '#fff8ec', OUT, 2);
    win(ctx, cx + dx - 11, Y + 15, 22, 16, lit, { sill: false });
  }
  // окна: по два с каждой стороны на каждом этаже
  const sh = '#3d9970';
  if (lit) for (const dx of [-176, -112, 112, 176]) glow(ctx, cx + dx, Y + 170, 46);
  for (const dx of [-176, -112, 112, 176]) {
    win(ctx, cx + dx - 17, Y + 62, 34, 50, lit, {
      arch: true,
      shutters: sh,
      curtain: lit ? null : 'rgba(255,255,255,.8)',
    });
    win(ctx, cx + dx - 17, Y + 148, 34, 54, lit, {
      arch: true,
      shutters: sh,
      box: true,
      snow,
      curtain: lit ? null : 'rgba(255,255,255,.8)',
    });
  }
  // портик: фронтон, колонны, балкон
  roof(ctx, [cx - 84, Y + 46, cx, Y - 16, cx + 84, Y + 46], '#fff8ec', false, { flat: true });
  ell(ctx, cx, Y + 20, 14, 14, lit ? LIT : '#cfeaff', OUT, 2);
  line(ctx, cx - 14, Y + 20, cx + 14, Y + 20, OUT, 1.3);
  line(ctx, cx, Y + 6, cx, Y + 34, OUT, 1.3);
  fillRR(ctx, cx - 88, Y + 44, 176, 10, 3, '#fff8ec', OUT, 2);
  // балконная дверь и балкон
  win(ctx, cx - 26, Y + 62, 52, 62, lit, { arch: true, curtain: lit ? null : 'rgba(255,255,255,.8)', sill: false });
  fillRR(ctx, cx - 62, Y + 120, 124, 9, 3, '#fff8ec', OUT, 2);
  for (let i = -5; i <= 5; i++) fillRR(ctx, cx + i * 11 - 2.2, Y + 100, 4.4, 21, 2, '#fff8ec', OUT, 1.2);
  fillRR(ctx, cx - 62, Y + 96, 124, 6, 3, '#fff8ec', OUT, 1.8);
  // колонны
  for (const dx of [-78, -52, 52, 78]) {
    fillRR(ctx, cx + dx - 7, Y + 54, 14, H - 62, 4, '#fff8ec', OUT, 2);
    ctx.fillStyle = 'rgba(0,0,0,.08)';
    ctx.fillRect(cx + dx + 1, Y + 58, 4, H - 70);
    fillRR(ctx, cx + dx - 10, bot - 12, 20, 8, 2, '#fff8ec', OUT, 1.8);
    fillRR(ctx, cx + dx - 10, Y + 52, 20, 7, 2, '#fff8ec', OUT, 1.8);
  }
  // крыльцо и дверь
  fillRR(ctx, cx - 70, bot - 5, 140, 9, 3, '#e3e7ec', OUT, 2);
  fillRR(ctx, cx - 58, bot - 10, 116, 7, 3, '#f1f3f5', OUT, 2);
  door(ctx, cx, bot - 8, 56, 80, '#e8590c', { arch: true, double: true, frame: '#fff8ec' });
  wallLamp(ctx, cx - 40, bot - 66, lit);
  wallLamp(ctx, cx + 40, bot - 66, lit);
  // вьюнок по углам
  ivy(ctx, X + 16, bot - 10, 150, snow ? 'winter' : 'summer', 1);
  ivy(ctx, X + W - 16, bot - 10, 120, snow ? 'winter' : 'summer', -1);
}

export function paintApartment(ctx, b, snow, lit) {
  const g = geom(b),
    { X, W, bot, cx } = g,
    top = g.Y - 84;
  baseShadow(ctx, g);
  wall(ctx, X + 6, top, W - 12, bot - top, b.wall, { eave: 0, brick: true, r: 4 });
  // водосточная труба
  line(ctx, X + W - 14, top + 8, X + W - 14, bot - 4, OUT, 5);
  line(ctx, X + W - 14, top + 8, X + W - 14, bot - 4, '#adb5bd', 2.6);
  // карниз-крыша с черепицей, бак и антенна
  fillRR(ctx, X + 34, top - 36, 30, 26, 3, '#74c0fc', OUT, 2);
  line(ctx, X + 34, top - 24, X + 64, top - 24, OUT, 1.3);
  line(ctx, X + W - 60, top - 10, X + W - 60, top - 50, OUT, 2);
  line(ctx, X + W - 70, top - 44, X + W - 50, top - 44, OUT, 2);
  line(ctx, X + W - 66, top - 36, X + W - 54, top - 36, OUT, 2);
  roof(ctx, [X - 4, top + 12, X + 6, top - 12, X + W - 6, top - 12, X + W + 4, top + 12], b.roof, snow, {
    rows: 8,
    snowKeep: 0.4,
  });
  // три этажа окон
  const cols = [-96, -34, 34, 96];
  for (let f = 0; f < 3; f++) {
    const y = top + 30 + f * 96;
    for (const dx of cols) {
      if (f === 2 && Math.abs(dx) < 40) continue; // внизу по центру — вход
      const on = lit && (f * 7 + dx) % 3 !== 0;
      if (on) glow(ctx, cx + dx, y + 24, 30, 0.3);
      win(ctx, cx + dx - 16, y, 32, 44, on, {
        r: 3,
        curtain: on ? null : ['#ffd8a8', '#d0ebff', '#ffc9de'][(f + Math.abs(dx)) % 3],
      });
      if (f < 2) balcony(ctx, cx + dx - 16, y + 34, 32, snow, (f + dx) % 4 === 0);
      else if (!snow) fillRR(ctx, cx + dx - 18, y + 46, 36, 6, 2, WOOD, OUT, 1.3);
    }
  }
  // вход: козырёк, дверь, номер дома
  steps(ctx, cx, bot, 56);
  door(ctx, cx, bot - 6, 50, 76, '#7a4a22', { double: true, glass: true, lit, frame: '#fff8ec' });
  poly(ctx, [cx - 42, bot - 86, cx - 34, bot - 100, cx + 34, bot - 100, cx + 42, bot - 86], b.roof, OUT, 2);
  wallLamp(ctx, cx - 40, bot - 60, lit);
  signBoard(ctx, title(b), cx, bot - 116, 120, 22, 'plate', shade(b.roof, -0.1));
}

export function paintBungalow(ctx, b, snow, lit) {
  const g = geom(b),
    { X, Y, W, bot, cx } = g;
  baseShadow(ctx, g);
  // сваи и настил
  for (let x = X + 16; x < X + W - 8; x += 34) fillRR(ctx, x, bot - 14, 8, 14, 2, WOOD_D, OUT, 1.6);
  surfboard(ctx, X + 20, bot - 8, '#ffd43b', -0.12);
  bamboo(ctx, X + 12, Y + 42, W - 24, bot - Y - 54, snow ? '#f4e4cf' : b.wall);
  fillRR(ctx, X + 4, bot - 18, W - 8, 9, 3, WOOD_L, OUT, 2);
  // окно со ставнями и дверь
  if (lit) glow(ctx, X + 74, Y + 84, 34);
  win(ctx, X + 54, Y + 66, 40, 34, lit, { shutters: '#4dabf7', box: true, snow });
  win(ctx, X + W - 86, Y + 66, 30, 34, lit, { shutters: '#4dabf7' });
  door(ctx, cx, bot - 16, 34, 62, '#4dabf7', { arch: true, frame: '#fff8ec' });
  // перила крыльца
  for (const sx of [-1, 1]) {
    const x0 = cx + sx * 24,
      x1 = sx < 0 ? X + 8 : X + W - 8;
    line(ctx, x0, bot - 34, x1, bot - 34, OUT, 4);
    line(ctx, x0, bot - 34, x1, bot - 34, '#fff8ec', 2);
    for (let x = Math.min(x0, x1) + 6; x < Math.max(x0, x1); x += 14) line(ctx, x, bot - 34, x, bot - 18, OUT, 2);
  }
  thatch(ctx, [X - 12, Y + 52, cx, Y - 44, X + W + 12, Y + 52], snow);
  // гирлянда из ракушек и табличка
  for (let i = 0; i < 7; i++) {
    const x = X + 34 + i * ((W - 68) / 6);
    ell(ctx, x, Y + 60 + (i % 2) * 3, 3.4, 3, i % 2 ? '#ffd8e4' : '#fff', OUT, 1);
  }
  signBoard(ctx, title(b), cx, Y + 22, 120, 24, 'wood');
  ell(ctx, cx, Y - 8, 9, 9, '#fff', OUT, 1.6);
  emoji(ctx, '🐚', cx, Y - 8, 11);
  line(ctx, X + W + 2, bot + 4, X + W + 2, bot - 24, OUT, 3);
  fillRR(ctx, X + W - 18, bot - 42, 40, 20, 3, '#fff', OUT, 1.6);
  fitText(ctx, 'ПРОДАЁТСЯ', X + W + 2, bot - 32, 34, 6.5, '#e03131');
}

// ================= ДОМА ЖИТЕЛЕЙ: дорисовка по характеру хозяина =================
/** Цвет ставней и прочее: поля добавляются к зданию house (locations/town.js). */
export const HOUSE_STYLE = {
  plusha: { shutters: '#e8590c' },
  myata: { shutters: '#2f9e44' },
  prof: { shutters: '#5b4636', attic: false },
  busya: { shutters: '#f783ac', attic: false },
  ponchik: { shutters: '#1971c2', smoke: true },
  senya: { shutters: '#495057', attic: false },
  bob: { shutters: '#0b7285', attic: false },
  zefirka: { shutters: '#b197fc' },
};

export const HOUSE_ART = {
  // Плюша: уютное крыльцо — навес на столбиках, фонарик, вязаные сердечки
  plusha(ctx, g, snow, lit) {
    const { cx, bot } = g;
    for (const dx of [-30, 30]) {
      line(ctx, cx + dx, bot - 4, cx + dx, bot - 72, OUT, 5);
      line(ctx, cx + dx, bot - 4, cx + dx, bot - 72, '#fff8ec', 2.6);
    }
    poly(ctx, [cx - 40, bot - 68, cx, bot - 96, cx + 40, bot - 68], snow ? '#fff' : '#e8590c', OUT, 2.2);
    line(ctx, cx - 40, bot - 68, cx + 40, bot - 68, OUT, 2.2);
    wallLamp(ctx, cx, bot - 58, lit);
    emoji(ctx, '🧡', g.winL + 18, g.winY - 12, 10);
    emoji(ctx, '🧡', g.winR + 18, g.winY - 12, 10);
    // коврик у двери
    fillRR(ctx, cx - 18, bot + 2, 36, 9, 3, '#ffa94d', OUT, 1.4);
  },
  // Мята: вьюнок по стенам, лейка и горшки
  myata(ctx, g, snow) {
    const sea = snow ? 'winter' : 'summer';
    ivy(ctx, g.wx + 6, g.bot - 10, 96, sea, 1);
    ivy(ctx, g.wx + g.ww - 6, g.bot - 10, 96, sea, -1);
    if (!snow) {
      for (let i = 0; i < 7; i++)
        flower(ctx, g.left + 30 + i * 22, g.eaveY + 3 + (i % 2) * 3, 3.4, ['#ff8fab', '#fff', '#ffd43b'][i % 3]);
      // лейка у двери
      fillRR(ctx, g.cx + 28, g.bot - 16, 14, 14, 3, '#74c0fc', OUT, 1.5);
      line(ctx, g.cx + 42, g.bot - 10, g.cx + 50, g.bot - 18, OUT, 2.4);
    }
    emoji(ctx, '🌿', g.cx, g.atticY, 14);
  },
  // Профессор: телескоп на крыше, часы на фронтоне, стопка книг
  prof(ctx, g, snow, lit) {
    const { cx, bot } = g;
    // круглые часы-окно
    ell(ctx, cx, g.atticY, 15, 15, '#fff8ec', OUT, 2);
    for (let i = 0; i < 12; i += 3) {
      const a = (i * TAU) / 12;
      line(
        ctx,
        cx + Math.cos(a) * 10,
        g.atticY + Math.sin(a) * 10,
        cx + Math.cos(a) * 12.5,
        g.atticY + Math.sin(a) * 12.5,
        OUT,
        1.6,
      );
    }
    line(ctx, cx, g.atticY, cx, g.atticY - 9, OUT, 2);
    line(ctx, cx, g.atticY, cx + 6, g.atticY + 3, OUT, 2);
    // телескоп на треноге на скате крыши
    const tx = g.left + 46,
      ty = g.eaveY - 44;
    line(ctx, tx, ty, tx - 9, ty + 20, OUT, 2.4);
    line(ctx, tx, ty, tx + 9, ty + 20, OUT, 2.4);
    line(ctx, tx, ty, tx, ty + 22, OUT, 2.4);
    ctx.save();
    ctx.translate(tx, ty - 2);
    ctx.rotate(-0.6);
    fillRR(ctx, -16, -5, 32, 10, 3, '#5b6676', OUT, 1.8);
    fillRR(ctx, 12, -7, 9, 14, 2, GOLD, OUT, 1.6);
    fillRR(ctx, -21, -3.5, 7, 7, 2, GOLD, OUT, 1.4);
    ctx.restore();
    // книги у двери
    for (let i = 0; i < 3; i++)
      fillRR(ctx, cx + 26 + (i % 2) * 2, bot - 8 - i * 6, 20, 6, 1.5, ['#fa5252', '#4dabf7', '#51a36a'][i], OUT, 1.2);
    if (lit) glow(ctx, tx, ty, 16, 0.3);
  },
  // Буся: сердечко на фронтоне, бант, полосатый козырёк
  busya(ctx, g, snow) {
    const { cx, bot } = g;
    emoji(ctx, '💗', cx, g.atticY + 2, 24);
    bow(ctx, cx, g.peakY + 30, 0.75, '#ff8fab');
    awning(ctx, cx - 28, bot - 74, 56, 14, 6, snow ? '#fff' : '#f783ac');
    for (const dx of [-28, 28]) emoji(ctx, '🌹', cx + dx, bot - 12, 12);
  },
  // Пончик: пирог на подоконнике, пончик на фронтоне
  ponchik(ctx, g) {
    const { cx } = g;
    emoji(ctx, '🍩', cx, g.atticY, 22);
    // пирог остывает на окне
    const px = g.winR + 18,
      py = g.winY + 36;
    ell(ctx, px, py - 2, 14, 5, '#e8a85c', OUT, 1.4);
    ell(ctx, px, py - 5, 10, 3.2, '#f6c98a', OUT, 1);
    ctx.strokeStyle = 'rgba(255,255,255,.8)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (const dx of [-5, 3]) {
      ctx.moveTo(px + dx, py - 10);
      ctx.bezierCurveTo(px + dx - 4, py - 14, px + dx + 4, py - 18, px + dx, py - 22);
    }
    ctx.stroke();
  },
  // Сеня: звезда чемпиона, спортивные полосы, медаль над дверью
  senya(ctx, g) {
    const { cx, bot } = g;
    star5(ctx, cx, g.atticY, 15, GOLD);
    ctx.fillStyle = '#fa5252';
    ctx.fillRect(g.wx + 2, g.wallTop + 16, g.ww - 4, 4);
    ctx.fillStyle = '#4dabf7';
    ctx.fillRect(g.wx + 2, g.wallTop + 21, g.ww - 4, 3);
    emoji(ctx, '🏅', cx + 30, bot - 50, 14);
    emoji(ctx, '🏊', cx - 30, bot - 50, 14);
  },
  // Капитан Боб: иллюминатор со штурвалом, якорь, спасательный круг, канат
  bob(ctx, g) {
    const { cx, bot } = g;
    ell(ctx, cx, g.atticY, 16, 16, GOLD, OUT, 2);
    ell(ctx, cx, g.atticY, 11, 11, '#cfeaff', OUT, 1.6);
    for (let i = 0; i < 8; i++) {
      const a = (i * TAU) / 8;
      line(
        ctx,
        cx + Math.cos(a) * 11,
        g.atticY + Math.sin(a) * 11,
        cx + Math.cos(a) * 19,
        g.atticY + Math.sin(a) * 19,
        OUT,
        3,
      );
      line(
        ctx,
        cx + Math.cos(a) * 11,
        g.atticY + Math.sin(a) * 11,
        cx + Math.cos(a) * 19,
        g.atticY + Math.sin(a) * 19,
        WOOD_L,
        1.4,
      );
    }
    // спасательный круг справа от двери
    const lx = cx + 34,
      ly = bot - 44;
    ell(ctx, lx, ly, 11, 11, '#fff', OUT, 1.8);
    ell(ctx, lx, ly, 4.5, 4.5, '#c5f6fa', OUT, 1.4);
    ctx.fillStyle = '#fa5252';
    for (const a of [0, 1.57, 3.14, 4.71]) {
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(a);
      ctx.fillRect(-2.6, -10.4, 5.2, 5.4);
      ctx.restore();
    }
    emoji(ctx, '⚓', cx - 34, bot - 44, 20);
    // канат по карнизу
    ctx.strokeStyle = '#d9b382';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(g.wx + 4, g.wallTop + 18);
    ctx.quadraticCurveTo(cx, g.wallTop + 28, g.wx + g.ww - 4, g.wallTop + 18);
    ctx.stroke();
    ctx.setLineDash([]);
  },
  // Зефирка: флажки, вертушка на крыше, наклейки-звёздочки
  zefirka(ctx, g) {
    const { cx, bot } = g;
    bunting(ctx, g.wx + 4, g.wx + g.ww - 4, g.wallTop + 14, 4);
    // вертушка
    const px = cx,
      py = g.peakY - 12;
    line(ctx, px, g.peakY + 4, px, py, OUT, 2.4);
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate((i * TAU) / 4 + 0.4);
      poly(ctx, [0, 0, 12, -4, 8, 6], ['#ff8fab', '#ffd43b', '#74c0fc', '#b197fc'][i], OUT, 1.2);
      ctx.restore();
    }
    ell(ctx, px, py, 2.2, 2.2, '#fff', OUT, 1);
    for (const [dx, dy] of [
      [-38, -40],
      [38, -46],
      [30, -22],
    ])
      emoji(ctx, '⭐', cx + dx, bot + dy, 9);
  },
};
