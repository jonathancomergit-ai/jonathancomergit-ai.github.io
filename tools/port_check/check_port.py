"""Check the page's JavaScript copy of MindFlight (assets/js/mindflight-sim.js) against the real Python sim.

    1. <MindFlight>/.venv/Scripts/python tools/port_check/export_brain.py 7 trace_7.json     (repeat for more seeds)
    2. python tools/port_check/check_port.py [episodes]

It opens tools/port_check/check.html in a headless Edge and prints how far the JavaScript is from Python:
  - the brain alone (same observation in, same action out)
  - the page's own throw aiming
  - every 20 ms step, started from Python's state
  - a whole 15 s flight flown by the JavaScript on its own (sharing only the random numbers)
  - with [episodes]: the catch rate over that many fresh flights, to set beside MindFlight's 93.7 %
Exits with an error if anything is further off than float32 rounding explains.
With CDP_TOOLS set to a folder that holds cdp.py (a small headless-Edge driver) it runs by itself. Without it, it
serves the page and prints the address: open that in any browser and read the numbers there.
"""
import functools
import http.server
import json
import os
import pathlib
import socketserver
import sys
import threading

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent

episodes = int(sys.argv[1]) if len(sys.argv) > 1 else 0
traces = sorted(p.name for p in HERE.glob("trace*.json"))
if not traces:
    sys.exit("no trace*.json here: run export_brain.py first")


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


server = socketserver.ThreadingTCPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
url = f"http://127.0.0.1:{server.server_address[1]}/tools/port_check/check.html?traces={','.join(traces)}&episodes={episodes}"
if not os.environ.get("CDP_TOOLS"):
    print("Open this in a browser (Ctrl+C here when done):")
    print("  " + url)
    try:
        threading.Event().wait()
    except KeyboardInterrupt:
        sys.exit(0)
sys.path.insert(0, os.environ["CDP_TOOLS"])
from cdp import Browser  # noqa: E402

with Browser(size=(900, 700)) as b:
    b.goto(url, settle=1.0)
    b.ws.sock.settimeout(900)
    b.wait("window.RESULT !== undefined", 900, every=1.0)
    R = json.loads(b.js("JSON.stringify(window.RESULT)"))
    errors = [c for c in b.console if "rror" in str(c)]
server.shutdown()
if "error" in R:
    sys.exit("the check page failed:\n" + R["error"] + "\n" + "\n".join(map(str, errors)))

bad = []
print(f"brain: {R['weights']:,} weights")
for t in R["traces"]:
    print(f"\n{t['name']} (seed {t['seed']}, {t['steps']} steps)")
    print(f"  brain alone, worst action difference     {t['brain_action']:.2e}")
    print(f"  aiming, worst velocity / path difference {t['aim_velocity']:.2e} m/s / {t['aim_path']:.2e} m")
    s = t["step_by_step"]
    print("  one step at a time:  " + "  ".join(f"{k} {v:.1e}" for k, v in s.items()))
    w = t["whole_flight"]
    print("  whole flight:        " + "  ".join(f"{k} {v:.1e}" for k, v in w.items()))
    print(f"  caught / thrown:     JavaScript {t['counts']['js']}  Python {t['counts']['python']}")
    if t["brain_action"] > 1e-4: bad.append("brain")
    if t["aim_velocity"] > 1e-3 or t["aim_path"] > 1e-3: bad.append("aiming")
    if s["pos"] > 1e-5 or s["vel"] > 1e-3 or s["quat"] > 1e-4 or s["fresh_obs"] > 1e-2 or s["ball"] > 1e-3 or s["ball_state_mismatches"]:
        bad.append("one step")
    if w["pos"] > 0.02 or w["ball_state_mismatches"] > 2 or t["counts"]["js"] != [int(x) for x in t["counts"]["python"]]:
        bad.append("whole flight")
for key, label in (("as_trained", "as trained (real-world drones)"), ("standard_drone", "standard drone (what the page flies)")):
    if key in R:
        r = R[key]
        print(f"\n{label}: caught {r['caught']} of {r['throws']} = {100 * r['rate']:.1f} %, "
              f"{r['crashed_episodes']} of {r['episodes']} flights crashed")
print("\nFAILED: " + ", ".join(sorted(set(bad))) if bad else "\nOK: the JavaScript matches the Python sim.")
sys.exit(1 if bad else 0)
