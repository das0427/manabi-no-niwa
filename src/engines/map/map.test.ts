import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  areNeighbors,
  dirOf,
  hitPref,
  JAPAN_BOX,
  mirrorEW,
  opposite,
  PREF_BY_CODE,
  prefBearing,
  prefName,
  PREFS,
  prefsOfRegion,
  REGIONS,
  viewBoxOf,
  visibleIn,
} from './japan';
import { checkMap, judgeMap, mapAnswerText, type MapItem, type MapTask } from './map';
import { mapSamples } from './map.samples';
import { SYMBOL_IDS, SYMBOL_NAME } from './symbols';
import { findBareKanji } from '../../text/rich';

const base = {
  id: 't',
  objective: 'o',
  level: 0,
  prompt: 'p',
  hints: ['a', 'b', 'c'],
  explain: 'e',
  identity: 'k',
};
const MIS = {
  neighbor: 'nb',
  sameRegion: 'reg',
  opposite: 'opp',
  mirrorEW: 'ew',
  missing: 'miss',
};
const mk = (task: MapTask, extra: Partial<MapItem> = {}): MapItem => ({
  ...base,
  engine: 'map',
  task,
  misconceptions: MIS,
  ...extra,
});

describe('地図データ', () => {
  it('47都道府県・地方・名前', () => {
    expect(PREFS).toHaveLength(47);
    expect(new Set(PREFS.map((p) => p.code)).size).toBe(47);
    for (const r of REGIONS) expect(prefsOfRegion(r.id).length).toBeGreaterThan(0);
    expect(prefsOfRegion('kanto')).toEqual([8, 9, 10, 11, 12, 13, 14]);
    expect(prefsOfRegion('kinki')).toEqual([24, 25, 26, 27, 28, 29, 30]);
    expect(prefName(22)).toBe('静岡《しずおか》県《けん》');
    expect(prefName(1)).toBe('北海道《ほっかいどう》');
    expect(prefName(13, 'kana')).toBe('とうきょうと');
    expect(prefName(26, 'kanji')).toBe('京都《!きょうと》府《!ふ》');
    for (const p of PREFS) expect(findBareKanji(prefName(p.code))).toEqual([]);
  });
  it('容量は 200KB 以下', () => {
    const size = readFileSync('src/engines/map/data/japan.json').length;
    expect(size).toBeLessThan(200 * 1024);
  });
  it('となりの都道府県', () => {
    expect(areNeighbors(13, 11)).toBe(true);
    expect(areNeighbors(13, 14)).toBe(true);
    expect(areNeighbors(22, 23)).toBe(true);
    expect(areNeighbors(22, 15)).toBe(false);
    expect(areNeighbors(1, 2)).toBe(false); // 海をへだてる
    expect(areNeighbors(36, 37)).toBe(true);
  });
  it('ピンの位置をタップすると、その都道府県（全国の図・地方の図）', () => {
    for (const p of PREFS) {
      expect(hitPref(p.label[0], p.label[1], 'japan')).toBe(p.code);
      if (visibleIn(p.code, p.region))
        expect(hitPref(p.label[0], p.label[1], p.region)).toBe(p.code);
    }
  });
  it('小さい都道府県は、すぐそばのタップも当たり。遠い海は null', () => {
    const tokyo = PREF_BY_CODE.get(13)!;
    // 東京の輪郭の少し外（東京湾の上）
    const r = tokyo.rings[0]!;
    const maxX = Math.max(...r.map((q) => q[0]));
    const at = r.find((q) => q[0] === maxX)!;
    expect(hitPref(at[0] + 3, at[1], 'japan')).toBe(13);
    expect(hitPref(JAPAN_BOX.w - 5, JAPAN_BOX.h - 5, 'japan')).toBeNull();
  });
  it('地方の図に地方の都道府県が入る（沖縄は全国の図だけ）', () => {
    for (const r of REGIONS)
      for (const c of prefsOfRegion(r.id)) if (c !== 47) expect(visibleIn(c, r.id)).toBe(true);
    expect(visibleIn(47, 'kyushu')).toBe(false);
    expect(viewBoxOf('kanto').w).toBeLessThan(JAPAN_BOX.w);
  });
  it('方位', () => {
    expect(dirOf(0).dir).toBe('n');
    expect(dirOf(44).dir).toBe('ne');
    expect(dirOf(350).dir).toBe('n');
    expect(dirOf(100, 4).dir).toBe('e');
    expect(opposite('ne')).toBe('sw');
    expect(mirrorEW('ne')).toBe('nw');
    expect(mirrorEW('n')).toBe('n');
    expect(prefBearing(23, 22)?.dir).toBe('e');
    expect(prefBearing(27, 30)?.dir).toBe('s');
    expect(prefBearing(20, 15)?.dir).toBe('ne');
  });
  it('地図記号の名前はよみ付き', () => {
    for (const s of SYMBOL_IDS) expect(findBareKanji(SYMBOL_NAME[s])).toEqual([]);
  });
});

