import readline from 'readline';
import EventBus from '../../events/bus.js';
import logger from '../../utils/logger.js';

export function initKeyboardWedgeScanner() {
  let buffer = '';
  let flushTimer = null;

  function flushBuffer() {
    const value = buffer.trim();
    buffer = '';
    if (!value) return;
    EventBus.emit('barcode', value);
    logger.info(`[SCANNER] Keyboard wedge scan received: ${value}`);
  }

  if (!process.stdin.isTTY) {
    logger.warn('[SCANNER] stdin is not TTY; keyboard wedge capture disabled');
    return false;
  }

  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  logger.info('[SCANNER] Keyboard wedge capture initialized');

  process.stdin.on('keypress', (str, key) => {
    const name = key?.name || '';
    const isTerminator = name === 'return' || name === 'enter' || name === 'tab';

    if (isTerminator) {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      flushBuffer();
      return;
    }

    if (key?.ctrl || key?.meta) return;

    if (typeof str === 'string' && str.length > 0) {
      buffer += str;
      if (flushTimer) clearTimeout(flushTimer);
      // Some scanners don't send Enter/Tab suffix; flush after brief inactivity.
      flushTimer = setTimeout(() => {
        flushTimer = null;
        flushBuffer();
      }, 120);
    }
  });

  return true;
}
