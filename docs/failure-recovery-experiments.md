# TaskFlow Failure and Recovery Experiments

This document records the failure-injection experiments used to validate TaskFlow's distributed-systems recovery behavior.

The goal is not only to show that TaskFlow works during normal execution, but to verify what happens when individual components disappear while work is actively being processed.

## Reliability Model

TaskFlow separates distributed-system responsibilities:

| Concern | Component |
| --- | --- |
| Durable workload/job state | MongoDB |
| Job delivery | Kafka |
| Job ownership | MongoDB-backed leases |
| Execution | Go workers |
| Retry policy | Spring Boot control plane |
| Worker process health | Redis |
| Live UI updates | SSE |
| Metrics and tracing | Prometheus, Grafana, OpenTelemetry |

Kafka delivery does not itself authorize execution. A worker must claim a job through the control plane, which atomically records ownership in MongoDB.

```text
Kafka delivery
      |
      v
claim through control plane
      |
      v
MongoDB atomic ownership update
      |
      v
RUNNING + leaseUntil
      |
      v
execute
```

While executing, workers periodically renew their lease. If lease renewal fails, the worker cancels execution because it can no longer prove that it still owns the job.

## Experiment Summary

| Experiment | Injected Failure | Result |
| --- | --- | --- |
| 13.1 | Hard-kill active worker | PASS |
| 13.2 | Restart worker nodes | PASS |
| 13.3 | Kill Spring Boot control plane | PASS |
| 13.3.1 | Temporary control-plane outage with self-healing workers | PASS |
| 13.4 | Stop Kafka during active processing | PASS |
| 13.5 | Stop Redis during active processing | PASS |
| 13.5.1 | Redis unavailable to health API | PASS after hardening |
| 13.6 | Stop MongoDB during active processing | PASS |

---

# 13.1 — Worker Hard-Crash Recovery

## Goal

Verify that a job owned by a worker is not permanently lost if the worker process disappears without a graceful shutdown.

## Failure Injection

A long-running `SLEEP` job was created and worker containers were force-killed while the job was executing.

```text
RUNNING job
    |
    v
docker kill worker
    |
    v
worker disappears immediately
```

## Expected Behavior

```text
worker dies
    |
    v
lease heartbeat stops
    |
    v
lease expires
    |
    v
Kafka message remains eligible
    |
    v
another worker receives message
    |
    v
expired job is reclaimed
    |
    v
attempt increments
    |
    v
job completes
```

## Observed Result

Final state:

```text
Status        COMPLETED
Attempts      3 / 3
Recovered     yes
Final worker  worker-b-slot-3
```

The job was reclaimed twice before finally completing.

## Result

**PASS**

Verified:

- worker hard crashes do not permanently lose jobs
- leases detect abandoned ownership
- another worker can reclaim expired work
- attempts record infrastructure recovery
- Kafka messages remain available until safely handled

---

# 13.2 — Worker Restart and Kafka Consumer-Group Rejoin

## Goal

Verify that stopped worker nodes can restart and automatically rejoin the Kafka consumer group.

## Experiment

```text
Job type   SLEEP
Jobs       30
Duration   2000 ms
```

## Observed Result

All 30 jobs completed.

Example distribution:

```text
worker-a   5 jobs
worker-b  24 jobs
worker-c   1 job
```

No retries or permanent failures occurred. Uneven distribution is expected because Kafka assigns partitions rather than guaranteeing equal jobs per worker.

## Result

**PASS**

Verified:

- restarted workers reconnect to Kafka
- workers automatically rejoin the consumer group
- partitions are reassigned
- restarted workers receive new work

---

# 13.3 — Control-Plane Hard Failure

## Goal

Verify behavior when the Spring Boot control plane disappears while workers are active.

## Initial Discovery

The first failure test exposed a PID-management bug. The PID stored by the startup script belonged to the Maven wrapper rather than the actual Java process listening on port `8080`.

## Hardening

The startup script was changed to store the real Java listener PID:

```bash
CONTROL_PLANE_PID="$(
    lsof -tiTCP:8080 -sTCP:LISTEN     | head -n 1
)
```

The listener PID is stored in:

```text
.taskflow/pids/control-plane.pid
```

The fix was validated by killing the stored PID and confirming that port `8080` became unavailable.

## Result

**PASS**

The experiment also exposed the worker-slot self-healing issue addressed next.

---

# 13.3.1 — Worker Self-Healing During Control-Plane Outage

## Goal

Verify that a temporary control-plane outage does not permanently kill a logical Go worker slot.

Previously, unresolved message processing caused `runWorker()` to return. A temporary infrastructure failure could therefore permanently remove a slot while the worker container remained alive.

