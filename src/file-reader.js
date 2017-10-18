// @flow

import {Path, Node} from './scanning';
import * as fs from 'fs';

interface PendingPromise<T> {
  +resolve: T => void;
  +reject: mixed => void;
}

interface PendingFile extends PendingPromise<number> {
  +path: Path;
  +size: number;
}

export class FileReader {
  files: PendingFile[] = [];

  add(file: Node): Promise<number> {
    // `new Promise(cb)` executes `cb` synchronously, so once this method
    // finishes we know the file has been added to `this.files`.
    return new Promise((resolve, reject) => {
      let {path, size} = file;
      this.files.push({path, size, resolve, reject});
    });
  }

  async run(): Promise<void> {
    // Group our files together
    let groups = await groupFiles(this.files);
    // And resolve the group number for each file based on the group its in
    for (let i = 0; i < groups.length; i++) {
      for (let file of groups[i]) {
        file.resolve(i);
      }
    }
  }
}

async function groupFiles(files: PendingFile[]): Promise<PendingFile[][]> {
  let groups1 = groupBySize(files);
  let groups2 = [];
  await waitAll(groups1.map(async group => {
    if (group.length > 1) {
      for (let group2 of
          await regroupRecursive(group.map(file => new OpenFile(file)))) {
        groups2.push(group2.map(file => file.file));
      }
    } else {
      groups2.push(group);
    }
  }));
  return groups2;
}

class OpenFile {
  closed: boolean = false;
  eof: boolean = false;
  fd: Promise<number>;
  file: PendingFile;

  constructor(file: PendingFile) {
    this.file = file;
    this.fd = openFd(file.path.get());
  }

  /**
   * Returns exactly the next `length` bytes, or fewer if end-of-file is
   * reached.
   */
  async read(length: number): Promise<Buffer> {
    if (this.closed || length === 0) {
      return Buffer.alloc(0);
    }
    let buffer = await readFd(await this.fd, length);
    if (buffer.length === 0) {
      this.eof = true;
      await this.close();
    }
    return buffer;
  }

  async close(): Promise<void> {
    // Gate to make sure only the first call to close() will close the file
    // handle.
    if (!this.closed) {
      this.closed = true;
      await closeFd(await this.fd);
    }
  }
}

const fdCounter = new class {
  count: number = 0;
  queue: PendingPromise<void>[] = [];
  // noinspection JSUnusedGlobalSymbols
  inc(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.queue.push({resolve, reject});
      this.run();
    });
  }
  // noinspection JSUnusedGlobalSymbols
  dec(): void {
    this.count--;
    this.run();
  }
  run(): void {
    while (this.queue.length > 0 && this.count < 1000) {
      this.count++;
      this.queue.shift().resolve();
    }
  }
}();

async function openFd(path: string): Promise<number> {
  // Make sure there are less than 1000 open file descriptors before opening
  // more of them.
  await fdCounter.inc();
  return new Promise((resolve, reject) => {
    fs.open(path, 'r', (err, fd) => {
      err ? reject(err) : resolve(fd);
    });
  });
}

async function readFd(fd: number, length: number): Promise<Buffer> {
  let buffer = Buffer.allocUnsafe(length);
  let bytesRead = await new Promise((resolve, reject) => {
    // noinspection JSIgnoredPromiseFromCall
    fs.read(fd, buffer, 0, length, null, (err, bytesRead) => {
      err ? reject(err) : resolve(bytesRead);
    });
  });
  if (bytesRead < length) {
    buffer = buffer.slice(0, bytesRead);
  }
  return buffer;
}

function closeFd(fd: number): Promise<void> {
  fdCounter.dec();
  return new Promise((resolve, reject) => {
    fs.close(fd, err => {
      err ? reject(err) : resolve();
    });
  });
}

/** Promise.all but without building an array of return values */
async function waitAll(promises: Iterable<Promise<void>>): Promise<void> {
  for (let promise of promises) {
    await promise;
  }
}

type Group = {+bytes: Buffer, +files: OpenFile[]};

function findGroup(groups: Group[], bytes: Buffer): Group {
  for (let group of groups) {
    if (group.bytes.equals(bytes)) {
      return group;
    }
  }
  let group = {bytes, files: []};
  groups.push(group);
  return group;
}

const CHUNK_SIZE = 10 * 1024 * 1024;

async function regroup(files: OpenFile[]): Promise<OpenFile[][]> {
  let groups: Group[] = [];
  // For each file, in parallel, read the next CHUNK_SIZE bytes and add the
  // file to the group for those bytes
  await waitAll(files.map(async file => {
    let bytes = await file.read(CHUNK_SIZE);
    let group = findGroup(groups, bytes);
    group.files.push(file);
  }));
  // Return the files from each group
  return groups.map(group => group.files);
}

async function regroupRecursive(files: OpenFile[]): Promise<OpenFile[][]> {
  if (files.length === 0) {
    // Not sure why we were given an empty group but whatever
    return [];
  } else if (files.length === 1 || files.every(file => file.eof)) {
    // Terminal case. A group with only one element in it or where every
    // file has reached EOF is finished. Close them off and return the
    // group back. Close all the files in parallel.
    await waitAll(files.map(file => file.close()));
    return [files];
  } else {
    // If the group has multiple files in it and they are not at EOF then
    // we need to read more of the files to determine if they are actual
    // duplicates. Regroup the files based on the next set of bytes and
    // recurse on the new groups.
    let groups = await regroup(files);
    if (groups.length === 1) {
      // Tail call so our stack doesn't grow forever
      return regroupRecursive(groups[0]);
    } else {
      let ret = [];
      await waitAll(groups.map(async files => {
        for (let group of await regroupRecursive(files)) {
          ret.push(group);
        }
      }));
      return ret;
    }
  }
}

function groupBySize(files: PendingFile[]): PendingFile[][] {
  let map = new Map();
  for (let file of files) {
    let list = map.get(file.size);
    if (list === undefined) {
      list = [];
      map.set(file.size, list);
    }
    list.push(file);
  }
  return Array.from(map.values());
}
