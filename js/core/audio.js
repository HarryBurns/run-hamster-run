// Звук игры (этап 9б — живые звуки и музыка из файлов, CC0 / CC BY; авторы — data/credits.js и CREDITS.md).
//  • sfx(name)        — короткие звуки (шаги, монетки, двери…): запись из assets/audio/sfx (SFX_FILES), а пока
//                       файл не загрузился или его нет — мягкий синтез (SOUNDS)
//  • setMusic(track)  — фоновая музыка: файлы из assets/audio/music (MUSIC_FILES) с плавным переходом; если файла
//                       нет — мелодия сочиняется на ходу по простым правилам (TRACKS), как раньше
//  • setAmbience({})  — окружение: шум моря, дождь, птицы, сверчки, капли
// Всё грузится лениво — после первого нажатия (раньше браузер звук не разрешает): звуки — фоном, музыка — по треку.
let ac = null;
let master = null,
  sfxBus = null,
  softBus = null,
  musicBus = null,
  ambBus = null,
  delayIn = null;
let noiseBuf = null,
  meter = null;
let timer = 0;

const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem(k);
      return v === null ? d : v;
    } catch (e) {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch (e) {
      /* не страшно */
    }
  },
};
let muted = store.get('rhr-muted', '0') === '1';
let musicOn = store.get('rhr-music', '1') === '1';
// по умолчанию музыка тише звуков (этап 9б: 0.6 → 0.45); кто уже двигал ползунок — у того его громкость
let musicVol = Math.min(1, Math.max(0, parseFloat(store.get('rhr-music-vol', '0.45')) || 0));

function ctx() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = 0.9;
    // ограничитель: если звуков сразу много, они не захрипят
    const limiter = ac.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 8;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.004;
    limiter.release.value = 0.2;
    master.connect(limiter);
    limiter.connect(ac.destination);
    meter = ac.createAnalyser();
    meter.fftSize = 2048;
    limiter.connect(meter);
    sfxBus = ac.createGain();
    sfxBus.gain.value = muted ? 0 : 1;
    sfxBus.connect(master);
    // синтезированные звуки — тише и без резких верхов (этап 9б): через мягкий фильтр
    softBus = ac.createGain();
    softBus.gain.value = 0.7;
    const soft = ac.createBiquadFilter();
    soft.type = 'lowpass';
    soft.frequency.value = 5200;
    soft.Q.value = 0.5;
    softBus.connect(soft);
    soft.connect(sfxBus);
    ambBus = ac.createGain();
    ambBus.gain.value = muted ? 0 : 1;
    const ambSoft = ac.createBiquadFilter();
    ambSoft.type = 'lowpass';
    ambSoft.frequency.value = 6000;
    ambSoft.Q.value = 0.5;
    ambBus.connect(ambSoft);
    ambSoft.connect(master);
    musicBus = ac.createGain();
    musicBus.gain.value = musicOn ? musicVol : 0;
    musicBus.connect(master);
    // лёгкое эхо, чтобы музыка звучала объёмнее
    const delay = ac.createDelay(1);
    delay.delayTime.value = 0.29;
    const fb = ac.createGain();
    fb.gain.value = 0.26;
    const wet = ac.createGain();
    wet.gain.value = 0.22;
    delayIn = ac.createGain();
    delayIn.connect(delay);
    delay.connect(fb);
    fb.connect(delay);
    delay.connect(wet);
    wet.connect(musicBus);
    // шум для моря, дождя и «шуршащих» звуков
    const len = ac.sampleRate * 2;
    noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // два «проигрывателя» музыки: один играет, второй плавно вступает при смене трека
    try {
      decks = [makeDeck(), makeDeck()];
    } catch (e) {
      decks = []; // нет MediaElementSource — останется синтез
    }
  }
  return ac;
}
let unlocked = false;
/** Разрешить звук: вызывать из нажатия (браузеры дают звук только после первого жеста игрока). */
export function unlockAudio() {
  const a = ctx();
  if (!a) return;
  if (a.state === 'suspended' && !document.hidden) a.resume();
  if (!timer) timer = setInterval(tick, 50);
  // iPad/iPhone: проигрыватель музыки можно запускать без нажатия, только если он хоть раз заиграл от нажатия
  for (const d of decks) {
    if (d.blessed) continue;
    d.blessed = true;
    if (d.busy) continue;
    d.el.src = BASE + 'sfx/tick.mp3'; // тихо: громкость проигрывателя пока 0
    const pr = d.el.play();
    if (pr && pr.then) pr.then(() => d.busy || d.el.pause()).catch(() => {});
  }
  if (curDeck && curDeck.el.paused && !document.hidden) playEl(curDeck);
  if (!unlocked) {
    unlocked = true;
    setTimeout(loadSfx, 250); // звуки — фоном, не мешая первому кадру
  }
}
// первое нажатие где угодно (заставка, окна) тоже разрешает звук — не только по холсту
for (const ev of ['pointerdown', 'touchend', 'keydown'])
  document.addEventListener(ev, unlockAudio, { capture: true, passive: true });
document.addEventListener('visibilitychange', () => {
  if (!ac) return;
  if (document.hidden) {
    ac.suspend();
    if (curDeck) curDeck.el.pause();
  } else {
    ac.resume();
    if (curDeck) playEl(curDeck);
  }
});

/** Для тестов: текущая громкость на выходе { peak, rms } и состояние. */
export function debugLevel() {
  if (!meter) return null;
  const buf = new Float32Array(meter.fftSize);
  meter.getFloatTimeDomainData(buf);
  let peak = 0,
    sum = 0;
  for (const v of buf) {
    peak = Math.max(peak, Math.abs(v));
    sum += v * v;
  }
  return {
    peak,
    rms: Math.sqrt(sum / buf.length),
    state: ac.state,
    track: curId,
    file: curDeck ? curDeck.file : null, // какой файл музыки играет (null — синтез или тишина)
    synth: !!cur, // играет ли сочинённая мелодия (файла нет или он не загрузился)
  };
}
/** Для тестов: что загружено. */
export function debugAudio() {
  return {
    unlocked,
    sfxLoaded: Object.keys(sbuf).filter((k) => sbuf[k].length).length,
    sfxNames: Object.keys(SFX_FILES).length,
    sfxFailed: [...badSfx],
    musicFailed: [...badMusic],
    decks: decks.map((d) => ({ busy: d.busy, file: d.file, paused: d.el.paused, t: d.el.currentTime })),
    files: { music: MUSIC_FILES, sfx: sfxUrls() },
  };
}

