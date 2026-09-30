package com.anutej.taskflow.controlplane.service;

import java.util.Optional;

import org.springframework.stereotype.Service;

import com.anutej.taskflow.controlplane.model.Job;
import com.anutej.taskflow.controlplane.repository.JobRepository;
import com.anutej.taskflow.controlplane.repository.WorkloadRepository;
import com.anutej.taskflow.controlplane.model.JobStatus;
import com.anutej.taskflow.controlplane.model.Workload;
import com.anutej.taskflow.controlplane.model.WorkloadStatus;

import java.util.List;

@Service
public class JobService {

    private final JobRepository jobRepository;
    private final WorkloadRepository workloadRepository;

    public JobService(JobRepository jobRepository, WorkloadRepository workloadRepository) {
        this.jobRepository = jobRepository;
        this.workloadRepository = workloadRepository;
    }

    public Optional<Job> getJobById(String id) {
        return jobRepository.findById(id);
    }

    public Optional<Job> updateJobStatus(String id, JobStatus status) {

        Optional<Job> optionalJob = jobRepository.findById(id);

        if (optionalJob.isEmpty()) {
            return Optional.empty();
        }

        Job job = optionalJob.get();

        if (status == JobStatus.RUNNING) {
            job.setAttempt(job.getAttempt() + 1);
        }

        job.setStatus(status);

        Job savedJob = jobRepository.save(job);

        updateWorkloadStatus(savedJob.getWorkloadId());

        return Optional.of(jobRepository.save(job));
    }

    private void updateWorkloadStatus(String workloadId) {

        List<Job> jobs = jobRepository.findByWorkloadId(workloadId);

        if (jobs.isEmpty()) {
            return;
        }

        WorkloadStatus newStatus;

        boolean anyFailed = jobs.stream()
                .anyMatch(job -> job.getStatus() == JobStatus.FAILED);

        boolean allCompleted = jobs.stream()
                .allMatch(job -> job.getStatus() == JobStatus.COMPLETED);

        boolean anyStarted = jobs.stream()
                .anyMatch(job -> job.getStatus() == JobStatus.RUNNING ||
                        job.getStatus() == JobStatus.COMPLETED);

        if (anyFailed) {
            newStatus = WorkloadStatus.FAILED;

        } else if (allCompleted) {
            newStatus = WorkloadStatus.COMPLETED;

        } else if (anyStarted) {
            newStatus = WorkloadStatus.RUNNING;

        } else {
            newStatus = WorkloadStatus.CREATED;
        }

        workloadRepository.findById(workloadId)
                .ifPresent(workload -> {
                    workload.setStatus(newStatus);
                    workloadRepository.save(workload);
                });
    }
}