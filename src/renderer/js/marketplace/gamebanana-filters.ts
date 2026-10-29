class GameBananaFiltersSection {
  manager: SocialGameBananaManager;

  constructor(manager: SocialGameBananaManager) {
    this.manager = manager;
  }

  renderGameBananaSearchControl() {
    const query = escapeHtml(this.manager.gameBananaSearchQuery);

    return `
      <label class="social-gamebanana-search" for="social-gamebanana-search-input">
        <i class="bi bi-search"></i>
        <input id="social-gamebanana-search-input" type="search" value="${query}" placeholder="${escapeHtml(
          this.manager.getSocialTranslation(
            'social.searchGameBananaMods',
            'Search GameBanana mods',
          ),
        )}" autocomplete="off">
      </label>
    `;
  }

  renderGameBananaSortControl() {
    const activeSort = this.getGameBananaDiscoverSort();
    const options: {
      id: GameBananaDiscoverSort;
      label: string;
      icon: string;
    }[] = [
      {
        id: 'recent',
        label: this.manager.getSocialTranslation('social.sortRecent', 'Recent'),
        icon: 'clock-history',
      },
      {
        id: 'popularity',
        label: this.manager.getSocialTranslation(
          'social.sortPopularity',
          'Popularity',
        ),
        icon: 'hand-thumbs-up',
      },
      {
        id: 'downloads',
        label: this.manager.getSocialTranslation('social.sortDownloads', 'Downloads'),
        icon: 'download',
      },
    ];

    return `
      <div class="custom-select social-gamebanana-sort" id="social-gamebanana-sort-select" role="button" tabindex="0" aria-label="${escapeHtml(
        this.manager.getSocialTranslation(
          'social.sortDiscoverMods',
          'Sort Discover mods',
        ),
      )}">
        <div class="custom-select-trigger">
          <span class="selected-value">
            ${escapeHtml(options.find((option) => option.id === activeSort)?.label || 'Recent')}
          </span>
          <i class="bi bi-chevron-down"></i>
        </div>
        <div class="custom-select-dropdown">
          ${options
            .map(
              (option) => `
                <div class="custom-select-option ${activeSort === option.id ? 'active' : ''}" data-sort-value="${option.id}">
                  <i class="bi bi-${option.icon}"></i>
                  <span>${option.label}</span>
                </div>
              `,
            )
            .join('')}
        </div>
      </div>
    `;
  }

  renderGameBananaCategoryFilters() {
    const activeFilter = this.getGameBananaCategoryFilter();

    return `
      <div id="social-gamebanana-category-filter-area">
        <div class="social-gamebanana-category-filters" aria-label="${escapeHtml(
          this.manager.getSocialTranslation(
            'social.discoverCategoryFilters',
            'Discover category filters',
          ),
        )}">
          ${this.getGameBananaCategoryFilters()
            .map((filter) => this.renderGameBananaCategoryFilterButton(filter))
            .join('')}
        </div>
        ${this.renderGameBananaSkinSubcategoryFilters()}
      </div>
    `;
  }

  renderGameBananaCategoryFilterButton(filter: any) {
    const activeFilter = this.getGameBananaCategoryFilter();
    const isActive = activeFilter === filter.id;
    const showSkinToggle = filter.id === 'skins' && isActive;

    return `
      <button class="social-gamebanana-category-filter ${isActive ? 'is-active' : ''}" type="button" data-category-filter="${filter.id}">
        <span>${filter.label}</span>
        ${
          showSkinToggle
            ? `<i class="bi bi-chevron-${this.manager.gameBananaSkinSubcategoryOpen ? 'up' : 'down'} social-gamebanana-skins-toggle" aria-hidden="true"></i>`
            : ''
        }
      </button>
    `;
  }

  renderGameBananaSkinSubcategoryFilters() {
    if (
      this.getGameBananaCategoryFilter() !== 'skins' ||
      !this.manager.gameBananaSkinSubcategoryOpen
    ) {
      return '';
    }

    if (!Array.isArray(this.manager.gameBananaSkinSubcategories)) {
      return `
        <div class="social-gamebanana-subcategory-filters">
          <span class="social-gamebanana-subcategory-loading">${escapeHtml(
            this.manager.getSocialTranslation(
              'social.loadingSkins',
              'Loading skins...',
            ),
          )}</span>
        </div>
      `;
    }

    const selectedId = this.getGameBananaActiveSkinCategoryId();
    const buttons = [
      {
        _idRow: 3330,
        _sName: this.manager.getSocialTranslation('social.allSkins', 'All skins'),
      },
      ...this.manager.gameBananaSkinSubcategories,
    ];

    return `
      <div class="social-gamebanana-subcategory-filters social-gamebanana-skin-picker" aria-label="${escapeHtml(
        this.manager.getSocialTranslation(
          'social.skinSubcategoryFilters',
          'Skin subcategory filters',
        ),
      )}">
        <label class="social-gamebanana-skin-picker-label" for="social-gamebanana-skin-select">${escapeHtml(
          this.manager.getSocialTranslation('social.character', 'Character'),
        )}</label>
        <select id="social-gamebanana-skin-select" class="social-gamebanana-skin-select">
          ${buttons
            .map((category) => {
              const id = Number(category._idRow);
              return `
                <option value="${id}" ${selectedId === id ? 'selected' : ''}>
                  ${escapeHtml(category._sName || 'Skins')}
                </option>
              `;
            })
            .join('')}
        </select>
      </div>
    `;
  }

  getGameBananaCategoryFilters() {
    return [
      { id: 'all', label: this.manager.getSocialTranslation('social.all', 'All') },
      {
        id: 'skins',
        label: this.manager.getSocialTranslation('social.skins', 'Skins'),
        model: 'Mod',
        categoryId: 3330,
      },
      {
        id: 'stages',
        label: this.manager.getSocialTranslation('social.stages', 'Stages'),
        model: 'Mod',
        categoryId: 6089,
      },
      {
        id: 'sounds',
        label: this.manager.getSocialTranslation('social.sounds', 'Sounds'),
        model: 'Sound',
      },
      {
        id: 'effects',
        label: this.manager.getSocialTranslation('social.effects', 'Effects'),
        model: 'Mod',
        categoryId: 1177,
      },
      {
        id: 'gameplay',
        label: this.manager.getSocialTranslation('social.gameplay', 'Gameplay'),
        model: 'Mod',
        categoryId: 26521,
      },
      { id: 'ui', label: 'UI', model: 'Mod', categoryId: 1760 },
      {
        id: 'tools',
        label: this.manager.getSocialTranslation('social.tools', 'Tools'),
        model: 'Tool',
      },
      {
        id: 'wips',
        label: this.manager.getSocialTranslation('social.wips', 'WiPs'),
        model: 'Wip',
      },
    ];
  }

  getGameBananaCategoryFilter() {
    return this.manager.gameBananaCategoryFilter || 'all';
  }

  async setGameBananaCategoryFilter(filter: string) {
    const validFilter = this.getGameBananaCategoryFilters().some(
      (item) => item.id === filter,
    )
      ? filter
      : 'all';
    if (validFilter === this.getGameBananaCategoryFilter()) return;
    this.manager.gameBananaCategoryFilter = validFilter;
    if (validFilter !== 'skins') {
      this.manager.gameBananaSkinSubcategoryOpen = false;
      this.manager.gameBananaSkinSubcategoryId = null;
    }
    this.manager.gameBananaModsTotalPages = 1;

    this.refreshGameBananaCategoryFilterUI();
    this.refreshGameBananaFilteredContent();
    await this.manager.loadGameBananaModsPage(1, this.manager.gameBananaSearchQuery);
  }

  async toggleGameBananaSkinSubcategories() {
    if (this.getGameBananaCategoryFilter() !== 'skins') {
      await this.setGameBananaCategoryFilter('skins');
    }

    this.manager.gameBananaSkinSubcategoryOpen = !this.manager.gameBananaSkinSubcategoryOpen;
    this.refreshGameBananaCategoryFilterUI();

    if (
      this.manager.gameBananaSkinSubcategoryOpen &&
      !Array.isArray(this.manager.gameBananaSkinSubcategories)
    ) {
      await this.loadGameBananaSkinSubcategories();
      this.refreshGameBananaCategoryFilterUI();
    }
  }

  async setGameBananaSkinSubcategory(categoryId: number) {
    const nextCategoryId = Number.isFinite(categoryId) ? categoryId : 3330;
    this.manager.gameBananaSkinSubcategoryId =
      nextCategoryId === 3330 ? null : nextCategoryId;
    this.manager.gameBananaModsTotalPages = 1;
    this.refreshGameBananaCategoryFilterUI();
    this.refreshGameBananaFilteredContent();
    await this.manager.loadGameBananaModsPage(1, this.manager.gameBananaSearchQuery);
  }

  getGameBananaDiscoverSort() {
    const sort = this.manager.gameBananaDiscoverSort;
    return sort === 'popularity' || sort === 'downloads' ? sort : 'recent';
  }

  getGameBananaApiSort() {
    const sort = this.getGameBananaDiscoverSort();
    const apiSorts: Record<GameBananaDiscoverSort, string> = {
      recent: 'Generic_Newest',
      popularity: 'Generic_MostLiked',
      downloads: 'Generic_MostDownloaded',
    };

    return apiSorts[sort];
  }

  async setGameBananaDiscoverSort(sort: string) {
    const nextSort =
      sort === 'popularity' || sort === 'downloads' ? sort : 'recent';
    if (nextSort === this.getGameBananaDiscoverSort()) return;

    this.manager.gameBananaDiscoverSort = nextSort;
    this.refreshGameBananaSortControlUI();
    this.manager.gameBananaModsTotalPages = 1;
    await this.manager.loadGameBananaModsPage(1, this.manager.gameBananaSearchQuery);
  }

  refreshGameBananaSortControlUI() {
    const sortSelect = document.querySelector<HTMLElement>(
      '#social-gamebanana-sort-select',
    );
    if (!sortSelect) return;

    const activeSort = this.getGameBananaDiscoverSort();
    const selectedOption = sortSelect.querySelector<HTMLElement>(
      `.custom-select-option[data-sort-value="${activeSort}"]`,
    );
    const selectedValue =
      sortSelect.querySelector<HTMLElement>('.selected-value');
    const selectedText =
      selectedOption?.querySelector<HTMLElement>('span')?.textContent ||
      'Recent';

    if (selectedValue) {
      selectedValue.textContent = selectedText;
    }

    sortSelect
      .querySelectorAll<HTMLElement>('.custom-select-option')
      .forEach((option) => {
        option.classList.toggle(
          'active',
          option.getAttribute('data-sort-value') === activeSort,
        );
      });
  }

  async loadGameBananaSkinSubcategories() {
    try {
      const response = await fetch(
        `${this.manager.GAMEBANANA_API_URL}/Util/ModCategory/NestedStructure?_idGameRow=6498`,
      );
      const categories = await response.json();
      if (!response.ok || !Array.isArray(categories)) {
        throw new Error(`GameBanana category tree failed: ${response.status}`);
      }

      const skinsCategory = categories.find(
        (category) => Number(category?._idRow) === 3330,
      );
      const children = Array.isArray(skinsCategory?._aChildren)
        ? skinsCategory._aChildren
        : [];
      this.manager.gameBananaSkinSubcategories = children
        .filter((category) => Number(category?._nItemCount || 0) > 0)
        .sort((a, b) =>
          String(a._sName || '').localeCompare(String(b._sName || '')),
        );
    } catch (error) {
      console.error(
        '[Social] Error loading GameBanana skin categories:',
        error,
      );
      this.manager.gameBananaSkinSubcategories = [];
    }
  }

  refreshGameBananaCategoryFilterUI() {
    const filterArea = document.querySelector<HTMLElement>(
      '#social-gamebanana-category-filter-area',
    );
    if (filterArea) {
      filterArea.outerHTML = this.renderGameBananaCategoryFilters();
    }
  }

  getGameBananaActiveSkinCategoryId() {
    return this.manager.gameBananaSkinSubcategoryId || 3330;
  }

  refreshGameBananaFilteredContent() {
    this.manager.gameBananaFeaturedMods = this.manager.getFilteredGameBananaFeaturedMods();
    this.manager.gameBananaFeaturedIndex = 0;

    const carousel = document.querySelector<HTMLElement>(
      '#social-gamebanana-carousel',
    );
    if (carousel) {
      carousel.innerHTML = this.manager.featured.renderGameBananaFeaturedStack();
      this.manager.featured.setGameBananaFeaturedCardPositions();
    }

    const modsContent = document.querySelector<HTMLElement>(
      '#social-gamebanana-mods-content',
    );
    if (modsContent && this.manager.gameBananaCurrentSubfeedData) {
      modsContent.innerHTML = this.manager.renderGameBananaModsPage(
        this.manager.gameBananaCurrentSubfeedData,
      );
      this.manager.hydrateVisibleGameBananaDownloadCounts();
    }
  }

  setupGameBananaSearchEvents() {
    this.manager.setupGameBananaClickFallbackEvents();
    if (this.manager.gameBananaSearchListenerBound) return;
    this.manager.gameBananaSearchListenerBound = true;

    const setSearchFocusState = (input: HTMLInputElement, focused: boolean) => {
      const discoverContent = input.closest<HTMLElement>(
        '#social-discover-content',
      );
      if (!discoverContent) return;

      const hasQuery = input.value.trim().length > 0;
      discoverContent.classList.toggle(
        'is-searching-gamebanana',
        focused || hasQuery,
      );
    };

    document.addEventListener('focusin', (event) => {
      const input = event.target as HTMLInputElement;
      if (input?.id !== 'social-gamebanana-search-input') return;

      setSearchFocusState(input, true);
    });

    document.addEventListener('focusout', (event) => {
      const input = event.target as HTMLInputElement;
      if (input?.id !== 'social-gamebanana-search-input') return;

      setSearchFocusState(input, false);
    });

    document.addEventListener('input', (event) => {
      const input = event.target as HTMLInputElement;
      if (input?.id !== 'social-gamebanana-search-input') return;

      setSearchFocusState(input, document.activeElement === input);

      const query = input.value;
      if (this.manager.gameBananaSearchDebounce) {
        clearTimeout(this.manager.gameBananaSearchDebounce);
      }

      this.manager.gameBananaSearchDebounce = setTimeout(() => {
        this.manager.loadGameBananaModsPage(1, query);
      }, 350);
    });

    document.addEventListener('change', (event) => {
      const select = event.target as HTMLSelectElement;
      if (select?.id === 'social-gamebanana-skin-select') {
        void this.setGameBananaSkinSubcategory(Number(select.value));
      }
    });

    document.addEventListener('keydown', (event) => {
      const target = event.target as HTMLElement;
      const sortSelect = target?.closest<HTMLElement>(
        '.social-gamebanana-sort',
      );
      if (!sortSelect || !['Enter', ' '].includes(event.key)) return;

      event.preventDefault();
      sortSelect.classList.toggle('open');
    });

    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      document
        .querySelectorAll<HTMLElement>('.social-gamebanana-sort.open')
        .forEach((sortSelect) => {
          if (!sortSelect.contains(target)) {
            sortSelect.classList.remove('open');
          }
        });
    });
  }
}
