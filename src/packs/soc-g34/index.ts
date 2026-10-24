import type { PackContent } from '../../curriculum/types';
import type { Allow } from './util';
import { mapSymbols, mapSymbolsAllow } from './map-symbols';
import { shopWork, shopWorkAllow } from './shop-work';
import { cityChanges, cityChangesAllow } from './city-changes';
import { prefectures, prefecturesAllow } from './prefectures';
import { waterWaste, waterWasteAllow } from './water-waste';
import { disaster, disasterAllow } from './disaster';

const pack: PackContent = {
  packId: 'soc-g34',
  units: [mapSymbols, shopWork, cityChanges, prefectures, waterWaste, disaster],
};

/** 単元ごとの、学年より上の字を使ってよい理由（テストの許可リスト） */
export const ALLOW: Readonly<Record<string, Allow>> = {
  'g3.soc.map-symbols': mapSymbolsAllow,
  'g3.soc.shop-work': shopWorkAllow,
  'g3.soc.city-changes': cityChangesAllow,
  'g4.soc.prefectures': prefecturesAllow,
  'g4.soc.water-waste': waterWasteAllow,
  'g4.soc.disaster': disasterAllow,
};

export default pack;
