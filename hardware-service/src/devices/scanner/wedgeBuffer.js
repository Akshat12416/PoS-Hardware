/**
 * Turn a stream of keystrokes into a barcode.
 * A scanner types the whole code in a fast burst. Some scanners end with
 * Enter; others send no terminator, so a pause after a burst also ends it.
 * Slow typing is ignored so the Cherry keyboard is not captured.
 */
export const WEDGE_GAP_MS = 100;
export const WEDGE_IDLE_MS = 150;
export const WEDGE_MIN_LENGTH = 6;

export function createWedgeState() {
  return { buffer: "", lastAt: 0 };
}

export function pushWedgeKey(state, key, now, gapMs = WEDGE_GAP_MS) {
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

export function flushIdleWedge(state, now, idleMs = WEDGE_IDLE_MS, minLength = WEDGE_MIN_LENGTH) {
  const current = state || createWedgeState();
  const value = current.buffer.trim();
  if (!current.lastAt || now - current.lastAt < idleMs || value.length < minLength) {
    return { state: current, value: null };
  }
  return { state: createWedgeState(), value };
}
