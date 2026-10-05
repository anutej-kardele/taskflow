import {
    Activity,
    Boxes,
    CheckCircle2,
    Layers3,
} from "lucide-react";

import MetricCard from "./MetricCard";

export default function OverviewMetrics({
    workloads,
    jobSummary,
}) {
    const totalWorkloads =
        workloads.length;

    const totalJobs =
        jobSummary?.totalJobs ?? 0;

    const completedJobs =
        jobSummary?.completedJobs ?? 0;

    const activeWorkloads =
        workloads.filter(
            (workload) =>
                workload.status ===
                "RUNNING",
        ).length;

    const completionRate =
        totalJobs === 0
            ? 0
            : Math.round(
                (completedJobs /
                    totalJobs) *
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
                description="Currently running"
                icon={Activity}
            />

            <MetricCard
                label="Job Completion"
                value={`${completionRate}%`}
                description="Jobs successfully completed"
                icon={CheckCircle2}
            />
        </div>
    );
}