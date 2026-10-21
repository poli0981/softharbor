/* SPDX-License-Identifier: GPL-3.0-only
   Copyright (C) 2026 poli0981 (SkullMute)

   Console ring buffer — docs/05 §A5.

   Loaded FIRST in <head>, blocking, before any other script: a buffer that
   starts listening after theme.js or an island bootstrap has already thrown
   is a buffer that misses the errors a bug report most needs. (Until v1.1 it
   was `defer`red, which did exactly that.)

   The buffer lives on window so the island reads the same instance a module
   import could not share with a plain script. Referenced from Base.astro via
   `?url&no-inline`, so it ships as a hashed, immutable file under /_astro/
   and is covered by `script-src 'self'` without a hash (docs/09 §4).

   What it records — each line stamped with time and page path, de-duplicated:
   - uncaught errors from OUR origin (extension and third-party script errors
     are skipped: they are not our bugs, and their URLs would reveal which
     extensions a visitor runs);
   - unhandled promise rejections;
   - Content-Security-Policy violations. The policy is a <meta> tag, which
     cannot carry report-uri/report-to, so this event is the only place a
     blocked script or style ever surfaces (docs/09 §4);
   - Astro island hydration failures, which Astro catches and re-dispatches
     as `astro:hydration-error` instead of letting them reach window.onerror.

   Privacy (docs/09 §8): in-memory only, for the life of the page. It never
   wraps console.*, never reads input values, and never leaves the page until
   the visitor opens a bug report and submits it on GitHub themselves. */
(() => {
  var CAP = 20;
  var MAX_LINE = 500;
  var buf = (window.__shErrors = window.__shErrors || []);
  var seen = Object.create(null);
  var origin = location.origin;

  function push(line) {
    // The same failure in a loop (a resize handler, a retried import) must not
    // flush everything else out of a 20-line buffer.
    var key = line.slice(0, 200);
    if (seen[key]) return;
    seen[key] = true;
    var stamped = '[' + new Date().toISOString() + '] ' + location.pathname + ' ' + line;
    buf.push(stamped.slice(0, MAX_LINE));
    if (buf.length > CAP) buf.shift();
  }

  function firstLine(value) {
    if (value && typeof value === 'object' && typeof value.stack === 'string') {
      return value.stack.split('\n').slice(0, 2).join(' | ');
    }
    return String(value);
  }

  window.addEventListener('error', function (e) {
    // Resource load failures (an <img> 404) also fire `error`, on the element,
    // without a message; only script errors carry one.
    if (!e.message) return;
    if (e.filename && e.filename.indexOf(origin) !== 0) return;
    push('error: ' + e.message + ' @ ' + (e.filename || 'inline') + ':' + e.lineno + ':' + e.colno);
  });

  window.addEventListener('unhandledrejection', function (e) {
    push('unhandledrejection: ' + firstLine(e.reason).slice(0, 400));
  });

  document.addEventListener('securitypolicyviolation', function (e) {
    push(
      'csp: ' +
        e.effectiveDirective +
        ' blocked ' +
        (e.blockedURI || 'inline') +
        (e.sourceFile ? ' @ ' + e.sourceFile + ':' + e.lineNumber : ''),
    );
  });

  document.addEventListener('astro:hydration-error', function (e) {
    var d = e.detail || {};
    push('hydration: ' + (d.componentUrl || '?') + ' — ' + firstLine(d.error).slice(0, 300));
  });
})();
