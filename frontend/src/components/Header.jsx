import {
    Activity,
    ExternalLink,
} from "lucide-react";

export default function Header({
    connected,
}) {
    return (
        <header className="border-b border-zinc-800/80 bg-[#05070b]/90 backdrop-blur">
            <div className="mx-auto flex max-w-[1500px] items-center justify-between px-6 py-5">
                <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400">
                        <img
                            src="/taskflow.svg"
                            alt="TaskFlow"
                            className="h-8 w-8"
                        />
                    </div>

                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-xl font-semibold tracking-tight text-white">
                                TaskFlow
                            </h1>

                            <span className="rounded-full border border-blue-500/25 bg-blue-500/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-blue-300">
                                distributed
                            </span>
                        </div>

                        <p className="mt-0.5 text-sm text-zinc-500">
                            Distributed execution platform
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div
                        className={`
              hidden items-center gap-2 rounded-full
              border px-3 py-1.5 text-xs md:flex

              ${connected
                                ? "border-blue-500/25 bg-blue-500/10 text-blue-300"
                                : "border-red-500/25 bg-red-500/10 text-red-300"
                            }
            `}
                    >
                        <Activity size={14} />

                        {connected
                            ? "Control plane online"
                            : "Control plane offline"}
                    </div>

                    <a
                        href="https://github.com/anutej-kardele/taskflow"
                        target="_blank"
                        rel="noreferrer"
                        className="
                        flex h-9 w-9 items-center justify-center
                        rounded-lg border border-zinc-800
                        bg-zinc-950 text-zinc-400
                        transition
                        hover:border-blue-500/40
                        hover:text-blue-400
                    "
                        title="View TaskFlow on GitHub"
                    >
                        <ExternalLink size={17} />
                    </a>
                </div>
            </div>
        </header>
    );
}