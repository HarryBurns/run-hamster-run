// «Скоро открытие!» — временная заглушка для мест, которые уже стоят в городе, но ещё не открыты.
// Сейчас таких мест нет: агентство, квартира и бунгало открылись (features/homes.js), курортный отель — тоже (П.17,
// features/hotel.js). Тропа в лес и караван в пустыню — не «скоро», а тайные места: у них действие way (features/quests.js).
// Место называет действие 'soon' с ключом: { do: 'soon', key: 'место' } или 'soon:место'; подпись — таблица SOON.
// Когда занятие готово — у места просто меняют act на настоящее действие (locations/town.js).
import { sfx } from '../core/audio.js';
import { register } from '../core/registry.js';
import { toast } from '../ui/toast.js';

/** Что сказать у двери: ключ места → [название, добрая подсказка]. Пусто — все места открыты. */
export const SOON = {};

register(
  'soon',
  (p, ctx) => {
    const key = p.key || p.arg,
      [name, hint] = SOON[key] || [(ctx.building && ctx.building.name) || 'Это место', ''];
    sfx('tap');
    toast(`🚧 Скоро открытие! ${name}. ${hint}`.trim());
  },
  'заглушка «Скоро открытие!»: soon:<ключ места> или { key } (сейчас ни одного места)',
);
