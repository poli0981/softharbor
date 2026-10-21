// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)

/**
 * The one inline stylesheet the site ships (Base.astro <head>): the
 * cross-document View Transitions opt-in.
 *
 * It cannot live in global.css. Chromium settles the new page's opt-in when
 * the parser inserts <body>, counting only stylesheets that have finished
 * loading by then — and the bundled CSS links sit after the blocking scripts,
 * so a slow or service-worker-served load reaches <body> before global.css
 * arrives, the transition is skipped and its promises reject unhandled. An
 * inline sheet exists the moment it is parsed.
 *
 * Astro does not hash `is:inline` content into its CSP meta, so
 * astro.config.ts hashes THIS exact string into style-src; check:csp fails the
 * build if the rendered element and the hash ever drift apart.
 */
export const VIEW_TRANSITION_OPT_IN =
  '@media (prefers-reduced-motion:no-preference){@view-transition{navigation:auto}}';
