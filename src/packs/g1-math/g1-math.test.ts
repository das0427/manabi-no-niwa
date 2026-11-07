import { describe, expect, it } from 'vitest';
import { checkUnit, isReady, sampleItems } from '../../curriculum/qa';
import { buildRound } from '../../curriculum/round';
import { engineOf } from '../../engines/registry';
import pack from './index';

describe('g1-math の教材検査（curriculum-matrix 1.8）', () => {
  for (const unit of pack.units) {
    it(`${unit.id}: 検査の誤りなし・量と網羅`, () => {
      const r = checkUnit(unit);
      expect(r.errors).toEqual([]);
      // 状態を ready と書くなら、条件を満たしていること（partial は満たさなくてよい）
      if (unit.status === 'ready') expect(isReady(r)).toBe(true);
      // 報告用に出力
      console.info(
        `${unit.id}: Q ${r.q.toFixed(2)} (${r.distinct}) / C ${r.c[0]}/${r.c[1]} / 汎用誤答 ${(r.genericWrongShare * 100).toFixed(0)}%`,
      );
    });
  }

  it('全単元: number の問題は正答で正解・誤答例で誤り（各段階）', () => {
    for (const unit of pack.units) {
      for (let level = 0; level < unit.levels.length; level++) {
        for (const it of buildRound(unit, { level, seed: 11, count: 12 })) {
          if (it.engine !== 'number') continue;
          const eng = engineOf(it);
          const ans = it.fields.map((f) => String((f.answer as { value: number }).value));
          expect(eng.judge(it, ans).result, `${unit.id} ${it.id}`).toBe('correct');
          for (const w of it.wrongAnswers ?? []) {
            const j = eng.judge(it, w.value.split('|'));
            expect(j, `${unit.id} ${it.id} ${w.value}`).toMatchObject({
              result: 'wrong',
              misconception: w.misconception,
            });
          }
        }
      }
    }
  });

  // 内容レビュー #11: ヒントは答えそのものを書かない（1.2-5。compose-10 のように答えの手前で止める）
  describe('ヒントが答えを言わない（全段階・seed 600 通り）', () => {
    const unitOf = (id: string) => pack.units.find((u) => u.id === id)!;
    const numIn = (s: string, n: number) =>
      new RegExp(`(?<![0-9])${n}(?![0-9])`).test(s.replace(/1めもりは 1 /g, '').replace(/\d+めもり/g, ''));

    /** 単元の全段階から seed 600 通りで生成した問題のうち、id が prefix で始まるもの */
    function sample(unitId: string, ids: RegExp) {
      const unit = unitOf(unitId);
      const out: ReturnType<typeof sampleItems> = [];
      for (const it of sampleItems(unit, 600)) if (ids.test(it.id)) out.push(it);
      expect(out.length, `${unitId} ${ids}`).toBeGreaterThan(30);
      return out;
    }

    it('sub-borrow erabu: 正しい式の文字列がヒントに無い', () => {
      for (const it of sample('g1.math.sub-borrow', /^erabu/)) {
        if (it.engine !== 'choice') continue;
        const right = it.options.find((o) => o.correct)!.label!;
        for (const h of it.hints) expect(h, it.id).not.toContain(right);
      }
    });

    it('numbers-20 nlread・juuto: 答えの数がヒントに無い', () => {
      for (const it of sample('g1.math.numbers-20', /^(nlread:|juuto(-frame)?:)/)) {
        let ans: number;
        if (it.engine === 'numberline' && it.task.kind === 'read') ans = Number(it.task.at);
        else if (it.engine === 'number') ans = (it.fields[0]!.answer as { value: number }).value;
        else continue;
        for (const h of it.hints) expect(numIn(h, ans), `${it.id}: ${h}`).toBe(false);
      }
    });

    it('numbers-120 nl・over-nl・over-seq: 答えの数がヒントに無い', () => {
      for (const it of sample('g1.math.numbers-120', /^(nl:|over-nl:|over-seq:)/)) {
        let ans: number;
        if (it.engine === 'numberline' && it.task.kind === 'read') ans = Number(it.task.at);
        else if (it.engine === 'number') ans = (it.fields[0]!.answer as { value: number }).value;
        else continue;
        for (const h of it.hints) expect(numIn(h, ans), `${it.id}: ${h}`).toBe(false);
      }
    });

    it('position zengo・sayuu: 答えの名前がヒント③に無い', () => {
      for (const it of sample('g1.math.position', /^(zengo|sayuu):/)) {
        if (it.engine !== 'choice') continue;
        const right = it.options.find((o) => o.correct)!.label!;
        expect(it.hints[2], it.id).not.toContain(right);
      }
    });

    it('compare-quantity chokusetsu・kasa: ヒント③に 2つの かずが ならばない', () => {
      for (const it of sample('g1.math.compare-quantity', /^(yoko|tate|kasa):/)) {
        expect(it.hints[2], it.id).not.toMatch(/\d+つぶん.*\d+つぶん/);
        expect(it.hints[2], it.id).not.toMatch(/\d+はい.*\d+はい/);
      }
    });
  });

  it('compare-quantity tani-size: あ・い の どちらも正答になり、同一性は入れかえで増えない', () => {
    const items = sampleItems(pack.units.find((u) => u.id === 'g1.math.compare-quantity')!, 600)
      .filter((it) => it.id.startsWith('tani-size:'))
      .filter((it) => it.engine === 'choice');
    const answers = items.map((it) => (it.engine === 'choice' ? it.options.find((o) => o.correct)!.label : ''));
    const a = answers.filter((x) => x === 'あ').length;
    const i = answers.filter((x) => x === 'い').length;
    expect(a).toBeGreaterThan(items.length * 0.4);
    expect(i).toBeGreaterThan(items.length * 0.4);
    // 同一性キーは (a,b) の 10 通り。あ・い の入れかえは同じ問題と数える（1.4）
    expect(new Set(items.map((it) => it.identity)).size).toBe(10);
    // 問題文は 大きい ブロックの側の名前で書かれている
    for (const it of items) {
      if (it.engine !== 'choice') continue;
      const right = it.options.find((o) => o.correct)!.label;
      expect(it.prompt).toContain(`${right}は おおきい ブロック`);
    }
  });

  it('story-expression basho: 右の式に 同じ話に あう（交換した）式が 2つ ならばない', () => {
    const unit = pack.units.find((u) => u.id === 'g1.math.story-expression')!;
    // 交換した式を 同じものとみる正規形（たし算は 小さい順、ひき算はそのまま）
    const canon = (e: string) => {
      const m = /^(\d+) ([＋−]) (\d+)$/.exec(e);
      if (!m) return e;
      const [x, y] = [Number(m[1]), Number(m[3])];
      return m[2] === '＋' ? `${Math.min(x, y)}＋${Math.max(x, y)}` : `${x}−${y}`;
    };
    let n = 0;
    for (const it of sampleItems(unit, 1000)) {
      if (it.engine !== 'match' || it.objective !== 'basho') continue;
      n++;
      const labels = it.right.map((r) => canon(r.label ?? ''));
      expect(new Set(labels).size, it.id).toBe(labels.length);
    }
    expect(n).toBeGreaterThan(300);
  });

  it('three-numbers: 段階1 に くりさがりの ある式が 出ない・前提に sub-borrow', () => {
    const unit = pack.units.find((u) => u.id === 'g1.math.three-numbers')!;
    expect(unit.prereq).toContain('g1.math.sub-borrow');
    expect(unit.prereq).toContain('g1.math.add-carry');
    const borrows = (x: number, y: number) => x >= 11 && x % 10 < y;
    const parse = (id: string) => {
      const m = /(\d+)([+-])(\d+)([+-])(\d+)$/.exec(id)!;
      return { a: +m[1]!, o1: m[2]!, b: +m[3]!, o2: m[4]!, c: +m[5]! };
    };
    for (const level of [0, 1]) {
      for (const it of sampleItems(unit, 800).filter((i) => i.level === level)) {
        const { a, o1, b, o2, c } = parse(it.id);
        if (o1 === '-') expect(borrows(a, b), it.id).toBe(false);
        const mid = o1 === '+' ? a + b : a - b;
        if (o2 === '-') expect(borrows(mid, c), it.id).toBe(false);
      }
    }
    // 段階2 には くりさがりの ある式も ある
    const lv2 = sampleItems(unit, 800).filter((i) => i.level === 2);
    expect(
      lv2.some((it) => {
        const { a, o1, b, o2, c } = parse(it.id);
        const mid = o1 === '+' ? a + b : a - b;
        return (o1 === '-' && borrows(a, b)) || (o2 === '-' && borrows(mid, c));
      }),
    ).toBe(true);
  });

  it('picture-graph chigai: 問いの主語は かぞえる もの（ひとを数える題材で「みかんは なんにん」としない）', () => {
    const unit = pack.units.find((u) => u.id === 'g1.math.picture-graph')!;
    const items = sampleItems(unit, 600).filter((it) => it.id.includes('-diff:'));
    expect(items.length).toBeGreaterThan(30);
    for (const it of items) expect(it.prompt, it.id).toMatch(/(すきな ひと|のって みたい ひと|みつけた とり|に さいた はな|で とれた りんご)は/);
  });

  it('add-basic: 定義域35通りがすべて出る・正答で正解・誤答例で誤り', () => {
    const unit = pack.units.find((u) => u.id === 'g1.math.add-basic')!;
    const r = checkUnit(unit);
    expect(r.distinct).toBe(35);
    expect(isReady(r)).toBe(true);
    const items = buildRound(unit, { level: 2, seed: 7, count: 6 });
    expect(new Set(items.map((i) => i.identity)).size).toBe(items.length);
    for (const it of items) {
      if (it.engine !== 'number') continue;
      const eng = engineOf(it);
      const ans = it.fields.map((f) => String((f.answer as { value: number }).value));
      expect(eng.judge(it, ans).result).toBe('correct');
      for (const w of it.wrongAnswers ?? []) {
        const j = eng.judge(it, w.value.split('|'));
        expect(j).toMatchObject({ result: 'wrong', misconception: w.misconception });
      }
    }
  });

  // text-layout-fixes 第7回: 絵 watermelon は切った一切れ（半月の形）で球に見えないので、ボールの かたちに出さない
  it('shapes: ボールの かたちの物に すいか が出ない（どの問題の文・札・解説にも無い）', () => {
    const unit = pack.units.find((u) => u.id === 'g1.math.shapes')!;
    const items = sampleItems(unit, 300);
    expect(items.length).toBeGreaterThan(300);
    for (const it of items) {
      const json = JSON.stringify(it);
      expect(json, it.id).not.toContain('watermelon');
      expect(json, it.id).not.toContain('すいか');
    }
    // ボールの かたちは ボール・みかん・トマトの 3 つ。どれも問題に出る
    const balls = new Set<string>();
    for (const it of items)
      for (const m of JSON.stringify(it).matchAll(/"id":"(ball|mikan|tomato)"/g)) balls.add(m[1]!);
    expect([...balls].sort()).toEqual(['ball', 'mikan', 'tomato']);
  });

  // text-layout-fixes 第7回: 図の形は幅 18u で描かれる。形ごとのぴったりの枠にすると、まわした細長い形（4×1 → 1×4）が 54u の高さになり、
  // 選択肢が作業領域に入らない。3つの選択肢は同じ枠で、枠の高さは幅を超えない。おてほんも同じ枠（同じ縮尺）で描く
  it('shapes katachi-alt: おてほんと 3つの選択肢の図は同じ縮尺で、選択肢の枠の高さが幅を超えない', () => {
    const unit = pack.units.find((u) => u.id === 'g1.math.shapes')!;
    const items = sampleItems(unit, 600).filter((it) => it.id.startsWith('katachi-alt:'));
    expect(items.length).toBeGreaterThan(30);
    for (const it of items) {
      if (it.engine !== 'choice') continue;
      const boxes = it.options.map((o) => {
        const fig = o.figure;
        expect(fig?.kind, it.id).toBe('shape');
        const { w, h } = fig as { w: number; h: number };
        return `${w}x${h}`;
      });
      expect(new Set(boxes).size, `${it.id} ${boxes.join(',')}`).toBe(1);
      const [w, h] = boxes[0]!.split('x').map(Number) as [number, number];
      expect(h, it.id).toBeLessThanOrEqual(w);
      // おてほんも同じ枠・同じ縮尺。正解は おてほんを まわした形なので、ぴったり かさなる大きさで描かれる
      expect(it.figure?.kind, it.id).toBe('shape');
      const pf = it.figure as { w: number; h: number };
      expect(`${pf.w}x${pf.h}`, it.id).toBe(boxes[0]);
      // 「うえの」と言わない（図が高いと おてほんは選択肢の左に並ぶ）
      expect(it.prompt, it.id).not.toMatch(/うえの/);
    }
  });

  // text-layout-fixes 第7回: ひきざんの ブロックの図は「N こ とる」を ブロックの右に置く。下に置く（column）と、
  // 解説が出たときの図の段（高さ約 12u）に入らず、字が切れる
  it('add-sub-2digit alt: ひきざんの ブロックの図は よこ ならび（ブロックの右に「とる」数）', () => {
    const unit = pack.units.find((u) => u.id === 'g1.math.add-sub-2digit')!;
    const items = sampleItems(unit, 300).filter(
      (it) => it.id.startsWith('tens-sub-alt:') || it.id.startsWith('sub-1-alt:'),
    );
    expect(items.length).toBeGreaterThan(10);
    for (const it of items) {
      if (it.engine !== 'number') continue;
      expect(it.figure?.kind, it.id).toBe('row');
      expect(JSON.stringify(it.figure), it.id).toMatch(/こ とる/);
    }
  });
});
