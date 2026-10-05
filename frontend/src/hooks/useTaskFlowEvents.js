import {
    useEffect,
    useRef,
    useState,
} from "react";

export default function useTaskFlowEvents({
    onConnected,
    onWorkloadUpdated,
    onJobUpdated,
    onWorkersUpdated,
}) {
    const [
        status,
        setStatus,
    ] = useState(
        "CONNECTING",
    );

    const connectedHandlerRef =
        useRef(
            onConnected,
        );

    const workloadHandlerRef =
        useRef(
            onWorkloadUpdated,
        );

    const jobHandlerRef =
        useRef(
            onJobUpdated,
        );

    const workersHandlerRef =
        useRef(
            onWorkersUpdated,
        );

    connectedHandlerRef.current =
        onConnected;

    workloadHandlerRef.current =
        onWorkloadUpdated;

    jobHandlerRef.current =
        onJobUpdated;

    workersHandlerRef.current =
        onWorkersUpdated;

    useEffect(() => {
        const eventSource =
            new EventSource(
                "/api/events",
            );

        eventSource.addEventListener(
            "connected",
            () => {
                setStatus(
                    "CONNECTED",
                );

                connectedHandlerRef
                    .current?.();
            },
        );

        eventSource.addEventListener(
            "heartbeat",
            () => {
                setStatus(
                    "CONNECTED",
                );
            },
        );

        eventSource.addEventListener(
            "workload-updated",
            (event) => {
                setStatus(
                    "CONNECTED",
                );

                try {
                    const data =
                        JSON.parse(
                            event.data,
                        );

                    workloadHandlerRef
                        .current?.(
                            data,
                        );
                } catch {
                    // Ignore malformed events.
                }
            },
        );

        eventSource.addEventListener(
            "job-updated",
            (event) => {
                setStatus(
                    "CONNECTED",
                );

                try {
                    const data =
                        JSON.parse(
                            event.data,
                        );

                    jobHandlerRef
                        .current?.(
                            data,
                        );
                } catch {
                    // Ignore malformed events.
                }
            },
        );

        eventSource.addEventListener(
            "workers-updated",
            (event) => {
                setStatus(
                    "CONNECTED",
                );

                try {
                    const data =
                        JSON.parse(
                            event.data,
                        );

                    workersHandlerRef
                        .current?.(
                            data,
                        );
                } catch {
                    // Ignore malformed events.
                }
            },
        );

        eventSource.addEventListener(
            "workers-updated",
            (event) => {
                setStatus(
                    "CONNECTED",
                );

                try {
                    const data =
                        JSON.parse(
                            event.data,
                        );

                    workersHandlerRef
                        .current?.(
                            data,
                        );
                } catch {
                    // Ignore malformed events.
                }
            },
        );

        eventSource.onerror =
            () => {
                setStatus(
                    "RECONNECTING",
                );
            };

        return () => {
            eventSource.close();
        };
    }, []);

    return status;
}