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
//
// Ниже — общий ход смены makeVisits: «пришёл гость → показал, чего хочет → ты выполняешь → оценка → следующий».
// На нём стоят и orderGame, и игры со своей механикой выполнения: «Шеф-повар» (запомнить порядок), «Доктор»
// (выбрать лечение), «Парикмахер» (сделать по картинке), «Учительница» (верно или ошибка).
import { el, shuffle, pick, clamp } from '../core/util.js';
import { makeCanvas } from '../core/draw.js';

export const ORDERS = 6;

/** Общий стиль смены с приставкой p: рамка игры, верхняя строка — плашка «N из M», кружки-отметки или счётчик ошибок. */
export const visitCss = (p) => `
.${p}{position:absolute;inset:0;display:flex;flex-direction:column;overflow:hidden}
.${p}-top{flex:none;display:flex;align-items:center;gap:8px;padding:8px 12px 6px}
.${p}-count,.${p}-miss{font-weight:900;background:rgba(255,255,255,.9);border-radius:12px;padding:4px 10px;font-size:15px;white-space:nowrap;
  box-shadow:0 2px 0 rgba(74,55,40,.15)}
.${p}-miss{margin-left:auto}
.${p}-marks{display:flex;gap:4px}
.${p}-mark{width:24px;height:24px;border-radius:50%;background:#fff;border:2px solid #e0cfae;font-size:14px;line-height:1;display:grid;place-items:center}
.${p}-mark.cur{border-color:#ff6b9d;box-shadow:0 0 0 2px #ffd0de}
.${p}.short .${p}-top{padding:5px 12px 3px}
`;

/** Канва-картинка в разметке игры: рисуем в w×h, размер на экране задаёт CSS класса cls. */
export function domCanvas(w, h, cls) {
  const cv = makeCanvas(w, h);
  if (cls) cv.canvas.className = cls;
  cv.canvas.style.width = '';
  cv.canvas.style.height = '';
  return cv;
}

/**
 * Ход смены. o: p — приставка классов CSS; total — сколько гостей; noun — «Заказ», «Пациент»…; who — как зовут гостя,
 * если друзей нет; marks — кружки-отметки в верхней строке (иначе — счётчик ошибок v.miss); крюки игры:
 * start(v) — пришёл следующий гость, finish(v) — смена кончилась.
 * v: guest — кто сейчас; idx — номер гостя с нуля; now — время игры (с); phase, since — шаг и сколько секунд он идёт;
 *   set(phase), header (верхняя строка — положить в разметку), count() — обновить плашку и текущий кружок,
 *   mark(text, cls) — отметить гостя, miss(text), fit(wrap, fn), loop(fn), next(),
 *   arrive(ms, fn), retry(phase, ms), leave(tHappy, tExit, fn) — шаги «вошёл → ждёт → (не то) → рад → ушёл → следующий».
 */
export function makeVisits(host, o) {
  const { later } = host,
    p = o.p;
  const guests = shuffle(host.friends && host.friends.length ? host.friends : [{ id: 'me', name: o.who || 'Гость', look: host.look }]);
  const header = el('div', `${p}-top`, `<div class="${p}-count"></div><div class="${o.marks ? `${p}-marks` : `${p}-miss`}"></div>`);
  const marks = [];
  for (let i = 0; o.marks && i < o.total; i++) marks.push(header.lastChild.appendChild(el('div', `${p}-mark`)));
  const v = {
    guests,
    header,
    idx: 0,
    now: 0,
    phase: '',
    at: 0,
    get guest() {
      return guests[v.idx % guests.length];
    },
    get since() {
      return v.now - v.at;
    },
    set(phase) {
      v.phase = phase;
      v.at = v.now;
    },
    count() {
      header.firstChild.textContent = `${o.noun} ${Math.min(v.idx + 1, o.total)} из ${o.total}`;
      marks.forEach((m, i) => m.classList.toggle('cur', i === v.idx));
    },
    mark(text, cls) {
      const m = marks[v.idx];
      m.classList.remove('cur');
      if (cls) m.classList.add(cls);
      m.textContent = text;
    },
    miss: (text) => (header.lastChild.textContent = text),
    /** Подгонка под размер рамки: классы wide (широкая) и short (низкая), дальше — fn(r, wide, short). */
    fit(wrap, fn) {
      const f = () => {
        const r = host.root.getBoundingClientRect();
        const wide = r.width > r.height * (o.wide || 1.25);
        const short = o.short ? o.short(r, wide) : r.height < 420;
        wrap.classList.toggle('wide', wide);
        wrap.classList.toggle('short', short);
        fn(r, wide, short);
      };
      f();
      host.onResize(f);
    },
    /** Кадр: fn(since, time); время игры на скрытой вкладке стоит вместе с таймерами. */
    loop: (fn) =>
      host.loop((_, time) => {
        v.now = time;
        fn(v.since, time);
      }),
    /** Следующий гость — или конец смены. */
    next() {
      v.idx++;
      if (v.idx >= o.total) o.finish(v);
      else o.start(v);
    },
    /** Гость входит (шаг enter); через ms он на месте: fn() — показать, чего он хочет, шаг wait. */
    arrive(ms, fn) {
      v.set('enter');
      later(() => {
        fn();
        v.set('wait');
        host.sfx('pop');
      }, ms);
    },
    /** Не то: шаг phase на ms, потом снова wait (если игрок не успел выбрать раньше). */
    retry(phase, ms) {
      v.set(phase);
      later(() => {
        if (v.phase === phase) v.set('wait');
      }, ms);
    },
    /** Гость рад (шаг happy, tHappy мс), уходит (exit, tExit мс; fn — что убрать перед уходом) — и следующий. */
    leave(tHappy, tExit, fn) {
      v.set('happy');
      later(() => {
        if (fn) fn();
        v.set('exit');
        later(v.next, tExit);
      }, tHappy);
    },
  };
  return v;
}

