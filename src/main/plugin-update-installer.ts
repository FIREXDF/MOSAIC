import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { FileExtractor } from './utils/file-extractor';
import {
  findBundledArcropolisDirectory,
  getArcropolisDirectoryForLibrary,
} from './utils/arcropolis-installer';

export type PluginInstallResult =
  | {
      success: true;
      pluginPath: string;
      actualFileName: string;
    }
  | {
      success: false;
      error: string;
    };

export type ModInstallResult =
  | {
      success: true;
      resultingMods: {
        modPath: string;
        modName: string;
        textFiles: string[];
      }[];
    }
  | {
      success: false;
      error: string;
    };

export default class PluginUpdateInstaller {
  static async downloadFile(url, targetPath) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(targetPath);

      https
        .get(
          url,
          {
            headers: {
              'User-Agent': 'MOSAIC-Plugin-Updater',
            },
          },
          (res) => {
            if (
              res.statusCode &&
              res.statusCode >= 300 &&
              res.statusCode < 400 &&
              res.headers.location
            ) {
              file.close();
              fs.unlinkSync(targetPath);
              const redirectUrl = new URL(res.headers.location, url).toString();
              return this.downloadFile(redirectUrl, targetPath)
                .then(resolve)
                .catch(reject);
            }

            if (res.statusCode !== 200) {
              file.close();
              fs.unlinkSync(targetPath);
              reject(new Error(`HTTP ${res.statusCode}`));
              return;
            }

            res.pipe(file);

            file.on('finish', () => {
              file.close();
              resolve(targetPath);
            });
          },
        )
        .on('error', (err) => {
          file.close();
          if (fs.existsSync(targetPath)) {
            fs.unlinkSync(targetPath);
          }
          reject(err);
        });
    });
  }

  static findNroFile(dir) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isFile() && file.toLowerCase().endsWith('.nro')) {
        return filePath;
      }

      if (stat.isDirectory()) {
        const found = this.findNroFile(filePath);
        if (found) {
          return found;
        }
      }
    }

    return null;
  }

  static async installUpdate(
    downloadUrl: string,
    pluginPath: string,
    modsPath?: string | null,
  ): Promise<PluginInstallResult> {
    let tempRoot: string | null = null;
    try {
      if (!downloadUrl) {
        return {
          success: false,
          error: 'No download URL available',
        };
      }

      tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-update-'));
      const isZip =
        downloadUrl.toLowerCase().endsWith('.zip') ||
        downloadUrl.toLowerCase().includes('.zip');

      let downloadedFilePath;
      let nroFilePath;

      let actualFileName;
      let extractDir: string | null = null;

      if (isZip) {
        downloadedFilePath = path.join(tempRoot, 'release.zip');

        await this.downloadFile(downloadUrl, downloadedFilePath);

        if (!fs.existsSync(downloadedFilePath)) {
          return {
            success: false,
            error: 'Downloaded ZIP file not found',
          };
        }

        extractDir = path.join(tempRoot, 'extracted');
        await FileExtractor.extractArchive(downloadedFilePath, extractDir);

        nroFilePath = this.findNroFile(extractDir);

        if (!nroFilePath) {
          return {
            success: false,
            error: 'No .nro file found in the ZIP archive',
          };
        }
        actualFileName = path.basename(nroFilePath);
      } else {
        // Try to determine filename from URL
        try {
          const urlUrl = new URL(downloadUrl);
          const urlFilename = path.basename(urlUrl.pathname);
          if (urlFilename && urlFilename.toLowerCase().endsWith('.nro')) {
            actualFileName = decodeURIComponent(urlFilename);
          }
        } catch (e) {
          console.error('Error parsing filename from URL:', e);
        }

        // Fallback to pluginPath basename if URL parsing failed
        if (!actualFileName) {
          actualFileName = path.basename(pluginPath);
        }

        downloadedFilePath = path.join(tempRoot, 'plugin.nro');
        await this.downloadFile(downloadUrl, downloadedFilePath);
        nroFilePath = downloadedFilePath;
      }

      if (!fs.existsSync(nroFilePath)) {
        return {
          success: false,
          error: 'Downloaded file not found',
        };
      }

      // actualFileName is already set correctly above
      const pluginDir = path.dirname(pluginPath);
      const finalPluginPath = path.join(pluginDir, actualFileName);

      if (!fs.existsSync(pluginDir)) {
        fs.mkdirSync(pluginDir, { recursive: true });
      }

      if (extractDir && actualFileName.toLowerCase() === 'libarcropolis.nro') {
        const arcropolisSource = findBundledArcropolisDirectory(
          extractDir,
          nroFilePath,
        );
        if (arcropolisSource) {
          const arcropolisTarget = getArcropolisDirectoryForLibrary(
            pluginDir,
            modsPath,
          );
          fs.cpSync(arcropolisSource, arcropolisTarget, { recursive: true });
        }
      }

      fs.copyFileSync(nroFilePath, finalPluginPath);

      return {
        success: true,
        pluginPath: finalPluginPath,
        actualFileName: actualFileName,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    } finally {
      if (tempRoot) {
        try {
          fs.rmSync(tempRoot, { recursive: true, force: true });
        } catch (error) {
          console.warn('Failed to clean up plugin update:', error);
        }
      }
    }
  }
}
