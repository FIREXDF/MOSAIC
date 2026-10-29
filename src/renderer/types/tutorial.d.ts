interface TutorialStep {
  icon: string;
  title: string;
  description: string;
  content: string;
  onRender?: () => unknown;
}

interface TutorialApiWrapper {
  storeGet(key: string): Promise<any>;
  detectSdDrives(): Promise<any>;
  getSkylineRelease(): Promise<any>;
  detectYuzuPath(): Promise<any>;
  detectRyujinxPath(): Promise<any>;
}

interface TutorialStepContext {
  apiWrapper: TutorialApiWrapper;
  warnIfEmulatorExe(
    statusDiv: HTMLElement,
    folderPath: string,
    dataFolder: 'sdmc' | 'sdcard',
  ): Promise<void>;
  getHardwareLibraryMode(): Promise<any>;
  runArcropolisInstallStep(options: {
    statusSelector: string;
    pathKey: string;
    missingPathMessage: string;
    dataFolder: string | null;
    extraDirs: string[][];
  }): Promise<void>;
  renderProgressDots(): Promise<void>;
  setupExternalLinks(container: HTMLElement, selector?: string): void;
  setupDiscordLinks(container: HTMLElement): void;
  renderStep(index: number): void;
  readonly steps: TutorialStep[];
  currentStep: number;
}
