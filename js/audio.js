// Звук игры: всё синтезируется через WebAudio, без единого файла.
//  • sfx(name)        — короткие звуки (шаги, монетки, двери…)
//  • setMusic(track)  — фоновая музыка; мелодии сочиняются на ходу по простым правилам
//  • setAmbience({})  — окружение: шум моря, дождь, птицы, сверчки
let ac = null;
let master = null, sfxBus = null, musicBus = null, ambBus = null, delayIn = null;
let noiseBuf = null, meter = null;
let timer = 0;

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* не страшно */ } },
};
let muted = store.get('rhr-muted', '0') === '1';
let musicOn = store.get('rhr-music', '1') === '1';
let musicVol = Math.min(1, Math.max(0, parseFloat(store.get('rhr-music-vol', '0.6')) || 0));

function ctx() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain(); master.gain.value = 0.9;
    // ограничитель: если звуков сразу много, они не захрипят
    const limiter = ac.createDynamicsCompressor(); limiter.threshold.value = -10; limiter.knee.value = 8; limiter.ratio.value = 8; limiter.attack.value = 0.004; limiter.release.value = 0.2;
    master.connect(limiter); limiter.connect(ac.destination);
    meter = ac.createAnalyser(); meter.fftSize = 2048; limiter.connect(meter);
    sfxBus = ac.createGain(); sfxBus.gain.value = muted ? 0 : 1; sfxBus.connect(master);
    ambBus = ac.createGain(); ambBus.gain.value = muted ? 0 : 1; ambBus.connect(master);
    musicBus = ac.createGain(); musicBus.gain.value = musicOn ? musicVol : 0; musicBus.connect(master);
    // лёгкое эхо, чтобы музыка звучала объёмнее
    const delay = ac.createDelay(1); delay.delayTime.value = 0.29;
    const fb = ac.createGain(); fb.gain.value = 0.26;
    const wet = ac.createGain(); wet.gain.value = 0.22;
    delayIn = ac.createGain();
    delayIn.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(musicBus);
    // шум для моря, дождя и «шуршащих» звуков
    const len = ac.sampleRate * 2;
    noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  return ac;
}
export function unlockAudio() {
  const a = ctx(); if (!a) return;
  if (a.state === 'suspended' && !document.hidden) a.resume();
  if (!timer) timer = setInterval(tick, 50);
}
document.addEventListener('visibilitychange', () => {
  if (!ac) return;
  if (document.hidden) ac.suspend(); else ac.resume();
});

/** Для тестов: текущая громкость на выходе { peak, rms } и состояние. */
export function debugLevel() {
  if (!meter) return null;
  const buf = new Float32Array(meter.fftSize); meter.getFloatTimeDomainData(buf);
  let peak = 0, sum = 0; for (const v of buf) { peak = Math.max(peak, Math.abs(v)); sum += v * v; }
  return { peak, rms: Math.sqrt(sum / buf.length), state: ac.state, track: cur ? cur.id : null };
}

// ---------- настройки ----------
export function isMuted() { return muted; }
export function setMuted(m) {
  muted = m; store.set('rhr-muted', m ? '1' : '0');
  if (ac) { sfxBus.gain.setTargetAtTime(m ? 0 : 1, ac.currentTime, 0.05); ambBus.gain.setTargetAtTime(m ? 0 : 1, ac.currentTime, 0.05); }
}
export function isMusicOn() { return musicOn; }
export function setMusicOn(on) {
  musicOn = on; store.set('rhr-music', on ? '1' : '0');
  if (ac) musicBus.gain.setTargetAtTime(on ? musicVol : 0, ac.currentTime, 0.1);
}
export function getMusicVolume() { return musicVol; }
export function setMusicVolume(v) {
  musicVol = Math.min(1, Math.max(0, v)); store.set('rhr-music-vol', String(musicVol));
  if (ac && musicOn) musicBus.gain.setTargetAtTime(musicVol, ac.currentTime, 0.05);
}

// ---------- кирпичики ----------
function tone(freq, t0, dur, type = 'sine', vol = 0.12, slideTo = null, dest = sfxBus) {
  const a = ac; if (!a) return;
  const t = a.currentTime + t0;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest);
  o.start(t); o.stop(t + dur + 0.03);
}
function noise(t0, dur, vol = 0.08, freq = 1200, type = 'bandpass', dest = sfxBus, q = 1) {
  const a = ac; if (!a) return;
  const t = a.currentTime + t0;
  const src = a.createBufferSource(); src.buffer = noiseBuf;
  const f = a.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = a.createGain();
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(dest);
  src.start(t, Math.random() * 1.5, dur + 0.05);
}

