// Живая заставка: берег моря с пальмами, хомячок и всё, что можно потрогать. Время суток и погода приходят
// снаружи (как в последней игре) и на заставке не меняются. Мышь и касание — одни и те же события указателя.
//
// Рисование — features/title_art.js: небо, море и песок без движения лежат в кэше (bg), каждый кадр поверх —
// волны, облака, пальмы, зверьки и погода. Что можно трогать — см. down() ниже: порядок проверок там и есть
// «кто ближе к зрителю».
import { TAU, clamp, lerp, rnd, pick, seeded, readSec } from '../core/util.js';
import { sfx } from '../core/audio.js';
import { lightning, lightningNo } from '../engine/topdown/render.js';
import { createTitleArt, CLOUD_ORDER, FISH, ease, releaseTitleArt } from './title_art.js';

let starShown = false; // падающая звезда — не больше одной за запуск страницы

/**
 * @param canvas  канва во весь экран заставки
 * @param o       { minutes, weather: sun|rain|snow|petals|leaves, force: 1 — лёгкая, 2 — ливень или метель, 3 — гроза,
 *                  season: winter|spring|summer|autumn, look, free }
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
    winter = season === 'winter',
    hard = (rain || snow) && o.force >= 2, // ливень или метель: осадков больше, их несёт ветром
    storm = rain && o.force >= 3; // гроза: небо темнее, мягкие вспышки молний и тихий гром
  let bolt = null; // номер последней вспышки (один раскат грома на вспышку)
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
  const ham = {
    x: 0,
    y: 0,
    s: 2,
    st: 'idle',
    t: 0,
    press: null,
    alt: 0,
    bubble: null,
    hop: 0,
    dir: 0,
    act: null,
    dur: 0,
  };
  // хомячок сам по себе: ничего не трогают 20–30 с — он сам находит занятие (st 'busy', act: castle — лепит куличик,
  // snowball — зимой лепит снежок, sea — сидит и смотрит на море, doze — дремлет, paws — в дождь под зонтиком
  // перебирает лапками). Любое нажатие — «просыпается». Куличики и снежки остаются на песке до первой большой волны
  let idleAt = 0,
    idleWait = rnd(20, 30),
    lastAct = null;
  const castles = []; // { x, y, kind: castle|snowball, g: 0..1 — сколько слепил, gone — когда смыло волной }
  const palms = [
    { fx: 0.13, fy: 0.22, size: 1, bend: 0, vel: 0, drag: false, nuts: [1, 1, 1], lean: 1 },
    { fx: 0.9, fy: 0.08, size: 0.72, bend: 0, vel: 0, drag: false, nuts: [], lean: -1 },
  ];
  const nuts = []; // кокосы, которые упали: { x, y, vx, vy, floor, rot, born }
  const crab = { hx: 0, hy: 0, x: 0, y: 0, st: 'walk', t: 0, dir: 1, tx: 0 };
  const gull = { x: 0, y: 0, hx: 0, hy: 0, st: 'stand', t: 0 };
  const feathers = [];
  const shell = { x: 0, y: 0, st: 'sand', t: 0 };
  // облака плывут каждое своим ходом: маленькое (дальнее) — медленнее, sp — пикселей в секунду на экране компьютера.
  // Кораблик на горизонте — сам по себе, ещё медленнее облаков, чтобы глаз видел: они не связаны
  const clouds = [0, 1, 2].map((i) => ({ fx: 0.12 + i * 0.36, fy: [0.3, 0.75, 0.45][i], size: [1, 0.75, 0.9][i], sp: [9, 4.6, 6.6][i], shape: 0, from: 0, t: 1, x: 0, y: 0 })); // prettier-ignore
  // корабли: на горизонте (far) — кораблик или круизный лайнер, ближе (near) — рыболовецкое судно или яхта; на экране
  // не больше двух, по одному на полосу. Скорость — пикселей в секунду на экране компьютера, len — длина в единицах
  // рисунка, top — высота над водой, u — масштаб полосы (дальний мельче). Гудок у каждого свой (sfx), надпись — своя.
  // Нажать три раза подряд — корабль отвечает гирляндой сигнальных флажков (маленький секрет)
  const SHIPS = {
    boat: { lane: 'far', sp: 2.6, len: 46, top: 31, snd: 'lift', say: 'Ту-ту-у!' },
    liner: { lane: 'far', sp: 2.2, len: 94, top: 40, snd: 'lift', say: 'Ту-ту-у-у-у!' },
    trawler: { lane: 'near', sp: 6.5, len: 60, top: 36, snd: 'bell', say: 'Дзынь-дзынь!' },
    yacht: { lane: 'near', sp: 9.5, len: 46, top: 54, snd: 'whistle', say: 'Фью-ить!' },
  };
  const LANE_U = { far: 0.9, near: 1.25 };
  const fleet = []; // { type, lane, x, dir, honk, taps: [время], flags, puffs, id }
  let fleetNext = rnd(10, 25),
    shipSeq = 0;
  // батискаф: очень редко всплывает ближе к берегу, смотрит в перископ и погружается
  const sub = { next: rnd(150, 300), t: -1, x: 0, hi: -9, dur: 8 };
  const dolphin = { next: rnd(10, 22), t: -1, x: 0, hi: -9 };
  // вдали на горизонте: остров с вулканом (как наш «Удалённый остров») и маяк на скале. Сами они — в кэше неба (bg),
  // каждый кадр — только дымок, огоньки и луч маяка. s — масштаб (дальнее — мельче), puff/beam — когда нажали
  const isle = { x: 0, s: 1, puff: -9, puffs: [] }; // puffs — когда нажимали (клубы дыма идут ~5 с, title_art.js)
  const tower = { x: 0, s: 1, beam: -9 };
  // самолётик: время от времени пролетает по небу над морем (с ленточкой-флажком); в дождь и снег — реже.
  // t — сколько уже летит (−1 — не летит), trick — когда покачал крыльями или сделал петлю, hearts — сердечки из дыма
  const PLANE_GAP = rain ? [130, 220] : snow ? [100, 180] : [40, 90];
  const plane = { next: rnd(15, 35) * (rain || snow ? 2.5 : 1), t: -1, dur: 12, dir: 1, fy: 0.5, trick: -99, loop: false, n: 0, hearts: [] }; // prettier-ignore
  const PLANE_TRICK = 1.6;
  // русалочка (Жемчужинка из бухты) выглядывает из моря на среднем плане: редко, но надолго, чтобы разглядеть.
  // st: off → up (поднимается) → look (оглядывается, машет, хвост мелькает) → dive (ныряет); нажали — wave → dive
  const MER_GAP = winter ? [150, 270] : [90, 180];
  const mer = { next: rnd(45, 110) * (winter ? 1.5 : 1), st: 'off', t: 0, x: 0, y: 0, look: 6, side: 1 };
  let guests = true; // автотест выключает редких гостей, чтобы они не перехватили нажатие по облаку или морю
  const jumps = []; // рыбки в прыжке: { x, y, t, dir, s, kind, …FISH[kind] } — kind: clown, blue, yellow, school, flying
  let lastFish = '';
  const rings = []; // круги на воде: { x, y, t }
  const fly = { x: 0, y: 0, st: 'roam', t: 0, ph: rnd(9), next: rnd(7, 12) }; // бабочка днём, светлячки ночью
  const kite = { loop: -9 };
  const snowman = { x: 0, y: 0, t: -9 };
  // морская звезда: иногда волна выносит её на песок; нажали — щекотно (переворачивается) и уползает к воде.
  // st: off → sand (born — когда вынесло) → tickle → crawl → off
  const starfish = { st: 'off', x: 0, y: 0, t: 0, born: 0, next: rnd(30, 60) };
  // черепашка: редко выползает из-за края и ковыляет к морю; нажали — прячется в панцирь, потом ползёт дальше.
  // st: off → walk → (hide → walk) → swim → off
  const turtle = { st: 'off', x: 0, y: 0, t: 0, next: rnd(60, 120), dir: 1, tx: 0, ty: 0, step: 0 };
  const wave = { t: -9, depth: 0, auto: 0 }; // большая волна на песок
  // рисунок на песке: штрихи — массивы точек { x, y, j }; j — «отсюда линия начинается заново» (палец уходил с песка
  // или волна смыла кусок). Точки не реже чем через INK_STEP: быстрый росчерк мышью — всё равно сплошная линия
  const strokes = [];
  const INK_STEP = 6,
    INK_MAX = 4000; // всего точек на песке — потом волна всё равно смоет
  let drawing = null,
    lastDraw = -99,
    inkV = 0; // меняется, когда меняется рисунок: art перерисовывает свой кэш

  const star = { t: -9, x: 0, y: 0, auto: rnd(16, 26) };
  const stars = [];
  const drops = []; // дождь, снег, лепестки, листья
  const texts = []; // надписи, всплывающие над сценой: { x, y, text, t, life, size }
  let grab = null; // что сейчас держит указатель

  // реплики и надписи висят, пока медленно читающий ребёнок успеет их прочитать (core/util.js: readSec, та же мерка,
  // что у подсказок вверху); сердечко без букв — сколько задано
  const readLife = (text, life) => (/\p{L}/u.test(text) ? Math.max(life, readSec(text)) : life);
  const say = (text, life = 1.8) => {
    ham.bubble = { text, t: 0, life: readLife(text, life) };
  };
  const pop = (x, y, text, size = 18, life = 1.6) => texts.push({ x, y, text, t: 0, life: readLife(text, life), size });

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
    F = { x: f.x, y: f.y, w: Math.max(120, f.w), h: Math.max(120, f.h), open: f.open ?? H };
    ham.s = clamp(Math.min(F.w / 250, F.h / 250), 0.8, 2.5);
    k = ham.s / 2;
    bot = F.y + F.h;
    sy = F.y + F.h * 0.47;
    hy = Math.max(F.y + F.h * 0.2, sy - 150 * Math.max(k, 0.6));
    const band = bot - sy;
    const at = (fx, fy) => [F.x + F.w * fx, sy + band * fy];
    [ham.x, ham.y] = at(0.5, 0.66);
    // узкий экран стоя (телефон): пальмы чуть ниже и ближе к краям — между кронами виден остров с маяком
    const narrow = F.w < 600 && F.h > F.w * 1.1;
    palms.forEach((p, i) => {
      [p.x, p.y] = at(narrow ? [0.07, 0.94][i] : p.fx, p.fy);
      p.h = Math.min(300 * k * p.size, p.y - F.y - 30 * k, narrow ? F.w * 0.56 * p.size : 1e9);
    });
    [crab.hx, crab.hy] = at(0.74, 0.8);
    if (crab.st === 'walk') [crab.x, crab.y] = [crab.hx - 40 * k, crab.hy + 4 * k];
    [gull.hx, gull.hy] = at(0.68, 0.2);
    if (gull.st === 'stand') [gull.x, gull.y] = [gull.hx, gull.hy];
    if (shell.st === 'sand') [shell.x, shell.y] = at(0.27, 0.84);
    [snowman.x, snowman.y] = at(0.31, 0.42);
    isle.s = Math.min(k, (F.w * 0.3) / 240);
    isle.x = F.x + F.w * (narrow ? 0.49 : 0.43);
    tower.s = Math.min(k, Math.max((F.w * 0.3) / 240, narrow ? 0.64 : 0)); // на телефоне маяк не мельче пальца
    tower.x = F.x + F.w * (narrow ? 0.67 : 0.64);
    for (const c of clouds) {
      c.x = W * c.fx;
      c.y = lerp(F.y + 26 * k, hy - 46 * k, c.fy);
    }
    if (!fleet.length) fleet.push(newShip(pick(['boat', 'liner']), 'far', 1, F.x + F.w * 0.58));
    mer.y = lerp(hy, sy, 0.52); // уровень воды у русалочки
    if (mer.st !== 'off') mer.x = clamp(mer.x, F.x + F.w * 0.15, F.x + F.w * 0.85);
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
    inkV++;
    drops.length = 0;
    const n = Math.round(((W * H) / 9000) * (rain ? 1.1 : snow ? 0.8 : windy ? 0.28 : 0) * (hard ? 1.7 : 1));
    for (let i = 0; i < Math.min(n, hard ? 340 : 220); i++) drops.push(newDrop(true));
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
    for (const c of castles)
      if (c.gone === null && (ham.st !== 'busy' || c !== castles[castles.length - 1])) c.gone = T; // куличик смыло
  }

  // ---------- рыбки ----------
  /** Из моря в x, y выпрыгивает рыбка случайного вида (не того же, что в прошлый раз; летучая — редко). Вернёт вид. */
  function fishJump(x, y, want) {
    const kinds = Object.keys(FISH).filter((f) => f !== lastFish);
    let kind = want && FISH[want] ? want : kinds[kinds.length - 1],
      r = rnd(kinds.reduce((n, f) => n + FISH[f].w, 0));
    if (!want)
      for (const f of kinds)
        if ((r -= FISH[f].w) < 0) {
          kind = f;
          break;
        }
    lastFish = kind;
    jumps.push({ x, y, t: 0, dir: pick([-1, 1]), s: clamp((y - hy) / (sy - hy), 0.35, 1), kind, ...FISH[kind] });
    rings.push({ x, y, t: 0 });
    return kind;
  }

  // ---------- что делает хомячок ----------
  function busyGo(want) {
    const acts = rain ? ['paws'] : winter ? ['snowball', 'sea', 'doze'] : ['castle', 'sea', 'doze'];
    const act = want && acts.includes(want) ? want : pick(acts.filter((a) => a !== lastAct || acts.length === 1));
    lastAct = act;
    hamDo('busy');
    ham.act = act;
    ham.dur = act === 'doze' ? rnd(14, 20) : rnd(10, 15);
    if (act === 'castle' || act === 'snowball') {
      // лепит сбоку от себя — с той стороны, где есть место на песке
      const side = ham.x + 70 * ham.s < F.x + F.w - 20 * k ? 1 : -1;
      castles.push({ x: ham.x + side * 44 * ham.s, y: ham.y + 3 * ham.s, kind: act, g: 0, gone: null, side });
      if (castles.length > 4) castles.shift();
    }
    if (act === 'sea') say('Какое море…', 2);
    note('busy-' + act);
  }
  function wake() {
    const act = ham.act;
    hamDo('idle');
    ham.act = null;
    say(act === 'doze' ? 'Ой! Я не сплю!' : pick(['Ой, привет!', 'А я тут!']), 1.4);
    note('wake');
    idleWait = rnd(20, 30);
  }
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
    idleAt = T;
    if (ham.st === 'busy') wake();
    // бабочка или светлячки. Точно по бабочке — ей; рядом — сначала тому, кто под пальцем (бабочка пролетает над
    // чайкой: нажатие по чайке не достаётся бабочке), а если там никого — всё же бабочке. Светлячки — рой из
    // огоньков, «точно по нему» не бывает: всегда сначала тот, кто под пальцем (рой кружит над хомячком)
    const flyNear = (r) => (night || (!rain && !snow)) && near(x, y, fly.x, fly.y, r);
    const flyTap = () => {
      if (fly.st === 'sit') {
        fly.st = 'roam';
        fly.next = T + rnd(8, 14);
      } else {
        fly.st = 'go';
        note(night ? 'fireflies' : 'butterfly');
        sfx('ding');
      }
    };
    if (!night && flyNear(R * 0.6)) return flyTap();
    // хомячок: короткое нажатие — привет, долгое — танец
    if (Math.abs(x - ham.x) < 34 * ham.s && y < ham.y + 8 * ham.s && y > hamTop()) {
      ham.press = T;
      grab = { kind: 'ham' };
      return;
    }
    // черепашка ползёт по песку перед ракушкой и крабом
    if ((turtle.st === 'walk' || turtle.st === 'hide') && near(x, y, turtle.x, turtle.y - 12 * k, R * 1.1)) {
      if (turtle.st === 'walk') {
        turtle.st = 'hide';
        turtle.t = 0;
        note('turtle');
        sfx('tap');
      }
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
    if (starfish.st === 'sand' && T - starfish.born > 1.6 && near(x, y, starfish.x, starfish.y, R)) {
      starfish.st = 'tickle';
      starfish.t = 0;
      note('starfish');
      sfx('squeak');
      pop(starfish.x, starfish.y - 34 * k, 'Хи-хи, щекотно!', 15 * Math.max(k, 0.8));
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
    // самолётик — далеко над морем, за пальмами: нажатие по видимой его части (за кроной — пальме, она ближе)
    if (planeOn()) {
      const [px, py] = planePos();
      if (near(x, y, px, py, R * 1.2)) return T - plane.trick > PLANE_TRICK && planeTap(); // посреди петли — ждём
    }
    // русалочка — на воде за пальмами, корабли поближе и батискаф — за ней
    if ((mer.st === 'look' || (mer.st === 'up' && mer.t > 0.5)) && near(x, y, ...merHit(), Math.max(R * 1.1, 36 * merS()))) return merTap(); // prettier-ignore
    if (sub.t >= 0 && subUp() > 0.4 && near(x, y, sub.x, shipY('near') - 14 * k, Math.max(R * 1.2, 30 * k))) return subTap(); // prettier-ignore
    for (const sh of fleet) if (sh.lane === 'near' && onShip(sh, x, y, R)) return shipTap(sh);
    // рядом с бабочкой, а под пальцем — небо, море или песок: всё же бабочке
    if (flyNear(R * 1.2)) return flyTap();
    // горизонт: корабль — перед островом и маяком, а они — перед облаками (облака проплывают позади, drawFar).
    // Точно по кораблю — ему; по маяку или острову — им, даже если рядом корабль или позади облако
    for (const sh of fleet) if (sh.lane === 'far' && onShip(sh, x, y, 0)) return shipTap(sh);
    if (dolphin.t >= 0 && near(x, y, dolphin.x, hy + 14 * k, R * 1.6)) {
      dolphin.hi = T;
      note('dolphin');
      sfx('squeak');
      pop(dolphin.x, hy - 22 * k, '💙', 20 * Math.max(k, 0.8));
      return;
    }
    if (near(x, y, tower.x, towerTop() + 16 * tower.s, Math.max(R, 34 * tower.s))) {
      if (T - tower.beam > 2) {
        tower.beam = T;
        note('lighthouse');
        sfx('ding');
      }
      return;
    }
    if (onIsle(x, y)) {
      if (T - isle.puff > 2.5) {
        isle.puff = T;
        isle.puffs.push(T);
        if (isle.puffs.length > 3) isle.puffs.shift();
        note('volcano');
        sfx('thud');
      }
      return;
    }
    for (const sh of fleet) if (sh.lane === 'far' && onShip(sh, x, y, R)) return shipTap(sh);
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
    if (y < hy) {
      if (night) shootStar(x, y);
      return;
    }
    const sh = shoreY(x, 0);
    if (y < sh - 16 * k) {
      // море: выпрыгивает рыбка
      const kind = fishJump(x, Math.max(y, hy + 12 * k));
      note('fish');
      note('fish-' + kind);
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
    drawing = [{ x, y, j: 1 }];
    strokes.push(drawing);
    inkV++;
    grab = { kind: 'draw', x, y, off: false };
    lastDraw = T;
    note('draw');
  }
  function move(x, y) {
    if (!grab) return;
    if (grab.kind === 'palm') {
      const dx = x - grab.x0;
      if (Math.abs(dx) > 8) grab.moved = true;
      if (grab.moved) grab.p.bend = clamp(grab.bend0 + dx / (grab.p.h * 0.6), -0.75, 0.75);
    } else if (grab.kind === 'draw' && drawing) inkTo(x, y);
  }
  // ведём линию от прошлого положения пальца до нового: как бы быстро ни двигали, между событиями — отрезок,
  // нарезанный на точки. Вне песка (вода, край экрана) линию не рисуем, а вернулись на песок — продолжаем
  const onSand = (x, y) => x >= 0 && x <= W && y <= H - 2 && y > shoreY(x, 0) + 18 * k;
  function inkTo(x, y) {
    const g = grab,
      dx = x - g.x,
      dy = y - g.y;
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / INK_STEP));
    let total = 0;
    for (const st of strokes) total += st.length;
    for (let i = 1; i <= n && total < INK_MAX; i++) {
      const px = g.x + (dx * i) / n,
        py = g.y + (dy * i) / n;
      if (!onSand(px, py)) {
        g.off = true;
        continue;
      }
      const q = drawing[drawing.length - 1];
      if (g.off || !q) {
        drawing.push({ x: px, y: py, j: 1 });
        g.off = false;
      } else if (Math.hypot(px - q.x, py - q.y) >= INK_STEP * 0.7) drawing.push({ x: px, y: py, j: 0 });
      else continue;
      total++;
      inkV++;
      lastDraw = T;
    }
    g.x = x;
    g.y = y;
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

  // самолётик: где летит и как наклонён. Он далеко, над морем, за пальмами (мелкий, рисуется до крон): высота — доля
  // fy неба над морем от заголовка почти до горизонта (не выше заголовка: петле хватает места сверху; чаще ниже — на
  // компьютере небо узкое, и его видно в просветах между кронами и над горизонтом), летит от края до края свободного
  // места; trick — покачать крыльями или петля
  const PLANE_R = () => 15 * k; // радиус петли
  const planeBand = () => {
    const top = F.y + 16 * k,
      lo = hy - 22 * k;
    return [top, Math.max(top, lo)];
  };
  const canLoop = () => {
    const [top, lo] = planeBand();
    return lerp(top, lo, plane.fy) - 2 * PLANE_R() - 12 * k > F.y;
  };
  function planePos() {
    const q = clamp(plane.t / plane.dur, 0, 1),
      [a, b] = planeSpan(),
      x0 = a - 80 * k,
      x1 = b + 80 * k,
      [top, lo] = planeBand();
    let x = plane.dir > 0 ? lerp(x0, x1, q) : lerp(x1, x0, q),
      y = lerp(top, lo, plane.fy) + Math.sin(plane.t * 1.7) * 3 * k,
      rot = Math.cos(plane.t * 1.7) * -0.08 * plane.dir; // нос чуть вверх-вниз вместе с волной полёта
    const tq = (T - plane.trick) / PLANE_TRICK;
    if (tq >= 0 && tq < 1) {
      if (plane.loop) {
        const a = ease(tq) * TAU;
        x += plane.dir * Math.sin(a) * PLANE_R();
        y -= (1 - Math.cos(a)) * PLANE_R();
        rot = -plane.dir * a;
      } else rot += Math.sin(tq * TAU * 2.5) * 0.4 * (1 - tq); // покачал крыльями
    }
    return [x, y, rot];
  }
  // где самолётик может лететь по ширине: кнопки сбоку начинаются ниже неба — весь экран, иначе — до кнопок
  const planeSpan = () => (planeBand()[1] + 34 * k < F.open ? [0, W] : [F.x, F.x + F.w]);
  const planeOn = () => plane.t >= 0;
  function planeGo() {
    plane.t = 0;
    plane.dur = rnd(10, 14);
    plane.dir = pick([-1, 1]);
    plane.fy = rnd(0.2, 1);
    plane.n = 0;
  }
  function planeTap() {
    const [x, y] = planePos();
    plane.loop = canLoop() && plane.n++ % 2 === 0; // через раз: петля и «покачал крыльями»
    plane.trick = T;
    plane.hearts.push({ x: x - plane.dir * 20 * k, y: y + 2 * k, t: 0 });
    if (plane.hearts.length > 3) plane.hearts.shift();
    note(plane.loop ? 'plane-loop' : 'plane-wave');
    sfx('plane'); // «ж-ж-ж» мотора (core/audio.js), посреди фигуры — «фью»
    setTimeout(() => !dead && sfx('whistle'), 600);
  }
  // русалочка: где голова и насколько она над водой (0 — под водой, 1 — по пояс)
  const merS = () => ham.s * 0.55;
  function merUp() {
    if (mer.st === 'up') return ease(clamp(mer.t / 1.6, 0, 1));
    if (mer.st === 'dive') return 1 - ease(clamp(mer.t / 0.55, 0, 1));
    return mer.st === 'off' ? 0 : 1;
  }
  // середина того, что видно над водой (голова и плечи): тело стоит на mer.y + 22·S, пока не всплыла — ниже
  const merHit = () => [mer.x, Math.min(mer.y - 33 * merS() + (1 - merUp()) * 76 * merS(), mer.y - 8 * merS())];
  function merGo() {
    // место — в свободной части моря: не за хомячком, не за пальмой и не там, где только что прыгал дельфин
    // крона мешает, только если листья свисают до её головы; ствол — всегда
    const ok = (x, strict) =>
      (!strict || Math.abs(x - ham.x) > 34 * ham.s + 40 * k) &&
      Math.abs(x - dolphin.x) > 90 * k &&
      palms.every((p) => {
        const [cx, cy] = crown(p),
          L = p.h * 0.42,
          low = cy + L * 0.6 > mer.y - 80 * merS(),
          a = Math.min(p.x, low ? cx - L : cx) - (low ? 20 : 60) * k,
          b = Math.max(p.x, low ? cx + L : cx) + (low ? 20 : 60) * k;
        return x < a || x > b;
      });
    let x = F.x + F.w * 0.64;
    search: for (const strict of [true, false])
      for (let i = 0; i < 24; i++) {
        const c = F.x + F.w * rnd(0.15, 0.85);
        if (ok(c, strict)) {
          x = c;
          break search;
        }
      }
    Object.assign(mer, { st: 'up', t: 0, x, look: rnd(5.2, 6.8), side: pick([-1, 1]) });
    rings.push({ x, y: mer.y, t: 0 });
    sfx('bubble');
  }
  function merSet(st) {
    mer.st = st;
    mer.t = 0;
    if (st === 'dive') {
      rings.push({ x: mer.x, y: mer.y, t: 0 });
      sfx('splash');
    }
  }
  function merTap() {
    merSet('wave');
    note('mermaid');
    sfx('magic');
    pop(mer.x, mer.y - 100 * merS(), pick(['💙', '✨💙✨']), 20 * Math.max(k, 0.8));
  }

  const towerTop = () => hy - 48 * tower.s; // фонарь маяка
  // нажатие в x, y (с запасом pad) заберёт пальма: ствол или крона ближе к нам, чем море и горизонт (см. down).
  // Гости, которые выбирают место сами (батискаф, дельфин, корабль для автотеста), за пальмой не появляются
  const palmAt = (x, y, pad) =>
    palms.some((p) => {
      const [cx, cy] = crown(p);
      const trunk = lerp(p.x, cx, clamp((p.y - y) / p.h, 0, 1));
      return (Math.abs(x - trunk) < 22 * k + pad && y < p.y && y > cy) || near(x, y, cx, cy, p.h * 0.34 + pad);
    });
  // выбрать место: n попыток pick(), первое, где ok; не нашлось — запасное
  const spot = (pick, ok, spare, n = 24) => {
    for (let i = 0; i < n; i++) {
      const c = pick();
      if (ok(c)) return c;
    }
    return spare;
  };
  // остров по очертанию (paintIsle): вулкан — до 57 единиц рисунка над водой, берега — около 14; чуть с запасом
  const onIsle = (x, y) => {
    const u = (x - isle.x) / isle.s;
    if (u < -124 || u > 128 || y > hy + 6 * k) return false;
    const top = Math.max(14, 57 - Math.max(0, -25 - u, u + 9) * 1.03) + 6;
    return y > hy - top * isle.s - 6 * k;
  };
  function turtleGo() {
    // выползает из-за края свободного места (справа — только если там нет кнопок) и идёт наискосок к воде
    const right = F.x + F.w > W - 10 && Math.random() < 0.5,
      band = bot - sy;
    // путь — по одну сторону от хомячка: он стоит ближе к нам в down() и забрал бы нажатие по черепашке
    const x = right ? W + 24 * k : F.x - 24 * k,
      dir = right ? -1 : 1,
      gap = 34 * ham.s + 36 * Math.max(k, 0.7);
    let tx = clamp(x + dir * F.w * rnd(0.3, 0.45), F.x + 30 * k, F.x + F.w - 30 * k);
    tx = dir > 0 ? Math.min(tx, ham.x - gap) : Math.max(tx, ham.x + gap);
    Object.assign(turtle, { st: 'walk', t: 0, x, y: sy + band * rnd(0.72, 0.9), dir, tx, ty: shoreY(tx, 0) + 10 * k });
  }
  // ---------- корабли ----------
  const shipY = (lane) => (lane === 'far' ? hy + 1 * k : lerp(hy, sy, 0.3)); // ватерлиния полосы
  const funnelX = (sh) => (sh.type === 'liner' ? -14 : 0) * sh.dir; // труба (откуда дымок), в единицах рисунка
  function newShip(type, lane, dir, x) {
    return { type, lane, x, dir, honk: -9, taps: [], flags: -99, puffs: [], id: ++shipSeq };
  }
  function onShip(sh, x, y, R) {
    const sp = SHIPS[sh.type],
      u = k * LANE_U[sh.lane],
      y0 = shipY(sh.lane);
    return (
      Math.abs(x - sh.x) < Math.max(sp.len * u * 0.5, R) && y < y0 + R * 0.5 && y > y0 - Math.max(sp.top * u, R * 1.2)
    );
  }
  function shipTap(sh) {
    const sp = SHIPS[sh.type],
      u = k * LANE_U[sh.lane];
    sh.honk = T;
    sh.taps = sh.taps.filter((t) => T - t < 1.3).concat(T);
    note('ship');
    note('ship-' + sh.type);
    if (sh.taps.length >= 3 && T - sh.flags > 5) {
      // три раза подряд — сигнальные флажки
      sh.flags = T;
      sh.taps = [];
      note('ship-flags');
      sfx('fanfare');
      pop(sh.x, shipY(sh.lane) - (sp.top + 22) * u, '🚩 Привет!', 16 * Math.max(k, 0.8));
      return;
    }
    sfx(sp.snd);
    pop(sh.x, shipY(sh.lane) - (sp.top + 16) * u, sp.say, 16 * Math.max(k, 0.8));
  }
  const subUp = () => {
    if (sub.t < 0) return 0;
    return ease(clamp(Math.min(sub.t / 1.4, (sub.dur - sub.t) / 1.4), 0, 1));
  };
  function subGo() {
    // не за русалочкой, хомячком и пальмой: ствол и крона ближе к нам и забрали бы нажатие по батискафу (down)
    const y = shipY('near') - 14 * k;
    const busy = (x) =>
      Math.abs(x - mer.x) < 80 * k || Math.abs(x - ham.x) < 34 * ham.s + 30 * k || palmAt(x, y, 30 * k);
    const x = spot(
      () => F.x + F.w * rnd(0.22, 0.78),
      (c) => !busy(c),
      F.x + F.w * 0.5,
    );
    Object.assign(sub, { t: 0, x, hi: -9 });
    rings.push({ x, y: shipY('near'), t: 0 });
    sfx('bubble');
  }
  function subTap() {
    sub.hi = T;
    sub.t = Math.max(sub.t, sub.dur - 3); // посмотрел в перископ — и погружается
    note('sub');
    sfx('bubble');
    setTimeout(() => !dead && sfx('bubble'), 200);
    pop(sub.x, shipY('near') - 50 * k, 'Буль-буль!', 16 * Math.max(k, 0.8));
  }
  // для автотеста: в точке x, y у горизонта нет ничего ближе (кораблика, дельфина) — нажатие достанется дальнему.
  // Облака — позади острова и маяка (drawFar) и нажатие у них не забирают
  const farSky = (x, y) => fleet.every((sh) => !onShip(sh, x, y, 0)) && dolphin.t < 0;

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
    // сам по себе
    if (ham.st === 'idle' && ham.press === null && !grab && T - idleAt > idleWait) busyGo();
    if (ham.st === 'busy') {
      const c = castles[castles.length - 1];
      if ((ham.act === 'castle' || ham.act === 'snowball') && c && c.gone === null)
        c.g = Math.min(1, c.g + dt / (ham.dur * 0.7));
      if (ham.t > ham.dur) {
        hamDo('idle');
        ham.act = null;
        idleAt = T;
        idleWait = rnd(20, 30);
      }
    }
    for (let i = castles.length - 1; i >= 0; i--)
      if (castles[i].gone !== null && T - castles[i].gone > 1.4) castles.splice(i, 1);
    // большая волна: смывает рисунок, хомячок отпрыгивает
    const sg = surge();
    if (sg > 0) {
      for (const st of strokes) {
        // смытые точки убираем; линия после смытого куска начинается заново
        let cut = false,
          n = 0;
        for (const q of st) {
          if (q.y < shoreY(q.x, sg) + 6 * k) cut = true;
          else {
            if (cut) q.j = 1;
            cut = false;
            st[n++] = q;
          }
        }
        if (n < st.length) {
          st.length = n;
          inkV++;
        }
      }
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
      c.x += c.sp * (windy ? 2.3 : 1) * k * dt; // ветер (лепестки, листья) гонит облака, а кораблик — нет
      if (c.x > W + 120 * k) c.x = -120 * k;
      c.t = Math.min(1, c.t + dt / 0.8);
    }
    for (let i = fleet.length - 1; i >= 0; i--) {
      const sh = fleet[i],
        sp = SHIPS[sh.type];
      sh.x += sh.dir * sp.sp * k * dt;
      const u = k * LANE_U[sh.lane],
        m = sp.len * u * 0.6 + 20 * k;
      if ((sh.dir > 0 && sh.x > W + m) || (sh.dir < 0 && sh.x < -m)) {
        fleet.splice(i, 1);
        fleetNext = Math.max(fleetNext, T + rnd(6, 20));
        continue;
      }
      if (T - sh.honk < 1.2 && (sh.type === 'boat' || sh.type === 'liner') && Math.random() < dt * 9)
        sh.puffs.push({ x: sh.x + funnelX(sh) * u, y: shipY(sh.lane) - sp.top * u, t: 0 });
      for (let j = sh.puffs.length - 1; j >= 0; j--) if ((sh.puffs[j].t += dt) > 2) sh.puffs.splice(j, 1);
    }
    if (T > fleetNext && fleet.length < 2) {
      // свободная полоса: на каждой — не больше одного корабля; пока всплыл батискаф, ближняя занята им
      const lanes = ['far', 'near'].filter((l) => !fleet.some((sh) => sh.lane === l) && !(l === 'near' && sub.t >= 0));
      if (lanes.length) {
        const lane = pick(lanes),
          type = pick(Object.keys(SHIPS).filter((t) => SHIPS[t].lane === lane)),
          dir = pick([-1, 1]),
          u = k * LANE_U[lane];
        fleet.push(newShip(type, lane, dir, dir > 0 ? -SHIPS[type].len * u * 0.55 : W + SHIPS[type].len * u * 0.55));
      }
      fleetNext = T + rnd(20, 45);
    }
    // батискаф: не вместе с русалочкой и дельфином, ближняя полоса свободна
    if (sub.t < 0) {
      if (guests && T > sub.next && mer.st === 'off' && dolphin.t < 0 && !fleet.some((sh) => sh.lane === 'near'))
        subGo();
    } else if ((sub.t += dt) > sub.dur) {
      sub.t = -1;
      sub.next = T + rnd(240, 420);
      rings.push({ x: sub.x, y: shipY('near'), t: 0 });
    } else if (Math.random() < dt * 3) rings.push({ x: sub.x + rnd(-14, 14) * k, y: shipY('near') + 2 * k, t: 0.8 });
    // рыбки, круги, дельфин
    for (let i = jumps.length - 1; i >= 0; i--) {
      const j = jumps[i];
      j.t += dt;
      const end = j.dur + j.lag * (j.n - 1);
      if (j.t > end) {
        rings.push({ x: j.x + j.dir * j.len * k * j.s, y: j.y, t: 0 });
        jumps.splice(i, 1);
      }
    }
    for (let i = rings.length - 1; i >= 0; i--) if ((rings[i].t += dt) > 1.6) rings.splice(i, 1);
    if (dolphin.t < 0 && T > dolphin.next && mer.st === 'off') {
      // не за пальмой и не за кораблём: они ближе и забрали бы нажатие
      const R = 30 * Math.max(k, 0.7),
        y = hy + 14 * k;
      dolphin.t = 0;
      dolphin.x = spot(
        () => F.x + F.w * rnd(0.2, 0.8),
        (x) =>
          !palmAt(x, y, R * 1.6) &&
          fleet.every((sh) => Math.abs(x - sh.x) > SHIPS[sh.type].len * k * LANE_U[sh.lane] * 0.5 + R * 1.6),
        F.x + F.w * rnd(0.2, 0.8),
      );
    }
    if (dolphin.t >= 0 && (dolphin.t += dt) > 1.5) {
      rings.push({ x: dolphin.x + 50 * k, y: hy + 16 * k, t: 0 });
      dolphin.t = -1;
      dolphin.next = T + rnd(35, 70); // редкий гость
    }
    // русалочка: не одновременно с дельфином
    if (mer.st === 'off') {
      if (guests && T > mer.next && dolphin.t < 0 && sub.t < 0) merGo();
    } else {
      mer.t += dt;
      const was = mer.t - dt;
      if (mer.st === 'up' && mer.t > 1.6) merSet('look');
      else if (mer.st === 'look' && mer.t > mer.look) merSet('dive');
      else if (mer.st === 'wave' && mer.t > 1.5) merSet('dive');
      else if (mer.st === 'dive') {
        if (was < 0.95 && mer.t >= 0.95) rings.push({ x: mer.x + mer.side * 10 * k, y: mer.y, t: 0 }); // хвост ушёл под воду
        if (mer.t > 1.7) {
          mer.st = 'off';
          mer.next = T + rnd(...MER_GAP);
          dolphin.next = Math.max(dolphin.next, T + 5);
        }
      }
    }
    // самолётик
    if (planeOn()) {
      plane.t += dt;
      if (plane.t > plane.dur + (T - plane.trick < PLANE_TRICK ? 2 : 0)) {
        plane.t = -1;
        plane.next = T + rnd(...PLANE_GAP);
      }
    } else if (guests && T > plane.next) planeGo();
    for (let i = plane.hearts.length - 1; i >= 0; i--) {
      const h = plane.hearts[i];
      h.t += dt;
      h.y -= 3 * k * dt;
      h.x += (windy ? 14 : 4) * k * dt;
      if (h.t > 4.5) plane.hearts.splice(i, 1);
    }
    if (Math.random() < dt / 11 && jumps.length < 2) {
      // рыбки иногда прыгают сами
      const x = F.x + F.w * rnd(0.1, 0.9),
        y = rnd(hy + 16 * k, sy - 24 * k);
      fishJump(x, y);
    }
    // морская звезда: волна выносит её на песок
    const band = bot - sy;
    if (starfish.st === 'off') {
      if ((guests || starfish.next === 0) && T > starfish.next && T - wave.t > 3.4 && !drawing) {
        // не рядом с теми, кто в down() раньше звезды и забрал бы нажатие: хомячок, черепашка, кокосы, краб, чайка
        // (стоит на песке на той же высоте), ракушка
        const R = 30 * Math.max(k, 0.7);
        const ok = (x) =>
          Math.abs(x - ham.x) > 34 * ham.s + 24 * k &&
          Math.abs(x - crab.hx) > 50 * k &&
          Math.abs(x - shell.x) > 40 * k &&
          Math.abs(x - gull.hx) > R * 2.4 &&
          (turtle.st === 'off' || Math.abs(x - turtle.x) > R * 2.4) &&
          nuts.every((n) => Math.abs(x - n.x) > R * 2.2);
        const x = spot(() => F.x + F.w * rnd(0.12, 0.88), ok, F.x + F.w * 0.3, 40);
        Object.assign(starfish, { st: 'sand', x, y: sy + band * rnd(0.12, 0.2), born: T, t: 0 });
        bigWave(band * 0.3);
      }
    } else {
      starfish.t += dt;
      if (starfish.st === 'sand' && T - starfish.born > 45)
        [starfish.st, starfish.t] = ['crawl', 0]; // полежала — уползает
      else if (starfish.st === 'tickle' && starfish.t > 1) [starfish.st, starfish.t] = ['crawl', 0];
      else if (starfish.st === 'crawl') {
        starfish.y -= 11 * k * dt;
        if (starfish.y < shoreY(starfish.x, 0) + 6 * k) {
          starfish.st = 'off';
          starfish.next = T + rnd(45, 90);
          rings.push({ x: starfish.x, y: shoreY(starfish.x, 0) - 6 * k, t: 0 });
        }
      }
    }
    // черепашка: из-за края — наискосок к морю
    if (turtle.st === 'off') {
      if (guests && T > turtle.next) turtleGo();
    } else {
      turtle.t += dt;
      if (turtle.st === 'walk') {
        const dx = turtle.tx - turtle.x,
          dy = turtle.ty - turtle.y,
          dd = Math.hypot(dx, dy),
          v = 13 * k * dt;
        turtle.step += dt;
        if (dd < v) [turtle.st, turtle.t] = ['swim', 0];
        else {
          turtle.x += (dx / dd) * v;
          turtle.y += (dy / dd) * v;
        }
      } else if (turtle.st === 'hide' && turtle.t > 2.6) [turtle.st, turtle.t] = ['walk', 0];
      else if (turtle.st === 'swim' && turtle.t > 1.2) {
        turtle.st = 'off';
        turtle.next = T + rnd(100, 200);
        rings.push({ x: turtle.x, y: turtle.y - 4 * k, t: 0 });
      }
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
        d.y += (hard ? 760 : 620) * d.z * dt;
        d.x -= (hard ? 260 : 120) * d.z * dt;
      } else if (snow) {
        d.y += (hard ? 90 : 46) * d.z * dt;
        d.x += (Math.sin(T * 1.3 + d.ph) * 18 - (hard ? 150 * d.z : 0)) * dt;
      } else {
        d.x += 130 * d.z * dt;
        d.y += (26 + Math.sin(T * 2 + d.ph) * 40) * dt;
      }
      if (d.y > H + 14 || d.x > W + 50 || d.x < -50) drops[i] = newDrop(false);
    }
    // гроза: за каждой вспышкой — тихий раскат грома
    if (storm) {
      const n = lightningNo(T);
      if (bolt !== null && n !== bolt) setTimeout(() => sfx('thunder', 0.8), 800);
      bolt = n;
    }
    for (let i = texts.length - 1; i >= 0; i--) if ((texts[i].t += dt) > texts[i].life) texts.splice(i, 1);
  }

  // рисование — в title_art.js; S — что ему видно отсюда (let — через геттеры: значения меняются)
  const S = {
    canvas,
    crab,
    crown,
    ctx,
    dk,
    dolphin,
    drops,
    dusk,
    feathers,
    fly,
    gull,
    ham,
    hamTop,
    jumps,
    kite,
    kitePos,
    look,
    castles,
    isle,
    tower,
    starfish,
    turtle,
    wave,
    towerTop,
    mer,
    merS,
    merUp,
    night,
    plane,
    planeOn,
    planePos,
    planeSpan,
    palmAt,
    clouds,
    rain,
    rings,
    shell,
    fleet,
    sub,
    subUp,
    shipY,
    SHIPS,
    LANE_U,
    shoreY,
    hard,
    snow,
    snowman,
    star,
    stars,
    strokes,
    sway,
    windy,
    winter,
    get F() {
      return F;
    },
    get H() {
      return H;
    },
    get T() {
      return T;
    },
    get W() {
      return W;
    },
    get bg() {
      return bg;
    },
    set bg(v) {
      bg = v;
    },
    get bot() {
      return bot;
    },
    get dpr() {
      return dpr;
    },
    get hy() {
      return hy;
    },
    get inkV() {
      return inkV;
    },
    get k() {
      return k;
    },
    get sy() {
      return sy;
    },
  };
  const {
    paintBg,
    drawFar,
    label,
    drawSea,
    drawFish,
    drawShip,
    drawShipLights,
    drawSub,
    drawCloud,
    drawPalm,
    drawNut,
    drawCrab,
    drawGull,
    drawShell,
    drawSnowman,
    drawCastle,
    drawStarfish,
    drawTurtle,
    drawKite,
    drawStrokes,
    drawHam,
    drawFly,
    drawWeather,
    drawNightSky,
    drawPlane,
    drawPlaneLights,
    drawIsleSmoke,
    drawIsleLights,
    drawBeam,
    drawMermaid,
    drawMermaidGlow,
  } = createTitleArt(S);
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
    for (const c of clouds) drawCloud(c); // облака — позади острова и маяка (drawFar)
    drawFar();
    drawIsleSmoke();
    for (const sh of fleet) if (sh.lane === 'far') drawShip(sh);
    drawPlane(); // далеко над морем — за пальмами
    drawFish();
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
    drawSub();
    for (const sh of fleet) if (sh.lane === 'near') drawShip(sh);
    drawBeam(); // под пальмами и хомячком: луч идёт по морю
    drawMermaid();
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
    for (const c of castles) if (c.g > 0.02) things.push([c.y, () => drawCastle(c)]);
    if (starfish.st !== 'off') things.push([starfish.y - 20 * k, drawStarfish]); // плоская — под всеми, кто рядом
    if (turtle.st !== 'off') things.push([turtle.y, drawTurtle]);
    things.sort((a, b) => a[0] - b[0]);
    for (const th of things) th[1]();
    drawFly(false);
    drawWeather();
    if (rain) {
      // тучи: серая пелена, в ливень гуще, в грозу — тёмная; вспышка молнии на миг освещает весь берег
      ctx.fillStyle = storm
        ? `rgba(40,48,84,${0.36 * (1 - dk * 0.7)})`
        : `rgba(60,72,95,${(hard ? 0.26 : 0.16) * (1 - dk * 0.7)})`;
      ctx.fillRect(0, 0, W, H);
      const fl = storm ? lightning(T) : 0;
      if (fl > 0.02) {
        ctx.fillStyle = `rgba(255,252,235,${(0.24 * fl).toFixed(3)})`;
        ctx.fillRect(0, 0, W, H);
      }
    } else if (snow && hard) {
      ctx.fillStyle = `rgba(232,238,248,${0.2 * (1 - dk * 0.7)})`; // метель: белая мгла
      ctx.fillRect(0, 0, W, H);
    }
    if (dk > 0) {
      ctx.fillStyle = `rgba(10,16,58,${(rain ? 0.5 : 0.58) * dk})`;
      ctx.fillRect(0, 0, W, H);
      drawNightSky();
      drawIsleLights();
      drawShipLights();
      drawPlaneLights();
      drawMermaidGlow();
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
    if (e.pointerId !== pid) return;
    // между кадрами браузер склеивает движения в одно событие — берём их все: так быстрый росчерк точнее
    const all = grab && grab.kind === 'draw' && e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    for (const c of all.length ? all : [e]) move(...pt(c));
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
      releaseTitleArt(); // кадры самолётика, кораблей, русалочки… — в общем пределе памяти, в игре не нужны
      S.bg = null; // небо, море и песок — канва во весь экран
      S.far = null; // остров и маяк — полоска у горизонта
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
        env: { minutes: m, weather, force: o.force || 0, season, night, rain, snow, windy, winter, hard, storm },
        free: F,
        k,
        log: log.slice(),
        ham: {
          ...P(ham.x, ham.y - 40 * ham.s),
          st: ham.st,
          act: ham.act,
          castles: castles.filter((c) => c.gone === null).length,
          top: Math.round(hamTop() + r.top),
          s: ham.s,
        },
        palm: { ...P(cx, cy), nuts: palms[0].nuts.slice(), bend: palms[0].bend },
        trunk: P(lerp(palms[0].x, cx, 0.5), palms[0].y - palms[0].h * 0.5),
        nuts: nuts.map((n) => ({ ...P(n.x, n.y - 9 * k), still: n.vy === 0 && n.vx === 0 })),
        crab: { ...P(crab.x, crab.y - 8 * k), st: crab.st, hole: P(crab.hx, crab.hy) },
        gull: { ...P(gull.x, gull.y - 16 * k), st: gull.st, feathers: feathers.length },
        shell: { ...P(shell.x, shell.y - 6 * k), st: shell.st },
        cloud: (() => {
          // облако, которое не прячется за кроной пальмы, маяком или островом
          const R = 30 * Math.max(k, 0.7);
          const far = (c) =>
            near(c.x, c.y, tower.x, towerTop() + 16 * tower.s, Math.max(R, 34 * tower.s)) || onIsle(c.x, c.y)
              ? -1e6
              : Math.min(...palms.map((p) => Math.hypot(c.x - crown(p)[0], c.y - crown(p)[1]) - p.h * 0.34));
          const c =
            clouds.filter((c) => c.x > 60 && c.x < F.x + F.w - 60).sort((a, b) => far(b) - far(a))[0] || clouds[0];
          return { ...P(c.x, c.y), shape: CLOUD_ORDER[c.shape] };
        })(),
        ship: (() => {
          // корабль для автотеста: в свободной части экрана, предпочтительно дальний (первый)
          const inF = fleet.filter((sh) => sh.x > F.x + 20 && sh.x < F.x + F.w - 20);
          const sh = inF.find((sh) => sh.lane === 'far') || inF[0] || fleet[0];
          if (!sh) return { x: -999, y: -999, type: null };
          const u = k * LANE_U[sh.lane];
          return { ...P(sh.x, shipY(sh.lane) - Math.min(SHIPS[sh.type].top * u * 0.35, 12 * k)), type: sh.type, id: sh.id, flags: T - sh.flags < 5 }; // prettier-ignore
        })(),
        fleet: fleet.map((sh) => ({ type: sh.type, lane: sh.lane, ...P(sh.x, shipY(sh.lane) - Math.min(SHIPS[sh.type].top * k * LANE_U[sh.lane] * 0.35, 12 * k)), id: sh.id, flags: T - sh.flags < 5 })), // prettier-ignore
        sub: { on: sub.t >= 0, up: Math.round(subUp() * 100) / 100, ...P(sub.x, shipY('near') - 14 * k) },
        clouds: clouds.map((c) => Math.round(c.x * 10) / 10),
        shipX: (() => {
          const sh = fleet.find((sh) => sh.lane === 'far');
          return sh ? Math.round(sh.x * 10) / 10 : null;
        })(),
        sea: P(F.x + F.w * 0.45, lerp(hy, sy, 0.6)),
        shore: P(clear(F.x + F.w * 0.4, sy + 6 * k), sy + 6 * k),
        sand: P(clear(F.x + F.w * 0.36, lerp(sy, bot, 0.5)), lerp(sy, bot, 0.5)),
        sky: P(F.x + F.w * 0.45, F.y + (hy - F.y) * 0.3),
        kite: P(...kitePos()),
        snowman: P(snowman.x, snowman.y - 38 * k),
        starfish: {
          st: starfish.st,
          shown: starfish.st === 'sand' && T - starfish.born > 1.6,
          ...P(starfish.x, starfish.y),
        },
        turtle: {
          st: turtle.st,
          ...P(turtle.x, turtle.y - 12 * k),
          in: turtle.x > F.x + 20 && turtle.x < F.x + F.w - 20,
        },
        fly: { ...P(fly.x, fly.y), st: fly.st },
        dolphin: { on: dolphin.t >= 0, ...P(dolphin.x, hy + 14 * k) },
        isle: (() => {
          // точка острова, не закрытая кроной пальмы (на телефоне левая крона закрывает его часть)
          const R = 30 * Math.max(k, 0.7),
            y = hy - 14 * isle.s;
          const xs = [-10, 10, 30, 45, -40, -60].map((dx) => isle.x + dx * isle.s);
          const x = xs.find((x) => palms.every((p) => !near(x, y, ...crown(p), p.h * 0.34 + R))) ?? xs[0];
          // palm — вулкан за кроной пальмы
          return { ...P(x, y), clear: farSky(x, y), puff: T - isle.puff < 2.5, smoke: T - isle.puff < 5.5, palm: palmAt(isle.x - 17 * isle.s, hy - 30 * isle.s, 0) }; // prettier-ignore
        })(),
        tower: { ...P(tower.x, towerTop() + 16 * tower.s), clear: farSky(tower.x, towerTop() + 16 * tower.s), beam: T - tower.beam < 2, palm: palmAt(tower.x, towerTop(), 0) }, // prettier-ignore
        plane: (() => {
          const [x, y] = planePos();
          return { on: planeOn(), ...P(x, y), hidden: palmAt(x, y, 0), dir: plane.dir, trick: T - plane.trick < PLANE_TRICK, hearts: plane.hearts.length, top: Math.round(planeBand()[0] + r.top) }; // prettier-ignore
        })(),
        mermaid: { st: mer.st, ...P(...merHit()), water: Math.round(mer.y + r.top) },
        drawn: strokes.reduce((n, st) => n + st.length, 0),
        // сколько кусков у рисунка (линия начинается заново) и самый большой шаг между точками внутри куска
        ink: strokes.map((st) => ({
          pieces: st.filter((q) => q.j).length,
          gap: Math.round(Math.max(0, ...st.map((q, i) => (i && !q.j ? Math.hypot(q.x - st[i - 1].x, q.y - st[i - 1].y) : 0)))), // prettier-ignore
        })),
        jumps: jumps.length,
        wave: T - wave.t < 3.4,
        star: starShown,
      };
    },
    /** Для автотеста: позвать редкого гостя сейчас. */
    callDolphin() {
      dolphin.next = 0;
    },
    /** Для автотеста: пустить корабль type (boat, liner, trawler, yacht) на его полосу — в середину экрана. */
    callShip(type) {
      const lane = SHIPS[type].lane;
      for (let i = fleet.length - 1; i >= 0; i--) if (fleet[i].lane === lane) fleet.splice(i, 1);
      // не за пальмой: её ствол и крона ближе и забрали бы нажатие
      const R = 30 * Math.max(k, 0.7),
        u = k * LANE_U[lane],
        x0 = F.x + F.w * (lane === 'far' ? 0.5 : 0.68);
      const free = (x) =>
        [-0.4, 0, 0.4].every((d) => !palmAt(x + d * SHIPS[type].len * u, shipY(lane) - SHIPS[type].top * u * 0.35, R));
      const xs = [0, 0.08, -0.08, 0.16, -0.16, 0.24, -0.24].map((d) => x0 + d * F.w);
      fleet.push(newShip(type, lane, 1, xs.find(free) ?? x0));
      fleetNext = T + 1e6;
    },
    /** Для автотеста: убрать корабли с горизонта (они ближе острова и маяка и забрали бы нажатие). */
    clearHorizon() {
      fleet.length = 0;
      fleetNext = T + 1e6;
    },
    /** Для автотеста: поставить облако i серединой в точку x, y окна (облака позади острова и маяка). */
    cloudAt(i, x, y) {
      const r = canvas.getBoundingClientRect();
      clouds[i].x = x - r.left;
      clouds[i].y = y - r.top;
    },
    /** Для автотеста: хомячку сейчас наскучило — он сам находит занятие (act — какое, если оно подходит к погоде). */
    idleNow(act) {
      if (ham.st !== 'idle') hamDo('idle');
      busyGo(act);
      if (act === 'castle' || act === 'snowball') ham.dur = 3;
    },
    /** Для автотеста: волна сейчас вынесет морскую звезду. */
    callStarfish() {
      starfish.st = 'off';
      starfish.next = 0;
      wave.t = -9;
    },
    /** Для автотеста: черепашка сразу на песке, в свободной части (ползёт к морю). */
    callTurtle() {
      turtleGo();
      // там, где рядом нет ни ракушки, ни хомячка, ни краба
      const xs = [0.4, 0.62, 0.3, 0.2, 0.85, 0.12].map((f) => F.x + F.w * f);
      turtle.x = xs.find((x) => Math.abs(x - shell.x) > 50 * k && Math.abs(x - ham.x) > 34 * ham.s + 30 * k && Math.abs(x - crab.x) > 50 * k) ?? xs[0]; // prettier-ignore
    },
    /** Для автотеста: всплыть батискафу сейчас. */
    callSub() {
      for (let i = fleet.length - 1; i >= 0; i--) if (fleet[i].lane === 'near') fleet.splice(i, 1);
      mer.st = 'off';
      if (sub.t < 0) subGo();
      sub.dur = 30;
    },
    /** Для автотеста: позвать самолётик сейчас (летит из-за края). */
    callPlane() {
      if (!planeOn()) planeGo();
    },
    /** Для автотеста и снимков: самолётик сейчас на доле пути q (0..1), на высоте fy (0 — верх неба, 1 — низ). */
    planeAt(q, fy = 0.6) {
      if (!planeOn()) planeGo();
      plane.t = q * plane.dur;
      plane.fy = fy;
    },
    /** Для автотеста: позвать русалочку сейчас (сразу показать её над водой — st 'look'). */
    callMermaid(now = true) {
      dolphin.t = -1;
      if (mer.st === 'off') merGo();
      if (now) merSet('look');
      mer.look = 30;
    },
    /** Для автотеста: редкие гости (самолётик, русалочка, дельфин) сами не приходят — нажатия по небу и морю
     * достаются облакам, кораблику и рыбкам. */
    guests(on) {
      guests = !!on;
      if (!on) dolphin.next = 1e9;
    },
    /** Для автотеста: поставить бабочку (светлячков) в точку x, y окна — проверить, что она не перехватит нажатие. */
    flyAt(x, y) {
      const r = canvas.getBoundingClientRect();
      fly.st = 'roam';
      fly.next = T + 30;
      fly.x = x - r.left;
      fly.y = y - r.top;
    },
  };
}
