/* ============================================================
   AlgoVision - Scope & closures

   Every function call gets its own SCOPE: a box of names. Boxes
   have a parent: the scope where the function was WRITTEN (not
   where it was called). To find a name, Python looks in the
   current box, then its parent, then its parent... out to global.

   A CLOSURE is a function that keeps a link to the box it was
   written in, so that box stays alive after its call has ended.

   state = { scopes: [{ id, title, parent, vars: {name: value}, status }], out: [] }
     status: "active" (running now), "waiting" (called something),
             "kept" (call ended, but a closure still uses it),
             "gone" (call ended, nothing needs it)
   A function value is { fn: name, home: scopeId }.
   ============================================================ */

(function () {
  "use strict";

  var $ = function (s) { return document.querySelector(s); };
  var esc = AV.esc;
  function b(v) { return "<b>" + v + "</b>"; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ---------- the model ---------- */

  function blank() { return { scopes: [{ id: 0, title: "global", parent: null, vars: {}, status: "active" }], out: [], next: 1 }; }
  function sc(st, id) { return st.scopes.filter(function (s) { return s.id === id; })[0]; }
  function open(st, title, parent) {
    st.scopes.forEach(function (s) { if (s.status === "active") { s.status = "waiting"; } });
    var id = st.next++;
    st.scopes.push({ id: id, title: title, parent: parent, vars: {}, status: "active" });
    return id;
  }
  /* end a call: the box stays only if some function value still points at it */
  function close(st, id, backTo) {
    var s = sc(st, id);
    var kept = st.scopes.some(function (o) {
      return o.status !== "gone" && Object.keys(o.vars).some(function (k) { var v = o.vars[k]; return v && v.home === id && o.id !== id; });
    });
    s.status = kept ? "kept" : "gone";
    if (backTo != null) { sc(st, backTo).status = "active"; }
    return kept;
  }
  function sweep(st) { st.scopes = st.scopes.filter(function (s) { return s.status !== "gone"; }); }

  /* walk outward from a scope looking for a name */
  function lookup(st, name, from) {
    var checked = [], at = from;
    while (at != null) {
      checked.push(at);
      var s = sc(st, at);
      if (name in s.vars) { return { name: name, checked: checked, found: at }; }
      at = s.parent;
    }
    return { name: name, checked: checked, found: null };
  }
  function val(st, L) { return L.found == null ? undefined : sc(st, L.found).vars[L.name]; }
  function show(v) {
    if (v && v.fn) { return "function " + v.fn; }
    if (v && v.unset) { return "(no value yet)"; }
    return typeof v === "string" ? "'" + v + "'" : String(v);
  }
  function where(st, L) {
    if (L.found == null) { return "nowhere"; }
    return sc(st, L.found).title;
  }
  function trail(st, L) {
    return L.checked.map(function (id) { return sc(st, id).title; }).join(" &rarr; ");
  }

  function Rec(state) {
    var r = { st: clone(state), frames: [] };
    r.snap = function (line, msg, x) { r.frames.push({ st: clone(r.st), line: line, msg: msg, x: x || {} }); };
    return r;
  }

  /* ---------- scenarios: each step = [line, act(), message, extra] ----------
     message and extra may be functions; they're read after act() runs. */

  var SCEN = {
    local: {
      name: "Local vs global",
      code: [
        "x = 'global'",
        "",
        "def show():",
        "    x = 'local'  # a NEW x that only exists inside show",
        "    print(x)",
        "",
        "show()",
        "print(x)"
      ],
      steps: function (st) {
        var call, L;
        return [
          [0, function () { sc(st, 0).vars.x = "global"; }, "Make a name " + b("x") + " in the " + b("global") + " scope: the outermost box, always there.", { name: "x" }],
          [2, function () { sc(st, 0).vars.show = { fn: "show", home: 0 }; }, "def creates a function and names it " + b("show") + ". Its home is global, where it was written.", { name: "show" }],
          [6, function () { call = open(st, "show() call", 0); }, "Calling show() makes a " + b("brand-new box") + " for its names. Its parent is global.", function () { return { box: call }; }],
          [3, function () { sc(st, call).vars.x = "local"; }, "Assigning x " + b("inside") + " a function makes a new " + b("local") + " x in show's box. The global x is untouched.", { name: "x" }],
          [4, function () { L = lookup(st, "x", call); st.out.push(String(val(st, L))); },
            function () { return "print(x): look in the nearest box first. Found it in " + b(where(st, L)) + ", so it prints " + b(esc(show(val(st, L)))) + "."; }, function () { return { look: L }; }],
          [6, function () { close(st, call, 0); }, "show() returns. Nothing refers to its box any more, so the box and its local x " + b("disappear") + ".", function () { return { box: call }; }],
          [7, function () { sweep(st); L = lookup(st, "x", 0); st.out.push(String(val(st, L))); },
            function () { return "Back in global, x is still " + b(esc(show(val(st, L)))) + ". Each function call gets its own names."; }, function () { return { look: L }; }]
        ];
      }
    },
    outward: {
      name: "Looking outward",
      code: [
        "name = 'Ada'",
        "",
        "def outer():",
        "    greeting = 'Hi'",
        "    def inner():",
        "        print(greeting, name)  # not in here... look outward",
        "    inner()",
        "",
        "outer()"
      ],
      steps: function (st) {
        var o, i, L1, L2;
        return [
          [0, function () { sc(st, 0).vars.name = "Ada"; }, "A global " + b("name") + ".", { name: "name" }],
          [2, function () { sc(st, 0).vars.outer = { fn: "outer", home: 0 }; }, "Define outer.", { name: "outer" }],
          [8, function () { o = open(st, "outer() call", 0); }, "Call outer(): a new box, parent global.", function () { return { box: o }; }],
          [3, function () { sc(st, o).vars.greeting = "Hi"; }, b("greeting") + " lives in outer's box.", { name: "greeting" }],
          [4, function () { sc(st, o).vars.inner = { fn: "inner", home: o }; }, "inner is " + b("written inside outer") + ", so its home, and its future parent, is outer's box.", { name: "inner" }],
          [6, function () { i = open(st, "inner() call", o); }, "Call inner(): a new box whose parent is " + b("outer's box") + ", because that's where inner was written.", function () { return { box: i }; }],
          [5, function () { L1 = lookup(st, "greeting", i); }, function () { return "Find " + b("greeting") + ": " + trail(st, L1) + ". Not in inner's own box, so look in its parent: found in " + b(where(st, L1)) + "."; }, function () { return { look: L1 }; }],
          [5, function () { L2 = lookup(st, "name", i); st.out.push("Hi Ada"); }, function () { return "Find " + b("name") + ": " + trail(st, L2) + ". It had to go all the way out to " + b("global") + ". Prints " + b("Hi Ada") + "."; }, function () { return { look: L2 }; }],
          [6, function () { close(st, i, o); }, "inner() returns, its box goes.", function () { return { box: i }; }],
          [8, function () { sweep(st); close(st, o, 0); }, "outer() returns too. This inside-out search is called " + b("LEGB") + ": Local, Enclosing, Global, Built-in.", function () { return { box: o }; }]
        ];
      }
    },
    trap: {
      name: "The classic trap",
      code: [
        "count = 0",
        "",
        "def add():",
        "    count = count + 1  # 'count =' makes count LOCAL",
        "",
        "add()  # UnboundLocalError!",
        "",
        "# fix: say 'global count' at the top of add()"
      ],
      steps: function (st) {
        var c;
        return [
          [0, function () { sc(st, 0).vars.count = 0; }, "A global " + b("count") + ".", { name: "count" }],
          [2, function () { sc(st, 0).vars.add = { fn: "add", home: 0 }; }, "Define add(). Before running it, Python scans it: there's a " + b("count =") + " inside, so count is " + b("local to add") + ", for the whole function.", { name: "add" }],
          [5, function () { c = open(st, "add() call", 0); sc(st, c).vars.count = { unset: true }; }, "Call add(). Its box already has a slot for a local count, but nothing's in it yet.", function () { return { box: c }; }],
          [3, function () { st.out.push("UnboundLocalError"); }, "count + 1 reads count... the " + b("local") + " one, which is empty. " + b("UnboundLocalError") + ". Python doesn't fall back to the global, because it decided count is local.", function () { return { look: { name: "count", checked: [c], found: c, bad: true } }; }],
          [7, function () { close(st, c, 0); sweep(st); }, "The fix: put " + b("global count") + " (or " + b("nonlocal") + " for an enclosing function) at the top, so the assignment means the outer one. Better still, pass it in and return it.", {}]
        ];
      }
    },
    closure: {
      name: "Closures remember",
      code: [
        "def make_counter():",
        "    count = 0",
        "    def tick():",
        "        nonlocal count  # the count in make_counter's box",
        "        count += 1",
        "        return count",
        "    return tick",
        "",
        "c = make_counter()",
        "print(c())  # 1",
        "print(c())  # 2"
      ],
      steps: function (st) {
        var m, t, L;
        function tick(line) {
          return [
            [line, function () { t = open(st, "tick() call", m); }, "Call c(), which is tick. Its new box's parent is the " + b("kept-alive") + " make_counter box.", function () { return { box: t }; }],
            [4, function () { L = lookup(st, "count", t); sc(st, m).vars.count += 1; }, function () { return "count += 1: not in tick's box, look outward: found in " + b("make_counter's box") + ". It's now " + b(sc(st, m).vars.count) + "."; }, function () { return { look: L }; }],
            [5, function () { st.out.push(String(sc(st, m).vars.count)); close(st, t, 0); }, function () { return "Returns " + b(sc(st, m).vars.count) + ". The count " + b("survived") + " between calls, living in the closure's box."; }, function () { return { box: t }; }]
          ];
        }
        return [
          [0, function () { sc(st, 0).vars.make_counter = { fn: "make_counter", home: 0 }; }, "Define make_counter.", { name: "make_counter" }],
          [8, function () { m = open(st, "make_counter() call", 0); }, "Call it: a new box.", function () { return { box: m }; }],
          [1, function () { sc(st, m).vars.count = 0; }, b("count = 0") + " in make_counter's box.", { name: "count" }],
          [2, function () { sc(st, m).vars.tick = { fn: "tick", home: m }; }, "Define tick " + b("inside") + " it. tick's home is this box.", { name: "tick" }],
          [6, function () { sc(st, 0).vars.c = { fn: "tick", home: m }; close(st, m, 0); },
            "make_counter returns tick, and c now refers to it. Normally the box would vanish now... but tick still needs it, so it's " + b("kept alive") + ". That's a " + b("closure") + ".", function () { return { box: m, name: "c" }; }]
        ].concat(tick(9)).concat([[9, function () { sweep(st); }, "Printed 1.", {}]]).concat(tick(10)).concat([[10, function () { sweep(st); }, "Printed 2. Same function, and it " + b("remembers") + ", without a single global variable.", {}]]);
      }
    }
  };

  /* ---------- sandbox: make counters and call them ---------- */

  var sand = blank();
  sand.scopes[0].vars.make_counter = { fn: "make_counter", home: 0 };
  var sandLines = ["def make_counter(): ...  # from the Closures tab"];

  function sandMake(r, nm) {
    var st = r.st;
    if (nm in sc(st, 0).vars) { r.snap(sandLines.length, b(nm) + " already exists. Call it, or Reset."); return; }
    var m = open(st, "make_counter() for " + nm, 0);
    sc(st, m).vars.count = 0;
    sc(st, m).vars.tick = { fn: "tick", home: m };
    r.snap(sandLines.length, "make_counter() runs: a new box with " + b("its own count = 0") + ".", { box: m });
    sc(st, 0).vars[nm] = { fn: "tick", home: m };
    close(st, m, 0);
    r.snap(sandLines.length, b(nm) + " holds a tick that remembers " + b("this") + " box. Every counter you make gets a separate one.", { box: m, name: nm });
  }
  function sandCall(r, nm) {
    var st = r.st, f = sc(st, 0).vars[nm];
    if (!f) { r.snap(sandLines.length, b("NameError") + ": make " + nm + " first."); return; }
    var t = open(st, "tick() call via " + nm, f.home);
    r.snap(sandLines.length, "Call " + nm + "(): a new tick box, parent = " + nm + "'s own make_counter box.", { box: t });
    var L = lookup(st, "count", t);
    sc(st, f.home).vars.count += 1;
    st.out.push(nm + "() = " + sc(st, f.home).vars.count);
    r.snap(sandLines.length, "Found count in " + b(sc(st, L.found).title) + " and added 1: " + b(sc(st, f.home).vars.count) + ". The other counters don't change.", { look: L });
    close(st, t, 0);
    sweep(st);
    r.snap(sandLines.length, nm + "() returned " + b(sc(st, f.home).vars.count) + ".", {});
  }

  /* ---------- drawing ---------- */

  var boxEl = $("#scopes"), outEl = $("#out");
  function depth(st, s) { var d = 0, p = s.parent; while (p != null) { d++; var ps = sc(st, p); p = ps ? ps.parent : null; } return d; }

  function boxesHtml(f) {
    var st = f.st, x = f.x, L = x.look;
    return st.scopes.map(function (s) {
      var checked = L && L.checked.indexOf(s.id) >= 0, found = L && L.found === s.id;
      var cls = "sc-box is-" + s.status + (x.box === s.id ? " is-focus" : "") + (checked ? " is-checked" : "") + (found ? (L.bad ? " is-bad" : " is-found") : "");
      var names = Object.keys(s.vars);
      var rows = names.length ? names.map(function (n) {
        var v = s.vars[n], hit = found && L.name === n, mine = x.name === n && x.box !== s.id && s.status === "active";
        var shown = v && v.fn ? "function " + v.fn + (v.home !== s.id ? ' <span class="sc-home">&rarr; remembers ' + esc((sc(st, v.home) || { title: "?" }).title) + "</span>" : "") : esc(show(v));
        return '<div class="sc-var' + (hit ? (L.bad ? " is-bad" : " is-hit") : "") + (mine || (x.name === n && s.status === "active") ? " is-new" : "") + '"><span>' + esc(n) + "</span><b>" + shown + "</b></div>";
      }).join("") : '<div class="sc-none">no names yet</div>';
      var tag = s.status === "kept" ? "call ended, kept alive by a closure" : s.status === "gone" ? "call ended: box removed" :
                s.status === "waiting" ? "waiting for a call it made" : s.id === 0 ? "always here" : "running";
      return '<div class="' + cls + '" style="margin-left:' + Math.min(4, depth(st, s)) * 1.1 + 'rem">' +
        '<div class="sc-head"><b>' + esc(s.title) + '</b><span>' + tag + "</span></div>" + rows + "</div>";
    }).join("");
  }

  function draw(f) {
    var st = f.st;
    boxEl.innerHTML = boxesHtml(f);
    outEl.innerHTML = '<span class="pf-ds-name">Printed</span>' + (st.out.length
      ? st.out.slice(-4).map(function (l) { return '<span class="av-box">' + esc(l) + "</span>"; }).join("")
      : '<span class="r-empty">nothing yet</span>');
  }

  /* ---------- page wiring ---------- */

  var say = $("#say");
  var code = AV.Code($("#code"), [], $("#now"));
  var current = /^#(local|outward|trap|closure|sandbox)$/.test(location.hash) ? location.hash.slice(1) : "local";

  function render(f) { draw(f); code.mark(f.line); say.innerHTML = f.msg; }
  var player = AV.Player($("#controls"), render, {
    keys: true, speed: 1,
    /* the boxes area is held at its tallest moment too, so a call's box
       appearing and vanishing doesn't push the buttons around */
    steady: [{ el: say, html: function (f) { return f.msg; } }, { el: boxEl, html: boxesHtml }]
  });
  AV.learn($("#learn"), "scope");

  function run(key) {
    var S = SCEN[key], r = Rec(blank());
    code.load(S.code);
    r.snap(-1, "Press play (or &rarr;) to run it a step at a time. Each " + b("box") + " is a scope: the names one call can see.");
    function v(z) { return typeof z === "function" ? z() : z; }
    S.steps(r.st).forEach(function (s) { s[1](); r.snap(s[0], v(s[2]), v(s[3])); });
    player.load(r.frames);
  }

  function sandDo(fn, line) {
    var r = Rec(sand);
    sandLines.push(line);
    if (sandLines.length > 10) { sandLines.splice(1, 1); }
    code.load(sandLines);
    fn(r);
    sand = clone(r.st);
    player.load(r.frames);
    if (!AV.calm) { player.play(); }
  }

  function openTab(key) {
    current = key;
    var isSand = key === "sandbox";
    $("#sand").hidden = !isSand;
    $("#scen-name").textContent = isSand ? "Sandbox: counters" : SCEN[key].name;
    if (isSand) {
      code.load(sandLines);
      var r = Rec(sand);
      r.snap(-1, "Make a couple of counters, then call them in any order. Each one keeps " + b("its own") + " count in its own box.");
      player.load(r.frames);
    } else {
      run(key);
    }
  }

  [["c1 = make_counter()", function (r) { sandMake(r, "c1"); }],
   ["c2 = make_counter()", function (r) { sandMake(r, "c2"); }],
   ["c1()", function (r) { sandCall(r, "c1"); }],
   ["c2()", function (r) { sandCall(r, "c2"); }]].forEach(function (op) {
    var btn = AV.el("button", "av-op", "<span>" + esc(op[0]) + "</span>");
    btn.type = "button";
    btn.addEventListener("click", function () { sandDo(op[1], op[0]); });
    $("#sand-ops").appendChild(btn);
  });
  $("#sand-reset").addEventListener("click", function () {
    sand = blank();
    sand.scopes[0].vars.make_counter = { fn: "make_counter", home: 0 };
    sandLines = ["def make_counter(): ...  # from the Closures tab"];
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
      q: "x = 1 at the top. Inside a function you write x = 2. After calling it, what's the global x?",
      opts: ["1", "2", "None", "An error"], a: 0,
      why: "Assigning inside a function makes a new local x in that call's box. The global one is untouched (unless you write <b>global x</b>)."
    },
    {
      q: "A nested function uses a name it doesn't define. Where does Python look next?",
      opts: ["Wherever it was called from", "The scope it was written inside, then outward to global", "Only global", "Nowhere: it's an error"], a: 1,
      why: "Scope follows where code is <b>written</b> (lexical scope): Local, Enclosing, Global, Built-in."
    },
    {
      q: "Why does make_counter's count survive after make_counter returns?",
      opts: ["Python never deletes variables", "The returned tick function still refers to that box, so it's kept alive", "count is global", "It doesn't survive"], a: 1,
      why: "That's a closure: a function plus the box of names it was born in."
    },
    {
      q: "c1 and c2 come from two calls to make_counter. You call c1() three times. What does c2() return?",
      opts: ["4", "1", "3", "0"], a: 1,
      why: "Each call to make_counter made a separate box with its own count. Try it in the <b>Sandbox</b>."
    }
  ], $("#quiz-score"));
})();