const CSS =
  visitCss('brs') +
  `
.brs{--u:1}
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
.brs.short .brs-msg{font-size:15px}
`;

/** Запустить игру «собери по заказу» с настройкой cfg. Снимать нечего — всё снимает хост (kit.js). */
export function orderGame(host, cfg) {
  const level = host.level || 0;
  const pic = cfg.picture || null;
  const noun = cfg.noun || 'Заказ';
  const byKey = {};
  for (const sh of cfg.shelves) for (const it of sh.items) byKey[it.k] = { ...it, shelf: sh.id };
  const { later, cancel } = host;
  const v = makeVisits(host, {
    p: 'brs',
    total: ORDERS,
    noun,
    marks: true,
    short: (r, wide) => r.height < 460 || (!wide && r.height < 640),
    start: startOrder,
    finish() {
      const stars = perfect >= 5 ? 3 : perfect >= 3 ? 2 : 1;
      host.finish({ stars, text: perfect === ORDERS ? cfg.doneAll : cfg.doneSome(perfect), extra: { perfect } });
    },
  });

  const wrap = el('div', 'brs');
  wrap.style.background = cfg.bg;
  host.css(CSS);
  wrap.innerHTML = `
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
  wrap.prepend(v.header);
  host.add(wrap);
  const $ = (s) => wrap.querySelector(s);
  const ttlEl = $('.brs-order .ttl'),
    wantEl = $('.brs-want'),
    timerBar = $('.brs-timer i'),
    trayEl = $('.brs-tray'),
    msgEl = $('.brs-msg'),
    shelvesEl = $('.brs-shelves');

  const side = (w, h, parent) => {
    const cv = domCanvas(w, h, 'brs-cv');
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
      const cv = domCanvas(pic.w || 120, pic.h || 120, 'brs-pic');
      parent.appendChild(cv.canvas);
      return cv;
    };
    wantPic = mk(wantEl);
    trayPic = mk(trayEl);
    $('.brs-traybox .cap').textContent = cfg.trayCap || 'Получается:';
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
  let perfect = 0;
  let want = [], // ключи заказа
    got = new Set(),
    clean = true, // без ошибок и вовремя
    enterAt = 0, // когда пришёл гость
    lateTimer = 0,
    waitFor = 1; // терпение этого гостя, с

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
  // полоска терпения убывает в кадре (по времени игры): на скрытой вкладке гость ждёт вместе с ней
  const runTimer = (ms) => (waitFor = ms / 1000);

  // шаги гостя: order — ждёт заказ, yum — доволен
  function startOrder() {
    want = cfg.order(v.idx, level);
    got = new Set();
    clean = true;
    v.set('order');
    enterAt = v.now;
    v.count();
    ttlEl.innerHTML = `<small>${v.guest.name} просит:</small>${pick(cfg.ask)}`;
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
      if (v.phase !== 'order') return;
      clean = false;
      setMsg('Гость заждался… Ничего, он подождёт ещё!', 'bad');
      // подсказка: подсветить то, чего не хватает
      for (const k of want) if (!got.has(k)) buttons[k].classList.add('hint');
    }, ms);
  }

  function tap(k, btn) {
    if (v.phase !== 'order') return;
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
    v.set('yum');
    cancel(lateTimer);
    lock(true);
    Object.values(buttons).forEach((b) => b.classList.remove('hint'));
    timerBar.style.width = '0%';
    if (clean) perfect++;
    v.mark(clean ? '⭐' : '👌');
    host.sfx('ok');
    setMsg(clean ? 'Быстро и точно! Гость в восторге 😋' : 'Готово! Гость доволен 🙂', 'good');
    later(v.next, 1300);
  }

  // --- подгонка размеров
  v.fit(wrap, (r, wide) => {
    const u = wide
      ? clamp(Math.min((r.height - 40) / (pic ? 400 : 330), r.width / 2 / 400), 0.6, 1.25)
      : clamp(Math.min(r.width / 400, (r.height - 330) / (pic ? 460 : 380)), 0.55, 1.3);
    wrap.style.setProperty('--u', u.toFixed(3));
  });

  // --- хомячки: гость и героиня за работой; картинки заказа
  v.loop((since, now) => {
    const yum = v.phase === 'yum',
      g = v.guest;
    if (!yum) timerBar.style.width = `${clamp(1 - since / waitFor, 0, 1) * 100}%`;
    const blink = now % 3.3 < 0.13;
    counterGuest(host, gcv.ctx, v, enterAt, yum, !yum && since < 1.6, 1.12 * (g.small ? 0.82 : 1));
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
  });

  startOrder();
}

/**
 * Гость у прилавка (канва 130×130): въезжает слева за 0,4 с (enterAt — когда пришёл), говорит (talk),
 * радуется и подпрыгивает (yum — шаг «доволен», он идёт уже v.since секунд).
 */
export function counterGuest(host, ctx, v, enterAt, yum, talk, scale) {
  const now = v.now;
  ctx.clearRect(0, 0, 130, 130);
  const k = clamp((now - enterAt) / 0.4, 0, 1);
  const slide = -(1 - k) * (1 - k) * 130;
  const hop = yum ? Math.abs(Math.sin(v.since * 9)) * 6 : 0;
  host.drawHamster(ctx, 65 + slide, 124 - hop, scale, v.guest.look, {
    time: now,
    blink: now % 3.3 < 0.13,
    happy: yum,
    armsUp: yum,
    talk,
    walk: k < 1 ? (now * 3) % 1 : null,
  });
}
