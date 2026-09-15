import escpos from 'escpos';
import USB from 'escpos-usb';

escpos.USB = USB;

export function printReceipt({ text }) {
  return new Promise((resolve, reject) => {
    let device;

    try {
      device = new escpos.USB();
    } catch (err) {
      return reject(new Error('USB printer not found'));
    }

    const printer = new escpos.Printer(device);

    device.open((error) => {
      if (error) {
        return reject(new Error('Failed to open printer'));
      }

      printer
        .align('ct')
        .style('b')
        .text('POS HARDWARE TEST')
        .text('----------------------')
        .align('lt')
        .style('normal')
        .text(text || 'Hello World')
        .text('----------------------')
        .align('ct')
        .text('PRINT SUCCESS')
        .cut()
        .close();

      resolve(true);
    });
  });
}
