/**
 * Accumulate scanner bytes/chars until CR/LF.
 * Returns every complete barcode; leftover partial data stays in rest.
 */
export function appendScanChunk(buffer, chunk) {
  let next = `${buffer || ""}${chunk || ""}`;
  const values = [];

  while (true) {
    const idx = next.search(/[\r\n]/);
    if (idx === -1) break;
    const value = next.slice(0, idx).trim();
    next = next.slice(idx + 1);
    if (next.startsWith("\n")) next = next.slice(1);
    if (value) values.push(value);
  }

  return {
    values,
    value: values.length ? values[values.length - 1] : null,
    rest: next
  };
}
