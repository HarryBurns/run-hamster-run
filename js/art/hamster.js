// Рисование хомячка: тело, мордочка, поза (ходьба, сон, сидя, чих…) и портрет. Начало координат — между лапками
// (на полу). При масштабе 1 хомячок ростом около 85 px. Одежда и обувь — art/hamster_wear.js, шапки и
// аксессуары — art/hamster_hats.js.
import { TAU } from '../core/util.js';
import { ell, line, poly, shade } from '../core/draw.js';
import { OUT, bodyPath, sleevesOf, drawLegs, drawBody, collar, drawFeet } from './hamster_wear.js';
import { drawHat, drawAccBack, drawAcc } from './hamster_hats.js';
export { drawShoePair } from './hamster_wear.js';

const BACK_ACC = ['wings', 'backpack', 'cape', 'pickaxe']; // аксессуары, которые рисуются за спиной
const FACE_ACC = ['glasses', 'sunglasses']; // аксессуары на мордочке: поворачиваются вместе с ней
// Аксессуары на груди: рисуются поверх одежды, но ДО головы — висят из-под подбородка (его низ: y = -29),
// а не лежат на мордочке. Шарф — исключение: он обмотан вокруг шеи и рисуется поверх подбородка.
const CHEST_ACC = [
  'necklace',
  'bag',
  'bowtie',
  'tie',
  'lei',
  'camera',
  'medal',
  'waterpistol',
  'nutbadge',
  'fan',
  'balloon',
];

/**
 * Насколько закрыты глаза в момент времени t: 0 — открыты, 1 — закрыты.
 * Моргание длится около 0.2 с и плавно закрывает и открывает глаз. phase — свой сдвиг у каждого
 * персонажа (чтобы не моргали хором); от положения на карте моргание не зависит.
 */
export function blinkAt(t, phase = 0) {
  const c = (t + phase * 1.37) % 3.7;
  return c > 3.5 ? Math.sin(((c - 3.5) / 0.2) * Math.PI) : 0;
}

function headPath(ctx, g = 0) {
  ctx.beginPath();
  ctx.ellipse(0, -52, 27 + g, 23 + g, 0, 0, TAU);
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
 *               kick: фаза 0..1 — сидит и болтает ногами (лапки по очереди приподнимаются; без walk),
 *               sneeze: 0..1 — чихает (0–0,45 «а-а-а…», 0,45–0,85 «апчхи!»), null — нет,
 *               fan: время — обмахивается правой лапкой у мордочки (жара в пустыне),
 *               grip: true — висит, держась обеими лапками за лиану над головой (лапки вверх, вместе)}
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
  // kick — сидит и болтает ногами (скамейка, этап 17а): лапки по очереди приподнимаются, тело не качается
  const kick = !walking && typeof pose.kick === 'number' ? pose.kick : null;
  const liftL = walking
    ? Math.max(0, Math.sin(t * TAU)) * 5
    : kick !== null
      ? Math.max(0, Math.sin(kick * TAU)) * 5
      : 0;
  const liftR = walking
    ? Math.max(0, -Math.sin(t * TAU)) * 5
    : kick !== null
      ? Math.max(0, -Math.sin(kick * TAU)) * 5
      : 0;
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
    if (pose.grip) {
      ctx.restore(); // висит на лапках: лапки рисуются поверх головы — в самом конце (gripArms)
      continue;
    } else if (pose.armsUp) {
      ctx.translate(sx * 25, -42);
      ctx.rotate(sx * 2.4);
    } else if (typeof pose.fan === 'number' && sx === 1) {
      // обмахивается: правая лапка у щеки машет туда-сюда, как веером
      ctx.translate(24, -40);
      ctx.rotate(2.2 + Math.sin(pose.fan * 14) * 0.45);
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
  if (pose.grip) gripArms(ctx, fur, o.body);

  ctx.restore();
}
/**
 * Висит на лапках (Дж8): обе лапки тянутся от плеч вверх вдоль щёк, ладошки сжимают лиану над макушкой (точка
 * (0, −96) в единицах хомячка — к ней и крепят лиану). Рисуется поверх головы, рукава — цветом одежды.
 */
function gripArms(ctx, fur, body) {
  const sl = sleevesOf(body),
    col = sl ? (body.kind === 'overall' ? body.c2 || '#fff' : body.c) : null;
  for (const sx of [-1, 1]) {
    const pts = [sx * 24, -32, sx * 25, -62, sx * 7, -92];
    ctx.lineCap = 'round';
    for (const [w, c] of [
      [12.5, OUT],
      [9.5, fur],
    ]) {
      ctx.strokeStyle = c;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(pts[0], pts[1]);
      ctx.quadraticCurveTo(pts[2], pts[3], pts[4], pts[5]);
      ctx.stroke();
    }
    if (col) {
      ctx.strokeStyle = col;
      ctx.lineWidth = 9.5;
      ctx.beginPath();
      ctx.moveTo(pts[0], pts[1]);
      ctx.lineTo(sx * 24.6, sl === 'long' ? -56 : -42);
      ctx.stroke();
    }
    ell(ctx, sx * 6, -94, 6, 5.5, fur, OUT, 1.6); // ладошка
  }
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
