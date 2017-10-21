'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.FileReader = undefined;

var _scanning = require('./scanning');

var _fs = require('fs');

var fs = _interopRequireWildcard(_fs);

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
    self.fd = await new Promise((resolve, reject) => {
      fs.open(file.path.get(), 'r', (err, fd) => {
        err ? reject(err) : resolve(fd);
      });
    });
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

    let buffer = Buffer.allocUnsafe(length);
    let bytesRead = await new Promise((resolve, reject) => {
      // noinspection JSIgnoredPromiseFromCall
      fs.read(this.fd, buffer, 0, length, null, (err, bytesRead) => {
        err ? reject(err) : resolve(bytesRead);
      });
    });

    if (bytesRead === 0) {
      this.eof = bytesRead === 0;
      // Might as well close the file handle off as soon as possible to free
      // up the open file handle count.
      await this.close();
    }
    this.done += bytesRead;
    this.progress.done += bytesRead;

    return buffer.slice(0, bytesRead);
  }

  // noinspection JSUnusedGlobalSymbols
  async close() {
    if (!this.closed) {
      this.closed = true;
      await new Promise((resolve, reject) => {
        fs.close(this.fd, err => {
          err ? reject(err) : resolve();
        });
      });

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9maWxlLXJlYWRlci5qcyJdLCJuYW1lcyI6WyJmcyIsIkZpbGVSZWFkZXIiLCJmaWxlcyIsImFkZCIsImZpbGUiLCJQcm9taXNlIiwicmVzb2x2ZSIsInJlamVjdCIsInBhdGgiLCJzaXplIiwicHVzaCIsInJ1biIsImdyb3VwcyIsImdyb3VwRmlsZXMiLCJncm91cCIsImNpZCIsIlJFR1JPVVBfU0laRV9CWVRFUyIsIk1BWF9DT05DVVJSRU5UX1JFR1JPVVBTIiwiUFJJTlRfUFJPR1JFU1NfREVMQVlfTVMiLCJNQVhfT1BFTl9GSUxFUyIsImdyb3VwQnlTaXplIiwicHJvZ3Jlc3MiLCJjb3VudGVyIiwiZ3JvdXBzMiIsIm1hcCIsImxlbmd0aCIsInRvdGFsIiwiaW5jIiwic3RyZWFtcyIsImFsbCIsIkZpbGVTdHJlYW0iLCJvcGVuIiwicmVncm91cFJlY3Vyc2l2ZSIsInN0cmVhbSIsImNsb3NlIiwiZGVjIiwicHJpbnQiLCJjbG9zZWQiLCJlb2YiLCJkb25lIiwiT3BlbkZpbGVzQ291bnRlciIsInNlbGYiLCJmZCIsImdldCIsImVyciIsInJlYWQiLCJNYXRoIiwibWluIiwiYnVmZmVyIiwiQnVmZmVyIiwiYWxsb2NVbnNhZmUiLCJieXRlc1JlYWQiLCJzbGljZSIsInJlZ3JvdXAiLCJnZXRHcm91cCIsImJ5dGVzIiwiZXF1YWxzIiwicmVhZFNpemUiLCJjZWlsIiwiZXZlcnkiLCJNYXAiLCJsaXN0IiwidW5kZWZpbmVkIiwic2V0IiwiQXJyYXkiLCJmcm9tIiwidmFsdWVzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7O0FBRUE7O0FBQ0E7O0lBQVlBLEU7O0FBQ1o7O0FBQ0E7Ozs7QUFnQk8sTUFBTUMsVUFBTixDQUFpQjtBQUFBO0FBQUEsU0FDdEJDLEtBRHNCLEdBQ0MsRUFERDtBQUFBOztBQUd0QjtBQUNBQyxNQUFJQyxJQUFKLEVBQWlDO0FBQy9CO0FBQ0E7QUFDQSxXQUFPLElBQUlDLE9BQUosQ0FBWSxDQUFDQyxPQUFELEVBQVVDLE1BQVYs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QVIsQ0FBYUksS0FBYjtBQUNEO0FBQ0Y7QUFDRCxhQUFPUyxPQUFQO0FBQ0Q7QUFDRjtBQUNGOztBQUVELFNBQVNILFdBQVQsQ0FBcUJsQixLQUFyQixFQUE0RDtBQUMxRCxNQUFJc0IsTUFBTSxJQUFJb0MsR0FBSixFQUFWO0FBQ0EsT0FBSyxJQUFJeEQsSUFBVCxJQUFpQkYsS0FBakIsRUFBd0I7QUFDdEIsUUFBSTJELE9BQU9yQyxJQUFJbUIsR0FBSixDQUFRdkMsS0FBS0ssSUFBYixDQUFYO0FBQ0EsUUFBSW9ELFNBQVNDLFNBQWIsRUFBd0I7QUFDdEJ0QyxVQUFJdUMsR0FBSixDQUFRM0QsS0FBS0ssSUFBYixFQUFtQixDQUFDTCxJQUFELENBQW5CO0FBQ0QsS0FGRCxNQUVPO0FBQ0x5RCxXQUFLbkQsSUFBTCxDQUFVTixJQUFWO0FBQ0Q7QUFDRjtBQUNELFNBQU80RCxNQUFNQyxJQUFOLENBQVd6QyxJQUFJMEMsTUFBSixFQUFYLENBQVA7QUFDRCIsImZpbGUiOiJmaWxlLXJlYWRlci5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8vIEBmbG93XG5cbmltcG9ydCB7UGF0aCwgTm9kZX0gZnJvbSAnLi9zY2FubmluZyc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQge1Byb2dyZXNzfSBmcm9tICcuL3Byb2dyZXNzJztcbmltcG9ydCB7XG4gIEFzeW5jQ2FwLFxuICBuZXdDaWQsXG4gIHByaW50TG4sXG4gIHNodWZmbGUsXG4gIHN1bSxcbiAgdHJhY2tQcm9ncmVzcyxcbiAgd2FpdEFsbCxcbn0gZnJvbSAnLi91dGlsJztcbmltcG9ydCB0eXBlIHtQZW5kaW5nUHJvbWlzZX0gZnJvbSAnLi91dGlsJztcblxuaW50ZXJmYWNlIFBlbmRpbmdGaWxlIGV4dGVuZHMgUGVuZGluZ1Byb21pc2U8bnVtYmVyPiB7XG4gICtwYXRoOiBQYXRoO1xuICArc2l6ZTogbnVtYmVyO1xufVxuXG5leHBvcnQgY2xhc3MgRmlsZVJlYWRlciB7XG4gIGZpbGVzOiBQZW5kaW5nRmlsZVtdID0gW107XG5cbiAgLy8gbm9pbnNwZWN0aW9uIEpTVW51c2VkR2xvYmFsU3ltYm9sc1xuICBhZGQoZmlsZTogTm9kZSk6IFByb21pc2U8bnVtYmVyPiB7XG4gICAgLy8gYG5ldyBQcm9taXNlKGNiKWAgZXhlY3V0ZXMgYGNiYCBzeW5jaHJvbm91c2x5LCBzbyBvbmNlIHRoaXMgbWV0aG9kXG4gICAgLy8gZmluaXNoZXMgd2Uga25vdyB0aGUgZmlsZSBoYXMgYmVlbiBhZGRlZCB0byBgdGhpcy5maWxlc2AuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGxldCB7cGF0aCwgc2l6ZX0gPSBmaWxlO1xuICAgICAgdGhpcy5maWxlcy5wdXNoKHtwYXRoLCBzaXplLCByZXNvbHZlLCByZWplY3R9KTtcbiAgICB9KTtcbiAgfVxuXG4gIGFzeW5jIHJ1bigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAvLyBHcm91cCBvdXIgZmlsZXMgdG9nZXRoZXJcbiAgICBsZXQgZ3JvdXBzID0gYXdhaXQgZ3JvdXBGaWxlcyh0aGlzLmZpbGVzKTtcbiAgICAvLyBBbmQgcmVzb2x2ZSB0aGUgZ3JvdXAgbnVtYmVyIGZvciBlYWNoIGZpbGUgYmFzZWQgb24gdGhlIGdyb3VwIGl0cyBpblxuICAgIGZvciAobGV0IGdyb3VwIG9mIGdyb3Vwcykge1xuICAgICAgbGV0IGNpZCA9IG5ld0NpZCgpO1xuICAgICAgZm9yIChsZXQgZmlsZSBvZiBncm91cCkge1xuICAgICAgICBmaWxlLnJlc29sdmUoY2lkKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuY29uc3QgUkVHUk9VUF9TSVpFX0JZVEVTID0gMTAgKiAxMDI0ICogMTAyNDtcbmNvbnN0IE1BWF9DT05DVVJSRU5UX1JFR1JPVVBTID0gMTAwO1xuY29uc3QgUFJJTlRfUFJPR1JFU1NfREVMQVlfTVMgPSAxMDAwO1xuY29uc3QgTUFYX09QRU5fRklMRVMgPSAyMDAwO1xuXG5hc3luYyBmdW5jdGlvbiBncm91cEZpbGVzKGZpbGVzOiBQZW5kaW5nRmlsZVtdKTogUHJvbWlzZTxQZW5kaW5nRmlsZVtdW10+IHtcbiAgYXdhaXQgcHJpbnRMbignR3JvdXBpbmcgZmlsZXMgYnkgc2l6ZScpO1xuICBjb25zdCBncm91cHMgPSBncm91cEJ5U2l6ZShmaWxlcyk7XG5cbiAgLy8gU21hbGwgZmlsZXMgYXJlIG11Y2ggc2xvd2VyIHRvIHJlYWQgdGhhbiBiaWcgZmlsZXMsIHNvIHNodWZmbGUgdGhlIGxpc3RcbiAgLy8gc28gdGhhdCB0aGV5IGFyZSByb3VnaGx5IGV2ZW5seSBkaXN0cmlidXRlZCBhbmQgb3VyIHRpbWUgZXN0aW1hdGVzIGFyZVxuICAvLyBtb3JlIGxpa2VseSB0byBiZSBjb3JyZWN0LlxuICBhd2FpdCBwcmludExuKCdTaHVmZmxpbmcgZ3JvdXBzJyk7XG4gIHNodWZmbGUoZ3JvdXBzKTtcblxuICBhd2FpdCBwcmludExuKCdSZWFkaW5nIGZpbGUgZGF0YSBvZiBwb3RlbnRpYWwgZHVwbGljYXRlcycpO1xuICBsZXQgcHJvZ3Jlc3MgPSBuZXcgUHJvZ3Jlc3MoKTtcbiAgbGV0IGNvdW50ZXIgPSBuZXcgQXN5bmNDYXAoTUFYX0NPTkNVUlJFTlRfUkVHUk9VUFMpO1xuICBsZXQgZ3JvdXBzMiA9IFtdO1xuICBhd2FpdCB0cmFja1Byb2dyZXNzKFxuICAgICgpID0+XG4gICAgICB3YWl0QWxsKFxuICAgICAgICBncm91cHMubWFwKGFzeW5jIGdyb3VwID0+IHtcbiAgICAgICAgICBpZiAoZ3JvdXAubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgcHJvZ3Jlc3MudG90YWwgKz0gc3VtKGdyb3VwLCBmaWxlID0+IGZpbGUuc2l6ZSk7XG4gICAgICAgICAgICBhd2FpdCBjb3VudGVyLmluYygpO1xuICAgICAgICAgICAgLy8gT3BlbiBhbGwgdGhlIGZpbGVzIGluIHRoZSBncm91cFxuICAgICAgICAgICAgbGV0IHN0cmVhbXMgPSBhd2FpdCBQcm9taXNlLmFsbChcbiAgICAgICAgICAgICAgZ3JvdXAubWFwKGZpbGUgPT4gRmlsZVN0cmVhbS5vcGVuKGZpbGUsIHByb2dyZXNzKSksXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgLy8gUHJvZ3Jlc3NpdmVseSByZWFkIHRoZSBmaWxlcyB0byByZWdyb3VwIHRoZW1cbiAgICAgICAgICAgIGZvciAobGV0IGdyb3VwIG9mIGF3YWl0IHJlZ3JvdXBSZWN1cnNpdmUoc3RyZWFtcykpIHtcbiAgICAgICAgICAgICAgZ3JvdXBzMi5wdXNoKGdyb3VwLm1hcChzdHJlYW0gPT4gc3RyZWFtLmZpbGUpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIENsb3NlIGFsbCB0aGUgZmlsZXNcbiAgICAgICAgICAgIGF3YWl0IHdhaXRBbGwoc3RyZWFtcy5tYXAoc3RyZWFtID0+IHN0cmVhbS5jbG9zZSgpKSk7XG4gICAgICAgICAgICBjb3VudGVyLmRlYygpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBncm91cHMyLnB1c2goZ3JvdXApO1xuICAgICAgICAgIH1cbiAgICAgICAgfSksXG4gICAgICApLFxuICAgICgpID0+IHByb2dyZXNzLnByaW50KCksXG4gICAgUFJJTlRfUFJPR1JFU1NfREVMQVlfTVMsXG4gICk7XG4gIHJldHVybiBncm91cHMyO1xufVxuXG5jbGFzcyBGaWxlU3RyZWFtIHtcbiAgc3RhdGljIE9wZW5GaWxlc0NvdW50ZXIgPSBuZXcgQXN5bmNDYXAoTUFYX09QRU5fRklMRVMpO1xuXG4gIHN0YXRpYyBhc3luYyBvcGVuKFxuICAgIGZpbGU6IFBlbmRpbmdGaWxlLFxuICAgIHByb2dyZXNzOiBQcm9ncmVzcyxcbiAgKTogUHJvbWlzZTxGaWxlU3RyZWFtPiB7XG4gICAgYXdhaXQgRmlsZVN0cmVhbS5PcGVuRmlsZXNDb3VudGVyLmluYygpO1xuXG4gICAgbGV0IHNlbGYgPSBuZXcgRmlsZVN0cmVhbSgpO1xuICAgIHNlbGYuZmQgPSBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBmcy5vcGVuKGZpbGUucGF0aC5nZXQoKSwgJ3InLCAoZXJyLCBmZCkgPT4ge1xuICAgICAgICBlcnIgPyByZWplY3QoZXJyKSA6IHJlc29sdmUoZmQpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gICAgc2VsZi5wcm9ncmVzcyA9IHByb2dyZXNzO1xuICAgIHNlbGYuZmlsZSA9IGZpbGU7XG4gICAgcmV0dXJuIHNlbGY7XG4gIH1cblxuICBjbG9zZWQ6IGJvb2xlYW4gPSBmYWxzZTtcbiAgZW9mOiBib29sZWFuID0gZmFsc2U7XG4gIGZkOiBudW1iZXI7XG4gIGZpbGU6IFBlbmRpbmdGaWxlO1xuICBwcm9ncmVzczogUHJvZ3Jlc3M7XG4gIGRvbmU6IG51bWJlciA9IDA7XG5cbiAgLyoqXG4gICAqIFJldHVybnMgZXhhY3RseSB0aGUgbmV4dCBgbGVuZ3RoYCBieXRlcywgb3IgZmV3ZXIgaWYgZW5kLW9mLWZpbGUgaXNcbiAgICogcmVhY2hlZC5cbiAgICovXG4gIGFzeW5jIHJlYWQobGVuZ3RoOiBudW1iZXIpOiBQcm9taXNlPEJ1ZmZlcj4ge1xuICAgIC8vIERvbid0IGJvdGhlciBhbGxvY2F0aW5nIGEgYnVmZmVyIGJpZ2dlciB0aGFuIHRoZSByZW1haW5kZXIgb2YgdGhlIGZpbGVcbiAgICBsZW5ndGggPSBNYXRoLm1pbihsZW5ndGgsIHRoaXMuZmlsZS5zaXplIC0gdGhpcy5kb25lKTtcblxuICAgIGxldCBidWZmZXIgPSBCdWZmZXIuYWxsb2NVbnNhZmUobGVuZ3RoKTtcbiAgICBsZXQgYnl0ZXNSZWFkID0gYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgLy8gbm9pbnNwZWN0aW9uIEpTSWdub3JlZFByb21pc2VGcm9tQ2FsbFxuICAgICAgZnMucmVhZCh0aGlzLmZkLCBidWZmZXIsIDAsIGxlbmd0aCwgbnVsbCwgKGVyciwgYnl0ZXNSZWFkKSA9PiB7XG4gICAgICAgIGVyciA/IHJlamVjdChlcnIpIDogcmVzb2x2ZShieXRlc1JlYWQpO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBpZiAoYnl0ZXNSZWFkID09PSAwKSB7XG4gICAgICB0aGlzLmVvZiA9IGJ5dGVzUmVhZCA9PT0gMDtcbiAgICAgIC8vIE1pZ2h0IGFzIHdlbGwgY2xvc2UgdGhlIGZpbGUgaGFuZGxlIG9mZiBhcyBzb29uIGFzIHBvc3NpYmxlIHRvIGZyZWVcbiAgICAgIC8vIHVwIHRoZSBvcGVuIGZpbGUgaGFuZGxlIGNvdW50LlxuICAgICAgYXdhaXQgdGhpcy5jbG9zZSgpO1xuICAgIH1cbiAgICB0aGlzLmRvbmUgKz0gYnl0ZXNSZWFkO1xuICAgIHRoaXMucHJvZ3Jlc3MuZG9uZSArPSBieXRlc1JlYWQ7XG5cbiAgICByZXR1cm4gYnVmZmVyLnNsaWNlKDAsIGJ5dGVzUmVhZCk7XG4gIH1cblxuICAvLyBub2luc3BlY3Rpb24gSlNVbnVzZWRHbG9iYWxTeW1ib2xzXG4gIGFzeW5jIGNsb3NlKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmICghdGhpcy5jbG9zZWQpIHtcbiAgICAgIHRoaXMuY2xvc2VkID0gdHJ1ZTtcbiAgICAgIGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgZnMuY2xvc2UodGhpcy5mZCwgZXJyID0+IHtcbiAgICAgICAgICBlcnIgPyByZWplY3QoZXJyKSA6IHJlc29sdmUoKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgICAgLy8gUmVtb3ZlIGFueSBieXRlcyB3ZSBkaWRuJ3QgcmVhZCBmcm9tIHRoZSBwcm9ncmVzcyBiYXJcbiAgICAgIHRoaXMucHJvZ3Jlc3MudG90YWwgLT0gdGhpcy5maWxlLnNpemUgLSB0aGlzLmRvbmU7XG5cbiAgICAgIEZpbGVTdHJlYW0uT3BlbkZpbGVzQ291bnRlci5kZWMoKTtcbiAgICB9XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gcmVncm91cChmaWxlczogRmlsZVN0cmVhbVtdKTogUHJvbWlzZTxGaWxlU3RyZWFtW11bXT4ge1xuICBsZXQgZ3JvdXBzID0gW107XG4gIGZ1bmN0aW9uIGdldEdyb3VwKGJ5dGVzKSB7XG4gICAgZm9yIChsZXQgZ3JvdXAgb2YgZ3JvdXBzKSB7XG4gICAgICBpZiAoZ3JvdXAuYnl0ZXMuZXF1YWxzKGJ5dGVzKSkge1xuICAgICAgICByZXR1cm4gZ3JvdXA7XG4gICAgICB9XG4gICAgfVxuICAgIGxldCBncm91cCA9IHtieXRlcywgZmlsZXM6IFtdfTtcbiAgICBncm91cHMucHVzaChncm91cCk7XG4gICAgcmV0dXJuIGdyb3VwO1xuICB9XG4gIC8vIERpdmlkZSB0aGUgcmVncm91cCBzaXplIGJ5IHRoZSBudW1iZXIgb2YgZmlsZXMgd2UgaGF2ZSwgb3RoZXJ3aXNlIHdlXG4gIC8vIGNvdWxkIGV4aGF1c3Qgb3VyIG1lbW9yeSBqdXN0IGJ5IGhhdmluZyBhIGxhcmdlIGVub3VnaCBudW1iZXIgb2YgZmlsZXMuXG4gIGNvbnN0IHJlYWRTaXplID0gTWF0aC5jZWlsKFJFR1JPVVBfU0laRV9CWVRFUyAvIGZpbGVzLmxlbmd0aCk7XG4gIC8vIEZvciBlYWNoIGZpbGUsIGluIHBhcmFsbGVsLCByZWFkIHRoZSBuZXh0IHJlYWRTaXplIGJ5dGVzIGFuZCBhZGRcbiAgLy8gdGhlIGZpbGUgdG8gdGhlIGdyb3VwIGZvciB0aG9zZSBieXRlc1xuICBhd2FpdCB3YWl0QWxsKFxuICAgIGZpbGVzLm1hcChhc3luYyBmaWxlID0+IHtcbiAgICAgIGxldCBieXRlcyA9IGF3YWl0IGZpbGUucmVhZChyZWFkU2l6ZSk7XG4gICAgICBsZXQgZ3JvdXAgPSBnZXRHcm91cChieXRlcyk7XG4gICAgICBncm91cC5maWxlcy5wdXNoKGZpbGUpO1xuICAgIH0pLFxuICApO1xuICAvLyBSZXR1cm4gdGhlIGZpbGVzIGZyb20gZWFjaCBncm91cFxuICByZXR1cm4gZ3JvdXBzLm1hcChncm91cCA9PiBncm91cC5maWxlcyk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHJlZ3JvdXBSZWN1cnNpdmUoZmlsZXM6IEZpbGVTdHJlYW1bXSk6IFByb21pc2U8RmlsZVN0cmVhbVtdW10+IHtcbiAgaWYgKGZpbGVzLmxlbmd0aCA9PT0gMCkge1xuICAgIC8vIE5vdCBzdXJlIHdoeSB3ZSB3ZXJlIGdpdmVuIGFuIGVtcHR5IGdyb3VwIGJ1dCB3aGF0ZXZlclxuICAgIHJldHVybiBbXTtcbiAgfSBlbHNlIGlmIChmaWxlcy5sZW5ndGggPT09IDEgfHwgZmlsZXMuZXZlcnkoZmlsZSA9PiBmaWxlLmVvZikpIHtcbiAgICAvLyBUZXJtaW5hbCBjYXNlLiBBIGdyb3VwIHdpdGggb25seSBvbmUgZWxlbWVudCBpbiBpdCBvciB3aGVyZSBldmVyeVxuICAgIC8vIGZpbGUgaGFzIHJlYWNoZWQgRU9GIGlzIGZpbmlzaGVkLiBDbG9zZSB0aGVtIG9mZiBhbmQgcmV0dXJuIHRoZVxuICAgIC8vIGdyb3VwIGJhY2suIENsb3NlIGFsbCB0aGUgZmlsZXMgaW4gcGFyYWxsZWwuXG4gICAgYXdhaXQgd2FpdEFsbChmaWxlcy5tYXAoZmlsZSA9PiBmaWxlLmNsb3NlKCkpKTtcbiAgICByZXR1cm4gW2ZpbGVzXTtcbiAgfSBlbHNlIHtcbiAgICAvLyBJZiB0aGUgZ3JvdXAgaGFzIG11bHRpcGxlIGZpbGVzIGluIGl0IGFuZCB0aGV5IGFyZSBub3QgYXQgRU9GIHRoZW5cbiAgICAvLyB3ZSBuZWVkIHRvIHJlYWQgbW9yZSBvZiB0aGUgZmlsZXMgdG8gZGV0ZXJtaW5lIGlmIHRoZXkgYXJlIGFjdHVhbFxuICAgIC8vIGR1cGxpY2F0ZXMuIFJlZ3JvdXAgdGhlIGZpbGVzIGJhc2VkIG9uIHRoZSBuZXh0IHNldCBvZiBieXRlcyBhbmRcbiAgICAvLyByZWN1cnNlIG9uIHRoZSBuZXcgZ3JvdXBzLlxuICAgIGxldCBncm91cHMgPSBhd2FpdCByZWdyb3VwKGZpbGVzKTtcbiAgICBpZiAoZ3JvdXBzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgLy8gVGFpbCBjYWxsIHNvIG91ciBzdGFjayBkb2Vzbid0IGdyb3cgZm9yZXZlclxuICAgICAgcmV0dXJuIHJlZ3JvdXBSZWN1cnNpdmUoZ3JvdXBzWzBdKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGV0IGdyb3VwczIgPSBbXTtcbiAgICAgIC8vIEl0IGlzIGltcG9ydGFudCB0aGF0IHdlIGRvbid0IGRvIHRoZSByZWdyb3VwaW5nIGhlcmUgaW4gcGFyYWxsZWwsXG4gICAgICAvLyBvdGhlcndpc2UgdGhlIGRpc2sgcmVhZCByZXF1ZXN0cyB3aWxsIHBpbmcgcG9uZyBiZXR3ZWVuIGRpZmZlcmVudFxuICAgICAgLy8gZ3JvdXBzIHdoaWNoIGlzbid0IG5pY2Ugb24gdGhlIGRpc2sgY2FjaGUuXG4gICAgICBmb3IgKGxldCBmaWxlcyBvZiBncm91cHMpIHtcbiAgICAgICAgZm9yIChsZXQgZ3JvdXAgb2YgYXdhaXQgcmVncm91cFJlY3Vyc2l2ZShmaWxlcykpIHtcbiAgICAgICAgICBncm91cHMyLnB1c2goZ3JvdXApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gZ3JvdXBzMjtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gZ3JvdXBCeVNpemUoZmlsZXM6IFBlbmRpbmdGaWxlW10pOiBQZW5kaW5nRmlsZVtdW10ge1xuICBsZXQgbWFwID0gbmV3IE1hcCgpO1xuICBmb3IgKGxldCBmaWxlIG9mIGZpbGVzKSB7XG4gICAgbGV0IGxpc3QgPSBtYXAuZ2V0KGZpbGUuc2l6ZSk7XG4gICAgaWYgKGxpc3QgPT09IHVuZGVmaW5lZCkge1xuICAgICAgbWFwLnNldChmaWxlLnNpemUsIFtmaWxlXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpc3QucHVzaChmaWxlKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIEFycmF5LmZyb20obWFwLnZhbHVlcygpKTtcbn1cbiJdfQ==