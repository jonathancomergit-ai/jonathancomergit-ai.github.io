/* ============================================================
   AlgoVision - Dynamic programming

   Every DP problem here fills a TABLE: each cell is the answer to
   a smaller problem, worked out from cells already filled in.
   So one renderer serves them all. A problem says how to build
   its table (rows, columns, headers) and records frames where a
   frame is just: every cell's value + which cells are lit.

   Cells are numbered row by row: i = r * cols + c.
   ============================================================ */

(function () {
  "use strict";

  var $ = function (s) { return document.querySelector(s); };
  function b(v) { return "<b>" + v + "</b>"; }
  var INF = Infinity;
  function show(v) { return v == null ? "" : v === INF ? "∞" : String(v); }

  /* ---------- recording ---------- */

  function Rec(n) {
    var r = { v: new Array(n).fill(null), frames: [], filled: 0 };
    r.snap = function (line, msg, hl, extra) {
      var f = { v: r.v.slice(), line: line, msg: msg, hl: hl || {}, filled: r.filled, answer: null, note: "" };
      if (extra) { for (var k in extra) { f[k] = extra[k]; } }
      r.frames.push(f);
    };
    return r;
  }
  function H() {
    var o = {};
    for (var i = 0; i < arguments.length; i += 2) { if (arguments[i] != null) { o[arguments[i]] = arguments[i + 1]; } }
    return o;
  }

  /* ============================================================
     1. FIBONACCI, bottom-up
     ============================================================ */

  var fib = {
    name: "Fibonacci (bottom-up)", topic: "dp-fib",
    how: [
      "Remember Recursion? Naive fib re-did the same work over and over.",
      "DP flips it: start from the <b>smallest</b> answers and build up.",
      "Each cell only needs the <b>two cells before it</b>, already filled.",
      "n steps, no repeats: O(n). fib(40) in 41 cells, not 331 million calls."
    ],
    code: [
      "def fib(n):",
      "    dp = [0] * (n + 1)  # dp[i] = fib(i)",
      "    dp[1] = 1",
      "    for i in range(2, n + 1):",
      "        dp[i] = dp[i - 1] + dp[i - 2]",
      "    return dp[n]"
    ],
    layout: function () { var n = +$("#fib-n").value; return { rows: 1, cols: n + 1, colHead: range(n + 1), rowHead: ["dp"] }; },
    run: function (L) {
      var n = L.cols - 1, r = Rec(n + 1);
      r.snap(1, "Make a table with a slot for every answer from fib(0) to fib(" + n + "). Each slot is a smaller version of the problem.");
      r.v[0] = 0; r.filled++;
      r.snap(1, "The smallest answers are known: " + b("fib(0) = 0") + "...", H(0, "write"));
      r.v[1] = 1; r.filled++;
      r.snap(2, "...and " + b("fib(1) = 1") + ". These are the base cases, just like in recursion.", H(1, "write"));
      for (var i = 2; i <= n; i++) {
        r.snap(4, "fib(" + i + ") = fib(" + (i - 1) + ") + fib(" + (i - 2) + "). Both are " + b("already in the table") + ": " + r.v[i - 1] + " and " + r.v[i - 2] + ".",
          H(i - 1, "compare", i - 2, "compare", i, "focus"));
        r.v[i] = r.v[i - 1] + r.v[i - 2]; r.filled++;
        r.snap(4, "Write " + b(r.v[i]) + ". Each cell is filled exactly once.", H(i, "write"));
      }
      r.snap(5, "Done: fib(" + n + ") = " + b(r.v[n]) + " after filling " + b(n + 1 + " cells") + ". The naive recursive version makes " +
        b(naive(n).toLocaleString() + " calls") + " for the same answer.", H(n, "path"), { answer: r.v[n] });
      return r.frames;
    }
  };
  function naive(n) { var a = 1, c = 1; for (var i = 2; i <= n; i++) { var t = 1 + a + c; a = c; c = t; } return c; }
  function range(n) { var a = []; for (var i = 0; i < n; i++) { a.push(i); } return a; }

  /* ============================================================
     2. GRID PATHS: how many ways from top-left to bottom-right,
        moving only right or down? You place the rocks.
     ============================================================ */

  var GR = 5, GC = 7;
  var rocks = {}; [[1, 1], [2, 4], [3, 2]].forEach(function (p) { rocks[p[0] * GC + p[1]] = 1; });

  var grid = {
    name: "Grid paths", topic: "dp-grid", clickable: true,
    how: [
      "A robot starts top-left and can only move <b>right</b> or <b>down</b>. How many routes reach bottom-right?",
      "You can only arrive at a square from <b>above</b> or from the <b>left</b>.",
      "So: ways(here) = ways(above) + ways(left). Rocks have 0 ways.",
      "Tap squares to add or remove rocks, then play it again."
    ],
    code: [
      "def paths(grid):",
      "    dp = [[0] * C for _ in range(R)]",
      "    for r in range(R):",
      "        for c in range(C):",
      "            if grid[r][c] == ROCK:",
      "                dp[r][c] = 0  # can't stand here",
      "            elif r == 0 and c == 0:",
      "                dp[r][c] = 1  # the start: one way to be here",
      "            else:",
      "                up = dp[r - 1][c] if r > 0 else 0",
      "                left = dp[r][c - 1] if c > 0 else 0",
      "                dp[r][c] = up + left",
      "    return dp[R - 1][C - 1]"
    ],
    layout: function () { return { rows: GR, cols: GC, rocks: rocks }; },
    run: function () {
      var r = Rec(GR * GC);
      r.snap(1, "Every square gets a number: how many different routes reach it. Fill them " + b("row by row") + ", left to right, so the squares above and to the left are always done first.");
      for (var y = 0; y < GR; y++) {
        for (var x = 0; x < GC; x++) {
          var i = y * GC + x;
          if (rocks[i]) {
            r.v[i] = 0; r.filled++;
            r.snap(5, "A rock. Nothing can stand here, so " + b("0 ways") + ".", H(i, "write"));
          } else if (!y && !x) {
            r.v[i] = 1; r.filled++;
            r.snap(7, "The start. There's exactly " + b("1 way") + " to be where you begin.", H(i, "write"));
          } else {
            var up = y ? r.v[i - GC] : 0, left = x ? r.v[i - 1] : 0;
            r.snap(11, "Ways from above (" + b(up) + ") + ways from the left (" + b(left) + ").", H(y ? i - GC : null, "compare", x ? i - 1 : null, "compare", i, "focus"));
            r.v[i] = up + left; r.filled++;
            r.snap(11, "= " + b(r.v[i]) + " ways to reach this square.", H(i, "write"));
          }
        }
      }
      var end = GR * GC - 1;
      r.snap(12, b(r.v[end] + " different routes") + " to the corner, found by filling " + b(GR * GC + " squares") +
        ". Listing every route one by one would take far longer on a big grid.", H(end, "path"), { answer: r.v[end] });
      return r.frames;
    }
  };

  /* ============================================================
     3. COIN CHANGE: fewest coins that add up to an amount
     ============================================================ */

  var coins = {
    name: "Coin change", topic: "dp-coins",
    how: [
      "Fewest coins to make an amount. Grabbing the biggest coin first (<b>greedy</b>) doesn't always work.",
      "dp[a] = fewest coins to make amount a. dp[0] = 0.",
      "For each amount, try every coin: use it, plus the best way to make what's left (<b>already in the table</b>).",
      "Try the greedy trap: coins 1, 3, 4 and amount 6. Greedy says 4+1+1. DP finds 3+3."
    ],
    code: [
      "def min_coins(coins, amount):",
      "    dp = [0] + [inf] * amount  # dp[a] = fewest coins for a",
      "    for a in range(1, amount + 1):",
      "        for c in coins:",
      "            if c <= a and dp[a - c] + 1 < dp[a]:",
      "                dp[a] = dp[a - c] + 1  # use coin c",
      "    return dp[amount]"
    ],
    parse: function () {
      var cs = ($("#coins-set").value || "").split(/[^0-9]+/).map(Number).filter(function (x) { return x > 0 && x <= 30; });
      cs = cs.filter(function (x, k) { return cs.indexOf(x) === k; }).sort(function (x, y) { return x - y; }).slice(0, 5);
      return { coins: cs.length ? cs : [1], amount: +$("#coins-amt").value };
    },
    layout: function () { var p = coins.parse(); return { rows: 1, cols: p.amount + 1, colHead: range(p.amount + 1), rowHead: ["dp"], wrap: true }; },
    run: function () {
      var p = coins.parse(), A = p.amount, cs = p.coins, r = Rec(A + 1), use = new Array(A + 1).fill(null);
      r.snap(1, "Coins: " + b(cs.join(", ")) + ". Each slot will hold the fewest coins needed for that amount. Start them all at ∞ (not possible yet).");
      for (var k = 1; k <= A; k++) { r.v[k] = INF; }
      r.v[0] = 0; r.filled++;
      r.snap(1, "Making 0 takes " + b("0 coins") + ". That's the base case.", H(0, "write"));
      for (var a = 1; a <= A; a++) {
        cs.forEach(function (c) {
          if (c > a) { return; }
          var cand = r.v[a - c] + 1, better = cand < r.v[a];
          r.snap(4, "Amount " + a + ", try a " + b(c) + ": that leaves " + (a - c) + ", which takes " + b(show(r.v[a - c])) + ". Total " + show(cand) + ". " +
            (better ? "Better than " + show(r.v[a]) + "!" : "Not better than " + show(r.v[a]) + "."), H(a - c, "compare", a, "focus"));
          if (better) { r.v[a] = cand; use[a] = c; r.snap(5, "dp[" + a + "] = " + b(cand) + " (using a " + c + ").", H(a, "write")); }
        });
        r.filled++;
      }
      if (r.v[A] === INF) {
        r.snap(6, "Amount " + A + " " + b("can't be made") + " from these coins.", H(A, "path"), { answer: "none" });
        return r.frames;
      }
      var used = [], at = A, path = {};
      while (at > 0) { path[at] = "path"; used.push(use[at]); at -= use[at]; }
      path[0] = "path";
      used.sort(function (x, y) { return y - x; });
      var g = greedy(cs, A);
      r.snap(6, "Fewest coins for " + A + ": " + b(r.v[A]) + " (" + used.join(" + ") + "). Follow the green cells back to 0 to see them." +
        (g && g.length > r.v[A] ? " Greedy would have used " + b(g.length) + " (" + g.join(" + ") + ")." : ""), path, { answer: r.v[A] });
      return r.frames;
    }
  };
  function greedy(cs, A) {
    var out = [], left = A, desc = cs.slice().sort(function (x, y) { return y - x; });
    desc.forEach(function (c) { while (left >= c) { out.push(c); left -= c; } });
    return left ? null : out;
  }

  /* ============================================================
     4. LONGEST COMMON SUBSEQUENCE
     ============================================================ */

  function word(sel) { return ($(sel).value || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 8) || "A"; }

  var lcs = {
    name: "Longest common subsequence", topic: "dp-lcs",
    how: [
      "The longest run of letters both words share <b>in the same order</b> (gaps allowed). It's how <b>diff</b> and spell-checkers compare text.",
      "Cell (i, j) = the answer for the first i letters of one word and the first j of the other.",
      "Letters match? Take the diagonal + 1. No match? Take the bigger of above and left.",
      "Then walk back from the bottom-right corner to read off the letters."
    ],
    code: [
      "def lcs(a, b):",
      "    dp = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]",
      "    for i in range(1, len(a) + 1):",
      "        for j in range(1, len(b) + 1):",
      "            if a[i - 1] == b[j - 1]:",
      "                dp[i][j] = dp[i - 1][j - 1] + 1  # letters match",
      "            else:",
      "                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])",
      "    return dp[len(a)][len(b)]"
    ],
    layout: function () {
      var A = word("#lcs-a"), B = word("#lcs-b");
      return { rows: A.length + 1, cols: B.length + 1, colHead: [""].concat(B.split("")), rowHead: [""].concat(A.split("")) };
    },
    run: function (L) {
      var A = word("#lcs-a"), B = word("#lcs-b"), R = A.length + 1, C = B.length + 1, r = Rec(R * C);
      function at(i, j) { return i * C + j; }
      for (var j0 = 0; j0 < C; j0++) { r.v[at(0, j0)] = 0; }
      for (var i0 = 0; i0 < R; i0++) { r.v[at(i0, 0)] = 0; }
      r.snap(1, "The top row and left column are 0: an empty word has nothing in common with anything.");
      for (var i = 1; i < R; i++) {
        for (var j = 1; j < C; j++) {
          var k = at(i, j);
          if (A[i - 1] === B[j - 1]) {
            r.snap(4, b(A[i - 1]) + " = " + b(B[j - 1]) + ": the letters " + b("match") + ". Take the diagonal (" + r.v[at(i - 1, j - 1)] + ") and add 1.",
              H(at(i - 1, j - 1), "compare", k, "focus"));
            r.v[k] = r.v[at(i - 1, j - 1)] + 1;
            r.snap(5, "= " + b(r.v[k]) + ".", H(k, "write"));
          } else {
            var up = r.v[at(i - 1, j)], left = r.v[at(i, j - 1)];
            r.snap(7, b(A[i - 1]) + " &ne; " + b(B[j - 1]) + ". Keep the best answer so far: bigger of above (" + up + ") and left (" + left + ").",
              H(at(i - 1, j), "compare", at(i, j - 1), "compare", k, "focus"));
            r.v[k] = Math.max(up, left);
            r.snap(7, "= " + b(r.v[k]) + ".", H(k, "write"));
          }
          r.filled++;
        }
      }
      /* walk back to read the letters */
      var path = {}, letters = [], y = R - 1, x = C - 1;
      while (y > 0 && x > 0) {
        path[at(y, x)] = "path";
        if (A[y - 1] === B[x - 1]) { letters.unshift(A[y - 1]); y--; x--; }
        else if (r.v[at(y - 1, x)] >= r.v[at(y, x - 1)]) { y--; } else { x--; }
      }
      var res = letters.join("") || "(nothing)";
      r.snap(8, "Longest common subsequence: " + b(res) + " (" + letters.length + " letter" + (letters.length === 1 ? "" : "s") +
        "). The green cells are the walk back from the corner. Every diagonal step on a match picks up a letter.", path, { answer: res });
      return r.frames;
    }
  };

  var PROBLEMS = { fib: fib, grid: grid, coins: coins, lcs: lcs };

  /* ============================================================
     the table
     ============================================================ */

  var stage = $("#stage"), say = $("#say"), cellsEl = [], L = null;
  var current = /^#(fib|grid|coins|lcs)$/.test(location.hash) ? location.hash.slice(1) : "fib";

  function buildTable() {
    var P = PROBLEMS[current];
    L = P.layout();
    stage.innerHTML = "";
    stage.className = "av-stage dp-stage is-" + current;
    var t = AV.el("div", "dp-table" + (L.wrap ? " is-wrap" : ""));
    var hasCol = !!L.colHead, hasRow = !!L.rowHead;
    if (!L.wrap) {
      t.style.gridTemplateColumns = (hasRow ? "auto " : "") + "repeat(" + L.cols + ", minmax(0, 1fr))";
    }
    cellsEl = [];
    if (hasCol && !L.wrap) {
      if (hasRow) { t.appendChild(AV.el("div", "dp-head")); }
      L.colHead.forEach(function (h) { t.appendChild(AV.el("div", "dp-head", AV.esc(h))); });
    }
    for (var y = 0; y < L.rows; y++) {
      if (hasRow && !L.wrap) { t.appendChild(AV.el("div", "dp-head is-row", AV.esc(L.rowHead[y]))); }
      for (var x = 0; x < L.cols; x++) {
        var i = y * L.cols + x;
        var c = AV.el("div", "dp-cell" + (L.rocks && L.rocks[i] ? " is-rock" : ""));
        c.setAttribute("data-i", i);
        if (L.wrap) { c.setAttribute("data-label", L.colHead[x]); }
        t.appendChild(c);
        cellsEl.push(c);
      }
    }
    stage.appendChild(t);
  }

  function render(f) {
    for (var i = 0; i < cellsEl.length; i++) {
      var h = f.hl[i], c = cellsEl[i];
      var base = "dp-cell" + (L.rocks && L.rocks[i] ? " is-rock" : "");
      c.className = base + (h ? " is-" + h : f.v[i] == null ? " is-blank" : "");
      c.textContent = show(f.v[i]);
    }
    code.mark(f.line);
    say.innerHTML = f.msg;
    $("#s-filled").textContent = f.filled;
    $("#s-answer").textContent = f.answer == null ? "-" : f.answer;
  }

  var code = AV.Code($("#code"), [], $("#now"));
  var player = AV.Player($("#controls"), render, {
    keys: true, speed: 2,
    steady: [{ el: say, html: function (f) { return f.msg; } }]
  });
  var learnBtn = AV.learn($("#learn"), PROBLEMS[current].topic);

  function rebuild() {
    var P = PROBLEMS[current];
    $("#prob-name").textContent = P.name;
    $("#how").innerHTML = P.how.map(function (h) { return "<li>" + h + "</li>"; }).join("");
    code.load(P.code);
    learnBtn.topic(P.topic);
    document.querySelectorAll("[data-for]").forEach(function (g) { g.hidden = g.getAttribute("data-for") !== current; });
    buildTable();
    player.load(P.run(L));
  }

  /* tap a square on the grid problem to add / remove a rock */
  stage.addEventListener("click", function (ev) {
    if (current !== "grid") { return; }
    var c = ev.target.closest && ev.target.closest(".dp-cell");
    if (!c) { return; }
    var i = +c.getAttribute("data-i");
    if (i === 0 || i === GR * GC - 1) { return; }
    if (rocks[i]) { delete rocks[i]; } else { rocks[i] = 1; }
    rebuild();
  });

  document.querySelectorAll("#probs [data-pick]").forEach(function (p) {
    p.setAttribute("aria-pressed", p.getAttribute("data-pick") === current ? "true" : "false");
  });
  AV.pills($("#probs"), function (k) {
    current = k;
    try { history.replaceState(null, "", "#" + k); } catch (e) { /* file:// */ }
    rebuild();
  });

  var fibN = $("#fib-n"), fibOut = $("#fib-n-out"), amt = $("#coins-amt"), amtOut = $("#coins-amt-out");
  fibN.addEventListener("input", function () { fibOut.textContent = fibN.value; rebuild(); });
  amt.addEventListener("input", function () { amtOut.textContent = amt.value; rebuild(); });
  ["#coins-set", "#lcs-a", "#lcs-b"].forEach(function (s) { $(s).addEventListener("change", rebuild); });
  $("#coins-go").addEventListener("click", rebuild);
  $("#lcs-go").addEventListener("click", rebuild);
  document.querySelectorAll("[data-coins]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var p = btn.getAttribute("data-coins").split("|");
      $("#coins-set").value = p[0]; amt.value = p[1]; amtOut.textContent = p[1];
      rebuild();
    });
  });
  $("#grid-clear").addEventListener("click", function () { rocks = {}; rebuild(); });
  $("#grid-random").addEventListener("click", function () {
    rocks = {};
    for (var i = 1; i < GR * GC - 1; i++) { if (Math.random() < 0.2) { rocks[i] = 1; } }
    rebuild();
  });

  rebuild();

  AV.quiz($("#quiz"), [
    {
      q: "What two things does a problem need for dynamic programming to help?",
      opts: ["It must be sorted and small", "Overlapping smaller problems, and the big answer can be built from the small answers", "It must use recursion and a queue", "Only numbers, no text"], a: 1,
      why: "DP pays off when the same subproblems come up again and again (<b>overlapping subproblems</b>) and the answer is built from their answers (<b>optimal substructure</b>). Fibonacci, grid paths, coins and LCS all have both."
    },
    {
      q: "Memoization (Recursion module) vs a DP table. What's the difference?",
      opts: ["Memo works top-down from the big problem; a table fills bottom-up from the smallest", "They give different answers", "Tables are always slower", "Memo can't use a dictionary"], a: 0,
      why: "Same idea, opposite directions. Memo starts at fib(n) and remembers answers as recursion finds them. The table starts at fib(0) and builds up, with no recursion at all."
    },
    {
      q: "Coins 1, 3 and 4. What's the fewest coins to make 6?",
      opts: ["1", "2", "3", "6"], a: 1,
      why: "3 + 3 = 2 coins. Greedy (biggest first) takes 4 + 1 + 1 = 3 coins. Try it: press <b>Greedy trap</b>."
    },
    {
      q: "On a grid with no rocks, the number of ways to reach a square equals...",
      opts: ["ways from above + ways from the left", "ways from above × ways from the left", "the row number", "always 1"], a: 0,
      why: "Every route into a square comes from directly above or directly left (only right/down moves), so you add the two. Those numbers form Pascal's triangle, tilted."
    }
  ], $("#quiz-score"));
})();
