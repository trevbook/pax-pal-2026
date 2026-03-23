/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "pax-pal-2026",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "aws",
      providers: {
        aws: {
          ...(!process.env.CI && { profile: "personal" }),
        },
      },
    };
  },
  async run() {
    await import("./infra/secrets");
    await import("./infra/database");
    await import("./infra/vectors");
    await import("./infra/frontend");
  },
});
