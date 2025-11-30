import { getDatabase } from '../db/database';
import type { Contact, Company } from '../db/types';
import * as fuzzball from 'fuzzball';
import type { FuzzyMatchGroup } from './fuzzyMatch';

/**
 * Blocking Key Strategy for Deduplication
 * Groups records by "blocking keys" (simple hashes) to avoid O(n²) comparisons
 * Only compares records within the same bucket
 */

/**
 * Generate blocking key for a contact
 * Strategy: Use first 3 chars of last name + email domain
 */
function generateContactBlockingKey(contact: Contact): string[] {
  const keys: string[] = [];

  // Key 1: Email domain (if exists)
  if (contact.email) {
    const emailLower = contact.email.toLowerCase().trim();
    const domain = emailLower.split('@')[1];
    if (domain) {
      keys.push(`email:${domain}`);
    }
  }

  // Key 2: Last name prefix (first 3 chars)
  if (contact.last_name) {
    const prefix = contact.last_name.toLowerCase().trim().substring(0, 3);
    if (prefix.length >= 2) {
      keys.push(`lastname:${prefix}`);
    }
  }

  // Key 3: Phone (normalized, last 7 digits)
  if (contact.phone) {
    const phoneDigits = contact.phone.replace(/\D/g, '');
    if (phoneDigits.length >= 7) {
      const suffix = phoneDigits.slice(-7);
      keys.push(`phone:${suffix}`);
    }
  }

  // If no keys generated, use a catch-all
  if (keys.length === 0) {
    keys.push('unkeyed');
  }

  return keys;
}

/**
 * Generate blocking key for a company
 * Strategy: Use first 3 chars of company name + domain
 */
function generateCompanyBlockingKey(company: Company): string[] {
  const keys: string[] = [];

  // Key 1: Domain (if exists)
  if (company.domain) {
    const domainLower = company.domain.toLowerCase().trim();
    keys.push(`domain:${domainLower}`);
  }

  // Key 2: Company name prefix (first 4 chars)
  if (company.name) {
    const prefix = company.name.toLowerCase().trim().replace(/[^\w]/g, '').substring(0, 4);
    if (prefix.length >= 3) {
      keys.push(`name:${prefix}`);
    }
  }

  // Key 3: Phone (normalized, last 7 digits)
  if (company.phone) {
    const phoneDigits = company.phone.replace(/\D/g, '');
    if (phoneDigits.length >= 7) {
      const suffix = phoneDigits.slice(-7);
      keys.push(`phone:${suffix}`);
    }
  }

  // If no keys generated, use a catch-all
  if (keys.length === 0) {
    keys.push('unkeyed');
  }

  return keys;
}

/**
 * Calculate similarity score between two contacts
 */
function calculateContactSimilarity(contact1: Contact, contact2: Contact): { score: number; fields: string[] } {
  const normalizeString = (str: string | null | undefined): string => {
    if (!str) return '';
    return str.toLowerCase().trim().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
  };

  const scores: { field: string; score: number }[] = [];

  // Compare first name
  if (contact1.first_name && contact2.first_name) {
    const score = fuzzball.ratio(normalizeString(contact1.first_name), normalizeString(contact2.first_name));
    scores.push({ field: 'first_name', score });
  }

  // Compare last name
  if (contact1.last_name && contact2.last_name) {
    const score = fuzzball.ratio(normalizeString(contact1.last_name), normalizeString(contact2.last_name));
    scores.push({ field: 'last_name', score });
  }

  // Compare full name
  if (contact1.first_name && contact1.last_name && contact2.first_name && contact2.last_name) {
    const name1 = normalizeString(`${contact1.first_name} ${contact1.last_name}`);
    const name2 = normalizeString(`${contact2.first_name} ${contact2.last_name}`);
    const score = fuzzball.ratio(name1, name2);
    scores.push({ field: 'full_name', score: score * 1.2 });
  }

  // Compare company
  if (contact1.company && contact2.company) {
    const score = fuzzball.ratio(normalizeString(contact1.company), normalizeString(contact2.company));
    scores.push({ field: 'company', score: score * 0.8 });
  }

  if (scores.length === 0) {
    return { score: 0, fields: [] };
  }

  const totalScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
  const matchedFields = scores.filter((s) => s.score > 70).map((s) => s.field);

  return {
    score: Math.round(totalScore),
    fields: matchedFields,
  };
}

/**
 * Calculate similarity score between two companies
 */
function calculateCompanySimilarity(company1: Company, company2: Company): { score: number; fields: string[] } {
  const normalizeString = (str: string | null | undefined): string => {
    if (!str) return '';
    return str.toLowerCase().trim().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
  };

  const scores: { field: string; score: number }[] = [];

  // Compare company name
  if (company1.name && company2.name) {
    const score = fuzzball.ratio(normalizeString(company1.name), normalizeString(company2.name));
    scores.push({ field: 'name', score: score * 1.5 });
  }

  // Compare city
  if (company1.city && company2.city) {
    const score = fuzzball.ratio(normalizeString(company1.city), normalizeString(company2.city));
    scores.push({ field: 'city', score: score * 0.7 });
  }

  // Compare state
  if (company1.state && company2.state) {
    const score = fuzzball.ratio(normalizeString(company1.state), normalizeString(company2.state));
    scores.push({ field: 'state', score: score * 0.6 });
  }

  if (scores.length === 0) {
    return { score: 0, fields: [] };
  }

  const totalScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
  const matchedFields = scores.filter((s) => s.score > 70).map((s) => s.field);

  return {
    score: Math.round(totalScore),
    fields: matchedFields,
  };
}

