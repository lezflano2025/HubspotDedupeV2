import { getDatabase } from '../database';
import type { ImportBatch, ImportBatchInsert } from '../types';

/**
 * Repository for managing import batches
 */
export class ImportBatchRepository {
  /**
   * Find import batch by ID
   */
  static findById(batchId: string): ImportBatch | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM import_batches WHERE batch_id = ?');
    return (stmt.get(batchId) as ImportBatch) || null;
  }

  /**
   * Create a new import batch
   */
  static create(batch: ImportBatchInsert): ImportBatch {
    const db = getDatabase();

    const stmt = db.prepare(`
      INSERT INTO import_batches (
        batch_id, object_type, total_count, success_count, error_count, status, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `);

    return stmt.get(
      batch.batch_id,
      batch.object_type,
      batch.total_count || 0,
      batch.success_count || 0,
      batch.error_count || 0,
      batch.status || 'pending',
      batch.metadata || null
    ) as ImportBatch;
  }

  /**
   * Update batch progress
   */
  static updateProgress(
    batchId: string,
    progress: { success_count?: number; error_count?: number; status?: string }
  ): ImportBatch | null {
    const db = getDatabase();

    const fields: string[] = [];
    const values: unknown[] = [];

    if (progress.success_count !== undefined) {
      fields.push('success_count = ?');
      values.push(progress.success_count);
    }

    if (progress.error_count !== undefined) {
      fields.push('error_count = ?');
      values.push(progress.error_count);
    }

    if (progress.status !== undefined) {
      fields.push('status = ?');
      values.push(progress.status);
    }

    if (fields.length === 0) {
      return this.findById(batchId);
    }

    values.push(batchId);

    const stmt = db.prepare(`
      UPDATE import_batches SET ${fields.join(', ')}
      WHERE batch_id = ?
      RETURNING *
    `);

    return (stmt.get(...values) as ImportBatch) || null;
  }

  /**
   * Update batch with flexible updates
   */
  static update(
    batchId: string,
    updates: {
      total_count?: number;
      success_count?: number;
      error_count?: number;
      status?: string;
      metadata?: string;
    }
  ): ImportBatch | null {
    const db = getDatabase();

    const fields: string[] = [];
    const values: unknown[] = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });

    if (fields.length === 0) {
      return this.findById(batchId);
    }

    values.push(batchId);

    const stmt = db.prepare(`
      UPDATE import_batches SET ${fields.join(', ')}
      WHERE batch_id = ?
      RETURNING *
    `);

    return (stmt.get(...values) as ImportBatch) || null;
  }

  /**
   * Get recent import batches
   */
  static getRecent(limit = 10, objectType?: string): ImportBatch[] {
    const db = getDatabase();

    if (objectType) {
      const stmt = db.prepare(
        'SELECT * FROM import_batches WHERE object_type = ? ORDER BY timestamp DESC LIMIT ?'
      );
      return stmt.all(objectType, limit) as ImportBatch[];
    }

    const stmt = db.prepare('SELECT * FROM import_batches ORDER BY timestamp DESC LIMIT ?');
    return stmt.all(limit) as ImportBatch[];
  }

  /**
   * Get import statistics
   */
  static getStats(objectType?: string): {
    total_batches: number;
    total_records: number;
    successful_records: number;
    failed_records: number;
  } {
    const db = getDatabase();

    let stmt;
    let result;

    if (objectType) {
      stmt = db.prepare(`
        SELECT
          COUNT(*) as total_batches,
          SUM(total_count) as total_records,
          SUM(success_count) as successful_records,
          SUM(error_count) as failed_records
        FROM import_batches
        WHERE object_type = ?
      `);
      result = stmt.get(objectType);
    } else {
      stmt = db.prepare(`
        SELECT
          COUNT(*) as total_batches,
          SUM(total_count) as total_records,
          SUM(success_count) as successful_records,
          SUM(error_count) as failed_records
        FROM import_batches
      `);
      result = stmt.get();
    }

    return result as {
      total_batches: number;
      total_records: number;
      successful_records: number;
      failed_records: number;
    };
  }

  /**
   * Delete old import batches
   */
  static deleteOlderThan(days: number): number {
    const db = getDatabase();
    const stmt = db.prepare(`
      DELETE FROM import_batches
      WHERE timestamp < datetime('now', '-' || ? || ' days')
    `);
    const result = stmt.run(days);
    return result.changes;
  }
}
