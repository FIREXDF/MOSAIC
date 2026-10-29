import { Mod } from '../../../main/mod-utils';
import type {
  UmcGameBananaMoveset,
  UmcCompatibilityDto as UmcCompatibilityResult,
  UmcGroupCompatibilityDto,
} from '../../../main/ipc/handlers/umc-handlers';

class CharactersManager {
  characters: Map<string, Character>;
  movesetCharacters: Map<string, CharacterMovesetGroup>;
  allCharacters: any[];
  searchQuery: string;
  initialized: boolean;
  cssVisibleCharacters: CharacterCssEntry[];
  cssHiddenCharacters: CharacterCssEntry[];
  cssGroups: Map<string, CharacterCssEntry[]>;
  cssCreatedGroups: Map<string, CharacterCssGroupCreate>;
  cssRenamedCharacters: Map<string, string>;
  cssDraggedCharacterId: string | null;
  cssLoaded: boolean;
  cssDirty: boolean;
  cssSaving: boolean;
  cssSelectedCharacterId: string | null;
  cssPanelMode: 'prc' | 'msbt';
  cssSelectedSlotIndex: number;
  cssCharacterUpdates: Map<string, any>;
  cssImageLookupTimers = new WeakMap<CharacterCssEntry, number>();
  cssUmcImagesEnabled = true;
  cssUmcImageExclusions = new Set<string>();
  cssCustomImages = new Map<string, string>();
  cssCustomImageBusy = false;
  cssUmcImagePreferencesPromise: Promise<void> | null = null;
  cssUmcImageRevision = 0;
  cssPrefetchedLayout: any | null;
  cssPrefetchPromise: Promise<void> | null;
  cssSourcePrcPath: string | null;
  cssSourceLayoutPath: string | null;
  cssSourceMsbtPath: string | null;
  cssSourceImporting: boolean;
  pendingModRefreshPaths: Set<string>;
  incrementalRefreshPromise: Promise<void> | null;
  staleMovesetModPaths: Set<string>;
  isRefreshingMovesets: boolean;
  umcMovesets: UmcMoveset[];
  umcMovesetsLoaded: boolean;
  umcMovesetsLoading: boolean;
  umcMovesetsError: string | null;
  umcSearchQuery: string;
  umcSelectedMovesetIds: Set<number>;
  umcCheckingCompatibility: boolean;
  umcCompatibilityResult: UmcGroupCompatibilityDto | null;
  umcCompatibilityError: string | null;
  umcCompatibilityRequestId: number;
  movesets: CharactersMovesetsSection;
  umc: CharactersUmcSection;
  cssEditor: CharactersCssEditorSection;
  cssImages: CharactersCssImagesSection;
  cssInspector: CharactersCssInspectorSection;
  cssSlots: CharactersCssSlotsSection;

  constructor() {
    this.movesets = new CharactersMovesetsSection(this);
    this.umc = new CharactersUmcSection(this);
    this.cssEditor = new CharactersCssEditorSection(this);
    this.cssImages = new CharactersCssImagesSection(this);
    this.cssInspector = new CharactersCssInspectorSection(this);
    this.cssSlots = new CharactersCssSlotsSection(this);
    this.characters = new Map();
    this.movesetCharacters = new Map();
    this.allCharacters = [];
    this.searchQuery = '';
    this.initialized = false;
    this.cssVisibleCharacters = [];
    this.cssHiddenCharacters = [];
    this.cssGroups = new Map();
    this.cssCreatedGroups = new Map();
    this.cssRenamedCharacters = new Map();
    this.cssDraggedCharacterId = null;
    this.cssLoaded = false;
    this.cssDirty = false;
    this.cssSaving = false;
    this.cssSelectedCharacterId = null;
    this.cssPanelMode = 'prc';
    this.cssSelectedSlotIndex = 0;
    this.cssCharacterUpdates = new Map();
    this.cssPrefetchedLayout = null;
    this.cssPrefetchPromise = null;
    this.cssSourcePrcPath = null;
    this.cssSourceLayoutPath = null;
    this.cssSourceMsbtPath = null;
    this.cssSourceImporting = false;
    this.pendingModRefreshPaths = new Set();
    this.incrementalRefreshPromise = null;
    this.staleMovesetModPaths = new Set();
    this.isRefreshingMovesets = false;
    this.umcMovesets = [];
    this.umcMovesetsLoaded = false;
    this.umcMovesetsLoading = false;
    this.umcMovesetsError = null;
    this.umcSearchQuery = '';
    this.umcSelectedMovesetIds = new Set();
    this.umcCheckingCompatibility = false;
    this.umcCompatibilityResult = null;
    this.umcCompatibilityError = null;
    this.umcCompatibilityRequestId = 0;

    window.addEventListener('css-umc-images-setting-changed', (event) => {
      const enabled = (event as CustomEvent<{ enabled: boolean }>).detail
        ?.enabled;
      if (typeof enabled !== 'boolean') return;
      this.cssUmcImageRevision++;
      this.cssUmcImagesEnabled = enabled;
      this.cssEditor.getAllCssCharacters().forEach((character) => {
        this.cssImages.scheduleCssCharacterImageLookup(character);
        this.cssImages.refreshCssCharacterImage(character);
      });
    });

    window.addEventListener('mods-library-updated', (event) => {
      const detail = (
        event as CustomEvent<{
          changedPaths?: string[];
          addedPaths?: string[];
        }>
      ).detail;
      if (detail?.changedPaths) {
        void this.movesets.detectMovesetLibraryChanges(
          detail.changedPaths,
          detail.addedPaths || [],
        );
      } else {
        void this.refresh();
      }
    });
    window.addEventListener('mod-info-updated', (event) => {
      const detail = (event as CustomEvent<{ modPath?: string }>).detail;
      if (detail?.modPath) {
        void this.handleModInfoUpdated(detail.modPath);
      }
    });
    window.addEventListener('mod-conflicts-updated', () => {
      if (this.initialized) {
        this.syncLiveModStatuses();
      }
    });

  }