## Hardening

Each logical worker slot now acts as a supervisor.

```text
message processing unresolved
        |
        v
leave message uncommitted
        |
        v
close Kafka reader
        |
        v
wait 2 seconds
        |
        v
create new reader
        |
        v
rejoin Kafka consumer group
```

## Experiment

```text
Job type   SLEEP
Jobs       9
Duration   120000 ms
```

At failure time:

```text
RUNNING   6
QUEUED    3
```

The actual Spring Boot Java listener was force-killed. Workers were not restarted.

## Observed During Outage

Active jobs detected lease-renewal failures. Execution was cancelled after ownership became uncertain.

```text
lease renewal failed
        |
        v
execution interrupted
        |
        v
message processing unresolved
        |
        v
consumer session recycled
        |
        v
consumer session restarted
```

While Spring remained unavailable, slots kept retrying instead of permanently exiting.

## Recovery

Spring Boot was restarted without restarting workers.

Final state:

```text
Total jobs       9
Completed        9
Failed           0
Recovered        6
```

Worker container start timestamps remained unchanged.

## Result

**PASS**

Verified:

- lease-renewal failure cancels uncertain execution
- unresolved Kafka messages remain uncommitted
- logical worker slots self-heal
- Kafka readers recycle and rejoin automatically
- expired jobs are reclaimed
- workers do not require container restart

---

# 13.4 — Kafka Outage and Redelivery Safety

## Goal

Verify behavior when Kafka becomes unavailable after workers have already received jobs, especially at the boundary between durable MongoDB completion and Kafka offset commit.

## Experiment

A 50-job `SLEEP` workload was running when Kafka was stopped.

Workers were not restarted.

## Observed During Kafka Outage

Some jobs successfully reached:

```text
MongoDB
status = COMPLETED
```

but their Kafka offset commits failed because the broker was unavailable.

Workers logged failures similar to:

```text
failed to commit job ... use of closed network connection
```

Affected consumer sessions recycled. Fetch operations also failed while Kafka remained unavailable.

## Recovery

Kafka was restarted without restarting workers.

Uncommitted messages were redelivered. Workers checked MongoDB before execution and found that some jobs were already terminal:

```text
Kafka redelivery
      |
      v
claim attempted
      |
      v
Mongo says COMPLETED
      |
      v
do not execute
      |
      v
commit stale Kafka message
```

Logs showed:

```text
current status=COMPLETED
already handled with status=COMPLETED;
committing stale Kafka message
```

All 50 jobs eventually completed, and stale redeliveries did not increment `attempt`.

## Result

**PASS**

Verified:

- workers survive Kafka unavailability
- MongoDB completion can succeed even when Kafka commit fails
- uncommitted Kafka messages are redelivered
- completed jobs are not executed twice
- stale messages are eventually committed

This is duplicate-execution protection on top of Kafka's at-least-once delivery model. It is not a claim of Kafka exactly-once delivery.

---

# 13.5 — Redis Outage Isolation

## Goal

Verify that Redis worker-health reporting is isolated from the job-execution path.

## Experiment

```text
Job type   SLEEP
Jobs       30
Duration   10000 ms
```

Before Redis stopped:

```text
Total     30
Running    8
Queued    22
```

Redis was stopped while jobs were active.

## Observed Behavior

All three nodes logged heartbeat failures:

```text
worker heartbeat failed node=worker-a
worker heartbeat failed node=worker-b
worker heartbeat failed node=worker-c
```

At the same time, workers continued:

```text
CLAIMED
RUNNING
COMPLETED
```

Final workload:

```text
Total       30
Completed   30
Failed       0
Running      0
Queued       0
Retried      0
```

After Redis restarted, existing heartbeat goroutines resumed automatically and all workers returned `ONLINE`.

## Result

**PASS**

Verified:

- Redis failure does not stop job execution
- Kafka processing continues
- MongoDB state continues updating
- workers reconnect to Redis automatically
- no worker restart is required

---

# 13.5.1 — Graceful Worker-Health Degradation

## Problem Discovered

Initially:

```text
Redis unavailable
      |
      v
GET /api/workers
      |
      v
HTTP 500
```

That was misleading because workers could still be healthy and processing jobs.

## Hardening

Worker health now distinguishes:

```text
Redis reachable + heartbeat key missing
        |
        v
OFFLINE
```

from:

```text
Redis itself unavailable
        |
        v
UNKNOWN
```

The control plane catches Redis data-access failures and returns expected worker nodes with `status = UNKNOWN`.

The frontend treats `UNKNOWN` separately and disables worker action controls because the actual worker state cannot be determined safely.

## Validation

