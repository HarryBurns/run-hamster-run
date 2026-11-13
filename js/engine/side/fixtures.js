// «Движок домов», часть 2: встроенные предметы — то, что нельзя переставить, но с чем можно играть:
// дверь, туалет, раковина, кухня, ванна, сауна, джакузи, бассейн. Каждый — готовый «кубик» со своим рисунком
// и поведением; в описании дома достаточно написать { type: 'bathtub', f: 1, x: 1490 }.
//
// Запись в описании дома (поле built):
//   { type, f, x }                 тип из FIXTURES, этаж, центр по x
//   { …, id, w, h, act }           необязательно: своё имя, свой размер зоны нажатия, своё действие из реестра
//   { type: 'zone', f, x, w, h, act: 'cook' }   просто место нажатия без рисунка
//
// Тип предмета (значение в FIXTURES):
//   w, h              зона нажатия: x ± w/2, от пола вверх на h
//   act               действие из реестра (core/registry.js), если предмет открывает окно или ведёт куда-то
//   use(sc, b)        или своё поведение: sc — сцена дома, b — предмет из описания
//   state, pose       в какое состояние переходит хомячок и как его рисовать: pose(base, p, t) → { dy, pose }
//   whileUsed(sc, b, dt)   каждый шаг, пока хомячок в этом предмете (пузырьки, плавание)
//   ambient(sc, b, dt)     каждый шаг всегда (джакузи бурлит)
//   back / front(ctx, o, y, t, sc, b)   рисунок позади и поверх хомячка
//   zones             несколько зон нажатия у одного рисунка (кухня: плита и мойка)
//   order             порядок рисования (меньше — раньше), по умолчанию 0
//
// Рисунки сделаны «по чертежу виллы»: числа — координаты x на вилле, а o — сдвиг предмета относительно
// того места (o = b.x − ref). Так картинка виллы осталась точь-в-точь прежней, а в другом доме предмет
// просто стоит со сдвигом. y — пол этажа.
import { clamp, rnd } from '../../core/util.js';
import { ell, fillRR, line, rr } from '../../core/draw.js';
import { sfx } from '../../core/audio.js';
import { emit } from '../../core/events.js';
import { toast } from '../../ui/toast.js';
import { OUT } from './rooms.js';

// ---------- общее поведение ----------
function wash(sc, b) {
  sfx('splash');
  sc.burst(b.x, sc.geo.fy(b.f) - 100, 'bubble', 6);
  toast('Лапки чистые! 🫧');
}
/** Пузырьки вокруг хомячка, пока он в ванне или джакузи. */
function soakBubbles(sc, b, dt) {
  const p = sc.p;
  if (Math.random() < dt * 5)
    sc.parts.push({
      x: p.x + rnd(-70, 70),
      y: sc.geo.fy(p.f) - 70,
      vx: rnd(-10, 10),
      vy: rnd(-45, -20),
      life: 1.2,
      t: 0,
      kind: 'bubble',
      r: rnd(4, 10),
    });
}
const soakPose = (dy) => (base) => ({ dy, pose: { ...base, clipBelow: -36, happy: true } });

function drawSink(ctx, sx, sy) {
  fillRR(ctx, sx - 28, sy - 204, 56, 70, 26, '#d0ebff', OUT);
  line(ctx, sx - 10, sy - 190, sx + 4, sy - 176, 'rgba(255,255,255,.9)', 4);
  fillRR(ctx, sx - 8, sy - 66, 16, 66, 4, '#fff', OUT);
  fillRR(ctx, sx - 32, sy - 86, 64, 26, 12, '#fff', OUT);
  line(ctx, sx, sy - 86, sx, sy - 102, '#adb5bd', 5);
  line(ctx, sx, sy - 102, sx + 12, sy - 102, '#adb5bd', 5);
}

