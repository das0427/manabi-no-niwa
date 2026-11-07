import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createAudioEngine,
  type AudioContextLike,
  type AudioDeps,
  type AudioParamLike,
  type SpeechLike,
  type UtteranceLike,
  type VoiceLike,
} from './engine';
import { watchPageHide } from './watch';

class FakeParam implements AudioParamLike {
  value = 1;
  points: number[] = [];
  setValueAtTime(v: number) {
    this.points.push(v);
  }
  linearRampToValueAtTime(v: number) {
    this.points.push(v);
  }
}

class FakeNode {
  gain = new FakeParam();
  frequency = new FakeParam();
  type: OscillatorType = 'sine';
  onended: (() => void) | null = null;
  connect() {}
  disconnect() {}
}

class FakeSource extends FakeNode {
  buffer: { duration: number } | null = null;
  startArgs: number[] | null = null;
  stopped = false;
  constructor(private log: string[]) {
    super();
  }
  start(when = 0, offset = 0, duration = 0) {
    this.startArgs = [when, offset, duration];
    this.log.push(`start:${this.buffer?.duration}`);
    setTimeout(() => this.onended?.(), duration * 1000);
  }
  stop() {
    this.stopped = true;
  }
}

class FakeContext {
  state = 'running';
  currentTime = 0;
  destination = {};
  sources: FakeSource[] = [];
  oscillators: FakeNode[] = [];
  log: string[] = [];
  resume = vi.fn(async () => {
    this.state = 'running';
  });
  decodeAudioData = vi.fn(async () => ({ duration: 0.5 }));
  createGain() {
    return new FakeNode();
  }
  createOscillator() {
    const o = Object.assign(new FakeNode(), { start() {}, stop() {} });
    this.oscillators.push(o);
    return o;
  }
  createBufferSource() {
    const s = new FakeSource(this.log);
    this.sources.push(s);
    return s;
  }
}

type FakeUtterance = UtteranceLike & { text: string };

const JA_LOCAL: VoiceLike = { lang: 'ja-JP', localService: true };
const JA_NETWORK: VoiceLike = { lang: 'ja-JP', localService: false };
const EN_LOCAL: VoiceLike = { lang: 'en-US', localService: true };

class FakeSpeech {
  spoken: string[] = [];
  utterances: FakeUtterance[] = [];
  cancel = vi.fn();
  voices: VoiceLike[] = [JA_LOCAL];
  /** voiceschanged の聞き手（Chrome は声の一覧が遅れて届く） */
  listeners = new Set<() => void>();
  synth: SpeechLike['synth'] = {
    speak: (u: UtteranceLike) => {
      this.spoken.push((u as FakeUtterance).text);
      setTimeout(() => u.onend?.(), 100);
    },
    cancel: () => this.cancel(),
    getVoices: () => this.voices,
    addEventListener: (_type, cb) => {
      this.listeners.add(cb);
    },
    removeEventListener: (_type, cb) => {
      this.listeners.delete(cb);
    },
  };
  createUtterance(text: string): UtteranceLike {
    const u: FakeUtterance = {
      text,
      lang: '',
      rate: 1,
      volume: 1,
      voice: null,
      onend: null,
      onerror: null,
    };
    this.utterances.push(u);
    return u;
  }
  /** 声の一覧が届いた（voiceschanged） */
  deliver(voices: VoiceLike[]): void {
    this.voices = voices;
    for (const cb of [...this.listeners]) cb();
  }
}

