/**
 * おえかきの保存に失敗したときの、保護者向けの案内（X-SV-03）。
 * 子供には！の絵と「おうちの ひとに みせてね」だけを見せ、ここの文は保護者向けの枠に出す。
 * 作品は消さない（画面を開いている間は絵が残り、次の操作でまた保存を試す）。
 */
import type { StorageHealth } from '../core/types';

export interface SaveHelp {
  /** 何が起きたか（1文） */
  title: string;
  /** してほしいこと（順に） */
  steps: string[];
}

export function saveHelp(health: StorageHealth, unavailable: boolean): SaveHelp {
  const keep =
    'この画面を閉じる前に「がぞうに する」（右上の絵の札、またはこの下の札）で絵を画像として保存すると、今の絵を残せます。';
  if (unavailable || health === 'unavailable') {
    return {
      title: 'この端末（ブラウザ）では作品を保存できない状態です。',
      steps: [
        keep,
        'ブラウザのプライベート（シークレット）ウィンドウや、サイトのデータの保存を止める設定になっていないかご確認ください。',
      ],
    };
  }
  if (health === 'full') {
    return {
      title: '保存できる容量がいっぱいのため、作品を保存できませんでした。',
      steps: [
        keep,
        '保護者画面の「データ」で記録と作品を書き出して保管してから、「さくひん」で不要な作品を削除してください。',
        '端末の空き容量を増やすと、次に描いたときに自動で保存し直します（「もう いちど」でも試せます）。',
      ],
    };
  }
  return {
    title: '作品を保存できませんでした。',
    steps: [
      keep,
      '「もう いちど」を押すと保存し直します。続けて失敗する場合は、保護者画面の「データ」で保存の状態と空き容量をご確認ください。',
    ],
  };
}
