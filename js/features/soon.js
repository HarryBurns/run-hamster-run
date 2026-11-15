// «Скоро открытие!» — временная заглушка для мест, которые уже стоят в городе, но ещё не открыты: отель.
// (Агентство, квартира и бунгало уже открыты — features/homes.js. Тропа в лес и караван в пустыню — не «скоро»,
// а тайные места: у них действие way, features/quests.js.)
// Место называет действие 'soon' с ключом: { do: 'soon', key: 'hotel' } или 'soon:hotel'.
// Когда занятие готово — у места просто меняют act на настоящее действие (locations/town.js).
import { sfx } from '../core/audio.js';
import { register } from '../core/registry.js';
import { toast } from '../ui/toast.js';

/** Что сказать у двери: ключ места → [название, добрая подсказка]. */
export const SOON = {
  hotel: ['Отель «Морская звезда»', 'Маляры докрашивают номера — совсем скоро здесь встретят гостей.'],
};

register(
  'soon',
  (p, ctx) => {
    const key = p.key || p.arg,
      [name, hint] = SOON[key] || [(ctx.building && ctx.building.name) || 'Это место', ''];
    sfx('tap');
    toast(`🚧 Скоро открытие! ${name}. ${hint}`.trim());
  },
  'заглушка «Скоро открытие!»: soon:<ключ места> или { key } — hotel',
);
