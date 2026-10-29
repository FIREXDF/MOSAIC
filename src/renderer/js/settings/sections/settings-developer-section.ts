class SettingsDeveloperSection {
  manager: Window['settingsManager'];

  constructor(manager: Window['settingsManager']) {
    this.manager = manager;
  }

  bindDeveloperSettings() {
    const analyticsToggle =
      document.querySelector<HTMLInputElement>('#analytics-enabled');
    if (analyticsToggle && !analyticsToggle.dataset.listenerAttached) {
      if (window.electronAPI && window.electronAPI.getAnalyticsEnabled) {
        window.electronAPI.getAnalyticsEnabled().then((enabled: boolean) => {
          analyticsToggle.checked = enabled;
        });
      }

      analyticsToggle.addEventListener('change', async () => {
        if (window.electronAPI && window.electronAPI.setAnalyticsEnabled) {
          await window.electronAPI.setAnalyticsEnabled(analyticsToggle.checked);
          this.manager.showToast(
            this.manager.translate('toasts.settingSaved'),
            'success',
          );
        }
      });
      analyticsToggle.dataset.listenerAttached = 'true';
    }

    const devModeToggle = document.querySelector<HTMLInputElement>(
      '#developer-mode-enabled',
    );
    if (devModeToggle) {
      devModeToggle.addEventListener('change', (e) => {
        this.manager.settings.devMode = devModeToggle.checked;
        this.manager.saveSettings();
        this.updateDeveloperModeUI();
      });
    }

    const devShowModHashToggle = document.querySelector<HTMLInputElement>(
      '#developer-show-mod-hash',
    );
    if (devShowModHashToggle) {
      devShowModHashToggle.addEventListener('change', (e) => {
        this.manager.settings.devShowModHash = devShowModHashToggle.checked;
        this.manager.saveSettings();
        if (window.modManager) {
          window.modManager.renderModList();
        }
      });
    }

    const fakeVersionInput = document.querySelector<HTMLInputElement>(
      '#fake-version-input',
    );
    const saveDevSettingsBtn = document.querySelector<HTMLElement>(
      '#save-dev-settings-btn',
    );
    const resetDevSettingsBtn = document.querySelector<HTMLElement>(
      '#reset-dev-settings-btn',
    );

    if (fakeVersionInput && saveDevSettingsBtn) {
      window.electronAPI.store
        .get('developer.fakeVersion')
        .then((fakeVersion: string | null) => {
          if (fakeVersion) {
            fakeVersionInput.value = fakeVersion;
          }
        });

      saveDevSettingsBtn.addEventListener('click', () => {
        const fakeVersion = fakeVersionInput.value.trim();
        window.electronAPI.store.set('developer.fakeVersion', fakeVersion);
        this.manager.showToast(
          this.manager.translate('devSettingsSaved'),
          'success',
        );
      });

      if (resetDevSettingsBtn) {
        resetDevSettingsBtn.addEventListener('click', () => {
          fakeVersionInput.value = '';
          window.electronAPI.store.set('developer.fakeVersion', '');
          this.manager.showToast(
            this.manager.translate('settingSaved'),
            'success',
          );
        });
      }

      const simulateUpdateBtn = document.querySelector<HTMLElement>(
        '#simulate-update-btn',
      );
      if (simulateUpdateBtn) {
        simulateUpdateBtn.addEventListener('click', async () => {
          if (window.electronAPI && window.electronAPI.simulateUpdate) {
            await window.electronAPI.simulateUpdate();
            this.manager.showToast('Update simulation started', 'success');
          }
        });
      }

      const testHardwareOverlayBtn = document.querySelector<HTMLElement>(
        '#test-hardware-overlay-btn',
      );
      if (
        testHardwareOverlayBtn &&
        !testHardwareOverlayBtn.dataset.listenerAttached
      ) {
        testHardwareOverlayBtn.addEventListener('click', () => {
          window.hardwareConnectionManager?.showTestOverlay?.();
        });
        testHardwareOverlayBtn.dataset.listenerAttached = 'true';
      }

      const testNroLimitModalBtn = document.querySelector<HTMLElement>(
        '#test-nro-limit-modal-btn',
      );
      if (
        testNroLimitModalBtn &&
        !testNroLimitModalBtn.dataset.listenerAttached
      ) {
        testNroLimitModalBtn.addEventListener('click', () => {
          window.modManager?.showNroLimitWarningModal?.({
            success: true,
            limit: 64,
            totalNroFiles: 70,
            exceedsLimit: true,
            activeModsCount: 8,
            files: [
              {
                modName: 'Example Skyline Plugin Pack',
                modPath: '/example/mods/Example Skyline Plugin Pack',
                relativePath: 'ultimate/plugins/example_one.nro',
              },
              {
                modName: 'Example Training Tools',
                modPath: '/example/mods/Example Training Tools',
                relativePath: 'ultimate/plugins/example_two.nro',
              },
            ],
          });
        });
        testNroLimitModalBtn.dataset.listenerAttached = 'true';
      }

      const openConfigBtn =
        document.querySelector<HTMLElement>('#open-config-btn');
      if (openConfigBtn) {
        openConfigBtn.addEventListener('click', async () => {
          if (window.electronAPI && window.electronAPI.openConfigFile) {
            await window.electronAPI.openConfigFile();
          }
        });
      }

      const forceUpdateToggle = document.querySelector<HTMLInputElement>(
        '#force-update-enabled',
      );
      if (
        forceUpdateToggle &&
        window.electronAPI &&
        window.electronAPI.getForceUpdate
      ) {
        window.electronAPI.getForceUpdate().then((isEnabled) => {
          forceUpdateToggle.checked = isEnabled;
        });

        forceUpdateToggle.addEventListener('change', async (e) => {
          if (window.electronAPI) {
            await window.electronAPI.setForceUpdate(forceUpdateToggle.checked);
            this.manager.showToast('Force update setting saved', 'success');
          }
        });
      }
    }

    const posthogTestEventBtn = document.querySelector<HTMLElement>(
      '#posthog-test-event-btn',
    );
    const posthogTestErrorBtn = document.querySelector<HTMLElement>(
      '#posthog-test-error-btn',
    );
    const posthogTestStatus = document.querySelector<HTMLElement>(
      '#posthog-test-status',
    );

    if (posthogTestEventBtn && !posthogTestEventBtn.dataset.listenerAttached) {
      posthogTestEventBtn.addEventListener('click', async () => {
        try {
          if (window.electronAPI && window.electronAPI.testPosthogEvent) {
            const result = await window.electronAPI.testPosthogEvent();
            if (result?.success) {
              this.manager.showToast('Test event sent to PostHog', 'success');
              if (posthogTestStatus) {
                const span = posthogTestStatus.querySelector('span');
                if (span) span.textContent = 'Test event sent successfully!';
                posthogTestStatus.style.display = 'flex';
              }
            }
          }
        } catch (err) {
          this.manager.showToast('Failed to send test event', 'error');
          console.error('PostHog test event failed:', err);
        }
      });
      posthogTestEventBtn.dataset.listenerAttached = 'true';
    }

    if (posthogTestErrorBtn && !posthogTestErrorBtn.dataset.listenerAttached) {
      posthogTestErrorBtn.addEventListener('click', async () => {
        try {
          if (window.electronAPI && window.electronAPI.testPosthogError) {
            const result = await window.electronAPI.testPosthogError();
            if (result?.success) {
              this.manager.showToast('Test error sent to PostHog', 'success');
              if (posthogTestStatus) {
                const span = posthogTestStatus.querySelector('span');
                if (span) span.textContent = 'Test error sent successfully!';
                posthogTestStatus.style.display = 'flex';
              }
            }
          }
        } catch (err) {
          this.manager.showToast('Failed to send test error', 'error');
          console.error('PostHog test error failed:', err);
        }
      });
      posthogTestErrorBtn.dataset.listenerAttached = 'true';
    }

    const logRetentionInput = document.querySelector<HTMLInputElement>(
      '#log-retention-days',
    );
    if (logRetentionInput && !logRetentionInput.dataset.listenerAttached) {
      window.electronAPI.store.get('logRetentionDays').then((value: number) => {
        logRetentionInput.value = String(value || 7);
      });

      logRetentionInput.addEventListener('change', async () => {
        const value = parseInt(logRetentionInput.value, 10);
        if (value >= 1 && value <= 365) {
          await window.electronAPI.store.set('logRetentionDays', value);
          this.manager.showToast(
            this.manager.translate('toasts.settingSaved'),
            'success',
          );
        }
      });
      logRetentionInput.dataset.listenerAttached = 'true';
    }

    const resetStoreBtn = document.querySelector<HTMLElement>(
      '#reset-electron-store-btn',
    );
    if (resetStoreBtn && !resetStoreBtn.dataset.listenerAttached) {
      resetStoreBtn.addEventListener('click', () => {
        this.manager.maintenance.showResetStoreConfirmModal();
      });
      resetStoreBtn.dataset.listenerAttached = 'true';
    }
  }

  updateDeveloperModeUI() {
    const devTabBtn = document.querySelector<HTMLElement>(
      '#settings-tab-developer',
    );
    const devModeToggle = document.querySelector<HTMLInputElement>(
      '#developer-mode-enabled',
    );

    if (devModeToggle) {
      devModeToggle.checked = this.manager.settings.devMode;
    }

    const devShowModHashToggle = document.querySelector<HTMLInputElement>(
      '#developer-show-mod-hash',
    );
    if (devShowModHashToggle) {
      devShowModHashToggle.checked =
        this.manager.settings.devShowModHash || false;
    }

    if (devTabBtn) {
      devTabBtn.style.display = this.manager.settings.devMode
        ? 'block'
        : 'none';

      // If we are on the developer tab and disable dev mode, switch to general
      if (
        !this.manager.settings.devMode &&
        devTabBtn.classList.contains('active')
      ) {
        const generalBtn = document.querySelector<HTMLButtonElement>(
          '[data-settings-tab="general"]',
        );
        if (generalBtn) generalBtn.click();
      }
    }
  }
}
