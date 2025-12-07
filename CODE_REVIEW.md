# HubSpot Dedupe Tool - Comprehensive Code Review

**Review Date:** December 7, 2025
**Reviewer:** Claude (Senior Engineer Review)

---

## 1. High-Level Summary

### What the Tool Does Today

This is an **Electron desktop application** that helps HubSpot users identify and merge duplicate CRM records. The tool:

1. **Connects to HubSpot** via private app tokens or API keys
2. **Imports records** (contacts and companies) into a local SQLite database
3. **Runs deduplication analysis** using both exact and fuzzy matching algorithms
4. **Presents duplicate groups** in a React UI with confidence scoring
5. **Executes merges** via the HubSpot API with automatic backups

### Supported Objects
- **Contacts** - full dedup support (email, phone, name matching)
- **Companies** - full dedup support (domain, name matching)
- **Deals** - schema defined but deduplication not implemented

### Typical Workflow
```
Connect (API key) → Import Data → Run Analysis → Review Groups → Merge/Skip
```

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER INTERACTION (React UI)                  │
│               ConnectPage.tsx / ResultsPage.tsx                 │
└────────────────────────────┬────────────────────────────────────┘
                             │ window.api.* (IPC calls)
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│              IPC HANDLERS (ipcHandlers.ts)                      │
│                 Routing & validation layer                      │
└──┬───────┬──────────┬──────────┬──────────┬────────────────────┘
   │       │          │          │          │
   ↓       ↓          ↓          ↓          ↓
┌──────┐ ┌──────┐ ┌─────────┐ ┌──────┐ ┌────────┐
│ Auth │ │ Data │ │Deduping │ │Merge │ │Imports │
│(auth)│ │(db)  │ │(engine) │ │(HS)  │ │(HS)    │
└──┬───┘ └──┬───┘ └────┬────┘ └──┬───┘ └───┬────┘
   │        │          │         │         │
   ↓        ↓          ↓         ↓         ↓
┌──────────────────────────────────────────────────────────┐
│        SQLITE DATABASE (better-sqlite3)                  │
│  credentials | contacts | companies | duplicate_groups   │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Codebase Assessment

### Code Organization & Modularity: ⭐⭐⭐⭐ (Good)

**Strengths:**
- Clean separation between Electron main/renderer processes
- Well-organized directory structure (`hubspot/`, `dedup/`, `db/`)
- Repository pattern for database access
- Shared types between processes (`src/shared/`)
- IPC channels centralized in `ipcChannels.ts`

**Areas for Improvement:**
- Duplicate similarity calculation logic exists in both `fuzzyMatch.ts:43-110` and `blockingKeys.ts:94-139` - DRY violation
- The `goldenRecord.ts` has unused completeness scoring functions (lines 11-73 defined but not used in selection)

### Error Handling & Failure Modes: ⭐⭐⭐ (Adequate)

**Strengths:**
- Try-catch blocks around API calls (`merge.ts:31-45`, `import.ts:71-185`)
- Descriptive error messages with context
- Import batch tracking with status (`in_progress`, `completed`, `failed`)
- Merge operation creates backup before executing

**Weaknesses:**
- **No retry logic for API failures** - single HubSpot API failure stops entire merge operation (`merge.ts:31-46`)
- **Partial merge scenario not handled** - if merge 2/5 succeeds but 3/5 fails, no rollback strategy
- **Silent failures in import** - errors logged but individual record failures continue silently (`import.ts:118-125`)
- **No rate limit error detection** - relies solely on Bottleneck preemptive limiting

### Logging & Observability: ⭐⭐⭐ (Adequate)

**Strengths:**
- Console logging throughout operations
- Processing time tracked and reported
- Import progress callbacks available
- Credential sanitization in logs (`security.ts:sanitizeForLog`)

**Weaknesses:**
- All logging to console only - no persistent log files
- No structured logging format (JSON logs would help debugging)
- No correlation IDs for tracking operations across components
- Progress callbacks exist but UI doesn't display real-time progress during analysis

### Configuration Approach: ⭐⭐ (Needs Work)

**Current State:**
- `.env.example` exists but isn't fully implemented
- Hardcoded values throughout:
  - `fuzzyMinScore = 80` (`engine.ts:45`)
  - `100000` record limit (`engine.ts:60`)
  - Confidence thresholds: 95/85 (`grouping.ts:22-34`, `ResultsPage.tsx:289-292`)

**Missing Configuration:**
- No way to customize matching weights per field
- No configurable confidence thresholds
- No dry-run mode toggle
- No max records to process limit

### Test Coverage: ⭐ (Minimal)

**Current State:** No test files found in the codebase.

