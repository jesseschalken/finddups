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
const MAX_CONCURRENT_REGROUPS = 100;
const PRINT_PROGRESS_DELAY_MS = 1000;
const MAX_OPEN_FILES = 2000;

async function groupFiles(files) {
  await (0, _util.printLn)('Grouping files by size');
  const groups = groupBySize(files);

  // Small files are much slower to read than big files, so shuffle the list
  // so that they are roughly evenly distributed and our time estimates are
  // more likely to be correct.
  await (0, _util.printLn)('Shuffling groups');
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
  // could exhaust our memory just by having a large enough number of files.
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9maWxlLXJlYWRlci5qcyJdLCJuYW1lcyI6WyJmcyIsIkZpbGVSZWFkZXIiLCJmaWxlcyIsImFkZCIsImZpbGUiLCJQcm9taXNlIiwicmVzb2x2ZSIsInJlamVjdCIsInBhdGgiLCJzaXplIiwicHVzaCIsInJ1biIsImdyb3VwcyIsImdyb3VwRmlsZXMiLCJncm91cCIsImNpZCIsIlJFR1JPVVBfU0laRV9CWVRFUyIsIk1BWF9DT05DVVJSRU5UX1JFR1JPVVBTIiwiUFJJTlRfUFJPR1JFU1NfREVMQVlfTVMiLCJNQVhfT1BFTl9GSUxFUyIsImdyb3VwQnlTaXplIiwicHJvZ3Jlc3MiLCJjb3VudGVyIiwiZ3JvdXBzMiIsIm1hcCIsImxlbmd0aCIsInRvdGFsIiwiaW5jIiwic3RyZWFtcyIsImFsbCIsIkZpbGVTdHJlYW0iLCJvcGVuIiwicmVncm91cFJlY3Vyc2l2ZSIsInN0cmVhbSIsImNsb3NlIiwiZGVjIiwicHJpbnQiLCJjbG9zZWQiLCJlb2YiLCJkb25lIiwiT3BlbkZpbGVzQ291bnRlciIsInNlbGYiLCJmZCIsImdldCIsInJlYWQiLCJNYXRoIiwibWluIiwiYnVmZmVyIiwicmVncm91cCIsImdldEdyb3VwIiwiYnl0ZXMiLCJlcXVhbHMiLCJyZWFkU2l6ZSIsImNlaWwiLCJldmVyeSIsIk1hcCIsImxpc3QiLCJ1bmRlZmluZWQiLCJzZXQiLCJBcnJheSIsImZyb20iLCJ2YWx1ZXMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFFQTs7QUFDQTs7SUFBWUEsRTs7QUFDWjs7QUFDQTs7OztBQWdCTyxNQUFNQyxVQUFOLENBQWlCO0FBQUE7QUFBQSxTQUN0QkMsS0FEc0IsR0FDQyxFQUREO0FBQUE7O0FBR3RCO0FBQ0FDLE1BQUlDLElBQUosRUFBaUM7QUFDL0I7QUFDQTtBQUNBLFdBQU8sSUFBSUMsT0FBSixDQUFZLENBQUNDLE9BQUQsRUFBVUMsTUFBVixLQUFxQjtBQUN0QyxVQUFJLEVBQUNDLElBQUQsRUFBT0MsSUFBUCxLQUFlTCxJQUFu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Q0EsUUFBSVUsU0FBUyxNQUFNb0MsUUFBUTlDLEtBQVIsQ0FBbkI7QUFDQSxRQUFJVSxPQUFPYSxNQUFQLEtBQWtCLENBQXRCLEVBQXlCO0FBQ3ZCO0FBQ0EsYUFBT08saUJBQWlCcEIsT0FBTyxDQUFQLENBQWpCLENBQVA7QUFDRCxLQUhELE1BR087QUFDTCxVQUFJVyxVQUFVLEVBQWQ7QUFDQTtBQUNBO0FBQ0E7QUFDQSxXQUFLLElBQUlyQixLQUFULElBQWtCVSxNQUFsQixFQUEwQjtBQUN4QixhQUFLLElBQUlFLEtBQVQsSUFBa0IsTUFBTWtCLGlCQUFpQjlCLEtBQWpCLENBQXhCLEVBQWlEO0FBQy9DcUIsa0JBQVFiLElBQVIsQ0FBYUksS0FBYjtBQUNEO0FBQ0Y7QUFDRCxhQUFPUyxPQUFQO0FBQ0Q7QUFDRjtBQUNGOztBQUVELFNBQVNILFdBQVQsQ0FBcUJsQixLQUFyQixFQUE0RDtBQUMxRCxNQUFJc0IsTUFBTSxJQUFJK0IsR0FBSixFQUFWO0FBQ0EsT0FBSyxJQUFJbkQsSUFBVCxJQUFpQkYsS0FBakIsRUFBd0I7QUFDdEIsUUFBSXNELE9BQU9oQyxJQUFJbUIsR0FBSixDQUFRdkMsS0FBS0ssSUFBYixDQUFYO0FBQ0EsUUFBSStDLFNBQVNDLFNBQWIsRUFBd0I7QUFDdEJqQyxVQUFJa0MsR0FBSixDQUFRdEQsS0FBS0ssSUFBYixFQUFtQixDQUFDTCxJQUFELENBQW5CO0FBQ0QsS0FGRCxNQUVPO0FBQ0xvRCxXQUFLOUMsSUFBTCxDQUFVTixJQUFWO0FBQ0Q7QUFDRjtBQUNELFNBQU91RCxNQUFNQyxJQUFOLENBQVdwQyxJQUFJcUMsTUFBSixFQUFYLENBQVA7QUFDRCIsImZpbGUiOiJmaWxlLXJlYWRlci5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8vIEBmbG93XG5cbmltcG9ydCB7UGF0aCwgTm9kZX0gZnJvbSAnLi9zY2FubmluZyc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICcuL3Byb21pc2VfZnMnO1xuaW1wb3J0IHtQcm9ncmVzc30gZnJvbSAnLi9wcm9ncmVzcyc7XG5pbXBvcnQge1xuICBBc3luY0NhcCxcbiAgbmV3Q2lkLFxuICBwcmludExuLFxuICBzaHVmZmxlLFxuICBzdW0sXG4gIHRyYWNrUHJvZ3Jlc3MsXG4gIHdhaXRBbGwsXG59IGZyb20gJy4vdXRpbCc7XG5pbXBvcnQgdHlwZSB7UGVuZGluZ1Byb21pc2V9IGZyb20gJy4vdXRpbCc7XG5cbmludGVyZmFjZSBQZW5kaW5nRmlsZSBleHRlbmRzIFBlbmRpbmdQcm9taXNlPG51bWJlcj4ge1xuICArcGF0aDogUGF0aDtcbiAgK3NpemU6IG51bWJlcjtcbn1cblxuZXhwb3J0IGNsYXNzIEZpbGVSZWFkZXIge1xuICBmaWxlczogUGVuZGluZ0ZpbGVbXSA9IFtdO1xuXG4gIC8vIG5vaW5zcGVjdGlvbiBKU1VudXNlZEdsb2JhbFN5bWJvbHNcbiAgYWRkKGZpbGU6IE5vZGUpOiBQcm9taXNlPG51bWJlcj4ge1xuICAgIC8vIGBuZXcgUHJvbWlzZShjYilgIGV4ZWN1dGVzIGBjYmAgc3luY2hyb25vdXNseSwgc28gb25jZSB0aGlzIG1ldGhvZFxuICAgIC8vIGZpbmlzaGVzIHdlIGtub3cgdGhlIGZpbGUgaGFzIGJlZW4gYWRkZWQgdG8gYHRoaXMuZmlsZXNgLlxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBsZXQge3BhdGgsIHNpemV9ID0gZmlsZTtcbiAgICAgIHRoaXMuZmlsZXMucHVzaCh7cGF0aCwgc2l6ZSwgcmVzb2x2ZSwgcmVqZWN0fSk7XG4gICAgfSk7XG4gIH1cblxuICBhc3luYyBydW4oKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgLy8gR3JvdXAgb3VyIGZpbGVzIHRvZ2V0aGVyXG4gICAgbGV0IGdyb3VwcyA9IGF3YWl0IGdyb3VwRmlsZXModGhpcy5maWxlcyk7XG4gICAgLy8gQW5kIHJlc29sdmUgdGhlIGdyb3VwIG51bWJlciBmb3IgZWFjaCBmaWxlIGJhc2VkIG9uIHRoZSBncm91cCBpdHMgaW5cbiAgICBmb3IgKGxldCBncm91cCBvZiBncm91cHMpIHtcbiAgICAgIGxldCBjaWQgPSBuZXdDaWQoKTtcbiAgICAgIGZvciAobGV0IGZpbGUgb2YgZ3JvdXApIHtcbiAgICAgICAgZmlsZS5yZXNvbHZlKGNpZCk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmNvbnN0IFJFR1JPVVBfU0laRV9CWVRFUyA9IDEwICogMTAyNCAqIDEwMjQ7XG5jb25zdCBNQVhfQ09OQ1VSUkVOVF9SRUdST1VQUyA9IDEwMDtcbmNvbnN0IFBSSU5UX1BST0dSRVNTX0RFTEFZX01TID0gMTAwMDtcbmNvbnN0IE1BWF9PUEVOX0ZJTEVTID0gMjAwMDtcblxuYXN5bmMgZnVuY3Rpb24gZ3JvdXBGaWxlcyhmaWxlczogUGVuZGluZ0ZpbGVbXSk6IFByb21pc2U8UGVuZGluZ0ZpbGVbXVtdPiB7XG4gIGF3YWl0IHByaW50TG4oJ0dyb3VwaW5nIGZpbGVzIGJ5IHNpemUnKTtcbiAgY29uc3QgZ3JvdXBzID0gZ3JvdXBCeVNpemUoZmlsZXMpO1xuXG4gIC8vIFNtYWxsIGZpbGVzIGFyZSBtdWNoIHNsb3dlciB0byByZWFkIHRoYW4gYmlnIGZpbGVzLCBzbyBzaHVmZmxlIHRoZSBsaXN0XG4gIC8vIHNvIHRoYXQgdGhleSBhcmUgcm91Z2hseSBldmVubHkgZGlzdHJpYnV0ZWQgYW5kIG91ciB0aW1lIGVzdGltYXRlcyBhcmVcbiAgLy8gbW9yZSBsaWtlbHkgdG8gYmUgY29ycmVjdC5cbiAgYXdhaXQgcHJpbnRMbignU2h1ZmZsaW5nIGdyb3VwcycpO1xuICBzaHVmZmxlKGdyb3Vwcyk7XG5cbiAgYXdhaXQgcHJpbnRMbignUmVhZGluZyBmaWxlIGRhdGEgb2YgcG90ZW50aWFsIGR1cGxpY2F0ZXMnKTtcbiAgbGV0IHByb2dyZXNzID0gbmV3IFByb2dyZXNzKCk7XG4gIGxldCBjb3VudGVyID0gbmV3IEFzeW5jQ2FwKE1BWF9DT05DVVJSRU5UX1JFR1JPVVBTKTtcbiAgbGV0IGdyb3VwczIgPSBbXTtcbiAgYXdhaXQgdHJhY2tQcm9ncmVzcyhcbiAgICAoKSA9PlxuICAgICAgd2FpdEFsbChcbiAgICAgICAgZ3JvdXBzLm1hcChhc3luYyBncm91cCA9PiB7XG4gICAgICAgICAgaWYgKGdyb3VwLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgIHByb2dyZXNzLnRvdGFsICs9IHN1bShncm91cCwgZmlsZSA9PiBmaWxlLnNpemUpO1xuICAgICAgICAgICAgYXdhaXQgY291bnRlci5pbmMoKTtcbiAgICAgICAgICAgIC8vIE9wZW4gYWxsIHRoZSBmaWxlcyBpbiB0aGUgZ3JvdXBcbiAgICAgICAgICAgIGxldCBzdHJlYW1zID0gYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgICAgICAgICAgIGdyb3VwLm1hcChmaWxlID0+IEZpbGVTdHJlYW0ub3BlbihmaWxlLCBwcm9ncmVzcykpLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIC8vIFByb2dyZXNzaXZlbHkgcmVhZCB0aGUgZmlsZXMgdG8gcmVncm91cCB0aGVtXG4gICAgICAgICAgICBmb3IgKGxldCBncm91cCBvZiBhd2FpdCByZWdyb3VwUmVjdXJzaXZlKHN0cmVhbXMpKSB7XG4gICAgICAgICAgICAgIGdyb3VwczIucHVzaChncm91cC5tYXAoc3RyZWFtID0+IHN0cmVhbS5maWxlKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBDbG9zZSBhbGwgdGhlIGZpbGVzXG4gICAgICAgICAgICBhd2FpdCB3YWl0QWxsKHN0cmVhbXMubWFwKHN0cmVhbSA9PiBzdHJlYW0uY2xvc2UoKSkpO1xuICAgICAgICAgICAgY291bnRlci5kZWMoKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZ3JvdXBzMi5wdXNoKGdyb3VwKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pLFxuICAgICAgKSxcbiAgICAoKSA9PiBwcm9ncmVzcy5wcmludCgpLFxuICAgIFBSSU5UX1BST0dSRVNTX0RFTEFZX01TLFxuICApO1xuICByZXR1cm4gZ3JvdXBzMjtcbn1cblxuY2xhc3MgRmlsZVN0cmVhbSB7XG4gIHN0YXRpYyBPcGVuRmlsZXNDb3VudGVyOiBBc3luY0NhcCA9IG5ldyBBc3luY0NhcChNQVhfT1BFTl9GSUxFUyk7XG5cbiAgc3RhdGljIGFzeW5jIG9wZW4oXG4gICAgZmlsZTogUGVuZGluZ0ZpbGUsXG4gICAgcHJvZ3Jlc3M6IFByb2dyZXNzLFxuICApOiBQcm9taXNlPEZpbGVTdHJlYW0+IHtcbiAgICBhd2FpdCBGaWxlU3RyZWFtLk9wZW5GaWxlc0NvdW50ZXIuaW5jKCk7XG5cbiAgICBsZXQgc2VsZiA9IG5ldyBGaWxlU3RyZWFtKCk7XG4gICAgc2VsZi5mZCA9IGF3YWl0IGZzLm9wZW4oZmlsZS5wYXRoLmdldCgpLCAncicpO1xuICAgIHNlbGYucHJvZ3Jlc3MgPSBwcm9ncmVzcztcbiAgICBzZWxmLmZpbGUgPSBmaWxlO1xuICAgIHJldHVybiBzZWxmO1xuICB9XG5cbiAgY2xvc2VkOiBib29sZWFuID0gZmFsc2U7XG4gIGVvZjogYm9vbGVhbiA9IGZhbHNlO1xuICBmZDogbnVtYmVyO1xuICBmaWxlOiBQZW5kaW5nRmlsZTtcbiAgcHJvZ3Jlc3M6IFByb2dyZXNzO1xuICBkb25lOiBudW1iZXIgPSAwO1xuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGV4YWN0bHkgdGhlIG5leHQgYGxlbmd0aGAgYnl0ZXMsIG9yIGZld2VyIGlmIGVuZC1vZi1maWxlIGlzXG4gICAqIHJlYWNoZWQuXG4gICAqL1xuICBhc3luYyByZWFkKGxlbmd0aDogbnVtYmVyKTogUHJvbWlzZTxCdWZmZXI+IHtcbiAgICAvLyBEb24ndCBib3RoZXIgYWxsb2NhdGluZyBhIGJ1ZmZlciBiaWdnZXIgdGhhbiB0aGUgcmVtYWluZGVyIG9mIHRoZSBmaWxlXG4gICAgbGVuZ3RoID0gTWF0aC5taW4obGVuZ3RoLCB0aGlzLmZpbGUuc2l6ZSAtIHRoaXMuZG9uZSk7XG5cbiAgICBsZXQgYnVmZmVyID0gYXdhaXQgZnMucmVhZCh0aGlzLmZkLCBsZW5ndGgpO1xuXG4gICAgaWYgKGJ1ZmZlci5sZW5ndGggPT09IDApIHtcbiAgICAgIHRoaXMuZW9mID0gdHJ1ZTtcbiAgICAgIC8vIE1pZ2h0IGFzIHdlbGwgY2xvc2UgdGhlIGZpbGUgaGFuZGxlIG9mZiBhcyBzb29uIGFzIHBvc3NpYmxlIHRvIGZyZWVcbiAgICAgIC8vIHVwIHRoZSBvcGVuIGZpbGUgaGFuZGxlIGNvdW50LlxuICAgICAgYXdhaXQgdGhpcy5jbG9zZSgpO1xuICAgIH1cbiAgICB0aGlzLmRvbmUgKz0gYnVmZmVyLmxlbmd0aDtcbiAgICB0aGlzLnByb2dyZXNzLmRvbmUgKz0gYnVmZmVyLmxlbmd0aDtcblxuICAgIHJldHVybiBidWZmZXI7XG4gIH1cblxuICAvLyBub2luc3BlY3Rpb24gSlNVbnVzZWRHbG9iYWxTeW1ib2xzXG4gIGFzeW5jIGNsb3NlKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmICghdGhpcy5jbG9zZWQpIHtcbiAgICAgIHRoaXMuY2xvc2VkID0gdHJ1ZTtcbiAgICAgIGF3YWl0IGZzLmNsb3NlKHRoaXMuZmQpO1xuXG4gICAgICAvLyBSZW1vdmUgYW55IGJ5dGVzIHdlIGRpZG4ndCByZWFkIGZyb20gdGhlIHByb2dyZXNzIGJhclxuICAgICAgdGhpcy5wcm9ncmVzcy50b3RhbCAtPSB0aGlzLmZpbGUuc2l6ZSAtIHRoaXMuZG9uZTtcblxuICAgICAgRmlsZVN0cmVhbS5PcGVuRmlsZXNDb3VudGVyLmRlYygpO1xuICAgIH1cbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiByZWdyb3VwKGZpbGVzOiBGaWxlU3RyZWFtW10pOiBQcm9taXNlPEZpbGVTdHJlYW1bXVtdPiB7XG4gIGxldCBncm91cHMgPSBbXTtcbiAgZnVuY3Rpb24gZ2V0R3JvdXAoYnl0ZXMpIHtcbiAgICBmb3IgKGxldCBncm91cCBvZiBncm91cHMpIHtcbiAgICAgIGlmIChncm91cC5ieXRlcy5lcXVhbHMoYnl0ZXMpKSB7XG4gICAgICAgIHJldHVybiBncm91cDtcbiAgICAgIH1cbiAgICB9XG4gICAgbGV0IGdyb3VwID0ge2J5dGVzLCBmaWxlczogW119O1xuICAgIGdyb3Vwcy5wdXNoKGdyb3VwKTtcbiAgICByZXR1cm4gZ3JvdXA7XG4gIH1cbiAgLy8gRGl2aWRlIHRoZSByZWdyb3VwIHNpemUgYnkgdGhlIG51bWJlciBvZiBmaWxlcyB3ZSBoYXZlLCBvdGhlcndpc2Ugd2VcbiAgLy8gY291bGQgZXhoYXVzdCBvdXIgbWVtb3J5IGp1c3QgYnkgaGF2aW5nIGEgbGFyZ2UgZW5vdWdoIG51bWJlciBvZiBmaWxlcy5cbiAgY29uc3QgcmVhZFNpemUgPSBNYXRoLmNlaWwoUkVHUk9VUF9TSVpFX0JZVEVTIC8gZmlsZXMubGVuZ3RoKTtcbiAgLy8gRm9yIGVhY2ggZmlsZSwgaW4gcGFyYWxsZWwsIHJlYWQgdGhlIG5leHQgcmVhZFNpemUgYnl0ZXMgYW5kIGFkZFxuICAvLyB0aGUgZmlsZSB0byB0aGUgZ3JvdXAgZm9yIHRob3NlIGJ5dGVzXG4gIGF3YWl0IHdhaXRBbGwoXG4gICAgZmlsZXMubWFwKGFzeW5jIGZpbGUgPT4ge1xuICAgICAgbGV0IGJ5dGVzID0gYXdhaXQgZmlsZS5yZWFkKHJlYWRTaXplKTtcbiAgICAgIGxldCBncm91cCA9IGdldEdyb3VwKGJ5dGVzKTtcbiAgICAgIGdyb3VwLmZpbGVzLnB1c2goZmlsZSk7XG4gICAgfSksXG4gICk7XG4gIC8vIFJldHVybiB0aGUgZmlsZXMgZnJvbSBlYWNoIGdyb3VwXG4gIHJldHVybiBncm91cHMubWFwKGdyb3VwID0+IGdyb3VwLmZpbGVzKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gcmVncm91cFJlY3Vyc2l2ZShmaWxlczogRmlsZVN0cmVhbVtdKTogUHJvbWlzZTxGaWxlU3RyZWFtW11bXT4ge1xuICBpZiAoZmlsZXMubGVuZ3RoID09PSAwKSB7XG4gICAgLy8gTm90IHN1cmUgd2h5IHdlIHdlcmUgZ2l2ZW4gYW4gZW1wdHkgZ3JvdXAgYnV0IHdoYXRldmVyXG4gICAgcmV0dXJuIFtdO1xuICB9IGVsc2UgaWYgKGZpbGVzLmxlbmd0aCA9PT0gMSB8fCBmaWxlcy5ldmVyeShmaWxlID0+IGZpbGUuZW9mKSkge1xuICAgIC8vIFRlcm1pbmFsIGNhc2UuIEEgZ3JvdXAgd2l0aCBvbmx5IG9uZSBlbGVtZW50IGluIGl0IG9yIHdoZXJlIGV2ZXJ5XG4gICAgLy8gZmlsZSBoYXMgcmVhY2hlZCBFT0YgaXMgZmluaXNoZWQuIENsb3NlIHRoZW0gb2ZmIGFuZCByZXR1cm4gdGhlXG4gICAgLy8gZ3JvdXAgYmFjay4gQ2xvc2UgYWxsIHRoZSBmaWxlcyBpbiBwYXJhbGxlbC5cbiAgICBhd2FpdCB3YWl0QWxsKGZpbGVzLm1hcChmaWxlID0+IGZpbGUuY2xvc2UoKSkpO1xuICAgIHJldHVybiBbZmlsZXNdO1xuICB9IGVsc2Uge1xuICAgIC8vIElmIHRoZSBncm91cCBoYXMgbXVsdGlwbGUgZmlsZXMgaW4gaXQgYW5kIHRoZXkgYXJlIG5vdCBhdCBFT0YgdGhlblxuICAgIC8vIHdlIG5lZWQgdG8gcmVhZCBtb3JlIG9mIHRoZSBmaWxlcyB0byBkZXRlcm1pbmUgaWYgdGhleSBhcmUgYWN0dWFsXG4gICAgLy8gZHVwbGljYXRlcy4gUmVncm91cCB0aGUgZmlsZXMgYmFzZWQgb24gdGhlIG5leHQgc2V0IG9mIGJ5dGVzIGFuZFxuICAgIC8vIHJlY3Vyc2Ugb24gdGhlIG5ldyBncm91cHMuXG4gICAgbGV0IGdyb3VwcyA9IGF3YWl0IHJlZ3JvdXAoZmlsZXMpO1xuICAgIGlmIChncm91cHMubGVuZ3RoID09PSAxKSB7XG4gICAgICAvLyBUYWlsIGNhbGwgc28gb3VyIHN0YWNrIGRvZXNuJ3QgZ3JvdyBmb3JldmVyXG4gICAgICByZXR1cm4gcmVncm91cFJlY3Vyc2l2ZShncm91cHNbMF0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBsZXQgZ3JvdXBzMiA9IFtdO1xuICAgICAgLy8gSXQgaXMgaW1wb3J0YW50IHRoYXQgd2UgZG9uJ3QgZG8gdGhlIHJlZ3JvdXBpbmcgaGVyZSBpbiBwYXJhbGxlbCxcbiAgICAgIC8vIG90aGVyd2lzZSB0aGUgZGlzayByZWFkIHJlcXVlc3RzIHdpbGwgcGluZyBwb25nIGJldHdlZW4gZGlmZmVyZW50XG4gICAgICAvLyBncm91cHMgd2hpY2ggaXNuJ3QgbmljZSBvbiB0aGUgZGlzayBjYWNoZS5cbiAgICAgIGZvciAobGV0IGZpbGVzIG9mIGdyb3Vwcykge1xuICAgICAgICBmb3IgKGxldCBncm91cCBvZiBhd2FpdCByZWdyb3VwUmVjdXJzaXZlKGZpbGVzKSkge1xuICAgICAgICAgIGdyb3VwczIucHVzaChncm91cCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBncm91cHMyO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBncm91cEJ5U2l6ZShmaWxlczogUGVuZGluZ0ZpbGVbXSk6IFBlbmRpbmdGaWxlW11bXSB7XG4gIGxldCBtYXAgPSBuZXcgTWFwKCk7XG4gIGZvciAobGV0IGZpbGUgb2YgZmlsZXMpIHtcbiAgICBsZXQgbGlzdCA9IG1hcC5nZXQoZmlsZS5zaXplKTtcbiAgICBpZiAobGlzdCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBtYXAuc2V0KGZpbGUuc2l6ZSwgW2ZpbGVdKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdC5wdXNoKGZpbGUpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gQXJyYXkuZnJvbShtYXAudmFsdWVzKCkpO1xufVxuIl19