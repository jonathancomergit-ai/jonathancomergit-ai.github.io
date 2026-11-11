// MindFlight's interceptor, running in the browser.
//
// This is a line-for-line JavaScript copy of the parts of MindFlight (github.com/jonathancomergit-ai/MindFlight) that
// the trained interceptor brain flies in: the drone physics (physics/dynamics.py, motors.py, aero.py), the onboard
// attitude controller (physics/controller.py), the noisy sensors (envs/sensing.py), and the thrown-ball task with its
// camera tracker (envs/intercept.py). The brain is the real trained network (policies/intercept.pt), unchanged.
//
// Every constant comes from assets/play/intercept_brain.json, which tools/port_check/export_brain.py reads out of
// MindFlight's own code. tools/port_check/check_port.py replays a real Python flight through this file and compares
// every step. One drone, plain numbers, no libraries.
//
// Frames and units are MindFlight's: metres, seconds, z up, quaternions (w, x, y, z) body -> world.

const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm3 = (a) => Math.hypot(a[0], a[1], a[2]);

function qmul(a, b) {                       // Hamilton product a ⊗ b
  return [
    a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
    a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
    a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
    a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
  ];
}
function qnormalize(q) {
  const n = Math.max(Math.hypot(q[0], q[1], q[2], q[3]), 1e-12);
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
}
function qrot(q, v) {                       // body -> world: v + 2w(u × v) + 2u × (u × v)
  const u = [q[1], q[2], q[3]], uv = cross(u, v), uuv = cross(u, uv);
  return [v[0] + 2 * (q[0] * uv[0] + uuv[0]), v[1] + 2 * (q[0] * uv[1] + uuv[1]), v[2] + 2 * (q[0] * uv[2] + uuv[2])];
}
const qrotInv = (q, v) => qrot([q[0], -q[1], -q[2], -q[3]], v);
function qAxisAngle(axis, angle) {
  const n = Math.max(norm3(axis), 1e-12), s = Math.sin(angle / 2);
  return [Math.cos(angle / 2), (s * axis[0]) / n, (s * axis[1]) / n, (s * axis[2]) / n];
}

/* ---------- the brain: obs (37) -> action (4). Linear + ELU layers, exactly as trained. ---------- */
export class Brain {
  constructor(meta, buffer) {
    const f = new Float32Array(buffer);
    let o = 0;
    const take = (n) => { const a = f.subarray(o, o + n); o += n; return a; };
    const nObs = meta.layers[0][0];
    this.mean = take(nObs);
    const variance = take(nObs);
    this.scale = Float64Array.from(variance, (v) => 1 / Math.sqrt(v + 1e-8));
    this.clip = meta.obs_clip;
    this.layers = meta.layers.map(([nin, nout]) => ({ nin, nout, w: take(nin * nout), b: take(nout), y: new Float64Array(nout) }));
    this.x = new Float64Array(nObs);
    this.weights = meta.weights;
    if (o !== f.length) throw new Error("brain file does not match its description");
  }
  act(obs) {
    let x = this.x;
    for (let i = 0; i < x.length; i++) x[i] = clamp((obs[i] - this.mean[i]) * this.scale[i], -this.clip, this.clip);
    const last = this.layers.length - 1;
    this.layers.forEach((L, li) => {
      const { nin, nout, w, b, y } = L;
      for (let j = 0, r = 0; j < nout; j++, r += nin) {
        let s = b[j];
        for (let i = 0; i < nin; i++) s += w[r + i] * x[i];
        y[j] = li === last || s > 0 ? s : Math.expm1(s);      // ELU on the hidden layers
      }
      x = y;
    });
    return x;
  }
}

/* ---------- the ball: gravity + quadratic air drag, Heun's method (intercept.py: ball_step) ---------- */
export function ballStep(pos, vel, dt, k, g) {
  const s1 = norm3(vel);
  const a1 = [-k * s1 * vel[0], -k * s1 * vel[1], -k * s1 * vel[2] - g];
  const v2 = [vel[0] + a1[0] * dt, vel[1] + a1[1] * dt, vel[2] + a1[2] * dt], s2 = norm3(v2);
  const a2 = [-k * s2 * v2[0], -k * s2 * v2[1], -k * s2 * v2[2] - g];
  for (let c = 0; c < 3; c++) {
    const a = 0.5 * (a1[c] + a2[c]);
    pos[c] += vel[c] * dt + 0.5 * a * dt * dt;
    vel[c] += a * dt;
  }
}

