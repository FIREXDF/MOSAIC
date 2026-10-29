import * as fs from 'fs';
import * as path from 'path';
import { ConfigGenerator } from '../mod-utils/config-generator';
import { ModScanner } from '../mod-utils/mod-scanner';
import { SlotChanger } from '../mod-utils/slot-changer';
import store from '../store';

import {
  type CharacterCssLayoutPayload,
  type CreateEchoSlotPayload,
  type RemoveEchoSlotPayload,
} from './character-css-types';
import {
  clone,
  duplicateCharacterCssEntry,
  ensureDirectory,
  getCharacterCssLayoutData,
  getPersistedCharaJsonPath,
  getPersistedLayoutJsonPath,
  getPersistedMsgNameJsonPath,
  getPersistedMsgNamePath,
  readCurrentCharaJson,
  readCurrentLayoutJson,
  readCurrentMsgNameJson,
  readJsonFile,
  saveCharacterCssLayout,
  writePersistedCharacterCssData,
} from './character-css-service';
import {
  getHashText,
  getStructList,
  setHashText,
} from './character-css-params';

function replaceNameId(value: string, sourceNameId: string, newNameId: string) {
  return value.replace(
    new RegExp(sourceNameId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
    newNameId,
  );
}

function renameEchoUiAssets(
  dirPath: string,
  sourceNameId: string,
  newNameId: string,
) {
  if (!fs.existsSync(dirPath)) {
    return;
  }
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const currentPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      renameEchoUiAssets(currentPath, sourceNameId, newNameId);
    }

    const nextName = replaceNameId(entry.name, sourceNameId, newNameId);
    if (nextName === entry.name) {
      continue;
    }

    const nextPath = path.join(dirPath, nextName);
    if (fs.existsSync(nextPath)) {
      throw new Error(
        `Cannot rename mod file because target already exists: ${nextPath}`,
      );
    }
    fs.renameSync(currentPath, nextPath);
  }
}

function listFilesRecursive(dirPath: string): string[] {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dirPath, entry.name);
    return entry.isDirectory() ? listFilesRecursive(entryPath) : [entryPath];
  });
}

function disableConflictingEchoUiPatches(modPath: string) {
  const conflicts = [
    path.join('ui', 'message', 'msg_name.xmsbt'),
    path.join('ui', 'param', 'database', 'ui_chara_db.prcx'),
    path.join('ui', 'param', 'database', 'ui_layout_db.prcx'),
  ];
  const moved: string[] = [];
  for (const relativePath of conflicts) {
    const sourcePath = path.join(modPath, relativePath);
    if (!fs.existsSync(sourcePath)) continue;
    const backupPath = path.join(
      modPath,
      '.fightplanner-echo-backup',
      relativePath,
    );
    ensureDirectory(path.dirname(backupPath));
    if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
    fs.renameSync(sourcePath, backupPath);
    moved.push(relativePath.replace(/\\/g, '/'));
  }
  return moved;
}

function backupEchoConfig(modPath: string) {
  const configPath = path.join(modPath, 'config.json');
  const backupRoot = path.join(modPath, '.fightplanner-echo-backup');
  const backupPath = path.join(backupRoot, 'config.json');
  const absentMarker = path.join(backupRoot, 'config.absent');
  ensureDirectory(backupRoot);
  if (fs.existsSync(backupPath) || fs.existsSync(absentMarker)) return;
  if (fs.existsSync(configPath)) fs.copyFileSync(configPath, backupPath);
  else fs.writeFileSync(absentMarker, '', 'utf8');
}

