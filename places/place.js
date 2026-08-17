/* ---------------------------------------------------------------------------
   Photos for the place pages.

   WHY IT WORKS THIS WAY: no image URL is written into these pages. Wikimedia
   thumbnail paths contain a hash segment that cannot be derived from a
   filename, so hardcoding them means guessing, and a guessed URL is a broken
   image. Instead the page asks the Wikimedia APIs for photos when a reader
   opens it, and renders whatever actually comes back — together with the
   author and licence that the API reports, which is also what Commons
   attribution requires.

   Each page carries:
     data-commons-cat  optional Commons category, tried first (precise)
     data-commons      Commons search query, used if the category is empty
     data-wp           English Wikipedia article title, for the text link

   Both endpoints send CORS headers (the Action API via origin=*), so this
   works from a github.io origin. If anything fails the gallery collapses to
   a labelled link rather than a row of broken frames.
--------------------------------------------------------------------------- */
(function () {
  var MAX = 5;
  var OK = /\.(jpe?g|png)$/i;

  function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
  function text(html) { var d = el('div'); d.innerHTML = html || ''; return (d.textContent || '').trim(); }

  function commonsURL(params) {
    params.action = 'query'; params.format = 'json'; params.origin = '*';
    params.prop = 'imageinfo';
    params.iiprop = 'url|extmetadata';
    params.iiurlwidth = '900';
    return 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams(params).toString();
  }

  function pagesOf(json) {
    var p = json && json.query && json.query.pages;
    if (!p) return [];
    return Object.keys(p).map(function (k) { return p[k]; });
  }

  /* Category members are far more precise than search, so try them first. */
  function byCategory(cat) {
    return fetch(commonsURL({
      generator: 'categorymembers', gcmtitle: cat, gcmtype: 'file', gcmlimit: '20'
    })).then(function (r) { return r.json(); }).then(pagesOf);
  }
  function bySearch(q) {
    return fetch(commonsURL({
      generator: 'search', gsrsearch: q, gsrnamespace: '6', gsrlimit: '20'
    })).then(function (r) { return r.json(); }).then(pagesOf);
  }

  function usable(pages) {
    return (pages || []).filter(function (pg) {
      return pg && OK.test(pg.title || '') && pg.imageinfo && pg.imageinfo[0] && pg.imageinfo[0].thumburl;
    }).slice(0, MAX);
  }

  function figureFor(pg) {
    var info = pg.imageinfo[0];
    var meta = info.extmetadata || {};
    var name = (pg.title || '').replace(/^File:/, '').replace(/\.(jpe?g|png)$/i, '').replace(/_/g, ' ');
    var artist = meta.Artist ? text(meta.Artist.value) : '';
    var lic = meta.LicenseShortName ? text(meta.LicenseShortName.value) : '';
    var desc = meta.ImageDescription ? text(meta.ImageDescription.value) : '';

    var fig = el('figure');
    var img = el('img');
    img.loading = 'lazy';
    img.alt = desc || name;
    img.src = info.thumburl;
    /* A single dead image should not leave an empty frame behind. */
    img.onerror = function () { if (fig.parentNode) fig.parentNode.removeChild(fig); };
    fig.appendChild(img);

    var cap = el('figcaption');
    var a = el('a');
    a.href = info.descriptionurl || 'https://commons.wikimedia.org/wiki/' + encodeURIComponent(pg.title);
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

  function fallback(host, q, cat) {
    var s = el('div', 'gal-status');
    var href = cat
      ? 'https://commons.wikimedia.org/wiki/' + encodeURIComponent(cat)
      : 'https://commons.wikimedia.org/w/index.php?search=' +
        encodeURIComponent(q) + '&title=Special:MediaSearch&type=image';
    s.innerHTML = 'Photographs could not be loaded here — ' +
      '<a target="_blank" rel="noopener" href="' + href + '">browse them on Wikimedia Commons</a>.';
    host.innerHTML = '';
    host.appendChild(s);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var host = document.getElementById('gallery');
    if (!host) return;
    var cat = host.getAttribute('data-commons-cat') || '';
    var q = host.getAttribute('data-commons') || '';
    if (!cat && !q) { host.parentNode.removeChild(host); return; }

    var status = el('div', 'gal-status');
    status.textContent = 'Loading photographs from Wikimedia Commons…';
    host.appendChild(status);

    var first = cat ? byCategory(cat) : Promise.resolve([]);

    first
      .then(function (pages) {
        var got = usable(pages);
        if (got.length) return got;
        return q ? bySearch(q).then(usable) : [];
      })
      .then(function (got) {
        if (!got.length) { fallback(host, q, cat); return; }
        host.innerHTML = '';
        /* First figure becomes the lead purely via CSS :first-of-type. */
        got.forEach(function (pg) { host.appendChild(figureFor(pg)); });
        var note = el('div', 'gal-status');
        var href = cat
          ? 'https://commons.wikimedia.org/wiki/' + encodeURIComponent(cat)
          : 'https://commons.wikimedia.org/w/index.php?search=' +
            encodeURIComponent(q) + '&title=Special:MediaSearch&type=image';
        note.innerHTML = '<a target="_blank" rel="noopener" href="' + href + '">More photographs on Wikimedia Commons →</a>';
        host.appendChild(note);
      })
      .catch(function () { fallback(host, q, cat); });
  });
})();
