// @flow

// noinspection JSUnusedGlobalSymbols
export function replaceLn(text: string): Promise<void> {
  const CLEAR = '\r\x1B[2K\x1B[?7l';
  return print(CLEAR + text);
}

export function printLn(text: string): Promise<void> {
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
  if (i === 0) {
    return n + ' B';
  }
  return (n / pow(1000, i)).toFixed(2) + ' ' + ' KMGTPEZY'[i] + 'B';
}

export function pad(str: string, len: number): string {
  return str + ' '.repeat(Math.max(0, len - str.length));
}
