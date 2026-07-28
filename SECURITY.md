# Security Policy

## Supported versions

The **latest deploy** of `https://softharbor.net` is the only supported
target. This is a continuously deployed static site; there are no released
versions to patch (docs/13 §1).

## Reporting a vulnerability

Please use **GitHub's private vulnerability reporting** on this repository
(Security → Report a vulnerability), or email `contact@softharbor.net`.

Acknowledgement within **72 hours**. Machine-readable contact details are in
[`/.well-known/security.txt`](https://softharbor.net/.well-known/security.txt).

## Scope

**In scope**

- The site, its build, and its GitHub Actions workflows.
- **The dataset.** Reports that a listed app is malicious, that a download
  link has been hijacked or typosquatted, or that an entry points somewhere
  other than the developer's official page are explicitly welcome — that is
  the risk this project actually carries (docs/09 T1/T2). They are handled
  through the quarantine flow: the entry is moved out of the live tree and a
  tracking issue records the evidence, rather than being deleted
  (docs/03 §5, hard rule 5).

**Out of scope**

- Vulnerabilities in the **listed third-party applications themselves**.
  Report those to their vendors — but please tell us too, so we can flag the
  entry while it is unresolved.
- Anything requiring a server: there is no backend, no database, no accounts,
  no cookies, and no user input parsing (docs/09 §3).

## What we do not claim

A `security.status` of `clean` means a documented checklist found nothing on
the date shown (docs/09 §6). It is not an audit, a certification, or a
guarantee — see the [Disclaimer](https://softharbor.net/legal/disclaimer).
