const UMC_MAX_SELECTION = 10;

class CharactersUmcSection {
  manager: Window['charactersManager'];

  constructor(manager: Window['charactersManager']) {
    this.manager = manager;
  }

  openUmcCompatibility() {
    const umcView = document.querySelector<HTMLElement>(
      '#character-moveset-compatibility-view',
    );
    if (!umcView) {
      return;
    }

    this.manager.switchCharacterView(
      this.manager.getActiveCharacterSubview(),
      umcView,
      'forward',
    );

    if (this.manager.umcMovesetsLoaded) {
      this.renderUmcCompatibility();
    } else {
      void this.loadUmcMovesets();
    }
  }

  closeUmcCompatibility() {
    const browserView = document.querySelector<HTMLElement>(
      '#characters-browser-view',
    );
    const umcView = document.querySelector<HTMLElement>(
      '#character-moveset-compatibility-view',
    );

    if (!browserView || !umcView) {
      return;
    }

    this.manager.switchCharacterView(umcView, browserView, 'back');
  }

  async loadUmcMovesets(force = false) {
    if (this.manager.umcMovesetsLoading) {
      return;
    }
    if (this.manager.umcMovesetsLoaded && !force) {
      this.renderUmcCompatibility();
      return;
    }

    this.manager.umcMovesetsLoading = true;
    this.manager.umcMovesetsError = null;
    this.renderUmcCompatibility();

    try {
      if (!window.electronAPI?.getUmcMovesets) {
        throw new Error('UMC API is unavailable in this app version.');
      }

      const response = await window.electronAPI.getUmcMovesets();
      if (!response.success) {
        throw new Error(response.error || 'UMC could not load movesets.');
      }

      this.manager.umcMovesets = response.movesets.filter(
        (moveset) =>
          Number.isSafeInteger(moveset?.movesetId) &&
          moveset.movesetId > 0 &&
          typeof moveset.moddedCharName === 'string' &&
          moveset.moddedCharName.trim().length > 0 &&
          moveset.releaseState?.trim().toLowerCase() === 'released',
      );
      this.manager.umcMovesetsLoaded = true;

      const availableIds = new Set(
        this.manager.umcMovesets.map((moveset) => moveset.movesetId),
      );
      const previousSelectionSize = this.manager.umcSelectedMovesetIds.size;
      this.manager.umcSelectedMovesetIds = new Set(
        [...this.manager.umcSelectedMovesetIds].filter((id) => availableIds.has(id)),
      );
      if (previousSelectionSize !== this.manager.umcSelectedMovesetIds.size) {
        this.resetUmcCompatibility();
        if (this.manager.umcSelectedMovesetIds.size >= 2)
          void this.checkUmcCompatibility();
      }
    } catch (error) {
      this.manager.umcMovesetsError =
        error instanceof Error ? error.message : String(error);
    } finally {
      this.manager.umcMovesetsLoading = false;
      this.renderUmcCompatibility();
    }
  }

  renderUmcCompatibility() {
    const count = document.querySelector<HTMLElement>('#character-umc-count');
    if (count) {
      count.textContent = this.manager.t(
        'characters.umcMovesetCount',
        '{{count}} movesets',
        { count: String(this.manager.umcMovesets.length) },
      );
    }

    const refreshButton = document.querySelector<HTMLButtonElement>(
      '#character-umc-refresh-btn',
    );
    if (refreshButton) {
      refreshButton.disabled = this.manager.umcMovesetsLoading;
      refreshButton.classList.toggle('is-loading', this.manager.umcMovesetsLoading);
      refreshButton.title = this.manager.t(
        'characters.umcRefreshTitle',
        'Refresh UMC movesets',
      );
      refreshButton.setAttribute('aria-label', refreshButton.title);
      refreshButton.setAttribute('aria-busy', String(this.manager.umcMovesetsLoading));
    }

    const refreshState = document.querySelector<HTMLElement>(
      '#character-umc-refresh-state',
    );
    if (refreshState) {
      const hasCachedList =
        this.manager.umcMovesetsLoaded && this.manager.umcMovesets.length > 0;
      refreshState.hidden =
        !hasCachedList || (!this.manager.umcMovesetsLoading && !this.manager.umcMovesetsError);
      refreshState.textContent = this.manager.umcMovesetsLoading
        ? this.manager.t('characters.umcRefreshing', 'Refreshing...')
        : this.manager.t(
            'characters.umcRefreshFailed',
            'Refresh failed. Showing the last loaded list.',
          );
    }

    this.renderUmcMovesetGrid();
    this.renderUmcSelection();
  }

