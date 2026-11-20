// Телевизор дома: окно «Телевизор» с передачами — прогноз погоды, кулинарное шоу «У плиты» (раз в 3–4 дня; досмотрела
// до конца — узнала рецепт), «В мире животных» (добрый факт), новости Ореховой Гавани (из жизни хомячка) и мультики.
// Канал один на все телевизоры: что включила в окне, то и показывает экранчик мебели в доме (engine/side/items.js).
//
// Расписание шоу, факты, ведущие — data/tv.js; рисунки передач — art/tv_art.js; состояние (канал, новости, выпуск
// дня) — state.tv, меняют его действия setTvChannel, addTvNews, setTvShow (core/actions.js).
import { G, forecast, weatherNow, playerLook } from '../core/state.js';
import { setTvChannel, addTvNews, setTvShow, setFurnOn, learnRecipe } from '../core/actions.js';
import { on } from '../core/events.js';
import { register } from '../core/registry.js';
import { el, esc, pick, plural } from '../core/util.js';
import { sfx } from '../core/audio.js';
import { openPanel } from '../ui/panel.js';
import { toast } from '../ui/toast.js';
import { paintTV, TV_W, TV_H } from '../art/tv_art.js';
import {
  TV_CHANNELS,
  TV_CH_BY_ID,
  TV_HOSTS,
  ANIMAL_FACTS,
  ANIMAL_NAMES,
  TOWN_TRIFLES,
  COOK_SHOW,
  COOK_SHOW_SEC,
  cookShowOn,
  nextCookShow,
  cookShowNo,
  DISH_BY_ID,
  ING_BY_ID,
  LAND_BY_ID,
  QUEST_BY_ID,
  HOME_BY_ID,
  BIZ_BY_ID,
  VILLA_UP_BY_ID,
  PET_BY_ID,
  RIDE_BY_ID,
  NPC_BY_ID,
  HOLIDAY_BY_ID,
  EXTRA_STICKERS,
  MONTHS,
  DAYS_PER_MONTH,
  BAD_FORCE,
  weatherName,
  weatherIcon,
  holidayOn,
  yearOfDay,
} from '../data/index.js';

const S = () => G.state;
const nameOf = () => esc(S().name || 'Хомка');
const STICKER = Object.fromEntries(EXTRA_STICKERS.map((q) => [q.id, q]));

// ---------- новости: что случилось в игре ----------
// Своё событие игры → новость (k, id). Тексты собираются при показе (newsLine), в сохранении — только что и когда.
on('land', ({ id }) => addTvNews('land', id));
on('quest', ({ id, done }) => done && addTvNews('quest', id));
// наклейки за задания журнала и праздники уже есть в новостях своими словами; за письма дня — каждый день, не новость
on('sticker', ({ id }) => STICKER[id] && !/^(q_|x_hol_)/.test(id) && addTvNews('sticker', id));
on('buy', ({ cat, id }) => (cat === 'home' || cat === 'biz') && addTvNews(cat, id));
on('villaUp', ({ what, id }) => what === 'done' && id && addTvNews('villa', id));
on('cove', ({ what, id }) => {
  if (what === 'piece') addTvNews('map', id || '');
  else if (what === 'treasure') addTvNews('treasure');
});
on('holiday', ({ id, what }) => what === 'done' && addTvNews('holiday', id + ':' + yearOfDay(S().day)));
on('pet', ({ what, kind }) => what === 'adopt' && addTvNews('pet', kind || ''));
on('wheels', ({ what, id }) => what === 'buy' && addTvNews('ride', id));
on('friend', ({ id, before, after }) => after >= 5 && before < 5 && addTvNews('bff', id));

