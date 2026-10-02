package com.anutej.taskflow.controlplane.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ReportJobFailureRequest(

        @NotBlank String workerId,

        @NotBlank @Size(max = 2000) String error

) {
}