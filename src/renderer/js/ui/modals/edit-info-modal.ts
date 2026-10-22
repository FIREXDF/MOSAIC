export {};
(function () {
  const M = (window as any).ModalManagerClass;
  if (!M) { console.error('[edit-info-modal] ModalManagerClass not found'); return; }

  M.prototype.openEditInfoModal = function (modPath, currentInfo, callback) {
    this.editInfoCallback = callback;
    this.currentModPath = modPath;

    const modal = document.querySelector<HTMLDivElement>('#edit-info-modal');
    const displayNameInput = document.querySelector<HTMLInputElement>('#edit-info-display-name');
    const authorsInput = document.querySelector<HTMLInputElement>('#edit-info-authors');
    const versionInput = document.querySelector<HTMLInputElement>('#edit-info-version');
    const categoryWrap = document.querySelector<HTMLElement>('#edit-info-category-select');
    const urlInput = document.querySelector<HTMLInputElement>('#edit-info-url');
    const descriptionTextarea = document.querySelector<HTMLInputElement>('#edit-info-description');
    const previewStatus = document.querySelector<HTMLElement>('#edit-info-preview-status');
    const previewInput = document.querySelector<HTMLInputElement>('#edit-info-preview-input');

    if (modal) {
      modal.classList.remove('closing');

      if (displayNameInput) displayNameInput.value = currentInfo?.display_name || '';
      if (authorsInput) authorsInput.value = currentInfo?.authors || '';
      if (versionInput) versionInput.value = currentInfo?.version || '';
      if (categoryWrap) {
        document.querySelectorAll('#edit-info-category-dropdown [data-custom]').forEach((o) => o.remove());
        (window.modManager?.mods || []).forEach((m) => this.addCustomCategoryOption(m.category));
        this.setEditInfoCategory(currentInfo?.category || '');
        this.bindEditInfoCategory(categoryWrap);
        this.closeEditInfoCategory?.();
      }
      if (urlInput) urlInput.value = currentInfo?.url || '';
      if (descriptionTextarea) descriptionTextarea.value = currentInfo?.description || '';
      if (previewStatus) previewStatus.textContent = '';
      if (previewInput) previewInput.value = '';
      this.refreshEditInfoPreview?.();

      this.showOverlay();
      modal.style.display = 'block';
    }
  };

  M.prototype.addCustomCategoryOption = function (category) {
    const name = category?.trim();
    if (!name) return null;
    const dropdown = document.querySelector<HTMLElement>('#edit-info-category-dropdown')!;
    const existing = Array.from(dropdown.querySelectorAll<HTMLElement>('.custom-select-option')).find(
      (o) => (o.dataset.value || '').toLowerCase() === name.toLowerCase(),
    );
    if (existing) return existing;

    const option = document.createElement('div');
    option.className = 'custom-select-option';
    option.dataset.value = name;
    option.dataset.custom = '1';
    option.innerHTML = '<i class="bi bi-tag-fill"></i><span></span>';
    option.querySelector('span')!.textContent = name;
    dropdown.insertBefore(option, dropdown.querySelector('[data-value="__custom__"]'));
    return option;
  };

  M.prototype.setEditInfoCategory = function (category) {
    const wrap = document.querySelector<HTMLElement>('#edit-info-category-select')!;
    const option =
      this.addCustomCategoryOption(category) ||
      document.querySelector<HTMLElement>('#edit-info-category-dropdown [data-value=""]')!;

    document
      .querySelectorAll('#edit-info-category-dropdown .custom-select-option')
      .forEach((o) => o.classList.toggle('active', o === option));
    wrap.querySelector<HTMLInputElement>('#edit-info-category')!.value = option.dataset.value || '';
    wrap.querySelector('.selected-value')!.textContent = option.querySelector('span')!.textContent;
  };

  M.prototype.bindEditInfoCategory = function (wrap) {
    if (wrap.dataset.bound) return;
    wrap.dataset.bound = '1';

    const dropdown = document.querySelector<HTMLElement>('#edit-info-category-dropdown')!;
    const close = () => {
      dropdown.classList.remove('floating-open');
      dropdown.removeAttribute('style');
      wrap.appendChild(dropdown);
      wrap.classList.remove('open');
    };
    const place = () => {
      const r = wrap.getBoundingClientRect();
      const below = window.innerHeight - r.bottom - 16;
      const flip = below < 180 && r.top > below;
      dropdown.style.left = `${r.left}px`;
      dropdown.style.width = `${r.width}px`;
      dropdown.style.right = 'auto';
      dropdown.style.maxHeight = `${Math.min(300, flip ? r.top - 16 : below)}px`;
      dropdown.style.top = flip ? 'auto' : `${r.bottom + 8}px`;
      dropdown.style.bottom = flip ? `${window.innerHeight - r.top + 8}px` : 'auto';
    };
    const open = () => {
      document.body.appendChild(dropdown);
      place();
      dropdown.classList.add('floating-open');
      wrap.classList.add('open');
    };
    this.closeEditInfoCategory = close;

    wrap.addEventListener('click', () => (wrap.classList.contains('open') ? close() : open()));
    dropdown.addEventListener('click', (e) => {
      const option = (e.target as HTMLElement).closest<HTMLElement>('.custom-select-option');
      if (!option) return;
      close();
      if (option.dataset.value === '__custom__') this.openCustomCategoryModal();
      else this.setEditInfoCategory(option.dataset.value);
    });
    document.addEventListener('click', (e) => {
      const target = e.target as Node;
      if (!wrap.contains(target) && !dropdown.contains(target)) close();
    });
    const follow = () => wrap.classList.contains('open') && place();
    wrap.closest('.modal-body')?.addEventListener('scroll', follow);
    window.addEventListener('resize', follow);
  };

  M.prototype.openCustomCategoryModal = function () {
    const t = (key) => window.i18n?.t(key) || key;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'custom-category-input';
    input.placeholder = t('modals.editInfo.customCategoryPlaceholder');

    this.showCustomModal({
      title: t('modals.editInfo.customCategoryTitle'),
      body: input,
      size: 'small',
      buttons: [
        { text: t('common.cancel'), type: 'secondary' },
        {
          text: t('common.ok'),
          type: 'primary',
          onClick: () => {
            if (!input.value.trim()) return false;
            this.setEditInfoCategory(input.value);
          },
        },
      ],
    });
    input.focus();
  };

  M.prototype.closeEditInfoModal = function () {
    this.closeModal('edit-info-modal');
    this.editInfoCallback = null;
  };

  M.prototype.confirmEditInfo = function () {
    const form = document.querySelector<HTMLFormElement>('#mod-info-form');
    if (!form) return;

    const formData = new FormData(form);
    const info = {};

    formData.forEach((value, key) => {
      if (typeof value === 'string' && value.trim()) {
        info[key] = value.trim();
      }
    });

    if (this.editInfoCallback) {
      this.editInfoCallback(info);
    }

    this.closeEditInfoModal();
  };

  M.prototype.openAdvancedInfoModal = function (modPath, currentTomlContent) {
    this.currentModPath = modPath;

    const modal = document.querySelector<HTMLElement>('#advanced-info-modal');
    const textarea = document.querySelector<HTMLTextAreaElement>('#advanced-info-textarea');

    if (modal && textarea) {
      modal.classList.remove('closing');
      textarea.value = currentTomlContent || '';

      this.showOverlay();
      modal.style.display = 'block';
    }
  };

  M.prototype.closeAdvancedInfoModal = function () {
    this.closeModal('advanced-info-modal');
    this.advancedInfoCallback = null;
    this.currentModPath = null;
  };

  M.prototype.refreshEditInfoPreview = async function () {
    const previewImage = document.querySelector<HTMLImageElement>('#edit-info-preview-image');
    const previewPlaceholder = document.querySelector<HTMLElement>('#edit-info-preview-placeholder');
    if (!previewImage || !previewPlaceholder || !this.currentModPath) return;

    const previewPath = await window.electronAPI.getPreviewImage(this.currentModPath);
    if (previewPath) {
      previewImage.src = previewPath;
      previewImage.style.display = 'block';
      previewPlaceholder.style.display = 'none';
    } else {
      previewImage.removeAttribute('src');
      previewImage.style.display = 'none';
      previewPlaceholder.style.display = 'flex';
    }
  };

  M.prototype.openEditInfoPreviewPicker = function () {
    const previewInput = document.querySelector<HTMLInputElement>('#edit-info-preview-input');
    previewInput?.click();
  };

  M.prototype.handleEditInfoPreviewSelected = async function (input) {
    const file = input?.files?.[0];
    if (!file || !this.currentModPath) return;

    const previewStatus = document.querySelector<HTMLElement>('#edit-info-preview-status');
    if (previewStatus) {
      previewStatus.textContent = 'Importing...';
    }

    try {
      const data = await this.preparePreviewWebpData(file);
      const result = await window.electronAPI.saveModPreview(this.currentModPath, data);

      if (result.success) {
        if (window.toastManager) {
          window.toastManager.success('toasts.previewSaved');
        }
        if (previewStatus) {
          previewStatus.textContent = 'preview.webp';
        }
        await this.refreshEditInfoPreview?.();

        if (this.currentModPath) {
          await window.modManager?.refreshSelectedModInfo(this.currentModPath);
        }
      } else {
        if (window.toastManager) {
          window.toastManager.error('toasts.failedToSavePreview', 3000, {
            error: result.error,
          });
        }
        if (previewStatus) {
          previewStatus.textContent = '';
        }
      }
    } catch (error) {
      console.error('Error importing preview:', error);
      if (window.toastManager) {
        window.toastManager.error('toasts.failedToSavePreview', 3000, {
          error: '',
        });
      }
      if (previewStatus) {
        previewStatus.textContent = '';
      }
    } finally {
      input.value = '';
    }
  };

  M.prototype.preparePreviewWebpData = async function (file) {
    if (file.type === 'image/webp' || file.name.toLowerCase().endsWith('.webp')) {
      return new Uint8Array(await file.arrayBuffer());
    }

    const bitmap = await createImageBitmap(file);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;

      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Canvas context unavailable');
      }

      context.drawImage(bitmap, 0, 0);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((convertedBlob) => {
          if (convertedBlob) {
            resolve(convertedBlob);
          } else {
            reject(new Error('Failed to convert image to WebP'));
          }
        }, 'image/webp', 0.92);
      });

      return new Uint8Array(await blob.arrayBuffer());
    } finally {
      bitmap.close();
    }
  };

  M.prototype.confirmAdvancedInfo = async function () {
    const textarea = document.querySelector<HTMLTextAreaElement>('#advanced-info-textarea');

    if (!textarea || !this.currentModPath) return;

    const tomlContent = textarea.value;

    try {
      const result = await window.electronAPI.saveModInfoRaw(this.currentModPath, tomlContent);

      if (result.success) {
        if (window.toastManager) {
          window.toastManager.success('toasts.infoTomlSaved');
        }
        const savedModPath = this.currentModPath;
        window.dispatchEvent(
          new CustomEvent('mod-info-updated', {
            detail: { modPath: savedModPath },
          }),
        );
        this.closeAdvancedInfoModal();

        if (savedModPath) {
          await window.modManager?.refreshSelectedModInfo(savedModPath);
        }
      } else {
        if (window.toastManager) {
          window.toastManager.error('toasts.failedToSaveInfoToml', 3000, {
            error: result.error,
          });
        }
      }
    } catch (error) {
      if (window.toastManager) {
        window.toastManager.error('toasts.failedToSaveInfoToml', 3000, {
          error: '',
        });
      }
    }
  };
})();
