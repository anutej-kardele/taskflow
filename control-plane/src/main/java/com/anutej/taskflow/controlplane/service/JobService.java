package com.anutej.taskflow.controlplane.service;

import java.util.Optional;

import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Service;

import com.anutej.taskflow.controlplane.model.Job;
import com.anutej.taskflow.controlplane.repository.JobRepository;
import com.anutej.taskflow.controlplane.model.JobStatus;
import com.anutej.taskflow.controlplane.model.Workload;
import com.anutej.taskflow.controlplane.model.WorkloadStatus;

import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import org.springframework.data.mongodb.core.FindAndModifyOptions;
import com.anutej.taskflow.controlplane.dto.JobSummaryResponse;
import com.mongodb.client.result.UpdateResult;

import java.time.Instant;
import java.util.List;

@Service
public class JobService {

    private final JobRepository jobRepository;
    private final MongoTemplate mongoTemplate;
    private final SseEventService sseEventService;

    public JobService(JobRepository jobRepository, MongoTemplate mongoTemplate, SseEventService sseEventService) {

        this.jobRepository = jobRepository;

        this.mongoTemplate = mongoTemplate;

        this.sseEventService = sseEventService;
    }

    public Optional<Job> getJobById(String id) {
        return jobRepository.findById(id);
    }

    public JobStatusUpdateResult updateJobStatus(
            String id,
            JobStatus status,
            String workerId) {

        Instant now = Instant.now();

        Query query = new Query(
                Criteria.where("_id").is(id)
                        .and("status").is(JobStatus.RUNNING)
                        .and("workerId").is(workerId)
                        .and("leaseUntil").gt(now));

        Update update = new Update();

        if (status != JobStatus.COMPLETED) {

            return new JobStatusUpdateResult(
                    JobStatusUpdateResult.Outcome.CONFLICT,
                    null);
        }

        update.set("status", JobStatus.COMPLETED)
                .set("leaseUntil", null)
                .set("nextRetryAt", null);

        Job updatedJob = mongoTemplate.findAndModify(
                query,
                update,
                FindAndModifyOptions.options().returnNew(true),
                Job.class);

        if (updatedJob == null) {

            if (jobRepository.existsById(id)) {
                return new JobStatusUpdateResult(
                        JobStatusUpdateResult.Outcome.CONFLICT,
                        null);
            }

            return new JobStatusUpdateResult(
                    JobStatusUpdateResult.Outcome.NOT_FOUND,
                    null);
        }

        updateWorkloadStatus(updatedJob.getWorkloadId());

        sseEventService.broadcastJobUpdated(updatedJob.getId(), updatedJob.getWorkloadId());

        return new JobStatusUpdateResult(JobStatusUpdateResult.Outcome.UPDATED, updatedJob);
    }

    private void updateWorkloadStatus(String workloadId) {

        List<Job> jobs = jobRepository.findByWorkloadId(workloadId);

        if (jobs.isEmpty()) {
            return;
        }

        /*
         * A workload is terminal only when EVERY job
         * has reached a terminal state.
         *
         * RETRYING, RUNNING and QUEUED are all
         * non-terminal.
         */
        boolean allTerminal = jobs.stream()
                .allMatch(job -> job.getStatus() == JobStatus.COMPLETED ||
                        job.getStatus() == JobStatus.FAILED);

        boolean anyFailed = jobs.stream()
                .anyMatch(job -> job.getStatus() == JobStatus.FAILED);

        /*
         * Once any job has started execution, retried,
         * completed or permanently failed, the workload
         * has moved beyond CREATED.
         */
        boolean anyStarted = jobs.stream()
                .anyMatch(job -> job.getStatus() != JobStatus.QUEUED);

        /*
         * Only choose COMPLETED / FAILED after every
         * job is terminal.
         */
        if (allTerminal) {

            WorkloadStatus terminalStatus = anyFailed
                    ? WorkloadStatus.FAILED
                    : WorkloadStatus.COMPLETED;

            Query query = new Query(
                    Criteria.where("_id").is(workloadId)
                            .and("status")
                            .in(
                                    WorkloadStatus.CREATED,
                                    WorkloadStatus.RUNNING));

            Update update = new Update()
                    .set(
                            "status",
                            terminalStatus);

            UpdateResult result = mongoTemplate.updateFirst(
                    query,
                    update,
                    Workload.class);

            if (result.getModifiedCount() > 0) {

                sseEventService
                        .broadcastWorkloadUpdated(
                                workloadId);
            }

            return;
        }

        /*
         * At least one job has begun processing, but
         * some jobs are still QUEUED / RUNNING / RETRYING.
         *
         * Therefore the workload must remain RUNNING.
         */
        if (anyStarted) {

            Query query = new Query(
                    Criteria.where("_id").is(workloadId)
                            .and("status")
                            .is(WorkloadStatus.CREATED));

            Update update = new Update()
                    .set(
                            "status",
                            WorkloadStatus.RUNNING);

            UpdateResult result = mongoTemplate.updateFirst(
                    query,
                    update,
                    Workload.class);

            if (result.getModifiedCount() > 0) {

                sseEventService
                        .broadcastWorkloadUpdated(
                                workloadId);
            }
        }
    }

