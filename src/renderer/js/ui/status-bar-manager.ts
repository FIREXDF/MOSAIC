export class StatusBarManager {
  updateInterval: ReturnType<typeof setTimeout> | null;
  currentTab: StatusTab | null;
  preservedStatus: string | null;
  animationTimeout: ReturnType<typeof setTimeout> | null;
  hasActiveDownloads: boolean = false;
  animationCounter: number = 0;
  userDismissedExtendedBar: boolean = false;
  lastExtendedBarData: string | null = null;
  pendingDynamicIsland: boolean = false;
  lastHandledSuccessId: string | null = null;
  pendingConflictUpdate: ConflictUpdate | null = null;
  islandSwapUpdate: DownloadUpdate | null = null;
  statusCycleId: number = 0;
  renderedStatusSignature: string | null = null;
  temporaryStatus: StatusSnapshot | null = null;
  temporaryStatusTimeout: ReturnType<typeof setTimeout> | null = null;
  islandPulseTimeout: ReturnType<typeof setTimeout> | null = null;
  islandSettleTimeout: ReturnType<typeof setTimeout> | null = null;
  islandGsapTimeline: any = null;
  transientElementTimers = new WeakMap<
    HTMLElement,
    ReturnType<typeof setTimeout>
  >();
  animations: StatusBarAnimations;
  tabStatus: StatusBarTabStatus;
  downloads: StatusBarDownloads;

  constructor() {
    this.animations = new StatusBarAnimations(this);
    this.tabStatus = new StatusBarTabStatus(this);
    this.downloads = new StatusBarDownloads(this);
    this.updateInterval = null;
    this.currentTab = null;
    this.preservedStatus = null;
    this.animationTimeout = null;
    this.userDismissedExtendedBar = false;
    this.lastExtendedBarData = null;
    this.claimManagedStatusNode();
    this.setupCollapsedStatusClickHandler();

    setInterval(() => {
      this.downloads.checkActiveDownloads();
    }, 500);
  }

  t(key, params = {}) {
    if (window.i18n && window.i18n.t) {
      return window.i18n.t(key, params);
    }
    return key;
  }

  claimManagedStatusNode() {
    const statusText = this.getStatusTextElement();
    if (!statusText) {
      return;
    }

    if (statusText.dataset.statusBarManaged !== 'true') {
      statusText.dataset.statusBarManaged = 'true';
      statusText.removeAttribute('data-i18n');
    }
  }

  getStatusTextElement() {
    const statusText =
      document.querySelector<HTMLElement>('#main-status-bar .bottom-text-left') ||
      document.querySelector<HTMLElement>('.bottom-text-left') ||
      document.querySelector<HTMLElement>('.bottom-text');

    if (statusText && statusText.dataset.statusBarManaged !== 'true') {
      statusText.dataset.statusBarManaged = 'true';
      statusText.removeAttribute('data-i18n');
    }

    return statusText;
  }

  isEnhancedStatusBarEnabled() {
    return window.settingsManager?.settings.enhancedStatusBar !== false;
  }

  setupCollapsedStatusClickHandler() {
    const bottomBar = document.getElementById('main-status-bar');
    if (!bottomBar || bottomBar.dataset.collapsedClickAttached === 'true') {
      return;
    }

    bottomBar.addEventListener('click', (event) => {
      if (!this.isEnhancedStatusBarEnabled()) {
        return;
      }

      if (bottomBar.classList.contains('expanded')) {
        return;
      }

      const target = event.target as HTMLElement;
      if (!target.closest('.bottom-text-left')) {
        return;
      }

      if (!this.hasDownloadsInProgress()) {
        return;
      }

      this.userDismissedExtendedBar = false;
      this.downloads.checkActiveDownloads();
    });

    bottomBar.dataset.collapsedClickAttached = 'true';
  }

  clearUpdateLoop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  beginStatusCycle() {
    this.clearUpdateLoop();
    this.statusCycleId += 1;
    return this.statusCycleId;
  }

  isStatusCycleCurrent(cycleId: number) {
    return cycleId === this.statusCycleId;
  }

  hasTemporaryStatus() {
    return this.temporaryStatus !== null;
  }

  isActiveDownloadState(download: any) {
    return (
      download?.status === 'downloading' || download?.status === 'extracting'
    );
  }

  hasDownloadsInProgress() {
    if (!window.downloadManager) {
      return false;
    }

    if (window.downloadManager.switchTransfer) {
      return true;
    }

    const activeDownloadsMap = (window.downloadManager).activeDownloads;
    if (!activeDownloadsMap) {
      return false;
    }

    return Array.from(activeDownloadsMap.values()).some((download: any) =>
      this.isActiveDownloadState(download),
    );
  }

  normalizeTab(tabName: string | null | undefined): StatusTab | null {
    const validTabs: StatusTab[] = [
      'downloads',
      'marketplace',
      'tools',
      'plugins',
      'settings',
      'characters',
      'fightplanner',
    ];

    if (!tabName) {
      return null;
    }

    return validTabs.includes(tabName as StatusTab)
      ? (tabName as StatusTab)
      : null;
  }

  syncCurrentTabFromSidebar() {
    const activeButton = document.querySelector<HTMLElement>('.sidebar-btn.active');
    const tabId = activeButton?.getAttribute('data-tab');
    const normalizedTab = this.normalizeTab(tabId);
    if (normalizedTab) {
      this.currentTab = normalizedTab;
    }
  }

  isCustomStatusPayload(tabName: string) {
    return (
      tabName.startsWith('statusBar.') ||
      tabName.includes('...') ||
      tabName.includes('\u2026')
    );
  }

  resolveCustomStatusPayload(tabName: string): StatusSnapshot {
    return {
      content: tabName.startsWith('statusBar.') ? this.t(tabName) : tabName,
    };
  }

  buildStatusSignature(snapshot: StatusSnapshot) {
    return [
      snapshot.useInnerHTML ? 'html' : 'text',
      snapshot.downloading ? 'downloading' : 'idle',
      snapshot.content,
    ].join('|');
  }

  normalizeStatusContent(content: string) {
    if (!content) {
      return content;
    }

    let normalized = content;

    if (/(?:Ã.|Â|â€¢|â€¦|â€)/.test(normalized)) {
      try {
        const bytes = new Uint8Array(
          Array.from(normalized, (char) => char.charCodeAt(0) & 0xff),
        );
        const decoded = new TextDecoder('utf-8').decode(bytes);
        if (!decoded.includes('\uFFFD')) {
          normalized = decoded;
        }
      } catch (error) {
        // Fall back to explicit replacements below.
      }
    }

    return normalized
      .replace(/Ã¢â‚¬Â¢|â€¢/g, '\u2022')
      .replace(/Ã¢â‚¬Â¦|â€¦/g, '\u2026')
      .replace(/Ã©/g, 'é')
      .replace(/Ã¨/g, 'è')
      .replace(/Ãª/g, 'ê')
      .replace(/Ã /g, 'à')
      .replace(/Ã§/g, 'ç')
      .replace(/Ã»/g, 'û')
      .replace(/Ã´/g, 'ô')
      .replace(/Ã®/g, 'î')
      .replace(/Â/g, '');
  }

  renderStatus(
    snapshot: StatusSnapshot,
    options: { force?: boolean } = {},
  ) {
    if ((this.preservedStatus || this.hasTemporaryStatus()) && !options.force) {
      return false;
    }

    const statusText = this.getStatusTextElement();
    if (!statusText) {
      return false;
    }

    const normalizedSnapshot = {
      ...snapshot,
      content: this.normalizeStatusContent(snapshot.content),
    };
    const signature = this.buildStatusSignature(normalizedSnapshot);
    statusText.classList.toggle(
      'status-downloading',
      normalizedSnapshot.downloading === true,
    );

    if (this.renderedStatusSignature === signature) {
      return true;
    }

    if (normalizedSnapshot.useInnerHTML) {
      statusText.innerHTML = normalizedSnapshot.content;
    } else {
      statusText.textContent = normalizedSnapshot.content;
    }

    this.renderedStatusSignature = signature;
    return true;
  }

  applySnapshot(
    snapshot: StatusSnapshot,
    options: { animate?: boolean; force?: boolean; cycleId?: number } = {},
  ) {
    const statusText = this.getStatusTextElement();
    if (!statusText) {
      return;
    }

    const normalizedSnapshot = {
      ...snapshot,
      content: this.normalizeStatusContent(snapshot.content),
    };
    const signature = this.buildStatusSignature(normalizedSnapshot);
    if (this.renderedStatusSignature === signature && !options.force) {
      this.renderStatus(normalizedSnapshot, options);
      return;
    }

    const render = () => {
      if (
        options.cycleId !== undefined &&
        !this.isStatusCycleCurrent(options.cycleId)
      ) {
        return;
      }

      this.renderStatus(normalizedSnapshot, options);
    };

    if (options.animate) {
      this.animateStatusChange(statusText, render);
      return;
    }

    render();
  }

  collapseTransientExtendedBar() {
    const bottomBar = document.getElementById('main-status-bar');
    if (
      bottomBar &&
      bottomBar.classList.contains('expanded') &&
      !bottomBar.classList.contains('conflict-mode') &&
      !bottomBar.classList.contains('success-mode')
    ) {
      this.downloads.updateExtendedBar({ type: 'none' });
    }
  }

  canRefreshTab(cycleId: number, tab: StatusTab) {
    return (
      this.isStatusCycleCurrent(cycleId) &&
      this.currentTab === tab &&
      !this.preservedStatus &&
      !this.hasModalOpen() &&
      !this.hasTemporaryStatus() &&
      !this.hasDownloadsInProgress()
    );
  }

  startStaticTabPolling(
    tab: 'tools' | 'plugins' | 'characters',
    cycleId: number,
  ) {
    this.updateInterval = setInterval(() => {
      if (!this.canRefreshTab(cycleId, tab)) {
        this.clearUpdateLoop();
        return;
      }

      this.applySnapshot(this.tabStatus.getSnapshotForTab(tab), { cycleId });
    }, 10000);
  }

  renderCurrentTab(cycleId: number, animate: boolean) {
    if (!this.currentTab) {
      return;
    }

    this.applySnapshot(this.tabStatus.getSnapshotForTab(this.currentTab), {
      animate,
      cycleId,
    });

    switch (this.currentTab) {
      case 'tools':
        this.startStaticTabPolling('tools', cycleId);
        break;
      case 'plugins':
        this.startStaticTabPolling('plugins', cycleId);
        break;
      case 'characters':
        this.startStaticTabPolling('characters', cycleId);
        break;
      case 'downloads':
      case 'settings':
      case 'fightplanner':
      case 'marketplace':
      default:
        break;
    }
  }

  updateStatus(tabName) {
    const statusText = this.getStatusTextElement();
    if (!statusText) {
      return;
    }

    const normalizedTab = this.normalizeTab(tabName);
    if (normalizedTab) {
      this.currentTab = normalizedTab;
    } else if (!this.currentTab) {
      this.syncCurrentTabFromSidebar();
    }

    if (typeof tabName === 'string' && this.isCustomStatusPayload(tabName)) {
      const cycleId = this.beginStatusCycle();
      this.applySnapshot(this.resolveCustomStatusPayload(tabName), {
        animate: !this.preservedStatus,
        cycleId,
      });
      return;
    }

    if (!this.currentTab) {
      return;
    }

    const modalOpen = this.hasModalOpen();
    const hasActiveDownloads = this.downloads.checkActiveDownloads();

    if (modalOpen && !hasActiveDownloads) {
      this.preserveCurrentStatus();
      return;
    }

    if (this.preservedStatus && !modalOpen && !hasActiveDownloads) {
      this.preservedStatus = null;
    }

    if (this.hasTemporaryStatus()) {
      this.renderStatus(this.temporaryStatus!, { force: true });
      return;
    }

    const cycleId = this.beginStatusCycle();

    if (hasActiveDownloads) {
      this.preservedStatus = null;
      this.downloads.startDownloadsStatusLoop(cycleId);
      return;
    } else {
      this.collapseTransientExtendedBar();
      this.renderCurrentTab(cycleId, true);
    }
  }

  animateStatusChange(statusText, callback) {
    if (
      this.preservedStatus ||
      (this.hasModalOpen() && !this.downloads.checkActiveDownloads())
    ) {
      return;
    }

    const isReducedAnimations =
      document.body.classList.contains('reduced-animations');
    const isNoAnimations = document.body.classList.contains('no-animations');
    const bottomBar = document.getElementById('main-status-bar');

    if (isNoAnimations) {
      callback();
      return;
    }

    if (this.animationTimeout) {
      clearTimeout(this.animationTimeout);
      this.animationTimeout = null;
    }

    this.animationCounter++;
    const myCounter = this.animationCounter;
    const cleanupAnimation = () => {
      statusText.style.transition = '';
      statusText.style.opacity = '';
      statusText.style.transform = '';
      statusText.style.filter = '';
      statusText.style.willChange = '';
      statusText.classList.remove('status-changing');
      if (bottomBar && !bottomBar.classList.contains('expanded')) {
        bottomBar.classList.remove('collapsed-status-swap');
      }
    };

    statusText.classList.add('status-changing');
    statusText.style.willChange = 'opacity, transform, filter';
    if (bottomBar && !bottomBar.classList.contains('expanded')) {
      bottomBar.classList.remove('collapsed-status-swap');
      bottomBar.offsetHeight;
      bottomBar.classList.add('collapsed-status-swap');
    }

    if (isReducedAnimations) {
      statusText.style.transition =
        'opacity 0.12s ease-out, transform 0.12s ease-out, filter 0.12s ease-out';
      statusText.style.opacity = '0';
      statusText.style.transform = 'translate3d(0, 4px, 0) scale(0.994)';
      statusText.style.filter = 'blur(2px)';

      this.animationTimeout = setTimeout(() => {
        if (myCounter !== this.animationCounter) return;
        this.animationTimeout = null;
        callback();

        statusText.style.transition = 'none';
        statusText.style.opacity = '0';
        statusText.style.transform = 'translate3d(0, -4px, 0) scale(1.004)';
        statusText.style.filter = 'blur(2px)';

        requestAnimationFrame(() => {
          if (myCounter !== this.animationCounter) return;
          statusText.style.transition =
            'opacity 0.16s ease-out, transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), filter 0.16s ease-out';
          statusText.style.opacity = '1';
          statusText.style.transform = 'translate3d(0, 0, 0) scale(1)';
          statusText.style.filter = 'blur(0)';

          setTimeout(() => {
            if (myCounter !== this.animationCounter) return;
            cleanupAnimation();
          }, 180);
        });
      }, 110);
    } else {
      statusText.style.transition =
        'opacity 0.16s ease-in, transform 0.18s cubic-bezier(0.55, 0, 0.75, 0), filter 0.16s ease-in';
      statusText.style.opacity = '0';
      statusText.style.transform = 'translate3d(0, 7px, 0) scale(0.986)';
      statusText.style.filter = 'blur(5px)';

      this.animationTimeout = setTimeout(() => {
        if (myCounter !== this.animationCounter) return;
        this.animationTimeout = null;
        callback();

        statusText.style.transition = 'none';
        statusText.style.opacity = '0';
        statusText.style.transform = 'translate3d(0, -9px, 0) scale(1.012)';
        statusText.style.filter = 'blur(6px)';

        requestAnimationFrame(() => {
          if (myCounter !== this.animationCounter) return;
          statusText.style.transition =
            'opacity 0.24s ease-out, transform 0.34s cubic-bezier(0.16, 1, 0.3, 1), filter 0.26s ease-out';
          statusText.style.opacity = '1';
          statusText.style.transform = 'translate3d(0, 0, 0) scale(1)';
          statusText.style.filter = 'blur(0)';

          setTimeout(() => {
            if (myCounter !== this.animationCounter) return;
            cleanupAnimation();
          }, 340);
        });
      }, 150);
    }
  }

  hasModalOpen() {
    const overlay = document.querySelector<HTMLElement>('#modal-overlay');
    if (overlay && overlay.style.display === 'block') {
      return true;
    }

    const allModals = document.querySelectorAll<HTMLElement>(
      '.modal, .character-modal-overlay',
    );
    for (const modal of allModals) {
      if (modal.style.display === 'block' || modal.style.display === 'flex') {
        return true;
      }
    }
    return false;
  }

  preserveCurrentStatus() {
    const statusText = this.getStatusTextElement();
    if (statusText) {
      const currentStatus = statusText.textContent || statusText.innerHTML;
      if (
        currentStatus &&
        currentStatus.trim() &&
        currentStatus !== this.t('statusBar.ready') &&
        currentStatus !== 'Ready' &&
        currentStatus !== 'Prêt'
      ) {
        this.preservedStatus = currentStatus;
      }
    }
  }

  restorePreservedStatus() {
    if (
      this.preservedStatus &&
      !this.hasDownloadsInProgress() &&
      !this.hasModalOpen()
    ) {
      const statusText = this.getStatusTextElement();
      if (statusText) {
        this.renderStatus(
          {
            content: this.preservedStatus,
          },
          { force: true },
        );
        this.preservedStatus = null;
        if (this.currentTab) {
          setTimeout(() => {
            if (!this.hasModalOpen() && !this.hasDownloadsInProgress()) {
              this.updateStatus(this.currentTab);
            }
          }, 100);
        }
      } else {
        this.preservedStatus = null;
      }
    }
  }

  setStatusText(content, useInnerHTML = false) {
    return this.renderStatus({ content, useInnerHTML });
  }

  showTemporaryStatus(
    content,
    options: { useInnerHTML?: boolean; autoRestoreMs?: number } = {},
  ) {
    if (this.temporaryStatusTimeout) {
      clearTimeout(this.temporaryStatusTimeout);
      this.temporaryStatusTimeout = null;
    }

    this.beginStatusCycle();
    this.temporaryStatus = {
      content,
      useInnerHTML: options.useInnerHTML === true,
    };
    this.renderStatus(this.temporaryStatus, { force: true });

    if (options.autoRestoreMs && options.autoRestoreMs > 0) {
      this.temporaryStatusTimeout = setTimeout(() => {
        this.clearTemporaryStatus();
      }, options.autoRestoreMs);
    }
  }

  clearTemporaryStatus() {
    if (this.temporaryStatusTimeout) {
      clearTimeout(this.temporaryStatusTimeout);
      this.temporaryStatusTimeout = null;
    }

    if (!this.temporaryStatus) {
      return;
    }

    this.temporaryStatus = null;
    this.refreshStandardStatus();
  }

  showPendingConflict() {
    const pendingConflict = this.pendingConflictUpdate;
    if (!pendingConflict || this.hasActiveDownloads) return;

    this.pendingConflictUpdate = null;
    this.downloads.updateExtendedBar(pendingConflict);
  }

  refreshStandardStatus() {
    if (this.hasTemporaryStatus()) {
      this.renderStatus(this.temporaryStatus!, { force: true });
      return;
    }

    if (!this.currentTab) {
      this.syncCurrentTabFromSidebar();
    }

    if (this.currentTab) {
      this.updateStatus(this.currentTab);
    } else {
      const statusLeft = this.getStatusTextElement();
      if (statusLeft) {
        statusLeft.classList.remove('status-downloading');
        this.updateStatus('tools');
      }
    }
  }

  checkAndUpdateForDownloads() {
    const modalOpen = this.hasModalOpen();
    const hasActiveDownloads = this.downloads.checkActiveDownloads();

    if (modalOpen && !hasActiveDownloads) {
      this.preserveCurrentStatus();
      return;
    }

    const statusText = this.getStatusTextElement();
    if (!statusText) {
      return;
    }

    if (this.hasTemporaryStatus()) {
      this.renderStatus(this.temporaryStatus!, { force: true });
      return;
    }

    if (hasActiveDownloads) {
      this.preservedStatus = null;
      const cycleId = this.beginStatusCycle();
      this.downloads.startDownloadsStatusLoop(cycleId);
    } else if (this.currentTab && !modalOpen) {
      if (statusText.classList.contains('status-downloading')) {
        statusText.classList.remove('status-downloading');
        statusText.offsetHeight;
      }
      this.updateStatus(this.currentTab);
    } else if (!modalOpen && this.preservedStatus) {
      this.restorePreservedStatus();
    }
  }

  updateCheckingConflictsStatus() {
    const statusRight =
      document.querySelector<HTMLElement>('.bottom-text-right');
    if (!statusRight) return;

    statusRight.replaceChildren();
    const checkingText = document.createElement('span');
    checkingText.textContent = this.t('statusBar.checkingConflicts');
    checkingText.style.display = 'flex';
    checkingText.style.alignItems = 'center';
    checkingText.style.gap = '6px';

    const spinner = document.createElement('i');
    spinner.className = 'fas fa-circle-notch fa-spin';
    spinner.style.fontSize = '12px';
    checkingText.appendChild(spinner);

    statusRight.appendChild(checkingText);

    setTimeout(() => {
      if (window.modManager && window.modManager.conflictGroups) {
        const conflicts = window.modManager.conflictGroups;
        const conflictCount = conflicts.length;

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

        if (conflictCount > 0) {
          this.downloads.updateExtendedBar({
            type: 'conflict',
            conflictCount,
            modsWithConflictsCount: modsWithConflicts.size,
          });

          statusRight.replaceChildren();
          const warning = document.createElement('span');
          warning.style.color = 'var(--warning-color)';
          warning.innerHTML = `<i class="bi bi-exclamation-triangle-fill"></i> ${conflictCount} conflicts`;
          warning.style.cursor = 'pointer';
          warning.onclick = () => {
            if (window.conflictModalManager) {
              window.conflictModalManager.showConflictModal();
            }
          };
          statusRight.appendChild(warning);
        } else {
          if (!this.hasActiveDownloads) {
            this.downloads.updateExtendedBar({ type: 'none' });
          }
          statusRight.textContent = '';
        }
      }
    }, 500);
  }

  updateConflictStatus(conflictCount: number, modsWithConflictsCount: number) {
    const statusRight =
      document.querySelector<HTMLElement>('.bottom-text-right');
    if (!statusRight) return;

    statusRight.replaceChildren();

    if (conflictCount > 0) {
      this.downloads.updateExtendedBar({
        type: 'conflict',
        conflictCount,
        modsWithConflictsCount,
      }); // Update extended bar

      const conflictText = document.createElement('span');

      conflictText.className = 'conflict-link';
      conflictText.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        if (window.statusBarManager) {
          window.statusBarManager.preserveCurrentStatus();
        }

        if (window.conflictModalManager) {
          window.conflictModalManager.showConflictModal();
        }
      });

      conflictText.textContent = this.t('statusBar.conflictsDetected', {
        count: conflictCount,
        plural: conflictCount !== 1 ? 's' : '',
      });

      statusRight.appendChild(conflictText);
      return;
    }

    this.pendingConflictUpdate = null;

    if (this.lastExtendedBarData?.startsWith('conflict:')) {
      this.lastExtendedBarData = null;
      this.userDismissedExtendedBar = false;
    }

    const bottomBar = document.getElementById('main-status-bar');
    if (
      !this.hasActiveDownloads &&
      bottomBar?.classList.contains('conflict-mode')
    ) {
      this.downloads.updateExtendedBar({ type: 'none' });
    }
  }

  clear() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    const statusRight =
      document.querySelector<HTMLElement>('.bottom-text-right');
    if (statusRight) {
      statusRight.replaceChildren();
    }
    if (this.currentTab && !this.preservedStatus) {
      this.updateStatus(this.currentTab);
    }
  }
}

if (typeof window !== 'undefined') {
  window.statusBarManager = new StatusBarManager();

  // Écouter les changements de langue pour mettre à jour la status bar
  window.addEventListener('localeChanged', () => {
    if (window.statusBarManager && window.statusBarManager.currentTab) {
      // Mettre à jour le statut avec l'onglet actuel pour appliquer les nouvelles traductions
      setTimeout(() => {
        window.statusBarManager.updateStatus(
          window.statusBarManager.currentTab,
        );
      }, 100);
    }
  });
}
