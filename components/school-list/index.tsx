"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Play,
  RefreshCw,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";

import Button from "@/components/common/Button";
import FileInput from "@/components/common/FileInput";
import GenericTable from "@/components/common/GenericTable";
import Loader from "@/components/common/Loader";
import Select from "@/components/common/Select";
import { SPORTS } from "@/components/scraper/constants";
import { config } from "@/config";
import apiCall from "@/utils/api-call";
import { cn } from "@/utils/cn";
import { routes, type CsvResultType } from "@/utils/routes";
import { validateAndSetErrors } from "@/utils/validation";

import {
  COLUMNS,
  PHASE_LABEL,
  POLL_INTERVAL_MS,
  PREVIEW_PAGE_SIZE,
  RESULT_LABEL,
  SECONDS_PER_SCHOOL_PER_SPORT,
  STORAGE_KEY,
  formatDuration,
  previewCsv,
  sum,
  type AccessResponse,
  type CsvPreview,
  type JobStatusResponse,
  type ResultsResponse,
  type StartResponse,
  type StatusCounts,
} from "./constants";
import { csvScrapeSchema } from "./schema";

const RESULT_TYPES: CsvResultType[] = ["teams", "schedule", "roster", "coverage"];

// apiCall concatenates `${config.apiUrl}${endpoint}`, so config.apiUrl must end with
// "/". Download links are plain browser navigations built the same way.
const downloadUrl = (jobId: string, type: CsvResultType) =>
  `${config.apiUrl ?? ""}${routes.api.csvScrapeDownload(jobId, type)}`;

const saveJobId = (id: string | null) => {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // private mode / storage disabled: the job still runs, we just can't reconnect
  }
};

const readJobId = () => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

// --------------------------------------------------------------------------- //
// Small pieces
// --------------------------------------------------------------------------- //
function AccessBanner({
  access,
  checking,
  onRecheck,
}: {
  access: AccessResponse | null;
  checking: boolean;
  onRecheck: () => void;
}) {
  const state = checking || !access ? "checking" : access.status;
  const style = {
    checking: "border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300",
    ok: "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-300",
    blocked: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
    error: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
    unknown: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  }[state];

  return (
    <div className={cn("mt-6 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm", style)}>
      <span className="mt-0.5 shrink-0">
        {state === "checking" && <Loader size="sm" />}
        {state === "ok" && <CheckCircle2 className="h-4 w-4" />}
        {state === "blocked" && <XCircle className="h-4 w-4" />}
        {(state === "error" || state === "unknown") && <AlertTriangle className="h-4 w-4" />}
      </span>
      <div className="flex-1">
        {state === "checking" && "Checking whether the scraper server can reach MaxPreps…"}
        {state === "ok" && "MaxPreps is reachable from the scraper server."}
        {state === "blocked" && (
          <>
            <strong>
              MaxPreps is refusing the scraper server
              {access?.http_status ? ` (HTTP ${access.http_status})` : ""}.
            </strong>{" "}
            MaxPreps blocks some networks (e.g. non-US). A job started now would stop within a
            minute — run it from a network MaxPreps accepts, or arrange access with MaxPreps.
          </>
        )}
        {(state === "error" || state === "unknown") && (
          <>
            Couldn&apos;t confirm MaxPreps access{access?.detail ? ` (${access.detail})` : ""}.
            You can still start — a job that MaxPreps refuses stops within a minute.
          </>
        )}
      </div>
      <button
        type="button"
        onClick={onRecheck}
        disabled={checking}
        className="inline-flex shrink-0 items-center gap-1 text-xs font-medium underline-offset-2 hover:underline disabled:opacity-50"
      >
        <RefreshCw className="h-3 w-3" /> Re-check
      </button>
    </div>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-neutral-200 px-4 py-3 dark:border-neutral-800">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-black dark:text-zinc-100">{value}</p>
      {detail && <p className="mt-0.5 text-xs text-neutral-500">{detail}</p>}
    </div>
  );
}

const pageBreakdown = (c: StatusCounts | undefined) => {
  const parts = [
    ["fetched", sum(c, "ok")],
    ["empty", sum(c, "empty")],
    ["failed", sum(c, "failed", "no_data")],
    ["waiting", sum(c, "pending")],
  ].filter(([, n]) => (n as number) > 0);
  return parts.length
    ? parts.map(([label, n]) => `${(n as number).toLocaleString()} ${label}`).join(" · ")
    : "none yet";
};

