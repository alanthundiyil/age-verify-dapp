# Bouncer age-check demo

A minimal demo of what a real "bouncer scans a guest's phone" flow would
look like on top of the age-verify contract: two web pages, no app install.

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

# 2. One-time: deploy the contract and register a demo attestation provider
#    ("REEK" in our conversation — the trusted party whose signature the
#    contract accepts). Only needs to run once per devnet.
yarn demo:init

# 3. Repeatable: mark a guest's ID as verified 18+ on-chain (stand-in for
#    real KYC — see NOTES.md's "Known limitation"). Get <userId> from the
#    guest page below on first load, then run:
yarn demo:seed --userId <64 hex chars> --birthdate 2000-01-01

# 4. Backend (reads the indexer) and frontend, in two terminals
yarn demo:server
yarn demo:dev
```

Then open `http://localhost:5173/?role=guest` in one browser window/tab and
`http://localhost:5173/?role=bouncer` in another — two windows on the same
machine work fine and is the easiest way to try this.

## Trying the flow

1. On the guest page, copy the displayed ID and run `yarn demo:seed` with it
   (step 3 above) if you haven't already.
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
