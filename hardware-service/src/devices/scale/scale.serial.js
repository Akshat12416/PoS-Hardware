import { SerialPort } from 'serialport';
import parseWeight from './scale.parser.js';
import EventBus from '../../events/bus.js';
import logger from '../../utils/logger.js';

const port = new SerialPort({
  path: 'COM3', // change if needed
  baudRate: 9600,
  autoOpen: true
});

let buffer = '';

port.on('data', data => {
  buffer += data.toString();

  if (buffer.includes('\n')) {
    const weight = parseWeight(buffer);
    buffer = '';
    if (weight !== null) {
      logger.info(`Weight received: ${weight}`);
      EventBus.emit('weight', weight);
    }
  }
});

port.on('error', err => {
  logger.error(`Scale error: ${err.message}`);
});
