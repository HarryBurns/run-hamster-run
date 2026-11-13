// Мини-игра «Учительница»: проверяем примеры в тетрадках — верно или ошибка.
import { el, makeCanvas, pick, shuffle, irnd, fillRR, line, clamp } from '../util.js';

const TOTAL = 10;

const CSS = `
.tch{position:absolute;inset:0;display:flex;flex-direction:column;overflow:hidden;
  background:linear-gradient(#fdf1cf 0,#fdf1cf 70%,#d9b384 70%,#cfa574 100%);--stu:150px;--tea:120px;--ex:44px;--bl:36px}
.tch-top{flex:none;display:flex;align-items:center;gap:8px;padding:8px 12px 6px;flex-wrap:wrap}
.tch-count{font-weight:900;background:rgba(255,255,255,.9);border-radius:12px;padding:4px 10px;font-size:15px;white-space:nowrap;
  box-shadow:0 2px 0 rgba(74,55,40,.15)}
.tch-marks{display:flex;gap:3px}
.tch-mark{width:20px;height:20px;border-radius:50%;background:#fff;border:2px solid #e0cfae;font-size:12px;line-height:1;
  display:grid;place-items:center;color:#fff;font-weight:900}
.tch-mark.ok{background:#51cf66;border-color:#2f9e44}
.tch-mark.no{background:#ff6b6b;border-color:#c92a2a}
.tch-mark.cur{border-color:#ff6b9d;box-shadow:0 0 0 2px #ffd0de}
.tch-mid{flex:1;min-height:0;display:flex;flex-direction:column;gap:8px;padding:0 12px}
.tch.wide .tch-mid{flex-direction:row;gap:14px;width:100%;max-width:1040px;margin:0 auto}
.tch-boardwrap{flex:0 1 230px;min-height:0;display:flex;align-items:flex-end;gap:4px}
.tch.wide .tch-boardwrap{flex:1 1 0}
.tch.wide .tch-board{height:min(100%,340px);align-self:center}
.tch-board{flex:1;align-self:stretch;min-width:0;background:#2f6b4f;border:8px solid #b9834f;border-radius:14px;color:#fff;
  display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:6px 8px;gap:2px;
  box-shadow:inset 0 0 30px rgba(0,0,0,.18),0 4px 0 rgba(74,55,40,.2);font-family:"Comic Sans MS","Marker Felt","Segoe Print",var(--font)}
.tch-b-title{font-size:calc(var(--ex)*.5);font-weight:800;opacity:.95;line-height:1.1}
.tch-b-line{font-size:var(--bl);font-weight:900;line-height:1.1;white-space:nowrap;color:#fff9c4;min-height:1.1em}
.tch-b-sub{font-size:calc(var(--ex)*.36);opacity:.85;line-height:1.15}
.tch-tea{flex:none;width:var(--tea);height:auto;display:block}
.tch-desk{flex:1 1 0;min-height:0;display:flex;align-items:center;justify-content:center;gap:6px;padding-bottom:4px}
.tch.wide .tch-desk{align-items:flex-end}
.tch.wide .tch-note{margin-bottom:26px}
.tch.tall .tch-desk{flex-direction:column-reverse;gap:14px}
.tch-stu{flex:none;width:var(--stu);height:auto;display:block}
.tch-note{position:relative;background-color:#fff;background-image:linear-gradient(#d6e6ff 1.5px,transparent 1.5px),linear-gradient(90deg,#d6e6ff 1.5px,transparent 1.5px);
  background-size:18px 18px;border-radius:10px;border:3px solid #9ec5fe;border-left:12px solid #ff8fab;padding:8px 18px 12px 16px;
  box-shadow:0 5px 0 rgba(74,55,40,.18);transform:rotate(-2deg);text-align:center;animation:tch-in .3s cubic-bezier(.2,1.4,.4,1)}
@keyframes tch-in{from{transform:translateY(30px) rotate(6deg) scale(.7);opacity:0}to{transform:rotate(-2deg);opacity:1}}
.tch-who{font-size:13px;font-weight:800;opacity:.6;white-space:nowrap}
.tch-ex{font-size:var(--ex);font-weight:900;white-space:nowrap;color:#1c3faa;line-height:1.15;font-family:"Comic Sans MS","Marker Felt","Segoe Print",var(--font)}
.tch-ex s{color:#fa5252;text-decoration-thickness:4px}
.tch-ex .fix{color:#e03131}
.tch-stamp{position:absolute;right:-14px;top:-18px;width:52px;height:52px;border-radius:50%;display:grid;place-items:center;font-size:30px;
  font-weight:900;color:#fff;border:4px solid #fff;box-shadow:0 3px 0 rgba(74,55,40,.25);transform:rotate(12deg);animation:tch-stamp .25s cubic-bezier(.2,1.6,.4,1)}
.tch-stamp.ok{background:#40c057}.tch-stamp.no{background:#fa5252}
@keyframes tch-stamp{from{transform:scale(2.4) rotate(-20deg);opacity:0}to{transform:rotate(12deg);opacity:1}}
.tch-btns{flex:none;display:flex;gap:12px;padding:10px 12px calc(12px + env(safe-area-inset-bottom));justify-content:center}
.tch-btns .btn{flex:1;max-width:300px;white-space:nowrap}
.tch-btns .btn.no{background:#ff6b6b;box-shadow:0 4px 0 #c92a2a}
.tch-btns .btn.no:active{box-shadow:0 1px 0 #c92a2a}
.tch.wide .tch-btns{padding-top:6px;padding-bottom:calc(8px + env(safe-area-inset-bottom))}
.tch.short .tch-btns .btn{padding:9px 20px;font-size:19px}
.tch.short .tch-top{padding:5px 12px 3px}
`;

