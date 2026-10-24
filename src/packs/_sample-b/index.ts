/**
 * 見本パック B（小学生のパック扱い。テスト用）。音声なし。
 * 共有データ src/packs/_data/strokes/kanji-g1.json を見本パック A と共有する。
 */
import strokes from '../_data/strokes/kanji-g1.json';
import type { SamplePackContent } from '../loader';

const pack: SamplePackContent = {
  units: {
    'sample-b.first': { title: 'みほん B', firstChar: Object.keys(strokes.chars)[0] ?? '' },
  },
};

export default pack;
