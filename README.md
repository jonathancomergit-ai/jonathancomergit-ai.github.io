# Jonjoe1001 — personal site

Hand-written HTML and CSS. No build step, no dependencies, no framework.
Double-click `index.html` to see it. That is also exactly what the server does.

---

## The files

```
site/
├── index.html            Home — hero, featured game, selected work, latest posts
├── projects.html         Every project, with working filter chips
├── blog.html             The list of dev posts
├── about.html            About me  ← rewrite this in your own voice
├── posts/
│   ├── _TEMPLATE.html    Copy this to write a new post. Never edit it directly.
│   └── 2026-09-09-hello-world.html
├── assets/
│   ├── css/site.css      The entire design system. One file.
│   ├── js/site.js        Mobile menu + project filter. ~80 lines.
│   └── img/              Screenshots, the Timeless logo, the favicon
├── .nojekyll             Tells GitHub Pages to serve the files as-is
└── README.md             This file
```

---

## Writing a new dev post

Four steps, about two minutes of overhead:

1. **Copy the template.**
   `posts/_TEMPLATE.html` → `posts/2026-10-04-boss-rework.html`
   Name it `YYYY-MM-DD-short-slug.html` so the folder sorts itself by date.

2. **Search the new file for the word `CHANGE`.** There are five of them —
   the tab title, the description (twice), the headline, and the date line.
   Fix each one.

3. **Write the post** between the `THE POST STARTS HERE` comment and the
   `END` comment. The template has a working example of every piece you get:
   headings, lists, code blocks, pull quotes, images with captions, links.
   Delete whatever you do not use.

4. **Add it to the list.** Open `blog.html`, copy one `<article class="post-row">`
   block, paste it at the **top** of the `.posts` list, and update the date,
   title, link and one-line blurb. If you want it on the home page too, do the
   same in the `Latest posts` section of `index.html`.

### Adding an image to a post

Drop the file in `assets/img/`, then reference it with `../` in front, because
posts live one folder down:

```html
<figure>
  <img src="../assets/img/my-screenshot.png" alt="Describe what is in it">
  <figcaption>A caption.</figcaption>
</figure>
```

The `alt` text is not optional filler — it is what screen readers announce and
what shows if the image fails to load. One short sentence.

---

## Adding a project

Open `projects.html` and copy any `<article class="card">` block.

The two attributes that matter:

- `id="my-project"` — lets you link straight to it: `projects.html#my-project`
- `data-tags="game sim"` — which filter chips will show it

The filter chips at the top of the page have `data-filter="game"` and so on.
A card appears under a chip if that chip's word is in the card's `data-tags`.
To add a whole new filter, add a chip button and put the matching word on the
cards. **No JavaScript changes needed.**

### Cards without a screenshot

Use the placeholder art instead of leaving a hole:

```html
<div class="card-art is-blank" style="--blank-glow: rgba(53,214,245,.24)">
  <span class="initials" aria-hidden="true">AB</span>
</div>
```

Change the rgba colour to re-tint the glow, and the letters to whatever fits.

---

## Changing the look

Everything lives in the `:root` block at the top of `assets/css/site.css`.
Change a value there and it updates on every page at once.

| Variable   | What it controls                          | Now       |
|------------|-------------------------------------------|-----------|
| `--bg`     | Page background                           | `#07070C` |
| `--surface`| Cards and panels                          | `#11121C` |
| `--hot`    | Primary accent — buttons, active nav      | `#FF2D78` |
| `--cyan`   | Links, secondary accent                   | `#35D6F5` |
| `--amber`  | "Released" tags, highlights               | `#FFC93C` |
| `--text`   | Body text                                 | `#ECEEF6` |

The pink, cyan and amber are sampled from the Timeless title art, which is why
the site and the game look related.

**The background effects** — grid, colour blooms, scanlines — are the `.backdrop`
rules further down. The scanlines are at `.017` alpha, which is nearly invisible
on purpose. Turn it up if you want more CRT.

### Motion and effects

All the animation is in `assets/js/site.js` (numbered sections, each with
its settings at the top) plus a matching block in `site.css`:

