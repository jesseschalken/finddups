'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.traverse = traverse;
exports.read = read;

var _fileReader = require('./file-reader');

var _promise_fs = require('./promise_fs');

var fs = _interopRequireWildcard(_promise_fs);

var _scanning = require('./scanning');

var _util = require('./util');

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function* traverse(node) {
  yield node;
  for (let child of node.children) {
    yield* traverse(child);
  }
}

class StringCids {
  constructor() {
    this.map = new Map();
  }

  // noinspection JSUnusedGlobalSymbols
  get(str) {
    let cid = this.map.get(str);
    if (cid === undefined) {
      cid = (0, _util.newCid)();
      this.map.set(str, cid);
    }
    return cid;
  }
}

const DirContentCids = new StringCids();
const LinkContentCids = new StringCids();

async function dirContent(nodes) {
  let data = '';
  for (let node of nodes) {
    let { path, cid } = node;
    data += (0, _util.padString)((await cid) + '', 20) + ' ' + path.name + '\n';
  }
  return data;
}

async function nodeContent(node, children, reader) {
  switch (node.type) {
    case _scanning.FileType.File:
      return reader.add(node);
    case _scanning.FileType.Directory:
      return DirContentCids.get((await dirContent(children)));
    case _scanning.FileType.Symlink:
      return LinkContentCids.get((await fs.readlink(node.path.get())));
    default:
      // For types other than file, directory or symlink, just use the cid
      // attached to the file type.
      return node.type.cid;
  }
}

function start(node, reader) {
  let { path, type, size } = node;
  let children = node.children.map(node => start(node, reader));
  let cid = nodeContent(node, children, reader);
  return { path, size, children, type, cid };
}

async function finish(node) {
  let { path, type, size } = node;
  let children = await Promise.all(node.children.map(finish));
  let cid = await node.cid;
  return { path, size, type, cid, children };
}

async function read(nodes) {
  let reader = new _fileReader.FileReader();
  let started = nodes.map(node => start(node, reader));
  await reader.run();
  return await Promise.all(started.map(finish));
}
//# sourceMappingURL=reading.js.map