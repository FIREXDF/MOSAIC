import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import ModUtils, { Mod } from './mod-utils';
import PluginUtils, { SimplePlugin } from './plugin-utils';
import store from './store';
import downloadsStore from './store-downloads';
import { resolveVirtualPath } from './utils/virtual-paths';
import { identifyPluginVersions } from './plugin-version-identification';

type Library = 'mods' | 'plugins';
type Status = 'active' | 'disabled';

type OtherFile = {
  library: Library;
  status: Status;
  name: string;
  relativePath: string;
  sizeBytes: number;
};

type Snapshot = {
  id: string;
  path: string;
  savedAt: string;
  activeCount: number;
  disabledCount: number;
  items: object[];
  otherFiles: OtherFile[];
};

type Snapshots = Partial<Record<Library, Snapshot>>;

const cacheKey = 'debugLibrarySnapshots';

function readSnapshots(): Snapshots {
  return (store.get(cacheKey) || {}) as Snapshots;
}

function saveSnapshot(library: Library, snapshot: Snapshot) {
  try {
    store.set(cacheKey, { ...readSnapshots(), [library]: snapshot });
  } catch (error) {
    console.warn('[DebugReport] Failed to save library snapshot:', error);
  }
}

function assertReadableDirectory(folderPath: string) {
  const resolvedPath = resolveVirtualPath(folderPath);
  if (!fs.statSync(resolvedPath).isDirectory()) {
    throw new Error(`Not a directory: ${folderPath}`);
  }
  fs.readdirSync(resolvedPath);
  return resolvedPath;
}

function collectOtherFiles(
  library: Library,
  status: Status,
  folderPath: string,
  excludedPaths: string[],
): OtherFile[] {
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

  const files: OtherFile[] = [];
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
        } catch {}
      }
    }
  }

  return files.sort((a, b) =>
    a.relativePath.localeCompare(b.relativePath, undefined, {
      numeric: true,
      sensitivity: 'base',
    }),
  );
}

