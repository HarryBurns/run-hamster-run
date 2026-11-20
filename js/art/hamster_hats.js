// Головные уборы и аксессуары хомячка (за спиной, на груди, на мордочке). Рисует art/hamster.js.
import { TAU } from '../core/util.js';
import { ell, fillRR, line, poly, star, shade } from '../core/draw.js';
import { OUT, pattern, printOn } from './hamster_wear.js';

// ---------- головные уборы ----------
export function drawHat(ctx, item, side = 1) {
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
      if (item.fern) {
        // купальский венок: листья папоротника торчат вверх и в стороны, цветы — белые, синие и огненный
        for (let i = 0; i < 6; i++) {
          const a = Math.PI * (1.08 + (i / 5) * 0.84),
            px = Math.cos(a) * 24,
            py = -67 + Math.sin(a) * 10;
          ell(ctx, px + Math.cos(a) * 8, py + Math.sin(a) * 9, 3.6, 10, '#37b24d', OUT, 1.1, a + Math.PI / 2);
        }
      }
      // венок из цветов острова (island): плюмерия, гибискус и орхидея — крупнее и с листиками
      const cols = item.fern
        ? ['#fff', '#74c0fc', '#fff', '#ff922b', '#fff', '#74c0fc', '#fff']
        : item.island
          ? ['#fff8e1', '#f03e3e', '#da77f2', '#fff8e1', '#f03e3e', '#da77f2', '#fff8e1']
          : ['#ff8fab', '#ffd43b', '#fff', '#c77dff', '#ff8fab', '#ffd43b', '#fff'];
      for (let i = 0; i < 7; i++) {
        const a = Math.PI + (i / 6) * Math.PI;
        const px = Math.cos(a) * 23,
          py = -66 + Math.sin(a) * 9;
        if (item.island) ell(ctx, px + (i % 2 ? 5 : -5), py + 3, 4.5, 2.4, '#51cf66', OUT, 1, i % 2 ? 0.6 : -0.6);
        ell(ctx, px, py, item.island ? 6.2 : 5.5, item.island ? 6.2 : 5.5, cols[i], OUT, 1.2);
        ell(ctx, px, py, 2, 2, item.island && cols[i] !== '#fff8e1' ? '#ffd43b' : '#ffa94d');
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
    case 'fashion': {
      // модная шляпка из каталога (Плюша, задание «Снимок для каталога»): маленькая, чуть набок, узкие поля,
      // лента с пышным бантом сбоку и брошка-звёздочка. Не от солнца (не в SUN_HAT_KINDS)
      ctx.translate(2 * side, -70);
      ctx.rotate(0.12 * side);
      ell(ctx, 0, 0, 26, 5.5, shade(c, -0.12), OUT, 1.8); // поля
      ctx.beginPath();
      ctx.moveTo(-17, -1);
      ctx.bezierCurveTo(-18, -14, -12, -18, 0, -18);
      ctx.bezierCurveTo(12, -18, 18, -14, 17, -1);
      ctx.closePath();
      ctx.fillStyle = c;
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = c2;
      ctx.fillRect(-20, -7, 40, 5); // лента
      ell(ctx, -6, -14, 5, 2.2, 'rgba(255,255,255,.45)', null, 1, -0.3); // блик
      ctx.restore();
      const bx = 13 * side;
      for (const d of [-1, 1]) {
        // бант: две пышные петли и хвостик ленты
        ctx.beginPath();
        ctx.moveTo(bx, -6);
        ctx.quadraticCurveTo(bx + d * 6, -17, bx + d * 11, -12);
        ctx.quadraticCurveTo(bx + d * 12, -3, bx, -6);
        ctx.fillStyle = c2;
        ctx.fill();
        ctx.strokeStyle = OUT;
        ctx.lineWidth = 1.3;
        ctx.stroke();
      }
      poly(ctx, [bx - 1, -5, bx + 3 * side, 5, bx + 7 * side, 3], c2, OUT, 1.2);
      star(ctx, bx, -6.5, 4, '#ffd43b', OUT, 1);
      break;
    }
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
      for (let k = 0; k < 5; k++)
        ell(ctx, Math.cos(k * 1.257) * 4.5, -72 + Math.sin(k * 1.257) * 4.5, 3.2, 3.2, '#ff8fab', OUT, 0.9);
      ell(ctx, 0, -72, 2.2, 2.2, '#ffd43b');
      break;
    }
    case 'flower':
      for (let k = 0; k < 6; k++)
        ell(ctx, -19 + Math.cos(k * 1.047) * 7, -73 + Math.sin(k * 1.047) * 7, 5.5, 5.5, c, OUT, 1.2);
      ell(ctx, -19, -73, 4, 4, c2 === shade(c, -0.25) ? '#ffd43b' : c2, OUT, 1);
      break;
    case 'starband': {
      // ободок с рождественской звездой: тонкая дуга между ушками, большая звезда с лучиками
      ctx.beginPath();
      ctx.ellipse(0, -62, 25, 16, 0, Math.PI * 1.12, -0.12 * Math.PI);
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.strokeStyle = c;
      ctx.lineWidth = 3;
      ctx.stroke();
      for (let i = 0; i < 4; i++) {
        const a = -Math.PI / 2 + (i - 1.5) * 0.5;
        line(ctx, Math.cos(a) * 13, -86 + Math.sin(a) * 13, Math.cos(a) * 18, -86 + Math.sin(a) * 18, c2, 1.8);
      }
      star(ctx, 0, -86, 11, c, OUT, 1.6);
      ell(ctx, -2.5, -89, 2.2, 1.6, 'rgba(255,255,255,.85)');
      break;
    }
    case 'dragon': {
      // шапочка дракона: зелёная, с золотыми рожками, гребешком, большими глазами и ноздрями
      for (const sx of [-1, 1]) poly(ctx, [sx * 11, -84, sx * 19, -103, sx * 20, -82], c2, OUT, 1.6);
      ctx.beginPath();
      ctx.moveTo(-27, -66);
      ctx.quadraticCurveTo(-28, -94, 0, -94);
      ctx.quadraticCurveTo(28, -94, 27, -66);
      ctx.quadraticCurveTo(0, -74, -27, -66);
      ctx.closePath();
      ctx.fillStyle = c;
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      for (let i = -1; i <= 1; i++)
        poly(ctx, [i * 9 - 4, -93, i * 9, -101 - (i === 0 ? 3 : 0), i * 9 + 4, -93], '#ff6b6b', OUT, 1.3);
      for (const sx of [-1, 1]) {
        ell(ctx, sx * 11, -82, 6, 6.5, '#fff', OUT, 1.4);
        ell(ctx, sx * 11 + side * 1.5, -81, 2.6, 3.2, OUT);
        ell(ctx, sx * 4, -72.5, 1.5, 1.2, shade(c, -0.35));
      }
      break;
    }
    case 'kokoshnik': {
      // кокошник: высокий полукруг с золотой каймой и жемчужинами
      ctx.beginPath();
      ctx.moveTo(-26, -68);
      ctx.quadraticCurveTo(-30, -104, 0, -108);
      ctx.quadraticCurveTo(30, -104, 26, -68);
      ctx.quadraticCurveTo(0, -76, -26, -68);
      ctx.closePath();
      ctx.fillStyle = c;
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-21, -74);
      ctx.quadraticCurveTo(-23, -98, 0, -101);
      ctx.quadraticCurveTo(23, -98, 21, -74);
      ctx.strokeStyle = c2;
      ctx.lineWidth = 2.4;
      ctx.stroke();
      for (let i = 0; i < 7; i++) {
        const a = Math.PI * (1.12 + (i / 6) * 0.76);
        ell(ctx, Math.cos(a) * 15, -76 + Math.sin(a) * 15, 2, 2, '#fff', OUT, 0.8);
      }
      star(ctx, 0, -80, 5, c2, OUT, 1);
      for (let i = -2; i <= 2; i++) ell(ctx, i * 9, -70.5 - (2 - Math.abs(i)) * 1.6, 2, 2, '#fff', OUT, 0.8);
      break;
    }
    case 'pumpkin': {
      // шапка-тыковка: рыжие дольки, зелёный хвостик и листик
      ctx.beginPath();
      ctx.moveTo(-27, -67);
      ctx.quadraticCurveTo(-32, -96, 0, -97);
      ctx.quadraticCurveTo(32, -96, 27, -67);
      ctx.quadraticCurveTo(0, -75, -27, -67);
      ctx.closePath();
      ctx.fillStyle = c;
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.strokeStyle = shade(c, -0.25);
      ctx.lineWidth = 1.6;
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(sx * 5, -96);
        ctx.quadraticCurveTo(sx * 11, -84, sx * 8, -72);
        ctx.moveTo(sx * 15, -93);
        ctx.quadraticCurveTo(sx * 23, -82, sx * 19, -70);
        ctx.stroke();
      }
      fillRR(ctx, -3, -105, 6, 10, 2, c2, OUT, 1.4);
      ell(ctx, 9, -100, 7, 3.6, '#51cf66', OUT, 1.2, -0.4);
      break;
    }
    case 'acorn': {
      // ореховая шапочка — шляпка жёлудя: чешуйки в клеточку, черешок и листик
      const cap = new Path2D();
      cap.moveTo(-28, -67);
      cap.quadraticCurveTo(-30, -93, 0, -94);
      cap.quadraticCurveTo(30, -93, 28, -67);
      cap.quadraticCurveTo(0, -75, -28, -67);
      cap.closePath();
      ctx.fillStyle = c;
      ctx.fill(cap);
      ctx.save();
      ctx.clip(cap);
      ctx.strokeStyle = c2;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = -6; i <= 6; i++) {
        ctx.moveTo(i * 9 - 16, -62);
        ctx.lineTo(i * 9 + 16, -98);
        ctx.moveTo(i * 9 + 16, -62);
        ctx.lineTo(i * 9 - 16, -98);
      }
      ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 1.8;
      ctx.stroke(cap);
      line(ctx, 0, -94, 3, -103, OUT, 4.6);
      line(ctx, 0, -94, 3, -103, c2, 2.8);
      ell(ctx, 11, -100, 7, 3.4, '#69db7c', OUT, 1.2, -0.35);
      break;
    }
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

