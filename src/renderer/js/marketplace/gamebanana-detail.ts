class GameBananaDetailSection {
  manager: SocialGameBananaManager;

  constructor(manager: SocialGameBananaManager) {
    this.manager = manager;
  }

  getGameBananaDetailImageStyle(mod: GameBananaTopSubmission) {
    const image = this.manager.getGameBananaSubmissionImageInfo(mod);
    const width = Number(image.width || 0);
    const height = Number(image.height || 0);

    if (width > 0 && height > 0) {
      return ` style="aspect-ratio: ${width} / ${height};"`;
    }

    return '';
  }

  renderGameBananaImageGallery(mod: GameBananaTopSubmission, name: string) {
    const images = this.manager.getGameBananaPreviewImages(mod);
    const fallbackImage = this.manager.getGameBananaSubmissionImage(mod);
    const galleryImages = images.length
      ? images
      : fallbackImage
        ? [{ url: fallbackImage, thumbUrl: fallbackImage, caption: '' }]
        : [];

    if (!galleryImages.length) {
      return '<div class="social-gamebanana-detail-image social-gamebanana-image-placeholder"><i class="bi bi-image"></i></div>';
    }

    const activeImage = galleryImages[0];
    const activeCaption = escapeHtml(activeImage.caption || '');
    const isNsfw = this.manager.isGameBananaSubmissionNsfw(mod);
    const imageStyle =
      activeImage.width && activeImage.height
        ? ` style="aspect-ratio: ${activeImage.width} / ${activeImage.height};"`
        : this.getGameBananaDetailImageStyle(mod);

    return `
      <div class="social-gamebanana-gallery" data-gallery-index="0">
        <div class="social-gamebanana-gallery-main">
          ${this.manager.renderGameBananaPreviewMedia(
            `<img src="${escapeHtml(activeImage.url)}" alt="${name}" class="social-gamebanana-detail-image"${imageStyle}>`,
            this.manager.shouldBlurGameBananaPreview(isNsfw),
          )}
          <div class="social-gamebanana-gallery-loading" aria-hidden="true">
            <div class="social-gamebanana-gallery-skeleton social-gamebanana-skeleton-block"></div>
            <div class="social-gamebanana-gallery-skeleton-caption">
              <span class="social-gamebanana-skeleton-block"></span>
              <span class="social-gamebanana-skeleton-block"></span>
            </div>
          </div>
          ${
            galleryImages.length > 1
              ? `<button class="social-gamebanana-gallery-nav is-prev" data-gallery-direction="-1" title="Previous image">
                  <i class="bi bi-chevron-left"></i>
                </button>
                <button class="social-gamebanana-gallery-nav is-next" data-gallery-direction="1" title="Next image">
                  <i class="bi bi-chevron-right"></i>
                </button>`
              : ''
          }
        </div>
        ${activeCaption ? `<p class="social-gamebanana-gallery-caption">${activeCaption}</p>` : ''}
        ${
          galleryImages.length > 1
            ? `<div class="social-gamebanana-gallery-thumbs">
                ${galleryImages
                  .map(
                    (image, index) =>
                      `<button class="social-gamebanana-gallery-thumb ${index === 0 ? 'active' : ''}" data-gallery-index="${index}" data-image-url="${escapeHtml(image.url)}" data-caption="${escapeHtml(image.caption)}" data-width="${escapeHtml(image.width || '')}" data-height="${escapeHtml(image.height || '')}" title="Image ${index + 1}">
                        <img src="${escapeHtml(image.thumbUrl)}" alt="${name} ${index + 1}">
                      </button>`,
                  )
                  .join('')}
              </div>`
            : ''
        }
      </div>
    `;
  }

  renderGameBananaDetailPage(
    details: any,
    fallback: GameBananaTopSubmission | null,
    loading: boolean,
    files: GameBananaFileEntry[] = [],
    contentLoading = false,
  ) {
    const discoverContent = document.querySelector<HTMLElement>(
      '#social-discover-content',
    );
    if (!discoverContent) return;

    this.manager.gameBananaCurrentDetail = loading
      ? null
      : {
          details,
          fallback,
          files,
        };

    const merged = {
      ...fallback,
      ...details,
      _aSubmitter: details?._aSubmitter || fallback?._aSubmitter,
      _sModelName: details?._sModelName || fallback?._sModelName,
      _aRootCategory:
        details?._aRootCategory ||
        details?._aCategory ||
        fallback?._aRootCategory,
      _aSubCategory: details?._aSubCategory || fallback?._aSubCategory,
      _aPreviewMedia: details?._aPreviewMedia || fallback?._aPreviewMedia,
    } as GameBananaTopSubmission & { _aAdditionalInfo?: any };

    const name = escapeHtml(merged._sName || 'Unknown Mod');
    const creator = escapeHtml(merged._aSubmitter?._sName || 'Unknown');
    const model = escapeHtml(merged._sModelName || 'Mod');
    const rootCategory = escapeHtml(
      merged._aRootCategory?._sName || 'Unknown',
    );
    const subCategory = escapeHtml(merged._aSubCategory?._sName || '');
    const profileUrl = escapeHtml(merged._sProfileUrl || '');
    const description = escapeHtml(
      this.manager.getGameBananaSubmissionDescription(details, fallback || undefined) ||
        this.manager.getSocialTranslation(
          'social.noDescriptionAvailable',
          'No description available.',
        ),
    );
    const likes = Number(merged._nLikeCount || 0);
    const comments = Number(merged._nPostCount || 0);
    const views = Number(merged._nViewCount || 0);
    const dateAdded = escapeHtml(this.manager.getGameBananaSubmissionDate(merged));

    const detailImage = loading
      ? '<div class="social-gamebanana-detail-image social-gamebanana-detail-image-skeleton social-gamebanana-skeleton-block"></div>'
      : this.renderGameBananaImageGallery(merged, name);
    const detailInfo = loading
      ? this.renderGameBananaDetailSkeletonInfo()
      : `
        <div class="social-gamebanana-detail-info">
          <div class="social-gamebanana-detail-meta">
            <span>${model}</span>
            <span>${rootCategory}${subCategory ? ` / ${subCategory}` : ''}</span>
            ${dateAdded ? `<span>${dateAdded}</span>` : ''}
          </div>
          <h3 class="social-gamebanana-detail-name">${name}</h3>
          <p class="social-gamebanana-detail-author">${escapeHtml(
            this.manager.getSocialTranslation('social.byAuthor', 'by {{author}}', {
              author: creator,
            }),
          )}</p>
          <div class="social-gamebanana-detail-stats">
            <span><i class="bi bi-hand-thumbs-up"></i> ${likes}</span>
            <span><i class="bi bi-chat-left"></i> ${comments}</span>
            <span><i class="bi bi-eye"></i> ${views}</span>
          </div>
          ${
            contentLoading
              ? this.renderGameBananaDescriptionSkeleton()
              : `<p class="social-gamebanana-detail-description">${description}</p>`
          }
          ${this.renderGameBananaUmcSection()}
          ${this.renderGameBananaWipInfo(merged)}
          ${this.manager.requirements.renderGameBananaRequirements(merged)}
          ${this.renderGameBananaFileList(files, contentLoading)}
        </div>
      `;

    discoverContent.innerHTML = `
      <div class="social-gamebanana-detail-page">
        <div class="social-gamebanana-detail-toolbar">
          <button class="social-back-button social-gamebanana-detail-back">
            <i class="bi bi-arrow-left"></i> ${escapeHtml(
              this.manager.getSocialTranslation('social.back', 'Back'),
            )}
          </button>
          ${
            profileUrl
              ? `<button class="social-gamebanana-external-btn" data-url="${profileUrl}">
                  <i class="bi bi-box-arrow-up-right"></i>
                  <span>GameBanana</span>
                </button>`
              : ''
          }
        </div>
        <div class="social-gamebanana-detail-layout">
          ${detailImage}
          ${detailInfo}
        </div>
        ${loading ? this.renderGameBananaUmcSection() : ''}
      </div>
    `;
  }

  async loadGameBananaUmc(requestId: number) {
    const state = this.manager.gameBananaUmcState;
    if (!state || requestId !== this.manager.gameBananaDetailRequestId) return;
    state.status = 'loading';
    this.updateGameBananaUmcSection();
    try {
      const result = await window.electronAPI.getUmcMovesetsByGameBanana(
        state.modId,
        true,
      );
      if (
        requestId !== this.manager.gameBananaDetailRequestId ||
        this.manager.gameBananaUmcState !== state
      )
        return;
      if (result.success) {
        state.movesets = result.movesets;
        state.status = 'ready';
      } else {
        state.status = 'error';
      }
    } catch {
      if (
        requestId !== this.manager.gameBananaDetailRequestId ||
        this.manager.gameBananaUmcState !== state
      )
        return;
      state.status = 'error';
    }
    this.updateGameBananaUmcSection();
  }

  updateGameBananaUmcSection() {
    const section = document.querySelector<HTMLElement>(
      '#social-discover-content [data-umc-section]',
    );
    if (!section || section.dataset.umcSection !== this.manager.gameBananaUmcState?.key)
      return;
    section.outerHTML = this.renderGameBananaUmcSection();
  }

  renderGameBananaUmcSection() {
    const state = this.manager.gameBananaUmcState;
    if (!state) return '';
    const escape = (value: unknown) =>
      escapeHtml(value).replace(/"/g, '&quot;');
    const label = (key: string, fallback: string) =>
      escape(this.manager.getSocialTranslation(`social.umc.${key}`, fallback));
    let content = '';
    if (state.status === 'loading') {
      content = `<p class="social-umc-status" role="status">${label('loading', 'Looking up moveset information…')}</p>`;
    } else if (state.status === 'error') {
      content = `<p class="social-umc-status" role="status">${label('unavailable', 'UMC is unavailable. Try again.')}</p>
        <button class="social-gamebanana-external-btn" type="button" data-umc-retry>${label('retry', 'Retry')}</button>`;
    } else if (!state.movesets.length) {
      // Ordinary skins do not need a permanent empty moveset section.
      return `<section data-umc-section="${state.key}" hidden></section>`;
    } else {
      content = state.movesets
        .map((moveset) => {
          const fields: [string, string][] = [
            [label('fighter', 'Base fighter'), moveset.fighterName],
            [label('series', 'Series'), moveset.series],
            [label('state', 'Release status'), moveset.releaseState],
            [label('date', 'Release date'), moveset.releaseDate],
            [label('authors', 'Authors'), moveset.authors.join(', ')],
            [label('characterId', 'Character ID'), moveset.slottedId],
            [label('replacementId', 'Replacement ID'), moveset.replacementId],
            [
              label('slots', 'Slots'),
              moveset.slotsStart !== null && moveset.slotsEnd !== null
                ? `c${String(moveset.slotsStart).padStart(2, '0')} – c${String(moveset.slotsEnd).padStart(2, '0')}`
                : '',
            ],
          ];
          const link = (url: string, title: string) =>
            `<button type="button" class="social-gamebanana-external-btn" data-url="${escape(url)}"><span>${escape(title)}</span><i class="bi bi-box-arrow-up-right" aria-hidden="true"></i></button>`;
          return `<article class="social-umc-moveset">
          ${moveset.imageUrl ? `<img class="social-umc-image" src="${escape(moveset.imageUrl)}" alt="${escape(moveset.name)}" loading="lazy" onerror="this.manager.hidden=true;">` : ''}
          <h5>${escape(moveset.name)}</h5>
          <dl class="social-umc-facts">${fields
            .filter(([, value]) => value)
            .map(
              ([title, value]) =>
                `<div><dt>${title}</dt><dd>${escape(value)}</dd></div>`,
            )
            .join('')}</dl>
          ${moveset.dependencies.length ? `<h6>${label('dependencies', 'Dependencies')}</h6><ul class="social-umc-dependencies">${moveset.dependencies.map((entry) => `<li>${entry.url ? link(entry.url, entry.name) : escape(entry.name)}</li>`).join('')}</ul>` : ''}
          ${!moveset.detailsAvailable ? `<p class="social-umc-status">${label('partial', 'Additional UMC details are temporarily unavailable.')}</p>` : ''}
          ${moveset.sourceUrl || moveset.wikiUrl ? `<div class="social-umc-links">${moveset.sourceUrl ? link(moveset.sourceUrl, this.manager.getSocialTranslation('social.umc.sourceCode', 'Source code')) : ''}${moveset.wikiUrl ? link(moveset.wikiUrl, 'Mods Wiki') : ''}</div>` : ''}
        </article>`;
        })
        .join('');
    }
    return `<section class="social-umc-section" data-umc-section="${state.key}" aria-busy="${state.status === 'loading'}">
      <div class="social-umc-heading"><h4>${label('title', 'Moveset information')}</h4>
      <button type="button" class="social-gamebanana-external-btn" data-url="https://lilylavender.github.io/UltimateMovesetCompatibility/#/"><span>Provided by UMC</span><i class="bi bi-box-arrow-up-right" aria-hidden="true"></i></button></div>
      ${content}
    </section>`;
  }

  renderGameBananaWipInfo(
    mod: GameBananaTopSubmission & { _aAdditionalInfo?: any },
  ) {
    if (String(mod._sModelName || '').toLowerCase() !== 'wip') return '';

    const additionalInfo = mod._aAdditionalInfo || {};
    const state =
      additionalInfo._sDevelopmentState || additionalInfo._akDevelopmentState;
    const completion = Number(additionalInfo._iCompletionPercentage);
    const hasCompletion = Number.isFinite(completion);
    const finishedWork = additionalInfo._aFinishedWork || {};
    const gameBananaWorks = Array.isArray(
      finishedWork._aFinishedWorksOnGameBanana,
    )
      ? finishedWork._aFinishedWorksOnGameBanana
      : [];
    const remoteWorks = Array.isArray(finishedWork._aRemoteFinishedWorkUrls)
      ? finishedWork._aRemoteFinishedWorkUrls
      : [];

    if (
      !state &&
      !hasCompletion &&
      !gameBananaWorks.length &&
      !remoteWorks.length
    ) {
      return '';
    }

    return `
      <div class="social-gamebanana-wip-info">
        <h4 class="social-gamebanana-wip-title">${escapeHtml(
          this.manager.getSocialTranslation('social.wipProgress', 'Work in progress'),
        )}</h4>
        <div class="social-gamebanana-wip-grid">
          ${
            state
              ? `<div class="social-gamebanana-wip-item">
                  <span>${escapeHtml(
                    this.manager.getSocialTranslation(
                      'social.developmentState',
                      'Development state',
                    ),
                  )}</span>
                  <strong>${escapeHtml(state)}</strong>
                </div>`
              : ''
          }
          ${
            hasCompletion
              ? `<div class="social-gamebanana-wip-item">
                  <span>${escapeHtml(
                    this.manager.getSocialTranslation(
                      'social.completionLabel',
                      'Completion',
                    ),
                  )}</span>
                  <strong>${Math.max(0, Math.min(100, completion))}%</strong>
                </div>`
              : ''
          }
        </div>
        ${
          hasCompletion
            ? `<div class="social-gamebanana-wip-progress" aria-label="${escapeHtml(
                this.manager.getSocialTranslation(
                  'social.completion',
                  'Completion {{percent}}%',
                  {
                    percent: String(
                      Math.max(0, Math.min(100, completion)),
                    ),
                  },
                ),
              )}">
                <span style="width: ${Math.max(0, Math.min(100, completion))}%"></span>
              </div>`
            : ''
        }
        ${this.renderGameBananaWipFinishedWork(gameBananaWorks, remoteWorks)}
      </div>
    `;
  }

  renderGameBananaWipFinishedWork(gameBananaWorks: any[], remoteWorks: any[]) {
    const links = [
      ...gameBananaWorks.map((work) => ({
        label:
          work?._sName ||
          work?.name ||
          work?._sProfileUrl ||
          this.manager.getSocialTranslation('social.finishedWork', 'Finished work'),
        url: work?._sProfileUrl || work?.url || '',
      })),
      ...remoteWorks.map((work) => ({
        label:
          work?.description ||
          work?.title ||
          work?.url ||
          this.manager.getSocialTranslation('social.remoteWork', 'Remote work'),
        url: work?.url || work?._sUrl || '',
      })),
    ].filter((work) => work.url);

    if (!links.length) return '';

    return `
      <div class="social-gamebanana-wip-finished">
        <span>${escapeHtml(
          this.manager.getSocialTranslation('social.finishedWork', 'Finished work'),
        )}</span>
        ${links
          .map((work) => {
            const gameBananaInfo = this.manager.getGameBananaInfoFromProfileUrl(
              work.url,
            );
            return gameBananaInfo
              ? `<button class="social-gamebanana-finished-work-btn" data-url="${escapeHtml(work.url)}" data-gb-model="${escapeHtml(gameBananaInfo.modelName)}" data-gb-id="${escapeHtml(gameBananaInfo.submissionId)}">
                <i class="bi bi-arrow-right-circle"></i>
                <span>${escapeHtml(work.label)}</span>
              </button>`
              : `<button class="social-gamebanana-external-btn" data-url="${escapeHtml(work.url)}">
                <i class="bi bi-box-arrow-up-right"></i>
                <span>${escapeHtml(work.label)}</span>
              </button>`;
          })
          .join('')}
      </div>
    `;
  }

  updateGameBananaGallery(gallery: HTMLElement, nextIndex: number) {
    const thumbs = Array.from(
      gallery.querySelectorAll<HTMLButtonElement>(
        '.social-gamebanana-gallery-thumb',
      ),
    );
    if (!thumbs.length) return;

    const normalizedIndex = (nextIndex + thumbs.length) % thumbs.length;
    const currentIndex = Number(
      gallery.getAttribute('data-gallery-index') || 0,
    );
    if (
      normalizedIndex === currentIndex ||
      gallery.classList.contains('is-loading')
    ) {
      return;
    }

    const thumb = thumbs[normalizedIndex];
    const image = gallery.querySelector<HTMLImageElement>(
      '.social-gamebanana-detail-image',
    );
    const imageUrl = thumb.getAttribute('data-image-url');
    if (!image || !imageUrl) return;

    const width = Number(thumb.getAttribute('data-width'));
    const height = Number(thumb.getAttribute('data-height'));
    const nextCaption = thumb.getAttribute('data-caption') || '';
    const direction = normalizedIndex > currentIndex ? 'next' : 'prev';
    const preload = new Image();

    gallery.classList.add('is-loading');

    preload.onload = () => {
      gallery.classList.remove('is-loading');
      gallery.classList.remove('slide-next', 'slide-prev');

      if (width > 0 && height > 0) {
        image.style.aspectRatio = `${width} / ${height}`;
      } else {
        image.style.aspectRatio = '';
      }
      image.src = imageUrl;
      image.classList.remove('is-sliding');
      void image.offsetWidth;
      gallery.classList.add(direction === 'next' ? 'slide-next' : 'slide-prev');
      image.classList.add('is-sliding');

      this.updateGameBananaGalleryCaption(gallery, nextCaption);

      thumbs.forEach((item, index) => {
        item.classList.toggle('active', index === normalizedIndex);
      });
      gallery.setAttribute('data-gallery-index', String(normalizedIndex));

      window.setTimeout(() => {
        image.classList.remove('is-sliding');
        gallery.classList.remove('slide-next', 'slide-prev');
      }, 260);
    };

    preload.onerror = () => {
      gallery.classList.remove('is-loading');
    };

    preload.src = imageUrl;
  }

  updateGameBananaGalleryCaption(gallery: HTMLElement, nextCaption: string) {
    const caption = gallery.querySelector<HTMLElement>(
      '.social-gamebanana-gallery-caption',
    );

    if (caption) {
      caption.textContent = nextCaption;
      caption.style.display = nextCaption ? '' : 'none';
      return;
    }

    if (nextCaption) {
      const nextCaptionEl = document.createElement('p');
      nextCaptionEl.className = 'social-gamebanana-gallery-caption';
      nextCaptionEl.textContent = nextCaption;
      gallery
        .querySelector<HTMLElement>('.social-gamebanana-gallery-main')
        ?.after(nextCaptionEl);
    }
  }

  renderGameBananaDetailSkeletonInfo() {
    return `
      <div class="social-gamebanana-detail-info">
        <div class="social-gamebanana-detail-meta social-gamebanana-skeleton-row">
          <span class="social-gamebanana-skeleton-block social-gamebanana-skeleton-pill"></span>
          <span class="social-gamebanana-skeleton-block social-gamebanana-skeleton-pill social-gamebanana-skeleton-pill-wide"></span>
        </div>
        <div class="social-gamebanana-skeleton-block social-gamebanana-skeleton-title"></div>
        <div class="social-gamebanana-skeleton-block social-gamebanana-skeleton-author"></div>
        <div class="social-gamebanana-detail-stats social-gamebanana-skeleton-row">
          <span class="social-gamebanana-skeleton-block social-gamebanana-skeleton-stat"></span>
          <span class="social-gamebanana-skeleton-block social-gamebanana-skeleton-stat"></span>
          <span class="social-gamebanana-skeleton-block social-gamebanana-skeleton-stat"></span>
        </div>
        ${this.renderGameBananaDescriptionSkeleton()}
        ${this.renderGameBananaFileList([], true)}
      </div>
    `;
  }

  renderGameBananaDescriptionSkeleton() {
    return `
      <div class="social-gamebanana-detail-description social-gamebanana-description-skeleton">
        <span class="social-gamebanana-skeleton-block"></span>
        <span class="social-gamebanana-skeleton-block"></span>
        <span class="social-gamebanana-skeleton-block"></span>
        <span class="social-gamebanana-skeleton-block social-gamebanana-skeleton-line-short"></span>
      </div>
    `;
  }

  renderGameBananaFileList(files: GameBananaFileEntry[], loading = false) {
    const filesTitle = escapeHtml(
      this.manager.getSocialTranslation('social.files', 'Files'),
    );
    if (loading) {
      return `
        <div class="social-gamebanana-files">
          <h4 class="social-gamebanana-files-title">${filesTitle}</h4>
          <div class="social-gamebanana-files-list">
            ${Array.from({ length: 3 }, () => this.renderGameBananaFileSkeletonCard()).join('')}
          </div>
        </div>
      `;
    }

    if (!Array.isArray(files) || files.length === 0) {
      return `
        <div class="social-gamebanana-files">
          <h4 class="social-gamebanana-files-title">${filesTitle}</h4>
          <p class="social-gamebanana-files-empty">${escapeHtml(
            this.manager.getSocialTranslation(
              'social.noDownloadableFiles',
              'No downloadable files found.',
            ),
          )}</p>
        </div>
      `;
    }

    return `
      <div class="social-gamebanana-files">
        <h4 class="social-gamebanana-files-title">${filesTitle}</h4>
        <div class="social-gamebanana-files-list">
          ${files.map((file) => this.renderGameBananaFileCard(file)).join('')}
        </div>
      </div>
    `;
  }

  renderGameBananaFileSkeletonCard() {
    return `
      <div class="social-gamebanana-file-card social-gamebanana-file-card-skeleton">
        <div class="social-gamebanana-file-info">
          <div class="social-gamebanana-skeleton-block social-gamebanana-skeleton-file-name"></div>
          <div class="social-gamebanana-skeleton-block social-gamebanana-skeleton-file-description"></div>
          <div class="social-gamebanana-file-meta social-gamebanana-skeleton-row">
            <span class="social-gamebanana-skeleton-block social-gamebanana-skeleton-file-meta"></span>
            <span class="social-gamebanana-skeleton-block social-gamebanana-skeleton-file-meta"></span>
          </div>
        </div>
        <div class="social-gamebanana-skeleton-block social-gamebanana-skeleton-download-btn"></div>
      </div>
    `;
  }

  renderGameBananaFileCard(file: GameBananaFileEntry) {
    const downloadText = this.manager.getSocialTranslation(
      'social.download',
      'Download',
    );
    const fileName = escapeHtml(file._sFile || downloadText);
    const description = escapeHtml(file._sDescription || '');
    const size = escapeHtml(
      this.formatGameBananaFileSize(file._nFilesize),
    );
    const downloads = Number(file._nDownloadCount || 0);
    const downloadUrl = escapeHtml(this.getGameBananaFileInstallUrl(file));
    const analysis = escapeHtml(file._sAnalysisResult || '');
    const av = escapeHtml(file._sAvResult || '');

    return `
      <div class="social-gamebanana-file-card">
        <div class="social-gamebanana-file-info">
          <h5 class="social-gamebanana-file-name">${fileName}</h5>
          ${description ? `<p class="social-gamebanana-file-description">${description}</p>` : ''}
          <div class="social-gamebanana-file-meta">
            ${size ? `<span>${size}</span>` : ''}
            <span><i class="bi bi-download"></i> ${downloads}</span>
            ${analysis ? `<span>${analysis}</span>` : ''}
            ${av ? `<span>${av}</span>` : ''}
          </div>
        </div>
        <button class="social-gamebanana-file-download-btn" data-download-url="${downloadUrl}" data-file-id="${escapeHtml(file._idRow || '')}" ${downloadUrl ? '' : 'disabled'}>
          <i class="bi bi-download"></i>
          <span>${escapeHtml(downloadText)}</span>
        </button>
      </div>
    `;
  }

  getDownloadIdFromGameBananaUrl(url: string) {
    return (
      url.match(/\/dl\/(\d+)/)?.[1] || url.match(/\/mmdl\/(\d+)/)?.[1] || ''
    );
  }

  getGameBananaFileExtension(fileName: string) {
    const extension = fileName.split('.').pop()?.trim();
    return extension || 'zip';
  }

  getGameBananaFileByDownloadId(downloadId: string) {
    const files = this.manager.gameBananaCurrentDetail?.files || [];
    return files.find((file) => {
      const fileId = file._idRow ? String(file._idRow) : '';
      const urlId = file._sDownloadUrl
        ? this.getDownloadIdFromGameBananaUrl(file._sDownloadUrl)
        : '';
      const protocolId = file._sFightPlannerDownloadUrl
        ? this.getDownloadIdFromGameBananaUrl(file._sFightPlannerDownloadUrl)
        : '';
      return (
        fileId === downloadId ||
        urlId === downloadId ||
        protocolId === downloadId
      );
    });
  }

  getGameBananaFileInstallUrl(file: GameBananaFileEntry) {
    return file._sFightPlannerDownloadUrl || file._sDownloadUrl || '';
  }

  createGameBananaSocialPayload(downloadUrl: string) {
    if (!this.manager.gameBananaCurrentDetail || !this.manager.gameBananaLastDetailSource) {
      return null;
    }

    const downloadId = this.getDownloadIdFromGameBananaUrl(downloadUrl);
    if (!downloadId) return null;

    const { details, fallback, files } = this.manager.gameBananaCurrentDetail;
    const merged = {
      ...fallback,
      ...details,
      _aSubmitter: details?._aSubmitter || fallback?._aSubmitter,
      _aPreviewMedia: details?._aPreviewMedia || fallback?._aPreviewMedia,
    } as GameBananaTopSubmission;
    const selectedFile = this.getGameBananaFileByDownloadId(downloadId);
    const fileName = selectedFile?._sFile || 'download.zip';
    const modId = String(
      merged._idRow || this.manager.gameBananaLastDetailSource.submissionId,
    );
    const extension = this.getGameBananaFileExtension(fileName);
    const link = `fightplanner:https://gamebanana.com/mmdl/${downloadId},${merged._sModelName || 'Mod'},${modId},${extension}`;
    const imageUrl = this.manager.getGameBananaSubmissionImage(merged);
    const availableFiles = files.map((file) => ({
      id: file._idRow || '',
      name: file._sFile || 'Download',
      description: file._sDescription || '',
      size: Number(file._nFilesize || 0),
      downloads: Number(file._nDownloadCount || 0),
    }));

    return {
      link,
      downloadId,
      modId,
      modName: merged._sName || 'Unknown Mod',
      creator: merged._aSubmitter?._sName || 'Unknown',
      imageUrl,
      availableFiles,
    };
  }

  formatGameBananaFileSize(bytes?: number) {
    const value = Number(bytes || 0);
    if (!value) return '';

    const units = ['B', 'KB', 'MB', 'GB'];
    let size = value;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  }

  formatGameBananaPeriod(period?: string) {
    const labels = {
      today: 'Today',
      week: 'This week',
      month: 'This month',
      '3month': '3 months',
      '6month': '6 months',
      year: 'This year',
      alltime: 'All time',
    };

    return period && labels[period] ? labels[period] : 'Featured';
  }
}
