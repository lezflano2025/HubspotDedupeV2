#!/bin/bash
set -e

echo "🔑 Supabase Secrets Configuration"
echo "=================================="
echo ""
echo "This script will help you set all required secrets for edge functions."
echo ""

# Prompt for each secret
echo "📝 Enter your API keys/tokens:"
echo ""

read -p "LOVABLE_API_KEY (for AI features): " LOVABLE_API_KEY
read -p "RESEND_API_KEY (for email sending): " RESEND_API_KEY
read -p "APIFY_API_TOKEN (for LinkedIn search): " APIFY_API_TOKEN
read -p "APIFY_ACTOR_ID (Apify actor ID): " APIFY_ACTOR_ID
read -p "ALLOWED_ORIGIN (optional, press Enter for default '*'): " ALLOWED_ORIGIN

echo ""
echo "Setting secrets..."
echo ""

supabase secrets set LOVABLE_API_KEY="${LOVABLE_API_KEY}"
echo "✅ LOVABLE_API_KEY set"

supabase secrets set RESEND_API_KEY="${RESEND_API_KEY}"
echo "✅ RESEND_API_KEY set"

supabase secrets set APIFY_API_TOKEN="${APIFY_API_TOKEN}"
echo "✅ APIFY_API_TOKEN set"

supabase secrets set APIFY_ACTOR_ID="${APIFY_ACTOR_ID}"
echo "✅ APIFY_ACTOR_ID set"

if [ -n "${ALLOWED_ORIGIN}" ]; then
    supabase secrets set ALLOWED_ORIGIN="${ALLOWED_ORIGIN}"
    echo "✅ ALLOWED_ORIGIN set"
fi

echo ""
echo "✅ All secrets configured!"
echo ""
echo "Verify secrets:"
supabase secrets list
