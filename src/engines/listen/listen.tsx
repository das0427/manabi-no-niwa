/**
 * listen エンジン: 聞いて選ぶ。音声が問題の本体（英語の語・文、日本語の音・語、音の数）。
 *
 * - 問題を開くと音声を自動で鳴らす（実行枠が問題文を読んでいる間は待ってから）。読み上げの設定が off でも鳴らす
 *   （音声が本体のため。音を消すのは音量の設定で効く）。
 * - 最初の再生が終わるまで選択肢を押せない（curriculum-matrix 1.7）。音が出ない環境（音声の準備ができていない）では
 *   押せなくなったままにしない。
 * - 「もういちど きく」の札はいつでも押せる（止めてから最初から鳴らす）。
 * - 判定・検査は choice と同じ（正解1つ、または「すべて選ぶ」の集合一致）。
 * - 幼児の英語向けの拡張（省略可。ないときは今までどおり）:
 *     nameBack … 選択肢を触ると、その選択肢の sound（名前）を鳴らしてから答える
 *     replay … 不正解の後・ヒントを出した後に、問題の音声をもう一度鳴らす
 *     revealAudio … 正答を見せるとき（解説）に1回だけ鳴らす音声
 */
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { audio } from '../../core/audio/index';
import type { ChoiceOption, Item, ItemBase, RichText } from '../../curriculum/types';
import { Rt } from '../../text/Rt';
import { plainText } from '../../text/rich';
import { speechYomi } from '../../text/yomi';
import { Tap } from '../../ui/Tap';
import { VOICE_CATALOG, type VoiceSeq } from '../../voice/catalog/index';
import { registerRich } from '../../voice/dynamic';
import { earOnTop, wordTrait, type ChoiceResponse } from '../choice/choice';
import { PIC_GAP_U, picSpecOf } from '../choice/pics';
import { observeResize } from '../figure/svgText';
import type { EngineProps, Judgement } from '../types';
import { checkOptions, ChoiceOptions, correctLabels, judgeOptions } from './options';
import './listen.css';

export interface ListenSound {
  /**
   * 鳴らす文（RichText）。画面には出さない（答えが分かるため）。正答を見せるとき（revealed）に出す。
   * key が無いときは registerRich(packId, text) で音声キーを作る（日本語の文。mp3 が無ければ端末の音声で読む）。
   */
  text: RichText;
  /**
   * 音声キーを直接指定する（英語の mp3 など。public/audio/<key>.mp3）。使える文字は a-z 0-9 . _ - /。
   * 英字を含む文は key が必須（端末の日本語音声で英語を読ませない）。
   */
  key?: string;
}

export interface ListenItem extends ItemBase {
  engine: 'listen';
  /** 音声（1つ、または順に鳴らす複数。音の数を数える問題などは複数にして gapMs で間をあける） */
  audio: ListenSound | ListenSound[];
  /** 複数の音の間（ミリ秒。既定 500） */
  gapMs?: number;
  options: ChoiceOption[];
  /** 正解をすべて選ぶ（順不同の集合一致） */
  multi?: boolean;
  fixedOrder?: boolean;
  layout?: 'row' | 'grid' | 'column';
  /** 正答を見せるときも音声の文を出さない */
  hideTranscript?: boolean;
  /** 選択肢を触ると、その選択肢の sound を鳴らしてから答える（幼児の英語）。multi とは併用できない */
  nameBack?: boolean;
  /** 不正解の後・ヒントを出した後に、問題の音声をもう一度鳴らす */
  replay?: { afterWrong?: boolean; onHint?: boolean };
  /** 正答を見せるとき（解説）に1回だけ鳴らす音声。日本語の文（key なし）と英語（key あり）を混ぜてよい */
  revealAudio?: ListenSound[];
}

/** 名前を返す音声が終わらないときの打ち切り（音が出ない環境。ミリ秒） */
export const NAME_BACK_SILENT_MS = 1500;
/** 音が出る環境での、名前を返す音声の安全な打ち切り（ミリ秒） */
export const NAME_BACK_MAX_MS = 5000;

/** 答え: 選んだ選択肢の番号（multi は複数） */
export type ListenResponse = ChoiceResponse;

