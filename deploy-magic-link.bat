@echo off
echo Deploying send-magic-link Edge Function...
echo.

REM Check if supabase CLI is installed
where supabase >nul 2>nul
if %errorlevel% neq 0 (
    echo Supabase CLI is not installed. Please install it first:
    echo npm install -g supabase
    pause
    exit /b 1
)

REM Check if user is logged in
echo Checking Supabase login status...
supabase status >nul 2>nul
if %errorlevel% neq 0 (
    echo Not logged in to Supabase. Please run:
    echo supabase login
    pause
    exit /b 1
)

REM Deploy the function
echo Deploying send-magic-link function...
supabase functions deploy send-magic-link --project-ref nvgumhlewbqynrhlkqhx

if %errorlevel% equ 0 (
    echo.
    echo ✅ Function deployed successfully!
    echo.
    echo Next steps:
    echo 1. Go to Supabase Dashboard → Edge Functions
    echo 2. Set environment variables:
    echo    - RESEND_API_KEY
    echo    - SMTP_FROM_EMAIL
    echo    - SMTP_FROM_NAME
    echo    - SITE_URL
    echo 3. Test the function
) else (
    echo.
    echo ❌ Deployment failed. Check the error above.
)

echo.
pause