| Effect | Where | Tweak |
|---|---|---|
| Headlines decode from ASCII | js section 4 | `DECODE_SPREAD` = how long it takes |
| Things fade up as you scroll | js section 5, css SCROLL REVEAL | the `REVEAL` list says what fades |
| Reading bar on posts | js section 6, css READING PROGRESS | colours are the gradient in the css |
| Cards tilt toward the mouse | js section 7, css TILTING CARDS | `TILT_MAX` degrees |
| Pictures glitch on hover | js section 8, css GLITCH ON HOVER | the `@keyframes glitch` timing |
| Living ASCII portrait (About) | js section 9 | `PORTRAIT` block: lens size, zoom, sweep |
| Brain wiring from the photo into the headline, plus the nerve down to the big three (Home) | js section 10, css BRAIN WIRING | `BRAIN` block: neurons, letters, signal speed, `downChance` |
| Page crossfades | css PAGE TRANSITIONS | `animation-duration` |

Anyone whose device is set to **reduce motion** gets none of it except the
reading bar. The page transitions and the portrait only work on the live site
(or a local server), not when a file is double-clicked open - browsers lock
those features down for pages opened straight from disk.

---

## Publishing to GitHub Pages

One-time setup:

1. Create a new repo on GitHub named `jonathancomergit-ai.github.io`
2. From inside this `Website/` folder:

```bash
git init
git add .
git commit -m "First version of the site"
git branch -M main
git remote add origin https://github.com/jonathancomergit-ai/jonathancomergit-ai.github.io.git
git push -u origin main
```

3. On GitHub: **Settings → Pages → Source: Deploy from a branch → main → / (root)**

Live at `https://jonjoe1001.dev` in about a minute. The old
`jonathancomergit-ai.github.io` address still works and redirects here.

After that, publishing an update is three commands:

```bash
git add .
git commit -m "New post about the boss rework"
git push
```

The live site updates roughly 30 seconds later.

### After adding a post

Run `python tools/build_sitemap.py` and commit the regenerated `sitemap.xml`.
It walks the folder rather than reading a hand-typed list, so it cannot drift
out of date — but it only runs when you run it. Google reads that file to find
new pages, and `robots.txt` points at it.

Two house rules worth keeping:

- **Screenshot captions are a short title only** (`<b>The floor map</b>`), never
  a sentence. The explanation belongs in the image's `alt` text, which is what
  screen readers announce and what shows if the picture fails to load.
- **Images need `width` and `height` attributes.** Without them the page reflows
  as each picture loads and the text jumps under the reader's cursor.

### The custom domain

`jonjoe1001.dev`, registered at Cloudflare, wired up 2026-09-09. The `CNAME`
file in this folder is what tells Pages the domain is ours — deleting it drops
the site back to the github.io address.

DNS at Cloudflare, all records set to **DNS only** (grey cloud):

```
A     @    185.199.108.153      AAAA  @  2606:50c0:8000::153
A     @    185.199.109.153      AAAA  @  2606:50c0:8001::153
A     @    185.199.110.153      AAAA  @  2606:50c0:8002::153
A     @    185.199.111.153      AAAA  @  2606:50c0:8003::153
CNAME www  jonathancomergit-ai.github.io
```

Two things that will bite whoever changes this:

- **Leave the cloud grey.** If Cloudflare's proxy is switched on, GitHub can no
  longer validate the domain and the TLS certificate eventually lapses. If it
  is ever turned on deliberately, set SSL/TLS to **Full (strict)** first or the
  site redirect-loops.
- **`.dev` is HSTS-preloaded**, so browsers refuse plain HTTP outright. There is
  no "proceed anyway" screen. While a certificate is being issued the site looks
  hard-down rather than insecure; that is normal and clears itself.

Most links on the site are relative and moved for free, but the social meta tags
(`og:url`, `og:image`, `twitter:image`) are absolute by necessity — scrapers
require it. That is 3 per page. Change the domain again and they all need
rewriting, or link previews keep pulling from the old address.

---

## Serving it from the NAS (later)

The plan, for when you want it:

1. On TrueNAS, run an nginx container with this folder mounted as its web root
2. Install `cloudflared` and create a tunnel pointing at that container
3. Route your domain through the tunnel in the Cloudflare dashboard

No port forwarding, no exposed home IP, free TLS. The GitHub copy stays as the
backup and the always-up mirror.
