import { exhibitorsTable, gamesTable, reportsTable, reviewsTable, usersTable } from "./database.js";
import { geminiApiKey } from "./secrets.js";
import { vectorIndex } from "./vectors.js";

export const frontend = new sst.aws.Nextjs("www", {
  path: "apps/www",
  link: [
    gamesTable,
    exhibitorsTable,
    reportsTable,
    usersTable,
    reviewsTable,
    geminiApiKey,
    vectorIndex,
  ],
  domain: {
    name: "pax-pal-2026.trevbook.com",
    cert: "arn:aws:acm:us-east-1:918687634324:certificate/6c2eab07-8c57-41f9-bb5f-d91b8faf118f",
    dns: false,
  },
});
