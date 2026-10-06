import { app, nativeImage } from 'electron';
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { pathToFileURL } from 'url';
import store from '../store';

const IMAGE_STORE_KEY = 'cssCustomImages';
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

export function cssCharacterImageKey(characterId: string) {
  const key =
    typeof characterId === 'string'
      ? characterId
          .trim()
          .toLowerCase()
          .replace(/^ui_chara_/, '')
      : '';
  if (!/^[a-z0-9][a-z0-9_-]{0,127}$/.test(key))
    throw new Error('Invalid Character ID.');
  return key;
}

function imageRecords(): Record<string, string> {
  const value = store.get(IMAGE_STORE_KEY);
  return value && typeof value === 'object' && !Array.isArray(value)
    ? ({ ...value } as Record<string, string>)
    : {};
}

function managedImagePath(filename: string) {
  if (typeof filename !== 'string' || !/^[0-9a-f-]{36}\.png$/.test(filename))
    return null;
  return path.join(app.getPath('userData'), 'character-css-images', filename);
}

async function discardManagedImage(filename: string) {
  const filePath = managedImagePath(filename);
  if (filePath) await fs.unlink(filePath).catch(() => undefined);
}

export async function getCssCharacterImages(): Promise<Record<string, string>> {
  const images: Record<string, string> = {};
  await Promise.all(
    Object.entries(imageRecords()).map(async ([id, filename]) => {
      const filePath = managedImagePath(filename);
      if (!filePath) return;
      try {
        if ((await fs.stat(filePath)).isFile())
          images[id] = pathToFileURL(filePath).href;
      } catch {
        /* Missing files fall back to the character's normal image. */
      }
    }),
  );
  return images;
}

export async function saveCssCharacterImage(
  characterId: string,
  sourcePath: string,
) {
  const key = cssCharacterImageKey(characterId);
  const stat = await fs.stat(sourcePath);
  if (!stat.isFile() || stat.size > MAX_IMAGE_BYTES)
    throw new Error('Choose an image smaller than 20 MB.');
  const buffer = await fs.readFile(sourcePath);
  if (buffer.length > MAX_IMAGE_BYTES)
    throw new Error('Choose an image smaller than 20 MB.');
  const image = nativeImage.createFromBuffer(buffer);
  if (image.isEmpty()) throw new Error('This image format could not be read.');
  const { width, height } = image.getSize();
  if (width * height > 16_000_000)
    throw new Error('Choose an image smaller than 16 megapixels.');
  const filename = `${randomUUID()}.png`;
  const filePath = managedImagePath(filename)!;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, image.toPNG());
  const records = imageRecords();
  const previous = records[key];
  try {
    store.set(IMAGE_STORE_KEY, { ...records, [key]: filename });
  } catch (error) {
    await discardManagedImage(filename);
    throw error;
  }
  if (previous) await discardManagedImage(previous);
  return pathToFileURL(filePath).href;
}

export async function removeCssCharacterImage(characterId: string) {
  const key = cssCharacterImageKey(characterId);
  const records = imageRecords();
  const previous = records[key];
  delete records[key];
  store.set(IMAGE_STORE_KEY, records);
  if (previous) await discardManagedImage(previous);
}
