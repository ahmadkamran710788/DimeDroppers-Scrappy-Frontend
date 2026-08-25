"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Download, RotateCcw } from "lucide-react";
import Button from "@/components/common/Button";
import FileInput from "@/components/common/FileInput";
import GenericTable from "@/components/common/GenericTable";
import Input from "@/components/common/Input";
import Loader from "@/components/common/Loader";
import apiCall from "@/utils/api-call";
import { cn } from "@/utils/cn";
import { config } from "@/config";
import { routes, type MsResultType } from "@/utils/routes";
import {
  POLL_INTERVAL_MS,
  SCHEDULE_COLUMNS,
  SCHOOL_COLUMNS,
  type ScheduleRow,
  type SchoolRow,
} from "./constants";

type JobStatus = "idle" | "running" | "done" | "error";

interface StatusResponse {
  status: "running" | "done" | "error";
  phase: string | null;
  progress: { done: number; total: number };
  counts: { schools: number; matched: number; events: number } | null;
  error: string | null;
}

// apiCall concatenates `${config.apiUrl}${endpoint}`, so config.apiUrl must end with
// "/". Build the download link the same way for a direct browser navigation.
const downloadUrl = (jobId: string, type: MsResultType) =>
  `${config.apiUrl ?? ""}${routes.api.msGofanDownload(jobId, type)}`;

const PHASE_LABEL: Record<string, string> = {
  link: "Searching GoFan for each school",
  schedule: "Fetching schedules for matched schools",
  done: "Finished",
};

