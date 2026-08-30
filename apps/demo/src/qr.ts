// Thin wrappers around `qrcode` (generate) and `jsqr` (decode from a live
// camera feed) so guest.ts/bouncer.ts don't deal with canvas/video plumbing
// directly.
import QRCode from 'qrcode';
import jsQR from 'jsqr';

export async function renderQr(canvas: HTMLCanvasElement, text: string): Promise<void> {
  await QRCode.toCanvas(canvas, text, { width: 280, margin: 2 });
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
      const code = jsQR(frame.data, frame.width, frame.height);
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
    .getUserMedia({ video: { facingMode: 'environment' } })
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
