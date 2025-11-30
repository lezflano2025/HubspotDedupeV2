import { getDatabase } from './database';
import { SCHEMA_VERSION, CREATE_TABLES_SQL, CREATE_INDEXES_SQL } from './schema';

/**
 * Database migration system
 * Handles initial schema creation and future schema upgrades
 */

/**
 * Get the current schema version from the database
 */
function getCurrentSchemaVersion(): number {
  const db = getDatabase();

  try {
    const result = db.prepare('SELECT MAX(version) as version FROM schema_version').get() as { version: number | null };
    return result.version ?? 0;
  } catch (error) {
    // Table doesn't exist yet
    return 0;
  }
}

/**
 * Set the schema version
 */
function setSchemaVersion(version: number): void {
  const db = getDatabase();
  db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(version);
}

/**
 * Run initial migration (create all tables and indexes)
 */
function runInitialMigration(): void {
  console.log('Running initial migration...');
  const db = getDatabase();

  // Execute all CREATE TABLE statements
  db.exec(CREATE_TABLES_SQL);

  // Execute all CREATE INDEX statements
  db.exec(CREATE_INDEXES_SQL);

  // Set the schema version
  setSchemaVersion(SCHEMA_VERSION);

  console.log(`Initial migration completed. Schema version: ${SCHEMA_VERSION}`);
}

/**
 * Run migrations to upgrade from one version to another
 */
function runMigrations(fromVersion: number, toVersion: number): void {
  console.log(`Running migrations from version ${fromVersion} to ${toVersion}...`);
  const db = getDatabase();

  // Migration from version 1 to 2: Add retry_count and last_error columns
  if (fromVersion < 2) {
    console.log('Migrating to version 2: Adding retry_count and last_error columns...');

    // Add columns to contacts table
    try {
      db.exec('ALTER TABLE contacts ADD COLUMN retry_count INTEGER DEFAULT 0');
      console.log('Added retry_count to contacts');
    } catch (error) {
      console.log('retry_count column already exists in contacts');
    }

    try {
      db.exec('ALTER TABLE contacts ADD COLUMN last_error TEXT');
      console.log('Added last_error to contacts');
    } catch (error) {
      console.log('last_error column already exists in contacts');
    }

    // Add columns to companies table
    try {
      db.exec('ALTER TABLE companies ADD COLUMN retry_count INTEGER DEFAULT 0');
      console.log('Added retry_count to companies');
    } catch (error) {
      console.log('retry_count column already exists in companies');
    }

    try {
      db.exec('ALTER TABLE companies ADD COLUMN last_error TEXT');
      console.log('Added last_error to companies');
    } catch (error) {
      console.log('last_error column already exists in companies');
    }

    // Add columns to deals table
    try {
      db.exec('ALTER TABLE deals ADD COLUMN retry_count INTEGER DEFAULT 0');
      console.log('Added retry_count to deals');
    } catch (error) {
      console.log('retry_count column already exists in deals');
    }

    try {
      db.exec('ALTER TABLE deals ADD COLUMN last_error TEXT');
      console.log('Added last_error to deals');
    } catch (error) {
      console.log('last_error column already exists in deals');
    }

    setSchemaVersion(2);
    console.log('Migration to version 2 completed');
  }
}

/**
 * Main migration function
 * Call this on application startup
 */
export function runDatabaseMigrations(): void {
  const currentVersion = getCurrentSchemaVersion();

  console.log(`Current schema version: ${currentVersion}`);
  console.log(`Target schema version: ${SCHEMA_VERSION}`);

  if (currentVersion === 0) {
    // First time setup - create all tables
    runInitialMigration();
  } else if (currentVersion < SCHEMA_VERSION) {
    // Run incremental migrations
    runMigrations(currentVersion, SCHEMA_VERSION);
  } else if (currentVersion > SCHEMA_VERSION) {
    throw new Error(
      `Database schema version (${currentVersion}) is newer than application version (${SCHEMA_VERSION}). ` +
      'Please update the application.'
    );
  } else {
    console.log('Database schema is up to date');
  }
}

/**
 * Verify database integrity
 */
export function verifyDatabaseIntegrity(): boolean {
  const db = getDatabase();

  try {
    const result = db.pragma('integrity_check');
    const isValid = Array.isArray(result) && result.length === 1 && result[0].integrity_check === 'ok';

    if (isValid) {
      console.log('Database integrity check passed');
    } else {
      console.error('Database integrity check failed:', result);
    }

    return isValid;
  } catch (error) {
    console.error('Error running integrity check:', error);
    return false;
  }
}

/**
 * Optimize database (vacuum and analyze)
 */
export function optimizeDatabase(): void {
  console.log('Optimizing database...');
  const db = getDatabase();

  // Analyze tables for query optimization
  db.exec('ANALYZE');

  // Note: VACUUM cannot be run inside a transaction
  // and may take some time on large databases
  try {
    db.exec('VACUUM');
    console.log('Database optimization completed');
  } catch (error) {
    console.error('Error during VACUUM:', error);
  }
}
