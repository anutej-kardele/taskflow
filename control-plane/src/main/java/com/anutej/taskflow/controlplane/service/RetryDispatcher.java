package com.anutej.taskflow.controlplane.service;

import java.time.Instant;
import java.util.List;

import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.anutej.taskflow.controlplane.messaging.JobPublisher;
import com.anutej.taskflow.controlplane.model.Job;
import com.anutej.taskflow.controlplane.model.JobStatus;
import com.anutej.taskflow.controlplane.repository.JobRepository;

@Service
public class RetryDispatcher {

        private final JobRepository jobRepository;
        private final MongoTemplate mongoTemplate;
        private final JobPublisher jobPublisher;
        private final SseEventService sseEventService;
        private final TaskFlowMetrics taskFlowMetrics;

        public RetryDispatcher(JobRepository jobRepository, MongoTemplate mongoTemplate, JobPublisher jobPublisher,
                        SseEventService sseEventService, TaskFlowMetrics taskFlowMetrics) {

                this.jobRepository = jobRepository;
                this.mongoTemplate = mongoTemplate;
                this.jobPublisher = jobPublisher;
                this.sseEventService = sseEventService;
                this.taskFlowMetrics = taskFlowMetrics;
        }

        @Scheduled(fixedDelay = 500)
        public void dispatchDueRetries() {

                Instant now = Instant.now();

                List<Job> dueJobs = jobRepository
                                .findByStatusAndNextRetryAtLessThanEqual(
                                                JobStatus.RETRYING,
                                                now);

                for (Job job : dueJobs) {

                        requeueAndPublish(job, now);
                }
        }

        private void requeueAndPublish(
                        Job job,
                        Instant now) {

                /*
                 * Atomic transition:
                 *
                 * RETRYING
                 * ↓
                 * QUEUED
                 *
                 * The status + nextRetryAt conditions ensure that
                 * only a due retry can be moved back into the queue.
                 */
                Query query = new Query(
                                Criteria.where("_id").is(job.getId())
                                                .and("status").is(JobStatus.RETRYING)
                                                .and("nextRetryAt").lte(now));

                Update update = new Update()
                                .set("status", JobStatus.QUEUED)
                                .set("nextRetryAt", null)
                                .set("leaseUntil", null)
                                .set("workerId", null)
                                .set("startedAt", null);

                Job requeuedJob = mongoTemplate.findAndModify(
                                query,
                                update,
                                FindAndModifyOptions.options()
                                                .returnNew(true),
                                Job.class);

                /*
                 * Another dispatcher may already have handled it,
                 * or its state may have changed.
                 */
                if (requeuedJob == null) {
                        return;
                }

                taskFlowMetrics.jobRetried(requeuedJob.getType());

                jobPublisher.publish(requeuedJob);

                sseEventService.broadcastJobUpdated(requeuedJob.getId(), requeuedJob.getWorkloadId());

                System.out.printf(
                                "Retrying job %s: attempt %d/%d%n",
                                requeuedJob.getId(),
                                requeuedJob.getAttempt() + 1,
                                requeuedJob.getMaxAttempts());
        }
}