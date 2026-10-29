import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import store from '../store';

import {
  type CharacterCssEntry,
  type CharacterCssGroupCreate,
  type CharacterCssLayoutData,
  type CharacterCssLayoutPayload,
  type CharacterCssSlot,
  type CharacterCssSourceImportPayload,
  type CharacterCssUpdate,
  type DuplicateCharacterCssPayload,
  type RemoveCharacterCssPayload,
} from './character-css-types';
import {
  resolveMsbtEditorExecutable,
  resolveParamLabelsPath,
  runMsbtToJson,
  runNativeTool,
  runParamXml,
  runParamXmlDisassemble,
  runPrcToJson,
  type ToolExecutionResult,
} from './character-css-tools';
import {
  asArray,
  charaJsonToParamXml,
  charaXmlToJson,
  ensureHashText,
  getCharacterCssSbyteOrder,
  getHashText,
  getStructList,
  normalizeCharaParamJson,
  setHashText,
  setHashTextIfPresent,
} from './character-css-params';

const PERSISTED_CHARA_JSON_FILE = 'ui_chara_css_layout.json';

const PERSISTED_LAYOUT_JSON_FILE = 'ui_layout_css_layout.json';

const PERSISTED_MSG_NAME_JSON_FILE = 'msg_name_css_layout.json';

const PERSISTED_MSG_NAME_FILE = 'msg_name_css_layout.msbt';

const PERSISTED_SOURCE_MANIFEST_FILE = 'character-css-source.json';

const TEMP_CHARA_JSON_FILE = 'ui_chara_db.json';

const TEMP_LAYOUT_JSON_FILE = 'ui_layout_db.json';

const TEMP_CHARA_XML_FILE = 'ui_chara_db.xml';

const TEMP_LAYOUT_XML_FILE = 'ui_layout_db.xml';

const TEMP_MSG_NAME_JSON_FILE = 'msg_name.json';

const SOURCE_CHARA_PRC_FILE = 'ui_chara_db.prc';

const SOURCE_LAYOUT_PRC_FILE = 'ui_layout_db.prc';

const GENERATED_MSG_NAME_FILE = 'msg_name.msbt';

function logCharacterCss(message: string, details?: Record<string, unknown>) {
  if (details) {
    console.log('[CharacterCSS]', message, details);
    return;
  }

  console.log('[CharacterCSS]', message);
}

