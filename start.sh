#!/usr/bin/env bash
set -euo pipefail

# ------------------------------------------------------------
# O-RAN RPC Message Log Parser - Startup Script
#
# Options:
#   --debug    Enable debug mode for frontend (VITE_DEBUG=1)
#   --daemon   Run backend server in daemon mode
#   --port=    Override port (default: 8000)
#   --prefix=  URL prefix for reverse proxy (default: /)
#   --clean    Clean build and reinstall dependencies
# ------------------------------------------------------------

DEBUG=0
DAEMON_MODE=0
PORT=8000
PREFIX_VALUE=""
CLEAN_MODE=0

# Color helpers
if [ -t 1 ]; then
    COLOR_GREEN="\033[0;32m"
    COLOR_YELLOW="\033[0;33m"
    COLOR_RED="\033[0;31m"
    COLOR_BLUE="\033[0;34m"
    COLOR_RESET="\033[0m"
else
    COLOR_GREEN=""
    COLOR_YELLOW=""
    COLOR_RED=""
    COLOR_BLUE=""
    COLOR_RESET=""
fi

echo_success() {
    printf "%b✓ %s%b\n" "${COLOR_GREEN}" "$*" "${COLOR_RESET}"
}

echo_warn() {
    printf "%b⚠ %s%b\n" "${COLOR_YELLOW}" "$*" "${COLOR_RESET}"
}

echo_error() {
    printf "%b✗ %s%b\n" "${COLOR_RED}" "$*" "${COLOR_RESET}"
}

echo_info() {
    printf "%b➜ %s%b\n" "${COLOR_BLUE}" "$*" "${COLOR_RESET}"
}

# Parse arguments
for arg in "$@"; do
    case "$arg" in
        --debug)
            DEBUG=1
            ;;
        --daemon)
            DAEMON_MODE=1
            ;;
        --port=*)
            PORT="${arg#*=}"
            ;;
        --prefix=*)
            PREFIX_VALUE="${arg#*=}"
            ;;
        --clean)
            CLEAN_MODE=1
            ;;
        --help|-h)
            echo "O-RAN RPC Message Log Parser - Startup Script"
            echo ""
            echo "Usage: ./start.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --debug      Enable debug mode for frontend"
            echo "  --daemon     Run backend server in daemon mode"
            echo "  --port=N     Override port (default: 8000)"
            echo "  --prefix=P   URL prefix for reverse proxy (e.g., /rpc-parser)"
            echo "  --clean      Clean build and reinstall dependencies"
            echo "  --help       Show this help message"
            exit 0
            ;;
    esac
done

echo ""
echo_info "========================================"
echo_info "  O-RAN RPC Message Log Parser"
echo_info "========================================"
echo ""

# Set debug mode
if [ "$DEBUG" = "1" ]; then
    export VITE_DEBUG=1
    echo_success "Debug mode enabled (VITE_DEBUG=1)"
else
    export VITE_DEBUG=
fi

# Set prefix for reverse proxy
if [ -n "$PREFIX_VALUE" ]; then
    export PREFIX="$PREFIX_VALUE"
    export VITE_BASE_PATH="$PREFIX_VALUE"
    echo_success "Using PREFIX=$PREFIX_VALUE (for reverse proxy deployment)"
fi

echo_info "Backend port: $PORT"
echo ""

# Check if port is already in use
if command -v lsof &> /dev/null; then
    pid=$(lsof -i :$PORT -sTCP:LISTEN -t 2>/dev/null || true)
    if [ -n "$pid" ]; then
        echo_warn "Port $PORT is already in use by PID: $pid"
        read -p "Kill existing process? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            kill -9 $pid
            echo_success "Killed existing process (PID: $pid)"
            sleep 1
        else
            echo_error "Cannot start: port already in use"
            exit 1
        fi
    fi
fi

# Clean mode
if [ "$CLEAN_MODE" = "1" ]; then
    echo_info "Clean mode: removing old builds and dependencies..."
    rm -rf .venv backend/__pycache__ backend/app/__pycache__ backend/app/routes/__pycache__
    rm -rf frontend/node_modules frontend/dist
    rm -f backend/oran_parser.db
    echo_success "Clean completed"
    echo ""
fi

# Python environment setup
echo_info "Setting up Python environment..."

if [ ! -d ".venv" ]; then
    echo_info "Creating virtual environment..."
    python3 -m venv .venv
    echo_success "Virtual environment created"
fi

source .venv/bin/activate
echo_success "Virtual environment activated"

echo_info "Installing/updating Python dependencies..."
pip install -q --upgrade pip
pip install -q -r backend/requirements.txt
echo_success "Python dependencies installed"

echo ""

# Frontend setup
echo_info "Setting up frontend..."

cd frontend

if [ ! -d "node_modules" ] || [ "$CLEAN_MODE" = "1" ]; then
    echo_info "Installing frontend dependencies..."
    npm install
    echo_success "Frontend dependencies installed"
else
    echo_success "Frontend dependencies already installed"
fi

echo_info "Building frontend (this may take a moment)..."
npm run build
echo_success "Frontend build completed"

cd ..
echo ""

# Create logs directory for daemon mode
mkdir -p logs

# Start backend
echo_info "========================================"
if [ "$DAEMON_MODE" = "1" ]; then
    echo_info "Starting backend in daemon mode..."
    echo_info "========================================"
    echo ""

    nohup python backend/run.py \
        > logs/backend.log 2> logs/backend.err.log &

    BACKEND_PID=$!
    echo "$BACKEND_PID" > logs/backend.pid

    echo_success "Backend started in daemon mode (PID: $BACKEND_PID)"
    echo_info "Logs: logs/backend.log (stdout), logs/backend.err.log (stderr)"
    echo_info "To stop: kill \$(cat logs/backend.pid)"
    echo_info "To view logs: tail -f logs/backend.log"
    echo ""
    echo_success "Application is running at: http://localhost:$PORT"
    echo_info "Frontend is served from: http://localhost:$PORT (index.html)"
else
    echo_info "Starting backend in foreground mode..."
    echo_info "========================================"
    echo ""
    echo_success "Application will be available at: http://localhost:$PORT"
    echo_info "Press Ctrl+C to stop"
    echo ""

    cd backend
    python run.py || echo_error "Backend exited unexpectedly"
fi
