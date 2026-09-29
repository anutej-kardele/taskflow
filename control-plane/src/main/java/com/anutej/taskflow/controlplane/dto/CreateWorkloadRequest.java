package com.anutej.taskflow.controlplane.dto;

import java.util.Map;

import com.anutej.taskflow.controlplane.model.JobType;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record CreateWorkloadRequest(

        @NotNull JobType jobType,

        @Min(1) int jobCount,

        @NotNull Map<String, Object> configuration

) {
}