/**
 * listen エンジン: 聞いて選ぶ。音声が問題の本体（英語の語・文、日本語の音・語、音の数）。
 *
 * - 問題を開くと音声を自動で鳴らす（実行枠が問題文を読んでいる間は待ってから）。読み上げの設定が off でも鳴らす
 *   （音声が本体のため。音を消すのは音量の設定で効く）。
 * - 最初の再生が終わるまで選択肢を押せない（curriculum-matrix 1.7）。音が出ない環境（音声の準備ができていない）では
 *   押せなくなったままにしない。
 * - 「もういちど きく」の札はいつでも押せる（止めてから最初から鳴らす）。
 * - 判定・検査は choice と同じ（正解1つ、または「すべて選ぶ」の集合一致）。
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { audio } from '../../core/audio/index';
import type { ChoiceOption, Item, ItemBase, RichText } from '../../curriculum/types';
import { Rt } from '../../text/Rt';
import { plainText } from '../../text/rich';
import { speechYomi } from '../../text/yomi';
import { Tap } from '../../ui/Tap';
import { VOICE_CATALOG, type VoiceSeq } from '../../voice/catalog/index';
import { registerRich } from '../../voice/dynamic';
import type { ChoiceResponse } from '../choice/choice';
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
}

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

function ListenView({ item, ctx, revealed, wrongMark, disabled, submit }: Props) {
  /** 最初の再生が終わった（選択肢を押せる） */
  const [heard, setHeard] = useState(false);
  const [playing, setPlaying] = useState(false);
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

  const sounds = soundsOf(item);
  return (
    <div className="eng-listen" data-heard={heard ? '1' : '0'}>
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
        {revealed && !item.hideTranscript ? (
          <p className="eng-listen__transcript" data-testid="listen-transcript">
            {sounds.map((s, i) => (
              <span key={i} className="eng-listen__said">
                <Rt text={s.text} ctx={ctx} />
              </span>
            ))}
          </p>
        ) : null}
      </div>
      <ChoiceOptions
        part={item}
        ctx={ctx}
        revealed={revealed}
        wrongMark={wrongMark}
        locked={disabled || !heard}
        submit={submit}
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
