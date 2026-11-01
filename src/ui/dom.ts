/** Tiny DOM helpers. The UI is plain TypeScript, no framework, to keep it easy to read. */

export function $<T extends HTMLElement = HTMLElement>(
  sel: string,
  root: ParentNode = document,
): T {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`Missing element: ${sel}`);
  return el;
}

export function $$<T extends HTMLElement = HTMLElement>(
  sel: string,
  root: ParentNode = document,
): T[] {
  return Array.from(root.querySelectorAll<T>(sel));
}

/** Set innerHTML from a template. Only use with our own static text, never user input. */
export function render(root: HTMLElement, html: string) {
  root.innerHTML = html;
}

/** Click handlers by data-action name. */
export function onActions(root: HTMLElement, handlers: Record<string, (el: HTMLElement) => void>) {
  root.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!el || !root.contains(el)) return;
    const fn = handlers[el.dataset.action!];
    if (fn) {
      e.preventDefault();
      fn(el);
    }
  });
}

let toastTimer = 0;

export function toast(message: string, action?: { label: string; run: () => void }, ms = 3500) {
  const t = $('#toast');
  t.textContent = message;
  if (action) {
    const b = document.createElement('button');
    b.className = 'btn';
    b.textContent = action.label;
    b.addEventListener('click', () => {
      t.textContent = '';
      action.run();
    });
    t.append(b);
  }
  window.clearTimeout(toastTimer);
  if (!action) toastTimer = window.setTimeout(() => (t.textContent = ''), ms);
}

export function flash() {
  const f = $('#flash');
  f.classList.remove('on');
  void f.offsetWidth; // restart the animation
  f.classList.add('on');
}

export function wait(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export function formatNumber(n: number) {
  return n.toLocaleString('en-US');
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