const SOUNDS = {
  tap: () => tone(660, 0, 0.07, 'triangle', 0.08),
  pop: () => tone(520, 0, 0.09, 'sine', 0.12, 900),
  open: () => { tone(420, 0, 0.08, 'sine', 0.07, 640); tone(640, 0.06, 0.1, 'sine', 0.06, 880); },
  coin: () => { tone(988, 0, 0.08, 'square', 0.05); tone(1319, 0.07, 0.16, 'square', 0.05); },
  ok: () => { tone(660, 0, 0.1, 'triangle'); tone(880, 0.09, 0.16, 'triangle'); },
  bad: () => { tone(300, 0, 0.14, 'sawtooth', 0.06, 200); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.22, 'triangle', 0.12)),
  fanfare: () => { [523, 523, 523, 659, 784, 1047].forEach((f, i) => tone(f, [0, 0.12, 0.24, 0.36, 0.5, 0.66][i], i === 5 ? 0.6 : 0.16, 'triangle', 0.12)); [262, 330, 392].forEach((f) => tone(f, 0.66, 0.6, 'sine', 0.06)); },
  splash: () => { noise(0, 0.28, 0.12, 900); noise(0.05, 0.2, 0.06, 2200); },
  paddle: () => noise(0, 0.16, 0.05, 700 + Math.random() * 300),
  door: () => { tone(220, 0, 0.08, 'square', 0.04); tone(165, 0.08, 0.12, 'square', 0.04); },
  bell: () => { tone(1319, 0, 0.5, 'sine', 0.12); tone(2637, 0, 0.3, 'sine', 0.03); tone(1047, 0.32, 0.7, 'sine', 0.12); tone(2093, 0.32, 0.4, 'sine', 0.03); },
  ding: () => { tone(1568, 0, 0.45, 'sine', 0.1); tone(3136, 0, 0.2, 'sine', 0.025); },
  lift: () => tone(110, 0, 0.5, 'sawtooth', 0.025, 150),
  mail: () => { tone(784, 0, 0.1, 'triangle'); tone(1047, 0.1, 0.1, 'triangle'); tone(1319, 0.2, 0.2, 'triangle'); },
  paper: () => { noise(0, 0.12, 0.05, 3000, 'highpass'); noise(0.1, 0.1, 0.04, 2400, 'highpass'); },
  magic: () => [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, i * 0.06, 0.2, 'sine', 0.08)),
  sticker: () => { tone(880, 0, 0.07, 'triangle', 0.1); tone(1175, 0.07, 0.07, 'triangle', 0.1); tone(1760, 0.14, 0.25, 'triangle', 0.1); },
  heart: () => { tone(784, 0, 0.12, 'sine', 0.1); tone(1175, 0.1, 0.25, 'sine', 0.1); },
  eat: () => { noise(0, 0.07, 0.09, 500); noise(0.14, 0.07, 0.09, 600); noise(0.28, 0.07, 0.08, 550); },
  tick: () => tone(1200, 0, 0.03, 'square', 0.03),
  whistle: () => tone(1800, 0, 0.3, 'sine', 0.09, 2400),
  bubble: () => tone(300 + Math.random() * 400, 0, 0.12, 'sine', 0.06, 900),
  note: (f = 440) => { tone(f, 0, 0.5, 'triangle', 0.12); tone(f * 2, 0, 0.25, 'sine', 0.03); },
  flush: () => { noise(0, 1.1, 0.1, 400, 'lowpass'); tone(180, 0, 0.9, 'sine', 0.03, 70); },
  spout: () => { noise(0, 0.9, 0.09, 2600, 'highpass'); noise(0.05, 0.4, 0.08, 800); },
  hiss: () => noise(0, 1.2, 0.07, 5000, 'highpass'),
  sleep: () => [659, 523, 440, 349].forEach((f, i) => tone(f, i * 0.22, 0.4, 'sine', 0.09)),
  morning: () => [392, 523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.13, i === 6 ? 0.5 : 0.14, 'triangle', 0.09)),
  dig: () => { noise(0, 0.12, 0.09, 300, 'lowpass'); noise(0.13, 0.1, 0.07, 400, 'lowpass'); },
  tvOn: () => { tone(200, 0, 0.12, 'sine', 0.05, 1200); noise(0.02, 0.12, 0.03, 4000, 'highpass'); },
  click: () => tone(1500, 0, 0.025, 'square', 0.04),
  squeak: (p = 1) => { const f = 900 * p; tone(f, 0, 0.07, 'sine', 0.06, f * 1.5); tone(f * 1.2, 0.09, 0.06, 'sine', 0.05, f * 1.7); if (Math.random() < 0.6) tone(f * 1.1, 0.18, 0.08, 'sine', 0.05, f * 1.4); },
  wheel: () => tone(1700 + Math.random() * 200, 0, 0.05, 'sine', 0.025, 2100),
  // шаги — тихие, по разным поверхностям
  step: () => tone(150 + Math.random() * 40, 0, 0.05, 'sine', 0.035, 90),
  stepWood: () => { tone(220 + Math.random() * 40, 0, 0.04, 'triangle', 0.035, 140); },
  stepSnow: () => noise(0, 0.09, 0.05, 1400 + Math.random() * 500, 'bandpass', sfxBus, 2),
  stepSand: () => noise(0, 0.08, 0.03, 2600 + Math.random() * 600, 'highpass'),
  stepStone: () => { tone(300 + Math.random() * 60, 0, 0.03, 'triangle', 0.025, 200); noise(0, 0.03, 0.012, 3000, 'highpass'); },
  skate: () => noise(0, 0.22, 0.035, 5200, 'bandpass', sfxBus, 4),
};

