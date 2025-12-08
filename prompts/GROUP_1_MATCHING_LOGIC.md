# Claude Code Prompt: Group 1 - Matching Logic Fixes

## 🎯 Objective

Fix two critical matching logic issues in the HubSpot Dedupe Tool that cause false positives and missed duplicates:
1. **Phone matching** - Currently matches on last 7 digits, causing false positives across countries
2. **Domain matching** - Currently too strict, missing duplicates like "www.acme.com" vs "acme.com"

---

## 📁 Files to Modify

| File | Purpose |
|------|---------|
| `src/main/dedup/exactMatch.ts` | Exact matching algorithms for email, phone, domain |
| `src/main/dedup/blockingKeys.ts` | Blocking key generation for fuzzy matching |
| `src/main/dedup/fuzzyMatch.ts` | String normalization utilities (optional - for shared utils) |

---

## 🔧 Task 1: Fix Phone Number Matching

### Current Problem
Location: `src/main/dedup/exactMatch.ts:115-158`

The current implementation normalizes phones by removing special characters and matching on the **last 7 digits**. This causes false positives:
- `+1-555-123-4567` (US) matches `+44-555-123-4567` (UK) - different people!

### Requirements
1. Normalize phone numbers to E.164-like format
2. Consider country code in matching
3. Handle common formats: `+1`, `001`, `1-`, `(1)`, etc.
4. Keep last 7 digits as fallback for domestic numbers without country codes
5. Minimum 10 digits requirement should remain

### Implementation Steps

1. **Create a phone normalization utility** in a new file or in `exactMatch.ts`:

```typescript
/**
 * Normalize phone number for comparison
 * Handles international formats and extracts meaningful digits
 */
function normalizePhoneNumber(phone: string | null | undefined): {
  full: string;      // Full normalized number with country code
  national: string;  // National number without country code
  isInternational: boolean;
} {
  if (!phone) return { full: '', national: '', isInternational: false };

  // Remove all non-digit characters except leading +
  let digits = phone.replace(/[^\d+]/g, '');

  // Handle + prefix
  const hasPlus = digits.startsWith('+');
  digits = digits.replace(/\+/g, '');

  // Detect international format
  // Common patterns: +1..., 001..., 011..., 00...
  let isInternational = hasPlus || digits.startsWith('00') || digits.startsWith('011');

  // Strip international dialing prefixes
  if (digits.startsWith('011')) {
    digits = digits.slice(3);
    isInternational = true;
  } else if (digits.startsWith('00')) {
    digits = digits.slice(2);
    isInternational = true;
  }

  // For US/Canada numbers starting with 1 and 11 digits
  const isNorthAmerican = digits.length === 11 && digits.startsWith('1');

  return {
    full: digits,
    national: isNorthAmerican ? digits.slice(1) : digits,
    isInternational: isInternational || digits.length > 10,
  };
}
```

2. **Update `findExactPhoneMatches()`** in `exactMatch.ts:115-158`:

```typescript
export function findExactPhoneMatches(): ExactMatchGroup[] {
  const db = getDatabase();

  // Get all contacts with phones
  const contactsWithPhones = db.prepare(`
    SELECT * FROM contacts
    WHERE phone IS NOT NULL AND phone != ''
  `).all() as Contact[];

  // Build phone -> contacts map with normalized phones
  const phoneGroups = new Map<string, Contact[]>();

  for (const contact of contactsWithPhones) {
    const normalized = normalizePhoneNumber(contact.phone);

    // Skip if too short
    if (normalized.full.length < 10) continue;

    // Use full number as key for international, national for domestic
    const key = normalized.isInternational ? normalized.full : normalized.national;

    if (!phoneGroups.has(key)) {
      phoneGroups.set(key, []);
    }
    phoneGroups.get(key)!.push(contact);
  }

  // Filter to groups with 2+ contacts
  const groups: ExactMatchGroup[] = [];

  for (const [phone, contacts] of phoneGroups) {
    if (contacts.length > 1) {
      groups.push({
        matchKey: phone,
        matchField: 'phone',
        records: contacts.sort((a, b) =>
          new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
        ),
      });
    }
  }

  console.log(`Found ${groups.length} phone numbers with duplicates`);
  return groups;
}
```

3. **Update blocking key generation** in `blockingKeys.ts:36-43`:

```typescript
// Key 3: Phone (normalized, use national number or last 10 digits)
if (contact.phone) {
  const normalized = normalizePhoneNumber(contact.phone);
  if (normalized.national.length >= 7) {
    // Use last 10 digits of national number for blocking
    const suffix = normalized.national.slice(-10);
    keys.push(`phone:${suffix}`);
  }
}
```

---

## 🔧 Task 2: Fix Domain Normalization

### Current Problem
Location: `src/main/dedup/exactMatch.ts:67-109`

The current implementation does case-insensitive matching but doesn't normalize:
- `www.acme.com` ≠ `acme.com` (should match!)
- `https://acme.com` ≠ `acme.com` (should match!)
- `acme.com/` ≠ `acme.com` (should match!)

### Requirements
1. Strip protocol (`http://`, `https://`)
2. Strip `www.` prefix
3. Strip trailing slashes and paths
4. Handle subdomains appropriately (keep them - `mail.acme.com` ≠ `acme.com`)
5. Lowercase everything

