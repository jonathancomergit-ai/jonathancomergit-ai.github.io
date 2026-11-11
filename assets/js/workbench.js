// Workbench: three toys built on REAL data and code from the projects (assets/play/).
//   01  MindFlight   the real trained interceptor brain, flying live in a JavaScript copy of the sim
//   02  Dream World  frames the model dreamed, walked through at your own pace
//   03  MiniGPT      the run's own writing samples, test scores and loss across training
// Each toy only starts when it scrolls into view, and stops when it scrolls away.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { loadSim, aimThrow } from "./mindflight-sim.js";

const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const COL = { bg: 0x0b0b0a, line: 0x3a3832, text: 0xeeede6, hot: 0xd97857, sea: 0x8eb7c2, gold: 0xe3b66a, green: 0x9bcb8a, red: 0xe06c5a };
const $ = (id) => document.getElementById(id);
const press = (btn, on) => btn.setAttribute("aria-pressed", on ? "true" : "false");
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

function whenVisible(el, start, stop) {
  let on = false;
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !on) { on = true; start(); }
    else if (!e.isIntersecting && on) { on = false; stop && stop(); }
  }, { threshold: 0.12 }).observe(el);
}
// One pressed button in a group (a radio row). Returns a function that reads the pressed value.
function radio(buttons, onPick) {
  buttons.forEach((b) => b.addEventListener("click", () => { buttons.forEach((x) => press(x, x === b)); onPick(b); }));
}

/* =========================================================================
   01 · MindFlight: throw balls at the real trained brain.
   ========================================================================= */
