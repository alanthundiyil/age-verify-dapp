import './style.css';
import { initGuest } from './guest.js';
import { initBouncer } from './bouncer.js';

const root = document.querySelector<HTMLElement>('#app')!;
const role = new URLSearchParams(location.search).get('role');

if (role === 'guest') {
  initGuest(root).catch((err) => {
    root.innerHTML = `<p style="color:crimson">Failed to initialize: ${(err as Error).message}</p>`;
  });
} else if (role === 'bouncer') {
  initBouncer(root);
} else {
  root.innerHTML = `
    <h1>Age Verify — Bouncer Demo</h1>
    <p>Open one of these on two different browser windows/devices:</p>
    <p><a href="?role=guest">I'm a guest</a></p>
    <p><a href="?role=bouncer">I'm the bouncer</a></p>
  `;
}
