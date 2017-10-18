// @flow

import type {Node} from './scanning';
import {FileReader} from './file-reader';
import * as fs from 'fs';
import {FileType} from './scanning';
import {pad} from './util';

async function readlink(path: string): Promise<string> {
  let buffer = await new Promise((resolve, reject) => {
    fs.readlink(path, (err, buffer) => {
      err ? reject(err) : resolve(buffer);
    });
  });
  return buffer instanceof Buffer ? buffer.toString() : buffer;
}

export interface CompleteNode extends Node {
  +cid: number;
  +children: $ReadOnlyArray<CompleteNode>;
}

export function* traverse(node: CompleteNode): Iterable<CompleteNode> {
  yield node;
  for (let child of node.children) {
    yield* traverse(child);
  }
}

interface PendingNode extends Node {
  +cid: Promise<number>;
  +children: $ReadOnlyArray<PendingNode>;
}

const StringIds = new class {
  next = 1;
  map = new Map();
  // noinspection JSUnusedGlobalSymbols
  get(str: string): number {
    let id = this.map.get(str);
    if (id === undefined) {
      id = this.next++;
      this.map.set(str, id);
    }
    return id;
  }
}();

async function dirContent(nodes: $ReadOnlyArray<PendingNode>): Promise<string> {
  let data = '';
  for (let node of nodes) {
    let {path, type, cid} = node;
    data += pad(type.name + ' ' + (await cid), 20) + ' ' + path.name + '\n';
  }
  return data;
}

function nodeContent(node: Node, children: PendingNode[],
    reader: FileReader): Promise<number> {
  switch (node.type) {
    case FileType.File:
      return reader.add(node);
    case FileType.Dir:
      return dirContent(children).then(x => StringIds.get(x));
    case FileType.Link:
      return readlink(node.path.get()).then(x => StringIds.get(x));
    default:
      return Promise.resolve(0);
  }
}

function start(node: Node, reader: FileReader): PendingNode {
  let {path, size, type} = node;
  let children = node.children.map(node => start(node, reader));
  let cid = nodeContent(node, children, reader);
  return {path, size, children, type, cid};
}

async function finish(node: PendingNode): Promise<CompleteNode> {
  let {path, size, type} = node;
  let children = await Promise.all(node.children.map(finish));
  let cid = await node.cid;
  return {path, size, type, cid, children};
}

export async function read(nodes: Node[]): Promise<CompleteNode[]> {
  let reader = new FileReader();
  let started = nodes.map(node => start(node, reader));
  await reader.run();
  return await Promise.all(started.map(finish));
}