function restoreEchoBackups(modPath: string) {
  const backupRoot = path.join(modPath, '.fightplanner-echo-backup');
  const configPath = path.join(modPath, 'config.json');
  const backupConfig = path.join(backupRoot, 'config.json');
  const absentMarker = path.join(backupRoot, 'config.absent');
  if (fs.existsSync(backupConfig)) fs.copyFileSync(backupConfig, configPath);
  else if (fs.existsSync(absentMarker) && fs.existsSync(configPath))
    fs.unlinkSync(configPath);
  else if (fs.existsSync(backupRoot) && fs.existsSync(configPath)) {
    const generatedBackup = path.join(backupRoot, 'generated-config.json');
    if (fs.existsSync(generatedBackup)) fs.unlinkSync(generatedBackup);
    fs.renameSync(configPath, generatedBackup);
  }

  for (const relativePath of [
    path.join('ui', 'message', 'msg_name.xmsbt'),
    path.join('ui', 'param', 'database', 'ui_chara_db.prcx'),
    path.join('ui', 'param', 'database', 'ui_layout_db.prcx'),
  ]) {
    const backupPath = path.join(backupRoot, relativePath);
    if (!fs.existsSync(backupPath)) continue;
    const targetPath = path.join(modPath, relativePath);
    ensureDirectory(path.dirname(targetPath));
    if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
    fs.renameSync(backupPath, targetPath);
  }
}

interface EchoDirectoryBackup {
  originalPath: string;
  backupPath: string;
  existed: boolean;
}

interface EchoFileSnapshot {
  filePath: string;
  contents: Buffer | null;
}

