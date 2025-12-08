# Claude Code Prompt: Group 4 - Export & Real-Time Progress

## 🎯 Objective

Implement two usability improvements:
1. **CSV Export** - Export proposed merges to CSV for audit trails and stakeholder review
2. **Real-Time Progress** - Show live progress during import and analysis operations

---

## 📁 Files to Modify/Create

| File | Purpose |
|------|---------|
| `src/main/export/index.ts` | NEW: CSV export logic |
| `src/main/ipcHandlers.ts` | Add export handler + progress events |
| `src/main/preload.ts` | Expose export API + progress listeners |
| `src/shared/types.ts` | Add export types |
| `src/shared/ipcChannels.ts` | Add new channel constants |
| `src/main/dedup/engine.ts` | Emit progress events |
| `src/main/hubspot/import.ts` | Emit progress events |
| `src/renderer/pages/ResultsPage.tsx` | Add export button + progress UI |

---

## 🔧 Part 1: CSV Export

### Step 1.1: Add Types

In `src/shared/types.ts`:

```typescript
export interface ExportOptions {
  objectType: 'contact' | 'company';
  status?: 'pending' | 'reviewed' | 'merged' | 'all';
  format?: 'csv' | 'json';
  includeFieldScores?: boolean;
}

export interface ExportResult {
  success: boolean;
  filePath?: string;
  recordCount?: number;
  error?: string;
}

export interface ExportableGroup {
  groupId: string;
  objectType: string;
  confidenceLevel: string;
  similarityScore: number;
  status: string;
  recordCount: number;
  matchedFields: string[];
  records: ExportableRecord[];
}

export interface ExportableRecord {
  hsId: string;
  isPrimary: boolean;
  // Contact fields
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  // Company fields
  name?: string;
  domain?: string;
  industry?: string;
  city?: string;
  state?: string;
  // Metadata
  createdAt?: string;
  updatedAt?: string;
}
```

### Step 1.2: Create Export Module

Create `src/main/export/index.ts`:

