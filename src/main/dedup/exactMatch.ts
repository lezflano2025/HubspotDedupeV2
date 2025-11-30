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

  // Find all domains that appear more than once
  const duplicateDomains = db
    .prepare(
      `
    SELECT domain, COUNT(*) as count
    FROM companies
    WHERE domain IS NOT NULL AND domain != ''
    GROUP BY LOWER(domain)
    HAVING count > 1
  `
    )
    .all() as { domain: string; count: number }[];

  console.log(`Found ${duplicateDomains.length} domains with duplicates`);

  const groups: ExactMatchGroup[] = [];

  // For each duplicate domain, get all companies with that domain
  for (const { domain } of duplicateDomains) {
    const companies = db
      .prepare(
        `
      SELECT * FROM companies
      WHERE LOWER(domain) = LOWER(?)
      ORDER BY updated_at DESC NULLS LAST
    `
      )
      .all(domain) as Company[];

    if (companies.length > 1) {
      groups.push({
        matchKey: domain.toLowerCase(),
        matchField: 'domain',
        records: companies,
      });
    }
  }

  return groups;
}

/**
 * Find contacts with exact phone matches
 * Normalizes phone numbers before comparison
 */
export function findExactPhoneMatches(): ExactMatchGroup[] {
  const db = getDatabase();

  // Normalize phone numbers by removing non-digit characters
  const duplicatePhones = db
    .prepare(
      `
    SELECT
      REPLACE(REPLACE(REPLACE(REPLACE(phone, '-', ''), ' ', ''), '(', ''), ')', '') as normalized_phone,
      COUNT(*) as count
    FROM contacts
    WHERE phone IS NOT NULL AND phone != ''
    GROUP BY normalized_phone
    HAVING count > 1 AND LENGTH(normalized_phone) >= 10
  `
    )
    .all() as { normalized_phone: string; count: number }[];

  console.log(`Found ${duplicatePhones.length} phone numbers with duplicates`);

  const groups: ExactMatchGroup[] = [];

  for (const { normalized_phone } of duplicatePhones) {
    const contacts = db
      .prepare(
        `
      SELECT * FROM contacts
      WHERE REPLACE(REPLACE(REPLACE(REPLACE(phone, '-', ''), ' ', ''), '(', ''), ')', '') = ?
      ORDER BY updated_at DESC NULLS LAST
    `
      )
      .all(normalized_phone) as Contact[];

    if (contacts.length > 1) {
      groups.push({
        matchKey: normalized_phone,
        matchField: 'phone',
        records: contacts,
      });
    }
  }

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
