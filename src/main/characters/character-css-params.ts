import * as fs from 'fs';
import { XMLParser } from 'fast-xml-parser';

import { resolveParamLabelsPath } from './character-css-tools';

const MIN_PARAM_XML_SBYTE = -128;

const MAX_PARAM_XML_SBYTE = 127;

let paramLabelMapCache: Map<string, string> | null = null;

const PARAM_XML_TAG_BY_COLLECTION: Record<string, string> = {
  hash40: 'hash40',
  string: 'string',
  short: 'short',
  int: 'int',
  sbyte: 'sbyte',
  bool: 'bool',
  byte: 'byte',
  float: 'float',
};

const CSS_MANAGER_FIELD_INDEX: Record<string, Record<string, number>> = {
  hash40: {
    ui_chara_id: 0,
    fighter_kind: 1,
    fighter_kind_corps: 2,
    ui_series_id: 3,
    fighter_type: 4,
    alt_chara_id: 5,
  },
  sbyte: {
    skill_list_order: 1,
    disp_order: 2,
  },
  bool: {
    can_select: 3,
    is_mii: 6,
    is_boss: 7,
    is_hidden_boss: 8,
    is_dlc: 9,
    is_patch: 10,
  },
  byte: {
    color_num: 0,
    c00_index: 1,
    c01_index: 2,
    c02_index: 3,
    c03_index: 4,
    c04_index: 5,
    c05_index: 6,
    c06_index: 7,
    c07_index: 8,
    n00_index: 9,
    n01_index: 10,
    n02_index: 11,
    n03_index: 12,
    n04_index: 13,
    n05_index: 14,
    n06_index: 15,
    n07_index: 16,
  },
};

const CSS_MANAGER_LAYOUT_FIELD_INDEX: Record<string, Record<string, number>> = {
  hash40: {
    ui_layout_id: 0,
    ui_chara_id: 1,
  },
  byte: {
    chara_color: 0,
  },
};

function normalizeHashLiteral(value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue.toLowerCase().startsWith('0x')) {
    return trimmedValue;
  }

  const label = getParamLabelMap().get(trimmedValue.toLowerCase());
  return label || trimmedValue;
}

function normalizeHashForCompare(value: string) {
  return value.trim().toLowerCase();
}

function getParamLabelMap() {
  if (paramLabelMapCache) {
    return paramLabelMapCache;
  }

  paramLabelMapCache = new Map<string, string>();
  const labelsPath = resolveParamLabelsPath();
  if (!labelsPath || !fs.existsSync(labelsPath)) {
    return paramLabelMapCache;
  }

  const labelsText = fs.readFileSync(labelsPath, 'utf8');
  for (const line of labelsText.split(/\r?\n/)) {
    const [hash, ...labelParts] = line.split(',');
    const label = labelParts.join(',').trim();
    if (hash?.trim().toLowerCase().startsWith('0x') && label) {
      paramLabelMapCache.set(hash.trim().toLowerCase(), label);
    }
  }

  return paramLabelMapCache;
}

function makeCrcTable() {
  const table: number[] = [];
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

const CRC_TABLE = makeCrcTable();

function crc32(value: string) {
  let crc = 0 ^ -1;
  for (let index = 0; index < value.length; index += 1) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ value.charCodeAt(index)) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function toHash40(value: string) {
  const normalized = value.trim();
  if (normalized.startsWith('0x')) {
    return normalized;
  }

  const hash = (BigInt(normalized.length) << 32n) + BigInt(crc32(normalized));
  return `0x${hash.toString(16).padStart(10, '0').toUpperCase()}`;
}

function escapeXml(value: string | number | boolean) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function clampParamXmlSbyteValue(value: string) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return value;
  }

  return String(
    Math.min(
      Math.max(Math.trunc(numericValue), MIN_PARAM_XML_SBYTE),
      MAX_PARAM_XML_SBYTE,
    ),
  );
}

function scalarParamToXml(type: string, entry: any, fallbackIndex: number) {
  const xmlTag = PARAM_XML_TAG_BY_COLLECTION[type] || type;
  const hash = toHash40(String(entry?.['@hash'] ?? fallbackIndex));
  const textValue = String(entry?.['#text'] ?? '');
  const value =
    type === 'hash40'
      ? toHash40(textValue)
      : type === 'sbyte'
        ? clampParamXmlSbyteValue(textValue)
        : textValue;
  return `<${xmlTag} hash="${hash}">${escapeXml(value)}</${xmlTag}>`;
}