/** Текст новости: { icon, text } (или null — то, о чём новость, из игры убрали). */
function newsLine(n) {
  const name = nameOf();
  switch (n.k) {
    case 'land': {
      const L = LAND_BY_ID[n.id];
      return L && { icon: L.icon, text: `Новое место на карте: ${L.name.toLowerCase()}! Дорогу туда открыла ${name}.` };
    }
    case 'quest': {
      const q = QUEST_BY_ID[n.id],
        npc = q && NPC_BY_ID[q.npc];
      return (
        q && {
          icon: q.icon || '📖',
          text: `${name} выполнила задание «${q.title}».` + (npc ? ` ${npc.name} говорит: «Спасибо!»` : ''),
        }
      );
    }
    case 'sticker': {
      const st = STICKER[n.id];
      return (
        st && {
          icon: st.sticker,
          text: `${name} получила редкую наклейку «${st.title.replace(/!$/, '')}». Вот это да!`,
        }
      );
    }
    case 'home': {
      const h = HOME_BY_ID[n.id];
      return (
        h && { icon: '🔑', text: `${name} купила новое жильё — ${h.name.toLowerCase()}. Поздравляем с новосельем!` }
      );
    }
    case 'biz': {
      const b = BIZ_BY_ID[n.id];
      return b && { icon: '🏪', text: `В городе открылось новое заведение — ${b.name}! Хозяйка — ${name}.` };
    }
    case 'villa': {
      const u = VILLA_UP_BY_ID[n.id];
      return u && { icon: u.icon, text: `Стройка закончена: «${u.name}»! ${name} приглашает соседей в гости.` };
    }
    case 'map':
      return { icon: '🗺️', text: `Жители говорят: ${name} нашла кусочек старой карты сокровищ! Что же на ней?` };
    case 'treasure':
      return { icon: '💰', text: `Сенсация! ${name} выкопала настоящий клад на секретном пляже!` };
    case 'holiday': {
      const h = HOLIDAY_BY_ID[n.id.split(':')[0]];
      return (
        h && {
          icon: h.icon,
          text: `Праздник «${h.name}» удался! ${name} успела всё — спасибо за праздничное настроение!`,
        }
      );
    }
    case 'pet': {
      const p = PET_BY_ID[n.id];
      return {
        icon: p ? p.icon : '🐾',
        text: `Хорошие новости из приюта: у малыша теперь есть дом и хозяйка — ${name}!`,
      };
    }
    case 'ride': {
      const r = RIDE_BY_ID[n.id];
      return r && { icon: r.icon, text: `Новинка на улицах: ${r.name.toLowerCase()}! Катается ${name}. Би-бип!` };
    }
    case 'bff': {
      const f = NPC_BY_ID[n.id];
      return f && { icon: '💞', text: `${name} и ${f.name} теперь лучшие друзья!` };
    }
    case 'recipe': {
      const d = DISH_BY_ID[n.id];
      return (
        d && {
          icon: d.e,
          text: `${TV_HOSTS.cook.name} рассказал секрет блюда «${d.name}». ${name} уже записала рецепт!`,
        }
      );
    }
  }
  return null;
}
/** Сколько дней назад: «сегодня», «вчера», «3 дня назад». */
function ago(d) {
  const n = S().day - d;
  return n <= 0 ? 'сегодня' : n === 1 ? 'вчера' : `${n} ${plural(n, 'день', 'дня', 'дней')} назад`;
}
/**
 * Новости для показа (до 5): сначала про сегодня и завтра (праздник, ненастье), потом — из жизни хомячка, последние
 * первыми; нет новостей — городские мелочи. [{ icon, text, when }]
 */
