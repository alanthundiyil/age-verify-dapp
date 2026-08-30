// The actual "REEK attests this guest's birthdate" logic, shared between
// the CLI (scripts/seed-verified-user.ts) and the admin page's backend
// endpoint (apps/demo/server.ts), so both go through the exact same code
// path instead of duplicating it.
import { submitCallTx } from '@midnight-ntwrk/midnight-js-contracts';
import { Bytes32Descriptor, transientHash } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { CompiledAgeVerifyContract, Contract, testAttestation } from '../contracts/index.js';
import { schnorrSign } from '../src/test/utils/schnorr.js';
import type { HelloWorldProviders } from '../src/providers.js';
import type { Deployment } from './deployment.js';

const PRIVATE_STATE_ID = 'DemoSeedAgeVerifyState';

export async function verifyGuest(
  providers: HelloWorldProviders,
  deployment: Deployment,
  userId: Uint8Array,
  birthTimestamp: bigint,
): Promise<void> {
  // buildProviders() creates a fresh, uniquely-named private-state store on
  // every process run (see src/providers.ts), so the contract's private
  // state — just `{}`, since everything real flows through the witnesses'
  // closure over testAttestation — needs registering here every run.
  providers.privateStateProvider.setContractAddress(deployment.contractAddress);
  await providers.privateStateProvider.set(PRIVATE_STATE_ID, {});

  const providerId = BigInt(deployment.providerId);
  const providerSk = BigInt(`0x${deployment.providerSk}`);
  const userIdHash = transientHash(Bytes32Descriptor, userId);
  testAttestation.value = {
    birthTimestamp,
    signature: schnorrSign(providerSk, [birthTimestamp, userIdHash]),
    providerId,
  };

  await submitCallTx<Contract, 'verifyAge'>(providers, {
    compiledContract: CompiledAgeVerifyContract,
    contractAddress: deployment.contractAddress,
    privateStateId: PRIVATE_STATE_ID,
    circuitId: 'verifyAge',
    args: [userId],
  });
}