// ---------- настройки ----------
export function isMuted() {
  return muted;
}
export function setMuted(m) {
  muted = m;
  store.set('rhr-muted', m ? '1' : '0');
  if (ac) {
    sfxBus.gain.setTargetAtTime(m ? 0 : 1, ac.currentTime, 0.05);
    ambBus.gain.setTargetAtTime(m ? 0 : 1, ac.currentTime, 0.05);
  }
}
export function isMusicOn() {
  return musicOn;
}
export function setMusicOn(on) {
  musicOn = on;
  store.set('rhr-music', on ? '1' : '0');
  if (ac) musicBus.gain.setTargetAtTime(on ? musicVol : 0, ac.currentTime, 0.1);
}
export function getMusicVolume() {
  return musicVol;
}
export function setMusicVolume(v) {
  musicVol = Math.min(1, Math.max(0, v));
  store.set('rhr-music-vol', String(musicVol));
  if (ac && musicOn) musicBus.gain.setTargetAtTime(musicVol, ac.currentTime, 0.05);
}

// ---------- кирпичики ----------
function tone(freq, t0, dur, type = 'sine', vol = 0.12, slideTo = null, dest = softBus) {
  const a = ac;
  if (!a) return;
  const t = a.currentTime + t0;
  const o = a.createOscillator(),
    g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(dest);
  o.start(t);
  o.stop(t + dur + 0.03);
}
function noise(t0, dur, vol = 0.08, freq = 1200, type = 'bandpass', dest = softBus, q = 1) {
  const a = ac;
  if (!a) return;
  const t = a.currentTime + t0;
  const src = a.createBufferSource();
  src.buffer = noiseBuf;
  const f = a.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = a.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f);
  f.connect(g);
  g.connect(dest);
  src.start(t, Math.random() * 1.5, dur + 0.05);
}

const SOUNDS = {
  tap: () => tone(660, 0, 0.07, 'triangle', 0.08),
  pop: () => tone(520, 0, 0.09, 'sine', 0.12, 900),
  open: () => {
    tone(420, 0, 0.08, 'sine', 0.07, 640);
    tone(640, 0.06, 0.1, 'sine', 0.06, 880);
  },
  coin: () => {
    tone(988, 0, 0.08, 'triangle', 0.06);
    tone(1319, 0.07, 0.16, 'triangle', 0.06);
  },
  ok: () => {
    tone(660, 0, 0.1, 'triangle');
    tone(880, 0.09, 0.16, 'triangle');
  },
  bad: () => {
    tone(300, 0, 0.16, 'triangle', 0.07, 220);
  },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.22, 'triangle', 0.12)),
  fanfare: () => {
    [523, 523, 523, 659, 784, 1047].forEach((f, i) =>
      tone(f, [0, 0.12, 0.24, 0.36, 0.5, 0.66][i], i === 5 ? 0.6 : 0.16, 'triangle', 0.12),
    );
    [262, 330, 392].forEach((f) => tone(f, 0.66, 0.6, 'sine', 0.06));
  },
  splash: () => {
    noise(0, 0.28, 0.12, 900);
    noise(0.05, 0.2, 0.06, 2200);
  },
  paddle: () => noise(0, 0.16, 0.05, 700 + Math.random() * 300),
  door: () => {
    tone(220, 0, 0.08, 'triangle', 0.06);
    tone(165, 0.08, 0.12, 'triangle', 0.06);
  },
  bell: () => {
    tone(1319, 0, 0.5, 'sine', 0.12);
    tone(2637, 0, 0.3, 'sine', 0.03);
    tone(1047, 0.32, 0.7, 'sine', 0.12);
    tone(2093, 0.32, 0.4, 'sine', 0.03);
  },
  ding: () => {
    tone(1568, 0, 0.45, 'sine', 0.1);
    tone(3136, 0, 0.2, 'sine', 0.025);
  },
  lift: () => tone(110, 0, 0.5, 'triangle', 0.04, 150),
  mail: () => {
    tone(784, 0, 0.1, 'triangle');
    tone(1047, 0.1, 0.1, 'triangle');
    tone(1319, 0.2, 0.2, 'triangle');
  },
  paper: () => {
    noise(0, 0.12, 0.05, 3000, 'highpass');
    noise(0.1, 0.1, 0.04, 2400, 'highpass');
  },
  magic: () => [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, i * 0.06, 0.2, 'sine', 0.08)),
  sticker: () => {
    tone(880, 0, 0.07, 'triangle', 0.1);
    tone(1175, 0.07, 0.07, 'triangle', 0.1);
    tone(1760, 0.14, 0.25, 'triangle', 0.1);
  },
  heart: () => {
    tone(784, 0, 0.12, 'sine', 0.1);
    tone(1175, 0.1, 0.25, 'sine', 0.1);
  },
  eat: () => {
    noise(0, 0.07, 0.09, 500);
    noise(0.14, 0.07, 0.09, 600);
    noise(0.28, 0.07, 0.08, 550);
  },
  tick: () => tone(1200, 0, 0.03, 'sine', 0.04),
  whistle: () => tone(1400, 0, 0.3, 'sine', 0.08, 1900),
  bubble: () => tone(300 + Math.random() * 400, 0, 0.12, 'sine', 0.06, 900),
  note: (f = 440) => {
    tone(f, 0, 0.5, 'triangle', 0.12);
    tone(f * 2, 0, 0.25, 'sine', 0.03);
  },
  flush: () => {
    noise(0, 1.1, 0.1, 400, 'lowpass');
    tone(180, 0, 0.9, 'sine', 0.03, 70);
  },
  spout: () => {
    noise(0, 0.9, 0.09, 2600, 'highpass');
    noise(0.05, 0.4, 0.08, 800);
  },
  hiss: () => noise(0, 1.2, 0.05, 3500, 'highpass'),
  sleep: () => [659, 523, 440, 349].forEach((f, i) => tone(f, i * 0.22, 0.4, 'sine', 0.09)),
  morning: () =>
    [392, 523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.13, i === 6 ? 0.5 : 0.14, 'triangle', 0.09)),
  dig: () => {
    noise(0, 0.12, 0.09, 300, 'lowpass');
    noise(0.13, 0.1, 0.07, 400, 'lowpass');
  },
  tvOn: () => {
    tone(200, 0, 0.12, 'sine', 0.05, 1200);
    noise(0.02, 0.12, 0.03, 4000, 'highpass');
  },
  click: () => tone(1500, 0, 0.025, 'sine', 0.05),
  squeak: (p = 1) => {
    const f = 900 * p;
    tone(f, 0, 0.07, 'sine', 0.06, f * 1.5);
    tone(f * 1.2, 0.09, 0.06, 'sine', 0.05, f * 1.7);
    if (Math.random() < 0.6) tone(f * 1.1, 0.18, 0.08, 'sine', 0.05, f * 1.4);
  },
  wheel: () => tone(1700 + Math.random() * 200, 0, 0.05, 'sine', 0.025, 2100),
  // шаги — тихие, по разным поверхностям
  step: () => tone(150 + Math.random() * 40, 0, 0.05, 'sine', 0.035, 90),
  stepWood: () => {
    tone(220 + Math.random() * 40, 0, 0.04, 'triangle', 0.035, 140);
  },
  stepSnow: () => noise(0, 0.09, 0.05, 1400 + Math.random() * 500, 'bandpass', sfxBus, 2),
  stepSand: () => noise(0, 0.08, 0.03, 2600 + Math.random() * 600, 'highpass'),
  // пещеры (П.9): кирка звякнула о кристалл; кирка о камень (промах); летучие мыши вспорхнули
  clink: () => {
    tone(1568 + Math.random() * 200, 0, 0.35, 'sine', 0.09);
    tone(2349, 0.02, 0.25, 'triangle', 0.04);
    tone(3136, 0.05, 0.18, 'sine', 0.025);
  },
  // фейерверк (праздники, П.13): глухой хлопок и звёздочки
  boom: () => {
    noise(0, 0.45, 0.05, 260, 'lowpass');
    tone(90, 0, 0.25, 'sine', 0.05, 50);
    [1568, 2093, 1760, 2637].forEach((f, i) => tone(f, 0.14 + i * 0.05, 0.12, 'sine', 0.02));
  },
  thud: () => {
    tone(160, 0, 0.09, 'triangle', 0.08, 90);
    noise(0, 0.06, 0.04, 900, 'lowpass');
  },
  flap: () => {
    for (let i = 0; i < 5; i++) noise(i * 0.07, 0.05, 0.03, 1400 + i * 120, 'bandpass');
  },
  stepStone: () => {
    tone(300 + Math.random() * 60, 0, 0.03, 'triangle', 0.025, 200);
    noise(0, 0.03, 0.012, 3000, 'highpass');
  },
  skate: () => noise(0, 0.22, 0.035, 5200, 'bandpass', sfxBus, 4),
  // простуженная чихает (Ф1): тоненькое «а-а-а…» вверх и короткое «пчхи!»
  sneeze: () => {
    tone(720, 0, 0.42, 'sine', 0.045, 1150);
    tone(1080, 0.14, 0.3, 'triangle', 0.025, 1500);
    noise(0.5, 0.18, 0.12, 3400, 'highpass');
    noise(0.52, 0.12, 0.06, 1500);
    tone(1500, 0.5, 0.09, 'sine', 0.045, 700);
  },
};

