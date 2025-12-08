import { getDatabase } from '../db/database';
import type { Contact, Company } from '../db/types';

/**
 * Exact match algorithms for finding duplicates
 * Uses SQL queries for fast exact matching on indexed fields
 */

export interface ExactMatchGroup {
  matchKey: string;
  matchField: string;
  records: (Contact | Company)[];
}

/**
 * Normalize phone number for comparison
 * Handles international formats and extracts meaningful digits
 */
export function normalizePhoneNumber(phone: string | null | undefined): {
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

/**
 * Normalize domain for comparison
 * Strips protocol, www prefix, and paths
 */
export function normalizeDomain(domain: string | null | undefined): string {
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

/**
 * Find contacts with exact email matches
 * Groups contacts that share the same email address
 */
export function findExactContactMatches(): ExactMatchGroup[] {
  const db = getDatabase();

  // Find all emails that appear more than once
  const duplicateEmails = db
    .prepare(
      `
    SELECT email, COUNT(*) as count
    FROM contacts
    WHERE email IS NOT NULL AND email != ''
    GROUP BY LOWER(email)
    HAVING count > 1
  `
    )
    .all() as { email: string; count: number }[];

  console.log(`Found ${duplicateEmails.length} email addresses with duplicates`);

  const groups: ExactMatchGroup[] = [];

  // For each duplicate email, get all contacts with that email
  for (const { email } of duplicateEmails) {
    const contacts = db
      .prepare(
        `
      SELECT * FROM contacts
      WHERE LOWER(email) = LOWER(?)
      ORDER BY updated_at DESC NULLS LAST
    `
      )
      .all(email) as Contact[];

    if (contacts.length > 1) {
      groups.push({
        matchKey: email.toLowerCase(),
        matchField: 'email',
        records: contacts,
      });
    }
  }

  return groups;
}

/**
 * Find companies with exact domain matches
 * Groups companies that share the same domain
 */
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

/**
 * Find contacts with exact phone matches
 * Normalizes phone numbers before comparison
 */
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

/**
 * Find contacts with exact name matches (first + last)
 * Only considers contacts without email for efficiency
 */
export function findExactNameMatches(): ExactMatchGroup[] {
  const db = getDatabase();

  const duplicateNames = db
    .prepare(
      `
    SELECT
      LOWER(TRIM(first_name)) || ' ' || LOWER(TRIM(last_name)) as full_name,
      COUNT(*) as count
    FROM contacts
    WHERE first_name IS NOT NULL AND last_name IS NOT NULL
      AND (email IS NULL OR email = '')
    GROUP BY full_name
    HAVING count > 1 AND LENGTH(full_name) > 3
  `
    )
    .all() as { full_name: string; count: number }[];

  console.log(`Found ${duplicateNames.length} name combinations with duplicates`);

  const groups: ExactMatchGroup[] = [];

  for (const { full_name } of duplicateNames) {
    const [firstName, ...lastNameParts] = full_name.split(' ');
    const lastName = lastNameParts.join(' ');

    const contacts = db
      .prepare(
        `
      SELECT * FROM contacts
      WHERE LOWER(TRIM(first_name)) = ? AND LOWER(TRIM(last_name)) = ?
        AND (email IS NULL OR email = '')
      ORDER BY updated_at DESC NULLS LAST
    `
      )
      .all(firstName, lastName) as Contact[];

    if (contacts.length > 1) {
      groups.push({
        matchKey: full_name,
        matchField: 'name',
        records: contacts,
      });
    }
  }

  return groups;
}

/**
 * Get all exact matches for contacts
 */
export function getAllExactContactMatches(): ExactMatchGroup[] {
  const emailGroups = findExactContactMatches();
  const phoneGroups = findExactPhoneMatches();
  const nameGroups = findExactNameMatches();

  return [...emailGroups, ...phoneGroups, ...nameGroups];
}

/**
 * Get all exact matches for companies
 */
export function getAllExactCompanyMatches(): ExactMatchGroup[] {
  return findExactCompanyMatches();
}
