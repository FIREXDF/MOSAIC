class CharactersMovesetsSection {
  manager: Window['charactersManager'];
  private umcMovesetRequests = new Map<
    string,
    { expires: number; request: Promise<UmcGameBananaMoveset[]> }
  >();

  constructor(manager: Window['charactersManager']) {
    this.manager = manager;
  }

  modPathHasMoveset(modPath: string) {
    return [...this.manager.movesetCharacters.values()].some((character) =>
      character.mods.some((mod) => mod.path === modPath),
    );
  }

  detectMovesetLibraryChanges(
    changedPaths: string[],
    addedPaths: string[] = [],
  ) {
    const addedPathSet = new Set(addedPaths);
    const existingChangedPaths = changedPaths.filter(
      (modPath) => !addedPathSet.has(modPath),
    );
    if (this.manager.initialized && existingChangedPaths.length > 0) {
      this.manager.queueIncrementalRefresh(existingChangedPaths);
    }

    addedPaths.forEach((modPath) => this.markMovesetsStale(modPath));

    const currentPaths = new Set(
      (window.modManager?.mods || []).map((mod) => mod.path),
    );
    this.manager.staleMovesetModPaths.forEach((modPath) => {
      if (!currentPaths.has(modPath)) {
        this.manager.staleMovesetModPaths.delete(modPath);
      }
    });
    this.renderMovesetRefreshNotice();
  }

  markMovesetsStale(modPath: string) {
    this.manager.staleMovesetModPaths.add(modPath);
    this.renderMovesetRefreshNotice();
    document
      .querySelector<HTMLElement>('#character-movesets-refresh-notice')
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  renderMovesetRefreshNotice() {
    const notice = document.querySelector<HTMLElement>(
      '#character-movesets-refresh-notice',
    );
    if (!notice) {
      return;
    }

    notice.hidden = this.manager.staleMovesetModPaths.size === 0;
    const button = notice.querySelector<HTMLButtonElement>(
      '#character-movesets-refresh-btn',
    );
    if (button) {
      button.disabled = this.manager.isRefreshingMovesets;
      button.classList.toggle('is-loading', this.manager.isRefreshingMovesets);
      button.setAttribute('aria-busy', String(this.manager.isRefreshingMovesets));
      const icon = button.querySelector('i');
      if (icon) {
        icon.className = this.manager.isRefreshingMovesets
          ? 'bi bi-arrow-repeat'
          : 'bi bi-arrow-clockwise';
      }
      const label = this.manager.t(
        this.manager.isRefreshingMovesets
          ? 'characters.refreshingMovesets'
          : 'characters.refreshMovesets',
        this.manager.isRefreshingMovesets ? 'Refreshing...' : 'Refresh Movesets',
      );
      const labelElement = button.querySelector<HTMLElement>(
        'span[data-i18n="characters.refreshMovesets"]',
      );
      if (labelElement) {
        labelElement.textContent = label;
      }
    }
  }

  async refreshMovesets() {
    if (this.manager.isRefreshingMovesets) {
      return;
    }

    this.manager.isRefreshingMovesets = true;
    this.renderMovesetRefreshNotice();

    try {
      await this.manager.incrementalRefreshPromise;
      await this.manager.refresh();
    } finally {
      this.manager.isRefreshingMovesets = false;
      this.renderMovesetRefreshNotice();
    }
  }

  isMovesetModInfo(modInfo: any, fallbackName: string) {
    if (!modInfo) {
      return false;
    }

    const searchableInfo = [
      modInfo.category,
      modInfo.display_name,
      modInfo.s_name,
      modInfo.description,
      fallbackName,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return searchableInfo.includes('moveset');
  }

  addMovesetModForCharacter(fighterId: string, mod: CharacterMovesetMod) {
    const charInfo = window.SSBU_CHARACTERS?.[fighterId];
    if (!charInfo) {
      return;
    }

    if (!this.manager.movesetCharacters.has(fighterId)) {
      this.manager.movesetCharacters.set(fighterId, {
        id: fighterId,
        info: charInfo,
        mods: [],
      });
    }

    const group = this.manager.movesetCharacters.get(fighterId);
    if (!group) {
      return;
    }

    if (!group.mods.some((entry) => entry.path === mod.path)) {
      group.mods.push(mod);
    }
  }

  openMovesetTracker() {
    const browserView = document.querySelector<HTMLElement>(
      '#characters-browser-view',
    );
    const movesetsView = document.querySelector<HTMLElement>(
      '#character-movesets-view',
    );

    if (!browserView || !movesetsView) {
      return;
    }

    this.renderMovesetTracker();
    this.manager.switchCharacterView(
      this.manager.getActiveCharacterSubview(),
      movesetsView,
      'forward',
    );
  }

  closeMovesetTracker() {
    const browserView = document.querySelector<HTMLElement>(
      '#characters-browser-view',
    );
    const movesetsView = document.querySelector<HTMLElement>(
      '#character-movesets-view',
    );

    if (!browserView || !movesetsView) {
      return;
    }

    this.manager.switchCharacterView(movesetsView, browserView, 'back');
  }

  renderMovesetTracker() {
    const list = document.querySelector<HTMLElement>(
      '#character-movesets-list',
    );
    const count = document.querySelector<HTMLElement>(
      '#character-movesets-count',
    );
    if (!list) {
      return;
    }

    const wasAtTop = list.scrollTop <= 24;
    const movesetGroups = Array.from(this.manager.movesetCharacters.values()).sort(
      (a, b) => {
        const numA = parseFloat(a.info.number.replace('ε', '.5'));
        const numB = parseFloat(b.info.number.replace('ε', '.5'));
        return numA - numB;
      },
    );
    const totalMovesets = movesetGroups.reduce(
      (total, character) => total + character.mods.length,
      0,
    );

    if (count) {
      count.textContent = this.manager.t(
        'characters.movesetModCount',
        `${totalMovesets} moveset mod${totalMovesets !== 1 ? 's' : ''}`,
        { count: String(totalMovesets) },
      );
    }
    this.renderMovesetRefreshNotice();

    if (movesetGroups.length === 0) {
      list.innerHTML = `
<div class="characters-empty-state character-movesets-empty">
<i class="bi bi-controller"></i>
<h3>${this.manager.t('characters.noMovesetMods', 'No moveset mods found')}</h3>
<p>${this.manager.t('characters.noMovesetModsHint', "Moveset mods show here when a character mod's info.toml says moveset.")}</p>
</div>
`;
      if (wasAtTop) {
        list.scrollTop = 0;
      }
      return;
    }

    list.innerHTML = movesetGroups
      .map((character) => this.renderMovesetCharacterGroup(character))
      .join('');

    list
      .querySelectorAll<HTMLElement>('.character-moveset-group')
      .forEach((element, index) => {
        void this.loadMovesetImages(movesetGroups[index], element);
      });

    list.querySelectorAll<HTMLElement>('[data-mod-path]').forEach((item) => {
      item.addEventListener('click', () => {
        this.manager.openModInToolsTab(item.dataset.modPath);
      });
      item.addEventListener('contextmenu', (event) => {
        this.manager.showModContextMenu(event, item.dataset.modPath);
      });
    });

    list
      .querySelectorAll<HTMLButtonElement>('[data-add-moveset-css]')
      .forEach((button) => {
        button.addEventListener('click', (event) => {
          event.stopPropagation();
          const characterId = button.dataset.addMovesetCss;
          if (!characterId) {
            return;
          }
          void this.manager.cssEditor.openAddMovesetToCssFlow(characterId);
        });
      });

    if (wasAtTop) {
      list.scrollTop = 0;
    }
  }

  renderMovesetCharacterGroup(character: CharacterMovesetGroup) {
    const imageUrl =
      window.CHARACTER_IMAGES[character.id] ||
      'https://www.smashbros.com/assets_v2/img/fighter/mario/main.png';
    const escapedName = escapeHtml(character.info.name);

    return `
<section class="character-moveset-group">
<div class="character-moveset-character">
<div class="character-moveset-image-frame">
<img src="${imageUrl}" alt="${escapedName}" onerror="this.manager.hidden=true; this.manager.nextElementSibling.hidden=false;">
<i class="bi bi-person-circle" hidden></i>
</div>
<div>
<strong>${escapedName}</strong>
<span>#${escapeHtml(character.info.number)} · ${character.mods.length} moveset mod${character.mods.length !== 1 ? 's' : ''}</span>
<span class="character-moveset-umc-loading" role="status" hidden>
<i class="bi bi-arrow-repeat character-umc-spinner" aria-hidden="true"></i>
${escapeHtml(this.manager.t('characters.umcImagesLoading', 'Loading images from UMC...'))}
</span>
</div>
<button class="input-btn character-moveset-add-css-btn" type="button" data-add-moveset-css="${escapeHtml(character.id)}">
<i class="bi bi-plus-square"></i>
<span>Add to CSS</span>
</button>
</div>
<div class="character-moveset-mods">
${character.mods.map((mod) => this.renderMovesetModRow(mod)).join('')}
</div>
</section>
`;
  }

  renderMovesetModRow(mod: CharacterMovesetMod) {
    const description = mod.description
      ? `<span class="character-moveset-description">${escapeHtml(mod.description)}</span>`
      : '';
    const category = mod.category
      ? `<span class="character-moveset-category">${escapeHtml(mod.category)}</span>`
      : '';
    const slotBadges =
      mod.slots.length > 0
        ? mod.slots
            .map(
              (slot) =>
                `<span class="character-moveset-slot">${escapeHtml(slot)}</span>`,
            )
            .join('')
        : '<span class="character-moveset-slot is-unknown">Slot unknown</span>';

    return `
<button class="character-moveset-mod ${mod.status}" type="button" data-mod-path="${escapeHtml(mod.path)}" title="${escapeHtml(this.manager.t('characters.modActionsHint', 'Right-click for mod actions'))}">
<span class="mod-status-dot"></span>
<span class="character-moveset-mod-main">
<span class="character-moveset-mod-name-row">
<strong>${escapeHtml(mod.name)}</strong>
${this.manager.renderModStatus(mod.status)}
</span>
${description}
</span>
<span class="character-moveset-slots" aria-label="Detected moveset slots">
${slotBadges}
</span>
${category}
<i class="bi bi-arrow-right-circle"></i>
</button>
`;
  }

  getGameBananaModId(value: unknown): number | null {
    if (typeof value !== 'string') return null;
    try {
      const url = new URL(value.trim());
      if (
        !['https:', 'http:'].includes(url.protocol) ||
        !['gamebanana.com', 'www.gamebanana.com'].includes(url.hostname)
      )
        return null;
      const match = url.pathname.match(/^\/mods\/(\d+)\/?$/);
      const id = match ? Number(match[1]) : 0;
      return Number.isInteger(id) && id > 0 && id <= 2147483647 ? id : null;
    } catch {
      return null;
    }
  }

  getUmcMovesets(
    modId: number,
    includeDetails = false,
  ): Promise<UmcGameBananaMoveset[]> {
    const key = `${modId}:${includeDetails ? 'details' : 'summary'}`;
    const cached = this.umcMovesetRequests.get(key);
    if (cached && cached.expires > Date.now()) return cached.request;
    const entry = {
      expires: Date.now() + 10 * 60_000,
      request: Promise.resolve([] as UmcGameBananaMoveset[]),
    };
    entry.request = (async () => {
      try {
        const result = await window.electronAPI.getUmcMovesetsByGameBanana(
          modId,
          includeDetails,
        );
        if (result.success) return result.movesets;
      } catch (error) {
        console.warn('[CharactersManager] UMC image lookup failed:', error);
      }
      entry.expires = Date.now() + 20_000;
      return [];
    })();
    if (this.umcMovesetRequests.size >= 300) {
      this.umcMovesetRequests.delete(
        this.umcMovesetRequests.keys().next().value!,
      );
    }
    this.umcMovesetRequests.set(key, entry);
    return entry.request;
  }

  async loadMovesetImages(
    character: CharacterMovesetGroup,
    element: HTMLElement,
  ) {
    if (!character.mods.some((mod) => mod.gameBananaId)) return;
    const spinner = element.querySelector<HTMLElement>(
      '.character-moveset-umc-loading',
    );
    if (spinner) spinner.hidden = false;
    const imageLoads: Promise<void>[] = [];
    const loadImage = (image: HTMLImageElement, onLoad: () => void) => {
      imageLoads.push(
        new Promise((resolve) => {
          image.onload = () => {
            onLoad();
            resolve();
          };
          image.onerror = () => resolve();
        }),
      );
    };
    try {
      await this.loadMovesetImageMatches(character, element, loadImage);
    } finally {
      await Promise.all(imageLoads);
      if (spinner) spinner.hidden = true;
    }
  }

  async loadMovesetImageMatches(
    character: CharacterMovesetGroup,
    element: HTMLElement,
    loadImage: (image: HTMLImageElement, onLoad: () => void) => void,
  ) {
    const rows = Array.from(
      element.querySelectorAll<HTMLElement>('.character-moveset-mod'),
    );
    const matches = await Promise.all(
      character.mods.map(async (mod, index) => {
        if (!mod.gameBananaId) return null;
        const movesets = await this.getUmcMovesets(mod.gameBananaId);
        if (
          !element.isConnected ||
          this.manager.movesetCharacters.get(character.id) !== character
        )
          return null;
        const moveset = movesets.find((entry) => {
          const fighterId = window.resolveFolderName
            ? window.resolveFolderName(entry.fighterId)
            : entry.fighterId.toLowerCase();
          return fighterId === character.id && entry.imageUrl;
        });
        if (!moveset || !rows[index]) return null;
        const image = new Image();
        image.className = 'character-moveset-umc-thumbnail';
        image.alt = moveset.name;
        image.title = this.manager.t('characters.umcImage', 'Image from UMC');
        loadImage(image, () => {
          if (
            !rows[index].isConnected ||
            this.manager.movesetCharacters.get(character.id) !== character
          )
            return;
          rows[index].prepend(image);
          rows[index].classList.add('has-umc-image');
        });
        image.src = moveset.imageUrl;
        return moveset;
      }),
    );
    const firstMatch = matches.find((entry) => entry !== null);
    const frame = element.querySelector<HTMLElement>(
      '.character-moveset-image-frame',
    );
    if (!firstMatch || !frame || !element.isConnected) return;
    const image = new Image();
    image.alt = firstMatch.name;
    image.title = this.manager.t('characters.umcImage', 'Image from UMC');
    loadImage(image, () => {
      if (
        !element.isConnected ||
        this.manager.movesetCharacters.get(character.id) !== character
      )
        return;
      frame.replaceChildren(image);
      element
        .querySelector('.character-moveset-character')
        ?.classList.add('has-umc-image');
    });
    // The vanilla image stays visible until the UMC image has loaded successfully.
    image.src = firstMatch.imageUrl;
  }
}
