// Значки вещей и мебели для окон и «сцена» с хомячком в полный рост (примерочная, салон).
import { makeCanvas } from '../core/draw.js';
import { drawHamster, drawShoePair } from '../art/hamster.js';
import { drawFurn } from '../art/furniture.js';
import { defaultLook } from '../data/index.js';
import { playerLook } from '../core/state.js';
import { cachedIcon } from '../core/sprites.js';

const MANNEQUIN = { ...defaultLook(), fur: '#f3ede4', spots: null, ear: '#e6d5c3', beauty: { blush: null } };
// Кадр значка: хомячок-манекен (или пара обуви) крупно и по центру карточки. Высоты рисунка (в единицах
// хомячка, пол — 0): уши до -80, шляпы до -100 (колпачок, шляпа волшебницы, поварской колпак — до -114).
const TALL_HATS = ['party', 'witch', 'chef'];
const WIDE_HATS = ['sunhat', 'cowboy', 'witch', 'pirate']; // широкие поля (до ±40): помельче, чтобы не обрезались
const NECK_ACC = ['necklace', 'bowtie', 'medal', 'scarf']; // на шее: голова и грудь покрупнее
const WIDE_ACC = ['wings']; // крылышки шире хомячка — целиком и помельче
const FACE_ACC = ['glasses', 'sunglasses']; // на мордочке: голова крупно
/** Canvas со значком одежды: манекен-хомячок в этой вещи (обувь — пара на лапках).
 * Значки рисуются один раз на (вещь, размер) и дальше копируются из кэша: окно магазина пересобирается
 * на каждое нажатие, и рисовать заново по манекену на карточку — дорого. */
export function clothesIcon(item, size = 84) {
  return cachedIcon('clothes:' + item.id, size, size, (ctx) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, size, size);
    ctx.clip();
    if (item.slot === 'feet') {
      // обувь — пара на лапках, крупно по центру (на манекене её почти закрывает туловище)
      const s = size / (item.kind === 'flippers' ? 54 : 44); // ласты шире
      drawShoePair(ctx, size / 2, size / 2 + 6 * s, s, item);
      ctx.restore();
      return;
    }
    const look = { ...MANNEQUIN, outfit: { [item.slot]: item } };
    // s — масштаб, top — какая высота хомячка у верхнего края карточки
    let s = size / 86,
      top = -82; // целиком: от ушей (-80) до подола пачки и платья принцессы (+4)
    if (item.slot === 'head') {
      const tall = TALL_HATS.includes(item.kind);
      s = size / (WIDE_HATS.includes(item.kind) ? 84 : tall ? 72 : 62);
      top = tall ? -116 : -106;
    } else if (item.slot === 'acc' && NECK_ACC.includes(item.kind)) {
      s = size / 78;
      top = -84;
    } else if (item.slot === 'acc' && FACE_ACC.includes(item.kind)) {
      s = size / 62;
      top = -86;
    } else if (item.slot === 'acc' && WIDE_ACC.includes(item.kind)) {
      s = size / 100;
      top = -90;
    }
    drawHamster(ctx, size / 2, -top * s, s, look, { shadow: false });
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
