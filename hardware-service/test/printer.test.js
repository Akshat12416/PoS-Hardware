import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePrinterNames } from "../src/devices/printer/printer.windows.js";

test("parsePrinterNames skips the Name header and blanks", () => {
  const names = parsePrinterNames(`Name\r\nEPSON TM-T88V Receipt\r\n\r\nMicrosoft Print to PDF\r\n`);
  assert.deepEqual(names, ["EPSON TM-T88V Receipt", "Microsoft Print to PDF"]);
});
