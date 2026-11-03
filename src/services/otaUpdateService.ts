import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater, type BundleInfo, type DownloadEvent } from '@capgo/capacitor-updater';

export type OtaUpdatePhase = 'idle' | 'checking' | 'available' | 'downloading' | 'preparing' | 'installing' | 'complete' | 'failed' | 'error';

export type OtaUpdateState = {
  phase: OtaUpdatePhase;
  progress: number;
  version?: string;
  notes?: string;
  message?: string;
  mandatory?: boolean;
  size?: number | null;
};

type PendingUpdate = {
  version: string;
  url: string;
  checksum: string | null;
  mandatory: boolean;
  notes: string | null;
  size: number | null;
};

type OtaLatestResponse =
  | {
      available: true;
      version: string;
      url: string;
      checksum?: string | null;
      mandatory?: boolean;
      notes?: string | null;
      fileSizeBytes?: number | null;
    }
  | {
      available: false;
      reason?: string;
    };

const OTA_CHANNEL = import.meta.env.VITE_OTA_CHANNEL || 'production';
const OTA_DISABLED = import.meta.env.DEV || import.meta.env.VITE_DISABLE_OTA === 'true';
const MEDMACS_API_BASE_URL = (import.meta.env.VITE_MEDMACS_API_BASE_URL || 'https://admin.medmacs.app').replace(/\/+$/, '');
const INSTALL_ID_KEY = 'medmacs_ota_install_id';
const FAILED_VERSIONS_KEY = 'medmacs_ota_failed_versions';
const INSTALLING_VERSION_KEY = 'medmacs_ota_installing_version';
const COMPLETED_VERSION_KEY = 'medmacs_ota_completed_version';
const STAGED_VERSION_KEY = 'medmacs_ota_staged_version';
const OTA_DIAGNOSTICS_KEY = 'medmacs_ota_diagnostics';

let currentState: OtaUpdateState = !OTA_DISABLED && Capacitor.isNativePlatform()
  ? { phase: 'checking', progress: 0 }
  : { phase: 'idle', progress: 0 };
let started = false;
let appReadyPromise: Promise<void> | null = null;
let pendingUpdate: PendingUpdate | null = null;
let checkInFlight = false;
let lastCheckAt = 0;
let silentDownloadInFlight = false;
const listeners = new Set<(state: OtaUpdateState) => void>();

const emit = (state: OtaUpdateState) => {
  currentState = state;
  listeners.forEach(listener => listener(currentState));
};

const recordDiagnostic = (event: string, details: Record<string, unknown> = {}) => {
  const entry = {
    event,
    details,
    at: new Date().toISOString(),
  };

  try {
    const existing = JSON.parse(localStorage.getItem(OTA_DIAGNOSTICS_KEY) || '[]');
    const entries = Array.isArray(existing) ? existing : [];
    entries.push(entry);
    localStorage.setItem(OTA_DIAGNOSTICS_KEY, JSON.stringify(entries.slice(-50)));
  } catch (_error) {
    localStorage.setItem(OTA_DIAGNOSTICS_KEY, JSON.stringify([entry]));
  }

  console.info('[OTA]', event, details);
};

const getInstallId = () => {
  const existing = localStorage.getItem(INSTALL_ID_KEY);
  if (existing) return existing;

  const installId = crypto.randomUUID();
  localStorage.setItem(INSTALL_ID_KEY, installId);
  return installId;
};

const parseVersionCode = (value: unknown) => {
  const versionCode = Number(value);
  return Number.isFinite(versionCode) ? Math.trunc(versionCode) : 0;
};

const readJsonArray = (key: string) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch (_error) {
    return [];
  }
};

const rememberFailedVersion = (version?: string) => {
  if (!version || version === 'builtin') return;
  const failedVersions = new Set(readJsonArray(FAILED_VERSIONS_KEY));
  failedVersions.add(version);
  localStorage.setItem(FAILED_VERSIONS_KEY, JSON.stringify([...failedVersions].slice(-10)));
};

const getBundleVersion = (bundle?: BundleInfo | null) => {
  if (!bundle) return 'builtin';
  return bundle.version || bundle.id || 'builtin';
};

