//@flow

import * as fs from 'fs';

export type Stats = fs.Stats;

export function open(path: string, mode: string): Promise<number> {
  return new Promise((resolve, reject) => {
    fs.open(path, mode, (err, fd) => {
      err ? reject(err) : resolve(fd);
    });
  });
}

export async function read(fd: number, length: number): Promise<Buffer> {
  let buffer = Buffer.allocUnsafe(length);
  let bytesRead = await new Promise((resolve, reject) => {
    // noinspection JSIgnoredPromiseFromCall
    fs.read(fd, buffer, 0, length, null, (err, bytesRead) => {
      err ? reject(err) : resolve(bytesRead);
    });
  });
  return buffer.slice(0, bytesRead);
}

export function close(fd: number): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.close(fd, err => {
      err ? reject(err) : resolve();
    });
  });
}

export async function readlink(path: string): Promise<string> {
  const buffer = new Promise((resolve, reject) => {
    fs.readlink(path, (err, dest) => {
      err ? reject(err) : resolve(dest);
    });
  });
  return buffer instanceof Buffer ? buffer.toString() : buffer;
}

export function lstat(path: string): Promise<Stats> {
  return new Promise((resolve, reject) => {
    fs.lstat(path, (err, stat) => {
      err ? reject(err) : resolve(stat);
    });
  });
}

// noinspection JSUnusedGlobalSymbols
export function stat(path: string): Promise<Stats> {
  return new Promise((resolve, reject) => {
    fs.stat(path, (err, stat) => {
      err ? reject(err) : resolve(stat);
    });
  });
}

export async function readdir(path: string): Promise<string[]> {
  const names = await new Promise((resolve, reject) => {
    fs.readdir(path, (err, names) => {
      err ? reject(err) : resolve(names);
    });
  });
  // Googling gives mixed results about whether fs.readdir() sorts and
  // whether it sorts on all platforms. Just sort it ourselves to be sure.
  names.sort((a, b) => (a === b ? 0 : a > b ? 1 : -1));
  return names;
}

export function rmdir(path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.rmdir(path, err => {
      err ? reject(err) : resolve();
    });
  });
}

export function unlink(path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.unlink(path, err => {
      err ? reject(err) : resolve();
    });
  });
}
