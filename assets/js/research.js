/* ============================================================
   Jonjoe1001 - research media (home + research pages)

   1. Videos: the dream clips autoplay muted and loop. If the
      visitor asked their OS for reduced motion they do not
      autoplay; they get normal play controls instead.
   2. MiniGPT charts: drawn from the REAL training log, which is
      embedded in the page as JSON (<script id="minigpt-log">),
      so the charts also work from a double-clicked file.
   ============================================================ */
(function () {
  "use strict";

  var calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- 1. videos -------------------------------------------- */
  Array.prototype.forEach.call(document.querySelectorAll("video[autoplay]"), function (v) {
    if (calm) { v.removeAttribute("autoplay"); v.pause(); v.controls = true; }
  });
  /* Card clips play while the pointer (or keyboard focus) is on the card. */
  Array.prototype.forEach.call(document.querySelectorAll("video[data-hover]"), function (v) {
    var card = v.closest(".card") || v.parentNode;
    function play() { if (!calm) { var p = v.play(); if (p && p.catch) { p.catch(function () {}); } } }
    function stop() { v.pause(); }
    card.addEventListener("mouseenter", play);
    card.addEventListener("mouseleave", stop);
    card.addEventListener("focusin", play);
    card.addEventListener("focusout", stop);
  });

  /* ---- 2. charts -------------------------------------------- */
  var store = document.getElementById("minigpt-log");
  if (!store) { return; }
  var log;
  try { log = JSON.parse(store.textContent); } catch (e) { return; }

  var css = getComputedStyle(document.documentElement);
  function tok(name) { return css.getPropertyValue(name).trim(); }

  function chart(el, pts, o) {
    if (!el) { return; }
    var W = 320, H = 190, L = 34, R = 8, T = 10, B = 24;
    var MONO = 'font-family="Geist Mono, monospace"';
    function x(v) { return L + (v / o.xmax) * (W - L - R); }
    function y(v) { return T + (1 - (v - o.ymin) / (o.ymax - o.ymin)) * (H - T - B); }
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + o.label + '">';
    o.yt.forEach(function (t) {
      s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(t) + '" y2="' + y(t) + '" stroke="' + tok("--line") + '"/>' +
           '<text x="' + (L - 6) + '" y="' + (y(t) + 3) + '" text-anchor="end" font-size="9" fill="' + tok("--text-faint") + '" ' + MONO + '>' + t + o.yu + '</text>';
    });
    [0, 4, 8, 12, 16].forEach(function (t) {
      s += '<text x="' + x(t) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="9" fill="' + tok("--text-faint") + '" ' + MONO + '>' + t + 'B</text>';
    });
    if (o.ref != null) {
      s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(o.ref) + '" y2="' + y(o.ref) + '" stroke="' + tok("--text-faint") + '" stroke-dasharray="3 3"/>' +
           '<text x="' + (W - R) + '" y="' + (y(o.ref) - 4) + '" text-anchor="end" font-size="9" fill="' + tok("--text-faint") + '" ' + MONO + '>random guess</text>';
    }
    var d = pts.map(function (p, i) { return (i ? "L" : "M") + x(p[0]).toFixed(1) + " " + y(p[1]).toFixed(1); }).join("");
    var line = tok("--hot"), ring = tok("--surface");
    s += '<path d="' + d + '" fill="none" stroke="' + line + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
    var last = pts[pts.length - 1];
    s += '<circle cx="' + x(last[0]) + '" cy="' + y(last[1]) + '" r="4" fill="' + line + '" stroke="' + ring + '" stroke-width="2"/>' +
         '<text x="' + (x(last[0]) - 6) + '" y="' + (y(last[1]) + (o.below ? 14 : -8)) + '" text-anchor="end" font-size="10" fill="' + tok("--text") + '" ' + MONO + '>' + last[1] + o.yu + '</text>' +
         '<line class="xh" y1="' + T + '" y2="' + (H - B) + '" stroke="' + tok("--text-dim") + '" visibility="hidden"/>' +
         '<circle class="xd" r="4" fill="' + line + '" stroke="' + ring + '" stroke-width="2" visibility="hidden"/></svg>';
    el.insertAdjacentHTML("beforeend", s);

    /* Hover: a crosshair and the exact value at that point. */
    var svg = el.querySelector("svg"), xh = svg.querySelector(".xh"), xd = svg.querySelector(".xd");
    var tip = document.createElement("div");
    tip.className = "chart-tip"; tip.hidden = true; el.appendChild(tip);
    svg.addEventListener("pointermove", function (ev) {
      var r = svg.getBoundingClientRect();
      var v = ((ev.clientX - r.left) * W / r.width - L) / (W - L - R) * o.xmax, best = pts[0];
      pts.forEach(function (p) { if (Math.abs(p[0] - v) < Math.abs(best[0] - v)) { best = p; } });
      xh.setAttribute("x1", x(best[0])); xh.setAttribute("x2", x(best[0])); xh.setAttribute("visibility", "visible");
      xd.setAttribute("cx", x(best[0])); xd.setAttribute("cy", y(best[1])); xd.setAttribute("visibility", "visible");
      tip.hidden = false;
      tip.innerHTML = best[1] + o.yu + " <span>at " + best[0].toFixed(2) + "B tokens</span>";
      tip.style.left = (x(best[0]) * r.width / W + svg.offsetLeft) + "px";
      tip.style.top = (y(best[1]) * r.height / H + svg.offsetTop) + "px";
    });
    svg.addEventListener("pointerleave", function () {
      xh.setAttribute("visibility", "hidden"); xd.setAttribute("visibility", "hidden"); tip.hidden = true;
    });
  }

  chart(document.getElementById("chart-loss"),
        log.train.filter(function (p) { return p[0] > 0.02; }),
        { xmax: 16, ymin: 2, ymax: 8, yt: [2, 4, 6, 8], yu: "",
          label: "Training loss falls from about 8 to 2.69 over 16 billion tokens" });
  chart(document.getElementById("chart-arc"),
        log.evals.map(function (e) { return [e[0], e[2]]; }),
        { xmax: 16, ymin: 20, ymax: 70, yt: [20, 40, 60], yu: "%", ref: 25,
          label: "ARC-Easy accuracy rises from 24.7% to 63.1% over 16 billion tokens" });
})();