function makeProblem(level) {
  const kinds = level >= 2 ? ['+', '-', '×', '×'] : ['+', '-'];
  const op = pick(kinds);
  let a, b, ans;
  if (op === '×') {
    a = irnd(2, 9);
    b = irnd(2, 9);
    ans = a * b;
  } else if (level <= 0) {
    if (op === '+') {
      a = irnd(2, 12);
      b = irnd(1, Math.min(9, 20 - a));
      ans = a + b;
    } else {
      a = irnd(5, 20);
      b = irnd(1, Math.min(10, a - 1));
      ans = a - b;
    }
  } else if (op === '+') {
    a = irnd(11, 65);
    b = irnd(5, Math.min(40, 100 - a));
    ans = a + b;
  } else {
    a = irnd(21, 99);
    b = irnd(5, Math.min(50, a - 5));
    ans = a - b;
  }
  return { a, b, op, ans, key: a + op + b };
}

function wrongAnswer(p) {
  const deltas = shuffle([-1, 1, -2, 2, 10, -10]);
  for (const d of deltas) {
    const v = p.ans + d;
    if (v >= 0 && v !== p.ans) return v;
  }
  return p.ans + 1;
}

export default {
  id: 'teacher',
  title: 'Учительница',
  icon: '👩‍🏫',
  howTo:
    'Ученики приносят тетрадки с примерами. Посмотри на пример и реши: он решён <b>верно</b> или в нём <b>ошибка</b>? Всего 10 тетрадок.',

  start(host) {
    const root = host.root;
    const level = host.level || 0;
    let stopped = false,
      raf = 0;
    const timers = new Set();
    const later = (fn, ms) => {
      const id = setTimeout(() => {
        timers.delete(id);
        if (!stopped) fn();
      }, ms);
      timers.add(id);
    };

    // --- задания
    const wrongCount = pick([4, 5, 5, 6]);
    const flags = shuffle(Array.from({ length: TOTAL }, (_, i) => i < wrongCount));
    const seen = new Set();
    const tasks = flags.map((isWrong) => {
      let p;
      for (let i = 0; i < 30; i++) {
        p = makeProblem(level);
        if (!seen.has(p.key)) break;
      }
      seen.add(p.key);
      return { ...p, shown: isWrong ? wrongAnswer(p) : p.ans, isWrong };
    });
    const fallback = [{ id: 'me', name: 'Ученик', look: host.look }];
    const students = shuffle(host.friends && host.friends.length ? host.friends : fallback);

    // --- разметка
    const wrap = el('div', 'tch tall');
    wrap.innerHTML = `<style>${CSS}</style>
      <div class="tch-top"><div class="tch-count"></div><div class="tch-marks"></div></div>
      <div class="tch-mid">
        <div class="tch-boardwrap">
          <div class="tch-board"><div class="tch-b-title"></div><div class="tch-b-line"></div><div class="tch-b-sub"></div></div>
        </div>
        <div class="tch-desk"></div>
      </div>
      <div class="tch-btns">
        <button class="btn big green tch-yes">✔ Верно</button>
        <button class="btn big no tch-no">✘ Ошибка</button>
      </div>`;
    root.appendChild(wrap);
    const $ = (s) => wrap.querySelector(s);
    const countEl = $('.tch-count'),
      marksEl = $('.tch-marks');
    const bTitle = $('.tch-b-title'),
      bLine = $('.tch-b-line'),
      bSub = $('.tch-b-sub');
    const desk = $('.tch-desk');
    const btnYes = $('.tch-yes'),
      btnNo = $('.tch-no');

    const tea = makeCanvas(130, 140);
    tea.canvas.className = 'tch-tea';
    tea.canvas.style.width = '';
    tea.canvas.style.height = '';
    $('.tch-boardwrap').appendChild(tea.canvas);
    const stu = makeCanvas(150, 140);
    stu.canvas.className = 'tch-stu';
    stu.canvas.style.width = '';
    stu.canvas.style.height = '';
    desk.appendChild(stu.canvas);
    let note = null;

    const marks = [];
    for (let i = 0; i < TOTAL; i++) {
      const m = el('div', 'tch-mark');
      marksEl.appendChild(m);
      marks.push(m);
    }

    // --- состояние
    let idx = 0,
      correct = 0,
      phase = 'ask'; // ask | react | done
    let react = null; // 'happy' | 'oops' | null — реакция ученика
    let teacherTalk = false;
    let enterAt = 0; // время появления ученика (для анимации)
    let now = 0;

    const exText = (t, v) => `${t.a} ${t.op === '-' ? '−' : t.op} ${t.b} = ${v}`;

    function showTask() {
      const t = tasks[idx],
        s = students[idx % students.length];
      phase = 'ask';
      react = null;
      teacherTalk = false;
      enterAt = now;
      countEl.textContent = `Тетрадка ${idx + 1} из ${TOTAL}`;
      marks.forEach((m, i) => m.classList.toggle('cur', i === idx));
      bTitle.textContent = 'Проверь тетрадку!';
      bLine.textContent = '✔ или ✘ ?';
      bSub.textContent = '';
      if (note) note.remove();
      note = el(
        'div',
        'tch-note',
        `<div class="tch-who">Тетрадь: ${s.name}</div><div class="tch-ex">${exText(t, t.shown)}</div>`,
      );
      desk.appendChild(note);
      btnYes.disabled = btnNo.disabled = false;
      host.sfx('pop');
    }

    function answer(saysCorrect) {
      if (phase !== 'ask' || stopped) return;
      const t = tasks[idx];
      const right = saysCorrect === !t.isWrong;
      phase = 'react';
      btnYes.disabled = btnNo.disabled = true;
      marks[idx].classList.remove('cur');
      marks[idx].classList.add(right ? 'ok' : 'no');
      marks[idx].textContent = right ? '✔' : '✘';
      // оценка в тетрадке — как на самом деле
      const exEl = note.querySelector('.tch-ex');
      if (t.isWrong)
        exEl.innerHTML = `${t.a} ${t.op === '-' ? '−' : t.op} ${t.b} = <s>${t.shown}</s> <span class="fix">${t.ans}</span>`;
      note.appendChild(el('div', 'tch-stamp ' + (t.isWrong ? 'no' : 'ok'), t.isWrong ? '✘' : '✔'));
      teacherTalk = true;
      if (right) {
        correct++;
        host.sfx('ok');
        bTitle.textContent = pick(['Молодец! ⭐', 'Правильно! ⭐', 'Отлично! ⭐']);
        bLine.textContent = exText(t, t.ans);
        bSub.textContent = t.isWrong ? 'В тетрадке была ошибка — ты её нашла!' : 'Пример решён верно.';
        react = t.isWrong ? 'oops' : 'happy';
      } else {
        host.sfx('bad');
        bTitle.textContent = 'Ой! Правильно так:';
        bLine.textContent = exText(t, t.ans);
        bSub.textContent = t.isWrong ? 'В тетрадке была ошибка.' : 'Этот пример был решён верно.';
        react = t.isWrong ? 'oops' : 'happy';
      }
      later(next, right ? 1500 : 2600);
    }

    function next() {
      idx++;
      if (idx >= TOTAL) {
        phase = 'done';
        const stars = correct >= 9 ? 3 : correct >= 6 ? 2 : 1;
        host.finish({
          stars,
          text: `Ты правильно проверила ${correct} из ${TOTAL} тетрадок!` + (stars === 3 ? ' Ученики в восторге!' : ''),
          extra: { correct },
        });
        return;
      }
      showTask();
    }

    btnYes.onclick = () => answer(true);
    btnNo.onclick = () => answer(false);
    const onKey = (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'v' || k === 'м') {
        e.preventDefault();
        answer(true);
      } else if (k === 'arrowright' || k === 'x' || k === 'ч') {
        e.preventDefault();
        answer(false);
      }
    };
    window.addEventListener('keydown', onKey);

    // --- подгонка размеров
    const fit = () => {
      const r = root.getBoundingClientRect();
      const wide = r.width > r.height * 1.25;
      wrap.classList.toggle('wide', wide);
      wrap.classList.toggle('tall', !wide);
      wrap.classList.toggle('short', r.height < 420);
      const stuW = wide ? clamp(r.height * 0.4, 90, 190) : clamp(r.height * 0.2, 100, 190);
      const teaW = wide ? clamp(r.height * 0.36, 80, 170) : clamp(r.height * 0.15, 76, 140);
      const ex = wide ? clamp(Math.min(r.height * 0.13, r.width * 0.05), 24, 56) : clamp(r.width * 0.115, 28, 58);
      wrap.style.setProperty('--stu', stuW + 'px');
      wrap.style.setProperty('--tea', teaW + 'px');
      wrap.style.setProperty('--ex', ex + 'px');
      // строка с примером на доске должна помещаться по ширине доски
      const boardW = (wide ? Math.min(r.width, 1040) / 2 - 19 : r.width - 24) - teaW - 40;
      wrap.style.setProperty('--bl', clamp(Math.min(ex * 0.85, boardW / 8), 14, 50) + 'px');
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(root);

    // --- анимация хомячков
    const t0 = performance.now();
    const frame = (ts) => {
      if (stopped) return;
      now = (ts - t0) / 1000;
      const blink = now % 3.4 < 0.13;
      // учительница
      const c1 = tea.ctx;
      c1.clearRect(0, 0, 130, 140);
      host.drawHamster(c1, 58, 132, 1.25, host.look, { time: now, talk: teacherTalk, blink, dir: -1 });
      line(c1, 86, 92, 122, 40, '#8d5524', 4); // указка
      // ученик за партой
      const c2 = stu.ctx;
      c2.clearRect(0, 0, 150, 140);
      const s = students[idx % students.length];
      const k = clamp((now - enterAt) / 0.35, 0, 1);
      const slide = (1 - k) * (1 - k) * 150;
      const hop = react === 'happy' ? Math.abs(Math.sin(now * 9)) * 6 : 0;
      host.drawHamster(c2, 75 + slide, 118 - hop, 1.15, s.look, {
        time: now,
        shadow: false,
        happy: react === 'happy',
        armsUp: react === 'happy',
        blink: react === 'oops' ? true : blink,
      });
      fillRR(c2, 6, 108, 138, 30, 8, '#c98b5a', '#4a3728', 2);
      fillRR(c2, 12, 113, 126, 5, 2, '#e0a877');
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    showTask();

    return {
      stop() {
        stopped = true;
        cancelAnimationFrame(raf);
        timers.forEach(clearTimeout);
        timers.clear();
        window.removeEventListener('keydown', onKey);
        ro.disconnect();
        wrap.remove();
      },
    };
  },
};
