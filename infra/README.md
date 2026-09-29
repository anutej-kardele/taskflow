# TaskFlow Infrastructure

Infrastructure is introduced incrementally.

## Planned Order

- Phase 1: MongoDB
- Phase 2: MongoDB + Kafka
- Phase 3: MongoDB + Kafka + Go worker
- Later: Redis, multiple workers, Prometheus, Grafana

## Directory Intent

```text
infra/
├── docker/
├── kafka/
├── redis/
└── monitoring/
```

Avoid configuring infrastructure before the application actually needs it.
