class SettingsMaintenanceSection {
  manager: Window['settingsManager'];

  constructor(manager: Window['settingsManager']) {
    this.manager = manager;
  }

  askDebugReportAnonymization(): Promise<boolean | null> {
    const message = this.manager.translate(
      'settings.debugReportAnonymizeQuestion',
    );
    if (!window.modalManager?.showCustomModal) {
      return Promise.resolve(window.confirm(message));
    }

    return new Promise((resolve) => {
      let settled = false;
      const finish = (choice: boolean | null) => {
        if (settled) return;
        settled = true;
        resolve(choice);
      };

      window.modalManager.showCustomModal({
        id: 'debug-report-anonymization-modal',
        title: this.manager.translate('settings.debugReportAnonymizeTitle'),
        body: `<p>${message}</p>`,
        buttons: [
          {
            text: this.manager.translate('common.cancel'),
            type: 'cancel',
            onClick: () => finish(null),
          },
          {
            text: this.manager.translate('settings.debugReportKeepPaths'),
            type: 'secondary',
            onClick: () => finish(false),
          },
          {
            text: this.manager.translate('settings.debugReportAnonymize'),
            type: 'primary',
            onClick: () => finish(true),
          },
        ],
        onClose: () => finish(null),
      });
    });
  }

  bindMaintenanceSettings() {
    const restartTutorialBtn = document.querySelector<HTMLElement>(
      '#restart-tutorial-btn',
    );
    if (restartTutorialBtn && !restartTutorialBtn.dataset.listenerAttached) {
      restartTutorialBtn.addEventListener('click', async () => {
        if (window.tutorial) {
          window.tutorial.show();
        }
      });
      restartTutorialBtn.dataset.listenerAttached = 'true';
    }

    const restartTutorialModsBtn = document.querySelector<HTMLElement>(
      '#restart-tutorial-mods-btn',
    );
    if (
      restartTutorialModsBtn &&
      !restartTutorialModsBtn.dataset.listenerAttached
    ) {
      restartTutorialModsBtn.addEventListener('click', async () => {
        const modsTabBtn = document.querySelector<HTMLElement>(
          '.sidebar-btn[data-tab="tools"]',
        );
        if (modsTabBtn) {
          modsTabBtn.click();
        }
        if (window.tutorial) {
          window.tutorial.show();
        }
      });
      restartTutorialModsBtn.dataset.listenerAttached = 'true';
    }

    const clearTempFilesBtn = document.querySelector<HTMLElement>(
      '#clear-temp-files-btn',
    );
    if (clearTempFilesBtn && !clearTempFilesBtn.dataset.listenerAttached) {
      clearTempFilesBtn.addEventListener('click', async () => {
        await this.clearTempFiles();
      });
      clearTempFilesBtn.dataset.listenerAttached = 'true';
    }

    const exportDebugReportBtn = document.querySelector<HTMLButtonElement>(
      '#export-debug-report-btn',
    );
    if (
      exportDebugReportBtn &&
      !exportDebugReportBtn.dataset.listenerAttached
    ) {
      exportDebugReportBtn.addEventListener('click', async () => {
        if (exportDebugReportBtn.disabled) return;
        const icon = exportDebugReportBtn.querySelector<HTMLElement>('i');
        const title = exportDebugReportBtn.querySelector<HTMLElement>(
          '.settings-btn-action-title',
        );
        const originalIconClass = icon?.className;
        exportDebugReportBtn.disabled = true;
        try {
          const anonymizeUserPaths = await this.askDebugReportAnonymization();
          if (anonymizeUserPaths === null) return;

          exportDebugReportBtn.classList.add('is-loading');
          exportDebugReportBtn.setAttribute('aria-busy', 'true');
          if (icon) icon.className = 'bi bi-arrow-clockwise';
          if (title) {
            title.dataset.i18n = 'settings.debugReportExporting';
            title.textContent = this.manager.translate(
              'settings.debugReportExporting',
            );
          }

          const result =
            await window.electronAPI.exportDebugReport(anonymizeUserPaths);
          if (result.success) {
            this.manager.showToast(
              this.manager.translate('settings.debugReportExported'),
              'success',
            );
          } else if (!result.canceled) {
            this.manager.showToast(
              result.error ||
                this.manager.translate('settings.debugReportExportFailed'),
              'error',
            );
          }
        } catch (error) {
          console.error('Failed to export debug report:', error);
          this.manager.showToast(
            this.manager.translate('settings.debugReportExportFailed'),
            'error',
          );
        } finally {
          exportDebugReportBtn.disabled = false;
          exportDebugReportBtn.classList.remove('is-loading');
          exportDebugReportBtn.removeAttribute('aria-busy');
          if (icon && originalIconClass !== undefined) {
            icon.className = originalIconClass;
          }
          if (title) {
            title.dataset.i18n = 'settings.exportDebugReport';
            title.textContent = this.manager.translate(
              'settings.exportDebugReport',
            );
          }
        }
      });
      exportDebugReportBtn.dataset.listenerAttached = 'true';
    }

    const exportConfigBackupBtn = document.querySelector<HTMLButtonElement>(
      '#export-config-backup-btn',
    );
    if (
      exportConfigBackupBtn &&
      !exportConfigBackupBtn.dataset.listenerAttached
    ) {
      exportConfigBackupBtn.addEventListener('click', async () => {
        await this.exportConfigBackup(exportConfigBackupBtn);
      });
      exportConfigBackupBtn.dataset.listenerAttached = 'true';
    }

    const restoreConfigBackupBtn = document.querySelector<HTMLButtonElement>(
      '#restore-config-backup-btn',
    );
    if (
      restoreConfigBackupBtn &&
      !restoreConfigBackupBtn.dataset.listenerAttached
    ) {
      restoreConfigBackupBtn.addEventListener('click', async () => {
        await this.restoreConfigBackup(restoreConfigBackupBtn);
      });
      restoreConfigBackupBtn.dataset.listenerAttached = 'true';
    }
  }

