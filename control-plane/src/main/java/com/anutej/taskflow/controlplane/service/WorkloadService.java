package com.anutej.taskflow.controlplane.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.anutej.taskflow.controlplane.model.Job;
import com.anutej.taskflow.controlplane.model.JobStatus;
import com.anutej.taskflow.controlplane.model.JobType;
import com.anutej.taskflow.controlplane.model.Workload;
import com.anutej.taskflow.controlplane.model.WorkloadStatus;
import com.anutej.taskflow.controlplane.repository.JobRepository;
import com.anutej.taskflow.controlplane.repository.WorkloadRepository;
import com.anutej.taskflow.controlplane.messaging.JobPublisher;

@Service
public class WorkloadService {

    private final WorkloadRepository workloadRepository;
    private final JobRepository jobRepository;
    private final JobPublisher jobPublisher;
    private final SseEventService sseEventService;
    private final TaskFlowMetrics taskFlowMetrics;

    public WorkloadService(
            WorkloadRepository workloadRepository,
            JobRepository jobRepository,
            JobPublisher jobPublisher,
            SseEventService sseEventService,
            TaskFlowMetrics taskFlowMetrics) {

        this.workloadRepository = workloadRepository;
        this.jobRepository = jobRepository;
        this.jobPublisher = jobPublisher;
        this.sseEventService = sseEventService;
        this.taskFlowMetrics = taskFlowMetrics;
    }

    public Workload createWorkload(JobType jobType, int jobCount, Map<String, Object> configuration) {

        if (jobCount <= 0) {
            throw new IllegalArgumentException("jobCount must be greater than 0");
        }

        String workloadId = UUID.randomUUID().toString();
        Instant createdAt = Instant.now();

        Workload workload = new Workload(
                workloadId,
                jobType,
                jobCount,
                WorkloadStatus.CREATED,
                configuration,
                createdAt);

        workloadRepository.save(workload);

        List<Job> jobs = new ArrayList<>();

        for (int i = 0; i < jobCount; i++) {

            Job job = new Job(
                    UUID.randomUUID().toString(),
                    workloadId,
                    jobType,
                    JobStatus.QUEUED,
                    0,
                    new HashMap<>(configuration),
                    createdAt);

            jobs.add(job);
        }

        jobRepository.saveAll(jobs);
        taskFlowMetrics.jobsCreated(jobType, jobs.size());

        sseEventService.broadcastWorkloadUpdated(workloadId);

        for (Job job : jobs) {
            jobPublisher.publish(job);
        }

        return workload;
    }

    public List<Workload> getAllWorkloads() {
        return workloadRepository.findAll();
    }

    public Optional<Workload> getWorkloadById(String id) {
        return workloadRepository.findById(id);
    }

    public List<Job> getJobsByWorkloadId(String workloadId) {
        return jobRepository.findByWorkloadId(workloadId);
    }
}