// @flow

import type {CompleteNode} from './reading';
import {traverse} from './reading';
import {formatBytes, printLn} from './util';
import * as readline from 'readline';
import * as fs from './promise_fs';
import {sep as DIR_SEP} from 'path';

export async function report(roots: CompleteNode[]): Promise<void> {
  let groups = gatherDuplicates(roots);

  await runReport(groups);
}

function amountDuplicated(nodes: CompleteNode[]): number {
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
  return Array.from(map.values()).filter(x => x.length > 1);
}

async function runReport(groups: CompleteNode[][]): Promise<void> {
  groups = groups.sort((a, b) => amountDuplicated(b) - amountDuplicated(a));

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

    let options = new Map();
    for (let i = 0; i < group.length; i++) {
      let {path} = group[i];
      options.set((i + 1) + '', {
        name: `Keep only "${path.get()}"`,
        async action() {
          for (let j = 0; j < group.length; j++) {
            let {path: path2} = group[j];
            if (i !== j) {
              await removeRecursive(path2.get());
            }
          }
          // Delete the group
          groups.splice(index, 1);
        },
      });
    }
    options.set('D', {
      name: 'Delete ALL',
      async action() {
        for (let {path} of group) {
          await removeRecursive(path.get());
        }
        // Delete the group
        groups.splice(index, 1);
      },
    });
    options.set('n', {
      name: 'Next duplicate',
      async action() {
        index++;
      },
    });
    options.set('p', {
      name: 'Previous duplicate',
      async action() {
        index--;
      },
    });
    options.set('q', {
      name: 'Quit',
      async action() {
        quit = true;
      },
    });
    await rl.choose(options);
  }
  rl.close();
  if (quit) {
    await printLn('Quit');
  } else {
    await printLn('DONE');
  }
}

interface ReadlineAction {
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
  async choose(options: Map<string, ReadlineAction>): Promise<void> {
    while (true) {
      let question = 'Please select an option:\n';
      for (let [key, {name}] of options) {
        question += `  ${key}: ${name}\n`;
      }
      question += '> ';
      let response = await new Promise(resolve => {
        this.rl.question(question, answer => {
          resolve(answer);
        });
      });
      response = response.trim();
      let option = options.get(response);
      if (option !== undefined) {
        await option.action();
        return;
      }
    }
  }
}

async function removeRecursive(path: string): Promise<void> {
  let stat = await fs.lstat(path);
  if (stat.isDirectory()) {
    for (let name of await fs.readdir(path)) {
      await removeRecursive(path + DIR_SEP + name);
    }
    await printLn('rmdir ' + path);
    await fs.rmdir(path);
  } else {
    await printLn('unlink ' + path);
    await fs.unlink(path);
  }
}
