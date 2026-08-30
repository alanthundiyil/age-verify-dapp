// Simulates "REEK attested this guest's birthdate" for the bouncer demo
// (apps/demo/) — signs and submits verifyAge for one guest against the
// contract and provider set up by `yarn demo:init`. This is a stand-in for
// the real KYC UI this project doesn't have yet (see NOTES.md's "Known
// limitation").
//
// Usage: yarn demo:seed --userId <64 hex chars> --birthdate <YYYY-MM-DD>
import pino from 'pino';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { submitCallTx } from '@midnight-ntwrk/midnight-js-contracts';
import { Bytes32Descriptor, transientHash } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import type { EnvironmentConfiguration } from '@midnight-ntwrk/testkit-js';
import { getConfig } from '../src/config.js';
import { MidnightWalletProvider, syncWallet } from '../src/wallet.js';
import { buildProviders, type HelloWorldProviders } from '../src/providers.js';
import { CompiledAgeVerifyContract, Contract, testAttestation, zkConfigPath } from '../contracts/index.js';
import { schnorrSign } from '../src/test/utils/schnorr.js';
import { readDeployment } from './deployment.js';

// Must match src/test/age-verify.test.ts.
const ALICE_LOCAL_SEED = '0000000000000000000000000000000000000000000000000000000000000001';
const PRIVATE_STATE_ID = 'DemoSeedAgeVerifyState';

function parseArgs(argv: string[]): { userId: string; birthdate: string } {
  const values: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') continue;
    if (arg.startsWith('--')) {
      values[arg.slice(2)] = argv[i + 1];
      i++;
    }
  }
  if (!values.userId || !/^[0-9a-fA-F]{64}$/.test(values.userId)) {
    throw new Error('--userId must be 64 hex characters (32 bytes)');
  }
  if (!values.birthdate || Number.isNaN(Date.parse(values.birthdate))) {
    throw new Error('--birthdate must be a parseable date, e.g. 2000-01-01');
  }
  return { userId: values.userId, birthdate: values.birthdate };
}

const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  transport: { target: 'pino-pretty' },
});

const { userId: userIdHex, birthdate } = parseArgs(process.argv.slice(2));
const userId = Uint8Array.from(Buffer.from(userIdHex, 'hex'));
const birthTimestamp = BigInt(Math.floor(Date.parse(birthdate) / 1000));

const deployment = await readDeployment();
if (!deployment) {
  throw new Error('No deployment.json found — run "yarn demo:init" first.');
}

const config = getConfig();
setNetworkId(config.networkId);
const envConfig: EnvironmentConfiguration = { walletNetworkId: config.networkId, ...config };

const wallet = await MidnightWalletProvider.build(logger, envConfig, { kind: 'seed', value: ALICE_LOCAL_SEED });
await wallet.start();

try {
  logger.info('Syncing wallet...');
  await syncWallet(logger, wallet.wallet);
  const providers: HelloWorldProviders = buildProviders(wallet, zkConfigPath, config);

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

  logger.info(`Submitting verifyAge for userId ${userIdHex} (birthdate ${birthdate})...`);
  await submitCallTx<Contract, 'verifyAge'>(providers, {
    compiledContract: CompiledAgeVerifyContract,
    contractAddress: deployment.contractAddress,
    privateStateId: PRIVATE_STATE_ID,
    circuitId: 'verifyAge',
    args: [userId],
  });

  logger.info(`Done. ${userIdHex} is now verified 18+ on ${deployment.contractAddress}.`);
} finally {
  await wallet.stop().catch((err: unknown) => logger.warn(`stop() failed: ${String(err)}`));
}
