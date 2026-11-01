/**
 * Site header behaviour on every page: mark the current page, and the phone
 * menu (☰) that opens/closes the links.
 */
export function setupNav() {
  const header = document.querySelector<HTMLElement>('.site-header');
  if (!header) return;

  // Current page: underline its link (and tell screen readers).
  const here = location.pathname.split('/').pop() || 'index.html';
  header.querySelectorAll<HTMLAnchorElement>('nav a').forEach((a) => {
    const target = new URL(a.href).pathname.split('/').pop() || 'index.html';
    if (target === here && !a.classList.contains('nav-play'))
      a.setAttribute('aria-current', 'page');
  });

  const button = header.querySelector<HTMLButtonElement>('.menu-btn');
  const nav = header.querySelector<HTMLElement>('nav');
  if (!button || !nav) return;
  const setOpen = (open: boolean) => {
    button.setAttribute('aria-expanded', String(open));
    header.classList.toggle('menu-open', open);
    if (open) nav.querySelector<HTMLElement>('a')?.focus();
  };
  button.addEventListener('click', () => setOpen(button.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && header.classList.contains('menu-open')) {
      setOpen(false);
      button.focus();
    }
  });
  document.addEventListener('click', (e) => {
    if (header.classList.contains('menu-open') && !header.contains(e.target as Node))
      setOpen(false);
  });
}
