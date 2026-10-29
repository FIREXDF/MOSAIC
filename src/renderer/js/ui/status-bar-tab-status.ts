class StatusBarTabStatus {
  manager: Window['statusBarManager'];

  constructor(manager: Window['statusBarManager']) {
    this.manager = manager;
  }

  getPluralSuffix(count: number) {
    return count !== 1 ? 's' : '';
  }

  getToolsSnapshot(): StatusSnapshot {
    try {
      if (window.modManager?.mods) {
        const mods = window.modManager.mods;
        const enabledMods = mods.filter((mod) => mod.status === 'active').length;

        return {
          content: this.manager.t('statusBar.modsEnabled', {
            enabled: enabledMods,
            total: mods.length,
            plural: this.getPluralSuffix(mods.length),
          }),
        };
      }
    } catch (error) {
      // Fall through to the ready state below.
    }

    return { content: this.manager.t('statusBar.modsReady') };
  }

  getPluginsSnapshot(): StatusSnapshot {
    try {
      if (window.pluginManager) {
        const plugins = window.pluginManager.plugins || [];
        const enabledPlugins = plugins.filter((plugin) => plugin.enabled !== false)
          .length;

        return {
          content: this.manager.t('statusBar.pluginsEnabled', {
            enabled: enabledPlugins,
            total: plugins.length,
            plural: this.getPluralSuffix(plugins.length),
          }),
        };
      }
    } catch (error) {
      // Fall through to the ready state below.
    }

    return { content: this.manager.t('statusBar.pluginsReady') };
  }

  getCharactersSnapshot(): StatusSnapshot {
    try {
      if (window.charactersManager?.characters) {
        const count = window.charactersManager.characters.size;
        return {
          content: this.manager.t('statusBar.charactersAvailable', {
            count,
            plural: this.getPluralSuffix(count),
          }),
        };
      }
    } catch (error) {
      // Fall through to the ready state below.
    }

    return { content: this.manager.t('statusBar.charactersReady') };
  }

  getSettingsSnapshot(): StatusSnapshot {
    return { content: this.manager.t('statusBar.settings') };
  }

  getDownloadsIdleSnapshot(): StatusSnapshot {
    if (!window.downloadManager || !(window.downloadManager).activeDownloads) {
      return { content: this.manager.t('statusBar.downloadsReady') };
    }

    const completedCount = window.downloadManager.completedDownloads
      ? window.downloadManager.completedDownloads.length
      : 0;

    if (completedCount > 0) {
      return {
        content: this.manager.t('statusBar.downloadsCompleted', {
          count: completedCount,
          plural: this.getPluralSuffix(completedCount),
        }),
      };
    }

    return { content: this.manager.t('statusBar.downloadsNoActive') };
  }

  getSnapshotForTab(tab: StatusTab): StatusSnapshot {
    switch (tab) {
      case 'downloads':
        return this.getDownloadsIdleSnapshot();
      case 'tools':
        return this.getToolsSnapshot();
      case 'plugins':
        return this.getPluginsSnapshot();
      case 'settings':
        return this.getSettingsSnapshot();
      case 'characters':
        return this.getCharactersSnapshot();
      case 'fightplanner':
      case 'marketplace':
      default:
        return { content: this.manager.t('statusBar.ready') };
    }
  }

  updateToolsStatus(statusText) {
    const cycleId = this.manager.beginStatusCycle();
    this.manager.applySnapshot(this.getToolsSnapshot(), { cycleId });
    this.manager.startStaticTabPolling('tools', cycleId);
    return;

    const updateStatus = () => {
      if (
        this.manager.currentTab !== 'tools' ||
        this.manager.downloads.checkActiveDownloads() ||
        this.manager.hasModalOpen()
      ) {
        if (this.manager.updateInterval) {
          clearInterval(this.manager.updateInterval);
          this.manager.updateInterval = null;
        }
        return;
      }

      if (this.manager.preservedStatus) {
        return;
      }

      try {
        if (window.modManager && window.modManager.mods) {
          const mods = window.modManager.mods;

          const enabledMods = mods.filter(
            (mod) => mod.status === 'active',
          ).length;
          const totalMods = mods.length;

          this.manager.setStatusText(
            this.manager.t('statusBar.modsEnabled', {
              enabled: enabledMods,
              total: totalMods,
              plural: totalMods !== 1 ? 's' : '',
            }),
          );
        } else {
          this.manager.setStatusText(this.manager.t('statusBar.modsReady'));
        }
      } catch (error) {
        this.manager.setStatusText(this.manager.t('statusBar.modsReady'));
      }
    };

    updateStatus();

    this.manager.updateInterval = setInterval(updateStatus, 10000);
  }

  updatePluginsStatus(statusText) {
    const cycleId = this.manager.beginStatusCycle();
    this.manager.applySnapshot(this.getPluginsSnapshot(), { cycleId });
    this.manager.startStaticTabPolling('plugins', cycleId);
    return;

    const updateStatus = () => {
      if (
        this.manager.currentTab !== 'plugins' ||
        this.manager.downloads.checkActiveDownloads() ||
        this.manager.hasModalOpen()
      ) {
        if (this.manager.updateInterval) {
          clearInterval(this.manager.updateInterval);
          this.manager.updateInterval = null;
        }
        return;
      }

      if (this.manager.preservedStatus) {
        return;
      }

      try {
        if (window.pluginManager) {
          const plugins = window.pluginManager.plugins || [];
          const enabledPlugins = plugins.filter(
            (p) => p.enabled !== false,
          ).length;

          this.manager.setStatusText(
            this.manager.t('statusBar.pluginsEnabled', {
              enabled: enabledPlugins,
              total: plugins.length,
              plural: plugins.length !== 1 ? 's' : '',
            }),
          );
        } else {
          this.manager.setStatusText(this.manager.t('statusBar.pluginsReady'));
        }
      } catch (error) {
        this.manager.setStatusText(this.manager.t('statusBar.pluginsReady'));
      }
    };

    updateStatus();
    this.manager.updateInterval = setInterval(updateStatus, 10000);
  }

  updateSettingsStatus(statusText) {
    this.manager.applySnapshot(this.getSettingsSnapshot());
    return;

    this.manager.setStatusText(this.manager.t('statusBar.settings'));
  }

  updateCharactersStatus(statusText) {
    const cycleId = this.manager.beginStatusCycle();
    this.manager.applySnapshot(this.getCharactersSnapshot(), { cycleId });
    this.manager.startStaticTabPolling('characters', cycleId);
    return;

    const updateStatus = () => {
      if (
        this.manager.currentTab !== 'characters' ||
        this.manager.downloads.checkActiveDownloads() ||
        this.manager.hasModalOpen()
      ) {
        if (this.manager.updateInterval) {
          clearInterval(this.manager.updateInterval);
          this.manager.updateInterval = null;
        }
        return;
      }

      if (this.manager.preservedStatus) {
        return;
      }

      try {
        if (window.charactersManager && window.charactersManager.characters) {
          const characters = window.charactersManager.characters;
          const count = characters.size;

          this.manager.setStatusText(
            this.manager.t('statusBar.charactersAvailable', {
              count: count,
              plural: count !== 1 ? 's' : '',
            }),
          );
        } else {
          this.manager.setStatusText(this.manager.t('statusBar.charactersReady'));
        }
      } catch (error) {
        this.manager.setStatusText(this.manager.t('statusBar.charactersReady'));
      }
    };

    updateStatus();
    this.manager.updateInterval = setInterval(updateStatus, 10000);
  }
}
