// Общий ход мини-игр «собери по заказу»: «Бариста» (barista.js), «Стилист» (stylist.js), «Витрина» (window.js).
// Гость показывает, чего хочет, — игрок нажимает нужное на полках, пока у гостя не кончилось терпение.
// В отличие от «Шеф-повара», запоминать ничего не надо: заказ всё время на виду, важны внимание и скорость.
// Проиграть нельзя: ошиблась или гость заждался — заказ всё равно будет собран, просто без звёздочки.
//
// Игра-настройка зовёт orderGame(host, cfg). cfg:
//   bg            фон (CSS)
//   shelves       полки: [{ id, label, items: [{ k, name, e?: значок-эмодзи, icon?: () => элемент }] }]
//                 кнопки стоят на месте всю игру — ребёнок запоминает, где что лежит
//   order(i, level)   заказ № i: список ключей с полок (по одному с полки; можно два — как добавки у бариста)
//   picture       (необязательно) рисунок вместо значков: draw(ctx, w, h, keys, t, guest) рисует «как должно быть»
//                 (keys — весь заказ) и «что получается» (keys — уже выбранное). Тогда заказ читают по картинке.
//   ask           что говорит гость;  serve — подпись над полками;  noun — «заказ», «причёска», «витрина»
//   doneAll, doneSome(n)   итог: всё чисто / n чистых заказов
import { el, shuffle, pick, clamp } from '../core/util.js';
import { makeCanvas } from '../core/draw.js';

export const ORDERS = 6;