  async clearTempFiles() {
    if (!window.electronAPI || !window.electronAPI.clearTempFiles) {
      if (window.toastManager) {
        window.toastManager.error('toasts.clearTempFilesNotAvailable');
      }
      return;
    }

    const btn = document.querySelector<HTMLButtonElement>(
      '#clear-temp-files-btn',
    );
    if (btn) {
      btn.disabled = true;
      btn.style.opacity = '0.6';
    }

    try {
      if (window.toastManager) {
        window.toastManager.info('toasts.clearingTempFiles');
      }

      const result = await window.electronAPI.clearTempFiles();

      if (result.success) {
        if (window.toastManager) {
          window.toastManager.success('toasts.tempFilesCleared');
        }
      } else {
        if (window.toastManager) {
          window.toastManager.error('toasts.failedToClearTempFiles', 3000, {
            error: result.error,
          });
        }
      }
    } catch (error) {
      if (window.toastManager) {
        window.toastManager.error('toasts.failedToClearTempFiles', 3000, {
          error: error.message,
        });
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
      }
    }
  }

  async showPendingConfigRestoreToast() {
    try {
      const restoredAt = await window.electronAPI?.store?.get?.(
        'configRestore.completedAt',
      );
      if (!restoredAt) {
        return;
      }

      await window.electronAPI.store.delete('configRestore.completedAt');
      setTimeout(() => {
        this.manager.showToast(
          this.manager.translate('toasts.configBackupRestored'),
          'success',
        );
      }, 800);
    } catch (error) {
      console.error('Failed to show config restore confirmation:', error);
    }
  }

  async exportConfigBackup(button?: HTMLButtonElement) {
    if (!window.electronAPI?.exportConfigBackup) {
      this.manager.showToast(
        this.manager.translate('toasts.configBackupUnavailable'),
        'error',
      );
      return;
    }

    if (button) {
      button.disabled = true;
      button.style.opacity = '0.6';
    }

    try {
      const result = await window.electronAPI.exportConfigBackup();
      if (result.success) {
        this.manager.showToast(
          this.manager.translate('toasts.configBackupExported'),
          'success',
        );
      } else if (!result.canceled) {
        this.manager.showToast(
          this.manager.translate('toasts.configBackupExportFailed'),
          'error',
        );
      }
    } catch (error) {
      console.error('Failed to export MOSAIC configuration:', error);
      this.manager.showToast(
        this.manager.translate('toasts.configBackupExportFailed'),
        'error',
      );
    } finally {
      if (button) {
        button.disabled = false;
        button.style.opacity = '1';
      }
    }
  }

  async restoreConfigBackup(button?: HTMLButtonElement) {
    if (!window.electronAPI?.restoreConfigBackup) {
      this.manager.showToast(
        this.manager.translate('toasts.configBackupUnavailable'),
        'error',
      );
      return;
    }

    const confirmed = await this.manager.confirmWithModal(
      'settings-restore-config-backup-modal',
      this.manager.translate('settings.restoreConfigBackup'),
      this.manager.translate('settings.restoreConfigBackupConfirmMessage'),
      this.manager.translate('modals.restoreSlotBackup.confirm'),
      'primary',
    );
    if (!confirmed) {
      return;
    }

    if (button) {
      button.disabled = true;
      button.style.opacity = '0.6';
    }

    try {
      const result = await window.electronAPI.restoreConfigBackup();
      if (result.success) {
        this.manager.showRestartRequiredOverlay();
      } else if (!result.canceled) {
        this.manager.showToast(
          this.manager.translate('toasts.configBackupRestoreFailed'),
          'error',
        );
      }
    } catch (error) {
      console.error('Failed to restore MOSAIC configuration:', error);
      this.manager.showToast(
        this.manager.translate('toasts.configBackupRestoreFailed'),
        'error',
      );
    } finally {
      if (button) {
        button.disabled = false;
        button.style.opacity = '1';
      }
    }
  }

  async showResetStoreConfirmModal() {
    const confirmed = await this.manager.confirmWithModal(
      'settings-reset-store-modal',
      this.manager.translate('settings.resetStoreTitle'),
      this.manager.translate('settings.resetStoreConfirmMessage'),
      this.manager.translate('settings.reset'),
      'danger',
    );
    if (!confirmed) {
      return;
    }

    try {
      await window.electronAPI.store.clear();
      this.manager.showRestartRequiredOverlay(
        'settings.restartRequiredAfterReset',
      );
    } catch (error) {
      console.error('Failed to reset electron store:', error);
      this.manager.showToast(
        this.manager.translate('toasts.failedToResetStore'),
        'error',
      );
    }
  }
}
