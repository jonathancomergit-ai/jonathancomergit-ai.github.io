"""Stamp a version on the site's CSS and JS links so browsers fetch the new files.

Browsers keep old copies of site.css and the scripts for a long time. After the
2026-11 rebrand, returning visitors saw the new pages with the OLD colours for
that reason. A link like  assets/css/site.css?v=20261110  is a new address to the
browser, so it downloads the file again.

Run this after any change to assets/css/site.css or a file in assets/js/:

    python tools/bump_version.py            (uses today's date)
    python tools/bump_version.py 20261201b  (or name the version yourself)

It rewrites the links in every .html page and the one place site.js loads
glyphs.js. Safe to run twice.
"""
import datetime, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
VER = sys.argv[1] if len(sys.argv) > 1 else datetime.date.today().strftime("%Y%m%d")

LINK = re.compile(r'(assets/(?:css/[a-z]+\.css|js/[a-z]+\.js))(?:\?v=[0-9A-Za-z]+)?(")')
GLYPHS = re.compile(r'("js/glyphs\.js)(?:\?v=[0-9A-Za-z]+)?(")')

changed = 0
for page in sorted(ROOT.rglob("*.html")):
    # bytes in, bytes out: line endings stay exactly as they were
    text = page.read_bytes().decode("utf-8")
    new = LINK.sub(lambda m: f"{m.group(1)}?v={VER}{m.group(2)}", text)
    if new != text:
        page.write_bytes(new.encode("utf-8"))
        changed += 1

site_js = ROOT / "assets" / "js" / "site.js"
text = site_js.read_bytes().decode("utf-8")
new = GLYPHS.sub(lambda m: f"{m.group(1)}?v={VER}{m.group(2)}", text)
if new != text:
    site_js.write_bytes(new.encode("utf-8"))
    changed += 1

print(f"version {VER}: {changed} files updated")
