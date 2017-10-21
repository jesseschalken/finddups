'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.FileReader = undefined;

var _scanning = require('./scanning');

var _promise_fs = require('./promise_fs');

var fs = _interopRequireWildcard(_promise_fs);

var _progress = require('./progress');

var _util = require('./util');

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

class FileReader {
  constructor() {
    this.files = [];
  }

  // noinspection JSUnusedGlobalSymbols
  add(file) {
    // `new Promise(cb)` executes `cb` synchronously, so once this method
    // finishes we know the file has been added to `this.files`.
    return new Promise((resolve, reject) => {
      let { path, size } = file;
      this.files.push({ path, size, resolve, reject });
    });
  }

  async run() {
    // Group our files together
    let groups = await groupFiles(this.files);
    // And resolve the group number for each file based on the group its in
    for (let group of groups) {
      let cid = (0, _util.newCid)();
      for (let file of group) {
        file.resolve(cid);
      }
    }
  }
}

exports.FileReader = FileReader;
const REGROUP_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_CONCURRENT_REGROUPS = 10;
const PRINT_PROGRESS_DELAY_MS = 10000;
const MAX_OPEN_FILES = 2000;

async function groupFiles(files) {
  const groups = groupBySize(files);

  // Small files are much slower to read than big files, so shuffle the list
  // so that they are roughly evenly distributed and our time estimates are
  // more likely to be correct.
  (0, _util.shuffle)(groups);

  await (0, _util.printLn)('Reading file data of potential duplicates');
  let progress = new _progress.Progress();
  let counter = new _util.AsyncCap(MAX_CONCURRENT_REGROUPS);
  let groups2 = [];
  await (0, _util.trackProgress)(() => (0, _util.waitAll)(groups.map(async group => {
    if (group.length > 1) {
      progress.total += (0, _util.sum)(group, file => file.size);
      await counter.inc();
      // Open all the files in the group
      let streams = await Promise.all(group.map(file => FileStream.open(file, progress)));
      // Progressively read the files to regroup them
      for (let group of await regroupRecursive(streams)) {
        groups2.push(group.map(stream => stream.file));
      }
      // Close all the files
      await (0, _util.waitAll)(streams.map(stream => stream.close()));
      counter.dec();
    } else {
      groups2.push(group);
    }
  })), () => progress.print(), PRINT_PROGRESS_DELAY_MS);
  return groups2;
}

class FileStream {
  constructor() {
    this.closed = false;
    this.eof = false;
    this.done = 0;
  }

  static async open(file, progress) {
    await FileStream.OpenFilesCounter.inc();

    let self = new FileStream();
    self.fd = await fs.open(file.path.get(), 'r');
    self.progress = progress;
    self.file = file;
    return self;
  }

