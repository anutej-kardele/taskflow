import {
  Monitor,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
import WorkerClusterPanel from "./components/WorkerClusterPanel";

import useTaskFlowEvents from "./hooks/useTaskFlowEvents";

import {
  getJobSummary,
  getWorkers,
  getWorkloadJobs,
  getWorkloads,
  killWorker,
  startWorker,
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

  const [workers, setWorkers] =
    useState([]);

  const [
    workersLoading,
    setWorkersLoading,
  ] = useState(true);

  const [
    workerHealthError,
    setWorkerHealthError,
  ] = useState("");

  const [
    jobSummary,
    setJobSummary,
  ] = useState({
    totalJobs: 0,
    completedJobs: 0,
  });

  const jobSummaryEventTimer =
    useRef(null);

  const loadJobSummary =
    useCallback(async () => {
      try {
        const data =
          await getJobSummary();

        setJobSummary(data);
      } catch (err) {
        setError(err.message);
      }
    }, []);

  /*
   * SSE events can arrive in bursts.
   *
   * These timers allow us to combine several
   * notifications into one REST refresh.
   */
  const workloadEventTimer =
    useRef(null);

  const jobEventTimer =
    useRef(null);

  /*
   * Fetch all workloads.
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
   * Fetch jobs belonging to one workload.
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
   * Find the currently selected workload from
   * the latest workload state.
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
   * SSE: workload changed.
   *
   * Several job transitions can cause workload
   * notifications close together, so wait briefly
   * and perform one authoritative REST fetch.
   */
  const handleWorkloadUpdated =
    useCallback(() => {
      clearTimeout(
        workloadEventTimer.current,
      );

      workloadEventTimer.current =
        setTimeout(
          loadWorkloads,
          100,
        );
    }, [loadWorkloads]);

  /*
   * SSE: job changed.
   *
   * Only refresh jobs when the event belongs to
   * the workload currently open in the dashboard.
   */
  const handleJobUpdated =

    useCallback(
      (event) => {
        clearTimeout(
          jobSummaryEventTimer.current,
        );

        jobSummaryEventTimer.current =
          setTimeout(
            loadJobSummary,
            100,
          );

        if (
          !selectedWorkloadId ||
          event.workloadId !==
          selectedWorkloadId
        ) {
          return;
        }

        clearTimeout(
          jobEventTimer.current,
        );

        jobEventTimer.current =
          setTimeout(
            () =>
              loadJobs(
                event.workloadId,
              ),
            100,
          );
      },
      [
        selectedWorkloadId,
        loadJobs,
        loadJobSummary,
      ],
    );

  /*
 * Fetch worker health.
 */
  const loadWorkers =
    useCallback(async () => {
      try {
        const data =
          await getWorkers();

        setWorkers(
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

        setWorkerHealthError("");
      } catch (err) {
        setWorkerHealthError(
          err.message,
        );
      } finally {
        setWorkersLoading(false);
      }
    }, []);


  const handleWorkersUpdated =
    useCallback(() => {
      loadWorkers();
    }, [loadWorkers]);

  const handleSseConnected =
    useCallback(() => {
      loadWorkloads();
      loadWorkers();
      loadJobSummary();

      if (selectedWorkloadId) {
        loadJobs(
          selectedWorkloadId,
        );
      }
    }, [
      loadWorkloads,
      loadWorkers,
      loadJobSummary,
      loadJobs,
      selectedWorkloadId,
    ]);

  /*
* Establish one persistent SSE connection.
*
* The hook receives the callbacks only after all
* callback dependencies above have been created.
*/
  const sseStatus =
    useTaskFlowEvents({
      onConnected:
        handleSseConnected,

      onWorkloadUpdated:
        handleWorkloadUpdated,

      onJobUpdated:
        handleJobUpdated,

      onWorkersUpdated:
        handleWorkersUpdated,
    });


  useEffect(() => {
    const initialLoad =
      setTimeout(
        loadWorkers,
        0,
      );

    const reconciliation =
      setInterval(
        loadWorkers,
        30000,
      );

    return () => {
      clearTimeout(
        initialLoad,
      );

      clearInterval(
        reconciliation,
      );
    };
  }, [loadWorkers]);


  useEffect(() => {
    const initialLoad =
      setTimeout(
        loadWorkloads,
        0,
      );

    const reconciliation =
      setInterval(
        loadWorkloads,
        30000,
      );

    return () => {
      clearTimeout(
        initialLoad,
      );

      clearInterval(
        reconciliation,
      );
    };
  }, [loadWorkloads]);

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
   * Final synchronization.
   *
   * Workload state and job state are retrieved by
   * separate requests.
   *
   * When the workload becomes terminal, perform one
   * final job fetch so the details view ends with the
   * authoritative final job state.
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


  useEffect(() => {
    const initialLoad =
      setTimeout(
        () => {
          loadWorkloads();
          loadJobSummary();
        },
        0,
      );

    const reconciliation =
      setInterval(
        () => {
          loadWorkloads();
          loadJobSummary();
        },
        30000,
      );

    return () => {
      clearTimeout(
        initialLoad,
      );

      clearInterval(
        reconciliation,
      );
    };
  }, [
    loadWorkloads,
    loadJobSummary,
  ]);

  /*
   * Clear pending SSE debounce timers when App
   * unmounts.
   */
  useEffect(() => {
    return () => {
      clearTimeout(
        workloadEventTimer.current,
      );

      clearTimeout(
        jobEventTimer.current,
      );
    };
  }, []);

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
   * Called after the workload composer creates
   * one or more workloads.
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
   * Mobile workload accordion.
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

  /*
   * Development worker failure controls.
   */
  async function handleKillWorker(
    nodeId,
  ) {
    await killWorker(
      nodeId,
    );

    /*
     * Redis intentionally continues reporting the
     * worker ONLINE until its heartbeat TTL expires.
     */
    await loadWorkers();
  }

  async function handleStartWorker(
    nodeId,
  ) {
    await startWorker(
      nodeId,
    );

    /*
     * A restarted worker sends an immediate heartbeat.
     */
    await loadWorkers();
  }

  return (
    <div className="min-h-screen bg-[#05070b] text-zinc-100">
      <Header
        connected={connected}
      />

      <main className="mx-auto max-w-[1500px] px-3 py-3 sm:px-5">
        {/*
          Mobile notice.
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
              <span
                className={
                  sseStatus === "CONNECTED"
                    ? "text-emerald-400"
                    : "text-amber-400"
                }
              >
                {sseStatus === "CONNECTED"
                  ? "● LIVE"
                  : "○ LIVE"}
              </span>

              <span className="h-1 w-1 rounded-full bg-zinc-700" />

              {sseStatus === "CONNECTED"
                ? "SSE connected"
                : "SSE reconnecting"}

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
              workloads={workloads}
              jobSummary={jobSummary}
            />

            <WorkerClusterPanel
              workers={workers}
              loading={
                workersLoading
              }
              error={
                workerHealthError
              }
              onKill={
                handleKillWorker
              }
              onStart={
                handleStartWorker
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
          MongoDB · Kafka · Redis · Go · React
        </div>
      </footer>
    </div>
  );
}