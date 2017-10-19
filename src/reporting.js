// @flow

import type {CompleteNode} from './reading';
import {traverse} from './reading';
import {formatBytes, printLn} from './util';

export async function report(roots: CompleteNode[]): Promise<void> {
  let groups = gatherDuplicates(roots);

  groups = groups.sort((a, b) => groupSize(b) - groupSize(a));

  await printLn();
  for (let group of groups) {
    await printLn('Total duplicated: ' + formatBytes(groupSize(group)));
    for (let node of group) {
      await printLn('  ' + node.path.get());
    }
    await printLn();
  }
}

function groupSize(nodes: CompleteNode[]): number {
  if (nodes.length === 0) return 0;
  return deepSize(nodes[0]) * (nodes.length - 1);
}

function deepSize(node: CompleteNode): number {
  let size = 0;
  for (let node2 of traverse(node)) {
    size += node2.size;
  }
  return size;
}

function getDuplicateCids(roots: CompleteNode[]): Set<number> {
  let one = new Set();
  let many = new Set();
  for (let root of roots) {
    for (let node of traverse(root)) {
      let {cid} = node;
      if (one.has(cid)) {
        many.add(cid);
      } else {
        one.add(cid);
      }
    }
  }
  return many;
}

function gatherDuplicates(roots: CompleteNode[]): CompleteNode[][] {
  let dups = getDuplicateCids(roots);
  let map = new Map();
  function add(node: CompleteNode): void {
    let {cid} = node;
    if (!dups.has(cid)) {
      for (let child of node.children) {
        add(child);
      }
    } else {
      let list = map.get(cid);
      if (list === undefined) {
        list = [];
        map.set(cid, list);
      }
      list.push(node);
    }
  }
  for (let root of roots) {
    add(root);
  }
  return Array.from(map.values());
}