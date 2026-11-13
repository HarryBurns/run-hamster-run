// Пианино во весь экран: нажимай на клавиши сам, играй что хочешь или учи песенки по подсветке.
import { el, rnd } from '../core/util.js';
import { makeCanvas, ell, fillRR } from '../core/draw.js';
import { drawHamster, blinkAt } from '../art/hamster.js';
import { playerLook } from '../core/state.js';
import { award } from '../core/actions.js';
import { emit } from '../core/events.js';
import { register } from '../core/registry.js';
import { sfx, playNote, isMuted, setMuted, unlockAudio } from '../core/audio.js';
import { toast } from '../ui/toast.js';
import { openLayer } from '../ui/modals.js';

const NAMES = ['До', '', 'Ре', '', 'Ми', 'Фа', '', 'Соль', '', 'Ля', '', 'Си'];
const BLACK = [1, 3, 6, 8, 10];
const LO = 60,
  HI = 84; // от «до» первой октавы до «до» третьей
const INSTR = [
  ['piano', '🎹 Пианино'],
  ['bells', '🔔 Колокольчики'],
  ['squeak', '🐹 Пи-пи'],
];
// клавиатура компьютера: нижний ряд букв — белые клавиши, верхний — чёрные
const KEYMAP = {
  KeyA: 60,
  KeyW: 61,
  KeyS: 62,
  KeyE: 63,
  KeyD: 64,
  KeyF: 65,
  KeyT: 66,
  KeyG: 67,
  KeyY: 68,
  KeyH: 69,
  KeyU: 70,
  KeyJ: 71,
  KeyK: 72,
  KeyO: 73,
  KeyL: 74,
  KeyP: 75,
  Semicolon: 76,
};

