'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.read = read;

var _fileReader = require('./file-reader');

var _promise_fs = require('./promise_fs');

var fs = _interopRequireWildcard(_promise_fs);

var _scanning = require('./scanning');

var _util = require('./util');

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

class StringCids {
  constructor() {
    this.map = new Map();
  }

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

function dirContent(nodes) {
  let data = '';
  for (let node of nodes) {
    let { path, cid } = node;
    data += (0, _util.padString)(cid + '', 20) + ' ' + path.name + '\n';
  }
  return data;
}

async function read(nodes) {
  let reader = new _fileReader.FileReader();

  async function nodeContent(node, children) {
    switch (node.type) {
      case _scanning.FileType.File:
        return reader.add(node);
      case _scanning.FileType.Directory:
        return DirContentCids.get(dirContent((await children)));
      case _scanning.FileType.Symlink:
        return LinkContentCids.get((await fs.readlink(node.path.get())));
      default:
        // For types other than file, directory or symlink, just use the cid
        // attached to the file type.
        return node.type.cid;
    }
  }

  async function readNode(node) {
    let { path, type, size } = node;
    // The FileReader needs all files to be added to it before being started,
    // which is what nodeContent() does, so it is important that we don't await
    // on our children until nodeContent() has been called.
    let children = Promise.all(node.children.map(readNode));
    let cid = await nodeContent(node, children);
    return { path, size, children: await children, type, cid };
  }

  let done = Promise.all(nodes.map(readNode));
  await reader.run();
  return await done;
}
//# sourceMappingURL=reading.js.map