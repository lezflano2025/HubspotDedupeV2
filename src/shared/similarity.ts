export function normalizeSimilarity(raw: number): number {
  if (Number.isNaN(raw)) return 0;
  const normalized = raw > 1 ? raw / 100 : raw;
  return Math.min(1, Math.max(0, normalized));
}
