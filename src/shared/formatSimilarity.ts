export function normalizeSimilarityScore(score: number | undefined | null): number {
  if (score === undefined || score === null || Number.isNaN(score)) {
    return 0;
  }

  const normalized = score > 1 ? score / 100 : score;

  if (normalized < 0) return 0;
  if (normalized > 1) return 1;
  return normalized;
}

export function formatSimilarity(score: number | undefined | null): number {
  const normalized = normalizeSimilarityScore(score);
  return Math.round(normalized * 100);
}
