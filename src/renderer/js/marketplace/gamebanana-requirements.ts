class GameBananaRequirementsSection {
  manager: SocialGameBananaManager;

  constructor(manager: SocialGameBananaManager) {
    this.manager = manager;
  }

  normalizeDependencyName(value: string) {
    return String(value || '')
      .toLowerCase()
      .replace(/\.nro$/i, '')
      .replace(/^lib/, '')
      .replace(/[^a-z0-9]/g, '');
  }

  getDependencyAliases(requirementName: string) {
    const normalized = this.normalizeDependencyName(requirementName);
    const aliases: Record<string, string[]> = {
      arcropolis: ['arcropolis', 'arcroplois', 'libarcropolis'],
      nrohook: ['nrohook', 'nrohookplugin', 'libnrohook'],
      smashline2: [
        'smashline2',
        'smashline',
        'smashlineplugin',
        'smashlinehook',
        'libsmashlinehook',
        'libsmashlineplugin',
      ],
      paramconfig: ['paramconfig', 'libparamconfig'],
      onesloteffects: ['onesloteffects', 'oneeffect', 'slotfx'],
      cskcollection: ['cskcollection', 'thecskcollection', 'csk'],
      skyline: ['skyline', 'libskyline'],
    };

    return new Set([normalized, ...(aliases[normalized] || [])]);
  }

  isSkylineRequirement(requirementName: string) {
    return this.getDependencyAliases(requirementName).has('skyline');
  }

  normalizeLocalPath(value: string) {
    return String(value || '')
      .replace(/\\/g, '/')
      .replace(/\/+$/, '');
  }

  getSkylineRomfsDirsFromSettings() {
    const candidates = new Set<string>();
    const pluginsPath = this.normalizeLocalPath(
      window.settingsManager?.getPluginsPath?.() ||
        window.pluginManager?.pluginsPath ||
        '',
    );
    const modsPath = this.normalizeLocalPath(
      window.settingsManager?.getModsPath?.() || '',
    );

    const addFromConfiguredPath = (configuredPath: string) => {
      if (!configuredPath) return;

      const contentMatch = configuredPath.match(
        /^(.*?)(?:\/ultimate\/contents|\/atmosphere\/contents)\/01006A800016E000(?:\/|$)/i,
      );
      if (contentMatch?.[1]) {
        candidates.add(
          `${contentMatch[1]}/atmosphere/contents/01006A800016E000/romfs/skyline`,
        );
      }

      const pluginsMatch = configuredPath.match(
        /^(.*\/(?:atmosphere|ultimate)\/contents\/01006A800016E000)\/romfs\/skyline\/plugins(?:\/|$)/i,
      );
      if (pluginsMatch?.[1]) {
        const contentDir = pluginsMatch[1].replace(
          /\/ultimate\/contents\/01006A800016E000$/i,
          '/atmosphere/contents/01006A800016E000',
        );
        candidates.add(`${contentDir}/romfs/skyline`);
      }

      const skylineRomfsMatch = configuredPath.match(
        /^(.*\/(?:atmosphere|ultimate)\/contents\/01006A800016E000\/romfs\/skyline)(?:\/|$)/i,
      );
      if (skylineRomfsMatch?.[1]) {
        candidates.add(
          skylineRomfsMatch[1].replace(
            /\/ultimate\/contents\/01006A800016E000\/romfs\/skyline$/i,
            '/atmosphere/contents/01006A800016E000/romfs/skyline',
          ),
        );
      }
    };

    addFromConfiguredPath(pluginsPath);
    addFromConfiguredPath(modsPath);
    (window.pluginManager?.plugins || []).forEach((plugin) => {
      addFromConfiguredPath(this.normalizeLocalPath(plugin.filePath || ''));
    });

    const modsMatch = modsPath.match(/^(.*)\/ultimate\/mods(?:\/|$)/i);
    if (modsMatch?.[1]) {
      candidates.add(
        `${modsMatch[1]}/atmosphere/contents/01006A800016E000/romfs/skyline`,
      );
    }

    return Array.from(candidates);
  }

  async refreshSkylineDependencyStatus() {
    if (!window.electronAPI?.folderExists) {
      this.manager.skylineInstalledCache = false;
      return false;
    }

    const skylineDirs = this.getSkylineRomfsDirsFromSettings();
    for (const skylineDir of skylineDirs) {
      try {
        const result = await window.electronAPI.folderExists(skylineDir);
        if (result?.success && result.exists) {
          this.manager.skylineInstalledCache = true;
          return true;
        }
      } catch (error) {
        console.warn('[Social] Failed to check Skyline installation:', error);
      }
    }

    this.manager.skylineInstalledCache = false;
    return false;
  }

  getGameBananaRequirements(
    mod: GameBananaTopSubmission & { _aRequirements?: any },
  ) {
    const requirements = mod._aRequirements;
    if (!Array.isArray(requirements)) return [];

    return requirements
      .map((requirement) => {
        const name = Array.isArray(requirement)
          ? requirement[0]
          : requirement?._sName || requirement?.name || requirement?.title;
        const url = Array.isArray(requirement)
          ? requirement[1]
          : requirement?._sUrl || requirement?.url || requirement?._sProfileUrl;

        if (!name) return null;
        return {
          name: String(name),
          url: String(url || ''),
        };
      })
      .filter(Boolean) as { name: string; url: string }[];
  }

  findInstalledDependency(requirementName: string) {
    if (
      this.isSkylineRequirement(requirementName) &&
      this.manager.skylineInstalledCache
    ) {
      return {
        id: 'skyline',
        name: 'Skyline',
        size: '',
        status: 'active',
        filePath: '',
      };
    }

    const aliases = this.getDependencyAliases(requirementName);
    const plugins = window.pluginManager?.plugins || [];

    return plugins.find((plugin) => {
      const candidates = [
        plugin.name,
        plugin.id,
        plugin.filePath?.split(/[\\/]/).pop() || '',
      ].map((value) => this.normalizeDependencyName(value));

      return candidates.some(
        (candidate) =>
          aliases.has(candidate) ||
          Array.from(aliases).some(
            (alias) => candidate.includes(alias) || alias.includes(candidate),
          ),
      );
    });
  }

  findMarketplaceDependency(requirementName: string, url = '') {
    const marketplacePlugins = window.pluginMarketplace?.getPlugins?.() || [];
    const aliases = this.getDependencyAliases(requirementName);
    const normalizedUrl = this.normalizeDependencyName(url);

    return marketplacePlugins.find((plugin) => {
      const candidates = [
        plugin.name,
        plugin.repo,
        plugin.repo?.split('/').pop() || '',
        plugin.description,
        plugin.url,
      ].map((value) => this.normalizeDependencyName(value));

      return (
        candidates.some((candidate) => aliases.has(candidate)) ||
        (!!normalizedUrl &&
          candidates.some(
            (candidate) => candidate && normalizedUrl.includes(candidate),
          ))
      );
    });
  }

  renderGameBananaRequirements(
    mod: GameBananaTopSubmission & { _aRequirements?: any },
  ) {
    const requirements = this.getGameBananaRequirements(mod);
    if (!requirements.length) return '';

    return `
      <div class="social-gamebanana-requirements">
        <h4 class="social-gamebanana-requirements-title">Requirements</h4>
        <div class="social-gamebanana-requirements-list">
          ${requirements
            .map((requirement) =>
              this.renderGameBananaRequirementItem(requirement),
            )
            .join('')}
        </div>
      </div>
    `;
  }

  renderGameBananaRequirementItem(requirement: { name: string; url: string }) {
    const installedPlugin = this.findInstalledDependency(requirement.name);
    const marketplacePlugin = this.findMarketplaceDependency(
      requirement.name,
      requirement.url,
    );
    const name = escapeHtml(requirement.name);
    const url = escapeHtml(requirement.url);
    const searchQuery = escapeHtml(
      `${requirement.name} Super Smash Bros Ultimate GameBanana`,
    );
    const statusClass = installedPlugin
      ? 'is-installed'
      : marketplacePlugin
        ? 'is-installable'
        : 'is-external';
    const statusText = installedPlugin
      ? installedPlugin.status === 'disabled'
        ? 'Installed disabled'
        : 'Installed'
      : marketplacePlugin
        ? 'Not installed'
        : 'Manual search';
    const installButton =
      !installedPlugin && marketplacePlugin
        ? `<button class="social-gamebanana-requirement-install" data-plugin-name="${escapeHtml(marketplacePlugin.name)}" data-plugin-repo="${escapeHtml(marketplacePlugin.repo)}">
            <i class="bi bi-download"></i>
            <span>Install</span>
          </button>`
        : '';
    const openButton = url
      ? `<button class="social-gamebanana-requirement-link" data-url="${url}">
          <i class="bi bi-box-arrow-up-right"></i>
          <span>Open</span>
        </button>`
      : '';

    return `
      <div class="social-gamebanana-requirement ${statusClass}">
        <div class="social-gamebanana-requirement-main">
          <strong>${name}</strong>
          <span>${statusText}</span>
        </div>
        <div class="social-gamebanana-requirement-actions">
          ${installButton}
          ${openButton}
          ${
            !marketplacePlugin
              ? `<button class="social-gamebanana-requirement-search" data-query="${searchQuery}" data-provider="gamebanana">
                  <i class="bi bi-search"></i>
                  <span>GameBanana</span>
                </button>
                <button class="social-gamebanana-requirement-search" data-query="${searchQuery}" data-provider="google">
                  <i class="bi bi-google"></i>
                  <span>Google</span>
                </button>`
              : ''
          }
        </div>
      </div>
    `;
  }

  async installGameBananaRequirement(pluginName: string, repo: string) {
    if (!window.pluginMarketplace) return;

    const downloadInfo =
      await window.pluginMarketplace.getLatestReleaseDownloadUrl(repo);
    if (!downloadInfo) {
      window.toastManager?.error(
        `No downloadable release found for ${pluginName}`,
      );
      return;
    }

    await window.pluginMarketplace.downloadAndInstallPlugin(
      pluginName,
      repo,
      downloadInfo,
    );
  }

  getGameBananaRequirementSearchUrl(query: string, provider: string) {
    const encodedQuery = encodeURIComponent(query);
    if (provider === 'gamebanana') {
      return `https://gamebanana.com/search?_sSearchString=${encodedQuery}`;
    }

    return `https://www.google.com/search?q=${encodedQuery}`;
  }

  getCurrentGameBananaMergedDetail() {
    if (!this.manager.gameBananaCurrentDetail) return [];

    return {
      ...this.manager.gameBananaCurrentDetail.fallback,
      ...this.manager.gameBananaCurrentDetail.details,
    } as GameBananaTopSubmission & { _aRequirements?: any };
  }

  getReadmeMentionText(downloadUrl = '') {
    const merged = this.getCurrentGameBananaMergedDetail();
    if (Array.isArray(merged)) return '';

    const downloadId = this.manager.detail.getDownloadIdFromGameBananaUrl(downloadUrl);
    const selectedFile = downloadId
      ? this.manager.detail.getGameBananaFileByDownloadId(downloadId)
      : null;

    return [
      this.manager.getGameBananaSubmissionDescription(merged),
      selectedFile?._sDescription || '',
      selectedFile?._sFile || '',
    ].join('\n');
  }

  shouldScanGameBananaReadme(downloadUrl = '') {
    const mentionText = this.getReadmeMentionText(downloadUrl);
    return /read[\s_-]*me|lisez[\s_-]*moi|dependencies listed|requirements listed/i.test(
      mentionText,
    );
  }

  getReadmeDependencyCatalog() {
    const catalog = [
      {
        name: 'Skyline',
        aliases: ['skyline'],
      },
      {
        name: 'ARCropolis',
        aliases: ['arcropolis', 'arcroplois'],
      },
      {
        name: 'NRO Hook',
        aliases: ['nro hook', 'nrohook', 'libnro_hook'],
      },
      {
        name: 'Smashline 2',
        aliases: ['smashline 2', 'smashline2', 'smashline'],
      },
      {
        name: 'Param Config',
        aliases: ['param config', 'paramconfig'],
      },
      {
        name: 'One Slot Effects',
        aliases: ['one slot effects', 'onesloteffects'],
      },
      {
        name: 'The CSK Collection',
        aliases: ['the csk collection', 'csk collection', 'cskcollection'],
      },
    ];

    const marketplacePlugins = window.pluginMarketplace?.getPlugins?.() || [];
    marketplacePlugins.forEach((plugin) => {
      if (!plugin?.name) return;
      catalog.push({
        name: plugin.name,
        aliases: [plugin.name, plugin.repo?.split('/').pop() || ''],
      });
    });

    return catalog;
  }

  formatReadmeDependencyLine(line: string) {
    return line
      .replace(/^\s*[-*+•]\s*/, '')
      .replace(/^\s*\d+[.)]\s*/, '')
      .replace(/^\s*\[[ x-]\]\s*/i, '')
      .replace(/\[[^\]]+\]\(([^)]+)\)/g, '')
      .replace(/\s+-\s+https?:\/\/\S+.*$/i, '')
      .replace(/\s*[:=-]\s*https?:\/\/\S+.*$/i, '')
      .replace(/https?:\/\/\S+/gi, '')
      .replace(/\s+-\s*$/, '')
      .replace(
        /\b(?:plugin|dependency|dependencies|required|requirement)\b/gi,
        '',
      )
      .replace(/\s*\([^)]*(?:optional|already included)[^)]*\)\s*$/i, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  getReadmeDependencyUrl(line: string) {
    return line.match(/https?:\/\/\S+/i)?.[0]?.replace(/[),.;]+$/, '') || '';
  }

  canonicalizeReadmeDependencyName(name: string) {
    const normalizedName = this.normalizeDependencyName(name);
    if (!normalizedName) return '';

    const catalogMatch = this.getReadmeDependencyCatalog().find((entry) => {
      return entry.aliases.some((alias) => {
        const normalizedAlias = this.normalizeDependencyName(alias);
        return (
          normalizedAlias.length >= 3 &&
          (normalizedName === normalizedAlias ||
            normalizedName.includes(normalizedAlias) ||
            normalizedAlias.includes(normalizedName))
        );
      });
    });

    return catalogMatch?.name || name;
  }

  getReadmeDependencyFromLine(line: string) {
    const cleanedName = this.formatReadmeDependencyLine(line);
    if (!cleanedName) return null;

    const canonicalName = this.canonicalizeReadmeDependencyName(cleanedName);
    if (!canonicalName) return null;

    return {
      name: canonicalName,
      url: this.getReadmeDependencyUrl(line),
    };
  }

  getKnownReadmeDependencyFromLine(line: string) {
    const normalizedLine = this.normalizeDependencyName(line);
    const catalogMatch = this.getReadmeDependencyCatalog().find((entry) => {
      return entry.aliases.some((alias) => {
        const normalizedAlias = this.normalizeDependencyName(alias);
        return (
          normalizedAlias.length >= 3 &&
          normalizedLine.includes(normalizedAlias)
        );
      });
    });

    if (!catalogMatch) return null;

    return {
      name: catalogMatch.name,
      url: this.getReadmeDependencyUrl(line),
    };
  }

  getKnownReadmeDependenciesFromText(text: string) {
    const normalizedText = this.normalizeDependencyName(text);
    const mentionsDependencySection =
      /dependenc|requirement|prerequisite|required plugin/i.test(text) ||
      /dependenc|requirement|prerequisite|requiredplugin/i.test(normalizedText);

    if (!mentionsDependencySection) return [];

    return this.getReadmeDependencyCatalog()
      .filter((entry) => {
        return entry.aliases.some((alias) => {
          const normalizedAlias = this.normalizeDependencyName(alias);
          return (
            normalizedAlias.length >= 3 &&
            normalizedText.includes(normalizedAlias)
          );
        });
      })
      .map((entry) => ({ name: entry.name, url: '' }));
  }

  extractReadmeDependencyRequirements(
    readmes: { path: string; content: string }[] = [],
  ) {
    const byName = new Map<string, { name: string; url: string }>();
    const text = readmes.map((readme) => readme.content || '').join('\n');
    const lines = text.replace(/\r\n?/g, '\n').split('\n');
    let inDependencyBlock = false;
    let capturedFromBlock = 0;

    const addRequirement = (requirement: { name: string; url: string }) => {
      const normalized = this.normalizeDependencyName(requirement.name);
      if (!normalized) return;

      const existing = byName.get(normalized);
      byName.set(normalized, {
        ...requirement,
        url: existing?.url || requirement.url,
      });
    };

    this.getKnownReadmeDependenciesFromText(text).forEach(addRequirement);

    lines.forEach((rawLine) => {
      const line = rawLine.trim();
      const headingMatch =
        /^(?:#+\s*)?(?:dependencies|requirements|prerequisites|required plugins|needed plugins)\s*:?\s*(.*)$/i.exec(
          line,
        );

      if (headingMatch) {
        inDependencyBlock = true;
        capturedFromBlock = 0;
        const inlineText = headingMatch[1] || '';
        const inlineRequirement =
          this.getReadmeDependencyFromLine(inlineText) ||
          this.getKnownReadmeDependencyFromLine(inlineText);
        if (inlineRequirement) {
          addRequirement(inlineRequirement);
          capturedFromBlock += 1;
        }
        return;
      }

      if (!inDependencyBlock && /^https?:\/\//i.test(line)) return;
      if (!inDependencyBlock && this.getReadmeDependencyUrl(line)) {
        const knownRequirement = this.getKnownReadmeDependencyFromLine(line);
        if (knownRequirement) addRequirement(knownRequirement);
        return;
      }

      if (!inDependencyBlock) return;
      if (!line) {
        if (capturedFromBlock > 0) inDependencyBlock = false;
        return;
      }

      if (
        /^(the new|if you|duplicate|character id|name id|series id|amount of colors|color start index|join|https?:\/\/|credits?|thanks|support)\b/i.test(
          line,
        )
      ) {
        inDependencyBlock = false;
        return;
      }

      if (capturedFromBlock >= 20) {
        inDependencyBlock = false;
        return;
      }

      const requirement =
        this.getReadmeDependencyFromLine(line) ||
        this.getKnownReadmeDependencyFromLine(line);
      if (!requirement) return;

      addRequirement(requirement);
      capturedFromBlock += 1;
    });

    return Array.from(byName.values());
  }

  async getGameBananaReadmeRequirements(downloadUrl = '') {
    if (!downloadUrl || !window.electronAPI?.scanGameBananaReadme) {
      return [];
    }

    try {
      const result = await window.electronAPI.scanGameBananaReadme(downloadUrl);
      if (!result?.success || !Array.isArray(result.readmes)) {
        console.warn('[Social] README scan failed:', result);
        return [];
      }

      const requirements = this.extractReadmeDependencyRequirements(
        result.readmes,
      );

      return requirements;
    } catch (error) {
      console.warn('[Social] Failed to scan GameBanana README:', error);
      return [];
    }
  }

  getMissingGameBananaRequirements(
    extraRequirements: { name: string; url: string }[] = [],
  ) {
    const merged = this.getCurrentGameBananaMergedDetail();
    if (Array.isArray(merged)) return [];

    const requirementsByName = new Map<string, { name: string; url: string }>();
    [...this.getGameBananaRequirements(merged), ...extraRequirements].forEach(
      (requirement) => {
        const normalized = this.normalizeDependencyName(requirement.name);
        if (!normalized) return;
        if (!requirementsByName.has(normalized)) {
          requirementsByName.set(normalized, requirement);
        }
      },
    );

    return Array.from(requirementsByName.values())
      .map((requirement) => {
        const installedPlugin = this.findInstalledDependency(requirement.name);
        const marketplacePlugin = this.findMarketplaceDependency(
          requirement.name,
          requirement.url,
        );
        const isDisabled = installedPlugin?.status === 'disabled';
        const isMissing = !installedPlugin || isDisabled;

        if (!isMissing) return null;

        return {
          ...requirement,
          reason: isDisabled ? 'Installed but disabled' : 'Missing',
          marketplacePlugin,
        };
      })
      .filter(Boolean) as {
      name: string;
      url: string;
      reason: string;
      marketplacePlugin?: any;
    }[];
  }
}
