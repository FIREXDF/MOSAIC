import { app, BrowserWindow, dialog, IpcMain } from 'electron';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import ModUtils, { Mod } from '../../mod-utils';
import PluginUtils, { SimplePlugin } from '../../plugin-utils';
import { resolveVirtualPath } from '../../utils/virtual-paths';
import store from '../../store';
import downloadsStore from '../../store-downloads';
import { getCharacterCssDebugReport } from '../../characters/character-css-service';
import { BaseHandlerArg, GenericHandler } from '../../types/common';

const getPluginSourceUrl = (repository: string | null | undefined) => {
  if (!repository) return null;
  if (/^https?:\/\//i.test(repository)) return repository;

  const gameBananaMatch = repository.match(/^GameBanana\/(\d+)$/i);
  if (gameBananaMatch) {
    return `https://gamebanana.com/mods/${gameBananaMatch[1]}`;
  }

  return `https://github.com/${repository.replace(/^\/+|\/+$/g, '')}`;
};

const collectOtherFiles = (
  library: 'mods' | 'plugins',
  status: 'active' | 'disabled',
  folderPath: string,
  excludedPaths: string[],
) => {
  const resolvedFolderPath = resolveVirtualPath(folderPath);
  if (!fs.existsSync(resolvedFolderPath)) return [];

  const resolvedExcludedPaths = excludedPaths.map((excludedPath) =>
    path.resolve(excludedPath),
  );
  const isExcluded = (candidatePath: string) =>
    resolvedExcludedPaths.some((excludedPath) => {
      const relativePath = path.relative(excludedPath, candidatePath);
      return (
        relativePath === '' ||
        (relativePath !== '..' &&
          !relativePath.startsWith(`..${path.sep}`) &&
          !path.isAbsolute(relativePath))
      );
    });

  const files: Array<{
    library: 'mods' | 'plugins';
    status: 'active' | 'disabled';
    name: string;
    relativePath: string;
    sizeBytes: number;
  }> = [];
  const pendingDirectories = [resolvedFolderPath];

  while (pendingDirectories.length > 0) {
    const currentDirectory = pendingDirectories.pop();
    if (!currentDirectory || isExcluded(currentDirectory)) continue;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDirectory, { withFileTypes: true });
    } catch (error) {
      console.warn('[DebugReport] Failed to scan for other files:', {
        folderPath: currentDirectory,
        error: error.message || String(error),
      });
      continue;
    }

    for (const entry of entries) {
      const filePath = path.join(currentDirectory, entry.name);
      if (isExcluded(filePath)) continue;

      if (entry.isDirectory()) {
        pendingDirectories.push(filePath);
      } else if (entry.isFile()) {
        try {
          files.push({
            library,
            status,
            name: entry.name,
            relativePath: path
              .relative(resolvedFolderPath, filePath)
              .split(path.sep)
              .join('/'),
            sizeBytes: fs.statSync(filePath).size,
          });
        } catch {
          // Skip files that disappear or become inaccessible during the scan.
        }
      }
    }
  }

  return files.sort((a, b) =>
    a.relativePath.localeCompare(b.relativePath, undefined, {
      numeric: true,
      sensitivity: 'base',
    }),
  );
};

const buildDebugReport = () => {
  const modsPath = (store.get('modsPath') as string | null) || null;
  const pluginsPath = (store.get('pluginsPath') as string | null) || null;
  const pluginVersions = (store.get('pluginVersions') || {}) as Record<
    string,
    string
  >;
  const pluginRepoMappings = (store.get('pluginRepoMappings') || {}) as Record<
    string,
    string
  >;
  const modDownloadLinks = (downloadsStore.get('downloads') || {}) as Record<
    string,
    string
  >;

  let mods: ReturnType<typeof ModUtils.readAllMods> = {
    activeMods: [],
    disabledMods: [],
  };
  let modsScanError: string | null = null;
  if (modsPath) {
    try {
      mods = ModUtils.readAllMods(modsPath);
    } catch (error) {
      modsScanError = error.message || String(error);
    }
  }

  let plugins: ReturnType<typeof PluginUtils.readAllPlugins> = {
    activePlugins: [],
    disabledPlugins: [],
  };
  let pluginsScanError: string | null = null;
  if (pluginsPath) {
    try {
      plugins = PluginUtils.readAllPlugins(pluginsPath);
    } catch (error) {
      pluginsScanError = error.message || String(error);
    }
  }

  const formatMod = (mod: Mod, status: 'active' | 'disabled') => {
    let info: ReturnType<typeof ModUtils.readModInfo> = null;
    try {
      info = ModUtils.readModInfo(mod.path);
    } catch {
      // Keep the mod in the report even when its optional metadata is unreadable.
    }

    return {
      name: info?.display_name || mod.name,
      folderName: mod.folderName || mod.name,
      status,
      version: info?.version || null,
      authors: info?.authors || null,
      category: info?.category || null,
      sourceUrl:
        info?.url ||
        modDownloadLinks[
          crypto
            .createHash('sha256')
            .update(mod.folderName || mod.name)
            .digest('hex')
            .substring(0, 12)
        ] ||
        null,
    };
  };

  const formatPlugin = (
    plugin: SimplePlugin,
    status: 'active' | 'disabled',
  ) => {
    const pluginId = path.basename(plugin.name, path.extname(plugin.name));
    const repository =
      pluginRepoMappings[pluginId] || pluginRepoMappings[plugin.name] || null;

    return {
      name: plugin.name,
      status,
      size: plugin.size,
      version: pluginVersions[pluginId] || null,
      repository,
      sourceUrl: getPluginSourceUrl(repository),
    };
  };

  const otherFiles = [
    ...(modsPath
      ? collectOtherFiles(
          'mods',
          'active',
          modsPath,
          mods.activeMods.map((mod) => mod.path),
        )
      : []),
    ...(modsPath
      ? collectOtherFiles(
          'mods',
          'disabled',
          ModUtils.getDisabledModsFolder(modsPath),
          mods.disabledMods.map((mod) => mod.path),
        )
      : []),
    ...(pluginsPath
      ? collectOtherFiles(
          'plugins',
          'active',
          pluginsPath,
          plugins.activePlugins.map((plugin) => plugin.path),
        )
      : []),
    ...(pluginsPath
      ? collectOtherFiles(
          'plugins',
          'disabled',
          PluginUtils.getDisabledPluginsFolder(pluginsPath),
          plugins.disabledPlugins.map((plugin) => plugin.path),
        )
      : []),
  ];

  return {
    schemaVersion: 1,
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
      emulatorType: store.get('emulatorType') || null,
      modsPath,
      pluginsPath,
    },
    cssEditor: getCharacterCssDebugReport(),
    libraries: {
      mods: {
        configured: Boolean(modsPath),
        activeCount: mods.activeMods.length,
        disabledCount: mods.disabledMods.length,
        scanError: modsScanError,
        items: [
          ...mods.activeMods.map((mod) => formatMod(mod, 'active')),
          ...mods.disabledMods.map((mod) => formatMod(mod, 'disabled')),
        ],
      },
      plugins: {
        configured: Boolean(pluginsPath),
        activeCount: plugins.activePlugins.length,
        disabledCount: plugins.disabledPlugins.length,
        scanError: pluginsScanError,
        items: [
          ...plugins.activePlugins.map((plugin) =>
            formatPlugin(plugin, 'active'),
          ),
          ...plugins.disabledPlugins.map((plugin) =>
            formatPlugin(plugin, 'disabled'),
          ),
        ],
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
    const report = buildDebugReport();
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
