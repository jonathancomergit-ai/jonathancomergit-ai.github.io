/* ============================================================
   Jonjoe1001 - personal site
   No libraries, no build step.

   1. Mobile nav toggle
   2. Project filter chips
   3. Background sprites
   4. Decoding headlines
   5. Scroll reveal
   6. Reading progress bar (posts)
   7. Tilting cards
   8. Glitch on hover
   9. The living ASCII portrait (about page)
  10. Brain wiring (home page)
   ============================================================ */

(function () {
  "use strict";

  /* ----------------------------------------------------------
     1. MOBILE NAV
     The hamburger button is hidden by CSS above 860px wide,
     so this only ever matters on a phone.
     ---------------------------------------------------------- */
  var toggle = document.querySelector(".nav-toggle");
  var links = document.querySelector(".nav-links");

  if (toggle && links) {
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("is-open");
      // Tell screen readers whether the menu is open.
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    // Tapping any link closes the menu again.
    links.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        links.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ----------------------------------------------------------
     2. PROJECT FILTER
     Each .chip has data-filter="games" (etc).
     Each .card has data-tags="games engine python".
     Clicking a chip hides every card whose tags do not match.

     To add a new filter: add a chip button in the HTML, and put
     the matching word in the data-tags of the cards it should show.
     No JS changes needed.
     ---------------------------------------------------------- */
  var chips = document.querySelectorAll(".chip");
  var cards = document.querySelectorAll(".card[data-tags]");
  var count = document.querySelector("[data-result-count]");

  function applyFilter(want) {
    var shown = 0;

    cards.forEach(function (card) {
      var tags = (card.getAttribute("data-tags") || "").split(/\s+/);
      var match = want === "all" || tags.indexOf(want) !== -1;
      card.hidden = !match;
      if (match) { shown++; }
    });

    if (count) {
      count.textContent = shown + (shown === 1 ? " project" : " projects");
    }
  }

  if (chips.length) {
    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        // Only one chip is pressed at a time.
        chips.forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
        chip.setAttribute("aria-pressed", "true");
        applyFilter(chip.getAttribute("data-filter"));
      });
    });

    // Set the initial count on load.
    applyFilter("all");
  }

  /* ----------------------------------------------------------
     3. BACKGROUND SPRITES

     Characters from Timeless wandering along behind the page.

     They are drawn on one <canvas> injected into .backdrop, which
     is already position:fixed, z-index:-1 and pointer-events:none
     on every page - so the sprites end up behind all the content
     and unclickable without a single line of HTML changing. The
     backdrop's ::after scanlines paint OVER its children, so the
     sprites pick up the CRT overlay for free.

     Everything worth fiddling with is in TUNING below.
     ---------------------------------------------------------- */

  /* ---- TUNING ------------------------------------------------

     Each cast member is one row of the sprite atlas.
       row    - y offset of that row in atlas.png
       size   - frame width and height in the atlas (square)
       frames - how many frames loop. Deliberately stops BEFORE
                each sheet's death frames, or characters would
                blink into a death pose mid-stroll.
       draw   - on-screen height in CSS pixels at full depth.
                Set per character so a 32px sheet and a 200px
                sheet do not arrive wildly different sizes.
       weight - relative chance of being picked, out of 132 total.
                Regulars 8-14, minibosses 4, bosses 1. A boss turns
                up on roughly 1 spawn in 44.
       fps    - animation speed for this character.
       near   - optional. Forces a high depth, so the character is
                always drawn big, bright and near the front. Only
                the bosses get it: a boss that wandered past tiny
                and faint would be a waste of a rare sighting.
       slow   - optional speed multiplier. Bosses glide.
     ------------------------------------------------------------ */
  var CAST = [
    /* --- the regulars --------------------------------------- */
    { name: "player",      row:    0, size:  64, frames: 6, draw:  76, weight: 14, fps:  8 },
    { name: "ambusher",    row:   64, size:  64, frames: 6, draw:  80, weight: 12, fps:  7 },
    { name: "tank",        row:  128, size:  64, frames: 6, draw:  74, weight: 10, fps:  6 },
    { name: "shooter",     row:  192, size:  48, frames: 4, draw:  64, weight: 10, fps:  7 },
    { name: "shielder",    row:  240, size:  48, frames: 5, draw:  66, weight:  9, fps:  6 },
    { name: "basic",       row:  288, size:  48, frames: 4, draw:  62, weight: 10, fps:  8 },
    { name: "phaser",      row:  336, size:  48, frames: 3, draw:  70, weight:  8, fps:  5 },
    { name: "fast",        row:  384, size:  32, frames: 6, draw:  54, weight: 10, fps: 12 },
    { name: "parasite",    row:  416, size:  64, frames: 2, draw:  72, weight:  8, fps:  4 },

    /* --- mimics. The first three frames of these sheets are the
           barrel and the crate sitting there innocently; packed
           here is only what climbs out, because looping the reveal
           would snap it shut again every second and read as a bug. */
    { name: "mimicbox",    row:  480, size:  48, frames: 5, draw:  70, weight:  5, fps:  7 },
    { name: "mimicbarrel", row:  528, size:  48, frames: 5, draw:  70, weight:  5, fps:  7 },

    /* --- minibosses: bigger, and a third as common ----------- */
    { name: "ambusherMB",  row:  576, size:  64, frames: 6, draw: 100, weight:  4, fps:  6 },
    { name: "basicMB",     row:  640, size:  64, frames: 4, draw:  96, weight:  4, fps:  7 },
    { name: "fastMB",      row:  704, size:  64, frames: 5, draw:  92, weight:  4, fps: 10 },
    { name: "phaserMB",    row:  768, size:  64, frames: 3, draw:  98, weight:  4, fps:  5 },
    { name: "shieldMB",    row:  832, size:  64, frames: 5, draw:  96, weight:  4, fps:  6 },
    { name: "shooterMB",   row:  896, size:  64, frames: 4, draw:  94, weight:  4, fps:  6 },
    { name: "tankMB",      row:  960, size:  64, frames: 6, draw: 100, weight:  4, fps:  5 },

    /* --- bosses. 1 in 132 each. Big, slow, and worth catching. */
    { name: "reaper",      row: 1024, size: 200, frames: 4, draw: 190, weight:  1, fps:  4, near: 1, slow: 0.45 },
    { name: "vialactea",   row: 1224, size: 200, frames: 4, draw: 190, weight:  1, fps:  4, near: 1, slow: 0.45 },
    { name: "chronarch",   row: 1424, size: 200, frames: 6, draw: 175, weight:  1, fps:  5, near: 1, slow: 0.40 }
  ];

  /* One sprite per this many pixels of viewport width, clamped. */
  var PER_PIXELS  = 190;
  var MIN_ONSTAGE = 3;
  var MAX_ONSTAGE = 12;

  /* Depth. Distant sprites are smaller, slower and fainter, which
     is what sells it as a background rather than a foreground. */
  var DEPTH_SCALE   = [0.55, 1.10];   // multiplier on `draw`
  var DEPTH_OPACITY = [0.14, 0.36];   // the number to tune first
  var DEPTH_SPEED   = [12, 42];       // CSS pixels per second

  var BOB_HEIGHT = 3;      // pixels of vertical bounce while walking
  var BOB_SPEED  = 4;      // bounces per second

  /* Set to false to drop the little on/off control in the footer. */
  var SHOW_TOGGLE = true;
  var STORE_KEY   = "sprites-off";

  /* ---- setup ------------------------------------------------- */

  var backdrop = document.querySelector(".backdrop");
  var reduceMotion = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;

  /* Pages live at the root AND in subfolders (projects/, posts/),
     so a hardcoded "assets/img/..." would 404 on half the site.
     Work the path out from where THIS script was loaded from
     instead, which is correct from any depth. */
  function atlasUrl() {
    var self = document.currentScript && document.currentScript.src;
    if (!self) {
      var tags = document.getElementsByTagName("script");
      self = tags[tags.length - 1].src;
    }
    return self.replace(/js\/site\.js.*$/, "img/sprites/atlas.webp");
  }

  function stored(key) {
    /* localStorage throws outright in some privacy modes, so every
       read and write has to be guarded. */
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function store(key, value) {
    try {
      if (value === null) { window.localStorage.removeItem(key); }
      else { window.localStorage.setItem(key, value); }
    } catch (e) { /* nothing we can do, and nothing that matters */ }
  }

  if (backdrop && window.requestAnimationFrame) {
    startSprites();
  }

  function startSprites() {
    var canvas = document.createElement("canvas");
    canvas.className = "sprite-layer";
    canvas.setAttribute("aria-hidden", "true");
    backdrop.appendChild(canvas);

    var ctx = canvas.getContext("2d");
    var atlas = new Image();
    var ready = false;

    var sprites = [];
    var width = 0, height = 0;
    var lastTime = 0;
    var frameHandle = 0;
    var running = false;

    /* Total weight, worked out once, for the weighted pick below. */
    var totalWeight = 0;
    CAST.forEach(function (c) { totalWeight += c.weight; });

    function pickCast() {
      var roll = Math.random() * totalWeight;
      for (var i = 0; i < CAST.length; i++) {
        roll -= CAST[i].weight;
        if (roll <= 0) { return CAST[i]; }
      }
      return CAST[0];
    }

    function lerp(range, t) { return range[0] + (range[1] - range[0]) * t; }

    /* Build one sprite. `entering` means start it just off the edge
       so it walks in, rather than popping into existence mid-screen -
       used for respawns, but not for the first paint, or the page
       would begin suspiciously empty. */
    function makeSprite(entering) {
      var cast = pickCast();

      /* 0 = far, 1 = near. Bosses are pinned to the near end so a
         rare sighting is actually a sighting. */
      var depth = cast.near ? 0.65 + Math.random() * 0.35 : Math.random();
      var scale = lerp(DEPTH_SCALE, depth);
      var size = cast.draw * scale;
      var dir = Math.random() < 0.5 ? -1 : 1;

      return {
        cast:  cast,
        size:  size,
        dir:   dir,
        speed: lerp(DEPTH_SPEED, depth) * (cast.slow || 1),
        alpha: lerp(DEPTH_OPACITY, depth),
        x:     entering
                 ? (dir > 0 ? -size : width + size)
                 : Math.random() * width,
        y:     Math.random() * Math.max(height - size, 1) + size / 2,
        frame: Math.floor(Math.random() * cast.frames),
        clock: Math.random() * 10,
        bob:   Math.random() * Math.PI * 2
      };
    }

    function populate() {
      var want = Math.round(width / PER_PIXELS);
      want = Math.max(MIN_ONSTAGE, Math.min(MAX_ONSTAGE, want));

      while (sprites.length > want) { sprites.pop(); }
      while (sprites.length < want) { sprites.push(makeSprite(false)); }
    }

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;

      /* Draw at the screen's real pixel density so pixel art stays
         crisp, but cap it - a 3x phone gains nothing visible here
         and pays for every one of those pixels. */
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      /* Must be re-set after any resize: changing canvas.width
         resets the whole 2D context, this flag included. */
      ctx.imageSmoothingEnabled = false;

      populate();
    }

    function step(now) {
      frameHandle = window.requestAnimationFrame(step);

      /* Clamp the delta. Coming back to a backgrounded tab can hand
         you a gap of many seconds, which would teleport everyone
         across the screen at once. */
      var dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      ctx.clearRect(0, 0, width, height);

      for (var i = 0; i < sprites.length; i++) {
        var s = sprites[i];

        s.x += s.dir * s.speed * dt;
        s.clock += dt;
        s.bob += dt * BOB_SPEED * Math.PI * 2;
        s.frame = Math.floor(s.clock * s.cast.fps) % s.cast.frames;

        /* Walked off the edge: replace it with somebody new, so the
           cast keeps changing instead of the same few looping. */
        var margin = s.size;
        if (s.x < -margin || s.x > width + margin) {
          sprites[i] = makeSprite(true);
          continue;
        }

        var y = s.y + Math.sin(s.bob) * BOB_HEIGHT;

        ctx.globalAlpha = s.alpha;
        ctx.save();
        ctx.translate(s.x, y);
        /* Sheets are drawn facing one way only, so mirror the whole
           canvas to walk the other way. */
        if (s.dir < 0) { ctx.scale(-1, 1); }
        ctx.drawImage(
          atlas,
          s.frame * s.cast.size, s.cast.row, s.cast.size, s.cast.size,
          -s.size / 2, -s.size / 2, s.size, s.size
        );
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    function play() {
      if (running || !ready) { return; }
      running = true;
      lastTime = window.performance ? window.performance.now() : Date.now();
      frameHandle = window.requestAnimationFrame(step);
    }

    function pause() {
      running = false;
      if (frameHandle) { window.cancelAnimationFrame(frameHandle); }
      frameHandle = 0;
    }

    /* Off for anyone who asked the OS for less motion, and off if
       they switched it off here last time. */
    function wanted() {
      if (reduceMotion && reduceMotion.matches) { return false; }
      return stored(STORE_KEY) !== "1";
    }

    function apply() {
      if (wanted() && !document.hidden) { play(); }
      else { pause(); ctx.clearRect(0, 0, width, height); }
      canvas.hidden = !wanted();
    }

    atlas.onload = function () {
      ready = true;
      resize();
      apply();
    };
    atlas.src = atlasUrl();

    /* Debounced, because a desktop window drag fires resize a lot
       and each one reallocates the canvas. */
    var resizeTimer = 0;
    window.addEventListener("resize", function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function () {
        if (ready) { resize(); }
      }, 150);
    });

    /* Stop animating in a tab nobody is looking at - it is pure
       battery drain otherwise. */
    document.addEventListener("visibilitychange", apply);

    if (reduceMotion) {
      if (reduceMotion.addEventListener) { reduceMotion.addEventListener("change", apply); }
      else if (reduceMotion.addListener) { reduceMotion.addListener(apply); }
    }

    /* ---- the footer toggle --------------------------------- */

    if (SHOW_TOGGLE && !(reduceMotion && reduceMotion.matches)) {
      var footer = document.querySelector(".footer-inner");
      if (footer) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "sprite-toggle";

        var label = function () {
          var on = wanted();
          button.textContent = on ? "sprites: on" : "sprites: off";
          button.setAttribute("aria-pressed", on ? "true" : "false");
        };

        button.addEventListener("click", function () {
          store(STORE_KEY, wanted() ? "1" : null);
          label();
          apply();
        });

        label();
        footer.appendChild(button);
      }
    }
  }

  /* ==========================================================
     SECTIONS 4-9: DECORATION

     Everything from here down is visual polish. Each piece checks
     for what it needs and quietly does nothing if it is missing,
     so an old browser simply gets the plain site.

     Anyone whose OS is set to reduce motion gets none of it except
     the reading bar, which is information rather than motion.

     (Page transitions are the seventh effect, but they are pure CSS -
     see PAGE TRANSITIONS in site.css. No JavaScript involved.)
     ========================================================== */

  function media(query) {
    return window.matchMedia ? window.matchMedia(query) : { matches: false };
  }

  var calm  = !!(reduceMotion && reduceMotion.matches);
  /* A real mouse. Tilting follows a cursor, and a phone has none. */
  var mouse = media("(hover: hover) and (pointer: fine)").matches;
  var raf   = window.requestAnimationFrame;

  /* ----------------------------------------------------------
     4. DECODING HEADLINES

     Each page's big headline arrives as scrambled ASCII and settles
     into the real words left to right, like a terminal cracking a
     password. Once per page load, never on a loop.

     Only text nodes are touched, so markup inside the heading (the
     gradient <span class="glow"> on the home page) survives.

     The lines are LOCKED while it runs. Random glyphs are wider or
     narrower than the real letters, so left to wrap freely the lines
     re-flow mid-effect: words hop between lines, the heading grows a
     line, and everything under it jumps. So the script finds where
     the real words break (on an invisible copy that keeps the real
     text) and holds exactly those breaks until the effect is over.
     ---------------------------------------------------------- */
  var DECODE_SPREAD = 1300;  // ms between the first letter landing and the last
  var DECODE_JITTER = 380;   // random extra wait per letter, so they do not land in a neat wave
  var DECODE_SWAP   = 65;    // ms between glyph changes while a letter is scrambling

  var UPPER = "ABCDEFGHKMNPRSTUVWXYZ#%&@";
  var LOWER = "abcdefghkmnopqrstuvwxyz*+=?<>/";
  var DIGIT = "0123456789#%";

  function glyphFor(ch) {
    var set = (ch >= "A" && ch <= "Z") ? UPPER : (ch >= "0" && ch <= "9") ? DIGIT : LOWER;
    return set.charAt(Math.floor(Math.random() * set.length));
  }

  function decode(el) {
    var jobs = [];
    var flat = [];          // every character in reading order, across all the text nodes
    var total = 0;
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);

    while (walker.nextNode()) {
      var node = walker.currentNode;
      var orig = node.nodeValue;
      var job = { node: node, orig: orig, shown: orig.split(""), land: [], n: jobs.length };
      for (var i = 0; i < orig.length; i++) {
        /* Whitespace never scrambles, so words keep their breaks. */
        var ws = /\s/.test(orig.charAt(i));
        job.land.push(ws ? -1 : total++);
        flat.push({ jb: job, c: i, ws: ws });
      }
      jobs.push(job);
    }
    if (!total) { return; }

    var landAt = [];
    for (var k = 0; k < total; k++) {
      landAt.push(60 + (k / total) * DECODE_SPREAD + Math.random() * DECODE_JITTER);
    }

    /* Each run of whitespace between words: the character before it
       and the one after (-1 at the very start or end). */
    var gaps = [];
    for (var f = 0; f < flat.length; f++) {
      if (!flat[f].ws) { continue; }
      var gap = { prev: f - 1, run: [] };
      while (f < flat.length && flat[f].ws) { gap.run.push(flat[f]); f++; }
      gap.next = f < flat.length ? f : -1;
      gaps.push(gap);
    }

    /* Lock the lines (see above). Each gap becomes a plain space, or a
       newline where the real text wraps, under white-space: pre - so
       the scramble can never move a word to another line. Measured on
       an invisible copy, which still has the real words in it. Run
       again if the fonts arrive or the window resizes mid-effect. */
    var copy = null;
    function lock() {
      if (finished || !gaps.length || el.querySelector("br")) { return; }
      if (!copy) {
        copy = el.cloneNode(true);
        copy.removeAttribute("id");
        copy.setAttribute("aria-hidden", "true");
        copy.style.cssText = "position:absolute;visibility:hidden;pointer-events:none;left:0;top:0;margin:0";
        el.parentNode.insertBefore(copy, el.nextSibling);
      }
      copy.style.width = el.getBoundingClientRect().width + "px";
      var nodes = [];
      var cw = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT, null, false);
      while (cw.nextNode()) { nodes.push(cw.currentNode); }
      var top = function (k) {
        var r = document.createRange();
        r.setStart(nodes[flat[k].jb.n], flat[k].c);
        r.setEnd(nodes[flat[k].jb.n], flat[k].c + 1);
        var box = r.getClientRects()[0];
        return box ? box.top : 0;
      };
      gaps.forEach(function (g) {
        var edge = g.prev < 0 || g.next < 0;      // before the first word or after the last: nothing
        var wrap = !edge && top(g.next) > top(g.prev) + 2;
        g.run.forEach(function (ch, n) { ch.jb.shown[ch.c] = n || edge ? "" : wrap ? "\n" : " "; });
      });
      el.style.whiteSpace = "pre";
      jobs.forEach(function (jb) { jb.node.nodeValue = jb.shown.join(""); });
    }

    /* A screen reader landing here mid-effect would read gibberish,
       so it gets the real words up front. */
    el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
    el.setAttribute("data-decoding", "");

    var clock = window.performance || Date;
    var start = clock.now();
    var lastSwap = 0;
    var finished = false;

    lock();
    if (document.fonts && document.fonts.status === "loading" && document.fonts.ready) {
      document.fonts.ready.then(lock);
    }
    window.addEventListener("resize", lock);

    function finish() {
      if (finished) { return; }
      finished = true;
      jobs.forEach(function (jb) { jb.node.nodeValue = jb.orig; });
      el.removeAttribute("aria-label");
      el.removeAttribute("data-decoding");
      el.style.whiteSpace = "";
      window.removeEventListener("resize", lock);
      if (copy) { copy.parentNode.removeChild(copy); copy = null; }
      /* Tell anything waiting on the real letters (the brain wiring). */
      if (typeof window.CustomEvent === "function") { el.dispatchEvent(new window.CustomEvent("decoded")); }
    }

    /* Safety net. Frames stop in a background tab and can stall in
       odd environments; whatever happens, the real words come back. */
    window.setTimeout(finish, 60 + DECODE_SPREAD + DECODE_JITTER + 2000);

    function frame() {
      if (finished) { return; }
      /* The page clock, not the frame's own timestamp: the two can
         disagree, and the frame's can stand still in some browsers. */
      var now = clock.now();
      var t = now - start;
      var swap = now - lastSwap >= DECODE_SWAP;
      if (swap) { lastSwap = now; }
      var done = true;

      for (var j = 0; j < jobs.length; j++) {
        var jb = jobs[j];
        var changed = false;
        for (var c = 0; c < jb.shown.length; c++) {
          var n = jb.land[c];
          if (n < 0) { continue; }
          if (t >= landAt[n]) {
            if (jb.shown[c] !== jb.orig.charAt(c)) { jb.shown[c] = jb.orig.charAt(c); changed = true; }
          } else {
            done = false;
            if (swap) { jb.shown[c] = glyphFor(jb.orig.charAt(c)); changed = true; }
          }
        }
        if (changed) { jb.node.nodeValue = jb.shown.join(""); }
      }

      if (done) { finish(); } else { raf(frame); }
    }

    raf(frame);
  }

  if (!calm && raf && document.createTreeWalker) {
    document.querySelectorAll("main h1, .code-404").forEach(decode);
  }

  /* ----------------------------------------------------------
     5. SCROLL REVEAL

     Cards, headings and screenshots fade up into place as they
     scroll into view.

     Only things BELOW the fold at load are hidden. Anything already
     on screen is left alone: it has most likely been painted by now,
     and hiding it to fade it back in would read as a flicker. It
     also means nothing is ever invisible to someone without
     JavaScript, because only this script ever hides anything.
     ---------------------------------------------------------- */
  var REVEAL = [
    ".section-head", ".feature", ".card", ".post-row", ".callout",
    ".facts", ".project-cover", ".shot", ".article figure", ".prose h2"
  ].join(", ");

  if (!calm && "IntersectionObserver" in window) {
    var revealer = new IntersectionObserver(function (entries) {
      var n = 0;
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        var el = entry.target;
        revealer.unobserve(el);

        /* Things arriving together (a row of cards) land in a quick
           ripple rather than all at once. */
        var delay = Math.min(n++ * 70, 280);
        el.style.transitionDelay = delay + "ms";
        el.classList.add("is-in");

        /* Then hand the element its own transitions back. While
           .reveal is on, its slow fade replaces the card's quick
           hover lift. */
        window.setTimeout(function () {
          el.classList.remove("reveal", "is-in");
          el.style.transitionDelay = "";
        }, 800 + delay);
      });
    }, { rootMargin: "0px 0px -8% 0px" });

    var fold = window.innerHeight * 0.92;
    document.querySelectorAll(REVEAL).forEach(function (el) {
      if (el.getBoundingClientRect().top < fold) { return; }
      el.classList.add("reveal");
      revealer.observe(el);
    });
  }

  /* ----------------------------------------------------------
     6. READING PROGRESS

     Posts only. A thin bar along the bottom edge of the header
     fills as you read. It lives inside the header, so it rides
     along with it for free.

     0% when the top of the post is at the top of the window,
     100% when its last line reaches the bottom.
     ---------------------------------------------------------- */
  var article = document.querySelector(".article");
  var siteHeader = document.querySelector(".site-header");

  if (article && siteHeader) {
    var bar = document.createElement("div");
    bar.className = "read-progress";
    bar.setAttribute("aria-hidden", "true");
    var fill = document.createElement("span");
    bar.appendChild(fill);
    siteHeader.appendChild(bar);

    var queued = false;
    var measureProgress = function () {
      queued = false;
      var r = article.getBoundingClientRect();
      var span = r.height - window.innerHeight;
      var p = span > 0 ? -r.top / span : 1;
      p = Math.max(0, Math.min(1, p));
      /* Uncover a fixed gradient rather than stretching it, so the colour
         says how far through you are: pink at the start, cyan at the end. */
      fill.style.clipPath = "inset(0 " + (100 - p * 100).toFixed(2) + "% 0 0)";
    };

    /* Scroll fires far more often than the screen redraws, so do
       the work at most once per frame. */
    window.addEventListener("scroll", function () {
      if (!queued) { queued = true; (raf || window.setTimeout)(measureProgress); }
    }, { passive: true });
    window.addEventListener("resize", measureProgress);
    measureProgress();
  }

  /* ----------------------------------------------------------
     7. TILTING CARDS

     Project cards lean toward the cursor, with a soft glint that
     follows it, like a holographic trading card. Mouse only.

     This script only records WHERE the cursor is, as CSS variables
     (--rx, --ry, --mx, --my). The stylesheet turns those into the
     actual tilt and glint - see TILTING CARDS in site.css.
     ---------------------------------------------------------- */
  var TILT_MAX = 11;  // degrees, for a small card. Big cards tilt less.

  if (!calm && mouse && raf) {
    document.querySelectorAll(".card, .feature").forEach(function (card) {
      var queuedTilt = 0;
      var px = 0.5, py = 0.5, max = TILT_MAX;

      function applyTilt() {
        queuedTilt = 0;
        card.style.setProperty("--ry", ((px - 0.5) * 2 * max).toFixed(2) + "deg");
        card.style.setProperty("--rx", ((0.5 - py) * 2 * max).toFixed(2) + "deg");
        card.style.setProperty("--mx", (px * 100).toFixed(1) + "%");
        card.style.setProperty("--my", (py * 100).toFixed(1) + "%");
      }

      card.addEventListener("pointerenter", function () {
        /* A 1100px feature card at 6 degrees swings its far edge a
           long way. Scale the angle down as the card gets wider. */
        max = Math.max(3.5, Math.min(TILT_MAX, 3000 / card.offsetWidth));
        card.classList.add("is-tilting");
      });

      card.addEventListener("pointermove", function (e) {
        var r = card.getBoundingClientRect();
        px = (e.clientX - r.left) / r.width;
        py = (e.clientY - r.top) / r.height;
        if (!queuedTilt) { queuedTilt = raf(applyTilt); }
      });

      card.addEventListener("pointerleave", function () {
        if (queuedTilt) { window.cancelAnimationFrame(queuedTilt); queuedTilt = 0; }
        card.classList.remove("is-tilting");
        ["--rx", "--ry", "--mx", "--my"].forEach(function (v) { card.style.removeProperty(v); });
      });
    });
  }

  /* ----------------------------------------------------------
     8. GLITCH ON HOVER

     Project pictures split into pink and cyan for a moment when
     you point at them, like a CRT losing sync.

     The colour split needs SVG filters, which have to live inside
     the page itself, so they are added here. The animation that
     uses them is in site.css (GLITCH ON HOVER), switched on by the
     .fx-glitch class on <html> - and that class only goes on once
     the filters exist. A CSS filter pointing at a missing SVG can
     make the picture vanish in some browsers, so the order matters.

     Each filter keeps only the red channel of the image and slides
     it one way, keeps green + blue (cyan) and slides it the other,
     then adds the two back together. Where they overlap you get the
     original picture; at the edges, pink and cyan fringes.
     ---------------------------------------------------------- */
  function splitFilter(id, redX, redY, cyanX) {
    return '<filter id="' + id + '" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">' +
      '<feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r"/>' +
      '<feOffset in="r" dx="' + redX + '" dy="' + redY + '" result="r2"/>' +
      '<feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" result="gb"/>' +
      '<feOffset in="gb" dx="' + cyanX + '" dy="0" result="gb2"/>' +
      '<feBlend in="r2" in2="gb2" mode="screen"/>' +
      "</filter>";
  }

  if (!calm && document.querySelector(".card-art img, .feature-art img, .shot img")) {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.style.position = "absolute";
    svg.innerHTML =
      splitFilter("glitch-a", -5, 0, 4) +
      splitFilter("glitch-b", 4, 1, -3) +
      splitFilter("glitch-c", -2, 0, 2);
    document.body.appendChild(svg);
    document.documentElement.classList.add("fx-glitch");
  }

  /* ----------------------------------------------------------
     9. THE LIVING ASCII PORTRAIT  (about page)

     A see-through canvas laid over the portrait, drawing effects
     ON TOP of the real picture. The picture itself is never redrawn:
     it is already crisp ASCII art, and any re-render is worse.

       - The first time it scrolls into view it "prints" top to
         bottom, the line being written lit up in cyan.
       - Every few seconds a refresh line sweeps down it, like a CRT.
       - Now and then a character glints cyan.
       - Point at it (or drag a finger) and a magnifying lens follows.
         The source file is nearly 3x sharper than it is displayed,
         so the lens shows the real characters the ASCII video player
         drew, readable.

     If anything fails, the canvas is simply never added and the
     plain picture is what you see. Opened straight from disk, the
     browser will not let a script read the picture's pixels, so the
     glints (which need to know where the bright parts are) switch
     off - the lens, print and sweep still work.
     ---------------------------------------------------------- */
  var PORTRAIT = {
    lens:     72,       // lens radius, CSS pixels
    zoom:     2.6,      // lens magnification
    bootMs:   1100,     // the print, top to bottom
    sweepMs:  1600,     // one pass of the refresh line...
    sweepGap: 7000,     // ...this often
    glints:   2,        // new glinting characters per frame
    idleFps:  15        // frame rate when only the glints are moving
  };

  var portraitFrame = document.querySelector(".about-photo .portrait");
  var portraitImg = portraitFrame && portraitFrame.querySelector("img");

  if (portraitImg && !calm && raf && "IntersectionObserver" in window) {
    var whenFont = document.fonts && document.fonts.load
      ? document.fonts.load('500 12px "JetBrains Mono"').then(null, function () {})
      : null;
    var go = function () {
      if (whenFont) { whenFont.then(startPortrait); } else { startPortrait(); }
    };
    if (portraitImg.complete && portraitImg.naturalWidth) { go(); }
    else { portraitImg.addEventListener("load", go); }
  }

  function startPortrait() {
    var P = PORTRAIT;
    var BG = "#14151B";
    var CYAN = "53, 214, 245";
    var RAMP = ".:-=+*#%@";           // glyphs for the glints and the print line
    var CELL_W = 4, CELL_H = 7;       // grid used to find the bright spots

    var canvas = document.createElement("canvas");
    canvas.className = "portrait-live";
    canvas.setAttribute("aria-hidden", "true");
    var ctx = canvas.getContext("2d");
    if (!ctx) { return; }

    var W = 0, H = 0, dpr = 1;
    var crop = null;          // the part of the source picture the <img> shows
    var cols = 0, rows = 0;
    var bright = null;        // per-cell brightness 0..1, or null if unreadable
    var glints = [];
    var pointer = null, lensAt = null, lensAmt = 0;
    var bootStart = 0, booted = false, sweepStart = 0;
    var visible = false, frameId = 0, lastDraw = 0;

    /* The <img> uses object-fit: cover with object-position 50% 20%,
       so on a short window it is cropped. Work out the same crop, so
       the lens magnifies exactly what is under the cursor. */
    function measure() {
      var iw = portraitImg.naturalWidth, ih = portraitImg.naturalHeight;
      var scale = Math.max(W / iw, H / ih);
      var sw = W / scale, sh = H / scale;
      crop = { x: (iw - sw) * 0.5, y: (ih - sh) * 0.2, w: sw, h: sh, scale: scale };
    }

    /* Where are the bright parts? Only the glints need this, and it is
       the one step that fails when the page is opened from disk. */
    function sample() {
      cols = Math.max(1, Math.round(W / CELL_W));
      rows = Math.max(1, Math.round(H / CELL_H));
      try {
        var probe = document.createElement("canvas");
        probe.width = cols;
        probe.height = rows;
        var pctx = probe.getContext("2d");
        pctx.imageSmoothingQuality = "high";
        pctx.drawImage(portraitImg, crop.x, crop.y, crop.w, crop.h, 0, 0, cols, rows);
        var px = pctx.getImageData(0, 0, cols, rows).data;
        bright = [];
        for (var i = 0; i < cols * rows; i++) {
          bright.push((px[i * 4] * 0.299 + px[i * 4 + 1] * 0.587 + px[i * 4 + 2] * 0.114) / 255);
        }
      } catch (e) {
        bright = null;
      }
    }

    function setup() {
      W = portraitImg.clientWidth;
      H = portraitImg.clientHeight;
      if (!W || !H) { return false; }
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      measure();
      sample();
      glints = [];
      return true;
    }

    function glyphAt(i) {
      var b = bright ? bright[i] : 0.6;
      return RAMP.charAt(Math.min(RAMP.length - 1, Math.floor(b * RAMP.length)));
    }

    /* ---- one frame -------------------------------------------- */

    function draw() {
      frameId = 0;
      var now = window.performance.now();
      var sweeping = sweepStart && now - sweepStart < P.sweepMs;
      var busy = !booted || pointer || lensAmt > 0 || sweeping;

      /* Only the glints moving: no need for 60 frames a second. */
      if (!busy && now - lastDraw < 1000 / P.idleFps) { schedule(); return; }
      lastDraw = now;

      ctx.clearRect(0, 0, W, H);
      ctx.font = "500 " + CELL_H + "px \"JetBrains Mono\", Consolas, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      /* First view: hide everything below the print head, and draw the
         line being printed as bright cyan characters with a glow. */
      if (!booted) {
        var p = (now - bootStart) / P.bootMs;
        if (p >= 1) {
          booted = true;
          sweepStart = now + P.sweepGap * 0.4;   // first sweep a few seconds after the print
        } else {
          var y = p * H;
          ctx.fillStyle = BG;
          ctx.fillRect(0, y, W, H - y);
          ctx.fillStyle = "rgb(" + CYAN + ")";
          ctx.shadowColor = "rgba(" + CYAN + ", .9)";
          ctx.shadowBlur = 8;
          var row = Math.min(rows - 1, Math.floor(y / CELL_H));
          for (var c = 0; c < cols; c++) {
            var gi = row * cols + c;
            if (bright && bright[gi] < 0.12) { continue; }
            ctx.fillText(glyphAt(gi), (c + 0.5) * CELL_W, y);
          }
          ctx.shadowBlur = 0;
          schedule();
          return;
        }
      }

      /* The refresh line: a soft cyan band that brightens what it passes. */
      if (!sweepStart || now - sweepStart > P.sweepGap) { sweepStart = now; }
      if (now >= sweepStart && now - sweepStart < P.sweepMs) {
        var band = 46;
        var at = ((now - sweepStart) / P.sweepMs) * (H + band * 2) - band;
        var grad = ctx.createLinearGradient(0, at - band, 0, at + band);
        grad.addColorStop(0, "rgba(" + CYAN + ", 0)");
        grad.addColorStop(0.5, "rgba(" + CYAN + ", .16)");
        grad.addColorStop(1, "rgba(" + CYAN + ", 0)");
        ctx.globalCompositeOperation = "screen";
        ctx.fillStyle = grad;
        ctx.fillRect(0, at - band, W, band * 2);
        ctx.globalCompositeOperation = "source-over";
      }

      /* Glints: a character on a bright part of the picture flashes
         cyan and fades. */
      if (bright) {
        for (var n = 0; n < P.glints; n++) {
          if (Math.random() > 0.35) { continue; }
          var i = Math.floor(Math.random() * bright.length);
          if (bright[i] < 0.45) { continue; }
          glints.push({ i: i, born: now, life: 350 + Math.random() * 500 });
        }
      }
      glints = glints.filter(function (g) { return now - g.born < g.life; });
      for (var k = 0; k < glints.length; k++) {
        var g = glints[k];
        var gx = (g.i % cols + 0.5) * CELL_W, gy = (Math.floor(g.i / cols) + 0.5) * CELL_H;
        var fade = 1 - (now - g.born) / g.life;
        ctx.fillStyle = BG;
        ctx.fillRect(gx - CELL_W / 2, gy - CELL_H / 2, CELL_W, CELL_H);
        ctx.fillStyle = "rgba(" + CYAN + ", " + fade.toFixed(3) + ")";
        ctx.fillText(glyphAt(g.i), gx, gy);
      }

      /* The lens. It opens and closes rather than popping, and shows the
         SOURCE picture magnified - which is sharper than the page's copy. */
      lensAmt += ((pointer ? 1 : 0) - lensAmt) * 0.2;
      if (!pointer && lensAmt < 0.02) { lensAmt = 0; }
      if (lensAmt > 0 && lensAt) {
        var R = P.lens * (0.35 + 0.65 * lensAmt);
        var srcX = crop.x + lensAt.x / crop.scale;
        var srcY = crop.y + lensAt.y / crop.scale;
        var srcR = R / crop.scale / P.zoom;

        ctx.save();
        ctx.beginPath();
        ctx.arc(lensAt.x, lensAt.y, R, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = BG;
        ctx.fillRect(lensAt.x - R, lensAt.y - R, R * 2, R * 2);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(portraitImg, srcX - srcR, srcY - srcR, srcR * 2, srcR * 2,
                      lensAt.x - R, lensAt.y - R, R * 2, R * 2);
        /* Tint the glass cyan. Multiply leaves the dark background dark
           and turns the pale characters blue-ish. */
        ctx.globalCompositeOperation = "multiply";
        ctx.fillStyle = "rgba(" + CYAN + ", " + (0.55 * lensAmt).toFixed(3) + ")";
        ctx.fillRect(lensAt.x - R, lensAt.y - R, R * 2, R * 2);
        ctx.restore();

        /* The rim. */
        ctx.strokeStyle = "rgba(" + CYAN + ", " + (0.85 * lensAmt).toFixed(3) + ")";
        ctx.lineWidth = 1.5;
        ctx.shadowColor = "rgba(" + CYAN + ", .8)";
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(lensAt.x, lensAt.y, R, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      schedule();
    }

    function schedule() {
      if (!frameId && visible && !document.hidden) { frameId = raf(draw); }
    }

    /* ---- wiring ----------------------------------------------- */

    if (!setup()) { return; }
    portraitFrame.appendChild(canvas);

    function aim(e) {
      var r = canvas.getBoundingClientRect();
      pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
      lensAt = pointer;
      schedule();
    }
    function release() { pointer = null; schedule(); }

    canvas.addEventListener("pointermove", aim);
    canvas.addEventListener("pointerdown", aim);
    canvas.addEventListener("pointerleave", release);
    canvas.addEventListener("pointercancel", release);
    canvas.addEventListener("pointerup", function (e) {
      if (e.pointerType !== "mouse") { release(); }   // a lifted finger is gone; a mouse is still hovering
    });

    /* Only animate while it is on screen, and start the print the
       first time it actually comes into view. */
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible && !bootStart) { bootStart = window.performance.now(); }
      schedule();
    }).observe(canvas);

    document.addEventListener("visibilitychange", schedule);

    var resizeWait = 0;
    window.addEventListener("resize", function () {
      window.clearTimeout(resizeWait);
      resizeWait = window.setTimeout(function () { setup(); schedule(); }, 200);
    });
  }

  /* ----------------------------------------------------------
     10. BRAIN WIRING  (home page)

     Thoughts coming out of my head and turning into the words.
     Nerves arc up out of the profile photo, over the name, into a
     handful of neurons, and from there down into letters of the
     headline. Signals leave the photo pink, turn amber at the
     neuron and arrive cyan, and the letter they land in flashes.

       - The nerves grow while the headline decodes. Once the real
         words have landed the last stretch reaches into the letters
         and the whole headline fires, left to right.
       - After that a stray thought fires every second or two.
       - Point at the photo (or tap it) and it thinks HARD.
       - Then a nerve grows on down the page into the big three, the
         newest post and the "get in touch" box (further down).

     Drawn on a canvas BEHIND the text, so it never covers a word.
     The letters light up through the CSS Custom Highlight API,
     which recolours them without touching the page's text at all;
     a browser without it still gets the glow behind the letter.
     Reduced motion: the wiring is drawn once, still, and nothing
     fires.
     ---------------------------------------------------------- */
  var BRAIN = {
    neurons: 6,       // neurons beside the name (a phone fits fewer)
    letters: 12,      // how many letters get wired up (7 on a phone)
    speed:   820,     // how fast a signal travels, CSS pixels per second
    growMs:  1400,    // the nerves growing out of the photo
    reachMs: 550,     // the last stretch, into the letters
    idleMin: 1100,    // a stray thought every idleMin..idleMax ms
    idleMax: 2600,
    glowMs:  1000,    // how long a letter stays lit
    downChance: 0.3,  // share of stray thoughts that go down the page instead
    downSpeed:  1300, // their speed, CSS pixels per second (it is a long way down)
    creep:      150,  // how fast the nerve grows down the page on its own, px per second
    catchUp:    1700  // top speed when it is racing to catch up with your scrolling
  };

  var brainHero  = document.querySelector(".hero");
  var brainHead  = brainHero && brainHero.querySelector(".avatar-lg");
  var brainWords = brainHero && brainHero.querySelector("h1");

  if (brainHead && brainWords && raf && document.createRange && document.createTreeWalker) {
    startBrain();
  }

  function startBrain() {
    var B = BRAIN;
    var HOT = [255, 45, 120], AMBER = [255, 201, 60], CYAN = [53, 214, 245];
    var clock = window.performance || Date;

    var canvas = document.createElement("canvas");
    canvas.className = "hero-net";
    canvas.setAttribute("aria-hidden", "true");
    var ctx = canvas.getContext("2d");
    var cache = document.createElement("canvas");   // the finished wiring, drawn once
    var cctx = cache.getContext("2d");
    if (!ctx || !cctx) { return; }
    brainHero.insertBefore(canvas, brainHero.firstChild);

    /* Lit letters fade in three steps, each a named highlight styled
       in site.css as ::highlight(net-3), net-2 and net-1. */
    var marks = null;
    if (window.CSS && window.CSS.highlights && window.Highlight) {
      marks = [null];
      for (var m = 1; m <= 3; m++) {
        marks.push(new window.Highlight());
        window.CSS.highlights.set("net-" + m, marks[m]);
      }
    }

    var W = 0, H = 0, dpr = 1, ox = 0, oy = 0;
    var head = null, neurons = [], targets = [], pulses = [];
    var stage = "idle";                   // idle -> grow -> reach -> live
    var growAt = 0, reachAt = 0;
    var wordsReady = !brainWords.hasAttribute("data-decoding");
    var fontsReady = !(document.fonts && document.fonts.ready);
    var visible = !("IntersectionObserver" in window);
    var frameId = 0, idleWait = 0, flashWait = 0, lastThink = -1e9;

    /* ---- little helpers --------------------------------------- */

    function rgba(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a.toFixed(3) + ")"; }

    /* The site's gradient: pink at 0, amber at .5, cyan at 1. */
    function mix(u, a) {
      var lo = u < 0.5 ? HOT : AMBER, hi = u < 0.5 ? AMBER : CYAN;
      var f = Math.max(0, Math.min(1, u < 0.5 ? u * 2 : u * 2 - 1));
      return rgba([Math.round(lo[0] + (hi[0] - lo[0]) * f),
                   Math.round(lo[1] + (hi[1] - lo[1]) * f),
                   Math.round(lo[2] + (hi[2] - lo[2]) * f)], a);
    }

    function ease(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return 1 - Math.pow(1 - t, 3); }

    /* An element's box, measured from the canvas's top-left corner. */
    function box(el) {
      var r = el.getBoundingClientRect();
      return { l: r.left - ox, t: r.top - oy, r: r.right - ox, b: r.bottom - oy };
    }
    function pad(b, n) { return { l: b.l - n, t: b.t - n, r: b.r + n, b: b.b + n }; }
    function inside(b, x, y) { return x > b.l && x < b.r && y > b.t && y < b.b; }

    /* A wire is a curve stored as points along it, plus the running
       length at each point - so a signal can sit "so many pixels
       along", and a wire can be drawn only part of the way. */
    function curve(ax, ay, bx, by, cx, cy, dx, dy) {
      var pts = [], run = [], total = 0;
      for (var i = 0; i <= 40; i++) {
        var t = i / 40, u = 1 - t;
        var x = u * u * u * ax + 3 * u * u * t * bx + 3 * u * t * t * cx + t * t * t * dx;
        var y = u * u * u * ay + 3 * u * u * t * by + 3 * u * t * t * cy + t * t * t * dy;
        if (i) {
          var px = pts[pts.length - 2], py = pts[pts.length - 1];
          total += Math.sqrt((x - px) * (x - px) + (y - py) * (y - py));
        }
        pts.push(x, y);
        run.push(total);
      }
      return { pts: pts, run: run, total: total };
    }

    /* Two wires end to end: the nerve to a neuron, then on to a letter. */
    function chain(a, b) {
      var run = a.run.slice();
      for (var i = 1; i < b.run.length; i++) { run.push(a.total + b.run[i]); }
      return { pts: a.pts.concat(b.pts.slice(2)), run: run, total: a.total + b.total, joint: a.total };
    }

    function at(w, s) {
      var i = 1;
      while (i < w.run.length - 1 && w.run[i] < s) { i++; }
      var span = w.run[i] - w.run[i - 1];
      var f = span > 0 ? Math.max(0, Math.min(1, (s - w.run[i - 1]) / span)) : 0;
      return { x: w.pts[i * 2 - 2] + (w.pts[i * 2] - w.pts[i * 2 - 2]) * f,
               y: w.pts[i * 2 - 1] + (w.pts[i * 2 + 1] - w.pts[i * 2 - 1]) * f };
    }

    /* Adds the stretch of wire from s0 to s1 pixels along to the path. */
    function trace(c, w, s0, s1) {
      var p = at(w, s0);
      c.moveTo(p.x, p.y);
      for (var i = 1; i < w.run.length && w.run[i] < s1; i++) {
        if (w.run[i] > s0) { c.lineTo(w.pts[i * 2], w.pts[i * 2 + 1]); }
      }
      p = at(w, s1);
      c.lineTo(p.x, p.y);
    }

    /* ---- where everything goes -------------------------------- */

    function size() {
      var c = canvas.getBoundingClientRect();
      ox = c.left;
      oy = c.top;
      W = brainHero.clientWidth;
      H = brainHero.clientHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      [canvas, cache].forEach(function (cv) {
        cv.width = Math.round(W * dpr);
        cv.height = Math.round(H * dpr);
      });
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /* The photo, and the neurons: scattered through the open space to
       the right of the name and the status pill, above the headline.
       Each nerve leaves the top of the photo, arcs over the name and
       drops into its neuron. */
    function sprout() {
      var a = box(brainHead);
      head = { x: (a.l + a.r) / 2, y: (a.t + a.b) / 2, r: (a.r - a.l) / 2 };

      var who = brainHero.querySelector(".hero-id .who");
      var pill = brainHero.querySelector(".status");
      var words = box(brainWords);
      var avoid = [], right = a.r, top = a.t;
      if (who)  { var wb = box(who);  avoid.push(pad(wb, 16)); right = Math.max(right, wb.r); top = Math.min(top, wb.t); }
      if (pill) { var pb = box(pill); avoid.push(pad(pb, 14)); right = Math.max(right, pb.r); }

      var x0 = right + 28, x1 = Math.min(W - 28, Math.max(words.r, right) + 110);
      var y0 = top - 6, y1 = words.t - 14;
      neurons = [];
      for (var tries = 0; tries < 500 && neurons.length < B.neurons && x1 > x0 && y1 > y0; tries++) {
        var x = x0 + Math.random() * (x1 - x0);
        var y = y0 + Math.random() * (y1 - y0);
        var ok = true;
        for (var i = 0; i < avoid.length && ok; i++) { if (inside(avoid[i], x, y)) { ok = false; } }
        for (var j = 0; j < neurons.length && ok; j++) {
          var dx = neurons[j].x - x, dy = neurons[j].y - y;
          if (dx * dx + dy * dy < 60 * 60) { ok = false; }
        }
        if (ok) { neurons.push({ x: x, y: y, lit: -1e9, tint: 1, delay: Math.random() * 0.3, arrived: false }); }
      }

      /* Nested arcs, like a rainbow: the nearest neuron's nerve leaves
         the right side of the photo and stays low, the farthest leaves
         the very top and arcs highest, so no two nerves cross. */
      neurons.sort(function (p, q) { return p.x - q.x; });
      neurons.forEach(function (n, k) {
        var f = neurons.length > 1 ? k / (neurons.length - 1) : 0.5;
        var ang = -0.6 - f * 1.05;                      // -34 degrees round to -95
        var sx = head.x + Math.cos(ang) * (head.r + 5);
        var sy = head.y + Math.sin(ang) * (head.r + 5);
        var lift = top - 12 - f * 34;                   // always clears the name
        n.axon = curve(sx, sy, sx + (n.x - sx) * 0.2, lift, n.x - (n.x - sx) * 0.15, lift, n.x, n.y);
        n.load = 0;
      });
    }

    /* A route from the photo to a letter: through a neuron, or (for
       letters right under the photo) straight down. Wires arrive at a
       letter from above and stop just inside it, behind the glyph. */
    function route(n, t) {
      if (!n) {
        var ang = Math.atan2(t.ey - head.y, t.ex - head.x);
        var sx = head.x + Math.cos(ang) * (head.r + 5);
        var sy = head.y + Math.sin(ang) * (head.r + 5);
        return { n: null, t: t, w: curve(sx, sy, sx, sy + (t.ey - sy) * 0.5,
                                         t.ex, t.ey - (t.ey - sy) * 0.5, t.ex, t.ey) };
      }
      var d = curve(n.x, n.y, n.x, n.y + (t.ey - n.y) * 0.55,
                    t.ex, t.ey - (t.ey - n.y) * 0.6, t.ex, t.ey);
      return { n: n, t: t, d: d, w: chain(n.axon, d) };
    }

    /* Pick the letters. Only once the headline has finished decoding:
       until then every letter is a random glyph of the wrong width. */
    function wire() {
      size();     // re-measure: the page may have scrolled since the nerves started growing
      var letters = [];
      var walker = document.createTreeWalker(brainWords, NodeFilter.SHOW_TEXT, null, false);
      while (walker.nextNode()) {
        var node = walker.currentNode, text = node.nodeValue;
        for (var i = 0; i < text.length; i++) {
          var ch = text.charAt(i);
          if (!/[A-Za-z0-9]/.test(ch)) { continue; }
          var range = document.createRange();
          range.setStart(node, i);
          range.setEnd(node, i + 1);
          var r = range.getClientRects()[0];
          if (!r || !r.width) { continue; }
          letters.push({ ch: ch, range: range, l: r.left - ox, r: r.right - ox, t: r.top - oy, b: r.bottom - oy });
        }
      }

      if (marks) { marks[1].clear(); marks[2].clear(); marks[3].clear(); }
      targets = [];
      neurons.forEach(function (n) { n.load = 0; });
      var count = Math.min(letters.length, W < 600 ? 7 : B.letters);
      for (var k = 0; k < count; k++) {
        /* One letter from each even slice of the headline, so the
           wiring spreads across all of it. */
        var L = letters[Math.min(letters.length - 1,
                Math.floor((k + 0.15 + Math.random() * 0.7) * letters.length / count))];
        var tall = /[A-Z0-9bdfhijklt]/.test(L.ch);
        var t = { range: L.range, cx: (L.l + L.r) / 2, cy: (L.t + L.b) / 2, h: L.b - L.t,
                  ex: (L.l + L.r) / 2, ey: L.t + (L.b - L.t) * (tall ? 0.24 : 0.42),
                  lit: -1e9, level: 0, routes: [] };

        /* Nearest source wins, with some randomness, and a neuron that
           is already busy counts as further away - so the work spreads
           out instead of two neurons doing everything. Letters right
           under the photo get wired to it directly. */
        var options = [{ n: null, score: Math.abs(t.ex - head.x) + Math.random() * 90 }];
        neurons.forEach(function (n) {
          if (n.y < t.ey - 30) {
            options.push({ n: n, score: Math.abs(t.ex - n.x) * 0.6 + n.load * 70 + Math.random() * 90 });
          }
        });
        options.sort(function (p, q) { return p.score - q.score; });
        var many = Math.random() < 0.5 ? 2 : 1;
        for (var o = 0; o < options.length && o < many; o++) {
          if (options[o].n) { options[o].n.load++; }
          t.routes.push(route(options[o].n, t));
        }
        targets.push(t);
      }

      /* No neuron gets left out: one with nothing to talk to looks like
         a mistake. It takes the closest letter below it. */
      neurons.forEach(function (n) {
        if (n.load || !targets.length) { return; }
        var best = targets[0], bestD = Infinity;
        targets.forEach(function (t) {
          var d = Math.abs(t.ex - n.x) + (n.y < t.ey - 30 ? 0 : 1e6);
          if (d < bestD) { bestD = d; best = t; }
        });
        n.load = 1;
        best.routes.push(route(n, best));
      });
    }

    /* ---- drawing ---------------------------------------------- */

    /* The wiring itself. g = how far the nerves have grown, r = how
       far the last stretch into the letters has, both 0 to 1. */
    function paint(c, g, r) {
      c.lineWidth = 1;
      neurons.forEach(function (n) {
        var f = ease((g - n.delay) / 0.7);
        if (f <= 0) { return; }
        var w = n.axon;
        var grad = c.createLinearGradient(w.pts[0], w.pts[1], n.x, n.y);
        grad.addColorStop(0, rgba(HOT, 0.34));
        grad.addColorStop(1, rgba(CYAN, 0.2));
        c.strokeStyle = grad;
        c.beginPath();
        trace(c, w, 0, w.total * f);
        c.stroke();
      });

      if (r > 0) {
        targets.forEach(function (t) {
          t.routes.forEach(function (ro) {
            var w = ro.n ? ro.d : ro.w;
            if (ro.n) {
              c.strokeStyle = rgba(CYAN, 0.16);
            } else {
              var grad = c.createLinearGradient(w.pts[0], w.pts[1], t.ex, t.ey);
              grad.addColorStop(0, rgba(HOT, 0.3));
              grad.addColorStop(1, rgba(CYAN, 0.16));
              c.strokeStyle = grad;
            }
            c.beginPath();
            trace(c, w, 0, w.total * ease(r));
            c.stroke();
          });
        });
      }

      /* A neuron appears once its nerve reaches it. */
      neurons.forEach(function (n) {
        if ((g - n.delay) / 0.7 < 1) { return; }
        c.beginPath();
        c.arc(n.x, n.y, 3, 0, Math.PI * 2);
        c.fillStyle = "#0B0C13";
        c.fill();
        c.strokeStyle = rgba(CYAN, 0.55);
        c.stroke();
      });
    }

    function bake() {
      cctx.clearRect(0, 0, W, H);
      paint(cctx, 1, 1);
    }

    function frame() {
      frameId = 0;
      var now = clock.now();
      var busy = false;

      /* Move through the stages. */
      if (stage === "grow" && now - growAt >= B.growMs && wordsReady) {
        wire();
        stage = "reach";
        reachAt = now;
      }
      if (stage === "reach" && now - reachAt >= B.reachMs) {
        stage = "live";
        bake();
        /* The nerve down the page waits until the whole headline has lit. */
        window.setTimeout(startNerve, wave() + B.glowMs * 0.6);
        idle();
      }

      ctx.clearRect(0, 0, W, H);
      if (stage === "live") {
        ctx.drawImage(cache, 0, 0, W, H);
      } else {
        var g = Math.min(1, (now - growAt) / B.growMs);
        paint(ctx, g, stage === "reach" ? (now - reachAt) / B.reachMs : 0);
        neurons.forEach(function (n) {
          if (!n.arrived && (g - n.delay) / 0.7 >= 1) { n.arrived = true; n.lit = now; n.tint = 1; }
        });
        busy = g < 1 || stage === "reach";
      }

      /* Lit letters glow from behind. */
      targets.forEach(function (t) {
        var age = now - t.lit;
        if (age >= B.glowMs) { return; }
        busy = true;
        var rad = t.h * 0.6;
        var halo = ctx.createRadialGradient(t.cx, t.cy, 0, t.cx, t.cy, rad);
        halo.addColorStop(0, rgba(CYAN, 0.3 * (1 - age / B.glowMs)));
        halo.addColorStop(1, rgba(CYAN, 0));
        ctx.fillStyle = halo;
        ctx.fillRect(t.cx - rad, t.cy - rad, rad * 2, rad * 2);
      });

      /* Neurons flash as a signal passes through. */
      neurons.forEach(function (n) {
        var age = now - n.lit;
        if (age >= 600) { return; }
        busy = true;
        var a = 1 - age / 600;
        var glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 16);
        glow.addColorStop(0, mix(n.tint, 0.55 * a));
        glow.addColorStop(1, mix(n.tint, 0));
        ctx.fillStyle = glow;
        ctx.fillRect(n.x - 16, n.y - 16, 32, 32);
        ctx.fillStyle = mix(n.tint, 0.4 + 0.6 * a);
        ctx.beginPath();
        ctx.arc(n.x, n.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });

      /* The signals: a bright head with a fading tail, changing colour
         from pink to cyan along the way. */
      var TAIL = 80, STEPS = 6;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      pulses = pulses.filter(function (p) {
        var s = (now - p.t0) / 1000 * B.speed;
        busy = true;
        if (s < 0) { return true; }
        var w = p.ro.w;
        if (!p.left) { p.left = true; flashHead(); }
        if (w.joint && p.s < w.joint && s >= w.joint) { p.ro.n.lit = now; p.ro.n.tint = w.joint / w.total; }
        p.s = s;
        if (s >= w.total) { p.ro.t.lit = now; return false; }

        for (var k = 0; k < STEPS; k++) {
          var s1 = s - k * TAIL / STEPS;
          if (s1 <= 0) { break; }
          ctx.strokeStyle = mix(s1 / w.total, 0.85 * (1 - k / STEPS));
          ctx.beginPath();
          trace(ctx, w, Math.max(0, s1 - TAIL / STEPS), s1);
          ctx.stroke();
        }
        var tip = at(w, s);
        ctx.fillStyle = mix(s / w.total, 1);
        ctx.shadowColor = mix(s / w.total, 0.9);
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(tip.x, tip.y, 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        return true;
      });

      /* Step each lit letter down its fade. */
      if (marks) {
        targets.forEach(function (t) {
          var age = now - t.lit;
          var lv = age < B.glowMs * 0.25 ? 3 : age < B.glowMs * 0.55 ? 2 : age < B.glowMs ? 1 : 0;
          if (lv !== t.level) {
            if (t.level) { marks[t.level]["delete"](t.range); }
            if (lv) { marks[lv].add(t.range); }
            t.level = lv;
          }
        });
      }

      if (busy) { schedule(); }
    }

    function schedule() {
      if (!frameId && visible && !document.hidden) { frameId = raf(frame); }
    }

    /* ---- thinking --------------------------------------------- */

    function fire(t, delay, ro) {
      if (!t || !t.routes.length) { return; }
      ro = ro || t.routes[Math.floor(Math.random() * t.routes.length)];
      pulses.push({ ro: ro, t0: clock.now() + delay, s: 0, left: false });
    }

    function anyLetter() { return targets[Math.floor(Math.random() * targets.length)]; }

    /* The first time: every wired letter fires, timed so they land in
       reading order. Returns how long until the last one lands, in ms. */
    function wave() {
      var slowest = 0;
      targets.forEach(function (t) { slowest = Math.max(slowest, t.routes[0].w.total); });
      targets.forEach(function (t, k) {
        fire(t, k * 70 + (slowest - t.routes[0].w.total) / B.speed * 1000, t.routes[0]);
      });
      return (targets.length - 1) * 70 + slowest / B.speed * 1000;
    }

    function idle() {
      window.clearTimeout(idleWait);
      idleWait = window.setTimeout(function () {
        if (!document.hidden) {
          /* Now and then a thought travels all the way down to the work. */
          var down = Math.random() < B.downChance && fireNerve();
          if (!down && visible && targets.length) { fire(anyLetter(), 0); schedule(); }
        }
        idle();
      }, B.idleMin + Math.random() * (B.idleMax - B.idleMin));
    }

    function flashHead() {
      brainHead.classList.add("is-firing");
      window.clearTimeout(flashWait);
      flashWait = window.setTimeout(function () { brainHead.classList.remove("is-firing"); }, 140);
    }

    function think() {
      var now = clock.now();
      if (calm || stage !== "live" || now - lastThink < 1200) { return; }
      lastThink = now;
      for (var i = 0; i < 7; i++) { fire(anyLetter(), i * 80); }
      schedule();
    }

    /* ---- the nerve down the page -------------------------------

       Once the headline has fired, a nerve grows out of the bottom of
       the photo and down the left margin, wandering through random
       neurons, with little dead-end twigs and the odd shortcut -
       grown, not ruled. It creeps down on its own, and speeds up to
       catch you if you scroll ahead. Its glowing tip waits near the
       bottom of the screen, pulling your eye down.

       It branches into each thing worth seeing: the big three, the
       newest dev post, and last the "get in touch" box. Whatever it
       plugs into lights up. After that, some of the stray thoughts
       travel all the way down and zap one, lighting each neuron they
       pass.

       An SVG rather than a canvas: it is most of the page tall, and a
       canvas that size would eat memory. Everything positioned on the
       page (the cards, the hero text) paints over it, and it keeps to
       the margin, so it never covers a word. */
    var SVGNS = "http://www.w3.org/2000/svg";
    var host = brainHero.parentNode;          // <main>
    var ends = [].slice.call(document.querySelectorAll(".feature-list .feature"));
    var newest = document.querySelector(".posts .post-row");
    var talk = document.querySelector(".callout");
    if (newest) { ends.push(newest); }
    if (talk) { ends.push(talk); }
    var nerve = null;
    var nerveFrameId = 0, nerveLast = 0;

    function svg(tag, attrs, parent) {
      var el = document.createElementNS(SVGNS, tag);
      for (var k in attrs) { if (attrs.hasOwnProperty(k)) { el.setAttribute(k, attrs[k]); } }
      if (parent) { parent.appendChild(el); }
      return el;
    }

    /* Where an element sits inside <main>, ignoring transforms: the
       cards may be mid-fade (shifted down) or tilting right now. */
    function spot(el) {
      var x = 0, y = 0;
      while (el && el !== host) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; }
      return { x: x, y: y };
    }

    function line(pts) {
      var run = [0], total = 0;
      for (var i = 2; i < pts.length; i += 2) {
        var dx = pts[i] - pts[i - 2], dy = pts[i + 1] - pts[i - 1];
        total += Math.sqrt(dx * dx + dy * dy);
        run.push(total);
      }
      return { pts: pts, run: run, total: total };
    }

    function pathOf(w) {
      var d = "M" + w.pts[0].toFixed(1) + " " + w.pts[1].toFixed(1);
      for (var i = 2; i < w.pts.length; i += 2) { d += "L" + w.pts[i].toFixed(1) + " " + w.pts[i + 1].toFixed(1); }
      return d;
    }

    /* The point on a top-to-bottom wire at a given height. */
    function alongY(w, y) {
      var i = 1, n = w.pts.length / 2;
      while (i < n - 1 && w.pts[i * 2 + 1] < y) { i++; }
      var y0 = w.pts[i * 2 - 1], y1 = w.pts[i * 2 + 1];
      var f = y1 > y0 ? Math.max(0, Math.min(1, (y - y0) / (y1 - y0))) : 1;
      return { x: w.pts[i * 2 - 2] + (w.pts[i * 2] - w.pts[i * 2 - 2]) * f, y: y0 + (y1 - y0) * f };
    }

    /* Restart a CSS flash, even if it is mid-flash. */
    function flash(el, cls) {
      el.classList.remove(cls);
      void el.getBoundingClientRect();
      el.classList.add(cls);
    }

    /* A wire that draws itself along its length (stroke-dashoffset)
       when its moment comes, instead of appearing all at once. */
    function drawn(w, attrs, parent, ms, trigger) {
      var len = w.total.toFixed(1);
      attrs.d = pathOf(w);
      attrs.fill = "none";
      attrs["stroke-dasharray"] = len + " " + len;
      attrs["stroke-dashoffset"] = len;
      return { w: w, el: svg("path", attrs, parent), ms: ms, trigger: trigger, at: 0, done: false };
    }
    function finish(d) {
      d.done = true;
      d.el.setAttribute("stroke-dashoffset", 0);
      if (d.end) { d.end.classList.add("is-on"); }
    }
    function progress(d, now) {
      var f = Math.min(1, (now - d.at) / d.ms);
      d.el.setAttribute("stroke-dashoffset", (d.w.total * (1 - ease(f))).toFixed(1));
      if (f >= 1) { finish(d); }
      return f < 1;
    }

    function buildNerve() {
      var old = nerve;
      if (old) { host.removeChild(old.root); }
      host.classList.add("nerve-host");

      /* The content column, and the margin to its left. */
      var W = host.clientWidth;
      var cl = spot(ends[0]).x;
      var band = [cl - Math.min(170, cl * 0.85), cl - Math.min(24, cl * 0.35)];
      var bw = band[1] - band[0];

      /* Out of the lower left of the photo. */
      var hp = spot(brainHead), hr = brainHead.offsetWidth / 2;
      var hx = hp.x + hr, hy = hp.y + brainHead.offsetHeight / 2;
      var x = hx + Math.cos(Math.PI * 0.72) * (hr + 5);
      var y = hy + Math.sin(Math.PI * 0.72) * (hr + 5);
      var top = y;

      /* Where each thing plugs in. */
      var plugs = ends.map(function (el, k) {
        var at = spot(el), h = el.offsetHeight, py;
        var btn = el === talk ? el.querySelector(".btn") : null;
        if (btn) { py = spot(btn).y + btn.offsetHeight / 2; }
        else if (el === newest || el === talk) { py = at.y + h / 2; }
        else { py = at.y + Math.min(h * 0.3, 110); }
        var was = old && old.plugs[k];
        return { el: el, x: at.x - 6, y: py, by: py - 64,
                 done: calm || !!(was && was.done && was.el === el) };
      });

      /* Wander down the margin through random neurons, with a junction
         just above each plug. Every step goes DOWN, so "grown this
         far" is just a height. */
      var pts = [x, y], nodes = [], lead = true;
      function wander() {
        if (x < band[0] || x > band[1]) { return band[0] + Math.random() * bw; }
        return Math.max(band[0], Math.min(band[1], x + (Math.random() - 0.5) * bw * 0.9));
      }
      function link(nx, ny) {
        var dy = ny - y;
        var c = lead
          ? curve(x, y, x - 6, y + Math.min(40, dy * 0.4), nx, ny - dy * 0.5, nx, ny)   // leave the photo heading down
          : curve(x, y, x, y + dy * 0.5, nx, ny - dy * 0.5, nx, ny);
        lead = false;
        for (var i = 2; i < c.pts.length; i++) { pts.push(c.pts[i]); }
        x = nx;
        y = ny;
        var node = { x: x, y: y, k: pts.length - 2 };
        nodes.push(node);
        return node;
      }
      plugs.forEach(function (p) {
        var jy = Math.max(p.by, y + 30);
        while (y + 110 < jy - 60) { link(wander(), Math.min(jy - 60, y + 110 + Math.random() * 110)); }
        p.junction = link(wander(), jy);
        p.junction.plug = p;
        p.by = jy;
      });
      var spine = line(pts);
      var end = y;

      /* Each branch, and the route a thought takes to it. */
      plugs.forEach(function (p) {
        var j = p.junction;
        var reach = Math.max(10, Math.abs(p.x - j.x) * 0.6);
        p.branch = curve(j.x, j.y, j.x, j.y + (p.y - j.y) * 0.6, p.x - reach, p.y, p.x, p.y);
        p.route = line(pts.slice(0, j.k + 2).concat(p.branch.pts.slice(2)));
        p.passes = nodes.filter(function (n) { return n.k < j.k; })
                        .map(function (n) { return { s: p.route.run[n.k / 2], n: n }; });
      });

      var H = Math.ceil(plugs[plugs.length - 1].y + 40);
      var root = svg("svg", { "class": "nerves", width: W, height: H, viewBox: "0 0 " + W + " " + H, "aria-hidden": "true" });
      var defs = svg("defs", {}, root);

      /* Pink at the brain, amber on the way, cyan at the bottom - the
         same journey the thoughts in the headline take. */
      var grad = svg("linearGradient", { id: "nerve-grad", gradientUnits: "userSpaceOnUse",
                                         x1: 0, y1: top, x2: 0, y2: end + 80 }, defs);
      svg("stop", { offset: "0", "stop-color": "rgb(255,45,120)" }, grad);
      svg("stop", { offset: ".5", "stop-color": "rgb(255,201,60)" }, grad);
      svg("stop", { offset: "1", "stop-color": "rgb(53,214,245)" }, grad);
      var halo = svg("radialGradient", { id: "nerve-glow" }, defs);
      svg("stop", { offset: "0", "stop-color": "rgb(53,214,245)", "stop-opacity": ".75" }, halo);
      svg("stop", { offset: "1", "stop-color": "rgb(53,214,245)", "stop-opacity": "0" }, halo);
      var clip = svg("clipPath", { id: "nerve-clip" }, defs);
      var reveal = svg("rect", { x: 0, y: 0, width: W, height: 0 }, clip);

      var grown = calm ? end : old ? Math.min(Math.max(old.grown, top), end) : top;
      var wires = [];

      /* Twigs and shortcuts first, so the main nerve draws over them.
         A twig grows when the nerve reaches its neuron; a shortcut
         (skipping one neuron) forms once the nerve reaches its far end. */
      if (bw > 30) {
        nodes.forEach(function (n) {
          if (n.plug || Math.random() > 0.4) { return; }
          var tx = Math.max(band[0], Math.min(band[1], n.x + (Math.random() < 0.5 ? -1 : 1) * (14 + Math.random() * 30)));
          var ty = n.y + 22 + Math.random() * 40;
          var t = drawn(curve(n.x, n.y, n.x, n.y + (ty - n.y) * 0.6, tx, ty - (ty - n.y) * 0.4, tx, ty),
                        { stroke: "url(#nerve-grad)", "stroke-width": 1, "stroke-opacity": 0.32 }, root, 500, n.y);
          t.end = svg("circle", { cx: tx, cy: ty, r: 1.8, fill: "rgb(53,214,245)", "fill-opacity": 0.45, "class": "nerve-node" }, root);
          wires.push(t);
        });
        for (var i = 0; i + 2 < nodes.length; i++) {
          if (Math.random() > 0.25) { continue; }
          var a = nodes[i], b = nodes[i + 2];
          var bend = (Math.random() < 0.5 ? -1 : 1) * Math.min(18, bw * 0.3);
          wires.push(drawn(curve(a.x, a.y, a.x + bend, a.y + (b.y - a.y) * 0.5, b.x + bend, b.y - (b.y - a.y) * 0.5, b.x, b.y),
                           { stroke: "url(#nerve-grad)", "stroke-width": 1, "stroke-opacity": 0.3 }, root, 800, b.y));
          i++;
        }
      }

      /* The nerve itself, shown as far as it has grown. */
      svg("path", { d: pathOf(spine), fill: "none", stroke: "url(#nerve-grad)", "stroke-width": 1.2,
                    "stroke-opacity": 0.5, "clip-path": "url(#nerve-clip)" }, root);
      nodes.forEach(function (n) {
        n.el = svg("circle", { cx: n.x, cy: n.y, r: n.plug ? 3.4 : 2.8, fill: "#0B0C13",
                               stroke: "rgb(53,214,245)", "stroke-opacity": 0.6, "class": "nerve-node" }, root);
        n.on = false;
      });

      /* The branches into the cards, drawn when the nerve gets there. */
      plugs.forEach(function (p) {
        p.wire = drawn(p.branch, { stroke: "rgb(53,214,245)", "stroke-opacity": 0.5, "stroke-width": 1.2 }, root, 700, p.by);
        p.wire.end = svg("circle", { cx: p.x, cy: p.y, r: 3.5, fill: "rgb(53,214,245)", "class": "nerve-node" }, root);
        if (p.done) { finish(p.wire); }
      });

      var layer = svg("g", {}, root);
      var tips = svg("g", { "class": "nerve-tips" }, root);
      var glow = svg("circle", { r: 12, fill: "url(#nerve-glow)", "class": "nerve-tip" }, tips);
      var dot = svg("circle", { r: 2.6, fill: "rgb(53,214,245)" }, tips);

      nerve = { root: root, reveal: reveal, layer: layer, spine: spine, nodes: nodes, wires: wires,
                plugs: plugs, tips: tips, glow: glow, dot: dot, hostW: W, hostH: host.offsetHeight,
                top: top, end: end, grown: grown, v: 0, pulses: [] };

      /* Anything the nerve had already reached before a rebuild is
         simply there - no second grow-in. Done before the SVG goes on
         the page, so nothing animates. */
      nodes.forEach(function (n) { if (n.y <= grown) { n.on = true; n.el.classList.add("is-on"); } });
      wires.forEach(function (d) { if (d.trigger <= grown) { finish(d); } });

      host.insertBefore(root, host.firstChild);
      drawGrowth(clock.now());
    }

    /* Everything that follows the growing tip. True while something
       is still mid-animation. */
    function drawGrowth(now) {
      var N = nerve, busy = false;
      N.reveal.setAttribute("height", N.grown.toFixed(1));
      var p = alongY(N.spine, N.grown);
      [N.glow, N.dot].forEach(function (c) {
        c.setAttribute("cx", p.x.toFixed(1));
        c.setAttribute("cy", p.y.toFixed(1));
      });
      N.tips.style.opacity = N.grown < N.end - 1 ? "1" : "0";

      N.nodes.forEach(function (n) {
        if (!n.on && N.grown >= n.y - 1) { n.on = true; n.el.classList.add("is-on"); }
      });
      N.wires.forEach(function (d) {
        if (d.done) { return; }
        if (!d.at && N.grown >= d.trigger - 1) { d.at = now; }
        if (d.at && progress(d, now)) { busy = true; }
      });

      /* Reached something: branch into it, then light it up. */
      N.plugs.forEach(function (p) {
        if (p.done) { return; }
        if (!p.wire.at && N.grown >= p.by - 1) { p.wire.at = now; }
        if (!p.wire.at) { return; }
        if (progress(p.wire, now)) { busy = true; return; }
        p.done = true;
        flash(p.el, "is-zapped");
      });
      return busy;
    }

    function nerveTick() {
      nerveFrameId = 0;
      var N = nerve, now = clock.now();
      var dt = Math.min(64, now - (nerveLast || now));
      nerveLast = now;
      var busy = false;

      /* Creep toward just above the bottom of the screen. Scroll past
         the tip and it speeds up to catch you (the further behind, the
         faster) - easing into it, never a jump. */
      var viewTop = -host.getBoundingClientRect().top;
      var want = Math.min(N.end, viewTop + window.innerHeight - 70);
      if (want - N.grown > 0.5) {
        var behind = viewTop + window.innerHeight * 0.3 - N.grown;
        var goal = Math.min(B.catchUp, B.creep + Math.max(0, behind) * 3);
        N.v += (goal - N.v) * Math.min(1, dt / 300);
        N.grown = Math.min(want, N.grown + N.v * dt / 1000);
        busy = true;
      } else {
        /* Close enough: land exactly, or the last junction (which sits
           exactly at the end) can be missed by a fraction of a pixel. */
        N.grown = Math.max(N.grown, want);
        N.v = Math.min(N.v, B.creep);
      }
      if (drawGrowth(now)) { busy = true; }

      /* Thoughts on their way down. */
      N.pulses = N.pulses.filter(function (q) {
        var s = (now - q.t0) / 1000 * B.downSpeed;
        q.p.passes.forEach(function (ps) { if (q.s < ps.s && s >= ps.s) { flash(ps.n.el, "is-lit"); } });
        q.s = s;
        if (s >= q.w.total) {
          N.layer.removeChild(q.trail);
          N.layer.removeChild(q.dot);
          flash(q.p.el, "is-zapped");
          return false;
        }
        busy = true;
        q.trail.setAttribute("stroke-dashoffset", (90 - s).toFixed(1));
        var pt = at(q.w, s);
        q.dot.setAttribute("cx", pt.x.toFixed(1));
        q.dot.setAttribute("cy", pt.y.toFixed(1));
        q.dot.setAttribute("fill", mix((pt.y - N.top) / (N.end + 80 - N.top), 1));
        return true;
      });

      if (busy) { scheduleNerve(); } else { nerveLast = 0; }
    }

    function scheduleNerve() {
      if (nerve && !calm && !nerveFrameId && !document.hidden) { nerveFrameId = raf(nerveTick); }
    }

    /* Send a thought down to something the nerve has reached.
       Returns false if it has not reached anything yet. */
    function fireNerve() {
      var ready = nerve ? nerve.plugs.filter(function (p) { return p.done; }) : [];
      if (!ready.length) { return false; }
      var p = ready[Math.floor(Math.random() * ready.length)];
      var w = p.route;
      nerve.pulses.push({
        p: p, w: w, t0: clock.now(), s: 0,
        trail: svg("path", { d: pathOf(w), fill: "none", stroke: "url(#nerve-grad)", "stroke-width": 2,
                             "stroke-linecap": "round", "stroke-dasharray": "90 " + Math.ceil(w.total + 200),
                             "stroke-dashoffset": 90 }, nerve.layer),
        dot: svg("circle", { r: 2.6, cx: w.pts[0], cy: w.pts[1] }, nerve.layer)
      });
      flashHead();
      scheduleNerve();
      return true;
    }

    function startNerve() {
      if (nerve || !ends.length || !window.SVGElement) { return; }
      buildNerve();
      scheduleNerve();
      window.addEventListener("scroll", scheduleNerve);

      /* Something above changed height after the nerve was laid out (a
         slow image, say): the plugs would point at where things USED to
         be, so lay it out again. A change of width is the resize
         handler's job. */
      if ("ResizeObserver" in window) {
        var shiftWait = 0;
        new window.ResizeObserver(function () {
          if (!nerve || host.clientWidth !== nerve.hostW || Math.abs(host.offsetHeight - nerve.hostH) < 3) { return; }
          window.clearTimeout(shiftWait);
          shiftWait = window.setTimeout(function () { buildNerve(); scheduleNerve(); }, 200);
        }).observe(host);
      }
    }

    /* If the hero never shows (the page opened scrolled down), grow it anyway. */
    window.setTimeout(function () { if (stage === "idle") { startNerve(); } }, 6000);

    /* ---- wiring it all up ------------------------------------- */

    /* Reduced motion: the finished wiring, drawn once. */
    function still() {
      wire();
      bake();
      stage = "live";
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(cache, 0, 0, W, H);
      startNerve();
    }

    /* Starts once the fonts are in (they move every letter) and the
       hero is actually on screen. */
    function kick() {
      if (stage === "idle" && fontsReady && visible) {
        size();
        sprout();
        if (calm) { if (wordsReady) { still(); } return; }
        stage = "grow";
        growAt = clock.now();
      }
      schedule();
    }

    if (!fontsReady) {
      document.fonts.ready.then(function () { fontsReady = true; kick(); });
    }
    if (!wordsReady) {
      brainWords.addEventListener("decoded", function () { wordsReady = true; kick(); });
    }
    if (!visible) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        kick();
      }).observe(canvas);
    }

    brainHead.addEventListener("pointerenter", think);
    brainHead.addEventListener("click", think);
    document.addEventListener("visibilitychange", schedule);

    /* A new window size moves every letter: rewire from scratch,
       skipping the grow-in. */
    var resizeWait = 0;
    window.addEventListener("resize", function () {
      window.clearTimeout(resizeWait);
      resizeWait = window.setTimeout(function () {
        if (stage !== "idle") {
          size();
          sprout();
          pulses = [];
          if (calm) { still(); }
          else if (stage !== "grow") {
            wire();
            bake();
            if (stage === "reach") { stage = "live"; idle(); }
          }
          schedule();
        }
        /* The nerves after the brain: the right one starts at a neuron. */
        if (nerve) { buildNerve(); scheduleNerve(); }
      }, 200);
    });

    kick();
  }

  /* ----------------------------------------------------------
     11. CONTACT FORM - deliberately NOT here.

     It used to live in this file, hunting for .form[action]. The
     form no longer has an action attribute (it posts with fetch),
     so that code could never fire again - dead code that still
     looked live. The real thing is an inline script at the bottom
     of contact.html, kept next to the markup it depends on.
     ---------------------------------------------------------- */
})();
