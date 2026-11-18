// Живая заставка: берег моря с пальмами, хомячок и всё, что можно потрогать. Время суток и погода приходят
// снаружи (как в последней игре) и на заставке не меняются. Мышь и касание — одни и те же события указателя.
//
// Рисование: небо, море и песок без движения лежат в кэше (bg), каждый кадр поверх — волны, облака, пальмы,
// зверьки и погода. Что можно трогать — см. down() ниже: порядок проверок там и есть «кто ближе к зрителю».
import { TAU, clamp, lerp, rnd, pick, seeded } from '../core/util.js';
import { mix, shade } from '../core/draw.js';
import { drawHamster, blinkAt } from '../art/hamster.js';
import { sfx } from '../core/audio.js';
import { paintDolphin } from '../locations/cove_art.js';

const ease = (t) => t * t * (3 - 2 * t);
const bell = (t) => Math.sin(clamp(t, 0, 1) * Math.PI);

// Облако — восемь «комков»; фигуры (зайчик, рыбка, хомячок) — те же восемь комков на других местах
const CLOUD_SHAPES = {
  cloud: { puffs: [[-1.4, 0.2, 0.7], [-0.6, -0.2, 0.9], [0.3, -0.35, 1], [1.1, 0, 0.8], [1.7, 0.3, 0.55], [0, 0.3, 0.9], [-0.9, 0.35, 0.7], [0.8, 0.35, 0.7]], eyes: [] }, // prettier-ignore
  bunny: { puffs: [[0.2, 0.3, 1], [-1, -0.3, 0.7], [-1.25, -1.2, 0.32], [-1.2, -1.7, 0.28], [-0.8, -1.25, 0.3], [-0.68, -1.75, 0.27], [1.3, 0.3, 0.42], [-0.5, 0.9, 0.42]], eyes: [[-1.2, -0.4]] }, // prettier-ignore
  fish: { puffs: [[-0.5, 0, 0.9], [0.3, 0, 0.85], [-1.2, 0, 0.55], [0.95, 0, 0.5], [1.65, -0.5, 0.5], [1.65, 0.5, 0.5], [-0.2, -0.85, 0.4], [1.3, 0, 0.3]], eyes: [[-1.25, -0.12]] }, // prettier-ignore
  hamster: { puffs: [[0, 0.5, 1.05], [0, -0.6, 0.85], [-0.65, -1.3, 0.35], [0.65, -1.3, 0.35], [-0.75, -0.35, 0.5], [0.75, -0.35, 0.5], [-0.8, 1.2, 0.35], [0.8, 1.2, 0.35]], eyes: [[-0.3, -0.75], [0.3, -0.75]] }, // prettier-ignore
};
const CLOUD_ORDER = ['cloud', 'bunny', 'fish', 'hamster'];

let starShown = false; // падающая звезда — не больше одной за запуск страницы

/**
 * @param canvas  канва во весь экран заставки
 * @param o       { minutes, weather: sun|rain|snow|petals|leaves, season: winter|spring|summer|autumn, look, free }
 *                free() → { x, y, w, h } — место на экране, не занятое заголовком и кнопками (в CSS-пикселях)
 */