function interceptor() {
  const stage = $("ic-stage");
  if (!stage) return;
  const hud = $("ic-hud"), hint = $("ic-hint"), score = $("ic-score"), caughtBig = $("ic-caught");
  let built = false, failed = false, running = false, raf = 0, last = 0, acc = 0;
  let meta, sim, scene, cam, renderer, controls, drone, props, finder, ball, trail, predLine, goMark, flash, pin, ghost, droneTrail;
  let prev, cur, simSteps = 0, nextAuto = 50, hudUntil = 0, hudText = "", userMoved = false;
  let speed = 0.5, playing = !reduceMotion, auto = !reduceMotion, style = "mix", showTracker = false;
  const TRAIL = 16, DTRAIL = 40;
  const trailPts = [], dronePts = [];
  let ev = { kind: 0, pos: [0, 0, 0], at: -1e9 };            // the last catch or miss, for the flash

  // MindFlight is z-up, in metres. three.js is y-up.
  const V = (p) => new THREE.Vector3(p[0], p[2], -p[1]);
  const Q = (q) => new THREE.Quaternion(q[1], q[3], -q[2], q[0]);
  const snap = () => ({ p: sim.p.slice(), q: sim.q.slice(), b: sim.bp.slice(), fly: sim.flying });

  function makeDrone() {                         // a Crazyflie-sized quad, drawn to scale (9 cm motor to motor)
    const g = new THREE.Group();
    const body = new THREE.MeshStandardMaterial({ color: 0x8d897d, roughness: 0.5, metalness: 0.3 });
    const edge = new THREE.MeshStandardMaterial({ color: 0xc9c5b8, roughness: 0.4, metalness: 0.5 });
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.009, 0.022), body));
    const ps = [], arm = 0.0397 / Math.SQRT2;
    [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([sx, sz], i) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.0397, 0.003, 0.004), body);
      m.position.set(sx * arm / 2, 0, sz * arm / 2); m.rotation.y = -Math.atan2(sz, sx); g.add(m);
      const mot = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.005, 0.008, 12), edge);
      mot.position.set(sx * arm, 0.004, sz * arm); g.add(mot);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0235, 0.002, 6, 32), new THREE.MeshBasicMaterial({ color: sx > 0 ? COL.hot : COL.sea }));
      ring.rotation.x = Math.PI / 2; ring.position.set(sx * arm, 0.009, sz * arm); g.add(ring);
      const blades = new THREE.Group(); blades.position.set(sx * arm, 0.0095, sz * arm);
      for (let k = 0; k < 2; k++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.0006, 0.0035), new THREE.MeshBasicMaterial({ color: COL.text, transparent: true, opacity: 0.6 }));
        b.rotation.y = k * Math.PI / 2; blades.add(b);
      }
      g.add(blades); ps.push({ blades, dir: i === 0 || i === 3 ? 1 : -1 });
    });
    return [g, ps];
  }
  const lineOf = (n, mat) => {
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const l = new THREE.Line(g, mat); l.frustumCulled = false; return l;
  };
  function setLine(line, pts) {
    const a = line.geometry.attributes.position.array;
    pts.forEach((v, i) => { a[3 * i] = v.x; a[3 * i + 1] = v.y; a[3 * i + 2] = v.z; });
    line.geometry.setDrawRange(0, pts.length); line.geometry.attributes.position.needsUpdate = true;
  }

  async function build() {
    built = true;
    try {
      ({ meta, sim } = await loadSim("assets/play/"));
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch (err) {
      failed = true; hint.style.opacity = 0;
      hud.textContent = "This one needs WebGL, and your browser didn't start it.";
      return;
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor(COL.bg, 1);
    stage.prepend(renderer.domElement);
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(COL.bg, 22, 60);
    cam = new THREE.PerspectiveCamera(42, 1, 0.05, 120);
    controls = new OrbitControls(cam, renderer.domElement);
    controls.enableDamping = true; controls.enablePan = false; controls.minDistance = 1.2; controls.maxDistance = 30;
    controls.maxPolarAngle = Math.PI * 0.495;             // stay above the floor
    controls.enableZoom = false;                          // the wheel scrolls the page until you click the scene (see wire)
    renderer.domElement.style.touchAction = "pan-y";      // a sideways drag spins the view; up/down still scrolls the page
    controls.addEventListener("start", () => { userMoved = true; hint.style.opacity = 0; });
    scene.add(new THREE.HemisphereLight(0xfff1e6, 0x1a1816, 1.5));
    const key = new THREE.DirectionalLight(0xffe2cc, 2.0); key.position.set(3, 8, 4); scene.add(key);
    const grid = new THREE.GridHelper(40, 40, COL.line, COL.line); grid.material.transparent = true; grid.material.opacity = 0.35; scene.add(grid);

    const P = meta.person, T = meta.throws, arc = (T.arc_deg * Math.PI) / 180;
    // the person: a plain stand-in (a cylinder and a head), exactly as MindFlight's own viewer draws it
    const pm = new THREE.MeshStandardMaterial({ color: 0x35332e, roughness: 0.85 });
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(P.radius, P.radius, 1.55, 32), pm); torso.position.y = 0.775; scene.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 16), pm); head.position.y = 1.68; scene.add(head);
    // the line the drone may not cross (0.5 m from the body), and the spot it waits at
    const safe = new THREE.Mesh(new THREE.TorusGeometry(P.radius + P.safety + meta.drone_radius, 0.008, 6, 96), new THREE.MeshBasicMaterial({ color: COL.red, transparent: true, opacity: 0.6 }));
    safe.rotation.x = Math.PI / 2; safe.position.y = 0.01; scene.add(safe);
    const guard = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8), new THREE.MeshBasicMaterial({ color: COL.text, transparent: true, opacity: 0.45 }));
    guard.position.copy(V(P.guard)); scene.add(guard);
    // the throw zone: where the thrower stood in training (6-10 m away, 45 degrees each side)
    const zone = new THREE.Mesh(new THREE.RingGeometry(T.distance[0], T.distance[1], 48, 1, -arc, 2 * arc),
      new THREE.MeshBasicMaterial({ color: COL.hot, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
    zone.rotation.x = -Math.PI / 2; zone.position.y = 0.012; scene.add(zone);
    const edgePts = [];
    for (let i = 0; i <= 48; i++) { const a = -arc + (2 * arc * i) / 48; edgePts.push(V([T.distance[1] * Math.cos(a), T.distance[1] * Math.sin(a), 0.02])); }
    for (let i = 48; i >= 0; i--) { const a = -arc + (2 * arc * i) / 48; edgePts.push(V([T.distance[0] * Math.cos(a), T.distance[0] * Math.sin(a), 0.02])); }
    edgePts.push(edgePts[0].clone());
    const zoneEdge = lineOf(edgePts.length, new THREE.LineBasicMaterial({ color: COL.hot, transparent: true, opacity: 0.7 })); setLine(zoneEdge, edgePts); scene.add(zoneEdge);

    [drone, props] = makeDrone(); scene.add(drone);
    finder = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.004, 6, 48), new THREE.MeshBasicMaterial({ color: COL.sea, transparent: true, opacity: 0.55, depthTest: false })); scene.add(finder);
    droneTrail = lineOf(DTRAIL, new THREE.LineBasicMaterial({ color: COL.sea, transparent: true, opacity: 0.35 })); scene.add(droneTrail);
    ball = new THREE.Mesh(new THREE.SphereGeometry(meta.ball.radius, 20, 14), new THREE.MeshStandardMaterial({ color: COL.hot, emissive: COL.hot, emissiveIntensity: 0.9 })); scene.add(ball);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(meta.ball.radius * 2.6, 16, 12), new THREE.MeshBasicMaterial({ color: COL.hot, transparent: true, opacity: 0.22, depthWrite: false }));
    ball.add(glow);                                       // a soft halo so a 7 cm ball is easy to follow
    trail = lineOf(TRAIL, new THREE.LineBasicMaterial({ color: COL.hot, transparent: true, opacity: 0.7 })); scene.add(trail);
    predLine = lineOf(meta.path_points, new THREE.LineDashedMaterial({ color: 0xf0b49a, dashSize: 0.07, gapSize: 0.05 })); scene.add(predLine);
    goMark = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.006, 8, 32), new THREE.MeshBasicMaterial({ color: COL.gold, depthTest: false })); scene.add(goMark);
    flash = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: COL.green, transparent: true, opacity: 0, depthWrite: false })); scene.add(flash);
    // where the last ball was thrown from, and (with a mouse) where the next one would be
    const pinMat = new THREE.MeshBasicMaterial({ color: COL.hot, transparent: true, opacity: 0 });
    pin = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 8), pinMat); pole.position.y = 0.5; pin.add(pole);
    const foot = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.2, 32), pinMat); foot.rotation.x = -Math.PI / 2; foot.position.y = 0.015; pin.add(foot);
    pin.userData.mat = pinMat; scene.add(pin);
    ghost = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.26, 32), new THREE.MeshBasicMaterial({ color: COL.text, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    ghost.rotation.x = -Math.PI / 2; ghost.visible = false; scene.add(ghost);

    prev = snap(); cur = snap();
    new ResizeObserver(size).observe(stage); size();
    wire();
    score.textContent = "caught 0 of 0";
  }

  // The opening view: over the person's shoulder, the drone close by, the throw zone spread out ahead.
  function fitCamera() {
    const tall = cam.aspect < 1;
    cam.fov = tall ? 64 : 46; cam.updateProjectionMatrix();
    cam.position.copy(V(tall ? [-3.3, -1.0, 3.5] : [-3.6, -2.0, 3.2]));
    controls.target.copy(V(tall ? [5.2, 0.3, 0.2] : [5.4, 0.7, 0.2]));
    controls.update();
  }
  function size() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    if (!userMoved) fitCamera();
  }

  /* ---- throwing ---- */
  function zoneSpot(clientX, clientY) {             // screen point -> the nearest spot in the throw zone (MindFlight x, y)
    const r = renderer.domElement.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), cam);
    const hit = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
    if (!hit) return null;
    const T = meta.throws, arc = (T.arc_deg * Math.PI) / 180;
    return { dist: clamp(Math.hypot(hit.x, -hit.z), T.distance[0], T.distance[1]), ang: clamp(Math.atan2(-hit.z, hit.x), -arc, arc) };
  }
  function throwFrom(spot, byUser) {
    const T = meta.throws, u = (lo, hi) => lo + (hi - lo) * Math.random();
    const arc = (T.arc_deg * Math.PI) / 180;
    const s = spot || { dist: u(...T.distance), ang: u(-arc, arc) };
    const flight = style === "fast" ? u(T.flight_s[0], 0.95) : style === "lob" ? u(1.25, T.flight_s[1]) : u(...T.flight_s);
    const release = [s.dist * Math.cos(s.ang), s.dist * Math.sin(s.ang), u(...T.release_height)];
    const side = u(-T.torso_sideways, T.torso_sideways);
    const target = [-side * Math.sin(s.ang), side * Math.cos(s.ang), u(...T.torso_height)];     // somewhere on the torso
    const t = aimThrow(meta, release, target, flight);
    sim.throwBall(t);
    pin.position.copy(V([release[0], release[1], 0])); pin.children[0].scale.y = release[2]; pin.children[0].position.y = release[2] / 2;
    pin.userData.mat.opacity = 0.9;
    say(sim.flying ? "one ball at a time: yours is next" : `thrown at <b>${Math.hypot(...t.vel).toFixed(1)} m/s</b>`, 1.6);
    nextAuto = simSteps + Math.round((byUser ? 6 : 2.5 + 0.5 * Math.random()) / meta.policy_dt);
    if (byUser) hint.style.opacity = 0;
  }
  function say(html, seconds) { hudText = html; hudUntil = performance.now() + seconds * 1000; }

  function wire() {
    const el = renderer.domElement;
    let down = null;
    el.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; controls.enableZoom = true; });
    el.addEventListener("pointerup", (e) => {          // a tap (not a drag) throws a ball from that spot
      if (!down) return;
      const tap = Math.hypot(e.clientX - down.x, e.clientY - down.y) < 8 && performance.now() - down.t < 500;
      down = null;
      if (!tap) return;
      const spot = zoneSpot(e.clientX, e.clientY);
      if (spot) { if (!playing) setPlay(true); throwFrom(spot, true); }
    });
    el.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse" || e.buttons) { ghost.visible = false; return; }
      const spot = zoneSpot(e.clientX, e.clientY);
      ghost.visible = !!spot;
      if (spot) ghost.position.copy(V([spot.dist * Math.cos(spot.ang), spot.dist * Math.sin(spot.ang), 0.02]));
    });
    el.addEventListener("pointerleave", (e) => { ghost.visible = false; if (e.pointerType === "mouse") controls.enableZoom = false; });
    $("ic-throw").onclick = () => { if (!playing) setPlay(true); throwFrom(null, true); };
    $("ic-play").onclick = () => setPlay(!playing);
    setPlay(playing);
    radio([...document.querySelectorAll("#interceptor [data-speed]")], (b) => { speed = +b.dataset.speed; });
    radio([...document.querySelectorAll("#interceptor [data-style]")], (b) => { style = b.dataset.style; });
    const trk = $("ic-tracker"), au = $("ic-auto");
    trk.onclick = () => { showTracker = !showTracker; press(trk, showTracker); };
    press(au, auto);
    au.onclick = () => { auto = !auto; press(au, auto); nextAuto = simSteps + 25; };
  }
  function setPlay(on) {
    playing = on; const b = $("ic-play"); press(b, on); b.innerHTML = on ? "&#10074;&#10074; pause" : "&#9654; play";
  }

  /* ---- one 20 ms step of the real sim ---- */
  function tick() {
    if (auto && !sim.flying && !sim.pending && simSteps >= nextAuto) throwFrom(null, false);
    prev = cur;
    const what = sim.step();
    simSteps += 1;
    cur = snap();
    if (cur.fly && !prev.fly) { prev = { ...prev, b: cur.b }; trailPts.length = 0; }
    if (what === "crash") {
      prev = cur; dronePts.length = 0;
      say(`<span class="bad">crashed: ${sim.crashReason}.</span> back to its spot`, 2.4);
    } else if (what === "caught") say(`<span class="ok">caught!</span>`, 1.2);
    else if (what === "hit") say(`<span class="bad">that one got through</span>`, 1.6);
    if (what === "caught" || what === "hit") ev = { kind: sim.event.kind, pos: sim.event.pos.slice(), at: simSteps };
    if (what) {
      const c = sim.counts;
      score.textContent = `caught ${c.caught} of ${c.throws}`;
      caughtBig.textContent = `${c.caught} / ${c.throws}`;
    }
    dronePts.push(V(cur.p)); if (dronePts.length > DTRAIL) dronePts.shift();
    if (cur.fly) { trailPts.push(V(cur.b)); if (trailPts.length > TRAIL) trailPts.shift(); }
  }

  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    if (playing) {
      acc += dt * speed;
      for (let n = 0; acc >= meta.policy_dt && n < 6; n++) { acc -= meta.policy_dt; tick(); }
      if (acc > meta.policy_dt) acc = 0;
    }
    const a = clamp(acc / meta.policy_dt, 0, 1);
    const dp = V(prev.p).lerp(V(cur.p), a);
    drone.position.copy(dp);
    drone.quaternion.copy(Q(prev.q)).slerp(Q(cur.q), a);
    if (playing) props.forEach((p, i) => { p.blades.rotation.y = p.dir * now * 0.04 + i; });
    finder.position.copy(dp); finder.quaternion.copy(cam.quaternion);
    setLine(droneTrail, dronePts.concat([dp]));
    ball.visible = trail.visible = cur.fly;
    if (cur.fly) { const bp = V(prev.b).lerp(V(cur.b), a); ball.position.copy(bp); setLine(trail, trailPts.slice(0, -1).concat([bp])); }
    // the catch / miss flash, where it happened
    const since = (simSteps - ev.at + a) * meta.policy_dt;
    if (ev.kind && since >= 0 && since < 0.45) {
      const g = since / 0.45;
      flash.material.color.setHex(ev.kind === 1 ? COL.green : COL.red);
      flash.position.copy(V(ev.pos)); flash.scale.setScalar(0.04 + 0.22 * g); flash.material.opacity = 0.6 * (1 - g);
    } else flash.material.opacity = 0;
    pin.userData.mat.opacity = Math.max(0, pin.userData.mat.opacity - dt * 0.35);
    // what the tracker tells the brain: its predicted path (dashed) and the "go here" point
    const tr = sim.tracker, show = showTracker && cur.fly && tr.has;
    predLine.visible = goMark.visible = show;
    if (show) {
      const pts = [];
      for (let i = tr.seen; i < meta.path_points; i++) {
        const z = sim.predPath[3 * i + 2];
        if (z < meta.ball.radius) break;
        pts.push(V([sim.predPath[3 * i], sim.predPath[3 * i + 1], z]));
        if (Math.hypot(sim.predPath[3 * i], sim.predPath[3 * i + 1]) < meta.person.radius) break;
      }
      setLine(predLine, pts); predLine.computeLineDistances();
      goMark.position.copy(V(tr.go)); goMark.quaternion.copy(cam.quaternion);
    }
    hud.innerHTML = now < hudUntil ? hudText : show ? `tracker: be here in <b>${Math.max(0, tr.timeLeft).toFixed(2)} s</b>` : playing ? `speed <b>${speed}&times;</b>` : "paused";
    controls.update();
    renderer.render(scene, cam);
  }

  whenVisible(stage, async () => { if (!built) await build(); if (failed) return; running = true; last = 0; raf = requestAnimationFrame(frame); },
                     () => { running = false; cancelAnimationFrame(raf); });
}

