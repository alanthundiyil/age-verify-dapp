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
2. The app asks the user's device for their birthdate (currently: just
   entered locally — see [Known limitation](#known-limitation-self-attested-birthdate) below)
3. A zero-knowledge proof is generated **on the user's own device**, proving
   "birthdate + 18 years is in the past" — without the birthdate itself ever
   leaving the device
4. This proof is submitted as a transaction to the Midnight network
5. If the proof is valid, the contract stores `true` for that user's ID —
   app shows **Verified**
6. If the user is underage, proof generation itself fails and no transaction
   is ever submitted — app shows **Not verified**

## How age verification actually works

```compact
witness localBirthTimestamp(): Uint<64>;

export circuit verifyAge(userId: Bytes<32>): [] {
  const birthTimestamp = localBirthTimestamp();
  const minAgeSeconds = 18 * 365 * 24 * 60 * 60;
  const cutoff = (birthTimestamp + minAgeSeconds) as Uint<64>;
  assert(blockTimeGte(disclose(cutoff)), "User does not meet minimum age requirement");
  verifiedUsers.insert(disclose(userId), true);
}
```

**`witness localBirthTimestamp()`** — a value supplied locally by the user's
own app/device, never sent to the network. In Compact, this is how you feed
private, off-chain information into a circuit.

**`blockTimeGte(x)`** — checks the *actual current time on the blockchain*
(not something the user can fake) and returns true if it's on/after `x`. This
is the key trick: instead of asking the user "what's today's date?" (which
they could lie about), the contract computes a cutoff timestamp
(`birthdate + 18 years`) and asks the *chain* whether that moment has already
passed.

**`disclose(cutoff)`** — Compact requires explicitly acknowledging any time a
value derived from private data (like the cutoff, derived from birthdate) is
used somewhere that could leak information about it. Here, comparing the
cutoff against the public clock technically reveals a little info (roughly
"was this person's 18th birthday before or after block time X"), so Compact
forces us to consciously opt into that with `disclose()`. This is a safety
feature, not a bug — it stops accidental private-data leaks at compile time.

**No explicit "false" is ever stored.** If the `assert` fails, proof
generation fails, and the transaction never gets submitted at all. "Not
verified" = no transaction happened, not a stored `false` value.

## Known limitation: self-attested birthdate

**Right now, `localBirthTimestamp()` just trusts whatever value the app gives
it — there is no fraud resistance yet.** A malicious user could make their
own app return a fake birthdate, and the contract has no way to detect this.
This version proves the *mechanism* (private input → ZK proof → on-chain
pass/fail) works correctly, but is **not safe for real use** as-is.

### Planned upgrade: signed attestation

The fix, modeled on Midnight's official
[`example-zkloan`](https://github.com/midnightntwrk/example-zkloan) reference
app: instead of trusting a bare witness value, a **trusted attestation
service** (a stand-in for a real identity/KYC provider) signs the user's
birthdate with a Schnorr signature (on the Jubjub curve). The circuit then:

1. Verifies that signature on-chain via `jubjubSchnorrVerify`, proving the
   birthdate really came from the registered trusted provider
2. Only then runs the same `blockTimeGte` age check as today

This closes the fraud gap: a user can no longer just invent a birthdate,
since it has to be signed by an authority the contract explicitly trusts
(registered once via a `registerProvider` circuit).

This is the next planned step, not yet implemented.

## Project structure

```
age-verify-dapp/
├── contracts/
│   ├── age-verify.compact         # the Compact contract (source of truth)
│   ├── index.ts                   # wires up the compiled contract + witness implementation
│   └── managed/age-verify/        # compiler output (generated — don't hand-edit)
├── src/
│   ├── test/age-verify.test.ts    # deploy + verify + reject tests, run against local devnet
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

| Test | What it checks |
|---|---|
| Deploys the contract | Contract deploys cleanly, initial ledger state is empty |
| Verifies an adult user (should succeed) | Birthdate from year 2000 → proof succeeds, `verifiedUsers` map shows `true` |
| Rejects an underage user (should fail) | Birthdate from ~1 minute ago → proof generation fails, transaction never submitted |

## Open questions / next steps

- [ ] Replace self-attested witness with signed attestation (see above)
- [ ] Decide on the actual Android frontend approach (deferred — options
      discussed: hybrid/Capacitor wrapping a JS frontend using `midnight-js`
      directly, React Native, or a fully native Kotlin app using the
      community **Kuira Android SDK**, which supports on-device ZK proving)
- [ ] Decide on real-world identity sourcing for the attestation service
      (who actually verifies the birthdate before it gets signed?)
- [ ] Security review pass before any real deployment (see Midnight's
      `security` skill / smart contract security docs — witness trust,
      commitment/nullifier design, front-running resistance)