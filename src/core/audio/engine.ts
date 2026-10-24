import { VOICE_CATALOG, hasVoice, type VoiceSeq } from '../../voice/catalog';
import { voiceYomi } from '../../voice/types';

/**
 * 音声エンジン本体（ブラウザ API は deps で注入する。jsdom のテストでは偽物を渡す）。
 * 設計は docs/architecture.md 5.2 / 9章。
 */

export type SfxName = 'tap' | 'correct' | 'wrong' | 'complete' | 'place' | 'remove';

export interface AudioState {
  unlocked: boolean;
  speaking: boolean;
  health: 'ok' | 'fallback' | 'silent';
  currentKeys: string[];
}

export interface AudioApi {
  unlock(): Promise<void>;
  play(seq: VoiceSeq): Promise<'done' | 'stopped'>;
  stop(): void;
  sfx(name: SfxName): void;
  setVolume(v: number): void;
  setSfxEnabled(b: boolean): void;
  getState(): AudioState;
  subscribe(cb: (s: AudioState) => void): () => void;
  preload(keys: string[]): Promise<void>;
}

// ---- 注入するブラウザ API の最小形 ----
export interface AudioParamLike {
  value: number;
  setValueAtTime(v: number, t: number): unknown;
  linearRampToValueAtTime(v: number, t: number): unknown;
}
export interface AudioBufferLike {
  duration: number;
}
export interface GainNodeLike {
  gain: AudioParamLike;
  connect(dest: unknown): unknown;
  disconnect(): void;
}
export interface OscillatorLike {
  type: OscillatorType;
  frequency: AudioParamLike;
  onended: (() => void) | null;
  connect(dest: unknown): unknown;
  disconnect(): void;
  start(when?: number): void;
  stop(when?: number): void;
}
export interface BufferSourceLike {
  buffer: AudioBufferLike | null;
  onended: (() => void) | null;
  connect(dest: unknown): unknown;
  disconnect(): void;
  start(when?: number, offset?: number, duration?: number): void;
  stop(when?: number): void;
}
export interface AudioContextLike {
  state: string;
  currentTime: number;
  destination: unknown;
  resume(): Promise<void>;
  decodeAudioData(data: ArrayBuffer): Promise<AudioBufferLike>;
  createGain(): GainNodeLike;
  createOscillator(): OscillatorLike;
  createBufferSource(): BufferSourceLike;
}
export interface UtteranceLike {
  lang: string;
  rate: number;
  volume: number;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
export interface SpeechLike {
  synth: {
    speak(u: UtteranceLike): void;
    cancel(): void;
    getVoices(): readonly { lang: string }[];
  };
  createUtterance(text: string): UtteranceLike;
}

export interface AudioDeps {
  createContext(): AudioContextLike;
  /** 取得できなければ reject する */
  fetchBytes(url: string): Promise<ArrayBuffer>;
  speech: SpeechLike | null;
  /** import.meta.env.BASE_URL（'./' など。末尾スラッシュ付き） */
  baseUrl: string;
  isDev: boolean;
  /** 画面が隠れたとき・ページを離れるときに cb を呼ぶ監視を登録する（unlock で1回だけ呼ぶ） */
  watch(onHidden: () => void): void;
}

/** 各クリップの前後から切る無音（秒）。generate.py は約 50ms の無音を付けている */
const TRIM = 0.03;
const HEALTH_RANK = { ok: 0, fallback: 1, silent: 2 } as const;

const noop = () => {};

export function createAudioEngine(deps: AudioDeps): AudioApi {
  let ctx: AudioContextLike | null = null;
  let voiceGain: GainNodeLike | null = null;
  let volume = 1;
  let sfxEnabled = true;
  let watching = false;

  let gen = 0;
  let cancelStep: (() => void) | null = null;
  let settle: ((r: 'done' | 'stopped') => void) | null = null;

  let state: AudioState = { unlocked: false, speaking: false, health: 'ok', currentKeys: [] };
  const listeners = new Set<(s: AudioState) => void>();

  function patch(p: Partial<AudioState>): void {
    const next = { ...state, ...p };
    const sameKeys =
      next.currentKeys.length === state.currentKeys.length &&
      next.currentKeys.every((k, i) => k === state.currentKeys[i]);
    if (
      next.unlocked === state.unlocked &&
      next.speaking === state.speaking &&
      next.health === state.health &&
      sameKeys
    ) {
      return;
    }
    state = sameKeys ? { ...next, currentKeys: state.currentKeys } : next;
    for (const cb of [...listeners]) cb(state);
  }

  function raiseHealth(h: AudioState['health']): void {
    if (HEALTH_RANK[h] > HEALTH_RANK[state.health]) patch({ health: h });
  }

  // ---- 読み込み ----
  const buffers = new Map<string, Promise<AudioBufferLike | null>>();

  function getBuffer(key: string): Promise<AudioBufferLike | null> {
    const hit = buffers.get(key);
    if (hit) return hit;
    const c = ctx;
    if (!c) return Promise.resolve(null);
    const url = `${deps.baseUrl}audio/${key}.mp3`;
    const p = (async () => {
      try {
        const bytes = await deps.fetchBytes(url);
        return await c.decodeAudioData(bytes);
      } catch {
        return null;
      }
    })();
    buffers.set(key, p);
    return p;
  }

  // ---- 待ち（キャンセル可能な1ステップ）----
  function waitStep(start: (done: () => void) => () => void): Promise<void> {
    return new Promise<void>((resolve) => {
      let finished = false;
      let cleanup: () => void = noop;
      const done = () => {
        if (finished) return;
        finished = true;
        if (cancelStep === done) cancelStep = null;
        cleanup();
        resolve();
      };
      cancelStep = done;
      cleanup = start(done);
      if (finished) cleanup();
    });
  }

  function playBuffer(buf: AudioBufferLike): Promise<void> {
    const c = ctx;
    const out = voiceGain;
    if (!c || !out) return Promise.resolve();
    return waitStep((done) => {
      const src = c.createBufferSource();
      src.buffer = buf;
      src.connect(out);
      const trim = buf.duration > TRIM * 2 + 0.02 ? TRIM : 0;
      const dur = buf.duration - trim * 2;
      src.onended = done;
      src.start(0, trim, dur);
      const timer = setTimeout(done, dur * 1000 + 400);
      return () => {
        clearTimeout(timer);
        src.onended = null;
        try {
          src.stop();
        } catch {
          /* 既に終了している */
        }
        src.disconnect();
      };
    });
  }

  function hasJapaneseVoice(sp: SpeechLike): boolean {
    try {
      return sp.synth.getVoices().some((v) => /^ja/i.test(v.lang));
    } catch {
      return false;
    }
  }

  function speakFallback(key: string): Promise<void> {
    const entry = hasVoice(key) ? VOICE_CATALOG[key] : undefined;
    const sp = deps.speech;
    if (entry === undefined || !sp || !hasJapaneseVoice(sp)) {
      raiseHealth('silent');
      return Promise.resolve();
    }
    raiseHealth('fallback');
    const text = voiceYomi(entry);
    return waitStep((done) => {
      let ended = false;
      const u = sp.createUtterance(text);
      u.lang = 'ja-JP';
      u.rate = 0.85;
      u.volume = volume;
      const finish = () => {
        ended = true;
        done();
      };
      u.onend = finish;
      u.onerror = finish;
      try {
        sp.synth.speak(u);
      } catch {
        raiseHealth('silent');
        finish();
      }
      const timer = setTimeout(finish, text.length * 500 + 3000);
      return () => {
        clearTimeout(timer);
        u.onend = null;
        u.onerror = null;
        if (!ended) {
          try {
            sp.synth.cancel();
          } catch {
            /* 無視 */
          }
        }
      };
    });
  }

  async function run(
    myGen: number,
    items: readonly (string | number)[],
  ): Promise<'done' | 'stopped'> {
    for (const it of items) {
      if (myGen !== gen) return 'stopped';
      if (typeof it === 'number') {
        await waitStep((done) => {
          const t = setTimeout(done, Math.max(0, it));
          return () => clearTimeout(t);
        });
        continue;
      }
      const buf = await getBuffer(it);
      if (myGen !== gen) return 'stopped';
      if (buf) await playBuffer(buf);
      else await speakFallback(it);
    }
    return myGen === gen ? 'done' : 'stopped';
  }

  // ---- 公開 API ----
  function stop(): void {
    gen++;
    const c = cancelStep;
    cancelStep = null;
    c?.();
    const s = settle;
    settle = null;
    s?.('stopped');
    patch({ speaking: false, currentKeys: [] });
  }

  async function unlock(): Promise<void> {
    if (!watching) {
      watching = true;
      try {
        deps.watch(stop);
      } catch {
        /* 監視できなくても動く */
      }
    }
    if (!ctx) {
      try {
        const c = deps.createContext();
        const g = c.createGain();
        g.gain.value = volume;
        g.connect(c.destination);
        ctx = c;
        voiceGain = g;
      } catch {
        raiseHealth('silent');
        return;
      }
    }
    try {
      if (ctx.state !== 'running') await ctx.resume();
    } catch {
      /* 失敗しても次の操作でまた resume する */
    }
    patch({ unlocked: true });
  }

  async function ensureRunning(c: AudioContextLike): Promise<void> {
    if (c.state === 'running') return;
    try {
      await Promise.race([c.resume(), new Promise<void>((resolve) => setTimeout(resolve, 300))]);
    } catch {
      /* 無視 */
    }
  }

  function play(seq: VoiceSeq): Promise<'done' | 'stopped'> {
    stop();
    const c = ctx;
    if (!c || !state.unlocked) return Promise.resolve('stopped');
    const items: readonly (string | number)[] = typeof seq === 'string' ? [seq] : seq;
    const keys = items.filter((x): x is string => typeof x === 'string');
    if (deps.isDev) {
      for (const k of keys) {
        if (!hasVoice(k)) console.warn(`[audio] unknown voice key: ${k}`);
      }
    }
    const myGen = gen;
    patch({ speaking: true, currentKeys: keys });
    for (const k of keys) void getBuffer(k);
    return new Promise<'done' | 'stopped'>((resolve) => {
      settle = resolve;
      void (async () => {
        let result: 'done' | 'stopped';
        try {
          await ensureRunning(c);
          result = myGen === gen ? await run(myGen, items) : 'stopped';
        } catch {
          result = 'stopped';
        }
        if (myGen === gen) {
          settle = null;
          patch({ speaking: false, currentKeys: [] });
        }
        resolve(result);
      })();
    });
  }

  // ---- 効果音（Web Audio 合成。正弦波のみ・エンベロープで角を丸める）----
  function tone(
    c: AudioContextLike,
    freq: number,
    at: number,
    dur: number,
    peak: number,
    endFreq?: number,
  ): void {
    const t0 = c.currentTime + at;
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq !== undefined) osc.frequency.linearRampToValueAtTime(endFreq, t0 + dur);
    const g = c.createGain();
    const attack = Math.min(0.01, dur * 0.25);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak * volume, t0 + attack);
    g.gain.linearRampToValueAtTime(0, t0 + dur);
    osc.connect(g);
    g.connect(c.destination);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  const C5 = 523.25;
  const E5 = 659.25;
  const G5 = 783.99;
  const C6 = 1046.5;

