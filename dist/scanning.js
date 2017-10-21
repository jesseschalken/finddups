'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Path = exports.FileType = undefined;
exports.traverse = traverse;
exports.scan = scan;

var _promise_fs = require('./promise_fs');

var fs = _interopRequireWildcard(_promise_fs);

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
    this.cid = (0, _util.newCid)();
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
  // noinspection JSUnusedGlobalSymbols
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

async function createNode(path) {
  let stat = await fs.lstat(path.get());
  let type = FileType.create(stat);
  return {
    path,
    type,
    size: type === FileType.File ? stat.size : 0,
    children: type === FileType.Directory ? await Promise.all((await fs.readdir(path.get())).map(name => createNode(new Path(name, path)))) : []
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9zY2FubmluZy5qcyJdLCJuYW1lcyI6WyJ0cmF2ZXJzZSIsInNjYW4iLCJmcyIsIkZpbGVUeXBlIiwiY3JlYXRlIiwic3RhdCIsImlzRmlsZSIsIkZpbGUiLCJpc0RpcmVjdG9yeSIsIkRpcmVjdG9yeSIsImlzU3ltYm9saWNMaW5rIiwiU3ltbGluayIsImlzQmxvY2tEZXZpY2UiLCJCbG9ja0RldiIsImlzQ2hhcmFjdGVyRGV2aWNlIiwiQ2hhckRldiIsImlzRklGTyIsIkZJRk8iLCJpc1NvY2tldCIsIlNvY2tldCIsIlVua25vd24iLCJjb25zdHJ1Y3RvciIsIm5hbWUiLCJjaWQiLCJQYXRoIiwicGFyZW50IiwiZ2V0Iiwiam9pbiIsIm5vZGUiLCJjaGlsZCIsImNoaWxkcmVuIiwiY3JlYXRlTm9kZSIsInBhdGgiLCJsc3RhdCIsInR5cGUiLCJzaXplIiwiUHJvbWlzZSIsImFsbCIsInJlYWRkaXIiLCJtYXAiLCJwYXRocyIsImNvdW50Iiwicm9vdHMiLCJyb290IiwicHVzaCJdLCJtYXBwaW5ncyI6Ijs7Ozs7O1FBK0RpQkEsUSxHQUFBQSxRO1FBeUJLQyxJLEdBQUFBLEk7O0FBdkZ0Qjs7SUFBWUMsRTs7QUFDWjs7QUFDQTs7OztBQUVPLE1BQU1DLFFBQU4sQ0FBZTtBQUNwQixTQUFPQyxNQUFQLENBQWNDLElBQWQsRUFBd0M7QUFDdEMsUUFBSUEsS0FBS0MsTUFBTCxFQUFKLEVBQW1CLE9BQU9ILFNBQVNJLElBQWhCO0FBQ25CLFFBQUlGLEtBQUtHLFdBQUwsRUFBSixFQUF3QixPQUFPTCxTQUFTTSxTQUFoQjtBQUN4QixRQUFJSixLQUFLSyxjQUFMLEVBQUosRUFBMkIsT0FBT1AsU0FBU1EsT0FBaEI7QUFDM0IsUUFBSU4sS0FBS08sYUFBTCxFQUFKLEVBQTBCLE9BQU9ULFNBQVNVLFFBQWhCO0FBQzFCLFFBQUlSLEtBQUtTLGlCQUFMLEVBQUosRUFBOEIsT0FBT1gsU0FBU1ksT0FBaEI7QUFDOUIsUUFBSVYsS0FBS1csTUFBTCxFQUFK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LElBQVQsQ0FBakIsRUFBaUM7QUFDL0JGO0FBQ0FOLGNBQVFQLEtBQUtPLElBQWI7QUFDRDtBQUNETyxVQUFNRSxJQUFOLENBQVdELElBQVg7QUFDRDtBQUNELFFBQU0sbUJBQVMsU0FBUUYsS0FBTSxXQUFVLHVCQUFZTixJQUFaLENBQWtCLEVBQW5ELENBQU47QUFDQSxTQUFPTyxLQUFQO0FBQ0QiLCJmaWxlIjoic2Nhbm5pbmcuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBAZmxvd1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnLi9wcm9taXNlX2ZzJztcbmltcG9ydCB7c2VwIGFzIERJUl9TRVB9IGZyb20gJ3BhdGgnO1xuaW1wb3J0IHtmb3JtYXRCeXRlcywgcHJpbnRMbiwgbmV3Q2lkfSBmcm9tICcuL3V0aWwnO1xuXG5leHBvcnQgY2xhc3MgRmlsZVR5cGUge1xuICBzdGF0aWMgY3JlYXRlKHN0YXQ6IGZzLlN0YXRzKTogRmlsZVR5cGUge1xuICAgIGlmIChzdGF0LmlzRmlsZSgpKSByZXR1cm4gRmlsZVR5cGUuRmlsZTtcbiAgICBpZiAoc3RhdC5pc0RpcmVjdG9yeSgpKSByZXR1cm4gRmlsZVR5cGUuRGlyZWN0b3J5O1xuICAgIGlmIChzdGF0LmlzU3ltYm9saWNMaW5rKCkpIHJldHVybiBGaWxlVHlwZS5TeW1saW5rO1xuICAgIGlmIChzdGF0LmlzQmxvY2tEZXZpY2UoKSkgcmV0dXJuIEZpbGVUeXBlLkJsb2NrRGV2O1xuICAgIGlmIChzdGF0LmlzQ2hhcmFjdGVyRGV2aWNlKCkpIHJldHVybiBGaWxlVHlwZS5DaGFyRGV2O1xuICAgIGlmIChzdGF0LmlzRklGTygpKSByZXR1cm4gRmlsZVR5cGUuRklGTztcbiAgICBpZiAoc3RhdC5pc1NvY2tldCgpKSByZXR1cm4gRmlsZVR5cGUuU29ja2V0O1xuICAgIHJldHVybiBGaWxlVHlwZS5Vbmtub3duO1xuICB9XG5cbiAgc3RhdGljIEZpbGU6IEZpbGVUeXBlID0gbmV3IEZpbGVUeXBlKCdmaWxlJyk7XG4gIHN0YXRpYyBEaXJlY3Rvcnk6IEZpbGVUeXBlID0gbmV3IEZpbGVUeXBlKCdkaXInKTtcbiAgc3RhdGljIFN5bWxpbms6IEZpbGVUeXBlID0gbmV3IEZpbGVUeXBlKCdsaW5rJyk7XG4gIHN0YXRpYyBCbG9ja0RldjogRmlsZVR5cGUgPSBuZXcgRmlsZVR5cGUoJ2Jsb2NrJyk7XG4gIHN0YXRpYyBDaGFyRGV2OiBGaWxlVHlwZSA9IG5ldyBGaWxlVHlwZSgnY2hhcicpO1xuICBzdGF0aWMgRklGTzogRmlsZVR5cGUgPSBuZXcgRmlsZVR5cGUoJ3BpcGUnKTtcbiAgc3RhdGljIFNvY2tldDogRmlsZVR5cGUgPSBuZXcgRmlsZVR5cGUoJ3NvY2tldCcpO1xuICBzdGF0aWMgVW5rbm93bjogRmlsZVR5cGUgPSBuZXcgRmlsZVR5cGUoJ3Vua25vd24nKTtcblxuICBuYW1lOiBzdHJpbmc7XG4gIGNpZDogbnVtYmVyO1xuICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcpIHtcbiAgICB0aGlzLmNpZCA9IG5ld0NpZCgpO1xuICAgIHRoaXMubmFtZSA9IG5hbWU7XG4gIH1cbn1cblxuLyoqXG4gKiBUbyBzYXZlIG9uIG1lbW9yeSBmb3IgbGFyZ2UgdHJlZXMsIG5vZGVzIHdpdGggcGFyZW50cyBvbmx5IGNvbnRhaW4gdGhlXG4gKiBiYXNlbmFtZSBvZiB0aGVpciBwYXRoIGFzIGBuYW1lYC4gQSBmdWxsIHBhdGggY2FuIGJlIG1hZGUgYnkgZm9sbG93aW5nXG4gKiB0aGUgcGFyZW50cy4gTm9kZXMgd2l0aG91dCBwYXJlbnRzIGhhdmUgYSBmdWxsIHBhdGggYXMgYG5hbWVgLlxuICovXG5leHBvcnQgY2xhc3MgUGF0aCB7XG4gIG5hbWU6IHN0cmluZztcbiAgcGFyZW50OiA/UGF0aDtcbiAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCBwYXJlbnQ/OiBQYXRoKSB7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICB0aGlzLnBhcmVudCA9IHBhcmVudDtcbiAgfVxuICBnZXQoKTogc3RyaW5nIHtcbiAgICBsZXQge25hbWUsIHBhcmVudH0gPSB0aGlzO1xuICAgIHJldHVybiBwYXJlbnQgPyBwYXJlbnQuam9pbihuYW1lKSA6IG5hbWU7XG4gIH1cbiAgLy8gbm9pbnNwZWN0aW9uIEpTVW51c2VkR2xvYmFsU3ltYm9sc1xuICBqb2luKG5hbWU6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0KCkgKyBESVJfU0VQICsgbmFtZTtcbiAgfVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIE5vZGUge1xuICArdHlwZTogRmlsZVR5cGU7XG4gICtwYXRoOiBQYXRoO1xuICArc2l6ZTogbnVtYmVyO1xuICArY2hpbGRyZW46ICRSZWFkT25seUFycmF5PE5vZGU+O1xufVxuXG5leHBvcnQgZnVuY3Rpb24qIHRyYXZlcnNlKG5vZGU6IE5vZGUpOiBJdGVyYWJsZTxOb2RlPiB7XG4gIHlpZWxkIG5vZGU7XG4gIGZvciAobGV0IGNoaWxkIG9mIG5vZGUuY2hpbGRyZW4pIHtcbiAgICB5aWVsZCogdHJhdmVyc2UoY2hpbGQpO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNyZWF0ZU5vZGUocGF0aDogUGF0aCk6IFByb21pc2U8Tm9kZT4ge1xuICBsZXQgc3RhdCA9IGF3YWl0IGZzLmxzdGF0KHBhdGguZ2V0KCkpO1xuICBsZXQgdHlwZSA9IEZpbGVUeXBlLmNyZWF0ZShzdGF0KTtcbiAgcmV0dXJuIHtcbiAgICBwYXRoLFxuICAgIHR5cGUsXG4gICAgc2l6ZTogdHlwZSA9PT0gRmlsZVR5cGUuRmlsZSA/IHN0YXQuc2l6ZSA6IDAsXG4gICAgY2hpbGRyZW46XG4gICAgICB0eXBlID09PSBGaWxlVHlwZS5EaXJlY3RvcnlcbiAgICAgICAgPyBhd2FpdCBQcm9taXNlLmFsbChcbiAgICAgICAgICAgIChhd2FpdCBmcy5yZWFkZGlyKHBhdGguZ2V0KCkpKS5tYXAobmFtZSA9PlxuICAgICAgICAgICAgICBjcmVhdGVOb2RlKG5ldyBQYXRoKG5hbWUsIHBhdGgpKSxcbiAgICAgICAgICAgICksXG4gICAgICAgICAgKVxuICAgICAgICA6IFtdLFxuICB9O1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2NhbihwYXRoczogUGF0aFtdKTogUHJvbWlzZTxOb2RlW10+IHtcbiAgbGV0IHNpemUgPSAwO1xuICBsZXQgY291bnQgPSAwO1xuICBsZXQgcm9vdHMgPSBbXTtcbiAgZm9yIChsZXQgcGF0aCBvZiBwYXRocykge1xuICAgIGF3YWl0IHByaW50TG4oYFNjYW5uaW5nICR7cGF0aC5nZXQoKX1gKTtcbiAgICBsZXQgcm9vdCA9IGF3YWl0IGNyZWF0ZU5vZGUocGF0aCk7XG4gICAgZm9yIChsZXQgbm9kZSBvZiB0cmF2ZXJzZShyb290KSkge1xuICAgICAgY291bnQrKztcbiAgICAgIHNpemUgKz0gbm9kZS5zaXplO1xuICAgIH1cbiAgICByb290cy5wdXNoKHJvb3QpO1xuICB9XG4gIGF3YWl0IHByaW50TG4oYEZvdW5kICR7Y291bnR9IGZpbGVzLCAke2Zvcm1hdEJ5dGVzKHNpemUpfWApO1xuICByZXR1cm4gcm9vdHM7XG59XG4iXX0=