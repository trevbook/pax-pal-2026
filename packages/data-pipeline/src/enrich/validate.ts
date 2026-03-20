import cliProgress from "cli-progress";

// ---------------------------------------------------------------------------
// Single URL check
// ---------------------------------------------------------------------------

export interface CheckUrlOptions {
  timeout?: number;
  /** If set, verify the response Content-Type starts with this prefix (e.g. "image"). */
  expectedContentType?: string;
}

/**
 * Check if a URL is reachable via HEAD request.
 * Returns true if the server responds with 2xx/3xx.
 * Optionally checks that the Content-Type matches an expected prefix.
 */
export async function checkUrl(
  url: string,
  optionsOrTimeout: number | CheckUrlOptions = 5000,
): Promise<boolean> {
  const opts =
    typeof optionsOrTimeout === "number" ? { timeout: optionsOrTimeout } : optionsOrTimeout;
  const { timeout = 5000, expectedContentType } = opts;

  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) return false;

    if (expectedContentType) {
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.startsWith(`${expectedContentType}/`)) return false;
    }

    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Batch validator
// ---------------------------------------------------------------------------

export interface ValidateOptions {
  concurrency?: number;
  timeout?: number;
  /** URLs that should be checked for Content-Type (e.g. image URLs). */
  imageUrls?: Set<string>;
}

export interface ValidateResult {
  valid: string[];
  invalid: string[];
}

/**
 * Validate a list of URLs via HEAD requests.
 * Deduplicates input, runs with bounded concurrency.
 * URLs in the `imageUrls` set are additionally checked for `image/` Content-Type.
 */
export async function validateUrls(
  urls: string[],
  options: ValidateOptions = {},
): Promise<ValidateResult> {
  const { concurrency = 25, timeout = 5000, imageUrls } = options;

  // Deduplicate
  const unique = [...new Set(urls)];

  if (unique.length === 0) {
    return { valid: [], invalid: [] };
  }

  console.log(`[validate] Checking ${unique.length} URLs...`);

  const bar = new cliProgress.SingleBar(
    {
      format: "[validate] {bar} {percentage}% | {value}/{total} URLs | ETA: {eta_formatted}",
      hideCursor: true,
    },
    cliProgress.Presets.shades_classic,
  );
  bar.start(unique.length, 0);

  const valid: string[] = [];
  const invalid: string[] = [];

  let nextIndex = 0;

  async function processNext(): Promise<void> {
    while (nextIndex < unique.length) {
      const i = nextIndex++;
      const url = unique[i];
      const checkOpts: CheckUrlOptions = { timeout };
      if (imageUrls?.has(url)) {
        checkOpts.expectedContentType = "image";
      }
      const ok = await checkUrl(url, checkOpts);
      if (ok) {
        valid.push(url);
      } else {
        invalid.push(url);
      }
      bar.increment();
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, unique.length) }, () => processNext());
  await Promise.all(workers);
  bar.stop();

  return { valid, invalid };
}
