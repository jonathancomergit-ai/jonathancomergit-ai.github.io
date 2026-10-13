/* ============================================================
   AlgoVision - Arrays

   The array is drawn as it sits in memory: a row of same-size
   cells, each with an index above and an address below. Every
   button runs one operation on the CURRENT array and records
   frames, exactly like the sorting page. The array keeps the
   result, so operations build on each other.
   ============================================================ */

(function () {
  "use strict";

  var $ = function (s) { return document.querySelector(s); };
  var SIZE = 4, MAX_CAP = 32;

  /* start = where the block begins in memory. It changes when the
     array grows, because the bigger block is somewhere else. */
  function fresh() { return { cells: [12, 7, 33, 5, 21, 9, null, null], len: 6, start: 0x1000 }; }
  var state = fresh();

  function hex(i, start) { return "0x" + ((start || state.start) + i * SIZE).toString(16).toUpperCase(); }
  function b(v) { return "<b>" + v + "</b>"; }

  /* ---------- recording ---------- */

  function Rec() {
    var r = { cells: state.cells.slice(), len: state.len, start: state.start, steps: 0, frames: [], newCells: null, newStart: 0 };
    r.snap = function (line, msg, hl, ptr, more) {
      var f = {
        cells: r.cells.slice(), len: r.len, start: r.start, line: line, msg: msg, hl: hl || {}, ptr: ptr || {},
        steps: r.steps, newCells: r.newCells ? r.newCells.slice() : null, newStart: r.newStart
      };
      if (more) { for (var k in more) { f[k] = more[k]; } }
      r.frames.push(f);
    };
    return r;
  }
  function H() {
    var o = {};
    for (var i = 0; i < arguments.length; i += 2) { o[arguments[i]] = arguments[i + 1]; }
    return o;
  }

  /* Copy into a block twice the size. `line` = which code line is "grow". */
  function grow(r, lines) {
    var cap = r.cells.length;
    r.snap(lines.check, "The array is " + b("full") + ": all " + cap + " cells are used, and the memory " +
      "right after it might belong to something else. So we have to move house.");
    r.newCells = new Array(cap * 2).fill(null);
    r.newStart = r.start + 0x1000;
    r.snap(lines.alloc, "Ask for a new block " + b("twice as big") + " (" + cap * 2 + " cells). It's somewhere else in memory, at " +
      b(hex(0, r.newStart)) + ".");
    for (var i = 0; i < r.len; i++) {
      r.newCells[i] = r.cells[i];
      r.steps++;
      r.snap(lines.copy, "Copy " + b(r.cells[i]) + " from old index " + i + " to the new block.",
        H(i, "compare"), {}, { newHl: H(i, "write") });
    }
    r.cells = r.newCells;
    r.start = r.newStart;
    r.newCells = null;
    r.snap(lines.swap, "Done moving. The old block is freed. This copy cost " + b(r.len + " steps") +
      ", but it only happens when the array fills up, so on average appending is still O(1).");
  }

  /* ---------- the operations ---------- */

  var OPS = {
    read: {
      label: "Read a[i]", big: "O(1)", cls: "is-o1", needs: "i",
      code: [
        "def get(a, i):",
        "    address = start + i * 4  # every cell is 4 bytes",
        "    return memory[address]"
      ],
      run: function (r, i) {
        if (!inRange(r, i)) { return; }
        r.snap(1, "Work out where a[" + i + "] lives: " + b(hex(0, r.start) + " + " + i + " × 4 = " + hex(i, r.start)) +
          ". Just maths, no searching.", H(i, "focus"), P(i, "i"), { formula: i });
        r.steps++;
        r.snap(2, "Jump straight to " + hex(i, r.start) + " and read " + b(r.cells[i]) + ". " + b("1 step") +
          ", whether the array holds 6 numbers or 6 million. That's O(1).", H(i, "compare"), P(i, "i"), { formula: i });
      }
    },
    write: {
      label: "Write a[i] = v", big: "O(1)", cls: "is-o1", needs: "iv",
      code: [
        "def set(a, i, value):",
        "    address = start + i * 4",
        "    memory[address] = value"
      ],
      run: function (r, i, v) {
        if (!inRange(r, i)) { return; }
        r.snap(1, "Same address maths: a[" + i + "] is at " + b(hex(i, r.start)) + ".", H(i, "focus"), P(i, "i"), { formula: i });
        r.cells[i] = v;
        r.steps++;
        r.snap(2, "Overwrite it with " + b(v) + ". One step: O(1).", H(i, "write"), P(i, "i"), { formula: i });
      }
    },
    append: {
      label: "Append v", big: "O(1)*", cls: "is-o1", needs: "v",
      code: [
        "def append(a, value):",
        "    if a.length == a.capacity:",
        "        grow(a)  # full: move to a bigger block",
        "    a[a.length] = value",
        "    a.length += 1",
        "",
        "def grow(a):",
        "    new = allocate(a.capacity * 2)",
        "    for i in range(a.length):",
        "        new[i] = a[i]",
        "    a.memory = new"
      ],
      run: function (r, i, v) {
        if (r.len === r.cells.length) {
          if (r.cells.length * 2 > MAX_CAP) { return tooBig(r, 1); }
          grow(r, { check: 1, alloc: 7, copy: 9, swap: 10 });
        } else {
          r.snap(1, "Is there room? " + (r.cells.length - r.len) + " empty cell" +
            (r.cells.length - r.len === 1 ? "" : "s") + " left, so yes.", {}, P(r.len, "len"));
        }
        r.cells[r.len] = v;
        r.steps++;
        r.snap(3, "Drop " + b(v) + " into the first empty cell, index " + r.len + ". Nothing else moves.",
          H(r.len, "write"), P(r.len, "len"));
        r.len++;
        r.snap(4, "Length is now " + r.len + ".", H(r.len - 1, "done"));
      }
    },
    insert: {
      label: "Insert v at i", big: "O(n)", cls: "is-on", needs: "iv",
      code: [
        "def insert(a, i, value):",
        "    if a.length == a.capacity:",
        "        grow(a)",
        "    for k in range(a.length, i, -1):",
        "        a[k] = a[k - 1]  # shift right to make a gap",
        "    a[i] = value",
        "    a.length += 1"
      ],
      run: function (r, i, v) {
        if (i < 0 || i > r.len) {
          r.snap(0, "Can't insert at index " + i + ". Pick something from 0 to " + r.len + ".");
          return;
        }
        if (r.len === r.cells.length) {
          if (r.cells.length * 2 > MAX_CAP) { return tooBig(r, 1); }
          grow(r, { check: 1, alloc: 2, copy: 2, swap: 2 });
        }
        var moves = r.len - i;
        r.snap(3, "Cells can't squeeze apart, so to open a gap at index " + i + " every value from there to the end has to " +
          b("shift right one") + ". That's " + moves + " move" + (moves === 1 ? "" : "s") + ".", H(i, "focus"), P(i, "i"));
        for (var k = r.len; k > i; k--) {
          r.cells[k] = r.cells[k - 1];
          r.steps++;
          r.snap(4, "Copy " + b(r.cells[k]) + " from index " + (k - 1) + " to " + k + ".",
            H(k, "write", k - 1, "compare"), P(k, "k", k - 1, "k-1"));
        }
        r.cells[i] = v;
        r.steps++;
        r.snap(5, "The gap is open. Write " + b(v) + " into index " + i + ".", H(i, "write"), P(i, "i"));
        r.len++;
        r.snap(6, moves === 0
          ? "Done, with " + b("zero shifts") + ": inserting at the very end is the best case."
          : "Done. That took " + b(moves + " shift" + (moves === 1 ? "" : "s")) + ". Insert at index 0 and " +
            "everything moves, which is the O(n) worst case. Insert at the end and nothing does.", H(i, "done"));
      }
    },
    remove: {
      label: "Remove a[i]", big: "O(n)", cls: "is-on", needs: "i",
      code: [
        "def remove(a, i):",
        "    for k in range(i, a.length - 1):",
        "        a[k] = a[k + 1]  # shift left to close the gap",
        "    a.length -= 1"
      ],
      run: function (r, i) {
        if (!inRange(r, i)) { return; }
        r.snap(0, "Remove " + b(r.cells[i]) + " from index " + i + ". It'll leave a hole, and arrays don't allow holes.",
          H(i, "focus"), P(i, "i"));
        for (var k = i; k < r.len - 1; k++) {
          r.cells[k] = r.cells[k + 1];
          r.steps++;
          r.snap(2, "Shift " + b(r.cells[k]) + " left from index " + (k + 1) + " to " + k + ".",
            H(k, "write", k + 1, "compare"), P(k, "k", k + 1, "k+1"));
        }
        r.cells[r.len - 1] = null;
        r.len--;
        r.snap(3, "The last cell is now unused. Length is " + r.len + ". Removing from the front shifts everything: O(n).");
      }
    },
    find: {
      label: "Linear search for v", big: "O(n)", cls: "is-on", needs: "v",
      code: [
        "def find(a, target):",
        "    for i in range(a.length):",
        "        if a[i] == target:",
        "            return i",
        "    return -1  # not here"
      ],
      run: function (r, i, v) {
        r.snap(0, "Look for " + b(v) + ". We don't know where it is, so check each cell from the start.");
        for (var k = 0; k < r.len; k++) {
          r.steps++;
          var hit = r.cells[k] === v;
          r.snap(2, "Is a[" + k + "] = " + b(r.cells[k]) + " equal to " + v + "? " + (hit ? "Yes!" : "No."),
            H(k, hit ? "done" : "compare"), P(k, "i"));
          if (hit) {
            r.snap(3, "Found " + b(v) + " at index " + k + " after " + b(r.steps + " checks") +
              ". Worst case (it's last, or missing) you check all n: O(n).", H(k, "done"), P(k, "i"));
            return;
          }
        }
        r.snap(4, b(v) + " isn't in the array. We had to check all " + b(r.len) + " cells to be sure. That's the O(n) worst case.");
      }
    },
    bsearch: {
      label: "Binary search for v", big: "O(log n)", cls: "is-ologn", needs: "v",
      code: [
        "def binary_search(a, target):",
        "    lo, hi = 0, a.length - 1",
        "    while lo <= hi:",
        "        mid = (lo + hi) // 2",
        "        if a[mid] == target:",
        "            return mid",
        "        if a[mid] < target:",
        "            lo = mid + 1  # throw away the left half",
        "        else:",
        "            hi = mid - 1  # throw away the right half",
        "    return -1"
      ],
      run: function (r, i, v) {
        if (!sorted(r)) {
          r.snap(0, "Binary search only works on a " + b("sorted") + " array: it relies on knowing which half the target " +
            "must be in. Press " + b("Sort it") + " first.");
          return;
        }
        var lo = 0, hi = r.len - 1;
        function out() {
          var o = {};
          for (var k = 0; k < r.len; k++) { if (k < lo || k > hi) { o[k] = "out"; } }
          return o;
        }
        r.snap(1, "Look for " + b(v) + ". The answer could be anywhere from index " + lo + " to " + hi + ".",
          out(), P(lo, "lo", hi, "hi"));
        while (lo <= hi) {
          var mid = (lo + hi) >> 1;
          r.steps++;
          var hl = out(); hl[mid] = "compare";
          r.snap(4, "Check the middle: a[" + mid + "] = " + b(r.cells[mid]) + ".", hl, P(lo, "lo", mid, "mid", hi, "hi"));
          if (r.cells[mid] === v) {
            var h2 = out(); h2[mid] = "done";
            r.snap(5, "Found " + b(v) + " at index " + mid + " in just " + b(r.steps + " check" + (r.steps === 1 ? "" : "s")) +
              ". Each check halves what's left: O(log n).", h2, P(mid, "mid"));
            return;
          }
          if (r.cells[mid] < v) {
            lo = mid + 1;
            r.snap(7, r.cells[mid] + " is smaller than " + v + ", so " + v + " can only be to the " + b("right") +
              ". Throw away the left half.", out(), P(lo, "lo", hi, "hi"));
          } else {
            hi = mid - 1;
            r.snap(9, r.cells[mid] + " is bigger than " + v + ", so " + v + " can only be to the " + b("left") +
              ". Throw away the right half.", out(), P(lo, "lo", hi, "hi"));
          }
        }
        r.snap(10, "Nothing left to search: " + b(v) + " isn't here. That took " + b(r.steps) +
          " checks for " + r.len + " numbers. Linear search would have needed " + r.len + ".");
      }
    }
  };

  function P() {
    var o = {};
    for (var i = 0; i < arguments.length; i += 2) {
      var k = arguments[i];
      o[k] = o[k] ? o[k] + "," + arguments[i + 1] : arguments[i + 1];
    }
    return o;
  }
  function inRange(r, i) {
    if (i >= 0 && i < r.len && !isNaN(i)) { return true; }
    r.snap(0, b("IndexError") + ": index " + i + " is outside the array. Valid indexes are 0 to " + (r.len - 1) + ".");
    return false;
  }
  function sorted(r) {
    for (var k = 1; k < r.len; k++) { if (r.cells[k - 1] > r.cells[k]) { return false; } }
    return true;
  }
  function tooBig(r, line) {
    r.snap(line, "The array is full, and AlgoVision stops at " + MAX_CAP + " cells so it fits on screen. Remove something first.");
  }

  /* ---------- drawing ---------- */

  var memEl = $("#mem"), newEl = $("#mem-new"), newLabel = $("#mem-new-label");
  var say = $("#say"), formula = $("#formula"), stepsEl = $("#steps"), lenEl = $("#len"), capEl = $("#cap");

  function strip(host, cells, len, hl, ptr, start) {
    host.innerHTML = "";
    cells.forEach(function (v, i) {
      var h = hl && hl[i];
      var c = AV.el("div", "av-cell" + (v === null || i >= len ? " is-empty" : "") + (h ? " is-" + h : ""));
      c.innerHTML = '<div class="tag-ptr">' + ((ptr && ptr[i]) || "") + "</div>" +
        '<div class="idx">[' + i + "]</div>" +
        '<div class="val">' + (v === null || i >= len ? "" : v) + "</div>" +
        '<div class="addr">' + hex(i, start) + "</div>";
      host.appendChild(c);
    });
  }

  /* If any step of this run moves house, the "new block" row keeps its
     space for the whole run (invisible when unused), so the page below
     it doesn't jump when the copy starts and ends. */
  var growSize = 0;
  function render(f, i, all) {
    strip(memEl, f.cells, f.len, f.hl, f.ptr, f.start);
    growSize = 0;
    all.forEach(function (x) { if (x.newCells) { growSize = x.newCells.length; } });
    newEl.hidden = newLabel.hidden = !growSize;
    newEl.style.visibility = newLabel.style.visibility = f.newCells ? "visible" : "hidden";
    if (f.newCells) {
      strip(newEl, f.newCells, f.len, f.newHl, {}, f.newStart);
    } else if (growSize) {
      strip(newEl, new Array(growSize).fill(null), 0, {}, {}, f.start);
    }
    say.innerHTML = f.msg;
    code.mark(f.line);
    stepsEl.textContent = f.steps;
    lenEl.textContent = f.len;
    capEl.textContent = f.cells.length;
    formula.innerHTML = formulaHtml(f);
  }
  function formulaHtml(f) {
    var k = f.formula;
    return k != null
      ? "address of a[" + k + "] = " + hex(0, f.start) + " + " + k + " &times; 4 = <b>" + hex(k, f.start) + "</b>"
      : "address of a[i] = <b>start + i &times; 4</b> &nbsp;(every number takes 4 bytes)";
  }

  var code = AV.Code($("#code"), [], $("#now"));
  var player = AV.Player($("#controls"), render, {
    keys: true, speed: 1,
    steady: [
      { el: say, html: function (f) { return f.msg; } },
      { el: formula, html: formulaHtml }
    ]
  });

  /* ---------- buttons ---------- */

  var iIn = $("#in-i"), vIn = $("#in-v"), opName = $("#op-name"), opBadge = $("#op-badge");
  var current = "read";

  function run(name) {
    var op = OPS[name];
    current = name;
    document.querySelectorAll("[data-op]").forEach(function (x) {
      x.setAttribute("aria-pressed", x.getAttribute("data-op") === name ? "true" : "false");
    });
    code.load(op.code);
    opName.textContent = op.label;
    opBadge.textContent = op.big;
    opBadge.className = "av-badge " + op.cls;
    var r = Rec();
    op.run(r, parseInt(iIn.value, 10), parseInt(vIn.value, 10));
    if (!r.frames.length) { r.snap(0, "Nothing to do."); }
    state = { cells: r.cells.slice(), len: r.len, start: r.start };
    player.load(r.frames);
    if (!AV.calm) { player.play(); }
    /* On a phone the buttons sit below the memory strip, so bring the
       animation back into view. */
    if (window.innerWidth < 900) {
      memEl.closest(".av-panel").scrollIntoView({ behavior: AV.calm ? "auto" : "smooth", block: "start" });
    }
  }

  var opsEl = $("#ops");
  Object.keys(OPS).forEach(function (k) {
    var op = OPS[k];
    var btn = AV.el("button", "av-op", "<span>" + op.label + '</span><span class="av-badge ' + op.cls + '">' + op.big + "</span>");
    btn.type = "button";
    btn.setAttribute("data-op", k);
    btn.setAttribute("aria-pressed", "false");
    btn.addEventListener("click", function () { run(k); });
    opsEl.appendChild(btn);
  });

  function idle(msg) {
    var r = Rec();
    r.snap(-1, msg);
    player.load(r.frames);
  }

  $("#sort-it").addEventListener("click", function () {
    var vals = state.cells.slice(0, state.len).sort(function (x, y) { return x - y; });
    vals.forEach(function (v, k) { state.cells[k] = v; });
    idle("Sorted (instantly, behind the scenes). Now binary search will work. Want to see how sorting happens? " +
      '<a href="sorting.html">The sorting module</a> shows every step.');
  });
  $("#reset").addEventListener("click", function () {
    state = fresh();
    idle("Back to the starting array: 6 numbers in 8 cells.");
  });
  $("#fill").addEventListener("click", function () {
    var n = 8 + Math.floor(Math.random() * 6), a = [], k;
    for (k = 0; k < n; k++) { a.push(1 + Math.floor(Math.random() * 99)); }
    a.sort(function (x, y) { return x - y; });
    var cap = 16;
    state = { cells: a.concat(new Array(cap - n).fill(null)), len: n, start: 0x1000 };
    idle("A fresh " + b("sorted") + " array of " + n + " numbers. Try binary search for one of them, then linear search, and compare the steps.");
  });

  code.load(OPS.read.code);
  idle("This is an array in memory: one block of cells side by side. Pick an operation below. " +
    "Set the index (i) and value (v) first if it needs them.");

  AV.learn($("#learn"), "arrays");

  AV.quiz($("#quiz"), [
    {
      q: "Why is reading a[500000] just as fast as reading a[0]?",
      opts: ["The computer reads every cell very quickly", "The address is worked out with one bit of maths: start + i × 4",
             "Arrays are stored in a tree", "It isn't, it's slower"], a: 1,
      why: "All the cells are the same size and side by side, so the address of any index is one multiplication and one addition away. No searching at all."
    },
    {
      q: "Inserting at the front of an array with n items needs how many moves?",
      opts: ["1", "log n", "n", "n²"], a: 2,
      why: "Every existing item has to shift right one cell to open the gap. That's n moves: O(n). At the end it'd be 0 moves."
    },
    {
      q: "Binary search on 1,000,000 sorted numbers needs at most about...",
      opts: ["20 checks", "1,000 checks", "500,000 checks", "1,000,000 checks"], a: 0,
      why: "Each check halves what's left. 2&sup2;&#8304; is about a million, so 20 halvings get you down to one number."
    },
    {
      q: "Append is usually O(1), but sometimes it copies the whole array. Why is it still called O(1)?",
      opts: ["The copy is free", "The array doubles in size each time, so copies are rare and average out",
             "Big O ignores copying", "It's actually O(n)"], a: 1,
      why: "Doubling means after copying n items you get n more free appends. Spread over all of them, each append costs a constant on average. That's called <b>amortised</b> O(1)."
    }
  ], $("#quiz-score"));
})();
