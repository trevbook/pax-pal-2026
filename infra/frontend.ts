import { exhibitorsTable, gamesTable, reportsTable } from "./database.js";
import { geminiApiKey } from "./secrets.js";
import { vectorIndex } from "./vectors.js";

export const frontend = new sst.aws.Nextjs("www", {
  path: "apps/www",
  link: [gamesTable, exhibitorsTable, reportsTable, geminiApiKey, vectorIndex],
});
