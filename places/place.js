/* ---------------------------------------------------------------------------
   Photos for the place pages.

   WHY IT WORKS THIS WAY: no image URL is written into these pages. Wikimedia
   thumbnail paths contain a hash segment that cannot be derived from a
   filename, so hardcoding them means guessing, and a guessed URL is a broken
   image. Instead the page asks the Wikimedia APIs for photos when a reader
   opens it, and renders whatever actually comes back — together with the
   author and licence the API reports, which is also what Commons attribution
   requires.

   Each page carries:
     data-commons-cat  optional Commons category  (most precise)
     data-wp           English Wikipedia article  (curated, very reliable)
     data-commons      Commons text search query  (last resort)

   The three are tried IN THAT ORDER and their results are merged, because a
   text search is the least trustworthy of them — it can return something only
   loosely related, or nothing at all. Images actually used on the Wikipedia
   article are a much better signal, so they rank above search.

   Both hosts send CORS headers (the Action API via origin=*), so this works
   from a github.io origin. If every tier fails the gallery collapses to a
   labelled link rather than a row of broken frames.
--------------------------------------------------------------------------- */
(function () {
  var MAX = 5;
  var PHOTO = /\.(jpe?g|png)$/i;

  /* Wikipedia articles carry chrome — icons, flags, maps, badges. None of it
     is a photograph of the place. */
  var JUNK = new RegExp([
    'commons-logo', 'wikipedia', 'wikimedia', 'wikisource', 'wikiquote', 'wikidata',
    'logo', 'icon', 'edit-', 'symbol', 'flag[_ ]of', 'coat[_ ]of[_ ]arms',
    'locator', 'blank', 'question', 'ambox', 'increase', 'decrease',
    'red[_ ]pog', 'folder', 'padlock', 'crystal', 'nuvola', 'emblem',
    'seal[_ ]of', 'disambig', '[_ ]map[_.]', '^File:Map'
  ].join('|'), 'i');

  function el(t, c) { var e = document.createElement(t); if (c) e.className = c; return e; }
  function plain(html) { var d = el('div'); d.innerHTML = html || ''; return (d.textContent || '').trim(); }

  function api(host, params) {
    params.action = 'query';
    params.format = 'json';
    params.origin = '*';
    params.prop = 'imageinfo';
    params.iiprop = 'url|extmetadata';
    params.iiurlwidth = '900';
    return fetch('https://' + host + '/w/api.php?' + new URLSearchParams(params).toString())
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        var p = j && j.query && j.query.pages;
        if (!p) return [];
        return Object.keys(p).map(function (k) { return p[k]; });
      })
      .catch(function () { return []; });   /* a failed tier must not kill the rest */
  }

  /* Tier 1 — an explicit Commons category. */
  function fromCategory(cat) {
    return api('commons.wikimedia.org', {
      generator: 'categorymembers', gcmtitle: cat, gcmtype: 'file', gcmlimit: '30'
    });
  }
  /* Tier 2 — the images used on the English Wikipedia article. Commons-hosted
     files still return full imageinfo through the local API. */
  function fromArticle(title) {
    return api('en.wikipedia.org', {
      generator: 'images', titles: title, gimlimit: '40'
    });
  }
  /* Tier 3 — a Commons text search. Least reliable, so it ranks last. */
  function fromSearch(q) {
    return api('commons.wikimedia.org', {
      generator: 'search', gsrsearch: q, gsrnamespace: '6', gsrlimit: '30'
    });
  }

  function keep(pg) {
    if (!pg || !PHOTO.test(pg.title || '')) return false;
    if (JUNK.test(pg.title)) return false;
    return !!(pg.imageinfo && pg.imageinfo[0] && pg.imageinfo[0].thumburl);
  }

  function figureFor(pg) {
    var info = pg.imageinfo[0];
    var meta = info.extmetadata || {};
    var name = (pg.title || '').replace(/^File:/, '').replace(/\.(jpe?g|png)$/i, '').replace(/_/g, ' ');
    var artist = meta.Artist ? plain(meta.Artist.value) : '';
    var lic = meta.LicenseShortName ? plain(meta.LicenseShortName.value) : '';
    var desc = meta.ImageDescription ? plain(meta.ImageDescription.value) : '';

    var fig = el('figure');
    var img = el('img');
    img.loading = 'lazy';
    img.alt = desc || name;
    img.src = info.thumburl;
    img.onerror = function () { if (fig.parentNode) fig.parentNode.removeChild(fig); };
    fig.appendChild(img);

    var cap = el('figcaption');
    var a = el('a');
    a.href = info.descriptionurl ||
             ('https://commons.wikimedia.org/wiki/' + encodeURIComponent(pg.title));
    a.target = '_blank'; a.rel = 'noopener';
    a.textContent = (desc && desc.length < 180) ? desc : name;
    cap.appendChild(a);

    var cred = el('span', 'cred');
    var bits = [];
    if (artist) bits.push(artist);
    if (lic) bits.push(lic);
    bits.push('via Wikimedia Commons');
    cred.textContent = bits.join(' · ');
    cap.appendChild(cred);

    fig.appendChild(cap);
    return fig;
  }

  function browseHref(cat, q, wp) {
    if (cat) return 'https://commons.wikimedia.org/wiki/' + encodeURIComponent(cat);
    if (q) return 'https://commons.wikimedia.org/w/index.php?search=' +
                  encodeURIComponent(q) + '&title=Special:MediaSearch&type=image';
    return 'https://en.wikipedia.org/wiki/' + encodeURIComponent(wp || '');
  }

  document.addEventListener('DOMContentLoaded', function () {
    var host = document.getElementById('gallery');
    if (!host) return;

    var cat = host.getAttribute('data-commons-cat') || '';
    var wp = host.getAttribute('data-wp') || '';
    var q = host.getAttribute('data-commons') || '';
    if (!cat && !wp && !q) { host.parentNode.removeChild(host); return; }

    var status = el('div', 'gal-status');
    status.textContent = 'Loading photographs from Wikimedia Commons…';
    host.appendChild(status);

    /* Run the tiers in parallel but merge them in priority order, so a good
       category still wins even though search also answered. */
    Promise.all([
      cat ? fromCategory(cat) : Promise.resolve([]),
      wp ? fromArticle(wp) : Promise.resolve([]),
      q ? fromSearch(q) : Promise.resolve([])
    ]).then(function (tiers) {
      var seen = {}, got = [];
      tiers.forEach(function (pages) {
        (pages || []).filter(keep).forEach(function (pg) {
          if (seen[pg.title] || got.length >= MAX) return;
          seen[pg.title] = 1;
          got.push(pg);
        });
      });

      if (!got.length) {
        host.innerHTML = '';
        var s = el('div', 'gal-status');
        s.innerHTML = 'Photographs could not be loaded here — ' +
          '<a target="_blank" rel="noopener" href="' + browseHref(cat, q, wp) +
          '">browse them on Wikimedia Commons</a>.';
        host.appendChild(s);
        return;
      }

      host.innerHTML = '';
      got.forEach(function (pg) { host.appendChild(figureFor(pg)); });

      var note = el('div', 'gal-status');
      note.innerHTML = '<a target="_blank" rel="noopener" href="' + browseHref(cat, q, wp) +
        '">More photographs on Wikimedia Commons →</a>';
      host.appendChild(note);
    });
  });
})();
