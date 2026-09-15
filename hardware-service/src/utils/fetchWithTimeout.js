/**
 * AbortController timeout wrapper around global fetch.
 * node-fetch v3 ignores a `timeout` option.
 * @param {string} url
 * @param {RequestInit & { timeoutMs?: number }} options
 */
export async function fetchWithTimeout(url, options = {}) {
  const { timeoutMs = 8000, signal: outerSignal, ...rest } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  if (outerSignal) {
    if (outerSignal.aborted) {
      controller.abort();
    } else {
      outerSignal.addEventListener("abort", () => controller.abort(), {
        once: true
      });
    }
  }

  try {
    return await fetch(url, { ...rest, signal: controller.signal });
  } catch (err) {
    if (err?.name === "AbortError") {
      const e = new Error(`Request timed out after ${timeoutMs}ms`);
      e.code = "FETCH_TIMEOUT";
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
