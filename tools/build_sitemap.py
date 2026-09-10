"""Generate sitemap.xml from the pages that actually exist.

Built by walking the folder rather than typed by hand, so adding a post and
re-running this cannot leave the sitemap out of date. Skips the 404, the post
template and /tools/, none of which are real pages.

lastmod comes from git's last commit date for each file, not the filesystem
mtime, which changes every time the repo is cloned.
"""
import pathlib, subprocess, datetime

ROOT = pathlib.Path(r"C:\Users\Jonat\Desktop\Website")
BASE = "https://jonjoe1001.dev"
SKIP = {"404.html", "posts/_TEMPLATE.html"}

# Home first, then the top-level sections, then the deeper pages.
PRIORITY = {
    "index.html": "1.0",
    "projects.html": "0.9",
    "blog.html": "0.8",
    "about.html": "0.8",
    "contact.html": "0.7",
}

def git_date(rel):
    try:
        out = subprocess.run(
            ["git", "log", "-1", "--format=%cs", "--", rel],
            cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
        return out or datetime.date.today().isoformat()
    except Exception:
        return datetime.date.today().isoformat()

pages = []
for p in sorted(ROOT.rglob("*.html")):
    rel = p.relative_to(ROOT).as_posix()
    if rel in SKIP or rel.startswith("tools/"):
        continue
    loc = f"{BASE}/" if rel == "index.html" else f"{BASE}/{rel}"
    pages.append((loc, git_date(rel), PRIORITY.get(rel, "0.6")))

lines = ['<?xml version="1.0" encoding="UTF-8"?>',
         '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
for loc, date, pri in pages:
    lines += ["  <url>", f"    <loc>{loc}</loc>",
              f"    <lastmod>{date}</lastmod>",
              f"    <priority>{pri}</priority>", "  </url>"]
lines.append("</urlset>")

(ROOT / "sitemap.xml").write_text("\n".join(lines) + "\n", encoding="utf-8")
for loc, date, pri in pages:
    print(f"  {pri}  {date}  {loc}")
print(f"\n{len(pages)} pages in sitemap.xml")
