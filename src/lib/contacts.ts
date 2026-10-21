// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 poli0981 (SkullMute)
//
// One address per purpose (chosen 2026-10-21; replaced the single
// contact@softharbor.net). Mail to poli0981.dev is delivered to a mailbox
// hosted by Google — the Privacy Policy says so. Deliberately absent:
// sponsor@ (a neutral directory takes no paid placement) and games@ (another
// project's).

export const CONTACTS = {
  /** Vulnerabilities, and hijacked or malicious listing links (security.txt). */
  security: 'security@poli0981.dev',
  privacy: 'privacy@poli0981.dev',
  /** Terms, disclaimer, anything else legal. */
  legal: 'legal@poli0981.dev',
  /** Copyright (DMCA-style) notices about content on the site. */
  dmca: 'dmca@poli0981.dev',
  /** A developer asking for their listing or logo to be changed or removed. */
  takedown: 'takedown@poli0981.dev',
  /** Licensing of the code (GPL-3.0-only) and the dataset (CC BY-SA 4.0). */
  copyright: 'copyright@poli0981.dev',
  /** Code of Conduct reports. */
  conduct: 'code@poli0981.dev',
  press: 'press@poli0981.dev',
  collab: 'collab@poli0981.dev',
} as const;
