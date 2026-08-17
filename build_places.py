# -*- coding: utf-8 -*-
"""
Generates places/<slug>.html — one article page per place in the itinerary —
plus places/index.html, and hyperlinks the activity names in index.html
through to them.

Run from the repo root:   python3 build_places.py

Content lives in place_data_*.py. Photographs are NOT baked in: each page
carries a Commons category and/or search query, and places/place.js asks
Wikimedia for the images when a reader opens the page. See the comment at the
top of place.js for why.
"""
import io, os, re, sys, html

from place_data_cph import PLACES as P_CPH
from place_data_nor import PLACES as P_NOR
from place_data_swe import PLACES as P_SWE

PLACES = P_CPH + P_NOR + P_SWE

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, 'places')

DAY_DATE = {
    1: 'Sat Aug 8', 2: 'Sun Aug 9', 3: 'Mon Aug 10', 4: 'Tue Aug 11', 5: 'Wed Aug 12',
    6: 'Thu Aug 13', 7: 'Fri Aug 14', 8: 'Sat Aug 15', 9: 'Sun Aug 16', 10: 'Mon Aug 17',
    11: 'Tue Aug 18', 12: 'Wed Aug 19', 13: 'Thu Aug 20', 14: 'Fri Aug 21', 15: 'Sat Aug 22',
    16: 'Sun Aug 23', 17: 'Mon Aug 24', 18: 'Tue Aug 25',
}

PAGE = u"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex">
<title>{name} — Scandinavia Aug 2026</title>
<link rel="stylesheet" href="place.css">
</head>
<body>
<div class="wrap">

<nav class="crumb">
  <a href="../index.html">Full itinerary</a><span class="sep">/</span>
  <a href="index.html">Places</a><span class="sep">/</span>
  <span>{city}</span>
</nav>

<h1>{name}</h1>
{native}
<p class="tagline">{tagline}</p>

{planbox}

<div class="gal lead" id="gallery"{galattrs}></div>

{facts}

{body}

<div class="srcs">{srcs}</div>

<div class="nav">
  <a href="../index.html{dayanchor}">← Back to {dayref}</a>
  <a href="index.html">All places</a>
</div>

