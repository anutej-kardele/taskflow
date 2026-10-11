package com.anutej.taskflow.controlplane.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import com.anutej.taskflow.controlplane.dto.WorkerHealthResponse;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;
import org.springframework.dao.DataAccessException;

@Service
public class WorkerHealthService {

        private static final int DEFAULT_SLOTS = 3;

        private static final List<String> EXPECTED_WORKERS = List.of(
                        "worker-a",
                        "worker-b",
                        "worker-c");

        private final StringRedisTemplate redisTemplate;
        private final JsonMapper jsonMapper;

        public WorkerHealthService(
                        StringRedisTemplate redisTemplate,
                        JsonMapper jsonMapper) {

                this.redisTemplate = redisTemplate;
                this.jsonMapper = jsonMapper;
        }

        public List<WorkerHealthResponse> getWorkers() {

                List<WorkerHealthResponse> workers = new ArrayList<>();

                try {

                        for (String nodeId : EXPECTED_WORKERS) {

                                String key = "taskflow:workers:" + nodeId;

                                String json = redisTemplate
                                                .opsForValue()
                                                .get(key);

                                /*
                                 * Redis is reachable, but this particular
                                 * heartbeat key does not exist.
                                 *
                                 * That means the worker has not refreshed
                                 * its heartbeat within the TTL.
                                 */
                                if (json == null) {

                                        workers.add(
                                                        new WorkerHealthResponse(
                                                                        nodeId,
                                                                        DEFAULT_SLOTS,
                                                                        "OFFLINE",
                                                                        null,
                                                                        null));

                                        continue;
                                }

                                try {

                                        RedisWorkerHealth redisHealth = jsonMapper.readValue(
                                                        json,
                                                        RedisWorkerHealth.class);

                                        workers.add(
                                                        new WorkerHealthResponse(
                                                                        redisHealth.nodeId(),
                                                                        redisHealth.slots(),
                                                                        "ONLINE",
                                                                        redisHealth.startedAt(),
                                                                        redisHealth.lastHeartbeat()));

                                } catch (JacksonException exception) {

                                        throw new IllegalStateException(
                                                        "Failed to parse worker health for "
                                                                        + nodeId,
                                                        exception);
                                }
                        }

                        return workers;

                } catch (DataAccessException exception) {

                        /*
                         * Redis itself is unavailable.
                         *
                         * Do not report workers OFFLINE because their
                         * actual state cannot be determined.
                         */
                        return EXPECTED_WORKERS
                                        .stream()
                                        .map(nodeId -> new WorkerHealthResponse(
                                                        nodeId,
                                                        DEFAULT_SLOTS,
                                                        "UNKNOWN",
                                                        null,
                                                        null))
                                        .toList();
                }
        }

        /*
         * This record represents exactly what the
         * Go workers store inside Redis.
         *
         * status is deliberately NOT stored in Redis.
         * Presence of the Redis key determines ONLINE.
         */
        private record RedisWorkerHealth(
                        String nodeId,
                        int slots,
                        Instant startedAt,
                        Instant lastHeartbeat) {
        }
}