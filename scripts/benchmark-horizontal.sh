#!/usr/bin/env bash

set -euo pipefail

JOB_COUNT="${1:-100}"
DURATION_MS="${2:-2000}"
RUNS="${3:-3}"

API_URL="${TASKFLOW_API_URL:-http://localhost:8080}"
SLOTS_PER_NODE="${TASKFLOW_SLOTS_PER_NODE:-3}"
REBALANCE_WAIT_SECONDS="${TASKFLOW_REBALANCE_WAIT_SECONDS:-5}"
BENCHMARK_TIMEOUT_SECONDS="${TASKFLOW_BENCHMARK_TIMEOUT_SECONDS:-600}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RESULT_DIR="$ROOT_DIR/.taskflow/benchmarks"
TIMESTAMP="$(date +"%Y%m%d-%H%M%S")"
RESULT_FILE="$RESULT_DIR/horizontal-scaling-$TIMESTAMP.csv"

mkdir -p "$RESULT_DIR"

now_ms() {
    python3 -c 'import time; print(time.time_ns() // 1_000_000)'
}

fail() {
    echo
    echo "ERROR: $1"
    echo
    exit 1
}

container_running() {
    local container_name="$1"
    docker ps --format '{{.Names}}' | grep -qx "$container_name"
}

check_workloads() {
    local workloads
    local running
    local created_count

    workloads="$(curl -fsS "$API_URL/api/workloads")"

    running="$(
        printf '%s' "$workloads" | python3 -c '
import json, sys
for w in json.load(sys.stdin):
    if w.get("status") == "RUNNING":
        print(w.get("id", "unknown"))
'
    )"

    created_count="$(
        printf '%s' "$workloads" | python3 -c '
import json, sys
print(sum(1 for w in json.load(sys.stdin) if w.get("status") == "CREATED"))
'
    )"

    if [ -n "$running" ]; then
        echo
        echo "Running workloads were found:"
        echo "$running" | sed 's/^/  /'
        fail "Wait for running workloads to finish before benchmarking."
    fi

    if [ "$created_count" -gt 0 ]; then
        echo
        echo "Note:"
        echo "$created_count historical CREATED workload(s) exist in MongoDB."
        echo "They will not block the benchmark unless they begin executing."
        echo
    fi
}

if ! [[ "$JOB_COUNT" =~ ^[0-9]+$ ]] || [ "$JOB_COUNT" -le 0 ]; then
    fail "job-count must be a positive integer"
fi

if ! [[ "$DURATION_MS" =~ ^[0-9]+$ ]] || [ "$DURATION_MS" -le 0 ]; then
    fail "duration-ms must be a positive integer"
fi

if ! [[ "$RUNS" =~ ^[0-9]+$ ]] || [ "$RUNS" -le 0 ]; then
    fail "runs must be a positive integer"
fi

if ! [[ "$SLOTS_PER_NODE" =~ ^[0-9]+$ ]] || [ "$SLOTS_PER_NODE" -le 0 ]; then
    fail "TASKFLOW_SLOTS_PER_NODE must be a positive integer"
fi

echo
echo "========================================"
echo "TaskFlow Horizontal Scaling Benchmark"
echo "========================================"
echo "Jobs             : $JOB_COUNT"
echo "Job duration     : ${DURATION_MS} ms"
echo "Slots per node   : $SLOTS_PER_NODE"
echo "Runs/config      : $RUNS"
echo "API              : $API_URL"
echo "========================================"
echo

cd "$ROOT_DIR"

if ! curl -fsS "$API_URL/api/workloads" >/dev/null 2>&1; then
    fail "TaskFlow control plane is not reachable. Run ./scripts/start.sh first."
fi

if ! container_running "taskflow-kafka"; then
    fail "Kafka is not running. Run ./scripts/start.sh first."
fi

if pgrep -f 'go run .*cmd/worker' >/dev/null 2>&1 || \
   pgrep -f '/tmp/go-build.*/exe/worker' >/dev/null 2>&1; then
    fail "A manually started Go worker appears to be running. Stop it before benchmarking."
