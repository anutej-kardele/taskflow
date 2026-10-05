package com.anutej.taskflow.controlplane.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.anutej.taskflow.controlplane.model.Job;
import com.anutej.taskflow.controlplane.service.JobService;
import com.anutej.taskflow.controlplane.service.JobStatusUpdateResult;

import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;

import com.anutej.taskflow.controlplane.dto.ClaimJobRequest;
import com.anutej.taskflow.controlplane.dto.RenewLeaseRequest;
import com.anutej.taskflow.controlplane.dto.UpdateJobStatusRequest;
import com.anutej.taskflow.controlplane.dto.ReportJobFailureRequest;
import com.anutej.taskflow.controlplane.dto.JobSummaryResponse;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/jobs")
public class JobController {

    private final JobService jobService;

    public JobController(JobService jobService) {
        this.jobService = jobService;
    }

    @GetMapping("/{id}")
    public ResponseEntity<Job> getJobById(@PathVariable String id) {

        return jobService.getJobById(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<Job> updateJobStatus(
            @PathVariable String id,
            @Valid @RequestBody UpdateJobStatusRequest request) {

        JobStatusUpdateResult result = jobService.updateJobStatus(id, request.status(), request.workerId());

        return switch (result.outcome()) {

            case UPDATED ->
                ResponseEntity.ok(result.job());

            case NOT_FOUND ->
                ResponseEntity.notFound().build();

            case CONFLICT ->
                ResponseEntity.status(409).build();
        };
    }

    @PostMapping("/{id}/claim")
    public ResponseEntity<Job> claimJob(
            @PathVariable String id,
            @Valid @RequestBody ClaimJobRequest request) {

        JobStatusUpdateResult result = jobService.claimJob(id, request.workerId());

        return switch (result.outcome()) {

            case UPDATED ->
                ResponseEntity.ok(result.job());

            case NOT_FOUND ->
                ResponseEntity.notFound().build();

            case CONFLICT ->
                ResponseEntity.status(409).build();
        };
    }

    @PatchMapping("/{id}/lease")
    public ResponseEntity<Job> renewLease(
            @PathVariable String id,
            @Valid @RequestBody RenewLeaseRequest request) {

        JobStatusUpdateResult result = jobService.renewLease(
                id,
                request.workerId());

        return switch (result.outcome()) {

            case UPDATED ->
                ResponseEntity.ok(result.job());

            case NOT_FOUND ->
                ResponseEntity.notFound().build();

            case CONFLICT ->
                ResponseEntity.status(409).build();
        };
    }

    @PatchMapping("/{id}/failure")
    public ResponseEntity<Job> reportJobFailure(
            @PathVariable String id,
            @Valid @RequestBody ReportJobFailureRequest request) {

        JobStatusUpdateResult result = jobService.reportJobFailure(
                id,
                request.workerId(),
                request.error());

        return switch (result.outcome()) {

            case UPDATED ->
                ResponseEntity.ok(result.job());

            case NOT_FOUND ->
                ResponseEntity.notFound().build();

            case CONFLICT ->
                ResponseEntity.status(409).build();
        };
    }

    @GetMapping("/summary")
    public ResponseEntity<JobSummaryResponse> getJobSummary() {

        return ResponseEntity.ok(
                jobService.getJobSummary());
    }
}