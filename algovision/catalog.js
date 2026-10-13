/* ============================================================
   AlgoVision - the catalog

   Every subject and every module, in one list. The home page and
   the three subject pages are drawn from this, so:

     ADD A MODULE:   add one entry to MODULES (status "live", or
                     "soon" for a coming-soon card). Its topics must
                     also be in TOPICS at the top of av.js.
     ADD A SUBJECT:  add one entry to SUBJECTS and make its page by
                     copying algorithms.html.

   Order in the list = order on the page.
   ============================================================ */

var AVCatalog = (function () {
  "use strict";

  var SUBJECTS = [
    {
      id: "algorithms", name: "Algorithms", page: "algorithms.html", icon: "&#9881;", glow: "rgba(255,45,120,.28)", tone: "hot",
      blurb: "Step-by-step recipes for solving problems fast. Sorting, searching, recursion, and how to tell fast code from slow."
    },
    {
      id: "data", name: "Data Structures", page: "data.html", icon: "[ ]", glow: "rgba(53,214,245,.28)", tone: "cyan",
      blurb: "Ways to store things so the right operations are quick. Arrays, stacks, queues, linked lists, hash maps and trees."
    },
    {
      id: "concepts", name: "Programming Concepts", page: "concepts.html", icon: "{ }", glow: "rgba(255,201,60,.26)", tone: "amber",
      blurb: "The ideas behind how real code is organised and how it actually runs: objects, references, scope and more."
    }
  ];

  var MODULES = [
    /* ---------- Algorithms ---------- */
    { subject: "algorithms", status: "live", page: "big-o.html", title: "Big O", art: "O(n)", glow: "rgba(255,201,60,.24)",
      blurb: "Race the six growth curves, see how long each would really take, and learn to spot them in code.",
      topics: ["big-o"] },
    { subject: "algorithms", status: "live", page: "sorting.html", title: "Sorting", art: "&#9601;&#9603;&#9605;&#9607;", glow: "rgba(255,45,120,.26)",
      blurb: "Five sorts step by step, merge sort's split tree, and a head-to-head race.",
      topics: ["bubble", "selection", "insertion", "merge", "quick"], extra: ["sorting.html#merge", "Merge sort"] },
    { subject: "algorithms", status: "live", page: "recursion.html", title: "Recursion", art: "f(f(x))", glow: "rgba(61,245,160,.22)",
      blurb: "Watch the call stack pile up and unwind, the call tree grow, and memoization make slow code fast.",
      topics: ["recursion"], extra: ["recursion.html#memo", "Memo fib"] },
    { subject: "algorithms", status: "live", page: "pathfinding.html", title: "Pathfinding", art: "S&rarr;G", glow: "rgba(53,214,245,.22)",
      blurb: "Draw walls and mud, then watch BFS, DFS, Dijkstra and A* find the way through.",
      topics: ["bfs", "dfs", "dijkstra", "astar"], extra: ["pathfinding.html#astar", "A*"] },
    { subject: "algorithms", status: "live", page: "dp.html", title: "Dynamic Programming", art: "dp[i]", glow: "rgba(255,201,60,.22)",
      blurb: "Solve each small problem once and keep the answer in a table. Watch the tables fill, then change the inputs.",
      topics: ["dp-fib", "dp-grid", "dp-coins", "dp-lcs"], extra: ["dp.html#coins", "Coin change"] },
    { subject: "algorithms", status: "soon", title: "Graphs", art: "&#9675;&mdash;&#9675;", glow: "rgba(255,45,120,.16)",
      blurb: "Networks of things: friends, roads, the internet. Traversal, cycles and shortest paths on real graphs." },

    /* ---------- Data Structures ---------- */
    { subject: "data", status: "live", page: "arrays.html", title: "Arrays", art: "[ ]", glow: "rgba(53,214,245,.26)",
      blurb: "Cells in memory, addresses, and why reading is instant but inserting is slow.",
      topics: ["arrays"] },
    { subject: "data", status: "live", page: "structures.html", title: "Stacks, queues, lists, maps & trees", art: "&#9675;&rarr;&#9675;", glow: "rgba(255,45,120,.22)",
      blurb: "Five structures with boxes and arrows that move: stack, queue, linked list, hash map and binary search tree.",
      topics: ["stack", "queue", "linkedlist", "hashmap", "bst"], extra: ["structures.html#hash", "Hash map"] },
    { subject: "data", status: "soon", title: "Heaps & priority queues", art: "&#9651;", glow: "rgba(61,245,160,.16)",
      blurb: "The structure behind Dijkstra and task schedulers: always know the smallest item, instantly." },

    /* ---------- Programming Concepts ---------- */
    { subject: "concepts", status: "live", page: "oop.html", title: "Object-Oriented Programming", art: "class", glow: "rgba(53,214,245,.24)",
      blurb: "Build objects from a class, watch method lookup climb a family tree, and try to break into a private bank balance.",
      topics: ["oop-classes", "oop-inherit", "oop-poly", "oop-encap", "oop-abstract"], extra: ["oop.html#inherit", "Inheritance"] },
    { subject: "concepts", status: "live", page: "refs.html", title: "Variables & references", art: "a &rarr; [ ]", glow: "rgba(255,201,60,.22)",
      blurb: "Why changing one list changes \"another\". Names, arrows, copies, and a sandbox to write your own.",
      topics: ["refs"], extra: ["refs.html#sandbox", "Sandbox"] },
    { subject: "concepts", status: "live", page: "async.html", title: "Async & the event loop", art: "&#8635;", glow: "rgba(255,45,120,.22)",
      blurb: "How one thread juggles timers, clicks and network calls. Watch the call stack, the queues and the loop, then predict the order.",
      topics: ["async"], extra: ["async.html#sandbox", "Sandbox"] },
    { subject: "concepts", status: "live", page: "scope.html", title: "Scope & closures", art: "{ { } }", glow: "rgba(61,245,160,.22)",
      blurb: "Which variable does a name mean right here? Watch Python search nested boxes of names, and build closures that remember.",
      topics: ["scope"], extra: ["scope.html#closure", "Closures"] },
    { subject: "concepts", status: "soon", title: "Bits, binary & hex", art: "0b101", glow: "rgba(53,214,245,.16)",
      blurb: "Flip bits and watch the number change. Binary, hex, overflow, and why 0.1 + 0.2 isn't 0.3." },
    { subject: "concepts", status: "soon", title: "Code playground", art: "&gt;_", glow: "rgba(255,201,60,.16)",
      blurb: "Write your own code, run it in the browser, and step through it with the same player." }
  ];

  function subject(id) { return SUBJECTS.filter(function (s) { return s.id === id; })[0]; }
  function modulesOf(id) { return MODULES.filter(function (m) { return m.subject === id; }); }

  /* how many of a list of modules' topics are ticked off */
  function score(mods) {
    var p = AV.progress.all(), done = 0, total = 0;
    mods.forEach(function (m) { (m.topics || []).forEach(function (t) { total++; if (p[t]) { done++; } }); });
    return { done: done, total: total };
  }

  function bar(sc) {
    var pct = sc.total ? Math.round(sc.done / sc.total * 100) : 0;
    return '<div class="av-sbar" aria-hidden="true"><div style="width:' + pct + '%"></div></div>' +
      '<span class="av-sbar-text">' + sc.done + " of " + sc.total + " topics learned</span>";
  }

  /* ---------- the big subject cards ---------- */
  function subjectCards(host) {
    host.innerHTML = SUBJECTS.map(function (s) {
      var mods = modulesOf(s.id), live = mods.filter(function (m) { return m.status === "live"; }), soon = mods.length - live.length;
      return '<article class="card av-subject is-' + s.tone + '">' +
        '<a class="card-art is-blank" href="' + s.page + '" tabindex="-1" aria-hidden="true" style="--blank-glow:' + s.glow + '">' +
          '<span class="initials">' + s.icon + "</span></a>" +
        '<div class="card-body">' +
          '<div class="tags"><span class="tag av-stag is-' + s.tone + '">' + live.length + " module" + (live.length === 1 ? "" : "s") + "</span>" +
            (soon ? '<span class="tag">' + soon + " coming</span>" : "") + "</div>" +
          '<h3><a href="' + s.page + '">' + s.name + "</a></h3>" +
          "<p>" + s.blurb + "</p>" +
          '<ul class="av-subject-list">' + live.map(function (m) { return '<li><a href="' + m.page + '">' + m.title + "</a></li>"; }).join("") + "</ul>" +
          '<div class="av-subject-progress">' + bar(score(live)) + "</div>" +
          '<div class="card-links"><a href="' + s.page + '">Open ' + s.name + " &rarr;</a></div>" +
        "</div></article>";
    }).join("");
  }

  /* ---------- module cards (subject pages + the "everything" grid) ---------- */
  function moduleCards(host, mods, showSubject) {
    var p = AV.progress.all(), n = 0;
    host.innerHTML = mods.map(function (m) {
      var s = subject(m.subject), live = m.status === "live";
      if (live) { n++; }
      var tag = live
        ? '<span class="tag is-ready">' + (showSubject ? s.name : "Module " + n) + "</span>"
        : '<span class="tag is-soon">Coming soon</span>' + (showSubject ? '<span class="tag">' + s.name + "</span>" : "");
      var topics = live && m.topics && m.topics.length > 1
        ? '<ul class="av-topics">' + m.topics.map(function (t) {
            return '<li class="' + (p[t] ? "is-done" : "") + '">' + AV.esc(AV.TOPICS[t] || t) + "</li>";
          }).join("") + "</ul>"
        : live && m.topics ? '<ul class="av-topics"><li class="' + (p[m.topics[0]] ? "is-done" : "") + '">' +
            (p[m.topics[0]] ? "Learned" : "Not marked as learned yet") + "</li></ul>" : "";
      var art = '<span class="initials">' + m.art + "</span>";
      return '<article class="card' + (live ? "" : " is-soon") + '" data-subject="' + m.subject + '">' +
        (live ? '<a class="card-art is-blank" href="' + m.page + '" tabindex="-1" aria-hidden="true" style="--blank-glow:' + m.glow + '">' + art + "</a>"
              : '<div class="card-art is-blank" aria-hidden="true" style="--blank-glow:' + m.glow + '">' + art + "</div>") +
        '<div class="card-body"><div class="tags">' + tag + "</div>" +
          "<h3>" + (live ? '<a href="' + m.page + '">' + m.title + "</a>" : m.title) + "</h3>" +
          "<p>" + m.blurb + "</p>" + topics +
          (live ? '<div class="card-links"><a href="' + m.page + '">Open &rarr;</a>' +
            (m.extra ? ' <a href="' + m.extra[0] + '">' + m.extra[1] + " &rarr;</a>" : "") + "</div>" : "") +
        "</div></article>";
    }).join("");
  }

  return { SUBJECTS: SUBJECTS, MODULES: MODULES, subject: subject, modulesOf: modulesOf,
           score: score, bar: bar, subjectCards: subjectCards, moduleCards: moduleCards };
})();
