'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.open = open;
exports.read = read;
exports.close = close;
exports.readlink = readlink;
exports.lstat = lstat;
exports.stat = stat;
exports.readdir = readdir;
exports.rmdir = rmdir;
exports.unlink = unlink;

var _fs = require('fs');

var fs = _interopRequireWildcard(_fs);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function open(path, mode) {
  return new Promise((resolve, reject) => {
    fs.open(path, mode, (err, fd) => {
      err ? reject(err) : resolve(fd);
    });
  });
}

async function read(fd, length) {
  let buffer = Buffer.allocUnsafe(length);
  let bytesRead = await new Promise((resolve, reject) => {
    fs.read(fd, buffer, 0, length, null, (err, bytesRead) => {
      err ? reject(err) : resolve(bytesRead);
    });
  });
  return buffer.slice(0, bytesRead);
}

function close(fd) {
  return new Promise((resolve, reject) => {
    fs.close(fd, err => {
      err ? reject(err) : resolve();
    });
  });
}

async function readlink(path) {
  const buffer = new Promise((resolve, reject) => {
    fs.readlink(path, (err, dest) => {
      err ? reject(err) : resolve(dest);
    });
  });
  return buffer instanceof Buffer ? buffer.toString() : buffer;
}

function lstat(path) {
  return new Promise((resolve, reject) => {
    fs.lstat(path, (err, stat) => {
      err ? reject(err) : resolve(stat);
    });
  });
}

// noinspection JSUnusedGlobalSymbols
function stat(path) {
  return new Promise((resolve, reject) => {
    fs.stat(path, (err, stat) => {
      err ? reject(err) : resolve(stat);
    });
  });
}

async function readdir(path) {
  const names = await new Promise((resolve, reject) => {
    fs.readdir(path, (err, names) => {
      err ? reject(err) : resolve(names);
    });
  });
  // Googling gives mixed results about whether fs.readdir() sorts and
  // whether it sorts on all platforms. Just sort it ourselves to be sure.
  names.sort((a, b) => a === b ? 0 : a > b ? 1 : -1);
  return names;
}

function rmdir(path) {
  return new Promise((resolve, reject) => {
    fs.rmdir(path, err => {
      err ? reject(err) : resolve();
    });
  });
}

function unlink(path) {
  return new Promise((resolve, reject) => {
    fs.unlink(path, err => {
      err ? reject(err) : resolve();
    });
  });
}
//# sourceMappingURL=promise_fs.js.map