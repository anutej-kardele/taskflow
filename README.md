# TaskFlow

TaskFlow is a distributed background-job processing platform built to explore distributed-systems concepts through a concrete end-to-end application.

Users create workloads from a React dashboard, a Spring Boot control plane persists and publishes jobs, Apache Kafka distributes work, and independent Go worker processes execute jobs concurrently. The system includes retry handling, leases, heartbeats, crash recovery, and horizontal worker scaling.

> **Current status:** Phase 8 complete — multi-worker execution, retries, lease-based crash recovery, Dockerized Go workers, and horizontal scaling are implemented. Redis-backed worker health is the next milestone.

---

## Why This Project Exists

TaskFlow is designed as a learning-focused distributed system rather than a collection of isolated demos.

The project explores questions such as:

- How should work be distributed across multiple independent worker processes?
- What happens when a worker crashes while executing a job?
- How can abandoned work be reclaimed safely?
- How should retries differ from infrastructure recovery?
- How does Kafka consumer-group behavior affect concurrency?
- How does throughput change when additional worker nodes are introduced?
- How should durable state and message delivery interact?

A **Workload** represents a batch of jobs requested by a user.

A **Job** represents one independently executable unit of work inside that workload.

---

## Current Architecture

```text
                         React Dashboard
                                |
                                | REST polling
                                v
                     Spring Boot Control Plane
                         /              \
                        /                \
                       v                  v
                   MongoDB              Kafka
                 durable state        job delivery
                                          |
                             +------------+------------+
                             |            |            |
                             v            v            v
                         Go Worker    Go Worker    Go Worker
                         worker-a     worker-b     worker-c
                             |            |            |
                             +------ lease heartbeats --+
                                      via REST
```

The current local development deployment is:

```text
React / Vite                 Host process
Spring Boot Control Plane    Host process

MongoDB                      Docker container
Apache Kafka                 Docker container

Go worker-a                  Docker container
Go worker-b                  Docker container
Go worker-c                  Docker container
```

All Go worker nodes participate in the same Kafka consumer group.

Each worker node currently runs three logical execution slots by default.

Redis-backed worker health and Server-Sent Events are planned for later phases.

---

# Project Setup - Local 

## Prerequisites

The current development setup expects:

- Docker / Docker Compose
- Java 21
- Node.js / npm
- Maven wrapper included in the control-plane project
- Python 3 for benchmark timing and reporting

---

## Start TaskFlow

From the repository root:

```bash
./scripts/start.sh
```

The launcher starts or verifies:

```text
MongoDB
Kafka
Spring Boot control plane
worker-a
worker-b
worker-c
React frontend
```

Once startup completes:

| Service | Address |
| --- | --- |
| React Dashboard | `http://localhost:5173` |
| Control Plane | `http://localhost:8080` |
| MongoDB | `localhost:27017` |
| Kafka | `localhost:9092` |

Worker containers communicate with Kafka through its internal Docker listener.

---

## Stop TaskFlow

```bash
./scripts/stop.sh
```

The stop script shuts down:

```text
React frontend
Spring Boot control plane
worker-a
worker-b
worker-c
Kafka
```

MongoDB remains running and its persistent volume is left untouched.

This allows workload and job history to survive normal development restarts.

Avoid deleting the MongoDB volume unless the database is intentionally being reset.

---

## Core Job Types

| Job Type | Purpose |
| --- | --- |
| `SLEEP` | Simulates waiting or long-running I/O-like work |
| `CPU` | Generates computation-heavy work |
| `HTTP` | Calls an external HTTP API and processes the response |
| `UNRELIABLE` | Intentionally fails at a configurable rate to exercise retry behavior |

---

## Job Lifecycle

A normal job moves through the system as follows:

```text
Workload created
      ↓
Job stored in MongoDB
      ↓
Kafka message published
      ↓
Worker receives message
      ↓
Worker claims job
      ↓
RUNNING
      ↓
Job executes
      ↓
COMPLETED
```

Current job states include:

```text
QUEUED
RUNNING
RETRYING
COMPLETED
FAILED
```

Workloads currently use:

```text
CREATED
RUNNING
COMPLETED
FAILED
```

---

## Worker Ownership and Leases

Kafka determines which consumer receives a message, but TaskFlow does not rely on Kafka delivery alone to determine job ownership.

