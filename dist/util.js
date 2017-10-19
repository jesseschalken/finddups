'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.replaceLn = replaceLn;
exports.printLn = printLn;
exports.formatBytes = formatBytes;
exports.formatNumber = formatNumber;
exports.padString = padString;


// noinspection JSUnusedGlobalSymbols
function replaceLn(text) {
  const CLEAR = '\r\x1B[2K\x1B[?7l';
  return print(CLEAR + text);
}

function printLn(text) {
  return print(text + '\n');
}

function print(text) {
  return new Promise((resolve, reject) => {
    process.stdout.write(text, err => {
      err ? reject(err) : resolve();
    });
  });
}

function formatBytes(n) {
  const { floor, pow, max, abs, log } = Math;
  let i = floor(log(max(abs(n), 1)) / log(1000));
  return i === 0 ? n + ' B' : formatNumber(n / pow(1000, i), 2) + ' ' + ' KMGTPEZY'[i] + 'B';
}

function roundDown(number, precision) {
  let factor = Math.pow(10, precision);
  return Math.floor(number * factor) / factor;
}

function formatNumber(n, decimals, integers = 1) {
  n = roundDown(n, decimals);
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    minimumIntegerDigits: integers
  });
}

function padString(str, len) {
  return str + ' '.repeat(Math.max(0, len - str.length));
}

/**
 * Version of window.setInterval() that takes an async function instead of a
 * regular function, and doesn't call it if the previous call hasn't finished.
 */
class Interval {
  constructor(func, delayMs) {
    let running = false;
    this.id = setInterval(async () => {
      if (!running) {
        running = true;
        await func();
        running = false;
      }
    }, delayMs);
  }
  stop() {
    clearInterval(this.id);
  }
}
exports.Interval = Interval;
//# sourceMappingURL=util.js.map