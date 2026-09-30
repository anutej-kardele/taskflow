#!/usr/bin/env bash

set -euo pipefail

CONCURRENCY="${1:-}"
JOB_COUNT="${2:-100}"
DURATION_MS="${3:-2000}"

API_URL="${TASKFLOW_API_URL:-http://localhost:8080}"

if [ -z "$CONCURRENCY" ]; then
    echo "Usage: ./scripts/benchmark.sh <concurrency> [job-count] [duration-ms]"
    echo
    echo "Example:"
    echo "./scripts/benchmark.sh 5 100 2000"
    exit 1
fi

# macOS 'date' does not reliably provide millisecond timestamps,
# so Python gives us a precise cross-platform timestamp.
now_ms() {
    python3 -c 'import time; print(time.time_ns() // 1_000_000)'
}

echo
echo "========================================"
echo "TaskFlow Benchmark"
echo "========================================"
echo "Concurrency : $CONCURRENCY"
echo "Jobs        : $JOB_COUNT"
echo "Duration    : ${DURATION_MS} ms"
echo "========================================"
echo

#
# Start measuring immediately before the workload request.
#
# This makes the benchmark end-to-end:
#
# POST workload
#      ↓
# create Mongo jobs
#      ↓
# publish Kafka messages
#      ↓
# execute jobs
#      ↓
# workload COMPLETED
#
START_MS=$(now_ms)

RESPONSE=$(curl -fsS \
    -X POST "$API_URL/api/workloads" \
    -H "Content-Type: application/json" \
    -d "{
        \"jobType\": \"SLEEP\",
        \"jobCount\": $JOB_COUNT,
        \"configuration\": {
            \"durationMs\": $DURATION_MS
        }
    }")

WORKLOAD_ID=$(printf '%s' "$RESPONSE" | python3 -c '
import json
import sys

data = json.load(sys.stdin)
print(data["id"])
')

echo "Workload created: $WORKLOAD_ID"
echo "Waiting for completion..."

#
# Poll the workload until it reaches a terminal state.
#
while true; do

    WORKLOAD=$(curl -fsS \
        "$API_URL/api/workloads/$WORKLOAD_ID")

    STATUS=$(printf '%s' "$WORKLOAD" | python3 -c '
import json
import sys

data = json.load(sys.stdin)
print(data["status"])
')

    if [ "$STATUS" = "COMPLETED" ]; then
        break
    fi

    if [ "$STATUS" = "FAILED" ]; then
        echo
        echo "Benchmark failed: workload entered FAILED state."
        exit 1
    fi

    sleep 0.25
done

END_MS=$(now_ms)

#
# Calculate:
#
# total time = end - start
#
# throughput = jobs / total time
#
python3 - "$START_MS" "$END_MS" "$JOB_COUNT" "$CONCURRENCY" <<'PY'
import sys

start_ms = int(sys.argv[1])
end_ms = int(sys.argv[2])
job_count = int(sys.argv[3])
concurrency = int(sys.argv[4])

total_seconds = (end_ms - start_ms) / 1000.0
jobs_per_second = job_count / total_seconds

print()
print("========================================")
print("Benchmark Result")
print("========================================")
print(f"Concurrency       : {concurrency}")
print(f"Jobs              : {job_count}")
print(f"Total time        : {total_seconds:.3f} seconds")
print(f"Jobs/sec          : {jobs_per_second:.3f}")
print("========================================")
PY