# TaskFlow Frontend

React dashboard and workload generator.

## Responsibilities

- choose Job Type
- configure a workload
- submit one workload request
- show workload progress and job states
- later show worker health, throughput, latency, failures, and retries

## Important Rule

The browser sends one workload request. It should not send 1,000 requests to create 1,000 jobs.

## Planned Stack

React, Vite, Tailwind CSS, REST polling first, later SSE.