const CSS = `
.brs{position:absolute;inset:0;display:flex;flex-direction:column;overflow:hidden;--u:1}
.brs-top{flex:none;display:flex;align-items:center;gap:8px;padding:8px 12px 6px}
.brs-count{font-weight:900;background:rgba(255,255,255,.9);border-radius:12px;padding:4px 10px;font-size:15px;white-space:nowrap;
  box-shadow:0 2px 0 rgba(74,55,40,.15)}
.brs-marks{display:flex;gap:4px}
.brs-mark{width:24px;height:24px;border-radius:50%;background:#fff;border:2px solid #e0cfae;font-size:14px;line-height:1;display:grid;place-items:center}
.brs-mark.cur{border-color:#ff6b9d;box-shadow:0 0 0 2px #ffd0de}
.brs-main{flex:1;min-height:0;display:flex;flex-direction:column;gap:6px;padding:0 12px calc(12px + env(safe-area-inset-bottom))}
.brs.wide .brs-main{flex-direction:row;gap:14px}
.brs-left{flex:1 1 0;min-height:0;min-width:0;display:flex;flex-direction:column;gap:6px;justify-content:space-evenly}
.brs-right{flex:none;display:flex;flex-direction:column;gap:6px;justify-content:center}
.brs.wide .brs-right{flex:1 1 0;min-width:0}
.brs-guestrow{display:flex;align-items:flex-end;gap:8px;justify-content:center}
.brs-cv{flex:none;height:auto;display:block;width:calc(120px*var(--u))}
.brs-order{position:relative;flex:0 1 320px;min-width:0;background:#fff;border:4px solid #4a3728;border-radius:16px;padding:6px 8px 12px;text-align:center;
  box-shadow:0 4px 0 rgba(74,55,40,.2)}
.brs-order .ttl{font-size:calc(14px*var(--u));font-weight:900;line-height:1.2;margin-bottom:5px}
.brs-order .ttl small{display:block;font-size:.85em;color:#d9487a}
.brs-want{display:flex;justify-content:center;align-items:center;gap:calc(4px*var(--u));flex-wrap:wrap}
.brs-it{width:calc(44px*var(--u));height:calc(44px*var(--u));border-radius:12px;background:#fff9db;border:2px solid #ffe066;
  display:grid;place-items:center;font-size:calc(27px*var(--u));line-height:1;transition:background .15s,border-color .15s}
.brs-it.done{background:#d3f9d8;border-color:#69db7c}
.brs-plus{font-weight:900;color:#c9b79c;font-size:calc(16px*var(--u))}
.brs-pic{display:block;margin:0 auto;height:auto;width:calc(120px*var(--u));border-radius:14px;background:linear-gradient(#ffe3ec,#fff5d6)}
.brs-timer{position:absolute;left:8px;right:8px;bottom:4px;height:5px;border-radius:3px;background:#ffe3ec;overflow:hidden}
.brs-timer i{display:block;height:100%;background:#ff6b9d;width:100%}
.brs-trayrow{display:flex;align-items:flex-end;justify-content:center;gap:10px}
.brs-traybox{display:flex;flex-direction:column;align-items:center}
.brs-traybox .cap{font-size:calc(12px*var(--u));font-weight:900;opacity:.7;margin-bottom:2px}
.brs-tray{display:flex;align-items:flex-end;justify-content:center;gap:2px;min-height:calc(46px*var(--u));min-width:calc(150px*var(--u));padding:0 8px}
.brs-tray span{font-size:calc(38px*var(--u));line-height:1;animation:brs-drop .22s cubic-bezier(.3,1.5,.5,1);filter:drop-shadow(0 2px 0 rgba(74,55,40,.2))}
.brs-tray span.small{font-size:calc(24px*var(--u));margin-left:calc(-10px*var(--u));align-self:flex-start}
.brs-tray .brs-pic{background:#fff;border:3px solid #4a3728;box-shadow:0 4px 0 rgba(74,55,40,.2);width:calc(132px*var(--u))}
@keyframes brs-drop{from{transform:translateY(-36px) scale(1.3);opacity:0}to{transform:none;opacity:1}}
.brs-board{width:calc(180px*var(--u));height:calc(14px*var(--u));background:#c98b5a;border:3px solid #4a3728;border-radius:8px;box-shadow:0 4px 0 rgba(74,55,40,.2)}
.brs-msg{text-align:center;font-size:17px;font-weight:900;min-height:1.3em;line-height:1.2}
.brs-msg.bad{color:#e03131}.brs-msg.good{color:#2f9e44}
.brs-shelves{display:flex;flex-direction:column;gap:6px;background:#b9834f;border-radius:18px;padding:8px;box-shadow:0 4px 0 #8d5a2b}
.brs-shelf{display:grid;grid-template-columns:auto repeat(4,1fr);gap:6px;align-items:center}
.brs-shelf .lbl{writing-mode:vertical-rl;transform:rotate(180deg);font-size:10.5px;font-weight:900;color:#fff3d6;text-align:center;letter-spacing:.3px}
.brs-b{border:0;border-radius:14px;background:#fff;box-shadow:0 3px 0 #e0cfae;padding:5px 2px 4px;display:flex;flex-direction:column;align-items:center;gap:1px;
  font-weight:800;font-size:11.5px;line-height:1.1;color:var(--ink);min-width:0;min-height:44px;touch-action:manipulation;transition:transform .06s,opacity .2s}
.brs-b .em{font-size:30px;line-height:1.1;display:grid;place-items:center;min-height:34px}
.brs-b .em canvas{display:block;width:40px;height:40px}
.brs-b .em .dot{display:block;width:30px;height:30px;border-radius:50%;box-shadow:0 0 0 2px #4a3728 inset}
.brs-b:active{transform:translateY(2px)}
.brs-b[disabled]{opacity:.55;pointer-events:none;color:var(--ink)}
.brs-b.on{background:#d3f9d8;box-shadow:0 3px 0 #8ce99a}
.brs-b.shake{animation:brs-shake .3s}
.brs-b.hint{box-shadow:0 0 0 3px #69db7c,0 3px 0 #e0cfae}
@keyframes brs-shake{25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
.brs.short .brs-b .em{font-size:24px;min-height:32px}
.brs.short .brs-b .em canvas{width:32px;height:32px}
.brs.short .brs-b .em .dot{width:24px;height:24px}
.brs.short .brs-b{padding:3px 2px 2px;font-size:10.5px;min-height:40px}
.brs.short .brs-top{padding:5px 12px 3px}
.brs.short .brs-msg{font-size:15px}
`;

