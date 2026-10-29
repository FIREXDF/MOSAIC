class DiscordRPCClient {
  currentTab: string | null;
  modCount: number;

  constructor() {
    this.currentTab = null;
    this.modCount = 0;
    this.init();
  }

  init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () =>
        this.setupListeners(),
      );
    } else {
      this.setupListeners();
    }
  }

  setupListeners() {
    const tabButtons = document.querySelectorAll<HTMLElement>('.sidebar-btn');

    tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        this.updateTab(tab);
      });
    });

    setTimeout(() => {
      this.updateTab('tools');
    }, 500);
  }

  updateTab(tab) {
    this.currentTab = tab;
    this.sendUpdate();
  }

  updateModCount(count) {
    this.modCount = count;
    if (this.currentTab === 'tools') {
      this.sendUpdate();
    }
  }

  sendUpdate() {
    if (window.electronAPI && window.electronAPI.updateDiscordRPC) {
      window.electronAPI.updateDiscordRPC({
        tab: this.currentTab,
        modCount: this.modCount,
      });
    } else {
      console.warn('electronAPI.updateDiscordRPC not available');
    }
  }
}

if (typeof window !== 'undefined') {
  window.discordRPCClient = new DiscordRPCClient();
}

export { type DiscordRPCClient };
