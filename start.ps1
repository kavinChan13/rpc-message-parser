# ============================================================
# O-RAN RPC Message Log Parser - Startup Script (PowerShell)
#
# Usage:
#   .\start.ps1                 # Normal mode
#   .\start.ps1 -Debug          # Debug mode
#   .\start.ps1 -Daemon         # Daemon mode
#   .\start.ps1 -Port 8080      # Custom port
#   .\start.ps1 -Clean          # Clean build
# ============================================================

param(
    [switch]$Debug,
    [switch]$Daemon,
    [int]$Port = 8000,
    [switch]$Clean,
    [switch]$Help
)

# Helper functions
function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Warning-Custom {
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor Yellow
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

function Write-Info {
    param([string]$Message)
    Write-Host "➜ $Message" -ForegroundColor Cyan
}

# Show help
if ($Help) {
    Write-Host ""
    Write-Host "O-RAN RPC Message Log Parser - Startup Script" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\start.ps1 [OPTIONS]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -Debug      Enable debug mode for frontend"
    Write-Host "  -Daemon     Run backend server in background"
    Write-Host "  -Port N     Override port (default: 8000)"
    Write-Host "  -Clean      Clean build and reinstall dependencies"
    Write-Host "  -Help       Show this help message"
    Write-Host ""
    exit 0
}

Write-Host ""
Write-Info "========================================"
Write-Info "  O-RAN RPC Message Log Parser"
Write-Info "========================================"
Write-Host ""

# Set debug mode
if ($Debug) {
    $env:VITE_DEBUG = "1"
    Write-Success "Debug mode enabled (VITE_DEBUG=1)"
} else {
    $env:VITE_DEBUG = ""
}

Write-Info "Backend port: $Port"
Write-Host ""

# Check if port is already in use
$existingProcess = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($existingProcess) {
    $pid = $existingProcess.OwningProcess
    Write-Warning-Custom "Port $Port is already in use by PID: $pid"

    $response = Read-Host "Kill existing process? (y/n)"
    if ($response -eq "y" -or $response -eq "Y") {
        Stop-Process -Id $pid -Force
        Write-Success "Killed existing process (PID: $pid)"
        Start-Sleep -Seconds 1
    } else {
        Write-Error-Custom "Cannot start: port already in use"
        exit 1
    }
}

# Clean mode
if ($Clean) {
    Write-Info "Clean mode: removing old builds and dependencies..."

    if (Test-Path ".venv") { Remove-Item -Recurse -Force ".venv" }
    if (Test-Path "backend\__pycache__") { Remove-Item -Recurse -Force "backend\__pycache__" }
    if (Test-Path "backend\app\__pycache__") { Remove-Item -Recurse -Force "backend\app\__pycache__" }
    if (Test-Path "backend\app\routes\__pycache__") { Remove-Item -Recurse -Force "backend\app\routes\__pycache__" }
    if (Test-Path "frontend\node_modules") { Remove-Item -Recurse -Force "frontend\node_modules" }
    if (Test-Path "frontend\dist") { Remove-Item -Recurse -Force "frontend\dist" }
    if (Test-Path "backend\oran_parser.db") { Remove-Item -Force "backend\oran_parser.db" }

    Write-Success "Clean completed"
    Write-Host ""
}

# Python environment setup
Write-Info "Setting up Python environment..."

if (-not (Test-Path ".venv")) {
    Write-Info "Creating virtual environment..."
    python -m venv .venv
    Write-Success "Virtual environment created"
}

# Activate virtual environment
& ".\.venv\Scripts\Activate.ps1"
Write-Success "Virtual environment activated"

Write-Info "Installing/updating Python dependencies..."
python -m pip install -q --upgrade pip
python -m pip install -q -r backend\requirements.txt
Write-Success "Python dependencies installed"

Write-Host ""

# Frontend setup
Write-Info "Setting up frontend..."

Push-Location frontend

if (-not (Test-Path "node_modules") -or $Clean) {
    Write-Info "Installing frontend dependencies..."
    npm install
    Write-Success "Frontend dependencies installed"
} else {
    Write-Success "Frontend dependencies already installed"
}

Write-Info "Building frontend (this may take a moment)..."
npm run build
Write-Success "Frontend build completed"

Pop-Location
Write-Host ""

# Create logs directory
if (-not (Test-Path "logs")) {
    New-Item -ItemType Directory -Path "logs" | Out-Null
}

# Start backend
Write-Info "========================================"

if ($Daemon) {
    Write-Info "Starting backend in background mode..."
    Write-Info "========================================"
    Write-Host ""

    $processParams = @{
        FilePath = "python"
        ArgumentList = "backend\run.py"
        RedirectStandardOutput = "logs\backend.log"
        RedirectStandardError = "logs\backend.err.log"
        WindowStyle = "Hidden"
    }

    $process = Start-Process @processParams -PassThru
    $process.Id | Out-File -FilePath "logs\backend.pid"

    Write-Success "Backend started in background mode (PID: $($process.Id))"
    Write-Info "Logs: logs\backend.log (stdout), logs\backend.err.log (stderr)"
    Write-Info "To stop: Stop-Process -Id (Get-Content logs\backend.pid)"
    Write-Info "To view logs: Get-Content logs\backend.log -Wait"
    Write-Host ""
    Write-Success "Application is running at: http://localhost:$Port"
    Write-Info "Frontend is served from backend"
} else {
    Write-Info "Starting backend in foreground mode..."
    Write-Info "========================================"
    Write-Host ""
    Write-Success "Application will be available at: http://localhost:$Port"
    Write-Info "Press Ctrl+C to stop"
    Write-Host ""

    Push-Location backend
    python run.py
    Pop-Location
}
