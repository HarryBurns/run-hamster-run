// Мини-игра «Шеф-повар»: запомни заказ и собери блюдо в нужном порядке.
import { el, makeCanvas, shuffle, pick, fillRR, ell, clamp } from '../util.js';

const ORDERS = 5;

const ING = {
  bun: { e: '🍞', name: 'Булочка' },
  salad: { e: '🥬', name: 'Салат' },
  cheese: { e: '🧀', name: 'Сыр' },
  carrot: { e: '🥕', name: 'Морковка' },
  tomato: { e: '🍅', name: 'Помидор' },
  cucumber: { e: '🥒', name: 'Огурец' },
  corn: { e: '🌽', name: 'Кукуруза' },
  mushroom: { e: '🍄', name: 'Грибы' },
  greens: { e: '🌿', name: 'Зелень' },
  potato: { e: '🥔', name: 'Картошка' },
  pancake: { e: '🥞', name: 'Блинчик' },
  honey: { e: '🍯', name: 'Мёд' },
  banana: { e: '🍌', name: 'Банан' },
  strawberry: { e: '🍓', name: 'Клубника' },
  nuts: { e: '🥜', name: 'Орешки' },
  icecream: { e: '🍦', name: 'Пломбир' },
  choco: { e: '🍫', name: 'Шоколад' },
  cherry: { e: '🍒', name: 'Вишенка' },
  milk: { e: '🥛', name: 'Молоко' },
  egg: { e: '🥚', name: 'Яйцо' },
};

// seq — полный рецепт; для коротких заказов берётся начало. close — последним всегда идёт первый ингредиент (вторая булочка).
const DISHES = [
  { e: '🍔', name: 'Бургер', acc: 'бургер', seq: ['bun', 'carrot', 'cheese', 'salad', 'tomato'], close: true },
  { e: '🍕', name: 'Пицца', acc: 'пиццу', seq: ['pancake', 'tomato', 'cheese', 'mushroom', 'greens', 'corn'] },
  {
    e: '🍨',
    name: 'Мороженое',
    acc: 'мороженое',
    seq: ['icecream', 'strawberry', 'choco', 'cherry', 'nuts', 'banana'],
  },
  { e: '🥗', name: 'Салат', acc: 'салат', seq: ['salad', 'tomato', 'cucumber', 'cheese', 'corn', 'greens'] },
  { e: '🥞', name: 'Блинчики', acc: 'блинчики', seq: ['pancake', 'honey', 'banana', 'strawberry', 'nuts', 'choco'] },
  { e: '🥤', name: 'Коктейль', acc: 'коктейль', seq: ['milk', 'banana', 'strawberry', 'honey', 'icecream', 'cherry'] },
  { e: '🍲', name: 'Суп', acc: 'суп', seq: ['carrot', 'potato', 'corn', 'mushroom', 'greens', 'tomato'] },
  { e: '🎂', name: 'Торт', acc: 'торт', seq: ['egg', 'milk', 'choco', 'nuts', 'cherry', 'strawberry'] },
];

