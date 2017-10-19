// @flow
import {padString, printLn} from './util';
import {Path, scan} from './scanning';
import {read, traverse} from './reading';
import {report} from './reporting';

async function main(argv: string[]): Promise<void> {
  let paths = argv.slice(2).map(path => new Path(path));
  let roots = await read(await scan(paths));
  await report(roots);
  await printLn('DONE');
}

/* noinspection JSIgnoredPromiseFromCall*/
main(process.argv);
