export default function StatCard({
    label,
    value,
    accent = false,
}) {
    return (
        <div
            className={`
                flex items-center justify-between
                rounded-md border
                px-3 py-2

                ${accent
                    ? "border-blue-500/20 bg-blue-500/[0.06]"
                    : "border-line bg-raised"
                }
            `}
        >
            <p className="font-mono text-[8px] uppercase tracking-wider text-muted">
                {label}
            </p>

            <p
                className={`
                    text-base font-semibold

                    ${accent
                        ? "text-blue-400"
                        : "text-primary"
                    }
                `}
            >
                {value}
            </p>
        </div>
    );
}