/** Нота для пианино. midi: 60 — «до» первой октавы. inst: piano | bells | squeak */
export function playNote(midi, inst = 'piano') {
  if (muted) return;
  const a = ctx(); if (!a) return;
  if (a.state !== 'running') a.resume();
  const f = 440 * 2 ** ((midi - 69) / 12);
  if (inst === 'bells') { tone(f * 2, 0, 1.5, 'sine', 0.15); tone(f * 6.02, 0, 0.5, 'sine', 0.03); tone(f * 4, 0, 0.9, 'sine', 0.025); }
  else if (inst === 'squeak') { tone(f * 2, 0, 0.16, 'sine', 0.15, f * 2.7); tone(f * 2.3, 0.11, 0.13, 'sine', 0.1, f * 3); }
  else { tone(f, 0, 1.4, 'triangle', 0.2); tone(f * 2, 0, 0.8, 'sine', 0.06); tone(f * 3, 0, 0.4, 'sine', 0.025); noise(0, 0.03, 0.02, 2500, 'highpass'); }
}

export function sfx(name, arg) {
  if (muted) return;
  if (!ac || ac.state !== 'running') { if (ac) ac.resume(); else return; }
  const f = SOUNDS[name];
  if (f) { try { f(arg); } catch (e) { /* звук не критичен */ } }
}

