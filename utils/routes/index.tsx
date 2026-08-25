export type ScrapeResultType = "teams" | "schedule" | "roster";

// Middle-school (GoFan) job outputs. "schools" is the uploaded CSV with the gofan_*
// columns appended; "schedule" is one row per upcoming GoFan event.
export type MsResultType = "schools" | "schedule";

export const routes = {
  ui: {
    indexRoute: "/",
    middleSchools: "/middle-schools",
    userDetails: (id: string | number) => `users/${id}`,
  },

  api: {
    getArea: "areas",
    editArea: (id: string | number) => `areas/${id}`,

    // MaxPreps scraper service (Render). Base URL is config.apiUrl (must end with "/").
    startScrape: "scrape",
    scrapeStatus: (id: string) => `scrape/${id}`,
    scrapeResults: (id: string, type: ScrapeResultType) =>
      `scrape/${id}/results?type=${type}`,
    scrapeDownload: (id: string, type: ScrapeResultType) =>
      `scrape/${id}/download?type=${type}`,
    deleteScrape: (id: string) => `scrape/${id}`,
    listStates: "states",
    listSports: "sports",

    // GoFan middle-school service, mounted at /ms on the same backend. Separate job
    // registry from the MaxPreps endpoints above -- see middle_school_api.py.
    startMsGofan: "ms/gofan",
    msGofanStatus: (id: string) => `ms/gofan/${id}`,
    msGofanResults: (id: string, type: MsResultType) =>
      `ms/gofan/${id}/results?type=${type}`,
    msGofanDownload: (id: string, type: MsResultType) =>
      `ms/gofan/${id}/download?type=${type}`,
    deleteMsGofan: (id: string) => `ms/gofan/${id}`,
  },
};
