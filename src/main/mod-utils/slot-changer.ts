import path from 'path';
import * as fse from 'fs-extra';
import { XMLParser } from 'fast-xml-parser';

import { PathData, PathDataEntry } from './mod-scanner';
import { ModFileOperations } from '../mod-file-operations';
import { ConfigGenerator } from './config-generator';
import { PATHS } from '../config';

interface CustomData {
  cspName?: string;
  vsName?: string;
  boxingRing?: string;
  announcer?: string;
}

export type ConfigMode = 'merge' | 'regenerate';

const SLOT_PATTERN = /^c\d{2,3}$/;

interface SlotPathMapping {
  originalPath: string;
  tempPath: string;
  finalPath: string;
  type: 'file' | 'directory';
}

export class SlotChanger {
  private static normalizeRelativePath(relativePath: string): string {
    return relativePath.replace(/\\/g, '/');
  }

  private static buildFinalPath(normalizedPath: string, newSlot: string): string {
    let newNum = newSlot.replace('c', '');
    if (newNum.length === 1) newNum = '0' + newNum;

    return normalizedPath.replace(/###/g, newNum);
  }

  private static buildTempPath(
    originalPath: string,
    currentSlot: string,
  ): string {
    const tempPathParts = originalPath.split(/[/\\]/);
    const lastPart = tempPathParts[tempPathParts.length - 1];

    tempPathParts[tempPathParts.length - 1] = `.temp_${currentSlot}_${lastPart}`;

    return tempPathParts.join('/');
  }

  private static createSlotPathMapping(
    currentSlot: string,
    newSlot: string,
    pathEntry: PathDataEntry,
  ): SlotPathMapping | null {
    if (!pathEntry.normalized) {
      console.warn(
        '[changeSlots] Normalized path is null for original path:',
        pathEntry.original,
      );
      return null;
    }

    return {
      originalPath: this.normalizeRelativePath(pathEntry.original),
      tempPath: this.normalizeRelativePath(
        this.buildTempPath(pathEntry.original, currentSlot),
      ),
      finalPath: this.normalizeRelativePath(
        this.buildFinalPath(pathEntry.normalized, newSlot),
      ),
      type: pathEntry.type,
    };
  }

  private static findContainingDirectoryMapping(
    filePath: string,
    directoryMappings: SlotPathMapping[],
  ): SlotPathMapping | null {
    const normalizedFilePath = this.normalizeRelativePath(filePath);
    let bestMatch: SlotPathMapping | null = null;

    for (const mapping of directoryMappings) {
      if (mapping.type !== 'directory') {
        continue;
      }

      const directoryPrefix = `${mapping.originalPath}/`;

      if (!normalizedFilePath.startsWith(directoryPrefix)) {
        continue;
      }

      if (!bestMatch || mapping.originalPath.length > bestMatch.originalPath.length) {
        bestMatch = mapping;
      }
    }

    return bestMatch;
  }

  static async changeSlots(
    modPath: string,
    slotAssignments: Map<string, Map<string, string>>,
    pathData: PathData,
    slotCustomNames: Record<string, CustomData> = {},
    generateSupportFiles = true,
    configMode: ConfigMode = 'merge',
  ) {
    const changedPaths: string[] = [];
    const pendingConfigMappings = new Map<string, Map<string, string>>();
    const colorNums = new Map<number, number>();
    const prcxmlParams = new Map<number, Map<string, string>>();
    const msgNameEntries: string[] = [];
    let fighterIndexes: Map<string, number> | undefined;
    let handledSupportFiles = false;

    for (const fighterName of Object.keys(pathData)) {
      const isItem = fighterName.startsWith('item/');
      const defaultCustomNames = isItem
        ? {}
        : await this.getDefaultCustomNames(fighterName);
      const fighterAssignments = slotAssignments.get(fighterName);

      if (!fighterAssignments) continue;

      const finalSlots = Array.from(fighterAssignments.values());

      const topLevelMappings: SlotPathMapping[] = [];
      const directoryMappings: SlotPathMapping[] = [];
      const seenTopLevelMappings = new Set<string>();
      const nestedFileRenameMappings: {
        currentPath: string;
        finalPath: string;
      }[] = [];
      const seenNestedFileRenameMappings = new Set<string>();

      Object.keys(pathData[fighterName]).forEach((currentSlot) => {
        const newSlot = fighterAssignments.get(currentSlot);
        const slotData = pathData[fighterName][currentSlot];

        if (!newSlot || !slotData) {
          return;
        }

        for (const pathEntry of Object.values(slotData.pathsToBeModified)) {
          const mapping = this.createSlotPathMapping(
            currentSlot,
            newSlot,
            pathEntry,
          );

          if (!mapping) {
            continue;
          }

          const mappingKey = `${mapping.type}:${mapping.originalPath}->${mapping.finalPath}`;
          if (seenTopLevelMappings.has(mappingKey)) {
            continue;
          }

          seenTopLevelMappings.add(mappingKey);
          topLevelMappings.push(mapping);

          if (mapping.type === 'directory') {
            directoryMappings.push(mapping);
          }
        }
      });

      for (const [currentSlot, slotData] of Object.entries(pathData[fighterName])) {
        const newSlot = fighterAssignments.get(currentSlot);

        if (!newSlot || !slotData) {
          continue;
        }

        for (const fileEntry of Object.values(slotData.filesToBeModified)) {
          const mapping = this.createSlotPathMapping(
            currentSlot,
            newSlot,
            fileEntry,
          );

          if (!mapping) {
            continue;
          }

          const containingDirectory = this.findContainingDirectoryMapping(
            mapping.originalPath,
            directoryMappings,
          );

          if (!containingDirectory) {
            continue;
          }

          const currentPath = this.normalizeRelativePath(
            mapping.originalPath.replace(
              containingDirectory.originalPath,
              containingDirectory.finalPath,
            ),
          );

          if (currentPath === mapping.finalPath) {
            continue;
          }

          const mappingKey = `${currentPath}->${mapping.finalPath}`;
          if (seenNestedFileRenameMappings.has(mappingKey)) {
            continue;
          }

          seenNestedFileRenameMappings.add(mappingKey);
          nestedFileRenameMappings.push({
            currentPath,
            finalPath: mapping.finalPath,
          });
        }
      }

      for (const mapping of topLevelMappings) {
        try {
          await ModFileOperations.renameModFile(
            modPath,
            mapping.originalPath,
            mapping.tempPath,
          );
        } catch (error) {
          console.error(
            `Error moving file to temp ${mapping.originalPath}:`,
            error,
          );

          throw new Error(
            `Failed to move file to temp ${mapping.originalPath}: ${error.message}`,
          );
        }
      }

      for (const mapping of topLevelMappings) {
        try {
          await ModFileOperations.renameModFile(
            modPath,
            mapping.tempPath,
            mapping.finalPath,
          );

          changedPaths.push(mapping.finalPath);
        } catch (error) {
          console.error(
            `Error moving file from temp ${mapping.tempPath}:`,
            error,
          );
          throw new Error(
            `Failed to move file from temp ${mapping.tempPath}: ${error.message}`,
          );
        }
      }

      for (const mapping of nestedFileRenameMappings) {
        try {
          await ModFileOperations.renameModFile(
            modPath,
            mapping.currentPath,
            mapping.finalPath,
          );

          changedPaths.push(mapping.finalPath);
        } catch (error) {
          console.error(
            `Error renaming nested file ${mapping.currentPath}:`,
            error,
          );
          throw new Error(
            `Failed to rename nested file ${mapping.currentPath}: ${error.message}`,
          );
        }
      }

      // Item slots have no fighter config, names, or internal-file renames.
      if (isItem) {
        continue;
      }

      if (!generateSupportFiles) {
        continue;
      }

      handledSupportFiles = true;

      const numberedSlots = finalSlots.filter((slot) =>
        SLOT_PATTERN.test(slot),
      );
      const maxSlotNum = Math.max(
        -1,
        ...numberedSlots.map((slot) => parseInt(slot.replace('c', ''))),
      );
      const hasCustomNames = Object.keys(slotCustomNames).length > 0;

      if (maxSlotNum > 7 || hasCustomNames) {
        try {
          fighterIndexes ??= await this.readFighterIndexes();

          const fighterIndex = fighterIndexes.get(
            this.getPrcxmlName(fighterName),
          );

          if (fighterIndex === undefined) {
            throw new Error(
              `Fighter name "${fighterName}" not found in names.data`,
            );
          }

          if (maxSlotNum > 7) {
            for (const groupName of this.getPrcxmlGroup(fighterName)) {
              const groupIndex = fighterIndexes.get(groupName);
              if (groupIndex === undefined) continue;

              colorNums.set(
                groupIndex,
                Math.max(colorNums.get(groupIndex) ?? 0, maxSlotNum + 1),
              );
            }
          }

          for (const slot of numberedSlots) {
            const slotNum = parseInt(slot.replace('c', ''));
            const customAnnouncer = slotCustomNames[slot]?.announcer || '';

            if (slotNum <= 7 && !customAnnouncer) continue;

            const nxyIndex = hasCustomNames ? slotNum + 8 : 0;
            const params = prcxmlParams.get(fighterIndex) || new Map();

            params.set(
              `n${String(slotNum).padStart(2, '0')}_index`,
              `<byte hash="n${String(slotNum).padStart(2, '0')}_index">${nxyIndex}</byte>`,
            );

            if (customAnnouncer) {
              const label = `characall_label_c${String(nxyIndex).padStart(2, '0')}`;
              params.set(
                label,
                `<hash40 hash="${label}">${customAnnouncer}</hash40>`,
              );
            }

            prcxmlParams.set(fighterIndex, params);
          }
        } catch (error) {
          console.error('Error editing ui_chara_db.prcxml:', error);
          throw new Error(`Error editing ui_chara_db.prcxml: ${error.message}`);
        }

        msgNameEntries.push(
          ...SlotChanger.buildMsgNameEntries(
            fighterName,
            numberedSlots,
            slotCustomNames,
            defaultCustomNames,
          ),
        );
      }

      // UI assets can use a shared character id whose gameplay data is split
      // across multiple vanilla fighter roots (ice_climber => popo + nana).
      if (fighterName) {
        await ConfigGenerator.init();
        const vanillaFighters =
          ConfigGenerator.resolveVanillaFighters(fighterName);

        for (const vanillaFighter of vanillaFighters) {
          const mappings =
            pendingConfigMappings.get(vanillaFighter) ||
            new Map<string, string>();
          for (const [sourceSlot, targetSlot] of fighterAssignments) {
            mappings.set(sourceSlot, targetSlot);
          }
          pendingConfigMappings.set(vanillaFighter, mappings);
        }
      }
    }

    if (handledSupportFiles) {
      await this.writeUiCharaDb(modPath, colorNums, prcxmlParams);

      if (msgNameEntries.length > 0) {
        await this.writeMsgName(modPath, msgNameEntries);
      }
    }

    let hasGeneratedConfig = false;
    for (const [fighterName, assignments] of pendingConfigMappings) {
      const jsonCreator = new ConfigGenerator(modPath, fighterName);
      await jsonCreator.generateReslotConfig(
        Array.from(assignments)
          .filter(
            ([sourceSlot, targetSlot]) =>
              SLOT_PATTERN.test(sourceSlot) && SLOT_PATTERN.test(targetSlot),
          )
          .map(([sourceSlot, targetSlot]) => ({
          sourceSlot,
          targetSlot,
          shareSlot: ConfigGenerator.getDefaultShareSlot(
            fighterName,
            sourceSlot,
          ),
          })),
        hasGeneratedConfig || configMode === 'merge',
        Array.from(assignments)
          .filter(([sourceSlot, targetSlot]) => sourceSlot !== targetSlot)
          .map(([sourceSlot]) => sourceSlot),
      );
      hasGeneratedConfig = true;
    }

    return changedPaths.length;
  }

  private static readonly PRCXML_GROUPS = [
    ['ptrainer', 'pzenigame', 'pfushigisou', 'plizardon'],
    ['element', 'flame_first', 'light_first', 'flame_only', 'light_only'],
    ['koopa', 'koopag'],
  ];

  private static readonly PRCXML_ALIASES: Record<string, string> = {
    popo: 'ice_climber',
    nana: 'ice_climber',
    eflame: 'flame_first',
    elight: 'light_first',
  };

  private static getPrcxmlName(fighterName: string): string {
    return this.PRCXML_ALIASES[fighterName] || fighterName;
  }

  private static getPrcxmlGroup(fighterName: string): string[] {
    const name = this.getPrcxmlName(fighterName);
    return this.PRCXML_GROUPS.find((group) => group.includes(name)) || [name];
  }

  private static async readFighterIndexes(): Promise<Map<string, number>> {
    const namesData = await ModFileOperations.readModFile(
      path.join(PATHS.dataDir(), 'names.data'),
    );
    const indexes = new Map<string, number>();

    for (const line of namesData.split(/\r?\n/)) {
      const parts = line.split(',').map((part) => part.trim());
      if (parts.length >= 3) {
        indexes.set(parts[0].toLowerCase(), parseInt(parts[2]));
      }
    }

    return indexes;
  }

  private static async writeUiCharaDb(
    modPath: string,
    colorNums: Map<number, number>,
    prcxmlParams: Map<number, Map<string, string>>,
  ) {
    const indexes = new Set([...colorNums.keys(), ...prcxmlParams.keys()]);

    if (indexes.size === 0) {
      console.log(
        'Deleting ui_chara_db.prcxml as no slots above c07 and no custom names provided',
      );
      await ModFileOperations.deleteModFile(
        modPath,
        'ui/param/database/ui_chara_db.prcxml',
      );
      return;
    }

    let prcXmlContent = await ModFileOperations.readModFile(
      path.join(PATHS.dataDir(), 'ui_chara_db.prcxml'),
    );

    for (const index of indexes) {
      const colorNum = colorNums.get(index);
      const structParams = [
        ...(colorNum ? [`<byte hash="color_num">${colorNum}</byte>`] : []),
        ...(prcxmlParams.get(index)?.values() || []),
      ];

      prcXmlContent = prcXmlContent.replace(
        new RegExp(`<hash40 index="${index}">dummy<\\/hash40>`, 'g'),
        `<struct index="${index}">${structParams.join('')}</struct>`,
      );
    }

    const outputDir = `${modPath}/ui/param/database`;
    if (!(await ModFileOperations.fileExists(outputDir))) {
      await ModFileOperations.createDirectory(outputDir);
    }

    await ModFileOperations.writeModFile(
      `${outputDir}/ui_chara_db.prcxml`,
      prcXmlContent,
    );
  }

  private static async writeMsgName(modPath: string, xmlEntries: string[]) {
    const xmlContent = [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<xmsbt>',
      ...xmlEntries,
      '</xmsbt>',
    ].join('\n');

    const outputDir = `${modPath}/ui/message`;
    if (!(await ModFileOperations.fileExists(outputDir))) {
      await ModFileOperations.createDirectory(outputDir);
    }

    await ModFileOperations.writeModFile(
      `${outputDir}/msg_name.xmsbt`,
      xmlContent,
    );
  }

  static getBackupPath(modPath: string): string {
    return path.join(PATHS.slotBackupsDir(), path.basename(modPath));
  }

  static async backupMod(modPath: string) {
    const backupPath = this.getBackupPath(modPath);
    await fse.remove(backupPath);
    await fse.copy(modPath, backupPath);
  }

  static async hasBackup(modPath: string): Promise<boolean> {
    return fse.pathExists(this.getBackupPath(modPath));
  }

  static async restoreBackup(modPath: string) {
    const backupPath = this.getBackupPath(modPath);

    if (!(await fse.pathExists(backupPath))) {
      throw new Error('No slot change backup found for this mod');
    }

    const restorePath = `${modPath}.fp-restore`;
    await fse.remove(restorePath);
    await fse.copy(backupPath, restorePath);
    await fse.remove(modPath);
    await fse.move(restorePath, modPath);
    await fse.remove(backupPath);
  }

  static async removeSlots(
    modPath: string,
    deletedSlots: Map<string, Set<string>>,
    pathData: PathData,
  ) {
    let deletedPaths = 0;

    for (const [fighterName, slots] of deletedSlots) {
      const fighterData = pathData[fighterName];

      for (const slot of slots) {
        if (!fighterData || !fighterData[slot]) continue;

        for (const { original } of Object.values(
          fighterData[slot].pathsToBeModified,
        )) {
          await ModFileOperations.deleteModFile(modPath, original);
          deletedPaths++;
        }
      }
    }

    return deletedPaths;
  }

  static buildMsgNameEntries(
    fighterName: string,
    slots: string[],
    slotCustomNames: Record<string, CustomData>,
    defaultCustomNames: CustomData,
  ): string[] {
    const xmlEntries: string[] = [];

    for (const slot of slots) {
      const slotNum = parseInt(slot.replace('c', ''));

      if (
        (slotNum <= 7 && !slotCustomNames[slot]) ||
        (!slotCustomNames[slot]?.cspName &&
          !slotCustomNames[slot]?.vsName &&
          !slotCustomNames[slot]?.boxingRing)
      ) {
        continue;
      }

      const names = {
        cspName:
          (slotCustomNames &&
            slotCustomNames[slot] &&
            slotCustomNames[slot].cspName) ||
          (defaultCustomNames &&
            defaultCustomNames[slot] &&
            defaultCustomNames[slot].cspName),
        vsName:
          (slotCustomNames &&
            slotCustomNames[slot] &&
            slotCustomNames[slot].vsName) ||
          (defaultCustomNames &&
            defaultCustomNames[slot] &&
            defaultCustomNames[slot].vsName),
        boxingRing:
          (slotCustomNames &&
            slotCustomNames[slot] &&
            slotCustomNames[slot].boxingRing) ||
          (defaultCustomNames &&
            defaultCustomNames[slot] &&
            defaultCustomNames[slot].boxingRing),
      };

      // Calculate the label index to match ui_chara_db.prcxml nXY_index value
      // This should always be slot number + 8 (same as nxyIndex in ui_chara_db.prcxml)
      const labelIndex = String(slotNum + 8).padStart(2, '0');

      const cspName = names.cspName || '';
      const vsName = names.vsName || (cspName ? cspName.toUpperCase() : '');
      const boxingRingName = names.boxingRing || '';

      xmlEntries.push(
        `\t<entry label="nam_chr0_${labelIndex}_${fighterName}">`,
      );
      xmlEntries.push(`\t\t<text>${this.escapeXml(cspName)}</text>`);
      xmlEntries.push(`\t</entry>`);

      xmlEntries.push(
        `\t<entry label="nam_chr1_${labelIndex}_${fighterName}">`,
      );
      xmlEntries.push(`\t\t<text>${this.escapeXml(cspName)}</text>`);
      xmlEntries.push(`\t</entry>`);

      xmlEntries.push(
        `\t<entry label="nam_chr2_${labelIndex}_${fighterName}">`,
      );
      xmlEntries.push(`\t\t<text>${this.escapeXml(vsName)}</text>`);
      xmlEntries.push(`\t</entry>`);

      xmlEntries.push(
        `\t<entry label="nam_stage_name_${labelIndex}_${fighterName}">`,
      );
      xmlEntries.push(`\t\t<text>${this.escapeXml(boxingRingName)}</text>`);
      xmlEntries.push(`\t</entry>`);
    }

    return xmlEntries;
  }

  static escapeXml(str) {
    if (!str) return '';

    return str
      .replace(/\\n/g, '\n') // Convert \n escape sequences to actual newlines
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  static async readExistingCustomNames(
    modPath: string,
    fighterName: string,
    slots: string[],
  ) {
    const customNames = {};
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      parseAttributeValue: true,
      trimValues: true,
    });

    try {
      const slotToLabelIndex = {};
      const prcxmlPath = `${modPath}/ui/param/database/ui_chara_db.prcxml`;

      if (await ModFileOperations.fileExists(prcxmlPath)) {
        const prcxmlContent = await ModFileOperations.readModFile(prcxmlPath);

        try {
          const prcxmlData = parser.parse(prcxmlContent);

          const structs = prcxmlData?.struct || [];
          const structArray = Array.isArray(structs) ? structs : [structs];

          for (const slot of slots) {
            const slotNum = parseInt(slot.replace('c', ''));

            let nxyIndexValue: number | null = null;

            for (const struct of structArray) {
              if (!struct || !struct.byte) continue;

              const bytes = Array.isArray(struct.byte)
                ? struct.byte
                : [struct.byte];

              let nxyByte = bytes.find(
                (b) => b?.['@_hash'] === `n${slotNum}_index`,
              );

              if (!nxyByte) {
                nxyByte = bytes.find(
                  (b) =>
                    b?.['@_hash'] ===
                    `n${String(slotNum).padStart(2, '0')}_index`,
                );
              }

              if (nxyByte && nxyByte['#text'] !== undefined) {
                nxyIndexValue = parseInt(nxyByte['#text']);
                break;
              }
            }

            if (nxyIndexValue !== null) {
              slotToLabelIndex[slot] = nxyIndexValue;
            } else {
              slotToLabelIndex[slot] = slotNum + 8;
            }
          }
        } catch (parseError) {
          console.error(
            '[readExistingCustomNames] Error parsing prcxml:',
            parseError,
          );
          for (const slot of slots) {
            const slotNum = parseInt(slot.replace('c', ''));
            slotToLabelIndex[slot] = slotNum + 8;
          }
        }
      } else {
        for (const slot of slots) {
          const slotNum = parseInt(slot.replace('c', ''));
          slotToLabelIndex[slot] = slotNum + 8;
        }
      }

      const msgNamePath = `${modPath}/ui/message/msg_name.xmsbt`;

      if (await ModFileOperations.fileExists(msgNamePath)) {
        const msgContent = await ModFileOperations.readModFile(msgNamePath);

        try {
          const msgData = parser.parse(msgContent);

          const entries = msgData?.xmsbt?.entry || [];
          const entryArray = Array.isArray(entries) ? entries : [entries];

          for (const slot of slots) {
            const labelIndexRaw = slotToLabelIndex[slot];
            const labelIndexPadded = String(labelIndexRaw).padStart(2, '0');
            const labelIndexUnpadded = String(labelIndexRaw);

            const cspEntry = entryArray.find(
              (e) =>
                e?.['@_label'] ===
                  `nam_chr1_${labelIndexPadded}_${fighterName}` ||
                e?.['@_label'] ===
                  `nam_chr1_${labelIndexUnpadded}_${fighterName}`,
            );

            const vsEntry = entryArray.find(
              (e) =>
                e?.['@_label'] ===
                  `nam_chr2_${labelIndexPadded}_${fighterName}` ||
                e?.['@_label'] ===
                  `nam_chr2_${labelIndexUnpadded}_${fighterName}`,
            );

            const boxingEntry = entryArray.find(
              (e) =>
                e?.['@_label'] ===
                  `nam_stage_name_${labelIndexPadded}_${fighterName}` ||
                e?.['@_label'] ===
                  `nam_stage_name_${labelIndexUnpadded}_${fighterName}`,
            );

            const cspText = (cspEntry?.text || '').replace(/\n/g, '\\n');
            const vsText = (vsEntry?.text || '').replace(/\n/g, '\\n');
            const boxingText = (boxingEntry?.text || '').replace(/\n/g, '\\n');

            if (cspText || vsText || boxingText) {
              customNames[slot] = {
                cspName: cspText,
                vsName: vsText,
                boxingRing: boxingText,
                announcer: '',
              };
            }
          }
        } catch (parseError) {
          console.error(
            '[readExistingCustomNames] Error parsing msg_name.xmsbt:',
            parseError,
          );
        }
      }

      if (await ModFileOperations.fileExists(prcxmlPath)) {
        const prcxmlContent = await ModFileOperations.readModFile(prcxmlPath);

        try {
          const prcxmlData = parser.parse(prcxmlContent);

          const structs = prcxmlData?.struct || [];
          const structArray = Array.isArray(structs) ? structs : [structs];

          for (const slot of slots) {
            const labelIndex = slotToLabelIndex[slot];
            const labelPadded = String(labelIndex).padStart(2, '0');

            let announcerText = '';

            for (const struct of structArray) {
              if (!struct || !struct.hash40) continue;

              const hash40s = Array.isArray(struct.hash40)
                ? struct.hash40
                : [struct.hash40];

              const announcerElement = hash40s.find(
                (h) => h?.['@_hash'] === `characall_label_c${labelPadded}`,
              );

              if (announcerElement && announcerElement['#text']) {
                announcerText = announcerElement['#text'];
                break;
              }
            }

            if (announcerText) {
              if (!customNames[slot]) {
                customNames[slot] = {
                  cspName: '',
                  vsName: '',
                  boxingRing: '',
                  announcer: '',
                };
              }

              customNames[slot].announcer = announcerText;
            }
          }
        } catch (parseError) {
          console.error(
            '[readExistingCustomNames] Error parsing prcxml for announcer:',
            parseError,
          );
        }
      }
    } catch (error) {
      console.error('[readExistingCustomNames] Error:', error);
    }

    return customNames;
  }

