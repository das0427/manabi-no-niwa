import type { VoiceEntries } from '../../voice/types';

/** くらべっこ の音声台本（接頭辞 cmp.） */
export const voice = {
  // 2択・3択の問い（P1〜P4）
  'cmp.q.size.more': 'おおきいのは どっち？',
  'cmp.q.size.less': 'ちいさいのは どっち？',
  'cmp.q.length.more': 'ながいのは どっち？',
  'cmp.q.length.less': 'みじかいのは どっち？',
  'cmp.q.count.more': 'おおいのは どっち？',
  'cmp.q.count.less': 'すくないのは どっち？',
  'cmp.or-same': 'おなじ かも しれないよ',
  // 3つを並べる問い（P5）
  'cmp.q5.length.more': 'ながい じゅんに ならべてね',
  'cmp.q5.length.less': 'みじかい じゅんに ならべてね',
  'cmp.q5.count.more': 'おおい じゅんに ならべてね',
  'cmp.q5.count.less': 'すくない じゅんに ならべてね',
  // 最初の問題だけの短い説明
  'cmp.intro.pick': 'いいと おもう ほうを タップしてね',
  'cmp.intro.three': 'ひだり みぎ おなじ から えらんでね',
  'cmp.intro.order': 'タップした じゅんに ならぶよ',
  // 正解のとき
  'cmp.same-right': 'おなじ だったね',
  // ヒント1（比べ方を言う）
  'cmp.hint.size': 'おおきさを よく みてごらん',
  'cmp.hint.length': 'はしを みてごらん',
  'cmp.hint.count': 'かぞえて みよう',
  // ヒント2（具体化）
  'cmp.hint2.size': 'かさねて みると わかるよ',
  'cmp.hint2.length': 'はしに せんを ひいたよ',
  'cmp.hint2.count': 'ひとつずつ せんで むすんだよ',
  'cmp.hint2.count5': 'かずを かぞえたよ',
  // 完了画面（比べた量の種類）
  'cmp.done.size': 'おおきさを くらべたね',
  'cmp.done.length': 'ながさを くらべたね',
  'cmp.done.count': 'かずを くらべたね',
  'cmp.done.length-count': 'ながさと かずを くらべたね',
} satisfies VoiceEntries;