```typescript
import { app, dialog } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { DuplicateGroupRepository, ContactRepository, CompanyRepository } from '../db';
import type { ExportOptions, ExportResult, ExportableGroup, ExportableRecord } from '../../shared/types';

/**
 * Convert duplicate groups to exportable format
 */
function getExportableGroups(
  objectType: 'contact' | 'company',
  status?: string
): ExportableGroup[] {
  const groups = status === 'all'
    ? DuplicateGroupRepository.findByType(objectType)
    : DuplicateGroupRepository.findByTypeAndStatus(objectType, status || 'pending');

  return groups.map(group => {
    const matches = DuplicateGroupRepository.getMatches(group.group_id);
    const Repository = objectType === 'contact' ? ContactRepository : CompanyRepository;

    const records: ExportableRecord[] = matches.map(match => {
      const record = Repository.findByHsId(match.record_hs_id);

      if (objectType === 'contact') {
        return {
          hsId: match.record_hs_id,
          isPrimary: match.is_primary === 1,
          firstName: record?.first_name || '',
          lastName: record?.last_name || '',
          email: record?.email || '',
          phone: record?.phone || '',
          company: record?.company || '',
          jobTitle: record?.job_title || '',
          createdAt: record?.created_at || '',
          updatedAt: record?.updated_at || '',
        };
      } else {
        return {
          hsId: match.record_hs_id,
          isPrimary: match.is_primary === 1,
          name: record?.name || '',
          domain: record?.domain || '',
          phone: record?.phone || '',
          industry: record?.industry || '',
          city: record?.city || '',
          state: record?.state || '',
          createdAt: record?.created_at || '',
          updatedAt: record?.updated_at || '',
        };
      }
    });

    // Parse matched fields from first match (they're the same for all in group)
    let matchedFields: string[] = [];
    if (matches[0]?.matched_fields) {
      try {
        matchedFields = JSON.parse(matches[0].matched_fields);
      } catch {
        matchedFields = [];
      }
    }

    return {
      groupId: group.group_id,
      objectType: group.object_type,
      confidenceLevel: group.confidence_level,
      similarityScore: matches[0]?.match_score || 0,
      status: group.status,
      recordCount: records.length,
      matchedFields,
      records,
    };
  });
}

/**
 * Convert groups to CSV format
 */
function groupsToCSV(groups: ExportableGroup[], objectType: 'contact' | 'company'): string {
  const rows: string[] = [];

  // Header row
  if (objectType === 'contact') {
    rows.push([
      'Group ID',
      'Confidence',
      'Similarity %',
      'Status',
      'Record Count',
      'Matched Fields',
      'Record #',
      'Is Primary',
      'HubSpot ID',
      'First Name',
      'Last Name',
      'Email',
      'Phone',
      'Company',
      'Job Title',
      'Created At',
      'Updated At',
    ].join(','));
  } else {
    rows.push([
      'Group ID',
      'Confidence',
      'Similarity %',
      'Status',
      'Record Count',
      'Matched Fields',
      'Record #',
      'Is Primary',
      'HubSpot ID',
      'Company Name',
      'Domain',
      'Phone',
      'Industry',
      'City',
      'State',
      'Created At',
      'Updated At',
    ].join(','));
  }

  // Data rows
  for (const group of groups) {
    group.records.forEach((record, index) => {
      const baseFields = [
        escapeCSV(group.groupId),
        group.confidenceLevel,
        (group.similarityScore * 100).toFixed(1),
        group.status,
        group.recordCount.toString(),
        escapeCSV(group.matchedFields.join('; ')),
        (index + 1).toString(),
        record.isPrimary ? 'Yes' : 'No',
        record.hsId,
      ];

      if (objectType === 'contact') {
        rows.push([
          ...baseFields,
          escapeCSV(record.firstName || ''),
          escapeCSV(record.lastName || ''),
          escapeCSV(record.email || ''),
          escapeCSV(record.phone || ''),
          escapeCSV(record.company || ''),
          escapeCSV(record.jobTitle || ''),
          record.createdAt || '',
          record.updatedAt || '',
        ].join(','));
      } else {
        rows.push([
          ...baseFields,
          escapeCSV(record.name || ''),
          escapeCSV(record.domain || ''),
          escapeCSV(record.phone || ''),
          escapeCSV(record.industry || ''),
          escapeCSV(record.city || ''),
          escapeCSV(record.state || ''),
          record.createdAt || '',
          record.updatedAt || '',
        ].join(','));
      }
    });
  }

  return rows.join('\n');
}

/**
 * Escape a value for CSV
 */
function escapeCSV(value: string): string {
  if (!value) return '';
  // If contains comma, quote, or newline, wrap in quotes and escape quotes
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Export duplicate groups to file
 */
export async function exportDuplicateGroups(options: ExportOptions): Promise<ExportResult> {
  console.log('=== Starting Export ===');
  console.log('Options:', options);

  try {
    const groups = getExportableGroups(options.objectType, options.status);

    if (groups.length === 0) {
      return {
        success: false,
        error: 'No duplicate groups found to export',
      };
    }

    // Generate file content
    const content = options.format === 'json'
      ? JSON.stringify(groups, null, 2)
      : groupsToCSV(groups, options.objectType);

    // Get save path from user
    const defaultPath = path.join(
      app.getPath('documents'),
      `hubspot-duplicates-${options.objectType}-${Date.now()}.${options.format || 'csv'}`
    );

    const { filePath, canceled } = await dialog.showSaveDialog({
      title: 'Export Duplicate Groups',
      defaultPath,
      filters: options.format === 'json'
        ? [{ name: 'JSON', extensions: ['json'] }]
        : [{ name: 'CSV', extensions: ['csv'] }],
    });

    if (canceled || !filePath) {
      return {
        success: false,
        error: 'Export cancelled by user',
      };
    }

    // Write file
    fs.writeFileSync(filePath, content, 'utf-8');

    console.log(`=== Export Complete: ${filePath} ===`);
    console.log(`Exported ${groups.length} groups`);

    return {
      success: true,
      filePath,
      recordCount: groups.reduce((sum, g) => sum + g.recordCount, 0),
    };
  } catch (error) {
    console.error('Export failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Export failed',
    };
  }
}
```

### Step 1.3: Add IPC Handler

In `src/main/ipcHandlers.ts`, add:

```typescript
import { exportDuplicateGroups } from './export';
import type { ExportOptions } from '../shared/types';

// Add this handler
ipcMain.handle('export:duplicate-groups', async (_event, options: ExportOptions) => {
  return exportDuplicateGroups(options);
});
```

