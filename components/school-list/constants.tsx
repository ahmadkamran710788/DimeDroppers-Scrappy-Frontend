import type { Column } from "@/components/common/GenericTable";
import type { CsvResultType } from "@/utils/routes";
import { cn } from "@/utils/cn";

// Rows come back from the API as raw CSV records, so every value is a string.
export type Row = Record<string, string>;

// A job runs for hours; its status only moves every ~15 s server-side.
export const POLL_INTERVAL_MS = 5000;
export const PREVIEW_PAGE_SIZE = 100;
// Remembers the current job across reloads/visits: a job runs ~15–18 h per sport, and
// the page reconnects to it instead of losing track.
export const STORAGE_KEY = "dd.csvScrape.jobId";

// Rough cost model, from the backend's measured rate: ~13 pages per school per sport
// (school page + ~4 teams x schedule/roster/staff) at ~1.3 pages/s -> ~10 s, plus
// retries and the enrichment steps. Used only for the pre-upload estimate.
export const SECONDS_PER_SCHOOL_PER_SPORT = 12;

export const RESULT_LABEL: Record<CsvResultType, string> = {
  teams: "Teams",
  schedule: "Schedule",
  roster: "Roster",
  coverage: "Coverage",
};

// csv_worker.py phases (and the enrichment sub-phases it reports as "enrich: <name>").
export const PHASE_LABEL: Record<string, string> = {
  seed: "Reading your CSV",
  crawl: "Fetching schools, schedules and rosters from MaxPreps",
  retry: "Retrying pages that failed",
  export: "Writing the CSV files",
  "enrich: opponent harvest": "Adding opponent schools",
  "enrich: gofan enrichment": "Matching GoFan ticket links",
  "enrich: nfhs enrichment": "Matching NFHS Network links",
  "enrich: opponent resolve": "Resolving opponent names and logos",
  finalize: "Building the coverage report",
  done: "Finished",
};

// --------------------------------------------------------------------------- //
// Status payload (GET /scrape/csv/{id})
// --------------------------------------------------------------------------- //
export type StatusCounts = Partial<
  Record<"pending" | "ok" | "empty" | "failed" | "no_data" | "total", number>
>;

export interface JobProgress {
  schools: StatusCounts;
  schedule: StatusCounts;
  roster: StatusCounts;
  staff: StatusCounts;
  rows: { schools: number; games: number; roster: number };
}

export interface JobStatusResponse {
  job_id: string;
  status: "running" | "done" | "error";
  phase: string | null;
  filename: string | null;
  sports: string | null;
  input: { rows: number | null; links: number | null; skipped: number | null };
  progress: JobProgress | null;
  counts: Record<CsvResultType, number> | null;
  restarts: number;
  created_at: number | null;
  finished_at: number | null;
  error: string | null;
}

export interface StartResponse {
  job_id: string;
  status: string;
  links: number;
  skipped: number;
  maxpreps_access: string | null;
}

export interface ResultsResponse {
  status: string;
  final: boolean;
  offset: number;
  limit: number;
  total: number;
  rows: Row[];
}

export interface AccessResponse {
  status: "ok" | "blocked" | "error" | "unknown";
  http_status: number | null;
  detail: string;
  checked_at?: number;
}

// --------------------------------------------------------------------------- //
// Client-side look at the CSV before uploading
// --------------------------------------------------------------------------- //
export interface CsvPreview {
  column: string | null;
  rows: number;
  links: number;
  skipped: number;
  byState: [string, number][];
}

const normHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

// Minimal RFC 4180 parser: quoted fields may contain commas, quotes ("") and newlines
// (the sample file has names like "Cardenas Federal Prep (Tijuana, Mexico)").
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// Mirrors csv_seed_scraper.normalize_link closely enough for a preview. The server's
// counts (returned when the job starts) are authoritative.
function schoolRoot(raw: string): { url: string; state: string } | null {
  let value = raw.trim();
  if (!value) return null;
  if (!value.includes("://")) value = `https://${value.replace(/^\/+/, "")}`;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (!["maxpreps.com", "www.maxpreps.com"].includes(parsed.hostname.toLowerCase())) {
    return null;
  }
  const segs = parsed.pathname.split("/").filter(Boolean).map((s) => s.toLowerCase());
  if (segs.length < 3 || !/^[a-z]{2}$/.test(segs[0])) return null;
  const [state, city, school] = segs;
  if (city === "max" || city === "maxhq4" || school.startsWith("maxpreps-")) return null;
  return { url: `https://www.maxpreps.com/${state}/${city}/${school}/`, state };
}

