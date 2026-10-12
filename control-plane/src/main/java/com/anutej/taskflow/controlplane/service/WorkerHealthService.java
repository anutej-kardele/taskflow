
package com.anutej.taskflow.controlplane.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import com.anutej.taskflow.controlplane.dto.WorkerHealthResponse;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

@Service
public class WorkerHealthService {

        private static final int DEFAULT_SLOTS = 3;

        private static final String WORKER_KEY_PREFIX = "taskflow:workers:";

        private static final List<String> EXPECTED_WORKERS = List.of("worker-a", "worker-b", "worker-c");

        private final StringRedisTemplate redisTemplate;
        private final JsonMapper jsonMapper;
        private final boolean dynamicDiscovery;

        private volatile List<WorkerHealthResponse> lastObserved = List.of();

        public WorkerHealthService(
                        StringRedisTemplate redisTemplate,
                        JsonMapper jsonMapper,
                        @Value("${taskflow.worker-discovery.mode:static}") String discoveryMode) {

                this.redisTemplate = redisTemplate;
                this.jsonMapper = jsonMapper;

                if (!discoveryMode.equalsIgnoreCase("static")
                                && !discoveryMode.equalsIgnoreCase("dynamic")) {
                        throw new IllegalArgumentException(
                                        "Invalid worker discovery mode: " + discoveryMode);
                }

                this.dynamicDiscovery = discoveryMode.equalsIgnoreCase("dynamic");
        }

        public List<WorkerHealthResponse> getWorkers() {

                try {
                        return dynamicDiscovery
                                        ? getDynamicWorkers()
                                        : getStaticWorkers();

                } catch (DataAccessException exception) {

                        if (dynamicDiscovery) {
                                return lastObserved.stream()
                                                .map(worker -> new WorkerHealthResponse(
                                                                worker.nodeId(),
                                                                worker.slots(),
                                                                "UNKNOWN",
                                                                worker.startedAt(),
                                                                worker.lastHeartbeat()))
                                                .toList();
                        }

                        return EXPECTED_WORKERS.stream()
                                        .map(nodeId -> new WorkerHealthResponse(
                                                        nodeId,
                                                        DEFAULT_SLOTS,
                                                        "UNKNOWN",
                                                        null,
                                                        null))
                                        .toList();
                }
        }

        private List<WorkerHealthResponse> getStaticWorkers() {

                List<WorkerHealthResponse> workers = new ArrayList<>();

                for (String nodeId : EXPECTED_WORKERS) {

                        String key = WORKER_KEY_PREFIX + nodeId;

                        String json = redisTemplate.opsForValue().get(key);

                        if (json == null) {
                                workers.add(new WorkerHealthResponse(
                                                nodeId,
                                                DEFAULT_SLOTS,
                                                "OFFLINE",
                                                null,
                                                null));
                                continue;
                        }

                        workers.add(parseWorker(key, json));
                }

                return workers;
        }

        private List<WorkerHealthResponse> getDynamicWorkers() {

                Map<String, WorkerHealthResponse> discovered = new TreeMap<>();

                ScanOptions options = ScanOptions.scanOptions()
                                .match(WORKER_KEY_PREFIX + "*")
                                .count(100)
                                .build();

                try (Cursor<String> cursor = redisTemplate.scan(options)) {

                        while (cursor.hasNext()) {

                                String key = cursor.next();

                                String json = redisTemplate
                                                .opsForValue()
                                                .get(key);

                                // Heartbeat may expire between SCAN and GET.
                                if (json == null) {
                                        continue;
                                }

                                WorkerHealthResponse worker = parseWorker(key, json);

                                discovered.put(worker.nodeId(), worker);
                        }
                }

                List<WorkerHealthResponse> workers = List.copyOf(discovered.values());

                lastObserved = workers;

                return workers;
        }

        private WorkerHealthResponse parseWorker(
                        String key,
                        String json) {

                try {
                        RedisWorkerHealth health = jsonMapper.readValue(
                                        json,
                                        RedisWorkerHealth.class);

                        return new WorkerHealthResponse(
                                        health.nodeId(),
                                        health.slots(),
                                        "ONLINE",
                                        health.startedAt(),
                                        health.lastHeartbeat());

                } catch (JacksonException exception) {
                        throw new IllegalStateException(
                                        "Failed to parse worker health for " + key,
                                        exception);
                }
        }

        private record RedisWorkerHealth(
                        String nodeId,
                        int slots,
                        Instant startedAt,
                        Instant lastHeartbeat) {
        }
}
