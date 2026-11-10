// Glyph Drift: my live wallpaper of characters lit by slow smoke, used here as
// the site background. site.js adds the <canvas class="glyph-layer"> and loads this file.
//
// Every cell of the screen holds a character all the time. Nothing moves; the LIGHT
// moves through them. "Smoke moving slowly through an ocean":
//   - the smoke is layered, curling noise that slowly brightens and dims the text
//   - the ocean is a real wave simulation: clicking drops a stone in, rings race
//     across the screen, bounce off the edges and pass through each other.
//   - the mouse is a soft flashlight: text near it lights up and scrambles.
//
// Four GPU passes per frame:
//   1. WAVE pass (a few times per frame): steps the 2D wave equation on a small
//      grid. Each texel stores (height now, height last step). Two textures take
//      turns being "read" and "write" (ping-pong), like double-buffering an array.
//   2. SMOKE pass: one pixel per character cell -> how lit that cell is right now.
//   3. GLYPH pass: every screen pixel finds its cell, picks the character, and
//      stamps it from a pre-drawn font atlas, lit by smoke + waves.
//
// Wallpaper Engine feeds its settings panel in through window.wallpaperPropertyListener
// (bottom of file). Opened in a normal browser it just uses the defaults below.

(function () {
"use strict";

// ---------------------------------------------------------------------------
// Settings. Colors are 0..1 RGB. Wallpaper Engine overrides these live.
// ---------------------------------------------------------------------------
const SETTINGS = {
  background: [0.055, 0.055, 0.052],
  glyph:      [0.62, 0.62, 0.58],
  wave:       [0.85, 0.47, 0.34],     // tint on wave crests (warm orange)
  charSize:   13,                     // font size in CSS px
  speed:      1.0,                    // how fast the smoke drifts
  smoke:      0.45,                   // 0 = mostly dark, 1 = mostly lit
  dimText:    0.07,                   // how visible the unlit text is
  waveSpeed:  1.0,                    // how fast ripples race across
  waveFade:   0.5,                    // 0 = die quickly, 1 = slosh around for ages
  waveStrength: 1.0,
  cursorGlow: false,                  // characters light up near the mouse (off by request)
  chars:      "abcdefghijklmnopqrstuvwxyz0123456789",
  fps:        0,                      // 0 = as fast as the screen refreshes
};

// The site runs the smoke only: no click ripples (my call, 2026-11-09), so the
// wave simulation is switched off and costs nothing. Set true to bring it back.
const WAVES = false;

const MAX_GLYPHS = 128;
const MAX_DROPS = 8;                  // stones per wave step (must match shader)
const SIM_CSS = 5;                    // one wave texel = this many CSS px, square
const STONE_R = 1.8;                  // stone size in wave texels (small = sharp ripples)
const STONE_A = 4.5;                  // how hard it hits
const STEPS_PER_SEC = 240;            // wave steps per second at waveSpeed 1

// Site version: the canvas sits fixed behind the page. Without WebGL2 the page
// keeps its plain dark background instead (the "no-glyphs" class).
const canvas = document.querySelector(".glyph-layer");
const gl = canvas.getContext("webgl2", { antialias: false, alpha: false });
if (!gl) {
  return;   // no WebGL2: the page keeps its plain dark background
}
// Needed to render into float textures (the wave heights are small signed floats).
const canFloat = !!gl.getExtension("EXT_color_buffer_float");
const floatLinear = !!gl.getExtension("OES_texture_float_linear");

// ---------------------------------------------------------------------------
// Shaders (GLSL ES 1.00, which WebGL2 still runs)
// ---------------------------------------------------------------------------

// One big triangle that covers the screen; every pass draws it.
const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

// Simplex noise by Ashima Arts / Stefan Gustavson (MIT license).
const NOISE = `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
// Fractal noise: four layers of noise, each finer and fainter. Gives smoke its
// soft-but-detailed texture. Each layer drifts at its own pace.
float fbm(vec2 p, float t) {
  float sum = 0.0, amp = 0.5;
  for (int i = 0; i < 4; i++) {
    sum += amp * snoise(vec3(p, t));
    p = mat2(1.6, 1.2, -1.2, 1.6) * p + 3.1;   // rotate + scale: hides grid patterns
    t *= 1.35;
    amp *= 0.5;
  }
  return sum;
}
`;

// Pass 1: the ocean. Wave equation, one step.
//   next = 2*now - last + c^2 * (sum of 4 neighbours - 4*now), then a little damping.
// Clamped texture edges make the borders act like walls, so rings bounce back.
const WAVE_FRAG = `
precision highp float;
#define MAXD ${MAX_DROPS}
uniform sampler2D uState;   // r = height now, g = height last step
uniform vec2  uSimRes;
uniform float uDamp;
uniform vec4  uDrops[MAXD]; // x, y (sim texels, GL y-up), radius, amount (0 = none)
void main() {
  vec2 px = 1.0 / uSimRes;
  vec2 uv = gl_FragCoord.xy * px;
  vec4 s = texture2D(uState, uv);
  float l = texture2D(uState, uv - vec2(px.x, 0.0)).r;
  float r = texture2D(uState, uv + vec2(px.x, 0.0)).r;
  float d = texture2D(uState, uv - vec2(0.0, px.y)).r;
  float u = texture2D(uState, uv + vec2(0.0, px.y)).r;
  float lap = l + r + u + d - 4.0 * s.r;
  float next = (2.0 * s.r - s.g + 0.45 * lap) * uDamp;   // 0.45 < 0.5 keeps it stable
  for (int i = 0; i < MAXD; i++) {
    vec4 dr = uDrops[i];
    if (dr.w == 0.0) continue;
    vec2 k = (gl_FragCoord.xy - dr.xy) / dr.z;
    float k2 = dot(k, k);
    // A bump with a shallow moat around it that holds exactly as much water as
    // the bump. A plain bump leaves a long dark "hole" behind its rings; this
    // leaves calm water instead.
    next += dr.w * (exp(-k2) - 0.25 * exp(-k2 * 0.25));
  }
  gl_FragColor = vec4(next, s.r, 0.0, 1.0);
}
`;

// Pass 2: the smoke. One output pixel per character cell -> light 0..1 in red.
const SMOKE_FRAG = `
precision highp float;
uniform vec2  uGrid;      // cells across, cells down
uniform vec2  uCellCss;   // cell size in CSS px (smoke looks the same at any DPI)
uniform float uTime;      // smoke time (already multiplied by speed)
uniform float uAmount;
uniform vec2  uSeed;      // random per monitor, so the three screens don't match
${NOISE}
void main() {
  vec2 cell = vec2(floor(gl_FragCoord.x), uGrid.y - 1.0 - floor(gl_FragCoord.y));
  vec2 p = (cell + 0.5) * uCellCss * 0.00055 + uSeed;
  float t = uTime * 0.018;                       // slow: it's drifting underwater

  // Warp the noise with more noise, twice. This is the classic trick for smoke:
  // each layer pushes the next one around, so shapes curl and stretch instead of
  // just sliding. (Inigo Quilez, "domain warping".)
  vec2 a = vec2(fbm(p + vec2(0.0, 0.0), t), fbm(p + vec2(5.2, 1.3), t));
  vec2 b = vec2(fbm(p + 1.6 * a + vec2(1.7, 9.2), t * 1.2),
                fbm(p + 1.6 * a + vec2(8.3, 2.8), t * 1.2));
  float f = fbm(p + 1.9 * b + vec2(t * 2.0, t * 0.4), t * 0.8);

  // Bright, soft billows...
  float thr = mix(0.30, -0.50, uAmount);
  float billow = smoothstep(thr, thr + 0.5, f);
  // ...plus thin wisps where the warp folds back on itself.
  float wisp = pow(clamp(1.0 - abs(f - thr * 0.6) * 4.0, 0.0, 1.0), 3.0) * length(b) * 0.9;
  float light = clamp(billow + wisp * (1.0 - billow), 0.0, 1.0);
  gl_FragColor = vec4(light, 0.0, 0.0, 1.0);
}
`;

// Pass 3: draw the characters.
const GLYPH_FRAG = `
precision highp float;
uniform vec2  uRes;          // canvas size in device px
uniform vec2  uCell;         // cell size in device px
uniform vec2  uGrid;
uniform float uScale;        // device px per CSS px
uniform float uTime;
uniform float uGlyphs;       // how many characters are in the atlas
uniform sampler2D uSmoke;
uniform sampler2D uWave;
uniform sampler2D uAtlas;
uniform vec2  uSimRes;
uniform float uSimPx;        // device px per wave texel
uniform float uWaveOn;
uniform float uWaveGain;
uniform float uDim;
uniform vec3  uBg, uFg, uAccent;
uniform vec3  uMouse;        // x, y (device px, screen coords), strength 0..1

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
// Wave height at a point given in GL pixel coords (y up).
float waveAt(vec2 glPx) {
  return texture2D(uWave, glPx / uSimPx / uSimRes).r;
}

void main() {
  vec2 gp = gl_FragCoord.xy;                 // GL coords, y up
  vec2 p = vec2(gp.x, uRes.y - gp.y);        // screen coords, y down

  // The water bends the light: shift where we read the text by the slope of the
  // wave surface, so letters wobble as a ripple passes (like looking into a pool).
  float wv = 0.0;
  vec2 slope = vec2(0.0);
  if (uWaveOn > 0.0) {
    float e = uSimPx;
    wv = waveAt(gp);
    slope = vec2(waveAt(gp + vec2(e, 0.0)) - waveAt(gp - vec2(e, 0.0)),
                 waveAt(gp - vec2(0.0, e)) - waveAt(gp + vec2(0.0, e)));
  }
  vec2 q = p + slope * 18.0 * uScale * uWaveGain;

  vec2 cf = q / uCell;
  vec2 cell = floor(cf);
  vec2 local = fract(cf);
  vec2 center = (cell + 0.5) * uCell;

  // How lit this cell is by the smoke (texture row 0 is the bottom).
  float light = texture2D(uSmoke, vec2(cell.x + 0.5, uGrid.y - cell.y - 0.5) / uGrid).r;

  // The wave measured at the cell's CENTER, for anything that picks which letter
  // shows. It must be the same for every pixel of a cell, or letters get stitched
  // together from pieces of different letters.
  float wc = uWaveOn > 0.0 ? waveAt(vec2(center.x, uRes.y - center.y)) * uWaveGain : 0.0;

  float h2 = hash(cell + 17.31);
  float h3 = hash(cell + 91.7);

  // Cursor: a soft flashlight that lights up and scrambles nearby characters.
  float near = 0.0;
  if (uMouse.z > 0.0) {
    vec2 dm = (center - uMouse.xy) / (150.0 * uScale);
    near = exp(-dot(dm, dm)) * uMouse.z;
  }
  light = max(light, near * 0.75);

  // Letters mostly stay put. Lit ones swap now and then; a passing wave flips them.
  float rate = 0.05 + h2 * 0.12 + floor(light * 4.0) * 0.12 + floor(min(abs(wc), 1.0) * 8.0) * 0.5
             + floor(near * 18.0) * 0.5;
  float tick = floor(uTime * rate + h3 * 13.0);
  float g = floor(hash(cell + vec2(tick * 7.13, tick * 1.37)) * uGlyphs);

  vec2 lc = clamp(local, 0.02, 0.98);
  float ink = texture2D(uAtlas, vec2((g + lc.x) / uGlyphs, lc.y)).a;

  // Brightness: always faintly there, lit by the smoke, crests add light and
  // troughs take it away (dark and light both make the shape).
  float w = wv * uWaveGain;
  float lum = mix(uDim, 1.0, pow(light, 1.8)) * (0.8 + 0.2 * h2);
  lum += w > 0.0 ? w * 0.6 : w * 0.3;      // crests light up more than troughs darken
  lum += near * 0.4;
  lum = clamp(lum, 0.0, 1.25);

  float tint = clamp(abs(w) * 1.6, 0.0, 1.0);
  vec3 ink3 = mix(uFg, uAccent, tint * 0.85);
  vec3 col = mix(uBg, ink3, clamp(ink * lum, 0.0, 1.0));
  col += uAccent * max(w, 0.0) * 0.05;           // faint shimmer on the crests
  gl_FragColor = vec4(col, 1.0);
}
`;

// ---------------------------------------------------------------------------
// GL plumbing
// ---------------------------------------------------------------------------
function compile(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(s));
  }
  return s;
}

