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
  const tabs = LINKS.map(
    ({ role, label }) =>
      `<a href="?role=${role}" class="tab${role === current ? ' tab--active' : ''}">${label}</a>`,
  ).join('');
  return `
    <div class="topbar">
      <a href="/" class="home-link">&larr; Home</a>
      <nav class="tabbar">${tabs}</nav>
    </div>
  `;
}
