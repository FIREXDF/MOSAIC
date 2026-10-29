class SettingsLibrarySection {
  manager: Window['settingsManager'];

  constructor(manager: Window['settingsManager']) {
    this.manager = manager;
  }

  getConfiguredModsLibraryPath(library) {
    const normalizedLibrary = this.manager.normalizeActiveModsLibrary(library);
    return normalizedLibrary === 'secondary'
      ? this.manager.settings.secondaryModsPath || null
      : this.manager.settings.primaryModsPath || null;
  }

  setConfiguredModsLibraryPath(library, path) {
    const normalizedLibrary = this.manager.normalizeActiveModsLibrary(library);
    if (normalizedLibrary === 'secondary') {
      this.manager.settings.secondaryModsPath = path || null;
    } else {
      this.manager.settings.primaryModsPath = path || null;
    }

    if (
      !this.manager.switchSettings.isDirectSwitchLibraryMode() &&
      this.manager.normalizeActiveModsLibrary(
        this.manager.settings.activeModsLibrary,
      ) === normalizedLibrary
    ) {
      this.manager.settings.modsPath = path || null;
    }
  }

  setLibraryFolderPath(
    key: 'modsPath' | 'pluginsPath',
    folder: string,
    modsLibrary = this.manager.settings.activeModsLibrary,
  ) {
    if (this.manager.switchSettings.isDirectSwitchLibraryMode()) {
      this.manager.settings[
        key === 'modsPath' ? 'directModsPath' : 'directPluginsPath'
      ] = folder;
      this.manager.settings[key] = folder;
      const driveRoot =
        this.manager.switchSettings.getSwitchDriveRootFromLibraryPath(folder);
      if (
        driveRoot &&
        (driveRoot.startsWith('/') || driveRoot.includes(':\\'))
      ) {
        this.manager.settings.switchDriveLetter = driveRoot;
      }
    } else if (key === 'modsPath') {
      this.setConfiguredModsLibraryPath(modsLibrary, folder);
      if (
        this.manager.normalizeActiveModsLibrary(modsLibrary) ===
        this.manager.normalizeActiveModsLibrary(
          this.manager.settings.activeModsLibrary,
        )
      ) {
        this.manager.settings.localModsPath = folder;
      }
    } else {
      this.manager.settings.pluginsPath = folder;
      this.manager.settings.localPluginsPath = folder;
    }
  }

  async saveLibraryFolderPath(
    key: 'modsPath' | 'pluginsPath',
    folder: string,
    modsLibrary = this.manager.settings.activeModsLibrary,
  ) {
    const previousModsPath = this.manager.settings.modsPath;
    const previousPluginsPath = this.manager.settings.pluginsPath;
    this.setLibraryFolderPath(key, folder, modsLibrary);
    await this.manager.saveSettings();

    if (this.manager.settings.modsPath !== previousModsPath) {
      await this.refreshModsListForPath(this.manager.settings.modsPath);
    }
    if (this.manager.settings.pluginsPath !== previousPluginsPath) {
      await this.refreshPluginsListForPath(this.manager.settings.pluginsPath);
    }
  }

  applyActiveModsLibraryPath() {
    if (this.manager.switchSettings.isDirectSwitchLibraryMode()) {
      return;
    }

    const activeLibrary = this.manager.normalizeActiveModsLibrary(
      this.manager.settings.activeModsLibrary,
    );
    this.manager.settings.activeModsLibrary = activeLibrary;
    const activePath = this.getConfiguredModsLibraryPath(activeLibrary);
    if (activePath) {
      this.manager.settings.modsPath = activePath;
    }
  }

  bindLibrarySettings() {
    const browseMods = document.querySelector<HTMLElement>(
      '#browse-mods-folder',
    );
    if (browseMods && !browseMods.dataset.listenerAttached) {
      browseMods.addEventListener('click', () => this.browseModsFolder());
      browseMods.dataset.listenerAttached = 'true';
      console.log('Browse mods button listener attached');
    }

    const modsPathInput =
      document.querySelector<HTMLInputElement>('#mods-folder-path');
    if (modsPathInput && !modsPathInput.dataset.manualListenerAttached) {
      modsPathInput.addEventListener('change', () =>
        this.updateModsFolderFromInput(modsPathInput.value),
      );
      modsPathInput.dataset.manualListenerAttached = 'true';
    }

    const browseSecondaryMods = document.querySelector<HTMLElement>(
      '#browse-secondary-mods-folder',
    );
    if (browseSecondaryMods && !browseSecondaryMods.dataset.listenerAttached) {
      browseSecondaryMods.addEventListener('click', () =>
        this.browseSecondaryModsFolder(),
      );
      browseSecondaryMods.dataset.listenerAttached = 'true';
    }

    const secondaryModsPathInput = document.querySelector<HTMLInputElement>(
      '#secondary-mods-folder-path',
    );
    if (
      secondaryModsPathInput &&
      !secondaryModsPathInput.dataset.manualListenerAttached
    ) {
      secondaryModsPathInput.addEventListener('change', () =>
        this.updateSecondaryModsFolderFromInput(secondaryModsPathInput.value),
      );
      secondaryModsPathInput.dataset.manualListenerAttached = 'true';
    }

    const modsLibrarySwitcherToggle = document.querySelector<HTMLInputElement>(
      '#mods-library-switcher-enabled',
    );
    if (
      modsLibrarySwitcherToggle &&
      !modsLibrarySwitcherToggle.dataset.listenerAttached
    ) {
      modsLibrarySwitcherToggle.addEventListener('change', async () => {
        this.manager.settings.modsLibrarySwitcherEnabled =
          modsLibrarySwitcherToggle.checked;
        await this.manager.saveSettings();
        this.updateModsLibrarySwitcherUI();
      });
      modsLibrarySwitcherToggle.dataset.listenerAttached = 'true';
    }

    const browsePlugins = document.querySelector<HTMLElement>(
      '#browse-plugins-folder',
    );
    if (browsePlugins && !browsePlugins.dataset.listenerAttached) {
      browsePlugins.addEventListener('click', () => this.browsePluginsFolder());
      browsePlugins.dataset.listenerAttached = 'true';
      console.log('Browse plugins button listener attached');
    }

    const pluginsPathInput = document.querySelector<HTMLInputElement>(
      '#plugins-folder-path',
    );
    if (pluginsPathInput && !pluginsPathInput.dataset.manualListenerAttached) {
      pluginsPathInput.addEventListener('change', () =>
        this.updatePluginsFolderFromInput(pluginsPathInput.value),
      );
      pluginsPathInput.dataset.manualListenerAttached = 'true';
    }

    const exportModsListBtn = document.querySelector<HTMLElement>(
      '#export-mods-list-btn',
    );
    if (exportModsListBtn && !exportModsListBtn.dataset.listenerAttached) {
      exportModsListBtn.addEventListener('click', async () => {
        if (window.modManager) {
          await window.modManager.exportModsList();
        }
      });
      exportModsListBtn.dataset.listenerAttached = 'true';
      console.log('Export mods list button listener attached');
    }

    const bulkEnableModsBtn = document.querySelector<HTMLElement>(
      '#bulk-enable-mods-btn',
    );
    if (bulkEnableModsBtn && !bulkEnableModsBtn.dataset.listenerAttached) {
      bulkEnableModsBtn.addEventListener('click', async () => {
        if (window.modManager) {
          await window.modManager.setAllModsEnabled(true);
        }
      });
      bulkEnableModsBtn.dataset.listenerAttached = 'true';
      console.log('Bulk enable mods button listener attached');
    }

    const bulkDisableModsBtn = document.querySelector<HTMLElement>(
      '#bulk-disable-mods-btn',
    );
    if (bulkDisableModsBtn && !bulkDisableModsBtn.dataset.listenerAttached) {
      bulkDisableModsBtn.addEventListener('click', async () => {
        if (window.modManager) {
          await window.modManager.setAllModsEnabled(false);
        }
      });
      bulkDisableModsBtn.dataset.listenerAttached = 'true';
      console.log('Bulk disable mods button listener attached');
    }

    const batchTestingBtn =
      document.querySelector<HTMLElement>('#batch-testing-btn');
    if (batchTestingBtn && !batchTestingBtn.dataset.listenerAttached) {
      batchTestingBtn.addEventListener('click', async () => {
        if ((window as any).batchTestingManager) {
          await (window as any).batchTestingManager.openStartModal();
        }
      });
      batchTestingBtn.dataset.listenerAttached = 'true';
      console.log('Batch testing button listener attached');
    }

    const batchTestingResumeBtn = document.querySelector<HTMLElement>(
      '#batch-testing-resume-btn',
    );
    if (
      batchTestingResumeBtn &&
      !batchTestingResumeBtn.dataset.listenerAttached
    ) {
      batchTestingResumeBtn.addEventListener('click', async () => {
        if ((window as any).batchTestingManager) {
          await (window as any).batchTestingManager.resumeSession();
        }
      });
      batchTestingResumeBtn.dataset.listenerAttached = 'true';
      console.log('Batch testing resume button listener attached');
    }

    const batchTestingCancelBtn = document.querySelector<HTMLElement>(
      '#batch-testing-cancel-btn',
    );
    if (
      batchTestingCancelBtn &&
      !batchTestingCancelBtn.dataset.listenerAttached
    ) {
      batchTestingCancelBtn.addEventListener('click', async () => {
        if ((window as any).batchTestingManager) {
          await (window as any).batchTestingManager.cancelSession();
        }
      });
      batchTestingCancelBtn.dataset.listenerAttached = 'true';
      console.log('Batch testing cancel button listener attached');
    }

    if ((window as any).batchTestingManager?.refreshControlState) {
      (window as any).batchTestingManager.refreshControlState();
    }
  }

  async browseModsFolder() {
    if (!window.electronAPI || !window.electronAPI.selectFolder) {
      console.error('Electron API not available');
      return;
    }

    console.log('[SettingsManager] Browse mods folder requested');
    const folder = await window.electronAPI.selectFolder();
    if (folder) {
      console.log('[SettingsManager] Mods folder selected:', {
        previousPath: this.manager.settings.primaryModsPath,
        nextPath: folder,
      });
      await this.saveLibraryFolderPath('modsPath', folder, 'primary');
      this.updateModsFolderUI();
      this.checkModsPath(folder, { force: true });
    } else {
      console.log('[SettingsManager] Mods folder selection cancelled');
    }
  }

  async updateModsFolderFromInput(value) {
    const folder = value.trim();
    const currentPath = this.manager.switchSettings.isDirectSwitchLibraryMode()
      ? this.manager.settings.modsPath
      : this.manager.settings.primaryModsPath;
    if (!folder || folder === currentPath) {
      console.log('[SettingsManager] Mods folder manual change ignored:', {
        value,
        currentPath: this.manager.settings.primaryModsPath,
      });
      this.updateModsFolderUI();
      return;
    }

    console.log('[SettingsManager] Mods folder changed manually:', {
      previousPath: this.manager.settings.primaryModsPath,
      nextPath: folder,
    });
    await this.saveLibraryFolderPath('modsPath', folder, 'primary');
    this.updateModsFolderUI();
    this.checkModsPath(folder, { force: true });
  }

  async browseSecondaryModsFolder() {
    if (!window.electronAPI?.selectFolder) {
      console.error('Electron API not available');
      return;
    }

    const folder = await window.electronAPI.selectFolder();
    if (!folder) {
      return;
    }

    this.setConfiguredModsLibraryPath('secondary', folder);
    await this.manager.saveSettings();
    this.updateModsFolderUI();
    if (
      !this.manager.switchSettings.isDirectSwitchLibraryMode() &&
      this.manager.settings.activeModsLibrary === 'secondary'
    ) {
      await this.refreshModsListForPath(folder);
    }
    this.checkModsPath(folder, { force: true });
  }

  async updateSecondaryModsFolderFromInput(value) {
    const folder = value.trim();
    if (!folder || folder === this.manager.settings.secondaryModsPath) {
      this.updateModsFolderUI();
      return;
    }

    this.setConfiguredModsLibraryPath('secondary', folder);
    await this.manager.saveSettings();
    this.updateModsFolderUI();
    if (
      !this.manager.switchSettings.isDirectSwitchLibraryMode() &&
      this.manager.settings.activeModsLibrary === 'secondary'
    ) {
      await this.refreshModsListForPath(folder);
    }
    this.checkModsPath(folder, { force: true });
  }

  async refreshModsListForPath(modsPath) {
    if (!modsPath || !window.modManager?.loadModsFromFolder) {
      console.warn('[SettingsManager] Cannot refresh mods list:', {
        modsPath,
        hasModManager: !!window.modManager,
      });
      return;
    }

    try {
      console.log('[SettingsManager] Refreshing mods list for path:', modsPath);
      await window.modManager.loadModsFromFolder(modsPath);
      console.log('[SettingsManager] Mods list refreshed:', modsPath);
    } catch (error) {
      console.error('Failed to refresh mods after path change:', error);
    }
  }

  maybeWarnForCurrentModsPath() {
    const libraryTab = document.querySelector<HTMLElement>('#settings-library');
    if (!libraryTab?.classList.contains('active')) {
      return;
    }

    if (this.manager.settings.modsPath) {
      this.checkModsPath(this.manager.settings.modsPath);
    }
  }

  hasExpectedModsPathStructure(path) {
    const normalizedPath = path.toLowerCase().replace(/\\/g, '/');
    return (
      normalizedPath.includes('ultimate/mods') ||
      normalizedPath.includes('ultimate\\mods')
    );
  }

  shouldEnforceUltimateModsPath() {
    return !(
      this.manager.getAppRunMode() === 'hardware' &&
      this.manager.normalizeHardwareLibraryMode(
        this.manager.settings.hardwareLibraryMode,
      ) === 'local'
    );
  }

  checkModsPath(path, options: { force?: boolean } = {}) {
    if (
      !path ||
      this.manager.settings.libraryPathValidationEnabled === false ||
      !this.shouldEnforceUltimateModsPath() ||
      this.hasExpectedModsPathStructure(path)
    ) {
      return;
    }

    if (!options.force && this.manager.lastModsPathWarningPath === path) {
      return;
    }

    if (document.querySelector('.mods-path-warning-modal')) {
      return;
    }

    this.manager.lastModsPathWarningPath = path;
    this.showLibraryPathFixModal([
      {
        key: 'modsPath',
        label: this.manager.translate('settings.modsFolder'),
        currentPath: path,
        reason: this.manager.translate('settings.pathIssueWrongModsFolder'),
        required: true,
      },
    ]);
  }

  async validateConfiguredLibraryPaths() {
    if (
      this.manager.pathFixModalOpen ||
      this.manager.settings.libraryPathValidationEnabled === false ||
      this.manager.switchSettings.isDirectSwitchLibraryMode() ||
      !window.electronAPI?.checkPathAccessible
    ) {
      return;
    }

    const issues: Array<{
      key: 'modsPath' | 'pluginsPath';
      label: string;
      currentPath: string;
      reason: string;
      required: boolean;
    }> = [];

    const checkPath = async (
      key: 'modsPath' | 'pluginsPath',
      label: string,
      pathValue: string | null,
      required: boolean,
    ) => {
      if (!pathValue) {
        return;
      }

      const result = await window.electronAPI.checkPathAccessible(pathValue);
      if (!result.success || !result.accessible) {
        issues.push({
          key,
          label,
          currentPath: pathValue,
          reason: this.manager.translate('settings.pathIssueMissing'),
          required,
        });
        return;
      }

      if (
        key === 'modsPath' &&
        this.shouldEnforceUltimateModsPath() &&
        !this.hasExpectedModsPathStructure(pathValue)
      ) {
        issues.push({
          key,
          label,
          currentPath: pathValue,
          reason: this.manager.translate('settings.pathIssueWrongModsFolder'),
          required,
        });
      }
    };

    try {
      await checkPath(
        'modsPath',
        this.manager.translate('settings.modsFolder'),
        this.manager.settings.modsPath,
        true,
      );
      await checkPath(
        'pluginsPath',
        this.manager.translate('settings.pluginsFolder'),
        this.manager.settings.pluginsPath,
        true,
      );
    } catch (error) {
      console.error('Failed to validate configured library paths:', error);
      return;
    }

    if (issues.length > 0) {
      this.showLibraryPathFixModal(issues);
    }
  }

  showLibraryPathFixModal(
    issues: Array<{
      key: 'modsPath' | 'pluginsPath';
      label: string;
      currentPath: string;
      reason: string;
      required: boolean;
    }>,
  ) {
    if (this.manager.pathFixModalOpen || issues.length === 0) {
      return;
    }

    if (!window.modalManager?.showCustomModal) {
      this.manager.showToast(
        this.manager.translate('settings.pathWarning'),
        'error',
      );
      return;
    }

    this.manager.pathFixModalOpen = true;
    const selectedPaths = new Map<string, string>();

    const body = document.createElement('div');
    body.className = 'library-path-fix-modal';
    body.innerHTML = `
      <p class="library-path-fix-intro">${this.manager.escapeHtml(this.manager.translate('settings.libraryPathFixIntro'))}</p>
      ${issues
        .map(
          (issue) => `
          <div class="library-path-fix-row" data-path-key="${issue.key}">
            <div class="library-path-fix-header">
              <strong>${this.manager.escapeHtml(issue.label)}</strong>
              <span>${this.manager.escapeHtml(issue.reason)}</span>
            </div>
            <code>${this.manager.escapeHtml(issue.currentPath)}</code>
            <div class="library-path-fix-picker">
              <input class="settings-input" type="text" readonly value="" placeholder="${this.manager.escapeHtml(this.manager.translate('settings.chooseReplacementPath'))}">
              <button type="button" class="settings-btn" data-path-browse="${issue.key}">
                <i class="bi bi-folder2-open"></i>
                <span>${this.manager.escapeHtml(this.manager.translate('settings.browse'))}</span>
              </button>
            </div>
            <p class="settings-hint">${this.manager.escapeHtml(
              issue.key === 'modsPath'
                ? this.manager.translate('settings.modsPathFixHint')
                : this.manager.translate('settings.pluginsPathFixHint'),
            )}</p>
          </div>
        `,
        )
        .join('')}
    `;

    const modal = window.modalManager.showCustomModal({
      id: 'library-path-fix-modal',
      title: this.manager.translate('settings.libraryPathFixTitle'),
      body,
      clickOverlayToClose: false,
      escapeToClose: false,
      buttons: [
        {
          text: this.manager.translate('settings.saveCorrectedPaths'),
          type: 'primary',
          closeOnClick: false,
          onClick: async (_event, modalElement) => {
            const saved = await this.saveCorrectedLibraryPaths(
              issues,
              selectedPaths,
            );
            if (!saved) {
              return;
            }

            window.modalManager.closeModal(modalElement, {
              onModalClosed: () => {
                modalElement.remove();
                this.manager.pathFixModalOpen = false;
              },
            });
          },
        },
        {
          text: this.manager.translate('common.cancel') || 'Cancel',
          type: 'secondary',
          onClick: () => {
            this.manager.pathFixModalOpen = false;
          },
        },
      ],
    });

    modal
      .querySelectorAll<HTMLElement>('[data-path-browse]')
      .forEach((button) => {
        button.addEventListener('click', async () => {
          const key = button.dataset.pathBrowse;
          if (!key || !window.electronAPI?.selectFolder) {
            return;
          }

          const folder = await window.electronAPI.selectFolder();
          if (!folder) {
            return;
          }

          selectedPaths.set(key, folder);
          const row = modal.querySelector<HTMLElement>(
            `.library-path-fix-row[data-path-key="${key}"]`,
          );
          const input = row?.querySelector<HTMLInputElement>('input');
          if (input) {
            input.value = folder;
          }
        });
      });
  }

  async saveCorrectedLibraryPaths(
    issues: Array<{
      key: 'modsPath' | 'pluginsPath';
      label: string;
      currentPath: string;
      reason: string;
      required: boolean;
    }>,
    selectedPaths: Map<string, string>,
  ) {
    for (const issue of issues) {
      const nextPath = selectedPaths.get(issue.key);

      if (!nextPath) {
        if (issue.required) {
          this.manager.showToast(
            this.manager.translate('settings.selectReplacementPathRequired'),
            'error',
          );
          return false;
        }
        continue;
      }

      if (
        issue.key === 'modsPath' &&
        this.shouldEnforceUltimateModsPath() &&
        !this.hasExpectedModsPathStructure(nextPath)
      ) {
        this.manager.showToast(
          this.manager.translate('settings.pathIssueWrongModsFolder'),
          'error',
        );
        return false;
      }

      if (window.electronAPI?.folderExists) {
        const existsResult = await window.electronAPI.folderExists(nextPath);
        if (!existsResult.success || !existsResult.exists) {
          this.manager.showToast(
            this.manager.translate('settings.pathIssueMissing'),
            'error',
          );
          return false;
        }
      }

      this.setLibraryFolderPath(issue.key, nextPath);
    }

    await this.manager.saveSettings();
    this.updateModsFolderUI();
    this.updatePluginsFolderUI();
    await this.refreshCurrentLibraryLists();
    this.manager.showToast(
      this.manager.translate('toasts.libraryPathsUpdated'),
      'success',
    );
    return true;
  }

  async browsePluginsFolder() {
    if (!window.electronAPI || !window.electronAPI.selectFolder) {
      console.error('Electron API not available');
      return;
    }

    console.log('[SettingsManager] Browse plugins folder requested');
    const folder = await window.electronAPI.selectFolder();
    if (folder) {
      console.log('[SettingsManager] Plugins folder selected:', {
        previousPath: this.manager.settings.pluginsPath,
        nextPath: folder,
      });
      await this.saveLibraryFolderPath('pluginsPath', folder);
      this.updatePluginsFolderUI();
    } else {
      console.log('[SettingsManager] Plugins folder selection cancelled');
    }
  }

  async updatePluginsFolderFromInput(value) {
    const folder = value.trim();
    if (!folder || folder === this.manager.settings.pluginsPath) {
      console.log('[SettingsManager] Plugins folder manual change ignored:', {
        value,
        currentPath: this.manager.settings.pluginsPath,
      });
      this.updatePluginsFolderUI();
      return;
    }

    console.log('[SettingsManager] Plugins folder changed manually:', {
      previousPath: this.manager.settings.pluginsPath,
      nextPath: folder,
    });
    await this.saveLibraryFolderPath('pluginsPath', folder);
    this.updatePluginsFolderUI();
  }

  async refreshPluginsListForPath(folder: string | null) {
    if (!folder) {
      return;
    }
    try {
      console.log(
        '[SettingsManager] Refreshing plugins list for path:',
        folder,
      );
      await window.pluginManager?.loadPluginsFromFolder?.(folder);
      console.log('[SettingsManager] Plugins list refreshed:', folder);
    } catch (error) {
      console.error('Failed to refresh plugins after path change:', error);
    }
  }

  updateModsFolderUI() {
    const primaryInput =
      document.querySelector<HTMLInputElement>('#mods-folder-path');
    if (primaryInput) {
      primaryInput.value =
        this.manager.switchSettings.isDirectSwitchLibraryMode()
          ? this.manager.settings.modsPath || ''
          : this.manager.settings.primaryModsPath || '';
    }

    const secondaryInput = document.querySelector<HTMLInputElement>(
      '#secondary-mods-folder-path',
    );
    if (secondaryInput) {
      secondaryInput.value = this.manager.settings.secondaryModsPath || '';
    }

    const switcherToggle = document.querySelector<HTMLInputElement>(
      '#mods-library-switcher-enabled',
    );
    if (switcherToggle) {
      switcherToggle.checked =
        this.manager.settings.modsLibrarySwitcherEnabled === true;
    }

    this.updateModsLibrarySwitcherUI();
    this.maybeWarnForCurrentModsPath();
  }

  initializeModsLibrarySwitcher() {
    const button = document.querySelector<HTMLButtonElement>(
      '#mods-library-switch-btn',
    );
    if (!button) {
      return;
    }

    if (!button.dataset.listenerAttached) {
      button.addEventListener('click', () => this.switchModsLibrary());
      button.dataset.listenerAttached = 'true';
    }

    if (!this.manager.libraryLocaleListenerAttached) {
      window.addEventListener('localeChanged', () => {
        this.updateModsLibrarySwitcherUI();
      });
      this.manager.libraryLocaleListenerAttached = true;
    }

    this.manager.readyPromise.then(() => this.updateModsLibrarySwitcherUI());
  }

  updateModsLibrarySwitcherUI() {
    const switcherEnabled =
      this.manager.settings.modsLibrarySwitcherEnabled === true;
    const secondaryFolderSection = document.querySelector<HTMLElement>(
      '#secondary-mods-folder-section',
    );
    if (secondaryFolderSection) {
      secondaryFolderSection.hidden = !switcherEnabled;
    }

    const button = document.querySelector<HTMLButtonElement>(
      '#mods-library-switch-btn',
    );
    if (!button) {
      return;
    }

    button.hidden = !switcherEnabled;
    if (button.hidden) {
      return;
    }

    const label = button.querySelector<HTMLElement>(
      '.mods-library-switch-label',
    );
    const directMode = this.manager.switchSettings.isDirectSwitchLibraryMode();
    const activeLibrary = this.manager.normalizeActiveModsLibrary(
      this.manager.settings.activeModsLibrary,
    );
    const targetLibrary = activeLibrary === 'primary' ? 'secondary' : 'primary';
    const targetPath = this.getConfiguredModsLibraryPath(targetLibrary);
    const activeLabel = directMode
      ? this.manager.translate('tools.directSwitchLibrary')
      : this.manager.translate(`tools.${activeLibrary}Library`);
    const targetLabel = this.manager.translate(`tools.${targetLibrary}Library`);

    if (label) {
      label.removeAttribute('data-i18n');
      label.textContent = activeLabel;
    }

    button.dataset.activeLibrary = directMode ? 'direct' : activeLibrary;
    button.classList.toggle('is-unconfigured', !directMode && !targetPath);
    button.disabled = directMode;

    const accessibleLabel = directMode
      ? this.manager.translate('tools.directSwitchLibraryHint')
      : targetPath
        ? `${this.manager.translate('tools.switchLibrary')} ${targetLabel}`
        : `${this.manager.translate('tools.configureLibrary')} ${targetLabel}`;
    button.title = accessibleLabel;
    button.setAttribute('aria-label', accessibleLabel);
  }

  async switchModsLibrary() {
    await this.manager.readyPromise;

    if (this.manager.switchSettings.isDirectSwitchLibraryMode()) {
      return;
    }

    const currentLibrary = this.manager.normalizeActiveModsLibrary(
      this.manager.settings.activeModsLibrary,
    );
    const targetLibrary =
      currentLibrary === 'primary' ? 'secondary' : 'primary';
    const targetPath = this.getConfiguredModsLibraryPath(targetLibrary);

    if (!targetPath) {
      this.manager.showToast(
        this.manager.translate('toasts.configureSecondaryModsLibrary'),
        'warning',
      );
      document
        .querySelector<HTMLElement>('.sidebar-btn[data-tab="settings"]')
        ?.click();
      setTimeout(() => this.manager.switchSettingsTab('library'), 100);
      return;
    }

    this.manager.settings.activeModsLibrary = targetLibrary;
    this.manager.settings.modsPath = targetPath;
    await this.manager.saveSettings();
    this.updateModsLibrarySwitcherUI();
    await this.refreshModsListForPath(targetPath);
    this.manager.showToast(
      this.manager.translate(`toasts.${targetLibrary}ModsLibraryActive`),
      'success',
    );
  }

  updatePluginsFolderUI() {
    const input = document.querySelector<HTMLInputElement>(
      '#plugins-folder-path',
    );
    if (input) {
      input.value = this.manager.settings.pluginsPath || '';
    }
  }

  updateHardwareLibraryModeUI() {
    const hardwareLibraryModeSelect = document.querySelector<HTMLElement>(
      '#hardware-library-mode-select',
    );
    if (!hardwareLibraryModeSelect) {
      return;
    }

    const selectedValue =
      hardwareLibraryModeSelect.querySelector<HTMLElement>('.selected-value');
    const options = hardwareLibraryModeSelect.querySelectorAll<HTMLElement>(
      '.custom-select-option',
    );
    const currentMode = this.manager.getHardwareLibraryMode();
    const ftpOnly = this.manager.getSwitchTransferMethod() === 'ftp';

    options.forEach((option) => {
      const unavailable = ftpOnly && option.dataset.value === 'direct';
      option.hidden = unavailable;
      option.style.display = unavailable ? 'none' : '';
      option.setAttribute('aria-disabled', String(unavailable));
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

    const hint = document.querySelector<HTMLElement>(
      '#hardware-library-mode-hint',
    );
    if (hint) {
      const key = ftpOnly
        ? 'settings.hardwareLibraryModeFtpHint'
        : 'settings.hardwareLibraryModeHint';
      hint.dataset.i18n = key;
      hint.textContent = this.manager.translate(key);
    }
  }

  updateHardwareLibraryModeVisibility() {
    const section = document.querySelector<HTMLElement>(
      '#hardware-library-mode-section',
    );
    if (!section) {
      return;
    }

    section.style.display =
      this.manager.getAppRunMode() === 'hardware' ? '' : 'none';
  }

  applyHardwareLibraryModePaths() {
    if (
      this.manager.getSwitchTransferMethod() === 'ftp' &&
      this.manager.settings.hardwareLibraryMode === 'direct' &&
      this.manager.directLibraryPathsApplied === null
    ) {
      // Restore the PC library when loading an older FTP + direct configuration.
      this.manager.directLibraryPathsApplied = true;
      const activeLibrary = this.manager.settings.activeModsLibrary;
      if (
        this.getConfiguredModsLibraryPath(activeLibrary) ===
        this.manager.settings.modsPath
      ) {
        this.setConfiguredModsLibraryPath(
          activeLibrary,
          this.manager.settings.localModsPath,
        );
      }
    }
    this.manager.settings.hardwareLibraryMode =
      this.manager.getHardwareLibraryMode();
    const directMode = this.manager.switchSettings.isDirectSwitchLibraryMode();
    if (directMode) {
      this.manager.switchSettings.syncSwitchDriveFromLibraryPaths();

      const switchModsPath =
        this.manager.switchSettings.getSwitchModsLibraryPath();
      const switchPluginsPath =
        this.manager.switchSettings.getSwitchPluginsLibraryPath();

      // Capture local paths when entering direct mode, never on subsequent saves.
      if (this.manager.directLibraryPathsApplied !== true) {
        if (
          this.manager.settings.modsPath &&
          this.manager.settings.modsPath !== switchModsPath &&
          (this.manager.directLibraryPathsApplied === false ||
            !this.manager.settings.localModsPath)
        ) {
          this.manager.settings.localModsPath = this.manager.settings.modsPath;
        }
        if (
          this.manager.settings.pluginsPath &&
          this.manager.settings.pluginsPath !== switchPluginsPath &&
          (this.manager.directLibraryPathsApplied === false ||
            !this.manager.settings.localPluginsPath)
        ) {
          this.manager.settings.localPluginsPath =
            this.manager.settings.pluginsPath;
        }
      }
      this.manager.settings.modsPath = switchModsPath;
      this.manager.settings.pluginsPath = switchPluginsPath;
    } else {
      if (
        this.manager.directLibraryPathsApplied === true ||
        (this.manager.directLibraryPathsApplied === null &&
          this.manager.settings.localModsPath &&
          this.manager.settings.modsPath ===
            this.manager.switchSettings.getSwitchModsLibraryPath())
      ) {
        this.manager.settings.modsPath =
          this.manager.settings.localModsPath ||
          this.getConfiguredModsLibraryPath(
            this.manager.settings.activeModsLibrary,
          );
      }

      if (
        this.manager.directLibraryPathsApplied === true ||
        (this.manager.directLibraryPathsApplied === null &&
          this.manager.settings.localPluginsPath &&
          this.manager.settings.pluginsPath ===
            this.manager.switchSettings.getSwitchPluginsLibraryPath())
      ) {
        this.manager.settings.pluginsPath =
          this.manager.settings.localPluginsPath || null;
      }
    }
    this.manager.directLibraryPathsApplied = directMode;

    this.updateModsFolderUI();
    this.updatePluginsFolderUI();
    this.updateHardwareLibraryModeUI();
  }

  async refreshCurrentLibraryLists() {
    if (this.manager.settings.modsPath) {
      await this.refreshModsListForPath(this.manager.settings.modsPath);
    } else {
      await window.modManager?.fetchMods?.();
    }

    if (
      this.manager.settings.pluginsPath &&
      window.pluginManager?.loadPluginsFromFolder
    ) {
      await window.pluginManager.loadPluginsFromFolder(
        this.manager.settings.pluginsPath,
      );
    } else if (!this.manager.settings.pluginsPath) {
      await window.pluginManager?.fetchPlugins?.();
    }
  }
}
