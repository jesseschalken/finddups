`finddups` is a command line tool to find and remove duplicate files and directory trees for Windows, macOS and Linux. It aims to be as efficient as possible, only reading as much of each file as required to determine if it is unique.

It considers only the contents of files and directories and the destination of symbolic links to determine duplicates. Filesystem metadata such as permissions, ACLs, MAC times and xattrs are ignored.

Files automatically created by file managers and operating systems, such as `.DS_Store`, `Thumbs.db` or `._*` files are counted when determining uniqueness of directories. It is recommended to remove these files before running `finddups`.

### Installation

1. Install [Node.js](https://nodejs.org/) version 8.7 or greater.
2. Install the package via `npm`:

   ```
   $ npm install -g finddups
   ```

### Usage

Run it and pass it one or more directories or directories to scan for duplicates. Once finished, it will present a list with the biggest duplicate sets first. You can step through the list with `n` and `p`, action the current duplicate set with `1`,`2`,`3`..etc and `D`, or quit with `q`.

Example:

```
$ finddups ~/my_stuff /media/some_drive ~/some_file.doc
Scanning /home/bob/my_stuff
Scanning /media/some_drive
Scanning /home/bob/some_file.doc
Found 378,082 files, 941.79 GB
Reading file data of potential duplicates
1.64% of 15.98 GB, 52.73 MB/s, ETA 00:04:58
21.73% of 15.89 GB, 62.79 MB/s, ETA 00:03:18
...
83.65% of 15.76 GB, 73.25 MB/s, ETA 00:00:35
100.00% of 15.76 GB, 76.57 MB/s, ETA 00:00:00

Found 441 duplicate sets, 7.82 GB duplicated

1/441: dir 10945 (3 copies, 734.82 MB duplicated)
Please select an option:
  1: Keep only "/home/bob/my_stuff/some dir/Foo Photos"
  2: Keep only "/media/some_drive/blah/Photos/Foo Photos"
  3: Keep only "/media/some_drive/Desktop/Old Stuff/Foo Photos"
  D: Delete ALL
  n: Next duplicate
  p: Previous duplicate
  q: Quit
> █
```

### Development

`finddups` is a Node.js project using [Babel](https://babeljs.io/), [Flow](https://flow.org/) and [Prettier](https://prettier.io/) and has no runtime dependencies. Sources are in `src/` and are compiled into `dist/` with `babel src --out-dir dist --source-maps`. The main entry point is `dist/main.js`.
