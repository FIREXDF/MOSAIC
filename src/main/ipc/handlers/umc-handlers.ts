import { IpcMain } from 'electron';
import store from '../../store';

import {
  BaseHandlerArg,
  GenericHandler,
  HandlerResponse,
} from '../../types/common';

const UMC_API_BASE_URL = 'https://ultimatemovesetcompatibility.onrender.com';
const UMC_REQUEST_TIMEOUT_MS = 20_000;
const UMC_MAX_SELECTION = 10;
const UMC_IMAGE_CACHE_TTL_MS = 5 * 60_000;
const umcImageCache = new Map<
  string,
  { expiresAt: number; image: Promise<string | null> }
>();
const umcImageRequestLanes = Array.from({ length: 3 }, () => Promise.resolve());
let umcNextImageRequestLane = 0;

class UmcHttpError extends Error {
  constructor(public readonly status: number) {
    super(`UMC API returned HTTP ${status}.`);
  }
}

interface UmcMovesetImageDto {
  slottedId?: string | null;
  movesetHeroImageUrl?: string | null;
  releaseState?: { releaseStateName?: string | null } | null;
}

export interface UmcMovesetDto {
  movesetId: number;
  moddedCharName: string;
  thumbhImageUrl?: string | null;
  vanillaCharDisplayName?: string | null;
  seriesName?: string | null;
  releaseState?: string | null;
  cardModders?: string[] | null;
  modders?: string[] | null;
}

export interface UmcCompatibilityDto {
  compatibleCount?: number;
  incompatibleCount?: number;
  severity?: 'compatible' | 'warning' | 'predicted-incompat' | 'incompatible';
  conflictingHookIds?: number[];
  conflictingArticleIds?: number[];
}

export interface UmcPairCompatibilityDto extends UmcCompatibilityDto {
  moveset1Id: number;
  moveset2Id: number;
}

export interface UmcGroupCompatibilityDto {
  pairs: UmcPairCompatibilityDto[];
  overallSeverity?: UmcCompatibilityDto['severity'];
}

interface UmcReportSummaryDto {
  movesetId: number;
  compatibleCount: number;
  incompatibleCount: number;
}

interface UmcPredictionDto {
  overallSeverity: NonNullable<UmcCompatibilityDto['severity']>;
  pairs: Array<{
    moveset1: { movesetId: number };
    moveset2: { movesetId: number };
    severity: NonNullable<UmcCompatibilityDto['severity']>;
    conflictingHookIds: number[];
    conflictingArticleIds: number[];
  }>;
}

function umcPairKey(one: number, two: number) {
  return one < two ? `${one}:${two}` : `${two}:${one}`;
}

function validateUmcPrediction(data: UmcPredictionDto, ids: number[]) {
  const severities = [
    'compatible',
    'warning',
    'predicted-incompat',
    'incompatible',
  ];
  const selectedIds = new Set(ids);
  const pairs = new Map<string, UmcPredictionDto['pairs'][number]>();
  if (
    !Array.isArray(data?.pairs) ||
    !severities.includes(data.overallSeverity)
  ) {
    throw new Error('UMC returned an unexpected compatibility prediction.');
  }
  for (const pair of data.pairs) {
    const one = pair?.moveset1?.movesetId;
    const two = pair?.moveset2?.movesetId;
    const key = umcPairKey(one, two);
    if (
      !selectedIds.has(one) ||
      !selectedIds.has(two) ||
      one === two ||
      pairs.has(key) ||
      !severities.includes(pair.severity) ||
      !Array.isArray(pair.conflictingHookIds) ||
      !Array.isArray(pair.conflictingArticleIds) ||
      ![...pair.conflictingHookIds, ...pair.conflictingArticleIds].every(
        Number.isSafeInteger,
      )
    ) {
      throw new Error('UMC returned an unexpected compatibility prediction.');
    }
    pairs.set(key, pair);
  }
  if (pairs.size !== (ids.length * (ids.length - 1)) / 2) {
    throw new Error('UMC returned an incomplete compatibility prediction.');
  }
  const overallSeverity = [
    data.overallSeverity,
    ...data.pairs.map((pair) => pair.severity),
  ].sort((a, b) => severities.indexOf(b) - severities.indexOf(a))[0];
  return { pairs, overallSeverity };
}

