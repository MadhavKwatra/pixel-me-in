/**
 * Installable app (PWA): offline support, "Install app" button, and a
 * "new version" toast. iPhones have no install prompt, so we show help text.
 */
import { registerSW } from 'virtual:pwa-register';
import { downloadFaceFinder, faceFinderReady, saveDataOn } from '../face/offline';
import { isIOS, isStandalone } from './device';
import { $$, toast } from './dom';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;

export function installAvailable(): boolean {
  return !isStandalone() && (!!deferred || isIOS());
}

export async function promptInstall() {
  if (deferred) {
    await deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    refreshInstallButtons();
  } else if (isIOS()) {
    toast('On iPhone/iPad: tap the Share button, then “Add to Home Screen”.', undefined, 7000);
  }
}

function refreshInstallButtons() {
  for (const b of $$('[data-action="install"]')) b.classList.toggle('hidden', !installAvailable());
}

/** Installed: fetch the face finder (~17 MB) so the Photo Booth works offline too. */
async function prepareOfflineBooth(justInstalled: boolean) {
  if (saveDataOn() || !navigator.onLine || (await faceFinderReady())) return;
  if (justInstalled) toast('Getting the Photo Booth ready for offline play (17 MB)…');
  if (await downloadFaceFinder()) toast('The Photo Booth now works offline too.');
}

export function setupPwa() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    refreshInstallButtons();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    refreshInstallButtons();
    toast('Installed! You can play from your home screen, even offline.');
    void prepareOfflineBooth(true);
  });
  refreshInstallButtons();
  // The installed app opened online without the face finder (iPhone, or installed earlier).
  if (import.meta.env.PROD && isStandalone()) {
    window.addEventListener('load', () => void prepareOfflineBooth(false), { once: true });
  }

  if (import.meta.env.PROD) {
    const update = registerSW({
      onNeedRefresh() {
        toast('A new version is ready.', { label: 'Reload', run: () => void update(true) });
      },
      onOfflineReady() {
        toast('Ready to play offline.');
      },
    });
  }
}