describe('name・region・symbol・compass（選ぶ）', () => {
  const name = mk({ kind: 'name', pref: 22, options: [22, 23, 19, 15] });
  it('正答・となり・同じ地方', () => {
    expect(judgeMap(name, { value: 22 })).toEqual({ result: 'correct' });
    expect(judgeMap(name, { value: 23 })).toMatchObject({
      result: 'wrong',
      misconception: 'nb',
      mark: [23],
    });
    expect(judgeMap(name, { value: 15 })).toMatchObject({ result: 'wrong', misconception: 'reg' });
    expect(judgeMap(name, { prefs: [22] })).toMatchObject({ result: 'retry' });
    expect(checkMap(name)).toEqual([]);
    expect(mapAnswerText(name)).toBe('静岡《しずおか》県《けん》');
  });
  it('決まった誤答が自動の誤りより先', () => {
    const it2 = mk(name.task, { wrongAnswers: [{ value: 23, misconception: 'aichi' }] });
    expect(judgeMap(it2, { value: 23 })).toMatchObject({ misconception: 'aichi' });
  });
  it('check: 正答が無い・重複・範囲外・図の外', () => {
    expect(checkMap(mk({ kind: 'name', pref: 22, options: [23, 19] }))).toContain(
      '選択肢に正答がちょうど1つ無い',
    );
    expect(checkMap(mk({ kind: 'name', pref: 22, options: [22, 22, 19] }))).toContain(
      '同じ選択肢が重複している',
    );
    expect(checkMap(mk({ kind: 'name', pref: 48, options: [48, 1] })).join()).toMatch('48');
    expect(checkMap(mk({ kind: 'name', pref: 1, options: [1, 2], view: 'kyushu' })).join()).toMatch(
      '図の範囲',
    );
    expect(
      checkMap(mk(name.task, { wrongAnswers: [{ value: 22, misconception: 'x' }] })).join(),
    ).toMatch('正答と同じ');
  });
  it('region', () => {
    const r = mk({ kind: 'region', pref: 25, options: ['kinki', 'chubu', 'kanto'] });
    expect(judgeMap(r, { value: 'kinki' })).toEqual({ result: 'correct' });
    expect(judgeMap(r, { value: 'chubu' })).toMatchObject({ result: 'wrong' });
    expect(checkMap(r)).toEqual([]);
    expect(checkMap(mk({ kind: 'region', pref: 25, options: ['chubu', 'kanto'] })).length).toBe(1);
    expect(mapAnswerText(r)).toBe('近畿《きんき》地方《ちほう》');
  });
  it('symbol', () => {
    const s = mk({ kind: 'symbol', ask: 'pick', symbol: 'temple', options: ['temple', 'shrine'] });
    expect(judgeMap(s, { value: 'temple' })).toEqual({ result: 'correct' });
    expect(judgeMap(s, { value: 'shrine' })).toMatchObject({ result: 'wrong', mark: ['shrine'] });
    expect(checkMap(s)).toEqual([]);
    expect(
      checkMap(
        mk({ kind: 'symbol', ask: 'pick', symbol: 'temple', options: ['temple', 'ufo' as never] }),
      ),
    ).toContain('無い地図記号がある');
  });
  it('compass: 反対・東西の取り違え', () => {
    const c = mk({ kind: 'compass', ask: 'point', dir: 'ne', points: 8, given: ['n'] });
    expect(judgeMap(c, { value: 'ne' })).toEqual({ result: 'correct' });
    expect(judgeMap(c, { value: 'sw' })).toMatchObject({ misconception: 'opp' });
    expect(judgeMap(c, { value: 'nw' })).toMatchObject({ misconception: 'ew' });
    expect(judgeMap(c, { value: 'e' })).toMatchObject({
      result: 'wrong',
      misconception: undefined,
    });
    expect(checkMap(c)).toEqual([]);
    expect(checkMap(mk({ kind: 'compass', ask: 'point', dir: 'ne' }))).toContain(
      '四方位の問題に八方位の答え',
    );
    expect(checkMap(mk({ kind: 'compass', ask: 'point', dir: 'n', given: ['n'] }))).toContain(
      '答えの方位の名前を見せている',
    );
  });
  it('bearing: あいまいな組は check で止める', () => {
    const b = mk({ kind: 'bearing', from: 23, to: 22 });
    expect(judgeMap(b, { value: 'e' })).toEqual({ result: 'correct' });
    expect(judgeMap(b, { value: 'w' })).toMatchObject({ misconception: 'opp' });
    expect(checkMap(b)).toEqual([]);
    expect(checkMap(mk({ kind: 'bearing', from: 13, to: 10 })).join()).toMatch('あいまい');
    expect(checkMap(mk({ kind: 'bearing', from: 46, to: 47 })).join()).toMatch('囲み');
  });
});

