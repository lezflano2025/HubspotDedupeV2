/**
 * Shared type definitions for the HubSpot Deduplicator application
 */

// HubSpot Contact type
export interface HubSpotContact {
  id: string;
  properties: {
    email?: string;
    firstname?: string;
    lastname?: string;
    phone?: string;
    company?: string;
    createdate?: string;
    lastmodifieddate?: string;
    [key: string]: string | undefined;
  };
}

// HubSpot Company type
export interface HubSpotCompany {
  id: string;
  properties: {
    name?: string;
    domain?: string;
    phone?: string;
    city?: string;
    state?: string;
    createdate?: string;
    [key: string]: string | undefined;
  };
}

// Authentication result
export interface AuthResult {
  success: boolean;
  portalId?: string;
  error?: string;
  isAuthenticated: boolean;
}

// Connection status
export interface ConnectionStatus {
  isConnected: boolean;
  portalId?: string;
  hasStoredCredentials: boolean;
}

// Deduplication result
export interface DeduplicationResult {
  objectType: 'contact' | 'company';
  totalRecords: number;
  exactMatchGroups: number;
  fuzzyMatchGroups: number;
  totalDuplicates: number;
  processingTimeMs: number;
  stats: {
    byConfidence: Record<string, number>;
    byStatus: Record<string, number>;
  };
}

// Field similarity score
export interface FieldSimilarity {
  field: string;
  score: number;
}

// Duplicate group
export interface DuplicateGroup {
  id: string;
  type: 'contact' | 'company';
  records: (HubSpotContact | HubSpotCompany)[];
  similarityScore: number;
  matchedFields: string[];
  fieldScores?: FieldSimilarity[];
  status?: 'unreviewed' | 'reviewed' | 'merged';
}

// Merge result
export interface MergeResult {
  success: boolean;
  primaryId: string;
  mergedIds: string[];
  error?: string;
}

// Import result
export interface ImportResult {
  success: boolean;
  batchId: string;
  objectType: 'contact' | 'company';
  totalFetched: number;
  totalSaved: number;
  error?: string;
}

// Contact data result
export interface ContactData {
  id: number;
  hs_id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  job_title?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  imported_at: string;
  properties?: string | null;
}

// Company data result
export interface CompanyData {
  id: number;
  hs_id: string;
  name?: string | null;
  domain?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  industry?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  imported_at: string;
  properties?: string | null;
}

// Get contacts result
export interface GetContactsResult {
  contacts: ContactData[];
  count: number;
}

// Get companies result
export interface GetCompaniesResult {
  companies: CompanyData[];
  count: number;
}

// API exposed to renderer via contextBridge
export interface ElectronAPI {
  // Database operations
  dbQuery: <T = unknown>(sql: string, params?: unknown[]) => Promise<T[]>;
  dbExecute: (sql: string, params?: unknown[]) => Promise<{ changes: number; lastInsertRowid: number }>;

  // HubSpot operations
  hubspotAuthenticate: (apiKey: string) => Promise<AuthResult>;
  hubspotGetConnectionStatus: () => Promise<ConnectionStatus>;
  hubspotDisconnect: () => Promise<void>;
  hubspotFetchContacts: () => Promise<HubSpotContact[]>;
  hubspotFetchCompanies: () => Promise<HubSpotCompany[]>;
  hubspotImportContacts: () => Promise<ImportResult>;
  hubspotImportCompanies: () => Promise<ImportResult>;

  // Deduplication operations
  dedupRunAnalysis: (type: 'contact' | 'company') => Promise<DeduplicationResult>;
  dedupGetGroups: (type: 'contact' | 'company', status?: string) => Promise<DuplicateGroup[]>;
  dedupMerge: (groupId: string, primaryId: string) => Promise<MergeResult>;

  // Data retrieval operations
  getContacts: (limit?: number, offset?: number) => Promise<GetContactsResult>;
  getCompanies: (limit?: number, offset?: number) => Promise<GetCompaniesResult>;

  // General
  getAppInfo: () => Promise<{ name: string; version: string }>;
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}