/* Aim a throw (intercept.py: aim_throws + fly_for): the velocity that takes a ball from `release` to `target` in
   `flightS` seconds with drag, found by shooting 10 times. Returns {pos, vel, path}: the path is the ball's true
   flight, one point per 20 ms policy step, padded with where it ends. */
export function aimThrow(meta, release, target, flightS) {
  const dt = meta.physics_dt, k = meta.ball.drag_per_mass, g = meta.gravity, sub = meta.substeps;
  const steps = Math.round(flightS / dt), T = steps * dt;
  const vel = [(target[0] - release[0]) / T, (target[1] - release[1]) / T, (target[2] - release[2]) / T + 0.5 * g * T];
  for (let it = 0; it < 10; it++) {
    const p = release.slice(), v = vel.slice();
    for (let s = 0; s < steps; s++) ballStep(p, v, dt, k, g);
    for (let c = 0; c < 3; c++) vel[c] += (target[c] - p[c]) / T;
  }
  const P = meta.path_points, path = new Float64Array(P * 3);
  const p = release.slice(), v = vel.slice();
  path.set(p, 0);
  let n = 1;
  for (let s = 1; s <= steps; s++) {
    ballStep(p, v, dt, k, g);
    if (s % sub === 0 && n < P) path.set(p, 3 * n++);
  }
  for (; n < P; n++) path.set(p, 3 * n);
  return { pos: release.slice(), vel, path, flightS: T };
}

/* ---------- the env: one drone guarding one person (envs/base.py + envs/intercept.py) ---------- */
export class InterceptSim {
  /* options.standardDrone: true = the plain Crazyflie every time (no per-flight differences, no battery sag).
     false = "real-world drones" exactly as trained: each flight a slightly different drone. */
  constructor(meta, brain, options = {}) {
    this.meta = meta; this.brain = brain;
    this.rand = options.random || Math.random;
    this.standardDrone = options.standardDrone !== false;
    const P = meta.params;
    this.weight = P.mass_kg * meta.gravity;
    this.hoverRpm = Math.sqrt(this.weight / (4 * P.kf_n_per_rpm2));
    this.maxRpm = Math.sqrt((P.thrust_to_weight * this.weight) / (4 * P.kf_n_per_rpm2));
    this.maxThrust = Math.min(P.thrust_to_weight * this.weight, (4 * P.firmware_motor_thrust_max_n * P.thrust_command_max) / 65535);
    this.armXY = P.arm_m / Math.SQRT2;
    this.dtP = meta.policy_dt; this.dt = meta.physics_dt; this.sub = meta.substeps;
    const tau = meta.sensors.noise_correlation_s;
    this.errKeep = tau > 0 ? Math.exp(-this.dtP / tau) : 0;
    this.errKick = Math.sqrt(1 - this.errKeep * this.errKeep);
    this.NP = meta.path_points;
    this.obs = new Float64Array(meta.layers[0][0]);
    this.counts = { throws: 0, caught: 0, hits: 0, crashes: 0 };
    this.reset();
  }

