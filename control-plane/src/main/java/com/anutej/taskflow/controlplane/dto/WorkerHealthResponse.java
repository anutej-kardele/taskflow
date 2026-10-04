package com.anutej.taskflow.controlplane.dto;

import java.time.Instant;

public record WorkerHealthResponse(
        String nodeId,
        int slots,
        String status,
        Instant startedAt,
        Instant lastHeartbeat) {
}