/* =========================================================================
   02 · Dream World: walk through dreamed frames (hold W / the button, or drag the slider).
   ========================================================================= */
function dream() {
  const stage = $("dw-stage");
  if (!stage) return;
  const cv = $("dw-canvas"), ctx = cv.getContext("2d"), slider = $("dw-slider"), readout = $("dw-count"), walkBtn = $("dw-walk");
  let MAN, clip = "river", pos = 0, walking = false, running = false, raf = 0, last = 0, built = false, dirty = true;
  const sheets = {};                                            // "river_0.jpg" -> Image (loaded as you walk)
  const SCALE = 3;

  function sheet(name, i) {
    const file = MAN.clips[name].sheets[i];
    if (!file) return null;
    if (!sheets[file]) { const im = new Image(); im.onload = () => { dirty = true; }; im.src = `assets/play/dream/${file}`; sheets[file] = im; }
    return sheets[file].complete && sheets[file].naturalWidth ? sheets[file] : null;
  }
  // Draw frame k of a clip into the box (x, y, w, h), cross-faded with the next frame so 10 fps plays smoothly.
  function drawFrame(name, k, x, y, w, h) {
    const n = MAN.clips[name].n, k0 = clamp(Math.floor(k), 0, n - 1), k1 = Math.min(n - 1, k0 + 1), f = k - Math.floor(k);
    const put = (q, alpha) => {
      const im = sheet(name, Math.floor(q / MAN.per));
      if (!im) return false;
      const j = q % MAN.per;
      ctx.globalAlpha = alpha;
      ctx.drawImage(im, (j % MAN.cols) * MAN.fw, Math.floor(j / MAN.cols) * MAN.fh, MAN.fw, MAN.fh, x, y, w, h);
      ctx.globalAlpha = 1;
      return true;
    };
    const ok = put(k0, 1);
    if (ok && f > 0.01 && k1 !== k0) put(k1, f);
    if (k0 + 40 < n) sheet(name, Math.floor((k0 + 40) / MAN.per));     // fetch the next sheet before we get there
    return ok;
  }
  function label(text, x, y) {
    ctx.font = "600 19px ui-monospace, 'JetBrains Mono', monospace"; ctx.textBaseline = "top";
    const w = ctx.measureText(text).width;
    ctx.fillStyle = "rgba(14,14,13,.78)"; ctx.fillRect(x, y, w + 18, 30);
    ctx.fillStyle = "#eeede6"; ctx.fillText(text, x + 9, y + 6);
  }
  function draw() {
    const W = MAN.fw * SCALE, H = MAN.fh * SCALE, fix = clip === "fix";
    const wantH = fix ? 2 * H + 8 : H;
    if (cv.width !== W || cv.height !== wantH) { cv.width = W; cv.height = wantH; cv.style.aspectRatio = `${W} / ${wantH}`; }
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    let ok;
    if (fix) {
      ctx.fillStyle = "#0b0b0a"; ctx.fillRect(0, H, W, 8);
      ok = drawFrame("fix_old", pos, 0, 0, W, H) & drawFrame("fix_new", pos, 0, H + 8, W, H);
      label("before the fix", 8, 8); label("after the fix", 8, H + 16);
    } else ok = drawFrame(clip, pos, 0, 0, W, H);
    const c = MAN.clips[fix ? "fix_new" : clip];
    readout.textContent = ok ? `${(c.start_s + pos / MAN.fps).toFixed(1)} s into the dream` : "loading the dream...";
    slider.value = Math.round(pos);
    dirty = !ok;
  }
  function pick(name) {
    clip = name; pos = 0; walking = false; walkBtn.classList.remove("down");
    slider.max = MAN.clips[name === "fix" ? "fix_new" : name].n - 1; dirty = true;
  }
  async function build() {
    built = true;
    MAN = await fetch("assets/play/dream/manifest.json").then((r) => r.json());
    const down = (e) => { e.preventDefault(); walking = true; walkBtn.classList.add("down"); };
    const up = () => { walking = false; walkBtn.classList.remove("down"); };
    walkBtn.addEventListener("pointerdown", down); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
    walkBtn.addEventListener("contextmenu", (e) => e.preventDefault());
    walkBtn.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") down(e); });
    walkBtn.addEventListener("keyup", up);
    window.addEventListener("keydown", (e) => {
      if ((e.key === "w" || e.key === "W") && running && !e.ctrlKey && !e.metaKey && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { walking = true; walkBtn.classList.add("down"); }
    });
    window.addEventListener("keyup", (e) => { if (e.key === "w" || e.key === "W") up(); });
    window.addEventListener("blur", up);
    slider.addEventListener("input", () => { pos = +slider.value; dirty = true; });
    radio([...document.querySelectorAll("#dream [data-clip]")], (b) => pick(b.dataset.clip));
    pick(clip);
  }
  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.25, (now - (last || now)) / 1000); last = now;      // real walking speed, even on a slow phone
    if (walking) { pos = Math.min(+slider.max, pos + dt * MAN.fps); dirty = true; }
    if (dirty) draw();
  }
  whenVisible(stage, async () => { if (!built) await build(); running = true; last = 0; dirty = true; raf = requestAnimationFrame(frame); },
                     () => { running = false; walking = false; cancelAnimationFrame(raf); });
}

