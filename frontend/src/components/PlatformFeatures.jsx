import {
    Activity,
    Boxes,
    LockKeyhole,
    Radio,
    Server,
    Container
} from "lucide-react";

const features = [
    {
        title: "Observability",
        description:
            "Measure throughput, latency, queue depth and runtime behavior.",
        phase: "Metrics",
        icon: Activity,
    },
    {
        title: "Failure Experiments",
        description:
            "Exercise controlled worker, infrastructure and delivery failures.",
        phase: "Failure testing",
        icon: Boxes,
    },
    {
        title: "Full Containerization",
        description:
            "Run the control plane, frontend and infrastructure as a complete Docker Compose stack.",
        phase: "Containerization",
        icon: Container,
    },
    {
        title: "Kubernetes",
        description:
            "Deploy TaskFlow services and horizontally scaled workers to Kubernetes.",
        phase: "Orchestration",
        icon: Server,
    },
];

export default function PlatformFeatures() {
    return (
        <section className="rounded-xl border border-zinc-800 bg-[#0a0c10]">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                <div>
                    <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-blue-400">
                        Platform
                    </p>

                    <h2 className="mt-1 text-sm font-semibold text-white">
                        Upcoming capabilities
                    </h2>
                </div>

                <span className="font-mono text-[8px] uppercase tracking-wider text-zinc-700">
                    Roadmap
                </span>
            </div>

            <div className="grid gap-2.5 p-3 md:grid-cols-2 xl:grid-cols-4">
                {features.map(
                    ({
                        title,
                        description,
                        phase,
                        icon: Icon,
                    }) => (
                        <div
                            key={title}
                            className="relative rounded-lg border border-zinc-800 bg-[#07090d] p-3"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex h-7 w-7 items-center justify-center rounded-md border border-blue-500/15 bg-blue-500/[0.06] text-blue-500/60">
                                    <Icon
                                        size={13}
                                    />
                                </div>

                                <div className="flex items-center gap-1 font-mono text-[7px] uppercase tracking-wider text-zinc-700">
                                    <LockKeyhole
                                        size={10}
                                    />
                                    Locked
                                </div>
                            </div>

                            <p className="mt-2.5 text-xs font-medium text-zinc-400">
                                {title}
                            </p>

                            <p className="mt-1 text-[10px] leading-4 text-zinc-600">
                                {description}
                            </p>

                            <p className="mt-2 font-mono text-[7px] uppercase tracking-wider text-blue-500/50">
                                {phase}
                            </p>
                        </div>
                    ),
                )}
            </div>
        </section>
    );
}