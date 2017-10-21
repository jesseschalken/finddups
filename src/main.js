#!/usr/bin/env node
// @flow
import {Path, scan} from './scanning';
import {read} from './reading';
import {report} from './reporting';

async function main(argv: string[]): Promise<void> {
  let paths = argv.slice(2).map(path => new Path(path));
  let roots = await read(await scan(paths));
  await report(roots);
}

// noinspection JSIgnoredPromiseFromCall
main(process.argv);