export const FIXTURES = {
  /** Просто место нажатия: размер и действие задаёт описание дома. */
  zone: { w: 80, h: 110 },

  /** Входная дверь: выход из дома (куда — решает сцена: desc.exit или «туда, откуда пришли»). */
  door: {
    ref: 285,
    w: 96,
    h: 176,
    use(sc) {
      sfx('door');
      sc.exit();
    },
    back(ctx, o, y) {
      fillRR(ctx, o + 237, y - 176, 96, 176, 8, '#8d5524', OUT);
      fillRR(ctx, o + 245, y - 168, 80, 168, 5, '#e8590c', OUT, 1.5);
      fillRR(ctx, o + 259, y - 152, 52, 50, 24, '#d0ebff', OUT, 1.5);
      ell(ctx, o + 314, y - 82, 5, 5, '#ffd43b', OUT, 1.5);
      fillRR(ctx, o + 230, y - 6, 110, 10, 4, '#51cf66', OUT, 1.5);
    },
  },

  toilet: {
    ref: 62,
    w: 76,
    h: 100,
    use(sc, b) {
      sfx('flush');
      sc.burst(b.x, sc.geo.fy(b.f) - 90, 'spark', 5);
      toast('Пш-ш-ш! 🚽');
    },
    back(ctx, o, y) {
      fillRR(ctx, o + 30, y - 100, 44, 52, 8, '#fff', OUT);
      fillRR(ctx, o + 38, y - 44, 50, 14, 6, '#fff', OUT);
      ctx.beginPath();
      ctx.moveTo(o + 36, y - 34);
      ctx.lineTo(o + 96, y - 34);
      ctx.quadraticCurveTo(o + 92, y - 8, o + 70, y - 6);
      ctx.lineTo(o + 50, y - 6);
      ctx.quadraticCurveTo(o + 38, y - 12, o + 36, y - 34);
      ctx.closePath();
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 2;
      ctx.stroke();
      fillRR(ctx, o + 48, y - 8, 30, 8, 3, '#fff', OUT);
      ell(ctx, o + 66, y - 88, 4, 4, '#adb5bd', OUT, 1);
      fillRR(ctx, o + 6, y - 150, 16, 34, 4, '#fff', OUT, 1.5); // рулон
    },
  },

  /** Раковина с зеркалом. */
  sink: {
    w: 70,
    h: 110,
    order: -1,
    use: wash,
    back(ctx, o, y, t, sc, b) {
      drawSink(ctx, b.x, y);
    },
  },

  /** Кухня: шкафчики, столешница с плитой и мойкой. Две зоны нажатия: плита (готовка) и мойка. */
  kitchen: {
    ref: 1225,
    zones: [
      { id: 'stove', dx: -105, w: 120, h: 110, act: 'cook' },
      { id: 'sink', dx: 75, w: 110, h: 110, use: wash },
    ],
    back(ctx, o, y, t) {
      fillRR(ctx, o + 1050, y - 236, 160, 70, 8, '#fff', OUT);
      line(ctx, o + 1130, y - 236, o + 1130, y - 166, OUT, 1.5);
      ell(ctx, o + 1120, y - 200, 3, 3, '#ffd43b', OUT, 1);
      ell(ctx, o + 1140, y - 200, 3, 3, '#ffd43b', OUT, 1);
      fillRR(ctx, o + 1230, y - 236, 150, 70, 8, '#fff', OUT);
      line(ctx, o + 1305, y - 236, o + 1305, y - 166, OUT, 1.5);
      fillRR(ctx, o + 1050, y - 88, 350, 88, 8, '#ff8787', OUT);
      fillRR(ctx, o + 1044, y - 98, 362, 14, 5, '#f8f9fa', OUT);
      fillRR(ctx, o + 1066, y - 78, 108, 70, 6, '#f1f3f5', OUT);
      fillRR(ctx, o + 1078, y - 56, 84, 40, 5, '#343a40', OUT, 1.5);
      for (let i = 0; i < 4; i++) ell(ctx, o + 1080 + i * 27, y - 68, 4, 4, '#ff6b6b', OUT, 1);
      fillRR(ctx, o + 1088, y - 104, 26, 6, 2, '#343a40');
      fillRR(ctx, o + 1128, y - 104, 26, 6, 2, '#343a40');
      fillRR(ctx, o + 1122, y - 128, 38, 24, 5, '#74c0fc', OUT);
      line(ctx, o + 1160, y - 118, o + 1176, y - 122, OUT, 4); // кастрюлька
      if (Math.sin(t * 2) > 0) {
        ctx.globalAlpha = 0.5;
        ell(ctx, o + 1141, y - 140 - ((t * 20) % 16), 6, 6, '#fff');
        ctx.globalAlpha = 1;
      }
      for (const dx of [1196, 1290]) {
        fillRR(ctx, o + dx, y - 78, 86, 70, 6, '#ffa8a8', OUT, 1.5);
        ell(ctx, o + dx + 43, y - 62, 3, 3, '#fff', OUT, 1);
      }
      fillRR(ctx, o + 1262, y - 104, 76, 8, 3, '#ced4da', OUT, 1.5);
      line(ctx, o + 1300, y - 104, o + 1300, y - 128, '#adb5bd', 5);
      line(ctx, o + 1300, y - 128, o + 1316, y - 128, '#adb5bd', 5);
    },
  },

  /** Ванна с душем: хомячок сидит в пене. */
  bathtub: {
    ref: 1490,
    w: 196,
    h: 100,
    state: 'bath',
    use(sc, b) {
      sc.settle('bath', b, b.x);
      sfx('splash');
      emit('spa', { what: 'bath' });
      toast('Ванна с пеной! 🛁');
    },
    pose: soakPose(-20),
    whileUsed: soakBubbles,
    back(ctx, o, y) {
      line(ctx, o + 1580, y - 210, o + 1580, y - 60, '#adb5bd', 5);
      line(ctx, o + 1580, y - 210, o + 1550, y - 210, '#adb5bd', 5);
      fillRR(ctx, o + 1532, y - 214, 26, 12, 5, '#adb5bd', OUT, 1.5);
      fillRR(ctx, o + 1395, y - 76, 190, 62, 26, '#fff', OUT);
    },
    front(ctx, o, y, t, sc, b) {
      ctx.beginPath();
      ctx.moveTo(o + 1392, y - 70);
      ctx.lineTo(o + 1588, y - 70);
      ctx.quadraticCurveTo(o + 1586, y - 12, o + 1550, y - 12);
      ctx.lineTo(o + 1430, y - 12);
      ctx.quadraticCurveTo(o + 1394, y - 12, o + 1392, y - 70);
      ctx.closePath();
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 2;
      ctx.stroke();
      fillRR(ctx, o + 1386, y - 80, 208, 14, 7, '#fff', OUT);
      ell(ctx, o + 1420, y - 6, 10, 7, '#ffd43b', OUT, 1.5);
      ell(ctx, o + 1560, y - 6, 10, 7, '#ffd43b', OUT, 1.5);
      if (sc.using(b))
        for (let i = 0; i < 9; i++)
          ell(ctx, o + 1404 + i * 22, y - 84 + Math.sin(t * 2 + i) * 3, 13, 11, '#fff', '#dbe4ff', 1.5);
    },
  },

  /** Сауна: скамьи, печка, термометр. Хомячок сидит на верхней скамье, идёт пар. */
  sauna: {
    ref: 190,
    w: 240,
    h: 170,
    state: 'sauna',
    use(sc, b) {
      sc.settle('sauna', b, b.x + 20);
      sfx('hiss');
      emit('spa', { what: 'sauna' });
      toast('Ух, жарко! 🧖');
    },
    pose: (base) => ({ dy: -74, pose: { ...base, sit: true, shadow: false } }),
    whileUsed(sc, b, dt) {
      const o = b.x - 190;
      if (Math.random() < dt * 4)
        sc.parts.push({
          x: rnd(o + 40, o + 300),
          y: sc.geo.fy(b.f) - rnd(40, 120),
          vx: rnd(-8, 8),
          vy: rnd(-40, -20),
          life: 1.8,
          t: 0,
          kind: 'steam',
          r: rnd(14, 26),
        });
    },
    back(ctx, o, y, t, sc, b) {
      fillRR(ctx, o + 70, y - 150, 232, 14, 4, '#b9834f', OUT);
      fillRR(ctx, o + 70, y - 136, 232, 60, 3, '#c98b5a', OUT, 1.5);
      fillRR(ctx, o + 40, y - 74, 262, 14, 4, '#b9834f', OUT);
      fillRR(ctx, o + 48, y - 60, 254, 60, 3, '#c98b5a', OUT, 1.5);
      fillRR(ctx, o + 8, y - 50, 44, 50, 5, '#495057', OUT);
      for (let i = 0; i < 3; i++) ell(ctx, o + 18 + i * 12, y - 54, 8, 6, '#868e96', OUT, 1.5);
      ell(ctx, o + 30, y - 30, 8, 8, sc.using(b) ? '#ff6b6b' : '#e8590c');
      fillRR(ctx, o + 270, y - 212, 34, 44, 6, '#fff', OUT, 1.5);
      ell(ctx, o + 287, y - 190, 11, 11, '#ffe3e3', OUT, 1);
      line(ctx, o + 287, y - 190, o + 287 + Math.cos(-1) * 8, y - 190 + Math.sin(-1) * 8, '#e03131', 2); // термометр
    },
  },

  /** Джакузи: бурлит всегда, хомячок сидит в пузырьках. */
  jacuzzi: {
    ref: 520,
    w: 280,
    h: 90,
    state: 'jacuzzi',
    use(sc, b) {
      sc.settle('jacuzzi', b, b.x);
      sfx('bubble');
      emit('spa', { what: 'jacuzzi' });
      toast('Буль-буль-буль! 🫧');
    },
    pose: soakPose(-14),
    whileUsed: soakBubbles,
    ambient(sc, b, dt) {
      if (Math.random() < dt * 2)
        sc.parts.push({
          x: b.x + rnd(-110, 110),
          y: sc.geo.fy(b.f) - 66,
          vx: 0,
          vy: rnd(-30, -12),
          life: 0.8,
          t: 0,
          kind: 'bubble',
          r: rnd(3, 6),
        });
    },
    back(ctx, o, y) {
      fillRR(ctx, o + 380, y - 78, 280, 74, 30, '#fff', OUT);
    },
    front(ctx, o, y, t) {
      ctx.fillStyle = 'rgba(116,192,252,.75)';
      rr(ctx, o + 392, y - 66, 256, 30, 10);
      ctx.fill();
      for (let i = 0; i < 7; i++)
        ell(
          ctx,
          o + 410 + i * 36 + Math.sin(t * 3 + i * 2) * 6,
          y - 64 + Math.cos(t * 4 + i) * 2,
          7,
          5,
          'rgba(255,255,255,.85)',
        );
      fillRR(ctx, o + 372, y - 52, 296, 52, 22, '#fff', OUT);
      fillRR(ctx, o + 366, y - 62, 308, 16, 8, '#ffd8a8', OUT);
      for (let i = 0; i < 5; i++) ell(ctx, o + 420 + i * 50, y - 26, 6, 6, '#d0ebff', OUT, 1.2);
      fillRR(ctx, o + 674, y - 26, 44, 26, 4, '#ffd8a8', OUT, 1.5);
      fillRR(ctx, o + 674, y - 48, 24, 24, 4, '#ffd8a8', OUT, 1.5); // ступеньки
    },
  },

  /** Большой бассейн: хомячок плавает от бортика к бортику, пока не выйдет. */
  pool: {
    ref: 1150,
    w: 770,
    h: 90,
    state: 'swim',
    use(sc, b) {
      sc.settle('swim', b, clamp(sc.p.x, b.x - b.w / 2 + 60, b.x + b.w / 2 - 60));
      sfx('splash');
      emit('homeswim');
    },
    pose: (base, p, t) => ({ dy: -6, pose: { ...base, clipBelow: -38, walk: p.walkT + t } }),
    whileUsed(sc, b, dt) {
      const p = sc.p;
      p.swimDir = p.swimDir || 1;
      if (!p.moving) {
        p.x += p.swimDir * 70 * dt;
        p.dir = p.swimDir;
      }
      if (p.x > b.x + b.w / 2 - 60) p.swimDir = -1;
      if (p.x < b.x - b.w / 2 + 60) p.swimDir = 1;
      if (p.x < b.x - b.w / 2 + 20 || p.x > b.x + b.w / 2 - 20) sc.standUp(); // вышла из воды
      if (Math.random() < dt * 3)
        sc.parts.push({
          x: p.x + rnd(-30, 30),
          y: sc.geo.fy(b.f) - 62,
          vx: rnd(-20, 20),
          vy: rnd(-50, -20),
          life: 0.6,
          t: 0,
          kind: 'bubble',
          r: rnd(3, 6),
        });
    },
    back(ctx, o, y) {
      fillRR(ctx, o + 765, y - 86, 770, 86, 12, '#e7f5ff', OUT);
      for (let xx = o + 790; xx < o + 1520; xx += 44) line(ctx, xx, y - 80, xx, y - 6, 'rgba(116,192,252,.35)', 2);
      line(ctx, o + 1500, y - 150, o + 1500, y - 30, '#adb5bd', 5);
      line(ctx, o + 1522, y - 150, o + 1522, y - 30, '#adb5bd', 5);
      for (let i = 0; i < 4; i++) line(ctx, o + 1500, y - 136 + i * 24, o + 1522, y - 136 + i * 24, '#adb5bd', 4);
      ell(ctx, o + 830, y - 100, 22, 9, '#ff6b6b', OUT);
      ell(ctx, o + 830, y - 100, 10, 4, '#e7f5ff', OUT, 1.5); // круг
    },
    front(ctx, o, y, t) {
      ctx.fillStyle = 'rgba(77,171,247,.62)';
      rr(ctx, o + 771, y - 62, 758, 58, 6);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let xx = 771; xx <= 1529; xx += 12) {
        const yy = y - 62 + Math.sin(xx * 0.05 + t * 2.4) * 2.5;
        if (xx === 771) ctx.moveTo(o + xx, yy);
        else ctx.lineTo(o + xx, yy);
      }
      ctx.stroke();
      rr(ctx, o + 765, y - 86, 770, 86, 12);
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 2;
      ctx.stroke();
      fillRR(ctx, o + 758, y - 12, 784, 12, 5, '#74c0fc', OUT);
    },
  },
};

