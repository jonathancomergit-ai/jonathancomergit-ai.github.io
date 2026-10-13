/* ============================================================
   AlgoVision - Object-oriented programming

   Five lessons, one page, same engine as everywhere else: an
   action runs once and records frames; the Player flips through.
   Each lesson in LESSONS has:
     state   what exists right now (copied into every frame)
     ops     the buttons
     draw    paints a frame onto the lesson's fixed-size stage
   ============================================================ */

(function () {
  "use strict";

  var $ = function (s) { return document.querySelector(s); };
  var esc = AV.esc;
  function b(v) { return "<b>" + v + "</b>"; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  var NS = "http://www.w3.org/2000/svg";
  function svg(tag, attrs, parent, text) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) { e.setAttribute(k, attrs[k]); }
    if (text != null) { e.textContent = text; }
    if (parent) { parent.appendChild(e); }
    return e;
  }

  function Rec(state) {
    var r = { st: clone(state), frames: [], steps: 0 };
    r.snap = function (line, msg, x) {
      r.frames.push({ st: clone(r.st), line: line, msg: msg, x: x ? clone(x) : {}, steps: r.steps });
    };
    return r;
  }

  /* ============================================================
     1. CLASSES & OBJECTS
     ============================================================ */

  var DOG = [
    "class Dog:",
    "    def __init__(self, name, age):",
    "        self.name = name  # each dog gets its OWN name",
    "        self.age = age",
    "",
    "    def bark(self):",
    "        return self.name + \" says woof!\"",
    "",
    "    def birthday(self):",
    "        self.age += 1  # only THIS dog gets older"
  ];
  var MAX_OBJ = 4;
  function varName(n) { return (n.toLowerCase().replace(/[^a-z]/g, "") || "dog").slice(0, 8); }

  var classes = {
    name: "Classes & objects", topic: "oop-classes", inputs: "obj",
    state: { objs: [{ v: "rex", name: "Rex", age: 3 }, { v: "bella", name: "Bella", age: 5 }] },
    how: [
      "A <b>class</b> is a blueprint. It says what every Dog has (name, age) and can do (bark, birthday).",
      "An <b>object</b> is one real thing built from the blueprint. Each has its <b>own</b> copy of the data.",
      "<b>self</b> means \"the object this method was called on\". rex.birthday() changes rex, never bella.",
      "Methods live on the class and are shared. Only the data is per-object."
    ],
    ops: {
      create: {
        label: "new Dog(name, age)",
        code: function (a) { return DOG.concat(["", varName(a.name) + " = Dog(\"" + a.name + "\", " + a.age + ")"]); },
        run: function (r, a) {
          var o = r.st.objs, v = varName(a.name), call = DOG.length + 1;
          if (o.length >= MAX_OBJ) { r.snap(call, "That's " + MAX_OBJ + " dogs, as many as fit on screen. Press " + b("Reset") + " to start over."); return; }
          if (o.some(function (x) { return x.v === v; })) { r.snap(call, "There's already a dog called " + b(v) + ". Pick another name."); return; }
          r.snap(call, "Calling the class like a function builds a " + b("new object") + " from the blueprint. It starts out empty.", { building: true, ghost: { v: v } });
          r.steps++;
          r.snap(1, "Python runs " + b("__init__") + " to set it up. Inside it, " + b("self") + " is the brand-new object.", { ghost: { v: v }, self: "ghost" });
          r.snap(2, b("self.name = name") + ": this object gets its own name, " + b(esc(a.name)) + ".", { ghost: { v: v, name: a.name }, self: "ghost", lit: "name" });
          r.snap(3, b("self.age = age") + ": and its own age, " + b(a.age) + ".", { ghost: { v: v, name: a.name, age: a.age }, self: "ghost", lit: "age" });
          o.push({ v: v, name: a.name, age: a.age }); r.steps++;
          r.snap(call, "The variable " + b(v) + " now refers to this object. Same blueprint as the others, " + b("its own data") + ".", { hl: o.length - 1 });
        }
      },
      bark: {
        label: "obj.bark()",
        code: function (a, st) { return DOG.concat(["", (st.objs[a.pick] || { v: "rex" }).v + ".bark()"]); },
        run: function (r, a) {
          var obj = r.st.objs[a.pick], call = DOG.length + 1;
          if (!obj) { r.snap(call, "Make a dog first."); return; }
          r.snap(call, "Call " + b("bark") + " on " + b(obj.v) + ". Python finds bark() on the " + b("class") + " (methods are shared)...", { hl: a.pick, cls: "bark" });
          r.steps++;
          r.snap(5, "...and runs it with " + b("self = " + obj.v) + ".", { hl: a.pick, self: a.pick, cls: "bark" });
          r.snap(6, "self.name is " + b(esc(obj.name)) + ", so it returns the string below.", { hl: a.pick, self: a.pick, lit: "name", said: { i: a.pick, t: obj.name + " says woof!" } });
        }
      },
      birthday: {
        label: "obj.birthday()",
        code: function (a, st) { return DOG.concat(["", (st.objs[a.pick] || { v: "rex" }).v + ".birthday()"]); },
        run: function (r, a) {
          var obj = r.st.objs[a.pick], call = DOG.length + 1;
          if (!obj) { r.snap(call, "Make a dog first."); return; }
          r.snap(call, "Call " + b("birthday") + " on " + b(obj.v) + ".", { hl: a.pick, cls: "birthday" });
          r.steps++;
          r.snap(8, "Inside the method, " + b("self") + " is " + b(obj.v) + ".", { hl: a.pick, self: a.pick, cls: "birthday" });
          obj.age++;
          r.snap(9, b("self.age += 1") + ": " + b(obj.v) + " is now " + obj.age + ". Every other dog's age is " + b("untouched") + ", because each object keeps its own data.",
            { hl: a.pick, self: a.pick, lit: "age" });
        }
      }
    },
    reset: function () { return { objs: [{ v: "rex", name: "Rex", age: 3 }, { v: "bella", name: "Bella", age: 5 }] }; },
    setup: function (stage) {
      stage.innerHTML = '<div class="oo-classes"><div class="oo-blueprint"></div><div class="oo-heap"></div></div>';
    },
    draw: function (stage, f) {
      var bp = stage.querySelector(".oo-blueprint"), heap = stage.querySelector(".oo-heap"), x = f.x;
      bp.innerHTML = '<p class="oo-kind">class (blueprint)</p><h4>Dog</h4>' +
        '<p class="oo-sec">data every dog has</p><div class="oo-row">name</div><div class="oo-row">age</div>' +
        '<p class="oo-sec">what every dog can do</p>' +
        '<div class="oo-row is-method' + (x.cls === "bark" ? " is-lit" : "") + '">bark()</div>' +
        '<div class="oo-row is-method' + (x.cls === "birthday" ? " is-lit" : "") + '">birthday()</div>';
      var html = "";
      function card(o, i, ghost) {
        var isSelf = x.self === (ghost ? "ghost" : i), lit = isSelf ? x.lit : null;
        var said = x.said && x.said.i === i ? '<div class="oo-said">"' + esc(x.said.t) + '"</div>' : "";
        return '<div class="oo-obj' + (ghost ? " is-new" : "") + (x.hl === i ? " is-hl" : "") + (isSelf ? " is-self" : "") + '">' +
          '<div class="oo-var">' + esc(o.v) + (isSelf ? ' <span class="oo-selftag">= self</span>' : "") + "</div>" +
          '<div class="oo-field' + (lit === "name" ? " is-lit" : "") + '"><span>name</span><b>' + (o.name != null ? '"' + esc(o.name) + '"' : "") + "</b></div>" +
          '<div class="oo-field' + (lit === "age" ? " is-lit" : "") + '"><span>age</span><b>' + (o.age != null ? o.age : "") + "</b></div>" +
          '<div class="oo-made">made from Dog</div>' + said + "</div>";
      }
      f.st.objs.forEach(function (o, i) { html += card(o, i, false); });
      if (x.ghost) { html += card(x.ghost, -1, true); }
      for (var k = f.st.objs.length + (x.ghost ? 1 : 0); k < MAX_OBJ; k++) { html += '<div class="oo-obj is-slot">free memory</div>'; }
      heap.innerHTML = '<p class="oo-kind">objects (in memory)</p><div class="oo-objs">' + html + "</div>";
    }
  };

  /* ============================================================
     2. INHERITANCE: method lookup climbs the family tree
     ============================================================ */

  var TREE = {
    Animal: { parent: null, methods: { speak: ["\"...\"", 1], eat: ["\"nom nom\"", 2], sleep: ["\"zzz\"", 3] }, box: [200, 8, 200] },
    Dog:    { parent: "Animal", methods: { speak: ["\"Woof!\"", 6], fetch: ["\"got the ball!\"", 7] }, box: [30, 140, 210] },
    Cat:    { parent: "Animal", methods: { speak: ["\"Meow\"", 10] }, box: [360, 140, 210] },
    Puppy:  { parent: "Dog", methods: { speak: ["\"Yip!\"", 13] }, box: [30, 262, 210] }
  };
  var ORDER = { Animal: ["speak", "eat", "sleep"], Dog: ["speak", "fetch"], Cat: ["speak"], Puppy: ["speak"] };
  var PETS = [{ v: "blob", cls: "Animal" }, { v: "rex", cls: "Dog" }, { v: "tom", cls: "Cat" }, { v: "bit", cls: "Puppy" }];
  var ZOO = [
    "class Animal:",
    "    def speak(self): return \"...\"",
    "    def eat(self):   return \"nom nom\"",
    "    def sleep(self): return \"zzz\"",
    "",
    "class Dog(Animal):  # a Dog IS an Animal",
    "    def speak(self): return \"Woof!\"  # override",
    "    def fetch(self): return \"got the ball!\"",
    "",
    "class Cat(Animal):",
    "    def speak(self): return \"Meow\"",
    "",
    "class Puppy(Dog):  # a Puppy IS a Dog",
    "    def speak(self): return \"Yip!\""
  ];

  var inherit = {
    name: "Inheritance", topic: "oop-inherit", inputs: "pet",
    state: {},
    how: [
      "<b>class Dog(Animal)</b> means a Dog gets everything an Animal has, for free.",
      "When you call a method, Python looks in the object's own class first, then its <b>parent</b>, then the parent's parent...",
      "If a child defines the same method, it <b>overrides</b> the parent's. Puppy says Yip, not Woof.",
      "Reach the top without finding it? <b>AttributeError</b>. Cats can't fetch."
    ],
    ops: {
      speak: { label: "pet.speak()", run: function (r, a) { lookup(r, a.pet, "speak"); } },
      eat:   { label: "pet.eat()",   run: function (r, a) { lookup(r, a.pet, "eat"); } },
      fetch: { label: "pet.fetch()", run: function (r, a) { lookup(r, a.pet, "fetch"); } },
      sleep: { label: "pet.sleep()", run: function (r, a) { lookup(r, a.pet, "sleep"); } }
    },
    codeAll: function (a, op) { return ZOO.concat(["", PETS[a.pet].v + "." + op + "()"]); },
    setup: function (stage) {
      stage.innerHTML = "";
      inherit.svg = svg("svg", { "class": "oo-tree", viewBox: "0 0 600 340" }, stage);
    },
    draw: function (stage, f) {
      var s = inherit.svg, x = f.x;
      s.innerHTML = "";
      var defs = svg("defs", {}, s);
      var m = svg("marker", { id: "tri", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 9, markerHeight: 9, orient: "auto" }, defs);
      svg("path", { d: "M0,0 L10,5 L0,10 z", "class": "oo-tri" }, m);
      Object.keys(TREE).forEach(function (name) {
        var c = TREE[name];
        if (!c.parent) { return; }
        var p = TREE[c.parent], bx = c.box, pb = p.box;
        svg("line", { x1: bx[0] + bx[2] / 2, y1: bx[1], x2: pb[0] + pb[2] / 2, y2: pb[1] + boxH(c.parent) + 2,
          "class": "oo-edge" + (x.path && x.path.indexOf(name) >= 0 && x.path.indexOf(c.parent) >= 0 ? " is-lit" : ""), "marker-end": "url(#tri)" }, s);
      });
      Object.keys(TREE).forEach(function (name) {
        var c = TREE[name], bx = c.box, h = boxH(name);
        var g = svg("g", { "class": "oo-cls" + (x.at === name ? " is-at" : "") + (x.found === name ? " is-found" : ""), transform: "translate(" + bx[0] + "," + bx[1] + ")" }, s);
        svg("rect", { width: bx[2], height: h, rx: 8 }, g);
        svg("text", { x: 12, y: 21, "class": "oo-cname" }, g, name + (c.parent ? "(" + c.parent + ")" : ""));
        ORDER[name].forEach(function (mn, k) {
          var hit = x.found === name && x.method === mn, checking = x.at === name && x.method === mn;
          svg("text", { x: 14, y: 44 + k * 19, "class": "oo-meth" + (hit ? " is-hit" : checking ? " is-check" : "") }, g, mn + "()");
        });
        PETS.forEach(function (p, k) {
          if (p.cls !== name) { return; }
          var me = x.pet === k;
          var t = svg("g", { "class": "oo-pet" + (me ? " is-me" : ""), transform: "translate(" + (bx[2] - 62) + ",8)" }, g);
          svg("rect", { width: 52, height: 20, rx: 10 }, t);
          svg("text", { x: 26, y: 14, "text-anchor": "middle" }, t, p.v);
        });
      });
      if (x.out) {
        svg("text", { x: 590, y: 330, "text-anchor": "end", "class": "oo-out" + (x.err ? " is-err" : "") }, s, x.out);
      }
    }
  };
  function boxH(name) { return 32 + ORDER[name].length * 19; }

  function lookup(r, petIdx, method) {
    var pet = PETS[petIdx], cls = pet.cls, path = [], call = ZOO.length + 1;
    r.snap(call, "Call " + b(pet.v + "." + method + "()") + ". " + b(pet.v) + " is a " + b(cls) + ". Start looking there.", { pet: petIdx, at: cls, method: method, path: [cls] });
    while (cls) {
      path.push(cls);
      r.steps++;
      var has = TREE[cls].methods[method];
      if (has) {
        var overrides = false, up = TREE[cls].parent;
        while (up) { if (TREE[up].methods[method]) { overrides = true; break; } up = TREE[up].parent; }
        r.snap(has[1], "Found " + b(method + "()") + " in " + b(cls) + (path.length > 1 ? ", " + (path.length - 1) + " level" + (path.length > 2 ? "s" : "") + " up. " + b(pet.v) + " " + b("inherited") + " it." : ".") +
          (overrides ? " It " + b("overrides") + " " + up + "'s version, which never runs." : "") + " Returns " + b(esc(has[0])) + ".",
          { pet: petIdx, at: cls, found: cls, method: method, path: path.slice(), out: pet.v + "." + method + "() → " + has[0] });
        return;
      }
      var parent = TREE[cls].parent;
      r.snap(call, b(cls) + " doesn't define " + method + "(). " + (parent ? "Go up to its parent, " + b(parent) + "." : ""),
        { pet: petIdx, at: cls, method: method, path: path.slice() });
      cls = parent;
    }
    r.snap(call, "Reached the top and nobody defines " + method + "(): " + b("AttributeError") + ". A " + pet.cls + " can't " + method + ". Parents don't inherit from children.",
      { pet: petIdx, method: method, path: path, out: "AttributeError: '" + pet.cls + "' has no '" + method + "'", err: true });
  }

  /* ============================================================
     3. POLYMORPHISM: same call, different code
     ============================================================ */

  var POLY = [
    "class Shape:",
    "    def area(self): ...",
    "",
    "class Circle(Shape):",
    "    def area(self): return 3.14 * self.r ** 2",
    "",
    "class Square(Shape):",
    "    def area(self): return self.side ** 2",
    "",
    "class Triangle(Shape):",
    "    def area(self): return 0.5 * self.base * self.height",
    "",
    "total = 0",
    "for s in shapes:",
    "    total += s.area()  # same call, different code!"
  ];
  var KIND = {
    circle:   { name: "Circle",   line: 4,  area: function (n) { return 3.14 * n * n; }, how: function (n) { return "3.14 × " + n + "²"; }, arg: "r" },
    square:   { name: "Square",   line: 7,  area: function (n) { return n * n; }, how: function (n) { return n + "²"; }, arg: "side" },
    triangle: { name: "Triangle", line: 10, area: function (n) { return 0.5 * n * n; }, how: function (n) { return "0.5 × " + n + " × " + n; }, arg: "base=height" }
  };
  var MAX_SHAPES = 5;
  function r1(v) { return Math.round(v * 10) / 10; }

  var poly = {
    name: "Polymorphism", topic: "oop-poly", inputs: "shape",
    state: { shapes: [["circle", 2], ["square", 3], ["triangle", 4]] },
    how: [
      "<b>Poly-morph</b> = many shapes. One call, <b>s.area()</b>, does different things depending on what s is.",
      "The loop doesn't know or care whether s is a circle or a square. It just asks.",
      "Each class answers in its own way. Python picks the right area() at run time.",
      "Add a new shape class later and this loop works with it unchanged."
    ],
    ops: {
      total: {
        label: "Run the loop",
        run: function (r) {
          var sh = r.st.shapes, total = 0, done = [];
          if (!sh.length) { r.snap(12, "No shapes in the list. Add some first."); return; }
          r.snap(12, "total = 0. Now loop over the list and ask each shape for its area.", { total: 0, done: done });
          sh.forEach(function (s, i) {
            var K = KIND[s[0]];
            r.snap(14, "s is shape " + (i + 1) + ". Call " + b("s.area()") + ". Which area()? Depends on what s really is: a " + b(K.name) + ".", { at: i, total: r1(total), done: done });
            r.steps++;
            var a = K.area(s[1]);
            r.snap(K.line, "Runs " + b(K.name + ".area()") + ": " + K.how(s[1]) + " = " + b(r1(a)) + ".", { at: i, total: r1(total), done: done, codeHit: K.line });
            total += a; done.push(r1(a));
            r.snap(14, "total += " + r1(a) + " → " + b(r1(total)) + ".", { at: i, total: r1(total), done: done });
          });
          r.snap(14, "Total area " + b(r1(total)) + ". " + b("One line of code") + " handled " + sh.length + " shapes and " + countKinds(sh) + " different kinds of area. That's polymorphism.",
            { total: r1(total), done: done });
        }
      },
      add: {
        label: "Add shape",
        run: function (r, a) {
          if (r.st.shapes.length >= MAX_SHAPES) { r.snap(12, "The list is full (" + MAX_SHAPES + " shapes). Remove one first."); return; }
          r.st.shapes.push([a.kind, a.size]);
          r.snap(12, "Added a " + b(KIND[a.kind].name + "(" + a.size + ")") + " to the list. Run the loop: it'll handle it without any changes.", { at: r.st.shapes.length - 1, done: [] });
        }
      },
      remove: {
        label: "Remove last",
        run: function (r) {
          var s = r.st.shapes.pop();
          r.snap(12, s ? "Removed the " + KIND[s[0]].name + "." : "The list is already empty.", { done: [] });
        }
      }
    },
    setup: function (stage) {
      stage.innerHTML = "";
      poly.svg = svg("svg", { "class": "oo-shapes", viewBox: "0 0 600 190" }, stage);
    },
    draw: function (stage, f) {
      var s = poly.svg, x = f.x, sh = f.st.shapes;
      s.innerHTML = "";
      for (var i = 0; i < MAX_SHAPES; i++) {
        var cx = 60 + i * 120, g = svg("g", { "class": "oo-shape" + (x.at === i ? " is-at" : "") + (x.done && x.done[i] != null ? " is-done" : "") }, s);
        svg("rect", { x: cx - 56, y: 4, width: 112, height: 182, rx: 10, "class": "oo-slot" + (sh[i] ? "" : " is-empty") }, g);
        if (!sh[i]) { continue; }
        var k = sh[i][0], n = sh[i][1], sz;
        if (k === "circle") { sz = Math.min(42, 8 + n * 7); svg("circle", { cx: cx, cy: 70, r: sz, "class": "oo-fig" }, g); }
        else if (k === "square") { sz = Math.min(80, 14 + n * 11); svg("rect", { x: cx - sz / 2, y: 70 - sz / 2, width: sz, height: sz, "class": "oo-fig" }, g); }
        else { sz = Math.min(84, 16 + n * 11); svg("path", { d: "M" + (cx - sz / 2) + "," + (70 + sz / 2) + " L" + (cx + sz / 2) + "," + (70 + sz / 2) + " L" + (cx - sz / 2) + "," + (70 - sz / 2) + " z", "class": "oo-fig" }, g); }
        svg("text", { x: cx, y: 138, "text-anchor": "middle", "class": "oo-sname" }, g, KIND[k].name + "(" + n + ")");
        svg("text", { x: cx, y: 160, "text-anchor": "middle", "class": "oo-sarea" }, g, x.done && x.done[i] != null ? "area " + x.done[i] : "area ?");
      }
      svg("text", { x: 596, y: 186, "text-anchor": "end", "class": "oo-total" }, s, x.total != null ? "total = " + x.total : "");
    }
  };
  function countKinds(sh) { var o = {}; sh.forEach(function (s) { o[s[0]] = 1; }); return Object.keys(o).length; }

  /* ============================================================
     4. ENCAPSULATION: the data is locked inside; methods guard it
     ============================================================ */

  var BANK = [
    "class BankAccount:",
    "    def __init__(self):",
    "        self.__balance = 0  # private: hidden inside",
    "",
    "    def deposit(self, amount):",
    "        if amount <= 0:",
    "            raise ValueError(\"must be positive\")",
    "        self.__balance += amount",
    "",
    "    def withdraw(self, amount):",
    "        if amount > self.__balance:",
    "            raise ValueError(\"not enough money\")",
    "        self.__balance -= amount",
    "",
    "    def balance(self):",
    "        return self.__balance  # read-only view"
  ];

  var encap = {
    name: "Encapsulation", topic: "oop-encap", inputs: "amount",
    state: { bal: 50, log: ["opened with 50"] },
    how: [
      "The balance is <b>private</b>: locked inside the object. Outside code can't touch it directly.",
      "The only way in is through the public <b>methods</b>: deposit, withdraw, balance.",
      "Each method <b>checks the rules</b> first: no negative deposits, no overdrawing.",
      "So the balance can never get into a broken state, no matter who uses the class."
    ],
    ops: {
      deposit: {
        label: "deposit(amount)",
        run: function (r, a) {
          var call = BANK.length + 1;
          r.snap(call, "Ask the account to deposit " + b(a.amount) + ". You don't touch the balance, you ask a method to.", { btn: "deposit" });
          r.steps++;
          r.snap(5, "The method checks the rule first: is " + a.amount + " more than 0?", { btn: "deposit", check: true });
          if (a.amount <= 0) {
            r.st.log.unshift("deposit " + a.amount + " refused");
            r.snap(6, b("ValueError: must be positive.") + " The method refused. The balance is safe at " + r.st.bal + ".", { btn: "deposit", deny: true });
            return;
          }
          r.st.bal += a.amount; r.st.log.unshift("deposit +" + a.amount);
          r.snap(7, "Rule passed. Only now, from " + b("inside") + ", does the balance change: " + b(r.st.bal) + ".", { btn: "deposit", lit: true });
        }
      },
      withdraw: {
        label: "withdraw(amount)",
        run: function (r, a) {
          var call = BANK.length + 1;
          r.snap(call, "Ask to withdraw " + b(a.amount) + ".", { btn: "withdraw" });
          r.steps++;
          r.snap(10, "Rule check: is " + a.amount + " more than the balance (" + r.st.bal + ")?", { btn: "withdraw", check: true });
          if (a.amount > r.st.bal) {
            r.st.log.unshift("withdraw " + a.amount + " refused");
            r.snap(11, b("ValueError: not enough money.") + " Refused. You can't overdraw, because the method won't let you.", { btn: "withdraw", deny: true });
            return;
          }
          if (a.amount <= 0) {
            r.st.log.unshift("withdraw " + a.amount + " refused");
            r.snap(11, "Withdrawing " + a.amount + " makes no sense. Refused.", { btn: "withdraw", deny: true });
            return;
          }
          r.st.bal -= a.amount; r.st.log.unshift("withdraw -" + a.amount);
          r.snap(12, "Allowed. Balance is now " + b(r.st.bal) + ".", { btn: "withdraw", lit: true });
        }
      },
      balance: {
        label: "balance()",
        run: function (r) {
          r.steps++;
          r.snap(15, "balance() hands you a " + b("copy") + " of the number to look at: " + b(r.st.bal) + ". Looking can't change it.", { btn: "balance", lit: true });
        }
      },
      hack: {
        label: "Reach in: balance = -1000",
        run: function (r) {
          var call = BANK.length + 1;
          r.snap(call, "Outside code tries to skip the methods and set the balance directly: " + b("acct.__balance = -1000") + ".", { hack: true });
          r.steps++;
          r.st.log.unshift("direct change blocked");
          r.snap(2, b("It doesn't get in.") + " In Java or C# this line won't even compile: " + b("private") + " fields can't be reached from outside. " +
            "In Python, inside the class the name is quietly renamed to _BankAccount__balance, so this line just makes a new, unrelated attribute. " +
            "The real balance stays " + b(r.st.bal) + ".", { hack: true, deny: true });
        }
      }
    },
    reset: function () { return { bal: 50, log: ["opened with 50"] }; },
    setup: function (stage) { stage.innerHTML = '<div class="oo-bank"></div>'; },
    draw: function (stage, f) {
      var x = f.x;
      function btn(k, label) { return '<div class="oo-api' + (x.btn === k ? " is-on" : "") + '">' + label + "</div>"; }
      stage.firstChild.innerHTML =
        '<div class="oo-acct">' +
          '<div class="oo-acct-head">acct = BankAccount()</div>' +
          '<div class="oo-public"><span class="oo-sec">public: anyone can use</span>' +
            btn("deposit", "deposit(amount)") + btn("withdraw", "withdraw(amount)") + btn("balance", "balance()") + "</div>" +
          '<div class="oo-private' + (x.deny ? " is-deny" : "") + (x.lit ? " is-lit" : "") + (x.check ? " is-check" : "") + '">' +
            '<span class="oo-sec">&#128274; private: only the methods can reach</span>' +
            '<div class="oo-bal"><span>__balance</span><b>' + f.st.bal + "</b></div></div>" +
        "</div>" +
        '<div class="oo-hand' + (x.hack ? " is-on" : "") + (x.deny ? " is-deny" : "") + '">outside code: acct.__balance = -1000 ' + (x.deny ? "&#10007;" : "&rarr;") + "</div>" +
        '<div class="oo-log"><span class="oo-sec">history</span>' + f.st.log.slice(0, 4).map(function (l) { return "<div>" + esc(l) + "</div>"; }).join("") + "</div>";
    }
  };

  /* ============================================================
     5. ABSTRACTION: use the button, hide the machinery
     ============================================================ */

  var COFFEE = [
    "class CoffeeMachine:",
    "    def make_coffee(self):  # the ONE button you see",
    "        self._heat_water()",
    "        self._grind_beans()",
    "        self._brew()",
    "        self._pour()",
    "        return \"coffee\"",
    "    # _heat_water, _grind_beans... are hidden details"
  ];
  var ABC = [
    "from abc import ABC, abstractmethod",
    "",
    "class Shape(ABC):  # abstract: an idea, not a thing",
    "    @abstractmethod",
    "    def area(self): ...  # every shape MUST have this",
    "",
    "class Circle(Shape):",
    "    def __init__(self, r): self.r = r",
    "    def area(self): return 3.14 * self.r ** 2",
    "",
    "class Hexagon(Shape):",
    "    pass  # forgot to write area()!"
  ];
  var STEPS = [["_heat_water()", "Heat water to 93°C"], ["_grind_beans()", "Grind 18 g of beans"], ["_brew()", "Push water through at 9 bar"], ["_pour()", "Pour into the cup"]];

  var abstr = {
    name: "Abstraction", topic: "oop-abstract", inputs: "peek",
    state: { cups: 0 },
    how: [
      "<b>Abstraction</b> means showing the simple controls and hiding the complicated parts.",
      "You press make_coffee(). You don't need to know about pressure or grind size.",
      "An <b>abstract class</b> (Shape) is an idea, not a real thing. It says what every shape must have.",
      "You can't build a plain Shape, and a class that forgets a required method can't be built either."
    ],
    ops: {
      coffee: {
        label: "make_coffee()",
        code: COFFEE.concat(["", "machine.make_coffee()"]),
        run: function (r, a) {
          var call = COFFEE.length + 1;
          r.snap(call, "Press the one public button: " + b("make_coffee()") + ".", { press: true, peek: a.peek });
          STEPS.forEach(function (s, k) {
            r.steps++;
            r.snap(2 + k, a.peek ? "Inside, hidden from you: " + b(s[0]) + ". " + s[1] + "." : "Something is happening inside... you don't need to know what. " + b("That's the point."),
              { press: true, peek: a.peek, step: k });
          });
          r.st.cups++;
          r.snap(6, "A cup of coffee. You used " + b("1 method") + "; it ran " + b(STEPS.length + " hidden ones") + ". Tick " + b("Peek inside") + " to see them.", { peek: a.peek, cup: true });
        }
      },
      shape: {
        label: "Shape()",
        code: ABC.concat(["", "s = Shape()"]),
        run: function (r) {
          r.steps++;
          r.snap(ABC.length + 1, "Try to build a plain Shape...", { abc: "Shape" });
          r.snap(2, b("TypeError: Can't instantiate abstract class Shape.") + " A \"shape\" with no actual shape has no area to give. It's a " + b("template") + " for real shapes, not a thing itself.",
            { abc: "Shape", err: "TypeError: can't make an abstract Shape" });
        }
      },
      circle: {
        label: "Circle(2)",
        code: ABC.concat(["", "s = Circle(2)"]),
        run: function (r) {
          r.steps++;
          r.snap(ABC.length + 1, "Build a Circle. Python checks: does Circle provide every abstract method?", { abc: "Circle" });
          r.snap(8, "Yes, it has " + b("area()") + ". So it's allowed. s.area() = 3.14 × 2² = " + b("12.56") + ".", { abc: "Circle", ok: "Circle(2) built  ·  area() = 12.56" });
        }
      },
      hexagon: {
        label: "Hexagon()",
        code: ABC.concat(["", "s = Hexagon()"]),
        run: function (r) {
          r.steps++;
          r.snap(ABC.length + 1, "Build a Hexagon. Does it provide area()?", { abc: "Hexagon" });
          r.snap(11, b("TypeError") + ": Hexagon forgot area(). Python refuses to build it, so the mistake is caught " + b("right away") +
            " instead of crashing later when someone calls area().", { abc: "Hexagon", err: "TypeError: Hexagon is missing area()" });
        }
      }
    },
    setup: function (stage) { stage.innerHTML = '<div class="oo-abs"></div>'; },
    draw: function (stage, f) {
      var x = f.x, cupped = f.st.cups;
      var steps = STEPS.map(function (s, k) {
        var on = x.step === k, done = x.step != null && k < x.step;
        return '<div class="oo-step' + (on ? " is-on" : done ? " is-done" : "") + '">' + (x.peek ? s[0] + " &middot; " + s[1] : "&#9881; hidden") + "</div>";
      }).join("");
      var abcHtml = '<div class="oo-abc">' + ["Shape", "Circle", "Hexagon"].map(function (n) {
        return '<div class="oo-abc-box' + (x.abc === n ? " is-at" : "") + (n === "Shape" ? " is-abstract" : "") + '">' +
          (n === "Shape" ? "<i>abstract</i> " : "") + n + '<span>' + (n === "Hexagon" ? "no area()" : n === "Shape" ? "area() = ???" : "area() &#10003;") + "</span></div>";
      }).join("") + '</div><div class="oo-abc-out' + (x.err ? " is-err" : x.ok ? " is-ok" : "") + '">' + (x.err ? esc(x.err) : x.ok ? esc(x.ok) : "&nbsp;") + "</div>";
      stage.firstChild.innerHTML =
        '<div class="oo-machine">' +
          '<div class="oo-front"><div class="oo-big' + (x.press ? " is-on" : "") + '">make_coffee()</div>' +
          '<div class="oo-cup' + (x.cup ? " is-full" : "") + '">&#9749;</div><div class="oo-sec">cups made: ' + cupped + "</div></div>" +
          '<div class="oo-inside' + (x.peek ? " is-open" : "") + '"><span class="oo-sec">' + (x.peek ? "inside (peeking)" : "inside (hidden)") + "</span>" + steps + "</div>" +
        "</div>" + abcHtml;
    }
  };

  var LESSONS = { classes: classes, inherit: inherit, poly: poly, encap: encap, abstr: abstr };

  /* ============================================================
     page wiring
     ============================================================ */

  var stage = $("#stage"), say = $("#say"), stepsEl = $("#steps");
  var current = /^#(classes|inherit|poly|encap|abstr)$/.test(location.hash) ? location.hash.slice(1) : "classes";
  var code = AV.Code($("#code"), [], $("#now"));
  var learnBtn = AV.learn($("#learn"), LESSONS[current].topic);

  function render(f) {
    LESSONS[current].draw(stage, f);
    code.mark(f.line);
    say.innerHTML = f.msg;
    stepsEl.textContent = f.steps;
  }
  var player = AV.Player($("#controls"), render, {
    keys: true, speed: 1,
    steady: [{ el: say, html: function (f) { return f.msg; } }]
  });

  function args() {
    var objs = LESSONS.classes.state.objs;
    return {
      name: ($("#in-name").value || "Max").replace(/[^A-Za-z ]/g, "").trim().slice(0, 10) || "Max",
      age: Math.max(0, Math.min(30, parseInt($("#in-age").value, 10) || 1)),
      pick: Math.min(+$("#in-pick").value || 0, Math.max(0, objs.length - 1)),
      pet: +$("#in-pet").value || 0,
      kind: $("#in-kind").value,
      size: Math.max(1, Math.min(6, parseInt($("#in-size").value, 10) || 2)),
      amount: parseInt($("#in-amount").value, 10) || 0,
      peek: $("#in-peek").checked
    };
  }

  function codeFor(L, key, a) {
    var op = L.ops[key];
    if (L === inherit) { return inherit.codeAll(a, key); }
    if (L === poly) { return POLY; }
    if (L === encap) {
      var call = key === "hack" ? "acct.__balance = -1000" : "acct." + key + "(" + (key === "balance" ? "" : a.amount) + ")";
      return BANK.concat(["", call]);
    }
    return typeof op.code === "function" ? op.code(a, L.state) : op.code;
  }

  function fillPick() {
    var sel = $("#in-pick"), keep = sel.value;
    sel.innerHTML = LESSONS.classes.state.objs.map(function (o, i) { return '<option value="' + i + '">' + esc(o.v) + "</option>"; }).join("");
    if (keep && +keep < sel.options.length) { sel.value = keep; }
  }

  function run(key) {
    var L = LESSONS[current], op = L.ops[key], a = args();
    document.querySelectorAll("[data-op]").forEach(function (x) {
      x.setAttribute("aria-pressed", x.getAttribute("data-op") === key ? "true" : "false");
    });
    code.load(codeFor(L, key, a));
    var r = Rec(L.state);
    op.run(r, a);
    if (!r.frames.length) { r.snap(-1, "Nothing to do."); }
    L.state = clone(r.st);
    if (L === classes) { fillPick(); }
    player.load(r.frames);
    if (!AV.calm) { player.play(); }
    if (window.innerWidth < 900) {
      stage.closest(".av-panel").scrollIntoView({ behavior: AV.calm ? "auto" : "smooth", block: "start" });
    }
  }

  function idle(msg) {
    var r = Rec(LESSONS[current].state);
    r.snap(-1, msg);
    player.load(r.frames);
  }

  function show(key) {
    current = key;
    var L = LESSONS[key];
    stage.className = "av-stage oo-stage is-" + key;
    L.setup(stage);
    $("#lesson-name").textContent = L.name;
    $("#how").innerHTML = L.how.map(function (h) { return "<li>" + h + "</li>"; }).join("");
    learnBtn.topic(L.topic);
    document.querySelectorAll("[data-in]").forEach(function (g) { g.hidden = g.getAttribute("data-in") !== L.inputs; });
    var ops = $("#ops");
    ops.innerHTML = "";
    Object.keys(L.ops).forEach(function (k) {
      var btn = AV.el("button", "av-op", "<span>" + esc(L.ops[k].label) + "</span>");
      btn.type = "button";
      btn.setAttribute("data-op", k);
      btn.setAttribute("aria-pressed", "false");
      btn.addEventListener("click", function () { run(k); });
      ops.appendChild(btn);
    });
    $("#reset").hidden = !L.reset;
    if (L === classes) { fillPick(); }
    var first = Object.keys(L.ops)[0];
    code.load(codeFor(L, first, args()));
    idle("Pick an action on the right to watch it run.");
  }

  $("#reset").addEventListener("click", function () {
    var L = LESSONS[current];
    if (L.reset) { L.state = L.reset(); }
    if (L === classes) { fillPick(); }
    idle("Back to the start.");
  });

  document.querySelectorAll("#lessons [data-pick]").forEach(function (p) {
    p.setAttribute("aria-pressed", p.getAttribute("data-pick") === current ? "true" : "false");
  });
  AV.pills($("#lessons"), function (k) {
    try { history.replaceState(null, "", "#" + k); } catch (e) { /* file:// */ }
    show(k);
  });
  show(current);

  AV.quiz($("#quiz"), [
    {
      q: "rex and bella are both Dogs. You call rex.birthday(). What happens to bella's age?",
      opts: ["It goes up too", "Nothing: each object has its own data", "It resets to 0", "It's an error"], a: 1,
      why: "The method is shared, but <b>self</b> is rex, so only rex's age changes. Try it in <b>Classes &amp; objects</b>."
    },
    {
      q: "bit is a Puppy (Puppy → Dog → Animal). Where does bit.eat() come from?",
      opts: ["Puppy", "Dog", "Animal", "Nowhere, it's an error"], a: 2,
      why: "Python looks in Puppy, then Dog, then Animal, and finds eat() there. Run it in <b>Inheritance</b> and watch it climb."
    },
    {
      q: "Why make a bank balance private?",
      opts: ["To make the code faster", "So it can only change through methods that check the rules", "Python requires it", "To save memory"], a: 1,
      why: "If anyone could set balance = -1000, the rules in deposit() and withdraw() would be pointless. Private data plus guarded methods is <b>encapsulation</b>."
    },
    {
      q: "for s in shapes: s.area() works on circles, squares and triangles. That's called...",
      opts: ["Encapsulation", "Polymorphism", "Recursion", "Inheritance"], a: 1,
      why: "One call, many forms. Each class has its own area(), and Python picks the right one for each object."
    },
    {
      q: "Why does Shape() give a TypeError?",
      opts: ["Shape is misspelled", "Shape is abstract: an idea every real shape builds on, not a shape itself", "Shapes need a size", "Python doesn't allow classes called Shape"], a: 1,
      why: "An abstract class defines what its children must have (area()) but can't be built itself. It's a contract, not a product."
    }
  ], $("#quiz-score"));
})();
