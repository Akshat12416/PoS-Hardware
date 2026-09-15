// src/utils/receiptRenderer.js

/**
 * Render a thermal receipt-like text layout (monospace).
 * Designed for simple spooler printing (Windows Out-Printer).
 */

const DEFAULT_WIDTH = 32;

function padCenter(text, width) {
  const raw = String(text ?? "");
  if (raw.length >= width) return raw.slice(0, width);
  const left = Math.floor((width - raw.length) / 2);
  const right = width - raw.length - left;
  return " ".repeat(left) + raw + " ".repeat(right);
}

function padRight(text, width) {
  const raw = String(text ?? "");
  if (raw.length >= width) return raw.slice(0, width);
  return raw + " ".repeat(width - raw.length);
}

function padLeft(text, width) {
  const raw = String(text ?? "");
  if (raw.length >= width) return raw.slice(0, width);
  return " ".repeat(width - raw.length) + raw;
}

function hr(width) {
  return "-".repeat(width);
}

function wrapText(text, width) {
  const raw = String(text ?? "");
  if (!raw) return [""];
  const words = raw.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (candidate.length <= width) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    // if a single word is longer than width, hard-slice it
    if (w.length > width) {
      lines.push(w.slice(0, width));
      line = w.slice(width);
    } else {
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [raw.slice(0, width)];
}

function formatMoney(amount, currency = "USD") {
  const n = typeof amount === "number" ? amount : Number(amount);
  if (Number.isNaN(n)) return String(amount ?? "");
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency
    }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

function formatDateTime(isoOrDate) {
  const d =
    isoOrDate instanceof Date
      ? isoOrDate
      : isoOrDate
        ? new Date(isoOrDate)
        : new Date();

  if (Number.isNaN(d.getTime())) return new Date().toLocaleString();
  return d.toLocaleString();
}

/**
 * Render receipt text.
 *
 * @param {Object} data
 * @param {number} [data.width] - receipt width in characters (default 32)
 * @param {string} [data.company_name]
 * @param {string[]} [data.address_lines]
 * @param {string} [data.phone]
 * @param {string|Date} [data.datetime]
 * @param {Array<{name:string, qty:number, price:number}>} data.items
 * @param {number} [data.subtotal]
 * @param {number} [data.tax]
 * @param {number} data.total
 * @param {Object} [data.payment]
 * @returns {string}
 */
export function renderReceiptText(data) {
  const width = Number(data?.width) > 0 ? Number(data.width) : DEFAULT_WIDTH;
  const currency = data?.currency || "USD";

  const companyName = data?.company_name || "Southwest Farmers";
  const addressLines = Array.isArray(data?.address_lines) ? data.address_lines : [];
  const phone = data?.phone ? String(data.phone) : null;
  const datetime = formatDateTime(data?.datetime);

  const items = Array.isArray(data?.items) ? data.items : [];

  const computedSubtotal =
    typeof data?.subtotal === "number"
      ? data.subtotal
      : items.reduce((sum, it) => {
        const qty = typeof it?.qty === "number" ? it.qty : Number(it?.qty);
        const price =
          typeof it?.price === "number" ? it.price : Number(it?.price);
        if (Number.isNaN(qty) || Number.isNaN(price)) return sum;
        return sum + qty * price;
      }, 0);

  const tax =
    typeof data?.tax === "number" ? data.tax : typeof data?.tax === "string" ? Number(data.tax) : null;

  const total = typeof data?.total === "number" ? data.total : Number(data?.total);

  const lines = [];

  // Header (centered)
  lines.push(padCenter(companyName.toUpperCase(), width));
  for (const addr of addressLines) {
    for (const l of wrapText(addr, width)) lines.push(padCenter(l, width));
  }
  if (phone) lines.push(padCenter(phone, width));

  lines.push(hr(width));
  lines.push(padRight(`Date: ${datetime}`, width).slice(0, width));
  lines.push(hr(width));

  // Items: "qty name" left, price right
  // Reserve last 10 chars for price (fits "$1234.56")
  const priceCol = 10;
  const leftCol = Math.max(10, width - priceCol);

  for (const item of items) {
    const qty = item?.qty ?? 1;
    const name = String(item?.name ?? "");
    const unitPrice = item?.price ?? 0;
    const linePrice = formatMoney(unitPrice, currency);

    const leftText = `${qty} ${name}`.trim();
    const wrapped = wrapText(leftText, leftCol);

    // First line includes price; continuation lines don't
    lines.push(padRight(wrapped[0] ?? "", leftCol) + padLeft(linePrice, priceCol));
    for (const cont of wrapped.slice(1)) {
      lines.push(padRight(cont, leftCol) + " ".repeat(priceCol));
    }
  }

  lines.push(hr(width));

  // Totals block (right-aligned values)
  const labelCol = Math.max(10, width - priceCol);
  lines.push(
    padRight("Subtotal", labelCol) + padLeft(formatMoney(computedSubtotal, currency), priceCol)
  );
  if (typeof tax === "number" && !Number.isNaN(tax)) {
    lines.push(
      padRight("Tax", labelCol) + padLeft(formatMoney(tax, currency), priceCol)
    );
  }
  lines.push(
    padRight("Total", labelCol) + padLeft(formatMoney(total, currency), priceCol)
  );

  // Payment block (optional)
  const p = data?.payment || null;
  if (p) {
    lines.push(hr(width));
    if (p.card_number_masked) {
      lines.push(
        padRight("CARD NUMBER", labelCol) +
        padLeft(String(p.card_number_masked), priceCol)
      );
    }
    if (p.card_type) {
      lines.push(padRight("CARD TYPE", labelCol) + padLeft(String(p.card_type), priceCol));
    }
    if (p.card_entry) {
      lines.push(padRight("CARD ENTRY", labelCol) + padLeft(String(p.card_entry), priceCol));
    }
    if (p.reference) {
      const refLines = wrapText(String(p.reference), width);
      lines.push("REFERENCE #");
      for (const rl of refLines) lines.push(padRight(rl, width));
    }
    if (p.status) {
      lines.push(padRight("STATUS", labelCol) + padLeft(String(p.status), priceCol));
    }
  }

  lines.push("");
  lines.push(padCenter("Thank you!", width));
  lines.push("\n\n\n"); // feed

  return lines.join("\n");
}