</div>
<script src="place.js"></script>
</body>
</html>
"""


def esc(s):
    return s


def build_body(blocks):
    out = []
    for kind, content in blocks:
        if kind == 'h2':
            out.append(u'<h2>%s</h2>' % content)
        elif kind == 'p':
            out.append(u'<p>%s</p>' % content)
        elif kind == 'ul':
            items = u''.join(u'<li>%s</li>' % i for i in content)
            out.append(u'<ul>%s</ul>' % items)
        else:
            raise ValueError('unknown block %r' % kind)
    return u'\n'.join(out)


def build_facts(facts):
    if not facts:
        return u''
    rows = u''.join(u'<tr><th>%s</th><td>%s</td></tr>' % (k, v) for k, v in facts)
    return u'<table class="facts">%s</table>' % rows


def build_srcs(pl):
    bits = []
    if pl.get('wp'):
        bits.append(u'<a target="_blank" rel="noopener" href="https://en.wikipedia.org/wiki/%s">'
                    u'Wikipedia: %s</a>' % (pl['wp'].replace(' ', '_'), pl['wp']))
    for label, url in pl.get('links', []):
        bits.append(u'<a target="_blank" rel="noopener" href="%s">%s</a>' % (url, label))
    body = u' · '.join(bits)
    return (u'Photographs are loaded live from Wikimedia Commons and credited to their '
            u'authors beneath each frame. Further reading: %s' % body) if body else \
           u'Photographs are loaded live from Wikimedia Commons and credited beneath each frame.'


def main():
    if not os.path.isdir(OUT):
        os.makedirs(OUT)

    slugs = [p['slug'] for p in PLACES]
    dupes = set(s for s in slugs if slugs.count(s) > 1)
    if dupes:
        sys.exit('duplicate slugs: %s' % sorted(dupes))

    for pl in PLACES:
        # Three photo sources, tried in order of trustworthiness by place.js:
        # explicit Commons category, then images used on the Wikipedia article,
        # then a Commons text search.
        galattrs = u''
        if pl.get('cat'):
            galattrs += u' data-commons-cat="%s"' % html.escape(pl['cat'], quote=True)
        if pl.get('wp'):
            galattrs += u' data-wp="%s"' % html.escape(pl['wp'], quote=True)
        if pl.get('commons'):
            galattrs += u' data-commons="%s"' % html.escape(pl['commons'], quote=True)

        day = pl.get('day')
        planbox = u''
        if pl.get('plan'):
            when = pl.get('when', '')
            label = (u'Day %d · %s%s' % (day, DAY_DATE.get(day, ''), (u' · ' + when) if when else u'')) \
                    if day else u'Not currently in the plan'
            planbox = (u'<div class="plan"><span class="when">%s</span>%s</div>' % (label, pl['plan']))

        page = PAGE.format(
            name=pl['name'],
            city=pl.get('city', ''),
            native=(u'<p class="native">%s</p>' % pl['native']) if pl.get('native') else u'',
            tagline=pl['tagline'],
            planbox=planbox,
            galattrs=galattrs,
            facts=build_facts(pl.get('facts')),
            body=build_body(pl['body']),
            srcs=build_srcs(pl),
            dayanchor=(u'#day%d' % day) if day else u'',
            dayref=(u'Day %d' % day) if day else u'the itinerary',
        )
        io.open(os.path.join(OUT, pl['slug'] + '.html'), 'w', encoding='utf-8').write(page)

    build_index()
    link_itinerary()
    print('built %d place pages' % len(PLACES))


def build_index():
    groups = []
    for pl in PLACES:
        g = pl.get('city', 'Other')
        if not groups or groups[-1][0] != g:
            groups.append((g, []))
        groups[-1][1].append(pl)

    sections = []
    for g, items in groups:
        lis = []
        for pl in items:
            day = pl.get('day')
            meta = (u'Day %d · %s' % (day, DAY_DATE.get(day, ''))) if day else u'Not in the plan'
            lis.append(u'<li><a href="%s.html"><span class="nm">%s</span> '
                       u'<span class="mt">— %s</span></a></li>' % (pl['slug'], pl['name'], meta))
        sections.append(u'<p class="grp">%s</p><ul class="plist">%s</ul>' % (g, u''.join(lis)))

    page = u"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex">
<title>Places — Scandinavia Aug 2026</title>
<link rel="stylesheet" href="place.css">
</head>
<body>
<div class="wrap">
<nav class="crumb"><a href="../index.html">Full itinerary</a><span class="sep">/</span><span>Places</span></nav>
<h1>Places</h1>
<p class="tagline">One page per place in the itinerary — what it is, why it is there,
and what to look for when you are standing in it. Photographs load from Wikimedia
Commons, credited to their authors.</p>
%s
<div class="nav"><a href="../index.html">← Back to the itinerary</a></div>
</div>
</body>
</html>
""" % u'\n'.join(sections)
    io.open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(page)



