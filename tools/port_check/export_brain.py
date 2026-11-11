"""Export MindFlight's trained interceptor brain for the Workbench page, plus a reference flight to check the
JavaScript copy of the sim against. Read-only: nothing in MindFlight is changed.

    <MindFlight>/.venv/Scripts/python tools/port_check/export_brain.py [seed]

Writes:
  assets/play/intercept_brain.bin    the policy's weights, float32 (obs scaling + the 4 actor layers)
  assets/play/intercept_brain.json   layer sizes + every physical constant the page needs, read from MindFlight's
                                     own code (so no number is retyped by hand)
  tools/port_check/trace.json        one real 15 s flight on the CPU, every 20 ms step, with every random number the
                                     env drew (not published; only used by check_port.py)
"""
import dataclasses
import json
import math
import pathlib
import sys

import torch

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
MF = ROOT.parent / "_Sims-and-AI" / "MindFlight"
sys.path.insert(0, str(MF))
import mindflight.envs.intercept as IC  # noqa: E402
from mindflight.envs import base as B  # noqa: E402
from mindflight.envs import make_env  # noqa: E402
from mindflight.envs.sensing import PROFILES  # noqa: E402
from mindflight.physics import aero  # noqa: E402
from mindflight.physics import controller as C  # noqa: E402
from mindflight.physics import dynamics as D  # noqa: E402
from mindflight.physics.params import GRAVITY_MPS2  # noqa: E402
from mindflight.rl.train import load_policy  # noqa: E402

OUT = ROOT / "assets" / "play"
OUT.mkdir(parents=True, exist_ok=True)
model, ck = load_policy(MF / "policies" / "intercept.pt", "cpu")
sd = model.state_dict()

# ---------- the brain ----------
parts = [sd["obs_norm.mean"], sd["obs_norm.var"]]
layers = []
for i in (0, 2, 4, 6):
    w, b = sd[f"actor.{i}.weight"], sd[f"actor.{i}.bias"]
    layers.append([int(w.shape[1]), int(w.shape[0])])
    parts += [w.reshape(-1), b]
flat = torch.cat([p.reshape(-1).float() for p in parts]).numpy().astype("<f4")
flat.tofile(OUT / "intercept_brain.bin")
n_weights = sum(a * b + b for a, b in layers)

