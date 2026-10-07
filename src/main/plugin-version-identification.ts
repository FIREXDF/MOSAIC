import * as crypto from 'crypto';
import * as fs from 'fs';

const identifyUrl =
  'https://ultimatemovesetcompatibility.onrender.com/api/plugins/identify/batch';
const requestTimeoutMs = 12_000;
const hashesPerBatch = 60;

export type PluginIdentification = {
  sha256: string | null;
  actualVersion: string | null;
  matchedHash: string | null;
  matchedHashAlgorithm: 'sha256' | 'sha1' | 'md5' | null;
  status: 'matched' | 'unrecognized' | 'lookup-failed' | 'unreadable';
};

type FileHashes = {
  path: string;
  sha256: string;
  candidates: string[];
};

type BatchResult = {
  hash?: unknown;
  found?: unknown;
  result?: { matchedVersionLabel?: unknown } | null;
};

async function hashPlugin(filePath: string): Promise<FileHashes> {
  const before = await fs.promises.stat(filePath);
  const sha256 = crypto.createHash('sha256');
  const sha1 = crypto.createHash('sha1');
  const md5 = crypto.createHash('md5');

  await new Promise<void>((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk: Buffer) => {
      sha256.update(chunk);
      sha1.update(chunk);
      md5.update(chunk);
    });
    stream.on('end', resolve);
    stream.on('error', reject);
  });

  const after = await fs.promises.stat(filePath);
  if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) {
    throw new Error('Plugin changed while hashing');
  }

  const digest = sha256.digest('hex');
  return {
    path: filePath,
    sha256: digest,
    candidates: [digest, sha1.digest('hex'), md5.digest('hex')],
  };
}

async function identifyBatch(hashes: string[]): Promise<BatchResult[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(identifyUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ hashes }),
      signal: controller.signal,
    });
    if (!response.ok)
      throw new Error(`UMC API returned HTTP ${response.status}`);
    const data: unknown = await response.json();
    if (!Array.isArray(data)) throw new Error('Invalid UMC identify response');
    return data as BatchResult[];
  } finally {
    clearTimeout(timeout);
  }
}

export async function identifyPluginVersions(filePaths: string[]) {
  const identified = new Map<string, PluginIdentification>();
  const hashes: FileHashes[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(3, filePaths.length) }, async () => {
      while (next < filePaths.length) {
        const filePath = filePaths[next++];
        try {
          hashes.push(await hashPlugin(filePath));
        } catch {
          identified.set(filePath, {
            sha256: null,
            actualVersion: null,
            matchedHash: null,
            matchedHashAlgorithm: null,
            status: 'unreadable',
          });
        }
      }
    }),
  );

  const allCandidates = [...new Set(hashes.flatMap((item) => item.candidates))];
  const versions = new Map<string, string>();
  const failedHashes = new Set<string>();
  const batches: string[][] = [];
  for (let index = 0; index < allCandidates.length; index += hashesPerBatch) {
    batches.push(allCandidates.slice(index, index + hashesPerBatch));
  }

  let nextBatch = 0;
  await Promise.all(
    Array.from({ length: Math.min(2, batches.length) }, async () => {
      while (nextBatch < batches.length) {
        const batch = batches[nextBatch++];
        try {
          const results = await identifyBatch(batch);
          for (const entry of results) {
            if (entry?.found !== true || typeof entry.hash !== 'string')
              continue;
            const version = entry.result?.matchedVersionLabel;
            if (typeof version === 'string' && version.trim()) {
              versions.set(entry.hash.toLowerCase(), version.trim());
            }
          }
        } catch (error) {
          console.warn(
            '[DebugReport] Plugin version lookup failed:',
            error instanceof Error ? error.message : String(error),
          );
          batch.forEach((hash) => failedHashes.add(hash));
        }
      }
    }),
  );

  for (const item of hashes) {
    const matchedHash =
      item.candidates.find((hash) => versions.has(hash)) || null;
    const actualVersion = matchedHash
      ? versions.get(matchedHash) || null
      : null;
    identified.set(item.path, {
      sha256: item.sha256,
      actualVersion,
      matchedHash,
      matchedHashAlgorithm: matchedHash
        ? (['sha256', 'sha1', 'md5'] as const)[
            item.candidates.indexOf(matchedHash)
          ]
        : null,
      status: actualVersion
        ? 'matched'
        : item.candidates.some((hash) => failedHashes.has(hash))
          ? 'lookup-failed'
          : 'unrecognized',
    });
  }

  return identified;
}
