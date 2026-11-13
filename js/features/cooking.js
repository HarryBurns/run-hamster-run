// Готовка, холодильник, еда.
import { addItem, award } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { emit } from '../core/events.js';
import { register } from '../core/registry.js';
import { G, count, canCook } from '../core/state.js';
import { el, plural } from '../core/util.js';
import { ING_BY_ID, DISHES, DISH_BY_ID, SECRET_RECIPES } from '../data/index.js';
import { openPanel, message } from '../ui/panel.js';
import { toast } from '../ui/toast.js';

const S = () => G.state;

function needsHtml(d) {
  return Object.entries(d.needs)
    .map(([id, n]) => {
      const have = count('ing', id),
        ing = ING_BY_ID[id];
      return `<span class="need ${have >= n ? '' : 'no'}" title="${ing.name}">${ing.e} ${ing.name} ${have}/${n}</span>`;
    })
    .join('');
}

export function openCooking() {
  openPanel({
    title: 'Плита',
    icon: '🍳',
    cls: '',
    render(body, tab, panel) {
      body.appendChild(el('p', 'muted', 'Выбери рецепт. Продукты — в ТЦ «Вкусный», на грядках и на рыбалке.'));
      const known = DISHES.filter((d) => d.needs && S().recipes.includes(d.id));
      known.sort((a, b) => canCook(b) - canCook(a));
      for (const d of known) {
        const ok = canCook(d);
        const li = el('div', 'list-item');
        li.appendChild(el('div', 'e', `<span style="font-size:38px">${d.e}</span>`));
        li.appendChild(el('div', 'grow', `<div class="ttl">${d.name}</div><div>${needsHtml(d)}</div>`));
        const b = el('button', 'btn small ' + (ok ? 'green' : 'ghost'), 'Готовить');
        b.disabled = !ok;
        b.onclick = () => {
          sfx('tap');
          cookStep(d, panel);
        };
        li.appendChild(b);
        body.appendChild(li);
      }
      const secret = SECRET_RECIPES.filter((id) => !S().recipes.includes(id)).length;
      if (secret)
        body.appendChild(
          el(
            'p',
            'muted center',
            `❓ Ещё ${secret} ${plural(secret, 'секретный рецепт', 'секретных рецепта', 'секретных рецептов')} знают твои друзья. Подружись с ними!`,
          ),
        );
    },
  });
}

function cookStep(d, parent) {
  let pos = 0,
    dir = 1,
    raf = 0,
    last = performance.now(),
    done = false;
  const speed = 0.9 + Math.random() * 0.3;
  const p = openPanel({
    title: `Готовим: ${d.name}`,
    icon: d.e,
    cls: 'narrow',
    sticky: true,
    render(body) {
      body.innerHTML = `<div class="center big-emoji">${d.e}</div><p class="center">Сними с плиты, когда стрелка в <b style="color:#2f9e44">зелёной</b> зоне!</p>
        <div class="cookbar"><div class="zone" style="left:34%;width:32%"></div><div class="zone best" style="left:44%;width:12%"></div><div class="mark"></div></div>`;
      const mark = body.querySelector('.mark');
      const loop = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        pos += dir * speed * dt;
        if (pos > 1) {
          pos = 1;
          dir = -1;
        }
        if (pos < 0) {
          pos = 0;
          dir = 1;
        }
        mark.style.left = pos * 100 + '%';
        if (!done) raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    },
    foot: [
      {
        text: '🔥 Снять с плиты!',
        cls: 'big green',
        fn: (pp) => {
          if (done) return;
          done = true;
          cancelAnimationFrame(raf);
          for (const [id, n] of Object.entries(d.needs)) addItem('ing', id, -n);
          const perfect = pos >= 0.44 && pos <= 0.56,
            good = pos >= 0.34 && pos <= 0.66;
          const n = perfect ? 3 : good ? 2 : 1;
          addItem('dishes', d.id, n);
          sfx(perfect ? 'win' : 'ok');
          emit('cook', { dish: d.id, perfect });
          if (perfect) award('x_master', { delay: 600 });
          pp.close();
          message({
            title: perfect ? 'Шедевр!' : good ? 'Очень вкусно!' : 'Готово!',
            icon: d.e,
            html: `<div class="center big-emoji">${d.e}</div><p class="center">${perfect ? 'Идеально! Получилось целых 3 порции.' : good ? 'Отлично получилось — 2 порции.' : 'Чуть-чуть подгорело, но одна порция вышла что надо.'}<br>Блюдо лежит в холодильнике.</p>`,
          }).then(() => parent.refresh());
        },
      },
    ],
    onClose: () => {
      done = true;
      cancelAnimationFrame(raf);
    },
  });
  return p;
}

export function eat(id) {
  const d = DISH_BY_ID[id];
  addItem('dishes', id, -1);
  sfx('eat');
  toast(`Ням-ням! ${d.e} ${d.name}`, 'good');
  emit('happy'); // сцена-дом, если мы в ней, покажет радость
  emit('eat');
}

export function dishGrid(body, panel, onPick, btnText = 'Съесть') {
  const ids = Object.keys(S().dishes);
  if (!ids.length) {
    body.appendChild(el('p', 'muted center', 'Пока пусто. Приготовь что-нибудь на плите или купи в кафе!'));
    return;
  }
  const grid = el('div', 'grid');
  for (const id of ids) {
    const d = DISH_BY_ID[id];
    if (!d) continue;
    const card = el('div', 'card');
    card.appendChild(el('div', 'e', d.e));
    card.appendChild(el('div', 'nm', d.name));
    card.appendChild(el('span', 'cnt', '×' + S().dishes[id]));
    const b = el('button', 'btn small green', btnText);
    b.onclick = () => {
      onPick(id);
      if (panel && !panel.closed) panel.refresh();
    };
    card.appendChild(b);
    grid.appendChild(card);
  }
  body.appendChild(grid);
}

export function ingGrid(body) {
  const ids = Object.keys(S().ing);
  if (!ids.length) {
    body.appendChild(el('p', 'muted center', 'Продуктов нет. Загляни в ТЦ «Вкусный»!'));
    return;
  }
  const grid = el('div', 'grid small');
  for (const id of ids) {
    const i = ING_BY_ID[id];
    if (!i) continue;
    const card = el('div', 'card');
    card.appendChild(el('div', 'e', i.e));
    card.appendChild(el('div', '', i.name));
    card.appendChild(el('span', 'cnt', '×' + S().ing[id]));
    grid.appendChild(card);
  }
  body.appendChild(grid);
}

export function openFridge() {
  openPanel({
    title: 'Холодильник',
    icon: '🧊',
    tabs: [
      { id: 'dishes', name: '🍰 Блюда' },
      { id: 'ing', name: '🥕 Продукты' },
    ],
    render(body, tab, panel) {
      if (tab === 'dishes') dishGrid(body, panel, eat);
      else ingGrid(body);
    },
  });
}

export function pickDish(title) {
  return new Promise((resolve) => {
    let chosen = null;
    openPanel({
      title,
      icon: '🍽️',
      render(body, tab, panel) {
        dishGrid(
          body,
          panel,
          (id) => {
            chosen = id;
            panel.close();
          },
          'Выбрать',
        );
      },
      onClose: () => resolve(chosen),
    });
  });
}

register('cook', () => openCooking(), 'плита');

register('fridge', () => openFridge(), 'холодильник');
