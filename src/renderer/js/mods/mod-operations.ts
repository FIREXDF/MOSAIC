import { Mod, ModManager } from './mod-manager';

class ModOperations {
  modManager: ModManager;

  constructor(modManager: ModManager) {
    this.modManager = modManager;
  }

  getUniqueMods(mods: Mod[]) {
    return mods.filter(
      (mod, index, allMods) =>
        allMods.findIndex(
          (candidate) =>
            candidate.id === mod.id ||
            (candidate.path && candidate.path === mod.path),
        ) === index,
    );
  }

  async deleteMods(mods: Mod[]) {
    const failedMods: Array<{ mod: Mod; error: string }> = [];
    let successCount = 0;

    for (const mod of mods) {
      if (!mod.path) {
        failedMods.push({
          mod,
          error: 'Missing mod path',
        });
        continue;
      }

      if (!window.electronAPI?.deleteMod) {
        failedMods.push({
          mod,
          error: 'deleteMod API unavailable',
        });
        continue;
      }

      const result = await window.electronAPI.deleteMod(mod.path);

      if (result.success) {
        successCount++;
        this.modManager.removeModFromSelection(mod.id);
      } else {
        failedMods.push({
          mod,
          error: result.error || 'Unknown error',
        });
      }
    }

    return { successCount, failedMods };
  }

  async renameMod(mod: Mod) {
    if (!mod.path) {
      if (window.toastManager) {
        window.toastManager.error(
          'Cannot rename this mod - folder path not found',
        );
      }
      return;
    }

    if (window.modalManager) {
      window.modalManager.openRenameModal(mod, async (newName) => {
        if (window.electronAPI && window.electronAPI.renameMod) {
          const result = await window.electronAPI.renameMod(mod.path, newName);

          if (result.success) {
            if (window.toastManager) {
              window.toastManager.success('toasts.modRenamed', 3000, {
                name: newName,
              });
            }

            this.modManager.fetchMods();
          } else {
            if (window.toastManager) {
              window.toastManager.error(
                result.code === 'MOD_IN_USE'
                  ? 'toasts.modInUse'
                  : 'toasts.failedToRenameMod',
                4000,
                { error: result.error },
              );
            }
          }
        }
      });
    }
  }

  async toggleModStatus(mod: Mod) {
    if (!mod.path || !this.modManager.modsPath) {
      if (window.toastManager) {
        window.toastManager.error('toasts.cannotToggleModStatus');
      }
      return;
    }

    if (window.electronAPI && window.electronAPI.toggleMod) {
      const result = await window.electronAPI.toggleMod(
        mod.path,
        this.modManager.modsPath,
      );

      if (result.success) {
        if (window.toastManager) {
          window.toastManager.success(
            result.isNowActive ? 'toasts.modEnabled' : 'toasts.modDisabled',
          );
        }

        this.modManager.fetchMods();
      } else {
        if (window.toastManager) {
          window.toastManager.error(
            result.code === 'MOD_IN_USE'
              ? 'toasts.modInUse'
              : 'toasts.failedToToggleMod',
            4000,
            { error: result.error },
          );
        }
      }
    }
  }

  async toggleModsStatus(
    mods: Mod[],
    targetStatus?: 'active' | 'disabled',
  ) {
    const uniqueMods = this.getUniqueMods(mods).filter((mod) => !!mod.path);

    if (uniqueMods.length === 0 || !this.modManager.modsPath) {
      window.toastManager?.error('toasts.cannotToggleModStatus');
      return;
    }

    if (uniqueMods.length === 1) {
      await this.toggleModStatus(uniqueMods[0]);
      return;
    }

    const nextStatus =
      targetStatus ||
      (uniqueMods[0].status === 'disabled' ? 'active' : 'disabled');
    const modsToToggle = uniqueMods.filter((mod) => mod.status !== nextStatus);

    if (modsToToggle.length === 0) {
      window.toastManager?.success(
        nextStatus === 'active' ? 'toasts.modsEnabled' : 'toasts.modsDisabled',
        3000,
        {
          count: uniqueMods.length,
          plural: uniqueMods.length > 1 ? 's' : '',
        },
      );
      return;
    }

    const electronAPI = window.electronAPI;
    const modsPath = this.modManager.modsPath;

    if (!electronAPI?.toggleMod) {
      window.toastManager?.error('toasts.failedToToggleMods', 3000, {
        error: 'toggleMod API unavailable',
      });
      return;
    }

    const failedMods: Array<{ mod: Mod; error: string }> = [];
    let successCount = 0;
    let inUseCount = 0;
    const toggleConcurrency = Math.min(
      4,
      Math.max(2, Math.floor((navigator.hardwareConcurrency || 4) / 2)),
    );

    await this.runWithConcurrency(
      modsToToggle,
      toggleConcurrency,
      async (mod: Mod) => {
        const result = await electronAPI.toggleMod(mod.path!, modsPath);

        if (result.success) {
          successCount++;
        } else {
          if (result.code === 'MOD_IN_USE') {
            inUseCount++;
          }
          failedMods.push({
            mod,
            error: result.error || 'Unknown error',
          });
        }
      },
    );

    if (successCount > 0 && failedMods.length === 0) {
      window.toastManager?.success(
        nextStatus === 'active' ? 'toasts.modsEnabled' : 'toasts.modsDisabled',
        3000,
        {
          count: uniqueMods.length,
          plural: uniqueMods.length > 1 ? 's' : '',
        },
      );
    } else if (successCount > 0) {
      window.toastManager?.warning('toasts.modsToggledPartial', 4000, {
        success: successCount,
        error: failedMods.length,
      });
    } else if (failedMods.length > 0) {
      const allInUse = inUseCount > 0 && inUseCount === failedMods.length;
      window.toastManager?.error(
        allInUse ? 'toasts.modsInUse' : 'toasts.failedToToggleMods',
        4000,
        {
          error: failedMods[0].error,
        },
      );
    }

    if (successCount > 0) {
      await this.modManager.fetchMods();
    }
  }

