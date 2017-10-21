'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Progress = undefined;

var _util = require('./util');

function formatTime(t) {
  if (!Number.isFinite(t)) return 'forever';
  let h = (0, _util.formatNumber)(t / 3600000, 0, 2);
  let m = (0, _util.formatNumber)(t / 60000 % 60, 0, 2);
  let s = (0, _util.formatNumber)(t / 1000 % 60, 0, 2);
  return h + ':' + m + ':' + s;
}

function formatPercent(x) {
  if (!Number.isFinite(x)) x = 1;
  return (0, _util.formatNumber)(x * 100, 2) + '%';
}

function formatRate(r) {
  if (!Number.isFinite(r)) return 'infinite';
  return (0, _util.formatBytes)(r * 1000) + '/s';
}

class Progress {

  constructor(total = 0) {
    this.start = 0;
    this.total = 0;
    this.done = 0;
    this.running = false;
    this.delay = 1000;

    this.total = total;
    this.start = Date.now();
  }

  print() {
    return (0, _util.printLn)(this.format());
  }

  format() {
    let { done, total, start } = this;
    let passed = Date.now() - start;
    let rate = formatRate(done / passed);
    let percent = formatPercent(done / total);
    // The ETA is the milliseconds per byte so far (passed / done) multiplied
    // by the number of bytes remaining (total - done)
    let eta = formatTime((total - done) * (passed / done));

    return `${percent} of ${(0, _util.formatBytes)(total)}, ${rate}, ETA ${eta}`;
  }
}
exports.Progress = Progress;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9wcm9ncmVzcy5qcyJdLCJuYW1lcyI6WyJmb3JtYXRUaW1lIiwidCIsIk51bWJlciIsImlzRmluaXRlIiwiaCIsIm0iLCJzIiwiZm9ybWF0UGVyY2VudCIsIngiLCJmb3JtYXRSYXRlIiwiciIsIlByb2dyZXNzIiwiY29uc3RydWN0b3IiLCJ0b3RhbCIsInN0YXJ0IiwiZG9uZSIsInJ1bm5pbmciLCJkZWxheSIsIkRhdGUiLCJub3ciLCJwcmludCIsImZvcm1hdCIsInBhc3NlZCIsInJhdGUiLCJwZXJjZW50IiwiZXRhIl0sIm1hcHBpbmdzIjoiOzs7Ozs7O0FBRUE7O0FBRUEsU0FBU0EsVUFBVCxDQUFvQkMsQ0FBcEIsRUFBdUM7QUFDckMsTUFBSSxDQUFDQyxPQUFPQyxRQUFQLENBQWdCRixDQUFoQixDQUFMLEVBQXlCLE9BQU8sU0FBUDtBQUN6QixNQUFJRyxJQUFJLHdCQUFhSCxJQUFJLE9BQWpCLEVBQTBCLENBQTFCLEVBQTZCLENBQTdCLENBQVI7QUFDQSxNQUFJSSxJQUFJLHdCQUFjSixJQUFJLEtBQUwsR0FBYyxFQUEzQixFQUErQixDQUEvQixFQUFrQyxDQUFsQyxDQUFSO0FBQ0EsTUFBSUssSUFBSSx3QkFBY0wsSUFBSSxJQUFMLEdBQWEsRUFBMUIsRUFBOEIsQ0FBOUIsRUFBaUMsQ0FBakMsQ0FBUjtBQUNBLFNBQU9HLElBQUksR0FBSixHQUFVQyxDQUFWLEdBQWMsR0FBZCxHQUFvQkMsQ0FBM0I7QUFDRDs7QUFFRCxTQUFTQyxhQUFULENBQXVCQyxDQUF2QixFQUEwQztBQUN4QyxNQUFJLENBQUNOLE9BQU9DLFFBQVAsQ0FBZ0JLLENBQWhCLENBQUwsRUFBeUJBLElBQUksQ0FBSjtBQUN6QixTQUFPLHdCQUFhQSxJQUFJLEdBQWpCLEVBQXNCLENBQXRCLElBQTJCLEdBQWxDO0FBQ0Q7O0FBRUQsU0FBU0MsVUFBVCxDQUFvQkMsQ0FBcEIsRUFBdUM7QUFDckMsTUFBSSxDQUFDUixPQUFPQyxRQUFQLENBQWdCTyxDQUFoQixDQUFMLEVBQXlCLE9BQU8sVUFBUDtBQUN6QixTQUFPLHVCQUFZQSxJQUFJLElBQWhCLElBQXdCLElBQS9CO0FBQ0Q7O0FBRU0sTUFBTUMsUUFBTixDQUFlOztBQU9wQkMsY0FBWUMsUUFBZ0IsQ0FBNUIsRUFBK0I7QUFBQSxTQU4vQkMsS0FNK0IsR0FOZixDQU1lO0FBQUEsU0FML0JELEtBSytCLEdBTGYsQ0FLZTtBQUFBLFNBSi9CRSxJQUkrQixHQUpoQixDQUlnQjtBQUFBLFNBSC9CQyxPQUcrQixHQUhaLEtBR1k7QUFBQSxTQUYvQkMsS0FFK0IsR0FGZixJQUVlOztBQUM3QixTQUFLSixLQUFMLEdBQWFBLEtBQWI7QUFDQSxTQUFLQyxLQUFMLEdBQWFJLEtBQUtDLEdBQUwsRUFBYjtBQUNEOztBQUVEQyxVQUF1QjtBQUNyQixXQUFPLG1CQUFRLEtBQUtDLE1BQUwsRUFBUixDQUFQO0FBQ0Q7O0FBRURBLFdBQWlCO0FBQ2YsUUFBSSxFQUFDTixJQUFELEVBQU9GLEtBQVAsRUFBY0MsS0FBZCxLQUF1QixJQUEzQjtBQUNBLFFBQUlRLFNBQVNKLEtBQUtDLEdBQUwsS0FBYUwsS0FBMUI7QUFDQSxRQUFJUyxPQUFPZCxXQUFXTSxPQUFPTyxNQUFsQixDQUFYO0FBQ0EsUUFBSUUsVUFBVWpCLGNBQWNRLE9BQU9GLEtBQXJCLENBQWQ7QUFDQTtBQUNBO0FBQ0EsUUFBSVksTUFBTXpCLFdBQVcsQ0FBQ2EsUUFBUUUsSUFBVCxLQUFrQk8sU0FBU1AsSUFBM0IsQ0FBWCxDQUFWOztBQUVBLFdBQVEsR0FBRVMsT0FBUSxPQUFNLHVCQUFZWCxLQUFaLENBQW1CLEtBQUlVLElBQUssU0FBUUUsR0FBSSxFQUFoRTtBQUNEO0FBMUJtQjtRQUFUZCxRLEdBQUFBLFEiLCJmaWxlIjoicHJvZ3Jlc3MuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBAZmxvd1xuXG5pbXBvcnQge2Zvcm1hdEJ5dGVzLCBmb3JtYXROdW1iZXIsIHByaW50TG59IGZyb20gJy4vdXRpbCc7XG5cbmZ1bmN0aW9uIGZvcm1hdFRpbWUodDogbnVtYmVyKTogc3RyaW5nIHtcbiAgaWYgKCFOdW1iZXIuaXNGaW5pdGUodCkpIHJldHVybiAnZm9yZXZlcic7XG4gIGxldCBoID0gZm9ybWF0TnVtYmVyKHQgLyAzNjAwMDAwLCAwLCAyKTtcbiAgbGV0IG0gPSBmb3JtYXROdW1iZXIoKHQgLyA2MDAwMCkgJSA2MCwgMCwgMik7XG4gIGxldCBzID0gZm9ybWF0TnVtYmVyKCh0IC8gMTAwMCkgJSA2MCwgMCwgMik7XG4gIHJldHVybiBoICsgJzonICsgbSArICc6JyArIHM7XG59XG5cbmZ1bmN0aW9uIGZvcm1hdFBlcmNlbnQoeDogbnVtYmVyKTogc3RyaW5nIHtcbiAgaWYgKCFOdW1iZXIuaXNGaW5pdGUoeCkpIHggPSAxO1xuICByZXR1cm4gZm9ybWF0TnVtYmVyKHggKiAxMDAsIDIpICsgJyUnO1xufVxuXG5mdW5jdGlvbiBmb3JtYXRSYXRlKHI6IG51bWJlcik6IHN0cmluZyB7XG4gIGlmICghTnVtYmVyLmlzRmluaXRlKHIpKSByZXR1cm4gJ2luZmluaXRlJztcbiAgcmV0dXJuIGZvcm1hdEJ5dGVzKHIgKiAxMDAwKSArICcvcyc7XG59XG5cbmV4cG9ydCBjbGFzcyBQcm9ncmVzcyB7XG4gIHN0YXJ0OiBudW1iZXIgPSAwO1xuICB0b3RhbDogbnVtYmVyID0gMDtcbiAgZG9uZTogbnVtYmVyID0gMDtcbiAgcnVubmluZzogYm9vbGVhbiA9IGZhbHNlO1xuICBkZWxheTogbnVtYmVyID0gMTAwMDtcblxuICBjb25zdHJ1Y3Rvcih0b3RhbDogbnVtYmVyID0gMCkge1xuICAgIHRoaXMudG90YWwgPSB0b3RhbDtcbiAgICB0aGlzLnN0YXJ0ID0gRGF0ZS5ub3coKTtcbiAgfVxuXG4gIHByaW50KCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHJldHVybiBwcmludExuKHRoaXMuZm9ybWF0KCkpO1xuICB9XG5cbiAgZm9ybWF0KCk6IHN0cmluZyB7XG4gICAgbGV0IHtkb25lLCB0b3RhbCwgc3RhcnR9ID0gdGhpcztcbiAgICBsZXQgcGFzc2VkID0gRGF0ZS5ub3coKSAtIHN0YXJ0O1xuICAgIGxldCByYXRlID0gZm9ybWF0UmF0ZShkb25lIC8gcGFzc2VkKTtcbiAgICBsZXQgcGVyY2VudCA9IGZvcm1hdFBlcmNlbnQoZG9uZSAvIHRvdGFsKTtcbiAgICAvLyBUaGUgRVRBIGlzIHRoZSBtaWxsaXNlY29uZHMgcGVyIGJ5dGUgc28gZmFyIChwYXNzZWQgLyBkb25lKSBtdWx0aXBsaWVkXG4gICAgLy8gYnkgdGhlIG51bWJlciBvZiBieXRlcyByZW1haW5pbmcgKHRvdGFsIC0gZG9uZSlcbiAgICBsZXQgZXRhID0gZm9ybWF0VGltZSgodG90YWwgLSBkb25lKSAqIChwYXNzZWQgLyBkb25lKSk7XG5cbiAgICByZXR1cm4gYCR7cGVyY2VudH0gb2YgJHtmb3JtYXRCeXRlcyh0b3RhbCl9LCAke3JhdGV9LCBFVEEgJHtldGF9YDtcbiAgfVxufVxuIl19