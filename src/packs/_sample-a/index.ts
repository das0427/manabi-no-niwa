/**
 * 見本パック A（小学生のパック扱い。テスト用）。
 * - 音声: public/audio/_sample-a/*.mp3（パックの取得単位に入る）
 * - 共有データ: src/packs/_data/strokes/kanji-g1.json（見本パック B と共有）
 */
import strokes from '../_data/strokes/kanji-g1.json';
import type { SamplePackContent } from '../loader';
import { SAMPLE_A_UNITS } from './units';

const pack: SamplePackContent = {
  units: {
    ...SAMPLE_A_UNITS,
    'sample-a.kanji': { title: 'みほん A かんじ', chars: Object.keys(strokes.chars).length },
  },
};

export default pack;
