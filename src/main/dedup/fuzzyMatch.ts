import * as fuzzball from 'fuzzball';
import type { Contact, Company } from '../db/types';

/**
 * Fuzzy matching engine with non-blocking chunked processing
 * Uses fuzzball for string similarity comparison
 */

export interface FieldSimilarity {
  field: string;
  score: number;
}

export interface FuzzyMatchGroup {
  records: (Contact | Company)[];
  matchScore: number;
  matchedFields: string[];
  fieldScores?: FieldSimilarity[];
}

export interface FuzzyMatchOptions {
  minScore?: number;
  chunkSize?: number;
  onProgress?: (current: number, total: number) => void;
}

/**
 * Normalize a string for comparison
 */
function normalizeString(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' '); // Normalize whitespace
}

/**
 * Calculate similarity score between two contacts
 * Note: System fields (id, hs_id, created_at, updated_at, etc.) are excluded by only comparing business-relevant fields
 */
function calculateContactSimilarity(contact1: Contact, contact2: Contact): { score: number; fields: string[]; fieldScores: FieldSimilarity[] } {
  const scores: { field: string; score: number; weight: number }[] = [];

  // Compare first name
  if (contact1.first_name && contact2.first_name) {
    const score = fuzzball.ratio(normalizeString(contact1.first_name), normalizeString(contact2.first_name));
    scores.push({ field: 'first_name', score, weight: 1.2 });
  }

  // Compare last name
  if (contact1.last_name && contact2.last_name) {
    const score = fuzzball.ratio(normalizeString(contact1.last_name), normalizeString(contact2.last_name));
    scores.push({ field: 'last_name', score, weight: 1.2 });
  }

  // Compare email
  if (contact1.email && contact2.email) {
    const score = fuzzball.ratio(normalizeString(contact1.email), normalizeString(contact2.email));
    scores.push({ field: 'email', score, weight: 1.5 }); // Email is very important
  }

  // Compare full name
  if (contact1.first_name && contact1.last_name && contact2.first_name && contact2.last_name) {
    const name1 = normalizeString(`${contact1.first_name} ${contact1.last_name}`);
    const name2 = normalizeString(`${contact2.first_name} ${contact2.last_name}`);
    const score = fuzzball.ratio(name1, name2);
    scores.push({ field: 'full_name', score, weight: 1.3 }); // Give full name higher weight
  }

  // Compare company
  if (contact1.company && contact2.company) {
    const score = fuzzball.ratio(normalizeString(contact1.company), normalizeString(contact2.company));
    scores.push({ field: 'company', score, weight: 0.8 }); // Lower weight for company
  }

  // Compare job title
  if (contact1.job_title && contact2.job_title) {
    const score = fuzzball.ratio(normalizeString(contact1.job_title), normalizeString(contact2.job_title));
    scores.push({ field: 'job_title', score, weight: 0.6 }); // Lower weight for job title
  }

  // Compare phone
  if (contact1.phone && contact2.phone) {
    const score = fuzzball.ratio(normalizeString(contact1.phone), normalizeString(contact2.phone));
    scores.push({ field: 'phone', score, weight: 1.0 });
  }

  if (scores.length === 0) {
    return { score: 0, fields: [], fieldScores: [] };
  }

  // Calculate weighted average
  const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0);
  const totalScore = scores.reduce((sum, s) => sum + (s.score * s.weight), 0) / totalWeight;
  const matchedFields = scores.filter((s) => s.score > 70).map((s) => s.field);

  // Return all field scores for display
  const fieldScores: FieldSimilarity[] = scores.map((s) => ({
    field: s.field,
    score: Math.round(s.score),
  }));

  return {
    score: Math.round(totalScore),
    fields: matchedFields,
    fieldScores,
  };
}

/**
 * Calculate similarity score between two companies
 */