export function ensureDirectory(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getPersistedDataDir() {
  const dirPath = path.join(app.getPath('userData'), 'data');
  ensureDirectory(dirPath);
  return dirPath;
}

export function getPersistedCharaJsonPath() {
  return path.join(getPersistedDataDir(), PERSISTED_CHARA_JSON_FILE);
}

export function getPersistedLayoutJsonPath() {
  return path.join(getPersistedDataDir(), PERSISTED_LAYOUT_JSON_FILE);
}

export function getPersistedMsgNameJsonPath() {
  return path.join(getPersistedDataDir(), PERSISTED_MSG_NAME_JSON_FILE);
}

export function getPersistedMsgNamePath() {
  return path.join(getPersistedDataDir(), PERSISTED_MSG_NAME_FILE);
}

function getPersistedSourceManifestPath() {
  return path.join(getPersistedDataDir(), PERSISTED_SOURCE_MANIFEST_FILE);
}

function hasImportedCharacterCssSource() {
  return (
    fs.existsSync(getPersistedSourceManifestPath()) &&
    fs.existsSync(getPersistedCharaJsonPath()) &&
    fs.existsSync(getPersistedLayoutJsonPath()) &&
    fs.existsSync(getPersistedMsgNameJsonPath()) &&
    fs.existsSync(getPersistedMsgNamePath())
  );
}

function requireImportedCharacterCssSource() {
  if (hasImportedCharacterCssSource()) {
    return;
  }

  throw new Error(
    'Character CSS editor requires your ui_chara_db.prc, ui_layout_db.prc and msg_name.msbt first. Import them from Edit CSS.',
  );
}

function getTempCssDir() {
  const dirPath = path.join(app.getPath('temp'), 'fightplanner-character-css');
  ensureDirectory(dirPath);
  return dirPath;
}

export function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createMsgNameMap(msgNameJson: any) {
  const map = new Map<string, any>();
  for (const entry of msgNameJson?.strings ?? []) {
    if (typeof entry?.label === 'string') {
      map.set(entry.label, entry);
    }
  }
  for (const [label, value] of Object.entries(
    msgNameJson?.added_labels ?? {},
  )) {
    if (!map.has(label)) {
      map.set(label, { label, value });
    }
  }
  return map;
}

function normalizeMsgValue(value: string) {
  return value.replace(/\r\n/g, '\r\r\n');
}

function denormalizeMsgValue(value: string) {
  return value.replace(/\r\r\n/g, '\r\n');
}

function getDisplayName(nameId: string, msgNameJson: any) {
  const label = `nam_chr1_00_${nameId}`;
  const entry = createMsgNameMap(msgNameJson).get(label);
  const value =
    typeof entry?.value === 'string' ? denormalizeMsgValue(entry.value) : '';

  if (value.trim()) {
    return value.trim();
  }

  return nameId
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function normalizeGroupId(value: string) {
  const normalized = value.trim();
  if (!normalized || /^0x0+$/i.test(normalized)) {
    return null;
  }

  return normalized;
}

function getMsgValue(msgNameJson: any, label: string) {
  const entry = createMsgNameMap(msgNameJson).get(label);
  return typeof entry?.value === 'string'
    ? denormalizeMsgValue(entry.value)
    : '';
}

function setMsgValue(msgNameJson: any, label: string, value: string) {
  const normalizedValue = normalizeMsgValue(value);
  const entry = (msgNameJson?.strings ?? []).find(
    (candidate: any) => candidate?.label === label,
  );

  if (entry) {
    entry.value = normalizedValue;
    return;
  }

  if (
    !msgNameJson.added_labels ||
    typeof msgNameJson.added_labels !== 'object'
  ) {
    msgNameJson.added_labels = {};
  }
  msgNameJson.added_labels[label] = normalizedValue;
}

function buildCharacterSlots(entry: any, msgNameJson: any): CharacterCssSlot[] {
  const colorNum = Number(getHashText(entry, 'byte', 'color_num', '0'));
  const nameId = String(entry?.string?.['#text'] || '');
  const slots: CharacterCssSlot[] = [];

  for (let slotIndex = 0; slotIndex < Math.max(1, colorNum); slotIndex += 1) {
    const slotKey = String(slotIndex).padStart(2, '0');
    const nxxIndex = getHashText(entry, 'byte', `n${slotKey}_index`, slotKey);
    const cxxIndex = getHashText(entry, 'byte', `c${slotKey}_index`, slotKey);
    const nxxKey = String(nxxIndex).padStart(2, '0');
    const textKey = `${nxxKey}_${nameId}`;

    slots.push({
      slotIndex,
      cxxIndex,
      nxxIndex,
      characallLabel: getHashText(
        entry,
        'hash40',
        `characall_label_c${nxxKey}`,
        '',
      ),
      namChr0: getMsgValue(msgNameJson, `nam_chr0_${textKey}`),
      namChr1: getMsgValue(msgNameJson, `nam_chr1_${textKey}`),
      namChr2: getMsgValue(msgNameJson, `nam_chr2_${textKey}`),
      namChr3: getMsgValue(msgNameJson, `nam_chr3_${textKey}`),
      namStageName: getMsgValue(msgNameJson, `nam_stage_name_${textKey}`),
    });
  }

  return slots;
}

function buildCharacterEntry(entry: any, msgNameJson: any): CharacterCssEntry {
  const nameId = String(entry?.string?.['#text'] || '');
  const uiCharaId = getHashText(
    entry,
    'hash40',
    'ui_chara_id',
    `ui_chara_${nameId}`,
  );
  const order = Number(getHashText(entry, 'sbyte', 'disp_order', '-1'));
  const canSelect =
    getHashText(entry, 'bool', 'can_select', 'False') === 'True';
  const isGroup = getHashText(entry, 'byte', 'is_group', '0') === '1';

  return {
    id: uiCharaId,
    nameId,
    displayName: getDisplayName(nameId, msgNameJson),
    number: '',
    imageUrl: null,
    order,
    hidden: order < 0,
    canSelect,
    isRandom: nameId === 'random',
    uiSeriesId: getHashText(entry, 'hash40', 'ui_series_id', ''),
    fighterKind: getHashText(entry, 'hash40', 'fighter_kind', ''),
    fighterKindCorps: getHashText(entry, 'hash40', 'fighter_kind_corps', ''),
    altCharaId: getHashText(entry, 'hash40', 'alt_chara_id', ''),
    fighterType: getHashText(entry, 'hash40', 'fighter_type', ''),
    exhibitYear: String(entry?.short?.['#text'] ?? ''),
    colorNum: getHashText(entry, 'byte', 'color_num', '0'),
    colorStartIndex: getHashText(entry, 'byte', 'color_start_index', '0'),
    isMii: getHashText(entry, 'bool', 'is_mii', 'False') === 'True',
    isBoss: getHashText(entry, 'bool', 'is_boss', 'False') === 'True',
    isHiddenBoss:
      getHashText(entry, 'bool', 'is_hidden_boss', 'False') === 'True',
    isGroup,
    groupId: normalizeGroupId(getHashText(entry, 'hash40', 'group_hash', '')),
    slots: isGroup ? [] : buildCharacterSlots(entry, msgNameJson),
  };
}

function collectCharacterCssDebugSnapshot(charaJson: any, msgNameJson?: any) {
  const structs = getStructList(charaJson);
  const entries = structs.map((entry) => {
    const nameId = String(entry?.string?.['#text'] || '');
    const uiCharaId = getHashText(entry, 'hash40', 'ui_chara_id', '');
    const dispOrder = getHashText(entry, 'sbyte', 'disp_order', 'MISSING');
    const canSelect = getHashText(entry, 'bool', 'can_select', 'MISSING');
    return {
      nameId,
      uiCharaId,
      dispOrder,
      canSelect,
      rawSbyteHashes: asArray(entry?.sbyte).map((item: any) => item?.['@hash']),
      rawBoolHashes: asArray(entry?.bool).map((item: any) => item?.['@hash']),
    };
  });
  const hiddenCount = entries.filter(
    (entry) => Number(entry.dispOrder) < 0,
  ).length;
  const missingDispOrderCount = entries.filter(
    (entry) => entry.dispOrder === 'MISSING',
  ).length;
  const missingUiCharaIdCount = entries.filter(
    (entry) => !entry.uiCharaId,
  ).length;

  return {
    structCount: structs.length,
    msgNameStringCount: Array.isArray(msgNameJson?.strings)
      ? msgNameJson.strings.length
      : undefined,
    visibleCount: entries.filter((entry) => Number(entry.dispOrder) >= 0)
      .length,
    hiddenCount,
    missingDispOrderCount,
    missingUiCharaIdCount,
    sample: entries.slice(0, 5),
  };
}

export function readCurrentCharaJson() {
  requireImportedCharacterCssSource();

  const persistedPath = getPersistedCharaJsonPath();
  if (fs.existsSync(persistedPath)) {
    return {
      source: 'saved' as const,
      json: normalizeCharaParamJson(readJsonFile<any>(persistedPath)),
    };
  }

  return {
    source: 'canonical' as const,
    json: (() => {
      throw new Error('Character CSS source missing');
    })(),
  };
}

export function readCurrentLayoutJson() {
  requireImportedCharacterCssSource();

  const persistedPath = getPersistedLayoutJsonPath();
  if (fs.existsSync(persistedPath)) {
    return normalizeCharaParamJson(readJsonFile<any>(persistedPath));
  }

  throw new Error('Character CSS layout source missing');
}

export function readCurrentMsgNameJson() {
  requireImportedCharacterCssSource();

  const persistedPath = getPersistedMsgNameJsonPath();
  if (fs.existsSync(persistedPath)) {
    return readJsonFile<any>(persistedPath);
  }

  throw new Error('Character CSS source missing');
}

export function writePersistedCharacterCssData(
  charaJson: any,
  msgNameJson: any,
  layoutJson?: any,
) {
  fs.writeFileSync(
    getPersistedCharaJsonPath(),
    JSON.stringify(charaJson),
    'utf8',
  );
  fs.writeFileSync(
    getPersistedMsgNameJsonPath(),
    JSON.stringify(msgNameJson),
    'utf8',
  );
  if (layoutJson) {
    fs.writeFileSync(
      getPersistedLayoutJsonPath(),
      JSON.stringify(layoutJson),
      'utf8',
    );
  }
}

function validateLayoutPayload(
  charaJson: any,
  payload: CharacterCssLayoutPayload,
) {
  const sourceIds = getStructList(charaJson).map((entry) =>
    getHashText(entry, 'hash40', 'ui_chara_id', ''),
  );
  const orderedIds = [
    ...(payload.visibleCharacterIds || []),
    ...(payload.hiddenCharacterIds || []),
    ...Object.values(payload.groups || {}).flat(),
  ];

  if (orderedIds.length !== sourceIds.length) {
    throw new Error(
      `Expected ${sourceIds.length} characters, received ${orderedIds.length}`,
    );
  }

  const sourceCounts = sourceIds.reduce((counts, id) => {
    counts.set(id, (counts.get(id) || 0) + 1);
    return counts;
  }, new Map<string, number>());
  const payloadCounts = orderedIds.reduce((counts, id) => {
    counts.set(id, (counts.get(id) || 0) + 1);
    return counts;
  }, new Map<string, number>());

  const invalidIds = [...payloadCounts.keys()].filter(
    (id) => !sourceCounts.has(id),
  );
  if (invalidIds.length > 0) {
    throw new Error(
      `Unknown character identifiers received: ${invalidIds.join(', ')}`,
    );
  }

  const mismatchedIds = [...sourceCounts.entries()]
    .filter(([id, count]) => payloadCounts.get(id) !== count)
    .map(
      ([id, count]) =>
        `${id} expected ${count}, received ${payloadCounts.get(id) || 0}`,
    );
  if (mismatchedIds.length > 0) {
    throw new Error(
      `Character identifier counts do not match source: ${mismatchedIds.join('; ')}`,
    );
  }
}

function applyCreatedCharacterCssGroups(
  charaJson: any,
  msgNameJson: any,
  createdGroups: CharacterCssGroupCreate[] | undefined,
) {
  if (!createdGroups?.length) {
    return;
  }

  const structs = getStructList(charaJson);
  const existingIds = new Set(
    structs.map((entry) => getHashText(entry, 'hash40', 'ui_chara_id', '')),
  );
  const existingNameIds = new Set(
    structs.map((entry) => String(entry?.string?.['#text'] || '')),
  );

  for (const group of createdGroups) {
    const id = group.id.trim();
    const nameId = group.nameId.trim();
    const displayName = group.displayName.trim();
    if (!id.startsWith('ui_chara_')) {
      throw new Error(`Group ID must start with ui_chara_: ${id || '(empty)'}`);
    }
    if (!nameId || !displayName) {
      throw new Error('Group Name ID and display name cannot be empty');
    }
    if (existingIds.has(id)) {
      throw new Error(`Character or group ID already exists: ${id}`);
    }
    if (existingNameIds.has(nameId)) {
      throw new Error(`Character or group Name ID already exists: ${nameId}`);
    }

    structs.push({
      '@index': String(structs.length),
      hash40: [
        {
          '@hash': 'ui_chara_id',
          '#text': id,
        },
      ],
      string: {
        '@hash': 'name_id',
        '#text': nameId,
      },
      sbyte: [
        {
          '@hash': 'disp_order',
          '#text': '0',
        },
      ],
      byte: [
        {
          '@hash': 'is_group',
          '#text': '1',
        },
      ],
    });
    setMsgValue(msgNameJson, `nam_chr1_00_${nameId}`, displayName);
    existingIds.add(id);
    existingNameIds.add(nameId);
  }

  charaJson.struct.list.struct = structs;
  if (charaJson.struct.list['@size']) {
    charaJson.struct.list['@size'] = String(structs.length);
  }
}

function updateMsgNameJson(
  msgNameJson: any,
  renamedCharacters: Record<string, string> | undefined,
) {
  if (!renamedCharacters || Object.keys(renamedCharacters).length === 0) {
    return msgNameJson;
  }

  for (const [nameId, displayName] of Object.entries(renamedCharacters)) {
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      continue;
    }

    const label = `nam_chr1_00_${nameId}`;
    setMsgValue(msgNameJson, label, trimmedName);
  }

  return msgNameJson;
}

function duplicateNameLabels(
  msgNameJson: any,
  sourceNameId: string,
  newNameId: string,
  newDisplayName?: string | null,
) {
  const sourceStrings = Array.isArray(msgNameJson.strings)
    ? [...msgNameJson.strings]
    : [];
  const originalStringCount = Number(msgNameJson?.TXT2?.NumberOfStrings);
  if (
    Number.isInteger(originalStringCount) &&
    originalStringCount >= 0 &&
    sourceStrings.length > originalStringCount
  ) {
    const accidentallyAppended = sourceStrings.splice(originalStringCount);
    msgNameJson.strings = sourceStrings;
    if (
      !msgNameJson.added_labels ||
      typeof msgNameJson.added_labels !== 'object'
    ) {
      msgNameJson.added_labels = {};
    }
    accidentallyAppended.forEach((entry) => {
      if (
        typeof entry?.label === 'string' &&
        typeof entry?.value === 'string'
      ) {
        msgNameJson.added_labels[entry.label] = entry.value;
      }
    });
  }
  const existingLabels = new Set(
    sourceStrings
      .map((entry) => entry?.label)
      .filter((label): label is string => typeof label === 'string'),
  );
  Object.keys(msgNameJson.added_labels || {}).forEach((label) =>
    existingLabels.add(label),
  );

  for (const entry of sourceStrings) {
    const label = String(entry?.label || '');
    if (
      !label.endsWith(`_${sourceNameId}`) &&
      !label.includes(`_${sourceNameId}_`)
    ) {
      continue;
    }

    const newLabel = label.replace(sourceNameId, newNameId);
    setMsgValue(msgNameJson, newLabel, String(entry?.value || ''));
    existingLabels.add(newLabel);
  }

  for (const [label, value] of Object.entries(msgNameJson.added_labels || {})) {
    if (
      !label.endsWith(`_${sourceNameId}`) &&
      !label.includes(`_${sourceNameId}_`)
    )
      continue;
    const newLabel = label.replace(sourceNameId, newNameId);
    if (!existingLabels.has(newLabel)) {
      setMsgValue(msgNameJson, newLabel, String(value));
      existingLabels.add(newLabel);
    }
  }

  if (newDisplayName?.trim()) {
    setMsgValue(msgNameJson, `nam_chr1_00_${newNameId}`, newDisplayName.trim());
  }
}

function applyCharacterUpdates(
  charaJson: any,
  msgNameJson: any,
  characterUpdates: Record<string, CharacterCssUpdate> | undefined,
) {
  if (!characterUpdates) {
    return;
  }

  const entryById = new Map(
    getStructList(charaJson).map(
      (entry) =>
        [getHashText(entry, 'hash40', 'ui_chara_id', ''), entry] as const,
    ),
  );

  for (const [id, update] of Object.entries(characterUpdates)) {
    const entry = entryById.get(id);
    if (!entry) {
      continue;
    }

    const currentNameId = String(entry?.string?.['#text'] || '');
    const nextNameId = update.nameId?.trim() || currentNameId;

    if (update.uiCharaId) {
      setHashText(entry, 'hash40', 'ui_chara_id', update.uiCharaId.trim());
    }
    if (update.uiSeriesId) {
      setHashText(entry, 'hash40', 'ui_series_id', update.uiSeriesId.trim());
    }
    if (update.fighterKind) {
      setHashText(entry, 'hash40', 'fighter_kind', update.fighterKind.trim());
    }
    if (update.fighterKindCorps) {
      setHashText(
        entry,
        'hash40',
        'fighter_kind_corps',
        update.fighterKindCorps.trim(),
      );
    }
    if (update.altCharaId) {
      setHashText(entry, 'hash40', 'alt_chara_id', update.altCharaId.trim());
    }
    if (update.fighterType) {
      setHashText(entry, 'hash40', 'fighter_type', update.fighterType.trim());
    }
    if (update.nameId) {
      entry.string['#text'] = nextNameId;
    }
    if (typeof update.exhibitYear === 'string' && entry.short) {
      entry.short['#text'] = update.exhibitYear;
    }
    if (typeof update.colorNum === 'string') {
      setHashText(entry, 'byte', 'color_num', update.colorNum);
    }
    if (typeof update.colorStartIndex === 'string') {
      ensureHashText(
        entry,
        'byte',
        'color_start_index',
        update.colorStartIndex,
      );
    }
    if (typeof update.canSelect === 'boolean') {
      setHashTextIfPresent(
        entry,
        'bool',
        'can_select',
        update.canSelect ? 'True' : 'False',
      );
    }
    if (typeof update.isMii === 'boolean') {
      setHashTextIfPresent(
        entry,
        'bool',
        'is_mii',
        update.isMii ? 'True' : 'False',
      );
    }
    if (typeof update.isBoss === 'boolean') {
      setHashTextIfPresent(
        entry,
        'bool',
        'is_boss',
        update.isBoss ? 'True' : 'False',
      );
    }
    if (typeof update.isHiddenBoss === 'boolean') {
      setHashTextIfPresent(
        entry,
        'bool',
        'is_hidden_boss',
        update.isHiddenBoss ? 'True' : 'False',
      );
    }

    for (const [slotKey, slotUpdate] of Object.entries(update.slots || {})) {
      const slotIndex = Number(slotKey);
      if (!Number.isInteger(slotIndex) || slotIndex < 0) {
        continue;
      }

      const paddedSlot = String(slotIndex).padStart(2, '0');
      const nxxIndex =
        slotUpdate.nxxIndex ??
        getHashText(entry, 'byte', `n${paddedSlot}_index`, paddedSlot);
      const cxxIndex =
        slotUpdate.cxxIndex ??
        getHashText(entry, 'byte', `c${paddedSlot}_index`, paddedSlot);
      const paddedNxx = String(nxxIndex).padStart(2, '0');
      const textKey = `${paddedNxx}_${nextNameId}`;

      ensureHashText(entry, 'byte', `n${paddedSlot}_index`, nxxIndex);
      ensureHashText(entry, 'byte', `c${paddedSlot}_index`, cxxIndex);

      if (typeof slotUpdate.characallLabel === 'string') {
        ensureHashText(
          entry,
          'hash40',
          `characall_label_c${paddedNxx}`,
          slotUpdate.characallLabel.trim(),
        );
      }
      if (typeof slotUpdate.namChr0 === 'string') {
        setMsgValue(msgNameJson, `nam_chr0_${textKey}`, slotUpdate.namChr0);
      }
      if (typeof slotUpdate.namChr1 === 'string') {
        setMsgValue(msgNameJson, `nam_chr1_${textKey}`, slotUpdate.namChr1);
      }
      if (typeof slotUpdate.namChr2 === 'string') {
        setMsgValue(msgNameJson, `nam_chr2_${textKey}`, slotUpdate.namChr2);
      }
      if (typeof slotUpdate.namChr3 === 'string') {
        setMsgValue(msgNameJson, `nam_chr3_${textKey}`, slotUpdate.namChr3);
      }
      if (typeof slotUpdate.namStageName === 'string') {
        setMsgValue(
          msgNameJson,
          `nam_stage_name_${textKey}`,
          slotUpdate.namStageName,
        );
      }
    }
  }
}

function applyLayoutToCharaJson(
  charaJson: any,
  payload: CharacterCssLayoutPayload,
) {
  validateLayoutPayload(charaJson, payload);

  const entriesById = getStructList(charaJson).reduce((entries, entry) => {
    const id = getHashText(entry, 'hash40', 'ui_chara_id', '');
    const matchingEntries = entries.get(id) || [];
    matchingEntries.push(entry);
    entries.set(id, matchingEntries);
    return entries;
  }, new Map<string, any[]>());
  const nextEntries: any[] = [];

  payload.visibleCharacterIds.forEach((id, index) => {
    const entry = entriesById.get(id)?.shift();
    if (!entry) {
      return;
    }

    const sbyteOrder = getCharacterCssSbyteOrder(index);
    setHashTextIfPresent(entry, 'sbyte', 'skill_list_order', sbyteOrder);
    setHashText(entry, 'sbyte', 'disp_order', sbyteOrder);
    setHashTextIfPresent(
      entry,
      'bool',
      'can_select',
      entry?.string?.['#text'] === 'random' ? 'False' : 'True',
    );
    setHashTextIfPresent(entry, 'hash40', 'group_hash', '');
    nextEntries.push(entry);
  });

  payload.hiddenCharacterIds.forEach((id) => {
    const entry = entriesById.get(id)?.shift();
    if (!entry) {
      return;
    }

    setHashText(entry, 'sbyte', 'disp_order', -1);
    setHashTextIfPresent(entry, 'bool', 'can_select', 'False');
    setHashTextIfPresent(entry, 'hash40', 'group_hash', '');
    nextEntries.push(entry);
  });

  for (const [groupId, characterIds] of Object.entries(payload.groups || {})) {
    characterIds.forEach((id, index) => {
      const entry = entriesById.get(id)?.shift();
      if (!entry) {
        return;
      }

      setHashText(
        entry,
        'sbyte',
        'disp_order',
        getCharacterCssSbyteOrder(index),
      );
      ensureHashText(entry, 'hash40', 'group_hash', groupId);
      nextEntries.push(entry);
    });
  }

  charaJson.struct.list.struct = nextEntries.map((entry, index) => ({
    ...entry,
    '@index': String(index),
  }));
  if (charaJson.struct.list['@size']) {
    charaJson.struct.list['@size'] = String(nextEntries.length);
  }
  return charaJson;
}

export async function importCharacterCssSourceFiles(
  payload: CharacterCssSourceImportPayload,
) {
  const prcPath = payload.prcPath?.trim();
  const layoutPrcPath = payload.layoutPrcPath?.trim();
  const msgNamePath = payload.msgNamePath?.trim();

  if (!prcPath || path.basename(prcPath) !== SOURCE_CHARA_PRC_FILE) {
    throw new Error(`Select ${SOURCE_CHARA_PRC_FILE}`);
  }
  if (
    !layoutPrcPath ||
    path.basename(layoutPrcPath) !== SOURCE_LAYOUT_PRC_FILE
  ) {
    throw new Error(`Select ${SOURCE_LAYOUT_PRC_FILE}`);
  }
  if (!msgNamePath || path.basename(msgNamePath) !== GENERATED_MSG_NAME_FILE) {
    throw new Error(`Select ${GENERATED_MSG_NAME_FILE}`);
  }
  if (!fs.existsSync(prcPath)) {
    throw new Error(`Character PRC not found: ${prcPath}`);
  }
  if (!fs.existsSync(layoutPrcPath)) {
    throw new Error(`Layout PRC not found: ${layoutPrcPath}`);
  }
  if (!fs.existsSync(msgNamePath)) {
    throw new Error(`MSBT not found: ${msgNamePath}`);
  }

  const tempCssDir = getTempCssDir();
  const tempCharaJsonPath = path.join(tempCssDir, TEMP_CHARA_JSON_FILE);
  const tempLayoutJsonPath = path.join(tempCssDir, TEMP_LAYOUT_JSON_FILE);
  const tempCharaXmlPath = path.join(tempCssDir, 'ui_chara_db_source.xml');
  const tempLayoutXmlPath = path.join(tempCssDir, 'ui_layout_db_source.xml');
  const tempMsgNameJsonPath = path.join(tempCssDir, TEMP_MSG_NAME_JSON_FILE);

  let charaJson: any;
  let layoutJson: any;
  try {
    logCharacterCss('Import source started', {
      prcPath,
      layoutPrcPath,
      msgNamePath,
      paramLabelsPath: resolveParamLabelsPath(),
    });
    await runPrcToJson(prcPath, tempCharaJsonPath);
    await runPrcToJson(layoutPrcPath, tempLayoutJsonPath);
    charaJson = normalizeCharaParamJson(readJsonFile<any>(tempCharaJsonPath));
    layoutJson = normalizeCharaParamJson(readJsonFile<any>(tempLayoutJsonPath));
    logCharacterCss('PRC converted with prc2json', {
      outputPath: tempCharaJsonPath,
      layoutOutputPath: tempLayoutJsonPath,
      ...collectCharacterCssDebugSnapshot(charaJson),
      layoutStructCount: getStructList(layoutJson).length,
    });
  } catch (error) {
    logCharacterCss('prc2json failed, falling back to ParamXML', {
      error: error instanceof Error ? error.message : String(error),
      xmlPath: tempCharaXmlPath,
      layoutXmlPath: tempLayoutXmlPath,
    });
    await runParamXmlDisassemble(prcPath, tempCharaXmlPath);
    await runParamXmlDisassemble(layoutPrcPath, tempLayoutXmlPath);
    charaJson = charaXmlToJson(fs.readFileSync(tempCharaXmlPath, 'utf8'));
    layoutJson = charaXmlToJson(fs.readFileSync(tempLayoutXmlPath, 'utf8'));
    logCharacterCss('PRC converted with ParamXML fallback', {
      outputPath: tempCharaXmlPath,
      layoutOutputPath: tempLayoutXmlPath,
      ...collectCharacterCssDebugSnapshot(charaJson),
      layoutStructCount: getStructList(layoutJson).length,
    });
  }
  await runMsbtToJson(msgNamePath, tempMsgNameJsonPath);

  const msgNameJson = readJsonFile<any>(tempMsgNameJsonPath);
  getStructList(charaJson);
  if (!Array.isArray(msgNameJson?.strings)) {
    throw new Error('Invalid msg_name.msbt: could not read strings');
  }

  logCharacterCss('MSBT converted and source validated', {
    outputPath: tempMsgNameJsonPath,
    ...collectCharacterCssDebugSnapshot(charaJson, msgNameJson),
    layoutStructCount: getStructList(layoutJson).length,
  });

  fs.writeFileSync(
    getPersistedCharaJsonPath(),
    JSON.stringify(charaJson),
    'utf8',
  );
  fs.writeFileSync(
    getPersistedLayoutJsonPath(),
    JSON.stringify(layoutJson),
    'utf8',
  );
  fs.writeFileSync(
    getPersistedMsgNameJsonPath(),
    JSON.stringify(msgNameJson),
    'utf8',
  );
  fs.copyFileSync(msgNamePath, getPersistedMsgNamePath());
  fs.writeFileSync(
    getPersistedSourceManifestPath(),
    JSON.stringify(
      {
        importedAt: new Date().toISOString(),
        sourceFiles: {
          uiCharaDbPrc: prcPath,
          uiLayoutDbPrc: layoutPrcPath,
          msgNameMsbt: msgNamePath,
        },
      },
      null,
      2,
    ),
    'utf8',
  );

  return {
    success: true as const,
    sourcePaths: {
      prcPath,
      layoutPrcPath,
      msgNamePath,
    },
    ...getCharacterCssLayoutData(),
  };
}

function ensureCharacterModMetadata(modRootPath: string) {
  const infoTomlPath = path.join(modRootPath, 'info.toml');

  if (!fs.existsSync(infoTomlPath)) {
    fs.writeFileSync(
      infoTomlPath,
      [
        'display_name = "Character CSS Layout"',
        'version = "1.0.0"',
        'category = "ui"',
        'description = """',
        'Generated by the MOSAIC Characters tab.',
        '"""',
        '',
      ].join('\n'),
      'utf8',
    );
  }
}

/** Collect saved editor data without importing, converting, or rewriting files. */
export function getCharacterCssDebugReport() {
  const dataDir = path.join(app.getPath('userData'), 'data');
  const files = [
    PERSISTED_SOURCE_MANIFEST_FILE,
    PERSISTED_CHARA_JSON_FILE,
    PERSISTED_LAYOUT_JSON_FILE,
    PERSISTED_MSG_NAME_JSON_FILE,
    PERSISTED_MSG_NAME_FILE,
  ].map((name) => {
    const filePath = path.join(dataDir, name);
    const result = {
      name,
      exists: false,
      sizeBytes: null as number | null,
      modifiedAt: null as string | null,
      data: null as unknown,
      rawText: null as string | null,
      error: null as string | null,
    };
    try {
      const stat = fs.statSync(filePath);
      result.exists = true;
      result.sizeBytes = stat.size;
      result.modifiedAt = stat.mtime.toISOString();
      if (name.endsWith('.json')) {
        const text = fs.readFileSync(filePath, 'utf8');
        try {
          result.data = JSON.parse(text);
        } catch (error) {
          // Preserve broken input too: it is often the reason for a debug export.
          result.rawText = text;
          result.error = error.message || String(error);
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        result.error = error.message || String(error);
      }
    }
    return result;
  });

  const imported = files.every((file) => file.exists);
  let layout: CharacterCssLayoutData | null = null;
  let layoutError: string | null = null;
  if (imported) {
    try {
      layout = getCharacterCssLayoutData();
    } catch (error) {
      layoutError = error.message || String(error);
    }
  }

  return {
    scope: 'persisted-data',
    imported,
    files,
    layout,
    layoutError,
  };
}

export function getCharacterCssLayoutData(): CharacterCssLayoutData {
  const currentChara = readCurrentCharaJson();
  const msgNameJson = readCurrentMsgNameJson();
  const entries = getStructList(currentChara.json).map((entry) =>
    buildCharacterEntry(entry, msgNameJson),
  );

  const rootEntries = entries.filter((entry) => !entry.groupId);
  const visibleCharacters = rootEntries
    .filter((entry) => !entry.hidden)
    .sort((left, right) => left.order - right.order);
  const hiddenCharacters = rootEntries
    .filter((entry) => entry.hidden)
    .sort((left, right) => left.displayName.localeCompare(right.displayName));
  const groups = entries
    .filter((entry) => entry.groupId)
    .reduce<Record<string, CharacterCssEntry[]>>((result, entry) => {
      const groupId = entry.groupId!;
      (result[groupId] ||= []).push(entry);
      return result;
    }, {});
  entries
    .filter((entry) => entry.isGroup)
    .forEach((entry) => {
      groups[entry.id] ||= [];
    });
  Object.values(groups).forEach((characters) => {
    characters.sort((left, right) => left.order - right.order);
  });

  logCharacterCss('Layout data built', {
    source: currentChara.source,
    total: entries.length,
    visible: visibleCharacters.length,
    hidden: hiddenCharacters.length,
    groups: Object.keys(groups).length,
    missingOrder: entries.filter((entry) => Number.isNaN(entry.order)).length,
    sample: entries.slice(0, 5).map((entry) => ({
      id: entry.id,
      nameId: entry.nameId,
      displayName: entry.displayName,
      order: entry.order,
      hidden: entry.hidden,
      canSelect: entry.canSelect,
    })),
  });

  return {
    source: currentChara.source,
    visibleCharacters,
    hiddenCharacters,
    groups,
  };
}

export function duplicateCharacterCssEntry(
  payload: DuplicateCharacterCssPayload,
) {
  const hasColorRange =
    payload.colorStartIndex !== undefined || payload.colorCount !== undefined;
  if (
    hasColorRange &&
    (!Number.isInteger(payload.colorStartIndex) ||
      !Number.isInteger(payload.colorCount) ||
      payload.colorStartIndex! < 0 ||
      payload.colorCount! < 1 ||
      payload.colorCount! > 255 ||
      payload.colorStartIndex! + payload.colorCount! > 256)
  ) {
    throw new Error('Choose a valid color range between c00 and c255.');
  }
  const newUiCharaId = payload.newUiCharaId.trim();
  if (!newUiCharaId || !newUiCharaId.startsWith('ui_chara_')) {
    throw new Error('The new Character ID must start with ui_chara_');
  }

  const currentChara = readCurrentCharaJson();
  const charaJson = clone(currentChara.json);
  const layoutJson = clone(readCurrentLayoutJson());
  const msgNameJson = clone(readCurrentMsgNameJson());
  const structs = getStructList(charaJson);
  const layoutStructs = getStructList(layoutJson);
  const sourceIndex = structs.findIndex(
    (entry) =>
      getHashText(entry, 'hash40', 'ui_chara_id', '') ===
      payload.sourceCharacterId,
  );

  if (sourceIndex < 0) {
    throw new Error(`Character not found: ${payload.sourceCharacterId}`);
  }

  if (
    structs.some(
      (entry) =>
        getHashText(entry, 'hash40', 'ui_chara_id', '') === newUiCharaId,
    )
  ) {
    throw new Error(`Character ID already exists: ${newUiCharaId}`);
  }

  const sourceEntry = structs[sourceIndex];
  const sourceNameId = String(sourceEntry?.string?.['#text'] || '');
  const newNameId =
    payload.newNameId?.trim() || newUiCharaId.replace(/^ui_chara_/, '').trim();

  if (!newNameId) {
    throw new Error('The new Name ID cannot be empty');
  }

  const duplicatedEntry = clone(sourceEntry);
  duplicatedEntry['@index'] = String(structs.length);
  setHashText(duplicatedEntry, 'hash40', 'ui_chara_id', newUiCharaId);
  setHashText(
    duplicatedEntry,
    'hash40',
    'fighter_type',
    'fighter_type_normal',
  );
  setHashText(
    duplicatedEntry,
    'hash40',
    'alt_chara_id',
    '0x02302d482a',
  );
  duplicatedEntry.string['#text'] = newNameId;
  const duplicatedOrder = getCharacterCssSbyteOrder(structs.length);
  setHashTextIfPresent(
    duplicatedEntry,
    'sbyte',
    'skill_list_order',
    duplicatedOrder,
  );
  setHashText(duplicatedEntry, 'sbyte', 'disp_order', duplicatedOrder);
  setHashTextIfPresent(duplicatedEntry, 'bool', 'is_dlc', 'False');
  setHashTextIfPresent(duplicatedEntry, 'bool', 'is_patch', 'False');
  ensureHashText(
    duplicatedEntry,
    'hash40',
    'original_ui_chara_hash',
    payload.sourceCharacterId,
  );

  structs.push(duplicatedEntry);
  charaJson.struct.list.struct = structs;
  if (charaJson.struct.list['@size']) {
    charaJson.struct.list['@size'] = String(structs.length);
  }

  const duplicatedLayoutEntries = layoutStructs
    .filter(
      (entry) =>
        getHashText(entry, 'hash40', 'ui_chara_id', '') ===
        payload.sourceCharacterId,
    )
    .map((entry) => {
      const nextEntry = clone(entry);
      setHashText(nextEntry, 'hash40', 'ui_chara_id', newUiCharaId);
      const layoutId = getHashText(nextEntry, 'hash40', 'ui_layout_id', '');
      if (layoutId) {
        setHashText(
          nextEntry,
          'hash40',
          'ui_layout_id',
          layoutId.replace(payload.sourceCharacterId, newUiCharaId),
        );
      }
      return nextEntry;
    });

  if (duplicatedLayoutEntries.length > 0) {
    layoutJson.struct.list.struct = [
      ...layoutStructs,
      ...duplicatedLayoutEntries,
    ].map((entry, index) => ({
      ...entry,
      '@index': String(index),
    }));
    if (layoutJson.struct.list['@size']) {
      layoutJson.struct.list['@size'] = String(
        layoutJson.struct.list.struct.length,
      );
    }
  }

  duplicateNameLabels(
    msgNameJson,
    sourceNameId,
    newNameId,
    payload.newDisplayName,
  );
  if (hasColorRange) {
    ensureHashText(
      duplicatedEntry,
      'byte',
      'color_start_index',
      String(payload.colorStartIndex),
    );
    ensureHashText(
      duplicatedEntry,
      'byte',
      'color_num',
      String(payload.colorCount),
    );
    const displayName = payload.newDisplayName?.trim() || newNameId;
    for (let index = 0; index < payload.colorCount!; index++) {
      const key = String(index).padStart(2, '0');
      ensureHashText(duplicatedEntry, 'byte', `c${key}_index`, String(index));
      ensureHashText(duplicatedEntry, 'byte', `n${key}_index`, String(index));
      const callLabel =
        getHashText(sourceEntry, 'hash40', `characall_label_c${key}`, '') ||
        getHashText(sourceEntry, 'hash40', 'characall_label_c00', '');
      if (callLabel)
        ensureHashText(
          duplicatedEntry,
          'hash40',
          `characall_label_c${key}`,
          callLabel,
        );
      for (const prefix of [
        'nam_chr0',
        'nam_chr1',
        'nam_chr2',
        'nam_chr3',
        'nam_stage_name',
      ]) {
        setMsgValue(
          msgNameJson,
          `${prefix}_${key}_${newNameId}`,
          ['nam_chr2', 'nam_chr3'].includes(prefix)
            ? displayName.toUpperCase()
            : displayName,
        );
      }
    }
  }
  writePersistedCharacterCssData(charaJson, msgNameJson, layoutJson);

  return getCharacterCssLayoutData();
}

export function removeCharacterCssEntry(payload: RemoveCharacterCssPayload) {
  const characterId = payload.characterId.trim();
  if (!characterId) {
    throw new Error('Character ID cannot be empty');
  }

  const charaJson = clone(readCurrentCharaJson().json);
  const layoutJson = clone(readCurrentLayoutJson());
  const msgNameJson = clone(readCurrentMsgNameJson());
  const structs = getStructList(charaJson);
  const nextStructs = structs.filter(
    (entry) => getHashText(entry, 'hash40', 'ui_chara_id', '') !== characterId,
  );

  if (nextStructs.length === structs.length) {
    throw new Error(`Character not found: ${characterId}`);
  }

  nextStructs.forEach((entry, index) => {
    entry['@index'] = String(index);
  });

  charaJson.struct.list.struct = nextStructs;
  if (charaJson.struct.list['@size']) {
    charaJson.struct.list['@size'] = String(nextStructs.length);
  }

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

  writePersistedCharacterCssData(charaJson, msgNameJson, layoutJson);
  return getCharacterCssLayoutData();
}

export async function saveCharacterCssLayout(
  payload: CharacterCssLayoutPayload,
) {
  const charaJson = clone(readCurrentCharaJson().json);
  const layoutJson = clone(readCurrentLayoutJson());
  const msgNameJson = updateMsgNameJson(
    clone(readCurrentMsgNameJson()),
    payload.renamedCharacters,
  );
  applyCreatedCharacterCssGroups(charaJson, msgNameJson, payload.createdGroups);
  applyLayoutToCharaJson(charaJson, payload);
  applyCharacterUpdates(charaJson, msgNameJson, payload.characterUpdates);

  const persistedCharaJsonPath = getPersistedCharaJsonPath();
  const persistedLayoutJsonPath = getPersistedLayoutJsonPath();
  const persistedMsgNameJsonPath = getPersistedMsgNameJsonPath();
  fs.writeFileSync(persistedCharaJsonPath, JSON.stringify(charaJson), 'utf8');
  fs.writeFileSync(persistedLayoutJsonPath, JSON.stringify(layoutJson), 'utf8');
  fs.writeFileSync(
    persistedMsgNameJsonPath,
    JSON.stringify(msgNameJson),
    'utf8',
  );

  const tempCssDir = getTempCssDir();
  const tempCharaJsonPath = path.join(tempCssDir, TEMP_CHARA_JSON_FILE);
  const tempLayoutJsonPath = path.join(tempCssDir, TEMP_LAYOUT_JSON_FILE);
  const tempCharaXmlPath = path.join(tempCssDir, TEMP_CHARA_XML_FILE);
  const tempLayoutXmlPath = path.join(tempCssDir, TEMP_LAYOUT_XML_FILE);
  const tempMsgNameJsonPath = path.join(tempCssDir, TEMP_MSG_NAME_JSON_FILE);
  const generatedMsgNamePath = path.join(tempCssDir, GENERATED_MSG_NAME_FILE);

  fs.writeFileSync(tempCharaJsonPath, JSON.stringify(charaJson), 'utf8');
  fs.writeFileSync(tempLayoutJsonPath, JSON.stringify(layoutJson), 'utf8');
  fs.writeFileSync(tempCharaXmlPath, charaJsonToParamXml(charaJson), 'utf8');
  fs.writeFileSync(tempLayoutXmlPath, charaJsonToParamXml(layoutJson), 'utf8');
  fs.writeFileSync(tempMsgNameJsonPath, JSON.stringify(msgNameJson), 'utf8');

  const charaPrcResult = await runParamXml(tempCharaXmlPath);
  const layoutPrcResult = await runParamXml(tempLayoutXmlPath);
  const generatedCharaPrcPath = charaPrcResult.outputPath;
  const generatedLayoutPrcPath = layoutPrcResult.outputPath;

  const hasMsbtChanges =
    (payload.createdGroups?.length || 0) > 0 ||
    Object.keys(payload.renamedCharacters || {}).length > 0 ||
    Object.keys(payload.characterUpdates || {}).length > 0;
  let msbtResult: ToolExecutionResult = { stdout: '', stderr: '' };

  if (fs.existsSync(generatedMsgNamePath)) {
    fs.unlinkSync(generatedMsgNamePath);
  }

  if (hasMsbtChanges) {
    const msbtToolPath = resolveMsbtEditorExecutable();
    msbtResult = await runNativeTool(msbtToolPath, [
      tempMsgNameJsonPath,
      generatedMsgNamePath,
    ]);
  } else {
    const baseMsgNamePath = getPersistedMsgNamePath();
    if (!fs.existsSync(baseMsgNamePath)) {
      throw new Error(
        'Character CSS editor requires your msg_name.msbt first. Import it from Edit CSS.',
      );
    }
    fs.copyFileSync(baseMsgNamePath, generatedMsgNamePath);
  }

  if (
    !fs.existsSync(generatedMsgNamePath) ||
    fs.statSync(generatedMsgNamePath).size === 0
  ) {
    throw new Error('MSBTEditorCLI did not generate a valid msg_name.msbt');
  }

  const modsPath = store.get('modsPath') as string | null;
  if (!modsPath) {
    throw new Error(
      'Mods folder not configured. Set your mods path before saving a character CSS layout.',
    );
  }

  if (!fs.existsSync(modsPath)) {
    throw new Error(`Configured mods folder does not exist: ${modsPath}`);
  }

  const modRoot = path.join(modsPath, 'Character CSS Layout');
  const databaseDir = path.join(modRoot, 'ui', 'param', 'database');
  const messageDir = path.join(modRoot, 'ui', 'message');
  ensureDirectory(databaseDir);
  ensureDirectory(messageDir);
  ensureCharacterModMetadata(modRoot);

  const targetCharaPrcPath = path.join(databaseDir, SOURCE_CHARA_PRC_FILE);
  const targetLayoutPrcPath = path.join(databaseDir, SOURCE_LAYOUT_PRC_FILE);
  const targetMsgNamePath = path.join(messageDir, GENERATED_MSG_NAME_FILE);
  ['ui_chara_db.prcxml', 'ui_layout_db.prcxml'].forEach(
    (obsoleteFileName) => {
      const obsoletePath = path.join(databaseDir, obsoleteFileName);
      if (fs.existsSync(obsoletePath)) {
        fs.unlinkSync(obsoletePath);
      }
    },
  );
  fs.copyFileSync(generatedCharaPrcPath, targetCharaPrcPath);
  fs.copyFileSync(generatedLayoutPrcPath, targetLayoutPrcPath);
  fs.copyFileSync(generatedMsgNamePath, targetMsgNamePath);
  fs.copyFileSync(generatedMsgNamePath, getPersistedMsgNamePath());

  return {
    success: true as const,
    source: 'saved' as const,
    persistedCharaJsonPath,
    persistedLayoutJsonPath,
    persistedMsgNameJsonPath,
    generatedCharaPrcPath,
    generatedLayoutPrcPath,
    generatedMsgNamePath,
    modCharaPrcPath: targetCharaPrcPath,
    modLayoutPrcPath: targetLayoutPrcPath,
    modMsgNamePath: targetMsgNamePath,
    stdout: [
      charaPrcResult.stdout,
      layoutPrcResult.stdout,
      msbtResult.stdout,
    ]
      .filter(Boolean)
      .join('\n'),
    stderr: [
      charaPrcResult.stderr,
      layoutPrcResult.stderr,
      msbtResult.stderr,
    ]
      .filter(Boolean)
      .join('\n'),
  };
}
