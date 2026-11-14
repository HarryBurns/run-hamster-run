// Запуск игры: собирает вместе сцены, HUD и заставку. Имён сцен здесь нет нигде, кроме их регистрации.
import { G, newGame, load, loadProblem, backupSave, repair, hasSave, wipe, unload } from './core/state.js';
import { mutate, award, addItem, setFlag } from './core/actions.js';
import {
  startLoop,
  registerScene,
  scenes,
  go,
  scene,
  every,
  persist,
  dropScene,
  resetFailures,
  safely,
} from './core/loop.js';
import { el, esc, fmtMoney } from './core/util.js';
import { makeCanvas } from './core/draw.js';
import { drawHamster, blinkAt } from './art/hamster.js';
import { resolveLook, START_OUTFIT, defaultLook, START_MONEY } from './data/index.js';
import { sfx, unlockAudio } from './core/audio.js';
import { message, confirmBox } from './ui/panel.js';
import { toast } from './ui/toast.js';
import { initHud, buildHud, updateHud } from './ui/hud.js';
import town from './locations/town.js';
import demoMeadow from './locations/demo_meadow.js';
import { createSideScene } from './engine/side/scene.js';
import villa from './interiors/villa.js';
import demoHouse from './interiors/demo_house.js';
import TowerScene from './interiors/tower.js';
import DiveScene from './interiors/dive.js';
import * as F from './features/index.js';
import { preloadMinigames } from './minigames/host.js';
import { installDevHooks } from './devhooks.js';

const canvas = document.getElementById('game');
const hud = document.getElementById('hud');

// Сцены игры. Локации — описания (locations/*.js) для «движка локаций», дома — описания (interiors/*.js)
// для «движка домов».
for (const loc of [town, demoMeadow]) registerScene(loc.name, loc); // demo_meadow — пробная, входа в игре нет
registerScene('tower', TowerScene);
registerScene('dive', DiveScene);
for (const house of [villa, demoHouse]) registerScene(house.id, createSideScene(house)); // demo_house — пробный, входа в игре нет
const HOME = villa.id; // сцена-дом: туда ведёт кнопка «Домой», там начинается игра

// ---------- HUD ----------
async function goHome() {
  const yes = await confirmBox(
    'Домой?',
    '<p class="center">Вернуться на виллу прямо сейчас?</p>',
    'Да, домой 🏡',
    'Нет',
  );
  if (yes) go(HOME);
}
initHud(hud, {
  right: [
    { icon: '🎒', label: 'Рюкзак', fn: F.openBackpack },
    { icon: '📖', label: 'Альбом', fn: F.openAlbum },
    { icon: '📱', label: 'Гости', fn: F.openPhone },
    { icon: '⚙️', label: 'Меню', fn: F.openSettings },
  ],
  task: { info: F.taskChip, fn: F.showLetter },
  map: { icon: '🗺️', label: 'Карта', fn: F.openMap },
  home: { icon: '🏡', label: 'Домой', fn: goHome },
});

/** Игра спотыкается в каждом кадре: честно сказать об этом и предложить выход. */
function showBroken() {
  message({
    title: 'Ой! Что-то сломалось',
    icon: '🛠️',
    sticky: true,
    html: '<p class="center big-emoji">🙈</p><p class="center">Игра споткнулась. Давай вернёмся домой — там всё починится. Твои вещи и друзья на месте!</p>',
    buttons: [{ text: 'Домой 🏡' }, { text: 'Перезапустить игру', cls: 'ghost' }],
  }).then((i) => {
    if (i === 1) {
      location.reload();
      return;
    }
    resetFailures(); // если не помогло — окно появится снова
    safely(() => {
      const sc = scene();
      if (sc && sc.leave) sc.leave();
    });
    dropScene(); // чтобы go() не звал leave() сломанной сцены второй раз
    safely(() => {
      mutate((s) => repair(s));
      if (!G.state.mail) F.newDayMail();
      go(HOME, { pos: { scene: HOME, floor: 0, x: 290 } });
    });
  });
}