const formatEta = (
  startedAt: number | null,
  progress: { done: number; total: number }
) => {
  if (!startedAt || progress.done <= 0 || progress.total <= progress.done) return "";
  const elapsed = (Date.now() - startedAt) / 1000;
  const secs = (elapsed / progress.done) * (progress.total - progress.done);
  if (!Number.isFinite(secs) || secs < 60) return "under a minute";
  const h = Math.floor(secs / 3600);
  const m = Math.round((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
};

function MiddleSchools() {
  const [file, setFile] = useState<File | null>(null);
  const [limit, setLimit] = useState("");
  const [status, setStatus] = useState<JobStatus>("idle");
  const [jobId, setJobId] = useState<string | null>(null);
  const [phase, setPhase] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [counts, setCounts] = useState<StatusResponse["counts"]>(null);
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [tab, setTab] = useState<MsResultType>("schools");
  const [uploading, setUploading] = useState(false);
  const [eta, setEta] = useState("");

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const loadResults = useCallback(async (id: string) => {
    const [s, sch] = await Promise.all([
      apiCall<SchoolRow[]>({
        endpoint: routes.api.msGofanResults(id, "schools"),
        method: "GET",
      }),
      apiCall<ScheduleRow[]>({
        endpoint: routes.api.msGofanResults(id, "schedule"),
        method: "GET",
      }),
    ]);
    if (s.success && s.data) setSchools(s.data);
    if (sch.success && sch.data) setSchedule(sch.data);
  }, []);

  useEffect(() => {
    if (status !== "running" || !jobId) return;

    const tick = async () => {
      const res = await apiCall<StatusResponse>({
        endpoint: routes.api.msGofanStatus(jobId),
        method: "GET",
        // Mandatory: apiCall keeps a module-level GET cache that would otherwise pin
        // the first response and the job would look stuck forever.
        skipCache: true,
      });
      if (!res.success || !res.data) return;

      setPhase(res.data.phase);
      setProgress(res.data.progress);
      // Rough ETA from the rate observed so far. Computed here rather than during
      // render because Date.now() is impure and React 19 forbids it in render.
      // A large file runs for hours, so a bare percentage isn't enough to decide
      // whether to wait.
      setEta(formatEta(startedAtRef.current, res.data.progress));

      if (res.data.status === "done") {
        stopPolling();
        setCounts(res.data.counts);
        setStatus("done");
        await loadResults(jobId);
        toast.success("GoFan enrichment complete");
      } else if (res.data.status === "error") {
        stopPolling();
        setStatus("error");
        toast.error(res.data.error || "Job failed");
      }
    };

    tick();
    pollRef.current = setInterval(tick, POLL_INTERVAL_MS);
    return stopPolling;
  }, [status, jobId, loadResults, stopPolling]);

  const start = async () => {
    if (status === "running" || uploading) return;
    if (!file) {
      toast.error("Choose a CSV first");
      return;
    }

    const form = new FormData();
    form.append("file", file);
    form.append("limit", String(Number(limit) > 0 ? Number(limit) : 0));

    setUploading(true);
    setSchools([]);
    setSchedule([]);
    setCounts(null);
    setProgress({ done: 0, total: 0 });
    setPhase(null);

    const res = await apiCall<{ job_id: string }>({
      endpoint: routes.api.startMsGofan,
      method: "POST",
      data: form,
    });
    setUploading(false);

    if (res.success && res.data?.job_id) {
      setJobId(res.data.job_id);
      startedAtRef.current = Date.now();
      setStatus("running");
      toast.success("Upload accepted — job started");
    } else {
      setStatus("error");
    }
  };

  const reset = () => {
    stopPolling();
    setFile(null);
    setLimit("");
    setStatus("idle");
    setJobId(null);
    startedAtRef.current = null;
    setEta("");
    setPhase(null);
    setProgress({ done: 0, total: 0 });
    setCounts(null);
    setSchools([]);
    setSchedule([]);
  };

  const pct =
    progress.total > 0
      ? Math.min(100, Math.round((progress.done / progress.total) * 100))
      : 0;

  const busy = status === "running" || uploading;

  return (
    <div className="w-full max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-100">
        GoFan Middle Schools
      </h1>
      <p className="mt-2 text-sm text-neutral-500">
        Upload a middle-school CSV with a <code>SCH_NAME</code> column. Each row is
        searched on GoFan and verified against its city and state, the matched GoFan
        link is appended to your file, and every matched school&apos;s upcoming
        schedule is collected into a second CSV.
      </p>

      <div className="mt-8 space-y-5 rounded-xl border border-neutral-200 p-6 dark:border-neutral-800">
        <FileInput
          label="Middle-school CSV"
          file={file}
          disabled={busy}
          onSelect={setFile}
        />

        <Input
          id="row-limit"
          label="Row limit (optional)"
          type="number"
          min={0}
          placeholder="Leave blank to process every row"
          value={limit}
          disabled={busy}
          onChange={(e) => setLimit(e.target.value)}
        />
        <p className="-mt-3 text-xs text-neutral-500">
          Any file size works — there is no row cap. Expect roughly 2 minutes per 1,000
          rows (a 25,000-row file takes about an hour). Set a small limit to try it out
          first; you can leave the page and come back while it runs.
        </p>

        <div className="flex flex-wrap gap-3">
          <Button onClick={start} isLoading={busy} disabled={!file}>
            {uploading ? "Uploading…" : "Start enrichment"}
          </Button>
          {status !== "idle" && (
            <Button variant="outline" onClick={reset} disabled={busy}>
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          )}
        </div>
      </div>

      {status === "running" && (
        <div className="mt-6 rounded-xl border border-neutral-200 p-6 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <Loader size="sm" />
            <span className="text-sm text-neutral-600 dark:text-neutral-300">
              {(phase && PHASE_LABEL[phase]) || "Starting…"}
            </span>
          </div>
          {progress.total > 0 && (
            <>
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                <div
                  className="h-full rounded-full bg-black transition-all duration-500 dark:bg-zinc-100"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-neutral-500">
                {progress.done.toLocaleString()} / {progress.total.toLocaleString()} (
                {pct}%){eta ? ` — about ${eta} remaining` : ""}
              </p>
            </>
          )}
        </div>
      )}

      {status === "error" && (
        <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          The job failed. Check the row limit and the CSV&apos;s SCH_NAME column, then
          try again.
        </p>
      )}

      {status === "done" && jobId && (
        <div className="mt-8 space-y-5">
          <div className="flex flex-wrap gap-6 text-sm">
            <span>
              <strong>{counts?.schools.toLocaleString() ?? 0}</strong> rows processed
            </span>
            <span>
              <strong>{counts?.matched.toLocaleString() ?? 0}</strong> GoFan links found
            </span>
            <span>
              <strong>{counts?.events.toLocaleString() ?? 0}</strong> scheduled events
            </span>
          </div>

          <div className="flex flex-wrap gap-3">
            <a href={downloadUrl(jobId, "schools")}>
              <Button variant="outline">
                <Download className="h-4 w-4" />
                gofan_schools.csv
              </Button>
            </a>
            <a href={downloadUrl(jobId, "schedule")}>
              <Button variant="outline">
                <Download className="h-4 w-4" />
                gofan_schedule.csv
              </Button>
            </a>
          </div>

          <div className="flex gap-2 border-b border-neutral-200 dark:border-neutral-800">
            {(["schools", "schedule"] as MsResultType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors",
                  tab === t
                    ? "border-b-2 border-black text-black dark:border-zinc-100 dark:text-zinc-100"
                    : "text-neutral-500 hover:text-black dark:hover:text-zinc-100"
                )}
              >
                {t === "schools" ? "Schools" : "Schedule"}
              </button>
            ))}
          </div>

          <p className="text-xs text-neutral-500">
            Showing the first {(tab === "schools" ? schools : schedule).length} rows —
            download for the complete file.
          </p>

          {tab === "schools" ? (
            <GenericTable
              columns={SCHOOL_COLUMNS}
              data={schools}
              emptyMessage="No rows"
            />
          ) : (
            <GenericTable
              columns={SCHEDULE_COLUMNS}
              data={schedule}
              emptyMessage="No upcoming events for the matched schools"
            />
          )}
        </div>
      )}
    </div>
  );
}

export default MiddleSchools;