/** Нота для пианино. midi: 60 — «до» первой октавы. inst: piano | bells | squeak */
export function playNote(midi, inst = 'piano') {
  if (muted || document.hidden) return; // в скрытой вкладке молчим: иначе resume() разбудит и музыку
  const a = ctx();
  if (!a) return;
  if (a.state !== 'running') a.resume();
  const f = 440 * 2 ** ((midi - 69) / 12),
    B = sfxBus; // пианино — свой инструмент, звучит как прежде (мимо мягкого фильтра синтеза)
  if (inst === 'bells') {
    tone(f * 2, 0, 1.5, 'sine', 0.15, null, B);
    tone(f * 6.02, 0, 0.5, 'sine', 0.03, null, B);
    tone(f * 4, 0, 0.9, 'sine', 0.025, null, B);
  } else if (inst === 'squeak') {
    tone(f * 2, 0, 0.16, 'sine', 0.15, f * 2.7, B);
    tone(f * 2.3, 0.11, 0.13, 'sine', 0.1, f * 3, B);
  } else {
    tone(f, 0, 1.4, 'triangle', 0.2, null, B);
    tone(f * 2, 0, 0.8, 'sine', 0.06, null, B);
    tone(f * 3, 0, 0.4, 'sine', 0.025, null, B);
    noise(0, 0.03, 0.02, 2500, 'highpass', B);
  }
}

export function sfx(name, arg) {
  if (muted || document.hidden) return; // отложенный звук не должен будить звук в фоновой вкладке
  if (!ac || ac.state !== 'running') {
    if (ac) ac.resume();
    else return;
  }
  try {
    if (playSample(name)) return;
  } catch (e) {
    /* запись не сыграла — ниже синтез */
  }
  const f = SOUNDS[name];
  if (f) {
    try {
      f(arg);
    } catch (e) {
      /* звук не критичен */
    }
  }
}

