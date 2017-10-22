// @flow

import {Path, Node} from './scanning';
import * as fs from './promise_fs';
import {Progress} from './progress';
import {
  AsyncCap,
  newCid,
  printLn,
  shuffle,
  sum,
  trackProgress,
  waitAll,
} from './util';
import type {PendingPromise} from './util';

interface PendingFile extends PendingPromise<number> {
  +path: Path;
  +size: number;
}

export class FileReader {
  files: PendingFile[] = [];

  // noinspection JSUnusedGlobalSymbols
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
    for (let group of groups) {
      let cid = newCid();
      for (let file of group) {
        file.resolve(cid);
      }
    }
  }
}

/**
 * This is the number of bytes used by a single regrouping step. The size of
 * the chunk read from each file in a group is REGROUP_SIZE_BYTES divided by
 * the number of files in the group.
 *
 * The higher this is set, the fewer regrouping steps will be required to
 * finish a duplicate group and the fewer times the disk will have to switch
 * contexts between files, but the more memory the whole process will use.
 */
const REGROUP_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Doing regrouping steps concurrently helps keep the disk saturated with
 * IO requests and minimises the amount of time the disk spends idly waiting
 * for the next read request, but the more concurrent jobs are running the
 * more the disk has to switch contexts between files.
 */
const MAX_CONCURRENT_REGROUPS = 2;

/**
 * Set this low enough that the user isn't sitting in front of their screen
 * wondering if the program has frozen but high enough that it won't blow
 * away all of their terminal scrollback.
 */
const PRINT_PROGRESS_DELAY_MS = 10000;

/**
 * Set this lower than the maximum number of open files imposed by the
 * operating system, but higher than the number of files that might share
 * the same file size (since they will have to all be open at once to
 * regroup them).
 */
const MAX_OPEN_FILES = 2000;

async function groupFiles(files: PendingFile[]): Promise<PendingFile[][]> {
  const groups = groupBySize(files);

  // Small files are much slower to read than big files, so shuffle the list
  // so that they are roughly evenly distributed and our time estimates are
  // more likely to be correct.
  shuffle(groups);

  await printLn('Reading file data of potential duplicates');
  let progress = new Progress();
  let counter = new AsyncCap(MAX_CONCURRENT_REGROUPS);
  let groups2 = [];
  await trackProgress(
    () =>
      waitAll(
        groups.map(async group => {
          if (group.length > 1) {
            progress.total += sum(group, file => file.size);
            await counter.inc();
            // Open all the files in the group
            let streams = await Promise.all(
              group.map(file => FileStream.open(file, progress)),
            );
            // Progressively read the files to regroup them
            for (let group of await regroupRecursive(streams)) {
              groups2.push(group.map(stream => stream.file));
            }
            // Close all the files
            await waitAll(streams.map(stream => stream.close()));
            counter.dec();
          } else {
            groups2.push(group);
          }
        }),
      ),
    () => progress.print(),
    PRINT_PROGRESS_DELAY_MS,
  );
  return groups2;
}

class FileStream {
  static OpenFilesCounter: AsyncCap = new AsyncCap(MAX_OPEN_FILES);

  static async open(
    file: PendingFile,
    progress: Progress,
  ): Promise<FileStream> {
    await FileStream.OpenFilesCounter.inc();

    let self = new FileStream();
    self.fd = await fs.open(file.path.get(), 'r');
    self.progress = progress;
    self.file = file;
    return self;
  }

  closed: boolean = false;
  eof: boolean = false;
  fd: number;
  file: PendingFile;
  progress: Progress;
  done: number = 0;

  /**
   * Returns exactly the next `length` bytes, or fewer if end-of-file is
   * reached.
   */
  async read(length: number): Promise<Buffer> {
    // Don't bother allocating a buffer bigger than the remainder of the file
    length = Math.min(length, this.file.size - this.done);

    let buffer = await fs.read(this.fd, length);

    if (buffer.length === 0) {
      this.eof = true;
      // Might as well close the file handle off as soon as possible to free
      // up the open file handle count.
      await this.close();
    }
    this.done += buffer.length;
    this.progress.done += buffer.length;

    return buffer;
  }

  // noinspection JSUnusedGlobalSymbols
  async close(): Promise<void> {
    if (!this.closed) {
      this.closed = true;
      await fs.close(this.fd);

      // Remove any bytes we didn't read from the progress bar
      this.progress.total -= this.file.size - this.done;

      FileStream.OpenFilesCounter.dec();
    }
  }
}

async function regroup(files: FileStream[]): Promise<FileStream[][]> {
  const groups = [];
  // Divide the regroup size by the number of files we have, otherwise we
  // could exhaust our memory just by having a large enough number of in our
  // group.
  const readSize = Math.ceil(REGROUP_SIZE_BYTES / files.length);
  // For each file, in parallel, read the next readSize bytes and add
  // the file to the group for those bytes
  await waitAll(
    files.map(async file => {
      let bytes = await file.read(readSize);
      for (let group of groups) {
        if (group.bytes.equals(bytes)) {
          group.files.push(file);
          return;
        }
      }
      groups.push({bytes, files: [file]});
    }),
  );
  // Return the files from each group
  return groups.map(group => group.files);
}

async function regroupRecursive(files: FileStream[]): Promise<FileStream[][]> {
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
      let groups2 = [];
      // It is important that we don't do the regrouping here in parallel,
      // otherwise the disk read requests will ping pong between different
      // groups which isn't nice on the disk cache.
      for (let files of groups) {
        for (let group of await regroupRecursive(files)) {
          groups2.push(group);
        }
      }
      return groups2;
    }
  }
}

function groupBySize(files: PendingFile[]): PendingFile[][] {
  let map = new Map();
  for (let file of files) {
    let list = map.get(file.size);
    if (list === undefined) {
      map.set(file.size, [file]);
    } else {
      list.push(file);
    }
  }
  return Array.from(map.values());
}