function getPluginSourceUrl(repository: string | null) {
  if (!repository) return null;
  if (/^https?:\/\//i.test(repository)) return repository;
  const gameBananaMatch = repository.match(/^GameBanana\/(\d+)$/i);
  if (gameBananaMatch)
    return `https://gamebanana.com/mods/${gameBananaMatch[1]}`;
  return `https://github.com/${repository.replace(/^\/+|\/+$/g, '')}`;
}

export function captureModsDebugSnapshot(
  modsPath: string,
  mods: ReturnType<typeof ModUtils.readAllMods>,
) {
  try {
    assertReadableDirectory(modsPath);
    const modDownloadLinks = (downloadsStore.get('downloads') || {}) as Record<
      string,
      string
    >;
    const formatMod = (mod: Mod, status: Status) => {
      let info: ReturnType<typeof ModUtils.readModInfo> = null;
      try {
        info = ModUtils.readModInfo(mod.path);
      } catch {
        // Keep this mod when its optional metadata is unreadable.
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
    const otherFiles = [
      ...collectOtherFiles(
        'mods',
        'active',
        modsPath,
        mods.activeMods.map((mod) => mod.path),
      ),
      ...collectOtherFiles(
        'mods',
        'disabled',
        ModUtils.getDisabledModsFolder(modsPath),
        mods.disabledMods.map((mod) => mod.path),
      ),
    ];
    const snapshot: Snapshot = {
      id: crypto.randomUUID(),
      path: modsPath,
      savedAt: new Date().toISOString(),
      activeCount: mods.activeMods.length,
      disabledCount: mods.disabledMods.length,
      items: [
        ...mods.activeMods.map((mod) => formatMod(mod, 'active')),
        ...mods.disabledMods.map((mod) => formatMod(mod, 'disabled')),
      ],
      otherFiles,
    };
    saveSnapshot('mods', snapshot);
    return snapshot;
  } catch (error) {
    console.warn('[DebugReport] Failed to cache mods:', error);
    return null;
  }
}

export function capturePluginsDebugSnapshot(
  pluginsPath: string,
  plugins: ReturnType<typeof PluginUtils.readAllPlugins>,
  identifyInBackground = true,
) {
  try {
    assertReadableDirectory(pluginsPath);
    const previous = readSnapshots().plugins;
    const pluginVersions = (store.get('pluginVersions') || {}) as Record<
      string,
      string
    >;
    const pluginRepoMappings = (store.get('pluginRepoMappings') ||
      {}) as Record<string, string>;
    const formatPlugin = (plugin: SimplePlugin, status: Status) => {
      const pluginId = path.basename(plugin.name, path.extname(plugin.name));
      const repository =
        pluginRepoMappings[pluginId] || pluginRepoMappings[plugin.name] || null;
      return {
        name: plugin.name,
        status,
        size: plugin.size,
        version: pluginVersions[pluginId] || null,
        recordedVersion: pluginVersions[pluginId] || null,
        actualVersion: null as string | null,
        sha256: null as string | null,
        matchedHash: null as string | null,
        matchedHashAlgorithm: null as string | null,
        versionLookupStatus: 'pending',
        repository,
        sourceUrl: getPluginSourceUrl(repository),
      };
    };
    const otherFiles = [
      ...collectOtherFiles(
        'plugins',
        'active',
        pluginsPath,
        plugins.activePlugins.map((plugin) => plugin.path),
      ),
      ...collectOtherFiles(
        'plugins',
        'disabled',
        PluginUtils.getDisabledPluginsFolder(pluginsPath),
        plugins.disabledPlugins.map((plugin) => plugin.path),
      ),
    ];
    const snapshot: Snapshot = {
      id: crypto.randomUUID(),
      path: pluginsPath,
      savedAt: new Date().toISOString(),
      activeCount: plugins.activePlugins.length,
      disabledCount: plugins.disabledPlugins.length,
      items: [
        ...plugins.activePlugins.map((plugin) =>
          formatPlugin(plugin, 'active'),
        ),
        ...plugins.disabledPlugins.map((plugin) =>
          formatPlugin(plugin, 'disabled'),
        ),
      ],
      otherFiles,
    };
    saveSnapshot('plugins', snapshot);
    if (identifyInBackground) {
      void refreshPluginVersionSnapshot(snapshot, plugins, previous).catch(
        (error) =>
          console.warn('[DebugReport] Plugin identification failed:', error),
      );
    }
    return snapshot;
  } catch (error) {
    console.warn('[DebugReport] Failed to cache plugins:', error);
    return null;
  }
}

async function refreshPluginVersionSnapshot(
  snapshot: Snapshot,
  plugins: ReturnType<typeof PluginUtils.readAllPlugins>,
  previous?: Snapshot,
) {
  const pluginPaths = [
    ...plugins.activePlugins.map((plugin) => plugin.path),
    ...plugins.disabledPlugins.map((plugin) => plugin.path),
  ];
  const identified = await identifyPluginVersions(pluginPaths);
  const enriched = {
    ...snapshot,
    items: snapshot.items.map((item, index) => {
      const identity = identified.get(pluginPaths[index]);
      const plugin = item as { name: string; status: Status };
      const previousItem =
        previous?.path === snapshot.path
          ? (previous.items.find((entry) => {
              const old = entry as { name?: string; status?: Status };
              return old.name === plugin.name && old.status === plugin.status;
            }) as
              | {
                  sha256?: string;
                  actualVersion?: string;
                  matchedHash?: string;
                  matchedHashAlgorithm?: string;
                }
              | undefined)
          : undefined;
      const reuseKnownVersion =
        identity?.status === 'lookup-failed' &&
        identity.sha256 === previousItem?.sha256 &&
        Boolean(previousItem?.actualVersion);
      return {
        ...item,
        actualVersion: reuseKnownVersion
          ? previousItem?.actualVersion
          : identity?.actualVersion || null,
        sha256: identity?.sha256 || null,
        matchedHash: reuseKnownVersion
          ? previousItem?.matchedHash || null
          : identity?.matchedHash || null,
        matchedHashAlgorithm: reuseKnownVersion
          ? previousItem?.matchedHashAlgorithm || null
          : identity?.matchedHashAlgorithm || null,
        versionLookupStatus: reuseKnownVersion
          ? 'cached-match'
          : identity?.status || 'unreadable',
      };
    }),
  };
  if (readSnapshots().plugins?.id === snapshot.id) {
    saveSnapshot('plugins', enriched);
  }
  return enriched;
}

export async function getDebugLibrarySnapshot(
  library: Library,
  folderPath: string | null,
) {
  if (!folderPath) {
    return {
      configured: false,
      activeCount: 0,
      disabledCount: 0,
      scanError: null,
      source: 'unconfigured',
      snapshotAt: null,
      items: [] as object[],
      otherFiles: [] as OtherFile[],
    };
  }

  try {
    assertReadableDirectory(folderPath);
    let snapshot: Snapshot | null;
    if (library === 'mods') {
      snapshot = captureModsDebugSnapshot(
        folderPath,
        ModUtils.readAllMods(folderPath),
      );
    } else {
      const plugins = PluginUtils.readAllPlugins(folderPath);
      const previous = readSnapshots().plugins;
      const initial = capturePluginsDebugSnapshot(folderPath, plugins, false);
      snapshot = initial
        ? await refreshPluginVersionSnapshot(initial, plugins, previous)
        : null;
    }
    if (!snapshot) throw new Error('Library snapshot failed');
    return {
      configured: true,
      activeCount: snapshot.activeCount,
      disabledCount: snapshot.disabledCount,
      scanError: null,
      source: 'live',
      snapshotAt: snapshot.savedAt,
      items: snapshot.items,
      otherFiles: snapshot.otherFiles,
    };
  } catch (error) {
    const cached = readSnapshots()[library];
    const snapshot = cached?.path === folderPath ? cached : null;
    return {
      configured: true,
      activeCount: snapshot?.activeCount || 0,
      disabledCount: snapshot?.disabledCount || 0,
      scanError: error.message || String(error),
      source: snapshot ? 'cache' : 'unavailable',
      snapshotAt: snapshot?.savedAt || null,
      items: snapshot?.items || [],
      otherFiles: snapshot?.otherFiles || [],
    };
  }
}
