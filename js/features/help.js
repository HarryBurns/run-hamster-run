// «КАК ИГРАТЬ» (⚙️ меню и окно «Добро пожаловать»): только основы, коротко и с картинками. Что показать, зависит от
// устройства: играют пальцем (телефон, планшет) — «нажми, куда идти» и «нажми на вещь или жителя»; мышью и клавиатурой
// (компьютер) — стрелки или WASD, E и Esc. Дальше для всех — монетки, карта, «Обустроить» и улучшение дома.
// Остальному игра учит сама: соседи (features/welcome.js), подсказки и журнал заданий. Картинки — маленькие SVG,
// нарисованные кодом (как значки), без файлов.
import { message } from '../ui/panel.js';

const O = '#4a3728'; // контур — как в рисунках игры

/** Играют пальцем: главный указатель — касание (телефон, планшет без мыши). */
export function touchFirst() {
  try {
    return (
      matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && !matchMedia('(hover: hover)').matches)
    );
  } catch (e) {
    return false;
  }
}

// ---------- картинки ----------
const svg = (inner) => `<svg viewBox="0 0 96 72" width="96" height="72" aria-hidden="true">${inner}</svg>`;
/** Мордочка хомячка: центр (x, y), размер s, мех fur. */
const ham = (x, y, s = 1, fur = '#f2b56b') =>
  `<g transform="translate(${x} ${y}) scale(${s})" stroke="${O}" stroke-width="2">` +
  `<circle cx="-10" cy="-12" r="5.5" fill="${fur}"/><circle cx="10" cy="-12" r="5.5" fill="${fur}"/>` +
  `<circle cx="-10" cy="-12" r="2.4" fill="#ffb3c6" stroke="none"/><circle cx="10" cy="-12" r="2.4" fill="#ffb3c6" stroke="none"/>` +
  `<ellipse cx="0" cy="0" rx="15" ry="13.5" fill="${fur}"/>` +
  `<ellipse cx="0" cy="5" rx="8.5" ry="6" fill="#fff3e0" stroke="none"/>` +
  `<circle cx="-5.5" cy="-2.5" r="1.9" fill="${O}" stroke="none"/><circle cx="5.5" cy="-2.5" r="1.9" fill="${O}" stroke="none"/>` +
  `<circle cx="0" cy="1.5" r="1.6" fill="#ff8fab" stroke="none"/></g>`;
/** Значок-эмодзи как часть картинки. */
const emo = (x, y, e, size = 22) => `<text x="${x}" y="${y}" font-size="${size}" text-anchor="middle">${e}</text>`;
/** Клавиша с подписью. */
const key = (x, y, w, label, fs = 11) =>
  `<g><rect x="${x}" y="${y}" width="${w}" height="19" rx="4" fill="#fff" stroke="${O}" stroke-width="2"/>` +
  `<rect x="${x + 2.5}" y="${y + 14}" width="${w - 5}" height="3" rx="1.5" fill="#eadcc6"/>` +
  `<text x="${x + w / 2}" y="${y + 12.5}" font-size="${fs}" font-weight="900" text-anchor="middle" fill="${O}">${label}</text></g>`;
/** Четыре клавиши крестом: верх, лево, низ, право. */
const pad = (x, y, [up, left, down, right]) =>
  key(x + 20, y, 19, up) + key(x, y + 21, 19, left) + key(x + 20, y + 21, 19, down) + key(x + 40, y + 21, 19, right);
const coin = (x, y) =>
  `<ellipse cx="${x}" cy="${y + 3}" rx="11" ry="5" fill="#e8a400" stroke="${O}" stroke-width="2"/>` +
  `<ellipse cx="${x}" cy="${y}" rx="11" ry="5" fill="#ffd43b" stroke="${O}" stroke-width="2"/>`;
const house = (x, y, w, h, floors = 1) => {
  let s = `<rect x="${x}" y="${y - h}" width="${w}" height="${h}" rx="2" fill="#fff3d6" stroke="${O}" stroke-width="2"/>`;
  s += `<polygon points="${x - 4},${y - h} ${x + w / 2},${y - h - w * 0.45} ${x + w + 4},${y - h}" fill="#f76e5c" stroke="${O}" stroke-width="2" stroke-linejoin="round"/>`;
  for (let f = 0; f < floors; f++) {
    const fy = y - h + 5 + f * (h / floors);
    s += `<rect x="${x + 4}" y="${fy}" width="${w * 0.28}" height="${h / floors - 12}" rx="1.5" fill="#a5d8ff" stroke="${O}" stroke-width="1.5"/>`;
    s += `<rect x="${x + w - 4 - w * 0.28}" y="${fy}" width="${w * 0.28}" height="${h / floors - 12}" rx="1.5" fill="#a5d8ff" stroke="${O}" stroke-width="1.5"/>`;
  }
  return s;
};