export function tvNews() {
  const s = S(),
    out = [],
    start = s.startDay || 0;
  const hToday = holidayOn(s.day, start),
    hTomorrow = holidayOn(s.day + 1, start);
  if (hToday)
    out.push({
      icon: hToday.icon,
      text: `Сегодня в Ореховой Гавани праздник: ${hToday.name}! Все на площадь!`,
      when: 'сегодня',
    });
  else if (hTomorrow)
    out.push({
      icon: hTomorrow.icon,
      text: `Скоро праздник: завтра ${hTomorrow.name}! Город уже украшают.`,
      when: 'завтра',
    });
  const fz = forecast(s.day + 1);
  if (fz.force >= BAD_FORCE)
    out.push({
      icon: fz.icon,
      text: `Завтра синоптики обещают: ${fz.name}. ${fz.kind === 'snow' ? 'Одевайся теплее!' : 'Не забудь дождевик!'} Жители посидят по домам.`,
      when: 'завтра',
    });
  for (const n of s.tv.news) {
    if (out.length >= 5) break;
    const line = newsLine(n);
    if (line) out.push({ ...line, when: ago(n.d) });
  }
  if (out.length < 2) {
    const k = s.day % TOWN_TRIFLES.length;
    for (const t of [TOWN_TRIFLES[k], TOWN_TRIFLES[(k + 3) % TOWN_TRIFLES.length]])
      if (out.length < 3) out.push({ icon: '🌰', text: t, when: 'мелочи' });
  }
  return out;
}

// ---------- «У плиты» ----------
/** Когда (относительно сегодня): «сегодня», «завтра», «послезавтра», «через 3 дня» и дата. */
function whenDay(day) {
  const n = day - S().day,
    m = Math.floor(day / DAYS_PER_MONTH) % 12,
    date = `${MONTHS[m]}, ${(day % DAYS_PER_MONTH) + 1}-й день`;
  const rel =
    n <= 0
      ? 'сегодня'
      : n === 1
        ? 'завтра'
        : n === 2
          ? 'послезавтра'
          : `через ${n} ${plural(n, 'день', 'дня', 'дней')}`;
  return { rel, date };
}
/**
 * Выпуск сегодня: { day, dish, done } или null (сегодня шоу нет). Блюдо выбирается один раз в день (запоминается):
 * по очереди выпусков — первое, которого хозяйка ещё не знает; знает всё — по очереди.
 */
export function cookShowToday() {
  const s = S(),
    day = s.day;
  if (!cookShowOn(day)) return null;
  if (s.tv.show && s.tv.show.day === day) return s.tv.show;
  const k = cookShowNo(day);
  let dish = COOK_SHOW[k % COOK_SHOW.length];
  for (let i = 0; i < COOK_SHOW.length; i++) {
    const id = COOK_SHOW[(k + i) % COOK_SHOW.length];
    if (!s.recipes.includes(id)) {
      dish = id;
      break;
    }
  }
  setTvShow(day, dish, false);
  return s.tv.show;
}
/** Досмотрела выпуск: рецепт — один раз (если его ещё нет). Возвращает true, если рецепт новый. */
function finishShow(show) {
  const fresh = !S().recipes.includes(show.dish);
  setTvShow(show.day, show.dish, true);
  if (fresh) {
    learnRecipe(show.dish);
    addTvNews('recipe', show.dish);
    const d = DISH_BY_ID[show.dish];
    sfx('magic');
    toast(`Новый рецепт: ${d.e} ${d.name}! Приготовь его на кухне 🍳`, 'good');
  } else sfx('ok');
  return fresh;
}

// ---------- окно ----------
/** Приветствие ведущего по времени суток. */
function hello() {
  const m = S().minutes;
  return m < 11 * 60 ? 'Доброе утро!' : m < 17 * 60 ? 'Добрый день!' : m < 22 * 60 ? 'Добрый вечер!' : 'Доброй ночи!';
}
let cur = null; // открытое окно — для автотеста (tvDebug)

/** Внешности ведущих (хомячок в мультике — сама хозяйка). */
const looks = () => ({
  weather: TV_HOSTS.weather.look,
  cook: TV_HOSTS.cook.look,
  news: TV_HOSTS.news.look,
  toons: playerLook(),
});

function partsText(f) {
  const ps = f.parts,
    hh = (m) => `${Math.floor(m / 60)}:00`;
  if (ps.length === 1) return `${ps[0].icon} ${ps[0].name} весь день`;
  return ps
    .map((p, i) =>
      i === 0
        ? `до ${hh(p.to)} — ${p.icon} ${p.name}`
        : i === ps.length - 1
          ? `с ${hh(p.from)} — ${p.icon} ${p.name}`
          : `с ${hh(p.from)} до ${hh(p.to)} — ${p.icon} ${p.name}`,
    )
    .join(', ');
}

