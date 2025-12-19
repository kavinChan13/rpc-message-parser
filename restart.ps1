# Restart script - Apply log optimizations
# Used to restart services and apply new configurations

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Restarting RPC Message Parser" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Stop old backend processes
Write-Host "[1/3] Stopping old backend processes..." -ForegroundColor Yellow
$pythonProcesses = Get-Process | Where-Object {$_.ProcessName -eq "python" -or $_.ProcessName -eq "pythonw"}
if ($pythonProcesses) {
    $pythonProcesses | Stop-Process -Force
    Write-Host "✓ Stopped $($pythonProcesses.Count) Python process(es)" -ForegroundColor Green
} else {
    Write-Host "✓ No running Python processes" -ForegroundColor Green
}

Start-Sleep -Seconds 2

# 2. Rebuild frontend
Write-Host ""
Write-Host "[2/3] Rebuilding frontend..." -ForegroundColor Yellow
cd frontend
$buildResult = npm run build 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Frontend build successful" -ForegroundColor Green
} else {
    Write-Host "✗ Frontend build failed" -ForegroundColor Red
    Write-Host $buildResult -ForegroundColor Red
    cd ..
    exit 1
}
cd ..

# 3. Start backend
Write-Host ""
Write-Host "[3/3] Starting backend server..." -ForegroundColor Yellow
Write-Host ""

# Get local IP address
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*"} | Select-Object -First 1).IPAddress
if (-not $ip) {
    $ip = "localhost"
}

Write-Host "========================================" -ForegroundColor Green
Write-Host "  Server Starting..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "✅ Log optimizations applied:" -ForegroundColor Yellow
Write-Host "  • SQLAlchemy logs: Disabled" -ForegroundColor Gray
Write-Host "  • Uvicorn access logs: Disabled" -ForegroundColor Gray
Write-Host "  • Frontend polling frequency: Reduced by 40%" -ForegroundColor Gray
Write-Host ""
Write-Host "Local access: " -NoNewline
Write-Host "http://localhost:8000" -ForegroundColor Cyan
Write-Host "LAN access: " -NoNewline
Write-Host "http://${ip}:8000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

# Start backend
cd backend
python run.py
