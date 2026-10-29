class CharactersCssSlotsSection {
  manager: Window['charactersManager'];

  constructor(manager: Window['charactersManager']) {
    this.manager = manager;
  }

  async openEchoSlotWizard() {
    if (this.manager.cssSaving || this.manager.cssVisibleCharacters.length === 0) {
      return;
    }

    const characters = this.manager.cssEditor.getAllCssCharacters().filter(
      (character) => !character.isRandom && !character.isGroup,
    );
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
<h2>Create Echo Slot</h2>
<button class="character-modal-close" type="button"><i class="bi bi-x-lg"></i></button>
</div>
<form class="character-modal-body character-css-duplicate-form">
<label class="character-css-field"><span>Installed mod</span><select name="installedMod"><option value="">Select mod...</option>${[
      ...installedMods.entries(),
    ]
      .sort(([, left], [, right]) => left.localeCompare(right))
      .map(
        ([modPath, modName]) =>
          `<option value="${escapeHtml(modPath)}">${escapeHtml(modName)}</option>`,
      )
      .join('')}</select></label>
<button class="input-btn" type="button" data-action="browse">Choose external mod</button>
<input name="modPath" type="hidden" required>
<label class="character-css-field"><span>Base fighter</span><select name="sourceCharacterId">${characters.map((character) => `<option value="${escapeHtml(character.id)}" ${character.id === selected.id ? 'selected' : ''}>${escapeHtml(character.displayName)} (${escapeHtml(character.nameId)})</option>`).join('')}</select></label>
<div class="character-css-duplicate-error" data-role="detection">Select a mod.</div>
<label class="character-css-field"><span>New Name ID</span><input name="newNameId" value="${escapeHtml(`${selected.nameId}_echo`)}" autocomplete="off"></label>
<label class="character-css-field"><span>Display Name</span><input name="newDisplayName" value="${escapeHtml(`${selected.displayName} Echo`)}" autocomplete="off"></label>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
<label class="character-css-field"><span>Colors</span><input name="colorCount" type="number" min="1" max="8" value="8"></label>
<label class="character-css-field"><span>Start</span><input name="colorStartIndex" type="number" min="0" max="255" value="8"></label>
</div>
<label class="character-css-field"><span>Base model</span><select name="useTwoBaseModels"><option value="false">One model: c00</option><option value="true">Two models: c00 / c01</option></select></label>
<div class="character-css-duplicate-error" data-role="error" hidden></div>
<div class="character-css-duplicate-actions"><button class="input-btn" type="button" data-action="cancel">Cancel</button><button class="input-btn character-css-save-btn" type="submit"><i class="bi bi-magic"></i>Create Echo</button></div>
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
            ? `Detected: ${base.displayName} (${base.nameId})`
            : `Several fighters detected (${detected.map((character) => character.nameId).join(', ')}). Verify base fighter.`;
        detectionEl.hidden = false;
        detectionEl.style.color = 'var(--success-color, #2ea043)';
      } catch (error) {
        detectionEl.textContent = error.message || 'Mod detection failed.';
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
        errorEl.textContent = 'Select mod folder.';
        errorEl.hidden = false;
        return;
      }
      const createButton = form.querySelector<HTMLButtonElement>(
        'button[type="submit"]',
      )!;
      const createButtonHtml = createButton.innerHTML;
      this.manager.cssSaving = true;
      createButton.disabled = true;
      createButton.innerHTML = '<i class="bi bi-arrow-repeat"></i> Creating...';
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
          throw new Error(result.error || 'Echo creation failed');
        const warnings = Array.isArray(result.warnings) ? result.warnings : [];
        if (warnings.length > 0) {
          window.toastManager?.warning?.(
            `Echo created. ${warnings.join(' ')}`,
            8000,
          );
        } else {
          window.toastManager?.success?.(
            `Echo ${result.newUiCharaId} created.`,
            5000,
          );
        }
        this.manager.cssLoaded = false;
        await this.manager.cssEditor.loadCssLayout();
        this.manager.cssSelectedCharacterId = result.newUiCharaId;
        close();
      } catch (error) {
        errorEl.textContent = error.message || 'Echo creation failed.';
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

    const character = this.manager.cssEditor.findCssCharacter(this.manager.cssSelectedCharacterId);
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
        throw new Error(result.error || 'Failed to duplicate character');
      }

      this.manager.cssVisibleCharacters = result.visibleCharacters.map((entry) =>
        this.manager.cssImages.hydrateCssCharacter(entry),
      );
      this.manager.cssHiddenCharacters = result.hiddenCharacters.map((entry) =>
        this.manager.cssImages.hydrateCssCharacter(entry),
      );
      this.manager.cssGroups = this.manager.cssEditor.hydrateCssGroups(result.groups);
      this.manager.cssCreatedGroups.clear();
      this.manager.cssSelectedCharacterId = duplicateOptions.newUiCharaId;
      this.manager.cssSelectedSlotIndex = 0;
      this.manager.cssRenamedCharacters.clear();
      this.manager.cssCharacterUpdates.clear();
      this.manager.cssDirty = true;
      window.toastManager?.success?.(
        'Character duplicated. Apply Layout to generate the mod.',
        4000,
      );
    } catch (error) {
      console.error(
        '[CharactersManager] Failed to duplicate CSS character:',
        error,
      );
      window.toastManager?.error(
        `Failed to duplicate character: ${error.message || 'Unknown error'}`,
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
<h2>Duplicate ${escapeHtml(character.displayName)}</h2>
<button class="character-modal-close" type="button">
<i class="bi bi-x-lg"></i>
</button>
</div>
<form class="character-modal-body character-css-duplicate-form">
<label class="character-css-field">
<span>New Character ID</span>
<input name="newUiCharaId" value="ui_chara_${escapeHtml(suggestedNameId)}" autocomplete="off">
</label>
<label class="character-css-field">
<span>New Name ID</span>
<input name="newNameId" value="${escapeHtml(suggestedNameId)}" autocomplete="off">
</label>
<label class="character-css-field">
<span>Display Name</span>
<input name="newDisplayName" value="${escapeHtml(`${character.displayName} Copy`)}" autocomplete="off">
</label>
<div class="character-css-duplicate-error" hidden></div>
<div class="character-css-duplicate-actions">
<button class="input-btn" type="button" data-action="cancel">Cancel</button>
<button class="input-btn character-css-save-btn" type="submit">
<i class="bi bi-copy"></i>
Duplicate
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
          errorEl.textContent = 'Character ID must start with ui_chara_.';
          errorEl.hidden = false;
          return;
        }

        if (!newNameId) {
          errorEl.textContent = 'Name ID cannot be empty.';
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

    const character = this.manager.cssEditor.findCssCharacter(this.manager.cssSelectedCharacterId);
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
        throw new Error(result.error || 'Failed to remove character');
      }

      this.manager.cssVisibleCharacters = result.visibleCharacters.map((entry) =>
        this.manager.cssImages.hydrateCssCharacter(entry),
      );
      this.manager.cssHiddenCharacters = result.hiddenCharacters.map((entry) =>
        this.manager.cssImages.hydrateCssCharacter(entry),
      );
      this.manager.cssGroups = this.manager.cssEditor.hydrateCssGroups(result.groups);
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
            ? 'Echo removed. Original mod slots and files restored.'
            : 'Character removed. Apply Layout to generate the mod.',
          4000,
        );
      }
    } catch (error) {
      console.error(
        '[CharactersManager] Failed to remove CSS character:',
        error,
      );
      window.toastManager?.error(
        `Failed to remove character: ${error.message || 'Unknown error'}`,
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
<h2>Remove Character</h2>
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
          ? 'This removes the Echo and automatically restores its detected mod files, slots, config, and UI names.'
          : 'This removes the entry from the generated Character CSS data. Apply Layout after removing to rebuild the mod.'
      }</p>
<div class="character-css-duplicate-actions">
<button class="input-btn" type="button" data-action="cancel">Cancel</button>
<button class="input-btn character-css-danger-btn" type="button" data-action="confirm-remove">
<i class="bi bi-trash3"></i>
Remove
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
    <h2>Create CSS Group</h2>
    <button class="character-modal-close" type="button"><i class="bi bi-x-lg"></i></button>
  </div>
  <form class="character-modal-body character-css-duplicate-form">
    <label class="character-css-field"><span>Group ID</span><input name="groupId" value="ui_chara_" autocomplete="off"></label>
    <label class="character-css-field"><span>Name ID</span><input name="nameId" autocomplete="off"></label>
    <label class="character-css-field"><span>Display Name</span><input name="displayName" autocomplete="off"></label>
    <div class="character-css-duplicate-error" hidden></div>
    <div class="character-css-duplicate-actions">
      <button class="input-btn" type="button" data-action="cancel">Cancel</button>
      <button class="input-btn character-css-save-btn" type="submit"><i class="bi bi-collection-fill"></i>Create Group</button>
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
          this.manager.cssEditor.getAllCssCharacters().map((entry) => entry.nameId),
        );
        let message = '';
        if (id === 'ui_chara_' || !nameId || !displayName) {
          message = 'All group fields are required.';
        } else if (ids.has(id)) {
          message = `The ID ${id} already exists.`;
        } else if (nameIds.has(nameId)) {
          message = `The Name ID ${nameId} already exists.`;
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
      '<option value="">Root / Displayed</option>',
      ...[...this.manager.cssGroups.keys()].map((groupId) => {
        const group = this.manager.cssEditor.findCssCharacter(groupId);
        return `<option value="${escapeHtml(groupId)}" ${character.groupId === groupId ? 'selected' : ''}>${escapeHtml(group?.displayName || groupId)}</option>`;
      }),
    ].join('');
    modal.innerHTML = `
<div class="character-modal character-css-duplicate-modal">
  <div class="character-modal-header">
    <h2>Move ${escapeHtml(character.displayName)}</h2>
    <button class="character-modal-close" type="button"><i class="bi bi-x-lg"></i></button>
  </div>
  <form class="character-modal-body character-css-duplicate-form">
    <label class="character-css-field"><span>Destination</span><select name="groupId">${options}</select></label>
    <div class="character-css-duplicate-actions">
      <button class="input-btn" type="button" data-action="cancel">Cancel</button>
      <button class="input-btn character-css-save-btn" type="submit"><i class="bi bi-folder-symlink"></i>Move</button>
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

    this.manager.cssVisibleCharacters = this.manager.cssVisibleCharacters.filter(
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
    <p class="character-css-group-help">Characters inside a group keep their own display order. Use the arrows to reorder or return one to the root list.</p>
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
    <button class="input-btn" type="button" data-action="up" ${index === 0 ? 'disabled' : ''} title="Move up"><i class="bi bi-arrow-up"></i></button>
    <button class="input-btn" type="button" data-action="down" ${index === members.length - 1 ? 'disabled' : ''} title="Move down"><i class="bi bi-arrow-down"></i></button>
    <button class="input-btn" type="button" data-action="ungroup" title="Move to root"><i class="bi bi-box-arrow-up-right"></i></button>
  </div>
</div>`,
          )
          .join('') ||
        '<div class="characters-empty-state">This group is empty. Select a fighter and use “Move to Group”.</div>'
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

    const [character] = this.manager.cssVisibleCharacters.splice(sourceIndex, 1);
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
      this.manager.cssSelectedCharacterId = this.manager.cssVisibleCharacters[0]?.id || null;
    }
    this.manager.cssHiddenCharacters = [...this.manager.cssHiddenCharacters, character].sort(
      (left, right) => left.displayName.localeCompare(right.displayName),
    );
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
    this.manager.cssVisibleCharacters = [...this.manager.cssVisibleCharacters, character];
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
<h2>Hidden CSS Characters</h2>
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
Unhide
</button>
</div>
`;
    })
    .join('') ||
  '<div class="characters-empty-state">No hidden characters</div>'
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
            hiddenList.innerHTML =
              '<div class="characters-empty-state">No hidden characters</div>';
          }
        });
      });
  }

  openCssUsedSlotsModal() {
    const fighters = this.manager.cssEditor.getAllCssCharacters().filter(
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
            ? `${characters.length} characters conflict`
            : 'Slot used';
          return `<td class="${isConflict ? 'is-conflict' : 'is-used'}" title="${escapeHtml(names)}" data-character-id="${escapeHtml(characters[0].id)}" role="button" tabindex="0" aria-label="${escapeHtml(`${fighterKind}, slot ${slot}: ${stateLabel}`)}"><span>${isConflict ? characters.length : '<i class="bi bi-check2"></i>'}</span></td>`;
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
        <h2>Used Slots</h2>
        <p>Review fighter slot allocation and resolve overlaps.</p>
      </div>
    </div>
    <button class="character-modal-close" type="button" aria-label="Close Used Slots"><i class="bi bi-x-lg"></i></button>
  </div>
  <div class="character-css-slots-summary">
    <div class="character-css-slots-stats" aria-label="Slot summary">
      <span><strong>${usage.size}</strong> fighter kinds</span>
      <span><strong>${usedSlotCount}</strong> used slots</span>
      <span class="${conflictCount > 0 ? 'has-conflicts' : ''}"><strong>${conflictCount}</strong> conflicts</span>
    </div>
    <div class="character-css-slots-legend" aria-label="Legend">
      <span class="is-used"><i></i>Used</span>
      <span class="is-conflict"><i></i>Conflict</span>
      <span class="is-empty"><i></i>Available</span>
    </div>
  </div>
  <div class="character-css-slots-scroll">
    ${
      rows
        ? `<table class="character-css-slots-table">
      <thead><tr><th class="character-css-slots-fighter" scope="col"><span>Fighter Kind</span></th>${header}</tr></thead>
      <tbody>${rows}</tbody>
    </table>`
        : `<div class="character-css-slots-empty">
      <i class="bi bi-grid-3x3-gap"></i>
      <strong>No fighter slots found</strong>
      <span>Import a Character CSS source to inspect its slot allocation.</span>
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
          const character = this.manager.cssEditor.findCssCharacter(characterId);
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
