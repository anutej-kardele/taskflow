package com.anutej.taskflow.controlplane.service;

import org.springframework.stereotype.Service;

import com.anutej.taskflow.controlplane.model.JobType;

import io.micrometer.core.instrument.MeterRegistry;

import java.time.Duration;
import java.util.EnumMap;
import java.util.Map;

import io.micrometer.core.instrument.Timer;

@Service
public class TaskFlowMetrics {

    private final MeterRegistry meterRegistry;

    private final Map<JobType, Timer> executionTimers = new EnumMap<>(JobType.class);

    public TaskFlowMetrics(
            MeterRegistry meterRegistry) {

        this.meterRegistry = meterRegistry;

        for (JobType type : JobType.values()) {

            Timer timer = Timer.builder("taskflow.job.execution")
                    .description("Execution duration of successfully completed TaskFlow jobs").tag("type", type.name())
                    .publishPercentileHistogram().register(meterRegistry);

            executionTimers.put(type, timer);
        }
    }

    public void jobsCreated(JobType type, long count) {
        meterRegistry.counter("taskflow.jobs.submitted", "type", type.name()).increment(count);
    }

    public void jobCompleted(JobType type) {
        meterRegistry.counter("taskflow.jobs.completed", "type", type.name()).increment();
    }

    public void jobFailed(JobType type) {
        meterRegistry.counter("taskflow.jobs.failed", "type", type.name()).increment();
    }

    public void jobRetried(JobType type) {
        meterRegistry.counter("taskflow.jobs.retried", "type", type.name()).increment();
    }

    public void recordJobExecution(JobType type, Duration duration) {

        if (type == null || duration == null || duration.isNegative())
            return;

        Timer timer = executionTimers.get(type);

        if (timer != null)
            timer.record(duration);
    }
}