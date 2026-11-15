import { shell } from 'electron';
import * as fs from 'fs';
import { createErrorResponse, ErrorCodes } from './error-handler';

export async function moveToTrash(target: string, permanent = false) {
  if (permanent) {
    await fs.promises.rm(target, { recursive: true, force: true });
    return { success: true as const, permanent: true };
  }

  try {
    await shell.trashItem(target);
    return { success: true as const, permanent: false };
  } catch (trashError) {
    console.warn('[trash] Recycle bin unavailable:', trashError);
    return createErrorResponse(
      ErrorCodes.TRASH_UNAVAILABLE,
      'The Recycle Bin is not available for this drive',
    );
  }
}
