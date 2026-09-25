/**
 * Turn a stream of keystrokes into a barcode.
 * A scanner types the whole code in a fast burst and ends with Enter.
 * Slow typing is ignored so the Cherry keyboard is not captured.
 */
export function createWedgeState() {
  return { buffer: "", lastAt: 0 };
}

export function pushWedgeKey(state, key, now, gapMs = 100) {
  const current = state || createWedgeState();
  const token = String(key || "");

  if (token === "ENTER" || token === "TAB") {
    const value = current.buffer.trim();
    const burst =
      current.lastAt > 0 &&
      now - current.lastAt <= gapMs &&
      value.length >= 4;
    return {
      state: createWedgeState(),
      value: burst ? value : null
    };
  }

  if (token.length !== 1) {
    return { state: current, value: null };
  }

  const startNew = !current.lastAt || now - current.lastAt > gapMs;
  return {
    state: {
      buffer: startNew ? token : current.buffer + token,
      lastAt: now
    },
    value: null
  };
}