**Testability Assessment:**
- Business logic is decoupled from UI - highly testable
- Database operations use repository pattern - mockable
- Dedup algorithms are pure functions - unit testable
- HubSpot client abstraction allows mocking

---

## 3. Dedupe Logic Analysis

### Current Matching Strategy

**Phase 1: Exact Matching** (`exactMatch.ts`)

| Match Type | Field | Logic |
|------------|-------|-------|
| Email | `contacts.email` | Case-insensitive exact match |
| Phone | `contacts.phone` | Normalized (digits only), last 7 digits, min 10 digits |
| Name | `first_name + last_name` | Only for contacts without email |
| Domain | `companies.domain` | Case-insensitive exact match |

**Phase 2: Fuzzy Matching with Blocking** (`blockingKeys.ts`, `fuzzyMatch.ts`)

Blocking keys reduce O(n²) comparisons:
- **Contacts:** email domain, last name prefix (3 chars), phone suffix (7 digits)
- **Companies:** full domain, name prefix (4 chars), phone suffix (7 digits)

**Field Weights:**

| Contact Field | Weight | Company Field | Weight |
|---------------|--------|---------------|--------|
| email | 1.5 | name | 1.5 |
| full_name | 1.3 | domain | 1.4 |
| first_name | 1.2 | phone | 1.0 |
| last_name | 1.2 | city | 0.7 |
| phone | 1.0 | state | 0.6 |
| company | 0.8 | industry | 0.5 |
| job_title | 0.6 | | |

**Confidence Levels:**
- **HIGH:** score ≥ 95 (or exact match)
- **MEDIUM:** score 85-94
- **LOW:** score < 85

### What's Good ✓

1. **Blocking key strategy** - efficiently handles large datasets
2. **Weighted scoring** - prioritizes important fields (email, domain)
3. **Union-Find for group merging** - correctly handles transitive matches (A↔B, B↔C → A↔B↔C)
4. **Normalization** - handles case, whitespace, special characters
5. **Phone normalization** - strips formatting, matches on significant digits

### What's Risky ⚠️

1. **Phone matching on last 7 digits can cause false positives** (`exactMatch.ts:128`) - e.g., +1-555-123-4567 and +44-555-123-4567 would match

2. **Name matching only for contacts without email** (`exactMatch.ts:175`) - misses duplicates like:
   - Record 1: john.smith@gmail.com, "John Smith"
   - Record 2: j.smith@company.com, "John Smith" (same person, different emails)

3. **Golden record selection ignores completeness** (`goldenRecord.ts:92-111`) - always picks oldest record, even if a newer record has more data

4. **No handling of multiple emails** - HubSpot contacts can have multiple email addresses, but only primary is stored

5. **Domain matching for companies too strict** - "acme.com" and "www.acme.com" won't match

6. **No cross-object conflict detection** - merging contacts doesn't check associated company implications

### Edge Cases Likely Missed

1. **Name variations:** "Bob Smith" vs "Robert Smith", "Jon" vs "John"
2. **Company name variations:** "Acme Inc." vs "Acme Incorporated" vs "ACME"
3. **Email aliases:** john+newsletter@gmail.com vs john@gmail.com
4. **International phone formats:** +1 vs 001, country-specific length requirements
5. **Hyphenated names:** "Mary-Jane Watson" vs "Mary Jane Watson"
6. **Middlename handling:** "John A Smith" vs "John Smith"

---

## 4. Concrete Improvement Proposals

### UX / DevEx / CLI Improvements

| Improvement | Why | Implementation |
|-------------|-----|----------------|
| **Dry-run mode** | Preview changes before affecting HubSpot | Add `dryRun: boolean` to `executeMerge()`, skip API call but show what would merge |
| **Export to CSV before merge** | Audit trail, manager approval | Add IPC handler `dedup:export-groups` → generates CSV with all proposed merges |
| **Real-time progress bar** | Large imports can take minutes | Wire existing `onProgress` callbacks to UI state |
| **Confirmation dialog for high-risk merges** | Prevent accidental merges | Add modal when merging LOW confidence groups |
| **Batch status update** | "Mark all reviewed" button | Add `DuplicateGroupRepository.updateStatusBatch()` |
| **Keyboard shortcuts** | Power user efficiency | J/K for navigation, M for merge, R for review |

### Configuration & Safety

