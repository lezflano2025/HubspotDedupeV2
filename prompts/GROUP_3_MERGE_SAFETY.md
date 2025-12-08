# Claude Code Prompt: Group 3 - Merge Safety Features

## 🎯 Objective

Add a **dry-run mode** to the merge functionality that allows users to preview what would be merged without actually executing the merge in HubSpot. This is critical for:
- Testing merge logic safely
- Manager approval workflows
- Building user confidence before irreversible operations

---

## 📁 Files to Modify

| File | Purpose |
|------|---------|
| `src/main/hubspot/merge.ts` | Core merge logic - add dry-run flag |
| `src/shared/types.ts` | Add types for dry-run options and results |
| `src/main/ipcHandlers.ts` | Update IPC handler to pass dry-run flag |
| `src/main/preload.ts` | Expose dry-run option to renderer |
| `src/renderer/pages/ResultsPage.tsx` | Add UI toggle for dry-run mode |

---

## 📖 Current State

Read these files first:

1. **`src/main/hubspot/merge.ts`** - Lines 10-22 define `MergeOptions` and `MergeResult`:
   ```typescript
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
   ```

2. **`src/main/ipcHandlers.ts`** - Find the `dedup:merge` handler

3. **`src/shared/types.ts`** - Contains shared type definitions

---

## 🔧 Implementation Steps

### Step 1: Update Types

In `src/shared/types.ts`, add or update these types:

```typescript
export interface MergeOptions {
  groupId: string;
  primaryRecordId: string;
  createBackup?: boolean;
  dryRun?: boolean;  // NEW: Preview mode
}

export interface MergeResult {
  success: boolean;
  primaryId: string;
  mergedIds: string[];
  backupPath?: string;
  error?: string;
  dryRun?: boolean;  // NEW: Indicates this was a dry run
  preview?: MergePreview;  // NEW: Detailed preview data
}

// NEW: Preview information for dry-run mode
export interface MergePreview {
  primaryRecord: Record<string, unknown>;
  recordsToMerge: Array<{
    hsId: string;
    displayName: string;
    keyFields: Record<string, unknown>;
  }>;
  estimatedChanges: string[];
  warnings: string[];
}
```

### Step 2: Update Merge Logic

Modify `src/main/hubspot/merge.ts`:

```typescript
import { requireHubSpotClient } from './auth';
import {
  ContactRepository,
  CompanyRepository,
  DuplicateGroupRepository,
  MergeHistoryRepository
} from '../db';
import { createMergeBackup } from '../dedup/backup';
import type { MergeOptions, MergeResult, MergePreview } from '../../shared/types';

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

    // 4. Get secondary record IDs
    const secondaryIds = matches
      .filter((m) => m.record_hs_id !== primaryRecordId)
      .map((m) => m.record_hs_id);

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

// Keep existing mergeContacts and mergeCompanies functions unchanged
```

### Step 3: Update IPC Handler

In `src/main/ipcHandlers.ts`, find and update the merge handler:

```typescript
// Find the existing handler that looks like:
// ipcMain.handle('dedup:merge', async (_event, groupId: string, primaryId: string) => {

// Update to:
ipcMain.handle(
  'dedup:merge',
  async (
    _event,
    groupId: string,
    primaryId: string,
    options?: { dryRun?: boolean; createBackup?: boolean }
  ) => {
    const { executeMerge } = await import('./hubspot/merge');
    return executeMerge({
      groupId,
      primaryRecordId: primaryId,
      dryRun: options?.dryRun ?? false,
      createBackup: options?.createBackup ?? true,
    });
  }
);
```

### Step 4: Update Preload Script

In `src/main/preload.ts`, update the exposed API:

```typescript
// Find the existing dedupMerge definition and update it:
dedupMerge: (
  groupId: string,
  primaryId: string,
  options?: { dryRun?: boolean; createBackup?: boolean }
): Promise<MergeResult> =>
  ipcRenderer.invoke('dedup:merge', groupId, primaryId, options),
```

### Step 5: Update UI

In `src/renderer/pages/ResultsPage.tsx`, add dry-run functionality:

