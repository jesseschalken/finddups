'use strict';

var _util = require('./util');

var _scanning = require('./scanning');

var _reading = require('./reading');

async function main(argv) {
  let paths = argv.slice(2).map(path => new _scanning.Path(path));
  let roots = await (0, _reading.read)((await (0, _scanning.scan)(paths)));
  for (let root of roots) {
    for (let node of (0, _reading.traverse)(root)) {
      let { type, path, cid } = node;
      await (0, _util.printLn)((0, _util.padString)(type.name + ' ' + cid, 20) + ' ' + path.get());
    }
  }
}

/* noinspection JSIgnoredPromiseFromCall*/

main(process.argv).then(() => (0, _util.printLn)('DONE'));
//# sourceMappingURL=main.js.map