// =====================================================================
//                      ЗАПИСАННЫЕ ЗВУКИ (этап 9б)
// =====================================================================
// Наборы Kenney (CC0) — см. data/credits.js. Файлы: assets/audio/sfx/<имя><номер>.mp3 (n вариантов, берётся
// случайный, не тот же, что в прошлый раз). g — громкость, r — скорость (и высота) от–до: хомячок маленький, шаги
// чуть выше и легче. Чего здесь нет (писк, колокольчик, плеск, фейерверк, волшебство…) — синтез из SOUNDS.
const BASE = 'assets/audio/';
const SFX_FILES = {
  // сначала — самые частые: они загрузятся первыми
  tap: { n: 3, g: 0.13, r: [1.2, 1.45] },
  pop: { n: 2, g: 0.14, r: [0.95, 1.15] },
  ok: { n: 2, g: 0.26, r: [1, 1] },
  win: { n: 3, g: 0.3, r: [1, 1] },
  coin: { n: 2, g: 0.17, r: [0.95, 1.08] },
  step: { n: 5, g: 0.055, r: [1.15, 1.4] },
  stepWood: { n: 5, g: 0.05, r: [1.15, 1.4] },
  stepSand: { n: 3, g: 0.055, r: [1.1, 1.35] },
  stepSnow: { n: 5, g: 0.05, r: [1.1, 1.3] },
  stepStone: { n: 5, g: 0.045, r: [1.2, 1.45] },
  fanfare: { n: 2, g: 0.32, r: [1, 1] },
  door: { n: 2, g: 0.15, r: [0.95, 1.05] },
  bad: { n: 1, g: 0.14, r: [1, 1] },
  thud: { n: 3, g: 0.15, r: [0.9, 1.1] },
  bubble: { n: 2, g: 0.12, r: [0.9, 1.4] },
  ding: { n: 2, g: 0.13, r: [0.95, 1.1] },
  paper: { n: 2, g: 0.15, r: [0.95, 1.1] },
  mail: { n: 1, g: 0.26, r: [1, 1] },
  sticker: { n: 1, g: 0.27, r: [1, 1] },
  morning: { n: 1, g: 0.26, r: [1, 1] },
  click: { n: 1, g: 0.14, r: [0.95, 1.05] },
  tick: { n: 1, g: 0.12, r: [0.95, 1.05] },
  dig: { n: 2, g: 0.15, r: [0.85, 1] },
  clink: { n: 3, g: 0.13, r: [0.95, 1.15] },
  flap: { n: 2, g: 0.13, r: [1.05, 1.3] },
  flush: { n: 1, g: 0.14, r: [1, 1] },
  spout: { n: 1, g: 0.13, r: [0.9, 1.05] },
  drip: { n: 3, g: 0.09, r: [0.85, 1.2] }, // капли в пещерах (окружение)
  tvOn: { n: 1, g: 0.13, r: [1, 1], as: 'click' },
};
const sbuf = {}; // имя → [AudioBuffer]
const lastIdx = {};
const badSfx = new Set();
const sfxFile = (name, i) => {
  const d = SFX_FILES[name],
    base = d.as || name;
  return BASE + 'sfx/' + base + (SFX_FILES[base].n > 1 ? i + 1 : '') + '.mp3';
};
function sfxUrls() {
  const out = [];
  for (const name in SFX_FILES) if (!SFX_FILES[name].as) for (let i = 0; i < SFX_FILES[name].n; i++) out.push(sfxFile(name, i));
  return out;
}
let sfxLoading = false;
/** Загрузить все записанные звуки фоном (по 4 сразу); не загрузился — останется синтез. */
function loadSfx() {
  if (sfxLoading || !ac || !window.fetch) return;
  sfxLoading = true;
  const jobs = [];
  for (const name in SFX_FILES) {
    const d = SFX_FILES[name];
    if (d.as) continue;
    sbuf[name] = [];
    for (let i = 0; i < d.n; i++) jobs.push([name, sfxFile(name, i)]);
  }
  const decode = (ab) =>
    new Promise((ok, bad) => {
      const p = ac.decodeAudioData(ab, ok, bad); // старый Safari — только с колбэками
      if (p && p.then) p.then(ok, bad);
    });
  const next = () => {
    const job = jobs.shift();
    if (!job) return;
    const [name, url] = job;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(r.status);
        return r.arrayBuffer();
      })
      .then(decode)
      .then((b) => sbuf[name].push(b))
      .catch(() => badSfx.add(url))
      .then(next);
  };
  for (let k = 0; k < 4; k++) next();
}
/** Сыграть запись звука name; false — записи нет (ещё не загрузилась), тогда играет синтез. */
function playSample(name, vol = 1, bus = sfxBus) {
  const d = SFX_FILES[name];
  if (!d || !ac) return false;
  const list = sbuf[d.as || name];
  if (!list || !list.length) return false;
  let i = Math.floor(Math.random() * list.length);
  if (list.length > 1 && i === lastIdx[name]) i = (i + 1) % list.length;
  lastIdx[name] = i;
  const src = ac.createBufferSource();
  src.buffer = list[i];
  src.playbackRate.value = d.r[0] + Math.random() * (d.r[1] - d.r[0]);
  const g = ac.createGain();
  g.gain.value = d.g * vol;
  src.connect(g);
  g.connect(bus);
  src.start();
  return true;
}

// =====================================================================
//                               МУЗЫКА
// =====================================================================
// Аккорды — полутоны от тоники. Мелодия ходит по пентатонике и опирается на ноты аккорда.
const CH = {
  I: [0, 4, 7],
  ii: [2, 5, 9],
  iii: [4, 7, 11],
  IV: [5, 9, 12],
  V: [7, 11, 14],
  vi: [9, 12, 16],
  i: [0, 3, 7],
  III: [3, 7, 10],
  iv: [5, 8, 12],
  VI: [8, 12, 15],
  VII: [10, 14, 17],
};
const MAJ_PENTA = [0, 2, 4, 7, 9],
  MIN_PENTA = [0, 3, 5, 7, 10],
  DESERT_PENTA = [0, 1, 4, 7, 8]; // «восточный» лад: с пониженной второй и шестой ступенью
