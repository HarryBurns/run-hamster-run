// Мини-игры: запуск, запись результата, награды.
import { addItem, addClothes, award, spendMinutes, recordPlay } from '../core/actions.js';
import { emit } from '../core/events.js';
import { register } from '../core/registry.js';
import { G, cal, hasClothes, playerLook } from '../core/state.js';
import { shuffle } from '../core/util.js';
import { NPCS, npcLook, FASHION_THEMES } from '../data/index.js';
import { runMinigame } from '../minigames/host.js';
import { openLayer } from '../ui/modals.js';
import { toast } from '../ui/toast.js';
import { clothesPanel, scoreOutfit } from './wardrobe.js';

const S = () => G.state;

register('minigame', (p) => playMinigame(p.arg), 'мини-игра: minigame:<id>');

export const MG_NAMES = {
  swim: '🏊 Плавание',
  teacher: '👩‍🏫 Учительница',
  doctor: '🩺 Доктор',
  chef: '👩‍🍳 Шеф-повар',
  fishing: '🎣 Рыбалка',
  fashion: '👠 Показ мод',
};

// Чем занятия делятся с мини-играми (сами мини-игры features/ не импортируют — всё приходит через host.info).
const TOOLS = {
  fashion: () => ({ fashion: { clothesPanel, scoreOutfit, themes: FASHION_THEMES, getLook: playerLook } }),
};

export async function playMinigame(id, extra = {}) {
  const s = S();
  const plays = s.plays[id] || 0;
  const closeLayer = openLayer({ cover: true }); // мини-игра закрывает весь экран: город под ней не рисуем
  let res = null;
  try {
    res = await runMinigame(id, {
      look: playerLook(),
      name: s.name,
      season: cal().season,
      level: Math.min(4, Math.floor(plays / 2)),
      friends: shuffle(NPCS).map((n) => ({ id: n.id, name: n.name, look: npcLook(n.id), small: n.small })),
      ...(TOOLS[id] ? TOOLS[id]() : {}),
      ...extra,
    });
  } catch (e) {
    console.error(e);
    toast('Не получилось открыть игру. Попробуй ещё раз!');
  }
  closeLayer();
  if (!res) return null;
  recordPlay(id, res.stars);
  spendMinutes(40, 23 * 60 + 30);
  if (id === 'fishing' && res.extra && res.extra.fish) {
    addItem('ing', 'fish', res.extra.fish);
    toast(`В рюкзаке +${res.extra.fish} 🐟`, 'good');
  }
  if (res.stars === 3) award('x_3stars');
  if (id === 'swim' && res.stars === 3 && !hasClothes('medal')) {
    addClothes('medal');
    toast('Тебе вручили золотую медаль! Она в шкафу 🥇', 'good');
  }
  emit('minigame', { id, stars: res.stars });
  emit('hud');
  return res;
}

export function goFishing(spot) {
  playMinigame('fishing', { spot });
}

register('fish', (p) => goFishing(p.arg), 'рыбалка: fish:<место>');
