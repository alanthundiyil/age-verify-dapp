export function initAdmin(root: HTMLElement): void {
  root.innerHTML = `
    <h1>REEK — Attestation Provider</h1>
    <p style="text-align:left; background:#1a1f3a; padding:0.75rem 1rem; border-radius:8px;">
      <strong>What this page actually is:</strong> in a real deployment, someone
      has to actually check a person's ID and confirm their birthdate before
      the contract will ever trust it — that's "REEK," the trusted
      attestation provider this project keeps referring to. This page stands
      in for REEK's internal tool. Clicking "Verify this guest" below signs
      the birthdate you type with REEK's private key (never sent to your
      browser — it stays on the server, in <code>deployment.json</code>) and
      submits it as a real transaction, which is what makes
      <code>verifiedUsers.member(userId)</code> become <code>true</code> for
      that ID on the blockchain.
    </p>
    <p style="text-align:left; background:#3a1a1a; padding:0.75rem 1rem; border-radius:8px;">
      <strong>Why this isn't on the guest page:</strong> whoever can click
      this button can mark <em>any</em> ID as verified for <em>any</em>
      birthdate — no real ID check happens here, it's whatever you type in.
      That's the entire point of keeping REEK separate from the guest: the
      guest proves who signed their attestation; they can never sign their
      own. In a real product, a page with this much power would need to sit
      behind real authentication, restricted to REEK's own staff — here it's
      open for demo purposes only, and the backend only accepts requests
      from this same machine (see apps/demo/server.ts).
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
