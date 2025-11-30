import { requireHubSpotClient } from './auth';
import { ContactRepository, CompanyRepository, DuplicateGroupRepository, MergeHistoryRepository } from '../db';
import { createMergeBackup } from '../dedup/backup';

/**
 * HubSpot merge operations
 * Handles merging duplicate contacts and companies using the HubSpot API
 */

export interface MergeOptions {
  groupId: string;
  primaryRecordId: string;
  createBackup?: boolean;
}

export interface MergeResult {
  success: boolean;
  primaryId: string;
  mergedIds: string[];
  backupPath?: string;
  error?: string;
}

/**
 * Merge contacts in HubSpot
 * Uses the POST /crm/v3/objects/contacts/merge endpoint
 */
async function mergeContacts(primaryId: string, secondaryIds: string[]): Promise<void> {
  const client = requireHubSpotClient();

  for (const secondaryId of secondaryIds) {
    try {
      console.log(`Merging contact ${secondaryId} into ${primaryId}...`);

      // Use the HubSpot API v3 merge endpoint
      await client.getClient().crm.contacts.basicApi.merge({
        objectIdToMerge: secondaryId,
        primaryObjectId: primaryId,
      });

      console.log(`Successfully merged contact ${secondaryId} into ${primaryId}`);
    } catch (error) {
      console.error(`Failed to merge contact ${secondaryId}:`, error);
      throw new Error(`Failed to merge contact ${secondaryId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Merge companies in HubSpot
 * Uses the POST /crm/v3/objects/companies/merge endpoint
 */
async function mergeCompanies(primaryId: string, secondaryIds: string[]): Promise<void> {
  const client = requireHubSpotClient();

  for (const secondaryId of secondaryIds) {
    try {
      console.log(`Merging company ${secondaryId} into ${primaryId}...`);

      // Use the HubSpot API v3 merge endpoint
      await client.getClient().crm.companies.basicApi.merge({
        objectIdToMerge: secondaryId,
        primaryObjectId: primaryId,
      });

      console.log(`Successfully merged company ${secondaryId} into ${primaryId}`);
    } catch (error) {
      console.error(`Failed to merge company ${secondaryId}:`, error);
      throw new Error(`Failed to merge company ${secondaryId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Execute a merge operation
 * Creates backup, merges in HubSpot, updates database
 */
export async function executeMerge(options: MergeOptions): Promise<MergeResult> {
  const { groupId, primaryRecordId, createBackup: shouldBackup = true } = options;

  console.log(`=== Starting Merge Operation ===`);
  console.log(`Group ID: ${groupId}`);
  console.log(`Primary Record: ${primaryRecordId}`);

  let backupPath: string | undefined;

  try {
    // 1. Get the duplicate group
    const group = DuplicateGroupRepository.findById(groupId);
    if (!group) {
      throw new Error(`Duplicate group ${groupId} not found`);
    }

    // 2. Get all records in the group
    const matches = DuplicateGroupRepository.getMatches(groupId);
    if (matches.length < 2) {
      throw new Error(`Group ${groupId} has less than 2 records`);
    }

    // 3. Verify primary record is in the group
    if (!matches.find((m) => m.record_hs_id === primaryRecordId)) {
      throw new Error(`Primary record ${primaryRecordId} is not in group ${groupId}`);
    }

    // 4. Get secondary record IDs (all except primary)
    const secondaryIds = matches.filter((m) => m.record_hs_id !== primaryRecordId).map((m) => m.record_hs_id);

    if (secondaryIds.length === 0) {
      throw new Error('No secondary records to merge');
    }

    console.log(`Merging ${secondaryIds.length} records into primary ${primaryRecordId}`);

    // 5. Create backup before merging
    if (shouldBackup) {
      console.log('Creating backup...');
      backupPath = createMergeBackup(groupId, primaryRecordId);
      console.log(`Backup created: ${backupPath}`);
    }

    // 6. Perform the merge in HubSpot
    console.log('Executing merge in HubSpot...');
    if (group.object_type === 'contact') {
      await mergeContacts(primaryRecordId, secondaryIds);
    } else {
      await mergeCompanies(primaryRecordId, secondaryIds);
    }

    console.log('HubSpot merge complete');

    // 7. Update duplicate group status
    DuplicateGroupRepository.updateStatus(groupId, 'merged', primaryRecordId);

    // 8. Create merge history record
    MergeHistoryRepository.create({
      group_id: groupId,
      primary_hs_id: primaryRecordId,
      merged_hs_ids: JSON.stringify(secondaryIds),
      object_type: group.object_type,
      merge_strategy: 'user_selected',
      metadata: backupPath ? JSON.stringify({ backupPath }) : undefined,
    });

    // 9. Delete merged records from local database
    if (group.object_type === 'contact') {
      secondaryIds.forEach((id) => ContactRepository.delete(id));
    } else {
      secondaryIds.forEach((id) => CompanyRepository.delete(id));
    }

    console.log('=== Merge Operation Complete ===');

    return {
      success: true,
      primaryId: primaryRecordId,
      mergedIds: secondaryIds,
      backupPath,
    };
  } catch (error) {
    console.error('=== Merge Operation Failed ===');
    console.error(error);

    return {
      success: false,
      primaryId: primaryRecordId,
      mergedIds: [],
      backupPath,
      error: error instanceof Error ? error.message : 'Merge operation failed',
    };
  }
}
