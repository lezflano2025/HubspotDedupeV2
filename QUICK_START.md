# 🚀 Quick Start - Supabase Deployment

## Your Project Details

```
Project ID:     iulypfrqgjqblhsrsqdr
Project URL:    https://cvcxpgltdypbcjokxgxb.supabase.co
Access Token:   sbp_f7126163e15d400240a6dd7894c0f16d7c8c304d
```

## ⚡ Fast Deployment (3 Steps)

### 1️⃣ Run Deployment Script

```bash
chmod +x deploy-to-supabase.sh
./deploy-to-supabase.sh
```

This will:
- ✅ Initialize and link to your Supabase project
- ✅ Apply all 6 migrations
- ✅ Deploy all 4 edge functions

### 2️⃣ Set Required Secrets

```bash
chmod +x set-supabase-secrets.sh
./set-supabase-secrets.sh
```

Or manually:

```bash
supabase secrets set LOVABLE_API_KEY=your_key_here
supabase secrets set RESEND_API_KEY=your_key_here
supabase secrets set APIFY_API_TOKEN=your_key_here
supabase secrets set APIFY_ACTOR_ID=your_actor_id_here
```

### 3️⃣ Verify Deployment

Run the queries in `verify-deployment.sql` in Supabase SQL Editor, or:

```bash
supabase db remote list
supabase functions list
supabase secrets list
```

## 📋 Expected Results

**Database Tables (7):**
- ✅ open_roles
- ✅ candidates
- ✅ candidate_tracking
- ✅ user_profiles
- ✅ saved_candidates
- ✅ search_rate_limit
- ✅ email_outreach

**RLS Policies:** 25 total

**Edge Functions (4):**
- ✅ generate-boolean
- ✅ generate-outreach-email
- ✅ search-candidates
- ✅ send-outreach-email

## 🔑 Where to Get API Keys

| Service | URL |
|---------|-----|
| **Lovable API** | https://lovable.dev (or your AI gateway) |
| **Resend** | https://resend.com/api-keys |
| **Apify** | https://console.apify.com/account/integrations |

## 📂 Files Reference

- `deploy-to-supabase.sh` - Main deployment script
- `set-supabase-secrets.sh` - Secrets configuration helper
- `verify-deployment.sql` - SQL verification queries
- `all-migrations-combined.sql` - All migrations in one file (manual option)
- `SUPABASE_DEPLOYMENT_GUIDE.md` - Detailed documentation

## 🆘 Troubleshooting

**Migrations fail?**
```bash
# Check migration status
supabase db remote list

# Reset and retry (⚠️ WARNING: destructive)
supabase db reset --linked
supabase db push
```

**Functions not deploying?**
```bash
# Check logs
supabase functions logs FUNCTION_NAME

# Redeploy specific function
supabase functions deploy FUNCTION_NAME
```

**Need to update secrets?**
```bash
supabase secrets list
supabase secrets set KEY_NAME=new_value
```

## ✅ Post-Deployment Checklist

- [ ] All 7 tables created
- [ ] RLS enabled on all tables (25 policies total)
- [ ] All 4 edge functions deployed
- [ ] All required secrets configured
- [ ] Test each edge function
- [ ] Update your frontend .env with Supabase credentials

## 🔗 Useful Links

- [Supabase Dashboard](https://supabase.com/dashboard/project/iulypfrqgjqblhsrsqdr)
- [SQL Editor](https://supabase.com/dashboard/project/iulypfrqgjqblhsrsqdr/sql)
- [Edge Functions](https://supabase.com/dashboard/project/iulypfrqgjqblhsrsqdr/functions)
- [Database Tables](https://supabase.com/dashboard/project/iulypfrqgjqblhsrsqdr/editor)
