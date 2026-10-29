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
    async installARCropolis(p: string): Promise<any> {
      if (tutorialDevMode && devOverrides['dev.installFail'])
        return { success: false, error: 'DEV: Simulated installation failure' };
      return (window.tutorialAPI as any).installARCropolis
        ? (window.tutorialAPI as any).installARCropolis(p)
        : { success: false };
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

  const ARCROPOLIS_CONTENTS_PATH = [
    'atmosphere',
    'contents',
    '01006A800016E000',
  ];

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

  let steps = [
    {
      icon: 'bi-stars',
      title: 'Welcome to MOSAIC',
      description: 'Mod manager for Super Smash Bros. Ultimate',
      content: `
<div class="tutorial-center">
    <h3 class="tutorial-welcome-title">Set up MOSAIC</h3>
    <p class="tutorial-welcome-text">A few questions about your setup, then MOSAIC knows where your mods and plugins live.</p>
    
    <div class="tutorial-feature-grid">
        <div class="tutorial-feature-hover">
            <i class="bi bi-collection-play tutorial-feature-icon"></i>
            <strong class="tutorial-feature-title">Mods</strong>
            <span class="tutorial-feature-caption">Enable, disable and rename</span>
        </div>
        
        <div class="tutorial-feature">
            <i class="bi bi-cloud-download tutorial-feature-icon"></i>
            <strong class="tutorial-feature-title">GameBanana</strong>
            <span class="tutorial-feature-caption">Install a mod from its page</span>
        </div>
        
        <div class="tutorial-feature">
            <i class="bi bi-people tutorial-feature-icon"></i>
            <strong class="tutorial-feature-title">Characters</strong>
            <span class="tutorial-feature-caption">Browse mods by fighter and slot</span>
        </div>
        
        <div class="tutorial-feature">
            <i class="bi bi-plugin tutorial-feature-icon"></i>
            <strong class="tutorial-feature-title">Plugins</strong>
            <span class="tutorial-feature-caption">Manage Skyline .nro plugins</span>
        </div>
    </div>
</div>
`,
    },
    {
      icon: 'bi-device-hdd',
      title: 'Hardware Type',
      description: 'Tell us about your setup',
      content: `
<div class="tutorial-center">
    <div class="tutorial-hero-icon">
        <i class="bi bi-device-hdd tutorial-hero-glyph"></i>
    </div>
    
    <h3 class="tutorial-question-title">What are you using?</h3>
    <p class="tutorial-question-text">Are you playing on a real Nintendo Switch or an emulator?</p>
    
    <div class="tutorial-options-wide">
        <label class="hardware-option tutorial-choice" data-value="hardware">
            <input type="radio" name="hardware-type" value="hardware" class="tutorial-choice-input">
            <div class="option-card tutorial-option-card">
                <div class="tutorial-option-icon">
                    <i class="bi bi-nintendo-switch tutorial-option-glyph"></i>
                </div>
                <h4 class="tutorial-option-title">Real Hardware</h4>
                <p class="tutorial-option-subtitle">Nintendo Switch</p>
                <div class="check-icon tutorial-check-badge">
                    <i class="bi bi-check-lg tutorial-text-white-md"></i>
                </div>
            </div>
        </label>
        
        <label class="hardware-option tutorial-choice" data-value="emulator">
            <input type="radio" name="hardware-type" value="emulator" class="tutorial-choice-input">
            <div class="option-card tutorial-option-card">
                <div class="tutorial-option-icon">
                    <i class="bi bi-laptop tutorial-option-glyph"></i>
                </div>
                <h4 class="tutorial-option-title">Emulator</h4>
                <p class="tutorial-option-subtitle">Yuzu or Ryujinx</p>
                <div class="check-icon tutorial-check-badge">
                    <i class="bi bi-check-lg tutorial-text-white-md"></i>
                </div>
            </div>
        </label>
    </div>
</div>

<style>
.hardware-option input:checked + .option-card {
    border-color: var(--accent-color);
    background: rgba(var(--accent-rgb), 0.2);
}

.hardware-option input:checked + .option-card .check-icon {
    display: flex;
}

.hardware-option input:checked + .option-card > div:first-of-type {
    background: rgba(var(--accent-rgb), 0.25);
    transform: scale(1.1);
}

.hardware-option:hover .option-card {
    border-color: rgba(var(--accent-rgb), 0.5);
}
</style>
`,
      onRender: async () => {
        const nextBtn = document.querySelector<HTMLElement>('#next-btn');
        const hardwareRadios = document.querySelectorAll<HTMLElement>(
          'input[name="hardware-type"]',
        );

        if (window.tutorialAPI) {
          try {
            const hardwareType = await apiWrapper.storeGet(
              'tutorial.hardwareType',
            );
            if (hardwareType) {
              const radio = document.querySelector<HTMLInputElement>(
                `input[name="hardware-type"][value="${hardwareType}"]`,
              );
              if (radio) {
                radio.checked = true;
                radio.dispatchEvent(new Event('change'));
              }
            }
          } catch (e) {
            console.error('Error loading tutorial state:', e);
          }
        }

        const disableNext = () => {
          if (nextBtn) {
            nextBtn.style.opacity = '0.5';
            nextBtn.style.pointerEvents = 'none';
            nextBtn.style.cursor = 'not-allowed';
          }
        };

        const enableNext = () => {
          if (nextBtn) {
            nextBtn.style.opacity = '1';
            nextBtn.style.pointerEvents = 'auto';
            nextBtn.style.cursor = 'pointer';
          }
        };

        disableNext();

        const checkAndSave = async () => {
          const hardwareSelected = document.querySelector<HTMLInputElement>(
            'input[name="hardware-type"]:checked',
          );

          if (hardwareSelected && window.tutorialAPI) {
            const hardwareType = hardwareSelected.value;
            await window.tutorialAPI.store.set(
              'tutorial.hardwareType',
              hardwareType,
            );
            await window.tutorialAPI.store.set(
              'appRunMode',
              hardwareType === 'hardware' ? 'hardware' : 'emulator',
            );

            if (nextBtn) {
              nextBtn.style.opacity = '1';
              nextBtn.style.pointerEvents = 'auto';
              nextBtn.style.cursor = 'pointer';
            }

            await renderProgressDots();
          }
        };

        hardwareRadios.forEach((radio) => {
          radio.addEventListener('change', checkAndSave);
        });

        checkAndSave();
      },
    },
    {
      icon: 'bi-shield-check',
      title: 'Switch Modded Check',
      description: 'Confirm your Switch is ready for homebrew',
      content: `
<div class="tutorial-center">
    <div class="tutorial-hero-icon">
        <i class="bi bi-shield-check tutorial-hero-glyph"></i>
    </div>

    <h3 class="tutorial-question-title">Is your Switch modded?</h3>
    <p class="tutorial-question-text">MOSAIC needs a modded Switch before installing Skyline, ARCropolis, and Smash mods.</p>

    <div class="tutorial-options">
        <label class="switch-modded-option tutorial-choice" data-value="yes">
            <input type="radio" name="switch-modded" value="yes" class="tutorial-choice-input">
            <div class="option-card-yes tutorial-option-card-yes-compact">
                <i class="bi bi-check-circle-fill tutorial-yes-glyph"></i>
                <h4 class="tutorial-option-title">Yes</h4>
                <p class="tutorial-option-subtitle">Continue setup</p>
                <div class="check-icon tutorial-check-badge">
                    <i class="bi bi-check-lg tutorial-text-white-md"></i>
                </div>
            </div>
        </label>

        <label class="switch-modded-option tutorial-choice" data-value="no">
            <input type="radio" name="switch-modded" value="no" class="tutorial-choice-input">
            <div class="option-card-no tutorial-option-card-no-compact">
                <i class="bi bi-box-arrow-up-right tutorial-no-glyph"></i>
                <h4 class="tutorial-option-title">No</h4>
                <p class="tutorial-option-subtitle">Open the guide first</p>
                <div class="check-icon tutorial-check-badge-warning">
                    <i class="bi bi-check-lg tutorial-text-white-md"></i>
                </div>
            </div>
        </label>
    </div>

    <div id="switch-modded-help" class="tutorial-modded-help"></div>
</div>

<style>
.switch-modded-option input:checked + .option-card-yes {
    border-color: var(--success-color);
    background: rgba(var(--success-color-rgb), 0.2);
}

.switch-modded-option input:checked + .option-card-no {
    border-color: var(--warning-color);
    background: rgba(var(--warning-color-rgb), 0.2);
}

.switch-modded-option input:checked + .option-card-yes .check-icon,
.switch-modded-option input:checked + .option-card-no .check-icon {
    display: flex;
}

.switch-modded-option:hover .option-card-yes,
.switch-modded-option:hover .option-card-no {
    border-color: rgba(var(--accent-rgb), 0.5);
}
</style>
`,
      onRender: async () => {
        const nextBtn = document.querySelector<HTMLElement>('#next-btn');
        const switchModdedRadios = document.querySelectorAll<HTMLElement>(
          'input[name="switch-modded"]',
        );
        const helpDiv = document.querySelector<HTMLElement>(
          '#switch-modded-help',
        );

        const disableNext = () => {
          if (nextBtn) {
            nextBtn.style.opacity = '0.5';
            nextBtn.style.pointerEvents = 'none';
            nextBtn.style.cursor = 'not-allowed';
          }
        };

        const enableNext = () => {
          if (nextBtn) {
            nextBtn.style.opacity = '1';
            nextBtn.style.pointerEvents = 'auto';
            nextBtn.style.cursor = 'pointer';
          }
        };

        const showGuideMessage = () => {
          disableNext();
          if (!helpDiv) return;

          helpDiv.innerHTML = `
            <div class="tutorial-box-warning-left">
                <p class="tutorial-help-title">
                    Mod your Switch first, then come back here.
                </p>
                <p class="tutorial-help-text">
                    Follow the Switch homebrew guide, restart this tutorial when your Switch is ready, then answer "Yes" to continue.
                </p>
                <a href="https://switch.hacks.guide/" target="_blank" class="tutorial-btn-link">
                    Open switch.hacks.guide <i class="bi bi-box-arrow-up-right"></i>
                </a>
            </div>
          `;
          setupExternalLinks(helpDiv);
        };

        disableNext();

        if (window.tutorialAPI) {
          try {
            const switchModded = await apiWrapper.storeGet(
              'tutorial.switchModded',
            );
            if (switchModded !== null && switchModded !== undefined) {
              const value = switchModded ? 'yes' : 'no';
              const radio = document.querySelector<HTMLInputElement>(
                `input[name="switch-modded"][value="${value}"]`,
              );
              if (radio) {
                radio.checked = true;
              }
              if (switchModded) {
                enableNext();
              } else {
                showGuideMessage();
              }
            }
          } catch (e) {
            console.error('Error loading Switch modded state:', e);
          }
        }

        const checkAndSave = async () => {
          const switchModdedSelected = document.querySelector<HTMLInputElement>(
            'input[name="switch-modded"]:checked',
          );
          if (!switchModdedSelected || !window.tutorialAPI) return;

          const switchModded = switchModdedSelected.value === 'yes';
          await window.tutorialAPI.store.set(
            'tutorial.switchModded',
            switchModded,
          );

          if (switchModded) {
            if (helpDiv) {
              helpDiv.innerHTML = `
                <div class="tutorial-box-success-compact">
                    <span class="tutorial-text-white">Good. You can continue with the Switch setup.</span>
                </div>
              `;
            }
            enableNext();
          } else {
            showGuideMessage();
          }

          await renderProgressDots();
        };

        switchModdedRadios.forEach((radio) => {
          radio.addEventListener('change', checkAndSave);
        });
      },
    },
    {
      icon: 'bi-question-circle',
      title: 'ARCropolis Status',
      description: 'Do you already have ARCropolis installed?',
      content: `
<div class="tutorial-center">
    <div class="tutorial-hero-icon-success">
        <i class="bi bi-question-circle tutorial-hero-glyph-success"></i>
    </div>
    
    <h3 class="tutorial-question-title">ARCropolis Installation</h3>
    <p class="tutorial-question-text">ARCropolis is required to use mods. Have you already installed it?</p>
    
    <div class="tutorial-options">
        <label class="arcropolis-option tutorial-choice" data-value="yes">
            <input type="radio" name="arcropolis-installed" value="yes" class="tutorial-choice-input">
            <div class="option-card-yes tutorial-option-card-yes">
                <div class="tutorial-option-icon-success">
                    <i class="bi bi-check-circle-fill tutorial-option-glyph-success"></i>
                </div>
                <h4 class="tutorial-option-title">Yes</h4>
                <p class="tutorial-option-subtitle">Already installed</p>
                <div class="check-icon tutorial-check-badge">
                    <i class="bi bi-check-lg tutorial-text-white-md"></i>
                </div>
            </div>
        </label>
        
        <label class="arcropolis-option tutorial-choice" data-value="no">
            <input type="radio" name="arcropolis-installed" value="no" class="tutorial-choice-input">
            <div class="option-card-no tutorial-option-card-no">
                <div class="tutorial-option-icon-warning">
                    <i class="bi bi-download tutorial-option-glyph-warning"></i>
                </div>
                <h4 class="tutorial-option-title">No</h4>
                <p class="tutorial-option-subtitle">Need to install</p>
                <div class="check-icon tutorial-check-badge-warning">
                    <i class="bi bi-check-lg tutorial-text-white-md"></i>
                </div>
            </div>
        </label>
    </div>
</div>

<style>
.arcropolis-option input:checked + .option-card-yes {
    border-color: var(--success-color);
    background: rgba(var(--success-color-rgb), 0.2);
}

.arcropolis-option input:checked + .option-card-yes .check-icon {
    display: flex;
}

.arcropolis-option input:checked + .option-card-yes > div:first-of-type {
    background: rgba(var(--success-color-rgb), 0.25);
    transform: scale(1.1);
}

.arcropolis-option input:checked + .option-card-no {
    border-color: var(--warning-color);
    background: rgba(var(--warning-color-rgb), 0.2);
}

.arcropolis-option input:checked + .option-card-no .check-icon {
    display: flex;
}

.arcropolis-option input:checked + .option-card-no > div:first-of-type {
    background: rgba(var(--warning-color-rgb), 0.25);
    transform: scale(1.1);
}

.arcropolis-option:hover .option-card-yes,
.arcropolis-option:hover .option-card-no {
    border-color: rgba(var(--accent-rgb), 0.5);
}
</style>
`,
      onRender: async () => {
        const nextBtn = document.querySelector<HTMLElement>('#next-btn');
        const arcropolisRadios = document.querySelectorAll<HTMLElement>(
          'input[name="arcropolis-installed"]',
        );

        if (window.tutorialAPI) {
          try {
            const arcropolisInstalled = await apiWrapper.storeGet(
              'tutorial.arcropolisInstalled',
            );
            if (
              arcropolisInstalled !== null &&
              arcropolisInstalled !== undefined
            ) {
              const value = arcropolisInstalled ? 'yes' : 'no';
              const radio = document.querySelector<HTMLInputElement>(
                `input[name="arcropolis-installed"][value="${value}"]`,
              );
              if (radio) {
                radio.checked = true;
                radio.dispatchEvent(new Event('change'));
              }
            }
          } catch (e) {
            console.error('Error loading tutorial state:', e);
          }
        }

        const disableNext = () => {
          if (nextBtn) {
            nextBtn.style.opacity = '0.5';
            nextBtn.style.pointerEvents = 'none';
            nextBtn.style.cursor = 'not-allowed';
          }
        };

        const enableNext = () => {
          if (nextBtn) {
            nextBtn.style.opacity = '1';
            nextBtn.style.pointerEvents = 'auto';
            nextBtn.style.cursor = 'pointer';
          }
        };

        disableNext();

        const checkAndSave = async () => {
          const arcropolisSelected = document.querySelector<HTMLInputElement>(
            'input[name="arcropolis-installed"]:checked',
          );

          if (arcropolisSelected && window.tutorialAPI) {
            const arcropolisInstalled = arcropolisSelected.value === 'yes';
            await window.tutorialAPI.store.set(
              'tutorial.arcropolisInstalled',
              arcropolisInstalled,
            );

            if (nextBtn) {
              nextBtn.style.opacity = '1';
              nextBtn.style.pointerEvents = 'auto';
              nextBtn.style.cursor = 'pointer';
            }
          }
        };

        arcropolisRadios.forEach((radio) => {
          radio.addEventListener('change', checkAndSave);
        });

        checkAndSave();
      },
    },
    {
      icon: 'bi-sd-card',
      title: 'Switch SD Card Setup',
      description: 'Detect and configure your SD card',
      content: `
<div class="tutorial-center">
    <h3 class="tutorial-status-title">Insert Your SD Card</h3>
    <p class="tutorial-lead-lg">Please insert your Nintendo Switch SD card into your PC.</p>
    
    <div id="sd-card-status" class="tutorial-status-list">
        <div class="tutorial-box">
            <div class="tutorial-row-between">
                <span class="tutorial-text-white">Detecting drives...</span>
                <div id="detection-spinner" class="tutorial-spinner"></div>
            </div>
        </div>
    </div>
    
    <style>
        @keyframes spin { to { transform: rotate(360deg); } }
    </style>
</div>
`,
      onRender: async () => {
        const statusDiv =
          document.querySelector<HTMLElement>('#sd-card-status');
        const nextBtn = document.querySelector<HTMLElement>('#next-btn');

        if (nextBtn) {
          nextBtn.style.opacity = '0.5';
          nextBtn.style.pointerEvents = 'none';
        }

        if (window.tutorialAPI) {
          try {
            const result = await apiWrapper.detectSdDrives();
            if (result.success && result.drives) {
              const drives = result.drives;

              if (drives.length === 0) {
                statusDiv!.innerHTML = `
                            <div class="tutorial-box-warning-center">
                                <p class="tutorial-text-warning">No drives detected. Please insert your SD card and click "Detect Again".</p>
                                <button id="retry-detect-btn" class="tutorial-btn-retry">
                                    Detect Again
                                </button>
                            </div>
                        `;
                document
                  .querySelector<HTMLElement>('#retry-detect-btn')
                  ?.addEventListener('click', () => {
                    statusDiv!.innerHTML =
                      '<div class="tutorial-detecting">Detecting drives...</div>';
                    setTimeout(() => steps[currentStep].onRender!(), 1000);
                  });
              } else if (drives.length === 1) {
                const drive = drives[0];
                const sdPath = drive.path;
                await window.tutorialAPI.store.set('tutorial.sdDrive', sdPath);

                statusDiv!.innerHTML = `
                            <div class="tutorial-box-success">
                                <div class="tutorial-row-between-spaced">
                                    <div class="tutorial-row">
                                        <i class="bi bi-check-circle-fill tutorial-icon-success"></i>
                                        <div>
                                            <strong class="tutorial-label">Drive Detected</strong>
                                            <span class="tutorial-path">${sdPath}</span>
                                        </div>
                                    </div>
                                    <button id="wrong-drive-btn" class="tutorial-btn-warning">
                                        Wrong drive?
                                    </button>
                                </div>
                            </div>
                        `;

                document
                  .querySelector<HTMLElement>('#wrong-drive-btn')
                  ?.addEventListener('click', async () => {
                    const result = await window.tutorialAPI.selectDrive();
                    if (result.success && !result.canceled) {
                      await window.tutorialAPI.store.set(
                        'tutorial.sdDrive',
                        result.path,
                      );
                      statusDiv!.innerHTML = `
                                    <div class="tutorial-box-success">
                                        <div class="tutorial-row-between">
                                            <div class="tutorial-row">
                                                <i class="bi bi-check-circle-fill tutorial-icon-success"></i>
                                                <div>
                                                    <strong class="tutorial-label">Selected: ${result.path}</strong>
                                                </div>
                                            </div>
                                            <button id="wrong-drive-btn-2" class="tutorial-btn-warning-plain">
                                                Wrong drive?
                                            </button>
                                        </div>
                                    </div>
                                `;
                      document
                        .querySelector<HTMLElement>('#wrong-drive-btn-2')
                        ?.addEventListener('click', async () => {
                          const result2 =
                            await window.tutorialAPI.selectDrive();
                          if (result2.success && !result2.canceled) {
                            await window.tutorialAPI.store.set(
                              'tutorial.sdDrive',
                              result2.path,
                            );
                            statusDiv!.innerHTML = `
                                            <div class="tutorial-box-success">
                                                <div class="tutorial-row">
                                                    <i class="bi bi-check-circle-fill tutorial-icon-success"></i>
                                                    <div>
                                                        <strong class="tutorial-label">Selected: ${result2.path}</strong>
                                                    </div>
                                                </div>
                                            </div>
                                        `;
                          }
                        });
                    }
                  });

                if (nextBtn) {
                  nextBtn.style.opacity = '1';
                  nextBtn.style.pointerEvents = 'auto';
                }
              } else {
                statusDiv!.innerHTML = `
                            <div class="tutorial-box">
                                <p class="tutorial-drives-title">Multiple drives detected. Please select your SD card:</p>
                                <div class="tutorial-stack-sm">
                                    ${drives
                                      .map(
                                        (drive, idx) => `
                                        <button class="drive-select-btn tutorial-drive-btn" data-path="${drive.path}">
                                            <strong>${drive.letter}:</strong> ${drive.label} (${drive.type})
                                        </button>
                                    `,
                                      )
                                      .join('')}
                                </div>
                                <button id="manual-select-btn" class="tutorial-btn-manual">
                                    Browse Manually...
                                </button>
                            </div>
                        `;

                document
                  .querySelectorAll<HTMLElement>('.drive-select-btn')
                  .forEach((btn) => {
                    btn.addEventListener('click', async () => {
                      const path = btn.dataset.path;
                      await window.tutorialAPI.store.set(
                        'tutorial.sdDrive',
                        path,
                      );
                      statusDiv!.innerHTML = `
                                    <div class="tutorial-box-success">
                                        <div class="tutorial-row">
                                            <i class="bi bi-check-circle-fill tutorial-icon-success"></i>
                                            <div>
                                                <strong class="tutorial-label">Selected: ${path}</strong>
                                            </div>
                                        </div>
                                    </div>
                                `;
                      if (nextBtn) {
                        nextBtn.style.opacity = '1';
                        nextBtn.style.pointerEvents = 'auto';
                      }
                    });
                  });

                document
                  .querySelector<HTMLElement>('#manual-select-btn')
                  ?.addEventListener('click', async () => {
                    const result = await window.tutorialAPI.selectDrive();
                    if (result.success && !result.canceled) {
                      await window.tutorialAPI.store.set(
                        'tutorial.sdDrive',
                        result.path,
                      );
                      statusDiv!.innerHTML = `
                                    <div class="tutorial-box-success">
                                        <div class="tutorial-row">
                                            <i class="bi bi-check-circle-fill tutorial-icon-success"></i>
                                            <div>
                                                <strong class="tutorial-label">Selected: ${result.path}</strong>
                                            </div>
                                        </div>
                                    </div>
                                `;
                      if (nextBtn) {
                        nextBtn.style.opacity = '1';
                        nextBtn.style.pointerEvents = 'auto';
                      }
                    }
                  });
              }
            }
          } catch (error) {
            console.error('Error detecting drives:', error);
            statusDiv!.innerHTML = `
                    <div class="tutorial-box-error-center">
                        <p class="tutorial-text-error">Error detecting drives. Please use manual selection.</p>
                        <button id="manual-select-error-btn" class="tutorial-btn-manual-error">
                            Select Manually
                        </button>
                    </div>
                `;
            document
              .querySelector<HTMLElement>('#manual-select-error-btn')
              ?.addEventListener('click', async () => {
                const result = await window.tutorialAPI.selectDrive();
                if (result.success && !result.canceled) {
                  await window.tutorialAPI.store.set(
                    'tutorial.sdDrive',
                    result.path,
                  );
                  statusDiv!.innerHTML = `
                            <div class="tutorial-box-success">
                                <div class="tutorial-row">
                                    <i class="bi bi-check-circle-fill tutorial-icon-success"></i>
                                    <div>
                                        <strong class="tutorial-label">Selected: ${result.path}</strong>
                                    </div>
                                </div>
                            </div>
                        `;
                  if (nextBtn) {
                    nextBtn.style.opacity = '1';
                    nextBtn.style.pointerEvents = 'auto';
                  }
                }
              });
          }
        }
      },
    },
    {
      icon: 'bi-download',
      title: 'Installing Skyline & ARCropolis (Switch)',
      description:
        'Downloading and installing Skyline (exefs) and ARCropolis (romfs) on your SD card',
      content: `
<div class="tutorial-center">
    <h3 class="tutorial-status-title">Installing ARCropolis</h3>
    <div id="install-status" class="tutorial-status-list">
        <div class="tutorial-box">
            <div class="tutorial-row-between-tight">
                <span class="tutorial-text-white">Preparing installation...</span>
                <div id="install-spinner" class="tutorial-spinner"></div>
            </div>
            <div id="install-progress" class="tutorial-install-progress">
                <div id="progress-bar" class="tutorial-progress-fill" style="width: 0%;"></div>
            </div>
        </div>
    </div>
</div>
`,
      onRender: () =>
        runArcropolisInstallStep({
          statusSelector: '#install-status',
          pathKey: 'tutorial.sdDrive',
          missingPathMessage:
            'SD card path not found. Please go back and select your SD card.',
          dataFolder: null,
          extraDirs: [['ultimate', 'mods']],
        }),
    },
    {
      icon: 'bi-controller',
      title: 'Verify ARCropolis (Switch)',
      description: 'Launch the game and verify installation',
      content: `
<div class="tutorial-center">
    <h3 class="tutorial-status-title">Verify Installation</h3>
    <p class="tutorial-lead-md">Please launch Super Smash Bros. Ultimate on your Switch and check if ARCropolis is working.</p>
    
    <div class="tutorial-lottie-frame">
        <div id="arcropolis-lottie-switch" class="tutorial-lottie"></div>
        <div class="scroll-indicator tutorial-scroll-indicator">
            <i class="bi bi-chevron-down tutorial-scroll-indicator-icon"></i>
        </div>
        <style>
            @keyframes bounce-side {
                0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
                40% { transform: translateY(10px); }
                60% { transform: translateY(5px); }
            }
        </style>
    </div>
    
    <div class="tutorial-box-warning-panel">
        <p class="tutorial-warning-title">
            <i class="bi bi-info-circle-fill"></i> What to look for:
        </p>
        <ul class="tutorial-steps-list">
            <li>Launch Super Smash Bros. Ultimate</li>
            <li>Look for <strong class="tutorial-text-white">ARCropolis version text</strong> in the <strong class="tutorial-text-white">top-right corner</strong> of the screen</li>
            <li>If you see it, ARCropolis is working!</li>
        </ul>
    </div>
    
    
    
    <div id="verification-status" class="tutorial-verification">
        <p class="tutorial-lead">Did you see the ARCropolis text?</p>
        <div class="tutorial-actions">
            <button id="verify-yes-btn" class="tutorial-btn-yes">
                Yes, it's working!
            </button>
            <button id="verify-no-btn" class="tutorial-btn-no">
                No, not working
            </button>
        </div>
    </div>
</div>
`,
      onRender: async () => {
        const nextBtn = document.querySelector<HTMLElement>('#next-btn');
        const verifyYesBtn =
          document.querySelector<HTMLElement>('#verify-yes-btn');
        const verifyNoBtn =
          document.querySelector<HTMLElement>('#verify-no-btn');
        const lottieContainer = document.querySelector<HTMLElement>(
          '#arcropolis-lottie-switch',
        );

        if (lottieContainer && window.lottie) {
          try {
            const anim = window.lottie.loadAnimation({
              container: lottieContainer,
              renderer: 'svg',
              loop: true,
              autoplay: true,
              path: '../images/tutorial-arcropolisSWITCH.json',
            });
          } catch (e) {
            console.error('Failed to load Lottie animation:', e);
          }
        }

        if (nextBtn) {
          nextBtn.style.opacity = '0.5';
          nextBtn.style.pointerEvents = 'none';
        }

        verifyYesBtn?.addEventListener('click', async () => {
          await window.tutorialAPI.store.set(
            'tutorial.arcropolisVerified',
            true,
          );
          const statusDiv = document.querySelector<HTMLElement>(
            '#verification-status',
          );
          statusDiv!.innerHTML = `
                <div class="tutorial-box-success-center">
                    <i class="bi bi-check-circle-fill tutorial-icon-success-lg"></i>
                    <p class="tutorial-result-text">Great! ARCropolis is working correctly.</p>
                    <p class="tutorial-note">Next, choose whether MOSAIC should sync mods from this PC or read them directly from your mounted Switch SD card.</p>
                </div>
            `;
          if (nextBtn) {
            nextBtn.style.opacity = '1';
            nextBtn.style.pointerEvents = 'auto';
          }
        });

        verifyNoBtn?.addEventListener('click', () => {
          const statusDiv = document.querySelector<HTMLElement>(
            '#verification-status',
          );
          statusDiv!.innerHTML = `
                <div class="tutorial-box-error-center">
                    <i class="bi bi-exclamation-triangle-fill tutorial-icon-error-lg"></i>
                    <p class="tutorial-result-text">ARCropolis is not working.</p>
                    <p class="tutorial-hint-tight">Please join the <a href="https://discord.gg/2zT5Rg46bG" target="_blank">MOSAIC Discord</a> to get help with installation.</p>
                    <p class="tutorial-footnote">You can continue the tutorial, but mods may not work until ARCropolis is properly installed.</p>
                    <button id="change-answer-btn" class="tutorial-btn-accent">
                        Change my answer
                    </button>
                </div>
            `;
          setupDiscordLinks(statusDiv!);
          const changeAnswerBtn =
            document.querySelector<HTMLElement>('#change-answer-btn');
          changeAnswerBtn?.addEventListener('click', async () => {
            currentStep = steps.findIndex(
              (s) => s.title === 'Installing Skyline & ARCropolis (Switch)',
            );
            await renderProgressDots();
            renderStep(currentStep);
          });
          if (nextBtn) {
            nextBtn.style.opacity = '1';
            nextBtn.style.pointerEvents = 'auto';
          }
        });
      },
    },
    {
      icon: 'bi-device-hdd',
      title: 'Real Hardware Library',
      description: 'Choose how MOSAIC should manage Switch mods',
      content: `
<div class="tutorial-center">
    <h3 class="tutorial-library-title">How do you want to manage your mods?</h3>
    <p id="hardware-library-description" class="tutorial-library-description">Choose whether MOSAIC keeps a local mod library on this PC and syncs it to your Switch, or reads the mounted Switch SD card directly.</p>

    <div class="tutorial-library-options">
        <label class="hardware-library-option tutorial-choice" data-value="local">
            <input type="radio" name="hardware-library-mode" value="local" class="tutorial-choice-input">
            <div class="hardware-library-card">
                <i class="bi bi-pc-display tutorial-mode-icon"></i>
                <strong class="tutorial-mode-title">Keep mods on this PC and sync</strong>
                <span class="tutorial-mode-text">Recommended if you want MOSAIC to keep your library locally, then send mods to your Switch when needed.</span>
                <i class="bi bi-check-circle-fill check-icon tutorial-mode-check"></i>
            </div>
        </label>
        <label class="hardware-library-option tutorial-choice" data-value="direct">
            <input type="radio" name="hardware-library-mode" value="direct" class="tutorial-choice-input">
            <div class="hardware-library-card">
                <i class="bi bi-sd-card tutorial-mode-icon"></i>
                <strong class="tutorial-mode-title">Read mods directly from the Switch</strong>
                <span class="tutorial-mode-text">MOSAIC uses the mounted Switch SD card as the library. No separate PC sync step is needed.</span>
                <i class="bi bi-check-circle-fill check-icon tutorial-mode-check"></i>
            </div>
        </label>
    </div>

    <div id="hardware-library-status" class="tutorial-library-status"></div>
</div>
<style>
.hardware-library-card {
    min-height: 170px;
    position: relative;
    padding: 22px 18px;
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.04);
    transition: all 0.2s ease;
}
.hardware-library-option input:checked + .hardware-library-card {
    border-color: var(--accent-color);
    background: rgba(var(--accent-rgb), 0.18);
}
.hardware-library-option input:checked + .hardware-library-card .check-icon {
    display: block;
}
.hardware-library-option:hover .hardware-library-card {
    border-color: rgba(var(--accent-rgb), 0.45);
}
</style>
`,
      onRender: async () => {
        const nextBtn = document.querySelector<HTMLElement>('#next-btn');
        const radios = document.querySelectorAll<HTMLInputElement>(
          'input[name="hardware-library-mode"]',
        );
        const status = document.querySelector<HTMLElement>(
          '#hardware-library-status',
        );
        const ftpOnly =
          (await apiWrapper.storeGet('switchTransferMethod')) === 'ftp';
        const directRadio = document.querySelector<HTMLInputElement>(
          'input[name="hardware-library-mode"][value="direct"]',
        );
        if (directRadio) {
          directRadio.disabled = ftpOnly;
          const directOption = directRadio.closest<HTMLElement>(
            '.hardware-library-option',
          );
          if (directOption) {
            directOption.style.display = ftpOnly ? 'none' : '';
          }
        }
        if (ftpOnly) {
          const description = document.querySelector<HTMLElement>(
            '#hardware-library-description',
          );
          if (description) {
            description.textContent =
              'FTP requires keeping mods on this PC and transferring them to the Switch. Direct library access is unavailable with FTP.';
          }
        }

        const disableNext = () => {
          if (nextBtn) {
            nextBtn.style.opacity = '0.5';
            nextBtn.style.pointerEvents = 'none';
            nextBtn.style.cursor = 'not-allowed';
          }
        };

        const enableNext = () => {
          if (nextBtn) {
            nextBtn.style.opacity = '1';
            nextBtn.style.pointerEvents = 'auto';
            nextBtn.style.cursor = 'pointer';
          }
        };

        disableNext();

        const isSwitchLibraryPath = (value: string | null) => {
          if (!value) return false;
          const normalized = value.replace(/\\/g, '/').toLowerCase();
          return (
            normalized.endsWith('/ultimate/mods') ||
            normalized.endsWith(
              '/atmosphere/contents/01006a800016e000/romfs/skyline/plugins',
            ) ||
            normalized.endsWith(
              '/ultimate/contents/01006a800016e000/romfs/skyline/plugins',
            )
          );
        };

        const getDriveDisplayText = (drive: any) => {
          if (drive.path && drive.path.includes(':\\')) {
            return `${drive.letter}: (${drive.label || 'Unknown'})`;
          }

          if (drive.path && drive.path.startsWith('/')) {
            return `${drive.path} (${drive.label || 'Unknown'})`;
          }

          return `${drive.letter || drive.path} (${drive.label || 'Unknown'})`;
        };

        const selectSdDrive = async (sdDrive: string) => {
          await window.tutorialAPI.store.set('tutorial.sdDrive', sdDrive);
          await window.tutorialAPI.store.set('switchDriveLetter', sdDrive);
          await configureMode('direct');
        };

        const showSelectedSdDrive = (sdDrive: string) => {
          if (!status) return;

          status.innerHTML = `
            <div class="tutorial-library-selected">
              <div class="tutorial-library-selected-row">
                <div class="tutorial-library-selected-info">
                  <i class="bi bi-check-circle-fill tutorial-library-selected-icon"></i>
                  <div class="tutorial-shrink">
                    <strong class="tutorial-label">Switch SD card selected</strong>
                    <span class="tutorial-library-selected-path">${sdDrive}</span>
                  </div>
                </div>
                <button id="hardware-library-change-sd-btn" class="tutorial-library-change-btn">
                  <i class="bi bi-arrow-repeat"></i>
                  Change
                </button>
              </div>
            </div>
          `;

          document
            .querySelector<HTMLElement>('#hardware-library-change-sd-btn')
            ?.addEventListener('click', () => {
              void showSelectSdCardPrompt(sdDrive);
            });
        };

        const showSelectSdCardPrompt = async (
          currentSdDrive?: string | null,
        ) => {
          disableNext();
          if (!status) return;

          status.innerHTML = `
            <div class="tutorial-library-picker">
              <div class="tutorial-library-picker-header">
                <i class="bi bi-sd-card tutorial-icon-warning"></i>
                <strong class="tutorial-text-white">Select your Switch SD card to use direct mode.</strong>
              </div>
              <p class="tutorial-library-picker-text">
                MOSAIC needs the mounted SD card location before it can read mods directly from the Switch.
              </p>
              ${
                currentSdDrive
                  ? `<p class="tutorial-library-picker-current">Current: ${currentSdDrive}</p>`
                  : ''
              }
              <div id="hardware-library-drive-picker" class="tutorial-stack-sm">
                <div class="tutorial-library-picker-loading">
                  <i class="bi bi-arrow-clockwise tutorial-spin"></i>
                  Detecting local USB / SD drives...
                </div>
              </div>
            </div>
          `;

          const picker = document.querySelector<HTMLElement>(
            '#hardware-library-drive-picker',
          );
          if (!picker || !window.tutorialAPI) return;

          const openManualPicker = async () => {
            const result = await window.tutorialAPI.selectDrive();
            if (result.success && !result.canceled && result.path) {
              await selectSdDrive(result.path);
            }
          };

          const renderManualActions = () => {
            picker.insertAdjacentHTML(
              'beforeend',
              `
                <div class="tutorial-library-picker-actions">
                  <button id="hardware-library-refresh-drives-btn" class="tutorial-library-refresh-btn">
                    <i class="bi bi-arrow-clockwise"></i>
                    Refresh drives
                  </button>
                  <button id="hardware-library-browse-sd-btn" class="tutorial-library-browse-btn">
                    <i class="bi bi-folder2-open"></i>
                    Browse manually
                  </button>
                </div>
              `,
            );

            document
              .querySelector<HTMLElement>(
                '#hardware-library-refresh-drives-btn',
              )
              ?.addEventListener('click', () => {
                void showSelectSdCardPrompt(currentSdDrive);
              });
            document
              .querySelector<HTMLElement>('#hardware-library-browse-sd-btn')
              ?.addEventListener('click', () => {
                void openManualPicker();
              });
          };

          try {
            const result = await apiWrapper.detectSdDrives();
            const drives =
              result?.success && Array.isArray(result.drives)
                ? result.drives
                : [];

            if (drives.length === 0) {
              picker.innerHTML = `
                <div class="tutorial-library-empty">
                  No local USB / SD drive detected. Mount the Switch SD card, then refresh.
                </div>
              `;
              renderManualActions();
              return;
            }

            picker.innerHTML = drives
              .map((drive: any) => {
                const displayText = getDriveDisplayText(drive);
                const drivePath = drive.path || drive.letter;
                return `
                  <button class="hardware-library-drive-select-btn tutorial-library-drive-btn" data-path="${drivePath}">
                    <i class="bi bi-usb-drive tutorial-library-drive-icon"></i>
                    <span class="tutorial-library-drive-text">
                      <strong class="tutorial-wrap-anywhere">${displayText}</strong>
                      <small class="tutorial-library-drive-type">${drive.type || 'local drive'}</small>
                    </span>
                  </button>
                `;
              })
              .join('');

            document
              .querySelectorAll<HTMLElement>(
                '.hardware-library-drive-select-btn',
              )
              .forEach((button) => {
                button.addEventListener('click', async () => {
                  const sdDrive = button.dataset.path;
                  if (sdDrive) {
                    await selectSdDrive(sdDrive);
                  }
                });
              });

            renderManualActions();
          } catch (error) {
            console.error('Failed to detect SD drives for direct mode:', error);
            picker.innerHTML = `
              <div class="tutorial-library-error">
                Drive detection failed. You can still browse to the mounted SD card manually.
              </div>
            `;
            renderManualActions();
          }
        };

        const configureMode = async (
          mode: 'local' | 'direct',
          options: { requireSdSelection?: boolean } = {},
        ) => {
          if (!window.tutorialAPI) return;
          const useFtp =
            (await apiWrapper.storeGet('switchTransferMethod')) === 'ftp';
          if (useFtp) {
            mode = 'local';
          }
          radios.forEach((radio) => {
            radio.checked = radio.value === mode;
          });

          await window.tutorialAPI.store.set(
            'tutorial.hardwareLibraryMode',
            mode,
          );
          await window.tutorialAPI.store.set('hardwareLibraryMode', mode);
          await window.tutorialAPI.store.set('appRunMode', 'hardware');
          await window.tutorialAPI.store.set(
            'switchTransferMethod',
            useFtp ? 'ftp' : 'drive',
          );

          const sdDrive =
            ((await apiWrapper.storeGet('tutorial.sdDrive')) as
              | string
              | null) ||
            ((await apiWrapper.storeGet('switchDriveLetter')) as string | null);

          if (sdDrive) {
            await window.tutorialAPI.store.set('switchDriveLetter', sdDrive);
          }

          if (mode === 'direct') {
            if (options.requireSdSelection || !sdDrive) {
              void showSelectSdCardPrompt(sdDrive);
              return;
            }

            const currentModsPath = (await apiWrapper.storeGet('modsPath')) as
              | string
              | null;
            const currentPluginsPath = (await apiWrapper.storeGet(
              'pluginsPath',
            )) as string | null;

            if (currentModsPath && !isSwitchLibraryPath(currentModsPath)) {
              await window.tutorialAPI.store.set(
                'localModsPath',
                currentModsPath,
              );
            }
            if (
              currentPluginsPath &&
              !isSwitchLibraryPath(currentPluginsPath)
            ) {
              await window.tutorialAPI.store.set(
                'localPluginsPath',
                currentPluginsPath,
              );
            }

            const modsPathResult = await window.tutorialAPI.joinPath(
              sdDrive,
              'ultimate',
              'mods',
            );
            if (!modsPathResult.success) {
              throw new Error('Failed to construct Switch mods path');
            }
            await window.tutorialAPI.createDirectory(modsPathResult.path);
            await window.tutorialAPI.store.set('modsPath', modsPathResult.path);

            const pluginsPathResult = await window.tutorialAPI.joinPath(
              sdDrive,
              'atmosphere',
              'contents',
              '01006A800016E000',
              'romfs',
              'skyline',
              'plugins',
            );
            if (pluginsPathResult.success) {
              await window.tutorialAPI.createDirectory(pluginsPathResult.path);
              await window.tutorialAPI.store.set(
                'pluginsPath',
                pluginsPathResult.path,
              );
            }

            if (status) {
              showSelectedSdDrive(sdDrive);
            }
          } else {
            const localModsPath = (await apiWrapper.storeGet(
              'localModsPath',
            )) as string | null;
            const localPluginsPath = (await apiWrapper.storeGet(
              'localPluginsPath',
            )) as string | null;

            if (localModsPath) {
              await window.tutorialAPI.store.set('modsPath', localModsPath);
            }
            if (localPluginsPath) {
              await window.tutorialAPI.store.set(
                'pluginsPath',
                localPluginsPath,
              );
            }

            if (status) {
              status.innerHTML = `
                <div class="tutorial-library-next">
                  Next, choose the local folder where MOSAIC should keep your mod library.
                </div>
              `;
            }
          }

          enableNext();
          await renderProgressDots();
        };

        const savedMode = await getHardwareLibraryMode();
        if (savedMode === 'local' || savedMode === 'direct') {
          const radio = document.querySelector<HTMLInputElement>(
            `input[name="hardware-library-mode"][value="${savedMode}"]`,
          );
          if (radio) {
            radio.checked = true;
            await configureMode(savedMode);
          }
        }

        radios.forEach((radio) => {
          radio.addEventListener('change', async () => {
            if (radio.checked) {
              const mode = radio.value === 'direct' ? 'direct' : 'local';
              await configureMode(mode, {
                requireSdSelection: mode === 'direct',
              });
            }
          });
        });
      },
    },
    {
      icon: 'bi-laptop',
      title: 'Emulator Selection',
      description: 'Choose your emulator',
      content: `
<div class="tutorial-center">
    <h3 class="tutorial-status-title">Which Emulator?</h3>
    <p class="tutorial-lead-lg">Select the emulator you're using.</p>
    
    <div class="tutorial-options-compact">
        <button id="yuzu-btn" class="tutorial-emulator-btn">
            <i class="bi bi-controller tutorial-emulator-icon"></i>
            <strong class="tutorial-label">Yuzu</strong>
            <span class="tutorial-emulator-note">(or forks)</span>
        </button>
        <button id="ryujinx-btn" class="tutorial-emulator-btn">
            <i class="bi bi-controller tutorial-emulator-icon"></i>
            <strong class="tutorial-label">Ryujinx</strong>
            <span class="tutorial-emulator-note">(or forks)</span>
        </button>
    </div>
</div>
`,
      onRender: async () => {
        const nextBtn = document.querySelector<HTMLElement>('#next-btn');
        const yuzuBtn = document.querySelector<HTMLElement>('#yuzu-btn');
        const ryujinxBtn = document.querySelector<HTMLElement>('#ryujinx-btn');

        if (nextBtn) {
          nextBtn.style.opacity = '0.5';
          nextBtn.style.pointerEvents = 'none';
        }

        yuzuBtn!.addEventListener('click', async () => {
          await window.tutorialAPI.store.set('tutorial.emulatorType', 'yuzu');
          yuzuBtn!.style.background = 'rgba(76, 175, 80, 0.2)';
          yuzuBtn!.style.borderColor = 'rgba(76, 175, 80, 0.5)';
          ryujinxBtn!.style.background = 'rgba(122, 155, 255, 0.1)';
          ryujinxBtn!.style.borderColor = 'rgba(122, 155, 255, 0.3)';
          await renderProgressDots();
          if (nextBtn) {
            nextBtn.style.opacity = '1';
            nextBtn.style.pointerEvents = 'auto';
          }
        });

        ryujinxBtn!.addEventListener('click', async () => {
          await window.tutorialAPI.store.set(
            'tutorial.emulatorType',
            'ryujinx',
          );
          ryujinxBtn!.style.background = 'rgba(76, 175, 80, 0.2)';
          ryujinxBtn!.style.borderColor = 'rgba(76, 175, 80, 0.5)';
          yuzuBtn!.style.background = 'rgba(122, 155, 255, 0.1)';
          yuzuBtn!.style.borderColor = 'rgba(122, 155, 255, 0.3)';
          await renderProgressDots();
          if (nextBtn) {
            nextBtn.style.opacity = '1';
            nextBtn.style.pointerEvents = 'auto';
          }
        });

        const emulatorType = await window.tutorialAPI?.store.get(
          'tutorial.emulatorType',
        );
        if (emulatorType === 'yuzu') {
          yuzuBtn!.click();
        } else if (emulatorType === 'ryujinx') {
          ryujinxBtn!.click();
        }
      },
    },
    {
      icon: 'bi-folder',
      title: 'Yuzu Setup',
      description: 'Configure Yuzu paths and install ARCropolis',
      content: `
<div class="tutorial-center">
    <h3 class="tutorial-status-title">Yuzu Directory</h3>
    <p class="tutorial-lead-lg">We'll detect your Yuzu folder automatically, or you can select it manually.</p>
    
    <div id="yuzu-status" class="tutorial-status-list">
        <div class="tutorial-box">
            <div class="tutorial-row-between">
                <span class="tutorial-text-white">Detecting Yuzu path...</span>
                <div class="tutorial-spinner"></div>
            </div>
        </div>
    </div>
</div>
`,
      onRender: async () => {
        const statusDiv = document.querySelector<HTMLElement>('#yuzu-status');
        const nextBtn = document.querySelector<HTMLElement>('#next-btn');

        if (nextBtn) {
          nextBtn.style.opacity = '0.5';
          nextBtn.style.pointerEvents = 'none';
        }

        try {
          const result = await apiWrapper.detectYuzuPath();
          if (result.success && result.paths?.length > 1) {
            statusDiv!.innerHTML = `
                    <div class="tutorial-box-accent">
                        <p class="tutorial-result-text">Yuzu and Eden were detected. Which emulator do you want to configure?</p>
                        <div class="tutorial-actions">
                            ${result.paths
                              .map(
                                (candidate, index) => `
                                <button class="select-yuzu-compatible-btn tutorial-btn-compatible" data-index="${index}">
                                    ${candidate.name}
                                </button>`,
                              )
                              .join('')}
                        </div>
                    </div>
                `;

            document
              .querySelectorAll<HTMLElement>('.select-yuzu-compatible-btn')
              .forEach((button) => {
                button.addEventListener('click', async () => {
                  const candidate = result.paths[Number(button.dataset.index)];
                  if (!candidate) return;

                  await window.tutorialAPI.store.set(
                    'tutorial.yuzuPath',
                    candidate.path,
                  );
                  statusDiv!.innerHTML = `
                            <div class="tutorial-box-success">
                                <div class="tutorial-row">
                                    <i class="bi bi-check-circle-fill tutorial-icon-success"></i>
                                    <div>
                                        <strong class="tutorial-label">${candidate.name} selected</strong>
                                        <span class="tutorial-path">${candidate.path}</span>
                                    </div>
                                </div>
                            </div>
                        `;
                  if (nextBtn) {
                    nextBtn.style.opacity = '1';
                    nextBtn.style.pointerEvents = 'auto';
                  }
                });
              });
            return;
          }

          if (result.success && result.path) {
            await window.tutorialAPI.store.set(
              'tutorial.yuzuPath',
              result.path,
            );
            statusDiv!.innerHTML = `
                    <div class="tutorial-box-success">
                        <div class="tutorial-row-between-spaced">
                            <div class="tutorial-row">
                                <i class="bi bi-check-circle-fill tutorial-icon-success"></i>
                                <div>
                                    <strong class="tutorial-label">Yuzu Found</strong>
                                    <span class="tutorial-path">${result.path}</span>
                                </div>
                            </div>
                            <button id="wrong-yuzu-path-btn" class="tutorial-btn-warning">
                                Wrong path?
                            </button>
                        </div>
                    </div>
                `;

            document
              .querySelector<HTMLElement>('#wrong-yuzu-path-btn')
              ?.addEventListener('click', async () => {
                const path = await window.tutorialAPI.selectFolder();
                if (path) {
                  await window.tutorialAPI.store.set('tutorial.yuzuPath', path);
                  statusDiv!.innerHTML = `
                            <div class="tutorial-box-success">
                                <div class="tutorial-row-between">
                                    <div class="tutorial-row">
                                        <i class="bi bi-check-circle-fill tutorial-icon-success"></i>
                                        <div>
                                            <strong class="tutorial-label">Selected: ${path}</strong>
                                        </div>
                                    </div>
                                    <button id="wrong-yuzu-path-btn-2" class="tutorial-btn-warning-plain">
                                        Wrong path?
                                    </button>
                                </div>
                            </div>
                        `;
                  void warnIfEmulatorExe(statusDiv!, path, 'sdmc');
                  document
                    .querySelector<HTMLElement>('#wrong-yuzu-path-btn-2')
                    ?.addEventListener('click', async () => {
                      const path2 = await window.tutorialAPI.selectFolder();
                      if (path2) {
                        await window.tutorialAPI.store.set(
                          'tutorial.yuzuPath',
                          path2,
                        );
                        statusDiv!.innerHTML = `
                                    <div class="tutorial-box-success">
                                        <div class="tutorial-row">
                                            <i class="bi bi-check-circle-fill tutorial-icon-success"></i>
                                            <div>
                                                <strong class="tutorial-label">Selected: ${path2}</strong>
                                            </div>
                                        </div>
                                    </div>
                                `;
                        void warnIfEmulatorExe(statusDiv!, path2, 'sdmc');
                      }
                    });
                }
              });

            if (nextBtn) {
              nextBtn.style.opacity = '1';
              nextBtn.style.pointerEvents = 'auto';
            }
          } else {
            statusDiv!.innerHTML = `
                    <div class="tutorial-box-warning">
                        <p class="tutorial-text-warning">Yuzu path not detected automatically.</p>
                        <p class="tutorial-hint">Please open Yuzu, go to <strong class="tutorial-text-white">File > Open yuzu folder</strong>, then copy the path and select it below.</p>
                        <button id="select-yuzu-btn" class="tutorial-btn-accent-block">
                            Select Yuzu Folder
                        </button>
                    </div>
                `;
            document
              .querySelector<HTMLElement>('#select-yuzu-btn')
              ?.addEventListener('click', async () => {
                const path = await window.tutorialAPI.selectFolder();
                if (path) {
                  await window.tutorialAPI.store.set('tutorial.yuzuPath', path);
                  statusDiv!.innerHTML = `
                            <div class="tutorial-box-success">
                                <div class="tutorial-row">
                                    <i class="bi bi-check-circle-fill tutorial-icon-success"></i>
                                    <div>
                                        <strong class="tutorial-label">Selected: ${path}</strong>
                                    </div>
                                </div>
                            </div>
                        `;
                  void warnIfEmulatorExe(statusDiv!, path, 'sdmc');
                  if (nextBtn) {
                    nextBtn.style.opacity = '1';
                    nextBtn.style.pointerEvents = 'auto';
                  }
                }
              });
          }
        } catch (error) {
          console.error('Error detecting Yuzu:', error);
          statusDiv!.innerHTML =
            '<div class="tutorial-text-error">Error detecting Yuzu. Please select manually.</div>';
        }
      },
    },
    {
      icon: 'bi-download',
      title: 'Installing Skyline & ARCropolis (Yuzu)',
      description:
        'Downloading and installing Skyline (exefs) and ARCropolis (romfs) for Yuzu',
      content: `
<div class="tutorial-center">
    <h3 class="tutorial-status-title">Installing ARCropolis</h3>
    <div id="yuzu-install-status" class="tutorial-status-list">
        <div class="tutorial-box">
            <div class="tutorial-text-white">Preparing installation...</div>
        </div>
    </div>
</div>
`,
      onRender: () =>
        runArcropolisInstallStep({
          statusSelector: '#yuzu-install-status',
          pathKey: 'tutorial.yuzuPath',
          missingPathMessage:
            'Yuzu path not found. Please go back and select your Yuzu folder.',
          dataFolder: 'sdmc',
          extraDirs: [['ultimate', 'mods']],
        }),
    },
    {
      icon: 'bi-controller',
      title: 'Verify ARCropolis (Yuzu)',
      description: 'Launch the game and verify installation',
      content: `
<div class="tutorial-center">
    <h3 class="tutorial-status-title">Verify Installation</h3>
    <p class="tutorial-lead-md">Please launch Smash Ultimate in Yuzu and check if ARCropolis is working.</p>
    
    <div class="tutorial-lottie-frame">
        <div id="arcropolis-lottie-yuzu" class="tutorial-lottie"></div>
        <div class="scroll-indicator tutorial-scroll-indicator">
            <i class="bi bi-chevron-down tutorial-scroll-indicator-icon"></i>
        </div>
        <style>
            @keyframes bounce-side {
                0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
                40% { transform: translateY(10px); }
                60% { transform: translateY(5px); }
            }
        </style>
    </div>
    
    <div class="tutorial-box-warning-panel">
        <p class="tutorial-warning-title">
            <i class="bi bi-info-circle-fill"></i> What to look for:
        </p>
        <ul class="tutorial-steps-list">
            <li>Launch Super Smash Bros. Ultimate in Yuzu</li>
            <li>Look for <strong class="tutorial-text-white">ARCropolis version text</strong> in the <strong class="tutorial-text-white">top-right corner</strong></li>
            <li>If you see it, ARCropolis is working!</li>
        </ul>
    </div>
    
    
    
    <div id="yuzu-verification-status" class="tutorial-verification">
        <p class="tutorial-lead">Did you see the ARCropolis text?</p>
        <div class="tutorial-actions">
            <button id="yuzu-verify-yes-btn" class="tutorial-btn-yes">
                Yes, it's working!
            </button>
            <button id="yuzu-verify-no-btn" class="tutorial-btn-no">
                No, not working
            </button>
        </div>
    </div>
</div>
`,
      onRender: async () => {
        const nextBtn = document.querySelector<HTMLElement>('#next-btn');
        const verifyYesBtn = document.querySelector<HTMLElement>(
          '#yuzu-verify-yes-btn',
        );
        const verifyNoBtn = document.querySelector<HTMLElement>(
          '#yuzu-verify-no-btn',
        );
        const lottieContainer = document.querySelector<HTMLElement>(
          '#arcropolis-lottie-yuzu',
        );

        if (lottieContainer && window.lottie) {
          try {
            const anim = window.lottie.loadAnimation({
              container: lottieContainer,
              renderer: 'svg',
              loop: true,
              autoplay: true,
              path: '../images/tutorial-arcropolisPC.json',
            });
          } catch (e) {
            console.error('Failed to load Lottie animation:', e);
          }
        }

        if (nextBtn) {
          nextBtn.style.opacity = '0.5';
          nextBtn.style.pointerEvents = 'none';
        }

        verifyYesBtn?.addEventListener('click', async () => {
          await window.tutorialAPI.store.set(
            'tutorial.arcropolisVerified',
            true,
          );

          const yuzuPath = (await apiWrapper.storeGet(
            'tutorial.yuzuPath',
          )) as string;

          const ultimatePathResult = await window.tutorialAPI.joinPath(
            yuzuPath,
            'sdmc',
            'ultimate',
          );

          if (!ultimatePathResult.success)
            throw new Error('Failed to construct ultimate path');

          const ultimatePath = ultimatePathResult.path;
          const arcropolisExists =
            await window.tutorialAPI.checkArcropolisFolder(ultimatePath);

          if (!arcropolisExists) {
            const statusDiv = document.querySelector<HTMLElement>(
              '#yuzu-verification-status',
            );
            statusDiv!.innerHTML = `
                    <div class="tutorial-box-warning-center">
                        <p class="tutorial-text-warning-tight">ARCropolis folder not found. Please close the game and restart it to create the folder.</p>
                    </div>
                `;
            return;
          }

          const modsPathResult = await window.tutorialAPI.joinPath(
            yuzuPath,
            'sdmc',
            'ultimate',
            'mods',
          );
          if (!modsPathResult.success)
            throw new Error('Failed to construct mods path');
          const pluginsPathResult = await window.tutorialAPI.joinPath(
            yuzuPath,
            'sdmc',
            'atmosphere',
            'contents',
            '01006A800016E000',
            'romfs',
            'skyline',
            'plugins',
          );
          if (!pluginsPathResult.success)
            throw new Error('Failed to construct plugins path');
          await window.tutorialAPI.store.set('modsPath', modsPathResult.path);
          await window.tutorialAPI.store.set(
            'pluginsPath',
            pluginsPathResult.path,
          );

          const statusDiv = document.querySelector<HTMLElement>(
            '#yuzu-verification-status',
          );
          statusDiv!.innerHTML = `
                <div class="tutorial-box-success-center">
                    <i class="bi bi-check-circle-fill tutorial-icon-success-lg"></i>
                    <p class="tutorial-result-text">Perfect! ARCropolis is working and paths are configured.</p>
                    <p class="tutorial-note">Please <strong class="tutorial-text-white">close the game</strong> before continuing.</p>
                </div>
            `;
          if (nextBtn) {
            nextBtn.style.opacity = '1';
            nextBtn.style.pointerEvents = 'auto';
          }
        });

        verifyNoBtn?.addEventListener('click', () => {
          const statusDiv = document.querySelector<HTMLElement>(
            '#yuzu-verification-status',
          );
          statusDiv!.innerHTML = `
                <div class="tutorial-box-error-center">
                    <i class="bi bi-exclamation-triangle-fill tutorial-icon-error-lg"></i>
                    <p class="tutorial-result-text">ARCropolis is not working.</p>
                    <p class="tutorial-hint">Please join the <a href="https://discord.gg/2zT5Rg46bG" target="_blank" class="tutorial-link">MOSAIC Discord</a> for assistance.</p>
                    <button id="change-answer-yuzu-btn" class="tutorial-btn-accent">
                        Change my answer
                    </button>
                </div>
            `;
          setupDiscordLinks(statusDiv!);
          const changeAnswerBtn = document.querySelector<HTMLElement>(
            '#change-answer-yuzu-btn',
          );
          changeAnswerBtn?.addEventListener('click', async () => {
            currentStep = steps.findIndex(
              (s) => s.title === 'Installing Skyline & ARCropolis (Yuzu)',
            );
            await renderProgressDots();
            renderStep(currentStep);
          });
          if (nextBtn) {
            nextBtn.style.opacity = '1';
            nextBtn.style.pointerEvents = 'auto';
          }
        });
      },
    },
    {
      icon: 'bi-folder',
      title: 'Ryujinx Setup',
      description: 'Configure Ryujinx paths and install ARCropolis',
      content: `
<div class="tutorial-center">
    <h3 class="tutorial-status-title">Ryujinx Directory</h3>
    <p class="tutorial-lead-lg">We'll detect your Ryujinx folder automatically, or you can select it manually.</p>
    
    <div id="ryujinx-status" class="tutorial-status-list">
        <div class="tutorial-box">
            <div class="tutorial-row-between">
                <span class="tutorial-text-white">Detecting Ryujinx path...</span>
                <div class="tutorial-spinner"></div>
            </div>
        </div>
    </div>
</div>
`,
      onRender: async () => {
        const statusDiv =
          document.querySelector<HTMLElement>('#ryujinx-status');
        const nextBtn = document.querySelector<HTMLElement>('#next-btn');

        if (nextBtn) {
          nextBtn.style.opacity = '0.5';
          nextBtn.style.pointerEvents = 'none';
        }

        try {
          const result = await apiWrapper.detectRyujinxPath();
          if (result.success && result.path) {
            await window.tutorialAPI.store.set(
              'tutorial.ryujinxPath',
              result.path,
            );
            statusDiv!.innerHTML = `
                    <div class="tutorial-box-success">
                        <div class="tutorial-row-between-spaced">
                            <div class="tutorial-row">
                                <i class="bi bi-check-circle-fill tutorial-icon-success"></i>
                                <div>
                                    <strong class="tutorial-label">Ryujinx Found</strong>
                                    <span class="tutorial-path">${result.path}</span>
                                </div>
                            </div>
                            <button id="wrong-ryujinx-path-btn" class="tutorial-btn-warning">
                                Wrong path?
                            </button>
                        </div>
                    </div>
                `;

            document
              .querySelector<HTMLElement>('#wrong-ryujinx-path-btn')
              ?.addEventListener('click', async () => {
                const path = await window.tutorialAPI.selectFolder();
                if (path) {
                  await window.tutorialAPI.store.set(
                    'tutorial.ryujinxPath',
                    path,
                  );
                  statusDiv!.innerHTML = `
                            <div class="tutorial-box-success">
                                <div class="tutorial-row-between">
                                    <div class="tutorial-row">
                                        <i class="bi bi-check-circle-fill tutorial-icon-success"></i>
                                        <div>
                                            <strong class="tutorial-label">Selected: ${path}</strong>
                                        </div>
                                    </div>
                                    <button id="wrong-ryujinx-path-btn-2" class="tutorial-btn-warning-plain">
                                        Wrong path?
                                    </button>
                                </div>
                            </div>
                        `;
                  void warnIfEmulatorExe(statusDiv!, path, 'sdcard');
                  document
                    .querySelector<HTMLElement>('#wrong-ryujinx-path-btn-2')
                    ?.addEventListener('click', async () => {
                      const path2 = await window.tutorialAPI.selectFolder();
                      if (path2) {
                        await window.tutorialAPI.store.set(
                          'tutorial.ryujinxPath',
                          path2,
                        );
                        statusDiv!.innerHTML = `
                                    <div class="tutorial-box-success">
                                        <div class="tutorial-row">
                                            <i class="bi bi-check-circle-fill tutorial-icon-success"></i>
                                            <div>
                                                <strong class="tutorial-label">Selected: ${path2}</strong>
                                            </div>
                                        </div>
                                    </div>
                                `;
                        void warnIfEmulatorExe(statusDiv!, path2, 'sdcard');
                      }
                    });
                }
              });

            if (nextBtn) {
              nextBtn.style.opacity = '1';
              nextBtn.style.pointerEvents = 'auto';
            }
          } else {
            statusDiv!.innerHTML = `
                    <div class="tutorial-box-warning">
                        <p class="tutorial-text-warning">Ryujinx path not detected automatically.</p>
                        <p class="tutorial-hint">Please open Ryujinx, go to <strong class="tutorial-text-white">File > Open Ryujinx folder</strong>, then copy the path and select it below.</p>
                        <button id="select-ryujinx-btn" class="tutorial-btn-accent-block">
                            Select Ryujinx Folder
                        </button>
                    </div>
                `;
            document
              .querySelector<HTMLElement>('#select-ryujinx-btn')
              ?.addEventListener('click', async () => {
                const path = await window.tutorialAPI.selectFolder();
                if (path) {
                  await window.tutorialAPI.store.set(
                    'tutorial.ryujinxPath',
                    path,
                  );
                  statusDiv!.innerHTML = `
                            <div class="tutorial-box-success">
                                <div class="tutorial-row">
                                    <i class="bi bi-check-circle-fill tutorial-icon-success"></i>
                                    <div>
                                        <strong class="tutorial-label">Selected: ${path}</strong>
                                    </div>
                                </div>
                            </div>
                        `;
                  void warnIfEmulatorExe(statusDiv!, path, 'sdcard');
                  if (nextBtn) {
                    nextBtn.style.opacity = '1';
                    nextBtn.style.pointerEvents = 'auto';
                  }
                }
              });
          }
        } catch (error) {
          console.error('Error detecting Ryujinx:', error);
          statusDiv!.innerHTML =
            '<div class="tutorial-text-error">Error detecting Ryujinx. Please select manually.</div>';
        }
      },
    },
    {
      icon: 'bi-download',
      title: 'Installing Skyline & ARCropolis (Ryujinx)',
      description:
        'Downloading and installing Skyline (exefs) and ARCropolis (romfs) for Ryujinx',
      content: `
<div class="tutorial-center">
    <h3 class="tutorial-status-title">Installing ARCropolis</h3>
    <div id="ryujinx-install-status" class="tutorial-status-list">
        <div class="tutorial-box">
            <div class="tutorial-text-white">Preparing installation...</div>
        </div>
    </div>
</div>
`,
      onRender: () =>
        runArcropolisInstallStep({
          statusSelector: '#ryujinx-install-status',
          pathKey: 'tutorial.ryujinxPath',
          missingPathMessage:
            'Ryujinx path not found. Please go back and select your Ryujinx folder.',
          dataFolder: 'sdcard',
          extraDirs: [[...ARCROPOLIS_CONTENTS_PATH, 'romfs', 'skyline', 'plugins']],
        }),
    },
    {
      icon: 'bi-controller',
      title: 'Verify ARCropolis (Ryujinx)',
      description: 'Launch the game and verify installation',
      content: `
<div class="tutorial-center">
    <h3 class="tutorial-status-title">Verify Installation</h3>
    <p class="tutorial-lead-md">Please launch Smash Ultimate in Ryujinx and check if ARCropolis is working.</p>
    
    <div class="tutorial-lottie-frame">
        <div id="arcropolis-lottie-ryujinx" class="tutorial-lottie"></div>
        <div class="scroll-indicator tutorial-scroll-indicator">
            <i class="bi bi-chevron-down tutorial-scroll-indicator-icon"></i>
        </div>
        <style>
            @keyframes bounce-side {
                0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
                40% { transform: translateY(10px); }
                60% { transform: translateY(5px); }
            }
        </style>
    </div>
    
    <div class="tutorial-box-warning-panel">
        <p class="tutorial-warning-title">
            <i class="bi bi-info-circle-fill"></i> What to look for:
        </p>
        <ul class="tutorial-steps-list">
            <li>Launch Super Smash Bros. Ultimate in Ryujinx</li>
            <li>Look for <strong class="tutorial-text-white">ARCropolis version text</strong> in the <strong class="tutorial-text-white">top-right corner</strong></li>
            <li>If you see it, ARCropolis is working!</li>
        </ul>
    </div>
    
    
    
    <div id="ryujinx-verification-status" class="tutorial-verification">
        <p class="tutorial-lead">Did you see the ARCropolis text?</p>
        <div class="tutorial-actions">
            <button id="ryujinx-verify-yes-btn" class="tutorial-btn-yes">
                Yes, it's working!
            </button>
            <button id="ryujinx-verify-no-btn" class="tutorial-btn-no">
                No, not working
            </button>
        </div>
    </div>
</div>
`,
      onRender: async () => {
        const nextBtn = document.querySelector<HTMLElement>('#next-btn');
        const verifyYesBtn = document.querySelector<HTMLElement>(
          '#ryujinx-verify-yes-btn',
        );
        const verifyNoBtn = document.querySelector<HTMLElement>(
          '#ryujinx-verify-no-btn',
        );
        const lottieContainer = document.querySelector<HTMLElement>(
          '#arcropolis-lottie-ryujinx',
        );

        if (lottieContainer && window.lottie) {
          try {
            const anim = window.lottie.loadAnimation({
              container: lottieContainer,
              renderer: 'svg',
              loop: true,
              autoplay: true,
              path: '../images/tutorial-arcropolisPC.json',
            });
          } catch (e) {
            console.error('Failed to load Lottie animation:', e);
          }
        }

        if (nextBtn) {
          nextBtn.style.opacity = '0.5';
          nextBtn.style.pointerEvents = 'none';
        }

        verifyYesBtn?.addEventListener('click', async () => {
          await window.tutorialAPI.store.set(
            'tutorial.arcropolisVerified',
            true,
          );

          const ryujinxPath = (await apiWrapper.storeGet(
            'tutorial.ryujinxPath',
          )) as string;

          const modsPathResult = await window.tutorialAPI.joinPath(
            ryujinxPath,
            'sdcard',
            'ultimate',
            'mods',
          );

          if (!modsPathResult.success)
            throw new Error('Failed to construct mods path');

          const pluginsPathResult = await window.tutorialAPI.joinPath(
            ryujinxPath,
            'sdcard',
            'atmosphere',
            'contents',
            '01006A800016E000',
            'romfs',
            'skyline',
            'plugins',
          );
          if (!pluginsPathResult.success)
            throw new Error('Failed to construct plugins path');
          await window.tutorialAPI.store.set('modsPath', modsPathResult.path);
          await window.tutorialAPI.store.set(
            'pluginsPath',
            pluginsPathResult.path,
          );

          const statusDiv = document.querySelector<HTMLElement>(
            '#ryujinx-verification-status',
          );
          statusDiv!.innerHTML = `
                <div class="tutorial-box-success-center">
                    <i class="bi bi-check-circle-fill tutorial-icon-success-lg"></i>
                    <p class="tutorial-result-text">Perfect! ARCropolis is working and paths are configured.</p>
                    <p class="tutorial-note">Please <strong class="tutorial-text-white">close the game</strong> before continuing.</p>
                </div>
            `;
          if (nextBtn) {
            nextBtn.style.opacity = '1';
            nextBtn.style.pointerEvents = 'auto';
          }
        });

        verifyNoBtn?.addEventListener('click', () => {
          const statusDiv = document.querySelector<HTMLElement>(
            '#ryujinx-verification-status',
          );
          statusDiv!.innerHTML = `
                <div class="tutorial-box-error-center">
                    <i class="bi bi-exclamation-triangle-fill tutorial-icon-error-lg"></i>
                    <p class="tutorial-result-text">ARCropolis is not working.</p>
                    <p class="tutorial-hint">Please join the <a href="https://discord.gg/2zT5Rg46bG" target="_blank" class="tutorial-link">MOSAIC Discord</a> for assistance.</p>
                    <button id="change-answer-ryujinx-btn" class="tutorial-btn-accent">
                        Change my answer
                    </button>
                </div>
            `;
          setupDiscordLinks(statusDiv!);
          const changeAnswerBtn = document.querySelector<HTMLElement>(
            '#change-answer-ryujinx-btn',
          );
          changeAnswerBtn?.addEventListener('click', async () => {
            currentStep = steps.findIndex(
              (s) => s.title === 'Installing Skyline & ARCropolis (Ryujinx)',
            );
            await renderProgressDots();
            renderStep(currentStep);
          });
          if (nextBtn) {
            nextBtn.style.opacity = '1';
            nextBtn.style.pointerEvents = 'auto';
          }
        });
      },
    },
    {
      icon: 'bi-folder2-open',
      title: 'Configure Your Paths',
      description: 'Point MOSAIC to your mods folder',
      content: `
<div class="tutorial-center">
    <h3 class="tutorial-status-title">Where are your mods?</h3>
    <p class="tutorial-lead-lg" id="mods-path-description">Select the folder where you keep your Ultimate mods.</p>
    
    <div class="tutorial-stack-lg">
        <div class="tutorial-box">
            <div class="tutorial-row-between-spaced">
                <div class="tutorial-row">
                    <div class="tutorial-step-number">1</div>
                    <strong class="tutorial-text-white">Mods Path</strong>
                </div>
                <button id="select-mods-path-btn" class="tutorial-btn-small tutorial-btn-browse">
                    Browse...
                </button>
            </div>
            <div id="mods-path-display" class="tutorial-path-display">
                <i class="bi bi-folder tutorial-dim"></i> <span class="path-text tutorial-ellipsis">Not configured</span>
            </div>
        </div>

        <div class="tutorial-box">
            <div class="tutorial-row-between-spaced">
                <div class="tutorial-row">
                    <div class="tutorial-step-number">2</div>
                    <strong class="tutorial-text-white">Plugins Path</strong>
                </div>
                <button id="select-plugins-path-btn" class="tutorial-btn-small tutorial-btn-browse">
                    Browse...
                </button>
            </div>
            <div id="plugins-path-display" class="tutorial-path-display">
                <i class="bi bi-folder tutorial-dim"></i> <span class="path-text tutorial-ellipsis">Not configured</span>
            </div>
        </div>
    </div>
    
    <div class="tutorial-plugins-note">
        <i class="bi bi-info-circle-fill tutorial-plugins-note-icon"></i>
        <span class="tutorial-plugins-note-text">Select the plugins folder inside the same ARCropolis installation. You can change both paths later in Settings.</span>
    </div>
</div>
`,
      onRender: async () => {
        const btn = document.querySelector<HTMLElement>(
          '#select-mods-path-btn',
        );
        const pluginsBtn = document.querySelector<HTMLElement>(
          '#select-plugins-path-btn',
        );
        const display = document.querySelector<HTMLElement>(
          '#mods-path-display .path-text',
        );
        const pluginsDisplay = document.querySelector<HTMLElement>(
          '#plugins-path-display .path-text',
        );
        const nextBtn = document.querySelector<HTMLElement>('#next-btn');
        const description = document.querySelector<HTMLElement>(
          '#mods-path-description',
        );
        let hasModsPath = false;
        let hasPluginsPath = false;
        let pathsSetByMosaic = false;

        const confirmPathChange = (): Promise<boolean> =>
          new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.style.cssText =
              'position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6); display: flex; align-items: center; justify-content: center; z-index: 10000;';
            overlay.innerHTML = `
<div class="tutorial-path-dialog">
    <div class="tutorial-path-dialog-header">
        <i class="bi bi-exclamation-triangle-fill tutorial-icon-warning"></i>
        <strong class="tutorial-text-white-md">Change this path?</strong>
    </div>
    <p class="tutorial-path-dialog-text">
        MOSAIC installed ARCropolis and already set these paths for you. If you change them, your mods and plugins may not load in game. Only change them if you know what you are doing.
    </p>
    <div class="tutorial-path-dialog-actions">
        <button data-action="cancel" class="tutorial-path-dialog-keep">Keep current path</button>
        <button data-action="confirm" class="tutorial-path-dialog-change">Change anyway</button>
    </div>
</div>`;
            const close = (result: boolean) => {
              overlay.remove();
              resolve(result);
            };
            overlay.addEventListener('click', (e) => {
              const action = (e.target as HTMLElement).dataset.action;
              if (action === 'confirm') close(true);
              else if (action === 'cancel' || e.target === overlay) close(false);
            });
            document.body.appendChild(overlay);
          });

        const updateNextButton = () => {
          if (!nextBtn) return;
          const pathsConfigured = hasModsPath && hasPluginsPath;
          nextBtn.style.opacity = pathsConfigured ? '1' : '0.5';
          nextBtn.style.pointerEvents = pathsConfigured ? 'auto' : 'none';
          nextBtn.style.cursor = pathsConfigured ? 'pointer' : 'not-allowed';
        };

        const showConfiguredPath = (
          path: string,
          pathDisplay: HTMLElement | null,
          displaySelector: string,
        ) => {
          if (pathDisplay) {
            pathDisplay.textContent = path;
            pathDisplay.style.color = '#fff';
          }
          const icon = document.querySelector<HTMLElement>(displaySelector);
          if (icon) {
            icon.className = 'bi bi-check-circle-fill';
            icon.style.color = '#4caf50';
            icon.style.opacity = '1';
          }
        };

        if (description && window.tutorialAPI) {
          try {
            const hardwareType = await apiWrapper.storeGet(
              'tutorial.hardwareType',
            );
            if (hardwareType === 'hardware') {
              description.innerHTML =
                "Select the folder on your PC where you want to store mods. You'll be able to use FTP via the <strong style='color: #fff;'>Send To Switch</strong> button in the Downloads section to transfer mods to your Switch.";
            } else {
              description.textContent =
                'Select the folder where you keep your Ultimate mods (e.g., yuzu/sdmc/ultimate/mods or ryujinx/sdcard/ultimate/mods).';
            }
          } catch (e) {
            console.error('Error loading hardware type:', e);
          }
        }

        if (nextBtn) {
          nextBtn.style.opacity = '0.5';
          nextBtn.style.pointerEvents = 'none';
          nextBtn.style.cursor = 'not-allowed';
        }

        if (!window.tutorialAPI || !window.tutorialAPI.store.get) return;

        try {
          const [currentModsPath, currentPluginsPath] = await Promise.all([
            apiWrapper.storeGet('modsPath') as Promise<string | null>,
            apiWrapper.storeGet('pluginsPath') as Promise<string | null>,
          ]);

          if (currentModsPath) {
            hasModsPath = true;
            showConfiguredPath(
              currentModsPath,
              display,
              '#mods-path-display i',
            );
          }
          if (currentPluginsPath) {
            hasPluginsPath = true;
            showConfiguredPath(
              currentPluginsPath,
              pluginsDisplay,
              '#plugins-path-display i',
            );
          }
          const arcropolisInstalled = await apiWrapper.storeGet(
            'tutorial.arcropolisInstalled',
          );
          pathsSetByMosaic =
            arcropolisInstalled === false && hasModsPath && hasPluginsPath;
          updateNextButton();
        } catch (e) {
          console.error('Error loading settings:', e);
        }

        if (btn) {
          btn.addEventListener('click', async () => {
            try {
              if (pathsSetByMosaic && !(await confirmPathChange())) return;
              const path = await window.tutorialAPI.selectFolder();
              if (path) {
                await window.tutorialAPI.store.set('modsPath', path);

                hasModsPath = true;
                showConfiguredPath(path, display, '#mods-path-display i');

                btn.innerHTML = '<i class="bi bi-check"></i> Selected';
                btn.style.background = 'rgba(76, 175, 80, 0.2)';
                btn.style.color = '#4caf50';
                btn.style.borderColor = 'rgba(76, 175, 80, 0.3)';
                updateNextButton();
              }
            } catch (error) {
              console.error('Error selecting folder:', error);
            }
          });

          btn.addEventListener('mouseenter', () => {
            if (!btn.innerHTML.includes('Selected')) {
              btn.style.background = 'rgba(122, 155, 255, 0.3)';
            }
          });
          btn.addEventListener('mouseleave', () => {
            if (!btn.innerHTML.includes('Selected')) {
              btn.style.background = 'rgba(122, 155, 255, 0.2)';
            }
          });
        }

        if (pluginsBtn) {
          pluginsBtn.addEventListener('click', async () => {
            try {
              if (pathsSetByMosaic && !(await confirmPathChange())) return;
              const path = await window.tutorialAPI.selectFolder();
              if (path) {
                await window.tutorialAPI.store.set('pluginsPath', path);
                hasPluginsPath = true;
                showConfiguredPath(
                  path,
                  pluginsDisplay,
                  '#plugins-path-display i',
                );

                pluginsBtn.innerHTML = '<i class="bi bi-check"></i> Selected';
                pluginsBtn.style.background = 'rgba(76, 175, 80, 0.2)';
                pluginsBtn.style.color = '#4caf50';
                pluginsBtn.style.borderColor = 'rgba(76, 175, 80, 0.3)';
                updateNextButton();
              }
            } catch (error) {
              console.error('Error selecting plugins folder:', error);
            }
          });

          pluginsBtn.addEventListener('mouseenter', () => {
            if (!pluginsBtn.innerHTML.includes('Selected')) {
              pluginsBtn.style.background = 'rgba(122, 155, 255, 0.3)';
            }
          });
          pluginsBtn.addEventListener('mouseleave', () => {
            if (!pluginsBtn.innerHTML.includes('Selected')) {
              pluginsBtn.style.background = 'rgba(122, 155, 255, 0.2)';
            }
          });
        }
      },
    },
    {
      icon: 'bi-grid-3x3-gap',
      title: 'Manage Your Mods',
      description: 'Enable, disable, and organize your mods',
      content: `
<div class="tutorial-center">
    <h3 class="tutorial-status-title">Your mod list</h3>
    
    <div class="tutorial-stack">
        
        <div class="tutorial-tip-hover">
            <div class="tutorial-tip-icon-success">
                <i class="bi bi-toggle-on tutorial-tip-glyph-success"></i>
            </div>
            <div>
                <strong class="tutorial-tip-title">Toggle Mods</strong>
                <p class="tutorial-option-subtitle">Click the checkbox to enable/disable</p>
            </div>
        </div>
        
        <div class="tutorial-tip">
            <div class="tutorial-tip-icon-accent">
                <i class="bi bi-search tutorial-library-drive-icon"></i>
            </div>
            <div>
                <strong class="tutorial-tip-title">Search & Filter</strong>
                <p class="tutorial-option-subtitle">Find mods by name or category</p>
            </div>
        </div>
        
        <div class="tutorial-tip">
            <div class="tutorial-tip-icon-warning">
                <i class="bi bi-three-dots tutorial-tip-glyph-warning"></i>
            </div>
            <div>
                <strong class="tutorial-tip-title">Context Menu</strong>
                <p class="tutorial-option-subtitle">Right-click to rename, delete, etc.</p>
            </div>
        </div>

    </div>
</div>
`,
    },
    {
      icon: 'bi-download',
      title: 'GameBanana Integration',
      description: 'Install mods directly from your browser',
      content: `
<div class="tutorial-center">
    <h3 class="tutorial-status-title">One-click install</h3>
    <p class="tutorial-lead-xl">Click <strong class="tutorial-text-white">"Install with MOSAIC"</strong> on GameBanana.</p>
    
    <div class="tutorial-gb-demo">
        
        <!-- Fake GameBanana Button -->
        <div class="tutorial-gb-button">
            <img src="../images/logo.png" class="tutorial-gb-logo">
            <div class="tutorial-gb-label">
                <span class="tutorial-gb-brand">MOSAIC</span>
                <span class="tutorial-gb-action">1-CLICK INSTALL</span>
            </div>
        </div>

        <div class="tutorial-gb-arrow">
            <div class="tutorial-gb-arrow-line"></div>
            <div class="tutorial-gb-arrow-head">↓</div>
        </div>

        <div class="tutorial-gb-result">
            <div class="tutorial-gb-result-title">
                <i class="bi bi-check-circle-fill"></i> Automatic
            </div>
            <span class="tutorial-text-muted-sm">Downloads • Extracts • Installs</span>
        </div>
    </div>
    
    <p class="tutorial-gb-footnote">
        Info.toml and previews are handled for you automatically.
    </p>
</div>
`,
    },
    {
      icon: 'bi-check-circle-fill',
      title: "You're All Set",
      description: 'MOSAIC is ready to use',
      content: `
<div class="tutorial-center">
    <div class="tutorial-done-icon">
        <i class="bi bi-check-lg tutorial-hero-glyph-success"></i>
    </div>
    
    <h3 class="tutorial-done-title">Setup complete</h3>
    <p class="tutorial-done-text">
        You can install mods now. Everything you chose here can be changed later in Settings.
    </p>
    
    <div class="tutorial-done-grid">
        <div class="tutorial-tip-card">
            <strong class="tutorial-feature-title">Characters</strong>
            <span class="tutorial-feature-caption">Browse by fighter</span>
        </div>
        <div class="tutorial-tip-card">
            <strong class="tutorial-feature-title">Downloads</strong>
            <span class="tutorial-feature-caption">Track progress</span>
        </div>
    </div>
</div>
`,
    },
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

  function escapeTutorialHtml(value: unknown) {
    const element = document.createElement('div');
    element.textContent = value == null ? '' : String(value);
    return element.innerHTML;
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
        <div class="tutorial-error-title"><strong>Installation failed.</strong> ${escapeTutorialHtml(installationError.message)}</div>
        <div class="tutorial-error-actions">
          <button type="button" data-tutorial-error-details class="tutorial-error-details-btn">View error details</button>
          <button type="button" data-tutorial-install-retry class="tutorial-error-retry-btn"><i class="bi bi-arrow-clockwise"></i> Retry installation</button>
        </div>
        <pre data-tutorial-error-output hidden class="tutorial-error-details">${escapeTutorialHtml(details)}</pre>
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
${showResumeMessage ? `<p class="tutorial-resume-message" role="status">${escapeTutorialHtml(resumeMessage)}</p>` : ''}
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

  function removeDevOverrides() {}

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
      removeDevOverrides();
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
        removeDevOverrides();
        renderProgressDots().then(() => renderStep(currentStep));
      }
    }
  });
});
