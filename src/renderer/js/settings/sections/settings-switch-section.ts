class SettingsSwitchSection {
  manager: Window['settingsManager'];

  constructor(manager: Window['settingsManager']) {
    this.manager = manager;
  }

  bindSwitchSettings() {
    const switchIp = document.querySelector<HTMLInputElement>('#switch-ip');
    if (switchIp && !switchIp.dataset.listenerAttached) {
      switchIp.addEventListener('change', () => {
        this.manager.settings.switchIp = switchIp.value;
        this.manager.saveSettings();
      });
      switchIp.dataset.listenerAttached = 'true';
    }

    const switchPort = document.querySelector<HTMLInputElement>('#switch-port');
    if (switchPort && !switchPort.dataset.listenerAttached) {
      switchPort.addEventListener('change', () => {
        this.manager.settings.switchPort = switchPort.value || '5000';
        this.manager.saveSettings();
      });
      switchPort.dataset.listenerAttached = 'true';
    }

    const switchFtpUser =
      document.querySelector<HTMLInputElement>('#switch-ftp-user');
    if (switchFtpUser && !switchFtpUser.dataset.listenerAttached) {
      switchFtpUser.addEventListener('change', () => {
        this.manager.settings.switchFtpUser =
          switchFtpUser.value.trim() || null;
        this.manager.saveSettings();
      });
      switchFtpUser.dataset.listenerAttached = 'true';
    }

    const switchFtpPassword = document.querySelector<HTMLInputElement>(
      '#switch-ftp-password',
    );
    if (switchFtpPassword && !switchFtpPassword.dataset.listenerAttached) {
      switchFtpPassword.addEventListener('change', () => {
        this.manager.settings.switchFtpPassword =
          switchFtpPassword.value || null;
        this.manager.saveSettings();
      });
      switchFtpPassword.dataset.listenerAttached = 'true';
    }

    const switchFtpPath =
      document.querySelector<HTMLInputElement>('#switch-ftp-path');
    if (switchFtpPath && !switchFtpPath.dataset.listenerAttached) {
      switchFtpPath.addEventListener('change', () => {
        this.manager.settings.switchFtpModsPath =
          switchFtpPath.value.trim() || null;
        this.manager.saveSettings();
      });
      switchFtpPath.dataset.listenerAttached = 'true';
    }

    const switchFtpPluginsPath = document.querySelector<HTMLInputElement>(
      '#switch-ftp-plugins-path',
    );
    if (
      switchFtpPluginsPath &&
      !switchFtpPluginsPath.dataset.listenerAttached
    ) {
      switchFtpPluginsPath.addEventListener('change', () => {
        this.manager.settings.switchFtpPluginsPath =
          switchFtpPluginsPath.value.trim() || null;
        this.manager.saveSettings();
      });
      switchFtpPluginsPath.dataset.listenerAttached = 'true';
    }

    const switchTransferMethodSelect = document.querySelector<HTMLElement>(
      '#switch-transfer-method-select',
    );
    if (
      switchTransferMethodSelect &&
      !switchTransferMethodSelect.dataset.listenerAttached
    ) {
      const trigger = switchTransferMethodSelect.querySelector<HTMLElement>(
        '.custom-select-trigger',
      );
      const options = switchTransferMethodSelect.querySelectorAll<HTMLElement>(
        '.custom-select-option',
      );
      const selectedValue =
        switchTransferMethodSelect.querySelector<HTMLElement>(
          '.selected-value',
        );

      if (trigger) {
        trigger.addEventListener('click', (e) => {
          e.stopPropagation();
          switchTransferMethodSelect.classList.toggle('open');
        });
      }

      document.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (!switchTransferMethodSelect.contains(target)) {
          switchTransferMethodSelect.classList.remove('open');
        }
      });

      options.forEach((option) => {
        option.addEventListener('click', async () => {
          const value = this.manager.normalizeSwitchTransferMethod(
            option.dataset.value,
          );
          const previousDirectMode = this.isDirectSwitchLibraryMode();
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

          switchTransferMethodSelect.classList.remove('open');

          this.manager.settings.switchTransferMethod = value;
          await this.manager.saveSettings();
          this.updateSwitchTransferMethodUI();
          if (previousDirectMode && !this.isDirectSwitchLibraryMode()) {
            await this.manager.librarySettings.refreshCurrentLibraryLists();
          }
        });
      });

      switchTransferMethodSelect.dataset.listenerAttached = 'true';
    }

    const switchSyncModeSelect = document.querySelector<HTMLElement>(
      '#switch-sync-mode-select',
    );
    if (
      switchSyncModeSelect &&
      !switchSyncModeSelect.dataset.listenerAttached
    ) {
      const trigger = switchSyncModeSelect.querySelector<HTMLElement>(
        '.custom-select-trigger',
      );
      const options = switchSyncModeSelect.querySelectorAll<HTMLElement>(
        '.custom-select-option',
      );

      trigger?.addEventListener('click', (event) => {
        event.stopPropagation();
        switchSyncModeSelect.classList.toggle('open');
      });
      document.addEventListener('click', (event) => {
        if (!switchSyncModeSelect.contains(event.target as Node)) {
          switchSyncModeSelect.classList.remove('open');
        }
      });
      options.forEach((option) => {
        option.addEventListener('click', () => {
          this.manager.settings.switchSyncMode =
            this.manager.normalizeSwitchSyncMode(option.dataset.value);
          switchSyncModeSelect.classList.remove('open');
          this.updateSwitchSyncModeUI();
          this.manager.saveSettings();
        });
      });
      switchSyncModeSelect.dataset.listenerAttached = 'true';
    }

    const switchDriveLetterSelect = document.querySelector<HTMLElement>(
      '#switch-drive-letter-select',
    );
    if (
      switchDriveLetterSelect &&
      !switchDriveLetterSelect.dataset.listenerAttached
    ) {
      const trigger = switchDriveLetterSelect.querySelector<HTMLElement>(
        '.custom-select-trigger',
      );
      const optionsContainer = document.querySelector<HTMLElement>(
        '#switch-drive-letter-options',
      );
      const selectedValue =
        switchDriveLetterSelect.querySelector<HTMLElement>('.selected-value');

      if (trigger) {
        trigger.addEventListener('click', async (e) => {
          e.stopPropagation();
          switchDriveLetterSelect.classList.toggle('open');

          if (
            switchDriveLetterSelect.classList.contains('open') &&
            optionsContainer
          ) {
            if (!this.manager.drivesLoaded) {
              await this.loadAvailableDrives();
              this.manager.drivesLoaded = true;
            }
          }
        });
      }

      document.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (!switchDriveLetterSelect.contains(target)) {
          switchDriveLetterSelect.classList.remove('open');
        }
      });

      switchDriveLetterSelect.dataset.listenerAttached = 'true';
    }

    const switchDriveGuideBtn = document.querySelector<HTMLButtonElement>(
      '#switch-drive-guide-btn',
    );
    if (switchDriveGuideBtn && !switchDriveGuideBtn.dataset.listenerAttached) {
      switchDriveGuideBtn.addEventListener('click', () => {
        this.showSwitchDriveGuideChoiceModal();
      });
      switchDriveGuideBtn.dataset.listenerAttached = 'true';
    }
  }

  showSwitchSyncReconnectModal() {
    if (!window.modalManager?.showCustomModal) {
      window.toastManager?.warning?.(
        'toasts.reconnectSwitchBeforeSyncToPc',
        8000,
      );
      return;
    }

    const body = document.createElement('div');
    body.className = 'switch-sync-reconnect-modal';

    const message = document.createElement('p');
    message.textContent = this.manager.translate(
      'settings.switchSyncReconnectMessage',
    );

    const hint = document.createElement('p');
    hint.className = 'settings-hint';
    hint.textContent = this.manager.translate(
      'settings.switchSyncReconnectHint',
    );

    body.append(message, hint);

    window.modalManager.showCustomModal({
      id: 'switch-sync-reconnect-modal',
      title: this.manager.translate('settings.switchSyncReconnectTitle'),
      body,
      size: 'normal',
      buttons: [
        {
          text: this.manager.translate('settings.switchDriveGuideButton'),
          type: 'primary',
          onClick: (_event, modal) => {
            window.modalManager.closeModal(modal, {
              onModalClosed: () => {
                modal.remove();
                this.showSwitchDriveGuideChoiceModal();
              },
            });
            return false;
          },
        },
        {
          text: this.manager.translate('common.close') || 'Close',
          type: 'secondary',
        },
      ],
    });
  }

  updateSwitchSettingsUI() {
    const switchIpInput =
      document.querySelector<HTMLInputElement>('#switch-ip');
    if (switchIpInput && this.manager.settings.switchIp) {
      switchIpInput.value = this.manager.settings.switchIp;
    }

    const switchPortInput =
      document.querySelector<HTMLInputElement>('#switch-port');
    if (switchPortInput && this.manager.settings.switchPort) {
      switchPortInput.value = this.manager.settings.switchPort;
    }

    const switchFtpUserInput =
      document.querySelector<HTMLInputElement>('#switch-ftp-user');
    if (switchFtpUserInput) {
      switchFtpUserInput.value = this.manager.settings.switchFtpUser || '';
    }

    const switchFtpPasswordInput = document.querySelector<HTMLInputElement>(
      '#switch-ftp-password',
    );
    if (switchFtpPasswordInput) {
      switchFtpPasswordInput.value =
        this.manager.settings.switchFtpPassword || '';
    }

    const switchFtpPathInput =
      document.querySelector<HTMLInputElement>('#switch-ftp-path');
    if (switchFtpPathInput) {
      switchFtpPathInput.value =
        this.manager.settings.switchFtpModsPath ||
        this.manager.settings.switchFtpPath ||
        '';
    }

    const switchFtpPluginsPathInput = document.querySelector<HTMLInputElement>(
      '#switch-ftp-plugins-path',
    );
    if (switchFtpPluginsPathInput) {
      switchFtpPluginsPathInput.value =
        this.manager.settings.switchFtpPluginsPath || '';
    }
  }

  updateSwitchTransferMethodUI() {
    const transferMethod = this.manager.settings.switchTransferMethod || 'none';
    const transferMethodSelect = document.querySelector<HTMLElement>(
      '#switch-transfer-method-select',
    );
    const ftpSettings = document.querySelector<HTMLElement>(
      '#switch-ftp-settings',
    );
    const driveSettings = document.querySelector<HTMLElement>(
      '#switch-drive-settings',
    );
    const destinationSettings = document.querySelector<HTMLElement>(
      '#switch-destination-settings',
    );

    if (transferMethodSelect) {
      const selectedValue =
        transferMethodSelect.querySelector<HTMLElement>('.selected-value');
      const options = transferMethodSelect.querySelectorAll<HTMLElement>(
        '.custom-select-option',
      );

      let foundOption = false;
      options.forEach((option) => {
        if (option.dataset.value === transferMethod) {
          option.classList.add('active');
          if (selectedValue) {
            selectedValue.textContent =
              option.querySelector<HTMLElement>('span')!.textContent;
          }
          foundOption = true;
        } else {
          option.classList.remove('active');
        }
      });

      if (!foundOption && selectedValue && transferMethod === 'none') {
        selectedValue.textContent = 'Select method...';
      }
    }

    if (ftpSettings) {
      ftpSettings.style.display = transferMethod === 'ftp' ? 'block' : 'none';
    }
    if (driveSettings) {
      driveSettings.style.display =
        transferMethod === 'drive' ? 'block' : 'none';
    }
    if (destinationSettings) {
      destinationSettings.style.display =
        transferMethod === 'none' ? 'none' : 'block';
    }

    if (transferMethod === 'drive') {
      this.updateSwitchDriveLetterUI();
    }
    this.manager.librarySettings.updateHardwareLibraryModeUI();
  }

  updateSwitchSyncModeUI() {
    const syncMode = this.manager.normalizeSwitchSyncMode(
      this.manager.settings.switchSyncMode,
    );
    const select = document.querySelector<HTMLElement>(
      '#switch-sync-mode-select',
    );
    if (!select) {
      return;
    }

    const selectedValue = select.querySelector<HTMLElement>('.selected-value');
    const selectedDescription = select.querySelector<HTMLElement>(
      '.selected-description',
    );
    const options = select.querySelectorAll<HTMLElement>(
      '.custom-select-option',
    );
    options.forEach((option) => {
      const active = option.dataset.value === syncMode;
      option.classList.toggle('active', active);
      if (active && selectedValue) {
        const label = option.querySelector<HTMLElement>(
          '[data-sync-mode-label]',
        );
        const description = option.querySelector<HTMLElement>(
          '[data-sync-mode-description]',
        );
        selectedValue.textContent = label?.textContent || '';
        if (label?.dataset.i18n) {
          selectedValue.dataset.i18n = label.dataset.i18n;
        }
        if (selectedDescription) {
          selectedDescription.textContent = description?.textContent || '';
          if (description?.dataset.i18n) {
            selectedDescription.dataset.i18n = description.dataset.i18n;
          }
        }
      }
    });
  }

  showSwitchDriveGuideChoiceModal() {
    if (!window.modalManager?.showCustomModal) {
      this.manager.showToast(
        this.manager.translate('settings.switchDriveGuideUnavailable'),
        'error',
      );
      return;
    }

    const body = document.createElement('div');
    body.className = 'switch-drive-guide-choice';
    body.innerHTML = `
      <button type="button" class="switch-drive-guide-option" id="switch-drive-guide-hekate">
        <i class="bi bi-usb-symbol"></i>
        <span>
          <strong>${this.manager.translate('settings.switchDriveGuideHekate')}</strong>
          <small>${this.manager.translate('settings.switchDriveGuideHekateDesc')}</small>
        </span>
      </button>
      <button type="button" class="switch-drive-guide-option switch-drive-guide-option-disabled" id="switch-drive-guide-homebrew">
        <i class="bi bi-hourglass-split"></i>
        <span>
          <strong>${this.manager.translate('settings.switchDriveGuideHomebrew')}</strong>
          <small>${this.manager.translate('settings.switchDriveGuideHomebrewDesc')}</small>
        </span>
      </button>
    `;

    const modal = window.modalManager.showCustomModal({
      id: 'switch-drive-guide-choice-modal',
      title: this.manager.translate('settings.switchDriveGuideTitle'),
      body,
      size: 'normal',
      buttons: [
        {
          text: this.manager.translate('common.cancel') || 'Cancel',
          type: 'secondary',
        },
      ],
    });

    modal
      .querySelector<HTMLElement>('#switch-drive-guide-hekate')
      ?.addEventListener('click', () => {
        window.modalManager.closeModal(modal, {
          onModalClosed: () => {
            modal.remove();
            this.showSwitchDriveHekateGuideModal();
          },
        });
      });

    modal
      .querySelector<HTMLElement>('#switch-drive-guide-homebrew')
      ?.addEventListener('click', () => {
        this.manager.showToast(
          this.manager.translate('settings.switchDriveGuideHomebrewPending'),
          'info',
        );
      });
  }

  showSwitchDriveHekateGuideModal() {
    if (!window.modalManager?.showCustomModal) {
      this.manager.showToast(
        this.manager.translate('settings.switchDriveGuideUnavailable'),
        'error',
      );
      return;
    }

    const body = document.createElement('div');
    body.className = 'switch-drive-hekate-guide';
    body.innerHTML = `
      <div id="switch-drive-guide-lottie" class="switch-drive-guide-lottie"></div>
      <p class="switch-drive-guide-status" id="switch-drive-guide-status">
        ${this.manager.translate('settings.switchDriveGuidePlaying')}
      </p>
    `;

    const modal = window.modalManager.showCustomModal({
      id: 'switch-drive-hekate-guide-modal',
      title: this.manager.translate('settings.switchDriveGuideHekateTitle'),
      body,
      size: 'large',
      clickOverlayToClose: false,
      buttons: [
        {
          id: 'switch-drive-guide-next',
          text: this.manager.translate('settings.switchDriveGuideNext'),
          type: 'primary',
          closeOnClick: false,
          onClick: async (_e, modalElement) => {
            await this.completeSwitchDriveGuide(modalElement);
          },
        },
        {
          text: this.manager.translate('common.cancel') || 'Cancel',
          type: 'secondary',
        },
      ],
      onClose: () => {
        const anim = (modal as any).__switchDriveGuideAnimation;
        if (anim?.destroy) {
          anim.destroy();
        }
      },
    });

    const nextBtn = modal.querySelector<HTMLButtonElement>(
      '#switch-drive-guide-next',
    );
    const status = modal.querySelector<HTMLElement>(
      '#switch-drive-guide-status',
    );
    if (nextBtn) {
      nextBtn.disabled = true;
      nextBtn.classList.add('disabled');
    }

    const lottieContainer = modal.querySelector<HTMLElement>(
      '#switch-drive-guide-lottie',
    );
    if (lottieContainer && window.lottie) {
      const anim = window.lottie.loadAnimation({
        container: lottieContainer,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        path: '../images/guided_recomended.json',
      });
      (modal as any).__switchDriveGuideAnimation = anim;

      const unlockNext = () => {
        if (nextBtn) {
          nextBtn.disabled = false;
          nextBtn.classList.remove('disabled');
        }
        if (status) {
          status.textContent = this.manager.translate(
            'settings.switchDriveGuideReady',
          );
        }
        anim.removeEventListener?.('loopComplete', unlockNext);
      };

      anim.addEventListener?.('loopComplete', unlockNext);
    } else {
      if (nextBtn) {
        nextBtn.disabled = false;
        nextBtn.classList.remove('disabled');
      }
      if (status) {
        status.textContent = this.manager.translate(
          'settings.switchDriveGuideReady',
        );
      }
    }
  }

  async completeSwitchDriveGuide(modal: HTMLElement) {
    const nextBtn = modal.querySelector<HTMLButtonElement>(
      '#switch-drive-guide-next',
    );
    const status = modal.querySelector<HTMLElement>(
      '#switch-drive-guide-status',
    );

    if (nextBtn?.disabled) {
      return;
    }

    if (nextBtn) {
      nextBtn.disabled = true;
      nextBtn.classList.add('disabled');
      nextBtn.textContent = this.manager.translate(
        'settings.switchDriveGuideDetecting',
      );
    }
    if (status) {
      status.textContent = this.manager.translate(
        'settings.switchDriveGuideDetecting',
      );
    }

    this.manager.settings.switchTransferMethod = 'drive';
    this.updateSwitchTransferMethodUI();
    await this.manager.saveSettings();
    window.modalManager.closeModal(modal, {
      onModalClosed: () => {
        modal.remove();
        this.showSwitchUsbDeviceModal();
      },
    });
  }

  async getAvailableSwitchDrives() {
    if (!window.electronAPI?.getAvailableDrives) {
      throw new Error('Drive detection is not available.');
    }

    const result = await window.electronAPI.getAvailableDrives();
    if (!result?.success || !Array.isArray(result.drives)) {
      throw new Error('Drive detection failed.');
    }

    return result.drives;
  }

  getSwitchDriveDisplayText(drive) {
    if (drive.path && drive.path.includes(':\\')) {
      return `${drive.letter}: (${drive.label || 'Unknown'})`;
    }

    if (drive.path && drive.path.startsWith('/')) {
      return `${drive.path} (${drive.label || 'Unknown'})`;
    }

    return `${drive.letter} (${drive.label || 'Unknown'})`;
  }

  getSwitchDriveIdentifier(drive) {
    if (drive.path && drive.path.startsWith('/')) {
      return drive.path;
    }

    return drive.letter;
  }

  async showSwitchUsbDeviceModal() {
    if (!window.modalManager?.showCustomModal) {
      this.manager.showToast(
        this.manager.translate('settings.switchDriveGuideUnavailable'),
        'error',
      );
      return;
    }

    const body = document.createElement('div');
    body.className = 'switch-usb-device-picker';
    body.innerHTML = `
      <p class="switch-usb-device-picker-hint">
        ${this.manager.translate('settings.switchUsbDevicePickerHint')}
      </p>
      <div class="switch-usb-device-list" id="switch-usb-device-list">
        <div class="switch-usb-device-state">
          <i class="bi bi-arrow-clockwise"></i>
          <span>${this.manager.translate('settings.switchUsbDeviceSearching')}</span>
        </div>
      </div>
    `;

    const modal = window.modalManager.showCustomModal({
      id: 'switch-usb-device-picker-modal',
      title: this.manager.translate('settings.switchUsbDevicePickerTitle'),
      body,
      size: 'normal',
      clickOverlayToClose: false,
      buttons: [
        {
          id: 'switch-usb-device-refresh',
          text: this.manager.translate('settings.switchUsbDeviceRefresh'),
          type: 'secondary',
          closeOnClick: false,
          onClick: async () => {
            await this.renderSwitchUsbDeviceOptions(modal);
          },
        },
        {
          text: this.manager.translate('common.cancel') || 'Cancel',
          type: 'secondary',
        },
      ],
    });

    await this.renderSwitchUsbDeviceOptions(modal);
  }

  async renderSwitchUsbDeviceOptions(modal: HTMLElement) {
    const list = modal.querySelector<HTMLElement>('#switch-usb-device-list');
    if (!list) return;

    list.innerHTML = `
      <div class="switch-usb-device-state">
        <i class="bi bi-arrow-clockwise"></i>
        <span>${this.manager.translate('settings.switchUsbDeviceSearching')}</span>
      </div>
    `;

    try {
      this.manager.drivesLoaded = false;
      await this.loadAvailableDrives(true);
      const drives = await this.getAvailableSwitchDrives();

      if (drives.length === 0) {
        list.innerHTML = `
          <div class="switch-usb-device-state switch-usb-device-state-warning">
            <i class="bi bi-exclamation-triangle"></i>
            <span>${this.manager.translate('settings.switchUsbDeviceNone')}</span>
          </div>
        `;
        return;
      }

      list.innerHTML = '';

      drives.forEach((drive) => {
        const option = document.createElement('button');
        option.type = 'button';
        option.className = 'switch-usb-device-option';
        const displayText = this.getSwitchDriveDisplayText(drive);
        const identifier = this.getSwitchDriveIdentifier(drive);
        const isSelected =
          this.manager.settings.switchDriveLetter === identifier;
        if (isSelected) {
          option.classList.add('active');
        }

        option.innerHTML = `
          <i class="bi bi-usb-drive"></i>
          <span>
            <strong>${displayText}</strong>
            <small>${drive.type || this.manager.translate('settings.switchUsbDeviceTypeUnknown')}</small>
          </span>
          <i class="bi bi-check-lg switch-usb-device-check"></i>
        `;

        option.addEventListener('click', async () => {
          this.manager.settings.switchDriveLetter = identifier;
          this.manager.settings.switchTransferMethod = 'drive';
          this.manager.librarySettings.applyHardwareLibraryModePaths();
          this.updateSwitchTransferMethodUI();
          this.updateSwitchDriveLetterUI();
          await this.manager.saveSettings();
          this.manager.showToast(
            this.manager.translate('settings.switchDriveGuideDriveSelected'),
            'success',
          );
          window.modalManager.closeModal(modal, {
            onModalClosed: () => modal.remove(),
          });
        });

        list.appendChild(option);
      });
    } catch (error) {
      console.error('Failed to render USB device picker:', error);
      list.innerHTML = `
        <div class="switch-usb-device-state switch-usb-device-state-warning">
          <i class="bi bi-exclamation-triangle"></i>
          <span>${this.manager.translate('settings.switchUsbDeviceError')}</span>
        </div>
      `;
    }
  }

  async loadAvailableDrives(forceReload = false) {
    if (!window.electronAPI || !window.electronAPI.getAvailableDrives) {
      console.error('Electron API not available');
      return;
    }

    const optionsContainer = document.querySelector<HTMLElement>(
      '#switch-drive-letter-options',
    );
    const selectedValue = document.querySelector<HTMLElement>(
      '#switch-drive-letter-select .selected-value',
    );

    if (!optionsContainer) return;

    if (forceReload || !this.manager.drivesLoaded) {
      optionsContainer.innerHTML =
        '<div class="custom-select-option" style="pointer-events: none; opacity: 0.6;"><span><i class="bi bi-arrow-clockwise" style="animation: spin 1s linear infinite;"></i> Searching for drives...</span></div>';
      if (selectedValue && forceReload) {
        const currentText = selectedValue.textContent;
        if (!currentText.includes('Searching')) {
          selectedValue.textContent = 'Searching for drives...';
        }
      }
    }

    try {
      const result = await window.electronAPI.getAvailableDrives();
      if (result.success && result.drives) {
        optionsContainer.innerHTML = '';

        if (result.drives.length === 0) {
          optionsContainer.innerHTML =
            '<div class="custom-select-option" style="pointer-events: none; opacity: 0.6;"><span>No drives found</span></div>';
          if (selectedValue && forceReload) {
            selectedValue.textContent = 'No drives found';
          }
          this.manager.drivesLoaded = true;
          return;
        }

        result.drives.forEach((drive) => {
          const option = document.createElement('div');
          option.className = 'custom-select-option';
          option.dataset.value = drive.letter;
          if (drive.path) {
            option.dataset.path = drive.path;
          }

          let displayText;
          if (drive.path && drive.path.includes(':\\')) {
            displayText = `${drive.letter}: (${drive.label || 'Unknown'})`;
          } else if (drive.path && drive.path.startsWith('/')) {
            displayText = `${drive.path} (${drive.label || 'Unknown'})`;
          } else {
            displayText = `${drive.letter} (${drive.label || 'Unknown'})`;
          }

          option.innerHTML = `<span>${displayText}</span>`;

          option.addEventListener('click', () => {
            const selectedValue = document.querySelector<HTMLElement>(
              '#switch-drive-letter-select .selected-value',
            );
            if (selectedValue) {
              selectedValue.textContent = displayText;
            }

            optionsContainer
              .querySelectorAll<HTMLElement>('.custom-select-option')
              .forEach((opt) => {
                opt.classList.remove('active');
              });
            option.classList.add('active');

            document
              .querySelector<HTMLElement>('#switch-drive-letter-select')!
              .classList.remove('open');

            if (drive.path && drive.path.startsWith('/')) {
              this.manager.settings.switchDriveLetter = drive.path;
            } else {
              this.manager.settings.switchDriveLetter = drive.letter;
            }
            this.manager.librarySettings.applyHardwareLibraryModePaths();
            this.manager.saveSettings();
          });

          optionsContainer.appendChild(option);
        });

        const refreshBtn = document.createElement('div');
        refreshBtn.className = 'custom-select-option';
        refreshBtn.style.cssText =
          'border-top: 1px solid var(--border-color); margin-top: 4px; padding-top: 8px; cursor: pointer;';
        refreshBtn.innerHTML =
          '<span><i class="bi bi-arrow-clockwise"></i> Refresh drives</span>';
        refreshBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          this.manager.drivesLoaded = false;
          await this.loadAvailableDrives(true);
          this.manager.drivesLoaded = true;
        });
        optionsContainer.appendChild(refreshBtn);

        this.updateSwitchDriveLetterUI();
        this.manager.drivesLoaded = true;
      } else {
        optionsContainer.innerHTML =
          '<div class="custom-select-option" style="pointer-events: none; opacity: 0.6;"><span>Failed to load drives</span></div>';
        if (selectedValue && forceReload) {
          selectedValue.textContent = 'Failed to load drives';
        }
        this.manager.drivesLoaded = true;
      }
    } catch (error) {
      console.error('Failed to load drives:', error);
      if (optionsContainer) {
        optionsContainer.innerHTML =
          '<div class="custom-select-option" style="pointer-events: none; opacity: 0.6;"><span>Error loading drives</span></div>';
      }
      if (selectedValue && forceReload) {
        selectedValue.textContent = 'Error loading drives';
      }
      this.manager.drivesLoaded = true;
    }
  }

  updateSwitchDriveLetterUI() {
    const driveIdentifier = this.manager.settings.switchDriveLetter;
    if (!driveIdentifier) return;

    const driveLetterSelect = document.querySelector<HTMLElement>(
      '#switch-drive-letter-select',
    );
    if (driveLetterSelect) {
      const selectedValue =
        driveLetterSelect.querySelector<HTMLElement>('.selected-value');
      const optionsContainer = document.querySelector<HTMLElement>(
        '#switch-drive-letter-options',
      );

      if (optionsContainer) {
        const options = optionsContainer.querySelectorAll<HTMLElement>(
          '.custom-select-option',
        );

        options.forEach((option) => {
          const optionValue = option.dataset.value;
          const optionPath = option.dataset.path;
          let matches = false;

          if (
            driveIdentifier.includes(':\\') ||
            driveIdentifier.startsWith('/')
          ) {
            matches = optionPath === driveIdentifier;
          } else {
            matches = optionValue === driveIdentifier;
          }

          if (matches) {
            option.classList.add('active');
            if (selectedValue) {
              selectedValue.textContent =
                option.querySelector<HTMLElement>('span')!.textContent;
            }
          } else {
            option.classList.remove('active');
          }
        });
      } else if (selectedValue) {
        if (
          driveIdentifier.includes(':\\') ||
          driveIdentifier.startsWith('/')
        ) {
          selectedValue.textContent = driveIdentifier;
        } else {
          selectedValue.textContent = `${driveIdentifier}:`;
        }
      }
    }
  }

  getSwitchDriveRoot() {
    const driveIdentifier = this.manager.settings.switchDriveLetter;
    if (!driveIdentifier || typeof driveIdentifier !== 'string') {
      return null;
    }

    if (/^[A-Z]:?[\\/]?$/i.test(driveIdentifier.trim())) {
      return `${driveIdentifier.trim()[0]}:\\`;
    }

    return driveIdentifier.replace(/[\\/]+$/, '');
  }

  async resolveStoredSwitchDrivePath(driveIdentifier) {
    if (!driveIdentifier || typeof driveIdentifier !== 'string') {
      return driveIdentifier || null;
    }

    if (
      driveIdentifier.startsWith('/') ||
      driveIdentifier.includes(':\\') ||
      !window.electronAPI?.checkPathAccessible
    ) {
      return driveIdentifier;
    }

    try {
      const result =
        await window.electronAPI.checkPathAccessible(driveIdentifier);
      if (
        result?.success &&
        result.accessible === true &&
        typeof result.resolvedPath === 'string' &&
        result.resolvedPath
      ) {
        return result.resolvedPath;
      }
    } catch (error) {
      console.warn('[SettingsManager] Failed to resolve switch drive:', error);
    }

    return driveIdentifier.replace(/[\\/]+$/, '');
  }

  joinSwitchPath(...segments: string[]) {
    const root = this.getSwitchDriveRoot();
    if (!root) {
      return null;
    }

    const normalizedSegments = segments.map((segment) =>
      segment.replace(/^[/\\]+|[/\\]+$/g, ''),
    );

    const separator =
      /^[A-Z]:/i.test(root) || root.startsWith('\\\\') ? '\\' : '/';
    return `${root.replace(/[\\/]+$/, '')}${separator}${normalizedSegments.join(separator)}`;
  }

  getSwitchModsLibraryPath() {
    return (
      this.manager.settings.directModsPath ||
      this.joinSwitchPath('ultimate', 'mods')
    );
  }

  getSwitchPluginsLibraryPath() {
    return (
      this.manager.settings.directPluginsPath ||
      this.joinSwitchPath(
        'ultimate',
        'contents',
        '01006A800016E000',
        'romfs',
        'skyline',
        'plugins',
      )
    );
  }

  isSwitchLibraryPath(value) {
    if (!value || typeof value !== 'string') {
      return false;
    }

    const normalized = value.replace(/\\/g, '/').toLowerCase();
    return (
      normalized.endsWith('/ultimate/mods') ||
      normalized.endsWith(
        '/ultimate/contents/01006a800016e000/romfs/skyline/plugins',
      )
    );
  }

  getSwitchDriveRootFromLibraryPath(value) {
    if (!value || typeof value !== 'string') {
      return null;
    }

    const modsRoot = value.replace(/[\\/]ultimate[\\/]mods[\\/]?$/i, '');
    if (modsRoot !== value) {
      return /^[A-Z]:$/i.test(modsRoot) ? `${modsRoot}\\` : modsRoot || '/';
    }

    const pluginsRoot = value.replace(
      /[\\/](?:ultimate|atmosphere)[\\/]contents[\\/]01006A800016E000[\\/]romfs[\\/]skyline[\\/]plugins[\\/]?$/i,
      '',
    );
    if (pluginsRoot !== value) {
      return /^[A-Z]:$/i.test(pluginsRoot)
        ? `${pluginsRoot}\\`
        : pluginsRoot || '/';
    }

    return null;
  }

  syncSwitchDriveFromLibraryPaths() {
    if (this.manager.settings.switchDriveLetter) {
      return;
    }

    const root =
      this.getSwitchDriveRootFromLibraryPath(this.manager.settings.modsPath) ||
      this.getSwitchDriveRootFromLibraryPath(this.manager.settings.pluginsPath);

    if (
      root &&
      (root.startsWith('/') || root.includes(':\\')) &&
      root !== this.manager.settings.switchDriveLetter
    ) {
      this.manager.settings.switchDriveLetter = root;
    }
  }

  isDirectSwitchLibraryMode() {
    return (
      this.manager.getAppRunMode() === 'hardware' &&
      this.manager.getHardwareLibraryMode() === 'direct'
    );
  }
}
