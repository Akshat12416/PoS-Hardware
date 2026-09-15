import { createRequire } from "module";
const require = createRequire(import.meta.url);

import thermal from "node-thermal-printer";

const ThermalPrinter = thermal.ThermalPrinter;
const PrinterTypes = thermal.PrinterTypes;

// Native Windows spooler driver
const windowsPrinterDriver = require("printer");

export async function printReceipt(data) {
  try {
    const printer = new ThermalPrinter({
      type: PrinterTypes.EPSON,

      // ? REQUIRED: real Windows driver object
      driver: windowsPrinterDriver,

      // ? EXACT name from wmic output
      interface: "printer:EPSON TM-T88V Receipt",

      options: {
        timeout: 5000
      }
    });

    const isConnected = await printer.isPrinterConnected();

    if (!isConnected) {
      throw new Error("Printer not connected or not found in Windows");
    }

    // -------- PRINT CONTENT --------

    printer.alignCenter();
    printer.bold(true);
    printer.println(data.title || "POS RECEIPT");
    printer.bold(false);
    printer.drawLine();

    printer.alignLeft();

    if (data.items && Array.isArray(data.items)) {
      data.items.forEach(item => {
        printer.println(`${item.name}   x${item.qty}   ${item.price}`);
      });
    }

    printer.drawLine();

    printer.alignRight();
    printer.println(`TOTAL: ${data.total || "0.00"}`);

    printer.newLine();
    printer.newLine();
    printer.cut();

    await printer.execute();

    return { success: true };

  } catch (error) {
    console.error("Printer error:", error);
    throw error;
  }
}

