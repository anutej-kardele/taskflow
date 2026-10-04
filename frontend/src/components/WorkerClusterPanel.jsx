import {
    Activity,
    Play,
    PowerOff,
    Server,
} from "lucide-react";

import {
    useState,
} from "react";

function formatHeartbeatAge(value) {
    if (!value) {
        return "No heartbeat";
    }

    const timestamp =
        new Date(value).getTime();

    if (Number.isNaN(timestamp)) {
        return "—";
    }

    const seconds =
        Math.max(
            0,
            Math.floor(
                (Date.now() - timestamp) /
                1000,
            ),
        );

    if (seconds <= 1) {
        return "now";
    }

    if (seconds < 60) {
        return `${seconds}s ago`;
    }

    return `${Math.floor(
        seconds / 60,
    )}m ago`;
}

function formatStartedAt(value) {
    if (!value) {
        return "—";
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime(),
        )
    ) {
        return "—";
    }

    return date.toLocaleTimeString(
        [],
        {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        },
    );
}

export default function WorkerClusterPanel({
    workers,
    loading,
    error,
    onKill,
    onStart,
}) {
    const [
        pendingActions,
        setPendingActions,
    ] = useState({});

    const [
        actionError,
        setActionError,
    ] = useState("");

    /*
     * Docker state changes immediately, while Redis health
     * changes only after the heartbeat TTL reflects it.
     *
     * This temporary UI state prevents users from clicking
     * Kill repeatedly while Redis still reports ONLINE.
     */
    function getPendingAction(
        worker,
    ) {
        const pending =
            pendingActions[
            worker.nodeId
            ];

        if (!pending) {
            return null;
        }

        /*
         * Target state has been observed.
         */
        if (
            pending.type ===
            "STOPPING" &&
            worker.status ===
            "OFFLINE"
        ) {
            return null;
        }

        if (
            pending.type ===
            "STARTING" &&
            worker.status ===
            "ONLINE"
        ) {
            return null;
        }

        /*
         * Safety timeout prevents a control from
         * remaining disabled forever.
         */
        if (
            Date.now() >
            pending.expiresAt
        ) {
            return null;
        }

        return pending.type;
    }

    async function handleAction(
        worker,
    ) {
        const online =
            worker.status ===
            "ONLINE";

        const action =
            online
                ? "STOPPING"
                : "STARTING";

        /*
         * Immediately lock this worker control.
         */
        setPendingActions(
            (current) => ({
                ...current,

                [worker.nodeId]: {
                    type: action,

                    expiresAt:
                        Date.now() +
                        30000,
                },
            }),
        );

        setActionError("");

        try {

            if (online) {

                await onKill(
                    worker.nodeId,
                );

            } else {

                await onStart(
                    worker.nodeId,
                );
            }

        } catch (err) {

            /*
             * Command failed.
             * Remove temporary state so the user
             * can try the action again.
             */
            setPendingActions(
                (current) => {
                    const next = {
                        ...current,
                    };

                    delete next[
                        worker.nodeId
                    ];

                    return next;
                },
            );

            setActionError(
                err.message,
            );
        }
    }

    return (
        <section
            className="
                lg:sticky lg:top-2 lg:z-30
                overflow-hidden
                rounded-lg
                border border-zinc-800
                bg-[#0a0c10]/95
                lg:shadow-[0_10px_25px_rgba(0,0,0,0.4)]
                lg:backdrop-blur
            "
        >
            {actionError && (
                <div className="border-b border-red-500/20 bg-red-500/[0.06] px-2.5 py-1.5 font-mono text-[8px] text-red-300">
                    {actionError}
                </div>
            )}

            {loading &&
                workers.length === 0 ? (
                <div className="px-3 py-3 text-center font-mono text-[8px] uppercase tracking-wider text-zinc-600">
                    Loading workers...
                </div>
            ) : error ? (
                <div className="px-3 py-2 text-[9px] text-red-300">
                    Worker health unavailable:{" "}
                    {error}
                </div>
            ) : (
                <div className="grid gap-1.5 p-1.5 md:grid-cols-2 xl:grid-cols-3">
                    {workers.map(
                        (worker) => {
                            const online =
                                worker.status ===
                                "ONLINE";

                            const pending =
                                getPendingAction(
                                    worker,
                                );

                            const stopping =
                                pending ===
                                "STOPPING";

                            const starting =
                                pending ===
                                "STARTING";

                            const busy =
                                stopping ||
                                starting;

                            const displayStatus =
                                stopping
                                    ? "STOPPING"
                                    : starting
                                        ? "STARTING"
                                        : worker.status;

                            return (
                                <div
                                    key={
                                        worker.nodeId
                                    }
                                    className={`
                                        flex
                                        min-w-0
                                        items-center
                                        gap-2
                                        rounded-md
                                        border
                                        bg-[#07090d]
                                        px-2
                                        py-1.5

                                        ${!online &&
                                            !starting
                                            ? "border-red-500/15"
                                            : "border-zinc-800"
                                        }
                                    `}
                                >
                                    {/*
                                      Worker icon
                                    */}
                                    <div
                                        className={`
                                            flex
                                            h-7
                                            w-7
                                            shrink-0
                                            items-center
                                            justify-center
                                            rounded-md
                                            border

                                            ${online
                                                ? "border-blue-500/20 bg-blue-500/[0.07] text-blue-400"
                                                : "border-zinc-800 bg-zinc-950 text-zinc-600"
                                            }
                                        `}
                                    >
                                        <Server
                                            size={
                                                12
                                            }
                                        />
                                    </div>

                                    {/*
                                      Worker identity and health
                                    */}
                                    <div className="min-w-0 flex-1">
                                        <div className="flex min-w-0 items-center gap-1.5">
                                            <p className="truncate font-mono text-[8px] font-medium text-zinc-200">
                                                {
                                                    worker.nodeId
                                                }
                                            </p>

                                            <span
                                                className={`
                                                    h-1.5
                                                    w-1.5
                                                    shrink-0
                                                    rounded-full

                                                    ${stopping ||
                                                        starting
                                                        ? "bg-amber-400"
                                                        : online
                                                            ? "bg-emerald-400"
                                                            : "bg-red-400"
                                                    }
                                                `}
                                            />

                                            <span
                                                className={`
                                                    shrink-0
                                                    font-mono
                                                    text-[6px]
                                                    uppercase
                                                    tracking-wider

                                                    ${stopping ||
                                                        starting
                                                        ? "text-amber-400"
                                                        : online
                                                            ? "text-emerald-400"
                                                            : "text-red-400"
                                                    }
                                                `}
                                            >
                                                {
                                                    displayStatus
                                                }
                                            </span>
                                        </div>

                                        <div className="mt-0.5 flex min-w-0 items-center gap-2 font-mono text-[6px] text-zinc-600">
                                            <span className="flex shrink-0 items-center gap-1">
                                                <Activity
                                                    size={
                                                        7
                                                    }
                                                />

                                                {formatHeartbeatAge(
                                                    worker.lastHeartbeat,
                                                )}
                                            </span>

                                            <span className="truncate">
                                                Started{" "}
                                                {formatStartedAt(
                                                    worker.startedAt,
                                                )}
                                            </span>
                                        </div>
                                    </div>

                                    {/*
                                      Slot count

                                      Fixed dimensions and flex centering
                                      keep the number perfectly centered.
                                    */}
                                    <div className="flex h-7 w-9 shrink-0 flex-col items-center justify-center rounded-md border border-zinc-800 bg-zinc-950 text-center">
                                        <span className="font-mono text-[5px] uppercase leading-none tracking-wider text-zinc-600">
                                            Slots
                                        </span>

                                        <span className="mt-0.5 text-[11px] font-semibold leading-none text-zinc-200">
                                            {
                                                worker.slots
                                            }
                                        </span>
                                    </div>

                                    {/*
                                      Failure control
                                    */}
                                    <button
                                        type="button"
                                        disabled={
                                            busy
                                        }
                                        onClick={() =>
                                            handleAction(
                                                worker,
                                            )
                                        }
                                        className={`
                                            flex
                                            h-7
                                            min-w-[58px]
                                            shrink-0
                                            items-center
                                            justify-center
                                            gap-1
                                            rounded-md
                                            border
                                            px-1.5
                                            font-mono
                                            text-[7px]
                                            uppercase
                                            tracking-wider
                                            transition

                                            ${stopping ||
                                                starting
                                                ? "border-amber-500/20 bg-amber-500/[0.06] text-amber-400"
                                                : online
                                                    ? "border-red-500/20 bg-red-500/[0.06] text-red-400 hover:border-red-500/40 hover:bg-red-500/10"
                                                    : "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-400 hover:border-emerald-500/40 hover:bg-emerald-500/10"
                                            }

                                            disabled:cursor-not-allowed
                                            disabled:opacity-70
                                        `}
                                    >
                                        {online ? (
                                            <PowerOff
                                                size={
                                                    9
                                                }
                                            />
                                        ) : (
                                            <Play
                                                size={
                                                    9
                                                }
                                            />
                                        )}

                                        {stopping
                                            ? "Stopping"
                                            : starting
                                                ? "Starting"
                                                : online
                                                    ? "Kill"
                                                    : "Start"}
                                    </button>
                                </div>
                            );
                        },
                    )}
                </div>
            )}
        </section>
    );
}