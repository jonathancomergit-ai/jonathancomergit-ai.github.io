/* ============================================================
   AlgoVision - Recursion

   Same idea as the other modules: run the function once for real,
   save a frame at every step. Here a frame holds:
     stack  - the call stack, bottom first
     state  - what each call in the tree is doing right now
     memo   - the memo table (memoized fib only)
   The tree layout is worked out AFTER the run, once we know
   every call that happened.
   ============================================================ */

(function () {
  "use strict";

  var $ = function (s) { return document.querySelector(s); };
  function b(v) { return "<b>" + v + "</b>"; }

  /* ---------- recording ---------- */

  function Rec(short) {
    var r = {
      nodes: [], state: [], stack: [], memo: {}, frames: [],
      calls: 0, depth: 0, maxDepth: 0, hits: 0, short: short
    };
    r.snap = function (line, msg) {
      r.frames.push({
        line: line, msg: msg,
        state: r.state.slice(),
        vals: r.nodes.map(function (n) { return n.val; }),
        stack: r.stack.map(function (s, k) {
          return { label: s.label, note: s.note, top: k === r.stack.length - 1 };
        }),
        memo: Object.keys(r.memo).map(function (k) { return [+k, r.memo[k]]; }),
        calls: r.calls, depth: r.stack.length, maxDepth: r.maxDepth, hits: r.hits
      });
    };
    /* Start a call: new tree node + push a stack frame. */
    r.enter = function (n, parent) {
      var id = r.nodes.length;
      r.nodes.push({ n: n, parent: parent, kids: [], val: null, label: short + "(" + n + ")" });
      if (parent != null) { r.nodes[parent].kids.push(id); r.state[parent] = "wait"; }
      r.state[id] = "active";
      r.stack.push({ id: id, label: short + "(" + n + ")", note: "" });
      r.calls++;
      r.maxDepth = Math.max(r.maxDepth, r.stack.length);
      return id;
    };
    /* Finish a call: record its value, pop the frame, wake the caller. */
    r.leave = function (id, val, line, msg, how) {
      r.nodes[id].val = val;
      r.state[id] = how || "done";
      r.stack.pop();
      var p = r.nodes[id].parent;
      if (p != null) { r.state[p] = "active"; }
      r.snap(line, msg);
    };
    r.note = function (txt) { r.stack[r.stack.length - 1].note = txt; };
    return r;
  }

  /* ---------- the functions ---------- */

  function factorial(N) {
    var r = Rec("fact");
    function go(n, parent) {
      var id = r.enter(n, parent);
      r.snap(0, "Call " + b("fact(" + n + ")") + ". A new frame goes on top of the call stack to hold its n = " + n + ".");
      r.snap(1, "Is n <= 1? " + (n <= 1 ? "Yes." : "No, " + n + " is bigger."));
      if (n <= 1) {
        r.leave(id, 1, 2, b("Base case!") + " fact(" + n + ") returns 1 without calling anything. " +
          "This is what stops the recursion. Its frame pops off the stack.");
        return 1;
      }
      r.note("waiting for fact(" + (n - 1) + ")");
      r.snap(3, "To get " + n + " × fact(" + (n - 1) + "), we first need " + b("fact(" + (n - 1) + ")") +
        ". So fact(" + n + ") " + b("pauses") + " and waits.");
      var sub = go(n - 1, id);
      r.note(n + " × " + sub);
      r.snap(3, "fact(" + (n - 1) + ") came back with " + b(sub) + ". Now fact(" + n + ") can finish: " +
        n + " × " + sub + " = " + b(n * sub) + ".");
      r.leave(id, n * sub, 3, "fact(" + n + ") returns " + b(n * sub) + " to whoever called it, and its frame pops off.");
      return n * sub;
    }
    go(N, null);
    r.snap(-1, "Done! fact(" + N + ") = " + b(r.nodes[0].val) + ". That took " + b(r.calls + " calls") +
      " and the stack got " + b(r.maxDepth + " deep") + ". One call per number: O(n).");
    return r;
  }

  function fib(N) {
    var r = Rec("fib");
    function go(n, parent) {
      var id = r.enter(n, parent);
      r.snap(0, "Call " + b("fib(" + n + ")") + ". Push its frame onto the stack.");
      if (n <= 1) {
        r.leave(id, n, 2, b("Base case:") + " fib(" + n + ") = " + n + ". Return straight away and pop.");
        return n;
      }
      r.note("waiting for fib(" + (n - 1) + ")");
      r.snap(3, "fib(" + n + ") needs fib(" + (n - 1) + ") + fib(" + (n - 2) + "). Start with the left one, " +
        b("fib(" + (n - 1) + ")") + ".");
      var x = go(n - 1, id);
      r.note(x + " + waiting for fib(" + (n - 2) + ")");
      r.snap(3, "Left side done: fib(" + (n - 1) + ") = " + b(x) + ". Now the right side, " + b("fib(" + (n - 2) + ")") + ".");
      var y = go(n - 2, id);
      r.note(x + " + " + y);
      r.leave(id, x + y, 3, "fib(" + n + ") = " + x + " + " + y + " = " + b(x + y) + ". Return it and pop.");
      return x + y;
    }
    go(N, null);
    var repeats = r.calls - (N + 1);
    r.snap(-1, "Done! fib(" + N + ") = " + b(r.nodes[0].val) + " but it took " + b(r.calls + " calls") +
      ". Look at the tree: the same calls get worked out " + b("again and again") + " (" + Math.max(0, repeats) +
      " of them are repeats). That's O(2ⁿ). Now try the memo version.");
    return r;
  }

  function fibMemo(N) {
    var r = Rec("fib");
    function go(n, parent) {
      var id = r.enter(n, parent);
      r.snap(1, "Call " + b("fib(" + n + ")") + ". Push its frame onto the stack.");
      var hit = Object.prototype.hasOwnProperty.call(r.memo, n);
      r.snap(2, "Is fib(" + n + ") already in the memo? " + (hit ? b("Yes!") : "No."));
      if (hit) {
        r.hits++;
        r.leave(id, r.memo[n], 3, "Memo hit: fib(" + n + ") = " + b(r.memo[n]) + " was worked out before, " +
          "so return it " + b("instantly") + ". No more calls down this branch.", "memo");
        return r.memo[n];
      }
      if (n <= 1) {
        r.leave(id, n, 5, b("Base case:") + " fib(" + n + ") = " + n + ". Return and pop.");
        return n;
      }
      r.note("waiting for fib(" + (n - 1) + ")");
      r.snap(6, "Need fib(" + (n - 1) + ") + fib(" + (n - 2) + "). Start with " + b("fib(" + (n - 1) + ")") + ".");
      var x = go(n - 1, id);
      r.note(x + " + waiting for fib(" + (n - 2) + ")");
      r.snap(6, "fib(" + (n - 1) + ") = " + b(x) + ". Now " + b("fib(" + (n - 2) + ")") + "." +
        (n - 2 >= 2 ? " (Watch: it's already in the memo.)" : ""));
      var y = go(n - 2, id);
      r.memo[n] = x + y;
      r.note(x + " + " + y);
      r.snap(6, "fib(" + n + ") = " + x + " + " + y + " = " + b(x + y) + ". " + b("Write it in the memo") +
        " so nobody has to work it out again.");
      r.leave(id, x + y, 7, "Return " + b(x + y) + " and pop.");
      return x + y;
    }
    go(N, null);
    r.snap(-1, "Done! fib(" + N + ") = " + b(r.nodes[0].val) + " in just " + b(r.calls + " calls") + ", " +
      b(r.hits + " of them memo hits") + ". Naive fib(" + N + ") needs " + b(naiveCalls(N).toLocaleString()) +
      ". Remembering answers turned O(2ⁿ) into O(n).");
    return r;
  }

  function naiveCalls(n) {
    /* calls(n) = 1 + calls(n-1) + calls(n-2), calls(0) = calls(1) = 1 */
    var a = 1, c = 1;
    for (var i = 2; i <= n; i++) { var t = 1 + a + c; a = c; c = t; }
    return c;
  }

  var FUNCS = {
    fact: {
      name: "Factorial", run: factorial, min: 1, max: 8, start: 4,
      code: [
        "def fact(n):",
        "    if n <= 1:",
        "        return 1  # base case: stop here",
        "    return n * fact(n - 1)  # recursive case"
      ]
    },
    fib: {
      name: "Fibonacci", run: fib, min: 1, max: 7, start: 5,
      code: [
        "def fib(n):",
        "    if n <= 1:",
        "        return n  # base case",
        "    return fib(n - 1) + fib(n - 2)  # TWO calls"
      ]
    },
    memo: {
      name: "Fibonacci + memo", run: fibMemo, min: 1, max: 12, start: 6,
      code: [
        "memo = {}",
        "def fib(n):",
        "    if n in memo:",
        "        return memo[n]  # already worked out!",
        "    if n <= 1:",
        "        return n",
        "    memo[n] = fib(n - 1) + fib(n - 2)",
        "    return memo[n]"
      ]
    }
  };

  /* ---------- the call tree (SVG) ---------- */

  var NS = "http://www.w3.org/2000/svg";
  var NW = 46, NH = 30, GX = 10, GY = 26;
  var treeSvg = $("#rtree"), treeEls = [];

  function svgEl(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) { e.setAttribute(k, attrs[k]); }
    if (parent) { parent.appendChild(e); }
    return e;
  }

  /* Leaves get the next free column; a parent sits centred over its kids. */
  function layout(nodes) {
    var col = 0, maxD = 0;
    function place(id, d) {
      var nd = nodes[id];
      nd.d = d; maxD = Math.max(maxD, d);
      if (!nd.kids.length) { nd.x = col++; return; }
      nd.kids.forEach(function (k) { place(k, d + 1); });
      nd.x = (nodes[nd.kids[0]].x + nodes[nd.kids[nd.kids.length - 1]].x) / 2;
    }
    place(0, 0);
    return { cols: col, depth: maxD + 1 };
  }

  function buildTree(r) {
    var L = layout(r.nodes);
    var W = L.cols * (NW + GX) + GX, H = L.depth * (NH + GY) + GY - 10;
    treeSvg.setAttribute("viewBox", "0 0 " + W + " " + H);
    treeSvg.style.minWidth = Math.min(W, L.cols * 34) + "px";
    treeSvg.style.maxWidth = W * 1.4 + "px";
    treeSvg.innerHTML = "";
    var lines = svgEl("g", { "class": "r-edges" }, treeSvg);
    var boxes = svgEl("g", {}, treeSvg);
    function cx(nd) { return GX + nd.x * (NW + GX) + NW / 2; }
    function cy(nd) { return 8 + nd.d * (NH + GY); }
    treeEls = r.nodes.map(function (nd) {
      var edge = null;
      if (nd.parent != null) {
        var p = r.nodes[nd.parent];
        edge = svgEl("line", { x1: cx(p), y1: cy(p) + NH, x2: cx(nd), y2: cy(nd) }, lines);
      }
      var g = svgEl("g", { "class": "r-node", transform: "translate(" + (cx(nd) - NW / 2) + "," + cy(nd) + ")" }, boxes);
      svgEl("rect", { width: NW, height: NH, rx: 7 }, g);
      var t = svgEl("text", { x: NW / 2, y: 12.5, "text-anchor": "middle", "class": "r-lbl" }, g);
      t.textContent = nd.label.replace("fact", "f").replace("fib", "f");
      var v = svgEl("text", { x: NW / 2, y: 25, "text-anchor": "middle", "class": "r-val" }, g);
      return { g: g, v: v, edge: edge };
    });
  }

  function drawTree(f) {
    treeEls.forEach(function (t, i) {
      var s = f.state[i];
      t.g.setAttribute("class", "r-node" + (s ? " is-" + s : ""));
      if (t.edge) { t.edge.setAttribute("class", s ? "is-on" : ""); }
      t.v.textContent = f.vals[i] != null && (s === "done" || s === "memo") ? "= " + f.vals[i] : "";
    });
  }

  /* ---------- page wiring ---------- */

  var stackEl = $("#stack"), memoEl = $("#memo"), memoWrap = $("#memo-wrap");
  var say = $("#say");
  var sCalls = $("#s-calls"), sDepth = $("#s-depth"), sHits = $("#s-hits"), sHitsBox = $("#s-hits-box");
  var code = AV.Code($("#code"), [], $("#now"));

  function render(f) {
    code.mark(f.line);
    say.innerHTML = f.msg;
    sCalls.textContent = f.calls;
    sDepth.textContent = f.depth + " (max " + f.maxDepth + ")";
    sHits.textContent = f.hits;
    stackEl.innerHTML = f.stack.length
      ? f.stack.slice().reverse().map(function (s) {
          return '<div class="r-frame' + (s.top ? " is-top" : "") + '"><b>' + s.label + "</b>" +
            (s.note ? "<span>" + s.note + "</span>" : "") + "</div>";
        }).join("")
      : '<p class="r-empty">Empty. Nothing is running.</p>';
    memoEl.innerHTML = f.memo.length
      ? f.memo.map(function (m) { return '<span class="av-box">' + m[0] + ": " + m[1] + "</span>"; }).join("")
      : '<span class="r-empty">empty</span>';
    drawTree(f);
  }

  var player = AV.Player($("#controls"), render, { keys: true, speed: 1 });
  var current = /^#(fact|fib|memo)$/.test(location.hash) ? location.hash.slice(1) : "fact";
  var nIn = $("#rn"), nOut = $("#rn-out");

  function rebuild() {
    var F = FUNCS[current];
    nIn.min = F.min; nIn.max = F.max;
    if (+nIn.value > F.max || +nIn.value < F.min) { nIn.value = F.start; }
    nOut.textContent = nIn.value;
    $("#fn-name").textContent = F.name + "(" + nIn.value + ")";
    code.load(F.code);
    memoWrap.hidden = current !== "memo";
    sHitsBox.hidden = current !== "memo";
    var r = F.run(+nIn.value);
    buildTree(r);
    player.load(r.frames);
  }

  document.querySelectorAll("#fns [data-pick]").forEach(function (p) {
    p.setAttribute("aria-pressed", p.getAttribute("data-pick") === current ? "true" : "false");
  });
  AV.pills($("#fns"), function (k) {
    current = k;
    nIn.value = FUNCS[k].start;
    try { history.replaceState(null, "", "#" + k); } catch (e) { /* file:// */ }
    rebuild();
  });
  nIn.addEventListener("input", rebuild);
  nIn.value = FUNCS[current].start;
  rebuild();

  /* ---------- naive vs memo table ---------- */

  $("#compare").innerHTML = [5, 10, 20, 30, 40].map(function (n) {
    var naive = naiveCalls(n), memo = 2 * n - 1;
    return "<tr><td>fib(" + n + ")</td><td class='bad'>" + naive.toLocaleString() + "</td><td class='good'>" +
      memo + "</td><td style='font-family:var(--font-body)'>" + Math.round(naive / memo).toLocaleString() + "&times; fewer</td></tr>";
  }).join("");

  AV.learn($("#learn"), "recursion");

  AV.quiz($("#quiz"), [
    {
      q: "What happens if a recursive function has no base case?",
      code: ["def forever(n):", "    return forever(n - 1)"],
      opts: ["It returns 0", "It calls itself until the call stack runs out of room and crashes", "Python fixes it", "It runs once"], a: 1,
      why: "Every call adds a frame to the stack and none ever finish. Python stops it at about 1,000 deep with a <b>RecursionError</b>. That's a stack overflow."
    },
    {
      q: "How deep does the call stack get for fact(5)?",
      opts: ["1", "5", "25", "120"], a: 1,
      why: "fact(5) waits on fact(4), which waits on fact(3)... down to fact(1). Five frames stacked at once. Run it above and watch the <b>Stack depth</b> number."
    },
    {
      q: "Why is naive fib so slow?",
      opts: ["Addition is slow", "It works out the same smaller fibs over and over", "Python is slow at recursion", "The base case is wrong"], a: 1,
      why: "fib(5) calls fib(3) twice, fib(2) three times... the repeats double with every level. Memoization saves each answer the first time so it never repeats."
    },
    {
      q: "With memoization, roughly how many calls does fib(n) make?",
      opts: ["About 2n", "About n²", "About 2ⁿ", "Exactly 1"], a: 0,
      why: "Each fib(k) is worked out once, and each one asks for two others, one of which is already in the memo. About 2n calls: O(n)."
    }
  ], $("#quiz-score"));
})();
