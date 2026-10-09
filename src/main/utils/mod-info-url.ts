import * as fs from 'fs';
import * as path from 'path';

function isGameBananaDownloadUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      ['gamebanana.com', 'www.gamebanana.com'].includes(url.hostname.toLowerCase()) &&
      (/^\/(?:dl|mmdl)\/\d+(?:\/|,|$)/i.test(url.pathname) ||
        /^\/(?:mods|sounds)\/download\/\d+\/?$/i.test(url.pathname))
    );
  } catch {
    return false;
  }
}

export function ensureModInfoMetadata(
  modFolderPath: string,
  metadata: {
    display_name?: string;
    authors?: string;
    version?: string;
    category?: string;
    description?: string;
  },
) {
  const infoPath = path.join(modFolderPath, 'info.toml');
  let content = '';
  try {
    content = fs.readFileSync(infoPath, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  const missing = (['display_name', 'authors', 'version', 'category', 'description'] as const)
    .filter((key) => metadata[key] && !new RegExp(`^\\s*(?:${key}|"${key}"|'${key}')\\s*=`, 'm').test(content))
    .map((key) => {
      const value = metadata[key] as string;
      if (key === 'description') {
        const description = value.replace(/\r\n?/g, '\n').trim();
        const serialized = /\\|"""/.test(description)
          ? JSON.stringify(description)
          : `"""${newline}${description.replace(/\n/g, newline)}${newline}"""`;
        return `${key} = ${serialized}`;
      }
      return `${key} = ${JSON.stringify(value)}`;
    });
  if (!missing.length) return;

  const bom = content.startsWith('\uFEFF') ? '\uFEFF' : '';
  fs.writeFileSync(
    infoPath,
    bom + missing.join(newline) + newline + content.slice(bom.length),
    'utf8',
  );
}

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
        const existingUrl = (quoted[1] ?? quoted[2]).trim();
        if (existingUrl && !isGameBananaDownloadUrl(existingUrl)) return;
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
