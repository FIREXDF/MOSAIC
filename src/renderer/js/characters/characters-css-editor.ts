class CharactersCssEditorSection {
  manager: Window['charactersManager'];

  constructor(manager: Window['charactersManager']) {
    this.manager = manager;
  }

  async openAddMovesetToCssFlow(characterId: string) {
    if (this.manager.cssSaving) {
      return;
    }

    if (!this.manager.cssLoaded) {
      await this.loadCssLayout();
    }

    if (!this.manager.cssLoaded) {
      return;
    }

    const movesetCharacter = this.manager.movesetCharacters.get(characterId);
    if (!movesetCharacter) {
      return;
    }

    const duplicateOptions =
      await this.openAddMovesetToCssModal(movesetCharacter);
    if (!duplicateOptions) {
      return;
    }

    this.manager.cssSaving = true;
    this.renderCssEditor();

    try {
      const result = await window.electronAPI.duplicateCharacterCssEntry({
        sourceCharacterId: duplicateOptions.sourceCharacterId,
        newUiCharaId: duplicateOptions.newUiCharaId,
        newNameId: duplicateOptions.newNameId,
        newDisplayName: duplicateOptions.newDisplayName,
        colorStartIndex: duplicateOptions.colorStartIndex,
        colorCount: duplicateOptions.colorCount,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to add moveset to CSS');
      }

      this.manager.cssVisibleCharacters = result.visibleCharacters.map((entry) =>
        this.manager.cssImages.hydrateCssCharacter(entry),
      );
      this.manager.cssHiddenCharacters = result.hiddenCharacters.map((entry) =>
        this.manager.cssImages.hydrateCssCharacter(entry),
      );
      this.manager.cssGroups = this.hydrateCssGroups(result.groups);
      this.manager.cssCreatedGroups.clear();
      this.manager.cssSelectedCharacterId = duplicateOptions.newUiCharaId;
      this.manager.cssSelectedSlotIndex = 0;
      this.manager.cssPanelMode = 'msbt';
      this.manager.cssRenamedCharacters.clear();
      this.manager.cssCharacterUpdates.clear();
      this.manager.cssDirty = true;
      window.toastManager?.success?.(
        this.manager.t(
          'characters.movesetCss.added',
          'Moveset character added to CSS. Review settings, then Apply Layout.',
        ),
        4500,
      );
      await this.openCssEditor();
    } catch (error) {
      console.error('[CharactersManager] Failed to add moveset to CSS:', error);
      window.toastManager?.error(
        `Failed to add moveset to CSS: ${error.message || 'Unknown error'}`,
        5000,
      );
    } finally {
      this.manager.cssSaving = false;
      this.renderCssEditor();
    }
  }

  openAddMovesetToCssModal(
    movesetCharacter: CharacterMovesetGroup,
  ): Promise<MovesetCssOptions | null> {
    return new Promise((resolve) => {
      document
        .querySelector('.character-css-add-moveset-modal-overlay')
        ?.dispatchEvent(new Event('cancel-add-moveset'));
      const cssCharacters = [
        ...this.manager.cssVisibleCharacters,
        ...this.manager.cssHiddenCharacters,
      ].filter((character) => !character.isRandom && !character.isGroup);
      const preferredSource =
        cssCharacters.find(
          (character) =>
            character.nameId === movesetCharacter.id ||
            character.id === `ui_chara_${movesetCharacter.id}`,
        ) || cssCharacters[0];
      const suggestedNameId = this.getUniqueCssNameId(
        `${movesetCharacter.id}_moveset`,
      );
      const modIds = [
        ...new Set(
          movesetCharacter.mods
            .map((mod) => mod.gameBananaId)
            .filter((id): id is number => typeof id === 'number' && id > 0),
        ),
      ];
      const escape = (value: string) =>
        escapeHtml(value).replace(/"/g, '&quot;');
      const text = (
        key: string,
        fallback: string,
        params: Record<string, string> = {},
      ) => this.manager.t(`characters.movesetCss.${key}`, fallback, params);
      const label = (key: string, fallback: string) =>
        escape(text(key, fallback));
      const sourceOptions = cssCharacters
        .map(
          (character) =>
            `<option value="${escape(character.id)}" ${character.id === preferredSource?.id ? 'selected' : ''}>${escape(character.displayName)} (${escape(character.id)})</option>`,
        )
        .join('');
      const modal = document.createElement('div');
      modal.className =
        'character-modal-overlay character-css-add-moveset-modal-overlay';
      modal.innerHTML = `
<div class="character-modal character-css-duplicate-modal">
<div class="character-modal-header">
<h2>${escape(text('title', 'Add {{name}} to CSS', { name: movesetCharacter.info.name }))}</h2>
<button class="character-modal-close" type="button" aria-label="${label('cancel', 'Cancel')}"><i class="bi bi-x-lg" aria-hidden="true"></i></button>
</div>
<form class="character-modal-body character-css-duplicate-form">
<label class="character-css-field" data-umc-picker ${modIds.length ? '' : 'hidden'}>
<span>${label('moveset', 'Moveset from UMC')}</span>
<select name="umcMoveset" disabled><option>UMC</option></select>
</label>
<p class="character-css-umc-suggestion" data-umc-status role="status" aria-live="polite">${modIds.length ? label('loading', 'Loading UMC suggestions…') : label('manual', 'Enter the moveset IDs and costume range.')}</p>
<label class="character-css-field"><span>${label('base', 'Base fighter')}</span><select name="sourceCharacterId" required>${sourceOptions}</select></label>
<label class="character-css-field"><span>${label('characterId', 'New Character ID')}</span><input name="newUiCharaId" value="ui_chara_${escape(suggestedNameId)}" required autocomplete="off"></label>
<label class="character-css-field"><span>${label('nameId', 'New Name ID')}</span><input name="newNameId" value="${escape(suggestedNameId)}" required autocomplete="off"></label>
<label class="character-css-field"><span>${label('displayName', 'Display Name')}</span><input name="newDisplayName" value="${escape(movesetCharacter.info.name)}" autocomplete="off"></label>
<div class="character-css-moveset-colors">
<label class="character-css-field"><span>${label('start', 'Color Start')}</span><input name="colorStartIndex" type="number" min="0" max="255" step="1" value="${Number(preferredSource?.colorStartIndex) || 0}" required></label>
<label class="character-css-field"><span>${label('count', 'Colors')}</span><input name="colorCount" type="number" min="1" max="255" step="1" value="${Number(preferredSource?.colorNum) || 8}" required></label>
</div>
<div class="character-css-duplicate-error" role="alert" hidden></div>
<div class="character-css-duplicate-actions">
<button class="input-btn" type="button" data-action="cancel">${label('cancel', 'Cancel')}</button>
<button class="input-btn character-css-save-btn" type="submit"><i class="bi bi-plus-square" aria-hidden="true"></i>${label('add', 'Add to CSS')}</button>
</div>
</form>
</div>`;
      document.body.appendChild(modal);
      const form = modal.querySelector<HTMLFormElement>('form')!;
      const errorEl = modal.querySelector<HTMLElement>(
        '.character-css-duplicate-error',
      )!;
      const status = modal.querySelector<HTMLElement>('[data-umc-status]')!;
      const selector = form.elements.namedItem(
        'umcMoveset',
      ) as HTMLSelectElement;
      const touchedFields = new Set<string>();
      let closed = false;
      let suggestions: UmcGameBananaMoveset[] = [];
      let hasUmcRange = false;
      const input = (name: string) =>
        form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement;
      const fail = (message: string) => {
        errorEl.textContent = message;
        errorEl.hidden = false;
      };
      const close = (value: MovesetCssOptions | null) => {
        if (closed) return;
        closed = true;
        this.manager.closeCharacterModal(modal, escapeHandler);
        resolve(value);
      };
      const escapeHandler = (event: KeyboardEvent) => {
        if (event.key === 'Escape') close(null);
      };
      document.addEventListener('keydown', escapeHandler);
      modal.addEventListener('cancel-add-moveset', () => close(null));
      modal
        .querySelector('.character-modal-close')
        ?.addEventListener('click', () => close(null));
      modal
        .querySelector('[data-action="cancel"]')
        ?.addEventListener('click', () => close(null));
      this.manager.bindBackdropClose(modal, () => close(null));
      form.addEventListener('input', (event) => {
        const field = event.target as HTMLInputElement;
        if (field.name) touchedFields.add(field.name);
        errorEl.hidden = true;
      });
      input('sourceCharacterId').addEventListener('change', () => {
        touchedFields.add('sourceCharacterId');
        const source = cssCharacters.find(
          (entry) => entry.id === input('sourceCharacterId').value,
        );
        if (!source || hasUmcRange) return;
        if (!touchedFields.has('colorStartIndex'))
          input('colorStartIndex').value = source.colorStartIndex;
        if (!touchedFields.has('colorCount'))
          input('colorCount').value = source.colorNum;
      });
      const applySuggestion = (
        moveset: UmcGameBananaMoveset,
        preserveEdits: boolean,
      ) => {
        const set = (name: string, value: string) => {
          if (!preserveEdits || !touchedFields.has(name))
            input(name).value = value;
        };
        const fighterId = window.resolveFolderName
          ? window.resolveFolderName(moveset.fighterId)
          : moveset.fighterId.toLowerCase();
        const source = cssCharacters.find(
          (entry) =>
            entry.nameId === fighterId || entry.id === `ui_chara_${fighterId}`,
        );
        if (source) set('sourceCharacterId', source.id);
        const slottedId = moveset.slottedId.trim().replace(/^ui_chara_/, '');
        const hasId = /^[a-z][a-z0-9_-]{0,127}$/i.test(slottedId);
        if (hasId) {
          set('newUiCharaId', `ui_chara_${slottedId}`);
          set('newNameId', slottedId);
        } else {
          set('newUiCharaId', `ui_chara_${suggestedNameId}`);
          set('newNameId', suggestedNameId);
        }
        if (moveset.name) set('newDisplayName', moveset.name);
        const start = moveset.slotsStart;
        const end = moveset.slotsEnd;
        hasUmcRange =
          start !== null &&
          end !== null &&
          Number.isInteger(start) &&
          Number.isInteger(end) &&
          start >= 0 &&
          end >= start &&
          end <= 255 &&
          end - start + 1 <= 255;
        if (hasUmcRange) {
          set('colorStartIndex', String(start));
          set('colorCount', String(end! - start! + 1));
        } else if (source) {
          set('colorStartIndex', source.colorStartIndex);
          set('colorCount', String(Number(source.colorNum) || 8));
        }
        if (!preserveEdits) touchedFields.clear();
        status.textContent =
          hasId && hasUmcRange && moveset.detailsAvailable
            ? text(
                'prefilled',
                'UMC suggestions applied. You can edit every field before adding.',
              )
            : text(
                'partial',
                'Some UMC information is missing. Check the IDs and costume range.',
              );
        errorEl.hidden = true;
        if (
          this.getAllCssCharacters().some(
            (entry) => entry.id === input('newUiCharaId').value,
          )
        ) {
          fail(
            text(
              'existingId',
              'This Character ID already exists in the CSS. Choose another ID.',
            ),
          );
        }
      };
      selector.addEventListener('change', () => {
        const selected = suggestions.find(
          (entry) => String(entry.id) === selector.value,
        );
        if (selected) applySuggestion(selected, false);
      });
      if (modIds.length) {
        void Promise.all(
          modIds.map((modId) => this.manager.movesets.getUmcMovesets(modId, true)),
        ).then((results) => {
          if (closed || !modal.isConnected) return;
          suggestions = [
            ...new Map(
              results
                .flat()
                .filter((entry) => {
                  const fighterId = window.resolveFolderName
                    ? window.resolveFolderName(entry.fighterId)
                    : entry.fighterId.toLowerCase();
                  return fighterId === movesetCharacter.id;
                })
                .map((entry) => [entry.id, entry]),
            ).values(),
          ];
          if (!suggestions.length) {
            modal.querySelector<HTMLElement>('[data-umc-picker]')!.hidden =
              true;
            status.textContent = text(
              'unavailable',
              'No UMC information available. Enter the moveset IDs and costume range.',
            );
            return;
          }
          selector.replaceChildren(
            ...suggestions.map((moveset) => {
              const option = document.createElement('option');
              option.value = String(moveset.id);
              option.textContent = moveset.slottedId
                ? `${moveset.name} (${moveset.slottedId})`
                : moveset.name;
              return option;
            }),
          );
          selector.disabled = false;
          applySuggestion(suggestions[0], true);
        }).catch(() => {
          if (closed || !modal.isConnected) return;
          modal.querySelector<HTMLElement>('[data-umc-picker]')!.hidden = true;
          status.textContent = text('unavailable', 'No UMC information available. Enter the moveset IDs and costume range.');
        });
      }
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const sourceCharacterId = input('sourceCharacterId').value.trim();
        const newUiCharaId = input('newUiCharaId').value.trim();
        const newNameId = input('newNameId').value.trim();
        const newDisplayName = input('newDisplayName').value.trim();
        const colorStartIndex = Number(input('colorStartIndex').value);
        const colorCount = Number(input('colorCount').value);
        if (!sourceCharacterId)
          return fail(
            text('chooseBase', 'Choose the CSS character to duplicate.'),
          );
        if (
          !newUiCharaId.startsWith('ui_chara_') ||
          newUiCharaId.length <= 'ui_chara_'.length
        )
          return fail(
            text(
              'invalidId',
              'Character ID must start with ui_chara_ and include a name.',
            ),
          );
        if (
          this.getAllCssCharacters().some((entry) => entry.id === newUiCharaId)
        )
          return fail(
            text(
              'existingId',
              'This Character ID already exists in the CSS. Choose another ID.',
            ),
          );
        if (!newNameId)
          return fail(text('emptyName', 'Name ID cannot be empty.'));
        if (
          !Number.isInteger(colorStartIndex) ||
          !Number.isInteger(colorCount) ||
          colorStartIndex < 0 ||
          colorCount < 1 ||
          colorCount > 255 ||
          colorStartIndex + colorCount > 256
        )
          return fail(
            text(
              'invalidRange',
              'Choose a costume range between c00 and c255.',
            ),
          );
        close({
          sourceCharacterId,
          newUiCharaId,
          newNameId,
          newDisplayName: newDisplayName || newNameId,
          colorStartIndex,
          colorCount,
        });
      });
      input('sourceCharacterId').focus();
    });
  }

  getUniqueCssNameId(baseNameId: string) {
    const usedIds = new Set(
      this.getAllCssCharacters().flatMap((character) => [
        character.nameId,
        character.id.replace(/^ui_chara_/, ''),
      ]),
    );
    const normalizedBase =
      baseNameId
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '') || 'moveset';

    let candidate = normalizedBase;
    let suffix = 2;
    while (usedIds.has(candidate) || usedIds.has(`ui_chara_${candidate}`)) {
      candidate = `${normalizedBase}_${suffix}`;
      suffix += 1;
    }

    return candidate;
  }

  async openCssEditor() {
    const browserView = document.querySelector<HTMLElement>(
      '#characters-browser-view',
    );
    const cssEditor = document.querySelector<HTMLElement>(
      '#character-css-editor',
    );

    if (!browserView || !cssEditor) {
      return;
    }

    this.manager.switchCharacterView(
      this.manager.getActiveCharacterSubview(),
      cssEditor,
      'forward',
    );

    if (!this.manager.cssLoaded) {
      await this.loadCssLayout();
      return;
    }

    this.renderCssEditor();
  }

  closeCssEditor() {
    const browserView = document.querySelector<HTMLElement>(
      '#characters-browser-view',
    );
    const cssEditor = document.querySelector<HTMLElement>(
      '#character-css-editor',
    );

    if (browserView && cssEditor) {
      this.manager.switchCharacterView(cssEditor, browserView, 'back');
    }
  }

  async loadCssLayout() {
    const grid = document.querySelector<HTMLElement>('#character-css-grid');
    if (grid) {
      grid.innerHTML = `<div class="characters-empty-state">Loading CSS layout...</div>`;
    }

    try {
      if (this.manager.cssPrefetchPromise) {
        await this.manager.cssPrefetchPromise;
      }

      let result = this.manager.cssPrefetchedLayout;
      if (result) {
        this.manager.cssPrefetchedLayout = null;
      } else {
        result = await window.electronAPI.getCharacterCssLayout();
      }
      if (!result.success) {
        throw new Error(result.error || 'Failed to load character CSS layout');
      }

      this.manager.cssVisibleCharacters = result.visibleCharacters.map((entry) =>
        this.manager.cssImages.hydrateCssCharacter(entry),
      );
      this.manager.cssHiddenCharacters = result.hiddenCharacters.map((entry) =>
        this.manager.cssImages.hydrateCssCharacter(entry),
      );
      this.manager.cssGroups = this.hydrateCssGroups(result.groups);
      this.manager.cssCreatedGroups.clear();
      this.manager.cssRenamedCharacters.clear();
      this.manager.cssCharacterUpdates.clear();
      this.manager.cssSelectedCharacterId =
        this.manager.cssVisibleCharacters.find((character) => !character.isRandom)
          ?.id ||
        this.manager.cssVisibleCharacters[0]?.id ||
        null;
      this.manager.cssLoaded = true;
      this.manager.cssDirty = false;
      this.renderCssEditor();
    } catch (error) {
      console.error('[CharactersManager] Failed to load CSS layout:', error);
      if (grid) {
        const message = error.message || 'Failed to load CSS layout';
        grid.replaceChildren();
        this.renderCharacterCssSourceImport();
        window.toastManager?.error('toasts.failedToLoadCharacters', 4000, {
          error: message,
        });
        return;
      }
      window.toastManager?.error('toasts.failedToLoadCharacters', 4000, {
        error: error.message || 'Unknown error',
      });
    }
  }

  renderCharacterCssSourceImport() {
    const grid = document.querySelector<HTMLElement>('#character-css-grid');
    const inspector = document.querySelector<HTMLElement>(
      '#character-css-inspector',
    );
    const saveButton = document.querySelector<HTMLButtonElement>(
      '#character-css-save-btn',
    );
    const hiddenButton = document.querySelector<HTMLButtonElement>(
      '#character-css-hidden-btn',
    );
    const changeSourceButton = document.querySelector<HTMLButtonElement>(
      '#character-css-change-source-btn',
    );
    const randomizeButton = document.querySelector<HTMLButtonElement>(
      '#character-css-randomize-btn',
    );
    const previewButton = document.querySelector<HTMLButtonElement>(
      '#character-css-preview-btn',
    );
    const slotsButton = document.querySelector<HTMLButtonElement>(
      '#character-css-slots-btn',
    );
    const createGroupButton = document.querySelector<HTMLButtonElement>(
      '#character-css-create-group-btn',
    );
    const prcName = this.manager.cssSourcePrcPath
      ? this.manager.cssSourcePrcPath.split(/[\\/]/).pop()
      : this.manager.t('characters.cssSourceMissing', 'Not selected');
    const layoutName = this.manager.cssSourceLayoutPath
      ? this.manager.cssSourceLayoutPath.split(/[\\/]/).pop()
      : this.manager.t('characters.cssSourceMissing', 'Not selected');
    const msbtName = this.manager.cssSourceMsbtPath
      ? this.manager.cssSourceMsbtPath.split(/[\\/]/).pop()
      : this.manager.t('characters.cssSourceMissing', 'Not selected');
    const canImport =
      Boolean(
        this.manager.cssSourcePrcPath &&
        this.manager.cssSourceLayoutPath &&
        this.manager.cssSourceMsbtPath,
      ) && !this.manager.cssSourceImporting;

    if (grid) {
      grid.innerHTML = `
<div class="characters-empty-state character-css-source-import">
  <i class="bi bi-folder2-open"></i>
  <h3>${escapeHtml(this.manager.t('characters.cssSourceRequiredTitle', 'Character CSS source required'))}</h3>
  <div class="character-css-source-row">
    <span>PRC</span>
    <code>${escapeHtml(prcName || '')}</code>
    <button type="button" class="input-btn" data-css-source="prc">
      <i class="bi bi-file-earmark-code"></i>
      <span>${escapeHtml(this.manager.t('characters.selectCssPrc', 'Select ui_chara_db.prc'))}</span>
    </button>
  </div>
  <div class="character-css-source-row">
    <span>LAYOUT</span>
    <code>${escapeHtml(layoutName || '')}</code>
    <button type="button" class="input-btn" data-css-source="layout">
      <i class="bi bi-file-earmark-code"></i>
      <span>${escapeHtml(this.manager.t('characters.selectCssLayoutPrc', 'Select ui_layout_db.prc'))}</span>
    </button>
  </div>
  <div class="character-css-source-row">
    <span>MSBT</span>
    <code>${escapeHtml(msbtName || '')}</code>
    <button type="button" class="input-btn" data-css-source="msbt">
      <i class="bi bi-file-earmark-text"></i>
      <span>${escapeHtml(this.manager.t('characters.selectCssMsbt', 'Select msg_name.msbt'))}</span>
    </button>
  </div>
  <button type="button" class="input-btn character-css-save-btn" id="character-css-import-source-btn" ${canImport ? '' : 'disabled'}>
    <i class="bi bi-check2-circle"></i>
    <span>${escapeHtml(this.manager.cssSourceImporting ? this.manager.t('characters.importingCssSource', 'Importing...') : this.manager.t('characters.importCssSource', 'Import source files'))}</span>
  </button>
</div>
`;
      grid
        .querySelectorAll<HTMLButtonElement>('[data-css-source]')
        .forEach((button) => {
          button.addEventListener('click', () => {
            const sourceKind = button.dataset.cssSource;
            void this.selectCharacterCssSourceFile(
              sourceKind === 'msbt'
                ? 'msbt'
                : sourceKind === 'layout'
                  ? 'layout'
                  : 'prc',
            );
          });
        });
      grid
        .querySelector<HTMLButtonElement>('#character-css-import-source-btn')
        ?.addEventListener('click', () => {
          void this.importCharacterCssSourceFiles();
        });
    }

    if (inspector) {
      inspector.innerHTML = `
<div class="character-css-inspector-empty">
  <i class="bi bi-file-earmark-code"></i>
  <span>${escapeHtml(this.manager.t('characters.cssSourceInspectorHint', 'Select PRC and MSBT to edit CSS.'))}</span>
</div>
`;
    }
    if (saveButton) saveButton.disabled = true;
    if (hiddenButton) hiddenButton.disabled = true;
    if (changeSourceButton)
      changeSourceButton.disabled = this.manager.cssSourceImporting;
    if (randomizeButton) randomizeButton.disabled = true;
    if (previewButton) previewButton.disabled = true;
    if (slotsButton) slotsButton.disabled = true;
    if (createGroupButton) createGroupButton.disabled = true;
  }

  openCharacterCssSourceImport() {
    if (this.manager.cssSaving || this.manager.cssSourceImporting) {
      return;
    }

    if (this.manager.cssDirty) {
      const confirmed = window.confirm(
        this.manager.t(
          'characters.changeCssSourceConfirm',
          'Replace the current Character CSS source files? Unsaved layout changes will be lost.',
        ),
      );
      if (!confirmed) {
        return;
      }
    }

    this.manager.cssPrefetchedLayout = null;
    this.manager.cssVisibleCharacters = [];
    this.manager.cssHiddenCharacters = [];
    this.manager.cssGroups.clear();
    this.manager.cssCreatedGroups.clear();
    this.manager.cssRenamedCharacters.clear();
    this.manager.cssCharacterUpdates.clear();
    this.manager.cssSelectedCharacterId = null;
    this.manager.cssSelectedSlotIndex = 0;
    this.manager.cssLoaded = false;
    this.manager.cssDirty = false;
    this.manager.cssSourcePrcPath = null;
    this.manager.cssSourceLayoutPath = null;
    this.manager.cssSourceMsbtPath = null;
    this.renderCharacterCssSourceImport();
  }

  async selectCharacterCssSourceFile(sourceKind: 'prc' | 'layout' | 'msbt') {
    try {
      const result =
        await window.electronAPI.selectCharacterCssSourceFile(sourceKind);
      if (!result.success) {
        return;
      }

      if (sourceKind === 'prc') {
        this.manager.cssSourcePrcPath = result.filePath;
      } else if (sourceKind === 'layout') {
        this.manager.cssSourceLayoutPath = result.filePath;
      } else {
        this.manager.cssSourceMsbtPath = result.filePath;
      }
      this.renderCharacterCssSourceImport();
    } catch (error) {
      window.toastManager?.error('toasts.failedToSelectFile', 3000);
    }
  }

  async importCharacterCssSourceFiles() {
    if (
      !this.manager.cssSourcePrcPath ||
      !this.manager.cssSourceLayoutPath ||
      !this.manager.cssSourceMsbtPath ||
      this.manager.cssSourceImporting
    ) {
      return;
    }

    this.manager.cssSourceImporting = true;
    this.renderCharacterCssSourceImport();

    try {
      const result = await window.electronAPI.importCharacterCssSourceFiles({
        prcPath: this.manager.cssSourcePrcPath,
        layoutPrcPath: this.manager.cssSourceLayoutPath,
        msgNamePath: this.manager.cssSourceMsbtPath,
      });
      if (!result.success) {
        throw new Error(
          result.error || 'Failed to import Character CSS source files',
        );
      }

      this.manager.cssPrefetchedLayout = null;
      this.manager.cssVisibleCharacters = result.visibleCharacters.map((entry) =>
        this.manager.cssImages.hydrateCssCharacter(entry),
      );
      this.manager.cssHiddenCharacters = result.hiddenCharacters.map((entry) =>
        this.manager.cssImages.hydrateCssCharacter(entry),
      );
      this.manager.cssGroups = this.hydrateCssGroups(result.groups);
      this.manager.cssCreatedGroups.clear();
      this.manager.cssRenamedCharacters.clear();
      this.manager.cssCharacterUpdates.clear();
      this.manager.cssSelectedCharacterId =
        this.manager.cssVisibleCharacters.find((character) => !character.isRandom)
          ?.id ||
        this.manager.cssVisibleCharacters[0]?.id ||
        null;
      this.manager.cssLoaded = true;
      this.manager.cssDirty = false;
      this.manager.cssSourcePrcPath = null;
      this.manager.cssSourceLayoutPath = null;
      this.manager.cssSourceMsbtPath = null;
      this.manager.cssSourceImporting = false;
      this.renderCssEditor();
      window.toastManager?.success('toasts.characterCssSourceImported', 3000);
    } catch (error) {
      window.toastManager?.error('toasts.failedToLoadCharacters', 4000, {
        error: error.message || 'Unknown error',
      });
    } finally {
      this.manager.cssSourceImporting = false;
      if (!this.manager.cssLoaded) {
        this.renderCharacterCssSourceImport();
      }
    }
  }

  hydrateCssGroups(groups: Record<string, CharacterCssEntry[]> | undefined) {
    return new Map(
      Object.entries(groups || {}).map(([groupId, characters]) => [
        groupId,
        characters.map((character) => this.manager.cssImages.hydrateCssCharacter(character)),
      ]),
    );
  }

  renderCssEditor() {
    const grid = document.querySelector<HTMLElement>('#character-css-grid');
    if (!grid) {
      return;
    }

    grid.replaceChildren();
    this.manager.cssVisibleCharacters.forEach((character) => {
      grid.appendChild(this.createCssCharacterCell(character));
    });
    this.manager.cssInspector.renderCssInspector();

    const visibleCount = document.querySelector<HTMLElement>(
      '#character-css-visible-count',
    );
    const hiddenCount = document.querySelector<HTMLElement>(
      '#character-css-hidden-count',
    );
    const hiddenButton = document.querySelector<HTMLButtonElement>(
      '#character-css-hidden-btn',
    );
    const changeSourceButton = document.querySelector<HTMLButtonElement>(
      '#character-css-change-source-btn',
    );
    const randomizeButton = document.querySelector<HTMLButtonElement>(
      '#character-css-randomize-btn',
    );
    const previewButton = document.querySelector<HTMLButtonElement>(
      '#character-css-preview-btn',
    );
    const slotsButton = document.querySelector<HTMLButtonElement>(
      '#character-css-slots-btn',
    );
    const createGroupButton = document.querySelector<HTMLButtonElement>(
      '#character-css-create-group-btn',
    );
    const saveButton = document.querySelector<HTMLButtonElement>(
      '#character-css-save-btn',
    );

    if (visibleCount) {
      visibleCount.textContent = String(this.getCssPreviewCharacters().length);
    }
    if (hiddenCount) {
      hiddenCount.textContent = `${this.manager.cssHiddenCharacters.length} hidden`;
    }
    if (hiddenButton) {
      hiddenButton.disabled =
        this.manager.cssHiddenCharacters.length === 0 || this.manager.cssSaving;
    }
    if (changeSourceButton) {
      changeSourceButton.disabled = this.manager.cssSaving || this.manager.cssSourceImporting;
    }
    if (randomizeButton) {
      randomizeButton.disabled = this.manager.cssSaving;
    }
    if (previewButton) {
      previewButton.disabled =
        this.manager.cssSaving || this.manager.cssVisibleCharacters.length === 0;
    }
    if (slotsButton) {
      slotsButton.disabled = this.manager.cssSaving;
    }
    if (createGroupButton) {
      createGroupButton.disabled = this.manager.cssSaving;
    }
    if (saveButton) {
      saveButton.disabled = this.manager.cssSaving;
      saveButton.classList.toggle('is-loading', this.manager.cssSaving);
      const label = saveButton.querySelector('span');
      if (label) {
        label.textContent = this.manager.cssSaving ? 'Applying...' : 'Apply Layout';
      }
    }
  }

  createCssCharacterCell(character: CharacterCssEntry) {
    const cell = document.createElement('div');
    cell.className = 'character-css-cell';
    if (character.isGroup) {
      cell.classList.add('is-group');
    }
    if (character.id === this.manager.cssSelectedCharacterId) {
      cell.classList.add('is-selected');
    }
    cell.draggable = true;
    cell.dataset.characterId = character.id;

    const escapedName = escapeHtml(character.displayName);
    const imageMarkup =
      !character.isGroup && character.imageUrl
        ? `<img src="${escapeHtml(character.imageUrl)}" alt="${escapedName}" class="character-css-image" onerror="this.hidden=true; this.nextElementSibling.hidden=false;">`
        : '';
    const groupSize = this.manager.cssGroups.get(character.id)?.length || 0;

    cell.innerHTML = `
<div class="character-css-image-frame">
${imageMarkup}
<div class="character-css-placeholder" ${imageMarkup ? 'hidden' : ''}>
<i class="bi ${character.isGroup ? 'bi-collection-fill' : 'bi-person-circle'}"></i>
</div>
${character.imageSource === 'umc' && imageMarkup ? `<span class="character-css-image-source">${escapeHtml(this.manager.t('characters.umcImageSource', 'Image from UMC'))}</span>` : ''}
</div>
<div class="character-css-name">${escapedName}</div>
${character.isGroup ? `<span class="character-css-group-count">${groupSize}</span>` : character.number ? `<span class="character-css-number">#${escapeHtml(character.number)}</span>` : ''}
<button class="character-css-hide-btn" type="button" title="Hide">
<i class="bi bi-eye-slash"></i>
</button>
`;

    const hideButton = cell.querySelector<HTMLButtonElement>(
      '.character-css-hide-btn',
    );
    hideButton?.addEventListener('click', (event) => {
      event.stopPropagation();
      this.manager.cssSlots.hideCssCharacter(character.id);
    });

    return cell;
  }

  selectCssCharacter(characterId: string) {
    if (!this.findCssCharacter(characterId)) {
      return;
    }

    this.manager.cssSelectedCharacterId = characterId;
    this.manager.cssSelectedSlotIndex = 0;
    this.renderCssEditor();
  }

  findCssCharacter(characterId: string) {
    return (
      this.manager.cssVisibleCharacters.find(
        (character) => character.id === characterId,
      ) ||
      this.manager.cssHiddenCharacters.find(
        (character) => character.id === characterId,
      ) ||
      [...this.manager.cssGroups.values()]
        .flat()
        .find((character) => character.id === characterId) ||
      null
    );
  }

  isManagedEchoCharacter(character: CharacterCssEntry) {
    if (character.fighterType !== 'fighter_type_opened') {
      return false;
    }

    return this.getAllCssCharacters().some(
      (candidate) =>
        candidate.id === character.altCharaId &&
        candidate.fighterType === 'fighter_type_both' &&
        candidate.altCharaId === character.id,
    );
  }

  getAllCssCharacters() {
    return [
      ...this.manager.cssVisibleCharacters,
      ...this.manager.cssHiddenCharacters,
      ...[...this.manager.cssGroups.values()].flat(),
    ];
  }

  setCssCharacterUpdate(characterId: string, key: string, value: any) {
    const currentUpdate = this.manager.cssCharacterUpdates.get(characterId) || {};
    this.manager.cssCharacterUpdates.set(characterId, {
      ...currentUpdate,
      [key]: value,
    });
    this.manager.cssDirty = true;
  }

  setCssSlotUpdate(
    characterId: string,
    slotIndex: number,
    key: string,
    value: string,
  ) {
    const currentUpdate = this.manager.cssCharacterUpdates.get(characterId) || {};
    const currentSlots = currentUpdate.slots || {};
    this.manager.cssCharacterUpdates.set(characterId, {
      ...currentUpdate,
      slots: {
        ...currentSlots,
        [slotIndex]: {
          ...(currentSlots[slotIndex] || {}),
          [key]: value,
        },
      },
    });
    this.manager.cssDirty = true;
  }

  ensureUniqueCssSlotNameIndex(
    character: CharacterCssEntry,
    slot: CharacterCssSlot,
  ) {
    const currentIndex = Number(slot.nxxIndex);
    const sharesNameIndex = character.slots.some(
      (candidate) =>
        candidate.slotIndex !== slot.slotIndex &&
        Number(candidate.nxxIndex) === currentIndex,
    );
    if (!sharesNameIndex) {
      return;
    }

    const usedIndexes = new Set(
      character.slots
        .filter((candidate) => candidate.slotIndex !== slot.slotIndex)
        .map((candidate) => Number(candidate.nxxIndex))
        .filter(
          (index) => Number.isInteger(index) && index >= 0 && index <= 255,
        ),
    );
    const preferredIndex = slot.slotIndex + 8;
    const nextIndex =
      preferredIndex <= 255 && !usedIndexes.has(preferredIndex)
        ? preferredIndex
        : Array.from({ length: 255 }, (_, index) => index + 1).find(
            (index) => !usedIndexes.has(index),
          );
    if (nextIndex === undefined) {
      return;
    }

    slot.nxxIndex = String(nextIndex);
    this.setCssSlotUpdate(
      character.id,
      slot.slotIndex,
      'nxxIndex',
      slot.nxxIndex,
    );
    if (!slot.namChr1) {
      slot.namChr1 = character.displayName;
    }
    for (const key of [
      'characallLabel',
      'namChr0',
      'namChr1',
      'namChr2',
      'namChr3',
      'namStageName',
    ] as const) {
      this.setCssSlotUpdate(character.id, slot.slotIndex, key, slot[key]);
    }
    const nxxInput = document.querySelector<HTMLInputElement>(
      '[data-css-field="nxxIndex"]',
    );
    if (nxxInput) {
      nxxInput.value = slot.nxxIndex;
    }
  }

  updateSelectedCssCharacterFromInspector(
    field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  ) {
    if (!this.manager.cssSelectedCharacterId) {
      return;
    }

    const character = this.findCssCharacter(this.manager.cssSelectedCharacterId);
    if (!character) {
      return;
    }

    const key = field.dataset.cssField;
    if (!key) {
      return;
    }

    if (key === 'selectedSlot') {
      this.manager.cssSelectedSlotIndex = Number(field.value);
      this.manager.cssInspector.renderCssInspector();
      return;
    }

    const value =
      field instanceof HTMLInputElement && field.type === 'checkbox'
        ? field.checked
        : field.value;

    if (this.manager.cssPanelMode === 'msbt') {
      const slot = character.slots[this.manager.cssSelectedSlotIndex];
      if (!slot) {
        return;
      }

      if (
        ['namChr0', 'namChr1', 'namChr2', 'namChr3', 'namStageName'].includes(
          key,
        )
      ) {
        this.ensureUniqueCssSlotNameIndex(character, slot);
      }

      (slot as any)[key] = String(value);
      this.setCssSlotUpdate(
        character.id,
        this.manager.cssSelectedSlotIndex,
        key,
        String(value),
      );
      return;
    }

    if (key === 'displayName') {
      character.displayName = String(value);
      this.manager.cssRenamedCharacters.set(character.nameId, String(value));
      this.manager.cssDirty = true;
      return;
    }

    const previousImageLookupId = this.manager.cssImages.getCssCharacterLookupId(character);
    const previousNameId = character.nameId;
    if (key === 'nameId') {
      character.nameId = String(value);
    } else if (key in character) {
      (character as any)[key] = value;
    }

    if (key === 'nameId' || key === 'uiCharaId') {
      this.setCssCharacterUpdate(character.id, key, String(value));
    } else {
      this.setCssCharacterUpdate(character.id, key, value);
    }
    if (
      (key === 'uiCharaId' &&
        this.manager.cssImages.getCssCharacterLookupId(character) !== previousImageLookupId) ||
      (key === 'nameId' && character.nameId !== previousNameId)
    ) {
      this.manager.cssImages.scheduleCssCharacterImageLookup(character);
      this.manager.cssImages.refreshCssCharacterImage(character);
    }
  }

  randomizeCssLayout() {
    if (this.manager.cssSaving) {
      return;
    }

    const fixedCharacters = this.manager.cssVisibleCharacters.filter(
      (character) => character.isRandom,
    );
    const shuffledCharacters = this.manager.cssVisibleCharacters
      .filter((character) => !character.isRandom)
      .sort(() => Math.random() - 0.5);

    this.manager.cssVisibleCharacters = [...fixedCharacters, ...shuffledCharacters];
    this.manager.cssDirty = true;
    this.renderCssEditor();
  }

  getCssPreviewCharacters() {
    return this.manager.cssVisibleCharacters.flatMap((character) =>
      character.isGroup ? this.manager.cssGroups.get(character.id) || [] : [character],
    );
  }

  renderCssPreviewRows(
    characters: CharacterCssEntry[],
    oddRowIcons: number,
    evenRowIcons: number,
  ) {
    const rows: CharacterCssEntry[][] = [];
    let offset = 0;
    let isOdd = true;
    while (offset < characters.length) {
      const rowSize = Math.max(1, isOdd ? oddRowIcons : evenRowIcons);
      rows.push(characters.slice(offset, offset + rowSize));
      offset += rowSize;
      isOdd = !isOdd;
    }

    return rows
      .map(
        (row) =>
          `<div class="character-css-preview-row">${row
            .map((character) => this.renderCssPreviewTile(character))
            .join('')}</div>`,
      )
      .join('');
  }

  openCssPreviewModal() {
    const existingModal = document.querySelector<HTMLElement>(
      '.character-css-preview-overlay',
    );
    existingModal?.remove();

    const modal = document.createElement('div');
    modal.className = 'character-css-preview-overlay';
    const visibleCharacters = this.getCssPreviewCharacters();

    modal.innerHTML = `
<div class="character-css-preview-stage is-layout-only">
<button class="character-css-preview-close" type="button" title="Close">
<i class="bi bi-x-lg"></i>
</button>
<div class="character-css-preview-controls">
  <label>Odd rows <input type="number" min="1" max="64" value="13" data-preview-odd></label>
  <label>Even rows <input type="number" min="1" max="64" value="13" data-preview-even></label>
  <button class="input-btn" type="button" data-preview-refresh><i class="bi bi-arrow-clockwise"></i>Refresh</button>
</div>
<div class="character-css-preview-grid" data-preview-grid>
${this.renderCssPreviewRows(visibleCharacters, 13, 13)}
</div>
</div>
`;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal
      .querySelector<HTMLElement>('.character-css-preview-close')
      ?.addEventListener('click', close);
    const refresh = () => {
      const odd = Number(
        modal.querySelector<HTMLInputElement>('[data-preview-odd]')?.value,
      );
      const even = Number(
        modal.querySelector<HTMLInputElement>('[data-preview-even]')?.value,
      );
      const grid = modal.querySelector<HTMLElement>('[data-preview-grid]');
      if (!grid || !Number.isFinite(odd) || !Number.isFinite(even)) {
        return;
      }
      grid.innerHTML = this.renderCssPreviewRows(
        visibleCharacters,
        Math.max(1, Math.trunc(odd)),
        Math.max(1, Math.trunc(even)),
      );
    };
    modal
      .querySelector<HTMLElement>('[data-preview-refresh]')
      ?.addEventListener('click', refresh);
    modal.addEventListener('click', (event) => {
      const tile = (event.target as HTMLElement).closest<HTMLElement>(
        '[data-preview-character-id]',
      );
      if (!tile?.dataset.previewCharacterId) {
        return;
      }
      this.manager.cssSelectedCharacterId = tile.dataset.previewCharacterId;
      close();
      this.renderCssEditor();
    });
    this.manager.bindBackdropClose(modal, close);
    const escapeHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        document.removeEventListener('keydown', escapeHandler);
        close();
      }
    };
    document.addEventListener('keydown', escapeHandler);
  }

  renderCssPreviewTile(character: CharacterCssEntry) {
    const escapedName = escapeHtml(character.displayName);
    const image = character.imageUrl
      ? `<img src="${escapeHtml(character.imageUrl)}" alt="${escapedName}" onerror="this.hidden=true; this.nextElementSibling.hidden=false;">`
      : '';

    return `
<div class="character-css-preview-tile" data-preview-character-id="${escapeHtml(character.id)}">
${image}
<div class="character-css-preview-placeholder" ${character.imageUrl ? 'hidden' : ''}>
<i class="bi bi-person-fill"></i>
</div>
<span class="character-css-preview-name">${escapedName.toUpperCase()}</span>
</div>
`;
  }

  async saveCssLayout() {
    if (this.manager.cssSaving) {
      return;
    }

    this.manager.cssSaving = true;
    this.renderCssEditor();
    this.manager.cssInspector.setCssInspectorSaving(true);

    try {
      const renamedCharacters = Object.fromEntries(this.manager.cssRenamedCharacters);
      const characterUpdates = Object.fromEntries(this.manager.cssCharacterUpdates);
      const charactersById = new Map(
        this.getAllCssCharacters().map((character) => [
          character.id,
          character,
        ]),
      );
      const result = await window.electronAPI.saveCharacterCssLayout({
        visibleCharacterIds: this.manager.cssVisibleCharacters.map(
          (character) => character.id,
        ),
        hiddenCharacterIds: this.manager.cssHiddenCharacters.map(
          (character) => character.id,
        ),
        groups: Object.fromEntries(
          [...this.manager.cssGroups.entries()].map(([groupId, characters]) => [
            groupId,
            characters.map((character) => character.id),
          ]),
        ),
        createdGroups: [...this.manager.cssCreatedGroups.values()],
        renamedCharacters,
        characterUpdates,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to save character CSS layout');
      }

      const selectedCharacterId = this.manager.cssSelectedCharacterId;
      const updatedSelectedCharacterId = selectedCharacterId
        ? characterUpdates[selectedCharacterId]?.uiCharaId?.trim() ||
          selectedCharacterId
        : null;
      let layoutRefreshed = false;

      try {
        const refreshedLayout =
          await window.electronAPI.getCharacterCssLayout();
        if (!refreshedLayout.success) {
          throw new Error(
            refreshedLayout.error || 'Failed to refresh character CSS layout',
          );
        }

        this.manager.cssVisibleCharacters = refreshedLayout.visibleCharacters.map(
          (entry) => this.manager.cssImages.hydrateCssCharacter(entry),
        );
        this.manager.cssHiddenCharacters = refreshedLayout.hiddenCharacters.map(
          (entry) => this.manager.cssImages.hydrateCssCharacter(entry),
        );
        this.manager.cssGroups = this.hydrateCssGroups(refreshedLayout.groups);
        if (
          updatedSelectedCharacterId &&
          this.findCssCharacter(updatedSelectedCharacterId)
        ) {
          this.manager.cssSelectedCharacterId = updatedSelectedCharacterId;
        }
        layoutRefreshed = true;
      } catch (error) {
        console.warn(
          '[CharactersManager] Failed to refresh CSS layout after save:',
          error,
        );
      }

      if (!layoutRefreshed) {
        for (const [characterId, update] of Object.entries(characterUpdates)) {
          const updatedId = update.uiCharaId?.trim();
          const character = charactersById.get(characterId);
          if (!updatedId || !character) {
            continue;
          }

          character.id = updatedId;
          if (this.manager.cssSelectedCharacterId === characterId) {
            this.manager.cssSelectedCharacterId = updatedId;
          }
        }
      }

      this.manager.cssDirty = false;
      this.manager.cssRenamedCharacters.clear();
      this.manager.cssCharacterUpdates.clear();
      this.manager.cssCreatedGroups.clear();
      window.toastManager?.success?.(
        'Character CSS Layout saved as .prc.',
        3500,
      );
      if (result.stderr?.includes('MSBT changes')) {
        window.toastManager?.warning?.(
          'Layout saved, but MSBT names need dotnet to be regenerated.',
          6000,
        );
      }
    } catch (error) {
      console.error('[CharactersManager] Failed to save CSS layout:', error);
      window.toastManager?.error(
        `Failed to save Character CSS Layout: ${error.message || 'Unknown error'}`,
        6000,
      );
    } finally {
      this.manager.cssSaving = false;
      this.renderCssEditor();
      this.manager.cssInspector.setCssInspectorSaving(false);
    }
  }
}