// =====================================================================
//                               МУЗЫКА
// =====================================================================
// Аккорды — полутоны от тоники. Мелодия ходит по пентатонике и опирается на ноты аккорда.
const CH = {
  I: [0, 4, 7], ii: [2, 5, 9], iii: [4, 7, 11], IV: [5, 9, 12], V: [7, 11, 14], vi: [9, 12, 16],
  i: [0, 3, 7], III: [3, 7, 10], iv: [5, 8, 12], VI: [8, 12, 15], VII: [10, 14, 17],
};
const MAJ_PENTA = [0, 2, 4, 7, 9], MIN_PENTA = [0, 3, 5, 7, 10];
// lead/arp: [тембр, громкость, длина в долях]; тембры: pluck | bell | soft | square
const TRACKS = {
  title: { bpm: 100, key: 60, scale: MAJ_PENTA, prog: ['I', 'V', 'vi', 'IV'], lead: ['bell', 0.075, 1.2], arp: ['pluck', 0.03, 0.5], arpPat: [0, 1, 2, 1, 0, 2, 1, 2], bass: 0.085, perc: 1, density: 0.6 },
  villa: { bpm: 84, key: 60, scale: MAJ_PENTA, prog: ['I', 'vi', 'IV', 'V', 'I', 'iii', 'IV', 'V'], lead: ['bell', 0.07, 1.6], arp: ['soft', 0.032, 0.9], arpPat: [0, 1, 2, 1, 0, 1, 2, 1], bass: 0.08, perc: 0, density: 0.5 },
  town_spring: { bpm: 106, key: 67, scale: MAJ_PENTA, prog: ['I', 'V', 'vi', 'IV', 'I', 'IV', 'ii', 'V'], lead: ['pluck', 0.075, 0.9], arp: ['soft', 0.028, 0.5], arpPat: [0, 2, 1, 2, 0, 2, 1, 2], bass: 0.085, perc: 1, density: 0.65 },
  town_summer: { bpm: 114, key: 65, scale: MAJ_PENTA, prog: ['I', 'IV', 'I', 'V', 'vi', 'IV', 'I', 'V'], lead: ['pluck', 0.08, 0.7], arp: ['pluck', 0.034, 0.35], arpPat: [0, -1, 2, 1, -1, 2, 0, 1], bass: 0.09, perc: 2, density: 0.7, swing: 0.16 },
  town_autumn: { bpm: 90, key: 62, scale: MIN_PENTA, prog: ['i', 'VI', 'III', 'VII', 'i', 'iv', 'VI', 'VII'], lead: ['soft', 0.08, 1.4], arp: ['pluck', 0.03, 0.6], arpPat: [0, 1, 2, 1, 0, 1, 2, 1], bass: 0.085, perc: 0, density: 0.5 },
  town_winter: { bpm: 92, key: 69, scale: MAJ_PENTA, prog: ['I', 'iii', 'IV', 'V', 'vi', 'IV', 'ii', 'V'], lead: ['bell', 0.07, 1.8], arp: ['bell', 0.022, 1.0], arpPat: [0, 2, 1, 2, 0, 2, 1, 2], bass: 0.075, perc: 3, density: 0.5 },
  night: { bpm: 66, key: 57, scale: MIN_PENTA, prog: ['i', 'VI', 'III', 'VII'], lead: ['soft', 0.065, 2.4], arp: ['soft', 0.028, 1.6], arpPat: [0, -1, 1, -1, 2, -1, 1, -1], bass: 0.07, perc: 0, density: 0.3 },
  minigame: { bpm: 132, key: 60, scale: MAJ_PENTA, prog: ['I', 'IV', 'V', 'I', 'vi', 'IV', 'V', 'V'], lead: ['square', 0.045, 0.5], arp: ['pluck', 0.032, 0.3], arpPat: [0, 1, 2, 1, 0, 1, 2, 1], bass: 0.09, perc: 2, density: 0.8 },
  underwater: { bpm: 70, key: 62, scale: MAJ_PENTA, prog: ['I', 'iii', 'IV', 'I', 'vi', 'IV', 'ii', 'V'], lead: ['bell', 0.06, 2.6], arp: ['soft', 0.03, 1.8], arpPat: [0, -1, 2, -1, 1, -1, 2, -1], bass: 0.06, perc: 0, density: 0.3 },
  party: { bpm: 122, key: 57, scale: MIN_PENTA, prog: ['i', 'VII', 'VI', 'VII'], lead: ['square', 0.042, 0.45], arp: ['pluck', 0.034, 0.25], arpPat: [0, 2, 1, 2, 0, 2, 1, 2], bass: 0.1, perc: 4, density: 0.75 },
};
const hz = (m) => 440 * 2 ** ((m - 69) / 12);
const MUSIC_GAIN = 2.8; // общий уровень музыки относительно звуков

let cur = null;      // { id, def, bus, step, next, motif:[], deg }
let wanted = null;

