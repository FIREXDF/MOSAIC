import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
const execAsync = promisify(exec);

interface Drive {
  letter: string;
  label: string;
  type: string;
  path: string;
}

export async function detectWindowsDrives() {
  if (process.platform !== 'win32') {
    return [];
  }

  try {
    const { stdout } = await execAsync(
      'wmic logicaldisk get name,volumename,drivetype',
    );

    const drives: Drive[] = [];

    const lines = stdout.split('\n').map((line) => line.trim());

    for (const line of lines) {
      if (!line) continue;

      const upperLine = line.toUpperCase();
      if (
        upperLine.includes('DRIVETYPE') ||
        upperLine.includes('NAME') ||
        upperLine.includes('VOLUMENAME')
      ) {
        continue;
      }

      const match = line.match(/^(\d+)\s+([A-Z]:)\s*(.*)$/i);
      if (!match) {
        continue;
      }

      const driveType = match[1];
      const driveName = match[2].toUpperCase();
      const letter = driveName.charAt(0);
      const volumeName = match[3] ? match[3].trim() : 'Local Disk';

      // Type 2 = Removable, Type 3 = Fixed, Type 4 = Network, Type 5 = CD-ROM
      if ((driveType === '2' || driveType === '3') && letter !== 'C') {
        drives.push({
          letter: letter,
          label: volumeName || 'Local Disk',
          type: driveType === '2' ? 'removable' : 'fixed',
          path: `${letter}:\\`,
        });
      }
    }

    console.log('Detected drives:', drives);

    if (drives.length === 0) {
      return await fallbackWindowsDetection();
    }

    return drives;
  } catch (error) {
    console.error('Error detecting drives with wmic:', error);
    return await fallbackWindowsDetection();
  }
}

async function fallbackWindowsDetection() {
  const fallbackDrives: Drive[] = [];
  const driveLetters = 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  for (const letter of driveLetters) {
    if (letter === 'C') continue;

    const drivePath = `${letter}:\\`;
    try {
      if (fs.existsSync(drivePath)) {
        let label = 'Unknown';
        try {
          const { stdout } = await execAsync(
            `wmic logicaldisk where "name='${letter}:'" get volumename`,
          );
          const labelLines = stdout
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l && !l.toUpperCase().includes('VOLUMENAME'));
          if (labelLines.length > 0 && labelLines[0]) {
            label = labelLines[0];
          }
        } catch (e) {
        }

        fallbackDrives.push({
          letter: letter,
          label: label || 'Unknown',
          type: 'unknown',
          path: drivePath,
        });
      }
    } catch (e) {
    }
  }

  console.log('Fallback detected drives:', fallbackDrives);
  return fallbackDrives;
}

export async function detectLinuxDrives() {
  if (process.platform !== 'linux') {
    return [];
  }

  try {
    const { stdout } = await execAsync('lsblk -n -o MOUNTPOINT,LABEL,TYPE');
    const lines = stdout.split('\n').filter((line) => line.trim());

    const drives: Drive[] = [];

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2 && parts[0] && parts[0] !== '') {
        const mountPoint = parts[0];
        const label = parts[1] || 'Unknown';
        const type = parts[2] || 'unknown';

        if (
          mountPoint === '/' ||
          mountPoint.startsWith('/boot') ||
          mountPoint.startsWith('/sys') ||
          mountPoint.startsWith('/proc')
        ) {
          continue;
        }

        const mountName =
          path.basename(mountPoint) || mountPoint.replace(/\//g, '_');

        drives.push({
          letter: mountName,
          label: label,
          type: type === 'disk' ? 'fixed' : 'removable',
          path: mountPoint,
        });
      }
    }

    return drives;
  } catch (error) {
    console.error('Error detecting drives on Linux:', error);

    try {
      const { stdout } = await execAsync(
        'df -h | grep -E "^/dev/" | awk \'{print $6}\'',
      );
      const mountPoints = stdout
        .split('\n')
        .filter((mp) => mp.trim() && mp !== '/');

      return mountPoints.map((mountPoint) => ({
        letter: path.basename(mountPoint) || mountPoint.replace(/\//g, '_'),
        label: 'Unknown',
        type: 'unknown',
        path: mountPoint.trim(),
      }));
    } catch (fallbackError) {
      console.error('Fallback drive detection failed:', fallbackError);
      return [];
    }
  }
}

