import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import path from 'node:path';

export {
  Contract,
  ledger,
  pureCircuits,
  type Ledger,
  type ImpureCircuits,
  type PureCircuits,
} from './managed/hello-world/contract/index.js';
import { Contract } from './managed/hello-world/contract/index.js';

const currentDir = path.resolve(new URL(import.meta.url).pathname, '..');
export const zkConfigPath = path.resolve(currentDir, 'managed', 'hello-world');

// A mutable box so tests can swap the "fake birthdate" between cases
export const testBirthTimestamp = { value: 0n };

export const CompiledHelloWorldContract = CompiledContract.make(
  'AgeVerifyContract',
  Contract,
).pipe(
  CompiledContract.withWitnesses({
  localBirthTimestamp: (context: any) => [context.privateState, testBirthTimestamp.value],
}),
  CompiledContract.withCompiledFileAssets(zkConfigPath),
);