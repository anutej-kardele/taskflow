import {
    Activity,
    LockKeyhole,
    Radio,
    RefreshCcw,
    Server,
} from "lucide-react";

const features = [
    {
        title: "Worker Fleet",
        description:
            "Worker health, heartbeat and capacity.",
        phase: "Redis worker health",
        icon: Server,
    },
    {
        title: "Retry Analytics",
        description:
            "Attempts, backoff and failure recovery.",
        phase: "Retry system",
        icon: RefreshCcw,
    },
    {
        title: "Live Events",
        description:
            "Streaming workload and job transitions.",
        phase: "SSE",
        icon: Radio,
    },
    {
        title: "Observability",
        description:
            "Throughput, latency and execution metrics.",
        phase: "Metrics",
        icon: Activity,
    },
];

export default function PlatformFeatures() {
    return (
        <section className="rounded-xl border border-zinc-800 bg-[#0a0c10]">
            <div className="border-b border-zinc-800 px-5 py-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-blue-400">
                    Platform
                </p>

                <h2 className="mt-2 text-lg font-semibold text-white">
                    System capabilities
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                    Planned capabilities are visible
                    now and unlock as the system grows.
                </p>
            </div>

            <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-4">
                {features.map(
                    ({
                        title,
                        description,
                        phase,
                        icon: Icon,
                    }) => (
                        <div
                            key={title}
                            className="
                group relative
                min-h-[165px]
                overflow-hidden
                rounded-xl
                border border-zinc-800
                bg-[#07090d]
                p-4
              "
                        >
                            <div className="absolute right-3 top-3">
                                <LockKeyhole
                                    size={14}
                                    className="text-zinc-700"
                                />
                            </div>

                            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-500/15 bg-blue-500/[0.06] text-blue-500/60">
                                <Icon size={16} />
                            </div>

                            <p className="mt-4 text-sm font-medium text-zinc-400">
                                {title}
                            </p>

                            <p className="mt-2 text-xs leading-5 text-zinc-600">
                                {description}
                            </p>

                            <p className="mt-3 font-mono text-[9px] uppercase tracking-wider text-blue-500/50">
                                Locked · {phase}
                            </p>
                        </div>
                    ),
                )}
            </div>
        </section>
    );
}