function Downloads({ jobId, final }: { jobId: string; final: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {RESULT_TYPES.map((type) => (
        <a
          key={type}
          href={downloadUrl(jobId, type)}
          className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-zinc-100 dark:hover:bg-neutral-800"
        >
          <Download className="h-4 w-4" />
          {type}.csv{final ? "" : " (partial)"}
        </a>
      ))}
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Page
// --------------------------------------------------------------------------- //
function SchoolList() {
  // MaxPreps reachability (advisory)
  const [access, setAccess] = useState<AccessResponse | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(true);

  // Form
  const [file, setFile] = useState<File | null>(null);
  const [csvInfo, setCsvInfo] = useState<CsvPreview | null>(null);
  const [sports, setSports] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [starting, setStarting] = useState(false);

  // Job
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<JobStatusResponse | null>(null);
  const [eta, setEta] = useState("");
  const [acting, setActing] = useState(false);

  // Data preview
  const [showPreview, setShowPreview] = useState(false);
  const [tab, setTab] = useState<CsvResultType>("teams");
  const [page, setPage] = useState(0);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [preview, setPreview] = useState<ResultsResponse | null>(null);
  const [loadedKey, setLoadedKey] = useState("");

  const rateRef = useRef<{ t: number; done: number } | null>(null);
  const lastStatusRef = useRef<string | null>(null);

  const status = job?.status ?? "idle";
  const running = status === "running";

  // ---- MaxPreps access ---------------------------------------------------- //
  const [accessNonce, setAccessNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await apiCall<AccessResponse>({
        endpoint: routes.api.maxprepsHealth,
        method: "GET",
        skipCache: true,
      });
      if (cancelled) return;
      setAccess(
        res.success && res.data
          ? res.data
          : { status: "error", http_status: null, detail: "scraper server did not answer" }
      );
      setCheckingAccess(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [accessNonce]);

  const recheckAccess = () => {
    setCheckingAccess(true);
    setAccessNonce((n) => n + 1);
  };

  // ---- Reconnect to a job started earlier (it runs for hours) -------------- //
  useEffect(() => {
    const saved = readJobId();
    if (!saved) return;
    let cancelled = false;
    (async () => {
      const res = await apiCall<JobStatusResponse>({
        endpoint: routes.api.csvScrapeStatus(saved),
        method: "GET",
        skipCache: true,
      });
      if (cancelled) return;
      if (res.success && res.data) {
        lastStatusRef.current = res.data.status;
        setJobId(saved);
        setJob(res.data);
        if (res.data.status !== "running") setShowPreview(true);
      } else if (res.status === 404) {
        saveJobId(null); // deleted, or lost on a server without a persistent disk
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- Poll while running --------------------------------------------------- //
  useEffect(() => {
    if (!jobId || !running) return;

    const tick = async () => {
      const res = await apiCall<JobStatusResponse>({
        endpoint: routes.api.csvScrapeStatus(jobId),
        method: "GET",
        // Mandatory: apiCall's module-level GET cache would otherwise pin the first
        // response and the job would look frozen.
        skipCache: true,
      });
      if (!res.success || !res.data) return;
      const data = res.data;
      setJob(data);

      // ETA from the rate of schools resolved since this page started watching.
      // Computed here, not during render (Date.now() is impure).
      const total = data.progress?.schools.total ?? 0;
      const done = total - (data.progress?.schools.pending ?? 0);
      const now = Date.now();
      if (!rateRef.current || done < rateRef.current.done) rateRef.current = { t: now, done };
      const { t, done: done0 } = rateRef.current;
      const rate = (done - done0) / ((now - t) / 1000);
      setEta(data.phase === "crawl" && rate > 0 && total > done ? formatDuration((total - done) / rate) : "");

      if (lastStatusRef.current === "running" && data.status === "done") {
        toast.success("Scrape complete");
        setShowPreview(true);
      } else if (lastStatusRef.current === "running" && data.status === "error") {
        toast.error(data.error || "The job stopped with an error");
        setShowPreview(true);
      }
      lastStatusRef.current = data.status;
    };

    tick();
    const id = setInterval(tick, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [jobId, running]);

  // ---- Data preview (on demand; a snapshot while the job is unfinished) ----- //
  const previewKey = `${jobId}:${tab}:${page}:${refreshNonce}`;
  const previewLoading = showPreview && previewKey !== loadedKey;

  useEffect(() => {
    if (!jobId || !showPreview) return;
    let cancelled = false;
    (async () => {
      const res = await apiCall<ResultsResponse>({
        endpoint: routes.api.csvScrapeResults(jobId, tab, page * PREVIEW_PAGE_SIZE, PREVIEW_PAGE_SIZE),
        method: "GET",
        skipCache: true,
      });
      if (cancelled) return;
      setPreview(res.success && res.data ? res.data : null);
      setLoadedKey(previewKey);
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId, showPreview, tab, page, previewKey]);

  // ---- Form ----------------------------------------------------------------- //
  const onFile = async (f: File | null) => {
    setFile(f);
    setCsvInfo(null);
    setErrors((e) => ({ ...e, file: "" }));
    if (!f) return;
    try {
      const info = previewCsv(await f.text());
      setCsvInfo(info);
      if (!info.column) setErrors((e) => ({ ...e, file: "This CSV has no maxPrepsLink column" }));
      else if (!info.links) setErrors((e) => ({ ...e, file: "No usable MaxPreps school links in this CSV" }));
    } catch {
      setErrors((e) => ({ ...e, file: "Couldn't read this file as CSV" }));
    }
  };

  const start = async () => {
    if (starting || running) return;
    if (!(await validateAndSetErrors(csvScrapeSchema, { file, sports }, setErrors))) return;
    if (!file || !csvInfo?.column || !csvInfo.links) {
      setErrors((e) => ({ ...e, file: e.file || "Choose a CSV with a maxPrepsLink column" }));
      return;
    }

    const form = new FormData();
    form.append("file", file);
    form.append("sports", sports.join(","));

    setStarting(true);
    const res = await apiCall<StartResponse>({
      endpoint: routes.api.startCsvScrape,
      method: "POST",
      data: form,
    });
    setStarting(false);
    if (!res.success || !res.data?.job_id) return;

    const id = res.data.job_id;
    saveJobId(id);
    rateRef.current = null;
    lastStatusRef.current = "running";
    setEta("");
    setShowPreview(false);
    setPreview(null);
    setPage(0);
    setTab("teams");
    setJobId(id);
    setJob({
      job_id: id,
      status: "running",
      phase: "seed",
      filename: file.name,
      sports: sports.join(","),
      input: { rows: csvInfo.rows, links: res.data.links, skipped: res.data.skipped },
      progress: null,
      counts: null,
      restarts: 0,
      created_at: null,
      finished_at: null,
      error: null,
    });
    toast.success(`Job started for ${res.data.links.toLocaleString()} schools`);
  };

  // ---- Job actions ------------------------------------------------------- //
  const resume = async () => {
    if (!jobId) return;
    setActing(true);
    const res = await apiCall({ endpoint: routes.api.resumeCsvScrape(jobId), method: "POST" });
    setActing(false);
    if (!res.success) return;
    rateRef.current = null;
    lastStatusRef.current = "running";
    setJob((j) => (j ? { ...j, status: "running", error: null } : j));
    toast.success("Resuming — already-fetched pages are kept");
  };

  const forget = () => {
    saveJobId(null);
    setJobId(null);
    setJob(null);
    setPreview(null);
    setShowPreview(false);
    setEta("");
    rateRef.current = null;
    lastStatusRef.current = null;
  };

  const remove = async () => {
    if (!jobId) return;
    const msg = running
      ? "Stop this job and delete everything it has collected so far?"
      : "Delete this job and its files from the server?";
    if (!window.confirm(msg)) return;
    setActing(true);
    const res = await apiCall({ endpoint: routes.api.deleteCsvScrape(jobId), method: "DELETE" });
    setActing(false);
    if (res.success) {
      toast.success("Job deleted");
      forget();
    }
  };

  // ---- Derived ------------------------------------------------------------- //
  const p = job?.progress;
  const schoolsTotal = p?.schools.total ?? job?.input.links ?? 0;
  const schoolsDone = p ? schoolsTotal - (p.schools.pending ?? 0) : 0;
  const pct = schoolsTotal > 0 ? Math.min(100, Math.round((schoolsDone / schoolsTotal) * 100)) : 0;
  const failedPages = p
    ? sum(p.schools, "failed", "no_data") + sum(p.schedule, "failed") + sum(p.roster, "failed") + sum(p.staff, "failed")
    : 0;
  const estimate =
    csvInfo?.links && sports.length
      ? formatDuration(csvInfo.links * sports.length * SECONDS_PER_SCHOOL_PER_SPORT)
      : "";
  const formLocked = running || starting;
  const totalPages = preview ? Math.max(1, Math.ceil(preview.total / PREVIEW_PAGE_SIZE)) : 1;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          MaxPreps — Your School List
        </h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Upload a CSV of MaxPreps school links and pick the sports. For every school, each
          team on its page — Varsity, JV and Freshman, Boys and Girls, current season — gets
          its full schedule, roster and staff. Opponents are added as school rows. You get the
          same teams / schedule / roster CSVs as the state scraper, plus a coverage report.
        </p>
      </header>

      <AccessBanner access={access} checking={checkingAccess} onRecheck={recheckAccess} />

      {/* ---------------- Upload form ---------------- */}
      {!job && (
        <section className="mt-6 space-y-5 rounded-xl border border-neutral-200 p-6 dark:border-neutral-800">
          <div>
            <FileInput label="School links CSV" file={file} disabled={formLocked} onSelect={onFile} error={errors.file} />
            <p className="mt-1.5 text-xs text-neutral-500">
              Only the <code>maxPrepsLink</code> column is used; other columns are ignored. The
              state comes from each link, so there is nothing to pick.
            </p>
            {csvInfo?.column && csvInfo.links > 0 && (
              <div className="mt-3 rounded-lg bg-neutral-50 px-4 py-3 text-sm dark:bg-neutral-900">
                <p>
                  <strong>{csvInfo.links.toLocaleString()}</strong> school links
                  {csvInfo.skipped > 0 && (
                    <span className="text-neutral-500">
                      {" "}
                      · {csvInfo.skipped.toLocaleString()} rows skipped (blank, duplicate, test or non-MaxPreps)
                    </span>
                  )}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {csvInfo.byState.map(([st, n]) => (
                    <span
                      key={st}
                      className="rounded-full bg-white px-2.5 py-0.5 text-xs text-neutral-700 ring-1 ring-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:ring-neutral-700"
                    >
                      {st.toUpperCase()} {n.toLocaleString()}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <Select
              label="Sports"
              options={SPORTS}
              value={sports}
              onChange={(v) => {
                setSports(v);
                if (errors.sports) setErrors((e) => ({ ...e, sports: "" }));
              }}
              placeholder="Select one or more sports..."
              error={errors.sports}
            />
            <p className="mt-1.5 text-xs text-neutral-500">
              Each sport covers both genders and every level.
              {estimate
                ? ` Estimated time for this file: ${estimate} (≈ ${SECONDS_PER_SCHOOL_PER_SPORT} s per school per sport).`
                : " Expect roughly 15–18 hours per sport for ~5,000 schools."}{" "}
              The job keeps running on the server — you can close this page and come back.
            </p>
          </div>

          <Button onClick={start} isLoading={starting} disabled={formLocked}>
            {!starting && <Play className="h-4 w-4" />}
            {starting ? "Uploading…" : "Start scrape"}
          </Button>
        </section>
      )}

      {/* ---------------- Job ---------------- */}
      {job && jobId && (
        <section className="mt-6 space-y-5 rounded-xl border border-neutral-200 p-6 dark:border-neutral-800">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-black dark:text-zinc-100">
                {job.filename || "Uploaded CSV"} · {job.sports}
              </p>
              <p className="mt-0.5 text-xs text-neutral-500">
                {(job.input.links ?? 0).toLocaleString()} schools
                {job.input.skipped ? ` · ${job.input.skipped.toLocaleString()} rows skipped` : ""} · job{" "}
                <code>{jobId.slice(0, 8)}</code>
                {job.restarts > 0 && ` · resumed ${job.restarts}× after server restarts`}
              </p>
            </div>
            <span
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium",
                running && "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
                status === "done" && "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
                status === "error" && "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
              )}
            >
              {running ? "Running" : status === "done" ? "Done" : "Stopped"}
            </span>
          </div>

          {running && (
            <div>
              <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
                <Loader size="sm" />
                {(job.phase && PHASE_LABEL[job.phase]) || job.phase || "Starting…"}
              </div>
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                <div
                  className="h-full rounded-full bg-black transition-all duration-500 dark:bg-zinc-100"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-neutral-500">
                {schoolsDone.toLocaleString()} / {schoolsTotal.toLocaleString()} schools ({pct}%)
                {eta ? ` — ${eta} left in this phase` : ""}. Safe to close this page; it reconnects when you come back.
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              <p className="font-medium">The job stopped.</p>
              <p className="mt-1">{job.error || "Unknown error."}</p>
              <p className="mt-2 text-xs">
                Everything fetched so far is kept. Resume continues from where it stopped.
              </p>
            </div>
          )}

          {status === "done" && failedPages > 0 && (
            <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              {failedPages.toLocaleString()} page{failedPages === 1 ? "" : "s"} could not be fetched even after
              retrying. {failedPages === 1 ? "It is" : "They are"} listed with the reason in{" "}
              <code>coverage.csv</code> (status <code>failed</code>).
            </p>
          )}

          {p && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Schools" value={`${schoolsDone.toLocaleString()} / ${schoolsTotal.toLocaleString()}`} detail={pageBreakdown(p.schools)} />
              <Stat label="Schedules" value={(p.rows.games ?? 0).toLocaleString() + " games"} detail={pageBreakdown(p.schedule)} />
              <Stat label="Rosters" value={(p.rows.roster ?? 0).toLocaleString() + " people"} detail={`rosters: ${pageBreakdown(p.roster)}`} />
              <Stat label="Team rows" value={(job.counts?.teams ?? p.rows.schools ?? 0).toLocaleString()} detail={job.counts ? "incl. opponent schools" : "opponents added at the end"} />
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs text-neutral-500">
              {status === "done"
                ? "Final files:"
                : "Download what has been collected so far (same columns as the final files):"}
            </p>
            <Downloads jobId={jobId} final={status === "done"} />
          </div>

          <div className="flex flex-wrap gap-3 border-t border-neutral-100 pt-5 dark:border-neutral-800">
            {status === "error" && (
              <Button onClick={resume} isLoading={acting}>
                {!acting && <RotateCcw className="h-4 w-4" />} Resume
              </Button>
            )}
            {!showPreview && (
              <Button variant="outline" onClick={() => setShowPreview(true)}>
                Preview data
              </Button>
            )}
            {!running && (
              <Button variant="outline" onClick={forget} disabled={acting}>
                New upload
              </Button>
            )}
            <Button variant="outline" onClick={remove} disabled={acting} className="text-red-600">
              <Trash2 className="h-4 w-4" /> {running ? "Stop & delete" : "Delete job"}
            </Button>
          </div>
        </section>
      )}

      {/* ---------------- Preview ---------------- */}
      {job && jobId && showPreview && (
        <section className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2 border-b border-neutral-200 dark:border-neutral-800">
              {RESULT_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setTab(t);
                    setPage(0);
                  }}
                  className={cn(
                    "px-4 py-2 text-sm font-medium transition-colors",
                    tab === t
                      ? "border-b-2 border-black text-black dark:border-zinc-100 dark:text-zinc-100"
                      : "text-neutral-500 hover:text-black dark:hover:text-zinc-100"
                  )}
                >
                  {RESULT_LABEL[t]}
                  {job.counts ? ` (${job.counts[t].toLocaleString()})` : ""}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs text-neutral-500">
              {preview && (
                <span>
                  {preview.total.toLocaleString()} rows{preview.final ? "" : " so far"} · page {page + 1} / {totalPages}
                </span>
              )}
              <button
                type="button"
                aria-label="Previous page"
                disabled={page === 0 || previewLoading}
                onClick={() => setPage((n) => Math.max(0, n - 1))}
                className="rounded p-1 hover:bg-neutral-100 disabled:opacity-40 dark:hover:bg-neutral-800"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Next page"
                disabled={page + 1 >= totalPages || previewLoading}
                onClick={() => setPage((n) => n + 1)}
                className="rounded p-1 hover:bg-neutral-100 disabled:opacity-40 dark:hover:bg-neutral-800"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              {status !== "done" && (
                <button
                  type="button"
                  onClick={() => setRefreshNonce((n) => n + 1)}
                  disabled={previewLoading}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-neutral-100 disabled:opacity-40 dark:hover:bg-neutral-800"
                >
                  <RefreshCw className="h-3 w-3" /> Refresh
                </button>
              )}
            </div>
          </div>

          {previewLoading ? (
            <div className="flex justify-center py-10 text-neutral-500">
              <Loader />
            </div>
          ) : (
            <GenericTable
              columns={COLUMNS[tab]}
              data={preview?.rows ?? []}
              emptyMessage={status === "done" ? "No rows." : "Nothing collected for this file yet."}
            />
          )}
        </section>
      )}
    </div>
  );
}

export default SchoolList;
