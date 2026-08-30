// A guest's on-device identity for the demo. This is deliberately a plain
// ECDSA (P-256) keypair via the browser's native Web Crypto — separate from,
// and unrelated to, the Jubjub/Schnorr signature the contract's ZK circuit
// verifies (see contracts/schnorr.compact). That one proves "a registered
// provider attested this birthdate"; this one proves "the phone in front of
// you, right now, controls this specific userId" — the liveness check a
// bouncer needs that a static QR code can't provide.
import { toHex, type Bytes } from './bytes.js';

const STORAGE_KEY = 'age-verify-demo:identity';
const SIGN_PARAMS: EcdsaParams = { name: 'ECDSA', hash: 'SHA-256' };
const KEY_PARAMS: EcKeyGenParams = { name: 'ECDSA', namedCurve: 'P-256' };

export type Identity = {
  privateKey: CryptoKey;
  publicKeyRaw: Bytes;
  userId: Bytes;
  userIdHex: string;
};

type StoredIdentity = {
  privateKeyJwk: JsonWebKey;
  publicKeyJwk: JsonWebKey;
};

async function deriveUserId(publicKeyRaw: Bytes): Promise<Bytes> {
  const digest = await crypto.subtle.digest('SHA-256', publicKeyRaw);
  return new Uint8Array(digest);
}

async function fromStored(stored: StoredIdentity): Promise<Identity> {
  const [privateKey, publicKey] = await Promise.all([
    crypto.subtle.importKey('jwk', stored.privateKeyJwk, KEY_PARAMS, false, ['sign']),
    crypto.subtle.importKey('jwk', stored.publicKeyJwk, KEY_PARAMS, true, []),
  ]);
  const publicKeyRaw = new Uint8Array(await crypto.subtle.exportKey('raw', publicKey));
  const userId = await deriveUserId(publicKeyRaw);
  return { privateKey, publicKeyRaw, userId, userIdHex: toHex(userId) };
}

async function generateAndStore(): Promise<Identity> {
  const keyPair = await crypto.subtle.generateKey(KEY_PARAMS, true, ['sign', 'verify']);
  const [privateKeyJwk, publicKeyJwk] = await Promise.all([
    crypto.subtle.exportKey('jwk', keyPair.privateKey),
    crypto.subtle.exportKey('jwk', keyPair.publicKey),
  ]);
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ privateKeyJwk, publicKeyJwk } satisfies StoredIdentity));
  const publicKeyRaw = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey));
  const userId = await deriveUserId(publicKeyRaw);
  return { privateKey: keyPair.privateKey, publicKeyRaw, userId, userIdHex: toHex(userId) };
}

// Loads the guest's identity from localStorage, generating and persisting a
// new one on first visit. Each browser profile is effectively one "person"
// for the demo.
export async function ensureIdentity(): Promise<Identity> {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return await fromStored(JSON.parse(raw) as StoredIdentity);
    } catch {
      // Fall through to generating a fresh one if the stored value is corrupt.
    }
  }
  return generateAndStore();
}

export function clearIdentity(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// Raw ECDSA signature in IEEE P1363 format (r||s, 64 bytes for P-256) — the
// format Web Crypto's ECDSA sign/verify use directly, no DER encoding.
export async function sign(identity: Identity, message: Bytes): Promise<Bytes> {
  const sig = await crypto.subtle.sign(SIGN_PARAMS, identity.privateKey, message);
  return new Uint8Array(sig);
}

// Verifies a signature against a raw public key, used on the bouncer side
// where the signer's identity is only known from the scanned QR, not a
// locally held CryptoKey.
export async function verify(
  publicKeyRaw: Bytes,
  message: Bytes,
  signature: Bytes,
): Promise<boolean> {
  const publicKey = await crypto.subtle.importKey('raw', publicKeyRaw, KEY_PARAMS, false, ['verify']);
  return crypto.subtle.verify(SIGN_PARAMS, publicKey, signature, message);
}

export async function userIdFromPublicKey(publicKeyRaw: Bytes): Promise<Bytes> {
  return deriveUserId(publicKeyRaw);
}

export function bytesEqual(a: Bytes, b: Bytes): boolean {
  return a.length === b.length && a.every((byte, i) => byte === b[i]);
}
