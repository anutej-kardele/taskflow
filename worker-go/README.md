# TaskFlow Go Worker

Go service responsible for executing jobs.

## Responsibilities

- consume Kafka jobs
- dispatch by JobType
- execute jobs
- support configurable concurrency
- graceful shutdown
- later retries/recovery/heartbeats

## First Milestone

Support only `SLEEP`:

```text
Kafka -> Go Worker -> RUNNING -> sleep -> COMPLETED
```

Later add `CPU`, `HTTP`, and `UNRELIABLE` executors.
