package com.anutej.taskflow.controlplane.dto;

public record WorkerControlResponse(
        String nodeId,
        String action,
        String message) {
}