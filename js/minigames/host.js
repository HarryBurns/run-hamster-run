// Рамка для мини-игр: заставка с правилами → игра → экран со звёздами.
//
// Каждая мини-игра — модуль с `export default { id, title, icon, howTo, start(host) }`.
// start(host) строит игру внутри host.root и возвращает { stop() } — остановить таймеры/анимации.
// Когда игра закончена, она вызывает host.finish({ stars: 1..3, text: 'итог', extra: {...} }).
// Поле `css` модуля — стиль игры: хост ставит его один раз (для правил и для игры) и убирает при закрытии.
// Общий набор (kit.js): host.later / cancel, host.loop, host.on, host.add, host.css, host.pops — всё это хост
// снимает сам, когда игра закончена или закрыта; stop() нужен только для своего, особого.
import { drawHamster } from '../art/hamster.js';
import { sfx } from '../core/audio.js';
import { el } from '../core/util.js';
import { makeKit, makePops } from './kit.js';

const LOADERS = {
  swim: () => import('./swim.js'),
  fishing: () => import('./fishing.js'),
  teacher: () => import('./teacher.js'),
  doctor: () => import('./doctor.js'),
  chef: () => import('./chef.js'),
  fashion: () => import('./fashion.js'),
  barista: () => import('./barista.js'),
  stylist: () => import('./stylist.js'),
  window: () => import('./window.js'),
  mushrooms: () => import('./mushrooms.js'), // лес: «Грибная охота» у лесника Шишкина
  sled: () => import('./sled.js'), // гора: «Спуск с горы» у инструктора Вершинкина
  crystals: () => import('./crystals.js'), // пещеры: «Кристаллы» у шахтёра Камушкина
  dig: () => import('./dig.js'), // пустыня: «Раскопки» у кочевника Бархана
  pairs: () => import('./pairs.js'), // пустыня: загадка пирамиды «Пары»
  vines: () => import('./vines.js'), // джунгли: «Лианы» у исследовательницы Лианы
  glyphs: () => import('./glyphs.js'), // джунгли: «Узор храма» в руинах
  sandcastle: () => import('./sandcastle.js'), // секретный пляж: «Замок из песка» у русалочки Жемчужинки
  bowling: () => import('./bowling.js'), // удалённый остров: «Кокосовый боулинг» у Вождя Кокоса
  slide: () => import('./slide.js'), // курортный отель: «Горка» — водная горка на крыше
  porter: () => import('./porter.js'), // курортный отель: «Носильщица» — работа у носильщика Тележкина
  tug: () => import('./tug.js'), // праздники: «Перетягивание каната» на Масленицу (канат на ярмарке)
  splash: () => import('./splash.js'), // праздники: «Водяная битва» на Ивана Купалу (вёдра на пляже)
  mimic: () => import('./mimic.js'), // курортный отель: «Повтори движение» у аниматора Хлопушки — этап 14
  volley: () => import('./volley.js'), // отдых в городе: «Пляжный волейбол» у сетки на пляже (этап 17а)
  drum: () => import('./drum.js'), // удалённый остров: «Танец у костра» под барабан Бума — этап 14
  tree: () => import('./tree.js'), // праздники: «Нарядим ёлку!» на Новый год (ёлка на площади) — этап 14
  hairdresser: () => import('./hairdresser.js'), // салон красоты: «Парикмахер» — работа для всех, этап 17в
  lifeguard: () => import('./lifeguard.js'), // городской пляж: «Спасатель» на вышке у моря, этап 17в
  gardener: () => import('./gardener.js'), // парк: «Садовник» у садовой тележки Мяты, этап 17в
};
/** Есть ли такая мини-игра. */
export const hasMinigame = (id) => !!LOADERS[id];

/** Подгрузить модули мини-игр заранее: тогда пропавшая сеть не помешает их открыть. */
export function preloadMinigames() {
  for (const load of Object.values(LOADERS))
    load().catch(() => {
      /* попробуем ещё раз при открытии */
    });
}

/**
 * @param id    id мини-игры
 * @param info  { look, name, friends:[{name, look}], season, level, ...что угодно для игры }
 *              introNote — HTML под правилами на заставке (например, сколько заплатят за работу);
 *              resultNote(stars) — HTML под итогом на экране результата (сколько заработано)
 * @returns Promise<{stars, text, extra} | null>  (null — игрок закрыл игру)
 */