| Improvement | Why | Implementation |
|-------------|-----|----------------|
| **Configurable thresholds** | Different portals need different sensitivity | Store in SQLite `settings` table, expose in UI |
| **Max records cap** | Prevent runaway API usage | Add `maxRecordsToMerge` setting, enforce in engine |
| **Field weight customization** | Domain importance varies by business | Config file or UI for per-field weights |
| **Blocklist for IDs** | Never merge certain records | Add `blocklisted_hs_ids` table |
| **Require backup before merge** | Data safety | Make `createBackup: true` non-optional, verify backup exists |
| **Rate limit budget display** | Transparency | Show `limiter.running()` / `limiter.queued()` in UI footer |

### Performance & Scalability

| Improvement | Why | Implementation |
|-------------|-----|----------------|
| **Incremental import** | Don't re-fetch unchanged records | Use `lastmodifieddate` filter in HubSpot API |
| **Checkpointing** | Resume long-running analyses | Save progress to DB, add `resume` parameter to engine |
| **Parallel bucket processing** | Faster fuzzy matching | Use `Promise.all` with controlled concurrency for buckets |
| **Indexed blocking keys** | Faster bucket lookup | Add `blocking_keys` table with compound index |
| **Pagination in UI** | Handle 10k+ groups | Virtual scrolling with react-window |
| **Background processing** | Don't block UI | Move dedup engine to worker thread |

### Maintenance & Extensibility

| Improvement | Why | Implementation |
|-------------|-----|----------------|
| **Plugin architecture for matchers** | Easy to add custom rules | Define `IMatcher` interface, load from config |
| **Deal deduplication** | Already in schema | Implement `findExactDealMatches()`, similar to contacts |
| **Custom object support** | HubSpot custom objects | Generic `runObjectDeduplication(objectType, matcherConfig)` |
| **Webhook for real-time updates** | Keep local DB in sync | Subscribe to HubSpot webhooks for record changes |
| **Unit tests for dedup logic** | Prevent regressions | Jest tests for `calculateContactSimilarity`, `mergeOverlappingGroups` |
| **Integration tests** | End-to-end validation | Mock HubSpot API, test full flow |

---

## 5. Prioritized Roadmap

### Short-Term (Quick Wins) - 1-2 sessions each

| Item | Impact | Effort | Implementation Hint |
|------|--------|--------|---------------------|
| **1. Dry-run mode** | High | Low | Add boolean flag to `executeMerge()` in `merge.ts:78`, return simulated result |
| **2. Export CSV** | High | Low | New IPC handler using `json2csv` library, write to user-selected path |
| **3. Real-time progress** | Medium | Low | Connect `onProgress` in `engine.ts:97-99` to IPC event emitter |
| **4. Fix phone matching** | High | Low | Add country code normalization in `exactMatch.ts:122-128` |
| **5. Retry on API failure** | High | Medium | Wrap HubSpot calls in retry loop with exponential backoff |
| **6. Domain normalization** | Medium | Low | Strip "www." prefix in `exactMatch.ts:67-109` and `blockingKeys.ts:62` |

### Medium-Term - Larger refactors

| Item | Impact | Effort | Implementation Hint |
|------|--------|--------|---------------------|
| **7. Configurable thresholds** | High | Medium | Add `settings` table, settings page in UI, inject into engine |
| **8. Incremental import** | High | Medium | Store `last_import_timestamp`, filter API calls by `lastmodifieddate` |
| **9. Golden record by completeness** | Medium | Low | Enable `scoreContactCompleteness()` in `goldenRecord.ts:11-39`, remove oldest-first logic |
| **10. Multiple email handling** | High | Medium | Fetch `hs_additional_emails` property, store as JSON array |
| **11. Unit test suite** | High | Medium | Jest setup, test fuzzy matching with edge cases |
| **12. Partial merge recovery** | High | Medium | Track merge progress in DB, allow resume after failure |

### Long-Term - Architectural improvements

| Item | Impact | Effort | Implementation Hint |
|------|--------|--------|---------------------|
| **13. Plugin architecture** | High | High | Define `IMatcher` interface, matcher registry, config-driven loading |
| **14. Worker thread processing** | Medium | High | Move dedup engine to Node worker, IPC for progress |
| **15. Deal deduplication** | Medium | Medium | Extend engine to handle deals, add deal-specific blocking keys |
| **16. Webhook sync** | High | High | HubSpot webhook subscription, real-time DB updates |
| **17. Custom object support** | Medium | High | Generalize schema, dynamic property fetching |
| **18. Cross-object conflict detection** | Medium | High | Track associations, warn when merging related contacts/companies |

---

## 6. Code Snippets for Top Improvements

### 1. Dry-Run Mode

