// Запуск игры: заставка, главный цикл, ввод, HUD.
import { G, newGame, load, loadProblem, backupSave, save, repair, hasSave, wipe, cal, darkness } from './game.js';
import { el, fmtMoney, makeCanvas } from './util.js';
import { drawHamster, defaultLook, blinkAt } from './hamster.js';
import { resolveLook, START_OUTFIT, NPC_BY_ID } from './data.js';
import { sfx, unlockAudio, isMuted, setMuted, isMusicOn, setMusicOn, getMusicVolume, setMusicVolume, setMusic, setAmbience } from './audio.js';
import { toast, openPanel, message, confirmBox } from './ui.js';
import WorldScene, * as World from './world.js';
import * as Villa from './villa.js';
import * as Tower from './tower.js';
import * as Dive from './dive.js';
import * as F from './features.js';
import * as Audio_ from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const hud = document.getElementById('hud');
let dpr = 1;
let redraw = true; // нарисовать сцену в ближайшем кадре, даже если она под окном

G.scenes = { world: WorldScene, villa: Villa, tower: Tower, dive: Dive };
G.go = (name, from) => {
  if (G.scene && G.scene.leave) G.scene.leave();
  G.scene = G.scenes[name];
  G.sceneName = name;
  G.scene.enter(from);
  G.scene.storePos(); // позиция в сохранении — сразу целиком и от новой сцены (иначе там остаётся чужая)
  G.emit('hud'); save();
};

// ---------- размер экрана ----------
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth, h = window.innerHeight;
  G.view.w = w; G.view.h = h;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  redraw = true; // смена размера стирает канву
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
resize();