fi

check_workloads

TOPIC_DESCRIPTION="$(
    docker exec taskflow-kafka \
        /opt/kafka/bin/kafka-topics.sh \
        --bootstrap-server localhost:9092 \
        --describe \
        --topic taskflow.jobs
)"

PARTITION_COUNT="$(
    printf '%s\n' "$TOPIC_DESCRIPTION" | awk '
        NR == 1 {
            for (i = 1; i <= NF; i++) {
                if ($i == "PartitionCount:") {
                    print $(i + 1)
                    exit
                }
            }
        }
    '
)"

if [ -z "$PARTITION_COUNT" ]; then
    fail "Could not determine Kafka partition count."
fi

echo "Kafka partitions : $PARTITION_COUNT"

MAX_SLOTS=$((3 * SLOTS_PER_NODE))
if [ "$PARTITION_COUNT" -lt "$MAX_SLOTS" ]; then
    echo
    echo "WARNING: Kafka has $PARTITION_COUNT partitions, but the largest"
    echo "benchmark configuration uses $MAX_SLOTS consumer slots."
    echo "Kafka partitions may limit scaling."
fi

echo

echo "nodes,total_slots,run,workload_id,total_seconds,jobs_per_second" > "$RESULT_FILE"

restore_workers() {
    echo
    echo "Restoring normal 3-node worker cluster..."
    cd "$ROOT_DIR"
    docker compose up -d worker-a worker-b worker-c >/dev/null 2>&1 || true
    echo "Workers restored."
}

trap restore_workers EXIT

configure_workers() {
    local node_count="$1"

    echo
    echo "Stopping existing worker containers..."
    docker compose stop worker-a worker-b worker-c >/dev/null 2>&1 || true

    case "$node_count" in
        1)
            echo "Starting worker-a..."
            docker compose up -d worker-a
            ;;
        2)
            echo "Starting worker-a + worker-b..."
            docker compose up -d worker-a worker-b
            ;;
        3)
            echo "Starting worker-a + worker-b + worker-c..."
            docker compose up -d worker-a worker-b worker-c
            ;;
        *)
            fail "Unsupported node count: $node_count"
            ;;
    esac

    echo "Waiting ${REBALANCE_WAIT_SECONDS}s for Kafka consumer-group rebalance..."
    sleep "$REBALANCE_WAIT_SECONDS"
}

run_benchmark() {
    local node_count="$1"
    local run_number="$2"
    local total_slots
    local start_ms response workload_id wait_start_ms
    local workload status current_ms elapsed_ms end_ms
    local metrics total_seconds jobs_per_second jobs

    total_slots=$((node_count * SLOTS_PER_NODE))

    echo
    echo "----------------------------------------"
    echo "Nodes       : $node_count"
    echo "Total slots : $total_slots"
    echo "Run         : $run_number/$RUNS"
    echo "----------------------------------------"

    start_ms="$(now_ms)"

    response="$(
        curl -fsS \
            -X POST "$API_URL/api/workloads" \
            -H "Content-Type: application/json" \
            -d "{\"jobType\":\"SLEEP\",\"jobCount\":$JOB_COUNT,\"configuration\":{\"durationMs\":$DURATION_MS}}"
    )"

    workload_id="$(
        printf '%s' "$response" | python3 -c '
import json, sys
print(json.load(sys.stdin)["id"])
'
    )"

    echo "Workload: $workload_id"
    echo "Waiting for completion..."

    wait_start_ms="$(now_ms)"

    while true; do
        workload="$(curl -fsS "$API_URL/api/workloads/$workload_id")"

        status="$(
            printf '%s' "$workload" | python3 -c '
