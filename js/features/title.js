// Заставка: название, «Продолжить», «Мои игры», «Новая игра». Сцена за кнопками — features/title_scene.js,
// хранение нескольких игр — core/games.js. Игру запускает main.js: сюда приходит start(fresh).
import { G, cal } from '../core/state.js';
import {
  MAX_GAMES,
  syncGames,
  listGames,
  activeGame,
  openActive,
  switchGame,
  createGame,
  deleteGame,
} from '../core/games.js';
import { el, esc, fmtMoney } from '../core/util.js';
import { makeCanvas } from '../core/draw.js';
import { drawPortrait } from '../art/hamster.js';
import { resolveLook, defaultLook, monthOfDay, SEASON_OF_MONTH } from '../data/index.js';
import { sfx, unlockAudio } from '../core/audio.js';
import { openPanel, message } from '../ui/panel.js';
import { createTitleScene } from './title_scene.js';

export const GAME_NAME = 'Пушистая жизнь';
const HOLD_MS = 1300; // сколько держать «Да, удалить»

/** Наряд для портрета и заставки; если в записи что-то не так — хомячок по умолчанию. */
function lookOf(look) {
  try {
    if (look) return resolveLook(look);
  } catch (e) {
    /* вещи из сохранения игра не знает — покажем обычного хомячка */
  }
  // игр ещё нет: летний наряд к летнему дню на заставке
  const d = defaultLook();
  return resolveLook({
    ...d,
    outfit: { ...d.outfit, head: 'sunhat', body: 'dress_sea' },
    beauty: { ...d.beauty, bow: '#ff5c8a' },
  });
}
function portrait(look, size) {
  const { canvas, ctx } = makeCanvas(size, size);
  canvas.className = 'g-face';
  try {
    drawPortrait(ctx, size / 2, size / 2, size, lookOf(look));
  } catch (e) {
    /* портрет не главное */
  }
  return canvas;
}
/** «Июнь, 2-й день · 1-й год» */
function dateOf(g) {
  const c = cal({ day: g.day || 0, minutes: g.minutes || 0 });
  return `${c.monthName}, ${c.dom}-й день · ${c.year}-й год`;
}

let current = null; // открытая заставка: { scene } — для автотеста (window.__dev.title)
export const titleDebug = () => current;