// lead/arp: [тембр, громкость, длина в долях]; тембры: pluck | bell | soft | square
const TRACKS = {
  title: {
    bpm: 100,
    key: 60,
    scale: MAJ_PENTA,
    prog: ['I', 'V', 'vi', 'IV'],
    lead: ['bell', 0.075, 1.2],
    arp: ['pluck', 0.03, 0.5],
    arpPat: [0, 1, 2, 1, 0, 2, 1, 2],
    bass: 0.085,
    perc: 1,
    density: 0.6,
  },
  villa: {
    bpm: 84,
    key: 60,
    scale: MAJ_PENTA,
    prog: ['I', 'vi', 'IV', 'V', 'I', 'iii', 'IV', 'V'],
    lead: ['bell', 0.07, 1.6],
    arp: ['soft', 0.032, 0.9],
    arpPat: [0, 1, 2, 1, 0, 1, 2, 1],
    bass: 0.08,
    perc: 0,
    density: 0.5,
  },
  town_spring: {
    bpm: 106,
    key: 67,
    scale: MAJ_PENTA,
    prog: ['I', 'V', 'vi', 'IV', 'I', 'IV', 'ii', 'V'],
    lead: ['pluck', 0.075, 0.9],
    arp: ['soft', 0.028, 0.5],
    arpPat: [0, 2, 1, 2, 0, 2, 1, 2],
    bass: 0.085,
    perc: 1,
    density: 0.65,
  },
  town_summer: {
    bpm: 114,
    key: 65,
    scale: MAJ_PENTA,
    prog: ['I', 'IV', 'I', 'V', 'vi', 'IV', 'I', 'V'],
    lead: ['pluck', 0.08, 0.7],
    arp: ['pluck', 0.034, 0.35],
    arpPat: [0, -1, 2, 1, -1, 2, 0, 1],
    bass: 0.09,
    perc: 2,
    density: 0.7,
    swing: 0.16,
  },
  town_autumn: {
    bpm: 90,
    key: 62,
    scale: MIN_PENTA,
    prog: ['i', 'VI', 'III', 'VII', 'i', 'iv', 'VI', 'VII'],
    lead: ['soft', 0.08, 1.4],
    arp: ['pluck', 0.03, 0.6],
    arpPat: [0, 1, 2, 1, 0, 1, 2, 1],
    bass: 0.085,
    perc: 0,
    density: 0.5,
  },
  town_winter: {
    bpm: 92,
    key: 69,
    scale: MAJ_PENTA,
    prog: ['I', 'iii', 'IV', 'V', 'vi', 'IV', 'ii', 'V'],
    lead: ['bell', 0.07, 1.8],
    arp: ['bell', 0.022, 1.0],
    arpPat: [0, 2, 1, 2, 0, 2, 1, 2],
    bass: 0.075,
    perc: 3,
    density: 0.5,
  },
  // лес (П.9): неторопливо, «деревянные» щипки и колокольчики, как в сказке
  forest: {
    bpm: 84,
    key: 64,
    scale: MAJ_PENTA,
    prog: ['I', 'vi', 'IV', 'V', 'I', 'iii', 'IV', 'V'],
    lead: ['pluck', 0.07, 1.1],
    arp: ['bell', 0.024, 0.8],
    arpPat: [0, 2, 1, 2, 0, -1, 1, 2],
    bass: 0.075,
    perc: 0,
    density: 0.45,
  },
  // гора (П.9): бодрее леса, «альпийские» колокольчики и щипки — как песенка на лыжной прогулке
  mountain: {
    bpm: 98,
    key: 62,
    scale: MAJ_PENTA,
    prog: ['I', 'IV', 'V', 'I', 'vi', 'IV', 'ii', 'V'],
    lead: ['bell', 0.068, 0.9],
    arp: ['pluck', 0.026, 0.5],
    arpPat: [0, 1, 2, 1, 2, 1, 0, -1],
    bass: 0.07,
    perc: 0,
    density: 0.5,
    swing: 0.12,
  },
  // пещеры (П.9): медленно и таинственно, но не страшно — «стеклянные» колокольчики с долгим эхом
  caves: {
    bpm: 72,
    key: 57,
    scale: MIN_PENTA,
    prog: ['i', 'VI', 'iv', 'VII', 'i', 'III', 'VI', 'VII'],
    lead: ['bell', 0.06, 1.6],
    arp: ['bell', 0.02, 1.2],
    arpPat: [0, -1, 2, -1, 1, -1, 2, -1],
    bass: 0.06,
    perc: 0,
    density: 0.35,
  },
  // пустыня (П.9): неспешный «караванный» шаг, щипки как у уда и колокольчики — восточный лад, но весело
  desert: {
    bpm: 92,
    key: 62,
    scale: DESERT_PENTA,
    prog: ['I', 'I', 'VI', 'I', 'iv', 'VI', 'I', 'I'],
    lead: ['pluck', 0.072, 0.8],
    arp: ['bell', 0.024, 0.6],
    arpPat: [0, 1, 2, 1, 0, -1, 2, 1],
    bass: 0.075,
    perc: 1,
    density: 0.5,
    swing: 0.1,
  },
  // джунгли (П.9): весёлая «маримба» — щипки и колокольчики вприпрыжку, с барабанчиками
  jungle: {
    bpm: 108,
    key: 65,
    scale: MAJ_PENTA,
    prog: ['I', 'V', 'vi', 'IV', 'I', 'ii', 'IV', 'V'],
    lead: ['pluck', 0.074, 0.6],
    arp: ['bell', 0.026, 0.45],
    arpPat: [0, 2, 1, 2, -1, 2, 1, 0],
    bass: 0.08,
    perc: 2,
    density: 0.62,
    swing: 0.18,
  },
  // секретный пляж (П.9): мягко и мечтательно — «укулеле»-щипки и колокольчики, как песенка русалочки
  cove: {
    bpm: 88,
    key: 67,
    scale: MAJ_PENTA,
    prog: ['I', 'vi', 'IV', 'V', 'I', 'iii', 'ii', 'V'],
    lead: ['pluck', 0.068, 0.9],
    arp: ['bell', 0.024, 1.1],
    arpPat: [0, 2, 1, 2, 0, 2, -1, 1],
    bass: 0.07,
    perc: 1,
    density: 0.48,
    swing: 0.14,
  },
  // удалённый остров (П.9): весёлые барабаны-томы и короткие щипки «укулеле» — как песня у костра
  island: {
    bpm: 104,
    key: 64,
    scale: MAJ_PENTA,
    prog: ['I', 'IV', 'V', 'I', 'vi', 'IV', 'V', 'V'],
    lead: ['pluck', 0.07, 0.55],
    arp: ['pluck', 0.03, 0.3],
    arpPat: [0, 1, 2, 1, 0, 2, 1, 2],
    bass: 0.075,
    perc: 5,
    density: 0.6,
    swing: 0.2,
  },
  night: {
    bpm: 66,
    key: 57,
    scale: MIN_PENTA,
    prog: ['i', 'VI', 'III', 'VII'],
    lead: ['soft', 0.065, 2.4],
    arp: ['soft', 0.028, 1.6],
    arpPat: [0, -1, 1, -1, 2, -1, 1, -1],
    bass: 0.07,
    perc: 0,
    density: 0.3,
  },
  minigame: {
    bpm: 132,
    key: 60,
    scale: MAJ_PENTA,
    prog: ['I', 'IV', 'V', 'I', 'vi', 'IV', 'V', 'V'],
    lead: ['square', 0.045, 0.5],
    arp: ['pluck', 0.032, 0.3],
    arpPat: [0, 1, 2, 1, 0, 1, 2, 1],
    bass: 0.09,
    perc: 2,
    density: 0.8,
  },
  underwater: {
    bpm: 70,
    key: 62,
    scale: MAJ_PENTA,
    prog: ['I', 'iii', 'IV', 'I', 'vi', 'IV', 'ii', 'V'],
    lead: ['bell', 0.06, 2.6],
    arp: ['soft', 0.03, 1.8],
    arpPat: [0, -1, 2, -1, 1, -1, 2, -1],
    bass: 0.06,
    perc: 0,
    density: 0.3,
  },
  party: {
    bpm: 122,
    key: 57,
    scale: MIN_PENTA,
    prog: ['i', 'VII', 'VI', 'VII'],
    lead: ['square', 0.042, 0.45],
    arp: ['pluck', 0.034, 0.25],
    arpPat: [0, 2, 1, 2, 0, 2, 1, 2],
    bass: 0.1,
    perc: 4,
    density: 0.75,
  },
};
const hz = (m) => 440 * 2 ** ((m - 69) / 12);
const MUSIC_GAIN = 2; // общий уровень сочинённой музыки относительно звуков (этап 9б: тише, 2.8 → 2)