/**
 * Find duplicate contacts using blocking key strategy
 * Much faster than O(n²) - only compares records with matching blocking keys
 */
export async function findContactDuplicatesWithBlocking(
  minScore: number = 80,
  onProgress?: (current: number, total: number) => void
): Promise<FuzzyMatchGroup[]> {
  console.log('=== Finding Contact Duplicates with Blocking Keys ===');

  const db = getDatabase();

  // Get all contacts
  const allContacts = db.prepare('SELECT * FROM contacts').all() as Contact[];
  console.log(`Total contacts: ${allContacts.length}`);

  // Build buckets by blocking key
  const buckets = new Map<string, Contact[]>();

  allContacts.forEach((contact) => {
    const keys = generateContactBlockingKey(contact);
    keys.forEach((key) => {
      if (!buckets.has(key)) {
        buckets.set(key, []);
      }
      buckets.get(key)!.push(contact);
    });
  });

  console.log(`Created ${buckets.size} blocking key buckets`);

  // Filter buckets to only those with 2+ records
  const candidateBuckets = Array.from(buckets.entries()).filter(([_, contacts]) => contacts.length >= 2);
  console.log(`${candidateBuckets.length} buckets have potential duplicates`);

  // Find matches within each bucket
  const groups: FuzzyMatchGroup[] = [];
  const processedPairs = new Set<string>();
  let bucketsProcessed = 0;

  for (const [_key, contacts] of candidateBuckets) {
    // Compare all pairs within this bucket
    for (let i = 0; i < contacts.length; i++) {
      for (let j = i + 1; j < contacts.length; j++) {
        const contact1 = contacts[i];
        const contact2 = contacts[j];

        const pairId = [contact1.hs_id, contact2.hs_id].sort().join('|');

        if (processedPairs.has(pairId)) {
          continue;
        }

        processedPairs.add(pairId);

        const similarity = calculateContactSimilarity(contact1, contact2);

        if (similarity.score >= minScore) {
          groups.push({
            records: [contact1, contact2],
            matchScore: similarity.score,
            matchedFields: similarity.fields,
          });
        }
      }
    }

    bucketsProcessed++;
    if (onProgress && bucketsProcessed % 10 === 0) {
      onProgress(bucketsProcessed, candidateBuckets.length);
    }
  }

  console.log(`Found ${groups.length} duplicate groups`);
  return groups;
}

/**
 * Find duplicate companies using blocking key strategy
 */
export async function findCompanyDuplicatesWithBlocking(
  minScore: number = 80,
  onProgress?: (current: number, total: number) => void
): Promise<FuzzyMatchGroup[]> {
  console.log('=== Finding Company Duplicates with Blocking Keys ===');

  const db = getDatabase();

  // Get all companies
  const allCompanies = db.prepare('SELECT * FROM companies').all() as Company[];
  console.log(`Total companies: ${allCompanies.length}`);

  // Build buckets by blocking key
  const buckets = new Map<string, Company[]>();

  allCompanies.forEach((company) => {
    const keys = generateCompanyBlockingKey(company);
    keys.forEach((key) => {
      if (!buckets.has(key)) {
        buckets.set(key, []);
      }
      buckets.get(key)!.push(company);
    });
  });

  console.log(`Created ${buckets.size} blocking key buckets`);

  // Filter buckets to only those with 2+ records
  const candidateBuckets = Array.from(buckets.entries()).filter(([_, companies]) => companies.length >= 2);
  console.log(`${candidateBuckets.length} buckets have potential duplicates`);

  // Find matches within each bucket
  const groups: FuzzyMatchGroup[] = [];
  const processedPairs = new Set<string>();
  let bucketsProcessed = 0;

  for (const [_key, companies] of candidateBuckets) {
    // Compare all pairs within this bucket
    for (let i = 0; i < companies.length; i++) {
      for (let j = i + 1; j < companies.length; j++) {
        const company1 = companies[i];
        const company2 = companies[j];

        const pairId = [company1.hs_id, company2.hs_id].sort().join('|');

        if (processedPairs.has(pairId)) {
          continue;
        }

        processedPairs.add(pairId);

        const similarity = calculateCompanySimilarity(company1, company2);

        if (similarity.score >= minScore) {
          groups.push({
            records: [company1, company2],
            matchScore: similarity.score,
            matchedFields: similarity.fields,
          });
        }
      }
    }

    bucketsProcessed++;
    if (onProgress && bucketsProcessed % 10 === 0) {
      onProgress(bucketsProcessed, candidateBuckets.length);
    }
  }

  console.log(`Found ${groups.length} duplicate groups`);
  return groups;
}