export function drawAccBack(ctx, item, t) {
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
      if (item.bat) {
        // перепончатое крыло с зубчиками по нижнему краю
        poly(ctx, [18, -44, 50, -60, 47, -40, 40, -44, 38, -30, 31, -36, 26, -24, 18, -30], item.c, OUT, 1.5);
        line(ctx, 20, -42, 47, -57, shade(item.c, -0.3), 1.2);
        line(ctx, 20, -40, 38, -34, shade(item.c, -0.3), 1.2);
        ctx.restore();
        continue;
      }
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

export function drawAcc(ctx, item) {
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
    case 'shawl': {
      // расписной платок на плечах: два крыла сходятся узлом на груди, бахрома и цветы
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(sx * 2, -33);
        ctx.quadraticCurveTo(sx * 20, -40, sx * 28, -30);
        ctx.quadraticCurveTo(sx * 30, -16, sx * 22, -8);
        ctx.quadraticCurveTo(sx * 10, -14, 0, -20);
        ctx.closePath();
        ctx.fillStyle = c;
        ctx.fill();
        ctx.strokeStyle = OUT;
        ctx.lineWidth = 1.8;
        ctx.stroke();
        for (let i = 0; i < 4; i++)
          line(ctx, sx * (20 - i * 5), -9.5 - i * 2.6, sx * (21 - i * 5), -5.5 - i * 2.6, c2, 1.4);
        for (const [fx, fy] of [
          [14, -27],
          [22, -19],
        ]) {
          for (let k = 0; k < 5; k++)
            ell(
              ctx,
              sx * fx + Math.cos(k * 1.257) * 2.6,
              fy + Math.sin(k * 1.257) * 2.6,
              1.7,
              1.7,
              k % 2 ? '#fff' : '#ff8fab',
            );
          ell(ctx, sx * fx, fy, 1.4, 1.4, c2);
        }
      }
      ell(ctx, 0, -24, 4.5, 4, c2, OUT, 1.3);
      break;
    }
    case 'fan': {
      // веер в правой лапке: раскрытые пластинки с золотой каймой
      const x = 25,
        y = -14;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, 21, -Math.PI * 0.92, -Math.PI * 0.18);
      ctx.closePath();
      ctx.fillStyle = c;
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, 17, -Math.PI * 0.92, -Math.PI * 0.18);
      ctx.strokeStyle = c2;
      ctx.lineWidth = 2.2;
      ctx.stroke();
      for (let i = 1; i < 5; i++) {
        const a = -Math.PI * (0.92 - (i / 5) * 0.74);
        line(ctx, x, y, x + Math.cos(a) * 21, y + Math.sin(a) * 21, shade(c, -0.3), 1);
      }
      ell(ctx, x, y, 2.4, 2.4, c2, OUT, 1);
      break;
    }
    case 'balloon': {
      // воздушный шарик на ниточке в правой лапке
      const x = 25,
        y = -16;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 7, y - 26, x + 11, y - 50);
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ell(ctx, x + 12, y - 66, 13, 16, c, OUT, 1.8);
      poly(ctx, [x + 9, y - 50, x + 15, y - 50, x + 12, y - 46], c, OUT, 1.2);
      ell(ctx, x + 7, y - 72, 3.4, 5, 'rgba(255,255,255,.7)', null, 0, -0.5);
      break;
    }
    case 'nutbadge': {
      // значок «Ореховая Гавань»: зелёная ленточка и лесной орешек на груди
      poly(ctx, [-5, -22, 5, -22, 6, -9, 0, -13, -6, -9], c2, OUT, 1.3);
      ell(ctx, 0, -20, 8, 8.5, c, OUT, 1.6);
      ctx.beginPath();
      ctx.moveTo(-7.5, -22.5);
      ctx.quadraticCurveTo(0, -18.5, 7.5, -22.5);
      ctx.quadraticCurveTo(6, -29.5, 0, -29.5);
      ctx.quadraticCurveTo(-6, -29.5, -7.5, -22.5);
      ctx.closePath();
      ctx.fillStyle = shade(c, -0.3);
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ell(ctx, -3, -17, 1.8, 2.4, 'rgba(255,255,255,.55)', null, 0, 0.4);
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
