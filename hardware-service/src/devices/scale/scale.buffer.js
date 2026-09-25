/**
 * Split serial scale bytes into complete lines.
 * Magellan ends each reply with CR only; other scales use LF or CRLF.
 */
export function appendScaleChunk(buffer, chunk) {
  const next = `${buffer || ""}${chunk || ""}`;
  const parts = next.split(/\r\n|\r|\n/);
  const rest = parts.pop() ?? "";
  const lines = parts.map((line) => line.trim()).filter(Boolean);
  return { lines, rest };
}
