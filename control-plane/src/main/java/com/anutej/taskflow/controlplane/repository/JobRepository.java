package com.anutej.taskflow.controlplane.repository;

import java.util.List;

import org.springframework.data.mongodb.repository.MongoRepository;

import com.anutej.taskflow.controlplane.model.Job;

public interface JobRepository extends MongoRepository<Job, String> {

    List<Job> findByWorkloadId(String workloadId);
}