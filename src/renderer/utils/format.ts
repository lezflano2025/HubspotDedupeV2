import { normalizeSimilarity } from '../../shared/similarity';

export { normalizeSimilarity };

export function formatSimilarity(similarity: number): string {
  const pct = Math.min(100, Math.round(normalizeSimilarity(similarity) * 100));
  return `${pct}% Match`;
}
