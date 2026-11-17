// Рисование хомячка и всей одежды. Начало координат — между лапками (на полу).
// При масштабе 1 хомячок ростом около 85 px.
import { TAU } from '../core/util.js';
import { ell, rr, fillRR, line, poly, star, shade } from '../core/draw.js';

const OUT = '#4a3728'; // цвет контура
const BACK_ACC = ['wings', 'backpack', 'cape', 'pickaxe']; // аксессуары, которые рисуются за спиной
const FACE_ACC = ['glasses', 'sunglasses']; // аксессуары на мордочке: поворачиваются вместе с ней
// Аксессуары на груди: рисуются поверх одежды, но ДО головы — висят из-под подбородка (его низ: y = -29),
// а не лежат на мордочке. Шарф — исключение: он обмотан вокруг шеи и рисуется поверх подбородка.
const CHEST_ACC = ['necklace', 'bag', 'bowtie', 'tie', 'lei', 'camera', 'medal', 'waterpistol'];

/**
 * Насколько закрыты глаза в момент времени t: 0 — открыты, 1 — закрыты.
 * Моргание длится около 0.2 с и плавно закрывает и открывает глаз. phase — свой сдвиг у каждого
 * персонажа (чтобы не моргали хором); от положения на карте моргание не зависит.
 */
export function blinkAt(t, phase = 0) {
  const c = (t + phase * 1.37) % 3.7;
  return c > 3.5 ? Math.sin(((c - 3.5) / 0.2) * Math.PI) : 0;
}

function bodyPath(ctx, g = 0) {
  ctx.beginPath();
  ctx.ellipse(0, -24, 23 + g, 22 + g, 0, 0, TAU);
}
function headPath(ctx, g = 0) {
  ctx.beginPath();
  ctx.ellipse(0, -52, 27 + g, 23 + g, 0, 0, TAU);
}

