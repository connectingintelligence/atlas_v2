# CFCT Atlas v2 — Delivery & Hosting Guide

**A Map of the Conditions** — Conditions for Collective Trauma (CFCT) Atlas, v2.
Prepared for The Pocket Project by Connecting Intelligence LLC.

This folder is the complete, self-contained atlas. Build stamp **06-29.d**.

---

## TL;DR for the tech team

- It is a **fully static website** — HTML + JavaScript (ES modules) + JSON/GeoJSON data.
- **No backend, no database, no build step, no Node, no server-side code.**
- **All libraries, fonts, and the world basemap are vendored locally** (`vendor/`). It needs **no internet access** to run.
- **One rule:** it must be **served over HTTP(S)**. Do **not** open `index.html` by double-clicking (a `file://` URL) — browsers block JS modules and data loading from local files, so the map will look blank.

---

## Option A — GitHub Pages (what you asked about) ✅

Yes — once unzipped, you can put this straight on GitHub Pages:

1. Create a repo and add the **contents** of this folder at the repo root
   (so `index.html` is at the top level), e.g.:
   ```
   git init
   git add .
   git commit -m "CFCT Atlas v2"
   git branch -M main
   git remote add origin https://github.com/<org>/<repo>.git
   git push -u origin main
   ```
2. On GitHub: **Settings → Pages → Build and deployment → Source: "Deploy from a
   branch"**, branch **main**, folder **/ (root)**. Save.
3. After a minute it's live at `https://<org>.github.io/<repo>/`.

Notes:
- GitHub Pages serves static files over HTTPS — exactly what the map needs. No
  extra config, no Jekyll processing required (a `.nojekyll` file is included so
  Pages serves every file as-is).
- Everything is vendored, so it works regardless of CDNs.
- It's a fairly large repo (~50 MB, mostly the historical-border GeoJSON) — fine
  for GitHub, just note the size.

## Option B — any other static host

Drop the folder on **Cloudflare Pages**, **Netlify**, or your own
**nginx/Apache** docroot with `index.html` as the entry point. Enable
**gzip/Brotli** on the `data/*` files for speed (Cloudflare/Netlify do this
automatically). Performance/caching detail is in `HOSTING.md`.

---

## Preview it locally before deploying

> Don't double-click `index.html` (blank page). Serve it:

**Easiest (macOS):** double-click **`Open Atlas (local preview).command`** — it
starts a local server and opens the atlas. (First time: right-click → Open to
clear the macOS "unidentified developer" prompt.)

**Any OS:** from this folder, `python3 -m http.server 8000`, then open
**http://127.0.0.1:8000/index.html**.

---

## What's in the folder

| Path | What it is |
|------|------------|
| `index.html` | The atlas — entry point. |
| `js/` | Application code (ES modules). |
| `data/` | All datasets the map loads (CFCT scores, country data, entanglement layers). |
| `methodology/` | One Markdown page per dataset — sources, caveats, citations. |
| `vendor/` | Bundled d3, topojson, marked, the 50m world basemap, and web fonts — why it runs offline. |
| `HOSTING.md` | Performance / compression / caching guidance. |
| `CHANGELOG.md` | Build history. |

The datasets are produced by a separate pipeline; when refreshed you receive new
files for `data/` and simply redeploy — there is no application rebuild.

*Static prototype. The CFCT composite is a proxy measure, documented per-dataset
in the methodology pages and the in-app methodology notes.*
