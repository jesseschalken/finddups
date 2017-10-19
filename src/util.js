// @flow

// noinspection JSUnusedGlobalSymbols
export function replaceLn(text: string): Promise<void> {
  const CLEAR = '\r\x1B[2K\x1B[?7l';
  return print(CLEAR + text);
}

export function printLn(text: string = ''): Promise<void> {
  return print(text + '\n');
}

function print(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    process.stdout.write(text, err => {
      err ? reject(err) : resolve();
    });
  });
}

export function formatBytes(n: number): string {
  const {floor, pow, max, abs, log} = Math;
  let i = floor(log(max(abs(n), 1)) / log(1000));
  return i === 0 ? n + ' B' :
         formatNumber(n / pow(1000, i), 2) + ' ' + ' KMGTPEZY'[i] + 'B';
}

function roundDown(number: number, precision: number): number {
  let factor = Math.pow(10, precision);
  return Math.floor(number * factor) / factor;
}

export function formatNumber(n: number, decimals: number,
       integers: number = 1): string {
  n = roundDown(n, decimals);
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    minimumIntegerDigits: integers,
  });
}

export function padString(str: string, len: number): string {
  return str + ' '.repeat(Math.max(0, len - str.length));
}

/**
 * Version of window.setInterval() that takes an async function instead of a
 * regular function, and doesn't call it if the previous call hasn't finished.
 */
export class Interval {
  id: number;
  constructor(func: () => Promise<void>, delayMs: number) {
    let running = false;
    this.id = setInterval(async () => {
      if (!running) {
        running = true;
        await func();
        running = false;
      }
    }, delayMs);
  }
  stop(): void {
    clearInterval(this.id);
  }
}

let nextCid = 1;
export const newCid = () => nextCid++;
