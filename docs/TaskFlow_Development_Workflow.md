# TaskFlow — Development Workflow

> A staged development plan for building a distributed background-job processing platform with **React, Java/Spring Boot, MongoDB, Kafka, Redis, and Go**.

The most important rule for this project:

> **Do not build the distributed system all at once.**  
> First prove one job can travel through the entire system. Then add scale, failures, retries, live monitoring, and infrastructure one layer at a time.

---

## Final Target Architecture

```text
                    React Dashboard
                           |
                           v
                 Spring Boot Control Plane
                           |
            +--------------+--------------+
            |              |              |
            v              v              v
         MongoDB          Kafka          Redis
      durable state     job delivery   fast state
                           |
                  +--------+--------+
                  |        |        |
                  v        v        v
              Go Worker Go Worker Go Worker
```

### Initial Job Types

1. `SLEEP` — simulates slow/waiting work
2. `CPU` — performs computation-heavy work
3. `HTTP` — calls a public external API
4. `UNRELIABLE` — intentionally fails sometimes so retries can be tested

---

# Recommended Repository Structure

For the first version, use **one repository** so all services, Docker configuration, and documentation stay synchronized.

```text
taskflow/
│
├── frontend/                 # React + Vite + Tailwind
│
├── control-plane/            # Java 21 + Spring Boot
│
├── worker-go/                # Go worker service
│
├── infra/
│   ├── docker/
│   ├── kafka/
│   ├── redis/
│   └── monitoring/
│
├── docs/
│   ├── architecture.md
│   ├── api.md
│   └── decisions/
│
├── docker-compose.yml
├── README.md
└── .gitignore
```

You can split services into separate repositories later if there is a strong reason. Early on, a monorepo will make development much easier.

---

# Phase 0 — Define the System Before Coding

## Goal

Agree on the minimum system you are building.

Do **not** start with Kubernetes, Redis, Grafana, multiple Kafka topics, authentication, or ten job types.

### Define the core objects

#### Workload

A workload is a batch created by the user.

Example:

```json
{
  "id": "workload-123",
  "jobType": "SLEEP",
  "jobCount": 1000,
  "status": "RUNNING",
  "configuration": {
    "durationMs": 3000
  }
}
```

#### Job

A job is one individual unit of work.

```json
{
  "id": "job-456",
  "workloadId": "workload-123",
  "type": "SLEEP",
  "status": "QUEUED",
  "attempt": 0,
  "payload": {
    "durationMs": 3000
  }
}
```

### Initial job states

```text
QUEUED
  |
  v
RUNNING
  |
  +------> COMPLETED
  |
  +------> FAILED
```

Later:

```text
FAILED -> RETRYING -> RUNNING
```

### Phase 0 completion checklist

- [ ] Decide project name: `TaskFlow`
- [ ] Create GitHub repository
- [ ] Create folder structure
- [ ] Write the initial architecture diagram into `/docs`
- [ ] Define `Workload`
- [ ] Define `Job`
- [ ] Define job statuses
- [ ] Define the first four job types
- [ ] Commit: `initialize TaskFlow project structure`

---

# Phase 1 — Build the Spring Boot Control Plane

## Goal

Build the backend API first **without Kafka or Go workers**.

At this stage, TaskFlow only accepts workloads and stores them.

### Build

Create:

```text
control-plane/
```

Use:

- Java 21
- Spring Boot
- Spring Web
- Spring Data MongoDB
- Validation
- JUnit 5
- Mockito

### Connect MongoDB

Start MongoDB locally with Docker.

Create collections:

```text
workloads
jobs
```

### Build the first API

```http
POST /api/workloads
```

Request:

```json
{
  "jobType": "SLEEP",
  "jobCount": 10,
  "configuration": {
    "durationMs": 3000
  }
}
```

The API should:

1. Validate the request.
2. Create one `Workload`.
3. Create 10 `Job` documents.
4. Give every job status `QUEUED`.
5. Store everything in MongoDB.
6. Return the workload ID.

Response:

```json
{
  "workloadId": "abc123",
  "jobsCreated": 10,
  "status": "CREATED"
}
```

### Add read APIs

```http
GET /api/workloads
GET /api/workloads/{id}
GET /api/workloads/{id}/jobs
GET /api/jobs/{id}
```

### Do NOT build yet

- Kafka
- Redis
- Go workers
- WebSockets
- retries
- Kubernetes

### Phase 1 success test

Send:

```text
Sleep x10
```

and verify MongoDB contains:

```text
1 workload
10 queued jobs
```

### Phase 1 completion checklist

- [ ] Spring Boot starts
- [ ] MongoDB connection works
- [ ] Workload model exists
- [ ] Job model exists
- [ ] `POST /workloads` works
- [ ] Job records are generated
- [ ] Read APIs work
- [ ] Validation exists
- [ ] Basic unit tests exist

