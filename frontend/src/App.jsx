import {
  Monitor,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Header from "./components/Header";
import MobileWorkloadAccordion from "./components/MobileWorkloadAccordion";
import OverviewMetrics from "./components/OverviewMetrics";
import PlatformFeatures from "./components/PlatformFeatures";
import ProjectInfoPanel from "./components/ProjectInfoPanel";
import WorkloadComposer from "./components/WorkloadComposer";
import WorkloadDetails from "./components/WorkloadDetails";
import WorkloadList from "./components/WorkloadList";

import {
  getWorkloadJobs,
  getWorkloads,
} from "./api/taskflow";

export default function App() {
  const [workloads, setWorkloads] =
    useState([]);

  const [
    selectedWorkloadId,
    setSelectedWorkloadId,
  ] = useState(null);

  const [jobs, setJobs] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [connected, setConnected] =
    useState(false);

  const [
    lastRefreshedAt,
    setLastRefreshedAt,
  ] = useState(null);

  /*
   * Fetch all workloads.
   *
   * The workload list continues polling every 2 seconds
   * so background workload state changes stay visible.
   */
  const loadWorkloads =
    useCallback(async () => {
      try {
        const data =
          await getWorkloads();

        const sorted = [
          ...data,
        ].sort(
          (a, b) =>
            new Date(
              b.createdAt,
            ) -
            new Date(
              a.createdAt,
            ),
        );

        /*
         * Avoid replacing React state when nothing
         * actually changed.
         */
        setWorkloads(
          (current) => {
            const currentJson =
              JSON.stringify(
                current,
              );

            const nextJson =
              JSON.stringify(
                sorted,
              );

            if (
              currentJson ===
              nextJson
            ) {
              return current;
            }

            return sorted;
          },
        );

        setConnected(true);
        setError("");

        setLastRefreshedAt(
          new Date(),
        );
      } catch (err) {
        setConnected(false);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }, []);

  /*
   * Fetch jobs for one workload.
   *
   * Do NOT clear jobs here.
   *
   * Clearing jobs on every poll was what caused the
   * visible refresh/flicker while reading job history.
   */
  const loadJobs =
    useCallback(
      async (workloadId) => {
        if (!workloadId) {
          return;
        }

        try {
          const data =
            await getWorkloadJobs(
              workloadId,
            );

          /*
           * Only update state when the returned job data
           * actually changed.
           */
          setJobs(
            (current) => {
              const currentJson =
                JSON.stringify(
                  current,
                );

              const nextJson =
                JSON.stringify(
                  data,
                );

              if (
                currentJson ===
                nextJson
              ) {
                return current;
              }

              return data;
            },
          );
        } catch (err) {
          setError(err.message);
        }
      },
      [],
    );

  /*
   * Poll the overall workload list.
   */
  useEffect(() => {
    loadWorkloads();

    const interval =
      setInterval(
        loadWorkloads,
        2000,
      );

    return () =>
      clearInterval(interval);
  }, [loadWorkloads]);

  /*
   * Find the currently selected workload using the
   * latest workload list.
   */
  const selectedWorkload =
    useMemo(
      () =>
        workloads.find(
          (workload) =>
            workload.id ===
            selectedWorkloadId,
        ) ?? null,
      [
        workloads,
        selectedWorkloadId,
      ],
    );

  const selectedWorkloadStatus =
    selectedWorkload?.status ??
    null;

  /*
   * A workload is considered live while its state
   * may still change.
   */
  const selectedWorkloadIsLive =
    selectedWorkloadStatus ===
    "CREATED" ||
    selectedWorkloadStatus ===
    "RUNNING";

  /*
   * When the user selects a DIFFERENT workload:
   *
   * 1. Clear the previous workload's jobs once.
   * 2. Fetch jobs for the new workload.
   *
   * We do NOT clear jobs during polling.
   */
  useEffect(() => {
    if (!selectedWorkloadId) {
      setJobs([]);
      return;
    }

    setJobs([]);

    loadJobs(
      selectedWorkloadId,
    );
  }, [
    selectedWorkloadId,
    loadJobs,
  ]);

  /*
   * Poll job details only while the selected
   * workload is still live.
   *
   * CREATED / RUNNING:
   *     fetch every 2 seconds
   *
   * COMPLETED / FAILED:
   *     stop continuous polling
   */
  useEffect(() => {
    if (
      !selectedWorkloadId ||
      !selectedWorkloadIsLive
    ) {
      return undefined;
    }

    const interval =
      setInterval(
        () =>
          loadJobs(
            selectedWorkloadId,
          ),
        2000,
      );

    return () =>
      clearInterval(interval);
  }, [
    selectedWorkloadId,
    selectedWorkloadIsLive,
    loadJobs,
  ]);

  /*
   * FINAL SYNCHRONIZATION
   *
   * The workload list and job list are separate API
   * requests.
   *
   * It is possible for the workload polling request to
   * observe COMPLETED before the job polling request has
   * fetched the final COMPLETED job.
   *
   * Example of the old bug:
   *
   * Workload = COMPLETED
   * Progress = 90%
   * Running  = 1
   * Completed = 9
   *
   * When the workload enters a terminal state, perform
   * one final job fetch before leaving the historical
   * detail view static.
   */
  useEffect(() => {
    if (
      !selectedWorkloadId ||
      !selectedWorkloadStatus
    ) {
      return;
    }

    const terminal =
      selectedWorkloadStatus ===
      "COMPLETED" ||
      selectedWorkloadStatus ===
      "FAILED";

    if (!terminal) {
      return;
    }

    loadJobs(
      selectedWorkloadId,
    );
  }, [
    selectedWorkloadId,
    selectedWorkloadStatus,
    loadJobs,
  ]);

  const lastRefreshedLabel =
    lastRefreshedAt
      ? lastRefreshedAt.toLocaleTimeString(
        [],
        {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        },
      )
      : "—";

  /*
   * Called after the workload composer submits one or
   * more workloads.
   */
  async function handleCreated(
    createdWorkloads,
  ) {
    const newest =
      createdWorkloads.at(-1);

    if (newest) {
      setSelectedWorkloadId(
        newest.id,
      );
    }

    await loadWorkloads();
  }

  /*
   * Mobile accordion behavior:
   *
   * closed + tap
   *     -> open
   *
   * open + tap
   *     -> close
   *
   * another workload + tap
   *     -> previous closes
   *     -> new workload opens
   */
  function handleMobileToggle(
    workloadId,
  ) {
    setSelectedWorkloadId(
      (current) =>
        current === workloadId
          ? null
          : workloadId,
    );
  }

  return (
    <div className="min-h-screen bg-[#05070b] text-zinc-100">
      <Header
        connected={connected}
      />

      <main className="mx-auto max-w-[1500px] px-3 py-3 sm:px-5">
        {/*
          Mobile notice.
          Hidden automatically on desktop.
        */}
        <div className="mb-3 flex items-center gap-3 rounded-lg border border-blue-500/20 bg-blue-500/[0.06] px-3 py-2.5 lg:hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-blue-500/20 bg-blue-500/10 text-blue-400">
            <Monitor size={14} />
          </div>

          <div className="min-w-0">
            <p className="text-[11px] font-medium text-zinc-300">
              Best experienced on desktop
            </p>

            <p className="mt-0.5 text-[9px] leading-4 text-zinc-600">
              Mobile uses a compact workload view.
              Desktop provides the full execution console.
            </p>
          </div>
        </div>

        <section className="mb-2.5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-3">
                <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-blue-400">
                  Operations Console
                </p>

                <span className="hidden font-mono text-[8px] uppercase tracking-wider text-zinc-700 md:inline">
                  Distributed execution
                </span>
              </div>

              <h2 className="mt-0.5 text-xl font-semibold tracking-tight text-white">
                Distributed Workloads
              </h2>

              <p className="mt-0.5 text-[11px] text-zinc-600">
                Submit workloads, inspect
                execution and observe the
                distributed worker system.
              </p>
            </div>

            <div className="hidden items-center gap-1.5 pb-0.5 font-mono text-[8px] uppercase tracking-wider text-zinc-700 md:flex">
              REST

              <span className="h-1 w-1 rounded-full bg-zinc-700" />

              2 sec

              <span className="h-1 w-1 rounded-full bg-zinc-700" />

              refreshed{" "}
              {lastRefreshedLabel}
            </div>
          </div>
        </section>

        {error && (
          <div className="mb-2.5 rounded-lg border border-red-500/20 bg-red-500/[0.07] px-3 py-2 text-[11px] text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-xl border border-zinc-800 bg-[#0a0c10] py-16 text-center text-xs text-zinc-600">
            Connecting to TaskFlow...
          </div>
        ) : (
          <div className="space-y-3">
            <OverviewMetrics
              workloads={
                workloads
              }
            />

            <WorkloadComposer
              onCreated={
                handleCreated
              }
            />

            {/*
              Mobile / tablet layout.
            */}
            <div className="lg:hidden">
              <MobileWorkloadAccordion
                workloads={
                  workloads
                }
                selectedId={
                  selectedWorkloadId
                }
                jobs={jobs}
                onToggle={
                  handleMobileToggle
                }
              />
            </div>

            {/*
              Desktop layout.
            */}
            <div className="hidden gap-3 lg:grid lg:grid-cols-[0.9fr_1.1fr]">
              <WorkloadList
                workloads={
                  workloads
                }
                selectedId={
                  selectedWorkloadId
                }
                onSelect={
                  setSelectedWorkloadId
                }
                onShowInfo={() =>
                  setSelectedWorkloadId(
                    null,
                  )
                }
              />

              {selectedWorkload ? (
                <WorkloadDetails
                  workload={
                    selectedWorkload
                  }
                  jobs={jobs}
                />
              ) : (
                <ProjectInfoPanel />
              )}
            </div>

            <PlatformFeatures />
          </div>
        )}
      </main>

      <footer className="mx-auto max-w-[1500px] px-3 pb-4 pt-1 sm:px-5">
        <div className="border-t border-zinc-900 pt-3 font-mono text-[8px] uppercase tracking-wider text-zinc-700">
          TaskFlow · Spring Boot ·
          MongoDB · Kafka · Go · React
        </div>
      </footer>
    </div>
  );
}