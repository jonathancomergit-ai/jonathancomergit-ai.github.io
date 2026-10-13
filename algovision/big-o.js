/* ============================================================
   AlgoVision - Big O

   1. The growth chart: six curves, n slider, hover readout.
   2. "How long would it take?": the same six at real sizes.
   3. The quiz.

   Colours: the six series use a palette that was checked for
   colour-blind separation against the dark surface. Keep them in
   this ORDER - the order is part of what makes them tell apart.
   ============================================================ */

(function () {
  "use strict";

  var $ = function (s) { return document.querySelector(s); };
  var log2 = function (n) { return Math.log(n) / Math.LN2; };

  var SERIES = [
    { id: "1",     label: "O(1)",       color: "#3987e5", f: function ()  { return 1; },
      l10: function ()  { return 0; } },
    { id: "logn",  label: "O(log n)",   color: "#d95926", f: function (n) { return log2(n); },
      l10: function (L) { return Math.log10(Math.max(1, L * Math.log2(10))); } },
    { id: "n",     label: "O(n)",       color: "#199e70", f: function (n) { return n; },
      l10: function (L) { return L; } },
    { id: "nlogn", label: "O(n log n)", color: "#c98500", f: function (n) { return n * log2(n); },
      l10: function (L) { return L + Math.log10(Math.max(1, L * Math.log2(10))); } },
    { id: "n2",    label: "O(n²)",      color: "#d55181", f: function (n) { return n * n; },
      l10: function (L) { return 2 * L; } },
    { id: "2n",    label: "O(2ⁿ)",      color: "#008300", f: function (n) { return Math.pow(2, n); },
      l10: function (L) { return Math.pow(10, L) * Math.LOG10E * Math.LN2; } }
  ];
  /* (l10 takes log10(n) and returns log10(steps). It lets the table
     below handle n = a billion, where 2ⁿ has 300 million digits.) */

  var on = {}; SERIES.forEach(function (s) { on[s.id] = s.id !== "2n"; });
  var N = 20, logScale = false, hoverN = null;

  /* ---------- number formatting ---------- */

  function short(v) {
    var a = Math.abs(v);
    if (a >= 1e15) { return v.toExponential(0).replace("e+", "e"); }
    if (a >= 1e12) { return +(v / 1e12).toFixed(1) + "T"; }
    if (a >= 1e9)  { return +(v / 1e9).toFixed(1) + "B"; }
    if (a >= 1e6)  { return +(v / 1e6).toFixed(1) + "M"; }
    if (a >= 1e4)  { return +(v / 1e3).toFixed(1) + "k"; }
    if (a < 10 && v % 1) { return v.toFixed(1); }
    return Math.round(v).toLocaleString("en-US");
  }

  /* ---------- the chart ---------- */

  var W = 760, Hh = 380, M = { l: 56, r: 92, t: 30, b: 36 };
  var PW = W - M.l - M.r, PH = Hh - M.t - M.b;
  var svg = $("#chart"), tip = $("#tip"), wrap = $("#chart-wrap");
  var NS = "http://www.w3.org/2000/svg";

  function node(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) { e.setAttribute(k, attrs[k]); }
    if (parent) { parent.appendChild(e); }
    return e;
  }

  function yMax() {
    var m = 1;
    SERIES.forEach(function (s) { if (on[s.id]) { m = Math.max(m, s.f(N)); } });
    return m;
  }

  function niceStep(max, count) {
    var raw = max / count, p = Math.pow(10, Math.floor(Math.log10(raw)));
    var r = raw / p;
    return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10) * p;
  }

  function scales() {
    var ym = yMax();
    var x = function (n) { return M.l + (n - 1) / (N - 1) * PW; };
    var y, ticks = [];
    if (logScale) {
      var top = Math.max(1, Math.ceil(Math.log10(ym)));
      y = function (v) { return M.t + PH - Math.log10(Math.max(1, v)) / top * PH; };
      var every = Math.ceil((top + 1) / 6);
      for (var e = 0; e <= top; e += every) { ticks.push(Math.pow(10, e)); }
    } else {
      var step = niceStep(ym, 5), top2 = Math.ceil(ym / step) * step;
      y = function (v) { return M.t + PH - v / top2 * PH; };
      for (var t = 0; t <= top2 + step / 2; t += step) { ticks.push(t); }
    }
    return { x: x, y: y, ticks: ticks };
  }

  function draw() {
    var sc = scales();
    svg.innerHTML = "";
    var g = node("g", { "class": "grid" }, svg);
    var ax = node("g", { "class": "axis" }, svg);
    sc.ticks.forEach(function (t) {
      var yy = sc.y(t);
      node("line", { x1: M.l, x2: M.l + PW, y1: yy, y2: yy }, g);
      var tx = node("text", { x: M.l - 8, y: yy + 4, "text-anchor": "end" }, ax);
      tx.textContent = logScale ? (t >= 1e4 ? "10^" + Math.round(Math.log10(t)) : short(t)) : short(t);
    });
    node("line", { x1: M.l, x2: M.l + PW, y1: M.t + PH, y2: M.t + PH }, ax);
    var xt = niceStep(N - 1, 6);
    for (var n = 1; n <= N; n += xt) {
      var lx = node("text", { x: sc.x(n), y: M.t + PH + 18, "text-anchor": "middle" }, ax);
      lx.textContent = Math.round(n);
    }
    var xl = node("text", { x: M.l + PW, y: Hh - 4, "text-anchor": "end" }, ax);
    xl.textContent = "n (input size) →";
    var yl = node("text", { x: M.l - 8, y: 12, "text-anchor": "end" }, ax);
    yl.textContent = "steps";

    /* clip so a curve that leaves the top doesn't draw over the labels */
    var defs = node("defs", {}, svg);
    var cp = node("clipPath", { id: "plot" }, defs);
    node("rect", { x: M.l - 2, y: M.t - 2, width: PW + 4, height: PH + 4 }, cp);

    var lines = node("g", { "class": "series", "clip-path": "url(#plot)" }, svg);
    var labels = [];
    SERIES.forEach(function (s) {
      if (!on[s.id]) { return; }
      var d = "", steps = 120;
      for (var i = 0; i <= steps; i++) {
        var nn = 1 + (N - 1) * i / steps;
        d += (i ? "L" : "M") + sc.x(nn).toFixed(1) + "," + sc.y(s.f(nn)).toFixed(1);
      }
      node("path", { d: d, stroke: s.color }, lines);
      labels.push({ s: s, y: Math.max(M.t + 6, sc.y(s.f(N))) });
    });

    /* direct labels at the right end, nudged apart so they never overlap */
    labels.sort(function (a, b) { return a.y - b.y; });
    for (var k = 1; k < labels.length; k++) {
      if (labels[k].y - labels[k - 1].y < 14) { labels[k].y = labels[k - 1].y + 14; }
    }
    for (var k2 = labels.length - 1; k2 >= 0; k2--) {
      var maxY = M.t + PH - (labels.length - 1 - k2) * 14;
      if (labels[k2].y > maxY) { labels[k2].y = maxY; }
      if (k2 < labels.length - 1 && labels[k2 + 1].y - labels[k2].y < 14) { labels[k2].y = labels[k2 + 1].y - 14; }
    }
    var lg = node("g", { "class": "series" }, svg);
    labels.forEach(function (L) {
      node("circle", { cx: M.l + PW + 8, cy: L.y, r: 4, fill: L.s.color }, lg);
      var t = node("text", { x: M.l + PW + 16, y: L.y + 4 }, lg);
      t.textContent = L.s.label;
    });

    /* hover layer */
    var cross = node("line", { "class": "cross", y1: M.t, y2: M.t + PH, x1: -10, x2: -10 }, svg);
    var dots = node("g", {}, svg);
    var hit = node("rect", { x: M.l, y: M.t, width: PW, height: PH, fill: "transparent" }, svg);
    hit.style.cursor = "crosshair";
    function at(ev) {
      var r = svg.getBoundingClientRect();
      var px = (ev.clientX - r.left) / r.width * W;
      var nn = Math.round(1 + (px - M.l) / PW * (N - 1));
      nn = Math.max(1, Math.min(N, nn));
      hoverN = nn;
      var xx = sc.x(nn);
      cross.setAttribute("x1", xx); cross.setAttribute("x2", xx);
      dots.innerHTML = "";
      var rows = "<div class='row'><span>n = " + nn + "</span><span>steps</span></div>";
      SERIES.slice().reverse().forEach(function (s) {
        if (!on[s.id]) { return; }
        var v = s.f(nn);
        node("circle", { cx: xx, cy: Math.max(M.t, sc.y(v)), r: 4.5, fill: s.color, stroke: "#11121C", "stroke-width": 2 }, dots);
        rows += "<div class='row'><span><i style='display:inline-block;width:.55rem;height:.55rem;border-radius:50%;background:" +
          s.color + ";margin-right:.4rem'></i>" + s.label + "</span><span>" + short(v) + "</span></div>";
      });
      tip.innerHTML = rows;
      tip.hidden = false;
      var wr = wrap.getBoundingClientRect();
      var left = ev.clientX - wr.left + 14;
      if (left + tip.offsetWidth > wr.width) { left = ev.clientX - wr.left - tip.offsetWidth - 14; }
      tip.style.left = Math.max(0, left) + "px";
      tip.style.top = Math.max(0, ev.clientY - wr.top - tip.offsetHeight / 2) + "px";
      growth(nn);
    }
    hit.addEventListener("pointermove", at);
    hit.addEventListener("pointerdown", at);
    hit.addEventListener("pointerleave", function () {
      tip.hidden = true; hoverN = null;
      cross.setAttribute("x1", -10); cross.setAttribute("x2", -10);
      dots.innerHTML = "";
      growth(N);
    });
  }

  /* ---------- "steps at this n" bars ---------- */

  var growEl = $("#growth"), growNote = $("#growth-n");
  var growRows = SERIES.map(function (s) {
    var row = AV.el("div", "av-grow-row");
    row.innerHTML = '<span class="lbl">' + s.label + '</span><div class="av-grow-track"><div class="av-grow-fill" style="background:' +
      s.color + '"></div></div><span class="num"></span>';
    growEl.appendChild(row);
    return { s: s, row: row, fill: row.querySelector(".av-grow-fill"), num: row.querySelector(".num") };
  });
  function growth(n) {
    growNote.textContent = n;
    var max = 1;
    growRows.forEach(function (g) { if (on[g.s.id]) { max = Math.max(max, g.s.f(n)); } });
    growRows.forEach(function (g) {
      var v = g.s.f(n);
      g.row.classList.toggle("is-off", !on[g.s.id]);
      var frac = logScale ? Math.log10(Math.max(1, v)) / Math.max(1e-9, Math.log10(max)) : v / max;
      g.fill.style.width = (on[g.s.id] ? Math.max(0.6, Math.min(1, frac) * 100) : 0) + "%";
      g.num.textContent = short(v);
    });
  }

  /* ---------- legend toggles ---------- */

  var key = $("#key");
  SERIES.forEach(function (s) {
    var btn = AV.el("button", "", "<i style='background:" + s.color + "'></i>" + s.label);
    btn.type = "button";
    btn.setAttribute("aria-pressed", on[s.id] ? "true" : "false");
    btn.addEventListener("click", function () {
      on[s.id] = !on[s.id];
      btn.setAttribute("aria-pressed", on[s.id] ? "true" : "false");
      redraw();
    });
    key.appendChild(btn);
  });

  function redraw() { draw(); growth(hoverN || N); }

  var nIn = $("#n"), nOut = $("#n-out");
  nIn.addEventListener("input", function () { N = +nIn.value; nOut.textContent = N; redraw(); });

  AV.pills($("#scale"), function (k) { logScale = k === "log"; redraw(); });

  /* "Grow n": slide n from 2 to the max, watching the curves pull apart. */
  var growing = null;
  $("#grow").addEventListener("click", function () {
    var btn = this;
    if (growing) { cancelAnimationFrame(growing); growing = null; btn.innerHTML = "&#9654; Grow n"; return; }
    btn.innerHTML = "&#10074;&#10074; Stop";
    var start = null, from = 2, to = +nIn.max, dur = AV.calm ? 1 : 5000;
    function step(ts) {
      if (start === null) { start = ts; }
      var t = Math.min(1, (ts - start) / dur);
      N = Math.round(from + (to - from) * t);
      nIn.value = N; nOut.textContent = N;
      redraw();
      if (t < 1) { growing = requestAnimationFrame(step); }
      else { growing = null; btn.innerHTML = "&#9654; Grow n"; }
    }
    growing = requestAnimationFrame(step);
  });

  redraw();

  /* ============================================================
     HOW LONG WOULD IT TAKE?
     All in log10 space, so a billion items can't overflow.
     ============================================================ */

  var OPS_PER_SEC = 1e9;   // a modern computer: roughly a billion simple steps a second
  var UNIVERSE_YEARS = 1.38e10;

  function bigNum(l10) {
    if (l10 < 15) { return Math.round(Math.pow(10, l10)).toLocaleString("en-US"); }
    var e = Math.floor(l10);
    return "about 10^" + e.toLocaleString("en-US");
  }

  function duration(l10ops) {
    var s = l10ops - Math.log10(OPS_PER_SEC);   // log10(seconds)
    var units = [
      [-9, 1e-9, "nanoseconds"], [-6, 1e-6, "microseconds"], [-3, 1e-3, "milliseconds"],
      [0, 1, "seconds"], [Math.log10(60), 60, "minutes"], [Math.log10(3600), 3600, "hours"],
      [Math.log10(86400), 86400, "days"], [Math.log10(31557600), 31557600, "years"]
    ];
    if (s < -9) { return { text: "instant", huge: false }; }
    var u = units[0];
    units.forEach(function (x) { if (s >= x[0]) { u = x; } });
    if (u[2] !== "years") {
      var v = Math.pow(10, s) / u[1];
      v = v < 10 ? +v.toFixed(1) : Math.round(v);
      return { text: v + " " + (v === 1 ? u[2].slice(0, -1) : u[2]), huge: false };
    }
    var ly = s - Math.log10(31557600);
    if (ly < 6) { return { text: Math.round(Math.pow(10, ly)).toLocaleString("en-US") + " years", huge: ly > 2 }; }
    var times = ly - Math.log10(UNIVERSE_YEARS);
    return {
      text: "10^" + Math.floor(ly).toLocaleString("en-US") + " years" +
        (times > 0 ? " - the universe is only 1.4 × 10^10 years old" : ""),
      huge: true
    };
  }

  var timeBody = $("#time-body"), timeN = $("#time-n");
  function timeTable(n) {
    var L = Math.log10(n);
    timeN.textContent = n.toLocaleString("en-US");
    timeBody.innerHTML = SERIES.map(function (s) {
      var l = s.l10(L), d = duration(l);
      return "<tr><td><i style='display:inline-block;width:.6rem;height:.6rem;border-radius:50%;margin-right:.5rem;background:" +
        s.color + "'></i>" + s.label + "</td><td>" + bigNum(l) + "</td><td class='" + (d.huge ? "huge" : "") + "'>" + d.text + "</td></tr>";
    }).join("");
  }
  AV.pills($("#time-pills"), function (k) { timeTable(+k); });
  timeTable(1000);

  /* ---------- learned + quiz ---------- */

  AV.learn($("#learn"), "big-o");

  AV.quiz($("#quiz"), [
    {
      q: "What's the Big O of this?",
      code: ["for i in range(n):", "    for j in range(n):", "        print(i, j)"],
      opts: ["O(n)", "O(n log n)", "O(n²)", "O(2ⁿ)"], a: 2,
      why: "A loop of n inside a loop of n runs n &times; n times. <b>Nested loops multiply.</b>"
    },
    {
      q: "And this one?",
      code: ["while n > 1:", "    n = n // 2"],
      opts: ["O(1)", "O(log n)", "O(n)", "O(n²)"], a: 1,
      why: "n halves every time round. Halving until you hit 1 takes log&#8322;(n) steps: 1,024 only needs 10."
    },
    {
      q: "Two loops, one after the other:",
      code: ["for x in a:", "    total += x", "for x in a:", "    print(x)"],
      opts: ["O(n)", "O(n²)", "O(2n)", "O(log n)"], a: 0,
      why: "That's n + n = 2n steps. <b>Drop the constant</b>: 2n grows at the same rate as n, so it's O(n). Loops one after another add, they don't multiply."
    },
    {
      q: "Grabbing the middle item:",
      code: ["def middle(a):", "    return a[len(a) // 2]"],
      opts: ["O(1)", "O(log n)", "O(n)", "O(n / 2)"], a: 0,
      why: "Jumping to an index is one calculation no matter how long the array is (see the Arrays module for why). Constant time, O(1)."
    },
    {
      q: "The inner loop here is fixed at 10:",
      code: ["for i in range(n):", "    for j in range(10):", "        print(i, j)"],
      opts: ["O(n²)", "O(10n)", "O(n)", "O(1)"], a: 2,
      why: "10 &times; n steps. The inner loop doesn't grow with n, so it's a constant: O(n). Only loops that depend on n count."
    },
    {
      q: "Each call makes two more calls:",
      code: ["def f(n):", "    if n <= 1:", "        return 1", "    return f(n - 1) + f(n - 1)"],
      opts: ["O(n)", "O(n²)", "O(2ⁿ)", "O(log n)"], a: 2,
      why: "1 call becomes 2, then 4, then 8... doubling n times is 2&#8319;. This is the green curve that leaves the chart."
    }
  ], $("#quiz-score"));
})();