function program(fragSrc) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fragSrc));
  gl.bindAttribLocation(p, 0, "aPos");
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  // Cache every uniform location by name, like a dict.
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const name = gl.getActiveUniform(p, i).name.replace("[0]", "");
    u[name] = gl.getUniformLocation(p, name);
  }
  return { p, u };
}

const waveProg = program(WAVE_FRAG);
const smokeProg = program(SMOKE_FRAG);
const glyphProg = program(GLYPH_FRAG);

const tri = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, tri);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);
gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

function makeTexture(filter) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

function makeTarget(tex) {
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return ok ? fbo : null;
}

const atlasTex = makeTexture(gl.LINEAR);   // LINEAR so bent text stays smooth
const smokeTex = makeTexture(gl.NEAREST);  // NEAREST: one exact value per cell
let smokeFbo = null;
// Wave textures: LINEAR (if the GPU allows it on floats) so ripples look smooth
// between texels. Reading exactly at texel centers still gives exact values.
const waveTex = [makeTexture(floatLinear ? gl.LINEAR : gl.NEAREST),
                 makeTexture(floatLinear ? gl.LINEAR : gl.NEAREST)];
let waveFbo = [null, null];
let waveRead = 0;                          // which of the two holds "now"
let waveOn = false;

// ---------------------------------------------------------------------------
// Layout: canvas size, cell size, font atlas, sim size
// ---------------------------------------------------------------------------
const layout = { dpr: 1, cellW: 8, cellH: 15, gridW: 1, gridH: 1, glyphs: 1,
                 simW: 1, simH: 1, simPx: 7 };

