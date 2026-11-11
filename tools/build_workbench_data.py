"""Build the data for the Workbench toys from the real projects (read-only; nothing in them is changed).

    python tools/build_workbench_data.py

Writes assets/play/:
  dream/*.jpg + dream/manifest.json   Dream World: dreamed frames only (never the real video), at the dream's own
                                      168 x 96 size, in sheets of 100 frames that the page loads as you walk
  minigpt.json                        MiniGPT: the 369M run's own writing samples and test scores at 41 points
                                      in training, plus its training loss

The drone toy's files (intercept_brain.bin / .json) are made by tools/port_check/export_brain.py, which needs
MindFlight's own Python.

No AI-drawn art anywhere: every number, frame and sentence comes out of the projects' own runs.
"""
import json
import os
import pathlib
import subprocess

import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
PROJ = ROOT.parent
OUT = ROOT / "assets" / "play"
(OUT / "dream").mkdir(parents=True, exist_ok=True)
for old in list((OUT / "dream").glob("*.jpg")) + [OUT / "intercept.json"]:      # files from the first draft
    if old.exists():
        old.unlink()

# ---- Dream World: dream-only walks, 40 s each at 10 fps ----
DW = PROJ / "_Sims-and-AI" / "DreamWorld"
FW, FH, COLS, PER, Q = 168, 96, 10, 100, 80
SKIP = 25          # the first 2.5 s still look like the real photo the dream started from, so they are never shown
# Walks picked by eye from the 20 in this file: the ones with no people-like shapes walking through them.
WALKS = {"river": 1, "shops": 2, "trees": 7}


def sheets(name, frames):
    """Save frames (a list of HxWx3 arrays or PIL images) as sheets of PER frames; return the file names."""
    names = []
    for s in range(0, len(frames), PER):
        part = frames[s:s + PER]
        rows = (len(part) + COLS - 1) // COLS
        sheet = Image.new("RGB", (FW * COLS, FH * rows))
        for i, f in enumerate(part):
            im = f if isinstance(f, Image.Image) else Image.fromarray(np.asarray(f))
            if im.size != (FW, FH):
                im = im.resize((FW, FH), Image.LANCZOS)
            sheet.paste(im.convert("RGB"), ((i % COLS) * FW, (i // COLS) * FH))
        fn = f"{name}_{s // PER}.jpg"
        sheet.save(OUT / "dream" / fn, quality=Q, optimize=True, progressive=True)
        names.append(fn)
    return names


dreams = np.load(DW / "train" / "_exp" / "v9" / "dreams" / "q_sprint2_3k_seed1234.npy", mmap_mode="r")
clips = {}
for name, walk in WALKS.items():
    frames = [dreams[walk, t] for t in range(SKIP, dreams.shape[1])]
    clips[name] = {"n": len(frames), "start_s": SKIP / 10, "sheets": sheets(name, frames),
                   "note": f"v9 test run, dream-only walk {walk}, frames {SKIP}-{dreams.shape[1] - 1}"}

# The fix: the same model and street, started the old way (pure static) and the new way (the last frame + static).
# Both halves of this clip are dreams. It is already on the site (assets/media/dream_fix.mp4).
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(ROOT / "assets" / "media" / "dream_fix.mp4"), "-f", "rawvideo",
                      "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
fx = np.frombuffer(raw, np.uint8).reshape(-1, 384, 1344, 3)
for name, x0 in (("fix_old", 0), ("fix_new", 672)):
    frames = [Image.fromarray(np.ascontiguousarray(fx[t, :, x0:x0 + 672])) for t in range(0, len(fx), 2)]
    clips[name] = {"n": len(frames), "start_s": 0, "sheets": sheets(name, frames),
                   "note": "site dream_fix.mp4, " + ("left: started from pure static" if x0 == 0 else "right: started from the last frame + static")}
json.dump({"fw": FW, "fh": FH, "cols": COLS, "per": PER, "fps": 10, "clips": clips},
          open(OUT / "dream" / "manifest.json", "w"), indent=1)
size = sum(p.stat().st_size for p in (OUT / "dream").glob("*.jpg"))
print(f"dream: {len(list((OUT / 'dream').glob('*.jpg')))} sheets, {size // 1024} KB in all, "
      f"first sheet {(OUT / 'dream' / clips['river']['sheets'][0]).stat().st_size // 1024} KB")

# ---- MiniGPT: real samples, test scores and loss across training ----
MG = PROJ / "_Sims-and-AI" / "MiniGPT" / "runs" / "friend350"
samples = [json.loads(line) for line in open(MG / "samples.jsonl", encoding="utf-8")]
metrics = [json.loads(line) for line in open(MG / "metrics.jsonl", encoding="utf-8")]
# Left out after reading all 205: dark themes (killing, suicide), one that reads like a child marriage, and one
# health claim. The page says some were left out.
LEFT_OUT = {("story", 9155), ("story", 18310), ("story", 22888), ("story", 32043), ("fact", 42724)}


def tidy(text):
    """One line; stop where the model ended its document; mark samples that were cut off by the length limit."""
    text = " ".join(text.split("<|bos|>")[0].split())
    return text if text[-1:] in ".!?\"”’)" else text + " …"


prompts = {}
for label in ("story", "fact", "explain", "science", "curious"):
    rows = sorted((s for s in samples if s["label"] == label and (label, s["step"]) not in LEFT_OUT), key=lambda s: s["step"])
    prompts[label] = {"prompt": rows[0]["prompt"], "steps": [{"step": s["step"], "text": tidy(s["text"])} for s in rows]}
evals = [{"step": m["step"], "tokens": m["tokens"], "val_loss": round(m["val_loss"], 3),
          "quiz": round(m["arc_easy"], 4), "last_word": round(m["lambada"], 4)} for m in metrics if "val_loss" in m]
# The training loss, thinned to ~400 points (every point early on, where it falls fastest).
train = [(m["step"], m["loss"]) for m in metrics if "loss" in m]
keep, last = [], -1.0
for step, loss in train:
    x = np.log10(step + 30)
    if x - last >= 0.0085:
        keep.append([step, round(loss, 3)])
        last = x
json.dump({"note": "MiniGPT 369M: the run's own samples (first ~60 tokens each), its test scores at "
                   "each save (ARC-Easy and LAMBADA) and its training loss. Five samples are left out.",
           "params": 369148928, "left_out": len(LEFT_OUT), "prompts": prompts, "evals": evals, "loss": keep},
          open(OUT / "minigpt.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("minigpt.json", os.path.getsize(OUT / "minigpt.json") // 1024, "KB,", len(evals), "saves,", len(keep), "loss points")
print("  first save:", evals[0], "\n  last save: ", evals[-1])
