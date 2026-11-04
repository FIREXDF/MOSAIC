export const UI_CHARA_DB_PRCXML = 'ui/param/database/ui_chara_db.prcxml';
export const VANILLA_COLOR_NUM = 8;
export const FIGHTER_SLOT_PATTERN =
  /^fighter\/([a-z0-9_]+)\/(?:[^/]+\/)*c(\d{2,3})(?:\/|$)/;

const LEAF_STRUCT_PATTERN =
  /<struct\b([^>]*)>((?:(?!<\/?struct\b)[\s\S])*)<\/struct>/g;
const COLOR_NUM_PATTERN = /<byte\s+hash="color_num"\s*>\s*(\d+)\s*<\/byte>/;

function getStructIndex(
  attributes: string,
  body: string,
  fighterIndexes: Map<string, number>,
): number | undefined {
  const charaId = body.match(
    /hash="ui_chara_id"\s*>\s*ui_chara_([a-z0-9_]+)\s*</,
  );
  if (charaId) return fighterIndexes.get(charaId[1]);

  const index = attributes.match(/\bindex="(\d+)"/);
  return index ? parseInt(index[1]) : undefined;
}

export function readColorNums(
  content: string,
  fighterIndexes: Map<string, number>,
): Map<number, number> {
  const colorNums = new Map<number, number>();

  for (const [, attributes, body] of content.matchAll(LEAF_STRUCT_PATTERN)) {
    const colorNum = body.match(COLOR_NUM_PATTERN);
    const index = getStructIndex(attributes, body, fighterIndexes);
    if (colorNum && index !== undefined) {
      colorNums.set(index, parseInt(colorNum[1]));
    }
  }

  return colorNums;
}

export function setColorNum(
  content: string,
  index: number,
  colorNum: number,
  fighterIndexes: Map<string, number>,
): string | null {
  const colorNumTag = `<byte hash="color_num">${colorNum}</byte>`;
  let found = false;

  const updated = content.replace(
    LEAF_STRUCT_PATTERN,
    (match, attributes: string, body: string) => {
      if (getStructIndex(attributes, body, fighterIndexes) !== index) {
        return match;
      }
      found = true;
      const newBody = COLOR_NUM_PATTERN.test(body)
        ? body.replace(COLOR_NUM_PATTERN, colorNumTag)
        : colorNumTag + body;
      return `<struct${attributes}>${newBody}</struct>`;
    },
  );
  if (found) return updated;

  const struct = `<struct index="${index}">${colorNumTag}</struct>`;
  const dummy = new RegExp(`<hash40 index="${index}">dummy</hash40>`);
  if (dummy.test(content)) return content.replace(dummy, struct);

  const dbRootEnd =
    /(<list\b[^>]*hash="db_root"[^>]*>(?:(?!<\/list>)[\s\S])*)<\/list>/;
  if (dbRootEnd.test(content)) {
    return content.replace(dbRootEnd, (_, start) => `${start}${struct}</list>`);
  }

  return null;
}
