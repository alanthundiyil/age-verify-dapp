import { verify, userIdFromPublicKey, bytesEqual } from './identity.js';
import { startScanning, renderQr, type ScanHandle } from './qr.js';
import { encodeChallenge, decodeResponse } from './protocol.js';
import { randomBytes, toHex, type Bytes } from './bytes.js';

export function initBouncer(root: HTMLElement): void {
  let scan: ScanHandle | null = null;
  let currentChallenge: Bytes | null = null;

  root.innerHTML = `
    <h1>Bouncer</h1>
    <button id="new-check">1. Start new check</button>
    <canvas id="qr-out" style="display:none;"></canvas>
    <button id="scan-response" disabled>2. Scan guest's badge</button>
    <video id="video" autoplay playsinline muted style="display:none; max-width: 100%;"></video>
    <p id="result"></p>
  `;

  const qrOutEl = root.querySelector<HTMLCanvasElement>('#qr-out')!;
  const videoEl = root.querySelector<HTMLVideoElement>('#video')!;
  const resultEl = root.querySelector<HTMLElement>('#result')!;
  const newCheckBtn = root.querySelector<HTMLButtonElement>('#new-check')!;
  const scanBtn = root.querySelector<HTMLButtonElement>('#scan-response')!;

  newCheckBtn.addEventListener('click', async () => {
    scan?.stop();
    videoEl.style.display = 'none';
    resultEl.textContent = '';
    currentChallenge = randomBytes(16);
    qrOutEl.style.display = '';
    await renderQr(qrOutEl, encodeChallenge(currentChallenge));
    scanBtn.disabled = false;
  });

  scanBtn.addEventListener('click', () => {
    if (!currentChallenge) return;
    scan?.stop();
    videoEl.style.display = '';
    resultEl.textContent = 'Point your camera at the guest’s badge QR code…';
    scan = startScanning(videoEl, (text) => {
      videoEl.style.display = 'none';
      checkResponse(text, currentChallenge!).catch((err) => {
        showResult(false, `Error: ${(err as Error).message}`);
      });
    });
  });

  function showResult(ok: boolean, message: string): void {
    resultEl.textContent = message;
    resultEl.style.color = ok ? 'green' : 'crimson';
    resultEl.style.fontWeight = 'bold';
  }

  async function checkResponse(text: string, challenge: Bytes): Promise<void> {
    const { userId, publicKeyRaw, challenge: signedChallenge, signature } = decodeResponse(text);

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