  function sfx(name: SfxName): void {
    const c = ctx;
    if (!sfxEnabled || !c || !state.unlocked || volume <= 0) return;
    if (c.state !== 'running') void c.resume().catch(noop);
    switch (name) {
      case 'tap':
        tone(c, 880, 0, 0.06, 0.25);
        break;
      case 'place':
        tone(c, 523.25, 0, 0.12, 0.2);
        tone(c, 659.25, 0.09, 0.14, 0.2);
        break;
      case 'remove':
        tone(c, 660, 0, 0.12, 0.2, 330);
        break;
      case 'correct':
        tone(c, C5, 0, 0.14, 0.28);
        tone(c, E5, 0.13, 0.14, 0.28);
        tone(c, G5, 0.26, 0.14, 0.28);
        break;
      case 'wrong':
        tone(c, 220, 0, 0.15, 0.12);
        break;
      case 'complete':
        tone(c, C5, 0, 0.2, 0.28);
        tone(c, E5, 0.2, 0.2, 0.28);
        tone(c, G5, 0.4, 0.2, 0.28);
        tone(c, C6, 0.6, 0.2, 0.28);
        break;
    }
  }

  function setVolume(v: number): void {
    volume = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
    if (voiceGain) voiceGain.gain.value = volume;
  }

  async function preload(keys: string[]): Promise<void> {
    await Promise.all(keys.map((k) => getBuffer(k)));
  }

  return {
    unlock,
    play,
    stop,
    sfx,
    setVolume,
    setSfxEnabled(b) {
      sfxEnabled = b;
    },
    getState: () => state,
    subscribe(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    preload,
  };
}
