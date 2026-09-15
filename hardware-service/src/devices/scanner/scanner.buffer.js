/**
 * Accumulate scanner bytes/chars until CR/LF (serial) or idle flush.
 */
export function appendScanChunk(buffer, chunk) {
  const next = `${buffer || ""}${chunk || ""}`;
  if (next.includes("\n") || next.includes("\r")) {
    const value = next.replace(/[\r\n]+/g, "").trim();
    return { value: value || null, rest: "" };
  }
  return { value: null, rest: next };
}
