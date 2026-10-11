#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(
    cd "$(dirname "${BASH_SOURCE[0]}")/.." &&
    pwd
)"

cd "$ROOT_DIR"

echo ""
echo "========================================"
echo " Stopping TaskFlow"
echo "========================================"
echo ""

docker compose -p taskflow down

# Old host-process PID files are no longer used.
rm -f \
    .taskflow/pids/control-plane.pid \
    .taskflow/pids/frontend.pid

echo ""
echo "----------------------------------------"
echo " TaskFlow stopped safely"
echo "----------------------------------------"
echo ""
echo "Persistent Docker volumes were preserved."
echo ""
echo "MongoDB, Kafka, Grafana, and Tempo data"
echo "will remain available on the next start."
echo ""
