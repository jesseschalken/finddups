'use strict';

var _util = require('./util');

var _scanning = require('./scanning');

var _reading = require('./reading');

var _reporting = require('./reporting');

async function main(argv) {
  let paths = argv.slice(2).map(path => new _scanning.Path(path));
  let roots = await (0, _reading.read)((await (0, _scanning.scan)(paths)));
  await (0, _reporting.report)(roots);
  await (0, _util.printLn)('DONE');
}

/* noinspection JSIgnoredPromiseFromCall*/
main(process.argv);
//# sourceMappingURL=main.js.map