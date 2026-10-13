/* ============================================================
   AlgoVision - Data structures

   Five structures, one page. Each one is an entry in STRUCTS:
     state   what it holds right now (plain data, so a frame can
             copy it with JSON)
     ops     the buttons: each records frames, like every module
     draw    paints one frame onto its stage

   The stage for each structure is a FIXED size (room for the most
   it can hold), so it never grows or shrinks while you watch.
   ============================================================ */

(function () {
  "use strict";

  var $ = function (s) { return document.querySelector(s); };
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

  /* ---------- recording ---------- */

  function Rec(state) {
    var r = { st: clone(state), frames: [], steps: 0 };
    /* hl: {key: "compare"|"write"|"focus"|"out"}, x: anything extra the drawing needs */
    r.snap = function (line, msg, hl, x) {
      r.frames.push({ st: clone(r.st), line: line, msg: msg, hl: hl || {}, x: x ? clone(x) : {}, steps: r.steps });
    };
    return r;
  }
  function H() {
    var o = {};
    for (var i = 0; i < arguments.length; i += 2) { o[arguments[i]] = arguments[i + 1]; }
    return o;
  }
  function cls(h) { return h ? " is-" + h : ""; }

  /* ============================================================
     STACK
     ============================================================ */

  var STACK_MAX = 7;
  var stack = {
    name: "Stack", topic: "stack", inputs: "v",
    state: { items: [4, 9, 2] },
    used: "Undo, the browser's back button, and the call stack you saw in Recursion. Last in, first out (LIFO).",
    ops: {
      push: {
        label: "Push v", big: "O(1)", cls: "is-o1",
        code: ["stack = []", "", "def push(x):", "    stack.append(x)  # onto the top"],
        run: function (r, v) {
          var it = r.st.items;
          if (it.length >= STACK_MAX) { r.snap(3, "The stack is full (this one holds " + STACK_MAX + "). Pop something first."); return; }
          r.snap(2, "Push " + b(v) + ". It always goes on the " + b("top") + ", on top of " + (it.length ? b(it[it.length - 1]) : "nothing") + ".");
          it.push(v); r.steps++;
          r.snap(3, b(v) + " is the new top. Nothing underneath moved: O(1).", H(it.length - 1, "write"));
        }
      },
      pop: {
        label: "Pop", big: "O(1)", cls: "is-o1",
        code: ["def pop():", "    if not stack:", "        raise IndexError('empty')", "    return stack.pop()  # off the top"],
        run: function (r) {
          var it = r.st.items;
          if (!it.length) { r.snap(2, "The stack is empty. Nothing to pop."); return; }
          r.snap(3, "Pop takes whatever is on " + b("top") + ": " + b(it[it.length - 1]) + ". You can't reach the ones below without removing it first.", H(it.length - 1, "focus"));
          var v = it.pop(); r.steps++;
          r.snap(3, "Returned " + b(v) + ". " + (it.length ? b(it[it.length - 1]) + " is the top now." : "The stack is empty."), it.length ? H(it.length - 1, "compare") : {});
        }
      },
      peek: {
        label: "Peek", big: "O(1)", cls: "is-o1",
        code: ["def peek():", "    return stack[-1]  # look, don't remove"],
        run: function (r) {
          var it = r.st.items;
          if (!it.length) { r.snap(1, "Empty stack: nothing to peek at."); return; }
          r.steps++;
          r.snap(1, "Peek looks at the top, " + b(it[it.length - 1]) + ", without taking it off.", H(it.length - 1, "compare"));
        }
      }
    },
    cheat: [["Push", "O(1)"], ["Pop", "O(1)"], ["Peek", "O(1)"], ["Find something in the middle", "O(n)"]],
    setup: function (stage) {
      stage.innerHTML = '<div class="ds-stack"></div>';
    },
    draw: function (stage, f) {
      var box = stage.firstChild, it = f.st.items, html = "";
      for (var i = STACK_MAX - 1; i >= 0; i--) {
        var has = i < it.length;
        html += '<div class="ds-slot' + (has ? "" : " is-empty") + cls(f.hl[i]) + '">' +
          '<span class="ds-val">' + (has ? it[i] : "") + "</span>" +
          '<span class="ds-tag">' + (has && i === it.length - 1 ? "&larr; top" : "") + "</span></div>";
      }
      box.innerHTML = html;
    }
  };

  /* ============================================================
     QUEUE
     ============================================================ */

  var QUEUE_MAX = 7;
  var queue = {
    name: "Queue", topic: "queue", inputs: "v",
    state: { items: [5, 1, 8] },
    used: "Printer jobs, messages waiting to send, and BFS in Pathfinding. First in, first out (FIFO), like a real line.",
    ops: {
      enqueue: {
        label: "Enqueue v", big: "O(1)", cls: "is-o1",
        code: ["from collections import deque", "queue = deque()", "", "def enqueue(x):", "    queue.append(x)  # join the back"],
        run: function (r, v) {
          var it = r.st.items;
          if (it.length >= QUEUE_MAX) { r.snap(4, "The queue is full (this one holds " + QUEUE_MAX + "). Dequeue something first."); return; }
          r.snap(3, b(v) + " joins at the " + b("back") + " of the line.");
          it.push(v); r.steps++;
          r.snap(4, b(v) + " is now last in line. O(1).", H(it.length - 1, "write"));
        }
      },
      dequeue: {
        label: "Dequeue", big: "O(1)", cls: "is-o1",
        code: ["def dequeue():", "    return queue.popleft()  # leave from the front"],
        run: function (r) {
          var it = r.st.items;
          if (!it.length) { r.snap(1, "The queue is empty. Nobody's waiting."); return; }
          r.snap(1, "The " + b("front") + " of the line goes first: " + b(it[0]) + ". It's been waiting longest.", H(0, "focus"));
          var v = it.shift(); r.steps++;
          r.snap(1, "Served " + b(v) + ". " + (it.length ? b(it[0]) + " is at the front now." : "The queue is empty.") +
            " (A deque doesn't really shuffle everyone along. It just moves its front pointer, so this is O(1).)", it.length ? H(0, "compare") : {});
        }
      },
      front: {
        label: "Peek front", big: "O(1)", cls: "is-o1",
        code: ["def front():", "    return queue[0]"],
        run: function (r) {
          var it = r.st.items;
          if (!it.length) { r.snap(1, "Empty queue: nothing at the front."); return; }
          r.steps++;
          r.snap(1, "Next to be served: " + b(it[0]) + ".", H(0, "compare"));
        }
      }
    },
    cheat: [["Enqueue (join back)", "O(1)"], ["Dequeue (leave front)", "O(1)"], ["Peek front", "O(1)"], ["Find something in the middle", "O(n)"]],
    setup: function (stage) {
      stage.innerHTML = '<div class="ds-queue"></div><div class="ds-queue-ends"><span>&uarr; front (leaves here)</span><span>back (joins here) &uarr;</span></div>';
    },
    draw: function (stage, f) {
      var it = f.st.items, html = "";
      for (var i = 0; i < QUEUE_MAX; i++) {
        var has = i < it.length;
        html += '<div class="ds-slot' + (has ? "" : " is-empty") + cls(f.hl[i]) + '"><span class="ds-val">' + (has ? it[i] : "") + "</span></div>";
      }
      stage.firstChild.innerHTML = html;
    }
  };

  /* ============================================================
     LINKED LIST
     Nodes don't sit side by side in memory: each one points at
     the next. Drawn in SVG so the arrows can be rewired.
     ============================================================ */

  var LIST_MAX = 7, NW = 60, NH = 34, STEP = 86, X0 = 18, Y0 = 34, LANE = 104;
  function nodeX(i) { return X0 + i * STEP; }

  var list = {
    name: "Linked list", topic: "linkedlist", inputs: "iv",
    state: { nodes: [3, 8, 6, 1] },
    used: "Music playlists (next / previous song), undo histories, and the chains inside a hash map. Cheap to insert once you're in position, slow to reach position i.",
    ops: {
      prepend: {
        label: "Add to front", big: "O(1)", cls: "is-o1",
        code: ["def prepend(lst, x):", "    node = Node(x)", "    node.next = lst.head  # point at the old first", "    lst.head = node       # head points at the new one"],
        run: function (r, i, v) {
          var n = r.st.nodes;
          if (n.length >= LIST_MAX) { r.snap(0, "List is full for this screen (" + LIST_MAX + " nodes). Remove one first."); return; }
          r.snap(1, "Make a new node holding " + b(v) + ". It lives " + b("anywhere") + " in memory, it doesn't need to be next to the others.", {}, { newVal: v, at: 0 });
          r.steps++;
          r.snap(2, "Point the new node's " + b("next") + " at the current first node" + (n.length ? ", " + b(n[0]) : "") + ".", {}, { newVal: v, at: 0, linkNext: true });
          r.steps++;
          r.snap(3, "Point " + b("head") + " at the new node. Two pointer changes, no matter how long the list is: O(1).", {}, { newVal: v, at: 0, linkNext: true, linkPrev: true });
          n.unshift(v);
          r.snap(3, b(v) + " is the new first node.", H(0, "write"));
        }
      },
      append: {
        label: "Add to end", big: "O(n)", cls: "is-on",
        code: ["def append(lst, x):", "    cur = lst.head", "    while cur.next:   # walk to the last node", "        cur = cur.next", "    cur.next = Node(x)"],
        run: function (r, i, v) {
          var n = r.st.nodes;
          if (n.length >= LIST_MAX) { r.snap(0, "List is full for this screen (" + LIST_MAX + " nodes). Remove one first."); return; }
          if (!n.length) { n.push(v); r.steps++; r.snap(4, "Empty list, so " + b(v) + " becomes the only node.", H(0, "write")); return; }
          r.snap(1, "We only know where the " + b("head") + " is. To find the end we have to walk.", H(0, "compare"), { cur: 0 });
          for (var k = 0; k < n.length - 1; k++) {
            r.steps++;
            r.snap(3, "Not the last one (its next isn't empty). Follow the arrow to " + b(n[k + 1]) + ".", H(k + 1, "compare"), { cur: k + 1 });
          }
          r.snap(4, "Found the last node, " + b(n[n.length - 1]) + ". Hang the new node off its next.", H(n.length - 1, "compare"),
            { cur: n.length - 1, newVal: v, at: n.length });
          r.steps++;
          r.snap(4, "Linked. That walk took " + b(n.length - 1 + " steps") + ": O(n). (Real lists often keep a " + b("tail") + " pointer to make this O(1).)", {},
            { newVal: v, at: n.length, linkPrev: true });
          n.push(v);
          r.snap(4, b(v) + " is the last node.", H(n.length - 1, "write"));
        }
      },
      insert: {
        label: "Insert v at i", big: "O(n)", cls: "is-on",
        code: ["def insert(lst, i, x):", "    cur = lst.head", "    for _ in range(i - 1):   # walk to node i-1", "        cur = cur.next", "    node = Node(x)",
               "    node.next = cur.next   # new points at the rest", "    cur.next = node        # i-1 points at new"],
        run: function (r, i, v) {
          var n = r.st.nodes;
          if (n.length >= LIST_MAX) { r.snap(0, "List is full for this screen (" + LIST_MAX + " nodes). Remove one first."); return; }
          if (isNaN(i) || i < 0 || i > n.length) { r.snap(0, "Pick an index from 0 to " + n.length + "."); return; }
          if (i === 0) { return list.ops.prepend.run(r, 0, v); }
          r.snap(1, "Start at the head. There's no jumping to index " + i + ": a list has no addresses to calculate, only arrows to follow.", H(0, "compare"), { cur: 0 });
          for (var k = 0; k < i - 1; k++) {
            r.steps++;
            r.snap(3, "Follow next to " + b(n[k + 1]) + ".", H(k + 1, "compare"), { cur: k + 1 });
          }
          r.snap(4, "Stop at node " + (i - 1) + " (" + b(n[i - 1]) + "). Make the new node.", H(i - 1, "compare"), { cur: i - 1, newVal: v, at: i });
          r.steps++;
          r.snap(5, "First, new node's next = " + (i < n.length ? b(n[i]) : "null") + ". (Do this first or you'd lose the rest of the list!)", H(i - 1, "compare"),
            { cur: i - 1, newVal: v, at: i, linkNext: true });
          r.steps++;
          r.snap(6, "Then " + b(n[i - 1]) + ".next = new node. Done: " + b("nothing shifted") + ", unlike an array. The cost was the walk.", {},
            { newVal: v, at: i, linkNext: true, linkPrev: true });
          n.splice(i, 0, v);
          r.snap(6, b(v) + " is node " + i + ".", H(i, "write"));
        }
      },
      remove: {
        label: "Remove value v", big: "O(n)", cls: "is-on",
        code: ["def remove(lst, x):", "    prev, cur = None, lst.head", "    while cur and cur.value != x:", "        prev, cur = cur, cur.next",
               "    if cur:  # found it: skip over it", "        prev.next = cur.next   # (or head = cur.next)"],
        run: function (r, i, v) {
          var n = r.st.nodes;
          r.snap(1, "Look for " + b(v) + ", starting at the head.", n.length ? H(0, "compare") : {}, { cur: 0 });
          var k = 0;
          while (k < n.length && n[k] !== v) {
            r.steps++;
            r.snap(2, b(n[k]) + " isn't " + v + ". Move along.", H(k, "compare"), { cur: k });
            k++;
          }
          if (k >= n.length) { r.snap(4, b(v) + " isn't in the list. Checked all " + n.length + " nodes."); return; }
          r.steps++;
          r.snap(4, "Found " + b(v) + ".", H(k, "focus"), { cur: k });
          r.snap(5, "Make " + (k ? b(n[k - 1]) + ".next" : b("head")) + " skip over it and point at " + (k + 1 < n.length ? b(n[k + 1]) : "null") +
            ". Nothing else has to move.", H(k, "out"), { del: k });
          n.splice(k, 1);
          r.snap(5, "Gone. Nothing points at it any more, so the memory gets cleaned up.");
        }
      },
      find: {
        label: "Find value v", big: "O(n)", cls: "is-on",
        code: ["def find(lst, x):", "    cur = lst.head", "    while cur:", "        if cur.value == x: return cur", "        cur = cur.next", "    return None"],
        run: function (r, i, v) {
          var n = r.st.nodes;
          r.snap(1, "Look for " + b(v) + ". Start at the head and follow the arrows.");
          for (var k = 0; k < n.length; k++) {
            r.steps++;
            if (n[k] === v) { r.snap(3, "Found " + b(v) + " at node " + k + " after " + b(r.steps + " step" + (r.steps > 1 ? "s" : "")) + ".", H(k, "focus"), { cur: k }); return; }
            r.snap(4, b(n[k]) + ": not it. Follow next.", H(k, "compare"), { cur: k });
          }
          r.snap(5, b(v) + " isn't here. Walked the whole list: O(n).");
        }
      }
    },
    cheat: [["Add / remove at the front", "O(1)"], ["Reach node i", "O(n)"], ["Insert after a node you're at", "O(1)"], ["Find a value", "O(n)"]],
    setup: function (stage) {
      stage.innerHTML = "";
      var s = svg("svg", { "class": "ds-list", viewBox: "0 0 " + (X0 + LIST_MAX * STEP + 40) + " 150" }, stage);
      var defs = svg("defs", {}, s);
      ["", "hot"].forEach(function (k) {
        var m = svg("marker", { id: "ah" + k, viewBox: "0 0 8 8", refX: 7, refY: 4, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, defs);
        svg("path", { d: "M0,0 L8,4 L0,8 z", "class": "ah" + (k ? " is-" + k : "") }, m);
      });
      list.svg = s;
    },
    draw: function (stage, f) {
      var s = list.svg, n = f.st.nodes, x = f.x;
      while (s.childNodes.length > 1) { s.removeChild(s.lastChild); }
      var g = svg("g", {}, s);
      function arrow(x1, y1, x2, y2, hot, curve) {
        var d = curve ? "M" + x1 + "," + y1 + " C" + x1 + "," + (y1 - 34) + " " + x2 + "," + (y2 - 34) + " " + x2 + "," + y2
                      : "M" + x1 + "," + y1 + " L" + x2 + "," + y2;
        svg("path", { d: d, "class": "ds-arrow" + (hot ? " is-hot" : ""), "marker-end": "url(#ah" + (hot ? "hot" : "") + ")" }, g);
      }
      function box(px, py, v, h, label) {
        var gg = svg("g", { "class": "ds-node" + cls(h), transform: "translate(" + px + "," + py + ")" }, g);
        svg("rect", { width: NW, height: NH, rx: 6 }, gg);
        svg("line", { x1: NW - 18, y1: 0, x2: NW - 18, y2: NH, "class": "ds-div" }, gg);
        svg("text", { x: (NW - 18) / 2, y: NH / 2 + 5, "text-anchor": "middle", "class": "ds-num" }, gg, v);
        svg("circle", { cx: NW - 9, cy: NH / 2, r: 3, "class": "ds-dot" }, gg);
        if (label) { svg("text", { x: NW / 2, y: NH + 15, "text-anchor": "middle", "class": "ds-cap" }, gg, label); }
      }
      var hasNew = x.newVal != null, at = x.at;
      var newX = hasNew ? (at === 0 ? X0 : nodeX(at) - STEP / 2) : 0;

      /* head label */
      var headTarget = (hasNew && at === 0 && x.linkPrev) ? { x: newX + NW / 2, y: LANE } : (n.length ? { x: nodeX(0) + NW / 2, y: Y0 } : null);
      svg("text", { x: X0 + 2, y: 12, "class": "ds-cap is-head" }, g, "head");
      if (headTarget && x.del !== 0) { arrow(X0 + 16, 16, headTarget.x, headTarget.y - 2, hasNew && at === 0 && x.linkPrev); }
      else { svg("text", { x: X0 + 44, y: 13, "class": "ds-cap" }, g, "→ null"); }

      /* nodes and their next arrows */
      n.forEach(function (v, i) {
        var px = nodeX(i), out = x.del === i;
        box(px, Y0, v, out ? "out" : f.hl[i], x.cur === i ? "cur" : "");
        var fromX = px + NW - 9, y = Y0 + NH / 2;
        if (hasNew && x.linkPrev && i === at - 1) {
          arrow(fromX, y, newX + 4, LANE + NH / 2, true);
        } else if (x.del != null && i === x.del - 1) {
          var toNull = x.del + 1 >= n.length, tx = toNull ? nodeX(x.del + 1) + 8 : nodeX(x.del + 1) + NW / 2;
          arrow(fromX, Y0, tx, Y0 - 2, true, true);
          if (toNull) { svg("text", { x: tx - 6, y: Y0 + NH / 2 + 4, "class": "ds-cap" }, g, "null"); }
        } else if (i < n.length - 1) {
          if (!out) { arrow(fromX, y, nodeX(i + 1) - 2, y); }
        } else if (!out) {
          svg("text", { x: px + NW + 8, y: y + 4, "class": "ds-cap" }, g, "null");
        }
        if (out && i < n.length - 1) { arrow(fromX, y, nodeX(i + 1) - 2, y); }
      });
      if (x.del === 0) {
        arrow(X0 + 16, 16, n.length > 1 ? nodeX(1) + NW / 2 : X0 + 60, Y0 - 2, true, true);
      }

      /* the new node, waiting in the lane below */
      if (hasNew) {
        box(newX, LANE, x.newVal, "write", "new");
        if (x.linkNext) {
          if (at < n.length) { arrow(newX + NW - 9, LANE + NH / 2, nodeX(at) + NW / 2, Y0 + NH + 2, true); }
          else { svg("text", { x: newX + NW + 8, y: LANE + NH / 2 + 4, "class": "ds-cap" }, g, "null"); }
        }
      }
    }
  };

  /* ============================================================
     HASH MAP
     ============================================================ */

  var BUCKETS = 8;
  function hashParts(key) {
    var codes = key.split("").map(function (ch) { return ch.charCodeAt(0); });
    var sum = codes.reduce(function (a, c) { return a + c; }, 0);
    return { codes: codes, sum: sum, i: sum % BUCKETS };
  }
  function hashText(key) {
    var h = hashParts(key);
    /* the letter codes are dropped on phones (CSS) so the bucket number always fits */
    return "hash('" + AV.esc(key) + "') = <span class=\"ds-codes\">" + h.codes.join(" + ") + " = </span>" + h.sum +
      " &rarr; " + h.sum + " % " + BUCKETS + " = <b>" + h.i + "</b>";
  }
  function startMap() {
    var m = [];
    for (var i = 0; i < BUCKETS; i++) { m.push([]); }
    [["cat", 3], ["dog", 5], ["owl", 1], ["fox", 7], ["bee", 2]].forEach(function (p) { m[hashParts(p[0]).i].push(p); });
    return { b: m };
  }

  var hash = {
    name: "Hash map", topic: "hashmap", inputs: "kv",
    state: startMap(),
    used: "Python's dict, JavaScript objects, database indexes, caches. Any time you look something up by name. Average O(1) for everything.",
    ops: {
      put: {
        label: "Put key = v", big: "O(1)", cls: "is-o1",
        code: ["def put(m, key, value):", "    i = hash(key) % len(m.buckets)  # which bucket?", "    for pair in m.buckets[i]:", "        if pair.key == key:",
               "            pair.value = value; return  # update", "    m.buckets[i].append((key, value))  # new key"],
        run: function (r, key, v) {
          var h = hashParts(key), row = r.st.b[h.i];
          r.snap(1, "Turn the key into a bucket number. Same key, same number, every time. So we know " + b("exactly") + " where to look.",
            H("r" + h.i, "focus"), { formula: key });
          for (var k = 0; k < row.length; k++) {
            r.steps++;
            if (row[k][0] === key) {
              r.snap(3, "Bucket " + h.i + " already has " + b(key) + ". Update its value.", H("r" + h.i, "focus", h.i + "-" + k, "compare"), { formula: key });
              row[k][1] = v;
              r.snap(4, b(key) + " = " + b(v) + " now. Only looked at " + (k + 1) + " pair" + (k ? "s" : "") + ".", H(h.i + "-" + k, "write"), { formula: key });
              return;
            }
            r.snap(3, b(row[k][0]) + " isn't " + b(key) + ". Two keys landed in the same bucket: a " + b("collision") + ". Check the next one in the chain.",
              H("r" + h.i, "focus", h.i + "-" + k, "compare"), { formula: key });
          }
          if (row.length >= 4) { r.snap(5, "This bucket's chain is full for the screen. Try a different key."); return; }
          row.push([key, v]); r.steps++;
          r.snap(5, "Not here yet, so add " + b(key + ": " + v) + " to bucket " + h.i + ".", H(h.i + "-" + (row.length - 1), "write"), { formula: key });
        }
      },
      get: {
        label: "Get key", big: "O(1)", cls: "is-o1",
        code: ["def get(m, key):", "    i = hash(key) % len(m.buckets)", "    for pair in m.buckets[i]:", "        if pair.key == key:", "            return pair.value", "    raise KeyError(key)"],
        run: function (r, key) {
          var h = hashParts(key), row = r.st.b[h.i];
          r.snap(1, "Hash the key to get its bucket. No searching through the other " + (BUCKETS - 1) + " buckets at all.", H("r" + h.i, "focus"), { formula: key });
          for (var k = 0; k < row.length; k++) {
            r.steps++;
            if (row[k][0] === key) {
              r.snap(4, "Found " + b(key) + " &rarr; " + b(row[k][1]) + " in " + b(r.steps + " look" + (r.steps > 1 ? "s" : "")) +
                ". Doesn't matter if the map holds 5 keys or 5 million: O(1) on average.", H(h.i + "-" + k, "focus"), { formula: key });
              return;
            }
            r.snap(3, b(row[k][0]) + " isn't it. Next in this bucket's chain.", H("r" + h.i, "focus", h.i + "-" + k, "compare"), { formula: key });
          }
          r.snap(5, b("KeyError") + ": " + AV.esc(key) + " isn't in the map. Bucket " + h.i + " doesn't have it, so it can't be anywhere else.",
            H("r" + h.i, "focus"), { formula: key });
        }
      },
      remove: {
        label: "Remove key", big: "O(1)", cls: "is-o1",
        code: ["def remove(m, key):", "    i = hash(key) % len(m.buckets)", "    for pair in m.buckets[i]:", "        if pair.key == key:", "            m.buckets[i].remove(pair); return"],
        run: function (r, key) {
          var h = hashParts(key), row = r.st.b[h.i];
          r.snap(1, "Hash it to find the bucket.", H("r" + h.i, "focus"), { formula: key });
          for (var k = 0; k < row.length; k++) {
            r.steps++;
            if (row[k][0] === key) {
              r.snap(3, "There it is.", H(h.i + "-" + k, "focus"), { formula: key });
              row.splice(k, 1);
              r.snap(4, "Removed " + b(key) + ".", H("r" + h.i, "focus"), { formula: key });
              return;
            }
            r.snap(3, b(row[k][0]) + " isn't it.", H("r" + h.i, "focus", h.i + "-" + k, "compare"), { formula: key });
          }
          r.snap(4, AV.esc(key) + " wasn't in the map.", H("r" + h.i, "focus"), { formula: key });
        }
      }
    },
    cheat: [["Put / get / remove", "O(1)*"], ["*Worst case (every key collides)", "O(n)"], ["Keys in order", "not kept"], ["Find by value, not key", "O(n)"]],
    setup: function (stage) {
      stage.innerHTML = '<p class="av-formula ds-hash-formula"></p><div class="ds-hash"></div>';
    },
    draw: function (stage, f) {
      stage.firstChild.innerHTML = f.x.formula ? hashText(f.x.formula) : "hash(key) = add up the letter codes, then % " + BUCKETS + " to pick a bucket";
      var html = "";
      f.st.b.forEach(function (row, i) {
        html += '<div class="ds-bucket' + cls(f.hl["r" + i]) + '"><span class="ds-idx">' + i + "</span><div class=\"ds-chain\">" +
          (row.length ? row.map(function (p, k) {
            return '<span class="ds-pair' + cls(f.hl[i + "-" + k]) + '">' + AV.esc(p[0]) + ": " + p[1] + "</span>";
          }).join('<span class="ds-link">&rarr;</span>') : '<span class="ds-none">empty</span>') + "</div></div>";
      });
      stage.lastChild.innerHTML = html;
    }
  };

  /* ============================================================
     BINARY SEARCH TREE
     Stored by fixed slot (children of slot i are 2i+1 and 2i+2),
     so every node has a fixed spot on screen and nothing slides
     around when a new one is added.
     ============================================================ */

  var DEPTH = 5, SLOTS = (1 << DEPTH) - 1, TW = 640, TH = 268;
  function slotXY(i) {
    var d = Math.floor(Math.log2(i + 1)), k = i - ((1 << d) - 1);
    return { x: TW * (k + 0.5) / (1 << d), y: 24 + d * 54, d: d };
  }
  function emptyTree() { var t = []; for (var i = 0; i < SLOTS; i++) { t.push(null); } return t; }
  function treeOf(vals) {
    var t = emptyTree();
    vals.forEach(function (v) {
      var i = 0;
      while (i < SLOTS && t[i] != null) { i = v < t[i] ? 2 * i + 1 : 2 * i + 2; }
      if (i < SLOTS) { t[i] = v; }
    });
    return { t: t };
  }

  var bst = {
    name: "Binary search tree", topic: "bst", inputs: "v",
    state: treeOf([50, 30, 70, 20, 40, 60, 80]),
    used: "Keeping things sorted while you add and remove (databases, file systems, game leaderboards). Every node: smaller on the left, bigger on the right.",
    ops: {
      insert: {
        label: "Insert v", big: "O(log n)", cls: "is-ologn",
        code: ["def insert(node, v):", "    if node is None:", "        return Node(v)  # empty spot: it goes here", "    if v < node.value:",
               "        node.left = insert(node.left, v)", "    else:", "        node.right = insert(node.right, v)", "    return node"],
        run: function (r, v) {
          var t = r.st.t, i = 0;
          if (isNaN(v)) { r.snap(0, "Type a number in the value box first."); return; }
          while (i < SLOTS && t[i] != null) {
            r.steps++;
            var left = v < t[i];
            r.snap(left ? 4 : 6, "Compare " + b(v) + " with " + b(t[i]) + ": " + (left ? "smaller, so go " + b("left") : "bigger or equal, so go " + b("right")) + ".", H(i, "compare"));
            i = left ? 2 * i + 1 : 2 * i + 2;
          }
          if (i >= SLOTS) {
            r.snap(1, "This branch is " + DEPTH + " levels deep, which is as tall as fits on screen. A tree this lopsided is basically a list: O(n). Try " + b("Balanced") + ".");
            return;
          }
          t[i] = v; r.steps++;
          r.snap(2, "Empty spot. " + b(v) + " goes here. That took " + b(r.steps - 1 + " comparison" + (r.steps === 2 ? "" : "s")) +
            ": one per level, so about log n in a bushy tree.", H(i, "write"));
        }
      },
      search: {
        label: "Search for v", big: "O(log n)", cls: "is-ologn",
        code: ["def search(node, v):", "    while node:", "        if v == node.value: return node", "        if v < node.value:", "            node = node.left   # throw away the right side",
               "        else:", "            node = node.right  # throw away the left side", "    return None"],
        run: function (r, v) {
          var t = r.st.t, i = 0;
          while (i < SLOTS && t[i] != null) {
            r.steps++;
            if (t[i] === v) { r.snap(2, "Found " + b(v) + " after " + b(r.steps + " comparison" + (r.steps > 1 ? "s" : "")) + ".", H(i, "focus")); return; }
            var left = v < t[i];
            r.snap(left ? 4 : 6, b(v) + (left ? " is smaller than " : " is bigger than ") + b(t[i]) + ", so it can only be on the " + b(left ? "left" : "right") +
              ". Half the tree is ruled out, just like binary search.", H(i, "compare"));
            i = left ? 2 * i + 1 : 2 * i + 2;
          }
          r.snap(7, "Fell off the bottom: " + b(v) + " isn't in the tree.");
        }
      },
      inorder: {
        label: "Walk in order", big: "O(n)", cls: "is-on",
        code: ["def in_order(node):", "    if node:", "        in_order(node.left)   # everything smaller first", "        print(node.value)", "        in_order(node.right)  # then everything bigger"],
        run: function (r) {
          var t = r.st.t, out = [];
          function walk(i) {
            if (i >= SLOTS || t[i] == null) { return; }
            r.snap(2, "At " + b(t[i]) + ". Visit everything on its left first.", H(i, "compare"), { out: out });
            walk(2 * i + 1);
            out.push(t[i]); r.steps++;
            r.snap(3, "Left side done. Print " + b(t[i]) + ".", H(i, "write"), { out: out });
            walk(2 * i + 2);
          }
          walk(0);
          r.snap(-1, out.length ? "Printed in " + b("sorted order") + ", for free. That's the big trick of a BST: left-node-right always comes out sorted." : "Empty tree.", {}, { out: out });
        }
      }
    },
    cheat: [["Search / insert (bushy tree)", "O(log n)"], ["Search / insert (lopsided tree)", "O(n)"], ["Walk in sorted order", "O(n)"], ["Smallest value", "O(log n): go left"]],
    presets: [
      ["Balanced", function () { return treeOf([50, 30, 70, 20, 40, 60, 80]); }, "A bushy tree: 7 values, 3 levels. Any search takes at most 3 comparisons."],
      ["Sorted input", function () { return treeOf([10, 20, 30, 40, 50]); },
        "Inserting already-sorted values builds a " + b("stick") + ": every node goes right. Searching it is O(n), as slow as a list. (Self-balancing trees fix this.)"],
      ["Random", function () {
        var vals = [], v;
        while (vals.length < 9) { v = 1 + Math.floor(Math.random() * 99); if (vals.indexOf(v) < 0) { vals.push(v); } }
        return treeOf(vals);
      }, "Random values usually make a reasonably bushy tree."],
      ["Empty", function () { return { t: emptyTree() }; }, "An empty tree. Insert something!"]
    ],
    setup: function (stage) {
      stage.innerHTML = "";
      bst.svg = svg("svg", { "class": "ds-tree", viewBox: "0 0 " + TW + " " + TH }, stage);
      bst.outEl = AV.el("div", "ds-out");
      stage.appendChild(bst.outEl);
    },
    draw: function (stage, f) {
      var s = bst.svg, t = f.st.t;
      s.innerHTML = "";
      var lines = svg("g", {}, s), nodes = svg("g", {}, s);
      for (var i = 0; i < SLOTS; i++) {
        if (t[i] == null) { continue; }
        var p = slotXY(i);
        if (i > 0) {
          var q = slotXY(Math.floor((i - 1) / 2));
          svg("line", { x1: q.x, y1: q.y, x2: p.x, y2: p.y, "class": "ds-edge" }, lines);
        }
        var g = svg("g", { "class": "ds-tnode" + cls(f.hl[i]), transform: "translate(" + p.x + "," + p.y + ")" }, nodes);
        svg("circle", { r: 16 }, g);
        svg("text", { y: 4.5, "text-anchor": "middle" }, g, t[i]);
      }
      var out = f.x.out;
      /* only the in-order walk prints; the row keeps its space either way */
      bst.outEl.style.visibility = out ? "visible" : "hidden";
      bst.outEl.innerHTML = '<span class="pf-ds-name">Printed</span>' +
        (out && out.length ? out.map(function (v) { return '<span class="av-box">' + v + "</span>"; }).join("") : '<span class="r-empty">nothing yet</span>');
    }
  };

  var STRUCTS = { stack: stack, queue: queue, list: list, hash: hash, bst: bst };

  /* ============================================================
     page wiring
     ============================================================ */

  var stage = $("#stage"), say = $("#say"), stepsEl = $("#steps"), opName = $("#op-name"), opBadge = $("#op-badge");
  var vIn = $("#in-v"), iIn = $("#in-i"), kIn = $("#in-k");
  var current = /^#(stack|queue|list|hash|bst)$/.test(location.hash) ? location.hash.slice(1) : "stack";
  var code = AV.Code($("#code"), [], $("#now"));
  var learnBtn = AV.learn($("#learn"), STRUCTS[current].topic);

  function render(f) {
    STRUCTS[current].draw(stage, f);
    code.mark(f.line);
    say.innerHTML = f.msg;
    stepsEl.textContent = f.steps;
  }
  var player = AV.Player($("#controls"), render, {
    keys: true, speed: 1,
    steady: [{ el: say, html: function (f) { return f.msg; } }]
  });

  function idle(msg) {
    var r = Rec(STRUCTS[current].state);
    r.snap(-1, msg);
    player.load(r.frames);
  }

  function run(key) {
    var S = STRUCTS[current], op = S.ops[key];
    document.querySelectorAll("[data-op]").forEach(function (x) {
      x.setAttribute("aria-pressed", x.getAttribute("data-op") === key ? "true" : "false");
    });
    code.load(op.code);
    opName.textContent = op.label;
    opBadge.textContent = op.big;
    opBadge.className = "av-badge " + op.cls;
    var r = Rec(S.state), v = parseInt(vIn.value, 10), i = parseInt(iIn.value, 10);
    var k = (kIn.value || "").trim().toLowerCase().replace(/[^a-z]/g, "").slice(0, 8);
    if (S.inputs === "kv") {
      if (!k) { r.snap(-1, "Type a key first: a short word like " + b("cat") + "."); }
      else { op.run(r, k, isNaN(v) ? 0 : v); }
    } else if (S.inputs === "iv") {
      op.run(r, i, isNaN(v) ? 0 : v);
    } else {
      op.run(r, isNaN(v) ? 0 : v);
    }
    if (!r.frames.length) { r.snap(-1, "Nothing to do."); }
    S.state = clone(r.st);
    player.load(r.frames);
    if (!AV.calm) { player.play(); }
    if (window.innerWidth < 900) {
      stage.closest(".av-panel").scrollIntoView({ behavior: AV.calm ? "auto" : "smooth", block: "start" });
    }
  }

  function show(key) {
    current = key;
    var S = STRUCTS[key];
    stage.className = "av-stage ds-stage is-" + key;
    S.setup(stage);
    $("#struct-name").textContent = S.name;
    $("#used").textContent = S.used;
    $("#cheat").innerHTML = S.cheat.map(function (c) {
      return "<tr><td style='font-family:var(--font-body)'>" + c[0] + "</td><td class='" + (/O\(n\)|not/.test(c[1]) ? "bad" : "good") + "'>" + c[1] + "</td></tr>";
    }).join("");
    $("#lbl-v").hidden = false;
    $("#lbl-i").hidden = S.inputs !== "iv";
    $("#lbl-k").hidden = S.inputs !== "kv";
    learnBtn.topic(S.topic);

    var ops = $("#ops");
    ops.innerHTML = "";
    Object.keys(S.ops).forEach(function (k) {
      var op = S.ops[k];
      var btn = AV.el("button", "av-op", "<span>" + op.label + '</span><span class="av-badge ' + op.cls + '">' + op.big + "</span>");
      btn.type = "button";
      btn.setAttribute("data-op", k);
      btn.setAttribute("aria-pressed", "false");
      btn.addEventListener("click", function () { run(k); });
      ops.appendChild(btn);
    });
    var pre = $("#presets");
    pre.innerHTML = "";
    (S.presets || []).forEach(function (p) {
      var btn = AV.el("button", "av-pill is-small", p[0]);
      btn.type = "button";
      btn.addEventListener("click", function () { S.state = p[1](); idle(p[2]); });
      pre.appendChild(btn);
    });
    pre.hidden = !S.presets;
    var first = S.ops[Object.keys(S.ops)[0]];
    code.load(first.code);
    opName.textContent = first.label;
    opBadge.textContent = first.big;
    opBadge.className = "av-badge " + first.cls;
    idle("This is a " + b(S.name.toLowerCase()) + ". Pick an operation on the right to watch it work.");
  }

  document.querySelectorAll("#structs [data-pick]").forEach(function (p) {
    p.setAttribute("aria-pressed", p.getAttribute("data-pick") === current ? "true" : "false");
  });
  AV.pills($("#structs"), function (k) {
    try { history.replaceState(null, "", "#" + k); } catch (e) { /* file:// */ }
    show(k);
  });
  show(current);

  AV.quiz($("#quiz"), [
    {
      q: "You want an Undo button. Each new action goes on top, and Undo takes back the most recent one. Which structure?",
      opts: ["Queue", "Stack", "Hash map", "Binary search tree"], a: 1,
      why: "Last in, first out: the newest action is the first one undone. That's exactly a stack."
    },
    {
      q: "Why is reaching item 500 slow in a linked list but instant in an array?",
      opts: ["Linked lists are smaller", "A list has no addresses to calculate, so you have to follow 500 arrows", "Arrays are sorted", "It isn't slower"], a: 1,
      why: "Array cells sit side by side, so the address is one sum (see Arrays). List nodes can be anywhere, so the only way to node 500 is walking from the head."
    },
    {
      q: "How does a hash map find a key without searching every bucket?",
      opts: ["It sorts the keys", "It turns the key into a bucket number, so it knows exactly where to look", "It checks buckets in order", "It guesses"], a: 1,
      why: "The hash function always turns the same key into the same number. Go straight to that bucket and only check its short chain."
    },
    {
      q: "You insert 1, 2, 3, 4, 5 into an empty binary search tree. Searching it is now...",
      opts: ["O(1)", "O(log n)", "O(n)", "Impossible"], a: 2,
      why: "Every value is bigger than the last, so every node goes right: a stick, not a tree. Try the <b>Sorted input</b> preset. Self-balancing trees (AVL, red-black) exist to stop this."
    }
  ], $("#quiz-score"));
})();
