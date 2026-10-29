class SocialGameBananaManager extends SocialManagerBase {
  filters = new GameBananaFiltersSection(this);
  requirements = new GameBananaRequirementsSection(this);
  transitions = new GameBananaTransitionsSection(this);
  detail = new GameBananaDetailSection(this);
  featured = new GameBananaFeaturedSection(this);

  async loadDiscover() {
    this.gameBananaDetailRequestId++;
    this.gameBananaUmcState = null;
    const discoverContent = document.querySelector<HTMLElement>(
      '#social-discover-content',
    );
    if (!discoverContent) return;

    discoverContent.innerHTML = `<div class="social-loading"><i class="bi bi-hourglass-split"></i><p>${escapeHtml(
      this.getSocialTranslation('social.loadingMods', 'Loading mods...'),
    )}</p></div>`;

    try {
      const [submissionsData, subfeedData] = await Promise.all([
        this.fetchWithCache(
          this.GAMEBANANA_TOP_SUBS_URL,
          {},
          'gameBananaTopSubsContentRatings',
        ),
        this.fetchGameBananaModsPage(1, this.gameBananaSearchQuery),
      ]);

      const submissions: GameBananaTopSubmission[] = Array.isArray(
        submissionsData,
      )
        ? submissionsData
        : [];
      const mods = this.filterDiscoverNsfwSubmissions(
        submissions.filter((submission) => submission._sModelName === 'Mod'),
      );
      this.gameBananaFeaturedSourceMods = mods;
      this.gameBananaCurrentSubfeedData = subfeedData;

      const featuredMods = this.getFilteredGameBananaFeaturedMods();
      this.gameBananaFeaturedMods = featuredMods;
      this.gameBananaFeaturedIndex = 0;
      this.gameBananaModsPage = 1;
      featuredMods.forEach((mod) => this.cacheGameBananaSubmission(mod));

      discoverContent.innerHTML = `
        <div class="social-gamebanana-top-search">
          ${this.filters.renderGameBananaSearchControl()}
        </div>
        <div class="social-gamebanana-featured">
          <div class="social-gamebanana-carousel-header">
            <h3 class="social-gamebanana-section-title">${escapeHtml(
              this.getSocialTranslation('social.featured', 'Featured'),
            )}</h3>
            <div class="social-gamebanana-carousel-actions">
              <button class="social-gamebanana-carousel-btn" data-direction="prev" aria-label="${escapeHtml(
                this.getSocialTranslation(
                  'social.previousFeaturedMod',
                  'Previous featured mod',
                ),
              )}">
                <i class="bi bi-chevron-left"></i>
              </button>
              <button class="social-gamebanana-carousel-btn" data-direction="next" aria-label="${escapeHtml(
                this.getSocialTranslation(
                  'social.nextFeaturedMod',
                  'Next featured mod',
                ),
              )}">
                <i class="bi bi-chevron-right"></i>
              </button>
            </div>
          </div>
          <div id="social-gamebanana-carousel" class="social-gamebanana-carousel">
            ${
              featuredMods.length
                ? this.featured.renderGameBananaFeaturedStack()
                : `<div class="social-gamebanana-featured-empty">${escapeHtml(
                    this.getSocialTranslation(
                      'social.noFeaturedGameBananaMods',
                      'No featured GameBanana mods found.',
                    ),
                  )}</div>`
            }
          </div>
        </div>
        <div class="social-gamebanana-mods">
          <div class="social-gamebanana-mods-header">
            <div class="social-gamebanana-mods-title-row">
              <h3 class="social-gamebanana-section-title">${escapeHtml(
                this.getSocialTranslation('social.mods', 'Mods'),
              )}</h3>
            </div>
            <div class="social-gamebanana-mods-actions">
              ${this.filters.renderGameBananaSortControl()}
              <div id="social-gamebanana-pagination" class="social-gamebanana-pagination">
                ${this.renderGameBananaPagination(subfeedData)}
              </div>
            </div>
          </div>
          ${this.filters.renderGameBananaCategoryFilters()}
          <div id="social-gamebanana-mods-content">
            ${this.renderGameBananaModsPage(subfeedData)}
          </div>
        </div>
      `;

      this.featured.setGameBananaFeaturedCardPositions();
      this.hydrateVisibleGameBananaDownloadCounts();
    } catch (error) {
      console.error('[Social] Error loading GameBanana featured mods:', error);
      discoverContent.innerHTML = `<div class="social-error-state"><i class="bi bi-exclamation-triangle"></i><p>${escapeHtml(
        this.getSocialTranslation(
          'social.failedToLoadGameBananaMods',
          'Failed to load GameBanana mods.',
        ),
      )}</p></div>`;
    }
  }

  setupGameBananaClickFallbackEvents() {
    if (this.gameBananaClickFallbackListenerBound) return;
    this.gameBananaClickFallbackListenerBound = true;

    document.addEventListener(
      'click',
      (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;

        const gameBananaTarget = target.closest(
          [
            '.social-gamebanana-nsfw-reveal-btn',
            '.social-gamebanana-sort',
            '.social-gamebanana-sort .custom-select-option',
            '.social-gamebanana-category-filter',
            '.social-gamebanana-carousel-btn',
            '.social-gamebanana-card-featured',
            '.social-gamebanana-page-btn',
            '.social-gamebanana-detail-back',
            '.social-gamebanana-requirement-install',
            '.social-gamebanana-requirement-link',
            '.social-gamebanana-requirement-search',
            '.social-gamebanana-gallery-thumb',
            '.social-gamebanana-gallery-nav',
            '.social-gamebanana-finished-work-btn',
            '.social-gamebanana-external-btn',
            '.social-gamebanana-file-download-btn',
            '.social-gamebanana-card',
          ].join(','),
        );
        if (!gameBananaTarget) return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        void this.handleGameBananaClickTarget(target as HTMLElement);
      },
      true,
    );
  }

  async handleGameBananaClickTarget(clickedElement: HTMLElement) {
    const skinToggle = clickedElement.closest<HTMLElement>(
      '.social-gamebanana-skins-toggle',
    );
    if (skinToggle) {
      await this.filters.toggleGameBananaSkinSubcategories();
      return;
    }

    const nsfwRevealButton = clickedElement.closest<HTMLButtonElement>(
      '.social-gamebanana-nsfw-reveal-btn',
    );
    if (nsfwRevealButton) {
      nsfwRevealButton
        .closest<HTMLElement>('.social-gamebanana-preview-media')
        ?.classList.add('is-revealed');
      return;
    }

    const sortOption = clickedElement.closest<HTMLElement>(
      '.social-gamebanana-sort .custom-select-option',
    );
    if (sortOption) {
      sortOption
        .closest<HTMLElement>('.social-gamebanana-sort')
        ?.classList.remove('open');
      await this.filters.setGameBananaDiscoverSort(
        sortOption.getAttribute('data-sort-value') || 'recent',
      );
      return;
    }

    const sortSelect = clickedElement.closest<HTMLElement>(
      '.social-gamebanana-sort',
    );
    if (sortSelect) {
      const wasOpen = sortSelect.classList.contains('open');
      document
        .querySelectorAll<HTMLElement>('.custom-select.open')
        .forEach((select) => {
          if (select !== sortSelect) select.classList.remove('open');
        });
      sortSelect.classList.toggle('open', !wasOpen);
      return;
    }

    const categoryFilterButton = clickedElement.closest<HTMLButtonElement>(
      '.social-gamebanana-category-filter',
    );
    if (categoryFilterButton) {
      await this.filters.setGameBananaCategoryFilter(
        categoryFilterButton.getAttribute('data-category-filter') || 'all',
      );
      return;
    }

    const carouselButton = clickedElement.closest<HTMLElement>(
      '.social-gamebanana-carousel-btn',
    );
    if (carouselButton) {
      const direction =
        carouselButton.getAttribute('data-direction') === 'next' ? 1 : -1;
      this.featured.scrollGameBananaCarousel(direction);
      return;
    }

    const featuredCard = clickedElement.closest<HTMLElement>(
      '.social-gamebanana-card-featured',
    );
    if (featuredCard) {
      const featuredPosition = featuredCard.getAttribute(
        'data-featured-position',
      );
      const featuredIndex = Number(
        featuredCard.getAttribute('data-featured-index'),
      );

      if (featuredPosition !== 'active' && Number.isFinite(featuredIndex)) {
        const total = this.gameBananaFeaturedMods.length;
        const nextIndex = (this.gameBananaFeaturedIndex + 1) % total;
        const direction = featuredIndex === nextIndex ? 1 : -1;
        this.featured.updateGameBananaFeaturedStack(featuredIndex, direction);
        return;
      }
    }

    const pageButton = clickedElement.closest<HTMLButtonElement>(
      '.social-gamebanana-page-btn',
    );
    if (pageButton) {
      if (pageButton.disabled) return;

      const action = pageButton.getAttribute('data-page-action');
      const nextPage =
        action === 'next'
          ? this.gameBananaModsPage + 1
          : this.gameBananaModsPage - 1;
      await this.loadGameBananaModsPage(nextPage);
      return;
    }

    if (clickedElement.closest('.social-gamebanana-detail-back')) {
      await this.transitions.returnFromGameBananaDetail();
      return;
    }

    const requirementInstallBtn = clickedElement.closest<HTMLButtonElement>(
      '.social-gamebanana-requirement-install',
    );
    if (requirementInstallBtn) {
      if (requirementInstallBtn.disabled) return;

      const pluginName = requirementInstallBtn.getAttribute('data-plugin-name');
      const repo = requirementInstallBtn.getAttribute('data-plugin-repo');
      if (pluginName && repo) {
        requirementInstallBtn.disabled = true;
        try {
          await this.requirements.installGameBananaRequirement(pluginName, repo);
          await window.pluginManager?.refreshPlugins?.();
          if (this.gameBananaCurrentDetail) {
            this.detail.renderGameBananaDetailPage(
              this.gameBananaCurrentDetail.details,
              this.gameBananaCurrentDetail.fallback,
              false,
              this.gameBananaCurrentDetail.files,
            );
          }
        } finally {
          requirementInstallBtn.disabled = false;
        }
      }
      return;
    }

    const requirementLinkBtn = clickedElement.closest<HTMLButtonElement>(
      '.social-gamebanana-requirement-link',
    );
    if (requirementLinkBtn) {
      const url = requirementLinkBtn.getAttribute('data-url');
      if (url && window.electronAPI?.openUrl) {
        await window.electronAPI.openUrl(url);
      }
      return;
    }

    const requirementSearchBtn = clickedElement.closest<HTMLButtonElement>(
      '.social-gamebanana-requirement-search',
    );
    if (requirementSearchBtn) {
      const query = requirementSearchBtn.getAttribute('data-query') || '';
      const provider =
        requirementSearchBtn.getAttribute('data-provider') || 'google';
      const url = this.requirements.getGameBananaRequirementSearchUrl(query, provider);
      if (window.electronAPI?.openUrl) {
        await window.electronAPI.openUrl(url);
      }
      return;
    }

    const galleryThumb = clickedElement.closest<HTMLButtonElement>(
      '.social-gamebanana-gallery-thumb',
    );
    if (galleryThumb) {
      const gallery = galleryThumb.closest<HTMLElement>(
        '.social-gamebanana-gallery',
      );
      const index = Number(galleryThumb.getAttribute('data-gallery-index'));
      if (gallery && Number.isFinite(index)) {
        this.detail.updateGameBananaGallery(gallery, index);
      }
      return;
    }

    const galleryNav = clickedElement.closest<HTMLButtonElement>(
      '.social-gamebanana-gallery-nav',
    );
    if (galleryNav) {
      const gallery = galleryNav.closest<HTMLElement>(
        '.social-gamebanana-gallery',
      );
      const currentIndex = Number(
        gallery?.getAttribute('data-gallery-index') || 0,
      );
      const direction = Number(
        galleryNav.getAttribute('data-gallery-direction') || 0,
      );
      if (gallery && Number.isFinite(currentIndex)) {
        this.detail.updateGameBananaGallery(gallery, currentIndex + direction);
      }
      return;
    }

    const finishedWorkBtn = clickedElement.closest<HTMLButtonElement>(
      '.social-gamebanana-finished-work-btn',
    );
    if (finishedWorkBtn) {
      const modelName = finishedWorkBtn.getAttribute('data-gb-model');
      const submissionId = finishedWorkBtn.getAttribute('data-gb-id');
      if (modelName && submissionId) {
        this.gameBananaLastDetailSource = {
          modelName,
          submissionId,
          sourceKind: 'grid',
          page: this.gameBananaModsPage,
          scrollTop: this.transitions.getSocialMainScrollTop(),
        };
        await this.showGameBananaSubmissionDetails(modelName, submissionId);
      }
      return;
    }

    const umcRetry =
      clickedElement.closest<HTMLButtonElement>('[data-umc-retry]');
    if (umcRetry && this.gameBananaUmcState?.status === 'error') {
      void this.detail.loadGameBananaUmc(this.gameBananaDetailRequestId);
      return;
    }

    const externalGameBananaBtn = clickedElement.closest<HTMLButtonElement>(
      '.social-gamebanana-external-btn',
    );
    if (externalGameBananaBtn) {
      const url = externalGameBananaBtn.getAttribute('data-url');
      if (url && window.electronAPI?.openUrl) {
        await window.electronAPI.openUrl(url);
      }
      return;
    }

    const fileDownloadBtn = clickedElement.closest<HTMLButtonElement>(
      '.social-gamebanana-file-download-btn',
    );
    if (fileDownloadBtn) {
      if (fileDownloadBtn.disabled) return;

      const downloadUrl = fileDownloadBtn.getAttribute('data-download-url');
      if (downloadUrl && window.electronAPI?.openFightPlannerLink) {
        const originalContent = fileDownloadBtn.innerHTML;
        fileDownloadBtn.disabled = true;

        try {
          const shouldCheckDependencies =
            await this.shouldCheckGameBananaDependenciesOnDownload();
          fileDownloadBtn.innerHTML = shouldCheckDependencies
            ? '<i class="bi bi-hourglass-split"></i><span>Checking</span>'
            : '<i class="bi bi-download"></i><span>Downloading</span>';

          const shouldContinue =
            await this.confirmMissingGameBananaRequirements(downloadUrl);
          if (!shouldContinue) return;

          const pendingDownload = this.detail.createGameBananaSocialPayload(downloadUrl);
          const fallbackProtocolUrl = /^(?:fightplanner|mosaic):/i.test(downloadUrl)
            ? downloadUrl
            : `fightplanner:${downloadUrl}`;
          await window.electronAPI.openFightPlannerLink(pendingDownload?.link || fallbackProtocolUrl);
        } finally {
          fileDownloadBtn.disabled = false;
          fileDownloadBtn.innerHTML = originalContent;
        }
      }
      return;
    }

    const gameBananaCard = clickedElement.closest<HTMLElement>(
      '.social-gamebanana-card',
    );
    if (gameBananaCard) {
      const modelName = gameBananaCard.getAttribute('data-gb-model');
      const submissionId = gameBananaCard.getAttribute('data-gb-id');
      if (modelName && submissionId) {
        this.transitions.captureGameBananaDiscoverSnapshot();
        this.gameBananaLastDetailSource = {
          modelName,
          submissionId,
          sourceKind: this.transitions.getGameBananaCardSourceKind(gameBananaCard),
          page: this.gameBananaModsPage,
          scrollTop: this.transitions.getSocialMainScrollTop(),
        };
        await this.showGameBananaSubmissionDetails(
          modelName,
          submissionId,
          gameBananaCard,
        );
      }
    }
  }

  getGameBananaSubfeedUrl(page = 1, searchQuery = '') {
    const categoryFilter = this.getGameBananaCategoryFilterConfig();
    if (
      categoryFilter?.model ||
      this.filters.getGameBananaDiscoverSort() !== 'recent'
    ) {
      return this.getGameBananaIndexedListUrl(
        page,
        categoryFilter || { model: 'Mod' },
        searchQuery,
      );
    }

    const params = new URLSearchParams({
      _nPage: String(Math.max(1, page)),
      _sSort: 'default',
      _csvModelExclusions: 'Question,Tutorial,Request',
    });
    const trimmedSearch = searchQuery.trim();
    if (trimmedSearch) {
      params.set('_sName', trimmedSearch);
    }

    return `${this.GAMEBANANA_SUBFEED_URL}?${params.toString()}`;
  }

  getGameBananaIndexedListUrl(page = 1, categoryFilter: any, searchQuery = '') {
    const params = new URLSearchParams({
      _nPage: String(Math.max(1, page)),
      _nPerpage: '15',
      _sSort: this.filters.getGameBananaApiSort(),
    });
    params.set('_aFilters[Generic_Game]', '6498');
    const trimmedSearch = searchQuery.trim();
    if (trimmedSearch) {
      params.set('_aFilters[Generic_Name]', `contains,${trimmedSearch}`);
    }
    if (categoryFilter.categoryId) {
      params.set(
        '_aFilters[Generic_Category]',
        String(categoryFilter.categoryId),
      );
    }

    return `https://gamebanana.com/apiv12/${categoryFilter.model}/Index?${params.toString()}`;
  }

  async fetchGameBananaModsPage(
    page = 1,
    searchQuery = this.gameBananaSearchQuery,
  ): Promise<GameBananaSubfeedResponse> {
    const response = await fetch(
      this.getGameBananaSubfeedUrl(page, searchQuery),
    );
    const data = await response.json();

    if (!response.ok) {
      throw new Error(`GameBanana Subfeed failed: ${response.status}`);
    }

    const metadata = data?._aMetadata || {};
    const perPage = Number(metadata._nPerpage || 15);
    const recordCount = Number(metadata._nRecordCount || 0);
    this.gameBananaModsTotalPages = Math.max(
      1,
      Math.ceil(recordCount / perPage),
    );

    return data;
  }

  async loadGameBananaModsPage(
    page: number,
    searchQuery = this.gameBananaSearchQuery,
  ) {
    this.gameBananaSearchQuery = searchQuery.trim();
    const requestId = ++this.gameBananaModsRequestId;
    const nextPage = Math.max(1, Math.min(page, this.gameBananaModsTotalPages));
    const modsContent = document.querySelector<HTMLElement>(
      '#social-gamebanana-mods-content',
    );
    const pagination = document.querySelector<HTMLElement>(
      '#social-gamebanana-pagination',
    );
    if (!modsContent || !pagination) return;

    this.gameBananaModsPage = nextPage;
    modsContent.innerHTML =
      '<div class="social-loading social-gamebanana-mods-loading"><i class="bi bi-hourglass-split"></i><p>Loading mods...</p></div>';

    try {
      const subfeedData = await this.fetchGameBananaModsPage(
        nextPage,
        this.gameBananaSearchQuery,
      );
      if (requestId !== this.gameBananaModsRequestId) return;

      this.gameBananaCurrentSubfeedData = subfeedData;
      modsContent.innerHTML = this.renderGameBananaModsPage(subfeedData);
      pagination.innerHTML = this.renderGameBananaPagination(subfeedData);
      this.hydrateVisibleGameBananaDownloadCounts(requestId);
    } catch (error) {
      if (requestId !== this.gameBananaModsRequestId) return;

      console.error('[Social] Error loading GameBanana mods page:', error);
      modsContent.innerHTML =
        '<div class="social-error-state"><i class="bi bi-exclamation-triangle"></i><p>Failed to load mods</p></div>';
    }
  }

  renderGameBananaModsPage(subfeedData: GameBananaSubfeedResponse) {
    const records = (
      Array.isArray(subfeedData?._aRecords) ? subfeedData._aRecords : []
    ).filter((submission) => submission._sModelName !== 'Request');
    const visibleRecords = this.filterDiscoverNsfwSubmissions(records);
    visibleRecords.forEach((mod) => this.cacheGameBananaSubmission(mod));

    if (visibleRecords.length === 0) {
      return `<div class="social-empty-state"><i class="bi bi-inbox"></i><p>${escapeHtml(
        this.getSocialTranslation('social.noModsFound', 'No mods found.'),
      )}</p></div>`;
    }

    return `
      <div class="social-gamebanana-grid">
        ${visibleRecords.map((mod) => this.renderGameBananaModCard(mod)).join('')}
      </div>
    `;
  }

  getGameBananaSubmissionCacheKey(modelName: string, submissionId: string) {
    return `${modelName || 'Mod'}:${submissionId}`;
  }

  getGameBananaSubmissionDownloadCount(mod: GameBananaTopSubmission | any) {
    const directCount = Number(mod?._nDownloadCount);
    if (Number.isFinite(directCount)) return directCount;

    const files = Array.isArray(mod?._aFiles) ? mod._aFiles : [];
    if (!files.length) return null;

    return files.reduce((total, file) => {
      const count = Number(file?._nDownloadCount);
      return Number.isFinite(count) ? total + count : total;
    }, 0);
  }

  renderGameBananaDownloadStat(
    mod: GameBananaTopSubmission,
    modelName: string,
    submissionId: string,
  ) {
    const count = this.getGameBananaSubmissionDownloadCount(mod);
    const value = count == null ? '...' : this.formatGameBananaCount(count);

    return `
      <span class="social-gamebanana-card-downloads" data-gb-model="${escapeHtml(modelName)}" data-gb-id="${escapeHtml(submissionId)}" title="Total downloads">
        <i class="bi bi-download"></i>
        <span>${value}</span>
      </span>
    `;
  }

  formatGameBananaCount(value: number) {
    if (!Number.isFinite(value)) return '0';
    return new Intl.NumberFormat(undefined, {
      notation: value >= 10000 ? 'compact' : 'standard',
      maximumFractionDigits: value >= 10000 ? 1 : 0,
    }).format(value);
  }

  async hydrateVisibleGameBananaDownloadCounts(
    requestId = this.gameBananaModsRequestId,
  ) {
    const targets = Array.from(
      document.querySelectorAll<HTMLElement>(
        '#social-discover-content .social-gamebanana-card-downloads',
      ),
    );
    const uniqueTargets = targets.filter((target, index, list) => {
      const key = this.getGameBananaSubmissionCacheKey(
        target.getAttribute('data-gb-model') || 'Mod',
        target.getAttribute('data-gb-id') || '',
      );
      return (
        target.getAttribute('data-gb-id') &&
        list.findIndex(
          (item) =>
            this.getGameBananaSubmissionCacheKey(
              item.getAttribute('data-gb-model') || 'Mod',
              item.getAttribute('data-gb-id') || '',
            ) === key,
        ) === index
      );
    });

    for (let index = 0; index < uniqueTargets.length; index += 4) {
      if (requestId !== this.gameBananaModsRequestId) return;
      const chunk = uniqueTargets.slice(index, index + 4);
      await Promise.all(
        chunk.map(async (target) => {
          const modelName = target.getAttribute('data-gb-model') || 'Mod';
          const submissionId = target.getAttribute('data-gb-id') || '';
          if (!submissionId) return;

          const count = await this.getGameBananaDownloadCount(
            modelName,
            submissionId,
          );
          if (requestId !== this.gameBananaModsRequestId || count == null) {
            return;
          }

          this.updateGameBananaDownloadCountElements(
            modelName,
            submissionId,
            count,
          );
        }),
      );
    }
  }

  async getGameBananaDownloadCount(modelName: string, submissionId: string) {
    const key = this.getGameBananaSubmissionCacheKey(modelName, submissionId);
    if (this.gameBananaDownloadCountCache.has(key)) {
      return this.gameBananaDownloadCountCache.get(key) ?? null;
    }

    const cachedSubmission = this.getCachedGameBananaSubmission(
      modelName,
      submissionId,
    );
    const cachedCount =
      this.getGameBananaSubmissionDownloadCount(cachedSubmission);
    if (cachedCount != null) {
      this.gameBananaDownloadCountCache.set(key, cachedCount);
      return cachedCount;
    }

    if (this.gameBananaDownloadCountRequests.has(key)) {
      return this.gameBananaDownloadCountRequests.get(key) ?? null;
    }

    const request = this.fetchGameBananaDownloadCount(modelName, submissionId);
    this.gameBananaDownloadCountRequests.set(key, request);

    try {
      const count = await request;
      this.gameBananaDownloadCountCache.set(key, count);
      return count;
    } finally {
      this.gameBananaDownloadCountRequests.delete(key);
    }
  }

  async fetchGameBananaDownloadCount(modelName: string, submissionId: string) {
    if (!window.electronAPI?.fetchGameBananaDetails) return null;

    try {
      const result = await window.electronAPI.fetchGameBananaDetails(
        modelName,
        submissionId,
      );
      if (!result?.success) return null;

      const count = this.getGameBananaSubmissionDownloadCount(result.data);
      return count == null ? null : count;
    } catch (error) {
      console.warn(
        '[Social] Failed to fetch GameBanana download count:',
        error,
      );
      return null;
    }
  }

  updateGameBananaDownloadCountElements(
    modelName: string,
    submissionId: string,
    count: number,
  ) {
    document
      .querySelectorAll<HTMLElement>('.social-gamebanana-card-downloads')
      .forEach((element) => {
        if (
          element.getAttribute('data-gb-model') !== modelName ||
          element.getAttribute('data-gb-id') !== submissionId
        ) {
          return;
        }

        const value = element.querySelector<HTMLElement>('span');
        if (value) {
          value.textContent = this.formatGameBananaCount(count);
        }
      });
  }

  filterDiscoverNsfwSubmissions<T extends GameBananaTopSubmission>(mods: T[]) {
    if (!this.shouldHideGameBananaNsfwMods()) return mods;
    return mods.filter((mod) => !this.isGameBananaSubmissionNsfw(mod));
  }

  filterGameBananaCategorySubmissions<T extends GameBananaTopSubmission>(
    mods: T[],
  ) {
    const filter = this.getGameBananaCategoryFilterConfig();
    if (!filter) return mods;
    return mods.filter((mod) => {
      if (filter.model && mod._sModelName !== filter.model) return false;
      if (!filter.categoryId) return true;
      return this.getGameBananaSubmissionCategoryIds(mod).includes(
        filter.categoryId,
      );
    });
  }

  filterGameBananaSearchSubmissions<T extends GameBananaTopSubmission>(
    submissions: T[],
  ) {
    return submissions;
  }

  getGameBananaCategoryFilterConfig() {
    const filter = this.filters.getGameBananaCategoryFilter();
    if (filter === 'all') return null;
    const config =
      this.filters.getGameBananaCategoryFilters().find((item) => item.id === filter) ||
      null;
    if (config?.id === 'skins') {
      return {
        ...config,
        categoryId: this.filters.getGameBananaActiveSkinCategoryId(),
      };
    }
    return config;
  }

  getFilteredGameBananaFeaturedMods() {
    const source = Array.isArray(this.gameBananaFeaturedSourceMods)
      ? this.gameBananaFeaturedSourceMods
      : [];
    return this.filterGameBananaCategorySubmissions(source).slice(0, 6);
  }

  getGameBananaSubmissionCategoryIds(mod: GameBananaTopSubmission) {
    return [mod._aRootCategory?._sProfileUrl, mod._aSubCategory?._sProfileUrl]
      .map((url) => String(url || '').match(/\/cats\/(\d+)/))
      .filter((match): match is RegExpMatchArray => !!match)
      .map((match) => Number(match[1]));
  }

  cacheGameBananaSubmission(mod: GameBananaTopSubmission) {
    if (!mod?._idRow) return;

    const model = mod._sModelName || 'Mod';
    this.gameBananaSubmissionCache.set(`${model}:${mod._idRow}`, mod);
  }

  getCachedGameBananaSubmission(modelName: string, submissionId: string) {
    return this.gameBananaSubmissionCache.get(`${modelName}:${submissionId}`);
  }

  getGameBananaModelPath(modelName = 'Mod') {
    const normalized = modelName.toLowerCase();
    const paths: Record<string, string> = {
      mod: 'mods',
      sound: 'sounds',
      wip: 'wips',
      tool: 'tools',
      spray: 'sprays',
      map: 'maps',
    };

    return paths[normalized] || `${normalized}s`;
  }

  getGameBananaModelFromPath(path: string) {
    const normalized = path.toLowerCase();
    const models: Record<string, string> = {
      mods: 'Mod',
      sounds: 'Sound',
      wips: 'Wip',
      tools: 'Tool',
      sprays: 'Spray',
      maps: 'Map',
    };

    return models[normalized] || '';
  }

  getGameBananaProfileUrl(modelName: string, submissionId: string) {
    return `https://gamebanana.com/${this.getGameBananaModelPath(modelName)}/${submissionId}`;
  }

  getGameBananaInfoFromProfileUrl(url?: string) {
    if (!url) return null;

    try {
      const parsedUrl = new URL(url);
      if (!parsedUrl.hostname.includes('gamebanana.com')) return null;

      const [, section, submissionId] = parsedUrl.pathname.split('/');
      const modelName = this.getGameBananaModelFromPath(section || '');
      if (!modelName || !submissionId || !/^\d+$/.test(submissionId)) {
        return null;
      }

      return { modelName, submissionId };
    } catch (error) {
      return null;
    }
  }

  getGameBananaInfoFromFightPlannerLink(link?: string) {
    if (!link) return null;

    const match = link.match(/mmdl\/\d+,([^,]+),(\d+)/i);
    if (!match?.[1] || !match?.[2]) return null;

    return {
      modelName: match[1],
      submissionId: match[2],
    };
  }

  getGameBananaInfoFromSocialMod(mod: any) {
    const linkInfo = this.getGameBananaInfoFromFightPlannerLink(mod?.link);
    if (linkInfo) return linkInfo;

    if (mod?.modId) {
      return {
        modelName: 'Mod',
        submissionId: String(mod.modId),
      };
    }

    return null;
  }

  renderGameBananaPagination(subfeedData: GameBananaSubfeedResponse) {
    const metadata = subfeedData?._aMetadata || {};
    const isComplete = metadata._bIsComplete === true;
    const canGoBack = this.gameBananaModsPage > 1;
    const canGoNext =
      !isComplete && this.gameBananaModsPage < this.gameBananaModsTotalPages;

    return `
      <button class="social-gamebanana-page-btn" data-page-action="prev" ${canGoBack ? '' : 'disabled'}>
        <i class="bi bi-chevron-left"></i>
      </button>
      <span class="social-gamebanana-page-label">${escapeHtml(
        this.getSocialTranslation('social.pageLabel', 'Page {{current}} / {{total}}', {
          current: String(this.gameBananaModsPage),
          total: String(this.gameBananaModsTotalPages),
        }),
      )}</span>
      <button class="social-gamebanana-page-btn" data-page-action="next" ${canGoNext ? '' : 'disabled'}>
        <i class="bi bi-chevron-right"></i>
      </button>
    `;
  }

  renderGameBananaModCard(mod: GameBananaTopSubmission) {
    const name = escapeHtml(mod._sName || 'Unknown Mod');
    const url = escapeHtml(mod._sProfileUrl || '');
    const imageUrl = escapeHtml(this.getGameBananaSubmissionImage(mod));
    const creator = escapeHtml(mod._aSubmitter?._sName || 'Unknown');
    const category = escapeHtml(
      mod._aSubCategory?._sName ||
        mod._aRootCategory?._sName ||
        mod._sSingularTitle ||
        mod._sModelName ||
        'Mod',
    );
    const likes = Number(mod._nLikeCount || 0);
    const views = Number(mod._nViewCount || 0);
    const model = escapeHtml(mod._sModelName || 'Mod');
    const id = escapeHtml(mod._idRow);
    const isNsfw = this.isGameBananaSubmissionNsfw(mod);

    return `
      <article class="social-gamebanana-card social-gamebanana-card-compact" data-url="${url}" data-gb-id="${id}" data-gb-model="${model}">
        ${
          imageUrl
            ? this.renderGameBananaPreviewMedia(
                `<img src="${imageUrl}" alt="${name}" class="social-gamebanana-card-image">`,
                this.shouldBlurGameBananaPreview(isNsfw),
              )
            : '<div class="social-gamebanana-card-image social-gamebanana-image-placeholder"><i class="bi bi-image"></i></div>'
        }
        <div class="social-gamebanana-card-body">
          <p class="social-gamebanana-card-category">${category}</p>
          <h3 class="social-gamebanana-card-title">${name}</h3>
          <p class="social-gamebanana-card-creator">${escapeHtml(
            this.getSocialTranslation('social.byAuthor', 'by {{author}}', {
              author: creator,
            }),
          )}</p>
          <div class="social-gamebanana-card-footer">
            <span><i class="bi bi-hand-thumbs-up"></i> ${likes}</span>
            <span><i class="bi bi-eye"></i> ${views}</span>
            ${this.renderGameBananaDownloadStat(mod, model, id)}
            <button class="social-gamebanana-open-btn" data-url="${url}">
              <i class="bi bi-info-circle"></i>
            </button>
          </div>
        </div>
      </article>
    `;
  }

  renderGameBananaPreviewMedia(imageHtml: string, isNsfw: boolean) {
    return `
      <div class="social-gamebanana-preview-media ${isNsfw ? 'is-nsfw' : ''}">
        ${imageHtml}
        ${
          isNsfw
            ? `<div class="social-gamebanana-nsfw-overlay" aria-label="${escapeHtml(
                this.getSocialTranslation(
                  'social.nsfwPreviewBlurred',
                  'NSFW preview blurred',
                ),
              )}">
                <i class="bi bi-eye-slash"></i>
                <span>NSFW</span>
                <button class="social-gamebanana-nsfw-reveal-btn" type="button">${escapeHtml(
                  this.getSocialTranslation('social.showAnyway', 'Show anyway'),
                )}</button>
              </div>`
            : ''
        }
      </div>
    `;
  }

  shouldHideGameBananaNsfwMods() {
    return window.settingsManager?.settings?.hideNsfwDiscoverMods === true;
  }

  shouldShowGameBananaNsfwPreviews() {
    return window.settingsManager?.settings?.showNsfwDiscoverPreviews === true;
  }

  shouldBlurGameBananaPreview(isNsfw: boolean) {
    return isNsfw && !this.shouldShowGameBananaNsfwPreviews();
  }

  isGameBananaSubmissionNsfw(mod: GameBananaTopSubmission | null | undefined) {
    if (!mod) return false;

    const initialVisibility = String((mod as any)._sInitialVisibility || '')
      .trim()
      .toLowerCase();
    if (initialVisibility === 'warn' || initialVisibility === 'hide') {
      return true;
    }

    const explicitFlags = [
      mod._bIsNsfw,
      mod._bIsNSFW,
      mod._bIsAdult,
      (mod as any)._bIsMature,
      (mod as any)._bIsObscene,
    ];
    if (explicitFlags.some((value) => value === true || value === 1)) {
      return true;
    }

    const ratingFields = [
      mod._sContentRating,
      (mod as any)._sContentRatingName,
      (mod as any)._sAgeRating,
      (mod as any)._sRating,
      ...(Array.isArray(mod._aContentRatings) ? mod._aContentRatings : []),
      ...(Array.isArray(mod._aContentRating) ? mod._aContentRating : []),
      ...(Array.isArray((mod as any)._aRatings) ? (mod as any)._aRatings : []),
      ...(Array.isArray(mod._aTags) ? mod._aTags : []),
    ];

    const nsfwPattern =
      /\b(nsfw|not safe for work|adult|mature|sexual|nudity|nude|suggestive|explicit|obscene|porn|lewd|erotic)\b/i;
    const hasNsfwRating = ratingFields.some((field) =>
      nsfwPattern.test(this.stringifyGameBananaRatingField(field)),
    );

    return hasNsfwRating || mod._bHasContentRatings === true;
  }

  stringifyGameBananaRatingField(value: any): string {
    if (value == null) return '';
    if (typeof value === 'string' || typeof value === 'number') {
      return String(value);
    }
    if (Array.isArray(value)) {
      return value
        .map((item) => this.stringifyGameBananaRatingField(item))
        .join(' ');
    }
    if (typeof value === 'object') {
      return Object.values(value)
        .map((item) => this.stringifyGameBananaRatingField(item))
        .join(' ');
    }
    return '';
  }

  getGameBananaSubmissionImage(mod: GameBananaTopSubmission) {
    return this.getGameBananaSubmissionImageInfo(mod).url;
  }

  getGameBananaPreviewImages(mod: GameBananaTopSubmission) {
    const images = mod._aPreviewMedia?._aImages;
    if (!Array.isArray(images)) return [];

    return images
      .map((image) => {
        if (!image?._sBaseUrl) return null;
        const fullFile = image._sFile || image._sFile800 || image._sFile530;
        const thumbFile =
          image._sFile220 || image._sFile100 || image._sFile530 || fullFile;
        if (!fullFile) return null;

        return {
          url: `${image._sBaseUrl}/${fullFile}`,
          thumbUrl: `${image._sBaseUrl}/${thumbFile}`,
          caption: image._sCaption || '',
          width: image._wFile || image._wFile800 || image._wFile530,
          height: image._hFile || image._hFile800 || image._hFile530,
        };
      })
      .filter(Boolean) as {
      url: string;
      thumbUrl: string;
      caption: string;
      width?: number;
      height?: number;
    }[];
  }

  getGameBananaSubmissionImageInfo(mod: GameBananaTopSubmission) {
    const previewImages = mod._aPreviewMedia?._aImages || [];
    for (const image of previewImages) {
      if (!image?._sBaseUrl) continue;

      const candidates = [
        {
          file: image._sFile800,
          width: image._wFile800,
          height: image._hFile800,
        },
        {
          file: image._sFile530,
          width: image._wFile530,
          height: image._hFile530,
        },
        { file: image._sFile, width: image._wFile, height: image._hFile },
        {
          file: image._sFile220,
          width: image._wFile220,
          height: image._hFile220,
        },
      ];

      const candidate = candidates.find((item) => item.file);
      if (candidate?.file) {
        return {
          url: `${image._sBaseUrl}/${candidate.file}`,
          width: candidate.width,
          height: candidate.height,
        };
      }
    }

    return { url: mod._sImageUrl || mod._sThumbnailUrl || '' };
  }

  stripGameBananaHtml(value) {
    const container = document.createElement('div');
    container.innerHTML = value == null ? '' : String(value);

    const blockTags = new Set([
      'ARTICLE',
      'BLOCKQUOTE',
      'DIV',
      'H1',
      'H2',
      'H3',
      'H4',
      'H5',
      'H6',
      'LI',
      'OL',
      'P',
      'PRE',
      'SECTION',
      'TABLE',
      'TR',
      'UL',
    ]);
    let text = '';

    const addLineBreak = () => {
      if (text && !text.endsWith('\n')) {
        text += '\n';
      }
    };

    const appendNodeText = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent || '';
        return;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) return;

      const element = node as HTMLElement;
      const tagName = element.tagName;
      if (tagName === 'BR' || tagName === 'HR') {
        addLineBreak();
        return;
      }

      if (blockTags.has(tagName)) {
        addLineBreak();
      }

      element.childNodes.forEach(appendNodeText);

      if (blockTags.has(tagName)) {
        addLineBreak();
      }
    };

    container.childNodes.forEach(appendNodeText);

    return text
      .replace(/\u00a0/g, ' ')
      .replace(/\r\n?/g, '\n')
      .replace(/[ \t\f\v]+\n/g, '\n')
      .replace(/\n[ \t\f\v]+/g, '\n')
      .replace(/[ \t\f\v]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  getGameBananaSubmissionDescription(
    details: any,
    fallback?: GameBananaTopSubmission,
  ) {
    const rawDescription =
      details?._sText ||
      details?._sDescription ||
      details?._sSummary ||
      details?._aProfile?._sText ||
      details?._aProfile?._sDescription ||
      details?._aPreviewMedia?._aMetadata?._sSnippet ||
      fallback?._sDescription ||
      fallback?._aPreviewMedia?._aMetadata?._sSnippet ||
      '';

    return this.stripGameBananaHtml(rawDescription);
  }

  getGameBananaSubmissionDate(mod: GameBananaTopSubmission) {
    if (!mod._tsDateAdded) return '';

    try {
      return new Date(mod._tsDateAdded * 1000).toLocaleDateString();
    } catch (e) {
      return '';
    }
  }

  async confirmMissingGameBananaRequirements(downloadUrl = '') {
    const shouldCheckDependencies =
      await this.shouldCheckGameBananaDependenciesOnDownload();
    if (!shouldCheckDependencies) return Promise.resolve(true);

    let dependencyCheckFinished = false;
    let slowCheckModal: HTMLElement | null = null;
    let disableCurrentCheck: (() => void) | null = null;
    const dependencyChecksDisabled = new Promise<'disabled'>((resolve) => {
      disableCurrentCheck = () => resolve('disabled');
    });
    const slowCheckTimer = window.setTimeout(() => {
      if (dependencyCheckFinished || !window.modalManager?.showCustomModal) {
        return;
      }

      slowCheckModal = window.modalManager.showCustomModal({
        id: 'social-slow-dependency-check-modal',
        title: this.getSocialTranslation(
          'social.slowDependencyCheckTitle',
          'Dependency check is taking longer than expected',
        ),
        body: `<p>${escapeHtml(
          this.getSocialTranslation(
            'social.slowDependencyCheckMessage',
            'You can disable dependency checks to speed up downloads and improve responsiveness. MOSAIC will no longer warn about missing requirements before downloading.',
          ),
        )}</p>`,
        buttons: [
          {
            text: this.getSocialTranslation(
              'social.keepDependencyCheck',
              'Keep checking',
            ),
            type: 'secondary',
          },
          {
            text: this.getSocialTranslation(
              'social.disableDependencyCheck',
              'Disable checks',
            ),
            type: 'primary',
            onClick: async () => {
              await this.disableGameBananaDependencyChecks();
              disableCurrentCheck?.();
            },
          },
        ],
      });
    }, 20000);

    const requirementsPromise = this.requirements.getGameBananaReadmeRequirements(
      downloadUrl,
    ).then((requirements) => ({ type: 'requirements' as const, requirements }));

    const dependencyCheckResult = await Promise.race([
      requirementsPromise,
      dependencyChecksDisabled.then(() => ({ type: 'disabled' as const })),
    ]).finally(() => {
      dependencyCheckFinished = true;
      window.clearTimeout(slowCheckTimer);
      if (slowCheckModal?.isConnected) {
        const modalToClose = slowCheckModal;
        window.modalManager.closeModal(modalToClose, {
          onModalClosed: () => modalToClose.remove(),
        });
      }
    });

    if (dependencyCheckResult.type === 'disabled') {
      return Promise.resolve(true);
    }

    const readmeRequirements = dependencyCheckResult.requirements;
    const missingRequirements =
      this.requirements.getMissingGameBananaRequirements(readmeRequirements);
    if (!missingRequirements.length) return Promise.resolve(true);

    if (!window.modalManager?.showCustomModal) {
      return Promise.resolve(
        window.confirm(
          `This mod has ${missingRequirements.length} missing or disabled requirement(s). Continue anyway?`,
        ),
      );
    }

    const items = missingRequirements
      .map((requirement) => {
        const source = requirement.marketplacePlugin
          ? 'Available in marketplace'
          : 'Manual install needed';

        return `
          <li class="social-gamebanana-missing-requirement">
            <strong>${escapeHtml(requirement.name)}</strong>
            <span>${escapeHtml(requirement.reason)} - ${source}</span>
          </li>
        `;
      })
      .join('');

    return new Promise<boolean>((resolve) => {
      let settled = false;
      const settle = (value: boolean) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      window.modalManager.showCustomModal({
        id: 'social-gamebanana-requirements-warning-modal',
        title: 'Missing requirements',
        body: `
          <div class="social-gamebanana-requirements-warning">
            <p>This mod lists requirements that are not currently active in your plugins folder.</p>
            <ul>${items}</ul>
            <p>You can continue, but the mod may crash or not work correctly until these dependencies are installed and enabled.</p>
          </div>
        `,
        size: 'normal',
        clickOverlayToClose: false,
        escapeToClose: false,
        onClose: () => settle(false),
        buttons: [
          {
            text: 'Cancel',
            type: 'secondary',
            onClick: () => settle(false),
          },
          {
            text: 'Continue anyway',
            type: 'primary',
            onClick: () => settle(true),
          },
        ],
      });
    });
  }

  async shouldCheckGameBananaDependenciesOnDownload() {
    const settingsValue =
      window.settingsManager?.settings?.checkDependenciesOnDiscoverDownload;
    if (typeof settingsValue === 'boolean') {
      return settingsValue;
    }

    try {
      const storedValue = await window.electronAPI?.store?.get?.(
        'checkDependenciesOnDiscoverDownload',
      );
      return storedValue !== false;
    } catch (error) {
      console.warn('[Social] Failed to read dependency check setting:', error);
      return true;
    }
  }

  async disableGameBananaDependencyChecks() {
    if (window.settingsManager?.settings) {
      window.settingsManager.settings.checkDependenciesOnDiscoverDownload =
        false;
    }

    const toggle = document.querySelector<HTMLInputElement>(
      '#check-dependencies-on-discover-download-enabled',
    );
    if (toggle) toggle.checked = false;

    try {
      await window.electronAPI?.store?.set?.(
        'checkDependenciesOnDiscoverDownload',
        false,
      );
    } catch (error) {
      console.warn('[Social] Failed to disable dependency checks:', error);
    }
  }

  async showGameBananaSubmissionDetails(
    modelName: string,
    submissionId: string,
    sourceCard?: HTMLElement,
    sourceRectOverride?: DOMRect | null,
  ) {
    const requestId = ++this.gameBananaDetailRequestId;
    const modId = /^\d+$/.test(submissionId) ? Number(submissionId) : 0;
    this.gameBananaUmcState =
      modelName.toLowerCase() === 'mod' &&
      Number.isInteger(modId) &&
      modId > 0 &&
      modId <= 2147483647
        ? { key: `Mod/${modId}`, modId, status: 'loading', movesets: [] }
        : null;
    const fallback =
      this.getCachedGameBananaSubmission(modelName, submissionId) || null;
    const sourceRect =
      sourceRectOverride || this.transitions.getGameBananaSourcePreviewRect(sourceCard);

    if (fallback) {
      this.detail.renderGameBananaDetailPage(null, fallback, false, [], true);
      this.transitions.scrollGameBananaDetailToTop();
      this.transitions.animateGameBananaPreviewToDetail(sourceCard, sourceRect);
      void this.detail.loadGameBananaUmc(requestId);
      await this.transitions.fadeGameBananaDetailInfo('in');
    } else {
      this.detail.renderGameBananaDetailPage(null, fallback, true);
      this.transitions.scrollGameBananaDetailToTop();
      void this.detail.loadGameBananaUmc(requestId);
      await this.transitions.fadeGameBananaDetailInfo('in');
    }

    try {
      if (requestId !== this.gameBananaDetailRequestId) return;
      const [detailsResult, filesResult] = await Promise.all([
        window.electronAPI?.fetchGameBananaDetails
          ? window.electronAPI.fetchGameBananaDetails(modelName, submissionId)
          : Promise.resolve(null),
        window.electronAPI?.fetchGameBananaFiles
          ? window.electronAPI.fetchGameBananaFiles(modelName, submissionId)
          : Promise.resolve(null),
      ]);

      if (requestId !== this.gameBananaDetailRequestId) return;

      let detailData: any = null;
      let filesData: GameBananaFileEntry[] = [];
      if (detailsResult?.success) {
        detailData = detailsResult.data;
      } else if (detailsResult) {
        console.warn(
          '[Social] Failed to fetch GameBanana details:',
          detailsResult,
        );
      }

      if (filesResult?.success && Array.isArray(filesResult.files)) {
        filesData = filesResult.files;
      } else if (filesResult) {
        console.warn('[Social] Failed to fetch GameBanana files:', filesResult);
      }

      if (fallback && this.gameBananaPreviewAnimation) {
        await this.gameBananaPreviewAnimation;
      }

      if (requestId !== this.gameBananaDetailRequestId) return;
      await this.requirements.refreshSkylineDependencyStatus();
      if (requestId !== this.gameBananaDetailRequestId) return;
      this.detail.renderGameBananaDetailPage(detailData, fallback, false, filesData);
      this.transitions.scrollGameBananaDetailToTop();
      if (!fallback) {
        this.transitions.animateGameBananaPreviewToDetail(sourceCard, sourceRect);
      }
      await this.transitions.fadeGameBananaDetailInfo('in');
    } catch (error) {
      if (requestId !== this.gameBananaDetailRequestId) return;
      console.error('[Social] Error loading GameBanana details:', error);
      this.detail.renderGameBananaDetailPage(null, fallback, false);
      this.transitions.scrollGameBananaDetailToTop();
      if (!fallback) {
        this.transitions.animateGameBananaPreviewToDetail(sourceCard, sourceRect);
      }
      await this.transitions.fadeGameBananaDetailInfo('in');
    }
  }

  animateGameBananaFeaturedCards(direction: number) {
    const gsapRef = window.gsap;
    const cards = Array.from(
      document.querySelectorAll<HTMLElement>(
        '#social-gamebanana-carousel .social-gamebanana-card-featured',
      ),
    );

    if (!gsapRef || cards.length === 0) {
      this.featured.setGameBananaFeaturedCardPositions();
      return;
    }

    if (this.gameBananaFeaturedTimeline) {
      this.gameBananaFeaturedTimeline.kill();
    }

    this.gameBananaFeaturedTimeline = gsapRef.timeline({
      defaults: {
        duration: 0.48,
        ease: 'power3.out',
        overwrite: 'auto',
      },
      onComplete: () => {
        cards.forEach((card) => card.classList.remove('was-active'));
        this.gameBananaFeaturedTimeline = null;
      },
    });

    cards.forEach((card) => {
      const position = card.getAttribute('data-featured-position') || 'hidden';
      const state = this.featured.getGameBananaFeaturedCardState(position);

      gsapRef.set(card, { zIndex: state.zIndex });

      this.gameBananaFeaturedTimeline.to(
        card,
        {
          xPercent: state.xPercent,
          x: state.x,
          y: state.y,
          scale: state.scale,
          rotationY: state.rotationY,
          autoAlpha: state.autoAlpha,
          filter: state.filter,
          duration: position === 'hidden' ? 0.34 : 0.5,
          ease: 'power3.out',
        },
        0,
      );
    });

    void direction;
  }
}
