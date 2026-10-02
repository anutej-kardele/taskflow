#!/usr/bin/env bash

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT_DIR/.taskflow/logs"
PID_DIR="$ROOT_DIR/.taskflow/pids"

mkdir -p "$LOG_DIR"
mkdir -p "$PID_DIR"

echo ""
echo "========================================"
echo " TaskFlow"
echo " Distributed Job Processing System"
echo "========================================"
echo ""


# --------------------------------------------------
# Helpers
# --------------------------------------------------

is_process_running() {
    local pid_file="$1"

    if [ ! -f "$pid_file" ]; then
        return 1
    fi

    local pid
    pid="$(cat "$pid_file")"

    if kill -0 "$pid" 2>/dev/null; then
        return 0
    fi

    rm -f "$pid_file"

    return 1
}


wait_for_url() {
    local name="$1"
    local url="$2"
    local attempts="${3:-30}"

    echo "Waiting for $name..."

    for ((i = 1; i <= attempts; i++)); do

        if curl -fsS "$url" >/dev/null 2>&1; then
            echo "✓ $name is ready"
            return 0
        fi

        sleep 1
    done

    echo "✗ $name did not become ready"
    return 1
}


# --------------------------------------------------
# Docker infrastructure
# --------------------------------------------------

echo "[1/5] Starting MongoDB and Kafka..."

cd "$ROOT_DIR"

docker compose up -d mongodb kafka

echo ""
echo "Docker infrastructure:"
docker compose ps mongodb kafka

echo ""


# --------------------------------------------------
# Control plane
# --------------------------------------------------

CONTROL_PLANE_PID_FILE="$PID_DIR/control-plane.pid"

echo "[2/5] Starting Spring Boot control plane..."

if is_process_running "$CONTROL_PLANE_PID_FILE"; then

    CONTROL_PLANE_PID="$(cat "$CONTROL_PLANE_PID_FILE")"

    echo "✓ Control plane already running (PID $CONTROL_PLANE_PID)"

else

    cd "$ROOT_DIR/control-plane"

    nohup ./mvnw spring-boot:run \
        > "$LOG_DIR/control-plane.log" \
        2>&1 &

    CONTROL_PLANE_PID=$!

    echo "$CONTROL_PLANE_PID" \
        > "$CONTROL_PLANE_PID_FILE"

    echo "Control plane started (PID $CONTROL_PLANE_PID)"

fi

wait_for_url \
    "Control plane" \
    "http://localhost:8080/api/workloads" \
    60

echo ""


# --------------------------------------------------
# Distributed Go workers
# --------------------------------------------------

echo "[3/5] Starting Go worker containers..."

cd "$ROOT_DIR"

docker compose up -d \
    worker-a \
    worker-b \
    worker-c

echo ""

docker compose ps \
    worker-a \
    worker-b \
    worker-c

echo ""


# --------------------------------------------------
# Frontend
# --------------------------------------------------

FRONTEND_PID_FILE="$PID_DIR/frontend.pid"

echo "[4/5] Starting React frontend..."

if is_process_running "$FRONTEND_PID_FILE"; then

    FRONTEND_PID="$(cat "$FRONTEND_PID_FILE")"

    echo "✓ Frontend already running (PID $FRONTEND_PID)"

else

    cd "$ROOT_DIR/frontend"

    nohup npm run dev \
        > "$LOG_DIR/frontend.log" \
        2>&1 &

    FRONTEND_PID=$!

    echo "$FRONTEND_PID" \
        > "$FRONTEND_PID_FILE"

    echo "Frontend started (PID $FRONTEND_PID)"

fi

wait_for_url \
    "Frontend" \
    "http://localhost:5173" \
    30

echo ""


# --------------------------------------------------
# Final status
# --------------------------------------------------

echo "[5/5] TaskFlow status"
echo ""

cd "$ROOT_DIR"

docker compose ps

echo ""
echo "----------------------------------------"
echo " TaskFlow is running"
echo "----------------------------------------"
echo ""
echo "Frontend:"
echo "  http://localhost:5173"
echo ""
echo "Control Plane:"
echo "  http://localhost:8080"
echo ""
echo "MongoDB:"
echo "  localhost:27017"
echo ""
echo "Kafka:"
echo "  localhost:9092"
echo ""
echo "Worker containers:"
echo "  taskflow-worker-a"
echo "  taskflow-worker-b"
echo "  taskflow-worker-c"
echo ""
echo "Logs:"
echo "  $LOG_DIR/control-plane.log"
echo "  $LOG_DIR/frontend.log"
echo ""
echo "Worker logs:"
echo "  docker compose logs -f worker-a worker-b worker-c"
echo ""
echo "MongoDB data volume is preserved."
echo ""