/* =========================================================================
   03 · MiniGPT: the same prompts across training, with the run's own scores.
   ========================================================================= */
async function minigpt() {
  const box = $("mg-text");
  if (!box) return;
  const D = await fetch("assets/play/minigpt.json").then((r) => r.json());
  const names = { story: "a story", fact: "the sun", explain: "plants", science: "boiling water", curious: "what i want to learn" };
  // The one prompt with a checkable answer: say what it is, so nobody learns a wrong fact from the model.
  const truth = { science: "The real answer: lower, not higher. Water boils at about 70 °C on top of Everest, because the air pressure is so low." };
  const slider = $("mg-slider"), playBtn = $("mg-play"), chart = $("mg-chart"), wrap = $("mg-prompts");
  const evalAt = new Map(D.evals.map((e) => [e.step, e]));
  let cur = "story", typed = 0, target = "", timer = 0, playTimer = 0;
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const stepNow = () => { const P = D.prompts[cur]; return P.steps[Math.min(+slider.value, P.steps.length - 1)]; };

  Object.keys(names).forEach((k) => {
    const b = document.createElement("button"); b.className = "tchip"; b.textContent = names[k]; press(b, k === cur);
    b.onclick = () => {
      const step = stepNow().step;                              // stay at the same point in training
      cur = k; wrap.querySelectorAll(".tchip").forEach((x) => press(x, x === b));
      const steps = D.prompts[k].steps; slider.max = steps.length - 1;
      slider.value = steps.reduce((best, s, i) => (Math.abs(s.step - step) < Math.abs(steps[best].step - step) ? i : best), 0);
      show(true);
    };
    wrap.appendChild(b);
  });

  function drawChart(step) {                                    // the run's training loss, with a dot where the slider is
    const w = chart.clientWidth, h = chart.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    if (!w) return;
    if (chart.width !== Math.round(w * dpr)) { chart.width = Math.round(w * dpr); chart.height = Math.round(h * dpr); }
    const c = chart.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
    const css = getComputedStyle(document.documentElement), col = (n, d) => css.getPropertyValue(n).trim() || d;
    const lo = Math.log10(30), hi = Math.log10(D.loss[D.loss.length - 1][0] + 30);
    const X = (s) => 6 + ((Math.log10(s + 30) - lo) / (hi - lo)) * (w - 12), Y = (l) => 8 + ((11 - l) / (11 - 2)) * (h - 24);
    c.strokeStyle = col("--line", "#33312c"); c.lineWidth = 1;
    [10, 6, 3].forEach((l) => { c.beginPath(); c.moveTo(6, Y(l)); c.lineTo(w - 6, Y(l)); c.stroke(); });
    c.fillStyle = col("--text-faint", "#77746b"); c.font = "10px ui-monospace, monospace"; c.textBaseline = "bottom";
    [10, 6, 3].forEach((l) => c.fillText(`loss ${l}`, 8, Y(l) - 2));
    c.textBaseline = "alphabetic"; c.textAlign = "right"; c.fillText("more training →", w - 8, h - 4); c.textAlign = "left";
    c.strokeStyle = col("--text-dim", "#aaa79d"); c.lineWidth = 1.5; c.beginPath();
    D.loss.forEach(([s, l], i) => (i ? c.lineTo(X(s), Y(l)) : c.moveTo(X(s), Y(l))));
    c.stroke();
    const e = evalAt.get(step);
    if (e) { c.fillStyle = col("--hot", "#d97857"); c.beginPath(); c.arc(X(step), Y(e.val_loss), 5, 0, 7); c.fill(); }
  }
  function show(retype) {
    const P = D.prompts[cur], s = stepNow(), e = evalAt.get(s.step);
    $("mg-meta").textContent = `step ${s.step.toLocaleString("en-US")} of 61,035`;
    $("mg-tokens").textContent = e.tokens >= 1e9 ? `${(e.tokens / 1e9).toFixed(1)} billion tokens read` : `${Math.round(e.tokens / 1e6)} million tokens read`;
    $("mg-loss").textContent = e.val_loss.toFixed(2);
    $("mg-quiz").textContent = `${Math.round(e.quiz * 100)}%`;
    $("mg-last").textContent = `${Math.round(e.last_word * 100)}%`;
    $("mg-truth").textContent = truth[cur] || "";
    drawChart(s.step);
    target = s.text; typed = retype && !reduceMotion ? 0 : target.length;
    clearInterval(timer);
    const paint = () => { box.innerHTML = `<span class="p">${esc(P.prompt)}</span> ${esc(target.slice(0, typed))}${typed < target.length ? '<span class="caret"></span>' : ""}`; };
    paint();
    if (typed < target.length) timer = setInterval(() => { typed = Math.min(target.length, typed + 4); paint(); if (typed >= target.length) clearInterval(timer); }, 24);
  }
  slider.oninput = () => show(false);                            // dragging shows each save at once; play types it out
  playBtn.onclick = () => {
    const on = playBtn.getAttribute("aria-pressed") !== "true";
    press(playBtn, on); playBtn.innerHTML = on ? "&#10074;&#10074; pause" : "&#9654; play through training";
    clearInterval(playTimer);
    if (!on) return;
    if (+slider.value >= +slider.max) slider.value = 0;
    show(true);
    playTimer = setInterval(() => { if (+slider.value >= +slider.max) { playBtn.click(); return; } slider.value = +slider.value + 1; show(true); }, 2400);
  };
  new ResizeObserver(() => drawChart(stepNow().step)).observe(chart);
  slider.max = D.prompts[cur].steps.length - 1;
  show(false);
}

interceptor();
dream();
minigpt().catch((err) => console.error("minigpt toy:", err));
