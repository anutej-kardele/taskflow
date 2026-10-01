import {
    ChevronRight,
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
}) {
    return (
        <section className="overflow-hidden rounded-xl border border-zinc-800 bg-[#0a0c10]">
            <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-5">
                <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-blue-400">
                        Execution history
                    </p>

                    <h2 className="mt-2 text-lg font-semibold text-white">
                        Recent workloads
                    </h2>
                </div>

                <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-500">
                    {workloads.length} total
                </span>
            </div>

            {workloads.length === 0 ? (
                <div className="px-5 py-16 text-center text-sm text-zinc-600">
                    No workloads submitted yet.
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="border-b border-zinc-800 bg-[#07090d]">
                            <tr className="font-mono text-[10px] uppercase tracking-wider text-zinc-600">
                                <th className="px-5 py-3">
                                    Type
                                </th>

                                <th className="px-5 py-3">
                                    Jobs
                                </th>

                                <th className="px-5 py-3">
                                    Status
                                </th>

                                <th className="px-5 py-3">
                                    Created
                                </th>

                                <th className="w-12" />
                            </tr>
                        </thead>

                        <tbody>
                            {workloads.map(
                                (workload) => (
                                    <tr
                                        key={workload.id}
                                        onClick={() =>
                                            onSelect(
                                                workload.id,
                                            )
                                        }
                                        className={`
                      cursor-pointer
                      border-b
                      border-zinc-900
                      text-sm
                      transition

                      ${selectedId ===
                                                workload.id
                                                ? "bg-blue-500/[0.07]"
                                                : "hover:bg-zinc-900/60"
                                            }
                    `}
                                    >
                                        <td className="px-5 py-4">
                                            <div>
                                                <p className="font-medium text-zinc-200">
                                                    {
                                                        workload.jobType
                                                    }
                                                </p>

                                                <p className="mt-1 max-w-[170px] truncate font-mono text-[10px] text-zinc-700">
                                                    {
                                                        workload.id
                                                    }
                                                </p>
                                            </div>
                                        </td>

                                        <td className="px-5 py-4 text-zinc-400">
                                            {
                                                workload.jobCount
                                            }
                                        </td>

                                        <td className="px-5 py-4">
                                            <StatusBadge
                                                status={
                                                    workload.status
                                                }
                                            />
                                        </td>

                                        <td className="whitespace-nowrap px-5 py-4 text-xs text-zinc-500">
                                            {formatDate(
                                                workload.createdAt,
                                            )}
                                        </td>

                                        <td className="px-3">
                                            <ChevronRight
                                                size={15}
                                                className="text-zinc-700"
                                            />
                                        </td>
                                    </tr>
                                ),
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}