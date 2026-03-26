import { AwsRum, type AwsRumConfig } from "aws-rum-web";

let rumClient: AwsRum | null = null;

const appMonitorId = process.env.NEXT_PUBLIC_RUM_APP_MONITOR_ID;
const identityPoolId = process.env.NEXT_PUBLIC_RUM_IDENTITY_POOL_ID;
const region = process.env.NEXT_PUBLIC_RUM_REGION || "us-east-1";

const isLocalhost =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

if (typeof window !== "undefined" && !isLocalhost && appMonitorId && identityPoolId) {
  try {
    const config: AwsRumConfig = {
      sessionSampleRate: 1.0,
      identityPoolId,
      endpoint: `https://dataplane.rum.${region}.amazonaws.com`,
      telemetries: ["errors", "performance", "http"],
      allowCookies: false,
      enableXRay: false,
      signing: true,
    };

    rumClient = new AwsRum(appMonitorId, "1.0.0", region, config);
  } catch {
    // RUM initialization failure should never break the app
  }
}

export function onRouterTransitionStart(
  url: string,
  navigationType: "push" | "replace" | "traverse",
) {
  if (!rumClient) return;

  try {
    rumClient.recordPageView(url);
    rumClient.recordEvent("navigation", {
      url,
      type: navigationType,
      timestamp: Date.now(),
    });
  } catch {
    // RUM tracking failure should never break the app
  }
}

export function getRumClient(): AwsRum | null {
  return rumClient;
}