def autolink(s):
    """Link the FIRST unlinked mention of each place name within each section.

    The explicit `match` anchors only ever link one occurrence per document, so
    as the plan got rewritten the same place ended up named in verdicts, weather
    warnings, alternate plans and cut-lists as plain text. This pass fixes that
    generically.

    HOW IT AVOIDS CORRUPTING THE HTML: rather than tracking nesting depth while
    scanning — which got it wrong and double-wrapped names that were already
    linked — it builds a MASK of the section in which every unsafe character is
    replaced by NUL while keeping the same length. Offsets therefore line up
    exactly with the real string, and a name found in the mask is guaranteed to
    be in plain body text. Unsafe means: inside any tag, and inside <a>,
    <summary>, <label>, <script> or <style> elements. Links inside <summary>
    would navigate instead of toggling the day; inside <label> they would
    navigate instead of ticking the checkbox.

    One link per place per section, not per occurrence — otherwise a paragraph
    naming Bryggen four times becomes unreadable. Longest names first, so
    "Bryggens Museum" wins over "Bryggen".
    """
    SKIP = ('a', 'summary', 'label', 'script', 'style')

    def mask(text):
        m = list(text)
        i, n, depth = 0, len(text), 0
        while i < n:
            if text[i] == '<':
                j = text.find('>', i)
                if j == -1:
                    for k in range(i, n):
                        m[k] = '\x00'
                    break
                raw = text[i+1:j]
                bare = raw.lstrip('/').strip()
                nm = bare.split()[0].lower() if bare else ''
                closing = raw.startswith('/')
                selfclose = raw.endswith('/')
                for k in range(i, j+1):          # the tag itself is never text
                    m[k] = '\x00'
                if nm in SKIP and not selfclose:
                    depth = max(0, depth - 1) if closing else depth + 1
                i = j + 1
            else:
                if depth > 0:
                    m[i] = '\x00'
                i += 1
        return ''.join(m)

    names = []
    for pl in PLACES:
        names.append((pl['name'], pl['slug']))
        alt = pl['name'].replace('The ', '')
        if alt != pl['name']:
            names.append((alt, pl['slug']))
    names.sort(key=lambda t: -len(t[0]))

    cuts = [mm.start() for mm in re.finditer(r'<details\b', s)] + [len(s)]
    pieces, prev = [], 0
    for c in cuts:
        pieces.append(s[prev:c]); prev = c

    added = 0
    for k, sec in enumerate(pieces):
        if not sec:
            continue
        for name, slug in names:
            # EVERY unlinked occurrence gets a link, not just the first — the
            # point is that any mention of a place is a way to read about it.
            # Naturally idempotent: once wrapped, an occurrence sits inside an
            # <a> and is masked out, so a rerun finds nothing left to do.
            while True:
                idx = mask(sec).find(name)
                if idx == -1:
                    break
                sec = (sec[:idx]
                       + '<a href="places/%s.html">%s</a>' % (slug, name)
                       + sec[idx+len(name):])
                added += 1
        pieces[k] = sec

    print('autolinked %d additional place mentions' % added)
    return ''.join(pieces)


def link_itinerary():
    """Wrap the matched activity text in index.html with a link to its page.
    Idempotent: skips anything already linked."""
    path = os.path.join(ROOT, 'index.html')
    s = io.open(path, encoding='utf-8').read()
    linked, missed = 0, []

    for pl in PLACES:
        m = pl.get('match')
        if not m:
            continue
        # "prefix|text" locates the right occurrence but only `text` is wrapped,
        # so the anchor never swallows surrounding markup.
        prefix, _, text = m.rpartition('|')
        whole = prefix + text
        # Idempotency: once linked, `whole` no longer exists as one string,
        # because the anchor was inserted between prefix and text. Check for
        # the linked form before deciding anything is missing.
        already = u'%s<a href="places/%s.html">%s</a>' % (prefix, pl['slug'], text)
        if already in s:
            continue
        if whole not in s:
            missed.append((pl['slug'], whole))
            continue
        if s.count(whole) != 1:
            missed.append((pl['slug'], whole + ' [%d matches]' % s.count(whole)))
            continue
        at = s.index(whole)
        if '<a href="places/' in s[max(0, at - 220):at]:
            continue  # already linked
        s = s.replace(whole, u'%s<a href="places/%s.html">%s</a>' % (prefix, pl['slug'], text), 1)
        linked += 1

    # Add the Places link to the header once.
    hdr = u'<p>Row colors: PURPLE = purchased ticket'
    nav = (u'<p style="background:#eef4f5;border-left:4px solid #0e5a6d;padding:9px 12px;'
           u'margin:10px 0;font-size:13.5px"><b>Place guides:</b> every starred sight below links '
           u'through to <a href="places/index.html" style="color:#0e5a6d;font-weight:700">its own '
           u'page</a> — what it is, its history, what to look for, and photographs. '
           u'<a href="places/index.html" style="color:#0e5a6d;font-weight:700">Browse all places →</a></p>\n')
    if 'places/index.html' not in s:
        s = s.replace(hdr, nav + hdr, 1)

    # Anchors on each day, so "Back to Day N" lands in the right place.
    def anchor(mo):
        return mo.group(0).replace('<details class="day"', '<details id="day%s" class="day"' % mo.group(1), 1)
    s = re.sub(r'<details class="day" data-date="[^"]+" data-day="(\d+)"', anchor, s)

    s = autolink(s)

    io.open(path, 'w', encoding='utf-8').write(s)
    print('linked %d activities into index.html' % linked)
    if missed:
        print('NOT LINKED (%d):' % len(missed))
        for slug, m in missed:
            print('   %-34s %s' % (slug, m[:80]))


if __name__ == '__main__':
    main()
