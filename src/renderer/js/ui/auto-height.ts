const AUTO_HEIGHT_TRANSITION = 'height 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
const AUTO_HEIGHT_SELECTOR = '.modal, .character-modal';
const autoHeightBoxes = new WeakSet<HTMLElement>();

function animateHeightChanges(box: HTMLElement): void {
  if (autoHeightBoxes.has(box)) return;
  autoHeightBoxes.add(box);

  let lastHeight = -1;
  let animating = false;
  let savedTransition = '';
  let composedTransition = '';
  let finishTimer: ReturnType<typeof setTimeout> | undefined;
  const observed = new Set<Element>();

  const finish = () => {
    clearTimeout(finishTimer);
    animating = false;
    box.style.height = '';
    box.style.transition = savedTransition;
  };

  const onResize = () => {
    if (box.getClientRects().length === 0) {
      if (animating) finish();
      lastHeight = -1;
      return;
    }
    const from = animating ? box.offsetHeight : lastHeight;
    if (!animating) {
      savedTransition = box.style.transition;
      composedTransition = `${getComputedStyle(box).transition}, ${AUTO_HEIGHT_TRANSITION}`;
    }
    box.style.height = '';
    const target = box.offsetHeight;
    lastHeight = target;
    if (from < 0 || Math.abs(target - from) < 1) {
      if (animating) finish();
      return;
    }
    box.style.height = from + 'px';
    box.style.transition = composedTransition;
    box.offsetHeight;
    box.style.height = target + 'px';
    animating = true;
    clearTimeout(finishTimer);
    finishTimer = setTimeout(finish, 450);
  };

  const resizeObserver = new ResizeObserver(onResize);

  const refreshTargets = () => {
    const targets = new Set<Element>();
    for (const child of Array.from(box.children)) {
      if (getComputedStyle(child).flexGrow !== '0') {
        for (const inner of Array.from(child.children)) targets.add(inner);
      } else {
        targets.add(child);
      }
    }
    observed.forEach((el) => {
      if (!targets.has(el)) resizeObserver.unobserve(el);
    });
    targets.forEach((el) => {
      if (!observed.has(el)) resizeObserver.observe(el);
    });
    observed.clear();
    targets.forEach((el) => observed.add(el));
  };

  new MutationObserver(refreshTargets).observe(box, { childList: true, subtree: true });
  refreshTargets();
}

function attachAutoHeight(root: ParentNode): void {
  if (root instanceof HTMLElement && root.matches(AUTO_HEIGHT_SELECTOR)) {
    animateHeightChanges(root);
  }
  root.querySelectorAll<HTMLElement>(AUTO_HEIGHT_SELECTOR).forEach(animateHeightChanges);
}

document.addEventListener('DOMContentLoaded', () => {
  attachAutoHeight(document);
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) attachAutoHeight(node);
      });
    }
  }).observe(document.body, { childList: true, subtree: true });
});
