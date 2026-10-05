package com.anutej.taskflow.controlplane.dto;

public record JobSummaryResponse(
        long totalJobs,
        long completedJobs) {
}