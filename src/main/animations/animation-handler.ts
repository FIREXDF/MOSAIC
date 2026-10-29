import { ipcMain, BrowserWindow } from 'electron';

export interface AnimationEvents {
  'start-intro-animation': {};
}

export default class AnimationHandler {
  mainWindow: BrowserWindow | null;

  constructor() {
    this.mainWindow = null;
  }

  initialize(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
    this.setupListeners();
  }

  setupListeners() {
    ipcMain.on('close-tutorial-window', () => {
      this.triggerIntroAnimation();
    });
  }

  triggerIntroAnimation() {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('start-intro-animation');
    }
  }
}
