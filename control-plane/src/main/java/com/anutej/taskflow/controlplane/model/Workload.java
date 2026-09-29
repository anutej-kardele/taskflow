package com.anutej.taskflow.controlplane.model;

import java.time.Instant;
import java.util.Map;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "workloads")
public class Workload {

    @Id
    private String id;

    private JobType jobType;

    private int jobCount;

    private WorkloadStatus status;

    private Map<String, Object> configuration;

    private Instant createdAt;

    public Workload() {
    }

    public Workload(
            String id,
            JobType jobType,
            int jobCount,
            WorkloadStatus status,
            Map<String, Object> configuration,
            Instant createdAt) {

        this.id = id;
        this.jobType = jobType;
        this.jobCount = jobCount;
        this.status = status;
        this.configuration = configuration;
        this.createdAt = createdAt;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public JobType getJobType() {
        return jobType;
    }

    public void setJobType(JobType jobType) {
        this.jobType = jobType;
    }

    public int getJobCount() {
        return jobCount;
    }

    public void setJobCount(int jobCount) {
        this.jobCount = jobCount;
    }

    public WorkloadStatus getStatus() {
        return status;
    }

    public void setStatus(WorkloadStatus status) {
        this.status = status;
    }

    public Map<String, Object> getConfiguration() {
        return configuration;
    }

    public void setConfiguration(Map<String, Object> configuration) {
        this.configuration = configuration;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}