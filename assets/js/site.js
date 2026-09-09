/* ============================================================
   Jonjoe1001 - personal site
   Two small features. No libraries, no build step.

   1. Mobile nav toggle
   2. Project filter chips
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
})();
