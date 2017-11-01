// @flow

import type {CompleteNode} from './reading';
import {formatBytes, formatNumber, printLn, sum} from './util';
import * as readline from 'readline';
import * as fs from './promise_fs';
import {FileType, Node} from './scanning';

export async function report(roots: CompleteNode[]): Promise<void> {
  let groups = gatherDuplicates(roots);
  let count = formatNumber(groups.length);
  let bytes = formatBytes(sum(groups, group => amountDuplicated(group)));
  await printLn();
  await printLn(`Found ${count} duplicate sets, ${bytes} duplicated`);
  await runReport(groups);
}

function amountDuplicated(nodes: CompleteNode[]): number {
  if (nodes.length === 0) return 0;
  return deepSize(nodes[0]) * (nodes.length - 1);
}

function deepSize(node: CompleteNode): number {
  let {size} = node;
  for (let node2 of node.children) {
    size += deepSize(node2);
  }
  return size;
}

function getDuplicateCids(roots: CompleteNode[]): Set<number> {
  let one = new Set();
  let many = new Set();
  roots.forEach(function visit({cid, children}) {
    if (one.has(cid)) {
      many.add(cid);
    } else {
      one.add(cid);
    }
    children.forEach(visit);
  });
  return many;
}

function gatherDuplicates(roots: CompleteNode[]): CompleteNode[][] {
  let dups = getDuplicateCids(roots);
  let map = new Map();
  roots.forEach(function visit(node: CompleteNode): void {
    let {cid} = node;
    if (!dups.has(cid)) {
      node.children.forEach(visit);
    } else {
      let list = map.get(cid);
      if (list === undefined) {
        map.set(cid, [node]);
      } else {
        list.push(node);
      }
    }
  });
  return Array.from(map.values()).filter(x => x.length > 1);
}

async function runReport(groups: CompleteNode[][]): Promise<void> {
  groups.sort((a, b) => amountDuplicated(b) - amountDuplicated(a));

  let rl = new Readline();
  let index = 0;
  let quit = false;
  while (groups.length > 0 && !quit) {
    index = (index + groups.length) % groups.length;
    let group = groups[index];
    let count = group.length;
    let bytes = formatBytes(amountDuplicated(group));
    let info = group[0].type.name + ' ' + group[0].cid;

    await printLn();
    await printLn(
      `${index +
        1}/${groups.length}: ${info} (${count} copies, ${bytes} duplicated)`,
    );

    await rl.choose(
      group
        .map(({path}, i) => ({
          key: `${i + 1}`,
          name: `Keep only "${path.get()}"`,
          async action() {
            let j = 0;
            for (let node of group) {
              if (i !== j) {
                await removeRecursive(node);
              }
              j++;
            }
            // Delete the group
            groups.splice(index, 1);
          },
        }))
        .concat([
          {
            key: 'D',
            name: 'Delete ALL',
            async action() {
              for (let node of group) {
                await removeRecursive(node);
              }
              // Delete the group
              groups.splice(index, 1);
            },
          },
          {
            key: 'n',
            name: 'Next duplicate',
            async action() {
              index++;
            },
          },
          {
            key: 'p',
            name: 'Previous duplicate',
            async action() {
              index--;
            },
          },
          {
            key: 'q',
            name: 'Quit',
            async action() {
              quit = true;
            },
          },
        ]),
    );
  }
  rl.close();
  await printLn();
  if (quit) {
    await printLn('Quit');
  } else {
    await printLn('DONE');
  }
}

interface ReadlineAction {
  +key: string;
  +name: string;
  +action: () => Promise<void>;
}

class Readline {
  rl: readline.Interface;
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }
  close(): void {
    this.rl.close();
  }
  async choose(options: ReadlineAction[]): Promise<void> {
    while (true) {
      let question = 'Please select an option:\n';
      for (let {key, name} of options) {
        question += `  ${key}: ${name}\n`;
      }
      question += '> ';
      let response = await new Promise(resolve => {
        this.rl.question(question, answer => {
          resolve(answer);
        });
      });
      response = response.trim();
      for (let {key, action} of options) {
        if (key === response) {
          await action();
          return;
        }
      }
    }
  }
}

async function removeRecursive(node: Node): Promise<void> {
  // It is important that we use the original file tree to do the removal.
  // This way if a new file has been added to the directory, we get a ENOENT
  // and we don't accidentally remove more than we expected to.
  // This doesn't verify that files haven't changed before we remove them,
  // though.
  for (let child of node.children) {
    await removeRecursive(child);
  }
  let path = node.path.get();
  if (node.type === FileType.Directory) {
    await printLn('rmdir ' + path);
    await fs.rmdir(path);
  } else {
    await printLn('unlink ' + path);
    await fs.unlink(path);
  }
}
