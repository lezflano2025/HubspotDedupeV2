#!/bin/bash
set -e

# Supabase Project Configuration
PROJECT_REF="iulypfrqgjqblhsrsqdr"
PROJECT_URL="https://cvcxpgltdypbcjokxgxb.supabase.co"
export SUPABASE_ACCESS_TOKEN="sbp_f7126163e15d400240a6dd7894c0f16d7c8c304d"

echo "🚀 Supabase Deployment Script"
echo "=============================="
echo "Project: ${PROJECT_REF}"
echo "URL: ${PROJECT_URL}"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found!"
    echo "📦 Install it from: https://supabase.com/docs/guides/cli/getting-started"
    echo ""
    echo "Quick install:"
    echo "  macOS: brew install supabase/tap/supabase"
    echo "  Linux: https://github.com/supabase/cli#install-the-cli"
    echo "  Windows: scoop bucket add supabase https://github.com/supabase/scoop-bucket.git && scoop install supabase"
    exit 1
fi

echo "✅ Supabase CLI found: $(supabase --version)"
echo ""

# Initialize if not already done
if [ ! -f "supabase/config.toml" ]; then
    echo "📁 Initializing Supabase..."
    supabase init
else
    echo "✅ Supabase already initialized"
fi

# Login if needed (will use SUPABASE_ACCESS_TOKEN env var)
echo "🔐 Authenticating..."
supabase login

# Link to project
echo "🔗 Linking to project ${PROJECT_REF}..."
supabase link --project-ref "${PROJECT_REF}"

# Apply migrations
echo ""
echo "📋 Applying migrations..."
echo "========================"
supabase db push

# Check migration status
echo ""
echo "✅ Migration status:"
supabase db remote list

# Deploy edge functions
echo ""
echo "🌐 Deploying Edge Functions..."
echo "=============================="

echo ""
echo "⚠️  IMPORTANT: Set required secrets first!"
echo ""
echo "Run these commands to set secrets:"
echo ""
echo "  supabase secrets set LOVABLE_API_KEY=your_lovable_api_key"
echo "  supabase secrets set RESEND_API_KEY=your_resend_api_key"
echo "  supabase secrets set APIFY_API_TOKEN=your_apify_api_token"
echo "  supabase secrets set APIFY_ACTOR_ID=your_apify_actor_id"
echo ""
read -p "Have you set all required secrets? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "⏭️  Skipping edge function deployment"
    echo "Run this script again after setting secrets"
    exit 0
fi

echo ""
echo "Deploying functions..."
supabase functions deploy generate-boolean
supabase functions deploy generate-outreach-email
supabase functions deploy search-candidates
supabase functions deploy send-outreach-email

echo ""
echo "✅ Deployment Complete!"
echo ""
echo "📊 Next Steps:"
echo "1. Run verification queries from SUPABASE_DEPLOYMENT_GUIDE.md"
echo "2. Test edge functions"
echo "3. Update your .env with Supabase credentials"
echo ""
echo "🔍 Useful commands:"
echo "  supabase db remote list        # List applied migrations"
echo "  supabase functions list        # List deployed functions"
echo "  supabase secrets list          # List configured secrets"
echo "  supabase logs                  # View logs"