const PICS = {
  // нажми, куда идти: хомячок, пунктир и кружок на земле, палец
  tapGo: svg(
    `<rect x="0" y="50" width="96" height="22" rx="6" fill="#bfe6a8"/>` +
      `<path d="M26 56 Q48 42 68 56" fill="none" stroke="${O}" stroke-width="2.4" stroke-dasharray="4 5" stroke-linecap="round"/>` +
      `<ellipse cx="70" cy="57" rx="10" ry="4" fill="none" stroke="#fff" stroke-width="2.4"/>` +
      `<ellipse cx="70" cy="57" rx="16" ry="6.5" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="2"/>` +
      ham(20, 42, 0.95) +
      emo(78, 46, '👆', 24),
  ),
  // нажми на вещь или жителя: житель машет, рядом «Привет!», палец
  tapThing: svg(
    `<rect x="0" y="54" width="96" height="18" rx="6" fill="#bfe6a8"/>` +
      ham(34, 40, 1.1, '#d9b08c') +
      `<rect x="50" y="6" width="45" height="18" rx="8" fill="#fff" stroke="${O}" stroke-width="2"/>` +
      `<polygon points="56,22 52,30 63,23" fill="#fff" stroke="${O}" stroke-width="2" stroke-linejoin="round"/>` +
      `<text x="72" y="19" font-size="9.5" font-weight="900" text-anchor="middle" fill="${O}">Привет!</text>` +
      emo(58, 66, '👆', 24),
  ),
  // E — с тем, что рядом
  keyE: svg(
    key(4, 26, 26, 'E', 13) +
      `<path d="M34 36 H44" stroke="${O}" stroke-width="2.4" stroke-linecap="round"/>` +
      `<polygon points="44,31 51,36 44,41" fill="${O}"/>` +
      ham(66, 44, 0.9) +
      emo(86, 30, '✨', 14) +
      `<rect x="0" y="58" width="96" height="14" rx="6" fill="#bfe6a8"/>`,
  ),
  // мышь: щелчок
  mouse: svg(
    `<rect x="30" y="10" width="34" height="52" rx="17" fill="#fff" stroke="${O}" stroke-width="2.4"/>` +
      `<path d="M30 30 H64 M47 10 V30" stroke="${O}" stroke-width="2"/>` +
      `<path d="M31 29 V27 A16 16 0 0 1 46 11 V29 Z" fill="#ffd43b"/>` +
      `<path d="M18 14 l-6 -5 M16 24 h-8 M20 6 l-3 -6" stroke="#f59f00" stroke-width="2.6" stroke-linecap="round"/>`,
  ),
  // Esc — меню
  esc: svg(
    key(8, 26, 34, 'Esc', 11) +
      `<path d="M46 36 H56" stroke="${O}" stroke-width="2.4" stroke-linecap="round"/>` +
      `<polygon points="56,31 63,36 56,41" fill="${O}"/>` +
      emo(80, 45, '⚙️', 26),
  ),
  // монетки: тратить и зарабатывать
  coins: svg(
    coin(48, 52) +
      coin(48, 44) +
      coin(48, 36) +
      coin(30, 54) +
      coin(66, 54) +
      emo(16, 28, '🛍️', 20) +
      emo(80, 28, '⭐', 20) +
      `<path d="M38 24 L26 30" stroke="${O}" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="3 3"/>` +
      `<path d="M70 30 L58 24" stroke="${O}" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="3 3"/>`,
  ),
  // карта: сложенная, тропинка к звёздочке
  map: svg(
    `<polygon points="8,14 34,8 62,14 88,8 88,60 62,66 34,60 8,66" fill="#fff3bf" stroke="${O}" stroke-width="2.2" stroke-linejoin="round"/>` +
      `<path d="M34 8 V60 M62 14 V66" stroke="${O}" stroke-opacity=".35" stroke-width="1.6"/>` +
      `<ellipse cx="24" cy="46" rx="11" ry="8" fill="#74c0fc"/><circle cx="70" cy="28" r="7" fill="#8ce99a"/>` +
      `<path d="M18 30 Q40 52 60 40 T76 22" fill="none" stroke="#e8590c" stroke-width="2.4" stroke-dasharray="4 4" stroke-linecap="round"/>` +
      `<circle cx="18" cy="30" r="4" fill="#ff6b9d" stroke="${O}" stroke-width="1.6"/>` +
      emo(77, 24, '⭐', 16),
  ),
  // «Обустроить»: диван двигается, молоток
  decor: svg(
    `<rect x="0" y="58" width="96" height="14" rx="4" fill="#e9c99a"/>` +
      `<rect x="22" y="32" width="46" height="18" rx="5" fill="#ff8fab" stroke="${O}" stroke-width="2"/>` +
      `<rect x="18" y="40" width="54" height="14" rx="5" fill="#f06595" stroke="${O}" stroke-width="2"/>` +
      `<path d="M24 54 V60 M66 54 V60" stroke="${O}" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="M6 44 H14 M84 44 H76" stroke="${O}" stroke-width="2.4" stroke-linecap="round"/>` +
      `<polygon points="3,44 9,39 9,49" fill="${O}"/><polygon points="93,44 87,39 87,49" fill="${O}"/>` +
      emo(80, 24, '🔨', 20),
  ),
  // дом растёт: домик → дом побольше
  grow: svg(
    `<rect x="0" y="62" width="96" height="10" rx="4" fill="#bfe6a8"/>` +
      house(6, 62, 28, 20) +
      `<path d="M40 48 H50" stroke="${O}" stroke-width="2.4" stroke-linecap="round"/>` +
      `<polygon points="50,43 57,48 50,53" fill="${O}"/>` +
      house(60, 62, 32, 40, 2) +
      emo(88, 14, '✨', 13),
  ),
};
PICS.keys = svg(
  // стрелки и WASD — две «крестовины» рядом
  `<g transform="scale(.75) translate(0 12)">${pad(0, 14, ['↑', '←', '↓', '→'])}</g>` +
    `<g transform="scale(.75) translate(66 12)">${pad(0, 14, ['W', 'A', 'S', 'D'])}</g>` +
    `<text x="48" y="64" font-size="10" font-weight="800" text-anchor="middle" fill="${O}">или</text>`,
);

