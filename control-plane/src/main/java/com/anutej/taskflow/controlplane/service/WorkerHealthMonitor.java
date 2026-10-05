package com.anutej.taskflow.controlplane.service;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.anutej.taskflow.controlplane.dto.WorkerHealthResponse;

@Service
public class WorkerHealthMonitor {

    private final WorkerHealthService workerHealthService;
    private final SseEventService sseEventService;

    private Map<String, WorkerSnapshot> previousSnapshot;

    public WorkerHealthMonitor(
            WorkerHealthService workerHealthService,
            SseEventService sseEventService) {

        this.workerHealthService = workerHealthService;

        this.sseEventService = sseEventService;
    }

    /*
     * Check worker state once per second.
     *
     * lastHeartbeat is deliberately excluded from the
     * snapshot so normal heartbeats do not generate
     * workers-updated SSE events.
     */
    @Scheduled(fixedDelay = 1000)
    public void detectWorkerChanges() {

        List<WorkerHealthResponse> workers = workerHealthService.getWorkers();

        Map<String, WorkerSnapshot> currentSnapshot = new LinkedHashMap<>();

        for (WorkerHealthResponse worker : workers) {

            currentSnapshot.put(
                    worker.nodeId(),
                    new WorkerSnapshot(
                            worker.status(),
                            worker.slots(),
                            worker.startedAt()));
        }

        /*
         * First scan establishes the baseline.
         */
        if (previousSnapshot == null) {

            previousSnapshot = currentSnapshot;

            return;
        }

        if (!currentSnapshot.equals(
                previousSnapshot)) {

            previousSnapshot = currentSnapshot;

            sseEventService
                    .broadcastWorkersUpdated();
        }
    }

    private record WorkerSnapshot(
            String status,
            int slots,
            Instant startedAt) {
    }
}