# PowerShell script to quickly deploy the missing Edge Function
Write-Host "🚀 Quick Deploy: send-magic-link Edge Function" -ForegroundColor Cyan
Write-Host ""

# Check if Supabase CLI is installed
$supabaseCheck = Get-Command supabase -ErrorAction SilentlyContinue
if (-not $supabaseCheck) {
    Write-Host "❌ Supabase CLI is not installed" -ForegroundColor Red
    Write-Host "Installing Supabase CLI..." -ForegroundColor Yellow
    npm install -g supabase
    
    # Verify installation
    $supabaseCheck = Get-Command supabase -ErrorAction SilentlyContinue
    if (-not $supabaseCheck) {
        Write-Host "❌ Failed to install Supabase CLI" -ForegroundColor Red
        Write-Host "Please install manually: npm install -g supabase" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "✅ Supabase CLI is installed" -ForegroundColor Green

# Check login status
Write-Host ""
Write-Host "Checking login status..." -ForegroundColor Yellow
$loginCheck = supabase status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Not logged in to Supabase" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please login to Supabase:" -ForegroundColor Yellow
    Write-Host "1. Open a new terminal" -ForegroundColor White
    Write-Host "2. Run: supabase login" -ForegroundColor White
    Write-Host "3. Follow the prompts" -ForegroundColor White
    Write-Host "4. Return here and run this script again" -ForegroundColor White
    exit 1
}

Write-Host "✅ Logged in to Supabase" -ForegroundColor Green

# Deploy the function
Write-Host ""
Write-Host "Deploying send-magic-link function..." -ForegroundColor Yellow
$deployResult = supabase functions deploy send-magic-link --project-ref nvgumhlewbqynrhlkqhx

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Function deployed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Go to Supabase Dashboard → Edge Functions" -ForegroundColor White
    Write-Host "2. Set environment variables:" -ForegroundColor White
    Write-Host "   - SITE_URL: https://customwebsitesplus.com" -ForegroundColor White
    Write-Host "   - (Optional) RESEND_API_KEY for custom emails" -ForegroundColor White
    Write-Host ""
    Write-Host "3. Configure Supabase Auth:" -ForegroundColor White
    Write-Host "   Go to Authentication → Settings" -ForegroundColor White
    Write-Host "   - Enable 'Enable email signup'" -ForegroundColor White
    Write-Host "   - Set Site URL" -ForegroundColor White
    Write-Host "   - Configure email provider" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "❌ Deployment failed" -ForegroundColor Red
    Write-Host "Error: $deployResult" -ForegroundColor Red
}

Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")