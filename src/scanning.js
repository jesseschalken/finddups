// @flow
import * as fs from 'fs';
import {sep as DIR_SEP} from 'path';
import {formatBytes, printLn} from './util';

export class FileType {
  static create(stat: fs.Stats): FileType {
    if (stat.isFile()) return FileType.File;
    if (stat.isDirectory()) return FileType.Dir;
    if (stat.isSymbolicLink()) return FileType.Link;
    if (stat.isBlockDevice()) return FileType.Block;
    if (stat.isCharacterDevice()) return FileType.Char;
    if (stat.isFIFO()) return FileType.Pipe;
    if (stat.isSocket()) return FileType.Socket;
    return FileType.Unknown;
  }

  static File = new FileType('file');
  static Dir = new FileType('dir');
  static Link = new FileType('link');
  static Block = new FileType('block');
  static Char = new FileType('char');
  static Pipe = new FileType('pipe');
  static Socket = new FileType('socket');
  static Unknown = new FileType('unknown');

  name: string;
  constructor(name: string) {
    this.name = name;
  }
}

/**
 * To save on memory for large trees, nodes with parents only contain the
 * basename of their path as `name`. A full path can be made by following
 * the parents. Nodes without parents have a full path as `name`.
 */
export class Path {
  name: string;
  parent: ?Path;
  constructor(name: string, parent?: Path) {
    this.name = name;
    this.parent = parent;
  }
  get(): string {
    let {name, parent} = this;
    return parent ? parent.join(name) : name;
  }
  join(name: string): string {
    return this.get() + DIR_SEP + name;
  }
}

export interface Node {
  +type: FileType;
  +path: Path;
  +size: number;
  +children: $ReadOnlyArray<Node>;
}

function* traverse(node: Node): Iterable<Node> {
  yield node;
  for (let child of node.children) {
    yield* traverse(child);
  }
}

function lstat(path: string): Promise<fs.Stats> {
  return new Promise((resolve, reject) => {
    fs.lstat(path, (err, stat) => {
      err ? reject(err) : resolve(stat);
    });
  });
}

function readdir(path: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    fs.readdir(path, (err, names) => {
      err ? reject(err) : resolve(names);
    });
  });
}

async function createNode(path: Path): Promise<Node> {
  let pathStr = path.get();
  await printLn(`Scanning ${pathStr}`);
  let stat = await lstat(pathStr);
  return {
    path,
    type: FileType.create(stat),
    size: stat.isFile() ? stat.size : 0,
    children: stat.isDirectory() ? await Promise.all((
        await readdir(pathStr)
    ).map(name => createNode(new Path(name, path)))) : [],
  };
}

export async function scan(paths: Path[]): Promise<Node[]> {
  let size = 0;
  let count = 0;
  let roots = [];
  for (let path of paths) {
    let root = await createNode(path);
    for (let node of traverse(root)) {
      count++;
      size += node.size;
    }
    roots.push(root);
  }
  await printLn(`Found ${count} files, ${formatBytes(size)}`);
  return roots;
}
