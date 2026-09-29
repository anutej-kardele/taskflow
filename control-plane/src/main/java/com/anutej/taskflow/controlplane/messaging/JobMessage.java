package com.anutej.taskflow.controlplane.messaging;

import java.util.Map;

import com.anutej.taskflow.controlplane.model.JobType;

public record JobMessage(
        String jobId,
        String workloadId,
        JobType type,
        Map<String, Object> payload) {
}