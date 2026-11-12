// Простые звуки, синтезированные через WebAudio (без файлов).
let ac = null;
let muted = false;
try { muted = localStorage.getItem('rhr-muted') === '1'; } catch (e) { /* нет доступа — не страшно */ }

function ctx() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
export function unlockAudio() { ctx(); }
export function isMuted() { return muted; }
export function setMuted(m) {
  muted = m;
  try { localStorage.setItem('rhr-muted', m ? '1' : '0'); } catch (e) { /* ignore */ }
}

function tone(freq, t0, dur, type = 'sine', vol = 0.12, slideTo = null) {
  const a = ctx(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, a.currentTime + t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, a.currentTime + t0 + dur);
  g.gain.setValueAtTime(0.0001, a.currentTime + t0);
  g.gain.exponentialRampToValueAtTime(vol, a.currentTime + t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + t0 + dur);
  o.connect(g); g.connect(a.destination);
  o.start(a.currentTime + t0); o.stop(a.currentTime + t0 + dur + 0.03);
}
function noise(t0, dur, vol = 0.08, freq = 1200) {
  const a = ctx(); if (!a) return;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource(); src.buffer = buf;
  const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq;
  const g = a.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(a.destination);
  src.start(a.currentTime + t0);
}

const SOUNDS = {
  tap: () => tone(660, 0, 0.07, 'triangle', 0.08),
  step: () => tone(180, 0, 0.05, 'sine', 0.03),
  pop: () => tone(520, 0, 0.09, 'sine', 0.12, 900),
  coin: () => { tone(988, 0, 0.08, 'square', 0.05); tone(1319, 0.07, 0.16, 'square', 0.05); },
  ok: () => { tone(660, 0, 0.1, 'triangle'); tone(880, 0.09, 0.16, 'triangle'); },
  bad: () => { tone(300, 0, 0.14, 'sawtooth', 0.06, 200); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.22, 'triangle', 0.12)),
  splash: () => noise(0, 0.25, 0.1, 900),
  door: () => { tone(220, 0, 0.08, 'square', 0.04); tone(165, 0.08, 0.12, 'square', 0.04); },
  mail: () => { tone(784, 0, 0.1, 'triangle'); tone(1047, 0.1, 0.1, 'triangle'); tone(1319, 0.2, 0.2, 'triangle'); },
  magic: () => [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, i * 0.06, 0.2, 'sine', 0.08)),
  eat: () => { noise(0, 0.07, 0.08, 500); noise(0.14, 0.07, 0.08, 600); },
  tick: () => tone(1200, 0, 0.03, 'square', 0.03),
  whistle: () => tone(1800, 0, 0.3, 'sine', 0.09, 2400),
  bubble: () => tone(300 + Math.random() * 400, 0, 0.12, 'sine', 0.06, 900),
  note: (f = 440) => tone(f, 0, 0.35, 'triangle', 0.12),
  flush: () => noise(0, 0.9, 0.09, 400),
  sleep: () => [659, 523, 440, 349].forEach((f, i) => tone(f, i * 0.22, 0.4, 'sine', 0.09)),
};

export function sfx(name, arg) {
  if (muted) return;
  const f = SOUNDS[name];
  if (f) { try { f(arg); } catch (e) { /* звук не критичен */ } }
}
