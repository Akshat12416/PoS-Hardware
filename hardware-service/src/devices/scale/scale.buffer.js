/**
 * Split serial scale bytes into complete lines.
 */
export function appendScaleChunk(buffer, chunk) {
  const next = `${buffer || ""}${chunk || ""}`;
  const parts = next.split(/\r?\n/);
  const rest = parts.pop() ?? "";
  const lines = parts.map((line) => line.trim()).filter(Boolean);
  return { lines, rest };
}
