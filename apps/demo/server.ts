// Minimal read-only backend for the bouncer demo: exposes
// GET /api/verified?userId=<hex> by querying the indexer directly — no
// wallet, no proving, since checking `verifiedUsers.member(userId)` is a
// pure read. Reuses the exact same publicDataProvider + ledger() pattern
// already proven in src/test/age-verify.test.ts.
import { createServer, type IncomingMessage } from 'node:http';
import pino from 'pino';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import type { EnvironmentConfiguration } from '@midnight-ntwrk/testkit-js';
import { getConfig } from '../../src/config.js';
import { ledger, zkConfigPath } from '../../contracts/index.js';
import { MidnightWalletProvider, syncWallet } from '../../src/wallet.js';
import { buildProviders, type HelloWorldProviders } from '../../src/providers.js';
import { readDeployment, deploymentPath } from '../../scripts/deployment.js';
import { verifyGuest } from '../../scripts/verify-guest.js';

const PORT = Number(process.env['DEMO_SERVER_PORT'] ?? 8787);
const NOT_INITIALIZED_MESSAGE = `No deployment.json found at ${deploymentPath} — run "yarn demo:init" first.`;
// Must match src/test/age-verify.test.ts / scripts/seed-verified-user.ts.
const ALICE_LOCAL_SEED = '0000000000000000000000000000000000000000000000000000000000000001';

function isHex32(value: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(value);
}

const config = getConfig();
const publicDataProvider = indexerPublicDataProvider(config.indexer, config.indexerWS);

if (!(await readDeployment())) {
  console.warn(`⚠ ${NOT_INITIALIZED_MESSAGE}`);
  console.warn('  The server will start, but /api/verified and /api/verify-guest will fail until then.');
}

// Lazily built on the first admin "verify guest" request rather than at
// startup, so the server doesn't need the devnet already up just to serve
// the read-only /api/verified endpoint (matching how it worked before this
// wallet-backed endpoint existed). Built once and reused after that, since
// wallet sync itself takes a few seconds — not worth repeating per request.
let writeProvidersPromise: Promise<HelloWorldProviders> | null = null;
async function getWriteProviders(): Promise<HelloWorldProviders> {
  if (!writeProvidersPromise) {
    writeProvidersPromise = (async () => {
      const logger = pino({ level: process.env['LOG_LEVEL'] ?? 'info' });
      setNetworkId(config.networkId);
      const envConfig: EnvironmentConfiguration = { walletNetworkId: config.networkId, ...config };
      const wallet = await MidnightWalletProvider.build(logger, envConfig, {
        kind: 'seed',
        value: ALICE_LOCAL_SEED,
      });
      await wallet.start();
      await syncWallet(logger, wallet.wallet);
      return buildProviders(wallet, zkConfigPath, config);
    })();
  }
  return writeProvidersPromise;
}

// testAttestation (contracts/index.ts) is a single shared mutable value the
// witness closure reads from — verifyGuest() writes to it right before
// submitting. Concurrent admin requests would stomp on each other's
// in-flight attestation, so they're serialized through this queue.
let verifyQueue: Promise<unknown> = Promise.resolve();
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const result = verifyQueue.then(task, task);
  verifyQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

  if (req.method === 'GET' && url.pathname === '/api/verified') {
    const userIdHex = url.searchParams.get('userId') ?? '';
    if (!isHex32(userIdHex)) {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'userId must be 64 hex characters (32 bytes)' }));
      return;
    }

    try {
      const deployment = await readDeployment();
      if (!deployment) {
        res.writeHead(503, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: NOT_INITIALIZED_MESSAGE }));
        return;
      }
      const state = await publicDataProvider.queryContractState(deployment.contractAddress);
      if (!state) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ verified: false }));
        return;
      }
      const userId = Uint8Array.from(Buffer.from(userIdHex, 'hex'));
      const verified = ledger(state.data).verifiedUsers.member(userId);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ verified }));
    } catch (err) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/verify-guest') {
    try {
      const body = (await readJsonBody(req)) as { userId?: unknown; birthdate?: unknown };
      const userIdHex = typeof body.userId === 'string' ? body.userId : '';
      const birthdate = typeof body.birthdate === 'string' ? body.birthdate : '';
      if (!isHex32(userIdHex)) {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'userId must be 64 hex characters (32 bytes)' }));
        return;
      }
      if (!birthdate || Number.isNaN(Date.parse(birthdate))) {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'birthdate must be a valid date' }));
        return;
      }

      const deployment = await readDeployment();
      if (!deployment) {
        res.writeHead(503, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: NOT_INITIALIZED_MESSAGE }));
        return;
      }

      const userId = Uint8Array.from(Buffer.from(userIdHex, 'hex'));
      const birthTimestamp = BigInt(Math.floor(Date.parse(birthdate) / 1000));
      const providers = await getWriteProviders();
      await enqueue(() => verifyGuest(providers, deployment, userId, birthTimestamp));

      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// Bound to localhost only: unlike the read-only /api/verified endpoint,
// /api/verify-guest can write a real "verified" attestation for any userId
// it's given. Nobody else on the local network should be able to reach it.
server.listen(PORT, '127.0.0.1', () => {
  console.log(`Demo backend listening on http://127.0.0.1:${PORT}`);
});