Before executing a job, a worker must successfully claim it through the control plane.

A claim records information such as:

```text
workerId
attempt
startedAt
leaseUntil
```

The current lease duration is approximately 30 seconds.

While executing a job, the worker renews the lease approximately every 10 seconds.

```text
Kafka delivery
      ↓
claim job
      ↓
RUNNING
      ↓
leaseUntil assigned
      ↓
execute job
      ↓
heartbeat renews lease
      ↓
COMPLETED
```

This allows TaskFlow to distinguish an actively executing job from one abandoned by a failed worker.

---

## Crash Recovery

TaskFlow supports recovery when a worker disappears while owning a job.

```text
worker-b owns job
        ↓
job is RUNNING
        ↓
worker-b crashes
        ↓
heartbeats stop
        ↓
lease expires
        ↓
Kafka redistributes uncommitted work
        ↓
another worker receives the job
        ↓
expired lease allows reclaim
        ↓
attempt increments
        ↓
execution continues
```

A recovered job can therefore move from:

```text
attempt 1
worker-b-slot-2
```

to:

```text
attempt 2
worker-c-slot-3
```

without manual intervention.

---

## Crash-Recovery Experiment

TaskFlow was tested by force-killing a worker container while it owned long-running jobs.

Three jobs were actively executing on `worker-b` when the container was killed.

```text
worker-b
   │
   ├── Job A — attempt 1
   ├── Job B — attempt 1
   └── Job C — attempt 1
          │
          X
     worker killed
          │
          ↓
    heartbeats stop
          │
          ↓
      leases expire
          │
          ↓
    messages reassigned
          │
          ↓
       worker-c
          │
   ├── Job A — attempt 2
   ├── Job B — attempt 2
   └── Job C — attempt 2
          │
          ↓
       COMPLETED
```

The experiment verified:

- independent worker-process failure
- Kafka consumer-group reassignment
- heartbeat loss
- lease expiration
- abandoned-job reclamation
- attempt tracking
- recovery by another worker node
- duplicate-delivery protection
- worker rejoining after restart

---

## Duplicate Delivery Protection

Kafka delivery is not treated as proof that a job should execute again.

Workers check the durable job state in the control plane before execution.

If a stale Kafka message is received for a job that is already terminal:

```text
Kafka message received
        ↓
claim rejected
        ↓
job already COMPLETED / FAILED
        ↓
message committed
        ↓
no duplicate execution
```

This behavior was also observed during worker crash-recovery testing.

---

## Retry Behavior

Execution failures are handled separately from worker crashes.

The Go worker executes the job and reports failures to the Spring Boot control plane. The control plane owns the retry policy.

Current default behavior:

```text
Attempt 1 fails
      ↓
RETRYING
      ↓
~1 second delay
      ↓
requeued

Attempt 2 fails
      ↓
RETRYING
      ↓
~5 second delay
      ↓
requeued

Attempt 3 fails
      ↓
FAILED
```

The attempt counter increments when a worker successfully claims the job again rather than when a failure is reported.

This means the same attempt mechanism can represent both:

- application-level retry execution
- infrastructure recovery after lease expiration

while the reason for the new attempt remains distinguishable from the surrounding job state and error information.

---

## Workload Rollup

A workload is not considered terminal while jobs remain queued, running, or retrying.

The control plane determines workload status using the aggregate state of its jobs.

```text
All jobs terminal?
       |
       +-- No --> RUNNING
       |
       +-- Yes
             |
             +-- Any FAILED --> FAILED
             |
             +-- Otherwise --> COMPLETED
```

This prevents a workload from being marked `FAILED` prematurely while another job is still waiting for a retry.

---

# Performance Benchmarks

TaskFlow uses `SLEEP` jobs for concurrency benchmarks because their execution duration is predictable.

These benchmarks were performed on the local development environment and are intended to demonstrate scaling behavior rather than production performance.

---

## Single-Process Concurrency

The first benchmark measured the effect of increasing concurrency within the worker process.

Configuration:

```text
Jobs          100
Job type      SLEEP
Duration      2000 ms/job
Kafka         10 partitions
```

