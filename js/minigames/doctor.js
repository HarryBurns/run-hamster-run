// Мини-игра «Доктор»: подбери правильное лечение каждому пациенту.
import { el, makeCanvas, shuffle, fillRR, heart, clamp } from '../util.js';

const TOTAL = 8;

const CURES = {
  thermo: { e: '🌡️', name: 'Градусник' },
  plaster: { e: '🩹', name: 'Пластырь' },
  drops: { e: '💧', name: 'Капли в нос' },
  syrup: { e: '🍯', name: 'Сироп от кашля' },
  ice: { e: '🧊', name: 'Холодный лёд' },
  tea: { e: '🍵', name: 'Ромашковый чай' },
  brush: { e: '🪥', name: 'Зубная щётка' },
  milk: { e: '🥛', name: 'Тёплое молоко' },
  glasses: { e: '👓', name: 'Отдых и очки' },
  cream: { e: '🧴', name: 'Крем от ожогов' },
  vit: { e: '🍊', name: 'Витамины' },
};

const CASES = [
  { e: '🤒', say: 'У меня, кажется, температура… Мне жарко и грустно.', cure: 'thermo', hint: 'Сначала нужно измерить температуру.' },
  { e: '😿', say: 'Ай! У меня царапина на лапке!', cure: 'plaster', hint: 'Царапину нужно чем-то заклеить.' },
  { e: '🤧', say: 'Апчхи! У меня насморк, нос совсем не дышит.', cure: 'drops', hint: 'Носу помогут специальные капельки.' },
  { e: '😷', say: 'Кхе-кхе! Кашель замучил.', cure: 'syrup', hint: 'От кашля пьют сладкое лекарство с ложечки.' },
  { e: '🤕', say: 'Колесо крутилось слишком быстро — и бух! У меня шишка!', cure: 'ice', hint: 'К шишке прикладывают что-нибудь холодное.' },
  { e: '🤢', say: 'Болит животик… Слишком много семечек!', cure: 'tea', hint: 'Животик успокоит тёплый травяной напиток.' },
  { e: '🦷', say: 'Ой-ой-ой, болит зуб! Я забываю его чистить.', cure: 'brush', hint: 'Зубы нужно чистить два раза в день.' },
  { e: '🥱', say: 'Не могу уснуть уже третью ночь…', cure: 'milk', hint: 'Перед сном хорошо выпить что-нибудь тёплое и белое.' },
  { e: '😵', say: 'Болят глазки. Весь день — одни мультики!', cure: 'glasses', hint: 'Глазкам нужен отдых от экрана.' },
  { e: '🥵', say: 'У меня обгорел нос на пляже. Щиплет!', cure: 'cream', hint: 'Обгоревшую кожу нужно намазать.' },
  { e: '😪', say: 'Что-то я совсем без сил, всё время хочу спать.', cure: 'vit', hint: 'Для сил нужны полезные оранжевые фрукты.' },
];