  static async getDefaultCustomNames(
    fighterNameInternal: string,
  ): Promise<CustomData> {
    try {
      const messagesPath = path.join(PATHS.dataDir(), 'messages.data');

      if (!(await ModFileOperations.fileExists(messagesPath))) {
        console.warn('messages.data file not found');
        return {};
      }

      const xmlContent = await ModFileOperations.readModFile(messagesPath);
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        textNodeName: '#text',
        parseAttributeValue: true,
        trimValues: true,
      });

      try {
        const xmlData = parser.parse(xmlContent);

        const cspLabel = `nam_chr1_08_${fighterNameInternal}`;
        const vsLabel = `nam_chr2_08_${fighterNameInternal}`;
        const boxingRingLabel = `nam_stage_name_08_${fighterNameInternal}`;

        const entries = xmlData?.xmsbt?.entry || [];
        const entryArray = Array.isArray(entries) ? entries : [entries];

        const cspEntry = entryArray.find((e) => e?.['@_label'] === cspLabel);
        const vsEntry = entryArray.find((e) => e?.['@_label'] === vsLabel);
        const boxingRingEntry = entryArray.find(
          (e) => e?.['@_label'] === boxingRingLabel,
        );

        return {
          cspName: cspEntry?.text || '',
          vsName: vsEntry?.text || '',
          boxingRing: boxingRingEntry?.text?.replace(/\n/g, ' ') || '',
          announcer: 'vc_narration_characall',
        };
      } catch (parseError) {
        console.error('Error parsing messages.data XML:', parseError);
        return {};
      }
    } catch (error) {
      console.error('Error reading messages.data:', error);
      return {};
    }
  }
}
