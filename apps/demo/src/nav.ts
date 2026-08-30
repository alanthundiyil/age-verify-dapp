// Small shared nav bar so the three views (guest, bouncer, admin) don't
// feel like disconnected pages — plain links, since a full page load per
// view is fine for a demo this size.
type Role = 'guest' | 'bouncer' | 'admin';

const LINKS: Array<{ role: Role; label: string }> = [
  { role: 'guest', label: 'Guest' },
  { role: 'bouncer', label: 'Bouncer' },
  { role: 'admin', label: 'Attestation Provider' },
];

export function renderNav(current: Role): string {
  const items = LINKS.map(({ role, label }) =>
    role === current ? `<strong>${label}</strong>` : `<a href="?role=${role}">${label}</a>`,
  ).join(' &middot; ');
  return `<nav style="margin-bottom:1.5rem; font-size:0.9em;"><a href="/">Home</a> &middot; ${items}</nav>`;
}
