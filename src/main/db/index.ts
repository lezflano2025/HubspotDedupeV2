/**
 * Database module exports
 * Central entry point for all database operations
 */

// Core database functions
export { initializeDatabase, closeDatabase, getDatabase, query, execute, transaction } from './database';

// Migration functions
export { runDatabaseMigrations, verifyDatabaseIntegrity, optimizeDatabase } from './migrations';

// Repositories
export { CredentialRepository } from './repositories/CredentialRepository';
export { ContactRepository } from './repositories/ContactRepository';
export { CompanyRepository } from './repositories/CompanyRepository';
export { DuplicateGroupRepository } from './repositories/DuplicateGroupRepository';
export { ImportBatchRepository } from './repositories/ImportBatchRepository';
export { MergeHistoryRepository } from './repositories/MergeHistoryRepository';

// Types
export type {
  Credential,
  CredentialInsert,
  Contact,
  ContactInsert,
  Company,
  CompanyInsert,
  Deal,
  DealInsert,
  DuplicateGroup,
  DuplicateGroupInsert,
  PotentialMatch,
  PotentialMatchInsert,
  ImportBatch,
  ImportBatchInsert,
  MergeHistory,
  MergeHistoryInsert,
} from './types';