| Worker Concurrency | Total Completion Time | Throughput | Speedup |
|-------------------:|----------------------:|-----------:|--------:|
| 1 | 206.047 s | 0.485 jobs/s | 1.00x |
| 5 | 51.597 s | 1.938 jobs/s | 3.99x |
| 10 | 30.890 s | 3.237 jobs/s | 6.67x |

Increasing execution concurrency substantially improved throughput.

The scaling is not perfectly linear because job processing also includes message delivery, state transitions, HTTP calls to the control plane, database updates, and scheduling overhead.

---

## Horizontal Worker Scaling

A separate benchmark measured the effect of adding independent worker containers.

Configuration:

```text
Jobs                    100
Job type                SLEEP
Duration                2000 ms/job
Slots per worker node   3
Kafka partitions        10
Runs per configuration  3
Metric                   Median completion time
```

| Worker Nodes | Total Slots | Median Completion Time | Throughput | Speedup |
|-------------:|------------:|-----------------------:|-----------:|--------:|
| 1 | 3 | 86.029 s | 1.162 jobs/s | 1.00x |
| 2 | 6 | 53.533 s | 1.868 jobs/s | 1.61x |
| 3 | 9 | 51.193 s | 1.953 jobs/s | 1.68x |

The benchmark demonstrates that jobs are distributed across independent worker processes and that increasing worker capacity reduces overall workload completion time.

The largest improvement occurred when scaling from one node to two nodes.

Moving from two nodes to three nodes produced a smaller improvement, demonstrating that additional worker capacity does not provide perfectly linear speedup. Kafka partition assignment, scheduling, state-management overhead, coordination, and contention on the same physical development machine all affect scaling.

### Three-Node Distribution

Example distributions from the three benchmark runs:

```text
Run 1
worker-a: 29 jobs
worker-b: 39 jobs
worker-c: 32 jobs

Run 2
worker-a: 35 jobs
worker-b: 38 jobs
worker-c: 27 jobs

Run 3
worker-a: 25 jobs
worker-b: 53 jobs
worker-c: 22 jobs
```

Kafka assigns partitions among consumers rather than guaranteeing an equal number of jobs per worker, so uneven distribution between nodes is expected.

---

## Technology Stack

### Control Plane

- Java 21
- Spring Boot
- Spring Web
- Spring Data MongoDB
- Bean Validation
- Maven
- JUnit 5
- Mockito

### Workers

- Go
- Goroutines
- Kafka consumer groups
- `context.Context`
- concurrent execution slots
- lease heartbeats
- graceful shutdown
- Docker

### Infrastructure

Implemented:

- MongoDB
- Apache Kafka
- Docker
- Docker Compose

Planned:

- Redis
- OpenTelemetry
- Prometheus
- Grafana
- Kubernetes

### Frontend

Implemented:

- React
- Vite
- Tailwind CSS
- REST polling

Planned:

- Server-Sent Events

---

## API

### Workloads

Create a workload:

```http
POST /api/workloads
```

List workloads:

```http
GET /api/workloads
```

Get one workload:

```http
GET /api/workloads/{id}
```

Get jobs belonging to a workload:

```http
GET /api/workloads/{id}/jobs
```

### Jobs

Get a job:

```http
GET /api/jobs/{id}
```

Claim a job:

```http
POST /api/jobs/{id}/claim
```

Renew a job lease:

```http
PATCH /api/jobs/{id}/lease
```

Update job status:

```http
PATCH /api/jobs/{id}/status
```

Report an execution failure:

```http
PATCH /api/jobs/{id}/failure
```

---

## Example Workload

Create 20 `SLEEP` jobs:

```bash
curl -X POST http://localhost:8080/api/workloads \
  -H "Content-Type: application/json" \
  -d '{
    "jobType": "SLEEP",
    "jobCount": 20,
    "configuration": {
      "durationMs": 2000
    }
  }'
```

Example response:

```json
{
  "id": "0e82428a-d010-4d81-908f-4444b9971750",
  "jobType": "SLEEP",
  "jobCount": 20,
  "status": "CREATED",
  "configuration": {
    "durationMs": 2000
  }
}
```

---

## Repository Structure

```text
taskflow/
├── control-plane/
│   └── Spring Boot API and orchestration
│
├── worker-go/
│   └── Go job execution service
│
├── frontend/
│   └── React dashboard and workload composer
│
├── docs/
│   └── Architecture and development documentation
│
├── scripts/
│   ├── start.sh
│   ├── stop.sh
│   ├── benchmark.sh
│   └── benchmark-horizontal.sh
│
├── docker-compose.yml
└── README.md
```

