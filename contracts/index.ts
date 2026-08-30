import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import path from 'node:path';
import {
  type Schnorr_SchnorrSignature,
} from './managed/age-verify/contract/index.js';

export {
  Contract,
  ledger,
  pureCircuits,
  type Ledger,
  type ImpureCircuits,
  type PureCircuits,
  type Schnorr_SchnorrSignature,
} from './managed/age-verify/contract/index.js';   // was: managed/hello-world
import { Contract } from './managed/age-verify/contract/index.js';

const currentDir = path.resolve(new URL(import.meta.url).pathname, '..');
export const zkConfigPath = path.resolve(currentDir, 'managed', 'age-verify'); // was: 'hello-world'

const TWO_248 = 452312848583266388373324160190187140051835877600158453279131187530910662656n;

// Fixed test-only admin secret. In a real deployment this would be a secret
// held by whoever operates the trusted attestation service; here it's a
// shared constant so tests can both deploy (constructor derives
// `contractAdmin` from it) and call admin-gated circuits (registerProvider).
export const testAdminSecret = new Uint8Array(32).fill(1);

export const testAttestation = {
  value: {
    birthTimestamp: 0n,
    signature: { announcement: { x: 0n, y: 0n }, response: 0n } as Schnorr_SchnorrSignature,
    providerId: 0n,
  },
};

export const CompiledAgeVerifyContract = CompiledContract.make(  // renamed from CompiledHelloWorldContract
  'AgeVerifyContract',
  Contract,
).pipe(
  CompiledContract.withWitnesses({
    getAdminSecret: (context: any) => [context.privateState, testAdminSecret],
    getAttestedBirthWitness: (context: any) => [
      context.privateState,
      [testAttestation.value.birthTimestamp, testAttestation.value.signature, testAttestation.value.providerId],
    ],
    // Divides the Schnorr challenge hash by 2^248 so the circuit can truncate
    // it to fit Jubjub's scalar field — see contracts/schnorr.compact.
    getSchnorrReduction: (context: any, challengeHash: bigint) => [
      context.privateState,
      [challengeHash / TWO_248, challengeHash % TWO_248],
    ],
  }),
  CompiledContract.withCompiledFileAssets(zkConfigPath),
);