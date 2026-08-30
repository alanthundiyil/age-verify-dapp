import './style.css';
import { initGuest } from './guest.js';
import { initBouncer } from './bouncer.js';
import { initAdmin } from './admin.js';

const root = document.querySelector<HTMLElement>('#app')!;
const role = new URLSearchParams(location.search).get('role');

if (role === 'guest') {
  initGuest(root).catch((err) => {
    root.innerHTML = `<p style="color:var(--danger)">Failed to initialize: ${(err as Error).message}</p>`;
  });
} else if (role === 'bouncer') {
  initBouncer(root);
} else if (role === 'admin') {
  initAdmin(root);
} else {
  root.innerHTML = `
    <img src="/icons/icon-192.png" alt="" width="88" height="88" style="margin: 1rem auto; display:block;">
    <h1>Midnight Bouncer</h1>
    <p class="tagline">Checks your age. Keeps your secrets.</p>

    <a class="role-card" href="?role=guest">
      <strong>I'm a guest</strong>
      <span>Show that you're verified 18+</span>
    </a>
    <a class="role-card" href="?role=bouncer">
      <strong>I'm the bouncer</strong>
      <span>Scan a guest's badge</span>
    </a>

    <hr>

    <a class="role-card role-card--secondary" href="?role=admin">
      <strong>Attestation Provider</strong>
      <span>Verify a guest — demo setup only</span>
    </a>
  `;
}
