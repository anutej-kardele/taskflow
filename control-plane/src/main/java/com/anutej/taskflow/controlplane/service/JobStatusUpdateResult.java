package com.anutej.taskflow.controlplane.service;

import com.anutej.taskflow.controlplane.model.Job;

public record JobStatusUpdateResult(
        Outcome outcome,
        Job job) {

    public enum Outcome {
        UPDATED,
        NOT_FOUND,
        CONFLICT
    }
}