// @flow

import {formatBytes, formatNumber, printLn} from './util';

function formatTime(t: number): string {
  if (!Number.isFinite(t)) return 'forever';
  let h = formatNumber(t / 3600000, 0, 2);
  let m = formatNumber((t / 60000) % 60, 0, 2);
  let s = formatNumber((t / 1000) % 60, 0, 2);
  return h + ':' + m + ':' + s;
}

function formatPercent(x: number): string {
  if (!Number.isFinite(x)) x = 1;
  return formatNumber(x * 100, 2) + '%';
}

function formatRate(r: number): string {
  if (!Number.isFinite(r)) return 'infinite';
  return formatBytes(r * 1000) + '/s';
}

export class Progress {
  start: number = 0;
  total: number = 0;
  done: number = 0;
  running: bool = false;
  delay: number = 1000;

  constructor() {
    this.start = Date.now();
  }

  print(): Promise<void> {
    return printLn(this.format());
  }

  format(): string {
    let {done, total, start} = this;
    let tPassed = Date.now() - start;
    let rate = formatRate(done / tPassed);
    let percent = formatPercent(done / total);
    // The ETA is the milliseconds per byte so far (passed / done) multiplied
    // by the number of bytes remaining (total - done)
    let eta = formatTime((total - done) * (tPassed / done));

    return `${percent}, ${rate}, ETA ${eta}`;
  }
}