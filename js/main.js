// Запуск игры: собирает вместе сцены, HUD и заставку. Имён сцен здесь нет нигде, кроме их регистрации.
import {
  G,
  newGame,
  load,
  loadProblem,
  backupSave,
  repair,
  hasSave,
  wipe,
  unload,
  cal,
  darkness,
} from './core/state.js';
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
import { el, esc } from './core/util.js';
import { makeCanvas } from './core/draw.js';
import { drawHamster, blinkAt } from './art/hamster.js';
import { resolveLook, START_OUTFIT, defaultLook } from './data.js';
import {
  sfx,
  unlockAudio,
  isMuted,
  setMuted,
  isMusicOn,
  setMusicOn,
  getMusicVolume,
  setMusicVolume,
  setMusic,
  setAmbience,
} from './core/audio.js';
import { openPanel, message, confirmBox } from './ui/panel.js';
import { toast } from './ui/toast.js';
import { initHud, buildHud, updateHud } from './ui/hud.js';
import WorldScene from './locations/town.js';
import VillaScene from './villa.js';
import TowerScene from './interiors/tower.js';
import DiveScene from './interiors/dive.js';
import * as F from './features.js';
import './piano.js';
import { preloadMinigames } from './minigames/host.js';
import { installDevHooks } from './devhooks.js';

const canvas = document.getElementById('game');
const hud = document.getElementById('hud');

registerScene('world', WorldScene);
registerScene('villa', VillaScene);
registerScene('tower', TowerScene);
registerScene('dive', DiveScene);
const HOME = 'villa'; // сцена-дом: туда ведёт кнопка «Домой», там начинается игра

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
    { icon: '⚙️', label: 'Меню', fn: openSettings },
  ],
  task: { info: F.taskChip, fn: F.showLetter },
  map: { icon: '🗺️', label: 'Карта', fn: F.openMap },
  home: { icon: '🏡', label: 'Домой', fn: goHome },
});

function openSettings() {
  openPanel({
    title: 'Меню',
    icon: '⚙️',
    cls: 'narrow',
    render(body, tab, panel) {
      const c = cal();
      body.appendChild(
        el(
          'p',
          'center',
          `<b>${esc(G.state.name)}</b> · ${c.year}-й год на вилле<br><span class="muted">Игра сохраняется сама.</span>`,
        ),
      );
      const mus = el(
        'button',
        'btn ' + (isMusicOn() ? 'green' : 'ghost'),
        isMusicOn() ? '🎵 Музыка включена' : '🎵 Музыка выключена',
      );
      mus.onclick = () => {
        setMusicOn(!isMusicOn());
        sfx('tap');
        panel.refresh();
      };
      const vol = el(
        'label',
        'vol',
        '<span>🔈</span><input type="range" min="0" max="100" step="5" aria-label="Громкость музыки"><span>🔊</span>',
      );
      const rng = vol.querySelector('input');
      rng.value = Math.round(getMusicVolume() * 100);
      rng.disabled = !isMusicOn();
      rng.oninput = () => setMusicVolume(rng.value / 100);
      const snd = el(
        'button',
        'btn ' + (isMuted() ? 'ghost' : 'blue'),
        isMuted() ? '🔇 Звуки выключены' : '🔊 Звуки включены',
      );
      snd.onclick = () => {
        setMuted(!isMuted());
        sfx('ok');
        panel.refresh();
      };
      const help = el('button', 'btn yellow', '❓ Как играть');
      help.onclick = () => showHelp();
      const reset = el('button', 'btn ghost', '🗑️ Начать заново');
      reset.onclick = async () => {
        if (
          await confirmBox(
            'Начать заново?',
            '<p class="center">Вся игра сотрётся: наряды, мебель, друзья и наклейки. Точно?</p>',
            'Да, стереть',
            'Нет-нет!',
          )
        ) {
          wipe();
          location.reload();
        }
      };
      const col = el('div');
      col.style.cssText = 'display:flex;flex-direction:column;gap:12px;align-items:stretch';
      col.append(mus, vol, snd, help, reset);
      body.appendChild(col);
    },
  });
}
function showHelp() {
  return message({
    title: 'Как играть',
    icon: '❓',
    cls: '',
    html: `<ul class="help">
      <li>👆 <b>Нажми</b> на любое место — хомячок пойдёт туда. На компьютере можно стрелками или WASD, а <b>E</b> — «потрогать» то, что рядом.</li>
      <li>✉️ Каждое утро в <b>почтовом ящике</b> у двери виллы лежит письмо с заданием. За него дают наклейку и иногда подарок.</li>
      <li>⭐ Звёздочка и стрелка показывают, куда идти по заданию. А на <b>🗺️ карте</b> можно нажать на любое место — и хомячок сама туда дойдёт.</li>
      <li>🏡 На вилле нажимай на всё подряд: шкаф, плиту, холодильник, ванну, сауну, джакузи, бассейн, телевизор… Лифт справа возит между этажами.</li>
      <li>🎹 Нажми на <b>пианино</b> — оно откроется во весь экран, и можно играть самой или учить песенки по зелёным клавишам.</li>
      <li>🔨 Кнопка <b>«Обустроить»</b> — перетаскивай мебель, доставай новую из кладовки.</li>
      <li>🛍️ В городе — магазины одежды и мебели, продукты, салон красоты, кафе и мини-игры: бассейн, школа, больница, ресторан, Дом моды.</li>
      <li>⛵ У конца пирса стоит <b>кораблик</b>: нажми на него, чтобы сесть. На нём можно плавать быстро и заплывать <b>за буйки</b> — к дальним островам. Нажми на берег рядом, чтобы сойти.</li>
      <li>🌊 В море можно заплывать далеко, а на глубине — <b>🤿 нырнуть</b>: под водой рыбы, кораллы, жемчужины и затонувший корабль.</li>
      <li>🛏️ Чтобы наступил следующий день, ложись спать в кровать. В месяце 3 дня, сезоны меняются.</li>
      <li>📱 Друзей можно звать в гости и угощать. Подружишься — узнаешь секретные рецепты!</li></ul>`,
    buttons: [{ text: 'Понятно!' }],
  });
}

