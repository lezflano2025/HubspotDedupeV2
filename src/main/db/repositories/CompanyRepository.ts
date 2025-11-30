import { getDatabase } from '../database';
import type { Company, CompanyInsert } from '../types';

/**
 * Repository for managing companies
 */
export class CompanyRepository {
  /**
   * Find company by HubSpot ID
   */
  static findByHsId(hsId: string): Company | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM companies WHERE hs_id = ?');
    return (stmt.get(hsId) as Company) || null;
  }

  /**
   * Find companies by domain
   */
  static findByDomain(domain: string): Company[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM companies WHERE domain = ?');
    return stmt.all(domain) as Company[];
  }

  /**
   * Find companies by name
   */
  static findByName(name: string): Company[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM companies WHERE name LIKE ?');
    return stmt.all(`%${name}%`) as Company[];
  }

  /**
   * Insert a new company
   */
  static insert(company: CompanyInsert): Company {
    const db = getDatabase();

    const stmt = db.prepare(`
      INSERT INTO companies (
        hs_id, name, domain, phone, city, state, country, industry,
        created_at, updated_at, properties
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `);

    return stmt.get(
      company.hs_id,
      company.name || null,
      company.domain || null,
      company.phone || null,
      company.city || null,
      company.state || null,
      company.country || null,
      company.industry || null,
      company.created_at || null,
      company.updated_at || null,
      company.properties || null
    ) as Company;
  }

  /**
   * Upsert a company (insert or replace if exists)
   */
  static upsert(company: CompanyInsert): void {
    const db = getDatabase();

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO companies (
        hs_id, name, domain, phone, city, state, country, industry,
        created_at, updated_at, properties
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      company.hs_id,
      company.name || null,
      company.domain || null,
      company.phone || null,
      company.city || null,
      company.state || null,
      company.country || null,
      company.industry || null,
      company.created_at || null,
      company.updated_at || null,
      company.properties || null
    );
  }

  /**
   * Bulk insert companies
   */
  static bulkInsert(companies: CompanyInsert[]): number {
    const db = getDatabase();

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO companies (
        hs_id, name, domain, phone, city, state, country, industry,
        created_at, updated_at, properties
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((records: CompanyInsert[]) => {
      for (const company of records) {
        stmt.run(
          company.hs_id,
          company.name || null,
          company.domain || null,
          company.phone || null,
          company.city || null,
          company.state || null,
          company.country || null,
          company.industry || null,
          company.created_at || null,
          company.updated_at || null,
          company.properties || null
        );
      }
    });

    insertMany(companies);
    return companies.length;
  }

  /**
   * Update company
   */
  static update(hsId: string, updates: Partial<CompanyInsert>): Company | null {
    const db = getDatabase();

    const fields: string[] = [];
    const values: unknown[] = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'hs_id') {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });

    if (fields.length === 0) {
      return this.findByHsId(hsId);
    }

    values.push(hsId);

    const stmt = db.prepare(`
      UPDATE companies SET ${fields.join(', ')}
      WHERE hs_id = ?
      RETURNING *
    `);

    return (stmt.get(...values) as Company) || null;
  }

  /**
   * Delete company
   */
  static delete(hsId: string): boolean {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM companies WHERE hs_id = ?');
    const result = stmt.run(hsId);
    return result.changes > 0;
  }

  /**
   * Get all companies
   */
  static getAll(limit = 1000, offset = 0): Company[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM companies ORDER BY updated_at DESC LIMIT ? OFFSET ?');
    return stmt.all(limit, offset) as Company[];
  }

  /**
   * Count total companies
   */
  static count(): number {
    const db = getDatabase();
    const result = db.prepare('SELECT COUNT(*) as count FROM companies').get() as { count: number };
    return result.count;
  }

  /**
   * Search companies
   */
  static search(query: string, limit = 50): Company[] {
    const db = getDatabase();
    const searchPattern = `%${query}%`;

    const stmt = db.prepare(`
      SELECT * FROM companies
      WHERE name LIKE ? OR domain LIKE ?
      ORDER BY updated_at DESC
      LIMIT ?
    `);

    return stmt.all(searchPattern, searchPattern, limit) as Company[];
  }
}
