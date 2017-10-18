// @flow
import {pad, printLn} from './util';
import {Path, scan} from './scanning';
import {read, traverse} from './reading';

async function main(argv: string[]): Promise<void> {
  let paths = argv.slice(2).map(path => new Path(path));
  let roots = await read(await scan(paths));
  for (let root of roots) {
    for (let node of traverse(root)) {
      let {type, cid, path} = node;
      await printLn(pad(type.name + ' ' + cid, 20) + ' ' + path.get());
    }
  }
}

/* noinspection JSIgnoredPromiseFromCall*/
main(process.argv).then(() => printLn('DONE'));
