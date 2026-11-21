window.addEventListener('error', (event) => {
  console.error('[Renderer] Uncaught Error:', event.error || event.message);
  if (window.electronAPI && window.electronAPI.trackError) {
    const errorMsg = event.error ? event.error.message : event.message;
    const errorStack =
      event.error && event.error.stack ? event.error.stack : '';
    window.electronAPI.trackError(errorMsg, errorStack, {
      source: 'renderer_window_error',
      filename: event.filename,
      lineno: event.lineno,
    });
  }
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Renderer] Unhandled Rejection:', event.reason);
  if (window.electronAPI && window.electronAPI.trackError) {
    const errorMsg =
      event.reason instanceof Error
        ? event.reason.message
        : String(event.reason);
    const errorStack =
      event.reason instanceof Error && event.reason.stack
        ? event.reason.stack
        : '';
    window.electronAPI.trackError(errorMsg, errorStack, {
      source: 'renderer_unhandled_rejection',
    });
  }
});

document
  .querySelector<HTMLElement>('.minimize')!
  .addEventListener('click', () => {
    if (window.electronAPI) {
      window.electronAPI.minimize();
    }
  });

document
  .querySelector<HTMLElement>('.maximize')!
  .addEventListener('click', () => {
    if (window.electronAPI) {
      window.electronAPI.maximize();
    }
  });

document.querySelector<HTMLElement>('.close')!.addEventListener('click', () => {
  if (window.electronAPI) {
    window.electronAPI.close();
  }
});

let currentTimeline: {
  kill: () => void;
} | null = null;

async function switchTab(tabName) {
  if (currentTimeline) {
    currentTimeline.kill();
  }

  const currentTab = document.querySelector<HTMLElement>('.tab-content.active');
  const selectedTab = document.querySelector<HTMLElement>(`#tab-${tabName}`);

  if (currentTab === selectedTab) return;

  window.appSoundManager?.play('switchTab', { volume: 0.65, cooldownMs: 60 });

  if (window.tabLoader) {
    await window.tabLoader.loadTabContent(tabName);
  }

  if (window.animationManager) {
    window.animationManager.animateTabSwitch(currentTab, selectedTab, tabName);
  } else {
    if (selectedTab) {
      selectedTab.classList.add('active');
      selectedTab.style.display = 'flex';
    }
    if (currentTab) {
      currentTab.classList.remove('active');
      currentTab.style.display = 'none';
    }
  }

  document.querySelectorAll<HTMLElement>('.sidebar-btn').forEach((btn) => {
    btn.classList.remove('active');
  });

  const activeButton = document.querySelector<HTMLElement>(
    `[data-tab="${tabName}"]`,
  );
  if (activeButton) {
    activeButton.classList.add('active');
  }

  if (window.settingsManager) {
    const currentTheme = window.settingsManager.settings.theme || 'dark';
    window.settingsManager.applyTheme(currentTheme);
  }

  if (window.statusBarManager) {
    window.statusBarManager.updateStatus(tabName);
  }
}

const sidebarButtons = document.querySelectorAll<HTMLElement>('.sidebar-btn');
sidebarButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const tabName = btn.getAttribute('data-tab');
    if (tabName) {
      switchTab(tabName);
    }
  });
});

window.addEventListener('DOMContentLoaded', async () => {
  window.electronAPI
    ?.getAppVersion?.()
    .then((info) => {
      const channel = /-(alpha|beta)/i.exec(info?.version || '')?.[1];
      if (channel) {
        document
          .getElementById(`titlebar-${channel.toLowerCase()}-badge`)
          ?.removeAttribute('hidden');
      }
    })
    .catch(() => {});

  if (window.HardwareConnectionManager && !window.hardwareConnectionManager) {
    window.hardwareConnectionManager = new window.HardwareConnectionManager();
    await window.hardwareConnectionManager.initialize();
  }

  if (window.animationManager) {
    window.animationManager.initialize();
  }

  if (window.startupSplashManager?.isStartupLaunch()) {
    await window.startupSplashManager.initialize();
  } else if (window.tabLoader) {
    await window.tabLoader.initializeTabs();

    if (window.modManager?.fetchMods) {
      await window.modManager.fetchMods();
    }
  }

  const params = new URLSearchParams(window.location.search);
  const guideProgress = await window.electronAPI?.store.get(
    'tutorial.guideProgress',
  );
  if (params.get('postTutorialIntro') === 'true' || guideProgress) {
    setTimeout(() => window.tutorial?.showInApp?.(), 800);
  }

  setTimeout(() => {
    const activeTab = document.querySelector<HTMLElement>(
      '.tab-content.active',
    );
    if (activeTab) {
      const tabId = activeTab.id.replace('tab-', '');
      if (window.statusBarManager && tabId) {
        window.statusBarManager.updateStatus(tabId);
      } else {
        console.warn(
          '[Renderer] StatusBarManager missing or tabId invalid for active tab',
        );
      }
    } else {
      if (window.statusBarManager) {
        window.statusBarManager.updateStatus('tools');
      } else {
        console.warn(
          '[Renderer] StatusBarManager missing, cannot default to tools',
        );
      }
    }
  }, 100);

  setTimeout(async () => {
    await showBetaNoticeOnce();
    await window.remoteAnnouncementManager?.checkOnStartup?.();

    if (window.pluginManager && window.settingsManager) {
      await window.pluginManager.checkForUpdatesOnStartup();
    }

    await window.modInfoManager?.checkForUpdates();
  }, 5000);
});

