// Мини-игра «Парикмахер» (этап 17в) — работа в салоне красоты для всех (у хозяйки салона есть ещё «Стилист»).
// Приходят жители города и показывают картинку: какую причёску, какого цвета и (с уровня 1) какой бантик они хотят.
// Выбираешь на полках — в зеркале сразу видно, что получается; «Готово!» — гость смотрится в зеркало. Не так —
// добрая подсказка (сначала «сравни …», потом прямо, что на картинке), можно поправить. Без таймера.
// Звёзды — по числу подсказок за всю смену. Dev-хуки на канве: __hair() — что сейчас, __hairSolve() — сделать как надо.
import { el, shuffle, clamp, pick } from '../core/util.js';
import { makeCanvas, fillRR, heart, ell, star } from '../core/draw.js';
import { drawPortrait } from '../art/hamster.js';
import { BEAUTY, defaultLook } from '../data/index.js';

export const CLIENTS = 5;
const TUFTS = BEAUTY.tuft.options.filter((o) => o.v); // без «гладкой»: стрижём всегда что-то
const HAIRS = BEAUTY.hair.options.filter((o) => o.v); // цветные: «свой» цвет у каждой гостьи свой — на полке непонятен
const BOWS = BEAUTY.bow.options.filter((o) => o.v !== '#f03e3e');
const SHELVES = [
  { key: 'tuft', label: '✂️ Причёска', list: TUFTS, from: 0 },
  { key: 'hair', label: '🎨 Цвет', list: HAIRS, from: 0 },
  { key: 'bow', label: '🎀 Бантик', list: BOWS, from: 1 },
];
const nameOf = (key, v) => {
  const o = BEAUTY[key].options.find((q) => q.v === v);
  return o ? o.name.toLowerCase() : '';
};
const WHAT = { tuft: 'причёску', hair: 'цвет', bow: 'бантик' };

const CSS = `
.hd{position:absolute;inset:0;display:flex;flex-direction:column;overflow:hidden;background:linear-gradient(#ffe3ec,#fff0f6);--cv:300px}
.hd-top{flex:none;display:flex;align-items:center;gap:8px;padding:8px 12px 6px}
.hd-count,.hd-miss{font-weight:900;background:rgba(255,255,255,.9);border-radius:12px;padding:4px 10px;font-size:15px;white-space:nowrap;box-shadow:0 2px 0 rgba(74,55,40,.15)}
.hd-miss{margin-left:auto}
.hd-main{flex:1;min-height:0;display:flex;flex-direction:column;gap:6px;padding:0 12px calc(10px + env(safe-area-inset-bottom))}
.hd.wide .hd-main{flex-direction:row;gap:14px;align-items:stretch}
.hd-left{flex:1 1 0;min-height:0;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px}
.hd-stage{position:relative;flex:none}
.hd-cv{display:block;width:var(--cv);height:auto;border-radius:20px;box-shadow:0 4px 0 rgba(74,55,40,.15)}
.hd-pic{position:absolute;right:-6px;top:-6px;background:#fff;border-radius:14px;padding:4px 4px 2px;box-shadow:0 3px 0 rgba(74,55,40,.18);transform:rotate(4deg);text-align:center;font-size:11px;font-weight:900;color:#d9487a}
.hd-pic canvas{display:block;width:calc(var(--cv) * .3);height:auto;border-radius:10px;background:#fff9db}
.hd-say{width:100%;max-width:440px;background:#fff;border-radius:16px;padding:6px 12px;font-weight:800;font-size:15px;line-height:1.25;text-align:center;box-shadow:0 3px 0 rgba(74,55,40,.12);min-height:2.6em;display:flex;align-items:center;justify-content:center}
.hd-say b{color:#d9487a}
.hd-right{flex:none;display:flex;flex-direction:column;justify-content:center;gap:6px}
.hd.wide .hd-right{flex:1 1 0}
.hd-shelf .lb{font-size:13px;font-weight:900;opacity:.75;margin:0 0 3px 2px}
.hd-row{display:flex;flex-wrap:wrap;gap:6px}
.hd-b{border:0;border-radius:14px;background:#fff;box-shadow:0 3px 0 #f3c4d4;min-width:46px;height:46px;padding:2px 6px;display:flex;align-items:center;justify-content:center;
  font-weight:800;font-size:12px;color:var(--ink);touch-action:manipulation;transition:transform .06s,box-shadow .06s}
.hd-b:active{transform:translateY(2px);box-shadow:0 1px 0 #f3c4d4}
.hd-b.on{background:#ffdeeb;box-shadow:0 0 0 3px #e64980,0 3px 0 #c2255c}
.hd-b .dot{width:26px;height:26px;border-radius:50%;border:2px solid rgba(74,55,40,.5);display:block}
.hd-b .dot.none{background:repeating-linear-gradient(45deg,#fff 0 4px,#eee 4px 8px)!important}
.hd-b canvas{display:block;width:40px;height:40px}
.hd-done{margin-top:4px}
.hd-done[disabled]{opacity:.5}
.hd.short .hd-b{height:38px;min-width:38px}
.hd.short .hd-b canvas{width:32px;height:32px}
.hd.short .hd-b .dot{width:20px;height:20px}
.hd.short .hd-say{font-size:13px;min-height:2.2em;padding:4px 10px}
.hd.short .hd-top{padding:5px 12px 3px}
`;