/** Показать заставку. start(fresh) — запустить игру, которая уже лежит в G.state. */
export function openTitle({ start }) {
  const t = el('div');
  t.id = 'title';
  const cv = el('canvas', 't-scene');
  const head = el('div', 't-head');
  head.appendChild(el('h1', '', GAME_NAME));
  head.appendChild(el('div', 'sub', 'Большая жизнь маленького хомячка'));
  const menu = el('div', 't-menu');
  t.append(cv, head, menu);
  document.body.appendChild(t);
  t.addEventListener('pointerdown', unlockAudio, { passive: true });

  let res = openActive(); // { ok, problem }: G.state — последняя игра (если она есть и читается)
  let scene = null,
    sceneKey = '';
  /** Свободное место для сцены: всё, что не под заголовком и не под кнопками. */
  const free = () => {
    const r = t.getBoundingClientRect(),
      h = head.getBoundingClientRect(),
      mn = menu.getBoundingClientRect();
    const side = mn.height > r.height * 0.6 || mn.left > r.width * 0.5; // кнопки сбоку (экран лежит)
    const top = Math.min(h.bottom - r.top, r.height * 0.4);
    return side
      ? { x: 0, y: top, w: Math.max(160, mn.left - r.left - 8), h: r.height - top }
      : { x: 0, y: top, w: r.width, h: Math.max(160, mn.top - r.top - top - 6) };
  };
  /** Сцена показывает время суток и погоду последней игры; игр нет — солнечный летний день. */
  function showScene() {
    const s = res.ok ? G.state : null;
    const env = s
      ? { minutes: s.minutes, weather: s.weather, season: SEASON_OF_MONTH[monthOfDay(s.day)], look: lookOf(s.look) }
      : { minutes: 12 * 60, weather: 'sun', season: 'summer', look: lookOf(null) };
    const key = JSON.stringify([env.minutes, env.weather, env.season, s && s.look]);
    if (scene && key === sceneKey) return scene.relayout();
    if (scene) scene.destroy();
    sceneKey = key;
    scene = createTitleScene(cv, { ...env, free });
    current = { scene };
  }

  function close(fresh) {
    scene.destroy();
    current = null;
    t.remove();
    unlockAudio();
    sfx('win');
    start(fresh);
  }

  // ---------- кнопки ----------
  function render(mode) {
    menu.innerHTML = '';
    const games = listGames();
    if (mode === 'form' || (!games.length && !res.ok)) {
      menu.dataset.mode = 'form';
      if (res.problem === 'broken' && !games.length)
        menu.appendChild(
          el(
            'div',
            'sub',
            '<small>Старую игру не получилось открыть 😿<br>Мы её не выбросили, а отложили про запас.</small>',
          ),
        );
      menu.appendChild(el('div', 'sub', 'Как зовут твою хомячку?'));
      const inp = el('input');
      inp.maxLength = 14;
      inp.value = 'Хомка';
      inp.setAttribute('aria-label', 'Имя');
      const b = el('button', 'btn big green', 'Играть! ▶');
      b.onclick = () => {
        const why = createGame((inp.value || '').trim() || 'Хомка');
        if (why) return noRoom(why);
        close(true);
      };
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') b.click();
      });
      menu.append(inp, b);
      if (games.length) {
        const back = el('button', 'btn ghost', '← Назад');
        back.onclick = () => {
          sfx('tap');
          render('main');
        };
        menu.appendChild(back);
      }
    } else {
      menu.dataset.mode = 'main';
      if (res.ok) {
        menu.appendChild(el('div', 'sub', `С возвращением, ${esc(G.state.name)}!`));
        const b1 = el('button', 'btn big green', 'Продолжить ▶');
        b1.onclick = () => close(false);
        menu.appendChild(b1);
      } else if (res.problem === 'newer') {
        // сохранение от более новой версии игры: не трогаем, предлагаем обновить страницу
        menu.appendChild(
          el('div', 'sub', 'Игра обновилась, а страница — ещё нет.<br>Нажми «Обновить», чтобы продолжить свою игру.'),
        );
        const b1 = el('button', 'btn big green', 'Обновить 🔄');
        b1.onclick = () => location.reload();
        menu.appendChild(b1);
      } else if (res.problem === 'broken')
        menu.appendChild(el('div', 'sub', 'Последнюю игру не получилось открыть 😿'));
      const row = el('div', 't-row');
      const b2 = el('button', 'btn blue', '📒 Мои игры');
      b2.onclick = () => {
        sfx('tap');
        openGames();
      };
      const b3 = el('button', 'btn ghost', '✨ Новая игра');
      b3.onclick = () => {
        sfx('tap');
        askNew();
      };
      row.append(b2, b3);
      menu.appendChild(row);
    }
    showScene();
  }
  /** После удаления или неудачи: заново открыть последнюю игру и перерисовать кнопки. */
  function reopen() {
    res = openActive();
    render('main');
  }
  function noRoom(why) {
    if (why === 'full')
      return message({
        title: 'Все места заняты',
        icon: '🏠',
        html: `<p class="center big-emoji">🐹🐹🐹</p><p class="center">У тебя уже <b>${MAX_GAMES} игр</b> — больше не помещается.</p>
          <p class="center">Чтобы начать новую, сначала удали одну из старых: открой <b>«Мои игры»</b>, нажми <b>⋯</b> на карточке и выбери «Удалить игру».</p>`,
        buttons: [{ text: '📒 Мои игры' }, { text: 'Понятно', cls: 'ghost' }],
      }).then((i) => {
        if (i === 0) openGames();
      });
    return message({
      title: 'Не получилось',
      icon: '😿',
      html: '<p class="center">Новую игру не удалось записать — в памяти браузера нет места. Старые игры целы.</p><p class="center">Можно удалить одну из игр в «Моих играх» и попробовать ещё раз.</p>',
    });
  }
  function askNew() {
    syncGames();
    if (listGames().length >= MAX_GAMES) return noRoom('full');
    render('form');
  }

  // ---------- «Мои игры» ----------
  function openGames() {
    const opened = {}; // у каких карточек открыто «⋯»
    openPanel({
      title: 'Мои игры',
      icon: '📒',
      cls: 'narrow',
      render(body, tab, panel) {
        const games = listGames();
        const list = el('div', 'g-list');
        for (const g of games) {
          const card = el('div', 'g-card');
          card.dataset.id = g.id;
          const info = el(
            'div',
            'g-info',
            `<b>${esc(g.name || 'Хомка')}</b>${g.id === activeGame() ? ' <span class="g-last">последняя</span>' : ''}
             <span>📅 ${dateOf(g)}</span><span>🪙 ${fmtMoney(g.money || 0)}</span>`,
          );
          const play = el('button', 'btn green small g-play', 'Открыть ▶');
          play.onclick = () => {
            if (!switchGame(g.id)) {
              panel.close();
              reopen();
              return message({
                title: 'Не получилось',
                icon: '😿',
                html: `<p class="center">Игру «${esc(g.name)}» не удалось открыть. Остальные игры целы.</p>`,
              });
            }
            res = { ok: true, problem: null };
            panel.close();
            close(false);
          };
          const more = el('button', 'btn ghost small g-more', '⋯');
          more.setAttribute('aria-label', 'Ещё');
          more.onclick = () => {
            sfx('tap');
            opened[g.id] = !opened[g.id];
            panel.refresh();
          };
          card.append(portrait(g.look, 64), info, play, more);
          if (opened[g.id]) {
            const extra = el('div', 'g-extra');
            const rm = el('button', 'btn ghost small g-del', '🗑️ Удалить игру…');
            rm.onclick = () => {
              sfx('tap');
              askDelete(g, panel);
            };
            extra.appendChild(rm);
            card.appendChild(extra);
          }
          list.appendChild(card);
        }
        body.appendChild(list);
        body.appendChild(el('p', 'center muted', `Игр: ${games.length} из ${MAX_GAMES}. Каждая сохраняется сама.`));
      },
      foot: [
        {
          text: '✨ Новая игра',
          cls: 'yellow',
          fn: (p) => {
            p.close();
            askNew();
          },
        },
      ],
    });
  }
  /** Удаление — только нарочно: отдельное окно с именем, а кнопку «Да, удалить» нужно подержать. */
  function askDelete(g, listPanel) {
    let timer = 0;
    const p = openPanel({
      title: 'Удалить игру?',
      icon: '🗑️',
      cls: 'narrow',
      sticky: true,
      render(body) {
        const top = el('div', 'g-ask');
        top.append(
          portrait(g.look, 96),
          el(
            'p',
            'center',
            `Удалить игру, где живёт <b>${esc(g.name || 'Хомка')}</b>?<br><span class="muted">${dateOf(g)} · 🪙 ${fmtMoney(g.money || 0)}</span>`,
          ),
          el('p', 'center', 'Пропадёт всё: наряды, мебель, друзья и наклейки. Вернуть будет нельзя.'),
        );
        const keep = el('button', 'btn big green', 'Нет, оставить 💛');
        keep.onclick = () => p.close();
        const del = el('button', 'btn ghost g-hold', '<i></i><span>Да, удалить (нажми и держи)</span>');
        const stop = () => {
          clearTimeout(timer);
          del.classList.remove('on');
        };
        del.style.setProperty('--hold', HOLD_MS + 'ms');
        del.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          stop();
          del.classList.add('on');
          timer = setTimeout(() => {
            stop();
            deleteGame(g.id);
            sfx('paper');
            p.close();
            if (!listGames().length) listPanel.close();
            else listPanel.refresh();
            reopen();
          }, HOLD_MS);
        });
        for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) del.addEventListener(ev, stop);
        del.addEventListener('contextmenu', (e) => e.preventDefault());
        top.append(keep, del);
        body.appendChild(top);
      },
      onClose: () => clearTimeout(timer),
    });
  }

  render('main');
  // шрифты и размеры кнопок могли доехать позже — расставить сцену ещё раз
  requestAnimationFrame(() => current && current.scene === scene && scene.relayout());
}