  renderUmcMovesetGrid() {
    const grid = document.querySelector<HTMLElement>('#character-umc-grid');
    if (!grid) {
      return;
    }

    if (this.manager.umcMovesetsLoading && this.manager.umcMovesets.length === 0) {
      grid.innerHTML = `
<div class="character-umc-state" role="status" aria-live="polite">
  <i class="bi bi-arrow-repeat character-umc-spinner" aria-hidden="true"></i>
  <p>${escapeHtml(this.manager.t('characters.umcLoading', 'Loading UMC movesets...'))}</p>
</div>`;
      return;
    }

    if (this.manager.umcMovesetsError && this.manager.umcMovesets.length === 0) {
      grid.innerHTML = `
<div class="character-umc-state" role="status" aria-live="polite">
  <i class="bi bi-cloud-slash" aria-hidden="true"></i>
  <p><strong>${escapeHtml(this.manager.t('characters.umcLoadError', 'Could not load UMC movesets.'))}</strong><br>${escapeHtml(this.manager.umcMovesetsError)}</p>
  <button class="input-btn" type="button" data-umc-retry>${escapeHtml(this.manager.t('characters.umcRetry', 'Retry'))}</button>
</div>`;
      return;
    }

    const normalizedQuery = this.manager.umcSearchQuery;
    const movesets = [...this.manager.umcMovesets]
      .filter((moveset) => {
        if (!normalizedQuery) {
          return true;
        }
        const modders = moveset.cardModders?.length
          ? moveset.cardModders
          : moveset.modders || [];
        return [
          moveset.moddedCharName,
          moveset.vanillaCharDisplayName || '',
          moveset.seriesName || '',
          ...modders,
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort((a, b) => {
        const unnamedA = /^\?+$/.test(a.moddedCharName.trim());
        const unnamedB = /^\?+$/.test(b.moddedCharName.trim());
        return (
          Number(unnamedA) - Number(unnamedB) ||
          a.moddedCharName.localeCompare(b.moddedCharName, undefined, {
            sensitivity: 'base',
          })
        );
      });

    if (movesets.length === 0) {
      const emptyMessage = this.manager.umcMovesets.length
        ? this.manager.t('characters.umcSearchEmpty', 'No movesets found.')
        : this.manager.t(
            'characters.umcEmpty',
            'No released movesets available on UMC.',
          );
      grid.innerHTML = `
<div class="character-umc-state" role="status" aria-live="polite">
  <i class="bi bi-search" aria-hidden="true"></i>
  <p>${escapeHtml(emptyMessage)}</p>
</div>`;
      return;
    }

    grid.innerHTML = movesets
      .map((moveset) => {
        const selected = this.manager.umcSelectedMovesetIds.has(moveset.movesetId);
        const imageUrl = this.getUmcImageUrl(moveset.thumbhImageUrl);
        const metadata = [
          moveset.vanillaCharDisplayName,
          moveset.seriesName,
        ].filter((value): value is string => Boolean(value?.trim()));
        return `
<button class="character-umc-card" type="button" data-umc-moveset-id="${moveset.movesetId}" aria-pressed="${selected}" aria-label="${escapeHtml(moveset.moddedCharName)}${metadata.length ? ` · ${escapeHtml(metadata.join(' · '))}` : ''}" ${!selected && this.manager.umcSelectedMovesetIds.size >= UMC_MAX_SELECTION ? 'disabled' : ''}>
  <span class="character-umc-card-image">
    ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(moveset.moddedCharName)}" loading="lazy">` : '<i class="bi bi-controller" aria-hidden="true"></i>'}
    <span class="character-umc-card-name" title="${escapeHtml(moveset.moddedCharName).replace(/"/g, '&quot;')}">${escapeHtml(moveset.moddedCharName)}</span>
  </span>
  <span class="character-umc-card-meta">${escapeHtml(metadata.join(' · ') || this.manager.t('characters.umcUnknownFighter', 'Fighter not specified'))}</span>
</button>`;
      })
      .join('');

    grid
      .querySelectorAll<HTMLImageElement>('.character-umc-card-image img')
      .forEach((image) => {
        image.addEventListener(
          'error',
          () => {
            const frame = image.parentElement;
            image.remove();
            if (frame && !frame.querySelector('i')) {
              const fallback = document.createElement('i');
              fallback.className = 'bi bi-controller';
              fallback.setAttribute('aria-hidden', 'true');
              frame.appendChild(fallback);
            }
          },
          { once: true },
        );
      });
  }

  renderUmcSelection() {
    const selected = this.manager.umcMovesets.filter((moveset) =>
      this.manager.umcSelectedMovesetIds.has(moveset.movesetId),
    );
    const pairCount = (selected.length * (selected.length - 1)) / 2;
    const count = document.querySelector<HTMLElement>(
      '#character-umc-selected-count',
    );
    if (count) {
      count.textContent = this.manager.t(
        'characters.umcSelectedCount',
        `${selected.length} selected · ${pairCount} pairs`,
        {
          count: String(selected.length),
          pairs: String(pairCount),
        },
      );
    }
    const selection = document.querySelector<HTMLElement>(
      '#character-umc-selection',
    );
    if (selection) {
      selection.innerHTML = selected.length
        ? selected
            .map((moveset) => {
              const label = this.manager.t(
                'characters.umcDeselect',
                `Deselect ${moveset.moddedCharName}`,
                { name: moveset.moddedCharName },
              );
              return `<button class="character-umc-selection-chip" type="button" data-umc-remove-id="${moveset.movesetId}" aria-label="${escapeHtml(label).replace(/"/g, '&quot;')}"><span>${escapeHtml(moveset.moddedCharName)}</span><i class="bi bi-x-lg" aria-hidden="true"></i></button>`;
            })
            .join('')
        : `<span class="character-umc-selection-empty">${escapeHtml(this.manager.t('characters.umcChooseMultiple', 'Choose at least two movesets in the grid.'))}</span>`;
    }

    document
      .querySelectorAll<HTMLButtonElement>('[data-umc-moveset-id]')
      .forEach((card) => {
        const id = Number(card.dataset.umcMovesetId);
        const isSelected = this.manager.umcSelectedMovesetIds.has(id);
        card.setAttribute('aria-pressed', String(isSelected));
        card.disabled = !isSelected && selected.length >= UMC_MAX_SELECTION;
      });

    const result = document.querySelector<HTMLElement>('#character-umc-result');
    if (!result) {
      return;
    }
    result.setAttribute('aria-busy', String(this.manager.umcCheckingCompatibility));

    if (this.manager.umcCheckingCompatibility) {
      result.className = 'character-umc-result is-neutral';
      result.hidden = false;
      result.textContent = this.manager.t(
        'characters.umcChecking',
        'Checking compatibility...',
      );
      return;
    }

    if (this.manager.umcCompatibilityError) {
      result.className = 'character-umc-result is-error';
      result.hidden = false;
      result.innerHTML = `<strong>${escapeHtml(this.manager.t('characters.umcCheckError', 'Could not check compatibility.'))}</strong> ${escapeHtml(this.manager.umcCompatibilityError)}<br>${escapeHtml(this.manager.t('characters.umcRetrySelection', 'Select a different pair to try again.'))}`;
      return;
    }

    if (!this.manager.umcCompatibilityResult) {
      result.hidden = true;
      result.replaceChildren();
      return;
    }

    const group = this.manager.umcCompatibilityResult;
    const verdict = this.formatUmcCompatibility({
      severity: group.overallSeverity,
      compatibleCount: group.pairs.reduce(
        (total, pair) => total + (pair.compatibleCount || 0),
        0,
      ),
      incompatibleCount: group.pairs.reduce(
        (total, pair) => total + (pair.incompatibleCount || 0),
        0,
      ),
    });
    if (!group.overallSeverity) {
      verdict.title = this.manager.t(
        'characters.umcGroupPredictionUnavailable',
        'UMC prediction unavailable for this selection.',
      );
    }
    const ranks = {
      'is-incompatible': 3,
      'is-warning': 2,
      'is-neutral': 1,
      'is-compatible': 0,
    };
    const pairs = group.pairs
      .map((pair) => ({ pair, ...this.formatUmcCompatibility(pair) }))
      .sort((a, b) => ranks[b.resultStyle] - ranks[a.resultStyle]);
    const needsAttention = pairs.some(
      (pair) => pair.resultStyle !== 'is-compatible',
    );
    const names = new Map(
      this.manager.umcMovesets.map((moveset) => [
        moveset.movesetId,
        moveset.moddedCharName,
      ]),
    );
    const pairRows = pairs
      .map(
        ({ pair, title, resultStyle, details }) =>
          `<li><div class="character-umc-pair-heading"><strong>${escapeHtml(names.get(pair.moveset1Id) || `#${pair.moveset1Id}`)} + ${escapeHtml(names.get(pair.moveset2Id) || `#${pair.moveset2Id}`)}</strong><span class="${resultStyle}">${escapeHtml(title)}</span></div><div class="character-umc-pair-details">${details.map((detail) => escapeHtml(detail)).join('<br>')}</div></li>`,
      )
      .join('');
    result.className = `character-umc-result ${verdict.resultStyle}`;
    result.hidden = false;
    result.innerHTML = `<strong>${escapeHtml(verdict.title)}</strong><details class="character-umc-pairs" ${needsAttention || pairCount === 1 ? 'open' : ''}><summary>${escapeHtml(this.manager.t('characters.umcPairDetails', `Details of ${pairs.length} pairs`, { count: String(pairs.length) }))}</summary><ul class="character-umc-pair-list">${pairRows}</ul></details>`;
  }

  formatUmcCompatibility(compatibility: UmcCompatibilityResult): {
    title: string;
    resultStyle:
      | 'is-incompatible'
      | 'is-warning'
      | 'is-compatible'
      | 'is-neutral';
    details: string[];
  } {
    const compatibleCount = Math.max(
      0,
      Number(compatibility.compatibleCount) || 0,
    );
    const incompatibleCount = Math.max(
      0,
      Number(compatibility.incompatibleCount) || 0,
    );
    const severity = compatibility.severity;
    const hasReports = compatibleCount > 0 || incompatibleCount > 0;
    const titles = {
      compatible: this.manager.t(
        'characters.umcPredictedCompatible',
        'No conflicts detected (UMC prediction)',
      ),
      warning: this.manager.t(
        'characters.umcWarning',
        'Compatibility warnings (UMC prediction)',
      ),
      'predicted-incompat': this.manager.t(
        'characters.umcPredictedIncompatible',
        'Likely incompatible (UMC prediction)',
      ),
      incompatible: this.manager.t(
        'characters.umcPredictedConflict',
        'Conflicts detected (UMC prediction)',
      ),
    };
    const title = severity
      ? titles[severity]
      : hasReports
        ? this.manager.t(
            'characters.umcReportsOnly',
            'Community reports only; prediction unavailable',
          )
        : this.manager.t(
            'characters.umcPredictionUnavailable',
            'UMC prediction unavailable. No community reports for this pair.',
          );
    const resultStyle =
      severity === 'incompatible' || severity === 'predicted-incompat'
        ? 'is-incompatible'
        : severity === 'warning' || incompatibleCount > 0
          ? 'is-warning'
          : severity === 'compatible'
            ? 'is-compatible'
            : 'is-neutral';
    const details: string[] = [];
    if (severity) {
      details.push(
        this.manager.t(
          'characters.umcConflictCounts',
          'Shared hooks: {{hooks}} · Shared articles: {{articles}}',
          {
            hooks: String(compatibility.conflictingHookIds?.length || 0),
            articles: String(compatibility.conflictingArticleIds?.length || 0),
          },
        ),
      );
    }
    details.push(
      compatibility.compatibleCount === undefined
        ? this.manager.t(
            'characters.umcReportsUnavailable',
            'Community reports unavailable.',
          )
        : hasReports
          ? this.manager.t(
              'characters.umcCounts',
              'Community votes: {{compatible}} compatible · {{incompatible}} incompatible',
              {
                compatible: String(compatibleCount),
                incompatible: String(incompatibleCount),
              },
            )
          : this.manager.t(
              'characters.umcNoReports',
              'No community reports for this pair yet.',
            ),
    );
    return { title, resultStyle, details };
  }

  selectUmcMoveset(movesetId: number) {
    if (!this.manager.umcMovesets.some((moveset) => moveset.movesetId === movesetId)) {
      return;
    }

    if (this.manager.umcSelectedMovesetIds.has(movesetId)) {
      this.manager.umcSelectedMovesetIds.delete(movesetId);
    } else {
      if (this.manager.umcSelectedMovesetIds.size >= UMC_MAX_SELECTION) return;
      this.manager.umcSelectedMovesetIds.add(movesetId);
    }

    this.resetUmcCompatibility();
    this.renderUmcSelection();
    if (this.manager.umcSelectedMovesetIds.size >= 2) {
      void this.checkUmcCompatibility();
    }
  }

  resetUmcCompatibility() {
    // Ignore responses for a selection that the user has already changed.
    this.manager.umcCompatibilityRequestId++;
    this.manager.umcCheckingCompatibility = false;
    this.manager.umcCompatibilityResult = null;
    this.manager.umcCompatibilityError = null;
  }

  async checkUmcCompatibility() {
    const movesetIds = [...this.manager.umcSelectedMovesetIds];
    if (movesetIds.length < 2 || this.manager.umcCheckingCompatibility) {
      return;
    }

    this.manager.umcCheckingCompatibility = true;
    const requestId = ++this.manager.umcCompatibilityRequestId;
    this.manager.umcCompatibilityResult = null;
    this.manager.umcCompatibilityError = null;
    this.renderUmcSelection();

    try {
      // Let rapid selection changes settle before requesting all pairs.
      await new Promise<void>((resolve) => window.setTimeout(resolve, 180));
      if (requestId !== this.manager.umcCompatibilityRequestId) return;
      const response = await window.electronAPI.getUmcCompatibility(movesetIds);
      if (requestId !== this.manager.umcCompatibilityRequestId) {
        return;
      }
      if (!response.success) {
        throw new Error(
          response.error || 'UMC could not check this moveset selection.',
        );
      }
      this.manager.umcCompatibilityResult = response.compatibility;
    } catch (error) {
      if (requestId === this.manager.umcCompatibilityRequestId) {
        this.manager.umcCompatibilityError =
          error instanceof Error ? error.message : String(error);
      }
    } finally {
      if (requestId === this.manager.umcCompatibilityRequestId) {
        this.manager.umcCheckingCompatibility = false;
        this.renderUmcSelection();
      }
    }
  }

  getUmcImageUrl(value?: string | null) {
    if (!value) {
      return null;
    }

    try {
      const url = new URL(value);
      return url.protocol === 'https:' ? url.toString() : null;
    } catch {
      return null;
    }
  }
}
