/* ============================================================
   AlgoVision - Pathfinding

   A grid you can draw on, and four ways to get from S to G.
   As everywhere else: the search runs once for real and saves a
   frame each time it takes a cell off its to-do list. A frame is
   one byte per cell (what that cell is doing) plus the sentence,
   the code line and a peek at the queue / stack / priority queue.

   Cell numbering: id = row * COLS + col.
   ============================================================ */

(function () {
  "use strict";

  var $ = function (s) { return document.querySelector(s); };
  function b(v) { return "<b>" + v + "</b>"; }

  var COLS = 19, ROWS = 13, N = COLS * ROWS;
  var MUD_COST = 5;

  /* what a cell is doing in a frame */
  var NONE = 0, FRONTIER = 1, VISITED = 2, CURRENT = 3, PATH = 4;
  var SHOW = ["", "is-frontier", "is-visited", "is-current", "is-path"];

  /* the map: 0 open, 1 wall, 2 mud */
  var OPEN = 0, WALL = 1, MUD = 2;
  var map = new Uint8Array(N);
  var start = id(6, 2), goal = id(6, 16);

  function id(r, c) { return r * COLS + c; }
  function rc(i) { return [Math.floor(i / COLS), i % COLS]; }
  function name(i) { var p = rc(i); return "(" + p[0] + "," + p[1] + ")"; }
  function cost(i) { return map[i] === MUD ? MUD_COST : 1; }
  function dist(a, z) { var p = rc(a), q = rc(z); return Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]); }

  /* up, right, down, left - the order every search tries them in */
  function neighbours(i) {
    var p = rc(i), out = [];
    [[-1, 0], [0, 1], [1, 0], [0, -1]].forEach(function (d) {
      var r = p[0] + d[0], c = p[1] + d[1];
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS && map[id(r, c)] !== WALL) { out.push(id(r, c)); }
    });
    return out;
  }

  /* ---------- recording ---------- */

  function Rec() {
    var r = { s: new Uint8Array(N), frames: [], visited: 0 };
    r.snap = function (line, msg, ds, extra) {
      var f = { s: r.s.slice(), line: line, msg: msg, ds: ds || "", visited: r.visited,
                frontier: 0, pathLen: null, pathCost: null };
      for (var i = 0; i < N; i++) { if (r.s[i] === FRONTIER) { f.frontier++; } }
      if (extra) { for (var k in extra) { f[k] = extra[k]; } }
      r.frames.push(f);
    };
    /* Walk came_from back from the goal, then light the path up
       a few cells per frame so you can see it being traced. */
    r.path = function (from, line) {
      var p = [], at = goal;
      while (at != null) { p.push(at); at = from[at]; }
      p.reverse();
      var total = 0;
      p.forEach(function (c, k) { if (k) { total += cost(c); } });
      var chunk = Math.max(1, Math.ceil(p.length / 8));
      for (var k = 0; k < p.length; k += chunk) {
        for (var j = k; j < Math.min(p.length, k + chunk); j++) { r.s[p[j]] = PATH; }
        r.snap(line, "Found the goal! Follow the " + b("came_from") + " arrows backwards from G to S to get the path.",
          r.lastDs, { pathLen: p.length - 1, pathCost: total });
      }
      r.snap(-1, "Path found: " + b((p.length - 1) + " steps") + ", total cost " + b(total) +
        " (mud costs " + MUD_COST + "). Searched " + b(r.visited + " cells") + " to find it.", "",
        { pathLen: p.length - 1, pathCost: total });
      return { len: p.length - 1, cost: total, rec: r };
    };
    r.fail = function () {
      r.snap(-1, b("No path.") + " Every reachable cell was checked and G wasn't one of them. Knock a hole in a wall!", "");
      return { len: null, cost: null, rec: r };
    };
    return r;
  }

  /* the data-structure peek: first few items as boxes */
  function peek(items, label, fmt) {
    var shown = items.slice(0, 7).map(function (x, k) {
      return '<span class="av-box' + (k === 0 ? " is-next" : "") + '">' + fmt(x) + "</span>";
    }).join("");
    return '<span class="pf-ds-name">' + label + "</span>" + (items.length ? shown : '<span class="r-empty">empty</span>') +
      (items.length > 7 ? '<span class="pf-more">+' + (items.length - 7) + " more</span>" : "");
  }

  /* ---------- the four searches ---------- */

  function bfs() {
    var r = Rec(), queue = [start], from = {}; from[start] = null;
    r.s[start] = FRONTIER;
    function ds() { return (r.lastDs = peek(queue, "Queue (front first)", name)); }
    r.snap(1, "BFS keeps a " + b("queue") + ": first in, first out. It explores in rings, nearest cells first.", ds());
    while (queue.length) {
      var cur = queue.shift();
      r.s[cur] = CURRENT; r.visited++;
      r.snap(4, "Take the " + b("oldest") + " cell from the front of the queue: " + b(name(cur)) + ".", ds());
      if (cur === goal) { return r.path(from, 6); }
      var added = 0;
      neighbours(cur).forEach(function (n) {
        if (!(n in from)) { from[n] = cur; queue.push(n); r.s[n] = FRONTIER; added++; }
      });
      r.s[cur] = VISITED;
      r.snap(10, added ? "Add its " + added + " new neighbour" + (added > 1 ? "s" : "") + " to the " + b("back") + " of the queue."
                       : "No new neighbours here.", ds());
    }
    return r.fail();
  }

  function dfs() {
    var r = Rec(), stack = [[start, null]], from = {};
    r.s[start] = FRONTIER;
    function ds() { return (r.lastDs = peek(stack.slice().reverse(), "Stack (top first)", function (x) { return name(x[0]); })); }
    r.snap(1, "DFS keeps a " + b("stack") + ": last in, first out. It charges down one direction until it hits a dead end.", ds());
    while (stack.length) {
      var top = stack.pop(), cur = top[0];
      if (cur in from) { continue; }
      from[cur] = top[1];
      r.s[cur] = CURRENT; r.visited++;
      r.snap(4, "Pop the " + b("newest") + " cell off the top of the stack: " + b(name(cur)) + ".", ds());
      if (cur === goal) { return r.path(from, 8); }
      /* pushed in reverse so "up" ends up on top and is tried first */
      var ns = neighbours(cur).filter(function (n) { return !(n in from); });
      ns.reverse().forEach(function (n) { stack.push([n, cur]); r.s[n] = FRONTIER; });
      r.s[cur] = VISITED;
      r.snap(10, ns.length ? "Push its " + ns.length + " unvisited neighbour" + (ns.length > 1 ? "s" : "") + " on top. The next one tried is the last one pushed."
                           : "Dead end. Back up to whatever is on top of the stack.", ds());
    }
    return r.fail();
  }

  /* Dijkstra and A* share everything except the priority. */
  function best(useGuess) {
    var r = Rec(), from = {}, g = {}, pq = [];
    from[start] = null; g[start] = 0;
    function pri(i) { return g[i] + (useGuess ? dist(i, goal) : 0); }
    function push(i) { pq.push({ i: i, p: pri(i), h: dist(i, goal) }); }
    function popMin() {
      var k = 0;
      for (var j = 1; j < pq.length; j++) {
        if (pq[j].p < pq[k].p || (pq[j].p === pq[k].p && pq[j].h < pq[k].h)) { k = j; }
      }
      return pq.splice(k, 1)[0];
    }
    function ds() {
      var sorted = pq.slice().sort(function (a, z) { return a.p - z.p || a.h - z.h; });
      return (r.lastDs = peek(sorted, "Priority queue (cheapest first)", function (x) {
        return name(x.i) + " " + (useGuess ? "f" : "d") + "=" + x.p;
      }));
    }
    push(start);
    r.s[start] = FRONTIER;
    var done = {};
    r.snap(1, useGuess
      ? "A* is Dijkstra plus a " + b("guess") + ": it ranks cells by cost so far + straight-line distance to G (ignoring walls). So it leans towards the goal."
      : "Dijkstra keeps a " + b("priority queue") + " ranked by total cost so far. It always expands the " + b("cheapest") + " cell next, so it handles mud properly.", ds());
    while (pq.length) {
      var item = popMin(), cur = item.i;
      if (done[cur]) { continue; }
      done[cur] = true;
      r.s[cur] = CURRENT; r.visited++;
      r.snap(4, "Take the cheapest cell: " + b(name(cur)) + (useGuess
        ? " with cost " + g[cur] + " + guess " + dist(cur, goal) + " = " + b(item.p) + "."
        : " with cost so far " + b(g[cur]) + "."), ds());
      if (cur === goal) { return r.path(from, 6); }
      var better = 0;
      neighbours(cur).forEach(function (n) {
        var ng = g[cur] + cost(n);
        if (!done[n] && (g[n] == null || ng < g[n])) {
          g[n] = ng; from[n] = cur; push(n); r.s[n] = FRONTIER; better++;
        }
      });
      r.s[cur] = VISITED;
      r.snap(11, better ? "Found a cheaper route to " + better + " neighbour" + (better > 1 ? "s" : "") + ". Add them to the priority queue."
                        : "No cheaper routes from here.", ds());
    }
    return r.fail();
  }

  var ALGOS = {
    bfs: {
      name: "Breadth-first search", run: bfs, topic: "bfs", ds: "Queue", weights: false,
      how: [
        "Uses a <b>queue</b>: cells are explored in the order they were found.",
        "Spreads out in rings, so the first time it reaches G is by the <b>fewest steps</b>.",
        "Ignores mud. Fewest steps isn't always cheapest.",
        "Time: O(V + E), every cell and edge at most once."
      ],
      code: [
        "def bfs(start, goal):",
        "    queue = deque([start])",
        "    came_from = {start: None}",
        "    while queue:",
        "        cur = queue.popleft()  # oldest first",
        "        if cur == goal:",
        "            return path(came_from, goal)",
        "        for nxt in neighbours(cur):",
        "            if nxt not in came_from:",
        "                came_from[nxt] = cur",
        "                queue.append(nxt)"
      ]
    },
    dfs: {
      name: "Depth-first search", run: dfs, topic: "dfs", ds: "Stack", weights: false,
      how: [
        "Uses a <b>stack</b>: always continues from the newest cell.",
        "Dives deep down one route, backing up only at dead ends.",
        "Finds <b>a</b> path, often a long, wiggly one. Not the shortest.",
        "Great for mazes and \"is there any way through?\""
      ],
      code: [
        "def dfs(start, goal):",
        "    stack = [(start, None)]",
        "    came_from = {}",
        "    while stack:",
        "        cur, prev = stack.pop()  # newest first",
        "        if cur in came_from: continue",
        "        came_from[cur] = prev",
        "        if cur == goal:",
        "            return path(came_from, goal)",
        "        for nxt in neighbours(cur):",
        "            stack.append((nxt, cur))"
      ]
    },
    dijkstra: {
      name: "Dijkstra", run: function () { return best(false); }, topic: "dijkstra", ds: "Priority queue", weights: true,
      how: [
        "Uses a <b>priority queue</b> ordered by cost so far.",
        "Always expands the cheapest cell, so the path it finds is the <b>cheapest</b>.",
        "Understands mud: walks around it if that's cheaper.",
        "Spreads in all directions. It has no idea where G is."
      ],
      code: [
        "def dijkstra(start, goal):",
        "    pq = [(0, start)]  # (cost so far, cell)",
        "    cost = {start: 0}",
        "    while pq:",
        "        c, cur = heappop(pq)  # cheapest first",
        "        if cur == goal:",
        "            return path(came_from, goal)",
        "        for nxt in neighbours(cur):",
        "            new = c + weight(nxt)  # mud costs 5",
        "            if new < cost.get(nxt, inf):",
        "                cost[nxt] = new; came_from[nxt] = cur",
        "                heappush(pq, (new, nxt))"
      ]
    },
    astar: {
      name: "A*", run: function () { return best(true); }, topic: "astar", ds: "Priority queue", weights: true,
      how: [
        "Dijkstra plus a <b>guess</b> (heuristic): distance to G as the crow flies.",
        "Ranks cells by <b>cost so far + guess</b>, so it heads towards G.",
        "Still finds the cheapest path, while checking far fewer cells.",
        "What games use to move characters around maps."
      ],
      code: [
        "def a_star(start, goal):",
        "    pq = [(h(start), start)]",
        "    cost = {start: 0}",
        "    while pq:",
        "        _, cur = heappop(pq)  # lowest cost + guess",
        "        if cur == goal:",
        "            return path(came_from, goal)",
        "        for nxt in neighbours(cur):",
        "            new = cost[cur] + weight(nxt)",
        "            if new < cost.get(nxt, inf):",
        "                cost[nxt] = new; came_from[nxt] = cur",
        "                heappush(pq, (new + h(nxt), nxt))",
        "# h(cell) = steps to goal if there were no walls"
      ]
    }
  };

  /* ---------- maps ---------- */

  function blank() { map.fill(OPEN); }

  /* Built to teach: the fewest-steps route goes straight through the
     mud, the cheapest goes around it. BFS and Dijkstra disagree. */
  function starter() {
    blank();
    start = id(6, 2); goal = id(6, 16);
    for (var r = 0; r < ROWS; r++) { if (r !== 6) { map[id(r, 8)] = WALL; } }
    for (var r2 = 4; r2 <= 8; r2++) { map[id(r2, 12)] = map[id(r2, 13)] = MUD; }
    for (var c = 11; c <= 14; c++) { map[id(10, c)] = WALL; map[id(2, c)] = WALL; }
  }

  function scatter() {
    blank();
    for (var i = 0; i < N; i++) {
      var x = Math.random();
      map[i] = x < 0.24 ? WALL : x < 0.34 ? MUD : OPEN;
    }
    map[start] = map[goal] = OPEN;
  }

  /* Recursive backtracker: carve passages between odd cells. */
  function maze() {
    map.fill(WALL);
    var stack = [[1, 1]], seen = {};
    seen[id(1, 1)] = 1; map[id(1, 1)] = OPEN;
    while (stack.length) {
      var t = stack[stack.length - 1], opts = [];
      [[-2, 0], [0, 2], [2, 0], [0, -2]].forEach(function (d) {
        var r = t[0] + d[0], c = t[1] + d[1];
        if (r > 0 && r < ROWS - 1 && c > 0 && c < COLS - 1 && !seen[id(r, c)]) { opts.push([r, c, d]); }
      });
      if (!opts.length) { stack.pop(); continue; }
      var o = opts[Math.floor(Math.random() * opts.length)];
      map[id(t[0] + o[2][0] / 2, t[1] + o[2][1] / 2)] = OPEN;
      map[id(o[0], o[1])] = OPEN;
      seen[id(o[0], o[1])] = 1;
      stack.push([o[0], o[1]]);
    }
    /* a few extra gaps so there's more than one route */
    for (var k = 0; k < 14; k++) {
      var rr = 1 + Math.floor(Math.random() * (ROWS - 2)), cc = 1 + Math.floor(Math.random() * (COLS - 2));
      if ((rr + cc) % 2 === 1) { map[id(rr, cc)] = OPEN; }
    }
    start = id(1, 1); goal = id(ROWS - 2, COLS - 2);
  }

  /* ---------- the grid ---------- */

  var gridEl = $("#grid"), cells = [], shown = new Uint8Array(N);
  for (var i = 0; i < N; i++) {
    var c = AV.el("div", "pf-cell");
    c.setAttribute("data-i", i);
    gridEl.appendChild(c);
    cells.push(c);
  }
  gridEl.style.gridTemplateColumns = "repeat(" + COLS + ", 1fr)";

  /* Draws walls, mud, S and G, and wipes any search colours. */
  function paintMap() {
    for (var i = 0; i < N; i++) {
      if (SHOW[shown[i]]) { cells[i].classList.remove(SHOW[shown[i]]); }
      cells[i].classList.toggle("is-wall", map[i] === WALL);
      cells[i].classList.toggle("is-mud", map[i] === MUD);
      cells[i].classList.toggle("is-start", i === start);
      cells[i].classList.toggle("is-goal", i === goal);
      cells[i].textContent = i === start ? "S" : i === goal ? "G" : "";
    }
    shown.fill(NONE);
  }

  function drawFrame(s) {
    for (var i = 0; i < N; i++) {
      if (shown[i] === s[i]) { continue; }
      if (SHOW[shown[i]]) { cells[i].classList.remove(SHOW[shown[i]]); }
      if (SHOW[s[i]]) { cells[i].classList.add(SHOW[s[i]]); }
      shown[i] = s[i];
    }
  }

  /* ---------- drawing on the grid ---------- */

  var tool = "wall", painting = false, paintTo = null, dragging = null;

  AV.pills($("#tools"), function (k) { tool = k; });

  function cellAt(ev) {
    var el = document.elementFromPoint(ev.clientX, ev.clientY);
    var i = el && el.getAttribute && el.getAttribute("data-i");
    return i == null ? null : +i;
  }

  function apply(i) {
    if (i == null) { return; }
    if (dragging) {
      if (map[i] === WALL || i === start || i === goal) { return; }
      if (dragging === "start") { start = i; } else { goal = i; }
    } else {
      if (i === start || i === goal) { return; }
      if (map[i] === paintTo) { return; }
      map[i] = paintTo;
    }
    paintMap();
  }

  gridEl.addEventListener("pointerdown", function (ev) {
    var i = cellAt(ev);
    if (i == null) { return; }
    ev.preventDefault();
    player.pause();
    painting = true;
    gridEl.setPointerCapture && gridEl.setPointerCapture(ev.pointerId);
    if (i === start || i === goal || tool === "start" || tool === "goal") {
      dragging = i === start ? "start" : i === goal ? "goal" : tool;
      apply(i);
      return;
    }
    var want = tool === "wall" ? WALL : tool === "mud" ? MUD : OPEN;
    paintTo = map[i] === want ? OPEN : want;   /* tap a wall with the wall tool to remove it */
    apply(i);
  });
  gridEl.addEventListener("pointermove", function (ev) { if (painting) { apply(cellAt(ev)); } });
  function stop() {
    if (!painting) { return; }
    painting = false; dragging = null;
    rebuild();
  }
  gridEl.addEventListener("pointerup", stop);
  gridEl.addEventListener("pointercancel", stop);

  /* ---------- page wiring ---------- */

  var say = $("#say"), dsEl = $("#ds");
  var sVisited = $("#s-visited"), sFront = $("#s-front"), sPath = $("#s-path");
  var code = AV.Code($("#code"), [], $("#now"));
  var current = /^#(bfs|dfs|dijkstra|astar)$/.test(location.hash) ? location.hash.slice(1) : "bfs";
  var learnBtn = AV.learn($("#learn"), ALGOS[current].topic);

  function render(f) {
    drawFrame(f.s);
    code.mark(f.line);
    say.innerHTML = f.msg;
    dsEl.innerHTML = f.ds || '<span class="pf-ds-name">' + ALGOS[current].ds + '</span><span class="r-empty">not in use</span>';
    sVisited.textContent = f.visited;
    sFront.textContent = f.frontier;
    sPath.textContent = f.pathLen == null ? "-" : f.pathLen + " (cost " + f.pathCost + ")";
  }

  var player = AV.Player($("#controls"), render, {
    keys: true, speed: 3,
    steady: [
      { el: say, html: function (f) { return f.msg; } },
      { el: dsEl, html: function (f) { return f.ds; } }
    ]
  });

  function rebuild() {
    var A = ALGOS[current];
    code.load(A.code);
    $("#algo-name").textContent = A.name;
    $("#how").innerHTML = A.how.map(function (h) { return "<li>" + h + "</li>"; }).join("");
    learnBtn.topic(A.topic);
    paintMap();
    player.load(A.run().rec.frames);
    compare();
  }

  document.querySelectorAll("#algos [data-pick]").forEach(function (p) {
    p.setAttribute("aria-pressed", p.getAttribute("data-pick") === current ? "true" : "false");
  });
  AV.pills($("#algos"), function (k) {
    current = k;
    try { history.replaceState(null, "", "#" + k); } catch (e) { /* file:// */ }
    rebuild();
  });

  $("#map-starter").addEventListener("click", function () { starter(); rebuild(); });
  $("#map-random").addEventListener("click", function () { scatter(); rebuild(); });
  $("#map-maze").addEventListener("click", function () { maze(); rebuild(); });
  $("#map-clear").addEventListener("click", function () { blank(); rebuild(); });

  /* ---------- all four on the current map ---------- */

  function compare() {
    var rows = [], cheapest = null;
    ["bfs", "dfs", "dijkstra", "astar"].forEach(function (k) {
      var res = ALGOS[k].run();
      rows.push({ k: k, res: res, visited: res.rec.visited });
      if (res.cost != null && (cheapest == null || res.cost < cheapest)) { cheapest = res.cost; }
    });
    $("#compare").innerHTML = rows.map(function (row) {
      var r = row.res;
      return "<tr><td>" + ALGOS[row.k].name + "</td><td>" + row.visited + "</td><td>" +
        (r.len == null ? "-" : r.len) + "</td><td>" + (r.cost == null ? "-" : r.cost) + "</td><td class='" +
        (r.cost == null ? "" : r.cost === cheapest ? "good" : "bad") + "'>" +
        (r.cost == null ? "no path" : r.cost === cheapest ? "&#10003; cheapest" : "&#10007; +" + (r.cost - cheapest)) + "</td></tr>";
    }).join("");
  }

  starter();
  rebuild();

  AV.quiz($("#quiz"), [
    {
      q: "BFS and DFS differ in just one thing. What is it?",
      opts: ["BFS uses a queue, DFS uses a stack", "DFS can't handle walls", "BFS is recursive", "DFS checks diagonals"], a: 0,
      why: "Same loop, same neighbours. Taking the <b>oldest</b> cell (queue) spreads out in rings; taking the <b>newest</b> (stack) dives down one route."
    },
    {
      q: "There's mud on the map. Which search is guaranteed to find the cheapest path?",
      opts: ["BFS", "DFS", "Dijkstra", "All of them"], a: 2,
      why: "BFS only counts steps, so it'll happily wade through mud. Dijkstra (and A*) rank cells by total cost, so they find the cheapest. Check the comparison table."
    },
    {
      q: "Why does A* usually check fewer cells than Dijkstra?",
      opts: ["It skips walls", "It adds a guess of the distance left, so it prefers cells closer to G", "It searches backwards", "It's random"], a: 1,
      why: "Dijkstra spreads evenly in every direction. A* adds the straight-line distance to G, which pulls it towards the goal. Same answer, less searching."
    },
    {
      q: "On a map with no mud, BFS and Dijkstra find paths that are...",
      opts: ["Different lengths", "The same length", "Both random", "Always diagonal"], a: 1,
      why: "When every step costs 1, cheapest = fewest steps, so BFS's ring-by-ring search finds an optimal path too (and it's simpler). Press <b>Clear</b> and compare."
    }
  ], $("#quiz-score"));
})();
