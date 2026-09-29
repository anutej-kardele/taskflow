# TaskFlow Control Plane

Java/Spring Boot backend for TaskFlow.

## Responsibilities

- REST APIs
- workload validation
- Workload and Job ID generation
- MongoDB persistence
- Kafka publishing
- status/query APIs
- later SSE updates

Do not execute CPU-heavy or long-running jobs here.

## Planned Stack

Java 21, Spring Boot, Spring Web, Spring Data MongoDB, Bean Validation, JUnit 5, Mockito, later Spring Kafka.

## First Milestone

Implement `POST /api/workloads` so a request such as Sleep x10 creates 1 Workload and 10 Job documents in MongoDB.

Do not add Kafka until this path works cleanly.
