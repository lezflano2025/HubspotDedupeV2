import { DuplicateGroupRepository } from '../db';
import { generateRandomString } from '../utils/security';
import { selectGoldenContact, selectGoldenCompany } from './goldenRecord';
import type { Contact, Company } from '../db/types';
import type { ExactMatchGroup } from './exactMatch';
import type { FuzzyMatchGroup } from './fuzzyMatch';

/**
 * Grouping logic for saving duplicate groups to the database
 */

export interface SavedDuplicateGroup {
  groupId: string;
  goldenRecordId: string;
  recordCount: number;
  confidenceLevel: 'high' | 'medium' | 'low';
}

/**
 * Determine confidence level based on match type and score
 */
function getConfidenceLevel(matchType: 'exact' | 'fuzzy', score?: number): 'high' | 'medium' | 'low' {
  if (matchType === 'exact') {
    return 'high';
  }

  if (score) {
    if (score >= 95) return 'high';
    if (score >= 85) return 'medium';
    return 'low';
  }

  return 'medium';
}

/**
 * Save exact match groups to database
 */
export function saveExactMatchGroups(
  groups: ExactMatchGroup[],
  objectType: 'contact' | 'company'
): SavedDuplicateGroup[] {
  const saved: SavedDuplicateGroup[] = [];

  for (const group of groups) {
    // Generate a unique group ID
    const groupId = `${objectType}_exact_${generateRandomString(16)}`;

    // Select golden record
    const goldenRecord =
      objectType === 'contact'
        ? selectGoldenContact(group.records as Contact[])
        : selectGoldenCompany(group.records as Company[]);

    // Create duplicate group in database
    DuplicateGroupRepository.create({
      group_id: groupId,
      object_type: objectType,
      confidence_level: 'high',
      golden_hs_id: goldenRecord.hs_id,
      status: 'pending',
    });

    // Add all records as potential matches
    for (const record of group.records) {
      DuplicateGroupRepository.addMatch({
        group_id: groupId,
        record_hs_id: record.hs_id,
        match_score: 100, // Exact match
        matched_fields: JSON.stringify([group.matchField]),
        is_primary: record.hs_id === goldenRecord.hs_id ? 1 : 0,
      });
    }

    saved.push({
      groupId,
      goldenRecordId: goldenRecord.hs_id,
      recordCount: group.records.length,
      confidenceLevel: 'high',
    });

    console.log(
      `Saved exact match group ${groupId}: ${group.records.length} records, golden: ${goldenRecord.hs_id}`
    );
  }

  return saved;
}

/**
 * Save fuzzy match groups to database
 */
export function saveFuzzyMatchGroups(
  groups: FuzzyMatchGroup[],
  objectType: 'contact' | 'company'
): SavedDuplicateGroup[] {
  const saved: SavedDuplicateGroup[] = [];

  for (const group of groups) {
    // Skip groups with less than 2 records
    if (group.records.length < 2) {
      continue;
    }

    // Generate a unique group ID
    const groupId = `${objectType}_fuzzy_${generateRandomString(16)}`;

    // Select golden record
    const goldenRecord =
      objectType === 'contact'
        ? selectGoldenContact(group.records as Contact[])
        : selectGoldenCompany(group.records as Company[]);

    // Determine confidence level
    const confidenceLevel = getConfidenceLevel('fuzzy', group.matchScore);

    // Create duplicate group in database
    DuplicateGroupRepository.create({
      group_id: groupId,
      object_type: objectType,
      confidence_level: confidenceLevel,
      golden_hs_id: goldenRecord.hs_id,
      status: 'pending',
    });

    // Add all records as potential matches
    for (const record of group.records) {
      // Store both field names and scores
      const fieldData = {
        fields: group.matchedFields,
        scores: group.fieldScores || [],
      };

      DuplicateGroupRepository.addMatch({
        group_id: groupId,
        record_hs_id: record.hs_id,
        match_score: group.matchScore / 100, // Normalize to 0-1
        matched_fields: JSON.stringify(fieldData),
        is_primary: record.hs_id === goldenRecord.hs_id ? 1 : 0,
      });
    }

    saved.push({
      groupId,
      goldenRecordId: goldenRecord.hs_id,
      recordCount: group.records.length,
      confidenceLevel,
    });

    console.log(
      `Saved fuzzy match group ${groupId}: ${group.records.length} records, score: ${group.matchScore}, golden: ${goldenRecord.hs_id}`
    );
  }

  return saved;
}

/**
 * Clear existing duplicate groups for an object type
 */
export function clearDuplicateGroups(objectType: 'contact' | 'company'): number {
  const existingGroups = DuplicateGroupRepository.findByObjectType(objectType);

  let deleted = 0;
  for (const group of existingGroups) {
    if (DuplicateGroupRepository.delete(group.group_id)) {
      deleted++;
    }
  }

  console.log(`Cleared ${deleted} existing duplicate groups for ${objectType}`);
  return deleted;
}

/**
 * Get summary statistics for duplicate groups
 */
export function getDuplicateGroupStats(objectType?: 'contact' | 'company'): {
  total: number;
  byConfidence: Record<string, number>;
  byStatus: Record<string, number>;
} {
  const groups = objectType
    ? DuplicateGroupRepository.findByObjectType(objectType)
    : [...DuplicateGroupRepository.findByObjectType('contact'), ...DuplicateGroupRepository.findByObjectType('company')];

  const byConfidence: Record<string, number> = {};
  const byStatus: Record<string, number> = {};

  for (const group of groups) {
    // Count by confidence
    byConfidence[group.confidence_level] = (byConfidence[group.confidence_level] || 0) + 1;

    // Count by status
    byStatus[group.status] = (byStatus[group.status] || 0) + 1;
  }

  return {
    total: groups.length,
    byConfidence,
    byStatus,
  };
}
