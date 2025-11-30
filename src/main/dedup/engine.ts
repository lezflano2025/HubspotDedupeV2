import { ContactRepository, CompanyRepository } from '../db';
import { getAllExactContactMatches, getAllExactCompanyMatches } from './exactMatch';
import { findContactDuplicatesWithBlocking, findCompanyDuplicatesWithBlocking } from './blockingKeys';
import { mergeOverlappingGroups } from './fuzzyMatch';
import {
  saveExactMatchGroups,
  saveFuzzyMatchGroups,
  clearDuplicateGroups,
  getDuplicateGroupStats,
} from './grouping';

/**
 * Main deduplication engine
 * Orchestrates exact and fuzzy matching algorithms
 */

export interface DeduplicationOptions {
  runExactMatch?: boolean;
  runFuzzyMatch?: boolean;
  fuzzyMinScore?: number;
  clearExisting?: boolean;
  onProgress?: (stage: string, current: number, total: number) => void;
}

export interface DeduplicationResult {
  objectType: 'contact' | 'company';
  totalRecords: number;
  exactMatchGroups: number;
  fuzzyMatchGroups: number;
  totalDuplicates: number;
  processingTimeMs: number;
  stats: {
    byConfidence: Record<string, number>;
    byStatus: Record<string, number>;
  };
}

/**
 * Run deduplication analysis for contacts
 */
export async function runContactDeduplication(options: DeduplicationOptions = {}): Promise<DeduplicationResult> {
  const {
    runExactMatch = true,
    runFuzzyMatch = true,
    fuzzyMinScore = 80,
    clearExisting = true,
    onProgress,
  } = options;

  const startTime = Date.now();

  console.log('=== Starting Contact Deduplication ===');

  // Clear existing groups if requested
  if (clearExisting) {
    clearDuplicateGroups('contact');
  }

  // Load all contacts
  const allContacts = ContactRepository.getAll(100000); // Get up to 100k contacts
  console.log(`Loaded ${allContacts.length} contacts`);

  const matchedIds = new Set<string>();
  let exactGroups = 0;
  let fuzzyGroups = 0;

  // Phase 1: Exact Match
  if (runExactMatch) {
    console.log('--- Phase 1: Exact Matching ---');
    onProgress?.('exact_match', 0, 1);

    const exactMatchGroups = getAllExactContactMatches();
    console.log(`Found ${exactMatchGroups.length} exact match groups`);

    const savedExact = saveExactMatchGroups(exactMatchGroups, 'contact');
    exactGroups = savedExact.length;

    // Track matched IDs
    exactMatchGroups.forEach((group) => {
      group.records.forEach((record) => matchedIds.add(record.hs_id));
    });

    console.log(`Saved ${exactGroups} exact match groups, ${matchedIds.size} contacts matched`);
    onProgress?.('exact_match', 1, 1);
  }

  // Phase 2: Fuzzy Match (using blocking keys for performance)
  if (runFuzzyMatch) {
    console.log('--- Phase 2: Fuzzy Matching (Blocking Key Strategy) ---');

    if (allContacts.length > 1) {
      onProgress?.('fuzzy_match', 0, 1);

      // Use blocking key strategy instead of O(n²) comparison
      const fuzzyMatchGroups = await findContactDuplicatesWithBlocking(
        fuzzyMinScore,
        (current, total) => {
          onProgress?.('fuzzy_match', current, total);
        }
      );

      console.log(`Found ${fuzzyMatchGroups.length} fuzzy match groups (before merging)`);

      // Merge overlapping groups
      const mergedGroups = mergeOverlappingGroups(fuzzyMatchGroups);
      console.log(`After merging: ${mergedGroups.length} fuzzy match groups`);

      const savedFuzzy = saveFuzzyMatchGroups(mergedGroups, 'contact');
      fuzzyGroups = savedFuzzy.length;

      console.log(`Saved ${fuzzyGroups} fuzzy match groups`);
    }
  }

  // Get final stats
  const stats = getDuplicateGroupStats('contact');
  const processingTimeMs = Date.now() - startTime;

  console.log('=== Contact Deduplication Complete ===');
  console.log(`Total groups: ${stats.total}`);
  console.log(`Processing time: ${processingTimeMs}ms (${(processingTimeMs / 1000).toFixed(2)}s)`);

  return {
    objectType: 'contact',
    totalRecords: allContacts.length,
    exactMatchGroups: exactGroups,
    fuzzyMatchGroups: fuzzyGroups,
    totalDuplicates: stats.total,
    processingTimeMs,
    stats: {
      byConfidence: stats.byConfidence,
      byStatus: stats.byStatus,
    },
  };
}