async function getUmcReportSummaries(ids: number[]) {
  const summaries = new Map<number, UmcReportSummaryDto[]>();
  // One summary covers all votes involving that moveset. Limit concurrent requests.
  for (let offset = 0; offset < ids.length - 1; offset += 3) {
    const batch = ids.slice(offset, Math.min(offset + 3, ids.length - 1));
    const results = await Promise.allSettled(
      batch.map(async (id) => {
        const data = await requestUmc<UmcReportSummaryDto[]>(
          `/api/compatibility/summary?${new URLSearchParams({ moveset: String(id) })}`,
        );
        if (
          !Array.isArray(data) ||
          data.some(
            (report) =>
              !Number.isSafeInteger(report?.movesetId) ||
              !Number.isSafeInteger(report?.compatibleCount) ||
              report.compatibleCount < 0 ||
              !Number.isSafeInteger(report?.incompatibleCount) ||
              report.incompatibleCount < 0,
          )
        ) {
          throw new Error('UMC returned unexpected compatibility reports.');
        }
        return data;
      }),
    );
    results.forEach((result, index) => {
      if (result.status === 'fulfilled')
        summaries.set(batch[index], result.value);
    });
  }
  return summaries;
}

async function requestUmc<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UMC_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${UMC_API_BASE_URL}${path}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new UmcHttpError(response.status);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

function getUmcCharacterImage(slottedId: string): Promise<string | null> {
  const cached = umcImageCache.get(slottedId);
  if (cached && cached.expiresAt > Date.now()) return cached.image;

  // Share lookups across CSS reloads and limit requests while hydrating duplicates.
  const lane = umcNextImageRequestLane++ % umcImageRequestLanes.length;
  const image = umcImageRequestLanes[lane].then(async () => {
    try {
      if (store.get('cssUmcImagesEnabled') === false) {
        umcImageCache.delete(slottedId);
        return null;
      }
      const moveset = await requestUmc<UmcMovesetImageDto>(
        `/api/movesets/${encodeURIComponent(slottedId)}`,
      );
      if (
        moveset?.slottedId?.trim().toLowerCase() !== slottedId ||
        moveset.releaseState?.releaseStateName !== 'Released' ||
        typeof moveset.movesetHeroImageUrl !== 'string'
      ) {
        return null;
      }
      const url = new URL(moveset.movesetHeroImageUrl);
      return url.protocol === 'https:' && !url.username && !url.password
        ? url.href
        : null;
    } catch (error) {
      if (error instanceof UmcHttpError && error.status === 404) return null;
      umcImageCache.delete(slottedId);
      throw error;
    }
  });
  umcImageRequestLanes[lane] = image.then(
    () => undefined,
    () => undefined,
  );
  if (umcImageCache.size >= 256) {
    umcImageCache.delete(umcImageCache.keys().next().value!);
  }
  umcImageCache.set(slottedId, {
    expiresAt: Date.now() + UMC_IMAGE_CACHE_TTL_MS,
    image,
  });
  return image;
}

