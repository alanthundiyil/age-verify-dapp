// One-time setup for the bouncer demo (apps/demo/): deploys the age-verify
// contract and registers a demo attestation provider ("REEK" in our
// conversation) — the trusted party whose signature the contract accepts.
// Run this once per devnet; yarn demo:seed handles verifying individual
// guests against it afterward.
//
// Usage: yarn demo:init
import pino from 'pino';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { deployContract, submitCallTx, type DeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import type { EnvironmentConfiguration } from '@midnight-ntwrk/testkit-js';
import { getConfig } from '../src/config.js';
import { MidnightWalletProvider, syncWallet } from '../src/wallet.js';
import { buildProviders, type HelloWorldProviders } from '../src/providers.js';
import { CompiledAgeVerifyContract, Contract, zkConfigPath } from '../contracts/index.js';
import { generateProviderKeyPair } from '../src/test/utils/schnorr.js';
import { readDeployment, writeDeployment, deploymentPath } from './deployment.js';

// Must match src/test/age-verify.test.ts.
const ALICE_LOCAL_SEED = '0000000000000000000000000000000000000000000000000000000000000001';
const PRIVATE_STATE_ID = 'DemoInitAgeVerifyState';
const DEFAULT_PROVIDER_ID = 1n;

const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  transport: { target: 'pino-pretty' },
});

const existing = await readDeployment();
if (existing) {
  throw new Error(
    `Already initialized: ${deploymentPath} exists (contract ${existing.contractAddress}). ` +
      'Delete that file first if you really want to deploy a fresh contract.',
  );
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

  logger.info('Deploying the age-verify contract...');
  const deployed: DeployedContract<Contract> = await deployContract<Contract>(providers, {
    compiledContract: CompiledAgeVerifyContract,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: {},
  });
  const contractAddress = deployed.deployTxData.public.contractAddress;
  logger.info(`Deployed at ${contractAddress}`);

  const provider = generateProviderKeyPair();
  logger.info('Registering the demo attestation provider ("REEK")...');
  await submitCallTx<Contract, 'registerProvider'>(providers, {
    compiledContract: CompiledAgeVerifyContract,
    contractAddress,
    privateStateId: PRIVATE_STATE_ID,
    circuitId: 'registerProvider',
    args: [DEFAULT_PROVIDER_ID, provider.pk],
  });

  await writeDeployment({
    contractAddress,
    providerId: DEFAULT_PROVIDER_ID.toString(),
    providerSk: provider.sk.toString(16),
  });
  logger.info(`Wrote ${deploymentPath}`);
  logger.info('Done. Run: yarn demo:seed --userId <64 hex chars> --birthdate <YYYY-MM-DD>');
} finally {
  await wallet.stop().catch((err: unknown) => logger.warn(`stop() failed: ${String(err)}`));
}
