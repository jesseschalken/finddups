'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.traverse = traverse;
exports.read = read;

var _fileReader = require('./file-reader');

var _fs = require('fs');

var fs = _interopRequireWildcard(_fs);

var _scanning = require('./scanning');

var _util = require('./util');

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

async function readlink(path) {
  let buffer = await new Promise((resolve, reject) => {
    fs.readlink(path, (err, buffer) => {
      err ? reject(err) : resolve(buffer);
    });
  });
  return buffer instanceof Buffer ? buffer.toString() : buffer;
}

function* traverse(node) {
  yield node;
  for (let child of node.children) {
    yield* traverse(child);
  }
}

const StringIds = new class {
  constructor() {
    this.next = 1;
    this.map = new Map();
  }

  // noinspection JSUnusedGlobalSymbols
  get(str) {
    let id = this.map.get(str);
    if (id === undefined) {
      id = this.next++;
      this.map.set(str, id);
    }
    return id;
  }
}();

async function dirContent(nodes) {
  let data = '';
  for (let node of nodes) {
    let { path, type, cid } = node;
    data += (0, _util.pad)(type.name + ' ' + (await cid), 20) + ' ' + path.name + '\n';
  }
  return data;
}

function nodeContent(node, children, reader) {
  switch (node.type) {
    case _scanning.FileType.File:
      return reader.add(node);
    case _scanning.FileType.Dir:
      return dirContent(children).then(x => StringIds.get(x));
    case _scanning.FileType.Link:
      return readlink(node.path.get()).then(x => StringIds.get(x));
    default:
      return Promise.resolve(0);
  }
}

function start(node, reader) {
  let { path, size, type } = node;
  let children = node.children.map(node => start(node, reader));
  let cid = nodeContent(node, children, reader);
  return { path, size, children, type, cid };
}

async function finish(node) {
  let { path, size, type } = node;
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