// ---------- какая музыка и какие звуки вокруг ----------
// Сцена сама говорит, что в ней слышно: scene.sound() → { force, day, sea, rain, birds, crickets }.
function updateSound() {
  const sc = scene();
  const playing = G.state && sc && !document.getElementById('title');
  if (!playing) {
    setMusic('title');
    setAmbience({ sea: 0, rain: 0, birds: false, night: false });
    return;
  }
  if (document.getElementById('piano')) {
    setMusic(null);
    setAmbience({ sea: 0, rain: 0, birds: false, night: false });
    return;
  } // за пианино фоновая музыка молчит
  const mg = !!document.getElementById('mg'),
    c = cal(),
    night = darkness() > 0.75,
    s = (sc.sound && sc.sound()) || {};
  setMusic(mg ? 'minigame' : s.force ? s.force : night ? 'night' : s.day === 'town' ? 'town_' + c.season : 'villa');
  const rain = G.state.weather === 'rain';
  setAmbience({
    sea: mg ? 0 : s.sea || 0,
    rain: rain && !mg ? (s.rain === undefined ? 0.3 : s.rain) : 0,
    birds: !!s.birds && !mg && !night && !rain && (c.season === 'spring' || c.season === 'summer'),
    night: !!s.crickets && !mg && night && c.season !== 'winter',
  });
}

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
  if (fresh) {
    award('x_first', { quiet: true });
    message({
      title: 'Добро пожаловать!',
      icon: '🏡',
      sticky: true,
      html: `<p class="center big-emoji">🐹</p><p>Привет, <b>${esc(s.name)}</b>! Это твоя вилла: три этажа, сауна, джакузи, бассейн и целый <b>миллиард монет</b> в банке.</p>
        <p>На дворе <b>январь</b> и зима ❄️. Рядом — город у моря, там магазины, друзья и приключения.</p>
        <p>✉️ У входной двери висит <b>почтовый ящик</b> — в нём уже лежит первое письмо. Выходи через дверь на первом этаже!</p>`,
      buttons: [{ text: 'Поехали!' }, { text: '❓ Как играть', cls: 'yellow' }],
    }).then((i) => {
      if (i === 1) showHelp();
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

every(0.25, updateSound, { needScene: false });
every(1, updateHud);
every(20, persist);
installDevHooks({ F });
titleScreen();
startLoop(canvas, { onBroken: showBroken, onGesture: unlockAudio });
