// Minimal read-only backend for the bouncer demo: exposes
// GET /api/verified?userId=<hex> by querying the indexer directly — no
// wallet, no proving, since checking `verifiedUsers.member(userId)` is a
// pure read. Reuses the exact same publicDataProvider + ledger() pattern
// already proven in src/test/age-verify.test.ts.
import { createServer } from 'node:http';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { getConfig } from '../../src/config.js';
import { ledger } from '../../contracts/index.js';
import { readDeployment, deploymentPath } from '../../scripts/deployment.js';

const PORT = Number(process.env['DEMO_SERVER_PORT'] ?? 8787);
const NOT_INITIALIZED_MESSAGE = `No deployment.json found at ${deploymentPath} — run "yarn demo:init" first.`;

function isHex32(value: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(value);
}

const config = getConfig();
const publicDataProvider = indexerPublicDataProvider(config.indexer, config.indexerWS);

if (!(await readDeployment())) {
  console.warn(`⚠ ${NOT_INITIALIZED_MESSAGE}`);
  console.warn('  The server will start, but /api/verified will fail until then.');
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  if (url.pathname !== '/api/verified') {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

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
});

server.listen(PORT, () => {
  console.log(`Demo backend listening on http://127.0.0.1:${PORT}`);
});
