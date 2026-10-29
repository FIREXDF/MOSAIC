class StatusBarDownloads {
  manager: Window['statusBarManager'];

  constructor(manager: Window['statusBarManager']) {
    this.manager = manager;
  }

  startDownloadsStatusLoop(cycleId: number) {
    let animationFrame = 0;
    let lastUpdateTime = Date.now();
    const lastReceivedBytes = new Map();

    const renderDownloadStatus = () => {
      if (!this.manager.isStatusCycleCurrent(cycleId)) {
        this.manager.clearUpdateLoop();
        return;
      }

      if (this.manager.hasTemporaryStatus()) {
        this.manager.renderStatus(this.manager.temporaryStatus!, { force: true });
        this.manager.clearUpdateLoop();
        return;
      }

      if (this.manager.preservedStatus && !this.manager.hasDownloadsInProgress()) {
        return;
      }

      if (this.manager.hasModalOpen() && !this.manager.hasDownloadsInProgress()) {
        return;
      }

      try {
        if (window.downloadManager?.switchTransfer) {
          const transfer = window.downloadManager.switchTransfer;
          const dots = '.'.repeat(animationFrame % 4);
          animationFrame += 1;
          const details: string[] = [];
          const progress = Math.max(
            0,
            Math.min(
              100,
              Math.round(
                transfer.progress ||
                  (transfer.totalFiles > 0
                    ? (transfer.transferredCount / transfer.totalFiles) * 100
                    : 0),
              ),
            ),
          );

          const statusContent =
            this.getSwitchTransferStatusContent(transfer);

          if (transfer.totalFiles > 0) {
            details.push(
              `${transfer.transferredCount}/${transfer.totalFiles} files`,
            );
          }

          if (progress > 0) {
            details.push(`${progress}%`);
          }

          if (transfer.currentFileName) {
            const shortFileName =
              transfer.currentFileName.length > 26
                ? `${transfer.currentFileName.substring(0, 23)}...`
                : transfer.currentFileName;
            details.push(shortFileName);
          }

          const detailsSuffix =
            details.length > 0 ? ` • ${details.join(' • ')}` : '';

          this.manager.renderStatus(
            {
              content: `${statusContent}${detailsSuffix}${dots}`,
              downloading: true,
            },
            { force: true },
          );
          return;
        }

        const activeDownloads = Array.from(
          window.downloadManager?.activeDownloads?.values() || [],
        ).filter((download: any) => this.manager.isActiveDownloadState(download));

        if (activeDownloads.length === 0) {
          const statusText = this.manager.getStatusTextElement();
          if (statusText) {
            statusText.classList.remove('status-downloading');
          }

          this.manager.clearUpdateLoop();

          if (this.manager.currentTab === 'downloads') {
            this.manager.applySnapshot(this.manager.tabStatus.getDownloadsIdleSnapshot(), { cycleId });
          } else {
            this.manager.refreshStandardStatus();
          }

          return;
        }

        const firstDownload: any = activeDownloads[0];
        const currentTime = Date.now();
        const timeDelta = (currentTime - lastUpdateTime) / 1000;

        let speedText = '';
        let progressText = '';

        if (
          firstDownload.receivedBytes !== undefined &&
          firstDownload.totalBytes !== undefined &&
          firstDownload.totalBytes > 0
        ) {
          const progress = Math.round(
            (firstDownload.receivedBytes / firstDownload.totalBytes) * 100,
          );
          progressText = `${progress}%`;

          const downloadId = firstDownload.id;
          const lastBytes = lastReceivedBytes.get(downloadId) || 0;
          const bytesDelta = firstDownload.receivedBytes - lastBytes;

          if (timeDelta > 0 && bytesDelta > 0) {
            const speedBytes = bytesDelta / timeDelta;
            speedText = this.formatSpeed(speedBytes);
          }

          lastReceivedBytes.set(downloadId, firstDownload.receivedBytes);
        } else if (firstDownload.progress !== undefined) {
          progressText = `${Math.round(firstDownload.progress)}%`;
        }

        let sizeInfo = '';
        if (
          firstDownload.totalBytes !== undefined &&
          firstDownload.totalBytes > 0
        ) {
          const received = firstDownload.receivedBytes || 0;
          sizeInfo = `${this.formatBytes(received)} / ${this.formatBytes(
            firstDownload.totalBytes,
          )}`;
        }

        const fileName =
          firstDownload.modName ||
          firstDownload.fileName ||
          firstDownload.url?.split('/').pop() ||
          'Downloading...';
        const shortFileName =
          fileName.length > 30 ? `${fileName.substring(0, 27)}...` : fileName;

        const dots = '.'.repeat(animationFrame % 4);
        const activeIndicator =
          activeDownloads.length > 1 ? ` [${activeDownloads.length} active]` : '';

        const progressPart = progressText ? ` \u2022 ${progressText}` : '';
        const sizePart = sizeInfo ? ` \u2022 ${sizeInfo}` : '';
        const speedPart = speedText ? ` \u2022 ${speedText}` : '';

        this.manager.renderStatus(
          {
            content:
              this.manager.t('statusBar.downloadsDownloading', {
                fileName: shortFileName,
                progress: progressPart,
                size: sizePart,
                speed: speedPart,
              }) + dots + activeIndicator,
            downloading: true,
          },
          { force: true },
        );

        lastUpdateTime = currentTime;
        animationFrame += 1;
      } catch (error) {
        const statusText = this.manager.getStatusTextElement();
        if (statusText) {
          statusText.classList.remove('status-downloading');
        }

        this.manager.clearUpdateLoop();

        if (this.manager.currentTab === 'downloads') {
          this.manager.applySnapshot(this.manager.tabStatus.getDownloadsIdleSnapshot(), { cycleId });
        } else {
          this.manager.refreshStandardStatus();
        }
      }
    };

    renderDownloadStatus();

    this.manager.updateInterval = setInterval(() => {
      renderDownloadStatus();
    }, 500);
  }

  completeSwitchTransfer(
    transferredCount = 0,
    transferMethod: 'ftp' | 'drive' | 'mtp' = 'ftp',
  ) {
    this.manager.clearUpdateLoop();
    this.manager.hasActiveDownloads = false;

    const statusText = this.manager.getStatusTextElement();
    if (statusText) {
      statusText.classList.remove('status-downloading');
    }

    const completion =
      transferMethod === 'drive'
        ? {
            label: 'Local drive copy completed',
            plainKey: 'statusBar.driveCompleted',
            filesKey: 'statusBar.driveCompletedWithFiles',
          }
        : transferMethod === 'mtp'
          ? {
              label: 'MTP / USB transfer completed',
              plainKey: 'statusBar.mtpCompleted',
              filesKey: 'statusBar.mtpCompletedWithFiles',
            }
          : {
              label: 'FTP transfer completed',
              plainKey: 'statusBar.ftpCompleted',
              filesKey: 'statusBar.ftpCompletedWithFiles',
            };
    const label =
      transferredCount > 0
        ? `${completion.label} (${transferredCount} files)`
        : completion.label;
    const completedStatus =
      transferredCount > 0
        ? this.manager.t(completion.filesKey, { count: transferredCount })
        : this.manager.t(completion.plainKey);

    this.manager.showTemporaryStatus(completedStatus, { autoRestoreMs: 2600 });

    if (this.manager.isEnhancedStatusBarEnabled()) {
      this.manager.userDismissedExtendedBar = false;
      this.manager.lastExtendedBarData = `switch-complete:${Date.now()}`;
      this.updateExtendedBar({
        type: 'success',
        fileName: label,
      });

      setTimeout(() => {
        const bottomBar = document.getElementById('main-status-bar');
        if (bottomBar?.classList.contains('success-mode')) {
          this.updateExtendedBar({ type: 'none' });
        }
        this.manager.refreshStandardStatus();
      }, 2200);
      return;
    }

    this.updateExtendedBar({ type: 'none' });
    this.manager.refreshStandardStatus();
  }

  _getDownloadDisplayName(dl: DownloadItem): string {
    if (dl.modName) return dl.modName;
    if (dl.statusText && !/downloading|^extracting mod/i.test(dl.statusText)) return dl.statusText;
    const name = dl.fileName || '';
    if (/^\d+$/.test(name) || name === 'mod.zip') return 'Downloading...';
    return name;
  }

  updateExtendedBar(
    update: NoneUpdate | SuccessUpdate | ConflictUpdate | DownloadUpdate,
  ) {
    if (typeof update === 'string' && update === 'none') {
      update = { type: 'none' } as NoneUpdate;
    }

    const bottomBar = document.getElementById('main-status-bar');
    if (!bottomBar) return;

    const content = bottomBar.querySelector('.extended-content');
    const enabled = this.manager.isEnhancedStatusBarEnabled();
    const wasExpanded = bottomBar.classList.contains('expanded');
    const previousMode = this.manager.animations.getIslandMode(bottomBar);

    if (update.type === 'none' || !enabled || !content) {
      if (update.type === 'none') {
        this.manager.userDismissedExtendedBar = true;
        this.manager.islandSwapUpdate = null;
      }

      if (bottomBar.classList.contains('expanded')) {
        this.manager.animations.triggerIslandCollapse(bottomBar);
        const finalizeCollapse = () => {
          bottomBar.classList.remove('expanded');
          bottomBar.classList.remove(
            'download-mode',
            'conflict-mode',
            'success-mode',
          );
          bottomBar.dataset.islandMode = 'idle';

          if (content) {
            delete (content as HTMLElement).dataset.extendedSignature;
            (content as HTMLElement).style.display = 'none';
            (content as HTMLElement).replaceChildren();
          }

          setTimeout(() => this.manager.showPendingConflict(), 0);
        };

        if (content) {
          this.manager.animations.animateExtendedBarExit(
            bottomBar,
            content as HTMLElement,
            finalizeCollapse,
          );
        } else {
          finalizeCollapse();
        }
      } else {
        if (content) {
          delete (content as HTMLElement).dataset.extendedSignature;
          (content as HTMLElement).style.display = 'none';
          (content as HTMLElement).replaceChildren();
        }
        this.manager.showPendingConflict();
      }
      return;
    }

    if (update.type === 'download') {
      if (wasExpanded && previousMode === 'conflict') {
        const isSwapping = this.manager.islandSwapUpdate !== null;
        this.manager.islandSwapUpdate = update;
        if (isSwapping) return;

        this.manager.animations.triggerIslandCollapse(bottomBar);
        this.manager.animations.animateExtendedBarExit(bottomBar, content as HTMLElement, () => {
          bottomBar.classList.remove('expanded', 'conflict-mode');
          bottomBar.dataset.islandMode = 'idle';
          delete (content as HTMLElement).dataset.extendedSignature;
          (content as HTMLElement).style.display = 'none';
          (content as HTMLElement).replaceChildren();

          setTimeout(() => {
            const nextUpdate = this.manager.islandSwapUpdate;
            this.manager.islandSwapUpdate = null;
            if (nextUpdate && this.manager.hasActiveDownloads) {
              this.updateExtendedBar(nextUpdate);
            }
          }, 0);
        });
        return;
      }

      delete (content as HTMLElement).dataset.extendedSignature;

      if (!bottomBar.classList.contains('download-mode')) {
        bottomBar.classList.remove('conflict-mode', 'success-mode');
        bottomBar.classList.add('download-mode');
      }

      if (this.manager.pendingDynamicIsland) {
        return;
      }

      if (!bottomBar.classList.contains('expanded')) {
        bottomBar.classList.add('expanded');
      }

      const shouldAnimateEntrance = !wasExpanded || previousMode !== 'download';

      if (shouldAnimateEntrance) {
        this.manager.animations.triggerIslandPulse(bottomBar, 'download');
      }

      (content as HTMLElement).style.display = 'flex';

      const downloads = update.downloads || [];
      const isSingle = downloads.length === 1;

      if (isSingle) {
        const dl = downloads[0];
        const progress = Math.round(dl.progress || 0);
        let speed = dl.speedText || '';
        const displayName = this._getDownloadDisplayName(dl);

        let phaseText = dl.phaseLabel || 'Downloading';
        let iconClass = dl.iconClass || 'bi-cloud-arrow-down-fill';
        let isExtractingOrVerifying = false;

        if (!dl.phaseLabel && dl.statusText) {
          const lowerStatus = dl.statusText.toLowerCase();
          if (lowerStatus.includes('extract')) {
            phaseText = 'Extracting...';
            iconClass = 'bi-file-zip-fill';
            isExtractingOrVerifying = true;
          } else if (lowerStatus.includes('verif')) {
            phaseText = 'Verifying...';
            iconClass = 'bi-shield-check';
            isExtractingOrVerifying = true;
          }
        }

        if (isExtractingOrVerifying) {
          speed = '';
        }

        const percentText =
          isExtractingOrVerifying && progress <= 0 ? phaseText : `${progress}%`;

        const isActiveDownloadCard = content.querySelector('.ext-download-card .ext-progress-container');
        const isMultiCard = content.querySelector('.ext-multi-download-card');
        const canPatchExistingCard =
          wasExpanded &&
          previousMode === 'download' &&
          isActiveDownloadCard &&
          !isMultiCard;

        if (canPatchExistingCard) {
            const fileNameEl = content.querySelector('.ext-filename');
            const progressFillEl = content.querySelector('.ext-progress-fill') as HTMLElement;
            const percentageEl = content.querySelector('.ext-percentage');
            const speedEl = content.querySelector('.ext-speed');
            const badgeEl = content.querySelector('.ext-status-badge');
            const iconEl = content.querySelector('.ext-card-icon i');
            const metaEl = content.querySelector('.ext-download-meta') as HTMLElement;
            const phaseEl = content.querySelector('.ext-download-phase');
            const separatorEl = content.querySelector('.ext-separator');
            const glareEl = content.querySelector('.ext-progress-glare');

            if (fileNameEl) {
                fileNameEl.setAttribute('title', displayName);
                this.manager.animations.animateElementTextChange(
                  fileNameEl as HTMLElement,
                  displayName,
                  'ext-text-swap',
                  280,
                );
            }
            this.manager.animations.animateProgressFill(progressFillEl, progress);

            if (badgeEl) {
                this.manager.animations.animateElementTextChange(badgeEl as HTMLElement, phaseText);
            }
            if (iconEl && iconEl.className !== `bi ${iconClass}`) {
                iconEl.className = `bi ${iconClass}`;
            }

            if (isExtractingOrVerifying) {
              if (percentageEl) {
                this.manager.animations.animateElementTextChange(
                  percentageEl as HTMLElement,
                  percentText,
                  'ext-text-swap',
                  280,
                );
              }
              if (speedEl) {
                this.manager.animations.animateElementTextChange(
                  speedEl as HTMLElement,
                  '',
                  'ext-text-swap',
                  280,
                );
              }
            } else {
              if (percentageEl) {
                this.manager.animations.animateElementTextChange(
                  percentageEl as HTMLElement,
                  `${progress}%`,
                  'ext-text-swap',
                  280,
                );
              }
              if (speedEl) {
                this.manager.animations.animateElementTextChange(
                  speedEl as HTMLElement,
                  speed,
                  'ext-text-swap',
                  280,
                );
              }
            }

            if (metaEl) {
              metaEl.style.display = speed ? 'flex' : 'none';
            }

            phaseEl?.remove();
            separatorEl?.remove();
            glareEl?.remove();
        } else {
            this.manager.animations.renderDownloadCardWithFlip(content as HTMLElement, () => {
              content.innerHTML = `
              <div class="ext-download-card" data-flip-id="download-shell">
                  <button class="ext-close-btn" data-flip-id="download-close" onclick="window.statusBarManager.downloads.updateExtendedBar('none')" title="Close">
                      <i class="bi bi-chevron-down"></i>
                  </button>
                  <div class="ext-card-icon-container" data-flip-id="download-icon">
                      <div class="ext-card-icon">
                          <i class="bi ${iconClass}"></i>
                      </div>
                  </div>
                  <div class="ext-card-details" data-flip-id="download-details">
                      <div class="ext-download-topline" data-flip-id="download-topline">
                          <span class="ext-status-badge" data-flip-id="download-badge">${phaseText}</span>
                      </div>
                      <div class="ext-card-header ext-download-header" data-flip-id="download-header">
                          <span class="ext-filename" data-flip-id="${this.manager.animations.getDownloadNameFlipKey(dl.id)}" title="${displayName}">${displayName}</span>
                      </div>

                      <div class="ext-progress-row" data-flip-id="download-body">
                          <div class="ext-progress-container" data-flip-id="${this.manager.animations.getDownloadProgressFlipKey(dl.id)}">
                              <div class="ext-progress-track">
                                  <div class="ext-progress-fill" style="width: ${progress}%"></div>
                              </div>
                          </div>
                          <span class="ext-percentage">${percentText}</span>
                      </div>
                      
                      <div class="ext-card-meta ext-download-meta">
                          <span class="ext-speed">${speed}</span>
                          <span class="ext-separator" style="display: ${isExtractingOrVerifying ? 'none' : 'inline'}">•</span>
                          <span class="ext-download-phase">${phaseText}</span>
                      </div>
                  </div>
              </div>
            `;

              const metaEl = content.querySelector('.ext-download-meta') as HTMLElement | null;
              const phaseEl = content.querySelector('.ext-download-phase');
              const separatorEl = content.querySelector('.ext-separator');

              if (metaEl) {
                metaEl.style.display = speed ? 'flex' : 'none';
              }

              phaseEl?.remove();
              separatorEl?.remove();
            });
        }
      } else {
        const existingItems = content.querySelectorAll('.ext-multi-dl-item');
        const existingIds = new Set<string>();
        existingItems.forEach((el) => {
          const id = (el as HTMLElement).dataset.dlId;
          if (id) existingIds.add(id);
        });

        const currentIds = new Set(downloads.map(d => d.id));
        let needsFullRebuild = !content.querySelector('.ext-multi-download-card');

        if (!needsFullRebuild) {
          for (const id of existingIds) {
            if (!currentIds.has(id)) { needsFullRebuild = true; break; }
          }
          for (const id of currentIds) {
            if (!existingIds.has(id)) { needsFullRebuild = true; break; }
          }
        }

        if (needsFullRebuild) {
          if (
            content.querySelector('.ext-multi-download-card') &&
            this.manager.animations.animateMultiDownloadListChanges(content as HTMLElement, downloads)
          ) {
            // The list update is animated internally without rebuilding the panel.
          } else {
            const itemsHtml = downloads.map((dl) => {
              const { progress, displayName, pctText } =
                this.manager.animations.getMultiDownloadViewData(dl);

              return `
                <div class="ext-multi-dl-item" data-dl-id="${dl.id}" data-flip-id="${this.manager.animations.getDownloadFlipKey(dl.id)}">
                  <div class="ext-multi-dl-info">
                    <span class="ext-multi-dl-name" data-flip-id="${this.manager.animations.getDownloadNameFlipKey(dl.id)}" title="${displayName}">${displayName}</span>
                    <span class="ext-multi-dl-pct" data-flip-id="${this.manager.animations.getDownloadFlipKey(dl.id)}-pct">${pctText}</span>
                  </div>
                  <div class="ext-multi-dl-bar" data-flip-id="${this.manager.animations.getDownloadProgressFlipKey(dl.id)}">
                    <div class="ext-multi-dl-fill" style="width: ${progress}%"></div>
                  </div>
                </div>`;
            }).join('');

            this.manager.animations.renderDownloadCardWithFlip(content as HTMLElement, () => {
            content.innerHTML = `
            <div class="ext-multi-download-card ext-download-card" data-flip-id="download-shell">
                <button class="ext-close-btn" data-flip-id="download-close" onclick="window.statusBarManager.downloads.updateExtendedBar('none')" title="Close">
                    <i class="bi bi-chevron-down"></i>
                </button>
                <div class="ext-card-icon-container" data-flip-id="download-icon">
                    <div class="ext-card-icon">
                        <i class="bi bi-cloud-arrow-down-fill"></i>
                    </div>
                </div>
                <div class="ext-card-details" data-flip-id="download-details">
                    <div class="ext-download-topline" data-flip-id="download-topline">
                        <span class="ext-status-badge" data-flip-id="download-badge">${downloads.length} Downloads</span>
                    </div>
                    <div class="ext-card-header ext-download-header" data-flip-id="download-header">
                        <span class="ext-download-title" data-flip-id="download-title">Multiple active downloads</span>
                    </div>
                    <div class="ext-multi-dl-list" data-flip-id="download-body">
                      ${itemsHtml}
                    </div>
                </div>
            </div>
          `;
            });
          }
        } else {
          downloads.forEach((dl) => {
            const itemEl = content.querySelector(`.ext-multi-dl-item[data-dl-id="${dl.id}"]`);
            if (!itemEl) return;
            const progress = Math.round(dl.progress || 0);
            const displayName = this._getDownloadDisplayName(dl);
            let pctText = `${progress}%`;
            
            if (dl.statusText) {
              const lowerStatus = dl.statusText.toLowerCase();
              if (lowerStatus.includes('extract')) pctText = 'Extracting...';
              else if (lowerStatus.includes('verif')) pctText = 'Verifying...';
            }

            const nameEl = itemEl.querySelector('.ext-multi-dl-name');
            const pctEl = itemEl.querySelector('.ext-multi-dl-pct');
            const fillEl = itemEl.querySelector('.ext-multi-dl-fill') as HTMLElement;
            if (nameEl) {
              (nameEl as HTMLElement).title = displayName;
              this.manager.animations.animateElementTextChange(
                nameEl as HTMLElement,
                displayName,
                'ext-text-swap',
                280,
              );
            }
            if (pctEl) {
              this.manager.animations.animateElementTextChange(
                pctEl as HTMLElement,
                pctText,
                'ext-text-swap',
                280,
              );
            }
            this.manager.animations.animateProgressFill(fillEl, progress);
          });

          const badgeEl = content.querySelector('.ext-status-badge');
          if (badgeEl) {
            this.manager.animations.animateElementTextChange(
              badgeEl as HTMLElement,
              `${downloads.length} Downloads`,
            );
          }
        }
      }

      if (shouldAnimateEntrance) {
        this.manager.animations.animateExtendedBarEntrance(bottomBar, content as HTMLElement);
      }
    } else if (update.type === 'success') {
      delete (content as HTMLElement).dataset.extendedSignature;

      if (!bottomBar.classList.contains('success-mode')) {
        bottomBar.classList.remove('download-mode', 'conflict-mode');
        bottomBar.classList.add('success-mode');
      }

      if (!bottomBar.classList.contains('expanded')) {
        bottomBar.classList.add('expanded');
      }

      const shouldAnimateEntrance = !wasExpanded || previousMode !== 'success';

      if (shouldAnimateEntrance) {
        this.manager.animations.triggerIslandPulse(bottomBar, 'success');
      }

      (content as HTMLElement).style.display = 'flex';

      content.innerHTML = `
            <div class="ext-download-card">
                <button class="ext-close-btn" onclick="window.statusBarManager.downloads.updateExtendedBar('none')" title="Close">
                    <i class="bi bi-chevron-down"></i>
                </button>
                <div class="ext-card-icon-container icon-success">
                    <div class="ext-card-icon">
                        <i class="bi bi-check-circle-fill"></i>
                    </div>
                </div>
                <div class="ext-card-details">
                    <div class="ext-card-header">
                        <span class="ext-status-badge badge-success">Completed</span>
                        <span class="ext-filename" title="${update.fileName}">${update.fileName || 'Unknown file'}</span>
                    </div>

                    <div class="ext-card-meta">
                        <span class="ext-success-message">Download finished</span>
                    </div>
                </div>
            </div>
        `;

      if (shouldAnimateEntrance) {
        this.manager.animations.animateExtendedBarEntrance(bottomBar, content as HTMLElement);
      }
    } else if (update.type === 'conflict') {
      if (
        this.manager.hasActiveDownloads ||
        (wasExpanded && previousMode === 'success')
      ) {
        this.manager.pendingConflictUpdate = update;
        return;
      }

      const contentEl = content as HTMLElement;
      const conflictSignature = `conflict:${update.conflictCount}:${update.modsWithConflictsCount}`;

      if (!bottomBar.classList.contains('conflict-mode')) {
        bottomBar.classList.remove('download-mode', 'success-mode');
        bottomBar.classList.add('conflict-mode');
      }

      if (!bottomBar.classList.contains('expanded')) {
        bottomBar.classList.add('expanded');
      }

      const shouldAnimateEntrance = !wasExpanded || previousMode !== 'conflict';

      if (shouldAnimateEntrance) {
        this.manager.animations.triggerIslandPulse(bottomBar, 'conflict');
      }

      contentEl.style.display = 'flex';

      if (contentEl.dataset.extendedSignature !== conflictSignature) {
        content.innerHTML = `  
          <div class="ext-conflict-card">
              <button class="ext-close-btn" onclick="window.statusBarManager.downloads.updateExtendedBar('none')" title="Close">
                  <i class="bi bi-chevron-down"></i>
              </button>
              <div class="ext-card-icon-container icon-warning">
                  <div class="ext-card-icon">
                      <i class="bi bi-exclamation-triangle-fill"></i>
                  </div>
              </div>
              <div class="ext-card-details">
                  <div class="ext-card-header">
                       <span class="ext-status-badge badge-warning">Conflicts Detected</span>
                  </div>
                  <div class="ext-conflict-message">
                      ${update.modsWithConflictsCount} mod${update.modsWithConflictsCount !== 1 ? 's' : ''} have ${update.conflictCount} conflicting files.
                  </div>
                  <button class="ext-action-btn" onclick="window.conflictModalManager.showConflictModal()">
                      Resolve Now
                  </button>
              </div>
          </div>
        `;
        contentEl.dataset.extendedSignature = conflictSignature;
      }

      if (shouldAnimateEntrance) {
        this.manager.animations.animateExtendedBarEntrance(bottomBar, contentEl);
      }
    }
  }

  getSwitchTransferStatusContent(transfer: {
    transferMethod?: string;
    currentMod?: number;
    totalMods?: number;
  }) {
    if (transfer.transferMethod === 'drive') {
      if ((transfer.totalMods || 0) > 0) {
        return this.manager.t('statusBar.driveCopying', {
          current: transfer.currentMod || 0,
          total: transfer.totalMods || 0,
        });
      }
      return this.manager.t('statusBar.driveCopyingSimple');
    }

    if (transfer.transferMethod === 'mtp') {
      if ((transfer.totalMods || 0) > 0) {
        return this.manager.t('statusBar.mtpSending', {
          current: transfer.currentMod || 0,
          total: transfer.totalMods || 0,
        });
      }
      return this.manager.t('statusBar.mtpSendingSimple');
    }

    if ((transfer.totalMods || 0) > 0) {
      return this.manager.t('statusBar.ftpSending', {
        current: transfer.currentMod || 0,
        total: transfer.totalMods || 0,
      });
    }

    return this.manager.t('statusBar.ftpSending', {
      current: '',
      total: '',
    }).replace(` \u2022 / mods`, '');
  }

  checkActiveDownloads() {
    try {
      if (!window.downloadManager) return false;

      if (window.downloadManager.switchTransfer) {
        const transfer = window.downloadManager.switchTransfer;
        const progress = Math.max(
          0,
          Math.min(
            100,
            Math.round(
              transfer.progress ||
                (transfer.totalFiles > 0
                  ? (transfer.transferredCount / transfer.totalFiles) * 100
                  : 0),
            ),
          ),
        );
        const currentMod = transfer.currentMod || 0;
        const totalMods = transfer.totalMods || 0;
        const transferKey = `switch:${transfer.transferMethod}:${transfer.id}`;

        this.manager.hasActiveDownloads = true;

        if (this.manager.lastExtendedBarData !== transferKey) {
          this.manager.userDismissedExtendedBar = false;
          this.manager.lastExtendedBarData = transferKey;
        }

        if (!this.manager.userDismissedExtendedBar) {
          const isDriveTransfer = transfer.transferMethod === 'drive';
          const isMtpTransfer = transfer.transferMethod === 'mtp';
          const fallbackLabel = isDriveTransfer
            ? this.manager.t('statusBar.copyingToLocalDrive')
            : isMtpTransfer
              ? this.manager.t('statusBar.transferringOverMtp')
              : 'Sending to Switch';
          const metaParts: string[] = [];
          if (totalMods > 0) {
            metaParts.push(`Mod ${currentMod}/${totalMods}`);
          }
          if (transfer.totalFiles > 0) {
            metaParts.push(
              `${transfer.transferredCount}/${transfer.totalFiles} files`,
            );
          }

          this.updateExtendedBar({
            type: 'download',
            downloads: [
              {
                id: transfer.id,
                fileName:
                  transfer.currentFileName ||
                  transfer.currentModName ||
                  fallbackLabel,
                progress,
                speedText: metaParts.join(' • '),
                phaseLabel: fallbackLabel,
                iconClass: isDriveTransfer
                  ? 'bi-device-hdd'
                  : isMtpTransfer
                    ? 'bi-usb-drive'
                    : 'bi-cloud-arrow-up-fill',
              },
            ],
          });
        }

        return true;
      }

      const activeDownloadsMap = (window.downloadManager)
        .activeDownloads;

      if (!activeDownloadsMap) {
        return false;
      }

      const downloads = Array.from(activeDownloadsMap.values());
      const activeDownloads = downloads.filter(
        (d: any) => d.status === 'downloading' || d.status === 'extracting',
      );

      if (activeDownloads.length > 0) {
        const active: any = activeDownloads[0];
        this.manager.hasActiveDownloads = true;

        const downloadIds = activeDownloads
          .map((d: any) => d.id || d.fileName)
          .sort()
          .join(',');
        const dataKey = `download:${downloadIds}`;

        if (this.manager.lastExtendedBarData !== dataKey) {
          this.manager.userDismissedExtendedBar = false;
          this.manager.lastExtendedBarData = dataKey;
        }

        if (!this.manager.userDismissedExtendedBar) {
          const dlItems: DownloadItem[] = activeDownloads.map((d: any) => ({
            id: d.id,
            fileName: d.fileName,
            modName: d.modName,
            statusText: d.statusText,
            progress: d.progress || 0,
            speedText: d.speedText || '',
          }));
          this.updateExtendedBar({ type: 'download', downloads: dlItems });
        }

        if (this.manager.currentTab !== 'downloads') {
          const dlName =
            active.modName ||
            active.fileName ||
            active.url?.split('/').pop() ||
            'Downloading...';
          const shortName =
            dlName.length > 30 ? `${dlName.substring(0, 27)}...` : dlName;

          let prog = '';
          if (active.statusText) {
            const lowerStatus = active.statusText.toLowerCase();
            if (lowerStatus.includes('extract')) prog = ' • Extracting...';
            else if (lowerStatus.includes('verif')) prog = ' • Verifying...';
          }
          if (!prog && active.progress !== undefined) {
            prog = ` • ${Math.round(active.progress)}%`;
          }

          this.manager.renderStatus(
            {
              content: this.manager.t('statusBar.downloadsDownloading', {
                fileName: shortName,
                progress: prog,
                size: '',
                speed: '',
              }),
              downloading: true,
            },
            { force: !this.manager.hasTemporaryStatus() },
          );
        }
        return true;
      } else {
        const wasActive = this.manager.hasActiveDownloads;
        this.manager.hasActiveDownloads = false;

        const statusText = this.manager.getStatusTextElement();
        if (statusText) {
          statusText.classList.remove('status-downloading');
        }

        if (wasActive) {
          const completed =
            (window.downloadManager).completedDownloads || [];
          if (completed.length > 0) {
            const last = completed[0];
            if (Date.now() - (last.endTime || 0) < 5000 && this.manager.lastHandledSuccessId !== last.id) {
              this.manager.lastHandledSuccessId = last.id; // Mark this download as handled for success UI
              this.manager.userDismissedExtendedBar = false; // Always show success
              this.updateExtendedBar({
                type: 'success',
                fileName: last.modName || last.fileName,
              });

              this.manager.refreshStandardStatus(); // Update the background text instantly

              setTimeout(() => {
                const bottomBar = document.getElementById('main-status-bar');
                if (bottomBar && bottomBar.classList.contains('success-mode')) {
                  this.updateExtendedBar({ type: 'none' });
                }
              }, 2000);

              return false;
            }
          }
        }

        if (!wasActive) {
          if (window.modManager && window.modManager.conflictGroups) {
            const conflicts = window.modManager.conflictGroups;

            const modsWithConflicts = conflicts.reduce<Set<string>>(
              (mods, nextConflict) => {
                return new Set([
                  ...Array.from(mods),
                  ...nextConflict.conflicts.flatMap((conflict) =>
                    conflict.mods.map((mod) => mod.name),
                  ),
                ]);
              },
              new Set(),
            );

            const conflictCount = conflicts.length;

            if (conflictCount > 0) {
              const dataKey = `conflict:${conflictCount}`;
              if (this.manager.lastExtendedBarData !== dataKey) {
                this.manager.userDismissedExtendedBar = false;
                this.manager.lastExtendedBarData = dataKey;
              }

              if (!this.manager.userDismissedExtendedBar) {
                this.updateExtendedBar({
                  type: 'conflict',
                  conflictCount,
                  modsWithConflictsCount: modsWithConflicts.size,
                });
              }
              return false;
            } else {
              if (this.manager.lastExtendedBarData?.startsWith('conflict:')) {
                this.manager.lastExtendedBarData = null;
                this.manager.userDismissedExtendedBar = false;
              }
            }
          }
        }

        if (wasActive) {
          this.updateExtendedBar({ type: 'none' });
          this.manager.refreshStandardStatus();
        } else {
          const bottomBar = document.getElementById('main-status-bar');
          if (
            bottomBar &&
            bottomBar.classList.contains('expanded') &&
            !bottomBar.classList.contains('conflict-mode') &&
            !bottomBar.classList.contains('success-mode')
          ) {
            this.updateExtendedBar({ type: 'none' });
          }
        }

        return false;
      }
    } catch (e) {
      return false;
    }
  }

  updateDownloadsStatus(statusText) {
    const cycleId = this.manager.beginStatusCycle();
    this.startDownloadsStatusLoop(cycleId);
    return;

    let animationFrame = 0;
    let lastUpdateTime = Date.now();
    let lastReceivedBytes = new Map();

    const updateStatus = () => {
      if (this.manager.preservedStatus && !this.checkActiveDownloads()) {
        return;
      }

      if (this.manager.hasModalOpen() && !this.checkActiveDownloads()) {
        return;
      }

      try {
        if (window.downloadManager && window.downloadManager.switchTransfer) {
          const transfer = window.downloadManager.switchTransfer;
          const dots = '.'.repeat(animationFrame % 4);
          animationFrame++;

          let statusContent =
            this.getSwitchTransferStatusContent(transfer);
          statusContent += dots;

          if (this.manager.setStatusText(statusContent, true)) {
            const statusText =
              document.querySelector<HTMLElement>('.bottom-text-left') ||
              document.querySelector<HTMLElement>('.bottom-text');
            if (
              statusText &&
              !statusText.classList.contains('status-downloading')
            ) {
              statusText.classList.add('status-downloading');
            }
          }

          setTimeout(() => updateStatus(), 200);
          return;
        }

        if (window.downloadManager && window.downloadManager.activeDownloads) {
          const activeDownloads = Array.from(
            window.downloadManager.activeDownloads.values(),
          );
          const activeCount = activeDownloads.length;
          const completedCount = window.downloadManager.completedDownloads
            ? window.downloadManager.completedDownloads.length
            : 0;

          if (activeCount > 0) {
            const firstDownload = activeDownloads[0];
            const currentTime = Date.now();
            const timeDelta = (currentTime - lastUpdateTime) / 1000;

            let speedText = '';
            let progressText = '';

            if (
              firstDownload.receivedBytes !== undefined &&
              firstDownload.totalBytes !== undefined &&
              firstDownload.totalBytes > 0
            ) {
              const progress = Math.round(
                (firstDownload.receivedBytes / firstDownload.totalBytes) * 100,
              );
              progressText = `${progress}%`;

              const downloadId = firstDownload.id;
              const lastBytes = lastReceivedBytes.get(downloadId) || 0;
              const bytesDelta = firstDownload.receivedBytes - lastBytes;

              if (timeDelta > 0 && bytesDelta > 0) {
                const speedBytes = bytesDelta / timeDelta;
                speedText = this.formatSpeed(speedBytes);
              }

              lastReceivedBytes.set(downloadId, firstDownload.receivedBytes);
            } else if (firstDownload.progress !== undefined) {
              progressText = `${Math.round(firstDownload.progress)}%`;
            }

            let sizeInfo = '';
            if (
              firstDownload.totalBytes !== undefined &&
              firstDownload.totalBytes > 0
            ) {
              const received = firstDownload.receivedBytes || 0;
              sizeInfo = `${this.formatBytes(received)} / ${this.formatBytes(
                firstDownload.totalBytes,
              )}`;
            }

            const fileName =
              firstDownload.modName ||
              firstDownload.fileName ||
              firstDownload.url?.split('/').pop() ||
              'Downloading...';
            const shortFileName =
              fileName.length > 30
                ? fileName.substring(0, 27) + '...'
                : fileName;

            const dots = '.'.repeat(animationFrame % 4);
            const animIndicator =
              activeCount > 1 ? ` [${activeCount} active]` : '';

            let progressPart = progressText ? ` • ${progressText}` : '';
            let sizePart = sizeInfo ? ` • ${sizeInfo}` : '';
            let speedPart = speedText ? ` • ${speedText}` : '';

            let statusContent = this.manager.t('statusBar.downloadsDownloading', {
              fileName: shortFileName,
              progress: progressPart,
              size: sizePart,
              speed: speedPart,
            });
            statusContent += dots;
            if (animIndicator) statusContent += animIndicator;

            if (this.manager.setStatusText(statusContent, true)) {
              const statusText =
                document.querySelector<HTMLElement>('.bottom-text-left') ||
                document.querySelector<HTMLElement>('.bottom-text');
              if (
                statusText &&
                !statusText.classList.contains('status-downloading')
              ) {
                statusText.classList.add('status-downloading');
              }
            }

            lastUpdateTime = currentTime;
            animationFrame++;
          } else {
            if (statusText.classList.contains('status-downloading')) {
              statusText.classList.remove('status-downloading');

              statusText.offsetHeight;
            }

            if (this.manager.updateInterval) {
              clearInterval(this.manager.updateInterval);
              this.manager.updateInterval = null;
            }

            if (this.manager.currentTab !== 'downloads') {
              if (!this.manager.hasModalOpen() && !this.manager.preservedStatus) {
                this.manager.updateStatus(this.manager.currentTab);
              }
              return;
            }

            if (!this.manager.hasModalOpen() && !this.manager.preservedStatus) {
              if (completedCount > 0) {
                this.manager.setStatusText(
                  this.manager.t('statusBar.downloadsCompleted', {
                    count: completedCount,
                    plural: completedCount !== 1 ? 's' : '',
                  }),
                );
              } else {
                this.manager.setStatusText(this.manager.t('statusBar.downloadsNoActive'));
              }
            }
          }
        } else {
          if (statusText.classList.contains('status-downloading')) {
            statusText.classList.remove('status-downloading');

            statusText.offsetHeight;
          }

          if (this.manager.updateInterval) {
            clearInterval(this.manager.updateInterval);
            this.manager.updateInterval = null;
          }

          if (this.manager.currentTab !== 'downloads') {
            if (!this.manager.hasModalOpen() && !this.manager.preservedStatus) {
              this.manager.updateStatus(this.manager.currentTab);
            }
            return;
          }

          if (!this.manager.hasModalOpen() && !this.manager.preservedStatus) {
            this.manager.setStatusText(this.manager.t('statusBar.downloadsReady'));
          }
        }
      } catch (error) {
        console.error('Status bar error:', error);
        statusText.classList.remove('status-downloading');

        if (this.manager.currentTab !== 'downloads') {
          if (!this.manager.hasModalOpen() && !this.manager.preservedStatus) {
            this.manager.updateStatus(this.manager.currentTab);
          }
          return;
        }

        if (!this.manager.hasModalOpen() && !this.manager.preservedStatus) {
          this.manager.setStatusText('Downloads • Ready');
        }
      }
    };

    updateStatus();

    this.manager.updateInterval = setInterval(() => {
      const hasActiveDownloads = this.checkActiveDownloads();
      if (hasActiveDownloads) {
        // Only update status if there is no active Switch transfer loop.
        if (!window.downloadManager || !window.downloadManager.switchTransfer) {
          updateStatus();
        }
      } else {
        if (this.manager.updateInterval) {
          clearInterval(this.manager.updateInterval);
          this.manager.updateInterval = null;
        }

        if (statusText.classList.contains('status-downloading')) {
          statusText.classList.remove('status-downloading');
          statusText.offsetHeight;
        }

        if (this.manager.currentTab && this.manager.currentTab !== 'downloads') {
          this.manager.updateStatus(this.manager.currentTab);
        } else if (this.manager.currentTab === 'downloads') {
          const completedCount =
            window.downloadManager?.completedDownloads?.length || 0;
          if (completedCount > 0) {
            this.manager.setStatusText(
              this.manager.t('statusBar.downloadsCompleted', {
                count: completedCount,
                plural: completedCount !== 1 ? 's' : '',
              }),
            );
          } else {
            this.manager.setStatusText(this.manager.t('statusBar.downloadsNoActive'));
          }
        }
      }
    }, 500);
  }

  formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  formatSpeed(bytesPerSecond) {
    if (!bytesPerSecond || bytesPerSecond === 0) return '';
    return this.formatBytes(bytesPerSecond) + '/s';
  }
}