// Draw every character once, white on transparent, side by side in one strip.
// The shader then copies cells out of this strip (like slicing a sprite sheet).
function buildAtlas() {
  const px = Math.max(4, Math.round(SETTINGS.charSize * layout.dpr));
  const font = `${px}px "Geist Mono", "Cascadia Mono", Consolas, "Courier New", monospace`;
  const chars = Array.from(SETTINGS.chars || "x").slice(0, MAX_GLYPHS);

  const c2 = document.createElement("canvas");
  const ctx = c2.getContext("2d");
  ctx.font = font;
  layout.cellW = Math.max(2, Math.ceil(ctx.measureText("M").width));
  layout.cellH = Math.max(2, Math.round(px * 1.18));
  layout.glyphs = chars.length;

  c2.width = layout.cellW * chars.length;   // resizing resets the context...
  c2.height = layout.cellH;
  ctx.font = font;                          // ...so set the font again
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  chars.forEach((ch, i) => {
    ctx.fillText(ch, (i + 0.5) * layout.cellW, layout.cellH * 0.54);
  });

  gl.bindTexture(gl.TEXTURE_2D, atlasTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c2);
}

function resize() {
  layout.dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(window.innerWidth * layout.dpr));
  canvas.height = Math.max(1, Math.round(window.innerHeight * layout.dpr));
  buildAtlas();
  layout.gridW = Math.ceil(canvas.width / layout.cellW) + 1;
  layout.gridH = Math.ceil(canvas.height / layout.cellH) + 1;

  gl.bindTexture(gl.TEXTURE_2D, smokeTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, layout.gridW, layout.gridH, 0,
                gl.RGBA, gl.UNSIGNED_BYTE, null);
  smokeFbo = makeTarget(smokeTex);

  // The ocean. Resizing clears it (fine: it only happens when a monitor changes).
  layout.simPx = SIM_CSS * layout.dpr;
  layout.simW = Math.ceil(canvas.width / layout.simPx) + 2;
  layout.simH = Math.ceil(canvas.height / layout.simPx) + 2;
  waveOn = false;
  if (WAVES && canFloat) {
    for (let i = 0; i < 2; i++) {
      gl.bindTexture(gl.TEXTURE_2D, waveTex[i]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, layout.simW, layout.simH, 0,
                    gl.RGBA, gl.FLOAT, null);
      waveFbo[i] = makeTarget(waveTex[i]);
    }
    waveOn = !!(waveFbo[0] && waveFbo[1]);
  }
}

