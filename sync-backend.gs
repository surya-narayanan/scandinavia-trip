/**
 * Shared checklist backend for the Scandinavia 2026 itinerary page.
 *
 * WHAT IT DOES
 *   Stores the checklist state (which items are ticked, plus any items people
 *   added) so that every device and every person opening the itinerary link
 *   sees the same list. Merging is last-write-wins PER ITEM, by timestamp, so
 *   two people ticking different things at the same time never clobber each
 *   other.
 *
 * HOW TO DEPLOY  (about 5 minutes, all in your own Google account)
 *   1. Go to https://script.google.com  ->  New project
 *   2. Delete the sample code, paste this whole file in, and rename the
 *      project something like "scandi-checklist".
 *   3. Click Deploy  ->  New deployment.
 *        - Select type:  Web app
 *        - Description:  scandi checklist
 *        - Execute as:   Me
 *        - Who has access: Anyone            <-- required; see SECURITY below
 *   4. Click Deploy, then Authorize access and accept the Google prompt.
 *      (Google will warn that the app is unverified because you wrote it
 *      yourself. Choose Advanced -> Go to <project name>.)
 *   5. Copy the Web app URL. It looks like:
 *        https://script.google.com/macros/s/AKfy..../exec
 *   6. Paste it into index.html, in the checklist script near the top:
 *        var SYNC_URL = 'https://script.google.com/macros/s/AKfy..../exec';
 *      Commit and push. The status pill on the page turns green: "Synced".
 *
 *   To check it by hand, open the /exec URL in a browser tab. You should see
 *   JSON like {"ok":true,"ticks":{},"custom":[],"updated":0}.
 *
 * IF YOU EDIT THIS SCRIPT LATER
 *   Deploy -> Manage deployments -> edit (pencil) -> Version: New version.
 *   Re-deploying as a NEW deployment gives you a different URL.
 *
 * SECURITY — READ THIS
 *   "Anyone" means anyone holding the /exec URL can read and write the
 *   checklist. The URL sits in the public JavaScript of the itinerary page, so
 *   in practice its exposure is the same as the itinerary page itself: not
 *   indexed, but not secret. That is a deliberate trade for a family checklist
 *   with no personal data in it. Do NOT put passwords, booking references,
 *   passport numbers or addresses into checklist items. The script can only
 *   touch its own stored property — it has no access to the rest of your
 *   Google account, your Drive, or your mail.
 *   To revoke access at any time: Deploy -> Manage deployments -> Archive.
 */

var STORE_KEY = 'scandi2026_checklist_v1';

function doGet(e) {
  return json_(readState_());
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return json_({ ok: false, error: 'busy, try again' });
  }
  try {
    var body = {};
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }
    var state = readState_();

    // --- merge ticks: highest timestamp wins, per item id ---
    var inTicks = body.ticks || {};
    Object.keys(inTicks).forEach(function (k) {
      var inc = inTicks[k] || {};
      var cur = state.ticks[k];
      var incTs = Number(inc.ts) || 0;
      if (!cur || incTs >= (Number(cur.ts) || 0)) {
        state.ticks[k] = { done: !!inc.done, ts: incTs };
      }
    });

    // --- merge custom items (tombstones carry deleted:true) ---
    var byId = {};
    (state.custom || []).forEach(function (c) { byId[String(c.id)] = c; });
    (body.custom || []).forEach(function (c) {
      var id = String(c.id);
      var cur = byId[id];
      var incTs = Number(c.ts) || 0;
      if (!cur || incTs >= (Number(cur.ts) || 0)) {
        byId[id] = {
          id: id,
          text: String(c.text || '').slice(0, 300),
          ts: incTs,
          deleted: !!c.deleted
        };
      }
    });
    state.custom = Object.keys(byId).map(function (k) { return byId[k]; });

    state.updated = Date.now();
    writeState_(state);
    return json_(state);
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function readState_() {
  var raw = PropertiesService.getScriptProperties().getProperty(STORE_KEY);
  var s = { ok: true, ticks: {}, custom: [], updated: 0 };
  if (raw) {
    try {
      var p = JSON.parse(raw);
      s.ticks = p.ticks || {};
      s.custom = p.custom || [];
      s.updated = p.updated || 0;
    } catch (e) { /* corrupt value: fall back to empty state */ }
  }
  return s;
}

function writeState_(state) {
  PropertiesService.getScriptProperties().setProperty(
    STORE_KEY,
    JSON.stringify({ ticks: state.ticks, custom: state.custom, updated: state.updated })
  );
}

function json_(obj) {
  if (obj.ok === undefined) obj.ok = true;
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Wipe the shared list. Run this manually from the editor if you ever want a reset. */
function resetSharedChecklist() {
  PropertiesService.getScriptProperties().deleteProperty(STORE_KEY);
}
