import { renderNav } from './nav.js';

export function initAdmin(root: HTMLElement): void {
  root.innerHTML = `
    ${renderNav('admin')}
    <h1>Attestation Provider</h1>
    <p class="card">
      Stands in for the trusted party that would check a real ID in
      production. Signing happens server-side — your browser never sees any
      private key. It's kept off the guest page on purpose: whoever can use
      this can mark <em>any</em> ID as verified for <em>any</em> birthdate,
      so a real deployment would lock it behind real authentication.
    </p>
    <form id="verify-form">
      <label for="user-id">Guest's ID (from the guest page)</label><br>
      <input id="user-id" type="text" pattern="[0-9a-fA-F]{64}" maxlength="64" required
             placeholder="64 hex characters" style="width:100%; margin:0.5rem 0;">
      <br>
      <label for="birthdate">Birthdate</label><br>
      <input id="birthdate" type="date" required style="margin:0.5rem 0;">
      <br>
      <button type="submit">Verify this guest</button>
    </form>
    <p id="status"></p>
  `;

  const form = root.querySelector<HTMLFormElement>('#verify-form')!;
  const userIdInput = root.querySelector<HTMLInputElement>('#user-id')!;
  const birthdateInput = root.querySelector<HTMLInputElement>('#birthdate')!;
  const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const statusEl = root.querySelector<HTMLElement>('#status')!;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    statusEl.textContent = 'Signing and submitting — this runs a real zero-knowledge proof, usually 20–60 seconds…';

    try {
      const res = await fetch('/api/verify-guest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: userIdInput.value, birthdate: birthdateInput.value }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        statusEl.textContent = `Error: ${data.error ?? `request failed (${res.status})`}`;
      } else {
        statusEl.textContent = `Done — ${userIdInput.value} is now verified 18+ on-chain.`;
      }
    } catch (err) {
      statusEl.textContent = `Error: ${(err as Error).message}`;
    } finally {
      submitBtn.disabled = false;
    }
  });
}
