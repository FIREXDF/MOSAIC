class SocialManagerBase {
  [key: string]: any;
  GAMEBANANA_TOP_SUBS_URL: string;
  GAMEBANANA_SUBFEED_URL: string;
  GAMEBANANA_API_URL: string;
  gameBananaFeaturedMods: GameBananaTopSubmission[];
  gameBananaFeaturedSourceMods: GameBananaTopSubmission[];
  gameBananaFeaturedIndex: number;
  gameBananaFeaturedTimeline: any;
  gameBananaPreviewAnimation: Promise<void> | null;
  gameBananaModsPage: number;
  gameBananaModsTotalPages: number;
  gameBananaDiscoverSort: GameBananaDiscoverSort;
  gameBananaCurrentSubfeedData: GameBananaSubfeedResponse | null;
  gameBananaCategoryFilter: string;
  gameBananaSkinSubcategoryOpen: boolean;
  gameBananaSkinSubcategoryId: number | null;
  gameBananaSkinSubcategories: any[] | null;
  gameBananaSearchQuery: string;
  gameBananaSearchDebounce: ReturnType<typeof setTimeout> | null;
  gameBananaModsRequestId: number;
  gameBananaDetailRequestId = 0;
  gameBananaUmcState: {
    key: string;
    modId: number;
    status: 'loading' | 'ready' | 'error';
    movesets: import('../../../main/ipc/handlers/umc-handlers').UmcGameBananaMoveset[];
  } | null = null;
  gameBananaSearchListenerBound: boolean;
  gameBananaSubmissionCache: Map<string, GameBananaTopSubmission>;
  gameBananaDownloadCountCache: Map<string, number | null>;
  gameBananaDownloadCountRequests: Map<string, Promise<number | null>>;
  gameBananaLastDetailSource: {
    modelName: string;
    submissionId: string;
    sourceKind: 'featured' | 'grid';
    page: number;
    scrollTop: number;
  } | null;
  gameBananaDetailReturnInProgress: boolean;
  gameBananaDiscoverSnapshot: {
    html: string;
    page: number;
    scrollTop: number;
  } | null;
  gameBananaCurrentDetail: {
    details: any;
    fallback: GameBananaTopSubmission | null;
    files: GameBananaFileEntry[];
  } | null;
  skylineInstalledCache: boolean | null;
  cache: {
    [key: string]: { data: any; timestamp: number; ttl: number };
  };
  pendingRequests: Map<string, Promise<any>>;

  constructor() {
    this.GAMEBANANA_TOP_SUBS_URL =
      // GameBanana can prepend a PHP warning to responses that request
      // _aPreviewMedia, making the otherwise valid JSON impossible to parse.
      // The submission image fields are sufficient for Discover cards.
      'https://gamebanana.com/apiv11/Game/6498/TopSubs?_csvProperties=_idRow,_sModelName,_sSingularTitle,_sName,_sProfileUrl,_sImageUrl,_sThumbnailUrl,_aSubmitter,_aRootCategory,_aSubCategory,_sPeriod,_nLikeCount,_nPostCount,_bHasContentRatings,_aContentRatings,_aContentRating,_sContentRating,_sContentRatingName,_bIsNSFW,_bIsNsfw,_bIsAdult,_aTags';
    this.GAMEBANANA_SUBFEED_URL =
      'https://gamebanana.com/apiv11/Game/6498/Subfeed';
    this.GAMEBANANA_API_URL = 'https://gamebanana.com/apiv11';
    this.gameBananaFeaturedMods = [];
    this.gameBananaFeaturedSourceMods = [];
    this.gameBananaFeaturedIndex = 0;
    this.gameBananaFeaturedTimeline = null;
    this.gameBananaPreviewAnimation = null;
    this.gameBananaModsPage = 1;
    this.gameBananaModsTotalPages = 1;
    this.gameBananaDiscoverSort = 'recent';
    this.gameBananaCurrentSubfeedData = null;
    this.gameBananaCategoryFilter = 'all';
    this.gameBananaSkinSubcategoryOpen = false;
    this.gameBananaSkinSubcategoryId = null;
    this.gameBananaSkinSubcategories = null;
    this.gameBananaSearchQuery = '';
    this.gameBananaSearchDebounce = null;
    this.gameBananaModsRequestId = 0;
    this.gameBananaSearchListenerBound = false;
    this.gameBananaSubmissionCache = new Map();
    this.gameBananaDownloadCountCache = new Map();
    this.gameBananaDownloadCountRequests = new Map();
    this.gameBananaLastDetailSource = null;
    this.gameBananaDetailReturnInProgress = false;
    this.gameBananaDiscoverSnapshot = null;
    this.gameBananaCurrentDetail = null;
    this.skylineInstalledCache = null;

    // Cache pour réduire les requêtes
    this.cache = {
      gameBananaTopSubs: { data: null, timestamp: 0, ttl: 10 * 60 * 1000 }, // 10 minutes
      gameBananaTopSubsContentRatings: {
        data: null,
        timestamp: 0,
        ttl: 10 * 60 * 1000,
      },
    };
    this.pendingRequests = new Map(); // Éviter les requêtes simultanées
  }

  bindBackdropClose(modal: HTMLElement, onClose: () => void) {
    let pointerStartedOnBackdrop = false;
    modal.addEventListener('pointerdown', (event) => {
      pointerStartedOnBackdrop = event.target === modal;
    });
    modal.addEventListener('click', (event) => {
      const shouldClose = pointerStartedOnBackdrop && event.target === modal;
      pointerStartedOnBackdrop = false;
      if (shouldClose) {
        onClose();
      }
    });
  }

  // Vérifier si le cache est valide
  isCacheValid(key) {
    const cached = this.cache[key];
    if (!cached || !cached.data) return false;
    return Date.now() - cached.timestamp < cached.ttl;
  }

  // Obtenir les données du cache
  getCached(key) {
    if (this.isCacheValid(key)) {
      return this.cache[key].data;
    }
    return null;
  }

  // Mettre à jour le cache
  setCache(key, data) {
    if (this.cache[key]) {
      this.cache[key].data = data;
      this.cache[key].timestamp = Date.now();
    }
  }

  // Invalider le cache
  invalidateCache(key: string | null = null) {
    if (key) {
      if (this.cache[key]) {
        this.cache[key].data = null;
        this.cache[key].timestamp = 0;
      }
    } else {
      // Invalider tout le cache
      Object.keys(this.cache).forEach((k) => {
        this.cache[k].data = null;
        this.cache[k].timestamp = 0;
      });
    }
    console.log('[Social] Cache invalidated:', key || 'all');
  }

  escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  }

  getSocialTranslation(
    key: string,
    fallback: string,
    params: Record<string, string> = {},
  ) {
    const translation = window.i18n?.t?.(key, params);
    return translation && translation !== key ? translation : fallback;
  }


  async parseJsonResponse(response: Response) {
    const text = await response.text();
    if (!text) return null;

    try {
      return JSON.parse(text);
    } catch (error) {
      // GameBanana occasionally prepends PHP warnings to an otherwise valid
      // JSON response while still returning HTTP 200. Recover the JSON body
      // so Discover does not render an empty Featured section (and cache it).
      const jsonStart = text.search(/[\[{]/);
      if (jsonStart > 0) {
        try {
          return JSON.parse(text.slice(jsonStart));
        } catch (_jsonError) {
          // Keep the original response below when the suffix is not JSON.
        }
      }
      return { message: text };
    }
  }

  async fetchWithCache(url: string, options: RequestInit = {}, cacheKey: string | null = null) {
    if (cacheKey && this.isCacheValid(cacheKey)) {
      return this.getCached(cacheKey);
    }

    // Éviter les requêtes simultanées identiques
    if (this.pendingRequests.has(url)) {
      return await this.pendingRequests.get(url);
    }

    const requestPromise = (async () => {
      const response = await fetch(url, options);
      const data = await this.parseJsonResponse(response);
      if (cacheKey && response.ok) {
        this.setCache(cacheKey, data);
      }
      return data;
    })().finally(() => {
      this.pendingRequests.delete(url);
    });

    this.pendingRequests.set(url, requestPromise);
    return requestPromise;
  }
}