const CW = 300,
  CH = 210;

export default {
  id: 'hairdresser',
  title: 'Парикмахер',
  icon: '✂️',
  howTo:
    'В салон приходят жители и показывают <b>картинку</b> — какую причёску они хотят. Выбери на полках причёску, цвет и бантик: в зеркале сразу видно, что получается. Нажми <b>«Готово!»</b>. Если что-то не так — подскажу, и можно поправить. Торопиться некуда!',

  start(host) {
    const root = host.root;
    const level = host.level || 0;
    const shelves = SHELVES.filter((s) => level >= s.from);
    const { later } = host;
    const fallback = [{ id: 'me', name: 'Гостья', look: host.look }];
    const clients = shuffle(host.friends && host.friends.length ? host.friends : fallback);
    // мастер — хомячок игрока без шляпы (её не видно за креслом, зато видно причёску)
    const me = { ...host.look, outfit: { ...(host.look.outfit || {}), head: null } };

    const wrap = el('div', 'hd');
    host.css(CSS);
    wrap.innerHTML = `
      <div class="hd-top"><div class="hd-count"></div><div class="hd-miss"></div></div>
      <div class="hd-main">
        <div class="hd-left"><div class="hd-stage"><div class="hd-pic">📋 Как на картинке</div></div><div class="hd-say"></div></div>
        <div class="hd-right"></div>
      </div>`;
    host.add(wrap);
    const $ = (s) => wrap.querySelector(s);
    const cv = makeCanvas(CW, CH);
    cv.canvas.className = 'hd-cv';
    cv.canvas.style.width = '';
    cv.canvas.style.height = '';
    $('.hd-stage').prepend(cv.canvas);
    const ctx = cv.ctx;
    const pic = makeCanvas(110, 110);
    pic.canvas.style.width = '';
    pic.canvas.style.height = '';
    $('.hd-pic').appendChild(pic.canvas);
    const say = $('.hd-say'),
      right = $('.hd-right');

    // --- состояние
    let idx = 0,
      hints = 0,
      tries = 0, // сколько раз гостья уже говорила «не так» (первая подсказка — мягкая, вторая — прямая)
      now = 0,
      phase = 'enter', // enter | wait | look | happy | exit
      phaseAt = 0,
      snip = -9; // когда щёлкнули ножницы (для искорок)
    let want = {},
      cur = {};
    const setPhase = (p) => {
      phase = p;
      phaseAt = now;
    };
    const client = () => clients[idx % clients.length];
    /** Внешность гостьи с причёской b: без шляпы, остальное — как у неё. */
    const styled = (b) => {
      const c = client().look;
      return { ...c, outfit: { ...c.outfit, head: null }, beauty: { ...c.beauty, ...b } };
    };
    const updTop = () => {
      $('.hd-count').textContent = `Гость ${Math.min(idx + 1, CLIENTS)} из ${CLIENTS}`;
      $('.hd-miss').textContent = hints ? `Подсказок: ${hints}` : 'Без подсказок 💚';
    };

    // --- полки
    const btns = {};
    const iconOf = (key, o) => {
      if (key === 'tuft') {
        const { canvas, ctx: c } = makeCanvas(40, 40);
        canvas.style.width = '';
        canvas.style.height = '';
        const base = defaultLook();
        drawPortrait(c, 20, 22, 40, { ...base, spots: null, outfit: {}, beauty: { ...base.beauty, tuft: o.v, hair: '#a8703f' } });
        return canvas;
      }
      const s = document.createElement('span');
      s.className = 'dot' + (o.v === null ? ' none' : '');
      s.style.background = o.c;
      return s;
    };
    function buildShelves() {
      right.innerHTML = '';
      for (const sh of shelves) {
        const box = el('div', 'hd-shelf', `<div class="lb">${sh.label}</div>`);
        const row = el('div', 'hd-row');
        btns[sh.key] = [];
        for (const o of sh.list) {
          const b = el('button', 'hd-b');
          b.title = o.name;
          b.appendChild(iconOf(sh.key, o));
          b.onclick = () => choose(sh.key, o.v);
          b.dataset.v = String(o.v);
          btns[sh.key].push({ b, v: o.v });
          row.appendChild(b);
        }
        box.appendChild(row);
        right.appendChild(box);
      }
      const done = el('button', 'btn big green hd-done', '✨ Готово!');
      done.onclick = () => ready();
      right.appendChild(done);
    }
    const markOn = () => {
      for (const k of Object.keys(btns)) for (const q of btns[k]) q.b.classList.toggle('on', cur[k] === q.v);
    };
    const lock = (v) => right.querySelectorAll('button').forEach((b) => (b.disabled = v));

    function startClient() {
      const c = client();
      updTop();
      tries = 0;
      // что хочет: не то, что у неё уже есть
      const own = c.look.beauty || {};
      want = {};
      cur = {};
      for (const sh of shelves) {
        const list = sh.list.filter((o) => o.v !== (own[sh.key] === undefined ? null : own[sh.key]));
        want[sh.key] = pick(list.length ? list : sh.list).v;
        cur[sh.key] = sh.key === 'tuft' ? own.tuft || 0 : own[sh.key] === undefined ? null : own[sh.key];
      }
      if (!buildShelves.done) {
        buildShelves();
        buildShelves.done = true;
      }
      markOn();
      lock(true);
      drawPic();
      say.innerHTML = '';
      setPhase('enter');
      later(() => {
        say.innerHTML = `<span><b>${c.name}:</b> ${pick(['«Сделай мне, пожалуйста, вот так!»', '«Хочу как на картинке!»', '«Вот такую причёску можно?»'])}</span>`;
        setPhase('wait');
        lock(false);
        host.sfx('pop');
      }, 700);
    }

    function choose(key, v) {
      if (phase !== 'wait') return;
      cur[key] = v;
      snip = now;
      markOn();
      host.sfx(key === 'tuft' ? 'tap' : 'pop');
    }

    function ready() {
      if (phase !== 'wait') return;
      const wrong = shelves.map((s) => s.key).filter((k) => cur[k] !== want[k]);
      const c = client();
      if (!wrong.length) {
        lock(true);
        host.sfx('ok');
        say.innerHTML = `<span><b>${c.name}:</b> ${pick(['«Ой, как красиво! Точь-в-точь! Спасибо!»', '«Ура! Я самая красивая в городе!»', '«Как на картинке! Ты настоящий мастер!»'])}</span>`;
        setPhase('happy');
        later(() => {
          setPhase('exit');
          later(() => {
            idx++;
            if (idx >= CLIENTS) return finish();
            startClient();
          }, 600);
        }, 1600);
        return;
      }
      // не так: добрая подсказка, без наказания (только звёзды чуть меньше)
      hints++;
      tries++;
      updTop();
      host.sfx('bad');
      setPhase('look');
      const k = wrong[0];
      const text =
        tries < 2
          ? `Почти получилось! Сравни ${WHAT[k]} с картинкой 💡`
          : k === 'bow' && want.bow === null
            ? 'Подсказка: на картинке <b>без бантика</b> 💡'
            : `Подсказка: на картинке ${k === 'tuft' ? 'причёска' : k === 'hair' ? 'цвет' : 'бантик'} — <b>${nameOf(k, want[k])}</b> 💡`;
      say.innerHTML = `<span>${text}</span>`;
      later(() => {
        if (phase === 'look') setPhase('wait');
      }, 700);
    }

    function finish() {
      const stars = hints <= 1 ? 3 : hints <= 4 ? 2 : 1;
      const text = hints
        ? `Все ${CLIENTS} гостей ушли с новыми причёсками! Подсказок: ${hints}.`
        : 'Все причёски — как на картинках, и без единой подсказки! Ты настоящий мастер!';
      host.finish({ stars, text, extra: { hints } });
    }

    // --- подгонка размеров
    const fit = () => {
      const r = root.getBoundingClientRect();
      const wide = r.width > r.height * 1.2;
      const short = r.height < 430;
      wrap.classList.toggle('wide', wide);
      wrap.classList.toggle('short', short);
      const rows = shelves.length;
      let w;
      if (wide) w = Math.min(r.width * 0.52 - 30, (r.height - (short ? 120 : 150)) * (CW / CH));
      else w = Math.min(r.width - 24, (r.height - 150 - rows * (short ? 58 : 70) - 56) * (CW / CH));
      wrap.style.setProperty('--cv', clamp(w, 150, 480) + 'px');
    };
    fit();
    host.onResize(fit);

    // --- рисунки
    function drawPic() {
      const c = pic.ctx;
      c.clearRect(0, 0, 110, 110);
      c.fillStyle = '#fff9db';
      c.fillRect(0, 0, 110, 110);
      drawPortrait(c, 55, 58, 104, styled(want), { time: 0 });
    }
    function drawRoom() {
      ctx.fillStyle = '#ffe3ec';
      ctx.fillRect(0, 0, CW, CH);
      // обои в полоску
      ctx.fillStyle = '#ffd6e5';
      for (let x = 0; x < CW; x += 30) ctx.fillRect(x, 0, 14, 160);
      // пол — шахматка
      for (let x = 0; x < CW; x += 25)
        for (let y = 160; y < CH; y += 25) {
          ctx.fillStyle = ((x + y) / 25) % 2 ? '#fff' : '#f3d9fa';
          ctx.fillRect(x, y, 25, 25);
        }
      // зеркало
      ell(ctx, 160, 72, 58, 62, '#f8f0fc', '#c2255c', 5);
      ell(ctx, 160, 72, 50, 54, '#e7f5ff', null);
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      ctx.beginPath();
      ctx.ellipse(140, 48, 8, 20, -0.4, 0, Math.PI * 2);
      ctx.fill();
      // полочка с флаконами
      fillRR(ctx, 236, 92, 56, 8, 3, '#d9a37a', '#4a3728', 2);
      fillRR(ctx, 242, 70, 12, 22, 4, '#ff8fab', '#4a3728', 1.5);
      fillRR(ctx, 258, 76, 10, 16, 4, '#74c0fc', '#4a3728', 1.5);
      fillRR(ctx, 272, 66, 12, 26, 4, '#ffd43b', '#4a3728', 1.5);
      // кресло
      fillRR(ctx, 124, 118, 72, 54, 14, '#e64980', '#4a3728', 2.5);
      fillRR(ctx, 118, 150, 84, 18, 8, '#f06595', '#4a3728', 2.5);
      ctx.fillStyle = '#868e96';
      ctx.fillRect(155, 168, 10, 22);
      fillRR(ctx, 134, 186, 52, 8, 4, '#adb5bd', '#4a3728', 2);
    }

    host.loop((_, time) => {
      now = time; // время игры: на скрытой вкладке стоит вместе с таймерами
      const dt = now - phaseAt;
      const blink = now % 3.1 < 0.13;
      ctx.clearRect(0, 0, CW, CH);
      drawRoom();
      // гостья в кресле (входит справа, уходит вправо)
      let gx = 160,
        gy = 160;
      const pose = { time: now, blink, sit: true };
      if (phase === 'enter') {
        const k = clamp(dt / 0.6, 0, 1);
        gx = 160 + (1 - k) * 170;
        pose.sit = false;
        pose.walk = (dt * 3) % 1;
        pose.dir = -1;
      } else if (phase === 'exit') {
        const k = clamp(dt / 0.55, 0, 1);
        gx = 160 + k * 170;
        pose.sit = false;
        pose.walk = (dt * 3) % 1;
        pose.dir = 1;
        pose.happy = true;
      } else if (phase === 'happy') {
        gy -= Math.abs(Math.sin(dt * 7)) * 6;
        pose.happy = true;
        pose.armsUp = dt > 0.3;
      } else if (phase === 'look') {
        gx += Math.sin(dt * 26) * 3 * (1 - clamp(dt / 0.7, 0, 1));
      }
      host.drawHamster(ctx, gx, gy, 1.05, styled(phase === 'enter' ? {} : cur), pose);
      // мастер слева: с расчёской, щёлкает ножницами
      const cut = now - snip < 0.5;
      host.drawHamster(ctx, 62, 192, 1.1, me, { time: now, blink, dir: 1, talk: phase === 'look', happy: phase === 'happy', armsUp: cut });
      if (cut) {
        const k = (now - snip) / 0.5;
        ctx.globalAlpha = 1 - k;
        for (let i = 0; i < 5; i++) {
          const a = i * 1.3 + now * 3;
          star(ctx, gx + Math.cos(a) * (20 + k * 26), gy - 70 + Math.sin(a) * (14 + k * 18), 4 + (i % 2) * 2, '#ffd43b', null);
        }
        ctx.globalAlpha = 1;
        ctx.font = '22px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('✂️', 100 + Math.sin(now * 30) * 2, 92);
      }
      if (phase === 'happy') {
        const k = clamp(dt / 1.5, 0, 1);
        ctx.globalAlpha = 1 - k * k;
        heart(ctx, gx + 30 + Math.sin(dt * 5) * 6, 70 - k * 40, 9 + k * 4, '#ff6b9d');
        heart(ctx, gx - 34, 86 - k * 30, 6, '#ffa8c5');
        ctx.globalAlpha = 1;
      }
    });

    // dev-хуки для автотеста
    cv.canvas.__hair = () => ({ i: idx, total: CLIENTS, phase, want: { ...want }, cur: { ...cur }, hints, shelves: shelves.map((s) => s.key) });
    cv.canvas.__hairSolve = (wrongFirst) => {
      if (phase !== 'wait') return false;
      if (wrongFirst) {
        const k = shelves[0].key,
          other = shelves[0].list.find((o) => o.v !== want[k]);
        cur[k] = other.v;
      } else Object.assign(cur, want);
      markOn();
      ready();
      return true;
    };

    startClient();

  },
};