const CSS = `
.doc{position:absolute;inset:0;display:flex;flex-direction:column;overflow:hidden;background:#d3f9f1;--cv:320px}
.doc-top{flex:none;display:flex;align-items:center;gap:8px;padding:8px 12px 6px}
.doc-count,.doc-miss{font-weight:900;background:rgba(255,255,255,.9);border-radius:12px;padding:4px 10px;font-size:15px;white-space:nowrap;
  box-shadow:0 2px 0 rgba(74,55,40,.15)}
.doc-miss{margin-left:auto}
.doc-main{flex:1;min-height:0;display:flex;flex-direction:column;gap:8px;padding:0 12px calc(12px + env(safe-area-inset-bottom))}
.doc.wide .doc-main{flex-direction:row;gap:14px;align-items:stretch}
.doc-left{flex:1 1 0;min-height:0;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px}
.doc-cv{flex:none;width:var(--cv);height:auto;display:block;border-radius:20px;box-shadow:0 4px 0 rgba(74,55,40,.15)}
.doc-bubble{position:relative;width:100%;max-width:440px;background:#fff;border-radius:20px;padding:8px 12px;display:flex;align-items:center;gap:10px;
  box-shadow:0 4px 0 rgba(74,55,40,.15);min-height:64px;transition:opacity .2s,transform .2s}
.doc-bubble.hide{opacity:0;transform:scale(.9)}
.doc-bubble::before{content:'';position:absolute;top:-12px;right:26%;border:8px solid transparent;border-bottom-color:#fff;border-top-width:6px}
.doc-bubble .em{font-size:40px;line-height:1;flex:none}
.doc-bubble .tx{font-size:16px;line-height:1.25;font-weight:800}
.doc-bubble .nm{font-size:13px;color:#d9487a;font-weight:900}
.doc-hint{font-size:14px;font-weight:800;color:#c2255c;min-height:1.3em;text-align:center;line-height:1.2}
.doc-right{flex:none;display:flex;flex-direction:column;justify-content:center;gap:6px}
.doc.wide .doc-right{flex:1 1 0}
.doc-q{text-align:center;font-size:15px;font-weight:900;opacity:.75}
.doc-btns{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.doc-btns.six{grid-template-columns:1fr 1fr 1fr}
.doc-b{border:0;border-radius:18px;background:#fff;box-shadow:0 4px 0 #b8e0d6;padding:8px 6px;display:flex;flex-direction:column;align-items:center;
  gap:2px;font-weight:800;font-size:14px;line-height:1.1;color:var(--ink);min-height:74px;justify-content:center;touch-action:manipulation;
  transition:transform .06s,box-shadow .06s,opacity .2s}
.doc-b:active{transform:translateY(3px);box-shadow:0 1px 0 #b8e0d6}
.doc-b .em{font-size:34px;line-height:1.1}
.doc-b.bad{opacity:.35;pointer-events:none;background:#ffe3e3}
.doc-b.good{background:#b2f2bb;box-shadow:0 4px 0 #2f9e44}
.doc-b[disabled]{pointer-events:none;color:var(--ink)}
.doc.short .doc-b{min-height:56px;padding:5px 4px;font-size:12px}
.doc.short .doc-b .em{font-size:26px}
.doc.short .doc-bubble{min-height:50px;padding:5px 10px}
.doc.short .doc-bubble .em{font-size:30px}
.doc.short .doc-bubble .tx{font-size:14px}
.doc.short .doc-top{padding:5px 12px 3px}
`;

const CW = 340, CH = 200; // логический размер сцены

