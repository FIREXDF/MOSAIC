class CharactersCssImagesSection {
  manager: Window['charactersManager'];

  constructor(manager: Window['charactersManager']) {
    this.manager = manager;
  }

  hydrateCssCharacter(character: CharacterCssEntry) {
    const info = window.SSBU_CHARACTERS?.[character.nameId];
    const hydrated = {
      ...character,
      displayName: character.displayName || info?.name || character.nameId,
      number: info?.number || character.number || '',
      imageUrl: this.getCssCharacterImage(character.nameId),
      imageSource: undefined,
    };
    this.scheduleCssCharacterImageLookup(hydrated);
    return hydrated;
  }

  getCssCharacterLookupId(character: CharacterCssEntry) {
    return String(
      this.manager.cssCharacterUpdates.get(character.id)?.uiCharaId ?? character.id,
    ).trim();
  }

  getCssUmcImageKey(character: CharacterCssEntry) {
    return this.getCssCharacterLookupId(character)
      .toLowerCase()
      .replace(/^ui_chara_/, '');
  }

  loadCssUmcImagePreferences() {
    if (!this.manager.cssUmcImagePreferencesPromise) {
      const revision = this.manager.cssUmcImageRevision;
      this.manager.cssUmcImagePreferencesPromise = (async () => {
        const [enabled, exclusions, customImages] = await Promise.all([
          window.electronAPI.store.get('cssUmcImagesEnabled'),
          window.electronAPI.store.get('cssUmcImageExclusions'),
          window.electronAPI.getCssCharacterImages(),
        ]);
        if (!customImages.success)
          throw new Error(customImages.error || 'Failed to load custom images');
        this.manager.cssCustomImages = new Map(Object.entries(customImages.images));
        if (revision === this.manager.cssUmcImageRevision)
          this.manager.cssUmcImagesEnabled = enabled !== false;
        this.manager.cssUmcImageExclusions = new Set(
          Array.isArray(exclusions)
            ? exclusions.filter((id): id is string => typeof id === 'string')
            : [],
        );
      })().catch((error) => {
        this.manager.cssUmcImagePreferencesPromise = null;
        throw error;
      });
    }
    return this.manager.cssUmcImagePreferencesPromise;
  }

  refreshCssUmcImageControls(character: CharacterCssEntry) {
    if (this.manager.cssSelectedCharacterId !== character.id) return;
    const controls = document.querySelector<HTMLElement>(
      '[data-css-umc-image-controls]',
    );
    if (!controls) return;
    const fromUmc =
      character.imageSource === 'umc' && Boolean(character.imageUrl);
    const removed =
      !character.imageUrl &&
      this.manager.cssUmcImageExclusions.has(this.getCssUmcImageKey(character));
    const custom = character.imageSource === 'custom';
    const button = (action: string, key: string, fallback: string) =>
      `<button class="input-btn" type="button" data-css-image-action="${action}" ${this.manager.cssCustomImageBusy || this.manager.cssSaving ? 'disabled' : ''}>${escapeHtml(this.manager.t(key, fallback))}</button>`;
    controls.hidden = character.isRandom || character.isGroup;
    controls.innerHTML = `
${fromUmc ? `<span>${escapeHtml(this.manager.t('characters.umcImageSource', 'Image from UMC'))}</span>` : custom ? `<span>${escapeHtml(this.manager.t('characters.customImageSource', 'Custom image'))}</span>` : ''}
<div class="character-css-image-buttons">
${button('choose', custom ? 'characters.customImageChange' : 'characters.customImageChoose', custom ? 'Change image' : 'Add image')}
${custom ? button('remove-custom', 'characters.customImageRemove', 'Remove custom image') : fromUmc ? button('remove-umc', 'characters.umcImageRemove', 'Remove image') : removed && this.manager.cssUmcImagesEnabled ? button('restore-umc', 'characters.umcImageRestore', 'Restore UMC image') : ''}
</div>`;
    controls
      .querySelectorAll<HTMLButtonElement>('[data-css-image-action]')
      .forEach((button) =>
        button.addEventListener('click', () => {
          const action = button.dataset.cssImageAction;
          if (action === 'choose' || action === 'remove-custom') {
            void this.changeCssCustomImage(
              character,
              action === 'remove-custom',
            );
          } else {
            void this.setCssUmcImageRemoved(
              character,
              action === 'remove-umc',
              button,
            );
          }
        }),
      );
  }

  applyCssCharacterImage(character: CharacterCssEntry) {
    const customImage = this.manager.cssCustomImages.get(
      this.getCssUmcImageKey(character),
    );
    character.imageUrl =
      customImage || this.getCssCharacterImage(character.nameId);
    character.imageSource = customImage ? 'custom' : undefined;
  }

  async changeCssCustomImage(character: CharacterCssEntry, remove: boolean) {
    if (this.manager.cssCustomImageBusy || this.manager.cssSaving) return;
    this.manager.cssCustomImageBusy = true;
    this.refreshCssUmcImageControls(character);
    const characterId = this.getCssCharacterLookupId(character);
    const key = this.getCssUmcImageKey(character);
    try {
      await this.loadCssUmcImagePreferences();
      if (remove) {
        const result =
          await window.electronAPI.removeCssCharacterImage(characterId);
        if (!result.success)
          throw new Error(result.error || 'Failed to remove image');
        this.manager.cssCustomImages.delete(key);
      } else {
        const result =
          await window.electronAPI.selectCssCharacterImage(characterId);
        if (!result.success)
          throw new Error(result.error || 'Failed to import image');
        if (result.canceled || !result.imageUrl) return;
        this.manager.cssCustomImages.set(key, result.imageUrl);
      }
      this.manager.cssEditor.getAllCssCharacters()
        .filter((entry) => this.getCssUmcImageKey(entry) === key)
        .forEach((entry) => {
          this.scheduleCssCharacterImageLookup(entry);
          this.refreshCssCharacterImage(entry);
        });
    } catch (error) {
      window.toastManager?.error('characters.customImageFailed', 4000, {
        error: error.message || 'Unknown error',
      });
    } finally {
      this.manager.cssCustomImageBusy = false;
      const selected = this.manager.cssEditor.findCssCharacter(this.manager.cssSelectedCharacterId || '');
      if (selected) this.refreshCssUmcImageControls(selected);
    }
  }

  async setCssUmcImageRemoved(
    character: CharacterCssEntry,
    removed: boolean,
    button: HTMLButtonElement,
  ) {
    button.disabled = true;
    const key = this.getCssUmcImageKey(character);
    try {
      await this.loadCssUmcImagePreferences();
      if (removed) this.manager.cssUmcImageExclusions.add(key);
      else this.manager.cssUmcImageExclusions.delete(key);
      const result = await window.electronAPI.store.set(
        'cssUmcImageExclusions',
        [...this.manager.cssUmcImageExclusions],
      );
      if (!result.success)
        throw new Error('Failed to save UMC image preference');
      if (
        this.manager.cssEditor.findCssCharacter(character.id) !== character ||
        this.getCssUmcImageKey(character) !== key
      )
        return;
      this.scheduleCssCharacterImageLookup(character);
      this.refreshCssCharacterImage(character);
    } catch {
      if (removed) this.manager.cssUmcImageExclusions.delete(key);
      else this.manager.cssUmcImageExclusions.add(key);
      window.toastManager?.error('toasts.failedToSaveSetting', 4000);
    } finally {
      button.disabled = false;
    }
  }

  scheduleCssCharacterImageLookup(character: CharacterCssEntry) {
    const previousTimer = this.manager.cssImageLookupTimers.get(character);
    if (previousTimer !== undefined) window.clearTimeout(previousTimer);
    this.applyCssCharacterImage(character);
    if (character.isRandom || character.isGroup) return;

    // Wait for typing to settle; hydration also finishes before the lookup starts.
    const timer = window.setTimeout(async () => {
      this.manager.cssImageLookupTimers.delete(character);
      try {
        await this.loadCssUmcImagePreferences();
        if (this.manager.cssEditor.findCssCharacter(character.id) !== character) return;
        const previousImage = character.imageUrl;
        const previousSource = character.imageSource;
        this.applyCssCharacterImage(character);
        if (
          previousImage !== character.imageUrl ||
          previousSource !== character.imageSource
        ) {
          this.refreshCssCharacterImage(character);
        }
        this.refreshCssUmcImageControls(character);
        const characterId = this.getCssCharacterLookupId(character);
        const nameId = character.nameId;
        const revision = this.manager.cssUmcImageRevision;
        if (
          character.imageUrl ||
          !this.manager.cssUmcImagesEnabled ||
          this.manager.cssUmcImageExclusions.has(this.getCssUmcImageKey(character))
        )
          return;
        const result =
          await window.electronAPI.getUmcCharacterImage(characterId);
        if (
          !result.success ||
          !result.imageUrl ||
          this.manager.cssCustomImages.has(this.getCssUmcImageKey(character)) ||
          !this.manager.cssUmcImagesEnabled ||
          revision !== this.manager.cssUmcImageRevision ||
          this.manager.cssUmcImageExclusions.has(this.getCssUmcImageKey(character)) ||
          this.manager.cssEditor.findCssCharacter(character.id) !== character ||
          this.getCssCharacterLookupId(character) !== characterId ||
          character.nameId !== nameId
        )
          return;
        character.imageUrl = result.imageUrl;
        character.imageSource = 'umc';
        this.refreshCssCharacterImage(character);
      } catch {
        // A missing UMC entry or connection keeps the normal CSS placeholder.
      }
    }, 350);
    this.manager.cssImageLookupTimers.set(character, timer);
  }

  refreshCssCharacterImage(character: CharacterCssEntry) {
    // Replace images only: keep inspector inputs, focus and unsaved edits intact.
    this.refreshCssUmcImageControls(character);
    const thumbnail = character.imageUrl
      ? `<img src="${escapeHtml(character.imageUrl)}" alt="${escapeHtml(character.displayName)}" onerror="this.manager.hidden=true; this.manager.nextElementSibling.hidden=false;"><i class="bi bi-person-circle" hidden></i>`
      : '<i class="bi bi-person-circle"></i>';
    document
      .querySelectorAll<HTMLElement>('.character-css-cell')
      .forEach((cell) => {
        if (cell.dataset.characterId !== character.id) return;
        const frame = cell.querySelector<HTMLElement>(
          '.character-css-image-frame',
        );
        const updatedFrame = this.manager.cssEditor.createCssCharacterCell(
          character,
        ).querySelector<HTMLElement>('.character-css-image-frame');
        if (frame && updatedFrame) frame.replaceWith(updatedFrame);
      });
    if (this.manager.cssSelectedCharacterId === character.id) {
      const thumb = document.querySelector<HTMLElement>(
        '#character-css-inspector .character-css-inspector-thumb',
      );
      if (thumb) thumb.innerHTML = thumbnail;
    }
    document
      .querySelectorAll<HTMLElement>('.character-css-hidden-row')
      .forEach((row) => {
        if (row.dataset.characterId !== character.id) return;
        const thumb = row.querySelector<HTMLElement>(
          '.character-css-hidden-thumb',
        );
        if (thumb) thumb.innerHTML = thumbnail;
      });
    document
      .querySelectorAll<HTMLElement>('.character-css-preview-tile')
      .forEach((tile) => {
        if (tile.dataset.previewCharacterId !== character.id) return;
        const template = document.createElement('template');
        template.innerHTML = this.manager.cssEditor.renderCssPreviewTile(character);
        tile
          .querySelectorAll('img, .character-css-preview-placeholder')
          .forEach((image) => image.remove());
        tile.prepend(
          ...template.content.querySelectorAll(
            'img, .character-css-preview-placeholder',
          ),
        );
      });
  }

  getCssCharacterImage(nameId: string) {
    const knownCssImageIds = new Set([
      ...Object.keys(window.SSBU_CHARACTERS || {}),
      'random',
      'miiall',
    ]);
    const imageNameMap: Record<string, string> = {
      eflame: 'eflame_first',
      elight: 'elight_first',
    };
    if (!knownCssImageIds.has(nameId)) {
      return null;
    }

    const imageName = imageNameMap[nameId] || nameId;
    return `../../assets/images/character-css/chara_7_${imageName}_00.png`;
  }
}