const CSS = `
.chf{position:absolute;inset:0;display:flex;flex-direction:column;overflow:hidden;
  background:linear-gradient(#fff4e0 0,#fff4e0 58%,#f4c98b 58%,#eab676 100%);--u:1}
.chf-top{flex:none;display:flex;align-items:center;gap:8px;padding:8px 12px 6px}
.chf-count{font-weight:900;background:rgba(255,255,255,.9);border-radius:12px;padding:4px 10px;font-size:15px;white-space:nowrap;
  box-shadow:0 2px 0 rgba(74,55,40,.15)}
.chf-marks{display:flex;gap:4px}
.chf-mark{width:24px;height:24px;border-radius:50%;background:#fff;border:2px solid #e0cfae;font-size:14px;line-height:1;display:grid;place-items:center}
.chf-mark.cur{border-color:#ff6b9d;box-shadow:0 0 0 2px #ffd0de}
.chf-main{flex:1;min-height:0;display:flex;flex-direction:column;gap:6px;padding:0 12px calc(12px + env(safe-area-inset-bottom))}
.chf.wide .chf-main{flex-direction:row;gap:14px}
.chf-left{flex:1 1 0;min-height:0;min-width:0;display:flex;flex-direction:column;gap:6px;justify-content:space-evenly}
.chf-right{flex:none;display:flex;flex-direction:column;gap:6px;justify-content:center}
.chf.wide .chf-right{flex:1 1 0;min-width:0}
.chf-guestrow{display:flex;align-items:flex-end;gap:8px;justify-content:center}
.chf-cv{flex:none;height:auto;display:block}
.chf-guest{width:calc(120px*var(--u))}
.chf-me{width:calc(110px*var(--u))}
.chf-order{position:relative;flex:0 1 330px;min-width:0;background:#fff;border:4px solid #4a3728;border-radius:16px;padding:6px 8px 10px;text-align:center;
  box-shadow:0 4px 0 rgba(74,55,40,.2)}
.chf-order .ttl{font-size:calc(15px*var(--u));font-weight:900;line-height:1.2;margin-bottom:5px}
.chf-order .ttl small{display:block;font-size:.8em;color:#d9487a}
.chf-seq{display:flex;justify-content:center;gap:calc(5px*var(--u))}
.chf-ing{position:relative;width:calc(42px*var(--u));height:calc(42px*var(--u));border-radius:12px;background:#fff9db;border:2px solid #ffe066;
  display:grid;place-items:center;font-size:calc(26px*var(--u));line-height:1;flex:0 1 auto;min-width:0}
.chf-ing .n{position:absolute;left:-5px;top:-7px;background:#4a3728;color:#fff;font-size:11px;font-weight:900;border-radius:8px;padding:1px 5px;line-height:1.2}
.chf-ing.hid{background:#f1f3f5;border-color:#dee2e6;color:#adb5bd;font-weight:900}
.chf-ing.done{background:#d3f9d8;border-color:#69db7c}
.chf-timer{position:absolute;left:8px;right:8px;bottom:3px;height:4px;border-radius:2px;background:#ffe3ec;overflow:hidden}
.chf-timer i{display:block;height:100%;background:#ff6b9d;width:100%}
.chf-platerow{display:flex;align-items:flex-end;justify-content:center;gap:10px}
.chf-platebox{display:flex;flex-direction:column;align-items:center}
.chf-stack{display:flex;flex-direction:column-reverse;align-items:center;min-height:calc(40px*var(--u));justify-content:flex-start}
.chf-stack span{font-size:calc(38px*var(--u));line-height:1;margin-top:calc(-17px*var(--u));animation:chf-drop .22s cubic-bezier(.3,1.5,.5,1);filter:drop-shadow(0 2px 0 rgba(74,55,40,.2))}
.chf-stack span:last-child{margin-top:0}
@keyframes chf-drop{from{transform:translateY(-40px) scale(1.3);opacity:0}to{transform:none;opacity:1}}
.chf-plate{width:calc(130px*var(--u));height:calc(18px*var(--u));background:#fff;border:3px solid #4a3728;border-radius:50%;margin-top:-6px;
  box-shadow:0 4px 0 rgba(74,55,40,.2)}
.chf-msg{text-align:center;font-size:17px;font-weight:900;min-height:1.3em;line-height:1.2}
.chf-msg.bad{color:#e03131}.chf-msg.good{color:#2f9e44}
.chf-skip{align-self:center}
.chf-shelf{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;background:#b9834f;border-radius:18px;padding:8px;box-shadow:0 4px 0 #8d5a2b}
.chf-b{border:0;border-radius:14px;background:#fff;box-shadow:0 3px 0 #e0cfae;padding:6px 2px 5px;display:flex;flex-direction:column;align-items:center;gap:1px;
  font-weight:800;font-size:11.5px;line-height:1.1;color:var(--ink);min-width:0;touch-action:manipulation;transition:transform .06s,opacity .2s}
.chf-b .em{font-size:32px;line-height:1.1}
.chf-b:active{transform:translateY(2px)}
.chf-b[disabled]{opacity:.55;pointer-events:none;color:var(--ink)}
.chf-b.shake{animation:chf-shake .3s}
@keyframes chf-shake{25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
.chf.short .chf-b .em{font-size:26px}
.chf.short .chf-b{padding:4px 2px 3px;font-size:10.5px}
.chf.short .chf-top{padding:5px 12px 3px}
.chf.short .chf-msg{font-size:15px}
`;

