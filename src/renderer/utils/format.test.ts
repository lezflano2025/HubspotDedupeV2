import { formatSimilarity } from './format';

describe('formatSimilarity', () => {
  it('caps and formats similarity percentages', () => {
    expect(formatSimilarity(1)).toBe('100% Match');
    expect(formatSimilarity(0.985)).toBe('99% Match');
    expect(formatSimilarity(0.1234)).toBe('12% Match');
  });
});
