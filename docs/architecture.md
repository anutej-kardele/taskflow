# TaskFlow Architecture

## System Overview

```text
React Dashboard
      |
      v
Spring Boot Control Plane
   |             |
   v             v
MongoDB        Kafka
                 |
          +------+------+
          |      |      |
          v      v      v
       Go W1   Go W2   Go W3

Redis is introduced later for worker heartbeats and fast shared state.
```

## Responsibilities

### React
- create workloads
- show workload and job status
- later show worker health and metrics

### Spring Boot
- validate workload requests
- generate IDs
- persist Workloads and Jobs
- publish jobs to Kafka
- expose query/status APIs
- later push SSE updates

### MongoDB
Durable Workload, Job, and execution state.

### Kafka
Asynchronous delivery of executable jobs. Initial topic: `taskflow.jobs`.

### Go Workers
Consume jobs, execute them, support concurrency, and later participate in retry/recovery behavior.

### Redis
Introduced later for worker heartbeats using TTL, then potentially leases, coordination, cached counters, and rate limiting.

## Ownership Rules

| Concern | Owner |
| --- | --- |
| HTTP API | Spring Boot |
| Workload creation | Spring Boot |
| Durable state | MongoDB |
| Job delivery | Kafka |
| Job execution | Go workers |
| Worker concurrency | Go workers |
| Worker heartbeats | Redis |
| Dashboard | React |
| Live browser updates | Spring Boot + SSE |

## Primary Workflow

```text
React -> POST /api/workloads
          |
          v
      Spring Boot
       /        \
      v          v
 MongoDB       Kafka
                |
                v
            Go Worker
                |
                v
             execute
                |
                v
             MongoDB
```

## First Kafka Contract

```json
{
  "jobId": "uuid",
  "workloadId": "uuid",
  "type": "SLEEP",
  "payload": { "durationMs": 3000 }
}
```

## Development Architecture

Phase 1: `Client -> Spring Boot -> MongoDB`

Phase 2: add Kafka publishing.

Phase 3: add one Go worker.

Later: multiple workers, Redis heartbeats, SSE, metrics, and Kubernetes.

## Architecture Principle

Every technology should be introduced because an observed engineering problem requires it—not just to make the stack larger.
