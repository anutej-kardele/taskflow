package com.anutej.taskflow.controlplane.service;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Service
public class SseEventService {

    /*
     * CopyOnWriteArrayList is useful here because:
     *
     * - connections are added/removed relatively rarely
     * - broadcasts iterate over the list frequently
     * - it is safe to use from multiple request/scheduler threads
     */
    private final CopyOnWriteArrayList<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    public SseEmitter connect() {

        /*
         * 0 means no application-level timeout.
         *
         * The connection remains open until:
         *
         * - the browser disconnects
         * - the server shuts down
         * - an I/O error occurs
         */
        SseEmitter emitter = new SseEmitter(0L);

        emitters.add(emitter);

        /*
         * Remove dead emitters so we do not keep
         * references to closed browser connections.
         */
        emitter.onCompletion(
                () -> emitters.remove(emitter));

        emitter.onTimeout(
                () -> emitters.remove(emitter));

        emitter.onError(
                exception -> emitters.remove(emitter));

        /*
         * Send something immediately.
         *
         * This proves that the SSE stream is established
         * instead of leaving the browser waiting for the
         * first real TaskFlow event.
         */
        try {

            emitter.send(
                    SseEmitter
                            .event()
                            .name("connected")
                            .data(
                                    Map.of(
                                            "message",
                                            "TaskFlow SSE connected",
                                            "timestamp",
                                            Instant.now()
                                                    .toString())));

        } catch (IOException exception) {

            emitters.remove(emitter);

            emitter.completeWithError(
                    exception);
        }

        return emitter;
    }

    public void broadcast(
            String eventName,
            Object data) {

        for (SseEmitter emitter : emitters) {

            try {

                emitter.send(
                        SseEmitter
                                .event()
                                .name(eventName)
                                .data(data));

            } catch (IOException exception) {

                /*
                 * The client disappeared or the
                 * connection can no longer be written.
                 */
                emitters.remove(emitter);

                emitter.complete();
            }
        }
    }

    /*
     * Keep the SSE connection active and make the
     * stream easy to verify during Phase 10.1.
     *
     * This is an SSE connection heartbeat.
     * It is unrelated to the Redis worker heartbeat.
     */
    @Scheduled(fixedRate = 10000)
    public void sendHeartbeat() {

        if (emitters.isEmpty()) {
            return;
        }

        broadcast(
                "heartbeat",
                Map.of(
                        "timestamp",
                        Instant.now()
                                .toString()));
    }

    public int connectionCount() {
        return emitters.size();
    }

    public void broadcastWorkloadUpdated(
            String workloadId) {

        broadcast(
                "workload-updated",
                Map.of(
                        "workloadId",
                        workloadId,
                        "timestamp",
                        Instant.now()
                                .toString()));
    }

    public void broadcastJobUpdated(
            String jobId,
            String workloadId) {

        broadcast(
                "job-updated",
                Map.of(
                        "jobId",
                        jobId,
                        "workloadId",
                        workloadId,
                        "timestamp",
                        Instant.now()
                                .toString()));
    }

    public void broadcastWorkersUpdated() {

        broadcast(
                "workers-updated",
                Map.of(
                        "timestamp",
                        Instant.now()
                                .toString()));
    }
}