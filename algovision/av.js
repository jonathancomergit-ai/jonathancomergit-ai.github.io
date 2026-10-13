/* ============================================================
   AlgoVision - the shared engine

   Every page builds a list of FRAMES (snapshots of what the
   algorithm is doing, one per step) and hands it to a Player.
   The Player only moves a pointer through that list, which is
   why stepping BACKWARDS is free: nothing is undone, we just
   show an earlier snapshot.

     AV.Player(el, render)   play / pause / step / scrub / speed
     AV.Code(el, lines)      code listing that lights up a line
     AV.quiz(el, questions)  multiple-choice cards
     AV.learn(el, topic)     the "Mark as learned" toggle
     AV.progress             what you've marked, kept in this browser
   ============================================================ */

var AV = (function () {
  "use strict";

  var calm = window.matchMedia &&
             window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (html != null) { n.innerHTML = html; }
    return n;
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* ---------- progress (localStorage, may be blocked) ---------- */

  /* Every topic that can be ticked off. The home page counts these. */
  var TOPICS = {
    "arrays":    "Arrays",
    "big-o":     "Big O",
    "bubble":    "Bubble sort",
    "selection": "Selection sort",
    "insertion": "Insertion sort",
    "merge":     "Merge sort",
    "quick":     "Quick sort",
    "recursion": "Recursion",
    "bfs":       "BFS",
    "dfs":       "DFS",
    "dijkstra":  "Dijkstra",
    "astar":     "A*",
    "stack":     "Stacks",
    "queue":     "Queues",
    "linkedlist": "Linked lists",
    "hashmap":   "Hash maps",
    "bst":       "Binary search trees",
    "dp-fib":    "DP: Fibonacci",
    "dp-grid":   "DP: grid paths",
    "dp-coins":  "DP: coin change",
    "dp-lcs":    "DP: common subsequence",
    "oop-classes":  "OOP: classes & objects",
    "oop-inherit":  "OOP: inheritance",
    "oop-poly":     "OOP: polymorphism",
    "oop-encap":    "OOP: encapsulation",
    "oop-abstract": "OOP: abstraction",
    "refs":      "Variables & references",
    "async":     "Async & the event loop",
    "scope":     "Scope & closures"
  };
  var KEY = "algovision-progress";

  var progress = {
    all: function () {
      try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
      catch (e) { return {}; }
    },
    has: function (t) { return !!progress.all()[t]; },
    set: function (t, on) {
      var p = progress.all();
      if (on) { p[t] = Date.now(); } else { delete p[t]; }
      try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* private window */ }
    },
    count: function () {
      var p = progress.all(), n = 0;
      Object.keys(TOPICS).forEach(function (t) { if (p[t]) { n++; } });
      return n;
    },
    total: Object.keys(TOPICS).length
  };

  /* A button that ticks a topic on and off. Call .topic("merge")
     on the returned object to point it at a different topic. */
  function learn(btn, topic) {
    function draw() {
      var on = progress.has(topic);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.innerHTML = on
        ? "&#10003; Learned: " + esc(TOPICS[topic])
        : "Mark " + esc(TOPICS[topic]) + " as learned";
    }
    btn.addEventListener("click", function () {
      progress.set(topic, !progress.has(topic));
      draw();
    });
    draw();
    return { topic: function (t) { topic = t; draw(); } };
  }

  /* ---------- code panel ---------- */

  var KW = "def|for|in|range|if|elif|else|while|return|and|or|not|break|True|False|None|len|print";
  var TOKENS = new RegExp("\\b(def)(\\s+)(\\w+)|\\b(" + KW + ")\\b|\\b(\\d+)\\b", "g");
  /* JavaScript listings: same colours, JS keywords, // comments */
  var JS_KW = "function|async|await|const|let|var|new|return|if|else|while|for|of|true|false|null|console|setTimeout|Promise|fetch";
  var JS_TOKENS = new RegExp("\\b(function)(\\s+)(\\w+)|\\b(" + JS_KW + ")\\b|\\b(\\d+)\\b", "g");

  function paint(line, lang) {
    var js = lang === "js";
    var hash = line.indexOf(js ? "//" : "#");
    var code = hash === -1 ? line : line.slice(0, hash);
    var note = hash === -1 ? "" : line.slice(hash);
    var out = esc(code).replace(js ? JS_TOKENS : TOKENS, function (m, d, sp, name, kw, num) {
      if (d)   { return '<span class="k">' + d + "</span>" + sp + '<span class="f">' + name + "</span>"; }
      if (kw)  { return '<span class="k">' + kw + "</span>"; }
      return '<span class="n">' + num + "</span>";
    });
    return out + (note ? '<span class="c">' + esc(note) + "</span>" : "");
  }

  /* mirror (optional): an element that repeats the lit line. Pages
     show it on phones, where the code panel is below the stage. */
  function Code(pre, lines, mirror, opts) {
    var rows = [], src = [], lang = opts && opts.lang;
    function load(ls) {
      src = ls;
      pre.innerHTML = "";
      rows = ls.map(function (l) {
        var r = el("span", "ln", paint(l, lang) || " ");
        pre.appendChild(r);
        return r;
      });
    }
    load(lines || []);
    return {
      load: load,
      /* -1 (or nothing) clears the highlight */
      mark: function (i) {
        rows.forEach(function (r, k) { r.classList.toggle("is-on", k === i); });
        if (mirror) {
          mirror.innerHTML = src[i] ? '<span class="lbl">Line ' + (i + 1) + "</span>" + paint(src[i].trim(), lang) : "&nbsp;";
        }
        var on = rows[i];
        /* Keep the lit line in view inside the panel only - never
           scroll the whole page out from under the reader. */
        if (on && pre.scrollHeight > pre.clientHeight) {
          var top = on.offsetTop - pre.clientHeight / 2;
          pre.scrollTop = Math.max(0, top);
        }
      }
    };
  }

  /* ---------- steady boxes ----------

     Text and lists change size from one step to the next (a long
     sentence, a bigger stack). If the box resized with them, the
     buttons below would jump around under your finger. So before a
     run plays, each box is measured at its tallest for that run and
     held there. Only what's INSIDE the box changes.

     boxes: [{ el: element, html: function (frame) -> html }]  */

  function steady(boxes, frames) {
    boxes.forEach(function (box) {
      var el = box.el;
      if (!el || !frames.length) { return; }
      /* Height follows length, so only the longest few need measuring.
         Tags are stripped for the length test, not the measurement. */
      var seen = {}, list = [];
      frames.forEach(function (f) {
        var h = box.html(f) || "";
        if (!seen[h]) { seen[h] = 1; list.push(h); }
      });
      list.sort(function (a, b) { return b.replace(/<[^>]+>/g, "").length - a.replace(/<[^>]+>/g, "").length; });
      var keep = el.innerHTML, tallest = 0;
      el.style.minHeight = "0px";
      list.slice(0, 12).forEach(function (h) {
        el.innerHTML = h;
        tallest = Math.max(tallest, el.offsetHeight);
      });
      el.innerHTML = keep;
      el.style.minHeight = tallest + "px";
    });
  }

  /* ---------- player ---------- */

  /* Speed slider positions -> milliseconds per step. */
  var SPEEDS = [1100, 650, 360, 160, 60, 18];
  var SPEED_NAMES = ["0.5x", "1x", "2x", "4x", "10x", "max"];

  function Player(host, render, opts) {
    opts = opts || {};
    var frames = [], at = 0, timer = null, speed = opts.speed != null ? opts.speed : 2;

    host.classList.add("av-controls");
    host.innerHTML =
      '<div class="av-btns">' +
        '<button class="av-ctl" type="button" data-act="first" aria-label="Back to the start" title="Start">&#9198;</button>' +
        '<button class="av-ctl" type="button" data-act="back" aria-label="Step back" title="Step back (&larr;)">&#9664;</button>' +
        '<button class="av-ctl is-play" type="button" data-act="play" aria-label="Play" title="Play / pause (space)">&#9654;</button>' +
        '<button class="av-ctl" type="button" data-act="fwd" aria-label="Step forward" title="Step forward (&rarr;)">&#9654;&#10074;</button>' +
        '<button class="av-ctl" type="button" data-act="last" aria-label="Skip to the end" title="End">&#9197;</button>' +
      "</div>" +
      '<div class="av-scrub"><input type="range" min="0" max="0" value="0" aria-label="Step">' +
        '<span class="av-count">0 / 0</span></div>' +
      '<label class="av-speed">Speed <input type="range" min="0" max="' + (SPEEDS.length - 1) +
        '" value="' + speed + '" aria-label="Speed"><span>' + SPEED_NAMES[speed] + "</span></label>";

    var btn = {};
    host.querySelectorAll("[data-act]").forEach(function (b) { btn[b.getAttribute("data-act")] = b; });
    var scrub = host.querySelector(".av-scrub input");
    var count = host.querySelector(".av-count");
    var speedIn = host.querySelector(".av-speed input");
    var speedOut = host.querySelector(".av-speed span");

    function show(i) {
      if (!frames.length) { return; }
      at = Math.max(0, Math.min(frames.length - 1, i));
      render(frames[at], at, frames);
      scrub.value = at;
      count.textContent = (at + 1) + " / " + frames.length;
      btn.back.disabled = btn.first.disabled = at === 0;
      btn.fwd.disabled = btn.last.disabled = at === frames.length - 1;
      if (at === frames.length - 1) { pause(); }
    }

    function tick() {
      if (at >= frames.length - 1) { pause(); return; }
      show(at + 1);
      timer = window.setTimeout(tick, SPEEDS[speed]);
    }

    function play() {
      if (!frames.length) { return; }
      if (at >= frames.length - 1) { show(0); }
      pause();
      btn.play.innerHTML = "&#10074;&#10074;";
      btn.play.setAttribute("aria-label", "Pause");
      timer = window.setTimeout(tick, SPEEDS[speed]);
      if (opts.onPlay) { opts.onPlay(); }
    }

    function pause() {
      if (timer) { window.clearTimeout(timer); timer = null; }
      btn.play.innerHTML = "&#9654;";
      btn.play.setAttribute("aria-label", "Play");
    }

    function playing() { return !!timer; }

    btn.play.addEventListener("click", function () { if (playing()) { pause(); } else { play(); } });
    btn.back.addEventListener("click", function () { pause(); show(at - 1); });
    btn.fwd.addEventListener("click", function () { pause(); show(at + 1); });
    btn.first.addEventListener("click", function () { pause(); show(0); });
    btn.last.addEventListener("click", function () { pause(); show(frames.length - 1); });
    scrub.addEventListener("input", function () { pause(); show(+scrub.value); });
    speedIn.addEventListener("input", function () {
      speed = +speedIn.value;
      speedOut.textContent = SPEED_NAMES[speed];
    });

    /* Keyboard: space = play/pause, arrows = step. Only the page's
       main player listens, and never while you're typing. */
    if (opts.keys) {
      document.addEventListener("keydown", function (e) {
        var t = e.target;
        if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA" ||
                  t.isContentEditable)) { return; }
        if (e.altKey || e.ctrlKey || e.metaKey) { return; }
        if (e.key === " " && t.tagName !== "BUTTON") {
          e.preventDefault();
          if (playing()) { pause(); } else { play(); }
        } else if (e.key === "ArrowRight") {
          e.preventDefault(); pause(); show(at + 1);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault(); pause(); show(at - 1);
        }
      });
    }

    if (opts.steady) {
      var lastW = window.innerWidth, wait = null;
      window.addEventListener("resize", function () {
        if (window.innerWidth === lastW) { return; }   /* phone toolbar showing/hiding */
        lastW = window.innerWidth;
        window.clearTimeout(wait);
        wait = window.setTimeout(function () { steady(opts.steady, frames); show(at); }, 150);
      });
    }

    return {
      load: function (f, startAt) {
        pause();
        frames = f || [];
        if (opts.steady) { steady(opts.steady, frames); }
        scrub.max = Math.max(0, frames.length - 1);
        show(startAt === "end" ? frames.length - 1 : 0);
      },
      play: play,
      pause: pause,
      show: show,
      playing: playing,
      frame: function () { return frames[at]; },
      atEnd: function () { return at >= frames.length - 1; }
    };
  }

  /* ---------- bars (sorting stages) ---------- */

  /* Draws one frame of bars. A frame looks like:
       { a: [values], hl: {index: "compare"|"write"|"focus"},
         done: [indexes in final place], range: [lo, hi) ,
         ptr: {index: "i"} }                                   */
  function Bars(host, opts) {
    opts = opts || {};
    var barsEl = el("div", "av-bars");
    var ptrEl = opts.pointers === false ? null : el("div", "av-ptrs");
    host.appendChild(barsEl);
    if (ptrEl) { host.appendChild(ptrEl); }
    var bars = [], ptrs = [], max = 1;

    function build(n) {
      barsEl.innerHTML = "";
      if (ptrEl) { ptrEl.innerHTML = ""; }
      bars = []; ptrs = [];
      for (var i = 0; i < n; i++) {
        var b = el("div", "av-bar");
        b.appendChild(el("span"));
        barsEl.appendChild(b);
        bars.push(b);
        if (ptrEl) { var p = el("div"); ptrEl.appendChild(p); ptrs.push(p); }
      }
    }

    return {
      draw: function (f) {
        var a = f.a;
        if (a.length !== bars.length) {
          build(a.length);
          max = Math.max.apply(null, a.concat([1]));
        }
        var labels = a.length <= 24 && opts.labels !== false;
        var done = {};
        (f.done || []).forEach(function (i) { done[i] = true; });
        for (var i = 0; i < a.length; i++) {
          var b = bars[i], h = f.hl && f.hl[i];
          b.style.height = Math.max(3, a[i] / max * 100) + "%";
          b.firstChild.textContent = labels ? a[i] : "";
          b.className = "av-bar" +
            (h ? " is-" + h : done[i] ? " is-done" : "") +
            (f.range && (i < f.range[0] || i >= f.range[1]) && !done[i] ? " is-out" : "");
          if (ptrEl) { ptrs[i].textContent = (f.ptr && f.ptr[i]) || ""; }
        }
      },
      rescale: function (a) { max = Math.max.apply(null, a.concat([1])); bars = []; }
    };
  }

  /* ---------- quiz ---------- */

  /* questions: [{ q, code?, opts: [..], a: indexOfRight, why }] */
  function quiz(host, questions, scoreEl) {
    var right = 0, answered = 0;
    function score() {
      if (scoreEl) {
        scoreEl.textContent = answered
          ? "Score: " + right + " / " + answered + (answered === questions.length
              ? (right === questions.length ? "  -  perfect!" : "  -  try the misses again with Reset") : "")
          : questions.length + " questions. Pick an answer to check it.";
      }
    }
    questions.forEach(function (q) {
      var card = el("div", "av-panel av-q");
      card.appendChild(el("p", "av-q-text", esc(q.q)));
      if (q.code) {
        var pre = el("pre", "av-code");
        Code(pre, q.code);
        card.appendChild(pre);
      }
      var opts = el("div", "av-q-opts");
      var why = el("p", "av-q-why");
      why.hidden = true;
      q.opts.forEach(function (o, k) {
        var b = el("button", "", esc(o));
        b.type = "button";
        b.addEventListener("click", function () {
          var buttons = opts.querySelectorAll("button");
          buttons.forEach(function (x) { x.disabled = true; });
          buttons[q.a].classList.add("is-right");
          if (k !== q.a) { b.classList.add("is-wrong"); }
          answered++;
          if (k === q.a) { right++; }
          why.innerHTML = (k === q.a ? "<b>Correct.</b> " : "<b>Not quite.</b> ") + q.why;
          why.hidden = false;
          score();
        });
        opts.appendChild(b);
      });
      card.appendChild(opts);
      card.appendChild(why);
      host.appendChild(card);
    });
    score();
  }

  /* ---------- helpers ---------- */

  function randomArray(n, kind) {
    var a = [], i;
    for (i = 0; i < n; i++) { a.push(5 + Math.floor(Math.random() * 95)); }
    if (kind === "few") {
      var vals = [20, 45, 70, 95];
      a = a.map(function () { return vals[Math.floor(Math.random() * 4)]; });
    }
    if (kind === "sorted" || kind === "nearly" || kind === "reversed") { a.sort(function (x, y) { return x - y; }); }
    if (kind === "nearly") {
      for (i = 0; i < Math.max(1, Math.round(n / 10)); i++) {
        var p = Math.floor(Math.random() * (n - 1));
        var t = a[p]; a[p] = a[p + 1]; a[p + 1] = t;
      }
    }
    if (kind === "reversed") { a.reverse(); }
    return a;
  }

  /* One group of toggle pills where exactly one is pressed. */
  function pills(host, onPick) {
    var all = host.querySelectorAll("[data-pick]");
    all.forEach(function (p) {
      p.addEventListener("click", function () {
        all.forEach(function (x) { x.setAttribute("aria-pressed", x === p ? "true" : "false"); });
        onPick(p.getAttribute("data-pick"), p);
      });
    });
  }

  function fmt(n) {
    if (!isFinite(n)) { return "huge"; }
    if (n >= 1e15) { return n.toExponential(1).replace("e+", "e"); }
    return Math.round(n).toLocaleString("en-US");
  }

  return {
    calm: calm, el: el, esc: esc,
    TOPICS: TOPICS, progress: progress, learn: learn,
    Code: Code, Player: Player, Bars: Bars, quiz: quiz,
    randomArray: randomArray, pills: pills, fmt: fmt, steady: steady
  };
})();
