# Supabase Deployment Guide

## Prerequisites
- Supabase CLI installed
- New empty Supabase project created
- Project reference ID available

## Migration Order
The migrations are already correctly ordered in `supabase/migrations/`:

1. ✅ `20251207000100_core_open_roles_candidates.sql`
2. ✅ `20251207000200_candidate_tracking.sql`
3. ✅ `20251207000300_user_profiles.sql`
4. ✅ `20251207000400_saved_candidates_rate_limit.sql`
5. ✅ `20251207000500_email_outreach.sql`
6. ✅ `20251207000600_user_profiles_business_context.sql`

## Step 1: Initialize and Link Supabase

```bash
# Initialize Supabase in the project (if not already done)
supabase init

# Login to Supabase
supabase login

# Link to your NEW project
supabase link --project-ref YOUR_PROJECT_REF
```

## Step 2: Apply Migrations

```bash
# Push all migrations to the database
supabase db push
```

If any migration fails, check the error message. The migrations are ordered correctly with proper dependencies.

## Step 3: Verify Deployment

### Query 1: List All Tables
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

**Expected tables:**
- candidates
- candidate_tracking
- email_outreach
- open_roles
- saved_candidates
- search_rate_limit
- user_profiles

### Query 2: List All RLS Policies
```sql
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

**Expected RLS policies per table:**

**candidates (4 policies):**
- Users can view their own candidates (SELECT)
- Users can create their own candidates (INSERT)
- Users can update their own candidates (UPDATE)
- Users can delete their own candidates (DELETE)

**candidate_tracking (4 policies):**
- Users can view their own candidate tracking (SELECT)
- Users can create candidate tracking (INSERT)
- Users can update their own candidate tracking (UPDATE)
- Users can delete their own candidate tracking (DELETE)

**email_outreach (4 policies):**
- Users can view their own outreach emails (SELECT)
- Users can create outreach emails (INSERT)
- Users can update their own outreach emails (UPDATE)
- Users can delete their own outreach emails (DELETE)

**open_roles (4 policies):**
- Users can view their own roles (SELECT)
- Users can create their own roles (INSERT)
- Users can update their own roles (UPDATE)
- Users can delete their own roles (DELETE)

**saved_candidates (3 policies):**
- Users can view their own saved candidates (SELECT)
- Users can save candidates (INSERT)
- Users can remove their saved candidates (DELETE)

**search_rate_limit (2 policies):**
- Users can view their own rate limit (SELECT)
- Users can update their own rate limit (ALL)

**user_profiles (3 policies):**
- Users can view their own profile (SELECT)
- Users can create their own profile (INSERT)
- Users can update their own profile (UPDATE)

### Query 3: List All Functions and Triggers
```sql
-- List all functions
SELECT
  n.nspname as schema,
  p.proname as function_name,
  pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
ORDER BY function_name;
```

**Expected functions:**
- `update_updated_at_column()` → RETURNS trigger
- `update_candidate_tracking_updated_at()` → RETURNS trigger

```sql
-- List all triggers
SELECT
  event_object_table AS table_name,
  trigger_name,
  event_manipulation AS event,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;
```

**Expected triggers:**
- `update_candidates_updated_at` on `candidates` (BEFORE UPDATE)
- `update_open_roles_updated_at` on `open_roles` (BEFORE UPDATE)
- `update_candidate_tracking_updated_at` on `candidate_tracking` (BEFORE UPDATE)
- `update_user_profiles_updated_at` on `user_profiles` (BEFORE UPDATE)

### Query 4: Verify user_profiles Business Context Fields
```sql
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_profiles'
ORDER BY ordinal_position;
```

**Expected business-context fields added by migration 6:**
- `target_titles` (text[], DEFAULT '{}')
- `target_companies` (text[], DEFAULT '{}')
- `must_have_skills` (text[], DEFAULT '{}')
- `nice_to_have_skills` (text[], DEFAULT '{}')
- `min_experience` (integer)
- `max_experience` (integer)
- `dnc_companies` (text[], DEFAULT '{}')
- `dnc_individuals` (text[], DEFAULT '{}')
- `outreach_examples` (jsonb, DEFAULT '[]'::jsonb)

### Query 5: Verify RLS is Enabled
```sql
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

