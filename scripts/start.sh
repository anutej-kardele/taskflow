#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(
    cd "$(dirname "${BASH_SOURCE[0]}")/.." &&
    pwd
)"

cd "$ROOT_DIR"

echo ""
echo "========================================"
echo " TaskFlow"
echo " Distributed Job Processing System"
echo "========================================"
echo ""

wait_for_url() {
    local name="$1"
    local url="$2"
    local attempts="${3:-60}"

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

wait_for_container_health() {
    local name="$1"
    local container="$2"
    local attempts="${3:-60}"
    local status

    echo "Waiting for $name health..."

    for ((i = 1; i <= attempts; i++)); do
        status="$(
            docker inspect \
                -f '{{.State.Health.Status}}' \
                "$container" \
                2>/dev/null || true
        )"

        if [ "$status" = "healthy" ]; then
            echo "✓ $name is healthy"
            return 0
        fi

        sleep 1
    done

    echo "✗ $name did not become healthy"
    return 1
}

echo "[1/3] Building and starting TaskFlow..."
echo ""

docker compose -p taskflow up -d --build

echo ""

echo "[2/3] Waiting for services..."
echo ""

wait_for_url \
    "Control plane" \
    "http://localhost:8080/actuator/health" \
    90

wait_for_url \
    "Frontend" \
    "http://localhost:5173" \
    90

wait_for_container_health \
    "Frontend" \
    "taskflow-frontend" \
    60

wait_for_url \
    "Prometheus" \
    "http://localhost:9090/-/ready" \
    90

wait_for_url \
    "Tempo" \
    "http://localhost:3200/ready" \
    90

wait_for_url \
    "Grafana" \
    "http://localhost:3000/api/health" \
    90

wait_for_url \
    "Worker API" \
    "http://localhost:5173/api/workers" \
    90

echo ""

echo "[3/3] TaskFlow status"
echo ""

docker compose ps

echo ""
echo "----------------------------------------"
echo " TaskFlow is running"
echo "----------------------------------------"
echo ""
echo "Application:"
echo "  Frontend:       http://localhost:5173"
echo "  Control Plane:  http://localhost:8080"
echo ""
echo "Observability:"
echo "  Grafana:        http://localhost:3000"
echo "  Prometheus:     http://localhost:9090"
echo "  Tempo:          http://localhost:3200"
echo ""
echo "Infrastructure:"
echo "  MongoDB:        localhost:27017"
echo "  Kafka:          localhost:9092"
echo "  Redis:          localhost:6379"
echo ""
echo "Logs:"
echo "  docker compose -p taskflow logs -f"
echo ""
echo "Worker logs:"
echo "  docker compose -p taskflow logs -f worker-a worker-b worker-c"
echo ""
echo "Persistent Docker volumes are preserved."
echo ""
