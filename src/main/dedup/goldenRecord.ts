import type { Contact, Company } from '../db/types';

/**
 * Golden record selection logic
 * Determines which record should be the "master" in a duplicate group
 */

/**
 * Score a contact based on data completeness and quality
 */
function scoreContactCompleteness(contact: Contact): number {
  let score = 0;

  // Required fields (higher weight)
  if (contact.email) score += 20;
  if (contact.first_name) score += 15;
  if (contact.last_name) score += 15;

  // Optional fields
  if (contact.phone) score += 10;
  if (contact.company) score += 10;
  if (contact.job_title) score += 8;

  // Timestamps indicate more recent data
  if (contact.updated_at) score += 5;
  if (contact.created_at) score += 2;

  // Additional properties in JSON
  if (contact.properties) {
    try {
      const props = JSON.parse(contact.properties);
      score += Math.min(Object.keys(props).length, 15); // Cap at 15 points
    } catch {
      // Invalid JSON, skip
    }
  }

  return score;
}

/**
 * Score a company based on data completeness and quality
 */
function scoreCompanyCompleteness(company: Company): number {
  let score = 0;

  // Required fields (higher weight)
  if (company.name) score += 25;
  if (company.domain) score += 20;

  // Optional fields
  if (company.phone) score += 10;
  if (company.city) score += 8;
  if (company.state) score += 7;
  if (company.country) score += 7;
  if (company.industry) score += 8;

  // Timestamps
  if (company.updated_at) score += 5;
  if (company.created_at) score += 2;

  // Additional properties in JSON
  if (company.properties) {
    try {
      const props = JSON.parse(company.properties);
      score += Math.min(Object.keys(props).length, 15);
    } catch {
      // Invalid JSON, skip
    }
  }

  return score;
}

/**
 * Parse a date string to timestamp for comparison
 */
function parseDate(dateStr: string | null | undefined): number {
  if (!dateStr) return 0;
  try {
    return new Date(dateStr).getTime();
  } catch {
    return 0;
  }
}

/**
 * Select the golden record from a group of contacts
 * SIMPLIFIED STRATEGY: Always use the oldest created_at timestamp
 * This defers to HubSpot's native merge behavior which prioritizes the original record
 */
export function selectGoldenContact(contacts: Contact[]): Contact {
  if (contacts.length === 0) {
    throw new Error('Cannot select golden record from empty array');
  }

  if (contacts.length === 1) {
    return contacts[0];
  }

  // Find the oldest record by created_at
  const scored = contacts.map((contact) => ({
    contact,
    createdAt: parseDate(contact.created_at),
  }));

  // Sort by oldest created_at (ascending order)
  scored.sort((a, b) => a.createdAt - b.createdAt);

  return scored[0].contact;
}

/**
 * Select the golden record from a group of companies
 * SIMPLIFIED STRATEGY: Always use the oldest created_at timestamp
 * This defers to HubSpot's native merge behavior which prioritizes the original record
 */
export function selectGoldenCompany(companies: Company[]): Company {
  if (companies.length === 0) {
    throw new Error('Cannot select golden record from empty array');
  }

  if (companies.length === 1) {
    return companies[0];
  }

  // Find the oldest record by created_at
  const scored = companies.map((company) => ({
    company,
    createdAt: parseDate(company.created_at),
  }));

  // Sort by oldest created_at (ascending order)
  scored.sort((a, b) => a.createdAt - b.createdAt);

  return scored[0].company;
}

/**
 * Get all non-golden records from a group
 */
export function getNonGoldenRecords<T extends Contact | Company>(records: T[], golden: T): T[] {
  return records.filter((r) => r.hs_id !== golden.hs_id);
}

/**
 * Explain why a record was selected as golden
 */
export function explainGoldenSelection(
  golden: Contact | Company,
  allRecords: (Contact | Company)[],
  type: 'contact' | 'company'
): string {
  const reasons: string[] = [];

  const goldenUpdated = parseDate(golden.updated_at);
  const mostRecent = allRecords.every((r) => parseDate(r.updated_at) <= goldenUpdated);

  if (mostRecent && goldenUpdated > 0) {
    reasons.push('Most recently updated');
  }

  const completeness =
    type === 'contact'
      ? scoreContactCompleteness(golden as Contact)
      : scoreCompanyCompleteness(golden as Company);

  const allCompleteness = allRecords.map((r) =>
    type === 'contact' ? scoreContactCompleteness(r as Contact) : scoreCompanyCompleteness(r as Company)
  );

  const mostComplete = allCompleteness.every((s) => s <= completeness);

  if (mostComplete) {
    reasons.push(`Most complete data (score: ${completeness})`);
  }

  if (reasons.length === 0) {
    reasons.push('Default selection');
  }

  return reasons.join(', ');
}
