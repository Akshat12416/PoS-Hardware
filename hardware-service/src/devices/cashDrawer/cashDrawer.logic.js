export function resolveDrawerMode(cfg = {}) {
  return String(cfg.cash_drawer_mode || "unconfigured").toLowerCase();
}

export function isDrawerConfigured(cfg = {}) {
  const mode = resolveDrawerMode(cfg);
  if (mode === "serial") {
    return Boolean(String(cfg.cash_drawer_serial_path || "").trim());
  }
  if (mode === "printer") {
    return Boolean(String(cfg.printer_name || "").trim());
  }
  if (mode === "demo") return true;
  return false;
}

export function drawerDiscoveryHint(cfg = {}) {
  if (resolveDrawerMode(cfg) !== "unconfigured") return null;
  return "See docs/CASH_DRAWER_DISCOVERY.md before enabling serial or printer kick";
}