function voice(kind, freq, t, dur, vol, bus) {
  const a = ac, o = a.createOscillator(), g = a.createGain();
  let att = 0.008;
  if (kind === 'bell') { o.type = 'sine'; const o2 = a.createOscillator(), g2 = a.createGain(); o2.type = 'sine'; o2.frequency.value = freq * 3.01; g2.gain.setValueAtTime(vol * 0.22, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.4); o2.connect(g2); g2.connect(bus); o2.start(t); o2.stop(t + dur * 0.45); }
  else if (kind === 'soft') { o.type = 'sine'; att = 0.06; }
  else if (kind === 'square') { o.type = 'square'; vol *= 0.6; }
  else o.type = 'triangle';
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + att);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(bus);
  o.start(t); o.stop(t + dur + 0.03);
}
function drum(kind, t, vol, bus) {
  const a = ac;
  if (kind === 'kick') { const o = a.createOscillator(), g = a.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16); o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.2); return; }
  const src = a.createBufferSource(); src.buffer = noiseBuf;
  const f = a.createBiquadFilter(), g = a.createGain();
  f.type = kind === 'snare' ? 'bandpass' : 'highpass'; f.frequency.value = kind === 'snare' ? 1800 : 6500;
  const d = kind === 'snare' ? 0.12 : 0.04;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  src.connect(f); f.connect(g); g.connect(bus); src.start(t, Math.random(), d + 0.02);
}

/** Сочинить мелодию на один такт: [{pos (в шестнадцатых), deg (ступень пентатоники), len}] */
function composeBar(tr, chord, last) {
  const d = tr.def, notes = [];
  const rhythms = d.density > 0.7 ? [[0, 2, 4, 6, 8, 12], [0, 3, 6, 8, 10, 12], [0, 4, 6, 8, 11, 14]] : d.density > 0.55 ? [[0, 4, 6, 8, 12], [0, 3, 6, 10, 12], [0, 2, 4, 8, 12, 14]] : d.density > 0.4 ? [[0, 4, 8, 12], [0, 6, 8], [0, 3, 8, 11]] : [[0, 8], [0, 6, 12], [4, 12]];
  const pos = last ? [0, 4, 8] : rhythms[Math.floor(Math.random() * rhythms.length)];
  const sc = d.scale, n = sc.length;
  // ступени пентатоники, совпадающие с нотами аккорда
  const chordDegs = [];
  for (let k = 0; k < n * 2; k++) if (chord.some((c) => (c % 12) === sc[k % n])) chordDegs.push(k);
  pos.forEach((p, i) => {
    let deg = tr.deg + Math.round((Math.random() - 0.5) * 3.2);
    if ((p % 8 === 0 || (last && i === pos.length - 1)) && chordDegs.length) deg = chordDegs.reduce((b, c) => (Math.abs(c - deg) < Math.abs(b - deg) ? c : b), chordDegs[0]);
    if (last && i === pos.length - 1) deg = deg >= n ? n : 0; // фраза заканчивается на тонике
    deg = Math.max(0, Math.min(n * 2 - 1, deg));
    tr.deg = deg;
    const nextP = i + 1 < pos.length ? pos[i + 1] : 16;
    notes.push({ pos: p, deg, len: Math.min(8, nextP - p) });
  });
  return notes;
}

function schedStep(tr, t) {
  const d = tr.def, step = tr.step, pos = step % 16, bar = Math.floor(step / 16);
  const chord = CH[d.prog[bar % d.prog.length]];
  const spb = 60 / d.bpm, s16 = spb / 4;
  const sw = d.swing && pos % 2 === 1 ? s16 * d.swing * 2 : 0;
  const tt = t + sw;
  const dry = tr.bus, wetSend = tr.send;
  // мелодия: фразы по 4 такта — придумали, повторили, развили, закончили
  if (pos === 0) {
    const ph = bar % 4;
    if (ph === 2 && tr.motif[0] && Math.random() < 0.8) tr.barNotes = tr.motif[0];
    else tr.barNotes = composeBar(tr, chord, ph === 3);
    tr.motif[ph] = tr.barNotes;
    tr.rest = bar % 8 >= 6 && Math.random() < 0.25; // иногда мелодия отдыхает
  }
  if (!tr.rest) for (const n of tr.barNotes) if (n.pos === pos) {
    const sc = d.scale, m = d.key + 12 + sc[n.deg % sc.length] + 12 * Math.floor(n.deg / sc.length);
    const [kind, vol, len] = d.lead;
    voice(kind, hz(m), tt, Math.max(0.18, Math.min(len, n.len / 4 * 1.1) * spb), vol, dry);
    voice(kind, hz(m), tt, 0.2, vol * 0.5, wetSend);
  }
  // переборы
  if (pos % 2 === 0) {
    const k = d.arpPat[(pos / 2) % d.arpPat.length];
    if (k >= 0) { const [kind, vol, len] = d.arp; voice(kind, hz(d.key + chord[k % 3] + (k > 2 ? 12 : 0)), tt, len * spb, vol, dry); }
  }
  // бас
  if (pos === 0) voice('pluck', hz(d.key - 12 + chord[0]), tt, spb * 1.6, d.bass, dry);
  else if (pos === 8) voice('pluck', hz(d.key - 12 + chord[2] - (chord[2] > 9 ? 12 : 0)), tt, spb * 1.2, d.bass * 0.8, dry);
  else if (d.perc >= 2 && pos === 14) voice('pluck', hz(d.key - 12 + chord[0]), tt, spb * 0.4, d.bass * 0.6, dry);
  // ударные: 1 — шейкер, 2 — лёгкий бит, 3 — бубенцы, 4 — диско
  if (d.perc === 1) { if (pos % 4 === 2) drum('hat', tt, 0.018, dry); }
  else if (d.perc === 2) { if (pos % 8 === 0) drum('kick', tt, 0.11, dry); if (pos % 8 === 4) drum('snare', tt, 0.03, dry); if (pos % 2 === 0) drum('hat', tt, pos % 4 === 2 ? 0.02 : 0.01, dry); }
  else if (d.perc === 3) { if (pos % 4 === 0) { voice('bell', 3520 + (pos % 8 ? 400 : 0), tt, 0.12, 0.012, dry); voice('bell', 4700, tt + 0.03, 0.1, 0.008, dry); } }
  else if (d.perc === 4) { if (pos % 4 === 0) drum('kick', tt, 0.15, dry); if (pos % 8 === 4) drum('snare', tt, 0.04, dry); if (pos % 4 === 2) drum('hat', tt, 0.03, dry); }
}

