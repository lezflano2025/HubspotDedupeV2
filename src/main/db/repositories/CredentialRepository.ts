import { getDatabase } from '../database';
import type { Credential, CredentialInsert } from '../types';

/**
 * Repository for managing HubSpot API credentials
 */
export class CredentialRepository {
  /**
   * Find credential by portal ID
   */
  static findByPortalId(portalId: string): Credential | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM credentials WHERE portal_id = ?');
    return (stmt.get(portalId) as Credential) || null;
  }

  /**
   * Get the current credential (assumes single portal)
   */
  static getCurrent(): Credential | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM credentials ORDER BY updated_at DESC LIMIT 1');
    return (stmt.get() as Credential) || null;
  }

  /**
   * Insert or update credential
   */
  static upsert(credential: CredentialInsert): Credential {
    const db = getDatabase();

    const stmt = db.prepare(`
      INSERT INTO credentials (portal_id, access_token, refresh_token, expires_at, scope)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(portal_id) DO UPDATE SET
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token,
        expires_at = excluded.expires_at,
        scope = excluded.scope,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `);

    return stmt.get(
      credential.portal_id,
      credential.access_token,
      credential.refresh_token,
      credential.expires_at,
      credential.scope || null
    ) as Credential;
  }

  /**
   * Delete credential by portal ID
   */
  static delete(portalId: string): boolean {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM credentials WHERE portal_id = ?');
    const result = stmt.run(portalId);
    return result.changes > 0;
  }

  /**
   * Check if credential is expired
   */
  static isExpired(credential: Credential): boolean {
    return Date.now() >= credential.expires_at;
  }
}
