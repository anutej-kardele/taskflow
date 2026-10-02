const styles = {
    CREATED:
        "border-zinc-700 bg-zinc-800/70 text-zinc-300",

    QUEUED:
        "border-zinc-700 bg-zinc-800/70 text-zinc-300",

    RUNNING:
        "border-blue-500/25 bg-blue-500/10 text-blue-300",

    RETRYING:
        "border-amber-500/25 bg-amber-500/10 text-amber-300",

    COMPLETED:
        "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",

    FAILED:
        "border-red-500/25 bg-red-500/10 text-red-300",
};

export default function StatusBadge({
    status,
}) {
    return (
        <span
            className={`
                inline-flex rounded-full border
                px-2.5 py-1 font-mono
                text-[10px] font-medium
                uppercase tracking-wider

                ${styles[status] ?? styles.CREATED}
            `}
        >
            {status}
        </span>
    );
}