import json, sys
print(json.load(sys.stdin)["status"])
'
        )"

        if [ "$status" = "COMPLETED" ]; then
            break
        fi

        if [ "$status" = "FAILED" ]; then
            fail "Benchmark workload $workload_id entered FAILED state."
        fi

        current_ms="$(now_ms)"
        elapsed_ms=$((current_ms - wait_start_ms))

        if [ "$elapsed_ms" -gt $((BENCHMARK_TIMEOUT_SECONDS * 1000)) ]; then
            fail "Benchmark timed out waiting for workload $workload_id."
        fi

        sleep 0.25
    done

    end_ms="$(now_ms)"

    metrics="$(
        python3 - "$start_ms" "$end_ms" "$JOB_COUNT" <<'PY'
import sys
start_ms = int(sys.argv[1])
end_ms = int(sys.argv[2])
job_count = int(sys.argv[3])
total_seconds = (end_ms - start_ms) / 1000.0
jobs_per_second = job_count / total_seconds
print(f"{total_seconds:.3f},{jobs_per_second:.3f}")
PY
    )"

    total_seconds="${metrics%%,*}"
    jobs_per_second="${metrics##*,}"

    echo
    echo "Result:"
    echo "  Time     : ${total_seconds}s"
    echo "  Jobs/sec : $jobs_per_second"

    jobs="$(curl -fsS "$API_URL/api/workloads/$workload_id/jobs")"

    echo
    echo "Node distribution:"
    printf '%s' "$jobs" | python3 -c '
import collections, json, sys
jobs = json.load(sys.stdin)
counts = collections.Counter()
for job in jobs:
    worker_id = job.get("workerId") or "unassigned"
    node_id = worker_id.rsplit("-slot-", 1)[0] if "-slot-" in worker_id else worker_id
    counts[node_id] += 1
for node_id in sorted(counts):
    print(f"  {node_id}: {counts[node_id]} jobs")
'

    echo "$node_count,$total_slots,$run_number,$workload_id,$total_seconds,$jobs_per_second" >> "$RESULT_FILE"
}

for NODE_COUNT in 1 2 3; do
    echo
    echo
    echo "========================================"
    echo "Testing $NODE_COUNT worker node(s)"
    echo "========================================"

    configure_workers "$NODE_COUNT"

    for ((RUN = 1; RUN <= RUNS; RUN++)); do
        run_benchmark "$NODE_COUNT" "$RUN"
    done
done

echo
echo
echo "========================================"
echo "Horizontal Scaling Summary"
echo "========================================"

python3 - "$RESULT_FILE" "$JOB_COUNT" <<'PY'
import csv
import statistics
import sys

result_file = sys.argv[1]
job_count = int(sys.argv[2])
groups = {}

with open(result_file, newline="") as file:
    for row in csv.DictReader(file):
        nodes = int(row["nodes"])
        slots = int(row["total_slots"])
        seconds = float(row["total_seconds"])
        groups.setdefault(nodes, {"slots": slots, "times": []})
        groups[nodes]["times"].append(seconds)

baseline = statistics.median(groups[1]["times"])

print()
print(f"{'Nodes':>5} {'Slots':>5} {'Median Time':>14} {'Jobs/sec':>12} {'Speedup':>10}")
print("-" * 52)

summary = []
for nodes in sorted(groups):
    slots = groups[nodes]["slots"]
    median_time = statistics.median(groups[nodes]["times"])
    throughput = job_count / median_time
    speedup = baseline / median_time
    summary.append((nodes, slots, median_time, throughput, speedup))
    print(f"{nodes:>5} {slots:>5} {median_time:>11.3f} s {throughput:>10.3f} {speedup:>9.2f}x")

print()
print("README-ready table:")
print()
print("| Worker Nodes | Total Slots | Median Completion Time | Throughput | Speedup |")
print("|-------------:|------------:|-----------------------:|-----------:|--------:|")
for nodes, slots, median_time, throughput, speedup in summary:
    print(f"| {nodes} | {slots} | {median_time:.3f} s | {throughput:.3f} jobs/s | {speedup:.2f}x |")
PY

echo
echo "Raw results:"
echo "  $RESULT_FILE"
echo
echo "Benchmark complete."