env_kwargs = dict(ck.get("env_kwargs", {}))
TRAINED = {**env_kwargs, "difficulty": 1.0}
params = make_env("intercept", 1, device="cpu", seed=0, **TRAINED).params
lighthouse = PROFILES[env_kwargs.get("sensors", "ideal")]
meta = {
    "note": "MindFlight policies/intercept.pt (actor only) and the constants of its sim, exported by "
            "tools/port_check/export_brain.py. Do not edit by hand.",
    "layers": layers, "weights": n_weights, "obs_clip": float(model.obs_norm.clip),
    "trained_with": env_kwargs, "eval": {k: round(float(v), 4) for k, v in ck.get("eval", {}).items()},
    "params": {k: v for k, v in dataclasses.asdict(params).items() if isinstance(v, (int, float))},
    "gravity": GRAVITY_MPS2,
    "physics_dt": D.PHYSICS_DT_S, "substeps": B.SUBSTEPS, "policy_dt": B.POLICY_DT_S,
    "gains": dataclasses.asdict(C.GAINS), "thrust_span": C.THRUST_SPAN, "max_yaw_rate": C.MAX_YAW_RATE_RADPS,
    "max_tilt": math.radians(30.0),
    "ground_effect_clip_m": aero.ground_effect_clip_height_m(params),
    "sensors": dataclasses.asdict(lighthouse),
    "ball": {"drag_per_mass": IC.BALL_DRAG_PER_MASS, "radius": IC.BALL_RADIUS_M, "mass": IC.BALL_MASS_KG},
    "person": {"radius": IC.PERSON_RADIUS_M, "height": IC.PERSON_HEIGHT_M, "chest": list(IC.CHEST),
               "safety": IC.SAFETY_DISTANCE_M, "guard": list(IC.GUARD_POINT)},
    "drone_radius": IC.DRONE_RADIUS_M, "touch": IC.TOUCH_DISTANCE_M, "arena_radius": IC.ARENA_RADIUS_M,
    "throws": {"distance": list(IC.THROW_DISTANCE_M), "release_height": list(IC.RELEASE_HEIGHT_M),
               "torso_height": list(IC.TORSO_HEIGHT_M), "torso_sideways": IC.TORSO_SIDEWAYS_M,
               "arc_deg": IC.HARD_ARC_DEG, "flight_s": list(IC.HARD_FLIGHT_S), "gap_s": list(IC.THROW_GAP_S)},
    "path_points": IC.PATH_POINTS,
    "tracker": {"delay_steps": list(IC.TRACKER_DELAY_STEPS), "pos_bias": IC.TRACKER_POS_BIAS_M,
                "pos_jitter": IC.TRACKER_POS_JITTER_M, "vel_bias": IC.TRACKER_VEL_BIAS_MPS,
                "vel_jitter": IC.TRACKER_VEL_JITTER_MPS, "min_radius": IC.PATH_MIN_RADIUS_M,
                "min_height": IC.PATH_MIN_HEIGHT_M, "max_height": IC.PATH_MAX_HEIGHT_M},
}
json.dump(meta, open(OUT / "intercept_brain.json", "w"), indent=1)
print("brain:", layers, n_weights, "weights,", (OUT / "intercept_brain.bin").stat().st_size // 1024, "KB")


# ---------- a reference flight: the real env, one drone, on the CPU (the plain readable physics loop) ----------
def L(t):
    return [float(x) for x in t.reshape(-1).tolist()]


SEED = int(sys.argv[1]) if len(sys.argv) > 1 else 7
env = make_env("intercept", 1, device="cpu", seed=SEED, **TRAINED)
env.generator.manual_seed(SEED)
cap = {}
_est, _mb, _da, _obs = env.sensors.estimate, env.measured_ball, env.sensors.delay_action, env.observe


def spy_estimate(state):
    cap["est"] = _est(state).clone()
    return cap["est"]


def spy_measured():
    out = _mb()
    cap["mb"] = [o.clone() for o in out]
    return out


def spy_delay_action(action):
    cap["applied"] = _da(action).clone()
    return cap["applied"]


def spy_observe():
    cap["fresh"] = _obs().clone()
    return cap["fresh"]


env.sensors.estimate, env.measured_ball, env.sensors.delay_action, env.observe = (
    spy_estimate, spy_measured, spy_delay_action, spy_observe)

obs = env.reset()
v, s = env.variation, env.sensors


def gyro_noise():
    return L((cap["est"][:, D.OMEGA] - env.state[:, D.OMEGA] - s.gyro_bias) / lighthouse.gyro_noise_radps)


def snap():
    return {"state": L(env.state), "integral": L(env.controller_integral), "ball_pos": L(env.ball_pos),
            "ball_vel": L(env.ball_vel), "flying": bool(env.flying), "ball_age": int(env.ball_age),
            "pos_err": L(s.position_error), "vel_err": L(s.velocity_error), "att_err": L(s.attitude_error),
            "throws": float(env.throws), "intercepts": float(env.intercepts), "hits": float(env.hits),
            "event_kind": int(env.event_kind), "event_pos": L(env.event_pos),
            "est": L(cap["est"]), "gyro_noise": gyro_noise(),
            "mb_pos_err": L(cap["mb"][3]), "mb_vel_err": L(cap["mb"][4]), "fresh": L(cap["fresh"])}


trace = {"seed": SEED, "note": "MindFlight InterceptEnv, 1 drone, cpu, trained settings, difficulty 1",
         "variation": {"mass": L(v.mass_scale)[0], "fresh_thrust": L(env.fresh_thrust_scale)[0],
                       "tau": L(v.motor_tau_scale)[0], "com": L(v.com_offset_m), "sag": L(env.battery_sag_per_s)[0]},
         "gyro_bias": L(s.gyro_bias), "obs_delay": int(s.obs_delay), "action_delay": int(s.action_delay),
         "tracker_delay": int(env.delay), "next_throw": int(env.next_throw), "first_obs": L(obs),
         "start": snap(), "steps": []}
for k in range(env.max_steps - 1):          # stop one step before the time limit (the env resets itself there)
    with torch.no_grad():
        action = model.act(obs, deterministic=True)
    was_flying, age_before = bool(env.flying), int(env.ball_age)
    obs, reward, done, info = env.step(action)
    row = snap()
    row.update({"action": L(action), "applied": L(cap["applied"]), "thrust_scale": L(v.thrust_scale)[0],
                "obs": L(obs), "crashed": bool(env.crashed_now), "done": bool(done)})
    if bool(env.flying) and int(env.ball_age) == 0 and not (was_flying and age_before == 0):   # just thrown
        row["throw"] = {"pos": L(env.ball_pos), "vel": L(env.ball_vel), "path": env.path[0].tolist(),
                        "pos_bias": L(env.pos_bias), "vel_bias": L(env.vel_bias)}
    trace["steps"].append(row)
    if done:
        break

# ---------- a few aimed throws, to check the page's own aiming ----------
g = torch.Generator().manual_seed(3)
n = 6
release = torch.zeros(n, 3)
release[:, 0] = 6 + 4 * torch.rand(n, generator=g)
release[:, 2] = 1.3 + 0.7 * torch.rand(n, generator=g)
target = torch.zeros(n, 3)
target[:, 1] = -0.1 + 0.2 * torch.rand(n, generator=g)
target[:, 2] = 1.0 + 0.45 * torch.rand(n, generator=g)
flight = 0.8 + 0.6 * torch.rand(n, generator=g)
vel = IC.aim_throws(release, target, flight)
steps = (flight / IC.BALL_DT_S).round().long()
_, path = IC.fly_for(release, vel, steps, sample_every=B.SUBSTEPS)
padded = path[:, -1:].expand(n, IC.PATH_POINTS, 3).clone()
padded[:, : path.shape[1]] = path[:, : IC.PATH_POINTS]
trace["aim"] = [{"release": L(release[i]), "target": L(target[i]), "flight_s": float(flight[i]), "velocity": L(vel[i]),
                 "path": padded[i].tolist()} for i in range(n)]
name = "trace.json" if len(sys.argv) < 3 else sys.argv[2]
json.dump(trace, open(pathlib.Path(__file__).parent / name, "w"))
last = trace["steps"][-1]
print(f"trace: seed {SEED}, {len(trace['steps'])} steps, caught {last['intercepts']:.0f} of {last['throws']:.0f}, "
      f"crashed {any(r['crashed'] for r in trace['steps'])}")
