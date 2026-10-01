import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Header from "./components/Header";
import OverviewMetrics from "./components/OverviewMetrics";
import PlatformFeatures from "./components/PlatformFeatures";
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

        setWorkloads(sorted);
        setConnected(true);
        setError("");
      } catch (err) {
        setConnected(false);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }, []);

  const loadJobs =
    useCallback(async () => {
      if (!selectedWorkloadId) {
        setJobs([]);
        return;
      }

      try {
        const data =
          await getWorkloadJobs(
            selectedWorkloadId,
          );

        setJobs(data);
      } catch (err) {
        setError(err.message);
      }
    }, [selectedWorkloadId]);

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

  useEffect(() => {
    loadJobs();

    if (!selectedWorkloadId) {
      return undefined;
    }

    const interval =
      setInterval(
        loadJobs,
        2000,
      );

    return () =>
      clearInterval(interval);
  }, [
    loadJobs,
    selectedWorkloadId,
  ]);

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

  return (
    <div className="min-h-screen bg-[#05070b] text-zinc-100">
      <Header
        connected={connected}
      />

      <main className="mx-auto max-w-[1500px] px-5 py-3">
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
              REST polling
              <span className="h-1 w-1 rounded-full bg-zinc-700" />
              2 sec
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

            <div className="grid gap-3 xl:grid-cols-[0.9fr_1.1fr]">
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
              />

              <WorkloadDetails
                workload={
                  selectedWorkload
                }
                jobs={jobs}
              />
            </div>

            <PlatformFeatures />
          </div>
        )}
      </main>

      <footer className="mx-auto max-w-[1500px] px-5 pb-4 pt-1">
        <div className="border-t border-zinc-900 pt-3 font-mono text-[8px] uppercase tracking-wider text-zinc-700">
          TaskFlow · Spring Boot ·
          MongoDB · Kafka · Go · React
        </div>
      </footer>
    </div>
  );
}