  /**
   * Returns exactly the next `length` bytes, or fewer if end-of-file is
   * reached.
   */
  async read(length) {
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
  async close() {
    if (!this.closed) {
      this.closed = true;
      await fs.close(this.fd);

      // Remove any bytes we didn't read from the progress bar
      this.progress.total -= this.file.size - this.done;

      FileStream.OpenFilesCounter.dec();
    }
  }
}

FileStream.OpenFilesCounter = new _util.AsyncCap(MAX_OPEN_FILES);
async function regroup(files) {
  let groups = [];
  function getGroup(bytes) {
    for (let group of groups) {
      if (group.bytes.equals(bytes)) {
        return group;
      }
    }
    let group = { bytes, files: [] };
    groups.push(group);
    return group;
  }
  // Divide the regroup size by the number of files we have, otherwise we
  // could exhaust our memory just by having a large enough number of in our
  // group.
  const readSize = Math.ceil(REGROUP_SIZE_BYTES / files.length);
  // For each file, in parallel, read the next readSize bytes and add
  // the file to the group for those bytes
  await (0, _util.waitAll)(files.map(async file => {
    let bytes = await file.read(readSize);
    let group = getGroup(bytes);
    group.files.push(file);
  }));
  // Return the files from each group
  return groups.map(group => group.files);
}

async function regroupRecursive(files) {
  if (files.length === 0) {
    // Not sure why we were given an empty group but whatever
    return [];
  } else if (files.length === 1 || files.every(file => file.eof)) {
    // Terminal case. A group with only one element in it or where every
    // file has reached EOF is finished. Close them off and return the
    // group back. Close all the files in parallel.
    await (0, _util.waitAll)(files.map(file => file.close()));
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

function groupBySize(files) {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9maWxlLXJlYWRlci5qcyJdLCJuYW1lcyI6WyJmcyIsIkZpbGVSZWFkZXIiLCJmaWxlcyIsImFkZCIsImZpbGUiLCJQcm9taXNlIiwicmVzb2x2ZSIsInJlamVjdCIsInBhdGgiLCJzaXplIiwicHVzaCIsInJ1biIsImdyb3VwcyIsImdyb3VwRmlsZXMiLCJncm91cCIsImNpZCIsIlJFR1JPVVBfU0laRV9CWVRFUyIsIk1BWF9DT05DVVJSRU5UX1JFR1JPVVBTIiwiUFJJTlRfUFJPR1JFU1NfREVMQVlfTVMiLCJNQVhfT1BFTl9GSUxFUyIsImdyb3VwQnlTaXplIiwicHJvZ3Jlc3MiLCJjb3VudGVyIiwiZ3JvdXBzMiIsIm1hcCIsImxlbmd0aCIsInRvdGFsIiwiaW5jIiwic3RyZWFtcyIsImFsbCIsIkZpbGVTdHJlYW0iLCJvcGVuIiwicmVncm91cFJlY3Vyc2l2ZSIsInN0cmVhbSIsImNsb3NlIiwiZGVjIiwicHJpbnQiLCJjbG9zZWQiLCJlb2YiLCJkb25lIiwiT3BlbkZpbGVzQ291bnRlciIsInNlbGYiLCJmZCIsImdldCIsInJlYWQiLCJNYXRoIiwibWluIiwiYnVmZmVyIiwicmVncm91cCIsImdldEdyb3VwIiwiYnl0ZXMiLCJlcXVhbHMiLCJyZWFkU2l6ZSIsImNlaWwiLCJldmVyeSIsIk1hcCIsImxpc3QiLCJ1bmRlZmluZWQiLCJzZXQiLCJBcnJheSIsImZyb20iLCJ2YWx1ZXMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFFQTs7QUFDQTs7SUFBWUEsRTs7QUFDWjs7QUFDQTs7OztBQWdCTyxNQUFNQyxVQUFOLENBQWlCO0FBQUE7QUFBQSxTQUN0QkMsS0FEc0IsR0FDQyxFQUREO0FBQUE7O0FBR3RCO0FBQ0FDLE1BQUlDLElBQUosRUFBaUM7QUFDL0I7QUFDQTtBQUNBLFdBQU8sSUFBSUMsT0FBSixDQUFZLENBQUNDLE9BQUQsRUFBVUMsTUFBVixLQUFxQjtBQUN0QyxVQUFJLEVBQUNDLElBQUQsRUFBT0MsSUFBUCxLQUFlTCxJQUFu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LE9BQU9hLE1BQVAsS0FBa0IsQ0FBdEIsRUFBeUI7QUFDdkI7QUFDQSxhQUFPTyxpQkFBaUJwQixPQUFPLENBQVAsQ0FBakIsQ0FBUDtBQUNELEtBSEQsTUFHTztBQUNMLFVBQUlXLFVBQVUsRUFBZDtBQUNBO0FBQ0E7QUFDQTtBQUNBLFdBQUssSUFBSXJCLEtBQVQsSUFBa0JVLE1BQWxCLEVBQTBCO0FBQ3hCLGFBQUssSUFBSUUsS0FBVCxJQUFrQixNQUFNa0IsaUJBQWlCOUIsS0FBakIsQ0FBeEIsRUFBaUQ7QUFDL0NxQixrQkFBUWIsSUFBUixDQUFhSSxLQUFiO0FBQ0Q7QUFDRjtBQUNELGFBQU9TLE9BQVA7QUFDRDtBQUNGO0FBQ0Y7O0FBRUQsU0FBU0gsV0FBVCxDQUFxQmxCLEtBQXJCLEVBQTREO0FBQzFELE1BQUlzQixNQUFNLElBQUkrQixHQUFKLEVBQVY7QUFDQSxPQUFLLElBQUluRCxJQUFULElBQWlCRixLQUFqQixFQUF3QjtBQUN0QixRQUFJc0QsT0FBT2hDLElBQUltQixHQUFKLENBQVF2QyxLQUFLSyxJQUFiLENBQVg7QUFDQSxRQUFJK0MsU0FBU0MsU0FBYixFQUF3QjtBQUN0QmpDLFVBQUlrQyxHQUFKLENBQVF0RCxLQUFLSyxJQUFiLEVBQW1CLENBQUNMLElBQUQsQ0FBbkI7QUFDRCxLQUZELE1BRU87QUFDTG9ELFdBQUs5QyxJQUFMLENBQVVOLElBQVY7QUFDRDtBQUNGO0FBQ0QsU0FBT3VELE1BQU1DLElBQU4sQ0FBV3BDLElBQUlxQyxNQUFKLEVBQVgsQ0FBUDtBQUNEIiwiZmlsZSI6ImZpbGUtcmVhZGVyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLy8gQGZsb3dcblxuaW1wb3J0IHtQYXRoLCBOb2RlfSBmcm9tICcuL3NjYW5uaW5nJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJy4vcHJvbWlzZV9mcyc7XG5pbXBvcnQge1Byb2dyZXNzfSBmcm9tICcuL3Byb2dyZXNzJztcbmltcG9ydCB7XG4gIEFzeW5jQ2FwLFxuICBuZXdDaWQsXG4gIHByaW50TG4sXG4gIHNodWZmbGUsXG4gIHN1bSxcbiAgdHJhY2tQcm9ncmVzcyxcbiAgd2FpdEFsbCxcbn0gZnJvbSAnLi91dGlsJztcbmltcG9ydCB0eXBlIHtQZW5kaW5nUHJvbWlzZX0gZnJvbSAnLi91dGlsJztcblxuaW50ZXJmYWNlIFBlbmRpbmdGaWxlIGV4dGVuZHMgUGVuZGluZ1Byb21pc2U8bnVtYmVyPiB7XG4gICtwYXRoOiBQYXRoO1xuICArc2l6ZTogbnVtYmVyO1xufVxuXG5leHBvcnQgY2xhc3MgRmlsZVJlYWRlciB7XG4gIGZpbGVzOiBQZW5kaW5nRmlsZVtdID0gW107XG5cbiAgLy8gbm9pbnNwZWN0aW9uIEpTVW51c2VkR2xvYmFsU3ltYm9sc1xuICBhZGQoZmlsZTogTm9kZSk6IFByb21pc2U8bnVtYmVyPiB7XG4gICAgLy8gYG5ldyBQcm9taXNlKGNiKWAgZXhlY3V0ZXMgYGNiYCBzeW5jaHJvbm91c2x5LCBzbyBvbmNlIHRoaXMgbWV0aG9kXG4gICAgLy8gZmluaXNoZXMgd2Uga25vdyB0aGUgZmlsZSBoYXMgYmVlbiBhZGRlZCB0byBgdGhpcy5maWxlc2AuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGxldCB7cGF0aCwgc2l6ZX0gPSBmaWxlO1xuICAgICAgdGhpcy5maWxlcy5wdXNoKHtwYXRoLCBzaXplLCByZXNvbHZlLCByZWplY3R9KTtcbiAgICB9KTtcbiAgfVxuXG4gIGFzeW5jIHJ1bigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAvLyBHcm91cCBvdXIgZmlsZXMgdG9nZXRoZXJcbiAgICBsZXQgZ3JvdXBzID0gYXdhaXQgZ3JvdXBGaWxlcyh0aGlzLmZpbGVzKTtcbiAgICAvLyBBbmQgcmVzb2x2ZSB0aGUgZ3JvdXAgbnVtYmVyIGZvciBlYWNoIGZpbGUgYmFzZWQgb24gdGhlIGdyb3VwIGl0cyBpblxuICAgIGZvciAobGV0IGdyb3VwIG9mIGdyb3Vwcykge1xuICAgICAgbGV0IGNpZCA9IG5ld0NpZCgpO1xuICAgICAgZm9yIChsZXQgZmlsZSBvZiBncm91cCkge1xuICAgICAgICBmaWxlLnJlc29sdmUoY2lkKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuY29uc3QgUkVHUk9VUF9TSVpFX0JZVEVTID0gMTAgKiAxMDI0ICogMTAyNDtcbmNvbnN0IE1BWF9DT05DVVJSRU5UX1JFR1JPVVBTID0gMTA7XG5jb25zdCBQUklOVF9QUk9HUkVTU19ERUxBWV9NUyA9IDEwMDAwO1xuY29uc3QgTUFYX09QRU5fRklMRVMgPSAyMDAwO1xuXG5hc3luYyBmdW5jdGlvbiBncm91cEZpbGVzKGZpbGVzOiBQZW5kaW5nRmlsZVtdKTogUHJvbWlzZTxQZW5kaW5nRmlsZVtdW10+IHtcbiAgY29uc3QgZ3JvdXBzID0gZ3JvdXBCeVNpemUoZmlsZXMpO1xuXG4gIC8vIFNtYWxsIGZpbGVzIGFyZSBtdWNoIHNsb3dlciB0byByZWFkIHRoYW4gYmlnIGZpbGVzLCBzbyBzaHVmZmxlIHRoZSBsaXN0XG4gIC8vIHNvIHRoYXQgdGhleSBhcmUgcm91Z2hseSBldmVubHkgZGlzdHJpYnV0ZWQgYW5kIG91ciB0aW1lIGVzdGltYXRlcyBhcmVcbiAgLy8gbW9yZSBsaWtlbHkgdG8gYmUgY29ycmVjdC5cbiAgc2h1ZmZsZShncm91cHMpO1xuXG4gIGF3YWl0IHByaW50TG4oJ1JlYWRpbmcgZmlsZSBkYXRhIG9mIHBvdGVudGlhbCBkdXBsaWNhdGVzJyk7XG4gIGxldCBwcm9ncmVzcyA9IG5ldyBQcm9ncmVzcygpO1xuICBsZXQgY291bnRlciA9IG5ldyBBc3luY0NhcChNQVhfQ09OQ1VSUkVOVF9SRUdST1VQUyk7XG4gIGxldCBncm91cHMyID0gW107XG4gIGF3YWl0IHRyYWNrUHJvZ3Jlc3MoXG4gICAgKCkgPT5cbiAgICAgIHdhaXRBbGwoXG4gICAgICAgIGdyb3Vwcy5tYXAoYXN5bmMgZ3JvdXAgPT4ge1xuICAgICAgICAgIGlmIChncm91cC5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICBwcm9ncmVzcy50b3RhbCArPSBzdW0oZ3JvdXAsIGZpbGUgPT4gZmlsZS5zaXplKTtcbiAgICAgICAgICAgIGF3YWl0IGNvdW50ZXIuaW5jKCk7XG4gICAgICAgICAgICAvLyBPcGVuIGFsbCB0aGUgZmlsZXMgaW4gdGhlIGdyb3VwXG4gICAgICAgICAgICBsZXQgc3RyZWFtcyA9IGF3YWl0IFByb21pc2UuYWxsKFxuICAgICAgICAgICAgICBncm91cC5tYXAoZmlsZSA9PiBGaWxlU3RyZWFtLm9wZW4oZmlsZSwgcHJvZ3Jlc3MpKSxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICAvLyBQcm9ncmVzc2l2ZWx5IHJlYWQgdGhlIGZpbGVzIHRvIHJlZ3JvdXAgdGhlbVxuICAgICAgICAgICAgZm9yIChsZXQgZ3JvdXAgb2YgYXdhaXQgcmVncm91cFJlY3Vyc2l2ZShzdHJlYW1zKSkge1xuICAgICAgICAgICAgICBncm91cHMyLnB1c2goZ3JvdXAubWFwKHN0cmVhbSA9PiBzdHJlYW0uZmlsZSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gQ2xvc2UgYWxsIHRoZSBmaWxlc1xuICAgICAgICAgICAgYXdhaXQgd2FpdEFsbChzdHJlYW1zLm1hcChzdHJlYW0gPT4gc3RyZWFtLmNsb3NlKCkpKTtcbiAgICAgICAgICAgIGNvdW50ZXIuZGVjKCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGdyb3VwczIucHVzaChncm91cCk7XG4gICAgICAgICAgfVxuICAgICAgICB9KSxcbiAgICAgICksXG4gICAgKCkgPT4gcHJvZ3Jlc3MucHJpbnQoKSxcbiAgICBQUklOVF9QUk9HUkVTU19ERUxBWV9NUyxcbiAgKTtcbiAgcmV0dXJuIGdyb3VwczI7XG59XG5cbmNsYXNzIEZpbGVTdHJlYW0ge1xuICBzdGF0aWMgT3BlbkZpbGVzQ291bnRlcjogQXN5bmNDYXAgPSBuZXcgQXN5bmNDYXAoTUFYX09QRU5fRklMRVMpO1xuXG4gIHN0YXRpYyBhc3luYyBvcGVuKFxuICAgIGZpbGU6IFBlbmRpbmdGaWxlLFxuICAgIHByb2dyZXNzOiBQcm9ncmVzcyxcbiAgKTogUHJvbWlzZTxGaWxlU3RyZWFtPiB7XG4gICAgYXdhaXQgRmlsZVN0cmVhbS5PcGVuRmlsZXNDb3VudGVyLmluYygpO1xuXG4gICAgbGV0IHNlbGYgPSBuZXcgRmlsZVN0cmVhbSgpO1xuICAgIHNlbGYuZmQgPSBhd2FpdCBmcy5vcGVuKGZpbGUucGF0aC5nZXQoKSwgJ3InKTtcbiAgICBzZWxmLnByb2dyZXNzID0gcHJvZ3Jlc3M7XG4gICAgc2VsZi5maWxlID0gZmlsZTtcbiAgICByZXR1cm4gc2VsZjtcbiAgfVxuXG4gIGNsb3NlZDogYm9vbGVhbiA9IGZhbHNlO1xuICBlb2Y6IGJvb2xlYW4gPSBmYWxzZTtcbiAgZmQ6IG51bWJlcjtcbiAgZmlsZTogUGVuZGluZ0ZpbGU7XG4gIHByb2dyZXNzOiBQcm9ncmVzcztcbiAgZG9uZTogbnVtYmVyID0gMDtcblxuICAvKipcbiAgICogUmV0dXJucyBleGFjdGx5IHRoZSBuZXh0IGBsZW5ndGhgIGJ5dGVzLCBvciBmZXdlciBpZiBlbmQtb2YtZmlsZSBpc1xuICAgKiByZWFjaGVkLlxuICAgKi9cbiAgYXN5bmMgcmVhZChsZW5ndGg6IG51bWJlcik6IFByb21pc2U8QnVmZmVyPiB7XG4gICAgLy8gRG9uJ3QgYm90aGVyIGFsbG9jYXRpbmcgYSBidWZmZXIgYmlnZ2VyIHRoYW4gdGhlIHJlbWFpbmRlciBvZiB0aGUgZmlsZVxuICAgIGxlbmd0aCA9IE1hdGgubWluKGxlbmd0aCwgdGhpcy5maWxlLnNpemUgLSB0aGlzLmRvbmUpO1xuXG4gICAgbGV0IGJ1ZmZlciA9IGF3YWl0IGZzLnJlYWQodGhpcy5mZCwgbGVuZ3RoKTtcblxuICAgIGlmIChidWZmZXIubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aGlzLmVvZiA9IHRydWU7XG4gICAgICAvLyBNaWdodCBhcyB3ZWxsIGNsb3NlIHRoZSBmaWxlIGhhbmRsZSBvZmYgYXMgc29vbiBhcyBwb3NzaWJsZSB0byBmcmVlXG4gICAgICAvLyB1cCB0aGUgb3BlbiBmaWxlIGhhbmRsZSBjb3VudC5cbiAgICAgIGF3YWl0IHRoaXMuY2xvc2UoKTtcbiAgICB9XG4gICAgdGhpcy5kb25lICs9IGJ1ZmZlci5sZW5ndGg7XG4gICAgdGhpcy5wcm9ncmVzcy5kb25lICs9IGJ1ZmZlci5sZW5ndGg7XG5cbiAgICByZXR1cm4gYnVmZmVyO1xuICB9XG5cbiAgLy8gbm9pbnNwZWN0aW9uIEpTVW51c2VkR2xvYmFsU3ltYm9sc1xuICBhc3luYyBjbG9zZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBpZiAoIXRoaXMuY2xvc2VkKSB7XG4gICAgICB0aGlzLmNsb3NlZCA9IHRydWU7XG4gICAgICBhd2FpdCBmcy5jbG9zZSh0aGlzLmZkKTtcblxuICAgICAgLy8gUmVtb3ZlIGFueSBieXRlcyB3ZSBkaWRuJ3QgcmVhZCBmcm9tIHRoZSBwcm9ncmVzcyBiYXJcbiAgICAgIHRoaXMucHJvZ3Jlc3MudG90YWwgLT0gdGhpcy5maWxlLnNpemUgLSB0aGlzLmRvbmU7XG5cbiAgICAgIEZpbGVTdHJlYW0uT3BlbkZpbGVzQ291bnRlci5kZWMoKTtcbiAgICB9XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gcmVncm91cChmaWxlczogRmlsZVN0cmVhbVtdKTogUHJvbWlzZTxGaWxlU3RyZWFtW11bXT4ge1xuICBsZXQgZ3JvdXBzID0gW107XG4gIGZ1bmN0aW9uIGdldEdyb3VwKGJ5dGVzKSB7XG4gICAgZm9yIChsZXQgZ3JvdXAgb2YgZ3JvdXBzKSB7XG4gICAgICBpZiAoZ3JvdXAuYnl0ZXMuZXF1YWxzKGJ5dGVzKSkge1xuICAgICAgICByZXR1cm4gZ3JvdXA7XG4gICAgICB9XG4gICAgfVxuICAgIGxldCBncm91cCA9IHtieXRlcywgZmlsZXM6IFtdfTtcbiAgICBncm91cHMucHVzaChncm91cCk7XG4gICAgcmV0dXJuIGdyb3VwO1xuICB9XG4gIC8vIERpdmlkZSB0aGUgcmVncm91cCBzaXplIGJ5IHRoZSBudW1iZXIgb2YgZmlsZXMgd2UgaGF2ZSwgb3RoZXJ3aXNlIHdlXG4gIC8vIGNvdWxkIGV4aGF1c3Qgb3VyIG1lbW9yeSBqdXN0IGJ5IGhhdmluZyBhIGxhcmdlIGVub3VnaCBudW1iZXIgb2YgaW4gb3VyXG4gIC8vIGdyb3VwLlxuICBjb25zdCByZWFkU2l6ZSA9IE1hdGguY2VpbChSRUdST1VQX1NJWkVfQllURVMgLyBmaWxlcy5sZW5ndGgpO1xuICAvLyBGb3IgZWFjaCBmaWxlLCBpbiBwYXJhbGxlbCwgcmVhZCB0aGUgbmV4dCByZWFkU2l6ZSBieXRlcyBhbmQgYWRkXG4gIC8vIHRoZSBmaWxlIHRvIHRoZSBncm91cCBmb3IgdGhvc2UgYnl0ZXNcbiAgYXdhaXQgd2FpdEFsbChcbiAgICBmaWxlcy5tYXAoYXN5bmMgZmlsZSA9PiB7XG4gICAgICBsZXQgYnl0ZXMgPSBhd2FpdCBmaWxlLnJlYWQocmVhZFNpemUpO1xuICAgICAgbGV0IGdyb3VwID0gZ2V0R3JvdXAoYnl0ZXMpO1xuICAgICAgZ3JvdXAuZmlsZXMucHVzaChmaWxlKTtcbiAgICB9KSxcbiAgKTtcbiAgLy8gUmV0dXJuIHRoZSBmaWxlcyBmcm9tIGVhY2ggZ3JvdXBcbiAgcmV0dXJuIGdyb3Vwcy5tYXAoZ3JvdXAgPT4gZ3JvdXAuZmlsZXMpO1xufVxuXG5hc3luYyBmdW5jdGlvbiByZWdyb3VwUmVjdXJzaXZlKGZpbGVzOiBGaWxlU3RyZWFtW10pOiBQcm9taXNlPEZpbGVTdHJlYW1bXVtdPiB7XG4gIGlmIChmaWxlcy5sZW5ndGggPT09IDApIHtcbiAgICAvLyBOb3Qgc3VyZSB3aHkgd2Ugd2VyZSBnaXZlbiBhbiBlbXB0eSBncm91cCBidXQgd2hhdGV2ZXJcbiAgICByZXR1cm4gW107XG4gIH0gZWxzZSBpZiAoZmlsZXMubGVuZ3RoID09PSAxIHx8IGZpbGVzLmV2ZXJ5KGZpbGUgPT4gZmlsZS5lb2YpKSB7XG4gICAgLy8gVGVybWluYWwgY2FzZS4gQSBncm91cCB3aXRoIG9ubHkgb25lIGVsZW1lbnQgaW4gaXQgb3Igd2hlcmUgZXZlcnlcbiAgICAvLyBmaWxlIGhhcyByZWFjaGVkIEVPRiBpcyBmaW5pc2hlZC4gQ2xvc2UgdGhlbSBvZmYgYW5kIHJldHVybiB0aGVcbiAgICAvLyBncm91cCBiYWNrLiBDbG9zZSBhbGwgdGhlIGZpbGVzIGluIHBhcmFsbGVsLlxuICAgIGF3YWl0IHdhaXRBbGwoZmlsZXMubWFwKGZpbGUgPT4gZmlsZS5jbG9zZSgpKSk7XG4gICAgcmV0dXJuIFtmaWxlc107XG4gIH0gZWxzZSB7XG4gICAgLy8gSWYgdGhlIGdyb3VwIGhhcyBtdWx0aXBsZSBmaWxlcyBpbiBpdCBhbmQgdGhleSBhcmUgbm90IGF0IEVPRiB0aGVuXG4gICAgLy8gd2UgbmVlZCB0byByZWFkIG1vcmUgb2YgdGhlIGZpbGVzIHRvIGRldGVybWluZSBpZiB0aGV5IGFyZSBhY3R1YWxcbiAgICAvLyBkdXBsaWNhdGVzLiBSZWdyb3VwIHRoZSBmaWxlcyBiYXNlZCBvbiB0aGUgbmV4dCBzZXQgb2YgYnl0ZXMgYW5kXG4gICAgLy8gcmVjdXJzZSBvbiB0aGUgbmV3IGdyb3Vwcy5cbiAgICBsZXQgZ3JvdXBzID0gYXdhaXQgcmVncm91cChmaWxlcyk7XG4gICAgaWYgKGdyb3Vwcy5sZW5ndGggPT09IDEpIHtcbiAgICAgIC8vIFRhaWwgY2FsbCBzbyBvdXIgc3RhY2sgZG9lc24ndCBncm93IGZvcmV2ZXJcbiAgICAgIHJldHVybiByZWdyb3VwUmVjdXJzaXZlKGdyb3Vwc1swXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCBncm91cHMyID0gW107XG4gICAgICAvLyBJdCBpcyBpbXBvcnRhbnQgdGhhdCB3ZSBkb24ndCBkbyB0aGUgcmVncm91cGluZyBoZXJlIGluIHBhcmFsbGVsLFxuICAgICAgLy8gb3RoZXJ3aXNlIHRoZSBkaXNrIHJlYWQgcmVxdWVzdHMgd2lsbCBwaW5nIHBvbmcgYmV0d2VlbiBkaWZmZXJlbnRcbiAgICAgIC8vIGdyb3VwcyB3aGljaCBpc24ndCBuaWNlIG9uIHRoZSBkaXNrIGNhY2hlLlxuICAgICAgZm9yIChsZXQgZmlsZXMgb2YgZ3JvdXBzKSB7XG4gICAgICAgIGZvciAobGV0IGdyb3VwIG9mIGF3YWl0IHJlZ3JvdXBSZWN1cnNpdmUoZmlsZXMpKSB7XG4gICAgICAgICAgZ3JvdXBzMi5wdXNoKGdyb3VwKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIGdyb3VwczI7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGdyb3VwQnlTaXplKGZpbGVzOiBQZW5kaW5nRmlsZVtdKTogUGVuZGluZ0ZpbGVbXVtdIHtcbiAgbGV0IG1hcCA9IG5ldyBNYXAoKTtcbiAgZm9yIChsZXQgZmlsZSBvZiBmaWxlcykge1xuICAgIGxldCBsaXN0ID0gbWFwLmdldChmaWxlLnNpemUpO1xuICAgIGlmIChsaXN0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIG1hcC5zZXQoZmlsZS5zaXplLCBbZmlsZV0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnB1c2goZmlsZSk7XG4gICAgfVxuICB9XG4gIHJldHVybiBBcnJheS5mcm9tKG1hcC52YWx1ZXMoKSk7XG59XG4iXX0=