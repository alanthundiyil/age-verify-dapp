// Thin wrappers around `qrcode` (generate) and `jsqr` (decode from a live
// camera feed) so guest.ts/bouncer.ts don't deal with canvas/video plumbing
// directly.
import QRCode from 'qrcode';
import jsQR from 'jsqr';

export async function renderQr(canvas: HTMLCanvasElement, text: string): Promise<void> {
  // Rendered larger than a typical printed QR code, since this is scanned
  // screen-to-camera (phone camera pointed at another screen) — bigger
  // on-screen modules are easier for a webcam to resolve at a comfortable
  // distance, and avoid the moiré/glare issues that plague small
  // screen-photographed codes.
  await QRCode.toCanvas(canvas, text, { width: 360, margin: 2 });
}

export type ScanHandle = { stop: () => void };

// Opens the device camera on `video`, scans frames until a QR code decodes
// successfully, calls `onResult` exactly once with the decoded text, then
// stops the camera automatically. Call `.stop()` on the returned handle to
// cancel early (e.g. the user navigates away before anything is scanned).
export function startScanning(video: HTMLVideoElement, onResult: (text: string) => void): ScanHandle {
  let stopped = false;
  let stream: MediaStream | null = null;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  function stop(): void {
    if (stopped) return;
    stopped = true;
    stream?.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
  }

  function tick(): void {
    if (stopped) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      // Our QR codes are always drawn dark-on-light, never inverted, so
      // skip jsQR's inverted-color scan pass — it roughly halves the work
      // per frame for no benefit here.
      const code = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: 'dontInvert' });
      if (code) {
        const text = code.data;
        stop();
        onResult(text);
        return;
      }
    }
    requestAnimationFrame(tick);
  }

  navigator.mediaDevices
    // Hint a higher resolution — browsers often default to something low
    // (e.g. 640x480) absent a constraint, which makes a screen-displayed QR
    // code harder to resolve. "ideal" is a preference, not a hard
    // requirement, so this degrades gracefully on cameras that can't do it.
    .getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
    })
    .then((s) => {
      if (stopped) {
        s.getTracks().forEach((track) => track.stop());
        return;
      }
      stream = s;
      video.srcObject = s;
      video.play().catch(() => {});
      requestAnimationFrame(tick);
    })
    .catch((err) => {
      console.error('Camera access failed:', err);
    });

  return { stop };
}
