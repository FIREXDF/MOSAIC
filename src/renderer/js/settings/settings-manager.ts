class SettingsManager {
  settings: any;
  initialized: boolean;
  tabSwitchingAttached: boolean;
  drivesLoaded: boolean;
  switchTabTimeout: any;
  readyPromise: Promise<void>;
  lastModsPathWarningPath: string | null;
  pathFixModalOpen: boolean;
  libraryLocaleListenerAttached: boolean;
  directLibraryPathsApplied: boolean | null;
  switchSettings: SettingsSwitchSection;
  librarySettings: SettingsLibrarySection;
  ignoredConflicts: SettingsIgnoredConflictsSection;
  maintenance: SettingsMaintenanceSection;
  developerSettings: SettingsDeveloperSection;

  constructor() {
    this.switchSettings = new SettingsSwitchSection(this);
    this.librarySettings = new SettingsLibrarySection(this);
    this.ignoredConflicts = new SettingsIgnoredConflictsSection(this);
    this.maintenance = new SettingsMaintenanceSection(this);
    this.developerSettings = new SettingsDeveloperSection(this);
    this.settings = {
      modsPath: null,
      pluginsPath: null,
      appRunMode: 'emulator',
      hardwareLibraryMode: 'local',
      localModsPath: null,
      localPluginsPath: null,
      directModsPath: null,
      directPluginsPath: null,
      primaryModsPath: null,
      secondaryModsPath: null,
      activeModsLibrary: 'primary',
      modsLibrarySwitcherEnabled: false,
      emulatorType: 'yuzu',
      emulatorPath: null,
      gamePath: null,
      emulatorFullscreen: false,
      switchIp: null,
      switchPort: '5000',
      switchFtpUser: null,
      switchFtpPassword: null,
      switchFtpPath: null,
      switchFtpModsPath: null,
      switchFtpPluginsPath: null,
      switchTransferMethod: 'none',
      switchSyncMode: 'quick',
      switchDriveLetter: null,
      conflictDetectionEnabled: true,
      nroLimitCheckEnabled: true,
      libraryPathValidationEnabled: true,
      conflictWhitelistPatterns: [],
      ignoredConflictPaths: [],
      autoCheckPluginUpdates: false,
      pluginUpdateIntroShown: false,
      autoDisableNewMods: false,
      disableAllModsOnDownload: false,
      autoUseGameBananaModName: false,
      reviewSlotChangesBeforeApply: true,
      cssUmcImagesEnabled: true,
      devMode: false,
      devShowModHash: false,
      theme: 'dark',
      sidebarPrideTabsEnabled: true,
      enhancedStatusBar: true,
      discordRpcEnabled: true,
      startupSplashEnabled: true,
      startupSplashSoundEnabled: true,
      startupSplashSoundPath: null,
      appSoundPaths: {},
      appSoundEnabled: {},
      checkDependenciesOnDiscoverDownload: true,
      hideNsfwDiscoverMods: true,
      showNsfwDiscoverPreviews: false,
    };
    this.initialized = false;
    this.tabSwitchingAttached = false;
    this.drivesLoaded = false;
    this.lastModsPathWarningPath = null;
    this.pathFixModalOpen = false;
    this.libraryLocaleListenerAttached = false;
    this.directLibraryPathsApplied = null;
    this.readyPromise = this.initSettings();
    this.initializeUI();
  }

  async initSettings() {
    this.settings = await this.loadSettings();
    this.librarySettings.applyHardwareLibraryModePaths();
    this.librarySettings.applyActiveModsLibraryPath();
    this.applyTheme(this.settings.theme);
    this.applySidebarPrideTabsSetting(this.settings.sidebarPrideTabsEnabled);
    this.applyAppSoundSettings();
    this.initialized = true;
    await window.electronAPI.store.set(
      'switchDriveLetter',
      this.settings.switchDriveLetter,
    );
    await window.electronAPI.store.set('modsPath', this.settings.modsPath);
    await window.electronAPI.store.set(
      'pluginsPath',
      this.settings.pluginsPath,
    );
    await window.electronAPI.store.set(
      'hardwareLibraryMode',
      this.settings.hardwareLibraryMode,
    );
    await window.electronAPI.store.set(
      'primaryModsPath',
      this.settings.primaryModsPath,
    );
    await window.electronAPI.store.set(
      'secondaryModsPath',
      this.settings.secondaryModsPath,
    );
    await window.electronAPI.store.set(
      'activeModsLibrary',
      this.settings.activeModsLibrary,
    );
    await window.electronAPI.store.set(
      'modsLibrarySwitcherEnabled',
      this.settings.modsLibrarySwitcherEnabled === true,
    );
    this.setupEventListeners();
    this.ignoredConflicts.renderIgnoredConflictPaths();
    await this.maintenance.showPendingConfigRestoreToast();
    setTimeout(() => {
      this.librarySettings.validateConfiguredLibraryPaths();
    }, 1200);
  }

  initializeUI() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.setupEventListeners();
      });
    } else {
      this.setupEventListeners();
    }
  }

  normalizeEmulatorType(emulatorType) {
    const normalized =
      typeof emulatorType === 'string' ? emulatorType.toLowerCase() : '';
    return normalized === 'ryujinx' ? 'ryujinx' : 'yuzu';
  }

  normalizeSwitchTransferMethod(transferMethod) {
    const normalized =
      typeof transferMethod === 'string' ? transferMethod.toLowerCase() : '';
    return ['ftp', 'drive', 'mtp'].includes(normalized) ? normalized : 'none';
  }

  normalizeSwitchSyncMode(syncMode) {
    return syncMode === 'full' ? 'full' : 'quick';
  }

  normalizeAppRunMode(appRunMode) {
    return appRunMode === 'hardware' ? 'hardware' : 'emulator';
  }

  normalizeHardwareLibraryMode(hardwareLibraryMode) {
    return hardwareLibraryMode === 'direct' ? 'direct' : 'local';
  }

  normalizeActiveModsLibrary(activeLibrary) {
    return activeLibrary === 'secondary' ? 'secondary' : 'primary';
  }

  initializeFeedbackUI() {
    const form = document.querySelector<HTMLFormElement>('#feedback-form');
    const typeInput =
      document.querySelector<HTMLSelectElement>('#feedback-type');
    const messageInput =
      document.querySelector<HTMLTextAreaElement>('#feedback-message');
    const contactInput =
      document.querySelector<HTMLInputElement>('#feedback-contact');
    const submitButton = document.querySelector<HTMLButtonElement>(
      '#feedback-submit-btn',
    );

    if (!form || form.dataset.listenerAttached) {
      return;
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const message = messageInput?.value.trim() || '';
      if (message.length < 10) {
        this.showToast(
          this.translate('toasts.feedbackMessageTooShort'),
          'error',
        );
        return;
      }

      const previousLabel = submitButton?.textContent || '';
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = this.translate('settings.feedbackSending');
      }

      try {
        const appInfo = await window.electronAPI?.getAppVersion?.();
        const result = await window.electronAPI?.submitFeedback?.({
          type: (typeInput?.value || 'feedback') as any,
          message,
          contact: contactInput?.value.trim() || null,
          appVersion: appInfo?.version || null,
          locale: window.i18n?.currentLocale || document.documentElement.lang,
          platform: navigator.platform,
        });

        if (result?.success) {
          form.reset();
          this.showToast(this.translate('toasts.feedbackSent'), 'success');
        } else {
          this.showToast(
            result?.error || this.translate('toasts.feedbackFailed'),
            'error',
          );
        }
      } catch (error) {
        console.error('Failed to submit feedback:', error);
        this.showToast(this.translate('toasts.feedbackFailed'), 'error');
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.innerHTML = `
            <i class="bi bi-send"></i>
            <span data-i18n="settings.feedbackSubmit">${escapeHtml(
              this.translate('settings.feedbackSubmit'),
            )}</span>
          `;
          if (!previousLabel) {
            submitButton.removeAttribute('aria-label');
          }
        }
      }
    });

    form.dataset.listenerAttached = 'true';
  }

  organizeSettingsLayout() {
    const moveSection = (sectionSelector: string, targetSelector: string) => {
      const anchor = document.querySelector<HTMLElement>(sectionSelector);
      const section = anchor?.closest<HTMLElement>('.settings-section');
      const target = document.querySelector<HTMLElement>(targetSelector);

      if (!section || !target || section.parentElement === target) {
        return;
      }

      target.appendChild(section);
    };

    [
      ['#theme-select', '#settings-interface-appearance'],
      ['#sidebar-pride-tabs-enabled', '#settings-interface-appearance'],
      ['#animation-preference', '#settings-interface-appearance'],
      ['#enhanced-status-bar-enabled', '#settings-interface-behavior'],
      ['#startup-splash-enabled', '#settings-audio-startup'],
      ['#app-sound-enabled-notification', '#settings-audio-events'],
      ['#check-updates-btn', '#settings-updates-app'],
      ['#auto-check-plugin-updates-enabled', '#settings-updates-plugins'],
      ['#hardware-library-mode-select', '#settings-switch-library'],
      ['#switch-transfer-method-select', '#settings-switch-connection'],
      ['#conflict-detection-enabled', '#settings-diagnostics-conflicts'],
      ['#clear-temp-files-btn', '#settings-diagnostics-maintenance'],
      ['#batch-testing-btn', '#settings-diagnostics-batch'],
      ['#discord-rpc-enabled', '#settings-interface-behavior'],
    ].forEach(([sectionSelector, targetSelector]) => {
      moveSection(sectionSelector, targetSelector);
    });

    document
      .querySelectorAll<HTMLElement>('.settings-group-title')
      .forEach((groupTitle) => {
        let nextElement = groupTitle.nextElementSibling as HTMLElement | null;
        let hasSection = false;

        while (
          nextElement &&
          !nextElement.classList.contains('settings-group-title') &&
          !nextElement.classList.contains('settings-tab-content')
        ) {
          if (
            nextElement.classList.contains('settings-section') ||
            nextElement.querySelector('.settings-section')
          ) {
            hasSection = true;
            break;
          }

          nextElement = nextElement.nextElementSibling as HTMLElement | null;
        }

        if (!hasSection) {
          groupTitle.remove();
        }
      });
  }

  setupEventListeners() {
    this.organizeSettingsLayout();
    this.initializeFeedbackUI();

    if (!this.tabSwitchingAttached) {
      document.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const tabButton = target.closest<HTMLElement>('.settings-tab-btn');

        if (tabButton) {
          const tabName = tabButton.dataset.settingsTab;
          this.switchSettingsTab(tabName);

          if (tabName === 'logs' && window.logsManager) {
            setTimeout(() => {
              window.logsManager.reinitialize();
            }, 200);
          }

          if (tabName === 'customization' && window.customizationManager) {
            setTimeout(() => {
              window.customizationManager.setupEventListeners();
            }, 200);
          }
        }
      });
      this.tabSwitchingAttached = true;
    }

    this.bindAppearanceSettings();
    this.librarySettings.bindLibrarySettings();
    this.maintenance.bindMaintenanceSettings();
    this.bindInstallAndDiscordSettings();
    this.switchSettings.bindSwitchSettings();
    this.bindValidationSettings();
    this.bindModBehaviorSettings();
    this.bindUpdateSettings();
    this.bindLanguageAndThemeSettings();
    this.bindRunModeSettings();
    this.bindEmulatorSettings();
    this.refreshSettingsUI();
    this.developerSettings.bindDeveloperSettings();
    this.bindDiscoverSettings();
  }

  bindAppearanceSettings() {
    const animationSelector = document.querySelector<HTMLElement>(
      '#animation-preference',
    );
    if (animationSelector && !animationSelector.dataset.listenerAttached) {
      animationSelector
        .querySelectorAll<HTMLElement>('.animation-option')
        .forEach((option) => {
          option.addEventListener('click', () => {
            const value = option.dataset.value;
            this.setAnimationPreference(value);

            animationSelector
              .querySelectorAll<HTMLElement>('.animation-option')
              .forEach((opt) => {
                opt.classList.remove('active');
              });
            option.classList.add('active');
          });
        });
      animationSelector.dataset.listenerAttached = 'true';
      this.loadAnimationPreference();
      this.loadAnimationPreference();
    }

    const startupSplashToggle = document.querySelector<HTMLInputElement>(
      '#startup-splash-enabled',
    );
    if (startupSplashToggle && !startupSplashToggle.dataset.listenerAttached) {
      startupSplashToggle.addEventListener('change', () => {
        this.settings.startupSplashEnabled = startupSplashToggle.checked;
        this.saveSettings();
        this.updateStartupSplashSoundUI();
      });
      startupSplashToggle.dataset.listenerAttached = 'true';
    }

    const startupSplashSoundToggle = document.querySelector<HTMLInputElement>(
      '#startup-splash-sound-enabled',
    );
    if (
      startupSplashSoundToggle &&
      !startupSplashSoundToggle.dataset.listenerAttached
    ) {
      startupSplashSoundToggle.addEventListener('change', () => {
        this.settings.startupSplashSoundEnabled =
          startupSplashSoundToggle.checked;
        this.saveSettings();
        this.updateStartupSplashSoundUI();
      });
      startupSplashSoundToggle.dataset.listenerAttached = 'true';
    }

    const startupSplashSoundFile = document.querySelector<HTMLInputElement>(
      '#startup-splash-sound-file',
    );
    const browseStartupSplashSound = document.querySelector<HTMLElement>(
      '#browse-startup-splash-sound',
    );
    if (
      startupSplashSoundFile &&
      browseStartupSplashSound &&
      !browseStartupSplashSound.dataset.listenerAttached
    ) {
      browseStartupSplashSound.addEventListener('click', () => {
        startupSplashSoundFile.value = '';
        startupSplashSoundFile.click();
      });
      browseStartupSplashSound.dataset.listenerAttached = 'true';
    }

    if (
      startupSplashSoundFile &&
      !startupSplashSoundFile.dataset.listenerAttached
    ) {
      startupSplashSoundFile.addEventListener('change', () => {
        const file = startupSplashSoundFile.files?.[0];
        if (!file) {
          return;
        }

        const filePath = window.electronAPI?.getPathForFile?.(file);
        if (!filePath) {
          window.toastManager?.error?.(
            'Unable to read the selected audio path',
          );
          return;
        }

        this.settings.startupSplashSoundPath = filePath;
        this.settings.startupSplashSoundEnabled = true;
        this.saveSettings();
        this.updateStartupSplashSoundUI();
      });
      startupSplashSoundFile.dataset.listenerAttached = 'true';
    }

    const resetStartupSplashSound = document.querySelector<HTMLElement>(
      '#reset-startup-splash-sound',
    );
    if (
      resetStartupSplashSound &&
      !resetStartupSplashSound.dataset.listenerAttached
    ) {
      resetStartupSplashSound.addEventListener('click', () => {
        this.settings.startupSplashSoundPath = null;
        this.saveSettings();
        this.updateStartupSplashSoundUI();
      });
      resetStartupSplashSound.dataset.listenerAttached = 'true';
    }

    document
      .querySelectorAll<HTMLElement>('.app-sound-browse')
      .forEach((button) => {
        if (button.dataset.listenerAttached) {
          return;
        }

        button.addEventListener('click', () => {
          const soundName = button.dataset.soundName;
          if (!soundName) {
            return;
          }

          const fileInput = document.querySelector<HTMLInputElement>(
            `#app-sound-file-${soundName}`,
          );
          if (!fileInput) {
            return;
          }

          fileInput.value = '';
          fileInput.click();
        });
        button.dataset.listenerAttached = 'true';
      });

    document
      .querySelectorAll<HTMLInputElement>('input[id^="app-sound-file-"]')
      .forEach((input) => {
        if (input.dataset.listenerAttached) {
          return;
        }

        input.addEventListener('change', () => {
          const soundName = input.dataset.soundName;
          const file = input.files?.[0];
          if (!soundName || !file) {
            return;
          }

          const filePath = window.electronAPI?.getPathForFile?.(file);
          if (!filePath) {
            window.toastManager?.error?.(
              'Unable to read the selected audio path',
            );
            return;
          }

          this.settings.appSoundPaths = {
            ...(this.settings.appSoundPaths || {}),
            [soundName]: filePath,
          };
          window.appSoundManager?.setCustomSound?.(soundName as any, filePath);
          this.saveSettings();
          this.updateAppSoundsUI();
        });
        input.dataset.listenerAttached = 'true';
      });

    document
      .querySelectorAll<HTMLElement>('.app-sound-reset')
      .forEach((button) => {
        if (button.dataset.listenerAttached) {
          return;
        }

        button.addEventListener('click', () => {
          const soundName = button.dataset.soundName;
          if (!soundName) {
            return;
          }

          const nextSoundPaths = { ...(this.settings.appSoundPaths || {}) };
          delete nextSoundPaths[soundName];
          this.settings.appSoundPaths = nextSoundPaths;
          window.appSoundManager?.setCustomSound?.(soundName as any, null);
          this.saveSettings();
          this.updateAppSoundsUI();
        });
        button.dataset.listenerAttached = 'true';
      });

    document
      .querySelectorAll<HTMLInputElement>('.app-sound-enabled')
      .forEach((input) => {
        if (input.dataset.listenerAttached) {
          return;
        }

        input.addEventListener('change', () => {
          const soundName = input.dataset.soundName;
          if (!soundName) {
            return;
          }

          this.settings.appSoundEnabled = {
            ...(this.settings.appSoundEnabled || {}),
            [soundName]: input.checked,
          };
          window.appSoundManager?.setSoundEnabled?.(
            soundName as any,
            input.checked,
          );
          this.saveSettings();
        });
        input.dataset.listenerAttached = 'true';
      });

    const enhancedStatusBarToggle = document.querySelector<HTMLInputElement>(
      '#enhanced-status-bar-enabled',
    );
    if (
      enhancedStatusBarToggle &&
      !enhancedStatusBarToggle.dataset.listenerAttached
    ) {
      enhancedStatusBarToggle.addEventListener('change', () => {
        this.settings.enhancedStatusBar = enhancedStatusBarToggle.checked;
        this.saveSettings();
        if (window.statusBarManager) {
        }
      });
      enhancedStatusBarToggle.dataset.listenerAttached = 'true';
    }

    const cssUmcImagesToggle = document.querySelector<HTMLInputElement>(
      '#css-umc-images-enabled',
    );
    if (cssUmcImagesToggle && !cssUmcImagesToggle.dataset.listenerAttached) {
      cssUmcImagesToggle.addEventListener('change', async () => {
        const enabled = cssUmcImagesToggle.checked;
        cssUmcImagesToggle.disabled = true;
        try {
          await this.readyPromise;
          const result = await window.electronAPI.store.set(
            'cssUmcImagesEnabled',
            enabled,
          );
          if (!result.success)
            throw new Error('Failed to save UMC image setting');
          this.settings.cssUmcImagesEnabled = enabled;
          window.dispatchEvent(
            new CustomEvent('css-umc-images-setting-changed', {
              detail: { enabled },
            }),
          );
        } catch {
          cssUmcImagesToggle.checked =
            this.settings.cssUmcImagesEnabled !== false;
          this.showToast(this.translate('toasts.failedToSaveSetting'), 'error');
        } finally {
          cssUmcImagesToggle.disabled = false;
        }
      });
      cssUmcImagesToggle.dataset.listenerAttached = 'true';
    }
  }

  bindEmulatorSettings() {
    const browseEmulator = document.querySelector<HTMLElement>(
      '#browse-emulator-path',
    );
    if (browseEmulator && !browseEmulator.dataset.listenerAttached) {
      browseEmulator.addEventListener('click', () => this.browseEmulatorPath());
      browseEmulator.dataset.listenerAttached = 'true';
    }

    const browseGame = document.querySelector<HTMLElement>('#browse-game-path');
    if (browseGame && !browseGame.dataset.listenerAttached) {
      browseGame.addEventListener('click', () => this.browseGamePath());
      browseGame.dataset.listenerAttached = 'true';
    }

    const emulatorTypeSelect = document.querySelector<HTMLElement>(
      '#emulator-type-select',
    );
    if (emulatorTypeSelect && !emulatorTypeSelect.dataset.listenerAttached) {
      const trigger = emulatorTypeSelect.querySelector<HTMLElement>(
        '.custom-select-trigger',
      );
      const options = emulatorTypeSelect.querySelectorAll<HTMLElement>(
        '.custom-select-option',
      );
      const selectedValue =
        emulatorTypeSelect.querySelector<HTMLElement>('.selected-value');

      if (trigger) {
        trigger.addEventListener('click', (e) => {
          e.stopPropagation();
          emulatorTypeSelect.classList.toggle('open');
        });
      }

      document.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;

        if (!emulatorTypeSelect.contains(target)) {
          emulatorTypeSelect.classList.remove('open');
        }
      });

      options.forEach((option) => {
        option.addEventListener('click', () => {
          const value = option.dataset.value;
          const text = option.querySelector<HTMLElement>('span')!.textContent;

          if (selectedValue) {
            selectedValue.textContent = text;
          }

          options.forEach((opt) => opt.classList.remove('active'));
          option.classList.add('active');

          emulatorTypeSelect.classList.remove('open');

          this.settings.emulatorType = value;
          this.saveSettings();
          this.updateFullscreenVisibility();
        });
      });

      emulatorTypeSelect.dataset.listenerAttached = 'true';
    }

    const emulatorFullscreenToggle = document.querySelector<HTMLInputElement>(
      '#emulator-fullscreen-enabled',
    );
    if (
      emulatorFullscreenToggle &&
      !emulatorFullscreenToggle.dataset.listenerAttached
    ) {
      emulatorFullscreenToggle.addEventListener('change', () => {
        this.settings.emulatorFullscreen = emulatorFullscreenToggle.checked;
        this.saveSettings();
      });
      emulatorFullscreenToggle.dataset.listenerAttached = 'true';
    }
  }

  bindInstallAndDiscordSettings() {
    const installConfirmToggle = document.querySelector<HTMLInputElement>(
      '#install-confirm-enabled',
    );
    if (
      installConfirmToggle &&
      !installConfirmToggle.dataset.listenerAttached
    ) {
      installConfirmToggle.addEventListener('change', async () => {
        const enabled = installConfirmToggle.checked;

        try {
          await window.electronAPI.store.set('installConfirmEnabled', enabled);

          if (window.toastManager) {
            window.toastManager.success('toasts.settingSaved');
          } else {
            console.warn('Toast manager not available');
          }
        } catch (error) {
          console.error('Failed to save install confirm setting:', error);
          if (window.toastManager) {
            window.toastManager.error('toasts.failedToSaveSetting');
          }
        }
      });
      installConfirmToggle.dataset.listenerAttached = 'true';

      this.loadInstallConfirmSetting();
    }

    const discordRpcToggle = document.querySelector<HTMLInputElement>(
      '#discord-rpc-enabled',
    );
    if (discordRpcToggle && !discordRpcToggle.dataset.listenerAttached) {
      discordRpcToggle.addEventListener('change', async () => {
        const enabled = discordRpcToggle.checked;
        this.settings.discordRpcEnabled = enabled;
        await window.electronAPI?.setDiscordRpcEnabled?.(enabled);
        this.saveSettings();
      });
      discordRpcToggle.dataset.listenerAttached = 'true';
      this.loadDiscordRpcSetting();
    }
  }

  bindValidationSettings() {
    const conflictDetectionEnabled = document.querySelector<HTMLInputElement>(
      '#conflict-detection-enabled',
    );
    if (
      conflictDetectionEnabled &&
      !conflictDetectionEnabled.dataset.listenerAttached
    ) {
      conflictDetectionEnabled.addEventListener('change', () => {
        this.settings.conflictDetectionEnabled =
          conflictDetectionEnabled.checked;
        this.saveSettings();
      });
      conflictDetectionEnabled.dataset.listenerAttached = 'true';
    }

    const nroLimitCheckEnabled = document.querySelector<HTMLInputElement>(
      '#nro-limit-check-enabled',
    );
    if (
      nroLimitCheckEnabled &&
      !nroLimitCheckEnabled.dataset.listenerAttached
    ) {
      nroLimitCheckEnabled.addEventListener('change', () => {
        this.settings.nroLimitCheckEnabled = nroLimitCheckEnabled.checked;
        this.saveSettings();
        if (nroLimitCheckEnabled.checked) {
          window.modManager?.checkNroLimit?.();
        }
      });
      nroLimitCheckEnabled.dataset.listenerAttached = 'true';
    }

    const libraryPathValidationEnabled =
      document.querySelector<HTMLInputElement>(
        '#library-path-validation-enabled',
      );
    if (
      libraryPathValidationEnabled &&
      !libraryPathValidationEnabled.dataset.listenerAttached
    ) {
      libraryPathValidationEnabled.addEventListener('change', () => {
        this.settings.libraryPathValidationEnabled =
          libraryPathValidationEnabled.checked;
        this.saveSettings();
      });
      libraryPathValidationEnabled.dataset.listenerAttached = 'true';
    }
  }

  bindModBehaviorSettings() {
    const autoCheckPluginUpdates = document.querySelector<HTMLInputElement>(
      '#auto-check-plugin-updates-enabled',
    );
    if (
      autoCheckPluginUpdates &&
      !autoCheckPluginUpdates.dataset.listenerAttached
    ) {
      autoCheckPluginUpdates.addEventListener('change', () => {
        this.settings.autoCheckPluginUpdates = autoCheckPluginUpdates.checked;
        this.saveSettings();
      });
      autoCheckPluginUpdates.dataset.listenerAttached = 'true';
    }

    const autoDisableMods = document.querySelector<HTMLInputElement>(
      '#auto-disable-mods-enabled',
    );
    if (autoDisableMods && !autoDisableMods.dataset.listenerAttached) {
      autoDisableMods.addEventListener('change', () => {
        this.settings.autoDisableNewMods = autoDisableMods.checked;
        this.saveSettings();
      });
      autoDisableMods.dataset.listenerAttached = 'true';
    }

    const disableAllOnDownload = document.querySelector<HTMLInputElement>(
      '#disable-all-mods-on-download-enabled',
    );
    if (
      disableAllOnDownload &&
      !disableAllOnDownload.dataset.listenerAttached
    ) {
      disableAllOnDownload.addEventListener('change', () => {
        this.settings.disableAllModsOnDownload = disableAllOnDownload.checked;
        this.saveSettings();
      });
      disableAllOnDownload.dataset.listenerAttached = 'true';
    }

    const autoUseGameBananaModName = document.querySelector<HTMLInputElement>(
      '#auto-use-gamebanana-mod-name-enabled',
    );
    if (
      autoUseGameBananaModName &&
      !autoUseGameBananaModName.dataset.listenerAttached
    ) {
      autoUseGameBananaModName.addEventListener('change', () => {
        this.settings.autoUseGameBananaModName =
          autoUseGameBananaModName.checked;
        this.saveSettings();
      });
      autoUseGameBananaModName.dataset.listenerAttached = 'true';
    }

    const reviewSlotChanges = document.querySelector<HTMLInputElement>(
      '#review-slot-changes-enabled',
    );
    if (reviewSlotChanges && !reviewSlotChanges.dataset.listenerAttached) {
      reviewSlotChanges.addEventListener('change', () => {
        this.settings.reviewSlotChangesBeforeApply = reviewSlotChanges.checked;
        this.saveSettings();
      });
      reviewSlotChanges.dataset.listenerAttached = 'true';
    }
  }

  bindUpdateSettings() {
    const checkUpdatesBtn =
      document.querySelector<HTMLElement>('#check-updates-btn');
    if (checkUpdatesBtn && !checkUpdatesBtn.dataset.listenerAttached) {
      checkUpdatesBtn.addEventListener('click', async () => {
        if (window.updateManager) {
          await window.updateManager.checkForUpdatesManually();
        }
      });
      checkUpdatesBtn.dataset.listenerAttached = 'true';
    }

    const autoCheckAppUpdates = document.querySelector<HTMLInputElement>(
      '#auto-check-app-updates-enabled',
    );
    if (autoCheckAppUpdates && !autoCheckAppUpdates.dataset.listenerAttached) {
      autoCheckAppUpdates.addEventListener('change', async () => {
        await window.electronAPI?.setAutoCheckEnabled?.(
          autoCheckAppUpdates.checked,
        );
      });
      autoCheckAppUpdates.dataset.listenerAttached = 'true';
    }

    this.updateAppVersionUI();
    this.updateAutoCheckAppUpdatesUI();

    const updateChannelSelect = document.querySelector<HTMLElement>(
      '#update-channel-select',
    );
    if (updateChannelSelect && !updateChannelSelect.dataset.listenerAttached) {
      const trigger = updateChannelSelect.querySelector<HTMLElement>(
        '.custom-select-trigger',
      );
      const options = updateChannelSelect.querySelectorAll<HTMLElement>(
        '.custom-select-option',
      );
      const selectedValue =
        updateChannelSelect.querySelector<HTMLElement>('.selected-value');

      if (trigger) {
        trigger.addEventListener('click', (e) => {
          e.stopPropagation();
          updateChannelSelect.classList.toggle('open');
        });
      }

      document.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (!updateChannelSelect.contains(target)) {
          updateChannelSelect.classList.remove('open');
        }
      });

      options.forEach((option) => {
        option.addEventListener('click', async () => {
          const value = option.dataset.value!;
          const text = option.querySelector<HTMLElement>('span')!.textContent;

          if (selectedValue) {
            selectedValue.textContent = text;
          }

          options.forEach((opt) => opt.classList.remove('active'));
          option.classList.add('active');

          updateChannelSelect.classList.remove('open');

          if (window.electronAPI && window.electronAPI.setUpdateChannel) {
            await window.electronAPI.setUpdateChannel(value);

            if (window.toastManager) {
              window.toastManager.success('toasts.settingSaved');
            }
          }
        });
      });

      updateChannelSelect.dataset.listenerAttached = 'true';
      this.updateChannelUI();
    }
  }

  bindLanguageAndThemeSettings() {
    const languageTypeSelect = document.querySelector<HTMLElement>(
      '#language-type-select',
    );
    if (languageTypeSelect && !languageTypeSelect.dataset.listenerAttached) {
      const trigger = languageTypeSelect.querySelector<HTMLElement>(
        '.custom-select-trigger',
      );
      const options = languageTypeSelect.querySelectorAll<HTMLElement>(
        '.custom-select-option',
      );
      const selectedValue =
        languageTypeSelect.querySelector<HTMLElement>('.selected-value');

      if (trigger) {
        trigger.addEventListener('click', (e) => {
          e.stopPropagation();
          languageTypeSelect.classList.toggle('open');
        });
      }

      document.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (!languageTypeSelect.contains(target)) {
          languageTypeSelect.classList.remove('open');
        }
      });

      options.forEach((option) => {
        option.addEventListener('click', async () => {
          const value = option.dataset.value;
          const text = option.querySelector<HTMLElement>('span')!.textContent;

          if (selectedValue) {
            selectedValue.textContent = text;
          }

          options.forEach((opt) => opt.classList.remove('active'));
          option.classList.add('active');

          languageTypeSelect.classList.remove('open');

          if (window.i18n) {
            await window.i18n.changeLocale(value);
          }
        });
      });

      languageTypeSelect.dataset.listenerAttached = 'true';
      this.updateLanguageTypeUI();

      window.addEventListener('localeChanged', () => {
        this.updateLanguageTypeUI();
      });
    }

    const themeSelect = document.querySelector<HTMLElement>('#theme-select');
    if (themeSelect && !themeSelect.dataset.listenerAttached) {
      const trigger = themeSelect.querySelector<HTMLElement>(
        '.custom-select-trigger',
      );
      const options = themeSelect.querySelectorAll<HTMLElement>(
        '.custom-select-option',
      );
      const selectedValue =
        themeSelect.querySelector<HTMLElement>('.selected-value');

      if (trigger) {
        trigger.addEventListener('click', (e) => {
          e.stopPropagation();
          themeSelect.classList.toggle('open');
        });
      }

      document.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (!themeSelect.contains(target)) {
          themeSelect.classList.remove('open');
        }
      });

      options.forEach((option) => {
        option.addEventListener('click', () => {
          const value = option.dataset.value;
          const text = option.querySelector<HTMLElement>('span')!.textContent;

          if (selectedValue) {
            selectedValue.textContent = text;
          }

          options.forEach((opt) => opt.classList.remove('active'));
          option.classList.add('active');

          themeSelect.classList.remove('open');

          this.setTheme(value);
        });
      });

      themeSelect.dataset.listenerAttached = 'true';
      this.updateThemeUI();
    }

    const sidebarPrideTabsToggle = document.querySelector<HTMLInputElement>(
      '#sidebar-pride-tabs-enabled',
    );
    if (
      sidebarPrideTabsToggle &&
      !sidebarPrideTabsToggle.dataset.listenerAttached
    ) {
      sidebarPrideTabsToggle.checked =
        this.settings.sidebarPrideTabsEnabled !== false;
      sidebarPrideTabsToggle.addEventListener('change', async () => {
        const enabled = sidebarPrideTabsToggle.checked;
        this.settings.sidebarPrideTabsEnabled = enabled;
        this.applySidebarPrideTabsSetting(enabled);
        await window.electronAPI.store.set('sidebarPrideTabsEnabled', enabled);
      });
      sidebarPrideTabsToggle.dataset.listenerAttached = 'true';
    }
  }

  bindRunModeSettings() {
    const appRunModeSelect = document.querySelector<HTMLElement>(
      '#app-run-mode-select',
    );
    if (appRunModeSelect && !appRunModeSelect.dataset.listenerAttached) {
      const trigger = appRunModeSelect.querySelector<HTMLElement>(
        '.custom-select-trigger',
      );
      const options = appRunModeSelect.querySelectorAll<HTMLElement>(
        '.custom-select-option',
      );
      const selectedValue =
        appRunModeSelect.querySelector<HTMLElement>('.selected-value');

      if (trigger) {
        trigger.addEventListener('click', (e) => {
          e.stopPropagation();
          appRunModeSelect.classList.toggle('open');
        });
      }

      document.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (!appRunModeSelect.contains(target)) {
          appRunModeSelect.classList.remove('open');
        }
      });

      options.forEach((option) => {
        option.addEventListener('click', () => {
          const value = this.normalizeAppRunMode(option.dataset.value);
          const text = option.querySelector<HTMLElement>('span')!.textContent;
          const i18nKey =
            option.querySelector<HTMLElement>('span')!.dataset.i18n;

          if (selectedValue) {
            selectedValue.textContent = text;
            if (i18nKey) {
              selectedValue.dataset.i18n = i18nKey;
            }
          }

          options.forEach((opt) => opt.classList.remove('active'));
          option.classList.add('active');

          appRunModeSelect.classList.remove('open');

          this.settings.appRunMode = value;
          this.librarySettings.applyHardwareLibraryModePaths();
          this.librarySettings.updateHardwareLibraryModeVisibility();
          this.updateRunModeTabsVisibility();
          this.saveSettings();
        });
      });

      appRunModeSelect.dataset.listenerAttached = 'true';
      this.updateAppRunModeUI();
    }

    const hardwareLibraryModeSelect = document.querySelector<HTMLElement>(
      '#hardware-library-mode-select',
    );
    if (
      hardwareLibraryModeSelect &&
      !hardwareLibraryModeSelect.dataset.listenerAttached
    ) {
      const trigger = hardwareLibraryModeSelect.querySelector<HTMLElement>(
        '.custom-select-trigger',
      );
      const options = hardwareLibraryModeSelect.querySelectorAll<HTMLElement>(
        '.custom-select-option',
      );
      const selectedValue =
        hardwareLibraryModeSelect.querySelector<HTMLElement>('.selected-value');

      if (trigger) {
        trigger.addEventListener('click', (e) => {
          e.stopPropagation();
          hardwareLibraryModeSelect.classList.toggle('open');
        });
      }

      document.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (!hardwareLibraryModeSelect.contains(target)) {
          hardwareLibraryModeSelect.classList.remove('open');
        }
      });

      options.forEach((option) => {
        option.addEventListener('click', async () => {
          const value = this.normalizeHardwareLibraryMode(option.dataset.value);
          if (value === 'direct' && this.getSwitchTransferMethod() === 'ftp') {
            return;
          }
          const previousMode = this.normalizeHardwareLibraryMode(
            this.settings.hardwareLibraryMode,
          );
          const text = option.querySelector<HTMLElement>('span')!.textContent;
          const i18nKey =
            option.querySelector<HTMLElement>('span')!.dataset.i18n;

          if (selectedValue) {
            selectedValue.textContent = text;
            if (i18nKey) {
              selectedValue.dataset.i18n = i18nKey;
            }
          }

          options.forEach((opt) => opt.classList.remove('active'));
          option.classList.add('active');

          hardwareLibraryModeSelect.classList.remove('open');

          this.settings.hardwareLibraryMode = value;
          this.librarySettings.applyHardwareLibraryModePaths();
          await this.saveSettings();
          await this.librarySettings.refreshCurrentLibraryLists();

          if (previousMode === 'direct' && value === 'local') {
            this.switchSettings.showSwitchSyncReconnectModal();
          }
        });
      });

      hardwareLibraryModeSelect.dataset.listenerAttached = 'true';
      this.librarySettings.updateHardwareLibraryModeUI();
    }
  }

  refreshSettingsUI() {
    this.librarySettings.updateModsFolderUI();
    this.librarySettings.updatePluginsFolderUI();
    this.updateLanguageTypeUI();
    this.updateAppRunModeUI();
    this.librarySettings.updateHardwareLibraryModeVisibility();
    this.updateRunModeTabsVisibility();
    this.librarySettings.updateHardwareLibraryModeUI();
    this.updateEmulatorTypeUI();
    this.updateEmulatorPathUI();
    this.updateGamePathUI();
    this.updateEmulatorFullscreenUI();
    this.updateFullscreenVisibility();
    this.switchSettings.updateSwitchSettingsUI();
    this.switchSettings.updateSwitchTransferMethodUI();
    this.switchSettings.updateSwitchSyncModeUI();
    this.updateConflictDetectionUI();
    this.updateNroLimitCheckUI();
    this.updateLibraryPathValidationUI();
    this.updateAutoCheckPluginUpdatesUI();
    this.updateAutoDisableModsUI();
    this.updateDisableAllModsOnDownloadUI();
    this.updateAutoUseGameBananaModNameUI();
    this.updateReviewSlotChangesUI();
    this.updateEnhancedStatusBarUI();
    const cssUmcImagesToggle = document.querySelector<HTMLInputElement>(
      '#css-umc-images-enabled',
    );
    if (cssUmcImagesToggle)
      cssUmcImagesToggle.checked = this.settings.cssUmcImagesEnabled !== false;
    this.updateStartupSplashUI();
    this.updateStartupSplashSoundUI();
    this.updateAppSoundsUI();
    this.developerSettings.updateDeveloperModeUI();
    this.ignoredConflicts.initializeIgnoredConflictsUI();
  }

  bindDiscoverSettings() {
    const discoverSettings = [
      {
        selector: '#check-dependencies-on-discover-download-enabled',
        key: 'checkDependenciesOnDiscoverDownload',
        defaultValue: true,
      },
      {
        selector: '#hide-nsfw-discover-mods-enabled',
        key: 'hideNsfwDiscoverMods',
        defaultValue: true,
      },
      {
        selector: '#show-nsfw-discover-previews-enabled',
        key: 'showNsfwDiscoverPreviews',
        defaultValue: false,
      },
    ];

    discoverSettings.forEach(({ selector, key, defaultValue }) => {
      const toggle = document.querySelector<HTMLInputElement>(selector);
      if (!toggle) return;

      toggle.checked = this.settings[key] ?? defaultValue;
      if (toggle.dataset.listenerAttached) return;

      toggle.addEventListener('change', async () => {
        this.settings[key] = toggle.checked;
        await window.electronAPI.store.set(key, toggle.checked);

        if (
          key === 'hideNsfwDiscoverMods' ||
          key === 'showNsfwDiscoverPreviews'
        ) {
          window.marketplaceDiscover?.refreshGameBananaFilteredContent?.();
        }
      });
      toggle.dataset.listenerAttached = 'true';
    });
  }

  updateAutoDisableModsUI() {
    const toggle = document.querySelector<HTMLInputElement>(
      '#auto-disable-mods-enabled',
    );
    if (toggle) {
      toggle.checked = this.settings.autoDisableNewMods || false;
    }
  }

  updateDisableAllModsOnDownloadUI() {
    const toggle = document.querySelector<HTMLInputElement>(
      '#disable-all-mods-on-download-enabled',
    );
    if (toggle) {
      toggle.checked = this.settings.disableAllModsOnDownload || false;
    }
  }

  updateAutoUseGameBananaModNameUI() {
    const toggle = document.querySelector<HTMLInputElement>(
      '#auto-use-gamebanana-mod-name-enabled',
    );
    if (toggle) {
      toggle.checked = this.settings.autoUseGameBananaModName === true;
    }
  }

  updateReviewSlotChangesUI() {
    const toggle = document.querySelector<HTMLInputElement>(
      '#review-slot-changes-enabled',
    );
    if (toggle) {
      toggle.checked = this.settings.reviewSlotChangesBeforeApply !== false;
    }
  }

  updateEnhancedStatusBarUI() {
    const toggle = document.querySelector<HTMLInputElement>(
      '#enhanced-status-bar-enabled',
    );
    if (toggle) {
      toggle.checked = this.settings.enhancedStatusBar !== false;
    }
  }

  switchSettingsTab(tabName) {
    const newActive = document.querySelector<HTMLElement>(
      `#settings-${tabName}`,
    );
    if (!newActive) return;

    const contentArea = document.querySelector<HTMLElement>(
      '.settings-content-area',
    );
    const allContents = Array.from(
      document.querySelectorAll<HTMLElement>('.settings-tab-content'),
    );
    const allButtons = Array.from(
      document.querySelectorAll<HTMLElement>('.settings-tab-btn'),
    );
    const currentActive = document.querySelector<HTMLElement>(
      '.settings-tab-content.active',
    );
    const activeBtn = document.querySelector<HTMLElement>(
      `[data-settings-tab="${tabName}"]`,
    );

    const resetTransitionClasses = () => {
      allContents.forEach((content) => {
        content.classList.remove(
          'entering',
          'fade-out',
          'settings-tab-forward',
          'settings-tab-back',
        );
      });
    };

    const activateTab = () => {
      allContents.forEach((content) => {
        content.classList.remove('active');
      });

      allButtons.forEach((btn) => {
        btn.classList.remove('active');
      });

      if (activeBtn) {
        activeBtn.classList.add('active');
      }

      newActive.classList.add('active');

      if (contentArea) {
        contentArea.scrollTop = 0;
      }

      this.librarySettings.maybeWarnForCurrentModsPath();
    };

    if (this.switchTabTimeout) {
      clearTimeout(this.switchTabTimeout);
      this.switchTabTimeout = null;
      resetTransitionClasses();
    }

    const animationsDisabled =
      document.body.classList.contains('no-animations');

    if (currentActive && currentActive !== newActive && !animationsDisabled) {
      const currentTabName = currentActive.id.replace('settings-', '');
      const currentIndex = allButtons.findIndex(
        (btn) => btn.dataset.settingsTab === currentTabName,
      );
      const nextIndex = allButtons.findIndex(
        (btn) => btn.dataset.settingsTab === tabName,
      );
      const directionClass =
        nextIndex >= currentIndex
          ? 'settings-tab-forward'
          : 'settings-tab-back';

      allButtons.forEach((btn) => {
        btn.classList.remove('active');
      });

      if (activeBtn) {
        activeBtn.classList.add('active');
      }

      if (contentArea) {
        contentArea.scrollTop = 0;
      }

      allContents.forEach((content) => {
        content.classList.remove('active');
      });
      newActive.classList.add('active', 'entering', directionClass);

      this.switchTabTimeout = setTimeout(() => {
        resetTransitionClasses();
        newActive.classList.add('active');
        this.librarySettings.maybeWarnForCurrentModsPath();
        this.switchTabTimeout = null;
      }, 360);
    } else {
      resetTransitionClasses();
      activateTab();
    }
  }

  async browseEmulatorPath() {
    if (!window.electronAPI || !window.electronAPI.selectEmulatorFile) {
      console.error('Electron API not available');
      return;
    }

    const file = await window.electronAPI.selectEmulatorFile();
    if (file) {
      this.settings.emulatorPath = file;
      this.saveSettings();
      this.updateEmulatorPathUI();
    }
  }

  async browseGamePath() {
    if (!window.electronAPI || !window.electronAPI.selectGameFile) {
      console.error('Electron API not available');
      return;
    }

    const file = await window.electronAPI.selectGameFile();
    if (file) {
      this.settings.gamePath = file;
      this.saveSettings();
      this.updateGamePathUI();
    }
  }

  updateLanguageTypeUI() {
    const languageTypeSelect = document.querySelector<HTMLElement>(
      '#language-type-select',
    );
    if (languageTypeSelect && window.i18n) {
      const selectedValue =
        languageTypeSelect.querySelector<HTMLElement>('.selected-value');
      const options = languageTypeSelect.querySelectorAll<HTMLElement>(
        '.custom-select-option',
      );
      const currentLocale = window.i18n.getCurrentLocale() || 'en';

      options.forEach((option) => {
        if (option.dataset.value === currentLocale) {
          option.classList.add('active');
          if (selectedValue) {
            selectedValue.textContent =
              option.querySelector<HTMLElement>('span')!.textContent;
          }
        } else {
          option.classList.remove('active');
        }
      });
    }
  }

  updateEmulatorTypeUI() {
    const emulatorTypeSelect = document.querySelector<HTMLElement>(
      '#emulator-type-select',
    );
    if (emulatorTypeSelect) {
      const selectedValue =
        emulatorTypeSelect.querySelector<HTMLElement>('.selected-value');
      const options = emulatorTypeSelect.querySelectorAll<HTMLElement>(
        '.custom-select-option',
      );
      const currentType = this.normalizeEmulatorType(
        this.settings.emulatorType,
      );
      this.settings.emulatorType = currentType;

      options.forEach((option) => {
        if (option.dataset.value === currentType) {
          option.classList.add('active');
          if (selectedValue) {
            selectedValue.textContent =
              option.querySelector<HTMLElement>('span')!.textContent;
            const i18nKey =
              option.querySelector<HTMLElement>('span')!.dataset.i18n;
            if (i18nKey) {
              selectedValue.dataset.i18n = i18nKey;
            }
          }
        } else {
          option.classList.remove('active');
        }
      });
    }
  }

  updateEmulatorPathUI() {
    const input = document.querySelector<HTMLInputElement>('#emulator-path');
    if (input && this.settings.emulatorPath) {
      input.value = this.settings.emulatorPath;
    }
  }

  updateGamePathUI() {
    const input = document.querySelector<HTMLInputElement>('#game-path');
    if (input && this.settings.gamePath) {
      input.value = this.settings.gamePath;
    }
  }

  updateEmulatorFullscreenUI() {
    const toggle = document.querySelector<HTMLInputElement>(
      '#emulator-fullscreen-enabled',
    );
    if (toggle) {
      toggle.checked = this.settings.emulatorFullscreen || false;
    }
  }

  updateFullscreenVisibility() {
    const fullscreenToggle = document.querySelector<HTMLElement>(
      '#emulator-fullscreen-enabled',
    );
    if (!fullscreenToggle) return;

    const fullscreenSection = fullscreenToggle.closest(
      '.settings-section',
    ) as HTMLElement;
    if (fullscreenSection) {
      if (
        this.normalizeEmulatorType(this.settings.emulatorType) === 'ryujinx'
      ) {
        fullscreenSection.style.display = 'none';
      } else {
        fullscreenSection.style.display = 'block';
      }
    }
  }

  updateConflictDetectionUI() {
    const conflictDetectionCheckbox = document.querySelector<HTMLInputElement>(
      '#conflict-detection-enabled',
    );
    if (conflictDetectionCheckbox) {
      conflictDetectionCheckbox.checked =
        this.settings.conflictDetectionEnabled !== false;
    }
  }

  updateNroLimitCheckUI() {
    const nroLimitCheckCheckbox = document.querySelector<HTMLInputElement>(
      '#nro-limit-check-enabled',
    );
    if (nroLimitCheckCheckbox) {
      nroLimitCheckCheckbox.checked =
        this.settings.nroLimitCheckEnabled !== false;
    }
  }

  updateLibraryPathValidationUI() {
    const libraryPathValidationCheckbox =
      document.querySelector<HTMLInputElement>(
        '#library-path-validation-enabled',
      );
    if (libraryPathValidationCheckbox) {
      libraryPathValidationCheckbox.checked =
        this.settings.libraryPathValidationEnabled !== false;
    }
  }

  updateAutoCheckPluginUpdatesUI() {
    const autoCheckPluginUpdatesCheckbox =
      document.querySelector<HTMLInputElement>(
        '#auto-check-plugin-updates-enabled',
      );
    if (autoCheckPluginUpdatesCheckbox) {
      autoCheckPluginUpdatesCheckbox.checked =
        this.settings.autoCheckPluginUpdates || false;
    }
  }

  async updateAutoCheckAppUpdatesUI() {
    const autoCheckAppUpdatesCheckbox =
      document.querySelector<HTMLInputElement>(
        '#auto-check-app-updates-enabled',
      );
    if (
      autoCheckAppUpdatesCheckbox &&
      window.electronAPI &&
      window.electronAPI.getAutoCheckEnabled
    ) {
      try {
        autoCheckAppUpdatesCheckbox.checked =
          await window.electronAPI.getAutoCheckEnabled();
      } catch (error) {
        console.error('Failed to get app update auto-check setting:', error);
        autoCheckAppUpdatesCheckbox.checked = true;
      }
    }
  }

  updateStartupSplashUI() {
    const startupSplashCheckbox = document.querySelector<HTMLInputElement>(
      '#startup-splash-enabled',
    );
    if (startupSplashCheckbox) {
      startupSplashCheckbox.checked =
        this.settings.startupSplashEnabled !== false;
    }
  }

  updateStartupSplashSoundUI() {
    const startupSplashSoundCheckbox = document.querySelector<HTMLInputElement>(
      '#startup-splash-sound-enabled',
    );
    if (startupSplashSoundCheckbox) {
      const splashEnabled = this.settings.startupSplashEnabled !== false;
      startupSplashSoundCheckbox.checked =
        splashEnabled && this.settings.startupSplashSoundEnabled !== false;
      startupSplashSoundCheckbox.disabled = !splashEnabled;
      startupSplashSoundCheckbox
        .closest('.settings-switch')
        ?.classList.toggle('disabled', !splashEnabled);
    }

    const splashSoundLabel = document.querySelector<HTMLElement>(
      '#startup-splash-sound-label',
    );
    if (splashSoundLabel) {
      splashSoundLabel.style.opacity =
        this.settings.startupSplashEnabled !== false ? '1' : '0.55';
    }

    const splashSoundPathInput = document.querySelector<HTMLInputElement>(
      '#startup-splash-sound-path',
    );
    if (splashSoundPathInput) {
      const defaultSoundLabel =
        window.i18n?.t?.('settings.startupSplashSoundPathPlaceholder') ||
        'Default MOSAIC sound';
      splashSoundPathInput.value =
        this.settings.startupSplashSoundPath || defaultSoundLabel;
      splashSoundPathInput.disabled =
        this.settings.startupSplashEnabled === false;
    }

    const browseStartupSplashSound = document.querySelector<HTMLButtonElement>(
      '#browse-startup-splash-sound',
    );
    if (browseStartupSplashSound) {
      browseStartupSplashSound.disabled =
        this.settings.startupSplashEnabled === false;
    }

    const resetStartupSplashSound = document.querySelector<HTMLButtonElement>(
      '#reset-startup-splash-sound',
    );
    if (resetStartupSplashSound) {
      resetStartupSplashSound.disabled =
        this.settings.startupSplashEnabled === false ||
        !this.settings.startupSplashSoundPath;
    }
  }

  updateAppSoundsUI() {
    const defaultSoundLabel =
      window.i18n?.t?.('settings.defaultSoundPath') || 'Default sound';
    const appSoundPaths = this.settings.appSoundPaths || {};
    const appSoundEnabled = this.settings.appSoundEnabled || {};

    this.getAppSoundNames().forEach((soundName) => {
      const enabledInput = document.querySelector<HTMLInputElement>(
        `#app-sound-enabled-${soundName}`,
      );
      if (enabledInput) {
        enabledInput.checked = appSoundEnabled[soundName] !== false;
      }

      const pathInput = document.querySelector<HTMLInputElement>(
        `#app-sound-path-${soundName}`,
      );
      if (pathInput) {
        pathInput.value = appSoundPaths[soundName] || defaultSoundLabel;
      }

      const resetButton = document.querySelector<HTMLButtonElement>(
        `.app-sound-reset[data-sound-name="${soundName}"]`,
      );
      if (resetButton) {
        resetButton.disabled = !appSoundPaths[soundName];
      }
    });
  }

  applyAppSoundSettings() {
    if (!window.appSoundManager) {
      return;
    }

    const appSoundPaths = this.settings.appSoundPaths || {};
    const appSoundEnabled = this.settings.appSoundEnabled || {};
    this.getAppSoundNames().forEach((soundName) => {
      window.appSoundManager.setCustomSound(
        soundName as any,
        appSoundPaths[soundName] || null,
      );
      window.appSoundManager.setSoundEnabled(
        soundName as any,
        appSoundEnabled[soundName] !== false,
      );
    });
  }

  getAppSoundNames() {
    return [
      'notification',
      'error',
      'complete',
      'downloading',
      'loading',
      'switchTab',
    ];
  }

  async updateAppVersionUI() {
    const appVersionEl = document.querySelector<HTMLElement>('#app-version');
    if (
      appVersionEl &&
      window.electronAPI &&
      window.electronAPI.getAppVersion
    ) {
      try {
        appVersionEl.textContent = (
          await window.electronAPI.getAppVersion()
        ).version;
      } catch (error) {
        console.error('Failed to get app version:', error);
      }
    }
  }

  async updateChannelUI() {
    const updateChannelSelect = document.querySelector<HTMLElement>(
      '#update-channel-select',
    );
    if (updateChannelSelect && window.electronAPI) {
      try {
        const channel =
          (await window.electronAPI.getUpdateChannel?.()) || 'beta';
        const selectedValue =
          updateChannelSelect.querySelector<HTMLElement>('.selected-value');
        const options = updateChannelSelect.querySelectorAll<HTMLElement>(
          '.custom-select-option',
        );

        options.forEach((option) => {
          if (option.dataset.value === channel) {
            option.classList.add('active');
            if (selectedValue) {
              selectedValue.textContent =
                option.querySelector<HTMLElement>('span')!.textContent;
            }
          } else {
            option.classList.remove('active');
          }
        });
      } catch (error) {
        console.error('Failed to get update channel:', error);
      }
    }
  }

  updateThemeUI() {
    const themeSelect = document.querySelector<HTMLElement>('#theme-select');
    if (themeSelect) {
      const selectedValue =
        themeSelect.querySelector<HTMLElement>('.selected-value');
      const options = themeSelect.querySelectorAll<HTMLElement>(
        '.custom-select-option',
      );
      const currentTheme = this.settings.theme || 'dark';

      options.forEach((option) => {
        if (option.dataset.value === currentTheme) {
          option.classList.add('active');
          if (selectedValue) {
            selectedValue.textContent =
              option.querySelector<HTMLElement>('span')!.textContent;
          }
        } else {
          option.classList.remove('active');
        }
      });
    }
  }

  updateAppRunModeUI() {
    const appRunModeSelect = document.querySelector<HTMLElement>(
      '#app-run-mode-select',
    );
    if (!appRunModeSelect) {
      return;
    }

    const selectedValue =
      appRunModeSelect.querySelector<HTMLElement>('.selected-value');
    const options = appRunModeSelect.querySelectorAll<HTMLElement>(
      '.custom-select-option',
    );
    const currentMode = this.normalizeAppRunMode(this.settings.appRunMode);
    this.settings.appRunMode = currentMode;

    options.forEach((option) => {
      const isActive = option.dataset.value === currentMode;
      option.classList.toggle('active', isActive);

      if (isActive && selectedValue) {
        const label = option.querySelector<HTMLElement>('span');
        selectedValue.textContent = label?.textContent || currentMode;
        if (label?.dataset.i18n) {
          selectedValue.dataset.i18n = label.dataset.i18n;
        }
      }
    });
  }

  updateRunModeTabsVisibility() {
    const currentMode = this.getAppRunMode();
    const emulatorButton = document.querySelector<HTMLElement>(
      '[data-settings-tab="emulator"]',
    );
    const switchButton = document.querySelector<HTMLElement>(
      '[data-settings-tab="switch"]',
    );
    const emulatorContent =
      document.querySelector<HTMLElement>('#settings-emulator');
    const switchContent =
      document.querySelector<HTMLElement>('#settings-switch');

    const showEmulator = currentMode === 'emulator';
    const showSwitch = currentMode === 'hardware';

    if (emulatorButton) {
      emulatorButton.style.display = showEmulator ? '' : 'none';
    }
    if (switchButton) {
      switchButton.style.display = showSwitch ? '' : 'none';
    }
    if (emulatorContent && !showEmulator) {
      emulatorContent.classList.remove('active');
    }
    if (switchContent && !showSwitch) {
      switchContent.classList.remove('active');
    }

    const activeContent = document.querySelector<HTMLElement>(
      '.settings-tab-content.active',
    );
    if (!activeContent) {
      this.switchSettingsTab('general');
    }
  }

  async setTheme(theme) {
    this.settings.theme = theme;
    this.applyTheme(theme);
    await window.electronAPI.store.set('theme', theme);
  }

  applyTheme(theme) {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  applySidebarPrideTabsSetting(enabled: boolean) {
    const isEnabled = enabled !== false;
    document.documentElement.classList.toggle(
      'sidebar-pride-tabs-disabled',
      !isEnabled,
    );
    localStorage.setItem(
      'sidebar_pride_tabs_enabled',
      isEnabled ? 'true' : 'false',
    );
    window.fightPlannerManager?.applySidebarPrideTabsEnabled?.(isEnabled);
  }

  async loadSettings() {
    try {
      const modsPath = await window.electronAPI.store.get('modsPath');
      const pluginsPath = await window.electronAPI.store.get('pluginsPath');
      const localModsPath = await window.electronAPI.store.get('localModsPath');
      const localPluginsPath =
        await window.electronAPI.store.get('localPluginsPath');
      const directModsPath =
        await window.electronAPI.store.get('directModsPath');
      const directPluginsPath =
        await window.electronAPI.store.get('directPluginsPath');
      const primaryModsPath =
        await window.electronAPI.store.get('primaryModsPath');
      const secondaryModsPath =
        await window.electronAPI.store.get('secondaryModsPath');
      const activeModsLibrary =
        await window.electronAPI.store.get('activeModsLibrary');
      const modsLibrarySwitcherEnabled = await window.electronAPI.store.get(
        'modsLibrarySwitcherEnabled',
      );
      const appRunMode = await window.electronAPI.store.get('appRunMode');
      const hardwareLibraryMode = await window.electronAPI.store.get(
        'hardwareLibraryMode',
      );
      const emulatorType = await window.electronAPI.store.get('emulatorType');
      const emulatorPath = await window.electronAPI.store.get('emulatorPath');
      const gamePath = await window.electronAPI.store.get('gamePath');
      const emulatorFullscreen =
        await window.electronAPI.store.get('emulatorFullscreen');
      const switchIp = await window.electronAPI.store.get('switchIp');
      const switchPort = await window.electronAPI.store.get('switchPort');
      const switchFtpUser = await window.electronAPI.store.get('switchFtpUser');
      const switchFtpPassword =
        await window.electronAPI.store.get('switchFtpPassword');
      const switchFtpPath = await window.electronAPI.store.get('switchFtpPath');
      const switchFtpModsPath =
        await window.electronAPI.store.get('switchFtpModsPath');
      const switchFtpPluginsPath = await window.electronAPI.store.get(
        'switchFtpPluginsPath',
      );
      const switchTransferMethod = await window.electronAPI.store.get(
        'switchTransferMethod',
      );
      const switchSyncMode =
        await window.electronAPI.store.get('switchSyncMode');
      const switchDriveLetter =
        await this.switchSettings.resolveStoredSwitchDrivePath(
          await window.electronAPI.store.get('switchDriveLetter'),
        );
      const conflictDetectionEnabled = await window.electronAPI.store.get(
        'conflictDetectionEnabled',
      );
      const nroLimitCheckEnabled = await window.electronAPI.store.get(
        'nroLimitCheckEnabled',
      );
      const libraryPathValidationEnabled = await window.electronAPI.store.get(
        'libraryPathValidationEnabled',
      );
      const ignoredConflictPaths = await window.electronAPI.store.get(
        'ignoredConflictPaths',
      );
      const autoCheckPluginUpdates = await window.electronAPI.store.get(
        'autoCheckPluginUpdates',
      );
      const pluginUpdateIntroShown = await window.electronAPI.store.get(
        'pluginUpdateIntroShown',
      );
      const theme = await window.electronAPI.store.get('theme');
      const sidebarPrideTabsEnabled = await window.electronAPI.store.get(
        'sidebarPrideTabsEnabled',
      );
      const autoDisableNewMods =
        await window.electronAPI.store.get('autoDisableNewMods');
      const disableAllModsOnDownload = await window.electronAPI.store.get(
        'disableAllModsOnDownload',
      );
      const autoUseGameBananaModName = await window.electronAPI.store.get(
        'autoUseGameBananaModName',
      );
      const reviewSlotChangesBeforeApply = await window.electronAPI.store.get(
        'reviewSlotChangesBeforeApply',
      );
      const cssUmcImagesEnabled = await window.electronAPI.store.get(
        'cssUmcImagesEnabled',
      );
      const startupSplashEnabled = await window.electronAPI.store.get(
        'startupSplashEnabled',
      );
      const startupSplashSoundEnabled = await window.electronAPI.store.get(
        'startupSplashSoundEnabled',
      );
      const startupSplashSoundPath = await window.electronAPI.store.get(
        'startupSplashSoundPath',
      );
      const appSoundPaths = await window.electronAPI.store.get('appSoundPaths');
      const appSoundEnabled =
        await window.electronAPI.store.get('appSoundEnabled');
      const checkDependenciesOnDiscoverDownload =
        await window.electronAPI.store.get(
          'checkDependenciesOnDiscoverDownload',
        );
      const hideNsfwDiscoverMods = await window.electronAPI.store.get(
        'hideNsfwDiscoverMods',
      );
      const showNsfwDiscoverPreviews = await window.electronAPI.store.get(
        'showNsfwDiscoverPreviews',
      );
      const discordRpcEnabled =
        await window.electronAPI.store.get('discordRpcEnabled');
      const normalizedSwitchTransferMethod =
        this.normalizeSwitchTransferMethod(switchTransferMethod);
      return {
        modsPath: modsPath || null,
        pluginsPath: pluginsPath || null,
        localModsPath: localModsPath || null,
        localPluginsPath: localPluginsPath || null,
        directModsPath: directModsPath || null,
        directPluginsPath: directPluginsPath || null,
        primaryModsPath: primaryModsPath || localModsPath || modsPath || null,
        secondaryModsPath: secondaryModsPath || null,
        activeModsLibrary: this.normalizeActiveModsLibrary(activeModsLibrary),
        modsLibrarySwitcherEnabled: modsLibrarySwitcherEnabled === true,
        appRunMode: appRunMode
          ? this.normalizeAppRunMode(appRunMode)
          : normalizedSwitchTransferMethod !== 'none'
            ? 'hardware'
            : 'emulator',
        hardwareLibraryMode:
          this.normalizeHardwareLibraryMode(hardwareLibraryMode),
        emulatorType: this.normalizeEmulatorType(emulatorType),
        emulatorPath: emulatorPath || null,
        gamePath: gamePath || null,
        emulatorFullscreen: emulatorFullscreen || false,
        switchIp: switchIp || null,
        switchPort: switchPort || '5000',
        switchFtpUser: switchFtpUser || null,
        switchFtpPassword: switchFtpPassword || null,
        switchFtpPath: switchFtpPath || null,
        switchFtpModsPath: switchFtpModsPath || switchFtpPath || null,
        switchFtpPluginsPath: switchFtpPluginsPath || null,
        switchTransferMethod: normalizedSwitchTransferMethod,
        switchSyncMode: this.normalizeSwitchSyncMode(switchSyncMode),
        switchDriveLetter: switchDriveLetter || null,
        conflictDetectionEnabled: conflictDetectionEnabled !== false,
        nroLimitCheckEnabled: nroLimitCheckEnabled !== false,
        libraryPathValidationEnabled: libraryPathValidationEnabled !== false,
        ignoredConflictPaths: Array.isArray(ignoredConflictPaths)
          ? ignoredConflictPaths
              .map((value) => (typeof value === 'string' ? value.trim() : ''))
              .filter((value) => value.length > 0)
          : [],
        autoCheckPluginUpdates: autoCheckPluginUpdates || false,
        pluginUpdateIntroShown: pluginUpdateIntroShown || false,
        theme: theme || 'dark',
        sidebarPrideTabsEnabled: sidebarPrideTabsEnabled !== false,
        autoDisableNewMods: autoDisableNewMods || false,
        disableAllModsOnDownload: disableAllModsOnDownload || false,
        autoUseGameBananaModName: autoUseGameBananaModName === true,
        reviewSlotChangesBeforeApply: reviewSlotChangesBeforeApply !== false,
        cssUmcImagesEnabled: cssUmcImagesEnabled !== false,
        startupSplashEnabled: startupSplashEnabled !== false,
        startupSplashSoundEnabled: startupSplashSoundEnabled !== false,
        startupSplashSoundPath:
          typeof startupSplashSoundPath === 'string' &&
          startupSplashSoundPath.trim()
            ? startupSplashSoundPath
            : null,
        appSoundPaths:
          appSoundPaths && typeof appSoundPaths === 'object'
            ? appSoundPaths
            : {},
        appSoundEnabled:
          appSoundEnabled && typeof appSoundEnabled === 'object'
            ? appSoundEnabled
            : {},
        checkDependenciesOnDiscoverDownload:
          checkDependenciesOnDiscoverDownload !== false,
        hideNsfwDiscoverMods: hideNsfwDiscoverMods !== false,
        showNsfwDiscoverPreviews: showNsfwDiscoverPreviews === true,
        discordRpcEnabled: discordRpcEnabled !== false,
      };
    } catch (error) {
      console.error('Failed to load settings:', error);
      return {
        modsPath: null,
        pluginsPath: null,
        localModsPath: null,
        localPluginsPath: null,
        directModsPath: null,
        directPluginsPath: null,
        primaryModsPath: null,
        secondaryModsPath: null,
        activeModsLibrary: 'primary',
        modsLibrarySwitcherEnabled: false,
        appRunMode: 'emulator',
        hardwareLibraryMode: 'local',
        emulatorType: 'yuzu',
        emulatorPath: null,
        gamePath: null,
        emulatorFullscreen: false,
        switchIp: null,
        switchPort: '5000',
        switchFtpUser: null,
        switchFtpPassword: null,
        switchFtpPath: null,
        switchFtpModsPath: null,
        switchFtpPluginsPath: null,
        switchTransferMethod: 'none',
        switchSyncMode: 'quick',
        switchDriveLetter: null,
        conflictDetectionEnabled: true,
        nroLimitCheckEnabled: true,
        libraryPathValidationEnabled: true,
        ignoredConflictPaths: [],
        autoCheckPluginUpdates: false,
        pluginUpdateIntroShown: false,
        theme: 'dark',
        sidebarPrideTabsEnabled: true,
        autoDisableNewMods: false,
        disableAllModsOnDownload: false,
        autoUseGameBananaModName: false,
        reviewSlotChangesBeforeApply: true,
        cssUmcImagesEnabled: true,
        startupSplashEnabled: true,
        startupSplashSoundEnabled: true,
        startupSplashSoundPath: null,
        appSoundPaths: {},
        appSoundEnabled: {},
        checkDependenciesOnDiscoverDownload: true,
        hideNsfwDiscoverMods: true,
        showNsfwDiscoverPreviews: false,
        discordRpcEnabled: true,
      };
    }
  }

  async saveSettings() {
    if (!this.initialized) {
      console.warn('Skipping settings save before stored settings are loaded');
      return;
    }

    try {
      this.librarySettings.applyHardwareLibraryModePaths();
      this.librarySettings.applyActiveModsLibraryPath();
      const values = {
        modsPath: this.settings.modsPath,
        pluginsPath: this.settings.pluginsPath,
        localModsPath: this.settings.localModsPath,
        localPluginsPath: this.settings.localPluginsPath,
        directModsPath: this.settings.directModsPath,
        directPluginsPath: this.settings.directPluginsPath,
        primaryModsPath: this.settings.primaryModsPath,
        secondaryModsPath: this.settings.secondaryModsPath,
        activeModsLibrary: this.normalizeActiveModsLibrary(
          this.settings.activeModsLibrary,
        ),
        modsLibrarySwitcherEnabled:
          this.settings.modsLibrarySwitcherEnabled === true,
        appRunMode: this.settings.appRunMode,
        hardwareLibraryMode: this.settings.hardwareLibraryMode,
        emulatorType: this.settings.emulatorType,
        emulatorPath: this.settings.emulatorPath,
        gamePath: this.settings.gamePath,
        emulatorFullscreen: this.settings.emulatorFullscreen,
        switchIp: this.settings.switchIp,
        switchPort: this.settings.switchPort,
        switchFtpUser: this.settings.switchFtpUser,
        switchFtpPassword: this.settings.switchFtpPassword,
        switchFtpPath:
          this.settings.switchFtpModsPath || this.settings.switchFtpPath,
        switchFtpModsPath: this.settings.switchFtpModsPath,
        switchFtpPluginsPath: this.settings.switchFtpPluginsPath,
        switchTransferMethod: this.settings.switchTransferMethod,
        switchSyncMode: this.normalizeSwitchSyncMode(
          this.settings.switchSyncMode,
        ),
        switchDriveLetter: this.settings.switchDriveLetter,
        conflictDetectionEnabled: this.settings.conflictDetectionEnabled,
        nroLimitCheckEnabled: this.settings.nroLimitCheckEnabled,
        libraryPathValidationEnabled:
          this.settings.libraryPathValidationEnabled !== false,
        autoCheckPluginUpdates: this.settings.autoCheckPluginUpdates,
        pluginUpdateIntroShown: this.settings.pluginUpdateIntroShown,
        theme: this.settings.theme,
        sidebarPrideTabsEnabled:
          this.settings.sidebarPrideTabsEnabled !== false,
        autoDisableNewMods: this.settings.autoDisableNewMods,
        disableAllModsOnDownload: this.settings.disableAllModsOnDownload,
        autoUseGameBananaModName:
          this.settings.autoUseGameBananaModName === true,
        reviewSlotChangesBeforeApply:
          this.settings.reviewSlotChangesBeforeApply !== false,
        cssUmcImagesEnabled: this.settings.cssUmcImagesEnabled !== false,
        startupSplashEnabled: this.settings.startupSplashEnabled,
        startupSplashSoundEnabled: this.settings.startupSplashSoundEnabled,
        startupSplashSoundPath: this.settings.startupSplashSoundPath,
        appSoundPaths: this.settings.appSoundPaths || {},
        appSoundEnabled: this.settings.appSoundEnabled || {},
        discordRpcEnabled: this.settings.discordRpcEnabled !== false,
      };
      for (const [key, value] of Object.entries(values)) {
        await window.electronAPI.store.set(key, value);
      }
      window.hardwareConnectionManager?.refresh?.();
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  async setSetting(key, value) {
    this.settings[key] = value;
    if (key === 'autoCheckPluginUpdates') {
      this.updateAutoCheckPluginUpdatesUI();
    }
    await this.saveSettings();
  }

  getModsPath() {
    return this.settings.modsPath || null;
  }

  getPluginsPath() {
    return this.settings.pluginsPath || null;
  }

  getAppRunMode() {
    return this.normalizeAppRunMode(this.settings.appRunMode);
  }

  getHardwareLibraryMode() {
    if (this.getSwitchTransferMethod() === 'ftp') {
      return 'local';
    }
    return this.normalizeHardwareLibraryMode(this.settings.hardwareLibraryMode);
  }

  hasModsPath() {
    return !!this.settings.modsPath;
  }

  hasPluginsPath() {
    return !!this.settings.pluginsPath;
  }

  getEmulatorPath() {
    return this.settings.emulatorPath || null;
  }

  getGamePath() {
    return this.settings.gamePath || null;
  }

  hasEmulatorConfig() {
    return !!(this.settings.emulatorPath && this.settings.gamePath);
  }

  getEmulatorType() {
    return this.normalizeEmulatorType(this.settings.emulatorType);
  }

  getEmulatorFullscreen() {
    return this.settings.emulatorFullscreen || false;
  }

  getSwitchIp() {
    return this.settings.switchIp || null;
  }

  getSwitchPort() {
    return this.settings.switchPort || '5000';
  }

  getSwitchFtpUser() {
    return this.settings.switchFtpUser || null;
  }

  getSwitchFtpPassword() {
    return this.settings.switchFtpPassword || null;
  }

  getSwitchFtpPath() {
    return (
      this.settings.switchFtpModsPath || this.settings.switchFtpPath || null
    );
  }

  getSwitchFtpModsPath() {
    return (
      this.settings.switchFtpModsPath || this.settings.switchFtpPath || null
    );
  }

  getSwitchFtpPluginsPath() {
    return this.settings.switchFtpPluginsPath || null;
  }

  hasSwitchConfig() {
    const method = this.settings.switchTransferMethod || 'none';
    if (method === 'none') {
      return false;
    }
    if (method === 'drive') {
      return !!this.settings.switchDriveLetter;
    }
    if (method === 'mtp') {
      return true;
    }
    return !!(this.settings.switchIp && this.settings.switchPort);
  }

  getSwitchTransferMethod() {
    return this.settings.switchTransferMethod || 'none';
  }

  getSwitchSyncMode() {
    return this.normalizeSwitchSyncMode(this.settings.switchSyncMode);
  }

  getSwitchDriveLetter() {
    return this.settings.switchDriveLetter || null;
  }

  async setAnimationPreference(preference) {
    try {
      const currentPreference =
        ((await window.electronAPI.store.get('animationPreference')) as
          | string
          | null) || 'full';

      if (currentPreference === preference) {
        this.applyAnimationPreference(preference);
        return;
      }

      await window.electronAPI.store.set('animationPreference', preference);
      this.applyAnimationPreference(preference);
      this.showAnimationPreferenceRestartToast();
    } catch (error) {
      console.error('Failed to save animation preference:', error);
    }
  }

  async loadAnimationPreference() {
    try {
      const preference =
        ((await window.electronAPI.store.get('animationPreference')) as
          | string
          | null) || 'full';

      const animationSelector = document.querySelector<HTMLElement>(
        '#animation-preference',
      );

      if (animationSelector) {
        animationSelector
          .querySelectorAll<HTMLElement>('.animation-option')
          .forEach((option) => {
            if (option.dataset.value === preference) {
              option.classList.add('active');
            } else {
              option.classList.remove('active');
            }
          });
      }

      this.applyAnimationPreference(preference);
    } catch (error) {
      console.error('Failed to load animation preference:', error);
      this.applyAnimationPreference('full');
    }
  }

  applyAnimationPreference(preference: string) {
    document.body.classList.remove('reduced-animations', 'no-animations');

    if (preference === 'reduced') {
      document.body.classList.add('reduced-animations');
    } else if (preference === 'none') {
      document.body.classList.add('no-animations');
      document.body.classList.add('reduced-animations');
    }
  }

  showAnimationPreferenceRestartToast() {
    if (!window.toastManager) {
      return;
    }

    const restartLabel = window.i18n?.t?.('common.restart') || 'Restart';

    window.toastManager.info(
      'toasts.animationPreferenceRestartRequired',
      8000,
      {},
      {
        actionButton: {
          text: restartLabel,
          onClick: async () => {
            try {
              await window.electronAPI?.relaunchApp?.();
            } catch (error) {
              console.error(
                'Failed to relaunch app after animation preference change:',
                error,
              );
              window.toastManager?.error('toasts.failedToRestartApp');
            }
          },
        },
      },
    );
  }

  async loadDiscordRpcSetting() {
    try {
      const discordRpcEnabled =
        await window.electronAPI.store.get('discordRpcEnabled');
      const discordRpcToggle = document.querySelector<HTMLInputElement>(
        '#discord-rpc-enabled',
      );
      if (discordRpcToggle) {
        discordRpcToggle.checked = discordRpcEnabled !== false;
      }
    } catch (error) {
      console.error('Failed to load Discord RPC setting:', error);
    }
  }

  async loadInstallConfirmSetting() {
    try {
      const installConfirmEnabled = await window.electronAPI.store.get(
        'installConfirmEnabled',
      );
      const installConfirmToggle = document.querySelector<HTMLInputElement>(
        '#install-confirm-enabled',
      );
      if (installConfirmToggle) {
        installConfirmToggle.checked = installConfirmEnabled !== false;
      }
    } catch (error) {
      console.error('Failed to load install confirm setting:', error);
    }
  }

  confirmWithModal(
    id: string,
    title: string,
    message: string,
    confirmText: string,
    confirmType: 'primary' | 'danger',
  ): Promise<boolean> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (choice: boolean) => {
        if (settled) return;
        settled = true;
        resolve(choice);
      };

      window.modalManager.showCustomModal({
        id,
        title,
        body: `<p>${escapeHtml(message)}</p>`,
        clickOverlayToClose: false,
        buttons: [
          {
            text: this.translate('common.cancel'),
            type: 'cancel',
            onClick: () => finish(false),
          },
          {
            text: confirmText,
            type: confirmType,
            onClick: () => finish(true),
          },
        ],
        onClose: () => finish(false),
      });
    });
  }

  showRestartRequiredOverlay(
    messageKey = 'settings.restartRequiredAfterRestore',
  ) {
    document.body.classList.add('app-restart-required');

    let overlay = document.querySelector<HTMLElement>(
      '#config-restore-restart-overlay',
    );
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'config-restore-restart-overlay';
      overlay.className = 'config-restore-restart-overlay';
      overlay.setAttribute('role', 'alertdialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.innerHTML = `
        <div class="config-restore-restart-panel">
          <i class="bi bi-arrow-repeat"></i>
          <h2>${escapeHtml(this.translate('settings.restartRequiredTitle'))}</h2>
          <p>${escapeHtml(this.translate(messageKey))}</p>
          <button type="button" id="config-restore-restart-btn" class="settings-btn-action">
            <i class="bi bi-power"></i>
            <span>${escapeHtml(this.translate('settings.restartFightPlanner'))}</span>
          </button>
        </div>
      `;
      document.body.appendChild(overlay);
    }

    const restartButton = overlay.querySelector<HTMLButtonElement>(
      '#config-restore-restart-btn',
    );
    restartButton?.focus();
    restartButton?.addEventListener('click', async () => {
      try {
        await window.electronAPI?.relaunchApp?.();
      } catch (error) {
        console.error('Failed to restart after config restore:', error);
        window.toastManager?.error('toasts.failedToRestartApp');
      }
    });
  }

  translate(key, params = {}) {
    if (window.i18n && window.i18n.t) {
      return window.i18n.t(key, params);
    }
    return key;
  }

  showToast(message, type = 'info') {
    if (window.toastManager) {
      if (type === 'success') {
        window.toastManager.success(message);
      } else if (type === 'error') {
        window.toastManager.error(message);
      } else {
        window.toastManager.info(message);
      }
    } else {
      console.log(`[Toast] ${type}: ${message}`);
    }
  }
}

if (typeof window !== 'undefined') {
  window.settingsManager = new SettingsManager();

  if (window.electronAPI && window.electronAPI.store) {
    window.electronAPI.store
      .get('animationPreference')
      .then((preference: string | null) => {
        if (window.settingsManager && preference) {
          window.settingsManager.applyAnimationPreference(preference);
        }
      });

    window.electronAPI.store.get('theme').then((theme) => {
      if (window.settingsManager && theme) {
        window.settingsManager.applyTheme(theme);
      }
    });
  }
}

export { type SettingsManager };