export default {
  id: 'chef',
  title: 'Шеф-повар',
  icon: '👩‍🍳',
  howTo:
    'Гость делает заказ. <b>Запомни</b>, какие продукты и в каком порядке нужны, — табличка скоро спрячется! Потом собери блюдо, нажимая продукты на полке по порядку.',

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
      return id;
    };
    const cancel = (id) => {
      clearTimeout(id);
      timers.delete(id);
    };

    const fallback = [{ id: 'me', name: 'Гость', look: host.look }];
    const guests = shuffle(host.friends && host.friends.length ? host.friends : fallback);
    const dishes = shuffle(DISHES).slice(0, ORDERS);
    const chefLook = { ...host.look, outfit: { ...(host.look.outfit || {}), head: null } };

    const wrap = el('div', 'chf');
    wrap.innerHTML = `<style>${CSS}</style>
      <div class="chf-top"><div class="chf-count"></div><div class="chf-marks"></div></div>
      <div class="chf-main">
        <div class="chf-left">
          <div class="chf-guestrow">
            <div class="chf-order"><div class="ttl"></div><div class="chf-seq"></div><div class="chf-timer"><i></i></div></div>
          </div>
          <div class="chf-platerow">
            <div class="chf-platebox"><div class="chf-stack"></div><div class="chf-plate"></div></div>
          </div>
        </div>
        <div class="chf-right">
          <div class="chf-msg"></div>
          <button class="btn small yellow chf-skip">Запомнила! ▶</button>
          <div class="chf-shelf"></div>
        </div>
      </div>`;
    root.appendChild(wrap);
    const $ = (s) => wrap.querySelector(s);
    const countEl = $('.chf-count'),
      marksEl = $('.chf-marks');
    const ttlEl = $('.chf-order .ttl'),
      seqEl = $('.chf-seq'),
      timerBar = $('.chf-timer i'),
      timerEl = $('.chf-timer');
    const stackEl = $('.chf-stack'),
      msgEl = $('.chf-msg'),
      skipBtn = $('.chf-skip'),
      shelfEl = $('.chf-shelf');

    const gcv = makeCanvas(130, 130);
    gcv.canvas.className = 'chf-cv chf-guest';
    gcv.canvas.style.width = '';
    gcv.canvas.style.height = '';
    $('.chf-guestrow').prepend(gcv.canvas);
    const mcv = makeCanvas(120, 140);
    mcv.canvas.className = 'chf-cv chf-me';
    mcv.canvas.style.width = '';
    mcv.canvas.style.height = '';
    $('.chf-platerow').prepend(mcv.canvas);

    const marks = [];
    for (let i = 0; i < ORDERS; i++) {
      const m = el('div', 'chf-mark');
      marksEl.appendChild(m);
      marks.push(m);
    }

    // --- состояние
    let idx = 0,
      perfect = 0,
      now = 0;
    let seq = [],
      pos = 0,
      hinted = false;
    let phase = 'show'; // show | build | peek | yum
    let enterAt = 0,
      hideTimer = 0,
      yumAt = 0;

    const setMsg = (t, cls = '') => {
      msgEl.textContent = t;
      msgEl.className = 'chf-msg ' + cls;
    };
    const lockShelf = (v) =>
      shelfEl.querySelectorAll('.chf-b').forEach((b) => {
        b.disabled = v;
      });

    function orderLen(i) {
      return clamp(3 + level + (i >= 3 ? 1 : 0), 3, 6);
    }
    function makeSeq(d, n) {
      if (d.close) return [...d.seq.slice(0, n - 1), d.seq[0]];
      return d.seq.slice(0, n);
    }

    function renderSeq(visible) {
      seqEl.innerHTML = '';
      seq.forEach((k, i) => {
        const done = i < pos;
        const c = el(
          'div',
          'chf-ing' + (done ? ' done' : visible ? '' : ' hid'),
          (visible || done ? ING[k].e : '?') + `<span class="n">${i + 1}</span>`,
        );
        if (visible) c.dataset.k = k;
        seqEl.appendChild(c);
      });
    }
    function runTimer(ms) {
      timerEl.style.visibility = 'visible';
      timerBar.style.transition = 'none';
      timerBar.style.width = '100%';
      void timerBar.offsetWidth;
      timerBar.style.transition = `width ${ms}ms linear`;
      timerBar.style.width = '0%';
    }

    function startOrder() {
      const d = dishes[idx],
        g = guests[idx % guests.length];
      seq = makeSeq(d, orderLen(idx));
      pos = 0;
      hinted = false;
      phase = 'show';
      enterAt = now;
      countEl.textContent = `Заказ ${idx + 1} из ${ORDERS}`;
      marks.forEach((m, i) => m.classList.toggle('cur', i === idx));
      ttlEl.innerHTML = `<small>${g.name} просит:</small>${d.e} «Мне, пожалуйста, ${d.acc}!»`;
      stackEl.innerHTML = '';
      // полка: нужные продукты + случайные до 8
      const need = [...new Set(seq)];
      const extra = shuffle(Object.keys(ING).filter((k) => !need.includes(k))).slice(0, 8 - need.length);
      shelfEl.innerHTML = '';
      for (const k of shuffle([...need, ...extra])) {
        const b = el('button', 'chf-b', `<span class="em">${ING[k].e}</span><span>${ING[k].name}</span>`);
        b.dataset.k = k;
        b.onclick = () => tap(k, b);
        shelfEl.appendChild(b);
      }
      lockShelf(true);
      renderSeq(true);
      setMsg('👀 Запомни заказ!');
      skipBtn.style.visibility = 'visible';
      const ms = 2200 + seq.length * 450;
      runTimer(ms);
      host.sfx('pop');
      hideTimer = later(beginBuild, ms);
    }

    function beginBuild() {
      if (phase !== 'show' && phase !== 'peek') return;
      cancel(hideTimer);
      phase = 'build';
      timerEl.style.visibility = 'hidden';
      skipBtn.style.visibility = 'hidden';
      renderSeq(false);
      lockShelf(false);
      setMsg(pos === 0 ? 'Собери блюдо по порядку!' : `Продолжай! Нужен продукт № ${pos + 1}`);
    }

    function tap(k, btn) {
      if (phase !== 'build' || stopped) return;
      if (k === seq[pos]) {
        pos++;
        host.sfx('pop');
        const s = el('span', '', ING[k].e);
        stackEl.appendChild(s);
        renderSeq(false);
        if (pos >= seq.length) return orderDone();
        setMsg(pick(['Так держать!', 'Верно!', 'Отлично!', 'Дальше!']), 'good');
      } else {
        hinted = true;
        host.sfx('bad');
        btn.classList.remove('shake');
        void btn.offsetWidth;
        btn.classList.add('shake');
        phase = 'peek';
        lockShelf(true);
        renderSeq(true);
        setMsg('Ой, не то! Посмотри ещё раз', 'bad');
        runTimer(2000);
        hideTimer = later(beginBuild, 2000);
      }
    }

    function orderDone() {
      phase = 'yum';
      yumAt = now;
      lockShelf(true);
      renderSeq(true);
      if (!hinted) perfect++;
      marks[idx].classList.remove('cur');
      marks[idx].textContent = hinted ? '👌' : '⭐';
      host.sfx('ok');
      setMsg(hinted ? 'Готово! Гость доволен 😋' : 'Идеально! Ням-ням! 😋', 'good');
      later(() => {
        idx++;
        if (idx >= ORDERS) {
          const stars = perfect >= 4 ? 3 : perfect >= 2 ? 2 : 1;
          host.finish({
            stars,
            text:
              perfect === ORDERS
                ? 'Все заказы собраны по памяти! Ты лучший шеф-повар города!'
                : `Все ${ORDERS} заказов готовы! Без подсказок: ${perfect}.`,
            extra: { perfect },
          });
          return;
        }
        startOrder();
      }, 1500);
    }

    skipBtn.onclick = () => {
      if (phase === 'show') {
        host.sfx('tap');
        beginBuild();
      }
    };

    // --- подгонка размеров
    const fit = () => {
      const r = root.getBoundingClientRect();
      const wide = r.width > r.height * 1.25;
      const short = r.height < 420;
      wrap.classList.toggle('wide', wide);
      wrap.classList.toggle('short', short);
      const u = wide
        ? clamp(Math.min((r.height - 40) / 330, r.width / 2 / 400), 0.6, 1.25)
        : clamp(Math.min(r.width / 400, (r.height - 290) / 400), 0.62, 1.3);
      wrap.style.setProperty('--u', u.toFixed(3));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(root);

    // --- хомячки
    function drawToque(ctx, x, y, s) {
      fillRR(ctx, x - 17 * s, y - 86 * s, 34 * s, 16 * s, 3 * s, '#fff', '#4a3728', 2);
      for (const dx of [-13, 0, 13]) ell(ctx, x + dx * s, y - 92 * s, 10 * s, 10 * s, '#fff', '#4a3728', 2);
      ell(ctx, x, y - 90 * s, 14 * s, 7 * s, '#fff');
    }
    const t0 = performance.now();
    const frame = (ts) => {
      if (stopped) return;
      now = (ts - t0) / 1000;
      const blink = now % 3.3 < 0.13;
      const yum = phase === 'yum';
      // гость
      const g = guests[idx % guests.length];
      const c1 = gcv.ctx;
      c1.clearRect(0, 0, 130, 130);
      const k = clamp((now - enterAt) / 0.4, 0, 1);
      const slide = -(1 - k) * (1 - k) * 130;
      const hop = yum ? Math.abs(Math.sin((now - yumAt) * 9)) * 6 : 0;
      host.drawHamster(c1, 65 + slide, 124 - hop, 1.12, g.look, {
        time: now,
        blink,
        happy: yum,
        armsUp: yum,
        talk: phase === 'show',
        walk: k < 1 ? (now * 3) % 1 : null,
      });
      // шеф (игрок)
      const c2 = mcv.ctx;
      c2.clearRect(0, 0, 120, 140);
      const bob = Math.sin(now * 2.2) * 0.7 * 1.1;
      host.drawHamster(c2, 60, 134, 1.1, chefLook, { time: now, blink, happy: yum });
      drawToque(c2, 60, 134 - bob, 1.1);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    startOrder();

    return {
      stop() {
        stopped = true;
        cancelAnimationFrame(raf);
        timers.forEach(clearTimeout);
        timers.clear();
        ro.disconnect();
        wrap.remove();
      },
    };
  },
};
