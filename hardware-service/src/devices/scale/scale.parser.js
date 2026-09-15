export default function parseWeight(raw) {
  // Examples:
  // "WT: 1.250 kg"
  // "S 000.500kg"

  const match = raw.match(/([\d]+(\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}
