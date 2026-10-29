if (window.electronAPI && window.electronAPI.onModInstallConfirmRequest) {
  window.electronAPI.onModInstallConfirmRequest(async (data) => {
    let installConfirmEnabled = true;

    try {
      const setting = await window.electronAPI.store.get(
        'installConfirmEnabled',
      );

      if (setting === false) {
        installConfirmEnabled = false;
      }
    } catch (error) {
      console.error('Error checking install confirm setting:', error);
    }

    if (!installConfirmEnabled) {
      if (window.electronAPI) {
        await window.electronAPI.confirmProtocolInstall(
          data.url,
          data.downloadId,
        );
      }
    } else {
      if (window.modalManager) {
        window.modalManager.openInstallConfirmModal(
          data.url,
          data.downloadId,
          data.modId,
          data.modType,
        );
      } else {
        console.error('Modal manager not available');
      }
    }
  });

}

if (window.electronAPI && window.electronAPI.onGameBananaPairingSuccess) {
  window.electronAPI.onGameBananaPairingSuccess((data) => {
    if (window.toastManager) {
      window.toastManager.success('GameBanana account successfully paired. Listening for remote installs...', 5000);
    }
  });
}