export async function detectMacOSDrives() {
  if (process.platform !== 'darwin') {
    return [];
  }

  try {
    const { stdout } = await execAsync(
      'diskutil list -plist external physical',
    );

    const { stdout: dfOutput } = await execAsync(
      'df -h | grep -E "^/dev/disk"',
    );
    const lines = dfOutput.split('\n').filter((line) => line.trim());

    const drives: Drive[] = [];

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 6) {
        const mountPoint = parts[parts.length - 1];

        if (
          mountPoint === '/' ||
          mountPoint.startsWith('/System') ||
          mountPoint.startsWith('/private')
        ) {
          continue;
        }

        let label = 'Unknown';
        try {
          const { stdout: labelOutput } = await execAsync(
            `diskutil info "${mountPoint}" | grep "Volume Name" | awk -F': ' '{print $2}'`,
          );
          label = labelOutput.trim() || 'Unknown';
        } catch (e) {
          label = path.basename(mountPoint) || 'Unknown';
        }

        drives.push({
          letter: path.basename(mountPoint) || mountPoint.replace(/\//g, '_'),
          label: label,
          type: 'removable',
          path: mountPoint,
        });
      }
    }

    return drives;
  } catch (error) {
    console.error('Error detecting drives on macOS:', error);
    return [];
  }
}

export async function detectDrives() {
  if (process.platform === 'win32') {
    return await detectWindowsDrives();
  } else if (process.platform === 'linux') {
    return await detectLinuxDrives();
  } else if (process.platform === 'darwin') {
    return await detectMacOSDrives();
  } else {
    console.warn(
      `Drive detection not implemented for platform: ${process.platform}`,
    );
    return [];
  }
}

function canReadPath(targetPath: string) {
  try {
    return fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory();
  } catch (error) {
    return false;
  }
}

function normalizeDriveIdentifier(value: string) {
  return value
    .trim()
    .replace(/[\\/]+$/g, '')
    .toLowerCase();
}

/**
 * Resolve a saved drive identifier to the current mounted path.
 * Older settings may contain a label such as "Ventoy" instead of
 * "/media/<user>/Ventoy", so checks must handle both formats.
 */
export async function resolveDrivePath(driveIdentifier: string) {
  if (!driveIdentifier || typeof driveIdentifier !== 'string') {
    return null;
  }

  const trimmedIdentifier = driveIdentifier.trim();
  if (!trimmedIdentifier) {
    return null;
  }

  const directCandidates = [trimmedIdentifier];

  if (/^[A-Z]$/i.test(trimmedIdentifier)) {
    directCandidates.push(`${trimmedIdentifier}:\\`);
  }

  const userName =
    process.env.USER || process.env.USERNAME || os.userInfo().username;
  if (
    !trimmedIdentifier.startsWith('/') &&
    !trimmedIdentifier.includes(':\\')
  ) {
    if (process.platform === 'linux') {
      directCandidates.push(
        `/media/${userName}/${trimmedIdentifier}`,
        `/run/media/${userName}/${trimmedIdentifier}`,
        `/mnt/${trimmedIdentifier}`,
      );
    } else if (process.platform === 'darwin') {
      directCandidates.push(`/Volumes/${trimmedIdentifier}`);
    }
  }

  const existingCandidate = directCandidates.find(canReadPath);
  if (existingCandidate) {
    return existingCandidate;
  }

  const normalizedIdentifier = normalizeDriveIdentifier(trimmedIdentifier);
  const drives = await detectDrives();
  const matchingDrive = drives.find((drive) => {
    const values = [
      drive.path,
      drive.letter,
      drive.label,
      path.basename(drive.path),
    ]
      .filter(Boolean)
      .map(normalizeDriveIdentifier);

    return values.includes(normalizedIdentifier);
  });

  return matchingDrive?.path || null;
}

export function isDriveAccessible(drivePath: string) {
  try {
    return fs.existsSync(drivePath);
  } catch (error) {
    return false;
  }
}

export function isSwitchSdCard(basePath: string) {
  try {
    const atmospherePath = path.join(basePath, 'atmosphere');
    const exists = fs.existsSync(atmospherePath);
    return exists;
  } catch (error) {
    return false;
  }
}