function calculateCompanySimilarity(company1: Company, company2: Company): { score: number; fields: string[]; fieldScores: FieldSimilarity[] } {
  const scores: { field: string; score: number; weight: number }[] = [];

  // Compare company name (highest weight)
  if (company1.name && company2.name) {
    const score = fuzzball.ratio(normalizeString(company1.name), normalizeString(company2.name));
    scores.push({ field: 'name', score, weight: 1.5 });
  }

  // Compare domain
  if (company1.domain && company2.domain) {
    const score = fuzzball.ratio(normalizeString(company1.domain), normalizeString(company2.domain));
    scores.push({ field: 'domain', score, weight: 1.4 });
  }

  // Compare phone
  if (company1.phone && company2.phone) {
    const score = fuzzball.ratio(normalizeString(company1.phone), normalizeString(company2.phone));
    scores.push({ field: 'phone', score, weight: 1.0 });
  }

  // Compare city
  if (company1.city && company2.city) {
    const score = fuzzball.ratio(normalizeString(company1.city), normalizeString(company2.city));
    scores.push({ field: 'city', score, weight: 0.7 });
  }

  // Compare state
  if (company1.state && company2.state) {
    const score = fuzzball.ratio(normalizeString(company1.state), normalizeString(company2.state));
    scores.push({ field: 'state', score, weight: 0.6 });
  }

  // Compare industry
  if (company1.industry && company2.industry) {
    const score = fuzzball.ratio(normalizeString(company1.industry), normalizeString(company2.industry));
    scores.push({ field: 'industry', score, weight: 0.5 });
  }

  if (scores.length === 0) {
    return { score: 0, fields: [], fieldScores: [] };
  }

  // Calculate weighted average
  const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0);
  const totalScore = scores.reduce((sum, s) => sum + (s.score * s.weight), 0) / totalWeight;
  const matchedFields = scores.filter((s) => s.score > 70).map((s) => s.field);

  // Return all field scores for display
  const fieldScores: FieldSimilarity[] = scores.map((s) => ({
    field: s.field,
    score: Math.round(s.score),
  }));

  return {
    score: Math.round(totalScore),
    fields: matchedFields,
    fieldScores,
  };
}

/**
 * Process a chunk of comparisons asynchronously
 */
async function processChunk<T extends Contact | Company>(
  records: T[],
  startIdx: number,
  endIdx: number,
  type: 'contact' | 'company',
  minScore: number,
  processedPairs: Set<string>
): Promise<FuzzyMatchGroup[]> {
  return new Promise((resolve) => {
    setImmediate(() => {
      const groups: FuzzyMatchGroup[] = [];

      for (let i = startIdx; i < endIdx && i < records.length; i++) {
        const record1 = records[i];

        for (let j = i + 1; j < records.length; j++) {
          const record2 = records[j];

          // Create a unique pair identifier
          const pairId = [record1.hs_id, record2.hs_id].sort().join('|');

          // Skip if we've already processed this pair
          if (processedPairs.has(pairId)) {
            continue;
          }

          processedPairs.add(pairId);

          // Calculate similarity based on type
          const similarity =
            type === 'contact'
              ? calculateContactSimilarity(record1 as Contact, record2 as Contact)
              : calculateCompanySimilarity(record1 as Company, record2 as Company);

          // If score is above threshold, add to groups
          if (similarity.score >= minScore) {
            groups.push({
              records: [record1, record2],
              matchScore: similarity.score,
              matchedFields: similarity.fields,
              fieldScores: similarity.fieldScores,
            });
          }
        }
      }

      resolve(groups);
    });
  });
}

/**
 * Find fuzzy matches among contacts
 * Processes in chunks to avoid blocking the main thread
 */