With Redis healthy:

```text
worker-a   ONLINE
worker-b   ONLINE
worker-c   ONLINE
```

With Redis stopped:

```http
HTTP/1.1 200
```

```text
worker-a   UNKNOWN
worker-b   UNKNOWN
worker-c   UNKNOWN
```

After Redis restarted, all three returned to `ONLINE`.

## Result

**PASS**

---

# 13.6 — MongoDB Outage and Durable-State Recovery

## Goal

Verify behavior when TaskFlow's durable source of truth becomes unavailable during active execution.

MongoDB stores:

```text
Workloads
Jobs
Job status
Worker ownership
Lease expiration
Attempts
Retry state
Completion state
```

## Experiment

```text
Job type   SLEEP
Jobs       9
Duration   60000 ms
```

Before MongoDB stopped:

```text
RUNNING   6
QUEUED    3
```

The six running jobs were on `attempt = 1`.

MongoDB was then stopped while Spring Boot, Kafka, Redis, and all workers remained running.

## Control-Plane Isolation

The Java process continued listening on port `8080`, but Mongo-backed API requests could not complete.

Requests with an eight-second client timeout returned:

```text
Operation timed out
```

Redis-backed worker health remained functional and all three workers continued to report `ONLINE`.

## Recovery

MongoDB was restarted without restarting Spring Boot or any worker.

The existing Spring MongoDB client reconnected automatically.

The original workload and job documents remained intact.

Immediately after recovery:

```text
6 previously running jobs -> reclaimed
3 never-started jobs       -> still QUEUED
```

The six recovered jobs reached `attempt = 3`. The three jobs that had never been claimed remained `attempt = 0` and later ran normally.

Final result:

```text
Total       9
Completed   9
Failed      0
Running     0
Queued      0
Recovered   6
```

Final attempts:

```text
3
1
3
3
3
3
1
1
3
```

No worker containers were restarted.

## About Attempt 3

The six interrupted jobs completed on attempt 3 rather than attempt 2, which means more than one reclaim occurred during recovery.

The experiment did not capture enough precise per-job evidence to assign the intermediate reclaim to one exact event, so no stronger conclusion is made.

The important safety properties still held:

```text
no job disappeared
no job was permanently stuck
all jobs reached COMPLETED
```

## Result

**PASS**

Verified:

- Spring survives temporary MongoDB loss
- workers remain alive
- Redis health remains independent
- Mongo-backed APIs become unavailable while Mongo is down
- persistent state survives MongoDB restart
- Spring reconnects automatically
- expired jobs are reclaimable
- never-started jobs remain queued
- all jobs eventually reach a terminal state

---

# Observed Limitations

## MongoDB API Failure Latency

MongoDB-backed HTTP requests can remain blocked while the MongoDB Java driver waits for server selection.

During the experiment, an eight-second client timeout expired before Spring returned a response.

A future improvement could reduce failure-detection latency and return `503 Service Unavailable` more quickly.

## Worker Restart Backoff

Logical worker slots currently wait a fixed two seconds before recreating a Kafka consumer session after unresolved processing.

A future implementation could use bounded exponential backoff to reduce consumer-group churn during prolonged outages.

## Poison Kafka Messages

Malformed Kafka messages currently remain unresolved and can repeatedly trigger consumer-session recycling.

A future dead-letter or malformed-message policy could prevent infinite redelivery of permanently invalid messages.

---

# Reliability Properties Demonstrated

### Durable state is authoritative

```text
Kafka = delivery
Mongo = execution authority
```

### Delivery and execution are separate

A Kafka message may be delivered more than once without causing a terminal job to execute again.

### Lease loss stops uncertain execution

Workers cancel execution when they can no longer prove durable ownership.

### Worker slots self-heal

Temporary infrastructure failures do not permanently remove logical worker slots.

### Redis is non-critical to execution

Worker-health reporting can fail while job processing continues.

### Components recover independently

Kafka, Redis, MongoDB, the Spring control plane, and workers were individually failed and recovered without rebuilding the entire TaskFlow system.

---

# Phase 13 Result

```text
Worker crash                 PASS
Worker restart               PASS
Control-plane outage         PASS
Worker-slot self-healing     PASS
Kafka outage                 PASS
Kafka duplicate suppression  PASS
Redis outage                 PASS
Redis health degradation     PASS
MongoDB outage               PASS
MongoDB durable recovery     PASS
```

TaskFlow now demonstrates:

```text
failure detection
lease-based ownership
crash recovery
at-least-once delivery handling
duplicate-delivery suppression
consumer self-healing
dependency isolation
durable-state recovery
automatic reconnection
```

**Phase 13 is complete.**
