
import {
    Activity,
    Play,
    PowerOff,
    Server,
} from "lucide-react";

import { useState } from "react";

// Format the time since the latest worker heartbeat.
function formatHeartbeatAge(value) {
    if (!value) {
        return "No heartbeat";
    }

    const timestamp = new Date(value).getTime();

    if (Number.isNaN(timestamp)) {
        return "—";
    }

    const seconds = Math.max(
        0,
        Math.floor((Date.now() - timestamp) / 1000)
    );

    if (seconds <= 1) {
        return "now";
    }

    if (seconds < 60) {
        return `${seconds}s ago`;
    }

    return `${Math.floor(seconds / 60)}m ago`;
}

// Format worker startup time.
function formatStartedAt(value) {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}

// Kubernetes Pod names are generated automatically.
// Docker Compose uses readable names such as worker-a.
function formatWorkerName(nodeId, index) {
    if (nodeId.startsWith("taskflow-worker-")) {
        return `Worker ${index + 1}`;
    }

    return nodeId;
}

export default function WorkerClusterPanel({
    workers = [],
    loading,
    error,
    controlsEnabled,
    onKill,
    onStart,
}) {
    const [pendingActions, setPendingActions] = useState({});
    const [actionError, setActionError] = useState("");

    // Count healthy worker instances.
    const onlineCount = workers.filter(
        (worker) => worker.status === "ONLINE"
    ).length;

    // Maintain a predictable order in the dashboard.
    const orderedWorkers = [...workers].sort(
        (a, b) => a.nodeId.localeCompare(b.nodeId)
    );

    /*
     * Compose worker controls change container state
     * immediately, but Redis heartbeat state changes
     * asynchronously.
     *
     * Pending actions prevent repeated Kill/Start clicks
     * until the target state is observed or a timeout passes.
     */
    function getPendingAction(worker) {
        const pending = pendingActions[worker.nodeId];

        if (!pending) {
            return null;
        }

        if (
            pending.type === "STOPPING" &&
            worker.status === "OFFLINE"
        ) {
            return null;
        }

        if (
            pending.type === "STARTING" &&
            worker.status === "ONLINE"
        ) {
            return null;
        }

        if (Date.now() > pending.expiresAt) {
            return null;
        }

        return pending.type;
    }

    async function handleAction(worker) {
        const online = worker.status === "ONLINE";

        const action = online
            ? "STOPPING"
            : "STARTING";

        setPendingActions((current) => ({
            ...current,
            [worker.nodeId]: {
                type: action,
                expiresAt: Date.now() + 30000,
            },
        }));

        setActionError("");

        try {
            if (online) {
                await onKill(worker.nodeId);
            } else {
                await onStart(worker.nodeId);
            }
        } catch (err) {
            // Unlock the control if the request fails.
            setPendingActions((current) => {
                const next = { ...current };
                delete next[worker.nodeId];
                return next;
            });

            setActionError(
                err?.message || "Worker action failed"
            );
        }
    }

    return (
        <section
            className="
                lg:sticky lg:top-2 lg:z-30
                overflow-hidden
                rounded-lg
                border border-line
                bg-panel/95
                lg:shadow-[0_10px_25px_rgba(0,0,0,0.4)]
                lg:backdrop-blur
            "
        >
            {/* Panel heading */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
                <div className="min-w-0">
                    <h2 className="text-xs font-semibold text-primary">
                        Execution Workers
                    </h2>

                    <p className="mt-0.5 text-[9px] leading-4 text-muted">
                        Concurrent Go workers execute Kafka jobs.
                        Kubernetes supports automatic scaling
                        from 3 to 10 Pods.
                    </p>
                </div>

                {/* Cluster health summary */}
                <div className="flex shrink-0 items-center gap-2">
                    <span
                        className={`h-1.5 w-1.5 rounded-full ${error
                            ? "bg-red-400"
                            : onlineCount > 0
                                ? "bg-emerald-400"
                                : "bg-amber-400"
                            }`}
                    />

                    <span className="font-mono text-[9px] font-medium text-secondary">
                        {onlineCount} online
                    </span>

                    <span className="font-mono text-[8px] text-muted">
                        / {workers.length} workers
                    </span>
                </div>
            </div>

            {/* Worker action errors */}
            {actionError && (
                <div className="border-b border-red-500/20 bg-red-500/[0.06] px-3 py-2 font-mono text-[9px] text-red-400">
                    {actionError}
                </div>
            )}

            {/* Loading, error, and worker list */}
            {loading && workers.length === 0 ? (
                <div className="px-3 py-4 text-center font-mono text-[9px] text-muted">
                    Loading workers...
                </div>
            ) : error ? (
                <div className="px-3 py-3 text-[10px] text-red-400">
                    Worker health unavailable: {error}
                </div>
            ) : workers.length === 0 ? (
                <div className="px-3 py-4 text-center text-[10px] text-muted">
                    No workers discovered
                </div>
            ) : (
                /*
                 * Responsive worker grid:
                 *
                 * Mobile:         1 column
                 * Medium screens: 2 columns
                 * Large screens:  3 columns
                 * Desktop (xl):   5 columns
                 *
                 * 10 workers = 2 rows of 5 on desktop.
                 */
                <div className="grid grid-cols-1 gap-1.5 p-1.5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                    {orderedWorkers.map((worker, index) => {
                        const online =
                            worker.status === "ONLINE";

                        const unknown =
                            worker.status === "UNKNOWN";

                        const pending =
                            getPendingAction(worker);

                        const stopping =
                            pending === "STOPPING";

                        const starting =
                            pending === "STARTING";

                        const transitioning =
                            stopping || starting;

                        const busy =
                            transitioning || unknown;

                        const displayStatus = stopping
                            ? "STOPPING"
                            : starting
                                ? "STARTING"
                                : worker.status;

                        const displayName = formatWorkerName(
                            worker.nodeId,
                            index
                        );

                        // Color the small status indicator.
                        const statusDotColor = transitioning
                            ? "bg-amber-400"
                            : online
                                ? "bg-emerald-400"
                                : unknown
                                    ? "bg-amber-400"
                                    : "bg-red-400";

                        const statusTextColor = transitioning
                            ? "text-amber-400"
                            : online
                                ? "text-emerald-400"
                                : unknown
                                    ? "text-amber-400"
                                    : "text-red-400";

                        return (
                            <div
                                key={worker.nodeId}
                                title={worker.nodeId}
                                className={`
                                    flex min-w-0 items-center
                                    gap-2 rounded-md border
                                    bg-raised px-2 py-1.5

                                    ${unknown
                                        ? "border-amber-500/20"
                                        : !online && !starting
                                            ? "border-red-500/15"
                                            : "border-line"
                                    }
                                `}
                            >
                                {/* Worker icon */}
                                <div
                                    className={`
                                        flex h-7 w-7 shrink-0
                                        items-center justify-center
                                        rounded-md border

                                        ${online
                                            ? "border-blue-500/20 bg-blue-500/[0.07] text-blue-400"
                                            : unknown
                                                ? "border-amber-500/20 bg-amber-500/[0.06] text-amber-400"
                                                : "border-line bg-control text-muted"
                                        }
                                    `}
                                >
                                    <Server size={12} />
                                </div>

                                {/* Worker identity and heartbeat */}
                                <div className="min-w-0 flex-1">
                                    <div className="flex min-w-0 items-center gap-1.5">
                                        <p
                                            className="min-w-0 truncate font-mono text-[9px] font-medium text-secondary"
                                            title={worker.nodeId}
                                        >
                                            {displayName}
                                        </p>

                                        <span
                                            className={`
                                                h-1.5 w-1.5 shrink-0
                                                rounded-full
                                                ${statusDotColor}
                                            `}
                                        />

                                        <span
                                            className={`
                                                shrink-0 font-mono
                                                text-[6px] uppercase
                                                tracking-wider
                                                ${statusTextColor}
                                            `}
                                        >
                                            {displayStatus}
                                        </span>
                                    </div>

                                    <div className="mt-0.5 flex min-w-0 items-center gap-2 font-mono text-[6px] text-muted">
                                        <span className="flex shrink-0 items-center gap-1">
                                            <Activity size={7} />

                                            {formatHeartbeatAge(
                                                worker.lastHeartbeat
                                            )}
                                        </span>

                                        <span className="truncate">
                                            Started{" "}
                                            {formatStartedAt(
                                                worker.startedAt
                                            )}
                                        </span>
                                    </div>
                                </div>

                                {/*
                                 * Worker Kill/Start controls.
                                 *
                                 * These remain hidden in the
                                 * Kubernetes deployment because
                                 * worker controls are disabled
                                 * by the backend configuration.
                                 */}
                                {controlsEnabled && (
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() =>
                                            handleAction(worker)
                                        }
                                        title={`${online ? "Stop" : "Start"} ${worker.nodeId}`}
                                        className={`
                                            flex h-7 min-w-[58px]
                                            shrink-0 items-center
                                            justify-center gap-1
                                            rounded-md border px-1.5
                                            font-mono text-[7px]
                                            uppercase tracking-wider
                                            transition

                                            ${transitioning
                                                ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                                                : online
                                                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                                                    : unknown
                                                        ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                                                        : "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                                            }

                                            disabled:cursor-not-allowed
                                            disabled:opacity-70
                                        `}
                                    >
                                        {online ? (
                                            <PowerOff size={10} />
                                        ) : (
                                            <Play size={10} />
                                        )}

                                        {stopping
                                            ? "Stopping"
                                            : starting
                                                ? "Starting"
                                                : unknown
                                                    ? "Unknown"
                                                    : online
                                                        ? "Kill"
                                                        : "Start"}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}
