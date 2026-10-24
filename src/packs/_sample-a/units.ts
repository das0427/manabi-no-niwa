/**
 * 見本パック A の単元データ（テスト用。VITE_MNW_SAMPLE_PACKS=1 のビルドだけに入る）。
 * パックの中で複数のモジュールに分けても、同じパックのチャンクに入ることの確認用。
 */
export const SAMPLE_A_UNITS = {
  'sample-a.count': {
    title: 'みほん A かぞえる',
    items: [1, 2, 3, 4, 5],
    audio: 'audio/_sample-a/hello.mp3',
  },
  'sample-a.done': {
    title: 'みほん A おわり',
    items: [],
    audio: 'audio/_sample-a/done.mp3',
  },
} as const;
