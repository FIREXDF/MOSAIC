import { shell } from 'electron';

export function slotStringToNumber(slot: string): number {
  return parseInt(slot.substring(1));
}

export function slotNumberToString(slotNumber: number): string {
  return `c${slotNumber.toString().padStart(2, '0')}`;
}

export async function openPathDetached(targetPath: string) {
  const openPromise = shell.openPath(targetPath).then((errorMessage) => {
    if (errorMessage) {
      console.error('[openPath] Failed to open path:', {
        targetPath,
        errorMessage,
      });
    }
  });

  if (process.platform === 'linux') {
    openPromise.catch((error) => {
      console.error('[openPath] Failed to open path:', {
        targetPath,
        error: error?.message || error,
      });
    });
    return;
  }

  await openPromise;
}
