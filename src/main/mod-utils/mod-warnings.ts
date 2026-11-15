import { BrowserWindow } from 'electron';

export type ModWarningKind = 'replace' | 'duplicateDisabled';

export interface ModWarningRequest {
  requestId: string;
  kind: ModWarningKind;
  modName: string;
}

const pendingWarnings = new Map<string, (accepted: boolean) => void>();
let warningWindow: BrowserWindow | null = null;
let nextRequestId = 0;

export function setModWarningWindow(window: BrowserWindow) {
  warningWindow = window;
  window.on('closed', () => {
    warningWindow = null;
    for (const resolve of pendingWarnings.values()) resolve(false);
    pendingWarnings.clear();
  });
}

export function requestModWarning(
  kind: ModWarningKind,
  modName: string,
): Promise<boolean> {
  const window = warningWindow;
  if (!window || window.isDestroyed()) {
    return Promise.resolve(false);
  }

  const requestId = String(++nextRequestId);
  const request: ModWarningRequest = { requestId, kind, modName };

  return new Promise((resolve) => {
    pendingWarnings.set(requestId, resolve);
    window.webContents.send('mod-warning-request', request);
  });
}

export function resolveModWarning(requestId: string, accepted: boolean) {
  pendingWarnings.get(requestId)?.(accepted);
  pendingWarnings.delete(requestId);
}
