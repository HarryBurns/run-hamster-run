// Одежда хомячка на тело (кофты, платья, штаны, узоры и принты) и обувь. Рисует art/hamster.js — здесь только
// сами вещи в координатах хомячка (начало — между лапками, на полу). Шапки и аксессуары — art/hamster_hats.js.
import { TAU } from '../core/util.js';
import { ell, fillRR, line, poly, star, shade } from '../core/draw.js';

// Цвет контура хомячка и всего, что на нём.
export const OUT = '#4a3728'; // цвет контура

// Контур туловища (по нему обрезается одежда).
export function bodyPath(ctx, g = 0) {
  ctx.beginPath();
  ctx.ellipse(0, -24, 23 + g, 22 + g, 0, 0, TAU);
}

export function pattern(ctx, item, x, y, w, h) {
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
export function isLight(c) {
  const n = parseInt(c.slice(1, 7), 16);
  return ((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11 > 150;
}

// ---------- одежда на тело ----------
export function sleevesOf(item) {
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

export function drawLegs(ctx, item) {
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
    for (let i = -2; i <= 2; i++)
      ell(ctx, i * 8, -21, 2.2, 2.2, ['#ff6b6b', '#ffd43b', '#fff', '#ffd43b', '#ff6b6b'][i + 2]);
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

export function drawBody(ctx, item) {
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
      if (item.trim === 'stitch') {
        // вышитый сарафан: красные крестики по вороту и подолу
        const g = item.c2 || '#e03131';
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let i = -3; i <= 3; i++) {
          const x = i * 7.5,
            y = -8 + Math.abs(i) * 0.5;
          ctx.moveTo(x - 2.2, y - 2.2);
          ctx.lineTo(x + 2.2, y + 2.2);
          ctx.moveTo(x + 2.2, y - 2.2);
          ctx.lineTo(x - 2.2, y + 2.2);
        }
        for (let i = -1; i <= 1; i++) {
          const x = i * 6,
            y = -34;
          ctx.moveTo(x - 1.8, y - 1.8);
          ctx.lineTo(x + 1.8, y + 1.8);
          ctx.moveTo(x + 1.8, y - 1.8);
          ctx.lineTo(x - 1.8, y + 1.8);
        }
        ctx.stroke();
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
        if (item.print) printOn(ctx, item.print, 0, -27);
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

export function printOn(ctx, kind, x, y) {
  if (kind === 'heart') {
    ctx.fillStyle = '#ff5c8a';
    ctx.beginPath();
    ctx.moveTo(x, y + 6);
    ctx.bezierCurveTo(x - 10, y - 1, x - 4, y - 8, x, y - 3);
    ctx.bezierCurveTo(x + 4, y - 8, x + 10, y - 1, x, y + 6);
    ctx.fill();
  } else if (kind === 'snowflake') {
    // снежинка: шесть лучей с веточками
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3,
        cx = Math.cos(a),
        sy = Math.sin(a);
      line(ctx, x, y, x + cx * 8, y + sy * 8, '#fff', 1.8);
      for (const d of [-0.7, 0.7])
        line(
          ctx,
          x + cx * 5,
          y + sy * 5,
          x + cx * 5 + Math.cos(a + d) * 3,
          y + sy * 5 + Math.sin(a + d) * 3,
          '#fff',
          1.3,
        );
    }
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

export function collar(ctx, item) {
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
export function drawFeet(ctx, shoe, nails, k, feet) {
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
