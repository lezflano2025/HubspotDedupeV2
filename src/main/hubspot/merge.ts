import { requireHubSpotClient } from './auth';
import { ContactRepository, CompanyRepository, DuplicateGroupRepository, MergeHistoryRepository } from '../db';
import { createMergeBackup } from '../dedup/backup';
import type { MergeOptions, MergeResult, MergePreview } from '../../shared/types';

/**
 * HubSpot merge operations
 * Handles merging duplicate contacts and companies using the HubSpot API
 */

/**
 * Generate a preview of what would be merged
 */
function generateMergePreview(
  group: { object_type: string },
  primaryId: string,
  secondaryIds: string[],
  matches: Array<{ record_hs_id: string }>
): MergePreview {
  const warnings: string[] = [];
  const estimatedChanges: string[] = [];

  // Get actual record data for preview
  const Repository = group.object_type === 'contact' ? ContactRepository : CompanyRepository;

  const primaryRecord = Repository.findByHsId(primaryId);
  const secondaryRecords = secondaryIds.map(id => Repository.findByHsId(id)).filter(Boolean);

  // Build preview data
  const recordsToMerge = secondaryRecords.map(record => {
    const keyFields: Record<string, unknown> = {};

    if (group.object_type === 'contact') {
      keyFields.email = record?.email;
      keyFields.name = `${record?.first_name || ''} ${record?.last_name || ''}`.trim();
      keyFields.phone = record?.phone;
      keyFields.company = record?.company;
    } else {
      keyFields.name = record?.name;
      keyFields.domain = record?.domain;
      keyFields.phone = record?.phone;
    }

    return {
      hsId: record?.hs_id || '',
      displayName: keyFields.name as string || keyFields.email as string || record?.hs_id || '',
      keyFields,
    };
  });

  // Generate estimated changes description
  estimatedChanges.push(
    `${secondaryIds.length} record(s) will be merged into primary record ${primaryId}`
  );
  estimatedChanges.push(
    `Associations from merged records will be transferred to the primary record`
  );
  estimatedChanges.push(
    `Merged records will be deleted from HubSpot`
  );

  // Add warnings for potential issues
  if (secondaryIds.length > 5) {
    warnings.push(`Large merge: ${secondaryIds.length} records will be merged. Consider reviewing carefully.`);
  }

  // Check for data that might be lost
  secondaryRecords.forEach(record => {
    if (record?.properties) {
      try {
        const props = JSON.parse(record.properties);
        const propCount = Object.keys(props).length;
        if (propCount > 20) {
          warnings.push(`Record ${record.hs_id} has ${propCount} properties. Some data may not transfer.`);
        }
      } catch {
        // Ignore JSON parse errors
      }
    }
  });

  return {
    primaryRecord: primaryRecord || {},
    recordsToMerge,
    estimatedChanges,
    warnings,
  };
}

/**
 * Merge contacts in HubSpot
 * Uses the POST /crm/v3/objects/contacts/merge endpoint
 */
async function mergeContacts(primaryId: string, secondaryIds: string[]): Promise<void> {
  const client = requireHubSpotClient();

  for (const secondaryId of secondaryIds) {
    console.log(`Merging contact ${secondaryId} into ${primaryId}...`);

    await client.withRetry(
      async () => {
        await client.getClient().crm.contacts.basicApi.merge({
          objectIdToMerge: secondaryId,
          primaryObjectId: primaryId,
        });
      },
      {
        maxRetries: 3,
        baseDelayMs: 2000, // Start with 2s for merge operations
      }
    );

    console.log(`Successfully merged contact ${secondaryId} into ${primaryId}`);
  }
}

/**
 * Merge companies in HubSpot
 * Uses the POST /crm/v3/objects/companies/merge endpoint
 */
async function mergeCompanies(primaryId: string, secondaryIds: string[]): Promise<void> {
  const client = requireHubSpotClient();

  for (const secondaryId of secondaryIds) {
    console.log(`Merging company ${secondaryId} into ${primaryId}...`);

    await client.withRetry(
      async () => {
        await client.getClient().crm.companies.basicApi.merge({
          objectIdToMerge: secondaryId,
          primaryObjectId: primaryId,
        });
      },
      {
        maxRetries: 3,
        baseDelayMs: 2000, // Start with 2s for merge operations
      }
    );

    console.log(`Successfully merged company ${secondaryId} into ${primaryId}`);
  }
}

/**
 * Execute a merge operation (or preview in dry-run mode)
 */
export async function executeMerge(options: MergeOptions): Promise<MergeResult> {
  const {
    groupId,
    primaryRecordId,
    createBackup: shouldBackup = true,
    dryRun = false  // NEW
  } = options;

  console.log(`=== ${dryRun ? '[DRY RUN] ' : ''}Starting Merge Operation ===`);
  console.log(`Group ID: ${groupId}`);
  console.log(`Primary Record: ${primaryRecordId}`);
  console.log(`Dry Run: ${dryRun}`);

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

    // 5. DRY RUN: Return preview without making changes
    if (dryRun) {
      console.log(`[DRY RUN] Would merge ${secondaryIds.length} records into ${primaryRecordId}`);
      console.log(`[DRY RUN] Secondary IDs: ${secondaryIds.join(', ')}`);

      const preview = generateMergePreview(group, primaryRecordId, secondaryIds, matches);

      console.log(`[DRY RUN] Preview generated successfully`);
      console.log(`=== [DRY RUN] Merge Preview Complete ===`);

      return {
        success: true,
        primaryId: primaryRecordId,
        mergedIds: secondaryIds,
        dryRun: true,
        preview,
      };
    }

    // 6. ACTUAL MERGE: Continue with real operation
    console.log(`Merging ${secondaryIds.length} records into primary ${primaryRecordId}`);

    // Create backup before merging
    if (shouldBackup) {
      console.log('Creating backup...');
      backupPath = createMergeBackup(groupId, primaryRecordId);
      console.log(`Backup created: ${backupPath}`);
    }

    // Perform the merge in HubSpot
    console.log('Executing merge in HubSpot...');
    if (group.object_type === 'contact') {
      await mergeContacts(primaryRecordId, secondaryIds);
    } else {
      await mergeCompanies(primaryRecordId, secondaryIds);
    }

    console.log('HubSpot merge complete');

    // Update duplicate group status
    DuplicateGroupRepository.updateStatus(groupId, 'merged', primaryRecordId);

    // Create merge history record
    MergeHistoryRepository.create({
      group_id: groupId,
      primary_hs_id: primaryRecordId,
      merged_hs_ids: JSON.stringify(secondaryIds),
      object_type: group.object_type,
      merge_strategy: 'user_selected',
      metadata: backupPath ? JSON.stringify({ backupPath }) : undefined,
    });

    // Delete merged records from local database
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
      dryRun: false,
    };
  } catch (error) {
    console.error(`=== ${dryRun ? '[DRY RUN] ' : ''}Merge Operation Failed ===`);
    console.error(error);

    return {
      success: false,
      primaryId: primaryRecordId,
      mergedIds: [],
      backupPath,
      error: error instanceof Error ? error.message : 'Merge operation failed',
      dryRun,
    };
  }
}
