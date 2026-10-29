class CharactersCssInspectorSection {
  manager: Window['charactersManager'];

  constructor(manager: Window['charactersManager']) {
    this.manager = manager;
  }

  setCssInspectorSaving(saving: boolean) {
    const inspector = document.querySelector<HTMLElement>(
      '#character-css-inspector',
    );
    if (!inspector) {
      return;
    }

    if (saving) {
      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLElement &&
        inspector.contains(activeElement)
      ) {
        activeElement.blur();
      }
      inspector.setAttribute('aria-busy', 'true');
    } else {
      inspector.removeAttribute('aria-busy');
    }

    inspector.inert = saving;
    inspector.classList.toggle('is-saving', saving);
  }

  renderCssInspector() {
    const inspector = document.querySelector<HTMLElement>(
      '#character-css-inspector',
    );
    if (!inspector) {
      return;
    }

    const character = this.manager.cssSelectedCharacterId
      ? this.manager.cssEditor.findCssCharacter(this.manager.cssSelectedCharacterId)
      : null;

    if (!character) {
      inspector.innerHTML = `
<div class="character-css-inspector-empty">
<i class="bi bi-cursor"></i>
<strong>Select a character</strong>
<span>Edit PRC data, names and slot labels from here.</span>
</div>
`;
      return;
    }

    if (character.isGroup) {
      this.renderCssGroupInspector(inspector, character);
      return;
    }

    const slot =
      character.slots[this.manager.cssSelectedSlotIndex] || character.slots[0];
    const escapedName = escapeHtml(character.displayName);
    const tabButton = (mode: 'prc' | 'msbt', label: string) => `
<button class="character-css-tab ${this.manager.cssPanelMode === mode ? 'is-active' : ''}" type="button" data-css-panel-mode="${mode}">
${label}
</button>`;

    inspector.innerHTML = `
<div class="character-css-inspector-header">
<div class="character-css-inspector-thumb">
${character.imageUrl ? `<img src="${escapeHtml(character.imageUrl)}" alt="${escapedName}" onerror="this.hidden=true; this.nextElementSibling.hidden=false;"><i class="bi bi-person-circle" hidden></i>` : '<i class="bi bi-person-circle"></i>'}
</div>
<div>
<strong>${escapedName}</strong>
<span>${escapeHtml(character.id)}</span>
</div>
</div>
<div class="character-css-umc-image-controls" data-css-umc-image-controls hidden></div>
<div class="character-css-inspector-actions">
<button class="input-btn" type="button" data-css-action="duplicate-character">
<i class="bi bi-copy"></i>
Duplicate
</button>
${this.manager.cssGroups.size > 0 ? `<button class="input-btn" type="button" data-css-action="move-to-group"><i class="bi bi-folder-symlink"></i>Move to Group</button>` : ''}
<button class="input-btn character-css-danger-btn" type="button" data-css-action="remove-character">
<i class="bi bi-trash3"></i>
Remove
</button>
</div>
<div class="character-css-tabs">
${tabButton('prc', 'PRC Data')}
${tabButton('msbt', 'MSBT Names')}
</div>
${this.manager.cssPanelMode === 'prc' ? this.renderCssPrcPanel(character) : this.renderCssMsbtPanel(character, slot)}
`;

    this.manager.cssImages.refreshCssUmcImageControls(character);

    inspector
      .querySelectorAll<HTMLButtonElement>('[data-css-panel-mode]')
      .forEach((button) => {
        button.addEventListener('click', () => {
          this.manager.cssPanelMode = button.dataset.cssPanelMode as 'prc' | 'msbt';
          this.renderCssInspector();
        });
      });

    inspector
      .querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >('[data-css-field]')
      .forEach((field) => {
        field.addEventListener('input', () => {
          this.manager.cssEditor.updateSelectedCssCharacterFromInspector(field);
        });
        field.addEventListener('change', () => {
          this.manager.cssEditor.updateSelectedCssCharacterFromInspector(field);
        });
      });

    inspector
      .querySelector<HTMLButtonElement>(
        '[data-css-action="duplicate-character"]',
      )
      ?.addEventListener('click', () => {
        void this.manager.cssSlots.duplicateSelectedCssCharacter();
      });
    inspector
      .querySelector<HTMLButtonElement>('[data-css-action="remove-character"]')
      ?.addEventListener('click', () => {
        void this.manager.cssSlots.removeSelectedCssCharacter();
      });
    inspector
      .querySelector<HTMLButtonElement>('[data-css-action="move-to-group"]')
      ?.addEventListener('click', () => {
        this.manager.cssSlots.openMoveCssCharacterToGroupModal(character);
      });
  }

  renderCssGroupInspector(inspector: HTMLElement, group: CharacterCssEntry) {
    const members = this.manager.cssGroups.get(group.id) || [];
    inspector.innerHTML = `
<div class="character-css-inspector-header">
  <div class="character-css-inspector-thumb character-css-group-thumb">
    <i class="bi bi-collection-fill"></i>
  </div>
  <div>
    <strong>${escapeHtml(group.displayName)}</strong>
    <span>${escapeHtml(group.id)}</span>
  </div>
</div>
<div class="character-css-form">
  <label class="character-css-field">
    <span>Group Display Name</span>
    <input type="text" data-css-group-name value="${escapeHtml(group.displayName)}">
  </label>
  <label class="character-css-field">
    <span>Name ID</span>
    <input type="text" value="${escapeHtml(group.nameId)}" readonly>
  </label>
  <div class="character-css-group-summary">
    <i class="bi bi-people-fill"></i>
    <strong>${members.length}</strong>
    <span>character${members.length === 1 ? '' : 's'} in this group</span>
  </div>
  <button class="input-btn" type="button" data-css-action="open-group">
    <i class="bi bi-folder2-open"></i>
    Manage Group
  </button>
  <button class="input-btn character-css-danger-btn" type="button" data-css-action="remove-group" ${members.length > 0 ? 'disabled title="Move every member out before deleting this group"' : ''}>
    <i class="bi bi-trash3"></i>
    Delete Empty Group
  </button>
</div>`;

    inspector
      .querySelector<HTMLInputElement>('[data-css-group-name]')
      ?.addEventListener('input', (event) => {
        const value = (event.currentTarget as HTMLInputElement).value;
        group.displayName = value;
        this.manager.cssRenamedCharacters.set(group.nameId, value);
        const createdGroup = this.manager.cssCreatedGroups.get(group.id);
        if (createdGroup) {
          createdGroup.displayName = value;
        }
        this.manager.cssDirty = true;
      });
    inspector
      .querySelector<HTMLButtonElement>('[data-css-action="open-group"]')
      ?.addEventListener('click', () => {
        this.manager.cssSlots.openCssGroupModal(group.id);
      });
    inspector
      .querySelector<HTMLButtonElement>('[data-css-action="remove-group"]')
      ?.addEventListener('click', () => {
        this.removeCssGroup(group);
      });
  }

  removeCssGroup(group: CharacterCssEntry) {
    if ((this.manager.cssGroups.get(group.id)?.length || 0) > 0) {
      window.toastManager?.warning?.(
        'Move every member out of the group before deleting it.',
        4000,
      );
      return;
    }
    if (this.manager.cssCreatedGroups.has(group.id)) {
      if (
        !window.confirm(`Delete the empty CSS group “${group.displayName}”?`)
      ) {
        return;
      }
      this.manager.cssVisibleCharacters = this.manager.cssVisibleCharacters.filter(
        (entry) => entry.id !== group.id,
      );
      this.manager.cssHiddenCharacters = this.manager.cssHiddenCharacters.filter(
        (entry) => entry.id !== group.id,
      );
      this.manager.cssGroups.delete(group.id);
      this.manager.cssCreatedGroups.delete(group.id);
      this.manager.cssRenamedCharacters.delete(group.nameId);
      this.manager.cssSelectedCharacterId = this.manager.cssVisibleCharacters[0]?.id || null;
      this.manager.cssDirty = true;
      this.manager.cssEditor.renderCssEditor();
      return;
    }

    void this.manager.cssSlots.removeSelectedCssCharacter();
  }

  renderCssPrcPanel(character: CharacterCssEntry) {
    const field = (
      label: string,
      key: string,
      value: string,
      type = 'text',
    ) => `
<label class="character-css-field">
<span>${label}</span>
<input type="${type}" data-css-field="${key}" value="${escapeHtml(value)}">
</label>`;
    const checkbox = (label: string, key: string, value: boolean) => `
<label class="character-css-check">
<input type="checkbox" data-css-field="${key}" ${value ? 'checked' : ''}>
<span>${label}</span>
</label>`;
    const select = (
      label: string,
      key: string,
      value: string,
      options: Array<{ value: string; label: string }>,
    ) => `
<label class="character-css-field">
<span>${label}</span>
<select data-css-field="${key}">
${options
  .map(
    (option) =>
      `<option value="${escapeHtml(option.value)}" ${option.value === value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`,
  )
  .join('')}
</select>
</label>`;
    const fighterTypes = [
      'fighter_type_normal',
      'fighter_type_both',
      'fighter_type_opened',
      'fighter_type_closed',
      'fighter_type_other',
    ];
    const echoOptions = [
      { value: '', label: 'None' },
      ...this.manager.cssEditor.getAllCssCharacters()
        .filter((entry) => !entry.isGroup && entry.id !== character.id)
        .map((entry) => ({
          value: entry.id,
          label: `${entry.displayName} — ${entry.id}`,
        })),
    ];

    return `
<div class="character-css-form">
${field('Character ID', 'uiCharaId', this.manager.cssImages.getCssCharacterLookupId(character))}
${field('CSS Display Name', 'displayName', character.displayName)}
${field('Series ID', 'uiSeriesId', character.uiSeriesId)}
${field('Name ID', 'nameId', character.nameId)}
${field('Fighter Kind', 'fighterKind', character.fighterKind)}
${field('Fighter Kind Corps', 'fighterKindCorps', character.fighterKindCorps)}
${select('Echo Fighter', 'altCharaId', character.altCharaId, echoOptions)}
${select(
  'Fighter Type',
  'fighterType',
  character.fighterType,
  fighterTypes.map((value) => ({ value, label: value })),
)}
<div class="character-css-form-grid">
${field('Exhibit Year', 'exhibitYear', character.exhibitYear, 'number')}
${field('Colors', 'colorNum', character.colorNum, 'number')}
${field('Color Start', 'colorStartIndex', character.colorStartIndex, 'number')}
</div>
<div class="character-css-check-grid">
${checkbox('Can Select', 'canSelect', character.canSelect)}
${checkbox('Is Mii', 'isMii', character.isMii)}
${checkbox('Is Boss', 'isBoss', character.isBoss)}
${checkbox('Hidden Boss', 'isHiddenBoss', character.isHiddenBoss)}
</div>
</div>
`;
  }

  renderCssMsbtPanel(character: CharacterCssEntry, slot: CharacterCssSlot) {
    const slotOptions = character.slots
      .map(
        (entry) =>
          `<option value="${entry.slotIndex}" ${entry.slotIndex === slot.slotIndex ? 'selected' : ''}>Slot ${entry.slotIndex + 1}</option>`,
      )
      .join('');
    const field = (
      label: string,
      key: string,
      value: string,
      multiline = false,
    ) => `
<label class="character-css-field">
<span>${label}</span>
${
  multiline
    ? `<textarea data-css-field="${key}" rows="3">${escapeHtml(value)}</textarea>`
    : `<input type="text" data-css-field="${key}" value="${escapeHtml(value)}">`
}
</label>`;

    return `
<div class="character-css-form">
<label class="character-css-field">
<span>Selected Slot</span>
<select data-css-field="selectedSlot">${slotOptions}</select>
</label>
<div class="character-css-form-grid">
${field('cXX Index', 'cxxIndex', slot.cxxIndex)}
${field('nXX Index', 'nxxIndex', slot.nxxIndex)}
</div>
${field('characall_label', 'characallLabel', slot.characallLabel)}
${field('nam_chr0', 'namChr0', slot.namChr0, true)}
${field('nam_chr1', 'namChr1', slot.namChr1 || character.displayName, true)}
${field('nam_chr2', 'namChr2', slot.namChr2, true)}
${field('nam_chr3', 'namChr3', slot.namChr3, true)}
${field('nam_stage_name', 'namStageName', slot.namStageName, true)}
</div>
`;
  }
}
