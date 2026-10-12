
import {
    Activity,
    Cpu,
    Database,
    Server,
} from "lucide-react";

const architecture = [
    {
        label: "Control Plane",
        value: "Spring Boot",
        icon: Server,
    },
    {
        label: "Messaging",
        value: "Apache Kafka",
        icon: Activity,
    },
    {
        label: "State",
        value: "MongoDB",
        icon: Database,
    },
    {
        label: "Workers",
        value: "Go",
        icon: Cpu,
    },
];

const capabilities = [
    "Kubernetes autoscaling with KEDA (3–10 worker Pods)",
    "Kafka consumer-group job distribution",
    "Atomic job claiming and renewable MongoDB leases",
    "Graceful worker draining and crash recovery",
    "Configurable Go worker concurrency",
    "Automatic retries and recovery tracking",
    "SLEEP, CPU, HTTP and UNRELIABLE job types",
    "Live SSE dashboard, Docker Compose and Kubernetes support",
];

export default function ProjectInfoPanel() {
    return (
        <section className="flex min-h-[470px] flex-col overflow-hidden rounded-xl border border-line bg-panel">

            {/* Header */}
            <div className="border-b border-line px-5 py-4">
                <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-blue-400">
                    About TaskFlow
                </p>

                <div className="mt-2 flex items-center gap-3">

                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-400">
                        <img
                            src="/taskflow.svg"
                            alt="TaskFlow"
                            className="h-8 w-8"
                        />
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold text-primary">
                            Fault-tolerant distributed job processing
                        </h2>

                        <p className="mt-0.5 text-xs text-tertiary">
                            Kafka-backed workload execution with Kubernetes
                            autoscaling and failure recovery.
                        </p>
                    </div>

                </div>
            </div>

            {/* Project description */}
            <div className="flex-1 p-5">

                <p className="max-w-2xl text-xs leading-6 text-tertiary">
                    TaskFlow is a distributed job-processing platform
                    built with Spring Boot, Kafka, MongoDB, Redis, and
                    concurrent Go workers. Jobs are protected by
                    renewable leases and can be recovered after worker
                    failures. On Kubernetes, KEDA automatically scales
                    workers between 3 and 10 Pods based on Kafka backlog,
                    while graceful draining allows active jobs to finish
                    during scale-down.
                </p>

                {/* Architecture cards */}
                <div className="mt-5 grid grid-cols-2 gap-3">

                    {architecture.map(({ label, value, icon: Icon }) => (
                        <div
                            key={label}
                            className="rounded-lg border border-line bg-raised p-3"
                        >
                            <div className="flex items-center gap-2">

                                <div className="flex h-7 w-7 items-center justify-center rounded-md border border-blue-500/15 bg-blue-500/[0.06] text-blue-400">
                                    <Icon size={12} />
                                </div>

                                <div>
                                    <p className="font-mono text-[8px] uppercase tracking-wider text-muted">
                                        {label}
                                    </p>

                                    <p className="mt-0.5 text-xs font-medium text-secondary">
                                        {value}
                                    </p>
                                </div>

                            </div>
                        </div>
                    ))}

                </div>

                {/* Current capabilities */}
                <div className="mt-5 rounded-lg border border-blue-500/15 bg-blue-500/[0.04] p-4">

                    <p className="font-mono text-[8px] uppercase tracking-[0.18em] text-blue-400">
                        Current capabilities
                    </p>

                    <div className="mt-3 grid gap-x-8 gap-y-2 text-[11px] text-tertiary sm:grid-cols-2">

                        {capabilities.map((capability) => (
                            <p key={capability} className="flex items-start gap-2">
                                <span className="shrink-0 text-blue-400">
                                    •
                                </span>
                                <span>{capability}</span>
                            </p>
                        ))}

                    </div>

                </div>

            </div>

            {/* Footer */}
            <div className="border-t border-line px-5 py-3">
                <p className="font-mono text-[8px] uppercase tracking-wider text-faint">
                    Select a workload from the execution history to inspect it
                </p>
            </div>

        </section>
    );
}