/** Запустить игру «собери по заказу» с настройкой cfg. Возвращает { stop() } — как start() любой мини-игры. */
export function orderGame(host, cfg) {
  const root = host.root;
  const level = host.level || 0;
  const pic = cfg.picture || null;
  const noun = cfg.noun || 'Заказ';
  const byKey = {};
  for (const sh of cfg.shelves) for (const it of sh.items) byKey[it.k] = { ...it, shelf: sh.id };
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

  const wrap = el('div', 'brs');
  wrap.style.background = cfg.bg;
  wrap.innerHTML = `<style>${CSS}</style>
    <div class="brs-top"><div class="brs-count"></div><div class="brs-marks"></div></div>
    <div class="brs-main">
      <div class="brs-left">
        <div class="brs-guestrow">
          <div class="brs-order"><div class="ttl"></div><div class="brs-want"></div><div class="brs-timer"><i></i></div></div>
        </div>
        <div class="brs-trayrow">
          <div class="brs-traybox"><div class="cap"></div><div class="brs-tray"></div>${pic ? '' : '<div class="brs-board"></div>'}</div>
        </div>
      </div>
      <div class="brs-right">
        <div class="brs-msg"></div>
        <div class="brs-shelves"></div>
      </div>
    </div>`;
  root.appendChild(wrap);
  const $ = (s) => wrap.querySelector(s);
  const countEl = $('.brs-count'),
    marksEl = $('.brs-marks'),
    ttlEl = $('.brs-order .ttl'),
    wantEl = $('.brs-want'),
    timerBar = $('.brs-timer i'),
    trayEl = $('.brs-tray'),
    msgEl = $('.brs-msg'),
    shelvesEl = $('.brs-shelves');

  const side = (w, h, parent) => {
    const cv = makeCanvas(w, h);
    cv.canvas.className = 'brs-cv';
    cv.canvas.style.width = '';
    cv.canvas.style.height = '';
    parent.prepend(cv.canvas);
    return cv;
  };
  const gcv = side(130, 130, $('.brs-guestrow'));
  const mcv = side(120, 140, $('.brs-trayrow'));
  // рисунки «как должно быть» и «что получается» (если заказ — картинка)
  let wantPic = null,
    trayPic = null;
  if (pic) {
    const mk = (parent) => {
      const cv = makeCanvas(pic.w || 120, pic.h || 120);
      cv.canvas.className = 'brs-pic';
      cv.canvas.style.width = '';
      cv.canvas.style.height = '';
      parent.appendChild(cv.canvas);
      return cv;
    };
    wantPic = mk(wantEl);
    trayPic = mk(trayEl);
    $('.brs-traybox .cap').textContent = cfg.trayCap || 'Получается:';
  }

  const marks = [];
  for (let i = 0; i < ORDERS; i++) {
    const m = el('div', 'brs-mark');
    marksEl.appendChild(m);
    marks.push(m);
  }
  const buttons = {};
  for (const sh of cfg.shelves) {
    const row = el('div', 'brs-shelf');
    row.appendChild(el('div', 'lbl', sh.label));
    for (const it of sh.items) {
      const b = el('button', 'brs-b', `<span class="em">${it.e || ''}</span><span>${it.name}</span>`);
      if (it.icon) b.querySelector('.em').appendChild(it.icon());
      b.dataset.k = it.k;
      b.onclick = () => tap(it.k, b);
      buttons[it.k] = b;
      row.appendChild(b);
    }
    shelvesEl.appendChild(row);
  }

  // --- состояние
  let idx = 0,
    perfect = 0,
    now = 0;
  let want = [], // ключи заказа
    got = new Set(),
    clean = true, // без ошибок и вовремя
    phase = 'order', // order | yum
    enterAt = 0,
    yumAt = 0,
    lateTimer = 0;

  const setMsg = (t, cls = '') => {
    msgEl.textContent = t;
    msgEl.className = 'brs-msg ' + cls;
  };
  const lock = (v) => Object.values(buttons).forEach((b) => (b.disabled = v));
  const clearMarks = () => Object.values(buttons).forEach((b) => b.classList.remove('hint', 'on'));
  /** Сколько секунд гость ждёт. */
  const patience = (n) => clamp((cfg.patience || 7) + n * 2.2 - level * 0.8, 7, 18);

  function renderWant() {
    if (pic) return; // картинку перерисовывает кадр
    wantEl.innerHTML = '';
    want.forEach((k, i) => {
      if (i) wantEl.appendChild(el('span', 'brs-plus', '+'));
      wantEl.appendChild(el('div', 'brs-it' + (got.has(k) ? ' done' : ''), byKey[k].e));
    });
  }
  function renderTray() {
    if (pic) return;
    trayEl.innerHTML = '';
    // на подносе: первая и последняя полки — крупно, добавки между ними — мелко
    const first = cfg.shelves[0].id,
      last = cfg.shelves[cfg.shelves.length - 1].id;
    for (const k of want) if (byKey[k].shelf === first && got.has(k)) trayEl.appendChild(el('span', '', byKey[k].e));
    for (const k of want)
      if (byKey[k].shelf !== first && byKey[k].shelf !== last && got.has(k))
        trayEl.appendChild(el('span', 'small', byKey[k].e));
    for (const k of want) if (byKey[k].shelf === last && got.has(k)) trayEl.appendChild(el('span', '', byKey[k].e));
  }
  function runTimer(ms) {
    timerBar.style.transition = 'none';
    timerBar.style.width = '100%';
    void timerBar.offsetWidth;
    timerBar.style.transition = `width ${ms}ms linear`;
    timerBar.style.width = '0%';
  }

  function startOrder() {
    const g = guests[idx % guests.length];
    want = cfg.order(idx, level);
    got = new Set();
    clean = true;
    phase = 'order';
    enterAt = now;
    countEl.textContent = `${noun} ${idx + 1} из ${ORDERS}`;
    marks.forEach((m, i) => m.classList.toggle('cur', i === idx));
    ttlEl.innerHTML = `<small>${g.name} просит:</small>${pick(cfg.ask)}`;
    renderWant();
    renderTray();
    lock(false);
    clearMarks();
    setMsg(cfg.serve);
    const ms = patience(want.length) * 1000;
    runTimer(ms);
    host.sfx('pop');
    cancel(lateTimer);
    lateTimer = later(() => {
      if (phase !== 'order') return;
      clean = false;
      setMsg('Гость заждался… Ничего, он подождёт ещё!', 'bad');
      // подсказка: подсветить то, чего не хватает
      for (const k of want) if (!got.has(k)) buttons[k].classList.add('hint');
    }, ms);
  }

  function tap(k, btn) {
    if (phase !== 'order' || stopped) return;
    if (want.includes(k) && !got.has(k)) {
      got.add(k);
      host.sfx('pop');
      btn.classList.remove('hint');
      btn.classList.add('on');
      renderWant();
      renderTray();
      if (got.size >= want.length) return orderDone();
      setMsg(pick(['Так держать!', 'Верно!', 'Отлично!', 'Дальше!']), 'good');
    } else {
      clean = false;
      host.sfx('bad');
      btn.classList.remove('shake');
      void btn.offsetWidth;
      btn.classList.add('shake');
      setMsg(got.has(k) ? 'Это уже готово!' : cfg.wrong || 'Ой, этого в заказе нет!', 'bad');
    }
  }

  function orderDone() {
    phase = 'yum';
    yumAt = now;
    cancel(lateTimer);
    lock(true);
    Object.values(buttons).forEach((b) => b.classList.remove('hint'));
    timerBar.style.transition = 'none';
    if (clean) perfect++;
    marks[idx].classList.remove('cur');
    marks[idx].textContent = clean ? '⭐' : '👌';
    host.sfx('ok');
    setMsg(clean ? 'Быстро и точно! Гость в восторге 😋' : 'Готово! Гость доволен 🙂', 'good');
    later(() => {
      idx++;
      if (idx >= ORDERS) {
        const stars = perfect >= 5 ? 3 : perfect >= 3 ? 2 : 1;
        host.finish({ stars, text: perfect === ORDERS ? cfg.doneAll : cfg.doneSome(perfect), extra: { perfect } });
        return;
      }
      startOrder();
    }, 1300);
  }

  // --- подгонка размеров
  const fit = () => {
    const r = root.getBoundingClientRect();
    const wide = r.width > r.height * 1.25;
    wrap.classList.toggle('wide', wide);
    wrap.classList.toggle('short', r.height < 460 || (!wide && r.height < 640));
    const u = wide
      ? clamp(Math.min((r.height - 40) / (pic ? 400 : 330), r.width / 2 / 400), 0.6, 1.25)
      : clamp(Math.min(r.width / 400, (r.height - 330) / (pic ? 460 : 380)), 0.55, 1.3);
    wrap.style.setProperty('--u', u.toFixed(3));
  };
  fit();
  const ro = new ResizeObserver(fit);
  ro.observe(root);

  // --- хомячки: гость и героиня за работой; картинки заказа
  const t0 = performance.now();
  const frame = (ts) => {
    if (stopped) return;
    now = (ts - t0) / 1000;
    const blink = now % 3.3 < 0.13;
    const yum = phase === 'yum';
    const g = guests[idx % guests.length];
    const c1 = gcv.ctx;
    c1.clearRect(0, 0, 130, 130);
    const k = clamp((now - enterAt) / 0.4, 0, 1);
    const slide = -(1 - k) * (1 - k) * 130;
    const hop = yum ? Math.abs(Math.sin((now - yumAt) * 9)) * 6 : 0;
    host.drawHamster(c1, 65 + slide, 124 - hop, 1.12 * (g.small ? 0.82 : 1), g.look, {
      time: now,
      blink,
      happy: yum,
      armsUp: yum,
      talk: phase === 'order' && now - enterAt < 1.6,
      walk: k < 1 ? (now * 3) % 1 : null,
    });
    const c2 = mcv.ctx;
    c2.clearRect(0, 0, 120, 140);
    host.drawHamster(c2, 60, 134, 1.1, host.look, { time: now, blink, happy: yum });
    if (pic) {
      const w = pic.w || 120,
        h = pic.h || 120;
      wantPic.ctx.clearRect(0, 0, w, h);
      pic.draw(wantPic.ctx, w, h, want, now, g);
      trayPic.ctx.clearRect(0, 0, w, h);
      pic.draw(trayPic.ctx, w, h, [...got], now, g);
    }
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
}
