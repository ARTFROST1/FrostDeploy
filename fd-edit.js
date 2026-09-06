/**
 * fd-edit — visual-editing overlay for the Freim Deploy client portal.
 *
 * Loaded ONLY inside the portal's iframe (see the inline loader in
 * BaseLayout.astro). Every [data-cms] element gets a visible container
 * outline (TinaCMS-style); in EDIT mode clicking one selects its FIELD in the
 * portal's side panel, where the actual editing happens. In PREVIEW mode the
 * overlay steps out of the way entirely — clicks are not intercepted, so the
 * site behaves like a normal visitor's (links, accordions, view-transition
 * navigation all work). This script never persists anything itself.
 *
 * The outline/wash CSS, the click→select model, the click-gating flag and the
 * ready announce-loop are adapted from TinaCMS (packages/@tinacms/bridge,
 * Apache-2.0: quick-edit-css, click-to-focus.ts, forms.ts).
 *
 * ── Protocol (keep in sync with Freim Deploy
 *    client-portal/frontend/src/overlay-bridge.ts) ──────────────────────────
 *
 *   site → portal  {source:'fd-edit', type, …}
 *     'ready'                            handshake; repeated until the portal
 *                                        answers 'init' (announce-loop)
 *     'select'  {path}                   a [data-cms] element was clicked
 *     'edit'    {path, value}            (reserved) in-page edit
 *     'url'     {href, keys}             current page path, plus the
 *                                        "collection:itemId:field" keys of
 *                                        every [data-cms] element on this page
 *                                        (the portal's field inventory, used
 *                                        to navigate to a field's page before
 *                                        focusing it) — sent on every load
 *     'pages'   {paths}                  same-origin nav link pathnames (for
 *                                        the portal's page picker) — sent
 *                                        alongside 'url' on every load
 *     'apply-miss' {path}                a portal 'apply' named a path with no
 *                                        matching [data-cms] element on this
 *                                        page — the portal shows a "visible
 *                                        after publish" badge for it instead
 *                                        of pretending the live preview updated.
 *
 *   portal → site  {source:'fd-portal', type, …}
 *     'init'    {values}                 seed / re-seed all editable text
 *     'apply'   {path, value}            live-patch one field. Textual by
 *                                        default (textContent); if the target
 *                                        element carries `data-fd-attr="src"`
 *                                        (or "href", etc.) the named attribute
 *                                        is set instead — optionally through
 *                                        `data-fd-attr-template="tel:{value}"`,
 *                                        which substitutes `{value}` into the
 *                                        template rather than writing the raw
 *                                        value (e.g. a phone CTA's `tel:` href
 *                                        whose visible field is just the digits).
 *                                        If no element matches, the site
 *                                        replies with 'apply-miss' instead.
 *                                        For `data-fd-attr="src"` specifically
 *                                        (`init` and `apply` both), the value
 *                                        is written only when it looks like a
 *                                        URL (`data:`/`blob:`/`http(s):`/`/…`);
 *                                        a registry key (`cms/<uuid>.png`) is
 *                                        ignored, since only astro:assets at
 *                                        build time knows the real hashed
 *                                        path — see applyAttrOrText below.
 *     'focus'   {path}                   scroll to + highlight an element
 *     'mode'    {editing:boolean}        edit (overlay on) vs preview (off);
 *                                        the portal sends this right after
 *                                        'init'. Default before it arrives is
 *                                        editing=true (honoring a persisted
 *                                        preview mode to avoid an overlay flash
 *                                        while navigating in preview).
 *
 *   path = {collection, itemId|null, field(dot-path)}.
 */
