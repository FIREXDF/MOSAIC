const ARCROPOLIS_CONTENTS_PATH = ['atmosphere', 'contents', '01006A800016E000'];

document.addEventListener('DOMContentLoaded', () => {
  let tutorialDevMode = false;
  const devOverrides: Record<string, any> = {};

  async function warnIfEmulatorExe(
    statusDiv: HTMLElement,
    folderPath: string,
    dataFolder: 'sdmc' | 'sdcard',
  ): Promise<void> {
    const result = await window.tutorialAPI.checkEmulatorExe(folderPath);
    if (!('hasExe' in result) || !result.hasExe) return;
    statusDiv.insertAdjacentHTML(
      'beforeend',
      `
                    <div class="tutorial-exe-warning">
                        <i class="bi bi-exclamation-triangle-fill tutorial-icon-warning"></i>
                        <span class="tutorial-exe-warning-text">
                            This folder contains the emulator's <strong class="tutorial-text-white">.exe</strong>, so it's probably not the right one.
                            Select the folder that contains <strong class="tutorial-text-white">${dataFolder}</strong>, usually located in <strong class="tutorial-text-white">AppData</strong> (e.g. <span class="tutorial-mono">%APPDATA%</span>).
                        </span>
                    </div>
                `,
    );
  }

  const apiWrapper = {
    async storeGet(key: string): Promise<any> {
      if (tutorialDevMode && key in devOverrides) return devOverrides[key];
      if (tutorialDevMode && devOverrides['dev.emulatorNotFound']) {
        if (key === 'tutorial.yuzuPath' || key === 'tutorial.ryujinxPath')
          return null;
      }
      return window.tutorialAPI.store.get(key);
    },
    async detectSdDrives(): Promise<any> {
      if (tutorialDevMode && devOverrides['dev.sdCardEmpty'])
        return { success: true, drives: [] };
      return window.tutorialAPI.detectSdDrives();
    },
    async getSkylineRelease(): Promise<any> {
      if (tutorialDevMode && devOverrides['dev.installFail']) {
        return {
          success: false,
          error: 'DEV: Simulated Skyline release fetch failure',
          code: 'DEV_INSTALL_FAILURE',
          details: { stage: 'fetch-skyline-release' },
        };
      }
      return window.tutorialAPI.getSkylineRelease();
    },
    async detectYuzuPath(): Promise<any> {
      if (tutorialDevMode && devOverrides['dev.emulatorNotFound'])
        return { success: false };
      return window.tutorialAPI.detectYuzuPath();
    },
    async detectRyujinxPath(): Promise<any> {
      if (tutorialDevMode && devOverrides['dev.emulatorNotFound'])
        return { success: false };
      return window.tutorialAPI.detectRyujinxPath();
    },
  };

  const getHardwareLibraryMode = async () => {
    if ((await apiWrapper.storeGet('switchTransferMethod')) === 'ftp') {
      return 'local';
    }
    return (
      (await apiWrapper.storeGet('tutorial.hardwareLibraryMode')) ||
      (await apiWrapper.storeGet('hardwareLibraryMode'))
    );
  };

  const chooseArcropolisRelease = async (container: HTMLElement) => {
    const savedVersion = await apiWrapper.storeGet('ssbuVersion');

    container.innerHTML = `
      <fieldset class="tutorial-release-list">
        <legend class="tutorial-release-legend">Which version of Super Smash Bros. Ultimate do you have?</legend>
        <label class="tutorial-release-recommended">
          <span class="tutorial-choice-heading">
            <input type="radio" name="ssbu-version" value="13.0.4" ${savedVersion === '13.0.4' ? 'checked' : ''}>
            SSBU 13.0.4
          </span>
          <span class="tutorial-choice-description">
            Installs ARCropolis 4.0.8. Marketplace will use SSBU 13.0.4 versions where available.
          </span>
        </label>
        <label class="tutorial-release-option">
          <span class="tutorial-choice-heading">
            <input type="radio" name="ssbu-version" value="13.0.5" ${savedVersion === '13.0.5' ? 'checked' : ''}>
            SSBU 13.0.5
          </span>
          <span class="tutorial-choice-description">
            Installs ARCropolis 4.1.1. Marketplace will use SSBU 13.0.5 versions where available.
          </span>
        </label>
        <button id="install-selected-arcropolis" type="button" class="tutorial-btn tutorial-btn-primary tutorial-release-continue" disabled>
          Continue and install
        </button>
      </fieldset>
    `;

    const installButton = container.querySelector<HTMLButtonElement>('#install-selected-arcropolis')!;
    installButton.disabled = !container.querySelector('input[name="ssbu-version"]:checked');
    container.querySelectorAll<HTMLInputElement>('input[name="ssbu-version"]').forEach((radio) => {
      radio.addEventListener('change', () => { installButton.disabled = false; });
    });

    return new Promise<any>((resolve, reject) => {
      installButton.addEventListener('click', async () => {
        const version = container.querySelector<HTMLInputElement>('input[name="ssbu-version"]:checked')?.value;
        if (version !== '13.0.4' && version !== '13.0.5') return;
        installButton.disabled = true;
        try {
          const release = await window.tutorialAPI.getGithubRelease(
            'Raytwo/ARCropolis', version === '13.0.4' ? 'v4.0.8' : 'v4.1.1',
          );
          if (!release.success) throw new Error(`Failed to get ARCropolis for SSBU ${version}`);
          const saved = await window.tutorialAPI.store.set('ssbuVersion', version);
          if (!saved?.success) throw new Error('Failed to save SSBU version');
          resolve(release);
        } catch (error) {
          reject(error);
        }
      });
    });
  };

  const joinTutorialPath = async (...parts: string[]) => {
    const result = await window.tutorialAPI.joinPath(...parts);
    if (!result.success) throw new Error('Failed to construct path');
    return result.path;
  };

  const renderInstallProgress = (
    statusDiv: HTMLElement,
    message: string,
    percent: number,
  ) => {
    statusDiv.innerHTML = `
                <div class="tutorial-box">
                    <div class="tutorial-progress-label">${message}</div>
                    <div class="tutorial-progress-track">
                        <div class="tutorial-progress-fill" style="width: ${percent}%;"></div>
                    </div>
                </div>
            `;
  };

  const downloadToTemp = async (url: string, fileName: string) => {
    const tempDirResult = await window.tutorialAPI.getTempDir();
    if (!tempDirResult.success) throw new Error('Failed to get temp directory');
    return window.tutorialAPI.downloadArcropolis(
      url,
      await joinTutorialPath(
        tempDirResult.path,
        `${fileName}-${Date.now()}.zip`,
      ),
    );
  };

  const installArcropolis = async (
    statusDiv: HTMLElement,
    dataRoot: string,
    extraDirs: string[][],
  ) => {
    renderInstallProgress(statusDiv, 'Fetching latest releases...', 10);
    const skylineRelease = await apiWrapper.getSkylineRelease();
    if (!skylineRelease.success)
      throw createTutorialIpcError(
        'Failed to get Skyline release',
        skylineRelease,
      );
    const arcropolisRelease = await chooseArcropolisRelease(statusDiv);

    renderInstallProgress(
      statusDiv,
      `Downloading Skyline ${skylineRelease.version} (exefs)...`,
      20,
    );
    const skyline = await downloadToTemp(skylineRelease.downloadUrl, 'skyline');
    if (!skyline.success) throw new Error('Skyline download failed');

    renderInstallProgress(
      statusDiv,
      `Downloading ARCropolis ${arcropolisRelease.version} (romfs)...`,
      40,
    );
    const arcropolis = await downloadToTemp(
      arcropolisRelease.downloadUrl,
      'arcropolis',
    );
    if (!arcropolis.success) throw new Error('ARCropolis download failed');

    renderInstallProgress(statusDiv, 'Installing Skyline (exefs)...', 60);
    const contentsDir = await joinTutorialPath(
      dataRoot,
      ...ARCROPOLIS_CONTENTS_PATH,
    );
    await window.tutorialAPI.createDirectory(contentsDir);
    const skylineExtract = await window.tutorialAPI.extractSkyline(
      skyline.path,
      contentsDir,
    );
    if (!skylineExtract.success) throw new Error('Skyline extraction failed');

    renderInstallProgress(statusDiv, 'Installing ARCropolis (romfs)...', 80);
    const arcropolisExtract = await window.tutorialAPI.extractArcropolis(
      arcropolis.path,
      contentsDir,
    );
    if (!arcropolisExtract.success)
      throw new Error('ARCropolis extraction failed');

    for (const dir of extraDirs) {
      await window.tutorialAPI.createDirectory(
        await joinTutorialPath(dataRoot, ...dir),
      );
    }

    statusDiv.innerHTML = `
                <div class="tutorial-box-success">
                    <div class="tutorial-row">
                        <i class="bi bi-check-circle-fill tutorial-icon-success"></i>
                        <div>
                            <strong class="tutorial-label">Installation complete!</strong>
                            <span class="tutorial-text-muted-sm">Skyline ${skylineRelease.version} (exefs) + ARCropolis ${arcropolisRelease.version} (romfs)</span>
                        </div>
                    </div>
                </div>
            `;
  };

  const runArcropolisInstallStep = async (options: {
    statusSelector: string;
    pathKey: string;
    missingPathMessage: string;
    dataFolder: string | null;
    extraDirs: string[][];
  }) => {
    const statusDiv = document.querySelector<HTMLElement>(
      options.statusSelector,
    );
    const nextBtn = document.querySelector<HTMLElement>('#next-btn');
    if (!statusDiv) return;

    if (nextBtn) {
      nextBtn.style.opacity = '0.5';
      nextBtn.style.pointerEvents = 'none';
    }

    try {
      const basePath = (await apiWrapper.storeGet(options.pathKey)) as
        | string
        | null;
      if (!basePath) {
        statusDiv.innerHTML = `<div class="tutorial-text-error">Error: ${options.missingPathMessage}</div>`;
        return;
      }

      const dataRoot = options.dataFolder
        ? await joinTutorialPath(basePath, options.dataFolder)
        : basePath;
      await installArcropolis(statusDiv, dataRoot, options.extraDirs);

      if (nextBtn) {
        nextBtn.style.opacity = '1';
        nextBtn.style.pointerEvents = 'auto';
      }
    } catch (error) {
      console.error('Installation error:', error);
      renderTutorialInstallationError(statusDiv, error);
    }
  };

  try {
    const restoredState = localStorage.getItem('tutorialDevState');
    if (restoredState) {
      const parsed = JSON.parse(restoredState);
      tutorialDevMode = true;
      Object.assign(devOverrides, parsed);
      localStorage.removeItem('tutorialDevState');
    }
  } catch (e) {
    console.error('Error restoring dev state:', e);
  }

  const stepContext: TutorialStepContext = {
    apiWrapper,
    warnIfEmulatorExe,
    getHardwareLibraryMode,
    runArcropolisInstallStep,
    renderProgressDots,
    setupExternalLinks,
    setupDiscordLinks,
    renderStep,
    get steps() {
      return steps;
    },
    get currentStep() {
      return currentStep;
    },
    set currentStep(value) {
      currentStep = value;
    },
  };

  let steps: TutorialStep[] = [
    ...createTutorialIntroSteps(stepContext),
    ...createTutorialSwitchSteps(stepContext),
    ...createTutorialEmulatorSteps(stepContext),
    ...createTutorialFinishSteps(stepContext),
  ];

  let currentStep = 0;
  let resumedStep: number | null = null;
  let resumeMessage = "Let's pick up where we left off.";
  let renderTimeout: ReturnType<typeof setTimeout> | null = null;

  async function isStepRelevant(index: number): Promise<boolean> {
    const step = steps[index];
    if (!step || !window.tutorialAPI) return true;

    const title = step.title;

    const hardwareType = await apiWrapper.storeGet('tutorial.hardwareType');
    const switchModded = await apiWrapper.storeGet('tutorial.switchModded');
    const arcropolisInstalled = await apiWrapper.storeGet(
      'tutorial.arcropolisInstalled',
    );
    const emulatorType = await apiWrapper.storeGet('tutorial.emulatorType');
    const hardwareLibraryMode = await getHardwareLibraryMode();

    if (title === 'Switch Modded Check') {
      return hardwareType === 'hardware';
    }

    if (title === 'ARCropolis Status') {
      return (
        hardwareType === 'emulator' ||
        (hardwareType === 'hardware' && switchModded === true)
      );
    }

    if (title === 'Real Hardware Library') {
      return (
        hardwareType === 'hardware' &&
        switchModded === true &&
        typeof arcropolisInstalled === 'boolean'
      );
    }

    const switchOnlyTitles = [
      'Switch SD Card Setup',
      'Installing Skyline & ARCropolis (Switch)',
      'Verify ARCropolis (Switch)',
    ];
    if (switchOnlyTitles.includes(title)) {
      return (
        hardwareType === 'hardware' &&
        switchModded === true &&
        arcropolisInstalled === false
      );
    }

    if (title === 'Configure Your Paths') {
      return !(hardwareType === 'hardware' && hardwareLibraryMode === 'direct');
    }

    if (title === 'Emulator Selection') {
      return hardwareType === 'emulator' && arcropolisInstalled === false;
    }

    const yuzuOnlyTitles = [
      'Yuzu Setup',
      'Installing Skyline & ARCropolis (Yuzu)',
      'Verify ARCropolis (Yuzu)',
    ];
    if (yuzuOnlyTitles.includes(title)) {
      return (
        hardwareType === 'emulator' &&
        emulatorType === 'yuzu' &&
        arcropolisInstalled === false
      );
    }

    const ryujinxOnlyTitles = [
      'Ryujinx Setup',
      'Installing Skyline & ARCropolis (Ryujinx)',
      'Verify ARCropolis (Ryujinx)',
    ];
    if (ryujinxOnlyTitles.includes(title)) {
      return (
        hardwareType === 'emulator' &&
        emulatorType === 'ryujinx' &&
        arcropolisInstalled === false
      );
    }

    return true;
  }

  async function getNextRelevantStep(currentIndex: number): Promise<number> {
    for (let i = currentIndex + 1; i < steps.length; i++) {
      if (await isStepRelevant(i)) {
        return i;
      }
    }
    return steps.length;
  }

  async function getPreviousRelevantStep(
    currentIndex: number,
  ): Promise<number> {
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (await isStepRelevant(i)) {
        return i;
      }
    }
    return 0;
  }

  async function initializeTutorial() {
    await initializeWelcomeBranding();

    if (window.tutorialAPI && window.tutorialAPI.getMigrationStatus) {
      try {
        const migrationStatus = await window.tutorialAPI.getMigrationStatus();

        const migratedSettingKeys =
          migrationStatus.success && Array.isArray(migrationStatus.settingKeys)
            ? migrationStatus.settingKeys
            : [];
        const migrationFrom = migrationStatus.success
          ? migrationStatus.from
          : null;
        const hasFightPlanner3Migration =
          migrationStatus.success &&
          migrationStatus.completed &&
          migrationFrom === 'FightPlanner 3' &&
          migratedSettingKeys.length > 0;

        if (hasFightPlanner3Migration) {
          const migrationStep = {
            icon: 'bi-arrow-repeat',
            title: 'Settings Migrated',
            description: 'Your FightPlanner 3 settings have been imported',
            content: `
<div class="tutorial-center">
    <div class="tutorial-welcome-back-icon">
        <i class="bi bi-database-check tutorial-welcome-back-glyph"></i>
    </div>

    <h3 class="tutorial-welcome-back-title">Welcome Back!</h3>
    <p class="tutorial-lead-md">We found your <strong class="tutorial-text-white">FightPlanner 3</strong> settings and imported them automatically.</p>
    
    <div class="tutorial-welcome-back-card">
        <div class="tutorial-stack">
            <div class="tutorial-row">
                <i class="bi bi-check-circle-fill tutorial-text-success"></i>
                <span class="tutorial-text-light">Mods folder path</span>
            </div>
            <div class="tutorial-row">
                <i class="bi bi-check-circle-fill tutorial-text-success"></i>
                <span class="tutorial-text-light">Plugins folder path</span>
            </div>
            <div class="tutorial-row">
                <i class="bi bi-check-circle-fill tutorial-text-success"></i>
                <span class="tutorial-text-light">Emulator preferences</span>
            </div>
        </div>
    </div>
    
    <p class="tutorial-gb-footnote">
        You can double-check these in Settings anytime.
    </p>
</div>
`,
          };

          steps.splice(1, 0, migrationStep);
        }
      } catch (error) {
        console.error('Error checking migration status:', error);
      }
    }

    let resumeSavedStep = false;
    if (!tutorialDevMode && window.tutorialAPI) {
      try {
        const progress = await apiWrapper.storeGet('tutorial.setupProgress');
        const savedIndex = steps.findIndex(
          (step) => step.title === progress?.stepTitle,
        );
        if (savedIndex >= 0) {
          currentStep = (await isStepRelevant(savedIndex))
            ? savedIndex
            : await getPreviousRelevantStep(savedIndex);
          resumeSavedStep = true;
          resumedStep = currentStep;
        }
      } catch (error) {
        console.error('Could not restore tutorial progress:', error);
      }
    }

    if (tutorialDevMode || resumeSavedStep) {
      if (tutorialDevMode) createDevPanel();
      // Resume directly at the checkpoint without replaying the intro.
      document.querySelector<HTMLElement>(
        '#intro-tutorial-frame',
      )!.style.display = 'none';
      document.querySelector<HTMLElement>('#welcome-text')!.style.display =
        'none';
      document.querySelector<HTMLElement>(
        '#screenshot-preview',
      )!.style.display = 'none';
      const tc = document.querySelector<HTMLElement>('#tutorial-container');
      tc!.style.display = 'flex';
      tc!.classList.add('show');
      document
        .querySelector<HTMLElement>('.tutorial-window')!
        .classList.add('white-bg');
      await window.tutorialAPI?.tutorialIntroComplete?.();
      renderProgressDots().then(() => renderStep(currentStep));
    } else {
      startAnimation();
    }
  }

  async function initializeWelcomeBranding() {
    if (!window.tutorialAPI?.getAppVersion) {
      return;
    }

    try {
      const versionInfo = await window.tutorialAPI.getAppVersion();
      const savedLocale = localStorage.getItem('fightplanner_locale');
      const rawAppName =
        typeof versionInfo?.name === 'string' ? versionInfo.name.trim() : '';
      const appName = /^fightplanner$/i.test(rawAppName)
        ? 'MOSAIC'
        : /^mosaic$/i.test(rawAppName)
          ? 'MOSAIC'
          : rawAppName || 'MOSAIC';
      const locale =
        typeof savedLocale === 'string' && ['en', 'fr'].includes(savedLocale)
          ? savedLocale
          : 'en';
      const result = await window.tutorialAPI.loadLocale(locale);
      const translations = result?.success
        ? (result.translations as Record<string, any>)
        : null;
      if (typeof translations?.tutorial?.resumeMessage === 'string') {
        resumeMessage = translations.tutorial.resumeMessage;
      }
      const welcomeTitle = translations?.tutorial?.welcomeTitle;
      if (typeof welcomeTitle === 'string') {
        const localizedAppName = welcomeTitle.match(/MOSAIC|FightPlanner/i)?.[0];
        const title = localizedAppName
          ? welcomeTitle.replace(localizedAppName, appName)
          : appName;
        const titleElement = document.querySelector<HTMLElement>(
          '#welcome-text h1',
        );
        if (titleElement) {
          titleElement.textContent = title;
        }
      }

      const welcomeSubtitle = translations?.tutorial?.welcomeSubtitle;
      if (typeof welcomeSubtitle === 'string') {
        const subtitleElement = document.querySelector<HTMLElement>(
          '#welcome-text p',
        );
        if (subtitleElement) {
          subtitleElement.textContent = welcomeSubtitle;
        }
      }
    } catch (error) {
      console.warn('[Tutorial] Could not load welcome branding:', error);
    }
  }

  function startAnimation() {
    const introFrame = document.querySelector<HTMLElement>(
      '#intro-tutorial-frame',
    );
    const introVideo = document.querySelector<HTMLVideoElement>(
      '#intro-tutorial-video',
    );
    const welcomeText = document.querySelector<HTMLElement>('#welcome-text');
    const screenshotPreview = document.querySelector<HTMLElement>(
      '#screenshot-preview',
    );

    const startupAudio = new Audio('../../assets/sounds/StartUp_OnGIF.mp3');
    startupAudio.volume = 0.5;
    startupAudio
      .play()
      .catch((e) => console.warn('Tutorial startup audio prevented:', e));
    const tutorialContainer = document.querySelector<HTMLElement>(
      '#tutorial-container',
    );
    const tutorialWindow =
      document.querySelector<HTMLElement>('.tutorial-window');

    let timelineStarted = false;
    const startTimeline = (introPlayed: boolean) => {
      if (timelineStarted) {
        return;
      }
      timelineStarted = true;
      const welcomeDelay = introPlayed ? 3500 : 0;

      const hideIntro = () => {
        if (!introFrame) {
          return;
        }

        introFrame.style.opacity = '0';
        setTimeout(() => {
          introFrame.style.display = 'none';
          introVideo?.pause();
        }, 500);
      };

      setTimeout(
        () => tutorialWindow?.classList.add('white-bg'),
        Math.max(0, welcomeDelay - 1000),
      );
      setTimeout(hideIntro, Math.max(0, welcomeDelay - 300));
      setTimeout(() => welcomeText?.classList.add('show'), welcomeDelay);
      setTimeout(() => {
        screenshotPreview?.classList.add('show');
      }, welcomeDelay + 1000);

      setTimeout(() => {
        welcomeText?.classList.add('move-up');
        screenshotPreview?.classList.add('slide-up');
        screenshotPreview?.classList.add('clear');
      }, welcomeDelay + 1500);

      setTimeout(() => {
        welcomeText?.style.setProperty('opacity', '0');
        screenshotPreview?.style.setProperty('opacity', '0');
      }, welcomeDelay + 4500);

      setTimeout(async () => {
        welcomeText?.style.setProperty('display', 'none');
        screenshotPreview?.style.setProperty('display', 'none');
        introFrame?.style.setProperty('display', 'none');
        tutorialContainer!.style.display = 'flex';
        await window.tutorialAPI?.tutorialIntroComplete?.();

        await renderProgressDots();
        renderStep(0);

        setTimeout(() => {
          tutorialContainer!.classList.add('show');
        }, 50);
      }, welcomeDelay + 5500);
    };

    if (!introVideo || !introFrame) {
      startTimeline(false);
      return;
    }

    introVideo.addEventListener(
      'playing',
      () => startTimeline(true),
      { once: true },
    );
    introVideo.addEventListener(
      'error',
      () => startTimeline(false),
      { once: true },
    );
    introVideo.play().then(
      () => startTimeline(true),
      (error) => {
        console.warn('[Tutorial] Could not play intro video:', error);
        startTimeline(false);
      },
    );
  }

  let previousVisibleSteps: number[] = [];
  let progressDotsRenderId = 0;

  async function getVisibleTutorialSteps(): Promise<number[]> {
    let visibleSteps: number[] = [];

    const addStepByTitle = (title: string) => {
      const stepIndex = steps.findIndex((s) => s.title === title);
      if (stepIndex !== -1 && !visibleSteps.includes(stepIndex)) {
        visibleSteps.push(stepIndex);
      }
    };

    visibleSteps.push(0);

    addStepByTitle('Hardware Type');

    if (window.tutorialAPI) {
      try {
        const hardwareType = await apiWrapper.storeGet('tutorial.hardwareType');
        const arcropolisInstalled = await apiWrapper.storeGet(
          'tutorial.arcropolisInstalled',
        );
        const switchModded = await apiWrapper.storeGet('tutorial.switchModded');
        const hardwareLibraryMode = await getHardwareLibraryMode();

        let canShowConfigurePaths = false;

        if (hardwareType === 'hardware') {
          addStepByTitle('Switch Modded Check');
        }

        if (
          hardwareType === 'emulator' ||
          (hardwareType === 'hardware' && switchModded === true)
        ) {
          addStepByTitle('ARCropolis Status');
        }

        if (hardwareType && arcropolisInstalled === false) {
          if (hardwareType === 'hardware' && switchModded === true) {
            addStepByTitle('Switch SD Card Setup');
            addStepByTitle('Installing Skyline & ARCropolis (Switch)');
            addStepByTitle('Verify ARCropolis (Switch)');
            addStepByTitle('Real Hardware Library');
            canShowConfigurePaths = true;
          } else if (hardwareType === 'emulator') {
            addStepByTitle('Emulator Selection');

            const emulatorTypeResponse = await apiWrapper.storeGet(
              'tutorial.emulatorType',
            );

            if (emulatorTypeResponse === 'yuzu') {
              addStepByTitle('Yuzu Setup');
              addStepByTitle('Installing Skyline & ARCropolis (Yuzu)');
              addStepByTitle('Verify ARCropolis (Yuzu)');
              canShowConfigurePaths = true;
            } else if (emulatorTypeResponse === 'ryujinx') {
              addStepByTitle('Ryujinx Setup');
              addStepByTitle('Installing Skyline & ARCropolis (Ryujinx)');
              addStepByTitle('Verify ARCropolis (Ryujinx)');
              canShowConfigurePaths = true;
            }
          }
        } else if (arcropolisInstalled === true) {
          canShowConfigurePaths =
            hardwareType === 'emulator' ||
            (hardwareType === 'hardware' && switchModded === true);
          if (hardwareType === 'hardware' && switchModded === true) {
            addStepByTitle('Real Hardware Library');
          }
        }

        // Show Configure Paths and remaining steps only after required setup questions are complete.
        const configurePathsIndex = steps.findIndex(
          (s) => s.title === 'Configure Your Paths',
        );
        if (configurePathsIndex !== -1 && canShowConfigurePaths) {
          const skipConfigurePaths =
            hardwareType === 'hardware' && hardwareLibraryMode === 'direct';
          if (
            !skipConfigurePaths &&
            !visibleSteps.includes(configurePathsIndex)
          ) {
            visibleSteps.push(configurePathsIndex);
          }
          for (let i = configurePathsIndex + 1; i < steps.length; i++) {
            if (!visibleSteps.includes(i)) {
              visibleSteps.push(i);
            }
          }
        }
      } catch (e) {
        console.error('Error calculating visible steps:', e);
        visibleSteps = [0];
        addStepByTitle('Hardware Type');
      }
    } else {
      visibleSteps = [0];
      addStepByTitle('Hardware Type');
    }

    return visibleSteps;
  }

  async function renderProgressDots() {
    const renderId = ++progressDotsRenderId;
    const container = document.querySelector<HTMLElement>('#progress-dots');
    if (!container) return;

    const visibleSteps = await getVisibleTutorialSteps();
    if (renderId !== progressDotsRenderId) return;

    const currentActiveDisplayIndex = visibleSteps.indexOf(currentStep);
    const nextStepSet = new Set(visibleSteps);
    const existingDots = new Map<number, HTMLElement>();

    container
      .querySelectorAll<HTMLElement>('.tutorial-progress-dot')
      .forEach((dot) => {
        const stepIndex = Number(dot.dataset.step);
        if (!Number.isNaN(stepIndex)) {
          existingDots.set(stepIndex, dot);
        }
      });

    existingDots.forEach((dot, stepIndex) => {
      if (!nextStepSet.has(stepIndex)) {
        dot.classList.add('dot-exit');
        window.setTimeout(() => {
          if (dot.parentElement === container) {
            dot.remove();
          }
        }, 300);
      }
    });

    visibleSteps.forEach((stepIndex, displayIndex) => {
      let dot = existingDots.get(stepIndex);
      const isNew = !dot || dot.classList.contains('dot-exit');

      if (!dot || isNew) {
        dot = document.createElement('button');
        dot.setAttribute('type', 'button');
        dot.className = 'tutorial-progress-dot dot-enter';
        dot.dataset.step = String(stepIndex);
        dot.setAttribute(
          'aria-label',
          `Go to tutorial step ${displayIndex + 1}`,
        );
        dot.addEventListener('click', async () => {
          const step = Number(dot!.dataset.step);
          if (!Number.isNaN(step) && step >= 0 && step < steps.length) {
            await goToStep(step);
          }
        });
      }

      dot.dataset.displayIndex = String(displayIndex);
      dot.setAttribute(
        'aria-current',
        stepIndex === currentStep ? 'step' : 'false',
      );
      dot.classList.toggle('active', stepIndex === currentStep);
      dot.classList.toggle(
        'completed',
        currentActiveDisplayIndex > displayIndex,
      );

      const currentNodeAtPosition = container.children[displayIndex];
      if (currentNodeAtPosition !== dot) {
        container.insertBefore(dot, currentNodeAtPosition || null);
      }

      if (isNew) {
        void dot.offsetWidth;
        dot.classList.remove('dot-enter');
      }
    });

    previousVisibleSteps = [...visibleSteps];
  }

  function updateRenderedProgressState(index: number) {
    const visibleSteps =
      previousVisibleSteps.length > 0
        ? previousVisibleSteps
        : Array.from(
            document.querySelectorAll<HTMLElement>('.tutorial-progress-dot'),
          ).map((dot) => Number(dot.dataset.step));
    const activeDisplayIndex = visibleSteps.indexOf(index);

    document
      .querySelectorAll<HTMLElement>('.tutorial-progress-dot')
      .forEach((dot) => {
        const dotStepIndex = Number(dot.dataset.step);
        const displayIndex = visibleSteps.indexOf(dotStepIndex);
        dot.classList.toggle('active', dotStepIndex === index);
        dot.classList.toggle(
          'completed',
          activeDisplayIndex !== -1 && displayIndex < activeDisplayIndex,
        );
        dot.setAttribute(
          'aria-current',
          dotStepIndex === index ? 'step' : 'false',
        );
      });
  }

  function setupExternalLinks(
    container: HTMLElement,
    selector = 'a[target="_blank"]',
  ) {
    const externalLinks =
      container.querySelectorAll<HTMLAnchorElement>(selector);

    externalLinks.forEach((link) => {
      const newLink = link.cloneNode(true) as HTMLElement;
      link.parentNode!.replaceChild(newLink, link);

      newLink.addEventListener('click', async (e) => {
        e.preventDefault();
        const url = newLink.getAttribute('href')!;

        if (window.tutorialAPI && window.tutorialAPI.openUrl) {
          try {
            await window.tutorialAPI.openUrl(url);
          } catch (error) {
            console.error('Failed to open external link:', error);
          }
        }
      });
    });
  }

  function setupDiscordLinks(container: HTMLElement) {
    setupExternalLinks(container, 'a[href*="discord.gg"]');
  }

  function createTutorialIpcError(action: string, result: any) {
    const error = new Error(`${action}: ${result?.error || 'Unknown error'}`) as Error & {
      code?: string;
      details?: unknown;
    };
    error.code = result?.code;
    error.details = result?.details;
    return error;
  }

  function renderTutorialInstallationError(container: HTMLElement, error: unknown) {
    const installationError = error instanceof Error ? error : new Error(String(error));
    const ipcError = installationError as Error & { code?: string; details?: unknown };
    const details = [
      `Message: ${installationError.message}`,
      ipcError.code ? `Code: ${ipcError.code}` : '',
      ipcError.details ? `Details: ${JSON.stringify(ipcError.details, null, 2)}` : '',
      installationError.stack ? `Stack:\n${installationError.stack}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    container.innerHTML = `
      <div class="tutorial-box-error">
        <div class="tutorial-error-title"><strong>Installation failed.</strong> ${escapeHtml(installationError.message)}</div>
        <div class="tutorial-error-actions">
          <button type="button" data-tutorial-error-details class="tutorial-error-details-btn">View error details</button>
          <button type="button" data-tutorial-install-retry class="tutorial-error-retry-btn"><i class="bi bi-arrow-clockwise"></i> Retry installation</button>
        </div>
        <pre data-tutorial-error-output hidden class="tutorial-error-details">${escapeHtml(details)}</pre>
        <p class="tutorial-error-hint">If it continues, share the details with the <a href="https://discord.gg/2zT5Rg46bG" target="_blank">MOSAIC Discord</a>.</p>
      </div>
    `;

    const detailsButton = container.querySelector<HTMLButtonElement>('[data-tutorial-error-details]');
    const detailsOutput = container.querySelector<HTMLElement>('[data-tutorial-error-output]');
    detailsButton?.addEventListener('click', () => {
      const isHidden = detailsOutput?.hidden ?? true;
      if (detailsOutput) detailsOutput.hidden = !isHidden;
      detailsButton.textContent = isHidden ? 'Hide error details' : 'View error details';
    });

    const retryButton = container.querySelector<HTMLButtonElement>('[data-tutorial-install-retry]');
    retryButton?.addEventListener('click', () => {
      retryButton.disabled = true;
      retryButton.textContent = 'Retrying…';
      renderStep(currentStep);
    });
    setupDiscordLinks(container);
  }

  function renderStep(index) {
    const step = steps[index];
    if (!step) return;
    if (index !== resumedStep) resumedStep = null;
    const showResumeMessage = index === resumedStep;
    currentStep = index;
    if (!tutorialDevMode && window.tutorialAPI) {
      // Titles already identify branches; unlike indexes, they survive migration steps.
      void window.tutorialAPI.store
        .set('tutorial.setupProgress', { stepTitle: step.title })
        .then((result) => {
          if (!result.success) {
            console.error('Could not save tutorial progress:', result);
          }
        })
        .catch((error) => console.error('Could not save tutorial progress:', error));
    }
    const contentDiv = document.querySelector<HTMLElement>('#tutorial-content');
    const prevBtn = document.querySelector<HTMLElement>('#prev-btn');
    const nextBtn = document.querySelector<HTMLElement>('#next-btn');
    const container = document.querySelector<HTMLElement>(
      '.tutorial-container',
    );

    if (nextBtn) {
      nextBtn.style.opacity = '1';
      nextBtn.style.pointerEvents = 'auto';
      nextBtn.style.cursor = 'pointer';
      nextBtn.removeAttribute('disabled');
      nextBtn.setAttribute('aria-disabled', 'false');
    }

    if (renderTimeout) {
      clearTimeout(renderTimeout);
      renderTimeout = null;
    }

    const startHeight = container ? container.offsetHeight : 0;

    contentDiv!.scrollTop = 0;
    contentDiv!.style.opacity = '0';
    contentDiv!.style.transform = 'translateY(10px) scale(0.98)';
    contentDiv!.style.filter = 'blur(4px)';

    renderTimeout = setTimeout(() => {
      renderTimeout = null;
      contentDiv!.innerHTML = `
<div class="tutorial-step">
${showResumeMessage ? `<p class="tutorial-resume-message" role="status">${escapeHtml(resumeMessage)}</p>` : ''}
<div class="tutorial-step-header">
<div class="tutorial-step-icon">
<i class="bi ${step.icon}"></i>
</div>
<div class="tutorial-step-title">
<h2>${step.title}</h2>
<p>${step.description}</p>
</div>
</div>
<div class="tutorial-step-content">
${step.content}
</div>
</div>
`;

      if (container && startHeight > 0) {
        contentDiv!.style.flex = '0 0 auto';
        const savedMaxHeight = container.style.maxHeight;
        container.style.maxHeight = 'none';
        container.style.height = 'auto';
        container.offsetHeight;

        let endHeight = container.offsetHeight;
        const maxAllowed = window.innerHeight * 0.85;
        if (endHeight > maxAllowed) endHeight = maxAllowed;

        contentDiv!.style.flex = '';
        container.style.maxHeight = savedMaxHeight;

        container.style.transition = 'none';
        container.style.height = startHeight + 'px';
        container.offsetHeight;

        container.style.transition = 'height 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
        container.style.height = endHeight + 'px';

        setTimeout(() => {
          container.style.height = '';
          container.style.transition = '';
        }, 450);
      }

      requestAnimationFrame(() => {
        contentDiv!.style.opacity = '1';
        contentDiv!.style.transform = 'translateY(0) scale(1)';
        contentDiv!.style.filter = 'blur(0px)';
      });

      setupExternalLinks(contentDiv!);

      if (step.onRender) {
        step.onRender();
      }
    }, 350);

    updateRenderedProgressState(index);

    prevBtn!.style.display = index > 0 ? 'flex' : 'none';

    if (index === steps.length - 1) {
      nextBtn!.innerHTML = 'Get Started! <i class="bi bi-check-lg"></i>';
    } else {
      nextBtn!.innerHTML = 'Next <i class="bi bi-arrow-right"></i>';
    }
  }

  async function goToStep(index) {
    if (index >= 0 && index < steps.length) {
      currentStep = index;
      await renderProgressDots();

      if (currentStep >= 0 && currentStep < steps.length) {
        renderStep(currentStep);
      } else {
        console.warn(
          `Step ${index} is not accessible, staying on current step`,
        );
      }
    }
  }

  async function nextStep() {
    const next = await getNextRelevantStep(currentStep);
    if (next < steps.length) {
      currentStep = next;
      await renderProgressDots();
      renderStep(currentStep);
    } else {
      await closeTutorial('complete');
    }
  }

  async function previousStep() {
    if (currentStep > 0) {
      const prev = await getPreviousRelevantStep(currentStep);
      currentStep = prev;
      await renderProgressDots();
      renderStep(currentStep);
    }
  }

  async function closeTutorial(action: 'close' | 'complete' | 'skip' = 'close') {
    if (window.tutorialAPI) {
      try {
        if (action === 'complete') {
          await window.tutorialAPI.completeTutorial();
        } else if (action === 'skip') {
          await window.tutorialAPI.skipTutorial();
        } else {
          await window.tutorialAPI.closeTutorial();
        }
      } catch (error) {
        console.error('Error calling closeTutorial:', error);
      }
    } else {
      console.error('tutorialAPI not available!');
      console.error('Available window properties:', Object.keys(window));

      if (window.close) {
        window.close();
      }
    }
  }

  function skipTutorial() {
    if (confirm('Are you sure you want to skip the tutorial?')) {
      void closeTutorial('skip');
    }
  }

  setTimeout(() => {
    initializeTutorial();
  }, 100);

  const closeBtn = document.querySelector<HTMLElement>('#close-btn');
  const skipBtn = document.querySelector<HTMLElement>('#skip-btn');
  const prevBtn = document.querySelector<HTMLElement>('#prev-btn');
  const nextBtn = document.querySelector<HTMLElement>('#next-btn');

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      closeTutorial();
    });
  }

  if (skipBtn) {
    skipBtn.addEventListener('click', () => {
      skipTutorial();
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      previousStep();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      nextStep();
    });
  }

  function applyDevOverrides() {
    renderProgressDots().then(() => renderStep(currentStep));
  }

  function createDevPanel() {
    const p = document.createElement('div');
    p.id = 'dev-mode-panel';
    p.style.cssText =
      'position:fixed;top:10px;right:10px;width:220px;background:#1a1a1e;border:1px solid #ff3c3c44;border-radius:8px;z-index:99999;font-family:monospace;font-size:11px;color:#ccc;box-shadow:0 4px 20px rgba(0,0,0,0.6);user-select:none;';
    const ss =
      'background:#2a2a2e;border:1px solid #444;color:#fff;padding:2px 4px;border-radius:4px;font-size:10px;font-family:monospace;';
    const r = (l: string, i: string) =>
      `<div style="display:flex;align-items:center;justify-content:space-between;padding:3px 0;"><span style="color:#aaa;">${l}</span>${i}</div>`;
    p.innerHTML = `
      <div id="dev-hdr" style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:#ff3c3c22;border-bottom:1px solid #ff3c3c33;cursor:move;">
        <span style="background:#ff3c3c;color:#fff;padding:1px 5px;border-radius:3px;font-size:9px;font-weight:bold;">DEV</span>
        <span style="flex:1;font-weight:bold;">Tutorial Debug</span>
        <span id="dev-x" style="cursor:pointer;color:#666;font-size:16px;">&times;</span>
      </div>
      <div style="padding:6px 10px 10px;">
        ${r('Hardware', `<select id="dv-hw" style="${ss}"><option value="">-</option><option value="hardware">Switch</option><option value="emulator">Emulator</option></select>`)}
        ${r('Emulator', `<select id="dv-emu" style="${ss}"><option value="">-</option><option value="yuzu">Yuzu</option><option value="ryujinx">Ryujinx</option></select>`)}
        ${r('ARCropolis', `<select id="dv-arc" style="${ss}"><option value="">-</option><option value="true">Yes</option><option value="false">No</option></select>`)}
        <div style="height:1px;background:#333;margin:4px 0;"></div>
        ${r('SD Card Empty', '<input type="checkbox" id="dv-sd" style="accent-color:#ff3c3c;">')}
        ${r('Install Failure', '<input type="checkbox" id="dv-fail" style="accent-color:#ff3c3c;">')}
        ${r('Emulator Not Found', '<input type="checkbox" id="dv-enf" style="accent-color:#ff3c3c;">')}
        <div style="height:1px;background:#333;margin:4px 0;"></div>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:2px 0;">
          <span style="font-size:10px;color:#666;">Step <span id="dv-si">${currentStep}/${steps.length - 1}</span></span>
          <span id="dv-go" style="font-size:10px;color:#ff3c3c;cursor:pointer;text-decoration:underline;">goto</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:center;padding:6px 0 0 0;">
          <button id="dv-restart" style="width:100%;background:#ff3c3c22;border:1px solid #ff3c3c66;color:#fff;padding:4px;border-radius:4px;font-size:10px;font-family:monospace;cursor:pointer;transition:background 0.2s;">Restart Tutorial</button>
        </div>
      </div>`;
    document.body.appendChild(p);

    let drag = false,
      dx = 0,
      dy = 0;
    p.querySelector('#dev-hdr')!.addEventListener('mousedown', (e: any) => {
      drag = true;
      dx = e.clientX - p.offsetLeft;
      dy = e.clientY - p.offsetTop;
    });
    document.addEventListener('mousemove', (e) => {
      if (!drag) return;
      p.style.left = e.clientX - dx + 'px';
      p.style.top = e.clientY - dy + 'px';
      p.style.right = 'auto';
    });
    document.addEventListener('mouseup', () => {
      drag = false;
    });
    p.querySelector('#dev-x')!.addEventListener('click', () => {
      tutorialDevMode = false;
      p.remove();
      renderProgressDots().then(() => renderStep(currentStep));
    });

    const hw = p.querySelector('#dv-hw') as HTMLSelectElement;
    const emu = p.querySelector('#dv-emu') as HTMLSelectElement;
    const arc = p.querySelector('#dv-arc') as HTMLSelectElement;
    const sd = p.querySelector('#dv-sd') as HTMLInputElement;
    const fail = p.querySelector('#dv-fail') as HTMLInputElement;
    const enf = p.querySelector('#dv-enf') as HTMLInputElement;
    function upd() {
      if (hw.value) devOverrides['tutorial.hardwareType'] = hw.value;
      else delete devOverrides['tutorial.hardwareType'];
      if (emu.value) devOverrides['tutorial.emulatorType'] = emu.value;
      else delete devOverrides['tutorial.emulatorType'];
      if (arc.value !== '')
        devOverrides['tutorial.arcropolisInstalled'] = arc.value === 'true';
      else delete devOverrides['tutorial.arcropolisInstalled'];
      devOverrides['dev.sdCardEmpty'] = sd.checked;
      devOverrides['dev.installFail'] = fail.checked;
      devOverrides['dev.emulatorNotFound'] = enf.checked;
      applyDevOverrides();
      const si = p.querySelector('#dv-si');
      if (si) si.textContent = `${currentStep}/${steps.length - 1}`;
    }
    [hw, emu, arc, sd, fail, enf].forEach((el) =>
      el.addEventListener('change', upd),
    );
    p.querySelector('#dv-go')!.addEventListener('click', () => {
      const v = prompt(
        `Step (0-${steps.length - 1}):\n${steps.map((s, i) => `${i}: ${s.title}`).join('\n')}`,
      );
      if (v !== null) {
        const idx = parseInt(v);
        if (!isNaN(idx) && idx >= 0 && idx < steps.length) {
          currentStep = idx;
          renderProgressDots().then(() => renderStep(currentStep));
          const si = p.querySelector('#dv-si');
          if (si) si.textContent = `${currentStep}/${steps.length - 1}`;
        }
      }
    });
    const restartBtn = p.querySelector('#dv-restart') as HTMLButtonElement;
    restartBtn.addEventListener(
      'mouseenter',
      () => (restartBtn.style.background = '#ff3c3c44'),
    );
    restartBtn.addEventListener(
      'mouseleave',
      () => (restartBtn.style.background = '#ff3c3c22'),
    );
    restartBtn.addEventListener('click', () => {
      localStorage.setItem('tutorialDevState', JSON.stringify(devOverrides));
      window.location.reload();
    });

    if (devOverrides['tutorial.hardwareType'])
      hw.value = devOverrides['tutorial.hardwareType'];
    if (devOverrides['tutorial.emulatorType'])
      emu.value = devOverrides['tutorial.emulatorType'];
    if ('tutorial.arcropolisInstalled' in devOverrides)
      arc.value = devOverrides['tutorial.arcropolisInstalled']
        ? 'true'
        : 'false';
    sd.checked = !!devOverrides['dev.sdCardEmpty'];
    fail.checked = !!devOverrides['dev.installFail'];
    enf.checked = !!devOverrides['dev.emulatorNotFound'];
  }

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
      e.preventDefault();
      tutorialDevMode = !tutorialDevMode;
      if (tutorialDevMode) createDevPanel();
      else {
        document.getElementById('dev-mode-panel')?.remove();
        renderProgressDots().then(() => renderStep(currentStep));
      }
    }
  });
});