```typescript
// merge.ts - Add dryRun parameter
export async function executeMerge(options: MergeOptions & { dryRun?: boolean }): Promise<MergeResult> {
  const { groupId, primaryRecordId, createBackup: shouldBackup = true, dryRun = false } = options;

  // ... validation code stays the same ...

  if (dryRun) {
    console.log(`[DRY RUN] Would merge ${secondaryIds.length} records into ${primaryRecordId}`);
    return {
      success: true,
      primaryId: primaryRecordId,
      mergedIds: secondaryIds,
      dryRun: true,
    };
  }

  // ... actual merge code continues ...
}
```

### 2. Retry with Exponential Backoff

```typescript
// hubspot/client.ts - Add to HubSpotApiClient class
private async withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on 4xx errors (client errors)
      if (error instanceof Error && error.message.includes('4')) {
        throw error;
      }

      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// Usage in merge.ts:
await this.withRetry(() =>
  client.getClient().crm.contacts.basicApi.merge({
    objectIdToMerge: secondaryId,
    primaryObjectId: primaryId,
  })
);
```

### 3. Domain Normalization

```typescript
// dedup/utils.ts - New shared utility
export function normalizeDomain(domain: string | null | undefined): string {
  if (!domain) return '';
  return domain
    .toLowerCase()
    .trim()
    .replace(/^(https?:\/\/)?(www\.)?/, '')  // Strip protocol and www
    .replace(/\/.*$/, '');                    // Strip path
}

// exactMatch.ts - Update findExactCompanyMatches
const duplicateDomains = db.prepare(`
  SELECT
    REPLACE(REPLACE(LOWER(domain), 'www.', ''), 'http://', '') as normalized_domain,
    COUNT(*) as count
  FROM companies
  WHERE domain IS NOT NULL AND domain != ''
  GROUP BY normalized_domain
  HAVING count > 1
`).all();
```

### 4. Configurable Settings Schema

```typescript
// db/schema.ts - Add settings table
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('fuzzy_min_score', '80'),
  ('confidence_high_threshold', '95'),
  ('confidence_medium_threshold', '85'),
  ('max_records_per_analysis', '100000'),
  ('require_backup_before_merge', 'true'),
  ('dry_run_default', 'false');

// db/repositories/SettingsRepository.ts
export class SettingsRepository {
  static get(key: string): string | null {
    const db = getDatabase();
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? (row as { value: string }).value : null;
  }

  static set(key: string, value: string): void {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).run(key, value);
  }

  static getAll(): Record<string, string> {
    const db = getDatabase();
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  }
}
```

### 5. Email Alias Normalization

```typescript
// dedup/utils.ts - Handle Gmail/Outlook aliases
export function normalizeEmail(email: string | null | undefined): string {
  if (!email) return '';

  let normalized = email.toLowerCase().trim();

  // Handle Gmail plus addressing (john+tag@gmail.com → john@gmail.com)
  const [localPart, domain] = normalized.split('@');
  if (!domain) return normalized;

  // Gmail-style plus aliases
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    const cleanLocal = localPart.split('+')[0].replace(/\./g, '');
    return `${cleanLocal}@gmail.com`;
  }

  // General plus alias handling
  const cleanLocal = localPart.split('+')[0];
  return `${cleanLocal}@${domain}`;
}
```

---

## Summary

This is a **well-architected tool** with solid foundations. The main areas needing attention are:

1. **Safety** - Add dry-run, better error recovery, partial merge handling
2. **Flexibility** - Make thresholds and weights configurable
3. **Reliability** - Add retry logic, better rate limit handling
4. **Accuracy** - Fix phone matching edge cases, improve domain normalization
5. **Testing** - Add unit tests for critical dedup logic

The codebase is clean and modular enough that these improvements can be made incrementally without major refactoring.

---

## Appendix: Key File Reference

| Category | File | Purpose |
|----------|------|---------|
| **Entry Point** | `src/main/main.ts` | Electron app initialization |
| **Auth** | `src/main/hubspot/auth.ts` | HubSpot authentication |
| **Import** | `src/main/hubspot/import.ts` | Data fetching from HubSpot |
| **Merge** | `src/main/hubspot/merge.ts` | Execute merges via API |
| **Engine** | `src/main/dedup/engine.ts` | Orchestrates dedup pipeline |
| **Exact Match** | `src/main/dedup/exactMatch.ts` | Email/phone/name exact matching |
| **Fuzzy Match** | `src/main/dedup/fuzzyMatch.ts` | Weighted string similarity |
| **Blocking Keys** | `src/main/dedup/blockingKeys.ts` | Performance optimization |
| **Golden Record** | `src/main/dedup/goldenRecord.ts` | Primary record selection |
| **UI** | `src/renderer/pages/ResultsPage.tsx` | Main results interface |
| **Database** | `src/main/db/database.ts` | SQLite connection |
| **Schema** | `src/main/db/schema.ts` | Table definitions |