### Step 1.4: Update Preload

In `src/main/preload.ts`, add:

```typescript
exportDuplicateGroups: (options: ExportOptions): Promise<ExportResult> =>
  ipcRenderer.invoke('export:duplicate-groups', options),
```

### Step 1.5: Add Export Button to UI

In `src/renderer/pages/ResultsPage.tsx`:

```typescript
// Add state
const [isExporting, setIsExporting] = useState(false);

// Add export handler
const handleExport = async () => {
  setIsExporting(true);
  setError('');

  try {
    const result = await window.api.exportDuplicateGroups({
      objectType,
      status: 'pending',
      format: 'csv',
    });

    if (result.success) {
      alert(`Export complete!\n\nSaved ${result.recordCount} records to:\n${result.filePath}`);
    } else {
      setError(result.error || 'Export failed');
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Export failed');
  } finally {
    setIsExporting(false);
  }
};

// Add button in the header area (near Import/Analyze buttons)
<Button
  variant="secondary"
  onClick={handleExport}
  isLoading={isExporting}
  disabled={groups.length === 0}
>
  📥 Export to CSV
</Button>
```

---

## 🔧 Part 2: Real-Time Progress

### Step 2.1: Add Progress Types

In `src/shared/types.ts`:

```typescript
export interface ProgressEvent {
  type: 'import' | 'analysis';
  stage: string;
  current: number;
  total: number;
  message?: string;
  objectType?: 'contact' | 'company';
}
```

### Step 2.2: Add IPC Channel Constants

In `src/shared/ipcChannels.ts`:

```typescript
export const IPC_CHANNELS = {
  // ... existing channels
  PROGRESS_UPDATE: 'progress:update',
} as const;
```

### Step 2.3: Update Engine to Emit Progress

In `src/main/dedup/engine.ts`, modify to emit IPC events:

```typescript
import { BrowserWindow } from 'electron';

function emitProgress(stage: string, current: number, total: number, objectType: 'contact' | 'company') {
  const windows = BrowserWindow.getAllWindows();
  windows.forEach(win => {
    win.webContents.send('progress:update', {
      type: 'analysis',
      stage,
      current,
      total,
      objectType,
      message: `${stage}: ${current}/${total}`,
    });
  });
}

// In runContactDeduplication, update progress callbacks:
export async function runContactDeduplication(options: DeduplicationOptions = {}): Promise<DeduplicationResult> {
  // ... existing code

  // Phase 1: Exact Match
  if (runExactMatch) {
    console.log('--- Phase 1: Exact Matching ---');
    emitProgress('Exact Matching', 0, 1, 'contact');
    onProgress?.('exact_match', 0, 1);

    const exactMatchGroups = getAllExactContactMatches();
    // ... existing code

    emitProgress('Exact Matching', 1, 1, 'contact');
    onProgress?.('exact_match', 1, 1);
  }

  // Phase 2: Fuzzy Match
  if (runFuzzyMatch) {
    console.log('--- Phase 2: Fuzzy Matching ---');

    if (allContacts.length > 1) {
      const fuzzyMatchGroups = await findContactDuplicatesWithBlocking(
        fuzzyMinScore,
        (current, total) => {
          emitProgress('Fuzzy Matching', current, total, 'contact');
          onProgress?.('fuzzy_match', current, total);
        }
      );
      // ... existing code
    }
  }

  // ... rest of function
}

// Do the same for runCompanyDeduplication
```

### Step 2.4: Update Import to Emit Progress

In `src/main/hubspot/import.ts`:

```typescript
import { BrowserWindow } from 'electron';

function emitImportProgress(
  objectType: 'contact' | 'company',
  fetched: number,
  saved: number,
  isComplete: boolean
) {
  const windows = BrowserWindow.getAllWindows();
  windows.forEach(win => {
    win.webContents.send('progress:update', {
      type: 'import',
      stage: isComplete ? 'Complete' : 'Importing',
      current: saved,
      total: fetched,
      objectType,
      message: `Imported ${saved} of ${fetched} ${objectType}s`,
    });
  });
}

// In the import loop:
for await (const batch of client.fetchAllContacts(properties)) {
  totalFetched += batch.length;

  for (const contact of batch) {
    // ... existing save logic
    totalSaved++;
  }

  // Emit progress via IPC
  emitImportProgress('contact', totalFetched, totalSaved, false);

  // Existing progress callback
  if (onProgress) {
    onProgress({ /* ... */ });
  }
}

// After loop completes
emitImportProgress('contact', totalFetched, totalSaved, true);
```

