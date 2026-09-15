import crypto from "crypto";

/** Constant-time string compare; returns false on length mismatch. */
export function safeEqual(a, b) {
  if (a == null || b == null) return false;
  const sa = String(a);
  const sb = String(b);
  const ba = Buffer.from(sa, "utf8");
  const bb = Buffer.from(sb, "utf8");
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}
