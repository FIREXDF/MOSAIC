interface NoneUpdate {
  type: 'none';
}

interface SuccessUpdate {
  type: 'success';
  fileName: string;
}

interface ConflictUpdate {
  type: 'conflict';
  conflictCount: number;
  modsWithConflictsCount: number;
}

interface DownloadItem {
  id: string;
  fileName: string;
  modName?: string;
  statusText?: string;
  progress: number;
  speedText?: string;
  phaseLabel?: string;
  iconClass?: string;
}

interface DownloadUpdate {
  type: 'download';
  downloads: DownloadItem[];
}

type StatusTab =
  | 'downloads'
  | 'marketplace'
  | 'tools'
  | 'plugins'
  | 'settings'
  | 'characters'
  | 'fightplanner';

interface StatusSnapshot {
  content: string;
  useInnerHTML?: boolean;
  downloading?: boolean;
}
