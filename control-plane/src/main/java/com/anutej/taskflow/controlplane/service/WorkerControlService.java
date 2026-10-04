package com.anutej.taskflow.controlplane.service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class WorkerControlService {

    private static final Map<String, String> WORKER_CONTAINERS = Map.of(
            "worker-a", "taskflow-worker-a",
            "worker-b", "taskflow-worker-b",
            "worker-c", "taskflow-worker-c");

    private final boolean controlsEnabled;

    public WorkerControlService(
            @Value("${taskflow.worker-controls.enabled:false}") boolean controlsEnabled) {

        this.controlsEnabled = controlsEnabled;
    }

    public boolean controlsEnabled() {
        return controlsEnabled;
    }

    public boolean isKnownWorker(
            String nodeId) {

        return WORKER_CONTAINERS.containsKey(
                nodeId);
    }

    public boolean killWorker(
            String nodeId) {

        String containerName = requireContainer(nodeId);

        if (!isContainerRunning(
                containerName)) {

            return false;
        }

        runDockerCommand(
                "docker",
                "kill",
                containerName);

        return true;
    }

    public boolean startWorker(
            String nodeId) {

        String containerName = requireContainer(nodeId);

        if (isContainerRunning(
                containerName)) {

            return false;
        }

        runDockerCommand(
                "docker",
                "start",
                containerName);

        return true;
    }

    private boolean isContainerRunning(
            String containerName) {

        String output = runDockerCommand(
                "docker",
                "inspect",
                "-f",
                "{{.State.Running}}",
                containerName);

        return Boolean.parseBoolean(
                output.trim());
    }

    private String runDockerCommand(
            String... command) {

        Process process;

        try {

            ProcessBuilder processBuilder = new ProcessBuilder(
                    command);

            processBuilder.redirectErrorStream(
                    true);

            process = processBuilder.start();

        } catch (IOException exception) {

            throw new IllegalStateException(
                    "Failed to execute Docker command",
                    exception);
        }

        try {

            boolean finished = process.waitFor(
                    10,
                    TimeUnit.SECONDS);

            if (!finished) {

                process.destroyForcibly();

                throw new IllegalStateException(
                        "Docker command timed out");
            }

            String output = new String(
                    process
                            .getInputStream()
                            .readAllBytes(),
                    StandardCharsets.UTF_8)
                    .trim();

            if (process.exitValue() != 0) {

                throw new IllegalStateException(
                        "Docker command failed: "
                                + output);
            }

            return output;

        } catch (InterruptedException exception) {

            Thread.currentThread()
                    .interrupt();

            throw new IllegalStateException(
                    "Docker command interrupted",
                    exception);

        } catch (IOException exception) {

            throw new IllegalStateException(
                    "Failed reading Docker command output",
                    exception);
        }
    }

    private String requireContainer(
            String nodeId) {

        String containerName = WORKER_CONTAINERS.get(
                nodeId);

        if (containerName == null) {
            throw new IllegalArgumentException(
                    "Unknown worker: "
                            + nodeId);
        }

        return containerName;
    }
}