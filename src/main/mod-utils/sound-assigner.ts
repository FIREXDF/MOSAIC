import fs from 'fs';
import path from 'path';
import * as fse from 'fs-extra';

import { PATHS } from '../config';
import { ModFileOperations } from '../mod-file-operations';
import { ConfigGenerator } from './config-generator';
import { SlotChanger } from './slot-changer';

const SLOT_PATTERN = /^c\d{2,3}$/i;
const SOUND_FILE_PATTERN = /^(se|vc)_(.+?)(?:_c(\d{2,3}))?(\.[^.]+)$/i;

export interface SoundModInfo {
  fighters: string[];
  files: string[];
}

export class SoundAssigner {
  static async isSoundMod(modPath: string): Promise<boolean> {
    const directories = (await fse.readdir(modPath, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name.toLowerCase());

    return directories.includes('sound') && !directories.includes('fighter');
  }

  private static async readFighterNames(): Promise<Set<string>> {
    const namesData = await ModFileOperations.readModFile(
      path.join(PATHS.dataDir(), 'names.data'),
    );

    return new Set(namesData.split('\n').map((line) => line.split(',')[0].trim()));
  }

  static async readSoundMod(modPath: string): Promise<SoundModInfo> {
    if (!(await this.isSoundMod(modPath))) {
      throw new Error('This mod must have a sound folder and no fighter folder');
    }

    const soundRoot = path.join(modPath, 'sound');
    const entries = await fs.promises.readdir(soundRoot, {
      recursive: true,
      withFileTypes: true,
    });
    const files = entries
      .filter((entry) => entry.isFile() && !entry.name.startsWith('.'))
      .map((entry) =>
        path
          .relative(modPath, path.join(entry.parentPath, entry.name))
          .replace(/\\/g, '/'),
      );

    const fighterNames = await this.readFighterNames();
    const fighters = new Set<string>();
    const sourceSlots = new Set<string>();

    for (const file of files) {
      const match = path.posix.basename(file).match(SOUND_FILE_PATTERN);
      if (!match || !fighterNames.has(match[2].toLowerCase())) continue;

      fighters.add(match[2].toLowerCase());
      if (match[3]) sourceSlots.add(match[3]);
    }

    if (fighters.size === 0) {
      throw new Error('No fighter sound found in this mod');
    }

    if (sourceSlots.size > 1) {
      throw new Error(
        'This sound mod has several slots. Keep only one with Change Slot first',
      );
    }

    return {
      fighters: [...fighters],
      files,
    };
  }

  static async listModelSlots(
    modPath: string,
    fighters: string[],
  ): Promise<string[]> {
    const slotsByFighter = await Promise.all(
      fighters.map((fighter) => this.listFighterModelSlots(modPath, fighter)),
    );

    return slotsByFighter.reduce((common, slots) =>
      common.filter((slot) => slots.includes(slot)),
    );
  }

  private static async listFighterModelSlots(
    modPath: string,
    fighter: string,
  ): Promise<string[]> {
    const modelRoot = path.join(modPath, 'fighter', fighter, 'model');
    if (!(await fse.pathExists(modelRoot))) return [];

    const slots = new Set<string>();
    for (const part of await fse.readdir(modelRoot, { withFileTypes: true })) {
      if (!part.isDirectory()) continue;

      for (const entry of await fse.readdir(path.join(modelRoot, part.name), {
        withFileTypes: true,
      })) {
        if (entry.isDirectory() && SLOT_PATTERN.test(entry.name)) {
          slots.add(entry.name.toLowerCase());
        }
      }
    }

    return [...slots].sort(
      (left, right) => Number(left.slice(1)) - Number(right.slice(1)),
    );
  }

  static async assignToModel(
    soundModPath: string,
    targetModPath: string,
    slot: string,
  ) {
    if (!SLOT_PATTERN.test(slot)) {
      throw new Error(`Invalid slot: ${slot}`);
    }
    if (path.resolve(soundModPath) === path.resolve(targetModPath)) {
      throw new Error('The sound mod and the model mod must be different');
    }

    const targetSlot = slot.toLowerCase();
    const { fighters, files } = await this.readSoundMod(soundModPath);

    if (!(await this.listModelSlots(targetModPath, fighters)).includes(targetSlot)) {
      throw new Error(
        `The model mod has no ${fighters.join(' + ')} ${targetSlot} model`,
      );
    }

    await SlotChanger.backupMod(targetModPath);

    const addedFiles = new Map<string, string[]>();
    for (const file of files) {
      const fileName = path.posix.basename(file);
      const match = fileName.match(SOUND_FILE_PATTERN);
      const fighter = match?.[2].toLowerCase();
      const targetFile =
        match && fighter && fighters.includes(fighter)
          ? path.posix.join(
              path.posix.dirname(file),
              `${match[1]}_${match[2]}_${targetSlot}${match[4]}`,
            )
          : file;

      await fse.copy(
        path.join(soundModPath, file),
        path.join(targetModPath, targetFile),
        { overwrite: true },
      );

      if (
        fighter &&
        fighters.includes(fighter) &&
        !(await ConfigGenerator.isVanillaFile(targetFile))
      ) {
        addedFiles.set(fighter, [...(addedFiles.get(fighter) || []), targetFile]);
      }
    }

    if (addedFiles.size > 0) {
      const configPath = path.join(targetModPath, 'config.json');
      const config = (await fse.pathExists(configPath))
        ? await fse.readJson(configPath)
        : {};
      const newDirFiles = (config['new-dir-files'] ||= {});

      for (const [fighter, fighterFiles] of addedFiles) {
        const directoryKey = `fighter/${fighter}/${targetSlot}`;
        newDirFiles[directoryKey] = [
          ...new Set([...(newDirFiles[directoryKey] || []), ...fighterFiles]),
        ].sort();
      }

      await fse.writeJson(configPath, config, { spaces: 2 });
    }

    return { fighters, copiedFiles: files.length };
  }
}
