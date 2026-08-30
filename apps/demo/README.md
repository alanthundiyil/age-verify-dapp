# Midnight Bouncer

*Checks your age. Keeps your secrets.*

A minimal demo of what a real "bouncer scans a guest's phone" flow would
look like on top of the age-verify contract: two web pages, installable as
a Progressive Web App (PWA) on a phone's home screen — no app store needed.

It solves a specific problem a static "I'm verified" QR code can't: proving
the phone being scanned, right now, actually controls the identity that's
marked verified on-chain — not just replaying a screenshot. See
[NOTES.md](../../NOTES.md) for how the underlying on-chain verification
works; this demo adds a second, separate signature layer purely for that
live liveness check (an ordinary ECDSA P-256 keypair per guest, unrelated to
the Jubjub/Schnorr attestation signature the contract verifies).

## Running it

```bash
# 1. Local devnet, same as the contract tests
yarn env:up

# 2. One-time: deploy the contract and register a demo attestation
#    provider — the trusted party whose signature the contract accepts.
#    Only needs to run once per devnet.
yarn demo:init

# 3. Backend and frontend, in two terminals
yarn demo:server
yarn demo:dev
```

Repeatable: mark a guest's ID as verified 18+ on-chain (stand-in for real
KYC — see NOTES.md's "Known limitation"). Get `<userId>` from the guest
page below on first load, then either:

- open `http://localhost:5173/?role=admin` and use the form (see "The
  admin page" below), or
- run `yarn demo:seed --userId <64 hex chars> --birthdate 2000-01-01` from
  a terminal, if you'd rather script it.

Both do the exact same thing under the hood.

Then open `http://localhost:5173/?role=guest` in one browser window/tab and
`http://localhost:5173/?role=bouncer` in another — two windows on the same
machine work fine and is the easiest way to try this.

## Installing it as an app

Since this is a PWA, a phone (or desktop Chrome) can install it like a real
app instead of just bookmarking a tab: open `http://localhost:5173/` (or a
real deployed URL — installability needs `https:` or `localhost`), then use
the browser's **"Add to Home Screen"** (iOS Safari) or **"Install app"**
(Chrome/Edge) option. It installs as **Midnight Bouncer**, with its own icon
and no browser chrome, and offers two shortcuts (long-press the icon on
Android, or right-click it on desktop) straight to the guest and bouncer
views. `yarn demo:dev` runs the PWA in dev mode already — no build step
needed to try installing it locally.

## The admin page

`http://localhost:5173/?role=admin` is the trusted attestation provider's
internal tool — the page itself explains what it's doing and why it's kept
separate from the guest page. Deliberately **not** linked
prominently from anywhere a real guest would see; it's reachable via a
small link on the landing page for demo convenience only. The backend only
accepts `/api/verify-guest` requests from `localhost` (see
`apps/demo/server.ts`), since unlike the read-only `/api/verified`
endpoint, this one can mark any ID as verified for any birthdate typed in.

## Trying the flow

1. On the guest page, copy the displayed ID and verify it (via the admin
   page or `yarn demo:seed`, above) if you haven't already.
2. On the bouncer page, click **"1. Start new check"** — shows a challenge QR.
3. On the guest page, click **"Show my badge to a bouncer"**, point its
   camera at the bouncer's challenge QR. It signs the challenge and shows a
   response QR.
4. Back on the bouncer page, click **"2. Scan guest's badge"** and point its
   camera at the guest's response QR. It should show **✅ Verified 18+**.
5. Try it again with a guest identity that was never seeded (open a private/
   incognito window, or click "Forget this identity" on the guest page) —
   the bouncer page should show **❌ Not verified**.

## Limitations

- **Camera access needs a secure context** (`https:` or `localhost`).
  Two browser windows on one machine against `localhost` works with no
  setup; demoing across two separate physical phones over a network would
  need HTTPS or a tunnel (e.g. `ngrok`) — not set up here.
- **The "get verified" step is a script, not a UI**, standing in for a real
  KYC integration that doesn't exist yet (see NOTES.md).
- **The backend is a single unauthenticated read endpoint** with no rate
  limiting — fine for a local demo, not for production.