const clearInstallingVersionIfCurrent = (currentBundleVersion: string, currentBundleId?: string): boolean => {
  const installingValue = localStorage.getItem(INSTALLING_VERSION_KEY);
  if (!installingValue) return false;

  const matched = installingValue === currentBundleVersion || (currentBundleId != null && installingValue === currentBundleId);

  localStorage.removeItem(INSTALLING_VERSION_KEY);

  if (matched) {
    localStorage.setItem(COMPLETED_VERSION_KEY, currentBundleVersion);
    emit({
      phase: 'complete',
      progress: 100,
      version: currentBundleVersion,
      message: 'Update complete. You are now using the latest version.',
    });
    return true;
  }

  return false;
};

const subscribeToDownloadProgress = async () => {
  const handle = await CapacitorUpdater.addListener('download', (event: DownloadEvent) => {
    emit({
      ...currentState,
      phase: 'downloading',
      progress: Math.max(0, Math.min(100, Math.round(event.percent ?? 0))),
    });
  });

  return () => {
    handle.remove();
  };
};

export const subscribeToOtaUpdates = (listener: (state: OtaUpdateState) => void) => {
  listeners.add(listener);
  listener(currentState);

  return () => {
    listeners.delete(listener);
  };
};

export const dismissOtaUpdateScreen = () => {
  pendingUpdate = null;
  emit({ phase: 'idle', progress: 0 });
};

export const retryOtaDownload = () => {
  const pending = pendingUpdate;
  if (!pending) return;
  void startOtaDownload();
};

export const startOtaDownload = async () => {
  const pending = pendingUpdate;
  if (!pending) return;

  const removeDownloadListener = await subscribeToDownloadProgress();

  try {
    recordDiagnostic('download_start', {
      version: pending.version,
      checksum: pending.checksum,
    });
    emit({
      phase: 'downloading',
      progress: 0,
      version: pending.version,
      notes: pending.notes ?? undefined,
      mandatory: pending.mandatory,
      size: pending.size,
      message: 'Getting new features ready...',
    });

    const bundle = await CapacitorUpdater.download({
      version: pending.version,
      url: pending.url,
      checksum: pending.checksum ?? undefined,
    });
    recordDiagnostic('download_success', { bundle });

    emit({
      phase: 'preparing',
      progress: 100,
      version: pending.version,
      notes: pending.notes ?? undefined,
      mandatory: pending.mandatory,
      size: pending.size,
      message: 'Preparing your update...',
    });

    emit({
      phase: 'installing',
      progress: 100,
      version: pending.version,
      notes: pending.notes ?? undefined,
      mandatory: pending.mandatory,
      size: pending.size,
      message: 'Installing update. The app will reopen automatically.',
    });

    localStorage.setItem(INSTALLING_VERSION_KEY, bundle.id);
    recordDiagnostic('set_start', {
      id: bundle.id,
      version: pending.version,
    });
    await CapacitorUpdater.set({ id: bundle.id });
  } catch (error) {
    recordDiagnostic('ota_flow_error', {
      phase: currentState.phase,
      message: error instanceof Error ? error.message : String(error),
    });
    console.error('OTA download failed:', error);
    if (currentState.phase === 'downloading' || currentState.phase === 'preparing' || currentState.phase === 'installing') {
      emit({
        phase: 'error',
        progress: 0,
        version: pending.version,
        mandatory: pending.mandatory,
        message: "We couldn't prepare the update right now. We'll try again later.",
      });
      return;
    }
    emit({ phase: 'idle', progress: 0 });
  } finally {
    removeDownloadListener();
  }
};

// An update discovered after launch should not interrupt the current session.
// `next` activates it on background/restart; a fresh launch still uses the
// existing mandatory blocking flow if the staged bundle did not activate.
const stageMandatoryUpdate = async (update: PendingUpdate) => {
  if (silentDownloadInFlight || localStorage.getItem(STAGED_VERSION_KEY) === update.version) return;
  silentDownloadInFlight = true;
  try {
    recordDiagnostic('background_download_start', { version: update.version });
    const bundle = await CapacitorUpdater.download({
      version: update.version,
      url: update.url,
      checksum: update.checksum ?? undefined,
    });
    await CapacitorUpdater.next({ id: bundle.id });
    localStorage.setItem(STAGED_VERSION_KEY, update.version);
    recordDiagnostic('background_update_staged', { version: update.version, id: bundle.id });
    pendingUpdate = null;
    emit({ phase: 'idle', progress: 0 });
  } catch (error) {
    recordDiagnostic('background_update_failed', {
      version: update.version,
      message: error instanceof Error ? error.message : String(error),
    });
    console.error('Background OTA update failed:', error);
  } finally {
    silentDownloadInFlight = false;
  }
};

