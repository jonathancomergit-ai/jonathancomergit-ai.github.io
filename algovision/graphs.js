/* ============================================================
   AlgoVision - Graphs

   Four lessons on one drawing. Every lesson owns a graph:
     G = { nodes: [{ id, x, y }], edges: [[from, to, weight]],
           directed, weighted }
   Nodes never move, so the picture stays put while the colours
   change. A frame is:
     { hl: {node id: cls}, eh: {edge index: cls}, badge: {id: text},
       info: html for the box under the graph, line, msg }
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

  /* ---------- graph helpers ---------- */

  function N(id, x, y) { return { id: id, x: x, y: y }; }
  function node(G, id) { return G.nodes.filter(function (n) { return n.id === id; })[0]; }
  function order(G, id) { return G.nodes.indexOf(node(G, id)); }
  function edgeAt(G, a, c) {
    for (var i = 0; i < G.edges.length; i++) {
      var e = G.edges[i];
      if ((e[0] === a && e[1] === c) || (!G.directed && e[0] === c && e[1] === a)) { return i; }
    }
    return -1;
  }
  /* neighbours, in the order the nodes are listed (so runs are repeatable) */
  function adj(G) {
    var out = {};
    G.nodes.forEach(function (n) { out[n.id] = []; });
    G.edges.forEach(function (e) {
      out[e[0]].push([e[1], e[2]]);
      if (!G.directed) { out[e[1]].push([e[0], e[2]]); }
    });
    Object.keys(out).forEach(function (k) { out[k].sort(function (p, q) { return order(G, p[0]) - order(G, q[0]); }); });
    return out;
  }
  function boxes(list, cls) {
    return list.length ? list.map(function (x, i) {
      return '<span class="av-box' + (cls ? " " + cls(x, i) : "") + '">' + esc(x) + "</span>";
    }).join("") : '<span class="r-empty">empty</span>';
  }
  function row(name, html) { return '<div class="ds-out"><span class="pf-ds-name">' + name + "</span>" + html + "</div>"; }

  /* ============================================================
     the graphs
     ============================================================ */

  var FRIENDS = ["Ana", "Ben", "Cal", "Dee", "Eli", "Fay", "Gus", "Hal"];
  var SPOTS = [[62, 54], [205, 38], [350, 58], [430, 160], [70, 176], [215, 150], [335, 250], [150, 258]];
  function people(edges) {
    return { nodes: FRIENDS.map(function (f, i) { return N(f, SPOTS[i][0], SPOTS[i][1]); }), edges: edges, directed: false, weighted: false };
  }
  function pairs(s) { return s.split(" ").filter(Boolean).map(function (p) { var q = p.split("-"); return [q[0], q[1], 1]; }); }
  var FRIEND_EDGES = "Ana-Ben Ana-Eli Ben-Cal Ben-Fay Cal-Dee Eli-Fay Eli-Hal Fay-Gus Dee-Gus";
  var PRESETS = [
    ["Friends", FRIEND_EDGES, "A small friend group. Everyone is connected, some through friends of friends."],
    ["Two groups", "Ana-Ben Ana-Eli Ben-Eli Cal-Dee Fay-Gus Gus-Hal Fay-Hal", "Three groups that don't know each other. A search from Ana can never reach Gus: the graph is " + b("not connected") + "."],
    ["Ring", "Ana-Ben Ben-Cal Cal-Dee Dee-Gus Gus-Hal Hal-Eli Eli-Ana Fay-Ben", "A loop. Without a " + b("seen") + " set, a search would go round forever."],
    ["Empty", "", "No edges. Tap two people to make them friends."]
  ];
  var social = people(pairs(FRIEND_EDGES));

  var courses = {
    directed: true, weighted: false,
    nodes: [N("Intro", 58, 70), N("Math", 58, 220), N("Web", 180, 34), N("Data", 180, 140), N("DB", 300, 76), N("Algo", 300, 210), N("AI", 418, 236), N("Capstone", 412, 120)],
    edges: [["Intro", "Web", 1], ["Intro", "Data", 1], ["Math", "Algo", 1], ["Data", "Algo", 1], ["Data", "DB", 1], ["Web", "DB", 1], ["Algo", "AI", 1], ["DB", "Capstone", 1], ["AI", "Capstone", 1]]
  };
  var CYCLE = ["Capstone", "Algo", 1];

  var roads = {
    directed: false, weighted: true,
    nodes: [N("Ash", 50, 150), N("Bay", 160, 46), N("Cove", 165, 252), N("Dale", 262, 150), N("Elm", 362, 46), N("Fern", 372, 252), N("Glen", 440, 150)],
    edges: [["Ash", "Bay", 4], ["Ash", "Cove", 2], ["Bay", "Dale", 10], ["Cove", "Dale", 3], ["Bay", "Elm", 15], ["Dale", "Elm", 4], ["Dale", "Fern", 8], ["Cove", "Fern", 12], ["Elm", "Glen", 6], ["Fern", "Glen", 3]]
  };
  var roadsStart = JSON.stringify(roads.edges);

  /* ============================================================
     recording
     ============================================================ */

  function Rec() {
    var r = { frames: [] };
    r.snap = function (line, msg, o) {
      o = o || {};
      r.frames.push({ hl: clone(o.hl || {}), eh: clone(o.eh || {}), badge: clone(o.badge || {}), info: o.info || "", line: line, msg: msg });
    };
    return r;
  }

  /* ---------- lesson 1: build ---------- */

  function adjInfo(G, pick) {
    var A = adj(G);
    var list = G.nodes.map(function (n) {
      return '<div class="gr-adj-row' + (pick === n.id ? " is-pick" : "") + '"><b>' + n.id + "</b>: " +
        (A[n.id].length ? A[n.id].map(function (p) { return p[0]; }).join(", ") : '<span class="r-empty">nobody</span>') + "</div>";
    }).join("");
    var head = "<tr><th></th>" + G.nodes.map(function (n) { return "<th>" + n.id.charAt(0) + "</th>"; }).join("") + "</tr>";
    var body = G.nodes.map(function (n) {
      return "<tr><th>" + n.id.charAt(0) + "</th>" + G.nodes.map(function (m) {
        var on = edgeAt(G, n.id, m.id) >= 0;
        return '<td class="' + (on ? "is-1" : "") + '">' + (on ? 1 : 0) + "</td>";
      }).join("") + "</tr>";
    }).join("");
    return '<div class="gr-two"><div><p class="gr-cap">Adjacency list</p><div class="gr-adj">' + list + "</div></div>" +
      '<div><p class="gr-cap">Adjacency matrix</p><table class="gr-mat">' + head + body + "</table></div></div>";
  }
  function adjCode(G) {
    var A = adj(G);
    return ["graph = {"].concat(G.nodes.map(function (n, i) {
      return '    "' + n.id + '": [' + A[n.id].map(function (p) { return '"' + p[0] + '"'; }).join(", ") + "]" + (i < G.nodes.length - 1 ? "," : "");
    })).concat(["}", "", "# Who are Ana's friends? One lookup:", 'graph["Ana"]']);
  }

  /* ---------- lesson 2: BFS / DFS ---------- */

  var BFS_CODE = ["from collections import deque", "",
    "def bfs(graph, start):",
    "    seen = {start}",
    "    queue = deque([start])",
    "    while queue:",
    "        node = queue.popleft()      # oldest first",
    "        print(node)",
    "        for friend in graph[node]:",
    "            if friend not in seen:",
    "                seen.add(friend)",
    "                queue.append(friend)"];
  var DFS_CODE = ["def dfs(graph, start):",
    "    seen = set()",
    "    stack = [start]",
    "    while stack:",
    "        node = stack.pop()          # newest first",
    "        if node in seen:",
    "            continue                # already been here",
    "        seen.add(node)",
    "        print(node)",
    "        for friend in graph[node]:",
    "            if friend not in seen:",
    "                stack.append(friend)"];

  function search(G, start, kind) {
    var A = adj(G), r = Rec(), bfs = kind === "bfs";
    var seen = {}, line = [start], visited = [], hops = {}, tree = {}, from = {};
    hops[start] = 0;
    if (bfs) { seen[start] = 1; }
    function look() {
      var o = { hl: {}, eh: clone(tree), badge: {} };
      visited.forEach(function (v) { o.hl[v] = "done"; });
      line.forEach(function (v) { if (!o.hl[v]) { o.hl[v] = "compare"; } });
      Object.keys(hops).forEach(function (v) { if (bfs) { o.badge[v] = hops[v] + (hops[v] === 1 ? " hop" : " hops"); } });
      visited.forEach(function (v, i) { if (!bfs) { o.badge[v] = "#" + (i + 1); } });
      o.info = row(bfs ? "Queue &rarr;" : "Stack &uarr;", boxes(line, function (x, i) { return (bfs ? i === 0 : i === line.length - 1) ? "is-next" : ""; })) +
        row("Visited", boxes(visited));
      return o;
    }
    var o = look(); o.hl[start] = "focus";
    r.snap(bfs ? 4 : 2, "Start at " + b(start) + ". " + (bfs ? "The " + b("queue") + " is a line: first in, first out." : "The " + b("stack") + " is a pile: the newest goes on top and comes off first."), o);
    while (line.length) {
      var cur = bfs ? line.shift() : line.pop();
      if (!bfs) {
        if (seen[cur]) {
          o = look(); o.hl[cur] = "write";
          r.snap(6, b(cur) + " came off the stack, but we've already been there. Skip.", o);
          continue;
        }
        seen[cur] = 1;
      }
      visited.push(cur);
      o = look(); o.hl[cur] = "write";
      r.snap(bfs ? 7 : 8, "Take " + b(cur) + (bfs ? " from the front of the queue" : " off the top of the stack") + ". Visit it (number " + visited.length + ").", o);
      var added = [];
      A[cur].forEach(function (p) {
        var nb = p[0];
        if (!seen[nb]) {
          if (bfs) { seen[nb] = 1; hops[nb] = hops[cur] + 1; tree[edgeAt(G, cur, nb)] = "tree"; }
          else { from[nb] = cur; }
          line.push(nb); added.push(nb);
        }
      });
      o = look(); o.hl[cur] = "write";
      A[cur].forEach(function (p) { o.eh[edgeAt(G, cur, p[0])] = added.indexOf(p[0]) >= 0 ? "hot" : (o.eh[edgeAt(G, cur, p[0])] || ""); });
      r.snap(11, added.length
        ? "Its friends not seen yet: " + b(added.join(", ")) + ". " + (bfs ? "They join the back of the queue." : "They go on the stack.")
        : "No new friends here.", o);
      if (!bfs && cur !== start) { tree[edgeAt(G, from[cur], cur)] = "tree"; }
    }
    o = look();
    var missed = G.nodes.filter(function (n) { return visited.indexOf(n.id) < 0; }).map(function (n) { return n.id; });
    r.snap(-1, (bfs ? "Done. BFS spreads out in rings: everyone 1 hop away first, then 2 hops. That's why it finds the " + b("fewest hops") + "."
                    : "Done. DFS dives down one path as far as it can, then backs up. Great for exploring everything or finding " + b("any") + " way out.") +
      (missed.length ? " Never reached: " + b(missed.join(", ")) + ". They aren't connected to " + start + "." : ""), o);
    return r.frames;
  }

  /* ---------- lesson 3: topological sort (Kahn) ---------- */

  var TOPO_CODE = ["def course_order(unlocks):",
    "    need = {c: 0 for c in unlocks}     # prereqs left",
    "    for c in unlocks:",
    "        for nxt in unlocks[c]:",
    "            need[nxt] += 1",
    "    ready = deque(c for c in need if need[c] == 0)",
    "    order = []",
    "    while ready:",
    "        c = ready.popleft()",
    "        order.append(c)               # take this course",
    "        for nxt in unlocks[c]:",
    "            need[nxt] -= 1            # one less to go",
    "            if need[nxt] == 0:",
    "                ready.append(nxt)",
    "    if len(order) < len(need):",
    "        return None                   # a loop: impossible!",
    "    return order"];

  function topo(G) {
    var A = adj(G), r = Rec(), need = {}, ready = [], done = [];
    G.nodes.forEach(function (n) { need[n.id] = 0; });
    G.edges.forEach(function (e) { need[e[1]]++; });
    function look() {
      var o = { hl: {}, eh: {}, badge: {} };
      G.nodes.forEach(function (n) {
        if (done.indexOf(n.id) >= 0) { o.hl[n.id] = "done"; o.badge[n.id] = "#" + (done.indexOf(n.id) + 1); }
        else { o.badge[n.id] = "needs " + need[n.id]; if (ready.indexOf(n.id) >= 0) { o.hl[n.id] = "compare"; } }
      });
      G.edges.forEach(function (e, i) { if (done.indexOf(e[0]) >= 0) { o.eh[i] = "dim"; } });
      o.info = row("Ready &rarr;", boxes(ready, function (x, i) { return i === 0 ? "is-next" : ""; })) + row("Order", boxes(done));
      return o;
    }
    r.snap(4, "Each course shows how many prerequisites it " + b("needs") + ": count the arrows pointing into it.", look());
    G.nodes.forEach(function (n) { if (need[n.id] === 0) { ready.push(n.id); } });
    r.snap(5, b(ready.join(" and ")) + (ready.length === 1 ? " needs" : " need") + " nothing. They're ready to take now.", look());
    while (ready.length) {
      var c = ready.shift();
      done.push(c);
      var o = look(); o.hl[c] = "write";
      r.snap(9, "Take " + b(c) + ". It's course #" + done.length + ".", o);
      var freed = [];
      A[c].forEach(function (p) {
        need[p[0]]--;
        if (need[p[0]] === 0) { ready.push(p[0]); freed.push(p[0]); }
      });
      if (A[c].length) {
        o = look(); o.hl[c] = "write";
        A[c].forEach(function (p) { o.eh[edgeAt(G, c, p[0])] = "hot"; if (!o.hl[p[0]]) { o.hl[p[0]] = "focus"; } });
        r.snap(11, b(c) + " unlocks " + b(A[c].map(function (p) { return p[0]; }).join(", ")) + ": each needs one less." +
          (freed.length ? " " + b(freed.join(", ")) + " now need" + (freed.length === 1 ? "s" : "") + " nothing, so " + (freed.length === 1 ? "it joins" : "they join") + " the ready line." : ""), o);
      }
    }
    var o2 = look();
    if (done.length < G.nodes.length) {
      var stuck = G.nodes.filter(function (n) { return done.indexOf(n.id) < 0; });
      stuck.forEach(function (n) { o2.hl[n.id] = "write"; });
      r.snap(15, "Stuck! Nothing is ready, but " + b(stuck.map(function (n) { return n.id; }).join(", ")) + " are left. They wait on each other in a " + b("loop") + ", so no order exists.", o2);
    } else {
      r.snap(16, "A valid order: " + b(done.join(" &rarr; ")) + ". Every course comes after the ones it needs. This is a " + b("topological sort") + ".", o2);
    }
    return r.frames;
  }

  /* ---------- lesson 4: Dijkstra on roads ---------- */

  var DIJ_CODE = ["import heapq", "",
    "def dijkstra(roads, start):",
    "    dist = {t: float(\"inf\") for t in roads}",
    "    dist[start] = 0",
    "    heap = [(0, start)]",
    "    while heap:",
    "        d, town = heapq.heappop(heap)   # closest unfinished",
    "        if d > dist[town]:",
    "            continue                    # old, stale entry",
    "        for nxt, km in roads[town]:",
    "            if d + km < dist[nxt]:      # a shorter way!",
    "                dist[nxt] = d + km",
    "                heapq.heappush(heap, (dist[nxt], nxt))",
    "    return dist"];

  var lastDij = null;      /* { start, dist, prev } from the last finished run */

  function dijkstra(G, start) {
    var A = adj(G), r = Rec(), dist = {}, prev = {}, fin = [], heap = [[0, start]];
    G.nodes.forEach(function (n) { dist[n.id] = Infinity; });
    dist[start] = 0;
    function look() {
      var o = { hl: {}, eh: {}, badge: {} };
      G.nodes.forEach(function (n) {
        o.badge[n.id] = dist[n.id] === Infinity ? "&infin;" : String(dist[n.id]);
        if (fin.indexOf(n.id) >= 0) { o.hl[n.id] = "done"; }
        else if (dist[n.id] < Infinity) { o.hl[n.id] = "compare"; }
      });
      Object.keys(prev).forEach(function (t) { o.eh[edgeAt(G, prev[t], t)] = "tree"; });
      var hs = heap.slice().sort(function (p, q) { return p[0] - q[0] || order(G, p[1]) - order(G, q[1]); });
      o.info = row("Heap", boxes(hs.map(function (h) { return h[0] + " " + h[1]; }), function (x, i) { return i === 0 ? "is-next" : ""; })) +
        row("Done", boxes(fin.map(function (t) { return t + " " + dist[t]; })));
      return o;
    }
    var o = look(); o.hl[start] = "focus";
    r.snap(5, "Every town starts at " + b("&infin;") + " (no route known) except " + b(start) + ", which is 0 from itself.", o);
    while (heap.length) {
      heap.sort(function (p, q) { return p[0] - q[0] || order(G, p[1]) - order(G, q[1]); });
      var top = heap.shift(), d = top[0], t = top[1];
      if (d > dist[t]) {
        o = look(); o.hl[t] = "write";
        r.snap(9, "Popped " + b(d + " " + t) + ", but we already reached " + t + " in " + dist[t] + ". That entry is stale: skip it.", o);
        continue;
      }
      fin.push(t);
      o = look(); o.hl[t] = "write";
      r.snap(7, b(t) + " is the closest unfinished town (" + d + "). No later route can beat that, so " + t + " is " + b("done") + ".", o);
      var better = [], worse = [];
      A[t].forEach(function (p) {
        var nx = p[0], km = p[1];
        if (fin.indexOf(nx) >= 0) { return; }
        if (d + km < dist[nx]) {
          better.push(nx + ": " + (dist[nx] === Infinity ? "&infin;" : dist[nx]) + " &rarr; " + (d + km));
          dist[nx] = d + km; prev[nx] = t; heap.push([d + km, nx]);
        } else { worse.push(nx + " (" + (d + km) + " isn't less than " + dist[nx] + ")"); }
      });
      if (better.length || worse.length) {
        o = look(); o.hl[t] = "write";
        A[t].forEach(function (p) { if (fin.indexOf(p[0]) < 0) { o.eh[edgeAt(G, t, p[0])] = "hot"; } });
        r.snap(better.length ? 12 : 11, "Try every road out of " + b(t) + "." + (better.length ? " Shorter: " + b(better.join(", ")) + "." : "") +
          (worse.length ? " No better: " + worse.join(", ") + "." : ""), o);
      }
    }
    o = look();
    r.snap(14, "Done: the shortest distance from " + b(start) + " to every town. The highlighted roads form the shortest-path tree. " + b("Tap a town") + " to see its route.", o);
    lastDij = { start: start, dist: clone(dist), prev: clone(prev), frame: r.frames[r.frames.length - 1] };
    return r.frames;
  }

  /* ============================================================
     lessons
     ============================================================ */

  var TABS = {
    build: {
      name: "Build a graph", topic: "graphs", G: social, big: "-",
      tip: b("Tap a person") + ", then " + b("tap another") + " to add or remove a friendship. Watch both ways of storing it update.",
      cheat: [["Adjacency list: memory", "O(V + E)"], ["List: who are X's friends?", "O(friends)"], ["Matrix: memory", "O(V&sup2;)", 1], ["Matrix: are X and Y friends?", "O(1)"]],
      ops: {}
    },
    search: {
      name: "BFS & DFS", topic: "graph-search", G: social, big: "O(V + E)",
      tip: b("Tap a person") + " to start from them. Uses the graph from " + b("Build a graph") + ", so change it there and come back.",
      cheat: [["BFS", "queue, spreads in rings"], ["DFS", "stack, dives deep"], ["Both, time", "O(V + E)"], ["Fewest hops", "BFS only"]],
      ops: { bfs: "Breadth-first (BFS)", dfs: "Depth-first (DFS)" }
    },
    topo: {
      name: "Course order (topological sort)", topic: "topo", G: courses, big: "O(V + E)",
      tip: "Arrows mean " + b("\"take this before that\"") + ". Find an order that never takes a course before its prerequisites.",
      cheat: [["Time", "O(V + E)"], ["Works on", "directed graphs"], ["A loop (cycle)?", "no order exists", 1], ["Used by", "build tools, npm, spreadsheets"]],
      ops: { topo: "Find an order", cycle: "Add a silly rule: Algo needs Capstone" }
    },
    roads: {
      name: "Shortest roads (Dijkstra)", topic: "graph-paths", G: roads, big: "O(E log V)",
      tip: "Numbers are km. " + b("Tap a road's number") + " to add traffic (+5). " + b("Tap a town") + " to start there, or after a run, to see its route.",
      cheat: [["Time (with a heap)", "O(E log V)"], ["Needs", "no negative roads"], ["Fewest roads", "is not fewest km", 1], ["Heap from", "the Heaps module"]],
      ops: { dij: "Run Dijkstra" }
    }
  };
  var START = { search: "Ana", roads: "Ash" };

  /* ============================================================
     drawing
     ============================================================ */

  var graphEl = $("#graph"), info = $("#info");
  var TAB, current = /^#(build|search|topo|roads)$/.test(location.hash) ? location.hash.slice(1) : "build";

  function draw(G, f) {
    graphEl.innerHTML = "";
    var defs = svg("defs", {}, graphEl);
    ["", "hot", "dim"].forEach(function (k) {
      var m = svg("marker", { id: "gr-ah" + k, viewBox: "0 0 8 8", refX: 7, refY: 4, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse" }, defs);
      svg("path", { d: "M0,0 L8,4 L0,8 z", "class": "gr-ah" + (k ? " is-" + k : "") }, m);
    });
    var eg = svg("g", {}, graphEl), ng = svg("g", {}, graphEl);
    /* on a phone the drawing shrinks, so draw the labels bigger */
    var k = graphEl.clientWidth && graphEl.clientWidth < 440 ? 1.3 : 1;
    graphEl.classList.toggle("is-big", k > 1);
    function w(n) { return (18 + 8.6 * n.id.length) * k; }
    G.edges.forEach(function (e, i) {
      var a = node(G, e[0]), c = node(G, e[1]), cls = f.eh[i] || "";
      var x1 = a.x, y1 = a.y, x2 = c.x, y2 = c.y;
      if (G.directed) {
        var dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy), ux = dx / len, uy = dy / len;
        var s = Math.min((w(c) / 2 + 3) / Math.max(Math.abs(ux), 1e-6), (15 * k + 3) / Math.max(Math.abs(uy), 1e-6));
        x2 = c.x - ux * s; y2 = c.y - uy * s;
      }
      svg("line", { x1: x1, y1: y1, x2: x2, y2: y2, "class": "gr-edge" + (cls ? " is-" + cls : ""),
        "marker-end": G.directed ? "url(#gr-ah" + (cls === "hot" ? "hot" : cls === "dim" ? "dim" : "") + ")" : "" }, eg);
      if (G.weighted) {
        var mx = (a.x + c.x) / 2, my = (a.y + c.y) / 2;
        var wg = svg("g", { "class": "gr-w" + (cls ? " is-" + cls : ""), transform: "translate(" + mx + "," + my + ")", "data-e": i }, eg);
        svg("rect", { x: -13 * k, y: -10 * k, width: 26 * k, height: 20 * k, rx: 6 }, wg);
        svg("text", { y: 4.5 * k, "text-anchor": "middle" }, wg, e[2]);
      }
    });
    G.nodes.forEach(function (n) {
      var g = svg("g", { "class": "gr-node" + (f.hl[n.id] ? " is-" + f.hl[n.id] : ""), transform: "translate(" + n.x + "," + n.y + ")", "data-n": n.id }, ng);
      svg("rect", { x: -w(n) / 2, y: -15 * k, width: w(n), height: 30 * k, rx: 15 * k }, g);
      svg("text", { y: 5 * k, "text-anchor": "middle" }, g, n.id);
      if (f.badge[n.id] != null) {
        var t = svg("text", { y: -21 * k - 1, "text-anchor": "middle", "class": "gr-badge" }, g);
        t.innerHTML = f.badge[n.id];
      }
    });
    $("#s-nodes").textContent = G.nodes.length;
    $("#s-edges").textContent = G.edges.length;
  }

  var say = $("#say");
  var code = AV.Code($("#code"), [], $("#now"));
  var learnBtn = AV.learn($("#learn"), "graphs");

  function render(f) {
    draw(TAB.G, f);
    info.innerHTML = f.info;
    code.mark(f.line);
    say.innerHTML = f.msg;
  }
  var player = AV.Player($("#controls"), render, {
    keys: true, speed: 1,
    steady: [{ el: say, html: function (f) { return f.msg; } }, { el: info, html: function (f) { return f.info; } }]
  });

  function one(msg, o) {
    var r = Rec();
    r.snap(-1, msg, o);
    player.load(r.frames);
  }

  /* the resting picture for each lesson */
  var pick = null;
  function rest(msg) {
    var G = TAB.G, o = { hl: {}, badge: {} };
    if (current === "build") {
      if (pick) { o.hl[pick] = "focus"; }
      o.info = adjInfo(G, pick);
      code.load(adjCode(G));
    } else if (current === "search") {
      o.hl[START.search] = "focus"; o.badge[START.search] = "start";
      o.info = row("Queue / stack", boxes([])) + row("Visited", boxes([]));
    } else if (current === "topo") {
      var need = {};
      G.nodes.forEach(function (n) { need[n.id] = 0; });
      G.edges.forEach(function (e) { need[e[1]]++; });
      G.nodes.forEach(function (n) { o.badge[n.id] = "needs " + need[n.id]; });
      o.info = row("Ready &rarr;", boxes([])) + row("Order", boxes([]));
    } else {
      o.hl[START.roads] = "focus"; o.badge[START.roads] = "start";
      o.info = row("Heap", boxes([])) + row("Done", boxes([]));
    }
    one(msg, o);
  }

  function run(key) {
    document.querySelectorAll("[data-op]").forEach(function (x) {
      x.setAttribute("aria-pressed", x.getAttribute("data-op") === key ? "true" : "false");
    });
    var frames;
    if (key === "bfs" || key === "dfs") { code.load(key === "bfs" ? BFS_CODE : DFS_CODE); frames = search(social, START.search, key); }
    else if (key === "topo") { code.load(TOPO_CODE); frames = topo(courses); }
    else if (key === "cycle") {
      var at = edgeAt(courses, CYCLE[0], CYCLE[1]);
      if (at >= 0) { courses.edges.splice(at, 1); } else { courses.edges.push(CYCLE.slice()); }
      opButtons();
      rest(at >= 0 ? "Silly rule removed. Back to a graph with no loops (a " + b("DAG") + ": directed acyclic graph)." :
        "Now " + b("Algo") + " needs " + b("Capstone") + ", which needs AI, which needs Algo. A loop! Press " + b("Find an order") + " and see what happens.");
      return;
    }
    else { code.load(DIJ_CODE); frames = dijkstra(roads, START.roads); }
    player.load(frames);
    if (!AV.calm) { player.play(); }
    if (window.innerWidth < 900) {
      $("#stage").closest(".av-panel").scrollIntoView({ behavior: AV.calm ? "auto" : "smooth", block: "start" });
    }
  }

  function opButtons() {
    var ops = $("#ops");
    ops.innerHTML = "";
    Object.keys(TAB.ops).forEach(function (k) {
      var label = TAB.ops[k];
      if (k === "cycle" && edgeAt(courses, CYCLE[0], CYCLE[1]) >= 0) { label = "Remove the silly rule"; }
      var btn = AV.el("button", "av-op", "<span>" + label + '</span><span class="av-badge is-on">' + (k === "cycle" ? "edit" : TAB.big) + "</span>");
      btn.type = "button";
      btn.setAttribute("data-op", k);
      btn.setAttribute("aria-pressed", "false");
      btn.addEventListener("click", function () { run(k); });
      ops.appendChild(btn);
    });
    ops.hidden = !Object.keys(TAB.ops).length;
  }

  function show(key) {
    current = key;
    TAB = TABS[key];
    pick = null;
    $("#tab-name").textContent = TAB.name;
    $("#stage").className = "av-stage gr-stage is-" + key;
    $("#tip").innerHTML = TAB.tip;
    $("#op-badge").textContent = TAB.big;
    $("#code-title").textContent = key === "build" ? "The same graph in Python" : "The code (Python)";
    $("#cheat").innerHTML = TAB.cheat.map(function (c) {
      return "<tr><td style='font-family:var(--font-body)'>" + c[0] + "</td><td class='" + (c[2] ? "bad" : "good") + "'>" + c[1] + "</td></tr>";
    }).join("");
    learnBtn.topic(TAB.topic);
    opButtons();
    var pre = $("#presets");
    pre.innerHTML = "";
    if (key === "build") {
      PRESETS.forEach(function (p) {
        var btn = AV.el("button", "av-pill is-small", p[0]);
        btn.type = "button";
        btn.addEventListener("click", function () { social.edges = pairs(p[1]); pick = null; rest(p[2]); });
        pre.appendChild(btn);
      });
    }
    if (key === "roads") {
      var rb = AV.el("button", "av-pill is-small", "Clear the traffic");
      rb.type = "button";
      rb.addEventListener("click", function () { roads.edges = JSON.parse(roadsStart); lastDij = null; rest("Roads back to normal."); });
      pre.appendChild(rb);
    }
    pre.hidden = !pre.children.length;
    if (key === "search") { code.load(BFS_CODE); }
    if (key === "topo") { code.load(TOPO_CODE); }
    if (key === "roads") { code.load(DIJ_CODE); }
    rest({
      build: "A graph is just " + b("nodes") + " (people) and " + b("edges") + " (friendships). The computer stores it as one of the two tables below.",
      search: "Two ways to visit everyone, starting from " + b(START.search) + ". The only difference: a queue or a stack.",
      topo: "Eight courses. An arrow from A to B means " + b("take A first") + ". Which order works?",
      roads: "Seven towns and the roads between them. What's the shortest drive from " + b(START.roads) + " to everywhere?"
    }[key]);
  }

  /* ---------- taps on the drawing ---------- */

  graphEl.addEventListener("click", function (e) {
    if (player.playing()) { return; }
    var t = e.target.closest ? e.target : null;
    var wEl = t && t.closest(".gr-w"), nEl = t && t.closest(".gr-node");
    if (current === "roads" && wEl) {
      var ei = +wEl.getAttribute("data-e"), ed = roads.edges[ei];
      ed[2] = ed[2] + 5 > 20 ? 1 : ed[2] + 5;
      lastDij = null;
      rest("The road " + b(ed[0] + " &ndash; " + ed[1]) + " is now " + b(ed[2] + " km") + ". Run Dijkstra again: does the best route change?");
      return;
    }
    if (!nEl) { return; }
    var id = nEl.getAttribute("data-n");
    if (current === "build") {
      if (!pick) { pick = id; rest("Picked " + b(id) + ". Now tap someone to link them (or tap " + id + " again to cancel)."); return; }
      if (pick === id) { pick = null; rest("Cancelled."); return; }
      var at = edgeAt(social, pick, id), was = pick;
      if (at >= 0) { social.edges.splice(at, 1); } else { social.edges.push([pick, id, 1]); }
      pick = null;
      rest(at >= 0 ? b(was) + " and " + b(id) + " are no longer friends. One edge gone: the list loses two entries, the matrix two 1s."
        : b(was) + " and " + b(id) + " are friends now. In the list each gets the other added; in the matrix two cells turn to 1 (it's symmetric).");
    } else if (current === "search") {
      START.search = id;
      rest("Start from " + b(id) + ". Now pick BFS or DFS.");
    } else if (current === "roads") {
      if (lastDij && lastDij.start === START.roads && id !== START.roads && lastDij.dist[id] < Infinity) {
        var path = [id], o = clone(lastDij.frame);
        while (lastDij.prev[path[0]]) { path.unshift(lastDij.prev[path[0]]); }
        o.eh = {};
        for (var k = 1; k < path.length; k++) { o.eh[edgeAt(roads, path[k - 1], path[k])] = "path"; }
        path.forEach(function (p) { o.hl[p] = "focus"; });
        var r = Rec();
        r.snap(-1, "Shortest route to " + b(id) + ": " + b(path.join(" &rarr; ")) + " = " + b(lastDij.dist[id] + " km") + ". " +
          (path.length > 2 ? "Fewer roads isn't always shorter!" : ""), o);
        player.load(r.frames);
        return;
      }
      START.roads = id;
      lastDij = null;
      rest("Start from " + b(id) + ". Press " + b("Run Dijkstra") + ".");
    }
  });

  document.querySelectorAll("#tabs [data-pick]").forEach(function (p) {
    p.setAttribute("aria-pressed", p.getAttribute("data-pick") === current ? "true" : "false");
  });
  AV.pills($("#tabs"), function (k) {
    try { history.replaceState(null, "", "#" + k); } catch (e) { /* file:// */ }
    show(k);
  });
  show(current);

  AV.quiz($("#quiz"), [
    {
      q: "You want the fewest handshakes between you and a celebrity. BFS or DFS?",
      opts: ["DFS: it goes deep fast", "BFS: it checks everyone 1 away, then 2 away, so the first time it finds them is the fewest hops", "Either always works", "Neither"], a: 1,
      why: "BFS spreads out in rings, so it reaches every person by the shortest number of hops. DFS might find them down a long winding path first."
    },
    {
      q: "The only difference between the BFS and DFS code here is...",
      opts: ["The seen set", "A queue (take the oldest) vs a stack (take the newest)", "Recursion", "BFS needs weights"], a: 1,
      why: "Swap popleft() for pop() and BFS becomes DFS. The data structure decides the order."
    },
    {
      q: "Your course plan says A needs B, B needs C, and C needs A. A topological sort will...",
      opts: ["Pick A first", "Find no order, because the three wait on each other in a loop", "Take them all at once", "Loop forever"], a: 1,
      why: "Nobody in a loop ever reaches \"needs 0\", so they never become ready. Kahn's algorithm notices it finished with courses left over."
    },
    {
      q: "1,000 users, and each has about 10 friends. Adjacency list or matrix?",
      opts: ["Matrix: 1,000,000 cells, almost all 0", "List: about 10,000 entries, only the real friendships", "They use the same memory", "Neither can store it"], a: 1,
      why: "A matrix stores every possible pair (V&sup2;). Real networks are sparse, so lists (V + E) save a huge amount of memory."
    }
  ], $("#quiz-score"));
})();
