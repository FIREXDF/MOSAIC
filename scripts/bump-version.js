const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const semver = require('semver');

const type = process.argv[2];
const custom = process.argv[3];
const dryRun = process.argv.includes('--dry-run');

const pkgPath = path.join(__dirname, '..', 'package.json');
const lockPath = path.join(__dirname, '..', 'package-lock.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

let nextVersion = '';

if (type === 'tag' && custom) {
  nextVersion = custom.replace(/^v/, '');
  const prerelease = semver.prerelease(nextVersion);
  if (
    prerelease &&
    (!['alpha', 'beta', 'latest'].includes(String(prerelease[0])) ||
      !Number.isInteger(prerelease[1]))
  ) {
    throw new Error(
      `Invalid prerelease tag "${custom}". Use a shared channel such as ` +
        `"v4.0.1-beta.1", not "v4.0.1-beta1".`,
    );
  }
} else if (type === 'custom' && custom) {
  nextVersion = custom.replace(/^v/, '');
} else if (
  custom &&
  (type === 'alpha' || type === 'beta' || type === 'stable')
) {
  const requestedBase = semver.parse(custom.replace(/^v/, ''));
  if (!requestedBase || requestedBase.prerelease.length > 0) {
    throw new Error(
      `Invalid base version "${custom}". Use a stable semantic version such as "4.1.0".`,
    );
  }

  const baseVersion =
    `${requestedBase.major}.${requestedBase.minor}.${requestedBase.patch}`;
  const tags = execSync('git tag -l', { encoding: 'utf8' }).split(/\r?\n/);

  if (type === 'stable') {
    const alreadyReleased = tags.some((tag) => {
      const version = semver.parse(tag.replace(/^v/, ''));
      return (
        version &&
        version.prerelease.length === 0 &&
        `${version.major}.${version.minor}.${version.patch}` === baseVersion
      );
    });
    if (alreadyReleased) {
      throw new Error(
        `Stable version "${baseVersion}" already has a release tag.`,
      );
    }
    nextVersion = baseVersion;
  } else {
    const escapedBase = baseVersion.replace(/\./g, '\\.');
    let maxNum = 0;
    for (const tag of tags) {
      const match = tag.match(
        new RegExp(`^v?${escapedBase}-${type}\\.(\\d+)$`),
      );
      if (match) {
        maxNum = Math.max(maxNum, Number.parseInt(match[1], 10));
      }
    }
    nextVersion = `${baseVersion}-${type}.${maxNum + 1}`;
  }
} else if (type === 'alpha' || type === 'beta' || type === 'stable') {
  const current = semver.parse(pkg.version);
  if (!current) {
    throw new Error(
      `package.json contains an invalid version: "${pkg.version}"`,
    );
  }

  const currentPrerelease = semver.prerelease(current);
  const currentBase = `${current.major}.${current.minor}.${current.patch}`;
  let tags = [];
  try {
    tags = execSync('git tag -l', { encoding: 'utf8' }).split(/\r?\n/);
  } catch (error) {
    console.warn(`Unable to inspect existing tags: ${error.message}`);
  }

  const escapedCurrentBase = currentBase.replace(/\./g, '\\.');
  const hasLegacyBetaReleases =
    type === 'beta' &&
    tags.some((tag) =>
      new RegExp(`^v?${escapedCurrentBase}-beta\\d+$`).test(tag),
    );
  const hasMigrationRelease = tags.some((tag) =>
    new RegExp(`^v?${escapedCurrentBase}-latest\\.\\d+$`).test(tag),
  );

  if (!currentPrerelease && hasLegacyBetaReleases && !hasMigrationRelease) {
    // Releases 4.0.0-beta5/6 forced electron-updater to the "latest" channel.
    // Publish one bridge on that channel so those installations can receive
    // this fix. The following beta run advances to 4.0.1-beta.1.
    nextVersion = `${currentBase}-latest.1`;
  } else {
    const releaseVersions = tags
      .map((tag) => semver.parse(tag.replace(/^v/, '')))
      .filter((version) => {
        if (!version) {
          return false;
        }
        if (version.prerelease.length === 0) {
          return true;
        }

        const channel = String(version.prerelease[0]);
        return (
          ['alpha', 'beta', 'latest'].includes(channel) &&
          version.prerelease.length === 2 &&
          Number.isInteger(version.prerelease[1])
        );
      });
    releaseVersions.push(current);
    releaseVersions.sort(semver.rcompare);

    const latestRelease = releaseVersions[0];
    const latestPrerelease = semver.prerelease(latestRelease);
    const latestChannel = latestPrerelease
      ? String(latestPrerelease[0])
      : null;
    const latestBase = `${latestRelease.major}.${latestRelease.minor}.${latestRelease.patch}`;
    const nextPatchBase = latestPrerelease
      ? `${latestRelease.major}.${latestRelease.minor}.${latestRelease.patch + 1}`
      : semver.inc(latestRelease, 'patch');
    let baseVersion;

    if (type === 'stable') {
      const hasLatestStableRelease = tags.some((tag) => {
        const version = semver.parse(tag.replace(/^v/, ''));
        return (
          version &&
          version.prerelease.length === 0 &&
          `${version.major}.${version.minor}.${version.patch}` === latestBase
        );
      });
      const canPromotePrerelease = ['alpha', 'beta', 'latest'].includes(
        latestChannel,
      );

      nextVersion =
        canPromotePrerelease && !hasLatestStableRelease
          ? latestBase
          : semver.inc(latestRelease, 'patch');
    } else {
      const canPromoteAlphaToBeta =
        type === 'beta' && latestChannel === 'alpha';
      const continuesCurrentChannel = latestChannel === type;
      baseVersion =
        continuesCurrentChannel || canPromoteAlphaToBeta
          ? latestBase
          : nextPatchBase;

      if (!baseVersion) {
        throw new Error(`Unable to calculate the next ${type} version`);
      }

      let maxNum = 0;
      for (const tag of tags) {
        const match = tag.match(
          new RegExp(
            `^v?${baseVersion.replace(/\./g, '\\.')}-${type}\\.(\\d+)$`,
          ),
        );
        if (match) {
          maxNum = Math.max(maxNum, Number.parseInt(match[1], 10));
        }
      }

      nextVersion = `${baseVersion}-${type}.${maxNum + 1}`;
    }
  }
} else {
  throw new Error(
    'Usage: bump-version.js <alpha|beta|stable|custom|tag> [custom-version-or-tag]',
  );
}

if (!semver.valid(nextVersion)) {
  throw new Error(`Invalid semantic version: "${nextVersion}"`);
}

const nextPrerelease = semver.prerelease(nextVersion);
const requestedUpdateChannel = nextPrerelease
  ? String(nextPrerelease[0])
  : 'latest';
const updateChannel = ['alpha', 'beta'].includes(requestedUpdateChannel)
  ? requestedUpdateChannel
  : 'latest';
for (const publisher of pkg.build?.publish ?? []) {
  if (publisher.provider === 'github') {
    publisher.channel = updateChannel;
  }
}

if (!dryRun) {
  pkg.version = nextVersion;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  if (fs.existsSync(lockPath)) {
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    lock.version = nextVersion;
    if (lock.packages && lock.packages['']) {
      lock.packages[''].version = nextVersion;
    }
    fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
  }
}

console.log(nextVersion);
