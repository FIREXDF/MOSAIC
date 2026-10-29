class GameBananaFeaturedSection {
  manager: SocialGameBananaManager;

  constructor(manager: SocialGameBananaManager) {
    this.manager = manager;
  }

  renderGameBananaFeaturedStack() {
    if (this.manager.gameBananaFeaturedMods.length === 0) {
      return `<div class="social-gamebanana-featured-empty">${escapeHtml(
        this.manager.getSocialTranslation(
          'social.noFeaturedModsInCategory',
          'No featured mods in this category.',
        ),
      )}</div>`;
    }

    return this.manager.gameBananaFeaturedMods
      .map((mod, index) => {
        const position = this.getGameBananaFeaturedPosition(index);
        return this.renderGameBananaFeaturedCard(mod, index, position);
      })
      .join('');
  }

  getGameBananaFeaturedPosition(index: number) {
    const total = this.manager.gameBananaFeaturedMods.length;
    if (total === 0) return 'hidden';

    const active = this.manager.gameBananaFeaturedIndex;
    const previous = (active - 1 + total) % total;
    const next = (active + 1) % total;

    if (index === active) return 'active';
    if (index === previous) return 'previous';
    if (index === next) return 'next';
    return 'hidden';
  }

  renderGameBananaFeaturedCard(
    mod: GameBananaTopSubmission,
    index: number,
    position: string,
  ) {
    const name = escapeHtml(mod._sName || 'Unknown Mod');
    const url = escapeHtml(mod._sProfileUrl || '');
    const imageUrl = escapeHtml(this.manager.getGameBananaSubmissionImage(mod));
    const creator = escapeHtml(mod._aSubmitter?._sName || 'Unknown');
    const category = escapeHtml(mod._aRootCategory?._sName || 'Mod');
    const period = escapeHtml(this.manager.detail.formatGameBananaPeriod(mod._sPeriod));
    const likes = Number(mod._nLikeCount || 0);
    const comments = Number(mod._nPostCount || 0);
    const model = escapeHtml(mod._sModelName || 'Mod');
    const id = escapeHtml(mod._idRow);
    const isNsfw = this.manager.isGameBananaSubmissionNsfw(mod);

    return `
      <article class="social-gamebanana-card social-gamebanana-card-featured is-${position}" data-url="${url}" data-gb-id="${id}" data-gb-model="${model}" data-featured-index="${index}" data-featured-position="${position}">
        ${
          imageUrl
            ? this.manager.renderGameBananaPreviewMedia(
                `<img src="${imageUrl}" alt="${name}" class="social-gamebanana-featured-image">`,
                this.manager.shouldBlurGameBananaPreview(isNsfw),
              )
            : '<div class="social-gamebanana-image-placeholder"><i class="bi bi-image"></i></div>'
        }
        <div class="social-gamebanana-featured-body">
          <div class="social-gamebanana-meta">
            <span>${category}</span>
            <span>${period}</span>
          </div>
          <h3 class="social-gamebanana-card-title">${name}</h3>
          <p class="social-gamebanana-card-creator">${escapeHtml(
            this.manager.getSocialTranslation('social.byAuthor', 'by {{author}}', {
              author: creator,
            }),
          )}</p>
          <div class="social-gamebanana-card-footer">
            <span><i class="bi bi-hand-thumbs-up"></i> ${likes}</span>
            <span><i class="bi bi-chat-left"></i> ${comments}</span>
            ${this.manager.renderGameBananaDownloadStat(mod, model, id)}
          </div>
        </div>
      </article>
    `;
  }

  updateGameBananaFeaturedStack(index: number, direction = 0) {
    if (this.manager.gameBananaFeaturedMods.length === 0) return;

    const total = this.manager.gameBananaFeaturedMods.length;
    const previousIndex = this.manager.gameBananaFeaturedIndex;
    this.manager.gameBananaFeaturedIndex = (index + total) % total;

    const carousel = document.querySelector<HTMLElement>(
      '#social-gamebanana-carousel',
    );
    if (!carousel) return;

    const cards = carousel.querySelectorAll<HTMLElement>(
      '.social-gamebanana-card-featured',
    );

    if (cards.length === 0) {
      carousel.innerHTML = this.renderGameBananaFeaturedStack();
      return;
    }

    cards.forEach((card) => {
      const cardIndex = Number(card.getAttribute('data-featured-index'));
      const position = this.getGameBananaFeaturedPosition(cardIndex);

      card.classList.remove(
        'is-active',
        'is-previous',
        'is-next',
        'is-hidden',
        'was-active',
      );
      card.classList.add(`is-${position}`);
      if (
        cardIndex === previousIndex &&
        previousIndex !== this.manager.gameBananaFeaturedIndex
      ) {
        card.classList.add('was-active');
      }
      card.setAttribute('data-featured-position', position);
    });

    this.manager.animateGameBananaFeaturedCards(direction);
  }

  scrollGameBananaCarousel(direction: number) {
    this.updateGameBananaFeaturedStack(
      this.manager.gameBananaFeaturedIndex + direction,
      direction,
    );
  }

  getGameBananaFeaturedOffset() {
    const carousel = document.querySelector<HTMLElement>(
      '#social-gamebanana-carousel',
    );
    const activeCard = carousel?.querySelector<HTMLElement>(
      '.social-gamebanana-card-featured.is-active',
    );
    const width = carousel?.clientWidth || 900;
    const cardWidth = activeCard?.offsetWidth || Math.min(560, width * 0.68);
    const containedOffset = Math.max(0, (width - cardWidth * 0.88) / 2 - 12);
    const preferredOffset = Math.max(120, Math.min(300, width * 0.24));

    return Math.min(preferredOffset, containedOffset);
  }

  getGameBananaFeaturedCardState(position: string) {
    const offset = this.getGameBananaFeaturedOffset();
    const isSmall = window.innerWidth <= 720;
    const sideY = isSmall ? 16 : 18;
    const sideRotation = isSmall ? 6 : 8;

    switch (position) {
      case 'active':
        return {
          xPercent: -50,
          x: 0,
          y: 0,
          scale: 1,
          rotationY: 0,
          autoAlpha: 1,
          zIndex: 4,
          filter: 'brightness(1)',
        };
      case 'previous':
        return {
          xPercent: -50,
          x: -offset,
          y: sideY,
          scale: 0.88,
          rotationY: sideRotation,
          autoAlpha: 0.72,
          zIndex: 2,
          filter: 'brightness(0.78)',
        };
      case 'next':
        return {
          xPercent: -50,
          x: offset,
          y: sideY,
          scale: 0.88,
          rotationY: -sideRotation,
          autoAlpha: 0.72,
          zIndex: 2,
          filter: 'brightness(0.78)',
        };
      default:
        return {
          xPercent: -50,
          x: 0,
          y: 42,
          scale: 0.78,
          rotationY: 0,
          autoAlpha: 0,
          zIndex: 1,
          filter: 'brightness(0.65)',
        };
    }
  }

  setGameBananaFeaturedCardPositions() {
    const gsapRef = window.gsap;
    const cards = document.querySelectorAll<HTMLElement>(
      '#social-gamebanana-carousel .social-gamebanana-card-featured',
    );

    cards.forEach((card) => {
      const position = card.getAttribute('data-featured-position') || 'hidden';
      const state = this.getGameBananaFeaturedCardState(position);

      if (gsapRef) {
        gsapRef.set(card, state);
      } else {
        card.style.zIndex = `${state.zIndex}`;
      }
    });
  }
}
