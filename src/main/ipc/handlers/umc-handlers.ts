import { IpcMain } from 'electron';

import {
  BaseHandlerArg,
  GenericHandler,
  HandlerResponse,
} from '../../types/common';

const UMC_API_BASE_URL = 'https://ultimatemovesetcompatibility.onrender.com';
const UMC_REQUEST_TIMEOUT_MS = 20_000;

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

interface UmcPredictionDto {
  pairs: Array<{
    moveset1: { movesetId: number };
    moveset2: { movesetId: number };
    severity: NonNullable<UmcCompatibilityDto['severity']>;
    conflictingHookIds: number[];
    conflictingArticleIds: number[];
  }>;
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
      throw new Error(`UMC API returned HTTP ${response.status}.`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

const UmcHandlers = {
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
    moveset1: number,
    moveset2: number,
  ): HandlerResponse<{ compatibility: UmcCompatibilityDto }> => {
    if (
      !Number.isSafeInteger(moveset1) ||
      !Number.isSafeInteger(moveset2) ||
      moveset1 <= 0 ||
      moveset2 <= 0 ||
      moveset1 === moveset2
    ) {
      return { success: false, error: 'Choose two different movesets.' };
    }

    try {
      const query = new URLSearchParams({
        moveset1: String(moveset1),
        moveset2: String(moveset2),
      });
      // UMC votes and conflict predictions are independent sources.
      const [reports, prediction] = await Promise.allSettled([
        requestUmc<UmcCompatibilityDto>(
          `/api/compatibility?${query.toString()}`,
        ).then((data) => {
          if (
            !Number.isSafeInteger(data?.compatibleCount) ||
            !Number.isSafeInteger(data?.incompatibleCount) ||
            data.compatibleCount! < 0 ||
            data.incompatibleCount! < 0
          ) {
            throw new Error('UMC returned unexpected compatibility reports.');
          }
          return {
            compatibleCount: data.compatibleCount,
            incompatibleCount: data.incompatibleCount,
          };
        }),
        requestUmc<UmcPredictionDto>(
          `/api/compatibility/predict?${new URLSearchParams({ movesets: `${moveset1},${moveset2}` })}`,
        ).then((data) => {
          const pair = data?.pairs?.find(
            (item) =>
              (item.moveset1?.movesetId === moveset1 &&
                item.moveset2?.movesetId === moveset2) ||
              (item.moveset1?.movesetId === moveset2 &&
                item.moveset2?.movesetId === moveset1),
          );
          if (
            !pair ||
            ![
              'compatible',
              'warning',
              'predicted-incompat',
              'incompatible',
            ].includes(pair.severity) ||
            !Array.isArray(pair.conflictingHookIds) ||
            !Array.isArray(pair.conflictingArticleIds) ||
            ![...pair.conflictingHookIds, ...pair.conflictingArticleIds].every(
              Number.isSafeInteger,
            )
          ) {
            throw new Error(
              'UMC returned an unexpected compatibility prediction.',
            );
          }
          return {
            severity: pair.severity,
            conflictingHookIds: pair.conflictingHookIds,
            conflictingArticleIds: pair.conflictingArticleIds,
          };
        }),
      ]);

      if (reports.status === 'rejected' && prediction.status === 'rejected') {
        throw prediction.reason;
      }
      const compatibility: UmcCompatibilityDto = {
        ...(reports.status === 'fulfilled' ? reports.value : {}),
        ...(prediction.status === 'fulfilled' ? prediction.value : {}),
      };

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
