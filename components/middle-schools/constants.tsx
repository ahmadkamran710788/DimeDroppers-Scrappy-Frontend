import type { Column } from "@/components/common/GenericTable";

// Rows come back from the API as raw CSV records, so every value is a string.
export type SchoolRow = Record<string, string>;
export type ScheduleRow = Record<string, string>;

// The status endpoint is polled on this interval, matching the MaxPreps page.
export const POLL_INTERVAL_MS = 4000;

// The backend caps /results at 500 rows; the full file comes from /download.
export const PREVIEW_ROWS = 500;

const link = (href: string, label: string) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="text-blue-600 hover:underline"
  >
    {label}
  </a>
);

// Only the columns worth eyeballing. The uploaded CSV has ~120 more, all preserved
// in the download -- showing them here would make the table unreadable.
export const SCHOOL_COLUMNS: Column<SchoolRow>[] = [
  {
    key: "logo_url",
    header: "Logo",
    // Blank for roughly a quarter of matches: GoFan serves its own wordmark for
    // schools that never uploaded one, and the backend blanks those rather than
    // passing off GoFan branding as the school's logo.
    render: (r) =>
      r.logo_url ? (
        // Plain <img>: these are remote S3 assets, so next/image would need a
        // remotePatterns entry for the host and buy nothing on a 24px thumbnail.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={r.logo_url}
          alt=""
          loading="lazy"
          className="h-6 w-6 shrink-0 object-contain"
        />
      ) : (
        <span className="text-neutral-400">—</span>
      ),
  },
  { key: "SCH_NAME", header: "School (uploaded)" },
  { key: "MCITY", header: "City" },
  { key: "MSTATE", header: "State" },
  { key: "gofan_name", header: "GoFan Name" },
  { key: "gofan_city", header: "GoFan City" },
  { key: "gofan_school_type", header: "Type" },
  { key: "gofan_match", header: "Match" },
  { key: "gofan_match_score", header: "Score" },
  {
    key: "gofan_url",
    header: "GoFan Link",
    render: (r) => (r.gofan_url ? link(r.gofan_url, "Open") : <span className="text-neutral-400">—</span>),
  },
];

export const SCHEDULE_COLUMNS: Column<ScheduleRow>[] = [
  { key: "sch_name", header: "School" },
  { key: "sport", header: "Sport" },
  { key: "gender", header: "Gender" },
  { key: "level", header: "Level" },
  { key: "date", header: "Date" },
  { key: "time", header: "Time" },
  { key: "home_away", header: "H/A" },
  { key: "opponent", header: "Opponent" },
  { key: "venue_name", header: "Venue" },
  { key: "venue_city", header: "Venue City" },
  {
    key: "event_url",
    header: "Tickets",
    render: (r) => (r.event_url ? link(r.event_url, "Buy") : <span className="text-neutral-400">—</span>),
  },
];