/** Открыть телевизор. item, scene — мебель, на которую нажали (включается); без них — просто окно (автотест). */
export function openTv({ item, scene } = {}) {
  if (cur) return cur;
  if (item && !item.on) {
    if (!scene || scene.owned) setFurnOn(item, true);
    else item.on = true; // телевизор в чужом доме живёт только в сцене
  }
  sfx('tvOn');
  const st = {
    ch: TV_CH_BY_ID[S().tv.ch] ? S().tv.ch : 'weather',
    fact: null,
    prog: 0, // сколько выпуска «У плиты» досмотрено (0..1)
    t0: performance.now(),
    last: performance.now(),
    cache: new Map(),
    raf: 0,
    closed: false,
  };
  let canvas = null,
    ctx = null,
    cw = 0,
    ch = 0,
    dpr = 1,
    frame = null,
    capEl = null,
    nameEl = null,
    chipsEl = null,
    progEl = null;

  const newFact = () => {
    const pool = ANIMAL_FACTS.filter((f) => f !== st.fact);
    st.fact = pick(pool);
  };
  newFact();

  function info() {
    const s = S();
    switch (st.ch) {
      case 'weather':
        return { today: forecast(s.day), tomorrow: forecast(s.day + 1), now: weatherNow() };
      case 'cook': {
        const show = cookShowToday(),
          w = whenDay(nextCookShow(s.day + (show ? 0 : 1)));
        if (!show) return { on: false, next: `${w.rel}` };
        const d = DISH_BY_ID[show.dish];
        return {
          on: true,
          dish: d,
          ings: Object.keys(d.needs || {}).map((id) => (ING_BY_ID[id] ? ING_BY_ID[id].e : '🥣')),
          prog: st.prog,
          show,
        };
      }
      case 'animals':
        return { a: st.fact.a, fact: st.fact };
      case 'news':
        return { items: tvNews() };
    }
    return {};
  }

  function caption() {
    const s = S(),
      i = info();
    let html = '';
    if (st.ch === 'weather') {
      const n = weatherNow();
      html =
        `<p><b>${esc(TV_HOSTS.weather.name)}:</b> «${hello().replace('!', ', Ореховая Гавань!')} Вот что нас ждёт».</p>
        <p class="tv-wx-now">${weatherIcon(n.kind, n.force)} <b>Сейчас:</b> ${weatherName(n.kind, n.force)}.</p>
        <p class="tv-wx-today">📍 <b>Сегодня:</b> ${partsText(i.today)}.</p>
        <p class="tv-wx-tomorrow">➡️ <b>Завтра:</b> ${partsText(i.tomorrow)}.</p>` +
        (i.tomorrow.force >= BAD_FORCE || i.today.force >= BAD_FORCE
          ? '<p class="muted">В ливень, грозу и метель жители сидят по домам — загляни к ним в гости!</p>'
          : '');
    } else if (st.ch === 'cook') {
      const host = esc(TV_HOSTS.cook.name);
      if (!i.on) {
        const w = whenDay(nextCookShow(s.day + 1));
        html = `<p>🍳 Кулинарное шоу <b>«У плиты»</b> выходит раз в 3–4 дня. ${host} готовит секретное блюдо — досмотри выпуск до конца, и рецепт будет твоим!</p>
          <p class="tv-cook-next">📅 Следующий выпуск — <b>${w.rel}</b> (${w.date}).</p>`;
      } else {
        const d = i.dish,
          known = s.recipes.includes(d.id),
          done = st.prog >= 1;
        html =
          `<p>🍳 <b>«У плиты»</b> — сегодня в эфире! ${host} готовит: <b>${d.e} ${esc(d.name)}</b>.</p>
          <p class="tv-cook-ings">Понадобится: ${Object.entries(d.needs || {})
            .map(([id, k]) => `${ING_BY_ID[id].e} ${esc(ING_BY_ID[id].name.toLowerCase())}${k > 1 ? ' ×' + k : ''}`)
            .join(', ')}.</p>` +
          (done
            ? `<p class="tv-cook-done"><b>${known ? 'Рецепт «' + esc(d.name) + '» — в твоей книге рецептов!' : ''}</b> Приготовь блюдо дома на кухне 🍳</p>`
            : known
              ? '<p class="muted">Этот рецепт у тебя уже есть — можно просто посмотреть, как готовит шеф.</p>'
              : '<p class="tv-cook-wait">Досмотри до конца — и узнаешь рецепт! ⏳</p>');
      }
    } else if (st.ch === 'animals') {
      const f = i.fact;
      html = `<p class="tv-animal"><b>${esc(ANIMAL_NAMES[f.a] || '')}</b></p><p class="tv-fact">${esc(f.text)}</p>`;
    } else if (st.ch === 'news') {
      html =
        `<p><b>${esc(TV_HOSTS.news.name)}:</b> «${hello()} В эфире новости Ореховой Гавани».</p><ul class="tv-news">` +
        i.items
          .map((n) => `<li><span class="tv-ni">${n.icon}</span> ${n.text} <span class="muted">· ${n.when}</span></li>`)
          .join('') +
        '</ul>';
    } else html = '<p>🎵 Мультик «Мячик и хомячок». Просто смотри и отдыхай!</p>';
    capEl.innerHTML = html;
    if (st.ch === 'animals') {
      const b = el('button', 'btn small', '🐾 Ещё факт');
      b.dataset.act = 'tv-fact';
      b.onclick = () => {
        sfx('pop');
        newFact();
        caption();
      };
      capEl.appendChild(b);
    }
    if (st.ch === 'cook' && i.on && st.prog >= 1) {
      const b = el('button', 'btn small', '⟲ Смотреть сначала');
      b.dataset.act = 'tv-again';
      b.onclick = () => {
        sfx('tap');
        st.prog = 0;
        caption();
      };
      capEl.appendChild(b);
    }
    // программа передач
    const show = cookShowOn(s.day),
      w = whenDay(nextCookShow(s.day + (show ? 1 : 0)));
    progEl.innerHTML =
      `<b>📅 Программа передач</b><br>🍳 «У плиты» — ` +
      (show ? `<b>сегодня весь день!</b> Потом — ${w.rel}.` : `<b>${w.rel}</b> (${w.date}).`) +
      '<br>🌦️ Погода, 🐢 животные, 📰 новости и 🎵 мультики — каждый день.';
  }

  function setCh(id, quiet) {
    if (!TV_CH_BY_ID[id]) return;
    if (st.ch !== id) st.prog = 0; // переключила — выпуск «У плиты» начнётся сначала
    st.ch = id;
    setTvChannel(id);
    if (!quiet) sfx('click');
    if (id === 'toons' && !quiet)
      [523, 659, 784].forEach((f, k) => setTimeout(() => !st.closed && sfx('note', f), 120 + k * 140));
    const c = TV_CH_BY_ID[id];
    nameEl.textContent = `${c.icon} ${c.name}`;
    for (const b of chipsEl.children) b.classList.toggle('on', b.dataset.ch === id);
    caption();
  }
  const step = (d) => {
    const i = TV_CHANNELS.findIndex((c) => c.id === st.ch);
    setCh(TV_CHANNELS[(i + d + TV_CHANNELS.length) % TV_CHANNELS.length].id);
  };

  function fit() {
    if (!frame) return;
    const r = frame.getBoundingClientRect(),
      maxH = Math.max(120, Math.min(window.innerHeight * (window.innerHeight < 560 ? 0.52 : 0.46), 420));
    let w = Math.max(200, r.width),
      h = (w * TV_H) / TV_W;
    if (h > maxH) {
      h = maxH;
      w = (h * TV_W) / TV_H;
    }
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (Math.round(w) === cw && Math.round(h) === ch && canvas.width === Math.round(w * dpr)) return;
    cw = Math.round(w);
    ch = Math.round(h);
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    st.cache.clear();
  }
  const lk = looks();
  let capT = 0;
  function draw() {
    if (st.closed) return;
    const now = performance.now(),
      dt = Math.min(0.1, (now - st.last) / 1000),
      t = (now - st.t0) / 1000;
    st.last = now;
    const i = info();
    if (st.ch === 'cook' && i.on && st.prog < 1) {
      st.prog = Math.min(1, st.prog + dt / COOK_SHOW_SEC);
      i.prog = st.prog;
      if (st.prog >= 1) {
        finishShow(i.show);
        caption();
      }
    }
    // новости и погода могут поменяться и при открытом окне (автотест, событие) — подпись обновляется раз в 2 с
    if ((capT += dt) > 2 && (st.ch === 'news' || st.ch === 'weather')) {
      capT = 0;
      caption();
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintTV(ctx, st.ch, 0, 0, cw, ch, t, i, { cache: st.cache, dpr, looks: lk });
    st.raf = requestAnimationFrame(draw);
  }
  const onResize = () => fit();

  const panel = openPanel({
    title: 'Телевизор',
    icon: '📺',
    cls: 'wide tv-panel',
    render(body) {
      body.innerHTML = '';
      const wrap = el('div', 'tv-wrap'),
        left = el('div', 'tv-left'),
        side = el('div', 'tv-side');
      frame = el('div', 'tv-frame');
      canvas = el('canvas', 'tv-screen');
      ctx = canvas.getContext('2d');
      frame.appendChild(canvas);
      const nav = el('div', 'tv-nav'),
        prev = el('button', 'btn tv-arrow', '◀'),
        next = el('button', 'btn tv-arrow', '▶');
      prev.dataset.act = 'tv-prev';
      next.dataset.act = 'tv-next';
      prev.setAttribute('aria-label', 'Предыдущий канал');
      next.setAttribute('aria-label', 'Следующий канал');
      prev.onclick = () => step(-1);
      next.onclick = () => step(1);
      nameEl = el('div', 'tv-chname');
      nav.append(prev, nameEl, next);
      left.append(frame, nav);
      chipsEl = el('div', 'tv-chips');
      for (const c of TV_CHANNELS) {
        const b = el('button', 'chip tv-chip', `${c.icon} ${esc(c.name)}`);
        b.dataset.ch = c.id;
        b.dataset.act = 'tv-ch-' + c.id;
        b.onclick = () => setCh(c.id);
        chipsEl.appendChild(b);
      }
      capEl = el('div', 'tv-cap');
      progEl = el('div', 'tv-prog');
      side.append(chipsEl, capEl, progEl);
      wrap.append(left, side);
      body.appendChild(wrap);
    },
    foot: [
      {
        text: '⏻ Выключить',
        act: 'tv-off',
        fn: (p) => {
          if (item) {
            if (!scene || scene.owned) setFurnOn(item, false);
            else item.on = false;
          }
          p.close();
        },
      },
      { text: 'Смотреть потом', act: 'tv-close', cls: 'ghost', fn: (p) => p.close() },
    ],
    onClose() {
      st.closed = true;
      cancelAnimationFrame(st.raf);
      window.removeEventListener('resize', onResize);
      st.cache.clear();
      cur = null;
    },
  });
  panel.refresh();
  window.addEventListener('resize', onResize);
  setCh(st.ch, true);
  fit();
  requestAnimationFrame(() => {
    fit();
    draw();
  });
  cur = {
    panel,
    st,
    info,
    setCh,
    /** Для автотеста: выпуск «У плиты» почти досмотрен (осталась доля left). */
    skip(left = 0.02) {
      st.prog = Math.max(st.prog, 1 - left);
    },
  };
  return cur;
}

register('tv', (p, ctx) => openTv(ctx || {}), 'телевизор: окно с передачами (мебель — ctx: { scene, item })');

/** Для автотеста: открытое окно телевизора ({ panel, st, info(), setCh(id), skip() }) или null. */
export const tvDebug = () => cur;
