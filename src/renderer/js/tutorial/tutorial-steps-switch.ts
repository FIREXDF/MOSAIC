function createTutorialSwitchSteps(ctx: TutorialStepContext): TutorialStep[] {
  return [
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
          ctx.setupExternalLinks(helpDiv);
        };

        disableNext();

        if (window.tutorialAPI) {
          try {
            const switchModded = await ctx.apiWrapper.storeGet(
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

          await ctx.renderProgressDots();
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
            const arcropolisInstalled = await ctx.apiWrapper.storeGet(
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
            const result = await ctx.apiWrapper.detectSdDrives();
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
                    setTimeout(() => ctx.steps[ctx.currentStep].onRender!(), 1000);
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
        ctx.runArcropolisInstallStep({
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
          ctx.setupDiscordLinks(statusDiv!);
          const changeAnswerBtn =
            document.querySelector<HTMLElement>('#change-answer-btn');
          changeAnswerBtn?.addEventListener('click', async () => {
            ctx.currentStep = ctx.steps.findIndex(
              (s) => s.title === 'Installing Skyline & ARCropolis (Switch)',
            );
            await ctx.renderProgressDots();
            ctx.renderStep(ctx.currentStep);
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
          (await ctx.apiWrapper.storeGet('switchTransferMethod')) === 'ftp';
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
            const result = await ctx.apiWrapper.detectSdDrives();
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
            (await ctx.apiWrapper.storeGet('switchTransferMethod')) === 'ftp';
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
            ((await ctx.apiWrapper.storeGet('tutorial.sdDrive')) as
              | string
              | null) ||
            ((await ctx.apiWrapper.storeGet('switchDriveLetter')) as string | null);

          if (sdDrive) {
            await window.tutorialAPI.store.set('switchDriveLetter', sdDrive);
          }

          if (mode === 'direct') {
            if (options.requireSdSelection || !sdDrive) {
              void showSelectSdCardPrompt(sdDrive);
              return;
            }

            const currentModsPath = (await ctx.apiWrapper.storeGet('modsPath')) as
              | string
              | null;
            const currentPluginsPath = (await ctx.apiWrapper.storeGet(
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
            const localModsPath = (await ctx.apiWrapper.storeGet(
              'localModsPath',
            )) as string | null;
            const localPluginsPath = (await ctx.apiWrapper.storeGet(
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
          await ctx.renderProgressDots();
        };

        const savedMode = await ctx.getHardwareLibraryMode();
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
  ];
}