(function () {
  'use strict';

  if (window.parent === window) return; // not in an iframe → never activate

  var STORAGE_ORIGIN = 'fdEdit.origin';
  var STORAGE_MODE = 'fdEdit.mode';
  var params = new URLSearchParams(location.search);

  // Resolve the portal origin. On the FIRST iframe load it arrives in the
  // query (?fd_edit=1&fd_origin=…). We persist it in sessionStorage so the
  // overlay survives in-preview navigation to pages that carry no query
  // string (click a link in preview → /about/ → still an editable frame).
  //
  // sessionStorage is scoped to THIS browser tab AND this site's own origin;
  // it is never shared with other origins or other tabs. Persisting the
  // origin here therefore does NOT widen the accepted fd_origin trust risk
  // documented just below — it only lets an already-activated tab remember a
  // value it already accepted from its own query string.
  var storedOrigin = null;
  try {
    storedOrigin = sessionStorage.getItem(STORAGE_ORIGIN);
  } catch (e) {
    /* private mode / disabled storage — fall back to query only */
  }
  var queryOrigin = params.get('fd_edit') === '1' ? params.get('fd_origin') : null;

  // Trust model: fd_origin comes from the embedder (query string, then cached
  // in sessionStorage above) and is intentionally NOT allow-listed here — the
  // portal origin varies per deployment and this script has no way to know it
  // in advance. The exposure this permits is limited to public page text and
  // cosmetic DOM edits inside the embedder's own iframe (this document), which
  // is an accepted, documented risk. The real security boundary lives on the
  // portal side: overlay-bridge.ts enforces the origin check against the
  // DB-backed siteUrl before it trusts any message from this script.
  var PORTAL_ORIGIN = queryOrigin || storedOrigin || '';
  if (!PORTAL_ORIGIN) return;
  try {
    sessionStorage.setItem(STORAGE_ORIGIN, PORTAL_ORIGIN);
  } catch (e) {
    /* ignore */
  }

  if (window.__fdEditLoaded) return; // double-load guard (loader re-run)
  window.__fdEditLoaded = true;

  // Edit vs preview. Default editing=true (the portal sends 'mode' right after
  // 'init'); we honor a persisted preview mode so navigating between pages
  // while in preview doesn't flash the overlay before that message lands.
  var editing = true;
  try {
    if (sessionStorage.getItem(STORAGE_MODE) === 'preview') editing = false;
  } catch (e) {
    /* ignore */
  }

  function parsePath(el) {
    var raw = el.getAttribute('data-cms');
    if (!raw) return null;
    var parts = raw.split(':');
    if (parts.length !== 3) return null;
    return {
      collection: parts[0],
      itemId: parts[1] === '' ? null : parts[1],
      field: parts[2],
    };
  }

  function samePath(a, b) {
    return (
      a.collection === b.collection &&
      (a.itemId || '') === (b.itemId || '') &&
      a.field === b.field
    );
  }

  function findElement(path) {
    var els = document.querySelectorAll('[data-cms]');
    for (var i = 0; i < els.length; i++) {
      var p = parsePath(els[i]);
      if (p && samePath(p, path)) return els[i];
    }
    return null;
  }

  function post(type, path, value) {
    window.parent.postMessage(
      { source: 'fd-edit', type: type, path: path, value: value },
      PORTAL_ORIGIN,
    );
  }

  function postUrl() {
    window.parent.postMessage(
      { source: 'fd-edit', type: 'url', href: location.pathname, keys: collectKeys() },
      PORTAL_ORIGIN,
    );
    window.parent.postMessage(
      { source: 'fd-edit', type: 'pages', paths: collectPages() },
      PORTAL_ORIGIN,
    );
  }

  // "collection:itemId:field" key of every [data-cms] element on this page —
  // the portal's inventory of which fields live here. Lets a form-panel focus
  // for a field on ANOTHER page navigate there first (the portal accumulates
  // key→page from these across visited pages). Deduped; malformed data-cms
  // (parsePath → null) is skipped.
  function collectKeys() {
    var els = document.querySelectorAll('[data-cms]');
    var seen = {};
    var keys = [];
    for (var i = 0; i < els.length; i++) {
      var p = parsePath(els[i]);
      if (!p) continue;
      var key = p.collection + ':' + (p.itemId || '') + ':' + p.field;
      if (seen[key]) continue;
      seen[key] = true;
      keys.push(key);
    }
    return keys;
  }

  // Same-origin pathnames of the site's own nav links, for the portal's page
  // picker. Prefers a <nav> landmark (the site's real navigation); falls back
  // to every link on the page if there's no <nav> (or it's empty), so a
  // theme without one still gets a usable page list. Cross-origin links,
  // pure-fragment anchors (`#top`), and `mailto:`/`tel:` links are dropped;
  // duplicates collapse to one entry (a page can be linked from a nav more
  // than once, e.g. desktop + mobile menu markup).
  function collectPages() {
    var anchors = document.querySelectorAll('nav a[href]');
    if (!anchors.length) anchors = document.querySelectorAll('a[href]');
    var seen = {};
    var paths = [];
    anchors.forEach(function (a) {
      var raw = a.getAttribute('href');
      if (!raw || raw.indexOf('#') === 0) return;
      if (raw.indexOf('mailto:') === 0 || raw.indexOf('tel:') === 0) return;
      var url;
      try {
        url = new URL(raw, location.href);
      } catch (e) {
        return;
      }
      if (url.origin !== location.origin) return;
      if (seen[url.pathname]) return;
      seen[url.pathname] = true;
      paths.push(url.pathname);
    });
    return paths;
  }

  // ---- visual affordances ---------------------------------------------------
  // Adapted from TinaCMS quick-edit CSS: a dashed container outline on every
  // editable element, solid on hover, and a full-bleed tinted wash via
  // `box-shadow: inset 100vi 100vh`. The wash is gated to hover-capable
  // pointers — on touch screens :hover latches after a tap and never clears.
  // The whole <style> is installed/removed as a unit on the mode flag (same
  // model as TinaCMS click-to-focus): in preview mode nothing is highlighted.
  var STYLE_ID = 'fd-edit-style';
  var STYLE_CSS =
    '[data-cms]{outline:2px dashed rgba(37,99,235,.5);outline-offset:2px;cursor:pointer;transition:box-shadow ease-out 150ms;}' +
    '[data-cms]:hover{outline:2px solid rgba(37,99,235,1);}' +
    '[data-cms].fd-active{outline:2px solid #2563eb;box-shadow:inset 100vi 100vh rgba(37,99,235,.12);}' +
    '@media (hover:hover){[data-cms]:hover{box-shadow:inset 100vi 100vh rgba(37,99,235,.25);}}';

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = STYLE_CSS;
    document.head.appendChild(style);
  }

  function removeStyle() {
    var s = document.getElementById(STYLE_ID);
    if (s) s.remove();
  }

  var activeEl = null;

  function setActive(el) {
    if (activeEl === el) return;
    if (activeEl) activeEl.classList.remove('fd-active');
    activeEl = el;
    if (activeEl) activeEl.classList.add('fd-active');
  }

  function applyMode(next) {
    editing = !!next;
    try {
      sessionStorage.setItem(STORAGE_MODE, editing ? 'edit' : 'preview');
    } catch (e) {
      /* ignore */
    }
    if (editing) {
      installStyle();
    } else {
      removeStyle();
      setActive(null);
    }
  }

  // ---- applying portal values to the DOM ------------------------------------
  function getByDotPath(obj, path) {
    return path.split('.').reduce(function (acc, key) {
      return acc == null ? acc : acc[key];
    }, obj);
  }

  // Patch one element with one primitive value. Elements annotated
  // `data-fd-attr="src"|"href"|…` get that attribute set (optionally through
  // `data-fd-attr-template`, e.g. `"tel:{value}"`) instead of their
  // textContent — needed for anything whose editable field isn't the
  // rendered text itself (an image's src, a CTA's href/tel link, …).

  // Значение поля-картинки после переезда в src/assets — это КЛЮЧ РЕЕСТРА
  // (`cms/<uuid>.png`), а не URL: настоящий адрес выдаёт astro:assets на
  // сборке (`/_astro/<hash>.webp`) и знать его портал не может. Подставить
  // ключ в `src` = сломать картинку в превью. Поэтому `src` патчим только
  // значением, которое реально является URL: `data:`/`blob:` (живое превью
  // только что выбранного файла), внешний `http(s):` или публичный путь со
  // слэшем (легаси-значения и /images/placeholder.svg). Всё остальное
  // оставляет серверный src как есть — картинка обновится после публикации и
  // пересборки. Атрибуты не-src (`href` телефонов) правило не затрагивает.
  function isUrlValue(value) {
    return /^(data:|blob:|https?:|\/)/.test(value);
  }

  function applyAttrOrText(el, value) {
    var attr = el.getAttribute('data-fd-attr');
    if (attr) {
      var template = el.getAttribute('data-fd-attr-template');
      var next = template ? template.replace('{value}', String(value)) : String(value);
      if (attr === 'src' && !isUrlValue(next)) return;
      if (el.getAttribute(attr) !== next) el.setAttribute(attr, next);
    } else if (String(value) !== el.textContent) {
      el.textContent = String(value);
    }
  }

  function applyValues(values) {
    document.querySelectorAll('[data-cms]').forEach(function (el) {
      var p = parsePath(el);
      if (!p || !Object.prototype.hasOwnProperty.call(values, p.collection)) return;
      var collectionValue = values[p.collection];
      var item =
        p.itemId === null
          ? collectionValue
          : Array.isArray(collectionValue)
            ? collectionValue.find(function (x) {
                return x && x.id === p.itemId;
              })
            : null;
      if (!item) return;
      var val = getByDotPath(item, p.field);
      // An `fd-upload://…` value is an unpublished image the portal previews
      // by pushing a data: URL via 'apply' (fd-upload:// means nothing to this
      // origin). A re-seed must NOT overwrite that good preview — or a bare
      // `<img src="fd-upload://…">` — with the placeholder; skip it and leave
      // whatever 'apply' last set (or the server-rendered image) in place.
      if (typeof val === 'number') {
        applyAttrOrText(el, val);
      } else if (typeof val === 'string' && val.indexOf('fd-upload://') !== 0) {
        applyAttrOrText(el, val);
      }
    });
  }

  // ---- ready announce-loop (TinaCMS bridge/forms.ts) ------------------------
  // The iframe can finish loading before the portal has wired up its message
  // listener; post 'ready' every 250ms (up to 40 tries / 10s) until the portal
  // answers with 'init'. Restarted on every page load so soft-navigation to a
  // new page re-handshakes and re-seeds values for the freshly-swapped DOM.
  var ANNOUNCE_INTERVAL = 250;
  var ANNOUNCE_MAX = 40;
  var initialized = false;
  var announceTimer = null;
  var announceAttempts = 0;

  function stopAnnounce() {
    if (announceTimer) {
      clearTimeout(announceTimer);
      announceTimer = null;
    }
  }

  function announce() {
    if (initialized) {
      announceTimer = null;
      return;
    }
    announceAttempts++;
    if (announceAttempts > ANNOUNCE_MAX) {
      announceTimer = null;
      return;
    }
    post('ready', null);
    announceTimer = setTimeout(announce, ANNOUNCE_INTERVAL);
  }

  function startAnnounce() {
    stopAnnounce();
    initialized = false;
    announceAttempts = 0;
    announce();
  }

  // ---- click → select the field in the portal panel -------------------------
  // Capture phase + preventDefault, so links/accordions under an annotated
  // element never fire in EDIT mode (same model as TinaCMS click-to-focus).
  // In PREVIEW mode the handler bails immediately: clicks are left untouched so
  // the site behaves exactly as it does for a real visitor.
  //
  // The interactive-ancestor check is intentionally separate from the
  // [data-cms] check: a click can land on the EDGE of a button/link whose
  // annotated text is a descendant (e.g. a pricing CTA's outer <a> padding) —
  // `e.target` is then the <a> itself, and `.closest('[data-cms]')` from
  // there finds nothing (data-cms is below, not above, the target). Without
  // this, that click fell through to the native navigation/submit, which was
  // the "clicking the edge of the CTA button navigated away" bug. Gating on
  // ANY interactive ancestor — annotated or not — closes that hole.
  document.addEventListener(
    'click',
    function (e) {
      if (!editing) return;
      var interactiveEl =
        e.target && e.target.closest
          ? e.target.closest('a,button,[role=button],[onclick],input[type=submit]')
          : null;
      var cmsEl = e.target && e.target.closest ? e.target.closest('[data-cms]') : null;
      if (interactiveEl || cmsEl) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (!cmsEl) {
        setActive(null);
        return;
      }
      var path = parsePath(cmsEl);
      if (!path) return;
      setActive(cmsEl);
      post('select', path);
    },
    true,
  );

  // Same reasoning as the click handler above: a form inside an editable
  // section must never actually submit while in EDIT mode.
  document.addEventListener(
    'submit',
    function (e) {
      if (!editing) return;
      e.preventDefault();
      e.stopPropagation();
    },
    true,
  );

  // ---- messages from the portal ---------------------------------------------
  window.addEventListener('message', function (e) {
    if (e.origin !== PORTAL_ORIGIN) return;
    var msg = e.data;
    if (!msg || msg.source !== 'fd-portal') return;
    if (msg.type === 'init' && msg.values) {
      initialized = true;
      stopAnnounce();
      applyValues(msg.values);
      // Re-report url/pages/keys now that the portal is provably listening (it
      // just answered our announce with 'init'). The load-time postUrl() often
      // fires before the portal has wired its message handler — it fetches
      // schema + every collection first — so that first report is lost, which
      // left the page picker showing only the current page and cross-page
      // field focus not knowing where a field lives. This delivery can't be
      // missed.
      postUrl();
    }
    if (msg.type === 'mode') applyMode(msg.editing);
    if (msg.type === 'apply' && msg.path) {
      if (typeof msg.value !== 'string' && typeof msg.value !== 'number') return;
      // Patch EVERY element annotated with this path, not just the first —
      // the same field can be rendered more than once on a page (e.g.
      // Header.astro's desktop + mobile nav both annotate
      // navigation::ctaLabel/phone). findElement (single match) used to
      // leave every duplicate past the first stale until the next re-seed.
      var applyMatched = false;
      document.querySelectorAll('[data-cms]').forEach(function (el) {
        var p = parsePath(el);
        if (p && samePath(p, msg.path)) {
          applyMatched = true;
          applyAttrOrText(el, msg.value);
        }
      });
      if (!applyMatched) {
        // Nothing on this page renders that field (wrong page, or its value
        // isn't reflected in the DOM at all) — tell the portal so it can show
        // a "visible after publish" badge instead of a silently-stale field.
        post('apply-miss', msg.path);
      }
    }
    // The portal-side mirror of TinaCMS's ActiveFieldIndicator: focusing a
    // form field scrolls the page to its element and highlights it.
    if (msg.type === 'focus' && msg.path) {
      var el = findElement(msg.path);
      if (el) {
        setActive(el);
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  });

  // ---- (re)initialise on each page load -------------------------------------
  // Runs on the initial load AND after every Astro view-transition swap: the
  // <style> and DOM are fresh, so re-install the overlay (if editing), report
  // the new URL, and re-handshake. Double-firing on the very first load
  // (direct call + astro:page-load) is harmless — installStyle is idempotent
  // and a repeated 'ready'/'url' just re-triggers a portal re-init.
  function onPageLoad() {
    setActive(null);
    if (editing) installStyle();
    else removeStyle();
    postUrl();
    startAnnounce();
  }

  onPageLoad();
  document.addEventListener('astro:page-load', onPageLoad);
})();
