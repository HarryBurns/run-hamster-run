// СЕКРЕТНЫЙ ПЛЯЖ (П.9): что делают на секретном пляже и по дороге туда. Сама бухта (где что стоит, черепашата,
// светящаяся вода, клад) — locations/cove.js; она называет действия реестра, а выполняются они здесь:
//   mermaid           поговорить с русалочкой Жемчужинкой (жительница бухты на камне в воде): задание, «Замок из песка»,
//                     «Ракушки в рамке», куда деть ракушки, болтовня по времени суток
//   cove:castle       мини-игра «Замок из песка» (minigames/sandcastle.js): за первые COVE.castle.paid игр в день —
//                     монеты по звёздам; дальше — для удовольствия; в первый раз — наклейка
//   cove:nest         гнездо черепашат: вечером они вылупляются и ползут за хомячком к морю (локация); доплыли —
//                     событие cove { what: 'turtles' } → наклейка (раз в день)
//   cove:dig          клад под крестиком с карты Зефирки: раз за игру — монеты и «Сундучок с сокровищами»
//   cove:shell        подобрали ракушку (находка у кромки воды; локация кладёт их каждый день по жребию)
//   cove:piece:<id>   кусочек карты Зефирки (задание «Карта сокровищ Зефирки», data/quests.js): tower — у чайки в подзорной
//                     трубе на башне (interiors/tower.js), ship — в сундучке у затонувшего корабля (interiors/dive.js),
//                     isle — в бутылке под пальмой на Звёздном острове (locations/town.js); показывает карту
//   grotto:go | back  заплыв через подводный грот: из моря города (у буйка-ракушки — LANDS.cove.go) на пляж и обратно;
//                     короткая картинка-переезд
// Ещё: ночью вошла в воду — вода светится (наклейка), первый вход — подсказка; ракушки продаются на рынке
// (features/market.js, цены — COVE.shells.sell). Числа — COVE в data/economy.js. Каждое занятие шлёт событие cove { what } —
// по нему считают задания. Состояние меняют только действия (core/actions.js); «раз в день» — отметки дня (dayFlags.cove).
import { setFlag, setDayFlag, addItem, award, earn } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { makeCanvas, ell, fillRR, line, poly, star } from '../core/draw.js';
import { on, emit } from '../core/events.js';
import { go } from '../core/loop.js';
import { register } from '../core/registry.js';
import { G, cal, darkness, count, playerLook, questNow, canSwim } from '../core/state.js';
import { el, esc, pick, fmtMoney } from '../core/util.js';
import { drawHamster } from '../art/hamster.js';
import { NPC_BY_ID, FIND_BY_ID, SHELL_IDS, COVE, LAND_BY_ID, SICK_TEXT, npcLook } from '../data/index.js';
import { startHatch, turtlesOut, hatchTime, turtlesToday, treasureDug } from '../locations/cove.js';
import { SHELL_COLORS } from '../locations/cove_art.js';
import { sea } from '../locations/town.js';
import { dialog } from '../ui/dialog.js';
import { openLayer } from '../ui/modals.js';
import { message } from '../ui/panel.js';
import { toast } from '../ui/toast.js';
import { playMinigame } from './minigames.js';
import { questTalk } from './quests.js';

const S = () => G.state;
const OUT = '#4a3728';
const SC = () => S().dayFlags.cove || {};

// ---------- русалочка Жемчужинка ----------
const PEARL = 'pearl';
/** Что сказать под настроение: ночью — про светящееся море, вечером — про черепашат, днём — про ракушки по сезону. */
export function pearlLine() {
  const L = NPC_BY_ID[PEARL].lines,
    m = S().minutes;
  if (darkness() > 0.6 || m >= 22 * 60 || m < 5 * 60) return pick(L.night);
  if (m >= 17 * 60) return pick(L.evening);
  return pick(L[cal().season]);
}
const sayP = (text, options, happy = false) => dialog({ look: npcLook(PEARL), name: NPC_BY_ID[PEARL].name, text, options, happy });
/** Сколько разных ракушек в рюкзаке (для рамки — по одной каждого вида). */
export const shellKinds = () => SHELL_IDS.filter((id) => count('finds', id) > 0).length;
const shellsLine = () => SHELL_IDS.map((id) => `${FIND_BY_ID[id].name} ${count('finds', id) ? '✓' : '—'}`).join(' · ');