// ---------------------------------------------------------------------------
// Stones (clicks) and the cursor
// ---------------------------------------------------------------------------
const drops = [];          // waiting to go in on the next wave step: {x, y, r, a}
const mouse = { x: -9999, y: -9999, strength: 0, lastMove: -9999 };

// x, y in device px, screen coords (y down). Converted to sim texels, y up.
function dropStone(x, y, radius, amount) {
  drops.push({
    x: x / layout.simPx,
    y: (canvas.height - y) / layout.simPx,
    r: radius,
    a: amount,
  });
  while (drops.length > MAX_DROPS) drops.shift();
}

// Wallpaper Engine forwards desktop mouse events to the page as normal events.
// Site version: no click ripples (his call, 2026-11-09). Just the drifting smoke.
// Pause when the tab is hidden.
document.addEventListener("visibilitychange", () => { paused = document.hidden; });
window.addEventListener("mousemove", (e) => {
  mouse.x = e.clientX * layout.dpr;
  mouse.y = e.clientY * layout.dpr;
  mouse.lastMove = clock;
});

// ---------------------------------------------------------------------------
// Frame loop
// ---------------------------------------------------------------------------
let clock = 0;          // real seconds since start
let flow = 0;           // smoke time: speeds up / slows down with SETTINGS.speed
let paused = false;
let lastNow = performance.now();
let lastDrawn = 0;
let stepDebt = 0;       // wave steps owed (fixed-rate physics, whatever the fps)
const seed = [Math.random() * 200, Math.random() * 200];
const dropData = new Float32Array(MAX_DROPS * 4);