export const DEFAULT_GAP_MS = 500;
const KEY_RE = /^[a-z0-9._-]+(\/[a-z0-9._-]+)*$/;

export const soundsOf = (item: Pick<ListenItem, 'audio'>): ListenSound[] =>
  Array.isArray(item.audio) ? item.audio : [item.audio];

/** 音声の列（key があればそれ、無ければ文から作る）。key の音声が台本に無ければ、予備の読み上げ用に文を登録する */
export function soundSeq(packId: string, s: ListenSound): (string | number)[] {
  if (!s.key) return flatSeq(registerRich(packId, s.text));
  if (!Object.prototype.hasOwnProperty.call(VOICE_CATALOG, s.key))
    VOICE_CATALOG[s.key] = { text: plainText(s.text), yomi: speechYomi(s.text) };
  return [s.key];
}

export const flatSeq = (s: VoiceSeq): (string | number)[] => (typeof s === 'string' ? [s] : [...s]);

/** 再生する列（音と音の間に無音） */
export function listenSeq(item: Pick<ListenItem, 'audio' | 'gapMs'>, packId: string): VoiceSeq {
  const out: (string | number)[] = [];
  soundsOf(item).forEach((s, i) => {
    if (i > 0) out.push(item.gapMs ?? DEFAULT_GAP_MS);
    out.push(...soundSeq(packId, s));
  });
  return out;
}

export function judgeListen(item: ListenItem, picked: ListenResponse): Judgement {
  return judgeOptions(item, picked);
}

export function checkListen(item: ListenItem): string[] {
  const errs = checkOptions(item);
  const sounds = soundsOf(item);
  if (sounds.length === 0) errs.push('音声が無い');
  for (const s of sounds) {
    if (!s.text.trim()) errs.push('音声の文が空');
    if (s.key !== undefined && !KEY_RE.test(s.key))
      errs.push(`音声キー ${s.key} に使えない文字がある（a-z 0-9 . _ - /）`);
    if (s.key === undefined && /[A-Za-z]/.test(plainText(s.text)))
      errs.push(`英字を含む音声「${plainText(s.text)}」は key（録音の mp3）を指定する`);
  }
  if (item.gapMs !== undefined && (item.gapMs < 0 || item.gapMs > 5000))
    errs.push('gapMs は 0〜5000');
  const checkSound = (s: ListenSound, where: string) => {
    if (!s.text.trim()) errs.push(`${where}の文が空`);
    if (s.key !== undefined && !KEY_RE.test(s.key))
      errs.push(`${where}の音声キー ${s.key} に使えない文字がある（a-z 0-9 . _ - /）`);
    if (s.key === undefined && /[A-Za-z]/.test(plainText(s.text)))
      errs.push(`英字を含む${where}「${plainText(s.text)}」は key（録音の mp3）を指定する`);
  };
  for (const s of item.revealAudio ?? []) checkSound(s, '答えの後の音声');
  if (item.nameBack) {
    if (item.multi) errs.push('nameBack は multi と併用できない');
    item.options.forEach((o, i) => {
      if (!o.sound) errs.push(`nameBack の選択肢 ${i + 1} に sound が無い`);
      else checkSound(o.sound, `選択肢 ${i + 1} の sound`);
    });
  }
  return errs;
}

export const listenAnswerText = (item: ListenItem): RichText => correctLabels(item);

// ---- 画面 ----

type Props = Omit<EngineProps<Item, ListenResponse>, 'item'> & { item: ListenItem };

/** 実行枠が問題文を読み上げている間は待つ（同時に鳴らすと、後から鳴らした方が先の音を止めるため） */
function whenQuiet(cb: () => void): () => void {
  let unsub: (() => void) | null = null;
  const t = window.setTimeout(() => {
    if (!audio.getState().speaking) {
      cb();
      return;
    }
    unsub = audio.subscribe((s) => {
      if (s.speaking) return;
      unsub?.();
      unsub = null;
      cb();
    });
  }, 0);
  return () => {
    window.clearTimeout(t);
    unsub?.();
  };
}

