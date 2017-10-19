'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Path = exports.FileType = undefined;
exports.traverse = traverse;
exports.scan = scan;

var _fs = require('fs');

var fs = _interopRequireWildcard(_fs);

var _path = require('path');

var _util = require('./util');

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

class FileType {
  static create(stat) {
    if (stat.isFile()) return FileType.File;
    if (stat.isDirectory()) return FileType.Directory;
    if (stat.isSymbolicLink()) return FileType.Symlink;
    if (stat.isBlockDevice()) return FileType.BlockDev;
    if (stat.isCharacterDevice()) return FileType.CharDev;
    if (stat.isFIFO()) return FileType.FIFO;
    if (stat.isSocket()) return FileType.Socket;
    return FileType.Unknown;
  }

  constructor(name) {
    this.name = name;
  }
}

exports.FileType = FileType; /**
                              * To save on memory for large trees, nodes with parents only contain the
                              * basename of their path as `name`. A full path can be made by following
                              * the parents. Nodes without parents have a full path as `name`.
                              */

FileType.File = new FileType('file');
FileType.Directory = new FileType('dir');
FileType.Symlink = new FileType('link');
FileType.BlockDev = new FileType('block');
FileType.CharDev = new FileType('char');
FileType.FIFO = new FileType('pipe');
FileType.Socket = new FileType('socket');
FileType.Unknown = new FileType('unknown');
class Path {
  constructor(name, parent) {
    this.name = name;
    this.parent = parent;
  }
  get() {
    let { name, parent } = this;
    return parent ? parent.join(name) : name;
  }
  join(name) {
    return this.get() + _path.sep + name;
  }
}

exports.Path = Path;
function* traverse(node) {
  yield node;
  for (let child of node.children) {
    yield* traverse(child);
  }
}

function lstat(path) {
  return new Promise((resolve, reject) => {
    fs.lstat(path, (err, stat) => {
      err ? reject(err) : resolve(stat);
    });
  });
}

function readdir(path) {
  return new Promise((resolve, reject) => {
    fs.readdir(path, (err, names) => {
      err ? reject(err) : resolve(names);
    });
  });
}

async function createNode(path) {
  let pathStr = path.get();
  let stat = await lstat(pathStr);
  let type = FileType.create(stat);
  return {
    path,
    type,
    size: type === FileType.File ? stat.size : 0,
    children: type === FileType.Directory ? await Promise.all((await readdir(pathStr)).map(name => createNode(new Path(name, path)))) : []
  };
}

async function scan(paths) {
  let size = 0;
  let count = 0;
  let roots = [];
  for (let path of paths) {
    await (0, _util.printLn)(`Scanning ${path.get()}`);
    let root = await createNode(path);
    for (let node of traverse(root)) {
      count++;
      size += node.size;
    }
    roots.push(root);
  }
  await (0, _util.printLn)(`Found ${count} files, ${(0, _util.formatBytes)(size)}`);
  return roots;
}
//# sourceMappingURL=scanning.js.map