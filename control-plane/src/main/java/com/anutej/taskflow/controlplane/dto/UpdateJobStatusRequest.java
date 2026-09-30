package com.anutej.taskflow.controlplane.dto;

import com.anutej.taskflow.controlplane.model.JobStatus;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.NotBlank;

public record UpdateJobStatusRequest(
        @NotNull JobStatus status,
        @NotBlank String workerId) {
}