function startTrack(id) {
  const def = TRACKS[id];
  if (!def) return null;
  const bus = ac.createGain();
  bus.gain.setValueAtTime(0.0001, ac.currentTime);
  bus.gain.exponentialRampToValueAtTime(MUSIC_GAIN, ac.currentTime + 1.2);
  bus.connect(musicBus);
  const send = ac.createGain(); send.gain.value = 1; send.connect(delayIn);
  return { id, def, bus, send, step: 0, next: ac.currentTime + 0.15, motif: [], barNotes: [], deg: 5, rest: false };
}
function stopTrack(tr) {
  const t = ac.currentTime;
  tr.bus.gain.cancelScheduledValues(t); tr.bus.gain.setTargetAtTime(0, t, 0.25);
  tr.send.gain.setTargetAtTime(0, t, 0.1);
  setTimeout(() => { try { tr.bus.disconnect(); tr.send.disconnect(); } catch (e) { /* уже отключено */ } }, 1500);
}
/** Какая музыка должна играть (id из TRACKS или null — тишина). */
export function setMusic(id) { wanted = id; }

// =====================================================================
//                              ОКРУЖЕНИЕ
// =====================================================================
const amb = { sea: 0, rain: 0, birds: false, night: false };
let seaNode = null, rainNode = null;
export function setAmbience(a) { Object.assign(amb, a); }
function loopNoise(type, freq, q = 0.7) {
  const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ac.createGain(); g.gain.value = 0;
  src.connect(f); f.connect(g); g.connect(ambBus); src.start();
  return { g, f };
}
function chirp(t0) {
  const base = 2600 + Math.random() * 1400, n = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) tone(base * (1 + (i % 2) * 0.12), t0 + i * 0.09, 0.07, 'sine', 0.018, base * 1.25, ambBus);
}
function cricket() { for (let i = 0; i < 3; i++) tone(4300, i * 0.07, 0.04, 'sine', 0.008, null, ambBus); }

function tick() {
  if (!ac || ac.state !== 'running') return;
  const now = ac.currentTime;
  // --- музыка
  const want = musicOn ? wanted : null;
  if ((cur ? cur.id : null) !== want) {
    if (cur) stopTrack(cur);
    cur = want ? startTrack(want) : null;
  }
  if (cur) {
    if (cur.next < now - 0.3) cur.next = now + 0.05; // вкладка спала — не догоняем пропущенное
    const s16 = 60 / cur.def.bpm / 4;
    while (cur.next < now + 0.22) { schedStep(cur, cur.next); cur.step++; cur.next += s16; }
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
    if (amb.birds && Math.random() < 0.012) chirp(0);
    if (amb.night && Math.random() < 0.03) cricket();
  }
}
