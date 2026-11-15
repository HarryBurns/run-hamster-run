// В гости к жителям: дверь домика (открыта или нет), хозяин у себя дома (поболтать, чай, угощение),
// «изюминки» домов — телескоп, гигантский холодильник, духовка.
//
// Когда можно войти (часы — VISIT в data/visits.js, расчёт — npcWhere() в core/state.js):
//   утром до 9:00 и вечером после 19:00 хозяин дома; после 22:00 спит; днём гуляет — дверь закрыта;
//   если он сегодня позвал («Заходи ко мне сегодня!» — в разговоре, в ответ на угощение, письмо «день гостей»),
//   дверь открыта весь день.
// Действия реестра: 'home-of:<житель>' — дверь домика в городе; 'host:<житель>' — хозяин внутри;
// 'say' — подсказка у предмета; 'telescope', 'bigfridge', 'oven' — особая мебель (data/furniture.js).
import { addItem, award, countVisit, markFriendToday, meetFriend, setDayFlag, spendMinutes } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { makeCanvas, ell, fillRR, star } from '../core/draw.js';
import { emit } from '../core/events.js';
import { go } from '../core/loop.js';
import { register, run } from '../core/registry.js';
import { G, darkness, npcWhere, playerLook } from '../core/state.js';
import { el, esc, pick } from '../core/util.js';
import { drawHamster, blinkAt } from '../art/hamster.js';
import { DISH_BY_ID, NPCS, NPC_BY_ID, NPC_HOME, VISIT, npcLook } from '../data/index.js';
import { npcHomeScene } from '../interiors/houses.js';
import { dialog } from '../ui/dialog.js';
import { openPanel, message } from '../ui/panel.js';
import { toast } from '../ui/toast.js';
import { pickDish } from './cooking.js';
import { addPts } from './friends.js';

