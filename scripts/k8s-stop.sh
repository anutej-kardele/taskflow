#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

CONTEXT="kind-taskflow-k8s"
NAMESPACE="taskflow"
K=(kubectl --context "$CONTEXT")

info() { printf '\n==> %s\n' "$*"; }
die() { printf 'Error: %s\n' "$*" >&2; exit 1; }
command -v kubectl >/dev/null 2>&1 || die "kubectl is required."
"${K[@]}" cluster-info >/dev/null 2>&1 || die "Kind cluster is not reachable; nothing changed."
"${K[@]}" -n "$NAMESPACE" get pod mongodb-0 >/dev/null 2>&1 || die "MongoDB is not running; nothing changed."

# Never shut down Kafka and MongoDB while unfinished jobs remain.
info "Checking for unfinished jobs"
active_jobs="$("${K[@]}" -n "$NAMESPACE" exec mongodb-0 -- \
  mongosh --quiet --eval \
  'db.getSiblingDB("taskflow").jobs.countDocuments({status:{$in:["QUEUED","RUNNING","RETRYING"]}})' \
  | tr -d '[:space:]')" || die "Unable to check MongoDB job states; refusing to stop."
[[ "$active_jobs" =~ ^[0-9]+$ ]] || die "Unexpected MongoDB response: $active_jobs"
if (( active_jobs > 0 )); then
  die "$active_jobs jobs are still QUEUED/RUNNING/RETRYING. Wait until workloads finish. Nothing changed."
fi

info "Pausing KEDA and draining Go workers"
"${K[@]}" -n "$NAMESPACE" annotate scaledobject/taskflow-worker-autoscaler \
  autoscaling.keda.sh/paused-replicas='0' --overwrite

# The worker has a 240-second Kubernetes termination grace period.
for ((i=0; i<150; i++)); do
  remaining="$("${K[@]}" -n "$NAMESPACE" get pods -l app=taskflow-worker -o name | wc -l | tr -d ' ')"
  if [[ "$remaining" == "0" ]]; then
    break
  fi
  sleep 2
done
remaining="$("${K[@]}" -n "$NAMESPACE" get pods -l app=taskflow-worker -o name | wc -l | tr -d ' ')"
[[ "$remaining" == "0" ]] || die "Workers still terminating after 300 seconds; infrastructure has been left running."

info "Stopping application and infrastructure Pods"
for item in deployment/frontend deployment/control-plane deployment/tempo deployment/redis \
            statefulset/kafka statefulset/mongodb; do
  "${K[@]}" -n "$NAMESPACE" scale "$item" --replicas=0
done

# Wait for the Pod deletions to complete; StatefulSet PVCs stay attached to the cluster.
for ((i=0; i<150; i++)); do
  remaining="$("${K[@]}" -n "$NAMESPACE" get pods -o name | wc -l | tr -d ' ')"
  if [[ "$remaining" == "0" ]]; then
    break
  fi
  sleep 2
done
remaining="$("${K[@]}" -n "$NAMESPACE" get pods -o name | wc -l | tr -d ' ')"
[[ "$remaining" == "0" ]] || die "Some Pods did not terminate; check kubectl get pods -n taskflow."

info "Stopping local port-forward (if it belongs to TaskFlow)"
PID_FILE=".taskflow/pids/k8s-frontend.pid"
if [[ -f "$PID_FILE" ]]; then
  pid="$(cat "$PID_FILE")"
  if [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null && \
     ps -p "$pid" -o command= 2>/dev/null | grep -q 'port-forward.*frontend'; then
    kill "$pid" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
fi

printf '\nTaskFlow Pods are scaling to zero.\n'
printf 'MongoDB/Kafka PVCs and the kind cluster are preserved.\n'
printf 'KEDA remains installed; autoscaling is paused.\n'
printf 'Restart: ./scripts/k8s-up.sh --no-build\n'
printf 'Note: This does NOT stop Docker Desktop or the kind node itself.\n'