export function previewCsv(text: string): CsvPreview {
  const all = parseCsv(text.replace(/^﻿/, "")).filter((r) => r.some((v) => v.trim()));
  const header = all[0] ?? [];
  const col = header.findIndex((h) => normHeader(h) === "maxprepslink");
  if (col < 0) return { column: null, rows: Math.max(0, all.length - 1), links: 0, skipped: 0, byState: [] };

  const seen = new Set<string>();
  const states = new Map<string, number>();
  let skipped = 0;
  for (const row of all.slice(1)) {
    const root = schoolRoot(row[col] ?? "");
    if (!root || seen.has(root.url)) {
      skipped++;
      continue;
    }
    seen.add(root.url);
    states.set(root.state, (states.get(root.state) ?? 0) + 1);
  }
  return {
    column: header[col],
    rows: all.length - 1,
    links: seen.size,
    skipped,
    byState: [...states.entries()].sort((a, b) => b[1] - a[1]),
  };
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  if (seconds < 90) return "about a minute";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h === 0) return `about ${m} min`;
  return m ? `about ${h} h ${m} min` : `about ${h} h`;
}

export const sum = (c: StatusCounts | undefined, ...keys: (keyof StatusCounts)[]) =>
  keys.reduce((n, k) => n + (c?.[k] ?? 0), 0);

// --------------------------------------------------------------------------- //
// Preview tables
// --------------------------------------------------------------------------- //
const dash = <span className="text-neutral-400">—</span>;

const link = (href: string | undefined, label: string) =>
  href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
      {label}
    </a>
  ) : (
    dash
  );

const logo = (src: string | undefined) =>
  src ? (
    // Plain <img>: remote MaxPreps assets; next/image would need a remotePatterns entry
    // and buys nothing on a 24px thumbnail.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" loading="lazy" className="h-6 w-6 shrink-0 object-contain" />
  ) : (
    dash
  );

const STATUS_STYLE: Record<string, string> = {
  ok: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
  empty: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
  failed: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  pending: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  no_data: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  skipped: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
};

export const COLUMNS: Record<CsvResultType, Column<Row>[]> = {
  teams: [
    { key: "mascot_url", header: "Logo", render: (r) => logo(r.mascot_url) },
    { key: "name", header: "School" },
    { key: "original_name", header: "Original Name" },
    { key: "city", header: "City" },
    { key: "state", header: "State" },
    {
      key: "discovered_via",
      header: "Source",
      render: (r) => (r.discovered_via === "input" ? "Your list" : "Opponent"),
    },
    { key: "url", header: "MaxPreps", render: (r) => link(r.url, "View") },
    { key: "go_fan_ticket_url", header: "GoFan", render: (r) => link(r.go_fan_ticket_url, "Open") },
    { key: "nfhs_url", header: "NFHS", render: (r) => link(r.nfhs_url, "Open") },
  ],
  schedule: [
    { key: "school_name", header: "School" },
    { key: "sport", header: "Sport" },
    { key: "gender", header: "Gender" },
    { key: "level", header: "Level" },
    { key: "season", header: "Season" },
    { key: "date", header: "Date" },
    { key: "home_away", header: "H/A" },
    {
      key: "original_opponent_school_logo",
      header: "Opp. Logo",
      render: (r) => logo(r.original_opponent_school_logo),
    },
    {
      key: "opponent",
      header: "Opponent",
      render: (r) => r.original_opponent_school_name || r.opponent || "",
    },
    { key: "result", header: "Result" },
    { key: "score", header: "Score" },
  ],
  roster: [
    { key: "school_name", header: "School" },
    { key: "sport", header: "Sport" },
    { key: "gender", header: "Gender" },
    { key: "level", header: "Level" },
    { key: "category", header: "Type" },
    { key: "jersey_number", header: "#" },
    { key: "name", header: "Name" },
    { key: "grade", header: "Grade" },
    { key: "position", header: "Position" },
  ],
  coverage: [
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLE[r.status] ?? "")}>
          {r.status}
        </span>
      ),
    },
    { key: "kind", header: "Page" },
    { key: "detail", header: "Detail" },
    { key: "school_name", header: "School" },
    { key: "sport", header: "Sport" },
    { key: "gender", header: "Gender" },
    { key: "level", header: "Level" },
    {
      key: "url",
      header: "URL",
      // The school path ("ca/stockton/humphreys-able-charter-legacy/basketball/schedule")
      // identifies a page at a glance, even before the school's name is known.
      render: (r) =>
        r.url?.startsWith("http")
          ? link(r.url, r.url.replace(/^https?:\/\/(www\.)?maxpreps\.com\//, "").replace(/\/$/, ""))
          : r.url || "",
    },
  ],
};
