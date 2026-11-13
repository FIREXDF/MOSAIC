export {};
(function () {
  const ssbuVersionLabel = (version: string | null) =>
    version === 'any'
      ? (window.i18n?.t?.('plugins.ssbuAnyVersion') || 'Let me choose any version')
      : version || (window.i18n?.t?.('plugins.ssbuNotSelected') || 'Not selected');

  const M = window.ModalManagerClass;
  if (!M) {
    console.error('[plugin-modals] ModalManagerClass not found');
    return;
  }

  M.prototype.openPluginUpdateModal = function (updates, plugins) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'plugin-update-modal';

    const updatesList = updates
      .map((update) => {
        const plugin = plugins.find(
          (p) =>
            p.name === update.pluginName ||
            p.name.replace('.nro', '') === update.pluginName,
        );
        const pluginPath = plugin ? plugin.filePath : null;

        return `
        <div class="plugin-update-item" data-plugin-name="${update.pluginName}">
          <div class="plugin-update-info">
            <span class="plugin-update-name">${escapeHtml(update.pluginName)}</span>
            <span class="plugin-update-versions">
              ${update.currentVersion} → ${update.latestVersion}
            </span>
          </div>
          <button class="modal-btn modal-btn-primary update-plugin-btn" 
                  data-plugin-name="${update.pluginName}"
                  data-download-url="${update.downloadUrl || ''}"
                  data-plugin-path="${pluginPath || ''}"
                  data-latest-version="${update.latestVersion || ''}">
            Update
          </button>
        </div>
      `;
      })
      .join('');

    modal.innerHTML = `
    <div class="modal-header">
      <h2>Plugin Updates Available</h2>
    </div>
    <div class="modal-body">
      <p class="plugin-modal-intro">
        The following plugins have updates available:
      </p>
      <div class="plugin-updates-list">
        ${updatesList}
      </div>
    </div>
    <div class="modal-footer">
      <button class="modal-btn modal-btn-primary" id="update-all-plugins-btn">
        Update All
      </button>
      <button class="modal-btn modal-btn-secondary" id="close-plugin-update-modal">
        Close
      </button>
    </div>
  `;

    const overlay = document.querySelector<HTMLElement>('#modal-overlay');
    if (!overlay) {
      const newOverlay = document.createElement('div');
      newOverlay.id = 'modal-overlay';
      document.body.appendChild(newOverlay);
    }

    document.body.appendChild(modal);
    this.showOverlay();
    modal.style.display = 'block';

    const closeBtn = modal.querySelector<HTMLButtonElement>(
      '#close-plugin-update-modal',
    );
    closeBtn!.addEventListener('click', () => {
      this.closePluginUpdateModal();
    });

    const updateAllBtn = modal.querySelector<HTMLButtonElement>(
      '#update-all-plugins-btn',
    );

    updateAllBtn!.addEventListener('click', async () => {
      const updateButtons = modal.querySelectorAll<HTMLButtonElement>(
        '.update-plugin-btn:not(:disabled)',
      );

      if (updateButtons.length === 0) {
        if (window.toastManager) {
          window.toastManager.info('No plugins to update');
        }
        return;
      }

      updateAllBtn!.disabled = true;
      updateAllBtn!.textContent = 'Updating all...';

      for (const btn of updateButtons) {
        const pluginName = btn.dataset.pluginName;
        const downloadUrl = btn.dataset.downloadUrl;
        const pluginPath = btn.dataset.pluginPath;
        const targetVersion = btn.dataset.latestVersion;

        if (!downloadUrl || !pluginPath) {
          continue;
        }

        btn.disabled = true;
        btn.textContent = 'Updating...';

        if (window.pluginManager) {
          await window.pluginManager.updatePlugin(
            pluginName,
            downloadUrl,
            pluginPath,
            targetVersion,
          );
        }

        const updateItem = modal.querySelector<HTMLElement>(
          `[data-plugin-name="${pluginName}"]`,
        );
        if (updateItem) {
          updateItem.style.opacity = '0.5';
        }
      }

      setTimeout(() => {
        this.closePluginUpdateModal();

        if (window.toastManager) {
          window.toastManager.success('All updates completed');
        }
      }, 1000);
    });

    const updateButtons =
      modal.querySelectorAll<HTMLButtonElement>('.update-plugin-btn');

    updateButtons.forEach((btn) => {
      btn.addEventListener('click', async () => {
        const pluginName = btn.dataset.pluginName;
        const downloadUrl = btn.dataset.downloadUrl;
        const pluginPath = btn.dataset.pluginPath;
        const targetVersion = btn.dataset.latestVersion;

        if (!downloadUrl) {
          if (window.toastManager) {
            window.toastManager.error(
              `No download URL available for ${pluginName}`,
            );
          }
          return;
        }

        if (!pluginPath) {
          if (window.toastManager) {
            window.toastManager.error(
              `Plugin path not found for ${pluginName}`,
            );
          }
          return;
        }

        btn.disabled = true;
        btn.textContent = 'Updating...';

        const updated =
          (await window.pluginManager?.updatePlugin(
            pluginName,
            downloadUrl,
            pluginPath,
            targetVersion,
          )) === true;

        if (!updated) {
          btn.disabled = false;
          btn.textContent = 'Update';
          return;
        }

        btn.textContent = 'Updated';
        const updateItem = modal.querySelector<HTMLElement>(
          `[data-plugin-name="${pluginName}"]`,
        );

        if (updateItem) {
          updateItem.dataset.updated = 'true';
          updateItem.style.opacity = '0.5';
        }

        const remainingUpdates = modal.querySelectorAll<HTMLElement>(
          '.plugin-update-item:not([data-updated="true"])',
        );
        if (remainingUpdates.length === 0) {
          setTimeout(() => {
            this.closePluginUpdateModal();

            if (window.toastManager) {
              window.toastManager.success('All updates completed');
            }
          }, 1000);
        }
      });
    });

    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        this.closePluginUpdateModal();
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);
  };

  M.prototype.closePluginUpdateModal = function () {
    this.closeModal('plugin-update-modal');
  };

  M.prototype.openModUpdateModal = function (updates) {
    const t = (key) => window.i18n?.t?.(key) ?? key;
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'mod-update-modal';

    // Updates install next to the old folder: replacing it would lose reslots and edits.
    modal.innerHTML = `
    <div class="modal-header">
      <h2>${t('tools.modInfo.updatesTitle')}</h2>
    </div>
    <div class="modal-body">
      <div class="plugin-updates-list">
        ${updates
          .map(
            (update) => `
        <div class="plugin-update-item">
          <div class="plugin-update-info">
            <span class="plugin-update-name">${escapeHtml(update.name)}</span>
            ${
              update.latestVersion
                ? `<span class="plugin-update-versions">${escapeHtml(
                    update.currentVersion || '?',
                  )} → ${escapeHtml(update.latestVersion)}</span>`
                : ''
            }
            ${
              update.changes
                ? `<span class="plugin-update-versions">${escapeHtml(update.changes)}</span>`
                : ''
            }
          </div>
          <div class="plugin-modal-stack">
            <button class="modal-btn modal-btn-primary update-plugin-btn" data-install="${escapeHtml(update.url)}">
              ${t('tools.modInfo.update')}
            </button>
            <button class="modal-btn modal-btn-secondary update-plugin-btn" data-url="${escapeHtml(update.url)}">
              ${t('tools.modInfo.openOnGameBanana')}
            </button>
          </div>
        </div>`,
          )
          .join('')}
      </div>
    </div>
    <div class="modal-footer">
      <button class="modal-btn modal-btn-secondary" id="close-mod-update-modal">
        ${t('tools.modInfo.dismissUpdates')}
      </button>
    </div>
  `;

    document.body.appendChild(modal);
    this.showOverlay();
    modal.style.display = 'block';

    modal.querySelectorAll<HTMLButtonElement>('[data-url]').forEach((btn) => {
      btn.addEventListener('click', () => {
        window.electronAPI.openUrl(btn.dataset.url!);
      });
    });

    // Marks versions as seen so each one is reported once.
    const markSeen = async (seenUpdates) => {
      const watch =
        ((await window.electronAPI.store.get('modUpdateWatch')) as Record<
          string,
          { seen: number }
        > | null) || {};
      for (const update of seenUpdates) {
        if (watch[update.url]) watch[update.url].seen = update.latest;
      }
      await window.electronAPI.store.set('modUpdateWatch', watch);
    };

    modal.querySelectorAll<HTMLButtonElement>('[data-install]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const update = updates.find((u) => u.url === btn.dataset.install);
        btn.disabled = true;
        await window.electronAPI.openFightPlannerLink(update.installLink);
        await markSeen([update]);
      });
    });

    modal
      .querySelector<HTMLButtonElement>('#close-mod-update-modal')!
      .addEventListener('click', async () => {
        await markSeen(updates);
        this.closeModal('mod-update-modal');
      });
  };

  M.prototype.openPluginMarketplaceModal = async function () {
    document
      .querySelectorAll<HTMLElement>('#plugin-marketplace-modal')
      .forEach((existingModal) => existingModal.remove());

    const modal = document.createElement('div');
    modal.className = 'modal modal-large modal-marketplace';
    modal.id = 'plugin-marketplace-modal';

    modal.innerHTML = `
    <div class="modal-header">
      <h2 data-i18n="plugins.marketplace">Plugin Marketplace</h2>
    </div>
    <div class="modal-body">
      <div class="marketplace-version-banner" role="status">
        <div>
          <strong><span data-i18n="plugins.ssbuBannerTitle">SSBU version:</span> <span id="marketplace-ssbu-version">Not selected</span></strong>
        </div>
        <button type="button" id="marketplace-change-ssbu-version" class="modal-btn modal-btn-secondary" data-i18n="plugins.changeSsbuVersion">Change version</button>
      </div>
      <div id="marketplace-results" class="marketplace-results">
      </div>
    </div>
    <div class="modal-footer">
      <button class="modal-btn modal-btn-secondary" id="close-marketplace-modal">
        <span data-i18n="common.close">Close</span>
      </button>
    </div>
  `;

    const overlay = document.querySelector<HTMLElement>('#modal-overlay');
    if (!overlay) {
      const newOverlay = document.createElement('div');
      newOverlay.id = 'modal-overlay';
      document.body.appendChild(newOverlay);
    }

    document.body.appendChild(modal);
    this.showOverlay();
    modal.style.display = 'block';

    if (window.i18n) {
      window.i18n.updateDOM();
    }

    const resultsContainer = modal.querySelector<HTMLElement>(
      '#marketplace-results',
    );

    const versionLabel = modal.querySelector<HTMLElement>('#marketplace-ssbu-version')!;
    const refreshVersion = async () => {
      versionLabel.textContent = ssbuVersionLabel(await window.pluginMarketplace.getConfiguredSsbuVersion());
    };
    await refreshVersion();
    modal.querySelector<HTMLButtonElement>('#marketplace-change-ssbu-version')!
      .addEventListener('click', async () => {
        await this.openSsbuVersionModal(modal);
        await refreshVersion();
      });

    let installedRepos: string[] = [];
    if (window.electronAPI && window.electronAPI.getPluginRepoMapping) {
      try {
        const result = await window.electronAPI.getPluginRepoMapping();
        if (result.success && result.mappings) {
          installedRepos = Object.values(result.mappings) as string[];
        }
      } catch (error) {
        console.warn(
          '[openPluginMarketplaceModal] Failed to get plugin repo mappings:',
          error,
        );
      }
    }

    if (window.pluginManager) {
      installedRepos.push(
        (await window.pluginManager.getLoader()) === 'ozone'
          ? 'WuBoytH/ozone'
          : 'skyline-dev/skyline',
      );
    }

    if (window.pluginMarketplace) {
      const plugins = window.pluginMarketplace.getPlugins();
      this.renderMarketplaceResults(plugins, resultsContainer!, installedRepos);
    }

    const closeBtn = modal.querySelector<HTMLElement>(
      '#close-marketplace-modal',
    );

    closeBtn!.addEventListener('click', () => {
      this.closePluginMarketplaceModal(modal);
    });

    const escapeHandler = (e) => {
      if (e.key === 'Escape' && modal.style.display !== 'none') {
        this.closePluginMarketplaceModal(modal);
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);
  };

  M.prototype.openSsbuVersionModal = async function (marketplaceModal: HTMLElement) {
    const current = await window.pluginMarketplace.getConfiguredSsbuVersion();
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'ssbu-version-modal';
    modal.style.maxWidth = '480px';
    modal.innerHTML = `
      <div class="modal-header"><h2 data-i18n="plugins.ssbuModalTitle">Your SSBU version</h2></div>
      <div class="modal-body">
        <p data-i18n="plugins.ssbuModalMessage">Select the game version installed on your Switch or emulator.</p>
        <fieldset class="ssbu-version-choices">
          <label><input type="radio" name="ssbu-marketplace-version" value="13.0.4" ${current === '13.0.4' ? 'checked' : ''}> 13.0.4</label>
          <label><input type="radio" name="ssbu-marketplace-version" value="13.0.5" ${current === '13.0.5' ? 'checked' : ''}> 13.0.5</label>
          <label class="ssbu-version-any">
            <span><input type="radio" name="ssbu-marketplace-version" value="any" ${current === 'any' ? 'checked' : ''}> <span data-i18n="plugins.ssbuAnyVersion">Let me choose any version</span></span>
            <small data-i18n="plugins.ssbuAnyVersionHint">Only select this if you know exactly which version you want for every plugin.</small>
          </label>
        </fieldset>
        <p class="ssbu-version-warning" data-i18n="plugins.ssbuReinstallWarning">After switching version, reinstall every installed plugin so it matches your game.</p>
      </div>
      <div class="modal-footer">
        <button type="button" class="modal-btn modal-btn-secondary" id="cancel-ssbu-version" data-i18n="common.cancel">Cancel</button>
        <button type="button" class="modal-btn modal-btn-primary" id="save-ssbu-version" data-i18n="common.save" ${current ? '' : 'disabled'}>Save</button>
      </div>`;
    document.body.appendChild(modal);
    marketplaceModal.style.display = 'none';
    this.showOverlay();
    modal.style.display = 'block';
    window.i18n?.updateDOM();

    return new Promise<string | null>((resolve) => {
      const save = modal.querySelector<HTMLButtonElement>('#save-ssbu-version')!;
      const escapeHandler = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          close(null);
        }
      };
      const close = (version: string | null) => {
        document.removeEventListener('keydown', escapeHandler, true);
        this.closeModal(modal, {
          skipHideOverlay: true,
          onModalClosed: () => {
            modal.remove();
            marketplaceModal.style.display = 'block';
            this.showOverlay();
            resolve(version);
          },
        });
      };
      document.addEventListener('keydown', escapeHandler, true);
      modal.querySelectorAll<HTMLInputElement>('input[name="ssbu-marketplace-version"]')
        .forEach((radio) => radio.addEventListener('change', () => { save.disabled = false; }));
      modal.querySelector<HTMLButtonElement>('#cancel-ssbu-version')!
        .addEventListener('click', () => close(null));
      save.addEventListener('click', async () => {
        const version = modal.querySelector<HTMLInputElement>('input[name="ssbu-marketplace-version"]:checked')?.value;
        if (version !== '13.0.4' && version !== '13.0.5' && version !== 'any') return;
        save.disabled = true;
        try {
          const saved = await window.electronAPI.store.set('ssbuVersion', version);
          if (!saved?.success) throw new Error('Failed to save SSBU version');
          if (version !== current) {
            window.toastManager?.info(window.i18n?.t?.('plugins.ssbuReinstallWarning') ||
              'After switching version, reinstall every installed plugin so it matches your game.');
          }
          close(version);
        } catch (error) {
          save.disabled = false;
          window.toastManager?.error(String(error));
        }
      });
    });
  };

  M.prototype.renderMarketplaceResults = function (
    plugins: any[],
    container: HTMLElement,
    installedRepos: string[] = [],
  ) {
    if (!plugins || plugins.length === 0) {
      container.innerHTML = `
      <div class="marketplace-empty">
        <i class="bi bi-inbox plugin-empty-icon"></i>
        <p data-i18n="plugins.marketplaceNoResults">No plugins available</p>
      </div>
    `;
      if (window.i18n) {
        window.i18n.updateDOM();
      }
      return;
    }

    const isRepoInstalled = (repo: string) =>
      installedRepos.some((installedRepo) => installedRepo.toLowerCase() === repo.toLowerCase());

    const showInstalledLoader = (repo: string) => {
      const loaderRepos = plugins
        .filter((item) => item.specialInstaller === 'plugin-loader')
        .map((item) => item.repo.toLowerCase());
      this.renderMarketplaceResults(plugins, container, [
        ...installedRepos.filter((installed) => !loaderRepos.includes(installed.toLowerCase())),
        repo,
      ]);
    };

    const switchLoaderFromCard = async (repo: string, btn: HTMLButtonElement) => {
      const marketplaceModal = btn.closest<HTMLElement>('#plugin-marketplace-modal');
      const loader = plugins.find((item) => item.repo === repo);
      if ((await window.pluginMarketplace.getConfiguredSsbuVersion()) === 'any' && loader && marketplaceModal) {
        this.openPluginVersionModal(loader, marketplaceModal, () => showInstalledLoader(repo));
        return;
      }
      const restore = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML =
        '<i class="bi bi-arrow-repeat spin"></i> <span data-i18n="plugins.installing">Installing...</span>';
      window.i18n?.updateDOM();
      if (await window.pluginManager.switchLoader(repo === 'WuBoytH/ozone' ? 'ozone' : 'skyline')) {
        showInstalledLoader(repo);
        return;
      }
      btn.disabled = false;
      btn.innerHTML = restore;
      window.i18n?.updateDOM();
    };

    const pluginsGrid = plugins
      .filter((plugin) => plugin.specialInstaller !== 'plugin-loader' || isRepoInstalled(plugin.repo))
      .map((plugin) => {
        const replacement = plugin.replaceWith
          ? plugins.find((item) => item.repo === plugin.replaceWith)
          : null;
        const isInstalled = installedRepos.some(
          (installedRepo) =>
            installedRepo.toLowerCase() === plugin.repo.toLowerCase(),
        );
        const isGameBanana = plugin.source === 'gamebanana';
        const isCskCollection = plugin.specialInstaller === 'csk-collection';
        const isLoader = plugin.specialInstaller === 'plugin-loader';
        const buttonClass = isInstalled
          ? 'marketplace-card-install-btn installed'
          : 'marketplace-card-install-btn';
        const buttonIcon =
          isInstalled && isCskCollection
            ? 'bi-sliders'
            : isInstalled
              ? 'bi-arrow-clockwise'
              : 'bi-download';
        const buttonTextKey = isInstalled
          ? isCskCollection
            ? ''
            : 'plugins.reinstall'
          : 'plugins.install';
        const buttonDefaultText = isInstalled
          ? isCskCollection
            ? 'Tweak'
            : 'Reinstall'
          : 'Install';
        const cardClass = isInstalled
          ? 'marketplace-plugin-card installed'
          : 'marketplace-plugin-card';

        return `
      <div class="${cardClass}" data-installed="${isInstalled}">
        <div class="marketplace-card-header">
          <div class="marketplace-card-title-section">
            <h3 class="marketplace-card-name">${escapeHtml(plugin.name)}</h3>
            <span class="marketplace-card-repo">${escapeHtml(plugin.repo)}</span>
          </div>
        </div>
        <div class="marketplace-card-body">
          <p class="marketplace-card-description">${escapeHtml(plugin.description || 'No description available')}</p>
        </div>
        <div class="marketplace-card-footer">
          <a href="${escapeHtml(plugin.url || `https://github.com/${plugin.repo}`)}" target="_blank" class="marketplace-card-link" rel="noopener noreferrer">
            <i class="bi ${isGameBanana ? 'bi-box-arrow-up-right' : 'bi-github'}"></i>
            <span>${isGameBanana ? 'View on GameBanana' : 'View on GitHub'}</span>
          </a>
          <div class="marketplace-install-group">
            <button class="${buttonClass}"
                    data-plugin-name="${escapeHtml(plugin.name)}"
                    data-plugin-repo="${escapeHtml(plugin.repo)}"
                    data-special-installer="${escapeHtml(plugin.specialInstaller || '')}"
                    data-is-installed="${isInstalled}">
              <i class="bi ${buttonIcon}"></i>
              <span ${buttonTextKey ? `data-i18n="${buttonTextKey}"` : ''}>${buttonDefaultText}</span>
            </button>
            ${isLoader && replacement ? `
            <button type="button" class="marketplace-card-version-btn"
                    data-plugin-repo="${escapeHtml(plugin.repo)}"
                    aria-haspopup="menu" aria-expanded="false"
                    data-i18n="plugins.moreInstallOptions" data-i18n-aria-label aria-label="More install options">
              <i class="bi bi-chevron-down"></i>
            </button>
            <div class="marketplace-version-menu marketplace-loader-menu" role="menu" hidden>
              <button type="button" role="menuitem" class="marketplace-version-menu-item"
                      data-replace-repo="${escapeHtml(replacement.repo)}">
                <i class="bi bi-arrow-left-right"></i>
                <span class="marketplace-loader-option">
                  <span>Replace with ${escapeHtml(replacement.name)}</span>
                  <span class="marketplace-loader-option-description">${escapeHtml(replacement.description)}</span>
                </span>
              </button>
              <button type="button" role="menuitem" class="marketplace-version-menu-item"
                      data-version-repo="${escapeHtml(plugin.repo)}">
                <i class="bi bi-clock-history"></i>
                <span>Change version of ${escapeHtml(plugin.name)}</span>
              </button>
            </div>` : isCskCollection || isLoader ? '' : `
            <button type="button" class="marketplace-card-version-btn"
                    data-plugin-repo="${escapeHtml(plugin.repo)}"
                    aria-haspopup="menu" aria-expanded="false"
                    data-i18n="plugins.moreInstallOptions" data-i18n-aria-label aria-label="More install options">
              <i class="bi bi-chevron-down"></i>
            </button>
            <div class="marketplace-version-menu" role="menu" hidden>
              <button type="button" role="menuitem" class="marketplace-version-menu-item">
                <i class="bi bi-clock-history"></i>
                <span data-i18n="plugins.chooseVersion">Choose version</span>
              </button>
            </div>`}
          </div>
        </div>
      </div>
    `;
      })
      .join('');

    container.innerHTML = `<div class="marketplace-grid">${pluginsGrid}</div>`;

    if (window.i18n) {
      window.i18n.updateDOM();
    }

    const githubLinks = container.querySelectorAll<HTMLElement>(
      '.marketplace-card-link',
    );
    githubLinks.forEach((link) => {
      link.addEventListener('click', async (e) => {
        e.preventDefault();
        const url = link.getAttribute('href');
        if (url && window.electronAPI && window.electronAPI.openUrl) {
          await window.electronAPI.openUrl(url);
        } else if (url) {
          window.open(url, '_blank');
        }
      });
    });

    const installButtons = container.querySelectorAll<HTMLButtonElement>(
      '.marketplace-card-install-btn',
    );

    installButtons.forEach((btn) => {
      btn.addEventListener('click', async () => {
        const pluginName = btn.dataset.pluginName as string;
        const pluginRepo = btn.dataset.pluginRepo as string;
        const specialInstaller = btn.dataset.specialInstaller as string;
        const isInstalled = btn.dataset.isInstalled === 'true';
        const isCskCollection = specialInstaller === 'csk-collection';
        const restoreIcon =
          isInstalled && isCskCollection
            ? 'bi-sliders'
            : isInstalled
              ? 'bi-arrow-clockwise'
              : 'bi-download';
        const restoreTextKey = isInstalled
          ? isCskCollection
            ? ''
            : 'plugins.reinstall'
          : 'plugins.install';
        const restoreText = isInstalled
          ? isCskCollection
            ? 'Tweak'
            : 'Reinstall'
          : 'Install';
        const plugin = plugins.find(
          (item) => item.name === pluginName && item.repo === pluginRepo,
        );

        if (specialInstaller === 'plugin-loader') {
          await switchLoaderFromCard(pluginRepo, btn);
          return;
        }

        const marketplaceModal = btn.closest<HTMLElement>('#plugin-marketplace-modal');
        let ssbuVersion = await window.pluginMarketplace.getConfiguredSsbuVersion();
        if (!ssbuVersion) {
          if (!marketplaceModal) return;
          ssbuVersion = await this.openSsbuVersionModal(marketplaceModal);
          if (!ssbuVersion) return;
          marketplaceModal.querySelector<HTMLElement>('#marketplace-ssbu-version')!.textContent =
            ssbuVersionLabel(ssbuVersion);
        }
        if (ssbuVersion === 'any') {
          if (!plugin || !marketplaceModal) return;
          if (isCskCollection) {
            marketplaceModal.style.display = 'none';
            await this.openCskCollectionInstallModal(plugin, marketplaceModal, isInstalled);
          } else {
            this.openPluginVersionModal(plugin, marketplaceModal);
          }
          return;
        }

        btn.disabled = true;
        btn.innerHTML =
          '<i class="bi bi-arrow-repeat spin"></i> <span data-i18n="plugins.installing">Installing...</span>';
        if (window.i18n) {
          window.i18n.updateDOM();
        }

        try {
        if (window.pluginMarketplace) {
          if (specialInstaller === 'arcropolis' && plugin) {
            const release = await window.electronAPI.getGithubRelease(
              pluginRepo, ssbuVersion === '13.0.4' ? 'v4.0.8' : 'v4.1.1',
            );
            if (!release.success) throw new Error(release.error || 'ARCropolis release unavailable');
            const installed = await window.pluginMarketplace.downloadAndInstallPlugin(
              pluginName, pluginRepo,
              { url: release.downloadUrl, version: release.version },
            );
            if (!installed) {
              btn.disabled = false;
              btn.innerHTML = `<i class="bi ${restoreIcon}"></i> <span ${restoreTextKey ? `data-i18n="${restoreTextKey}"` : ''}>${restoreText}</span>`;
              window.i18n?.updateDOM();
              return;
            }
            btn.closest('.marketplace-plugin-card')?.classList.add('installed');
            btn.dataset.isInstalled = 'true';
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> <span data-i18n="plugins.reinstall">Reinstall</span>';
            window.i18n?.updateDOM();
            return;
          }

          if (specialInstaller === 'csk-collection' && plugin) {
            btn.disabled = false;
            btn.innerHTML = `<i class="bi ${restoreIcon}"></i> <span ${restoreTextKey ? `data-i18n="${restoreTextKey}"` : ''}>${restoreText}</span>`;
            if (window.i18n) {
              window.i18n.updateDOM();
            }
            const marketplaceModal = btn.closest<HTMLElement>(
              '#plugin-marketplace-modal',
            );
            if (marketplaceModal) {
              marketplaceModal.style.display = 'none';
            }
            await this.openCskCollectionInstallModal(
              plugin,
              marketplaceModal,
              isInstalled,
            );
            return;
          }

          if (specialInstaller === 'one-slot-effects' && plugin) {
            const file = await window.pluginMarketplace.getCompatibleOneSlotEffectsFile(ssbuVersion);
            await window.pluginMarketplace.installOneSlotEffects({
              downloadUrl: file._sDownloadUrl,
              version: file._sVersion || file._sFile || '',
            });
            btn.closest('.marketplace-plugin-card')?.classList.add('installed');
            btn.dataset.isInstalled = 'true';
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> <span data-i18n="plugins.reinstall">Reinstall</span>';
            window.i18n?.updateDOM();
            window.toastManager?.success('One Slot Effects installed');
            return;
          }

          const downloadUrl =
            await window.pluginMarketplace.getCompatibleGithubDownload(
              pluginRepo, ssbuVersion,
            );

          if (downloadUrl) {
            const installed =
              (await window.pluginMarketplace.downloadAndInstallPlugin(
                pluginName,
                pluginRepo,
                downloadUrl,
              )) === true;

            const card = btn.closest('.marketplace-plugin-card');
            if (installed && card) {
              card.classList.add('installed');
              btn.disabled = false;
              btn.innerHTML =
                '<i class="bi bi-check-circle-fill"></i> <span data-i18n="plugins.installed">Installed</span>';
              if (window.i18n) {
                window.i18n.updateDOM();
              }
            } else if (!installed) {
              btn.disabled = false;
              btn.innerHTML = `<i class="bi ${restoreIcon}"></i> <span ${restoreTextKey ? `data-i18n="${restoreTextKey}"` : ''}>${restoreText}</span>`;
              if (window.i18n) {
                window.i18n.updateDOM();
              }
            }
          } else {
            console.error(
              `[renderMarketplaceResults] Failed to get download URL for ${pluginName} from repo ${pluginRepo}`,
            );
            if (window.toastManager) {
              window.toastManager.error(
                `No .nro or .zip file found in latest release for ${pluginName}. Please check the GitHub repository.`,
              );
            }
            btn.disabled = false;
            btn.innerHTML =
              '<i class="bi bi-download"></i> <span data-i18n="plugins.install">Install</span>';
            if (window.i18n) {
              window.i18n.updateDOM();
            }
          }
        }
        } catch (error) {
          console.error('[Marketplace] Install failed:', error);
          window.toastManager?.error(error.message || String(error));
          btn.disabled = false;
          btn.innerHTML = `<i class="bi ${restoreIcon}"></i> <span ${restoreTextKey ? `data-i18n="${restoreTextKey}"` : ''}>${restoreText}</span>`;
          window.i18n?.updateDOM();
        }
      });
    });

    const closeVersionMenus = () => {
      container.querySelectorAll<HTMLElement>('.marketplace-version-menu').forEach((menu) => {
        menu.hidden = true;
        menu.previousElementSibling?.setAttribute('aria-expanded', 'false');
      });
    };
    if (!container.dataset.versionMenuBound) {
      container.dataset.versionMenuBound = 'true';
      const outsideClick = (event: MouseEvent) => {
        if (!document.body.contains(container)) {
          document.removeEventListener('click', outsideClick);
          return;
        }
        if (!(event.target as HTMLElement).closest('.marketplace-install-group')) closeVersionMenus();
      };
      document.addEventListener('click', outsideClick);
    }

    container.querySelectorAll<HTMLButtonElement>('.marketplace-card-version-btn').forEach((toggle) => {
      const menu = toggle.nextElementSibling as HTMLElement;
      toggle.addEventListener('click', () => {
        const opening = menu.hidden;
        closeVersionMenus();
        menu.hidden = !opening;
        toggle.setAttribute('aria-expanded', String(opening));
      });
      menu.querySelectorAll<HTMLButtonElement>('.marketplace-version-menu-item').forEach((menuItem) => {
        menuItem.addEventListener('click', () => {
          closeVersionMenus();
          if (menuItem.dataset.replaceRepo) {
            const installBtn = toggle.parentElement!.querySelector<HTMLButtonElement>(
              '.marketplace-card-install-btn',
            )!;
            void switchLoaderFromCard(menuItem.dataset.replaceRepo, installBtn);
            return;
          }
          const repo = menuItem.dataset.versionRepo || toggle.dataset.pluginRepo;
          const plugin = plugins.find((item) => item.repo === repo);
          const marketplaceModal = toggle.closest<HTMLElement>('#plugin-marketplace-modal');
          if (!plugin || !marketplaceModal) return;
          const onInstalled = plugin.specialInstaller === 'plugin-loader'
            ? () => showInstalledLoader(plugin.repo)
            : undefined;
          this.openPluginVersionModal(plugin, marketplaceModal, onInstalled);
        });
      });
    });
  };

  M.prototype.openPluginVersionModal = async function (
    plugin: any,
    marketplaceModal: HTMLElement,
    onInstalled?: () => void,
  ) {
    document.querySelectorAll('#plugin-version-modal').forEach((existing) => existing.remove());
    const confirmLabel = '<i class="bi bi-download"></i><span data-i18n="plugins.installSelectedVersion">Install selected version</span>';
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'plugin-version-modal';
    modal.style.maxWidth = '560px';
    modal.innerHTML = `
      <div class="modal-header">
        <h2><span data-i18n="plugins.changeVersionOf">Change version of</span> ${escapeHtml(plugin.name)}</h2>
      </div>
      <div class="modal-body" id="plugin-version-body">
        <div class="marketplace-loading"><i class="bi bi-arrow-repeat spin"></i><span data-i18n="plugins.loadingVersions">Loading versions...</span></div>
      </div>
      <div class="modal-footer">
        <button type="button" class="modal-btn modal-btn-secondary" id="cancel-plugin-version" data-i18n="common.cancel">Cancel</button>
        <button type="button" class="modal-btn modal-btn-primary" id="confirm-plugin-version" disabled>${confirmLabel}</button>
      </div>`;
    document.body.appendChild(modal);
    marketplaceModal.style.display = 'none';
    this.showOverlay();
    modal.style.display = 'block';
    window.i18n?.updateDOM();

    const body = modal.querySelector<HTMLElement>('#plugin-version-body')!;
    const confirmBtn = modal.querySelector<HTMLButtonElement>('#confirm-plugin-version')!;
    let closing = false;
    const escapeHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
      }
    };
    const close = () => {
      if (closing) return;
      closing = true;
      document.removeEventListener('keydown', escapeHandler, true);
      this.closeModal(modal, {
        skipHideOverlay: true,
        onModalClosed: () => {
          modal.remove();
          if (document.body.contains(marketplaceModal)) marketplaceModal.style.display = 'block';
          this.showOverlay();
        },
      });
    };
    document.addEventListener('keydown', escapeHandler, true);
    modal.querySelector<HTMLButtonElement>('#cancel-plugin-version')!.addEventListener('click', close);

    let choices: Array<{ label: string; url: string; version: string; date: string; tag?: string }>;
    try {
      choices = await window.pluginMarketplace.getVersionChoices(plugin);
    } catch (error) {
      if (closing) return;
      body.innerHTML = `
        <div class="marketplace-empty">
          <i class="bi bi-exclamation-triangle"></i>
          <p data-i18n="plugins.versionsUnavailable">Versions could not be loaded.</p>
          <small>${escapeHtml(error.message || String(error))}</small>
        </div>`;
      window.i18n?.updateDOM();
      return;
    }
    if (closing) return;

    if (choices.length === 0) {
      body.innerHTML = `
        <div class="marketplace-empty">
          <i class="bi bi-inbox"></i>
          <p data-i18n="plugins.noVersions">No installable version found.</p>
        </div>`;
      window.i18n?.updateDOM();
      return;
    }

    const normalizeVersion = (version: string) => String(version || '').trim().replace(/^v/i, '').toLowerCase();
    let installedVersion = '';
    try {
      const [mappingResult, storedVersions] = await Promise.all([
        window.electronAPI.getPluginRepoMapping(),
        window.electronAPI.store.get('pluginVersions'),
      ]);
      const mappings = ('mappings' in mappingResult ? mappingResult.mappings : {}) as Record<string, string>;
      const fileKey = Object.entries(mappings)
        .find(([, repo]) => repo.toLowerCase() === plugin.repo.toLowerCase())?.[0];
      installedVersion = fileKey ? normalizeVersion((storedVersions || {})[fileKey]) : '';
      if (plugin.specialInstaller === 'plugin-loader') {
        const loader = await window.electronAPI.store.get('pluginLoader');
        const loaderRepo = loader === 'ozone' ? 'WuBoytH/ozone' : 'skyline-dev/skyline';
        installedVersion = loaderRepo === plugin.repo
          ? normalizeVersion(String((await window.electronAPI.store.get('pluginLoaderVersion')) || ''))
          : '';
      }
    } catch (error) {
      console.warn('[openPluginVersionModal] Failed to read installed version:', error);
    }
    if (closing) return;

    const isGitHub = plugin.source !== 'gamebanana';
    body.innerHTML = `
      <div class="plugin-version-choices-scroll">
      <fieldset class="plugin-version-choices">
        ${choices.map((choice, index) => `
          <label class="plugin-version-option">
            <span class="plugin-version-option-title">
              <input type="radio" name="marketplace-plugin-version" value="${index}" ${index === 0 ? 'checked' : ''}>
              ${escapeHtml(choice.label)}
              ${choice.tag && choice.tag !== choice.label ? `<code class="plugin-version-tag">${escapeHtml(choice.tag)}</code>` : ''}
              ${isGitHub && index === 0 ? '<span class="plugin-version-badge" data-i18n="plugins.latestVersion">Latest</span>' : ''}
              ${installedVersion && normalizeVersion(choice.version) === installedVersion ? '<span class="plugin-version-badge plugin-version-badge-installed"><i class="bi bi-check-circle-fill"></i> <span data-i18n="plugins.installedVersion">Installed version</span></span>' : ''}
            </span>
            ${choice.date ? `<span class="plugin-version-option-text">${escapeHtml(new Date(choice.date).toLocaleDateString())}</span>` : ''}
          </label>`).join('')}
      </fieldset>
      </div>`;
    window.i18n?.updateDOM();
    confirmBtn.disabled = false;

    const list = body.querySelector<HTMLElement>('.plugin-version-choices-scroll')!;
    modal.addEventListener('wheel', (event) => {
      event.preventDefault();
      list.scrollTop += event.deltaY;
    }, { passive: false });

    confirmBtn.addEventListener('click', async () => {
      const selected = body.querySelector<HTMLInputElement>('input[name="marketplace-plugin-version"]:checked');
      const choice = choices[Number(selected?.value)];
      if (!choice) return;
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<i class="bi bi-arrow-repeat spin"></i><span data-i18n="plugins.installing">Installing...</span>';
      window.i18n?.updateDOM();

      let installed = false;
      try {
        if (plugin.specialInstaller === 'plugin-loader') {
          installed = await window.pluginManager.switchLoader(
            plugin.repo === 'WuBoytH/ozone' ? 'ozone' : 'skyline',
            { downloadUrl: choice.url, version: choice.version },
          );
        } else if (plugin.specialInstaller === 'one-slot-effects') {
          await window.pluginMarketplace.installOneSlotEffects({ downloadUrl: choice.url, version: choice.version });
          window.toastManager?.success(`${plugin.name} ${choice.version} installed`);
          installed = true;
        } else {
          installed = (await window.pluginMarketplace.downloadAndInstallPlugin(
            plugin.name, plugin.repo, { url: choice.url, version: choice.version },
          )) === true;
        }
      } catch (error) {
        window.toastManager?.error(error.message || String(error));
      }

      if (!installed) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = confirmLabel;
        window.i18n?.updateDOM();
        return;
      }

      const installBtn = Array.from(
        marketplaceModal.querySelectorAll<HTMLButtonElement>('.marketplace-card-install-btn'),
      ).find((button) => button.dataset.pluginRepo === plugin.repo);
      if (installBtn) {
        installBtn.dataset.isInstalled = 'true';
        installBtn.closest('.marketplace-plugin-card')?.classList.add('installed');
        installBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> <span data-i18n="plugins.reinstall">Reinstall</span>';
        window.i18n?.updateDOM();
      }
      onInstalled?.();
      close();
    });
  };

  M.prototype.openArcropolisInstallModal = async function (
    plugin: any,
    marketplaceModal?: HTMLElement | null,
    isInstalled = false,
  ) {
    document
      .querySelectorAll<HTMLElement>('#arcropolis-install-modal')
      .forEach((existingModal) => existingModal.remove());

    const modal = document.createElement('div');
    modal.className = 'modal modal-large';
    modal.id = 'arcropolis-install-modal';
    modal.style.maxWidth = '680px';

    const restoreMarketplace = () => {
      if (marketplaceModal && document.body.contains(marketplaceModal)) {
        marketplaceModal.style.display = 'block';
      }
    };
    let closing = false;
    let escapeHandler: ((event: KeyboardEvent) => void) | null = null;
    const closeAndRestoreMarketplace = () => {
      if (closing) return;
      closing = true;
      if (escapeHandler) {
        document.removeEventListener('keydown', escapeHandler);
      }
      this.closeModal(modal, {
        skipHideOverlay: true,
        onModalClosed: () => {
          modal.remove();
          restoreMarketplace();
          this.showOverlay();
        },
      });
    };

    modal.innerHTML = `
      <div class="modal-header">
        <h2>${isInstalled ? 'Reinstall' : 'Install'} ARCropolis</h2>
        <button class="modal-close" id="close-arcropolis-install" type="button" aria-label="Close ARCropolis installer">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>
      <div class="modal-body" id="arcropolis-install-body">
        <div class="marketplace-loading"><i class="bi bi-arrow-repeat"></i><span>Loading ARCropolis releases...</span></div>
      </div>
      <div class="modal-footer">
        <button class="modal-btn modal-btn-secondary" id="cancel-arcropolis-install" type="button">Cancel</button>
        <button class="modal-btn modal-btn-primary" id="confirm-arcropolis-install" type="button" disabled>
          <i class="bi bi-download"></i><span>${isInstalled ? 'Reinstall' : 'Install'} selected version</span>
        </button>
      </div>
    `;

    document.body.appendChild(modal);
    this.showOverlay();
    modal.style.display = 'block';

    const body = modal.querySelector<HTMLElement>(
      '#arcropolis-install-body',
    )!;
    const confirmBtn = modal.querySelector<HTMLButtonElement>(
      '#confirm-arcropolis-install',
    )!;
    const closeBtn = modal.querySelector<HTMLButtonElement>(
      '#close-arcropolis-install',
    )!;
    const cancelBtn = modal.querySelector<HTMLButtonElement>(
      '#cancel-arcropolis-install',
    )!;
    closeBtn.addEventListener('click', closeAndRestoreMarketplace);
    cancelBtn.addEventListener('click', closeAndRestoreMarketplace);
    escapeHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeAndRestoreMarketplace();
      }
    };
    document.addEventListener('keydown', escapeHandler);

    let choices: any;
    try {
      choices = await window.pluginMarketplace.getArcropolisReleaseChoices();
    } catch (error) {
      body.innerHTML = `
        <div class="marketplace-empty">
          <i class="bi bi-exclamation-triangle"></i>
          <p>ARCropolis releases could not be loaded.</p>
          <small>${escapeHtml(error.message || String(error))}</small>
        </div>
      `;
      return;
    }

    if (!document.body.contains(modal)) return;

    const latestCompatibility =
      'Supports only Super Smash Bros. Ultimate 13.0.5.';

    body.innerHTML = `
      <fieldset class="plugin-version-choices">
        <legend class="plugin-version-legend">Choose a version</legend>
        <label class="plugin-version-option plugin-version-option-recommended">
          <span class="plugin-version-option-title">
            <input type="radio" name="marketplace-arcropolis-release" value="recommended" checked>
            ARCropolis 4.0.8
            <span class="plugin-version-badge">Recommended</span>
          </span>
          <span class="plugin-version-option-text">
            Supports only Super Smash Bros. Ultimate 13.0.4. Recommended now because it works better with existing mods while adoption catches up.
          </span>
        </label>
        <label class="plugin-version-option">
          <span class="plugin-version-option-title">
            <input type="radio" name="marketplace-arcropolis-release" value="latest">
            ARCropolis ${escapeHtml(choices.latest.version)}
            <span class="plugin-version-badge">Latest</span>
          </span>
          <span class="plugin-version-option-text">
            ${latestCompatibility} Some mods may not support this release yet.
          </span>
        </label>
      </fieldset>
    `;
    confirmBtn.disabled = false;

    confirmBtn.addEventListener('click', async () => {
      const selected = body.querySelector<HTMLInputElement>(
        'input[name="marketplace-arcropolis-release"]:checked',
      );
      const release =
        selected?.value === 'latest' ? choices.latest : choices.recommended;

      confirmBtn.disabled = true;
      confirmBtn.innerHTML =
        '<i class="bi bi-arrow-repeat spin"></i><span>Installing...</span>';

      const installed =
        (await window.pluginMarketplace.downloadAndInstallPlugin(
          plugin.name,
          plugin.repo,
          { url: release.downloadUrl, version: release.version },
        )) === true;

      if (!installed) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = `<i class="bi bi-download"></i><span>${isInstalled ? 'Reinstall' : 'Install'} selected version</span>`;
        return;
      }

      const marketplaceButton = Array.from(
        marketplaceModal?.querySelectorAll<HTMLButtonElement>(
          '.marketplace-card-install-btn',
        ) || [],
      ).find((button) => button.dataset.pluginRepo === plugin.repo);
      if (marketplaceButton) {
        marketplaceButton.dataset.isInstalled = 'true';
        marketplaceButton.closest('.marketplace-plugin-card')?.classList.add(
          'installed',
        );
        marketplaceButton.innerHTML =
          '<i class="bi bi-arrow-clockwise"></i><span data-i18n="plugins.reinstall">Reinstall</span>';
      }

      closeAndRestoreMarketplace();
    });
  };

  M.prototype.openCskCollectionInstallModal = async function (
    plugin: any,
    marketplaceModal?: HTMLElement | null,
    isInstalled = false,
  ) {
    document
      .querySelectorAll<HTMLElement>('#csk-collection-install-modal')
      .forEach((existingModal) => existingModal.remove());

    const modal = document.createElement('div');
    modal.className = 'modal modal-large';
    modal.id = 'csk-collection-install-modal';
    modal.style.maxWidth = '680px';

    const restoreMarketplace = () => {
      if (marketplaceModal && document.body.contains(marketplaceModal)) {
        marketplaceModal.style.display = 'block';
      }
    };

    const closeAndRestoreMarketplace = () => {
      this.closeModal('csk-collection-install-modal', {
        skipHideOverlay: true,
        onModalClosed: () => {
          modal.remove();
          restoreMarketplace();
          this.showOverlay();
        },
      });
    };

    modal.innerHTML = `
      <div class="modal-header">
        <h2>${isInstalled ? 'Tweak CSK Collection' : 'Install CSK Collection'}</h2>
        <button class="modal-close" id="close-csk-install" type="button">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>
      <div class="modal-body">
        <div class="csk-install-panel">
          <label class="csk-install-label" for="csk-version-select">Version</label>
          <select id="csk-version-select" class="input-field"></select>
          <div class="csk-install-row">
            <strong>Optional toggles</strong>
            <div class="csk-install-actions">
              <button class="modal-btn modal-btn-secondary" id="csk-select-all" type="button">Select all</button>
              <button class="modal-btn modal-btn-secondary" id="csk-select-none" type="button">Select none</button>
            </div>
          </div>
          <div id="csk-options-list" class="csk-options-list">
            <div class="marketplace-empty">Loading options...</div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="modal-btn modal-btn-secondary" id="cancel-csk-install">Cancel</button>
        <button class="modal-btn modal-btn-primary" id="confirm-csk-install">
          <i class="bi ${isInstalled ? 'bi-check2' : 'bi-download'}"></i>
          <span>${isInstalled ? 'Apply' : 'Install'}</span>
        </button>
      </div>
    `;

    document.body.appendChild(modal);
    this.showOverlay();
    modal.style.display = 'block';

    const versionSelect =
      modal.querySelector<HTMLSelectElement>('#csk-version-select')!;
    const optionsList = modal.querySelector<HTMLElement>('#csk-options-list')!;
    const confirmBtn =
      modal.querySelector<HTMLButtonElement>('#confirm-csk-install')!;
    const cancelBtn =
      modal.querySelector<HTMLButtonElement>('#cancel-csk-install')!;
    const closeBtn = modal.querySelector<HTMLButtonElement>(
      '#close-csk-install',
    )!;
    const selectAllBtn =
      modal.querySelector<HTMLButtonElement>('#csk-select-all')!;
    const selectNoneBtn =
      modal.querySelector<HTMLButtonElement>('#csk-select-none')!;

    let files: any[] = [];
    let activeOptions: string[] = [];
    let installedCskMods = new Set<string>();
    let archiveId = '';
    let optionsLoadId = 0;

    const escape = (value: string) => escapeHtml(String(value || ''));
    const setBusy = (busy: boolean, text = 'Install') => {
      confirmBtn.disabled = busy;
      confirmBtn.innerHTML = busy
        ? '<i class="bi bi-arrow-repeat spin"></i><span>Installing...</span>'
        : `<i class="bi ${isInstalled ? 'bi-check2' : 'bi-download'}"></i><span>${text}</span>`;
    };

    const getSelectedFile = () =>
      files.find((file) => String(file._idRow) === versionSelect.value) ||
      files[0];

    const getInstalledCskMods = async (options: string[]) => {
      if (!isInstalled || !window.settingsManager?.getModsPath) {
        return new Set<string>();
      }

      const modsPath = window.settingsManager.getModsPath();
      if (!modsPath || !window.electronAPI?.readModsFolder) {
        return new Set<string>();
      }

      try {
        const result = await window.electronAPI.readModsFolder(modsPath);
        if (!result.success) {
          return new Set<string>();
        }

        const optionNames = new Set(options);
        const installedNames = [
          ...(result.activeMods || []),
          ...(result.disabledMods || []),
        ]
          .map((mod) => mod?.name || mod?.folderName || '')
          .filter((name) => optionNames.has(name));

        return new Set(installedNames);
      } catch (error) {
        console.warn('[CSK Collection] Failed to detect installed toggles:', error);
        return new Set<string>();
      }
    };

    const renderOptions = (options: string[]) => {
      activeOptions = options;
      if (!options.length) {
        optionsList.innerHTML =
          '<div class="marketplace-empty">No optional toggles found in archive.</div>';
        return;
      }

      optionsList.innerHTML = options
        .map(
          (name) => `
            <label class="csk-option-item">
              <input type="checkbox" value="${escape(name)}" ${isInstalled ? (installedCskMods.has(name) ? 'checked' : '') : 'checked'}>
              <span>${escape(name)}</span>
            </label>
          `,
        )
        .join('');
    };

    const loadOptions = async () => {
      const selectedFile = getSelectedFile();
      if (!selectedFile) return;
      const loadId = ++optionsLoadId;

      optionsList.innerHTML =
        '<div class="marketplace-empty">Reading archive options...</div>';
      archiveId = '';
      setBusy(true, 'Install');

      try {
        const inspection =
          await window.pluginMarketplace.inspectCskCollectionArchive(
            selectedFile._sDownloadUrl,
          );
        if (loadId !== optionsLoadId) return;

        const availableMods = inspection.availableMods || [];
        archiveId = inspection.archiveId || '';
        installedCskMods = await getInstalledCskMods(availableMods);
        if (loadId !== optionsLoadId) return;

        renderOptions(availableMods);
      } catch (error) {
        if (loadId !== optionsLoadId) return;

        console.error('[CSK Collection] Failed to inspect archive:', error);
        optionsList.innerHTML = `<div class="marketplace-empty">${escape(error.message || 'Failed to inspect archive')}</div>`;
      } finally {
        if (loadId === optionsLoadId) {
          setBusy(false, isInstalled ? 'Apply' : 'Install');
        }
      }
    };

    try {
      files = await window.pluginMarketplace.getGameBananaFiles(
        plugin.gameBanana.modelName,
        plugin.gameBanana.submissionId,
      );

      versionSelect.innerHTML = files
        .map(
          (file) => `
            <option value="${escape(String(file._idRow || ''))}">
              ${escape(window.pluginMarketplace.getGameBananaFileLabel(file))}
            </option>
          `,
        )
        .join('');

      await loadOptions();
    } catch (error) {
      console.error('[CSK Collection] Failed to load versions:', error);
      optionsList.innerHTML = `<div class="marketplace-empty">${escape(error.message || 'Failed to load versions')}</div>`;
      confirmBtn.disabled = true;
    }

    versionSelect.addEventListener('change', () => {
      void loadOptions();
    });

    selectAllBtn.addEventListener('click', () => {
      optionsList
        .querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
        .forEach((input) => (input.checked = true));
    });

    selectNoneBtn.addEventListener('click', () => {
      optionsList
        .querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
        .forEach((input) => (input.checked = false));
    });

    cancelBtn.addEventListener('click', closeAndRestoreMarketplace);
    closeBtn.addEventListener('click', closeAndRestoreMarketplace);

    confirmBtn.addEventListener('click', async () => {
      const selectedFile = getSelectedFile();
      if (!selectedFile) return;

      const selectedMods = Array.from(
        optionsList.querySelectorAll<HTMLInputElement>(
          'input[type="checkbox"]:checked',
        ),
      )
        .map((input) => input.value)
        .filter((name) => activeOptions.includes(name));

      setBusy(true);

      try {
        await window.pluginMarketplace.installCskCollection({
          downloadUrl: selectedFile._sDownloadUrl,
          version: selectedFile._sVersion || '',
          selectedMods,
          archiveId,
        });
        window.toastManager?.success(
          `CSK Collection installed with ${selectedMods.length} toggle(s)`,
        );
        this.closeModal('csk-collection-install-modal', {
          onModalClosed: () => {
            modal.remove();
            marketplaceModal?.remove();
          },
        });
      } catch (error) {
        console.error('[CSK Collection] Install failed:', error);
        window.toastManager?.error(
          `Failed to install CSK Collection: ${error.message}`,
        );
        setBusy(false, isInstalled ? 'Apply' : 'Install');
      }
    });
  };

  M.prototype.openOneSlotEffectsInstallModal = async function (
    plugin: any,
    marketplaceModal?: HTMLElement | null,
  ) {
    document
      .querySelectorAll<HTMLElement>('#one-slot-effects-install-modal')
      .forEach((existingModal) => existingModal.remove());

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'one-slot-effects-install-modal';
    modal.style.maxWidth = '520px';

    const restoreMarketplace = () => {
      if (marketplaceModal && document.body.contains(marketplaceModal)) {
        marketplaceModal.style.display = 'block';
      }
    };

    const closeAndRestoreMarketplace = () => {
      this.closeModal('one-slot-effects-install-modal', {
        skipHideOverlay: true,
        onModalClosed: () => {
          modal.remove();
          restoreMarketplace();
          this.showOverlay();
        },
      });
    };

    modal.innerHTML = `
      <div class="modal-header">
        <h2>Install One Slot Effects</h2>
        <button class="modal-close" id="close-one-slot-effects-install" type="button">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>
      <div class="modal-body">
        <div class="csk-install-panel">
          <label class="csk-install-label" for="one-slot-effects-version-select">Version</label>
          <select id="one-slot-effects-version-select" class="input-field"></select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="modal-btn modal-btn-secondary" id="cancel-one-slot-effects-install">Cancel</button>
        <button class="modal-btn modal-btn-primary" id="confirm-one-slot-effects-install">
          <i class="bi bi-download"></i>
          <span>Install</span>
        </button>
      </div>
    `;

    document.body.appendChild(modal);
    this.showOverlay();
    modal.style.display = 'block';

    const versionSelect = modal.querySelector<HTMLSelectElement>(
      '#one-slot-effects-version-select',
    )!;
    const confirmBtn = modal.querySelector<HTMLButtonElement>(
      '#confirm-one-slot-effects-install',
    )!;
    const cancelBtn = modal.querySelector<HTMLButtonElement>(
      '#cancel-one-slot-effects-install',
    )!;
    const closeBtn = modal.querySelector<HTMLButtonElement>(
      '#close-one-slot-effects-install',
    )!;

    let files: any[] = [];
    const escape = (value: string) => escapeHtml(String(value || ''));
    const getSelectedFile = () =>
      files.find((file) => String(file._idRow) === versionSelect.value) ||
      files[0];

    const setBusy = (busy: boolean) => {
      confirmBtn.disabled = busy;
      confirmBtn.innerHTML = busy
        ? '<i class="bi bi-arrow-repeat spin"></i><span>Installing...</span>'
        : '<i class="bi bi-download"></i><span>Install</span>';
    };

    try {
      files = await window.pluginMarketplace.getGameBananaFiles(
        plugin.gameBanana.modelName,
        plugin.gameBanana.submissionId,
      );

      versionSelect.innerHTML = files
        .map(
          (file) => `
            <option value="${escape(String(file._idRow || ''))}">
              ${escape(window.pluginMarketplace.getGameBananaFileLabel(file))}
            </option>
          `,
        )
        .join('');
    } catch (error) {
      console.error('[One Slot Effects] Failed to load versions:', error);
      versionSelect.innerHTML = '<option>Failed to load versions</option>';
      confirmBtn.disabled = true;
    }

    cancelBtn.addEventListener('click', closeAndRestoreMarketplace);
    closeBtn.addEventListener('click', closeAndRestoreMarketplace);

    confirmBtn.addEventListener('click', async () => {
      const selectedFile = getSelectedFile();
      if (!selectedFile) return;

      setBusy(true);

      try {
        await window.pluginMarketplace.installOneSlotEffects({
          downloadUrl: selectedFile._sDownloadUrl,
          version: selectedFile._sVersion || selectedFile._sFile || '',
        });
        window.toastManager?.success('One Slot Effects installed');
        this.closeModal('one-slot-effects-install-modal', {
          onModalClosed: () => {
            modal.remove();
            marketplaceModal?.remove();
          },
        });
      } catch (error) {
        console.error('[One Slot Effects] Install failed:', error);
        window.toastManager?.error(
          `Failed to install One Slot Effects: ${error.message}`,
        );
        setBusy(false);
      }
    });
  };

  M.prototype.closePluginMarketplaceModal = function (
    modalToClose?: HTMLElement,
  ) {
    const modals = modalToClose
      ? [modalToClose]
      : Array.from(
          document.querySelectorAll<HTMLElement>('#plugin-marketplace-modal'),
        );

    modals.forEach((modal) => {
      this.closeModal(modal, {
        onModalClosed: () => modal.remove(),
      });
    });
  };

  M.prototype.openPluginUpdateIntroModal = function (onEnable, onDisable) {
    const modal = document.createElement('div');

    modal.className = 'modal';
    modal.id = 'plugin-intro-modal';
    modal.style.maxWidth = '500px';
    modal.dataset.blocking = 'true';

    modal.style.transform = 'translate(-50%, -50%)';

    modal.innerHTML = `
    <div class="modal-header">
      <h3 data-i18n="modals.pluginIntro.title">Automatic Plugin Updates</h3>
    </div>
    <div class="modal-body">
      <p data-i18n="modals.pluginIntro.message">
        We detected that you have a plugins folder configured. Would you like to enable automatic plugin update checks on startup?
      </p>
    </div>
    <div class="modal-footer">
      <button class="modal-btn modal-btn-primary" id="enable-plugin-updates">
        <i class="bi bi-check-lg"></i> <span data-i18n="modals.pluginIntro.enable">Yes, Enable Auto-Updates</span>
      </button>
      <button class="modal-btn modal-btn-secondary" id="disable-plugin-updates">
        <span data-i18n="modals.pluginIntro.disable">No, thanks</span>
      </button>
    </div>
  `;

    document.body.appendChild(modal);
    this.showOverlay();
    modal.style.display = 'block';

    if (window.i18n) {
      window.i18n.updateDOM();
    }

    const enableBtn = modal.querySelector<HTMLElement>(
      '#enable-plugin-updates',
    );
    const disableBtn = modal.querySelector<HTMLElement>(
      '#disable-plugin-updates',
    );
    const overlay = document.querySelector<HTMLElement>('#modal-overlay');

    if (!document.querySelector<HTMLElement>('#shake-style')) {
      const style = document.createElement('style');
      style.id = 'shake-style';
      style.textContent = `
      @keyframes shake {
          0%, 100% { transform: translate(-50%, -50%); }
          10%, 30%, 50%, 70%, 90% { transform: translate(-50%, -50%) translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translate(-50%, -50%) translateX(5px); }
      }
      .shake-animation {
          animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
      }
    `;
      document.head.appendChild(style);
    }

    let pointerStartedOnOverlay = false;
    const shakePointerHandler = (e) => {
      pointerStartedOnOverlay = e.target === overlay;
    };
    const shakeHandler = (e) => {
      const shouldShake = pointerStartedOnOverlay && e.target === overlay;
      pointerStartedOnOverlay = false;
      if (shouldShake) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        modal.classList.remove('shake-animation');
        void modal.offsetWidth;
        modal.classList.add('shake-animation');
      }
    };

    if (overlay) {
      overlay.addEventListener('pointerdown', shakePointerHandler, true);
      overlay.addEventListener('click', shakeHandler, true);
    }

    enableBtn!.addEventListener('click', () => {
      if (onEnable) {
        const keepOverlay = onEnable();

        this.closeModal(modal, {
          skipHideOverlay: keepOverlay,
        });
      } else {
        this.closeModal(modal);
      }
    });

    disableBtn!.addEventListener('click', () => {
      if (onDisable) onDisable();
      this.closeModal(modal);
    });
  };
})();
