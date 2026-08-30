# Midnight Bouncer

*Checks your age. Keeps your secrets.*

A privacy-preserving age verification dApp built on [Midnight
Network](https://midnight.network). Prove you're 18+ using zero-knowledge
proofs — without ever revealing your birthdate, your exact age, or your
identity, to the app or to the blockchain itself.

## What's here

- **A Compact smart contract** ([`contracts/age-verify.compact`](contracts/age-verify.compact))
  that verifies a Schnorr-signed birthdate attestation from a trusted
  provider, then checks it against the chain's own block time — never a
  user-supplied "today's date." See [NOTES.md](NOTES.md) for the full
  technical walkthrough.
- **Midnight Bouncer**, an installable demo app ([`apps/demo/`](apps/demo/))
  showing what this looks like in practice: a bouncer scans a guest's phone
  and sees "Verified 18+," live, via a QR-based challenge-response that
  can't be replayed from a screenshot. See [apps/demo/README.md](apps/demo/README.md)
  to run it.

## Quick start

```bash
# install dependencies
yarn install

# compile the contract
yarn compile

# start the local devnet (node + indexer + proof server)
yarn env:up

# run the full test suite against it (13 tests: contract, attestation, edge cases)
yarn test:local

# tear down the local devnet when done
yarn env:down
```

Prefer a fast, no-devnet test run first?

```bash
npx vitest run src/test/age-verify.simulator.test.ts
```

To run the demo app:

```bash
yarn demo:init      # one-time: deploy the contract, register a demo attestation provider
yarn demo:server    # backend, in one terminal
yarn demo:dev       # frontend, in another — open http://localhost:5173
```

See [apps/demo/README.md](apps/demo/README.md) for the full walkthrough
(seeding a guest, the QR flow, installing it as a PWA).

## How it works, briefly

- The contract never stores or reveals a birthdate or exact age — only a
  boolean, per user ID, on a public ledger map.
- A trusted attestation provider Schnorr-signs a birthdate off-chain; the
  circuit verifies that signature on-chain before ever checking the age
  math, binding the signature to the specific user ID so it can't be
  replayed for someone else.
- The provider registry itself is admin-managed on-chain, with the admin
  role derived from a witness-held secret — not the spoofable `ownPublicKey()`.

Full technical detail — the actual circuit code, why each `disclose()` is
where it is, the provider registry/admin design, test coverage, and open
questions — is in [NOTES.md](NOTES.md).

## Project structure

```
age-verify-dapp/
├── contracts/            # the Compact contract + compiled output
├── src/                  # wallet/provider plumbing + contract tests
├── apps/demo/            # the installable Midnight Bouncer demo app
├── scripts/              # devnet setup/seeding scripts for the demo
└── NOTES.md              # full technical write-up
```

## Known limitations

This is a working proof of concept, not a production system:

- The "trusted attestation provider" is simulated for the demo — no real
  KYC/identity integration exists yet.
- The demo's live QR check proves the *device* holding a verified identity
  is present, not that it's specifically its original owner.

See [NOTES.md's known-limitation section](NOTES.md#known-limitation-identity-sourcing)
for the full list.

## License

Licensed under [Apache-2.0](LICENSE) — inherited from the Midnight
`example-hello-world` template this project was originally built on.
