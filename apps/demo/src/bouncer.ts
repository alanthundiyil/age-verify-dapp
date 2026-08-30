import { verify, userIdFromPublicKey, bytesEqual } from './identity.js';
import { startScanning, renderQr, type ScanHandle } from './qr.js';
import { encodeChallenge, decodeResponse } from './protocol.js';
import { randomBytes, toHex, type Bytes } from './bytes.js';
import { renderNav } from './nav.js';

export function initBouncer(root: HTMLElement): void {
  let scan: ScanHandle | null = null;
  let currentChallenge: Bytes | null = null;

  root.innerHTML = `
    ${renderNav('bouncer')}
    <h1>Bouncer</h1>
    <button id="new-check">1. Start new check</button>
    <canvas id="qr-out" style="display:none;"></canvas>
    <button id="scan-response" disabled>2. Scan guest's badge</button>
    <div id="scan-wrap" class="scan-frame" style="display:none;">
      <video id="video" autoplay playsinline muted></video>
    </div>
    <p id="result"></p>
  `;

  const qrOutEl = root.querySelector<HTMLCanvasElement>('#qr-out')!;
  const scanWrapEl = root.querySelector<HTMLElement>('#scan-wrap')!;
  const videoEl = root.querySelector<HTMLVideoElement>('#video')!;
  const resultEl = root.querySelector<HTMLElement>('#result')!;
  const newCheckBtn = root.querySelector<HTMLButtonElement>('#new-check')!;
  const scanBtn = root.querySelector<HTMLButtonElement>('#scan-response')!;

  newCheckBtn.addEventListener('click', async () => {
    scan?.stop();
    scanWrapEl.style.display = 'none';
    setStatus('');
    currentChallenge = randomBytes(16);
    qrOutEl.style.display = '';
    await renderQr(qrOutEl, encodeChallenge(currentChallenge));
    scanBtn.disabled = false;
  });

  scanBtn.addEventListener('click', () => {
    if (!currentChallenge) return;
    scan?.stop();
    scanWrapEl.style.display = '';
    setStatus('Point your camera at the guest’s badge QR code…');
    scan = startScanning(videoEl, (text) => {
      let decoded: ReturnType<typeof decodeResponse>;
      try {
        decoded = decodeResponse(text);
      } catch {
        // Not a (complete, valid) response QR yet — e.g. a misread frame.
        // Keep scanning instead of giving up on one bad read.
        return false;
      }
      scanWrapEl.style.display = 'none';
      checkResponse(decoded, currentChallenge!).catch((err) => {
        showResult(false, `Error: ${(err as Error).message}`);
      });
      return true;
    });
  });

  function setStatus(message: string): void {
    resultEl.className = '';
    resultEl.textContent = message;
  }

  function showResult(ok: boolean, message: string): void {
    resultEl.className = `badge ${ok ? 'badge-success' : 'badge-fail'}`;
    resultEl.textContent = message;
  }

  async function checkResponse(decoded: ReturnType<typeof decodeResponse>, challenge: Bytes): Promise<void> {
    const { userId, publicKeyRaw, challenge: signedChallenge, signature } = decoded;

    if (!bytesEqual(signedChallenge, challenge)) {
      showResult(false, 'Stale or mismatched challenge — try again.');
      return;
    }
    const signatureValid = await verify(publicKeyRaw, signedChallenge, signature);
    if (!signatureValid) {
      showResult(false, 'Invalid signature — this badge is forged or corrupted.');
      return;
    }
    const expectedUserId = await userIdFromPublicKey(publicKeyRaw);
    if (!bytesEqual(expectedUserId, userId)) {
      showResult(false, 'ID does not match the signing key.');
      return;
    }

    const res = await fetch(`/api/verified?userId=${toHex(userId)}`);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      showResult(false, body?.error ?? `Verification lookup failed (${res.status}).`);
      return;
    }
    const data = (await res.json()) as { verified: boolean };
    showResult(data.verified, data.verified ? '✅ Verified 18+' : '❌ Not verified');
  }
}
