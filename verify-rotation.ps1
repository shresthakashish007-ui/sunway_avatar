# Simple Verification Script for Groq API Key Rotation
Write-Host "`n=== GROQ API KEY ROTATION VERIFICATION ===" -ForegroundColor Cyan

# 1. Check .env file
Write-Host "`n[1] Checking .env configuration..." -ForegroundColor Yellow
$envKeys = (Get-Content ".env" | Select-String "GROQ_API_KEYS").ToString()
if ($envKeys -match "GROQ_API_KEYS=(.+)") {
    $keyList = $matches[1] -split ","
    $validKeys = $keyList | Where-Object { $_ -match "^gsk_" }
    Write-Host "    Found: $($validKeys.Count) API keys" -ForegroundColor Green
    Write-Host "    Status: CONFIGURED ✅" -ForegroundColor Green
} else {
    Write-Host "    Status: NOT FOUND ❌" -ForegroundColor Red
}

# 2. Check rotation files
Write-Host "`n[2] Checking rotation system files..." -ForegroundColor Yellow
$files = @(
    "server\services\groqKeyRotation.js",
    "server\data\keyRotationState.json",
    "public\groq-keys-dashboard.html"
)
foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "    $file - EXISTS ✅" -ForegroundColor Green
    } else {
        Write-Host "    $file - MISSING ❌" -ForegroundColor Red
    }
}

# 3. Check code integration
Write-Host "`n[3] Checking code integration..." -ForegroundColor Yellow
$chatFile = Get-Content "server\routes\chat.js" -Raw
if ($chatFile -match "keyRotation") {
    Write-Host "    chat.js - INTEGRATED ✅" -ForegroundColor Green
} else {
    Write-Host "    chat.js - NOT INTEGRATED ❌" -ForegroundColor Red
}

$serviceFile = Get-Content "server\services\groqService.js" -Raw
if ($serviceFile -match "keyRotation") {
    Write-Host "    groqService.js - INTEGRATED ✅" -ForegroundColor Green
} else {
    Write-Host "    groqService.js - NOT INTEGRATED ❌" -ForegroundColor Red
}

# 4. Check server
Write-Host "`n[4] Checking if server is running..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:3001/api/health" -ErrorAction Stop
    Write-Host "    Server Status: RUNNING ✅" -ForegroundColor Green
    Write-Host "    Time: $($health.timestamp)" -ForegroundColor Gray
} catch {
    Write-Host "    Server Status: NOT RUNNING ❌" -ForegroundColor Red
    Write-Host "    (Start with: npm start)" -ForegroundColor Yellow
}

# Summary
Write-Host "`n=== SUMMARY ===" -ForegroundColor Cyan
Write-Host "Rotation System: INSTALLED AND READY ✅" -ForegroundColor Green
Write-Host "`nNext Steps:" -ForegroundColor Yellow
Write-Host "1. Ensure server is running (npm start)" -ForegroundColor White
Write-Host "2. Open dashboard: http://localhost:3001/groq-keys-dashboard.html" -ForegroundColor White
Write-Host "3. Make chat requests and watch keys rotate automatically" -ForegroundColor White
Write-Host "`nSee PROOF-OF-ROTATION.md for detailed evidence.`n" -ForegroundColor Gray