function waveStep() {
  dropData.fill(0);
  drops.forEach((d, i) => dropData.set([d.x, d.y, d.r, d.a], i * 4));
  drops.length = 0;

  const write = 1 - waveRead;
  gl.bindFramebuffer(gl.FRAMEBUFFER, waveFbo[write]);
  gl.viewport(0, 0, layout.simW, layout.simH);
  gl.useProgram(waveProg.p);
  const u = waveProg.u;
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, waveTex[waveRead]);
  gl.uniform1i(u.uState, 0);
  gl.uniform2f(u.uSimRes, layout.simW, layout.simH);
  // waveFade 0..1 -> loses 0.6% .. 0.04% of its energy per step
  gl.uniform1f(u.uDamp, 1 - (0.006 - 0.0056 * SETTINGS.waveFade));
  gl.uniform4fv(u.uDrops, dropData);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  waveRead = write;
}

function render() {
  // Smoke field into the small per-cell texture.
  gl.bindFramebuffer(gl.FRAMEBUFFER, smokeFbo);
  gl.viewport(0, 0, layout.gridW, layout.gridH);
  gl.useProgram(smokeProg.p);
  let u = smokeProg.u;
  gl.uniform2f(u.uGrid, layout.gridW, layout.gridH);
  gl.uniform2f(u.uCellCss, layout.cellW / layout.dpr, layout.cellH / layout.dpr);
  gl.uniform1f(u.uTime, flow);
  gl.uniform1f(u.uAmount, SETTINGS.smoke);
  gl.uniform2f(u.uSeed, seed[0], seed[1]);
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  // Characters onto the screen.
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.useProgram(glyphProg.p);
  u = glyphProg.u;
  gl.uniform2f(u.uRes, canvas.width, canvas.height);
  gl.uniform2f(u.uCell, layout.cellW, layout.cellH);
  gl.uniform2f(u.uGrid, layout.gridW, layout.gridH);
  gl.uniform1f(u.uScale, layout.dpr);
  gl.uniform1f(u.uTime, flow);
  gl.uniform1f(u.uGlyphs, layout.glyphs);
  gl.uniform2f(u.uSimRes, layout.simW, layout.simH);
  gl.uniform1f(u.uSimPx, layout.simPx);
  gl.uniform1f(u.uWaveOn, waveOn ? 1 : 0);
  gl.uniform1f(u.uWaveGain, SETTINGS.waveStrength);
  gl.uniform1f(u.uDim, SETTINGS.dimText);
  gl.uniform3fv(u.uBg, SETTINGS.background);
  gl.uniform3fv(u.uFg, SETTINGS.glyph);
  gl.uniform3fv(u.uAccent, SETTINGS.wave);
  gl.uniform3f(u.uMouse, mouse.x, mouse.y, SETTINGS.cursorGlow ? mouse.strength : 0);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, smokeTex);
  gl.uniform1i(u.uSmoke, 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, atlasTex);
  gl.uniform1i(u.uAtlas, 1);
  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, waveTex[waveRead]);
  gl.uniform1i(u.uWave, 2);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function frame(now) {
  requestAnimationFrame(frame);
  if (paused) { lastNow = now; return; }
  if (SETTINGS.fps > 0 && now - lastDrawn < 1000 / SETTINGS.fps - 1) return;
  lastDrawn = now;

  const dt = Math.min(0.1, (now - lastNow) / 1000);   // clamp: no huge jump after a pause
  lastNow = now;
  flow = (flow + dt * SETTINGS.speed) % 50000;         // keeps float precision healthy

  clock += dt;

  // Cursor glow fades in while the mouse moves, fades out ~2s after it stops.
  const target = clock - mouse.lastMove < 1.5 ? 1 : 0;
  mouse.strength += (target - mouse.strength) * Math.min(1, dt * (target ? 6 : 1.2));

  if (waveOn) {
    stepDebt += dt * STEPS_PER_SEC * SETTINGS.waveSpeed;
    let n = Math.min(16, Math.floor(stepDebt));
    stepDebt -= Math.floor(stepDebt);
    while (n-- > 0) waveStep();
  }
  drops.length = 0;   // anything not stepped this frame is dropped, not queued forever
  render();
}

