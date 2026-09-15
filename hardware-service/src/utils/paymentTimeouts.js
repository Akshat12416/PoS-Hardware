const LONG_PAYMENT_PATHS = ["/initiate", "/cancel", "/void", "/refund"];

/**
 * Cloud → agent payment forwarding timeout.
 * Card-present sales wait on the Ingenico prompt; status stays short.
 */
export function paymentForwardTimeoutMs(pathSuffix, paxTimeoutMs = 120000) {
  const path = String(pathSuffix || "");
  const isLong = LONG_PAYMENT_PATHS.some(
    (p) => path === p || path.endsWith(p)
  );
  if (isLong) {
    return Math.max(120000, Number(paxTimeoutMs) || 120000);
  }
  return 8000;
}

export function bridgeCallTimeoutMs(path, paxTimeoutMs = 120000) {
  return paymentForwardTimeoutMs(path, paxTimeoutMs);
}
