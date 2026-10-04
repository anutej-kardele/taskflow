package com.anutej.taskflow.controlplane.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.anutej.taskflow.controlplane.dto.WorkerControlResponse;
import com.anutej.taskflow.controlplane.service.WorkerControlService;

@RestController
@RequestMapping("/api/workers")
public class WorkerControlController {

    private final WorkerControlService workerControlService;

    public WorkerControlController(
            WorkerControlService workerControlService) {

        this.workerControlService = workerControlService;
    }

    @PostMapping("/{nodeId}/kill")
    public ResponseEntity<WorkerControlResponse> killWorker(
            @PathVariable String nodeId) {

        if (!workerControlService.controlsEnabled()) {

            return ResponseEntity
                    .status(HttpStatus.FORBIDDEN)
                    .body(
                            new WorkerControlResponse(
                                    nodeId,
                                    "KILL",
                                    "Worker controls are disabled"));
        }

        if (!workerControlService.isKnownWorker(nodeId)) {

            return ResponseEntity
                    .status(HttpStatus.NOT_FOUND)
                    .body(
                            new WorkerControlResponse(
                                    nodeId,
                                    "KILL",
                                    "Unknown worker"));
        }

        boolean killed = workerControlService.killWorker(
                nodeId);

        return ResponseEntity.ok(
                new WorkerControlResponse(
                        nodeId,
                        "KILL",
                        killed
                                ? "Worker container killed"
                                : "Worker container already stopped"));
    }

    @PostMapping("/{nodeId}/start")
    public ResponseEntity<WorkerControlResponse> startWorker(
            @PathVariable String nodeId) {

        if (!workerControlService.controlsEnabled()) {

            return ResponseEntity
                    .status(HttpStatus.FORBIDDEN)
                    .body(
                            new WorkerControlResponse(
                                    nodeId,
                                    "START",
                                    "Worker controls are disabled"));
        }

        if (!workerControlService.isKnownWorker(nodeId)) {

            return ResponseEntity
                    .status(HttpStatus.NOT_FOUND)
                    .body(
                            new WorkerControlResponse(
                                    nodeId,
                                    "START",
                                    "Unknown worker"));
        }

        boolean started = workerControlService.startWorker(
                nodeId);

        return ResponseEntity.ok(
                new WorkerControlResponse(
                        nodeId,
                        "START",
                        started
                                ? "Worker container started"
                                : "Worker container already running"));
    }
}