  uniform(lo, hi) { return lo + (hi - lo) * this.rand(); }
  randn() {                                 // one standard normal draw (Box-Muller)
    let u = 0;
    while (u < 1e-12) u = this.rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * this.rand());
  }
  randn3() { return [this.randn(), this.randn(), this.randn()]; }

  /* A fresh flight (base.py: _reset_ids, intercept.py: _reset_task, sensing.py: reset). Counters are kept. */
  reset() {
    const m = this.meta, g = m.person.guard;
    this.p = [g[0] + this.uniform(-0.3, 0.3), g[1] + this.uniform(-0.3, 0.3), g[2] + this.uniform(-0.3, 0.3)];
    const tilt = qAxisAngle([this.randn(), this.randn(), 0], this.uniform(0, (10 * Math.PI) / 180));
    this.q = qmul(tilt, qAxisAngle([0, 0, 1], this.uniform(-Math.PI, Math.PI)));
    this.v = [this.uniform(-0.3, 0.3), this.uniform(-0.3, 0.3), this.uniform(-0.3, 0.3)];
    this.w = [this.uniform(-0.5, 0.5), this.uniform(-0.5, 0.5), this.uniform(-0.5, 0.5)];
    this.rpm = [this.hoverRpm, this.hoverRpm, this.hoverRpm, this.hoverRpm];
    this.integral = [0, 0, 0];
    this.action = [0, 0, 0, 0];
    this.stepCount = 0;
    // this flight's drone (base.py: _randomize_drones)
    const std = this.standardDrone;
    this.vary = {
      mass: std ? 1 : this.uniform(0.92, 1.08), thrust: std ? 1 : this.uniform(0.92, 1.08),
      tau: std ? 1 : this.uniform(0.7, 1.5), com: std ? [0, 0] : [this.uniform(-0.003, 0.003), this.uniform(-0.003, 0.003)],
      sag: std ? 0 : this.uniform(0, 0.006),
    };
    // sensors
    const s = m.sensors;
    this.gyroBias = [0, 1, 2].map(() => s.gyro_bias_radps * (2 * this.rand() - 1));
    this.posErr = this.randn3(); this.velErr = this.randn3(); this.attErr = this.randn3();
    this.obsDelay = s.obs_delay_steps[0] + Math.floor(this.rand() * (s.obs_delay_steps[1] - s.obs_delay_steps[0] + 1));
    this.actionDelay = s.action_delay_steps[0] + Math.floor(this.rand() * (s.action_delay_steps[1] - s.action_delay_steps[0] + 1));
    this.actionHist = Array.from({ length: s.action_delay_steps[1] + 1 }, () => [0, 0, 0, 0]);
    // ball + tracker
    this.bp = [0, 0, 0]; this.bv = [0, 0, 0];
    this.flying = false; this.wasFlying = false; this.ballAge = 0;
    this.path = new Float64Array(this.NP * 3);
    this.predPath = new Float64Array(this.NP * 3);
    this.posBias = [0, 0, 0]; this.velBias = [0, 0, 0];
    const td = m.tracker.delay_steps;
    this.trackerDelay = td[0] + Math.floor(this.rand() * (td[1] - td[0] + 1));
    this.ballHist = Array.from({ length: 3 }, () => [0, 0, 0, 0, 0, 0, 0]);   // newest first: pos, vel, flag
    this.pending = null;
    this.event = { kind: 0, pos: [0, 0, 0], step: -1e9 };
    this.tracker = { has: false, go: [0, 0, 0], timeLeft: 0, seen: 0, ball: [0, 0, 0] };
    this.crashed = false; this.crashReason = "";
    const fresh = this.observe();
    this.obsHist = Array.from({ length: s.obs_delay_steps[1] + 1 }, () => fresh.slice());
    this.obs.set(this.obsHist[this.obsDelay]);
  }

  /* Throw a ball (intercept.py: throw). `t` comes from aimThrow. It leaves the hand at the end of the next step. */
  throwBall(t) { this.pending = t; }

  // The three places fresh random numbers enter a step. check_port.py swaps these for the Python flight's own draws.
  advanceErrors() {
    const a = this.errKeep, k = this.errKick;
    for (const e of [this.posErr, this.velErr, this.attErr]) for (let c = 0; c < 3; c++) e[c] = a * e[c] + k * this.randn();
  }
  gyroNoise() { return this.randn3(); }
  trackerJitter() { return [this.randn(), this.randn(), this.randn(), this.randn(), this.randn(), this.randn()]; }
  throwBias() {
    const t = this.meta.tracker;
    return [this.randn3().map((x) => t.pos_bias * x), this.randn3().map((x) => t.vel_bias * x)];
  }

  /* One 2 ms physics step: the onboard controller, then the rigid body (controller.py + dynamics.py + aero.py). */
  substep(sp, thrustScale) {
    const P = this.meta.params, G = this.meta.gains, dt = this.dt, q = this.q, w = this.w, I = this.integral;
    const [qw, qx, qy, qz] = q;
    // controller: angle loop -> rate loop -> torque -> motor mix
    const roll = Math.atan2(2 * (qw * qx + qy * qz), 1 - 2 * (qx * qx + qy * qy));
    const pitch = Math.asin(clamp(2 * (qw * qy - qz * qx), -1, 1));
    const e = [G.angle_gain * (sp[1] - roll) - w[0], G.angle_gain * (sp[2] - pitch) - w[1], sp[3] - w[2]];
    for (let c = 0; c < 3; c++) I[c] = clamp(I[c] + e[c] * dt, -G.integral_limit, G.integral_limit);
    const tqx = P.ixx_kgm2 * (G.rate_gain_xy * e[0] + G.rate_i_gain_xy * I[0]);
    const tqy = P.iyy_kgm2 * (G.rate_gain_xy * e[1] + G.rate_i_gain_xy * I[1]);
    const tqz = P.izz_kgm2 * (G.rate_gain_z * e[2] + G.rate_i_gain_z * I[2]);
    const d = this.armXY, kf = P.kf_n_per_rpm2, km = P.km_nm_per_rpm2;
    const quarter = sp[0] / 4, mr = tqx / (4 * d), mp = tqy / (4 * d), my = tqz / (4 * (km / kf));
    const want = [quarter - mr - mp - my, quarter - mr + mp + my, quarter + mr + mp - my, quarter + mr - mp + my];
    const maxF = kf * this.maxRpm * this.maxRpm;
    // motors: first-order lag toward the command
    const closed = 1 - Math.exp(-dt / (P.motor_time_constant_s * this.vary.tau));
    const rpm = this.rpm, F = [0, 0, 0, 0];
    let spin = 0;
    for (let i = 0; i < 4; i++) {
      const cmd = clamp(Math.sqrt(clamp(want[i], 0, maxF) / kf), 0, this.maxRpm);
      rpm[i] = clamp(rpm[i] + (cmd - rpm[i]) * closed, 0, this.maxRpm);
      F[i] = kf * rpm[i] * rpm[i];
      spin += rpm[i];
    }
    // force and torque from the props, then this drone's differences
    let thrust = (F[0] + F[1] + F[2] + F[3]) * thrustScale;
    let tx = d * (-F[0] - F[1] + F[2] + F[3]) * thrustScale;
    let ty = d * (-F[0] + F[1] + F[2] - F[3]) * thrustScale;
    const tz = (km / kf) * (-F[0] + F[1] - F[2] + F[3]) * thrustScale;
    tx += -this.vary.com[1] * thrust;
    ty += this.vary.com[0] * thrust;
    const mass = P.mass_kg * this.vary.mass;
    const In = [P.ixx_kgm2 * this.vary.mass, P.iyy_kgm2 * this.vary.mass, P.izz_kgm2 * this.vary.mass];
    const f = qrot(q, [0, 0, thrust]);
    // rotor drag: -(sum of prop speeds) * k * (velocity in the body frame)
    const vb = qrotInv(q, this.v), radps = spin * ((2 * Math.PI) / 60);
    const drag = qrot(q, [-radps * P.drag_coeff_xy * vb[0], -radps * P.drag_coeff_xy * vb[1], -radps * P.drag_coeff_z * vb[2]]);
    // ground effect: extra thrust close to the floor
    const h = Math.max(this.p[2], this.meta.ground_effect_clip_m);
    const ratio = P.prop_radius_m / (4 * h);
    const extra = 1 - 2 * (qx * qx + qy * qy) > 0 ? thrust * P.ground_effect_coeff * ratio * ratio : 0;
    const ge = qrot(q, [0, 0, extra]);
    const acc = [(f[0] + drag[0] + ge[0]) / mass, (f[1] + drag[1] + ge[1]) / mass, (f[2] + drag[2] + ge[2]) / mass - this.meta.gravity];
    // orientation + spin: RK4 with the torque held over the step
    const tq = [tx, ty, tz];
    const rates = (qq, ww) => {
      const qd = qmul(qq, [0, ww[0], ww[1], ww[2]]);
      const gy = cross(ww, [In[0] * ww[0], In[1] * ww[1], In[2] * ww[2]]);
      return [[0.5 * qd[0], 0.5 * qd[1], 0.5 * qd[2], 0.5 * qd[3]], [(tq[0] - gy[0]) / In[0], (tq[1] - gy[1]) / In[1], (tq[2] - gy[2]) / In[2]]];
    };
    const ahead = (base, k, s) => base.map((b, i) => b + s * k[i]);
    const [q1, w1] = rates(q, w);
    const [q2, w2] = rates(ahead(q, q1, 0.5 * dt), ahead(w, w1, 0.5 * dt));
    const [q3, w3] = rates(ahead(q, q2, 0.5 * dt), ahead(w, w2, 0.5 * dt));
    const [q4, w4] = rates(ahead(q, q3, dt), ahead(w, w3, dt));
    this.q = qnormalize(q.map((b, i) => b + (dt / 6) * (q1[i] + 2 * q2[i] + 2 * q3[i] + q4[i])));
    this.w = w.map((b, i) => b + (dt / 6) * (w1[i] + 2 * w2[i] + 2 * w3[i] + w4[i]));
    // position + velocity: exact for a constant acceleration
    for (let c = 0; c < 3; c++) {
      this.p[c] += this.v[c] * dt + 0.5 * acc[c] * dt * dt;
      this.v[c] += acc[c] * dt;
    }
    if (this.p[2] < 0) { this.p[2] = 0; this.v = [0, 0, 0]; }
  }

  distanceToBody(pt) {
    const m = this.meta.person;
    const side = Math.max(Math.hypot(pt[0], pt[1]) - m.radius, 0), above = Math.max(pt[2] - m.height, 0);
    return Math.hypot(side, above);
  }

  /* What the brain sees (base.py: observe, intercept.py: _task_obs), built from the drone's noisy estimate. */
  observe() {
    const m = this.meta, s = m.sensors, T = m.tracker;
    // the state estimate (sensing.py: estimate)
    const ep = this.p.map((x, c) => x + s.position_noise_m * this.posErr[c]);
    const ev = this.v.map((x, c) => x + s.velocity_noise_mps * this.velErr[c]);
    const gn = this.gyroNoise();
    const ew = this.w.map((x, c) => x + this.gyroBias[c] + s.gyro_noise_radps * gn[c]);
    const rv = this.attErr.map((x) => s.attitude_noise_rad * x);
    const [w, x, y, z] = qnormalize(qmul(this.q, qAxisAngle(rv, norm3(rv))));
    const o = new Float64Array(this.obs.length);
    o.set(ev, 0);
    o.set([1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y),
           2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x),
           2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)], 3);
    o.set(ew, 12);
    o.set(this.action, 15);
    // the tracker's reading of the ball: late, and a little wrong
    const reading = this.ballHist[this.trackerDelay], flag = reading[6];
    const jit = this.trackerJitter();
    const pe = [0, 1, 2].map((c) => this.posBias[c] + T.pos_jitter * jit[c]);
    const ve = [0, 1, 2].map((c) => this.velBias[c] + T.vel_jitter * jit[3 + c]);
    const seen = Math.max(this.ballAge - this.trackerDelay, 0);
    // its predicted path = the true path + the error a wrong start causes; then the nearest point the drone may go to
    const NP = this.NP, path = this.path, pred = this.predPath, dtP = this.dtP;
    const ok = new Uint8Array(NP);
    let near = false;
    for (let i = 0; i < NP; i++) {
      const t = Math.max(i - seen, 0) * dtP;
      for (let c = 0; c < 3; c++) pred[3 * i + c] = path[3 * i + c] + pe[c] + ve[c] * t;
      if (Math.hypot(pred[3 * i], pred[3 * i + 1]) < T.min_radius) near = true;
      ok[i] = !near && pred[3 * i + 2] >= T.min_height && pred[3 * i + 2] <= T.max_height ? 1 : 0;
    }
    let best = Infinity, bestAlong = 0;
    const go = [0, 0, 0];
    for (let j = seen; j < NP - 1; j++) {
      if (!(ok[j] && ok[j + 1])) continue;
      const a = [pred[3 * j], pred[3 * j + 1], pred[3 * j + 2]];
      const ab = [pred[3 * j + 3] - a[0], pred[3 * j + 4] - a[1], pred[3 * j + 5] - a[2]];
      const len2 = Math.max(ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2], 1e-9);
      const u = clamp(((ep[0] - a[0]) * ab[0] + (ep[1] - a[1]) * ab[1] + (ep[2] - a[2]) * ab[2]) / len2, 0, 1);
      const n = [a[0] + u * ab[0], a[1] + u * ab[1], a[2] + u * ab[2]];
      const dist = Math.hypot(ep[0] - n[0], ep[1] - n[1], ep[2] - n[2]);
      if (dist < best) { best = dist; bestAlong = j + u; go[0] = n[0]; go[1] = n[1]; go[2] = n[2]; }
    }
    const has = flag > 0 && Number.isFinite(best);
    const timeLeft = has ? (bestAlong - seen) * dtP : 0;
    this.tracker = { has, go: has ? go.slice() : [0, 0, 0], timeLeft, seen, flag,
                     ball: [reading[0] + pe[0], reading[1] + pe[1], reading[2] + pe[2]] };
    const g = m.person.guard, ch = m.person.chest;
    for (let c = 0; c < 3; c++) {
      o[19 + c] = (reading[c] + pe[c] - ep[c]) * flag;
      o[22 + c] = (reading[3 + c] + ve[c]) * flag;
      o[26 + c] = has ? go[c] - ep[c] : 0;
      o[30 + c] = g[c] - ep[c];
      o[33 + c] = ch[c] - ep[c];
    }
    o[25] = flag;
    o[29] = timeLeft;
    o[36] = this.distanceToBody(ep);
    return o;
  }

  /* One 20 ms policy step with the brain flying (base.py: step). Returns what happened: "", "caught", "hit", "crash". */
  step(action) {
    const m = this.meta, P = m.params;
    const a = Array.from(action || this.brain.act(this.obs), (x) => clamp(x, -1, 1));
    this.action = a;
    const thrustScale = this.vary.thrust * (1 - this.vary.sag * this.stepCount * this.dtP);   // the battery drains
    this.actionHist.unshift(a.slice()); this.actionHist.pop();
    const ap = this.actionHist[this.actionDelay];                                             // the radio may be late
    const sp = [clamp(this.weight * (1 + m.thrust_span * ap[0]), 0, this.maxThrust), m.max_tilt * ap[1], m.max_tilt * ap[2], m.max_yaw_rate * ap[3]];
    const start = this.p.slice();
    for (let k = 0; k < this.sub; k++) this.substep(sp, thrustScale);
    // fly the ball through the same 20 ms, checking every 2 ms (intercept.py: fly_ball_through_step)
    this.wasFlying = this.flying;
    let caught = false, hit = false;
    if (this.flying) {
      const kd = m.ball.drag_per_mass;
      for (let k = 1; k <= this.sub && this.flying; k++) {
        ballStep(this.bp, this.bv, this.dt, kd, m.gravity);
        const f = k / this.sub;
        const gap = Math.hypot(this.bp[0] - (start[0] + f * (this.p[0] - start[0])), this.bp[1] - (start[1] + f * (this.p[1] - start[1])),
                               this.bp[2] - (start[2] + f * (this.p[2] - start[2])));
        if (gap < m.touch) caught = true;
        else if (this.distanceToBody(this.bp) < m.ball.radius || this.bp[2] < m.ball.radius) hit = true;
        if (caught || hit) { this.flying = false; this.event = { kind: caught ? 1 : 2, pos: this.bp.slice(), step: this.stepCount + 1 }; }
      }
      if (this.flying && this.ballAge >= this.NP + 25) { this.flying = false; hit = true; }
      this.ballAge += 1;
    }
    this.advanceErrors();
    this.stepCount += 1;
    if (caught || hit) { this.counts.throws += 1; this.counts[caught ? "caught" : "hits"] += 1; }
    // crashes (intercept.py: _reward), judged on the true state
    const body = this.distanceToBody(this.p), upright = 1 - 2 * (this.q[1] * this.q[1] + this.q[2] * this.q[2]);
    const reason = body - m.drone_radius < m.person.safety ? "too close" : this.p[2] < 0.05 ? "floor" : this.p[2] > 3.5 ? "too high"
      : Math.hypot(this.p[0], this.p[1]) > m.arena_radius ? "flew off" : upright < 0 ? "flipped" : norm3(this.w) > 40 ? "spun out" : "";
    // the next ball leaves the hand (intercept.py: _post_step -> throw), and the tracker's history moves on
    if (this.pending && !this.flying && !reason) {
      const t = this.pending; this.pending = null;
      this.bp = t.pos.slice(); this.bv = t.vel.slice(); this.path.set(t.path);
      this.flying = true; this.ballAge = 0;
      [this.posBias, this.velBias] = this.throwBias(t);
    }
    this.ballHist.unshift([this.bp[0], this.bp[1], this.bp[2], this.bv[0], this.bv[1], this.bv[2], this.flying ? 1 : 0]);
    this.ballHist.pop();
    if (reason) {                                  // a crash ends the flight: count it and start a fresh one
      if (this.flying) this.counts.throws += 1;    // a ball in the air during a crash counts as not caught
      this.counts.crashes += 1;
      const pending = this.pending;
      this.reset();
      this.pending = pending;
      this.crashed = true; this.crashReason = reason;
      return "crash";
    }
    this.crashed = false;
    this.obsHist.unshift(this.observe()); this.obsHist.pop();
    this.obs.set(this.obsHist[this.obsDelay]);
    return caught ? "caught" : hit ? "hit" : "";
  }
}

export async function loadSim(base = "assets/play/", options = {}) {
  const [meta, buffer] = await Promise.all([
    fetch(base + "intercept_brain.json").then((r) => r.json()),
    fetch(base + "intercept_brain.bin").then((r) => r.arrayBuffer()),
  ]);
  const brain = new Brain(meta, buffer);
  return { meta, brain, sim: new InterceptSim(meta, brain, options) };
}
