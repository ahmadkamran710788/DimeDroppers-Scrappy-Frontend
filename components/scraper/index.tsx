"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Search } from "lucide-react";
import toast from "react-hot-toast";

import apiCall from "@/utils/api-call";
import { routes, type ScrapeResultType } from "@/utils/routes";
import { validateAndSetErrors } from "@/utils/validation";
import { config } from "@/config";

import Button from "@/components/common/Button";
import Loader from "@/components/common/Loader";
import Select from "@/components/common/Select";
import GenericTable, { type Column } from "@/components/common/GenericTable";

import { POLL_INTERVAL_MS, SPORTS, STATES } from "./constants";
import { scrapeSchema } from "./schema";

type JobStatus = "idle" | "running" | "done" | "error";

interface StartScrapeResponse {
  job_id: string;
  status: string;
}

interface StatusResponse {
  status: "running" | "done" | "error";
  counts: { teams: number; schedule: number } | null;
  error: string | null;
}

type TeamRow = Record<string, string>;
type ScheduleRow = Record<string, string>;

const TEAM_COLUMNS: Column<TeamRow>[] = [
  { key: "name", header: "School" },
  { key: "original_name", header: "Original Name" },
  { key: "city", header: "City" },
  { key: "state", header: "State" },
  { key: "mascot", header: "Mascot" },
  { key: "sports_count", header: "Sports" },
  {
    key: "url",
    header: "Link",
    render: (r) => (
      <a
        href={r.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline"
      >
        View
      </a>
    ),
  },
];

const SCHEDULE_COLUMNS: Column<ScheduleRow>[] = [
  { key: "school_name", header: "School" },
  { key: "sport", header: "Sport" },
  { key: "date", header: "Date" },
  { key: "home_away", header: "H/A" },
  { key: "opponent", header: "Opponent" },
  { key: "result", header: "Result" },
  { key: "score", header: "Score" },
];

// apiCall concatenates `${config.apiUrl}${endpoint}`, so config.apiUrl must end with
// "/". Build the download link the same way for a direct browser navigation.
const downloadUrl = (jobId: string, type: ScrapeResultType) =>
  `${config.apiUrl ?? ""}${routes.api.scrapeDownload(jobId, type)}`;

function Scraper() {
  const [states, setStates] = useState<string[]>([]);
  const [sports, setSports] = useState<string[]>([]);
  const [levels, setLevels] = useState<"Varsity" | "all">("Varsity");
  const [discover, setDiscover] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<JobStatus>("idle");
  const [counts, setCounts] = useState<StatusResponse["counts"]>(null);

  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [tab, setTab] = useState<ScrapeResultType>("teams");

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const loadResults = useCallback(async (id: string) => {
    const [t, s] = await Promise.all([
      apiCall<TeamRow[]>({
        endpoint: routes.api.scrapeResults(id, "teams"),
        method: "GET",
        skipCache: true,
      }),
      apiCall<ScheduleRow[]>({
        endpoint: routes.api.scrapeResults(id, "schedule"),
        method: "GET",
        skipCache: true,
      }),
    ]);
    if (t.success && t.data) setTeams(t.data);
    if (s.success && s.data) setSchedule(s.data);
  }, []);

  // Poll the job status while running.
  useEffect(() => {
    if (status !== "running" || !jobId) return;

    const tick = async () => {
      const res = await apiCall<StatusResponse>({
        endpoint: routes.api.scrapeStatus(jobId),
        method: "GET",
        skipCache: true, // status changes server-side; never serve a cached value
      });
      if (!res.success || !res.data) return;

      if (res.data.status === "done") {
        stopPolling();
        setCounts(res.data.counts);
        setStatus("done");
        await loadResults(jobId);
        toast.success("Scrape complete");
      } else if (res.data.status === "error") {
        stopPolling();
        setStatus("error");
        toast.error(res.data.error || "Scrape failed");
      }
    };

    tick(); // poll immediately, then on an interval
    pollRef.current = setInterval(tick, POLL_INTERVAL_MS);
    return stopPolling;
  }, [status, jobId, loadResults, stopPolling]);

  const handleSubmit = async () => {
    if (status === "running") return; // guard against double-submit (avoids a 429)
    if (!(await validateAndSetErrors(scrapeSchema, { states, sports }, setErrors)))
      return;

    setStatus("running");
    setTeams([]);
    setSchedule([]);
    setCounts(null);

    const res = await apiCall<StartScrapeResponse>({
      endpoint: routes.api.startScrape,
      method: "POST",
      data: {
        states: states.join(","),
        sports: sports.join(","),
        levels,
        discover,
      },
      // The API expects application/json; apiCall defaults to application/ld+json.
      headers: { "Content-Type": "application/json", Accept: "application/json" },
    });

    if (res.success && res.data) {
      setJobId(res.data.job_id);
    } else {
      setStatus("error");
    }
  };

  const reset = () => {
    stopPolling();
    setJobId(null);
    setStatus("idle");
    setCounts(null);
    setTeams([]);
    setSchedule([]);
  };

  const isRunning = status === "running";

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          MaxPreps Scraper
        </h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Pick one or more states and a sport to fetch teams and schedules from
          MaxPreps.
        </p>
      </header>

      <section className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-700">
        <div className="grid gap-5 sm:grid-cols-2">
          <Select
            label="States"
            options={STATES}
            value={states}
            onChange={(v) => {
              setStates(v);
              if (errors.states) setErrors((p) => ({ ...p, states: "" }));
            }}
            placeholder="Select states..."
            error={errors.states}
          />

          <Select
            label="Sport(s)"
            options={SPORTS}
            value={sports}
            onChange={(v) => {
              setSports(v);
              if (errors.sports) setErrors((p) => ({ ...p, sports: "" }));
            }}
            placeholder="Select sports..."
            error={errors.sports}
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
            <input
              type="checkbox"
              checked={levels === "all"}
              onChange={(e) => setLevels(e.target.checked ? "all" : "Varsity")}
            />
            Include JV / Freshman levels
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
            <input
              type="checkbox"
              checked={discover}
              onChange={(e) => setDiscover(e.target.checked)}
            />
            Expand coverage (graph crawl)
          </label>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Button onClick={handleSubmit} isLoading={isRunning}>
            {!isRunning && <Search className="h-4 w-4" />}
            {isRunning ? "Scraping..." : "Start scrape"}
          </Button>
          {(status === "done" || status === "error") && (
            <Button variant="outline" onClick={reset}>
              New scrape
            </Button>
          )}
        </div>
      </section>

      {isRunning && (
        <div className="mt-8 flex items-center gap-3 text-sm text-neutral-500">
          <Loader />
          <span>
            Crawling MaxPreps — this can take a few minutes for large states.
          </span>
        </div>
      )}

      {status === "error" && (
        <p className="mt-8 text-sm text-red-500">
          The scrape failed. Please try again, or pick a smaller scope.
        </p>
      )}

      {status === "done" && jobId && (
        <section className="mt-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTab("teams")}
                className={`rounded-lg px-3 py-1.5 text-sm ${
                  tab === "teams"
                    ? "bg-black text-white dark:bg-white dark:text-black"
                    : "text-neutral-600 dark:text-neutral-300"
                }`}
              >
                Teams ({counts?.teams ?? teams.length})
              </button>
              <button
                onClick={() => setTab("schedule")}
                className={`rounded-lg px-3 py-1.5 text-sm ${
                  tab === "schedule"
                    ? "bg-black text-white dark:bg-white dark:text-black"
                    : "text-neutral-600 dark:text-neutral-300"
                }`}
              >
                Schedule ({counts?.schedule ?? schedule.length})
              </button>
            </div>

            <div className="flex items-center gap-2">
              <a href={downloadUrl(jobId, "teams")}>
                <Button variant="outline">
                  <Download className="h-4 w-4" /> teams.csv
                </Button>
              </a>
              <a href={downloadUrl(jobId, "schedule")}>
                <Button variant="outline">
                  <Download className="h-4 w-4" /> schedule.csv
                </Button>
              </a>
            </div>
          </div>

          {tab === "teams" ? (
            <GenericTable
              columns={TEAM_COLUMNS}
              data={teams}
              emptyMessage="No teams found for this selection."
            />
          ) : (
            <GenericTable
              columns={SCHEDULE_COLUMNS}
              data={schedule}
              emptyMessage="No games found for this selection."
            />
          )}
        </section>
      )}
    </div>
  );
}

export default Scraper;