function paramStructToXml(entry: any, index: number) {
  const structIndex = entry?.['@index'] ?? index;
  const lines = [`<struct index="${escapeXml(structIndex)}">`];

  for (const [key, value] of Object.entries(entry)) {
    if (key.startsWith('@')) {
      continue;
    }

    if (Array.isArray(value)) {
      value.forEach((item, itemIndex) => {
        lines.push(`  ${scalarParamToXml(key, item, itemIndex)}`);
      });
      continue;
    }

    if (value && typeof value === 'object' && '#text' in value) {
      lines.push(`  ${scalarParamToXml(key, value, 0)}`);
    }
  }

  lines.push('</struct>');
  return lines.join('\n');
}

export function charaJsonToParamXml(charaJson: any) {
  const list = charaJson?.struct?.list;
  const structs = getStructList(charaJson);
  const listHash = toHash40(String(list?.['@hash'] ?? 'db_root'));
  const lines = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<struct>',
    `  <list size="${structs.length}" hash="${listHash}">`,
  ];

  structs.forEach((entry, index) => {
    lines.push(
      paramStructToXml(entry, index)
        .split('\n')
        .map((line) => `    ${line}`)
        .join('\n'),
    );
  });

  lines.push('  </list>', '</struct>', '');
  return lines.join('\n');
}

export function getStructList(charaJson: any): any[] {
  const list = charaJson?.struct?.list?.struct;
  if (!Array.isArray(list)) {
    throw new Error('Invalid ui_chara_db JSON: missing struct.list.struct');
  }

  return list;
}

export function asArray<T>(value: T | T[] | undefined): T[] {
  if (Array.isArray(value)) {
    return value;
  }

  return typeof value === 'undefined' ? [] : [value];
}

function normalizeParamXmlStruct(entry: any) {
  if (!entry || typeof entry !== 'object') {
    return entry;
  }

  const mappings: Array<[string, string, boolean]> = [
    ['Hash40', 'hash40', true],
    ['String', 'string', false],
    ['I16', 'short', false],
    ['I32', 'int', true],
    ['I8', 'sbyte', true],
    ['Bool', 'bool', true],
    ['U8', 'byte', true],
    ['F32', 'float', true],
    ['Float', 'float', true],
  ];

  mappings.forEach(([sourceKey, targetKey, targetIsArray]) => {
    if (typeof entry[sourceKey] === 'undefined') {
      return;
    }

    entry[targetKey] = targetIsArray
      ? asArray(entry[sourceKey])
      : asArray(entry[sourceKey])[0];
    delete entry[sourceKey];
  });

  return entry;
}

export function normalizeCharaParamJson(charaJson: any) {
  const structs = asArray(charaJson?.struct?.list?.struct);
  if (!charaJson?.struct?.list || structs.length === 0) {
    throw new Error('Invalid ui_chara_db.prc: missing character structs');
  }

  if (typeof charaJson.struct.list['@hash'] === 'string') {
    charaJson.struct.list['@hash'] = normalizeHashLiteral(
      charaJson.struct.list['@hash'],
    );
  }

  structs.forEach((entry: any, index) => {
    normalizeParamXmlStruct(entry);
    entry['@index'] = String(entry['@index'] ?? index);
    ['hash40', 'int', 'sbyte', 'bool', 'byte', 'float'].forEach((key) => {
      entry[key] = asArray(entry[key]);
      entry[key].forEach((param: any) => {
        if (typeof param?.['@hash'] === 'string') {
          param['@hash'] = normalizeHashLiteral(param['@hash']);
        }
        if (
          key === 'hash40' &&
          typeof param?.['#text'] === 'string' &&
          param['#text'].trim().toLowerCase().startsWith('0x')
        ) {
          param['#text'] = normalizeHashLiteral(param['#text']);
        }
      });
    });

    ['string', 'short'].forEach((key) => {
      if (typeof entry?.[key]?.['@hash'] === 'string') {
        entry[key]['@hash'] = normalizeHashLiteral(entry[key]['@hash']);
      }
    });
  });

  charaJson.struct.list.struct = structs;
  charaJson.struct.list['@size'] = String(
    charaJson.struct.list['@size'] ?? structs.length,
  );
  return charaJson;
}