let cur = null; // сочинённая мелодия { id, def, bus, step, next, motif:[], deg }
let wanted = null;
let curId = null; // какой трек сейчас (файл или сочинённый)

function voice(kind, freq, t, dur, vol, bus) {
  const a = ac,
    o = a.createOscillator(),
    g = a.createGain();
  let att = 0.008;
  if (kind === 'bell') {
    o.type = 'sine';
    const o2 = a.createOscillator(),
      g2 = a.createGain();
    o2.type = 'sine';
    o2.frequency.value = freq * 3.01;
    g2.gain.setValueAtTime(vol * 0.22, t);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.4);
    o2.connect(g2);
    g2.connect(bus);
    o2.start(t);
    o2.stop(t + dur * 0.45);
  } else if (kind === 'soft') {
    o.type = 'sine';
    att = 0.06;
  } else if (kind === 'square') {
    o.type = 'triangle'; // этап 9б: «квадрат» резал слух — мягкий треугольник
    vol *= 0.8;
  } else o.type = 'triangle';
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + att);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(bus);
  o.start(t);
  o.stop(t + dur + 0.03);
}
function drum(kind, t, vol, bus) {
  const a = ac;
  if (kind === 'kick') {
    const o = a.createOscillator(),
      g = a.createGain();
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + 0.2);
    return;
  }
  const src = a.createBufferSource();
  src.buffer = noiseBuf;
  const f = a.createBiquadFilter(),
    g = a.createGain();
  f.type = kind === 'snare' ? 'bandpass' : 'highpass';
  f.frequency.value = kind === 'snare' ? 1800 : 6500;
  const d = kind === 'snare' ? 0.12 : 0.04;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  src.connect(f);
  f.connect(g);
  g.connect(bus);
  src.start(t, Math.random(), d + 0.02);
}

/** Сочинить мелодию на один такт: [{pos (в шестнадцатых), deg (ступень пентатоники), len}] */
function composeBar(tr, chord, last) {
  const d = tr.def,
    notes = [];
  const rhythms =
    d.density > 0.7
      ? [
          [0, 2, 4, 6, 8, 12],
          [0, 3, 6, 8, 10, 12],
          [0, 4, 6, 8, 11, 14],
        ]
      : d.density > 0.55
        ? [
            [0, 4, 6, 8, 12],
            [0, 3, 6, 10, 12],
            [0, 2, 4, 8, 12, 14],
          ]
        : d.density > 0.4
          ? [
              [0, 4, 8, 12],
              [0, 6, 8],
              [0, 3, 8, 11],
            ]
          : [
              [0, 8],
              [0, 6, 12],
              [4, 12],
            ];
  const pos = last ? [0, 4, 8] : rhythms[Math.floor(Math.random() * rhythms.length)];
  const sc = d.scale,
    n = sc.length;
  // ступени пентатоники, совпадающие с нотами аккорда
  const chordDegs = [];
  for (let k = 0; k < n * 2; k++) if (chord.some((c) => c % 12 === sc[k % n])) chordDegs.push(k);
  pos.forEach((p, i) => {
    let deg = tr.deg + Math.round((Math.random() - 0.5) * 3.2);
    if ((p % 8 === 0 || (last && i === pos.length - 1)) && chordDegs.length)
      deg = chordDegs.reduce((b, c) => (Math.abs(c - deg) < Math.abs(b - deg) ? c : b), chordDegs[0]);
    if (last && i === pos.length - 1) deg = deg >= n ? n : 0; // фраза заканчивается на тонике
    deg = Math.max(0, Math.min(n * 2 - 1, deg));
    tr.deg = deg;
    const nextP = i + 1 < pos.length ? pos[i + 1] : 16;
    notes.push({ pos: p, deg, len: Math.min(8, nextP - p) });
  });
  return notes;
}

