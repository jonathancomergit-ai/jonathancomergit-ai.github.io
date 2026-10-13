/* ============================================================
   AlgoVision - Bits, binary & hex

   Everything in a computer is bits. This page draws bytes as rows
   of 8 cells (place values 128 ... 1 above them) and animates what
   happens to them. A frame is:
     { rows: [{ label, bits: [8 numbers, left = 128], hl: {i: cls}, note }],
       carry: [8] or null, info: html, line, msg }
   ============================================================ */

(function () {
  "use strict";

  var $ = function (s) { return document.querySelector(s); };
  var esc = AV.esc;
  function b(v) { return "<b>" + v + "</b>"; }
  var PLACE = [128, 64, 32, 16, 8, 4, 2, 1];

  function toBits(n) { n = ((n % 256) + 256) % 256; return PLACE.map(function (p) { return n & p ? 1 : 0; }); }
  function toNum(bits) { return bits.reduce(function (a, v, i) { return a + v * PLACE[i]; }, 0); }
  function hex2(n) { return n.toString(16).toUpperCase().padStart(2, "0"); }
  function bin(n) { var s = toBits(n).join(""); return s.slice(0, 4) + " " + s.slice(4); }
  function signed(n) { return n > 127 ? n - 256 : n; }
  function sumText(bits) {
    var parts = []; bits.forEach(function (v, i) { if (v) { parts.push(PLACE[i]); } });
    return parts.length ? parts.join(" + ") : "0";
  }
  function info(n, extra) {
    return '<div class="bt-info"><span>decimal <b>' + n + '</b></span><span>hex <b>0x' + hex2(n) + '</b></span>' +
      '<span>binary <b>0b' + toBits(n).join("") + '</b></span>' + (extra || "") + "</div>";
  }
  function row(label, n, hl, note) { return { label: label, bits: toBits(n), hl: hl || {}, note: note || "" }; }
  function F(rows, msg, line, extra) {
    var f = { rows: rows, msg: msg, line: line == null ? -1 : line, carry: null, info: "" };
    if (extra) { for (var k in extra) { f[k] = extra[k]; } }
    return f;
  }
  function allHl(cls) { var o = {}; for (var i = 0; i < 8; i++) { o[i] = cls; } return o; }

  /* ============================================================
     the six lessons
     ============================================================ */

  var flipState = 73, signedView = false;

  var LESSONS = {
    flip: {
      name: "Flip the bits", inputs: "flip",
      how: [
        "A <b>bit</b> is a 0 or a 1. Eight bits make a <b>byte</b>.",
        "Each position is worth double the one to its right: 1, 2, 4, 8... up to 128.",
        "The number is just the sum of the places with a 1. Tap a bit to flip it.",
        "8 bits can count from 0 to 255. That's 2<sup>8</sup> = 256 different values."
      ],
      code: ["n = 0b01001001   # binary literal", "print(n)          # 73", "print(bin(73))    # '0b1001001'", "print(hex(73))    # '0x49'"],
      frames: function () {
        var n = flipState, bits = toBits(n);
        var sv = signedView ? '<span>as signed <b>' + signed(n) + "</b></span>" : "";
        return [F([row("byte", n, {}, "")],
          "The 1s are in the " + b(sumText(bits)) + " places, so this byte is " + b(n) + "." +
          (signedView ? " Read as a " + b("signed") + " byte, the 128 place counts as " + b("-128") + ", so it's " + b(signed(n)) + "." : ""),
          1, { info: info(n, sv), clickable: true })];
      }
    },

    count: {
      name: "Counting in binary", inputs: "count",
      how: [
        "Counting works just like decimal, but you run out of digits at 1 instead of 9.",
        "Adding 1: the rightmost 0 becomes 1, and every 1 to its right rolls back to 0.",
        "That's a <b>carry</b>, the same as 0999 + 1 = 1000.",
        "Watch the rightmost bit: it flips every single time. Even numbers end in 0."
      ],
      code: ["n = 0", "while n < 16:", "    print(bin(n))", "    n += 1  # the bits ripple"],
      frames: function () {
        var start = +$("#count-from").value || 0, steps = +$("#count-steps").value || 16, out = [];
        out.push(F([row("n", start)], "Start at " + b(start) + ". Now keep adding 1.", 0, { info: info(start) }));
        for (var k = 1; k <= steps; k++) {
          var prev = (start + k - 1) % 256, n = (start + k) % 256, a = toBits(prev), z = toBits(n), hl = {}, flips = 0;
          for (var i = 0; i < 8; i++) { if (a[i] !== z[i]) { hl[i] = z[i] ? "focus" : "write"; flips++; } }
          var msg = n === 0
            ? b("255 + 1 = 0") + " in one byte: every bit rolled over and the carry fell off the end. That's " + b("overflow") + "."
            : flips === 1 ? "+1: the last bit was 0, so it just becomes 1. Now " + b(n) + "."
            : "+1: the " + (flips - 1) + " trailing 1" + (flips > 2 ? "s" : "") + " roll over to 0 and the next bit becomes 1, a carry. Now " + b(n) + ".";
          out.push(F([row("n", n, hl)], msg, 3, { info: info(n) }));
        }
        return out;
      }
    },

    hex: {
      name: "Hex & colours", inputs: "hex",
      how: [
        "Hex is base 16: digits 0-9 then A-F (A = 10 ... F = 15).",
        "4 bits make exactly one hex digit, so a byte is always <b>two</b> hex digits.",
        "That's why programmers love hex: <b>0xFF</b> is easier to read than 11111111.",
        "Web colours are 3 bytes, red, green and blue: #FF2D78 = 255, 45, 120."
      ],
      code: ["color = 0xFF2D78", "red   = (color >> 16) & 0xFF  # 255", "green = (color >> 8) & 0xFF   # 45", "blue  = color & 0xFF          # 120"],
      frames: function () {
        var raw = ($("#hex-in").value || "").replace(/[^0-9a-f]/gi, "").slice(0, 6).padEnd(6, "0").toUpperCase();
        var bytes = [0, 2, 4].map(function (k) { return parseInt(raw.slice(k, k + 2), 16); });
        var names = ["red", "green", "blue"], out = [];
        var sw = function (upTo) {
          var c = bytes.map(function (v, k) { return k <= upTo ? v : 0; });
          return '<div class="bt-info"><span class="bt-swatch" style="background:rgb(' + c.join(",") + ')"></span><span>#<b>' + raw + "</b></span>" +
            '<span>rgb(<b>' + bytes.join(", ") + "</b>)</span></div>";
        };
        out.push(F(bytes.map(function (v, k) { return row(names[k], v, {}, "?"); }),
          "The colour " + b("#" + raw) + " is 6 hex digits, so " + b("3 bytes") + ": red, green and blue.", 0, { info: sw(-1), nibbles: true }));
        bytes.forEach(function (v, k) {
          var hi = v >> 4, lo = v & 15;
          var rows = bytes.map(function (w, j) { return row(names[j], w, j === k ? { 0: "compare", 1: "compare", 2: "compare", 3: "compare" } : {}, j < k ? hex2(w) : j === k ? hex2(v)[0] + "?" : "?"); });
          out.push(F(rows, names[k] + ": the left 4 bits " + b(toBits(v).slice(0, 4).join("")) + " = " + hi + " = hex " + b(hi.toString(16).toUpperCase()) + ".", k + 1, { info: sw(k - 1), nibbles: true }));
          rows = bytes.map(function (w, j) { return row(names[j], w, j === k ? { 4: "focus", 5: "focus", 6: "focus", 7: "focus" } : {}, j <= k ? hex2(w) : "?"); });
          out.push(F(rows, "The right 4 bits " + b(toBits(v).slice(4).join("")) + " = " + lo + " = hex " + b(lo.toString(16).toUpperCase()) + ". So " + names[k] + " = " + b("0x" + hex2(v)) + " = " + b(v) + ".", k + 1, { info: sw(k), nibbles: true }));
        });
        out.push(F(bytes.map(function (w, j) { return row(names[j], w, {}, hex2(w)); }),
          "Mix " + bytes.join(", ") + " of red, green and blue light and you get that swatch. Try your own colour.", 3, { info: sw(2), nibbles: true }));
        return out;
      }
    },

    add: {
      name: "Adding & overflow", inputs: "add",
      how: [
        "Add binary right to left, just like on paper: 1 + 1 = 10, so write 0 and <b>carry 1</b>.",
        "A byte only has 8 places. If the last column carries, that carry has nowhere to go.",
        "So 250 + 10 gives <b>4</b> in one byte, not 260. That's <b>overflow</b>.",
        "Signed bytes run from -128 to 127, so 127 + 1 wraps to <b>-128</b>. Real bugs, real games (see: Gandhi in Civilization)."
      ],
      code: ["a, b = 250, 10", "total = (a + b) % 256  # what one byte can hold", "print(total)  # 4, not 260"],
      frames: function () {
        var A = Math.max(0, Math.min(255, +$("#add-a").value || 0)), B = Math.max(0, Math.min(255, +$("#add-b").value || 0));
        var a = toBits(A), z = toBits(B), sum = [0, 0, 0, 0, 0, 0, 0, 0], carry = [0, 0, 0, 0, 0, 0, 0, 0], c = 0, out = [];
        out.push(F([row("a", A), row("b", B), { label: "a + b", bits: sum.slice(), hl: {}, blank: 8 }],
          "Add " + b(A) + " + " + b(B) + " in binary, one column at a time from the right.", 0, { carry: carry.slice(), info: info(A, "<span>+ <b>" + B + "</b></span>") }));
        for (var i = 7; i >= 0; i--) {
          var t = a[i] + z[i] + c;
          sum[i] = t & 1;
          var nc = t >> 1;
          if (i > 0) { carry[i - 1] = nc; }
          var hl = {}; hl[i] = "compare";
          var sh = {}; sh[i] = "write";
          out.push(F([row("a", A, hl), row("b", B, hl), { label: "a + b", bits: sum.slice(), hl: sh, blank: i }],
            "Column " + PLACE[i] + ": " + a[i] + " + " + z[i] + (c ? " + carry 1" : "") + " = " + t + (t > 1 ? " (binary " + t.toString(2) + ")" : "") +
            ". Write " + b(sum[i]) + (nc ? ", carry " + b("1") + (i === 0 ? " out of the byte..." : " left.") : "."), 1, { carry: carry.slice(), info: "" }));
          c = nc;
        }
        var res = toNum(sum), lost = c;
        out.push(F([row("a", A), row("b", B), { label: "a + b", bits: sum.slice(), hl: lost ? allHl("write") : allHl("done") }],
          lost ? b("Overflow!") + " The real answer is " + (A + B) + ", but the carry fell off the left end, so one byte holds " + b(res) +
                 " (" + (A + B) + " - 256). Try 127 + 1 and look at the signed value."
               : "Fits in one byte: " + b(A + " + " + B + " = " + res) + "." + (signed(A) >= 0 && signed(B) >= 0 && signed(res) < 0 ? " But as a " + b("signed") + " byte it reads " + b(signed(res)) + ": signed overflow." : ""),
          2, { carry: carry.slice(), carryOut: lost, info: info(res, "<span>as signed <b>" + signed(res) + "</b></span>") }));
        return out;
      }
    },

    bitwise: {
      name: "Bitwise operations", inputs: "bitwise",
      how: [
        "<b>AND</b> (&): 1 only if both bits are 1. Great for <b>masking</b>: keep some bits, clear the rest.",
        "<b>OR</b> (|): 1 if either is 1. Turn bits <b>on</b>. <b>XOR</b> (^): 1 if they differ. <b>Flip</b> bits.",
        "<b>Shift left</b> (&lt;&lt; 1) slides every bit one place left: × 2. <b>Shift right</b> (&gt;&gt; 1): ÷ 2.",
        "Games use bits as on/off flags: one byte can hold 8 true/false settings."
      ],
      code: ["a, b = 0b11001010, 0b10101100", "a & b   # AND: both", "a | b   # OR: either", "a ^ b   # XOR: different", "a << 1  # shift left: x2", "a >> 1  # shift right: /2"],
      frames: function () {
        var A = Math.max(0, Math.min(255, +$("#bw-a").value || 0)), B = Math.max(0, Math.min(255, +$("#bw-b").value || 0)), op = $("#bw-op").value, out = [];
        var a = toBits(A), z = toBits(B);
        var fn = { and: function (x, y) { return x & y; }, or: function (x, y) { return x | y; }, xor: function (x, y) { return x ^ y; } };
        var sym = { and: "&", or: "|", xor: "^" }, line = { and: 1, or: 2, xor: 3, shl: 4, shr: 5 }[op];
        if (fn[op]) {
          var res = [0, 0, 0, 0, 0, 0, 0, 0];
          out.push(F([row("a", A), row("b", B), { label: "a " + sym[op] + " b", bits: res.slice(), hl: {}, blank: 8 }],
            b("a " + sym[op] + " b") + " works on each column separately. No carries, no columns talking to each other.", line, { info: info(A, "<span>" + sym[op] + " <b>" + B + "</b></span>") }));
          for (var i = 0; i < 8; i++) {
            res[i] = fn[op](a[i], z[i]);
            var hl = {}; hl[i] = "compare"; var rh = {}; rh[i] = res[i] ? "focus" : "write";
            var why = op === "and" ? (res[i] ? "both 1" : "not both 1") : op === "or" ? (res[i] ? "at least one 1" : "both 0") : (res[i] ? "they differ" : "they're the same");
            out.push(F([row("a", A, hl), row("b", B, hl), { label: "a " + sym[op] + " b", bits: res.slice(), hl: rh, blank: i + 1 }],
              "Column " + PLACE[i] + ": " + a[i] + " " + sym[op] + " " + z[i] + " = " + b(res[i]) + " (" + why + ").", line, {}));
          }
          var r = toNum(res);
          out.push(F([row("a", A), row("b", B), { label: "a " + sym[op] + " b", bits: res.slice(), hl: allHl("done") }],
            b(A + " " + sym[op] + " " + B + " = " + r) + ". " + (op === "and" ? "Try b = 15 (0b00001111): it keeps only a's right 4 bits. That's a mask." :
              op === "or" ? "OR with a bit pattern switches those bits on and leaves the rest alone." : "XOR the result with b again and you get a back. That trick is used in simple encryption."),
            line, { info: info(r) }));
        } else {
          var left = op === "shl", r2 = left ? (A << 1) & 255 : A >> 1, rb = toBits(r2);
          out.push(F([row("a", A), { label: left ? "a << 1" : "a >> 1", bits: rb, hl: {}, blank: 8 }],
            "Shift every bit one place " + b(left ? "left" : "right") + ".", line, { info: info(A) }));
          var hl2 = {}; for (var j = 0; j < 8; j++) { hl2[j] = "focus"; }
          var fell = left ? a[0] : a[7];
          out.push(F([row("a", A, left ? { 0: fell ? "write" : "compare" } : { 7: fell ? "write" : "compare" }), { label: left ? "a << 1" : "a >> 1", bits: rb, hl: hl2 }],
            "Every bit moved " + (left ? "left" : "right") + ". A 0 slides in at the " + (left ? "right" : "left") + (fell ? ", and the 1 at the " + (left ? "left" : "right") + " end " + b("fell off") : "") + ".", line, {}));
          out.push(F([row("a", A), { label: left ? "a << 1" : "a >> 1", bits: rb, hl: allHl("done") }],
            b(A + (left ? " << 1 = " : " >> 1 = ") + r2) + ". " + (left ? "Shifting left doubles a number" + (A > 127 ? ", unless the top bit falls off (overflow)." : ": " + A + " × 2.")
              : "Shifting right halves it, rounding down: " + A + " ÷ 2 = " + r2 + "."), line, { info: info(r2) }));
        }
        return out;
      }
    },

    float: {
      name: "Why 0.1 + 0.2 ≠ 0.3", inputs: "float",
      how: [
        "Fractions in binary use places worth ½, ¼, ⅛, ... instead of tenths.",
        "To convert: keep doubling. Each time you pass 1, write a 1 and subtract it.",
        "Some fractions never finish. 0.1 in binary is 0.000110011001100... forever.",
        "The computer has to stop somewhere, so 0.1 is stored as <b>almost</b> 0.1. Add two almosts and you get 0.30000000000000004."
      ],
      code: ["print(0.1 + 0.2)          # 0.30000000000000004", "print(0.1 + 0.2 == 0.3)   # False!", "import math", "math.isclose(0.1 + 0.2, 0.3)  # True: compare with a tolerance"],
      frames: function () {
        var x = parseFloat($("#fl-in").value);
        if (!(x > 0 && x < 1)) { x = 0.1; }
        var digits = [], seen = {}, cur = x, out = [], repeat = -1;
        /* work in tenths-ish exact integers to detect the repeat honestly */
        var den = Math.pow(10, Math.min(6, ((String(x).split(".")[1]) || "").length)), num = Math.round(x * den);
        out.push(F([], "Turn " + b(x) + " into binary by " + b("doubling") + " it again and again.", -1, { fl: { digits: [], note: "" }, info: '<div class="bt-info"><span>start <b>' + x + "</b></span></div>" }));
        for (var k = 0; k < 20 && num !== 0; k++) {
          if (seen[num] != null) { repeat = seen[num]; break; }
          seen[num] = k;
          var d = num * 2, bit = d >= den ? 1 : 0, before = num / den;
          num = bit ? d - den : d;
          digits.push(bit);
          out.push(F([], before + " × 2 = " + (d / den) + (bit ? " ≥ 1, so the next bit is " + b("1") + " (keep " + (num / den) + ")" : " < 1, so the next bit is " + b("0")) + ".",
            -1, { fl: { digits: digits.slice(), note: "" }, info: '<div class="bt-info"><span>so far <b>0.' + digits.join("") + "</b></span></div>" }));
        }
        var exact = num === 0;
        out.push(F([], exact
          ? b(x + " = 0." + digits.join("")) + " in binary, exactly. It finishes, so the computer stores it perfectly."
          : repeat < 0 ? "Still going after " + digits.length + " bits and no end in sight. A computer keeps 52 of them, so " + b(x) + " is stored a tiny bit off."
          : "We've seen " + (num / den) + " before! From here the bits " + b("repeat forever") + ": " + b("0." + digits.slice(0, repeat).join("") + "(" + digits.slice(repeat).join("") + ")…") +
            ". A computer keeps 52 of them, so it stores a number a tiny bit off.",
          0, { fl: { digits: digits.slice(), repeat: exact ? -1 : repeat, more: !exact }, info: '<div class="bt-info"><span>stored as <b>' + x.toPrecision(20).replace(/0+$/, "") + "</b></span></div>" }));
        out.push(F([], "That's why " + b("0.1 + 0.2") + " prints " + b(String(0.1 + 0.2)) + ", and " + b("0.1 + 0.2 == 0.3") + " is False. For money, count in whole cents; to compare floats, allow a tiny tolerance.",
          1, { fl: { digits: digits.slice(), repeat: exact ? -1 : repeat }, info: '<div class="bt-info"><span>0.1 + 0.2 = <b>' + (0.1 + 0.2) + "</b></span></div>" }));
        return out;
      }
    }
  };

  /* ---------- drawing ---------- */

  var stage = $("#stage");
  function draw(f) {
    var html = "";
    if (f.rows.length) {
      html += '<div class="bt-grid' + (f.nibbles ? " is-nib" : "") + '"><span class="bt-lbl"></span>' + PLACE.map(function (p) { return '<span class="bt-place">' + p + "</span>"; }).join("") + '<span class="bt-note"></span>';
      if (f.carry) {
        html += '<span class="bt-lbl">carry</span>' + f.carry.map(function (c) { return '<span class="bt-carry">' + (c ? "1" : "") + "</span>"; }).join("") +
          '<span class="bt-note">' + (f.carryOut ? '<b class="bt-lost">1 lost!</b>' : "") + "</span>";
      }
      f.rows.forEach(function (r) {
        html += '<span class="bt-lbl">' + esc(r.label) + "</span>" + r.bits.map(function (v, i) {
          var hidden = r.blank != null && (r.blank === 8 || (f.carry ? i < r.blank : i >= r.blank));
          return '<button type="button" class="bt-bit' + (v && !hidden ? " is-1" : "") + (r.hl[i] ? " is-" + r.hl[i] : "") + (hidden ? " is-blank" : "") +
            (f.clickable ? " is-click" : "") + '" data-i="' + i + '"' + (f.clickable ? "" : ' tabindex="-1"') + ">" + (hidden ? "" : v) + "</button>";
        }).join("") + '<span class="bt-note">' + esc(r.note || "") + "</span>";
      });
      html += "</div>";
    }
    if (f.fl) {
      html += '<div class="bt-fl"><span class="bt-fl-0">0.</span>' + f.fl.digits.map(function (d, i) {
        return '<span class="bt-fl-d' + (f.fl.repeat != null && f.fl.repeat >= 0 && i >= f.fl.repeat ? " is-rep" : "") + '">' + d + "</span>";
      }).join("") + (f.fl.repeat >= 0 ? '<span class="bt-fl-more">…forever</span>' : f.fl.more ? '<span class="bt-fl-more">…</span>' : "") + "</div>" +
      '<div class="bt-fl-places">' + ["½", "¼", "⅛", "1/16", "1/32", "1/64"].map(function (p) { return "<span>" + p + "</span>"; }).join("") + "<span>…</span></div>";
    }
    html += f.info || '<div class="bt-info"></div>';
    stage.innerHTML = html;
  }

  /* ---------- page wiring ---------- */

  var say = $("#say");
  var code = AV.Code($("#code"), [], $("#now"));
  var current = /^#(flip|count|hex|add|bitwise|float)$/.test(location.hash) ? location.hash.slice(1) : "flip";

  function render(f) { draw(f); code.mark(f.line); say.innerHTML = f.msg; }
  var player = AV.Player($("#controls"), render, {
    keys: true, speed: 1,
    steady: [{ el: say, html: function (f) { return f.msg; } }]
  });
  AV.learn($("#learn"), "bits");

  function build(play) {
    var L = LESSONS[current];
    $("#lesson-name").textContent = L.name;
    $("#how").innerHTML = L.how.map(function (h) { return "<li>" + h + "</li>"; }).join("");
    code.load(L.code);
    document.querySelectorAll("[data-in]").forEach(function (g) { g.hidden = g.getAttribute("data-in") !== L.inputs; });
    stage.className = "av-stage bt-stage is-" + current;
    player.load(L.frames());
    if (play && !AV.calm) { player.play(); }
  }

  /* tap a bit on the Flip lesson */
  stage.addEventListener("click", function (ev) {
    if (current !== "flip") { return; }
    var c = ev.target.closest && ev.target.closest(".bt-bit");
    if (!c) { return; }
    flipState ^= PLACE[+c.getAttribute("data-i")];
    build(false);
  });
  $("#flip-signed").addEventListener("change", function () { signedView = this.checked; build(false); });
  $("#flip-zero").addEventListener("click", function () { flipState = 0; build(false); });
  $("#flip-max").addEventListener("click", function () { flipState = 255; build(false); });

  ["#count-go", "#hex-go", "#add-go", "#bw-go", "#fl-go"].forEach(function (s) { $(s).addEventListener("click", function () { build(true); }); });
  ["#bw-op"].forEach(function (s) { $(s).addEventListener("change", function () { build(true); }); });
  $("#hex-pick").addEventListener("input", function () { $("#hex-in").value = this.value.slice(1).toUpperCase(); build(false); });
  document.querySelectorAll("[data-add]").forEach(function (btn) {
    btn.addEventListener("click", function () { var p = btn.getAttribute("data-add").split(","); $("#add-a").value = p[0]; $("#add-b").value = p[1]; build(true); });
  });
  document.querySelectorAll("[data-fl]").forEach(function (btn) {
    btn.addEventListener("click", function () { $("#fl-in").value = btn.getAttribute("data-fl"); build(true); });
  });

  document.querySelectorAll("#lessons [data-pick]").forEach(function (p) {
    p.setAttribute("aria-pressed", p.getAttribute("data-pick") === current ? "true" : "false");
  });
  AV.pills($("#lessons"), function (k) {
    current = k;
    try { history.replaceState(null, "", "#" + k); } catch (e) { /* file:// */ }
    build(false);
  });
  build(false);

  AV.quiz($("#quiz"), [
    {
      q: "What is 0b1010 in decimal?",
      opts: ["4", "10", "12", "1010"], a: 1,
      why: "The 1s are in the 8 and 2 places: 8 + 2 = 10."
    },
    {
      q: "Why does a byte go up to 255 and not 256?",
      opts: ["Computers can't count to 256", "8 bits make 256 values, and one of them is 0", "The top bit is reserved", "It's 256 really"], a: 1,
      why: "2<sup>8</sup> = 256 patterns, from 00000000 (0) to 11111111 (255)."
    },
    {
      q: "How many hex digits does one byte take?",
      opts: ["1", "2", "4", "8"], a: 1,
      why: "Each hex digit is exactly 4 bits, so 8 bits is two digits: 00 to FF."
    },
    {
      q: "In one unsigned byte, what is 200 + 100?",
      opts: ["300", "44", "255", "An error"], a: 1,
      why: "300 doesn't fit in 8 bits. The carry falls off the end, leaving 300 - 256 = 44. That's overflow."
    },
    {
      q: "Why is 0.1 + 0.2 == 0.3 False in most languages?",
      opts: ["A bug in Python", "0.1 has no exact binary form, so it's stored slightly off", "Floats are random", "It's True"], a: 1,
      why: "0.1 in binary repeats forever, like 1/3 in decimal. Compare floats with a tolerance (math.isclose)."
    }
  ], $("#quiz-score"));
})();
