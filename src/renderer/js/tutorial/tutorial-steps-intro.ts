function createTutorialIntroSteps(ctx: TutorialStepContext): TutorialStep[] {
  return [
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
            const hardwareType = await ctx.apiWrapper.storeGet(
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

            await ctx.renderProgressDots();
          }
        };

        hardwareRadios.forEach((radio) => {
          radio.addEventListener('change', checkAndSave);
        });

        checkAndSave();
      },
    },
  ];
}
