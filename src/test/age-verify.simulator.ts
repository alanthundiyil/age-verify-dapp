// Fast, in-memory simulator for the age-verify contract's circuits — no
// Docker/devnet required. Mirrors example-zkloan's
// contract/src/test/zkloan-credit-scorer.simulator.ts pattern: it runs the
// compiled contract directly against a local CircuitContext instead of going
// through the CompiledContract/deploy/submitCallTx flow that
// contracts/index.ts wires up for the real devnet integration test.
import {
  type CircuitContext,
  createConstructorContext,
  createCircuitContext,
  sampleContractAddress,
  transientHash,
  Bytes32Descriptor,
  type JubjubPoint,
} from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import {
  Contract,
  type Ledger,
  ledger,
  type Schnorr_SchnorrSignature,
} from '../../contracts/index.js';
import * as crypto from 'crypto';
import { generateProviderKeyPair, schnorrSign } from './utils/schnorr.js';

export type AgeVerifyPrivateState = {
  adminSecret: Uint8Array;
  birthTimestamp: bigint;
  signature: Schnorr_SchnorrSignature;
  providerId: bigint;
};

const witnesses = {
  getAdminSecret: ({ privateState }: { privateState: AgeVerifyPrivateState }): [AgeVerifyPrivateState, Uint8Array] => [
    privateState,
    privateState.adminSecret,
  ],
  getAttestedBirthWitness: (
    { privateState }: { privateState: AgeVerifyPrivateState },
  ): [AgeVerifyPrivateState, [bigint, Schnorr_SchnorrSignature, bigint]] => [
    privateState,
    [privateState.birthTimestamp, privateState.signature, privateState.providerId],
  ],
  getSchnorrReduction: (
    { privateState }: { privateState: AgeVerifyPrivateState },
    challengeHash: bigint,
  ): [AgeVerifyPrivateState, [bigint, bigint]] => {
    const TWO_248 = 452312848583266388373324160190187140051835877600158453279131187530910662656n;
    return [privateState, [challengeHash / TWO_248, challengeHash % TWO_248]];
  },
};

const NO_ATTESTATION: Pick<AgeVerifyPrivateState, 'birthTimestamp' | 'signature' | 'providerId'> = {
  birthTimestamp: 0n,
  signature: { announcement: { x: 0n, y: 0n }, response: 0n },
  providerId: 0n,
};

export class AgeVerifySimulator {
  readonly contract: Contract<AgeVerifyPrivateState>;
  circuitContext: CircuitContext<AgeVerifyPrivateState>;
  readonly adminSecret: Uint8Array;
  readonly providerSk: bigint;
  readonly providerPk: JubjubPoint;
  readonly providerId: bigint = 1n;

  // `witnessOverrides` lets a test swap in a malicious witness implementation
  // while keeping the rest honest — e.g. a forged Schnorr reduction.
  constructor(witnessOverrides: Partial<typeof witnesses> = {}) {
    this.contract = new Contract<AgeVerifyPrivateState>({ ...witnesses, ...witnessOverrides });

    this.adminSecret = new Uint8Array(crypto.randomBytes(32));
    const { sk, pk } = generateProviderKeyPair();
    this.providerSk = sk;
    this.providerPk = pk;

    const initialPrivateState: AgeVerifyPrivateState = {
      adminSecret: this.adminSecret,
      ...NO_ATTESTATION,
    };

    const dummyCoinPublicKey = '11'.repeat(32);
    const { currentPrivateState, currentContractState, currentZswapLocalState } = this.contract.initialState(
      createConstructorContext(initialPrivateState, dummyCoinPublicKey),
    );
    this.circuitContext = createCircuitContext(
      sampleContractAddress(),
      currentZswapLocalState,
      currentContractState,
      currentPrivateState,
    );

    this.registerProvider(this.providerId, this.providerPk);
  }

  // Sets up the private state for a `verifyAge(userId)` call attested by
  // `providerSk`/`providerId`, binding the signature to `userId` exactly as
  // the circuit does via `transientHash<Bytes<32>>(userId)`.
  attestBirth(userId: Uint8Array, birthTimestamp: bigint, providerSk: bigint = this.providerSk, providerId: bigint = this.providerId): void {
    const userIdHash = transientHash(Bytes32Descriptor, userId);
    const signature = schnorrSign(providerSk, [birthTimestamp, userIdHash]);
    this.circuitContext = {
      ...this.circuitContext,
      currentPrivateState: {
        ...this.circuitContext.currentPrivateState,
        birthTimestamp,
        signature,
        providerId,
      },
    };
  }

  // Swaps the simulator's admin secret. Tests use this to act as a caller
  // who does not hold the secret `contractAdmin` was derived from at
  // construction, so admin-gated circuits should reject them.
  setAdminSecret(secret: Uint8Array): void {
    this.circuitContext = {
      ...this.circuitContext,
      currentPrivateState: { ...this.circuitContext.currentPrivateState, adminSecret: secret },
    };
  }

  tamperSignatureResponse(delta: bigint): void {
    const current = this.circuitContext.currentPrivateState;
    this.circuitContext = {
      ...this.circuitContext,
      currentPrivateState: {
        ...current,
        signature: { ...current.signature, response: current.signature.response + delta },
      },
    };
  }

  getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  verifyAge(userId: Uint8Array): Ledger {
    this.circuitContext = this.contract.impureCircuits.verifyAge(this.circuitContext, userId).context;
    return this.getLedger();
  }

  registerProvider(providerId: bigint, providerPk: JubjubPoint): Ledger {
    this.circuitContext = this.contract.impureCircuits.registerProvider(
      this.circuitContext,
      providerId,
      providerPk,
    ).context;
    return this.getLedger();
  }

  removeProvider(providerId: bigint): Ledger {
    this.circuitContext = this.contract.impureCircuits.removeProvider(this.circuitContext, providerId).context;
    return this.getLedger();
  }
}