const S = () => G.state;
const hhmm = (m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
const pron = (npc) => (npc.fem ? 'она' : 'он');

// ---------- дверь домика ----------
/** Подошли к двери домика жителя. back — место у двери снаружи (туда вернёт выход из дома). */
export async function visitHome(id, ctx = {}) {
  const npc = NPC_BY_ID[id],
    home = NPC_HOME[id],
    fr = S().friends[id],
    where = npcWhere(id);
  if (where === 'guest') {
    toast(`Здесь живёт ${npc.name}. А сейчас ${pron(npc)} у тебя в гостях! 🏡`);
    return;
  }
  if (where === 'asleep') {
    sfx('pop');
    toast(`Тс-с! ${npc.name} уже спит 😴 Приходи завтра.`);
    return;
  }
  if (where === 'out') {
    sfx('pop');
    toast(
      fr.met
        ? `Дверь закрыта: ${npc.name} сейчас ${home.away}. Дома ${pron(npc)} утром до ${hhmm(VISIT.morningEnd)} и вечером после ${hhmm(VISIT.eveningStart)} 🚪`
        : `Здесь живёт ${npc.name}. Сейчас ${pron(npc)} ${home.away} — там и познакомитесь! Дома бывает утром и вечером 🚪`,
    );
    return;
  }
  // хозяин дома. Незнакомые сначала знакомятся — прямо на пороге
  sfx('bell');
  if (!fr.met) {
    meetFriend(id);
    markFriendToday(id, 'chat');
    addPts(id, 1);
    emit('talk', { id });
    await dialog({
      look: npcLook(id),
      name: npc.name,
      happy: true,
      text: `Тук-тук? Ой, привет! Я ${npc.name}. А ты, наверное, ${esc(S().name)} с большой виллы? Будем дружить! Заходи, не стой на пороге.`,
      options: [{ text: 'Спасибо!', cls: 'green' }],
    });
  }
  sfx('door');
  go(npcHomeScene(id), ctx.back ? { back: ctx.back } : {});
  const v = countVisit(id);
  award('x_visit', { delay: 1500 });
  if (v.homes >= NPCS.length) award('x_visit_all', { delay: 2600 });
  emit('visit', { place: 'home', npc: id });
  emit('visit', { place: 'home_' + id, npc: id });
  setTimeout(() => toast(`${npc.name}: «${pick(home.hello)}»`), 500);
}

register(
  'home-of',
  (p, ctx) => visitHome(p.arg, ctx),
  'дверь домика жителя: home-of:<житель>; ctx.back — место у двери',
);

// ---------- хозяин у себя дома ----------
/** Чаепитие: маленькая сценка за столом. Возвращает Promise — когда гостья встала из-за стола. */
function teaScene(id) {
  const npc = NPC_BY_ID[id],
    tea = NPC_HOME[id].tea;
  return new Promise((resolve) => {
    const W = 300,
      H = 170;
    const { canvas, ctx } = makeCanvas(W, H);
    canvas.style.cssText += ';display:block;margin:0 auto;border-radius:18px;background:#fff3d6;max-width:100%';
    let raf = 0;
    const t0 = performance.now();
    const loop = () => {
      const t = (performance.now() - t0) / 1000;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#e8c9a0';
      ctx.fillRect(0, H - 22, W, 22);
      const sip = Math.sin(t * 2.2) > 0.75;
      drawHamster(ctx, 62, H - 20, 1.25, playerLook(), {
        time: t,
        dir: 1,
        sit: true,
        blink: blinkAt(t),
        happy: sip,
        shadow: false,
      });
      drawHamster(ctx, W - 62, H - 20, 1.25 * (npc.small ? 0.8 : 1), npcLook(id), {
        time: t + 1.7,
        dir: -1,
        sit: true,
        blink: blinkAt(t, 1.7),
        talk: !sip && t % 3 < 1.6,
        happy: sip,
        shadow: false,
      });
      // стол, скатерть, чайник, чашки, угощение
      fillRR(ctx, W / 2 - 8, H - 62, 16, 44, 4, '#b9834f', '#4a3728');
      fillRR(ctx, W / 2 - 66, H - 74, 132, 14, 7, '#fff', '#4a3728');
      ell(ctx, W / 2 - 16, H - 90, 17, 13, '#ff8fab', '#4a3728');
      fillRR(ctx, W / 2 - 24, H - 106, 16, 5, 2.5, '#ff8fab', '#4a3728', 1.5);
      ell(ctx, W / 2 - 16, H - 108, 3.5, 3.5, '#ffd43b', '#4a3728', 1.2);
      for (const dx of [-50, 52]) fillRR(ctx, W / 2 + dx - 8, H - 86, 16, 11, 4, '#fff', '#4a3728', 1.5);
      ctx.font = '24px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#000';
      ctx.fillText(tea.e, W / 2 + 20, H - 86);
      for (let i = 0; i < 4; i++) {
        const p = (t * 0.5 + i * 0.25) % 1,
          x = W / 2 + [-50, 52, -20, -12][i] + Math.sin(p * 6 + i) * 4;
        ctx.globalAlpha = 0.6 * (1 - p);
        ell(ctx, x, H - 94 - (i > 1 ? 22 : 0) - p * 30, 5, 5, '#fff');
      }
      ctx.globalAlpha = 1;
      for (let i = 0; i < 3; i++) {
        const p = (t * 0.35 + i / 3) % 1;
        ctx.globalAlpha = 1 - p;
        star(ctx, 40 + i * 110 + Math.sin(p * 5) * 8, 40 - p * 26, 5, '#ffd43b');
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(loop);
    };
    loop();
    sfx('eat');
    openPanel({
      title: `В гостях: ${tea.name}`,
      icon: '🫖',
      cls: 'narrow',
      render(body) {
        body.appendChild(canvas);
        body.appendChild(el('p', 'center', `<b>${npc.name}:</b> «${tea.text}»`));
        body.appendChild(el('p', 'muted center', 'Вы пьёте чай и болтаете обо всём на свете.'));
      },
      foot: [{ text: 'Спасибо, очень вкусно! 😋', cls: 'green', fn: (p) => p.close() }],
      onClose: () => {
        cancelAnimationFrame(raf);
        resolve();
      },
    });
  });
}

/** Разговор с хозяином у него дома. ctx.scene — сцена дома (чтобы показать радость). */
export async function hostDialog(id, ctx = {}) {
  const npc = NPC_BY_ID[id],
    home = NPC_HOME[id],
    fr = S().friends[id],
    look = npcLook(id),
    tea = home.tea;
  if (!fr.met) meetFriend(id);
  let text = pick([
    `Как хорошо, что ты зашла, ${esc(S().name)}! Чем займёмся?`,
    'Будь как дома! Трогай всё, что хочется.',
    'Садись, рассказывай: что нового в городе?',
  ]);
  for (;;) {
    const hadTea = fr.tea === S().day;
    const i = await dialog({
      look,
      name: npc.name,
      text,
      options: [
        { text: '💬 Поболтать', cls: 'blue' },
        { text: `${tea.e} ${hadTea ? 'Чай уже пили' : 'Попьём чаю?'}`, cls: hadTea ? 'ghost' : 'green' },
        { text: '🎁 Угостить', cls: 'yellow' },
        { text: 'Пока!' },
      ],
    });
    if (i === 0) {
      text = pick(home.lines);
      if (fr.chat !== S().day) {
        markFriendToday(id, 'chat');
        addPts(id, 1);
      }
      emit('talk', { id });
    } else if (i === 1) {
      if (hadTea) {
        text = 'Мы сегодня уже чаёвничали! Приходи завтра — заварю свежий.';
        continue;
      }
      await teaScene(id);
      markFriendToday(id, 'tea');
      spendMinutes(30);
      addPts(id, 3);
      award('x_tea', { delay: 1200 });
      emit('visit', { place: 'tea', npc: id });
      emit('guestHappy', { id }); // хозяин и героиня радуются в комнате
      emit('happy');
      emit('hud');
      text = pick([
        'Как славно посидели! Заходи ещё.',
        'С тобой и чай вкуснее!',
        'Уф, напились чаю. Теперь можно и поиграть!',
      ]);
    } else if (i === 2) {
      const dish = await pickDish(`Чем угостить? (${npc.name})`);
      if (!dish) {
        text = 'Ничего страшного, в другой раз!';
        continue;
      }
      addItem('dishes', dish, -1);
      sfx('eat');
      const fav = dish === npc.fav;
      if (fr.gift !== S().day) {
        markFriendToday(id, 'gift');
        addPts(id, fav ? 4 : 2);
      }
      emit('gift', { id });
      emit('guestHappy', { id });
      text = fav
        ? `${DISH_BY_ID[dish].e} Это же моё любимое блюдо! И прямо к столу! Спасибо-спасибо!`
        : `${DISH_BY_ID[dish].e} Ой, гостинец! Как вкусно, спасибо тебе!`;
    } else return;
  }
}

register('host', (p, ctx) => hostDialog(p.arg, ctx), 'хозяин у себя дома: host:<житель> — поболтать, чай, угостить');

// ---------- вещи в домах ----------
register('say', (p) => toast(pick([].concat(p.text))), 'подсказка у предмета: { text: строка или список }');

/** Ночное небо в телескоп: созвездия, которых нет ни в одном атласе. */
function openStars() {
  const W = 320,
    H = 220;
  const { canvas, ctx } = makeCanvas(W, H);
  canvas.style.cssText +=
    ';display:block;margin:0 auto;border-radius:26px;max-width:100%;height:auto;aspect-ratio:320/220';
  const SKY = [
    {
      name: 'Большой Хомяк',
      pts: [
        [60, 70],
        [92, 48],
        [128, 60],
        [136, 96],
        [100, 112],
        [66, 100],
        [60, 70],
      ],
    },
    {
      name: 'Семечка',
      pts: [
        [212, 44],
        [236, 70],
        [222, 100],
        [198, 74],
        [212, 44],
      ],
    },
    {
      name: 'Колесо',
      pts: [
        [236, 150],
        [262, 136],
        [286, 152],
        [278, 180],
        [250, 184],
        [236, 150],
      ],
    },
    {
      name: 'Морковка',
      pts: [
        [70, 170],
        [110, 150],
        [150, 160],
        [110, 176],
        [70, 170],
      ],
    },
  ];
  let raf = 0;
  const t0 = performance.now();
  const loop = () => {
    const t = (performance.now() - t0) / 1000;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#12123a');
    g.addColorStop(1, '#3b2f6b');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 60; i++) {
      ctx.globalAlpha = 0.35 + 0.5 * Math.abs(Math.sin(t * (0.6 + (i % 5) * 0.3) + i));
      ctx.fillStyle = '#fff';
      ctx.fillRect((i * 97) % W, (i * 53) % H, 2, 2);
    }
    ctx.globalAlpha = 1;
    ctx.font = '800 11px ui-rounded, "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    for (const c of SKY) {
      ctx.strokeStyle = 'rgba(255,255,255,.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      c.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      c.pts.forEach(([x, y], i) => star(ctx, x, y, 4.5 + Math.sin(t * 3 + i + x) * 1.2, '#ffe066'));
      const cx = c.pts.reduce((a, q) => a + q[0], 0) / c.pts.length,
        cy = Math.max(...c.pts.map((q) => q[1]));
      ctx.fillStyle = '#d0bfff';
      ctx.fillText(c.name, cx, cy + 16);
    }
    // падающая звезда
    const p = (t % 4) / 1.2;
    if (p < 1) {
      ctx.strokeStyle = `rgba(255,255,255,${1 - p})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(300 - p * 150, 16 + p * 70);
      ctx.lineTo(320 - p * 150, 6 + p * 70);
      ctx.stroke();
    }
    ell(ctx, 160, 26, 13, 13, '#fff3bf');
    ell(ctx, 166, 22, 11, 11, '#12123a');
    raf = requestAnimationFrame(loop);
  };
  loop();
  sfx('magic');
  openPanel({
    title: 'Звёзды в телескоп',
    icon: '🔭',
    cls: 'narrow',
    render(body) {
      body.appendChild(canvas);
      body.appendChild(
        el(
          'p',
          'center',
          'Вот <b>Большой Хомяк</b>, а рядом — <b>Семечка</b>. Увидишь падающую звезду — загадай желание! 🌠',
        ),
      );
    },
    foot: [{ text: 'Красота!', cls: 'green', fn: (p) => p.close() }],
    onClose: () => cancelAnimationFrame(raf),
  });
  emit('visit', { place: 'stars' });
}

register(
  'telescope',
  () => {
    if (darkness() > 0.4) openStars();
    else {
      sfx('pop');
      toast('В телескоп видно облака и одну любопытную чайку. А звёзды покажутся, когда стемнеет — приходи вечером 🔭');
    }
  },
  'телескоп: вечером — звёздное небо',
);

register(
  'bigfridge',
  (p, ctx) => {
    const sc = ctx.scene;
    if (!sc || sc.owned) return run('fridge', ctx); // у себя дома это просто большой холодильник
    const npc = NPC_BY_ID[sc.desc.owner] || NPC_BY_ID.ponchik;
    const first = !S().dayFlags.fridgeTreat;
    sfx('door');
    if (first) {
      setDayFlag('fridgeTreat', 1);
      addItem('dishes', 'donut', 1);
    }
    return message({
      title: `Холодильник: ${npc.name}`,
      icon: '🧊',
      html: `<p class="center big-emoji">🍕🍩🧀</p><p class="center">Вот это да! Двенадцать пицц, гора пончиков, сыр, торт и банка огурчиков. На дверце записка: <b>«НЕ ТРОГАТЬ! Ну ладно, один пончик можно»</b>.</p>
        <p class="center">${first ? '<b>+1 🍩 Пончик</b> — он уже в твоём рюкзаке!' : 'Сегодня ты пончик уже брала. Завтра можно ещё один 😉'}</p>`,
      buttons: [{ text: first ? 'Спасибо!' : 'Закрыть дверцу' }],
    });
  },
  'гигантский холодильник: дома — холодильник, в гостях — угощение раз в день',
);

register(
  'oven',
  (p, ctx) => {
    const sc = ctx.scene,
      it = ctx.item;
    sfx('hiss');
    if (sc && it) sc.burst(it.x, sc.geo.fy(it.floor) - 120, 'steam', 5);
    toast(
      pick([
        'М-м-м! Из духовки пахнет пирогом 🥧',
        'Пирог румянится. Ещё пять минуточек… 🥧',
        'Тёплая! Сразу видно: тут любят печь пироги 🥧',
      ]),
    );
    emit('thing', { id: it ? it.id : 'oven', owner: (sc && sc.desc.owner) || null });
  },
  'духовка с пирогом',
);