    public JobStatusUpdateResult claimJob(String id, String workerId) {

        Instant now = Instant.now();
        Instant leaseUntil = now.plusSeconds(30);

        Criteria claimable = new Criteria().orOperator(

                Criteria.where("status")
                        .is(JobStatus.QUEUED),

                new Criteria().andOperator(
                        Criteria.where("status")
                                .is(JobStatus.RUNNING),

                        Criteria.where("leaseUntil")
                                .lt(now)));

        Query query = new Query(
                new Criteria().andOperator(
                        Criteria.where("_id").is(id),
                        claimable));

        Update update = new Update()
                .set("status", JobStatus.RUNNING)
                .set("workerId", workerId)
                .set("startedAt", now)
                .set("leaseUntil", leaseUntil)
                .inc("attempt", 1);

        Job claimedJob = mongoTemplate.findAndModify(
                query,
                update,
                FindAndModifyOptions.options().returnNew(true),
                Job.class);

        if (claimedJob == null) {

            if (jobRepository.existsById(id)) {
                return new JobStatusUpdateResult(
                        JobStatusUpdateResult.Outcome.CONFLICT,
                        null);
            }

            return new JobStatusUpdateResult(
                    JobStatusUpdateResult.Outcome.NOT_FOUND,
                    null);
        }

        updateWorkloadStatus(claimedJob.getWorkloadId());

        sseEventService.broadcastJobUpdated(claimedJob.getId(), claimedJob.getWorkloadId());

        return new JobStatusUpdateResult(JobStatusUpdateResult.Outcome.UPDATED, claimedJob);
    }

    public JobStatusUpdateResult renewLease(
            String id,
            String workerId) {

        Instant now = Instant.now();
        Instant newLeaseUntil = now.plusSeconds(30);

        Query query = new Query(
                Criteria.where("_id").is(id)
                        .and("status").is(JobStatus.RUNNING)
                        .and("workerId").is(workerId)
                        .and("leaseUntil").gt(now));

        Update update = new Update()
                .set("leaseUntil", newLeaseUntil);

        Job updatedJob = mongoTemplate.findAndModify(
                query,
                update,
                FindAndModifyOptions.options().returnNew(true),
                Job.class);

        if (updatedJob == null) {

            if (jobRepository.existsById(id)) {
                return new JobStatusUpdateResult(
                        JobStatusUpdateResult.Outcome.CONFLICT,
                        null);
            }

            return new JobStatusUpdateResult(
                    JobStatusUpdateResult.Outcome.NOT_FOUND,
                    null);
        }

        return new JobStatusUpdateResult(
                JobStatusUpdateResult.Outcome.UPDATED,
                updatedJob);
    }

    private long retryDelaySecondsForAttempt(int attempt) {

        return switch (attempt) {

            case 1 -> 1;

            case 2 -> 5;

            default -> 5;
        };
    }

    private int effectiveMaxAttempts(Job job) {

        if (job.getMaxAttempts() <= 0) {
            return 3;
        }

        return job.getMaxAttempts();
    }

    public JobStatusUpdateResult reportJobFailure(
            String id,
            String workerId,
            String error) {

        Instant now = Instant.now();

        /*
         * First read the current job so the control plane
         * can make the retry-policy decision.
         */
        Optional<Job> existingJob = jobRepository.findById(id);

        if (existingJob.isEmpty()) {

            return new JobStatusUpdateResult(
                    JobStatusUpdateResult.Outcome.NOT_FOUND,
                    null);
        }

        Job job = existingJob.get();

        /*
         * Only the worker that currently owns a RUNNING job
         * with an active lease may report its execution failure.
         */
        boolean validOwner = job.getStatus() == JobStatus.RUNNING
                && job.getWorkerId() != null
                && job.getWorkerId().equals(workerId)
                && job.getLeaseUntil() != null
                && job.getLeaseUntil().isAfter(now);

        if (!validOwner) {

            return new JobStatusUpdateResult(
                    JobStatusUpdateResult.Outcome.CONFLICT,
                    null);
        }

        int maxAttempts = effectiveMaxAttempts(job);

        boolean canRetry = job.getAttempt() < maxAttempts;

        /*
         * Include the current attempt in the atomic query.
         *
         * If something changed after our initial read,
         * findAndModify will fail instead of overwriting
         * newer state.
         */
        Query query = new Query(
                Criteria.where("_id").is(id)
                        .and("status").is(JobStatus.RUNNING)
                        .and("workerId").is(workerId)
                        .and("attempt").is(job.getAttempt())
                        .and("leaseUntil").gt(now));

        Update update = new Update()
                .set("leaseUntil", null)
                .set("lastError", error);

        if (canRetry) {

            Instant nextRetryAt = now.plusSeconds(
                    retryDelaySecondsForAttempt(
                            job.getAttempt()));

            update
                    .set("status", JobStatus.RETRYING)
                    .set("nextRetryAt", nextRetryAt);

        } else {

            update
                    .set("status", JobStatus.FAILED)
                    .set("nextRetryAt", null);
        }

        Job updatedJob = mongoTemplate.findAndModify(
                query,
                update,
                FindAndModifyOptions.options()
                        .returnNew(true),
                Job.class);

        if (updatedJob == null) {

            if (jobRepository.existsById(id)) {

                return new JobStatusUpdateResult(
                        JobStatusUpdateResult.Outcome.CONFLICT,
                        null);
            }

            return new JobStatusUpdateResult(
                    JobStatusUpdateResult.Outcome.NOT_FOUND,
                    null);
        }

        /*
         * A retryable failure is NOT a failed workload.
         *
         * Only update the workload rollup once this job has
         * permanently exhausted its retry budget.
         */
        if (updatedJob.getStatus() == JobStatus.FAILED) {
            updateWorkloadStatus(updatedJob.getWorkloadId());
            sseEventService.broadcastJobUpdated(updatedJob.getId(), updatedJob.getWorkloadId());
        }

        return new JobStatusUpdateResult(
                JobStatusUpdateResult.Outcome.UPDATED,
                updatedJob);
    }

    public JobSummaryResponse getJobSummary() {

        long totalJobs = jobRepository.count();

        long completedJobs = jobRepository.countByStatus(
                JobStatus.COMPLETED);

        return new JobSummaryResponse(
                totalJobs,
                completedJobs);
    }

}
