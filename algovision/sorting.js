/* ============================================================
   AlgoVision - Sorting

   Each algorithm below runs ONCE, for real, on a copy of the
   numbers, and calls snap() every time it does something worth
   seeing. snap() saves a frame: the whole list, which bars are
   lit, which code line is running and a sentence saying why.
   The Player then just flips through those frames.

   The `line` numbers in snap() count from 0 and point into the
   matching CODE listing, so if you edit a listing, check them.
   ============================================================ */

(function () {
  "use strict";

  /* ---------- recording helpers ---------- */

  function Rec(input) {
    var r = { a: input.slice(), frames: [], cmp: 0, wr: 0, done: [], range: null };
    r.snap = function (line, msg, hl, ptr, more) {
      var f = {
        a: r.a.slice(), line: line, msg: msg, hl: hl || {}, ptr: ptr || {},
        done: r.done.slice(), cmp: r.cmp, wr: r.wr,
        range: r.range ? r.range.slice() : null
      };
      if (more) { for (var k in more) { f[k] = more[k]; } }
      r.frames.push(f);
    };
    r.allDone = function () {
      r.done = r.a.map(function (_, i) { return i; });
      r.range = null;
    };
    return r;
  }

  /* H(2, "compare", 3, "compare") -> {2: "compare", 3: "compare"} */
  function H() {
    var o = {};
    for (var i = 0; i < arguments.length; i += 2) { o[arguments[i]] = arguments[i + 1]; }
    return o;
  }
  /* Pointer labels. Two on the same bar get joined: "i,j". */
  function P() {
    var o = {};
    for (var i = 0; i < arguments.length; i += 2) {
      var k = arguments[i];
      o[k] = o[k] ? o[k] + "," + arguments[i + 1] : arguments[i + 1];
    }
    return o;
  }
  function b(v) { return "<b>" + v + "</b>"; }

  function finish(r, line, key) {
    var A = ALGOS[key];
    r.allDone();
    r.snap(line, "Done! " + A.name + " sorted " + r.a.length + " numbers using " +
      b(r.cmp.toLocaleString()) + " comparisons and " + b(r.wr.toLocaleString()) +
      " " + A.wrName.toLowerCase() + ".");
  }

  /* ---------- the algorithms ---------- */

  function bubble(input) {
    var r = Rec(input), a = r.a, n = a.length;
    r.snap(0, "Bubble sort walks along the list comparing " + b("neighbours") +
      " and swapping any pair in the wrong order. Big values " + b("bubble") + " to the end.");
    for (var i = 0; i < n - 1; i++) {
      var swapped = false;
      r.snap(2, "Pass " + b(i + 1) + (i ? ": the last " + i + " value" + (i > 1 ? "s are" : " is") +
        " already in place, so this pass stops before them." : ": walk the whole list."));
      for (var j = 0; j < n - 1 - i; j++) {
        r.cmp++;
        var bigger = a[j] > a[j + 1];
        r.snap(5, "Compare " + b(a[j]) + " and " + b(a[j + 1]) + ". " +
          (bigger ? "Left is bigger, so they swap." : "Already in order, leave them."),
          H(j, "compare", j + 1, "compare"), P(j, "j", j + 1, "j+1"));
        if (bigger) {
          var t = a[j]; a[j] = a[j + 1]; a[j + 1] = t;
          r.wr++; swapped = true;
          r.snap(6, "Swapped: " + b(a[j]) + " now sits left of " + b(a[j + 1]) + ".",
            H(j, "write", j + 1, "write"), P(j, "j", j + 1, "j+1"));
        }
      }
      r.done.push(n - 1 - i);
      r.snap(4, "End of pass " + (i + 1) + ": " + b(a[n - 1 - i]) +
        " has bubbled up to its final spot.", {}, P(n - 1 - i, "done"));
      if (!swapped) {
        r.allDone();
        r.snap(9, "Not a single swap in that pass, so everything is already in order. " +
          b("Stop early") + ". (That's why bubble sort's best case is O(n).)");
        break;
      }
    }
    finish(r, 10, "bubble");
    return r.frames;
  }

  function selection(input) {
    var r = Rec(input), a = r.a, n = a.length;
    r.snap(0, "Selection sort scans for the " + b("smallest") +
      " value that's left, then swaps it to the front. Repeat for the rest.");
    for (var i = 0; i < n - 1; i++) {
      var s = i;
      r.snap(3, "Start at index " + i + ". Assume " + b(a[i]) + " is the smallest of what's left.",
        H(i, "focus"), P(i, "i"));
      for (var j = i + 1; j < n; j++) {
        r.cmp++;
        var smaller = a[j] < a[s];
        r.snap(5, "Is " + b(a[j]) + " smaller than the smallest so far, " + b(a[s]) + "? " +
          (smaller ? "Yes!" : "No."), H(s, "focus", j, "compare"), P(i, "i", j, "j"));
        if (smaller) {
          s = j;
          r.snap(6, "New smallest: " + b(a[s]) + " at index " + s + ".", H(s, "focus"), P(i, "i", s, "min"));
        }
      }
      if (s !== i) {
        var t = a[i]; a[i] = a[s]; a[s] = t;
        r.wr++;
        r.snap(7, "Swap the smallest, " + b(a[i]) + ", into index " + i + ".",
          H(i, "write", s, "write"), P(i, "i", s, "min"));
      } else {
        r.snap(7, b(a[i]) + " was already the smallest, so it stays where it is.", H(i, "focus"), P(i, "i"));
      }
      r.done.push(i);
    }
    finish(r, 8, "selection");
    return r.frames;
  }

  function insertion(input) {
    var r = Rec(input), a = r.a, n = a.length;
    r.snap(0, "Insertion sort works like sorting a hand of cards: pick up the next card and " +
      b("slide it left") + " until it fits among the ones you've already sorted.");
    for (var i = 1; i < n; i++) {
      var key = a[i], j = i - 1;
      r.range = [0, i + 1];
      r.snap(2, "Pick up the key, " + b(key) + ". Everything to its left is already sorted.",
        H(i, "focus"), P(i, "key"));
      while (j >= 0) {
        r.cmp++;
        var bigger = a[j] > key;
        r.snap(4, "Is " + b(a[j]) + " bigger than the key " + b(key) + "? " +
          (bigger ? "Yes, so it has to move right." : "No, so the key belongs right here."),
          H(j, "compare", j + 1, "focus"), P(j, "j", j + 1, "key"));
        if (!bigger) { break; }
        a[j + 1] = a[j]; a[j] = key;
        r.wr++;
        r.snap(5, b(a[j + 1]) + " shifts right one spot, and the key slides left.",
          H(j + 1, "write", j, "focus"), P(j, "key"));
        j--;
      }
      r.wr++;
      r.snap(7, "The key " + b(key) + " drops into index " + (j + 1) +
        (j < 0 ? " - it's the smallest so far, so it went all the way to the front." : "."),
        H(j + 1, "focus"), P(j + 1, "key"));
    }
    finish(r, 8, "insertion");
    return r.frames;
  }

  function merge(input) {
    var r = Rec(input), a = r.a, n = a.length;
    var seen = {}, merged = {};
    function keys(o) { return Object.keys(o); }
    function node(lo, hi, extra) {
      var m = { node: [lo, hi], seen: keys(seen), merged: keys(merged) };
      if (extra) { for (var k in extra) { m[k] = extra[k]; } }
      return m;
    }
    function span(lo, hi) { return b("[" + a.slice(lo, hi).join(", ") + "]"); }

    r.snap(0, "Merge sort is " + b("divide and conquer") + ": split the list in half, " +
      "sort each half, then merge the two sorted halves back together.", {}, {}, node(0, n));

    function sort(lo, hi) {
      seen[lo + "-" + hi] = 1;
      r.range = [lo, hi];
      if (hi - lo <= 1) {
        merged[lo + "-" + hi] = 1;
        r.snap(1, "Just one number, " + b(a[lo]) + ". One item is already sorted, so this is the " +
          b("base case") + " and we return.", H(lo, "focus"), P(lo, "lo"), node(lo, hi));
        return;
      }
      var mid = (lo + hi) >> 1;
      r.snap(3, "Split " + span(lo, hi) + " down the middle into " + span(lo, mid) + " and " +
        span(mid, hi) + ".", {}, P(lo, "lo", mid, "mid", hi - 1, "hi"), node(lo, hi));
      sort(lo, mid);
      sort(mid, hi);
      r.range = [lo, hi];

      var left = a.slice(lo, mid), right = a.slice(mid, hi), i = 0, j = 0;
      function aux() { return { aux: { left: left, right: right, i: i, j: j } }; }
      r.snap(9, "Both halves are sorted. Now " + b("merge") + " them: copy them out, then keep " +
        "taking whichever front number is smaller.", {}, P(lo, "lo", hi - 1, "hi"), node(lo, hi, aux()));
      for (var k = lo; k < hi; k++) {
        var takeLeft;
        if (i < left.length && j < right.length) {
          r.cmp++;
          takeLeft = left[i] <= right[j];
          r.snap(12, "Compare the fronts: left " + b(left[i]) + " vs right " + b(right[j]) +
            ". Take the smaller, " + b(takeLeft ? left[i] : right[j]) + ".",
            H(k, "compare"), P(k, "k"), node(lo, hi, aux()));
        } else {
          takeLeft = i < left.length;
          r.snap(12, (takeLeft ? "Right" : "Left") + " half is used up, so take the rest from the " +
            (takeLeft ? "left" : "right") + ".", H(k, "compare"), P(k, "k"), node(lo, hi, aux()));
        }
        if (takeLeft) { a[k] = left[i++]; } else { a[k] = right[j++]; }
        r.wr++;
        r.snap(takeLeft ? 13 : 15, "Write " + b(a[k]) + " into position " + k + ".",
          H(k, "write"), P(k, "k"), node(lo, hi, aux()));
      }
      merged[lo + "-" + hi] = 1;
      r.snap(6, span(lo, hi) + " is merged and sorted.", {}, {}, node(lo, hi));
    }
    sort(0, n);
    finish(r, 6, "merge");
    r.frames[r.frames.length - 1].merged = keys(merged);
    r.frames[r.frames.length - 1].seen = keys(seen);
    return r.frames;
  }

  function quick(input) {
    var r = Rec(input), a = r.a, n = a.length;
    r.snap(0, "Quick sort picks a " + b("pivot") + ", moves everything smaller to its left and " +
      "everything else to its right, then does the same to each side.");

    function sort(lo, hi) {
      r.range = [Math.max(lo, 0), hi + 1];
      if (lo >= hi) {
        if (lo === hi) { r.done.push(lo); }
        r.snap(1, lo === hi ? "Just " + b(a[lo]) + " on this side. One item is already sorted."
                            : "Nothing on this side. Return.", {}, lo === hi ? P(lo, "lo") : {});
        return;
      }
      r.snap(3, "Partition indexes " + lo + " to " + hi + " around a pivot.", {}, P(lo, "lo", hi, "hi"));
      var pivot = a[hi], i = lo;
      r.snap(8, "The pivot is the last item, " + b(pivot) + ". Smaller values will gather on the left.",
        H(hi, "focus"), P(i, "i", hi, "pivot"));
      for (var j = lo; j < hi; j++) {
        r.cmp++;
        var small = a[j] < pivot;
        r.snap(11, "Is " + b(a[j]) + " smaller than the pivot " + b(pivot) + "? " + (small ? "Yes." : "No, leave it."),
          H(j, "compare", hi, "focus"), P(i, "i", j, "j", hi, "pivot"));
        if (small) {
          var t = a[i]; a[i] = a[j]; a[j] = t;
          r.wr++;
          r.snap(12, i === j ? b(a[i]) + " is already on the small side. Move i along."
                             : "Swap " + b(a[i]) + " into the small side at i, then move i along.",
            H(i, "write", j, "write", hi, "focus"), P(i, "i", j, "j", hi, "pivot"));
          i++;
        }
      }
      var t2 = a[i]; a[i] = a[hi]; a[hi] = t2;
      r.wr++;
      r.done.push(i);
      r.snap(14, "Swap the pivot " + b(pivot) + " into index " + i + ". It's now in its " + b("final spot") +
        ": everything left of it is smaller, everything right is bigger or equal.", H(i, "write"), P(i, "pivot"));
      sort(lo, i - 1);
      sort(i + 1, hi);
    }
    sort(0, n - 1);
    finish(r, 0, "quick");
    return r.frames;
  }

  /* ---------- what's shown for each algorithm ---------- */

  var ALGOS = {
    bubble: {
      name: "Bubble sort", run: bubble, wrName: "Swaps",
      big: { best: "O(n)", avg: "O(n²)", worst: "O(n²)", space: "O(1)", stable: "Yes" },
      how: [
        "<b>Compare</b> each pair of neighbours, left to right.",
        "<b>Swap</b> them if the left one is bigger.",
        "After one pass the biggest value is at the end. Repeat on the rest.",
        "If a pass makes <b>no swaps</b>, the list is sorted. Stop."
      ],
      code: [
        "def bubble_sort(a):",
        "    n = len(a)",
        "    for i in range(n - 1):",
        "        swapped = False",
        "        for j in range(n - 1 - i):",
        "            if a[j] > a[j + 1]:",
        "                a[j], a[j + 1] = a[j + 1], a[j]",
        "                swapped = True",
        "        if not swapped:",
        "            break  # no swaps: already sorted",
        "    return a"
      ]
    },
    selection: {
      name: "Selection sort", run: selection, wrName: "Swaps",
      big: { best: "O(n²)", avg: "O(n²)", worst: "O(n²)", space: "O(1)", stable: "No" },
      how: [
        "<b>Scan</b> everything not yet sorted to find the smallest value.",
        "<b>Swap</b> it into the first unsorted spot.",
        "That spot is now final. Move one to the right and repeat.",
        "It always scans everything, so even a sorted list costs O(n²)."
      ],
      code: [
        "def selection_sort(a):",
        "    n = len(a)",
        "    for i in range(n - 1):",
        "        smallest = i",
        "        for j in range(i + 1, n):",
        "            if a[j] < a[smallest]:",
        "                smallest = j",
        "        a[i], a[smallest] = a[smallest], a[i]",
        "    return a"
      ]
    },
    insertion: {
      name: "Insertion sort", run: insertion, wrName: "Writes",
      big: { best: "O(n)", avg: "O(n²)", worst: "O(n²)", space: "O(1)", stable: "Yes" },
      how: [
        "The left part of the list is your <b>sorted hand</b>.",
        "Pick up the next value (the <b>key</b>).",
        "Shift bigger values right until the key fits, then drop it in.",
        "Nearly sorted lists barely move, so it's fast on those."
      ],
      code: [
        "def insertion_sort(a):",
        "    for i in range(1, len(a)):",
        "        key = a[i]",
        "        j = i - 1",
        "        while j >= 0 and a[j] > key:",
        "            a[j + 1] = a[j]  # shift right",
        "            j -= 1",
        "        a[j + 1] = key",
        "    return a"
      ]
    },
    merge: {
      name: "Merge sort", run: merge, wrName: "Writes",
      big: { best: "O(n log n)", avg: "O(n log n)", worst: "O(n log n)", space: "O(n)", stable: "Yes" },
      how: [
        "<b>Split</b> the list in half, again and again, until each piece is one number.",
        "One number on its own is already sorted (the <b>base case</b>).",
        "<b>Merge</b> pairs of sorted pieces by repeatedly taking the smaller front value.",
        "There are <b>log n</b> levels of splitting and each level does <b>n</b> work: O(n log n)."
      ],
      code: [
        "def merge_sort(a, lo, hi):",
        "    if hi - lo <= 1:",
        "        return  # 1 item is already sorted",
        "    mid = (lo + hi) // 2",
        "    merge_sort(a, lo, mid)   # sort left half",
        "    merge_sort(a, mid, hi)   # sort right half",
        "    merge(a, lo, mid, hi)",
        "",
        "def merge(a, lo, mid, hi):",
        "    left, right = a[lo:mid], a[mid:hi]",
        "    i = j = 0",
        "    for k in range(lo, hi):",
        "        if j >= len(right) or (i < len(left) and left[i] <= right[j]):",
        "            a[k] = left[i]; i += 1",
        "        else:",
        "            a[k] = right[j]; j += 1"
      ]
    },
    quick: {
      name: "Quick sort", run: quick, wrName: "Swaps",
      big: { best: "O(n log n)", avg: "O(n log n)", worst: "O(n²)", space: "O(log n)", stable: "No" },
      how: [
        "Pick a <b>pivot</b> (here, the last value).",
        "<b>Partition</b>: move smaller values left of it, the rest right. The pivot is now final.",
        "Quick sort each side the same way.",
        "Bad pivots (like on an already sorted list) make it O(n²). Try it with <b>Reversed</b>."
      ],
      code: [
        "def quick_sort(a, lo, hi):",
        "    if lo >= hi:",
        "        return",
        "    p = partition(a, lo, hi)",
        "    quick_sort(a, lo, p - 1)",
        "    quick_sort(a, p + 1, hi)",
        "",
        "def partition(a, lo, hi):",
        "    pivot = a[hi]  # last item is the pivot",
        "    i = lo",
        "    for j in range(lo, hi):",
        "        if a[j] < pivot:",
        "            a[i], a[j] = a[j], a[i]",
        "            i += 1",
        "    a[i], a[hi] = a[hi], a[i]  # pivot lands in its final spot",
        "    return i"
      ]
    }
  };

  /* Colours the complexity table: anything quadratic or worse is red. */
  function grade(o) { return /n²|2ⁿ/.test(o) ? "bad" : "good"; }

  /* ---------- page wiring ---------- */

  var $ = function (s) { return document.querySelector(s); };
  var current = /^#(bubble|selection|insertion|merge|quick)$/.test(location.hash)
    ? location.hash.slice(1) : "merge";
  var size = 12, kind = "random", data = AV.randomArray(size, kind);

  var stage = $("#stage");
  var bars = AV.Bars(stage);
  var code = AV.Code($("#code"), [], $("#now"));
  var say = $("#say");
  var statCmp = $("#stat-cmp"), statWr = $("#stat-wr"), statWrLabel = $("#stat-wr-label"), statStep = $("#stat-step");
  var treeBox = $("#tree"), auxBox = $("#aux");
  var learnBtn = AV.learn($("#learn"), current);

  var player = AV.Player($("#controls"), render, {
    keys: true,
    steady: [{ el: say, html: function (f) { return f.msg; } }, { el: auxBox, html: auxHtml }]
  });

  /* ---- merge sort tree ---- */
  var treeRows = [], treeNodes = {};
  function buildTree(n) {
    treeBox.innerHTML = "";
    treeRows = []; treeNodes = {};
    if (current !== "merge") { treeBox.hidden = true; return; }
    treeBox.hidden = false;
    var title = AV.el("p", "av-panel-title", "The split tree");
    treeBox.appendChild(title);
    if (n > 16) {
      treeBox.appendChild(AV.el("p", "av-tree-note", "The tree view shows up for 16 numbers or fewer. Drag the size down to see it."));
      return;
    }
    function walk(lo, hi, d) {
      if (!treeRows[d]) {
        var row = AV.el("div", "av-tree-row");
        row.style.gridTemplateColumns = "repeat(" + n + ", minmax(0, 1fr))";
        treeRows[d] = row;
      }
      var nd = AV.el("div", "av-node");
      nd.style.gridColumn = (lo + 1) + " / " + (hi + 1);
      treeRows[d].appendChild(nd);
      treeNodes[lo + "-" + hi] = { el: nd, lo: lo, hi: hi };
      if (hi - lo > 1) {
        var mid = (lo + hi) >> 1;
        walk(lo, mid, d + 1);
        walk(mid, hi, d + 1);
      }
    }
    walk(0, n, 0);
    treeRows.forEach(function (row) { treeBox.appendChild(row); });
    treeBox.appendChild(AV.el("p", "av-tree-note",
      "Top row is the whole list. Each row down is one more split. Gold = working on it now, green = merged and sorted."));
  }

  function drawTree(f) {
    if (current !== "merge" || !treeRows.length) { return; }
    var seen = {}, merged = {};
    (f.seen || []).forEach(function (k) { seen[k] = 1; });
    (f.merged || []).forEach(function (k) { merged[k] = 1; });
    var active = f.node ? f.node[0] + "-" + f.node[1] : "";
    Object.keys(treeNodes).forEach(function (k) {
      var t = treeNodes[k];
      t.el.className = "av-node" + (k === active ? " is-active" : merged[k] ? " is-merged" : seen[k] ? " is-seen" : "");
      t.el.innerHTML = f.a.slice(t.lo, t.hi).map(function (v) { return "<span>" + v + "</span>"; }).join("");
    });
  }

  /* The left/right copies merge sort is zipping together. The row
     stays on screen (empty between merges) so nothing below it jumps. */
  function auxHtml(f) {
    if (!f.aux) { return '<span class="av-aux-idle">Merge workspace: the two halves line up here while they\'re merged.</span>'; }
    function grp(name, list, p) {
      return '<div class="grp">' + name + " " + list.map(function (v, k) {
        return '<span class="av-box' + (k < p ? " is-used" : k === p ? " is-next" : "") + '">' + v + "</span>";
      }).join("") + "</div>";
    }
    return grp("left", f.aux.left, f.aux.i) + grp("right", f.aux.right, f.aux.j);
  }
  function drawAux(f) { auxBox.innerHTML = auxHtml(f); }

  function render(f, i, all) {
    bars.draw(f);
    code.mark(f.line);
    say.innerHTML = f.msg;
    statCmp.textContent = f.cmp.toLocaleString();
    statWr.textContent = f.wr.toLocaleString();
    statStep.textContent = (i + 1) + " / " + all.length;
    drawTree(f);
    drawAux(f);
  }

  function rebuild(keepPlaying) {
    var A = ALGOS[current];
    code.load(A.code);
    statWrLabel.textContent = A.wrName;
    $("#algo-name").textContent = A.name;
    $("#how").innerHTML = A.how.map(function (h) { return "<li>" + h + "</li>"; }).join("");
    var big = A.big;
    $("#facts").innerHTML =
      "<tr><th>Best</th><th>Average</th><th>Worst</th><th>Extra space</th><th>Stable</th></tr>" +
      "<tr><td class='" + grade(big.best) + "'>" + big.best + "</td><td class='" + grade(big.avg) + "'>" + big.avg +
      "</td><td class='" + grade(big.worst) + "'>" + big.worst + "</td><td>" + big.space + "</td><td>" + big.stable + "</td></tr>";
    learnBtn.topic(current);
    bars.rescale(data);
    auxBox.hidden = current !== "merge";
    buildTree(data.length);
    player.load(A.run(data));
    if (keepPlaying) { player.play(); }
  }

  AV.pills($("#algos"), function (k) {
    current = k;
    try { history.replaceState(null, "", "#" + k); } catch (e) { /* file:// */ }
    rebuild(false);
  });
  document.querySelectorAll("#algos [data-pick]").forEach(function (p) {
    p.setAttribute("aria-pressed", p.getAttribute("data-pick") === current ? "true" : "false");
  });

  AV.pills($("#kinds"), function (k) {
    kind = k;
    data = AV.randomArray(size, kind);
    rebuild(false);
  });

  var sizeIn = $("#size"), sizeOut = $("#size-out");
  sizeIn.addEventListener("input", function () {
    size = +sizeIn.value;
    sizeOut.textContent = size;
    data = AV.randomArray(size, kind);
    rebuild(false);
  });
  $("#shuffle").addEventListener("click", function () {
    data = AV.randomArray(size, kind);
    rebuild(false);
  });

  rebuild(false);

  /* ============================================================
     RACE: two algorithms, same numbers, one clock.
     Only frames where real work happened (a comparison or a
     write) count as a tick, so the finish line is honest.
     ============================================================ */

  var raceA = $("#race-a"), raceB = $("#race-b"), raceSize = $("#race-size");
  var barsA = AV.Bars($("#race-stage-a"), { pointers: false, labels: false });
  var barsB = AV.Bars($("#race-stage-b"), { pointers: false, labels: false });
  var opsA = $("#race-ops-a"), opsB = $("#race-ops-b");
  var winA = $("#race-win-a"), winB = $("#race-win-b"), result = $("#race-result");
  var raceInfo = null;

  function workOnly(frames) {
    var out = [frames[0]];
    for (var i = 1; i < frames.length; i++) {
      var f = frames[i], p = out[out.length - 1];
      if (f.cmp + f.wr !== p.cmp + p.wr || i === frames.length - 1) {
        out.push({ a: f.a, hl: f.hl, done: f.done, range: f.range, cmp: f.cmp, wr: f.wr });
      }
    }
    return out;
  }

  var racePlayer = AV.Player($("#race-controls"), function (f, i, all) {
    barsA.draw(f.A); barsB.draw(f.B);
    opsA.textContent = (f.A.cmp + f.A.wr).toLocaleString() + " ops";
    opsB.textContent = (f.B.cmp + f.B.wr).toLocaleString() + " ops";
    var ri = raceInfo;
    /* visibility, not display: the badge's space is always kept */
    winA.classList.toggle("is-off", !(i >= ri.lenA - 1 && ri.lenA <= ri.lenB));
    winB.classList.toggle("is-off", !(i >= ri.lenB - 1 && ri.lenB <= ri.lenA));
    if (i === all.length - 1) {
      var fast = ri.lenA <= ri.lenB ? ri.nameA : ri.nameB, slow = ri.lenA <= ri.lenB ? ri.nameB : ri.nameA;
      var fo = Math.min(ri.opsA, ri.opsB), so = Math.max(ri.opsA, ri.opsB);
      result.innerHTML = ri.nameA === ri.nameB
        ? "Same algorithm, same numbers, same result. Pick two different ones!"
        : "<b>" + fast + "</b> needed " + fo.toLocaleString() + " operations. <b>" + slow + "</b> needed " +
          so.toLocaleString() + (fo ? " (" + (so / fo).toFixed(1) + "&times; as many)." : ".");
    } else {
      result.textContent = "";
    }
  }, { speed: 4 });

  function setupRace() {
    var n = +raceSize.value, d = AV.randomArray(n, "random");
    var fa = workOnly(ALGOS[raceA.value].run(d));
    var fb = workOnly(ALGOS[raceB.value].run(d));
    barsA.rescale(d); barsB.rescale(d);
    var len = Math.max(fa.length, fb.length), frames = [];
    for (var i = 0; i < len; i++) {
      frames.push({ A: fa[Math.min(i, fa.length - 1)], B: fb[Math.min(i, fb.length - 1)] });
    }
    var la = fa[fa.length - 1], lb = fb[fb.length - 1];
    raceInfo = {
      lenA: fa.length, lenB: fb.length,
      nameA: ALGOS[raceA.value].name, nameB: ALGOS[raceB.value].name,
      opsA: la.cmp + la.wr, opsB: lb.cmp + lb.wr
    };
    $("#race-name-a").textContent = raceInfo.nameA;
    $("#race-name-b").textContent = raceInfo.nameB;
    racePlayer.load(frames);
  }
  [raceA, raceB, raceSize].forEach(function (s) { s.addEventListener("change", setupRace); });
  $("#race-new").addEventListener("click", setupRace);
  setupRace();

  /* ============================================================
     QUIZ
     ============================================================ */

  AV.quiz($("#quiz"), [
    {
      q: "Which of these is O(n log n) even in its worst case?",
      opts: ["Quick sort", "Merge sort", "Insertion sort", "Bubble sort"], a: 1,
      why: "Merge sort always splits exactly in half, so there are always log n levels with n work each. Quick sort can fall to O(n²) when its pivots are bad."
    },
    {
      q: "Your list is already almost sorted. Which simple sort does best?",
      opts: ["Selection sort", "Insertion sort", "Quick sort (last-item pivot)"], a: 1,
      why: "Each key only slides a step or two, so insertion sort gets close to O(n). Selection sort still scans everything, and quick sort's last-item pivot makes lopsided splits on sorted data."
    },
    {
      q: "How many levels of splitting does merge sort need for 16 numbers?",
      opts: ["2", "4", "8", "16"], a: 1,
      why: "16 &rarr; 8 &rarr; 4 &rarr; 2 &rarr; 1 is 4 halvings, and log&#8322;(16) = 4. Open merge sort with 16 numbers and count the rows of the tree (the top row is the unsplit list)."
    },
    {
      q: "Why does each pass of bubble sort stop one spot earlier than the last?",
      code: ["for j in range(n - 1 - i):"],
      opts: ["To save memory", "The biggest remaining value is already at the end", "It's a bug", "So it only looks at even indexes"], a: 1,
      why: "Every pass carries the biggest unsorted value all the way right. After pass i, the last i values are final and never need checking again."
    },
    {
      q: "Quick sort (pivot = last item) on a list that's already sorted runs in...",
      opts: ["O(n)", "O(log n)", "O(n log n)", "O(n²)"], a: 3,
      why: "The pivot is always the biggest value, so every partition puts everything on one side. That's n levels instead of log n. Try Quick sort with <b>Nearly sorted</b> and watch the comparisons pile up."
    }
  ], $("#quiz-score"));
})();
