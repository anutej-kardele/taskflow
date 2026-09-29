# TaskFlow Domain Model

This document defines the core objects and state transitions shared by the Java control plane, MongoDB documents, Kafka messages, Go workers, and React frontend.

## Workload

A **Workload** represents a batch of jobs requested together.

```json
{
  "id": "uuid",
  "jobType": "SLEEP",
  "jobCount": 1000,
  "status": "CREATED",
  "configuration": { "durationMs": 3000 },
  "createdAt": "timestamp"
}
```

Initial statuses: `CREATED`, `RUNNING`, `COMPLETED`, `FAILED`.

## Job

A **Job** is one independently executable unit of work belonging to a Workload.

```json
{
  "id": "uuid",
  "workloadId": "uuid",
  "type": "SLEEP",
  "status": "QUEUED",
  "attempt": 0,
  "payload": { "durationMs": 3000 },
  "createdAt": "timestamp",
  "startedAt": null,
  "completedAt": null,
  "workerId": null,
  "result": null,
  "error": null
}
```

Stable core fields: `id`, `workloadId`, `type`, `status`, `attempt`, `payload`, `createdAt`.

## Job Types

- `SLEEP`: waits for a configured duration.
- `CPU`: performs computation-heavy work.
- `HTTP`: calls an external HTTP API.
- `UNRELIABLE`: intentionally fails at a configurable rate.

## Job Status

```text
             +--> COMPLETED
             |
QUEUED --> RUNNING
             |
             +--> FAILED
```

Later phases may introduce `RETRYING`, `CANCELLED`, `DEAD_LETTERED`, and `TIMED_OUT`.

## Identity

Use application-generated UUIDs for Workloads and Jobs so IDs exist before persistence and Kafka publication and remain traceable across services.

## Relationship

A Job belongs to exactly one Workload. A Workload owns many Jobs.

## Initial Validation Rules

- `jobCount > 0`
- `jobType` must be known
- type-specific configuration must be valid
- Sleep duration must be positive
- Unreliable failure rate must be between `0.0` and `1.0`
- IDs must be unique

## Cross-Service Contract

Java classes, Kafka DTOs, Go structs, and TypeScript interfaces should all derive from this document rather than being independently invented.
