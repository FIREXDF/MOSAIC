class MarketplaceDiscover extends SocialGameBananaManager {
  private started = false;

  async initialize() {
    if (this.started || !document.querySelector('#social-discover-content')) return;

    this.started = true;
    this.setupGameBananaSearchEvents();
    await this.loadDiscover();
  }
}

if (typeof window !== 'undefined') {
  window.marketplaceDiscover = new MarketplaceDiscover();
}

export { MarketplaceDiscover };
