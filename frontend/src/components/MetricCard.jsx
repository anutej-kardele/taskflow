export default function MetricCard({
    label,
    value,
    description,
    icon: Icon,
    locked = false,
}) {
    return (
        <div className="relative overflow-hidden rounded-lg border border-zinc-800 bg-[#0a0c10] px-3.5 py-2.5">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/25 to-transparent" />

            <div className="flex items-center justify-between">
                <div>
                    <p className="text-[9px] font-medium uppercase tracking-[0.15em] text-zinc-500">
                        {label}
                    </p>

                    <p className="mt-1 text-xl font-semibold tracking-tight text-white">
                        {locked ? "—" : value}
                    </p>
                </div>

                {Icon && (
                    <div className="rounded-md border border-blue-500/20 bg-blue-500/10 p-1.5 text-blue-400">
                        <Icon size={13} />
                    </div>
                )}
            </div>

            <p className="mt-0.5 text-[10px] text-zinc-600">
                {locked
                    ? "Available later"
                    : description}
            </p>
        </div>
    );
}