export const getOtaDiagnostics = () => {
  try {
    const existing = JSON.parse(localStorage.getItem(OTA_DIAGNOSTICS_KEY) || '[]');
    return Array.isArray(existing) ? existing : [];
  } catch (_error) {
    return [];
  }
};

export const clearOtaDiagnostics = () => {
  localStorage.removeItem(OTA_DIAGNOSTICS_KEY);
};

export const markOtaBundleReady = () => {
  if (OTA_DISABLED || !Capacitor.isNativePlatform()) return Promise.resolve();
  if (!appReadyPromise) {
    recordDiagnostic('notify_app_ready_start');
    appReadyPromise = CapacitorUpdater.notifyAppReady()
      .then(result => {
        recordDiagnostic('notify_app_ready_success', {
          bundle: result.bundle,
        });
      })
      .catch(error => {
        recordDiagnostic('notify_app_ready_failed', {
          message: error instanceof Error ? error.message : String(error),
        });
        console.warn('OTA notifyAppReady failed:', error);
      });
  }

  return appReadyPromise;
};

const checkForOtaUpdates = async (afterLaunch: boolean) => {
  if (checkInFlight || silentDownloadInFlight ||
      (afterLaunch && Date.now() - lastCheckAt < 15 * 60 * 1000)) return;
  // Do not replace a visible update flow or race its download.
  if (afterLaunch && currentState.phase !== 'idle') return;
  checkInFlight = true;
  lastCheckAt = Date.now();
  try {
    recordDiagnostic('check_start', { afterLaunch });
    if (!afterLaunch) emit({ phase: 'checking', progress: 0, message: 'Checking for new features...' });

    const appInfo = await App.getInfo();
    const nativeVersionCode = parseVersionCode(appInfo.build);
    const currentBundle = await CapacitorUpdater.current();
    const currentBundleVersion = getBundleVersion(currentBundle.bundle);

    const completedVersion = localStorage.getItem(COMPLETED_VERSION_KEY);

    recordDiagnostic('current_bundle', {
      native: currentBundle.native,
      bundle: currentBundle.bundle,
      currentBundleVersion,
      nativeVersionCode,
      completedVersion,
    });

    const failedUpdate = await CapacitorUpdater.getFailedUpdate().catch(error => {
      recordDiagnostic('failed_update_lookup_error', {
        message: error instanceof Error ? error.message : String(error),
      });
      console.warn('OTA failed update lookup failed:', error);
      return null;
    });

    if (failedUpdate?.bundle) {
      const failedVersion = getBundleVersion(failedUpdate.bundle);
      recordDiagnostic('failed_update_found', {
        bundle: failedUpdate.bundle,
        failedVersion,
      });
      rememberFailedVersion(failedVersion);
      localStorage.removeItem(STAGED_VERSION_KEY);
      localStorage.removeItem(INSTALLING_VERSION_KEY);
      localStorage.removeItem(COMPLETED_VERSION_KEY);
      CapacitorUpdater.delete({ id: failedUpdate.bundle.id }).catch(error => {
        console.warn('OTA failed bundle cleanup skipped:', error);
      });
      if (!afterLaunch) {
        emit({
          phase: 'failed',
          progress: 0,
          version: failedVersion,
          message: 'Update failed and was rolled back. We will wait for a newer update before trying again.',
        });
      }
    } else {
      const completedBeforeCheck = clearInstallingVersionIfCurrent(currentBundleVersion, currentBundle.bundle?.id);
      if (completedBeforeCheck) {
        localStorage.removeItem(STAGED_VERSION_KEY);
        pendingUpdate = null;
        return;
      }
    }

    // A staged update belongs to the previous session. If it did not activate,
    // this cold start must follow the original mandatory prompt and block access.
    if (!afterLaunch) localStorage.removeItem(STAGED_VERSION_KEY);

    const effectiveVersion = completedVersion || currentBundleVersion;
    const failedBundleVersions = readJsonArray(FAILED_VERSIONS_KEY);

    recordDiagnostic('server_check_request', {
      effectiveVersion,
      currentBundleVersion,
      completedVersion,
      failedBundleVersions,
      channel: OTA_CHANNEL,
      platform: Capacitor.getPlatform(),
    });

    const response = await fetch(`${MEDMACS_API_BASE_URL}/api/ota/latest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        platform: Capacitor.getPlatform(),
        nativeVersionCode,
        currentBundleVersion: effectiveVersion,
        failedBundleVersions,
        channel: OTA_CHANNEL,
        installId: getInstallId(),
      }),
    });

    if (!response.ok) throw new Error(`OTA check failed with status ${response.status}`);
    const data = await response.json() as OtaLatestResponse;
    recordDiagnostic('server_check_response', { data });

    if (!data?.available) {
      if (currentState.phase === 'checking') {
        emit({ phase: 'idle', progress: 0 });
      }
      return;
    }

    if (failedBundleVersions.includes(data.version)) {
      recordDiagnostic('server_returned_failed_version', {
        version: data.version,
        failedBundleVersions,
      });
      if (!afterLaunch) {
        emit({
          phase: 'failed',
          progress: 0,
          version: data.version,
          message: 'This update already failed on this device. We will wait for a newer update before trying again.',
        });
      }
      return;
    }

    // Skip showing updates that were already successfully completed
    if (completedVersion && data.version === completedVersion) {
      recordDiagnostic('skip_already_completed_version', {
        version: data.version,
        completedVersion,
      });
      emit({ phase: 'idle', progress: 0 });
      return;
    }

    if (afterLaunch && localStorage.getItem(STAGED_VERSION_KEY) === data.version) {
      recordDiagnostic('skip_staged_version', { version: data.version });
      return;
    }

    // A genuinely new update is available — clear the old completed marker
    localStorage.removeItem(COMPLETED_VERSION_KEY);

    const updateSize = data.fileSizeBytes ?? null;

    pendingUpdate = {
      version: data.version,
      url: data.url,
      checksum: data.checksum ?? null,
      mandatory: data.mandatory ?? false,
      notes: data.notes ?? null,
      size: updateSize,
    };

    recordDiagnostic('update_available', {
      version: data.version,
      mandatory: data.mandatory,
      size: updateSize,
    });

    if (afterLaunch && pendingUpdate.mandatory) {
      await stageMandatoryUpdate(pendingUpdate);
      return;
    }

    emit({
      phase: 'available',
      progress: 0,
      version: data.version,
      notes: data.notes ?? undefined,
      mandatory: data.mandatory ?? false,
      size: updateSize,
      message: data.mandatory
        ? 'Medmacs is requiring an update.'
        : 'A new version of Medmacs is available.',
    });
  } catch (error) {
    recordDiagnostic('ota_flow_error', {
      phase: currentState.phase,
      message: error instanceof Error ? error.message : String(error),
    });
    console.error('OTA update check failed:', error);
    if (currentState.phase === 'downloading' || currentState.phase === 'preparing' || currentState.phase === 'installing') {
      emit({
        phase: 'error',
        progress: 0,
        message: "We couldn't prepare the update right now. We'll try again later.",
      });
      return;
    }

    if (!afterLaunch) {
      pendingUpdate = null;
      emit({ phase: 'idle', progress: 0 });
    }
  } finally {
    checkInFlight = false;
  }
};

export const initializeOtaUpdates = async () => {
  if (OTA_DISABLED || started || !Capacitor.isNativePlatform()) return;
  started = true;

  await markOtaBundleReady();
  await checkForOtaUpdates(false);

  // Keep checking while the app is open, and on return from the background.
  // The first check above keeps the original first-boot update gate intact.
  void App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) void checkForOtaUpdates(true);
  }).catch(error => console.warn('OTA app state listener failed:', error));
  window.setInterval(() => {
    if (document.visibilityState === 'visible') void checkForOtaUpdates(true);
  }, 30 * 60 * 1000);
};