function schedStep(tr, t) {
  const d = tr.def,
    step = tr.step,
    pos = step % 16,
    bar = Math.floor(step / 16);
  const chord = CH[d.prog[bar % d.prog.length]];
  const spb = 60 / d.bpm,
    s16 = spb / 4;
  const sw = d.swing && pos % 2 === 1 ? s16 * d.swing * 2 : 0;
  const tt = t + sw;
  const dry = tr.bus,
    wetSend = tr.send;
  // мелодия: фразы по 4 такта — придумали, повторили, развили, закончили
  if (pos === 0) {
    const ph = bar % 4;
    if (ph === 2 && tr.motif[0] && Math.random() < 0.8) tr.barNotes = tr.motif[0];
    else tr.barNotes = composeBar(tr, chord, ph === 3);
    tr.motif[ph] = tr.barNotes;
    tr.rest = bar % 8 >= 6 && Math.random() < 0.25; // иногда мелодия отдыхает
  }
  if (!tr.rest)
    for (const n of tr.barNotes)
      if (n.pos === pos) {
        const sc = d.scale,
          m = d.key + 12 + sc[n.deg % sc.length] + 12 * Math.floor(n.deg / sc.length);
        const [kind, vol, len] = d.lead;
        voice(kind, hz(m), tt, Math.max(0.18, Math.min(len, (n.len / 4) * 1.1) * spb), vol, dry);
        voice(kind, hz(m), tt, 0.2, vol * 0.5, wetSend);
      }
  // переборы
  if (pos % 2 === 0) {
    const k = d.arpPat[(pos / 2) % d.arpPat.length];
    if (k >= 0) {
      const [kind, vol, len] = d.arp;
      voice(kind, hz(d.key + chord[k % 3] + (k > 2 ? 12 : 0)), tt, len * spb, vol, dry);
    }
  }
  // бас
  if (pos === 0) voice('pluck', hz(d.key - 12 + chord[0]), tt, spb * 1.6, d.bass, dry);
  else if (pos === 8)
    voice('pluck', hz(d.key - 12 + chord[2] - (chord[2] > 9 ? 12 : 0)), tt, spb * 1.2, d.bass * 0.8, dry);
  else if (d.perc >= 2 && pos === 14) voice('pluck', hz(d.key - 12 + chord[0]), tt, spb * 0.4, d.bass * 0.6, dry);
  // ударные: 1 — шейкер, 2 — лёгкий бит, 3 — бубенцы, 4 — диско, 5 — барабаны острова
  if (d.perc === 1) {
    if (pos % 4 === 2) drum('hat', tt, 0.018, dry);
  } else if (d.perc === 2) {
    if (pos % 8 === 0) drum('kick', tt, 0.11, dry);
    if (pos % 8 === 4) drum('snare', tt, 0.03, dry);
    if (pos % 2 === 0) drum('hat', tt, pos % 4 === 2 ? 0.02 : 0.01, dry);
  } else if (d.perc === 3) {
    if (pos % 4 === 0) {
      voice('bell', 3520 + (pos % 8 ? 400 : 0), tt, 0.12, 0.012, dry);
      voice('bell', 4700, tt + 0.03, 0.1, 0.008, dry);
    }
  } else if (d.perc === 5) {
    // барабаны острова: низкий там-там на счёт и звонкие бонги в перебивку
    if (pos === 0 || pos === 6 || pos === 10) voice('pluck', hz(d.key - 24), tt, spb * 0.35, 0.09, dry);
    if (pos === 3 || pos === 12 || pos === 14) voice('pluck', hz(d.key - 12 + 7), tt, spb * 0.2, 0.05, dry);
    if (pos % 4 === 2) drum('hat', tt, 0.012, dry);
  } else if (d.perc === 4) {
    if (pos % 4 === 0) drum('kick', tt, 0.15, dry);
    if (pos % 8 === 4) drum('snare', tt, 0.04, dry);
    if (pos % 4 === 2) drum('hat', tt, 0.03, dry);
  }
}

function startTrack(id) {
  const def = TRACKS[id];
  if (!def) return null;
  const bus = ac.createGain();
  bus.gain.setValueAtTime(0.0001, ac.currentTime);
  bus.gain.exponentialRampToValueAtTime(MUSIC_GAIN, ac.currentTime + 1.2);
  bus.connect(musicBus);
  const send = ac.createGain();
  send.gain.value = 1;
  send.connect(delayIn);
  return { id, def, bus, send, step: 0, next: ac.currentTime + 0.15, motif: [], barNotes: [], deg: 5, rest: false };
}
function stopTrack(tr) {
  const t = ac.currentTime;
  tr.bus.gain.cancelScheduledValues(t);
  tr.bus.gain.setTargetAtTime(0, t, 0.25);
  tr.send.gain.setTargetAtTime(0, t, 0.1);
  setTimeout(() => {
    try {
      tr.bus.disconnect();
      tr.send.disconnect();
    } catch (e) {
      /* уже отключено */
    }
  }, 1500);
}
/** Какая музыка должна играть (id из TRACKS или null — тишина). */
export function setMusic(id) {
  wanted = id;
}

// =====================================================================
//                       МУЗЫКА ИЗ ФАЙЛОВ (этап 9б)
// =====================================================================
// Трек → файлы assets/audio/music/<имя>.mp3 по кругу (авторы — data/credits.js). Играют через <audio> (не держим
// трёхминутные записи в памяти), громкость — через WebAudio (на iPad у <audio> громкость не меняется).
// Переход — плавный: старый трек затихает, новый вступает (MUSIC_FADE). Вернулась в то же место — трек
// продолжается с того же места. Файл не загрузился — играет сочинённая мелодия этого трека (TRACKS).
const MUSIC_FILES = {
  title: ['tiki_bar_mixer'],
  villa: ['easy_lemon', 'somewhere_sunny'],
  town_spring: ['carefree'],
  town_summer: ['wholesome'],
  town_autumn: ['skye_cuillin'],
  town_winter: ['frost_waltz'],
  forest: ['folk_round'],
  mountain: ['achaidh_cheide'],
  caves: ['teller_of_the_tales'],
  desert: ['desert_city'],
  jungle: ['monkeys_spinning_monkeys'],
  cove: ['kalimba_relaxation'],
  island: ['island_meet_and_greet'],
  night: ['gymnopedie_no_1', 'dreamer'],
  minigame: ['fluffing_a_duck'],
  underwater: ['kalimba_relaxation'],
  party: ['club_seamus'],
};
const MUSIC_FADE = 2.2; // с — вступление нового трека
const MUSIC_OUT = 1.6; // с — затихание старого
const FILE_GAIN = 1; // запись относительно громкости музыки из настроек
let decks = []; // { el, g, busy, file, id, files, blessed, token }
let curDeck = null;
const badMusic = new Set(); // файлы, которые не загрузились
const plPos = {}; // трек → какой файл по кругу сейчас
const resumeAt = {}; // файл → где остановились (вернёшься — продолжится)

