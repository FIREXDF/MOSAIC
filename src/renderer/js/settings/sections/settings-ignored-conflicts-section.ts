class SettingsIgnoredConflictsSection {
  manager: Window['settingsManager'];

  constructor(manager: Window['settingsManager']) {
    this.manager = manager;
  }

  sanitizeIgnoredConflictPath(value: string) {
    return value
      .split(/[\\/]/)
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0)
      .join('/');
  }

  async updateIgnoredConflictPathsStorage(
    options = { refreshConflicts: true },
  ) {
    if (!this.manager.initialized) {
      return false;
    }

    try {
      await window.electronAPI.store.set(
        'ignoredConflictPaths',
        this.manager.settings.ignoredConflictPaths,
      );
      this.renderIgnoredConflictPaths();

      if (options.refreshConflicts) {
        await this.refreshConflictDetection();
      }

      return true;
    } catch (error) {
      console.error('Failed to persist ignored conflict paths:', error);
      this.manager.showToast(
        this.manager.translate('toasts.failedToSaveSetting'),
        'error',
      );
      this.renderIgnoredConflictPaths();
      return false;
    }
  }

  async addIgnoredConflictPath(
    value: string,
    options = { refreshConflicts: true },
  ) {
    const sanitized = this.sanitizeIgnoredConflictPath(value.trim());
    if (!sanitized) {
      this.manager.showToast(
        this.manager.translate('settings.invalidPath'),
        'error',
      );
      return false;
    }

    if (this.manager.settings.ignoredConflictPaths.includes(sanitized)) {
      this.manager.showToast(
        this.manager.translate('settings.ignoredConflictExists'),
        'info',
      );
      return false;
    }

    this.manager.settings.ignoredConflictPaths.push(sanitized);
    const saved = await this.updateIgnoredConflictPathsStorage(options);
    if (saved) {
      this.manager.showToast(
        this.manager.translate('settings.ignoredConflictAdded'),
        'success',
      );
    }
    return saved;
  }

  async removeIgnoredConflictPath(value: string) {
    const nextList = this.manager.settings.ignoredConflictPaths.filter(
      (entry) => entry !== value,
    );

    if (nextList.length === this.manager.settings.ignoredConflictPaths.length) {
      return false;
    }

    this.manager.settings.ignoredConflictPaths = nextList;
    const saved = await this.updateIgnoredConflictPathsStorage();
    if (saved) {
      this.manager.showToast(
        this.manager.translate('settings.ignoredConflictRemoved'),
        'success',
      );
    }
    return saved;
  }

  async clearIgnoredConflictPaths() {
    if (!this.manager.settings.ignoredConflictPaths.length) {
      return false;
    }

    this.manager.settings.ignoredConflictPaths = [];
    const saved = await this.updateIgnoredConflictPathsStorage();
    if (saved) {
      this.manager.showToast(
        this.manager.translate('settings.ignoredConflictsCleared'),
        'success',
      );
    }
    return saved;
  }

  async refreshConflictDetection() {
    if (
      !this.manager.settings.conflictDetectionEnabled ||
      !window.modManager?.checkConflicts
    ) {
      return;
    }

    const whitelistPatterns =
      this.manager.settings.conflictWhitelistPatterns || [];
    await window.modManager.checkConflicts(whitelistPatterns);
  }

  initializeIgnoredConflictsUI() {
    const addButton = document.querySelector<HTMLElement>(
      '#ignored-conflict-add-btn',
    );
    const input = document.querySelector<HTMLInputElement>(
      '#ignored-conflict-input',
    );
    const clearButton = document.querySelector<HTMLElement>(
      '#ignored-conflict-clear-btn',
    );

    if (addButton && !addButton.dataset.listenerAttached) {
      addButton.addEventListener('click', async () => {
        if (!input) {
          return;
        }

        const added = await this.addIgnoredConflictPath(input.value);
        if (added) {
          input.value = '';
        }
      });
      addButton.dataset.listenerAttached = 'true';
    }

    if (input && !input.dataset.listenerAttached) {
      input.addEventListener('keydown', async (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          const added = await this.addIgnoredConflictPath(input.value);
          if (added) {
            input.value = '';
          }
        }
      });
      input.dataset.listenerAttached = 'true';
    }

    if (clearButton && !clearButton.dataset.listenerAttached) {
      clearButton.addEventListener('click', async () => {
        await this.clearIgnoredConflictPaths();
      });
      clearButton.dataset.listenerAttached = 'true';
    }

    this.renderIgnoredConflictPaths();
  }

  renderIgnoredConflictPaths() {
    const listContainer = document.querySelector<HTMLElement>(
      '#ignored-conflict-list',
    );

    if (!listContainer) {
      return;
    }

    listContainer.replaceChildren();

    if (!this.manager.settings.ignoredConflictPaths.length) {
      const empty = document.createElement('div');
      empty.className = 'ignored-conflicts-empty';
      empty.textContent = this.manager.translate(
        'settings.ignoredConflictEmpty',
      );
      listContainer.appendChild(empty);
      return;
    }

    this.manager.settings.ignoredConflictPaths
      .slice()
      .sort((a, b) => a.localeCompare(b))
      .forEach((value) => {
        const item = document.createElement('div');
        item.className = 'ignored-conflict-item';

        const pathText = document.createElement('span');
        pathText.className = 'ignored-conflict-path';
        pathText.textContent = value;

        const actions = document.createElement('div');
        actions.className = 'ignored-conflict-actions';

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'ignored-conflict-remove-btn';
        removeBtn.setAttribute(
          'aria-label',
          this.manager.translate('common.remove'),
        );
        removeBtn.innerHTML = '<i class="bi bi-x-lg"></i>';
        removeBtn.addEventListener('click', () => {
          this.removeIgnoredConflictPath(value);
        });

        actions.appendChild(removeBtn);
        item.appendChild(pathText);
        item.appendChild(actions);
        listContainer.appendChild(item);
      });
  }
}
