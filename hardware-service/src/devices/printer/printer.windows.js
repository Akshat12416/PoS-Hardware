import { exec } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { promisify } from "util";

import { config } from "../../config.js";
import { renderReceiptText } from "../../utils/receiptRenderer.js";
import logger from "../../utils/logger.js";
import { isDemoMode } from "../../utils/demoMode.js";

const execAsync = promisify(exec);

let lastPrint = {
  at: null,
  success: null,
  printer_name: null,
  error: null
};

function escapePsSingleQuotes(value) {
  return String(value ?? "").replace(/'/g, "''");
}

function parsePrinterNames(stdout) {
  return String(stdout || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^name$/i.test(line));
}

export function getPrinterHealth() {
  return {
    demo: isDemoMode(),
    configured: Boolean(String(config.printer_name || "").trim()),
    printer_name: config.printer_name || null,
    last_print_at: lastPrint.at,
    last_print_success: lastPrint.success,
    last_printer_used: lastPrint.printer_name,
    last_error: lastPrint.error
  };
}

export async function listPrinters() {
  if (isDemoMode()) {
    const name = config.printer_name || "DEMO Receipt Printer";
    return [name, "DEMO Receipt Printer"];
  }

  if (process.platform !== "win32") {
    return [];
  }

  try {
    const { stdout } = await execAsync(
      "powershell -NoProfile -Command \"Get-Printer | Select-Object -ExpandProperty Name\"",
      { timeout: 15000, windowsHide: true }
    );
    const printers = parsePrinterNames(stdout);
    if (printers.length) return printers;
  } catch (err) {
    logger.warn("[PRINTER] Get-Printer failed, falling back to wmic", {
      error: err.message
    });
  }

  const { stdout } = await execAsync("wmic printer get name", {
    timeout: 15000,
    windowsHide: true
  });
  return parsePrinterNames(stdout);
}

function resolvePrinterName(requested) {
  return String(
    requested || config.printer_name || ""
  ).trim();
}

export async function printReceipt(data = {}) {
  const printerName = resolvePrinterName(data.printer_name);
  if (!printerName) {
    lastPrint = {
      at: new Date().toISOString(),
      success: false,
      printer_name: null,
      error: "printer_name is not configured"
    };
    throw new Error("printer_name is not configured");
  }

  if (process.platform !== "win32") {
    lastPrint = {
      at: new Date().toISOString(),
      success: false,
      printer_name: printerName,
      error: "Windows spooler printing is only supported on win32"
    };
    throw new Error("Windows spooler printing is only supported on win32");
  }

  const receiptText = renderReceiptText({
    ...data,
    company_name:
      data?.company_name ||
      config.receipt_company_name ||
      "Southwest Farmers"
  });

  const tempFile = path.join(os.tmpdir(), `receipt_${Date.now()}.txt`);
  fs.writeFileSync(tempFile, receiptText, "utf8");

  const command = `powershell -NoProfile -Command "Get-Content -Raw '${escapePsSingleQuotes(
    tempFile
  )}' | Out-Printer -Name '${escapePsSingleQuotes(printerName)}'"`;

  try {
    await execAsync(command, { timeout: 30000, windowsHide: true });
    lastPrint = {
      at: new Date().toISOString(),
      success: true,
      printer_name: printerName,
      error: null
    };
    return { success: true, printer_name: printerName };
  } catch (err) {
    const message = err?.stderr || err?.message || String(err);
    lastPrint = {
      at: new Date().toISOString(),
      success: false,
      printer_name: printerName,
      error: message
    };
    throw new Error(message);
  } finally {
    try {
      fs.unlinkSync(tempFile);
    } catch {
      // ignore
    }
  }
}

/**
 * Send raw ESC/POS bytes through the Windows printer share (drawer kick).
 */
export async function sendRawToPrinter(printerName, bytes) {
  const name = resolvePrinterName(printerName);
  if (!name) {
    throw new Error("printer_name is not configured");
  }
  if (process.platform !== "win32") {
    throw new Error("Raw printer I/O is only supported on Windows");
  }

  const tempFile = path.join(os.tmpdir(), `rawprint_${Date.now()}.bin`);
  fs.writeFileSync(tempFile, Buffer.from(bytes));
  const share = `\\\\localhost\\${name}`;

  try {
    await execAsync(`cmd /c copy /b "${tempFile}" "${share}"`, {
      timeout: 15000,
      windowsHide: true
    });
    return { success: true, printer_name: name };
  } catch (err) {
    throw new Error(
      `Raw print to ${name} failed: ${err.message}. Confirm the printer is shared or use cash_drawer_mode=serial.`
    );
  } finally {
    try {
      fs.unlinkSync(tempFile);
    } catch {
      // ignore
    }
  }
}