export async function runMinigame(id, info) {
  const mod = (await LOADERS[id]()).default;
  return new Promise((resolve) => {
    const wrap = el('div');
    wrap.id = 'mg';
    const head = el('div', 'mg-head', `<span>${mod.icon || '🎮'}</span><span class="title">${mod.title}</span>`);
    const close = el('button', 'xbtn', '✕');
    head.appendChild(close);
    const root = el('div', 'mg-root');
    wrap.append(head, root);
    document.body.appendChild(wrap);

    let game = null,
      ended = false,
      result = null; // итог игры: есть с момента, когда показан экран со звёздами
    // кадр игры падает снова и снова — закрываем её (без награды), а не оставляем замёрзшую картинку
    const kit = makeKit(() => end(null));
    const cleanup = () => {
      try {
        game && game.stop && game.stop();
      } catch (e) {
        console.error(e);
      }
      game = null;
      kit.dispose();
    };
    const end = (res) => {
      if (ended) return;
      ended = true;
      cleanup();
      wrap.remove();
      resolve(res);
    };
    close.onclick = () => {
      sfx('tap');
      end(result); // крестик на экране со звёздами — то же, что «Ура!»: результат (и зарплата) не пропадают
    };

    // act — метка кнопки для автотеста (data-act: start — «Начать!», done — «Ура!»): текст кнопок меняют ради ребёнка
    const card = (html, btnText, onBtn, act) => {
      const c = el('div', 'mg-card');
      // текст — в своей прокрутке, кнопка — под ним, а не поверх (на низком экране текст не прячется под «Начать!»)
      const p = el('div', 'panel narrow');
      p.appendChild(el('div', 'mg-text', html));
      const b = el('button', 'btn big green', btnText);
      b.dataset.act = act;
      b.onclick = () => {
        sfx('tap');
        c.remove();
        onBtn();
      };
      p.appendChild(b);
      c.appendChild(p);
      root.appendChild(c);
    };

    const host = {
      root,
      look: info.look,
      name: info.name || 'Хомячок',
      friends: info.friends || [],
      season: info.season || 'summer',
      level: info.level || 0,
      info,
      drawHamster,
      sfx,
      /** Таймер, который хост снимет сам; на скрытой вкладке стоит. Возвращает id для host.cancel. */
      later: kit.later,
      cancel: kit.cancel,
      /** Цикл кадра: fn(dt, time, ts) — шаг (с, ≤ 0,05), время игры (с, без скрытой вкладки), метка rAF. */
      loop: kit.loop,
      /** Слушатель события, который хост снимет сам. */
      on: kit.on,
      /** Положить элементы в root; при закрытии игры уберутся сами. Возвращает первый. */
      add: (...els) => kit.add(root, ...els),
      /** Стиль на время игры (один раз на текст). */
      css: (text) => kit.css(wrap, text),
      /** Всплывающие надписи (kit.js, makePops). */
      pops: makePops,
      /** Canvas на весь root, сам подстраивается под размер. draw-код работает в CSS-пикселях: cv.w × cv.h */
      canvas() {
        const canvas = document.createElement('canvas');
        canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;touch-action:none';
        root.appendChild(canvas);
        const cv = { canvas, ctx: canvas.getContext('2d'), w: 0, h: 0, dpr: 1 };
        const fit = () => {
          const r = root.getBoundingClientRect();
          cv.dpr = Math.min(window.devicePixelRatio || 1, 2);
          cv.w = Math.max(1, r.width);
          cv.h = Math.max(1, r.height);
          canvas.width = Math.round(cv.w * cv.dpr);
          canvas.height = Math.round(cv.h * cv.dpr);
          cv.ctx.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0);
        };
        fit();
        const ro = new ResizeObserver(fit);
        ro.observe(root);
        cv.destroy = () => ro.disconnect();
        kit.onDispose(cv.destroy);
        return cv;
      },
      finish(res) {
        if (ended) return;
        cleanup();
        const stars = Math.max(1, Math.min(3, Math.round(res.stars || 1)));
        sfx(stars === 3 ? 'win' : 'ok');
        const st = [1, 2, 3].map((i) => `<span class="${i <= stars ? '' : 'off'}">⭐</span>`).join('');
        const head2 = ['', 'Хорошо!', 'Здорово!', 'Великолепно!'][stars];
        result = { ...res, stars };
        const note = info.resultNote ? info.resultNote(stars) || '' : '';
        card(
          `<div class="stars">${st}</div><h2 style="margin:4px 0">${head2}</h2><p>${res.text || ''}</p>${note}`,
          'Ура!',
          () => end(result),
          'done',
        );
      },
    };

    if (mod.css) kit.css(wrap, mod.css);
    card(
      `<div class="big-emoji mg-icon">${mod.icon || '🎮'}</div><h2 class="mg-icon" style="margin:4px 0">${mod.title}</h2><p>${mod.howTo || ''}</p>${info.introNote || ''}`,
      'Начать!',
      () => {
        try {
          game = mod.start(host) || null;
        } catch (e) {
          console.error(e);
          end(null);
        }
      },
      'start',
    );
  });
}
