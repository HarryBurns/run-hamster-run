// Сад: грядки во дворе виллы.
import { plantSeed, harvestBed } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { emit } from '../core/events.js';
import { register } from '../core/registry.js';
import { G, count } from '../core/state.js';
import { el, plural } from '../core/util.js';
import { ING_BY_ID, SEEDS, SEED_BY_ID } from '../data/index.js';
import { openPanel } from '../ui/panel.js';
import { toast } from '../ui/toast.js';

const S = () => G.state;

export function gardenBed(i) {
  const bed = S().garden[i];
  if (bed.seed) {
    const sd = SEED_BY_ID[bed.seed],
      ing = ING_BY_ID[sd.crop];
    if (bed.age >= sd.days) {
      harvestBed(i, sd.crop, sd.n);
      sfx('pop');
      toast(`Урожай! +${sd.n} ${ing.e} ${ing.name}`, 'good');
      emit('harvest');
    } else {
      const left = sd.days - bed.age;
      toast(`${ing.e} Растёт… Ещё ${left} ${plural(left, 'ночь', 'ночи', 'ночей')}.`);
    }
    return;
  }
  const have = SEEDS.filter((s) => count('seeds', s.id) > 0);
  if (!have.length) {
    toast('Нет семян. Они продаются в ТЦ «Уютный дом» 🌱');
    return;
  }
  openPanel({
    title: 'Что посадим?',
    icon: '🌱',
    cls: 'narrow',
    render(body, tab, panel) {
      const grid = el('div', 'grid');
      for (const sd of have) {
        const ing = ING_BY_ID[sd.crop];
        const card = el('div', 'card tap');
        card.appendChild(el('div', 'e', ing.e));
        card.appendChild(el('div', 'nm', sd.name));
        card.appendChild(el('span', 'cnt', '×' + count('seeds', sd.id)));
        card.appendChild(el('div', 'muted', `${sd.days} ${plural(sd.days, 'ночь', 'ночи', 'ночей')}`));
        card.onclick = () => {
          plantSeed(i, sd.id);
          sfx('dig');
          toast(`Посажено: ${sd.name} 🌱`, 'good');
          emit('plant');
          panel.close();
        };
        grid.appendChild(card);
      }
      body.appendChild(grid);
    },
  });
}

register('garden', (p) => gardenBed(+p.arg), 'грядка: garden:<номер>');
