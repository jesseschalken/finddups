'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.replaceLn = replaceLn;
exports.printLn = printLn;
exports.formatBytes = formatBytes;
exports.pad = pad;


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
  if (i === 0) {
    return n + ' B';
  }
  return (n / pow(1000, i)).toFixed(2) + ' ' + ' KMGTPEZY'[i] + 'B';
}

function pad(str, len) {
  return str + ' '.repeat(Math.max(0, len - str.length));
}
//# sourceMappingURL=util.js.map