/** 文の終わりの記号（日本語の「。！？」・英語の「.!?」。閉じ括弧・引用符が後ろに付くときも）で終わる音の文 */
const SENTENCE_END = /([。！？]|[.!?])[」』）)”"’'】]*$/u;

/**
 * 書き起こしで、前の音（文）と次の音の間に置くもの。語の並び（文の終わりの記号で終わらない音どうし）は「・」。
 * 前の文が文の終わりの記号で終わるときは置かない: 日本語（。！？）は何も置かず、英語（.!?）は空白 1 つ
 * （「いました。・まいにち」と区切りが重ならない。text-layout-fixes 第8回 Y1 の 6.）
 */
export function transcriptSep(prev: string): '・' | '' | ' ' {
  const m = SENTENCE_END.exec(prev.trimEnd());
  if (!m) return '・';
  return /[。！？]/u.test(m[1]!) ? '' : ' ';
}

/**
 * 解説の書き起こし。作業領域の幅の段（「きく」の札 ＋ すき間 ＋ 枠。88u まで）で、選択肢の上に置く。枠そのものは
 * 60u まで。高さは本文の 3 行まで（絵・図の選択肢と並べるときは 2 行まで。maxLines。listen.css）。
 * 入らない分は枠の中でスクロールし、下に ▼ の印を出す（text-layout-fixes R3・第8回 Y1）
 */
