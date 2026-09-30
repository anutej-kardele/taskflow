package com.anutej.taskflow.controlplane.dto;

import com.anutej.taskflow.controlplane.model.JobStatus;

import jakarta.validation.constraints.NotNull;

public record UpdateJobStatusRequest(

        @NotNull JobStatus status) {
}