export function charaXmlToJson(xmlContent: string) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@',
    textNodeName: '#text',
    parseAttributeValue: false,
    parseTagValue: false,
    trimValues: false,
  });

  return normalizeCharaParamJson(parser.parse(xmlContent));
}

function findHashIndex(entries: any, hash: string) {
  if (!Array.isArray(entries)) {
    return -1;
  }

  const expectedHashes = new Set([
    normalizeHashForCompare(hash),
    normalizeHashForCompare(toHash40(hash)),
  ]);

  return entries.findIndex((entry) => {
    if (typeof entry?.['@hash'] !== 'string') {
      return false;
    }

    const entryHash = normalizeHashForCompare(entry['@hash']);
    const entryLabel = normalizeHashForCompare(normalizeHashLiteral(entryHash));
    return expectedHashes.has(entryHash) || expectedHashes.has(entryLabel);
  });
}

function looksLikeUiLayoutEntry(entry: any) {
  const firstHash = String(entry?.hash40?.[0]?.['@hash'] || '');
  const normalizedFirstHash = normalizeHashLiteral(firstHash);
  return (
    normalizedFirstHash === 'ui_layout_id' ||
    findHashIndex(entry?.hash40, 'ui_layout_id') >= 0 ||
    findHashIndex(entry?.byte, 'chara_color') >= 0
  );
}

function getCssManagerFieldIndex(entry: any, collection: string, hash: string) {
  if (looksLikeUiLayoutEntry(entry)) {
    const layoutIndex = CSS_MANAGER_LAYOUT_FIELD_INDEX[collection]?.[hash];
    if (typeof layoutIndex === 'number') {
      return layoutIndex;
    }
  }

  return CSS_MANAGER_FIELD_INDEX[collection]?.[hash] ?? -1;
}

export function getHashText(
  entry: any,
  collection: string,
  hash: string,
  fallback = '',
) {
  const index = findHashIndex(entry?.[collection], hash);
  if (index >= 0) {
    return String(entry[collection][index]?.['#text'] ?? fallback);
  }

  const cssManagerIndex = getCssManagerFieldIndex(entry, collection, hash);
  if (
    cssManagerIndex >= 0 &&
    Array.isArray(entry?.[collection]) &&
    entry[collection][cssManagerIndex]
  ) {
    return String(entry[collection][cssManagerIndex]?.['#text'] ?? fallback);
  }

  return fallback;
}

export function setHashText(
  entry: any,
  collection: string,
  hash: string,
  value: string | number | boolean,
) {
  let index = findHashIndex(entry?.[collection], hash);
  if (index < 0) {
    index = getCssManagerFieldIndex(entry, collection, hash);
  }
  if (index < 0) {
    throw new Error(
      `Missing ${collection} field "${hash}" for ${entry?.string?.['#text'] || 'character'}`,
    );
  }

  if (!Array.isArray(entry?.[collection]) || !entry[collection][index]) {
    throw new Error(
      `Missing ${collection}[${index}] field "${hash}" for ${entry?.string?.['#text'] || 'character'}`,
    );
  }

  entry[collection][index]['#text'] = String(value);
}

export function setHashTextIfPresent(
  entry: any,
  collection: string,
  hash: string,
  value: string | number | boolean,
) {
  let index = findHashIndex(entry?.[collection], hash);
  if (index < 0) {
    index = getCssManagerFieldIndex(entry, collection, hash);
  }
  if (
    index >= 0 &&
    Array.isArray(entry?.[collection]) &&
    entry[collection][index]
  ) {
    entry[collection][index]['#text'] = String(value);
  }
}

export function getCharacterCssSbyteOrder(order: number) {
  return Math.min(Math.max(order, 0), MAX_PARAM_XML_SBYTE);
}

export function ensureHashText(
  entry: any,
  collection: string,
  hash: string,
  value: string | number | boolean,
) {
  if (!Array.isArray(entry?.[collection])) {
    entry[collection] = [];
  }

  let index = findHashIndex(entry[collection], hash);
  if (index < 0) {
    index = getCssManagerFieldIndex(entry, collection, hash);
  }
  if (index >= 0) {
    if (entry[collection][index]) {
      entry[collection][index]['#text'] = String(value);
      return;
    }
  }

  entry[collection].push({
    '@hash': hash,
    '#text': String(value),
  });
}