export function createTitleScene(canvas, o) {
  const ctx = canvas.getContext('2d');
  const weather = o.weather || 'sun',
    season = o.season || 'summer';
  const m = Number.isFinite(o.minutes) ? o.minutes : 12 * 60;
  const dk = clamp((m - 18 * 60) / (3.5 * 60), 0, 1); // 0 — день, 1 — ночь (как darkness() в игре)
  const dusk = clamp(1 - Math.abs(m - 18.6 * 60) / 100, 0, 1); // закат
  const night = dk > 0.6,
    rain = weather === 'rain',
    snow = weather === 'snow',
    windy = weather === 'petals' || weather === 'leaves',
    winter = season === 'winter';
  const look = o.look;
  const log = []; // что уже потрогали (для автотеста и отладки)
  const note = (name) => {
    log.push(name);
    if (log.length > 60) log.shift();
  };

  let W = 0,
    H = 0,
    dpr = 1,
    bg = null;
  let F = { x: 0, y: 0, w: 0, h: 0 },
    k = 1, // общий масштаб предметов (1 — на экране компьютера)
    hy = 0, // горизонт
    sy = 0, // кромка воды
    bot = 0; // низ свободного места
  let T = 0,
    last = 0,
    raf = 0,
    dead = false;

  // ---------- кто живёт на заставке ----------
  const ham = { x: 0, y: 0, s: 2, st: 'idle', t: 0, press: null, alt: 0, bubble: null, hop: 0, dir: 0 };
  const palms = [
    { fx: 0.13, fy: 0.22, size: 1, bend: 0, vel: 0, drag: false, nuts: [1, 1, 1], lean: 1 },
    { fx: 0.9, fy: 0.08, size: 0.72, bend: 0, vel: 0, drag: false, nuts: [], lean: -1 },
  ];
  const nuts = []; // кокосы, которые упали: { x, y, vx, vy, floor, rot, born }
  const crab = { hx: 0, hy: 0, x: 0, y: 0, st: 'walk', t: 0, dir: 1, tx: 0 };
  const gull = { x: 0, y: 0, hx: 0, hy: 0, st: 'stand', t: 0 };
  const feathers = [];
  const shell = { x: 0, y: 0, st: 'sand', t: 0 };
  const clouds = [0, 1, 2].map((i) => ({ fx: 0.12 + i * 0.36, fy: [0.3, 0.75, 0.45][i], size: [1, 0.75, 0.9][i], shape: 0, from: 0, t: 1, x: 0, y: 0 })); // prettier-ignore
  const ship = { x: -1, honk: -9, puffs: [] };
  const dolphin = { next: rnd(10, 22), t: -1, x: 0, hi: -9 };
  const jumps = []; // рыбки в прыжке: { x, y, t, dir, big }
  const rings = []; // круги на воде: { x, y, t }
  const fly = { x: 0, y: 0, st: 'roam', t: 0, ph: rnd(9), next: rnd(7, 12) }; // бабочка днём, светлячки ночью
  const kite = { loop: -9 };
  const snowman = { x: 0, y: 0, t: -9 };
  const wave = { t: -9, depth: 0, auto: 0 }; // большая волна на песок
  const strokes = []; // рисунок на песке: массивы точек
  let drawing = null,
    lastDraw = -99;
  const star = { t: -9, x: 0, y: 0, auto: rnd(16, 26) };
  const stars = [];
  const drops = []; // дождь, снег, лепестки, листья
  const texts = []; // надписи, всплывающие над сценой: { x, y, text, t, life, size }
  let grab = null; // что сейчас держит указатель

  const say = (text, life = 1.8) => {
    ham.bubble = { text, t: 0, life };
  };
  const pop = (x, y, text, size = 18, life = 1.6) => texts.push({ x, y, text, t: 0, life, size });

  // ---------- размеры и расстановка ----------
  function layout() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    while (W * H * dpr * dpr > 3.2e6 && dpr > 1) dpr -= 0.25; // большой экран — чуть мягче, зато не тормозит
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const f = (o.free && o.free()) || { x: 0, y: 0, w: W, h: H };
    F = { x: f.x, y: f.y, w: Math.max(120, f.w), h: Math.max(120, f.h) };
    ham.s = clamp(Math.min(F.w / 250, F.h / 250), 0.8, 2.5);
    k = ham.s / 2;
    bot = F.y + F.h;
    sy = F.y + F.h * 0.47;
    hy = Math.max(F.y + F.h * 0.2, sy - 150 * Math.max(k, 0.6));
    const band = bot - sy;
    const at = (fx, fy) => [F.x + F.w * fx, sy + band * fy];
    [ham.x, ham.y] = at(0.5, 0.66);
    for (const p of palms) {
      [p.x, p.y] = at(p.fx, p.fy);
      p.h = Math.min(300 * k * p.size, p.y - F.y - 30 * k);
    }
    [crab.hx, crab.hy] = at(0.74, 0.8);
    if (crab.st === 'walk') [crab.x, crab.y] = [crab.hx - 40 * k, crab.hy + 4 * k];
    [gull.hx, gull.hy] = at(0.68, 0.2);
    if (gull.st === 'stand') [gull.x, gull.y] = [gull.hx, gull.hy];
    if (shell.st === 'sand') [shell.x, shell.y] = at(0.27, 0.84);
    [snowman.x, snowman.y] = at(0.31, 0.42);
    for (const c of clouds) {
      c.x = W * c.fx;
      c.y = lerp(F.y + 26 * k, hy - 46 * k, c.fy);
    }
    if (ship.x < 0) ship.x = F.x + F.w * 0.58;
    stars.length = 0;
    const rs = seeded(7);
    for (let i = 0; i < 90; i++) {
      const x = rs() * W,
        y = rs() * (hy - 8),
        r = 0.6 + rs() * 1.3;
      if (palms.some((p) => Math.hypot(x - p.x - p.lean * p.h * 0.18, y - (p.y - p.h)) < p.h * 0.5)) continue;
      stars.push({ x, y, r, ph: rs() * 9 });
    }
    nuts.length = 0;
    strokes.length = 0;
    drops.length = 0;
    const n = Math.round(((W * H) / 9000) * (rain ? 1.1 : snow ? 0.8 : windy ? 0.28 : 0));
    for (let i = 0; i < Math.min(n, 220); i++) drops.push(newDrop(true));
    paintBg();
  }
  function newDrop(anywhere) {
    const d = { x: rnd(-40, W + 40), y: anywhere ? rnd(H) : -12, ph: rnd(9), z: rnd(0.6, 1.2) };
    if (windy && !anywhere) {
      d.x = -20;
      d.y = rnd(H * 0.95);
    }
    d.c =
      weather === 'petals'
        ? pick(['#ffc9de', '#ffe3ec', '#ffb3c8'])
        : pick(['#f08c00', '#e8590c', '#fcc419', '#c2410c']);
    return d;
  }

  // ---------- то, что не движется: небо, море, песок ----------
  function paintBg() {
    bg = document.createElement('canvas');
    bg.width = canvas.width;
    bg.height = canvas.height;
    const c = bg.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const grey = rain ? 0.55 : snow ? 0.35 : 0;
    const top = mix(mix('#4fb4ff', '#5a78c8', dusk * 0.8), '#8fa0b4', grey),
      low = mix(mix('#cdeeff', '#ffb27a', dusk), '#c9d3de', grey);
    let g = c.createLinearGradient(0, 0, 0, hy);
    g.addColorStop(0, top);
    g.addColorStop(1, low);
    c.fillStyle = g;
    c.fillRect(0, 0, W, hy + 1);
    // солнце (ночью луну рисуем поверх затемнения — см. frame)
    if (dk < 0.45 && !rain && !snow) {
      const sx = F.x + F.w * 0.66,
        syy = lerp(F.y + 34 * k, hy - 26 * k, dusk);
      const gl = c.createRadialGradient(sx, syy, 4, sx, syy, 110 * k);
      gl.addColorStop(0, 'rgba(255,244,200,.85)');
      gl.addColorStop(1, 'rgba(255,244,200,0)');
      c.fillStyle = gl;
      c.fillRect(sx - 120 * k, syy - 120 * k, 240 * k, 240 * k);
      c.fillStyle = mix('#fff3b0', '#ff9d5c', dusk);
      c.beginPath();
      c.arc(sx, syy, 26 * k, 0, TAU);
      c.fill();
    }
    // далёкий остров на горизонте
    c.fillStyle = mix(mix('#7fb7c9', '#8d7fb0', dusk), '#9aa6b5', grey);
    c.beginPath();
    c.moveTo(F.x + F.w * 0.02, hy + 1);
    c.quadraticCurveTo(F.x + F.w * 0.1, hy - 30 * k, F.x + F.w * 0.19, hy - 10 * k);
    c.quadraticCurveTo(F.x + F.w * 0.25, hy - 22 * k, F.x + F.w * 0.33, hy + 1);
    c.fill();
    // море
    g = c.createLinearGradient(0, hy, 0, sy + 30 * k);
    g.addColorStop(0, mix(mix('#2f8fd8', '#4a6fb5', dusk * 0.7), '#6c8296', grey));
    g.addColorStop(1, mix(mix('#7fe3e2', '#f3b89a', dusk * 0.5), '#a9bcc4', grey));
    c.fillStyle = g;
    c.fillRect(0, hy, W, sy + 40 * k - hy);
    // песок (верхний край закрывает волна, поэтому начинаем чуть выше кромки)
    g = c.createLinearGradient(0, sy - 20 * k, 0, H);
    const s0 = mix(winter ? '#fff1cf' : '#ffe6a8', '#e9dcc3', grey * 0.6),
      s1 = mix(winter ? '#f3deb4' : '#f4c97c', '#d9c8a8', grey * 0.6);
    g.addColorStop(0, s0);
    g.addColorStop(1, s1);
    c.fillStyle = g;
    c.fillRect(0, sy - 20 * k, W, H - sy + 20 * k);
    const rs = seeded(11);
    for (let i = 0; i < (W * (H - sy)) / 900; i++) {
      c.fillStyle = rs() < 0.5 ? 'rgba(255,255,255,.35)' : 'rgba(190,140,70,.25)';
      c.fillRect(rs() * W, sy + 8 * k + rs() * (H - sy), 2, 2);
    }
    if (winter) {
      // зимой на песке лежит снежок
      c.fillStyle = 'rgba(255,255,255,.75)';
      for (let i = 0; i < 9; i++) {
        c.beginPath();
        c.ellipse(rs() * W, sy + (0.25 + rs() * 0.75) * (H - sy), (40 + rs() * 60) * k, (7 + rs() * 8) * k, 0, 0, TAU);
        c.fill();
      }
    }
    // норка краба
    c.fillStyle = 'rgba(120,80,40,.55)';
    c.beginPath();
    c.ellipse(crab.hx, crab.hy, 17 * k, 7 * k, 0, 0, TAU);
    c.fill();
  }

  // ---------- кромка воды ----------
  const surge = () => {
    const t = T - wave.t;
    if (t < 0 || t > 3.4) return 0;
    return wave.depth * (t < 1 ? ease(t) : t < 1.5 ? 1 : 1 - ease((t - 1.5) / 1.9));
  };
  const shoreY = (x, sg) =>
    sy + (Math.sin(x * 0.011 + T * 0.9) * 5 + Math.sin(x * 0.027 - T * 0.6) * 3 + Math.sin(T * 0.7) * 7) * k + sg;
  function bigWave(depth) {
    if (T - wave.t < 3.4) return;
    wave.t = T;
    wave.depth = depth;
    sfx('splash');
  }

  // ---------- что делает хомячок ----------
  function hamDo(st) {
    ham.st = st;
    ham.t = 0;
  }
  function hamTap() {
    ham.alt++;
    const special = ham.alt % 2 === 1; // через раз: особенное по погоде и времени, иначе — прыжок и «привет»
    if (rain && special) {
      hamDo('sneeze'); // «апчхи!» рисует сам хомячок (art/hamster.js)
      sfx('sneeze');
      note('sneeze');
    } else if (night && special) {
      hamDo('yawn');
      say('Уа-а-ах…', 1.7);
      note('yawn');
    } else {
      hamDo('jump');
      say(pick(['Привет!', 'Ура!', 'Давай играть!']), 1.2);
      sfx('pop');
      note('jump');
    }
  }

  // ---------- нажатия ----------
  const near = (x, y, ox, oy, r) => Math.hypot(x - ox, y - oy) < r;
  const crown = (p) => {
    const b = p.bend + sway(p);
    return [p.x + p.lean * p.h * 0.18 + b * p.h * 0.45, p.y - p.h + Math.abs(b) * p.h * 0.12];
  };
  const sway = (p) => (Math.sin(T * (windy ? 2.1 : 1.1) + p.fx * 9) * (windy ? 0.1 : rain ? 0.05 : 0.025)) / p.size;
  const hamTop = () => ham.y - (look && look.outfit && look.outfit.head ? 112 : 80) * ham.s;

  function down(x, y) {
    const R = 30 * Math.max(k, 0.7); // палец толще мышки: все цели не меньше этого
    // бабочка или светлячки
    if ((night || (!rain && !snow)) && near(x, y, fly.x, fly.y, R * 1.2)) {
      if (fly.st === 'sit') {
        fly.st = 'roam';
        fly.next = T + rnd(8, 14);
      } else {
        fly.st = 'go';
        note(night ? 'fireflies' : 'butterfly');
        sfx('ding');
      }
      return;
    }
    // хомячок: короткое нажатие — привет, долгое — танец
    if (Math.abs(x - ham.x) < 34 * ham.s && y < ham.y + 8 * ham.s && y > hamTop()) {
      ham.press = T;
      grab = { kind: 'ham' };
      return;
    }
    // упавший кокос — покатить ещё
    for (const n of nuts)
      if (n.vy === 0 && near(x, y, n.x, n.y - 9 * k, R)) {
        n.vx = (n.x >= x ? 1 : -1) * rnd(120, 190) * k;
        note('nut-roll');
        sfx('tap');
        return;
      }
    if (crab.st !== 'in' && near(x, y, crab.x, crab.y - 8 * k, R * 1.15)) return crabFlee();
    if (crab.st === 'in' && near(x, y, crab.hx, crab.hy, R)) {
      crab.t = 0; // выглянул — и спрятался снова
      return;
    }
    if (gull.st === 'stand' && near(x, y, gull.x, gull.y - 16 * k, R * 1.1)) return gullFly();
    if (shell.st === 'sand' && near(x, y, shell.x, shell.y - 6 * k, R)) {
      shell.st = 'go';
      shell.t = 0;
      note('shell');
      sfx('pop');
      return;
    }
    if (winter && near(x, y, snowman.x, snowman.y - 38 * k, R * 1.4)) {
      snowman.t = T;
      note('snowman');
      sfx('stepSnow');
      pop(snowman.x, snowman.y - 96 * k, 'Привет!', 16 * Math.max(k, 0.8));
      return;
    }
    if (windy) {
      const [kx, ky] = kitePos();
      if (near(x, y, kx, ky, R * 1.5)) {
        kite.loop = T;
        note('kite');
        sfx('flap');
        return;
      }
    }
    // пальма: потянуть — качнуть, нажать на крону — упадёт кокос
    for (const p of palms) {
      const [cx, cy] = crown(p);
      const onCrown = near(x, y, cx, cy, p.h * 0.34),
        onTrunk = Math.abs(x - lerp(p.x, cx, clamp((p.y - y) / p.h, 0, 1))) < 22 * k && y < p.y && y > cy;
      if (onCrown || onTrunk) {
        grab = { kind: 'palm', p, x0: x, bend0: p.bend, moved: false, onCrown };
        p.drag = true;
        return;
      }
    }
    for (const c of clouds)
      if (near(x, y, c.x, c.y, 62 * k * c.size)) {
        if (rain) {
          pop(c.x, c.y + 44 * k, 'Кап-кап!', 15 * Math.max(k, 0.8));
          return;
        }
        c.from = c.shape;
        c.shape = (c.shape + 1) % CLOUD_ORDER.length;
        c.t = 0;
        note('cloud-' + CLOUD_ORDER[c.shape]);
        sfx('pop');
        return;
      }
    if (near(x, y, ship.x, hy - 10 * k, R * 1.3)) {
      ship.honk = T;
      note('ship');
      sfx('lift');
      pop(ship.x, hy - 46 * k, 'Ту-ту-у!', 16 * Math.max(k, 0.8));
      return;
    }
    if (dolphin.t >= 0 && near(x, y, dolphin.x, hy + 14 * k, R * 1.6)) {
      dolphin.hi = T;
      note('dolphin');
      sfx('squeak');
      pop(dolphin.x, hy - 22 * k, '💙', 20 * Math.max(k, 0.8));
      return;
    }
    if (y < hy) {
      if (night) shootStar(x, y);
      return;
    }
    const sh = shoreY(x, 0);
    if (y < sh - 16 * k) {
      // море: выпрыгивает рыбка
      jumps.push({ x, y: Math.max(y, hy + 12 * k), t: 0, dir: pick([-1, 1]), s: clamp((y - hy) / (sy - hy), 0.35, 1) });
      rings.push({ x, y: Math.max(y, hy + 12 * k), t: 0 });
      note('fish');
      sfx('splash');
      return;
    }
    if (y < sh + 26 * k) {
      // кромка: набегает волна, хомячок отпрыгивает
      bigWave((ham.y - sy) * 0.8);
      note('wave');
      return;
    }
    // песок: рисуем
    drawing = [{ x, y }];
    strokes.push(drawing);
    grab = { kind: 'draw' };
    lastDraw = T;
    note('draw');
  }
  function move(x, y) {
    if (!grab) return;
    if (grab.kind === 'palm') {
      const dx = x - grab.x0;
      if (Math.abs(dx) > 8) grab.moved = true;
      if (grab.moved) grab.p.bend = clamp(grab.bend0 + dx / (grab.p.h * 0.6), -0.75, 0.75);
    } else if (grab.kind === 'draw' && drawing) {
      const q = drawing[drawing.length - 1];
      if (Math.hypot(x - q.x, y - q.y) > 5 && y > shoreY(x, 0) + 18 * k && drawing.length < 400) {
        drawing.push({ x, y });
        lastDraw = T;
      }
    }
  }
  function up() {
    const g = grab;
    grab = null;
    if (!g) return;
    if (g.kind === 'ham') {
      if (ham.st !== 'dance') hamTap();
      ham.press = null;
    } else if (g.kind === 'palm') {
      g.p.drag = false;
      if (g.moved) {
        note('palm-swing');
        sfx('paper');
        if (Math.abs(g.p.bend) > 0.5) dropNut(g.p);
      } else if (g.onCrown) dropNut(g.p);
    } else if (g.kind === 'draw') {
      drawing = null;
      lastDraw = T;
    }
  }

  function dropNut(p) {
    const i = p.nuts.findIndex((n) => n === 1);
    if (i < 0) return;
    p.nuts[i] = 0;
    setTimeout(() => {
      p.nuts[i] = 1;
    }, 7000);
    const [cx, cy] = crown(p);
    nuts.push({ x: cx + (i - 1) * 12 * k, y: cy + 14 * k, vx: p.lean * rnd(40, 80) * k, vy: 1, floor: p.y + rnd(18, 46) * k, rot: 0, born: T }); // prettier-ignore
    if (nuts.length > 5) nuts.shift();
    note('coconut');
    sfx('pop');
  }
  function crabFlee() {
    crab.st = 'flee';
    crab.t = 0;
    note('crab');
    sfx('tick');
  }
  function gullFly() {
    gull.st = 'away';
    gull.t = 0;
    feathers.push({ x: gull.x, y: gull.y - 40 * k, t: 0, floor: gull.y + 6 * k });
    note('gull');
    sfx('flap');
  }
  function shootStar(x, y) {
    if (starShown) return;
    starShown = true;
    star.t = T;
    star.x = clamp(x === undefined ? F.x + F.w * 0.3 : x, 60, W - 60);
    star.y = clamp(y === undefined ? F.y + 30 * k : y, 20, hy - 40 * k);
    note('star');
    sfx('magic');
  }
  const kitePos = () => {
    const lp = clamp((T - kite.loop) / 1.2, 0, 1),
      a = lp * TAU;
    return [
      F.x + F.w * 0.4 + Math.sin(T * 0.8) * 26 * k + Math.sin(a) * 46 * k,
      Math.max(F.y + 50 * k, hy - 120 * k) + Math.sin(T * 1.3) * 12 * k - (1 - Math.cos(a)) * 30 * k,
    ];
  };

  // ---------- шаг времени ----------
  function update(dt) {
    // хомячок
    ham.t += dt;
    if (ham.press !== null && ham.st !== 'dance' && T - ham.press > 0.45) {
      hamDo('dance');
      say('Танцуем!', 1.4);
      note('dance');
      sfx('win');
    }
    const lim = { jump: 1.1, sneeze: 1.25, yawn: 1.8, hop: 1.5, listen: 3.2 }[ham.st];
    if (lim && ham.t > lim) hamDo('idle');
    if (ham.st === 'dance' && ham.press === null && ham.t > 2.4) hamDo('idle');
    if (ham.bubble && (ham.bubble.t += dt) > ham.bubble.life) ham.bubble = null;
    // большая волна: смывает рисунок, хомячок отпрыгивает
    const sg = surge();
    if (sg > 0) {
      for (const st of strokes)
        for (let i = st.length - 1; i >= 0; i--) if (st[i].y < shoreY(st[i].x, sg) + 6 * k) st.splice(i, 1);
      for (let i = strokes.length - 1; i >= 0; i--)
        if (!strokes[i].length && strokes[i] !== drawing) strokes.splice(i, 1);
      if (ham.st !== 'hop' && sg > (ham.y - sy) * 0.66 && T - wave.t < 1) {
        hamDo('hop');
        say('Ой, мокро!', 1.3);
      }
    }
    if (strokes.length && !drawing && T - lastDraw > 6) {
      // рисунок полежал — приходит волна и смывает его
      let deep = 0;
      for (const st of strokes) for (const q of st) deep = Math.max(deep, q.y);
      bigWave(deep - sy + 24 * k);
      lastDraw = T;
    }
    // пальмы: пружинка
    for (const p of palms) {
      if (p.drag) continue;
      p.vel += (-p.bend * 26 - p.vel * 2.2) * dt;
      p.bend += p.vel * dt;
    }
    // кокосы
    for (const n of nuts) {
      if (n.vy !== 0) {
        n.vy += 900 * k * dt;
        n.y += n.vy * dt;
        n.x += n.vx * 0.3 * dt;
        if (n.y >= n.floor) {
          n.y = n.floor;
          if (n.vy > 160 * k) {
            n.vy = -n.vy * 0.32;
            sfx('thud');
          } else {
            n.vy = 0;
            n.vx = (n.vx >= 0 ? 1 : -1) * rnd(90, 150) * k;
          }
        }
      } else if (n.vx) {
        n.x += n.vx * dt;
        n.rot += (n.vx * dt) / (9 * k);
        n.vx *= Math.pow(0.22, dt);
        if (Math.abs(n.vx) < 6 * k) n.vx = 0;
        if (n.x < 14 * k || n.x > W - 14 * k) n.vx = -n.vx;
      }
    }
    // краб
    crab.t += dt;
    if (crab.st === 'walk') {
      if (Math.abs(crab.x - crab.tx) < 3 * k || crab.t > 6) {
        crab.tx = crab.hx + rnd(-90, 60) * k;
        crab.t = 0;
      }
      crab.dir = crab.tx > crab.x ? 1 : -1;
      if (crab.t > 1.2) crab.x += crab.dir * 16 * k * dt;
      crab.y = crab.hy + 5 * k;
    } else if (crab.st === 'flee') {
      const dx = crab.hx - crab.x;
      crab.dir = dx > 0 ? 1 : -1;
      crab.x += crab.dir * Math.min(Math.abs(dx), 210 * k * dt);
      crab.y = lerp(crab.y, crab.hy, 0.2);
      if (Math.abs(dx) < 2 * k) {
        crab.st = 'in';
        crab.t = 0;
      }
    } else if (crab.st === 'in' && crab.t > 6.5) {
      crab.st = 'walk';
      crab.t = 0;
      crab.x = crab.hx - 4 * k;
      crab.tx = crab.hx - 50 * k;
    }
    // чайка
    gull.t += dt;
    if (gull.st === 'away') {
      gull.x += 150 * k * dt;
      gull.y -= 120 * k * dt;
      if (gull.t > 7) {
        gull.st = 'back';
        gull.t = 0;
        gull.x = gull.hx - 300 * k;
        gull.y = gull.hy - 230 * k;
      }
    } else if (gull.st === 'back') {
      const q = clamp(gull.t / 2.2, 0, 1);
      gull.x = lerp(gull.hx - 300 * k, gull.hx, ease(q));
      gull.y = lerp(gull.hy - 230 * k, gull.hy, ease(q));
      if (q >= 1) gull.st = 'stand';
    }
    for (let i = feathers.length - 1; i >= 0; i--) {
      const f = feathers[i];
      f.t += dt;
      if (f.y < f.floor) {
        f.y += 34 * k * dt;
        f.x += Math.sin(f.t * 3) * 30 * k * dt;
      }
      if (f.t > 10) feathers.splice(i, 1);
    }
    // ракушка
    if (shell.st !== 'sand') {
      shell.t += dt;
      if (shell.st === 'go' && shell.t > 0.5) {
        shell.st = 'ear';
        shell.t = 0;
        hamDo('listen');
        say('Ш-ш-ш… море шумит!', 2.6);
        sfx('paddle');
      } else if (shell.st === 'ear' && shell.t > 2.9) {
        shell.st = 'back';
        shell.t = 0;
      } else if (shell.st === 'back' && shell.t > 0.5) {
        shell.st = 'sand';
        const band = bot - sy;
        shell.x = F.x + F.w * 0.27;
        shell.y = sy + band * 0.84;
      }
    }
    // облака и кораблик плывут
    for (const c of clouds) {
      c.x += (windy ? 16 : 6) * k * dt * c.size;
      if (c.x > W + 120 * k) c.x = -120 * k;
      c.t = Math.min(1, c.t + dt / 0.8);
    }
    ship.x += 5 * k * dt;
    if (ship.x > W + 60 * k) ship.x = -60 * k;
    if (T - ship.honk < 1.2 && Math.random() < dt * 9) ship.puffs.push({ x: ship.x - 2 * k, y: hy - 30 * k, t: 0 });
    for (let i = ship.puffs.length - 1; i >= 0; i--) if ((ship.puffs[i].t += dt) > 2) ship.puffs.splice(i, 1);
    // рыбки, круги, дельфин
    for (let i = jumps.length - 1; i >= 0; i--) {
      const j = jumps[i];
      j.t += dt;
      if (j.t > 0.9) {
        rings.push({ x: j.x + j.dir * 46 * k * j.s, y: j.y, t: 0 });
        jumps.splice(i, 1);
      }
    }
    for (let i = rings.length - 1; i >= 0; i--) if ((rings[i].t += dt) > 1.6) rings.splice(i, 1);
    if (dolphin.t < 0 && T > dolphin.next) {
      dolphin.t = 0;
      dolphin.x = F.x + F.w * rnd(0.2, 0.8);
    }
    if (dolphin.t >= 0 && (dolphin.t += dt) > 1.5) {
      rings.push({ x: dolphin.x + 50 * k, y: hy + 16 * k, t: 0 });
      dolphin.t = -1;
      dolphin.next = T + rnd(35, 70); // редкий гость
    }
    if (Math.random() < dt / 11 && jumps.length < 2) {
      // рыбки иногда прыгают сами
      const x = F.x + F.w * rnd(0.1, 0.9),
        y = rnd(hy + 16 * k, sy - 24 * k);
      jumps.push({ x, y, t: 0, dir: pick([-1, 1]), s: clamp((y - hy) / (sy - hy), 0.35, 1) });
      rings.push({ x, y, t: 0 });
    }
    // бабочка (ночью — светлячки): летает, иногда садится на хомячка
    fly.t += dt;
    const seat = [ham.x + 17 * ham.s, hamTop() + 10 * ham.s];
    if (fly.st === 'roam') {
      const a = T * 0.5 + fly.ph;
      const tx = F.x + F.w * (0.5 + 0.34 * Math.sin(a)),
        ty = lerp(sy - 10 * k, ham.y - 30 * k, 0.5 + 0.5 * Math.sin(a * 1.7));
      fly.x = lerp(fly.x || tx, tx, 0.04);
      fly.y = lerp(fly.y || ty, ty, 0.04);
      if (T > fly.next && !rain && !snow) fly.st = 'go';
    } else if (fly.st === 'go') {
      fly.x = lerp(fly.x, seat[0], 0.09);
      fly.y = lerp(fly.y, seat[1], 0.09);
      if (near(fly.x, fly.y, seat[0], seat[1], 5 * k)) {
        fly.st = 'sit';
        fly.t = 0;
        note(night ? 'fireflies-sit' : 'butterfly-sit');
      }
    } else {
      [fly.x, fly.y] = seat;
      if (fly.t > 5 || ham.st === 'jump' || ham.st === 'dance' || ham.st === 'hop') {
        fly.st = 'roam';
        fly.next = T + rnd(9, 16);
      }
    }
    // падающая звезда сама (если не дождались нажатия)
    if (night && !starShown && T > star.auto) shootStar();
    // погода
    for (let i = 0; i < drops.length; i++) {
      const d = drops[i];
      if (rain) {
        d.y += 620 * d.z * dt;
        d.x -= 120 * d.z * dt;
      } else if (snow) {
        d.y += 46 * d.z * dt;
        d.x += Math.sin(T * 1.3 + d.ph) * 18 * dt;
      } else {
        d.x += 130 * d.z * dt;
        d.y += (26 + Math.sin(T * 2 + d.ph) * 40) * dt;
      }
      if (d.y > H + 14 || d.x > W + 50 || d.x < -50) drops[i] = newDrop(false);
    }
    for (let i = texts.length - 1; i >= 0; i--) if ((texts[i].t += dt) > texts[i].life) texts.splice(i, 1);
  }

  // ---------- рисование ----------
  const circle = (x, y, r, fill) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  };
  function label(x, y, str, size, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `900 ${size}px Nunito, "Trebuchet MS", sans-serif`;
    const w = ctx.measureText(str).width + size * 1.1,
      h = size * 1.7;
    x = clamp(x, w / 2 + 6, W - w / 2 - 6);
    ctx.fillStyle = 'rgba(255,255,255,.94)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2) : ctx.rect(x - w / 2, y - h / 2, w, h);
    ctx.fill();
    ctx.fillStyle = '#5b3a29';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y + 1);
    ctx.restore();
  }

  function drawSea(sg) {
    // блики-волны на воде: ближе к берегу крупнее
    ctx.lineCap = 'round';
    for (let r = 0; r < 6; r++) {
      const q = (r + 0.5) / 6,
        y = lerp(hy + 6 * k, sy - 14 * k, q * q * 0.6 + q * 0.4),
        len = lerp(14, 60, q) * k;
      ctx.strokeStyle = `rgba(255,255,255,${lerp(0.25, 0.5, q)})`;
      ctx.lineWidth = lerp(1.2, 3, q) * k;
      ctx.beginPath();
      const step = lerp(70, 190, q) * k,
        off = ((T * lerp(4, 16, q) * (r % 2 ? 1 : -1) * k) % step) + r * 37;
      for (let x = -step + (off % step); x < W + step; x += step) {
        const yy = y + Math.sin(T * 1.4 + x * 0.02 + r) * 2.5 * k;
        ctx.moveTo(x, yy);
        ctx.quadraticCurveTo(x + len / 2, yy - 4 * k * q, x + len, yy);
      }
      ctx.stroke();
    }
    // круги от рыбок
    for (const g of rings) {
      const q = g.t / 1.6,
        sc = clamp((g.y - hy) / (sy - hy), 0.3, 1);
      ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - q)})`;
      ctx.lineWidth = 2 * k;
      for (const m2 of [1, 0.55]) {
        ctx.beginPath();
        ctx.ellipse(g.x, g.y, (8 + q * 46) * k * sc * m2, (3 + q * 13) * k * sc * m2, 0, 0, TAU);
        ctx.stroke();
      }
    }
    // мокрый песок и пена
    const step = 16;
    const path = (dy) => {
      ctx.beginPath();
      ctx.moveTo(-10, sy - 30 * k);
      for (let x = -10; x <= W + step; x += step) ctx.lineTo(x, shoreY(x, sg) + dy);
      ctx.lineTo(W + 10, sy - 30 * k);
      ctx.closePath();
    };
    path(13 * k + sg * 0.12);
    ctx.fillStyle = 'rgba(176,128,70,.28)';
    ctx.fill();
    path(5 * k);
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    ctx.fill();
    path(0);
    const g = ctx.createLinearGradient(0, sy - 30 * k, 0, sy + 20 * k + sg);
    g.addColorStop(0, 'rgba(120,222,226,0)');
    g.addColorStop(0.35, rain || snow ? '#a9c3cb' : dusk > 0.4 ? '#f0c3a6' : '#8fe6e4');
    g.addColorStop(1, rain || snow ? '#bcd2d8' : '#b5f1ee');
    ctx.fillStyle = g;
    ctx.fill();
  }
  function drawFish() {
    for (const j of jumps) {
      const q = j.t / 0.9,
        sc = k * j.s,
        x = j.x + j.dir * 46 * sc * q,
        y = j.y - Math.sin(q * Math.PI) * 54 * sc;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(j.dir * lerp(-0.9, 0.9, q));
      ctx.scale(j.dir * sc, sc);
      ctx.fillStyle = '#ff9f43';
      ctx.beginPath();
      ctx.ellipse(0, 0, 13, 7, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-11, 0);
      ctx.lineTo(-21, -7);
      ctx.lineTo(-21, 7);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(-1, -6, 3, 12);
      circle(7, -2, 1.6, '#333');
      ctx.restore();
    }
    if (dolphin.t >= 0) {
      const q = dolphin.t / 1.5,
        x = dolphin.x + q * 50 * k,
        y = hy + 16 * k - Math.sin(q * Math.PI) * 30 * k;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, hy + 17 * k);
      ctx.clip();
      ctx.translate(x, y);
      ctx.scale(k * 0.55, k * 0.55);
      paintDolphin(ctx, 3 + lerp(-0.8, 0.8, q) / 0.3, 0); // добрый дельфин, как в море (В1)
      ctx.restore();
    }
  }
  function drawShip() {
    const x = ship.x,
      y = hy + Math.sin(T * 1.2) * 1.2 * k,
      u = k * 0.9;
    for (const p of ship.puffs) circle(p.x - p.t * 9 * k, p.y - p.t * 16 * k, (4 + p.t * 5) * k, `rgba(255,255,255,${0.7 * (1 - p.t / 2)})`); // prettier-ignore
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(u, u);
    ctx.fillStyle = '#e8590c';
    ctx.beginPath();
    ctx.moveTo(-22, -9);
    ctx.lineTo(24, -9);
    ctx.lineTo(17, 1);
    ctx.lineTo(-17, 1);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(-11, -19, 19, 10);
    ctx.fillStyle = '#343a40';
    ctx.fillRect(-4, -31, 7, 12);
    ctx.fillStyle = '#ffd43b';
    ctx.fillRect(-4, -27, 7, 3);
    ctx.fillStyle = '#4dabf7';
    for (const wx of [-8, -2, 4]) ctx.fillRect(wx, -16, 3, 3);
    ctx.restore();
  }
  function drawCloud(c) {
    const a = CLOUD_SHAPES[CLOUD_ORDER[c.from]],
      b = CLOUD_SHAPES[CLOUD_ORDER[c.shape]],
      q = ease(c.t),
      u = 34 * k * c.size;
    const col = rain ? '#8d99a8' : snow ? '#e3e9f0' : mix('#ffffff', '#ffd9c2', dusk * 0.6);
    ctx.fillStyle = col;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const x = c.x + lerp(a.puffs[i][0], b.puffs[i][0], q) * u,
        y = c.y + lerp(a.puffs[i][1], b.puffs[i][1], q) * u,
        r = lerp(a.puffs[i][2], b.puffs[i][2], q) * u;
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, TAU);
    }
    ctx.fill();
    if (c.t > 0.7) for (const e of b.eyes) circle(c.x + e[0] * u, c.y + e[1] * u, 0.09 * u, shade(col, -0.35));
  }
  function drawPalm(p) {
    const [cx, cy] = crown(p);
    const b = p.bend + sway(p);
    // ствол
    ctx.lineCap = 'round';
    const mx = lerp(p.x, cx, 0.35) - b * p.h * 0.1,
      my = p.y - p.h * 0.55;
    for (const [col, lw] of [
      ['#8a5a2b', 20],
      ['#b07a3f', 13],
    ]) {
      // prettier-ignore
      ctx.strokeStyle = col;
      ctx.lineWidth = lw * k * p.size;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.quadraticCurveTo(mx, my, cx, cy);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(90,55,20,.5)';
    ctx.lineWidth = 2 * k;
    for (let i = 1; i < 8; i++) {
      const q = i / 8,
        x = (1 - q) * (1 - q) * p.x + 2 * q * (1 - q) * mx + q * q * cx,
        y = (1 - q) * (1 - q) * p.y + 2 * q * (1 - q) * my + q * q * cy;
      ctx.beginPath();
      ctx.moveTo(x - 8 * k * p.size, y + 2 * k);
      ctx.lineTo(x + 8 * k * p.size, y - 2 * k);
      ctx.stroke();
    }
    // листья
    const L = p.h * 0.42;
    for (let i = 0; i < 7; i++) {
      const base = -Math.PI / 2 + (i - 3) * 0.62,
        a = base + b * 0.9 + Math.sin(T * (windy ? 3 : 1.4) + i * 1.3 + p.fx * 5) * (windy ? 0.12 : 0.04),
        droop = 0.5 + Math.abs(i - 3) * 0.16;
      const ex = cx + Math.cos(a) * L,
        ey = cy + Math.sin(a) * L + droop * L * 0.5,
        qx = cx + Math.cos(a) * L * 0.6,
        qy = cy + Math.sin(a) * L * 0.6 - L * 0.12;
      ctx.fillStyle = i % 2 ? '#2f9e44' : '#40c057';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo(qx - Math.sin(a) * L * 0.2, qy + Math.cos(a) * L * 0.2, ex, ey);
      ctx.quadraticCurveTo(qx + Math.sin(a) * L * 0.16, qy - Math.cos(a) * L * 0.16, cx, cy);
      ctx.fill();
    }
    if (winter) {
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.beginPath();
      ctx.ellipse(cx, cy - L * 0.16, L * 0.42, L * 0.1, 0, 0, TAU);
      ctx.fill();
    }
    // кокосы
    p.nuts.forEach((n, i) => {
      if (n) circle(cx + (i - 1) * 12 * k, cy + 9 * k + (i === 1 ? 5 * k : 0), 8.5 * k, '#6b4423');
    });
  }
  function drawNut(n) {
    ctx.save();
    ctx.translate(n.x, n.y - 9 * k);
    ctx.fillStyle = 'rgba(0,0,0,.14)';
    ctx.beginPath();
    ctx.ellipse(0, n.floor - n.y + 9 * k, 10 * k, 3 * k, 0, 0, TAU);
    ctx.fill();
    ctx.rotate(n.rot);
    circle(0, 0, 9.5 * k, '#6b4423');
    for (const [dx, dy] of [[-3, -2], [3, -2], [0, 3]]) circle(dx * k, dy * k, 1.5 * k, '#3b2412'); // prettier-ignore
    ctx.restore();
  }
  function drawCrab() {
    if (crab.st === 'in') {
      // выглядывает из норки: сначала никого, потом два глаза
      const q = clamp((crab.t - 2.2) / 0.6, 0, 1);
      if (q > 0)
        for (const dx of [-5, 5]) {
          ctx.strokeStyle = '#e03131';
          ctx.lineWidth = 2.4 * k;
          ctx.beginPath();
          ctx.moveTo(crab.hx + dx * k, crab.hy);
          ctx.lineTo(crab.hx + dx * k, crab.hy - 11 * k * q);
          ctx.stroke();
          circle(crab.hx + dx * k, crab.hy - 12 * k * q, 3.2 * k, '#fff');
          circle(crab.hx + dx * k + Math.sin(T * 2) * k, crab.hy - 12 * k * q, 1.5 * k, '#222');
        }
      return;
    }
    const run = crab.st === 'flee',
      w = Math.sin(T * (run ? 30 : 9));
    const moving = run || crab.t > 1.2;
    ctx.save();
    ctx.translate(crab.x, crab.y - 8 * k);
    ctx.scale(k, k);
    ctx.fillStyle = 'rgba(0,0,0,.13)';
    ctx.beginPath();
    ctx.ellipse(0, 9, 17, 4, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#c92a2a';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    for (const sd of [-1, 1])
      for (let i = 0; i < 3; i++) {
        const lift = moving ? Math.sin(T * (run ? 30 : 9) + i * 2 + sd) * 2.5 : 0;
        ctx.beginPath();
        ctx.moveTo(sd * 9, 2 + i * 1.5);
        ctx.lineTo(sd * (17 + i), 7 + lift);
        ctx.stroke();
      }
    ctx.fillStyle = '#f03e3e';
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 9, 0, 0, TAU);
    ctx.fill();
    for (const sd of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(sd * 16, -7 + (moving ? w * sd : 0), 5.5, 4, sd * 0.5, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#f03e3e';
      ctx.beginPath();
      ctx.moveTo(sd * 4, -7);
      ctx.lineTo(sd * 4.5, -13);
      ctx.stroke();
      circle(sd * 4.5, -14, 3, '#fff');
      circle(sd * 4.5 + crab.dir * 0.8, -14, 1.4, '#222');
    }
    ctx.restore();
  }
  function drawGull() {
    const flying = gull.st !== 'stand';
    ctx.save();
    ctx.translate(gull.x, gull.y);
    ctx.scale(k, k);
    if (!flying) {
      ctx.fillStyle = 'rgba(0,0,0,.13)';
      ctx.beginPath();
      ctx.ellipse(0, 1, 13, 3.5, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#f08c00';
      ctx.lineWidth = 2;
      for (const dx of [-3, 3]) {
        ctx.beginPath();
        ctx.moveTo(dx, -8);
        ctx.lineTo(dx, 0);
        ctx.stroke();
      }
    }
    const bob = flying ? 0 : Math.sin(T * 2.2) * 0.8;
    ctx.translate(0, -17 + bob);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 9, -0.15, 0, TAU);
    ctx.fill();
    circle(10, -9, 6.5, '#fff');
    ctx.fillStyle = '#f08c00';
    ctx.beginPath();
    ctx.moveTo(15, -10);
    ctx.lineTo(24, -7.5);
    ctx.lineTo(15, -6);
    ctx.fill();
    circle(11.5, -10.5, 1.3, '#222');
    ctx.fillStyle = '#adb5bd';
    if (flying) {
      const fl = Math.sin(T * 14) * 12;
      ctx.beginPath();
      ctx.moveTo(-6, -2);
      ctx.quadraticCurveTo(-10, -18 - fl, -26, -12 - fl * 1.5);
      ctx.quadraticCurveTo(-12, -4, 4, -1);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.ellipse(-3, 0, 10, 5.5, -0.25, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    for (const f of feathers) {
      ctx.save();
      ctx.globalAlpha = clamp(10 - f.t, 0, 1);
      ctx.translate(f.x, f.y);
      ctx.rotate(f.y < f.floor ? Math.sin(f.t * 3) * 0.7 : 0.3);
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#ced4da';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(0, 0, 9 * k, 3 * k, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }
  function shellAt() {
    const ear = [ham.x - 25 * ham.s, ham.y - 52 * ham.s];
    const band = bot - sy,
      home = [F.x + F.w * 0.27, sy + band * 0.84];
    if (shell.st === 'go') return [lerp(home[0], ear[0], ease(shell.t / 0.5)), lerp(home[1], ear[1], ease(shell.t / 0.5)) - bell(shell.t / 0.5) * 40 * k]; // prettier-ignore
    if (shell.st === 'ear') return ear;
    if (shell.st === 'back') return [lerp(ear[0], home[0], ease(shell.t / 0.5)), lerp(ear[1], home[1], ease(shell.t / 0.5)) - bell(shell.t / 0.5) * 40 * k]; // prettier-ignore
    return home;
  }
  function drawShell() {
    const [x, y] = shellAt();
    shell.x = x;
    shell.y = y;
    ctx.save();
    ctx.translate(x, y - 7 * k);
    ctx.scale(k, k);
    ctx.fillStyle = '#ffd8e4';
    ctx.strokeStyle = '#e599b0';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.bezierCurveTo(-17, 6, -15, -12, 0, -12);
    ctx.bezierCurveTo(15, -12, 17, 6, 0, 8);
    ctx.fill();
    ctx.stroke();
    for (const a of [-0.7, -0.35, 0, 0.35, 0.7]) {
      ctx.beginPath();
      ctx.moveTo(0, 7);
      ctx.lineTo(Math.sin(a) * 15, 7 - Math.cos(a) * 18);
      ctx.stroke();
    }
    ctx.restore();
    if (shell.st === 'ear') {
      // «шум моря»: волнистые чёрточки у уха
      ctx.strokeStyle = 'rgba(77,171,247,.9)';
      ctx.lineWidth = 2.5 * k;
      for (let i = 0; i < 3; i++) {
        const q = (shell.t * 0.9 + i / 3) % 1;
        ctx.globalAlpha = 1 - q;
        ctx.beginPath();
        ctx.arc(x - 6 * k, y - 8 * k, (10 + q * 26) * k, Math.PI * 0.75, Math.PI * 1.25);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }
  function drawSnowman() {
    const q = clamp((T - snowman.t) / 1.2, 0, 1),
      wob = Math.sin(q * TAU * 2) * (1 - q) * 0.16;
    ctx.save();
    ctx.translate(snowman.x, snowman.y);
    ctx.fillStyle = 'rgba(0,0,0,.12)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 26 * k, 6 * k, 0, 0, TAU);
    ctx.fill();
    ctx.scale(k, k);
    ctx.rotate(wob);
    for (const [y, r] of [
      [-18, 20],
      [-47, 15],
      [-70, 11],
    ]) {
      // prettier-ignore
      circle(0, y, r, '#fff');
      ctx.strokeStyle = '#cfe0ee';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    circle(-4, -73, 1.6, '#333');
    circle(4, -73, 1.6, '#333');
    ctx.fillStyle = '#ff922b';
    ctx.beginPath();
    ctx.moveTo(0, -70);
    ctx.lineTo(11, -68);
    ctx.lineTo(0, -66.5);
    ctx.fill();
    ctx.fillStyle = '#e03131'; // ведёрко
    ctx.beginPath();
    ctx.moveTo(-8, -79);
    ctx.lineTo(8, -79);
    ctx.lineTo(6, -92);
    ctx.lineTo(-6, -92);
    ctx.fill();
    ctx.strokeStyle = '#7a4a21';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-13, -50);
    ctx.lineTo(-30, -60 - bell(q) * 14);
    ctx.moveTo(13, -50);
    ctx.lineTo(30, -60 - bell(q) * 14);
    ctx.stroke();
    ctx.restore();
  }
  function drawKite() {
    const [x, y] = kitePos();
    const hx = ham.x + 22 * ham.s,
      hy2 = ham.y - 30 * ham.s;
    ctx.strokeStyle = 'rgba(255,255,255,.8)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(hx, hy2);
    ctx.quadraticCurveTo(lerp(hx, x, 0.5), lerp(hy2, y, 0.5) + 50 * k, x, y);
    ctx.stroke();
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.5 + Math.sin(T * 1.7) * 0.15 + clamp((T - kite.loop) / 1.2, 0, 1) * TAU);
    ctx.scale(k, k);
    const cols = ['#ff6b9d', '#ffd43b', '#4dabf7', '#51cf66'];
    [
      [0, -26, 16, 0],
      [16, 0, 0, 30],
      [0, 30, -16, 0],
      [-16, 0, 0, -26],
    ].forEach(([x1, y1, x2, y2], i) => {
      // prettier-ignore
      ctx.fillStyle = cols[i];
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.fill();
    });
    ctx.strokeStyle = '#ff6b9d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 30);
    for (let i = 1; i <= 6; i++) ctx.lineTo(Math.sin(T * 5 + i) * 6, 30 + i * 8);
    ctx.stroke();
    ctx.restore();
  }
  function drawStrokes() {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [col, lw, dy] of [
      ['rgba(255,255,255,.55)', 7, 2],
      ['rgba(150,100,45,.6)', 6, 0],
    ]) {
      // prettier-ignore
      ctx.strokeStyle = col;
      ctx.lineWidth = lw * Math.max(k, 0.7);
      for (const st of strokes) {
        if (!st.length) continue;
        ctx.beginPath();
        ctx.moveTo(st[0].x, st[0].y + dy);
        for (let i = 1; i < st.length; i++) {
          // точку смыло — дальше новая чёрточка
          if (Math.hypot(st[i].x - st[i - 1].x, st[i].y - st[i - 1].y) > 30) ctx.moveTo(st[i].x, st[i].y + dy);
          else ctx.lineTo(st[i].x, st[i].y + dy);
        }
        if (st.length === 1) ctx.lineTo(st[0].x + 0.1, st[0].y + dy);
        ctx.stroke();
      }
    }
  }
  function drawHam() {
    const s = ham.s,
      t = ham.t;
    let x = ham.x,
      y = ham.y,
      pose = { time: T, blink: blinkAt(T) },
      lk = look;
    if (ham.st === 'idle') {
      const c = T % 7;
      if (c > 6 && !rain) pose = { ...pose, happy: true, armsUp: Math.sin(T * 10) > 0 }; // сам машет время от времени
    } else if (ham.st === 'jump') {
      y -= Math.abs(Math.sin(t * 5.7)) * 34 * s * (1 - t / 1.3);
      pose = { ...pose, happy: true, armsUp: Math.sin(t * 16) > 0 };
    } else if (ham.st === 'dance') {
      const beat = t * 5;
      x += Math.sin(beat) * 12 * s;
      y -= Math.abs(Math.sin(beat * 2)) * 9 * s;
      pose = { ...pose, happy: true, armsUp: Math.sin(beat * 2) > 0, dir: Math.sin(beat) > 0 ? 1 : -1, lean: false };
    } else if (ham.st === 'sneeze') {
      lk = { ...look, sick: true };
      pose = { ...pose, sneeze: clamp(t / 1.2, 0, 0.99) };
    } else if (ham.st === 'yawn') {
      pose = { ...pose, blink: 1, talk: true, armsUp: t > 0.3 && t < 1.4 };
      y -= bell(t / 1.8) * 3 * s;
    } else if (ham.st === 'hop') {
      y += bell(t / 1.5) * 24 * s * 0.5 - Math.abs(Math.sin(t * 6.3)) * 22 * s * (1 - t / 1.5);
      pose = { ...pose, armsUp: t < 0.8 };
    } else if (ham.st === 'listen') {
      pose = { ...pose, happy: true, dir: -1 };
    }
    // тень остаётся на песке, когда хомячок в прыжке
    ctx.fillStyle = 'rgba(0,0,0,.16)';
    ctx.beginPath();
    ctx.ellipse(x, ham.y + (ham.st === 'hop' ? bell(t / 1.5) * 12 * s : 0) + s, 24 * s, 6 * s, 0, 0, TAU);
    ctx.fill();
    drawHamster(ctx, x, y, s, lk, { ...pose, shadow: false });
    ham.px = x;
    ham.py = y;
    if (rain) {
      // зонтик
      const top = hamTop() - 26 * s + (y - ham.y),
        hx = x + 22 * s;
      ctx.strokeStyle = '#7a4a21';
      ctx.lineWidth = 3 * s;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(hx, y - 26 * s);
      ctx.lineTo(hx - 14 * s, top + 4 * s);
      ctx.stroke();
      const ux = x + 6 * s,
        R = 52 * s;
      ctx.fillStyle = '#ff6b9d';
      ctx.beginPath();
      ctx.moveTo(ux - R, top + 12 * s);
      ctx.quadraticCurveTo(ux, top - R * 0.9, ux + R, top + 12 * s);
      for (let i = 3; i >= 0; i--)
        ctx.quadraticCurveTo(ux - R + (i + 0.5) * (R / 2), top + 2 * s, ux - R + i * (R / 2), top + 12 * s);
      ctx.fill();
      ctx.fillStyle = '#ffd43b';
      ctx.beginPath();
      ctx.moveTo(ux - R / 2, top + 12 * s);
      ctx.quadraticCurveTo(ux - R * 0.3, top - R * 0.5, ux, top - R * 0.44);
      ctx.quadraticCurveTo(ux + R * 0.3, top - R * 0.5, ux + R / 2, top + 12 * s);
      ctx.quadraticCurveTo(ux + R / 4, top + 2 * s, ux, top + 12 * s);
      ctx.quadraticCurveTo(ux - R / 4, top + 2 * s, ux - R / 2, top + 12 * s);
      ctx.fill();
    }
  }
  function drawFly(lit) {
    if (night) {
      // светлячки: пять огоньков вокруг одной точки
      if (!lit) return;
      for (let i = 0; i < 5; i++) {
        const sp = fly.st === 'sit' ? 15 : 34,
          x = fly.x + Math.sin(T * 1.3 + i * 2.1) * sp * k,
          y = fly.y + Math.cos(T * 1.7 + i * 1.4) * sp * 0.6 * k - (fly.st === 'sit' ? 8 * k : 0),
          a = 0.55 + 0.45 * Math.sin(T * 4 + i * 1.9);
        const g = ctx.createRadialGradient(x, y, 0, x, y, 12 * k);
        g.addColorStop(0, `rgba(230,255,120,${0.75 * a})`);
        g.addColorStop(1, 'rgba(230,255,120,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - 12 * k, y - 12 * k, 24 * k, 24 * k);
        circle(x, y, 2.2 * k, `rgba(250,255,190,${a})`);
      }
      return;
    }
    if (lit || rain || snow) return; // в дождь и снег бабочка прячется
    const fl = fly.st === 'sit' ? Math.abs(Math.sin(T * 3)) * 0.5 + 0.5 : Math.abs(Math.sin(T * 13));
    ctx.save();
    ctx.translate(fly.x, fly.y + (fly.st === 'sit' ? 0 : Math.sin(T * 9) * 4 * k));
    ctx.scale(k * 1.15, k * 1.15);
    for (const sd of [-1, 1]) {
      ctx.fillStyle = '#b197fc';
      ctx.beginPath();
      ctx.ellipse(sd * 7 * fl, -4, 8 * fl + 1, 8, sd * 0.4, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffa8d0';
      ctx.beginPath();
      ctx.ellipse(sd * 5 * fl, 5, 5 * fl + 1, 5, -sd * 0.4, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#5b3a29';
    ctx.fillRect(-1.2, -8, 2.4, 15);
    ctx.restore();
  }
  function drawWeather() {
    if (rain) {
      ctx.strokeStyle = 'rgba(220,235,255,.6)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (const d of drops) {
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - 3 * d.z, d.y + 15 * d.z);
      }
      ctx.stroke();
    } else if (snow) {
      ctx.fillStyle = 'rgba(255,255,255,.92)';
      ctx.beginPath();
      for (const d of drops) {
        ctx.moveTo(d.x + 2.6 * d.z, d.y);
        ctx.arc(d.x, d.y, 2.6 * d.z, 0, TAU);
      }
      ctx.fill();
    } else if (windy) {
      for (const d of drops) {
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(T * 3 + d.ph);
        ctx.fillStyle = d.c;
        ctx.beginPath();
        ctx.ellipse(0, 0, 5.5 * d.z, 2.8 * d.z, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    }
  }
  function drawNightSky() {
    for (const s of stars) {
      ctx.globalAlpha = dk * (0.55 + 0.45 * Math.sin(T * 1.6 + s.ph));
      circle(s.x, s.y, s.r, '#fff');
    }
    ctx.globalAlpha = clamp((dk - 0.3) / 0.4, 0, 1); // луна выходит, когда солнце село
    if (!rain && !snow) {
      const mx = F.x + F.w * 0.66,
        my = F.y + 38 * k;
      const g = ctx.createRadialGradient(mx, my, 4, mx, my, 90 * k);
      g.addColorStop(0, 'rgba(230,235,255,.5)');
      g.addColorStop(1, 'rgba(230,235,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(mx - 95 * k, my - 95 * k, 190 * k, 190 * k);
      circle(mx, my, 24 * k, '#fdf6d8');
      circle(mx - 8 * k, my - 5 * k, 5 * k, '#eee3b5');
      circle(mx + 7 * k, my + 8 * k, 3.5 * k, '#eee3b5');
      // лунная дорожка
      ctx.fillStyle = 'rgba(253,246,216,.28)';
      for (let i = 0; i < 6; i++) {
        const y = lerp(hy + 6 * k, sy - 16 * k, i / 6),
          w = lerp(14, 60, i / 6) * k * (0.8 + 0.2 * Math.sin(T * 2 + i));
        ctx.fillRect(mx - w / 2, y, w, 3 * k);
      }
    }
    ctx.globalAlpha = 1;
    // падающая звезда
    const q = (T - star.t) / 1.3;
    if (q >= 0 && q < 1) {
      const x = star.x + lerp(-140, 140, q) * k,
        y = star.y + lerp(-50, 50, q) * k;
      const g = ctx.createLinearGradient(x - 80 * k, y - 28 * k, x, y);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(1, 'rgba(255,255,255,.95)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 3 * k;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - 80 * k, y - 28 * k);
      ctx.lineTo(x, y);
      ctx.stroke();
      circle(x, y, 4 * k, '#fffbe0');
    }
    if (q >= 0.3 && q < 3.6) label(star.x, star.y + 70 * k, '🌠 Загадай желание!', 19 * Math.max(k, 0.75), clamp((3.6 - q) * 2, 0, 1) * clamp((q - 0.3) * 4, 0, 1)); // prettier-ignore
  }

  function frame(now) {
    if (dead) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (document.hidden) return;
    T += dt;
    update(dt);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(bg, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sg = surge();
    drawShip();
    drawFish();
    for (const c of clouds) drawCloud(c);
    if (!night && !rain)
      for (let i = 0; i < 2; i++) {
        // чайки вдалеке
        const x = ((T * 22 * k + i * W * 0.55) % (W + 200)) - 100,
          y = lerp(F.y + 20 * k, hy - 20 * k, 0.35 + i * 0.3) + Math.sin(T + i * 2) * 8 * k,
          f = Math.sin(T * 5 + i) * 4 * k;
        ctx.strokeStyle = 'rgba(70,80,100,.7)';
        ctx.lineWidth = 2 * k;
        ctx.beginPath();
        ctx.moveTo(x - 9 * k, y - f);
        ctx.quadraticCurveTo(x - 4 * k, y - 5 * k, x, y);
        ctx.quadraticCurveTo(x + 4 * k, y - 5 * k, x + 9 * k, y - f);
        ctx.stroke();
      }
    drawSea(sg);
    drawStrokes();
    if (windy) drawKite();
    // всё, что стоит на песке, — по порядку «дальше — раньше»
    const things = [
      [palms[0].y, () => drawPalm(palms[0])],
      [palms[1].y, () => drawPalm(palms[1])],
      [gull.st === 'stand' ? gull.y : 1e6, drawGull],
      [crab.hy + 6 * k, drawCrab],
      [shell.st === 'sand' ? shell.y : ham.y + 2, drawShell],
      [ham.y, drawHam],
      ...nuts.map((n) => [n.floor, () => drawNut(n)]),
    ];
    if (winter) things.push([snowman.y, drawSnowman]);
    things.sort((a, b) => a[0] - b[0]);
    for (const th of things) th[1]();
    drawFly(false);
    drawWeather();
    if (rain) {
      ctx.fillStyle = `rgba(60,72,95,${0.16 * (1 - dk * 0.7)})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (dk > 0) {
      ctx.fillStyle = `rgba(10,16,58,${(rain ? 0.5 : 0.58) * dk})`;
      ctx.fillRect(0, 0, W, H);
      drawNightSky();
    }
    drawFly(true);
    if (ham.bubble) {
      const b = ham.bubble;
      label(ham.px, Math.max(F.y + 16 * k, hamTop() - (rain ? 76 : 22) * ham.s + (ham.py - ham.y)), b.text, 17 * Math.max(k, 0.8), clamp((b.life - b.t) * 4, 0, 1)); // prettier-ignore
    }
    for (const tx of texts) label(tx.x, tx.y - tx.t * 14 * k, tx.text, tx.size, clamp((tx.life - tx.t) * 3, 0, 1));
  }

  // ---------- указатель: мышь и касание одинаково ----------
  const pt = (e) => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  let pid = null;
  const onDown = (e) => {
    if (pid !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
    pid = e.pointerId;
    try {
      canvas.setPointerCapture(pid);
    } catch (err) {
      /* не страшно */
    }
    down(...pt(e));
    e.preventDefault();
  };
  const onMove = (e) => {
    if (e.pointerId === pid) move(...pt(e));
  };
  const onUp = (e) => {
    if (e.pointerId !== pid) return;
    pid = null;
    up();
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  const onResize = () => layout();
  window.addEventListener('resize', onResize);

  layout();
  last = performance.now();
  raf = requestAnimationFrame(frame);

  return {
    /** Кнопки заставки поменялись — расставить сцену заново в свободном месте. */
    relayout: layout,
    destroy() {
      dead = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    },
    /** Для автотеста и отладки: где что стоит (в CSS-пикселях окна) и что уже потрогали. */
    debug() {
      const r = canvas.getBoundingClientRect();
      const P = (x, y) => ({ x: Math.round(x + r.left), y: Math.round(y + r.top) });
      const [cx, cy] = crown(palms[0]);
      // точка не под хомячком и не под бабочкой: когда под заставкой больше кнопок (новая игра на телефоне), сцена
      // ниже, и хомячок в шляпе достаёт до кромки воды — нажатие туда достаётся ему, а не волне
      const clear = (x0, y) => {
        const R = 30 * Math.max(k, 0.7);
        const onHam = (x) => Math.abs(x - ham.x) < 34 * ham.s + 6 * k && y > hamTop() - 6 * k && y < ham.y + 8 * ham.s;
        const onFly = (x) => near(x, y, fly.x, fly.y, R * 1.3);
        const xs = [x0, ham.x - 34 * ham.s - R * 0.6, ham.x + 34 * ham.s + R * 0.6];
        return xs.find((x) => !onHam(x) && !onFly(x)) ?? x0;
      };
      return {
        env: { minutes: m, weather, season, night, rain, snow, windy, winter },
        free: F,
        k,
        log: log.slice(),
        ham: { ...P(ham.x, ham.y - 40 * ham.s), st: ham.st, top: Math.round(hamTop() + r.top), s: ham.s },
        palm: { ...P(cx, cy), nuts: palms[0].nuts.slice(), bend: palms[0].bend },
        trunk: P(lerp(palms[0].x, cx, 0.5), palms[0].y - palms[0].h * 0.5),
        nuts: nuts.map((n) => ({ ...P(n.x, n.y - 9 * k), still: n.vy === 0 && n.vx === 0 })),
        crab: { ...P(crab.x, crab.y - 8 * k), st: crab.st, hole: P(crab.hx, crab.hy) },
        gull: { ...P(gull.x, gull.y - 16 * k), st: gull.st, feathers: feathers.length },
        shell: { ...P(shell.x, shell.y - 6 * k), st: shell.st },
        cloud: (() => {
          // облако, которое не прячется за кроной пальмы
          const far = (c) =>
            Math.min(...palms.map((p) => Math.hypot(c.x - crown(p)[0], c.y - crown(p)[1]) - p.h * 0.34));
          const c =
            clouds.filter((c) => c.x > 60 && c.x < F.x + F.w - 60).sort((a, b) => far(b) - far(a))[0] || clouds[0];
          return { ...P(c.x, c.y), shape: CLOUD_ORDER[c.shape] };
        })(),
        ship: P(ship.x, hy - 10 * k),
        sea: P(F.x + F.w * 0.45, lerp(hy, sy, 0.6)),
        shore: P(clear(F.x + F.w * 0.4, sy + 6 * k), sy + 6 * k),
        sand: P(clear(F.x + F.w * 0.36, lerp(sy, bot, 0.5)), lerp(sy, bot, 0.5)),
        sky: P(F.x + F.w * 0.45, F.y + (hy - F.y) * 0.3),
        kite: P(...kitePos()),
        snowman: P(snowman.x, snowman.y - 38 * k),
        fly: { ...P(fly.x, fly.y), st: fly.st },
        dolphin: { on: dolphin.t >= 0, ...P(dolphin.x, hy + 14 * k) },
        drawn: strokes.reduce((n, st) => n + st.length, 0),
        jumps: jumps.length,
        wave: T - wave.t < 3.4,
        star: starShown,
      };
    },
    /** Для автотеста: позвать редкого гостя сейчас. */
    callDolphin() {
      dolphin.next = 0;
    },
  };
}
