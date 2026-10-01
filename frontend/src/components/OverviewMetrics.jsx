import {
    Activity,
    Boxes,
    CheckCircle2,
    Layers3,
} from "lucide-react";

import MetricCard from "./MetricCard";

export default function OverviewMetrics({
    workloads,
}) {
    const totalWorkloads =
        workloads.length;

    const totalJobs =
        workloads.reduce(
            (sum, workload) =>
                sum +
                (workload.jobCount ?? 0),
            0,
        );

    const activeWorkloads =
        workloads.filter(
            (workload) =>
                workload.status ===
                "RUNNING" ||
                workload.status ===
                "CREATED",
        ).length;

    const terminal =
        workloads.filter(
            (workload) =>
                workload.status ===
                "COMPLETED" ||
                workload.status ===
                "FAILED",
        );

    const completed =
        terminal.filter(
            (workload) =>
                workload.status ===
                "COMPLETED",
        ).length;

    const completionRate =
        terminal.length === 0
            ? 0
            : Math.round(
                (completed /
                    terminal.length) *
                100,
            );

    return (
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
                label="Workloads"
                value={totalWorkloads}
                description="Total submitted"
                icon={Layers3}
            />

            <MetricCard
                label="Jobs"
                value={totalJobs}
                description="Across all workloads"
                icon={Boxes}
            />

            <MetricCard
                label="Active"
                value={activeWorkloads}
                description="Created or running"
                icon={Activity}
            />

            <MetricCard
                label="Completion"
                value={`${completionRate}%`}
                description="Terminal workloads completed"
                icon={CheckCircle2}
            />
        </div>
    );
}