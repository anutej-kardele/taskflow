#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

CLUSTER="taskflow-k8s"
CONTEXT="kind-${CLUSTER}"
NAMESPACE="taskflow"
PORT="15173"
K=(kubectl --context "$CONTEXT")
NO_BUILD=false

if [[ "${1:-}" == "--no-build" ]]; then
  NO_BUILD=true
elif [[ $# -gt 0 ]]; then
  echo "Usage: $0 [--no-build]" >&2
  exit 2
fi

info() { printf '\n==> %s\n' "$*"; }
die() { printf 'Error: %s\n' "$*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "Missing $1"; }

for tool in docker kind kubectl helm curl awk; do need "$tool"; done
docker info >/dev/null 2>&1 || die "Docker Desktop is not running."
for file in namespace configmaps mongodb kafka redis tempo-config tempo control-plane worker frontend worker-autoscaler; do
  [[ -f "k8s/${file}.yaml" ]] || die "Missing k8s/${file}.yaml"
done

# Use the exact image tags specified in the user's manifests.
image_from_manifest() {
  awk '/^[[:space:]]*image:[[:space:]]*taskflow-/ { print $2; exit }' "$1"
}

CONTROL_IMAGE="$(image_from_manifest k8s/control-plane.yaml)"
WORKER_IMAGE="$(image_from_manifest k8s/worker.yaml)"
FRONTEND_IMAGE="$(image_from_manifest k8s/frontend.yaml)"
[[ -n "$CONTROL_IMAGE" && -n "$WORKER_IMAGE" && -n "$FRONTEND_IMAGE" ]] || die "Could not determine TaskFlow images from k8s YAML files."

info "Checking cluster ${CLUSTER}"
if ! kind get clusters | grep -Fxq "$CLUSTER"; then
  kind create cluster --name "$CLUSTER" --wait 180s
fi
"${K[@]}" wait --for=condition=Ready node --all --timeout=180s

info "Applying namespace and ConfigMaps"
"${K[@]}" apply -f k8s/namespace.yaml
"${K[@]}" apply -f k8s/configmaps.yaml
"${K[@]}" apply -f k8s/tempo-config.yaml

info "Starting MongoDB, Kafka, Redis, and Tempo"
for component in mongodb kafka redis tempo; do
  "${K[@]}" apply -f "k8s/${component}.yaml"
done
"${K[@]}" -n "$NAMESPACE" scale statefulset/mongodb --replicas=1
"${K[@]}" -n "$NAMESPACE" scale statefulset/kafka --replicas=1
"${K[@]}" -n "$NAMESPACE" scale deployment/redis --replicas=1
"${K[@]}" -n "$NAMESPACE" scale deployment/tempo --replicas=1
"${K[@]}" -n "$NAMESPACE" rollout status statefulset/mongodb --timeout=300s
"${K[@]}" -n "$NAMESPACE" rollout status statefulset/kafka --timeout=300s
"${K[@]}" -n "$NAMESPACE" rollout status deployment/redis --timeout=180s
"${K[@]}" -n "$NAMESPACE" rollout status deployment/tempo --timeout=180s

info "Ensuring 36-partition Kafka topic exists"
"${K[@]}" -n "$NAMESPACE" exec kafka-0 -- \
  /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server kafka.taskflow.svc.cluster.local:9092 \
  --create --if-not-exists --topic taskflow.jobs --partitions 36 --replication-factor 1

info "Installing KEDA if necessary"
if ! helm --kube-context "$CONTEXT" -n keda status keda >/dev/null 2>&1; then
  helm repo add kedacore https://kedacore.github.io/charts --force-update
  helm repo update kedacore
  helm --kube-context "$CONTEXT" upgrade --install keda kedacore/keda \
    --namespace keda --create-namespace --wait --timeout 5m
fi

info "Building and loading application images"
for spec in "control-plane:$CONTROL_IMAGE" "worker-go:$WORKER_IMAGE" "frontend:$FRONTEND_IMAGE"; do
  directory="${spec%%:*}"
  image="${spec#*:}"
  if [[ "$NO_BUILD" == false ]]; then
    docker build -t "$image" "./$directory"
  else
    docker image inspect "$image" >/dev/null 2>&1 || die "Image $image is not available locally; omit --no-build."
  fi
  kind load docker-image "$image" --name "$CLUSTER"
done

info "Starting TaskFlow services"
for component in control-plane frontend worker; do
  "${K[@]}" apply -f "k8s/${component}.yaml"
done
"${K[@]}" -n "$NAMESPACE" scale deployment/control-plane --replicas=1
"${K[@]}" -n "$NAMESPACE" scale deployment/frontend --replicas=1
"${K[@]}" -n "$NAMESPACE" rollout status deployment/control-plane --timeout=240s
"${K[@]}" -n "$NAMESPACE" rollout status deployment/frontend --timeout=180s

info "Enabling Kafka autoscaling (3 to 10 worker Pods)"
"${K[@]}" apply -f k8s/worker-autoscaler.yaml
# Stop script uses these annotations to suspend KEDA; remove them on startup.
"${K[@]}" -n "$NAMESPACE" annotate scaledobject/taskflow-worker-autoscaler \
  autoscaling.keda.sh/paused- autoscaling.keda.sh/paused-replicas- \
  --overwrite >/dev/null 2>&1 || true
# HPA may need a few cycles to restore minReplicaCount=3 after a stop.
workers_ready=false
for ((i=0; i<120; i++)); do
  worker_count="$("${K[@]}" -n "$NAMESPACE" get deployment taskflow-worker \
    -o jsonpath='{.status.readyReplicas}' 2>/dev/null || true)"
  if [[ "$worker_count" =~ ^[0-9]+$ ]] && (( worker_count >= 3 )); then
    workers_ready=true
    break
  fi
  sleep 2
done
[[ "$workers_ready" == true ]] || die "Go worker Deployment did not return to at least 3 healthy replicas."
"${K[@]}" -n "$NAMESPACE" rollout status deployment/taskflow-worker --timeout=240s

info "Starting local frontend port-forward on http://localhost:${PORT}"
mkdir -p .taskflow/pids
PID_FILE=".taskflow/pids/k8s-frontend.pid"
LOG_FILE=".taskflow/k8s-port-forward.log"
if [[ -f "$PID_FILE" ]]; then
  old_pid="$(cat "$PID_FILE")"
  if [[ "$old_pid" =~ ^[0-9]+$ ]] && kill -0 "$old_pid" 2>/dev/null && \
     ps -p "$old_pid" -o command= 2>/dev/null | grep -q 'port-forward.*frontend'; then
    if ! curl -fsS "http://127.0.0.1:${PORT}/" >/dev/null 2>&1; then
      kill "$old_pid" 2>/dev/null || true
      rm -f "$PID_FILE"
    fi
  else
    rm -f "$PID_FILE"
  fi
fi
if [[ ! -f "$PID_FILE" ]] && curl -fsS "http://127.0.0.1:${PORT}/api/workers" >/dev/null 2>&1; then
  info "Found an existing working port-forward on ${PORT}; leaving it untouched"
fi
if [[ ! -f "$PID_FILE" ]] && ! curl -fsS "http://127.0.0.1:${PORT}/api/workers" >/dev/null 2>&1; then
  nohup "${K[@]}" -n "$NAMESPACE" port-forward --address 127.0.0.1 \
    service/frontend "${PORT}:80" >"$LOG_FILE" 2>&1 </dev/null &
  echo "$!" > "$PID_FILE"
fi
ready=false
for ((i=0; i<30; i++)); do
  if curl -fsS "http://127.0.0.1:${PORT}/api/workers" >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 2
done
if [[ "$ready" != true ]]; then
  echo "Port-forward output:" >&2
  tail -n 20 "$LOG_FILE" >&2 || true
  die "Frontend not reachable on http://localhost:${PORT}; port ${PORT} might already be in use."
fi

info "TaskFlow is ready"
"${K[@]}" -n "$NAMESPACE" get deploy,sts,scaledobject
printf '\nDashboard: http://localhost:%s\n' "$PORT"
printf 'Stop safely: ./scripts/k8s-stop.sh\n'
printf 'Resume quickly: ./scripts/k8s-up.sh --no-build\n'
printf 'No PVCs or data are deleted.\n'
