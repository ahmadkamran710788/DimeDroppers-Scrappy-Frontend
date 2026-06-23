export type ScrapeResultType = "teams" | "schedule";

export const routes = {
  ui: {
    indexRoute: "/",
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
  },
};
