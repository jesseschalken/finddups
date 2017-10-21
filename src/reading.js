// @flow

import type {Node} from './scanning';
import {FileReader} from './file-reader';
import * as fs from './promise_fs';
import {FileType} from './scanning';
import {padString, printLn, newCid} from './util';

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

class StringCids {
  map = new Map();
  // noinspection JSUnusedGlobalSymbols
  get(str: string): number {
    let cid = this.map.get(str);
    if (cid === undefined) {
      cid = newCid();
      this.map.set(str, cid);
    }
    return cid;
  }
}

const DirContentCids = new StringCids();
const LinkContentCids = new StringCids();

async function dirContent(nodes: $ReadOnlyArray<PendingNode>): Promise<string> {
  let data = '';
  for (let node of nodes) {
    let {path, cid} = node;
    data += padString((await cid) + '', 20) + ' ' + path.name + '\n';
  }
  return data;
}

async function nodeContent(
  node: Node,
  children: PendingNode[],
  reader: FileReader,
): Promise<number> {
  switch (node.type) {
    case FileType.File:
      return reader.add(node);
    case FileType.Directory:
      return DirContentCids.get(await dirContent(children));
    case FileType.Symlink:
      return LinkContentCids.get(await fs.readlink(node.path.get()));
    default:
      // For types other than file, directory or symlink, just use the cid
      // attached to the file type.
      return node.type.cid;
  }
}

function start(node: Node, reader: FileReader): PendingNode {
  let {path, type, size} = node;
  let children = node.children.map(node => start(node, reader));
  let cid = nodeContent(node, children, reader);
  return {path, size, children, type, cid};
}

async function finish(node: PendingNode): Promise<CompleteNode> {
  let {path, type, size} = node;
  let children = await Promise.all(node.children.map(finish));
  let cid = await node.cid;
  return {path, size, type, cid, children};
}

export async function read(nodes: Node[]): Promise<CompleteNode[]> {
  await printLn('Reading file data');
  let reader = new FileReader();
  let started = nodes.map(node => start(node, reader));
  await reader.run();
  return await Promise.all(started.map(finish));
}
