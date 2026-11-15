import * as fs from 'fs';
import * as path from 'path';
import { PATHS } from '../config';

export type PluginBackup = {
  installedFileName: string;
  fileName: string;
  version: string | null;
};

const backupDir = (installedFileName: string) =>
  path.join(PATHS.pluginBackupsDir(), installedFileName.toLowerCase());

function readMeta(dir: string): PluginBackup | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
  } catch {
    return null;
  }
}

export function savePluginBackup(
  oldPluginPath: string,
  installedFileName: string,
  version: string | null,
) {
  const dir = backupDir(installedFileName);
  const pendingDir = `${dir}.fp-pending`;
  const fileName = path.basename(oldPluginPath);
  const meta: PluginBackup = { installedFileName, fileName, version };

  fs.rmSync(pendingDir, { recursive: true, force: true });
  fs.mkdirSync(pendingDir, { recursive: true });
  fs.copyFileSync(oldPluginPath, path.join(pendingDir, fileName));
  fs.writeFileSync(path.join(pendingDir, 'meta.json'), JSON.stringify(meta));
  fs.rmSync(dir, { recursive: true, force: true });
  fs.renameSync(pendingDir, dir);
}

export function listPluginBackups(): PluginBackup[] {
  const root = PATHS.pluginBackupsDir();
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root)
    .map((name) => readMeta(path.join(root, name)))
    .filter((meta): meta is PluginBackup => !!meta);
}

export function restorePluginBackup(currentPluginPath: string) {
  const dir = backupDir(path.basename(currentPluginPath));
  const meta = readMeta(dir);
  if (!meta) throw new Error('No previous version saved for this plugin');

  const target = path.join(path.dirname(currentPluginPath), meta.fileName);
  fs.copyFileSync(path.join(dir, meta.fileName), target);
  if (
    path.resolve(target).toLowerCase() !==
    path.resolve(currentPluginPath).toLowerCase()
  ) {
    fs.rmSync(currentPluginPath, { force: true });
  }
  fs.rmSync(dir, { recursive: true, force: true });
  return meta;
}

export function deletePluginBackups() {
  const root = PATHS.pluginBackupsDir();
  const count = fs.existsSync(root) ? fs.readdirSync(root).length : 0;
  fs.rmSync(root, { recursive: true, force: true });
  return count;
}

export function isNroFile(filePath: string) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const magic = Buffer.alloc(4);
    fs.readSync(fd, magic, 0, 4, 0x10);
    return magic.toString('ascii') === 'NRO0';
  } finally {
    fs.closeSync(fd);
  }
}
