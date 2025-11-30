import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

/**
 * Database connection and initialization
 * Uses better-sqlite3 for synchronous SQLite operations
 */

let db: Database.Database | null = null;

/**
 * Get the database instance (singleton pattern)
 */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

/**
 * Initialize the database connection
 * Creates the database file in the user data directory
 * Enables WAL mode for better performance
 */
export function initializeDatabase(): Database.Database {
  if (db) {
    return db;
  }

  // Get the user data directory
  const userDataPath = app.getPath('userData');
  const dbDir = path.join(userDataPath, 'data');

  // Ensure the data directory exists
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const dbPath = path.join(dbDir, 'deduplicator.db');

  console.log(`Initializing database at: ${dbPath}`);

  // Create database connection
  db = new Database(dbPath, {
    verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
  });

  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL');

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Set synchronous mode to NORMAL for better performance
  db.pragma('synchronous = NORMAL');

  // Set cache size (negative value means KB, -2000 = 2MB)
  db.pragma('cache_size = -2000');

  console.log('Database initialized successfully');

  return db;
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    console.log('Database connection closed');
  }
}

/**
 * Execute a query and return results
 */
export function query<T = unknown>(sql: string, params: unknown[] = []): T[] {
  const database = getDatabase();
  const stmt = database.prepare(sql);
  return stmt.all(...params) as T[];
}

/**
 * Execute a statement (INSERT, UPDATE, DELETE)
 */
export function execute(sql: string, params: unknown[] = []): { changes: number; lastInsertRowid: number } {
  const database = getDatabase();
  const stmt = database.prepare(sql);
  const result = stmt.run(...params);
  return {
    changes: result.changes,
    lastInsertRowid: Number(result.lastInsertRowid),
  };
}

/**
 * Execute a transaction
 */
export function transaction<T>(fn: () => T): T {
  const database = getDatabase();
  const txn = database.transaction(fn);
  return txn();
}
