import { describe, expect, it } from 'vitest';
import { findFracLeak } from './qa';

describe('findFracLeak（C24）', () => {
  it('読める分数は漏れとしない', () => {
    expect(findFracLeak('[[3/4]]と[[2 1/3]]と[[□/10]]')).toEqual([]);
    expect(findFracLeak('**[[1/2]]**')).toEqual([]);
  });
  it('読めない [[ ]] は漏れとして返す', () => {
    expect(findFracLeak('[[3/x]]の しき')).toEqual(['[[', ']]']);
    expect(findFracLeak('**[[a/b]]**')).toEqual(['[[', ']]']);
  });
});