/** Разговор с Жемчужинкой: сначала задание из журнала, потом — замок, ракушки и болтовня. */
export async function talkPearl() {
  const s = S();
  let text;
  if (!s.flags.metPearl) {
    setFlag('metPearl');
    text = `Ой! Привет-привет, ${esc(s.name)}! Ты приплыла через грот? Значит, Зефиркина карта нашлась! Я русалочка Жемчужинка. Здесь, в бухте, живут черепашата, море выносит редкие ракушки, а ночью вода светится, как звёздное небо!`;
  } else text = pick([`Привет, ${esc(s.name)}! Плюх-плюх!`, 'О, это ты! Я как раз пела песенку дельфинам.', 'Здравствуй! Смотри, какая сегодня бирюзовая вода!']);
  emit('talk', { id: PEARL });
  sfx('tap');
  const qt = await questTalk(PEARL);
  if (qt && qt.end) return;
  if (qt && qt.text) text = qt.text;
  for (;;) {
    const opts = [{ text: '🏰 Построить замок из песка', cls: 'yellow', fn: async () => (await castleGame(), null) }];
    for (const o of MORE_TALK) {
      const x = o(S());
      if (x) opts.push(x);
    }
    opts.push({ text: '💬 Поболтать', cls: 'blue', go: 'chat' }, { text: 'Пока!', go: 'bye' });
    const i = await sayP(text, opts);
    const o = opts[i] || {};
    if (o.go === 'chat') text = pearlLine();
    else if (o.fn) {
      const r = await o.fn();
      if (!r) return;
      text = r;
    } else return;
  }
}
/** Дополнительные ответы: (s) → { text, cls, fn: async () => следующая реплика | null } или ничего. */
const MORE_TALK = [
  // ракушки в рамке — по одной каждого вида
  () =>
    SHELL_IDS.some((id) => count('finds', id) > 0) && {
      text: `🐚 Ракушки в рамке (${shellKinds()} из ${SHELL_IDS.length})`,
      cls: 'green',
      fn: async () => {
        if (shellKinds() < SHELL_IDS.length)
          return `Для рамки нужно по одной ракушке каждого вида: ${shellsLine()}. Море выносит их на песок у самой воды — по одной-две в день!`;
        for (const id of SHELL_IDS) addItem('finds', id, -1);
        addItem('storage', 'shell_frame', 1);
        sfx('win');
        award('x_shells', { delay: 1200 });
        emit('cove', { what: 'frame' });
        return 'Готово: розовая, витая и ракушка-солнышко — в рамке из маленьких ракушек! Если прислушаться, слышно море 🐚 Рамка уже в кладовке: дома нажми 🔨.';
      },
    },
  // куда деть ракушки
  () =>
    SHELL_IDS.some((id) => count('finds', id) > 0) && {
      text: '🪙 А ракушки можно продать?',
      fn: async () =>
        `Конечно! Торговец Грошик на рынке в городе берёт ракушки: розовую — за ${COVE.shells.sell.shell_pink}, витую — за ${COVE.shells.sell.shell_spiral}, ракушку-солнышко — за ${COVE.shells.sell.shell_sun} монет. А можно собрать все три вида — я сделаю красивую рамку!`,
    },
];
register('mermaid', () => talkPearl(), 'русалочка Жемчужинка: разговор (жительница секретного пляжа на камне в воде)');

