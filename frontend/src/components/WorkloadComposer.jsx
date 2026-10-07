import {
    Cpu,
    Globe2,
    Minus,
    Moon,
    Plus,
    Send,
    Trash2,
    TriangleAlert,
} from "lucide-react";

import { useState } from "react";

import {
    createMultipleWorkloads,
} from "../api/taskflow";

const jobTypes = [
    {
        value: "SLEEP",
        label: "Sleep",
        icon: Moon,
    },
    {
        value: "CPU",
        label: "CPU",
        icon: Cpu,
    },
    {
        value: "HTTP",
        label: "HTTP",
        icon: Globe2,
    },
    {
        value: "UNRELIABLE",
        label: "Unreliable",
        icon: TriangleAlert,
    },
];

function configurationForType(jobType) {
    switch (jobType) {
        case "CPU":
            return {
                iterations: 5000000,
            };

        case "HTTP":
            return {
                url: "http://host.docker.internal:8080/api/workloads",
                timeoutMs: 5000,
            };

        case "UNRELIABLE":
            return {
                failureRate: 0.3,
                durationMs: 500,
            };

        case "SLEEP":
        default:
            return {
                durationMs: 2000,
            };
    }
}

function createDraft(
    jobType = "SLEEP",
    jobCount = 10,
    configuration = {},
) {
    return {
        id: crypto.randomUUID(),
        jobType,
        jobCount,
        configuration: {
            ...configurationForType(
                jobType,
            ),
            ...configuration,
        },
    };
}

/*
 * Phase 11 scenario presets.
 *
 * Presets only configure the composer.
 * They do NOT immediately submit anything.
 *
 * Users can still edit every value after
 * selecting a preset.
 */
const scenarioPresets = [
    {
        id: "basic",
        label: "Basic Load",
        description: "100 sleep jobs",
        workloads: [
            {
                jobType: "SLEEP",
                jobCount: 100,
                configuration: {
                    durationMs: 1000,
                },
            },
        ],
    },
    {
        id: "cpu",
        label: "CPU Stress",
        description: "500 CPU jobs",
        workloads: [
            {
                jobType: "CPU",
                jobCount: 500,
                configuration: {
                    iterations: 5000000,
                },
            },
        ],
    },
    {
        id: "api",
        label: "API Stress",
        description: "250 HTTP jobs",
        workloads: [
            {
                jobType: "HTTP",
                jobCount: 250,
                configuration: {
                    url: "http://host.docker.internal:8080/api/workloads",
                    timeoutMs: 5000,
                },
            },
        ],
    },
    {
        id: "failure",
        label: "Failure Test",
        description: "500 unreliable jobs",
        workloads: [
            {
                jobType: "UNRELIABLE",
                jobCount: 500,
                configuration: {
                    failureRate: 0.5,
                    durationMs: 500,
                },
            },
        ],
    },
    {
        id: "mixed",
        label: "Mixed Load",
        description: "10,000 mixed jobs",
        workloads: [
            {
                jobType: "SLEEP",
                jobCount: 1000,
                configuration: {
                    durationMs: 2000,
                },
            },
            {
                jobType: "CPU",
                jobCount: 4000,
                configuration: {
                    iterations: 5000000,
                },
            },
            {
                jobType: "HTTP",
                jobCount: 2000,
                configuration: {
                    url: "http://host.docker.internal:8080/api/workloads",
                    timeoutMs: 5000,
                },
            },
            {
                jobType: "UNRELIABLE",
                jobCount: 3000,
                configuration: {
                    failureRate: 0.3,
                    durationMs: 500,
                },
            },
        ],
    },
];

const initialDrafts = [
    createDraft("SLEEP"),
    createDraft("CPU"),
    createDraft("HTTP"),
    createDraft("UNRELIABLE"),
];