All tables should have `rowsecurity = true`.

## Step 4: Deploy Edge Functions

### Required Secrets

Before deploying, set these secrets:

```bash
# Lovable API Key (for AI-powered email generation and boolean string generation)
supabase secrets set LOVABLE_API_KEY=your_lovable_api_key

# Resend API Key (for sending emails)
supabase secrets set RESEND_API_KEY=your_resend_api_key

# Apify API credentials (for LinkedIn candidate search)
supabase secrets set APIFY_API_TOKEN=your_apify_api_token
supabase secrets set APIFY_ACTOR_ID=your_apify_actor_id

# Optional: Allowed CORS origin (defaults to '*')
supabase secrets set ALLOWED_ORIGIN=https://yourdomain.com

# Note: SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY
# are automatically available in edge functions
```

### Deploy All Edge Functions

```bash
# Deploy all functions at once
supabase functions deploy generate-boolean
supabase functions deploy generate-outreach-email
supabase functions deploy search-candidates
supabase functions deploy send-outreach-email
```

Or deploy individually:

```bash
# 1. Generate Boolean Search Strings
supabase functions deploy generate-boolean
# Required secrets: LOVABLE_API_KEY

# 2. Generate Outreach Emails
supabase functions deploy generate-outreach-email
# Required secrets: LOVABLE_API_KEY

# 3. Search Candidates
supabase functions deploy search-candidates
# Required secrets: APIFY_API_TOKEN, APIFY_ACTOR_ID
# Optional: ALLOWED_ORIGIN

# 4. Send Outreach Emails
supabase functions deploy send-outreach-email
# Required secrets: RESEND_API_KEY
```

## Step 5: Test Edge Functions

```bash
# Test function invocation
supabase functions invoke generate-boolean --data '{"mode":"simple","hiring_sentence":"Looking for a Senior React Developer in San Francisco"}'

supabase functions invoke generate-outreach-email --data '{"jobBrief":{"role":"Senior Developer","location":"Remote","skills":["React"]},"candidateProfile":{"name":"John Doe","title":"Software Engineer","company":"Tech Corp","location":"SF"}}'
```

## Summary of Environment Variables

| Variable | Used By | Required | Description |
|----------|---------|----------|-------------|
| `LOVABLE_API_KEY` | generate-boolean, generate-outreach-email | ✅ Yes | Lovable AI gateway API key |
| `RESEND_API_KEY` | send-outreach-email | ✅ Yes | Resend email service API key |
| `APIFY_API_TOKEN` | search-candidates | ✅ Yes | Apify API token for LinkedIn scraping |
| `APIFY_ACTOR_ID` | search-candidates | ✅ Yes | Apify actor ID for LinkedIn scraper |
| `ALLOWED_ORIGIN` | search-candidates | ⚠️ Optional | CORS allowed origin (defaults to '*') |
| `SUPABASE_URL` | send-outreach-email, search-candidates | 🔄 Auto | Automatically provided by Supabase |
| `SUPABASE_ANON_KEY` | send-outreach-email | 🔄 Auto | Automatically provided by Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | search-candidates | 🔄 Auto | Automatically provided by Supabase |

## Troubleshooting

### Migration Fails
- Check the error message for specific SQL errors
- Ensure migrations are in the correct order
- Verify you're on a clean/empty database

### Edge Function Deployment Fails
- Verify all required secrets are set: `supabase secrets list`
- Check function logs: `supabase functions logs FUNCTION_NAME`
- Ensure Deno imports are accessible

### RLS Policies Not Working
- Verify RLS is enabled: Check Query 5 above
- Test with authenticated user context
- Check policy conditions match your auth setup

## Post-Deployment Checklist

- [ ] All 7 tables created successfully
- [ ] All RLS policies active (25 total)
- [ ] All triggers installed (4 total)
- [ ] All functions deployed (2 SQL + 4 Edge functions)
- [ ] user_profiles has all 9 business-context fields
- [ ] All required secrets configured
- [ ] Edge functions tested and responding
