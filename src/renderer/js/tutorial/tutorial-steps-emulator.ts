function createTutorialEmulatorSteps(ctx: TutorialStepContext): TutorialStep[] {
  return [
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
          await ctx.renderProgressDots();
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
          await ctx.renderProgressDots();
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
          const result = await ctx.apiWrapper.detectYuzuPath();
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
                  void ctx.warnIfEmulatorExe(statusDiv!, path, 'sdmc');
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
                        void ctx.warnIfEmulatorExe(statusDiv!, path2, 'sdmc');
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
                  void ctx.warnIfEmulatorExe(statusDiv!, path, 'sdmc');
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
        ctx.runArcropolisInstallStep({
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

          const yuzuPath = (await ctx.apiWrapper.storeGet(
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
          ctx.setupDiscordLinks(statusDiv!);
          const changeAnswerBtn = document.querySelector<HTMLElement>(
            '#change-answer-yuzu-btn',
          );
          changeAnswerBtn?.addEventListener('click', async () => {
            ctx.currentStep = ctx.steps.findIndex(
              (s) => s.title === 'Installing Skyline & ARCropolis (Yuzu)',
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
          const result = await ctx.apiWrapper.detectRyujinxPath();
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
                  void ctx.warnIfEmulatorExe(statusDiv!, path, 'sdcard');
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
                        void ctx.warnIfEmulatorExe(statusDiv!, path2, 'sdcard');
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
                  void ctx.warnIfEmulatorExe(statusDiv!, path, 'sdcard');
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
        ctx.runArcropolisInstallStep({
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

          const ryujinxPath = (await ctx.apiWrapper.storeGet(
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
          ctx.setupDiscordLinks(statusDiv!);
          const changeAnswerBtn = document.querySelector<HTMLElement>(
            '#change-answer-ryujinx-btn',
          );
          changeAnswerBtn?.addEventListener('click', async () => {
            ctx.currentStep = ctx.steps.findIndex(
              (s) => s.title === 'Installing Skyline & ARCropolis (Ryujinx)',
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
  ];
}
