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
async function groupFiles(files) {
  let groups1 = groupBySize(files);
  let progress = new _progress.Progress();
  let interval = new _util.Interval(() => progress.print(), 5000);
  let groups2 = [];
  await waitAll(groups1.map(async group => {
    if (group.length > 1) {
      for (let group2 of await regroupRecursive(group.map(file => new OpenFile(file, progress)))) {
        groups2.push(group2.map(file => file.file));
      }
    } else {
      groups2.push(group);
    }
  }));
  interval.stop();
  await progress.print();
  return groups2;
}

class OpenFile {

  constructor(file, progress) {
    this.closed = false;
    this.eof = false;
    this.done = 0;

    progress.total += file.size;

    this.file = file;
    this.fd = openFd(file.path.get());
    this.progress = progress;
  }

  /**
   * Returns exactly the next `length` bytes, or fewer if end-of-file is
   * reached.
   */
  async read(length) {
    if (this.closed || length === 0) {
      return Buffer.alloc(0);
    }
    let buffer = await readFd((await this.fd), length);
    if (buffer.length === 0) {
      this.eof = true;
      await this.close();
    }

    // Update the progress bar
    this.done += buffer.length;
    this.progress.done += buffer.length;

    return buffer;
  }

  async close() {
    // Gate to make sure only the first call to close() will close the file
    // handle.
    if (!this.closed) {
      this.closed = true;
      await closeFd((await this.fd));

      // Remove any bytes we didn't read from the progress bar
      this.progress.total -= this.file.size - this.done;
    }
  }
}

const fdCounter = new class {
  constructor() {
    this.count = 0;
    this.queue = [];
  }

  // noinspection JSUnusedGlobalSymbols
  inc() {
    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject });
      this.run();
    });
  }
  // noinspection JSUnusedGlobalSymbols
  dec() {
    this.count--;
    this.run();
  }
  run() {
    while (this.queue.length > 0 && this.count < 1000) {
      this.count++;
      this.queue.shift().resolve();
    }
  }
}();

async function openFd(path) {
  // Make sure there are less than 1000 open file descriptors before opening
  // more of them.
  await fdCounter.inc();
  return new Promise((resolve, reject) => {
    fs.open(path, 'r', (err, fd) => {
      err ? reject(err) : resolve(fd);
    });
  });
}

async function readFd(fd, length) {
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

function closeFd(fd) {
  fdCounter.dec();
  return new Promise((resolve, reject) => {
    fs.close(fd, err => {
      err ? reject(err) : resolve();
    });
  });
}

/** Promise.all but without building an array of return values */
async function waitAll(promises) {
  for (let promise of promises) {
    await promise;
  }
}

function findGroup(groups, bytes) {
  for (let group of groups) {
    if (group.bytes.equals(bytes)) {
      return group;
    }
  }
  let group = { bytes, files: [] };
  groups.push(group);
  return group;
}

const CHUNK_SIZE = 10 * 1024 * 1024;

async function regroup(files) {
  let groups = [];
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

async function regroupRecursive(files) {
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

function groupBySize(files) {
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
//# sourceMappingURL=file-reader.js.map