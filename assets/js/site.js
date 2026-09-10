/* ============================================================
   Jonjoe1001 - personal site
   Three small features. No libraries, no build step.

   1. Mobile nav toggle
   2. Project filter chips
   3. Background sprites
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

  /* ----------------------------------------------------------
     4. CONTACT FORM - deliberately NOT here.

     It used to live in this file, hunting for .form[action]. The
     form no longer has an action attribute (it posts with fetch),
     so that code could never fire again - dead code that still
     looked live. The real thing is an inline script at the bottom
     of contact.html, kept next to the markup it depends on.
     ---------------------------------------------------------- */
})();
