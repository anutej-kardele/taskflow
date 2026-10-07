import {
    MousePointerClick,
    Server,
} from "lucide-react";

import StatusBadge from "./StatusBadge";
import StatCard from "./StatCard";

export default function WorkloadDetails({
    workload,
    jobs,
}) {
    if (!workload) {
        return (
            <section className="flex min-h-[330px] flex-col items-center justify-center rounded-xl border border-zinc-800 bg-[#0a0c10] px-6 text-center">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-blue-500/15 bg-blue-500/[0.05] text-blue-500/60">
                    <MousePointerClick
                        size={17}
                    />
                </div>

                <p className="text-sm text-zinc-400">
                    Select a workload
                </p>

                <p className="mt-1 text-xs text-zinc-600">
                    Inspect job execution,
                    attempts and worker assignment.
                </p>
            </section>
        );
    }

    const count = (status) =>
        jobs.filter(
            (job) =>
                job.status === status,
        ).length;

    const queued = count("QUEUED");
    const running = count("RUNNING");
    const retrying = count("RETRYING");
    const completed = count("COMPLETED");
    const failed = count("FAILED");

    const terminal =
        completed + failed;

    const progress =
        workload.jobCount > 0
            ? terminal >=
                workload.jobCount
                ? 100
                : Math.floor(
                    (terminal /
                        workload.jobCount) *
                    100,
                )
            : 0;

    /*
     * attempt begins at 1 on the first claim.
     *
     * attempt 1 -> 0 additional attempts
     * attempt 2 -> 1 additional attempt
     * attempt 3 -> 2 additional attempts
     */
    const reattempts =
        jobs.reduce(
            (total, job) =>
                total +
                Math.max(
                    (job.attempt ?? 0) - 1,
                    0,
                ),
            0,
        );

    /*
     * A recovered job eventually completed
     * after more than one execution attempt.
     */
    const recovered =
        jobs.filter(
            (job) =>
                job.status ===
                "COMPLETED" &&
                (job.attempt ?? 0) >
                1,
        ).length;

    /*
     * Phase 11.2
     *
     * workerId identifies an execution slot:
     *
     * worker-a-slot-1
     * worker-a-slot-2
     *
     * For Jobs per Worker we aggregate those
     * slots into their parent worker node:
     *
     * worker-a
     */
    const workerDistributionMap =
        jobs.reduce(
            (distribution, job) => {
                if (!job.workerId) {
                    return distribution;
                }

                const nodeId =
                    workerNodeId(
                        job.workerId,
                    );

                distribution.set(
                    nodeId,
                    (
                        distribution.get(
                            nodeId,
                        ) ?? 0
                    ) + 1,
                );

                return distribution;
            },
            new Map(),
        );

    const workerDistribution =
        Array.from(
            workerDistributionMap.entries(),
        )
            .map(
                ([
                    nodeId,
                    jobCount,
                ]) => ({
                    nodeId,
                    jobCount,
                }),
            )
            .sort(
                (a, b) =>
                    a.nodeId.localeCompare(
                        b.nodeId,
                    ),
            );

    const assignedJobs =
        workerDistribution.reduce(
            (total, worker) =>
                total +
                worker.jobCount,
            0,
        );

    const unassignedJobs =
        Math.max(
            jobs.length -
            assignedJobs,
            0,
        );

    /*
     * Workers Used now represents worker nodes,
     * not individual execution slots.
     */
    const workersUsed =
        workerDistribution.length;

    /*
 * Phase 11.4
 *
 * Two different latency measurements:
 *
 * Execution:
 * completedAt - startedAt
 *
 * End-to-end:
 * completedAt - createdAt
 *
 * E2E includes queueing, execution and retries.
 *
 * Because startedAt is updated when a job is
 * claimed again, execution latency represents
 * the final successful execution attempt.
 */

    const completedTimingJobs =
        jobs
            .filter(
                (job) =>
                    job.status ===
                    "COMPLETED" &&
                    job.createdAt &&
                    job.completedAt,
            )
            .map((job) => {
                const createdAt =
                    new Date(
                        job.createdAt,
                    ).getTime();

                const completedAt =
                    new Date(
                        job.completedAt,
                    ).getTime();

                return {
                    createdAt,
                    completedAt,
                    e2eLatencyMs:
                        completedAt -
                        createdAt,
                };
            })
            .filter(
                (job) =>
                    Number.isFinite(
                        job.createdAt,
                    ) &&
                    Number.isFinite(
                        job.completedAt,
                    ) &&
                    job.e2eLatencyMs >= 0,
            );

    const executionTimingJobs =
        jobs
            .filter(
                (job) =>
                    job.status ===
                    "COMPLETED" &&
                    job.startedAt &&
                    job.completedAt,
            )
            .map((job) => {
                const startedAt =
                    new Date(
                        job.startedAt,
                    ).getTime();

                const completedAt =
                    new Date(
                        job.completedAt,
                    ).getTime();

                return {
                    executionLatencyMs:
                        completedAt -
                        startedAt,
                };
            })
            .filter(
                (job) =>
                    Number.isFinite(
                        job.executionLatencyMs,
                    ) &&
                    job.executionLatencyMs >= 0,
            );

    const e2eLatenciesMs =
        completedTimingJobs
            .map(
                (job) =>
                    job.e2eLatencyMs,
            )
            .sort(
                (a, b) =>
                    a - b,
            );

    const executionLatenciesMs =
        executionTimingJobs
            .map(
                (job) =>
                    job.executionLatencyMs,
            )
            .sort(
                (a, b) =>
                    a - b,
            );

    const averageExecutionMs =
        average(
            executionLatenciesMs,
        );

    const p95ExecutionMs =
        percentile95(
            executionLatenciesMs,
        );

    const averageE2eMs =
        average(
            e2eLatenciesMs,
        );

    const p95E2eMs =
        percentile95(
            e2eLatenciesMs,
        );

    const earliestCreatedAt =
        completedTimingJobs.length > 0
            ? Math.min(
                ...completedTimingJobs.map(
                    (job) =>
                        job.createdAt,
                ),
            )
            : null;

    const latestCompletedAt =
        completedTimingJobs.length > 0
            ? Math.max(
                ...completedTimingJobs.map(
                    (job) =>
                        job.completedAt,
                ),
            )
            : null;

    const throughputDurationSeconds =
        earliestCreatedAt !== null &&
            latestCompletedAt !== null
            ? (latestCompletedAt -
                earliestCreatedAt) /
            1000
            : null;

    const jobsPerSecond =
        throughputDurationSeconds > 0
            ? completedTimingJobs.length /
            throughputDurationSeconds
            : null;

    return (
        <section className="overflow-hidden rounded-xl border border-zinc-800 bg-[#0a0c10]">
            <div className="border-b border-zinc-800 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-blue-400">
                            Selected Workload
                        </p>

                        <div className="mt-1.5 flex items-center gap-2.5">
                            <h2 className="text-lg font-semibold text-white">
                                {
                                    workload.jobType
                                }
                            </h2>

                            <StatusBadge
                                status={
                                    workload.status
                                }
                            />
                        </div>

                        <p
                            title={workload.id}
                            className="mt-1 max-w-[520px] truncate font-mono text-[9px] text-zinc-600"
                        >
                            <span className="text-zinc-500">
                                WorkloadID:
                            </span>{" "}
                            {workload.id}
                        </p>
                    </div>

                    <div className="text-right">
                        <p className="text-2xl font-semibold tracking-tight text-blue-300">
                            {progress}%
                        </p>

                        <p className="font-mono text-[8px] uppercase tracking-wider text-zinc-600">
                            processed
                        </p>
                    </div>
                </div>

                <div className="mt-3 h-1 overflow-hidden rounded-full bg-zinc-900">
                    <div
                        className="h-full rounded-full bg-blue-500 transition-all duration-500"
                        style={{
                            width: `${progress}%`,
                        }}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 p-3 sm:grid-cols-4">
                <StatCard
                    label="Queued"
                    value={queued}
                />

                <StatCard
                    label="Running"
                    value={running}
                    accent
                />

                <StatCard
                    label="Retrying"
                    value={retrying}
                />

                <StatCard
                    label="Completed"
                    value={completed}
                />

                <StatCard
                    label="Failed"
                    value={failed}
                />

                <StatCard
                    label="Re-attempts"
                    value={reattempts}
                />

                <StatCard
                    label="Recovered"
                    value={recovered}
                />

                <StatCard
                    label="Workers Used"
                    value={workersUsed}
                />
            </div>

            <div className="border-t border-zinc-800 px-4 py-2.5">
                <div className="grid items-center gap-3 xl:grid-cols-[160px_repeat(5,minmax(0,1fr))_100px]">
                    <div>
                        <h3 className="text-[11px] font-medium text-zinc-300">
                            Performance
                        </h3>

                        <p className="font-mono text-[7px] uppercase tracking-wider text-zinc-700">
                            execution + end-to-end
                        </p>
                    </div>

                    <PerformanceMetric
                        label="Throughput"
                        value={
                            jobsPerSecond !== null
                                ? `${jobsPerSecond.toFixed(2)} jobs/s`
                                : "—"
                        }
                        accent
                    />

                    <PerformanceMetric
                        label="Avg execution"
                        value={formatDuration(
                            averageExecutionMs,
                        )}
                    />

                    <PerformanceMetric
                        label="P95 execution"
                        value={formatDuration(
                            p95ExecutionMs,
                        )}
                    />

                    <PerformanceMetric
                        label="Avg E2E"
                        value={formatDuration(
                            averageE2eMs,
                        )}
                    />

                    <PerformanceMetric
                        label="P95 E2E"
                        value={formatDuration(
                            p95E2eMs,
                        )}
                    />

                    <p className="text-right font-mono text-[7px] uppercase tracking-wider text-zinc-700">
                        {completedTimingJobs.length}
                        <br />
                        timed jobs
                    </p>
                </div>
            </div>



            {/*
             * Phase 11.2
             * Jobs per worker-node distribution.
             */}
            <div className="border-t border-zinc-800 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-md border border-blue-500/15 bg-blue-500/[0.06] text-blue-400/70">
                            <Server
                                size={11}
                            />
                        </div>

                        <div>
                            <h3 className="text-[11px] font-medium text-zinc-300">
                                Jobs per Worker
                            </h3>

                            <p className="font-mono text-[7px] uppercase tracking-wider text-zinc-700">
                                Latest persisted ownership
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 font-mono text-[8px] uppercase tracking-wider text-zinc-700">
                        <span>
                            {assignedJobs} assigned
                        </span>

                        {unassignedJobs > 0 && (
                            <>
                                <span className="h-1 w-1 rounded-full bg-zinc-800" />

                                <span>
                                    {unassignedJobs} unassigned
                                </span>
                            </>
                        )}
                    </div>
                </div>

                {workerDistribution.length >
                    0 ? (
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        {workerDistribution.map(
                            (worker) => {
                                const percentage =
                                    assignedJobs >
                                        0
                                        ? Math.round(
                                            (
                                                worker.jobCount /
                                                assignedJobs
                                            ) *
                                            100,
                                        )
                                        : 0;

                                return (
                                    <div
                                        key={
                                            worker.nodeId
                                        }
                                        className="rounded-md border border-zinc-800 bg-[#07090d] px-2.5 py-2"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <p
                                                title={
                                                    worker.nodeId
                                                }
                                                className="truncate font-mono text-[9px] text-zinc-400"
                                            >
                                                {
                                                    worker.nodeId
                                                }
                                            </p>

                                            <div className="flex items-baseline gap-1.5">
                                                <span className="text-[11px] font-medium text-zinc-200">
                                                    {
                                                        worker.jobCount
                                                    }
                                                </span>

                                                <span className="font-mono text-[7px] text-zinc-700">
                                                    {
                                                        percentage
                                                    }
                                                    %
                                                </span>
                                            </div>
                                        </div>

                                        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-zinc-900">
                                            <div
                                                className="h-full rounded-full bg-blue-500/70 transition-all duration-500"
                                                style={{
                                                    width: `${percentage}%`,
                                                }}
                                            />
                                        </div>
                                    </div>
                                );
                            },
                        )}
                    </div>
                ) : (
                    <div className="mt-2 rounded-md border border-dashed border-zinc-800 py-3 text-center font-mono text-[8px] uppercase tracking-wider text-zinc-700">
                        Waiting for worker assignments
                    </div>
                )}
            </div>

            <div className="border-t border-zinc-800">
                <div className="flex items-center justify-between px-4 py-3">
                    <h3 className="text-xs font-medium text-zinc-300">
                        Jobs
                    </h3>

                    <p className="font-mono text-[8px] uppercase tracking-wider text-zinc-700">
                        attempt / max
                    </p>
                </div>

                <div className="taskflow-scroll max-h-[390px] overflow-auto">
                    <table className="w-full text-left">
                        <thead className="sticky top-0 z-10 bg-[#07090d] font-mono text-[8px] uppercase tracking-wider text-zinc-600">
                            <tr>
                                <th className="px-4 py-2.5">
                                    Job
                                </th>

                                <th className="px-4 py-2.5">
                                    Status
                                </th>

                                <th className="hidden px-4 py-2.5 sm:table-cell">
                                    Attempt
                                </th>

                                <th className="hidden px-4 py-2.5 lg:table-cell">
                                    Worker
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            {jobs.map(
                                (job) => {
                                    const maxAttempts =
                                        job.maxAttempts >
                                            0
                                            ? job.maxAttempts
                                            : 3;

                                    return (
                                        <tr
                                            key={
                                                job.id
                                            }
                                            className="border-t border-zinc-900 text-xs"
                                        >
                                            <td className="px-4 py-2.5">
                                                <p
                                                    title={
                                                        job.id
                                                    }
                                                    className="max-w-[190px] truncate font-mono text-[9px] text-zinc-400"
                                                >
                                                    {
                                                        job.id
                                                    }
                                                </p>

                                                {job.lastError && (
                                                    <p
                                                        title={
                                                            job.lastError
                                                        }
                                                        className={`
                                                            mt-1
                                                            max-w-[240px]
                                                            truncate
                                                            font-mono
                                                            text-[8px]
                                                            ${job.status ===
                                                                "FAILED"
                                                                ? "text-red-400/70"
                                                                : "text-amber-400/60"
                                                            }
                                                        `}
                                                    >
                                                        {job.status ===
                                                            "COMPLETED"
                                                            ? "Recovered from: "
                                                            : "Last error: "}

                                                        {
                                                            job.lastError
                                                        }
                                                    </p>
                                                )}

                                                {job.status ===
                                                    "RETRYING" &&
                                                    job.nextRetryAt && (
                                                        <p className="mt-1 font-mono text-[8px] text-amber-500/60">
                                                            Retry{" "}
                                                            {formatRetryTime(
                                                                job.nextRetryAt,
                                                            )}
                                                        </p>
                                                    )}
                                            </td>

                                            <td className="px-4 py-2.5">
                                                <StatusBadge
                                                    status={
                                                        job.status
                                                    }
                                                />
                                            </td>

                                            <td className="hidden px-4 py-2.5 sm:table-cell">
                                                <span className="font-mono text-[10px] text-zinc-400">
                                                    {
                                                        job.attempt
                                                    }
                                                    /
                                                    {
                                                        maxAttempts
                                                    }
                                                </span>
                                            </td>

                                            <td className="hidden px-4 py-2.5 lg:table-cell">
                                                <p
                                                    title={
                                                        job.workerId ??
                                                        ""
                                                    }
                                                    className="max-w-[210px] truncate font-mono text-[9px] text-zinc-600"
                                                >
                                                    {job.workerId ??
                                                        "—"}
                                                </p>
                                            </td>
                                        </tr>
                                    );
                                },
                            )}

                            {jobs.length ===
                                0 && (
                                    <tr>
                                        <td
                                            colSpan="4"
                                            className="px-4 py-12 text-center text-xs text-zinc-600"
                                        >
                                            Waiting for jobs...
                                        </td>
                                    </tr>
                                )}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}

function PerformanceMetric({
    label,
    value,
    accent = false,
}) {
    return (
        <div className="min-w-0 border-l border-zinc-800 pl-3">
            <p className="whitespace-nowrap font-mono text-[7px] uppercase tracking-wider text-zinc-600">
                {label}
            </p>

            <p
                className={`
                    mt-0.5 whitespace-nowrap
                    text-sm font-semibold
                    ${accent
                        ? "text-blue-300"
                        : "text-zinc-200"
                    }
                `}
            >
                {value}
            </p>
        </div>
    );
}

function average(values) {
    if (values.length === 0) {
        return null;
    }

    return (
        values.reduce(
            (total, value) =>
                total + value,
            0,
        ) / values.length
    );
}

/*
 * Convert an execution-slot worker ID:
 *
 * worker-a-slot-2
 *
 * into the parent node:
 *
 * worker-a
 */
function workerNodeId(
    workerId,
) {
    return workerId.replace(
        /-slot-\d+$/,
        "",
    );
}

function formatRetryTime(value) {
    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime(),
        )
    ) {
        return value;
    }

    return `at ${date.toLocaleTimeString(
        [],
        {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        },
    )}`;
}

function percentile95(
    values,
) {
    if (
        values.length === 0
    ) {
        return null;
    }

    /*
     * Nearest-rank percentile.
     *
     * Example:
     * rank = ceil(0.95 * N)
     */
    const rank =
        Math.ceil(
            0.95 *
            values.length,
        );

    return values[
        Math.max(
            rank - 1,
            0,
        )
    ];
}

function formatDuration(
    milliseconds,
) {
    if (
        milliseconds === null ||
        milliseconds === undefined ||
        !Number.isFinite(
            milliseconds,
        )
    ) {
        return "—";
    }

    if (milliseconds < 1000) {
        return `${Math.round(
            milliseconds,
        )} ms`;
    }

    const seconds =
        milliseconds / 1000;

    if (seconds < 60) {
        return `${seconds.toFixed(
            2,
        )} s`;
    }

    const minutes =
        Math.floor(
            seconds / 60,
        );

    const remainingSeconds =
        seconds -
        minutes * 60;

    return `${minutes}m ${remainingSeconds.toFixed(
        1,
    )}s`;
}