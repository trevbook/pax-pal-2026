import { exhibitorsTable, gamesTable, reportsTable, reviewsTable, usersTable } from "./database.js";
import { rumAppMonitor, rumIdentityPool } from "./rum.js";
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
  environment: {
    NEXT_PUBLIC_RUM_APP_MONITOR_ID: rumAppMonitor.appMonitorId,
    NEXT_PUBLIC_RUM_IDENTITY_POOL_ID: rumIdentityPool.id,
    NEXT_PUBLIC_RUM_REGION: "us-east-1",
  },
});
