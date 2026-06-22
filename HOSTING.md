# Hosting & performance plan

The atlas is a fully static site (HTML + ES modules + JSON/GeoJSON) — no
backend. That makes hosting cheap and simple, but the data files need the
right serving setup to stay fast.

## Runtime performance (done 2026-06-11, build 06-11.c)

- Layer data is lazy: nothing downloads until its layer is toggled on.
- Indigenous territories (the heaviest layer): back-hemisphere culling on the
  globe + re-pathing throttled to ~14fps during continuous motion; geometry
  thinned/quantized 4.4 MB → 2.1 MB (0.02° tolerance — well inside the
  source's own precision disclaimer).
- Historical borders: same ~14fps motion throttle.
- Arcs/particles keep full frame rate — they carry the motion language.
- If it still chokes on a weak machine: pause auto-rotate (▶ button) — a
  static globe renders only on interaction.

## When hosting later (in rough order of impact)

1. **Compression is non-negotiable.** GeoJSON/JSON compress 80–90%:
   migration.json 5.8 MB → ~700 KB. Any static host with Brotli/gzip
   (Cloudflare Pages, Netlify, GitHub Pages via CDN) does this automatically —
   verify with `curl -H 'Accept-Encoding: br' -sI <url> | grep content-encoding`.
2. **Long-cache data + hashed names.** Serve `data/*` with
   `Cache-Control: public, max-age=31536000, immutable` and put a content hash
   or version in the filename (`commodities.2026-06-11.json`) when data
   updates. This gives instant repeat visits AND permanently solves the
   stale-tab problem we fought today (dev uses `serve.py`'s no-store instead).
3. **Bundle + minify the JS** (esbuild: `esbuild js/app.js --bundle --minify
   --format=esm --outfile=dist/app.js`) — collapses ~30 module requests into
   one file; matters on high-latency connections.
4. **TopoJSON for the polygon layers** (territories, historical eras):
   shared borders encode once + delta-encoded integer coordinates — typically
   another 3–5× smaller than thinned GeoJSON; decode with the topojson-client
   already used for the basemap.
5. **Era files stay lazy** — do not preload all 22 historical sheets; the
   current per-era fetch + cache is the right pattern.
6. **Static hosts to consider:** Cloudflare Pages (best free CDN + Brotli),
   Netlify, GitHub Pages. No server code needed; the BACI/UNHCR rebuilds run
   locally via the pipeline and you deploy the regenerated `data/`.

## Not worth it (yet)

- Vector tiles / PMTiles for territories — only if the dataset grows ~10×.
- Canvas/WebGL rewrite of the polygon layers — the culling+throttle made SVG
  viable; revisit only if a layer with >10k polygons lands.
- Service worker offline caching — adds the stale-code failure mode back;
  hashed filenames give the same speed without the risk.
