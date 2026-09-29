package com.anutej.taskflow.controlplane.repository;

import org.springframework.data.mongodb.repository.MongoRepository;

import com.anutej.taskflow.controlplane.model.Workload;

public interface WorkloadRepository extends MongoRepository<Workload, String> {
}