// ---------------------------------------------------------------------------
// Wallpaper Engine hooks
// ---------------------------------------------------------------------------
function parseColor(v) {   // Wallpaper Engine sends colors as "0.1 0.2 0.3"
  return String(v).split(" ").map(Number).slice(0, 3);
}

window.wallpaperPropertyListener = {
  applyUserProperties(props) {
    let rebuild = false;
    if (props.backgroundcolor) {
      SETTINGS.background = parseColor(props.backgroundcolor.value);
      const c = SETTINGS.background.map((x) => Math.round(x * 255));
      document.body.style.background = `rgb(${c.join(",")})`;
    }
    if (props.glyphcolor)   SETTINGS.glyph = parseColor(props.glyphcolor.value);
    if (props.wavecolor)    SETTINGS.wave  = parseColor(props.wavecolor.value);
    if (props.speed)        SETTINGS.speed = props.speed.value;
    if (props.smoke)        SETTINGS.smoke = props.smoke.value / 100;
    if (props.dimtext)      SETTINGS.dimText = props.dimtext.value / 100;
    if (props.wavespeed)    SETTINGS.waveSpeed = props.wavespeed.value;
    if (props.wavefade)     SETTINGS.waveFade = props.wavefade.value / 100;
    if (props.wavestrength) SETTINGS.waveStrength = props.wavestrength.value;
    if (props.cursorglow)   SETTINGS.cursorGlow = props.cursorglow.value;
    if (props.charsize)   { SETTINGS.charSize = props.charsize.value; rebuild = true; }
    if (props.chars && props.chars.value) { SETTINGS.chars = props.chars.value; rebuild = true; }
    if (rebuild) resize();
  },
  applyGeneralProperties(props) {
    if (props.fps) SETTINGS.fps = props.fps;
  },
};

// Wallpaper Engine calls this when a fullscreen game takes focus.
window.wallpaperPerformancePausing = function (isPaused) { paused = isPaused; };

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
window.addEventListener("resize", resize);
resize();
// Rebuild the letter strip once the web font arrives, so the glyphs use it.
if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize);
if (matchMedia("(prefers-reduced-motion: reduce)").matches) SETTINGS.speed = 0.15;

render();
requestAnimationFrame(frame);
})();
