"""Generate feed.xml (RSS 2.0) for the dev log from the posts that actually exist.

Same idea as build_sitemap.py: walk posts/ rather than keep a hand-typed list,
so a new post can't be missed. Each post's title and summary come from
its own <head> (og:title and meta description), and its date from the
YYYY-MM-DD at the front of the filename.

Run it after adding a post, next to build_sitemap.py:
    python tools/build_feed.py
"""
import datetime
import html
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
BASE = "https://jonjoe1001.dev"
SKIP = {"_TEMPLATE.html"}


def meta(page, attr, key):
    m = re.search(r'<meta\s+%s="%s"\s+content="([^"]*)"' % (attr, re.escape(key)), page)
    return html.unescape(m.group(1)) if m else ""


def rfc822(date):
    # Noon UTC, so the day is right in every time zone a reader is likely in.
    d = datetime.datetime.combine(date, datetime.time(12), datetime.timezone.utc)
    return d.strftime("%a, %d %b %Y %H:%M:%S +0000")


posts = []
for p in sorted((ROOT / "posts").glob("*.html")):
    if p.name in SKIP:
        continue
    m = re.match(r"(\d{4}-\d{2}-\d{2})-", p.name)
    if not m:
        continue
    page = p.read_text(encoding="utf-8")
    post = {
        "date": datetime.date.fromisoformat(m.group(1)),
        "url": f"{BASE}/posts/{html.escape(p.name)}",
        "title": meta(page, "property", "og:title"),
        "summary": meta(page, "name", "description"),
    }
    # Stop rather than publish a feed item with a blank title or summary.
    missing = [k for k in ("title", "summary") if not post[k]]
    if missing:
        raise SystemExit(f"{p.name}: couldn't read its {' and '.join(missing)} - check the "
                         'og:title and meta description lines match the template exactly')
    posts.append(post)

posts.sort(key=lambda x: x["date"], reverse=True)
e = lambda s: html.escape(s, quote=False)

lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    "    <title>Jonjoe1001 - Dev Log</title>",
    f"    <link>{BASE}/blog.html</link>",
    f'    <atom:link href="{BASE}/feed.xml" rel="self" type="application/rss+xml"/>',
    "    <description>Progress reports, problems I got stuck on, and things I figured out"
    " while building games and tools.</description>",
    "    <language>en</language>",
]
# The newest post's date, not "now", so re-running with nothing new changes nothing.
if posts:
    lines.append(f"    <lastBuildDate>{rfc822(posts[0]['date'])}</lastBuildDate>")
for x in posts:
    lines += [
        "    <item>",
        f"      <title>{e(x['title'])}</title>",
        f"      <link>{x['url']}</link>",
        f'      <guid isPermaLink="true">{x["url"]}</guid>',
        f"      <pubDate>{rfc822(x['date'])}</pubDate>",
        f"      <description>{e(x['summary'])}</description>",
    ]
    lines.append("    </item>")
lines += ["  </channel>", "</rss>"]

# newline="\n" for the same reason as build_sitemap.py: stable LF endings on Windows.
(ROOT / "feed.xml").write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
for x in posts:
    print(f"  {x['date']}  {x['title']}")
print(f"\n{len(posts)} posts in feed.xml")
