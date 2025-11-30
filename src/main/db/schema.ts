/**
 * Database schema definitions
 * Contains SQL statements for creating all tables and indexes
 */

export const SCHEMA_VERSION = 2;

/**
 * SQL statements to create all tables
 */
export const CREATE_TABLES_SQL = `
-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Credentials table (stores encrypted HubSpot API credentials)
CREATE TABLE IF NOT EXISTS credentials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  portal_id TEXT UNIQUE NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  scope TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Import batches (track data import operations)
CREATE TABLE IF NOT EXISTS import_batches (
  batch_id TEXT PRIMARY KEY,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  object_type TEXT NOT NULL,
  total_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  metadata TEXT
);

-- Contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hs_id TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  company TEXT,
  job_title TEXT,
  created_at DATETIME,
  updated_at DATETIME,
  imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  properties TEXT,
  retry_count INTEGER DEFAULT 0,
  last_error TEXT
);

-- Companies table
CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hs_id TEXT UNIQUE NOT NULL,
  name TEXT,
  domain TEXT,
  phone TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  industry TEXT,
  created_at DATETIME,
  updated_at DATETIME,
  imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  properties TEXT,
  retry_count INTEGER DEFAULT 0,
  last_error TEXT
);

-- Deals table
CREATE TABLE IF NOT EXISTS deals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hs_id TEXT UNIQUE NOT NULL,
  deal_name TEXT,
  amount REAL,
  stage TEXT,
  pipeline TEXT,
  close_date DATETIME,
  created_at DATETIME,
  updated_at DATETIME,
  imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  properties TEXT,
  retry_count INTEGER DEFAULT 0,
  last_error TEXT
);

-- Duplicate groups (groups of potential duplicates)
CREATE TABLE IF NOT EXISTS duplicate_groups (
  group_id TEXT PRIMARY KEY,
  object_type TEXT NOT NULL,
  confidence_level TEXT NOT NULL,
  golden_hs_id TEXT,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  merged_at DATETIME,
  merge_strategy TEXT
);

-- Potential matches (individual records within a duplicate group)
CREATE TABLE IF NOT EXISTS potential_matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id TEXT NOT NULL,
  record_hs_id TEXT NOT NULL,
  match_score REAL NOT NULL,
  matched_fields TEXT,
  is_primary INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES duplicate_groups(group_id) ON DELETE CASCADE
);

-- Merge history (audit trail of merge operations)
CREATE TABLE IF NOT EXISTS merge_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id TEXT NOT NULL,
  primary_hs_id TEXT NOT NULL,
  merged_hs_ids TEXT NOT NULL,
  object_type TEXT NOT NULL,
  merged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  merge_strategy TEXT,
  metadata TEXT,
  FOREIGN KEY (group_id) REFERENCES duplicate_groups(group_id)
);
`;

/**
 * SQL statements to create indexes for performance
 */
export const CREATE_INDEXES_SQL = `
-- Indexes for contacts
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_hs_id ON contacts(hs_id);
CREATE INDEX IF NOT EXISTS idx_contacts_updated_at ON contacts(updated_at);

-- Indexes for companies
CREATE INDEX IF NOT EXISTS idx_companies_domain ON companies(domain);
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);
CREATE INDEX IF NOT EXISTS idx_companies_hs_id ON companies(hs_id);

-- Indexes for deals
CREATE INDEX IF NOT EXISTS idx_deals_hs_id ON deals(hs_id);
CREATE INDEX IF NOT EXISTS idx_deals_close_date ON deals(close_date);

-- Indexes for duplicate groups
CREATE INDEX IF NOT EXISTS idx_duplicate_groups_object_type ON duplicate_groups(object_type);
CREATE INDEX IF NOT EXISTS idx_duplicate_groups_status ON duplicate_groups(status);
CREATE INDEX IF NOT EXISTS idx_duplicate_groups_confidence ON duplicate_groups(confidence_level);

-- Indexes for potential matches
CREATE INDEX IF NOT EXISTS idx_potential_matches_group_id ON potential_matches(group_id);
CREATE INDEX IF NOT EXISTS idx_potential_matches_record_hs_id ON potential_matches(record_hs_id);
CREATE INDEX IF NOT EXISTS idx_potential_matches_score ON potential_matches(match_score);

-- Indexes for merge history
CREATE INDEX IF NOT EXISTS idx_merge_history_group_id ON merge_history(group_id);
CREATE INDEX IF NOT EXISTS idx_merge_history_merged_at ON merge_history(merged_at);

-- Indexes for import batches
CREATE INDEX IF NOT EXISTS idx_import_batches_timestamp ON import_batches(timestamp);
CREATE INDEX IF NOT EXISTS idx_import_batches_object_type ON import_batches(object_type);
`;
