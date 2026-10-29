type UmcGameBananaMoveset = import('../../main/ipc/handlers/umc-handlers').UmcGameBananaMoveset;
type UmcCompatibilityResult = import('../../main/ipc/handlers/umc-handlers').UmcCompatibilityDto;

type CharacterModStatus = 'active' | 'disabled' | 'conflict';

interface Character {
  id: string;
  info: { name: string; number: string };
  mods: {
    name: string;
    path: string;
    status: CharacterModStatus;
    slots: string[];
  }[];
}

interface CharacterMovesetMod {
  name: string;
  path: string;
  status: CharacterModStatus;
  category: string;
  description: string;
  slots: string[];
  gameBananaId: number | null;
}

interface CharacterMovesetGroup {
  id: string;
  info: { name: string; number: string };
  mods: CharacterMovesetMod[];
}

interface MovesetCssOptions {
  sourceCharacterId: string;
  newUiCharaId: string;
  newNameId: string;
  newDisplayName: string;
  colorStartIndex: number;
  colorCount: number;
}

interface UmcMoveset {
  movesetId: number;
  moddedCharName: string;
  thumbhImageUrl?: string | null;
  vanillaCharDisplayName?: string | null;
  seriesName?: string | null;
  releaseState?: string | null;
  cardModders?: string[] | null;
  modders?: string[] | null;
}

interface CharacterCssEntry {
  id: string;
  nameId: string;
  displayName: string;
  number: string;
  imageUrl: string | null;
  imageSource?: 'umc' | 'custom';
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

interface CharacterCssGroupCreate {
  id: string;
  nameId: string;
  displayName: string;
}

interface CharacterCssSlot {
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
