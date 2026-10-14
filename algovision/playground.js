/* ============================================================
   AlgoVision - Code playground

   Real Python (Pyodide: CPython compiled to WebAssembly, loaded
   from jsDelivr the first time you press Run). The code runs ONCE
   under sys.settrace, which hands us every line, call and return.
   Each one becomes a frame:
     { ev: "line"|"call"|"return"|"end", line, out,
       stack: [{ name, vars: [[name, value]] }]  (global first),
       ret: value }
   A value is plain JSON describing what the Python value looks
   like (see val() in TRACER), so the Player can step back and
   forth through it like any other module.
   ============================================================ */

(function () {
  "use strict";

  var $ = function (s) { return document.querySelector(s); };
  var esc = AV.esc;
  function b(v) { return "<b>" + v + "</b>"; }

  var PYODIDE = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";
  var LIMIT = 600;                         /* steps before we assume a loop never ends */
  var SAVE = "algovision-playground";

  /* ---------- the Python side: run the code and record it ---------- */

  var TRACER = [
    "import sys, io, json, types, builtins",
    "",
    "class _AvStop(BaseException):",
    "    pass",
    "",
    "def _av_run(src, limit):",
    "    frames, out, ids, keep = [], io.StringIO(), {}, []",
    "",
    "    def ref(v):",
    "        if id(v) not in ids:",
    "            ids[id(v)] = len(ids) + 1",
    "            keep.append(v)",
    "        return ids[id(v)]",
    "",
    "    def short(r):",
    "        return r if len(r) <= 40 else r[:37] + '...'",
    "",
    "    def val(v, depth=0):",
    "        if v is None or isinstance(v, (bool, int, float, complex, str)):",
    "            return {'t': 'p', 'r': short(repr(v))}",
    "        if isinstance(v, (types.FunctionType, types.BuiltinFunctionType, types.MethodType)):",
    "            return {'t': 'f', 'r': getattr(v, '__name__', 'function')}",
    "        if isinstance(v, type):",
    "            return {'t': 'c', 'r': v.__name__}",
    "        if isinstance(v, types.ModuleType):",
    "            return {'t': 'f', 'r': 'module ' + v.__name__}",
    "        if depth > 2:",
    "            return {'t': 'p', 'r': '...'}",
    "        if isinstance(v, (list, tuple, set, frozenset)):",
    "            items = list(v)",
    "            if isinstance(v, (set, frozenset)):",
    "                try:",
    "                    items = sorted(items)",
    "                except Exception:",
    "                    pass",
    "            return {'t': 'l', 'k': type(v).__name__, 'id': ref(v), 'n': len(items),",
    "                    'items': [val(x, depth + 1) for x in items[:12]]}",
    "        if isinstance(v, dict):",
    "            its = list(v.items())",
    "            return {'t': 'd', 'id': ref(v), 'n': len(its),",
    "                    'items': [[short(repr(k)), val(x, depth + 1)] for k, x in its[:10]]}",
    "        if hasattr(v, '__dict__'):",
    "            its = [(k, x) for k, x in vars(v).items() if not k.startswith('__')]",
    "            return {'t': 'o', 'k': type(v).__name__, 'id': ref(v),",
    "                    'items': [[k, val(x, depth + 1)] for k, x in its[:10]]}",
    "        return {'t': 'p', 'r': short(repr(v))}",
    "",
    "    def scope(f):",
    "        return [[k, val(x)] for k, x in list(f.f_locals.items())",
    "                if not k.startswith('__') and not isinstance(x, types.ModuleType)]",
    "",
    "    def stack(f):",
    "        boxes = []",
    "        while f is not None and f.f_code.co_filename == '<playground>':",
    "            name = f.f_code.co_name",
    "            boxes.append({'name': 'Global' if name == '<module>' else name, 'vars': scope(f)})",
    "            f = f.f_back",
    "        boxes.reverse()",
    "        return boxes",
    "",
    "    def rec(f, ev, arg):",
    "        if len(frames) >= limit:",
    "            raise _AvStop()",
    "        fr = {'ev': ev, 'line': f.f_lineno, 'stack': stack(f), 'out': out.getvalue()[-4000:]}",
    "        if ev == 'return':",
    "            fr['ret'] = val(arg)",
    "        frames.append(fr)",
    "",
    "    def is_class_body(f):",
    "        return '__module__' in f.f_locals and f.f_locals.get('__qualname__') == f.f_code.co_qualname",
    "",
    "    def ltrace(f, ev, arg):",
    "        if ev == 'line' or (ev == 'return' and f.f_code.co_name != '<module>'):",
    "            rec(f, ev, arg)",
    "        return ltrace",
    "",
    "    def gtrace(f, ev, arg):",
    "        if f.f_code.co_filename != '<playground>' or is_class_body(f):",
    "            return None",
    "        if f.f_code.co_name != '<module>':",
    "            rec(f, 'call', arg)",
    "        return ltrace",
    "",
    "    def no_input(*a):",
    "        raise RuntimeError(\"input() can't pause here. Put the value in your code instead, like name = 'Ada'\")",
    "",
    "    ns = {'__name__': '__main__', '__builtins__': dict(vars(builtins), input=no_input)}",
    "    try:",
    "        code = compile(src, '<playground>', 'exec')",
    "    except SyntaxError as e:",
    "        return json.dumps({'frames': [], 'err': 'SyntaxError: ' + str(e.msg), 'errline': e.lineno})",
    "    err, errline, old = None, None, sys.stdout",
    "    sys.stdout = out",
    "    sys.settrace(gtrace)",
    "    try:",
    "        exec(code, ns)",
    "    except _AvStop:",
    "        err = 'stop'",
    "    except Exception as e:",
    "        tb = e.__traceback__",
    "        while tb is not None:",
    "            if tb.tb_frame.f_code.co_filename == '<playground>':",
    "                errline = tb.tb_lineno",
    "            tb = tb.tb_next",
    "        err = type(e).__name__ + ': ' + str(e)",
    "    finally:",
    "        sys.settrace(None)",
    "        sys.stdout = old",
    "    glob = [[k, val(x)] for k, x in ns.items() if not k.startswith('__') and not isinstance(x, types.ModuleType)]",
    "    frames.append({'ev': 'end', 'line': errline or 0, 'stack': [{'name': 'Global', 'vars': glob}], 'out': out.getvalue()[-4000:]})",
    "    return json.dumps({'frames': frames, 'err': err, 'errline': errline})"
  ].join("\n");

  var pyReady = null;
  function python() {
    if (!pyReady) {
      pyReady = new Promise(function (ok, fail) {
        var s = document.createElement("script");
        s.src = PYODIDE + "pyodide.js";
        s.onload = function () {
          window.loadPyodide({ indexURL: PYODIDE }).then(function (py) { py.runPython(TRACER); ok(py); }, fail);
        };
        s.onerror = function () { fail(new Error("network")); };
        document.head.appendChild(s);
      });
      pyReady.catch(function () { pyReady = null; });   /* let the next Run try again */
    }
    return pyReady;
  }

  /* ---------- examples ---------- */

  var EXAMPLES = [
    ["Variables", ["x = 5", "y = x * 2", "x = x + 1          # y doesn't change!", "name = \"Ada\"", "greeting = \"Hi \" + name", "print(greeting, x, y)"]],
    ["Loop & total", ["total = 0", "for i in range(1, 5):", "    total = total + i", "    print(\"i =\", i, \"total =\", total)", "print(\"done:\", total)"]],
    ["Lists are shared", ["a = [1, 2, 3]", "b = a          # the same list, a second name", "c = a[:]       # a brand new copy", "b.append(4)", "print(a, b, c)"]],
    ["Bubble sort", ["nums = [5, 2, 4, 1]", "for end in range(len(nums) - 1, 0, -1):", "    for i in range(end):", "        if nums[i] > nums[i + 1]:",
      "            nums[i], nums[i + 1] = nums[i + 1], nums[i]", "print(nums)"]],
    ["Recursion", ["def fact(n):", "    if n <= 1:", "        return 1", "    return n * fact(n - 1)", "", "print(fact(4))"]],
    ["Dictionary", ["words = [\"cat\", \"dog\", \"cat\", \"owl\", \"cat\"]", "counts = {}", "for w in words:", "    counts[w] = counts.get(w, 0) + 1", "print(counts)"]],
    ["Class", ["class Dog:", "    def __init__(self, name):", "        self.name = name", "        self.tricks = []", "", "    def learn(self, trick):", "        self.tricks.append(trick)", "",
      "rex = Dog(\"Rex\")", "rex.learn(\"sit\")", "rex.learn(\"roll over\")", "print(rex.name, \"knows\", rex.tricks)"]],
    ["Closure", ["def make_counter():", "    count = 0", "    def step():", "        nonlocal count", "        count += 1", "        return count", "    return step", "",
      "c = make_counter()", "print(c(), c(), c())"]],
    ["Find the bug", ["scores = [90, 72, 85]", "total = 0", "for i in range(len(scores) + 1):", "    total += scores[i]", "print(total / len(scores))"]]
  ];

  var CHALLENGES = [
    { title: "Fix the bug", text: "It should print the average score. Something goes one step too far...",
      code: EXAMPLES[8][1], want: "82.33333333333333" },
    { title: "Add up the evens", text: "Print the total of only the even numbers. Hint: n % 2 == 0.",
      code: ["nums = [3, 8, 5, 6, 10, 1]", "total = 0", "# add up only the even numbers", "print(total)"], want: "24" },
    { title: "Reverse a list", text: "Fill in reverse() without using [::-1] or .reverse(). Hint: insert(0, x) or loop backwards.",
      code: ["def reverse(items):", "    result = []", "    # your code here", "    return result", "", "print(reverse([1, 2, 3, 4]))"], want: "[4, 3, 2, 1]" },
    { title: "Count the letters", text: "Print how many times each letter appears, as a dict.",
      code: ["word = \"banana\"", "counts = {}", "# loop over the letters and count them", "print(counts)"], want: "{'b': 1, 'a': 3, 'n': 2}" },
    { title: "FizzBuzz", text: "1 to 15. Multiples of 3 print Fizz, of 5 print Buzz, of both print FizzBuzz.",
      code: ["for n in range(1, 16):", "    # print Fizz, Buzz, FizzBuzz or n", "    print(n)"],
      want: "1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz" },
    { title: "Biggest first", text: "Change bubble sort so it sorts from biggest to smallest.",
      code: EXAMPLES[3][1], want: "[5, 4, 2, 1]" }
  ];

  /* ---------- the editor ---------- */

  var editor = $("#editor"), gutter = $("#gutter"), view = $("#code"), editWrap = $("#edit-wrap");
  var code = AV.Code(view, []);
  var challenge = -1;                      /* which challenge the editor holds, if any */

  function lines() { return editor.value.replace(/\r/g, "").split("\n"); }
  function numbers() {
    var n = lines().length, h = "";
    for (var i = 1; i <= n; i++) { h += i + "\n"; }
    gutter.textContent = h;
    gutter.scrollTop = editor.scrollTop;
  }
  function save() { try { localStorage.setItem(SAVE, editor.value); } catch (e) { /* private window */ } }
  function setCode(src, ch) {
    editor.value = src;
    challenge = ch == null ? -1 : ch;
    editMode();
    numbers();
    save();
  }
  editor.addEventListener("input", function () { numbers(); save(); });
  editor.addEventListener("scroll", function () { gutter.scrollTop = editor.scrollTop; });
  /* Tab indents; Enter keeps the indent (and adds one after a colon) */
  editor.addEventListener("keydown", function (e) {
    var s = editor.selectionStart, v = editor.value;
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      editor.setRangeText("    ", s, editor.selectionEnd, "end");
      numbers(); save();
    } else if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      var start = v.lastIndexOf("\n", s - 1) + 1, cur = v.slice(start, s);
      var ind = (cur.match(/^\s*/) || [""])[0];
      if (/:\s*(#.*)?$/.test(cur)) { ind += "    "; }
      e.preventDefault();
      editor.setRangeText("\n" + ind, s, editor.selectionEnd, "end");
      numbers(); save();
    } else if ((e.key === "Enter") && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      runIt();
    }
  });

  function editMode() {
    player.pause();
    editWrap.hidden = false;
    view.hidden = true;
    $("#edit").hidden = true;
    $("#mode-title").textContent = "Your code (Python) - edit me";
  }
  function viewMode() {
    code.load(lines());
    editWrap.hidden = true;
    view.hidden = false;
    $("#edit").hidden = false;
    $("#mode-title").textContent = "Stepping through your code";
  }
  $("#edit").addEventListener("click", function () { editMode(); editor.focus(); });

  /* ---------- drawing values and the stack ---------- */

  function show(v) {
    if (!v) { return ""; }
    if (v.t === "p") { return '<span class="pg-p">' + esc(v.r) + "</span>"; }
    if (v.t === "f") { return '<span class="pg-f">' + (/^module /.test(v.r) ? esc(v.r) : "function " + esc(v.r)) + "</span>"; }
    if (v.t === "c") { return '<span class="pg-f">class ' + esc(v.r) + "</span>"; }
    var tag = '<span class="pg-ref">#' + v.id + "</span>";
    if (v.t === "l") {
      var open = { list: "[", tuple: "(", set: "{", frozenset: "{" }[v.k] || "[";
      return '<span class="pg-list">' + tag + '<span class="pg-k">' + v.k + "</span>" +
        (v.items.length ? v.items.map(function (x, i) {
          return '<span class="pg-cell"><span>' + show(x) + "</span>" + (v.k === "list" || v.k === "tuple" ? "<small>" + i + "</small>" : "") + "</span>";
        }).join("") : '<span class="pg-empty">' + open + " " + { "[": "]", "(": ")", "{": "}" }[open] + " empty</span>") +
        (v.n > v.items.length ? '<span class="pg-more">+' + (v.n - v.items.length) + " more</span>" : "") + "</span>";
    }
    if (v.t === "d") {
      return '<span class="pg-list">' + tag + '<span class="pg-k">dict</span>' +
        (v.items.length ? v.items.map(function (p) { return '<span class="pg-pair"><span class="pg-p">' + esc(p[0]) + "</span>: " + show(p[1]) + "</span>"; }).join("")
          : '<span class="pg-empty">{empty}</span>') +
        (v.n > v.items.length ? '<span class="pg-more">+' + (v.n - v.items.length) + " more</span>" : "") + "</span>";
    }
    if (v.t === "o") {
      return '<span class="pg-obj"><span class="pg-obj-head">' + tag + ' <span class="pg-k">' + esc(v.k) + " object</span></span>" +
        (v.items.length ? v.items.map(function (p) { return '<span class="pg-attr"><i>.' + esc(p[0]) + "</i> " + show(p[1]) + "</span>"; }).join("")
          : '<span class="pg-empty">no attributes yet</span>') + "</span>";
    }
    return "";
  }

  /* a value in a few words, for sentences */
  function brief(v) {
    if (!v) { return "None"; }
    if (v.t === "p") { return v.r; }
    if (v.t === "f") { return "function " + v.r; }
    if (v.t === "c") { return "class " + v.r; }
    return (v.t === "o" ? v.k : v.t === "d" ? "dict" : v.k) + " #" + v.id;
  }

  function key(stack, i) { return i + ":" + stack[i].name; }
  function changed(f, prev) {
    var was = {}, out = {};
    if (prev) {
      prev.stack.forEach(function (box, i) { box.vars.forEach(function (p) { was[key(prev.stack, i) + ":" + p[0]] = JSON.stringify(p[1]); }); });
    }
    f.stack.forEach(function (box, i) {
      box.vars.forEach(function (p) {
        var k = key(f.stack, i) + ":" + p[0];
        if (prev && was[k] !== JSON.stringify(p[1]) && !(f.ev === "call" && i === f.stack.length - 1)) { out[k] = 1; }
      });
    });
    return out;
  }

  function stackHtml(f, prev) {
    if (!f.stack.length) { return '<p class="r-empty">Nothing yet. Pick an example or write some code, then press Run.</p>'; }
    var ch = changed(f, prev), top = f.stack.length - 1;
    return f.stack.map(function (box, i) {
      var rows = box.vars.length ? box.vars.map(function (p) {
        return '<div class="pg-var' + (ch[key(f.stack, i) + ":" + p[0]] ? " is-write" : "") + '"><span class="pg-name">' + esc(p[0]) + "</span>" + show(p[1]) + "</div>";
      }).join("") : '<p class="pg-none">no variables yet</p>';
      return '<div class="pg-box' + (i === top && f.ev !== "end" ? " is-top" : "") + '"><p class="pg-box-name">' +
        (box.name === "Global" ? "Global" : esc(box.name) + "()") +
        (i === top && f.ev !== "end" ? ' <span class="pg-run">&#9650; running</span>' : "") +
        (f.ev === "return" && i === top ? ' <span class="pg-ret">returns ' + show(f.ret) + "</span>" : "") +
        "</p>" + rows + "</div>";
    }).reverse().join("");
  }

  /* what happened, in words */
  function message(f, prev, run) {
    var top = f.stack[f.stack.length - 1], parts = [];
    var newOut = prev && f.out.length > prev.out.length ? f.out.slice(prev.out.length).replace(/\n$/, "") : "";
    if (f.ev === "end") {
      if (run.err === "stop") { return "Stopped after " + b(LIMIT + " steps") + ". Is there a loop that never ends? (Check the loop's condition changes.)"; }
      if (run.err) { return '<span class="pg-err">' + esc(run.err) + "</span>" + (run.errline ? " on " + b("line " + run.errline) + "." : ""); }
      return "Finished in " + b(run.frames.length - 1 + " steps") + ". Scrub back to any moment, or edit the code and run it again.";
    }
    if (f.ev === "call") {
      var args = top.vars.map(function (p) { return p[0] + "=" + brief(p[1]); }).join(", ");
      parts.push("Call " + b(esc(top.name) + "(" + esc(args) + ")") + ". It gets a fresh box for its own variables, on top of the stack.");
    } else if (f.ev === "return") {
      parts.push(b(esc(top.name)) + " returns " + b(esc(brief(f.ret))) + ". Its box is about to come off the stack.");
    } else {
      var ch = Object.keys(changed(f, prev)).map(function (k) {
        var bits = k.split(":"), box = f.stack[+bits[0]], name = bits.slice(2).join(":");
        var p = box.vars.filter(function (q) { return q[0] === name; })[0];
        return b(esc(name)) + (p && p[1].t === "p" ? " = " + esc(p[1].r) : " changed");
      });
      if (ch.length) { parts.push("That set " + ch.slice(0, 4).join(", ") + (ch.length > 4 ? " and more" : "") + "."); }
      parts.push("Next up: " + b("line " + f.line) + ".");
    }
    if (newOut) { parts.push("Printed " + b(esc(newOut.length > 50 ? newOut.slice(0, 47) + "..." : newOut)) + "."); }
    return parts.join(" ");
  }

  /* ---------- the player ---------- */

  var say = $("#say"), stackEl = $("#stack"), outEl = $("#out"), RUN = null;

  function render(f, i, all) {
    var prev = i ? all[i - 1] : null;
    stackEl.innerHTML = stackHtml(f, prev);
    outEl.textContent = f.out;
    outEl.scrollTop = outEl.scrollHeight;
    say.innerHTML = f.msg;
    code.mark(f.line ? f.line - 1 : -1);
    view.querySelectorAll(".ln.is-err").forEach(function (x) { x.classList.remove("is-err"); });
    if (f.ev === "end" && RUN && RUN.err && RUN.errline) { view.querySelectorAll(".ln")[RUN.errline - 1].classList.add("is-err"); }
    $("#s-line").textContent = f.ev === "end" ? (RUN && RUN.err && RUN.err !== "stop" ? "error" : "done") : f.line;
    $("#s-depth").textContent = Math.max(0, f.stack.length - 1);
    $("#s-out").textContent = f.out ? f.out.replace(/\n$/, "").split("\n").length : 0;
  }
  var player = AV.Player($("#controls"), render, {
    keys: true, speed: 1,
    steady: [{ el: say, html: function (f) { return f.msg; } },
             { el: stackEl, html: function (f) { return f.html; } }]
  });

  function blank(msg) {
    player.load([{ ev: "line", line: 0, stack: [], out: "", msg: msg, html: "" }]);
  }

  function status(t) { $("#status").innerHTML = t; }

  function runIt() {
    var src = editor.value.replace(/\t/g, "    ");
    if (!src.trim()) { blank("The editor is empty. Pick an example above, or type some Python."); return; }
    var btn = $("#run");
    btn.disabled = true;
    var first = !pyReady;
    status(first ? "Loading Python into your browser... (about 10 MB, only the first time)" : "Running...");
    python().then(function (py) {
      var res;
      try { res = JSON.parse(py.globals.get("_av_run")(src, LIMIT)); }
      catch (e) { res = { frames: [], err: "Something went wrong running that: " + e.message, errline: null }; }
      btn.disabled = false;
      status("Python " + py.runPython("import sys; sys.version.split()[0]") + " is ready. Ctrl + Enter runs too.");
      RUN = res;
      viewMode();
      if (!res.frames.length) {
        blank('<span class="pg-err">' + esc(res.err) + "</span>" + (res.errline ? " on " + b("line " + res.errline) + ". Python couldn't even start: check the spelling, colons and indents." : ""));
        if (res.errline) { code.mark(res.errline - 1); view.querySelectorAll(".ln")[res.errline - 1].classList.add("is-err"); }
        return;
      }
      res.frames.forEach(function (f, i) {
        var prev = i ? res.frames[i - 1] : null;
        f.msg = message(f, prev, res);
        f.html = stackHtml(f, prev);
      });
      player.load(res.frames);
      checkChallenge(res);
      if (!AV.calm) { player.play(); }
      if (window.innerWidth < 900) { view.closest(".av-panel").scrollIntoView({ behavior: AV.calm ? "auto" : "smooth", block: "start" }); }
    }, function () {
      btn.disabled = false;
      status('<span class="pg-err">Couldn\'t load Python.</span> It comes from cdn.jsdelivr.net, so check your connection (or an ad blocker) and press Run again.');
    });
  }
  $("#run").addEventListener("click", runIt);

  /* ---------- examples, challenges, sharing ---------- */

  var exHost = $("#examples");
  EXAMPLES.forEach(function (ex, i) {
    var p = AV.el("button", "av-pill", esc(ex[0]) + (i === 8 ? " &#128027;" : ""));
    p.type = "button";
    p.setAttribute("data-pick", String(i));
    p.setAttribute("aria-pressed", "false");
    exHost.appendChild(p);
  });
  AV.pills(exHost, function (k) {
    setCode(EXAMPLES[+k][1].join("\n"));
    blank("Loaded " + b(EXAMPLES[+k][0]) + ". Change anything you like, then press " + b("Run") + ".");
  });

  var chHost = $("#challenges");
  CHALLENGES.forEach(function (c, i) {
    var card = AV.el("div", "av-panel pg-ch");
    card.innerHTML = "<h3>" + esc(c.title) + "</h3><p>" + esc(c.text) + '</p><p class="pg-want">Should print: <code>' + esc(c.want.split("\n").slice(0, 3).join(" / ")) + (c.want.split("\n").length > 3 ? " / ..." : "") + "</code></p>" +
      '<div class="pg-ch-row"><button class="av-pill is-small" type="button">Load it</button><span class="pg-ch-state" id="ch-' + i + '"></span></div>';
    card.querySelector("button").addEventListener("click", function () {
      setCode(c.code.join("\n"), i);
      blank("Challenge: " + b(esc(c.title)) + ". " + esc(c.text) + " Press Run to check.");
      editWrap.closest(".av-panel").scrollIntoView({ behavior: AV.calm ? "auto" : "smooth", block: "start" });
    });
    chHost.appendChild(card);
  });
  var SOLVED = "algovision-playground-solved";
  function solved() { try { return JSON.parse(localStorage.getItem(SOLVED)) || {}; } catch (e) { return {}; } }
  function drawSolved() {
    var s = solved();
    CHALLENGES.forEach(function (c, i) { $("#ch-" + i).innerHTML = s[i] ? "&#10003; Solved" : ""; });
  }
  function checkChallenge(res) {
    if (challenge < 0) { return; }
    var c = CHALLENGES[challenge];
    var got = (res.frames[res.frames.length - 1].out || "").split("\n").map(function (l) { return l.replace(/\s+$/, ""); }).join("\n").trim();
    var ok = !res.err && got === c.want;
    if (ok) { var s = solved(); s[challenge] = 1; try { localStorage.setItem(SOLVED, JSON.stringify(s)); } catch (e) { /* private window */ } drawSolved(); }
    status(ok ? '<span class="pg-ok">&#10003; Challenge solved: ' + esc(c.title) + "!</span> Step through to see how your code did it."
      : "Challenge " + b(esc(c.title)) + ": not yet. Wanted " + b(esc(c.want.split("\n")[0]) + (c.want.indexOf("\n") >= 0 ? " ..." : "")) +
        ", got " + b(got ? esc(got.split("\n")[0]) + (got.indexOf("\n") >= 0 ? " ..." : "") : "nothing") + ".");
  }
  drawSolved();

  /* the code rides in the link: #code=... */
  function enc(s) { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function dec(s) { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) { s += "="; } return decodeURIComponent(escape(atob(s))); }
  $("#share").addEventListener("click", function () {
    var url = location.href.split("#")[0] + "#code=" + enc(editor.value);
    var btn = $("#share");
    function done(t) { btn.textContent = t; window.setTimeout(function () { btn.textContent = "Copy share link"; }, 1800); }
    try { history.replaceState(null, "", "#code=" + enc(editor.value)); } catch (e) { /* file:// */ }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { done("Link copied!"); }, function () { done("Link is in the address bar"); });
    } else { done("Link is in the address bar"); }
  });

  /* ---------- start ---------- */

  AV.learn($("#learn"), "playground");
  var startSrc = null;
  var m = /^#code=([A-Za-z0-9_-]+)/.exec(location.hash);
  if (m) { try { startSrc = dec(m[1]); } catch (e) { startSrc = null; } }
  if (startSrc == null) { try { startSrc = localStorage.getItem(SAVE); } catch (e) { startSrc = null; } }
  setCode(startSrc || EXAMPLES[1][1].join("\n"));
  blank(m && startSrc ? "Someone shared this code with you. Press " + b("Run") + " to step through it."
    : "Pick an example, or write your own Python. Then press " + b("Run") + " and step through it.");
})();