/**
 * Run deduplication analysis for companies
 */
export async function runCompanyDeduplication(options: DeduplicationOptions = {}): Promise<DeduplicationResult> {
  const {
    runExactMatch = true,
    runFuzzyMatch = true,
    fuzzyMinScore = 80,
    clearExisting = true,
    onProgress,
  } = options;

  const startTime = Date.now();

  console.log('=== Starting Company Deduplication ===');

  // Clear existing groups if requested
  if (clearExisting) {
    clearDuplicateGroups('company');
  }

  // Load all companies
  const allCompanies = CompanyRepository.getAll(100000); // Get up to 100k companies
  console.log(`Loaded ${allCompanies.length} companies`);

  const matchedIds = new Set<string>();
  let exactGroups = 0;
  let fuzzyGroups = 0;

  // Phase 1: Exact Match
  if (runExactMatch) {
    console.log('--- Phase 1: Exact Matching ---');
    onProgress?.('exact_match', 0, 1);

    const exactMatchGroups = getAllExactCompanyMatches();
    console.log(`Found ${exactMatchGroups.length} exact match groups`);

    const savedExact = saveExactMatchGroups(exactMatchGroups, 'company');
    exactGroups = savedExact.length;

    // Track matched IDs
    exactMatchGroups.forEach((group) => {
      group.records.forEach((record) => matchedIds.add(record.hs_id));
    });

    console.log(`Saved ${exactGroups} exact match groups, ${matchedIds.size} companies matched`);
    onProgress?.('exact_match', 1, 1);
  }

  // Phase 2: Fuzzy Match (using blocking keys for performance)
  if (runFuzzyMatch) {
    console.log('--- Phase 2: Fuzzy Matching (Blocking Key Strategy) ---');

    if (allCompanies.length > 1) {
      onProgress?.('fuzzy_match', 0, 1);

      // Use blocking key strategy instead of O(n²) comparison
      const fuzzyMatchGroups = await findCompanyDuplicatesWithBlocking(
        fuzzyMinScore,
        (current, total) => {
          onProgress?.('fuzzy_match', current, total);
        }
      );

      console.log(`Found ${fuzzyMatchGroups.length} fuzzy match groups (before merging)`);

      // Merge overlapping groups
      const mergedGroups = mergeOverlappingGroups(fuzzyMatchGroups);
      console.log(`After merging: ${mergedGroups.length} fuzzy match groups`);

      const savedFuzzy = saveFuzzyMatchGroups(mergedGroups, 'company');
      fuzzyGroups = savedFuzzy.length;

      console.log(`Saved ${fuzzyGroups} fuzzy match groups`);
    }
  }

  // Get final stats
  const stats = getDuplicateGroupStats('company');
  const processingTimeMs = Date.now() - startTime;

  console.log('=== Company Deduplication Complete ===');
  console.log(`Total groups: ${stats.total}`);
  console.log(`Processing time: ${processingTimeMs}ms (${(processingTimeMs / 1000).toFixed(2)}s)`);

  return {
    objectType: 'company',
    totalRecords: allCompanies.length,
    exactMatchGroups: exactGroups,
    fuzzyMatchGroups: fuzzyGroups,
    totalDuplicates: stats.total,
    processingTimeMs,
    stats: {
      byConfidence: stats.byConfidence,
      byStatus: stats.byStatus,
    },
  };
}

/**
 * Run deduplication for both contacts and companies
 */
export async function runFullDeduplication(
  options: DeduplicationOptions = {}
): Promise<{
  contacts: DeduplicationResult;
  companies: DeduplicationResult;
}> {
  console.log('=== Starting Full Deduplication (Contacts + Companies) ===');

  const contacts = await runContactDeduplication(options);
  const companies = await runCompanyDeduplication(options);

  console.log('=== Full Deduplication Complete ===');

  return { contacts, companies };
}
