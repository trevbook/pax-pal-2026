import { secrets } from "./secrets.js";

export const frontend = new sst.aws.Nextjs("www", {
  path: "apps/www",
  environment: secrets,
});
