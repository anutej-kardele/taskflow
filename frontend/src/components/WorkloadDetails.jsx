import StatusBadge from "./StatusBadge";
import StatCard from "./StatCard";

export default function WorkloadDetails({
    workload,
    jobs,
}) {
    if (!workload) {
        return (
            <section className="rounded-xl border border-zinc-800 bg-[#0a0c10] px-6 py-14 text-center">
                <p className="text-sm text-zinc-600">
                    Select a workload to inspect
                    its execution.
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
    const completed =
        count("COMPLETED");
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

    return (
        <section className="overflow-hidden rounded-xl border border-zinc-800 bg-[#0a0c10]">
            <div className="border-b border-zinc-800 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-blue-400">
                            Selected workload
                        </p>

                        <div className="mt-2 flex items-center gap-3">
                            <h2 className="text-xl font-semibold text-white">
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

                        <p className="mt-2 break-all font-mono text-[11px] text-zinc-600">
                            {workload.id}
                        </p>
                    </div>

                    <div className="text-right">
                        <p className="text-3xl font-semibold tracking-tight text-blue-300">
                            {progress}%
                        </p>

                        <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-zinc-600">
                            processed
                        </p>
                    </div>
                </div>

                <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-zinc-900">
                    <div
                        className="h-full rounded-full bg-blue-500 transition-all duration-500"
                        style={{
                            width: `${progress}%`,
                        }}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 p-5 md:grid-cols-4">
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
                    label="Completed"
                    value={completed}
                />

                <StatCard
                    label="Failed"
                    value={failed}
                />
            </div>

            <div className="border-t border-zinc-800">
                <div className="px-5 py-4">
                    <h3 className="text-sm font-medium text-zinc-300">
                        Jobs
                    </h3>
                </div>

                <div className="max-h-[420px] overflow-auto">
                    <table className="w-full text-left">
                        <thead className="sticky top-0 bg-[#07090d] font-mono text-[10px] uppercase tracking-wider text-zinc-600">
                            <tr>
                                <th className="px-5 py-3">
                                    Job
                                </th>

                                <th className="px-5 py-3">
                                    Status
                                </th>

                                <th className="px-5 py-3">
                                    Attempt
                                </th>

                                <th className="px-5 py-3">
                                    Worker
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            {jobs.map((job) => (
                                <tr
                                    key={job.id}
                                    className="border-t border-zinc-900 text-sm"
                                >
                                    <td className="px-5 py-3">
                                        <p className="max-w-[200px] truncate font-mono text-[11px] text-zinc-400">
                                            {job.id}
                                        </p>
                                    </td>

                                    <td className="px-5 py-3">
                                        <StatusBadge
                                            status={
                                                job.status
                                            }
                                        />
                                    </td>

                                    <td className="px-5 py-3 font-mono text-xs text-zinc-500">
                                        {job.attempt}
                                    </td>

                                    <td className="px-5 py-3">
                                        <p className="max-w-[240px] truncate font-mono text-[11px] text-zinc-600">
                                            {job.workerId ??
                                                "—"}
                                        </p>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}