function makeDeck() {
  const el = new Audio();
  el.preload = 'auto';
  const src = ac.createMediaElementSource(el);
  const g = ac.createGain();
  g.gain.value = 0;
  src.connect(g);
  g.connect(musicBus);
  const d = { el, g, busy: false, file: null, id: null, files: null, blessed: false, token: 0 };
  el.addEventListener('ended', () => {
    if (d !== curDeck) return;
    resumeAt[d.file] = 0;
    plPos[d.id] = (plPos[d.id] || 0) + 1;
    curDeck = null;
    d.busy = false;
    curId = null; // tick() сам включит следующий файл трека
  });
  el.addEventListener('error', () => {
    if (!d.file || !el.src.includes('/music/')) return; // ошибка «пробного» файла при разрешении звука — не важна
    badMusic.add(d.file);
    if (d === curDeck) {
      curDeck = null;
      d.busy = false;
      curId = null; // tick() возьмёт другой файл или сочинённую мелодию
    }
  });
  return d;
}
function playEl(d) {
  const pr = d.el.play();
  if (pr && pr.catch) pr.catch(() => {}); // не разрешено без нажатия — заиграет на следующем нажатии (unlockAudio)
}
/** Вступить треку id (файл по кругу); null — файлов нет или все не загрузились. */
function startFileTrack(id, prev) {
  const files = (MUSIC_FILES[id] || []).filter((f) => !badMusic.has(f));
  if (!files.length || !decks.length) return null;
  const file = files[(plPos[id] || 0) % files.length];
  const d = decks.find((x) => !x.busy) || decks.find((x) => x !== prev) || decks[0];
  d.token++;
  d.busy = true;
  d.id = id;
  d.file = file;
  const url = BASE + 'music/' + file + '.mp3';
  if (!d.el.src.endsWith(url)) d.el.src = url;
  try {
    d.el.currentTime = resumeAt[file] || 0;
  } catch (e) {
    /* ещё не загрузился — начнётся сначала */
  }
  const t = ac.currentTime;
  d.g.gain.cancelScheduledValues(t);
  d.g.gain.setValueAtTime(0, t);
  d.g.gain.linearRampToValueAtTime(FILE_GAIN, t + MUSIC_FADE);
  playEl(d);
  return d;
}
function stopFileTrack(d) {
  const t = ac.currentTime,
    tok = ++d.token;
  resumeAt[d.file] = d.el.currentTime > 5 && d.el.currentTime < (d.el.duration || 1e9) - 8 ? d.el.currentTime : 0;
  d.g.gain.cancelScheduledValues(t);
  d.g.gain.setValueAtTime(d.g.gain.value, t);
  d.g.gain.linearRampToValueAtTime(0, t + MUSIC_OUT);
  setTimeout(() => {
    if (d.token !== tok) return; // проигрыватель уже взял другой трек
    d.el.pause();
    d.busy = false;
  }, MUSIC_OUT * 1000 + 100);
}
/** Сменить музыку: старое затихает, новое вступает (файл, а если его нет — сочинённая мелодия). */
function switchMusic(id) {
  curId = id;
  if (cur) stopTrack(cur);
  cur = null;
  const prev = curDeck;
  if (prev) stopFileTrack(prev);
  curDeck = null;
  if (!id) return;
  curDeck = startFileTrack(id, prev);
  if (!curDeck) cur = startTrack(id);
}

// =====================================================================
//                              ОКРУЖЕНИЕ
// =====================================================================
const amb = { sea: 0, rain: 0, birds: false, night: false, wind: 0, bells: 0, drips: 0 };
let seaNode = null,
  rainNode = null,
  windNode = null;
export function setAmbience(a) {
  Object.assign(amb, a);
}
function loopNoise(type, freq, q = 0.7) {
  const src = ac.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ac.createGain();
  g.gain.value = 0;
  src.connect(f);
  f.connect(g);
  g.connect(ambBus);
  src.start();
  return { g, f };
}
function chirp(t0) {
  const base = 2300 + Math.random() * 1100,
    n = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++)
    tone(base * (1 + (i % 2) * 0.12), t0 + i * 0.09, 0.08, 'sine', 0.012, base * 1.2, ambBus);
}
/** Колокольчик коровы на лугу (гора): два-три «звяк» с призвуком. */
function cowbell(t0, vol) {
  const f = 760 + Math.random() * 160;
  for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) {
    tone(f, t0 + i * 0.16, 0.35, 'triangle', 0.03 * vol, null, ambBus);
    tone(f * 2.7, t0 + i * 0.16, 0.18, 'sine', 0.012 * vol, null, ambBus);
  }
}
/** Капля в пещере (П.9): короткое «плинк» вверх, иногда с эхом. */
function drip(vol) {
  const f = 900 + Math.random() * 700;
  tone(f, 0, 0.09, 'sine', 0.035 * vol, f * 1.9, ambBus);
  if (Math.random() < 0.5) tone(f * 1.1, 0.22, 0.07, 'sine', 0.012 * vol, f * 2, ambBus);
}
function cricket() {
  for (let i = 0; i < 3; i++) tone(4300, i * 0.07, 0.04, 'sine', 0.008, null, ambBus);
}

function tick() {
  if (!ac || ac.state !== 'running') return;
  const now = ac.currentTime;
  // --- музыка
  const want = musicOn ? wanted : null;
  if (curId !== want) switchMusic(want);
  if (cur) {
    if (cur.next < now - 0.3) cur.next = now + 0.05; // вкладка спала — не догоняем пропущенное
    const s16 = 60 / cur.def.bpm / 4;
    while (cur.next < now + 0.22) {
      schedStep(cur, cur.next);
      cur.step++;
      cur.next += s16;
    }
  }
  // --- окружение
  if (!muted) {
    if (amb.sea > 0.01 || seaNode) {
      if (!seaNode) seaNode = loopNoise('lowpass', 600);
      const wave = 0.45 + 0.55 * Math.pow(0.5 + 0.5 * Math.sin(now * 0.75), 2);
      seaNode.g.gain.setTargetAtTime(amb.sea * 0.09 * wave, now, 0.2);
      seaNode.f.frequency.setTargetAtTime(420 + wave * 700, now, 0.3);
    }
    if (amb.rain > 0.01 || rainNode) {
      if (!rainNode) rainNode = loopNoise('highpass', 2400);
      rainNode.g.gain.setTargetAtTime(amb.rain * 0.035, now, 0.4);
    }
    if (amb.wind > 0.01 || windNode) {
      // ветер на горе: низкий шум, то сильнее, то тише
      if (!windNode) windNode = loopNoise('bandpass', 420, 0.5);
      const gust = 0.5 + 0.5 * Math.sin(now * 0.33) * Math.sin(now * 0.71 + 1);
      windNode.g.gain.setTargetAtTime(amb.wind * 0.05 * (0.35 + gust * 0.65), now, 0.5);
      windNode.f.frequency.setTargetAtTime(300 + gust * 380, now, 0.6);
    }
    if (amb.bells > 0.05 && Math.random() < 0.006) cowbell(0, amb.bells);
    if (amb.drips > 0.05 && Math.random() < 0.02 && !playSample('drip', amb.drips, ambBus)) drip(amb.drips);
    if (amb.birds && Math.random() < 0.012) chirp(0);
    if (amb.night && Math.random() < 0.03) cricket();
  }
}
