// Simulates "REEK attested this guest's birthdate" for the bouncer demo
// (apps/demo/) — signs and submits verifyAge for one guest against the
// contract and provider set up by `yarn demo:init`. This is a stand-in for
// the real KYC UI this project doesn't have yet (see NOTES.md's "Known
// limitation").
//
// Usage: yarn demo:seed --userId <64 hex chars> --birthdate <YYYY-MM-DD>
import pino from 'pino';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import type { EnvironmentConfiguration } from '@midnight-ntwrk/testkit-js';
import { getConfig } from '../src/config.js';
import { MidnightWalletProvider, syncWallet } from '../src/wallet.js';
import { buildProviders, type HelloWorldProviders } from '../src/providers.js';
import { zkConfigPath } from '../contracts/index.js';
import { readDeployment } from './deployment.js';
import { verifyGuest } from './verify-guest.js';

// Must match src/test/age-verify.test.ts.
const ALICE_LOCAL_SEED = '0000000000000000000000000000000000000000000000000000000000000001';

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

  logger.info(`Submitting verifyAge for userId ${userIdHex} (birthdate ${birthdate})...`);
  await verifyGuest(providers, deployment, userId, birthTimestamp);

  logger.info(`Done. ${userIdHex} is now verified 18+ on ${deployment.contractAddress}.`);
} finally {
  await wallet.stop().catch((err: unknown) => logger.warn(`stop() failed: ${String(err)}`));
}