document.addEventListener('keydown', async (e) => {
  const isCtrlOrCmd = e.ctrlKey || e.metaKey;
  if (isCtrlOrCmd && e.altKey && (e.key === 'r' || e.key === 'R')) {
    e.preventDefault();
    try {
      if (
        window.electronAPI &&
        window.electronAPI.store &&
        window.electronAPI.store.clear
      ) {
        await window.electronAPI.store.clear();
        if (window.toastManager) {
          window.toastManager.success('toasts.electronStoreReset');
        }
      }
    } catch (err) {
      console.error('Failed to reset store:', err);
      if (window.toastManager) {
        window.toastManager.error('toasts.failedToResetStore');
      }
    }
  }
});

function openSettingsTab(tab: string, scrollToId?: string) {
  document
    .querySelector<HTMLElement>('.sidebar-btn[data-tab="settings"]')
    ?.click();
  setTimeout(() => {
    document
      .querySelector<HTMLElement>(`.settings-tab-btn[data-settings-tab="${tab}"]`)
      ?.click();
    if (scrollToId) {
      setTimeout(() => {
        const target = document.getElementById(scrollToId);
        const area = target?.closest<HTMLElement>('.settings-content-area');
        if (!target || !area) return;
        const offset =
          target.getBoundingClientRect().top -
          area.getBoundingClientRect().top -
          (area.clientHeight - target.offsetHeight) / 2;
        area.scrollBy({ top: offset, behavior: 'smooth' });
      }, 150);
    }
  }, 150);
}

async function showBetaNoticeOnce() {
  const info = await window.electronAPI?.getAppVersion?.().catch(() => null);
  const version = info?.version;
  const channel = /-(alpha|beta)/i.exec(version || '')?.[1]?.toLowerCase();
  if (!version || !channel || !window.modalManager?.showCustomModal) {
    return;
  }

  const isAlpha = channel === 'alpha';
  const noticeKey = isAlpha ? 'alphaNotice' : 'betaNotice';
  const storageKey = `fightplanner:${channel}-notice:seen:${version}`;
  try {
    if (localStorage.getItem(storageKey) === '1') return;
  } catch {}
  const markSeen = () => {
    try {
      localStorage.setItem(storageKey, '1');
    } catch {}
  };

  const t = (key: string, fallback: string, params?: Record<string, string>) =>
    window.i18n?.t?.(key, params) || fallback;

  const body = document.createElement('p');
  body.textContent = t(
    `modals.${noticeKey}.message`,
    isAlpha
      ? `You're using MOSAIC ${version}, an alpha version. This is an early test build: serious problems can happen, including damage to your mods or your setup. Back up your mods before using it, just in case. Don't hesitate to send us feedback, it really helps!`
      : `You're using MOSAIC ${version}, a beta version. Expect bugs and unfinished features. Don't hesitate to send us feedback, it really helps!`,
    { version },
  );

  const modal = window.modalManager.showCustomModal({
    id: `${channel}-notice`,
    onClose: markSeen,
    title: t(
      `modals.${noticeKey}.title`,
      isAlpha ? 'Alpha version' : 'Beta version',
    ),
    body,
    buttons: [
      { text: t('common.close', 'Close') },
      {
        text: t(`modals.${noticeKey}.giveFeedback`, 'Give feedback'),
        type: isAlpha ? undefined : 'primary',
        onClick: () => openSettingsTab('feedback'),
      },
      ...(isAlpha
        ? [
            {
              text: t(
                'modals.alphaNotice.backupConfig',
                'Backup your MOSAIC config',
              ),
              type: 'primary',
              onClick: () =>
                openSettingsTab('advanced', 'export-config-backup-btn'),
            },
          ]
        : []),
    ],
  });

  const icon = document.createElement('i');
  icon.className = isAlpha
    ? 'bi bi-exclamation-octagon'
    : 'bi bi-exclamation-triangle';
  modal.querySelector<HTMLElement>('.modal-header h3')?.prepend(icon);
}
