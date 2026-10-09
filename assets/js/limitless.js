/* ============================================================
   Jonjoe1001 - Limitless Lab page (limitless.html)

   Builds the "Everything in the lab" grid from the items.json
   of each wing, so a newly merged item shows up here by itself.
   Each wing is its own repo, published under this domain:

     /limitless-arcade/items.json   games
     /limitless-lab/items.json      simulations
     /limitless-tools/items.json    tools (the "Workshop")

   An items.json entry looks like:
     { "slug", "title", "blurb", "tags": [...], "added": "YYYY-MM-DD",
       "soon": true (optional, planned but not built yet) }

   If a list can't load (offline, or opened from a local file),
   the wing cards at the top still work, and the message under
   the grid says so.
   ============================================================ */

(function () {
  "use strict";

  /* ---- the three wings -------------------------------------- */
  var WINGS = [
    { id: "arcade",   name: "Arcade",   path: "/limitless-arcade/", one: "game",       many: "games",       glow: "rgba(255, 45, 120, .26)" },
    { id: "lab",      name: "Lab",      path: "/limitless-lab/",    one: "simulation", many: "simulations", glow: "rgba(53, 214, 245, .26)" },
    { id: "workshop", name: "Workshop", path: "/limitless-tools/",  one: "tool",       many: "tools",       glow: "rgba(255, 201, 60, .26)" }
  ];
  var NEW_DAYS = 21;

  var grid = document.getElementById("lab-items");
  var status = document.getElementById("lab-status");
  if (!grid) { return; }

  /* Small element helper: el("a", { href: "#" }, "text", child...) */
  function el(tag, attrs) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c !== null && c !== undefined) { node.append(c); }
    }
    return node;
  }

  /* "Neural Net Playground" -> "NN" */
  function initials(title) {
    var words = String(title).split(/\s+/).filter(Boolean);
    return words.slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join("") || "?";
  }

  function isNew(added) {
    var t = Date.parse(added + "T00:00:00Z");
    return !isNaN(t) && (Date.now() - t) < NEW_DAYS * 86400000;
  }

  /* Only trust well-formed entries: this text comes from another repo. */
  function valid(item) {
    return item && typeof item.slug === "string" && /^[a-z0-9][a-z0-9-]*$/.test(item.slug) &&
      typeof item.title === "string" && typeof item.blurb === "string" &&
      typeof item.added === "string";
  }

  function card(item, wing) {
    var href = wing.path + "items/" + item.slug + "/";
    var art = el("div", { "class": "card-art is-blank", "aria-hidden": "true" },
      el("span", { "class": "initials" }, initials(item.title)));
    art.style.setProperty("--blank-glow", wing.glow);

    var tags = el("div", { "class": "tags" },
      el("span", { "class": "tag lab-tag is-" + wing.id }, wing.one));
    if (item.soon) { tags.append(el("span", { "class": "tag" }, "Coming soon")); }
    else if (isNew(item.added)) { tags.append(el("span", { "class": "tag is-live" }, "New")); }

    var title = item.soon ? item.title : el("a", { href: href }, item.title);
    var body = el("div", { "class": "card-body" },
      tags,
      el("h3", {}, title),
      el("p", {}, item.blurb),
      item.soon ? null : el("div", { "class": "card-links" }, el("a", { href: href }, "Open →")));

    var c = el("article", { "class": "card lab-item" + (item.soon ? " is-soon" : ""), "data-wing": wing.id }, art, body);
    return c;
  }

  /* ---- load every wing, then draw ---------------------------- */
  function load(wing) {
    return fetch(wing.path + "items.json", { cache: "no-cache" })
      .then(function (r) { if (!r.ok) { throw new Error(r.status); } return r.json(); })
      .then(function (list) {
        return (Array.isArray(list) ? list : []).filter(valid).map(function (item) {
          return { item: item, wing: wing };
        });
      })
      .catch(function () { return null; });
  }

  Promise.all(WINGS.map(load)).then(function (results) {
    var all = [];
    var failed = 0;

    results.forEach(function (list, i) {
      var wing = WINGS[i];
      var count = document.querySelector('[data-count="' + wing.id + '"]');
      if (!list) { failed++; return; }
      var built = list.filter(function (x) { return !x.item.soon; }).length;
      if (count) { count.textContent = built + " " + (built === 1 ? wing.one : wing.many); }
      all = all.concat(list);
    });

    /* Newest first; built items before planned ones; then A-Z. */
    all.sort(function (a, b) {
      return (a.item.soon ? 1 : 0) - (b.item.soon ? 1 : 0) ||
        b.item.added.localeCompare(a.item.added) ||
        a.item.title.localeCompare(b.item.title);
    });

    grid.replaceChildren.apply(grid, all.map(function (x) { return card(x.item, x.wing); }));

    if (!all.length) {
      status.textContent = "Couldn't load the list right now. Open a wing above to see everything in it.";
    } else if (failed) {
      status.textContent = "One wing couldn't load right now. Its card above still works.";
    } else {
      status.hidden = true;
    }
  });

  /* ---- filter chips ------------------------------------------ */
  var chips = document.querySelectorAll(".lab-chip");
  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      var want = chip.getAttribute("data-wing");
      chips.forEach(function (c) { c.setAttribute("aria-pressed", String(c === chip)); });
      grid.querySelectorAll(".lab-item").forEach(function (c) {
        c.hidden = want !== "all" && c.getAttribute("data-wing") !== want;
      });
    });
  });
})();
