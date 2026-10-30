/**
 * 幼児ホームの「えいご」の札（設計: docs/expansion/p2-design/preschool-english.md 8章）。
 * 右の列の一番下に置く（左の 3×3 は区分ごとに位置が固定なので動かさない）。2歳段階のホームには出さない
 * （札4枚の決まり。ux-by-age 2.1）。「きょうの おすすめ」の候補にも入れない（日本語の遊びを押しのけない）。
 * `preschoolHome.ts` は他の担当が触るので、ファイルを分ける。
 *
 * 札の単元は、いま作ってある P1 の単元だけを書く。P2（p23.en.move・p4.en.where・p5.en.picture-book・
 * p5.en.first-sound・p5.en.abc）は、単元を作るときにここへ足す（索引に無い単元は子供画面に出ない）。
 */
import { PRESCHOOL_HOMES, type HomeCard } from './preschoolHome';

type PreStage = 'p23' | 'p4' | 'p5';

export const PRESCHOOL_EN_CARDS: Record<PreStage, HomeCard> = {
  p23: { id: 'eigo', title: 'えいご', icon: 'enpre-icon', units: ['p23.en.words'] },
  p4: {
    id: 'eigo',
    title: 'えいご',
    icon: 'enpre-icon',
    units: [
      'p4.en.words',
      'p4.en.colors-numbers',
      'p4.en.move',
      'p4.en.hello',
      'p4.en.picture-book',
    ],
  },
  // 5歳の札には p4 の move・hello・picture-book もつなぐ（5歳から英語を始める子が からだ・あいさつ・えほんで遊べるように）
  p5: {
    id: 'eigo',
    title: 'えいご',
    icon: 'enpre-icon',
    units: ['p5.en.phrases', 'p5.en.shop', 'p4.en.move', 'p4.en.hello', 'p4.en.picture-book'],
  },
};

/** 札を探す（ふつうの札 → えいごの札の順）。CardChooser と Explore が使う */
export function findPreschoolCard(stage: PreStage, cardId: string): HomeCard | undefined {
  return (
    PRESCHOOL_HOMES[stage]?.cards.find((c) => c.id === cardId) ??
    (PRESCHOOL_EN_CARDS[stage].id === cardId ? PRESCHOOL_EN_CARDS[stage] : undefined)
  );
}

/**
 * 幼児ホームに「えいご」の札を出すか。2歳段階は出さない。保護者の設定（showPreschoolEnglish。省略時は出す）で隠せる。
 * 札に子供画面に出せる単元があるか（cardUnits）は呼ぶ側で確かめる
 */
export function showsEnglishCard(opts: {
  stage2: boolean;
  showPreschoolEnglish?: boolean;
}): boolean {
  return !opts.stage2 && opts.showPreschoolEnglish !== false;
}
