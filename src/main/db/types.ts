/**
 * Database model type definitions
 */

export interface Credential {
  id: number;
  portal_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  scope?: string;
  created_at: string;
  updated_at: string;
}

export interface ImportBatch {
  batch_id: string;
  timestamp: string;
  object_type: string;
  total_count: number;
  success_count: number;
  error_count: number;
  status: string;
  metadata?: string;
}

export interface Contact {
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

export interface Company {
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

export interface Deal {
  id: number;
  hs_id: string;
  deal_name?: string;
  amount?: number;
  stage?: string;
  pipeline?: string;
  close_date?: string;
  created_at?: string;
  updated_at?: string;
  imported_at: string;
  properties?: string;
}

export interface DuplicateGroup {
  group_id: string;
  object_type: string;
  confidence_level: string;
  golden_hs_id?: string;
  status: string;
  created_at: string;
  merged_at?: string;
  merge_strategy?: string;
}

export interface PotentialMatch {
  id: number;
  group_id: string;
  record_hs_id: string;
  match_score: number;
  matched_fields?: string;
  is_primary: number;
  created_at: string;
}

export interface MergeHistory {
  id: number;
  group_id: string;
  primary_hs_id: string;
  merged_hs_ids: string;
  object_type: string;
  merged_at: string;
  merge_strategy?: string;
  metadata?: string;
}

// Insert types (without auto-generated fields)
export type CredentialInsert = Omit<Credential, 'id' | 'created_at' | 'updated_at'>;
export type ImportBatchInsert = Omit<ImportBatch, 'timestamp'>;
export type ContactInsert = Omit<Contact, 'id' | 'imported_at'>;
export type CompanyInsert = Omit<Company, 'id' | 'imported_at'>;
export type DealInsert = Omit<Deal, 'id' | 'imported_at'>;
export type DuplicateGroupInsert = Omit<DuplicateGroup, 'created_at'>;
export type PotentialMatchInsert = Omit<PotentialMatch, 'id' | 'created_at'>;
export type MergeHistoryInsert = Omit<MergeHistory, 'id' | 'merged_at'>;
