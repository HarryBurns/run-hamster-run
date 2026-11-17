// Все дома-описания игры одним списком: main.js превращает каждое в сцену «движка домов» (engine/side).
//  - дома жителей (home_<житель>): чужая мебель, хозяин внутри; вход — действие 'home-of:<житель>';
//  - своё жильё (id — как в таблице HOMES, data/estate.js): мебель в сохранении; вход — действие 'home:<id>';
//  - другие дома: курортный отель «Морская звезда» (П.17, hotel.js) — вход из города, действие 'scene:hotel';
//  - дома «тайных мест» (этап 13): избушка лесника, шале, пирамида, шатёр… — вход 'inside:<id>' (features/inside.js).
// Новый дом: файл с описанием рядом + строка здесь (и строка в HOMES, если его можно купить).
import villa from './villa.js';
import flat from './flat.js';
import bungalow from './bungalow.js';
import penthouse from './penthouse.js';
import cabin from './cabin.js';
import suite from './suite.js';
import plusha from './home_plusha.js';
import ponchik from './home_ponchik.js';
import senya from './home_senya.js';
import busya from './home_busya.js';
import prof from './home_prof.js';
import myata from './home_myata.js';
import bob from './home_bob.js';
import zefirka from './home_zefirka.js';
import hotel from './hotel.js';
import hutShishkin from './hut_shishkin.js';
import chalet from './chalet.js';
import { pyramid, tent } from './desert_inside.js';
import { temple, camp } from './jungle_inside.js';
import { chief, guest, bum, laguna } from './island_huts.js';
import grotto from './grotto.js';

/** Своё жильё: вилла и то, что продаёт риелтор (в том числе заготовки «скоро»). */
export const OWN_HOMES = [villa, flat, bungalow, penthouse, cabin, suite];
/** Дома жителей. */
export const NPC_HOMES = [plusha, ponchik, senya, busya, prof, myata, bob, zefirka];
/** Другие дома: отель. */
export const OTHER_HOUSES = [hotel];
/**
 * Дома «тайных мест» (этап 13): чужая мебель, хозяин внутри (его действие — как у него на улице), без persist и exit —
 * дверь ведёт назад к двери снаружи; вход — действие 'inside:<id>' (features/inside.js).
 */
export const LAND_HOUSES = [hutShishkin, chalet, pyramid, tent, temple, camp, chief, guest, bum, laguna, grotto];
export const HOUSES = [...OWN_HOMES, ...NPC_HOMES, ...OTHER_HOUSES, ...LAND_HOUSES];
export const HOUSE_BY_ID = Object.fromEntries(HOUSES.map((h) => [h.id, h]));
/** Имя сцены дома жителя. */
export const npcHomeScene = (npc) => 'home_' + npc;