export default {
  id: 'doctor',
  title: 'Доктор',
  icon: '🩺',
  howTo: 'К тебе пришли пациенты. Послушай, что болит у каждого, и выбери, что ему поможет. Если ошибёшься — получишь подсказку и сможешь выбрать ещё раз.',

  start(host) {
    const root = host.root;
    const optCount = (host.level || 0) >= 2 ? 6 : 4;
    let stopped = false, raf = 0;
    const timers = new Set();
    const later = (fn, ms) => {
      const id = setTimeout(() => { timers.delete(id); if (!stopped) fn(); }, ms);
      timers.add(id);
    };

    const cases = shuffle(CASES).slice(0, TOTAL);
    const fallback = [{ id: 'me', name: 'Пациент', look: host.look }];
    const patients = shuffle(host.friends && host.friends.length ? host.friends : fallback);
    const docLook = { ...host.look, outfit: { ...(host.look.outfit || {}), head: null } };

    const wrap = el('div', 'doc');
    wrap.innerHTML = `<style>${CSS}</style>
      <div class="doc-top"><div class="doc-count"></div><div class="doc-miss"></div></div>
      <div class="doc-main">
        <div class="doc-left">
          <div class="doc-bubble hide"><div class="em"></div><div><div class="nm"></div><div class="tx"></div></div></div>
          <div class="doc-hint"></div>
        </div>
        <div class="doc-right">
          <div class="doc-q">Что поможет?</div>
          <div class="doc-btns${optCount === 6 ? ' six' : ''}"></div>
        </div>
      </div>`;
    root.appendChild(wrap);
    const $ = (s) => wrap.querySelector(s);
    const countEl = $('.doc-count'), missEl = $('.doc-miss');
    const bubble = $('.doc-bubble'), hintEl = $('.doc-hint'), btnsEl = $('.doc-btns');
    const cv = makeCanvas(CW, CH); cv.canvas.className = 'doc-cv'; cv.canvas.style.width = ''; cv.canvas.style.height = '';
    $('.doc-left').prepend(cv.canvas);
    const ctx = cv.ctx;

    // --- состояние
    let idx = 0, mistakes = 0, now = 0;
    let phase = 'enter'; // enter | wait | wrong | happy | exit
    let phaseAt = 0;

    const setPhase = (p) => { phase = p; phaseAt = now; };
    const updTop = () => {
      countEl.textContent = `Пациент ${Math.min(idx + 1, TOTAL)} из ${TOTAL}`;
      missEl.textContent = mistakes ? `Ошибок: ${mistakes}` : 'Без ошибок 💚';
    };

    function buildButtons() {
      const c = cases[idx];
      const others = shuffle(Object.keys(CURES).filter((k) => k !== c.cure)).slice(0, optCount - 1);
      const opts = shuffle([c.cure, ...others]);
      btnsEl.innerHTML = '';
      for (const k of opts) {
        const b = el('button', 'doc-b', `<span class="em">${CURES[k].e}</span><span>${CURES[k].name}</span>`);
        b.dataset.cure = k;
        b.onclick = () => choose(k, b);
        btnsEl.appendChild(b);
      }
    }
    const lockButtons = (v) => btnsEl.querySelectorAll('.doc-b').forEach((b) => { b.disabled = v; });

    function startPatient() {
      const c = cases[idx], p = patients[idx % patients.length];
      updTop();
      hintEl.textContent = '';
      bubble.classList.add('hide');
      buildButtons(); lockButtons(true);
      setPhase('enter');
      later(() => {
        bubble.querySelector('.em').textContent = c.e;
        bubble.querySelector('.nm').textContent = p.name;
        bubble.querySelector('.tx').textContent = c.say;
        bubble.classList.remove('hide');
        setPhase('wait'); lockButtons(false);
        host.sfx('pop');
      }, 550);
    }

    function choose(k, btn) {
      if (phase === 'wrong') setPhase('wait'); // во время «мотания головой» тоже можно выбирать
      if (phase !== 'wait' || stopped) return;
      const c = cases[idx];
      if (k === c.cure) {
        btn.classList.add('good'); lockButtons(true);
        host.sfx('ok');
        hintEl.textContent = '';
        bubble.querySelector('.em').textContent = '😊';
        bubble.querySelector('.tx').textContent = 'Спасибо, доктор! Мне уже лучше!';
        setPhase('happy');
        later(() => {
          bubble.classList.add('hide');
          setPhase('exit');
          later(() => {
            idx++;
            if (idx >= TOTAL) return finish();
            startPatient();
          }, 480);
        }, 1300);
      } else {
        mistakes++; updTop();
        btn.classList.add('bad');
        host.sfx('bad');
        hintEl.textContent = '💡 ' + c.hint;
        setPhase('wrong');
        later(() => { if (phase === 'wrong') setPhase('wait'); }, 600);
      }
    }
    function finish() {
      const stars = mistakes <= 1 ? 3 : mistakes <= 4 ? 2 : 1;
      const text = mistakes === 0
        ? 'Все пациенты здоровы, и ни одной ошибки! Ты настоящий доктор!'
        : `Все ${TOTAL} пациентов вылечены! Ошибок: ${mistakes}.`;
      host.finish({ stars, text, extra: { mistakes } });
    }

    // --- подгонка размеров
    const fit = () => {
      const r = root.getBoundingClientRect();
      const wide = r.width > r.height * 1.25;
      const short = r.height < 420;
      wrap.classList.toggle('wide', wide);
      wrap.classList.toggle('short', short);
      const rows = optCount === 6 ? 2 : 2;
      let w;
      if (wide) w = Math.min(r.width * 0.5 - 30, (r.height - (short ? 150 : 190)) * (CW / CH));
      else w = Math.min(r.width - 24, (r.height - 190 - rows * (short ? 66 : 86)) * (CW / CH));
      wrap.style.setProperty('--cv', clamp(w, 150, 460) + 'px');
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(root);

    // --- сцена
    function drawRoom() {
      ctx.fillStyle = '#e6fcf5'; ctx.fillRect(0, 0, CW, CH);
      ctx.fillStyle = '#c3fae8'; for (let x = 0; x < CW; x += 34) ctx.fillRect(x, 0, 17, 150);
      ctx.fillStyle = '#ffe8cc'; ctx.fillRect(0, 150, CW, 50);
      ctx.fillStyle = '#ffd8a8'; ctx.fillRect(0, 150, CW, 5);
      // плакат с крестом
      fillRR(ctx, 150, 18, 50, 50, 10, '#fff', '#4a3728', 2);
      ctx.fillStyle = '#fa5252'; ctx.fillRect(169, 27, 12, 32); ctx.fillRect(159, 37, 32, 12);
      // кушетка
      fillRR(ctx, 196, 150, 130, 16, 6, '#74c0fc', '#4a3728', 2);
      ctx.fillStyle = '#4a3728'; ctx.fillRect(206, 166, 5, 18); ctx.fillRect(311, 166, 5, 18);
    }
    function drawCap(x, y, s) {
      // шапочка доктора
      fillRR(ctx, x - 20 * s, y - 92 * s, 40 * s, 22 * s, 8 * s, '#fff', '#4a3728', 2);
      ctx.fillStyle = '#fa5252';
      ctx.fillRect(x - 2.5 * s, y - 88 * s, 5 * s, 14 * s); ctx.fillRect(x - 7 * s, y - 83.5 * s, 14 * s, 5 * s);
    }

    const t0 = performance.now();
    const frame = (ts) => {
      if (stopped) return;
      now = (ts - t0) / 1000;
      const dt = now - phaseAt;
      const blink = now % 3.1 < 0.13;
      ctx.clearRect(0, 0, CW, CH);
      drawRoom();
      // доктор
      host.drawHamster(ctx, 70, 182, 1.15, docLook, { time: now, blink, talk: phase === 'wrong', happy: phase === 'happy' });
      drawCap(70, 182 - Math.sin(now * 2.2) * 0.7 * 1.15, 1.15);
      // пациент
      const p = patients[idx % patients.length];
      let px = 258, py = 150, pose = { time: now, blink, dir: -1 };
      if (phase === 'enter') {
        const k = clamp(dt / 0.5, 0, 1);
        px = 258 + (1 - k) * 130; py = 182 - k * 32;
        pose.walk = (dt * 3) % 1;
      } else if (phase === 'exit') {
        const k = clamp(dt / 0.45, 0, 1);
        px = 258 + k * 130; py = 150 + k * 32;
        pose.walk = (dt * 3) % 1; pose.dir = 1; pose.happy = true;
      } else if (phase === 'wrong') {
        px += Math.sin(dt * 34) * 5 * (1 - clamp(dt / 0.6, 0, 1));
        pose.blink = true;
      } else if (phase === 'happy') {
        py -= Math.abs(Math.sin(dt * 8)) * 8;
        pose.happy = true; pose.armsUp = true;
      } else {
        pose.sit = true;
      }
      host.drawHamster(ctx, px, py, 1.1, p.look, pose);
      if (phase === 'happy') {
        const k = clamp(dt / 1.2, 0, 1);
        ctx.globalAlpha = 1 - k * k;
        heart(ctx, 258 + Math.sin(dt * 5) * 8, 50 - k * 34, 9 + k * 4, '#ff6b9d');
        heart(ctx, 290, 70 - k * 26, 5, '#ffa8c5');
        ctx.globalAlpha = 1;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    startPatient();

    return {
      stop() {
        stopped = true;
        cancelAnimationFrame(raf);
        timers.forEach(clearTimeout); timers.clear();
        ro.disconnect();
        wrap.remove();
      },
    };
  },
};
