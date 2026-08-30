import { ensureIdentity, clearIdentity, sign } from './identity.js';
import { startScanning, renderQr, type ScanHandle } from './qr.js';
import { decodeChallenge, encodeResponse } from './protocol.js';
import { renderNav } from './nav.js';

export async function initGuest(root: HTMLElement): Promise<void> {
  const identity = await ensureIdentity();
  let scan: ScanHandle | null = null;

  root.innerHTML = `
    ${renderNav('guest')}
    <h1>Guest</h1>
    <p>This is your identity on this device. Give the ID below to whoever
       runs the one-time "get verified" step (the
       <a href="?role=admin">Attestation Provider</a> page, or
       <code>yarn demo:seed</code>).</p>
    <p class="card"><strong>Your ID:</strong> <code id="user-id"></code></p>
    <button id="show-badge">Show my badge to a bouncer</button>
    <button id="forget" class="secondary">Forget this identity</button>
    <p id="status"></p>
    <div id="scan-wrap" class="scan-frame" style="display:none;">
      <video id="video" autoplay playsinline muted></video>
    </div>
    <canvas id="qr-out" style="display:none;"></canvas>
  `;

  const userIdEl = root.querySelector<HTMLElement>('#user-id')!;
  const statusEl = root.querySelector<HTMLElement>('#status')!;
  const scanWrapEl = root.querySelector<HTMLElement>('#scan-wrap')!;
  const videoEl = root.querySelector<HTMLVideoElement>('#video')!;
  const qrOutEl = root.querySelector<HTMLCanvasElement>('#qr-out')!;
  const showBadgeBtn = root.querySelector<HTMLButtonElement>('#show-badge')!;
  const forgetBtn = root.querySelector<HTMLButtonElement>('#forget')!;

  userIdEl.textContent = identity.userIdHex;

  forgetBtn.addEventListener('click', () => {
    scan?.stop();
    clearIdentity();
    location.reload();
  });

  showBadgeBtn.addEventListener('click', () => {
    scan?.stop();
    scanWrapEl.style.display = '';
    qrOutEl.style.display = 'none';
    statusEl.textContent = 'Point your camera at the bouncer’s challenge QR code…';

    scan = startScanning(videoEl, (text) => {
      scanWrapEl.style.display = 'none';
      handleChallenge(text).catch((err) => {
        statusEl.textContent = `Error: ${(err as Error).message}`;
      });
    });
  });

  async function handleChallenge(text: string): Promise<void> {
    const challenge = decodeChallenge(text);
    const signature = await sign(identity, challenge);
    const responseText = encodeResponse({
      userId: identity.userId,
      publicKeyRaw: identity.publicKeyRaw,
      challenge,
      signature,
    });
    qrOutEl.style.display = '';
    await renderQr(qrOutEl, responseText);
    statusEl.textContent = 'Show this code to the bouncer.';
  }
}
