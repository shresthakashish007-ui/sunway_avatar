# Sunway Avatar - Quick Restart Script
# Run this to stop old processes and restart servers

Write-Host "`n🛑 Stopping old processes..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

Write-Host "✅ Old processes stopped`n" -ForegroundColor Green

Write-Host "📝 Instructions:" -ForegroundColor Cyan
Write-Host "   1. Open TWO PowerShell terminals" -ForegroundColor White
Write-Host "   2. In Terminal 1, run: npm run server" -ForegroundColor White
Write-Host "   3. In Terminal 2, run: npm run dev" -ForegroundColor White
Write-Host "   4. Open browser to: http://localhost:5173`n" -ForegroundColor White

$choice = Read-Host "Do you want to start the backend server now? (y/n)"

if ($choice -eq 'y' -or $choice -eq 'Y') {
    Write-Host "`n🚀 Starting backend server..." -ForegroundColor Green
    Write-Host "   Press Ctrl+C to stop" -ForegroundColor Yellow
    Write-Host "   Open ANOTHER terminal for 'npm run dev'`n" -ForegroundColor Yellow
    npm run server
} else {
    Write-Host "`n👋 Run 'npm run server' when ready!" -ForegroundColor Cyan
}
