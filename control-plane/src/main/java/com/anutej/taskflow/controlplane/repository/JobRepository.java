package com.anutej.taskflow.controlplane.repository;

import java.util.List;

import org.springframework.data.mongodb.repository.MongoRepository;

import com.anutej.taskflow.controlplane.model.Job;

import java.time.Instant;

import com.anutej.taskflow.controlplane.model.JobStatus;

public interface JobRepository extends MongoRepository<Job, String> {

    List<Job> findByWorkloadId(String workloadId);

    List<Job> findByStatusAndNextRetryAtLessThanEqual(
            JobStatus status,
            Instant nextRetryAt);

    long countByStatus(JobStatus status);
}