// Сад: грядки во дворе виллы.
// Каждую культуру сажают в свой сезон (data/seasons.js): зимой и весной — салат (зимой грядки под парничком),
// весной и летом — клубнику, летом — помидоры, летом и осенью — морковку, осенью — подсолнухи и тыкву.
// Вне сезона семена посадить нельзя — подсказка скажет, когда можно. Что уже посажено — дорастает в любое время.
import { plantSeed, harvestBed } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { emit } from '../core/events.js';
import { register } from '../core/registry.js';
import { G, cal, count } from '../core/state.js';
import { el, plural } from '../core/util.js';
import { ING_BY_ID, SEEDS, SEED_BY_ID, canSow, whenRipe } from '../data/index.js';
import { openPanel } from '../ui/panel.js';
import { toast } from '../ui/toast.js';

const S = () => G.state;

/** Можно ли сейчас сажать эти семена (сезон культуры). */
export const canPlantNow = (seedId) => !!SEED_BY_ID[seedId] && canSow(SEED_BY_ID[seedId], cal().month);
/** Добрая подсказка, когда сажают культуру: «Тыкву сажают осенью 🍂». */
export const sowHint = (sd) => `${sd.sow} сажают ${whenRipe(sd.crop, true)}`;
/** Что можно сажать в этом сезоне: «🥬 салат, 🍓 клубнику». */
const sowNow = () =>
  SEEDS.filter((sd) => canPlantNow(sd.id))
    .map((sd) => ING_BY_ID[sd.crop].e + ' ' + sd.sow.toLowerCase())
    .join(', ');

/** Посадить семена на грядку i. false — не сезон (и подсказка, когда можно) или таких семян нет. */
export function plantOn(i, seedId) {
  const sd = SEED_BY_ID[seedId];
  if (!sd || !count('seeds', seedId) || S().garden[i].seed) return false;
  if (!canPlantNow(seedId)) {
    sfx('pop');
    toast(`${sowHint(sd)}. Сейчас можно сажать: ${sowNow()}.`);
    return false;
  }
  plantSeed(i, seedId);
  sfx('dig');
  toast(`Посажено: ${sd.name} 🌱`, 'good');
  emit('plant');
  return true;
}

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
  const c = cal();
  const have = SEEDS.filter((s) => count('seeds', s.id) > 0).sort((x, y) => canPlantNow(y.id) - canPlantNow(x.id));
  if (!have.length) {
    toast(`Нет семян. Они продаются в ТЦ «Уютный дом» 🌱 Сейчас можно сажать: ${sowNow()}.`);
    return;
  }
  openPanel({
    title: 'Что посадим?',
    icon: '🌱',
    cls: 'narrow',
    render(body, tab, panel) {
      const grid = el('div', 'grid');
      for (const sd of have) {
        const ing = ING_BY_ID[sd.crop],
          now = canPlantNow(sd.id);
        const card = el('div', 'card tap' + (now ? '' : ' away'));
        card.appendChild(el('div', 'e', ing.e));
        card.appendChild(el('div', 'nm', sd.name));
        card.appendChild(el('span', 'cnt', '×' + count('seeds', sd.id)));
        card.appendChild(
          el(
            'div',
            'muted',
            now ? `${sd.days} ${plural(sd.days, 'ночь', 'ночи', 'ночей')}` : `Не сезон: ${sowHint(sd).toLowerCase()}`,
          ),
        );
        card.onclick = () => {
          if (plantOn(i, sd.id)) panel.close();
        };
        grid.appendChild(card);
      }
      body.appendChild(grid);
      body.appendChild(
        el(
          'p',
          'muted center',
          `Сейчас ${c.seasonName.toLowerCase()} ${c.seasonIcon} — можно сажать: ${sowNow()}.${have.some((sd) => canPlantNow(sd.id)) ? '' : ' Семена — в ТЦ «Уютный дом».'}${c.season === 'winter' ? ' Зимой грядки укрыты парничком.' : ''}`,
        ),
      );
    },
  });
}

register('garden', (p) => gardenBed(+p.arg), 'грядка: garden:<номер>');
