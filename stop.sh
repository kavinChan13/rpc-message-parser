#!/usr/bin/env bash

# ------------------------------------------------------------
# O-RAN RPC Message Log Parser - Stop Script
# ------------------------------------------------------------

COLOR_GREEN="\033[0;32m"
COLOR_RED="\033[0;31m"
COLOR_YELLOW="\033[0;33m"
COLOR_RESET="\033[0m"

echo_success() {
    printf "%b✓ %s%b\n" "${COLOR_GREEN}" "$*" "${COLOR_RESET}"
}

echo_error() {
    printf "%b✗ %s%b\n" "${COLOR_RED}" "$*" "${COLOR_RESET}"
}

echo_warn() {
    printf "%b⚠ %s%b\n" "${COLOR_YELLOW}" "$*" "${COLOR_RESET}"
}

# Stop daemon process if PID file exists
if [ -f "logs/backend.pid" ]; then
    pid=$(cat logs/backend.pid)

    if ps -p $pid > /dev/null 2>&1; then
        echo_warn "Stopping backend (PID: $pid)..."
        kill $pid
        sleep 1

        # Force kill if still running
        if ps -p $pid > /dev/null 2>&1; then
            echo_warn "Process still running, force killing..."
            kill -9 $pid
        fi

        rm logs/backend.pid
        echo_success "Backend stopped"
    else
        echo_warn "Backend process (PID: $pid) not running"
        rm logs/backend.pid
    fi
else
    echo_warn "No PID file found (logs/backend.pid)"
fi

# Check for any running Python processes on port 8000
if command -v lsof &> /dev/null; then
    pid=$(lsof -i :8000 -sTCP:LISTEN -t 2>/dev/null || true)
    if [ -n "$pid" ]; then
        echo_warn "Found process on port 8000 (PID: $pid)"
        kill -9 $pid
        echo_success "Killed process on port 8000"
    fi
fi

echo_success "Cleanup completed"
