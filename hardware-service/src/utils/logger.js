function formatMsg(msg) {
  if (typeof msg === "string") return msg;
  try {
    return JSON.stringify(msg);
  } catch {
    return String(msg);
  }
}

export default {
  info: (msg, meta) => {
    const out = meta ? `${formatMsg(msg)} ${formatMsg(meta)}` : formatMsg(msg);
    console.log(`[INFO] ${out}`);
  },
  error: (msg, meta) => {
    const out = meta ? `${formatMsg(msg)} ${formatMsg(meta)}` : formatMsg(msg);
    console.error(`[ERROR] ${out}`);
  },
  warn: (msg, meta) => {
    const out = meta ? `${formatMsg(msg)} ${formatMsg(meta)}` : formatMsg(msg);
    console.warn(`[WARN] ${out}`);
  }
};
