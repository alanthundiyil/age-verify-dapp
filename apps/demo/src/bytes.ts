// Small byte/encoding helpers shared by the identity, QR, guest, and bouncer
// modules. Kept dependency-free (just the Web Crypto + atob/btoa the browser
// already provides).

// TS 5.7+ makes Uint8Array generic over its backing buffer; WebCrypto's
// BufferSource only accepts the ArrayBuffer-backed form, not the wider
// ArrayBufferLike (which also covers SharedArrayBuffer). Every byte array in
// this app is constructed fresh, so it's always this concrete form.
export type Bytes = Uint8Array<ArrayBuffer>;

export function toHex(bytes: Bytes): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function fromHex(hex: string): Bytes {
  if (hex.length % 2 !== 0) throw new Error('fromHex: odd-length hex string');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function toBase64Url(bytes: Bytes): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(str: string): Bytes {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(str.length / 4) * 4, '=');
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export function concatBytes(...parts: Bytes[]): Bytes {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

export function randomBytes(n: number): Bytes {
  return crypto.getRandomValues(new Uint8Array(n));
}
