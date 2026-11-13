// Значки вещей и мебели для окон и «сцена» с хомячком в полный рост (примерочная, салон).
import { makeCanvas } from '../core/draw.js';
import { drawHamster } from '../art/hamster.js';
import { drawFurn } from '../art/furniture.js';
import { defaultLook } from '../data.js';
import { playerLook } from '../core/state.js';
import { cachedIcon } from '../core/sprites.js';

const MANNEQUIN = { ...defaultLook(), fur: '#f3ede4', spots: null, ear: '#e6d5c3', beauty: { blush: null } };
/** Canvas со значком одежды: манекен-хомячок в этой вещи. */
// Значки рисуются один раз на (вещь, размер) и дальше копируются из кэша: окно магазина пересобирается
// на каждое нажатие, и рисовать заново по манекену на карточку — дорого.
export function clothesIcon(item, size = 84) {
  return cachedIcon('clothes:' + item.id, size, size, (ctx) => {
    const look = { ...MANNEQUIN, outfit: { [item.slot]: item } };
    let s = size / 100,
      dy = 0;
    if (item.slot === 'head') {
      s = size / 62;
      dy = 46 * s;
    } else if (item.slot === 'feet') {
      s = size / 56;
      dy = -22 * s;
    } else if (
      item.slot === 'acc' &&
      !['wings', 'backpack', 'bag', 'cape', 'camera', 'tie', 'lei'].includes(item.kind)
    ) {
      s = size / 62;
      dy = 28 * s;
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, size, size);
    ctx.clip();
    drawHamster(ctx, size / 2, size * 0.93 + dy, s, look, { shadow: false });
    ctx.restore();
  });
}
export function furnIcon(def, size = 84) {
  return cachedIcon('furn:' + def.id, size, size, (ctx) => {
    const k = Math.min((size - 8) / def.w, (size - 8) / Math.max(def.h, 30));
    ctx.save();
    ctx.translate(size / 2, def.wall ? size / 2 : size / 2 + (Math.max(def.h, 30) * k) / 2);
    ctx.scale(k, k);
    drawFurn(ctx, def, 0, 0, { t: 0.4, on: def.kind === 'lamp' || def.kind === 'fireplace', icon: true });
    ctx.restore();
  });
}
/** Canvas с хомячком в полный рост (для примерочной и т. п.). Возвращает { canvas, redraw(look, pose) } */
export function hamsterStage(w = 170, h = 190, scale = 1.75) {
  const { canvas, ctx } = makeCanvas(w, h);
  canvas.className = 'stage';
  const redraw = (look = playerLook(), pose = {}) => {
    ctx.clearRect(0, 0, w, h);
    drawHamster(ctx, w / 2, h - 18, scale, look, pose);
  };
  redraw();
  return { canvas, redraw };
}
