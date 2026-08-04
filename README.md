# Scandinavia Trip — Aug 8–25, 2026

Live, shareable version of the full timed itinerary: Copenhagen → Oslo → Geiranger → Ålesund → Bergen → Oslo → Stockholm.

**The page:** `index.html` — the entire trip, day by day, with start/end times, transit legs, priorities (★ must see / ○ worth it / ✕ skip), ticket links, and booking deadlines. Purple rows are purchased tickets (fixed times), blue rows are transit, cream rows are meals.

## Publish with GitHub Pages (one-time, ~2 minutes)

1. Create a new repository on github.com (e.g. `scandinavia-trip`), public.
2. Upload the files in this folder (`index.html`, `README.md`, `.nojekyll`) — either drag-and-drop via **Add file → Upload files**, or push with git (see below).
3. Go to **Settings → Pages → Source: Deploy from a branch → Branch: `main` / `(root)` → Save**.
4. Your shareable link appears within a minute: `https://<your-username>.github.io/scandinavia-trip/`

### Push via git instead (if you prefer the terminal)

```bash
cd <this folder>
git remote add origin https://github.com/<your-username>/scandinavia-trip.git
git push -u origin main
```

(The folder is already a git repo with an initial commit.)

## Updating the itinerary

- **Small edits:** open `index.html` on GitHub → pencil icon (Edit) → change → Commit. Pages redeploys automatically in ~1 minute.
- **Bigger changes:** ask Claude to regenerate `index.html` from the master schedule, then replace the file via **Add file → Upload files** (same name overwrites on commit).

## Privacy note

Exact apartment/Airbnb street addresses are deliberately **withheld** on this public page (replaced with neighborhoods) — a public itinerary that lists addresses and the dates they're empty is an unnecessary risk. The private Word/Google-Docs version keeps the full addresses. The page also carries a `noindex` tag to keep it out of search engines; the link still works for anyone you share it with.
