#!/usr/bin/env bash

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_DIR="$ROOT_DIR/.taskflow/pids"

echo ""
echo "========================================"
echo " Stopping TaskFlow"
echo "========================================"
echo ""


# --------------------------------------------------
# Helpers
# --------------------------------------------------

stop_process() {
    local name="$1"
    local pid_file="$2"

    if [ ! -f "$pid_file" ]; then
        echo "$name is not tracked as running"
        return
    fi

    local pid
    pid="$(cat "$pid_file")"

    if kill -0 "$pid" 2>/dev/null; then
        echo "Stopping $name (PID $pid)..."

        kill "$pid" 2>/dev/null || true

        for _ in {1..10}; do
            if ! kill -0 "$pid" 2>/dev/null; then
                break
            fi

            sleep 1
        done

        if kill -0 "$pid" 2>/dev/null; then
            echo "Force stopping $name..."
            kill -9 "$pid" 2>/dev/null || true
        fi
    fi

    rm -f "$pid_file"

    echo "✓ $name stopped"
}


# --------------------------------------------------
# Frontend
# --------------------------------------------------

stop_process \
    "React frontend" \
    "$PID_DIR/frontend.pid"

echo ""


# --------------------------------------------------
# Workers
# --------------------------------------------------

echo "Stopping Go worker containers..."

cd "$ROOT_DIR"

docker compose stop \
    worker-a \
    worker-b \
    worker-c

echo "✓ Workers stopped"
echo ""


# --------------------------------------------------
# Control plane
# --------------------------------------------------

stop_process \
    "Spring Boot control plane" \
    "$PID_DIR/control-plane.pid"

echo ""


# --------------------------------------------------
# Observability
# --------------------------------------------------

echo "Stopping observability services..."

docker compose stop \
    grafana \
    prometheus \
    tempo

echo "✓ Observability services stopped"
echo ""


# --------------------------------------------------
# Supporting infrastructure
# --------------------------------------------------

echo "Stopping Kafka and Redis..."

docker compose stop \
    kafka \
    redis

echo "✓ Kafka and Redis stopped"
echo ""


# --------------------------------------------------
# MongoDB
# --------------------------------------------------

echo "MongoDB will remain running."
echo "Its persistent data volume is untouched."
echo ""

echo "No Docker volumes were removed."
echo ""


# --------------------------------------------------
# Final status
# --------------------------------------------------

docker compose ps

echo ""
echo "----------------------------------------"
echo " TaskFlow stopped safely"
echo "----------------------------------------"
echo ""