// ---------- ввод ----------
let activePointer = null;
canvas.addEventListener('pointerdown', (e) => {
  unlockAudio();
  if (G.modal || !G.scene || activePointer !== null) return;
  activePointer = e.pointerId;
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* не критично */ }
  G.scene.pointerDown(e.clientX, e.clientY);
});
canvas.addEventListener('pointermove', (e) => { if (e.pointerId === activePointer && G.scene && !G.modal) G.scene.pointerMove(e.clientX, e.clientY); });
const up = (e) => {
  if (e.pointerId !== activePointer) return;
  activePointer = null;
  if (G.scene && !G.modal) G.scene.pointerUp(e.clientX, e.clientY);
};
canvas.addEventListener('pointerup', up);
canvas.addEventListener('pointercancel', up);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('keydown', (e) => {
  if (e.target && e.target.tagName === 'INPUT') return;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (G.modal || !G.scene) return;
  G.keys.add(e.code);
  if ((e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') && !e.repeat) G.scene.interactNearest();
});
window.addEventListener('keyup', (e) => G.keys.delete(e.code));
window.addEventListener('blur', () => G.keys.clear());

// ---------- HUD ----------
let chipDate, chipMoney, chipTask, btnLeft, btnMap, btnDive, btnBoat;
function rbtn(icon, label, fn) {
  const b = el('button', 'rbtn', `${icon}<span class="lbl">${label}</span>`);
  b.onclick = () => { unlockAudio(); sfx('tap'); fn(); };
  return b;
}
function buildHud() {
  hud.innerHTML = '';
  const top = el('div', 'hud-top');
  chipDate = el('div', 'chip'); chipMoney = el('div', 'chip'); chipTask = el('div', 'chip task');
  chipTask.onclick = () => { sfx('tap'); F.showLetter(); };
  top.append(chipDate, chipMoney, chipTask);
  const right = el('div', 'hud-btns');
  right.append(rbtn('🎒', 'Рюкзак', F.openBackpack), rbtn('📖', 'Альбом', F.openAlbum), rbtn('📱', 'Гости', F.openPhone), rbtn('⚙️', 'Меню', openSettings));
  const left = el('div', 'hud-btns left');
  btnLeft = rbtn('🔨', 'Обустроить', leftAction);
  btnMap = rbtn('🗺️', 'Карта', F.openMap);
  btnDive = rbtn('🤿', 'Нырнуть', () => { if (World.canDive()) G.go('dive', 'world'); });
  btnDive.classList.add('on');
  btnBoat = rbtn('⚓', 'Сойти', () => World.leaveBoat());
  btnBoat.classList.add('on');
  left.append(btnBoat, btnDive, btnMap, btnLeft);
  hud.append(top, right, left);
}
async function leftAction() {
  if (G.sceneName === 'dive') { Dive.surface(); return; }
  if (G.sceneName === 'villa') Villa.setDecor(!Villa.isDecor());
  else if (await confirmBox('Домой?', '<p class="center">Вернуться на виллу прямо сейчас?</p>', 'Да, домой 🏡', 'Нет')) G.go('villa', 'world');
}
function updateHud() {
  if (!G.state || !chipDate) return;
  const c = cal();
  chipDate.innerHTML = `${c.seasonIcon} <b>${c.monthName}</b>, день ${c.dom} · ${c.phaseIcon} ${c.time}`;
  chipMoney.innerHTML = `🪙 <b>${fmtMoney(G.state.money)}</b>`;
  const t = F.taskChip();
  chipTask.textContent = t.text; chipTask.className = 'chip task ' + t.cls;
  const villa = G.sceneName === 'villa';
  const dive = G.sceneName === 'dive';
  btnLeft.firstChild.textContent = villa ? '🔨' : dive ? '⬆️' : '🏡';
  btnLeft.querySelector('.lbl').textContent = villa ? 'Обустроить' : dive ? 'Всплыть' : 'Домой';
  btnDive.style.display = G.sceneName === 'world' && World.canDive() ? '' : 'none';
  btnBoat.style.display = G.sceneName === 'world' && World.isBoating() ? '' : 'none';
  btnMap.style.display = dive ? 'none' : '';
  btnLeft.classList.toggle('on', villa && Villa.isDecor());
  hud.classList.toggle('decor', villa && Villa.isDecor());
}
G.on('hud', updateHud); G.on('money', updateHud);

function openSettings() {
  openPanel({
    title: 'Меню', icon: '⚙️', cls: 'narrow',
    render(body, tab, panel) {
      const c = cal();
      body.appendChild(el('p', 'center', `<b>${G.state.name}</b> · ${c.year}-й год на вилле<br><span class="muted">Игра сохраняется сама.</span>`));
      const mus = el('button', 'btn ' + (isMusicOn() ? 'green' : 'ghost'), isMusicOn() ? '🎵 Музыка включена' : '🎵 Музыка выключена');
      mus.onclick = () => { setMusicOn(!isMusicOn()); sfx('tap'); panel.refresh(); };
      const vol = el('label', 'vol', '<span>🔈</span><input type="range" min="0" max="100" step="5" aria-label="Громкость музыки"><span>🔊</span>');
      const rng = vol.querySelector('input'); rng.value = Math.round(getMusicVolume() * 100); rng.disabled = !isMusicOn();
      rng.oninput = () => setMusicVolume(rng.value / 100);
      const snd = el('button', 'btn ' + (isMuted() ? 'ghost' : 'blue'), isMuted() ? '🔇 Звуки выключены' : '🔊 Звуки включены');
      snd.onclick = () => { setMuted(!isMuted()); sfx('ok'); panel.refresh(); };
      const help = el('button', 'btn yellow', '❓ Как играть');
      help.onclick = () => showHelp();
      const reset = el('button', 'btn ghost', '🗑️ Начать заново');
      reset.onclick = async () => {
        if (await confirmBox('Начать заново?', '<p class="center">Вся игра сотрётся: наряды, мебель, друзья и наклейки. Точно?</p>', 'Да, стереть', 'Нет-нет!')) { wipe(); location.reload(); }
      };
      const col = el('div'); col.style.cssText = 'display:flex;flex-direction:column;gap:12px;align-items:stretch';
      col.append(mus, vol, snd, help, reset); body.appendChild(col);
    },
  });
}
function showHelp() {
  return message({
    title: 'Как играть', icon: '❓', cls: '',
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
function updateSound() {
  const playing = G.state && G.scene && !document.getElementById('title');
  if (!playing) { setMusic('title'); setAmbience({ sea: 0, rain: 0, birds: false, night: false }); return; }
  if (document.getElementById('piano')) { setMusic(null); setAmbience({ sea: 0, rain: 0, birds: false, night: false }); return; } // за пианино фоновая музыка молчит
  const mg = !!document.getElementById('mg'), c = cal(), night = darkness() > 0.75, world = G.sceneName === 'world';
  const tower = G.sceneName === 'tower', deck = tower && Tower.onDeck(), out = world || deck;
  setMusic(mg ? 'minigame' : G.sceneName === 'dive' ? 'underwater' : G.sceneName === 'villa' && Villa.isParty() ? 'party' : night ? 'night' : world || tower ? 'town_' + c.season : 'villa');
  const rain = G.state.weather === 'rain';
  setAmbience({
    sea: mg ? 0 : world ? World.seaLevel() : deck ? 0.3 : 0,
    rain: rain && !mg ? (world ? 1 : 0.3) : 0,
    birds: out && !mg && !night && !rain && (c.season === 'spring' || c.season === 'summer'),
    night: world && !mg && night && c.season !== 'winter',
  });
}

// ---------- главный цикл ----------
let last = performance.now(), hudT = 0, saveT = 0, sndT = 0;
let frameNo = 0;
let failStreak = 0; // сколько кадров подряд закончились ошибкой
const FAIL_LIMIT = 30;
const MAX_FRAME = 0.1, MAX_STEP = 0.05; // секунды
/** Выполнить часть кадра так, чтобы её ошибка не остановила игру. Возвращает false, если была ошибка. */
function guard(fn) {
  try { fn(); return true; } catch (e) {
    if (failStreak < 3) console.error(e); // не засыпаем консоль одной и той же ошибкой 60 раз в секунду
    return false;
  }
}
function tick(dt) {
  const s = G.state;
  if (s.minutes < 23 * 60 + 59) s.minutes = Math.min(23 * 60 + 59, s.minutes + dt / 0.6);
  if (s.minutes >= 22 * 60 && !s.dayFlags.late) { s.dayFlags.late = true; toast('Уже поздно. Пора в кроватку 😴'); }
  // гость, который приходит сам
  if (s.visitor && G.sceneName === 'villa' && s.minutes >= 11 * 60 && !Villa.isDecor()) {
    const id = s.visitor; s.visitor = null;
    if (!s.guests.includes(id) && s.guests.length < 3 && s.friends[id].met) { s.guests.push(id); Villa.syncGuests(); sfx('bell'); toast(`Тук-тук! ${NPC_BY_ID[id].name} заглянул${NPC_BY_ID[id].fem ? 'а' : ''} в гости 🚪`, 'good'); }
  }
  G.scene.update(dt);
}
function render() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  G.scene.draw(ctx);
}
function frame(now) {
  requestAnimationFrame(frame); // первым делом: что бы ни случилось ниже, следующий кадр уже заказан
  // Кадр длиннее 100 мс обрезаем (вкладка вернулась из фона), а длинный делим на шаги логики не больше 50 мс:
  // на слабом устройстве игра идёт с той же скоростью, только реже рисуется.
  const dtFrame = Math.min(MAX_FRAME, Math.max(0, (now - last) / 1000)); last = now;
  const steps = Math.max(1, Math.ceil(dtFrame / MAX_STEP - 1e-6)), dt = dtFrame / steps;
  let ok = true;
  for (let i = 0; i < steps; i++) {
    G.time += dt;
    if (G.state && G.scene && !G.modal) ok = guard(() => tick(dt)) && ok;
  }
  sndT += dtFrame; if (sndT > 0.25) { sndT = 0; ok = guard(updateSound) && ok; }
  if (G.state && G.scene) {
    // Под мини-игрой, пианино и затемнением сна сцену не видно — не рисуем вовсе.
    // Под окном с затемнением хватает каждого третьего кадра: мир на паузе, шевелятся только вода и дыхание.
    frameNo++;
    if (!G.cover && (redraw || !G.dim || frameNo % 3 === 0)) {
      redraw = false;
      if (!guard(render)) { ok = false; canvas.width = canvas.width; } // сброс канвы: после ошибки на ней могли остаться clip и недозакрытые save()
    }
    hudT += dtFrame; if (hudT > 1) { hudT = 0; ok = guard(updateHud) && ok; }
    saveT += dtFrame; if (saveT > 20) { saveT = 0; ok = guard(persist) && ok; }
  }
  if (ok) failStreak = 0;
  else if (++failStreak === FAIL_LIMIT) showBroken();
}
/** Игра спотыкается в каждом кадре: честно сказать об этом и предложить выход. */
function showBroken() {
  message({
    title: 'Ой! Что-то сломалось', icon: '🛠️', sticky: true,
    html: '<p class="center big-emoji">🙈</p><p class="center">Игра споткнулась. Давай вернёмся домой — там всё починится. Твои вещи и друзья на месте!</p>',
    buttons: [{ text: 'Домой 🏡' }, { text: 'Перезапустить игру', cls: 'ghost' }],
  }).then((i) => {
    if (i === 1) { location.reload(); return; }
    failStreak = 0; // если не помогло — окно появится снова
    guard(() => { if (G.scene && G.scene.leave) G.scene.leave(); });
    G.scene = null; // чтобы G.go не звал leave() сломанной сцены второй раз
    guard(() => {
      repair(G.state);
      if (!G.state.mail) F.newDayMail();
      G.state.pos = { scene: 'villa', floor: 0, x: 290 };
      G.go('villa', 'load');
    });
  });
}
function persist() {
  if (!G.state || !G.scene) return;
  G.scene.storePos();
  save();
}
document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });
window.addEventListener('pagehide', persist);

// ---------- заставка ----------
function startGame(fresh) {
  buildHud();
  F.initEvents();
  const s = G.state;
  if (!s.mail) F.newDayMail();
  const scene = s.pos && s.pos.scene === 'world' ? 'world' : 'villa';
  G.scene = G.scenes[scene]; G.sceneName = scene;
  G.scene.enter(fresh ? 'wake' : 'load');
  updateHud();
  // пианино в подарок (один раз), чтобы было на чём играть
  if (!s.flags.pianoGift) {
    s.flags.pianoGift = 1;
    if (!s.villa.some((i) => i.id === 'piano') && !s.storage.piano) {
      s.storage.piano = 1;
      setTimeout(() => toast('🎹 В кладовке появилось пианино! Дома нажми 🔨 и поставь его.', 'good'), fresh ? 9000 : 1500);
    }
    save();
  }
  if (fresh) {
    if (!s.stickers.includes('x_first')) s.stickers.push('x_first');
    message({
      title: 'Добро пожаловать!', icon: '🏡', sticky: true,
      html: `<p class="center big-emoji">🐹</p><p>Привет, <b>${s.name}</b>! Это твоя вилла: три этажа, сауна, джакузи, бассейн и целый <b>миллиард монет</b> в банке.</p>
        <p>На дворе <b>январь</b> и зима ❄️. Рядом — город у моря, там магазины, друзья и приключения.</p>
        <p>✉️ У входной двери висит <b>почтовый ящик</b> — в нём уже лежит первое письмо. Выходи через дверь на первом этаже!</p>`,
      buttons: [{ text: 'Поехали!' }, { text: '❓ Как играть', cls: 'yellow' }],
    }).then((i) => { if (i === 1) showHelp(); });
    save();
  }
}
function titleScreen() {
  const t = el('div'); t.id = 'title';
  const { canvas: cv, ctx: c2 } = makeCanvas(200, 190);
  const look = resolveLook({ ...defaultLook(), outfit: { ...START_OUTFIT }, beauty: { ...defaultLook().beauty, bow: '#ff5c8a' } });
  let raf = 0; const t0 = performance.now();
  const loop = () => { const tt = (performance.now() - t0) / 1000; c2.clearRect(0, 0, 200, 190); drawHamster(c2, 100, 172, 1.9, look, { time: tt, happy: tt % 4 > 3, armsUp: tt % 4 > 3 && Math.sin(tt * 10) > 0, blink: blinkAt(tt) }); raf = requestAnimationFrame(loop); };
  loop();
  const hero = el('div', 'hero');
  hero.appendChild(el('h1', '', 'Run, Hamster, Run!'));
  hero.appendChild(el('div', 'sub', 'Большая жизнь маленького хомячка'));
  hero.appendChild(cv);
  t.appendChild(hero);
  const go = (fresh) => { cancelAnimationFrame(raf); t.remove(); unlockAudio(); sfx('win'); startGame(fresh); };
  const newForm = () => {
    form.innerHTML = '';
    form.appendChild(el('div', 'sub', 'Как зовут твою хомячку?'));
    const inp = el('input'); inp.maxLength = 14; inp.value = 'Хомка'; inp.setAttribute('aria-label', 'Имя');
    const b = el('button', 'btn big green', 'Играть! ▶');
    b.onclick = () => { newGame((inp.value || '').trim() || 'Хомка'); go(true); };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') b.click(); });
    form.append(inp, b);
  };
  const form = el('div'); form.style.cssText = 'display:flex;flex-direction:column;gap:12px;align-items:center';
  if (hasSave() && load()) {
    const b1 = el('button', 'btn big green', `Продолжить ▶`);
    b1.onclick = () => go(false);
    const b2 = el('button', 'btn ghost', 'Новая игра');
    b2.onclick = async () => { if (await confirmBox('Новая игра?', `<p class="center">Сохранённая игра (${G.state.name}) сотрётся. Начать заново?</p>`, 'Да', 'Нет')) { wipe(); G.state = null; newForm(); } };
    form.append(el('div', 'sub', `С возвращением, ${G.state.name}!`), b1, b2);
  } else if (loadProblem === 'newer') {
    // сохранение от более новой версии игры: не затираем, предлагаем обновить страницу
    const b1 = el('button', 'btn big green', 'Обновить 🔄');
    b1.onclick = () => location.reload();
    const b2 = el('button', 'btn ghost', 'Новая игра');
    b2.onclick = async () => { if (await confirmBox('Новая игра?', '<p class="center">Сохранённая игра сотрётся. Начать заново?</p>', 'Да', 'Нет')) { backupSave(); wipe(); newForm(); } };
    form.append(el('div', 'sub', 'Игра обновилась, а страница — ещё нет.<br>Нажми «Обновить», чтобы продолжить свою игру.'), b1, b2);
  } else {
    newForm();
    if (loadProblem === 'broken') form.prepend(el('div', 'sub', '<small>Старую игру не получилось открыть 😿<br>Мы её не выбросили, а отложили про запас.</small>'));
  }
  t.appendChild(form);
  document.body.appendChild(t);
}

document.addEventListener('pointerdown', unlockAudio, { passive: true });
document.addEventListener('keydown', unlockAudio);
window.__Tower = Tower; window.__Audio = Audio_; window.__G = G; window.__F = F; window.__World = World; window.__Villa = Villa; // для отладки и тестов
titleScreen();
requestAnimationFrame(frame);
