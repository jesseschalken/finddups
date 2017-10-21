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

function lstat(path) {
  return new Promise((resolve, reject) => {
    fs.lstat(path.get(), (err, stat) => {
      err ? reject(err) : resolve(stat);
    });
  });
}

function readdir(path) {
  return new Promise((resolve, reject) => {
    fs.readdir(path.get(), (err, names) => {
      err ? reject(err) : resolve(names);
    });
  });
}

async function createNode(path) {
  let stat = await lstat(path);
  let type = FileType.create(stat);
  return {
    path,
    type,
    size: type === FileType.File ? stat.size : 0,
    children: type === FileType.Directory ? await Promise.all((await readdir(path)).map(name => createNode(new Path(name, path)))) : []
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9zY2FubmluZy5qcyJdLCJuYW1lcyI6WyJ0cmF2ZXJzZSIsInNjYW4iLCJmcyIsIkZpbGVUeXBlIiwiY3JlYXRlIiwic3RhdCIsImlzRmlsZSIsIkZpbGUiLCJpc0RpcmVjdG9yeSIsIkRpcmVjdG9yeSIsImlzU3ltYm9saWNMaW5rIiwiU3ltbGluayIsImlzQmxvY2tEZXZpY2UiLCJCbG9ja0RldiIsImlzQ2hhcmFjdGVyRGV2aWNlIiwiQ2hhckRldiIsImlzRklGTyIsIkZJRk8iLCJpc1NvY2tldCIsIlNvY2tldCIsIlVua25vd24iLCJjb25zdHJ1Y3RvciIsIm5hbWUiLCJjaWQiLCJQYXRoIiwicGFyZW50IiwiZ2V0Iiwiam9pbiIsIm5vZGUiLCJjaGlsZCIsImNoaWxkcmVuIiwibHN0YXQiLCJwYXRoIiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJlcnIiLCJyZWFkZGlyIiwibmFtZXMiLCJjcmVhdGVOb2RlIiwidHlwZSIsInNpemUiLCJhbGwiLCJtYXAiLCJwYXRocyIsImNvdW50Iiwicm9vdHMiLCJyb290IiwicHVzaCJdLCJtYXBwaW5ncyI6Ijs7Ozs7O1FBK0RpQkEsUSxHQUFBQSxRO1FBdUNLQyxJLEdBQUFBLEk7O0FBckd0Qjs7SUFBWUMsRTs7QUFDWjs7QUFDQTs7OztBQUVPLE1BQU1DLFFBQU4sQ0FBZTtBQUNwQixTQUFPQyxNQUFQLENBQWNDLElBQWQsRUFBd0M7QUFDdEMsUUFBSUEsS0FBS0MsTUFBTCxFQUFKLEVBQW1CLE9BQU9ILFNBQVNJLElBQWhCO0FBQ25CLFFBQUlGLEtBQUtHLFdBQUwsRUFBSixFQUF3QixPQUFPTCxTQUFTTSxTQUFoQjtBQUN4QixRQUFJSixLQUFLSyxjQUFMLEVBQUosRUFBMkIsT0FBT1AsU0FBU1EsT0FBaEI7QUFDM0IsUUFBSU4sS0FBS08sYUFBTCxFQUFKLEVBQTBCLE9BQU9ULFNBQVNVLFFBQWhCO0FBQzFCLFFBQUlSLEtBQUtTLGlCQUFMLEVBQUosRUFBOEIsT0FBT1gsU0FBU1ks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QTlCLEdBQXFDLENBSHRDO0FBSUxYLGNBQ0VVLFNBQVNyQyxTQUFTTSxTQUFsQixHQUNJLE1BQU13QixRQUFRUyxHQUFSLENBQ0osQ0FBQyxNQUFNTCxRQUFRTCxJQUFSLENBQVAsRUFBc0JXLEdBQXRCLENBQTBCckIsUUFBUWlCLFdBQVcsSUFBSWYsSUFBSixDQUFTRixJQUFULEVBQWVVLElBQWYsQ0FBWCxDQUFsQyxDQURJLENBRFYsR0FJSTtBQVRELEdBQVA7QUFXRDs7QUFFTSxlQUFlL0IsSUFBZixDQUFvQjJDLEtBQXBCLEVBQW9EO0FBQ3pELE1BQUlILE9BQU8sQ0FBWDtBQUNBLE1BQUlJLFFBQVEsQ0FBWjtBQUNBLE1BQUlDLFFBQVEsRUFBWjtBQUNBLE9BQUssSUFBSWQsSUFBVCxJQUFpQlksS0FBakIsRUFBd0I7QUFDdEIsVUFBTSxtQkFBUyxZQUFXWixLQUFLTixHQUFMLEVBQVcsRUFBL0IsQ0FBTjtBQUNBLFFBQUlxQixPQUFPLE1BQU1SLFdBQVdQLElBQVgsQ0FBakI7QUFDQSxTQUFLLElBQUlKLElBQVQsSUFBaUI1QixTQUFTK0MsSUFBVCxDQUFqQixFQUFpQztBQUMvQkY7QUFDQUosY0FBUWIsS0FBS2EsSUFBYjtBQUNEO0FBQ0RLLFVBQU1FLElBQU4sQ0FBV0QsSUFBWDtBQUNEO0FBQ0QsUUFBTSxtQkFBUyxTQUFRRixLQUFNLFdBQVUsdUJBQVlKLElBQVosQ0FBa0IsRUFBbkQsQ0FBTjtBQUNBLFNBQU9LLEtBQVA7QUFDRCIsImZpbGUiOiJzY2FubmluZy5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8vIEBmbG93XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQge3NlcCBhcyBESVJfU0VQfSBmcm9tICdwYXRoJztcbmltcG9ydCB7Zm9ybWF0Qnl0ZXMsIHByaW50TG4sIG5ld0NpZH0gZnJvbSAnLi91dGlsJztcblxuZXhwb3J0IGNsYXNzIEZpbGVUeXBlIHtcbiAgc3RhdGljIGNyZWF0ZShzdGF0OiBmcy5TdGF0cyk6IEZpbGVUeXBlIHtcbiAgICBpZiAoc3RhdC5pc0ZpbGUoKSkgcmV0dXJuIEZpbGVUeXBlLkZpbGU7XG4gICAgaWYgKHN0YXQuaXNEaXJlY3RvcnkoKSkgcmV0dXJuIEZpbGVUeXBlLkRpcmVjdG9yeTtcbiAgICBpZiAoc3RhdC5pc1N5bWJvbGljTGluaygpKSByZXR1cm4gRmlsZVR5cGUuU3ltbGluaztcbiAgICBpZiAoc3RhdC5pc0Jsb2NrRGV2aWNlKCkpIHJldHVybiBGaWxlVHlwZS5CbG9ja0RldjtcbiAgICBpZiAoc3RhdC5pc0NoYXJhY3RlckRldmljZSgpKSByZXR1cm4gRmlsZVR5cGUuQ2hhckRldjtcbiAgICBpZiAoc3RhdC5pc0ZJRk8oKSkgcmV0dXJuIEZpbGVUeXBlLkZJRk87XG4gICAgaWYgKHN0YXQuaXNTb2NrZXQoKSkgcmV0dXJuIEZpbGVUeXBlLlNvY2tldDtcbiAgICByZXR1cm4gRmlsZVR5cGUuVW5rbm93bjtcbiAgfVxuXG4gIHN0YXRpYyBGaWxlID0gbmV3IEZpbGVUeXBlKCdmaWxlJyk7XG4gIHN0YXRpYyBEaXJlY3RvcnkgPSBuZXcgRmlsZVR5cGUoJ2RpcicpO1xuICBzdGF0aWMgU3ltbGluayA9IG5ldyBGaWxlVHlwZSgnbGluaycpO1xuICBzdGF0aWMgQmxvY2tEZXYgPSBuZXcgRmlsZVR5cGUoJ2Jsb2NrJyk7XG4gIHN0YXRpYyBDaGFyRGV2ID0gbmV3IEZpbGVUeXBlKCdjaGFyJyk7XG4gIHN0YXRpYyBGSUZPID0gbmV3IEZpbGVUeXBlKCdwaXBlJyk7XG4gIHN0YXRpYyBTb2NrZXQgPSBuZXcgRmlsZVR5cGUoJ3NvY2tldCcpO1xuICBzdGF0aWMgVW5rbm93biA9IG5ldyBGaWxlVHlwZSgndW5rbm93bicpO1xuXG4gIG5hbWU6IHN0cmluZztcbiAgY2lkOiBudW1iZXI7XG4gIGNvbnN0cnVjdG9yKG5hbWU6IHN0cmluZykge1xuICAgIHRoaXMuY2lkID0gbmV3Q2lkKCk7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgfVxufVxuXG4vKipcbiAqIFRvIHNhdmUgb24gbWVtb3J5IGZvciBsYXJnZSB0cmVlcywgbm9kZXMgd2l0aCBwYXJlbnRzIG9ubHkgY29udGFpbiB0aGVcbiAqIGJhc2VuYW1lIG9mIHRoZWlyIHBhdGggYXMgYG5hbWVgLiBBIGZ1bGwgcGF0aCBjYW4gYmUgbWFkZSBieSBmb2xsb3dpbmdcbiAqIHRoZSBwYXJlbnRzLiBOb2RlcyB3aXRob3V0IHBhcmVudHMgaGF2ZSBhIGZ1bGwgcGF0aCBhcyBgbmFtZWAuXG4gKi9cbmV4cG9ydCBjbGFzcyBQYXRoIHtcbiAgbmFtZTogc3RyaW5nO1xuICBwYXJlbnQ6ID9QYXRoO1xuICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIHBhcmVudD86IFBhdGgpIHtcbiAgICB0aGlzLm5hbWUgPSBuYW1lO1xuICAgIHRoaXMucGFyZW50ID0gcGFyZW50O1xuICB9XG4gIGdldCgpOiBzdHJpbmcge1xuICAgIGxldCB7bmFtZSwgcGFyZW50fSA9IHRoaXM7XG4gICAgcmV0dXJuIHBhcmVudCA/IHBhcmVudC5qb2luKG5hbWUpIDogbmFtZTtcbiAgfVxuICAvLyBub2luc3BlY3Rpb24gSlNVbnVzZWRHbG9iYWxTeW1ib2xzXG4gIGpvaW4obmFtZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5nZXQoKSArIERJUl9TRVAgKyBuYW1lO1xuICB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTm9kZSB7XG4gICt0eXBlOiBGaWxlVHlwZTtcbiAgK3BhdGg6IFBhdGg7XG4gICtzaXplOiBudW1iZXI7XG4gICtjaGlsZHJlbjogJFJlYWRPbmx5QXJyYXk8Tm9kZT47XG59XG5cbmV4cG9ydCBmdW5jdGlvbiogdHJhdmVyc2Uobm9kZTogTm9kZSk6IEl0ZXJhYmxlPE5vZGU+IHtcbiAgeWllbGQgbm9kZTtcbiAgZm9yIChsZXQgY2hpbGQgb2Ygbm9kZS5jaGlsZHJlbikge1xuICAgIHlpZWxkKiB0cmF2ZXJzZShjaGlsZCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gbHN0YXQocGF0aDogUGF0aCk6IFByb21pc2U8ZnMuU3RhdHM+IHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICBmcy5sc3RhdChwYXRoLmdldCgpLCAoZXJyLCBzdGF0KSA9PiB7XG4gICAgICBlcnIgPyByZWplY3QoZXJyKSA6IHJlc29sdmUoc3RhdCk7XG4gICAgfSk7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiByZWFkZGlyKHBhdGg6IFBhdGgpOiBQcm9taXNlPHN0cmluZ1tdPiB7XG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgZnMucmVhZGRpcihwYXRoLmdldCgpLCAoZXJyLCBuYW1lcykgPT4ge1xuICAgICAgZXJyID8gcmVqZWN0KGVycikgOiByZXNvbHZlKG5hbWVzKTtcbiAgICB9KTtcbiAgfSk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNyZWF0ZU5vZGUocGF0aDogUGF0aCk6IFByb21pc2U8Tm9kZT4ge1xuICBsZXQgc3RhdCA9IGF3YWl0IGxzdGF0KHBhdGgpO1xuICBsZXQgdHlwZSA9IEZpbGVUeXBlLmNyZWF0ZShzdGF0KTtcbiAgcmV0dXJuIHtcbiAgICBwYXRoLFxuICAgIHR5cGUsXG4gICAgc2l6ZTogdHlwZSA9PT0gRmlsZVR5cGUuRmlsZSA/IHN0YXQuc2l6ZSA6IDAsXG4gICAgY2hpbGRyZW46XG4gICAgICB0eXBlID09PSBGaWxlVHlwZS5EaXJlY3RvcnlcbiAgICAgICAgPyBhd2FpdCBQcm9taXNlLmFsbChcbiAgICAgICAgICAgIChhd2FpdCByZWFkZGlyKHBhdGgpKS5tYXAobmFtZSA9PiBjcmVhdGVOb2RlKG5ldyBQYXRoKG5hbWUsIHBhdGgpKSksXG4gICAgICAgICAgKVxuICAgICAgICA6IFtdLFxuICB9O1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2NhbihwYXRoczogUGF0aFtdKTogUHJvbWlzZTxOb2RlW10+IHtcbiAgbGV0IHNpemUgPSAwO1xuICBsZXQgY291bnQgPSAwO1xuICBsZXQgcm9vdHMgPSBbXTtcbiAgZm9yIChsZXQgcGF0aCBvZiBwYXRocykge1xuICAgIGF3YWl0IHByaW50TG4oYFNjYW5uaW5nICR7cGF0aC5nZXQoKX1gKTtcbiAgICBsZXQgcm9vdCA9IGF3YWl0IGNyZWF0ZU5vZGUocGF0aCk7XG4gICAgZm9yIChsZXQgbm9kZSBvZiB0cmF2ZXJzZShyb290KSkge1xuICAgICAgY291bnQrKztcbiAgICAgIHNpemUgKz0gbm9kZS5zaXplO1xuICAgIH1cbiAgICByb290cy5wdXNoKHJvb3QpO1xuICB9XG4gIGF3YWl0IHByaW50TG4oYEZvdW5kICR7Y291bnR9IGZpbGVzLCAke2Zvcm1hdEJ5dGVzKHNpemUpfWApO1xuICByZXR1cm4gcm9vdHM7XG59XG4iXX0=