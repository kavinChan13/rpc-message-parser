# ============================================================
# O-RAN RPC Message Log Parser - Stop Script (PowerShell)
# ============================================================

function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

function Write-Warning-Custom {
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor Yellow
}

# Stop daemon process if PID file exists
if (Test-Path "logs\backend.pid") {
    $pid = Get-Content "logs\backend.pid"

    $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
    if ($process) {
        Write-Warning-Custom "Stopping backend (PID: $pid)..."
        Stop-Process -Id $pid -Force
        Start-Sleep -Seconds 1
        Remove-Item "logs\backend.pid"
        Write-Success "Backend stopped"
    } else {
        Write-Warning-Custom "Backend process (PID: $pid) not running"
        Remove-Item "logs\backend.pid"
    }
} else {
    Write-Warning-Custom "No PID file found (logs\backend.pid)"
}

# Check for any running process on port 8000
$existingProcess = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
if ($existingProcess) {
    $pid = $existingProcess.OwningProcess
    Write-Warning-Custom "Found process on port 8000 (PID: $pid)"
    Stop-Process -Id $pid -Force
    Write-Success "Killed process on port 8000"
}

Write-Success "Cleanup completed"
