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
import { earOnTop, type ChoiceResponse } from '../choice/choice';
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

/**
 * 解説の書き起こし。作業領域の幅（60u まで）の段で、選択肢の上に置く。高さは本文の4行以上・空きまで
 * （listen.css）。入らない分は枠の中でスクロールし、下に ▼ の印を出す（text-layout-fixes R3）
 */
function Transcript({
  sounds,
  ctx,
}: {
  sounds: ListenSound[];
  ctx: EngineProps<Item, ListenResponse>['ctx'];
}) {
  const boxRef = useRef<HTMLParagraphElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [cue, setCue] = useState<'down' | 'up' | null>(null);
  const measure = useCallback(() => {
    const b = boxRef.current;
    if (!b) return;
    // 本文が4行を超えるときだけ、枠の高さの下限を4行にする（短い書き起こしに空きを足さない）
    const st = getComputedStyle(b);
    const lh = parseFloat(st.lineHeight);
    const pad = parseFloat(st.paddingTop) + parseFloat(st.paddingBottom);
    if (lh > 0) wrapRef.current?.toggleAttribute('data-long', b.scrollHeight - pad > lh * 4.5);
    if (b.scrollHeight <= b.clientHeight + 2) setCue(null);
    else if (b.scrollTop + b.clientHeight < b.scrollHeight - 2) setCue('down');
    else setCue('up');
  }, []);
  useEffect(() => {
    const b = boxRef.current;
    if (!b) return undefined;
    measure();
    return observeResize([b], measure);
  }, [measure, sounds]);
  const scrollCue = () => {
    const b = boxRef.current;
    if (!b) return;
    if (cue === 'up') b.scrollTo?.({ top: 0, behavior: 'smooth' });
    else b.scrollBy?.({ top: b.clientHeight * 0.85, behavior: 'smooth' });
  };
  return (
    <div ref={wrapRef} className="eng-listen__transcript-wrap">
      <p
        ref={boxRef}
        onScroll={measure}
        className="eng-listen__transcript"
        data-testid="listen-transcript"
        data-scroll-region="transcript"
      >
        {sounds.map((s, i) => (
          <span key={i} className="eng-listen__said">
            <Rt text={s.text} ctx={ctx} />
          </span>
        ))}
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
      ) : null}
    </div>
  );
}

function ListenView({ item, ctx, revealed, wrongMark, disabled, submit, hintsShown }: Props) {
  /** 最初の再生が終わった（選択肢を押せる） */
  const [heard, setHeard] = useState(false);
  const [playing, setPlaying] = useState(false);
  /** nameBack: 名前を鳴らしている選択肢（その間は他を押せない） */
  const [pressed, setPressed] = useState<number | null>(null);
  const alive = useRef(true);
  const seq = useMemo(() => listenSeq(item, ctx.packId), [item, ctx.packId]);

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

  const sounds = soundsOf(item);
  const showTranscript = revealed && !item.hideTranscript;
  // 選択肢に絵・図があるときは、「きく」の札を上の段（補助の寸法）に置く（左の列に置くと選択肢の幅が足りない）
  const hasPics = earOnTop(item.options);
  // 解説のとき、絵・図が3つ以下で1つに1つずつ（時計）なら、札と書き起こしを左の列に置く（上の段にすると縦が足りず絵が縮む）
  const sideHead = showTranscript && !hasPics && item.options.some((o) => o.figure !== undefined);
  const ear = (
    <div className="eng-listen__ear">
      <Tap
        label="もういちど きく"
        icon="listen"
        variant="sky"
        size="big"
        text={
          <span className="eng-listen__ear-text">{heard ? 'もういちど きく' : 'きいてね'}</span>
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
      className={[
        'eng-listen',
        showTranscript ? 'eng-listen--explain' : '',
        sideHead ? 'eng-listen--explain-side' : '',
        hasPics ? 'eng-listen--pics' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-heard={heard ? '1' : '0'}
      style={sideHead ? ({ '--side-n': item.options.length } as CSSProperties) : undefined}
    >
      {showTranscript ? (
        <div className="eng-listen__head">
          {ear}
          <Transcript sounds={sounds} ctx={ctx} />
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