  preloadCssLayout() {
    if (this.cssLoaded || this.cssPrefetchedLayout || this.cssPrefetchPromise) {
      return this.cssPrefetchPromise || Promise.resolve();
    }

    this.cssPrefetchPromise = (async () => {
      try {
        if (!window.electronAPI?.getCharacterCssLayout) {
          return;
        }
        const result = await window.electronAPI.getCharacterCssLayout();
        if (result?.success) {
          this.cssPrefetchedLayout = result;
        }
      } catch (error) {
        console.warn('[CharactersManager] CSS preload failed:', error);
      } finally {
        this.cssPrefetchPromise = null;
      }
    })();

    return this.cssPrefetchPromise;
  }

  closeCharacterModal(
    modal: HTMLElement,
    escapeHandler?: (e: KeyboardEvent) => void,
  ) {
    if (!modal || modal.classList.contains('closing')) {
      return;
    }

    if (escapeHandler) {
      document.removeEventListener('keydown', escapeHandler);
    }

    const isNoAnimations = document.body.classList.contains('no-animations');
    const modalContent = modal.querySelector<HTMLElement>('.character-modal');

    if (isNoAnimations) {
      modal.remove();
      return;
    }

    modal.classList.add('closing');
    modalContent?.classList.add('closing');

    window.setTimeout(() => {
      modal.remove();
    }, 300);
  }

  bindBackdropClose(modal: HTMLElement, onClose: () => void) {
    let pointerStartedOnBackdrop = false;
    modal.addEventListener('pointerdown', (event) => {
      pointerStartedOnBackdrop = event.target === modal;
    });
    modal.addEventListener('click', (event) => {
      const shouldClose = pointerStartedOnBackdrop && event.target === modal;
      pointerStartedOnBackdrop = false;
      if (shouldClose) {
        onClose();
      }
    });
  }

  async initialize() {
    if (this.initialized) {
      this.setupEventListeners();
      this.renderCharacters();
      this.movesets.renderMovesetRefreshNotice();
      return;
    }

    this.showLoading();
    await this.scanMods();
    this.setupEventListeners();
    this.renderCharacters();
    this.initialized = true;
    this.movesets.renderMovesetRefreshNotice();
  }

  setupEventListeners() {
    const searchInput =
      document.querySelector<HTMLInputElement>('#characters-search');

    if (searchInput) {
      const replacement = searchInput.cloneNode(true) as HTMLInputElement;
      searchInput.parentNode?.replaceChild(replacement, searchInput);
      replacement.value = this.searchQuery;
      replacement.addEventListener('input', () => {
        this.searchQuery = replacement.value.toLowerCase();
        this.filterCharacters();
      });
    }

    const editCssButton = document.querySelector<HTMLButtonElement>(
      '#edit-character-css-btn',
    );
    if (editCssButton) {
      const replacement = editCssButton.cloneNode(true) as HTMLButtonElement;
      editCssButton.parentNode?.replaceChild(replacement, editCssButton);
      replacement.addEventListener('click', () => {
        void this.cssEditor.openCssEditor();
      });
    }

    const echoButton = document.querySelector<HTMLButtonElement>(
      '#character-css-echo-btn',
    );
    if (echoButton) {
      const replacement = echoButton.cloneNode(true) as HTMLButtonElement;
      echoButton.parentNode?.replaceChild(replacement, echoButton);
      replacement.addEventListener('click', () => {
        void this.cssSlots.openEchoSlotWizard();
      });
    }

    const slotsButton = document.querySelector<HTMLButtonElement>(
      '#character-css-slots-btn',
    );
    if (slotsButton) {
      const replacement = slotsButton.cloneNode(true) as HTMLButtonElement;
      slotsButton.parentNode?.replaceChild(replacement, slotsButton);
      replacement.addEventListener('click', () => {
        this.cssSlots.openCssUsedSlotsModal();
      });
    }

    const createGroupButton = document.querySelector<HTMLButtonElement>(
      '#character-css-create-group-btn',
    );
    if (createGroupButton) {
      const replacement = createGroupButton.cloneNode(
        true,
      ) as HTMLButtonElement;
      createGroupButton.parentNode?.replaceChild(
        replacement,
        createGroupButton,
      );
      replacement.addEventListener('click', () => {
        this.cssSlots.openCreateCssGroupModal();
      });
    }

    const movesetsButton = document.querySelector<HTMLButtonElement>(
      '#character-movesets-btn',
    );
    if (movesetsButton) {
      const replacement = movesetsButton.cloneNode(true) as HTMLButtonElement;
      movesetsButton.parentNode?.replaceChild(replacement, movesetsButton);
      replacement.addEventListener('click', () => {
        this.movesets.openMovesetTracker();
      });
    }

    const umcButton = document.querySelector<HTMLButtonElement>(
      '#character-moveset-compatibility-btn',
    );
    if (umcButton) {
      const replacement = umcButton.cloneNode(true) as HTMLButtonElement;
      umcButton.parentNode?.replaceChild(replacement, umcButton);
      replacement.addEventListener('click', () => {
        this.umc.openUmcCompatibility();
      });
    }

    const umcBackButton = document.querySelector<HTMLButtonElement>(
      '#character-umc-back-btn',
    );
    if (umcBackButton) {
      const replacement = umcBackButton.cloneNode(true) as HTMLButtonElement;
      umcBackButton.parentNode?.replaceChild(replacement, umcBackButton);
      replacement.addEventListener('click', () => {
        this.umc.closeUmcCompatibility();
      });
    }

    const umcRefreshButton = document.querySelector<HTMLButtonElement>(
      '#character-umc-refresh-btn',
    );
    if (umcRefreshButton) {
      const replacement = umcRefreshButton.cloneNode(true) as HTMLButtonElement;
      umcRefreshButton.parentNode?.replaceChild(replacement, umcRefreshButton);
      replacement.addEventListener('click', () => {
        void this.umc.loadUmcMovesets(true);
      });
    }

    const umcSearch = document.querySelector<HTMLInputElement>(
      '#character-umc-search',
    );
    if (umcSearch) {
      const replacement = umcSearch.cloneNode(true) as HTMLInputElement;
      umcSearch.parentNode?.replaceChild(replacement, umcSearch);
      replacement.value = this.umcSearchQuery;
      replacement.addEventListener('input', () => {
        this.umcSearchQuery = replacement.value.trim().toLowerCase();
        this.umc.renderUmcMovesetGrid();
      });
    }

    const umcGrid = document.querySelector<HTMLElement>('#character-umc-grid');
    if (umcGrid && umcGrid.dataset.umcListenersAttached !== 'true') {
      umcGrid.dataset.umcListenersAttached = 'true';
      umcGrid.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof Element)) {
          return;
        }

