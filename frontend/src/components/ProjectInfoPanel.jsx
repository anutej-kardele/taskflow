import {
    Activity,
    Boxes,
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

export default function ProjectInfoPanel() {
    return (
        <section className="flex min-h-[470px] flex-col overflow-hidden rounded-xl border border-zinc-800 bg-[#0a0c10]">
            <div className="border-b border-zinc-800 px-5 py-4">
                <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-blue-400">
                    About TaskFlow
                </p>

                <div className="mt-2 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-400">
                        <Boxes size={16} />
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold text-white">
                            Distributed workload execution
                        </h2>

                        <p className="mt-0.5 text-xs text-zinc-500">
                            A distributed system for scheduling,
                            executing and observing batches of jobs.
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex-1 p-5">
                <p className="max-w-2xl text-xs leading-6 text-zinc-500">
                    TaskFlow separates workload coordination from
                    execution. The Spring Boot control plane persists
                    workload state, Kafka distributes jobs, and
                    concurrent Go workers claim and execute work using
                    leases and heartbeats for failure recovery.
                </p>

                <div className="mt-5 grid grid-cols-2 gap-3">
                    {architecture.map(
                        ({
                            label,
                            value,
                            icon: Icon,
                        }) => (
                            <div
                                key={label}
                                className="rounded-lg border border-zinc-800 bg-[#07090d] p-3"
                            >
                                <div className="flex items-center gap-2">
                                    <div className="flex h-7 w-7 items-center justify-center rounded-md border border-blue-500/15 bg-blue-500/[0.06] text-blue-400">
                                        <Icon size={12} />
                                    </div>

                                    <div>
                                        <p className="font-mono text-[8px] uppercase tracking-wider text-zinc-600">
                                            {label}
                                        </p>

                                        <p className="mt-0.5 text-xs font-medium text-zinc-300">
                                            {value}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ),
                    )}
                </div>

                <div className="mt-5 rounded-lg border border-blue-500/15 bg-blue-500/[0.04] p-4">
                    <p className="font-mono text-[8px] uppercase tracking-[0.18em] text-blue-400">
                        Current capabilities
                    </p>

                    <div className="mt-3 grid gap-x-8 gap-y-2 text-[11px] text-zinc-500 sm:grid-cols-2">
                        <p>• SLEEP, CPU, HTTP and UNRELIABLE jobs</p>
                        <p>• Configurable concurrent Go workers</p>
                        <p>• Kafka consumer-group job delivery</p>
                        <p>• Atomic job claiming and leases</p>
                        <p>• Worker heartbeats and crash recovery</p>
                        <p>• Live dashboard through REST polling</p>
                    </div>
                </div>
            </div>

            <div className="border-t border-zinc-800 px-5 py-3">
                <p className="font-mono text-[8px] uppercase tracking-wider text-zinc-700">
                    Select a workload from the execution history to inspect it
                </p>
            </div>
        </section>
    );
}