const N = (str) =>
  str
    .trim()
    .split(/\s+/)
    .map((s) => 12 * (parseInt(s.slice(-1), 10) + 1) + { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[s[0]]);
const SONGS = [
  { name: 'Гамма', notes: N('C4 D4 E4 F4 G4 A4 B4 C5 C5 B4 A4 G4 F4 E4 D4 C4') },
  { name: 'Чижик-пыжик', notes: N('E4 C4 E4 C4 F4 E4 D4 G4 G4 A4 B4 C5 C5 C5') },
  {
    name: 'Звёздочка',
    notes: N(
      'C4 C4 G4 G4 A4 A4 G4 F4 F4 E4 E4 D4 D4 C4 G4 G4 F4 F4 E4 E4 D4 G4 G4 F4 F4 E4 E4 D4 C4 C4 G4 G4 A4 A4 G4 F4 F4 E4 E4 D4 D4 C4',
    ),
  },
  {
    name: 'В лесу родилась ёлочка',
    notes: N('G4 E5 E5 D5 E5 C5 G4 G4 G4 E5 E5 F5 D5 G5 G5 A4 A4 F5 F5 E5 D5 C5 G4 E5 E5 D5 E5 C5'),
  },
  { name: 'С днём рождения', notes: N('G4 G4 A4 G4 C5 B4 G4 G4 A4 G4 D5 C5 G4 G4 G5 E5 C5 B4 A4 F5 F5 E5 C5 D5 C5') },
];

export function openPiano() {
  if (document.getElementById('piano')) return;
  unlockAudio();
  const closeLayer = openLayer({ cover: true });
  const root = el('div');
  root.id = 'piano';
  const head = el('div', 'pn-head', '<span>🎹</span><span class="title">Пианино</span>');
  const x = el('button', 'xbtn', '✕');
  head.appendChild(x);
  const stageBox = el('div', 'pn-stage');
  const bar = el('div', 'pn-bar');
  const keysBox = el('div', 'pn-keys');
  root.append(head, stageBox, bar, keysBox);
  document.body.appendChild(root);

  let inst = 0,
    labels = true,
    song = null,
    pos = 0,
    lastHit = -9,
    lastSide = 1,
    raf = 0,
    closed = false,
    stage = null;
  const notes = []; // летящие нотки
  const keyEls = {}; // midi → элемент клавиши
  const held = new Map(); // палец → клавиша

  // ---------- сцена с хомячком ----------
  function buildStage() {
    stageBox.innerHTML = '';
    const r = stageBox.getBoundingClientRect();
    stage = makeCanvas(Math.max(200, r.width), Math.max(80, r.height));
    stage.w = Math.max(200, r.width);
    stage.h = Math.max(80, r.height);
    stageBox.appendChild(stage.canvas);
  }
  function drawStage() {
    if (closed) return;
    const { ctx, w, h } = stage,
      t = performance.now() / 1000,
      hot = t - lastHit < 0.22;
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w / 2, h, 10, w / 2, h, Math.max(w, h));
    g.addColorStop(0, 'rgba(255,236,153,.55)');
    g.addColorStop(1, 'rgba(255,236,153,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const s = Math.min(2.2, (h - 8) / 80); // чтобы голова с шапкой помещалась целиком
    drawHamster(ctx, w / 2 + (hot ? lastSide * 5 * s : 0), h + 30 * s, s, playerLook(), {
      time: t,
      shadow: false,
      happy: t - lastHit < 1.2,
      blink: blinkAt(t),
      armsUp: hot,
    });
    fillRR(ctx, w / 2 - 70 * s, h - 12 * s, 140 * s, 30 * s, 6 * s, '#343a40', '#4a3728', 2); // крышка пианино
    for (const n of notes) {
      n.t += 1 / 60;
      n.x += n.vx / 60;
      n.y -= n.vy / 60;
      ctx.globalAlpha = Math.max(0, 1 - n.t / 1.6);
      ctx.fillStyle = n.c;
      ctx.font = `900 ${n.s}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(n.ch, n.x, n.y);
    }
    ctx.globalAlpha = 1;
    for (let i = notes.length - 1; i >= 0; i--) if (notes[i].t > 1.6) notes.splice(i, 1);
    raf = requestAnimationFrame(drawStage);
  }

  // ---------- клавиши ----------
  function buildKeys() {
    keysBox.innerHTML = '';
    for (const k of Object.keys(keyEls)) delete keyEls[k];
    const r = keysBox.getBoundingClientRect();
    // на узком экране — два ряда: сверху высокие ноты, снизу низкие
    const rows =
      r.width < 560
        ? [
            [72, 84],
            [60, 71],
          ]
        : [[LO, HI]];
    for (const [a, b] of rows) {
      const row = el('div', 'pn-row');
      const whites = [];
      for (let m = a; m <= b; m++) if (!BLACK.includes(m % 12)) whites.push(m);
      whites.forEach((m) => {
        const k = el('div', 'pn-w', labels ? `<span>${NAMES[m % 12]}</span>` : '');
        k.dataset.m = m;
        keyEls[m] = k;
        row.appendChild(k);
      });
      whites.forEach((m, i) => {
        if (!BLACK.includes((m + 1) % 12) || m + 1 > b) return;
        const k = el('div', 'pn-b');
        k.style.width = `${(100 / whites.length) * 0.62}%`;
        k.style.left = `${((i + 1) / whites.length) * 100 - (100 / whites.length) * 0.31}%`;
        k.dataset.m = m + 1;
        keyEls[m + 1] = k;
        row.appendChild(k);
      });
      keysBox.appendChild(row);
    }
    showHint();
  }
  function showHint() {
    for (const k of Object.values(keyEls)) k.classList.remove('hint');
    if (song && keyEls[song.notes[pos]]) keyEls[song.notes[pos]].classList.add('hint');
  }
  function press(m) {
    const k = keyEls[m];
    if (!k) return;
    playNote(m, INSTR[inst][0]);
    k.classList.add('down');
    const t = performance.now() / 1000;
    lastHit = t;
    lastSide = m >= 72 ? 1 : -1;
    if (stage)
      notes.push({
        x: stage.w * (0.2 + 0.6 * ((m - LO) / (HI - LO))),
        y: stage.h * 0.75,
        vx: rnd(-20, 20),
        vy: rnd(50, 90),
        t: 0,
        s: 22 + Math.random() * 12,
        ch: Math.random() < 0.5 ? '♪' : '♫',
        c: ['#ffd43b', '#ff8fab', '#74c0fc', '#b2f2bb', '#fff'][m % 5],
      });
    if (song && m === song.notes[pos]) {
      pos++;
      if (pos >= song.notes.length) finishSong();
      showHint();
      renderBar();
    }
  }
  const release = (m) => {
    if (keyEls[m]) keyEls[m].classList.remove('down');
  };
  function finishSong() {
    const name = song.name;
    pos = 0;
    setTimeout(() => {
      if (!closed) sfx('fanfare');
    }, 500);
    toast(`Браво! Ты сыграла «${name}» 👏`, 'good');
    award('x_piano', { delay: 1400 });
    emit('piano');
  }

  // пальцы: можно нажимать несколько клавиш сразу и вести пальцем по клавишам
  const keyAt = (e) => {
    const t = document.elementFromPoint(e.clientX, e.clientY);
    return t && t.closest ? t.closest('[data-m]') : null;
  };
  const onDown = (e) => {
    e.preventDefault();
    const k = keyAt(e);
    if (!k) return;
    const m = +k.dataset.m;
    held.set(e.pointerId, m);
    press(m);
  };
  const onMove = (e) => {
    if (!held.has(e.pointerId)) return;
    const k = keyAt(e),
      m = k ? +k.dataset.m : null,
      was = held.get(e.pointerId);
    if (m === was) return;
    if (was !== null) release(was);
    held.set(e.pointerId, m);
    if (m !== null) press(m);
  };
  const onUp = (e) => {
    if (!held.has(e.pointerId)) return;
    const was = held.get(e.pointerId);
    if (was !== null) release(was);
    held.delete(e.pointerId);
  };
  keysBox.addEventListener('pointerdown', onDown);
  keysBox.addEventListener('pointermove', onMove);
  keysBox.addEventListener('pointerup', onUp);
  keysBox.addEventListener('pointercancel', onUp);
  keysBox.addEventListener('contextmenu', (e) => e.preventDefault());
  const kd = (e) => {
    if (e.code === 'Escape') {
      close();
      return;
    }
    const m = KEYMAP[e.code];
    if (m === undefined || e.repeat) return;
    e.preventDefault();
    press(m);
  };
  const ku = (e) => {
    const m = KEYMAP[e.code];
    if (m !== undefined) release(m);
  };
  window.addEventListener('keydown', kd);
  window.addEventListener('keyup', ku);

  // ---------- панель с кнопками ----------
  function renderBar() {
    bar.innerHTML = '';
    const btn = (label, cls, fn) => {
      const b = el('button', 'btn small ' + cls, label);
      b.onclick = () => {
        fn();
        renderBar();
      };
      bar.appendChild(b);
      return b;
    };
    if (isMuted()) btn('🔇 Включить звук', 'yellow', () => setMuted(false));
    if (song) {
      bar.appendChild(
        el('span', 'pn-song', `🎵 <b>${song.name}</b> · ${pos} из ${song.notes.length} — нажимай зелёную клавишу`),
      );
      btn('✖ Просто играть', 'ghost', () => {
        song = null;
        showHint();
      });
    } else {
      const sel = el('select', 'pn-select');
      sel.appendChild(new Option('🎵 Выучить песенку…', ''));
      SONGS.forEach((s, i) => sel.appendChild(new Option(s.name, String(i))));
      sel.onchange = () => {
        if (sel.value !== '') {
          song = SONGS[+sel.value];
          pos = 0;
          showHint();
          renderBar();
        }
      };
      bar.appendChild(sel);
    }
    btn(INSTR[inst][1], 'blue', () => {
      inst = (inst + 1) % INSTR.length;
      playNote(72, INSTR[inst][0]);
    });
    btn(labels ? '🔤 До-ре-ми: да' : '🔤 До-ре-ми: нет', 'ghost', () => {
      labels = !labels;
      buildKeys();
    });
  }

  const onResize = () => {
    buildStage();
    buildKeys();
  };
  window.addEventListener('resize', onResize);
  function close() {
    if (closed) return;
    closed = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', kd);
    window.removeEventListener('keyup', ku);
    window.removeEventListener('resize', onResize);
    root.remove();
    closeLayer();
  }
  x.onclick = () => {
    sfx('tap');
    close();
  };

  renderBar();
  buildStage();
  buildKeys();
  drawStage();
  void ell;
}

register('piano', () => openPiano(), 'пианино во весь экран');