describe('find（地図をタップ）', () => {
  it('1つ: 正答・となり', () => {
    const f = mk({ kind: 'find', prefs: [21], view: 'chubu' });
    expect(judgeMap(f, { prefs: [21] })).toEqual({ result: 'correct' });
    expect(judgeMap(f, { prefs: [20] })).toMatchObject({
      result: 'wrong',
      misconception: 'nb',
      mark: [20],
    });
    expect(judgeMap(f, { prefs: [] })).toMatchObject({ result: 'retry' });
    expect(checkMap(f)).toEqual([]);
  });
  it('ぜんぶ: 集合一致（順不同）・足りない・よけい', () => {
    const f = mk({ kind: 'find', prefs: [36, 37, 38, 39] });
    expect(judgeMap(f, { prefs: [39, 38, 37, 36] })).toEqual({ result: 'correct' });
    expect(judgeMap(f, { prefs: [36, 37, 38] })).toMatchObject({ misconception: 'miss', mark: [] });
    expect(judgeMap(f, { prefs: [36, 37, 38, 39, 34] })).toMatchObject({ mark: [34] });
    expect(checkMap(mk({ kind: 'find', prefs: [36, 36] }))).toContain(
      'タップする都道府県が重複している',
    );
  });
});

describe('spell（かなのタイル）', () => {
  const s = mk(
    { kind: 'spell', pref: 21, tiles: ['ぎ', 'ふ', 'き', 'ぶ', 'け', 'ん'] },
    { wrongAnswers: [{ value: 'きふ', misconception: 'daku' }] },
  );
  it('「ぎふ」も「ぎふけん」も正解（withSuffix なし）', () => {
    expect(judgeMap(s, { tiles: [0, 1] })).toEqual({ result: 'correct' });
    expect(judgeMap(s, { tiles: [0, 1, 4, 5] })).toEqual({ result: 'correct' });
    expect(judgeMap(s, { tiles: [2, 1] })).toMatchObject({
      result: 'wrong',
      misconception: 'daku',
    });
    expect(judgeMap(s, { value: 1 })).toMatchObject({ result: 'retry' });
    expect(checkMap(s)).toEqual([]);
  });
  it('withSuffix は「けん」まで', () => {
    const w = mk({ kind: 'spell', pref: 21, tiles: ['ぎ', 'ふ', 'け', 'ん'], withSuffix: true });
    expect(judgeMap(w, { tiles: [0, 1] }).result).toBe('wrong');
    expect(judgeMap(w, { tiles: [0, 1, 2, 3] })).toEqual({ result: 'correct' });
    expect(checkMap(mk({ kind: 'spell', pref: 21, tiles: ['ぎ', 'け'] })).join()).toMatch(
      '作れない',
    );
  });
});

describe('town（絵地図）', () => {
  const t = mapSamples.find((x) => x.task.kind === 'town')!;
  it('北の場所・反対・取り違え', () => {
    expect(judgeMap(t, { value: 1 })).toEqual({ result: 'correct' });
    expect(judgeMap(t, { value: 4 })).toMatchObject({
      result: 'wrong',
      misconception: 'mis-opposite',
    });
    expect(judgeMap(t, { value: 2 })).toMatchObject({ result: 'wrong' });
    expect(checkMap(t)).toEqual([]);
  });
  it('check: 方位に場所が2つ・答えの方位が違う・重なり', () => {
    const tk = t.task as Extract<MapTask, { kind: 'town' }>;
    const two = mk({ ...tk, places: [...tk.places, { symbol: 'library', at: [2, 1] }] });
    expect(checkMap(two).join()).toMatch('2つ以上');
    expect(checkMap(mk({ ...tk, answer: 2 })).join()).toMatch('答えの場所が基準から');
    expect(
      checkMap(mk({ ...tk, places: [...tk.places, { symbol: 'library', at: [2, 2] }] })).join(),
    ).toMatch('重なる');
    const noDir = mk({
      kind: 'town',
      size: [3, 3],
      places: tk.places.slice(0, 2).map((p, i) => ({ ...p, at: [i, 0] as [number, number] })),
      answer: 1,
    });
    expect(checkMap(noDir)).toEqual([]);
  });
});

describe('見本', () => {
  it('checkMap が誤りを返さない・正答が正解になる', () => {
    for (const s of mapSamples) {
      expect(checkMap(s), s.id).toEqual([]);
      expect(mapAnswerText(s), s.id).not.toBe('');
    }
  });
});
