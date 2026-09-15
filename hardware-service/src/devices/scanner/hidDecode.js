export const HID_USAGE_ENTER = 40;
export const HID_USAGE_TAB = 43;
export const HID_USAGE_A = 4;
export const HID_USAGE_Z = 29;
export const HID_USAGE_1 = 30;
export const HID_USAGE_0 = 39;
export const LEFT_SHIFT_MASK = 0x02;
export const RIGHT_SHIFT_MASK = 0x20;

const shiftedNumberMap = {
  30: "!",
  31: "@",
  32: "#",
  33: "$",
  34: "%",
  35: "^",
  36: "&",
  37: "*",
  38: "(",
  39: ")"
};

const symbolMap = {
  44: " ",
  45: "-",
  46: "=",
  47: "[",
  48: "]",
  49: "\\",
  51: ";",
  52: "'",
  53: "`",
  54: ",",
  55: ".",
  56: "/"
};

const shiftedSymbolMap = {
  45: "_",
  46: "+",
  47: "{",
  48: "}",
  49: "|",
  51: ":",
  52: "\"",
  53: "~",
  54: "<",
  55: ">",
  56: "?"
};

export function usageToChar(usageId, shifted) {
  if (usageId >= HID_USAGE_A && usageId <= HID_USAGE_Z) {
    const base = String.fromCharCode("a".charCodeAt(0) + (usageId - HID_USAGE_A));
    return shifted ? base.toUpperCase() : base;
  }

  if (usageId >= HID_USAGE_1 && usageId <= HID_USAGE_0) {
    if (shifted) return shiftedNumberMap[usageId] || "";
    return usageId === HID_USAGE_0 ? "0" : String(usageId - HID_USAGE_1 + 1);
  }

  if (shifted) return shiftedSymbolMap[usageId] || symbolMap[usageId] || "";
  return symbolMap[usageId] || "";
}

export function isTerminatorUsage(usageId) {
  return usageId === HID_USAGE_ENTER || usageId === HID_USAGE_TAB;
}
