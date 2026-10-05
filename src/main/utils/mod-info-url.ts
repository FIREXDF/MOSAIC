import * as fs from 'fs';
import * as path from 'path';

function findMultilineEnd(
  content: string,
  delimiter: string,
  start = 0,
): number {
  let end = content.indexOf(delimiter, start);
  while (end >= 0 && delimiter === '"""') {
    let backslashes = 0;
    for (let i = end - 1; i >= 0 && content[i] === '\\'; i--) backslashes++;
    if (backslashes % 2 === 0) break;
    end = content.indexOf(delimiter, end + 1);
  }
  return end;
}

/** Add a missing root URL without rewriting the mod author's metadata. */
export function ensureModInfoUrl(modFolderPath: string, sourceUrl: string) {
  const url = new URL(sourceUrl);
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password
  )
    return;
  const infoPath = path.join(modFolderPath, 'info.toml');
  let content = '';
  try {
    content = fs.readFileSync(infoPath, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  const serializedUrl = JSON.stringify(url.href);
  let offset = content.startsWith('\uFEFF') ? 1 : 0;
  let insertion = content.length;
  let multiline = '';
  // Descriptions may contain apparent URL assignments or section headers.
  for (const raw of content.slice(offset).match(/[^\n]*(?:\n|$)/g) || []) {
    if (!raw) continue;
    const line = raw.replace(/\r?\n$/, '');
    if (multiline) {
      if (findMultilineEnd(line, multiline) >= 0) multiline = '';
      offset += raw.length;
      continue;
    }
    if (/^\s*#/.test(line)) {
      offset += raw.length;
      continue;
    }
    if (/^\s*\[/.test(line)) {
      insertion = offset;
      break;
    }
    const assignment = line.match(/^(\s*(?:url|"url"|'url')\s*=\s*)/);
    const value = assignment ? line.slice(assignment[0].length) : '';
    if (assignment) {
      if (value.startsWith('"""') || value.startsWith("'''")) {
        const delimiter = value.slice(0, 3);
        const start = offset + assignment[0].length;
        const end = findMultilineEnd(content, delimiter, start + 3);
        // Malformed or nonempty values belong to the author; leave them alone.
        if (end < 0 || content.slice(start + 3, end).trim()) return;
        fs.writeFileSync(
          infoPath,
          content.slice(0, start) + serializedUrl + content.slice(end + 3),
          'utf8',
        );
        return;
      }
      const quoted = value.match(/^(?:"((?:\\.|[^"\\])*)"|'([^']*)')/);
      if (quoted) {
        if ((quoted[1] ?? quoted[2]).trim()) return;
        const start = offset + assignment[0].length;
        fs.writeFileSync(
          infoPath,
          content.slice(0, start) +
            serializedUrl +
            content.slice(start + quoted[0].length),
          'utf8',
        );
        return;
      }
      if (value.trim() && !value.trimStart().startsWith('#')) return;
      const start = offset + assignment[0].length;
      fs.writeFileSync(
        infoPath,
        content.slice(0, start) +
          serializedUrl +
          (value.trimStart().startsWith('#') ? ' ' : '') +
          content.slice(start),
        'utf8',
      );
      return;
    }
    const triple = line.match(/^[^=]+?=\s*("""|''')/);
    if (triple && findMultilineEnd(line, triple[1], triple[0].length) < 0)
      multiline = triple[1];
    offset += raw.length;
  }
  const before = content.slice(0, insertion);
  const after = content.slice(insertion);
  const separator =
    before && !before.endsWith('\n') && before !== '\uFEFF' ? newline : '';
  fs.writeFileSync(
    infoPath,
    `${before}${separator}url = ${serializedUrl}${newline}${after}`,
    'utf8',
  );
}