// ---------- «Замок из песка» ----------
/** Сколько игр сегодня ещё с призом. */
export const castleLeft = () => Math.max(0, COVE.castle.paid - (SC().castles || 0));
/** Построить замок из песка: за первые игры дня — монеты по звёздам. */
export async function castleGame() {
  const left = castleLeft(),
    c = COVE.castle.coins,
    note = (html) => `<div class="pay-note${left ? '' : ' off'}">${html}</div>`;
  const res = await playMinigame('sandcastle', {
    introNote: left
      ? note(`🧜‍♀️ <b>Приз Жемчужинки:</b> ⭐ 🪙 ${c[0]} · ⭐⭐ 🪙 ${c[1]} · ⭐⭐⭐ 🪙 ${c[2]}. Сегодня ещё ${left} ${left === 1 ? 'замок' : 'замка'} с призом.`)
      : note('💛 Сегодня призы за замки уже получены. Строить можно для удовольствия — завтра призы снова!'),
    resultNote: (stars) => (left ? note(`<span class="sum">🪙 +${fmtMoney(c[stars - 1])}</span>`) : note('💛 Этот замок был для удовольствия.')),
  });
  if (!res) return res;
  award('x_castle', { delay: 1200 });
  if (!left) return res;
  setDayFlag('castles', (SC().castles || 0) + 1, 'cove');
  earn(c[res.stars - 1], 'work');
  sfx('coin');
  toast(`Жемчужинка: «Какой красивый замок!» 🪙 +${fmtMoney(c[res.stars - 1])}`, 'good');
  return res;
}

// ---------- черепашата, клад, ракушки ----------
/** Гнездо черепашат: вечером — вылупиться и ползти за хомячком; днём и после — добрая подсказка. */
export function nestTap() {
  if (turtlesOut()) return void toast('🐢 Черепашата ползут за тобой — веди их прямо в воду!');
  if (SC().turtles) return void toast('🐢 Сегодня черепашата уже плавают в море. Завтра вечером вылупятся новые!');
  if (!hatchTime()) {
    sfx('tap');
    toast(`🥚 Тс-с… Черепашата ещё спят в яйцах. Они вылупляются вечером, после ${COVE.turtles.from}:00!`);
    return;
  }
  startHatch();
  toast(`🐢 Тук-тук… Вылупились ${turtlesToday()} черепашат! Иди к воде — они поползут за тобой.`, 'good');
}
/** Выкопать клад под крестиком (раз за игру): монеты и «Сундучок с сокровищами». */
export async function digTreasure() {
  if (treasureDug()) return;
  setFlag('coveTreasure');
  earn(COVE.treasure.coins, 'gift');
  addItem('storage', 'treasure_chest', 1);
  sfx('dig');
  emit('cove', { what: 'treasure' });
  award('x_cove_treasure', { quiet: true });
  sfx('fanfare');
  await message({
    title: 'Клад секретного пляжа!',
    icon: '💰',
    html: `<p class="center big-emoji">🧰✨</p><p class="center">Копаем… копаем… Дзынь! Лопатка стукнулась о крышку — это сундучок! Внутри — золотые монетки, жемчуг и бусы. Карта Зефирки не обманула!</p><p class="reward center">🪙 +${fmtMoney(COVE.treasure.coins)} монет</p><p class="center">🎁 <b>Сундучок с сокровищами</b> — уже в кладовке: дома нажми 🔨.</p><p class="center muted">Наклейка «Клад секретного пляжа» 💰 — в альбоме!</p>`,
    buttons: [{ text: 'Ура!' }],
  });
}
const COVE_ACTS = {
  castle: castleGame,
  nest: nestTap,
  dig: digTreasure,
  shell: () => emit('cove', { what: 'shell' }),
};
register(
  'cove',
  (p) => (p.arg && p.arg.startsWith('piece:') ? findPiece(p.arg.slice(6)) : COVE_ACTS[p.arg] && COVE_ACTS[p.arg]()),
  'секретный пляж: cove:castle | nest | dig | shell | piece:<tower|ship|isle> (кусочек карты Зефирки)',
);

