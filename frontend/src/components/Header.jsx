import {
    Activity,
    ExternalLink,
    Moon,
    Sun,
} from "lucide-react";

import useTheme from "../hooks/useTheme";


export default function Header({
    connected,
}) {
    const {
        theme,
        toggleTheme,
    } = useTheme();


    return (
        <header className="border-b border-line bg-page/90 backdrop-blur">
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
                            <h1 className="text-xl font-semibold tracking-tight text-primary">
                                TaskFlow
                            </h1>

                            <span className="rounded-full border border-blue-500/25 bg-blue-500/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-blue-400">
                                distributed
                            </span>
                        </div>

                        <p className="mt-0.5 text-sm text-tertiary">
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
                                ? "border-blue-500/25 bg-blue-500/10 text-blue-400"
                                : "border-red-500/25 bg-red-500/10 text-red-400"
                            }
            `}
                    >
                        <Activity size={14} />

                        {connected
                            ? "Control plane online"
                            : "Control plane offline"}
                    </div>

                    <button
                        type="button"
                        onClick={toggleTheme}
                        className="
              flex h-9 w-9 items-center justify-center
              rounded-lg border border-line
              bg-control text-tertiary
              transition
              hover:border-blue-500/40
              hover:text-blue-500
            "
                        title={
                            theme === "dark"
                                ? "Switch to light mode"
                                : "Switch to dark mode"
                        }
                        aria-label={
                            theme === "dark"
                                ? "Switch to light mode"
                                : "Switch to dark mode"
                        }
                    >
                        {theme === "dark" ? (
                            <Sun size={17} />
                        ) : (
                            <Moon size={17} />
                        )}
                    </button>

                    <a
                        href="https://github.com/anutej-kardele/taskflow"
                        target="_blank"
                        rel="noreferrer"
                        className="
              flex h-9 w-9 items-center justify-center
              rounded-lg border border-line
              bg-control text-tertiary
              transition
              hover:border-blue-500/40
              hover:text-blue-500
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