---

# Phase 2 — Add Kafka

## Goal

Jobs should now become messages that workers can eventually consume.

Run Kafka through Docker Compose.

At first, use **one topic**:

```text
taskflow.jobs
```

Do not create separate topics for every job type yet.

### Updated workflow

```text
POST workload
      |
      v
Spring Boot
      |
      +------> MongoDB
      |
      +------> Kafka
```

When a workload creates 10 jobs:

```text
MongoDB:
10 Job documents

Kafka:
10 Job messages
```

Example message:

```json
{
  "jobId": "job-456",
  "workloadId": "workload-123",
  "type": "SLEEP",
  "payload": {
    "durationMs": 3000
  }
}
```

### Phase 2 success test

Create:

```text
Sleep x100
```

Verify:

```text
MongoDB -> 100 jobs
Kafka   -> 100 messages published
```

You still do not need a worker yet.

### Phase 2 completion checklist

- [ ] Kafka runs locally
- [ ] Spring Kafka configured
- [ ] Job event DTO created
- [ ] Every new job is published
- [ ] Publishing failures are logged
- [ ] Integration test verifies message publishing

---

# Phase 3 — Build the First Go Worker

## Goal

Get **one SLEEP job** through the complete system.

This is the first major milestone.

Create:

```text
worker-go/
```

The worker should:

1. Connect to Kafka.
2. Consume a job.
3. Read the job type.
4. Execute the job.
5. Update its status.

For the first implementation, support **only `SLEEP`**.

Example:

```text
Job received
   |
   v
status = RUNNING
   |
   v
sleep 3 seconds
   |
   v
status = COMPLETED
```

### First true end-to-end test

Trigger:

```text
Sleep x10
```

Expected result:

```text
React: not built yet

Spring Boot
  -> creates 10 jobs
  -> publishes 10 Kafka messages

Go Worker
  -> consumes 10 jobs
  -> sleeps
  -> completes jobs

MongoDB
  -> all 10 eventually become COMPLETED
```

This is the **first point where TaskFlow actually works**.

### Phase 3 completion checklist

- [ ] Go module created
- [ ] Kafka consumer works
- [ ] Worker handles `SLEEP`
- [ ] Job changes to `RUNNING`
- [ ] Job changes to `COMPLETED`
- [ ] Worker logs job ID and execution duration
- [ ] Graceful shutdown works

---

# Phase 4 — Add Go Worker Concurrency

## Goal

One worker should execute multiple jobs concurrently.

Use Go features deliberately:

- goroutines
- channels
- `context.Context`
- worker pools
- graceful shutdown

Start with:

```text
worker concurrency = 5
```

Architecture:

```text
Kafka Consumer
      |
      v
   Job Channel
      |
 +----+----+----+----+----+
 |    |    |    |    |    |
 v    v    v    v    v    v
 W1   W2   W3   W4   W5
```

### Experiment

Create:

```text
100 Sleep Jobs
duration = 2 seconds
```

Run tests with:

```text
Concurrency 1
Concurrency 5
Concurrency 10
```

Record:

- total completion time
- jobs/sec
- average job duration

### Phase 4 completion checklist

- [ ] Worker pool implemented
- [ ] Concurrency configurable through environment variable
- [ ] Worker handles shutdown correctly
- [ ] No job is lost when worker shuts down normally
- [ ] Basic throughput measurements recorded

---

# Phase 5 — Add the Other Job Types

Only after SLEEP works end-to-end.

## CPU Job

Example workloads:

- prime number calculation
- repeated SHA-256 hashing
- matrix computation

Purpose:

```text
High CPU usage
```

## HTTP Job

Call a safe public API.

Purpose:

```text
network latency
timeouts
HTTP errors
rate limits
```

## UNRELIABLE Job

Configuration:

```json
{
  "failureRate": 0.30,
  "durationMs": 500
}
```

Approximately 30% of executions intentionally fail.

Purpose:

```text
test failure handling
```

### Phase 5 completion checklist

- [ ] `SLEEP`
- [ ] `CPU`
- [ ] `HTTP`
- [ ] `UNRELIABLE`
- [ ] Each job type has its own executor
- [ ] Shared executor interface exists
- [ ] Unsupported types fail safely

---

# Phase 6 — Build the React Dashboard

## Goal

Now make the system controllable visually.

Use:

- React
- Vite
- Tailwind CSS

### Page 1 — Create Workload

```text
Job Type
[ Sleep Job ]

Number of Jobs
[ 1000 ]

Duration
[ 2000 ms ]

Priority
[ Normal ]

[ Launch Workload ]
```

