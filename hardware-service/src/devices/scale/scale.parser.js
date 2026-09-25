const MAGELLAN_STATUS = {
  0: "not_ready",
  1: "motion",
  2: "under_zero",
  3: "over_capacity"
};

/**
 * Datalogic Magellan single-cable RS-232 replies:
 *   S11dddd / S144dddd  stable weight (hundredths of a lb, thousandths of a kg)
 *   S140..S143          not ready, motion, under zero, over capacity
 */
export function parseMagellan(raw, unit = "lb") {
  const text = String(raw ?? "").trim().toUpperCase();
  const divisor = unit === "kg" ? 1000 : 100;

  const weight = text.match(/^S1(?:1|44)(\d{4,5})$/);
  if (weight) {
    return { status: "stable", weight: Number(weight[1]) / divisor };
  }

  const status = text.match(/^S14([0-3])$/);
  if (status) {
    return { status: MAGELLAN_STATUS[status[1]], weight: null };
  }

  return null;
}

export default function parseWeight(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return null;

  const magellan = parseMagellan(text);
  if (magellan) return magellan.weight;

  const wt = text.match(/WT:\s*([+-]?\d+(?:\.\d+)?)/i);
  if (wt) return parseFloat(wt[1]);

  const kg = text.match(/([+-]?\d+(?:\.\d+)?)\s*kg/i);
  if (kg) return parseFloat(kg[1]);

  const match = text.match(/([+-]?\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}
