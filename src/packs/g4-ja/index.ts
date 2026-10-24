import type { PackContent } from '../../curriculum/types';
import { okurigana } from './okurigana';
import { idioms } from './idioms';
import { plainPoliteStyle } from './plain-polite-style';
import { infoCompare } from './info-compare';
import { readSummary } from './read-summary';
import { readFeelings } from './read-feelings';
import { writeReport } from './write-report';

const pack: PackContent = {
  packId: 'g4-ja',
  units: [
    okurigana,
    idioms,
    plainPoliteStyle,
    infoCompare,
    readSummary,
    readFeelings,
    writeReport,
  ],
};

export default pack;
