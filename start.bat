@echo off
REM ============================================================
REM O-RAN RPC Message Log Parser - Startup Script (Windows CMD)
REM
REM Simple startup script for Windows
REM For advanced options, use start.ps1 instead
REM ============================================================

echo.
echo ========================================
echo   O-RAN RPC Message Log Parser
echo ========================================
echo.

REM Check if Python is installed
where python >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python is not installed or not in PATH
    exit /b 1
)

REM Check if Node.js is installed
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed or not in PATH
    exit /b 1
)

REM Create virtual environment if not exists
if not exist ".venv" (
    echo [INFO] Creating virtual environment...
    python -m venv .venv
    echo [OK] Virtual environment created
)

REM Activate virtual environment
call .venv\Scripts\activate.bat
echo [OK] Virtual environment activated

REM Install Python dependencies
echo [INFO] Installing Python dependencies...
python -m pip install -q --upgrade pip
python -m pip install -q -r backend\requirements.txt
echo [OK] Python dependencies installed

echo.

REM Setup frontend
echo [INFO] Setting up frontend...
cd frontend

if not exist "node_modules" (
    echo [INFO] Installing frontend dependencies...
    call npm install
    echo [OK] Frontend dependencies installed
) else (
    echo [OK] Frontend dependencies already installed
)

echo [INFO] Building frontend...
call npm run build
echo [OK] Frontend build completed

cd ..

echo.
echo ========================================
echo [INFO] Starting backend server...
echo ========================================
echo.
echo [OK] Application will be available at: http://localhost:8000
echo [INFO] Press Ctrl+C to stop
echo.

cd backend
python run.py
