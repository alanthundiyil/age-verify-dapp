// The QR-encoded messages exchanged between the bouncer and guest pages.
// Both are just JSON with a `type` tag so each side can tell challenge and
// response QR codes apart if a camera happens to catch the wrong one.
import { fromBase64Url, fromHex, toBase64Url, toHex, type Bytes } from './bytes.js';

type ChallengeMessage = { type: 'age-verify-challenge'; challenge: string };
type ResponseMessage = {
  type: 'age-verify-response';
  userId: string;
  publicKey: string;
  challenge: string;
  signature: string;
};

export function encodeChallenge(challenge: Bytes): string {
  return JSON.stringify({ type: 'age-verify-challenge', challenge: toBase64Url(challenge) } satisfies ChallengeMessage);
}

export function decodeChallenge(text: string): Bytes {
  const msg = JSON.parse(text) as Partial<ChallengeMessage>;
  if (msg.type !== 'age-verify-challenge' || typeof msg.challenge !== 'string') {
    throw new Error('Not an age-verify challenge QR code');
  }
  return fromBase64Url(msg.challenge);
}

export function encodeResponse(params: {
  userId: Bytes;
  publicKeyRaw: Bytes;
  challenge: Bytes;
  signature: Bytes;
}): string {
  return JSON.stringify({
    type: 'age-verify-response',
    userId: toHex(params.userId),
    publicKey: toBase64Url(params.publicKeyRaw),
    challenge: toBase64Url(params.challenge),
    signature: toBase64Url(params.signature),
  } satisfies ResponseMessage);
}

export function decodeResponse(text: string): {
  userId: Bytes;
  publicKeyRaw: Bytes;
  challenge: Bytes;
  signature: Bytes;
} {
  const msg = JSON.parse(text) as Partial<ResponseMessage>;
  if (
    msg.type !== 'age-verify-response' ||
    typeof msg.userId !== 'string' ||
    typeof msg.publicKey !== 'string' ||
    typeof msg.challenge !== 'string' ||
    typeof msg.signature !== 'string'
  ) {
    throw new Error('Not an age-verify response QR code');
  }
  return {
    userId: fromHex(msg.userId),
    publicKeyRaw: fromBase64Url(msg.publicKey),
    challenge: fromBase64Url(msg.challenge),
    signature: fromBase64Url(msg.signature),
  };
}