### Page 2 — Workloads

```text
Workload         Total   Running   Completed   Failed

Sleep Test       1000      30         720        0
CPU Test         4000      20        1800        3
HTTP Test        2000      40         850       14
```

### Page 3 — Workload Details

Show:

```text
Queued
Running
Completed
Failed

Progress bar
Job list
Execution times
```

### Start with polling

Initially:

```text
GET /api/workloads/{id}
```

every 1–2 seconds is acceptable.

Do **not** start with WebSockets.

### Phase 6 completion checklist

- [ ] Create workload form
- [ ] Workloads table
- [ ] Workload details page
- [ ] Status counters
- [ ] Progress bar
- [ ] REST polling works

---

# Phase 7 — Add Retry Handling

## Goal

Make failures meaningful.

Use the `UNRELIABLE` and `HTTP` jobs.

Example retry policy:

```text
Attempt 1
   |
   X
wait 1 second

Attempt 2
   |
   X
wait 5 seconds

Attempt 3
   |
   X

FAILED permanently
```

Store:

```text
attempt
maxAttempts
lastError
nextRetryAt
```

Possible states:

```text
QUEUED
RUNNING
RETRYING
COMPLETED
FAILED
```

Later you can add a dead-letter topic.

### Test

Trigger:

```text
1000 Unreliable Jobs
failure rate = 30%
```

Observe:

- initial failures
- retries
- final successes
- permanent failures

### Phase 7 completion checklist

- [ ] Retry count
- [ ] Retry delay
- [ ] Exponential backoff
- [ ] Max attempts
- [ ] Final failure state
- [ ] Error reason stored

---

# Phase 8 — Run Multiple Go Workers

## Goal

This is where the project becomes clearly distributed.

Run:

```text
go-worker-1
go-worker-2
go-worker-3
```

using Docker Compose.

Kafka consumer groups should distribute jobs across workers.

Example:

```text
                 Kafka
                   |
          +--------+--------+
          |        |        |
          v        v        v
       Worker 1 Worker 2 Worker 3
```

### Test

Trigger:

```text
10,000 Sleep Jobs
```

Run:

```text
1 worker
3 workers
5 workers
```

Compare throughput.

This becomes an excellent README benchmark.

### Phase 8 completion checklist

- [ ] Multiple worker containers run
- [ ] Same Kafka consumer group configured
- [ ] Jobs distribute across workers
- [ ] Worker ID stored with executions
- [ ] Scaling experiment documented

---

# Phase 9 — Add Redis for Worker Health

## Goal

Use Redis only after multiple workers exist.

Redis will initially handle:

```text
worker heartbeats
```

Each Go worker periodically writes:

```text
worker:{workerId}:heartbeat
```

with a TTL.

Example:

```text
worker:go-01 = alive
TTL = 30 seconds
```

Workers refresh the heartbeat every 10 seconds.

If a worker crashes and stops refreshing:

```text
heartbeat expires
      |
      v
worker becomes unhealthy
```

The dashboard can then display:

```text
go-worker-1    HEALTHY
go-worker-2    HEALTHY
go-worker-3    OFFLINE
```

Later Redis can also support:

- temporary leases
- locks
- rate limits
- cached counters

### Phase 9 completion checklist

- [ ] Redis added
- [ ] Workers send heartbeats
- [ ] Heartbeat TTL works
- [ ] Backend lists workers
- [ ] Dashboard displays health
- [ ] Killing a worker makes it appear offline

---

# Phase 10 — Add Live Updates

## Goal

Replace frontend polling with real-time updates.

Choose one:

```text
Server-Sent Events (recommended first)
```

or:

```text
WebSocket
```

For this project, **SSE is simpler** because most communication is:

```text
server -> browser
```

Updates could contain:

```json
{
  "workloadId": "123",
  "queued": 420,
  "running": 30,
  "completed": 540,
  "failed": 10
}
```

The dashboard should update without page refreshes.

### Phase 10 completion checklist

- [ ] SSE endpoint
- [ ] React subscribes to updates
- [ ] Progress changes live
- [ ] Worker health updates live
- [ ] Polling fallback remains available

---

# Phase 11 — Build the Mixed Workload / Stress-Test UI

## Goal

Turn TaskFlow into an interactive distributed-systems demo.

Allow:

```text
Sleep          x1000
CPU            x4000
HTTP           x2000
Unreliable     x3000
```

Then:

```text
[ Launch Scenario ]
```

Total:

```text
10,000 jobs
```

### Preset scenarios

Add buttons such as:

```text
Basic Load
CPU Stress
API Stress
Failure Test
Mixed Load
```

This is where the frontend becomes especially useful for demonstrations.

### Metrics to display