function Field({
    label,
    value,
    onChange,
    wide = false,
    type = "text",
    min,
    max,
    step = 1,
    ...props
}) {
    function changeNumber(direction) {
        const current =
            Number(value) || 0;

        const stepValue =
            Number(step) || 1;

        let next =
            current +
            direction * stepValue;

        if (min !== undefined) {
            next = Math.max(
                Number(min),
                next,
            );
        }

        if (max !== undefined) {
            next = Math.min(
                Number(max),
                next,
            );
        }

        next = Number(
            next.toFixed(6),
        );

        onChange(
            String(next),
        );
    }

    if (type === "number") {
        return (
            <label
                className={
                    wide
                        ? "col-span-2"
                        : ""
                }
            >
                <span className="mb-1 block text-[8px] font-medium uppercase tracking-[0.14em] text-zinc-600">
                    {label}
                </span>

                <div className="relative">
                    <input
                        {...props}
                        type="number"
                        min={min}
                        max={max}
                        step={step}
                        value={value}
                        onChange={(event) =>
                            onChange(
                                event.target.value,
                            )
                        }
                        className="
                            taskflow-number
                            h-8 w-full
                            rounded-md
                            border border-zinc-800
                            bg-[#05070b]
                            px-2.5 pr-[58px]
                            text-xs text-zinc-200
                            outline-none
                            transition
                            focus:border-blue-500/60
                            focus:ring-1
                            focus:ring-blue-500/20
                        "
                    />

                    <div className="absolute right-1 top-1/2 flex -translate-y-1/2 gap-0.5">
                        <button
                            type="button"
                            onClick={() =>
                                changeNumber(-1)
                            }
                            className="
                                flex h-6 w-6
                                items-center justify-center
                                rounded
                                text-zinc-600
                                transition
                                hover:bg-blue-500/10
                                hover:text-blue-400
                            "
                            aria-label={`Decrease ${label}`}
                        >
                            <Minus
                                size={10}
                            />
                        </button>

                        <button
                            type="button"
                            onClick={() =>
                                changeNumber(1)
                            }
                            className="
                                flex h-6 w-6
                                items-center justify-center
                                rounded
                                text-zinc-600
                                transition
                                hover:bg-blue-500/10
                                hover:text-blue-400
                            "
                            aria-label={`Increase ${label}`}
                        >
                            <Plus
                                size={10}
                            />
                        </button>
                    </div>
                </div>
            </label>
        );
    }

    return (
        <label
            className={
                wide
                    ? "col-span-2"
                    : ""
            }
        >
            <span className="mb-1 block text-[8px] font-medium uppercase tracking-[0.14em] text-zinc-600">
                {label}
            </span>

            <input
                {...props}
                type={type}
                value={value}
                onChange={(event) =>
                    onChange(
                        event.target.value,
                    )
                }
                className="
                    h-8 w-full
                    rounded-md
                    border border-zinc-800
                    bg-[#05070b]
                    px-2.5
                    text-xs text-zinc-200
                    outline-none
                    transition
                    focus:border-blue-500/60
                    focus:ring-1
                    focus:ring-blue-500/20
                "
            />
        </label>
    );
}

function ConfigurationFields({
    workload,
    updateConfiguration,
}) {
    const config =
        workload.configuration;

    if (
        workload.jobType ===
        "SLEEP"
    ) {
        return (
            <Field
                label="Duration ms"
                type="number"
                min="1"
                step="100"
                value={
                    config.durationMs
                }
                onChange={(value) =>
                    updateConfiguration({
                        durationMs:
                            Number(value),
                    })
                }
            />
        );
    }

    if (
        workload.jobType ===
        "CPU"
    ) {
        return (
            <Field
                label="Iterations"
                type="number"
                min="1"
                step="100000"
                value={
                    config.iterations
                }
                onChange={(value) =>
                    updateConfiguration({
                        iterations:
                            Number(value),
                    })
                }
            />
        );
    }

    if (
        workload.jobType ===
        "HTTP"
    ) {
        return (
            <>
                <Field
                    label="Timeout ms"
                    type="number"
                    min="1"
                    step="500"
                    value={
                        config.timeoutMs
                    }
                    onChange={(value) =>
                        updateConfiguration({
                            timeoutMs:
                                Number(
                                    value,
                                ),
                        })
                    }
                />

                <Field
                    label="URL"
                    value={
                        config.url
                    }
                    wide
                    onChange={(value) =>
                        updateConfiguration({
                            url: value,
                        })
                    }
                />
            </>
        );
    }

    return (
        <>
            <Field
                label="Failure rate"
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={
                    config.failureRate
                }
                onChange={(value) =>
                    updateConfiguration({
                        failureRate:
                            Number(value),
                    })
                }
            />

            <Field
                label="Duration ms"
                type="number"
                min="1"
                step="100"
                value={
                    config.durationMs
                }
                onChange={(value) =>
                    updateConfiguration({
                        durationMs:
                            Number(value),
                    })
                }
            />
        </>
    );
}

export default function WorkloadComposer({
    onCreated,
}) {
    const [
        drafts,
        setDrafts,
    ] = useState(
        initialDrafts,
    );

    const [
        activePreset,
        setActivePreset,
    ] = useState(null);

    const [
        submitting,
        setSubmitting,
    ] = useState(false);

    const [
        error,
        setError,
    ] = useState("");

    const totalJobs =
        drafts.reduce(
            (total, draft) =>
                total +
                (Number(
                    draft.jobCount,
                ) || 0),
            0,
        );

    function updateDraft(
        id,
        update,
    ) {
        /*
         * Once the user manually changes a
         * preset, it becomes a custom scenario.
         */
        setActivePreset(null);

        setDrafts((current) =>
            current.map((draft) =>
                draft.id === id
                    ? {
                        ...draft,
                        ...update,
                    }
                    : draft,
            ),
        );
    }

    function changeType(
        id,
        jobType,
    ) {
        updateDraft(
            id,
            {
                jobType,
                configuration:
                    configurationForType(
                        jobType,
                    ),
            },
        );
    }

    function addDraft() {
        setActivePreset(null);

        setDrafts(
            (current) => [
                ...current,
                createDraft(),
            ],
        );
    }

    function removeDraft(id) {
        setActivePreset(null);

        setDrafts(
            (current) => {
                if (
                    current.length ===
                    1
                ) {
                    return current;
                }

                return current.filter(
                    (draft) =>
                        draft.id !==
                        id,
                );
            },
        );
    }

    function applyPreset(
        preset,
    ) {
        const nextDrafts =
            preset.workloads.map(
                (workload) =>
                    createDraft(
                        workload.jobType,
                        workload.jobCount,
                        workload.configuration,
                    ),
            );

        setDrafts(
            nextDrafts,
        );

        setActivePreset(
            preset.id,
        );

        setError("");
    }

    async function submitAll() {
        if (
            totalJobs <= 0
        ) {
            setError(
                "Scenario must contain at least one job.",
            );

            return;
        }

        setSubmitting(true);
        setError("");

        try {
            const payloads =
                drafts.map(
                    ({
                        id: _id,
                        ...payload
                    }) => payload,
                );

            const results =
                await createMultipleWorkloads(
                    payloads,
                );

            const successful =
                results
                    .filter(
                        (result) =>
                            result.status ===
                            "fulfilled",
                    )
                    .map(
                        (result) =>
                            result.value,
                    );

            const failed =
                results.filter(
                    (result) =>
                        result.status ===
                        "rejected",
                );

            if (
                failed.length > 0
            ) {
                setError(
                    `${failed.length} workload request(s) failed.`,
                );
            }

            if (
                successful.length > 0
            ) {
                onCreated?.(
                    successful,
                );
            }
        } catch (err) {
            setError(
                err.message,
            );
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <section className="rounded-xl border border-zinc-800 bg-[#0a0c10]">

            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 px-3.5 py-2.5">
                <div>
                    <div className="flex items-center gap-2">
                        <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-blue-400">
                            Workload Composer
                        </p>

                        <span className="font-mono text-[8px] text-zinc-700">
                            {drafts.length} configured
                        </span>
                    </div>

                    <h2 className="mt-0.5 text-sm font-semibold text-white">
                        Build execution scenario
                    </h2>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <span className="mr-1 font-mono text-[7px] uppercase tracking-wider text-zinc-700">
                        Presets
                    </span>

                    {scenarioPresets.map(
                        (preset) => {
                            const selected =
                                activePreset ===
                                preset.id;

                            return (
                                <button
                                    key={preset.id}
                                    type="button"
                                    onClick={() =>
                                        applyPreset(
                                            preset,
                                        )
                                    }
                                    aria-pressed={
                                        selected
                                    }
                                    title={
                                        preset.description
                                    }
                                    className={`
                            h-7
                            rounded-md
                            border
                            px-2.5
                            text-[9px]
                            transition
                            ${selected
                                            ? "border-blue-500/40 bg-blue-500/15 text-blue-300"
                                            : "border-zinc-800 bg-[#07090d] text-zinc-500 hover:border-blue-500/25 hover:text-zinc-300"
                                        }
                        `}
                                >
                                    {preset.label}
                                </button>
                            );
                        },
                    )}

                    <div className="mx-1 h-4 w-px bg-zinc-800" />

                    <span className="font-mono text-[7px] uppercase tracking-wider text-zinc-700">
                        {totalJobs.toLocaleString()} jobs
                    </span>

                    <button
                        type="button"
                        onClick={addDraft}
                        className="
                ml-1
                flex h-7 items-center gap-1
                rounded-md border
                border-blue-500/25
                bg-blue-500/10
                px-2.5
                text-[11px] text-blue-300
                transition
                hover:bg-blue-500/15
            "
                    >
                        <Plus size={12} />
                        Add
                    </button>
                </div>
            </div>



            <div className="grid gap-2.5 p-3 md:grid-cols-2 xl:grid-cols-4">
                {drafts.map(
                    (
                        workload,
                        index,
                    ) => {
                        const selectedType =
                            jobTypes.find(
                                (type) =>
                                    type.value ===
                                    workload.jobType,
                            );

                        const TypeIcon =
                            selectedType
                                ?.icon ??
                            Moon;

                        return (
                            <div
                                key={
                                    workload.id
                                }
                                className="
                                    flex flex-col
                                    rounded-lg
                                    border border-zinc-800
                                    bg-[#07090d]
                                    p-2.5
                                "
                            >
                                <div className="mb-2 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="flex h-7 w-7 items-center justify-center rounded-md border border-blue-500/20 bg-blue-500/10 text-blue-400">
                                            <TypeIcon
                                                size={
                                                    12
                                                }
                                            />
                                        </div>

                                        <div>
                                            <p className="text-[11px] font-medium text-zinc-200">
                                                Workload{" "}
                                                {
                                                    index +
                                                    1
                                                }
                                            </p>

                                            <p className="font-mono text-[7px] uppercase tracking-wider text-zinc-600">
                                                {
                                                    workload.jobType
                                                }
                                            </p>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        disabled={
                                            drafts.length ===
                                            1
                                        }
                                        onClick={() =>
                                            removeDraft(
                                                workload.id,
                                            )
                                        }
                                        className="
                                            rounded-md p-1
                                            text-zinc-700
                                            transition
                                            hover:bg-red-500/10
                                            hover:text-red-400
                                            disabled:opacity-20
                                        "
                                        aria-label={`Remove workload ${index + 1}`}
                                    >
                                        <Trash2
                                            size={
                                                12
                                            }
                                        />
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-x-2 gap-y-2">
                                    <label className="col-span-2">
                                        <span className="mb-1 block text-[8px] font-medium uppercase tracking-[0.14em] text-zinc-600">
                                            Job type
                                        </span>

                                        <select
                                            value={
                                                workload.jobType
                                            }
                                            onChange={(
                                                event,
                                            ) =>
                                                changeType(
                                                    workload.id,
                                                    event
                                                        .target
                                                        .value,
                                                )
                                            }
                                            className="
                                                h-8 w-full
                                                rounded-md
                                                border border-zinc-800
                                                bg-[#05070b]
                                                px-2.5
                                                text-xs
                                                text-zinc-200
                                                outline-none
                                                focus:border-blue-500/60
                                            "
                                        >
                                            {jobTypes.map(
                                                (
                                                    type,
                                                ) => (
                                                    <option
                                                        key={
                                                            type.value
                                                        }
                                                        value={
                                                            type.value
                                                        }
                                                    >
                                                        {
                                                            type.label
                                                        }
                                                    </option>
                                                ),
                                            )}
                                        </select>
                                    </label>

                                    <Field
                                        label="Jobs"
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={
                                            workload.jobCount
                                        }
                                        onChange={(
                                            value,
                                        ) =>
                                            updateDraft(
                                                workload.id,
                                                {
                                                    jobCount:
                                                        Number(
                                                            value,
                                                        ),
                                                },
                                            )
                                        }
                                    />

                                    <ConfigurationFields
                                        workload={
                                            workload
                                        }
                                        updateConfiguration={(
                                            changes,
                                        ) =>
                                            updateDraft(
                                                workload.id,
                                                {
                                                    configuration:
                                                    {
                                                        ...workload.configuration,
                                                        ...changes,
                                                    },
                                                },
                                            )
                                        }
                                    />
                                </div>
                            </div>
                        );
                    },
                )}
            </div>

            {error && (
                <div className="mx-3 mb-2 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
                    {error}
                </div>
            )}

            <div className="flex items-center justify-between gap-3 border-t border-zinc-800 px-3.5 py-2">
                <div className="flex items-center gap-2">
                    <p className="font-mono text-[8px] uppercase tracking-wider text-zinc-700">
                        Requests execute concurrently
                    </p>

                    <span className="h-1 w-1 rounded-full bg-zinc-800" />

                    <p className="font-mono text-[8px] uppercase tracking-wider text-zinc-600">
                        {totalJobs.toLocaleString()} jobs
                    </p>
                </div>

                <button
                    type="button"
                    onClick={
                        submitAll
                    }
                    disabled={
                        submitting ||
                        totalJobs <= 0
                    }
                    className="
                        flex h-8 items-center gap-1.5
                        rounded-md
                        bg-blue-600
                        px-3.5
                        text-[11px] font-medium
                        text-white
                        transition
                        hover:bg-blue-500
                        disabled:cursor-not-allowed
                        disabled:opacity-50
                    "
                >
                    <Send
                        size={12}
                    />

                    {submitting
                        ? "Launching..."
                        : drafts.length ===
                            1
                            ? `Run ${totalJobs.toLocaleString()} jobs`
                            : `Run ${drafts.length} workloads · ${totalJobs.toLocaleString()} jobs`}
                </button>
            </div>
        </section>
    );
}