// ---------- карта сокровищ Зефирки ----------
/** Кусочки карты по порядку шагов задания «Карта сокровищ Зефирки». */
export const PIECES = ['tower', 'ship', 'isle'];
const PIECE_TEXT = {
  tower: 'Чайка испугалась, хлопнула крыльями — и кусочек карты, кружась, упал прямо на смотровую площадку!',
  ship: 'Сундучок скрипнул и открылся: внутри, в непромокаемом мешочке, — кусочек старой карты!',
  isle: 'Под пальмой в песке — бутылка! А в ней свёрнутый в трубочку кусочек старой карты.',
};
/** Какие кусочки уже найдены (по шагам задания). */
export function piecesFound() {
  const w = questNow('treasure_map');
  if (w.status === 'done') return PIECES.slice();
  if (w.status !== 'active') return [];
  return PIECES.filter((_, i) => w.steps[i] && w.steps[i].ok);
}
/** Кусочек id сейчас можно найти: задание взято, а этого кусочка ещё нет. */
export const pieceWanted = (id) => questNow('treasure_map').status === 'active' && !piecesFound().includes(id);
/** Нашли кусочек карты: событие (шаг задания) и окно с картой — какие кусочки уже есть. */
export async function findPiece(id) {
  if (!PIECES.includes(id) || !pieceWanted(id)) return false;
  emit('cove', { what: 'piece', id });
  sfx('magic');
  const have = piecesFound(),
    all = have.length === PIECES.length;
  await message({
    title: all ? 'Карта сложилась!' : 'Кусочек карты!',
    icon: '🗺️',
    cls: 'narrow',
    html: `<p class="center">${PIECE_TEXT[id]}</p><p class="center"><img class="treasure-map" src="${treasureMapImage(have)}" alt="Карта сокровищ" style="width:100%;max-width:340px;height:auto;border-radius:12px"></p><p class="center">${
      all
        ? '<b>Все три кусочка!</b> Скалы на востоке моря, буёк-ракушка, подводный грот… а крестик — на секретном пляже! Скорее к Зефирке!'
        : `Кусочков: <b>${have.length} из ${PIECES.length}</b>. Остальные — в журнале 📖`
    }</p>`,
    buttons: [{ text: all ? 'К Зефирке!' : 'Ура!' }],
  });
  return true;
}
/** Карта сокровищ (картинка кодом): три кусочка; ненайденные — пунктиром со знаком вопроса. */
export function paintTreasureMap(ctx, w, h, have) {
  ctx.clearRect(0, 0, w, h);
  const k = w / 340;
  ctx.save();
  ctx.scale(k, k);
  const W = 340,
    H = (h / w) * 340;
  // три кусочка: левый, правый верхний, правый нижний (рваные края — ломаной)
  const PARTS = {
    tower: [10, 10, 150, 10, 140, 70, 158, 130, 136, H - 10, 10, H - 10],
    ship: [150, 10, W - 10, 10, W - 10, 120, 250, 112, 210, 126, 158, 130, 140, 70],
    isle: [158, 130, 210, 126, 250, 112, W - 10, 120, W - 10, H - 10, 136, H - 10],
  };
  const path = (pts) => {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
  };
  for (const id of PIECES) {
    const ok = have.includes(id);
    path(PARTS[id]);
    ctx.fillStyle = ok ? '#f3e2b5' : 'rgba(243,226,181,.25)';
    ctx.fill();
    ctx.setLineDash(ok ? [] : [6, 5]);
    ctx.strokeStyle = ok ? '#8d5524' : 'rgba(141,85,36,.6)';
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // рисунок на карте — только на найденных кусочках
  ctx.save();
  ctx.beginPath();
  for (const id of PIECES) {
    if (!have.includes(id)) continue;
    const pts = PARTS[id];
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
  }
  ctx.clip();
  // море
  ctx.fillStyle = 'rgba(116,192,252,.45)';
  ctx.fillRect(0, 60, W, H);
  ctx.strokeStyle = 'rgba(28,126,214,.5)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let y = 80; y < H; y += 26)
    for (let x = 20 + (y % 52); x < W; x += 52) {
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 6, y - 4, x + 12, y);
    }
  ctx.stroke();
  // берег города и башня (левый кусочек)
  poly(ctx, [0, 10, 150, 10, 140, 60, 0, 66], '#ffe8a8', OUT, 1.5);
  fillRR(ctx, 40, 20, 10, 34, 2, '#74c0fc', OUT, 1.4);
  ell(ctx, 45, 18, 7, 4, '#ff8fab', OUT, 1);
  for (const x of [70, 96, 118]) fillRR(ctx, x, 36, 16, 18, 2, '#ffd8a8', OUT, 1.2);
  // Звёздный остров с флажком и пальмой (левый низ)
  ell(ctx, 64, 150, 34, 14, '#ffe8a8', OUT, 1.5);
  line(ctx, 54, 148, 58, 120, '#a8703f', 3);
  for (const a of [-2.4, -1.6, -0.8]) ell(ctx, 58 + Math.cos(a) * 10, 120 + Math.sin(a) * 6, 10, 3, '#40c057', OUT, 1, a + 1.6);
  star(ctx, 80, 146, 5, '#ff922b');
  // затонувший корабль (правый верх): мачта из воды
  line(ctx, 230, 96, 236, 58, OUT, 2.4);
  poly(ctx, [236, 60, 262, 84, 236, 86], '#fff3bf', OUT, 1.2);
  ctx.fillStyle = OUT;
  ctx.font = '900 12px ui-rounded, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('~ корабль ~', 240, 108);
  // скалы на востоке, буёк-ракушка и грот → бухта с крестиком (правый низ)
  for (const [x, y, r] of [
    [272, 150, 20],
    [300, 140, 24],
    [318, 170, 18],
  ])
    ell(ctx, x, y, r, r * 0.7, '#b39c86', OUT, 1.5);
  ell(ctx, 252, 168, 6, 6, '#22b8cf', OUT, 1.2);
  ctx.strokeStyle = 'rgba(28,126,214,.8)';
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(252, 176);
  ctx.quadraticCurveTo(262, 206, 292, 202);
  ctx.stroke();
  ctx.setLineDash([]);
  ell(ctx, 296, 204, 26, 14, '#fff8e6', OUT, 1.5);
  ctx.lineCap = 'round';
  for (const [c, lw] of [
    [OUT, 6],
    ['#e03131', 3.4],
  ]) {
    ctx.strokeStyle = c;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(288, 198);
    ctx.lineTo(304, 210);
    ctx.moveTo(304, 198);
    ctx.lineTo(288, 210);
    ctx.stroke();
  }
  // роза ветров
  ell(ctx, 200, 40, 14, 14, 'rgba(255,255,255,.4)', 'rgba(141,85,36,.7)', 1.4);
  poly(ctx, [200, 24, 204, 40, 200, 56, 196, 40], '#e03131', OUT, 1);
  ctx.restore();
  // знак вопроса на ненайденных
  ctx.fillStyle = 'rgba(141,85,36,.7)';
  ctx.font = '900 34px ui-rounded, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const CENTER = { tower: [74, H / 2], ship: [250, 64], isle: [250, (130 + H) / 2] };
  for (const id of PIECES) if (!have.includes(id)) ctx.fillText('?', ...CENTER[id]);
  ctx.restore();
}
/** Картинка карты (data: URL) — для окна. */
export function treasureMapImage(have) {
  const { canvas, ctx } = makeCanvas(340, 230);
  paintTreasureMap(ctx, 340, 230, have);
  return canvas.toDataURL();
}