function setup(opts: { missing?: string[]; speech?: FakeSpeech | null } = {}) {
  const ctx = new FakeContext();
  const speech = opts.speech === undefined ? new FakeSpeech() : opts.speech;
  const fetched: string[] = [];
  const deps: AudioDeps = {
    createContext: () => ctx as unknown as AudioContextLike,
    fetchBytes: async (url) => {
      fetched.push(url);
      if ((opts.missing ?? []).some((k) => url.endsWith(`/${k}.mp3`))) throw new Error('404');
      return new ArrayBuffer(8);
    },
    speech: speech as unknown as SpeechLike | null,
    baseUrl: './',
    isDev: false,
    watch: (cb) => watchPageHide(document, window, cb),
  };
  return { ctx, speech, fetched, engine: createAudioEngine(deps) };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('audio engine: play', () => {
  it('fetches ./audio/<key>.mp3 and trims 30ms from both ends', async () => {
    const { engine, ctx, fetched } = setup();
    await engine.unlock();
    const p = engine.play('num.1');
    await vi.advanceTimersByTimeAsync(1000);
    expect(await p).toBe('done');
    expect(fetched).toEqual(['./audio/num.1.mp3']);
    const args = ctx.sources[0]?.startArgs;
    expect(args?.[1]).toBeCloseTo(0.03);
    expect(args?.[2]).toBeCloseTo(0.44);
    expect(engine.getState().speaking).toBe(false);
  });

  it('plays a sequence in order and waits for numeric silence', async () => {
    const { engine, ctx } = setup();
    await engine.unlock();
    let result: string | null = null;
    void engine.play(['num.1', 1000, 'num.2']).then((r) => (result = r));
    await vi.advanceTimersByTimeAsync(10);
    expect(ctx.sources.length).toBe(1);
    await vi.advanceTimersByTimeAsync(600); // 1つ目が終わり、無音の最中
    expect(ctx.sources.length).toBe(1);
    expect(result).toBeNull();
    await vi.advanceTimersByTimeAsync(900); // 無音(1000ms)明け
    expect(ctx.sources.length).toBe(2);
    await vi.advanceTimersByTimeAsync(600);
    expect(result).toBe('done');
  });

  it('a new play stops the previous one; only the new sequence sounds', async () => {
    const { engine, ctx } = setup();
    await engine.unlock();
    const first = engine.play(['num.1', 500, 'num.2']);
    await vi.advanceTimersByTimeAsync(10);
    const second = engine.play('num.3');
    expect(await first).toBe('stopped');
    expect(ctx.sources[0]?.stopped).toBe(true);
    await vi.advanceTimersByTimeAsync(3000);
    expect(await second).toBe('done');
    // 古い列の num.2 は予約されない
    expect(ctx.sources.length).toBe(2);
    expect(ctx.sources[1]?.buffer).toBeTruthy();
  });

  it('stop() makes speaking false and resolves as stopped', async () => {
    const { engine } = setup();
    await engine.unlock();
    const p = engine.play(['num.1', 5000]);
    await vi.advanceTimersByTimeAsync(10);
    expect(engine.getState().speaking).toBe(true);
    expect(engine.getState().currentKeys).toEqual(['num.1']);
    engine.stop();
    expect(engine.getState().speaking).toBe(false);
    expect(engine.getState().currentKeys).toEqual([]);
    expect(await p).toBe('stopped');
  });

  it('play before unlock does not throw and returns stopped', async () => {
    const { engine } = setup();
    await expect(engine.play('num.1')).resolves.toBe('stopped');
    expect(engine.getState().speaking).toBe(false);
  });

  it('stops on visibilitychange(hidden) and pagehide', async () => {
    const { engine } = setup();
    await engine.unlock();
    const p = engine.play(['num.1', 5000]);
    await vi.advanceTimersByTimeAsync(10);
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    expect(await p).toBe('stopped');
    expect(engine.getState().speaking).toBe(false);

    const q = engine.play(['num.1', 5000]);
    await vi.advanceTimersByTimeAsync(10);
    window.dispatchEvent(new Event('pagehide'));
    expect(await q).toBe('stopped');
  });

  it('notifies subscribers and stops notifying after unsubscribe', async () => {
    const { engine } = setup();
    const seen: boolean[] = [];
    const off = engine.subscribe((s) => seen.push(s.speaking));
    await engine.unlock();
    const p = engine.play('num.1');
    await vi.advanceTimersByTimeAsync(1000);
    await p;
    expect(seen).toContain(true);
    expect(seen[seen.length - 1]).toBe(false);
    off();
    const n = seen.length;
    const q = engine.play('num.1');
    await vi.advanceTimersByTimeAsync(1000);
    await q;
    expect(seen.length).toBe(n);
  });
});

describe('audio engine: fallback', () => {
  it('uses speechSynthesis (yomi) for a missing mp3 and reports fallback', async () => {
    const { engine, speech } = setup({ missing: ['count.ko.1'] });
    await engine.unlock();
    const p = engine.play(['count.ko.1', 'num.2']);
    await vi.advanceTimersByTimeAsync(2000);
    expect(await p).toBe('done');
    expect(speech?.spoken).toEqual(['いっこ']);
    expect(engine.getState().health).toBe('fallback');
  });

  it('goes silent without hanging when no Japanese voice exists', async () => {
    const speech = new FakeSpeech();
    speech.voices = [EN_LOCAL];
    const { engine } = setup({ missing: ['num.1'], speech });
    await engine.unlock();
    const p = engine.play(['num.1', 'num.2']);
    await vi.advanceTimersByTimeAsync(2000);
    expect(await p).toBe('done');
    expect(speech.spoken).toEqual([]);
    expect(engine.getState().health).toBe('silent');
  });

  describe('only a voice that reads on the device (localService) is used', () => {
    it('picks the local Japanese voice, not a network voice listed before it', async () => {
      const speech = new FakeSpeech();
      speech.voices = [EN_LOCAL, JA_NETWORK, JA_LOCAL];
      const { engine } = setup({ missing: ['count.ko.1'], speech });
      await engine.unlock();
      const p = engine.play('count.ko.1');
      await vi.advanceTimersByTimeAsync(2000);
      expect(await p).toBe('done');
      expect(speech.spoken).toEqual(['いっこ']);
      expect(speech.utterances[0]?.voice).toBe(JA_LOCAL);
      expect(speech.utterances[0]?.lang).toBe('ja-JP');
      expect(engine.getState().health).toBe('fallback');
    });

    it('does not speak with a network voice: silent, no utterance, no waiting', async () => {
      const speech = new FakeSpeech();
      speech.voices = [JA_NETWORK, EN_LOCAL];
      const { engine } = setup({ missing: ['num.1', 'num.2'], speech });
      await engine.unlock();
      let result: string | null = null;
      void engine.play(['num.1', 'num.2']).then((r) => (result = r));
      await vi.advanceTimersByTimeAsync(10);
      expect(result).toBe('done');
      expect(speech.utterances).toEqual([]);
      expect(speech.spoken).toEqual([]);
      expect(engine.getState().health).toBe('silent');
      // 声の一覧は空ではないので、届くのを待たない
      expect(speech.listeners.size).toBe(0);
    });

    it('matches ja, ja-JP and ja_JP only (not other languages that start with "ja")', async () => {
      const jam: VoiceLike = { lang: 'jam', localService: true };
      const underscore: VoiceLike = { lang: 'ja_JP', localService: true };

      const speech = new FakeSpeech();
      speech.voices = [EN_LOCAL, jam, underscore];
      const first = setup({ missing: ['num.1'], speech });
      await first.engine.unlock();
      const p = first.engine.play('num.1');
      await vi.advanceTimersByTimeAsync(2000);
      expect(await p).toBe('done');
      expect(speech.utterances[0]?.voice).toBe(underscore);

      const speech2 = new FakeSpeech();
      speech2.voices = [jam];
      const second = setup({ missing: ['num.1'], speech: speech2 });
      await second.engine.unlock();
      const q = second.engine.play('num.1');
      await vi.advanceTimersByTimeAsync(10);
      expect(await q).toBe('done');
      expect(speech2.utterances).toEqual([]);
      expect(second.engine.getState().health).toBe('silent');
    });

    it('waits once for a voice list that has not arrived yet (voiceschanged), then speaks', async () => {
      const speech = new FakeSpeech();
      speech.voices = [];
      const { engine } = setup({ missing: ['count.ko.1'], speech });
      await engine.unlock();
      let result: string | null = null;
      void engine.play('count.ko.1').then((r) => (result = r));
      await vi.advanceTimersByTimeAsync(300);
      // 一覧待ち: まだ読まず、待っている（聞き手が付いている）
      expect(speech.utterances).toEqual([]);
      expect(speech.listeners.size).toBe(1);
      expect(result).toBeNull();
      expect(engine.getState().speaking).toBe(true);
      speech.deliver([JA_NETWORK, JA_LOCAL]);
      await vi.advanceTimersByTimeAsync(300);
      expect(speech.spoken).toEqual(['いっこ']);
      expect(speech.utterances[0]?.voice).toBe(JA_LOCAL);
      expect(result).toBe('done');
      expect(speech.listeners.size).toBe(0);
      expect(engine.getState().health).toBe('fallback');
    });

    it('goes silent when the list arrives with network voices only', async () => {
      const speech = new FakeSpeech();
      speech.voices = [];
      const { engine } = setup({ missing: ['num.1'], speech });
      await engine.unlock();
      const p = engine.play('num.1');
      await vi.advanceTimersByTimeAsync(100);
      speech.deliver([JA_NETWORK]);
      await vi.advanceTimersByTimeAsync(100);
      expect(await p).toBe('done');
      expect(speech.utterances).toEqual([]);
      expect(engine.getState().health).toBe('silent');
      expect(speech.listeners.size).toBe(0);
    });

    it('gives up after one second when the list never arrives, and does not wait again', async () => {
      const speech = new FakeSpeech();
      speech.voices = [];
      const { engine } = setup({ missing: ['num.1', 'num.2'], speech });
      await engine.unlock();
      let result: string | null = null;
      void engine.play(['num.1', 'num.2']).then((r) => (result = r));
      await vi.advanceTimersByTimeAsync(900);
      expect(result).toBeNull();
      // 1 秒で待ちをやめ、2 つ目は待たずに続ける（合わせて 1 秒ほどで終わる）
      await vi.advanceTimersByTimeAsync(200);
      expect(result).toBe('done');
      expect(speech.utterances).toEqual([]);
      expect(engine.getState().health).toBe('silent');
      expect(speech.listeners.size).toBe(0);
      // 次の再生でも待たない（待ちは 1 回だけ）
      let again: string | null = null;
      void engine.play('num.1').then((r) => (again = r));
      await vi.advanceTimersByTimeAsync(10);
      expect(again).toBe('done');
    });

    it('a stop() during the wait cancels it and nothing is spoken afterwards', async () => {
      const speech = new FakeSpeech();
      speech.voices = [];
      const { engine } = setup({ missing: ['num.1'], speech });
      await engine.unlock();
      const p = engine.play('num.1');
      await vi.advanceTimersByTimeAsync(100);
      engine.stop();
      expect(await p).toBe('stopped');
      expect(speech.listeners.size).toBe(0);
      speech.deliver([JA_LOCAL]);
      await vi.advanceTimersByTimeAsync(2000);
      expect(speech.utterances).toEqual([]);
      expect(engine.getState().speaking).toBe(false);
    });

    it('does not wait when the browser has no voiceschanged event', async () => {
      const speech = new FakeSpeech();
      speech.voices = [];
      delete speech.synth.addEventListener;
      delete speech.synth.removeEventListener;
      const { engine } = setup({ missing: ['num.1'], speech });
      await engine.unlock();
      const p = engine.play('num.1');
      await vi.advanceTimersByTimeAsync(10);
      expect(await p).toBe('done');
      expect(speech.utterances).toEqual([]);
      expect(engine.getState().health).toBe('silent');
    });
  });

  it('goes silent when speechSynthesis is unavailable', async () => {
    const { engine } = setup({ missing: ['num.1'], speech: null });
    await engine.unlock();
    const p = engine.play('num.1');
    await vi.advanceTimersByTimeAsync(10);
    expect(await p).toBe('done');
    expect(engine.getState().health).toBe('silent');
  });

  it('warns about unknown keys in dev', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ctx = new FakeContext();
    const engine = createAudioEngine({
      createContext: () => ctx as unknown as AudioContextLike,
      fetchBytes: async () => {
        throw new Error('404');
      },
      speech: null,
      baseUrl: './',
      isDev: true,
      watch: () => {},
    });
    await engine.unlock();
    const p = engine.play('nope.nothing');
    await vi.advanceTimersByTimeAsync(10);
    expect(await p).toBe('done');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('audio engine: sfx and volume', () => {
  it('plays sfx only when enabled, and ignores them before unlock', async () => {
    const { engine, ctx } = setup();
    engine.sfx('tap');
    expect(ctx.oscillators.length).toBe(0);
    await engine.unlock();
    engine.sfx('tap');
    expect(ctx.oscillators.length).toBe(1);
    engine.setSfxEnabled(false);
    engine.sfx('correct');
    expect(ctx.oscillators.length).toBe(1);
    engine.setSfxEnabled(true);
    engine.sfx('correct');
    expect(ctx.oscillators.length).toBe(4);
    engine.sfx('complete');
    expect(ctx.oscillators.length).toBe(8);
  });

  it('only uses sine waves', async () => {
    const { engine, ctx } = setup();
    await engine.unlock();
    for (const n of ['tap', 'correct', 'wrong', 'complete', 'place', 'remove'] as const) {
      engine.sfx(n);
    }
    expect(ctx.oscillators.every((o) => o.type === 'sine')).toBe(true);
  });

  it('applies volume to sfx and voice, clamped to 0..1', async () => {
    const { engine, ctx } = setup();
    await engine.unlock();
    engine.setVolume(0.5);
    engine.sfx('tap');
    // tap の最大ゲイン 0.25 * 0.5
    const gains = ctx.oscillators.length;
    expect(gains).toBe(1);
    engine.setVolume(0);
    engine.sfx('tap');
    expect(ctx.oscillators.length).toBe(1);
    engine.setVolume(7);
    engine.sfx('tap');
    expect(ctx.oscillators.length).toBe(2);
  });

  it('scales the sfx peak by volume', async () => {
    const created: FakeNode[] = [];
    const ctx = new FakeContext();
    const orig = ctx.createGain.bind(ctx);
    ctx.createGain = () => {
      const g = orig();
      created.push(g);
      return g;
    };
    const engine = createAudioEngine({
      createContext: () => ctx as unknown as AudioContextLike,
      fetchBytes: async () => new ArrayBuffer(1),
      speech: null,
      baseUrl: './',
      isDev: false,
      watch: () => {},
    });
    await engine.unlock();
    const voiceGain = created[0];
    engine.setVolume(0.4);
    expect(voiceGain?.gain.value).toBe(0.4);
    engine.sfx('tap');
    const g = created[created.length - 1];
    expect(Math.max(...(g?.gain.points ?? []))).toBeCloseTo(0.25 * 0.4);
  });
});
