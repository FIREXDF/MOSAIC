import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import store from './store';

let tutorialWindow: BrowserWindow | null = null;

export function createTutorialWindow(parentWindow?: BrowserWindow | null) {
  if (tutorialWindow) {
    if (!tutorialWindow.isVisible()) {
      tutorialWindow.show();
    }
    tutorialWindow.focus();
    return tutorialWindow;
  }

  const width = 1300;
  const height = 800;

  // Keep a checkpoint even if the app exits before the first step renders.
  if (!store.get('tutorial.setupProgress')) {
    store.set('tutorial.setupProgress', { stepTitle: null });
  }

  tutorialWindow = new BrowserWindow({
    width: width,
    height: height,
    center: true,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    // Keep the tutorial reachable after switching to another application.
    // Once the intro ends it is no longer always-on-top, so hiding it from the
    // taskbar would leave first-time users with no reliable way to restore it.
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      additionalArguments: ['--window-type=tutorial'],
    },
  });

  const loadPath = path.join(
    app.getAppPath(),
    'assets',
    'pages',
    'tutorial.html',
  );

  tutorialWindow.loadFile(loadPath);

  tutorialWindow.setMenuBarVisibility(false);

  tutorialWindow.on('closed', () => {
    tutorialWindow = null;
    if (parentWindow && !parentWindow.isDestroyed()) {
      if (!store.get('tutorial.setupProgress')) {
        parentWindow.webContents.send('tutorial-window-closed');
      }
    }
  });

  return tutorialWindow;
}

export function completeTutorialWindow() {
  store.set('hasLaunchedBefore', true);
  store.set('tutorial.guideProgress', { stepTitle: "Let's guide you to MOSAIC" });
  store.delete('tutorial.setupProgress');
  closeTutorialWindow();
}

export function closeTutorialWindow() {
  if (tutorialWindow && !tutorialWindow.isDestroyed()) {
    try {
      tutorialWindow.destroy();
    } catch (error) {
      console.error('Error destroying tutorial window:', error);
    }
    tutorialWindow = null;
  }
}

export function getTutorialWindow() {
  return tutorialWindow;
}
