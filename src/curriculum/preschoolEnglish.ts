/**
 * 幼児ホームの「えいご」の札（設計: docs/expansion/p2-design/preschool-english.md 8章）。
 * 右の列の一番下に置く（左の 3×3 は区分ごとに位置が固定なので動かさない）。2歳段階のホームには出さない
 * （札4枚の決まり。ux-by-age 2.1）。「きょうの おすすめ」の候補にも入れない（日本語の遊びを押しのけない）。
 * `preschoolHome.ts` は他の担当が触るので、ファイルを分ける。
 *
 * 札の単元は、作ってある単元（P1 と P2）を書く。P2 の単元は最初は partial（英語の音声の全件試聴の後に ready）。
 * 5歳の札は選ぶ画面の上限6枚までなので、設計書 8.3・13章 #7 のとおり p5 の単元を優先し、p4.en.move・p4.en.picture-book は
 * 4歳の札と「ほかの がくねん」の 4さい から入る。p5.en.abc は既定で隠れる（保護者が開いたときだけ）ので、ふだんは5枚。
 */
import { PRESCHOOL_HOMES, type HomeCard } from './preschoolHome';

type PreStage = 'p23' | 'p4' | 'p5';

export const PRESCHOOL_EN_CARDS: Record<PreStage, HomeCard> = {
  p23: {
    id: 'eigo',
    title: 'えいご',
    icon: 'enpre-icon',
    units: ['p23.en.words', 'p23.en.move'],
  },
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
      'p4.en.where',
    ],
  },
  // 5歳の札: 選ぶ画面は最大6枚（13章 #7）。p4.en.hello は5歳から英語を始める子の あいさつの入口として残す
  p5: {
    id: 'eigo',
    title: 'えいご',
    icon: 'enpre-icon',
    units: [
      'p5.en.phrases',
      'p5.en.shop',
      'p5.en.picture-book',
      'p5.en.first-sound',
      'p4.en.hello',
      'p5.en.abc',
    ],
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
