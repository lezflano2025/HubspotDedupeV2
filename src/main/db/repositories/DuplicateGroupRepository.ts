import { getDatabase } from '../database';
import type { DuplicateGroup, DuplicateGroupInsert, PotentialMatch, PotentialMatchInsert } from '../types';

/**
 * Repository for managing duplicate groups and potential matches
 */
export class DuplicateGroupRepository {
  /**
   * Find duplicate group by ID
   */
  static findById(groupId: string): DuplicateGroup | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM duplicate_groups WHERE group_id = ?');
    return (stmt.get(groupId) as DuplicateGroup) || null;
  }

  /**
   * Get all duplicate groups for an object type
   */
  static findByObjectType(objectType: string, status?: string): DuplicateGroup[] {
    const db = getDatabase();

    if (status) {
      const stmt = db.prepare(
        'SELECT * FROM duplicate_groups WHERE object_type = ? AND status = ? ORDER BY created_at DESC'
      );
      return stmt.all(objectType, status) as DuplicateGroup[];
    }

    const stmt = db.prepare('SELECT * FROM duplicate_groups WHERE object_type = ? ORDER BY created_at DESC');
    return stmt.all(objectType) as DuplicateGroup[];
  }

  /**
   * Create a new duplicate group
   */
  static create(group: DuplicateGroupInsert): DuplicateGroup {
    const db = getDatabase();

    const stmt = db.prepare(`
      INSERT INTO duplicate_groups (
        group_id, object_type, confidence_level, golden_hs_id, status, merge_strategy
      ) VALUES (?, ?, ?, ?, ?, ?)
      RETURNING *
    `);

    return stmt.get(
      group.group_id,
      group.object_type,
      group.confidence_level,
      group.golden_hs_id || null,
      group.status || 'pending',
      group.merge_strategy || null
    ) as DuplicateGroup;
  }

  /**
   * Update duplicate group status
   */
  static updateStatus(groupId: string, status: string, goldenHsId?: string): DuplicateGroup | null {
    const db = getDatabase();

    const stmt = db.prepare(`
      UPDATE duplicate_groups
      SET status = ?, golden_hs_id = ?, merged_at = CASE WHEN ? = 'merged' THEN CURRENT_TIMESTAMP ELSE merged_at END
      WHERE group_id = ?
      RETURNING *
    `);

    return (stmt.get(status, goldenHsId || null, status, groupId) as DuplicateGroup) || null;
  }

  /**
   * Delete duplicate group
   */
  static delete(groupId: string): boolean {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM duplicate_groups WHERE group_id = ?');
    const result = stmt.run(groupId);
    return result.changes > 0;
  }

  /**
   * Get count by status
   */
  static countByStatus(objectType?: string): Record<string, number> {
    const db = getDatabase();

    let stmt;
    let rows;

    if (objectType) {
      stmt = db.prepare(
        'SELECT status, COUNT(*) as count FROM duplicate_groups WHERE object_type = ? GROUP BY status'
      );
      rows = stmt.all(objectType) as { status: string; count: number }[];
    } else {
      stmt = db.prepare('SELECT status, COUNT(*) as count FROM duplicate_groups GROUP BY status');
      rows = stmt.all() as { status: string; count: number }[];
    }

    const counts: Record<string, number> = {};
    rows.forEach((row) => {
      counts[row.status] = row.count;
    });

    return counts;
  }

  // Potential Matches methods

  /**
   * Add potential match to a group
   */
  static addMatch(match: PotentialMatchInsert): PotentialMatch {
    const db = getDatabase();

    const stmt = db.prepare(`
      INSERT INTO potential_matches (
        group_id, record_hs_id, match_score, matched_fields, is_primary
      ) VALUES (?, ?, ?, ?, ?)
      RETURNING *
    `);

    return stmt.get(
      match.group_id,
      match.record_hs_id,
      match.match_score,
      match.matched_fields || null,
      match.is_primary || 0
    ) as PotentialMatch;
  }

  /**
   * Get all matches for a group
   */
  static getMatches(groupId: string): PotentialMatch[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM potential_matches WHERE group_id = ? ORDER BY match_score DESC');
    return stmt.all(groupId) as PotentialMatch[];
  }

  /**
   * Set primary record for a group
   */
  static setPrimary(groupId: string, recordHsId: string): void {
    const db = getDatabase();

    const transaction = db.transaction(() => {
      // Reset all is_primary flags for this group
      db.prepare('UPDATE potential_matches SET is_primary = 0 WHERE group_id = ?').run(groupId);

      // Set the new primary
      db.prepare('UPDATE potential_matches SET is_primary = 1 WHERE group_id = ? AND record_hs_id = ?').run(
        groupId,
        recordHsId
      );
    });

    transaction();
  }

  /**
   * Get duplicate group with its matches
   */
  static getGroupWithMatches(groupId: string): (DuplicateGroup & { matches: PotentialMatch[] }) | null {
    const group = this.findById(groupId);
    if (!group) return null;

    const matches = this.getMatches(groupId);
    return { ...group, matches };
  }
}