        if (target.closest('[data-umc-retry]')) {
          void this.umc.loadUmcMovesets(true);
          return;
        }

        const card = target.closest<HTMLButtonElement>('[data-umc-moveset-id]');
        const movesetId = Number(card?.dataset.umcMovesetId);
        if (Number.isSafeInteger(movesetId)) {
          this.umc.selectUmcMoveset(movesetId);
        }
      });
    }

    const umcSelection = document.querySelector<HTMLElement>(
      '#character-umc-selection',
    );
    if (umcSelection && umcSelection.dataset.umcListenersAttached !== 'true') {
      umcSelection.dataset.umcListenersAttached = 'true';
      umcSelection.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const chip = target.closest<HTMLButtonElement>('[data-umc-remove-id]');
        if (!chip) return;
        const id = Number(chip.dataset.umcRemoveId);
        const restoreFocus = document.activeElement === chip;
        this.umc.selectUmcMoveset(id);
        if (restoreFocus) {
          document
            .querySelector<HTMLButtonElement>(`[data-umc-moveset-id="${id}"]`)
            ?.focus();
        }
      });
    }

    const movesetsRefreshButton = document.querySelector<HTMLButtonElement>(
      '#character-movesets-refresh-btn',
    );
    if (movesetsRefreshButton) {
      const replacement = movesetsRefreshButton.cloneNode(
        true,
      ) as HTMLButtonElement;
      movesetsRefreshButton.parentNode?.replaceChild(
        replacement,
        movesetsRefreshButton,
      );
      replacement.addEventListener('click', () => {
        void this.movesets.refreshMovesets();
      });
    }

    const movesetsBackButton = document.querySelector<HTMLButtonElement>(
      '#character-movesets-back-btn',
    );

    if (movesetsBackButton) {
      const replacement = movesetsBackButton.cloneNode(
        true,
      ) as HTMLButtonElement;
      movesetsBackButton.parentNode?.replaceChild(
        replacement,
        movesetsBackButton,
      );
      replacement.addEventListener('click', () => {
        this.movesets.closeMovesetTracker();
      });
    }

    const backButton = document.querySelector<HTMLButtonElement>(
      '#character-css-back-btn',
    );
    if (backButton) {
      const replacement = backButton.cloneNode(true) as HTMLButtonElement;
      backButton.parentNode?.replaceChild(replacement, backButton);
      replacement.addEventListener('click', () => {
        this.cssEditor.closeCssEditor();
      });
    }

    const hiddenButton = document.querySelector<HTMLButtonElement>(
      '#character-css-hidden-btn',
    );
    if (hiddenButton) {
      const replacement = hiddenButton.cloneNode(true) as HTMLButtonElement;
      hiddenButton.parentNode?.replaceChild(replacement, hiddenButton);
      replacement.addEventListener('click', () => {
        this.cssSlots.openHiddenCssCharactersModal();
      });
    }

    const changeSourceButton = document.querySelector<HTMLButtonElement>(
      '#character-css-change-source-btn',
    );
    if (changeSourceButton) {
      const replacement = changeSourceButton.cloneNode(
        true,
      ) as HTMLButtonElement;
      changeSourceButton.parentNode?.replaceChild(
        replacement,
        changeSourceButton,
      );
      replacement.addEventListener('click', () => {
        this.cssEditor.openCharacterCssSourceImport();
      });
    }

    const saveButton = document.querySelector<HTMLButtonElement>(
      '#character-css-save-btn',
    );
    if (saveButton) {
      const replacement = saveButton.cloneNode(true) as HTMLButtonElement;
      saveButton.parentNode?.replaceChild(replacement, saveButton);
      replacement.addEventListener('click', () => {
        void this.cssEditor.saveCssLayout();
      });
    }

    const randomizeButton = document.querySelector<HTMLButtonElement>(
      '#character-css-randomize-btn',
    );
    if (randomizeButton) {
      const replacement = randomizeButton.cloneNode(true) as HTMLButtonElement;
      randomizeButton.parentNode?.replaceChild(replacement, randomizeButton);
      replacement.addEventListener('click', () => {
        this.cssEditor.randomizeCssLayout();
      });
    }

    const previewButton = document.querySelector<HTMLButtonElement>(
      '#character-css-preview-btn',
    );
    if (previewButton) {
      const replacement = previewButton.cloneNode(true) as HTMLButtonElement;
      previewButton.parentNode?.replaceChild(replacement, previewButton);
      replacement.addEventListener('click', () => {
        this.cssEditor.openCssPreviewModal();
      });
    }

    const cssGrid = document.querySelector<HTMLElement>('#character-css-grid');
    if (cssGrid && cssGrid.dataset.listenersBound !== 'true') {
      cssGrid.dataset.listenersBound = 'true';
      cssGrid.addEventListener('dragstart', (event) => {
        const cell = (event.target as HTMLElement | null)?.closest<HTMLElement>(
          '.character-css-cell',
        );
        if (!cell?.dataset.characterId) return;
        this.cssDraggedCharacterId = cell.dataset.characterId;
        cell.classList.add('is-dragging');
        event.dataTransfer?.setData('text/plain', cell.dataset.characterId);
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = 'move';
        }
      });
      cssGrid.addEventListener('dragend', () => {
        cssGrid
          .querySelectorAll('.is-dragging, .is-drop-target')
          .forEach((node) =>
            node.classList.remove('is-dragging', 'is-drop-target'),
          );
        this.cssDraggedCharacterId = null;
      });
      cssGrid.addEventListener('dragover', (event) => {
        const cell = (event.target as HTMLElement | null)?.closest<HTMLElement>(
          '.character-css-cell',
        );
        if (!cell || !this.cssDraggedCharacterId) return;
        event.preventDefault();
        cell.classList.add('is-drop-target');
      });
      cssGrid.addEventListener('dragleave', (event) => {
        const cell = (event.target as HTMLElement | null)?.closest<HTMLElement>(
          '.character-css-cell',
        );
        const relatedTarget = event.relatedTarget as Node | null;
        if (cell && (!relatedTarget || !cell.contains(relatedTarget))) {
          cell.classList.remove('is-drop-target');
        }
      });
      cssGrid.addEventListener('drop', (event) => {
        const cell = (event.target as HTMLElement | null)?.closest<HTMLElement>(
          '.character-css-cell',
        );
        if (!cell?.dataset.characterId || !this.cssDraggedCharacterId) return;
        event.preventDefault();
        this.cssSlots.moveCssCharacter(
          this.cssDraggedCharacterId,
          cell.dataset.characterId,
        );
      });
      cssGrid.addEventListener('contextmenu', (event) => {
        const cell = (event.target as HTMLElement | null)?.closest<HTMLElement>(
          '.character-css-cell',
        );
        if (!cell?.dataset.characterId) return;
        event.preventDefault();
        this.cssSlots.hideCssCharacter(cell.dataset.characterId);
      });
      cssGrid.addEventListener('click', (event) => {
        const cell = (event.target as HTMLElement | null)?.closest<HTMLElement>(
          '.character-css-cell',
        );
        if (!cell?.dataset.characterId) return;
        this.cssEditor.selectCssCharacter(cell.dataset.characterId);
      });
    }
  }

  t(key: string, fallback: string, params: Record<string, string> = {}) {
    const translated = window.i18n?.t?.(key, params);
    return translated && translated !== key ? translated : fallback;
  }

  gameBananaLink() {
    return '<a href="#" onclick="window.electronAPI.openUrl(\'https://gamebanana.com/games/6498\'); return false;" style="color: var(--primary-color); text-decoration: none; font-weight: 500;">GameBanana</a>';
  }

  filterCharacters() {
    if (!this.searchQuery) {
      this.renderCharacters();
      return;
    }

    const filtered = this.allCharacters.filter((char) =>
      char.info.name.toLowerCase().includes(this.searchQuery),
    );

    this.renderFilteredCharacters(filtered);
  }

  renderFilteredCharacters(characters) {
    const container = document.querySelector<HTMLElement>('#characters-grid');
    if (!container) return;

    if (characters.length === 0) {
      container.innerHTML = `
<div class="characters-empty-state">
<i class="bi bi-search"></i>
<h3>${this.t('characters.noSearchResults', 'No characters found')}</h3>
<p>${this.t('characters.tryDifferentSearch', 'Try a different search term')}</p>
</div>
`;
      this.updateCharacterCount(0);
      return;
    }

    container.replaceChildren();
    characters.forEach((char) => {
      const card = this.createCharacterCard(char);
      container.appendChild(card);
    });

    this.updateCharacterCount(characters.length);
  }

  async scanMods(): Promise<boolean> {
    if (!window.settingsManager || !window.settingsManager.hasModsPath()) {
      console.warn('No mods path configured');
      this.renderEmptyState();
      return false;
    }

    const modsPath = window.settingsManager.getModsPath();
    if (!modsPath) {
      console.warn('Mods path is null');
      this.renderEmptyState();
      return false;
    }

    if (!window.electronAPI || !window.electronAPI.readModsFolder) {
      console.error('Electron API not available');
      return false;
    }

    try {
      const result = await window.electronAPI.readModsFolder(modsPath);

      if (!result.success) {
        console.error('Error reading mods:', result.error);
        return false;
      }

      this.characters.clear();
      this.movesetCharacters.clear();

      const allMods = [
        ...result.activeMods.map((m) => ({
          mod: m,
          status: this.resolveLiveModStatus(m.path, 'active'),
        })),
        ...result.disabledMods.map((m) => ({
          mod: m,
          status: 'disabled' as const,
        })),
      ];

      let scannedCount = 0;
      const scanConcurrency = Math.min(
        6,
        Math.max(2, Math.floor((navigator.hardwareConcurrency || 4) / 2)),
      );

      await this.runWithConcurrency(
        allMods,
        scanConcurrency,
        async ({ mod, status }) => {
          this.updateLoadingStatus(
            `Scanning ${mod.name} (${scannedCount + 1}/${allMods.length})...`,
          );
          await this.scanModForCharacters(mod, status);
          scannedCount += 1;
          this.updateLoadingStatus(
            `Scanned ${scannedCount}/${allMods.length} mods...`,
          );
        },
      );

      return true;
    } catch (error) {
      console.error('Failed to scan mods:', error);
      return false;
    }
  }

  resolveLiveModStatus(
    modPath: string,
    fallback: CharacterModStatus,
  ): CharacterModStatus {
    const liveStatus = window.modManager?.mods.find(
      (mod) => mod.path === modPath,
    )?.status;

    if (liveStatus === 'conflict') return 'conflict';
    if (liveStatus === 'disabled') return 'disabled';
    if (liveStatus === 'active') return 'active';
    return fallback;
  }

  syncLiveModStatuses() {
    for (const character of this.characters.values()) {
      for (const mod of character.mods) {
        mod.status = this.resolveLiveModStatus(mod.path, mod.status);
      }
    }

    for (const character of this.movesetCharacters.values()) {
      for (const mod of character.mods) {
        mod.status = this.resolveLiveModStatus(mod.path, mod.status);
      }
    }

    if (this.searchQuery) this.filterCharacters();
    else this.renderCharacters();
    this.movesets.renderMovesetTracker();
  }

  async runWithConcurrency<T>(
    items: T[],
    concurrency: number,
    worker: (item: T, index: number) => Promise<void>,
  ) {
    let nextIndex = 0;
    const workerCount = Math.min(concurrency, items.length);

    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        while (nextIndex < items.length) {
          const currentIndex = nextIndex;
          nextIndex += 1;
          await worker(items[currentIndex], currentIndex);
        }
      }),
    );
  }

  async scanModForCharacters(
    mod: Pick<Mod, 'name' | 'path'>,
    status: CharacterModStatus,
  ) {
    if (!window.electronAPI || !window.electronAPI.scanMod) {
      return;
    }

    try {
      const [scanModResult, modInfo] = await Promise.all([
        window.electronAPI.scanMod(mod.path),
        this.getModInfo(mod),
      ]);

      if (scanModResult.success && scanModResult.data.fighterNames.length > 0) {
        const resolvedIds = new Set<string>();
        const isMovesetMod = this.movesets.isMovesetModInfo(modInfo, mod.name);
        const movesetMod: CharacterMovesetMod = {
          name: modInfo?.display_name || mod.name,
          path: mod.path,
          status,
          category: modInfo?.category || '',
          description: modInfo?.description || '',
          slots: [],
          gameBananaId: this.movesets.getGameBananaModId(modInfo?.url),
        };
        const slotsByFighterId = this.getSlotsByResolvedFighterId(
          scanModResult.data.pathData,
        );

        scanModResult.data.fighterNames.forEach((rawFighterId: string) => {
          const fighterId = window.resolveFolderName
            ? window.resolveFolderName(rawFighterId)
            : rawFighterId.toLowerCase();

          if (resolvedIds.has(fighterId)) {
            return;
          }
          resolvedIds.add(fighterId);

          if (!this.characters.has(fighterId)) {
            const charInfo = window.SSBU_CHARACTERS[fighterId];

            if (charInfo) {
              this.characters.set(fighterId, {
                id: fighterId,
                info: charInfo,
                mods: [],
              });
            } else {
              console.warn(
                `Unknown fighter: ${rawFighterId} (resolved to: ${fighterId})`,
              );
            }
          }

          const char = this.characters.get(fighterId);
          if (char) {
            char.mods.push({
              name: mod.name,
              path: mod.path,
              status: status,
              slots: slotsByFighterId.get(fighterId) || [],
            });
          }

          if (isMovesetMod) {
            this.movesets.addMovesetModForCharacter(fighterId, {
              ...movesetMod,
              slots: slotsByFighterId.get(fighterId) || [],
            });
          }
        });
      }
    } catch (error) {
      console.error(`Error scanning mod ${mod.name}:`, error);
    }
  }

  removeModFromCharacters(modPath: string) {
    const affectedCharacterIds = new Set<string>();

    for (const [characterId, character] of this.characters) {
      const mods = character.mods.filter((mod) => mod.path !== modPath);
      if (mods.length === character.mods.length) continue;
      affectedCharacterIds.add(characterId);
      if (mods.length === 0) this.characters.delete(characterId);
      else character.mods = mods;
    }

    for (const [characterId, character] of this.movesetCharacters) {
      const mods = character.mods.filter((mod) => mod.path !== modPath);
      if (mods.length === character.mods.length) continue;
      affectedCharacterIds.add(characterId);
      if (mods.length === 0) this.movesetCharacters.delete(characterId);
      else character.mods = mods;
    }

    return affectedCharacterIds;
  }

  queueIncrementalRefresh(modPaths: string[]) {
    modPaths.forEach((path) => this.pendingModRefreshPaths.add(path));
    if (this.incrementalRefreshPromise) return;

    this.incrementalRefreshPromise = (async () => {
      while (this.pendingModRefreshPaths.size > 0) {
        const paths = [...this.pendingModRefreshPaths];
        this.pendingModRefreshPaths.clear();
        await this.refreshChangedMods(paths);
      }
    })().finally(() => {
      this.incrementalRefreshPromise = null;
      if (this.pendingModRefreshPaths.size > 0) {
        this.queueIncrementalRefresh([]);
      }
    });
  }

  async refreshChangedMods(modPaths: string[]) {
    const affectedCharacterIds = new Set<string>();
    const liveModsByPath = new Map(
      (window.modManager?.mods || []).map((mod) => [mod.path, mod]),
    );

    for (const path of modPaths) {
      this.removeModFromCharacters(path).forEach((characterId) =>
        affectedCharacterIds.add(characterId),
      );

      const mod = liveModsByPath.get(path);
      if (!mod) continue;
      await this.scanModForCharacters(mod, mod.status);

      for (const [characterId, character] of this.characters) {
        if (character.mods.some((entry) => entry.path === path)) {
          affectedCharacterIds.add(characterId);
        }
      }
    }

    this.renderChangedCharacters(affectedCharacterIds);
    this.movesets.renderMovesetTracker();
  }

  async handleModInfoUpdated(modPath: string) {
    if (this.movesets.modPathHasMoveset(modPath)) {
      this.movesets.markMovesetsStale(modPath);
      return;
    }

    const mod = window.modManager?.mods.find((entry) => entry.path === modPath);
    if (!mod) {
      return;
    }

    const modInfo = await this.getModInfo(mod);
    if (this.movesets.isMovesetModInfo(modInfo, mod.name)) {
      this.movesets.markMovesetsStale(modPath);
    }
  }

  async getModInfo(mod: Pick<Mod, 'name' | 'path'>) {
    if (!window.electronAPI?.getModInfo || !mod.path) {
      return null;
    }

    try {
      return await window.electronAPI.getModInfo(mod.path);
    } catch (error) {
      console.warn(`Failed to read info.toml for ${mod.name}:`, error);
      return null;
    }
  }

  getSlotsByResolvedFighterId(pathData: Record<string, Record<string, any>>) {
    const slotsByFighterId = new Map<string, string[]>();

    Object.entries(pathData || {}).forEach(([rawFighterId, slots]) => {
      const fighterId = window.resolveFolderName
        ? window.resolveFolderName(rawFighterId)
        : rawFighterId.toLowerCase();
      const detectedSlots = Object.keys(slots || {})
        .filter((slot) => slot !== 'unknown')
        .sort((a, b) => {
          const numA = parseInt(a.replace(/^c/i, ''), 10);
          const numB = parseInt(b.replace(/^c/i, ''), 10);
          return numA - numB;
        });

      slotsByFighterId.set(fighterId, detectedSlots);
    });

    return slotsByFighterId;
  }

  renderCharacters() {
    const container = document.querySelector<HTMLElement>('#characters-grid');
    if (!container) {
      console.warn('Characters grid container not found');
      return;
    }

    if (this.characters.size === 0) {
      this.renderEmptyState();
      return;
    }

    container.replaceChildren();

    this.allCharacters = Array.from(this.characters.values()).sort((a, b) => {
      const numA = parseFloat(a.info.number.replace('ε', '.5'));
      const numB = parseFloat(b.info.number.replace('ε', '.5'));
      return numA - numB;
    });

    this.allCharacters.forEach((char) => {
      const card = this.createCharacterCard(char);
      container.appendChild(card);
    });

    this.updateCharacterCount(this.allCharacters.length);
  }

  renderChangedCharacters(affectedCharacterIds: Set<string>) {
    const container = document.querySelector<HTMLElement>('#characters-grid');
    if (!container) return;

    this.allCharacters = Array.from(this.characters.values()).sort((a, b) => {
      const numA = parseFloat(a.info.number.replace('ε', '.5'));
      const numB = parseFloat(b.info.number.replace('ε', '.5'));
      return numA - numB;
    });

    if (this.searchQuery) {
      this.filterCharacters();
      return;
    }
    if (this.allCharacters.length === 0) {
      this.renderEmptyState();
      this.updateCharacterCount(0);
      return;
    }

    container.querySelector('.characters-empty-state')?.remove();
    for (const characterId of affectedCharacterIds) {
      const existing = Array.from(
        container.querySelectorAll<HTMLElement>('.character-card'),
      ).find((card) => card.dataset.characterId === characterId);
      const character = this.characters.get(characterId);
      if (!character) existing?.remove();
      else if (existing)
        existing.replaceWith(this.createCharacterCard(character));
    }

    for (const character of this.allCharacters) {
      let card = Array.from(
        container.querySelectorAll<HTMLElement>('.character-card'),
      ).find((entry) => entry.dataset.characterId === character.id);
      if (!card) card = this.createCharacterCard(character);
      container.appendChild(card);
    }
    this.updateCharacterCount(this.allCharacters.length);
  }

  updateCharacterCount(count) {
    const countEl = document.querySelector<HTMLElement>('#characters-count');
    if (countEl) {
      countEl.textContent = `${count} character${count !== 1 ? 's' : ''}`;
    }
  }

  renderCharacterSlotBadges(slots: string[], unknownLabel = 'Slot unknown') {
    if (!slots || slots.length === 0) {
      return `<span class="character-moveset-slot is-unknown">${escapeHtml(unknownLabel)}</span>`;
    }

    return slots
      .map(
        (slot) =>
          `<span class="character-moveset-slot">${escapeHtml(slot)}</span>`,
      )
      .join('');
  }

  renderModStatus(status: CharacterModStatus) {
    const label =
      status === 'active'
        ? this.t('characters.modActive', 'Active')
        : status === 'conflict'
          ? this.t('characters.modConflict', 'Conflict')
          : this.t('characters.modDisabled', 'Disabled');

    return `<span class="character-mod-status ${status}">${escapeHtml(label)}</span>`;
  }

  showModContextMenu(event: MouseEvent, modPath?: string) {
    event.preventDefault();
    event.stopPropagation();

    if (!modPath || !window.modManager) return;

    const mod = window.modManager.mods.find((entry) => entry.path === modPath);
    if (!mod) return;

    if (!window.modManager.contextMenuHandler) {
      window.modManager.initContainer();
    }

    window.modManager.contextMenuHandler?.showContextMenu(event, mod, {
      source: 'characters',
      useSelection: false,
    });
  }

  createCharacterCard(char) {
    const card = document.createElement('div');
    card.className = 'character-card';
    card.dataset.characterId = char.id;

    const imageUrl =
      window.CHARACTER_IMAGES[char.id] ||
      'https://www.smashbros.com/assets_v2/img/fighter/mario/main.png';
    const escapedName = escapeHtml(char.info.name);
    const activeModCount = char.mods.filter(
      (mod) => mod.status !== 'disabled',
    ).length;
    const activeModSummary = this.t(
      'characters.activeModCount',
      `${activeModCount} active`,
      { count: String(activeModCount) },
    );

    card.innerHTML = `
<div class="character-card-header">
<img src="${imageUrl}" alt="${escapedName}" class="character-image"
onerror="this.style.display='none'; this.nextElementSibling.classList.add('show-placeholder');">
<div class="character-image-placeholder">
<i class="bi bi-person-circle"></i>
<span class="character-placeholder-text">${escapedName}</span>
</div>
<div class="character-overlay">
<span class="character-number">#${char.info.number}</span>
</div>
</div>
<div class="character-card-body">
<h3 class="character-name">${escapeHtml(char.info.name)}</h3>
<div class="character-mod-count">
<i class="bi bi-file-earmark-code"></i>
<span>${char.mods.length} mod${char.mods.length > 1 ? 's' : ''} · ${escapeHtml(activeModSummary)}</span>
</div>
<div class="character-mods-list">
${char.mods
  .map(
    (mod) => `
<div class="character-mod-item ${mod.status}" data-mod-path="${escapeHtml(mod.path)}" title="${escapeHtml(this.t('characters.modActionsHint', 'Right-click for mod actions'))}">
<span class="mod-status-dot"></span>
<span class="mod-name">${escapeHtml(mod.name)}</span>
${this.renderModStatus(mod.status)}
<span class="character-mod-slots" aria-label="Detected character slots">
${this.renderCharacterSlotBadges(mod.slots, 'Unknown')}
</span>
</div>
`,
  )
  .join('')}
</div>
</div>
`;

    const modItems = card.querySelectorAll<HTMLElement>('.character-mod-item');
    modItems.forEach((item) => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const modPath = item.dataset.modPath;
        this.openModInToolsTab(modPath);
      });
      item.addEventListener('contextmenu', (event) => {
        this.showModContextMenu(event, item.dataset.modPath);
      });
    });

    card.addEventListener('click', () => {
      this.showCharacterDetails(char);
    });

    return card;
  }

  showCharacterDetails(char) {
    const existingModal = document.querySelector<HTMLElement>(
      '.character-modal-overlay',
    );
    if (existingModal) {
      existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.className = 'character-modal-overlay';
    modal.innerHTML = `
<div class="character-modal">
<div class="character-modal-header">
<h2>${escapeHtml(char.info.name)}</h2>
<button class="character-modal-close">
<i class="bi bi-x-lg"></i>
</button>
</div>
<div class="character-modal-body">
<p class="character-modal-count">${char.mods.length} mod${char.mods.length > 1 ? 's' : ''} for this character</p>
<div class="character-modal-mods">
${char.mods
  .map(
    (mod) => `
<div class="character-modal-mod-item ${mod.status}" data-mod-path="${escapeHtml(mod.path)}" title="${escapeHtml(this.t('characters.modActionsHint', 'Right-click for mod actions'))}">
<span class="mod-status-indicator ${mod.status}"></span>
<span class="character-modal-mod-main">
<span class="character-modal-mod-name-row">
<span class="mod-name">${escapeHtml(mod.name)}</span>
${this.renderModStatus(mod.status)}
</span>
<span class="character-modal-mod-slots" aria-label="Detected character slots">
${this.renderCharacterSlotBadges(mod.slots, 'Slot unknown')}
</span>
</span>
<i class="bi bi-arrow-right-circle"></i>
</div>
`,
  )
  .join('')}
</div>
</div>
</div>
`;

    document.body.appendChild(modal);

    const isNoAnimations = document.body.classList.contains('no-animations');
    if (isNoAnimations) {
      const overlay = modal;
      const modalContent = modal.querySelector<HTMLElement>('.character-modal');
      if (overlay) {
        overlay.style.opacity = '1';
        overlay.style.animation = 'none';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
      }
      if (modalContent) {
        modalContent.style.opacity = '1';
        modalContent.style.transform =
          'translate(-50%, -50%) scale(1) translateY(0)';
        modalContent.style.filter = 'blur(0px)';
        modalContent.style.animation = 'none';
        modalContent.style.position = 'absolute';
        modalContent.style.left = '50%';
        modalContent.style.top = '50%';
        modalContent.style.margin = '0';
      }
    }

    const closeBtn = modal.querySelector<HTMLElement>('.character-modal-close');
    let escapeHandler: ((e: KeyboardEvent) => void) | null = null;

    closeBtn!.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeCharacterModal(modal, escapeHandler || undefined);
    });

    this.bindBackdropClose(modal, () => {
      this.closeCharacterModal(modal, escapeHandler || undefined);
    });

    const modalContent = modal.querySelector<HTMLElement>('.character-modal');
    if (modalContent) {
      modalContent.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    const modItems = modal.querySelectorAll<HTMLElement>(
      '.character-modal-mod-item',
    );
    modItems.forEach((item) => {
      item.addEventListener('click', () => {
        const modPath = item.dataset.modPath;
        this.closeCharacterModal(modal, escapeHandler || undefined);
        this.openModInToolsTab(modPath);
      });
      item.addEventListener('contextmenu', (event) => {
        this.closeCharacterModal(modal, escapeHandler || undefined);
        this.showModContextMenu(event, item.dataset.modPath);
      });
    });

    escapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.closeCharacterModal(modal, escapeHandler || undefined);
      }
    };
    document.addEventListener('keydown', escapeHandler);
  }

  openModInToolsTab(modPath) {
    const toolsBtn = document.querySelector<HTMLElement>('[data-tab="tools"]');
    if (toolsBtn) {
      toolsBtn.click();
    }

    setTimeout(() => {
      if (window.modManager && window.modManager.mods) {
        const mod = window.modManager.mods.find((m) => m.path === modPath);

        if (mod) {
          window.modManager.clearFilters();
          window.modManager.selectMod(mod.id);

          setTimeout(() => {
            const modElement = document.querySelector<HTMLElement>(
              `.mod-item[data-mod-id="${mod.id}"]`,
            );
            if (modElement) {
              modElement.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
              });

              modElement.style.animation = 'highlightMod 1.5s ease';
              setTimeout(() => {
                modElement.style.animation = '';
              }, 1500);
            }
          }, 100);
        }
      }
    }, 300);
  }

  switchCharacterView(
    fromView: HTMLElement | null,
    toView: HTMLElement,
    direction: 'forward' | 'back',
  ) {
    if (fromView === toView) {
      toView.hidden = false;
      return;
    }

    document
      .querySelectorAll<HTMLElement>(
        '#characters-browser-view, #character-movesets-view, #character-moveset-compatibility-view, #character-css-editor',
      )
      .forEach((view) => {
        if (view !== fromView && view !== toView) {
          view.hidden = true;
          view.classList.remove(
            'characters-view-enter-from-left',
            'characters-view-enter-from-right',
            'characters-view-exit-left',
            'characters-view-exit-right',
          );
        }
      });

    const isNoAnimations = document.body.classList.contains('no-animations');
    const animClasses = [
      'characters-view-enter-from-left',
      'characters-view-enter-from-right',
      'characters-view-exit-left',
      'characters-view-exit-right',
    ];
    fromView?.classList.remove(...animClasses);
    toView.classList.remove(...animClasses);

    if (isNoAnimations) {
      if (fromView) {
        fromView.hidden = true;
      }
      toView.hidden = false;
      return;
    }

    if (fromView) {
      fromView.classList.add(
        direction === 'forward'
          ? 'characters-view-exit-left'
          : 'characters-view-exit-right',
      );
      window.setTimeout(() => {
        fromView.hidden = true;
        fromView.classList.remove(
          'characters-view-exit-left',
          'characters-view-exit-right',
        );
      }, 320);
    }

    toView.hidden = false;
    void toView.offsetWidth;
    toView.classList.add(
      direction === 'forward'
        ? 'characters-view-enter-from-right'
        : 'characters-view-enter-from-left',
    );
    window.setTimeout(() => {
      toView.classList.remove(
        'characters-view-enter-from-right',
        'characters-view-enter-from-left',
      );
    }, 320);
  }

  getActiveCharacterSubview() {
    return (
      document.querySelector<HTMLElement>(
        '#characters-browser-view:not([hidden]), #character-movesets-view:not([hidden]), #character-moveset-compatibility-view:not([hidden]), #character-css-editor:not([hidden])',
      ) || null
    );
  }

  renderEmptyState() {
    const container = document.querySelector<HTMLElement>('#characters-grid');
    if (!container) return;

    const gameBananaLink = this.gameBananaLink();

    container.innerHTML = `
<div class="characters-empty-state">
<i class="bi bi-people-fill"></i>
<h3>${this.t('characters.noCharacterMods', 'No Character Mods Found')}</h3>
<p>${this.t('characters.configureModsFolder', 'Configure your mods folder in Settings to see characters with mods.')}</p>
<span style="font-size: 13px; margin-top: 10px; color: var(--text-muted);">${this.t('characters.downloadOnGameBanana', `Go download some on ${gameBananaLink}!`, { site: gameBananaLink })}</span>
</div>
`;
  }

  async refresh() {
    this.showLoading();
    this.characters.clear();
    this.movesetCharacters.clear();
    if (await this.scanMods()) {
      this.staleMovesetModPaths.clear();
    }
    this.renderCharacters();
    this.movesets.renderMovesetTracker();
  }

  updateLoadingStatus(text: string) {
    const el = document.getElementById('characters-loading-status');
    if (el) {
      el.textContent = text;
    }
  }

  showLoading() {
    const container = document.querySelector<HTMLElement>('#characters-grid');
    if (container) {
      container.innerHTML = `
<div class="characters-loading">
<div id="characters-loading-video" style="width: 100px; height: 100px;">
<video class="mosaic-loading-video" src="../images/loading.webm" autoplay loop muted playsinline aria-hidden="true"></video>
</div>
<p>Loading characters...</p>
<p id="characters-loading-status" style="font-size: 13px; color: var(--text-muted); margin-top: 8px;"></p>
</div>
`;
      const videoContainer = document.getElementById(
        'characters-loading-video',
      );
      if (videoContainer) {
        window.mountLoadingVideo(videoContainer);
      }
    }
    this.updateCharacterCount(0);
  }
}

if (typeof window !== 'undefined') {
  window.charactersManager = new CharactersManager();
}

export { type CharactersManager };