// ---------- заставка ----------
function startGame(fresh) {
  buildHud();
  F.initEvents();
  const s = G.state;
  if (!s.mail) F.newDayMail();
  // новая игра — просыпаемся дома; продолжение — там, где остановились (если такой сцены нет — дома)
  if (fresh) go(HOME, { wake: true });
  else go(s.pos && scenes[s.pos.scene] ? s.pos.scene : HOME, { pos: s.pos });
  updateHud();
  setTimeout(preloadMinigames, 5000); // в простое, не мешая началу игры
  // пианино в подарок (один раз), чтобы было на чём играть
  if (!s.flags.pianoGift) {
    setFlag('pianoGift');
    if (!s.villa.some((i) => i.id === 'piano') && !s.storage.piano) {
      addItem('storage', 'piano', 1);
      setTimeout(
        () => toast('🎹 В кладовке появилось пианино! Дома нажми 🔨 и поставь его.', 'good'),
        fresh ? 9000 : 1500,
      );
    }
  }
  if (!fresh) F.showBankLetter(); // после переноса старого сохранения — письмо банка (один раз)
  if (fresh) {
    award('x_first', { quiet: true });
    message({
      title: 'Добро пожаловать!',
      icon: '🏡',
      sticky: true,
      html: `<p class="center big-emoji">🐹</p><p>Привет, <b>${esc(s.name)}</b>! Это твоя вилла: три этажа, сауна, джакузи и бассейн. А в Хомяк-Банке у тебя <b>🪙 ${fmtMoney(START_MONEY)} монет</b> на первое время.</p>
        <p>На дворе <b>январь</b> и зима ❄️. Рядом — город у моря, там магазины, друзья и приключения.</p>
        <p>🪙 Монеты можно <b>заработать</b>: поработай в школе, больнице или ресторане, выполняй задания из писем, продавай на рынке урожай и рыбу.</p>
        <p>✉️ У входной двери висит <b>почтовый ящик</b> — в нём уже лежит первое письмо. Выходи через дверь на первом этаже!</p>`,
      buttons: [{ text: 'Поехали!' }, { text: '❓ Как играть', cls: 'yellow' }],
    }).then((i) => {
      if (i === 1) F.showHelp();
    });
  }
}
function titleScreen() {
  const t = el('div');
  t.id = 'title';
  const { canvas: cv, ctx: c2 } = makeCanvas(200, 190);
  const look = resolveLook({
    ...defaultLook(),
    outfit: { ...START_OUTFIT },
    beauty: { ...defaultLook().beauty, bow: '#ff5c8a' },
  });
  let raf = 0;
  const t0 = performance.now();
  const loop = () => {
    const tt = (performance.now() - t0) / 1000;
    c2.clearRect(0, 0, 200, 190);
    drawHamster(c2, 100, 172, 1.9, look, {
      time: tt,
      happy: tt % 4 > 3,
      armsUp: tt % 4 > 3 && Math.sin(tt * 10) > 0,
      blink: blinkAt(tt),
    });
    raf = requestAnimationFrame(loop);
  };
  loop();
  const hero = el('div', 'hero');
  hero.appendChild(el('h1', '', 'Run, Hamster, Run!'));
  hero.appendChild(el('div', 'sub', 'Большая жизнь маленького хомячка'));
  hero.appendChild(cv);
  t.appendChild(hero);
  const go = (fresh) => {
    cancelAnimationFrame(raf);
    t.remove();
    unlockAudio();
    sfx('win');
    startGame(fresh);
  };
  const newForm = () => {
    form.innerHTML = '';
    form.appendChild(el('div', 'sub', 'Как зовут твою хомячку?'));
    const inp = el('input');
    inp.maxLength = 14;
    inp.value = 'Хомка';
    inp.setAttribute('aria-label', 'Имя');
    const b = el('button', 'btn big green', 'Играть! ▶');
    b.onclick = () => {
      newGame((inp.value || '').trim() || 'Хомка');
      go(true);
    };
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') b.click();
    });
    form.append(inp, b);
  };
  const form = el('div');
  form.style.cssText = 'display:flex;flex-direction:column;gap:12px;align-items:center';
  if (hasSave() && load()) {
    const b1 = el('button', 'btn big green', `Продолжить ▶`);
    b1.onclick = () => go(false);
    const b2 = el('button', 'btn ghost', 'Новая игра');
    b2.onclick = async () => {
      if (
        await confirmBox(
          'Новая игра?',
          `<p class="center">Сохранённая игра (${esc(G.state.name)}) сотрётся. Начать заново?</p>`,
          'Да',
          'Нет',
        )
      ) {
        wipe();
        unload();
        newForm();
      }
    };
    form.append(el('div', 'sub', `С возвращением, ${esc(G.state.name)}!`), b1, b2);
  } else if (loadProblem === 'newer') {
    // сохранение от более новой версии игры: не затираем, предлагаем обновить страницу
    const b1 = el('button', 'btn big green', 'Обновить 🔄');
    b1.onclick = () => location.reload();
    const b2 = el('button', 'btn ghost', 'Новая игра');
    b2.onclick = async () => {
      if (
        await confirmBox('Новая игра?', '<p class="center">Сохранённая игра сотрётся. Начать заново?</p>', 'Да', 'Нет')
      ) {
        backupSave();
        wipe();
        newForm();
      }
    };
    form.append(
      el('div', 'sub', 'Игра обновилась, а страница — ещё нет.<br>Нажми «Обновить», чтобы продолжить свою игру.'),
      b1,
      b2,
    );
  } else {
    newForm();
    if (loadProblem === 'broken')
      form.prepend(
        el(
          'div',
          'sub',
          '<small>Старую игру не получилось открыть 😿<br>Мы её не выбросили, а отложили про запас.</small>',
        ),
      );
  }
  t.appendChild(form);
  document.body.appendChild(t);
}

every(0.25, F.updateSound, { needScene: false });
every(1, updateHud);
every(20, persist);
installDevHooks({ F });
titleScreen();
startLoop(canvas, { onBroken: showBroken, onGesture: unlockAudio });
