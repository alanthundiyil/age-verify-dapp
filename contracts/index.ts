import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import path from 'node:path';

export {
  Contract,
  ledger,
  pureCircuits,
  type Ledger,
  type ImpureCircuits,
  type PureCircuits,
} from './managed/age-verify/contract/index.js';   // was: managed/hello-world
import { Contract } from './managed/age-verify/contract/index.js';

const currentDir = path.resolve(new URL(import.meta.url).pathname, '..');
export const zkConfigPath = path.resolve(currentDir, 'managed', 'age-verify'); // was: 'hello-world'

export const testBirthTimestamp = { value: 0n };

export const CompiledAgeVerifyContract = CompiledContract.make(  // renamed from CompiledHelloWorldContract
  'AgeVerifyContract',
  Contract,
).pipe(
  CompiledContract.withWitnesses({
    localBirthTimestamp: (context: any) => [context.privateState, testBirthTimestamp.value],
  }),
  CompiledContract.withCompiledFileAssets(zkConfigPath),
);