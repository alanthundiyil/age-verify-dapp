// Shared shape for deployment.json, the file that lets the one-time setup
// step (scripts/demo-init.ts) and the repeatable per-guest step
// (scripts/seed-verified-user.ts, apps/demo/server.ts) agree on which
// deployed contract and demo attestation provider to use.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';

export type Deployment = {
  contractAddress: ContractAddress;
  providerId: string;
  providerSk: string;
};

export const deploymentPath = path.resolve(import.meta.dirname, '..', 'deployment.json');

export async function readDeployment(): Promise<Deployment | null> {
  try {
    return JSON.parse(await readFile(deploymentPath, 'utf8')) as Deployment;
  } catch {
    return null;
  }
}

export async function writeDeployment(deployment: Deployment): Promise<void> {
  await writeFile(deploymentPath, JSON.stringify(deployment, null, 2));
}
