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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9zY2FubmluZy5qcyJdLCJuYW1lcyI6WyJ0cmF2ZXJzZSIsInNjYW4iLCJmcyIsIkZpbGVUeXBlIiwiY3JlYXRlIiwic3RhdCIsImlzRmlsZSIsIkZpbGUiLCJpc0RpcmVjdG9yeSIsIkRpcmVjdG9yeSIsImlzU3ltYm9saWNMaW5rIiwiU3ltbGluayIsImlzQmxvY2tEZXZpY2UiLCJCbG9ja0RldiIsImlzQ2hhcmFjdGVyRGV2aWNlIiwiQ2hhckRldiIsImlzRklGTyIsIkZJRk8iLCJpc1NvY2tldCIsIlNvY2tldCIsIlVua25vd24iLCJjb25zdHJ1Y3RvciIsIm5hbWUiLCJjaWQiLCJQYXRoIiwicGFyZW50IiwiZ2V0Iiwiam9pbiIsIm5vZGUiLCJjaGlsZCIsImNoaWxkcmVuIiwiY3JlYXRlTm9kZSIsInBhdGgiLCJsc3RhdCIsInR5cGUiLCJzaXplIiwiUHJvbWlzZSIsImFsbCIsInJlYWRkaXIiLCJtYXAiLCJwYXRocyIsImNvdW50Iiwicm9vdHMiLCJyb290IiwicHVzaCJdLCJtYXBwaW5ncyI6Ijs7Ozs7O1FBK0RpQkEsUSxHQUFBQSxRO1FBeUJLQyxJLEdBQUFBLEk7O0FBdkZ0Qjs7SUFBWUMsRTs7QUFDWjs7QUFDQTs7OztBQUVPLE1BQU1DLFFBQU4sQ0FBZTtBQUNwQixTQUFPQyxNQUFQLENBQWNDLElBQWQsRUFBd0M7QUFDdEMsUUFBSUEsS0FBS0MsTUFBTCxFQUFKLEVBQW1CLE9BQU9ILFNBQVNJLElBQWhCO0FBQ25CLFFBQUlGLEtBQUtHLFdBQUwsRUFBSixFQUF3QixPQUFPTCxTQUFTTSxTQUFoQjtBQUN4QixRQUFJSixLQUFLSyxjQUFMLEVBQUosRUFBMkIsT0FBT1AsU0FBU1EsT0FBaEI7QUFDM0IsUUFBSU4sS0FBS08sYUFBTCxFQUFKLEVBQTBCLE9BQU9ULFNBQVNVLFFBQWhCO0FBQzFCLFFBQUlSLEtBQUtTLGlCQUFMLEVBQUosRUFBOEIsT0FBT1gsU0FBU1ksT0FBaEI7QUFDOUIsUUFBSVYsS0FBS1csTUFBTCxFQUFK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QUFpQztBQUMvQkY7QUFDQU4sY0FBUVAsS0FBS08sSUFBYjtBQUNEO0FBQ0RPLFVBQU1FLElBQU4sQ0FBV0QsSUFBWDtBQUNEO0FBQ0QsUUFBTSxtQkFBUyxTQUFRRixLQUFNLFdBQVUsdUJBQVlOLElBQVosQ0FBa0IsRUFBbkQsQ0FBTjtBQUNBLFNBQU9PLEtBQVA7QUFDRCIsImZpbGUiOiJzY2FubmluZy5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8vIEBmbG93XG5pbXBvcnQgKiBhcyBmcyBmcm9tICcuL3Byb21pc2VfZnMnO1xuaW1wb3J0IHtzZXAgYXMgRElSX1NFUH0gZnJvbSAncGF0aCc7XG5pbXBvcnQge2Zvcm1hdEJ5dGVzLCBwcmludExuLCBuZXdDaWR9IGZyb20gJy4vdXRpbCc7XG5cbmV4cG9ydCBjbGFzcyBGaWxlVHlwZSB7XG4gIHN0YXRpYyBjcmVhdGUoc3RhdDogZnMuU3RhdHMpOiBGaWxlVHlwZSB7XG4gICAgaWYgKHN0YXQuaXNGaWxlKCkpIHJldHVybiBGaWxlVHlwZS5GaWxlO1xuICAgIGlmIChzdGF0LmlzRGlyZWN0b3J5KCkpIHJldHVybiBGaWxlVHlwZS5EaXJlY3Rvcnk7XG4gICAgaWYgKHN0YXQuaXNTeW1ib2xpY0xpbmsoKSkgcmV0dXJuIEZpbGVUeXBlLlN5bWxpbms7XG4gICAgaWYgKHN0YXQuaXNCbG9ja0RldmljZSgpKSByZXR1cm4gRmlsZVR5cGUuQmxvY2tEZXY7XG4gICAgaWYgKHN0YXQuaXNDaGFyYWN0ZXJEZXZpY2UoKSkgcmV0dXJuIEZpbGVUeXBlLkNoYXJEZXY7XG4gICAgaWYgKHN0YXQuaXNGSUZPKCkpIHJldHVybiBGaWxlVHlwZS5GSUZPO1xuICAgIGlmIChzdGF0LmlzU29ja2V0KCkpIHJldHVybiBGaWxlVHlwZS5Tb2NrZXQ7XG4gICAgcmV0dXJuIEZpbGVUeXBlLlVua25vd247XG4gIH1cblxuICBzdGF0aWMgRmlsZSA9IG5ldyBGaWxlVHlwZSgnZmlsZScpO1xuICBzdGF0aWMgRGlyZWN0b3J5ID0gbmV3IEZpbGVUeXBlKCdkaXInKTtcbiAgc3RhdGljIFN5bWxpbmsgPSBuZXcgRmlsZVR5cGUoJ2xpbmsnKTtcbiAgc3RhdGljIEJsb2NrRGV2ID0gbmV3IEZpbGVUeXBlKCdibG9jaycpO1xuICBzdGF0aWMgQ2hhckRldiA9IG5ldyBGaWxlVHlwZSgnY2hhcicpO1xuICBzdGF0aWMgRklGTyA9IG5ldyBGaWxlVHlwZSgncGlwZScpO1xuICBzdGF0aWMgU29ja2V0ID0gbmV3IEZpbGVUeXBlKCdzb2NrZXQnKTtcbiAgc3RhdGljIFVua25vd24gPSBuZXcgRmlsZVR5cGUoJ3Vua25vd24nKTtcblxuICBuYW1lOiBzdHJpbmc7XG4gIGNpZDogbnVtYmVyO1xuICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcpIHtcbiAgICB0aGlzLmNpZCA9IG5ld0NpZCgpO1xuICAgIHRoaXMubmFtZSA9IG5hbWU7XG4gIH1cbn1cblxuLyoqXG4gKiBUbyBzYXZlIG9uIG1lbW9yeSBmb3IgbGFyZ2UgdHJlZXMsIG5vZGVzIHdpdGggcGFyZW50cyBvbmx5IGNvbnRhaW4gdGhlXG4gKiBiYXNlbmFtZSBvZiB0aGVpciBwYXRoIGFzIGBuYW1lYC4gQSBmdWxsIHBhdGggY2FuIGJlIG1hZGUgYnkgZm9sbG93aW5nXG4gKiB0aGUgcGFyZW50cy4gTm9kZXMgd2l0aG91dCBwYXJlbnRzIGhhdmUgYSBmdWxsIHBhdGggYXMgYG5hbWVgLlxuICovXG5leHBvcnQgY2xhc3MgUGF0aCB7XG4gIG5hbWU6IHN0cmluZztcbiAgcGFyZW50OiA/UGF0aDtcbiAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCBwYXJlbnQ/OiBQYXRoKSB7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICB0aGlzLnBhcmVudCA9IHBhcmVudDtcbiAgfVxuICBnZXQoKTogc3RyaW5nIHtcbiAgICBsZXQge25hbWUsIHBhcmVudH0gPSB0aGlzO1xuICAgIHJldHVybiBwYXJlbnQgPyBwYXJlbnQuam9pbihuYW1lKSA6IG5hbWU7XG4gIH1cbiAgLy8gbm9pbnNwZWN0aW9uIEpTVW51c2VkR2xvYmFsU3ltYm9sc1xuICBqb2luKG5hbWU6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0KCkgKyBESVJfU0VQICsgbmFtZTtcbiAgfVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIE5vZGUge1xuICArdHlwZTogRmlsZVR5cGU7XG4gICtwYXRoOiBQYXRoO1xuICArc2l6ZTogbnVtYmVyO1xuICArY2hpbGRyZW46ICRSZWFkT25seUFycmF5PE5vZGU+O1xufVxuXG5leHBvcnQgZnVuY3Rpb24qIHRyYXZlcnNlKG5vZGU6IE5vZGUpOiBJdGVyYWJsZTxOb2RlPiB7XG4gIHlpZWxkIG5vZGU7XG4gIGZvciAobGV0IGNoaWxkIG9mIG5vZGUuY2hpbGRyZW4pIHtcbiAgICB5aWVsZCogdHJhdmVyc2UoY2hpbGQpO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNyZWF0ZU5vZGUocGF0aDogUGF0aCk6IFByb21pc2U8Tm9kZT4ge1xuICBsZXQgc3RhdCA9IGF3YWl0IGZzLmxzdGF0KHBhdGguZ2V0KCkpO1xuICBsZXQgdHlwZSA9IEZpbGVUeXBlLmNyZWF0ZShzdGF0KTtcbiAgcmV0dXJuIHtcbiAgICBwYXRoLFxuICAgIHR5cGUsXG4gICAgc2l6ZTogdHlwZSA9PT0gRmlsZVR5cGUuRmlsZSA/IHN0YXQuc2l6ZSA6IDAsXG4gICAgY2hpbGRyZW46XG4gICAgICB0eXBlID09PSBGaWxlVHlwZS5EaXJlY3RvcnlcbiAgICAgICAgPyBhd2FpdCBQcm9taXNlLmFsbChcbiAgICAgICAgICAgIChhd2FpdCBmcy5yZWFkZGlyKHBhdGguZ2V0KCkpKS5tYXAobmFtZSA9PlxuICAgICAgICAgICAgICBjcmVhdGVOb2RlKG5ldyBQYXRoKG5hbWUsIHBhdGgpKSxcbiAgICAgICAgICAgICksXG4gICAgICAgICAgKVxuICAgICAgICA6IFtdLFxuICB9O1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2NhbihwYXRoczogUGF0aFtdKTogUHJvbWlzZTxOb2RlW10+IHtcbiAgbGV0IHNpemUgPSAwO1xuICBsZXQgY291bnQgPSAwO1xuICBsZXQgcm9vdHMgPSBbXTtcbiAgZm9yIChsZXQgcGF0aCBvZiBwYXRocykge1xuICAgIGF3YWl0IHByaW50TG4oYFNjYW5uaW5nICR7cGF0aC5nZXQoKX1gKTtcbiAgICBsZXQgcm9vdCA9IGF3YWl0IGNyZWF0ZU5vZGUocGF0aCk7XG4gICAgZm9yIChsZXQgbm9kZSBvZiB0cmF2ZXJzZShyb290KSkge1xuICAgICAgY291bnQrKztcbiAgICAgIHNpemUgKz0gbm9kZS5zaXplO1xuICAgIH1cbiAgICByb290cy5wdXNoKHJvb3QpO1xuICB9XG4gIGF3YWl0IHByaW50TG4oYEZvdW5kICR7Y291bnR9IGZpbGVzLCAke2Zvcm1hdEJ5dGVzKHNpemUpfWApO1xuICByZXR1cm4gcm9vdHM7XG59XG4iXX0=