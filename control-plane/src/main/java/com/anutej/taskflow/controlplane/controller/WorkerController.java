package com.anutej.taskflow.controlplane.controller;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.anutej.taskflow.controlplane.dto.WorkerHealthResponse;
import com.anutej.taskflow.controlplane.service.WorkerHealthService;

@RestController
@RequestMapping("/api/workers")
public class WorkerController {

    private final WorkerHealthService workerHealthService;

    public WorkerController(
            WorkerHealthService workerHealthService) {

        this.workerHealthService = workerHealthService;
    }

    @GetMapping
    public List<WorkerHealthResponse> getWorkers() {

        return workerHealthService.getWorkers();
    }
}