export async function findFuzzyContactMatches(
  contacts: Contact[],
  options: FuzzyMatchOptions = {}
): Promise<FuzzyMatchGroup[]> {
  const { minScore = 80, chunkSize = 100, onProgress } = options;

  console.log(`Starting fuzzy matching for ${contacts.length} contacts...`);

  const allGroups: FuzzyMatchGroup[] = [];
  const processedPairs = new Set<string>();

  // Process in chunks to avoid blocking
  for (let i = 0; i < contacts.length; i += chunkSize) {
    const endIdx = Math.min(i + chunkSize, contacts.length);

    const chunkGroups = await processChunk(contacts, i, endIdx, 'contact', minScore, processedPairs);

    allGroups.push(...chunkGroups);

    // Report progress
    if (onProgress) {
      onProgress(endIdx, contacts.length);
    }

    console.log(`Processed ${endIdx}/${contacts.length} contacts, found ${chunkGroups.length} potential matches`);
  }

  console.log(`Fuzzy matching complete. Found ${allGroups.length} potential duplicate groups`);

  return allGroups;
}

/**
 * Find fuzzy matches among companies
 * Processes in chunks to avoid blocking the main thread
 */
export async function findFuzzyCompanyMatches(
  companies: Company[],
  options: FuzzyMatchOptions = {}
): Promise<FuzzyMatchGroup[]> {
  const { minScore = 80, chunkSize = 100, onProgress } = options;

  console.log(`Starting fuzzy matching for ${companies.length} companies...`);

  const allGroups: FuzzyMatchGroup[] = [];
  const processedPairs = new Set<string>();

  // Process in chunks to avoid blocking
  for (let i = 0; i < companies.length; i += chunkSize) {
    const endIdx = Math.min(i + chunkSize, companies.length);

    const chunkGroups = await processChunk(companies, i, endIdx, 'company', minScore, processedPairs);

    allGroups.push(...chunkGroups);

    // Report progress
    if (onProgress) {
      onProgress(endIdx, companies.length);
    }

    console.log(`Processed ${endIdx}/${companies.length} companies, found ${chunkGroups.length} potential matches`);
  }

  console.log(`Fuzzy matching complete. Found ${allGroups.length} potential duplicate groups`);

  return allGroups;
}

/**
 * Merge overlapping groups into larger groups
 * If record A matches B and B matches C, they should all be in one group
 */
export function mergeOverlappingGroups<T extends Contact | Company>(groups: FuzzyMatchGroup[]): FuzzyMatchGroup[] {
  if (groups.length === 0) return [];

  // Build a map of record ID to groups it belongs to
  const recordToGroups = new Map<string, number[]>();

  groups.forEach((group, groupIdx) => {
    group.records.forEach((record) => {
      const hsId = record.hs_id;
      if (!recordToGroups.has(hsId)) {
        recordToGroups.set(hsId, []);
      }
      recordToGroups.get(hsId)!.push(groupIdx);
    });
  });

  // Union-Find to merge connected components
  const parent = new Array(groups.length).fill(0).map((_, i) => i);

  function find(x: number): number {
    if (parent[x] !== x) {
      parent[x] = find(parent[x]);
    }
    return parent[x];
  }

  function union(x: number, y: number): void {
    const rootX = find(x);
    const rootY = find(y);
    if (rootX !== rootY) {
      parent[rootX] = rootY;
    }
  }

  // Merge groups that share records
  recordToGroups.forEach((groupIndices) => {
    for (let i = 1; i < groupIndices.length; i++) {
      union(groupIndices[0], groupIndices[i]);
    }
  });

  // Collect merged groups
  const mergedGroups = new Map<number, { records: T[]; scores: number[]; fields: Set<string> }>();

  groups.forEach((group, idx) => {
    const root = find(idx);
    if (!mergedGroups.has(root)) {
      mergedGroups.set(root, { records: [], scores: [], fields: new Set() });
    }

    const merged = mergedGroups.get(root)!;
    group.records.forEach((record) => {
      if (!merged.records.find((r) => r.hs_id === record.hs_id)) {
        merged.records.push(record as T);
      }
    });
    merged.scores.push(group.matchScore);
    group.matchedFields.forEach((f) => merged.fields.add(f));
  });

  // Convert back to groups
  return Array.from(mergedGroups.values()).map((merged) => ({
    records: merged.records,
    matchScore: Math.round(merged.scores.reduce((a, b) => a + b, 0) / merged.scores.length),
    matchedFields: Array.from(merged.fields),
  }));
}
