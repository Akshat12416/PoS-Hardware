import ThermalPrinter from 'node-thermal-printer';

export function networkPrinter(ip) {
  return new ThermalPrinter.printer({
    type: ThermalPrinter.types.EPSON,
    interface: `tcp://${ip}`
  });
}
