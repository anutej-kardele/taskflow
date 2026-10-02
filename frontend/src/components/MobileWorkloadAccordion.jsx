import {
    ChevronDown,
    Users,
} from "lucide-react";

import StatusBadge from "./StatusBadge";

export default function MobileWorkloadAccordion({
    workloads,
    selectedId,
    jobs,
    onToggle,
}) {
    if (workloads.length === 0) {
        return (
            <section className="rounded-xl border border-zinc-800 bg-[#0a0c10] p-8 text-center">
                <p className="text-sm text-zinc-400">
                    No workloads yet
                </p>

                <p className="mt-1 text-xs text-zinc-600">
                    Submit a workload above to begin.
                </p>
            </section>
        );
    }

    return (
        <section className="overflow-hidden rounded-xl border border-zinc-800 bg-[#0a0c10]">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                <div>
                    <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-blue-400">
                        Execution History
                    </p>

                    <h2 className="mt-1 text-sm font-semibold text-white">
                        Workloads
                    </h2>
                </div>

                <span className="rounded-full border border-zinc-800 px-2.5 py-1 font-mono text-[9px] text-zinc-500">
                    {workloads.length}
                </span>
            </div>

            {workloads.map(
                (workload) => {
                    const open =
                        selectedId ===
                        workload.id;

                    const selectedJobs =
                        open
                            ? jobs
                            : [];

                    const count = (status) =>
                        selectedJobs.filter(
                            (job) =>
                                job.status ===
                                status,
                        ).length;

                    const queued =
                        count("QUEUED");

                    const running =
                        count("RUNNING");

                    const retrying =
                        count("RETRYING");

                    const completed =
                        count("COMPLETED");

                    const failed =
                        count("FAILED");

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

                    const reattempts =
                        selectedJobs.reduce(
                            (total, job) =>
                                total +
                                Math.max(
                                    (job.attempt ??
                                        0) - 1,
                                    0,
                                ),
                            0,
                        );

                    const recovered =
                        selectedJobs.filter(
                            (job) =>
                                job.status ===
                                "COMPLETED" &&
                                (job.attempt ??
                                    0) > 1,
                        ).length;

                    const workersUsed =
                        new Set(
                            selectedJobs
                                .map(
                                    (job) =>
                                        job.workerId,
                                )
                                .filter(Boolean),
                        ).size;

                    return (
                        <div
                            key={workload.id}
                            className="border-b border-zinc-900 last:border-b-0"
                        >
                            <button
                                type="button"
                                onClick={() =>
                                    onToggle(
                                        workload.id,
                                    )
                                }
                                className={`
                                    flex w-full
                                    items-center
                                    justify-between
                                    gap-3 px-4 py-3
                                    text-left
                                    transition

                                    ${open
                                        ? "bg-blue-500/[0.07]"
                                        : "hover:bg-zinc-900/60"
                                    }
                                `}
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium text-zinc-200">
                                            {
                                                workload.jobType
                                            }
                                        </p>

                                        <StatusBadge
                                            status={
                                                workload.status
                                            }
                                        />
                                    </div>

                                    <div className="mt-1 flex items-center gap-2">
                                        <span className="font-mono text-[9px] text-zinc-500">
                                            {
                                                workload.jobCount
                                            }{" "}
                                            jobs
                                        </span>

                                        <span className="text-zinc-800">
                                            •
                                        </span>

                                        <span
                                            title={
                                                workload.id
                                            }
                                            className="max-w-[200px] truncate font-mono text-[8px] text-zinc-700"
                                        >
                                            WorkloadID:{" "}
                                            {
                                                workload.id
                                            }
                                        </span>
                                    </div>
                                </div>

                                <ChevronDown
                                    size={16}
                                    className={`
                                        shrink-0
                                        transition-transform
                                        duration-200

                                        ${open
                                            ? "rotate-180 text-blue-400"
                                            : "text-zinc-600"
                                        }
                                    `}
                                />
                            </button>

                            {open && (
                                <div className="border-t border-blue-500/10 bg-[#07090d]">
                                    <div className="px-4 py-3">
                                        <div className="mb-2 flex items-end justify-between">
                                            <div>
                                                <p className="font-mono text-[8px] uppercase tracking-wider text-zinc-600">
                                                    Progress
                                                </p>

                                                <p className="mt-1 text-lg font-semibold text-blue-300">
                                                    {
                                                        progress
                                                    }
                                                    %
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-1.5 text-[10px] text-zinc-600">
                                                <Users
                                                    size={
                                                        12
                                                    }
                                                />

                                                {
                                                    workersUsed
                                                }{" "}
                                                worker
                                                {workersUsed ===
                                                    1
                                                    ? ""
                                                    : "s"}
                                            </div>
                                        </div>

                                        <div className="h-1 overflow-hidden rounded-full bg-zinc-900">
                                            <div
                                                className="h-full rounded-full bg-blue-500 transition-all duration-500"
                                                style={{
                                                    width: `${progress}%`,
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 px-4 pb-3">
                                        <MiniStat
                                            label="Queued"
                                            value={
                                                queued
                                            }
                                        />

                                        <MiniStat
                                            label="Running"
                                            value={
                                                running
                                            }
                                            accent
                                        />

                                        <MiniStat
                                            label="Retrying"
                                            value={
                                                retrying
                                            }
                                            warning
                                        />

                                        <MiniStat
                                            label="Completed"
                                            value={
                                                completed
                                            }
                                        />

                                        <MiniStat
                                            label="Failed"
                                            value={
                                                failed
                                            }
                                        />

                                        <MiniStat
                                            label="Re-attempts"
                                            value={
                                                reattempts
                                            }
                                        />

                                        <MiniStat
                                            label="Recovered"
                                            value={
                                                recovered
                                            }
                                        />

                                        <MiniStat
                                            label="Workers"
                                            value={
                                                workersUsed
                                            }
                                        />
                                    </div>

                                    <div className="border-t border-zinc-900">
                                        <div className="px-4 py-2.5">
                                            <p className="font-mono text-[8px] uppercase tracking-wider text-zinc-600">
                                                Jobs
                                            </p>
                                        </div>

                                        <div className="taskflow-scroll max-h-[300px] overflow-y-auto">
                                            {selectedJobs.length ===
                                                0 ? (
                                                <div className="px-4 py-8 text-center text-xs text-zinc-600">
                                                    Loading
                                                    jobs...
                                                </div>
                                            ) : (
                                                selectedJobs.map(
                                                    (
                                                        job,
                                                    ) => {
                                                        const maxAttempts =
                                                            job.maxAttempts >
                                                                0
                                                                ? job.maxAttempts
                                                                : 3;

                                                        return (
                                                            <div
                                                                key={
                                                                    job.id
                                                                }
                                                                className="border-t border-zinc-900 px-4 py-2.5"
                                                            >
                                                                <div className="flex items-center justify-between gap-3">
                                                                    <div className="min-w-0">
                                                                        <p
                                                                            title={
                                                                                job.id
                                                                            }
                                                                            className="max-w-[170px] truncate font-mono text-[9px] text-zinc-400"
                                                                        >
                                                                            {
                                                                                job.id
                                                                            }
                                                                        </p>

                                                                        <p
                                                                            title={
                                                                                job.workerId ??
                                                                                ""
                                                                            }
                                                                            className="mt-0.5 max-w-[170px] truncate font-mono text-[8px] text-zinc-700"
                                                                        >
                                                                            {job.workerId ??
                                                                                "No worker assigned"}
                                                                        </p>
                                                                    </div>

                                                                    <div className="flex shrink-0 items-center gap-2">
                                                                        <span className="font-mono text-[8px] text-zinc-600">
                                                                            {
                                                                                job.attempt
                                                                            }
                                                                            /
                                                                            {
                                                                                maxAttempts
                                                                            }
                                                                        </span>

                                                                        <StatusBadge
                                                                            status={
                                                                                job.status
                                                                            }
                                                                        />
                                                                    </div>
                                                                </div>

                                                                {job.lastError && (
                                                                    <p
                                                                        title={
                                                                            job.lastError
                                                                        }
                                                                        className={`
                                                                            mt-1.5
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
                                                            </div>
                                                        );
                                                    },
                                                )
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                },
            )}
        </section>
    );
}

function MiniStat({
    label,
    value,
    accent = false,
    warning = false,
}) {
    return (
        <div
            className={`
                rounded-md border
                px-2.5 py-2

                ${warning
                    ? "border-amber-500/20 bg-amber-500/[0.05]"
                    : accent
                        ? "border-blue-500/20 bg-blue-500/[0.06]"
                        : "border-zinc-800 bg-[#05070b]"
                }
            `}
        >
            <p className="font-mono text-[7px] uppercase tracking-wider text-zinc-600">
                {label}
            </p>

            <p
                className={`
                    mt-1 text-sm font-semibold

                    ${warning
                        ? "text-amber-300"
                        : accent
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