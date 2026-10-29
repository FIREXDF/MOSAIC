class StatusBarAnimations {
  manager: Window['statusBarManager'];

  constructor(manager: Window['statusBarManager']) {
    this.manager = manager;
  }

  clearIslandAnimationTimers() {
    if (this.manager.islandPulseTimeout) {
      clearTimeout(this.manager.islandPulseTimeout);
      this.manager.islandPulseTimeout = null;
    }

    if (this.manager.islandSettleTimeout) {
      clearTimeout(this.manager.islandSettleTimeout);
      this.manager.islandSettleTimeout = null;
    }
  }

  clearIslandGsapTimeline() {
    if (this.manager.islandGsapTimeline) {
      this.manager.islandGsapTimeline.kill();
      this.manager.islandGsapTimeline = null;
    }
  }

  resetIslandAnimationStyles(...elements: Array<HTMLElement | null>) {
    elements.forEach((element) => {
      if (!element) {
        return;
      }

      element.style.removeProperty('transform');
      element.style.removeProperty('opacity');
      element.style.removeProperty('filter');
      element.style.removeProperty('clip-path');
      element.style.removeProperty('visibility');
      element.style.removeProperty('will-change');
    });
  }

  renderDownloadCardWithFlip(
    content: HTMLElement,
    render: () => void,
  ) {
    const { gsapRef, flipRef } = this.resolveFlipRuntime();

    if (
      !gsapRef ||
      !flipRef ||
      document.body.classList.contains('no-animations')
    ) {
      render();
      return;
    }

    try {
      if (window.__flipPluginRegistered !== true) {
        gsapRef.registerPlugin(flipRef);
        window.__flipPluginRegistered = true;
      }

      this.ensureDownloadFlipIds(content);

      const currentTargets = Array.from(
        content.querySelectorAll<HTMLElement>('[data-flip-id]'),
      );

      if (currentTargets.length === 0) {
        render();
        return;
      }

      const previousHeight = content.getBoundingClientRect().height;
      const state = flipRef.getState(currentTargets);
      render();
      this.ensureDownloadFlipIds(content);
      this.animateExtendedContentHeight(content, previousHeight);

      const nextTargets = Array.from(
        content.querySelectorAll<HTMLElement>('[data-flip-id]'),
      );

      if (nextTargets.length === 0) {
        return;
      }

      flipRef.from(state, {
        targets: nextTargets,
        duration: document.body.classList.contains('reduced-animations')
          ? 0.2
          : 0.68,
        ease: 'expo.out',
        absolute: false,
        nested: true,
        scale: true,
        simple: false,
        prune: true,
      });
    } catch (error) {
      render();
    }
  }

  resolveFlipRuntime() {
    let gsapRef = window.gsap;
    let flipRef = window.Flip;

    if ((!gsapRef || !flipRef) && typeof require === 'function') {
      try {
        const gsapModule = require('gsap');
        const flipModule = require('gsap/Flip');

        gsapRef =
          gsapRef ||
          gsapModule?.gsap ||
          gsapModule?.default ||
          gsapModule;
        flipRef =
          flipRef ||
          flipModule?.Flip ||
          flipModule?.default ||
          flipModule;

        if (!window.gsap && gsapRef) {
          window.gsap = gsapRef;
        }

        if (!window.Flip && flipRef) {
          window.Flip = flipRef;
        }
      } catch (error) {
        // Keep the window globals path as the primary runtime.
      }
    }

    return { gsapRef, flipRef };
  }

  animateExtendedContentHeight(
    content: HTMLElement,
    previousHeight: number,
  ) {
    const { gsapRef } = this.resolveFlipRuntime();

    if (
      !gsapRef ||
      previousHeight <= 0 ||
      document.body.classList.contains('no-animations')
    ) {
      return;
    }

    const previousInlineHeight = content.style.height;
    const previousBoxSizing = content.style.boxSizing;

    content.style.height = 'auto';
    content.style.boxSizing = 'border-box';
    const nextHeight = content.getBoundingClientRect().height;
    content.style.height = previousInlineHeight;
    content.style.boxSizing = previousBoxSizing;

    if (Math.abs(nextHeight - previousHeight) < 1) {
      return;
    }

    const reducedAnimations =
      document.body.classList.contains('reduced-animations');

    gsapRef.killTweensOf(content, 'height');
    gsapRef.fromTo(
      content,
      {
        boxSizing: 'border-box',
        height: previousHeight,
      },
      {
        height: nextHeight,
        duration: reducedAnimations ? 0.16 : 0.62,
        ease: 'expo.out',
        clearProps: 'height,boxSizing',
        overwrite: 'auto',
      },
    );
  }

  ensureDownloadFlipIds(content: HTMLElement) {
    const idMap: Array<[string, string]> = [
      ['.ext-status-badge', 'download-badge'],
      ['.ext-filename, .ext-download-title', 'download-title'],
      ['.ext-progress-row, .ext-multi-dl-list', 'download-body'],
    ];

    idMap.forEach(([selector, flipId]) => {
      const element = content.querySelector<HTMLElement>(selector);
      if (element && !element.dataset.flipId) {
        element.setAttribute('data-flip-id', flipId);
      }
    });
  }

  getDownloadFlipKey(id: string) {
    return `download-item-${String(id || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  }

  getDownloadNameFlipKey(id: string) {
    return `${this.getDownloadFlipKey(id)}-name`;
  }

  getDownloadProgressFlipKey(id: string) {
    return `${this.getDownloadFlipKey(id)}-progress`;
  }

  animateElementTextChange(
    element: HTMLElement | null,
    nextText: string,
    className = 'ext-count-bump',
    duration = 420,
  ) {
    if (!element) {
      return;
    }

    const previousText = element.textContent ?? '';

    if (previousText === nextText) {
      return;
    }

    const { gsapRef } = this.resolveFlipRuntime();
    const reducedAnimations =
      document.body.classList.contains('reduced-animations');

    if (!gsapRef || document.body.classList.contains('no-animations')) {
      element.textContent = nextText;
      this.restartTransientElementAnimation(element, className, duration);
      return;
    }

    gsapRef.killTweensOf(element);
    gsapRef
      .timeline({
        defaults: { overwrite: 'auto' },
        onComplete: () => {
          gsapRef.set(element, {
            clearProps: 'transform,opacity,visibility,filter,transformOrigin',
          });
        },
      })
      .to(element, {
        y: reducedAnimations ? 1 : 5,
        scale: reducedAnimations ? 0.995 : 0.965,
        autoAlpha: reducedAnimations ? 0.72 : 0,
        filter: reducedAnimations ? 'blur(0px)' : 'blur(4px)',
        transformOrigin: '50% 50%',
        duration: reducedAnimations ? 0.06 : 0.12,
        ease: 'power2.in',
        onComplete: () => {
          element.textContent = nextText;
        },
      })
      .fromTo(
        element,
        {
          y: reducedAnimations ? -1 : -7,
          scale: reducedAnimations ? 1.002 : 1.045,
          autoAlpha: reducedAnimations ? 0.72 : 0,
          filter: reducedAnimations ? 'blur(0px)' : 'blur(5px)',
          transformOrigin: '50% 50%',
        },
        {
          y: 0,
          scale: 1,
          autoAlpha: 1,
          filter: 'blur(0px)',
          duration: reducedAnimations ? 0.14 : 0.34,
          ease: 'expo.out',
        },
      );
  }

  animateProgressFill(fillEl: HTMLElement | null, progress: number) {
    if (!fillEl) {
      return;
    }

    const { gsapRef } = this.resolveFlipRuntime();
    const reducedAnimations =
      document.body.classList.contains('reduced-animations');

    if (!gsapRef || document.body.classList.contains('no-animations')) {
      fillEl.style.width = `${progress}%`;
      return;
    }

    gsapRef.to(fillEl, {
      width: `${progress}%`,
      duration: reducedAnimations ? 0.16 : 0.48,
      ease: 'power3.out',
      overwrite: 'auto',
    });
  }

  getMultiDownloadViewData(dl: DownloadItem) {
    const progress = Math.round(dl.progress || 0);
    const displayName = this.manager.downloads._getDownloadDisplayName(dl);
    let pctText = `${progress}%`;

    if (dl.statusText) {
      const lowerStatus = dl.statusText.toLowerCase();
      if (lowerStatus.includes('extract')) pctText = 'Extracting...';
      else if (lowerStatus.includes('verif')) pctText = 'Verifying...';
    }

    return { progress, displayName, pctText };
  }

  createMultiDownloadItemElement(dl: DownloadItem) {
    const item = document.createElement('div');
    const { progress, displayName, pctText } = this.getMultiDownloadViewData(dl);

    item.className = 'ext-multi-dl-item';
    item.dataset.dlId = dl.id;
    item.setAttribute('data-flip-id', this.getDownloadFlipKey(dl.id));
    item.innerHTML = `
      <div class="ext-multi-dl-info">
        <span class="ext-multi-dl-name" data-flip-id="${this.getDownloadNameFlipKey(dl.id)}" title="${displayName}">${displayName}</span>
        <span class="ext-multi-dl-pct" data-flip-id="${this.getDownloadFlipKey(dl.id)}-pct">${pctText}</span>
      </div>
      <div class="ext-multi-dl-bar" data-flip-id="${this.getDownloadProgressFlipKey(dl.id)}">
        <div class="ext-multi-dl-fill" style="width: ${progress}%"></div>
      </div>
    `;

    return item;
  }

  updateMultiDownloadItemElement(itemEl: HTMLElement, dl: DownloadItem) {
    const { progress, displayName, pctText } = this.getMultiDownloadViewData(dl);
    const nameEl = itemEl.querySelector('.ext-multi-dl-name');
    const pctEl = itemEl.querySelector('.ext-multi-dl-pct');
    const fillEl = itemEl.querySelector('.ext-multi-dl-fill') as HTMLElement | null;

    itemEl.dataset.dlId = dl.id;
    if (nameEl) {
      (nameEl as HTMLElement).title = displayName;
      this.animateElementTextChange(nameEl as HTMLElement, displayName, 'ext-text-swap', 280);
    }
    if (pctEl) this.animateElementTextChange(pctEl as HTMLElement, pctText, 'ext-text-swap', 280);
    this.animateProgressFill(fillEl, progress);
  }

  animateMultiDownloadListChanges(
    content: HTMLElement,
    downloads: DownloadItem[],
  ) {
    const { gsapRef, flipRef } = this.resolveFlipRuntime();
    const listEl = content.querySelector<HTMLElement>('.ext-multi-dl-list');
    const badgeEl = content.querySelector('.ext-status-badge');

    if (!listEl) {
      return false;
    }

    const existingItems = Array.from(
      listEl.querySelectorAll<HTMLElement>('.ext-multi-dl-item'),
    );
    const existingById = new Map(
      existingItems.map((item) => [item.dataset.dlId || '', item]),
    );
    const nextIds = new Set(downloads.map((dl) => dl.id));
    const reducedAnimations =
      document.body.classList.contains('reduced-animations');
    const canAnimate =
      !!gsapRef &&
      !!flipRef &&
      !document.body.classList.contains('no-animations');

    if (badgeEl) {
      this.animateElementTextChange(
        badgeEl as HTMLElement,
        `${downloads.length} Downloads`,
      );
    }

    if (!canAnimate) {
      listEl.replaceChildren();
      downloads.forEach((dl) => {
        listEl.appendChild(this.createMultiDownloadItemElement(dl));
      });
      return true;
    }

    if (window.__flipPluginRegistered !== true) {
      gsapRef.registerPlugin(flipRef);
      window.__flipPluginRegistered = true;
    }

    const previousContentHeight = content.getBoundingClientRect().height;
    const listState = flipRef.getState(existingItems);
    const listRect = listEl.getBoundingClientRect();
    const leavingClones: HTMLElement[] = [];

    existingItems.forEach((item) => {
      const id = item.dataset.dlId;
      if (!id || nextIds.has(id)) {
        return;
      }

      const itemRect = item.getBoundingClientRect();
      const clone = item.cloneNode(true) as HTMLElement;
      clone.style.position = 'absolute';
      clone.style.left = `${itemRect.left - listRect.left}px`;
      clone.style.top = `${itemRect.top - listRect.top}px`;
      clone.style.width = `${itemRect.width}px`;
      clone.style.height = `${itemRect.height}px`;
      clone.style.margin = '0';
      clone.style.pointerEvents = 'none';
      clone.style.zIndex = '3';
      listEl.appendChild(clone);
      leavingClones.push(clone);
      item.remove();
    });

    const enteringItems: HTMLElement[] = [];

    downloads.forEach((dl) => {
      const existingItem = existingById.get(dl.id);
      if (existingItem) {
        this.updateMultiDownloadItemElement(existingItem, dl);
        listEl.appendChild(existingItem);
        return;
      }

      const newItem = this.createMultiDownloadItemElement(dl);
      newItem.classList.add('entering');
      listEl.appendChild(newItem);
      enteringItems.push(newItem);
    });

    this.animateExtendedContentHeight(content, previousContentHeight);

    const remainingItems = Array.from(
      listEl.querySelectorAll<HTMLElement>('.ext-multi-dl-item:not(.entering)'),
    );

    flipRef.from(listState, {
      targets: remainingItems,
      duration: reducedAnimations ? 0.18 : 0.52,
      ease: 'expo.out',
      absolute: false,
      nested: true,
      simple: false,
      prune: true,
    });

    if (enteringItems.length > 0) {
      gsapRef.fromTo(
        enteringItems,
        {
          autoAlpha: 0,
          x: reducedAnimations ? -2 : -10,
          y: reducedAnimations ? 4 : 16,
          scale: reducedAnimations ? 0.995 : 0.975,
          filter: reducedAnimations ? 'blur(0px)' : 'blur(6px)',
        },
        {
          autoAlpha: 1,
          x: 0,
          y: 0,
          scale: 1,
          filter: 'blur(0px)',
          duration: reducedAnimations ? 0.16 : 0.44,
          ease: 'expo.out',
          stagger: reducedAnimations ? 0.015 : 0.065,
          clearProps: 'transform,opacity,visibility,filter',
          onComplete: () => {
            enteringItems.forEach((item) => item.classList.remove('entering'));
          },
        },
      );
    }

    if (leavingClones.length > 0) {
      gsapRef.to(leavingClones, {
        autoAlpha: 0,
        x: reducedAnimations ? -2 : -8,
        y: reducedAnimations ? -4 : -12,
        scale: reducedAnimations ? 0.995 : 0.98,
        filter: reducedAnimations ? 'blur(0px)' : 'blur(5px)',
        duration: reducedAnimations ? 0.14 : 0.34,
        ease: 'power2.inOut',
        stagger: reducedAnimations ? 0.01 : 0.045,
        onComplete: () => {
          leavingClones.forEach((clone) => clone.remove());
        },
      });
    }

    return true;
  }

  animateExtendedBarEntrance(bottomBar: HTMLElement, content: HTMLElement) {
    const gsapRef = window.gsap;
    const statusBarContent =
      bottomBar.querySelector<HTMLElement>('.status-bar-content');

    if (
      !gsapRef ||
      !statusBarContent ||
      document.body.classList.contains('no-animations')
    ) {
      bottomBar.classList.remove('gsap-island-animating');
      return;
    }

    this.clearIslandGsapTimeline();
    bottomBar.classList.add('gsap-island-animating');

    const reducedAnimations =
      document.body.classList.contains('reduced-animations');
    const card = content.firstElementChild as HTMLElement | null;
    const iconContainer =
      card?.querySelector<HTMLElement>('.ext-card-icon-container') || null;
    const details = card?.querySelector<HTMLElement>('.ext-card-details') || null;
    const primaryMeta =
      card?.querySelector<HTMLElement>(
        '.ext-progress-row, .ext-card-meta, .ext-conflict-message, .ext-multi-dl-list',
      ) || null;
    const actionButton =
      card?.querySelector<HTMLElement>('.ext-action-btn') || null;
    const rows = card
      ? Array.from(card.querySelectorAll<HTMLElement>('.ext-multi-dl-item'))
      : [];
    const transformOrigin = bottomBar.classList.contains('conflict-mode')
      ? 'right bottom'
      : 'left bottom';
    const timeline = gsapRef.timeline({
      defaults: { overwrite: 'auto' },
      onComplete: () => {
        this.resetIslandAnimationStyles(bottomBar, statusBarContent, content);
        bottomBar.classList.remove('gsap-island-animating');
        this.manager.islandGsapTimeline = null;
      },
    });

    this.manager.islandGsapTimeline = timeline;
    bottomBar.style.willChange = 'transform';
    statusBarContent.style.willChange = 'transform, opacity, filter';
    content.style.willChange = 'transform, opacity, filter, clip-path';

    timeline
      .fromTo(
        bottomBar,
        { y: 0 },
        {
          y: -1,
          duration: reducedAnimations ? 0.18 : 0.66,
          ease: 'expo.out',
          clearProps: 'transform',
        },
        0,
      )
      .fromTo(
        content,
        {
          transformOrigin,
          y: reducedAnimations ? 8 : 16,
          scaleX: 0.992,
          scaleY: 0.94,
          autoAlpha: 0,
          filter: 'blur(12px) saturate(0.9)',
          clipPath: 'inset(100% -50px 0 -50px)',
        },
        {
          y: 0,
          scaleX: 1,
          scaleY: 1,
          autoAlpha: 1,
          filter: 'blur(0px) saturate(1)',
          clipPath: 'inset(-50px -50px 0 -50px)',
          duration: reducedAnimations ? 0.2 : 0.72,
          ease: 'expo.out',
          clearProps: 'transform,opacity,filter,clipPath,visibility',
        },
        0,
      )
      .fromTo(
        statusBarContent,
        {
          y: 0,
          scale: 1,
          autoAlpha: 1,
        },
        {
          y: 1,
          scale: 0.992,
          autoAlpha: 0.92,
          duration: reducedAnimations ? 0.16 : 0.58,
          ease: 'expo.out',
          clearProps: 'transform,opacity,visibility',
        },
        0,
      );

    if (iconContainer) {
      timeline.fromTo(
        iconContainer,
        { y: reducedAnimations ? 4 : 10, scale: 0.9, autoAlpha: 0 },
        {
          y: -1,
          scale: 1,
          autoAlpha: 1,
          duration: reducedAnimations ? 0.14 : 0.46,
          ease: 'expo.out',
          clearProps: 'transform,opacity,visibility',
        },
        reducedAnimations ? 0.02 : 0.05,
      );
    }

    if (details) {
      timeline.fromTo(
        details,
        { y: reducedAnimations ? 4 : 10, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: 1,
          duration: reducedAnimations ? 0.14 : 0.28,
          ease: 'power3.out',
          clearProps: 'transform,opacity,visibility',
        },
        reducedAnimations ? 0.04 : 0.09,
      );
    }

    if (primaryMeta && rows.length === 0) {
      timeline.fromTo(
        primaryMeta,
        { y: reducedAnimations ? 2 : 6, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: 1,
          duration: reducedAnimations ? 0.12 : 0.22,
          ease: 'power2.out',
          clearProps: 'transform,opacity,visibility',
        },
        reducedAnimations ? 0.06 : 0.14,
      );
    }

    if (rows.length > 0) {
      timeline.fromTo(
        rows,
        { y: reducedAnimations ? 2 : 6, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: 1,
          stagger: reducedAnimations ? 0.02 : 0.045,
          duration: reducedAnimations ? 0.12 : 0.22,
          ease: 'power2.out',
          clearProps: 'transform,opacity,visibility',
        },
        reducedAnimations ? 0.06 : 0.14,
      );
    }

    if (actionButton) {
      timeline.fromTo(
        actionButton,
        { y: reducedAnimations ? 2 : 6, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: 1,
          duration: reducedAnimations ? 0.12 : 0.22,
          ease: 'power2.out',
          clearProps: 'transform,opacity,visibility',
        },
        reducedAnimations ? 0.08 : 0.18,
      );
    }
  }

  animateExtendedBarExit(
    bottomBar: HTMLElement,
    content: HTMLElement,
    onComplete: () => void,
  ) {
    const gsapRef = window.gsap;
    const statusBarContent =
      bottomBar.querySelector<HTMLElement>('.status-bar-content');

    if (
      !gsapRef ||
      !statusBarContent ||
      document.body.classList.contains('no-animations')
    ) {
      bottomBar.classList.remove('gsap-island-animating');
      this.clearIslandGsapTimeline();
      onComplete();
      return;
    }

    this.clearIslandGsapTimeline();
    bottomBar.classList.add('gsap-island-animating');

    const reducedAnimations =
      document.body.classList.contains('reduced-animations');
    const card = content.firstElementChild as HTMLElement | null;
    const iconContainer =
      card?.querySelector<HTMLElement>('.ext-card-icon-container') || null;
    const detailBlocks = card
      ? Array.from(card.querySelectorAll<HTMLElement>('.ext-card-details > *'))
      : [];
    const actionButton =
      card?.querySelector<HTMLElement>('.ext-action-btn') || null;
    const transformOrigin = bottomBar.classList.contains('conflict-mode')
      ? 'right bottom'
      : 'left bottom';
    const timeline = gsapRef.timeline({
      defaults: { overwrite: 'auto' },
      onComplete: () => {
        onComplete();
        this.resetIslandAnimationStyles(bottomBar, statusBarContent, content);
        bottomBar.classList.remove('gsap-island-animating');
        this.manager.islandGsapTimeline = null;
      },
    });

    this.manager.islandGsapTimeline = timeline;
    bottomBar.style.willChange = 'transform';
    statusBarContent.style.willChange = 'transform, opacity, filter';
    content.style.willChange = 'transform, opacity, filter, clip-path';

    if (detailBlocks.length > 0) {
      timeline.to(
        detailBlocks,
        {
          y: reducedAnimations ? 2 : 6,
          autoAlpha: 0,
          stagger: reducedAnimations ? 0.01 : 0.02,
          duration: reducedAnimations ? 0.08 : 0.14,
          ease: 'power1.in',
        },
        0,
      );
    }

    if (actionButton) {
      timeline.to(
        actionButton,
        {
          y: reducedAnimations ? 2 : 5,
          autoAlpha: 0,
          duration: reducedAnimations ? 0.08 : 0.12,
          ease: 'power1.in',
        },
        0,
      );
    }

    if (iconContainer) {
      timeline.to(
        iconContainer,
        {
          y: reducedAnimations ? 3 : 6,
          scale: 0.9,
          autoAlpha: 0,
          duration: reducedAnimations ? 0.1 : 0.16,
          ease: 'power2.in',
        },
        0,
      );
    }

    timeline
      .to(
        content,
        {
          transformOrigin,
          y: reducedAnimations ? 8 : 14,
          scaleX: 0.982,
          scaleY: 0.82,
          autoAlpha: 0,
          filter: 'blur(12px) saturate(0.9)',
          clipPath: 'inset(100% -50px 0 -50px)',
          duration: reducedAnimations ? 0.16 : 0.34,
          ease: 'power3.in',
        },
        0,
      )
      .to(
        bottomBar,
        {
          y: 0,
          scaleY: 1,
          duration: reducedAnimations ? 0.16 : 0.32,
          ease: 'power2.out',
        },
        0.02,
      )
      .to(
        statusBarContent,
        {
          y: 0,
          scale: 1,
          autoAlpha: 1,
          duration: reducedAnimations ? 0.14 : 0.28,
          ease: 'power2.out',
        },
        0.02,
      );
  }

  restartTransientElementAnimation(
    element: HTMLElement | null,
    className: string,
    duration: number,
  ) {
    if (!element) {
      return;
    }

    const existingTimeout = this.manager.transientElementTimers.get(element);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    element.classList.remove(className);
    if (document.body.classList.contains('no-animations')) {
      return;
    }

    void element.offsetWidth;
    element.classList.add(className);

    const effectiveDuration = document.body.classList.contains(
      'reduced-animations',
    )
      ? Math.min(duration, 220)
      : duration;

    const timeout = setTimeout(() => {
      element.classList.remove(className);
      this.manager.transientElementTimers.delete(element);
    }, effectiveDuration);

    this.manager.transientElementTimers.set(element, timeout);
  }

  setAnimatedElementText(
    element: HTMLElement | null,
    nextText: string,
    className = 'ext-count-bump',
    duration = 420,
  ) {
    if (!element) {
      return;
    }

    const previousText = element.textContent ?? '';
    element.textContent = nextText;

    if (previousText !== nextText) {
      this.restartTransientElementAnimation(element, className, duration);
    }
  }

  getIslandMode(bottomBar: HTMLElement) {
    if (bottomBar.classList.contains('success-mode')) {
      return 'success';
    }

    if (bottomBar.classList.contains('conflict-mode')) {
      return 'conflict';
    }

    if (bottomBar.classList.contains('download-mode')) {
      return 'download';
    }

    return 'idle';
  }

  triggerIslandPulse(
    bottomBar: HTMLElement,
    mode: 'download' | 'success' | 'conflict',
  ) {
    if (document.body.classList.contains('no-animations')) {
      return;
    }

    this.clearIslandAnimationTimers();

    bottomBar.classList.remove('island-pulse', 'island-settle', 'island-collapse');
    bottomBar.dataset.islandMode = mode;

    // Force reflow so repeated pulses retrigger cleanly.
    bottomBar.offsetHeight;
    bottomBar.classList.add('island-pulse');

    const reducedAnimations =
      document.body.classList.contains('reduced-animations');
    const pulseDuration = reducedAnimations ? 220 : 720;
    const settleDuration = reducedAnimations ? 140 : 420;

    this.manager.islandPulseTimeout = setTimeout(() => {
      bottomBar.classList.remove('island-pulse');
      bottomBar.classList.add('island-settle');

      this.manager.islandSettleTimeout = setTimeout(() => {
        bottomBar.classList.remove('island-settle');
      }, settleDuration);
    }, pulseDuration);
  }

  triggerIslandCollapse(bottomBar: HTMLElement) {
    if (document.body.classList.contains('no-animations')) {
      bottomBar.classList.remove('island-pulse', 'island-settle', 'island-collapse');
      return;
    }

    this.clearIslandAnimationTimers();
    bottomBar.classList.remove('island-pulse', 'island-settle');
    bottomBar.classList.add('island-collapse');

    const reducedAnimations =
      document.body.classList.contains('reduced-animations');
    const collapseDuration = reducedAnimations ? 180 : 420;

    this.manager.islandPulseTimeout = setTimeout(() => {
      bottomBar.classList.remove('island-collapse');
    }, collapseDuration);
  }
}