  async runWithConcurrency<T>(
    items: T[],
    concurrency: number,
    worker: (item: T, index: number) => Promise<void>,
  ) {
    let nextIndex = 0;
    const workerCount = Math.min(concurrency, items.length);

    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        while (nextIndex < items.length) {
          const currentIndex = nextIndex;
          nextIndex += 1;
          await worker(items[currentIndex], currentIndex);
        }
      }),
    );
  }

  async openModFolder(mod: Mod) {
    if (!mod.path) {
      if (window.toastManager) {
        window.toastManager.error('toasts.cannotOpenFolder');
      }
      return;
    }

    if (window.electronAPI && window.electronAPI.openFolder) {
      const result = await window.electronAPI.openFolder(mod.path);

      if (!result.success) {
        if (window.toastManager) {
          window.toastManager.error('toasts.failedToOpenFolder', 3000, {
            error: result.error,
          });
        }
      }
    }
  }

  async uninstallMod(mod: Mod) {
    if (!mod.path) {
      if (window.toastManager) {
        window.toastManager.error('toasts.cannotUninstallMod');
      }
      return;
    }

    if (window.modalManager) {
      window.modalManager.openUninstallModal(mod, async () => {
        const { successCount, failedMods } = await this.deleteMods([mod]);

        if (successCount > 0) {
          if (window.toastManager) {
            window.toastManager.success('toasts.modUninstalled');
          }

          await this.modManager.fetchMods();
          return;
        }

        if (window.toastManager && failedMods.length > 0) {
          window.toastManager.error('toasts.failedToUninstallMod', 3000, {
            error: failedMods[0].error,
          });
        }
      });
    }
  }

  async uninstallMods(mods: Mod[]) {
    const uniqueMods = this.getUniqueMods(mods).filter((mod) => !!mod.path);

    if (uniqueMods.length === 0) {
      window.toastManager?.error('toasts.cannotUninstallMod');
      return;
    }

    if (uniqueMods.length === 1) {
      await this.uninstallMod(uniqueMods[0]);
      return;
    }

    if (!window.modalManager) {
      return;
    }

    window.modalManager.openUninstallModal(uniqueMods, async () => {
      const { successCount, failedMods } = await this.deleteMods(uniqueMods);

      if (successCount > 0 && failedMods.length === 0) {
        window.toastManager?.success('toasts.modsUninstalled', 3000, {
          count: successCount,
          plural: successCount > 1 ? 's' : '',
        });
      } else if (successCount > 0) {
        window.toastManager?.warning('toasts.modsUninstalledPartial', 4000, {
          success: successCount,
          error: failedMods.length,
        });
      } else if (failedMods.length > 0) {
        window.toastManager?.error('toasts.failedToUninstallMods', 4000, {
          error: failedMods[0].error,
        });
      }

      if (successCount > 0) {
        await this.modManager.fetchMods();
      }
    });
  }

  async restoreSlotBackup(mod: Mod) {
    if (!mod.path || !window.modalManager) return;

    const t = (key: string, fallback: string) => {
      const value = window.i18n?.t?.(key);
      return value && value !== key ? value : fallback;
    };

    window.modalManager.showCustomModal({
      id: 'restore-slot-backup-modal',
      title: t('modals.restoreSlotBackup.title', 'Restore backup'),
      body: t(
        'modals.restoreSlotBackup.message',
        'Restore this mod as it was before the last slot change? Changes made since then will be lost.',
      ),
      size: 'normal',
      buttons: [
        { text: t('common.cancel', 'Cancel'), type: 'secondary' },
        {
          text: t('modals.restoreSlotBackup.confirm', 'Restore'),
          type: 'primary',
          onClick: () => {
            void (async () => {
              const result = await window.electronAPI.restoreSlotBackup(
                mod.path,
              );

              if (result.success) {
                window.toastManager?.success('toasts.slotBackupRestored');
                await this.modManager.fetchMods([mod.path]);
              } else {
                window.toastManager?.error(
                  'toasts.failedToRestoreSlotBackup',
                  3000,
                  { error: result.error },
                );
              }
            })();
          },
        },
      ],
    });
  }

  async editSlotCounts(mod: Mod) {
    if (!mod.path || !window.modalManager) return;

    const t = (key: string, params?: Record<string, string>) =>
      window.i18n?.t?.(key, params) || key;

    const result = await window.electronAPI.getModSlotCounts(mod.path);
    if (!result.success) {
      window.toastManager?.error('toasts.slotCountFixFailed', 4000, {
        mods: result.error,
      });
      return;
    }
    if (result.slotCounts.length === 0) {
      window.toastManager?.info('toasts.noFighterSlots');
      return;
    }

    const body = document.createElement('div');

    const summary = document.createElement('p');
    summary.style.cssText =
      'margin: 0 0 14px; color: var(--text-secondary); line-height: 1.6;';
    summary.textContent = t('modals.editSlotCounts.message');
    body.appendChild(summary);

    const list = document.createElement('div');
    list.style.cssText =
      'display: flex; flex-direction: column; gap: 12px; max-height: 320px; overflow: auto;';

    const inputs = result.slotCounts.map((entry) => {
      const fighterId = window.resolveFolderName
        ? window.resolveFolderName(entry.fighter)
        : entry.fighter;

      const field = document.createElement('label');
      field.className = 'character-css-field';

      const name = document.createElement('span');
      name.textContent =
        window.SSBU_CHARACTERS?.[fighterId]?.name || entry.fighter;

      const input = document.createElement('input');
      input.type = 'number';
      input.min = '1';
      input.max = '255';
      input.step = '1';
      input.value = String(entry.colorNum);

      field.append(name, input);

      if (entry.highestSlot >= 0) {
        const hint = document.createElement('small');
        hint.style.cssText = 'color: var(--text-muted); font-size: 12px;';
        hint.textContent = t('modals.editSlotCounts.highestSlot', {
          slot: `c${String(entry.highestSlot).padStart(2, '0')}`,
          count: String(entry.highestSlot + 1),
        });
        field.appendChild(hint);
      }

      list.appendChild(field);
      return { entry, input };
    });

    body.appendChild(list);

    window.modalManager.showCustomModal({
      id: 'edit-slot-counts-modal',
      title: t('modals.editSlotCounts.title'),
      body,
      size: 'normal',
      buttons: [
        { text: t('common.cancel'), type: 'secondary' },
        {
          text: t('common.save'),
          type: 'primary',
          onClick: () => {
            const values = inputs.map(({ entry, input }) => ({
              entry,
              colorNum: Number(input.value),
            }));
            if (
              values.some(
                ({ colorNum }) =>
                  !Number.isInteger(colorNum) ||
                  colorNum < 1 ||
                  colorNum > 255,
              )
            ) {
              window.toastManager?.error('toasts.invalidSlotCount');
              return false;
            }

            const entries = values
              .filter(
                ({ entry, colorNum }) =>
                  colorNum !== entry.colorNum ||
                  (!entry.inPrcxml && colorNum > 8),
              )
              .map(({ entry, colorNum }) => ({ index: entry.index, colorNum }));
            if (entries.length === 0) return;

            void (async () => {
              const saved = await window.electronAPI.setModSlotCounts(
                mod.path,
                entries,
              );
              if (saved.success && saved.written) {
                window.toastManager?.success('toasts.slotCountSaved');
                await this.modManager.fetchMods([mod.path]);
              } else {
                window.toastManager?.error('toasts.slotCountFixFailed', 4000, {
                  mods: saved.success ? mod.name : saved.error,
                });
              }
            })();
          },
        },
      ],
    });
  }

  async startAssignSoundFlow(mod: Mod) {
    const modsPath = this.modManager.modsPath;
    if (!mod.path || !modsPath || !window.modalManager) return;

    const t = (key: string, fallback: string) => {
      const value = window.i18n?.t?.(key);
      return value && value !== key ? value : fallback;
    };

    const result = await window.electronAPI.getSoundAssignTargets(
      mod.path,
      modsPath,
    );

    if (!result.success) {
      window.toastManager?.error('toasts.failedToAssignSound', 4000, {
        error: result.error,
      });
      return;
    }

    if (result.targets.length === 0) {
      window.toastManager?.error('toasts.noModelForSound', 4000, {
        fighter: result.fighter,
      });
      return;
    }

    const body = document.createElement('div');
    const message = document.createElement('p');
    message.textContent = t(
      'modals.assignSound.message',
      'The sounds will be copied into the chosen model mod and renamed for its slot. This sound mod will then be disabled.',
    );
    body.appendChild(message);

    const choices = document.createElement('fieldset');
    choices.className = 'plugin-version-choices';
    const legend = document.createElement('legend');
    legend.className = 'plugin-version-legend';
    legend.textContent = t('modals.assignSound.choose', 'Choose a model');
    choices.appendChild(legend);

    result.targets.forEach((target, targetIndex) => {
      target.slots.forEach((slot, slotIndex) => {
        const option = document.createElement('label');
        option.className = 'plugin-version-option';
        const title = document.createElement('span');
        title.className = 'plugin-version-option-title';
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = 'assign-sound-target';
        input.value = `${targetIndex}:${slot}`;
        input.checked = targetIndex === 0 && slotIndex === 0;
        title.append(input, ` ${target.name}`);
        const badge = document.createElement('span');
        badge.className = 'plugin-version-badge';
        badge.textContent = slot;
        title.appendChild(badge);
        option.appendChild(title);
        choices.appendChild(option);
      });
    });
    body.appendChild(choices);

    const hint = document.createElement('p');
    hint.className = 'modal-hint';
    hint.textContent = t(
      'modals.assignSound.backupHint',
      'Existing sounds in that model mod are replaced. You can undo it with "Restore backup" on the model mod.',
    );
    body.appendChild(hint);

    window.modalManager.showCustomModal({
      id: 'assign-sound-modal',
      title: t('modals.assignSound.title', 'Assign to a model'),
      body,
      size: 'normal',
      buttons: [
        { text: t('common.cancel', 'Cancel'), type: 'secondary' },
        {
          text: t('modals.assignSound.confirm', 'Assign'),
          type: 'primary',
          onClick: async (_event, modal) => {
            const selected = modal.querySelector<HTMLInputElement>(
              'input[name="assign-sound-target"]:checked',
            );
            if (!selected) return false;

            const [targetIndex, slot] = selected.value.split(':');
            const target = result.targets[Number(targetIndex)];
            const assignResult = await window.electronAPI.assignSoundToModel(
              mod.path,
              target.path,
              slot,
            );

            if (!assignResult.success) {
              window.toastManager?.error('toasts.failedToAssignSound', 4000, {
                error: assignResult.error,
              });
              return false;
            }

            if (mod.status !== 'disabled') {
              const toggleResult = await window.electronAPI.toggleMod(
                mod.path,
                modsPath,
              );
              if (!toggleResult.success) {
                window.toastManager?.warning(
                  'toasts.soundAssignedNotDisabled',
                  4000,
                  { error: toggleResult.error },
                );
                await this.modManager.fetchMods();
                return;
              }
            }

            window.toastManager?.success('toasts.soundAssigned', 3000, {
              name: target.name,
              slot,
            });
            await this.modManager.fetchMods();
          },
        },
      ],
    });
  }

  async startChangeSlotsFlow(mod: Mod) {
    if (!mod.path) {
      if (window.toastManager) {
        window.toastManager.error('toasts.cannotChangeSlot');
      }

      return;
    }

    if (window.electronAPI && window.electronAPI.scanMod) {
      const scanResult = await window.electronAPI.scanMod(mod.path);

      if (scanResult.success) {
        if (scanResult.data.fighterNames.length === 0) {
          if (window.toastManager) {
            window.toastManager.error('toasts.noSlotsFound');
          }
          return;
        }

        if (window.modalManager) {
          window.modalManager.openChangeSlotModal(
            mod,
            scanResult.data,
            async (slotAssignments, deletedSlots, options) => {
              if (window.electronAPI && window.electronAPI.changeSlots) {
                const changeSlotsResult = await window.electronAPI.changeSlots(
                  mod.path,
                  scanResult.data.pathData,
                  slotAssignments,
                  deletedSlots,
                  options,
                );

                if (changeSlotsResult.success) {
                  if (window.toastManager) {
                    window.toastManager.success('toasts.slotChanged');
                  }

                  await this.modManager.fetchMods([mod.path]);
                } else {
                  window.toastManager.error('toasts.failedToChangeSlot', 3000, {
                    error: changeSlotsResult.error,
                  });
                }
              }
            },
          );
        }
      } else {
        if (window.toastManager) {
          window.toastManager.error('toasts.failedToChangeSlot', 3000, {
            error: scanResult.error || 'Unknown error',
          });
        }
      }
    }
  }
}

if (typeof window !== 'undefined') {
  window.ModOperations = ModOperations;
}

export { type ModOperations };