/**
 * Развернуть поле built из описания дома в список предметов для сцены:
 * у каждого — def (тип), зоны нажатия (zones: [{ id, f, x, w, h, act, use, fix }]) и порядок рисования.
 */
export function buildFixtures(list = []) {
  const fixtures = [],
    zones = [];
  list.forEach((b, i) => {
    const def = FIXTURES[b.type || 'zone'];
    if (!def) throw new Error(`Дом: неизвестный встроенный предмет «${b.type}»`);
    const fix = { ...b, def, w: b.w || def.w, h: b.h || def.h, id: b.id || `${b.type || 'zone'}${i}`, idx: i };
    fixtures.push(fix);
    if (def.zones) {
      for (const z of def.zones)
        zones.push({ id: `${fix.id}.${z.id}`, f: b.f, x: b.x + z.dx, w: z.w, h: z.h, act: z.act, use: z.use, fix });
    } else if (b.act || def.act || def.use) {
      zones.push({
        id: fix.id,
        f: b.f,
        x: b.x,
        w: fix.w,
        h: fix.h,
        act: b.act || def.act,
        use: b.act ? null : def.use,
        fix,
      });
    }
  });
  const drawOrder = fixtures.slice().sort((a, b) => (a.def.order || 0) - (b.def.order || 0) || a.idx - b.idx);
  return { fixtures, zones, drawOrder };
}