---

# Benchmarking

## Worker-Concurrency Benchmark

Run:

```bash
./scripts/benchmark.sh <concurrency> [job-count] [duration-ms]
```

Example:

```bash
./scripts/benchmark.sh 5 100 2000
```

This benchmark measures concurrency within a worker process.

---

## Horizontal-Scaling Benchmark

Run:

```bash
./scripts/benchmark-horizontal.sh [job-count] [duration-ms] [runs]
```

Example:

```bash
./scripts/benchmark-horizontal.sh 100 2000 3
```

The benchmark automatically evaluates:

```text
1 worker node
    ↓
3 execution slots

2 worker nodes
    ↓
6 execution slots

3 worker nodes
    ↓
9 execution slots
```

For each configuration it:

1. stops the existing worker containers
2. starts the required worker nodes
3. waits for Kafka consumer-group rebalance
4. submits a benchmark workload
5. waits for completion
6. measures completion time and throughput
7. records worker-node distribution
8. stores the raw results as CSV
9. restores the normal three-node worker cluster on exit

Generated benchmark files are stored under:

```text
.taskflow/benchmarks/
```

The `.taskflow/` directory is intended to remain local and should not be committed.

---

# Development Progress

```text
Domain model                           ✅
        ↓
Spring Boot + MongoDB                  ✅
        ↓
Workload and job creation              ✅
        ↓
Kafka producer                         ✅
        ↓
Go worker                              ✅
        ↓
SLEEP end-to-end execution             ✅
        ↓
Concurrent worker slots                ✅
        ↓
CPU / HTTP / UNRELIABLE executors      ✅
        ↓
React dashboard                        ✅
        ↓
Retry policy and backoff               ✅
        ↓
Leases and heartbeats                  ✅
        ↓
Worker crash recovery                  ✅
        ↓
Multiple independent workers           ✅
        ↓
Dockerized horizontal scaling          ✅
        ↓
Redis-backed worker health             ← next
        ↓
Server-Sent Events
        ↓
Metrics and observability
        ↓
Additional failure experiments
        ↓
Full Dockerized stack
        ↓
Kubernetes
```

---

## Current Capabilities

TaskFlow currently supports:

- workload creation
- individual job persistence
- Kafka-based job delivery
- multiple job types
- configurable concurrent execution
- multiple independent Go worker processes
- Dockerized worker nodes
- Kafka consumer-group balancing
- durable MongoDB state
- atomic job claiming
- worker ownership
- execution leases
- periodic lease heartbeats
- recovery after abrupt worker failure
- retry delays and maximum-attempt handling
- terminal job failure
- duplicate-delivery protection
- workload-level state aggregation
- React workload creation
- workload and job inspection
- execution progress
- retry visibility
- horizontal-scaling benchmarks
- safe local start/stop scripts

---

# Current Limitations

TaskFlow is currently a learning and experimentation platform rather than a production job-processing system.

Known limitations include:

### MongoDB and Kafka are not transactional together

A job-state update and Kafka publish are separate operations.

A crash between those operations can leave durable state and message state inconsistent.

For example:

```text
MongoDB update succeeds
        ↓
process crashes
        ↓
Kafka publish never occurs
```

A transactional outbox or reconciliation mechanism could address this in a later phase.

### Worker health is not yet explicitly tracked

Job records contain worker ownership, but the system does not yet maintain a dedicated live registry of worker nodes.

Redis-backed worker health is the next planned phase.

### Dashboard updates use polling

The frontend periodically retrieves state through REST.

Server-Sent Events are planned to provide push-based updates.

### Local workers share one physical machine

The Go workers are independent processes and Docker containers, but all currently run on the same development computer.

This means they have separate process failure boundaries but still share the same physical host failure domain.

### Benchmark results are environment-specific

The benchmark results demonstrate behavior in the local development environment.

They should not be interpreted as production capacity or production-performance measurements.

---

## Documentation

Additional project documentation:

- [Domain Model](docs/domain-model.md)
- [Architecture](docs/architecture.md)
- [Development Workflow](docs/TaskFlow_Development_Workflow.md)
- [Documentation Index](docs/README.md)