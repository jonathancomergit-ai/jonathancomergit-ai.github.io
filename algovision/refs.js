/* ============================================================
   AlgoVision - Variables & references

   The picture Python really works from: NAMES on the left, OBJECTS
   on the right, and arrows from names to objects. A name never
   holds a list; it points at one. Most "why did that change?!"
   bugs are two names pointing at the same object.

   state = {
     frames: [{ name, vars: { varName: objId } }],   global first
     objs:   { id: { t: "list"|"int"|"str", v, items: [...], slot } },
     out:    printed lines
   }
   A list item is either a plain value or { ref: objId }.
   ============================================================ */

(function () {
  "use strict";

  var $ = function (s) { return document.querySelector(s); };
  var esc = AV.esc;
  function b(v) { return "<b>" + v + "</b>"; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  var SLOTS = 5;

  /* ---------- the little memory model ---------- */

  function blank() { return { frames: [{ name: "global", vars: {} }], objs: {}, out: [], nextId: 1 }; }

  function freeSlot(st) {
    var used = {};
    Object.keys(st.objs).forEach(function (k) { used[st.objs[k].slot] = 1; });
    for (var i = 0; i < SLOTS; i++) { if (!used[i]) { return i; } }
    return -1;
  }
  function make(st, o) {
    var id = "o" + st.nextId++;
    o.slot = freeSlot(st);
    st.objs[id] = o;
    return id;
  }
  function newList(st, items) { return make(st, { t: "list", items: items.slice() }); }
  function newVal(st, v) { return make(st, { t: typeof v === "string" ? "str" : "int", v: v }); }
  function frame(st, name) { return st.frames.filter(function (f) { return f.name === name; })[0] || st.frames[0]; }
  function lookup(st, name) {
    for (var i = st.frames.length - 1; i >= 0; i--) { if (name in st.frames[i].vars) { return st.frames[i].vars[name]; } }
    return null;
  }
  function show(st, id, depth) {
    var o = st.objs[id];
    if (!o) { return "?"; }
    if (o.t === "int") { return String(o.v); }
    if (o.t === "str") { return "'" + o.v + "'"; }
    if ((depth || 0) > 3) { return "[...]"; }
    return "[" + o.items.map(function (it) { return it && it.ref ? show(st, it.ref, (depth || 0) + 1) : typeof it === "string" ? "'" + it + "'" : it; }).join(", ") + "]";
  }

  /* everything reachable from some name; the rest is garbage */
  function reachable(st) {
    var seen = {};
    function walk(id) {
      if (!id || seen[id] || !st.objs[id]) { return; }
      seen[id] = 1;
      (st.objs[id].items || []).forEach(function (it) { if (it && it.ref) { walk(it.ref); } });
    }
    st.frames.forEach(function (f) { Object.keys(f.vars).forEach(function (n) { walk(f.vars[n]); }); });
    return seen;
  }
  function collect(st) {
    var live = reachable(st), gone = 0;
    Object.keys(st.objs).forEach(function (id) { if (!live[id]) { delete st.objs[id]; gone++; } });
    return gone;
  }

  function Rec(state) {
    var r = { st: clone(state), frames: [] };
    r.snap = function (line, msg, x) { r.frames.push({ st: clone(r.st), line: line, msg: msg, x: x || {} }); };
    return r;
  }

  /* ---------- the scenarios ----------
     Each step: [code line index, what happens (fn), sentence, highlight] */

  var SCEN = {
    alias: {
      name: "Two names, one list", topic: "refs",
      code: [
        "a = [1, 2, 3]",
        "b = a          # b points at the SAME list",
        "b.append(4)",
        "print(a)       # surprise?"
      ],
      steps: function (st) { return [
        [0, function () { frame(st).vars.a = newList(st, [1, 2, 3]); },
          "Python makes a list object, then points the name " + b("a") + " at it. The name doesn't hold the list. It's a " + b("label on an arrow") + ".", { name: "a" }],
        [1, function () { frame(st).vars.b = frame(st).vars.a; },
          b("b = a") + " doesn't copy anything. It points " + b("b") + " at the " + b("same object") + " a points at. Two arrows, one list.", { name: "b" }],
        [2, function () { st.objs[frame(st).vars.b].items.push(4); },
          "Change the list " + b("through b")  + ". There's only one list, so...", function () { return { obj: frame(st).vars.a }; }],
        [3, function () { st.out.push(show(st, frame(st).vars.a)); },
          function () { return "...a sees the 4 too: " + b(esc(show(st, frame(st).vars.a))) + ". Nothing \"changed a\". a and b are " + b("two names for one thing") + "."; }, { name: "a" }]
      ]; }
    },
    copy: {
      name: "Making a real copy", topic: "refs",
      code: [
        "a = [1, 2, 3]",
        "b = a.copy()   # a NEW list with the same items",
        "b.append(4)",
        "print(a)",
        "print(b)"
      ],
      steps: function (st) { return [
        [0, function () { frame(st).vars.a = newList(st, [1, 2, 3]); }, "A list, and the name " + b("a") + " pointing at it.", { name: "a" }],
        [1, function () { frame(st).vars.b = newList(st, st.objs[frame(st).vars.a].items); },
          b(".copy()") + " builds a " + b("second list") + " with the same items. Now there are two objects, one arrow each.", { name: "b" }],
        [2, function () { st.objs[frame(st).vars.b].items.push(4); }, "Append to b's list. a's list is a different object, so it's untouched.", function () { return { obj: frame(st).vars.b }; }],
        [3, function () { st.out.push(show(st, frame(st).vars.a)); }, "a is still " + b("[1, 2, 3]") + ".", { name: "a" }],
        [4, function () { st.out.push(show(st, frame(st).vars.b)); }, "b has the 4: " + b("[1, 2, 3, 4]") + ". Also works: " + b("list(a)") + " or " + b("a[:]") + ".", { name: "b" }]
      ]; }
    },
    immut: {
      name: "Numbers can't change", topic: "refs",
      code: [
        "x = 5",
        "y = x          # both point at the same 5",
        "y = y + 1      # makes a NEW object, 6",
        "print(x)"
      ],
      steps: function (st) { return [
        [0, function () { frame(st).vars.x = newVal(st, 5); }, "An int object, 5, and the name " + b("x") + ".", { name: "x" }],
        [1, function () { frame(st).vars.y = frame(st).vars.x; }, "Just like lists: y = x points y at the " + b("same") + " 5.", { name: "y" }],
        [2, function () { frame(st).vars.y = newVal(st, 6); },
          "But ints are " + b("immutable") + ": nothing can change a 5 into a 6. So y + 1 makes a " + b("new object") + ", and y's arrow moves to it.", { name: "y" }],
        [3, function () { st.out.push("5"); },
          "x still points at 5. That's why numbers and strings never surprise you like lists do: you can only " + b("move arrows") + ", not change the objects.", { name: "x" }]
      ]; }
    },
    func: {
      name: "Passing to a function", topic: "refs",
      code: [
        "def add_item(lst):",
        "    lst.append('!')  # changes the caller's list",
        "",
        "nums = [1, 2]",
        "add_item(nums)",
        "print(nums)"
      ],
      steps: function (st) { return [
        [3, function () { frame(st).vars.nums = newList(st, [1, 2]); }, "A list, called " + b("nums") + ".", { name: "nums" }],
        [4, function () { st.frames.push({ name: "add_item", vars: { lst: frame(st).vars.nums } }); },
          "Calling the function makes a new " + b("frame") + " with its own name, " + b("lst") + ", pointed at whatever you passed: the " + b("same list") + ".", { name: "lst" }],
        [1, function () { st.objs[st.frames[1].vars.lst].items.push("!"); },
          "append through lst. It's the caller's list, so the caller will see this.", function () { return { obj: st.frames[1].vars.lst }; }],
        [4, function () { st.frames.pop(); }, "The function returns. Its frame and the name lst disappear. The list stays, because nums still points at it.", { name: "nums" }],
        [5, function () { st.out.push(show(st, frame(st).vars.nums)); },
          function () { return b(esc(show(st, frame(st).vars.nums))) + ". Functions get the " + b("object") + ", not a copy. Handy, and a classic bug when you didn't expect it."; }, { name: "nums" }]
      ]; }
    },
    is: {
      name: "is vs ==", topic: "refs",
      code: [
        "a = [1, 2]",
        "b = [1, 2]",
        "print(a == b)  # same contents?",
        "print(a is b)  # same object?",
        "c = a",
        "print(a is c)"
      ],
      steps: function (st) { return [
        [0, function () { frame(st).vars.a = newList(st, [1, 2]); }, "A list for a.", { name: "a" }],
        [1, function () { frame(st).vars.b = newList(st, [1, 2]); }, "A " + b("second") + " list for b, with the same contents.", { name: "b" }],
        [2, function () { st.out.push("True"); }, b("==") + " compares " + b("contents") + ": both are [1, 2], so True.", {}],
        [3, function () { st.out.push("False"); }, b("is") + " asks \"same object?\": two separate boxes, so False.", {}],
        [4, function () { frame(st).vars.c = frame(st).vars.a; }, "c = a: c points at a's object.", { name: "c" }],
        [5, function () { st.out.push("True"); }, "Same object, so a is c is " + b("True") + ". Rule: use " + b("==") + " to compare values, " + b("is") + " only for None.", { name: "c" }]
      ]; }
    },
    shallow: {
      name: "Shallow copy trap", topic: "refs",
      code: [
        "grid = [[0, 0], [0, 0]]",
        "copy = grid.copy()   # copies the OUTER list only",
        "copy[0][0] = 9",
        "print(grid)          # !"
      ],
      steps: function (st) { return [
        [0, function () {
          var r1 = newList(st, [0, 0]), r2 = newList(st, [0, 0]);
          frame(st).vars.grid = newList(st, [{ ref: r1 }, { ref: r2 }]);
        }, "A list of two lists. The outer list doesn't hold the rows: it holds " + b("arrows") + " to them.", { name: "grid" }],
        [1, function () { frame(st).vars.copy = newList(st, st.objs[frame(st).vars.grid].items); },
          ".copy() makes a new " + b("outer") + " list, but copies the " + b("arrows") + " inside it. Both outer lists point at the same two rows.", { name: "copy" }],
        [2, function () { var row = st.objs[frame(st).vars.copy].items[0].ref; st.objs[row].items[0] = 9; },
          "Change row 0 through copy. That row is " + b("shared") + "...", function () { return { obj: st.objs[frame(st).vars.copy].items[0].ref }; }],
        [3, function () { st.out.push(show(st, frame(st).vars.grid)); },
          function () { return "...so grid changed too: " + b(esc(show(st, frame(st).vars.grid))) + ". For nested data use " + b("copy.deepcopy(grid)") + ", which copies the rows as well."; }, { name: "grid" }]
      ]; }
    }
  };

  /* ---------- the sandbox: write a program by pressing buttons ---------- */

  var sandbox = { st: blank(), lines: [], counter: 3 };

  var SAND = {
    newA:   { label: "a = [1, 2]",    run: function (st) { frame(st).vars.a = newList(st, [1, 2]); return "A new list for " + b("a") + "."; } },
    bIsA:   { label: "b = a",         run: function (st) { if (!need(st, "a")) { return err("a"); } frame(st).vars.b = frame(st).vars.a; return b("b") + " now points at the same object as a."; } },
    bCopy:  { label: "b = a.copy()",  run: function (st) {
      if (!need(st, "a")) { return err("a"); }
      var o = st.objs[frame(st).vars.a];
      if (o.t !== "list") { return "a is a number now, and numbers don't have .copy(). (AttributeError)"; }
      frame(st).vars.b = newList(st, o.items); return "b gets its " + b("own new list") + " with the same items.";
    } },
    cIsB:   { label: "c = b",         run: function (st) { if (!need(st, "b")) { return err("b"); } frame(st).vars.c = frame(st).vars.b; return b("c") + " points wherever b points."; } },
    appA:   { label: "a.append(n)",   run: function (st) { return app(st, "a"); } },
    appB:   { label: "b.append(n)",   run: function (st) { return app(st, "b"); } },
    aZero:  { label: "a = 0",         run: function (st) { frame(st).vars.a = newVal(st, 0); return b("a") + "'s arrow moves to a new int. Anything else that pointed at a's old object still does."; } },
    delB:   { label: "del b",         run: function (st) { if (!need(st, "b")) { return err("b"); } delete frame(st).vars.b; return "The " + b("name") + " b is gone. The object only goes if no other arrows point at it."; } }
  };
  function need(st, n) { return lookup(st, n) != null; }
  function err(n) { return b("NameError") + ": there's no name " + n + " right now. Create it first."; }
  function app(st, n) {
    if (!need(st, n)) { return err(n); }
    var o = st.objs[lookup(st, n)];
    if (o.t !== "list") { return n + " points at a number, and numbers have no .append(). (AttributeError)"; }
    o.items.push(sandbox.counter++);
    return "Appended to the list " + n + " points at. Every name pointing at it sees the change.";
  }

  /* ---------- drawing ---------- */

  var NS = "http://www.w3.org/2000/svg";
  function svg(tag, attrs, parent, text) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) { e.setAttribute(k, attrs[k]); }
    if (text != null) { e.textContent = text; }
    if (parent) { parent.appendChild(e); }
    return e;
  }
  var OX = 232, SH = 62, CELL = 34;
  var pic = $("#pic"), outEl = $("#out");

  function draw(f) {
    var st = f.st, x = f.x, live = reachable(st);
    pic.innerHTML = "";
    var defs = svg("defs", {}, pic);
    ["", "hot"].forEach(function (k) {
      var m = svg("marker", { id: "rh" + k, viewBox: "0 0 8 8", refX: 7, refY: 4, markerWidth: 7, markerHeight: 7, orient: "auto" }, defs);
      svg("path", { d: "M0,0 L8,4 L0,8 z", "class": "rf-ah" + (k ? " is-hot" : "") }, m);
    });
    svg("text", { x: 10, y: 14, "class": "rf-col" }, pic, "NAMES");
    svg("text", { x: OX, y: 14, "class": "rf-col" }, pic, "OBJECTS");
    var arrows = svg("g", {}, pic), boxes = svg("g", {}, pic);

    /* objects first, so arrows know where to land */
    var at = {};
    Object.keys(st.objs).forEach(function (id) {
      var o = st.objs[id], y = 24 + o.slot * SH, dead = !live[id];
      var g = svg("g", { "class": "rf-obj" + (x.obj === id ? " is-hl" : "") + (dead ? " is-dead" : ""), transform: "translate(" + OX + "," + y + ")" }, boxes);
      svg("text", { x: 0, y: 11, "class": "rf-type" }, g, o.t + (dead ? "  · no arrows left: garbage collected" : ""));
      if (o.t === "list") {
        var n = Math.max(1, o.items.length);
        svg("rect", { x: 0, y: 16, width: n * CELL, height: 30, rx: 5, "class": "rf-box" }, g);
        o.items.forEach(function (it, k) {
          if (k) { svg("line", { x1: k * CELL, y1: 16, x2: k * CELL, y2: 46, "class": "rf-div" }, g); }
          if (it && it.ref) {
            svg("circle", { cx: k * CELL + CELL / 2, cy: 31, r: 3.5, "class": "rf-dot" }, g);
            at["item:" + id + ":" + k] = { x: OX + k * CELL + CELL / 2, y: y + 31 };
          } else {
            svg("text", { x: k * CELL + CELL / 2, y: 36, "text-anchor": "middle", "class": "rf-val" }, g, typeof it === "string" ? "'" + it + "'" : it);
          }
        });
        if (!o.items.length) { svg("text", { x: CELL / 2, y: 36, "text-anchor": "middle", "class": "rf-val" }, g, "[ ]"); }
        at[id] = { x: OX, y: y + 31, w: n * CELL };
      } else {
        svg("rect", { x: 0, y: 16, width: 48, height: 30, rx: 15, "class": "rf-box is-val" }, g);
        svg("text", { x: 24, y: 36, "text-anchor": "middle", "class": "rf-val" }, g, o.t === "str" ? "'" + o.v + "'" : o.v);
        at[id] = { x: OX, y: y + 31, w: 48 };
      }
    });

    /* frames and their names */
    var fy = 24;
    st.frames.forEach(function (fr, k) {
      var names = Object.keys(fr.vars), h = 30 + Math.max(1, names.length) * 30;
      var g = svg("g", { "class": "rf-frame" + (k ? " is-fn" : ""), transform: "translate(10," + fy + ")" }, boxes);
      svg("rect", { width: 176, height: h, rx: 8 }, g);
      svg("text", { x: 10, y: 18, "class": "rf-fname" }, g, k ? fr.name + "()" : "global");
      names.forEach(function (nm, j) {
        var ny = 30 + j * 30;
        var row = svg("g", { "class": "rf-name" + (x.name === nm ? " is-hl" : ""), transform: "translate(10," + ny + ")" }, g);
        svg("rect", { width: 156, height: 24, rx: 5 }, row);
        svg("text", { x: 10, y: 16 }, row, nm);
        svg("circle", { cx: 142, cy: 12, r: 3.5, "class": "rf-dot" }, row);
        var tgt = at[fr.vars[nm]];
        if (tgt) {
          var x1 = 10 + 10 + 142, y1 = fy + ny + 12, x2 = tgt.x - 3, y2 = tgt.y;
          var hot = x.name === nm;
          svg("path", { d: "M" + x1 + "," + y1 + " C" + (x1 + 34) + "," + y1 + " " + (x2 - 34) + "," + y2 + " " + x2 + "," + y2,
            "class": "rf-arrow" + (hot ? " is-hot" : ""), "marker-end": "url(#rh" + (hot ? "hot" : "") + ")" }, arrows);
        }
      });
      if (!names.length) { svg("text", { x: 20, y: 46, "class": "rf-empty" }, g, "no names yet"); }
      fy += h + 10;
    });

    /* arrows from inside lists to the objects they hold */
    Object.keys(at).forEach(function (k) {
      if (k.indexOf("item:") !== 0) { return; }
      var p = k.split(":"), it = st.objs[p[1]].items[+p[2]], from = at[k], to = at[it.ref];
      if (!to) { return; }
      var x2 = to.x + to.w + 3, y2 = to.y;
      svg("path", { d: "M" + from.x + "," + from.y + " C" + (from.x + 90) + "," + from.y + " " + (x2 + 50) + "," + y2 + " " + x2 + "," + y2,
        "class": "rf-arrow is-inner", "marker-end": "url(#rh)" }, arrows);
    });

    outEl.innerHTML = '<span class="pf-ds-name">Printed</span>' + (st.out.length
      ? st.out.slice(-4).map(function (l) { return '<span class="av-box">' + esc(l) + "</span>"; }).join("")
      : '<span class="r-empty">nothing yet</span>');
  }

  /* ---------- page wiring ---------- */

  var say = $("#say");
  var code = AV.Code($("#code"), [], $("#now"));
  var current = /^#(alias|copy|immut|func|is|shallow|sandbox)$/.test(location.hash) ? location.hash.slice(1) : "alias";

  function render(f) {
    draw(f);
    code.mark(f.line);
    say.innerHTML = f.msg;
  }
  var player = AV.Player($("#controls"), render, {
    keys: true, speed: 1,
    steady: [{ el: say, html: function (f) { return f.msg; } }]
  });
  AV.learn($("#learn"), "refs");

  function runScenario(key) {
    var S = SCEN[key], r = Rec(blank());
    code.load(S.code);
    r.snap(-1, "Press play (or &rarr;) to run it one line at a time. Watch the " + b("arrows") + ", not the names.");
    /* A step's sentence or highlight can be a function: it's read AFTER
       the step runs, so it can describe the new state. */
    function val(v) { return typeof v === "function" ? v() : v; }
    S.steps(r.st).forEach(function (s) {
      s[1]();
      r.snap(s[0], val(s[2]), val(s[3]));
    });
    player.load(r.frames);
  }

  function sandFrames(msg, line) {
    var r = Rec(sandbox.st);
    r.snap(line, msg);
    return r.frames;
  }

  function sandRun(key) {
    var op = SAND[key];
    collect(sandbox.st);   /* last step's garbage is gone now */
    if (freeSlot(sandbox.st) < 0 && /newA|bCopy|aZero/.test(key)) {
      player.load(sandFrames("Memory's full on this screen (" + SLOTS + " objects). Try " + b("del b") + " or Reset.", sandbox.lines.length - 1));
      return;
    }
    var before = clone(sandbox.st);
    var msg = op.run(sandbox.st);
    var label = key === "appA" || key === "appB" ? op.label.replace("n", String(sandbox.counter - 1)) : op.label;
    if (/Error/.test(msg) && JSON.stringify(before) === JSON.stringify(sandbox.st)) {
      code.load(sandbox.lines.concat([label + "  # error"]));
    } else {
      sandbox.lines.push(label);
      if (sandbox.lines.length > 12) { sandbox.lines.shift(); }
      code.load(sandbox.lines);
    }
    var dead = Object.keys(sandbox.st.objs).length - Object.keys(reachable(sandbox.st)).length;
    if (dead) { msg += " " + b(dead + " object" + (dead > 1 ? "s have" : " has") + " no arrows left") + ", so Python frees it."; }
    player.load(sandFrames(msg, sandbox.lines.length - 1));
  }

  function openTab(key) {
    current = key;
    var isSand = key === "sandbox";
    $("#sand").hidden = !isSand;
    $("#scen-name").textContent = isSand ? "Sandbox" : SCEN[key].name;
    if (isSand) {
      code.load(sandbox.lines.length ? sandbox.lines : ["# press buttons to write a program"]);
      player.load(sandFrames("Press the buttons to write a program, one line at a time. Make two names share a list, then append through one of them.", sandbox.lines.length - 1));
    } else {
      runScenario(key);
    }
  }

  var sandEl = $("#sand-ops");
  Object.keys(SAND).forEach(function (k) {
    var btn = AV.el("button", "av-op", "<span>" + esc(SAND[k].label) + "</span>");
    btn.type = "button";
    btn.addEventListener("click", function () { sandRun(k); });
    sandEl.appendChild(btn);
  });
  $("#sand-reset").addEventListener("click", function () {
    sandbox = { st: blank(), lines: [], counter: 3 };
    openTab("sandbox");
  });

  document.querySelectorAll("#scens [data-pick]").forEach(function (p) {
    p.setAttribute("aria-pressed", p.getAttribute("data-pick") === current ? "true" : "false");
  });
  AV.pills($("#scens"), function (k) {
    try { history.replaceState(null, "", "#" + k); } catch (e) { /* file:// */ }
    openTab(k);
  });
  openTab(current);

  AV.quiz($("#quiz"), [
    {
      q: "a = [1, 2]; b = a; b.append(3). What is a?",
      opts: ["[1, 2]", "[1, 2, 3]", "[3]", "An error"], a: 1,
      why: "b = a doesn't copy. Both names point at one list, so appending through b changes the list a points at."
    },
    {
      q: "x = 5; y = x; y = y + 1. What is x?",
      opts: ["5", "6", "None", "An error"], a: 0,
      why: "Ints can't be changed. y + 1 makes a new 6 and moves y's arrow; x still points at 5."
    },
    {
      q: "Which makes b a separate list you can change safely?",
      opts: ["b = a", "b = a.copy()", "b is a", "b == a"], a: 1,
      why: ".copy() (or list(a), or a[:]) builds a new list. For lists inside lists you need copy.deepcopy()."
    },
    {
      q: "a = [1]; b = [1]. What are a == b and a is b?",
      opts: ["True, True", "True, False", "False, False", "False, True"], a: 1,
      why: "== compares contents (same), is compares identity (two different objects)."
    },
    {
      q: "When does Python delete an object?",
      opts: ["When you write del", "When no names (or other objects) point at it any more", "At the end of the line", "Never"], a: 1,
      why: "del only removes a name. The object is collected once nothing refers to it. Try it in the <b>Sandbox</b>: b = a, then del b, then a = 0."
    }
  ], $("#quiz-score"));
})();
