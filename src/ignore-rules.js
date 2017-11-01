// @flow
import {Node} from './scanning';

// Most of this is copied from https://www.gitignore.io/api/linux%2Cmacos%2Cwindows

const IgnoreNames: Set<string> = new Set(
  [
    // KDE/Dolphin directory preferences
    '.directory',

    // macOS Finder directory preferences
    '.DS_Store',
    // macOS resource forks
    '.AppleDouble',

    // Files that might appear in the root of a volume
    '.DocumentRevisions-V100',
    '.fseventsd',
    '.Spotlight-V100',
    '.TemporaryItems',
    '.Trashes',
    '.VolumeIcon.icns',
    '.com.apple.timemachine.donotpresent',

    // Directories potentially created on remote AFP share
    '.AppleDB',
    '.AppleDesktop',
    // 'Network Trash Folder',
    // 'Temporary Items',
    '.apdisk',

    // Windows folder config file
    'desktop.ini',

    // Windows volume recycle bin
    '$RECYCLE.BIN',

    // Windows thumbnail databases
    'Thumbs.db',
    'ehthumbs.db',
    'ehthumbs_vista.db',
  ].map(x => x.toLowerCase()),
);

const IgnorePrefixes: string[] = [
  // Temporary files created by FUSE if a file is deleted but is still open
  '.fuse_hidden',
  // Linux trash folder (suffix is user ID)
  '.Trash-',
  // Temporary files created by NFS when a file is deleted but is still open
  '.nfs',
  // macOS resource forks
  '._',
].map(x => x.toLowerCase());

export function isIgnored(node: Node): boolean {
  let {name} = node.path;
  let lower = name.toLowerCase();
  let ignore =
    IgnoreNames.has(lower) ||
    IgnorePrefixes.some(p => lower.substr(0, p.length) === p);
  // if (ignore) {
  //   console.log(`IGNORED: ${node.path.get()}`);
  // }
  return ignore;
}
