-- Supabase Deployment Verification Queries
-- Run these in Supabase SQL Editor or via psql

-- ============================================
-- 1. LIST ALL PUBLIC TABLES
-- ============================================
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name AND table_schema = 'public') as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Expected: 7 tables
-- ✓ candidates
-- ✓ candidate_tracking
-- ✓ email_outreach
-- ✓ open_roles
-- ✓ saved_candidates
-- ✓ search_rate_limit
-- ✓ user_profiles

-- ============================================
-- 2. VERIFY RLS IS ENABLED ON ALL TABLES
-- ============================================
SELECT
  schemaname,
  tablename,
  rowsecurity,
  CASE WHEN rowsecurity THEN '✅ Enabled' ELSE '❌ DISABLED' END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Expected: All tables should have rowsecurity = true

-- ============================================
-- 3. LIST ALL RLS POLICIES
-- ============================================
SELECT
  tablename,
  policyname,
  cmd as operation,
  CASE
    WHEN cmd = 'SELECT' THEN '👁️  Read'
    WHEN cmd = 'INSERT' THEN '➕ Create'
    WHEN cmd = 'UPDATE' THEN '✏️  Update'
    WHEN cmd = 'DELETE' THEN '🗑️  Delete'
    WHEN cmd = 'ALL' THEN '🔧 All'
    ELSE cmd
  END as icon_operation
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;

-- Expected: 25 total policies
-- candidates: 4 policies
-- candidate_tracking: 4 policies
-- email_outreach: 4 policies
-- open_roles: 4 policies
-- saved_candidates: 3 policies
-- search_rate_limit: 2 policies
-- user_profiles: 3 policies

-- ============================================
-- 4. LIST ALL SQL FUNCTIONS
-- ============================================
SELECT
  p.proname as function_name,
  pg_get_function_result(p.oid) as return_type,
  pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
ORDER BY function_name;

-- Expected: 2 functions
-- ✓ update_candidate_tracking_updated_at() → trigger
-- ✓ update_updated_at_column() → trigger

-- ============================================
-- 5. LIST ALL TRIGGERS
-- ============================================
SELECT
  event_object_table AS table_name,
  trigger_name,
  event_manipulation AS event,
  '✅' as status
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- Expected: 4 triggers
-- ✓ update_candidates_updated_at on candidates
-- ✓ update_candidate_tracking_updated_at on candidate_tracking
-- ✓ update_open_roles_updated_at on open_roles
-- ✓ update_user_profiles_updated_at on user_profiles

-- ============================================
-- 6. VERIFY USER_PROFILES SCHEMA
-- ============================================
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_profiles'
ORDER BY ordinal_position;

-- Expected business-context fields (from migration 6):
-- ✓ target_titles (text[])
-- ✓ target_companies (text[])
-- ✓ must_have_skills (text[])
-- ✓ nice_to_have_skills (text[])
-- ✓ min_experience (integer)
-- ✓ max_experience (integer)
-- ✓ dnc_companies (text[])
-- ✓ dnc_individuals (text[])
-- ✓ outreach_examples (jsonb)

-- ============================================
-- 7. COUNT INDEXES
-- ============================================
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- Expected indexes:
-- candidates: candidates_linkedin_url_idx, candidates_role_id_idx, candidates_status_idx, candidates_user_id_idx
-- candidate_tracking: idx_candidate_tracking_user_id, idx_candidate_tracking_candidate_id, idx_candidate_tracking_status
-- email_outreach: idx_email_outreach_user_id, idx_email_outreach_candidate_id
-- open_roles: open_roles_user_id_idx
-- user_profiles: idx_user_profiles_user_id (appears twice in migrations, should dedupe)

-- ============================================
-- 8. DEPLOYMENT SUMMARY
-- ============================================
SELECT
  '📊 Deployment Summary' as report_section,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') as total_tables,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') as total_rls_policies,
  (SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.prokind = 'f') as total_functions,
  (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = 'public') as total_triggers,
  (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public') as total_indexes;

-- Expected:
-- ✅ 7 tables
-- ✅ 25 RLS policies
-- ✅ 2 SQL functions
-- ✅ 4 triggers
-- ✅ 12-14 indexes
