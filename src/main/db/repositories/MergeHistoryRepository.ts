import { getDatabase } from '../database';
import type { MergeHistory, MergeHistoryInsert } from '../types';

/**
 * Repository for managing merge history (audit trail)
 */
export class MergeHistoryRepository {
  /**
   * Find merge history by ID
   */
  static findById(id: number): MergeHistory | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM merge_history WHERE id = ?');
    return (stmt.get(id) as MergeHistory) || null;
  }

  /**
   * Find merge history by group ID
   */
  static findByGroupId(groupId: string): MergeHistory[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM merge_history WHERE group_id = ? ORDER BY merged_at DESC');
    return stmt.all(groupId) as MergeHistory[];
  }

  /**
   * Create a merge history record
   */
  static create(history: MergeHistoryInsert): MergeHistory {
    const db = getDatabase();

    const stmt = db.prepare(`
      INSERT INTO merge_history (
        group_id, primary_hs_id, merged_hs_ids, object_type, merge_strategy, metadata
      ) VALUES (?, ?, ?, ?, ?, ?)
      RETURNING *
    `);

    return stmt.get(
      history.group_id,
      history.primary_hs_id,
      history.merged_hs_ids,
      history.object_type,
      history.merge_strategy || null,
      history.metadata || null
    ) as MergeHistory;
  }

  /**
   * Get recent merge history
   */
  static getRecent(limit = 50, objectType?: string): MergeHistory[] {
    const db = getDatabase();

    if (objectType) {
      const stmt = db.prepare(
        'SELECT * FROM merge_history WHERE object_type = ? ORDER BY merged_at DESC LIMIT ?'
      );
      return stmt.all(objectType, limit) as MergeHistory[];
    }

    const stmt = db.prepare('SELECT * FROM merge_history ORDER BY merged_at DESC LIMIT ?');
    return stmt.all(limit) as MergeHistory[];
  }

  /**
   * Get merge statistics
   */
  static getStats(objectType?: string): {
    total_merges: number;
    total_records_merged: number;
  } {
    const db = getDatabase();

    let stmt;
    let result;

    if (objectType) {
      stmt = db.prepare(`
        SELECT
          COUNT(*) as total_merges,
          SUM(json_array_length(merged_hs_ids)) as total_records_merged
        FROM merge_history
        WHERE object_type = ?
      `);
      result = stmt.get(objectType);
    } else {
      stmt = db.prepare(`
        SELECT
          COUNT(*) as total_merges,
          SUM(json_array_length(merged_hs_ids)) as total_records_merged
        FROM merge_history
      `);
      result = stmt.get();
    }

    return result as {
      total_merges: number;
      total_records_merged: number;
    };
  }

  /**
   * Check if a record has been merged
   */
  static isRecordMerged(hsId: string, objectType: string): boolean {
    const db = getDatabase();

    // Check if the hsId appears in merged_hs_ids of any merge history
    const stmt = db.prepare(`
      SELECT COUNT(*) as count
      FROM merge_history
      WHERE object_type = ? AND merged_hs_ids LIKE ?
    `);

    const result = stmt.get(objectType, `%"${hsId}"%`) as { count: number };
    return result.count > 0;
  }

  /**
   * Find primary record for a merged record
   */
  static findPrimaryForMergedRecord(hsId: string, objectType: string): string | null {
    const db = getDatabase();

    const stmt = db.prepare(`
      SELECT primary_hs_id
      FROM merge_history
      WHERE object_type = ? AND merged_hs_ids LIKE ?
      ORDER BY merged_at DESC
      LIMIT 1
    `);

    const result = stmt.get(objectType, `%"${hsId}"%`) as { primary_hs_id: string } | undefined;
    return result?.primary_hs_id || null;
  }
}
