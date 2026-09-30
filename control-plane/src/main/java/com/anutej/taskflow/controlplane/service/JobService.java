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

import java.time.Instant;
import java.util.List;

@Service
public class JobService {

    private final JobRepository jobRepository;
    private final MongoTemplate mongoTemplate;

    public JobService(JobRepository jobRepository, MongoTemplate mongoTemplate) {
        this.jobRepository = jobRepository;
        this.mongoTemplate = mongoTemplate;
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

        if (status == JobStatus.COMPLETED) {

            update.set("status", JobStatus.COMPLETED).set("leaseUntil", null);

        } else if (status == JobStatus.FAILED) {

            update.set("status", JobStatus.FAILED).set("leaseUntil", null);

        } else {

            return new JobStatusUpdateResult(
                    JobStatusUpdateResult.Outcome.CONFLICT,
                    null);
        }

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

        return new JobStatusUpdateResult(
                JobStatusUpdateResult.Outcome.UPDATED,
                updatedJob);
    }

    private void updateWorkloadStatus(String workloadId) {

        List<Job> jobs = jobRepository.findByWorkloadId(workloadId);

        if (jobs.isEmpty()) {
            return;
        }

        boolean anyFailed = jobs.stream()
                .anyMatch(job -> job.getStatus() == JobStatus.FAILED);

        boolean allCompleted = jobs.stream()
                .allMatch(job -> job.getStatus() == JobStatus.COMPLETED);

        boolean anyStarted = jobs.stream()
                .anyMatch(job -> job.getStatus() == JobStatus.RUNNING ||
                        job.getStatus() == JobStatus.COMPLETED);

        if (anyFailed) {

            Query query = new Query(
                    Criteria.where("_id").is(workloadId)
                            .and("status")
                            .in(
                                    WorkloadStatus.CREATED,
                                    WorkloadStatus.RUNNING));

            Update update = new Update()
                    .set("status", WorkloadStatus.FAILED);

            mongoTemplate.updateFirst(
                    query,
                    update,
                    Workload.class);

            return;
        }

        if (allCompleted) {

            Query query = new Query(
                    Criteria.where("_id").is(workloadId)
                            .and("status")
                            .is(WorkloadStatus.RUNNING));

            Update update = new Update()
                    .set("status", WorkloadStatus.COMPLETED);

            mongoTemplate.updateFirst(
                    query,
                    update,
                    Workload.class);

            return;
        }

        if (anyStarted) {

            Query query = new Query(
                    Criteria.where("_id").is(workloadId)
                            .and("status")
                            .is(WorkloadStatus.CREATED));

            Update update = new Update()
                    .set("status", WorkloadStatus.RUNNING);

            mongoTemplate.updateFirst(
                    query,
                    update,
                    Workload.class);
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

        return new JobStatusUpdateResult(
                JobStatusUpdateResult.Outcome.UPDATED,
                claimedJob);
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

}