// ---------- наклейки и подсказки по событиям места ----------
on('cove', ({ what }) => {
  if (!S()) return;
  if (what === 'turtles') {
    setDayFlag('turtles', 1, 'cove');
    sfx('win');
    if (award('x_turtles', { delay: 1400 })) toast('🐢 Все черепашата доплыли до моря! Плывите, малыши! Жемчужинка машет им хвостом.', 'good');
    else toast('🐢 Черепашата уплыли в море — счастливого пути!', 'good');
  } else if (what === 'glow' && award('x_glow', { delay: 900 }))
    toast('✨ Ого, вода светится! Это крошечные морские огоньки — они загораются, когда плывёшь.', 'good');
  else if (what === 'shell' && !S().flags.shellHint) {
    setFlag('shellHint');
    setTimeout(() => toast('🐚 Редкая ракушка! Собери все три вида — Жемчужинка сделает рамку. А ещё их берёт рынок.', 'good'), 900);
  }
});
on('scene', ({ name }) => {
  if (name !== 'cove' || !S() || S().flags.coveHint) return;
  setFlag('coveHint');
  toast('🐢 Секретный пляж! Жемчужинка сидит на камне у воды — поздоровайся. А крестик с карты — где-то на песке!', 'good');
});

// ---------- заплыв через подводный грот ----------
/** Картинка переезда: подводный грот — тёмные своды, лучи света, хомячок плывёт (k — 0..1 пути). */
export function paintGrotto(ctx, w, h, k, toCove, look, t) {
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, toCove ? '#1c6fc4' : '#3fd0d4');
  g.addColorStop(0.5, '#124a66');
  g.addColorStop(1, toCove ? '#3fd0d4' : '#1c6fc4');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // лучи света из выхода
  const ex = toCove ? w : 0;
  ctx.fillStyle = 'rgba(200,255,250,.12)';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(ex, h * (0.3 + i * 0.12));
    ctx.lineTo(w / 2 + (toCove ? -1 : 1) * (40 + i * 30), h * (0.15 + i * 0.22));
    ctx.lineTo(w / 2 + (toCove ? -1 : 1) * (10 + i * 30), h * (0.2 + i * 0.22));
    ctx.closePath();
    ctx.fill();
  }
  // своды грота: сверху сталактиты, снизу камни, ракушки и водоросли
  ctx.fillStyle = '#2d2733';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  for (let x = 0; x <= w; x += w / 10) ctx.lineTo(x, h * (0.12 + ((x / w) * 7 % 1) * 0.08) + Math.sin(x * 0.05) * 6);
  ctx.lineTo(w, 0);
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < 9; i++) {
    const x = (i + 0.5) * (w / 9);
    poly(ctx, [x - 8, h * 0.14, x, h * (0.24 + (i % 3) * 0.04), x + 8, h * 0.14], '#3d3545');
  }
  ctx.fillStyle = '#3a3240';
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += w / 9) ctx.lineTo(x, h * (0.84 + ((x / w) * 5 % 1) * 0.06) + Math.cos(x * 0.04) * 6);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < 7; i++) {
    const x = (i + 0.3) * (w / 7);
    ctx.save();
    ctx.translate(x, h * 0.9);
    ctx.rotate(Math.sin(t * 2 + i) * 0.15);
    ell(ctx, 0, -14, 4, 15, '#2f9e44', OUT, 1);
    ctx.restore();
    if (i % 2) {
      const [c] = SHELL_COLORS[i % 3];
      ell(ctx, x + 18, h * 0.88, 6, 4, c, OUT, 1);
    }
  }
  // светлячки воды (огоньки) и рыбки
  for (let i = 0; i < 14; i++) {
    const x = ((i * 0.37 + t * 0.05) % 1) * w,
      y = h * (0.3 + ((i * 0.61) % 0.5));
    ell(ctx, x, y, 2, 2, `rgba(150,255,240,${0.4 + 0.4 * Math.sin(t * 3 + i)})`);
  }
  for (let i = 0; i < 3; i++) {
    const fx = ((t * 0.12 + i * 0.33) % 1) * (w + 60) - 30,
      fy = h * (0.4 + i * 0.14);
    poly(ctx, [fx - 10, fy, fx - 18, fy - 6, fx - 18, fy + 6], ['#ff922b', '#ffd43b', '#f783ac'][i], OUT, 1);
    ell(ctx, fx, fy, 10, 6, ['#ff922b', '#ffd43b', '#f783ac'][i], OUT, 1.2);
  }
  // хомячок плывёт (лёжа, как под водой)
  const z = w / 560,
    dir = toCove ? 1 : -1,
    hx = toCove ? -40 * z + k * (w + 80 * z) : w + 40 * z - k * (w + 80 * z),
    hy = h * 0.55 + Math.sin(t * 4) * 6;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(dir * 1.25);
  drawHamster(ctx, 0, 30 * z, 0.95 * z, look, { dir: 0, happy: true, armsUp: true, time: t, shadow: false });
  ctx.restore();
  // пузырьки за хомячком
  for (let i = 0; i < 6; i++) {
    const ph = (t * 1.5 + i / 6) % 1;
    ell(ctx, hx - dir * (20 + i * 10) * z, hy - 20 * z - ph * 60 * z, (3 + (i % 3)) * z, (3 + (i % 3)) * z, null, 'rgba(255,255,255,.8)', 1.5);
  }
}
let swimming = false;
/** Проплыть через подводный грот: toCove — из моря города на секретный пляж, иначе — обратно к буйку. */
export function rideGrotto(toCove) {
  if (swimming) return false;
  if (toCove && !canSwim()) {
    toast(SICK_TEXT.water); // простуженной нырять нельзя (Ф1)
    return false;
  }
  const land = LAND_BY_ID.cove;
  swimming = true;
  sfx('splash');
  if (!toCove && !canSwim()) toast('🐬 Жемчужинка позвала дельфина — он довезёт тебя через грот, чтобы не мёрзнуть!');
  const W = Math.min(560, window.innerWidth - 32),
    H = Math.round(W * 0.56);
  const f = el(
    'div',
    'fade cable-ride grotto-ride',
    `<div class="msg"><div><div class="ride-pic"></div><p>${toCove ? '🤿 Плывём через подводный грот!' : '🤿 Плывём обратно, в море города!'}</p></div></div>`,
  );
  const { canvas, ctx } = makeCanvas(W, H);
  canvas.style.borderRadius = '18px';
  f.querySelector('.ride-pic').appendChild(canvas);
  document.body.appendChild(f);
  const closeLayer = openLayer();
  let cover = null,
    raf = 0;
  const t0 = performance.now(),
    look = playerLook(),
    DUR = 2600;
  const loop = (now) => {
    const t = (now - t0) / 1000,
      p = Math.min(1, (now - t0) / DUR),
      e = p * p * (3 - 2 * p);
    paintGrotto(ctx, W, H, e, toCove, look, t);
    if (p < 1) raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  requestAnimationFrame(() => f.classList.add('on'));
  setTimeout(() => {
    cover = openLayer({ pause: false, cover: true }); // экран уже тёмный — сцену под ним не рисуем
  }, 400);
  setTimeout(() => {
    if (toCove) {
      sea.parkBoat(); // приплыла на кораблике — он ждёт у буйка
      go(land.scene, { at: land.entry });
    } else go('world', { at: 'grotto' });
  }, DUR - 300);
  setTimeout(() => {
    cancelAnimationFrame(raf);
    if (cover) cover();
    f.classList.remove('on');
    setTimeout(() => {
      f.remove();
      closeLayer();
      swimming = false;
      sfx('ding');
      if (toCove) award('x_grotto', { delay: 600 });
    }, 380);
  }, DUR + 150);
  return true;
}
register('grotto', (p) => rideGrotto(p.arg !== 'back'), 'подводный грот: grotto:go (из моря города на секретный пляж) | grotto:back');