```typescript
// Add state for dry-run mode
const [dryRunMode, setDryRunMode] = useState(false);
const [previewResult, setPreviewResult] = useState<MergeResult | null>(null);

// Update the handleMerge function
const handleMerge = async (groupId: string, primaryId: string) => {
  setIsMerging(true);
  setError('');
  setPreviewResult(null);

  try {
    const result = await window.api.dedupMerge(groupId, primaryId, {
      dryRun: dryRunMode
    });

    if (result.dryRun && result.success) {
      // Show preview instead of completing merge
      setPreviewResult(result);
      alert(
        `Dry Run Complete!\n\n` +
        `Would merge ${result.mergedIds.length} records into ${result.primaryId}.\n\n` +
        `${result.preview?.warnings.length ? 'Warnings:\n' + result.preview.warnings.join('\n') : 'No warnings.'}`
      );
    } else if (result.success) {
      // Actual merge completed
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
      loadStatusCounts();
      setSelectedGroup(null);
      alert(`Successfully merged ${result.mergedIds.length} records!`);
    } else {
      setError(result.error || 'Merge failed');
    }
  } catch (err) {
    console.error('Merge failed:', err);
    setError(err instanceof Error ? err.message : 'Merge operation failed');
  } finally {
    setIsMerging(false);
  }
};

// Add a toggle in the UI (in the card header area)
<div className="flex items-center gap-4 mb-4">
  <label className="flex items-center gap-2 cursor-pointer">
    <input
      type="checkbox"
      checked={dryRunMode}
      onChange={(e) => setDryRunMode(e.target.checked)}
      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
    />
    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
      Dry Run Mode
    </span>
    <span className="text-xs text-gray-500 dark:text-gray-400">
      (Preview without merging)
    </span>
  </label>
</div>

// Update merge button to show mode
<Button
  variant={dryRunMode ? 'secondary' : 'primary'}
  onClick={(e) => {
    e.stopPropagation();
    handleMerge(group.id, group.records[0].hs_id);
  }}
  isLoading={isMerging}
>
  {dryRunMode ? '👁 Preview Merge' : 'Merge →'}
</Button>
```

### Step 6: Add Preview Modal (Optional Enhancement)

For a better UX, create a preview modal component:

```typescript
// src/renderer/components/MergePreviewModal.tsx
import React from 'react';
import { Button } from './Button';
import type { MergePreview } from '../../shared/types';

interface Props {
  preview: MergePreview;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function MergePreviewModal({ preview, onConfirm, onCancel, isLoading }: Props) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            Merge Preview
          </h2>

          <div className="mb-4">
            <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Records to be merged:
            </h3>
            <ul className="space-y-2">
              {preview.recordsToMerge.map((record) => (
                <li
                  key={record.hsId}
                  className="p-2 bg-gray-50 dark:bg-gray-700 rounded"
                >
                  <div className="font-medium">{record.displayName}</div>
                  <div className="text-sm text-gray-500">ID: {record.hsId}</div>
                </li>
              ))}
            </ul>
          </div>

          <div className="mb-4">
            <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">
              What will happen:
            </h3>
            <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400">
              {preview.estimatedChanges.map((change, i) => (
                <li key={i}>{change}</li>
              ))}
            </ul>
          </div>

          {preview.warnings.length > 0 && (
            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
              <h3 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                ⚠️ Warnings
              </h3>
              <ul className="list-disc list-inside text-sm text-yellow-700 dark:text-yellow-300">
                {preview.warnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button variant="primary" onClick={onConfirm} isLoading={isLoading}>
              Confirm Merge
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## ✅ Acceptance Criteria

### Dry Run Functionality
- [ ] Dry-run mode can be enabled via UI toggle
- [ ] Dry-run returns preview without modifying HubSpot
- [ ] Dry-run returns list of records that would be merged
- [ ] Dry-run shows estimated changes and warnings
- [ ] Dry-run does NOT create merge history records
- [ ] Dry-run does NOT delete local database records

### UI/UX
- [ ] Clear visual indicator when dry-run mode is active
- [ ] Merge button text changes to "Preview Merge" in dry-run mode
- [ ] Preview results are displayed to user
- [ ] User can proceed to actual merge after preview

### Integration
- [ ] `npm run build` completes without errors
- [ ] IPC handler accepts dryRun option
- [ ] Preload exposes dryRun option
- [ ] Existing merge functionality unchanged when dryRun=false

---

## 🧪 Testing Steps

1. **Enable dry-run mode** via UI toggle
2. **Click "Preview Merge"** on a duplicate group
3. **Verify preview shows:**
   - Records that would be merged
   - Estimated changes
   - Any warnings
4. **Verify NO changes made:**
   - Check HubSpot - records still exist
   - Check local DB - records unchanged
   - Check merge history - no new entries
5. **Disable dry-run mode** and merge for real
6. **Verify actual merge works** as before

---

## 📝 Notes

- The preview modal is optional but recommended for better UX
- Consider adding a "Always preview first" setting for safety-conscious users
- The warning system can be expanded to detect more edge cases
- Dry-run results could be exported to CSV for stakeholder review

---

## 🚀 When Done

1. Run `npm run build` to verify no TypeScript errors
2. Test dry-run mode thoroughly
3. Test that actual merges still work
4. Commit with message: `feat: add dry-run mode for merge operations`
