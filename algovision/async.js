/* ============================================================
   AlgoVision - Async & the event loop

   A small, honest model of how a browser runs JavaScript:

     CALL STACK      what's running right now (only ever one thing)
     WEB APIS        timers, network requests and click listeners,
                     waiting outside JavaScript
     MICROTASKS      promise callbacks and await resumes - these go first
     TASK QUEUE      finished timers and clicks, oldest first
     EVENT LOOP      when the stack is empty: run ALL microtasks, then
                     ONE task, repeat. If nothing's ready, wait for time
                     to pass.

   A program is a list of statements:
     { t: "log", s, line }
     { t: "timeout", ms, cb, line }       cb = { label, body: [...] }
     { t: "then", cb, line }               Promise.resolve().then(cb)
     { t: "call", fn, body, line }         call an (async) function
     { t: "await", ms, what, line }        inside a call: pause until done
     { t: "listen", cb, clickAt, line }    click handler + a click at clickAt ms
     { t: "busy", ms, line }               a loop that hogs the stack
   ============================================================ */

(function () {
  "use strict";

  var $ = function (s) { return document.querySelector(s); };
  var esc = AV.esc;
  function b(v) { return "<b>" + v + "</b>"; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ---------- the simulator ---------- */

  function simulate(program) {
    var S = { clock: 0, stack: [], apis: [], micro: [], tasks: [], out: [], phase: "script" };
    var frames = [], nextApi = 1;
    function snap(line, msg, x) {
      frames.push({ s: clone(S), line: line, msg: msg, x: x || {} });
    }

    /* move anything whose time has come into its queue */
    function settle(note) {
      S.apis.sort(function (a, z) { return a.end - z.end; });
      var moved = [];
      while (S.apis.length && S.apis[0].end <= S.clock) {
        var a = S.apis.shift();
        (a.kind === "net" ? S.micro : S.tasks).push(a.job);
        moved.push(a);
      }
      return moved;
    }

    function run(body, name) {
      for (var i = 0; i < body.length; i++) {
        var st = body[i];
        if (st.t === "log") {
          S.stack.push("console.log(\"" + st.s + "\")");
          S.out.push(st.s);
          snap(st.line, st.say || "Prints " + b(esc(st.s)) + ". console.log runs right away, on the stack.", { hot: "out" });
          S.stack.pop();
        } else if (st.t === "timeout") {
          S.stack.push("setTimeout(..., " + st.ms + ")");
          S.apis.push({ id: nextApi++, kind: "timer", label: "timer " + st.ms + " ms", start: S.clock, end: S.clock + st.ms, job: st.cb });
          snap(st.line, st.say || "setTimeout hands the callback to the browser's " + b("timer") + " and returns " + b("immediately") +
            ". JavaScript doesn't wait for it.", { hot: "apis" });
          S.stack.pop();
        } else if (st.t === "then") {
          S.stack.push("Promise.then(...)");
          S.micro.push(st.cb);
          snap(st.line, st.say || "The promise is already resolved, so its callback goes straight into the " + b("microtask queue") +
            ". It still won't run until the stack is empty.", { hot: "micro" });
          S.stack.pop();
        } else if (st.t === "call") {
          S.stack.push(st.fn + "()");
          snap(st.line, st.say || "Call " + b(st.fn + "()") + ". It goes on top of the call stack.", { hot: "stack" });
          var paused = run(st.body, st.fn);
          S.stack.pop();
          if (paused) {
            snap(st.line, b(st.fn + "()") + " is paused at the await, so it's " + b("off the stack") + " for now. The rest of the script carries on.", { hot: "stack" });
          }
        } else if (st.t === "await") {
          S.stack.push(st.what);
          S.apis.push({ id: nextApi++, kind: "net", label: st.what, start: S.clock, end: S.clock + st.ms,
            job: { label: name + "() resumes", body: body.slice(i + 1), resume: true } });
          snap(st.line, st.say || b("await") + " starts " + esc(st.what) + " in the background and " + b("pauses this function") +
            ". It doesn't freeze the page: the function just steps aside until the answer comes back.", { hot: "apis" });
          S.stack.pop();
          return true;
        } else if (st.t === "listen") {
          S.stack.push("addEventListener");
          S.apis.push({ id: nextApi++, kind: "click", label: "click listener (you click at " + st.clickAt + " ms)", start: S.clock, end: S.clock + st.clickAt, job: st.cb });
          snap(st.line, st.say || "Register a click handler. The browser watches the button for us.", { hot: "apis" });
          S.stack.pop();
        } else if (st.t === "busy") {
          S.stack.push("while (busy " + st.ms + " ms)");
          snap(st.line, "A loop that hogs the stack for " + b(st.ms + " ms") + ". While it runs, " + b("nothing else can"), { hot: "stack" });
          S.clock += st.ms;
          var moved = settle();
          snap(st.line, "Still busy... " + (moved.length
            ? b(moved.map(function (m) { return m.kind === "click" ? "your click" : m.label; }).join(", ")) +
              " happened during the loop, but it's " + b("stuck in the queue") + ". The page feels frozen."
            : "t = " + S.clock + " ms."), { hot: "tasks" });
          S.stack.pop();
        }
      }
      return false;
    }

    S.stack.push("script");
    snap(-1, "The whole script goes on the call stack first and runs " + b("top to bottom") + ".", { hot: "stack" });
    run(program, "script");
    S.stack.pop();
    S.phase = "loop";
    snap(-1, "The script is done and the " + b("call stack is empty") + ". Now the " + b("event loop") + " takes over.", { hot: "loop" });

    var guard = 0;
    while (guard++ < 200) {
      if (S.micro.length) {
        S.phase = "micro";
        var m = S.micro.shift();
        S.stack.push(m.label);
        snap(m.line != null ? m.line : -1, "Stack empty, so the loop runs " + b("microtasks first") + ": " + b(esc(m.label)) + ".", { hot: "stack" });
        run(m.body, m.label.replace(/\(\) resumes$/, ""));
        S.stack.pop();
      } else if (S.tasks.length) {
        S.phase = "task";
        var t = S.tasks.shift();
        S.stack.push(t.label);
        snap(t.line != null ? t.line : -1, "No microtasks waiting, so take the " + b("oldest task") + ": " + b(esc(t.label)) + ".", { hot: "stack" });
        run(t.body, t.label);
        S.stack.pop();
      } else if (S.apis.length) {
        S.phase = "wait";
        S.apis.sort(function (a, z) { return a.end - z.end; });
        var nxt = S.apis[0], before = S.clock;
        S.clock = Math.max(S.clock, nxt.end);
        var moved = settle();
        snap(-1, "Nothing to run, so the loop " + b("waits") + ". " + (S.clock > before ? "Time passes to t = " + S.clock + " ms. " : "") +
          moved.map(function (a) {
            return a.kind === "net" ? esc(a.label) + " came back: its function's resume goes in the " + b("microtask queue") + "."
                 : a.kind === "click" ? "You click! The handler joins the " + b("task queue") + "."
                 : "The " + esc(a.label) + " finished: its callback joins the " + b("task queue") + ".";
          }).join(" "), { hot: moved.length && moved[0].kind === "net" ? "micro" : "tasks" });
      } else {
        break;
      }
    }
    S.phase = "done";
    snap(-1, "Everything has run. Output order: " + b(esc(S.out.join(", "))) + ". The code order was top to bottom, but " +
      b("when") + " each line ran depended on the queues.", { hot: "out" });
    return frames;
  }

  /* ---------- scenarios ---------- */

  function cb(label, body, line) { return { label: label, body: body, line: line }; }
  function log(s, line, say) { return { t: "log", s: s, line: line, say: say }; }

  var SCEN = {
    zero: {
      name: "setTimeout(..., 0)",
      code: [
        "console.log(\"A\");",
        "setTimeout(() => {",
        "  console.log(\"B\");",
        "}, 0);",
        "console.log(\"C\");"
      ],
      program: function () { return [
        log("A", 0),
        { t: "timeout", ms: 0, line: 1, cb: cb("timeout callback", [log("B", 2)], 1),
          say: "A 0 ms timer... but the callback still goes to the browser, not the stack. " + b("0 ms means \"as soon as you're free\"") + ", not \"now\"." },
        log("C", 4)
      ]; }
    },
    promise: {
      name: "Promises jump the queue",
      code: [
        "console.log(\"1\");",
        "setTimeout(() => console.log(\"timeout\"), 0);",
        "Promise.resolve().then(() => console.log(\"promise\"));",
        "console.log(\"2\");"
      ],
      program: function () { return [
        log("1", 0),
        { t: "timeout", ms: 0, line: 1, cb: cb("timeout callback", [log("timeout", 1)], 1) },
        { t: "then", line: 2, cb: cb("promise callback", [log("promise", 2)], 2) },
        log("2", 3)
      ]; }
    },
    delays: {
      name: "Timers with delays",
      code: [
        "setTimeout(() => console.log(\"slow\"), 1000);",
        "setTimeout(() => console.log(\"fast\"), 100);",
        "console.log(\"go\");"
      ],
      program: function () { return [
        { t: "timeout", ms: 1000, line: 0, cb: cb("slow callback", [log("slow", 0)], 0) },
        { t: "timeout", ms: 100, line: 1, cb: cb("fast callback", [log("fast", 1)], 1) },
        log("go", 2)
      ]; }
    },
    await: {
      name: "async / await",
      code: [
        "async function load() {",
        "  console.log(\"start load\");",
        "  await fetch(\"/data\");  // pauses load, not the page",
        "  console.log(\"got data\");",
        "}",
        "load();",
        "console.log(\"page still works\");"
      ],
      program: function () { return [
        { t: "call", fn: "load", line: 5, body: [log("start load", 1), { t: "await", ms: 300, what: "fetch(\"/data\")", line: 2 }, log("got data", 3)] },
        log("page still works", 6)
      ]; }
    },
    block: {
      name: "Blocking the loop",
      code: [
        "button.onclick = () => console.log(\"clicked!\");",
        "// ...you click the button at t = 500 ms",
        "const start = Date.now();",
        "while (Date.now() - start < 3000) {}  // busy 3 s",
        "console.log(\"done\");"
      ],
      program: function () { return [
        { t: "listen", line: 0, clickAt: 500, cb: cb("click handler", [log("clicked!", 0)], 0) },
        { t: "busy", ms: 3000, line: 3 },
        log("done", 4, "Prints " + b("done") + ", 3 seconds late. Only now is the stack free for your click.")
      ]; }
    }
  };

  /* ---------- sandbox ---------- */

  var sand = { stmts: [], letter: 0 };
  var SAND = {
    log:    { label: "console.log(x)" },
    t0:     { label: "setTimeout(log, 0)" },
    t500:   { label: "setTimeout(log, 500)" },
    then:   { label: "Promise.then(log)" },
    busy:   { label: "busy loop 1 s" }
  };
  function nextLetter() { return String.fromCharCode(65 + (sand.letter++ % 26)); }
  function sandAdd(k) {
    if (sand.stmts.length >= 8) { return; }
    var L, s;
    if (k === "log") { L = nextLetter(); s = { kind: k, L: L, text: "console.log(\"" + L + "\");" }; }
    if (k === "t0") { L = nextLetter(); s = { kind: k, L: L, text: "setTimeout(() => console.log(\"" + L + "\"), 0);" }; }
    if (k === "t500") { L = nextLetter(); s = { kind: k, L: L, text: "setTimeout(() => console.log(\"" + L + "\"), 500);" }; }
    if (k === "then") { L = nextLetter(); s = { kind: k, L: L, text: "Promise.resolve().then(() => console.log(\"" + L + "\"));" }; }
    if (k === "busy") { s = { kind: k, text: "while (busy) {}  // hog the stack for 1 s" }; }
    sand.stmts.push(s);
  }
  function sandProgram() {
    return sand.stmts.map(function (s, i) {
      if (s.kind === "log") { return log(s.L, i); }
      if (s.kind === "t0") { return { t: "timeout", ms: 0, line: i, cb: cb("callback " + s.L, [log(s.L, i)], i) }; }
      if (s.kind === "t500") { return { t: "timeout", ms: 500, line: i, cb: cb("callback " + s.L, [log(s.L, i)], i) }; }
      if (s.kind === "then") { return { t: "then", line: i, cb: cb("promise " + s.L, [log(s.L, i)], i) }; }
      return { t: "busy", ms: 1000, line: i };
    });
  }

  /* ---------- drawing ---------- */

  var PH = { script: "running the script", loop: "stack empty: checking the queues", micro: "running a microtask", task: "running a task", wait: "waiting for time to pass", done: "nothing left to do" };

  function draw(f) {
    var s = f.s, x = f.x;
    function hot(k) { return x.hot === k ? " is-hot" : ""; }
    $("#q-stack").className = "ev-panel" + hot("stack");
    $("#q-stack .ev-body").innerHTML = s.stack.length
      ? s.stack.slice().reverse().map(function (n, k) { return '<div class="ev-item' + (k === 0 ? " is-top" : "") + '">' + esc(n) + "</div>"; }).join("")
      : '<p class="r-empty">empty</p>';
    $("#q-apis").className = "ev-panel" + hot("apis");
    $("#q-apis .ev-body").innerHTML = s.apis.length
      ? s.apis.map(function (a) {
          var total = Math.max(1, a.end - a.start), left = Math.max(0, a.end - s.clock), pct = Math.round((1 - left / total) * 100);
          return '<div class="ev-api is-' + a.kind + '"><span>' + esc(a.label) + '</span><span class="ev-left">' + left + ' ms left</span>' +
            '<div class="ev-track"><div style="width:' + pct + '%"></div></div></div>';
        }).join("")
      : '<p class="r-empty">nothing waiting</p>';
    function queue(id, list, key) {
      $(id).className = "ev-panel" + hot(key);
      $(id + " .ev-body").innerHTML = list.length
        ? list.map(function (j, k) { return '<span class="av-box' + (k === 0 ? " is-next" : "") + '">' + esc(j.label) + "</span>"; }).join("")
        : '<p class="r-empty">empty</p>';
    }
    queue("#q-micro", s.micro, "micro");
    queue("#q-tasks", s.tasks, "tasks");
    $("#q-out").className = "ev-panel" + hot("out");
    $("#q-out .ev-body").innerHTML = s.out.length
      ? s.out.map(function (o) { return "<div>&gt; " + esc(o) + "</div>"; }).join("")
      : '<p class="r-empty">nothing printed yet</p>';
    $("#ev-clock").textContent = "t = " + s.clock + " ms";
    $("#ev-loop").className = "ev-loop is-" + s.phase + (x.hot === "loop" ? " is-hot" : "");
    $("#ev-phase").textContent = PH[s.phase] || "";
  }

  /* ---------- page wiring ---------- */

  var say = $("#say");
  var code = AV.Code($("#code"), [], $("#now"), { lang: "js" });
  var current = /^#(zero|promise|delays|await|block|sandbox)$/.test(location.hash) ? location.hash.slice(1) : "zero";

  function render(f) { draw(f); code.mark(f.line); say.innerHTML = f.msg; }
  var player = AV.Player($("#controls"), render, {
    keys: true, speed: 1,
    steady: [{ el: say, html: function (f) { return f.msg; } }]
  });
  AV.learn($("#learn"), "async");

  function load(key) {
    current = key;
    var isSand = key === "sandbox";
    $("#sand").hidden = !isSand;
    $("#scen-name").textContent = isSand ? "Sandbox" : SCEN[key].name;
    if (isSand) {
      code.load(sand.stmts.length ? sand.stmts.map(function (s) { return s.text; }) : ["// press the buttons to write a program"]);
      player.load(sand.stmts.length ? simulate(sandProgram())
        : [{ s: { clock: 0, stack: [], apis: [], micro: [], tasks: [], out: [], phase: "script" }, line: -1, msg: "Add a few lines with the buttons, guess the output order, then press play.", x: {} }]);
    } else {
      code.load(SCEN[key].code);
      player.load(simulate(SCEN[key].program()));
    }
  }

  var sandOps = $("#sand-ops");
  Object.keys(SAND).forEach(function (k) {
    var btn = AV.el("button", "av-op", "<span>" + esc(SAND[k].label) + "</span>");
    btn.type = "button";
    btn.addEventListener("click", function () { sandAdd(k); load("sandbox"); });
    sandOps.appendChild(btn);
  });
  $("#sand-reset").addEventListener("click", function () { sand = { stmts: [], letter: 0 }; load("sandbox"); });
  $("#sand-example").addEventListener("click", function () {
    sand = { stmts: [], letter: 0 };
    ["log", "t500", "t0", "then", "busy", "log"].forEach(sandAdd);
    load("sandbox");
  });

  document.querySelectorAll("#scens [data-pick]").forEach(function (p) {
    p.setAttribute("aria-pressed", p.getAttribute("data-pick") === current ? "true" : "false");
  });
  AV.pills($("#scens"), function (k) {
    try { history.replaceState(null, "", "#" + k); } catch (e) { /* file:// */ }
    load(k);
  });
  load(current);

  AV.quiz($("#quiz"), [
    {
      q: "What does this print?",
      code: ["console.log(\"A\");", "setTimeout(() => console.log(\"B\"), 0);", "console.log(\"C\");"],
      opts: ["A B C", "A C B", "B A C", "C A B"], a: 1,
      why: "The timer callback has to wait for the stack to be empty, even with 0 ms. So A, C, then B."
    },
    {
      q: "A setTimeout(0) and a Promise.then are both waiting. Which runs first?",
      opts: ["The timeout", "The promise", "Whichever was written first", "Random"], a: 1,
      why: "When the stack empties, the loop drains <b>all microtasks</b> (promises, await) before taking a single task (timers, clicks)."
    },
    {
      q: "Why does a long while loop freeze the page?",
      opts: ["It uses too much memory", "JavaScript runs one thing at a time, and the loop never lets the stack empty", "Browsers ban loops", "It doesn't"], a: 1,
      why: "Clicks, timers and repaints all wait in queues for an empty stack. Try <b>Blocking the loop</b>: your click at 500 ms runs after 3 seconds."
    },
    {
      q: "What does await actually do?",
      opts: ["Freezes the whole page until the data arrives", "Pauses just this function and lets everything else carry on", "Runs the request on another JavaScript thread", "Makes the code synchronous"], a: 1,
      why: "The function steps off the stack. When the result arrives, its resume goes into the microtask queue."
    }
  ], $("#quiz-score"));
})();
