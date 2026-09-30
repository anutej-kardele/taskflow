# TaskFlow

TaskFlow is a learning-focused distributed background-job processing platform for creating workloads, distributing jobs across workers, observing execution in real time, and experimenting with concurrency, retries, failures, and recovery.

> **Current status:** Phase 0 — system design and contracts. The architecture below is the target design; most services are not implemented yet.

## Why This Project Exists

TaskFlow is being built to explore distributed-systems concepts through a concrete application rather than isolated demos.

- A **Workload** is a batch requested by a user, such as 1,000 Sleep jobs.
- A **Job** is one independently executable unit inside that workload.
- The control plane creates jobs and publishes them.
- Go workers consume and execute them.
- The dashboard shows what is happening across the system.

## Performance Benchmark

TaskFlow was benchmarked using 100 `SLEEP` jobs with a duration of 2000 ms per job.

| Worker Concurrency | Total Completion Time | Throughput | Speedup |
|-------------------:|----------------------:|-----------:|--------:|
| 1 | 206.047 s | 0.485 jobs/s | 1.00x |
| 5 | 51.597 s | 1.938 jobs/s | 3.99x |
| 10 | 30.890 s | 3.237 jobs/s | 6.67x |

Increasing worker concurrency significantly improved throughput. Moving from 1 to 5 workers produced approximately a 3.99x speedup, while 10 workers achieved approximately a 6.67x speedup.

The benchmark used a Kafka topic with 10 partitions so that up to 10 consumers in the worker group could receive work concurrently.


## Target Architecture

```text
                         React Dashboard
                                |
                                | REST / SSE
                                v
                     Spring Boot Control Plane
                        /        |         \
                       /         |          \
                      v          v           v
                  MongoDB      Kafka       Redis
                durable state  job bus   fast state
                                  |
                       +----------+----------+
                       |          |          |
                       v          v          v
                   Go Worker  Go Worker  Go Worker
```

Redis and live updates are intentionally introduced later. The first end-to-end milestone only needs Spring Boot, MongoDB, Kafka, and one Go worker.

## Core Job Types

| Job Type | Purpose |
| --- | --- |
| `SLEEP` | Simulates waiting or long-running I/O-like work |
| `CPU` | Generates computation-heavy work |
| `HTTP` | Calls an external HTTP API and processes the response |
| `UNRELIABLE` | Intentionally fails at a configurable rate to test retries |

## Planned Technology Stack

### Control Plane
- Java 21
- Spring Boot
- Spring Web
- Spring Data MongoDB
- Validation
- JUnit 5
- Mockito

### Workers
- Go
- Goroutines
- Channels / worker pools
- `context.Context`
- Graceful shutdown

### Infrastructure
- MongoDB
- Apache Kafka
- Redis
- Docker / Docker Compose
- Later: OpenTelemetry, Prometheus, Grafana, Kubernetes

### Frontend
- React
- Vite
- Tailwind CSS
- Initially REST polling
- Later Server-Sent Events (SSE)

## Repository Structure

```text
taskflow/
├── control-plane/          # Java / Spring Boot API and orchestration
├── worker-go/              # Go job execution service
├── frontend/               # React dashboard and workload generator
├── infra/                  # Infrastructure configuration
├── docs/                   # Architecture, domain model, development plan
├── docker-compose.yml      # Local multi-service environment
└── README.md
```

## Development Strategy

```text
Domain model
    ↓
Spring Boot + MongoDB
    ↓
Create workloads and jobs
    ↓
Kafka producer
    ↓
One Go worker
    ↓
SLEEP job end-to-end
    ↓
Worker concurrency
    ↓
CPU / HTTP / UNRELIABLE jobs
    ↓
React dashboard
    ↓
Retries
    ↓
Multiple Go workers
    ↓
Redis heartbeats
    ↓
SSE live updates
    ↓
Metrics / observability
    ↓
Failure experiments
    ↓
Kubernetes
```

## First End-to-End Milestone

A request for 10 Sleep jobs should create 10 Job records, publish 10 Kafka messages, allow one Go worker to execute them, and end with all 10 jobs marked `COMPLETED`.

## Documentation

- [Domain Model](docs/domain-model.md)
- [Architecture](docs/architecture.md)
- [Development Workflow](docs/TaskFlow_Development_Workflow.md)
- [Documentation Index](docs/README.md)
