/* ============================================================
   Jonjoe1001 - visitor stats (GoatCounter)

   What gets counted, and what it's called on the dashboard:

   PAGE VIEWS   every page, automatically      /projects.html
   download-*   any file download click         download-wheelhouse-1.0.zip
   outbound-*   any link that leaves the site   outbound-jonjoe1001.itch.io/emergent-evolver
   email-click  the "Email me" button           email-click
   contact-sent the contact form went through   contact-sent
   read-end-*   scrolled to the end of a post   read-end-/posts/2026-09-10-how-...
   404-*        someone hit a page that is gone 404-/old-page.html

   On the dashboard, "events" are everything that isn't a page.
   Each event's title says which page it happened on.

   Privacy: GoatCounter sets no cookies and stores no IP addresses,
   so there is no cookie banner to show. Ad blockers do block it,
   so every number here is a floor, not the exact count.

   To stop counting your OWN visits: open
   https://jonjoe1001.dev/#toggle-goatcounter once in each browser
   you use (it pops up a confirmation). Do it again to undo.
   Nothing is counted on localhost or a double-clicked file either.
   ============================================================ */

(function () {
  "use strict";

  /* ---- settings -------------------------------------------- */

  /* The site code picked at signup. The dashboard lives at
     https://CODE.goatcounter.com  - change this one word if it moves. */
  var CODE = "jonjoe1001";

  /* How far down a post counts as "read to the end". 0.9 = 90%. */
  var READ_END_AT = 0.9;

  /* ---- load GoatCounter ------------------------------------ */

  /* Same as pasting their <script> tag into every page, just done
     once here so there is one line to change instead of thirteen.
     count.js counts the page view by itself as soon as it loads. */
  var tag = document.createElement("script");
  tag.async = true;
  tag.src = "https://gc.zgo.at/count.js";
  tag.setAttribute("data-goatcounter", "https://" + CODE + ".goatcounter.com/count");
  document.head.appendChild(tag);

  /* Send one event. If count.js hasn't loaded yet (or an ad blocker
     ate it) this quietly does nothing, which is the right failure:
     a stats hiccup must never break a link or the contact form. */
  function event(name, title) {
    if (window.goatcounter && window.goatcounter.count) {
      window.goatcounter.count({
        path: name.slice(0, 200),          // GoatCounter's name limit
        title: title || location.pathname,
        event: true
      });
    }
  }

  /* The page this happened on, for the event title. */
  function here() { return "on " + location.pathname; }

  /* ---- clicks: downloads, outbound links, email ----------- */

  /* One listener on the whole page instead of one per link, so a link
     added to any page later is tracked with no extra work.
     "auxclick" is a middle-click (open in new tab), which people do a
     lot on outbound links and would otherwise be missed. */
  function onClick(e) {
    var a = e.target.closest ? e.target.closest("a[href]") : null;
    if (!a) { return; }

    var url;
    try { url = new URL(a.href, location.href); } catch (err) { return; }

    if (url.protocol === "mailto:") {
      event("email-click", here());
      return;
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") { return; }

    var file = url.pathname.split("/").pop();

    /* A download is a link marked "download", or one straight to a file
       type people download. Checked by file extension, NOT by "/downloads/"
       in the address: python.org/downloads/ is a web page, and the first
       test of this file counted it as a download. */
    var isDownload = a.hasAttribute("download") ||
                     /\.(zip|exe|msi|7z|rar|apk|dmg|pdf)$/i.test(url.pathname);

    if (url.host === location.host) {
      if (isDownload) { event("download-" + file, here()); }
      return;  // an ordinary link to another page: the page view covers it
    }

    /* Leaving the site. Drop "www." so www.x.com and x.com count as one. */
    var dest = url.host.replace(/^www\./, "") + url.pathname.replace(/\/$/, "");
    event((isDownload ? "download-" : "outbound-") + dest, here());
  }

  document.addEventListener("click", onClick, true);
  document.addEventListener("auxclick", onClick, true);

  /* ---- contact form --------------------------------------- */

  /* contact.html fires this only after Formspree says the message
     really arrived, so failed sends and bot traps don't count. */
  document.addEventListener("jj:contact-sent", function () {
    event("contact-sent", here());
  });

  /* ---- read to the end (dev posts only) ------------------- */

  if (location.pathname.indexOf("/posts/") !== -1) {
    var sent = false;
    var check = function () {
      if (sent) { return; }
      var doc = document.documentElement;
      var seen = (window.scrollY + window.innerHeight) / doc.scrollHeight;
      if (seen >= READ_END_AT) {
        sent = true;
        window.removeEventListener("scroll", check);
        /* Delayed a moment so count.js has definitely finished loading
           on a short post that starts out already "at the end". */
        setTimeout(function () { event("read-end-" + location.pathname, document.title); }, 1500);
      }
    };
    window.addEventListener("scroll", check, { passive: true });
  }

  /* ---- missing pages ------------------------------------- */

  /* GitHub Pages serves 404.html at whatever wrong address was typed,
     so the page view already records the bad URL. This event just
     gathers them in one place on the dashboard, with where the
     visitor came from, which is usually the page with the broken link. */
  if (document.body && document.body.hasAttribute("data-404")) {
    setTimeout(function () {
      event("404-" + location.pathname, "from " + (document.referrer || "a typed address"));
    }, 1500);
  }
})();
