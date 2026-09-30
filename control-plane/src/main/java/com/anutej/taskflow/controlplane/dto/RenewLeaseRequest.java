package com.anutej.taskflow.controlplane.dto;

import jakarta.validation.constraints.NotBlank;

public record RenewLeaseRequest(
        @NotBlank String workerId) {
}