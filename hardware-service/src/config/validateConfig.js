const SCANNER_MODES = [
  "auto",
  "serial",
  "usb_hid",
  "keyboard_wedge",
  "disabled"
];
const DRAWER_MODES = ["unconfigured", "serial", "printer"];
const TERMINAL_TYPES = ["ingenico", "pax"];

function nonempty(value) {
  return Boolean(value && String(value).trim());
}

/**
 * Pure config checks for the hardware agent. Does not read disk or env.
 * @param {Record<string, unknown>} cfg
 */
export function validateConfig(cfg = {}) {
  const warnings = [];
  const errors = [];

  const scannerMode = String(cfg.scanner_mode || "auto").toLowerCase();
  if (!SCANNER_MODES.includes(scannerMode)) {
    errors.push(
      `scanner_mode must be one of: ${SCANNER_MODES.join(", ")}`
    );
  }

  const drawerMode = String(cfg.cash_drawer_mode || "unconfigured").toLowerCase();
  if (!DRAWER_MODES.includes(drawerMode)) {
    errors.push(
      `cash_drawer_mode must be one of: ${DRAWER_MODES.join(", ")}`
    );
  }

  const terminalType = String(cfg.payment_terminal_type || "ingenico").toLowerCase();
  if (!TERMINAL_TYPES.includes(terminalType)) {
    warnings.push(
      `payment_terminal_type "${terminalType}" is unexpected; supported: ingenico (live), pax (legacy)`
    );
  }

  if (scannerMode === "serial" && !nonempty(cfg.scanner_serial_path)) {
    errors.push("scanner_mode=serial requires scanner_serial_path");
  }

  if (
    scannerMode === "usb_hid" &&
    !cfg.scanner_hid_vendor_id &&
    !cfg.scanner_hid_product_id
  ) {
    warnings.push(
      "scanner_mode=usb_hid without VID/PID will only open devices named Zebra/Symbol/Honeywell/Datalogic/scanner"
    );
  }

  if (drawerMode === "serial" && !nonempty(cfg.cash_drawer_serial_path)) {
    errors.push("cash_drawer_mode=serial requires cash_drawer_serial_path");
  }

  if (drawerMode === "printer" && !nonempty(cfg.printer_name)) {
    errors.push("cash_drawer_mode=printer requires printer_name");
  }

  if (drawerMode === "unconfigured") {
    warnings.push(
      "cash_drawer_mode is unconfigured — run docs/CASH_DRAWER_DISCOVERY.md before testing the till"
    );
  }

  if (!nonempty(cfg.printer_name)) {
    warnings.push(
      "printer_name is empty; print jobs will fail until a Windows printer name is set"
    );
  }

  if (!nonempty(cfg.scale_serial_path)) {
    warnings.push("scale_serial_path is empty; scale will stay disconnected");
  }

  if (cfg.pax_enabled && !nonempty(cfg.pax_bridge_url)) {
    errors.push("pax_enabled=true requires pax_bridge_url");
  }

  if (!cfg.approved || !nonempty(cfg.store_id)) {
    warnings.push(
      "terminal is not approved locally — hardware APIs return 423 until approved=true and store_id are set"
    );
  }

  return { warnings, errors, scannerMode, drawerMode };
}

export { SCANNER_MODES, DRAWER_MODES, TERMINAL_TYPES };
