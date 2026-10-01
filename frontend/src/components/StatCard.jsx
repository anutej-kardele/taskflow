export default function StatCard({
    label,
    value,
    accent = false,
}) {
    return (
        <div
            className={`
        rounded-lg border p-4

        ${accent
                    ? "border-blue-500/20 bg-blue-500/[0.06]"
                    : "border-zinc-800 bg-[#07090d]"
                }
      `}
        >
            <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-600">
                {label}
            </p>

            <p
                className={`
          mt-2 text-2xl font-semibold

          ${accent
                        ? "text-blue-300"
                        : "text-white"
                    }
        `}
            >
                {value}
            </p>
        </div>
    );
}