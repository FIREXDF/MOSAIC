class GameBananaTransitionsSection {
  manager: SocialGameBananaManager;

  constructor(manager: SocialGameBananaManager) {
    this.manager = manager;
  }

  getGameBananaSourcePreviewRect(sourceCard?: HTMLElement) {
    const sourceImage = sourceCard?.querySelector<HTMLElement>(
      '.social-gamebanana-featured-image, .social-gamebanana-card-image, .social-mod-image',
    );
    const source = sourceImage || sourceCard;
    return source?.getBoundingClientRect() || null;
  }

  getSocialMainScrollTop() {
    const mainContent = document.querySelector<HTMLElement>(
      '.social-main-content',
    );
    return mainContent?.scrollTop || 0;
  }

  setSocialMainScrollTop(scrollTop: number) {
    const mainContent = document.querySelector<HTMLElement>(
      '.social-main-content',
    );
    if (mainContent) {
      mainContent.scrollTop = scrollTop;
    }
  }

  scrollGameBananaDetailToTop() {
    this.setSocialMainScrollTop(0);
    const discoverContent = document.querySelector<HTMLElement>(
      '#social-discover-content',
    );
    if (discoverContent) {
      discoverContent.scrollTop = 0;
    }

    requestAnimationFrame(() => {
      this.setSocialMainScrollTop(0);
      if (discoverContent) {
        discoverContent.scrollTop = 0;
      }
    });
  }

  keepGameBananaTargetVisible(target: HTMLElement) {
    const mainContent = document.querySelector<HTMLElement>(
      '.social-main-content',
    );
    if (!mainContent) return;

    const containerRect = mainContent.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const padding = 24;

    if (targetRect.top < containerRect.top + padding) {
      mainContent.scrollTop -= containerRect.top + padding - targetRect.top;
    } else if (targetRect.bottom > containerRect.bottom - padding) {
      mainContent.scrollTop +=
        targetRect.bottom - (containerRect.bottom - padding);
    }
  }

  getGameBananaCardSourceKind(card: HTMLElement): 'featured' | 'grid' {
    return card.classList.contains('social-gamebanana-card-featured')
      ? 'featured'
      : 'grid';
  }

  findGameBananaReturnTarget(
    source: NonNullable<SocialManagerBase['gameBananaLastDetailSource']>,
  ) {
    const cards = Array.from(
      document.querySelectorAll<HTMLElement>('.social-gamebanana-card'),
    ).filter(
      (card) =>
        card.getAttribute('data-gb-model') === source.modelName &&
        card.getAttribute('data-gb-id') === source.submissionId,
    );

    return (
      cards.find(
        (card) => this.getGameBananaCardSourceKind(card) === source.sourceKind,
      ) ||
      cards[0] ||
      null
    );
  }

  captureGameBananaDiscoverSnapshot() {
    const discoverContent = document.querySelector<HTMLElement>(
      '#social-discover-content',
    );
    if (!discoverContent) return;

    this.manager.gameBananaDiscoverSnapshot = {
      html: discoverContent.innerHTML,
      page: this.manager.gameBananaModsPage,
      scrollTop: this.getSocialMainScrollTop(),
    };
  }

  fadeGameBananaDetailInfo(direction: 'in' | 'out') {
    const gsapRef = window.gsap;
    const detailInfo = document.querySelector<HTMLElement>(
      '.social-gamebanana-detail-info',
    );
    if (!detailInfo) return Promise.resolve();

    if (!gsapRef) {
      detailInfo.style.opacity = direction === 'in' ? '1' : '0';
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      gsapRef.to(detailInfo, {
        autoAlpha: direction === 'in' ? 1 : 0,
        y: direction === 'in' ? 0 : 8,
        duration: 0.16,
        ease: 'power1.out',
        onComplete: resolve,
      });
    });
  }

  fadeGameBananaRestoredBackground() {
    const gsapRef = window.gsap;
    const discoverContent = document.querySelector<HTMLElement>(
      '#social-discover-content',
    );
    if (!gsapRef || !discoverContent) return;

    gsapRef.fromTo(
      discoverContent,
      { autoAlpha: 0.86 },
      {
        autoAlpha: 1,
        duration: 0.18,
        ease: 'power1.out',
        overwrite: 'auto',
      },
    );
  }

  fadeGameBananaDetailOverlayOut(discoverContent: HTMLElement) {
    const gsapRef = window.gsap;
    if (!gsapRef) return;

    const rect = discoverContent.getBoundingClientRect();
    const overlay = discoverContent.cloneNode(true) as HTMLElement;
    overlay.style.position = 'fixed';
    overlay.style.left = `${rect.left}px`;
    overlay.style.top = `${rect.top}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
    overlay.style.margin = '0';
    overlay.style.overflow = 'hidden';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '9999';
    document.body.appendChild(overlay);

    gsapRef.to(overlay, {
      autoAlpha: 0,
      duration: 0.18,
      ease: 'power1.out',
      onComplete: () => overlay.remove(),
    });
  }

  animateGameBananaPreviewToDetail(
    sourceCard?: HTMLElement,
    sourceRect?: DOMRect | null,
  ) {
    const gsapRef = window.gsap;
    const targetImage = document.querySelector<HTMLElement>(
      '.social-gamebanana-detail-image',
    );
    const sourceImage = sourceCard?.querySelector<HTMLImageElement>(
      '.social-gamebanana-featured-image, .social-gamebanana-card-image, .social-mod-image',
    );

    if (!gsapRef || !sourceRect || !targetImage || !sourceImage?.src) {
      this.manager.gameBananaPreviewAnimation = null;
      return Promise.resolve();
    }

    const targetRect = targetImage.getBoundingClientRect();
    const clone = document.createElement('img');
    clone.src = sourceImage.src;
    clone.className = 'social-gamebanana-preview-flyout';
    if (sourceCard?.querySelector('.social-gamebanana-preview-media.is-nsfw')) {
      clone.classList.add('is-nsfw');
    }
    clone.style.objectFit = 'cover';
    clone.style.objectPosition = 'center';
    clone.style.left = `${sourceRect.left}px`;
    clone.style.top = `${sourceRect.top}px`;
    clone.style.width = `${sourceRect.width}px`;
    clone.style.height = `${sourceRect.height}px`;
    document.body.appendChild(clone);

    gsapRef.set(targetImage, { autoAlpha: 0 });
    this.manager.gameBananaPreviewAnimation = new Promise<void>((resolve) => {
      gsapRef.fromTo(
        clone,
        {
          x: 0,
          y: 0,
          width: sourceRect.width,
          height: sourceRect.height,
        },
        {
          x: targetRect.left - sourceRect.left,
          y: targetRect.top - sourceRect.top,
          width: targetRect.width,
          height: targetRect.height,
          duration: 0.46,
          ease: 'power3.out',
          onComplete: () => {
            clone.remove();
            gsapRef.to(targetImage, {
              autoAlpha: 1,
              duration: 0.12,
              ease: 'power1.out',
              onComplete: () => {
                this.manager.gameBananaPreviewAnimation = null;
                resolve();
              },
            });
          },
        },
      );
    });

    gsapRef.fromTo(
      '.social-gamebanana-detail-info',
      { autoAlpha: 0, y: 14 },
      { autoAlpha: 1, y: 0, duration: 0.28, delay: 0.12, ease: 'power2.out' },
    );

    return this.manager.gameBananaPreviewAnimation;
  }

  async returnFromGameBananaDetail() {
    if (this.manager.gameBananaDetailReturnInProgress) return;
    this.manager.gameBananaDetailReturnInProgress = true;
    this.manager.gameBananaDetailRequestId++;
    this.manager.gameBananaUmcState = null;

    try {
      const detailImage = document.querySelector<HTMLImageElement>(
        '.social-gamebanana-detail-image',
      );
      const firstGalleryImageSrc =
        this.startGameBananaGalleryBackToFirstImage();
      const source = this.manager.gameBananaLastDetailSource;
      const detailRect = detailImage?.getBoundingClientRect() || null;
      const detailSrc = firstGalleryImageSrc || detailImage?.src || '';
      const snapshot = this.manager.gameBananaDiscoverSnapshot;
      if (snapshot) {
        const discoverContent = document.querySelector<HTMLElement>(
          '#social-discover-content',
        );
        if (discoverContent) {
          this.fadeGameBananaDetailOverlayOut(discoverContent);
          discoverContent.innerHTML = snapshot.html;
          discoverContent.style.opacity = '1';
          discoverContent.style.visibility = 'visible';
          discoverContent.style.transform = '';
          discoverContent.style.transition = '';
        }
        this.manager.gameBananaModsPage = snapshot.page;
        this.manager.featured.setGameBananaFeaturedCardPositions();
        this.setSocialMainScrollTop(snapshot.scrollTop);
        this.fadeGameBananaRestoredBackground();
      } else {
        const pageToRestore = source?.page || 1;
        await this.manager.loadDiscover();
        if (pageToRestore > 1) {
          await this.manager.loadGameBananaModsPage(pageToRestore);
        }
        this.setSocialMainScrollTop(source?.scrollTop || 0);
        this.fadeGameBananaRestoredBackground();
      }

      const searchInput = document.querySelector<HTMLInputElement>(
        '#social-gamebanana-search-input',
      );
      if (searchInput && this.manager.gameBananaSearchQuery) {
        searchInput.value = this.manager.gameBananaSearchQuery;
      }

      this.manager.gameBananaDiscoverSnapshot = null;
      this.manager.gameBananaCurrentDetail = null;
      this.manager.gameBananaLastDetailSource = null;

      if (!source || !detailRect || !detailSrc) {
        return;
      }

      const targetCard = this.findGameBananaReturnTarget(source);
      const targetImage = targetCard?.querySelector<HTMLElement>(
        '.social-gamebanana-featured-image, .social-gamebanana-card-image',
      );
      if (targetCard) {
        this.keepGameBananaTargetVisible(targetCard);
      }
      const targetRect = targetImage?.getBoundingClientRect() || null;

      if (!targetImage || !targetRect) return;

      this.animateGameBananaDetailToPreview(detailRect, detailSrc, targetImage);
    } finally {
      this.manager.gameBananaDetailReturnInProgress = false;
    }
  }

  startGameBananaGalleryBackToFirstImage() {
    const gallery = document.querySelector<HTMLElement>(
      '.social-gamebanana-gallery',
    );
    const image = gallery?.querySelector<HTMLImageElement>(
      '.social-gamebanana-detail-image',
    );
    const firstThumb = gallery?.querySelector<HTMLButtonElement>(
      '.social-gamebanana-gallery-thumb[data-gallery-index="0"]',
    );
    if (!gallery || !image || !firstThumb) return '';

    const currentIndex = Number(
      gallery.getAttribute('data-gallery-index') || 0,
    );
    if (currentIndex === 0) return image.src || '';

    const firstImageUrl = firstThumb.getAttribute('data-image-url');
    if (!firstImageUrl) return image.src || '';
    if (image.src === firstImageUrl) return firstImageUrl;

    const width = Number(firstThumb.getAttribute('data-width'));
    const height = Number(firstThumb.getAttribute('data-height'));
    if (width > 0 && height > 0) {
      image.style.aspectRatio = `${width} / ${height}`;
    } else {
      image.style.aspectRatio = '';
    }

    image.style.transition = 'opacity 0.18s ease';
    image.style.opacity = '0.55';
    image.src = firstImageUrl;
    this.manager.detail.updateGameBananaGalleryCaption(
      gallery,
      firstThumb.getAttribute('data-caption') || '',
    );
    gallery.setAttribute('data-gallery-index', '0');
    gallery
      .querySelectorAll<HTMLButtonElement>('.social-gamebanana-gallery-thumb')
      .forEach((thumb) => {
        thumb.classList.toggle(
          'active',
          thumb.getAttribute('data-gallery-index') === '0',
        );
      });

    requestAnimationFrame(() => {
      image.style.opacity = '1';
      window.setTimeout(() => {
        image.style.transition = '';
      }, 190);
    });

    return firstImageUrl;
  }

  animateGameBananaDetailToPreview(
    detailRect: DOMRect,
    detailSrc: string,
    targetImage: HTMLElement,
  ) {
    const gsapRef = window.gsap;
    const targetRect = targetImage.getBoundingClientRect();

    if (!gsapRef || !targetRect) return;

    const clone = document.createElement('img');
    clone.src = detailSrc;
    clone.className = 'social-gamebanana-preview-flyout';
    if (targetImage.closest('.social-gamebanana-preview-media.is-nsfw')) {
      clone.classList.add('is-nsfw');
    }
    clone.style.objectFit = 'cover';
    clone.style.objectPosition = 'center';
    clone.style.left = `${detailRect.left}px`;
    clone.style.top = `${detailRect.top}px`;
    clone.style.width = `${detailRect.width}px`;
    clone.style.height = `${detailRect.height}px`;
    document.body.appendChild(clone);

    gsapRef.killTweensOf(targetImage);
    gsapRef.set(targetImage, { autoAlpha: 0 });

    gsapRef.fromTo(
      clone,
      {
        x: 0,
        y: 0,
        width: detailRect.width,
        height: detailRect.height,
      },
      {
        x: targetRect.left - detailRect.left,
        y: targetRect.top - detailRect.top,
        width: targetRect.width,
        height: targetRect.height,
        duration: 0.42,
        ease: 'power3.out',
        onComplete: () => {
          gsapRef.to(targetImage, {
            autoAlpha: 1,
            duration: 0.12,
            ease: 'power1.out',
            onComplete: () => {
              clone.remove();
            },
          });
        },
      },
    );
  }
}
