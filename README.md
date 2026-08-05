# Scandinavia Trip — Aug 8–25, 2026

Live, shareable version of the full timed itinerary: Copenhagen → Oslo → Geiranger → Ålesund → Bergen → Oslo → Stockholm.

**The page:** `index.html` — the entire trip, day by day, with start/end times, transit legs, priorities (★ must see / ○ worth it / ✕ skip), ticket links, and booking deadlines. Purple rows are purchased tickets (fixed times), blue rows are transit, cream rows are meals. It opens with an interactive pre-trip checklist (tickets, gear, documents) that you can tick off and add to.

## Shared checklist sync (optional, ~5 minutes)

Out of the box the checklist saves to `localStorage` — it survives refreshes but is **per-browser, per-device**, and anyone you share the link with sees an empty copy. To make one shared list that syncs across every device and every person:

1. Open [script.google.com](https://script.google.com) → **New project**.
2. Paste in the whole of [`sync-backend.gs`](sync-backend.gs) (it contains its own step-by-step header comment).
3. **Deploy → New deployment → Web app**, *Execute as: Me*, *Who has access: Anyone*, then authorise.
4. Copy the resulting `.../exec` URL.
5. In `index.html`, set the constant near the top of the checklist script:
   ```js
   var SYNC_URL = 'https://script.google.com/macros/s/AKfy..../exec';
   ```
6. Commit and push. The status pill on the page turns green — **Synced**.

**How it behaves.** Merging is last-write-wins *per item*, so two people ticking different things never overwrite each other. Ticks made with no signal are queued and pushed on reconnect, and the pill reports `Offline — saved locally` / `Sync failed — saved locally` honestly rather than pretending. The page polls every 15s while visible, and on focus/reconnect.

**Security.** *Who has access: Anyone* means anyone holding the `/exec` URL can read and write the checklist, and that URL lives in the page's public JavaScript — so its exposure equals the page's. Fine for a family checklist; **don't put booking references, passport numbers or addresses into checklist items**. The script can only touch its own stored property, not the rest of your Google account. Revoke any time via **Deploy → Manage deployments → Archive**.

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
