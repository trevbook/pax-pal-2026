import { readFile } from "node:fs/promises";
import { join } from "node:path";

const HTML_DIR = join(import.meta.dirname, "../../../../miscellaneous/html");

const LOCAL_FILES = {
  exhibitors: "sample-expo-hall-exhibitors.html",
  demos: "sample-demos.html",
  tabletop: "sample-tabletop-exhibitors.html",
} as const;

const LIVE_URLS = {
  exhibitors: "https://east.paxsite.com/en-us/expo-hall.html",
  demos: "https://east.paxsite.com/en-us/expo-hall/expo-hall-demos.html",
  tabletop: "https://east.paxsite.com/en-us/expo-hall/tabletop-expo-hall.html",
} as const;

export type PageName = keyof typeof LOCAL_FILES;

export async function fetchHtml(
  page: PageName,
  source: "local" | "live" = "local",
): Promise<string> {
  if (source === "local") {
    const filePath = join(HTML_DIR, LOCAL_FILES[page]);
    return readFile(filePath, "utf-8");
  }
  const url = LIVE_URLS[page];
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.text();
}
