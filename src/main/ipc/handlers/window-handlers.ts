import { BrowserWindow, IpcMain, Notification } from 'electron';
import { BaseHandlerArg, GenericHandler } from '../../types/common';

export type WindowHandlers = typeof WindowEventHandlers;

const WindowEventHandlers = {
  ['minimize-window']: (common: BaseHandlerArg) => {
    const win = BrowserWindow.fromWebContents(common.event.sender)!;
    if (win) win.minimize();
  },

  ['maximize-window']: (common: BaseHandlerArg) => {
    const win = BrowserWindow.fromWebContents(common.event.sender)!;

    if (win) {
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
    }
  },

  ['close-window']: (common: BaseHandlerArg) => {
    const win = BrowserWindow.fromWebContents(common.event.sender)!;
    if (win) win.close();
  },

  ['set-taskbar-progress']: (
    common: BaseHandlerArg,
    progress: number,
    mode: 'normal' | 'indeterminate' | 'paused' | 'none',
  ) => {
    const win = BrowserWindow.fromWebContents(common.event.sender);
    if (win) win.setProgressBar(progress, { mode });
  },

  ['notify-when-unfocused']: (
    common: BaseHandlerArg,
    title: string,
    body: string,
  ) => {
    const win = BrowserWindow.fromWebContents(common.event.sender);
    if (!win || win.isFocused() || !Notification.isSupported()) return;

    const notification = new Notification({ title, body });
    notification.on('click', () => {
      if (win.isDestroyed()) return;
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    });
    notification.show();
  },
} as const;

export function registerWindowHandlers(ipcMain: IpcMain) {
  for (const channel of Object.keys(WindowEventHandlers) as Array<
    keyof typeof WindowEventHandlers
  >) {
    const handler = WindowEventHandlers[channel] as GenericHandler;

    ipcMain.handle(channel, (event, ...rest: unknown[]) => {
      return handler({ event }, ...rest);
    });
  }
}
