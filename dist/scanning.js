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
  await (0, _util.printLn)(`Found ${(0, _util.formatNumber)(count, 0)} files, ${(0, _util.formatBytes)(size)}`);
  return roots;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9zY2FubmluZy5qcyJdLCJuYW1lcyI6WyJ0cmF2ZXJzZSIsInNjYW4iLCJmcyIsIkZpbGVUeXBlIiwiY3JlYXRlIiwic3RhdCIsImlzRmlsZSIsIkZpbGUiLCJpc0RpcmVjdG9yeSIsIkRpcmVjdG9yeSIsImlzU3ltYm9saWNMaW5rIiwiU3ltbGluayIsImlzQmxvY2tEZXZpY2UiLCJCbG9ja0RldiIsImlzQ2hhcmFjdGVyRGV2aWNlIiwiQ2hhckRldiIsImlzRklGTyIsIkZJRk8iLCJpc1NvY2tldCIsIlNvY2tldCIsIlVua25vd24iLCJjb25zdHJ1Y3RvciIsIm5hbWUiLCJjaWQiLCJQYXRoIiwicGFyZW50IiwiZ2V0Iiwiam9pbiIsIm5vZGUiLCJjaGlsZCIsImNoaWxkcmVuIiwiY3JlYXRlTm9kZSIsInBhdGgiLCJsc3RhdCIsInR5cGUiLCJzaXplIiwiUHJvbWlzZSIsImFsbCIsInJlYWRkaXIiLCJtYXAiLCJwYXRocyIsImNvdW50Iiwicm9vdHMiLCJyb290IiwicHVzaCJdLCJtYXBwaW5ncyI6Ijs7Ozs7O1FBK0RpQkEsUSxHQUFBQSxRO1FBeUJLQyxJLEdBQUFBLEk7O0FBdkZ0Qjs7SUFBWUMsRTs7QUFDWjs7QUFDQTs7OztBQUVPLE1BQU1DLFFBQU4sQ0FBZTtBQUNwQixTQUFPQyxNQUFQLENBQWNDLElBQWQsRUFBd0M7QUFDdEMsUUFBSUEsS0FBS0MsTUFBTCxFQUFKLEVBQW1CLE9BQU9ILFNBQVNJLElBQWhCO0FBQ25CLFFBQUlGLEtBQUtHLFdBQUwsRUFBSixFQUF3QixPQUFPTCxTQUFTTSxTQUFoQjtBQUN4QixRQUFJSixLQUFLSyxjQUFMLEVBQUosRUFBMkIsT0FBT1AsU0FBU1EsT0FBaEI7QUFDM0IsUUFBSU4sS0FBS08sYUFBTCxFQUFKLEVBQTBCLE9BQU9ULFNBQVNVLFFBQWhCO0FBQzFCLFFBQUlSLEtBQUtTLGlCQUFMLEVBQUosRUFBOEIsT0FBT1gsU0FBU1ksT0FBaEI7QUFDOUIsUUFBSVYsS0FBS1csTUFBTCxFQUFK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LElBQVQsQ0FBakIsRUFBaUM7QUFDL0JGO0FBQ0FOLGNBQVFQLEtBQUtPLElBQWI7QUFDRDtBQUNETyxVQUFNRSxJQUFOLENBQVdELElBQVg7QUFDRDtBQUNELFFBQU0sbUJBQVMsU0FBUSx3QkFBYUYsS0FBYixFQUFvQixDQUFwQixDQUF1QixXQUFVLHVCQUFZTixJQUFaLENBQWtCLEVBQXBFLENBQU47QUFDQSxTQUFPTyxLQUFQO0FBQ0QiLCJmaWxlIjoic2Nhbm5pbmcuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBAZmxvd1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnLi9wcm9taXNlX2ZzJztcbmltcG9ydCB7c2VwIGFzIERJUl9TRVB9IGZyb20gJ3BhdGgnO1xuaW1wb3J0IHtmb3JtYXRCeXRlcywgcHJpbnRMbiwgbmV3Q2lkLCBmb3JtYXROdW1iZXJ9IGZyb20gJy4vdXRpbCc7XG5cbmV4cG9ydCBjbGFzcyBGaWxlVHlwZSB7XG4gIHN0YXRpYyBjcmVhdGUoc3RhdDogZnMuU3RhdHMpOiBGaWxlVHlwZSB7XG4gICAgaWYgKHN0YXQuaXNGaWxlKCkpIHJldHVybiBGaWxlVHlwZS5GaWxlO1xuICAgIGlmIChzdGF0LmlzRGlyZWN0b3J5KCkpIHJldHVybiBGaWxlVHlwZS5EaXJlY3Rvcnk7XG4gICAgaWYgKHN0YXQuaXNTeW1ib2xpY0xpbmsoKSkgcmV0dXJuIEZpbGVUeXBlLlN5bWxpbms7XG4gICAgaWYgKHN0YXQuaXNCbG9ja0RldmljZSgpKSByZXR1cm4gRmlsZVR5cGUuQmxvY2tEZXY7XG4gICAgaWYgKHN0YXQuaXNDaGFyYWN0ZXJEZXZpY2UoKSkgcmV0dXJuIEZpbGVUeXBlLkNoYXJEZXY7XG4gICAgaWYgKHN0YXQuaXNGSUZPKCkpIHJldHVybiBGaWxlVHlwZS5GSUZPO1xuICAgIGlmIChzdGF0LmlzU29ja2V0KCkpIHJldHVybiBGaWxlVHlwZS5Tb2NrZXQ7XG4gICAgcmV0dXJuIEZpbGVUeXBlLlVua25vd247XG4gIH1cblxuICBzdGF0aWMgRmlsZTogRmlsZVR5cGUgPSBuZXcgRmlsZVR5cGUoJ2ZpbGUnKTtcbiAgc3RhdGljIERpcmVjdG9yeTogRmlsZVR5cGUgPSBuZXcgRmlsZVR5cGUoJ2RpcicpO1xuICBzdGF0aWMgU3ltbGluazogRmlsZVR5cGUgPSBuZXcgRmlsZVR5cGUoJ2xpbmsnKTtcbiAgc3RhdGljIEJsb2NrRGV2OiBGaWxlVHlwZSA9IG5ldyBGaWxlVHlwZSgnYmxvY2snKTtcbiAgc3RhdGljIENoYXJEZXY6IEZpbGVUeXBlID0gbmV3IEZpbGVUeXBlKCdjaGFyJyk7XG4gIHN0YXRpYyBGSUZPOiBGaWxlVHlwZSA9IG5ldyBGaWxlVHlwZSgncGlwZScpO1xuICBzdGF0aWMgU29ja2V0OiBGaWxlVHlwZSA9IG5ldyBGaWxlVHlwZSgnc29ja2V0Jyk7XG4gIHN0YXRpYyBVbmtub3duOiBGaWxlVHlwZSA9IG5ldyBGaWxlVHlwZSgndW5rbm93bicpO1xuXG4gIG5hbWU6IHN0cmluZztcbiAgY2lkOiBudW1iZXI7XG4gIGNvbnN0cnVjdG9yKG5hbWU6IHN0cmluZykge1xuICAgIHRoaXMuY2lkID0gbmV3Q2lkKCk7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgfVxufVxuXG4vKipcbiAqIFRvIHNhdmUgb24gbWVtb3J5IGZvciBsYXJnZSB0cmVlcywgbm9kZXMgd2l0aCBwYXJlbnRzIG9ubHkgY29udGFpbiB0aGVcbiAqIGJhc2VuYW1lIG9mIHRoZWlyIHBhdGggYXMgYG5hbWVgLiBBIGZ1bGwgcGF0aCBjYW4gYmUgbWFkZSBieSBmb2xsb3dpbmdcbiAqIHRoZSBwYXJlbnRzLiBOb2RlcyB3aXRob3V0IHBhcmVudHMgaGF2ZSBhIGZ1bGwgcGF0aCBhcyBgbmFtZWAuXG4gKi9cbmV4cG9ydCBjbGFzcyBQYXRoIHtcbiAgbmFtZTogc3RyaW5nO1xuICBwYXJlbnQ6ID9QYXRoO1xuICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIHBhcmVudD86IFBhdGgpIHtcbiAgICB0aGlzLm5hbWUgPSBuYW1lO1xuICAgIHRoaXMucGFyZW50ID0gcGFyZW50O1xuICB9XG4gIGdldCgpOiBzdHJpbmcge1xuICAgIGxldCB7bmFtZSwgcGFyZW50fSA9IHRoaXM7XG4gICAgcmV0dXJuIHBhcmVudCA/IHBhcmVudC5qb2luKG5hbWUpIDogbmFtZTtcbiAgfVxuICAvLyBub2luc3BlY3Rpb24gSlNVbnVzZWRHbG9iYWxTeW1ib2xzXG4gIGpvaW4obmFtZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5nZXQoKSArIERJUl9TRVAgKyBuYW1lO1xuICB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTm9kZSB7XG4gICt0eXBlOiBGaWxlVHlwZTtcbiAgK3BhdGg6IFBhdGg7XG4gICtzaXplOiBudW1iZXI7XG4gICtjaGlsZHJlbjogJFJlYWRPbmx5QXJyYXk8Tm9kZT47XG59XG5cbmV4cG9ydCBmdW5jdGlvbiogdHJhdmVyc2Uobm9kZTogTm9kZSk6IEl0ZXJhYmxlPE5vZGU+IHtcbiAgeWllbGQgbm9kZTtcbiAgZm9yIChsZXQgY2hpbGQgb2Ygbm9kZS5jaGlsZHJlbikge1xuICAgIHlpZWxkKiB0cmF2ZXJzZShjaGlsZCk7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gY3JlYXRlTm9kZShwYXRoOiBQYXRoKTogUHJvbWlzZTxOb2RlPiB7XG4gIGxldCBzdGF0ID0gYXdhaXQgZnMubHN0YXQocGF0aC5nZXQoKSk7XG4gIGxldCB0eXBlID0gRmlsZVR5cGUuY3JlYXRlKHN0YXQpO1xuICByZXR1cm4ge1xuICAgIHBhdGgsXG4gICAgdHlwZSxcbiAgICBzaXplOiB0eXBlID09PSBGaWxlVHlwZS5GaWxlID8gc3RhdC5zaXplIDogMCxcbiAgICBjaGlsZHJlbjpcbiAgICAgIHR5cGUgPT09IEZpbGVUeXBlLkRpcmVjdG9yeVxuICAgICAgICA/IGF3YWl0IFByb21pc2UuYWxsKFxuICAgICAgICAgICAgKGF3YWl0IGZzLnJlYWRkaXIocGF0aC5nZXQoKSkpLm1hcChuYW1lID0+XG4gICAgICAgICAgICAgIGNyZWF0ZU5vZGUobmV3IFBhdGgobmFtZSwgcGF0aCkpLFxuICAgICAgICAgICAgKSxcbiAgICAgICAgICApXG4gICAgICAgIDogW10sXG4gIH07XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzY2FuKHBhdGhzOiBQYXRoW10pOiBQcm9taXNlPE5vZGVbXT4ge1xuICBsZXQgc2l6ZSA9IDA7XG4gIGxldCBjb3VudCA9IDA7XG4gIGxldCByb290cyA9IFtdO1xuICBmb3IgKGxldCBwYXRoIG9mIHBhdGhzKSB7XG4gICAgYXdhaXQgcHJpbnRMbihgU2Nhbm5pbmcgJHtwYXRoLmdldCgpfWApO1xuICAgIGxldCByb290ID0gYXdhaXQgY3JlYXRlTm9kZShwYXRoKTtcbiAgICBmb3IgKGxldCBub2RlIG9mIHRyYXZlcnNlKHJvb3QpKSB7XG4gICAgICBjb3VudCsrO1xuICAgICAgc2l6ZSArPSBub2RlLnNpemU7XG4gICAgfVxuICAgIHJvb3RzLnB1c2gocm9vdCk7XG4gIH1cbiAgYXdhaXQgcHJpbnRMbihgRm91bmQgJHtmb3JtYXROdW1iZXIoY291bnQsIDApfSBmaWxlcywgJHtmb3JtYXRCeXRlcyhzaXplKX1gKTtcbiAgcmV0dXJuIHJvb3RzO1xufVxuIl19