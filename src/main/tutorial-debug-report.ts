import { app } from 'electron';
import { execFile } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import store from './store/store';
import { getPluginSha256 } from './plugins/plugin-version-identification';

const ARCROPOLIS_TITLE_ID = '01006A800016E000';
const MAX_TREE_ENTRIES = 400;
const MAX_TREE_DEPTH = 8;

type TreeEntry = {
  path: string;
  type: 'dir' | 'file';
  size?: number;
  modifiedAt?: string;
  sha256?: string;
  error?: string;
};

const listTree = async (root: string) => {
  const entries: TreeEntry[] = [];
  let truncated = false;

  const walk = async (dir: string, depth: number) => {
    let names: fs.Dirent[];
    try {
      names = fs.readdirSync(dir, { withFileTypes: true });
    } catch (error) {
      entries.push({
        path: path.relative(root, dir) || '.',
        type: 'dir',
        error: error.message,
      });
      return;
    }
    for (const dirent of names) {
      if (entries.length >= MAX_TREE_ENTRIES) {
        truncated = true;
        return;
      }
      const fullPath = path.join(dir, dirent.name);
      const relativePath = path.relative(root, fullPath).replace(/\\/g, '/');
      if (dirent.isDirectory()) {
        entries.push({ path: `${relativePath}/`, type: 'dir' });
        if (depth < MAX_TREE_DEPTH) await walk(fullPath, depth + 1);
        continue;
      }
      const stat = fs.statSync(fullPath);
      const entry: TreeEntry = {
        path: relativePath,
        type: 'file',
        size: stat.size,
        modifiedAt: stat.mtime.toISOString(),
      };
      if (/\.(nro|nso|npdm)$/i.test(dirent.name) || dirent.name === 'main') {
        entry.sha256 = await getPluginSha256(fullPath).catch(() => undefined);
      }
      entries.push(entry);
    }
  };

  await walk(root, 0);
  return { entries, truncated };
};

const describeFolder = async (folderPath: string, withTree: boolean) => {
  if (!fs.existsSync(folderPath)) return { path: folderPath, exists: false };
  return {
    path: folderPath,
    exists: true,
    ...(withTree ? await listTree(folderPath) : {}),
  };
};

const listNames = (folderPath: string) => {
  try {
    return fs.readdirSync(folderPath);
  } catch {
    return null;
  }
};

const runForOutput = (command: string, args: string[]) =>
  new Promise<string | null>((resolve) => {
    execFile(command, args, { timeout: 5000, windowsHide: true }, (error, stdout) =>
      resolve(error ? null : stdout.trim() || null),
    );
  });

const getFileSystemType = (target: string) => {
  if (process.platform === 'win32') {
    const root = path.parse(path.resolve(target)).root.replace(/'/g, "''");
    return runForOutput('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `[System.IO.DriveInfo]::new('${root}').DriveFormat`,
    ]);
  }
  if (process.platform === 'linux') {
    return runForOutput('findmnt', ['-n', '-o', 'FSTYPE', '--target', target]);
  }
  return Promise.resolve(null);
};

const describeDisk = async (target: string) => {
  try {
    const stats = await fs.promises.statfs(target);
    return {
      fileSystem: await getFileSystemType(target),
      freeBytes: stats.bavail * stats.bsize,
      totalBytes: stats.blocks * stats.bsize,
    };
  } catch (error) {
    return { error: error.message };
  }
};

const describeDataRoot = async (source: string, dataRoot: string) => {
  const atmosphere = path.join(dataRoot, 'atmosphere');
  const contents = path.join(atmosphere, 'contents', ARCROPOLIS_TITLE_ID);
  const ultimate = path.join(dataRoot, 'ultimate');
  return {
    source,
    dataRoot,
    dataRootExists: fs.existsSync(dataRoot),
    disk: fs.existsSync(dataRoot) ? await describeDisk(dataRoot) : null,
    rootEntries: listNames(dataRoot),
    atmosphereEntries: listNames(atmosphere),
    contentsEntries: listNames(path.join(atmosphere, 'contents')),
    arcropolisContents: await describeFolder(contents, true),
    legacyTitlesFolder: await describeFolder(
      path.join(atmosphere, 'titles', ARCROPOLIS_TITLE_ID),
      true,
    ),
    ultimateEntries: listNames(ultimate),
    modsFolderEntries: listNames(path.join(ultimate, 'mods'))?.length ?? null,
    arcropolisConfig: await describeFolder(
      path.join(ultimate, 'arcropolis'),
      true,
    ),
  };
};

export const buildTutorialDebugReport = async (context: unknown) => {
  const tutorial = (store.get('tutorial') as Record<string, unknown>) || {};
  const candidates: Array<[string, unknown, string | null]> = [
    ['switch-sd', tutorial.sdDrive, null],
    ['yuzu', tutorial.yuzuPath, 'sdmc'],
    ['ryujinx', tutorial.ryujinxPath, 'sdcard'],
  ];
  const installTargets = await Promise.all(
    candidates
      .filter(([, base]) => typeof base === 'string' && base)
      .map(([source, base, folder]) =>
        describeDataRoot(
          source,
          folder ? path.join(base as string, folder) : (base as string),
        ),
      ),
  );

  return {
    kind: 'mosaic-tutorial-debug',
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    context,
    app: {
      version: app.getVersion(),
      electronVersion: process.versions.electron,
    },
    system: {
      platform: process.platform,
      architecture: process.arch,
      osRelease: os.release(),
      locale: app.getLocale(),
    },
    tutorial,
    install: {
      pluginLoader: store.get('pluginLoader') ?? null,
      pluginLoaderVersion: store.get('pluginLoaderVersion') ?? null,
      arcropolisVersion: store.get('arcropolisVersion') ?? null,
      appRunMode: store.get('appRunMode') ?? null,
      emulatorType: store.get('emulatorType') ?? null,
      modsPath: store.get('modsPath') ?? null,
      pluginsPath: store.get('pluginsPath') ?? null,
    },
    installTargets,
  };
};
