import { describe, expect, it } from 'vitest';
import { ILLUST } from './registry';

describe('絵の登録', () => {
  it('既存の絵と教科の絵が登録されている', () => {
    expect(ILLUST.apple?.id).toBe('apple');
    expect(ILLUST['subj-sansu']?.id).toBe('subj-sansu');
  });
});
