import cliProgress from "cli-progress";

// ---------------------------------------------------------------------------
// Single URL check
// ---------------------------------------------------------------------------

/**
 * Check if a URL is reachable via HEAD request.
 * Returns true if the server responds with 2xx/3xx.
 */
export async function checkUrl(url: string, timeout = 5000): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(timeout),
    });
    return res.ok;
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
}

export interface ValidateResult {
  valid: string[];
  invalid: string[];
}

/**
 * Validate a list of URLs via HEAD requests.
 * Deduplicates input, runs with bounded concurrency.
 */
export async function validateUrls(
  urls: string[],
  options: ValidateOptions = {},
): Promise<ValidateResult> {
  const { concurrency = 25, timeout = 5000 } = options;

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
      const ok = await checkUrl(url, timeout);
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