function Transcript({
  sounds,
  ctx,
  maxLines,
}: {
  sounds: ListenSound[];
  ctx: EngineProps<Item, ListenResponse>['ctx'];
  /** 枠の行数の上限（絵・図の選択肢と並べるときは 2、ほかは 3） */
  maxLines: 2 | 3;
}) {
  const boxRef = useRef<HTMLParagraphElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [cue, setCue] = useState<'down' | 'up' | null>(null);
  /**
   * 枠の行数。既定は maxLines（3 行）。作業領域に入らないときだけ 2 行に縮める（画面の大きさが変わったら maxLines から
   * 測り直す。減らした行の数を次の画面の大きさに持ち越さない）
   */
  const [lines, setLines] = useState<number>(maxLines);
  const [viewKey, setViewKey] = useState('');
  /**
   * 「▼ つづき」の段の場所を、一度出したら残す（画面の大きさ・聞く文が変わるまで）。段の有無で枠の高さが変わると、
   * UnitRunner の --fit が「段が無い → 大きく（0.99）→ 枠からあふれて段が出る → 小さく（0.89）→ あふれず段が消える」を
   * 毎フレームくり返し、描き直しが止まらなかった（g6.en.future/32 の解説 1536×864。レビュー）。あふれていないときは見えない場所だけ
   */
  const [reserveCue, setReserveCue] = useState(false);
  const measure = useCallback(() => {
    const b = boxRef.current;
    if (!b) return;
    // 本文が3行を超えるとき（枠は3行まで。続きはスクロール）だけ印を付ける
    const st = getComputedStyle(b);
    const lh = parseFloat(st.lineHeight);
    const pad = parseFloat(st.paddingTop) + parseFloat(st.paddingBottom);
    if (lh > 0) wrapRef.current?.toggleAttribute('data-long', b.scrollHeight - pad > lh * 3.5);
    if (b.scrollHeight <= b.clientHeight + 2) setCue(null);
    else {
      setReserveCue(true);
      if (b.scrollTop + b.clientHeight < b.scrollHeight - 2) setCue('down');
      else setCue('up');
    }
  }, []);
  useEffect(() => {
    const b = boxRef.current;
    if (!b) return undefined;
    measure();
    return observeResize([b], measure);
  }, [measure, sounds]);
  useEffect(() => {
    // 作業領域の大きさでなく画面（窓）の大きさで見る。作業領域の高さは、枠の行数で解説の板の上限（UnitRunner の
    // limitPanel）が変わると一緒に変わるので、それで 3 行に戻すと 3 行 → 2 行 → 3 行と測り直しが止まらない（レビュー）
    const sync = () => setViewKey(`${window.innerWidth}x${window.innerHeight}`);
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);
  useEffect(() => {
    setLines(maxLines);
    setReserveCue(false);
  }, [viewKey, sounds, maxLines]);
  // 作業領域に入らないとき（選択肢の高さが決まったあとも含む）だけ 2 行に縮める
  useEffect(() => {
    const work = wrapRef.current?.closest<HTMLElement>('.unit__work');
    if (!work) return undefined;
    const fit = () => {
      // 正解の印（札の外へ出る角の ○）は数えない（UnitRunner の fitNow と同じ data-measure）
      const measuring = work.hasAttribute('data-measure');
      work.setAttribute('data-measure', '');
      const over = work.scrollHeight > work.clientHeight + 2;
      if (!measuring) work.removeAttribute('data-measure');
      if (over) setLines((l) => (l > 2 ? 2 : l));
    };
    fit();
    const eng = wrapRef.current?.closest<HTMLElement>('.unit__engine');
    return observeResize(eng ? [work, eng] : [work], fit);
  }, [lines, viewKey, sounds]);
  const scrollCue = () => {
    const b = boxRef.current;
    if (!b) return;
    if (cue === 'up') b.scrollTo?.({ top: 0, behavior: 'smooth' });
    else b.scrollBy?.({ top: b.clientHeight * 0.85, behavior: 'smooth' });
  };
  return (
    <div
      ref={wrapRef}
      className="eng-listen__transcript-wrap"
      style={{ '--tr-lines': lines } as CSSProperties}
    >
      <p
        ref={boxRef}
        onScroll={measure}
        className="eng-listen__transcript"
        data-testid="listen-transcript"
        data-scroll-region="transcript"
      >
        {/* 文と文の間の「・」は字として書く（::before の字は検査から見えず、「・」のあとの改行が語の途中に見えた。
            g3.en.greetings の解説。text-layout-fixes 第6回のレビュー）。読み上げ・支援技術には区切りの記号を渡さない */}
        {sounds.map((s, i) => {
          // 前の文が「。」「.」などで終わるときは「・」を置かない（日本語は何も置かず、英語は空白）
          const sep = i > 0 ? transcriptSep(plainText(sounds[i - 1]!.text)) : '';
          return (
            <Fragment key={i}>
              {sep === '・' ? (
                <span className="eng-listen__sep" aria-hidden>
                  ・
                </span>
              ) : sep === ' ' ? (
                ' '
              ) : null}
              <span className="eng-listen__said">
                <Rt text={s.text} ctx={ctx} />
              </span>
            </Fragment>
          );
        })}
      </p>
      {cue ? (
        <button
          type="button"
          className="eng-listen__cue"
          data-scroll-cue
          data-testid="listen-cue"
          aria-label={cue === 'down' ? 'つづきを みる' : 'はじめから みる'}
          onClick={scrollCue}
        >
          {cue === 'down' ? '▼ つづき' : '▲ はじめから'}
        </button>
      ) : reserveCue ? (
        <span className="eng-listen__cue" aria-hidden style={{ visibility: 'hidden' }}>
          ▼ つづき
        </span>
      ) : null}
    </div>
  );
}

/**
 * 解説で札を左の列に置くとき、右の選択肢の列が取る幅（u）の見積り。語のラベルの札は 14u より広い
 * （choice.css の --word-min-w。字 1 つ × 1.05 ＋ 余白 3.2u、上限 30u。字は絵だけの列で 3.2u、絵に 5 字以上の文が付く列
 * （is-caption）で下限の 2.2u）ので、その分を左の列（head）から引く。
 * 絵のある札は、絵（既定の大きさ。pics.ts）の列が入る幅（札の余白 3u）以上（絵 1 つの札は 12u ＋ 3u ＝ 15u。
 * 14u と見積もると、左の列が広すぎて右の選択肢が作業領域の外にはみ出した。text-layout-fixes 第7回 X2）
 */
export function sideWidth(options: readonly { label?: string; figure?: unknown }[]): number {
  // 絵に 5 字以上の文が付く選択肢がある列は is-caption（札の字が下限で入る幅。choice.css の --w-min-font）
  const caption = options.some(
    (o) => o.figure !== undefined && o.label !== undefined && [...plainText(o.label)].length >= 5,
  );
  const font = caption ? 2.2 : 3.2;
  return options.reduce((a, o) => {
    const w = wordTrait(o.label);
    const word = w ? Math.min(30, Math.max(14, Math.ceil(w.len * font * 1.05 + 3.2))) : 14;
    const spec = picSpecOf(o.figure);
    const pic = spec
      ? Math.min(30, Math.ceil(spec.cap * spec.n + PIC_GAP_U * (spec.n - 1) + 3))
      : 0;
    return a + Math.max(word, pic);
  }, 0);
}

function ListenView({ item, ctx, revealed, wrongMark, disabled, submit, hintsShown }: Props) {
  /** 最初の再生が終わった（選択肢を押せる） */
  const [heard, setHeard] = useState(false);
  const [playing, setPlaying] = useState(false);
  /** nameBack: 名前を鳴らしている選択肢（その間は他を押せない） */
  const [pressed, setPressed] = useState<number | null>(null);
  const alive = useRef(true);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const seq = useMemo(() => listenSeq(item, ctx.packId), [item, ctx.packId]);

  /**
   * 解説の段（「きく」の札と書き起こしの枠。.eng-listen__head）の実寸。段を上に置くときと左に置くときの両方を、置き方を
   * 一時的に替えて測る（段の高さは、書き起こしの行の数が段の幅で変わるので、見積りでなく実寸で並べ方を比べる。第8回 Y1 の 4.）。
   * 寸法は --fit を 1 に戻した値（px。UnitRunner の fitNow と同じ測り方）。測り終えたら、置き方と --fit を同じ処理の中で元に
   * 戻す（描く前に戻るので、画面には出ない）。
   *   top  … 札の列より上に積まれる高さ（上の余白 ＋ 段の高さ ＋ すき間）
   *   left … 札の列から引く幅（段の幅 ＋ すき間）
   */
  const headSize = useCallback((): { top: number; left: number } | null => {
    const root = rootRef.current;
    const head = root?.querySelector<HTMLElement>(':scope > .eng-listen__head');
    const work = root?.closest<HTMLElement>('.unit__work');
    if (!root || !head || !work) return null;
    const cls = root.className;
    const prevFit = work.style.getPropertyValue('--fit');
    work.style.removeProperty('--fit');
    const wrap = head.querySelector<HTMLElement>('.eng-listen__transcript-wrap');
    const box = head.querySelector<HTMLElement>('.eng-listen__transcript');
    // 「▼ つづき」の段（実物か、Transcript が一度出したら残す場所取り）は、置き方の履歴で有無が決まるので数えない。
    // 置き方ごとに、本文が枠（2 行）からあふれるときだけ足す（画面サイズを回す順で段の高さが変わり、並べ方が変わっていた）
    const cues = Array.from(head.querySelectorAll<HTMLElement>('.eng-listen__cue'));
    const probe = document.createElement('span');
    probe.className = 'eng-listen__cue';
    wrap?.appendChild(probe);
    const cueH = probe.offsetHeight;
    probe.remove();
    for (const c of cues) c.style.display = 'none';
    const read = (side: boolean): number => {
      root.classList.toggle('eng-listen--explain-side', side);
      root.classList.toggle('eng-listen--pics', !side);
      const cs = getComputedStyle(root);
      const r = head.getBoundingClientRect();
      if (side) return r.width + (parseFloat(cs.columnGap) || 0);
      const over = box ? box.scrollHeight > box.clientHeight + 2 : false;
      return (
        (parseFloat(cs.paddingTop) || 0) +
        r.height +
        (over ? cueH : 0) +
        (parseFloat(cs.rowGap) || 0)
      );
    };
    const top = read(false);
    const left = read(true);
    for (const c of cues) c.style.display = '';
    root.className = cls;
    if (prevFit) work.style.setProperty('--fit', prevFit);
    return { top, left };
  }, []);

  const play = useCallback(() => {
    setPlaying(true);
    void audio.play(seq).then((r) => {
      if (!alive.current) return;
      setPlaying(false);
      const st = audio.getState();
      // 最後まで鳴った、または音が出せない（押せないままにしない）
      if (r === 'done' || !st.unlocked || st.health === 'silent') setHeard(true);
    });
  }, [seq]);

  useEffect(() => {
    alive.current = true;
    const cancel = whenQuiet(play);
    return () => {
      alive.current = false;
      cancel();
    };
  }, [play]);

  // 聞き直し: 不正解の後（実行枠の日本語の声かけが終わってから）・ヒントを出した後（ヒントの読み上げが終わってから）。
  // 不正解は同時にヒントの段も進めるので、同じ変化で2回鳴らさない
  const prev = useRef({ wrong: wrongMark, hints: hintsShown ?? 0 });
  useEffect(() => {
    const p = prev.current;
    prev.current = { wrong: wrongMark, hints: hintsShown ?? 0 };
    if (revealed || !item.replay) return;
    const wrongNew = wrongMark != null && wrongMark !== p.wrong;
    const hintNew = (hintsShown ?? 0) > p.hints;
    if ((wrongNew && item.replay.afterWrong) || (hintNew && !wrongNew && item.replay.onHint))
      return whenQuiet(play);
    return undefined;
  }, [wrongMark, hintsShown, revealed, item.replay, play]);

  // 答えの後の音声: 正答を見せるとき1回だけ（再レンダーで鳴らし直さない）。次へ進むときは止める
  const revealStarted = useRef(false);
  useEffect(() => {
    if (!revealed || !item.revealAudio?.length || revealStarted.current) return;
    const rseq = listenSeq({ audio: item.revealAudio, gapMs: item.gapMs }, ctx.packId);
    const cancel = whenQuiet(() => {
      revealStarted.current = true;
      void audio.play(rseq);
    });
    return () => {
      cancel();
      if (revealStarted.current) audio.stop();
    };
  }, [revealed, item.revealAudio, item.gapMs, ctx.packId]);

  // 解説で正解の札が作業領域の外に出るときは、先に見せる（外側の作業領域のスクロールだけが動く）
  useEffect(() => {
    if (!revealed) return undefined;
    const t = window.setTimeout(() => {
      const root = rootRef.current;
      if (!root) return;
      item.options.forEach((o, i) => {
        if (o.correct)
          root.querySelector(`[data-testid="opt-${i}"]`)?.scrollIntoView?.({ block: 'nearest' });
      });
    }, 60);
    return () => window.clearTimeout(t);
  }, [revealed, item.options]);

  // 名前を返す: 触った選択肢の名前を鳴らし、鳴り終わってから答える
  const onPress = useCallback(
    (i: number, send: (r: ChoiceResponse) => void) => {
      const sound = item.options[i]?.sound;
      if (!sound) {
        send([i]);
        return;
      }
      setPressed(i);
      const st = audio.getState();
      const limit = !st.unlocked || st.health === 'silent' ? NAME_BACK_SILENT_MS : NAME_BACK_MAX_MS;
      let done = false;
      let timer = 0;
      const finish = () => {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        if (!alive.current) return;
        setPressed(null);
        send([i]);
      };
      timer = window.setTimeout(finish, limit);
      void audio.play(soundSeq(ctx.packId, sound)).then(finish, finish);
    },
    [item.options, ctx.packId],
  );

  // 描くたびに作り直すと、書き起こしの行数（--tr-lines）の測り直しが音の再生のたびに走る（3 行に戻ってから 2 行に縮む）
  const sounds = useMemo(() => soundsOf(item), [item]);
  const showTranscript = revealed && !item.hideTranscript;
  // 選択肢に絵・図があるときは、「きく」の札を上の段（補助の寸法）に置く（左の列に置くと選択肢の幅が足りない）。
  // 絵だけの選択肢（絵の大きさを測って決める列）は、測った結果の場所（earPick。options.tsx の usePicsGeometry）が先。
  // 場所は問題でも解説でも選び直す（第8回 Y1）ので、問題の場所を解説に持ち越さない（revealed が変わったら選び直し）
  const [earPickRaw, setEarPickRaw] = useState<{ revealed: boolean; at: 'top' | 'left' } | null>(
    null,
  );
  const earPick = earPickRaw && earPickRaw.revealed === revealed ? earPickRaw.at : null;
  const setEarPick = useCallback(
    (at: 'top' | 'left') => setEarPickRaw({ revealed, at }),
    [revealed],
  );
  const earInitial: 'top' | 'left' = earOnTop(item.options) ? 'top' : 'left';
  const hasPics = (earPick ?? earInitial) === 'top';
  // 解説のとき、「きく」の札と書き起こしを左の列に置く: 時計（絵・図が3つ以下で1つに1つずつ。上の段にすると縦が足りず
  // 絵が縮む）と、絵の大きさを測って、左のほうが絵が大きくなる絵の選択肢（第8回 Y1）
  const sideHead = showTranscript && !hasPics && item.options.some((o) => o.figure !== undefined);
  // 絵・図の選択肢と並べる解説（hasPics・sideHead）は、書き起こしを 2 行まで（続きは ▼ つづき）。ほかは 3 行まで
  const maxLines = item.options.some((o) => o.figure !== undefined) ? 2 : 3;
  const ear = (
    <div className="eng-listen__ear">
      <Tap
        label="もういちど きく"
        icon="listen"
        variant="sky"
        size="big"
        text={
          // 「きいてね」と「もういちど きく」を同じ場所に重ね、見えないほうは visibility: hidden にして、札の幅は長いほうを
          // はじめから取る（最初の再生が終わっても札の幅が変わらない。書き起こしの枠・選択肢の列の幅が途中で変わらない。
          // 第8回 Y1 の 1.）。見えないほうは支援技術にも渡さない
          <span className="eng-listen__ear-text">
            <span
              className="eng-listen__ear-line"
              data-on={heard ? undefined : ''}
              aria-hidden={heard ? true : undefined}
            >
              きいてね
            </span>
            <span
              className="eng-listen__ear-line"
              data-on={heard ? '' : undefined}
              aria-hidden={heard ? undefined : true}
            >
              もういちど きく
            </span>
          </span>
        }
        state={playing ? 'selected' : null}
        disabled={disabled && !revealed}
        onPress={play}
        testId="listen-button"
      />
    </div>
  );
  return (
    <div
      ref={rootRef}
      className={[
        'eng-listen',
        showTranscript ? 'eng-listen--explain' : '',
        sideHead ? 'eng-listen--explain-side' : '',
        hasPics ? 'eng-listen--pics' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-heard={heard ? '1' : '0'}
      style={
        showTranscript
          ? ({
              '--side-n': item.options.length,
              '--side-w': sideWidth(item.options),
            } as CSSProperties)
          : undefined
      }
    >
      {showTranscript ? (
        <div className="eng-listen__head">
          {ear}
          <Transcript sounds={sounds} ctx={ctx} maxLines={maxLines} />
        </div>
      ) : (
        ear
      )}
      <ChoiceOptions
        part={item}
        ctx={ctx}
        revealed={revealed}
        wrongMark={wrongMark}
        locked={disabled || !heard || pressed !== null}
        submit={submit}
        picsSide={hasPics ? 0 : sideHead ? 32 : showTranscript ? 0 : 22}
        // 札を左に置くとき取る幅（u）の見積り: 問題は札（左の列の大きな札は 16u）＋ すき間 4u に余裕を足した 27u（安全側）、
        // 解説は書き起こしの列（28u〜）＋ すき間 4u。書き起こしのある解説は、段の実寸（headSize）で置き換える
        ear={{
          at: hasPics ? 'top' : 'left',
          initial: earInitial,
          side: showTranscript ? 32 : 27,
          key: showTranscript ? 'explain' : revealed ? 'reveal' : 'ask',
          onChange: setEarPick,
          head: showTranscript ? headSize : undefined,
        }}
        {...(item.nameBack ? { onPress, pressed } : {})}
      />
    </div>
  );
}

export interface ListenEngineDef {
  id: 'listen';
  Component: (props: Props) => ReactNode;
  judge(item: ListenItem, response: ListenResponse): Judgement;
  check(item: ListenItem): string[];
  answerText(item: ListenItem): RichText;
}

export const listenEngine: ListenEngineDef = {
  id: 'listen',
  Component: ListenView,
  judge: judgeListen,
  check: checkListen,
  answerText: listenAnswerText,
};
