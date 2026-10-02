import {
    MousePointerClick,
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
            ? Math.round(
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
     *
     * This can include both retry claims and
     * crash/lease recovery claims.
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
     * A recovered job is one that eventually completed
     * after requiring more than one execution attempt.
     */
    const recovered =
        jobs.filter(
            (job) =>
                job.status === "COMPLETED" &&
                (job.attempt ?? 0) > 1,
        ).length;

    /*
     * Distinct worker IDs represented by the latest
     * persisted job ownership/execution information.
     */
    const workersUsed =
        new Set(
            jobs
                .map(
                    (job) =>
                        job.workerId,
                )
                .filter(Boolean),
        ).size;

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

            <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4">
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
                            {jobs.map((job) => {
                                const maxAttempts =
                                    job.maxAttempts > 0
                                        ? job.maxAttempts
                                        : 3;

                                return (
                                    <tr
                                        key={job.id}
                                        className="border-t border-zinc-900 text-xs"
                                    >
                                        <td className="px-4 py-2.5">
                                            <p
                                                title={job.id}
                                                className="max-w-[190px] truncate font-mono text-[9px] text-zinc-400"
                                            >
                                                {job.id}
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
                            })}

                            {jobs.length === 0 && (
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

function formatRetryTime(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return `at ${date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    })}`;
}