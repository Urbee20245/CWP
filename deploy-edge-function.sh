#!/bin/bash

# Edge Function Deployment Script for CWP
# This script deploys the create-deposit-checkout Edge Function to Supabase

set -e  # Exit on error

echo "🚀 CWP Edge Function Deployment Script"
echo "========================================"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found!"
    echo "📦 Installing Supabase CLI..."
    
    # Install Supabase CLI based on OS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        brew install supabase/tap/supabase
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        curl -fsSL https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz | tar -xz
        sudo mv supabase /usr/local/bin/
    else
        echo "❌ Unsupported OS. Please install Supabase CLI manually:"
        echo "   https://github.com/supabase/cli#install-the-cli"
        exit 1
    fi
fi

echo "✅ Supabase CLI found"
echo ""

# Check if we're in the project directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Not in CWP project directory!"
    echo "   Please run this script from the project root."
    exit 1
fi

# Check if supabase functions directory exists
if [ ! -d "supabase/functions/create-deposit-checkout" ]; then
    echo "❌ Error: Edge function directory not found!"
    echo "   Expected: supabase/functions/create-deposit-checkout"
    exit 1
fi

echo "📁 Project structure verified"
echo ""

# Prompt for Supabase project details if not already linked
echo "🔗 Linking Supabase project..."
echo ""

# Check if already linked
if [ ! -f ".supabase/config.toml" ]; then
    echo "Not linked yet. Please enter your Supabase project details:"
    read -p "Project Reference ID (from Supabase Dashboard URL): " PROJECT_REF
    
    supabase link --project-ref "$PROJECT_REF"
else
    echo "✅ Already linked to Supabase project"
fi

echo ""
echo "🔐 Checking Edge Function secrets..."
echo ""

# Check if secrets are set (you'll need to manually verify these)
echo "⚠️  Please ensure these secrets are set in your Supabase project:"
echo "   1. STRIPE_SECRET_KEY"
echo "   2. SUPABASE_URL"
echo "   3. SUPABASE_SERVICE_ROLE_KEY"
echo ""
read -p "Have you set these secrets? (y/n): " SECRETS_CONFIRMED

if [ "$SECRETS_CONFIRMED" != "y" ]; then
    echo ""
    echo "Please set secrets using:"
    echo "  supabase secrets set STRIPE_SECRET_KEY=sk_test_..."
    echo "  supabase secrets set SUPABASE_URL=https://xxx.supabase.co"
    echo "  supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJ..."
    echo ""
    read -p "Press Enter after setting secrets to continue..."
fi

echo ""
echo "🚀 Deploying Edge Function: create-deposit-checkout"
echo ""

# Deploy the Edge Function
supabase functions deploy create-deposit-checkout --no-verify-jwt

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ SUCCESS! Edge Function deployed!"
    echo ""
    echo "📝 Next steps:"
    echo "   1. Test the function in Supabase Dashboard"
    echo "   2. Check the logs: supabase functions logs create-deposit-checkout"
    echo "   3. Try a payment in your app"
    echo ""
else
    echo ""
    echo "❌ Deployment failed!"
    echo "   Check the error messages above"
    echo ""
    exit 1
fi
