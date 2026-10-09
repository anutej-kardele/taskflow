import {
    ChevronRight,
    Inbox,
    Info,
} from "lucide-react";

import StatusBadge from "./StatusBadge";

function formatDate(value) {
    if (!value) {
        return "-";
    }

    return new Date(
        value,
    ).toLocaleString();
}

export default function WorkloadList({
    workloads,
    selectedId,
    onSelect,
    onShowInfo,
}) {
    return (
        <section className="overflow-hidden rounded-xl border border-line bg-panel">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <div>
                    <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-blue-400">
                        Execution History
                    </p>

                    <h2 className="mt-1 text-sm font-semibold text-primary">
                        Recent workloads
                    </h2>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onShowInfo}
                        title="About TaskFlow"
                        aria-label="Show TaskFlow information"
                        className={`
        flex h-7 w-7 items-center justify-center
        rounded-full border transition

        ${selectedId === null
                                ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
                                : "border-line bg-control text-muted hover:border-blue-500/30 hover:text-blue-400"
                            }
      `}
                    >
                        <Info size={12} />
                    </button>

                    <span className="rounded-full border border-line bg-control px-2.5 py-1 font-mono text-[9px] text-tertiary">
                        {workloads.length} total
                    </span>
                </div>
            </div>

            {workloads.length === 0 ? (
                <div className="flex min-h-[260px] flex-col items-center justify-center px-5 text-center">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-control text-muted">
                        <Inbox size={17} />
                    </div>

                    <p className="text-sm text-tertiary">
                        No workloads yet
                    </p>

                    <p className="mt-1 text-xs text-muted">
                        Create a workload above to begin execution.
                    </p>
                </div>
            ) : (
                <div className="taskflow-scroll max-h-[470px] overflow-auto">
                    <table className="w-full text-left">
                        <thead className="sticky top-0 z-10 border-b border-line bg-raised">
                            <tr className="font-mono text-[8px] uppercase tracking-wider text-muted">
                                <th className="px-4 py-2.5">
                                    Type
                                </th>

                                <th className="px-4 py-2.5">
                                    Jobs
                                </th>

                                <th className="px-4 py-2.5">
                                    Status
                                </th>

                                <th className="hidden px-4 py-2.5 md:table-cell">
                                    Created
                                </th>

                                <th className="w-9" />
                            </tr>
                        </thead>

                        <tbody>
                            {workloads.map(
                                (workload) => {
                                    const selected =
                                        selectedId ===
                                        workload.id;

                                    return (
                                        <tr
                                            key={workload.id}
                                            onClick={() =>
                                                onSelect(
                                                    workload.id,
                                                )
                                            }
                                            aria-selected={
                                                selected
                                            }
                                            className={`
                        cursor-pointer
                        border-b
                        border-line-subtle
                        text-xs
                        transition

                        ${selected
                                                    ? "bg-blue-500/[0.08] shadow-[inset_3px_0_0_#3b82f6]"
                                                    : "hover:bg-hover"
                                                }
                      `}
                                        >
                                            <td className="px-4 py-3">
                                                <p className="font-medium text-secondary">
                                                    {
                                                        workload.jobType
                                                    }
                                                </p>

                                                <p
                                                    title={
                                                        workload.id
                                                    }
                                                    className="mt-0.5 max-w-[170px] truncate font-mono text-[9px] text-faint"
                                                >
                                                    {
                                                        workload.id
                                                    }
                                                </p>
                                            </td>

                                            <td className="px-4 py-3 text-tertiary">
                                                {
                                                    workload.jobCount
                                                }
                                            </td>

                                            <td className="px-4 py-3">
                                                <StatusBadge
                                                    status={
                                                        workload.status
                                                    }
                                                />
                                            </td>

                                            <td className="hidden whitespace-nowrap px-4 py-3 text-[10px] text-tertiary md:table-cell">
                                                {formatDate(
                                                    workload.createdAt,
                                                )}
                                            </td>

                                            <td className="px-2">
                                                <ChevronRight
                                                    size={13}
                                                    className={
                                                        selected
                                                            ? "text-blue-400"
                                                            : "text-faint"
                                                    }
                                                />
                                            </td>
                                        </tr>
                                    );
                                },
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}