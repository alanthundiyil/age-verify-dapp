import './style.css';
import { initGuest } from './guest.js';
import { initBouncer } from './bouncer.js';
import { initAdmin } from './admin.js';

const root = document.querySelector<HTMLElement>('#app')!;
const role = new URLSearchParams(location.search).get('role');

if (role === 'guest') {
  initGuest(root).catch((err) => {
    root.innerHTML = `<p style="color:crimson">Failed to initialize: ${(err as Error).message}</p>`;
  });
} else if (role === 'bouncer') {
  initBouncer(root);
} else if (role === 'admin') {
  initAdmin(root);
} else {
  root.innerHTML = `
    <h1>Midnight Bouncer</h1>
    <p>Open one of these on two different browser windows/devices:</p>
    <p><a href="?role=guest">I'm a guest</a></p>
    <p><a href="?role=bouncer">I'm the bouncer</a></p>
    <hr>
    <p style="font-size:0.9em;"><a href="?role=admin">Attestation Provider (verify a guest — demo setup only)</a></p>
  `;
}