const UmcHandlers = {
  ['get-umc-character-image']: async (
    _common: BaseHandlerArg,
    characterId: string,
  ): HandlerResponse<{ imageUrl: string | null }> => {
    if (store.get('cssUmcImagesEnabled') === false) {
      return { success: true, imageUrl: null };
    }
    const slottedId =
      typeof characterId === 'string'
        ? characterId
            .trim()
            .toLowerCase()
            .replace(/^ui_chara_/, '')
        : '';
    if (!/^[a-z][a-z0-9_-]{0,127}$/.test(slottedId)) {
      return { success: true, imageUrl: null };
    }
    try {
      return { success: true, imageUrl: await getUmcCharacterImage(slottedId) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },

  ['get-umc-movesets']: async (
    _common: BaseHandlerArg,
  ): HandlerResponse<{ movesets: UmcMovesetDto[] }> => {
    try {
      const movesets = await requestUmc<UmcMovesetDto[]>(
        '/api/movesets?page=1&pageSize=2147483647&includeHidden=false',
      );

      if (!Array.isArray(movesets)) {
        throw new Error('UMC API returned an unexpected moveset list.');
      }

      return { success: true, movesets };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[UMC] Failed to load movesets:', message);
      return { success: false, error: message };
    }
  },

  ['get-umc-compatibility']: async (
    _common: BaseHandlerArg,
    movesetIds: number[],
  ): HandlerResponse<{ compatibility: UmcGroupCompatibilityDto }> => {
    if (
      !Array.isArray(movesetIds) ||
      movesetIds.length < 2 ||
      movesetIds.length > UMC_MAX_SELECTION ||
      new Set(movesetIds).size !== movesetIds.length ||
      !movesetIds.every((id) => Number.isSafeInteger(id) && id > 0)
    ) {
      return {
        success: false,
        error: 'Choose between 2 and 10 different movesets.',
      };
    }

    try {
      const ids = [...movesetIds];
      const [prediction, reports] = await Promise.allSettled([
        requestUmc<UmcPredictionDto>(
          `/api/compatibility/predict?${new URLSearchParams({ movesets: ids.join(',') })}`,
        ).then((data) => validateUmcPrediction(data, ids)),
        getUmcReportSummaries(ids),
      ]);

      const summaries =
        reports.status === 'fulfilled'
          ? reports.value
          : new Map<number, UmcReportSummaryDto[]>();
      if (prediction.status === 'rejected' && summaries.size === 0) {
        throw prediction.reason;
      }
      const compatibility: UmcGroupCompatibilityDto = { pairs: [] };
      if (prediction.status === 'fulfilled') {
        compatibility.overallSeverity = prediction.value.overallSeverity;
      }
      for (let one = 0; one < ids.length; one++) {
        for (let two = one + 1; two < ids.length; two++) {
          const pair: UmcPairCompatibilityDto = {
            moveset1Id: ids[one],
            moveset2Id: ids[two],
          };
          const predicted =
            prediction.status === 'fulfilled'
              ? prediction.value.pairs.get(umcPairKey(ids[one], ids[two]))
              : undefined;
          if (predicted) {
            pair.severity = predicted.severity;
            pair.conflictingHookIds = predicted.conflictingHookIds;
            pair.conflictingArticleIds = predicted.conflictingArticleIds;
          }
          const summary = summaries.get(ids[one]) ?? summaries.get(ids[two]);
          if (summary) {
            const otherId = summaries.has(ids[one]) ? ids[two] : ids[one];
            const report = summary.find((item) => item.movesetId === otherId);
            pair.compatibleCount = report?.compatibleCount ?? 0;
            pair.incompatibleCount = report?.incompatibleCount ?? 0;
          }
          compatibility.pairs.push(pair);
        }
      }

      return { success: true, compatibility };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[UMC] Failed to check compatibility:', message);
      return { success: false, error: message };
    }
  },
} as const;

export type UmcHandlers = typeof UmcHandlers;

export function registerUmcHandlers(ipcMain: IpcMain) {
  for (const channel of Object.keys(UmcHandlers) as Array<
    keyof typeof UmcHandlers
  >) {
    const handler = UmcHandlers[channel] as GenericHandler;
    ipcMain.handle(channel, (event, ...rest: unknown[]) => {
      return handler({ event }, ...rest);
    });
  }
}
