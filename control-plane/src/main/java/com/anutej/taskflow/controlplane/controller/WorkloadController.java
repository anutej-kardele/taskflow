package com.anutej.taskflow.controlplane.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.anutej.taskflow.controlplane.dto.CreateWorkloadRequest;
import com.anutej.taskflow.controlplane.model.Job;
import com.anutej.taskflow.controlplane.model.Workload;
import com.anutej.taskflow.controlplane.service.WorkloadService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/workloads")
public class WorkloadController {

    private final WorkloadService workloadService;

    public WorkloadController(WorkloadService workloadService) {
        this.workloadService = workloadService;
    }

    @PostMapping
    public ResponseEntity<Workload> createWorkload(@Valid @RequestBody CreateWorkloadRequest request) {

        Workload workload = workloadService.createWorkload(request.jobType(), request.jobCount(),
                request.configuration());

        return ResponseEntity.status(HttpStatus.CREATED).body(workload);
    }

    @GetMapping
    public List<Workload> getAllWorkloads() {
        return workloadService.getAllWorkloads();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Workload> getWorkloadById(
            @PathVariable String id) {

        return workloadService.getWorkloadById(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/jobs")
    public ResponseEntity<List<Job>> getJobsByWorkloadId(
            @PathVariable String id) {

        if (workloadService.getWorkloadById(id).isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(
                workloadService.getJobsByWorkloadId(id));
    }
}