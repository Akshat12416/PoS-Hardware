/**
 * Promotes integration credentials from request body into headers.
 * Secrets are NEVER accepted via query string (logged in proxies/history).
 */
export function integrationHeaders(req, res, next) {
  const fromBody = (key, alt) => req.body?.[key] ?? req.body?.[alt];
  const fromQueryNonSecret = (key, alt) => req.query?.[key] ?? req.query?.[alt];

  if (!req.headers["x-store-id"]) {
    const v = fromBody("store_id", "x_store_id") ?? fromQueryNonSecret("store_id", "x_store_id");
    if (v) req.headers["x-store-id"] = String(v).trim();
  }
  if (!req.headers["x-terminal-id"]) {
    const v = fromBody("terminal_id", "x_terminal_id");
    if (v) req.headers["x-terminal-id"] = String(v).trim();
  }
  if (!req.headers["x-agent-secret"]) {
    const v = fromBody("agent_secret", "x_agent_secret");0
    if (v) req.headers["x-agent-secret"] = String(v).trim();
  }

  next();
}