### Implementation Steps

1. **Create a domain normalization utility**:

```typescript
/**
 * Normalize domain for comparison
 * Strips protocol, www prefix, and paths
 */
function normalizeDomain(domain: string | null | undefined): string {
  if (!domain) return '';

  let normalized = domain.toLowerCase().trim();

  // Strip protocol
  normalized = normalized.replace(/^https?:\/\//, '');

  // Strip www. prefix (but keep other subdomains)
  normalized = normalized.replace(/^www\./, '');

  // Strip path, query string, hash
  normalized = normalized.split('/')[0].split('?')[0].split('#')[0];

  // Strip trailing dots
  normalized = normalized.replace(/\.+$/, '');

  return normalized;
}
```

2. **Update `findExactCompanyMatches()`** in `exactMatch.ts:67-109`:

```typescript
export function findExactCompanyMatches(): ExactMatchGroup[] {
  const db = getDatabase();

  // Get all companies with domains
  const companiesWithDomains = db.prepare(`
    SELECT * FROM companies
    WHERE domain IS NOT NULL AND domain != ''
  `).all() as Company[];

  // Build normalized domain -> companies map
  const domainGroups = new Map<string, Company[]>();

  for (const company of companiesWithDomains) {
    const normalized = normalizeDomain(company.domain);

    if (!normalized) continue;

    if (!domainGroups.has(normalized)) {
      domainGroups.set(normalized, []);
    }
    domainGroups.get(normalized)!.push(company);
  }

  // Filter to groups with 2+ companies
  const groups: ExactMatchGroup[] = [];

  for (const [domain, companies] of domainGroups) {
    if (companies.length > 1) {
      groups.push({
        matchKey: domain,
        matchField: 'domain',
        records: companies.sort((a, b) =>
          new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
        ),
      });
    }
  }

  console.log(`Found ${groups.length} domains with duplicates`);
  return groups;
}
```

3. **Update blocking key generation** in `blockingKeys.ts:60-65`:

```typescript
// Key 1: Domain (normalized)
if (company.domain) {
  const normalized = normalizeDomain(company.domain);
  if (normalized) {
    keys.push(`domain:${normalized}`);
  }
}
```

4. **Update fuzzy matching domain comparison** in `blockingKeys.ts:152-156` (if using domain in similarity):

```typescript
// Compare domain (if both have normalized domains)
const domain1 = normalizeDomain(company1.domain);
const domain2 = normalizeDomain(company2.domain);
if (domain1 && domain2) {
  const score = fuzzball.ratio(domain1, domain2);
  scores.push({ field: 'domain', score: score * 1.4 });
}
```

---

## ✅ Acceptance Criteria

### Phone Matching
- [ ] `+1-555-123-4567` does NOT match `+44-555-123-4567`
- [ ] `555-123-4567` DOES match `(555) 123-4567`
- [ ] `+1-555-123-4567` DOES match `1-555-123-4567`
- [ ] Numbers with fewer than 10 digits are skipped
- [ ] International numbers are matched by full number including country code

### Domain Matching
- [ ] `www.acme.com` DOES match `acme.com`
- [ ] `https://acme.com` DOES match `acme.com`
- [ ] `acme.com/about` DOES match `acme.com`
- [ ] `mail.acme.com` does NOT match `acme.com` (different subdomain)
- [ ] `ACME.COM` DOES match `acme.com` (case insensitive)

### Integration
- [ ] `npm run build` completes without errors
- [ ] Deduplication analysis runs successfully
- [ ] Existing exact match groups still work correctly
- [ ] Blocking keys are generated correctly for fuzzy matching

---

## 🧪 Testing Suggestions

Create test data in your HubSpot sandbox or local DB:

```sql
-- Phone test cases
INSERT INTO contacts (hs_id, first_name, last_name, phone) VALUES
  ('test1', 'John', 'Doe', '+1-555-123-4567'),
  ('test2', 'John', 'Doe', '555-123-4567'),
  ('test3', 'Jane', 'Smith', '+44-555-123-4567'),
  ('test4', 'Jane', 'Smith', '00-44-555-123-4567');

-- Domain test cases
INSERT INTO companies (hs_id, name, domain) VALUES
  ('comp1', 'Acme Corp', 'acme.com'),
  ('comp2', 'Acme Inc', 'www.acme.com'),
  ('comp3', 'Acme LLC', 'https://acme.com/'),
  ('comp4', 'Acme UK', 'uk.acme.com');
```

Expected results:
- Phone: test1 + test2 should match, test3 + test4 should match (separate group)
- Domain: comp1 + comp2 + comp3 should match, comp4 should be separate

---

## 📝 Notes

- Keep the normalization functions pure (no side effects) for easy unit testing later
- Consider extracting utilities to a shared `src/main/dedup/utils.ts` file
- Maintain backward compatibility - existing matching should still work
- Add console.log statements for debugging during development
- The blocking keys changes are important for fuzzy matching performance

---

## 🚀 When Done

1. Run `npm run build` to verify no TypeScript errors
2. Test with the dev server: `npm run dev`
3. Import some contacts/companies and run analysis
4. Verify the matching improvements in the UI
5. Commit with message: `fix: improve phone and domain normalization for better duplicate detection`
