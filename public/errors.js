/* SPDX-License-Identifier: GPL-3.0-only
   Copyright (C) 2026 poli0981 (SkullMute)

   Console ring buffer — docs/05 §A5.

   This runs from a deferred external script, NOT from inside ShBugReport,
   because that island is client:visible in the footer (docs/02 §5): if the
   listeners attached on hydration they would miss every error that happened
   before the user scrolled down — which is most of them, and precisely the
   ones a bug report needs.

   The buffer lives on window so the island reads the same instance a module
   import could not share with a plain script. External file, so it satisfies
   script-src without a hash (docs/09 §4, D20).

   Privacy (docs/09 §8): exception text from our own origin only. It never
   wraps console.*, never reads input values, and never leaves the page until
   the user explicitly opens a bug report. */
(() => {
  var CAP = 20;
  var MAX_LINE = 500;
  var buf = (window.__shErrors = window.__shErrors || []);

  function push(line) {
    buf.push(('[' + new Date().toISOString() + '] ' + line).slice(0, MAX_LINE));
    if (buf.length > CAP) buf.shift();
  }

  window.addEventListener('error', function (e) {
    push('error: ' + e.message + ' @ ' + e.filename + ':' + e.lineno);
  });

  window.addEventListener('unhandledrejection', function (e) {
    push('unhandledrejection: ' + String(e.reason).slice(0, 400));
  });
})();
