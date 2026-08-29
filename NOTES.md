# Age Verify — Project Notes

A privacy-preserving age verification smart contract built on [Midnight
Network](https://midnight.network), using zero-knowledge proofs so a user can
prove they're over a minimum age **without revealing their birthdate or exact
age**.

This started as a fork of Midnight's official `example-hello-world` template
and was renamed/rebuilt into this project.

---

## What the contract does

The app only ever shows one of two states: **Verified** or **Not verified**.
It never shows or stores:
- the user's exact birthdate
- the user's exact age

### The user flow

1. User opens the app and taps "Verify age"
2. The app gets a Schnorr-signed birthdate attestation from a trusted
   provider (see [Provider registry and admin
   role](#provider-registry-and-admin-role) below; who that provider is in
   practice is still open — see [Known
   limitation](#known-limitation-identity-sourcing))
3. A zero-knowledge proof is generated **on the user's own device**, proving
   "birthdate + 18 years is in the past, and this attestation is genuinely
   signed by a registered provider" — without the birthdate itself ever
   leaving the device
4. This proof is submitted as a transaction to the Midnight network
5. If the proof is valid, the contract stores `true` for that user's ID —
   app shows **Verified**
6. If the user is underage, proof generation itself fails and no transaction
   is ever submitted — app shows **Not verified**

## How age verification actually works

```compact
witness getAttestedBirthWitness(): [Uint<64>, Schnorr_SchnorrSignature, Uint<16>];

export circuit verifyAge(userId: Bytes<32>): [] {
  const [birthTimestamp, signature, providerId] = getAttestedBirthWitness();

  assert(providers.member(disclose(providerId)), "Attestation provider not registered");
  const providerPk = providers.lookup(disclose(providerId));

  const userIdHash: Field = transientHash<Bytes<32>>(userId);
  const msg: Vector<2, Field> = [disclose(birthTimestamp) as Field, userIdHash];
  Schnorr_schnorrVerify<2>(msg, signature, providerPk);

  const minAgeSeconds = 18 * 365 * 24 * 60 * 60;
  const cutoff = (birthTimestamp + minAgeSeconds) as Uint<64>;
  assert(blockTimeGte(disclose(cutoff)), "User does not meet minimum age requirement");
  verifiedUsers.insert(disclose(userId), true);
}
```

**`witness getAttestedBirthWitness()`** — supplied locally by the user's own
app/device, never sent to the network: the birthdate a trusted attestation
provider signed, the Schnorr signature itself, and which registered provider
produced it.

**Signature verification** — before trusting the birthdate at all, the
circuit checks that `providerId` is a provider the contract admin has
registered (see [Provider registry](#provider-registry-and-admin-role)
below), then verifies the Schnorr signature over `[birthTimestamp,
transientHash(userId)]` against that provider's public key. Hashing `userId`
into the signed message binds the attestation to *this* identity, so a
signature issued for one user can't be replayed to verify a different one.
This is what closes the old fraud gap — see
[Known limitation](#known-limitation-identity-sourcing) below.

**`blockTimeGte(x)`** — checks the *actual current time on the blockchain*
(not something the user can fake) and returns true if it's on/after `x`. This
is the key trick: instead of asking the user "what's today's date?" (which
they could lie about), the contract computes a cutoff timestamp
(`birthdate + 18 years`) and asks the *chain* whether that moment has already
passed.

**`disclose(...)`** — Compact requires explicitly acknowledging any time a
value derived from private data (like the cutoff, derived from birthdate, or
the provider/user IDs used as ledger map keys) is used somewhere that could
leak information about it or becomes a public ledger operation. This is a
safety feature, not a bug — it stops accidental private-data leaks at compile
time.

**No explicit "false" is ever stored.** If either `assert` fails — bad
signature or too young — proof generation fails, and the transaction never
gets submitted at all. "Not verified" = no transaction happened, not a stored
`false` value.

## Provider registry and admin role

Modeled on Midnight's official
[`example-zkloan`](https://github.com/midnightntwrk/example-zkloan) reference
app (its `schnorr.compact` polyfill is vendored verbatim into
[`contracts/schnorr.compact`](contracts/schnorr.compact), since
`jubjubSchnorrVerify` isn't yet in the compiler's standard library):

- `providers: Map<Uint<16>, JubjubPoint>` — the registry of trusted
  attestation providers' public keys, keyed by an admin-assigned ID.
- `contractAdmin: Bytes<32>` — set once in the constructor to
  `deriveAdminPublicKey(getAdminSecret())`. Deliberately *not* derived from
  `ownPublicKey()`, which is a value the prover merely claims with no
  cryptographic binding to whoever actually holds the corresponding secret.
- `registerProvider(providerId, providerPk)` / `removeProvider(providerId)` —
  admin-gated circuits (`assert(contractAdmin == deriveAdminPublicKey(getAdminSecret()), ...)`)
  for managing the registry.

## Known limitation: identity-sourcing

**The signature-verification mechanism is now real, but who's allowed to
*be* a registered attestation provider is still unresolved.** `verifyAge`
now genuinely rejects a forged or self-attested birthdate — see the
simulator tests in
[`src/test/age-verify.simulator.test.ts`](src/test/age-verify.simulator.test.ts)
for tampered signatures, unregistered providers, and cross-user replay.
What's still open is which real-world identity/KYC provider actually earns a
slot in the `providers` registry, and how that registration process itself
is secured — see [Open questions](#open-questions--next-steps).

## Project structure

```
age-verify-dapp/
├── contracts/
│   ├── age-verify.compact             # the Compact contract (source of truth)
│   ├── schnorr.compact                # vendored Schnorr-on-Jubjub polyfill (from example-zkloan)
│   ├── index.ts                       # wires up the compiled contract + witness implementation
│   └── managed/age-verify/            # compiler output (generated — don't hand-edit)
├── src/
│   ├── test/age-verify.test.ts            # deploy + register + verify + reject, run against local devnet
│   ├── test/age-verify.simulator.ts       # in-memory circuit simulator, no devnet needed
│   ├── test/age-verify.simulator.test.ts  # fast edge-case coverage (forged sigs, replay, admin auth, ...)
│   ├── test/utils/schnorr.ts              # off-chain Schnorr signing helpers for tests
│   ├── wallet.ts, providers.ts, config.ts   # from original hello-world scaffolding
├── package.json
```

## How to run things

```bash
# compile the contract
yarn compile

# start the local devnet (node + indexer + proof server) — separate terminal, leave running
yarn env:up

# run the test suite against it
yarn test:local

# tear down the local devnet when done
yarn env:down
```

## Test coverage today

Devnet integration (`src/test/age-verify.test.ts`, needs `yarn env:up`):

| Test | What it checks |
|---|---|
| Deploys the contract | Contract deploys cleanly, constructor sets `contractAdmin` |
| Registers the trusted attestation provider | `registerProvider` succeeds, `providers` map shows the new entry |
| Verifies an adult user (should succeed) | Birthdate from year 2000, validly signed → proof succeeds, `verifiedUsers` shows `true` |
| Rejects an underage user (should fail) | Birthdate from ~1 minute ago, validly signed → age-check assertion fails, no transaction submitted |

Fast simulator suite (`src/test/age-verify.simulator.test.ts`, no devnet needed):

| Test | What it checks |
|---|---|
| Default provider registered / empty ledger | Initial state after construction |
| Verifies an adult with a valid attestation | Happy path, in-memory |
| Rejects an underage user (valid signature) | Pure age-check failure |
| Rejects a tampered signature | Schnorr verification catches a modified response |
| Rejects an unregistered provider | `providers.member` check |
| Rejects after a provider is removed | Registry removal takes effect immediately |
| Rejects cross-user replay | Signature for user A's id fails for user B (`transientHash(userId)` binding) |
| Non-admin `registerProvider` / `removeProvider` | Admin-secret authorization enforced |

## Open questions / next steps

- [x] Replace self-attested witness with signed attestation (see above)
- [ ] Decide on the actual Android frontend approach (deferred — options
      discussed: hybrid/Capacitor wrapping a JS frontend using `midnight-js`
      directly, React Native, or a fully native Kotlin app using the
      community **Kuira Android SDK**, which supports on-device ZK proving)
- [ ] Decide on real-world identity sourcing for the attestation service
      (who actually verifies the birthdate before it gets signed, and who's
      allowed to call `registerProvider` in production — see
      [Known limitation](#known-limitation-identity-sourcing))
- [ ] Security review pass before any real deployment (see Midnight's
      `security` skill / smart contract security docs — witness trust,
      commitment/nullifier design, front-running resistance)