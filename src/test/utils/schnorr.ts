// Off-chain Schnorr signing helpers for the trusted attestation service,
// mirroring the on-chain verification in contracts/schnorr.compact. Adapted
// from example-zkloan's contract/src/test/utils/test-data.ts.
import { ecMulGenerator, type JubjubPoint } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import * as crypto from 'crypto';
import { pureCircuits, type Schnorr_SchnorrSignature } from '../../../contracts/index.js';

const JUBJUB_ORDER = 6554484396890773809930967563523245729705921265872317281365359162392183254199n;
const TWO_248 = 452312848583266388373324160190187140051835877600158453279131187530910662656n;

export function randomScalar(): bigint {
  const bytes = crypto.randomBytes(32);
  return BigInt('0x' + bytes.toString('hex')) % JUBJUB_ORDER;
}

export function generateProviderKeyPair(): { sk: bigint; pk: JubjubPoint } {
  const sk = randomScalar();
  const pk = ecMulGenerator(sk);
  return { sk, pk };
}

// msg must be exactly [birthTimestamp, userIdHash] to match the 2-field
// Vector the circuit's schnorrChallenge<2> re-export expects.
export function schnorrSign(sk: bigint, msg: [bigint, bigint]): Schnorr_SchnorrSignature {
  const pk = ecMulGenerator(sk);
  const k = randomScalar();
  const R = ecMulGenerator(k);
  const cFull = pureCircuits.schnorrChallenge(R.x, R.y, pk.x, pk.y, msg);
  const c = cFull % TWO_248;
  const s = (((k + c * sk) % JUBJUB_ORDER) + JUBJUB_ORDER) % JUBJUB_ORDER;
  return { announcement: R, response: s };
}