### Step 2.5: Listen for Progress in Preload

In `src/main/preload.ts`:

```typescript
// Add to the exposed API
onProgressUpdate: (callback: (event: ProgressEvent) => void) => {
  const handler = (_event: IpcRendererEvent, data: ProgressEvent) => callback(data);
  ipcRenderer.on('progress:update', handler);

  // Return cleanup function
  return () => {
    ipcRenderer.removeListener('progress:update', handler);
  };
},
```

### Step 2.6: Add Progress UI

In `src/renderer/pages/ResultsPage.tsx`:

```typescript
// Add state
const [progress, setProgress] = useState<{
  stage: string;
  current: number;
  total: number;
  message?: string;
} | null>(null);

// Subscribe to progress updates
useEffect(() => {
  const unsubscribe = window.api.onProgressUpdate((event) => {
    if (event.objectType === objectType) {
      setProgress({
        stage: event.stage,
        current: event.current,
        total: event.total,
        message: event.message,
      });
    }
  });

  return () => {
    unsubscribe();
  };
}, [objectType]);

// Clear progress when operations complete
useEffect(() => {
  if (!isAnalyzing && !isImporting) {
    // Delay clearing to show completion briefly
    const timer = setTimeout(() => setProgress(null), 2000);
    return () => clearTimeout(timer);
  }
}, [isAnalyzing, isImporting]);

// Add progress bar component (put this above the groups list)
{progress && (
  <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
    <div className="flex justify-between text-sm mb-2">
      <span className="font-medium text-blue-900 dark:text-blue-200">
        {progress.stage}
      </span>
      <span className="text-blue-700 dark:text-blue-300">
        {progress.current} / {progress.total}
      </span>
    </div>
    <div className="h-2 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
      <div
        className="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-300"
        style={{
          width: progress.total > 0
            ? `${Math.min(100, (progress.current / progress.total) * 100)}%`
            : '0%'
        }}
      />
    </div>
    {progress.message && (
      <div className="mt-1 text-xs text-blue-600 dark:text-blue-400">
        {progress.message}
      </div>
    )}
  </div>
)}
```

---

## ✅ Acceptance Criteria

### CSV Export
- [ ] Export button visible when groups exist
- [ ] Clicking export opens save dialog
- [ ] CSV contains all duplicate groups with correct format
- [ ] All record fields are properly escaped
- [ ] Export works for both contacts and companies
- [ ] Success message shows file path and record count

### Real-Time Progress
- [ ] Progress bar appears during import
- [ ] Progress bar appears during analysis
- [ ] Progress updates in real-time (not just at end)
- [ ] Progress shows current/total counts
- [ ] Progress clears after operation completes
- [ ] Separate progress for contacts vs companies

### Integration
- [ ] `npm run build` completes without errors
- [ ] No memory leaks from IPC listeners
- [ ] Progress doesn't slow down operations significantly

---

## 🧪 Testing Steps

### Export Testing
1. Run analysis to generate duplicate groups
2. Click "Export to CSV" button
3. Choose save location
4. Open CSV in Excel/Google Sheets
5. Verify all groups and records are present
6. Verify special characters are escaped correctly

### Progress Testing
1. Import a large number of contacts (100+)
2. Observe progress bar updating during import
3. Run analysis on imported data
4. Observe progress bar during exact and fuzzy matching phases
5. Verify progress completes at 100%

---

## 📝 Notes

- The export uses Electron's `dialog.showSaveDialog` for native file picker
- Progress events use `webContents.send` for real-time updates
- Remember to clean up IPC listeners to prevent memory leaks
- Consider adding a "Cancel" button for long operations (future enhancement)
- JSON export option provides more detailed data for technical users

---

## 🚀 When Done

1. Run `npm run build` to verify no TypeScript errors
2. Test export with various group sizes
3. Test progress with both small and large datasets
4. Verify no console errors or memory leaks
5. Commit with message: `feat: add CSV export and real-time progress indicators`
