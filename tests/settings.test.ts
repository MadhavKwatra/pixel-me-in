import { beforeEach, describe, expect, it } from 'vitest';

// Tiny in-memory localStorage (tests run in Node).
const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage;

describe('touch buttons setting', () => {
  beforeEach(() => store.clear());

  it('defaults to gestures only (no buttons)', async () => {
    const { getSettings } = await import('../src/storage/local');
    expect(getSettings().touchButtons).toBe('never');
  });

  it("old saves with the old default 'auto' switch to gestures", async () => {
    const { getSettings } = await import('../src/storage/local');
    store.set('pmi:settings', JSON.stringify({ touchButtons: 'auto', tutorialDone: true }));
    expect(getSettings().touchButtons).toBe('never');
    expect(getSettings().tutorialDone).toBe(true);
  });

  it("keeps the player's own choice", async () => {
    const { getSettings, setSettings } = await import('../src/storage/local');
    setSettings({ touchButtons: 'auto' });
    expect(getSettings().touchButtons).toBe('auto');
    setSettings({ music: false }); // other changes keep it
    expect(getSettings().touchButtons).toBe('auto');
  });
});
