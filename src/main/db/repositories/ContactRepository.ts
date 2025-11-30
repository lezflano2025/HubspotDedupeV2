import { getDatabase } from '../database';
import type { Contact, ContactInsert } from '../types';

/**
 * Repository for managing contacts
 */
export class ContactRepository {
  /**
   * Find contact by HubSpot ID
   */
  static findByHsId(hsId: string): Contact | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM contacts WHERE hs_id = ?');
    return (stmt.get(hsId) as Contact) || null;
  }

  /**
   * Find contacts by email
   */
  static findByEmail(email: string): Contact[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM contacts WHERE email = ?');
    return stmt.all(email) as Contact[];
  }

  /**
   * Insert a new contact
   */
  static insert(contact: ContactInsert): Contact {
    const db = getDatabase();

    const stmt = db.prepare(`
      INSERT INTO contacts (
        hs_id, first_name, last_name, email, phone, company, job_title,
        created_at, updated_at, properties
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `);

    return stmt.get(
      contact.hs_id,
      contact.first_name || null,
      contact.last_name || null,
      contact.email || null,
      contact.phone || null,
      contact.company || null,
      contact.job_title || null,
      contact.created_at || null,
      contact.updated_at || null,
      contact.properties || null
    ) as Contact;
  }

  /**
   * Upsert a contact (insert or replace if exists)
   */
  static upsert(contact: ContactInsert): void {
    const db = getDatabase();

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO contacts (
        hs_id, first_name, last_name, email, phone, company, job_title,
        created_at, updated_at, properties
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      contact.hs_id ?? null,
      contact.first_name ?? null,
      contact.last_name ?? null,
      contact.email ?? null,
      contact.phone ?? null,
      contact.company ?? null,
      contact.job_title ?? null,
      contact.created_at ?? null,
      contact.updated_at ?? null,
      contact.properties ?? null
    );
  }

  /**
   * Bulk insert contacts
   */
  static bulkInsert(contacts: ContactInsert[]): number {
    const db = getDatabase();

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO contacts (
        hs_id, first_name, last_name, email, phone, company, job_title,
        created_at, updated_at, properties
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((records: ContactInsert[]) => {
      for (const contact of records) {
        stmt.run(
          contact.hs_id,
          contact.first_name || null,
          contact.last_name || null,
          contact.email || null,
          contact.phone || null,
          contact.company || null,
          contact.job_title || null,
          contact.created_at || null,
          contact.updated_at || null,
          contact.properties || null
        );
      }
    });

    insertMany(contacts);
    return contacts.length;
  }

  /**
   * Update contact
   */
  static update(hsId: string, updates: Partial<ContactInsert>): Contact | null {
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
      UPDATE contacts SET ${fields.join(', ')}
      WHERE hs_id = ?
      RETURNING *
    `);

    return (stmt.get(...values) as Contact) || null;
  }

  /**
   * Delete contact
   */
  static delete(hsId: string): boolean {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM contacts WHERE hs_id = ?');
    const result = stmt.run(hsId);
    return result.changes > 0;
  }

  /**
   * Get all contacts
   */
  static getAll(limit = 1000, offset = 0): Contact[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM contacts ORDER BY updated_at DESC LIMIT ? OFFSET ?');
    return stmt.all(limit, offset) as Contact[];
  }

  /**
   * Count total contacts
   */
  static count(): number {
    const db = getDatabase();
    const result = db.prepare('SELECT COUNT(*) as count FROM contacts').get() as { count: number };
    return result.count;
  }

  /**
   * Search contacts by name or email
   */
  static search(query: string, limit = 50): Contact[] {
    const db = getDatabase();
    const searchPattern = `%${query}%`;

    const stmt = db.prepare(`
      SELECT * FROM contacts
      WHERE first_name LIKE ? OR last_name LIKE ? OR email LIKE ?
      ORDER BY updated_at DESC
      LIMIT ?
    `);

    return stmt.all(searchPattern, searchPattern, searchPattern, limit) as Contact[];
  }
}
