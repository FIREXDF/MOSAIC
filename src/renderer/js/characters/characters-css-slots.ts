class CharactersCssSlotsSection {
  manager: Window['charactersManager'];

  constructor(manager: Window['charactersManager']) {
    this.manager = manager;
  }

  tr(key: string, fallback: string, params: Record<string, string> = {}) {
    return escapeHtml(this.manager.t(key, fallback, params));
  }

  async openEchoSlotWizard() {
    if (
      this.manager.cssSaving ||
      this.manager.cssVisibleCharacters.length === 0
    ) {
      return;
    }

    const characters = this.manager.cssEditor
      .getAllCssCharacters()
      .filter((character) => !character.isRandom && !character.isGroup);
    const selectedCandidate = this.manager.cssEditor.findCssCharacter(
      this.manager.cssSelectedCharacterId || '',
    );
    const selected =
      selectedCandidate && !selectedCandidate.isGroup
        ? selectedCandidate
        : characters[0];
    if (!selected) {
      return;
    }
    const installedMods = new Map<string, string>();
    this.manager.characters.forEach((character) => {
      character.mods.forEach((mod) => installedMods.set(mod.path, mod.name));
    });

    const modal = document.createElement('div');
    modal.className =
      'character-modal-overlay character-css-duplicate-modal-overlay';
    modal.innerHTML = `
<div class="character-modal character-css-duplicate-modal">
<div class="character-modal-header">
<h2>${this.tr('characters.cssCreateEchoSlot', 'Create Echo Slot')}</h2>
<button class="character-modal-close" type="button"><i class="bi bi-x-lg"></i></button>
</div>
<form class="character-modal-body character-css-duplicate-form">
<label class="character-css-field"><span>${this.tr('characters.cssInstalledMod', 'Installed mod')}</span><select name="installedMod"><option value="">${this.tr('characters.cssSelectModPlaceholder', 'Select mod...')}</option>${[
      ...installedMods.entries(),
    ]
      .sort(([, left], [, right]) => left.localeCompare(right))
      .map(
        ([modPath, modName]) =>
          `<option value="${escapeHtml(modPath)}">${escapeHtml(modName)}</option>`,
      )
      .join('')}</select></label>
<button class="input-btn" type="button" data-action="browse">${this.tr('characters.cssChooseExternalMod', 'Choose external mod')}</button>
<input name="modPath" type="hidden" required>
<label class="character-css-field"><span>${this.tr('characters.cssBaseFighter', 'Base fighter')}</span><select name="sourceCharacterId">${characters.map((character) => `<option value="${escapeHtml(character.id)}" ${character.id === selected.id ? 'selected' : ''}>${escapeHtml(character.displayName)} (${escapeHtml(character.nameId)})</option>`).join('')}</select></label>
<div class="character-css-duplicate-error" data-role="detection">${this.tr('characters.cssSelectAMod', 'Select a mod.')}</div>
<label class="character-css-field"><span>${this.tr('characters.cssNewNameId', 'New Name ID')}</span><input name="newNameId" value="${escapeHtml(`${selected.nameId}_echo`)}" autocomplete="off"></label>
<label class="character-css-field"><span>${this.tr('characters.cssDisplayName', 'Display Name')}</span><input name="newDisplayName" value="${escapeHtml(`${selected.displayName} Echo`)}" autocomplete="off"></label>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
<label class="character-css-field"><span>${this.tr('characters.cssColors', 'Colors')}</span><input name="colorCount" type="number" min="1" max="8" value="8"></label>
<label class="character-css-field"><span>${this.tr('characters.cssStart', 'Start')}</span><input name="colorStartIndex" type="number" min="0" max="255" value="8"></label>
</div>
<label class="character-css-field"><span>${this.tr('characters.cssBaseModel', 'Base model')}</span><select name="useTwoBaseModels"><option value="false">${this.tr('characters.cssOneModel', 'One model: c00')}</option><option value="true">${this.tr('characters.cssTwoModels', 'Two models: c00 / c01')}</option></select></label>
<div class="character-css-duplicate-error" data-role="error" hidden></div>
<div class="character-css-duplicate-actions"><button class="input-btn" type="button" data-action="cancel">${this.tr('characters.cssCancel', 'Cancel')}</button><button class="input-btn character-css-save-btn" type="submit"><i class="bi bi-magic"></i>${this.tr('characters.cssCreateEcho', 'Create Echo')}</button></div>
</form>
</div>`;
    document.body.appendChild(modal);

    const form = modal.querySelector<HTMLFormElement>('form')!;
    const errorEl = modal.querySelector<HTMLElement>('[data-role="error"]')!;
    const close = () => this.manager.closeCharacterModal(modal);
    modal
      .querySelector<HTMLElement>('.character-modal-close')
      ?.addEventListener('click', close);
    modal
      .querySelector<HTMLElement>('[data-action="cancel"]')
      ?.addEventListener('click', close);
    this.manager.bindBackdropClose(modal, close);
    const detectMod = async (modPath: string) => {
      (form.elements.namedItem('modPath') as HTMLInputElement).value = modPath;
      const detectionEl = modal.querySelector<HTMLElement>(
        '[data-role="detection"]',
      )!;
      try {
        const scan = await window.electronAPI.scanMod(modPath);
        const fighterNames = (
          scan.success ? scan.data.fighterNames : []
        ).filter((name) => !name.startsWith('item/'));
        const detected = characters.filter((character) =>
          fighterNames.some(
            (name) => name.toLowerCase() === character.nameId.toLowerCase(),
          ),
        );
        if (detected.length === 0)
          throw new Error(
            'No SSBU fighter detected. Mod needs fighter/<character> files.',
          );
        const base =
          detected.length === 1
            ? detected[0]
            : detected.find(
                (character) =>
                  character.id ===
                  (
                    form.elements.namedItem(
                      'sourceCharacterId',
                    ) as HTMLSelectElement
                  ).value,
              ) || detected[0];
        (
          form.elements.namedItem('sourceCharacterId') as HTMLInputElement
        ).value = base.id;
        (form.elements.namedItem('newNameId') as HTMLInputElement).value =
          `${base.nameId}_echo`;
        (form.elements.namedItem('newDisplayName') as HTMLInputElement).value =
          `${base.displayName} Echo`;
        const detectedSlots = (scan.success ? scan.data.currentSlots : [])
          .filter((slot) => /^c\d{2,3}$/i.test(slot))
          .map((slot) => Number(slot.slice(1)))
          .filter((slot) => slot >= 8)
          .sort((left, right) => left - right);
        if (detectedSlots.length > 0) {
          (
            form.elements.namedItem('colorStartIndex') as HTMLInputElement
          ).value = String(detectedSlots[0]);
          (form.elements.namedItem('colorCount') as HTMLInputElement).value =
            String(Math.min(detectedSlots.length, 8));
        }
        detectionEl.textContent =
          detected.length === 1
            ? this.manager.t(
                'characters.cssEchoDetected',
                'Detected: {{name}} ({{nameId}})',
                { name: base.displayName, nameId: base.nameId },
              )
            : this.manager.t(
                'characters.cssEchoSeveralDetected',
                'Several fighters detected ({{list}}). Verify base fighter.',
                {
                  list: detected
                    .map((character) => character.nameId)
                    .join(', '),
                },
              );
        detectionEl.hidden = false;
        detectionEl.style.color = 'var(--success-color, #2ea043)';
      } catch (error) {
        detectionEl.textContent =
          error.message ||
          this.manager.t(
            'characters.cssModDetectionFailed',
            'Mod detection failed.',
          );
        detectionEl.hidden = false;
        detectionEl.style.color = '';
      }
    };
    form
      .querySelector<HTMLSelectElement>('[name="installedMod"]')
      ?.addEventListener('change', (event) => {
        const modPath = (event.target as HTMLSelectElement).value;
        if (modPath) void detectMod(modPath);
      });
    modal
      .querySelector<HTMLButtonElement>('[data-action="browse"]')
      ?.addEventListener('click', async () => {
        const modPath = await window.electronAPI.selectFolder();
        if (modPath) void detectMod(modPath);
      });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const modPath = String(data.get('modPath') || '').trim();
      if (!modPath) {
        errorEl.textContent = this.manager.t(
          'characters.cssSelectModFolder',
          'Select mod folder.',
        );
        errorEl.hidden = false;
        return;
      }
      const createButton = form.querySelector<HTMLButtonElement>(
        'button[type="submit"]',
      )!;
      const createButtonHtml = createButton.innerHTML;
      this.manager.cssSaving = true;
      createButton.disabled = true;
      createButton.innerHTML = `<i class="bi bi-arrow-repeat"></i> ${this.tr('characters.cssCreating', 'Creating...')}`;
      try {
        const result = await window.electronAPI.createEchoSlot({
          sourceCharacterId: String(data.get('sourceCharacterId')),
          newNameId: String(data.get('newNameId')),
          newDisplayName: String(data.get('newDisplayName')),
          colorCount: Number(data.get('colorCount')),
          colorStartIndex: Number(data.get('colorStartIndex')),
          useTwoBaseModels: String(data.get('useTwoBaseModels')) === 'true',
          modPath,
        });
        if (!result.success)
          throw new Error(
            result.error ||
              this.manager.t('characters.cssUnknownError', 'Unknown error'),
          );
        const warnings = Array.isArray(result.warnings) ? result.warnings : [];
        if (warnings.length > 0) {
          window.toastManager?.warning?.(
            this.manager.t(
              'characters.cssEchoCreatedWarnings',
              'Echo created. {{warnings}}',
              { warnings: warnings.join(' ') },
            ),
            8000,
          );
        } else {
          window.toastManager?.success?.(
            this.manager.t(
              'characters.cssEchoCreated',
              'Echo {{id}} created.',
              { id: result.newUiCharaId },
            ),
            5000,
          );
        }
        this.manager.cssLoaded = false;
        await this.manager.cssEditor.loadCssLayout();
        this.manager.cssSelectedCharacterId = result.newUiCharaId;
        close();
      } catch (error) {
        errorEl.textContent =
          error.message ||
          this.manager.t(
            'characters.cssEchoCreationFailed',
            'Echo creation failed.',
          );
        errorEl.hidden = false;
      } finally {
        this.manager.cssSaving = false;
        createButton.disabled = false;
        createButton.innerHTML = createButtonHtml;
        this.manager.cssEditor.renderCssEditor();
      }
    });
  }

  async duplicateSelectedCssCharacter() {
    if (!this.manager.cssSelectedCharacterId || this.manager.cssSaving) {
      return;
    }

    const character = this.manager.cssEditor.findCssCharacter(
      this.manager.cssSelectedCharacterId,
    );
    if (!character) {
      return;
    }

    const suggestedNameId = `${character.nameId}_copy`;
    const duplicateOptions = await this.openDuplicateCssCharacterModal(
      character,
      suggestedNameId,
    );
    if (!duplicateOptions) {
      return;
    }

    this.manager.cssSaving = true;
    this.manager.cssEditor.renderCssEditor();

    try {
      const result = await window.electronAPI.duplicateCharacterCssEntry({
        sourceCharacterId: character.id,
        newUiCharaId: duplicateOptions.newUiCharaId,
        newNameId: duplicateOptions.newNameId,
        newDisplayName: duplicateOptions.newDisplayName,
      });

      if (!result.success) {
        throw new Error(
          result.error ||
            this.manager.t('characters.cssUnknownError', 'Unknown error'),
        );
      }

      this.manager.cssVisibleCharacters = result.visibleCharacters.map(
        (entry) => this.manager.cssImages.hydrateCssCharacter(entry),
      );
      this.manager.cssHiddenCharacters = result.hiddenCharacters.map((entry) =>
        this.manager.cssImages.hydrateCssCharacter(entry),
      );
      this.manager.cssGroups = this.manager.cssEditor.hydrateCssGroups(
        result.groups,
      );
      this.manager.cssCreatedGroups.clear();
      this.manager.cssSelectedCharacterId = duplicateOptions.newUiCharaId;
      this.manager.cssSelectedSlotIndex = 0;
      this.manager.cssRenamedCharacters.clear();
      this.manager.cssCharacterUpdates.clear();
      this.manager.cssDirty = true;
      window.toastManager?.success?.(
        this.manager.t(
          'characters.cssDuplicated',
          'Character duplicated. Apply Layout to generate the mod.',
        ),
        4000,
      );
    } catch (error) {
      console.error(
        '[CharactersManager] Failed to duplicate CSS character:',
        error,
      );
      window.toastManager?.error(
        this.manager.t(
          'characters.cssDuplicateFailed',
          'Failed to duplicate character: {{error}}',
          {
            error:
              error.message ||
              this.manager.t('characters.cssUnknownError', 'Unknown error'),
          },
        ),
        5000,
      );
    } finally {
      this.manager.cssSaving = false;
      this.manager.cssEditor.renderCssEditor();
    }
  }

  openDuplicateCssCharacterModal(
    character: CharacterCssEntry,
    suggestedNameId: string,
  ): Promise<{
    newUiCharaId: string;
    newNameId: string;
    newDisplayName: string;
  } | null> {
    return new Promise((resolve) => {
      const existingModal = document.querySelector<HTMLElement>(
        '.character-css-duplicate-modal-overlay',
      );
      existingModal?.remove();

      const modal = document.createElement('div');
      modal.className =
        'character-modal-overlay character-css-duplicate-modal-overlay';
      modal.innerHTML = `
<div class="character-modal character-css-duplicate-modal">
<div class="character-modal-header">
<h2>${this.tr('characters.cssDuplicateTitle', 'Duplicate {{name}}', { name: character.displayName })}</h2>
<button class="character-modal-close" type="button">
<i class="bi bi-x-lg"></i>
</button>
</div>
<form class="character-modal-body character-css-duplicate-form">
<label class="character-css-field">
<span>${this.tr('characters.cssNewCharacterId', 'New Character ID')}</span>
<input name="newUiCharaId" value="ui_chara_${escapeHtml(suggestedNameId)}" autocomplete="off">
</label>
<label class="character-css-field">
<span>${this.tr('characters.cssNewNameId', 'New Name ID')}</span>
<input name="newNameId" value="${escapeHtml(suggestedNameId)}" autocomplete="off">
</label>
<label class="character-css-field">
<span>${this.tr('characters.cssDisplayName', 'Display Name')}</span>
<input name="newDisplayName" value="${escapeHtml(`${character.displayName} Copy`)}" autocomplete="off">
</label>
<div class="character-css-duplicate-error" hidden></div>
<div class="character-css-duplicate-actions">
<button class="input-btn" type="button" data-action="cancel">${this.tr('characters.cssCancel', 'Cancel')}</button>
<button class="input-btn character-css-save-btn" type="submit">
<i class="bi bi-copy"></i>
${this.tr('characters.cssDuplicate', 'Duplicate')}
</button>
</div>
</form>
</div>
`;

      document.body.appendChild(modal);

      const form = modal.querySelector<HTMLFormElement>(
        '.character-css-duplicate-form',
      )!;
      const errorEl = modal.querySelector<HTMLElement>(
        '.character-css-duplicate-error',
      )!;
      const close = (
        value: {
          newUiCharaId: string;
          newNameId: string;
          newDisplayName: string;
        } | null,
      ) => {
        this.manager.closeCharacterModal(modal);
        resolve(value);
      };

      modal
        .querySelector<HTMLElement>('.character-modal-close')
        ?.addEventListener('click', () => close(null));
      modal
        .querySelector<HTMLElement>('[data-action="cancel"]')
        ?.addEventListener('click', () => close(null));
      this.manager.bindBackdropClose(modal, () => close(null));

      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const data = new FormData(form);
        const newUiCharaId = String(data.get('newUiCharaId') || '').trim();
        const newNameId = String(data.get('newNameId') || '').trim();
        const newDisplayName = String(data.get('newDisplayName') || '').trim();

        if (!newUiCharaId.startsWith('ui_chara_')) {
          errorEl.textContent = this.manager.t(
            'characters.cssCharacterIdPrefix',
            'Character ID must start with ui_chara_.',
          );
          errorEl.hidden = false;
          return;
        }

        if (!newNameId) {
          errorEl.textContent = this.manager.t(
            'characters.cssEmptyNameId',
            'Name ID cannot be empty.',
          );
          errorEl.hidden = false;
          return;
        }

        close({
          newUiCharaId,
          newNameId,
          newDisplayName: newDisplayName || newNameId,
        });
      });

      form
        .querySelector<HTMLInputElement>('input[name="newUiCharaId"]')
        ?.focus();
    });
  }

  async removeSelectedCssCharacter() {
    if (!this.manager.cssSelectedCharacterId || this.manager.cssSaving) {
      return;
    }

    const character = this.manager.cssEditor.findCssCharacter(
      this.manager.cssSelectedCharacterId,
    );
    if (!character) {
      return;
    }

    const confirmed = await this.openRemoveCssCharacterModal(character);
    if (!confirmed) {
      return;
    }

    const isEcho = this.manager.cssEditor.isManagedEchoCharacter(character);

    this.manager.cssSaving = true;
    this.manager.cssEditor.renderCssEditor();

    try {
      const result = isEcho
        ? await window.electronAPI.removeEchoSlot({
            characterId: character.id,
          })
        : await window.electronAPI.removeCharacterCssEntry({
            characterId: character.id,
          });

      if (!result.success) {
        throw new Error(
          result.error ||
            this.manager.t('characters.cssUnknownError', 'Unknown error'),
        );
      }

      this.manager.cssVisibleCharacters = result.visibleCharacters.map(
        (entry) => this.manager.cssImages.hydrateCssCharacter(entry),
      );
      this.manager.cssHiddenCharacters = result.hiddenCharacters.map((entry) =>
        this.manager.cssImages.hydrateCssCharacter(entry),
      );
      this.manager.cssGroups = this.manager.cssEditor.hydrateCssGroups(
        result.groups,
      );
      this.manager.cssCreatedGroups.clear();
      this.manager.cssSelectedCharacterId =
        this.manager.cssVisibleCharacters[0]?.id ||
        this.manager.cssHiddenCharacters[0]?.id ||
        null;
      this.manager.cssSelectedSlotIndex = 0;
      this.manager.cssRenamedCharacters.clear();
      this.manager.cssCharacterUpdates.clear();
      this.manager.cssDirty = !isEcho;
      const removalWarnings =
        'warnings' in result && Array.isArray(result.warnings)
          ? result.warnings
          : [];
      if (removalWarnings.length > 0) {
        window.toastManager?.warning?.(removalWarnings.join(' '), 7000);
      } else {
        window.toastManager?.success?.(
          isEcho
            ? this.manager.t(
                'characters.cssEchoRemoved',
                'Echo removed. Original mod slots and files restored.',
              )
            : this.manager.t(
                'characters.cssCharacterRemoved',
                'Character removed. Apply Layout to generate the mod.',
              ),
          4000,
        );
      }
    } catch (error) {
      console.error(
        '[CharactersManager] Failed to remove CSS character:',
        error,
      );
      window.toastManager?.error(
        this.manager.t(
          'characters.cssRemoveFailed',
          'Failed to remove character: {{error}}',
          {
            error:
              error.message ||
              this.manager.t('characters.cssUnknownError', 'Unknown error'),
          },
        ),
        5000,
      );
    } finally {
      this.manager.cssSaving = false;
      this.manager.cssEditor.renderCssEditor();
    }
  }

  openRemoveCssCharacterModal(character: CharacterCssEntry): Promise<boolean> {
    return new Promise((resolve) => {
      const existingModal = document.querySelector<HTMLElement>(
        '.character-css-remove-modal-overlay',
      );
      existingModal?.remove();

      const modal = document.createElement('div');
      modal.className =
        'character-modal-overlay character-css-remove-modal-overlay';
      modal.innerHTML = `
<div class="character-modal character-css-remove-modal">
<div class="character-modal-header">
<h2>${this.tr('characters.cssRemoveCharacter', 'Remove Character')}</h2>
<button class="character-modal-close" type="button">
<i class="bi bi-x-lg"></i>
</button>
</div>
<div class="character-modal-body character-css-remove-body">
<div class="character-css-remove-preview">
<div class="character-css-hidden-thumb">
${character.imageUrl ? `<img src="${escapeHtml(character.imageUrl)}" alt="${escapeHtml(character.displayName)}">` : '<i class="bi bi-person-circle"></i>'}
</div>
<div>
<strong>${escapeHtml(character.displayName)}</strong>
<span>${escapeHtml(character.id)}</span>
</div>
</div>
<p>${
        this.manager.cssEditor.isManagedEchoCharacter(character)
          ? this.tr(
              'characters.cssRemoveEchoHint',
              'This removes the Echo and automatically restores its detected mod files, slots, config, and UI names.',
            )
          : this.tr(
              'characters.cssRemoveHint',
              'This removes the entry from the generated Character CSS data. Apply Layout after removing to rebuild the mod.',
            )
      }</p>
<div class="character-css-duplicate-actions">
<button class="input-btn" type="button" data-action="cancel">${this.tr('characters.cssCancel', 'Cancel')}</button>
<button class="input-btn character-css-danger-btn" type="button" data-action="confirm-remove">
<i class="bi bi-trash3"></i>
${this.tr('characters.cssRemove', 'Remove')}
</button>
</div>
</div>
</div>
`;

      document.body.appendChild(modal);

      const close = (value: boolean) => {
        this.manager.closeCharacterModal(modal);
        resolve(value);
      };

      modal
        .querySelector<HTMLElement>('.character-modal-close')
        ?.addEventListener('click', () => close(false));
      modal
        .querySelector<HTMLElement>('[data-action="cancel"]')
        ?.addEventListener('click', () => close(false));
      modal
        .querySelector<HTMLElement>('[data-action="confirm-remove"]')
        ?.addEventListener('click', () => close(true));
      this.manager.bindBackdropClose(modal, () => close(false));
    });
  }

  openCreateCssGroupModal() {
    if (this.manager.cssSaving) {
      return;
    }

    const modal = document.createElement('div');
    modal.className =
      'character-modal-overlay character-css-duplicate-modal-overlay';
    modal.innerHTML = `
<div class="character-modal character-css-duplicate-modal">
  <div class="character-modal-header">
    <h2>${this.tr('characters.cssCreateGroupTitle', 'Create CSS Group')}</h2>
    <button class="character-modal-close" type="button"><i class="bi bi-x-lg"></i></button>
  </div>
  <form class="character-modal-body character-css-duplicate-form">
    <label class="character-css-field"><span>${this.tr('characters.cssGroupId', 'Group ID')}</span><input name="groupId" value="ui_chara_" autocomplete="off"></label>
    <label class="character-css-field"><span>${this.tr('characters.cssNameId', 'Name ID')}</span><input name="nameId" autocomplete="off"></label>
    <label class="character-css-field"><span>${this.tr('characters.cssDisplayName', 'Display Name')}</span><input name="displayName" autocomplete="off"></label>
    <div class="character-css-duplicate-error" hidden></div>
    <div class="character-css-duplicate-actions">
      <button class="input-btn" type="button" data-action="cancel">${this.tr('characters.cssCancel', 'Cancel')}</button>
      <button class="input-btn character-css-save-btn" type="submit"><i class="bi bi-collection-fill"></i>${this.tr('characters.cssCreateGroup', 'Create Group')}</button>
    </div>
  </form>
</div>`;
    document.body.appendChild(modal);

    const close = () => this.manager.closeCharacterModal(modal);
    modal
      .querySelector<HTMLElement>('.character-modal-close')
      ?.addEventListener('click', close);
    modal
      .querySelector<HTMLElement>('[data-action="cancel"]')
      ?.addEventListener('click', close);
    this.manager.bindBackdropClose(modal, close);
    modal
      .querySelector<HTMLFormElement>('form')
      ?.addEventListener('submit', (event) => {
        event.preventDefault();
        const form = event.currentTarget as HTMLFormElement;
        const data = new FormData(form);
        const rawId = String(data.get('groupId') || '').trim();
        const id = rawId.startsWith('ui_chara_') ? rawId : `ui_chara_${rawId}`;
        const nameId = String(data.get('nameId') || '').trim();
        const displayName = String(data.get('displayName') || '').trim();
        const error = form.querySelector<HTMLElement>(
          '.character-css-duplicate-error',
        );
        const ids = new Set(
          this.manager.cssEditor.getAllCssCharacters().map((entry) => entry.id),
        );
        const nameIds = new Set(
          this.manager.cssEditor
            .getAllCssCharacters()
            .map((entry) => entry.nameId),
        );
        let message = '';
        if (id === 'ui_chara_' || !nameId || !displayName) {
          message = this.manager.t(
            'characters.cssGroupFieldsRequired',
            'All group fields are required.',
          );
        } else if (ids.has(id)) {
          message = this.manager.t(
            'characters.cssIdExists',
            'The ID {{id}} already exists.',
            { id },
          );
        } else if (nameIds.has(nameId)) {
          message = this.manager.t(
            'characters.cssNameIdExists',
            'The Name ID {{id}} already exists.',
            { id: nameId },
          );
        }
        if (message) {
          if (error) {
            error.textContent = message;
            error.hidden = false;
          }
          return;
        }

        const group: CharacterCssEntry = {
          id,
          nameId,
          displayName,
          number: '',
          imageUrl: null,
          order: this.manager.cssVisibleCharacters.length,
          hidden: false,
          canSelect: false,
          isRandom: false,
          uiSeriesId: '',
          fighterKind: '',
          fighterKindCorps: '',
          altCharaId: '',
          fighterType: '',
          exhibitYear: '',
          colorNum: '0',
          colorStartIndex: '0',
          isMii: false,
          isBoss: false,
          isHiddenBoss: false,
          isGroup: true,
          groupId: null,
          slots: [],
        };
        const selectedIndex = this.manager.cssVisibleCharacters.findIndex(
          (entry) => entry.id === this.manager.cssSelectedCharacterId,
        );
        this.manager.cssVisibleCharacters.splice(
          selectedIndex >= 0
            ? selectedIndex + 1
            : this.manager.cssVisibleCharacters.length,
          0,
          group,
        );
        this.manager.cssGroups.set(id, []);
        this.manager.cssCreatedGroups.set(id, { id, nameId, displayName });
        this.manager.cssSelectedCharacterId = id;
        this.manager.cssDirty = true;
        close();
        this.manager.cssEditor.renderCssEditor();
      });
  }

  openMoveCssCharacterToGroupModal(character: CharacterCssEntry) {
    if (this.manager.cssSaving || character.isGroup) {
      return;
    }

    const modal = document.createElement('div');
    modal.className =
      'character-modal-overlay character-css-duplicate-modal-overlay';
    const options = [
      `<option value="">${this.tr('characters.cssRootDisplayed', 'Root / Displayed')}</option>`,
      ...[...this.manager.cssGroups.keys()].map((groupId) => {
        const group = this.manager.cssEditor.findCssCharacter(groupId);
        return `<option value="${escapeHtml(groupId)}" ${character.groupId === groupId ? 'selected' : ''}>${escapeHtml(group?.displayName || groupId)}</option>`;
      }),
    ].join('');
    modal.innerHTML = `
<div class="character-modal character-css-duplicate-modal">
  <div class="character-modal-header">
    <h2>${this.tr('characters.cssMoveTitle', 'Move {{name}}', { name: character.displayName })}</h2>
    <button class="character-modal-close" type="button"><i class="bi bi-x-lg"></i></button>
  </div>
  <form class="character-modal-body character-css-duplicate-form">
    <label class="character-css-field"><span>${this.tr('characters.cssDestination', 'Destination')}</span><select name="groupId">${options}</select></label>
    <div class="character-css-duplicate-actions">
      <button class="input-btn" type="button" data-action="cancel">${this.tr('characters.cssCancel', 'Cancel')}</button>
      <button class="input-btn character-css-save-btn" type="submit"><i class="bi bi-folder-symlink"></i>${this.tr('characters.cssMove', 'Move')}</button>
    </div>
  </form>
</div>`;
    document.body.appendChild(modal);
    const close = () => this.manager.closeCharacterModal(modal);
    modal
      .querySelector<HTMLElement>('.character-modal-close')
      ?.addEventListener('click', close);
    modal
      .querySelector<HTMLElement>('[data-action="cancel"]')
      ?.addEventListener('click', close);
    this.manager.bindBackdropClose(modal, close);
    modal
      .querySelector<HTMLFormElement>('form')
      ?.addEventListener('submit', (event) => {
        event.preventDefault();
        const groupId = String(
          new FormData(event.currentTarget as HTMLFormElement).get('groupId') ||
            '',
        );
        this.moveCssCharacterToGroup(character.id, groupId || null);
        close();
      });
  }

  moveCssCharacterToGroup(characterId: string, groupId: string | null) {
    const character = this.manager.cssEditor.findCssCharacter(characterId);
    if (!character || character.isGroup || character.groupId === groupId) {
      return;
    }

    this.manager.cssVisibleCharacters =
      this.manager.cssVisibleCharacters.filter(
        (entry) => entry.id !== characterId,
      );
    this.manager.cssHiddenCharacters = this.manager.cssHiddenCharacters.filter(
      (entry) => entry.id !== characterId,
    );
    for (const members of this.manager.cssGroups.values()) {
      const index = members.findIndex((entry) => entry.id === characterId);
      if (index >= 0) {
        members.splice(index, 1);
      }
    }

    character.groupId = groupId;
    character.hidden = false;
    if (groupId) {
      const members = this.manager.cssGroups.get(groupId);
      if (!members) {
        throw new Error(`CSS group not found: ${groupId}`);
      }
      members.push(character);
    } else {
      this.manager.cssVisibleCharacters.push(character);
    }
    this.manager.cssSelectedCharacterId = character.id;
    this.manager.cssDirty = true;
    this.manager.cssEditor.renderCssEditor();
  }

  openCssGroupModal(groupId: string) {
    const group = this.manager.cssEditor.findCssCharacter(groupId);
    if (!group?.isGroup) {
      return;
    }
    document
      .querySelector<HTMLElement>('.character-css-group-modal-overlay')
      ?.remove();

    const members = this.manager.cssGroups.get(groupId) || [];
    const modal = document.createElement('div');
    modal.className =
      'character-modal-overlay character-css-group-modal-overlay';
    modal.innerHTML = `
<div class="character-modal character-css-group-modal">
  <div class="character-modal-header">
    <h2>${escapeHtml(group.displayName)}</h2>
    <button class="character-modal-close" type="button"><i class="bi bi-x-lg"></i></button>
  </div>
  <div class="character-modal-body">
    <p class="character-css-group-help">${this.tr('characters.cssGroupHelp', 'Characters inside a group keep their own display order. Use the arrows to reorder or return one to the root list.')}</p>
    <div class="character-css-hidden-list">
      ${
        members
          .map(
            (character, index) => `
<div class="character-css-hidden-row character-css-group-row" data-character-id="${escapeHtml(character.id)}">
  <div class="character-css-hidden-thumb">
    ${character.imageUrl ? `<img src="${escapeHtml(character.imageUrl)}" alt="${escapeHtml(character.displayName)}">` : '<i class="bi bi-person-circle"></i>'}
  </div>
  <button class="character-css-group-character" type="button" data-action="select">${escapeHtml(character.displayName)}</button>
  <div class="character-css-group-actions">
    <button class="input-btn" type="button" data-action="up" ${index === 0 ? 'disabled' : ''} title="${this.tr('characters.cssMoveUp', 'Move up')}"><i class="bi bi-arrow-up"></i></button>
    <button class="input-btn" type="button" data-action="down" ${index === members.length - 1 ? 'disabled' : ''} title="${this.tr('characters.cssMoveDown', 'Move down')}"><i class="bi bi-arrow-down"></i></button>
    <button class="input-btn" type="button" data-action="ungroup" title="${this.tr('characters.cssMoveToRoot', 'Move to root')}"><i class="bi bi-box-arrow-up-right"></i></button>
  </div>
</div>`,
          )
          .join('') ||
        `<div class="characters-empty-state">${this.tr('characters.cssGroupEmpty', 'This group is empty. Select a fighter and use “Move to Group”.')}</div>`
      }
    </div>
  </div>
</div>`;
    document.body.appendChild(modal);
    const close = () => this.manager.closeCharacterModal(modal);
    modal
      .querySelector<HTMLElement>('.character-modal-close')
      ?.addEventListener('click', close);
    this.manager.bindBackdropClose(modal, close);
    modal
      .querySelectorAll<HTMLElement>('.character-css-group-row')
      .forEach((row) => {
        const characterId = row.dataset.characterId!;
        row
          .querySelector<HTMLElement>('[data-action="select"]')
          ?.addEventListener('click', () => {
            this.manager.cssSelectedCharacterId = characterId;
            close();
            this.manager.cssEditor.renderCssEditor();
          });
        row
          .querySelector<HTMLElement>('[data-action="ungroup"]')
          ?.addEventListener('click', () => {
            modal.remove();
            this.moveCssCharacterToGroup(characterId, null);
          });
        (['up', 'down'] as const).forEach((action) => {
          row
            .querySelector<HTMLElement>(`[data-action="${action}"]`)
            ?.addEventListener('click', () => {
              const currentIndex = members.findIndex(
                (entry) => entry.id === characterId,
              );
              const nextIndex = currentIndex + (action === 'up' ? -1 : 1);
              if (
                currentIndex < 0 ||
                nextIndex < 0 ||
                nextIndex >= members.length
              ) {
                return;
              }
              const [member] = members.splice(currentIndex, 1);
              members.splice(nextIndex, 0, member);
              this.manager.cssDirty = true;
              modal.remove();
              this.openCssGroupModal(groupId);
            });
        });
      });
  }

  moveCssCharacter(sourceId: string, targetId: string) {
    if (sourceId === targetId || this.manager.cssSaving) {
      return;
    }

    const sourceIndex = this.manager.cssVisibleCharacters.findIndex(
      (character) => character.id === sourceId,
    );
    const targetIndex = this.manager.cssVisibleCharacters.findIndex(
      (character) => character.id === targetId,
    );

    if (sourceIndex < 0 || targetIndex < 0) {
      return;
    }

    const [character] = this.manager.cssVisibleCharacters.splice(
      sourceIndex,
      1,
    );
    this.manager.cssVisibleCharacters.splice(targetIndex, 0, character);
    this.manager.cssSelectedCharacterId = character.id;
    this.manager.cssDirty = true;
    this.manager.cssEditor.renderCssEditor();
  }

  hideCssCharacter(characterId: string) {
    if (this.manager.cssSaving) {
      return;
    }

    const index = this.manager.cssVisibleCharacters.findIndex(
      (character) => character.id === characterId,
    );
    if (index < 0) {
      return;
    }

    const [character] = this.manager.cssVisibleCharacters.splice(index, 1);
    if (this.manager.cssSelectedCharacterId === character.id) {
      this.manager.cssSelectedCharacterId =
        this.manager.cssVisibleCharacters[0]?.id || null;
    }
    this.manager.cssHiddenCharacters = [
      ...this.manager.cssHiddenCharacters,
      character,
    ].sort((left, right) => left.displayName.localeCompare(right.displayName));
    this.manager.cssDirty = true;
    this.manager.cssEditor.renderCssEditor();
  }

  unhideCssCharacter(characterId: string) {
    if (this.manager.cssSaving) {
      return;
    }

    const index = this.manager.cssHiddenCharacters.findIndex(
      (character) => character.id === characterId,
    );
    if (index < 0) {
      return;
    }

    const [character] = this.manager.cssHiddenCharacters.splice(index, 1);
    this.manager.cssVisibleCharacters = [
      ...this.manager.cssVisibleCharacters,
      character,
    ];
    this.manager.cssSelectedCharacterId = character.id;
    this.manager.cssDirty = true;
    this.manager.cssEditor.renderCssEditor();
  }

  openHiddenCssCharactersModal() {
    const existingModal = document.querySelector<HTMLElement>(
      '.character-css-hidden-modal-overlay',
    );
    existingModal?.remove();

    const modal = document.createElement('div');
    modal.className =
      'character-modal-overlay character-css-hidden-modal-overlay';
    modal.innerHTML = `
<div class="character-modal character-css-hidden-modal">
<div class="character-modal-header">
<h2>${this.tr('characters.cssHiddenTitle', 'Hidden CSS Characters')}</h2>
<button class="character-modal-close" type="button">
<i class="bi bi-x-lg"></i>
</button>
</div>
<div class="character-modal-body">
<div class="character-css-hidden-list">
${
  this.manager.cssHiddenCharacters
    .map((character) => {
      const imageUrl = character.imageUrl || '';
      return `
<div class="character-css-hidden-row" data-character-id="${escapeHtml(character.id)}">
<div class="character-css-hidden-thumb">
${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(character.displayName)}">` : '<i class="bi bi-person-circle"></i>'}
</div>
<span>${escapeHtml(character.displayName)}</span>
<button class="input-btn" type="button" data-action="unhide-character">
<i class="bi bi-eye"></i>
${this.tr('characters.cssUnhide', 'Unhide')}
</button>
</div>
`;
    })
    .join('') ||
  `<div class="characters-empty-state">${this.tr('characters.cssNoHidden', 'No hidden characters')}</div>`
}
</div>
</div>
</div>
`;

    document.body.appendChild(modal);

    const close = () => this.manager.closeCharacterModal(modal);
    modal
      .querySelector<HTMLElement>('.character-modal-close')
      ?.addEventListener('click', close);
    this.manager.bindBackdropClose(modal, close);
    modal
      .querySelectorAll<HTMLElement>('[data-action="unhide-character"]')
      .forEach((button) => {
        button.addEventListener('click', () => {
          const row = button.closest<HTMLElement>('.character-css-hidden-row');
          if (!row?.dataset.characterId) return;
          this.unhideCssCharacter(row.dataset.characterId);
          row.remove();

          const hiddenList = modal.querySelector<HTMLElement>(
            '.character-css-hidden-list',
          );
          if (
            hiddenList &&
            !hiddenList.querySelector('.character-css-hidden-row')
          ) {
            hiddenList.innerHTML = `<div class="characters-empty-state">${this.tr('characters.cssNoHidden', 'No hidden characters')}</div>`;
          }
        });
      });
  }

  openCssUsedSlotsModal() {
    const fighters = this.manager.cssEditor
      .getAllCssCharacters()
      .filter(
        (character) =>
          !character.isGroup &&
          character.fighterKind.trim() &&
          Number(character.colorNum) > 0,
      );
    const usage = new Map<string, Map<number, CharacterCssEntry[]>>();
    fighters.forEach((character) => {
      const fighterSlots =
        usage.get(character.fighterKind) ||
        new Map<number, CharacterCssEntry[]>();
      const start = Math.max(0, Number(character.colorStartIndex) || 0);
      const count = Math.max(0, Number(character.colorNum) || 0);
      for (let slot = start; slot < Math.min(256, start + count); slot += 1) {
        const characters = fighterSlots.get(slot) || [];
        characters.push(character);
        fighterSlots.set(slot, characters);
      }
      usage.set(character.fighterKind, fighterSlots);
    });

    const modal = document.createElement('div');
    modal.className =
      'character-modal-overlay character-css-slots-modal-overlay';
    const header = Array.from(
      { length: 256 },
      (_, slot) => `<th scope="col">${slot}</th>`,
    ).join('');
    const usedSlotCount = [...usage.values()].reduce(
      (count, slots) =>
        count +
        [...slots.values()].filter((characters) => characters.length > 0)
          .length,
      0,
    );
    const conflictCount = [...usage.values()].reduce(
      (count, slots) =>
        count +
        [...slots.values()].filter((characters) => characters.length > 1)
          .length,
      0,
    );
    const rows = [...usage.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([fighterKind, slots]) => {
        const cells = Array.from({ length: 256 }, (_, slot) => {
          const characters = slots.get(slot) || [];
          if (characters.length === 0) {
            return '<td class="is-empty" aria-hidden="true"></td>';
          }
          const names = characters
            .map((character) => `${character.displayName} (${character.id})`)
            .join('\n');
          const isConflict = characters.length > 1;
          const stateLabel = isConflict
            ? this.manager.t(
                'characters.cssSlotConflict',
                '{{count}} characters conflict',
                { count: String(characters.length) },
              )
            : this.manager.t('characters.cssSlotUsed', 'Slot used');
          return `<td class="${isConflict ? 'is-conflict' : 'is-used'}" title="${escapeHtml(names)}" data-character-id="${escapeHtml(characters[0].id)}" role="button" tabindex="0" aria-label="${this.tr('characters.cssSlotAria', '{{fighter}}, slot {{slot}}: {{state}}', { fighter: fighterKind, slot: String(slot), state: stateLabel })}"><span>${isConflict ? characters.length : '<i class="bi bi-check2"></i>'}</span></td>`;
        }).join('');
        return `<tr><th class="character-css-slots-fighter" scope="row"><span>${escapeHtml(fighterKind)}</span></th>${cells}</tr>`;
      })
      .join('');
    modal.innerHTML = `
<div class="character-modal character-css-slots-modal">
  <div class="character-modal-header">
    <div class="character-css-slots-heading">
      <span class="character-css-slots-heading-icon"><i class="bi bi-grid-3x3-gap-fill"></i></span>
      <div>
        <h2>${this.tr('characters.cssUsedSlots', 'Used Slots')}</h2>
        <p>${this.tr('characters.cssUsedSlotsHint', 'Review fighter slot allocation and resolve overlaps.')}</p>
      </div>
    </div>
    <button class="character-modal-close" type="button" aria-label="${this.tr('characters.cssCloseUsedSlots', 'Close Used Slots')}"><i class="bi bi-x-lg"></i></button>
  </div>
  <div class="character-css-slots-summary">
    <div class="character-css-slots-stats" aria-label="${this.tr('characters.cssSlotSummary', 'Slot summary')}">
      <span><strong>${usage.size}</strong> ${this.tr('characters.cssFighterKinds', 'fighter kinds')}</span>
      <span><strong>${usedSlotCount}</strong> ${this.tr('characters.cssUsedSlotsCount', 'used slots')}</span>
      <span class="${conflictCount > 0 ? 'has-conflicts' : ''}"><strong>${conflictCount}</strong> ${this.tr('characters.cssConflicts', 'conflicts')}</span>
    </div>
    <div class="character-css-slots-legend" aria-label="${this.tr('characters.cssLegend', 'Legend')}">
      <span class="is-used"><i></i>${this.tr('characters.cssUsed', 'Used')}</span>
      <span class="is-conflict"><i></i>${this.tr('characters.cssConflict', 'Conflict')}</span>
      <span class="is-empty"><i></i>${this.tr('characters.cssAvailable', 'Available')}</span>
    </div>
  </div>
  <div class="character-css-slots-scroll">
    ${
      rows
        ? `<table class="character-css-slots-table">
      <thead><tr><th class="character-css-slots-fighter" scope="col"><span>${this.tr('characters.cssFighterKind', 'Fighter Kind')}</span></th>${header}</tr></thead>
      <tbody>${rows}</tbody>
    </table>`
        : `<div class="character-css-slots-empty">
      <i class="bi bi-grid-3x3-gap"></i>
      <strong>${this.tr('characters.cssNoFighterSlots', 'No fighter slots found')}</strong>
      <span>${this.tr('characters.cssNoFighterSlotsHint', 'Import a Character CSS source to inspect its slot allocation.')}</span>
    </div>`
    }
  </div>
</div>`;
    document.body.appendChild(modal);
    const close = () => this.manager.closeCharacterModal(modal);
    modal
      .querySelector<HTMLElement>('.character-modal-close')
      ?.addEventListener('click', close);
    this.manager.bindBackdropClose(modal, close);
    modal
      .querySelectorAll<HTMLElement>('[data-character-id]')
      .forEach((cell) => {
        const selectCharacter = () => {
          const characterId = cell.dataset.characterId;
          if (!characterId) return;
          this.manager.cssSelectedCharacterId = characterId;
          const character =
            this.manager.cssEditor.findCssCharacter(characterId);
          if (character?.groupId) {
            this.openCssGroupModal(character.groupId);
          }
          close();
          this.manager.cssEditor.renderCssEditor();
        };
        cell.addEventListener('click', selectCharacter);
        cell.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            selectCharacter();
          }
        });
      });
  }
}
