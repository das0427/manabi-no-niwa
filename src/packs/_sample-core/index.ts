/**
 * 見本パック（コア同梱。幼児のパック p23 / p4 / p5 と同じ扱い。テスト用）。
 * コアのプリキャッシュに入り、取得の操作なしでオフラインでも読める。
 */
import type { SamplePackContent } from '../loader';

const pack: SamplePackContent = {
  units: {
    'sample-core.hello': { title: 'みほん（ほんたい）', items: ['あ', 'い', 'う'] },
  },
};

export default pack;
