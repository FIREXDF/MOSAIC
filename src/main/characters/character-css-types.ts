export interface CharacterCssEntry {
  id: string;
  nameId: string;
  displayName: string;
  number: string;
  imageUrl: string | null;
  order: number;
  hidden: boolean;
  canSelect: boolean;
  isRandom: boolean;
  uiSeriesId: string;
  fighterKind: string;
  fighterKindCorps: string;
  altCharaId: string;
  fighterType: string;
  exhibitYear: string;
  colorNum: string;
  colorStartIndex: string;
  isMii: boolean;
  isBoss: boolean;
  isHiddenBoss: boolean;
  isGroup: boolean;
  groupId: string | null;
  slots: CharacterCssSlot[];
}

export interface CharacterCssSlot {
  slotIndex: number;
  cxxIndex: string;
  nxxIndex: string;
  characallLabel: string;
  namChr0: string;
  namChr1: string;
  namChr2: string;
  namChr3: string;
  namStageName: string;
}

export interface CharacterCssLayoutData {
  source: 'saved' | 'canonical';
  visibleCharacters: CharacterCssEntry[];
  hiddenCharacters: CharacterCssEntry[];
  groups: Record<string, CharacterCssEntry[]>;
}

export interface CharacterCssLayoutPayload {
  visibleCharacterIds: string[];
  hiddenCharacterIds: string[];
  groups?: Record<string, string[]>;
  createdGroups?: CharacterCssGroupCreate[];
  renamedCharacters?: Record<string, string>;
  characterUpdates?: Record<string, CharacterCssUpdate>;
}

export interface CharacterCssGroupCreate {
  id: string;
  nameId: string;
  displayName: string;
}

export interface CharacterCssSourceImportPayload {
  prcPath: string;
  layoutPrcPath: string;
  msgNamePath: string;
}

export interface DuplicateCharacterCssPayload {
  sourceCharacterId: string;
  newUiCharaId: string;
  newNameId?: string | null;
  newDisplayName?: string | null;
  colorStartIndex?: number;
  colorCount?: number;
}

export interface RemoveCharacterCssPayload {
  characterId: string;
}

export interface RemoveEchoSlotPayload {
  characterId: string;
  modPath?: string;
}

export interface CreateEchoSlotPayload {
  sourceCharacterId: string;
  newNameId: string;
  newDisplayName: string;
  colorCount: number;
  colorStartIndex: number;
  useTwoBaseModels?: boolean;
  modPath: string;
}

export interface CharacterCssUpdate {
  uiCharaId?: string;
  uiSeriesId?: string;
  nameId?: string;
  fighterKind?: string;
  fighterKindCorps?: string;
  altCharaId?: string;
  fighterType?: string;
  exhibitYear?: string;
  colorNum?: string;
  colorStartIndex?: string;
  canSelect?: boolean;
  isMii?: boolean;
  isBoss?: boolean;
  isHiddenBoss?: boolean;
  slots?: Record<string, Partial<CharacterCssSlot>>;
}
