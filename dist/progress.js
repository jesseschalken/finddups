'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Progress = undefined;

var _util = require('./util');

function formatTime(t) {
  if (!Number.isFinite(t)) return 'forever';
  let h = (0, _util.formatNumber)(t / 3600000, 0, 2);
  let m = (0, _util.formatNumber)(t / 60000 % 60, 0, 2);
  let s = (0, _util.formatNumber)(t / 1000 % 60, 0, 2);
  return h + ':' + m + ':' + s;
}

function formatPercent(x) {
  if (!Number.isFinite(x)) x = 1;
  return (0, _util.formatNumber)(x * 100, 2) + '%';
}

function formatRate(r) {
  if (!Number.isFinite(r)) return 'infinite';
  return (0, _util.formatBytes)(r * 1000) + '/s';
}

class Progress {

  constructor(total = 0) {
    this.start = 0;
    this.total = 0;
    this.done = 0;
    this.running = false;
    this.delay = 1000;

    this.total = total;
    this.start = Date.now();
  }

  print() {
    return (0, _util.printLn)(this.format());
  }

  format() {
    let { done, total, start } = this;
    let passed = Date.now() - start;
    let rate = formatRate(done / passed);
    let percent = formatPercent(done / total);
    // The ETA is the milliseconds per byte so far (passed / done) multiplied
    // by the number of bytes remaining (total - done)
    let eta = formatTime((total - done) * (passed / done));

    return `${percent} of ${(0, _util.formatBytes)(total)}, ${rate}, ETA ${eta}`;
  }
}
exports.Progress = Progress;
//# sourceMappingURL=progress.js.map