/** Карточки справки: картинка и текст. («сама» — в женском роде: при выборе героя — две формы.) */
function cards(touch, escMenu) {
  const list = touch
    ? [
        ['tapGo', '<b>Нажми на место</b> — и {хомячок|хомяшка} пойдёт туда.'],
        ['tapThing', '<b>Нажми на вещь или жителя</b> рядом — {хомячок|хомяшка} откроет, сядет или поговорит.'],
      ]
    : [
        ['keys', '<b>Стрелки или W A S D</b> — ходить. А можно мышкой: нажми, куда идти.'],
        ['keyE', '<b>E</b> — сделать что-то с тем, что рядом: открыть, сесть, поговорить.'],
        ['mouse', 'Или просто <b>нажми мышкой</b> на вещь или жителя.'],
      ];
  if (!touch && escMenu) list.push(['esc', '<b>Esc</b> — закрыть окно, а без окна — открыть меню ⚙️.']);
  list.push(
    ['coins', '<b>Монетки</b> 🪙 можно тратить на всякое: одежду, мебель, вкусности… А ещё их можно зарабатывать!'],
    ['map', '<b>Карта</b> 🗺️ — нажми на место на карте, и {хомячок сам|хомяшка сама} туда дойдёт.'],
    ['decor', '<b>Обустроить</b> 🔨 — двигай мебель и ставь новую из кладовки.'],
    ['grow', '<b>Дом можно улучшить</b>: пристройка, этажи, пруд — в агентстве «Свой домик».'],
  );
  return list;
}

/** Esc закрывает окно, а без окна открывает ⚙️ меню (features/pause.js); false — строчки про Esc в справке нет. */
export const ESC_MENU = true;

/** Окно «Как играть». touch — для тестов: показать справку для пальца (true) или для мыши и клавиатуры (false). */
export function showHelp({ touch = touchFirst() } = {}) {
  const html = cards(touch, ESC_MENU)
    .map(([pic, text]) => `<div class="howto-card" data-pic="${pic}">${PICS[pic]}<p>${text}</p></div>`)
    .join('');
  return message({
    title: 'Как играть',
    icon: '❓',
    cls: 'howto-panel',
    html: `<div class="howto ${touch ? 'touch' : 'keys'}">${html}</div>`,
    buttons: [{ text: 'Понятно!' }],
  });
}