```text
Queued
Running
Completed
Retrying
Failed

Jobs/sec
Average latency
P95 latency

Workers online
Jobs per worker
```

---

# Phase 12 — Observability

## Goal

Only after the distributed system itself works.

Add:

- OpenTelemetry
- Prometheus
- Grafana

Track:

```text
job throughput
execution duration
queue depth
success rate
failure rate
retry count
worker health
CPU usage
memory usage
```

Useful metrics:

```text
taskflow_jobs_created_total
taskflow_jobs_completed_total
taskflow_jobs_failed_total
taskflow_job_duration_seconds
taskflow_worker_active_jobs
```

---

# Phase 13 — Failure and Recovery Experiments

Now deliberately break the system.

## Experiment 1

Kill a worker while it has active jobs.

Observe:

```text
healthy
  |
  v
heartbeat missing
  |
  v
offline
```

## Experiment 2

Stop the external API / force HTTP errors.

Observe retries.

## Experiment 3

Restart Kafka.

Observe consumer recovery.

## Experiment 4

Launch too many CPU jobs.

Observe CPU saturation.

## Experiment 5

Compare:

```text
1 worker
3 workers
5 workers
```

Document results.

These experiments are a major part of what makes the project worth discussing in interviews.

---

# Phase 14 — Dockerize Everything

At this point the local stack should start with something similar to:

```bash
docker compose up
```

Services:

```text
frontend
control-plane
worker-1
worker-2
worker-3
mongodb
kafka
redis
prometheus
grafana
```

Do not worry about Kubernetes until Docker Compose is stable.

---

# Phase 15 — Kubernetes

Kubernetes is intentionally last.

Use it to demonstrate:

```text
worker replicas
service discovery
health checks
rolling deployments
horizontal scaling
```

Example:

```text
Go Worker Deployment

replicas: 3
```

Then test scaling:

```text
3 -> 6 workers
```

and observe throughput.

---

# Recommended Build Order

This is the order I would actually follow:

```text
1. Define Workload + Job models
             |
             v
2. Spring Boot + MongoDB
             |
             v
3. POST /workloads
             |
             v
4. Kafka producer
             |
             v
5. One Go worker
             |
             v
6. SLEEP job end-to-end
             |
             v
7. Go worker concurrency
             |
             v
8. CPU / HTTP / UNRELIABLE jobs
             |
             v
9. React dashboard
             |
             v
10. Retry system
             |
             v
11. Multiple Go workers
             |
             v
12. Redis heartbeats
             |
             v
13. SSE live updates
             |
             v
14. Mixed workload generator
             |
             v
15. Metrics + Grafana
             |
             v
16. Failure experiments
             |
             v
17. Docker polish
             |
             v
18. Kubernetes
```

---

# Your First Development Milestone

Do not think about the entire roadmap yet.

Your **first milestone** should be:

> From one API request, create 10 Sleep Jobs in MongoDB, publish them to Kafka, have one Go worker consume them, sleep for the requested duration, and mark all 10 jobs completed.

The flow:

```text
POST /workloads
      |
      v
Spring Boot
      |
      +---- MongoDB: create 10 jobs
      |
      +---- Kafka: publish 10 messages
                       |
                       v
                   Go Worker
                       |
                       v
                 execute SLEEP
                       |
                       v
                    MongoDB
                  COMPLETED
```

Once this works, you have the **spine of the entire system**.

Almost everything after that is an extension of this flow.

---

# What You Should Start With Today

## Step 1

Create:

```text
taskflow/
├── control-plane/
├── worker-go/
├── frontend/
├── infra/
└── docs/
```

## Step 2

Generate the Spring Boot project with:

```text
Spring Web
Spring Data MongoDB
Validation
```

## Step 3

Run MongoDB locally.

## Step 4

Create the `Workload` and `Job` models.

## Step 5

Implement:

```http
POST /api/workloads
```

## Step 6

Test that:

```text
POST Sleep x10
```

creates:

```text
1 Workload
10 Job documents
```

**Stop there before adding Kafka.**

Once that works cleanly and has tests, move to Phase 2.

---

# Development Principle

Whenever you add a new technology, it should solve a problem you can already see.

Examples:

```text
"We need to deliver work asynchronously."
-> Add Kafka.

"We need concurrent execution."
-> Add Go worker pools.

"We have multiple workers and need to know which are alive."
-> Add Redis heartbeats.

"Polling the UI is becoming ugly."
-> Add SSE.

"We need to understand system behavior under load."
-> Add Prometheus + Grafana.

"We want worker replicas and orchestration."
-> Add Kubernetes.
```

This keeps TaskFlow from becoming a project where technologies were added only to make the stack look large.

The final system should feel like it **grew naturally from engineering problems you encountered while building it**.
