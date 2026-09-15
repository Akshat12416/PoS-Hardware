export default function parseWeight(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return null;

  const wt = text.match(/WT:\s*([+-]?\d+(?:\.\d+)?)/i);
  if (wt) return parseFloat(wt[1]);

  const kg = text.match(/([+-]?\d+(?:\.\d+)?)\s*kg/i);
  if (kg) return parseFloat(kg[1]);

  const match = text.match(/([+-]?\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}