async function createEchoDirectoryBackup(
  dirPath: string,
): Promise<EchoDirectoryBackup> {
  const originalPath = path.resolve(dirPath);
  const parentPath = path.dirname(originalPath);
  const directoryName = path.basename(originalPath);
  if (!directoryName || originalPath === parentPath) {
    throw new Error(`Unsafe Echo backup path: ${originalPath}`);
  }

  const backupPath = path.join(
    parentPath,
    `.${directoryName}.fightplanner-echo-transaction-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const existed = fs.existsSync(originalPath);
  if (existed) {
    await fs.promises.cp(originalPath, backupPath, {
      recursive: true,
      force: false,
      errorOnExist: true,
    });
  }

  return { originalPath, backupPath, existed };
}

async function restoreEchoDirectoryBackup(backup: EchoDirectoryBackup) {
  if (!backup.existed) {
    if (fs.existsSync(backup.originalPath)) {
      await fs.promises.rm(backup.originalPath, {
        recursive: true,
        force: true,
      });
    }
    return;
  }

  if (!fs.existsSync(backup.backupPath)) {
    throw new Error(`Echo backup missing: ${backup.backupPath}`);
  }

  const failedPath = `${backup.backupPath}.failed`;
  if (fs.existsSync(failedPath)) {
    await fs.promises.rm(failedPath, { recursive: true, force: true });
  }
  if (fs.existsSync(backup.originalPath)) {
    await fs.promises.rename(backup.originalPath, failedPath);
  }

  try {
    await fs.promises.rename(backup.backupPath, backup.originalPath);
  } catch (error) {
    if (
      fs.existsSync(failedPath) &&
      !fs.existsSync(backup.originalPath)
    ) {
      await fs.promises.rename(failedPath, backup.originalPath);
    }
    throw error;
  }

  if (fs.existsSync(failedPath)) {
    await fs.promises.rm(failedPath, { recursive: true, force: true });
  }
}

async function removeEchoDirectoryBackup(backup: EchoDirectoryBackup) {
  if (fs.existsSync(backup.backupPath)) {
    await fs.promises.rm(backup.backupPath, {
      recursive: true,
      force: true,
    });
  }
}

function captureEchoFileSnapshots(filePaths: string[]): EchoFileSnapshot[] {
  return filePaths.map((filePath) => ({
    filePath,
    contents: fs.existsSync(filePath) ? fs.readFileSync(filePath) : null,
  }));
}

function restoreEchoFileSnapshots(snapshots: EchoFileSnapshot[]) {
  for (const snapshot of snapshots) {
    if (snapshot.contents) {
      ensureDirectory(path.dirname(snapshot.filePath));
      fs.writeFileSync(snapshot.filePath, snapshot.contents);
    } else if (fs.existsSync(snapshot.filePath)) {
      fs.unlinkSync(snapshot.filePath);
    }
  }
}

function detectEchoModPath(
  baseNameId: string,
  echoNameId: string,
  echoSlots: string[],
) {
  const modsPath = store.get('modsPath') as string | null;
  if (!modsPath || !fs.existsSync(modsPath)) return null;
  const echoAssetPattern = new RegExp(`_${echoNameId}_`, 'i');
  const scored = fs
    .readdirSync(modsPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const modPath = path.join(modsPath, entry.name);
      let score = fs.existsSync(path.join(modPath, '.fightplanner-echo-backup'))
        ? 10
        : 0;
      const uiFiles = [
        path.join(modPath, 'ui', 'replace', 'chara'),
        path.join(modPath, 'ui', 'replace_patch', 'chara'),
      ].flatMap(listFilesRecursive);
      if (
        uiFiles.some((filePath) =>
          echoAssetPattern.test(path.basename(filePath)),
        )
      )
        score += 20;
      const fighterFiles = listFilesRecursive(
        path.join(modPath, 'fighter', baseNameId),
      );
      if (
        fighterFiles.some((filePath) =>
          echoSlots.some((slot) =>
            filePath.includes(`${path.sep}${slot}${path.sep}`),
          ),
        )
      )
        score += 5;
      return { modPath, score };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score);
  return scored[0]?.modPath || null;
}

function mergeEchoConfig(generated: any, existing: any) {
  const merged = { ...existing, ...generated };
  const arraySections = ['new-dir-infos'];
  const objectSections = [
    'new-dir-infos-base',
    'share-to-vanilla',
    'share-to-added',
    'new-dir-files',
  ];

  arraySections.forEach((section) => {
    if (
      Array.isArray(generated?.[section]) ||
      Array.isArray(existing?.[section])
    ) {
      merged[section] = [
        ...new Set([
          ...(generated?.[section] || []),
          ...(existing?.[section] || []),
        ]),
      ];
    }
  });
  objectSections.forEach((section) => {
    const output: Record<string, unknown> = { ...(generated?.[section] || {}) };
    Object.entries(existing?.[section] || {}).forEach(([key, value]) => {
      if (Array.isArray(value) && Array.isArray(output[key])) {
        output[key] = [...new Set([...(output[key] as unknown[]), ...value])];
      } else if (!(key in output)) {
        output[key] = value;
      }
    });
    if (Object.keys(output).length > 0) {
      merged[section] = output;
    }
  });
  return merged;
}

export async function createEchoSlot(payload: CreateEchoSlotPayload) {
  const newNameId = payload.newNameId.trim().toLowerCase();
  const modPath = payload.modPath.trim();
  if (!/^[a-z0-9_]+$/.test(newNameId)) {
    throw new Error(
      'Name ID only accepts lowercase letters, numbers and underscores',
    );
  }
  if (
    !Number.isInteger(payload.colorCount) ||
    payload.colorCount < 1 ||
    payload.colorCount > 8
  ) {
    throw new Error('Color count must be between 1 and 8');
  }
  if (
    !Number.isInteger(payload.colorStartIndex) ||
    payload.colorStartIndex < 0 ||
    payload.colorStartIndex > 255
  ) {
    throw new Error('Color start index must be between 0 and 255');
  }
  if (!fs.existsSync(modPath) || !fs.statSync(modPath).isDirectory()) {
    throw new Error('Select an existing mod folder');
  }

  const modsPath = store.get('modsPath') as string | null;
  if (!modsPath || !fs.existsSync(modsPath)) {
    throw new Error('Configure an existing mods folder before creating an Echo');
  }

  const sourceEntry = [
    ...getCharacterCssLayoutData().visibleCharacters,
    ...getCharacterCssLayoutData().hiddenCharacters,
  ].find((entry) => entry.id === payload.sourceCharacterId);
  if (!sourceEntry) {
    throw new Error(`Character not found: ${payload.sourceCharacterId}`);
  }

  const fighterDir = path.join(modPath, 'fighter', sourceEntry.nameId);
  if (!fs.existsSync(fighterDir)) {
    throw new Error(`Selected mod has no fighter/${sourceEntry.nameId} folder`);
  }

  const uiAssetRoots = [
    path.join(modPath, 'ui', 'replace', 'chara'),
    path.join(modPath, 'ui', 'replace_patch', 'chara'),
  ];
  const uiAssets = uiAssetRoots.flatMap(listFilesRecursive);
  const sourceAssetPattern = new RegExp(`_${sourceEntry.nameId}_`, 'i');
  if (
    !uiAssets.some((filePath) =>
      sourceAssetPattern.test(path.basename(filePath)),
    )
  ) {
    throw new Error(
      `No chara UI asset found for ${sourceEntry.nameId}. Add ui/replace/chara or ui/replace_patch/chara files first.`,
    );
  }

  const warnings: string[] = [];
  if (
    !uiAssets.some((filePath) =>
      path
        .basename(filePath)
        .toLowerCase()
        .startsWith(`chara_7_${sourceEntry.nameId.toLowerCase()}_`),
    )
  ) {
    warnings.push('Missing chara_7 asset: Echo CSS tile may be blank.');
  }
  const voiceDir = path.join(modPath, 'sound', 'bank', 'fighter_voice');
  if (
    !listFilesRecursive(voiceDir).some((filePath) =>
      /\.nus3bank$/i.test(filePath),
    )
  ) {
    warnings.push(
      'No fighter voice .nus3bank found: simultaneous base/Echo matches may share voices.',
    );
  }
  const newUiCharaId = `ui_chara_${newNameId}`;
  const newDisplayName = payload.newDisplayName.trim() || newNameId;
  const echoSlots = Array.from(
    { length: payload.colorCount },
    (_, index) =>
      `c${String(payload.colorStartIndex + index).padStart(2, '0')}`,
  );
  const scan = await ModScanner.scanModFiles(modPath);
  const sourceSlots = Object.keys(scan.pathData[sourceEntry.nameId] || {})
    .filter((slot) => /^c\d{2,3}$/.test(slot))
    .sort((left, right) => Number(left.slice(1)) - Number(right.slice(1)))
    .slice(0, payload.colorCount);
  if (sourceSlots.length !== payload.colorCount) {
    throw new Error(
      `Expected ${payload.colorCount} source fighter slots, found ${sourceSlots.length}: ${sourceSlots.join(', ') || 'none'}. No files were changed.`,
    );
  }

  const persistedSnapshots = captureEchoFileSnapshots([
    getPersistedCharaJsonPath(),
    getPersistedLayoutJsonPath(),
    getPersistedMsgNameJsonPath(),
    getPersistedMsgNamePath(),
  ]);
  const characterCssModPath = path.join(modsPath, 'Character CSS Layout');
  const directoryBackups: EchoDirectoryBackup[] = [];
  try {
    directoryBackups.push(await createEchoDirectoryBackup(modPath));
    if (path.resolve(characterCssModPath) !== path.resolve(modPath)) {
      directoryBackups.push(
        await createEchoDirectoryBackup(characterCssModPath),
      );
    }
  } catch (error) {
    await Promise.allSettled(directoryBackups.map(removeEchoDirectoryBackup));
    throw new Error(
      `Could not back up Echo files: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  try {
    const disabledUiPatches = disableConflictingEchoUiPatches(modPath);
    if (disabledUiPatches.length > 0) {
      warnings.push(
        `Disabled conflicting UI patches: ${disabledUiPatches.join(', ')}. Backups are in .fightplanner-echo-backup.`,
      );
    }

    duplicateCharacterCssEntry({
      sourceCharacterId: payload.sourceCharacterId,
      newUiCharaId,
      newNameId,
      newDisplayName,
    });

    const currentLayout = getCharacterCssLayoutData();
    const layoutPayload: CharacterCssLayoutPayload = {
      visibleCharacterIds: currentLayout.visibleCharacters.map(
        (entry) => entry.id,
      ),
      hiddenCharacterIds: currentLayout.hiddenCharacters.map(
        (entry) => entry.id,
      ),
      characterUpdates: {
        [payload.sourceCharacterId]: {
          fighterType: 'fighter_type_both',
          altCharaId: newUiCharaId,
        },
        [newUiCharaId]: {
          fighterType: 'fighter_type_opened',
          altCharaId: payload.sourceCharacterId,
          colorNum: String(payload.colorCount),
          colorStartIndex: String(payload.colorStartIndex),
          slots: Object.fromEntries(
            Array.from({ length: payload.colorCount }, (_, index) => [
              String(index),
              {
                cxxIndex: String(index),
                nxxIndex: String(index),
                characallLabel: sourceEntry.slots[0]?.characallLabel || '',
                namChr0: newDisplayName,
                namChr1: newDisplayName,
                namChr2: newDisplayName.toUpperCase(),
                namChr3: newDisplayName.toUpperCase(),
                namStageName: newDisplayName,
              },
            ]),
          ),
        },
      },
    };
    await saveCharacterCssLayout(layoutPayload);

    backupEchoConfig(modPath);
    const existingConfigPath = path.join(modPath, 'config.json');
    const existingConfig = fs.existsSync(existingConfigPath)
      ? readJsonFile(existingConfigPath)
      : {};
    await SlotChanger.changeSlots(
      modPath,
      new Map([
        [
          sourceEntry.nameId,
          new Map(
            sourceSlots.map((sourceSlot, index) => [
              sourceSlot,
              echoSlots[index],
            ]),
          ),
        ],
      ]),
      scan.pathData,
      {},
      false,
    );

    renameEchoUiAssets(
      path.join(modPath, 'ui', 'replace', 'chara'),
      sourceEntry.nameId,
      newNameId,
    );
    renameEchoUiAssets(
      path.join(modPath, 'ui', 'replace_patch', 'chara'),
      sourceEntry.nameId,
      newNameId,
    );

    await ConfigGenerator.init();
    const configGenerator = new ConfigGenerator(modPath, sourceEntry.nameId);
    await configGenerator.generateCskConfig(
      echoSlots.map((targetSlot, index) => ({
        sourceSlot: payload.useTwoBaseModels && index % 2 === 1 ? 'c01' : 'c00',
        targetSlot,
      })),
    );
    const generatedConfig = readJsonFile(existingConfigPath);
    fs.writeFileSync(
      existingConfigPath,
      JSON.stringify(mergeEchoConfig(generatedConfig, existingConfig), null, 2),
      'utf8',
    );
  } catch (error) {
    const restoreErrors: string[] = [];
    for (const backup of [...directoryBackups].reverse()) {
      try {
        await restoreEchoDirectoryBackup(backup);
      } catch (restoreError) {
        restoreErrors.push(
          `${backup.originalPath}: ${restoreError instanceof Error ? restoreError.message : String(restoreError)}`,
        );
      }
    }
    try {
      restoreEchoFileSnapshots(persistedSnapshots);
    } catch (restoreError) {
      restoreErrors.push(
        `CSS data: ${restoreError instanceof Error ? restoreError.message : String(restoreError)}`,
      );
    }

    if (restoreErrors.length > 0) {
      throw new Error(
        `Echo creation failed and automatic restore was incomplete. ${restoreErrors.join(' | ')}. Original error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    throw new Error(
      `Echo creation failed; all changed files were restored: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  for (const backup of directoryBackups) {
    try {
      await removeEchoDirectoryBackup(backup);
    } catch (error) {
      warnings.push(
        `Echo created, but temporary backup cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return { success: true as const, newUiCharaId, modPath, warnings };
}

export async function removeEchoSlot(payload: RemoveEchoSlotPayload) {
  const characterId = payload.characterId.trim();

  const charaJson = clone(readCurrentCharaJson().json);
  const layoutJson = clone(readCurrentLayoutJson());
  const msgNameJson = clone(readCurrentMsgNameJson());
  const structs = getStructList(charaJson);
  const echo = structs.find(
    (entry) => getHashText(entry, 'hash40', 'ui_chara_id', '') === characterId,
  );
  if (
    !echo ||
    getHashText(echo, 'hash40', 'fighter_type', '') !== 'fighter_type_opened'
  ) {
    throw new Error('Selected character is not a secondary Echo');
  }

  const altBaseId = getHashText(echo, 'hash40', 'alt_chara_id', '');
  const originalBaseId = getHashText(
    echo,
    'hash40',
    'original_ui_chara_hash',
    '',
  );
  const baseIds = [altBaseId, originalBaseId].filter(
    (baseId) => baseId && baseId !== '0x02302d482a',
  );
  const base =
    structs.find((entry) =>
      baseIds.includes(getHashText(entry, 'hash40', 'ui_chara_id', '')),
    ) ||
    structs.find(
      (entry) =>
        getHashText(entry, 'hash40', 'alt_chara_id', '') === characterId &&
        getHashText(entry, 'hash40', 'fighter_type', '') ===
          'fighter_type_both',
    );
  if (!base) {
    throw new Error(
      `Base fighter not found for ${characterId} (alt: ${altBaseId || 'missing'}, original: ${originalBaseId || 'missing'})`,
    );
  }

  const echoNameId = String(echo?.string?.['#text'] || '');
  const baseNameId = String(base?.string?.['#text'] || '');
  const colorCount = Number(getHashText(echo, 'byte', 'color_num', '0'));
  const colorStart = Number(
    getHashText(echo, 'byte', 'color_start_index', '0'),
  );
  const echoSlots = Array.from(
    { length: colorCount },
    (_, index) => `c${String(colorStart + index).padStart(2, '0')}`,
  );
  const originalSlots = Array.from(
    { length: colorCount },
    (_, index) => `c${String(index).padStart(2, '0')}`,
  );
  const requestedModPath = payload.modPath?.trim();
  const modPath =
    requestedModPath && fs.existsSync(requestedModPath)
      ? requestedModPath
      : detectEchoModPath(baseNameId, echoNameId, echoSlots);
  const warnings: string[] = [];

  if (modPath) {
    const scan = await ModScanner.scanModFiles(modPath);
    const availableEchoSlots = echoSlots.filter(
      (slot) => scan.pathData[baseNameId]?.[slot],
    );
    if (availableEchoSlots.length > 0) {
      await SlotChanger.changeSlots(
        modPath,
        new Map([
          [
            baseNameId,
            new Map(
              availableEchoSlots.map((slot) => [
                slot,
                originalSlots[echoSlots.indexOf(slot)],
              ]),
            ),
          ],
        ]),
        scan.pathData,
        {},
        false,
      );
    }

    renameEchoUiAssets(
      path.join(modPath, 'ui', 'replace', 'chara'),
      echoNameId,
      baseNameId,
    );
    renameEchoUiAssets(
      path.join(modPath, 'ui', 'replace_patch', 'chara'),
      echoNameId,
      baseNameId,
    );
    restoreEchoBackups(modPath);
  } else {
    warnings.push(
      'Echo mod folder not found. CSS/MSBT entry removed; file rollback skipped.',
    );
  }

  setHashText(base, 'hash40', 'fighter_type', 'fighter_type_normal');
  setHashText(base, 'hash40', 'alt_chara_id', '0x02302d482a');
  const nextStructs = structs.filter((entry) => entry !== echo);
  nextStructs.forEach((entry, index) => {
    entry['@index'] = String(index);
  });
  charaJson.struct.list.struct = nextStructs;
  if (charaJson.struct.list['@size'])
    charaJson.struct.list['@size'] = String(nextStructs.length);

  layoutJson.struct.list.struct = getStructList(layoutJson)
    .filter(
      (entry) =>
        getHashText(entry, 'hash40', 'ui_chara_id', '') !== characterId,
    )
    .map((entry, index) => ({ ...entry, '@index': String(index) }));
  if (layoutJson.struct.list['@size']) {
    layoutJson.struct.list['@size'] = String(
      layoutJson.struct.list.struct.length,
    );
  }
  if (msgNameJson.added_labels) {
    Object.keys(msgNameJson.added_labels).forEach((label) => {
      if (
        label.endsWith(`_${echoNameId}`) ||
        label.includes(`_${echoNameId}_`)
      ) {
        delete msgNameJson.added_labels[label];
      }
    });
  }

  writePersistedCharacterCssData(charaJson, msgNameJson, layoutJson);
  const current = getCharacterCssLayoutData();
  await saveCharacterCssLayout({
    visibleCharacterIds: current.visibleCharacters.map((entry) => entry.id),
    hiddenCharacterIds: current.hiddenCharacters.map((entry) => entry.id),
  });
  return {
    success: true as const,
    ...getCharacterCssLayoutData(),
    modPath,
    warnings,
  };
}
