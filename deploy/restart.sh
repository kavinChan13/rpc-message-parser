#!/bin/bash
# =============================================================================
# RPC Message Parser - 服务重启脚本
# 用于 GitLab CI/CD 自动部署后重启服务
# =============================================================================

set -e

# 配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/backend"
LOG_DIR="$PROJECT_ROOT/logs"
PID_FILE="$PROJECT_ROOT/uvicorn.pid"

# 默认配置（可通过环境变量覆盖）
HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8000}"
WORKERS="${WORKERS:-1}"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 确保日志目录存在
mkdir -p "$LOG_DIR"

# 停止现有进程
stop_service() {
    log_info "Stopping existing service..."

    # 方法1: 使用 PID 文件
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            kill "$PID"
            log_info "Stopped process with PID $PID"
        fi
        rm -f "$PID_FILE"
    fi

    # 方法2: 查找并终止 uvicorn 进程
    pkill -f "uvicorn app.main:app" 2>/dev/null || true

    # 等待进程完全退出
    sleep 2
}

# 启动服务
start_service() {
    log_info "Starting service..."

    cd "$BACKEND_DIR"

    # 激活虚拟环境（如果存在）
    if [ -f "venv/bin/activate" ]; then
        source venv/bin/activate
        log_info "Activated virtual environment"
    elif [ -f "../venv/bin/activate" ]; then
        source ../venv/bin/activate
        log_info "Activated virtual environment (parent dir)"
    else
        log_warn "No virtual environment found, using system Python"
    fi

    # 检查依赖
    if ! python -c "import uvicorn" 2>/dev/null; then
        log_error "uvicorn not installed. Run: pip install -r requirements.txt"
        exit 1
    fi

    # 启动 uvicorn
    nohup uvicorn app.main:app \
        --host "$HOST" \
        --port "$PORT" \
        --workers "$WORKERS" \
        > "$LOG_DIR/uvicorn.log" 2>&1 &

    # 保存 PID
    echo $! > "$PID_FILE"

    log_info "Service started with PID $(cat "$PID_FILE")"
    log_info "Logs: $LOG_DIR/uvicorn.log"
}

# 检查服务状态
check_status() {
    sleep 2

    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            log_info "Service is running (PID: $PID)"

            # 健康检查
            if command -v curl &> /dev/null; then
                if curl -s "http://localhost:$PORT/api/health" > /dev/null 2>&1; then
                    log_info "Health check passed"
                else
                    log_warn "Health check failed (service may still be starting)"
                fi
            fi

            return 0
        fi
    fi

    log_error "Service failed to start"
    return 1
}

# 主流程
main() {
    log_info "========================================="
    log_info "RPC Message Parser - Service Restart"
    log_info "========================================="
    log_info "Project Root: $PROJECT_ROOT"
    log_info "Backend Dir: $BACKEND_DIR"
    log_info "Host: $HOST:$PORT"
    log_info "========================================="

    stop_service
    start_service
    check_status

    log_info "========================================="
    log_info "Restart completed successfully!"
    log_info "========================================="
}

# 运行
main "$@"
