import { app, BrowserWindow, dialog, IpcMain } from 'electron';
import * as fs from 'fs';
import * as os from 'os';
import store from '../../store';
import { getDebugLibrarySnapshot } from '../../debug-library-snapshot';
import { getCharacterCssDebugReport } from '../../characters/character-css-service';
import { BaseHandlerArg, GenericHandler } from '../../types/common';

const buildDebugReport = async () => {
  const modsPath = (store.get('modsPath') as string | null) || null;
  const pluginsPath = (store.get('pluginsPath') as string | null) || null;
  const selectedSsbuVersion = store.get('ssbuVersion');
  const mods = await getDebugLibrarySnapshot('mods', modsPath);
  const plugins = await getDebugLibrarySnapshot('plugins', pluginsPath);
  const otherFiles = [...mods.otherFiles, ...plugins.otherFiles];

  return {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    app: {
      name: app.getName(),
      version: app.getVersion(),
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome,
      nodeVersion: process.versions.node,
    },
    system: {
      platform: process.platform,
      architecture: process.arch,
      osRelease: os.release(),
      totalMemoryBytes: os.totalmem(),
      cpuCount: os.cpus().length,
      locale: app.getLocale(),
    },
    configuration: {
      runMode: store.get('appRunMode') || 'emulator',
      ssbuVersion:
        selectedSsbuVersion === '13.0.4' || selectedSsbuVersion === '13.0.5'
          ? selectedSsbuVersion
          : null,
      hardwareLibraryMode: store.get('hardwareLibraryMode') || null,
      emulatorType: store.get('emulatorType') || null,
      modsPath,
      pluginsPath,
    },
    cssEditor: getCharacterCssDebugReport(),
    libraries: {
      mods: {
        configured: mods.configured,
        activeCount: mods.activeCount,
        disabledCount: mods.disabledCount,
        scanError: mods.scanError,
        source: mods.source,
        snapshotAt: mods.snapshotAt,
        items: mods.items,
      },
      plugins: {
        configured: plugins.configured,
        activeCount: plugins.activeCount,
        disabledCount: plugins.disabledCount,
        scanError: plugins.scanError,
        source: plugins.source,
        snapshotAt: plugins.snapshotAt,
        items: plugins.items,
      },
      ...(otherFiles.length > 0
        ? {
            otherFiles: {
              count: otherFiles.length,
              items: otherFiles,
            },
          }
        : {}),
    },
  };
};

const anonymizeHomeDirectory = (value: unknown): unknown => {
  const homeDirectory = os.homedir();
  if (!homeDirectory) return value;

  const escapedHomeDirectory = homeDirectory
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/[\\/]/g, '[\\\\/]');
  const homeDirectoryPattern = new RegExp(
    `${escapedHomeDirectory}(?=[\\\\/]|$)`,
    process.platform === 'win32' ? 'gi' : 'g',
  );
  const redactString = (text: string) => text.replace(homeDirectoryPattern, '~');

  const anonymize = (nestedValue: unknown): unknown => {
    if (typeof nestedValue === 'string') return redactString(nestedValue);
    if (Array.isArray(nestedValue)) return nestedValue.map(anonymize);
    if (nestedValue && typeof nestedValue === 'object') {
      return Object.fromEntries(
        Object.entries(nestedValue).map(([key, childValue]) => [
          redactString(key),
          anonymize(childValue),
        ]),
      );
    }

    return nestedValue;
  };

  return anonymize(value);
};

const exportDebugReport = async (
  common: BaseHandlerArg,
  anonymizeUserPaths = true,
) => {
  const win = BrowserWindow.fromWebContents(common.event.sender);
  if (!win) return { success: false, error: 'No application window found' };

  const date = new Date().toISOString().slice(0, 10);
  const result = await dialog.showSaveDialog(win, {
    title: 'Export diagnostic report',
    defaultPath: `mosaic-debug-${date}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });

  if (result.canceled || !result.filePath) {
    return { success: false, canceled: true };
  }

  try {
    const report = await buildDebugReport();
    const exportReport = anonymizeUserPaths
      ? anonymizeHomeDirectory(report)
      : report;
    fs.writeFileSync(
      result.filePath,
      JSON.stringify(exportReport, null, 2),
      'utf8',
    );
    return { success: true, filePath: result.filePath };
  } catch (error) {
    return { success: false, error: error.message || String(error) };
  }
};

export type AppHandlers = typeof AppHandlers;

const AppHandlers = {
  ['get-app-version']: async (common: BaseHandlerArg) => {
    return {
      version: app.getVersion(),
      name: app.getName(),
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node,
      chromeVersion: process.versions.chrome,
    };
  },

  ['export-debug-report']: exportDebugReport,

  ['relaunch-app']: async (common: BaseHandlerArg) => {
    app.relaunch();
    app.exit(0);
    return { success: true };
  },
} as const;

/**
 * Register all IPC handlers related to app operations
 * @param {Electron.IpcMain} ipcMain - Electron IPC main instance
 */
export function registerAppHandlers(ipcMain: IpcMain) {
  for (const channel of Object.keys(AppHandlers) as Array<
    keyof typeof AppHandlers
  >) {
    const handler = AppHandlers[channel] as GenericHandler;

    ipcMain.handle(channel, (event, ...rest: unknown[]) => {
      return handler({ event }, ...rest);
    });
  }
}
