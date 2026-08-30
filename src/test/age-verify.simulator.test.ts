import { describe, it, expect } from 'vitest';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { AgeVerifySimulator } from './age-verify.simulator.js';
import { generateProviderKeyPair } from './utils/schnorr.js';
import * as crypto from 'crypto';

setNetworkId('undeployed');

const ADULT_BIRTH_TIMESTAMP = BigInt(Math.floor(new Date('2000-01-01').getTime() / 1000));
const UNDERAGE_BIRTH_TIMESTAMP = BigInt(Math.floor(Date.now() / 1000) - 60);

function randomUserId(): Uint8Array {
  return new Uint8Array(crypto.randomBytes(32));
}

describe('AgeVerify contract (simulator)', () => {
  it('registers the default provider and starts with an empty verifiedUsers map', () => {
    const sim = new AgeVerifySimulator();
    const ledger = sim.getLedger();
    expect(ledger.providers.member(sim.providerId)).toBe(true);
    expect(ledger.verifiedUsers.isEmpty()).toBe(true);
  });

  it('verifies an adult user with a valid attestation', () => {
    const sim = new AgeVerifySimulator();
    const userId = randomUserId();
    sim.attestBirth(userId, ADULT_BIRTH_TIMESTAMP);

    const ledger = sim.verifyAge(userId);
    expect(ledger.verifiedUsers.member(userId)).toBe(true);
  });

  it('rejects an underage user with an otherwise-valid attestation', () => {
    const sim = new AgeVerifySimulator();
    const userId = randomUserId();
    sim.attestBirth(userId, UNDERAGE_BIRTH_TIMESTAMP);

    expect(() => sim.verifyAge(userId)).toThrow('User does not meet minimum age requirement');
  });

  it('rejects a tampered attestation signature', () => {
    const sim = new AgeVerifySimulator();
    const userId = randomUserId();
    sim.attestBirth(userId, ADULT_BIRTH_TIMESTAMP);
    sim.tamperSignatureResponse(1n);

    expect(() => sim.verifyAge(userId)).toThrow('Invalid attestation signature');
  });

  it('rejects an attestation from an unregistered provider', () => {
    const sim = new AgeVerifySimulator();
    const userId = randomUserId();
    const otherProvider = generateProviderKeyPair();

    // Sign with a key that was never registered (providerId 99 doesn't exist)
    sim.attestBirth(userId, ADULT_BIRTH_TIMESTAMP, otherProvider.sk, 99n);

    expect(() => sim.verifyAge(userId)).toThrow('Attestation provider not registered');
  });

  it('rejects an attestation after its provider is removed', () => {
    const sim = new AgeVerifySimulator();
    const userId = randomUserId();
    sim.attestBirth(userId, ADULT_BIRTH_TIMESTAMP);

    sim.removeProvider(sim.providerId);

    expect(() => sim.verifyAge(userId)).toThrow('Attestation provider not registered');
  });

  it('does not let an attestation for one user verify a different user', () => {
    const sim = new AgeVerifySimulator();
    const userA = randomUserId();
    const userB = randomUserId();

    // Attestation signed against userA's id, but presented for userB.
    sim.attestBirth(userA, ADULT_BIRTH_TIMESTAMP);

    expect(() => sim.verifyAge(userB)).toThrow('Invalid attestation signature');
  });

  it('throws when a non-admin tries to register a provider', () => {
    const sim = new AgeVerifySimulator();
    sim.setAdminSecret(new Uint8Array(crypto.randomBytes(32)));
    const newProvider = generateProviderKeyPair();

    expect(() => sim.registerProvider(2n, newProvider.pk)).toThrow('Only admin can register providers');
  });

  it('throws when a non-admin tries to remove a provider', () => {
    const sim = new AgeVerifySimulator();
    sim.setAdminSecret(new Uint8Array(crypto.randomBytes(32)));

    expect(() => sim.removeProvider(sim.providerId)).toThrow('Only admin can remove providers');
  });
});
