const START = '<!-- downloads:start -->';
const END = '<!-- downloads:end -->';

const ROWS = [
  {
    platform: 'Windows (x64)',
    files: [
      { label: 'Installer', match: /-win-x64\.exe$/ },
      { label: 'Portable', match: /-Portable\.exe$/ },
    ],
  },
  {
    platform: 'macOS (Apple Silicon)',
    files: [
      { label: 'DMG', match: /-mac-arm64\.dmg$/ },
      { label: 'ZIP', match: /-mac-arm64\.zip$/ },
    ],
  },
  {
    platform: 'macOS (Intel)',
    files: [
      { label: 'DMG', match: /-mac-x64\.dmg$/ },
      { label: 'ZIP', match: /-mac-x64\.zip$/ },
    ],
  },
  {
    platform: 'Linux (x64)',
    files: [
      { label: 'AppImage', match: /\.AppImage$/ },
      { label: 'DEB', match: /\.deb$/ },
      { label: 'RPM', match: /\.rpm$/ },
    ],
  },
];

const formatSize = (bytes) => `${Math.round(bytes / 1024 / 1024)} MB`;

const buildGrid = (repo, tag, assets) => {
  const rows = ROWS.map(({ platform, files }) => {
    const links = files.flatMap(({ label, match }) => {
      const asset = assets.find((item) => match.test(item.name));
      if (!asset) return [];
      const url = `https://github.com/${repo}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(asset.name)}`;
      return [`[${label}](${url}) (${formatSize(asset.size)})`];
    });
    return links.length ? `| ${platform} | ${links.join(' · ')} |` : null;
  }).filter(Boolean);

  if (!rows.length) return null;

  return [
    START,
    '## Downloads',
    '',
    '| Platform | Download |',
    '| --- | --- |',
    ...rows,
    END,
  ].join('\n');
};

const buildHeader = (tag) =>
  [
    ...(tag.includes('-alpha') ? ['# THIS IS AN ALPHA, IT MAY BE UNSTABLE AND BUGGY', ''] : []),
    ...(tag.includes('-beta') ? ['# THIS IS A BETA EXPECT BUGS', ''] : []),
    '# Changelog',
    '',
  ].join('\n');

const mergeBody = (body, grid, tag) => {
  const current = body || '';
  const start = current.indexOf(START);
  const end = current.indexOf(END);
  if (start !== -1 && end > start) {
    return current.slice(0, start) + grid + current.slice(end + END.length);
  }
  if (!current.trim()) {
    return `${buildHeader(tag)}\n${grid}\n`;
  }
  return `${current.trimEnd()}\n\n${grid}\n`;
};

const github = async (path, options = {}) => {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${process.env.GH_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${path} failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
};

const main = async () => {
  const tag = process.argv[2];
  const repo = process.env.GITHUB_REPOSITORY;
  if (!tag || !repo || !process.env.GH_TOKEN) {
    throw new Error('Usage: GH_TOKEN=... GITHUB_REPOSITORY=owner/repo node scripts/release-downloads.js <tag>');
  }

  const releases = await github(`/repos/${repo}/releases?per_page=100`);
  const release = releases.find((item) => item.tag_name === tag);
  if (!release) throw new Error(`No release found for ${tag}`);

  const grid = buildGrid(repo, tag, release.assets);
  if (!grid) {
    console.log(`No downloadable files on ${tag} yet`);
    return;
  }

  await github(`/repos/${repo}/releases/${release.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body: mergeBody(release.body, grid, tag) }),
  });
  console.log(grid);
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { buildGrid, mergeBody, buildHeader };
