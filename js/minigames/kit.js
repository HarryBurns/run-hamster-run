// Общий набор для мини-игр (этап 23): то, что раньше каждая игра писала сама.
//
//   pic(draw, w, h, o)    картинка для правил: <img> из маленькой канвы (draw(ctx, w, h), в два раза чётче)
//   makePops(o)           всплывающие надписи «+1», «Ой!» — обводка, текст, подъём и затухание
//   makeKit(onCrash)      то, что хост снимает сам при закрытии игры (и при показе итога):
//     later(fn, ms) / cancel(id)   таймеры; на скрытой вкладке стоят на паузе
//     loop(fn)                     цикл кадра: fn(dt, time, ts); dt — шаг в секундах (не больше 0,05),
//                                  time — секунды с начала цикла без времени, пока вкладка была скрыта
//     on(target, type, fn, opts)   слушатель события
//     add(...elements)             элементы поверх игры, которые надо убрать вместе с ней
//     css(text)                    стиль — один раз на игру
//     dispose()                    снять всё это
// Хост (host.js) кладёт это в объект host — игре ничего не надо снимать в stop() самой.
import { el } from '../core/util.js';

/**
 * Картинка для правил (data: URL в <img>). o.cap — круглые концы линий, o.join: false — без круглых углов,
 * o.alt, o.title — подписи.
 */
export function pic(draw, w = 120, h = w, o = {}) {
  const c = document.createElement('canvas');
  c.width = w * 2;
  c.height = h * 2;
  const x = c.getContext('2d');
  x.scale(2, 2);
  if (o.join !== false) x.lineJoin = 'round';
  if (o.cap) x.lineCap = 'round';
  draw(x, w, h);
  const title = o.title ? ` title="${o.title}"` : '';
  return `<img src="${c.toDataURL()}" width="${w}" height="${h}" alt="${o.alt || ''}"${title}>`;
}

const FONT = 'ui-rounded, "Trebuchet MS", sans-serif';

/**
 * Всплывающие надписи. o: life — сколько живёт (с), fade — за сколько гаснет (по умолчанию = life),
 * rise — на сколько поднимается за секунду, line — толщина белой обводки (0 — без обводки).
 */
export function makePops(o = {}) {
  const life = o.life || 1,
    fade = o.fade || life,
    rise = o.rise ?? 30,
    lw = o.line ?? 4;
  const list = [];
  return {
    list,
    /** Новая надпись: text, x, y, col (цвет; без него — текущий fillStyle). */
    add(text, x, y, col) {
      list.push({ text, col, x, y, t: 0 });
    },
    step(dt) {
      for (const p of list) p.t += dt;
      for (let i = list.length - 1; i >= 0; i--) if (list[i].t > life) list.splice(i, 1);
    },
    /** font — размер в пикселях или вся строка шрифта; at(p) → [x, y] — своё место надписи. */
    draw(ctx, font = 20, at) {
      ctx.textAlign = 'center';
      ctx.font = typeof font === 'number' ? `900 ${font}px ${FONT}` : font;
      for (const p of list) {
        const [x, y] = at ? at(p) : [p.x, p.y];
        const yy = y - p.t * rise;
        ctx.globalAlpha = Math.max(0, 1 - p.t / fade);
        if (lw) {
          ctx.lineWidth = lw;
          ctx.strokeStyle = '#fff';
          ctx.strokeText(p.text, x, yy);
        }
        if (p.col) ctx.fillStyle = p.col;
        ctx.fillText(p.text, x, yy);
      }
      ctx.globalAlpha = 1;
    },
  };
}

/** onCrash(err) — кадр игры падает раз за разом: хост закрывает игру. */
export function makeKit(onCrash) {
  let dead = false,
    hidden = typeof document !== 'undefined' && document.hidden,
    seq = 0;
  const timers = new Map(); // id → { fn, due, rest, h }
  const loops = new Set();
  const offs = [];
  const nodes = [];
  const styles = new Map();

  const safe = (fn, ...a) => {
    try {
      fn(...a);
    } catch (e) {
      console.error(e);
    }
  };
  const arm = (id, t, ms) => {
    t.due = performance.now() + ms;
    t.h = setTimeout(() => {
      timers.delete(id);
      if (!dead) safe(t.fn);
    }, ms);
  };

  function later(fn, ms = 0) {
    if (dead) return 0;
    const id = ++seq,
      t = { fn };
    timers.set(id, t);
    if (hidden) t.rest = ms;
    else arm(id, t, ms);
    return id;
  }
  function cancel(id) {
    const t = timers.get(id);
    if (!t) return;
    clearTimeout(t.h);
    timers.delete(id);
  }

  function loop(fn) {
    const L = { raf: 0, last: performance.now(), time: 0, errs: 0, on: true };
    const tick = (ts) => {
      L.raf = 0;
      if (dead || !L.on) return;
      const raw = Math.max(0, (ts - L.last) / 1000);
      L.last = ts;
      L.time += raw;
      try {
        fn(Math.min(0.05, raw), L.time, ts);
        L.errs = 0;
      } catch (e) {
        // ошибка в кадре не валит страницу: пишем в консоль; если кадр падает снова и снова — игру закрывает хост
        if (!L.errs) console.error(e);
        if (++L.errs >= 3) {
          L.on = false;
          loops.delete(L);
          if (onCrash) onCrash(e);
          return;
        }
      }
      if (!dead && L.on && !hidden) L.raf = requestAnimationFrame(tick);
    };
    L.tick = tick;
    loops.add(L);
    if (!hidden) L.raf = requestAnimationFrame(tick);
    return {
      stop() {
        L.on = false;
        cancelAnimationFrame(L.raf);
        loops.delete(L);
      },
    };
  }

  function on(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    const off = () => target.removeEventListener(type, fn, opts);
    offs.push(off);
    return off;
  }

  // вкладку скрыли (iPad уснул, переключились) — кадры и таймеры стоят; вернулись — идут дальше с того же места
  const vis = () => {
    if (dead || document.hidden === hidden) return;
    hidden = document.hidden;
    const now = performance.now();
    if (hidden) {
      for (const L of loops) cancelAnimationFrame(L.raf);
      for (const t of timers.values()) {
        clearTimeout(t.h);
        t.rest = Math.max(0, t.due - now);
      }
    } else {
      for (const L of loops) {
        L.last = now;
        L.raf = requestAnimationFrame(L.tick);
      }
      for (const [id, t] of timers) arm(id, t, t.rest || 0);
    }
  };
  if (typeof document !== 'undefined') on(document, 'visibilitychange', vis);

  return {
    later,
    cancel,
    loop,
    on,
    /** Положить элементы в parent (обычно host.root); при закрытии игры они уберутся сами. */
    add(parent, ...els) {
      parent.append(...els);
      nodes.push(...els);
      return els[0];
    },
    /** Стиль в parent (рамку игры) — один раз на текст; уходит вместе с рамкой. */
    css(parent, text) {
      if (!text || styles.has(text)) return styles.get(text);
      const s = el('style', '', text);
      parent.appendChild(s);
      styles.set(text, s);
      return s;
    },
    /** Что-то ещё снять при закрытии (например, ResizeObserver канвы). */
    onDispose(fn) {
      offs.push(fn);
    },
    get dead() {
      return dead;
    },
    dispose() {
      if (dead) return;
      dead = true;
      for (const L of loops) cancelAnimationFrame(L.raf);
      loops.clear();
      for (const t of timers.values()) clearTimeout(t.h);
      timers.clear();
      for (const off of offs.splice(0)) safe(off);
      for (const n of nodes.splice(0)) n.remove();
    },
  };
}