function pattern(ctx, item, x, y, w, h) {
  const c2 = item.c2 || shade(item.c, 0.55);
  ctx.fillStyle = c2;
  if (item.pattern === 'stripes') {
    for (let yy = y + 4; yy < y + h; yy += 9) ctx.fillRect(x, yy, w, 4);
  } else if (item.pattern === 'dots') {
    let row = 0;
    for (let yy = y + 5; yy < y + h; yy += 9, row++) {
      for (let xx = x + (row % 2 ? 8 : 3); xx < x + w; xx += 11) {
        ctx.beginPath();
        ctx.arc(xx, yy, 2.2, 0, TAU);
        ctx.fill();
      }
    }
  } else if (item.pattern === 'stars') {
    let row = 0;
    for (let yy = y + 7; yy < y + h; yy += 13, row++) {
      for (let xx = x + (row % 2 ? 11 : 4); xx < x + w; xx += 15) star(ctx, xx, yy, 3.6, c2);
    }
  } else if (item.pattern === 'flowers') {
    let row = 0;
    for (let yy = y + 7; yy < y + h; yy += 13, row++) {
      for (let xx = x + (row % 2 ? 11 : 4); xx < x + w; xx += 15) {
        for (let k = 0; k < 5; k++) {
          ctx.beginPath();
          ctx.arc(xx + Math.cos(k * 1.257) * 3, yy + Math.sin(k * 1.257) * 3, 2, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = '#ffd43b';
        ctx.beginPath();
        ctx.arc(xx, yy, 1.5, 0, TAU);
        ctx.fill();
        ctx.fillStyle = c2;
      }
    }
  } else if (item.pattern === 'clouds') {
    // облачка-завитки (красный праздничный наряд): золотые дуги вразбежку
    ctx.strokeStyle = c2;
    ctx.lineWidth = 1.3;
    ctx.globalAlpha = 0.8;
    let row = 0;
    for (let yy = y + 9; yy < y + h; yy += 14, row++) {
      for (let xx = x + (row % 2 ? 12 : 4); xx < x + w; xx += 17) {
        ctx.beginPath();
        ctx.arc(xx - 3, yy, 3, Math.PI, TAU);
        ctx.arc(xx + 3, yy, 3, Math.PI, TAU);
        ctx.moveTo(xx + 6, yy);
        ctx.arc(xx + 4.5, yy + 0.5, 1.5, 0, Math.PI * 1.2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  } else if (item.pattern === 'check') {
    ctx.globalAlpha = 0.6;
    for (let xx = x + 3; xx < x + w; xx += 10) ctx.fillRect(xx, y, 3, h);
    for (let yy = y + 3; yy < y + h; yy += 10) ctx.fillRect(x, yy, w, 3);
    ctx.globalAlpha = 1;
  }
}

/** Светлый ли цвет '#rrggbb' (для оттенка деталей). */
function isLight(c) {
  const n = parseInt(c.slice(1, 7), 16);
  return ((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11 > 150;
}

// ---------- одежда на тело ----------
function sleevesOf(item) {
  if (!item) return null;
  switch (item.kind) {
    case 'tee':
    case 'overall':
      return 'short';
    case 'hoodie':
    case 'tuxedo':
      return 'long';
    case 'sweater':
    case 'jacketW':
    case 'jacketA':
    case 'jacketS':
    case 'pajama':
    case 'robe':
      return 'long';
    case 'dress':
      return item.sleeves || null;
    default:
      return null;
  }
}

function drawLegs(ctx, item) {
  if (!item) return;
  ctx.save();
  if (item.kind === 'tutu') {
    for (let layer = 0; layer < 2; layer++)
      for (let i = -3; i <= 3; i++) {
        ell(ctx, i * 8.5, -12 + Math.abs(i) * 1.2 + layer * 5, 9, 7, layer ? item.c : shade(item.c, 0.45), OUT, 1.2);
      }
    ctx.fillStyle = shade(item.c, -0.2);
    ctx.fillRect(-19, -22, 38, 4);
  } else if (item.kind === 'mermaid') {
    // хвост русалочки (Жемчужинка, секретный пляж): чешуйчатая «юбка» от пояса, хвост загибается вбок, плавник
    ctx.beginPath();
    ctx.moveTo(-24, -22);
    ctx.lineTo(24, -22);
    ctx.quadraticCurveTo(30, -4, 18, 2);
    ctx.quadraticCurveTo(30, 6, 34, 0);
    ctx.lineTo(44, -8);
    ctx.quadraticCurveTo(41, 2, 47, 8);
    ctx.quadraticCurveTo(34, 9, 28, 6);
    ctx.quadraticCurveTo(8, 8, -14, 4);
    ctx.quadraticCurveTo(-30, -6, -24, -22);
    ctx.closePath();
    ctx.fillStyle = item.c;
    ctx.fill();
    ctx.save();
    ctx.clip();
    // чешуйки — дужками в шахматном порядке
    ctx.strokeStyle = item.c2 || shade(item.c, 0.4);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let r = 0; r < 4; r++)
      for (let i = -4; i <= 4; i++) {
        const x = i * 7 + (r % 2) * 3.5,
          y = -18 + r * 6;
        ctx.moveTo(x - 3.5, y);
        ctx.arc(x, y, 3.5, Math.PI, 0, true);
      }
    ctx.stroke();
    ell(ctx, -10, -16, 6, 3, 'rgba(255,255,255,.35)');
    ctx.restore();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2;
    ctx.stroke();
    // прожилки плавника
    line(ctx, 34, 2, 44, -4, shade(item.c, -0.25), 1.2);
    line(ctx, 34, 4, 44, 6, shade(item.c, -0.25), 1.2);
  } else if (item.kind === 'grass') {
    // юбочка из травы (удалённый остров): пояс-жгут и бахрома из травинок двух тонов, чуть веером
    const c2 = item.c2 || shade(item.c, -0.25);
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass ? item.c : c2;
      ctx.lineWidth = pass ? 3 : 4.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = -6; i <= 6; i++) {
        if (pass && i % 2) continue;
        const x0 = i * 3.4,
          x1 = i * 4.4;
        ctx.moveTo(x0, -20);
        ctx.quadraticCurveTo(x0 + i * 0.3, -10, x1, -1 + (Math.abs(i) % 3));
      }
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(74,55,40,.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = -6; i <= 6; i += 3) {
      ctx.moveTo(i * 3.4, -19);
      ctx.quadraticCurveTo(i * 3.7, -10, i * 4.4, -2);
    }
    ctx.stroke();
    fillRR(ctx, -22, -24, 44, 6, 3, shade(item.c, -0.35), OUT, 1.4);
    for (let i = -2; i <= 2; i++) ell(ctx, i * 8, -21, 2.2, 2.2, ['#ff6b6b', '#ffd43b', '#fff', '#ffd43b', '#ff6b6b'][i + 2]);
  } else if (item.kind === 'skirt') {
    const skirtPath = () => {
      ctx.beginPath();
      ctx.moveTo(-20, -22);
      ctx.lineTo(20, -22);
      ctx.quadraticCurveTo(30, -10, 30, -4);
      ctx.quadraticCurveTo(0, 2, -30, -4);
      ctx.quadraticCurveTo(-30, -10, -20, -22);
      ctx.closePath();
    };
    skirtPath();
    ctx.fillStyle = item.c;
    ctx.fill();
    ctx.save();
    ctx.clip();
    pattern(ctx, item, -32, -22, 64, 26);
    ctx.restore();
    skirtPath(); // узор меняет текущий путь — контур юбки строим заново
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    bodyPath(ctx, 1.2);
    ctx.clip();
    const top = item.kind === 'pants' ? -20 : -17;
    ctx.fillStyle = item.c;
    ctx.fillRect(-30, top, 60, 30);
    pattern(ctx, item, -30, top, 60, 30);
    ctx.fillStyle = shade(item.c, -0.25);
    ctx.fillRect(-30, top, 60, 2.5);
    ctx.fillRect(-1, top + 8, 2, 20);
    bodyPath(ctx, 0);
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}

function drawBody(ctx, item) {
  if (!item) return;
  const c = item.c,
    dark = shade(c, -0.25);
  ctx.save();
  switch (item.kind) {
    case 'tee': {
      bodyPath(ctx, 1.5);
      ctx.clip();
      ctx.fillStyle = c;
      ctx.fillRect(-30, -50, 60, 33);
      pattern(ctx, item, -30, -50, 60, 33);
      ctx.fillStyle = dark;
      ctx.fillRect(-30, -19, 60, 2.5);
      if (item.print) {
        ctx.restore();
        ctx.save();
        printOn(ctx, item.print, 0, -30);
      }
      break;
    }
    case 'swim': {
      bodyPath(ctx, 1);
      ctx.clip();
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(-16, -50);
      ctx.lineTo(-9, -50);
      ctx.quadraticCurveTo(0, -34, 9, -50);
      ctx.lineTo(16, -50);
      ctx.lineTo(26, -30);
      ctx.lineTo(26, -8);
      ctx.quadraticCurveTo(12, -8, 6, 2);
      ctx.lineTo(-6, 2);
      ctx.quadraticCurveTo(-12, -8, -26, -8);
      ctx.lineTo(-26, -30);
      ctx.closePath();
      ctx.fill();
      ctx.save();
      ctx.clip();
      pattern(ctx, item, -30, -50, 60, 54);
      ctx.restore();
      break;
    }
    case 'dress':
    case 'princess': {
      const long = item.kind === 'princess';
      const dressPath = () => {
        ctx.beginPath();
        ctx.moveTo(-17, -42);
        ctx.quadraticCurveTo(0, -36, 17, -42);
        ctx.quadraticCurveTo(25, -30, long ? 36 : 31, -3);
        ctx.quadraticCurveTo(0, long ? 7 : 4, long ? -36 : -31, -3);
        ctx.quadraticCurveTo(-25, -30, -17, -42);
        ctx.closePath();
      };
      dressPath();
      ctx.fillStyle = c;
      ctx.fill();
      ctx.save();
      ctx.clip();
      pattern(ctx, item, -38, -44, 76, 50);
      ctx.fillStyle = item.c2 || dark;
      ctx.fillRect(-38, -24, 76, 3.5);
      if (long) {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#fff';
        for (let i = -30; i < 34; i += 12) ctx.fillRect(i, -20, 5, 26);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      dressPath(); // узор рисует свои кружки и звёзды — путь платья для контура строим заново
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 2;
      ctx.stroke();
      if (long) {
        star(ctx, 0, -31, 4, '#ffe066', OUT, 1);
      }
      if (item.trim === 'qipao') {
        // платье-ципао: воротник-стойка, косая застёжка с золотыми пуговками-узелками
        const g = item.c2 || '#ffd43b';
        fillRR(ctx, -8, -45, 16, 6, 3, c, OUT, 1.4);
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-7, -42);
        ctx.lineTo(7, -42);
        ctx.moveTo(0, -39);
        ctx.quadraticCurveTo(10, -36, 12, -28);
        ctx.stroke();
        for (const [bx, by] of [
          [5, -37],
          [10, -32],
          [12, -26],
        ]) {
          ctx.beginPath();
          ctx.arc(bx, by, 1.6, 0, TAU);
          ctx.fillStyle = g;
          ctx.fill();
          ctx.strokeStyle = OUT;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
      break;
    }
    case 'sweater':
    case 'pajama': {
      bodyPath(ctx, 2);
      ctx.clip();
      ctx.fillStyle = c;
      ctx.fillRect(-30, -50, 60, item.kind === 'pajama' ? 56 : 42);
      pattern(ctx, item, -30, -50, 60, item.kind === 'pajama' ? 56 : 42);
      if (item.kind === 'sweater') {
        ctx.fillStyle = dark;
        ctx.fillRect(-30, -12, 60, 4);
      } else {
        ctx.fillStyle = '#fff';
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(0, -36 + i * 9, 1.8, 0, TAU);
          ctx.fill();
        }
      }
      ctx.restore();
      ctx.save();
      bodyPath(ctx, 2);
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 2;
      ctx.stroke();
      break;
    }
    case 'robe': {
      bodyPath(ctx, 3);
      ctx.fillStyle = c;
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = shade(c, 0.5);
      poly(ctx, [-4, -50, 4, -50, 3, 0, -9, 0], shade(c, 0.5));
      ctx.fillStyle = dark;
      ctx.fillRect(-30, -24, 60, 4);
      ctx.restore();
      bodyPath(ctx, 3);
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 2;
      ctx.stroke();
      break;
    }
    case 'jacketW':
    case 'jacketA':
    case 'jacketS': {
      const g = item.kind === 'jacketW' ? 4 : 2.5;
      bodyPath(ctx, g);
      ctx.fillStyle = c;
      ctx.fill();
      ctx.save();
      ctx.clip();
      if (item.kind === 'jacketW') {
        ctx.strokeStyle = dark;
        ctx.lineWidth = 1.6;
        for (let yy = -38; yy < 0; yy += 9) {
          ctx.beginPath();
          ctx.moveTo(-30, yy);
          ctx.quadraticCurveTo(0, yy + 4, 30, yy);
          ctx.stroke();
        }
      } else if (item.kind === 'jacketA') {
        ctx.fillStyle = dark;
        ctx.fillRect(-19, -14, 11, 2.5);
        ctx.fillRect(8, -14, 11, 2.5);
      } else {
        ctx.fillStyle = item.c2 || '#fff'; // полоска поперёк груди — ниже воротника
        ctx.fillRect(-30, -16, 60, 5);
      }
      ctx.fillStyle = dark;
      ctx.fillRect(-1, -50, 2, 52);
      if (item.kind === 'jacketA') {
        ctx.fillStyle = item.c2 || '#fff';
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(4, -16 + i * 6.5, 2, 0, TAU);
          ctx.fill();
        }
      }
      ctx.restore();
      bodyPath(ctx, g);
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 2;
      ctx.stroke();
      break;
    }
    case 'overall': {
      bodyPath(ctx, 1.5);
      ctx.clip();
      ctx.fillStyle = item.c2 || '#fff';
      ctx.fillRect(-30, -50, 60, 30); // футболка под комбинезоном
      ctx.fillStyle = c;
      ctx.fillRect(-30, -22, 60, 30);
      ctx.fillRect(-12, -40, 24, 20); // штаны и нагрудник
      ctx.fillRect(-15, -50, 5, 14);
      ctx.fillRect(10, -50, 5, 14); // лямки
      ctx.fillStyle = dark;
      ctx.fillRect(-30, -22, 60, 2.5);
      ctx.fillRect(-1, -12, 2, 16);
      ctx.fillStyle = '#ffd43b';
      for (const bx of [-9, 9]) {
        ctx.beginPath();
        ctx.arc(bx, -37, 2.2, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
      ctx.save();
      bodyPath(ctx, 1.5);
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 2;
      ctx.stroke();
      break;
    }
    case 'hoodie': {
      bodyPath(ctx, 2.5);
      ctx.fillStyle = c;
      ctx.fill();
      ctx.save();
      ctx.clip();
      pattern(ctx, item, -30, -50, 60, 44);
      ctx.fillStyle = dark;
      ctx.fillRect(-30, -7, 60, 5);
      fillRR(ctx, -13, -20, 26, 12, 5, dark);
      ctx.restore();
      bodyPath(ctx, 2.5);
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 2;
      ctx.stroke();
      line(ctx, -5, -40, -6, -27, '#fff', 1.8);
      line(ctx, 5, -40, 6, -27, '#fff', 1.8);
      break;
    }
    case 'tuxedo': {
      // Подбородок закрывает тело до y ≈ -30, поэтому манишка, лацканы и бабочка — ниже, на груди.
      bodyPath(ctx, 2);
      ctx.fillStyle = c;
      ctx.fill();
      ctx.save();
      ctx.clip();
      poly(ctx, [-12, -40, 12, -40, 0, -8], '#fff'); // манишка: вырез «уголком» из-под подбородка
      const lapel = shade(c, isLight(c) ? -0.12 : 0.25); // атласные лацканы: у светлого — темнее, у тёмного — светлее
      for (const sx of [-1, 1]) poly(ctx, [sx * 12, -40, sx * 19, -30, sx * 3, -10, 0, -8], lapel, OUT, 1.3); // лацканы
      ctx.fillStyle = OUT;
      for (const yy of [-17, -12]) {
        ctx.beginPath();
        ctx.arc(0, yy, 1.3, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
      bodyPath(ctx, 2);
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 2;
      ctx.stroke();
      const bow = item.c2 || '#e03131'; // бабочка — сразу под подбородком
      poly(ctx, [0, -24, -9, -29, -9, -19], bow, OUT, 1.3);
      poly(ctx, [0, -24, 9, -29, 9, -19], bow, OUT, 1.3);
      ell(ctx, 0, -24, 2.6, 2.6, shade(bow, -0.2), OUT, 1.1);
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

function printOn(ctx, kind, x, y) {
  if (kind === 'heart') {
    ctx.fillStyle = '#ff5c8a';
    ctx.beginPath();
    ctx.moveTo(x, y + 6);
    ctx.bezierCurveTo(x - 10, y - 1, x - 4, y - 8, x, y - 3);
    ctx.bezierCurveTo(x + 4, y - 8, x + 10, y - 1, x, y + 6);
    ctx.fill();
  } else if (kind === 'star') star(ctx, x, y, 6, '#ffe066');
  else if (kind === 'sun') {
    ell(ctx, x, y, 5, 5, '#ffd43b');
    for (let i = 0; i < 8; i++)
      line(
        ctx,
        x + Math.cos(i * 0.785) * 7,
        y + Math.sin(i * 0.785) * 7,
        x + Math.cos(i * 0.785) * 9,
        y + Math.sin(i * 0.785) * 9,
        '#ffd43b',
        1.6,
      );
  }
}

function collar(ctx, item) {
  if (!item) return;
  // Воротники лежат под подбородком (низ головы: y ≈ -29 посередине, -36 у плеч) — иначе голова их закрывает.
  if (item.kind === 'jacketW') {
    // меховой воротник пуховика — пушистые комочки вдоль подбородка
    for (let i = -3; i <= 3; i++) {
      const x = i * 6.5;
      ell(ctx, x, -52 + 23 * Math.sqrt(1 - (x / 27) ** 2) + 2.5, 5.5, 4.5, item.c2 || '#fff7e6', OUT, 1.1);
    }
  } else if (item.kind === 'jacketA' || item.kind === 'jacketS') {
    // отложной воротник: два уголка из-под подбородка по сторонам от застёжки
    const col = shade(item.c, -0.15);
    poly(ctx, [-17, -35, -2, -30, -4, -20, -12, -24], col, OUT, 1.5);
    poly(ctx, [17, -35, 2, -30, 4, -20, 12, -24], col, OUT, 1.5);
  } else if (item.kind === 'hoodie') {
    ell(ctx, 0, -45, 25, 13, shade(item.c, -0.14), OUT, 2); // капюшон за головой
  } else if (item.kind === 'sweater') {
    ctx.beginPath();
    ctx.ellipse(0, -41, 13, 4.5, 0, 0, Math.PI);
    ctx.strokeStyle = shade(item.c, -0.25);
    ctx.lineWidth = 4;
    ctx.stroke();
  } else if (item.kind === 'swim') {
    line(ctx, -13, -45, -15, -40, shade(item.c, -0.2), 2.5);
    line(ctx, 13, -45, 15, -40, shade(item.c, -0.2), 2.5);
  }
}

// ---------- обувь ----------
function drawShoe(ctx, item, x, y) {
  const c = item.c,
    dark = shade(c, -0.3);
  switch (item.kind) {
    case 'sneakers':
      fillRR(ctx, x - 9, y - 9, 18, 10, 5, c, OUT, 1.6);
      ctx.fillStyle = '#fff';
      ctx.fillRect(x - 8, y - 2.5, 16, 2.5);
      line(ctx, x - 3, y - 7, x + 3, y - 7, '#fff', 1.4);
      break;
    case 'boots':
      fillRR(ctx, x - 8, y - 15, 16, 16, 5, c, OUT, 1.6);
      ctx.fillStyle = dark;
      ctx.fillRect(x - 8, y - 3, 16, 3);
      line(ctx, x - 3, y - 11, x + 3, y - 11, dark, 1.4);
      line(ctx, x - 3, y - 8, x + 3, y - 8, dark, 1.4);
      break;
    case 'wboots':
      fillRR(ctx, x - 9, y - 14, 18, 15, 6, c, OUT, 1.6);
      fillRR(ctx, x - 10, y - 17, 20, 6, 3, item.c2 || '#fff7e6', OUT, 1.4);
      break;
    case 'rainboots':
      fillRR(ctx, x - 8, y - 16, 16, 17, 5, c, OUT, 1.6);
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      ctx.fillRect(x - 5, y - 13, 2.5, 8);
      ctx.fillStyle = dark;
      ctx.fillRect(x - 8, y - 2.5, 16, 2.5);
      break;
    case 'sandals':
      line(ctx, x - 7, y - 5, x + 7, y - 5, c, 3);
      line(ctx, x - 6, y - 1, x + 6, y - 1, dark, 2.5);
      ell(ctx, x, y - 5, 2, 2, item.c2 || '#fff');
      break;
    case 'flippers':
      poly(ctx, [x - 5, y - 8, x + 5, y - 8, x + 12, y + 3, x - 12, y + 3], c, OUT, 1.6);
      line(ctx, x - 3, y - 4, x - 6, y + 2, dark, 1.3);
      line(ctx, x + 3, y - 4, x + 6, y + 2, dark, 1.3);
      break;
    case 'heels':
      fillRR(ctx, x - 8, y - 7, 17, 7, 3.5, c, OUT, 1.5);
      fillRR(ctx, x - 9, y - 3, 4, 5, 1, dark, OUT, 1);
      ell(ctx, x + 4, y - 7, 2.2, 2.2, item.c2 || '#fff', OUT, 0.8);
      break;
    case 'rollers':
      fillRR(ctx, x - 8, y - 17, 16, 13, 5, c, OUT, 1.6);
      line(ctx, x - 3, y - 12, x + 3, y - 12, '#fff', 1.4);
      ell(ctx, x - 5, y - 2, 3.6, 3.6, item.c2 || '#ffd43b', OUT, 1.2);
      ell(ctx, x + 5, y - 2, 3.6, 3.6, item.c2 || '#ffd43b', OUT, 1.2);
      break;
    case 'flipflops': {
      // шлёпанцы-вьетнамки: яркая подошва под лапкой (чуть ниже пола — её видно из-под туловища) и перемычка
      // «уголком»: от «гвоздика» между пальцами (ближе к носку) к бокам стопы
      const strap = item.c2 || '#fff',
        px = x + 2.5,
        py = y - 1;
      fillRR(ctx, x - 10.5, y - 1.5, 22, 5, 2.4, c, OUT, 1.4);
      line(ctx, x - 8, y - 0.4, x + 8.5, y - 0.4, shade(c, 0.45), 1.2); // светлый край подошвы
      for (const [col, w] of [
        [OUT, 3.8],
        [strap, 2.2],
      ]) {
        line(ctx, x - 7.5, y - 5, px, py, col, w);
        line(ctx, px, py, x + 9, y - 4.5, col, w);
      }
      ell(ctx, px, py, 2.1, 2.1, strap, OUT, 1);
      break;
    }
    case 'slippers':
      fillRR(ctx, x - 9, y - 8, 18, 9, 5, c, OUT, 1.6);
      ell(ctx, x, y - 8, 4, 3.5, item.c2 || '#fff', OUT, 1.2);
      break;
    default:
      break;
  }
}

/**
 * Лапки-ноги с обувью: feet — [[x, подъём], …], k — куда повёрнут (носки — в сторону шага).
 * Обувь нарисована носком вправо: при шаге влево разворачивается только она, а не вся лапка.
 */
function drawFeet(ctx, shoe, nails, k, feet) {
  for (const [px0, lift] of feet) {
    const px = px0 + k * 2;
    ell(ctx, px, -3 - lift, 8, 5, '#ffc2cf', OUT, 1.6);
    if (nails) {
      for (let i = -1; i <= 1; i++) ell(ctx, px + i * 4, -1 - lift, 1.3, 1.3, nails);
    }
    if (!shoe) continue;
    if (k < 0) {
      ctx.save();
      ctx.translate(px, 0);
      ctx.scale(-1, 1);
      drawShoe(ctx, shoe, 0, -lift);
      ctx.restore();
    } else drawShoe(ctx, shoe, px, -lift);
  }
}

/** Пара обуви на лапках крупно — для значка вещи: (x, y) — пол между лапками, s — масштаб. */
export function drawShoePair(ctx, x, y, s, item) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  ctx.fillStyle = 'rgba(0,0,0,.12)';
  ctx.beginPath();
  ctx.ellipse(0, 1.5, 26, 4.5, 0, 0, TAU);
  ctx.fill();
  drawFeet(ctx, item, null, 0, [
    [-11, 0],
    [11, 0],
  ]);
  ctx.restore();
}

// ---------- головные уборы ----------
function drawHat(ctx, item, side = 1) {
  const c = item.c,
    c2 = item.c2 || shade(c, -0.25);
  ctx.save();
  switch (item.kind) {
    case 'cap':
      ctx.beginPath();
      ctx.ellipse(16 * side, -68, 19, 5, 0.08 * side, 0, TAU); // козырёк — в сторону взгляда
      ctx.fillStyle = c2;
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, -68, 23, 19, 0, Math.PI, 0);
      ctx.closePath();
      ctx.fillStyle = c;
      ctx.fill();
      ctx.stroke();
      ell(ctx, 0, -87, 2.5, 2, c2);
      if (item.print) printOn(ctx, item.print, 0, -77);
      break;
    case 'panama':
      poly(ctx, [-21, -72, 21, -72, 30, -62, -30, -62], c2, OUT, 1.8);
      ctx.beginPath();
      ctx.ellipse(0, -71, 20, 17, 0, Math.PI, 0);
      ctx.closePath();
      ctx.fillStyle = c;
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.save();
      ctx.clip();
      pattern(ctx, item, -22, -90, 44, 20);
      ctx.restore();
      break;
    case 'sunhat':
      ell(ctx, 0, -67, 40, 9, c, OUT, 1.8);
      ctx.beginPath();
      ctx.ellipse(0, -69, 20, 17, 0, Math.PI, 0);
      ctx.closePath();
      ctx.fillStyle = c;
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.fillStyle = c2;
      ctx.fillRect(-19.5, -75, 39, 5);
      ell(ctx, 13, -73, 4, 4, '#fff', OUT, 1);
      ell(ctx, 13, -73, 1.6, 1.6, '#ffd43b');
      break;
    case 'beanie':
      ctx.beginPath();
      ctx.ellipse(0, -64, 26, 26, 0, Math.PI, 0);
      ctx.closePath();
      ctx.fillStyle = c;
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.save();
      ctx.clip();
      pattern(ctx, item, -28, -92, 56, 22);
      ctx.restore();
      fillRR(ctx, -27, -70, 54, 9, 4, c2, OUT, 1.8);
      ell(ctx, 0, -92, 7, 7, item.c2 ? '#fff' : shade(c, 0.6), OUT, 1.6);
      break;
    case 'helmet': {
      // каска шахтёра (пещеры): купол с ребром, козырёк по кругу, спереди — фонарик со стёклышком
      ell(ctx, 0, -66, 31, 7, c2, OUT, 1.8);
      ctx.beginPath();
      ctx.ellipse(0, -67, 25, 24, 0, Math.PI, 0);
      ctx.closePath();
      ctx.fillStyle = c;
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      line(ctx, 0, -91, 0, -70, c2, 3);
      ell(ctx, -11, -82, 6, 3.5, 'rgba(255,255,255,.55)', null, 1, -0.5);
      fillRR(ctx, -8, -80, 16, 11, 3, '#495057', OUT, 1.4);
      ell(ctx, 0, -74.5, 6.5, 6.5, '#fff3bf', OUT, 1.5);
      ell(ctx, 0, -74.5, 4, 4, '#ffe066');
      ell(ctx, -1.8, -76.5, 1.6, 1.6, '#ffffff');
      break;
    }
    case 'turban': {
      // платок-тюрбан кочевника (пустыня): намотан на голову складками, конец свисает сбоку, спереди — застёжка
      const tail = -side;
      ctx.beginPath();
      ctx.moveTo(tail * 18, -72);
      ctx.quadraticCurveTo(tail * 32, -58, tail * 27, -36);
      ctx.lineTo(tail * 19, -38);
      ctx.quadraticCurveTo(tail * 22, -56, tail * 10, -68);
      ctx.closePath();
      ctx.fillStyle = shade(c, -0.12);
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, -66, 27, 25, 0, Math.PI, 0);
      ctx.closePath();
      ctx.fillStyle = c;
      ctx.fill();
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = shade(c, -0.18);
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (const [y0, y1] of [
        [-72, -84],
        [-66, -78],
        [-78, -88],
      ]) {
        ctx.moveTo(-28, y0);
        ctx.quadraticCurveTo(0, y1 - 4, 28, y0 - 8);
      }
      ctx.stroke();
      ctx.restore();
      fillRR(ctx, -27, -70, 54, 8, 4, shade(c, -0.08), OUT, 1.6);
      ell(ctx, 0, -76, 5, 5.5, c2, OUT, 1.4);
      ell(ctx, -1.4, -77.6, 1.6, 1.6, 'rgba(255,255,255,.8)');
      break;
    }
    case 'earmuffs':
      ctx.beginPath();
      ctx.ellipse(0, -62, 27, 22, 0, Math.PI * 1.08, -0.08 * Math.PI);
      ctx.strokeStyle = c2;
      ctx.lineWidth = 4;
      ctx.stroke();
      ell(ctx, -26, -58, 8, 9, c, OUT, 1.6);
      ell(ctx, 26, -58, 8, 9, c, OUT, 1.6);
      break;
    case 'crown':
      poly(ctx, [-17, -72, -19, -90, -9, -81, 0, -93, 9, -81, 19, -90, 17, -72], c, OUT, 1.8);
      ell(ctx, 0, -77, 3, 3, '#ff5c8a');
      ell(ctx, -10, -76, 2, 2, '#4dabf7');
      ell(ctx, 10, -76, 2, 2, '#69db7c');
      break;
    case 'wreath': {
      if (item.ribbons) {
        // майский венок (1 Мая): разноцветные ленты свисают за ушками по бокам
        const rib = ['#ff6b6b', '#4dabf7', '#ffd43b', '#69db7c'];
        for (const sx of [-1, 1])
          for (let i = 0; i < 2; i++) {
            const x0 = sx * (20 + i * 4);
            ctx.beginPath();
            ctx.moveTo(x0, -64);
            ctx.quadraticCurveTo(x0 + sx * 10, -48, x0 + sx * (6 + i * 3), -30 + i * 4);
            ctx.strokeStyle = OUT;
            ctx.lineWidth = 4.6;
            ctx.stroke();
            ctx.strokeStyle = rib[(i + (sx > 0 ? 2 : 0)) % rib.length];
            ctx.lineWidth = 3;
            ctx.stroke();
          }
      }
      const cols = ['#ff8fab', '#ffd43b', '#fff', '#c77dff', '#ff8fab', '#ffd43b', '#fff'];
      for (let i = 0; i < 7; i++) {
        const a = Math.PI + (i / 6) * Math.PI;
        const px = Math.cos(a) * 23,
          py = -66 + Math.sin(a) * 9;
        ell(ctx, px, py, 5.5, 5.5, cols[i], OUT, 1.2);
        ell(ctx, px, py, 2, 2, '#ffa94d');
      }
      break;
    }
    case 'cowboy':
      ctx.beginPath();
      ctx.moveTo(-40, -70);
      ctx.quadraticCurveTo(-30, -58, 0, -62);
      ctx.quadraticCurveTo(30, -58, 40, -70);
      ctx.quadraticCurveTo(26, -70, 18, -72);
      ctx.lineTo(-18, -72);
      ctx.quadraticCurveTo(-26, -70, -40, -70);
      ctx.closePath();
      ctx.fillStyle = c;
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-18, -70);
      ctx.quadraticCurveTo(-18, -96, -6, -93);
      ctx.quadraticCurveTo(0, -88, 6, -93);
      ctx.quadraticCurveTo(18, -96, 18, -70);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = c2;
      ctx.fillRect(-17, -77, 34, 5);
      star(ctx, 0, -74.5, 3.4, '#ffd43b');
      break;
    case 'beret':
      ell(ctx, -3, -79, 25, 11, c, OUT, 1.8, -0.18);
      line(ctx, -2, -89, 0, -95, OUT, 3);
      line(ctx, -2, -89, 0, -95, c, 1.6);
      ctx.fillStyle = c2;
      ctx.fillRect(-20, -73, 34, 3);
      break;
    case 'pirate':
      poly(ctx, [-32, -66, -24, -84, 0, -93, 24, -84, 32, -66, 0, -72], c, OUT, 1.8);
      ell(ctx, 0, -80, 5, 5, '#fff', OUT, 1);
      ell(ctx, -1.8, -81, 1.2, 1.4, OUT);
      ell(ctx, 1.8, -81, 1.2, 1.4, OUT);
      line(ctx, -8, -72, 8, -66, '#fff', 2);
      line(ctx, 8, -72, -8, -66, '#fff', 2);
      break;
    case 'chef':
      for (const [hx, hy, r] of [
        [-11, -91, 10],
        [0, -96, 11],
        [11, -91, 10],
      ])
        ell(ctx, hx, hy, r, r, '#fff', OUT, 1.8);
      fillRR(ctx, -16, -90, 32, 22, 3, '#fff', null);
      line(ctx, -16, -86, -16, -70, OUT, 1.8);
      line(ctx, 16, -86, 16, -70, OUT, 1.8);
      fillRR(ctx, -18, -74, 36, 8, 3, '#f1f3f5', OUT, 1.8);
      break;
    case 'santa':
      ctx.beginPath();
      ctx.moveTo(-22, -68);
      ctx.quadraticCurveTo(-14, -100, 14, -96);
      ctx.quadraticCurveTo(30, -92, 32, -74);
      ctx.quadraticCurveTo(22, -84, 22, -68);
      ctx.closePath();
      ctx.fillStyle = c;
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      fillRR(ctx, -26, -72, 52, 10, 5, '#fff', OUT, 1.8);
      ell(ctx, 32, -72, 6.5, 6.5, '#fff', OUT, 1.6);
      break;
    case 'witch':
      ell(ctx, 0, -68, 38, 8, c, OUT, 1.8);
      ctx.beginPath();
      ctx.moveTo(-18, -70);
      ctx.quadraticCurveTo(-8, -100, 12, -112);
      ctx.quadraticCurveTo(8, -96, 18, -70);
      ctx.closePath();
      ctx.fillStyle = c;
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.fillStyle = c2;
      ctx.fillRect(-17, -77, 34, 5);
      fillRR(ctx, -5, -79, 10, 9, 2, '#ffd43b', OUT, 1.2);
      break;
    case 'party':
      poly(ctx, [-14, -70, 0, -106, 14, -70], c, OUT, 1.8);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-14, -70);
      ctx.lineTo(0, -106);
      ctx.lineTo(14, -70);
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = c2;
      for (let yy = -100; yy < -70; yy += 12) ctx.fillRect(-16, yy, 32, 5);
      ctx.restore();
      ell(ctx, 0, -107, 5, 5, '#ffd43b', OUT, 1.4);
      break;
    case 'pith':
      ell(ctx, 0, -68, 32, 7, c2, OUT, 1.8);
      ctx.beginPath();
      ctx.ellipse(0, -69, 22, 21, 0, Math.PI, 0);
      ctx.closePath();
      ctx.fillStyle = c;
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.fillStyle = shade(c, -0.25);
      ctx.fillRect(-21.5, -75, 43, 4);
      ell(ctx, 0, -90, 3, 2.4, c2, OUT, 1);
      break;
    case 'catears':
      ctx.beginPath();
      ctx.ellipse(0, -62, 27, 22, 0, Math.PI * 1.1, -0.1 * Math.PI);
      ctx.strokeStyle = c2;
      ctx.lineWidth = 4;
      ctx.stroke();
      for (const sx of [-1, 1]) {
        poly(ctx, [sx * 8, -81, sx * 16, -100, sx * 25, -78], c, OUT, 1.8);
        poly(ctx, [sx * 12, -82, sx * 16, -93, sx * 21, -80], '#ffb3c1');
      }
      break;
    case 'shellclip': {
      // заколка-ракушка над ушком: веер-гребешок с рёбрышками и жемчужинкой
      ctx.save();
      ctx.translate(-18, -76);
      ctx.rotate(-0.35);
      ctx.beginPath();
      ctx.moveTo(0, 6);
      for (let i = 0; i <= 6; i++) {
        const a = Math.PI + (i / 6) * Math.PI;
        ctx.lineTo(Math.cos(a) * 11, 2 + Math.sin(a) * 10);
      }
      ctx.closePath();
      ctx.fillStyle = c;
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 1.3;
      ctx.stroke();
      for (let i = 1; i < 6; i++) {
        const a = Math.PI + (i / 6) * Math.PI;
        line(ctx, 0, 5, Math.cos(a) * 9, 2 + Math.sin(a) * 8, shade(c, -0.25), 1);
      }
      fillRR(ctx, -4, 4, 8, 4, 2, shade(c, -0.15), OUT, 1);
      ell(ctx, 6, -6, 2.4, 2.4, c2 === shade(c, -0.25) ? '#fff' : c2, OUT, 0.8);
      ctx.restore();
      break;
    }
    case 'chief': {
      // убор вождя (удалённый остров): веер перьев и пальмовых листьев на плетёном ободке, спереди цветок
      const feathers = [c, '#ffd43b', '#1c7ed6', c, '#ffd43b'];
      for (let i = -2; i <= 2; i++) {
        ctx.save();
        ctx.translate(i * 9, -76);
        ctx.rotate(i * 0.26);
        ell(ctx, 0, -14, 5.5, 15, feathers[i + 2], OUT, 1.5);
        line(ctx, 0, -2, 0, -26, 'rgba(74,55,40,.5)', 1.1);
        ctx.restore();
      }
      for (const s2 of [-1, 1]) {
        ctx.save();
        ctx.translate(s2 * 21, -72);
        ctx.rotate(s2 * 1.05);
        ell(ctx, 0, -10, 4.5, 12, c2, OUT, 1.4);
        ctx.restore();
      }
      fillRR(ctx, -23, -76, 46, 9, 4, '#c9a24a', OUT, 1.6);
      for (let x = -18; x <= 18; x += 6) line(ctx, x, -75, x + 3, -68, 'rgba(74,55,40,.45)', 1.2);
      for (let k = 0; k < 5; k++) ell(ctx, Math.cos(k * 1.257) * 4.5, -72 + Math.sin(k * 1.257) * 4.5, 3.2, 3.2, '#ff8fab', OUT, 0.9);
      ell(ctx, 0, -72, 2.2, 2.2, '#ffd43b');
      break;
    }
    case 'flower':
      for (let k = 0; k < 6; k++)
        ell(ctx, -19 + Math.cos(k * 1.047) * 7, -73 + Math.sin(k * 1.047) * 7, 5.5, 5.5, c, OUT, 1.2);
      ell(ctx, -19, -73, 4, 4, c2 === shade(c, -0.25) ? '#ffd43b' : c2, OUT, 1);
      break;
    case 'tophat':
      ell(ctx, 0, -71, 26, 5, c, OUT, 1.8);
      fillRR(ctx, -16, -98, 32, 28, 3, c, OUT, 1.8);
      ctx.fillStyle = c2;
      ctx.fillRect(-15, -78, 30, 5);
      break;
    default:
      break;
  }
  ctx.restore();
}

function drawAccBack(ctx, item, t) {
  if (item.kind === 'pickaxe') {
    // кирка на плече (шахтёр Камушкин): рукоять из-за спины, железный клюв над правым плечом
    line(ctx, -6, -6, 34, -78, OUT, 6.5);
    line(ctx, -6, -6, 34, -78, item.c2 || '#a0662d', 4);
    ctx.beginPath();
    ctx.moveTo(16, -92);
    ctx.quadraticCurveTo(34, -88, 52, -64);
    ctx.lineTo(48, -62);
    ctx.quadraticCurveTo(36, -78, 18, -84);
    ctx.closePath();
    ctx.fillStyle = item.c || '#adb5bd';
    ctx.fill();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 1.8;
    ctx.stroke();
    line(ctx, 22, -88, 36, -84, 'rgba(255,255,255,.6)', 1.6);
    return;
  }
  if (item.kind === 'wings') {
    const f = 1 + Math.sin(t * 6) * 0.08;
    ctx.save();
    ctx.globalAlpha = 0.85;
    for (const sx of [-1, 1]) {
      ctx.save();
      ctx.scale(sx * f, 1);
      ell(ctx, 30, -42, 18, 12, item.c, OUT, 1.5, -0.5);
      ell(ctx, 27, -24, 12, 8, shade(item.c, 0.3), OUT, 1.5, 0.4);
      ctx.restore();
    }
    ctx.restore();
  } else if (item.kind === 'backpack') {
    fillRR(ctx, -27, -44, 54, 34, 12, item.c, OUT, 1.8);
  } else if (item.kind === 'cape') {
    const sw = Math.sin(t * 3) * 3;
    const cape = new Path2D();
    cape.moveTo(-17, -43);
    cape.lineTo(17, -43);
    cape.quadraticCurveTo(34, -24, 31 + sw, 0);
    cape.quadraticCurveTo(0, 6, -31 + sw, 0);
    cape.quadraticCurveTo(-34, -24, -17, -43);
    cape.closePath();
    ctx.fillStyle = item.c;
    ctx.fill(cape);
    if (item.pattern === 'stars') {
      // волшебная мантия: золотые звёздочки — по краям, их видно из-за спины
      ctx.save();
      ctx.clip(cape);
      for (const [x, y] of [
        [-29, -12],
        [28, -22],
        [29, -4],
        [-27, -28],
      ])
        star(ctx, x + sw * 0.5, y, 3.2, item.c2 || '#ffd43b');
      ctx.restore();
    }
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2;
    ctx.stroke(cape);
  }
}

function drawAcc(ctx, item) {
  const c = item.c,
    c2 = item.c2 || shade(c, 0.5);
  switch (item.kind) {
    case 'glasses':
      ell(ctx, -10, -55, 8, 8, 'rgba(255,255,255,.25)', c, 2.2);
      ell(ctx, 10, -55, 8, 8, 'rgba(255,255,255,.25)', c, 2.2);
      line(ctx, -2, -55, 2, -55, c, 2.2);
      break;
    case 'sunglasses':
      fillRR(ctx, -19, -61, 16, 12, 5, '#2b2d42', c, 2);
      fillRR(ctx, 3, -61, 16, 12, 5, '#2b2d42', c, 2);
      line(ctx, -3, -57, 3, -57, c, 2.2);
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      ctx.fillRect(-16, -59, 4, 2);
      ctx.fillRect(6, -59, 4, 2);
      break;
    case 'skigoggles': {
      // лыжные очки подняты на лоб (поверх шапки): резинка вокруг головы и две зеркальные линзы
      const y = -69;
      line(ctx, -27, y + 1, 27, y + 1, OUT, 5);
      line(ctx, -27, y + 1, 27, y + 1, c2, 3);
      fillRR(ctx, -21, y - 7, 42, 15, 7, c, OUT, 2);
      fillRR(ctx, -18, y - 4.5, 16, 10, 4, '#ff922b', OUT, 1.2);
      fillRR(ctx, 2, y - 4.5, 16, 10, 4, '#ff922b', OUT, 1.2);
      ctx.fillStyle = 'rgba(255,240,180,.85)';
      ctx.fillRect(-15, y - 3, 6, 2);
      ctx.fillRect(5, y - 3, 6, 2);
      ctx.fillStyle = 'rgba(180,60,220,.35)';
      ctx.fillRect(-16, y + 1, 12, 3);
      ctx.fillRect(4, y + 1, 12, 3);
      break;
    }
    case 'scarf': // на шее: закрывает самый низ подбородка, рот остаётся открытым
      ell(ctx, 0, -30, 21, 6.5, c, OUT, 1.8);
      fillRR(ctx, 7, -31, 10, 20, 3, c, OUT, 1.8);
      ctx.fillStyle = c2;
      ctx.fillRect(8, -17, 8, 3);
      ctx.fillRect(8, -23, 8, 3);
      for (let i = -14; i < 6; i += 8) ctx.fillRect(i, -33, 4, 6);
      break;
    case 'necklace': // нитка выходит из-под подбородка и лежит на груди
      for (let i = 0; i <= 6; i++) {
        const a = Math.PI * (0.1 + (0.8 * i) / 6);
        ell(ctx, Math.cos(a) * 15, -34 + Math.sin(a) * 11, 2.4, 2.4, c, OUT, 0.8);
      }
      if (item.pendant) printOn(ctx, item.pendant, 0, -17);
      break;
    case 'bag': // ремешок — с плеча
      line(ctx, -19, -37, 22, -16, shade(c, -0.3), 2.5);
      fillRR(ctx, 15, -20, 17, 14, 4, c, OUT, 1.6);
      ell(ctx, 23.5, -15, 2, 2, c2);
      break;
    case 'bowtie': // под самым подбородком
      poly(ctx, [0, -24.5, -10, -30.5, -10, -18.5], c, OUT, 1.5);
      poly(ctx, [0, -24.5, 10, -30.5, 10, -18.5], c, OUT, 1.5);
      ell(ctx, 0, -24.5, 3, 3, c2, OUT, 1.2);
      break;
    case 'tie': // узел у подбородка, сам галстук — по груди
      poly(ctx, [-4, -30, 4, -30, 2, -24, -2, -24], c, OUT, 1.2);
      poly(ctx, [-2.5, -24, 2.5, -24, 5, -10, 0, -5, -5, -10], c, OUT, 1.4);
      ctx.fillStyle = c2;
      ctx.fillRect(-3.3, -19.5, 6.6, 2.5);
      ctx.fillRect(-4.2, -14, 8.4, 2.5);
      break;
    case 'lei': {
      const cols = [c, '#ffd43b', '#fff', c2, c, '#ffd43b', '#fff', c2, c];
      for (let i = 0; i <= 8; i++) {
        const a = Math.PI * (0.08 + (0.84 * i) / 8),
          px = Math.cos(a) * 19,
          py = -36 + Math.sin(a) * 13;
        ell(ctx, px, py, 4.6, 4.6, cols[i], OUT, 1);
        ell(ctx, px, py, 1.5, 1.5, '#ffa94d');
      }
      break;
    }
    case 'camera': // ремешок с шеи, камера на груди
      line(ctx, -14, -38, -9, -21, shade(c, -0.3), 2);
      line(ctx, 14, -38, 9, -21, shade(c, -0.3), 2);
      fillRR(ctx, -12, -25, 24, 16, 4, c, OUT, 1.6);
      ell(ctx, 0, -17, 5.5, 5.5, '#74c0fc', OUT, 1.4);
      fillRR(ctx, 4, -28, 6, 4, 1, c2, OUT, 1);
      break;
    case 'binoculars': // бинокль на ремешке: две трубки на груди
      line(ctx, -14, -38, -9, -22, shade(c, 0.2), 2);
      line(ctx, 14, -38, 9, -22, shade(c, 0.2), 2);
      fillRR(ctx, -12, -26, 10, 15, 3, c, OUT, 1.5);
      fillRR(ctx, 2, -26, 10, 15, 3, c, OUT, 1.5);
      fillRR(ctx, -3, -23, 6, 5, 1, shade(c, 0.25), OUT, 1);
      ell(ctx, -7, -11.5, 4, 2, c2, OUT, 1);
      ell(ctx, 7, -11.5, 4, 2, c2, OUT, 1);
      line(ctx, -9.5, -24, -9.5, -15, 'rgba(255,255,255,.35)', 1.6);
      break;
    case 'waterpistol': {
      // водяной пистолет (Иван Купала): в правой лапке, дулом в сторону; прозрачный бачок с водой сверху
      const x = 24,
        y = -18;
      fillRR(ctx, x - 4, y - 2, 8, 13, 3, shade(c, -0.15), OUT, 1.4); // рукоятка
      fillRR(ctx, x - 9, y - 9, 30, 10, 5, c, OUT, 1.6); // корпус
      fillRR(ctx, x + 18, y - 7, 8, 5, 2, c2, OUT, 1.2); // дуло
      ell(ctx, x + 3, y - 13, 8, 6, 'rgba(165,216,255,.85)', OUT, 1.3); // бачок
      ell(ctx, x + 3, y - 11, 6, 3, '#4dabf7');
      ell(ctx, x + 1, y - 15, 2, 1.4, 'rgba(255,255,255,.9)');
      ell(ctx, x - 1, y + 3, 3, 3, c2, OUT, 1); // курок
      ell(ctx, x - 4, y - 5, 3.2, 3, '#fff', null, 0); // блик
      break;
    }
    case 'medal': // лента из-под подбородка, медаль на груди
      line(ctx, -10, -37, 0, -19, '#e03131', 3);
      line(ctx, 10, -37, 0, -19, '#1c7ed6', 3);
      ell(ctx, 0, -15, 6, 6, c, OUT, 1.4);
      star(ctx, 0, -15, 3, '#fff');
      break;
    default:
      break;
  }
}

function drawTuft(ctx, style, col) {
  ctx.strokeStyle = col;
  ctx.lineCap = 'round';
  ctx.fillStyle = col;
  if (style === 1) {
    // хохолок
    ctx.lineWidth = 4;
    for (const [dx, cx, tx] of [
      [-4, -9, -11],
      [0, 0, 1],
      [4, 9, 12],
    ]) {
      ctx.beginPath();
      ctx.moveTo(dx, -73);
      ctx.quadraticCurveTo(cx, -84, tx, -85);
      ctx.stroke();
    }
  } else if (style === 2) {
    // чёлка
    ctx.beginPath();
    ctx.moveTo(-18, -70);
    ctx.quadraticCurveTo(-10, -80, 4, -76);
    ctx.quadraticCurveTo(12, -74, 17, -66);
    ctx.quadraticCurveTo(6, -70, 0, -64);
    ctx.quadraticCurveTo(-6, -71, -18, -64);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  } else if (style === 3) {
    // кудряшки
    for (const [x, y, r] of [
      [-10, -75, 6],
      [0, -79, 7],
      [10, -75, 6],
      [-4, -72, 5],
      [5, -72, 5],
    ])
      ell(ctx, x, y, r, r, col, OUT, 1.2);
  } else if (style === 4) {
    // хвостики
    for (const sx of [-1, 1]) {
      ell(ctx, sx * 27, -74, 8, 10, col, OUT, 1.4, sx * 0.5);
      ell(ctx, sx * 21, -68, 3, 3, '#ff8fab');
    }
  } else if (style === 5) {
    // ирокез
    poly(ctx, [-8, -73, -5, -88, -1, -78, 3, -91, 6, -78, 10, -86, 11, -72], col, OUT, 1.3);
  }
}

function drawBow(ctx, col, x, y) {
  poly(ctx, [x, y, x - 10, y - 7, x - 10, y + 7], col, OUT, 1.4);
  poly(ctx, [x, y, x + 10, y - 7, x + 10, y + 7], col, OUT, 1.4);
  ell(ctx, x, y, 3.2, 3.2, shade(col, -0.2), OUT, 1.2);
}

// Поворот: насколько мордочка сдвигается в сторону взгляда и насколько хомячок наклоняется на ходу.
// З6 (этап 9): мордочка сдвигается заметнее (было 5), дальний глаз чуть уже, уши и светлое брюшко уходят
// навстречу повороту — в городе хомячок мелкий, и прежний поворот читался слабо.
const TURN = 8.5,
  LEAN = 0.05;

/**
 * Нарисовать хомячка.
 * @param look  {fur, spots, belly, ear, outfit:{head,body,legs,feet,acc} (объекты вещей), beauty:{...},
 *               sick: true — простыла (Ф1): красный носик, румянец, бровки домиком и градусник во рту}
 * @param pose  {dir:1|-1|нет, walk:фаза 0..1|null, time:сек, blink, sleep, happy, armsUp, sit,
 *               clipBelow:y (не рисовать ниже, для воды), shadow:false, lean:false (не наклоняться на ходу),
 *               sneeze: 0..1 — чихает (0–0,45 «а-а-а…», 0,45–0,85 «апчхи!»), null — нет}
 *
 * Направление (dir) показывает ПОЗА, рисунок не зеркалится: мордочка (глаза, нос, рот, усы, щёчки, очки)
 * поворачивается в сторону dir, носки и козырёк кепки смотрят туда же, на ходу хомячок слегка наклоняется
 * вперёд. Всё «своё» — пятна, бантик, чёлка, сумочка на плече, хвост шарфа, цветок на шляпе — остаётся
 * на одной и той же стороне при любом dir. Без dir хомячок смотрит прямо на зрителя.
 */
export function drawHamster(ctx, x, y, s, look, pose = {}) {
  const o = look.outfit || {},
    b = look.beauty || {};
  const k = pose.dir === 1 || pose.dir === -1 ? pose.dir : 0; // куда повёрнут; 0 — смотрит прямо
  const turn = k * TURN;
  // сдвиг точки мордочки при повороте головы: в середине — полный, к краям головы сходит на нет
  const fx = k ? (px) => px + turn * (1 - (px / 27) * (px / 27)) : (px) => px;
  const time = pose.time || 0;
  const t = pose.walk;
  const walking = t != null;
  const bob = walking ? Math.abs(Math.sin(t * TAU)) * 2.5 : Math.sin(time * 2.2) * 0.7;
  const liftL = walking ? Math.max(0, Math.sin(t * TAU)) * 5 : 0;
  const liftR = walking ? Math.max(0, -Math.sin(t * TAU)) * 5 : 0;
  const fur = look.fur;
  // простуда (Ф1): чих — набираем воздух («а-а-а…»), потом «апчхи!» с зажмуренными глазами
  const sn = look.sick && typeof pose.sneeze === 'number' ? pose.sneeze : null;
  const preSneeze = sn !== null && sn < 0.45,
    burst = sn !== null && sn >= 0.45 && sn < 0.85;

  ctx.save();
  ctx.translate(x, y);
  if (pose.shadow !== false && pose.clipBelow == null) {
    ctx.fillStyle = 'rgba(0,0,0,.16)';
    ctx.beginPath();
    ctx.ellipse(0, 1 * s, 24 * s, 6 * s, 0, 0, TAU);
    ctx.fill();
  }
  ctx.scale(s, s);
  if (pose.clipBelow != null) {
    ctx.beginPath();
    ctx.rect(-80, -160, 160, 160 + pose.clipBelow);
    ctx.clip();
  }
  ctx.lineJoin = 'round';

  // --- лапки-ноги (у русалочки вместо них хвост — drawLegs)
  const fw = pose.sit ? 14 : 10;
  if (!(o.legs && o.legs.kind === 'mermaid'))
    drawFeet(ctx, o.feet, b.nails, k, [
    [-fw, liftL],
    [fw, liftR],
  ]);

  ctx.translate(0, -bob);
  if (k && walking && pose.lean !== false) ctx.rotate(k * LEAN); // на ходу — лёгкий наклон вперёд
  if (o.acc && BACK_ACC.includes(o.acc.kind)) drawAccBack(ctx, o.acc, time);

  // --- тело
  bodyPath(ctx);
  ctx.fillStyle = fur;
  ctx.fill();
  ctx.save();
  ctx.clip();
  if (look.belly) ell(ctx, k * 4, -18, 14, 16, look.belly); // брюшко — в сторону взгляда
  if (look.spots) {
    ell(ctx, -17, -18, 10, 9, look.spots);
    ell(ctx, 17, -8, 7, 6, look.spots);
  }
  ctx.fillStyle = 'rgba(0,0,0,.05)';
  ctx.fillRect(-30, -8, 60, 12);
  ctx.restore();
  bodyPath(ctx);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2;
  ctx.stroke();

  drawLegs(ctx, o.legs);
  drawBody(ctx, o.body);

  // --- лапки-руки
  const sl = sleevesOf(o.body);
  const swing = walking ? Math.sin(t * TAU) * 0.25 : 0;
  for (const sx of [-1, 1]) {
    ctx.save();
    if (pose.armsUp) {
      ctx.translate(sx * 25, -42);
      ctx.rotate(sx * 2.4);
    } else {
      ctx.translate(sx * 23, -30);
      ctx.rotate(sx * -0.35 + swing);
    }
    ell(ctx, 0, 4, 5.5, 9, fur, OUT, 1.6);
    if (sl) {
      const col = o.body.kind === 'overall' ? o.body.c2 || '#fff' : o.body.c;
      ctx.save();
      ctx.beginPath();
      ctx.rect(-8, -7, 16, sl === 'long' ? 15 : 9);
      ctx.clip();
      ell(ctx, 0, 4, 6.3, 9.8, col, OUT, 1.6);
      ctx.restore();
    }
    if (b.nails) ell(ctx, 0, 11.5, 2.2, 1.6, b.nails);
    ctx.restore();
  }
  collar(ctx, o.body);
  const chestAcc = o.acc && CHEST_ACC.includes(o.acc.kind);
  if (chestAcc) {
    drawAcc(ctx, o.acc); // на груди, поверх одежды; голова ляжет сверху
  } else if (o.acc && o.acc.kind === 'backpack') {
    // лямки рюкзачка — с плеч на грудь (сам рюкзачок за спиной, спереди его почти не видно)
    for (const sx of [-1, 1]) {
      line(ctx, sx * 15, -36, sx * 17, -12, OUT, 4.6);
      line(ctx, sx * 15, -36, sx * 17, -12, shade(o.acc.c, -0.2), 2.8);
    }
  }

  // --- уши
  for (const sx of [-1, 1]) {
    const spotEar = look.spots && sx === 1;
    const ux = sx * 19 - k * 2.5; // повернулась — уши чуть «назад», к затылку
    ell(ctx, ux, -71, 8.5, 8.5, spotEar ? look.spots : fur, OUT, 2);
    ell(ctx, ux, -70.5, 4.8, 4.8, look.ear || '#ffb3c1');
  }

  // --- голова
  headPath(ctx);
  ctx.fillStyle = fur;
  ctx.fill();
  ctx.save();
  ctx.clip();
  if (look.spots) ell(ctx, fx(14), -60, 13, 12, look.spots); // пятно у глаза — всегда у одного и того же
  if (look.mask) ell(ctx, turn, -44, 17, 11, look.mask);
  ctx.restore();
  headPath(ctx);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2;
  ctx.stroke();

  // щёчки (простуженная — румяная)
  if (look.sick) {
    ctx.globalAlpha = 0.7;
    ell(ctx, fx(-18), -45.5, 6.8, 4.4, '#ff6b6b');
    ell(ctx, fx(18), -45.5, 6.8, 4.4, '#ff6b6b');
    ctx.globalAlpha = 1;
  } else if (b.blush !== null) {
    ctx.globalAlpha = 0.6;
    ell(ctx, fx(-18), -46, 5.5, 3.6, b.blush || '#ffb0bd');
    ell(ctx, fx(18), -46, 5.5, 3.6, b.blush || '#ffb0bd');
    ctx.globalAlpha = 1;
  }
  // глаза (простуженная — сонные, чуть прикрытые; перед чихом — жмурится)
  let bl = pose.sleep || pose.blink === true ? 1 : typeof pose.blink === 'number' ? pose.blink : 0; // 0..1
  if (look.sick && !pose.happy) bl = Math.max(bl, preSneeze ? 0.62 : 0.3);
  const closed = bl > 0.72 || burst;
  for (const sx of [-1, 1]) {
    const ex = fx(sx * 10),
      ey = -55,
      ew = k && sx === -k ? 0.8 : 1; // дальний глаз при повороте чуть уже
    const onSpot = look.spots && sx === 1;
    if (onSpot && !closed && !pose.happy) ell(ctx, ex, ey, 6, 7, '#fff');
    if (burst) {
      // «апчхи!» — крепко зажмурилась: > <
      ctx.beginPath();
      ctx.moveTo(ex + sx * 4, ey - 4);
      ctx.lineTo(ex - sx * 3, ey);
      ctx.lineTo(ex + sx * 4, ey + 3.5);
      ctx.strokeStyle = onSpot ? '#fff' : OUT;
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    } else if (closed) {
      ctx.beginPath();
      ctx.arc(ex, ey - 1, 4.5, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.strokeStyle = onSpot ? '#fff' : OUT;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.stroke();
    } else if (pose.happy) {
      ctx.beginPath();
      ctx.arc(ex, ey + 2, 4.5, 1.15 * Math.PI, 1.85 * Math.PI);
      ctx.strokeStyle = onSpot ? '#fff' : '#1d1b1b';
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.stroke();
    } else {
      const k = 1 - bl * 0.9; // глаз плавно «сплющивается», пока закрывается
      ell(ctx, ex, ey + (1 - k) * 2, 4.3 * ew, Math.max(0.9, 5.3 * k), '#1d1b1b');
      if (k > 0.5) {
        ell(ctx, ex - 1.4 * ew, ey - 2 * k, 1.7 * ew, 1.7 * k, '#fff');
        ell(ctx, ex + 1.3 * ew, ey + 1.6 * k, 0.8, 0.8 * k, '#fff');
      }
    }
    if (b.lashes && !closed) {
      const lc = onSpot ? '#fff' : '#1d1b1b';
      line(ctx, ex + sx * 4, ey - 3, ex + sx * 7.5, ey - 5.5, lc, 1.4);
      line(ctx, ex + sx * 4.5, ey - 0.5, ex + sx * 8, ey - 1.5, lc, 1.4);
    }
    // простуженная: бровки «домиком» — внутренний край выше
    if (look.sick && !pose.sleep && !pose.happy) {
      ctx.globalAlpha = 0.75;
      line(ctx, ex - sx * 4.5, ey - 10.5, ex + sx * 4, ey - 8, onSpot ? '#fff' : OUT, 1.6);
      ctx.globalAlpha = 1;
    }
  }
  // усы, нос, рот
  ctx.globalAlpha = 0.28;
  for (const sx of [-1, 1]) {
    line(ctx, fx(sx * 13), -47, fx(sx * 24), -49, OUT, 1);
    line(ctx, fx(sx * 13), -45, fx(sx * 24), -43, OUT, 1);
  }
  ctx.globalAlpha = 1;
  if (look.sick) {
    // красный носик
    ell(ctx, turn, -48.5, 4.4, 3.4, '#ff4d6d', OUT, 1);
    ell(ctx, turn - 1.4, -49.6, 1.3, 0.9, 'rgba(255,255,255,.8)');
  } else ell(ctx, turn, -48.5, 3.1, 2.3, '#ff8fa3', OUT, 1);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  if (sn !== null) {
    // чих: ротик «о» — набираем воздух, потом широко
    ctx.beginPath();
    ctx.ellipse(turn, -42.5, burst ? 4.2 : 2.6, burst ? 3.4 : 2.4, 0, 0, TAU);
    ctx.fillStyle = '#c9485b';
    ctx.fill();
    ctx.stroke();
  } else if (pose.happy || pose.talk) {
    ctx.beginPath();
    ctx.ellipse(turn, -43, 4, pose.talk ? 2 + Math.abs(Math.sin(time * 9)) * 2.5 : 3.5, 0, 0, Math.PI);
    ctx.fillStyle = '#c9485b';
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(turn - 3, -46, 3, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(turn + 3, -46, 3, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
  }
  // градусник во рту: красный кончик во рту, стеклянная палочка торчит в сторону взгляда
  if (look.sick && sn === null && !pose.happy && !pose.talk && !pose.sleep) {
    const gx = k || 1;
    const x0 = turn + gx * 2.5,
      y0 = -44,
      x1 = turn + gx * 19,
      y1 = -37.5;
    line(ctx, x0, y0, x1, y1, OUT, 4.6);
    line(ctx, x0, y0, x1, y1, '#f8f9fa', 3);
    line(ctx, x0, y0, x0 + (x1 - x0) * 0.55, y0 + (y1 - y0) * 0.55, '#fa5252', 1.3);
    ell(ctx, x0, y0, 2.4, 2.4, '#fa5252', OUT, 1);
    for (let i = 1; i <= 3; i++) {
      const q = 0.35 + i * 0.15;
      ell(ctx, x0 + (x1 - x0) * q, y0 + (y1 - y0) * q - 1.2, 0.5, 0.5, OUT);
    }
  }
  // борода и усы (шахтёр Камушкин — beauty.beard: цвет): пышная борода под ротиком, усы — под носом
  if (b.beard) {
    const bc = b.beard,
      bo = shade(bc, -0.3);
    ctx.beginPath();
    ctx.moveTo(fx(-17), -42);
    ctx.quadraticCurveTo(fx(-20), -30, fx(-11), -24);
    ctx.quadraticCurveTo(fx(-6), -18, turn, -16);
    ctx.quadraticCurveTo(fx(6), -18, fx(11), -24);
    ctx.quadraticCurveTo(fx(20), -30, fx(17), -42);
    ctx.quadraticCurveTo(fx(9), -38, turn, -39);
    ctx.quadraticCurveTo(fx(-9), -38, fx(-17), -42);
    ctx.closePath();
    ctx.fillStyle = bc;
    ctx.fill();
    ctx.strokeStyle = bo;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    for (const dx of [-8, 0, 8]) line(ctx, fx(dx), -34, fx(dx * 0.7), -24, bo, 1);
    ell(ctx, fx(-6.5), -44.5, 7.5, 3.6, bc, bo, 1.3, 0.25);
    ell(ctx, fx(6.5), -44.5, 7.5, 3.6, bc, bo, 1.3, -0.25);
    ell(ctx, turn, -48.5, 3.1, 2.3, '#ff8fa3', OUT, 1); // носик поверх усов
  }
  if (pose.sleep) {
    ctx.fillStyle = '#74c0fc';
    ctx.font = '800 12px sans-serif';
    ctx.textAlign = 'center';
    const k = (time * 0.6) % 1;
    ctx.globalAlpha = 1 - k;
    ctx.fillText('z', 26 + k * 8, -70 - k * 16);
    ctx.globalAlpha = 1;
  }

  // --- причёска, бантик, шапка, аксессуар
  const hat = o.head;
  if (b.tuft && (!hat || ['earmuffs', 'wreath', 'catears', 'flower', 'shellclip'].includes(hat.kind)))
    drawTuft(ctx, b.tuft, b.hair || look.spots || shade(fur, -0.35));
  if (hat) drawHat(ctx, hat, k || 1);
  if (b.bow) drawBow(ctx, b.bow, hat ? -24 : -15, hat ? -62 : -74);
  if (o.acc && !chestAcc && !BACK_ACC.includes(o.acc.kind)) {
    if (k && FACE_ACC.includes(o.acc.kind)) {
      // очки сидят на глазах — поворачиваются вместе с мордочкой
      ctx.save();
      ctx.translate(fx(10) - 10, 0);
      drawAcc(ctx, o.acc);
      ctx.restore();
    } else drawAcc(ctx, o.acc);
  } else if (o.acc && o.acc.kind === 'cape') {
    // застёжка плаща — на груди под подбородком
    line(ctx, -11, -26, 11, -26, '#ffd43b', 2);
    ell(ctx, -11, -26, 3.2, 3.2, '#ffd43b', OUT, 1);
    ell(ctx, 11, -26, 3.2, 3.2, '#ffd43b', OUT, 1);
  }
  // «апчхи!»: брызги-пузырики от носика и подпись над головой
  if (burst) {
    const p = (sn - 0.45) / 0.4,
      gx = k || 1;
    ctx.globalAlpha = 1 - p;
    for (let i = 0; i < 5; i++)
      ell(
        ctx,
        turn + gx * (9 + p * 24 + i * 2.5),
        -48 + (i - 2) * (1.5 + p * 5),
        2.1 - p,
        2.1 - p,
        '#a5d8ff',
        OUT,
        0.8,
      );
    ctx.font = '900 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e64980';
    ctx.fillText('апчхи!', gx * 30, -88 - p * 8);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

/** Портрет (голова крупно) в квадрате size×size с центром в (cx, cy). */
export function drawPortrait(ctx, cx, cy, size, look, pose = {}) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - size / 2, cy - size / 2, size, size);
  ctx.clip();
  const tall = look.outfit && look.outfit.head;
  const s = size / (tall ? 96 : 80);
  drawHamster(ctx, cx, cy + (tall ? 62 : 55) * s, s, look, { shadow: false, ...pose });
  ctx.restore();
}
