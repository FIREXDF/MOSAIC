function createTutorialFinishSteps(ctx: TutorialStepContext): TutorialStep[] {
  return [
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
            const hardwareType = await ctx.apiWrapper.storeGet(
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
            ctx.apiWrapper.storeGet('modsPath') as Promise<string | null>,
            ctx.apiWrapper.storeGet('pluginsPath') as Promise<string | null>,
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
          const arcropolisInstalled = await ctx.apiWrapper.storeGet(
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
}
