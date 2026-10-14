/* ============================================================
   AlgoVision - Heaps & priority queues

   A heap is an array that we DRAW as a tree: index i's children
   are 2i+1 and 2i+2. Both views are drawn from the same array on
   every frame, so the reader sees they're one thing. A frame is:
     { a: [values or {p, n, name}], size: how much of a is heap,
       hl: {index: cls}, edge: [i, j] or null, done: {index: 1},
       line, msg, steps, served: [names] }

   The tree has room for 15 nodes (4 rows) and never resizes.
   ============================================================ */

(function () {
  "use strict";

  var $ = function (s) { return document.querySelector(s); };
  var esc = AV.esc;
  function b(v) { return "<b>" + v + "</b>"; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  var NS = "http://www.w3.org/2000/svg";
  function svg(tag, attrs, parent, text) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) { e.setAttribute(k, attrs[k]); }
    if (text != null) { e.textContent = text; }
    if (parent) { parent.appendChild(e); }
    return e;
  }
  function H() {
    var o = {};
    for (var i = 0; i < arguments.length; i += 2) { if (arguments[i] != null) { o[arguments[i]] = arguments[i + 1]; } }
    return o;
  }

  var MAX = 15, TW = 480;
  function slotXY(i) {
    var d = Math.floor(Math.log2(i + 1)), k = i - ((1 << d) - 1);
    return { x: TW * (k + 0.5) / (1 << d), y: 30 + d * 56 };
  }
  function randVals(n) {
    var out = [];
    while (out.length < n) { var v = 1 + Math.floor(Math.random() * 98); if (out.indexOf(v) < 0) { out.push(v); } }
    return out;
  }

  /* ---------- recording ---------- */

  function Rec(st) {
    var r = { st: clone(st), frames: [], steps: 0 };
    r.snap = function (line, msg, hl, x) {
      x = x || {};
      r.frames.push({
        a: clone(r.st.a), size: x.size != null ? x.size : r.st.a.length, hl: hl || {}, edge: x.edge || null,
        done: clone(x.done || {}), line: line, msg: msg, steps: r.steps, served: clone(r.st.served || [])
      });
    };
    return r;
  }

  /* ---------- the three lessons share these comparisons ---------- */

  var TAB;                                   /* the lesson that's showing */
  function val(x) { return typeof x === "object" ? x.p : x; }
  function label(x) { return typeof x === "object" ? x.name + " (" + x.p + ")" : String(x); }
  /* should x sit ABOVE y? */
  function above(x, y) {
    if (TAB.kind() === "max") { return val(x) > val(y); }
    if (val(x) !== val(y)) { return val(x) < val(y); }
    return typeof x === "object" ? x.n < y.n : false;       /* same urgency: who came first */
  }
  function word() { return TAB.kind() === "max" ? "bigger" : "smaller"; }
  function top() { return TAB.kind() === "max" ? "biggest" : "smallest"; }
  function swap(a, i, j) { var t = a[i]; a[i] = a[j]; a[j] = t; }

  /* bubble the item at i up to where it belongs */
  function siftUp(r, i, L) {
    var a = r.st.a;
    while (i > 0) {
      var p = (i - 1) >> 1;
      r.steps++;
      r.snap(L.cmp, "Index " + i + "'s parent is (" + i + " - 1) // 2 = " + b(p) + ". Is " + b(label(a[i])) + " " + word() + " than its parent " + b(label(a[p])) + "?",
        H(i, "write", p, "compare"), { edge: [i, p] });
      if (!above(a[i], a[p])) {
        r.snap(L.stop, "No, so the parent stays on top. Order is fixed: stop. Only " + b(r.steps + " compare" + (r.steps > 1 ? "s" : "")) + ", one per row at most.", H(i, "focus"));
        return;
      }
      swap(a, i, p);
      r.snap(L.swap, "Yes: swap them. " + b(label(a[p])) + " bubbles up a row.", H(p, "write", i, "compare"), { edge: [i, p] });
      i = p;
    }
    r.snap(L.top, b(label(a[0])) + " made it all the way to the root: it's the new " + top() + ". " + b(r.steps + " compare" + (r.steps > 1 ? "s" : "")) + ".", H(0, "focus"));
  }

  /* sink the item at i down inside a[0..n) */
  function siftDown(r, i, n, L, x) {
    var a = r.st.a;
    x = x || {};
    function ex(e) { return { size: n, done: x.done, edge: e }; }
    while (2 * i + 1 < n) {
      var l = 2 * i + 1, k = l;
      if (l + 1 < n && above(a[l + 1], a[l])) { k = l + 1; }
      r.steps++;
      r.snap(L.pick, "Children of index " + i + " are at 2&middot;" + i + "+1 = " + l + (l + 1 < n ? " and " + (l + 1) : " (no right child)") + ". The " + word() + " one is " + b(label(a[k])) + ".",
        H(i, "write", l, "compare", l + 1 < n ? l + 1 : null, "compare"), ex(null));
      r.steps++;
      if (!above(a[k], a[i])) {
        r.snap(L.stop, b(label(a[i])) + " already beats its children. In order: stop.", H(i, "focus"), ex(null));
        return;
      }
      swap(a, i, k);
      r.snap(L.swap, b(label(a[i])) + " is " + word() + ", so it swaps up and " + b(label(a[k])) + " sinks down a row.", H(i, "compare", k, "write"), ex([i, k]));
      i = k;
    }
    r.snap(L.stop, b(label(a[i])) + " has no children below it: it's settled.", H(i, "focus"), ex(null));
  }

  /* ============================================================
     LESSON 1: a plain min / max heap
     ============================================================ */

  function heapCode(op, max) {
    var lt = max ? ">" : "<", le = max ? ">=" : "<=", sm = max ? "biggest" : "smallest", w = max ? "bigger" : "smaller";
    var sift = [
      "def sift_down(heap, i):",
      "    while 2 * i + 1 < len(heap):     # has a child",
      "        kid = 2 * i + 1              # left child",
      "        if kid + 1 < len(heap) and heap[kid + 1] " + lt + " heap[kid]:",
      "            kid += 1                 # right one is " + w,
      "        if heap[i] " + le + " heap[kid]:     # in order?",
      "            break",
      "        heap[i], heap[kid] = heap[kid], heap[i]",
      "        i = kid                      # sink down"
    ];
    if (op === "push") {
      return ["def push(heap, v):",
        "    heap.append(v)               # new leaf, bottom row",
        "    i = len(heap) - 1",
        "    while i > 0:",
        "        parent = (i - 1) // 2",
        "        if heap[parent] " + le + " heap[i]:   # in order?",
        "            break",
        "        heap[i], heap[parent] = heap[parent], heap[i]",
        "        i = parent               # bubble up"];
    }
    if (op === "pop") {
      return ["def pop(heap):",
        "    top = heap[0]         # the " + sm + " is always here",
        "    last = heap.pop()     # take the last leaf off...",
        "    if heap:",
        "        heap[0] = last    # ...and drop it on the root",
        "        sift_down(heap, 0)",
        "    return top",
        ""].concat(sift);
    }
    if (op === "peek") {
      return ["def peek(heap):", "    return heap[0]   # the " + sm + ", no searching"];
    }
    return ["def heapify(a):",
      "    # last parent first, then back to the root",
      "    for i in range(len(a) // 2 - 1, -1, -1):",
      "        sift_down(a, i)",
      ""].concat(sift);
  }
  var PUSH_L = { cmp: 5, stop: 6, swap: 7, top: 3 };
  var POP_L = { pick: 11, stop: 14, swap: 15 };
  var HEAPIFY_L = { loop: 3, pick: 8, stop: 11, swap: 12 };

  function heapifyInto(r, L) {
    var a = r.st.a, n = a.length;
    for (var i = (n >> 1) - 1; i >= 0; i--) {
      r.snap(L.loop, "Index " + b(i) + " is a parent. Sink it down so its little triangle is in order.", H(i, "focus"));
      siftDown(r, i, n, L);
    }
  }

  var heap = {
    name: "Min-heap", topic: "heap", minmax: true,
    st: { a: [3, 8, 5, 12, 10, 7, 9, 15, 20] }, kindNow: "min",
    kind: function () { return heap.kindNow; },
    cheat: [["See the top", "O(1)"], ["Push", "O(log n)"], ["Pop the top", "O(log n)"], ["Build from n items", "O(n)"], ["Search for any value", "O(n)", 1]],
    ops: {
      push: {
        label: "Push v", big: "O(log n)", cls: "is-ologn", input: true,
        run: function (r, v) {
          var a = r.st.a;
          if (a.length >= MAX) { r.snap(-1, "The tree is full on screen (" + MAX + " nodes). Pop something first."); return; }
          a.push(v);
          r.snap(1, "Add " + b(v) + " at the end of the array: index " + b(a.length - 1) + ", the next free spot on the bottom row. The tree stays a neat shape.", H(a.length - 1, "write"));
          siftUp(r, a.length - 1, PUSH_L);
        }
      },
      pop: {
        label: "Pop the top", big: "O(log n)", cls: "is-ologn",
        run: function (r) {
          var a = r.st.a;
          if (!a.length) { r.snap(-1, "The heap is empty. Push something!"); return; }
          var t = a[0];
          r.snap(1, "The " + top() + " is always at index 0: " + b(t) + ". Take it.", H(0, "focus"));
          var last = a.pop();
          if (!a.length) { r.snap(6, "That was the only item. The heap is empty now."); return; }
          a[0] = last;
          r.snap(4, "Fill the hole with the " + b("last leaf") + ", " + b(last) + ". The shape stays neat, but the order is broken at the top.", H(0, "write"));
          siftDown(r, 0, a.length, POP_L);
          r.snap(6, "Returned " + b(t) + ". The new top is " + b(a[0]) + ". " + b(r.steps + " compares") + " for " + a.length + " items: only one path from root to leaf.", H(0, "focus"));
        }
      },
      peek: {
        label: "Peek at the top", big: "O(1)", cls: "is-o1",
        run: function (r) {
          var a = r.st.a;
          if (!a.length) { r.snap(-1, "The heap is empty."); return; }
          r.steps++;
          r.snap(1, "The " + top() + " is " + b(a[0]) + ". No searching at all: it's always index 0.", H(0, "focus"));
        }
      },
      heapify: {
        label: "Build from random", big: "O(n)", cls: "is-on",
        run: function (r) {
          r.st.a = randVals(12);
          r.snap(-1, "12 random numbers in an array: " + b("not") + " a heap yet. Leaves (the bottom half) are fine on their own, so start at the last parent.", {});
          heapifyInto(r, HEAPIFY_L);
          r.snap(-1, "A valid heap after " + b(r.steps + " compares") + ". Pushing them one by one would cost about n log n; working bottom-up like this is O(n).", H(0, "focus"));
        }
      }
    }
  };

  /* ============================================================
     LESSON 2: priority queue, an emergency room
     ============================================================ */

  var NAMES = ["Ana", "Ben", "Cal", "Dee", "Eli", "Fay", "Gus", "Hal", "Ivy", "Jo", "Kai", "Lu", "Max", "Ned", "Oz", "Pia", "Quin", "Rae", "Sam", "Tia"];
  var pqCode = ["import heapq",
    "waiting = []  # (urgency, arrival_no, name)",
    "",
    "def arrive(name, urgency):",
    "    heapq.heappush(waiting, (urgency, next_no(), name))",
    "",
    "def treat_next():",
    "    urgency, _, name = heapq.heappop(waiting)",
    "    return name  # lowest urgency number = most urgent"];
  var PQ_UP = { cmp: 4, stop: 4, swap: 4, top: 4 }, PQ_DOWN = { pick: 7, stop: 7, swap: 7 };

  function pqStart() {
    var st = { a: [], seq: 0, served: [] };
    [["Ana", 4], ["Ben", 2], ["Cal", 5], ["Dee", 1], ["Eli", 3]].forEach(function (p) {
      var item = { p: p[1], n: st.seq++, name: p[0] }, a = st.a;
      a.push(item);
      for (var i = a.length - 1; i > 0;) { var q = (i - 1) >> 1; if (item.p < a[q].p) { swap(a, i, q); i = q; } else { break; } }
    });
    return st;
  }

  var pq = {
    name: "Priority queue: the ER", topic: "pq", vWord: "urgency 1-9",
    st: pqStart(), kind: function () { return "min"; },
    tip: "Urgency " + b("1") + " is life-threatening, " + b("9") + " can wait. A plain queue serves whoever came first; the heap serves whoever is most urgent. Ties go to whoever arrived first.",
    cheat: [["Next patient (peek)", "O(1)"], ["Someone arrives", "O(log n)"], ["Treat next", "O(log n)"], ["Python", "heapq module"]],
    ops: {
      arrive: {
        label: "Patient arrives", big: "O(log n)", cls: "is-ologn", input: true,
        run: function (r, v) {
          var a = r.st.a;
          if (a.length >= MAX) { r.snap(-1, "The waiting room is full on screen. Treat someone first."); return; }
          v = Math.max(1, Math.min(9, v || 1));
          var nm = ($("#in-name").value || "").replace(/[^A-Za-z]/g, "").slice(0, 5) || NAMES[r.st.seq % NAMES.length];
          var item = { p: v, n: r.st.seq++, name: nm };
          a.push(item);
          r.snap(4, b(nm) + " arrives with urgency " + b(v) + ". They go in the next free spot, then bubble up past anyone less urgent.", H(a.length - 1, "write"));
          siftUp(r, a.length - 1, PQ_UP);
          $("#in-name").value = NAMES[r.st.seq % NAMES.length];
        }
      },
      treat: {
        label: "Treat next", big: "O(log n)", cls: "is-ologn",
        run: function (r) {
          var a = r.st.a;
          if (!a.length) { r.snap(-1, "Nobody is waiting. Quiet night!"); return; }
          var t = a[0];
          var first = a.slice().sort(function (x, y) { return x.n - y.n; })[0];
          r.snap(7, "Most urgent: " + b(t.name) + " (urgency " + t.p + ")." + (first !== t ? " A plain queue would have called " + b(first.name) + ", who just arrived first." : ""), H(0, "focus"));
          r.st.served.push(t.name);
          var last = a.pop();
          if (!a.length) { r.snap(8, b(t.name) + " is being treated. The waiting room is empty."); return; }
          a[0] = last;
          r.snap(7, b(t.name) + " goes in. The last item in the array, " + b(label(last)) + ", moves to the top and sinks to their place.", H(0, "write"));
          siftDown(r, 0, a.length, PQ_DOWN);
          r.snap(8, "Next up is " + b(a[0].name) + " (urgency " + a[0].p + ").", H(0, "focus"));
        }
      },
      rush: {
        label: "Busy night: 6 arrive", big: "6 &times; O(log n)", cls: "is-ologn",
        run: function (r) {
          for (var k = 0; k < 6 && r.st.a.length < MAX; k++) {
            var item = { p: 1 + Math.floor(Math.random() * 9), n: r.st.seq++, name: NAMES[(r.st.seq - 1) % NAMES.length] };
            r.st.a.push(item);
            r.snap(4, b(item.name) + " arrives with urgency " + b(item.p) + ".", H(r.st.a.length - 1, "write"));
            siftUp(r, r.st.a.length - 1, PQ_UP);
          }
          $("#in-name").value = NAMES[r.st.seq % NAMES.length];
        }
      }
    }
  };

  /* ============================================================
     LESSON 3: heap sort
     ============================================================ */

  var sortCode = ["def heap_sort(a):",
    "    n = len(a)",
    "    for i in range(n // 2 - 1, -1, -1):  # 1. make a max-heap",
    "        sift_down(a, i, n)",
    "    for end in range(n - 1, 0, -1):",
    "        a[0], a[end] = a[end], a[0]      # 2. biggest to the back",
    "        sift_down(a, 0, end)             # 3. fix the smaller heap"];
  var SORT_BUILD = { pick: 3, stop: 3, swap: 3 }, SORT_FIX = { pick: 6, stop: 6, swap: 6 };

  var sorter = {
    name: "Heap sort", topic: "heapsort",
    st: { a: randVals(12) }, kind: function () { return "max"; },
    tip: "Two phases. Build a " + b("max") + "-heap, so the biggest is on top. Then swap the top to the back of the array, shrink the heap by one, fix it, and repeat. The green part grows from the right.",
    cheat: [["Time, every case", "O(n log n)"], ["Extra memory", "O(1): in place"], ["Stable?", "No", 1], ["vs merge sort", "less memory, a bit slower"]],
    ops: {
      sort: {
        label: "Heap sort", big: "O(n log n)", cls: "is-on",
        run: function (r) {
          var a = r.st.a, n = a.length, done = {};
          r.snap(0, "An unsorted array of " + n + ". The tree is the same array, drawn row by row.", {});
          for (var i = (n >> 1) - 1; i >= 0; i--) {
            r.snap(2, "Phase 1, build the heap: sink index " + b(i) + ".", H(i, "focus"));
            siftDown(r, i, n, SORT_BUILD, { done: done });
          }
          r.snap(4, "Max-heap built: " + b(a[0]) + " is the biggest. Now pull it out, again and again.", H(0, "focus"));
          for (var end = n - 1; end > 0; end--) {
            swap(a, 0, end);
            done[end] = 1;
            r.snap(5, "Swap the top, " + b(a[end]) + ", with the last heap item. " + b(a[end]) + " is now in its final spot. The heap shrinks to " + end + ".", H(0, "write"), { size: end, done: clone(done) });
            siftDown(r, 0, end, SORT_FIX, { done: clone(done) });
          }
          done[0] = 1;
          r.snap(-1, "Sorted, using no extra array. " + b(r.steps + " compares") + " for " + n + " items: n log n.", {}, { size: 0, done: done });
        }
      },
      shuffle: {
        label: "New random array", big: "-", cls: "is-o1",
        run: function (r) { r.st.a = randVals(12); r.snap(-1, "A fresh unsorted array. Press " + b("Heap sort") + "."); }
      },
      backwards: {
        label: "Sorted backwards", big: "-", cls: "is-o1",
        run: function (r) {
          r.st.a = randVals(12).sort(function (x, y) { return y - x; });
          r.snap(-1, "Biggest first: this already IS a max-heap. Heap sort doesn't care: it still takes about n log n. (Quick sort can get stuck on input like this; heap sort never does.)");
        }
      }
    }
  };

  var TABS = { heap: heap, pq: pq, sort: sorter };

  /* ============================================================
     drawing
     ============================================================ */

  var tree = $("#tree"), arr = $("#arr"), rows = $("#rows");

  function drawTree(f) {
    tree.innerHTML = "";
    var n = Math.min(f.size, f.a.length);
    var edges = svg("g", {}, tree), nodes = svg("g", {}, tree);
    var hot = f.edge ? [Math.min(f.edge[0], f.edge[1]), Math.max(f.edge[0], f.edge[1])] : null;
    for (var i = 0; i < MAX; i++) {
      var p = slotXY(i);
      if (i >= n) {
        svg("circle", { cx: p.x, cy: p.y, r: 19, "class": "hp-ghost" }, nodes);
        continue;
      }
      if (i > 0) {
        var q = slotXY((i - 1) >> 1), isHot = hot && hot[0] === (i - 1) >> 1 && hot[1] === i;
        svg("line", { x1: q.x, y1: q.y, x2: p.x, y2: p.y, "class": "ds-edge" + (isHot ? " is-hot" : "") }, edges);
      }
      var g = svg("g", { "class": "ds-tnode hp-node" + (f.hl[i] ? " is-" + f.hl[i] : ""), transform: "translate(" + p.x + "," + p.y + ")", "data-i": i }, nodes);
      svg("circle", { r: 19 }, g);
      svg("text", { y: 5, "text-anchor": "middle" }, g, val(f.a[i]));
      svg("text", { x: 15, y: -19, "class": "hp-idx" }, g, i);
      if (typeof f.a[i] === "object") { svg("text", { y: 33, "text-anchor": "middle", "class": "hp-name" }, g, f.a[i].name); }
    }
  }

  function drawArr(f) {
    var html = "";
    for (var i = 0; i < MAX; i++) {
      var has = i < f.a.length, c = "hp-cell";
      if (!has) { c += " is-empty"; }
      else if (f.hl[i]) { c += " is-" + f.hl[i]; }
      else if (f.done[i]) { c += " is-done"; }
      else if (i >= f.size) { c += " is-out"; }
      html += '<div class="' + c + '"><span>' + (has ? val(f.a[i]) : "") + "</span><small>" + i + "</small></div>";
    }
    arr.innerHTML = html;
  }

  function drawRows(f) {
    if (TAB !== pq) { rows.innerHTML = ""; return; }
    var order = f.a.slice().sort(function (x, y) { return x.n - y.n; });
    rows.innerHTML =
      '<div class="ds-out"><span class="pf-ds-name">Arrived</span>' +
        (order.length ? order.map(function (x) { return '<span class="av-box' + (x === order[0] ? " is-next" : "") + '">' + esc(x.name) + "</span>"; }).join("")
          : '<span class="r-empty">nobody</span>') + "</div>" +
      '<div class="ds-out"><span class="pf-ds-name">Treated</span>' +
        (f.served.length ? f.served.map(function (nm) { return '<span class="av-box is-used">' + esc(nm) + "</span>"; }).join("")
          : '<span class="r-empty">nobody yet</span>') + "</div>";
  }

  /* ============================================================
     page wiring
     ============================================================ */

  var say = $("#say"), stepsEl = $("#steps"), opName = $("#op-name"), opBadge = $("#op-badge");
  var vIn = $("#in-v");
  var current = /^#(heap|pq|sort)$/.test(location.hash) ? location.hash.slice(1) : "heap";
  var code = AV.Code($("#code"), [], $("#now"));
  var learnBtn = AV.learn($("#learn"), "heap");

  function render(f) {
    drawTree(f);
    drawArr(f);
    drawRows(f);
    code.mark(f.line);
    say.innerHTML = f.msg;
    stepsEl.textContent = f.steps;
  }
  var player = AV.Player($("#controls"), render, {
    keys: true, speed: 1,
    steady: [{ el: say, html: function (f) { return f.msg; } }]
  });

  function codeFor(key) {
    if (TAB === pq) { return pqCode; }
    if (TAB === sorter) { return sortCode; }
    return heapCode(key, heap.kindNow === "max");
  }
  function setOp(key) {
    var op = TAB.ops[key];
    code.load(codeFor(key));
    opName.textContent = op.label;
    opBadge.innerHTML = op.big;
    opBadge.className = "av-badge " + op.cls;
  }

  function idle(msg) {
    var r = Rec(TAB.st);
    r.snap(-1, msg);
    player.load(r.frames);
  }

  function run(key) {
    var op = TAB.ops[key];
    document.querySelectorAll("[data-op]").forEach(function (x) {
      x.setAttribute("aria-pressed", x.getAttribute("data-op") === key ? "true" : "false");
    });
    setOp(key);
    var r = Rec(TAB.st), v = parseInt(vIn.value, 10);
    op.run(r, isNaN(v) ? 0 : Math.max(0, Math.min(99, v)));
    if (!r.frames.length) { r.snap(-1, "Nothing to do."); }
    TAB.st = clone(r.st);
    player.load(r.frames);
    if (!AV.calm) { player.play(); }
    if (window.innerWidth < 900) {
      $("#stage").closest(".av-panel").scrollIntoView({ behavior: AV.calm ? "auto" : "smooth", block: "start" });
    }
  }

  function title() {
    return TAB === heap ? (heap.kindNow === "max" ? "Max-heap" : "Min-heap") : TAB.name;
  }

  function show(key) {
    current = key;
    TAB = TABS[key];
    $("#tab-name").textContent = title();
    $("#stage").className = "av-stage hp-stage" + (TAB === pq ? " is-pq" : "");
    tree.setAttribute("viewBox", "0 0 " + TW + (TAB === pq ? " 244" : " 222"));
    $("#kind").hidden = !TAB.minmax;
    $("#lbl-v").hidden = !Object.keys(TAB.ops).some(function (k) { return TAB.ops[k].input; });
    $("#lbl-name").hidden = TAB !== pq;
    $("#v-word").textContent = TAB.vWord || "value v";
    vIn.max = TAB === pq ? 9 : 99;
    $("#tip").innerHTML = TAB === heap
      ? "Every parent is " + b(heap.kindNow === "max" ? "bigger" : "smaller") + " than its children. That's the only rule. Siblings can be in any order."
      : TAB.tip;
    $("#cheat").innerHTML = TAB.cheat.map(function (c) {
      return "<tr><td style='font-family:var(--font-body)'>" + c[0] + "</td><td class='" + (c[2] ? "bad" : "good") + "'>" + c[1] + "</td></tr>";
    }).join("");
    learnBtn.topic(TAB.topic);

    var ops = $("#ops");
    ops.innerHTML = "";
    Object.keys(TAB.ops).forEach(function (k) {
      var op = TAB.ops[k];
      var btn = AV.el("button", "av-op", "<span>" + op.label + '</span><span class="av-badge ' + op.cls + '">' + op.big + "</span>");
      btn.type = "button";
      btn.setAttribute("data-op", k);
      btn.setAttribute("aria-pressed", "false");
      btn.addEventListener("click", function () { run(k); });
      ops.appendChild(btn);
    });
    setOp(Object.keys(TAB.ops)[0]);
    idle(TAB === heap ? "A " + title().toLowerCase() + " of " + TAB.st.a.length + ". The top is always the " + top() + ". Push, pop, or tap a node to see its family."
      : TAB === pq ? "Five patients are waiting. The heap keeps the most urgent at the top, no matter who came first."
      : "12 numbers, not sorted. Press " + b("Heap sort") + ".");
  }

  /* tap a node: show its index maths */
  tree.addEventListener("click", function (e) {
    var g = e.target.closest && e.target.closest(".hp-node");
    if (!g || player.playing()) { return; }
    var i = +g.getAttribute("data-i"), a = TAB.st.a, n = a.length, p = (i - 1) >> 1, l = 2 * i + 1, rr = l + 1;
    var parts = [b("Index " + i) + " holds " + b(label(a[i])) + "."];
    parts.push(i ? "Parent: (" + i + " - 1) // 2 = " + b(p) + "." : "It's the root: no parent.");
    parts.push(l < n ? "Children: 2&middot;" + i + "+1 = " + b(l) + (rr < n ? " and 2&middot;" + i + "+2 = " + b(rr) : "") + "." : "No children: it's a leaf.");
    var r = Rec(TAB.st);
    r.snap(-1, parts.join(" "), H(i, "focus", i ? p : null, "compare", l < n ? l : null, "write", rr < n ? rr : null, "write"));
    player.load(r.frames);
  });

  document.querySelectorAll("#tabs [data-pick]").forEach(function (p) {
    p.setAttribute("aria-pressed", p.getAttribute("data-pick") === current ? "true" : "false");
  });
  AV.pills($("#tabs"), function (k) {
    try { history.replaceState(null, "", "#" + k); } catch (e) { /* file:// */ }
    show(k);
  });
  document.querySelectorAll("#kind [data-pick]").forEach(function (p) {
    p.setAttribute("aria-pressed", p.getAttribute("data-pick") === "min" ? "true" : "false");
  });
  AV.pills($("#kind"), function (k) {
    if (k === heap.kindNow) { return; }
    heap.kindNow = k;
    $("#tab-name").textContent = title();
    $("#tip").innerHTML = "Every parent is " + b(k === "max" ? "bigger" : "smaller") + " than its children. That's the only rule. Siblings can be in any order.";
    setOp("heapify");
    var r = Rec(heap.st);
    r.snap(-1, "Switched to a " + b(title().toLowerCase()) + ". The same numbers need re-arranging, so rebuild it bottom-up.", {});
    heapifyInto(r, HEAPIFY_L);
    r.snap(-1, "Done: now the " + top() + " (" + b(r.st.a[0]) + ") is on top.", H(0, "focus"));
    heap.st = clone(r.st);
    player.load(r.frames);
    if (!AV.calm) { player.play(); }
  });
  show(current);

  AV.quiz($("#quiz"), [
    {
      q: "In a min-heap, where is the smallest value?",
      opts: ["At the bottom right", "Always at the root, index 0", "Somewhere in the leaves", "In the middle of the array"], a: 1,
      why: "Every parent is smaller than its children, so nothing can be smaller than the root. Peeking at it is O(1)."
    },
    {
      q: "A heap is stored in an array. Which index is the parent of index 9?",
      opts: ["3", "4", "5", "18"], a: 1,
      why: "(9 - 1) // 2 = 4. And going down: index 4's children are 2&middot;4+1 = 9 and 10."
    },
    {
      q: "Why is popping from a heap O(log n), not O(n)?",
      opts: ["It sorts the array", "The new root only sinks down one path, one row at a time, and a heap has about log n rows", "It searches every node", "Python makes it fast"], a: 1,
      why: "The tree is always a neat, full shape, so 1,000,000 items is only 20 rows. Sinking down touches at most one node per row."
    },
    {
      q: "An ER treats the most urgent patient first, not the first to arrive. What's the right structure?",
      opts: ["A queue", "A stack", "A priority queue (a heap)", "A sorted list you re-sort every time"], a: 2,
      why: "A priority queue serves by priority. Built on a heap, each arrival and each \"next!\" is O(log n). Try the ER tab."
    }
  ], $("#quiz-score"));
})();
