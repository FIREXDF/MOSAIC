import { IpcMain } from 'electron';
import DiscordRPCManager from '../../discord-rpc';
import { BaseHandlerArg, GenericHandler } from '../../types/common';

export type DiscordHandlers = typeof DiscordHandlers;

const DiscordHandlers = {
  ['discord-rpc-update']: async (
    common: BaseHandlerArg<{
      discordRPC: DiscordRPCManager | null;
    }>,
    data: { tab: string | null; modCount?: number },
  ) => {
    if (!common.discordRPC) {
      console.warn('Discord RPC manager not initialized');
      return;
    }

    const { tab, modCount } = data;

    switch (tab) {
      case 'tools':
        common.discordRPC.setModsTab(modCount || 0);
        break;

      case 'plugins':
        common.discordRPC.setPluginsTab();
        break;

      case 'characters':
        common.discordRPC.setCharactersTab();
        break;

      case 'downloads':
        common.discordRPC.setDownloadsTab();
        break;

      case 'settings':
        common.discordRPC.setSettingsTab();
        break;

      default:
        common.discordRPC.setIdleState();
        break;
    }
  },
} as const;

export function registerDiscordHandlers(
  ipcMain: IpcMain,
  getDiscordRPC: () => DiscordRPCManager | null,
) {
  for (const channel of Object.keys(DiscordHandlers) as Array<
    keyof typeof DiscordHandlers
  >) {
    const handler = DiscordHandlers[channel] as GenericHandler<{
      discordRPC: DiscordRPCManager | null;
    }>;

    ipcMain.handle(channel, (event, ...rest: unknown[]) => {
      return handler({ event, discordRPC: getDiscordRPC() }, ...rest);
    });
  }
}
