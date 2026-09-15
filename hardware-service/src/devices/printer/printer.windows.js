import { exec } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

import { config } from "../../config.js";
import { renderReceiptText } from "../../utils/receiptRenderer.js";

const PRINTER_NAME = "EPSON TM-T88V Receipt"; // must EXACTLY match wmic output

export async function listPrinters() {
  return new Promise((resolve, reject) => {
    exec("wmic printer get name", (err, stdout) => {
      if (err) return reject(err);

      const printers = stdout
        .split("\n")
        .slice(1)
        .map(p => p.trim())
        .filter(Boolean);

      resolve(printers);
    });
  });
}

export async function printReceipt(data) {
  return new Promise((resolve, reject) => {
    try {
      // Backward compatible: use provided company_name else config else default
      const receiptText = renderReceiptText({
        ...data,
        company_name:
          data?.company_name ||
          config.receipt_company_name ||
          "Southwest Farmers"
      });

      const tempFile = path.join(os.tmpdir(), `receipt_${Date.now()}.txt`);
      fs.writeFileSync(tempFile, receiptText, "utf8");

      // ?? Direct spooler print (correct way)
      const command = `powershell -Command "Get-Content '${tempFile}' | Out-Printer -Name '${PRINTER_NAME}'"`;

      exec(command, (err) => {
        fs.unlinkSync(tempFile);

        if (err) {
          reject(err.toString());
        } else {
          resolve({ success: true });
        }
      });

    } catch (e) {
      reject(e.toString());
    }
  });
}
